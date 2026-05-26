---
id: T-0054
title: persons.e2e-spec real PostgreSQL cutover + jest-e2e globalSetup wiring + app.e2e 호환 점검 (ADR-0004 §Migration #4+#5 e2e 절반 완성)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-058]
estimatedDiff: 180
estimatedFiles: 4
created: 2026-05-26
plannerNote: ADR-first split stage 4 — persons.e2e mock override 제거 + 11 mock 호출 → real seed mechanical 변환 + jest-e2e-setup thin re-export + jest-e2e.json globalSetup wiring + app.e2e 호환 점검. ~180 LOC / 4 파일 pr-mode.
dependsOn: [T-0051, T-0052, T-0053]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: |
  docs/decisions/ADR-0004-smoke-e2e-db-mode.md §Migration 의무 #4+#5 (T-0051 mergeCommit 9109e65 ACCEPTED) — smoke 절반은 T-0053 mergeCommit 888a960 으로 박제, 본 task 가 e2e 절반의 closure.
  docs/tasks/T-0053-smoke-persons-real-postgres-cutover.md §Out of Scope L122 명시 carve — "T-0054 (예정) — e2e 절반: test/e2e/persons.e2e-spec.ts 의 mock override 제거 + 실 seed 전환 (11 mock 호출 변환) + test/jest-e2e.json 의 globalSetup wiring + test/e2e/app.e2e-spec.ts 의 호환 검증 (DB 미사용이라 변경 최소)".
  driver-supplied 분석 — 실 측정: persons.e2e-spec.ts 11 mock 호출 (findMany 1 / findUnique 2 / create 1 / update 3 / delete 2 + 2 negative create 0-call assertion) + app.e2e-spec.ts (GET / 만, DB 미사용) + test/jest-e2e.json (globalSetup key 추가) + globalSetup helper 결정. 합계 ~150-180 LOC / 3-4 파일 — cap (300 LOC / 5 파일) 안전.
  globalSetup helper 결정 — driver-supplied 3 옵션 (reuse via rename / new thin re-export / full duplication) 중 **(2) new thin re-export** 채택. 신설 파일 test/helpers/jest-e2e-setup.ts 가 jest-smoke-setup.ts 를 default re-export (1 줄) + 5 줄 JSDoc (재사용 사유 + ADR-0004 §Cleanup 정책 박제 + DATABASE_URL fail-fast 동일 + e2e 격리 책임 동일 + 후속 분기 시 본 thin wrapper 만 갈아끼우면 됨). 선택 사유 (4 항목):
    1. **T-0053 회귀 0** — jest-smoke-setup.ts 의 본문/JSDoc/import path 0 변경 → smoke 측 history bisect 보존 + 다음 PR diff 가 e2e 변경만 포함.
    2. **symmetry** — smoke/e2e 가 각자 own setup 파일을 import 하는 모양이 jest config 두 파일과 1:1 대응 (test/jest-smoke.json → test/helpers/jest-smoke-setup.ts / test/jest-e2e.json → test/helpers/jest-e2e-setup.ts).
    3. **future divergence 점** — e2e 의 globalSetup 이 smoke 와 달라져야 할 시점 (예: e2e 전용 seed / 별도 schema 옵션) 에 본 thin wrapper 만 갈아끼우면 됨, T-0053 박제 jest-smoke-setup.ts 무영향.
    4. **diff cost 0** — 5 LOC 신설 vs rename + 2 jest config import path 변경 + smoke setup JSDoc "smoke 전용" 언급 제거의 ~15 LOC churn → thin re-export 가 가장 적은 diff.
  architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + db-truncate.ts helper signature 박제 완료 + T-0053 jest-smoke-setup.ts 패턴 박제 완료, 새 의사결정 0.
  coversReq=[REQ-029 (실 PostgreSQL durability + Prisma adapter 실 동작 path 의 e2e HTTP contract 단계 발화 — smoke + e2e 양 layer cover 완성) + REQ-058 (CI 정책 박제 long-horizon 일관성)].
  dependsOn=[T-0051 ADR / T-0052 helper+CI services / T-0053 jest-smoke-setup.ts reference].
  STATE.nextTask=T-0054.
---

# T-0054 — persons.e2e-spec real PostgreSQL cutover + jest-e2e globalSetup wiring + app.e2e 호환 점검

## Why

[T-0053](T-0053-smoke-persons-real-postgres-cutover.md) 가 mergeCommit `888a960` 로 [ADR-0004](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Migration 의무 5 항목 중 **#4 smoke 절반** + **#5 hook smoke 절반** 을 박제했다. 잔여:

- **#4 e2e 절반** — [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) 의 `Test.overrideProvider(PrismaService)` 제거 + 11 mock 호출 → 실 seed 변환.
- **#5 hook e2e 절반** — [test/jest-e2e.json](../../test/jest-e2e.json) 의 `globalSetup` 키 신설 + `afterEach(truncateAll)` hook 부착.

본 T-0054 가 위 잔여 2 항목을 박제하여 ADR-0004 §Migration 의무 5 항목 전부 (5/5) 완성 — **ADR-first split 4-stage trajectory 의 stage 4 closure**.

본 task 의 변경은 모두 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md#decision) (mock 의 unit-only 보조 유지 + e2e = real 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (`afterEach` truncate) + [T-0053](T-0053-smoke-persons-real-postgres-cutover.md) 박제 [jest-smoke-setup.ts](../../test/helpers/jest-smoke-setup.ts) 패턴의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

**globalSetup helper 결정 (planner 박제)**: [test/helpers/jest-smoke-setup.ts](../../test/helpers/jest-smoke-setup.ts) 본문은 이미 smoke-specific 한 코드가 0 (`PrismaClient.$connect` + `truncateAll` + `$disconnect`). 파일명만 "smoke" 라는 점을 처리하는 **thin re-export wrapper** [test/helpers/jest-e2e-setup.ts](../../test/helpers/jest-e2e-setup.ts) 를 신설 — `export { default } from "./jest-smoke-setup"` 1 줄 + JSDoc 5 줄. T-0053 회귀 0 + symmetry + future divergence 점 확보 (frontmatter `plannerSource` 4 항목 참조).

REQ 매핑:

- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. 본 task 머지 시점부터 `persons.e2e-spec` 의 5 endpoint × happy + 3 error envelope + 3 branch test 가 **실 PostgreSQL durability path + Prisma adapter pg connection pool + DB constraint (unique / foreign key) 실 발화 + HTTP contract depth** 를 검증. T-0053 머지 smoke 절반과 합쳐 **REQ-029 정합 검증 path 가 unit (mock 보조) + smoke (실 DB bootstrap) + e2e (실 DB HTTP contract) 3 layer 전부 박제 완성**.
- [REQ-058](../requirements.md) — 운영 정책 underlying. CI 정책 박제의 long-horizon 일관성.

## Required Reading

- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Consequences + §Cleanup 정책 + §Migration 의무 #4+#5 — 박제 reference (e2e 측 책임 동일).
- [docs/tasks/T-0053-smoke-persons-real-postgres-cutover.md](T-0053-smoke-persons-real-postgres-cutover.md) — 박제된 smoke 측 패턴 reference (acceptance criteria 구조 + JSDoc 박제 패턴 + `afterEach` hook 박제).
- [test/helpers/jest-smoke-setup.ts](../../test/helpers/jest-smoke-setup.ts) — re-export source (PrismaClient connect + truncateAll + disconnect + DATABASE_URL fail-fast 패턴 + e2e 와의 책임 분리 박제, L20-22 "후속 T-0054 에서 동일 패턴의 별도 setup 파일 또는 본 setup 의 share 결정 — T-0054 책임" 명시 — 본 task 가 그 결정 박제).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry. 본 task 의 `afterEach` hook 이 호출.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 본 task 머지 시점에 e2e import 제거. T-0053 의 JSDoc L7 "smoke/e2e 의 import 제거 시점: T-0053 (smoke) / T-0054 (e2e) 머지 시점" 박제와 정합.
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — cutover 대상 (11 mock 호출 + 2 negative 의 `mockPrisma.person.create not.toHaveBeenCalled` assertion + 1 ValidationPipe 검증 + 3 branch test P2002/P2025/P2025).
- [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) — DB 미사용 (GET / 만 + 404 fallback) — 본 task 의 globalSetup 호환 검증 (변경 0 또는 minimal). globalSetup 이 부착되면 모든 e2e spec 실행 직전 services.postgres 부트 의존 발생 — 자연 의도.
- [test/jest-e2e.json](../../test/jest-e2e.json) — `globalSetup` 키 추가 대상.
- [test/jest-smoke.json](../../test/jest-smoke.json) — reference (`globalSetup` key 박제 패턴 L8 mirror).
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — `PrismaService` lifecycle (onModuleInit `$connect`) + `buildPrismaAdapter()` factory 의 `process.env.DATABASE_URL` 의존.
- [src/user/person.service.ts](../../src/user/person.service.ts) — P2002 / P2025 error handling (실 DB 의 unique constraint 발화 → ConflictException 변환 path + missing id → NotFoundException 변환 path).
- [prisma/schema.prisma](../../prisma/schema.prisma) — Person.email `@unique` constraint (P2002 발화 source) + Person.partId nullable.

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. jest-e2e-setup.ts thin re-export 신설

- [ ] `test/helpers/jest-e2e-setup.ts` 신설. 본문 = `export { default } from "./jest-smoke-setup";` 1 줄 (default export 의 re-export — jest globalSetup 계약 충족).
- [ ] 본 파일 module-level JSDoc 5 줄 박제:
  1. "jest-e2e-setup.ts — jest `globalSetup` hook 의 source (T-0054)."
  2. "책임: [./jest-smoke-setup.ts](./jest-smoke-setup.ts) 의 default export 를 그대로 re-export. e2e config (`test/jest-e2e.json`) 가 본 파일을 globalSetup key 로 가리킨다."
  3. "재사용 사유 (ADR-0004 §Cleanup 정책 + T-0053 박제 패턴): PrismaClient connect + truncateAll + disconnect + DATABASE_URL fail-fast — smoke / e2e 의 globalSetup 책임이 동일 (test 간 격리 + dirty data 안전망)."
  4. "symmetry: test/jest-smoke.json → jest-smoke-setup.ts / test/jest-e2e.json → jest-e2e-setup.ts 의 1:1 대응 — 본 thin wrapper 가 향후 e2e 전용 분기 (예: e2e seed / 별도 schema 옵션) 도입 시 갈아끼울 hook point."
  5. "파일 경로 정책: jest 의 어떤 testRegex (`.*\\.spec\\.ts$` / `.*\\.smoke-spec\\.ts$` / `.*\\.e2e-spec\\.ts$`) 도 매칭하지 않는다. package.json 의 collectCoverageFrom: [src/**/*] scope 밖이라 coverage 통계 영향 0."

### B. persons.e2e-spec real DB cutover

- [ ] `test/e2e/persons.e2e-spec.ts` 의 `Test.overrideProvider(PrismaService).useValue(mockPrisma)` 제거 — 실 PrismaService 가 services.postgres 의 localhost:5432 에 connection 발화.
- [ ] `buildMockPrismaService` / `buildPersonFixture` / `buildPrismaError` / `MockPrismaService` type import 4 entry 삭제 — 본 spec 은 real DB 로 전환되어 mock helper 의존 0.
- [ ] `truncateAll` import 추가 (`../helpers/db-truncate` 경로) — `afterEach` hook source.
- [ ] **B 섹션 5 happy endpoint test** (`GET /api/persons` / `GET /api/persons/:id` / `POST /api/persons` / `PATCH /api/persons/:id` / `DELETE /api/persons/:id`) 가 **실 seed → 실 query 발화 → 응답 검증** 패턴으로 재작성 (T-0053 smoke 패턴 1:1 mirror, depth 보강):
  - 각 test 의 arrange 단계에서 `await prisma.person.create({data: {...}})` 로 실 row seed.
  - assertion 은 `expectDtoFields(body)` 5 field shape 검증 + 실 DB seed 값 비교 (mock fixture 의 id `"cuid-e2e-by-id"` 등은 실 cuid 로 대체 — `seed.id`).
  - `POST` 의 `mockPrisma.person.create.mock.calls` 검증은 **응답 id 의 row 를 실 DB 에서 `findUnique` 로 재조회** 패턴으로 변환 (T-0053 의 POST 패턴 mirror).
  - `DELETE` 의 mock return 검증은 **응답 후 실 DB 에서 row 가 사라진 것** 을 `findUnique` 로 검증.
- [ ] **C 섹션 3 negative test** (404 missing / 400 empty body / 400 non-whitelisted) 보존:
  - `mockPrisma.person.findUnique.mockResolvedValueOnce(null)` 제거 — 실 DB 의 `findUnique` 가 null 반환 (seed 없음).
  - `expect(mockPrisma.person.create).not.toHaveBeenCalled()` 2 회 변환 — `expect(await prisma.person.count()).toBe(0)` 로 실 DB row 0 검증 (T-0053 smoke 패턴 mirror).
  - envelope shape (`statusCode` / `error` / `message`) 검증 유지 + `messageText` helper 유지.
- [ ] **D 섹션 3 branch test** (PATCH duplicate email → 409 / PATCH missing → 404 / DELETE missing → 404):
  - PATCH duplicate email: 두 row seed (T-0053 smoke 의 D.1 패턴 mirror) → 두 번째 row 의 email 을 첫 번째 row 의 email 로 PATCH → 실 PostgreSQL unique constraint (Person.email @unique) 가 P2002 발화 → ConflictException 변환 → 409 + envelope 검증. **본 분기가 실 DB 의 Prisma adapter / pg driver error 변환 path 의 e2e HTTP contract depth 검증** (T-0053 smoke 의 1-level 검증 + 본 task envelope shape 검증).
  - PATCH missing id (P2025): seed 없이 random cuid 로 PATCH 시도 → 실 PostgreSQL 의 update 가 P2025 발화 → NotFoundException 변환 → 404 + envelope 검증. mock 의 `mockRejectedValueOnce(buildPrismaError("P2025"))` 제거.
  - DELETE missing id (P2025): seed 없이 random cuid 로 DELETE 시도 → 실 PostgreSQL 의 delete 가 P2025 발화 → NotFoundException 변환 → 404 + envelope 검증. mock 의 `mockRejectedValueOnce(buildPrismaError("P2025"))` 제거.
- [ ] `afterEach(async () => { await truncateAll(prisma); })` hook 추가 (mock 의 `jest.clearAllMocks()` 대체) — 각 test 후 5 테이블 truncate 로 test 간 state leak 0 (ADR-0004 §Cleanup 정책 박제).
- [ ] `afterAll(async () => { await app.close(); await prisma.$disconnect(); })` 갱신 — PrismaService 의 connection 누수 방지 (T-0053 smoke 패턴 mirror).
- [ ] `let mockPrisma: MockPrismaService;` 변수 선언 제거, `let prisma: PrismaService;` 로 대체 — `beforeAll` 에서 `moduleRef.get<PrismaService>(PrismaService)` 로 실 PrismaService 인스턴스 획득.
- [ ] **test 개수 보존** — 기존 11 test (happy 5 + negative 3 + branch 3) 모두 유지. test 삭제 0 / 추가 0 / intent 변경 0 — 변환은 mechanical mock → real seed.
- [ ] **JSDoc 갱신** — 본 spec 머리의 JSDoc L1-5 의 "mock / helper = test/helpers/prisma-mock.ts 공용" reference 를 "실 DB 전략 (T-0054 박제 — ADR-0004 §Decision)" 단락으로 갱신 (T-0053 smoke spec 의 JSDoc 박제 패턴 L13-22 mirror, e2e 책임 명시 추가 — HTTP contract depth + envelope shape + multi-step flow 가 본 spec).

### C. test/jest-e2e.json globalSetup wiring

- [ ] `test/jest-e2e.json` 에 `globalSetup` key 추가, 값은 `<rootDir>/test/helpers/jest-e2e-setup.ts`.
- [ ] 기존 key (`moduleFileExtensions` / `rootDir` / `testRegex` / `testPathIgnorePatterns` / `transform` / `testEnvironment` / `passWithNoTests`) 보존 — 본 task 는 `globalSetup` 1 key 만 추가 (jest-smoke.json L8 패턴 mirror).

### D. app.e2e-spec 호환 점검

- [ ] `test/e2e/app.e2e-spec.ts` 는 DB query 미사용 (`GET /` 만 + 404 fallback) — 본 task 의 globalSetup 부착 후에도 동작 보존. 변경 예상 = **0 LOC** (globalSetup 은 services.postgres 부트만 의존 — app.e2e 의 AppModule 부트스트랩이 PrismaService.onModuleInit `$connect` 발화하나 services.postgres 가 ready 라 무영향).
- [ ] CI 의 `pnpm test:e2e` 가 app.e2e-spec 의 2 test 와 persons.e2e-spec 의 11 test 합쳐 13 test green 보존.
- [ ] **만약 app.e2e 가 services.postgres 부트 대기로 timing-sensitive 한 first-run fail 발생 시**, 본 task 안에서 처리 (`beforeAll` timeout 조정 또는 jest config `testTimeout` 1 줄 추가). 단 T-0053 smoke 가 동일 globalSetup 패턴으로 14/14 CI step green 검증 — fail 가능성 매우 낮음.

### E. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: persons.e2e 의 5 endpoint × 각 1+ happy test (real seed → query 발화 → 응답 + DTO shape 검증) — 본 task B 섹션으로 cover.
- [ ] **Error path test**: globalSetup helper 의 error path 는 jest-smoke-setup.ts 의 DATABASE_URL fail-fast 가 동일하게 발화 (re-export 라 동일 코드). 별도 unit spec 미신설 — globalSetup 은 jest 의 `globalSetup` 단계에서만 호출되어 unit-test 패턴 부적합 (T-0053 의 동일 판단 유지).
- [ ] **Branch coverage**: D 섹션 3 branch test (P2002 → 409 / P2025 → 404 × 2) 가 실 PostgreSQL 의 unique constraint + not-found path 의 e2e HTTP contract depth (envelope shape 포함) cover. T-0053 smoke 의 1-level 검증과 합쳐 P2002 / P2025 분기 양 layer 박제 완성.
- [ ] **Negative cases 충분 cover**: 3 negative (missing id 404 envelope / empty body 400 envelope + validation message / non-whitelisted field 400 envelope + whitelist message) 유지 + 본 task 의 real DB 전환으로 ValidationPipe 의 실 동작 + Prisma 의 실 not-found path 의 envelope shape 까지 검증 (mock 대비 cover 확장).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — 본 task 는 production code 변경 0 (test 변경만) 이므로 src/** coverage 유지. jest-e2e-setup.ts 신설 helper 는 `coveragePathIgnorePatterns` 의 `test/` 외부 매칭 0 (실 위치 `test/helpers/jest-e2e-setup.ts`) 으로 coverage 통계 영향 0.

### F. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용 — 기존 패턴).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%) — src coverage 유지.
- [ ] `pnpm test:smoke` 통과 — 본 task 가 smoke 측 변경 0, 기존 11 test green 보존. CI services.postgres 위에서 발화 (T-0053 박제).
- [ ] `pnpm test:e2e` 통과 — 본 task 가 도입한 globalSetup + persons.e2e 의 real DB 전환이 services.postgres 위에서 발화. **본 task 머지 시점이 ADR-0004 §Decision 의 REQ-029 정합 검증 path 의 e2e HTTP contract depth 첫 실 발화 시점**. 기존 13 test (app.e2e 2 + persons.e2e 11) green 보존.

### G. 박제 / ADR-0004 closure 박제

- [ ] 본 task 의 §Out of Scope 가 ADR-0004 §Migration 의무 5/5 완성 후의 backbone 복귀를 명확히 carve — Group / Part 도메인 backbone (GroupController + DTO + REST endpoints, GroupService N:M membership ops 등) 이 다음 backbone task 책임.
- [ ] 본 task 의 §Follow-ups 에 ADR-0004 §Migration 의무 5/5 closure 박제 (smoke 절반 = T-0053 mergeCommit 888a960 + e2e 절반 = 본 task mergeCommit) + PLAN.md L66 의 "CI smoke/e2e real PostgreSQL 전환" bullet 의 closure marker 갱신 (별도 doc-only direct task 예정).

## Out of Scope

본 task 는 ADR-0004 §Migration 의무 5 항목의 closure (smoke 절반 = T-0053 + e2e 절반 = 본 task). 다음은 명시적으로 후속 task 책임:

- **GroupController / GroupService N:M membership add/remove endpoints**: backbone 진척 영역 — 본 task scope 외, 별도 task (T-0055+).
- **GroupService CRUD 확장 + DTO + REST endpoints**: T-0050 박제 service-layer 의 controller layer 확장. backbone 진척 — 별도 task.
- **mock helper 의 deprecated 마킹 / 제거**: ADR-0004 §Decision 의 mock 위상 = unit-only 보조 유지 (deprecated 아님). prisma-mock.ts 는 unit (src/user/*.spec.ts) 의 보조로 영구 잔존 — 제거 0.
- **Phase 2 src/user/*.spec migration**: prisma-mock.ts 의 phase 2 fixture variant decision 동반 follow-up — 본 task scope 외.
- **PLAN.md L66 / p3-implementation-plan §6 progress 갱신**: T-0051~T-0054 closure 박제는 별도 doc-only direct task (ADR-first split 4-stage 완주 marker 동반).
- **추가 unique constraint / cascade test**: real DB 전환의 e2e 진입은 기존 11 test 보존만 — 새 분기 cover 는 본 task scope 외, 후속 task 책임 (예: PersonGroupMembership cascade 검증, ServiceIdentity FK 검증 등).
- **e2e 성능 / parallelism 최적화**: jest config 의 maxWorkers / testTimeout 튜닝은 본 task scope 외 — 본 task 는 wiring 박제만, 성능은 별도 follow-up.
- **별도 e2e 전용 seed pattern (예: factory / fixture builder)**: 본 task 는 inline `prisma.person.create` 패턴 (T-0053 smoke 동일) — factory 패턴 도입은 별도 ADR 후 task.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + db-truncate helper signature + jest-smoke-setup.ts 패턴 모두 박제 완료, globalSetup helper 결정도 plannerSource 에 박제, 새 의사결정 0). 실 chain:

1. **implementer**: 4 파일 변경 박제.
   - (i) `test/helpers/jest-e2e-setup.ts` 신설 (`export { default } from "./jest-smoke-setup"` 1 줄 + JSDoc 5 줄, ~10 LOC).
   - (ii) `test/e2e/persons.e2e-spec.ts` 의 11 mock 호출 → real seed mechanical 변환 (~130 LOC delta — import 정리 / `let prisma` 도입 / 5 happy seed 변환 / 3 negative `count()` 변환 / 3 branch seed 변환 / `afterEach` truncate / `afterAll` $disconnect / JSDoc 갱신).
   - (iii) `test/jest-e2e.json` 에 `globalSetup` key 1 줄 추가 (~3 LOC).
   - (iv) `test/e2e/app.e2e-spec.ts` 호환 점검 — 예상 변경 0 LOC (만약 timing fail 발생 시 minimal 조정).
   - 합계 추정 ~150-180 LOC delta / 4 파일.
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. `pnpm test:e2e` 가 services.postgres 부재 환경 (local dev) 에서 DATABASE_URL fail-fast 발화 — local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존 (T-0053 과 동일 패턴). 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) jest-e2e-setup.ts re-export 패턴이 jest globalSetup 계약과 호환 안 됨 (예: TypeScript ts-jest 가 re-export default 를 globalSetup 으로 인식 못 함) → 별도 wrapper 함수 신설 결정 (b) app.e2e 가 services.postgres 부트 대기로 systematic fail (jest config 의 testTimeout 또는 jest globalSetup 의 health-poll 보강 필요). 둘 다 본 task plannerSource 박제 범위 안의 최소 결정 — implementer 직접 진행, architect escalation 0 예상.
