// evaluation-overwrite-reeval-plan — overwrite/재평가 요청의 mode-gated reset-and-
// recreate plan 을 계산하는 순수 도메인 함수 (ADR-0053 §Decision 1/2/3/4, slice 1).
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 시계 비의존 / 입력 비변형. `import` 는 도메인 내 `EvaluationPersistContext` 타입만
// (재사용, 새 좌표 타입 발명 0). 상세 semantics 는 아래 computeOverwriteReevalPlan JSDoc.
//
// 책임: target 좌표 집합 + persisted 좌표 집합 + 명시 mode 를 입력받아 "어느 좌표를
//   delete→create(reset)/신규 create/보존(first-write-wins)하는지" 를 결정론적 plan 으로
//   계산한다(write 안 함 — write-layer `persist(..., "reeval")`, ADR-0033 §D3 를 언제
//   태울지의 plan 만 순수 계산). Out of Scope(slice 1b/2/3): DB write / orchestrator·
//   controller 배선 / DTO 표면 / modelId 재해석.
//
// 패턴 mirror: evaluation-persisted-period-coordinates.ts (순수 함수 + 입력 등장 순서
// 보존 + 입력 비변형 + 명시적 null/undefined 한국어 메시지 `TypeError` + 한국어 JSDoc).

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";

// REEVAL_MODES — reset-and-recreate 경로를 gate 하는 명시 mode 집합(ADR-0053 §Decision
// 1/4). 정확히 이 집합의 값(대소문자 exact match)만 overwrite 를 유발한다. 그 외 모든
// 값(mode 부재·빈 문자열·"fill"·정의 외 임의 문자열)은 fail-closed 로 default(first-
// write-wins) 경로다. 배열 상수로 두어 spec 에서 참조 가능하게 export.
export const REEVAL_MODES = ["reeval", "overwrite"] as const;

// OverwriteReevalPlan — computeOverwriteReevalPlan 의 출력. 세 좌표 집합으로 target/
// persisted/mode 를 결정론적으로 분해한다(ADR-0053 §Decision 1). 세 배열은 서로소이며
// 좌표 기준 dedup 되어 있다(같은 좌표 최대 1 회 등장, §Decision 2).
export interface OverwriteReevalPlan {
  // toReset — 명시 mode(reeval/overwrite)이고 persisted 에 이미 존재하는 target 좌표.
  // write-layer 가 delete→create 할 대상(ADR-0033 §D3). 무플래그/unknown mode 에서는
  // 항상 빈 배열(overwrite 미발생, fail-safe).
  toReset: EvaluationPersistContext[];
  // toCreate — persisted 에 없는 target 좌표. mode 무관하게 신규 create 대상.
  toCreate: EvaluationPersistContext[];
  // preserved — (a) 무플래그/unknown mode 에서 이미 존재하는 target 좌표(first-write-
  // wins read-through), 또는 (b) target 이 아니지만 persisted 에 존재하는 좌표(partial-
  // reset 시 보존되는 다른 좌표, §Decision 3). "wiping others" 미발생 증거.
  preserved: EvaluationPersistContext[];
}

// assertStringField — 좌표 string 축(personId/period/scope) 방어. string 아니면 한국어
// 메시지 `TypeError`로 조기 노출(식별 축 오염 시 reset/create 대상 오분류 → 우발적
// 데이터 파괴·평가 누락, fail-fast). 빈 문자열("")은 유효 값으로 허용(정규화 안 함 —
// exact match). mirror: evaluation-persisted-period-coordinates.ts.
function assertStringField(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(
      `좌표의 ${field} 는 string 이어야 한다: ${String(value)}`,
    );
  }
}

// assertValidDate — 좌표 Date 축(periodStart) 방어. Date 아님/Invalid Date 는 instant
// exact match 를 비결정적으로 만들므로 fail-fast(R-112 negative).
function assertValidDate(value: unknown): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `좌표의 periodStart 는 유효한 Date 여야 한다: ${String(value)}`,
    );
  }
}

