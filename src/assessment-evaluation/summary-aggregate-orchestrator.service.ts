// SummaryAggregateOrchestratorService — P5 aggregate(요약) 평가 layer 의 상위 compose
// slice (T-0310, ADR-0035 §Follow-ups orchestrator 조각). Summary 평가 backbone 의
// 시점 게이트 `isPeriodEvaluable` (T-0306, domain/period-evaluable.ts) + write service
// `SummaryPersistService.persistSummary` (T-0309, narrative+metricScore 결합
// reset-and-recreate) 가 전부 머지됐으나, 한 `(personId, period, periodStart)` 좌표 +
// 그 좌표의 단위 평가 묶음(`EvaluationResult[]`)을 받아 "시점 게이트 → 영속화" 를 한
// 흐름으로 묶는 상위 layer 가 0 이었다. 본 service 가 그 빈자리를 채우는 thin
// orchestrator 다 — `EvaluationOrchestratorService` (T-0292) 가 단위 평가 chain 을
// compose 한 패턴을 정확히 mirror 한다 (새 알고리즘 0, compose + 게이트 순서만).
//
// 흐름(ADR-0035 §Decision 1/3/4 compose):
//   1. `isPeriodEvaluable(context.period, context.periodStart, now)` 시점 게이트(§Decision
//      3) — 평가 대상 구간 `[periodStart, periodEnd)` 가 완전히 종료된 후(`now ≥ periodEnd`)
//      에만 평가를 허용한다. 진행 중(now < periodEnd) 구간은 미평가로 skip 한다.
//   2. 평가 가능 시 `summaryPersistService.persistSummary(context, results, mode, options)`
//      위임(§Decision 1/4) — metricScore(deterministic) + narrative(LLM) 결합
//      reset-and-recreate write. 그 결과 `SummaryPersistResult` 를 `evaluated: true` 와
//      함께 반환한다.
//   3. 평가 불가 시 `persistSummary` 를 **호출하지 않고**(write 0) `evaluated: false` 만
//      반환한다(skip 신호 — caller 가 "아직 평가 시점이 아님" 을 구분 가능).
//
// 실패 격리/전파 정책 박제(ADR-0032 §2 mirror): `persistSummary` 가 reject(예:
// reset-and-recreate 경합 P2002 → ConflictException)하면 본 orchestrator 는 그 error 를
// **전파(throw)** 한다 — swallow 0, 부분 성공을 fallback 으로 위장하지 않는다. 마찬가지로
// 알 수 없는 period(`VALID_PERIODS` 밖)는 `isPeriodEvaluable` 내부의 `computePeriodEnd`
// 가 throw 하며, 그 error 가 전파되고 `persistSummary` 는 호출되지 않는다(게이트 우선).
//
// 빈 묶음 경계: `results` 가 빈 배열이어도 게이트가 평가 가능을 반환하면 persist 위임이
// 그대로 일어난다 — 빈 묶음 자체는 본 orchestrator 가 reject 하지 않는다(`persistSummary`
// / `aggregateMetricScore` 가 빈 입력을 결정적으로 처리, ADR-0035 §Decision 1).
//
// 책임 경계(ADR-0035 §Follow-ups / task Out of Scope — 후속 slice):
//   - controller / HTTP endpoint / DTO 추가 — manual trigger batch 평가 endpoint 배선은
//     별도 후속 slice(새 RBAC 결정 = Q-0030 ADR-gated). 본 slice 는 service layer
//     compose 까지만(본 orchestrator 가 controller 의 호출 대상이 되나 controller 배선은 별도).
//   - period→collection→evaluate bridge — `personId`/`period` → collection →
//     `Activity[]` → 단위 평가 → `EvaluationResult[]` 도출 경로는 cross-module/RBAC ADR
//     영역. 본 orchestrator 는 caller 가 in-memory `EvaluationResult[]` 를 이미 넘긴다고 전제.
//   - 영속 `Contribution[]` DB read source / scheduler 자동 trigger(@nestjs/schedule cron,
//     P7 새 dep) / live LLM 실 호출 — 전부 본 slice 밖. `now` 를 주입받아 게이트만 한다.
import { Injectable } from "@nestjs/common";

import type { EvaluationResult } from "./domain/evaluation-result";
import { isPeriodEvaluable } from "./domain/period-evaluable";
import type { SummaryBatchContext } from "./domain/summary-batch-prompt";
// 영속화 모드 enum — EvaluationResultPersistService 의 것을 그대로 import 재사용
// (새 enum 발명 0, `"fill"` no-op / `"reeval"` reset-and-recreate 의미 정합).
import type { PersistMode } from "./evaluation-result-persist.service";
import {
  SummaryPersistService,
  type SummaryPersistOptions,
  type SummaryPersistResult,
} from "./summary-persist.service";

