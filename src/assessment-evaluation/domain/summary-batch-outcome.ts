// summary-batch-outcome — R-61 요약 평가 batch outcome 집계 순수 composer
// (PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 post-실행 조각).
// T-0613(`enumerateSummaryDueCoordinates`) → T-0614(`buildSummaryBatchPlan`,
// PR #528 squash 2926747) 로 좌표 enumerate → plan 조립까지의 pre-실행 layer 가
// 닫혔으나, caller(batch orchestrator)가 plan 을 순회하며 `evaluateAndPersist` 를
// 좌표별로 호출한 **뒤** 받는 결과들(`SummaryAggregateResult[]`)을 "몇 좌표가
// 평가됐고 / 시점 미도래로 skip 됐고 / 새로 생성됐고 / 이미 존재했는지" 한
// 결정적 리포트로 집계하는 post-실행 조각이 비어 있다. 본 composer 가 그 빈칸을
// 채운다(T-0614 Follow-up #1 "결과 집계" 半부).
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 배열·원소 비변형 / 동일 입력 → 동일 출력(referential transparency). raw 미저장
// (R-59) — 평가 결과 본문 미접촉, 집계는 식별 축(period)·boolean flag(evaluated/created)
// 만 소비, summaryId 는 카운트 목적 미보유(개수만). 새 외부 dependency 0, DB write·
// migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - orchestrator/service/controller 실배선(plan 을 순회하며 async `evaluateAndPersist`
//     를 좌표별 호출하고 본 집계로 묶는 batch orchestrator)은 별도 follow-up slice
//     (`@Injectable` + DI + async, service-경계). 본 composer 는 결과 집계 순수 함수까지.
//   - 좌표 → `EvaluationResult[]` 도출(collection bridge)은 cross-module/RBAC ADR
//     영역. 본 composer 는 caller 가 plan(=results 부착 완료)과 outcome 을 이미 안다고
//     전제(T-0614 와 동형).
//   - roster / granularity source 도출은 T-0613 책임. 본 composer 는 plan entry 의
//     `context.period` 를 분류 축으로 소비만.
//   - manual-trigger HTTP endpoint / DTO / RBAC 는 Q-0030 ADR-gated.
//
// 패턴 mirror: summary-batch-plan.ts / summary-due-coordinates.ts /
// evaluation-unevaluated-period-select.ts(순수 함수 / 입력 등장 순서 보존 / 입력 비변형 /
// null·undefined 입력 fail-fast 한국어 TypeError / 결정적 출력 / 한국어 JSDoc). 분포
// 슬롯 single-source 결정적 고정 순서 패턴은 realdata-e2e-result-summary.ts(T-0580)
// 동형(파일 disjoint, import 0 — 패턴 참조만).

import type { SummaryAggregateResult } from "../summary-aggregate-orchestrator.service";

import type { SummaryBatchPlanEntry } from "./summary-batch-plan";

// GRANULARITY_BUCKETS — byGranularity 분포의 결정적 고정 순서 슬롯. plan entry 의
// `context.period` 가 `"day"/"week"/"month"` 중 하나면 해당 버킷에, 그 외 값은 `other`
// 버킷에 집계된다. 미등장 슬롯도 키 존재(값 0)를 보장 — 표현 layer 가 슬롯 누락 없이
// 전 분포를 렌더링할 수 있다(realdata-e2e-result-summary 의 single-source 슬롯 관례
// 동형). 슬롯 순서는 day → week → month → other 로 결정적 고정.
export const GRANULARITY_BUCKETS = ["day", "week", "month", "other"] as const;
type GranularityBucket = (typeof GRANULARITY_BUCKETS)[number];

// SummaryBatchOutcomeCounts — 한 버킷(혹은 전역) 카운트 묶음. evaluated/skipped 의
// 합은 total 과 일치, created+existing 은 evaluated 와 일치(skip 은 result 부재라
// created/existing 어느 쪽에도 미집계).
export interface SummaryBatchOutcomeCounts {
  // 본 버킷에 분류된 plan entry 총 개수(= evaluated + skipped).
  total: number;
  // outcome.evaluated === true 인 개수(평가·영속화 완료, result 존재).
  evaluated: number;
  // outcome.evaluated === false 인 개수(시점 미도래 skip, write 0 / result 부재).
  skipped: number;
  // outcome.evaluated && outcome.result?.created === true 인 개수(새 summary 생성).
  created: number;
  // outcome.evaluated && outcome.result?.created === false 인 개수
  // (기존 read-through, first-write-wins, ADR-0037).
  existing: number;
}

