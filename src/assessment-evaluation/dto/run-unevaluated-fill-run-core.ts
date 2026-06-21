// run-unevaluated-fill-run-core — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) run-side 사슬의 dependency-free orchestration core. Q-0045 옵션1
// (impure run orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서, 직전
// 까지 입력-side(T-0549..T-0551 dedup)·run-side 좌표 변환/실행/집계(T-0556..T-0560)·
// person 해석(T-0561)·options 도출(T-0562, merge 0445061)이 dependency-free 조각으로
// 전부 닫혔다. 본 core 는 그 조각들 중 loop-level orchestration 에 필요한 **dedup →
// options → batch** 3 단계를 단일 순수 함수로 묶는 마지막 조립 골격이다.
//
// 책임:
//   raw 좌표 배열(`PeriodBridgeDto[]`)·이미 바인딩된 두 callable(좌표 → resolved person
//   resolver `resolvePerson`, `generateAndPersist`-shape `persist`)·run-request 가 넘긴
//   선택적 `requestModelId` + default `defaultModelId` 를 받아, 순서대로:
//     (a) `options = buildFillRunScoringOptions(requestModelId, defaultModelId)`(T-0562)로
//         검증된 `ScoringOptions` 도출(빈 modelId 흘림 차단),
//     (b) `deduped = dedupePeriodBridgeRequests(rawBridges)`(T-0551)로 좌표 first-wins
//         중복 제거,
//     (c) `return runUnevaluatedFillBatch(deduped, resolvePerson, options, persist)`(T-0560)
//         로 좌표 배열 → `UnevaluatedFillRunResult` 위임.
//   dedup·options 도출·집계 재구현 0 — 전부 기존 helper 위임. 이로써 후속 loop-level
//   `@Injectable` orchestrator slice 는 dedup 누락 / options 도출 분산 / 단계 순서 분실
//   risk 의 inline 재구현 대신 본 core 1 회 호출(`runUnevaluatedFillRunCore(rawBridges,
//   resolvePerson, persist, request.modelId, defaultModelId)`)로 닫는다.
//
// 단계 순서 고정(load-bearing):
//   options 도출(a)과 dedup(b) 중 어느 것이든 throw 가능하다 — default·request modelId 가
//   모두 빈 값이면 `buildFillRunScoringOptions` 가 한국어 `TypeError`, rawBridges 가
//   non-array(또는 원소 null/undefined)이면 `dedupePeriodBridgeRequests` 가 한국어
//   `TypeError`. 본 core 는 이 fail-fast throw 를 **흡수하지 않고 그대로 전파**한다 —
//   좌표를 batch 로 흘리기 전(영속 부수효과 발생 전)에 차단하기 위함이다. options 를 dedup
//   보다 먼저 도출하므로 modelId 무효는 좌표를 단 1 개도 dedup/흘리기 전에 차단된다.
//   좌표 1 개 단위의 person 해석 / persist reject 흡수(REQ-037 부분 실패)는
//   `runUnevaluatedFillBatch`(T-0560)가 이미 책임지므로 본 core 는 그 결과를
//   pass-through 만 한다(흡수 정책 재구현 0).
//
// build-time dependency-free 보장:
//   본 core 는 `@Injectable` 이 아니며 `PeriodBridgeAdminPersistService` / `PrismaService`
//   / LLM gateway 인스턴스를 import 하지 않는다. person 해석(personId → ServiceIdentity
//   DB 조회)과 영속 호출을 callable 인자(`resolvePerson` / `persist`)로 받으므로 DB/DI/
//   module 등록은 전부 호출자(후속 `@Injectable` slice) 책임으로 남고, 본 core 의
//   빌드/unit 은 mock callable 로 완결된다(resolver/persist 가 내부적으로 DB/LLM 을
//   쓰더라도 본 core 의 unit test 는 mock callable 라 DB/LLM 네트워크 0).
//
// 경계(task Out of Scope):
//   - `@Injectable` orchestrator service 화 / DI 등록 / module provider 등록 — 후속 slice.
//   - personId → ServiceIdentity DB 조회 실배선 / `resolvePerson` 의 lookup 을 실
//     `PersonRepository` 에 바인딩 — 후속 `@Injectable` slice. 본 core 는 callable 호출만.
//   - `generateAndPersist` 를 실 `PeriodBridgeAdminPersistService` 에 바인딩 — 후속 slice.
//     본 core 는 `persist` callable 을 인자로 받기만 한다.
//   - POST /unevaluated-fill-run controller route / RBAC(self-only · Admin) / run-request
//     DTO 신설 — 후속 slice. 본 core 는 raw 입력만 받는다.
//   - e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice. 본 task 의 빌드/unit 은 mock.
//   - 상류 mapper(T-0549/T-0550)·dedup(T-0551)·batch(T-0560)·options(T-0562) 로직 수정 —
//     본 core 는 이들을 호출만 한다(재구현 / 변경 0).
//   - retry / batch abort / 동시성 정책 — 본 core 는 위임 조립만.
//
// 패턴 mirror: run-unevaluated-fill-batch.ts / build-fill-run-scoring-options.ts /
// dedupe-period-bridge-requests.ts(fail-fast 한국어 `TypeError` 전파 + 비변형 +
// @Injectable 0 + Prisma/LLM import 0). 순수성: `@Injectable` 0, NestJS/Prisma/LLM/
// class-validator/repository import 0 — 타입들만 `import type`, `dedupePeriodBridgeRequests`
// / `buildFillRunScoringOptions` / `runUnevaluatedFillBatch` 3 개만 value import. 새 외부
// dependency 0.

