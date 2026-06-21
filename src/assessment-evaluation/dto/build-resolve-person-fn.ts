// build-resolve-person-fn — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" /
// REQ-038) run-side 사슬의 person-해석 조립 순수 조각. Q-0045 옵션1(impure run
// orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서, 직전 T-0560
// (merge aba0736)이 좌표 배열 → batch-run 요약 순수 loop driver
// `runUnevaluatedFillBatch(bridges, resolvePerson, options, persist)` 를 닫았다. 그
// driver 는 좌표마다 `person = await resolvePerson(bridge)` 로 person 을 해석하지만,
// `resolvePerson` callable 자체의 조립은 호출자 책임으로 남겼다(driver 는
// `ResolvePersonFn` 을 인자로 받기만 한다).
//
// 책임:
//   `findByIdWithIdentities`-shape lookup callable(personId → person row 또는 null 을
//   돌려주는 callable)을 받아, T-0560 driver 가 소비하는 `ResolvePersonFn`
//   (= `(bridge: PeriodBridgeDto) => Promise<PeriodBridgePersonInput>`)을 조립해
//   반환하는 dependency-free 순수 factory. 반환 resolver 는 좌표 1 개를 받아 순서대로:
//     (a) `row = await lookup(bridge.personId)` 로 person row 조회(lookup 이 동기/Promise
//         어느 쪽이든 await 로 수렴),
//     (b) row 가 null/undefined 면 personId 를 포함한 한국어 `Error` 를 던진다(T-0560
//         driver 가 좌표 단위 failed outcome 으로 흡수 — `reason` 에 그 message 가 담김.
//         한 좌표의 person 부재가 나머지 좌표를 막지 않음, REQ-037 부분 실패 흡수),
//     (c) row 가 있으면 `{ serviceIdentities: row.serviceIdentities }` 로 narrow 한
//         `PeriodBridgePersonInput`(새 객체)을 반환한다.
//   이로써 후속 orchestrator 는 좌표마다 lookup + null 검사 + narrow 를 inline
//   재구현(null→throw 정책 분산 / serviceIdentities narrow 누락 risk)하는 대신 본 factory
//   1 회 호출로 `ResolvePersonFn` 을 얻어 T-0560 driver 에 바로 넘긴다
//   (`runUnevaluatedFillBatch(bridges, buildResolvePersonFn(lookup), options, persist)`).
//
// lazy 평가(시점 결정 — load-bearing):
//   factory 자체는 **인자 조립만** 하고 `lookup` 을 호출하지 않는다(호출은 반환된 resolver
//   가 좌표마다 await 될 때). factory 호출만으로는 lookup 부수효과 0.
//
// null-row → 흡수가능 Error(load-bearing):
//   row 부재 시 던지는 값은 `Error` 인스턴스이고 message 에 personId 가 담긴다 — T-0560
//   driver 의 좌표 단위 failed 흡수가 `reason = error instanceof Error ? error.message :
//   String(error)` 로 직렬화하므로(run-unevaluated-fill-batch.ts 188–207행), 본 resolver
//   의 throw 는 batch 를 abort 시키지 않고 그 좌표의 failed reason 으로 흡수된다. HTTP
//   status 매핑(404 등)은 본 resolver 밖 — 후속 controller slice 책임.
//
// 타입 narrow(과잉 노출 회귀 방지):
//   person row(`PersonWithIdentities` — id/fullName/email/createdAt 등 전체 Prisma Person
//   필드 보유)에서 `serviceIdentities` 만 골라 `PeriodBridgePersonInput` 으로 narrow 한다.
//   id/fullName/email 등은 누설하지 않는다(`PeriodBridgePersonInput` 계약 무결성 — collect
//   spec 의 GitHub instance 매칭 + author 귀속 key 외 PII 비노출).
//
// build-time dependency-free 보장:
//   본 factory 는 `@Injectable` 이 아니며 `PersonService` / `PersonRepository` /
//   `PrismaService` 인스턴스를 import 하지 않는다. DB 조회를 lookup callable 인자(personId
//   → person row)로 받으므로 DB/DI/module 등록은 전부 호출자 책임으로 남고, 본 factory 의
//   빌드/unit 은 mock lookup callable 로 완결된다 — lookup 이 내부적으로 DB 를 쓰더라도 본
//   factory 의 unit test 는 mock callable 라 DB 네트워크 0 이다(live-LLM standing 게이트
//   ADR-0045 와 무관).
//
// 패턴 mirror: build-unevaluated-fill-coordinate-runner.ts(callable-as-param fail-fast
// 한국어 `TypeError` + lazy + 비변형 + @Injectable 0 + Prisma/LLM import 0). 순수성:
// `@Injectable` 0, NestJS/Prisma/LLM/class-validator/repository import 0 — 타입들만
// `import type`, value import 0. 새 외부 dependency 0.

import type { PersonWithIdentities } from "../../user/person.repository";
import type { PeriodBridgePersonInput } from "../period-bridge-ephemeral.service";

import type { PeriodBridgeDto } from "./period-bridge.dto";
import type { ResolvePersonFn } from "./run-unevaluated-fill-batch";

/**
 * personId 로 person row(serviceIdentities include)를 조회하는 lookup callable 타입 —
 * `PersonRepository.findByIdWithIdentities(id)` 시그니처 mirror. row 부재 시 null 을
 * 돌려준다(throw 안 함 — null-safe API). 동기/Promise 어느 쪽이든 허용(resolver 가 await
 * 로 수렴). 호출자는 `repo.findByIdWithIdentities.bind(repo)` 또는 동등 wrapper 를 넘기고,
 * test 는 jest mock(`jest.fn()`)을 넘긴다. repository **인스턴스** import 0 — callable
 * 만 받는다.
 */
