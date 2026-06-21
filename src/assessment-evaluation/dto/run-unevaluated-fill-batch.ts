// run-unevaluated-fill-batch — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) run-side 사슬의 loop-level orchestrator 의 **순수 loop 부분**.
// Q-0045 옵션1(impure run orchestrator + POST /unevaluated-fill-run chain)로 재개된
// 사슬에서 dependency-free 순수/순수-ish 조각이 좌표 1 개 단위까지 전부 닫혔다 —
// 입력-side(T-0549..T-0551 dedup), run-side 좌표 변환(T-0556/T-0557), 좌표 1 개 실행
// helper(T-0558 `runUnevaluatedFillCoordinate`), 좌표 1 개 runner 조립 factory(T-0559
// `buildUnevaluatedFillCoordinateRunner`), 출력-side 집계(T-0552
// `aggregateUnevaluatedFillRunResult`). 본 driver 는 그 조각들을 좌표 배열 순회로 엮는
// loop 골격을 단일 source 로 박제한다.
//
// 책임:
//   이미 dedup 된 좌표 배열(`PeriodBridgeDto[]`)과 주입된 두 callable(좌표 → resolved
//   person 을 돌려주는 `resolvePerson` resolver, `generateAndPersist`-shape `persist`)와
//   `ScoringOptions` 를 받아, 좌표마다 순서대로:
//     (a) `person = await resolvePerson(bridge)` 로 person 해석,
//     (b) `runner = buildUnevaluatedFillCoordinateRunner(bridge, person, options, persist)`
//         (T-0559)로 runner thunk 조립,
//     (c) `outcome = await runUnevaluatedFillCoordinate(bridge, runner)`(T-0558)로 outcome
//         1 개 산출.
//   모든 outcome 을 **입력 좌표 배열과 동일 순서·동일 길이**로 모은 뒤
//   `aggregateUnevaluatedFillRunResult(outcomes)`(T-0552)로 fold 한 `UnevaluatedFillRunResult`
//   를 반환한다(집계 재구현 0 — 위임). 후속 orchestrator slice 는 좌표 배열 map / per-좌표
//   try/catch / aggregate 호출을 inline 재구현(순서 분실 / 부분 실패 흡수 누락 / aggregate
//   누락 risk)하는 대신 본 driver 1 회 호출로 좌표 배열 → 요약을 닫는다.
//
// 순회 방식 고정(load-bearing):
//   좌표를 **순차(sequential, for-of `await`)** 로 처리한다 — 병렬 `Promise.all` 금지.
//   영속 idempotency / 같은 person 중복 평가 race 회피 + 결정적 순서 보존이 이유다. 좌표
//   배열을 동시에 흘리면 같은 person 의 fresh-collect→평가→영속이 겹쳐 first-write-wins
//   경합이 발생할 수 있고, 완료 순서가 입력 순서와 어긋날 수 있다. 따라서 한 좌표의
//   outcome 을 얻은 뒤 다음 좌표로 넘어간다(결정적 직렬화).
//
// 부분 실패 흡수(REQ-037):
//   `runUnevaluatedFillCoordinate`(T-0558)가 좌표 reject 를 failed outcome 으로 흡수하므로
//   본 driver 는 좌표 1 개의 persist 실패에 batch 를 abort 하지 않는다. 추가로
//   `resolvePerson(bridge)` 자체가 reject 하는 경우도 **좌표 단위 failed outcome 으로
//   흡수**한다(좌표 4 축 echo + reason) — person 해석 실패 1 개가 나머지 좌표를 막지 않도록
//   helper 와 동형으로 좌표 1 개 failed 로 수렴시킨다(택1 고정).
//
// build-time dependency-free 보장:
//   본 driver 는 `@Injectable` 이 아니며 `PeriodBridgeAdminPersistService` /
//   `PeriodBridgeEphemeralService` / `PrismaService` 인스턴스를 import 하지 않는다. person
//   해석(personId → ServiceIdentity DB 조회)과 영속 호출을 callable 인자(`resolvePerson` /
//   `persist`)로 받으므로 DB/DI/module 등록은 전부 호출자 책임으로 남고, 본 driver 의
//   빌드/unit 은 mock callable 로 완결된다 — resolver/persist 가 내부적으로 DB/LLM 을
//   쓰더라도 본 driver 의 unit test 는 mock callable 라 DB/LLM 네트워크 0 이다(live-LLM
//   standing 게이트 ADR-0045 와 무관).
//
// 경계(task Out of Scope):
//   - person 해석 실배선(personId → ServiceIdentity DB 조회 → `PeriodBridgePersonInput`) /
//     self-only RBAC / Admin 임의 personId — 후속 controller/orchestrator slice. 본 driver
//     는 `resolvePerson` callable 을 호출만 한다.
//   - `@Injectable` service 화 / DI 등록 / module provider 등록 — 후속 orchestrator slice.
//   - 입력 dedup(T-0551) — 본 driver 는 **이미 dedup 된** 좌표 배열을 받는다(재실행 0).
//   - `ScoringOptions` 도출 정책 — 호출자가 넘긴 options 를 factory 로 pass-through 만.
//   - POST /unevaluated-fill-run controller route / RBAC / run-request DTO — 후속 slice.
//   - e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice. 본 task 의 빌드/unit 은 mock.
//   - retry / batch abort / 재시도 / 동시성 정책 — 본 driver 는 순차 + 부분 실패 흡수만.
//
// 패턴 mirror: build-unevaluated-fill-coordinate-runner.ts / run-unevaluated-fill-coordinate.ts
// / dedupe-period-bridge-requests.ts(null/undefined·non-array fail-fast 한국어 `TypeError`
// (인덱스 포함) + 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable` 0,
// NestJS/Prisma/LLM/class-validator/repository import 0 — 타입들만 `import type`,
// `buildUnevaluatedFillCoordinateRunner` / `runUnevaluatedFillCoordinate` /
// `aggregateUnevaluatedFillRunResult` 만 value import. 새 외부 dependency 0.

