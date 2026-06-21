// period-bridge-to-persist-context.mapper — P5 bullet 106(R-64 / REQ-037 "평가 없는
// 부분 일괄 평가" / REQ-038) 의 plan→execute 사슬에서 run-side 의 진입 조각. T-0549..
// T-0555 가 batch plan → `UnevaluatedFillRequest[]` → `PeriodBridgeDto[]` → dedup →
// 양방향 compose 까지 완결했고, Q-0045 RESOLVED 결과(옵션1: impure run orchestrator +
// POST /unevaluated-fill-run chain)로 run-side 사슬을 재개한다.
//
// 책임:
//   `PeriodBridgeDto` 1 개(중복 제거된 좌표 1 개)를 받아 기존 영속 진입점
//   `PeriodBridgeAdminPersistService.generateAndPersist(person, period, options,
//   context, reevaluate)` 의 `context` 인자 타입 `EvaluationPersistContext` shape 으로
//   결정적 변환하는 dependency-free 순수 함수. `PeriodBridgeDto.periodStart` 는 ISO
//   `string` 이지만 `EvaluationPersistContext.periodStart` 는 `Date` 라(`evaluation-
//   result.persist.mapper.ts:47`) 좌표 1 개당 string→Date 변환이 필요하다 — 본 매퍼는
//   그 변환을 single source 로 박제해, 후속 orchestrator 가 매 좌표마다 inline
//   재구현하면서 Invalid Date 를 silent 통과시키는 risk 를 차단한다.
//
// 경계(task Out of Scope):
//   - impure run orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 person
//     해석 → fresh-collect → LLM 평가 → 영속 → outcome 산출) — 후속 slice. 본 매퍼는
//     좌표 1 개 → context shape 변환까지만.
//   - POST /unevaluated-fill-run controller route / RBAC / run-request DTO 신설 — 후속.
//   - `PeriodBridgeAdminPersistService.generateAndPersist` 호출 / person 해석 /
//     `ScoringOptions`·`period.since` 도출 — 본 매퍼는 `context` 인자 1 개만 만든다.
//   - `reevaluate` flag — 영속 context 축이 아니므로 출력에서 제외(orchestrator 가 별도
//     인자로 전달). `EvaluationPersistContext` 가 personId/period/scope/periodStart 4-
//     field 뿐(`reevaluate` 축 미포함)이므로 type 차원에서도 보장.
//   - 배열 단위 처리 — 본 매퍼는 좌표 1 개 단위(호출자 책임으로 `Array.prototype.map`).
//   - LLM 네트워크 호출·live-LLM 검증(standing 게이트 ADR-0045) — 건드리지 않음.
//
// 패턴 mirror: dedupe-period-bridge-requests.ts(null/undefined fail-fast 한국어
// `TypeError` + 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable` 0,
// NestJS/Prisma/LLM/class-validator/repository import 0 — `PeriodBridgeDto` /
// `EvaluationPersistContext` 타입만 import. 부수효과 0, 입력 비변형. 새 외부 dependency 0.
//
// Invalid Date 방어: `evaluation-persisted-period-coordinates.ts:67-76` 의
// `!(value instanceof Date) || Number.isNaN(value.getTime())` 한국어 `TypeError` 관용구
// 와 동형. `new Date("not-a-date")` 가 Invalid Date(`getTime() === NaN`)를 만들어 영속
// 좌표에 silent 흘러들어가면 좌표 정규화·차집합 매칭이 비결정적으로 무너지므로 명시 거부.
// 비-string / 빈 string 도 동형 거부(상류 `@IsISO8601()` 가 차단해야 하나 본 매퍼는 그
// 가정에 기대지 않고 자기 경계에서 방어 — REQ-037 fill 좌표 무결성 fail-fast).

import type { EvaluationPersistContext } from "../domain/evaluation-result.persist.mapper";

import type { PeriodBridgeDto } from "./period-bridge.dto";

