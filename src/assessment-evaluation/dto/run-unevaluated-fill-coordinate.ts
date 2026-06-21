// run-unevaluated-fill-coordinate — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분
// 일괄 평가" / REQ-038) run-side 사슬의 impure 실행 최소 단위. Q-0045 옵션1(impure run
// orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서, 중복 제거된
// 좌표 배열(`PeriodBridgeDto[]`)을 실제로 흘려보내는 loop-level orchestrator 가 좌표
// 1 개를 닫을 때 호출하는 helper 다. 좌표 1 개를 영속 진입점
// `PeriodBridgeAdminPersistService.generateAndPersist(...)`(추상화된 `runner` thunk)
// 로 흘려보내고, 그 결과(또는 reject)를 `UnevaluatedFillRunOutcome` 1 개로 합성한다.
//
// 책임:
//   좌표 1 개(`PeriodBridgeDto`)와 그 좌표의 영속 호출을 캡슐화한 `runner`(thunk)를
//   받아 outcome 1 개를 산출한다.
//     - 성공(runner resolve): T-0557 매퍼 `toUnevaluatedFillRunOutcome(bridge, result)`
//       에 위임해 evaluated/skipped outcome 을 반환한다(재구현 0 — 위임).
//     - 실패(runner reject): try/catch 로 잡아 `{ 좌표 4 축 echo, status: "failed",
//       reason: <에러 메시지> }` outcome 을 합성해 반환한다. 에러를 caller 로 재던지지
//       **않는다** — 좌표 1 개 실패가 batch-run 전체를 중단시키지 않도록(REQ-037 일괄
//       평가의 부분 실패 흡수).
//   본 helper 가 failed status 합성의 single source 다 — T-0557 매퍼는 영속이 성공해
//   결과가 반환된 좌표만 evaluated/skipped 로 매핑하고, reject 한 좌표의 failed outcome
//   합성은 명시적으로 그 매퍼의 Out of Scope(좌표 echo 누락 / reason 분산 risk)였다.
//   본 helper 가 그 try/catch failed 경로를 채워, 후속 loop-level orchestrator 가
//   좌표마다 inline try/catch 를 재구현하는 대신 본 helper 1 회 호출로 좌표 1 개 →
//   outcome 1 개를 닫게 한다.
//
// build-time dependency-free 보장:
//   본 helper 는 `@Injectable` 이 아니라 영속 호출을 추상화한 `runner` 함수를 인자로
//   받는 순수-ish 함수다. person 해석 / `ScoringOptions` / `period.since` / `reevaluate`
//   인자 조립은 호출자(후속 orchestrator) 책임이며 전부 runner thunk 안에 캡슐화된다.
//   따라서 본 helper 는 `PeriodBridgeAdminPersistService` 인스턴스를 import 하지 않아
//   빌드/unit 이 mock runner 로 완결되고 — generateAndPersist 가 내부적으로 LLM 을
//   호출하더라도 본 helper 의 unit test 는 mock runner 라 LLM 네트워크 0 이다(live-LLM
//   standing 게이트 ADR-0045 와 무관).
//
// 경계(task Out of Scope):
//   - loop-level impure orchestrator 실배선(좌표 배열 순회 / person 해석 / 인자 조립 /
//     집계) — 후속 slice. 본 helper 는 좌표 1 개 + runner 1 개 → outcome 1 개까지만.
//   - `PeriodBridgeAdminPersistService` 인스턴스 import / @Injectable service 화 / DI
//     등록 — 본 helper 는 순수 함수(runner-as-param).
//   - `evaluatedCount` 정확 건수 도출 — 성공 path 를 T-0557 매퍼에 위임하므로 그 매퍼의
//     v1 미설정 정책을 계승(failed 에도 미설정 — T-0552 가 evaluated status 만 합산).
//   - retry / batch abort / 재시도 정책 — 본 helper 는 단순 failed 흡수만.
//
// 패턴 mirror: persist-result-to-run-outcome.mapper.ts /
// dedupe-period-bridge-requests.ts(null/undefined fail-fast 한국어 `TypeError` +
// 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable` 0,
// NestJS/Prisma/LLM/class-validator/repository import 0 — `PeriodBridgeDto` /
// `PeriodBridgeAdminPersistResult` / `UnevaluatedFillRunOutcome` 타입만 `import type`,
// `toUnevaluatedFillRunOutcome` 만 value import. 새 외부 dependency 0.

import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";

import type { PeriodBridgeDto } from "./period-bridge.dto";
import { toUnevaluatedFillRunOutcome } from "./persist-result-to-run-outcome.mapper";
import type { UnevaluatedFillRunOutcome } from "./unevaluated-fill-run-result";

/** 좌표 1 개의 영속 호출을 캡슐화한 thunk — person 해석/인자 조립은 호출자 책임. */
export type UnevaluatedFillCoordinateRunner =
  () => Promise<PeriodBridgeAdminPersistResult>;

