---
id: T-0564
title: 미평가 fill run @Injectable orchestrator service 추가 (DB person lookup + persist 바인딩 → core 위임 + module 등록)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 240
estimatedFiles: 3
created: 2026-06-21
plannerNote: "P5 bullet 106(R-64/REQ-037·038) Q-0045 옵션1 run-side chain slice(1') — pure core(T-0563) 위 @Injectable wiring: person lookup·persist 바인딩 + core 위임 + module 등록"
independentStream: q0045-run-side-chain
hqOrigin: Q-0045
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts
  - src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.spec.ts
  - src/assessment-evaluation/assessment-evaluation.module.ts
---

# T-0564 — 미평가 fill run @Injectable orchestrator service 추가 (DB lookup + persist 바인딩 → core 위임)

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 Q-0045 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 진행 중이다. 직전 T-0563 (merge fbfd15d, PR #478) 이 dependency-free 순수 orchestration core `runUnevaluatedFillRunCore(rawBridges, resolvePerson, persist, requestModelId, defaultModelId)` — 이미 바인딩된 두 callable(`resolvePerson` / `persist`)과 raw 좌표 배열·modelId 를 받아 buildFillRunScoringOptions(T-0562) → dedupePeriodBridgeRequests(T-0551) → runUnevaluatedFillBatch(T-0560) 순서를 닫는 단일 순수 함수 — 를 박제했다. 그 core 와 person-해석 factory `buildResolvePersonFn(lookup)` (T-0561), 좌표 runner factory (T-0559), 좌표 helper (T-0558), 집계 (T-0552), 매퍼 (T-0556/T-0557) 등 **모든 순수 조각이 이미 닫혀** 있다.

backlogNote 의 남은 **slice (1') loop-level @Injectable orchestrator** 가 본 task 다. 이 service 는 NestJS DI 로 (a) `PersonService` (personId → ServiceIdentity DB 조회) 와 (b) `PeriodBridgeAdminPersistService` (`generateAndPersist` — collect→filter→evaluate→persist) 를 주입받아, (c) `buildResolvePersonFn` 에 person lookup adapter 를 바인딩해 `resolvePerson` 을 얻고, (d) `generateAndPersist` 를 `persist` 로 바인딩하고, (e) `runUnevaluatedFillRunCore` 를 1 회 호출해 raw 좌표 배열 + run-request modelId → `UnevaluatedFillRunResult` 를 산출하는 단일 진입 메서드를 노출한 뒤, (f) `AssessmentEvaluationModule` 의 provider + export 로 등록한다. 모든 조립 로직 (dedup / options 도출 / 좌표 순회 / 부분 실패 흡수) 은 T-0563 core 와 그 하위 helper 들이 이미 책임지므로, 본 service 는 **DI callable 바인딩 + core 1 회 위임 + 등록** 만 한다 — inline 재구현 0.

핵심 glue 한 가지: `PersonService.findByIdWithIdentities(id)` 는 person 부재 시 `null` 을 반환하지 않고 `NotFoundException` 을 throw 한다 (person.service.ts L103–109). 반면 `buildResolvePersonFn` 의 `lookup` callable 은 person 부재 시 `null` 을 돌려주는 shape (`(personId) => Promise<PersonWithIdentities | null>`) 를 기대한다 (T-0561). 따라서 본 orchestrator 의 lookup adapter 는 이 둘을 화해시켜야 한다 — `PersonService.findByIdWithIdentities` 의 `NotFoundException` 을 catch 해 `null` 로 변환하거나 (그러면 `buildResolvePersonFn` 의 resolver 가 좌표 단위 한국어 `Error` 로 다시 throw → T-0560 driver 가 좌표 failed outcome 으로 흡수, REQ-037 부분 실패), 또는 `PersonRepository.findByIdWithIdentities` (raw null 반환) 를 직접 쓴다. 본 task 는 전자 (PersonService catch→null adapter) 를 권장한다 — UserModule 이 이미 `PersonService` 를 export 하고 module 이 이미 import 중이라 추가 import 0 (assessment-evaluation.module.ts L63–68/L39). 이 adapter 가 한 좌표의 person 부재가 나머지 좌표를 막지 않게 하는 흡수 계약의 마지막 glue 다.

build/unit 은 mock 로 완결된다 — spec 은 mock `PersonService` + mock `PeriodBridgeAdminPersistService` 를 주입해 DB/LLM 네트워크 0 으로 검증한다 (live-LLM standing 게이트 ADR-0045 무관). 기존 service/type 재사용·새 persistence/dep 경계 0 이므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다.

## Required Reading

- `src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts` — 본 service 가 1 회 호출할 `runUnevaluatedFillRunCore(rawBridges, resolvePerson, persist, requestModelId, defaultModelId): Promise<UnevaluatedFillRunResult>` 시그니처 + 위임 구조 (재구현 0, 그대로 위임).
- `src/assessment-evaluation/dto/build-resolve-person-fn.ts` — `buildResolvePersonFn(lookup): ResolvePersonFn` factory + `PersonLookupFn` shape (`(personId) => Promise<PersonWithIdentities | null> | (PersonWithIdentities | null)`). 본 service 가 lookup adapter 를 넘겨 `resolvePerson` 을 조립한다. null-row → 좌표 단위 한국어 `Error` 흡수 계약 확인.
- `src/user/person.service.ts` (99–109행 `findByIdWithIdentities`) — person 부재 시 `null` 이 아니라 `NotFoundException` throw 임을 확인 (lookup adapter 가 catch→null 로 화해해야 하는 이유). 반환 타입 `PersonWithIdentities`.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` (74행 class + 130–158행 `generateAndPersist`) — `persist` 로 바인딩할 메서드의 5 인자 시그니처(`person, period, options, context, reevaluate`). `GenerateAndPersistFn` 타입과 일치.
- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts` (59–71행) — `GenerateAndPersistFn` 타입 (persist 인자 타입 — bind 결과가 이 shape 여야 함).
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` — 본 service 메서드의 반환 타입 `UnevaluatedFillRunResult`.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 raw 좌표 배열 타입 `PeriodBridgeDto`.
- `src/assessment-evaluation/assessment-evaluation.module.ts` (39행 UserModule import, 68행 imports, 106–118행 PeriodBridgeAdminPersistService provider, 132–158행 provider/export) — 본 service 를 provider + export 로 등록할 위치 + UserModule(PersonService) 이 이미 import 됨을 확인.
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` (49–57행 부근) — `PeriodBridgePersonInput` 타입 (lookup 반환이 narrow 되는 shape, T-0561 resolver 가 처리하므로 본 service 직접 사용은 아님 — 타입 참고용).
- `src/assessment-evaluation/period-bridge-admin-persist.service.spec.ts` — `@Injectable` service 의 NestJS Test module + mock 주입 spec 패턴 mirror.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts` 신설 — `@Injectable()` class `UnevaluatedFillRunOrchestratorService`. 생성자 주입: `PersonService` + `PeriodBridgeAdminPersistService` (둘 다 같은 module 내 / UserModule export 라 추가 import 0).
- [ ] 단일 진입 메서드 (권장 시그니처): `async run(rawBridges: PeriodBridgeDto[], requestModelId: string | undefined | null, defaultModelId: string): Promise<UnevaluatedFillRunResult>`. 본문 동작:
  - (a) person lookup adapter 조립 — `(personId) => this.personService.findByIdWithIdentities(personId)` 를 `NotFoundException` catch → `null` 변환 wrapper 로 감싼다 (person 부재를 `buildResolvePersonFn` 이 기대하는 null-row 신호로 화해). `NotFoundException` 외 error 는 전파 (재포장 0).
  - (b) `resolvePerson = buildResolvePersonFn(lookupAdapter)` (T-0561) 로 resolver 조립.
  - (c) `persist = this.adminPersistService.generateAndPersist.bind(this.adminPersistService)` (또는 동등 wrapper) — `GenerateAndPersistFn` shape 으로 바인딩.
  - (d) `return runUnevaluatedFillRunCore(rawBridges, resolvePerson, persist, requestModelId, defaultModelId)` (T-0563) 로 위임. dedup / options 도출 / 좌표 순회 / 집계 재구현 0.
- [ ] **순수 조각 재구현 0 (load-bearing)**: dedup·options·좌표 순회·부분 실패 흡수는 T-0563 core 및 하위 helper 가 이미 책임진다. 본 service 는 DI callable 바인딩 + core 1 회 위임만 한다. options 무효 / rawBridges non-array 의 한국어 `TypeError` 는 core 가 전파하고 본 service 는 흡수하지 않는다 (controller slice 가 HTTP 매핑 — 본 task Out of Scope). 좌표 1 개 단위 person/persist reject 흡수는 batch 가 책임지므로 본 service 는 pass-through.
- [ ] lookup adapter glue 명시: `PersonService.findByIdWithIdentities` 가 부재 시 `NotFoundException` 을 throw 하는 것을 `null` 로 화해하는 것이 본 service 의 핵심 책임임을 파일 상단 한국어 doc comment 에 박제 (왜 직접 `buildResolvePersonFn(this.personService.findByIdWithIdentities.bind(...))` 가 아닌지 — null 기대 vs throw 불일치).
- [ ] 파일 상단에 기존 service 들과 동형의 한국어 doc comment 헤더 (책임 / DI 의존 / core 위임 구조 / 경계). `@Injectable` 이 본 chain 의 첫 impure wiring 임을, controller route·RBAC·run-request DTO·e2e 는 후속 slice (Out of Scope) 임을 명시.
- [ ] `assessment-evaluation.module.ts` 에 `UnevaluatedFillRunOrchestratorService` 를 `providers` 에 등록 + `exports` 에 추가 (후속 controller slice 가 inject 받도록). 등록 위치에 한국어 주석 1~2줄 (T-0564, person+persist 바인딩 compose 역할). 추가 module import 0 (PersonService=UserModule 이미 import, PeriodBridgeAdminPersistService=같은 module provider).
- [ ] **Happy-path unit test 1+**: NestJS `Test.createTestingModule` 에 mock `PersonService` (`findByIdWithIdentities` jest.fn → serviceIdentities 포함 row resolve) + mock `PeriodBridgeAdminPersistService` (`generateAndPersist` jest.fn → 성공 result resolve) 주입. `run([좌표(중복 포함)], undefined, "default-model")` 호출 → dedup 후 좌표 수만큼 `generateAndPersist` 호출 + `UnevaluatedFillRunResult` 반환 검증. modelId default fallback 분기 (request undefined → default 채택) 가 실제 `generateAndPersist` 에 넘어간 `options.modelId` 로 확인.
- [ ] **Error path unit test 1+**: (a) `requestModelId`·`defaultModelId` 둘 다 빈 값 → core 의 `buildFillRunScoringOptions` 한국어 `TypeError` 전파 검증 (좌표를 흘리기 전 차단 — `generateAndPersist` 0 회 호출), (b) `rawBridges` non-array(null 등) → `dedupePeriodBridgeRequests` 한국어 `TypeError` 전파 검증.
- [ ] **Flow / 분기 cover**: (a) request modelId 채택 분기 vs default fallback 분기 각각에서 `generateAndPersist` 에 넘어간 `options.modelId` 가 기대값임을 검증, (b) lookup adapter 분기 — person 존재(row resolve → 좌표 evaluated/skipped outcome) vs person 부재(`PersonService` 가 `NotFoundException` throw → adapter 가 null → resolver 가 좌표 단위 `Error` → 그 좌표만 failed outcome, 나머지 정상) 각 1+ test.
- [ ] **Negative cases 충분 cover**: (a) 빈 좌표 배열 → 빈 결과(`generateAndPersist` 0 회) 정상 반환, (b) 한 좌표의 person 부재(`NotFoundException`) → 그 좌표만 failed, 나머지 좌표는 정상 outcome (부분 실패 흡수 — REQ-037), (c) 한 좌표의 `generateAndPersist` reject → 그 좌표만 failed 로 흡수되고 나머지 정상 (batch 흡수 pass-through), (d) `findByIdWithIdentities` 가 `NotFoundException` 외 error(예: DB 연결 실패 mock reject) → adapter 가 catch 하지 않고 그 error 가 좌표 단위로 batch 에 흡수됨을 확인 (재포장 0). 각 1+ test (단일 negative 만 작성 금지).
- [ ] **Regression test (hqOrigin Q-0045) 1+**: person 부재 좌표(lookup `NotFoundException` → null → 좌표 `Error`)가 batch 를 abort 하지 않고 그 좌표만 failed outcome 으로 흡수되며 나머지 좌표가 정상 평가됨을 단언하는 test — 즉 한 좌표의 person 부재가 전체 run 을 깨면 fail. lookup adapter 가 `NotFoundException` 을 null 로 화해하지 않으면(직접 throw 전파) 이 흡수가 깨지므로 회귀 방지.
- [ ] colocated spec 위치: `src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.spec.ts`. describe/it 라벨 한국어 명확화 (§12). mock 은 jest.fn (실 PersonService/PrismaService/AdminPersistService/DB/LLM 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표). DI 주입은 mock callable 로 닫혀 DB/LLM 네트워크 0.

## Out of Scope

- POST /unevaluated-fill-run controller route / RBAC(self-only · Admin) / run-request DTO 신설 — 후속 slice(2). 본 service 는 `run(...)` 메서드만 노출, HTTP route·guard·DTO 검증 0.
- options 무효 / rawBridges non-array 의 한국어 `TypeError` → HTTP status(400 등) 매핑 — 후속 controller slice. 본 service 는 core 의 throw 를 전파만 한다.
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice(3). live-LLM 배선검증은 ADR-0045 standing 게이트(LAN=AKIHA 192.168.0.5 Ollama 수동 1회, 만료 2026-06-30, cloud cron 무경로). 본 task 의 빌드/unit 은 mock callable 라 DB/LLM 0.
- `defaultModelId` 의 출처 결정(설정/env/상수에서 어떻게 주입되는지) — 본 service 는 `run(...)` 의 인자로 받기만 한다. default modelId source 배선은 후속 controller slice 또는 별도 config slice.
- T-0556..T-0563 의 순수 조각(매퍼/dedup/runner/batch/core/options/person-factory) 로직 수정 — 본 service 는 호출만 한다(재구현 / 변경 0).
- `PersonRepository` 직접 주입(raw null lookup) 으로의 전환 — 본 task 는 `PersonService` catch→null adapter 권장. repository 직접 사용은 별도 결정(추가 import 발생 시 §3.1 고려).
- retry / batch abort / 동시성 정책 / RBAC personId 동등성 강제 — 본 service 는 위임 compose 만.

## Result (DONE — 2026-06-21T14:38Z fire)

- **DONE** (merge 4325286, PR #479, 4-게이트 round 1 PASS). `@Injectable UnevaluatedFillRunOrchestratorService` 신설: `run(rawBridges, requestModelId, defaultModelId)` 단일 진입 — lookup adapter(`PersonService.findByIdWithIdentities` 의 `NotFoundException` → `null` 화해) + `generateAndPersist` bind → `runUnevaluatedFillRunCore`(T-0563) 1 회 위임. 순수 조각 재구현 0, 추가 module import 0. `assessment-evaluation.module.ts` provider+export 등록.
- 신규 파일 cov 100%(stmt/branch/func/line), 전체 263 suites / 6233 tests green, lint·build·test:cov clean. CI green(PR gate 4) 후 squash merge + branch 삭제.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)

남은 chain slice (참고 — 본 task 완료 후 planner 가 순차 큐잉):
1. POST /unevaluated-fill-run controller route + RBAC(self-only · Admin) + run-request DTO + `UnevaluatedFillRunResult` → HTTP 응답 매핑(core TypeError → 400 등). (live-LLM 배선검증 동반 가능 — 단 빌드/unit 은 mock.)
2. e2e (실 PostgreSQL; LLM 은 mock 또는 LAN 수동 1회 배선검증).