import { buildFillRunScoringOptions } from "./build-fill-run-scoring-options";
import type { GenerateAndPersistFn } from "./build-unevaluated-fill-coordinate-runner";
import { dedupePeriodBridgeRequests } from "./dedupe-period-bridge-requests";
import type { PeriodBridgeDto } from "./period-bridge.dto";
import {
  runUnevaluatedFillBatch,
  type ResolvePersonFn,
} from "./run-unevaluated-fill-batch";
import type { UnevaluatedFillRunResult } from "./unevaluated-fill-run-result";

/**
 * raw 좌표 배열 + 바인딩된 callable(resolvePerson / persist) + modelId 입력을 받아
 * dedup → options 도출 → batch 위임을 묶는 dependency-free 순수 orchestration core
 * (P5 bullet 106 / R-64 / REQ-037·038 run-side 사슬, Q-0045 옵션1).
 *
 * 동작(순서 고정):
 *   1. `options = buildFillRunScoringOptions(requestModelId, defaultModelId)`(T-0562) —
 *      검증된 `ScoringOptions` 도출. request 우선 / default fallback / 둘 다 빈 값이면
 *      한국어 `TypeError` 전파(좌표를 흘리기 전 차단).
 *   2. `deduped = dedupePeriodBridgeRequests(rawBridges)`(T-0551) — 좌표 first-wins 중복
 *      제거. rawBridges non-array·원소 null/undefined 시 한국어 `TypeError` 전파.
 *   3. `return runUnevaluatedFillBatch(deduped, resolvePerson, options, persist)`(T-0560) —
 *      좌표 배열 순차 순회 → person 해석 → runner 조립 → 실행 → 집계 위임. 좌표 1 개 단위
 *      person/persist reject 는 batch 가 failed outcome 으로 흡수하므로 본 core 는
 *      그 결과를 pass-through 만 한다.
 *
 * 순서가 load-bearing 인 이유: options 도출(1)을 dedup(2)보다 먼저 두어 modelId 무효는
 * 좌표를 단 1 개도 dedup/흘리기 전에 차단한다(영속 부수효과 0). 두 단계의 fail-fast throw
 * 는 흡수하지 않고 그대로 전파한다 — 부분 실패 흡수는 좌표 단위(batch 책임)이지 입력 형식
 * 위반(차단 대상)이 아니다.
 *
 * 비변형: 입력 `rawBridges` 배열·각 좌표 객체를 mutate 하지 않는다(dedup 이 새 배열 반환,
 * 보존 원소는 입력 참조 재사용). 반환 result 는 batch 가 만든 새 객체.
 *
 * @param rawBridges run-request 가 넘긴 raw 좌표 배열(dedup 전). non-array·원소
 *   null/undefined 시 `dedupePeriodBridgeRequests` 의 한국어 `TypeError` 전파.
 * @param resolvePerson 좌표 → resolved person 을 돌려주는 callable(이미 바인딩됨). 비-function
 *   시 `runUnevaluatedFillBatch` 의 한국어 `TypeError` 전파. reject 는 좌표 단위 failed
 *   outcome 으로 batch 가 흡수한다.
 * @param persist 호출자가 바인딩한 `generateAndPersist`-shape callable. 비-function 시
 *   `runUnevaluatedFillBatch` 의 한국어 `TypeError` 전파. reject 는 batch 가 흡수한다.
 * @param requestModelId run-request 가 넘긴 선택적 modelId(string | undefined | null).
 *   유효 non-empty 면 우선 채택, 빈 값이면 default fallback. 비-string type 은
 *   `buildFillRunScoringOptions` 의 한국어 `TypeError` 전파.
 * @param defaultModelId default modelId(string). request 가 비어있을 때 fallback 대상.
 *   request 도 비어있고 default 도 무효(빈/whitespace)면 한국어 `TypeError` 전파.
 * @returns `UnevaluatedFillRunResult` — outcomes(dedup 된 좌표 순서·길이 일치) + status 별
 *   집계. batch 가 만든 새 객체.
 * @throws {TypeError} options 도출(request/default 무효) 또는 dedup(rawBridges non-array·
 *   원소 null/undefined) 또는 batch 입력 방어(resolvePerson/persist 비-function) 위반 시
 *   (한국어 메시지). 좌표 1 개 단위 person/persist reject 는 throw 하지 않고 batch 가
 *   failed outcome 으로 흡수한다.
 */
export async function runUnevaluatedFillRunCore(
  rawBridges: PeriodBridgeDto[],
  resolvePerson: ResolvePersonFn,
  persist: GenerateAndPersistFn,
  requestModelId: string | undefined | null,
  defaultModelId: string,
): Promise<UnevaluatedFillRunResult> {
  // (a) options 도출 먼저 — modelId 무효(request·default 모두 빈 값 / type mismatch)면
  // 좌표를 단 1 개도 dedup/흘리기 전에 한국어 TypeError 로 차단(영속 부수효과 0).
  const options = buildFillRunScoringOptions(requestModelId, defaultModelId);

  // (b) 좌표 first-wins 중복 제거 — rawBridges non-array·원소 null/undefined 면 한국어
  // TypeError 전파(흡수 0). 같은 좌표를 두 번 평가·영속하는 낭비를 batch 전에 제거한다.
  const deduped = dedupePeriodBridgeRequests(rawBridges);

  // (c) 좌표 배열 → 요약 위임(T-0560) — 순차 순회 + 좌표 단위 부분 실패 흡수는 batch 책임.
  // 본 core 는 그 결과를 pass-through 만 한다(집계 재구현 0).
  return runUnevaluatedFillBatch(deduped, resolvePerson, options, persist);
}
