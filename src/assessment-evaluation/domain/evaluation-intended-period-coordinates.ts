// evaluation-intended-period-coordinates — 의도(intended) 좌표 enumeration 순수 도메인
// 함수 (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가"의 detection
// 사슬 상류 짝). 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 /
// repository 0 / 입력 객체·배열 비변형. `import` 는 도메인 내 `EvaluationPersistContext`
// 타입 + boundary single-source helper 만(새 좌표 타입 발명 0).
//
// 책임(REQ-037 detection 사슬의 첫 입력):
//   `(personIds, period, scope, rangeStart, rangeEnd)` 입력으로 `[rangeStart, rangeEnd)`
//   반열림 구간을 KST period anchor 단위로 순회하며, 각 anchor × 각 person 의 데카르트
//   곱 좌표(`EvaluationPersistContext`)를 결정적으로 enumerate 한다. 이 출력이 T-0536
//   `selectUnevaluatedPeriods` 의 `intended` 입력으로 그대로 흘러가고, persisted 좌표와의
//   차집합으로 미평가 gap subset 이 derive 된다.
//
// 경계(task Out of Scope):
//   - orchestrator/service/controller 실배선·DB read(persisted 좌표 조회)·차집합·batch
//     plan 합성은 본 함수 범위 밖 — 본 함수는 순수 enumeration 만.
//   - 평가 가능 시점 필터(`isPeriodEvaluable(now)` 적용)는 호출자 책임 — 본 함수는 시계
//     비의존 결정적 enumeration 만(진행 중 period 제외는 분리된 책임).
//   - period granularity 확장(quarter/year)은 `period-boundary.ts` single source 변경 동반
//     별도 ADR — 본 함수는 day/week/month 만(boundary helper 가 지원하는 집합 그대로).
//
// 패턴 mirror: evaluation-dedup.ts / evaluation-unevaluated-period-select.ts (순수 함수 +
// 입력 등장 순서 보존 + 입력 비변형 + 명시적 null/undefined 한국어 메시지 `TypeError` +
// 한국어 JSDoc). KST boundary 산술은 직접 수행하지 않고 `period-boundary.ts` 의
// `getKstPeriodRangeByPeriod` single source 1 곳을 경유한다(ADR-0039 §Decision 5 — boundary
// 계산 중복 금지, timezone drift 구조적 차단). 직접 setUTC* / +/- ms 산술 0.

import { getKstPeriodRangeByPeriod } from "../../common/period-boundary";

import type { EvaluationPersistContext } from "./evaluation-result.persist.mapper";

// IntendedPeriodCoordinatesInput — enumeration 입력 wrapper(본 task 가 신설하는 유일한
// 타입). 좌표 출력 타입은 `EvaluationPersistContext` 재사용(새 좌표 타입 발명 0).
//   - personIds  : 의도 좌표를 생성할 person 식별자 배열(입력 등장 순서가 inner 정렬
//                  순서로 보존됨). 빈 배열이면 빈 결과. 중복·빈 문자열 정규화 0(exact).
//   - period     : "day" / "week" / "month" domain period 라벨. boundary helper 가 지원하지
//                  않는 값은 helper 의 RangeError 가 자연 전파(본 함수가 재던지지 않음).
//   - scope      : 좌표 scope 축(exact match — 빈 문자열 허용, 정규화 0).
//   - rangeStart : enumeration 시작 instant(이 시각이 속한 KST period 의 anchor 부터 순회).
//   - rangeEnd   : enumeration 종료 instant(반열림 `[rangeStart, rangeEnd)` — 배타).
export interface IntendedPeriodCoordinatesInput {
  personIds: string[];
  period: string;
  scope: string;
  rangeStart: Date;
  rangeEnd: Date;
}

// assertValidDate — Date 축(rangeStart/rangeEnd) 방어. Date 가 아니거나 Invalid Date
// (getTime() === NaN)면 한국어 메시지 `TypeError`로 조기 노출한다(silent NaN 비교는
// 무한 루프/누락을 유발 — fail-fast 가 안전, R-112 negative).
function assertValidDate(value: unknown, field: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${field} 는 유효한 Date 여야 한다: ${String(value)}`);
  }
}

// assertStringField — string 축(period/scope) 방어. string 이 아니면 한국어 메시지
// `TypeError`. 빈 문자열("")은 유효한 값으로 허용한다(exact match — 정규화 안 함).
function assertStringField(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${field} 는 string 이어야 한다: ${String(value)}`);
  }
}

