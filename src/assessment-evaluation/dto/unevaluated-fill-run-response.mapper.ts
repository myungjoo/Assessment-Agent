// unevaluated-fill-run-response.mapper — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분
// 일괄 평가" / REQ-038) plan→execute 사슬의 **출력-side 2 번째 순수 조각**. T-0552 의
// 도메인 요약 `UnevaluatedFillRunResult`(batch-run 집계 shape) → controller-facing 안정
// HTTP 응답 shape `UnevaluatedFillRunResponse` 로 직렬화하는 dependency-free 순수 함수.
// 입력-side 의 T-0546(`toUnevaluatedFillPlanResponse` — 계획을 응답 shape 으로 직렬화)의
// **출력-side 대칭 짝**이다: 계획 단계에 `UnevaluatedFillBatchPlan` → `UnevaluatedFillPlanResponse`
// 직렬화가 있었듯, 실행 단계에는 `UnevaluatedFillRunResult` → `UnevaluatedFillRunResponse` 직렬화가 있다.
//
// run-result 의 periodStart 는 이미 ISO string(T-0552 `UnevaluatedFillRunOutcome` 가
// `PeriodBridgeDto` 와 동형의 string 축 보유)이라 plan-side 와 달리 Date→ISO 변환(formatKstIso)
// 이 불요하다 — 본 mapper 는 변환 없는 passthrough map 이다. mapper 의 가치는 도메인 타입과
// 분리된 **안정 응답 contract** 를 두어 (i) controller 가 도메인 객체를 그대로 새는 것을 막고,
// (ii) 노출 필드를 의도적으로 통제하며, (iii) 후속 impure controller route 가 채워 반환할
// 출력 형을 미리 닫는 데 있다.
//
// 경계(task Out of Scope):
//   - 집계 로직(status 별 count / totalEvaluatedRecords 산출) 재구현 0 — T-0552
//     `aggregateUnevaluatedFillRunResult` 의 책임. 본 mapper 는 이미 집계된 값을 passthrough 전사만.
//   - orchestrator 실배선 / controller 실행 route(POST .../unevaluated-fill-run) / LLM
//     네트워크 호출 / 영속 0 — impure wiring 책임(live-LLM standing 게이트 ADR-0045 에 묶여 deferred).
//   - `EvaluationResult` 타입 직접 import / 평가문 본문·narrative 보유 0(REQ-032 raw-not-stored 정합).
//   - class-validator 런타임 validate 호출 0 — controller-scope ValidationPipe 책임. plain 객체만 다룬다.
//
// 패턴 mirror: unevaluated-fill-plan-response.mapper.ts(null/undefined·non-array fail-fast
// 한국어 `TypeError`(인덱스 포함) + 비변형 새-배열 map + @Injectable 0 + NestJS/Prisma/LLM
// import 0). 순수성: 부수효과 0, 입력 비변형, 새 외부 dependency 0 — `unevaluated-fill-run-result.ts`
// 의 타입만 import.

import type {
  UnevaluatedFillRunResult,
  UnevaluatedFillRunStatus,
} from "./unevaluated-fill-run-result";

/**
 * per-좌표 일괄 평가 실행 outcome 의 controller-facing 응답 shape.
 *
 * 도메인 `UnevaluatedFillRunOutcome` 의 노출 필드를 명시적으로 통제한 plain JSON shape이다.
 * 좌표 4 축(personId / period / scope / periodStart:string)은 호출자가 어느 좌표의 결과인지
 * 식별할 수 있게 그대로 echo 하고, status 타입은 도메인 `UnevaluatedFillRunStatus` 를 import
 * 재사용해 동기한다(임의 status 문자열 누출 차단). evaluatedCount / reason 은 도메인과 동일하게
 * 선택 필드 — 설정 시 echo, 미설정 시 undefined 유지(임의로 0 / 빈 문자열로 채우지 않는다).
 */
export interface UnevaluatedFillRunOutcomeResponse {
  personId: string;
  period: string;
  scope: string;
  // PeriodBridgeDto.periodStart 와 동형의 string 축(이미 ISO string — 추가 직렬화 0).
  periodStart: string;
  // 실행 결과 결정적 status. 도메인 union 을 import 재사용해 타입 동기.
  status: UnevaluatedFillRunStatus;
  // evaluated 시 생성된 평가 건수(선택). 미설정은 응답에서도 undefined 유지.
  evaluatedCount?: number;
  // skipped / failed 사유 메모(선택). 미설정은 응답에서도 undefined 유지.
  reason?: string;
}

/**
 * 미평가 fill batch-run 의 controller-facing 응답 shape.
 *
 * 도메인 `UnevaluatedFillRunResult` 와 동형이되, outcomes 가 응답 outcome 배열인 plain
 * JSON shape이다. 집계 필드(totalCount / status 별 count / totalEvaluatedRecords)는 도메인
 * 값을 그대로 전사한다(재계산/검산 0). 입력-side 의 `UnevaluatedFillPlanResponse` 의 출력-side
 * 대칭 짝.
 */
