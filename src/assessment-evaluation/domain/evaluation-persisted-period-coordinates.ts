// evaluation-persisted-period-coordinates — 영속(persisted) 평가 레코드를 좌표로 투영
// 하는 순수 도메인 함수 (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄
// 평가"의 detection 사슬의 두 번째 입력 짝). 부수효과 0 / 외부 의존 0 / `@Injectable`
// 0 / Prisma 0 / LLM 호출 0 / repository 0 / 입력 객체·배열 비변형. `import` 는 도메인
// 내 `EvaluationPersistContext` 타입만(재사용, 새 좌표 타입 발명 0).
//
// 책임(REQ-037 detection 사슬의 두 번째 입력 — T-0538 의 대칭 짝):
//   `AssessmentRepository.findByPerson` 이 반환하는 영속 Assessment 레코드 배열을,
//   좌표 4-tuple(`personId / period / scope / periodStart`)만 추출한 좌표
//   (`EvaluationPersistContext`) 배열로 결정적으로 투영한다. 이 출력이 T-0536
//   `selectUnevaluatedPeriods` 의 `persisted` 입력으로 흘러가, T-0538 이 enumerate 한
//   `intended` 좌표와의 차집합으로 미평가(gap) 좌표 subset 이 derive 된다.
//
// 경계(task Out of Scope):
//   - 실제 DB read(`findByPerson` 를 Prisma 로 호출해 영속 레코드 배열 산출)는 본 함수
//     범위 밖 — 본 함수는 **이미 읽어온 레코드 배열**만 좌표로 투영한다. repository read
//     배선은 후속 wiring slice.
//   - orchestrator/service/controller 실배선·차집합·batch plan 합성은 본 함수 범위 밖.
//   - 좌표 정규화/dedup/차집합 매칭은 본 함수 책임 아님 — 본 함수는 **투영(projection)**
//     만 한다. instant 정규화·중복 제거·멤버십 판정은 전부 T-0536 차집합 helper 책임.
//
// 패턴 mirror: evaluation-dedup.ts / evaluation-unevaluated-period-select.ts /
// evaluation-intended-period-coordinates.ts (순수 함수 + 입력 등장 순서 보존 + 입력
// 비변형 + 명시적 null/undefined 한국어 메시지 `TypeError` + 한국어 JSDoc). T-0538 이
// `intended` 를 enumerate, 본 함수는 `persisted` 를 project — 둘 다 같은 좌표 타입
// `EvaluationPersistContext` 를 출력해 T-0536 차집합의 두 인자로 각각 흘러간다.

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";

// PersistedAssessmentRecord — 투영 입력 element wrapper(본 task 가 신설하는 유일한
// 타입). 출력 좌표 타입은 `EvaluationPersistContext` 재사용(새 좌표 타입 발명 0).
//
//   - 영속 Assessment 레코드의 **좌표 4-field 부분집합**만 명시한다(`personId / period /
//     scope / periodStart`). 실제 영속 레코드는 `difficulty / contributionScore / volume
//     / narrative / id` 등 추가 컬럼을 함께 보유하지만, 본 함수는 좌표 4-field 만 투영
//     하고 추가 컬럼은 구조적으로 무시한다(출력 누출 0).
//   - 추가 컬럼은 인터페이스에 포함하지 않되 index signature 로 허용해, `findByPerson`
//     레코드(추가 컬럼 보유)를 그대로 전달해도 구조적 타입 호환되도록 한다(호출자가
//     좌표 4-field 만 별도로 추려 넘길 필요 없음 — 추가 컬럼은 무시될 뿐 거부 0).
export interface PersistedAssessmentRecord {
  personId: string;
  period: string;
  scope: string;
  periodStart: Date;
  // 추가 컬럼(difficulty/contributionScore/volume/narrative/id 등)은 구조적으로 무시
  // 된다 — 좌표 4-field 만 투영. index signature 로 추가 컬럼 보유 레코드의 구조적
  // 호환만 열어두고, 본 함수는 4-field 외 어떤 키도 읽지 않는다(출력 누출 0).
  [extraColumn: string]: unknown;
}

// assertStringField — 좌표 string 축(personId/period/scope) 방어. string 이 아니면
// 한국어 메시지 `TypeError`로 조기 노출한다(silent skip 시 좌표 식별 축 오염으로
// 차집합 매칭이 누락·누출되어 일괄 평가 누락을 유발 — fail-fast 가 안전, R-112
// negative). 빈 문자열("")은 유효한 좌표 값으로 허용한다(정규화 안 함 — exact match,
// 차집합 키 정신과 정합).
function assertStringField(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(
      `영속 레코드의 ${field} 는 string 이어야 한다: ${String(value)}`,
    );
  }
}

// assertValidDate — 좌표 Date 축(periodStart) 방어. Date 가 아니거나 Invalid Date
// (getTime() === NaN)면 한국어 메시지 `TypeError`로 조기 노출한다(Invalid Date 좌표는
// 차집합 instant 정규화에서 비결정적 매칭을 유발 — fail-fast 가 안전, R-112 negative).
function assertValidDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `영속 레코드의 periodStart 는 유효한 Date 여야 한다: ${String(value)}`,
    );
  }
}

