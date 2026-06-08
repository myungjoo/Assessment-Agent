// EvaluationOrchestratorService — P5 평가(scoring) layer 의 상위 compose slice
// (T-0292, ADR-0032 Decision §1 통합 평가 입력 정규화 + §4 평가-side dedup +
// §2 단위 1 건당 scoring). 지금까지 P5 의 dependency-free piece(T-0287 매퍼 /
// T-0288 result+volume / T-0289 dedup 2 종 / T-0290 prompt+classify / T-0291
// scoreUnit)가 전부 MERGED 됐으나, "수집된 `Activity` 목록을 받아 평가 입력으로
// 정규화 → 평가-side dedup / self-follow-up 제외 적용 → 남은 단위마다 scoring →
// 결과 목록 반환" 의 전체 흐름을 묶는 layer 가 0 이었다. 본 service 가 그 빈자리를
// 채우는 thin orchestrator 다 — 새 알고리즘 0, 이미 검증된 매퍼 + dedup 2 종 +
// `scoreUnit` 의 compose + 순서 결정만 담당한다.
//
// 흐름(ADR-0032 §1/§4/§2 compose):
//   1. `activities.map(mapActivityToEvaluationInput)` 로 `Activity[]` → `EvaluationInput[]`
//      정규화(§1). raw 본문 0 — typed surface 만 전사(REQ-032).
//   2. 평가-side dedup 적용(§4) — 아래 박제 순서로 두 순수 함수를 합성.
//   3. 남은 각 `EvaluationInput` 마다 `scoringService.scoreUnit(input, options)` 호출 →
//      `EvaluationResult[]` 수집 반환(§2 단위 1 건당 scoring).
//
// dedup 적용 순서 박제(ADR-0032 §4): `dedupTemporalDuplicates`(R-21 earliest-wins) →
// `excludeSelfFollowUps`(R-30 self-follow-up 제외) 순서로 합성한다. 근거 — 시간적
// 중복(동일 `unitId` 재등장)을 먼저 earliest 1 건으로 정리한 뒤 self-follow-up 휴리스틱
// (`unitId`+author 그룹)을 적용하면, 중복으로 인한 이중 카운트가 self-follow-up 검출에
// 섞이지 않는다. 두 함수 모두 입력 비변형·결정적이라 순서 선택의 결과를 spec 으로 박제
// 한다(역순도 동작하나 본 v1 은 dedup → self-follow-up 으로 고정).
//
// scoring 직렬/실패 격리 정책 박제(ADR-0032 §2): 단위별 `scoreUnit` 호출은 순차
// (for-await) 로 수행한다 — 결과 순서는 dedup 후 입력 순서를 그대로 보존하고, 한 단위
// scoring 이 reject 하면 `scoreUnit` 의 전파 정책(swallow 0)을 그대로 이어받아 본
// orchestrator 도 그 error 를 **전파(throw)** 한다. 부분 결과를 fallback 으로 위장하지
// 않는다(§2 실패 격리). 병렬(`Promise.all`)은 결과 순서 보존·실패 격리 의미가 복잡해져
// 미채택 — throughput 최적화는 batch slice 후속 책임.
//
// 빈 입력 / 전부 dedup 제거 경계: `activities` 가 빈 배열이면 빈 `EvaluationResult[]`
// 반환(scoreUnit 호출 0). dedup 으로 전 항목이 1 건으로 합쳐져도 결정적 결과.
//
// 책임 경계(ADR-0032 Follow-up — 후속 slice):
//   - controller / DTO / endpoint / R-9 사용자 지정 기간 — HTTP layer 는 후속 slice.
//     본 orchestrator 가 controller 의 호출 대상이 되나 controller 배선 자체는 별도.
//   - `EvaluationResult` 영속화 / Prisma migration / Assessment·Contribution row 매핑 —
//     §5 schema 게이트 deferred. 본 orchestrator 는 in-memory 반환만(DB write 0).
//   - 일/주/월 aggregate 평가 / batch prompting — 본 orchestrator 는 단위별(per-unit)
//     scoreUnit 의 목록 처리만. 집계·요약 평가는 상위 layer 후속 slice(§2 batch 경계).
import { Injectable } from "@nestjs/common";

import type { Activity } from "../assessment-collection/domain/activity";

import {
  dedupTemporalDuplicates,
  excludeSelfFollowUps,
} from "./domain/evaluation-dedup";
import { mapActivityToEvaluationInput } from "./domain/evaluation-input.mapper";
import type { EvaluationResult } from "./domain/evaluation-result";
import {
  EvaluationScoringService,
  type ScoringOptions,
} from "./evaluation-scoring.service";

@Injectable()
export class EvaluationOrchestratorService {
  // EvaluationScoringService 를 생성자 주입(NestJS class provider) — 같은 module 내
  // DI resolve(assessment-evaluation.module.ts). test 는 이 자리에 mock
  // { scoreUnit } 를 주입해 실 LLM 호출 0 / 실 네트워크 0 / live credential 0 으로
  // compose 정합만 검증한다.
  constructor(private readonly scoringService: EvaluationScoringService) {}

  /**
   * 수집된 `Activity` 목록을 받아 평가 결과 목록을 산출한다
   * (ADR-0032 §1/§4/§2 end-to-end compose).
   *
   * 흐름:
   *   1. `activities.map(mapActivityToEvaluationInput)` 로 정규화(§1).
   *   2. `dedupTemporalDuplicates` → `excludeSelfFollowUps` 순서로 평가-side dedup
   *      적용(§4, 위 파일 머리 주석의 순서 박제 근거 참조).
   *   3. 남은 각 단위마다 `scoringService.scoreUnit(input, options)` 를 순차 호출해
   *      `EvaluationResult[]` 를 입력 순서대로 수집 반환(§2).
   *
   * 정책:
   *   - 빈 `activities` → 빈 배열 반환(scoreUnit 호출 0).
   *   - scoring 순차 — 결과 순서 = dedup 후 입력 순서 보존(결정적).
   *   - 한 단위 scoring reject 시 그 error 를 전파(throw, swallow 0 — §2 실패 격리).
   *   - 매핑 / dedup / scoring 재구현 0 — 기존 import 호출만(compose + 순서 결정만).
   *   - 입력 배열 비변형(map / dedup 모두 새 배열 산출, 부수효과 0).
   *
   * @param activities 수집 산출물 `Activity` 목록(typed surface 만, raw 본문 0).
   * @param options scoring 옵션 — 각 `scoreUnit` 호출에 그대로 전달(`ScoringOptions`).
   * @returns dedup 후 단위 순서를 보존한 `EvaluationResult[]`.
   */
  async evaluateActivities(
    activities: Activity[],
    options: ScoringOptions,
  ): Promise<EvaluationResult[]> {
    // (1) 정규화 — Activity[] → EvaluationInput[](§1). 순수 함수, 입력 비변형.
    const inputs = activities.map(mapActivityToEvaluationInput);

    // (2) 평가-side dedup(§4) — 시간적 중복(R-21) 먼저, self-follow-up(R-30) 다음.
    //     두 함수 모두 새 배열을 산출하므로 inputs / activities 는 비변형.
    const deduped = excludeSelfFollowUps(dedupTemporalDuplicates(inputs));

    // (3) 단위별 scoring(§2) — 순차 호출로 결과 순서 = dedup 후 입력 순서 보존.
    //     한 단위 reject 는 await 가 전파(부분 결과 위장 0 — 실패 격리).
    const results: EvaluationResult[] = [];
    for (const input of deduped) {
      results.push(await this.scoringService.scoreUnit(input, options));
    }
    return results;
  }
}
