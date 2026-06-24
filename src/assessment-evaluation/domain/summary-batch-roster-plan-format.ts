// summary-batch-roster-plan-format — R-61 요약 평가 batch roster 입력(pre-flight 평가
// 범위) 사람-친화 한 줄 요약 순수 formatter(PLAN.md P5 bullet 97 / REQ-061 "일/주/월
// 요약 평가"의 presentation 조각). outcome(결과) 측에는 formatSummaryBatchOutcome
// (T-0622)가 batch 가 **무엇을 평가했는지**를 한 줄로 렌더하나, input(입력) 측에는
// batch 가 **무엇을 평가할 것인지**(어느 roster · 어느 granularity · 몇 개 좌표가
// enumerate 됐는지)를 사람이 한 눈에 보는 pre-flight 요약이 빈칸이었다. 본 formatter 가
// 그 빈칸을 채운다 — roster 의 personIds/granularities/now 로부터 (재구현 0, 위임만)
// `enumerateSummaryDueCoordinates` 를 호출해 산출될 좌표를 derive 한 뒤, person 수 ·
// granularity 버킷별 좌표 수 · 총 좌표 수를 결정적 한국어 단일 라인으로 렌더한다.
// 이는 T-0622 formatSummaryBatchOutcome 이 outcome report 를 한 줄로 렌더한 것과
// 정확히 동형이다(입력측 mirror — outcome 은 결과 카운트, 본 formatter 는 pre-flight 범위).
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(roster·personIds·granularities·now 읽기만, resultsByCoordinate/mode/
// options 미접촉) / 동일 입력 → 동일 출력(referential transparency). 좌표 산출은
// `enumerateSummaryDueCoordinates` 위임(재구현 0) — 그 결정성·비변형 계약을 상속한다.
// 새 외부 dependency 0 / DB write·migration 0 / live LLM 호출 0 / raw 미저장(R-59 —
// 좌표 식별 축만 counting, 평가 본문 미접촉).
//
// 책임 경계(task Out of Scope):
//   - `summary-batch-roster-input.ts` / `summary-due-coordinates.ts` /
//     `summary-batch-outcome.ts` 변경 금지 — import(type · const · 함수)만, 값/순서/
//     로직 무변경. composer `buildSummaryBatchOrchestratorInput` 본문·계약 변경 0.
//   - resultsByCoordinate / mode / options 렌더 금지 — pre-flight 요약은 좌표 enumerate
//     범위(person · granularity · 좌표 수)만. 결과(평가/생성/skip)는 outcome formatter
//     (T-0622) 책임. orphan 검증은 T-0626/T-0627 가드 책임(본 formatter 는 검증 0 — 표현만).
//   - formatter 를 service/로그/journal 에 배선(호출)하는 것은 별도 wiring follow-up
//     (T-0622 → T-0623 가 outcome formatter 를 service 경계로 외화한 패턴 동형). 본 task
//     는 순수 함수까지.
//   - JSON 직렬화 / i18n / markdown 표 / 템플릿 엔진 금지 — 한국어 단일 라인 문자열 하나만.
//   - manual-trigger HTTP endpoint / controller / DTO / RBAC 추가 0(Q-0030 ADR-gated).
//
// 패턴 mirror: summary-batch-outcome-format.ts(순수 함수 / null·undefined 입력 fail-fast
// 한국어 TypeError / 결정적 한국어 단일 라인(개행 0) / granularity 버킷을 single-source
// GRANULARITY_BUCKETS 고정 순서로 순회(값 0 버킷도 슬롯 누락 없이 등장) / 한국어 JSDoc /
// 책임 경계 주석). 본 formatter 는 그 표현 관례·문구 톤을 mirror 하되 outcome report 가
// 아니라 roster 입력을 렌더한다(역할 분리).

import { GRANULARITY_BUCKETS } from "./summary-batch-outcome";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";
import { enumerateSummaryDueCoordinates } from "./summary-due-coordinates";

// ROSTER_PLAN_PREFIX — pre-flight plan 라인의 라벨 prefix(라벨 + 공백 1개). single
// source 로 export 해 형태 검증 가드(summary-batch-roster-plan-shape.ts, T-0635)가
// 동일 상수를 import 소비하도록 한다(라벨 drift 방지). 값·렌더 동작 무변경 — 아래
// 본문 template literal 이 본 상수를 소비할 뿐.
export const ROSTER_PLAN_PREFIX = "요약 평가 batch 예정: ";

/**
 * R-61 요약 평가 batch 의 roster 입력(pre-flight 평가 범위)을 **사람-친화 결정적 한국어
 * 단일 라인**으로 렌더링한다(PLAN.md P5 bullet 97 / REQ-061). batch 실행 **전에** "지금
 * 무엇이 돌아갈 것인가"(어느 roster · 어느 granularity · 몇 개 좌표)를 로그·journal·
 * 향후 notification surface 가 외화할 표현 조각이다. T-0622 formatSummaryBatchOutcome
 * 의 입력측 mirror.
 *
 * 출력 형태(예시 — 정확한 문구는 본 함수가 single source):
 *   `요약 평가 batch 예정: person 2명 · 총 6좌표 [day 2 · week 2 · month 2 · other 0]`
 *
 * 필드 ↔ 문구 매핑(single source — JSDoc):
 *   - `roster.personIds.length`        → `person N명`(roster 크기, 중복 de-dup 0).
 *   - 산출 좌표 수(`coordinates.length`) → `총 N좌표`(enumerate 위임 산출 총합).
 *   - 버킷별 좌표 수                     → 대괄호 `[...]` 안의 분포. `GRANULARITY_BUCKETS`
 *     (day → week → month → other) single source 순회로 **결정적 고정 순서** 렌더.
 *     값 0 버킷도 슬롯 누락 없이 등장(`other 0`). enumerate 는 day/week/month 만
 *     산출하므로 `other` 는 항상 0(슬롯 정합을 위해 outcome formatter 와 동일 등장).
 *
 * 결정성: 같은 roster(+ 같은 now) → 항상 byte-identical 출력(개행 0, 단일 라인). 버킷
 * 순회는 `GRANULARITY_BUCKETS` 고정 순서만 사용(`Object.keys` 순서 의존 0). 잔여 상태
 * 누수 0(순수 함수, 매 호출 독립).
 *
 * 비변형: `roster`·`personIds`·`granularities`·`now` 를 읽기만 한다(쓰기 0).
 * resultsByCoordinate/mode/options 는 미접촉(pre-flight 요약 대상 아님). 부수효과 0.
 *
 * @param roster T-0613 enumerate 가 소비할 roster 입력(`personIds`/`granularities`/`now`
 *   만 본 formatter 가 읽음 — 나머지 필드는 미접촉). 변형하지 않는다(읽기만).
 * @returns 결정적 한국어 단일 라인 요약 문자열(개행 0). 빈 roster(좌표 0)도 빈 문자열이
 *   아니라 `총 0좌표` 를 명시한다.
 * @throws {TypeError} `roster` 가 null/undefined 일 때(직접 가드, outcome formatter
 *   mirror), 또는 `enumerateSummaryDueCoordinates` 가 `personIds`/`granularities`
 *   null/undefined · `now` Invalid Date 로 던진 TypeError 전파(위임, swallow 0).
 * @throws {RangeError} `granularities` 에 알 수 없는 period 가 포함될 때 enumerate 위임
 *   helper 의 RangeError 전파.
 */
export function formatSummaryBatchRosterPlan(
  roster: SummaryBatchRosterInput,
): string {
  // roster 자체의 null/undefined 만 formatter 가 직접 가드한다(한국어 메시지 진단성).
  // 개별 필드 무결성(personIds/granularities/now)은 enumerate 가드에 위임한다(이중
  // 검증 발명 0 — outcome formatter 의 직접 가드 mirror).
  if (roster === null || roster === undefined) {
    throw new TypeError("roster 가 null/undefined 일 수 없다.");
  }

  // roster × granularity 좌표 enumerate — 위임만(재구현 0). personIds/granularities
  // null/undefined TypeError, 알 수 없는 granularity RangeError, Invalid Date now
  // TypeError 가 여기서 전파된다(fail-fast, swallow 0). enumerate 는 입력 비변형.
  const coordinates = enumerateSummaryDueCoordinates(
    roster.personIds,
    roster.granularities,
    roster.now,
  );

  // person 수 — roster.personIds.length(중복 de-dup 0, enumerate 계약 정합).
  const personCount = roster.personIds.length;

  // 버킷 분포 — GRANULARITY_BUCKETS single source 고정 순서 순회(결정적). 값 0 버킷도
  // 슬롯 누락 없이 등장(`other 0`). enumerate 산출 좌표의 `period` 로 counting.
  const buckets = GRANULARITY_BUCKETS.map((bucket) => {
    const count = coordinates.filter(
      (coordinate) => coordinate.period === bucket,
    ).length;
    return `${bucket} ${count}`;
  }).join(" · ");

  return `${ROSTER_PLAN_PREFIX}person ${personCount}명 · 총 ${coordinates.length}좌표 [${buckets}]`;
}
