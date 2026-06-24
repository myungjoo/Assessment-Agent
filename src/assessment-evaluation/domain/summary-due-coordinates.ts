// summary-due-coordinates — R-61 요약 평가 대상 좌표 enumeration 순수 도메인 함수
// (PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 detection 조각).
// roster(personIds) × 평가 granularity 집합을 받아, 각 (person, granularity) 마다
// **`now` 시점에 방금 종료된 직전 period 의 periodStart** 를 산출해
// `{ personId, period, periodStart }[]` 좌표를 결정적으로 derive 한다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 배열·원소 비변형 / 동일 입력 → 동일 출력(referential transparency). raw 미저장
// (R-59) — 평가 결과 본문 미접촉, 좌표 식별 축(personId/period/periodStart)만 산출.
//
// 책임 경계(ADR-0035 §Decision 3 / task Out of Scope):
//   evaluation-unevaluated-period-select.ts(R-64 gap 선별)가 명시적으로 deferred 한
//   "intended 좌표 *생성*(기간 enumeration)" 의 빈자리를 채운다. 본 함수는 좌표를
//   *식별*까지만 — orchestrator/service/controller 실배선, roster source 도출(DB read),
//   좌표→`EvaluationResult[]` collection bridge 는 본 함수 범위 밖(별도 slice).
//   산출 3-tuple 은 downstream `SummaryAggregateOrchestratorService.evaluateAndPersist`
//   의 `SummaryBatchContext`(summary-batch-prompt.ts) 와 형태 정합 — 변환 0 으로 thread.
//
// 패턴 mirror: evaluation-unevaluated-period-select.ts(순수 함수 / 입력 등장 순서
// 보존 / 입력 비변형 / null·undefined 입력 fail-fast 한국어 TypeError / 결정적 출력
// 순서 / 한국어 JSDoc). boundary 산술은 본 파일이 재구현하지 않고
// `src/common/period-boundary.ts` helper 위임만(ADR-0039 §Decision 5 — 중복 금지).
// 시점 게이트(`isPeriodEvaluable`)·boundary 계약은 period-evaluable.ts single source 를
// 그대로 따른다(import + 호출만, 변경 0).

import { getKstPeriodRangeByPeriod } from "../../common/period-boundary";

import type { PeriodGranularity } from "./period-evaluable";

// SummaryDueCoordinate — 요약 평가 대상 좌표 1개. summary-batch-prompt.ts 의
// `SummaryBatchContext`(personId, period, periodStart 3-tuple)와 형태 정합이라 변환 0
// 으로 downstream `evaluateAndPersist` 의 `context` 인자로 thread 가능하다.
export interface SummaryDueCoordinate {
  personId: string;
  // period 는 domain granularity 라벨(`day`/`week`/`month`) — period-boundary helper 가
  // 내부에서 `daily`/`weekly`/`monthly` 로 매핑(PERIOD_TO_GRANULARITY single source).
  period: PeriodGranularity;
  // periodStart 는 직전(방금 종료된) period 의 KST 시작 시각(UTC instant 보존).
  periodStart: Date;
}

// previousPeriodStart — `now` 가 속한 period 의 **직전(방금 종료된) period** 의
// periodStart 를 boundary helper 위임으로 산출한다. 산출식:
//   1) getKstPeriodRangeByPeriod(period, now).start = now 가 속한 현재 period 의 시작.
//   2) 그 시작 직전의 instant(start - 1ms)는 반드시 직전 period 에 속한다(반열림
//      `[start, end)` 경계 — start 는 현재 period 의 포함 경계이므로 start-1ms 는
//      직전 period 의 마지막 instant).
//   3) 그 instant 가 속한 period 의 start = 직전 period 의 periodStart.
// 이렇게 산출한 직전 period 는 `now ≥ 직전periodEnd`(= 현재 period 의 start ≤ now)
// 이므로 `isPeriodEvaluable(period, periodStart, now)` 가 항상 true 임이 보장된다.
// 알 수 없는 period / Invalid Date(now) 는 helper 의 RangeError/TypeError 가 전파된다
// (silent-skip 0 — 게이트 우선, NaN 비결정성 차단).
function previousPeriodStart(period: string, now: Date): Date {
  const currentStart = getKstPeriodRangeByPeriod(period, now).start;
  // start 직전 instant(1ms 전)는 직전 period 의 마지막 순간 — 그 period 의 start 를 산출.
  const justBeforeCurrent = new Date(currentStart.getTime() - 1);
  return getKstPeriodRangeByPeriod(period, justBeforeCurrent).start;
}

