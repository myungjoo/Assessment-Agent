// persist-result-to-run-outcome.mapper — P5 bullet 106(R-64 / REQ-037 "평가 없는
// 부분 일괄 평가" / REQ-038) 의 run-side 사슬 다음 조각. Q-0045 옵션1(impure run
// orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서, 영속 진입점
// `PeriodBridgeAdminPersistService.generateAndPersist(...)` 의 반환 shape
// `PeriodBridgeAdminPersistResult`(`{ assessment, created }`,
// period-bridge-admin-persist.service.ts:68)와 출력-side 집계 조각 T-0552
// `aggregateUnevaluatedFillRunResult` 의 입력 shape `UnevaluatedFillRunOutcome`
// (좌표 4 축 echo + 결정적 status) 사이의 per-좌표 변환을 닫는다.
//
// 책임:
//   좌표 1 개(`PeriodBridgeDto`) + 그 좌표의 영속 결과 1 개
//   (`PeriodBridgeAdminPersistResult`) 를 받아 `UnevaluatedFillRunOutcome` 1 개로
//   결정적 변환한다. 좌표 4 축(personId/period/scope/periodStart)은 source `bridge`
//   에서 변형 없이 그대로 echo 하고(periodStart 는 이미 string 축이라 추가 직렬화
//   불요), status 는 `result.created` 에서 결정적으로 도출한다:
//     - created === true  → "evaluated" : 본 호출이 새 평가를 영속했다.
//     - created === false → "skipped"   : first-write-wins read-through 로 기존
//                                         저장본을 반환(write 0).
//   single source 로 status 매핑을 박제해, 후속 impure orchestrator 가 좌표별
//   outcome 을 매 좌표마다 inline 재구현하면서 status 도출 규칙을 분산시키는 회귀
//   risk(특히 created→status 역전)를 차단한다.
//
// 경계(task Out of Scope):
//   - "failed" status 도출 — `generateAndPersist` 가 reject(예외)한 좌표를 orchestrator
//     가 try/catch 로 잡아 산출하는 경로다(영속 결과가 존재하지 않으므로). 본 매퍼는
//     **영속이 성공해 결과가 반환된 좌표만** evaluated/skipped 로 매핑한다.
//   - impure run orchestrator 실배선(중복 제거된 `PeriodBridgeDto[]` → per-좌표 person
//     해석 → `generateAndPersist` 호출 → outcome 산출 → 집계) — 후속 slice. 본 매퍼는
//     좌표 1 개 + 영속 결과 1 개 → outcome 1 개 변환까지만.
//   - `evaluatedCount` 정확 건수 도출 — 본 v1 미설정(아래 본문 주석 참조).
//   - POST /unevaluated-fill-run controller route / RBAC / run-request DTO 신설 — 후속.
//   - `Assessment` 의 평가 본문 필드(contributionScore/narrative 등) 읽기 — 0. 본
//     매퍼는 `result.created` 만 읽고 좌표는 `bridge` 에서만 echo 한다.
//   - 배열 단위 처리 — 본 매퍼는 좌표 1 개 단위(배열 map 은 호출자 책임).
//   - LLM 네트워크 호출·live-LLM 검증(standing 게이트 ADR-0045) — 건드리지 않음.
//
// 패턴 mirror: period-bridge-to-persist-context.mapper.ts /
// dedupe-period-bridge-requests.ts(null/undefined fail-fast 한국어 `TypeError` +
// 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable` 0,
// NestJS/Prisma/LLM/class-validator/repository import 0 — `PeriodBridgeDto` /
// `PeriodBridgeAdminPersistResult` / `UnevaluatedFillRunOutcome` 타입만 `import type`.
// 부수효과 0, 입력 비변형. 새 외부 dependency 0.

import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";

import type { PeriodBridgeDto } from "./period-bridge.dto";
import type { UnevaluatedFillRunOutcome } from "./unevaluated-fill-run-result";

