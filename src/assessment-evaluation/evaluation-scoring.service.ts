// EvaluationScoringService — P5 평가(scoring)의 thin orchestration service
// (ADR-0032 Decision §2 LLM scoring 입력 shape + §3 난이도·기여도·양 output 산출
// + Follow-up §2 scoring service slice). 평가 단위 1 건(`EvaluationInput`)을 받아
// 이미 검증된 순수 함수 4 종(`buildEvaluationPrompt` / `classifyNarrative` /
// `calculateEvaluationVolume`) 과 기존 `LlmGateway.generate` 를 compose 해
// `EvaluationResult` 5 필드(unitId / narrative / difficulty / contribution / volume)
// 를 조립한다. 새 알고리즘 0 — 순수 함수는 import 호출만, 본 service 는 compose +
// gateway 호출만 담당한다.
//
// gateway 의존(ADR-0032 §2): `LlmGateway` interface 를 LLM_GATEWAY DI token 으로
// 생성자 주입받는다(구현체 `LlmHttpGateway` 직접 import 의존 금지 — interface/token
// 의존이라 test 에서 mock gateway 주입이 용이하다). assessment-evaluation.module.ts
// 가 LLM_GATEWAY 를 LlmModule export 의 LlmHttpGateway 로 useExisting 바인딩한다.
// 실 네트워크 round-trip / live credential 은 본 service 책임 밖 — gateway 구현체가
// 담당하고, test 는 mock `generate` 로만 검증한다(실 LLM 호출 0).
//
// 책임 경계(ADR-0032 Follow-up §2 — 후속 slice):
//   - controller / DTO / endpoint / R-9 사용자 지정 기간 — HTTP layer 는 후속 slice.
//   - `EvaluationResult` 영속화 / Prisma migration / Assessment·Contribution row
//     매핑 — §5 schema 게이트 deferred. 본 service 는 in-memory 반환만(DB write 0).
//   - batch / aggregate 평가(일·주·월) — 단위 1 건 scoring 만. 상위 layer 후속 slice.
//   - 평가-side dedup / self-follow-up 제외 적용(T-0289) — 여러 단위 사전 필터는
//     상위 orchestrator 책임. 본 service 는 이미 정규화된 단위 1 건만 받는다.
//   - `Activity` → `EvaluationInput` 매핑(T-0287) — 입력 준비 단계(상위 orchestrator).
import { Inject, Injectable } from "@nestjs/common";

import { LLM_GATEWAY, LlmGateway } from "../llm/llm-gateway.interface";

import type { EvaluationInput } from "./domain/evaluation-input";
import {
  buildEvaluationPrompt,
  classifyNarrative,
} from "./domain/evaluation-prompt";
import type { EvaluationResult } from "./domain/evaluation-result";
import { calculateEvaluationVolume } from "./domain/evaluation-volume";

/**
 * `scoreUnit` 호출 옵션 — gateway 의 `LlmGenerateOptions.modelId`(필수) source.
 *
 * `EvaluationInput` 만으로는 어떤 LLM model 로 평가할지 도출할 수 없으므로
 * (modelId 는 입력 단위가 아니라 평가 정책 차원의 선택이다), caller(상위
 * orchestrator)가 modelId 를 본 옵션으로 넘긴다(ADR-0032 §2 — `generate` 시그니처
 * 무변경 재사용). 본 slice 는 modelId 단일 필드만 박제한다 — temperature 등 provider
 * 별 확장은 `LlmGenerateOptions` 가 확장될 때 함께 늘린다(현 interface 무변경).
 */
export interface ScoringOptions {
  // 사용할 LLM model 식별자 — gateway 의 `LlmGenerateOptions.modelId` 로 그대로 전달.
  modelId: string;
}

@Injectable()
export class EvaluationScoringService {
  // LlmGateway 는 LLM_GATEWAY token 으로 주입(interface 는 runtime 소거라 class
  // token 불가 — string token 으로 바인딩). module 이 LlmHttpGateway 를 useExisting
  // 바인딩하며, test 는 이 자리에 mock { generate } 를 주입해 실 LLM 호출 0 으로 검증.
  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  /**
   * 평가 단위 1 건을 scoring 해 `EvaluationResult` 5 필드를 조립한다
   * (ADR-0032 §2/§3 compose).
   *
   * 흐름:
   *   1. `buildEvaluationPrompt(input)` 로 결정적 prompt 조립(raw 본문 0, REQ-032).
   *   2. `gateway.generate(prompt, { modelId })` 를 **정확히 1 회** 호출한다
   *      (ADR-0032 §2 — 평가 단위 1 건당 generate 1 회. 단순·결정적·실패 격리).
   *   3. 반환 `narrative` 를 `classifyNarrative(narrative)` 로 `{ difficulty,
   *      contribution }` 추출(R-97 routing record / R-37·38 품질 분류).
   *   4. `calculateEvaluationVolume(input)` 로 metadata 기반 결정적 `volume` 산출.
   *   5. `unitId`(= input.unitId 그대로 전사) + narrative + difficulty +
   *      contribution + volume 5 필드를 `EvaluationResult` 로 조립 반환.
   *
   * difficulty 주입 정책(ADR-0032 §2 박제): 난이도는 narrative 의 **산물**이므로
   * (분류는 generate 후에야 가능) generate 호출 전에는 알 수 없다. 따라서 본 slice 는
   * `options.difficulty` 를 **미주입**한다(undefined) — gateway 는 modelId 를 config
   * id 로 직접 사용하는 경로로 동작한다(R-97 active routing 은 사전 난이도가 확정되는
   * 별도 후속 slice 책임). 분류된 difficulty 는 호출로 되먹이지 않고 결과에만 기록한다.
   *
   * error 정책: gateway.generate 가 reject(network / timeout / non-2xx / config 부재
   * 등)하면 본 service 는 그 error 를 **swallow 하지 않고 그대로 전파(throw)** 한다
   * — 단위 1 건 실패가 fallback 결과로 위장되지 않게 한다(ADR-0032 §2 실패 격리).
   * narrative 가 malformed / 빈 문자열이면 `classifyNarrative` 가 안전 default
   * (medium / low)로 환원하므로 throw 0 — 결과는 항상 조립된다.
   *
   * 동일 input + 동일 mock 응답 → 동일 `EvaluationResult`(부수효과 0, 결정적 compose).
   *
   * @param input 평가 단위 입력(`EvaluationInput`, 이미 정규화됨).
   * @param options scoring 옵션 — gateway 의 modelId source(`ScoringOptions`).
   * @returns 조립된 `EvaluationResult`(5 필드).
   */
  async scoreUnit(
    input: EvaluationInput,
    options: ScoringOptions,
  ): Promise<EvaluationResult> {
    // (1) prompt 조립 — 순수 함수, raw 본문 0.
    const prompt = buildEvaluationPrompt(input);

    // (2) gateway 호출 1 회 — difficulty 미주입(narrative 산물이라 사전 미상).
    //     reject 는 전파(swallow 0).
    const { narrative } = await this.gateway.generate(prompt, {
      modelId: options.modelId,
    });

    // (3) narrative 분류 — marker 부재 / 미인식 값은 순수 함수가 default 로 환원(throw 0).
    const { difficulty, contribution } = classifyNarrative(narrative);

    // (4) volume 산출 — metadata 기반 결정적 수치(LLM 무관).
    const volume = calculateEvaluationVolume(input);

    // (5) EvaluationResult 조립 — unitId 는 input 그대로 전사(결과 ↔ 입력 trace).
    return {
      unitId: input.unitId,
      narrative,
      difficulty,
      contribution,
      volume,
    };
  }
}