/**
 * 영속(persisted) 평가 레코드 배열을 좌표(`EvaluationPersistContext`) 배열로 결정적
 * 으로 투영한다(PLAN.md P5 bullet 106 / R-64 / REQ-037 detection 사슬의 두 번째 입력,
 * T-0538 `enumerateIntendedPeriodCoordinates` 의 대칭 짝).
 *
 * 입력 레코드 각각에서 좌표 4-field(`personId / period / scope / periodStart`)만
 * 추출해 좌표 1 개를 생성하고, **입력 등장 순서를 보존**한 새 배열로 반환한다. 이
 * 출력은 T-0536 `selectUnevaluatedPeriods` 의 `persisted` 입력으로 흘러가, T-0538 이
 * enumerate 한 `intended` 좌표와의 차집합으로 미평가 gap 을 derive 하는 데 쓰인다.
 *
 * 투영 규칙:
 *   - 각 레코드에서 좌표 4-field 만 읽어 `{ personId, period, scope, periodStart }`
 *     좌표 1 개를 생성한다. 추가 컬럼(`difficulty / contributionScore / volume /
 *     narrative / id` 등)이 입력 객체에 함께 있어도 출력 좌표에 누출되지 않는다(4-field
 *     만 명시적으로 복사 — 구조적 무시).
 *   - `periodStart` 는 입력 레코드의 Date instance 를 **그대로**(참조 그대로) 좌표
 *     element 로 쓴다(방어 복제 안 함 — 좌표는 읽기 전용 식별 축으로 소비되며, 본
 *     함수는 입력 레코드·배열을 mutate 하지 않는다). `personId / period / scope` 는
 *     string 참조 그대로(string immutable).
 *
 * 정책(결정성 + 비변형):
 *   - 빈 `records` → 빈 배열.
 *   - 입력 등장 순서 보존(stable) — 별도 정렬 0. 차집합 매칭은 키 기준이므로 순서에
 *     의존하지 않으나, 호출자 디버깅·결정성을 위해 입력 순서를 그대로 보존한다.
 *   - **dedup 안 함** — 같은 좌표(동일 4-tuple)가 입력에 중복 등장하면 출력도 중복
 *     그대로 반환한다. 추가 컬럼만 다르고 좌표 4-field 가 동일한 두 레코드도 동일 좌표
 *     2 건으로 투영된다(좌표 멤버십/중복 제거/차집합 판정은 전부 T-0536 책임 — 본
 *     함수는 투영만, 중복 책임 0).
 *   - **instant 정규화/병합 안 함** — 같은 instant 를 가리키는 서로 다른 Date 객체를
 *     보유한 두 레코드는 각각 독립 좌표로 투영된다(getTime() 정규화/병합은 T-0536
 *     차집합 키 책임). 본 함수는 Date 참조를 그대로 전달할 뿐 instant 비교/병합 0.
 *   - 정규화 안 함 — 빈 문자열 `personId / period / scope` 도 그대로 투영한다(exact
 *     match — T-0536/T-0538 정신 정합).
 *   - 입력 레코드·배열을 mutate 하지 않고 좌표 element 는 새 객체로 생성한 새 배열을
 *     반환한다(부수효과 0, 같은 입력 → 같은 출력, 시계 비의존).
 *
 * @param records 영속 Assessment 레코드 배열(좌표 4-field + 추가 컬럼 혼재 허용).
 *   변형하지 않는다.
 * @returns 입력 등장 순서를 보존한 좌표(`EvaluationPersistContext`) 새 배열.
 * @throws {TypeError} `records` 가 null/undefined·non-array 이거나, 원소가 null/undefined
 *   이거나, 원소의 `personId / period / scope` 가 non-string(누락 포함)이거나,
 *   `periodStart` 가 Date 가 아니거나 Invalid Date 일 때(evaluation-dedup.ts /
 *   T-0536 / T-0538 방어 패턴 mirror, fail-fast).
 */
export function projectPersistedPeriodCoordinates(
  records: PersistedAssessmentRecord[],
): EvaluationPersistContext[] {
  if (records === null || records === undefined) {
    throw new TypeError("records 배열이 null/undefined 일 수 없다.");
  }
  if (!Array.isArray(records)) {
    throw new TypeError(`records 는 배열이어야 한다: ${String(records)}`);
  }

  const coordinates: EvaluationPersistContext[] = [];

  // 입력 등장 순서대로 순회하며 각 레코드에서 좌표 4-field 만 추출해 투영한다(추가
  // 컬럼 누출 0). 빈 배열이면 루프 진입 0 → 빈 배열 반환.
  for (const record of records) {
    if (record === null || record === undefined) {
      throw new TypeError("records 원소가 null/undefined 일 수 없다.");
    }
    assertStringField(record.personId, "personId");
    assertStringField(record.period, "period");
    assertStringField(record.scope, "scope");
    assertValidDate(record.periodStart);

    // 좌표 4-field 만 명시적으로 복사한 새 좌표 객체 — 추가 컬럼은 읽지 않으므로 출력
    // 누출 0. periodStart 는 Date 참조 그대로(방어 복제 안 함 — 읽기 전용 식별 축).
    coordinates.push({
      personId: record.personId,
      period: record.period,
      scope: record.scope,
      periodStart: record.periodStart,
    });
  }

  return coordinates;
}
