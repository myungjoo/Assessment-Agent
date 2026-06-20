// evaluation-unevaluated-fill-plan — 미평가 fill 계획 순수 compose helper
// (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가 + Reset & Reeval"의
// detection 사슬을 닫는 조립 조각). 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma
// 0 / LLM 호출 0 / repository 0 / 입력 객체·배열 비변형. `import` 는 도메인 내 4 조각
// 함수와 그 타입만(재구현 0, 새 좌표/plan 타입 발명 0 — 입력 wrapper 1 종만 신설).
//
// 책임(REQ-037 detection 사슬의 순수-도메인 완결):
//   이미 박제된 4 개 순수 조각을 1 deterministic detection 단계로 잇는다 —
//     (1) enumerateIntendedPeriodCoordinates  → intended 좌표 enumerate
//     (2) projectPersistedPeriodCoordinates   → persisted 좌표 project
//     (3) selectUnevaluatedPeriods            → (intended \ persisted) gap 좌표 derive
//     (4) buildUnevaluatedFillBatchPlan       → gap 좌표를 person 별 batch plan 으로 요약
//   "의도 좌표 입력 + 이미 읽어온 영속 레코드 배열 → 미평가 fill batch plan" 을 순수
//   함수 1 개로 닫는다. compose-only — 중간 가공/필터/정렬 추가 0 으로 각 조각의
//   결정성·순서 정책을 그대로 보존한다.
//
// 경계(task Out of Scope):
//   - 실제 DB read(`AssessmentRepository.findByPerson` 를 Prisma 로 호출해 `persisted`
//     입력 배열 산출, `intended` 의 person/range 결정)는 본 함수 범위 밖 — 본 함수는
//     **이미 결정된 input wrapper** 만 받아 4 조각을 잇는다. repository read 배선은 후속
//     impure wiring slice(user module 경계·REQ-038 query 표면 결정 동반).
//   - orchestrator/service/controller 실배선·평가 가능 시점 필터(`isPeriodEvaluable`)
//     적용은 본 함수 범위 밖 — 호출자 책임(분리된 책임, T-0538 Out of Scope 정합).
//   - 좌표 정규화/dedup/차집합 키 합성은 전부 호출되는 조각(T-0536) 책임 — 본 helper 는
//     조립만(중복 책임 0).
//
// 패턴 mirror: evaluation-dedup.ts / evaluation-unevaluated-period-select.ts /
// evaluation-intended-period-coordinates.ts / evaluation-persisted-period-coordinates.ts
// (순수 함수 + 입력 비변형 + 명시적 null/undefined 한국어 메시지 `TypeError` +
// 한국어 JSDoc). 본 helper 는 wrapper level 에서만 1 차 fail-fast 하고, 각 조각의 내부
// 방어(원소 타입 / Date / period 등)는 그대로 자연 전파한다(single-source 방어 —
// 재던지지 않는다).

import { enumerateIntendedPeriodCoordinates } from "./evaluation-intended-period-coordinates";
import type { IntendedPeriodCoordinatesInput } from "./evaluation-intended-period-coordinates";
import { projectPersistedPeriodCoordinates } from "./evaluation-persisted-period-coordinates";
import type { PersistedAssessmentRecord } from "./evaluation-persisted-period-coordinates";
import { buildUnevaluatedFillBatchPlan } from "./evaluation-unevaluated-fill-batch-plan";
import type { UnevaluatedFillBatchPlan } from "./evaluation-unevaluated-fill-batch-plan";
import { selectUnevaluatedPeriods } from "./evaluation-unevaluated-period-select";

// UnevaluatedFillPlanInput — compose 입력 wrapper(본 task 가 신설하는 유일한 타입).
// 두 field 의 타입은 각 조각 파일에서 `import type` 재사용한다(발명 0). 출력 plan 타입
// `UnevaluatedFillBatchPlan` 도 batch-plan 조각에서 재사용(새 plan 타입 발명 0).
//
//   - intended  : 의도(intended) 좌표 enumeration 입력. enumerate 조각의 wrapper 를 그대로
//                 받아 `[rangeStart, rangeEnd)` 반열림 구간을 KST period anchor × person
//                 데카르트 곱 좌표로 펼친다(평가하려는 좌표 집합의 정의).
//   - persisted : 이미 읽어온(이번 detection 입력으로 결정된) 영속 Assessment 레코드 배열.
//                 좌표 4-field 로 투영돼 intended 와의 차집합 base 가 된다(이미 평가된
//                 좌표 집합). 본 helper 는 이 배열을 읽기만 하고 DB read 는 하지 않는다.
export interface UnevaluatedFillPlanInput {
  intended: IntendedPeriodCoordinatesInput;
  persisted: PersistedAssessmentRecord[];
}

