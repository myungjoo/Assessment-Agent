// build-unevaluated-fill-coordinate-runner — P5 bullet 106(R-64 / REQ-037 "평가 없는
// 부분 일괄 평가" / REQ-038) run-side 사슬의 인자-조립 순수 조각. Q-0045 옵션1(impure run
// orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서, 직전 T-0558
// (merge 80bcfec)이 좌표 1 개 + `runner` thunk → `UnevaluatedFillRunOutcome` 1 개 실행
// helper `runUnevaluatedFillCoordinate(bridge, runner)` 를 닫았다. 그 helper 는 영속
// 호출을 추상화한 `runner: () => Promise<PeriodBridgeAdminPersistResult>` 를 인자로
// 받으며, 그 thunk 안에 캡슐화될 person 해석 / `ScoringOptions` 도출 / `period.since`
// 도출 / `context`(T-0556) 조립 / `reevaluate` 결정은 호출자 책임으로 남겼다.
//
// 책임:
//   좌표 1 개(`PeriodBridgeDto`) + 이미 resolved 된 person(`PeriodBridgePersonInput`) +
//   scoring 옵션(`ScoringOptions`) + `generateAndPersist`-shape callable(`persist`)을 받아,
//   `PeriodBridgeAdminPersistService.generateAndPersist(person, period, options, context,
//   reevaluate)` 의 5 인자를 좌표에서 결정적으로 도출해 그 호출을 캡슐화한 **runner
//   thunk**(`UnevaluatedFillCoordinateRunner`, T-0558 정의 재사용 — 새 타입 발명 0)를
//   반환하는 dependency-free 순수 factory.
//     - `context` 인자: T-0556 `toEvaluationPersistContext(bridge)` 에 **위임**(좌표 →
//       `EvaluationPersistContext`, periodStart string→Date + Invalid Date 거부 — 재구현 0).
//     - `period.since` 인자: `bridge.periodStart` 를 echo(도출/변형 0 — Admin service 가
//       since 를 pass-through 하므로 좌표 시작 시각을 그대로 넘긴다).
//     - `reevaluate` 인자: `bridge.reevaluate` 를 그대로 전달(undefined 면 undefined —
//       Admin service 가 default false 로 처리).
//     - `person` / `options` 인자: 호출자가 넘긴 값을 thunk 로 pass-through.
//   이로써 후속 orchestrator 는 좌표마다 인자 조립을 inline 재구현(context 도출 누락 /
//   since echo 분산 risk)하는 대신 본 factory 1 회 호출로 thunk 를 얻어 T-0558 helper 에
//   바로 넘긴다(`runUnevaluatedFillCoordinate(bridge, buildUnevaluatedFillCoordinateRunner(...))`).
//
// lazy 평가(시점 결정 — load-bearing):
//   factory 자체는 **인자 조립만** 하고 `persist` 를 호출하지 않는다(호출은 반환된 thunk 가
//   await 될 때). `toEvaluationPersistContext(bridge)` 호출 시점도 thunk 실행 시점으로 둔다
//   — Invalid periodStart 의 한국어 `TypeError` 가 factory 조립 시점이 아니라 thunk 실행
//   시점에 발생하도록(orchestrator 의 T-0558 helper try/catch 가 그 실패를 failed outcome
//   으로 흡수할 수 있게). factory 조립 시점에 context 를 도출하면 그 throw 가 좌표 배열
//   순회 자체를 중단시켜 부분 실패 흡수(REQ-037)가 깨지므로 의도적으로 thunk 안으로 미룬다.
//
// build-time dependency-free 보장:
//   본 factory 는 `@Injectable` 이 아니며 `PeriodBridgeAdminPersistService` 인스턴스를
//   import 하지 않는다. 영속 호출을 callable 인자(`GenerateAndPersistFn` — service 의
//   `generateAndPersist` 시그니처 재사용)로 받으므로 service DI / person 해석(DB) / module
//   등록은 전부 호출자 책임으로 남고, 본 factory 의 빌드/unit 은 mock callable 로 완결된다
//   — `generateAndPersist` 가 내부적으로 LLM/DB 를 쓰더라도 본 factory 의 unit test 는
//   mock callable 을 호출하므로 LLM 네트워크 0 이다(live-LLM standing 게이트 ADR-0045 무관).
//
// 패턴 mirror: run-unevaluated-fill-coordinate.ts / period-bridge-to-persist-context
// .mapper.ts / dedupe-period-bridge-requests.ts(null/undefined fail-fast 한국어
// `TypeError` + 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable` 0,
// NestJS/Prisma/LLM/class-validator/repository import 0 — 타입들만 `import type`,
// `toEvaluationPersistContext` 만 value import. 새 외부 dependency 0.

