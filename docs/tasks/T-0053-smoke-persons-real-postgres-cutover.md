---
id: T-0053
title: persons.smoke-spec real PostgreSQL cutover + jest globalSetup hook + mock 보조 표기 (ADR-0004 §Migration #4+#5 1차)
phase: P3
status: DONE
prNumber: 49
mergedAs: 888a960402c3aeff5387238308df7ff322949773
completedAt: 2026-05-26
reviewRounds: 1
commitMode: pr
coversReq: [REQ-029, REQ-058]
estimatedDiff: 220
estimatedFiles: 4
created: 2026-05-26
plannerNote: ADR-0004 §Migration #4+#5 의 smoke 절반만 박제 — persons.smoke-spec 실 DB 전환 + globalSetup truncate hook + prisma-mock JSDoc unit-only 표기. e2e 절반(persons.e2e+app.smoke/e2e)은 T-0054 분리. ~220 LOC / 4 파일.
dependsOn: [T-0051, T-0052]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/decisions/ADR-0004-smoke-e2e-db-mode.md §Migration 의무 #4+#5 (T-0051 mergeCommit 9109e65 ACCEPTED) + docs/tasks/T-0052 §Follow-ups "spec cutover T-0053 책임" (T-0052 mergeCommit e0f4a9c) + driver-supplied 후보 (b) split 옵션 — 실 측정 결과 persons.smoke-spec.ts (~210 LOC, 8 mock 호출) + persons.e2e-spec.ts (~264 LOC, 11 mock 호출) + globalSetup helper + 2 jest config edit = ~250-350 LOC / 6-7 파일 단일 task 시 cap (300 LOC / 5 파일) 위협. 본 T-0053 = smoke 절반 (persons.smoke 단독 + globalSetup 신설 + jest-smoke.json wiring + prisma-mock.ts JSDoc 박제) ~220 LOC / 4 파일. 후속 T-0054 = e2e 절반 (persons.e2e + jest-e2e.json wiring + app.smoke/app.e2e 점검 (DB 미사용 → afterEach 무관 / globalSetup 만 호환 검증)) ~150-180 LOC / 3-4 파일. **분리 효과**: (i) globalSetup truncate hook 패턴이 smoke 단독 검증 후 e2e 진입 시 reference 안정 — T-0052 helper 의 단독 spec 검증 → T-0053 의 smoke globalSetup 검증 → T-0054 의 e2e globalSetup 재사용 의 3-step incremental cutover (ii) persons.smoke-spec 의 8 mock 호출 → real seed 변환은 mechanical 하나 ValidationPipe + supertest interaction 의 real DB 동작 차이가 reviewer 검토 영역 — e2e 의 11 mock 변환 noise 와 분리 (iii) 각 task 가 round 1 단발 머지 후보로 유지 (cap 보존 + reviewer overhead 분산) (iv) T-0054 진입 시 T-0053 의 globalSetup 패턴이 박제되어 e2e 의 jest-e2e.json wiring 결정 simple (v) ADR-first split 의 4-stage trajectory 완성 박제 (T-0051 ADR / T-0052 infra+helper / T-0053 smoke cutover / T-0054 e2e cutover). architect 호출 0 (ADR-0004 §Decision + §Cleanup 정책 + §Migration 의무 #4 + db-truncate.ts helper signature 박제 완료, 새 의사결정 0). coversReq=[REQ-029 (실 PostgreSQL durability + Prisma adapter 실 동작 path 의 smoke 단계 발화) + REQ-058 (CI 정책 박제 long-horizon 일관성)]. dependsOn=[T-0051 ADR, T-0052 helper+CI services]. STATE.nextTask=T-0053.
---

# T-0053 — persons.smoke-spec real PostgreSQL cutover + jest globalSetup hook + mock 보조 표기

## Why

[T-0052](T-0052-ci-postgres-services-and-db-truncate-helper.md) 이 머지한 mergeCommit `e0f4a9c` 로 [ADR-0004](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Migration 의무 5 항목 중 **#1 (services.postgres)** + **#2 (DATABASE_URL env)** + **#3 (migrate deploy step)** + **#5 helper 부분** ([test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts)) 가 박제되었다. 잔여 항목:

- **#4 — smoke/e2e 4 spec 의 `Test.overrideProvider(PrismaService)` 제거 + 실 seed 전환**
- **#5 hook 부분 — `test/jest-smoke.json` / `test/jest-e2e.json` 의 `globalSetup` / `afterEach` 에서 `truncateAll(prisma)` 호출 부착**

본 T-0053 은 위 잔여 2 항목의 **smoke 절반만** 박제한다. e2e 절반은 후속 T-0054 책임 (분리 사유는 frontmatter `plannerSource` 참조 — 실 측정 결과 단일 task 시 ~250-350 LOC / 6-7 파일로 cap 위협).

본 task 의 변경은 모두 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md) (mock 의 unit-only 보조 유지 + smoke = real 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (`afterEach` truncate) 의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

REQ 매핑:

- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. 본 task 머지 시점부터 `persons.smoke-spec` 의 5 endpoint × happy/negative test 가 **실 PostgreSQL durability path + Prisma adapter pg connection pool + DB constraint (unique / foreign key) 실 발화** 를 검증 (ADR-0004 §Decision 근거 1+2). T-0052 가 박제한 services.postgres + migrate deploy step 의 효력이 본 task 머지 시점부터 발화.
- [REQ-058](../requirements.md) — 운영 정책 underlying. CI 정책 박제의 long-horizon 일관성.

## Required Reading

- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Consequences + §Cleanup 정책 — mock unit-only 보조 / smoke real 고정 / afterEach truncate 결정 reference.
- [docs/tasks/T-0052-ci-postgres-services-and-db-truncate-helper.md](T-0052-ci-postgres-services-and-db-truncate-helper.md) — 박제된 helper + CI infra (services.postgres + DATABASE_URL + migrate deploy step).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry. 본 task 의 globalSetup / afterEach 가 호출하는 helper.
- [test/helpers/db-truncate.spec.ts](../../test/helpers/db-truncate.spec.ts) — helper 검증 reference (호출 시그니처 + SQL 동작 박제).
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — JSDoc 갱신 대상 (unit-only 보조 위상 박제 + smoke/e2e migration timeline 박제).
- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — cutover 대상 (8 mock 호출 + 1 ValidationPipe 검증 + 1 P2002 branch).
- [test/smoke/app.smoke-spec.ts](../../test/smoke/app.smoke-spec.ts) — DB 미사용 (GET / 만) — 본 task 의 globalSetup 호환 확인 (변경 0 또는 1-2 LOC).
- [test/jest-smoke.json](../../test/jest-smoke.json) — `globalSetup` 키 추가 대상.
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — `PrismaService` lifecycle (onModuleInit `$connect`) + `buildPrismaAdapter()` factory 의 `process.env.DATABASE_URL` 의존.
- [src/user/person.service.ts](../../src/user/person.service.ts) — P2002 / P2025 error handling. 실 DB 의 unique constraint 가 P2002 발화 → ConflictException 변환 path 가 본 task smoke 의 분기 cover 대상.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Person.email `@unique` constraint (P2002 발화 source) + Person.partId nullable + Part / Group / PersonGroupMembership relation.
- [package.json](../../package.json) `jest` 의 testPathIgnorePatterns (`<rootDir>/test/smoke/` 제외 — 본 task 의 globalSetup 도 같은 ignore 적용 검증).

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. globalSetup helper 신설 (jest hook source)

- [ ] `test/helpers/jest-smoke-setup.ts` (또는 동등 이름 — `globalSetup.ts` 충돌 회피, `.spec.ts` testRegex 미매칭 검증) 신설. 본 파일은 jest `globalSetup` key 에서 호출되어 **모든 smoke spec 실행 직전 1 회** 발화.
- [ ] 본 helper 의 책임 (3 항목):
  1. PrismaClient (또는 PrismaService) 인스턴스 1 회 생성 + `$connect()` — services.postgres container 가 ready 상태 확인.
  2. `truncateAll(prisma)` 1 회 호출 — 직전 CI run 의 dirty data 가 남아있을 가능성 0 보장 (CI 의 `services:` 는 매 job 새로 생성되므로 깨끗하나 local dev 안정성 보장).
  3. `await prisma.$disconnect()` — globalSetup 의 connection 누수 방지.
- [ ] 본 helper 가 `process.env.DATABASE_URL` 미설정 시 명시 error throw — fail-fast 패턴 ([prisma.service.ts §38](../../src/persistence/prisma.service.ts) 의 `buildPrismaAdapter()` 패턴 mirror).
- [ ] 본 helper 의 JSDoc 5 줄 박제 — (1) 책임 (2) jest config 의 `globalSetup` key 참조 (3) ADR-0004 §Cleanup 정책 박제 (4) e2e 와의 책임 분리 (T-0054 책임) (5) DATABASE_URL env requirement.

### B. persons.smoke-spec real DB cutover

- [ ] `test/smoke/persons.smoke-spec.ts` 의 `Test.overrideProvider(PrismaService).useValue(mockPrisma)` 제거 — 실 PrismaService 가 services.postgres 의 localhost:5432 에 connection 발화.
- [ ] `buildMockPrismaService` / `buildPersonFixture` / `buildPrismaError` import 4 entry 삭제 — 본 spec 은 real DB 로 전환되어 mock helper 의존 0.
- [ ] 5 happy endpoint test (`GET /api/persons` / `GET /api/persons/:id` / `POST /api/persons` / `PATCH /api/persons/:id` / `DELETE /api/persons/:id`) 가 **실 seed → 실 query 발화 → 응답 검증** 패턴으로 재작성:
  - `beforeAll` 또는 각 test 의 `arrange` 단계에서 `await prisma.person.create({data: {...}})` 로 실 row seed.
  - assertion 은 mock return 값 대신 실 DB query 결과 검증 (예: `GET /api/persons` 의 body[0].id 가 seed 된 row 의 id).
  - `POST /api/persons` 는 body 에서 받은 응답이 실 DB 의 새 row 인지 확인 (예: 후속 `findUnique` 또는 응답 id 의 row 가 DB 에 존재).
- [ ] negative test 3 (`GET /api/persons/missing` → 404 / `POST {}` → 400 / `POST extra field` → 400) 는 mock 의존 제거 후에도 의미 보존 — ValidationPipe 검증은 controller 진입 전 발화로 DB query 미발화, 404 는 실 DB 의 `findUnique` 가 null 반환.
- [ ] branch test (`PATCH duplicate email` → 409) 는 실 PostgreSQL 의 unique constraint (Person.email `@unique`) 가 P2002 발화 → PersonService 가 ConflictException 변환 → 409 mapping. **본 분기가 실 DB 의 Prisma adapter / pg driver error 변환 path 의 첫 실 검증** (ADR-0004 §Decision 근거 2 의 cover).
- [ ] `afterEach(async () => { await truncateAll(prisma); })` hook 추가 — 각 test 후 5 테이블 truncate 로 test 간 state leak 0 (ADR-0004 §Cleanup 정책 박제).
- [ ] `afterAll(async () => { await app.close(); await prisma.$disconnect(); })` 갱신 — PrismaService 의 connection 누수 방지 (실 DB 로 전환되어 connection lifecycle 명시 의무).
- [ ] **test 개수 보존** — 기존 9 test (happy 5 + negative 3 + branch 1) 모두 유지. test 삭제 0 / 추가 0 / intent 변경 0 — 변환은 mechanical mock → real seed.

### C. test/jest-smoke.json wiring

- [ ] `test/jest-smoke.json` 에 `globalSetup` key 추가, 값은 본 task A 항목의 helper 파일 상대 경로 (`<rootDir>/test/helpers/jest-smoke-setup.ts`).
- [ ] `testPathIgnorePatterns` 또는 `testRegex` 가 `test/helpers/*.ts` 를 spec 으로 pickup 하지 않음을 검증 — 본 helper 파일은 `.spec.ts` / `.smoke-spec.ts` 의 어떤 regex 도 매칭하지 않는 이름이어야 함.

### D. prisma-mock.ts JSDoc 갱신 (unit-only 보조 표기 박제)

- [ ] `test/helpers/prisma-mock.ts` 의 module-level JSDoc 에 다음 3 줄 추가:
  1. "unit-only 보조 — smoke/e2e 는 T-0053 이후 real PrismaService 사용 (ADR-0004 §Decision 박제)."
  2. "본 mock 의 위상: deprecated 가 아닌 unit-only 보조 — Prisma error code 변환 분기 (P2002 / P2025 / P2003 / unknown) 의 explicit 박제로 R-112 negative case cover 에 유리 (ADR-0004 §Decision 의 mock 위상 결정)."
  3. "smoke/e2e 의 import 제거 시점: T-0053 (smoke) / T-0054 (e2e) 머지 시점."

### E. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: persons.smoke 의 5 endpoint × 각 1+ happy test (real seed → query 발화 → 응답 검증) — 본 task B 항목으로 cover.
- [ ] **Error path test**: PrismaService.onModuleInit 의 `$connect` 실패 케이스 — DATABASE_URL 미설정 시 globalSetup 의 fail-fast 발화. 본 항목은 globalSetup helper 의 JSDoc 박제 + spec 미신설 (CI 환경에서 의도적 DATABASE_URL 누락 발화 불가). 분기 분리 명시 — "globalSetup helper 의 error path 는 CI infra 의 자연 검증 (DATABASE_URL 미주입 시 services.postgres 부트 실패 → CI fail) 으로 cover, 별도 unit spec 미작성 — globalSetup 은 jest 의 `globalSetup` 단계에서만 호출되어 unit-test 패턴 부적합".
- [ ] **Branch coverage**: `PATCH duplicate email` 의 P2002 → 409 분기는 실 DB 의 unique constraint 발화로 cover. NotFoundException (P2025) 분기는 smoke 의 happy-path delete 후 재조회 또는 PATCH/DELETE missing id 의 1+ test 로 cover (현재 persons.smoke 에 명시 분기 없음 — 본 task 가 추가하지 않음, e2e 책임 boundary 유지).
- [ ] **Negative cases 충분 cover**: 3 negative (missing id 404 / empty body 400 / non-whitelisted field 400) 유지 + 본 task 의 real DB 전환으로 ValidationPipe 의 실 동작 + Prisma 의 실 not-found path 가 검증 (mock 대비 cover 확장).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%) — 본 task 는 production code 변경 0 (test 변경만) 이므로 src/** coverage 유지. globalSetup helper 는 `coveragePathIgnorePatterns` 의 `test/` 외부 매칭 0 (실 위치 `test/helpers/jest-smoke-setup.ts`) 으로 coverage 통계 영향 0.

### F. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용 — 기존 패턴).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%) — src coverage 유지.
- [ ] `pnpm test:smoke` 통과 — 본 task 가 도입한 globalSetup + persons.smoke 의 real DB 전환이 services.postgres 위에서 발화. **본 task 머지 시점이 ADR-0004 §Decision 의 REQ-029 정합 검증 path 첫 실 발화 시점**.
- [ ] `pnpm test:e2e` 통과 — e2e 는 본 task 시점에 mock override 유지 (T-0054 책임), 기존 13 test green.

### G. 박제 / 후속 task 분리

- [ ] 본 task 의 §Out of Scope 가 T-0054 책임을 명확히 carve — e2e 4 spec (app.smoke / persons.smoke 의 e2e 차원 / app.e2e / persons.e2e) 의 real DB 전환 + jest-e2e.json globalSetup wiring 은 T-0054 책임.
- [ ] 본 task 의 §Follow-ups 에 T-0054 예상 scope 박제 (e2e 절반 ~150-180 LOC / 3-4 파일).

## Out of Scope

본 task 는 ADR-0004 §Migration 의무 5 항목 중 **smoke 절반만** 박제. 다음은 명시적으로 후속 task 책임:

- **T-0054 (예정) — e2e 절반**: `test/e2e/persons.e2e-spec.ts` 의 mock override 제거 + 실 seed 전환 (11 mock 호출 변환) + `test/jest-e2e.json` 의 globalSetup wiring + `test/e2e/app.e2e-spec.ts` 의 호환 검증 (DB 미사용이라 변경 최소).
- **`test/smoke/app.smoke-spec.ts` 의 실 변경 0**: 본 spec 은 `GET /` 만 cover (DB query 0), 본 task 의 globalSetup 부착 후에도 동작 보존. 단 globalSetup 이 모든 smoke spec 실행 직전 발화하므로 app.smoke 도 services.postgres 부트 의존이 생긴다 — 이는 자연 의도, 별도 분리 0. (만약 app.smoke 가 DATABASE_URL 미주입 시 globalSetup fail 로 영향 받으면 본 task 안에서 처리 — 다만 CI 는 env 주입 보장으로 무영향 예상.)
- **mock helper 의 deprecated 마킹 / 제거**: ADR-0004 §Decision 의 mock 위상 = unit-only 보조 유지 (deprecated 아님). 본 task 는 JSDoc 박제만 — 실 제거 0.
- **GroupController / GroupService N:M membership add/remove endpoints**: backbone 진척 영역 — 본 task scope 외, 별도 task (T-0055+).
- **Phase 2 src/user/*.spec migration**: prisma-mock.ts 의 phase 2 fixture variant decision 동반 follow-up — 본 task scope 외.
- **PLAN.md / p3-implementation-plan §6 progress 갱신**: T-0051~T-0053 closure 박제는 별도 doc-only direct task.
- **추가 unique constraint / cascade test**: real DB 전환의 첫 진입은 기존 9 test 보존만 — 새 분기 cover 는 본 task scope 외, T-0054 또는 후속 task 책임.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + db-truncate helper signature 모두 박제 완료, 새 의사결정 0). 실 chain:

1. **implementer**: 4 파일 변경 박제. (i) `test/helpers/jest-smoke-setup.ts` 신설 (PrismaClient connect + truncateAll + disconnect + JSDoc 5 줄, ~40 LOC) (ii) `test/smoke/persons.smoke-spec.ts` 의 9 test mock → real seed 변환 (~130 LOC delta, before/after net 비교 시 +30-50 LOC) (iii) `test/jest-smoke.json` 에 `globalSetup` key 1 줄 추가 (~3 LOC) (iv) `test/helpers/prisma-mock.ts` JSDoc 3 줄 추가 (~5 LOC). 합계 추정 ~220 LOC delta / 4 파일.
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. `pnpm test:smoke` 가 services.postgres 부재 환경 (local dev) 에서 fail 가능 — local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존. 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) globalSetup helper 의 책임 분기 결정에 ADR 갱신 필요 (b) jest config 의 globalSetup vs globalTeardown 분리 필요 (c) DATABASE_URL env handling 의 새 분기 박제 필요. 셋 다 본 task 의 frontmatter `plannerSource` 박제 범위 안에서 결정 완료 — implementer 직접 진행.