import type { ScoringOptions } from "../evaluation-scoring.service";
import type { PeriodBridgePersonInput } from "../period-bridge-ephemeral.service";

import type { GenerateAndPersistFn } from "./build-unevaluated-fill-coordinate-runner";
import { buildUnevaluatedFillCoordinateRunner } from "./build-unevaluated-fill-coordinate-runner";
import type { PeriodBridgeDto } from "./period-bridge.dto";
import { runUnevaluatedFillCoordinate } from "./run-unevaluated-fill-coordinate";
import type {
  UnevaluatedFillRunOutcome,
  UnevaluatedFillRunResult,
} from "./unevaluated-fill-run-result";
import { aggregateUnevaluatedFillRunResult } from "./unevaluated-fill-run-result";

/**
 * 좌표 1 개(`PeriodBridgeDto`)를 받아 그 좌표의 resolved person(`PeriodBridgePersonInput`)을
 * 돌려주는 callable 타입 — 본 driver 의 `resolvePerson` 인자 타입.
 *
 * personId → ServiceIdentity DB 조회 / Person row 존재 검증 / self-only RBAC 는 본 driver
 * 밖(후속 controller/orchestrator slice)이며, resolver 가 그 책임을 캡슐화한다. 본 driver
 * 는 좌표마다 이 callable 을 호출만 한다(동기 반환·Promise 반환 둘 다 허용 — `await` 로
 * 통일 수렴). test 는 jest mock(`jest.fn()`)을 넘긴다.
 */
export type ResolvePersonFn = (
  bridge: PeriodBridgeDto,
) => Promise<PeriodBridgePersonInput> | PeriodBridgePersonInput;