// SummaryAggregateResult — orchestrator 반환 surface. "평가 가능 여부"(`evaluated`)와
// 영속화 결과(`result`)를 한 타입으로 구분 가능하게 둔다 — caller 가 "아직 평가 시점이
// 아님"(evaluated=false, result 부재)과 "평가·영속화 완료"(evaluated=true, result 존재)를
// 명확히 구별한다(skip 신호 vs persist 결과).
export interface SummaryAggregateResult {
  // 시점 게이트가 평가 가능을 반환해 persist 위임이 일어났는지. false 면 진행 중 구간
  // 으로 skip 했다는 뜻(write 0, result 부재).
  evaluated: boolean;
  // 평가·영속화가 일어난 경우의 `SummaryPersistResult`(summaryId / created).
  // evaluated=false(skip) 면 undefined.
  result?: SummaryPersistResult;
}

@Injectable()
export class SummaryAggregateOrchestratorService {
  // SummaryPersistService 를 생성자 주입(NestJS class provider) — 같은 module 내
  // DI resolve(assessment-evaluation.module.ts). test 는 이 자리에 mock
  // { persistSummary } 를 주입해 실 LLM 호출 0 / 실 DB write 0 / live credential 0 으로
  // compose 정합만 검증한다(EvaluationOrchestratorService mock 주입 패턴 mirror).
  constructor(private readonly summaryPersistService: SummaryPersistService) {}

  /**
   * 한 `(personId, period, periodStart)` 좌표 + 그 좌표의 단위 평가 묶음을 받아
   * 시점 게이트 → 영속화를 한 흐름으로 compose 한다(ADR-0035 §Decision 1/3/4).
   *
   * 흐름:
   *   1. `isPeriodEvaluable(context.period, context.periodStart, now)` 시점 게이트(§3).
   *      평가 대상 구간이 완전히 종료(`now ≥ periodEnd`)된 후에만 true.
   *   2. true → `summaryPersistService.persistSummary(context, results, mode, options)`
   *      위임(§1/4) → 그 결과를 `{ evaluated: true, result }` 로 반환.
   *   3. false(진행 중 구간) → persist 호출 0, `{ evaluated: false }` 반환(skip 신호).
   *
   * 정책:
   *   - 빈 `results` → 게이트가 평가 가능을 반환하면 persist 위임 그대로(빈 묶음 reject 0).
   *   - `persistSummary` reject 시 그 error 를 전파(throw, swallow 0 — 실패 격리).
   *   - 알 수 없는 period(`VALID_PERIODS` 밖) → `isPeriodEvaluable` 내부 throw 전파,
   *     persist 미호출(게이트 우선).
   *   - Invalid Date `context.periodStart`(parse 불가 instant) → 게이트가 경유하는
   *     boundary helper(`getKstPeriodRangeByPeriod`)의 TypeError 전파, persist 미호출
   *     (T-0357 Follow-up — KST boundary 정규화 계약 박제, T-0358 동기).
   *   - 게이트 함수 / persist service 재구현 0 — 기존 import 호출만(compose + 순서 결정만).
   *
   * @param context  요약 좌표(personId / period / periodStart).
   * @param results  caller 가 넘기는 in-memory 단위 평가 묶음(§Decision 1).
   * @param mode     영속화 모드(`"fill"` no-op / `"reeval"` reset-and-recreate) — 그대로 전달.
   * @param options  narrative 생성 옵션(modelId) — `persistSummary` 에 그대로 전달.
   * @param now      판정 기준 현재 시각(주입 — 테스트 가능성·결정성, §Decision 3).
   * @returns 평가 가능 시 `{ evaluated: true, result }`, 진행 중 시 `{ evaluated: false }`.
   */
  async evaluateAndPersist(
    context: SummaryBatchContext,
    results: EvaluationResult[],
    mode: PersistMode,
    options: SummaryPersistOptions,
    now: Date,
  ): Promise<SummaryAggregateResult> {
    // (1) 시점 게이트(§Decision 3) — 알 수 없는 period 면 여기서 throw 전파(게이트 우선,
    //     persist 미호출). 진행 중 구간이면 false 로 아래 skip 분기로 빠진다.
    if (!isPeriodEvaluable(context.period, context.periodStart, now)) {
      // 진행 중 구간(now < periodEnd) → write 0, skip 신호만 반환.
      return { evaluated: false };
    }

    // (2) 평가 가능 → persist 위임(§Decision 1/4). reject 는 그대로 전파(swallow 0).
    const result = await this.summaryPersistService.persistSummary(
      context,
      results,
      mode,
      options,
    );
    return { evaluated: true, result };
  }
}
