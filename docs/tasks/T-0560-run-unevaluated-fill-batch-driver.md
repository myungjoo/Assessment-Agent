---
id: T-0560
title: 좌표 배열 → batch-run 요약 순수 loop driver (per-좌표 factory+helper 순회 + aggregate fold, person/persist 주입)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-21
hqOrigin: Q-0045
independentStream: unevaluated-fill-run
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/run-unevaluated-fill-batch.ts
  - src/assessment-evaluation/dto/run-unevaluated-fill-batch.spec.ts
plannerNote: "P5 bullet 106 / R-64 — Q-0045 옵션1 run-side chain slice(1) orchestrator 의 순수 loop 부분. dedup 좌표 배열 → per-좌표 T-0559 factory+T-0558 helper 순회 → T-0552 aggregate fold. person resolver/persist 를 callable 주입 → DB/@Injectable/module 등록은 후속. mock-unit, live-LLM 게이트 무관."
---

# T-0560 — 좌표 배열 → batch-run 요약 순수 loop driver (per-좌표 factory+helper 순회 + aggregate fold)

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 Q-0045 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 재개했다. dependency-free 순수/순수-ish 조각이 좌표 1 개 단위까지 전부 닫혔다 — 입력-side (T-0549..T-0551 dedup 까지), run-side 좌표 변환 (T-0556 `toEvaluationPersistContext`, T-0557 `toUnevaluatedFillRunOutcome`), 좌표 1 개 실행 helper (T-0558 `runUnevaluatedFillCoordinate`), 좌표 1 개 runner 조립 factory (T-0559 `buildUnevaluatedFillCoordinateRunner`, merge a63a692), 출력-side 집계 (T-0552 `aggregateUnevaluatedFillRunResult`).

남은 것은 backlogNote 의 **slice (1) loop-level orchestrator** 다 — dedup 된 `PeriodBridgeDto[]` 를 좌표별로 순회하며 per-좌표 person 해석 (DB) → T-0559 factory 로 runner thunk 조립 → T-0558 helper 호출 → T-0552 aggregate 로 fold + module 등록. 그러나 그 전체 orchestrator 를 한 task 로 묶으면 (`@Injectable` service + DB person 해석 + 좌표 순회 loop + DI 등록 + module provider + spec) cap (300 LOC / 5 파일) 을 넘고, 또 T-0556..T-0559 가 지킨 "순수 입력→출력 / mock-unit / build-time dependency-free / live-LLM 게이트 무관" 분리 규율 (ADR-0045 standing 게이트) 도 깨진다.

따라서 그 orchestrator 의 **순수 loop 부분만** 먼저 박제한다. 본 task 는 이미 dedup 된 좌표 배열 `PeriodBridgeDto[]` 와 **주입된 두 callable** (좌표 → resolved person 을 돌려주는 `resolvePerson` resolver, `generateAndPersist`-shape `persist`) 와 `ScoringOptions` 를 받아, 좌표마다 (a) `resolvePerson(bridge)` 로 person 을 얻고 (b) `buildUnevaluatedFillCoordinateRunner(bridge, person, options, persist)` (T-0559) 로 runner thunk 를 조립하고 (c) `runUnevaluatedFillCoordinate(bridge, runner)` (T-0558) 로 outcome 1 개를 산출한 뒤, 모든 outcome 을 입력 순서대로 모아 `aggregateUnevaluatedFillRunResult(outcomes)` (T-0552) 로 fold 한 `UnevaluatedFillRunResult` 를 반환하는 순수 loop driver `runUnevaluatedFillBatch(...)` 를 추가한다.

핵심은 **좌표 순회 + per-좌표 조각 배선 + fold** 라는 loop 골격을 단일 source 로 박제하는 것이다 — 후속 orchestrator slice 는 좌표 배열 map / per-좌표 try/catch / aggregate 호출을 inline 재구현 (순서 분실 / 부분 실패 흡수 누락 / aggregate 누락 risk) 하는 대신 본 driver 1 회 호출로 좌표 배열 → 요약을 닫는다.