/**
 * R-61 요약 평가 대상 좌표를 roster × granularity 로 enumerate 한다
 * (PLAN.md P5 bullet 97 / REQ-061, ADR-0035 §Decision 3 시점 게이트 정합).
 *
 * 각 `(personId, granularity)` 쌍마다 **`now` 시점에 방금 종료된 직전 period 의
 * periodStart** 를 KST boundary helper 로 산출해 `{ personId, period, periodStart }`
 * 좌표를 만든다(R-61 시점 규칙):
 *   - day   → 직전 KST 일(자정 종료된 어제).
 *   - week  → 직전 KST 주(이번 주 월요일 자정 이후이면 지난 주).
 *   - month → 직전 KST 월(다음 달 1일 자정 이후이면 지난 달).
 * 진행 중 period(아직 종료 안 됨)는 포함하지 않는다 — 산출된 모든 좌표는
 * `isPeriodEvaluable(period, periodStart, now)` 가 true 임을 만족한다(직전 period 는
 * `now ≥ periodEnd`). boundary 산술은 전부 period-boundary.ts helper 위임(재구현 0).
 *
 * 출력 순서(결정성): `personIds` 외부 루프 × `granularities` 내부 루프 등장 순서를
 * 그대로 보존한다 — roster 순서·granularity 순서가 산출 좌표 순서에 결정적으로 반영
 * (비결정성 0). 동일 입력은 항상 동일 출력.
 *
 * de-dup 정책: `personIds` 내 중복 personId 는 **dedup 하지 않는다** — 중복은 등장한
 * 횟수만큼 좌표도 중복 산출한다(period-select 가 intended 중복을 보존하는 것과 동형 —
 * de-dup 책임은 본 composer 밖, 필요 시 상류가 별도 처리). `granularities` 내 중복도
 * 동일하게 보존한다. 본 결정을 단일 출처로 박제하고 그 결정대로 검증한다.
 *
 * @param personIds 평가 대상 roster(in-memory string[] — Person source 도출은 본 함수
 *   범위 밖, caller 가 주입). 변형하지 않는다. 빈 배열이면 throw 0 으로 빈 좌표 반환.
 *   null/undefined 시 한국어 메시지 `TypeError`(period-select 방어 패턴 mirror).
 * @param granularities 평가 granularity 집합(`day`/`week`/`month`, VALID_PERIODS subset).
 *   변형하지 않는다. 빈 배열이면 throw 0 으로 빈 좌표 반환. null/undefined 시 `TypeError`.
 *   알 수 없는 granularity 문자열은 boundary helper 의 RangeError 가 전파된다.
 * @param now 좌표 산출 기준 현재 시각(주입 — 결정성·테스트 가능성, 시스템 시계 미사용).
 *   Invalid Date 면 helper 의 TypeError 가 전파된다(NaN 비결정성 차단).
 * @returns roster × granularity 등장 순서 보존으로 담은 직전-종료 period 좌표 새 배열.
 * @throws {TypeError} `personIds`/`granularities` 가 null/undefined 이거나 `now` 가
 *   Invalid Date 일 때. {RangeError} `granularities` 에 알 수 없는 period 가 포함될 때.
 */
export function enumerateSummaryDueCoordinates(
  personIds: string[],
  granularities: PeriodGranularity[],
  now: Date,
): SummaryDueCoordinate[] {
  if (personIds === null || personIds === undefined) {
    throw new TypeError("personIds 배열이 null/undefined 일 수 없다.");
  }
  if (granularities === null || granularities === undefined) {
    throw new TypeError("granularities 배열이 null/undefined 일 수 없다.");
  }

  const coordinates: SummaryDueCoordinate[] = [];
  // roster 외부 루프 × granularity 내부 루프 — 등장 순서를 결정적으로 보존한다.
  for (const personId of personIds) {
    for (const period of granularities) {
      // 직전(방금 종료된) period 의 periodStart 산출 — 알 수 없는 period / Invalid
      // Date 는 여기서 helper throw 가 전파된다(빈 배열·정상 입력만 좌표를 만든다).
      const periodStart = previousPeriodStart(period, now);
      coordinates.push({ personId, period, periodStart });
    }
  }
  return coordinates;
}