import type { EvaluationPersistContext } from "../domain/evaluation-result.persist.mapper";
import type { ScoringOptions } from "../evaluation-scoring.service";
import type { PeriodBridgeAdminPersistResult } from "../period-bridge-admin-persist.service";
import type { PeriodBridgePersonInput } from "../period-bridge-ephemeral.service";

import { toEvaluationPersistContext } from "./period-bridge-to-persist-context.mapper";
import type { PeriodBridgeDto } from "./period-bridge.dto";
import type { UnevaluatedFillCoordinateRunner } from "./run-unevaluated-fill-coordinate";

/**
 * 호출자가 바인딩한 `PeriodBridgeAdminPersistService.generateAndPersist` 를 받기 위한
 * callable 타입 — 그 메서드의 5 인자 시그니처 재사용(service 인스턴스 import 0). 본
 * factory 는 이 callable 을 thunk 안에서 호출하므로, 호출자는 `service.generateAndPersist
 * .bind(service)` 또는 동등 wrapper 를 넘긴다. test 는 jest mock(`jest.fn()`)을 넘긴다.
 */
export type GenerateAndPersistFn = (
  person: PeriodBridgePersonInput,
  period: { since?: string },
  options: ScoringOptions,
  context: EvaluationPersistContext,
  reevaluate?: boolean,
) => Promise<PeriodBridgeAdminPersistResult>;

