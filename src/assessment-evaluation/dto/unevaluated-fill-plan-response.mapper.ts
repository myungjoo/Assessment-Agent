// unevaluated-fill-plan-response.mapper — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분
// 일괄 평가" / REQ-038) 미평가 fill 계획 detection 사슬의 응답-side 순수 변환 함수.
// planner 출력 `UnevaluatedFillBatchPlan`(periodStart Date 축) → HTTP 직렬화 가능 plain
// shape `UnevaluatedFillPlanResponse`(periodStart ISO string 축)으로 변환한다. T-0545 의
// request-side mapper(`toIntendedPeriodCoordinatesInput`)의 대칭 짝 — request 가
// parseKstPeriodInput(string→Date)였다면 response 는 formatKstIso(Date→string)다.
//
// Date→string 직렬화만 single-source helper(`formatKstIso`) 경유(raw `.toISOString()` 금지
// — offset-명시 ISO contract `+09:00`, round-trip 시 원 instant 보존). 재정렬/필터/dedup/
// controller 실배선은 본 mapper 밖. 순수 함수 — `@Injectable` 0, NestJS/Prisma/LLM import 0,
// 부수효과 0, 입력 비변형(batches/periods 는 새 배열로 map). 새 외부 dependency 0.

import { formatKstIso } from "../../common/period-boundary";
import type { UnevaluatedFillBatchPlan } from "../domain/evaluation-unevaluated-fill-batch-plan";

/**
 * 한 person 의 미평가 좌표 묶음을 HTTP 응답으로 직렬화한 shape(period 단위).
 *
 * 도메인 `EvaluationPersistContext` 의 4 축 중 periodStart 만 Date→string 으로 변환되고,
 * 나머지 3 축(personId / period / scope)은 그대로 전사된다.
 */
export interface UnevaluatedFillPeriodResponse {
  personId: string;
  period: string;
  scope: string;
  // formatKstIso 산출 offset-명시 ISO-8601 string(예 "2026-06-10T15:00:00+09:00").
  periodStart: string;
}

/**
 * 한 person 의 미평가 좌표 묶음을 직렬화한 batch 응답 shape.
 */
export interface UnevaluatedFillBatchResponse {
  personId: string;
  periods: UnevaluatedFillPeriodResponse[];
}

/**
 * 미평가 fill batch plan 을 HTTP 응답으로 직렬화한 plain shape.
 *
 * 도메인 `UnevaluatedFillBatchPlan` 과 동형이되, 각 period 의 periodStart 만 Date 대신
 * ISO-8601 string 이다. totalGapCount / personCount 는 그대로 전사된다.
 */
export interface UnevaluatedFillPlanResponse {
  batches: UnevaluatedFillBatchResponse[];
  totalGapCount: number;
  personCount: number;
}

/**
 * 미평가 fill batch plan(periodStart Date 축) → HTTP 응답 shape(periodStart ISO string 축)
 * 순수 변환(P5 bullet 106 / R-64 / REQ-037 detection 사슬의 도메인→HTTP bridge).
 *
 * 변환 규칙:
 *   - totalGapCount / personCount : 그대로 전사(passthrough).
 *   - batches : 새 배열로 map(입력 plan.batches 비변형). person 묶음 순서 보존(재정렬 0).
 *   - 각 batch 의 personId : 그대로 전사. periods : 새 배열로 map(입력 비변형). 좌표 순서 보존.
 *   - 각 period 의 personId / period / scope : 그대로 전사. periodStart 만 `formatKstIso`
 *                 single-source helper 경유로 Date → offset-명시 ISO string 변환(raw
 *                 `.toISOString()` 금지). round-trip(parseKstPeriodInput) 시 원 instant 보존.
 *
 * periodStart 가 Invalid Date / 비-Date 면 `formatKstIso` 의 `TypeError` 가 **자연 전파**
 * 된다 — mapper 가 재던지지 않아 single-source error 메시지를 보존한다. 정상 경로에서
 * planner 출력은 유효 Date 만 담으므로 본 helper error 는 방어 그물(opaque 직렬화 차단).
 *
 * @param plan 미평가 fill batch plan. 변형하지 않는다(batches/periods 는 새 배열로 map).
 * @returns `UnevaluatedFillPlanResponse` — periodStart 가 ISO string 으로 직렬화된 응답 shape.
 * @throws {TypeError} `plan` 이 null/undefined 이거나, 한 period 의 periodStart 가
 *   Invalid Date / 비-Date 일 때(후자는 `formatKstIso` 자연 전파).
 */
export function toUnevaluatedFillPlanResponse(
  plan: UnevaluatedFillBatchPlan,
): UnevaluatedFillPlanResponse {
  // plan 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent 진행
  // 시 속성 접근에서 opaque TypeError 가 나므로, 명시적 메시지로 조기 노출).
  if (plan === null || plan === undefined) {
    throw new TypeError(
      "toUnevaluatedFillPlanResponse: plan 이 null/undefined 일 수 없다.",
    );
  }

  return {
    // batches 는 새 배열로 map — 입력 plan.batches 비변형. person 묶음 순서 그대로 보존.
    batches: plan.batches.map((batch) => ({
      personId: batch.personId,
      // periods 도 새 배열로 map — 입력 batch.periods 비변형. 좌표 순서 그대로 보존.
      periods: batch.periods.map((period) => ({
        // personId / period / scope 3 축은 그대로 전사.
        personId: period.personId,
        period: period.period,
        scope: period.scope,
        // periodStart 만 single-source helper 경유로 Date → offset-명시 ISO string 변환.
        periodStart: formatKstIso(period.periodStart),
      })),
    })),
    // totalGapCount / personCount 는 그대로 전사(passthrough).
    totalGapCount: plan.totalGapCount,
    personCount: plan.personCount,
  };
}
