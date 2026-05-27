---
id: T-0061
title: groups.smoke-spec 신설 — GroupController 7 endpoint real PostgreSQL bootstrap smoke
phase: P3
status: DONE
commitMode: pr
prNumber: 57
prUrl: https://github.com/myungjoo/Assessment-Agent/pull/57
prHead: claude/T-0061-smoke-groups-real-postgres
implCommit: 0cd28f4
mergedAs: 2238e51fea594f879563a35af03e15f790565786
completedAt: 2026-05-27
reviewRounds: 1
coversReq: [REQ-028, REQ-029, REQ-051, REQ-058]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-05-27
plannerNote: P3 backbone — Group 도메인 smoke 절반 박제 (Person/Part 평행 확장). GroupController N:M 3 endpoint 의 real DB P2002 첫 발화. e2e 분리.
dependsOn: [T-0055, T-0056, T-0057, T-0059]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: session #17 turn 1 — driver-supplied 후보 6 종 중 (a) Group smoke/e2e 확장 채택. **선정 사유**: (i) 자연 follow-up sequence — Person 도메인 (T-0053 smoke / T-0054 e2e) + Part 도메인 (T-0059 smoke / T-0060 e2e) 의 1:1 patterned mirror 위에 Group 도메인 평행 확장. ADR-first split 4-stage trajectory 의 3 번째 entity 도메인 closure. (ii) cap-discipline split — 단일 결합 task (smoke + e2e) 시 GroupController 7 endpoint × 평균 mass (persons.smoke T-0053 actual ~210 LOC + parts.smoke T-0059 actual ~290 LOC) → ~470 LOC 위협, cap 300 초과. T-0059/T-0060 ADR-first split 패턴 직접 mirror — 본 T-0061 = groups.smoke 단독 (~260 LOC / 1 파일, cap-safe) + T-0062 (예정) = groups.e2e 단독 (~220-260 LOC / 1 파일). (iii) **REQ-028 N:M invariant 의 smoke-layer 첫 박제** — Group ↔ Person N:M middle table (PersonGroupMembership) 의 POST :id/members / DELETE :id/members/:membershipId / GET :id/persons 3 endpoint 가 real PostgreSQL 위에서 첫 발화. unit (group.controller.spec / group.service.spec mock-based) cover 만 박제 상태, smoke 차원의 PersonGroupMembership `@@unique([personId, groupId])` constraint 의 P2002 첫 실 검증. (iv) **REQ-051 다중 group 소속 invariant** — '한 인원은 임의 group 다중 소속 가능' 의 service-layer 박제 (T-0056) + controller-layer 박제 (T-0057) 위에 real DB smoke 박제 — Group 2 + Person 1 + Membership 2 row seed 로 invariant 직접 검증 가능. (v) cap 안전 envelope — estimate 260 LOC = JSDoc 30 + describe header 30 + happy 7 endpoint ~90 + negative 3 ~40 + branch 1 (P2002 N:M unique) ~30 + 빈 줄/주석 ~40, persons.smoke (T-0053 actual 210) + parts.smoke (T-0059 actual 290) 의 평균 250 + 1 추가 endpoint 의 N:M mass 박제 = ~260. (vi) architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + jest-smoke-setup.ts + db-truncate.ts + persons/parts.smoke 패턴 모두 박제 완료, 새 의사결정 0. frontmatter: commitMode=pr / coversReq=[REQ-028, REQ-029, REQ-051, REQ-058] / estimatedDiff=260 / estimatedFiles=1 / dependsOn=[T-0055 GroupController CRUD, T-0056 GroupService N:M 3 ops, T-0057 GroupController N:M 3 endpoint, T-0059 parts.smoke 패턴 직전 mirror]. STATE.nextTask=T-0061.
---

# T-0061 — groups.smoke-spec 신설 (GroupController 7 endpoint real PostgreSQL bootstrap smoke)

## Why