export interface UnevaluatedFillRunResponse {
  // 입력 순서를 그대로 보존한 per-좌표 응답 outcome 리스트(재정렬/dedup/필터 0).
  outcomes: UnevaluatedFillRunOutcomeResponse[];
  // 전체 outcome 수(== outcomes.length).
  totalCount: number;
  // status 별 좌표 수.
  evaluatedCount: number;
  skippedCount: number;
  failedCount: number;
  // evaluated outcome 들의 evaluatedCount 합(도메인 집계 그대로 전사).
  totalEvaluatedRecords: number;
}

/**
 * 미평가 fill batch-run 도메인 요약(`UnevaluatedFillRunResult`) → controller-facing HTTP 응답
 * shape(`UnevaluatedFillRunResponse`) 순수 변환(P5 bullet 106 / R-64 / REQ-037 detection→consume
 * 사슬의 출력-side 조각). T-0546 `toUnevaluatedFillPlanResponse` 의 실행-단계 대칭.
 *
 * 변환 규칙:
 *   - 집계 필드(totalCount / evaluatedCount / skippedCount / failedCount / totalEvaluatedRecords)
 *     : 그대로 전사(passthrough). 재계산/검산 0 — 이미 T-0552 집계가 산출한 값이다.
 *   - outcomes : 새 배열로 map(입력 result.outcomes 비변형). outcome 순서 보존(재정렬/dedup/필터 0).
 *   - 각 outcome 의 4 축(personId / period / scope / periodStart)·status·evaluatedCount·reason
 *     : 그대로 복사. periodStart 는 이미 string 이라 추가 직렬화 0. 선택 필드(evaluatedCount /
 *     reason)는 설정 시 echo, 미설정(undefined)은 undefined 유지(임의로 0 / 빈 문자열로 채우지 않는다).
 *
 * 방어(fail-fast 한국어 TypeError):
 *   - result 가 null/undefined → `TypeError`. (non-object 인 string/number 등은 outcomes
 *     접근 전 non-array 방어가 흡수 — 아래 outcomes 방어로 일관 처리.)
 *   - result.outcomes 가 null/undefined·non-array → `TypeError`.
 *   - outcomes 배열 원소가 null/undefined → `TypeError`(인덱스 포함).
 *
 * @param result 미평가 fill batch-run 도메인 요약. 변형하지 않는다(outcomes 는 새 배열로 map).
 *   null/undefined·outcomes non-array·원소 null/undefined 시 한국어 `TypeError`.
 * @returns `UnevaluatedFillRunResponse` — 새 객체. outcomes 는 입력 순서를 보존한 새 배열.
 * @throws {TypeError} 위 방어 조건 위반 시(원소 방어는 메시지에 인덱스 포함).
 */
export function toUnevaluatedFillRunResponse(
  result: UnevaluatedFillRunResult,
): UnevaluatedFillRunResponse {
  // result 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent 진행
  // 시 outcomes 접근에서 opaque TypeError 가 나므로, 명시적 메시지로 조기 노출).
  if (result === null || result === undefined) {
    throw new TypeError(
      "toUnevaluatedFillRunResponse: result 가 null/undefined 일 수 없다.",
    );
  }

  // outcomes 방어 — null/undefined·non-array 면 한국어 메시지 TypeError. result 가 non-object
  // (string/number 등)인 경우도 result.outcomes 가 undefined → non-array 라 이 방어가 일관 흡수한다.
  if (!Array.isArray(result.outcomes)) {
    throw new TypeError(
      `toUnevaluatedFillRunResponse: result.outcomes 는 배열이어야 한다: ${String(result.outcomes)}`,
    );
  }

  return {
    // outcomes 는 새 배열로 map — 입력 result.outcomes 비변형. outcome 순서 그대로 보존.
    outcomes: result.outcomes.map((outcome, index) => {
      // 원소 방어 — null/undefined 면 한국어 메시지 TypeError(인덱스 포함)로 조기 노출
      // (silent 진행 시 속성 접근에서 opaque TypeError 가 나므로 인덱스 포함 메시지로 노출).
      if (outcome === null || outcome === undefined) {
        throw new TypeError(
          `toUnevaluatedFillRunResponse: outcomes[${index}] outcome 원소가 null/undefined 일 수 없다.`,
        );
      }

      return {
        // 4 축은 그대로 전사. periodStart 는 이미 string — 추가 직렬화 0.
        personId: outcome.personId,
        period: outcome.period,
        scope: outcome.scope,
        periodStart: outcome.periodStart,
        // status 그대로 전사(도메인 union 동기).
        status: outcome.status,
        // 선택 필드 — 설정 시 echo, 미설정(undefined)은 undefined 유지.
        evaluatedCount: outcome.evaluatedCount,
        reason: outcome.reason,
      };
    }),
    // 집계 필드는 도메인 값 그대로 전사(passthrough) — 재계산/검산 0.
    totalCount: result.totalCount,
    evaluatedCount: result.evaluatedCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
    totalEvaluatedRecords: result.totalEvaluatedRecords,
  };
}
