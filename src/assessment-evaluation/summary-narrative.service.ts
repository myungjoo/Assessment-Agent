// SummaryNarrativeService — P5 aggregate(batch) 평가의 thin orchestration service
// (ADR-0035 §Decision 1 narrative = LLM 정성 batch + §Decision 5 batch prompt 경계).
// 한 (person, period, periodStart) 좌표의 단위 평가 묶음(`EvaluationResult[]`)을 받아
// `buildSummaryBatchPrompt`(순수 함수)로 batch prompt 를 조립하고 기존 `LlmGateway.
// generate` 를 **정확히 1 회** 호출해 그 좌표의 요약 narrative 1 건을 생성한다.
// 단위 N 건 → batch 호출 1 회 (ADR-0032 §Consequences 가 예고한 batch 최적화 실현).
// 새 알고리즘 0 — 순수 함수는 import 호출만, 본 service 는 compose + gateway 호출만.
//
// gateway 의존(ADR-0032 §2 / ADR-0035 §Decision 5): `LlmGateway` interface 를
// LLM_GATEWAY DI token 으로 생성자 주입받는다(구현체 `LlmHttpGateway` 직접 import
// 의존 금지 — interface/token 의존이라 test 에서 mock gateway 주입이 용이하다).
// `EvaluationScoringService`(T-0291)의 gateway 주입 패턴을 정확히 mirror 한다.
// `generate(prompt, options)` 시그니처는 **변경 0** 으로 재사용 — 단위 평가가 단위
// 1 건당 1 회였다면 본 batch 평가는 Summary 좌표 1 개당 1 회다.
//
// batch 경계 강제(ADR-0035 §Decision 5): 본 service 의 `generateBatchNarrative` 는
// 단일 `SummaryBatchContext`(한 person 의 한 period) + 그 좌표의 `EvaluationResult[]`
// 만 받는다. cross-person 묶음(여러 person 을 한 prompt 로)은 시그니처상 표현 불가 —
// 좌표가 한 개로 고정돼 한 person 결과가 다른 person 입력에 오염될 표면이 없다
// (fairness risk / 실패 격리 약화 차단, §Decision 5 / Alternatives D).
//
// 책임 경계(ADR-0035 §Follow-ups — 다음 slice T-0308 write service):
//   - `Summary` DB write / reset-and-recreate / idempotency key / partial-reset —
//     T-0308 write service 가 본 narrative + `aggregateMetricScore`(T-0306) 의
//     metricScore 를 결합해 수행. 본 service 는 narrative string 반환만(DB write 0).
//   - metricScore 계산 — T-0306 `aggregateMetricScore` 담당(본 slice 는 narrative 만).
//   - `isPeriodEvaluable` 시점 게이트 — write service / orchestrator slice 책임.
//   - controller / endpoint 배선 — 후속 slice.
//   - live LLM 실 호출 — §5 credential deferred(본 slice 는 mocked-LLM unit).
import { Inject, Injectable } from "@nestjs/common";

import { LLM_GATEWAY, LlmGateway } from "../llm/llm-gateway.interface";

import type { EvaluationResult } from "./domain/evaluation-result";
import {
  buildSummaryBatchPrompt,
  type SummaryBatchContext,
} from "./domain/summary-batch-prompt";

/**
 * `generateBatchNarrative` 호출 옵션 — gateway 의 `LlmGenerateOptions.modelId`(필수)
 * source. 좌표(`SummaryBatchContext`) / 단위 묶음만으로는 어떤 LLM model 로 평가할지
 * 도출할 수 없으므로(modelId 는 입력이 아니라 평가 정책 차원의 선택), caller(상위
 * orchestrator / write service)가 modelId 를 본 옵션으로 넘긴다(ADR-0032 §2 —
 * `generate` 시그니처 무변경 재사용). 본 slice 는 modelId 단일 필드만 박제한다 —
 * temperature 등 provider 별 확장은 `LlmGenerateOptions` 가 확장될 때 함께 늘린다.
 */
export interface SummaryNarrativeOptions {
  // 사용할 LLM model 식별자 — gateway 의 `LlmGenerateOptions.modelId` 로 그대로 전달.
  modelId: string;
}

