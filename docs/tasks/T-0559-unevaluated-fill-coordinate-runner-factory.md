---
id: T-0559
title: 좌표 1개 → 영속 runner thunk 조립 순수 factory (context/period/options/reevaluate 인자 결정 + generateAndPersist 바인딩)
phase: P5
status: DONE
mergedAs: a63a692
prNumber: 474
completedAt: 2026-06-21T09:52Z
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-21
hqOrigin: Q-0045
independentStream: unevaluated-fill-run
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts
  - src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.spec.ts
plannerNote: "P5 bullet 106 / R-64 — Q-0045 옵션1 run-side chain 다음 slice. 좌표 1개 → generateAndPersist 인자(context T-0556/period/options/reevaluate) 결정 + 바인딩한 runner thunk 조립 순수 factory. orchestrator wiring/DI/module 등록은 후속. live-LLM 게이트 무관(mock-unit)."
---

# T-0559 — 좌표 1개 → 영속 runner thunk 조립 순수 factory

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 Q-0045 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 재개했다. 직전 T-0558 (merge 80bcfec) 이 좌표 1 개 + `runner` thunk → `UnevaluatedFillRunOutcome` 1 개 실행 helper `runUnevaluatedFillCoordinate(bridge, runner)` 를 닫았다. 그 helper 는 영속 호출을 **추상화한 `runner: () => Promise<PeriodBridgeAdminPersistResult>`** 를 인자로 받으며, 그 thunk 안에 캡슐화될 **person 해석 / `ScoringOptions` 도출 / `period.since` 도출 / `context`(T-0556) 조립 / `reevaluate` 결정** 은 명시적으로 호출자 (후속 orchestrator) 책임으로 남겼다 (T-0558 §Out of Scope).

남은 것은 그 runner thunk 를 **결정적으로 조립**하는 조각이다. 전체 loop-level orchestrator (`@Injectable` service: dedup 된 `PeriodBridgeDto[]` 순회 → per-좌표 person 해석(DB) → 본 인자 조립 → `generateAndPersist` 바인딩 → T-0558 helper 호출 → `aggregateUnevaluatedFillRunResult`(T-0552) + module 등록 + spec) 는 cap (300 LOC / 5 파일) 을 넘는다. 따라서 가장 작은 **순수** 단위 — **좌표 1 개 + resolved person + 영속 callable → runner thunk 1 개 조립** — 을 먼저 박제한다.

본 task 는 좌표 1 개 (`PeriodBridgeDto`) + 이미 해석된 person (`PeriodBridgePersonInput`) + scoring 옵션 (`ScoringOptions`) + `generateAndPersist`-shape callable 을 받아, `PeriodBridgeAdminPersistService.generateAndPersist(person, period, options, context, reevaluate)` 의 5 인자를 좌표에서 결정적으로 도출 (`context` 는 T-0556 `toEvaluationPersistContext` 위임, `period.since` 는 `periodStart` echo, `reevaluate` 는 `bridge.reevaluate` 결정) 한 뒤 그 호출을 캡슐화한 **runner thunk** 를 반환하는 dependency-free 순수 factory `buildUnevaluatedFillCoordinateRunner(...)` 를 추가한다. 이로써 후속 orchestrator 는 좌표마다 인자 조립을 inline 재구현 (context 도출 누락 / since echo 분산 risk) 하는 대신 본 factory 1 회 호출로 thunk 를 얻어 T-0558 helper 에 바로 넘긴다 (`runUnevaluatedFillCoordinate(bridge, buildUnevaluatedFillCoordinateRunner(...))`).

**build-time dependency-free 보장**: 본 factory 는 `@Injectable` 이 아니며 `PeriodBridgeAdminPersistService` 인스턴스를 import 하지 않는다. 영속 호출을 **callable 인자** (`generateAndPersist`-shape 함수) 로 받으므로 service DI / person 해석 (DB) / module 등록은 전부 호출자 책임으로 남고, 본 factory 의 빌드/unit 은 mock callable 로 완결된다 — `generateAndPersist` 가 내부적으로 LLM/DB 를 쓰더라도 본 factory 의 unit test 는 callable 을 호출조차 하지 않고 (thunk 만 조립) 또는 mock callable 을 호출하므로 LLM 네트워크 0 이다. live-LLM standing 게이트 (ADR-0045) 와 무관하다.

기존 ADR-0037 (bridge) + ADR-0038 (reevaluate) + 기존 타입 (`PeriodBridgeDto` / `PeriodBridgePersonInput` / `ScoringOptions` / `EvaluationPersistContext` / `PeriodBridgeAdminPersistResult`) + T-0556 매퍼만 재사용하며 새 persistence/REQ-032/auth/dependency 경계를 도입하지 않으므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다.

## Required Reading