/**
 * SummaryBatchOutcomeReport — R-61 요약 평가 batch outcome 결정적 집계 리포트
 * (PLAN.md P5 bullet 97 / REQ-061).
 *
 * 필드 의미(single source — JSDoc):
 *   - `total` = plan 길이(= outcomes 길이, 정합 전제).
 *   - `evaluated` = outcome.evaluated === true 인 개수(시점 게이트 통과 + persist 완료).
 *   - `skipped` = outcome.evaluated === false 인 개수(시점 미도래 skip).
 *   - `created` = outcome.evaluated && outcome.result?.created === true 인 개수
 *     (새 summary row write).
 *   - `existing` = outcome.evaluated && outcome.result?.created === false 인 개수
 *     (기존 row read-through, first-write-wins).
 *   - `byGranularity` = `{ day, week, month, other }` 각 granularity 별
 *     `SummaryBatchOutcomeCounts` 결정적 고정 순서 분포. plan entry 의 `context.period`
 *     문자열로 분류(`"day"/"week"/"month"` 외 값은 `other` 버킷). 미등장 슬롯도
 *     키 존재(값 0)를 보장. 전 버킷의 합은 전역 합계와 일치(분포 보존 invariant).
 */
export interface SummaryBatchOutcomeReport extends SummaryBatchOutcomeCounts {
  // granularity(day/week/month/other) 별 분포. 결정적 고정 순서 + 미등장 슬롯 0 보장.
  byGranularity: Record<GranularityBucket, SummaryBatchOutcomeCounts>;
}

// zeroCounts — 카운트 묶음을 0 으로 초기화한 새 객체. 호출마다 새 객체 — 공유 mutable
// 노출 0.
function zeroCounts(): SummaryBatchOutcomeCounts {
  return { total: 0, evaluated: 0, skipped: 0, created: 0, existing: 0 };
}

// zeroByGranularity — byGranularity 분포를 결정적 고정 순서로 0 초기화한 새 객체.
// GRANULARITY_BUCKETS 를 single source 로 순회하므로 슬롯 누락/오타 0
// (realdata-e2e-result-summary 의 single-source 슬롯 관례 mirror).
function zeroByGranularity(): Record<
  GranularityBucket,
  SummaryBatchOutcomeCounts
> {
  const byGranularity = {} as Record<
    GranularityBucket,
    SummaryBatchOutcomeCounts
  >;
  for (const bucket of GRANULARITY_BUCKETS) {
    byGranularity[bucket] = zeroCounts();
  }
  return byGranularity;
}

// classifyGranularity — plan entry 의 `context.period` 문자열을 버킷 키로 분류.
// `"day"/"week"/"month"` 외 값은 `other` 버킷으로 흘려보낸다(빈 문자열 / `"year"` 등
// 미지원 granularity 가 silent 누락되지 않도록 — 카운트 보존 invariant).
function classifyGranularity(period: string): GranularityBucket {
  if (period === "day" || period === "week" || period === "month") {
    return period;
  }
  return "other";
}