export type PersonLookupFn = (
  personId: string,
) => Promise<PersonWithIdentities | null> | (PersonWithIdentities | null);

/**
 * `findByIdWithIdentities`-shape lookup callable 을 받아 T-0560 driver 가 소비하는
 * `ResolvePersonFn`(좌표 1 개 → resolved person)을 조립해 반환하는 dependency-free 순수
 * factory(P5 bullet 106 / R-64 / REQ-037 run-side 사슬 조각, Q-0045 옵션1).
 *
 * 반환 resolver 의 동작(좌표마다 await 될 때):
 *   - (a) `row = await lookup(bridge.personId)` — person row 조회(동기/Promise 수렴).
 *   - (b) row 가 null/undefined → personId 를 포함한 한국어 `Error` throw(person 부재).
 *     T-0560 driver 가 좌표 단위 failed outcome 으로 흡수(reason = error.message).
 *   - (c) row 가 있으면 `{ serviceIdentities: row.serviceIdentities }` 로 narrow 한
 *     `PeriodBridgePersonInput`(새 객체) 반환. id/fullName/email 등 비노출.
 *
 * lazy 평가:
 *   factory 호출은 인자 조립만 하고 `lookup` 을 호출하지 않는다(호출은 반환된 resolver 가
 *   좌표마다 await 될 때). 따라서 factory 호출만으로는 lookup 부수효과 0.
 *
 * 비변형:
 *   입력 `bridge` 객체와 `lookup` 이 돌려준 row 를 mutate 하지 않는다. 반환
 *   `PeriodBridgePersonInput` 은 새 객체이며 row.serviceIdentities 배열 참조를 그대로
 *   echo 한다(배열 자체를 복제하지 않으나 narrow 객체는 별개).
 *
 * 방어(fail-fast 한국어 `TypeError`):
 *   - `lookup` 이 함수가 아님(null/undefined/비-function) → factory 조립 시점에 `TypeError`
 *     (resolver 가 호출 불가능한 값을 캡슐화하지 않도록 조립 전 차단).
 *   - resolver 호출 시점의 `bridge` 가 null/undefined → `bridge.personId` 접근 전 한국어
 *     `TypeError`(좌표 접근 불가).
 *
 * @param lookup personId → person row(또는 null) 를 돌려주는 callable. 비-function 시
 *   한국어 `TypeError`(조립 시점). factory 는 호출하지 않고 resolver 안에 캡슐화만 한다.
 * @returns `ResolvePersonFn` — await 시 `lookup(bridge.personId)` 로 row 조회 후 narrow 한
 *   `PeriodBridgePersonInput` 을 반환하거나(row 있음), person 부재 시 한국어 `Error` reject.
 * @throws {TypeError} `lookup` 이 비-function 일 때(한국어 메시지, factory 조립 시점).
 */
export function buildResolvePersonFn(lookup: PersonLookupFn): ResolvePersonFn {
  // lookup 자체 방어 — 함수가 아니면(null/undefined/비-function) resolver 가 호출 불가능한
  // 값을 캡슐화하게 되므로 조립 시점에 명시 메시지로 조기 노출(build-unevaluated-fill-
  // coordinate-runner.ts 의 persist 방어 패턴 mirror, R-112 negative).
  if (typeof lookup !== "function") {
    throw new TypeError(
      `buildResolvePersonFn: lookup 은 함수여야 한다: ${String(lookup)}`,
    );
  }

  // resolver — person 해석은 await 시점에 수행(lazy). `async` 로 선언해 본문의 동기
  // throw(특히 null-row 의 person 부재 Error)도 reject 로 전파되도록 한다 — T-0560 driver
  // 가 `await resolvePerson(bridge)` 의 reject 를 try/catch 로 잡아 failed outcome 으로
  // 흡수할 수 있게(좌표 배열 순회 자체는 중단되지 않음, REQ-037 부분 실패 흡수).
  return async (bridge: PeriodBridgeDto): Promise<PeriodBridgePersonInput> => {
    // 좌표 자체 방어 — null/undefined 면 아래 bridge.personId 접근이 opaque TypeError 를
    // 던지므로 명시 메시지로 조기 노출(인덱스 없이 좌표 null 메시지 — 좌표 1 개 단위).
    if (bridge === null || bridge === undefined) {
      throw new TypeError(
        `buildResolvePersonFn: bridge 좌표가 null/undefined 일 수 없다: ${String(bridge)}`,
      );
    }

    // (a) person row 조회 — lookup 이 동기/Promise 어느 쪽이든 await 로 수렴.
    const row = await lookup(bridge.personId);

    // (b) row 부재(null/undefined) → personId 를 포함한 한국어 Error throw. T-0560 driver
    // 가 좌표 단위 failed outcome 으로 흡수(reason = error.message). 한 좌표의 person
    // 부재가 나머지 좌표를 막지 않는다(REQ-037 부분 실패 흡수). HTTP 404 매핑은 본 resolver
    // 밖(후속 controller slice) — 여기서는 흡수가능 Error 만 던진다.
    if (row === null || row === undefined) {
      throw new Error(
        `buildResolvePersonFn: personId '${bridge.personId}' 에 해당하는 person 을 찾을 수 없다.`,
      );
    }

    // (c) row → narrow. serviceIdentities 만 골라 PeriodBridgePersonInput(새 객체)으로
    // 수렴 — id/fullName/email 등 전체 Person 필드는 누설하지 않는다(계약 무결성).
    return { serviceIdentities: row.serviceIdentities };
  };
}