/**
 * 의도(intended) 좌표를 결정적으로 enumerate 한다(PLAN.md P5 bullet 106 / R-64 /
 * REQ-037 detection 사슬의 첫 입력, ADR-0039 §Decision 5 KST boundary single-source).
 *
 * `[rangeStart, rangeEnd)` 반열림 구간을 KST period anchor 단위로 순회하며, 각 anchor 와
 * 각 person 의 **데카르트 곱** 좌표(`EvaluationPersistContext`)를 반환한다. 이 출력은
 * T-0536 `selectUnevaluatedPeriods` 의 `intended` 입력으로 흘러가 persisted 좌표와의
 * 차집합으로 미평가 gap 을 derive 하는 데 쓰인다.
 *
 * Anchor 순회 규칙(KST boundary single-source):
 *   - 첫 anchor = `getKstPeriodRangeByPeriod(period, rangeStart).start` — `rangeStart` 가
 *     속한 KST period 의 시작 시각으로 snap(mid-period 입력이든 정확한 boundary 입력이든
 *     같은 첫 anchor 를 산출 — boundary snap 정신).
 *   - 각 anchor 가 `anchor.getTime() < rangeEnd.getTime()` 인 동안 좌표를 생성하고,
 *     다음 anchor = `getKstPeriodRangeByPeriod(period, anchor).end`(현 period 의 반열림
 *     end = 다음 period 의 start)로 진행한다. month 의 28~31 일 가변 길이도 boundary
 *     helper 가 정확히 산출한다(직접 달력 산술 0).
 *
 * 반환 순서(이중 stable 정렬):
 *   - outer = period anchor 시간순(과거→미래).
 *   - inner = `personIds` 입력 등장 순서.
 *   - 한 anchor 의 모든 person 좌표가 다음 anchor 의 person 좌표보다 앞선다.
 *
 * 정책(결정성 + 비변형):
 *   - `personIds` 가 빈 배열이면 빈 배열 반환(person 축이 비어 데카르트 곱이 공집합).
 *   - `rangeStart.getTime() >= rangeEnd.getTime()` 이면 빈 배열 반환(반열림
 *     `[rangeStart, rangeEnd)` 가 공구간). 단 첫 anchor 가 `rangeStart` 보다 과거로 snap
 *     되더라도 anchor < rangeEnd 판정은 snap 된 anchor 기준이므로, rangeStart 가 anchor
 *     보다 미래여도 anchor < rangeEnd 면 그 anchor 는 생성된다(구간이 그 period 와 겹침).
 *   - `rangeEnd` 가 첫 anchor 의 end 이하면 anchor 1 개만 생성된다(첫 anchor < rangeEnd
 *     이면 1 개, 첫 anchor >= rangeEnd 면 0 개 — boundary edge 결정적).
 *   - `personIds` 중복은 dedup 하지 않는다 — 중복 person 만큼 좌표가 중복 생성된다(중복
 *     제거는 호출자 책임). 빈 문자열 personId / scope 는 정규화 없이 그대로(exact match).
 *   - 좌표 `periodStart` 는 boundary helper 가 반환한 새 Date 를 그대로 element 로 쓴다
 *     (helper 가 매 호출 새 Date 반환 — 입력 변형 0, 호출자 mutate 가 다음 호출에 영향 0).
 *   - 입력 객체·배열을 mutate 하지 않고 새 배열을 반환한다(부수효과 0, 같은 입력 →
 *     같은 출력, 시계 비의존).
 *
 * @param input enumeration 입력 wrapper. 변형하지 않는다.
 * @returns anchor 시간순 × person 입력 순서로 정렬된 의도 좌표 새 배열.
 * @throws {TypeError} `input` 이 null/undefined, 또는 `personIds` 가 null/undefined·non-array,
 *   또는 `personIds` 원소가 non-string, 또는 `period`/`scope` 가 non-string, 또는
 *   `rangeStart`/`rangeEnd` 가 Date 가 아니거나 Invalid Date 일 때.
 * @throws {RangeError} `period` 가 boundary helper 미지원 값일 때(helper 자연 전파).
 */
export function enumerateIntendedPeriodCoordinates(
  input: IntendedPeriodCoordinatesInput,
): EvaluationPersistContext[] {
  if (input === null || input === undefined) {
    throw new TypeError("input 이 null/undefined 일 수 없다.");
  }

  const { personIds, period, scope, rangeStart, rangeEnd } = input;

  if (!Array.isArray(personIds)) {
    throw new TypeError(`personIds 는 배열이어야 한다: ${String(personIds)}`);
  }
  assertStringField(period, "period");
  assertStringField(scope, "scope");
  assertValidDate(rangeStart, "rangeStart");
  assertValidDate(rangeEnd, "rangeEnd");
  // personId 원소 무결성 — non-string 은 좌표 식별 축 오염이므로 조기 throw.
  for (const personId of personIds) {
    assertStringField(personId, "personIds 원소");
  }

  const coordinates: EvaluationPersistContext[] = [];

  // 빈 person 축 또는 공구간이면 데카르트 곱이 공집합 — 빈 배열로 조기 반환(루프 진입 0).
  if (personIds.length === 0 || rangeStart.getTime() >= rangeEnd.getTime()) {
    return coordinates;
  }

  const endInstant = rangeEnd.getTime();
  // 첫 anchor = rangeStart 가 속한 KST period 의 start 로 snap(boundary single-source).
  let anchor = getKstPeriodRangeByPeriod(period, rangeStart).start;

  // anchor 시간순(outer) × personIds 입력 순서(inner) 데카르트 곱.
  while (anchor.getTime() < endInstant) {
    for (const personId of personIds) {
      coordinates.push({
        personId,
        period,
        scope,
        // boundary helper 가 매 호출 새 Date 를 반환하므로 그대로 element 로 사용한다
        // (입력 변형 0 / 호출자 mutate 격리). 같은 anchor 의 여러 person 좌표는 같은
        // Date 참조를 공유하나, anchor 자체가 호출 격리된 새 인스턴스라 안전하다.
        periodStart: anchor,
      });
    }
    // 다음 anchor = 현 period 의 반열림 end(= 다음 period 의 start). 직접 달력 산술 0.
    anchor = getKstPeriodRangeByPeriod(period, anchor).end;
  }

  return coordinates;
}