/**
 * 좌표 1 개(`PeriodBridgeDto`) + resolved person + scoring 옵션 + 영속 callable 을 받아,
 * `generateAndPersist` 의 5 인자를 좌표에서 결정적으로 도출·바인딩한 **runner thunk**
 * (`UnevaluatedFillCoordinateRunner`, T-0558 정의 재사용)를 조립해 반환하는 순수 factory
 * (P5 bullet 106 / R-64 / REQ-037 run-side 사슬 조각, Q-0045 옵션1).
 *
 * 인자 도출 규칙(반환 thunk 가 await 될 때 적용):
 *   - `person`   : 호출자가 넘긴 값 그대로 pass-through.
 *   - `period`   : `{ since: bridge.periodStart }` — 좌표 시작 시각을 since 로 echo(도출/
 *     변형 0). Admin service 가 since 를 pass-through 하므로 좌표 값을 그대로 넘긴다.
 *   - `options`  : 호출자가 넘긴 값 그대로 pass-through(modelId 결정은 호출자 책임).
 *   - `context`  : `toEvaluationPersistContext(bridge)`(T-0556) 위임 — periodStart
 *     string→Date 변환 + Invalid Date 거부. 재구현 0.
 *   - `reevaluate`: `bridge.reevaluate` 그대로(undefined 면 undefined — Admin 이 default
 *     false 로 처리).
 *
 * lazy 평가:
 *   factory 호출은 인자 조립만 하고 `persist` 를 호출하지 않는다. `toEvaluationPersistContext`
 *   호출도 반환 thunk 실행 시점으로 미룬다 — Invalid periodStart 의 `TypeError` 가 factory
 *   조립 시점이 아니라 thunk await 시점에 reject 로 발생해, T-0558 helper 의 try/catch 가
 *   failed outcome 으로 흡수할 수 있도록(좌표 배열 순회 자체는 중단되지 않음 — REQ-037
 *   부분 실패 흡수). 따라서 factory 호출만으로는 Invalid periodStart 가 throw 되지 않는다.
 *
 * 비변형:
 *   입력 `bridge` / `person` / `options` 객체를 mutate 하지 않는다. 반환 thunk 는 매
 *   await 마다 위 인자를 새로 도출(`context` 는 새 Date 인스턴스)해 `persist` 에 넘긴다.
 *
 * 방어(fail-fast 한국어 TypeError — thunk 조립 전):
 *   - `bridge` 가 null/undefined → `TypeError`(좌표 접근 불가라 조립 전 차단). 단
 *     periodStart 형식 검증 자체는 thunk 실행 시점의 `toEvaluationPersistContext` 가 한다.
 *   - `persist` 가 함수가 아님(null/undefined/비-function) → `TypeError`(thunk 가 호출
 *     불가능한 값을 캡슐화하지 않도록 조립 전 차단).
 *   위 방어는 thunk 를 반환하기 전에 평가되므로 영속 부수효과 0.
 *
 * @param bridge 실행 대상 좌표 1 개. 변형하지 않는다. null/undefined 시 한국어 `TypeError`.
 * @param person 이미 resolved 된 person 입력(serviceIdentities). thunk 로 pass-through.
 * @param options scoring 옵션(modelId). thunk 로 pass-through.
 * @param persist 호출자가 바인딩한 `generateAndPersist`-shape callable. 비-function 시
 *   한국어 `TypeError`. factory 는 호출하지 않고 thunk 안에 캡슐화만 한다.
 * @returns `UnevaluatedFillCoordinateRunner` — await 시 `persist(person, { since:
 *   bridge.periodStart }, options, toEvaluationPersistContext(bridge), bridge.reevaluate)`
 *   를 호출해 그 `Promise<PeriodBridgeAdminPersistResult>` 를 반환하는 thunk.
 * @throws {TypeError} `bridge` 가 null/undefined 이거나 `persist` 가 비-function 일 때
 *   (한국어 메시지, factory 조립 시점). Invalid periodStart 는 thunk 실행 시점에 reject.
 */
export function buildUnevaluatedFillCoordinateRunner(
  bridge: PeriodBridgeDto,
  person: PeriodBridgePersonInput,
  options: ScoringOptions,
  persist: GenerateAndPersistFn,
): UnevaluatedFillCoordinateRunner {
  // bridge 자체 방어 — null/undefined 면 아래 thunk 안에서 bridge.periodStart /
  // bridge.reevaluate 접근이 opaque TypeError 를 던지므로 조립 시점에 명시 메시지로
  // 조기 노출(run-unevaluated-fill-coordinate.ts 의 null 방어 패턴 mirror).
  if (bridge === null || bridge === undefined) {
    throw new TypeError(
      `buildUnevaluatedFillCoordinateRunner: bridge 는 null/undefined 일 수 없다: ${String(bridge)}`,
    );
  }

  // persist 자체 방어 — 함수가 아니면(null/undefined/비-function) thunk 실행 시 호출이
  // opaque TypeError 를 던지므로 조립 시점에 명시 메시지로 조기 노출(R-112 negative).
  if (typeof persist !== "function") {
    throw new TypeError(
      `buildUnevaluatedFillCoordinateRunner: persist 는 함수여야 한다: ${String(persist)}`,
    );
  }

  // runner thunk — 인자 도출은 await 시점에 수행(lazy). `async` 로 선언해 thunk 본문의
  // 동기 throw(특히 toEvaluationPersistContext 의 Invalid periodStart TypeError)도 동기
  // throw 가 아니라 **reject** 로 전파되도록 한다 — T-0558 helper 가 `await runner()` 의
  // reject 를 try/catch 로 잡아 failed outcome 으로 흡수할 수 있게(좌표 배열 순회 자체는
  // 중단되지 않음, REQ-037 부분 실패 흡수). factory 조립 시점에는 throw 되지 않는다(lazy).
  return async () =>
    persist(
      person,
      { since: bridge.periodStart },
      options,
      toEvaluationPersistContext(bridge),
      bridge.reevaluate,
    );
}