/**
 * 이미 dedup 된 좌표 배열을 순차 순회하며 per-좌표 person 해석 → runner 조립(T-0559) →
 * 실행(T-0558) → 집계(T-0552)로 fold 하는 순수 loop driver(P5 bullet 106 / R-64 /
 * REQ-037 run-side 사슬의 loop 골격, Q-0045 옵션1).
 *
 * 동작(좌표마다 순서대로):
 *   (a) `person = await resolvePerson(bridge)` — person 해석. resolver reject 시 그 좌표를
 *       failed outcome(좌표 4 축 echo + reason)으로 흡수하고 다음 좌표로 넘어간다(batch
 *       abort 0 — helper 와 동형의 부분 실패 흡수).
 *   (b) `runner = buildUnevaluatedFillCoordinateRunner(bridge, person, options, persist)`
 *       (T-0559) — runner thunk 조립.
 *   (c) `outcome = await runUnevaluatedFillCoordinate(bridge, runner)`(T-0558) — outcome
 *       1 개 산출. helper 가 runner reject(persist 실패 / Invalid periodStart)를 failed
 *       outcome 으로 흡수하므로 본 driver 는 좌표 1 개 실패에 abort 하지 않는다.
 *   모은 outcome 배열(입력 순서·길이 일치)을 `aggregateUnevaluatedFillRunResult(outcomes)`
 *   (T-0552)에 넘겨 그 `UnevaluatedFillRunResult` 를 반환한다(집계 재구현 0 — 위임).
 *
 * 순차 순회(Promise.all 금지):
 *   for-of `await` 로 한 좌표 outcome 을 얻은 뒤 다음 좌표로 넘어간다 — 병렬 실행 금지(영속
 *   idempotency / 같은 person 중복 평가 race 회피 + outcomes 순서가 입력 좌표 순서와 항상
 *   일치하도록 결정적 직렬화).
 *
 * 비변형:
 *   입력 `bridges` 배열·각 `bridge` 객체·`options` 객체를 mutate 하지 않는다. 반환
 *   outcomes/result 는 새 배열/객체(집계는 T-0552 가 새 배열로 복사).
 *
 * 방어(fail-fast 한국어 TypeError — 순회 전):
 *   - `bridges` 가 null/undefined·non-array → `TypeError`(좌표 순회 불가라 순회 전 차단).
 *   - 배열 원소가 null/undefined → `TypeError`(인덱스 포함 — 그 좌표의 평가가 누락되지
 *     않도록 fail-fast).
 *   - `resolvePerson` / `persist` 가 함수가 아님(null/undefined/비-function) → 각
 *     `TypeError`(좌표마다 호출 불가능한 값을 흘리지 않도록 순회 전 차단).
 *   위 방어는 좌표를 흘리기 전에 평가되므로 영속 부수효과 0.
 *
 * @param bridges 이미 dedup 된 좌표 배열. 변형하지 않는다. null/undefined·non-array·원소
 *   null/undefined 시 한국어 `TypeError`(인덱스 포함).
 * @param resolvePerson 좌표 → resolved person 을 돌려주는 callable. 비-function 시 한국어
 *   `TypeError`. reject 는 좌표 단위 failed outcome 으로 흡수한다.
 * @param options scoring 옵션(modelId). factory 로 pass-through(modelId 결정은 호출자 책임).
 * @param persist 호출자가 바인딩한 `generateAndPersist`-shape callable. 비-function 시
 *   한국어 `TypeError`. factory 가 thunk 안에 캡슐화하며, 그 reject 는 helper 가 failed
 *   outcome 으로 흡수한다.
 * @returns `UnevaluatedFillRunResult` — outcomes(입력 순서·길이 일치) + status 별 집계.
 *   새 배열/객체.
 * @throws {TypeError} 위 순회-전 방어 조건 위반 시(한국어 메시지). 좌표 1 개 reject(person
 *   해석 / persist)는 throw 하지 않고 failed outcome 으로 흡수한다.
 */