/**
 * R-61 요약 평가 batch outcome 집계 — plan × outcomes 를 **index 1:1 zip** 으로
 * 순회하며 결정적 batch outcome 리포트를 반환한다(PLAN.md P5 bullet 97 / REQ-061).
 *
 * 흐름:
 *   1. plan 과 outcomes 의 길이 정합을 fail-fast 로 검증(silent 누락·오매칭 차단).
 *   2. 같은 index 의 plan entry ↔ outcome 을 zip 순회하며 분기마다 전역 + 버킷
 *      카운트를 누적한다. plan entry 의 `context.period` 로 버킷을 분류(`day/week/
 *      month/other`).
 *   3. 분기 cover:
 *      - outcome.evaluated === true && outcome.result?.created === true → evaluated++,
 *        created++.
 *      - outcome.evaluated === true && outcome.result?.created === false → evaluated++,
 *        existing++.
 *      - outcome.evaluated === true && outcome.result 가 undefined(방어적 — 명세상
 *        evaluated 면 result 존재여야 하나 surface 가 optional) → evaluated++,
 *        created/existing 어느 쪽에도 미집계(분류 불가 — created flag 부재).
 *      - outcome.evaluated === false → skipped++ (result 미참조).
 *
 * 정책:
 *   - `plan` 이 빈 배열이면 빈 리포트 반환(모든 카운트 0 + byGranularity 전 버킷 0,
 *     throw 0).
 *   - 입력 배열·원소·outcome.result 모두 변형하지 않고 새 리포트 객체를 반환한다
 *     (부수효과 0). byGranularity 도 새 객체 + 새 하위 카운트 객체.
 *   - 분포 보존 invariant: 전 버킷 카운트의 합은 전역 카운트와 일치한다
 *     (모든 entry 가 정확히 한 버킷에 분류).
 *
 * raw 미저장(R-59) 정합: outcome.result.summaryId 문자열을 리포트에 담지 않는다
 * (카운트 목적만). 평가 결과 본문(narrative)은 본 composer 의 입력 surface 에
 * 애초에 등장하지 않는다.
 *
 * @param plan T-0614 `buildSummaryBatchPlan` 산출의 plan 배열. 변형하지 않는다.
 *   빈 배열이면 throw 0 으로 빈 리포트 반환. null/undefined 시 한국어 `TypeError`.
 * @param outcomes plan 과 index 1:1 정합한 `evaluateAndPersist` 결과 배열. 변형하지
 *   않는다. 길이가 plan 과 다르면 한국어 `TypeError`. null/undefined 시 한국어 `TypeError`.
 * @returns 결정적 batch outcome 리포트(전역 카운트 + granularity 버킷별 분포).
 *   매 호출마다 새 리포트 객체 + 새 byGranularity 객체 + 새 하위 카운트 객체.
 * @throws {TypeError} `plan` 또는 `outcomes` 가 null/undefined 이거나 두 배열의
 *   길이가 다를 때(plan ↔ outcomes index zip 의 silent 누락·오매칭 차단).
 */
export function summarizeSummaryBatchOutcome(
  plan: SummaryBatchPlanEntry[],
  outcomes: SummaryAggregateResult[],
): SummaryBatchOutcomeReport {
  if (plan === null || plan === undefined) {
    throw new TypeError("plan 배열이 null/undefined 일 수 없다.");
  }
  if (outcomes === null || outcomes === undefined) {
    throw new TypeError("outcomes 배열이 null/undefined 일 수 없다.");
  }
  if (plan.length !== outcomes.length) {
    throw new TypeError(
      `plan 과 outcomes 의 길이가 다르다(index 1:1 zip 정합 위반): plan.length=${plan.length}, outcomes.length=${outcomes.length}`,
    );
  }

  const report: SummaryBatchOutcomeReport = {
    ...zeroCounts(),
    byGranularity: zeroByGranularity(),
  };

  // plan 등장 순서를 결정적으로 보존하며 같은 index 의 outcome 과 zip 순회.
  for (let i = 0; i < plan.length; i += 1) {
    const entry = plan[i];
    const outcome = outcomes[i];
    const bucket = classifyGranularity(entry.context.period);
    const bucketCounts = report.byGranularity[bucket];

    // total 은 전역 + 버킷 모두 1 씩 누적(분포 보존 invariant 의 기준).
    report.total += 1;
    bucketCounts.total += 1;

    if (outcome.evaluated) {
      // 평가·영속화 완료 — created/existing 분기.
      report.evaluated += 1;
      bucketCounts.evaluated += 1;
      // result 가 undefined 인 경우(명세상 evaluated 면 존재여야 하나 surface optional)
      // 는 방어적으로 created/existing 어느 쪽에도 미집계(분류 불가, created flag 부재).
      if (outcome.result !== undefined) {
        if (outcome.result.created) {
          report.created += 1;
          bucketCounts.created += 1;
        } else {
          report.existing += 1;
          bucketCounts.existing += 1;
        }
      }
    } else {
      // 시점 미도래 skip — result 미참조(undefined 이거나 부재).
      report.skipped += 1;
      bucketCounts.skipped += 1;
    }
  }

  return report;
}
