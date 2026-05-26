---
id: T-0059
title: parts.smoke-spec 신설 — PartController 5 endpoint real PostgreSQL bootstrap smoke
phase: P3
status: BLOCKED
commitMode: pr
coversReq: [REQ-028, REQ-029, REQ-058]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-05-26
plannerNote: P3 closure backbone — persons.smoke 패턴 mirror로 parts.smoke 신설. ADR-0004 §Decision real DB + afterEach truncate + jest-smoke-setup 재사용. e2e 분리.
dependsOn: [T-0046, T-0053]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: session #14 turn 6 — driver-supplied 후보 6 종 중 (a) Part smoke/e2e real PostgreSQL 확장 채택 + cap-discipline split. 단일 결합 task (smoke + e2e) 시 persons 선례 (T-0053 smoke 220 LOC + T-0054 e2e 150-180 LOC) 기준 ~370-400 LOC 예상 — cap 300 LOC 위협. T-0053/T-0054 의 ADR-first split 4-stage trajectory 패턴 직접 mirror — 본 T-0059 = parts.smoke 단독 (cap-safe ~220 LOC / 2 파일) + T-0060 (예정) = parts.e2e 단독 (~170-200 LOC / 2 파일). **분리 효과**: (i) persons.smoke (T-0053) 가 머지된 시점에 jest-smoke-setup.ts + db-truncate.ts + ci.yml services.postgres 인프라가 박제 완료 — 본 task 는 jest config / globalSetup helper / CI 변경 0, **순수 spec 신설만** (ii) parts.smoke 신설 후 jest-smoke.json 의 testRegex 가 자동 picking — wiring 변경 0 (iii) PartController 5 endpoint (GET / GET :id / GET :id/persons / POST / DELETE) 의 happy 5 + negative 3 + branch 2 = ~10 test (persons.smoke 의 9 test 와 동등 mass + GET :id/persons 1 endpoint 추가 cover) (iv) T-0046 PartService 가 박제한 P2002 (name unique 중복) / P2003 (소속 Person 1+ 일 때 delete) / P2025 (row 부재) 의 3 error 변환 분기가 실 PostgreSQL 의 FK constraint + unique constraint + record-not-found 발화로 첫 검증 — ADR-0004 §Decision 근거 2 (Prisma adapter / pg driver error 변환 path) 의 Part 도메인 확장 (v) findPersonsByPartId endpoint 가 Part-Person N:1 navigation 의 실 DB query 발화 검증 — REQ-028 invariant 의 reverse query path 박제. architect 호출 0 (ADR-0004 §Decision + §Cleanup 정책 모두 박제 완료, persons 패턴 1:1 reference, 새 의사결정 0). frontmatter: commitMode=pr / coversReq=[REQ-028 Part-Person N:1 invariant smoke layer, REQ-029 평가 자료 non-volatile durability Part 도메인 확장, REQ-058 운영 정책 underlying] / estimatedDiff=220 / estimatedFiles=2 / dependsOn=[T-0046 PartController/Service + T-0053 jest-smoke-setup 박제]. STATE.nextTask=T-0059.
---

# T-0059 — parts.smoke-spec 신설 (PartController 5 endpoint real PostgreSQL bootstrap smoke)

## Why

[T-0046](T-0046-part-service-controller-dto-backbone.md) 가 mergeCommit `2a314bc` 로 PartService + PartController + CreatePartDto + UserModule wiring 박제 완료 (Part 1:N service+controller backbone closure). 그 위에 [T-0053](T-0053-smoke-persons-real-postgres-cutover.md) 이 mergeCommit `888a960` 로 persons.smoke 의 real PostgreSQL cutover 박제 — `test/helpers/jest-smoke-setup.ts` globalSetup helper + `test/helpers/db-truncate.ts` afterEach hook + `test/jest-smoke.json` globalSetup wiring + CI services.postgres 인프라가 박제 완료.

**현재 상태의 gap**: parts 도메인 smoke spec 0 — `test/smoke/` 에 `app.smoke-spec.ts` + `persons.smoke-spec.ts` 2 파일만 존재. PartController 5 endpoint (GET / GET :id / GET :id/persons / POST / DELETE) 는 unit (`src/user/part.controller.spec.ts`) cover 만, smoke 차원의 bootstrap + DI wiring + HTTP routing + ValidationPipe + real PostgreSQL connection path 검증 0.

본 T-0059 는 [persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) 의 패턴을 1:1 mirror 해 `test/smoke/parts.smoke-spec.ts` 1 파일을 신설한다. jest-smoke-setup.ts / db-truncate.ts / jest-smoke.json / ci.yml services.postgres 등 모든 infra 가 박제 완료 — 본 task 는 **순수 spec 파일 1 개 신설 + JSDoc 박제** 로 cap-safe.