/**
 * `PeriodBridgeDto` 1 개의 좌표 4-tuple(personId/period/scope/periodStart) 을 기존
 * 영속 진입점 `PeriodBridgeAdminPersistService.generateAndPersist` 의 `context` 인자
 * 타입 `EvaluationPersistContext` shape 으로 결정적 변환한다(P5 bullet 106 / R-64 /
 * REQ-037 run-side 사슬 진입 조각, Q-0045 옵션1).
 *
 * 변환 규칙:
 *   - personId / period / scope 는 변형 없이 그대로 전사한다(pass-through).
 *   - periodStart(ISO string) 는 `new Date(...)` 로 변환한다. 결과가 Invalid Date
 *     (`Number.isNaN(getTime())`) 면 한국어 `TypeError` 로 명시 거부한다(silent
 *     Invalid Date 진입 차단).
 *   - 비-string periodStart / 빈 string periodStart 도 동형 거부한다(`@IsISO8601()`
 *     상류 차단에 기대지 않고 자기 경계에서 방어).
 *   - `reevaluate` flag 는 영속 context 축이 아니므로 출력에 포함하지 않는다 —
 *     `EvaluationPersistContext` type 자체가 4-field 뿐이라 컴파일러가 누락 강제.
 *
 * 비변형:
 *   - 입력 `bridge` 객체를 mutate 하지 않는다(새 객체 반환). `EvaluationPersistContext`
 *     의 `periodStart` 는 새로 생성한 `Date` 인스턴스이므로 입력 string 참조와 분리.
 *
 * @param bridge 중복 제거된 fill bridge 요청 1 개. 변형하지 않는다. null/undefined 시
 *   한국어 메시지 `TypeError`(dedup helper 의 fail-fast 패턴 mirror).
 * @returns `EvaluationPersistContext` — personId/period/scope 전사 + periodStart 가
 *   유효한 `Date` 인스턴스로 변환된 새 객체.
 * @throws {TypeError} `bridge` 가 null/undefined 이거나, periodStart 가 non-string·
 *   빈 string·Invalid Date 를 만드는 string 일 때(한국어 메시지).
 */
export function toEvaluationPersistContext(
  bridge: PeriodBridgeDto,
): EvaluationPersistContext {
  // bridge 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent
  // 진행 시 아래 필드 access 가 opaque TypeError 를 던지므로 명시적 메시지로 조기 노출,
  // dedupe-period-bridge-requests.ts 의 null 원소 방어 패턴 mirror).
  if (bridge === null || bridge === undefined) {
    throw new TypeError(
      `toEvaluationPersistContext: bridge 는 null/undefined 일 수 없다: ${String(bridge)}`,
    );
  }

  // periodStart string 형식 방어 — 상류 `@IsISO8601()` 가 차단해야 하나 본 매퍼는 그
  // 가정에 기대지 않는다. 비-string(undefined/number/Date 객체 직접 전달 등)이면 한국어
  // 메시지 TypeError 로 명시 거부(silent skip 시 `new Date(undefined)` 등이 Invalid
  // Date 를 만들어 흘러들어가는 silent 진입 차단).
  if (typeof bridge.periodStart !== "string") {
    throw new TypeError(
      `toEvaluationPersistContext: periodStart 는 string 이어야 한다: ${String(bridge.periodStart)}`,
    );
  }

  // 빈 string 방어 — `new Date("")` 는 Invalid Date(브라우저/Node) 라 아래 분기로
  // 잡히긴 하나, 메시지를 분리해 호출자가 원인(누락 vs 잘못된 형식)을 구분할 수 있게
  // 한다. evaluation-persisted-period-coordinates 의 string 축 빈 string 허용과 달리
  // 본 매퍼의 periodStart 는 Date instant 라 빈 string 은 유효하지 않다.
  if (bridge.periodStart === "") {
    throw new TypeError(
      "toEvaluationPersistContext: periodStart 는 빈 string 일 수 없다.",
    );
  }

  // ISO string → Date 변환. `new Date(string)` 은 ISO-8601 을 결정적으로 파싱하되,
  // 비-ISO("not-a-date" 등)에는 Invalid Date(getTime() === NaN) 를 반환한다.
  const periodStartDate = new Date(bridge.periodStart);

  // Invalid Date 방어 — evaluation-persisted-period-coordinates.ts:70-76 의 한국어
  // TypeError 관용구와 동형. 좌표가 Invalid Date 로 흘러들어가면 차집합 매칭이 비
  // 결정적으로 무너져 평가 누락 / 중복을 유발하므로 fail-fast(R-112 negative).
  if (Number.isNaN(periodStartDate.getTime())) {
    throw new TypeError(
      `toEvaluationPersistContext: periodStart 가 유효한 ISO 날짜가 아니다: ${bridge.periodStart}`,
    );
  }

  // 새 객체 반환(입력 비변형). EvaluationPersistContext 타입이 4-field 뿐이므로
  // reevaluate 누락은 컴파일러가 강제 — 본 매퍼는 의도적으로 그 축을 포함하지 않는다.
  return {
    personId: bridge.personId,
    period: bridge.period,
    scope: bridge.scope,
    periodStart: periodStartDate,
  };
}