export async function runUnevaluatedFillBatch(
  bridges: PeriodBridgeDto[],
  resolvePerson: ResolvePersonFn,
  options: ScoringOptions,
  persist: GenerateAndPersistFn,
): Promise<UnevaluatedFillRunResult> {
  // bridges 자체 방어 — null/undefined·non-array 면 한국어 메시지 TypeError 로 fail-fast
  // (silent 진행 시 아래 순회가 opaque TypeError 를 던지므로 명시적 메시지로 조기 노출,
  // dedupe-period-bridge-requests.ts 의 non-array 방어 패턴 mirror).
  if (!Array.isArray(bridges)) {
    throw new TypeError(
      `runUnevaluatedFillBatch: bridges 는 배열이어야 한다: ${String(bridges)}`,
    );
  }

  // resolvePerson 자체 방어 — 함수가 아니면(null/undefined/비-function) 아래 await 호출이
  // opaque TypeError 를 던지므로 순회 전 명시 메시지로 조기 노출(R-112 negative).
  if (typeof resolvePerson !== "function") {
    throw new TypeError(
      `runUnevaluatedFillBatch: resolvePerson 은 함수여야 한다: ${String(resolvePerson)}`,
    );
  }

  // persist 자체 방어 — 함수가 아니면 factory(T-0559)가 thunk 안에 호출 불가능한 값을
  // 캡슐화하지 않도록 순회 전 명시 메시지로 조기 노출(R-112 negative). factory 도 자체
  // 방어가 있으나, 본 driver 에서 좌표마다 동일 TypeError 가 반복되는 대신 순회 전 1 회로
  // 차단하는 게 호출자 친화적(좌표 0 개 흘림).
  if (typeof persist !== "function") {
    throw new TypeError(
      `runUnevaluatedFillBatch: persist 는 함수여야 한다: ${String(persist)}`,
    );
  }

  // 모은 outcome 배열 — 입력 좌표 순서·길이와 동일하게 좌표마다 1 개씩 push(순차 순회라
  // push 순서가 입력 순서와 항상 일치).
  const outcomes: UnevaluatedFillRunOutcome[] = [];

  // 좌표 순차 순회(for-of await — Promise.all 금지). 한 좌표 outcome 을 얻은 뒤 다음 좌표로
  // 넘어가 영속 idempotency race 회피 + 결정적 순서 보존.
  for (const [index, bridge] of bridges.entries()) {
    // 좌표 원소 방어 — null/undefined 면 한국어 메시지 TypeError(인덱스 포함)로 조기 노출
    // (silent skip 시 그 좌표 평가가 누락되므로 fail-fast 가 안전, dedupe 패턴 mirror).
    if (bridge === null || bridge === undefined) {
      throw new TypeError(
        `runUnevaluatedFillBatch: bridges[${index}] 좌표 원소가 null/undefined 일 수 없다.`,
      );
    }

    let person: PeriodBridgePersonInput;
    try {
      // (a) person 해석 — resolver 가 동기/Promise 어느 쪽이든 await 로 수렴.
      person = await resolvePerson(bridge);
    } catch (error) {
      // resolver reject 흡수 — person 해석 실패 1 개가 나머지 좌표를 막지 않도록 helper 와
      // 동형으로 좌표 1 개 failed outcome(좌표 4 축 echo + reason)으로 수렴(REQ-037 부분
      // 실패 흡수). reason 은 안전 직렬화(Error 면 message, 아니면 String(error)).
      const reason = error instanceof Error ? error.message : String(error);
      outcomes.push({
        personId: bridge.personId,
        period: bridge.period,
        scope: bridge.scope,
        periodStart: bridge.periodStart,
        status: "failed",
        reason,
      });
      // 다음 좌표로 — runner 조립/실행을 건너뛴다(person 없이 흘릴 수 없으므로).
      continue;
    }

    // (b) runner thunk 조립(T-0559) — persist reject / Invalid periodStart 는 thunk 실행
    // 시점에 reject 되어 (c) helper 가 흡수한다(lazy, 조립 시점 throw 0).
    const runner = buildUnevaluatedFillCoordinateRunner(
      bridge,
      person,
      options,
      persist,
    );

    // (c) outcome 1 개 산출(T-0558) — helper 가 runner reject 를 failed outcome 으로 흡수
    // 하므로 좌표 1 개 persist 실패에 batch 를 abort 하지 않는다(재던지지 않음).
    const outcome = await runUnevaluatedFillCoordinate(bridge, runner);
    outcomes.push(outcome);
  }

  // 모은 outcome 배열을 T-0552 집계에 위임해 fold(집계 재구현 0). outcomes 순서·길이는
  // 입력 좌표 배열과 일치한다(순차 순회 보장).
  return aggregateUnevaluatedFillRunResult(outcomes);
}