@Injectable()
export class SummaryNarrativeService {
  // LlmGateway 는 LLM_GATEWAY token 으로 주입(interface 는 runtime 소거라 class
  // token 불가 — string token 으로 바인딩). module 이 LlmHttpGateway 를 useExisting
  // 바인딩하며, test 는 이 자리에 mock { generate } 를 주입해 실 LLM 호출 0 으로 검증.
  constructor(@Inject(LLM_GATEWAY) private readonly gateway: LlmGateway) {}

  /**
   * 한 (person, period, periodStart) 좌표의 단위 평가 묶음을 종합해 그 구간의 요약
   * narrative 1 건을 생성한다(ADR-0035 §Decision 1 / §Decision 5 batch compose).
   *
   * 흐름:
   *   1. `buildSummaryBatchPrompt(context, results)` 로 결정적 batch prompt 조립
   *      (typed surface 만 — per-unit narrative/difficulty/contribution/volume,
   *      raw 본문 0, REQ-032 / §Decision 2).
   *   2. `gateway.generate(prompt, { modelId })` 를 **정확히 1 회** 호출한다
   *      (ADR-0035 §Decision 5 — Summary 좌표 1 개당 1 회. 단위 N → batch 호출 1).
   *      difficulty 는 미주입(undefined) — batch narrative 는 사전 난이도 routing
   *      대상이 아니다(좌표 요약이라 단일 난이도로 환원되지 않음).
   *   3. 반환 `narrative` 를 그대로 반환한다(`LlmGenerateResult.narrative` 수용 —
   *      생성 결과물, raw 인용 아님, R-59 적용 외).
   *
   * batch 경계: 입력은 정확히 1 좌표(`context` 단일 + 그 좌표의 `results`). cross-person
   * 묶음은 시그니처상 불가하다(§Decision 5).
   *
   * 빈 묶음 정책: `results.length === 0` 이어도 builder 가 valid prompt(빈 묶음 안내)를
   * 만들므로 throw 0 — gateway 가 그 prompt 로 narrative 를 반환한다. 빈 좌표를 아예
   * 호출에서 제외할지(평가 가능 시점 게이트)는 상위 write service / orchestrator 책임
   * (`isPeriodEvaluable`, T-0306). 본 service 는 받은 묶음을 그대로 1 호출로 처리한다.
   *
   * error 정책: gateway.generate 가 reject(network / timeout / non-2xx / config 부재
   * 등)하면 본 service 는 그 error 를 **swallow 하지 않고 그대로 전파(throw)** 한다 —
   * 좌표 1 개 실패가 fallback narrative 로 위장되지 않게 한다(ADR-0032 §2 실패 격리).
   * gateway 가 빈/누락 narrative(빈 문자열)를 반환하면 그대로 반환한다(빈 narrative 의
   * 후처리/재시도는 write service 정책 — 본 slice 는 생성 결과를 위장 없이 전달).
   *
   * 동일 입력 + 동일 mock 응답 → 동일 narrative(부수효과 0, 결정적 compose).
   *
   * @param context batch narrative 좌표(personId / period / periodStart).
   * @param results 그 좌표의 단위 평가 묶음(`EvaluationResult[]`).
   * @param options narrative 옵션 — gateway 의 modelId source.
   * @returns 그 좌표의 요약 narrative 문자열(gateway 가 생성한 결과 그대로).
   */
  async generateBatchNarrative(
    context: SummaryBatchContext,
    results: EvaluationResult[],
    options: SummaryNarrativeOptions,
  ): Promise<string> {
    // (1) batch prompt 조립 — 순수 함수, typed surface 만(raw 본문 0).
    const prompt = buildSummaryBatchPrompt(context, results);

    // (2) gateway 호출 1 회 — difficulty 미주입(좌표 요약이라 사전 난이도 routing
    //     대상 아님). reject 는 전파(swallow 0).
    const { narrative } = await this.gateway.generate(prompt, {
      modelId: options.modelId,
    });

    // (3) narrative 그대로 반환 — 빈/누락 narrative 도 위장 없이 전달(후처리는 후속).
    return narrative;
  }
}