[T-0055](T-0055-group-controller-dto-crud.md) (mergeCommit `df62aff`) 가 GroupController CRUD 4 endpoint + CreateGroupDto + UserModule wiring 박제 → [T-0056](T-0056-group-service-nm-membership-ops.md) (mergeCommit `abb70a7`) 가 GroupService 의 N:M 3 메서드 (addMember / removeMember / findPersonsByGroupId) 박제 → [T-0057](T-0057-group-controller-nm-membership-endpoints.md) (mergeCommit `ccd1042`) 가 GroupController 의 N:M 3 endpoint + AddMemberDto 박제 — Group 도메인 controller-layer **7 endpoint 박제 완료**. 그러나 real-DB 통합 검증 (smoke / e2e) 은 **부재**.

**현재 상태의 gap**: groups 도메인 smoke spec 0 — `test/smoke/` 에 `app.smoke-spec.ts` + `persons.smoke-spec.ts` (T-0053) + `parts.smoke-spec.ts` (T-0059) 3 파일만 존재. GroupController 7 endpoint (GET / GET :id / GET :id/persons / POST / POST :id/members / DELETE :id / DELETE :id/members/:membershipId) 는 unit (`src/user/group.controller.spec.ts`) mock cover 만, smoke 차원의 bootstrap + DI wiring + HTTP routing + ValidationPipe + real PostgreSQL connection path + PersonGroupMembership `@@unique([personId, groupId])` constraint 의 P2002 실 발화 검증 0.

본 T-0061 는 [parts.smoke-spec.ts](../../test/smoke/parts.smoke-spec.ts) 의 패턴을 1:1 mirror 해 `test/smoke/groups.smoke-spec.ts` 1 파일을 신설한다. jest-smoke-setup.ts / db-truncate.ts / jest-smoke.json (maxWorkers:1 race fix 포함) / ci.yml services.postgres 등 모든 infra 가 박제 완료 — 본 task 는 **순수 spec 파일 1 개 신설 + JSDoc 박제** 로 cap-safe.

REQ 매핑:

- [REQ-028](../requirements.md) — Group ↔ Person N:M invariant ("한 인원은 임의 group 다중 소속 가능"). GroupController 의 7 endpoint 가 본 invariant 의 controller-layer 박제 — 본 task 의 smoke 가 실 PostgreSQL 의 N:M middle table (PersonGroupMembership `@@unique([personId, groupId])`) 발화를 검증.
- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. Group 도메인이 실 PostgreSQL durability path 발화 (persons 도메인 T-0053 + parts 도메인 T-0059 박제 위에 Group 도메인 확장).
- [REQ-051](../requirements.md) — '한 인원은 임의 group 다중 소속 가능'. 본 task 의 happy path 시나리오에서 Group 2 + Person 1 + Membership 2 row seed 로 multi-membership invariant 검증.
- [REQ-058](../requirements.md) — 운영 정책 underlying.