- `docs/tasks/T-0558-unevaluated-fill-run-coordinate.md` — 직전 실행 helper slice 의 `runner` thunk contract (`() => Promise<PeriodBridgeAdminPersistResult>`) 와 그 §Out of Scope 가 본 task 로 넘긴 "person 해석 / 인자 조립 / runner 조립" 책임 명시.
- `src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.ts` (56–58행) — 본 factory 가 반환할 thunk 타입 `UnevaluatedFillCoordinateRunner = () => Promise<PeriodBridgeAdminPersistResult>` 정의. 본 factory 는 이 타입을 재사용 (새 타입 발명 0) 하고 그 thunk 를 반환한다.
- `src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.ts` — 본 factory 가 `context` 인자 도출에 **위임**할 T-0556 `toEvaluationPersistContext(bridge)` (좌표 → `EvaluationPersistContext`, periodStart string→Date + Invalid Date 거부). 본 factory 는 이 매퍼를 재구현하지 않고 호출한다.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 `PeriodBridgeDto` 의 4 좌표 축 (personId/period/scope/periodStart:string) + 선택 `reevaluate?:boolean`. `period.since` 는 `periodStart` 에서 echo, `reevaluate` 인자는 `bridge.reevaluate` 에서 결정.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` (60–136행) — 본 factory 가 바인딩할 `generateAndPersist(person, period: { since?: string }, options: ScoringOptions, context: EvaluationPersistContext, reevaluate?: boolean): Promise<PeriodBridgeAdminPersistResult>` 의 5 인자 contract + `PeriodBridgeAdminPersistResult` 반환 shape. 본 factory 는 이 메서드 시그니처를 **callable 인자 타입** 으로만 재사용 (service 인스턴스 import 0 — 호출자가 바인딩한 함수를 넘긴다).
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` (49–57행) — person 입력 타입 `PeriodBridgePersonInput` (`serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[]`). 본 factory 는 이 타입을 `import type` 재사용 — person 해석 (personId→ServiceIdentity DB 조회) 자체는 호출자 책임이고 본 factory 는 **이미 resolved 된** person 을 받는다.
- `src/assessment-evaluation/evaluation-scoring.service.ts` (46–49행) — `ScoringOptions = { modelId: string }`. 본 factory 는 이 타입을 `import type` 재사용 (호출자가 넘긴 options 를 thunk 인자로 pass-through).
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — null/undefined fail-fast 한국어 `TypeError` + 비변형 + `@Injectable` 0 + Prisma/LLM import 0 의 순수-조각 작성 관행 mirror.
- `src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.spec.ts` — colocated spec 의 happy/error/branch/negative/regression 구조 mirror.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts` 신설 — `buildUnevaluatedFillCoordinateRunner(bridge: PeriodBridgeDto, person: PeriodBridgePersonInput, options: ScoringOptions, persist: GenerateAndPersistFn): UnevaluatedFillCoordinateRunner` 순수 factory export. 여기서 `GenerateAndPersistFn` 은 `(person, period: { since?: string }, options: ScoringOptions, context: EvaluationPersistContext, reevaluate?: boolean) => Promise<PeriodBridgeAdminPersistResult>` shape (호출자가 바인딩한 `generateAndPersist` 를 받는 callable 타입 — 본 파일에 type alias 로 정의 또는 메서드 시그니처 재사용).
  - 반환 thunk 는 호출 시 `persist(person, { since: bridge.periodStart }, options, toEvaluationPersistContext(bridge), bridge.reevaluate)` 를 호출해 그 `Promise<PeriodBridgeAdminPersistResult>` 를 반환한다. `context` 는 T-0556 `toEvaluationPersistContext(bridge)` 위임 (재구현 0).
  - `period.since` 는 `bridge.periodStart` 를 echo (도출/변형 0 — Admin service 가 since 를 pass-through 하므로 좌표 시작 시각을 그대로 넘긴다). `reevaluate` 는 `bridge.reevaluate` 를 그대로 전달 (undefined 면 undefined — Admin service 가 default false 로 처리).
  - factory 자체는 **인자 조립만** 하고 `persist` 를 호출하지 않는다 (호출은 반환된 thunk 가 await 될 때 — lazy). 단 `toEvaluationPersistContext` 호출 시점은 thunk 실행 시점으로 둔다 (Invalid periodStart 의 `TypeError` 가 thunk 실행 시 발생하도록 — orchestrator 의 T-0558 helper try/catch 가 그 실패를 failed outcome 으로 흡수할 수 있게). 이 시점 결정을 코드 주석과 spec 으로 명시 고정한다.
  - 입력 `bridge` / `person` / `options` 객체를 mutate 하지 않는다.
  - `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — 위 타입들만 `import type`, `toEvaluationPersistContext` 만 value import (새 외부 dependency 0).