**build-time dependency-free 보장**: 본 driver 는 `@Injectable` 이 아니며 `PeriodBridgeAdminPersistService` / `PeriodBridgeEphemeralService` / `PrismaService` 인스턴스를 import 하지 않는다. person 해석 (personId → ServiceIdentity DB 조회) 과 영속 호출을 **callable 인자** (`resolvePerson` / `persist`) 로 받으므로 DB/DI/module 등록은 전부 호출자 책임으로 남고, 본 driver 의 빌드/unit 은 mock callable 로 완결된다 — resolver/persist 가 내부적으로 DB/LLM 을 쓰더라도 본 driver 의 unit test 는 mock callable 라 DB/LLM 네트워크 0 이다. live-LLM standing 게이트 (ADR-0045) 와 무관하다.

기존 타입 (`PeriodBridgeDto` / `PeriodBridgePersonInput` / `ScoringOptions` / `UnevaluatedFillRunResult`) + T-0558/T-0559 조각 + T-0552 aggregate + T-0559 `GenerateAndPersistFn` 타입만 재사용하며 새 persistence/REQ-032/auth/dependency 경계를 도입하지 않으므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다.

## Required Reading

- `docs/tasks/T-0559-unevaluated-fill-coordinate-runner-factory.md` — 직전 runner 조립 factory slice 의 책임/방어/colocated spec 패턴 + 그 §Out of Scope 가 본 task (loop-level orchestrator 의 순수 부분) 로 넘긴 "배열 순회 / person 해석 / aggregate" 책임 명시.
- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts` — 본 driver 가 좌표마다 호출할 T-0559 factory `buildUnevaluatedFillCoordinateRunner(bridge, person, options, persist)` 와 그 callable 타입 `GenerateAndPersistFn` (본 driver 의 `persist` 인자 타입으로 재사용 — 새 타입 발명 0). 본 driver 는 이 factory 를 재구현하지 않고 호출한다.
- `src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.ts` — 본 driver 가 좌표마다 호출할 T-0558 helper `runUnevaluatedFillCoordinate(bridge, runner)` 와 thunk 타입 `UnevaluatedFillCoordinateRunner`. 본 driver 는 factory 가 돌려준 thunk 를 이 helper 에 넘겨 outcome 1 개를 얻는다 (재구현 0 — 위임). helper 가 reject 를 failed outcome 으로 흡수하므로 본 driver 는 좌표 1 개 실패에 abort 하지 않는다.
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` (82–110행 부근) — 출력 타입 `UnevaluatedFillRunResult` (outcomes + status 별 집계) 와 본 driver 가 fold 에 호출할 `aggregateUnevaluatedFillRunResult(outcomes)`. 본 driver 는 `UnevaluatedFillRunOutcome` / `UnevaluatedFillRunResult` 를 `import type`, `aggregateUnevaluatedFillRunResult` 만 value import.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 배열 원소 `PeriodBridgeDto` 의 4 좌표 축 (personId/period/scope/periodStart:string + 선택 reevaluate?:boolean). 본 driver 는 좌표를 변형 없이 factory/helper 로 흘려보낸다.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` (49–57행) — person 입력 타입 `PeriodBridgePersonInput` (`serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[]`). 본 driver 는 이 타입을 `import type` 재사용 — `resolvePerson` resolver 의 반환 타입. personId→ServiceIdentity DB 조회 자체는 호출자 (후속 controller/orchestrator) 책임이고 본 driver 는 resolver callable 을 호출만 한다.
- `src/assessment-evaluation/evaluation-scoring.service.ts` (46–49행) — `ScoringOptions = { modelId: string }`. 본 driver 는 이 타입을 `import type` 재사용 (호출자가 넘긴 options 를 factory 로 pass-through).
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — 배열 순회 + 결정성 (입력 순서 보존) + 비변형 + 한국어 `TypeError` (인덱스 포함) 방어 패턴 mirror. 본 driver 는 그 출력 (dedup 좌표 배열) 을 실행한 뒤 fold 한다.
- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.spec.ts` — colocated spec 의 happy/error/branch/negative/regression 구조 mirror (async driver 이므로 async test 형태).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/run-unevaluated-fill-batch.ts` 신설 — `async function runUnevaluatedFillBatch(bridges: PeriodBridgeDto[], resolvePerson: ResolvePersonFn, options: ScoringOptions, persist: GenerateAndPersistFn): Promise<UnevaluatedFillRunResult>` export. 여기서 `ResolvePersonFn` 은 `(bridge: PeriodBridgeDto) => Promise<PeriodBridgePersonInput> | PeriodBridgePersonInput` shape (좌표 → resolved person 을 돌려주는 callable — 본 파일에 type alias 정의). `GenerateAndPersistFn` 은 T-0559 의 export 타입을 `import type` 재사용 (새 타입 발명 0).
  - 좌표마다 순서대로: (a) `person = await resolvePerson(bridge)` 로 person 해석, (b) `runner = buildUnevaluatedFillCoordinateRunner(bridge, person, options, persist)` (T-0559) 로 runner thunk 조립, (c) `outcome = await runUnevaluatedFillCoordinate(bridge, runner)` (T-0558) 로 outcome 1 개 산출. 모든 outcome 을 **입력 좌표 배열과 동일 순서·동일 길이** 로 모은다.
  - 모은 outcome 배열을 `aggregateUnevaluatedFillRunResult(outcomes)` (T-0552) 에 넘겨 그 `UnevaluatedFillRunResult` 를 반환한다 (집계 재구현 0 — 위임).
  - 순회 방식 고정: 좌표를 **순차 (sequential, for-of `await`)** 로 처리한다 (병렬 `Promise.all` 금지 — 영속 idempotency / 같은 person 중복 평가 race 회피, 결정적 순서 보존). 이 결정을 코드 주석 + spec 으로 명시 고정한다.
  - 부분 실패 흡수: `runUnevaluatedFillCoordinate` 가 좌표 reject 를 failed outcome 으로 흡수하므로 본 driver 는 좌표 1 개 실패에 batch 를 abort 하지 않는다 (REQ-037 일괄 평가의 부분 실패 흡수 계승). 단 `resolvePerson(bridge)` 자체가 reject 하는 경우의 처리 정책은 명세대로 일관 고정한다 — 권장: resolver reject 도 좌표 단위 failed outcome 으로 흡수 (좌표 echo + reason) 해 batch 전체를 중단시키지 않는다. (resolver 의 throw 를 helper 와 동형으로 좌표 1 개 failed 로 수렴 — 좌표 1 개 person 해석 실패가 나머지 좌표를 막지 않도록.) 택1해 주석·spec 으로 일관 고정.
  - 입력 `bridges` 배열·각 `bridge` 객체·`options` 객체를 mutate 하지 않는다 (반환 outcomes/result 는 새 배열/객체).
  - `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — 위 타입들만 `import type`, `buildUnevaluatedFillCoordinateRunner` / `runUnevaluatedFillCoordinate` / `aggregateUnevaluatedFillRunResult` 만 value import (새 외부 dependency 0).