본 task 는 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md) (mock 의 unit-only 보조 유지 + smoke = real 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (afterEach truncate) 의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

## Required Reading

- [test/smoke/parts.smoke-spec.ts](../../test/smoke/parts.smoke-spec.ts) — **본 task 의 1차 reference 패턴**. describe + beforeAll(AppModule + PrismaService DI) + afterAll(app.close + prisma.$disconnect) + afterEach(truncateAll) + happy/negative/branch test 패턴 직접 mirror.
- [test/smoke/persons.smoke-spec.ts](../../test/smoke/persons.smoke-spec.ts) — 2차 reference. CRUD 패턴 + ValidationPipe negative cover.
- [test/helpers/jest-smoke-setup.ts](../../test/helpers/jest-smoke-setup.ts) — globalSetup helper. 본 task 는 변경 0 — groups.smoke-spec 가 자동으로 본 setup 의 1 회 truncate 혜택을 받음.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry (Group + PersonGroupMembership 포함). `afterEach` 에서 호출.
- [test/jest-smoke.json](../../test/jest-smoke.json) — `testRegex: ".*\\.smoke-spec\\.ts$"` + `maxWorkers: 1` (T-0059 race fix) — 본 task 신설 spec 을 자동 picking. wiring 변경 0.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — 7 endpoint (GET / GET :id / GET :id/persons / POST 201 / POST :id/members 201 / DELETE :id 204 / DELETE :id/members/:membershipId 204) + Controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform).
- [src/user/group.service.ts](../../src/user/group.service.ts) — 7 메서드 + N:M 3 메서드의 P2002 (membership unique) / P2003 (personId/groupId race window) / P2025 (row 부재) 변환 분기.
- [src/user/dto/create-group.dto.ts](../../src/user/dto/create-group.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `name` 1 필드.
- [src/user/dto/add-member.dto.ts](../../src/user/dto/add-member.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `personId` 1 필드.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Group entity + PersonGroupMembership entity (`@@unique([personId, groupId])` — P2002 source). Group.name 에는 `@unique` 미정의 — POST duplicate name 분기 없음.
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Cleanup 정책 — 본 task 변경의 정책 reference.
- [docs/tasks/T-0059-smoke-parts-real-postgres.md](T-0059-smoke-parts-real-postgres.md) — 본 task 와 동일 패턴의 parts 선례. JSDoc 5 줄 박제 + R-112 4 종 cover + 5 종 grand validation 의 acceptance 직접 mirror.

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. groups.smoke-spec 신설

- [ ] `test/smoke/groups.smoke-spec.ts` 신설. parts.smoke-spec.ts 의 describe + beforeAll + afterAll + afterEach 구조 1:1 mirror.
- [ ] 본 spec module-level JSDoc 5 줄 박제 — (1) 책임 (GroupController 7 endpoint bootstrap smoke + real PostgreSQL connection path + N:M middle table P2002 발화 검증) (2) smoke vs unit vs e2e 경계 (unit = group.controller.spec / group.service.spec / e2e = T-0062 책임) (3) ADR-0004 §Decision 실 DB 전략 reference (4) afterEach(truncateAll) 의 ADR-0004 §Cleanup 정책 박제 (5) testRegex 격리 (`.smoke-spec.ts` suffix → unit jest picking 0).
- [ ] beforeAll — `Test.createTestingModule({imports: [AppModule]}).compile()` + `app.init()` + `prisma = moduleRef.get<PrismaService>(PrismaService)`. mock override 0 — 실 PrismaService 가 services.postgres 의 localhost:5432 connection 발화.
- [ ] afterAll — `await app.close(); await prisma.$disconnect();` — connection 누수 방지.
- [ ] afterEach — `await truncateAll(prisma);` — test 간 state leak 0.

### B. Happy path 7 endpoint × 각 1+ test (R-112 happy 항목)

GroupController 의 7 endpoint 각 1+ happy test. arrange 단계에서 `await prisma.group.create({data: {name: "..."}})` / `await prisma.person.create({...})` / `await prisma.personGroupMembership.create({...})` 로 실 row seed → endpoint 호출 → 응답 + 실 DB state 검증.

- [ ] **GET /api/groups** → 200 + body[0].id === seed.id + body[0].name === "그룹A". `GroupService.findAll()` → `GroupRepository.findMany()` → `prisma.group.findMany()` 실 발화.
- [ ] **GET /api/groups/:id** → 200 + body.id + body.name 검증. `GroupService.findById()` → `prisma.group.findUnique()` 실 발화.
- [ ] **GET /api/groups/:id/persons** → 200 + 실 DB 의 Group 소속 Person 목록 검증. arrange — Group 1 seed + Person 2 seed + Membership 2 seed (personId 별 1 row) → 응답 body 가 2 Person 박제, 각 id 검증. **REQ-028 N:M middle table indirect navigation 의 reverse query path 박제**. `GroupService.findPersonsByGroupId(id)` → `PersonGroupMembershipRepository.findByGroupId()` + `PersonRepository.findById()` loop → 실 prisma multi-query 발화.
- [ ] **POST /api/groups** → 201 + body.name === "신규그룹" + 실 DB 에 row 존재 확인 (`prisma.group.findUnique({where:{id:response.body.id}})` not null). ValidationPipe 통과 → `GroupService.create()` → `prisma.group.create()` 실 발화 + `@HttpCode(201)`.
- [ ] **POST /api/groups/:id/members** → 201 + body.personId + body.groupId === path id + 실 DB 에 membership row 존재. arrange — Group 1 seed + Person 1 seed → POST `{personId: <person.id>}` → `GroupService.addMember(groupId, personId)` → Group/Person 존재 사전 검증 + `prisma.personGroupMembership.create()` 실 발화 + `@HttpCode(201)`.
- [ ] **DELETE /api/groups/:id** → 204 + body empty + 실 DB 에서 row 사라짐 확인. 소속 membership 0 인 Group 만 seed → `GroupService.delete()` → `prisma.group.delete()` 실 발화 + `@HttpCode(204)`. (PersonGroupMembership cascade 가 schema 차원 처리 — assigned persons 시 409 분기 없음, 단순 delete.)
- [ ] **DELETE /api/groups/:id/members/:membershipId** → 204 + body empty + 실 DB 에서 membership row 사라짐 + Group/Person 자체는 보존 확인. arrange — Group 1 + Person 1 + Membership 1 seed → DELETE membership id → `GroupService.removeMember(membershipId)` → `prisma.personGroupMembership.delete()` 실 발화 + `@HttpCode(204)`.

### C. Negative path 3+ test (R-112 negative 항목 — 충분 cover)

- [ ] **GET /api/groups/missing-id** → 404. 실 DB 의 `prisma.group.findUnique` null 반환 → `GroupService.findById()` NotFoundException throw.
- [ ] **POST /api/groups with empty body** → 400. ValidationPipe `@IsString` + `@IsNotEmpty` 위반 reject. + 실 DB 의 group count === 0 검증 (validation 차단으로 `prisma.group.create` 미호출).
- [ ] **POST /api/groups/:id/members with empty body** → 400. ValidationPipe `personId` decorator (`@IsString` + `@IsNotEmpty`) 위반 reject. + 실 DB 의 membership count === 0 검증. AddMemberDto 의 ValidationPipe 발화 path 박제.

### D. Branch coverage — N:M P2002 변환 (R-112 branch 항목)

- [ ] **POST /api/groups/:id/members with duplicate (personId, groupId) pair** → 409. arrange — Group 1 + Person 1 seed + Membership 1 seed (동일 personId + groupId 1 회) → 두번째 POST 같은 personId 로 → 실 PostgreSQL 의 PersonGroupMembership `@@unique([personId, groupId])` constraint 가 P2002 발화 → `GroupService.addMember()` ConflictException 변환 → 409 Conflict 자동 mapping. **본 분기가 실 DB 의 Prisma adapter / pg driver error 변환 path 의 Group N:M 도메인 첫 실 검증** (ADR-0004 §Decision 근거 2 의 Group 도메인 확장 + REQ-028 N:M invariant 의 schema-level enforce).

### E. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: §B 7 endpoint 각 1+ — 7 happy test cover (parts.smoke 5 + 2 추가 endpoint).
- [ ] **Error path test**: §C negative 3 test 가 ValidationPipe + NotFoundException 의 error path cover. PrismaService.onModuleInit 의 `$connect` 실패 케이스는 globalSetup helper 의 fail-fast 박제 (T-0053/T-0059 §E 와 동일 boundary — globalSetup 의 error path 는 CI infra 의 자연 검증, 별도 unit spec 미작성).
- [ ] **Branch coverage**: §D P2002 N:M unique 1 분기 cover. P2025 (DELETE missing membershipId → 404) / P2003 (race window 사이 Person delete) 분기는 본 task 가 추가하지 않음 — unit (group.service.spec.ts) 책임 boundary 유지. Group.name 에는 `@unique` 미정의 — POST duplicate name 분기 부재 (parts.smoke 와 차이점, 명시적 박제). negative cases 충분 cover 로 §C + §D 합쳐 4 negative path cover.
- [ ] **Negative cases 충분 cover**: ValidationPipe 위반 2 종 (group empty body / member empty body) + missing id 404 + duplicate membership 409 = 4 negative cover. 단일 negative 만으로 부족 함정 회피.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 본 task 는 production code 변경 0 (test 신설만) — src/** coverage 유지.

### F. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용 — T-0059 lesson).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 본 task 신설 spec 이 jest-smoke.json testRegex 의 자동 picking 으로 실행, globalSetup → PrismaClient connect → truncateAll → disconnect → groups.smoke-spec 의 ~11 test (happy 7 + negative 3 + branch 1) 가 services.postgres 위에서 발화. 합계 smoke = app.smoke 2 + persons.smoke 9 + parts.smoke 10 + groups.smoke 11 = **약 32 test**. maxWorkers:1 (T-0059 race fix) 가 cross-file truncate race 사전 차단.
- [ ] `pnpm test:e2e` 통과 — e2e 는 본 task 영향 0 (T-0062 책임), 기존 13 test green.

### G. 박제 / 후속 task 분리

- [ ] 본 task 의 §Out of Scope 가 T-0062 책임을 명확히 carve — groups.e2e-spec 신설 (HTTP contract depth + multi-step flow + 4xx envelope + N:M 3 endpoint contract) 은 T-0062 책임.
- [ ] 본 task 의 §Follow-ups 에 T-0062 예상 scope 박제 (groups.e2e 단독 ~220-260 LOC / 1 파일).

## Out of Scope

본 task 는 groups 도메인의 **smoke 절반만** 박제. 다음은 명시적으로 후속 task 책임:

- **T-0062 (예정) — groups.e2e-spec 신설**: `test/e2e/groups.e2e-spec.ts` 신설 (parts.e2e-spec.ts T-0060 패턴 mirror) — HTTP contract depth + status + content-type + body shape + 4xx envelope (statusCode / error / message) + multi-step flow (POST member → GET persons → DELETE member → GET persons empty) cover. e2e 차원 ~220-260 LOC / 1 파일.
- **REQ-051 multi-membership invariant 의 unit-level 직접 cover**: 본 task 가 GET :id/persons happy 에서 multi seed 박제하나, group.service.spec.ts 의 unit mock 차원 직접 검증은 별도 follow-up.
- **jest-smoke.json / jest-smoke-setup.ts / db-truncate.ts / ci.yml 변경 0**: T-0053 / T-0052 / T-0059 가 박제 완료. 본 task 는 spec 신설만.
- **GroupController PATCH endpoint** / **추가 negative case (DELETE missing → 404 / GET :id/persons missing Group → 404 / POST :id/members missing groupId → 404 / wrong type → 400)** — 본 task scope 외, unit / e2e 책임 boundary 유지.
- **AuthGuard (Admin+ / User+)** — 후속 P3 또는 P4 책임. driver-supplied 후보 (e) AuthGuard ADR + 첫 적용은 본 task 의 sister task — 별도 task 로 분리.
- **CRLF/Windows worktree 정책 ADR** — driver-supplied 후보 (f), T-0059 lesson 박제, doc-only direct 별도 task.
- **estimate model 갱신 doc + R-112 colocated-spec hint 강화** — driver-supplied 후보 (c), service-with-spec backbone 평균 ~500-700 LOC 박제, doc-only direct 별도 task.
- **P3→P4 전이 조건 doc** — driver-supplied 후보 (d), Group e2e (T-0062) 머지 후 P3 closure 시점에 자연.
- **phase 2 src/user/*.spec migration** — driver-supplied 후보 (b), prisma-mock.ts phase 2 fixture variant decision 동반 follow-up. 본 task scope 외.
- **PLAN.md / p3-implementation-plan §6 progress 갱신**: T-0061 / T-0062 closure 박제는 별도 doc-only direct task.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + jest-smoke-setup.ts + db-truncate.ts + persons/parts.smoke 패턴 모두 박제 완료, 새 의사결정 0). 실 chain:

1. **implementer**: 1 파일 신설. `test/smoke/groups.smoke-spec.ts` (~260 LOC = JSDoc 5 줄 ~30 LOC + describe block ~230 LOC = beforeAll/afterAll/afterEach 헤더 ~30 LOC + happy 7 ~90 LOC + negative 3 ~40 LOC + branch 1 (P2002 N:M unique) ~30 LOC + 빈 줄/주석 ~40 LOC).
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존. 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제. test:smoke 가 services.postgres 부재 환경 (local dev DATABASE_URL 미주입) 에서 fail-fast → CI sole validator.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) GroupController endpoint 의 새 분기 발견 → ADR 갱신 (b) PersonGroupMembership middle table 의 새 invariant 발견 (c) globalSetup 의 책임 분기 재결정. 셋 다 본 task 의 frontmatter `plannerSource` 박제 범위 안에서 결정 완료 — implementer 직접 진행.