/**
 * 좌표 1 개(`PeriodBridgeDto`)와 그 좌표의 영속 결과 1 개
 * (`PeriodBridgeAdminPersistResult`)를 `UnevaluatedFillRunOutcome` 1 개로 결정적
 * 변환하는 순수 함수(P5 bullet 106 / R-64 / REQ-037 run-side 사슬 조각, Q-0045 옵션1).
 *
 * 변환 규칙:
 *   - 좌표 4 축(personId/period/scope/periodStart)은 `bridge` 에서 변형 없이 그대로
 *     echo 한다(pass-through, periodStart 는 이미 string 축이라 추가 직렬화 불요).
 *   - status 는 `result.created` 에서 결정적으로 도출한다:
 *       created === true  → "evaluated"(본 호출이 새 평가를 영속).
 *       created === false → "skipped"(first-write-wins read-through, write 0).
 *     boolean 외 값(undefined / "true" / 1 등)이면 status 가 union 밖 값으로 silent
 *     진입하는 것을 차단하기 위해 한국어 `TypeError` 로 명시 거부한다.
 *   - `evaluatedCount` 는 **설정하지 않는다**(아래 미설정 결정 주석 참조 — 미설정은
 *     T-0552 집계에서 0 으로 취급).
 *   - `reason` 은 evaluated/skipped echo 에 불필요하므로 설정하지 않는다(failed 경로의
 *     사유는 orchestrator 책임 — Out of Scope).
 *
 * 비변형:
 *   - 입력 `bridge` / `result` 객체를 mutate 하지 않는다 — 새 outcome 객체를 반환한다.
 *
 * @param bridge 변환 대상 좌표 1 개. 변형하지 않는다. null/undefined 시 한국어 `TypeError`.
 * @param result 그 좌표의 영속 성공 결과 1 개. 변형하지 않는다. null/undefined 또는
 *   `created` 가 비-boolean 일 때 한국어 `TypeError`.
 * @returns `UnevaluatedFillRunOutcome` — 좌표 4 축 echo + created 에서 도출한 status 를
 *   갖는 새 객체(evaluatedCount/reason 미설정).
 * @throws {TypeError} `bridge`/`result` 가 null/undefined 이거나 `result.created` 가
 *   비-boolean 일 때(한국어 메시지).
 */
export function toUnevaluatedFillRunOutcome(
  bridge: PeriodBridgeDto,
  result: PeriodBridgeAdminPersistResult,
): UnevaluatedFillRunOutcome {
  // bridge 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent
  // 진행 시 아래 좌표 echo access 가 opaque TypeError 를 던지므로 명시적 메시지로 조기
  // 노출, period-bridge-to-persist-context.mapper.ts 의 null 방어 패턴 mirror).
  if (bridge === null || bridge === undefined) {
    throw new TypeError(
      `toUnevaluatedFillRunOutcome: bridge 는 null/undefined 일 수 없다: ${String(bridge)}`,
    );
  }

  // result 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent
  // 진행 시 result.created access 가 opaque TypeError 를 던진다).
  if (result === null || result === undefined) {
    throw new TypeError(
      `toUnevaluatedFillRunOutcome: result 는 null/undefined 일 수 없다: ${String(result)}`,
    );
  }

  // created boolean 방어 — undefined / "true"(string) / 1(number) 같은 비-boolean 이
  // 흘러들어오면 아래 삼항이 truthy/falsy 로 silent 도출되어 status 무결성이 무너지므로
  // (예: "false" string 은 truthy 라 evaluated 로 오판) 명시 거부한다. status 가 union
  // 밖 값으로 silent 진입하는 것을 차단하는 fail-fast(R-112 negative, Q-0045 회귀 방지).
  if (typeof result.created !== "boolean") {
    throw new TypeError(
      `toUnevaluatedFillRunOutcome: result.created 는 boolean 이어야 한다: ${String(result.created)}`,
    );
  }

  // status 결정적 도출 — created === true → "evaluated"(새 평가 영속),
  // created === false → "skipped"(first-write-wins read-through, write 0).
  // created 가 boolean 임을 위에서 보장했으므로 삼항은 두 union 멤버만 산출한다.
  const status: UnevaluatedFillRunOutcome["status"] = result.created
    ? "evaluated"
    : "skipped";

  // 새 outcome 객체 반환(입력 bridge/result 비변형). 좌표 4 축은 bridge echo.
  // evaluatedCount 미설정 결정(task Acceptance / Out of Scope): 본 v1 에서는 영속
  // 결과로부터 정확한 생성 건수를 안전하게 도출할 단일 신뢰 source 가 없다 — Assessment
  // row 에는 contributionCount 컬럼이 없고 service 반환 result(assessment/created)에도
  // 건수가 미노출이다. 따라서 evaluatedCount 를 의도적으로 설정하지 않는다(미설정은
  // T-0552 aggregateUnevaluatedFillRunResult 에서 0 으로 취급). 후속 slice 가 service
  // 반환에 정확 건수를 노출하면 본 매퍼가 그 값을 채운다(Follow-ups).
  // reason 도 evaluated/skipped echo 에 불필요하므로 미설정(failed 사유는 orchestrator).
  return {
    personId: bridge.personId,
    period: bridge.period,
    scope: bridge.scope,
    periodStart: bridge.periodStart,
    status,
  };
}