/**
 * 좌표 1 개(`PeriodBridgeDto`)를 영속 `runner`(thunk)로 흘려보내고 그 결과(또는 reject)를
 * `UnevaluatedFillRunOutcome` 1 개로 합성하는 impure 실행 helper(P5 bullet 106 / R-64 /
 * REQ-037 run-side 사슬 조각, Q-0045 옵션1).
 *
 * 동작:
 *   - 성공(runner resolve → `PeriodBridgeAdminPersistResult`): T-0557 매퍼
 *     `toUnevaluatedFillRunOutcome(bridge, result)` 에 위임해 evaluated/skipped outcome 을
 *     반환한다(좌표 echo + created→status 도출은 그 매퍼 책임 — 재구현 0).
 *   - 실패(runner reject → throw): try/catch 로 잡아 `{ 좌표 4 축 echo, status: "failed",
 *     reason }` outcome 을 합성해 반환한다. 에러를 caller 로 재던지지 **않는다**(좌표 1 개
 *     실패가 batch-run 전체를 중단시키지 않도록 — REQ-037 부분 실패 흡수).
 *
 * reason 합성:
 *   catch 한 에러가 `Error` 인스턴스면 `error.message`, 아니면 `String(error)` 를 reason
 *   으로 쓴다(안전 직렬화 — string/숫자/null 같은 비-Error reject 도 사람-친화 echo 로
 *   수렴). reason 은 echo 로만 쓰이며 집계 카운트에는 영향 0(T-0552 는 reason 미사용).
 *
 * failed outcome 의 좌표 4 축(personId/period/scope/periodStart)은 `bridge` 에서 변형 없이
 * echo 한다. `evaluatedCount` 는 failed 에 설정하지 않는다(T-0552 가 evaluated status 만
 * 합산). 입력 `bridge` 객체는 mutate 하지 않는다.
 *
 * 방어(fail-fast 한국어 TypeError — runner 호출 전):
 *   - `bridge` 가 null/undefined → `TypeError`(좌표 echo 불가라 runner 호출 전 차단).
 *   - `runner` 가 함수가 아님(null/undefined/비-function) → `TypeError`(호출 불가 방어).
 *   위 방어는 runner 를 await 하기 전에 평가되므로 영속 부수효과 0.
 *
 * @param bridge 실행 대상 좌표 1 개. 변형하지 않는다. null/undefined 시 한국어 `TypeError`.
 * @param runner 좌표 1 개의 영속 호출을 캡슐화한 thunk. 비-function 시 한국어 `TypeError`.
 * @returns `UnevaluatedFillRunOutcome` — 성공 시 매퍼 위임 결과(evaluated/skipped),
 *   reject 시 failed outcome(좌표 echo + reason). 새 객체.
 * @throws {TypeError} `bridge` 가 null/undefined 이거나 `runner` 가 비-function 일 때
 *   (한국어 메시지). runner reject 는 throw 하지 않고 failed outcome 으로 흡수한다.
 */
export async function runUnevaluatedFillCoordinate(
  bridge: PeriodBridgeDto,
  runner: UnevaluatedFillCoordinateRunner,
): Promise<UnevaluatedFillRunOutcome> {
  // bridge 자체 방어 — null/undefined 면 failed outcome 의 좌표 4 축 echo 가 불가능하므로
  // runner 호출 전 한국어 메시지 TypeError 로 fail-fast(persist-result-to-run-outcome
  // .mapper.ts 의 null 방어 패턴 mirror).
  if (bridge === null || bridge === undefined) {
    throw new TypeError(
      `runUnevaluatedFillCoordinate: bridge 는 null/undefined 일 수 없다: ${String(bridge)}`,
    );
  }

  // runner 자체 방어 — 함수가 아니면(null/undefined/비-function) 아래 await 가 opaque
  // TypeError 를 던지므로 호출 전 명시 메시지로 조기 노출(R-112 negative).
  if (typeof runner !== "function") {
    throw new TypeError(
      `runUnevaluatedFillCoordinate: runner 는 함수여야 한다: ${String(runner)}`,
    );
  }

  try {
    // 성공 path — runner resolve 결과를 T-0557 매퍼에 위임(좌표 echo + created→status
    // 도출은 그 매퍼 책임, 재구현 0).
    const result = await runner();
    return toUnevaluatedFillRunOutcome(bridge, result);
  } catch (error) {
    // 실패 path — 에러를 재던지지 않고 failed outcome 으로 흡수(좌표 1 개 실패가 batch-run
    // 전체를 중단시키지 않도록, REQ-037 부분 실패 흡수). reason 은 안전 직렬화(Error 면
    // message, 아니면 String(error)).
    const reason = error instanceof Error ? error.message : String(error);
    return {
      personId: bridge.personId,
      period: bridge.period,
      scope: bridge.scope,
      periodStart: bridge.periodStart,
      status: "failed",
      reason,
    };
  }
}