- [ ] happy-path unit test: 유효 `bridge` + resolved `person` + `options` + mock `persist` → (a) 반환값이 함수 (thunk) 임 1+; (b) thunk 를 await 하면 mock `persist` 가 정확히 `(person, { since: bridge.periodStart }, options, <expected context>, bridge.reevaluate)` 로 1 회 호출되고 mock 의 resolve 값 (`PeriodBridgeAdminPersistResult`) 이 그대로 반환됨 1+; (c) `context` 인자가 `toEvaluationPersistContext(bridge)` 와 동등 (personId/period/scope 전사 + periodStart Date) 임 1+.
- [ ] error path unit test: `bridge` 가 null/undefined 일 때 한국어 `TypeError` 1+; `persist` 가 함수가 아닐 때 (null/undefined/비-function) 한국어 `TypeError` 1+; thunk 실행 시 `bridge.periodStart` 가 Invalid Date (예: "not-a-date") / 빈 string / 비-string 이면 `toEvaluationPersistContext` 가 던지는 한국어 `TypeError` 가 thunk await 에서 reject 로 전파됨 각 1+ (factory 조립 시점이 아니라 thunk 실행 시점 — 시점 단언).
- [ ] flow / branch coverage: factory 입력 방어 분기 (bridge null / persist 비-function) 각 1+; thunk 실행 분기 (정상 persist 위임 + Invalid periodStart 로 context 도출 실패) 각 1+; `reevaluate` 가 true / false / undefined 인 좌표 각각이 thunk 의 5 번째 인자로 정확히 전달되는 분기 각 1+ test.
- [ ] negative cases 충분 cover: null/undefined bridge, 비-function persist, Invalid Date periodStart (thunk reject), 빈 string periodStart, 비-string periodStart, `reevaluate` undefined 좌표가 undefined 그대로 전달되는지, mock `persist` 가 reject 시 thunk 가 그 reject 를 그대로 전파 (factory 는 흡수하지 않음 — 흡수는 T-0558 helper 책임) 하는지, 입력 비변형 (반환 후 bridge/person/options 객체 unchanged 단언) — 예외/경계 상황마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] regression test (hqOrigin Q-0045): `period.since` 가 `bridge.periodStart` 와 어긋나게 전달되면 fail 하는 test 1+; `reevaluate` 가 `bridge.reevaluate` 와 어긋나게 (예: 항상 true 로 강제) 전달되면 fail 하는 test 1+; `toEvaluationPersistContext` 호출이 factory 조립 시점이 아니라 thunk 실행 시점에 일어나는지 (factory 호출만으로는 Invalid periodStart 가 throw 되지 않음을 단언) 1+ — Q-0045 run-side chain 의 인자 무결성 + lazy 평가 회귀 방지.
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.spec.ts` (factory 와 같은 디렉토리). describe/it 라벨 한국어 명확화 (§12). `persist` 는 jest mock 함수 (`jest.fn().mockResolvedValue(...)` / `.mockRejectedValue(...)`), `person` / `options` / `PeriodBridgeAdminPersistResult` 는 plain 객체 stub (실 service/LLM/DB 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표).

## Out of Scope

- loop-level impure orchestrator 실배선 (`@Injectable` service: dedup 된 `PeriodBridgeDto[]` 순회 → per-좌표 person 해석 (DB) → 본 factory 호출 → T-0558 helper 호출 → `aggregateUnevaluatedFillRunResult`(T-0552) + module 등록) — 후속 slice. 본 factory 는 좌표 1 개 + resolved person + callable → thunk 1 개 조립까지만. 배열 순회 / person 해석 / aggregate 는 호출자 책임.
- person 해석 (personId → ServiceIdentity DB 조회 → `PeriodBridgePersonInput`) — 본 factory 는 **이미 resolved** 된 person 을 인자로 받는다. DB 조회 / Person row 존재 검증 / RBAC (self-only / Admin 임의 personId) 는 후속 controller/orchestrator slice 책임.
- `ScoringOptions` (modelId 등) 도출 정책 — 본 factory 는 호출자가 넘긴 options 를 thunk 로 pass-through 만. modelId 결정/기본값은 호출자 (orchestrator/controller) 책임.
- `PeriodBridgeAdminPersistService` 인스턴스 import / `@Injectable` service 화 / DI 등록 / module provider 등록 — 본 factory 는 순수 함수 (callable-as-param). service 화/등록은 후속 orchestrator slice.
- POST /unevaluated-fill-run controller route / RBAC / run-request DTO 신설 — 후속 slice.
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice (live-LLM 배선검증은 ADR-0045 standing 게이트, LAN 수동 1 회, 만료 2026-06-30). 본 task 의 빌드/unit 은 mock callable 라 LLM 0.
- runner reject 흡수 / failed outcome 합성 — T-0558 helper 책임. 본 factory 의 thunk 는 `persist` 의 reject 를 그대로 전파한다 (흡수 0).
- `EvaluationResult` 타입 직접 import / 평가문 본문 보유 (REQ-032 raw-not-stored 정합) — 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append.)

남은 chain slice (참고 — 본 task 완료 후 planner 가 순차 큐잉):
1. loop-level impure orchestrator (`@Injectable` service): dedup 된 `PeriodBridgeDto[]` → per-좌표 person 해석 (DB) → 본 factory(T-0559) 로 thunk 조립 → T-0558 helper 순회 호출 → `aggregateUnevaluatedFillRunResult`(T-0552). + module 등록. (live-LLM 배선검증 동반 가능 — 단 빌드/unit 은 mock.)
2. POST /unevaluated-fill-run controller route + RBAC + run-request DTO.
3. e2e (실 PostgreSQL; LLM 은 mock 또는 LAN 수동 1 회 배선검증).