// assertCoordinate — 좌표 1 개의 4-field 를 전부 방어한다(null/undefined 원소 포함).
// 식별 축 오염은 존재/부재 판정을 비결정적으로 만들어 reset/create/preserve 오분류를
// 유발하므로 fail-fast(mirror: evaluation-persisted-period-coordinates.ts).
function assertCoordinate(
  coord: unknown,
  origin: string,
): asserts coord is EvaluationPersistContext {
  if (coord === null || coord === undefined) {
    throw new TypeError(`${origin} 원소가 null/undefined 일 수 없다.`);
  }
  const c = coord as Record<string, unknown>;
  assertStringField(c.personId, "personId");
  assertStringField(c.period, "period");
  assertStringField(c.scope, "scope");
  assertValidDate(c.periodStart);
}

// assertCoordinateArray — 좌표 배열 인자(targets/persisted) 컨테이너 방어. null/
// undefined·non-array 면 `TypeError`. 빈 배열은 유효(empty → 빈/부분 plan).
function assertCoordinateArray(
  value: unknown,
  name: string,
): asserts value is EvaluationPersistContext[] {
  if (value === null || value === undefined) {
    throw new TypeError(`${name} 배열이 null/undefined 일 수 없다.`);
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} 는 배열이어야 한다: ${String(value)}`);
  }
}

// coordinateKey — 좌표 4-tuple 을 결정론적 문자열 key 로 직렬화한다(존재/부재 멤버십·
// dedup 판정용). periodStart 는 instant(getTime())로 비교 — 같은 순간의 서로 다른 Date
// 객체는 동일 좌표, instant 가 다르면 다른 좌표(instant exact match, §Decision 2).
// string 축은 Unit Separator(\u001f) escape 로 join 해 경계 모호성("a|b" vs "a"+"|b")을
// 차단한다(값에 등장 확률 0 인 제어문자, 리터럴 대신 escape 라 git binary 오분류 0).
function coordinateKey(coord: EvaluationPersistContext): string {
  const SEP = "\u001f";
  return [
    coord.personId,
    coord.period,
    coord.scope,
    String(coord.periodStart.getTime()),
  ].join(SEP);
}

// cloneCoordinate — 좌표 4-field 만 복사한 새 좌표 객체(출력 누출 0, 입력 비변형).
// periodStart 는 Date 참조 그대로(방어 복제 안 함 — 읽기 전용 식별 축). 반환 plan 을
// 호출자가 mutate 해도 입력 좌표는 불변.
function cloneCoordinate(
  coord: EvaluationPersistContext,
): EvaluationPersistContext {
  return {
    personId: coord.personId,
    period: coord.period,
    scope: coord.scope,
    periodStart: coord.periodStart,
  };
}

/**
 * overwrite/재평가 요청의 mode-gated reset-and-recreate plan 을 결정론적으로 계산한다
 * (ADR-0053 §Decision 1/2/3/4, slice 1). 실제 write 는 하지 않고 "어느 좌표를 delete→
 * create(reset)하고, 어느 좌표를 신규 create 하며, 어느 좌표를 보존하는지" 의 plan 만
 * 순수 계산한다.
 *
 * 좌표 비교 key 는 4-tuple(`personId / period / scope / periodStart` instant)의 exact
 * match — periodStart 는 instant(getTime())로 비교해 같은 순간의 다른 Date 객체는 동일
 * 좌표, instant 가 다르면(periodStart 만 다른 두 좌표) 서로 다른 좌표로 취급한다.
 *
 * 분류 규칙:
 *   - **명시 mode**(`REEVAL_MODES` = "reeval"/"overwrite", 대소문자 exact):
 *     · target 이 persisted 에 존재 → `toReset`(delete→create).
 *     · target 이 persisted 에 부재 → `toCreate`.
 *     · target 이 아닌 persisted 좌표 → `preserved`(partial-reset 시 다른 좌표 보존,
 *       §Decision 3 — "wiping others" 미발생, `toReset ⊆ (targets ∩ persisted)`).
 *   - **무플래그 default / unknown mode**(mode 부재·빈 문자열·"fill"·정의 외 임의 값):
 *     first-write-wins(§Decision 4 fail-closed). `toReset` 은 항상 빈 배열(overwrite
 *     미발생, 회귀 0).
 *     · target 이 persisted 에 존재 → `preserved`(read-through).
 *     · target 이 persisted 에 부재 → `toCreate`.
 *     · target 이 아닌 persisted 좌표 → `preserved`.
 *
 * dedup 정책(§Decision 2 idempotency, plan 레벨 박제): 세 집합은 좌표 key 기준 dedup 되어
 * 각 좌표가 최대 1 회 등장하고(targets 중복 등장해도 row 1 수렴) 서로소다(한 좌표는 한
 * 집합에만). 결정성·순서: 세 집합은 첫 등장 순서를 보존한다(toReset/toCreate 는 targets
 * 순서, target 유래 없는 preserved 는 persisted 순서로 append). 같은 입력 → 같은 plan.
 *
 * @param mode 요청 mode. `undefined`/빈 문자열/"fill" → default(first-write-wins),
 *   "reeval"/"overwrite"(대소문자 exact) → reset-and-recreate, 그 외 임의 값 →
 *   fail-closed default. 입력 문자열은 정규화하지 않는다(exact match — 우발적 overwrite 차단).
 * @param targets 재평가/영속화 대상 좌표 배열. 변형하지 않는다.
 * @param persisted 이미 영속화된 좌표 배열(projectPersistedPeriodCoordinates 출력 등).
 *   변형하지 않는다.
 * @returns 서로소·dedup 된 `{ toReset, toCreate, preserved }` plan(각 좌표는 새 객체).
 * @throws {TypeError} `targets`/`persisted` 가 null/undefined·non-array 이거나, 원소가
 *   null/undefined 이거나, 원소의 `personId / period / scope` 가 non-string(누락 포함)
 *   이거나, `periodStart` 가 Date 가 아니거나 Invalid Date 일 때(fail-fast).
 */
export function computeOverwriteReevalPlan(
  mode: string | undefined,
  targets: EvaluationPersistContext[],
  persisted: EvaluationPersistContext[],
): OverwriteReevalPlan {
  assertCoordinateArray(targets, "targets");
  assertCoordinateArray(persisted, "persisted");
  for (const t of targets) {
    assertCoordinate(t, "targets");
  }
  for (const p of persisted) {
    assertCoordinate(p, "persisted");
  }

  // 명시 mode 게이트 — 정의된 REEVAL_MODES 의 exact match 만 reset 경로. 그 외(부재/
  // 빈 문자열/"fill"/정의 외 값)는 전부 fail-closed default(first-write-wins).
  const isReeval =
    typeof mode === "string" &&
    (REEVAL_MODES as readonly string[]).includes(mode);

  // persisted 좌표 key 집합 — target 존재/부재 판정용(멤버십 O(1)).
  const persistedKeys = new Set<string>();
  for (const p of persisted) {
    persistedKeys.add(coordinateKey(p));
  }

  const toReset: EvaluationPersistContext[] = [];
  const toCreate: EvaluationPersistContext[] = [];
  const preserved: EvaluationPersistContext[] = [];

  // 이미 분류된 좌표 key — dedup(§Decision 2) + 서로소 보장용.
  const classifiedKeys = new Set<string>();
  // target 으로 소비된 좌표 key — persisted 순회 시 "target 아닌 좌표"만 preserve 하기 위함.
  const targetKeys = new Set<string>();

  // (1) targets 순회 — 등장 순서 보존. 좌표별로 존재/부재 × mode 로 분기한다.
  for (const t of targets) {
    const key = coordinateKey(t);
    targetKeys.add(key);
    if (classifiedKeys.has(key)) {
      // 이미 분류된 target 좌표(중복 등장) → dedup, 재분류 안 함(row 1 수렴).
      continue;
    }
    classifiedKeys.add(key);

    const exists = persistedKeys.has(key);
    if (exists && isReeval) {
      // 명시 mode + 존재 → reset-and-recreate 대상(delete→create).
      toReset.push(cloneCoordinate(t));
    } else if (exists) {
      // 무플래그/unknown mode + 존재 → first-write-wins read-through(overwrite 미발생).
      preserved.push(cloneCoordinate(t));
    } else {
      // 부재 → mode 무관 신규 create.
      toCreate.push(cloneCoordinate(t));
    }
  }

  // (2) persisted 순회 — target 이 아닌 persisted 좌표를 `preserved` 로 유지한다
  // (partial-reset 시 다른 좌표 보존, §Decision 3 "wiping others" 미발생). 이미 target
  // 유래로 분류된 좌표는 건너뛴다(서로소·dedup).
  for (const p of persisted) {
    const key = coordinateKey(p);
    if (targetKeys.has(key) || classifiedKeys.has(key)) {
      continue;
    }
    classifiedKeys.add(key);
    preserved.push(cloneCoordinate(p));
  }

  return { toReset, toCreate, preserved };
}