REQ 매핑:

- [REQ-028](../requirements.md) — Person ↔ Part N:1 invariant ("조직도 파트 정확히 1"). PartController 의 5 endpoint 가 본 invariant 의 controller-layer 박제 — 본 task 의 smoke 가 실 PostgreSQL 의 FK constraint (Part.persons RESTRICT) 발화를 검증.
- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. Part 도메인이 실 PostgreSQL durability path 발화 (persons 도메인 T-0053 박제 위에 Part 도메인 확장).
- [REQ-058](../requirements.md) — 운영 정책 underlying.

본 task 는 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md) (mock 의 unit-only 보조 유지 + smoke = real 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (afterEach truncate) 의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

## Required Reading

- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — **본 task 의 1차 reference 패턴**. describe + beforeAll(AppModule + PrismaService DI) + afterAll(app.close + prisma.$disconnect) + afterEach(truncateAll) + happy/negative/branch test 패턴 직접 mirror.
- [test/helpers/jest-smoke-setup.ts](../../test/helpers/jest-smoke-setup.ts) — globalSetup helper. 본 task 는 변경 0 — parts.smoke-spec 가 자동으로 본 setup 의 1 회 truncate 혜택을 받음.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry. `afterEach` 에서 호출 — Part / Person / PersonGroupMembership 5 테이블 동시 truncate.
- [test/jest-smoke.json](../../test/jest-smoke.json) — `testRegex: ".*\\.smoke-spec\\.ts$"` 가 본 task 신설 spec 을 자동 picking. wiring 변경 0.
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — 5 endpoint (GET / GET :id / GET :id/persons / POST 201 / DELETE 204) + Controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform).
- [src/user/part.service.ts](../../src/user/part.service.ts) — 5 메서드 (create / findAll / findById / delete / findPersonsByPartId) + P2002 / P2025 / P2003 의 3 error 변환 분기.
- [src/user/dto/create-part.dto.ts](../../src/user/dto/create-part.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `name` 1 필드.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Part.name `@unique` (P2002 source) + Person.partId nullable + Part → Person cascade `Restrict` (P2003 source).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Cleanup 정책 — 본 task 변경의 정책 reference.
- [docs/tasks/T-0053-smoke-persons-real-postgres-cutover.md](T-0053-smoke-persons-real-postgres-cutover.md) — 본 task 와 동일 패턴의 persons 선례. JSDoc 5 줄 박제 + R-112 4 종 cover + 5 종 grand validation 의 acceptance 직접 mirror.

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. parts.smoke-spec 신설

- [ ] `test/smoke/parts.smoke-spec.ts` 신설. persons.smoke-spec.ts 의 describe + beforeAll + afterAll + afterEach 구조 1:1 mirror.
- [ ] 본 spec module-level JSDoc 5 줄 박제 — (1) 책임 (PartController 5 endpoint bootstrap smoke + real PostgreSQL connection path) (2) smoke vs unit vs e2e 경계 (unit = part.controller.spec / part.service.spec / e2e = T-0060 책임) (3) ADR-0004 §Decision 실 DB 전략 reference (4) afterEach(truncateAll) 의 ADR-0004 §Cleanup 정책 박제 (5) testRegex 격리 (`.smoke-spec.ts` suffix → unit jest picking 0).
- [ ] beforeAll — `Test.createTestingModule({imports: [AppModule]}).compile()` + `app.init()` + `prisma = moduleRef.get<PrismaService>(PrismaService)`. mock override 0 — 실 PrismaService 가 services.postgres 의 localhost:5432 connection 발화.
- [ ] afterAll — `await app.close(); await prisma.$disconnect();` — connection 누수 방지.
- [ ] afterEach — `await truncateAll(prisma);` — test 간 state leak 0.

### B. Happy path 5 endpoint × 각 1+ test (R-112 happy 항목)

PartController 의 5 endpoint 각 1+ happy test. arrange 단계 `await prisma.part.create({data: {name: "..."}})` 로 실 row seed → endpoint 호출 → 응답 + 실 DB state 검증.

- [ ] **GET /api/parts** → 200 + body[0].id === seed.id + body[0].name === "조직도파트A". `PartService.findAll()` → `PartRepository.findMany()` → `prisma.part.findMany()` 실 발화.
- [ ] **GET /api/parts/:id** → 200 + body.id === seed.id + body.name 검증. `PartService.findById()` → `PartRepository.findById()` → `prisma.part.findUnique()` 실 발화.
- [ ] **GET /api/parts/:id/persons** → 200 + 실 DB 의 Part 소속 Person 목록 검증. arrange — Part 1 seed + Person 2 seed (`partId: <seed.id>`) → 응답 body 가 2 개 Person 박제, 각 id 검증. `PartService.findPersonsByPartId(id)` → `PartService.findById` (존재 검증) + `PersonRepository.findByPartId()` → `prisma.person.findMany({where:{partId,active:true}})` 실 발화.
- [ ] **POST /api/parts** → 201 + body.name === "조직도파트신규" + 실 DB 에 row 존재 확인 (`prisma.part.findUnique({where:{id:response.body.id}})` not null). ValidationPipe 가 `{name}` 통과 → `PartService.create()` → `PartRepository.create()` → `prisma.part.create()` 실 발화 + `@HttpCode(201)`.
- [ ] **DELETE /api/parts/:id** → 204 + body empty + 실 DB 에서 row 사라짐 확인 (`prisma.part.findUnique({where:{id:seed.id}})` null). 소속 Person 0 인 Part 만 seed → `PartService.delete()` → `prisma.part.delete()` 실 발화 + `@HttpCode(204)`.

### C. Negative path 3+ test (R-112 negative 항목 — 충분 cover)

- [ ] **GET /api/parts/missing** → 404. 실 DB 의 `prisma.part.findUnique` null 반환 → `PartService.findById()` NotFoundException throw.
- [ ] **POST /api/parts with empty body** → 400. ValidationPipe `@IsString` + `@IsNotEmpty` 위반 reject. + 실 DB 의 part count === 0 검증 (validation 차단으로 `prisma.part.create` 미호출).
- [ ] **POST /api/parts with non-whitelisted field** → 400. ValidationPipe `forbidNonWhitelisted: true` reject. + 실 DB 의 part count === 0 검증.

### D. Branch coverage — P2002 + P2003 변환 (R-112 branch 항목)

- [ ] **POST /api/parts with duplicate name** → 409. arrange — 첫 row seed 후 동일 name 으로 POST → 실 PostgreSQL 의 Part.name `@unique` constraint 가 P2002 발화 → `PartService.create()` ConflictException 변환 → 409 Conflict 자동 mapping. **본 분기가 실 DB 의 Prisma adapter / pg driver error 변환 path 의 Part 도메인 첫 실 검증** (ADR-0004 §Decision 근거 2 의 Part 도메인 확장).
- [ ] **DELETE /api/parts/:id with assigned persons** → 409. arrange — Part 1 + Person 1 seed (`partId: <seed.id>`) → DELETE Part → 실 PostgreSQL 의 FK constraint (Part → Person `Restrict`) 가 P2003 발화 → `PartService.delete()` ConflictException 변환 → 409. **본 분기가 REQ-028 invariant (Part 정확히 1 / dangling reference 차단) 의 schema-level enforce 실 검증** — Person.partId nullable 위에 service-layer + schema-layer 의 2-단 cover 박제.

### E. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: §B 5 endpoint 각 1+ — 5 happy test cover.
- [ ] **Error path test**: §C negative 3 test 가 ValidationPipe + NotFoundException 의 error path cover. PrismaService.onModuleInit 의 `$connect` 실패 케이스는 globalSetup helper 의 fail-fast 박제 (T-0053 §E 와 동일 boundary — globalSetup 의 error path 는 CI infra 의 자연 검증, 별도 unit spec 미작성).
- [ ] **Branch coverage**: §D P2002 + P2003 2 분기 cover. P2025 (DELETE missing id → 404) 분기는 본 task 가 추가하지 않음 — unit (part.service.spec.ts) 책임 boundary 유지. negative cases 충분 cover 로 §C + §D 합쳐 5 negative path cover.
- [ ] **Negative cases 충분 cover**: ValidationPipe 위반 2 종 (empty body / non-whitelisted field) + missing id 404 + duplicate name 409 + assigned persons 409 = 5 negative cover. 단일 negative 만으로 부족 함정 회피.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 본 task 는 production code 변경 0 (test 신설만) — src/** coverage 유지.

### F. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 본 task 신설 spec 이 jest-smoke.json testRegex 의 자동 picking 으로 실행, globalSetup → PrismaClient connect → truncateAll → disconnect → parts.smoke-spec 의 10 test (happy 5 + negative 3 + branch 2) 가 services.postgres 위에서 발화. 합계 smoke = app.smoke 2 + persons.smoke 9 + parts.smoke 10 = **21 test**.
- [ ] `pnpm test:e2e` 통과 — e2e 는 본 task 영향 0 (T-0060 책임), 기존 13 test green.

### G. 박제 / 후속 task 분리

- [ ] 본 task 의 §Out of Scope 가 T-0060 책임을 명확히 carve — parts.e2e-spec 신설 (HTTP contract depth + multi-step flow + 4xx envelope) 은 T-0060 책임.
- [ ] 본 task 의 §Follow-ups 에 T-0060 예상 scope 박제 (parts.e2e 단독 ~170-200 LOC / 2 파일).

## Out of Scope

본 task 는 parts 도메인의 **smoke 절반만** 박제. 다음은 명시적으로 후속 task 책임:

- **T-0060 (예정) — parts.e2e-spec 신설**: `test/e2e/parts.e2e-spec.ts` 신설 (persons.e2e-spec.ts 패턴 mirror) — HTTP contract depth + status + content-type + body shape + 4xx envelope (statusCode / error / message) + multi-step flow cover. e2e 차원 ~170-200 LOC / 2 파일 (spec + JSDoc).
- **groups 도메인 smoke/e2e 확장**: GroupController CRUD 4 + N:M 3 = 7 endpoint 의 smoke + e2e cover. 본 task scope 외 — 별도 후속 task (T-0061~T-0062 후보).
- **jest-smoke.json / jest-smoke-setup.ts / db-truncate.ts / ci.yml 변경 0**: T-0053 (smoke) + T-0052 (CI Postgres) 가 박제 완료. 본 task 는 spec 신설만.
- **PartController PATCH endpoint** / **추가 negative case (DELETE missing → 404 / GET :id/persons missing Part → 404)** — 본 task scope 외, unit / e2e 책임 boundary 유지.
- **AuthGuard (Admin+ / User+)** — 후속 P3 또는 P4 책임.
- **phase 2 src/user/*.spec migration** — prisma-mock.ts phase 2 fixture variant decision 동반 follow-up. 본 task scope 외.
- **PLAN.md / p3-implementation-plan §6 progress 갱신**: T-0058 ~ T-0059 closure 박제는 별도 doc-only direct task.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

## Blocker (HQ-0007, raised 2026-05-26T20:55:36+09:00)

**Reason**: `ci-trigger-missing` — GitHub Actions CI 가 T-0059 PR-54 의 4 trigger event (PR open + impl push b783382 + round-setup push 8f4a420 + reviewer/integrator 2 PR comments) 어디에서도 1h+ 동안 workflow_runs 0. 정상 latency 10-30s 대비 비정상. 타 PR / main CI 는 정상 작동 — branch claude/T-0059-smoke-parts-real-postgres 한정 또는 일시적 Actions 인프라 anomaly 의심.

**현재 상태**:
- impl commit b783382 (test/smoke/parts.smoke-spec.ts 신설, +293 LOC test-only) push 완료
- PR-54 (https://github.com/myungjoo/Assessment-Agent/pull/54) open + frontmatter status IN_PROGRESS + prNumber 54
- reviewer round 1 APPROVE comment + integrator self-check comment 모두 정상 post
- 4-게이트 (a) reviewer APPROVE / (b) PR comment 외부 존재 / (c) integrator self-check 통과
- 4-게이트 (d) CI green — **CI 미발화로 자동 검증 불가**

**Needed**: 사용자 결정 — HQ-0007 5 options ((a) retrigger-empty-commit / (b) diagnose-and-fix / (c) skip-ci-and-merge **권장 안 함** / (d) close-and-rework / (e) other) 중 1 선택 + (해당 시) 진단 결과 / 명령 지시.

**Resume path**: HQ-0007 resolved 후 driver turn 의 [1] 단계 humanQuestion 처리 → 결정에 따라 (a) 빈 commit push 또는 (b) 사용자 fix 후 retrigger / (c) gh pr merge 강행 / (d) PR close + branch 폐기 / (e) 별도 path. CI green 확보 후 integrator 4-게이트 final TRUE → `gh pr merge 54 --squash --delete-branch` → DONE bookkeeping.

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + jest-smoke-setup.ts + db-truncate.ts + persons.smoke 패턴 모두 박제 완료, 새 의사결정 0). 실 chain:

1. **implementer**: 1 파일 신설. `test/smoke/parts.smoke-spec.ts` (~220 LOC = JSDoc 5 줄 ~30 LOC + describe block ~190 LOC = beforeAll/afterAll/afterEach 헤더 ~30 LOC + happy 5 ~60 LOC + negative 3 ~40 LOC + branch 2 ~50 LOC + 빈 줄/주석 ~10 LOC).
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존. 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제. test:smoke 가 services.postgres 부재 환경 (local dev DATABASE_URL 미주입) 에서 fail-fast → CI sole validator.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) PartController endpoint 의 새 분기 발견 → ADR 갱신 (b) globalSetup 의 책임 분기 재결정 (c) Part-Person N:1 navigation 의 새 invariant 발견. 셋 다 본 task 의 frontmatter `plannerSource` 박제 범위 안에서 결정 완료 — implementer 직접 진행.