/**
 * 미평가 fill 계획을 결정적으로 compose 한다(PLAN.md P5 bullet 106 / R-64 / REQ-037
 * detection 사슬의 순수-도메인 완결 조각).
 *
 * 4 개 순수 조각을 다음 순서로 그대로 흘려보내며 잇는다(compose-only — 중간 가공/필터/
 * 정렬 추가 0, 각 조각의 결정성·순서 정책을 그대로 보존):
 *   (1) `enumerateIntendedPeriodCoordinates(input.intended)` → intended 좌표
 *   (2) `projectPersistedPeriodCoordinates(input.persisted)` → persisted 좌표
 *   (3) `selectUnevaluatedPeriods(intended, persisted)`      → gap 좌표(차집합)
 *   (4) `buildUnevaluatedFillBatchPlan(gaps)`                → 최종 batch plan
 *
 * 방어(wrapper level 1 차 fail-fast):
 *   - `input` 이 null/undefined → 한국어 메시지 `TypeError`.
 *   - `input.intended` / `input.persisted` 가 누락(undefined)이면 한국어 메시지
 *     `TypeError` 로 조기 노출한다(각 조각 내부 방어에 위임하기 전 wrapper 1 차 차단).
 *   - 각 조각의 내부 방어(personIds 원소 non-string / period 미지원 / periodStart
 *     Invalid Date / persisted 원소 무결성 등)는 그대로 자연 전파한다(재던지지 않음 —
 *     single-source 방어, 조각의 `TypeError`/`RangeError` 가 compose 를 통해 그대로 노출).
 *
 * 정책(결정성 + 비변형):
 *   - `input` 객체 및 `intended` / `persisted` 내부 배열·원소를 mutate 하지 않는다
 *     (각 조각이 이미 입력 비변형 — 본 helper 도 새 상태를 만들지 않고 결과만 전달).
 *   - 같은 입력이면 같은 출력(시계 비의존 — 각 조각이 이미 시계 비의존).
 *   - 본 helper 자체는 새 plan 타입/좌표를 발명하지 않고 4 조각 결과만 흘려보낸다.
 *
 * @param input compose 입력 wrapper(의도 좌표 enumeration 입력 + 이미 읽어온 영속 레코드
 *   배열). 변형하지 않는다.
 * @returns 미평가 gap 좌표를 person 별로 요약한 `UnevaluatedFillBatchPlan`(batch-plan
 *   조각의 출력 그대로).
 * @throws {TypeError} `input` 이 null/undefined, 또는 `input.intended` / `input.persisted`
 *   가 누락일 때(wrapper 1 차 방어). 그 외 각 조각의 내부 방어 `TypeError`/`RangeError`
 *   가 자연 전파된다(원소 타입 / Date / 미지원 period 등).
 */
export function composeUnevaluatedFillPlan(
  input: UnevaluatedFillPlanInput,
): UnevaluatedFillBatchPlan {
  if (input === null || input === undefined) {
    throw new TypeError("input 이 null/undefined 일 수 없다.");
  }
  if (input.intended === null || input.intended === undefined) {
    throw new TypeError("input.intended 가 null/undefined 일 수 없다.");
  }
  if (input.persisted === null || input.persisted === undefined) {
    throw new TypeError("input.persisted 가 null/undefined 일 수 없다.");
  }

  // (1) intended 좌표 enumerate — 조각 내부 방어(personIds/period/scope/Date)는 자연 전파.
  const intended = enumerateIntendedPeriodCoordinates(input.intended);
  // (2) persisted 좌표 project — 조각 내부 방어(원소 무결성/Date)는 자연 전파.
  const persisted = projectPersistedPeriodCoordinates(input.persisted);
  // (3) gap 좌표 derive — (intended \ persisted) 차집합(좌표 4-tuple 키 기준).
  const gaps = selectUnevaluatedPeriods(intended, persisted);
  // (4) gap 좌표를 person 별 batch plan 으로 요약 — 최종 반환.
  return buildUnevaluatedFillBatchPlan(gaps);
}