- [ ] happy-path unit test: (a) 다중 좌표 (예: evaluated 1 + skipped 1 + failed 1 을 유발하는 mock persist/resolver) 배열 → 반환 `UnevaluatedFillRunResult` 의 `outcomes` 가 입력 좌표 순서·길이와 일치하고 status 별 집계 (`evaluatedCount`/`skippedCount`/`failedCount`/`totalCount`) 가 정확 1+; (b) 좌표마다 `resolvePerson` 이 정확히 1 회씩 그 좌표로 호출되고, `persist` 가 각 좌표의 5 인자로 호출됨 1+; (c) 빈 배열 `[]` → 빈 outcomes + 모든 카운트 0 인 `UnevaluatedFillRunResult` 1+.
- [ ] error path unit test: `bridges` 가 null/undefined·non-array 일 때 한국어 `TypeError` fail-fast 1+; 배열 원소가 null/undefined 일 때 한국어 `TypeError` (인덱스 포함) 1+; `resolvePerson` / `persist` 가 함수가 아닐 때 (null/undefined/비-function) 각 한국어 `TypeError` 1+.
- [ ] flow / branch coverage: 입력 방어 분기 (bridges null / non-array / 원소 null / resolvePerson 비-function / persist 비-function) 각 1+; 좌표 결과 분기 (evaluated 수렴 / skipped 수렴 / persist reject → failed 흡수 / resolvePerson reject → failed 흡수[명세 고정대로]) 각 1+; 빈 배열 vs 비어있지 않은 배열 분기 각 1+ test. 순차 순회로 outcomes 순서가 입력과 일치하는 분기 1+.
- [ ] negative cases 충분 cover: null/undefined/non-array bridges, 원소 null/undefined, 비-function resolvePerson, 비-function persist, persist 가 reject 하는 좌표가 섞인 배열 (그 좌표만 failed, 나머지 정상 — 부분 실패 흡수), resolvePerson 이 reject 하는 좌표가 섞인 배열 (명세 고정대로 그 좌표만 failed), 입력 비변형 (호출 후 bridges 배열 길이·각 bridge/options 객체 unchanged 단언), 반환 outcomes 가 입력과 별개 새 배열 단언, `Promise.all` 병렬 아님 (좌표 실행이 순차임을 호출 순서로 단언 — 예: resolvePerson 호출 순서가 입력 순서와 일치) — 예외/경계 상황마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] regression test (hqOrigin Q-0045): 좌표 1 개 persist reject 시 batch 가 abort 하지 않고 나머지 좌표를 끝까지 처리하는지 (abort 하면 fail 하는 test) 1+; outcomes 순서가 입력 좌표 순서와 어긋나면 fail 하는 test 1+; 좌표 N 개 입력 시 outcomes 길이가 정확히 N 임 (좌표 누락/중복 시 fail) 1+ — Q-0045 run-side chain 의 부분 실패 흡수 + 순서/길이 무결성 회귀 방지.
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/run-unevaluated-fill-batch.spec.ts` (driver 와 같은 디렉토리). describe/it 라벨 한국어 명확화 (§12). `resolvePerson` / `persist` 는 jest mock 함수 (`jest.fn().mockResolvedValue(...)` / `.mockRejectedValue(...)`), `person` / `options` / `PeriodBridgeAdminPersistResult` 는 plain 객체 stub (실 service/LLM/DB 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표).

## Out of Scope

- person 해석 실배선 (personId → ServiceIdentity DB 조회 → `PeriodBridgePersonInput`) — 본 driver 는 `resolvePerson` callable 을 호출만 한다. DB 조회 / Person row 존재 검증 / self-only RBAC (personId 동등성) / Admin 임의 personId 는 후속 controller/orchestrator slice 책임.
- `PeriodBridgeAdminPersistService` 인스턴스 import / `@Injectable` service 화 / DI 등록 / module provider 등록 — 본 driver 는 순수 함수 (callable-as-param). service 화/등록은 후속 orchestrator slice.
- 입력 dedup (T-0551 `dedupePeriodBridgeRequests`) 호출 — 본 driver 는 **이미 dedup 된** 좌표 배열을 받는다 (dedup 은 입력-side 조각 책임). 좌표 중복 제거를 driver 안에서 재실행하지 않는다.
- `ScoringOptions` (modelId 등) 도출 정책 — 본 driver 는 호출자가 넘긴 options 를 factory 로 pass-through 만. modelId 결정/기본값은 호출자 책임.
- POST /unevaluated-fill-run controller route / RBAC / run-request DTO 신설 — 후속 slice.
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice (live-LLM 배선검증은 ADR-0045 standing 게이트, LAN 수동 1 회, 만료 2026-06-30). 본 task 의 빌드/unit 은 mock callable 라 DB/LLM 0.
- retry / batch abort / 재시도 / 동시성 정책 — 본 driver 는 순차 + 부분 실패 흡수만. retry 는 (필요 시) 후속 orchestrator 정책.
- `EvaluationResult` 타입 직접 import / 평가문 본문 보유 (REQ-032 raw-not-stored 정합) — 0. 본 driver 는 좌표/outcome/집계만 다룬다.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append.)

남은 chain slice (참고 — 본 task 완료 후 planner 가 순차 큐잉):
1. loop-level impure orchestrator (`@Injectable` service): person 해석 (personId → ServiceIdentity DB 조회 → `PeriodBridgePersonInput`) 실배선 + `generateAndPersist` 바인딩 + 본 driver(T-0560) 호출 + module 등록. (live-LLM 배선검증 동반 가능 — 단 빌드/unit 은 mock.)
2. POST /unevaluated-fill-run controller route + RBAC + run-request DTO.
3. e2e (실 PostgreSQL; LLM 은 mock 또는 LAN 수동 1 회 배선검증).
