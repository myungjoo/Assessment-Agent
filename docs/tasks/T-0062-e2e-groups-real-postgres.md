---
id: T-0062
title: groups.e2e-spec 신설 — GroupController 7 endpoint (CRUD 4 + N:M 3) real PostgreSQL HTTP contract depth e2e
phase: P3
status: DONE
commitMode: pr
prNumber: 58
mergedAs: 3398ad9
completedAt: 2026-05-27
reviewRounds: 1
slug: e2e-groups-real-postgres
coversReq: [REQ-028, REQ-029, REQ-051, REQ-058]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-05-27
plannerNote: P3 test-quality 마지막 piece — groups.e2e 신설로 smoke 3/3 + e2e 3/3 closure. groups.smoke (T-0061) + persons.e2e (T-0054) + parts.e2e (T-0060) 패턴 mirror. REQ-028 N:M e2e HTTP contract depth + REQ-051 다중 group 소속 invariant 의 e2e 첫 박제.
dependsOn: [T-0055, T-0056, T-0057, T-0054, T-0060, T-0061]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: |
  session #19 turn 2 wake (KST 13:10, /loop continuation 직전 session #19 turn 1 SUCCESS T-0061 groups.smoke MERGED 2238e51 PR-57 race-rerun, HQ-0008 use-local-env-gh resolved). [1] STATE: origin/main 2238e51, currentTask=null, nextTask=null, lock=null, phase=P3-in-progress, counters.tasksCompleted=60, blockers=[], humanQuestions 8/8 resolved.
  driver-supplied 7 후보 (a groups.e2e / b phase 2 src/user spec migration / c estimate model 갱신 doc / d P3→P4 전이 evaluation doc / e AuthGuard ADR / f ADR-0006 local-CI-proxy 박제 / g HQ-0008 후속 ADR) 중 (a) groups.e2e-spec 채택 — backbone test-quality 의 마지막 piece (smoke 3/3 + e2e 3/3 closure).
  채택 사유 6 항목: (i) **자연 follow-up sequence** — T-0061 groups.smoke 직후 e2e 절반 박제, persons/parts 두 도메인 (T-0053→T-0054 / T-0059→T-0060) 의 1:1 patterned mirror 의 Group 도메인 3 회차. (ii) **REQ-028 N:M e2e HTTP contract depth 첫 박제** — PersonGroupMembership.@@unique([personId, groupId]) 의 P2002 가 smoke 측 (T-0061 §B.7) 1-level status 검증 위에 e2e envelope shape (statusCode/error/message) + content-type header 검증 박제. (iii) **REQ-051 다중 group 소속 invariant 의 e2e 첫 박제** — 한 인원이 임의 group 다중 소속 가능 (REQ-051) 의 multi-step seed (Group 2 + Person 1 + Membership 2) → GET :id/persons (group A) + GET :id/persons (group B) → 동일 personId 양쪽 모두 반환 검증의 e2e HTTP contract depth. (iv) **ADR-first split 4-stage trajectory Group 도메인 closure** — T-0061 smoke + 본 T-0062 e2e = Group 도메인 2/2 stage closure, persons + parts + groups 3 도메인 smoke+e2e 6 PR closure 박제 (ADR-0004 §Migration 완전 수렴). (v) **cap 안전 envelope** — groups.smoke (T-0061) 342 LOC precedent, GroupController 7 endpoint (4 CRUD + 3 N:M) × R-112 4 카테고리 + JSDoc + helper = ~280-310 LOC 추정, cap 300 edge but cap-bend 정당화 (smoke 측 cap-bend 박제 mirror, 7 endpoint mass + N:M branch). estimate 300 LOC / 1 파일 (test/jest-e2e.json 변경 0 — T-0060 박제 maxWorkers:1 위에서 자동 race-free). (vi) **architect 호출 0** — ADR-0004 §Decision + §Cleanup 정책 + persons.e2e + parts.e2e 패턴 + groups.smoke 패턴 + jest-e2e-setup.ts re-export + maxWorkers:1 race fix 모두 박제 완료, 새 의사결정 0.
  estimate breakdown: JSDoc 5 줄 ~30 LOC + describe ~270 LOC = beforeAll/afterAll/afterEach 헤더 ~25 LOC + GROUP_DTO_FIELDS + expectDtoFields + messageText helper ~15 LOC + happy 7 ~90 LOC (CRUD 4 + N:M 3) + negative 3+ ~40 LOC + branch 2 N:M (P2002 duplicate membership + missing person 404) ~30 LOC + 빈 줄/주석 ~10 LOC = ~290-310 LOC delta / 1 파일.
  GroupController 7 endpoint cover: (1) POST /api/groups 201 (2) GET /api/groups 200 (3) GET /api/groups/:id 200 (4) DELETE /api/groups/:id 204 (5) POST /api/groups/:id/members 201 (6) DELETE /api/groups/:id/members/:membershipId 204 (7) GET /api/groups/:id/persons 200. happy 7 + negative 3 (404 missing / 400 empty / 400 non-whitelisted) + branch 2 N:M (POST :id/members P2002 duplicate 409 + POST :id/members missing personId 404) = ~12 test.
  REQ 매핑: REQ-028 (Group N:M middle table HTTP contract depth + envelope shape) + REQ-029 (평가 자료 non-volatile durability path Group 도메인 e2e) + REQ-051 (한 인원의 임의 group 다중 소속 invariant 의 e2e 첫 박제) + REQ-058 (운영 정책 underlying).
  dependsOn=[T-0055 GroupController CRUD backbone, T-0056 GroupService N:M ops, T-0057 GroupController N:M endpoint, T-0054 persons.e2e 패턴 + jest-e2e-setup.ts, T-0060 parts.e2e + jest-e2e.json maxWorkers:1, T-0061 groups.smoke 패턴].
  STATE.nextTask=T-0062.
---

# T-0062 — groups.e2e-spec 신설 (GroupController 7 endpoint real PostgreSQL HTTP contract depth e2e)

## Why

[T-0055](T-0055-group-controller-dto-crud.md) (mergeCommit `a037a4e`) + [T-0056](T-0056-group-service-nm-membership-ops.md) (mergeCommit `abb70a7`) + [T-0057](T-0057-group-controller-nm-membership-endpoints.md) (mergeCommit `ccd1042`) 의 3 task 가 GroupController 4 CRUD endpoint + GroupService N:M ops 3 메서드 + GroupController N:M 3 endpoint 박제 완료 — **REQ-028 fully operational closure** (한 인원의 임의 group 다중 소속 invariant 의 service+controller 양 layer).

[T-0061](T-0061-smoke-groups-real-postgres.md) (mergeCommit `2238e51`) 이 `test/smoke/groups.smoke-spec.ts` 신설로 GroupController 7 endpoint 의 smoke layer (real PostgreSQL bootstrap + 1-level status 검증) 박제 완료.

**현재 상태의 gap**: groups 도메인 e2e spec 0 — `test/e2e/` 에 `app.e2e-spec.ts` + `persons.e2e-spec.ts` + `parts.e2e-spec.ts` 3 파일만 존재. GroupController 7 endpoint 는 unit (`src/user/group.controller.spec.ts`) + smoke (`test/smoke/groups.smoke-spec.ts`, T-0061 박제) cover 만, e2e 차원의 HTTP contract depth + 4xx envelope shape (statusCode / error / message) + 응답 header content-type + multi-step N:M branch flow 검증 0.

본 T-0062 은 [persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) + [parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts) 패턴을 1:1 mirror 해 `test/e2e/groups.e2e-spec.ts` 1 파일을 신설. `test/jest-e2e.json` 의 `maxWorkers: 1` race fix 는 [T-0060](T-0060-e2e-parts-real-postgres.md) 박제 완료 — 본 task 는 jest config 변경 0, 자동으로 race-free 직렬 실행 혜택을 받음.

본 task 의 변경은 모두 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md#decision) (e2e = real PostgreSQL 고정) + [ADR-0004 §Cleanup 정책](../decisions/ADR-0004-smoke-e2e-db-mode.md#cleanup-정책-박제) (afterEach truncate) + persons.e2e / parts.e2e / groups.smoke 패턴의 1:1 reference 구현 — 새 의사결정 0, architect 호출 0.

**P3 test-quality closure 마지막 piece**: 본 task 머지 시점부터 backbone 3 도메인 (persons / parts / groups) × 3 layer (unit + smoke + e2e) = **9-cell test 매트릭스 fully closed**. ADR-first split 4-stage trajectory (T-0051 ADR-0004 → T-0052 CI infra → smoke 3 도메인 → e2e 3 도메인) 의 자연 수렴.

REQ 매핑:

- [REQ-028](../requirements.md) — Group N:M middle table invariant (`@@unique([personId, groupId])`). GroupController 의 N:M 3 endpoint (POST :id/members / DELETE :id/members/:membershipId / GET :id/persons) 가 본 invariant 의 controller-layer 박제 — 본 task 의 e2e 가 실 PostgreSQL FK constraint + composite unique constraint 의 HTTP contract depth + 4xx envelope shape 박제. P2002 (duplicate membership) + missing person/group 분기 양 e2e envelope cover.
- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. Group 도메인이 실 PostgreSQL durability + Prisma adapter / pg connection 의 e2e HTTP contract depth 발화. **본 task 머지 시점부터 REQ-029 검증 path 가 unit + smoke + e2e 3 layer 전부 박제 완성 — Group 도메인까지 확장 = 3 도메인 closure.**
- [REQ-051](../requirements.md) — **한 인원은 임의 group 다중 소속 가능**. 본 invariant 의 e2e HTTP contract depth 첫 박제 — Group 2 + Person 1 + Membership 2 multi-row seed → GET /api/groups/:id/persons (group A) + GET /api/groups/:id/persons (group B) → 동일 personId 가 양쪽 모두 200 응답에 포함 검증.
- [REQ-058](../requirements.md) — 운영 정책 underlying.

## Required Reading

- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — **본 task 의 1차 reference 패턴**. JSDoc 5 줄 박제 + describe + beforeAll(AppModule + PrismaService DI) + afterAll(app.close + prisma.$disconnect) + afterEach(truncateAll) + PERSON_DTO_FIELDS + expectDtoFields helper + messageText helper + happy/negative/branch test 패턴 직접 mirror.
- [test/e2e/parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts) — **2 차 reference**. PART_DTO_FIELDS 2 종 (id, name) + GET :id/persons reverse query 패턴 — Group 도메인의 GROUP_DTO_FIELDS 2 종 + GET :id/persons N:M navigation 의 직접 reference.
- [test/smoke/groups.smoke-spec.ts](../../test/smoke/groups.smoke-spec.ts) — **3 차 reference (sibling smoke)**. 7 endpoint × 11 test (happy 7 + negative 3 + branch 1) + N:M seed 패턴 (Group + Person + Membership) + PersonGroupMembership.@@unique 의 P2002 분기 직접 mirror.
- [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) — DB 미사용 (GET / 만 + 404 fallback). 본 task 영향 0 — 변경 0 LOC.
- [test/jest-e2e.json](../../test/jest-e2e.json) — `maxWorkers: 1` 박제 완료 ([T-0060](T-0060-e2e-parts-real-postgres.md) amendment). 본 task 변경 0 — groups.e2e + persons.e2e + parts.e2e 가 자동으로 race-free 직렬 실행.
- [test/helpers/jest-e2e-setup.ts](../../test/helpers/jest-e2e-setup.ts) — globalSetup helper (T-0054 박제 thin re-export). 본 task 변경 0 — groups.e2e-spec 가 자동으로 본 setup 의 1 회 truncate + DATABASE_URL fail-fast 혜택을 받음.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` signature + TRUNCATE_TABLES 5 entry (Person / Group / Part / PersonGroupMembership 포함). afterEach 에서 호출 — 5 테이블 동시 truncate.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — 7 endpoint (POST 201 / GET / GET :id / DELETE :id / POST :id/members 201 / DELETE :id/members/:membershipId 204 / GET :id/persons) + Controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform).
- [src/user/group.service.ts](../../src/user/group.service.ts) — 7 메서드 (create / findAll / findById / softDelete / addMember / removeMember / findPersonsByGroupId) + P2002 / P2025 / P2003 변환 분기.
- [src/user/dto/create-group.dto.ts](../../src/user/dto/create-group.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `name` 1 필드.
- [src/user/dto/add-member.dto.ts](../../src/user/dto/add-member.dto.ts) — `@IsString()` + `@IsNotEmpty()` + `personId` 1 필드.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Group.name `@unique` + PersonGroupMembership 의 `@@unique([personId, groupId])` (P2002 source) + Person/Group FK constraint Restrict (P2003 source).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) §Decision + §Cleanup 정책 — 본 task 변경의 정책 reference.
- [docs/tasks/T-0054-e2e-persons-real-postgres-cutover.md](T-0054-e2e-persons-real-postgres-cutover.md) — persons.e2e 선례 (acceptance 패턴 + 5 종 grand validation 직접 mirror).
- [docs/tasks/T-0060-e2e-parts-real-postgres.md](T-0060-e2e-parts-real-postgres.md) — parts.e2e 선례 (jest-e2e.json maxWorkers:1 박제 + GET :id/persons reverse query 패턴).
- [docs/tasks/T-0061-smoke-groups-real-postgres.md](T-0061-smoke-groups-real-postgres.md) — groups.smoke sibling. acceptance §A/§B/§C/§D 구조 + N:M seed 패턴 + P2002 N:M branch 직접 mirror.

## Acceptance Criteria

체크리스트. 모든 항목은 실행 명령어 또는 inspectable 파일/symbol 로 검증 가능.

### A. groups.e2e-spec 신설

- [ ] `test/e2e/groups.e2e-spec.ts` 신설. persons.e2e-spec.ts + parts.e2e-spec.ts 의 describe + beforeAll + afterAll + afterEach 구조 1:1 mirror.
- [ ] 본 spec module-level JSDoc 5 줄 박제 — (1) 책임 (GroupController 7 endpoint HTTP contract depth e2e + status + content-type + body shape + 4xx envelope + N:M multi-step branch flow) (2) smoke vs unit vs e2e 책임 경계 (unit = group.controller.spec / group.service.spec / smoke = groups.smoke-spec T-0061 / e2e = 본 spec HTTP contract depth + envelope shape) (3) ADR-0004 §Decision 실 DB 전략 reference + persons.e2e (T-0054) + parts.e2e (T-0060) 패턴 mirror (4) afterEach(truncateAll) 의 ADR-0004 §Cleanup 정책 박제 (5) testRegex 격리 (`.e2e-spec.ts` suffix → unit/smoke jest picking 0) + jest-e2e-setup.ts globalSetup 자동 picking + jest-e2e.json maxWorkers:1 (T-0060 박제) 자동 serial 실행 (cross-file race 차단).
- [ ] beforeAll — `Test.createTestingModule({imports: [AppModule]}).compile()` + `app.init()` + `prisma = moduleRef.get<PrismaService>(PrismaService)`. mock override 0 — 실 PrismaService 가 services.postgres 의 localhost:5432 connection 발화.
- [ ] afterAll — `await app.close(); await prisma.$disconnect();` — connection 누수 방지.
- [ ] afterEach — `await truncateAll(prisma);` — test 간 state leak 0.
- [ ] GROUP_DTO_FIELDS const (id, name 2 종) + expectDtoFields helper + messageText helper 박제 (parts.e2e 패턴 mirror, Group DTO shape 가 Part DTO 와 동일 minimal).

### B. Happy path 7 endpoint × 각 1+ test (R-112 happy 항목)

GroupController 의 7 endpoint 각 1+ happy test. arrange 단계 `await prisma.group.create({data:{name:"..."}})` 등 실 row seed → endpoint 호출 → 응답 status + content-type header + body shape (DTO field) + 실 DB state 양쪽 검증.

- [ ] **B.1 POST /api/groups** → 201 + `content-type: application/json` + body.id 존재 + body.name === seed name + 실 DB 에 row 존재 재조회 (`prisma.group.findUnique({where:{id:response.body.id}})` not null). `GroupService.create()` → `GroupRepository.create()` → `prisma.group.create()` 실 발화 + `@HttpCode(201)`.
- [ ] **B.2 GET /api/groups** → 200 + `content-type: application/json` + `Array.isArray(body) === true` + body[0] 가 GROUP_DTO_FIELDS (id, name) 모두 보유 + body[0].id === seed.id + body[0].name === seed.name. `GroupService.findAll()` → `prisma.group.findMany()` 실 발화.
- [ ] **B.3 GET /api/groups/:id** → 200 + `content-type: application/json` + `Array.isArray(body) === false` + body 가 GROUP_DTO_FIELDS 모두 보유 + body.id === seed.id + body.name === seed.name. `GroupService.findById()` → `prisma.group.findUnique()` 실 발화.
- [ ] **B.4 DELETE /api/groups/:id** → 204 + body empty (`response.body === {}`) + 실 DB 의 Group row 가 soft delete 된 상태 (`prisma.group.findUnique({where:{id:seed.id}})` 의 deletedAt 필드 not null, 또는 service 의 softDelete 구현에 따라 hard delete 시 row null). 실제 GroupService.softDelete 동작 (cascade/hard/soft) 은 `src/user/group.service.ts` 의 구현 따라 검증 — implementer 가 구현 확인 후 검증 assertion 작성.
- [ ] **B.5 POST /api/groups/:id/members** → 201 + `content-type: application/json` + body 가 membership 객체 (id, personId, groupId) + 실 DB 의 `prisma.personGroupMembership.findUnique({where:{personId_groupId:{personId,groupId}}})` not null. Group 1 + Person 1 seed → AddMemberDto `{personId}` body → ValidationPipe 통과 → `GroupService.addMember()` → `prisma.personGroupMembership.create()` 실 발화 + `@HttpCode(201)`.
- [ ] **B.6 DELETE /api/groups/:id/members/:membershipId** → 204 + body empty + 실 DB 의 membership row 사라짐 (`prisma.personGroupMembership.findUnique` null). Group + Person + Membership 1 seed → DELETE 호출 → `GroupService.removeMember()` → `prisma.personGroupMembership.delete()` 실 발화 + `@HttpCode(204)`.
- [ ] **B.7 GET /api/groups/:id/persons** → 200 + `content-type: application/json` + `Array.isArray(body) === true` + Group 1 + Person 2 + Membership 2 (각 person → group) seed → body 가 length 2 + 각 item 이 Person DTO field (fullName/email/active) 보유 + 각 id 가 seed Person id 와 일치. `GroupService.findPersonsByGroupId()` → middle table indirect navigation 실 발화. **본 endpoint 의 e2e HTTP contract depth 첫 박제 — REQ-028 N:M reverse query path closure.**
- [ ] **B.8 (REQ-051 박제) 한 Person 의 다중 group 소속 검증** — Group 2 + Person 1 + Membership 2 (동일 personId, 다른 groupId) seed → GET /api/groups/<groupA>/persons + GET /api/groups/<groupB>/persons → 두 응답 모두 동일 personId 1 row 포함 검증. **REQ-051 ("한 인원은 임의 group 다중 소속 가능") 의 e2e 첫 박제** — N:M middle table 의 핵심 invariant 가 HTTP contract depth 위에서 발화. 본 항목은 §B happy path 의 추가 multi-step assertion 으로 처리 (별도 test 또는 B.7 안에서 추가 case — implementer 자유도).

### C. 4xx error envelope 3+ test (R-112 negative 항목 — 충분 cover + envelope shape 박제)

persons.e2e / parts.e2e 의 C 섹션 envelope shape 검증 (statusCode / error / message) 패턴 mirror. body.statusCode === 숫자 + body.error === "Not Found"/"Bad Request"/"Conflict" + body.message truthy + (해당 시) message 내 핵심 어휘 substring 검증.

- [ ] **C.1 GET /api/groups/missing → 404 envelope**. 실 DB seed 없음 → `prisma.group.findUnique` null → `GroupService.findById()` NotFoundException → 404. `response.body` 가 `{statusCode: 404, error: "Not Found"}` toMatchObject + `body.message` truthy.
- [ ] **C.2 POST /api/groups {} → 400 envelope + validation message**. ValidationPipe `@IsString` + `@IsNotEmpty` 위반 reject. `response.body` 가 `{statusCode: 400, error: "Bad Request"}` toMatchObject + `body.message` truthy + `messageText(body).toLowerCase()` 가 `/name/` substring 매칭 (CreateGroupDto.name 필드 검증 사유). 실 DB 의 `prisma.group.count()` === 0.
- [ ] **C.3 POST /api/groups/:id/members {} → 400 envelope + validation message**. Group 1 seed → AddMemberDto `personId` 필드 부재 body → ValidationPipe reject → 400. `response.body` 가 `{statusCode: 400, error: "Bad Request"}` toMatchObject + `body.message` truthy + `messageText(body).toLowerCase()` 가 `/personid/` substring 매칭 (AddMemberDto.personId 필드 검증 사유).
- [ ] **C.4 (선택, planner 권장) POST /api/groups {name:"..", extra:".."} → 400 envelope + whitelist message**. ValidationPipe `forbidNonWhitelisted: true` reject. parts.e2e §C.3 패턴 mirror.

### D. Branch coverage — N:M P2002 + missing person 404 envelope (R-112 branch 항목)

smoke (T-0061 §D) 의 1-level status 검증 위에 본 task 의 envelope shape 검증으로 N:M 분기 양 layer 박제 완성.

- [ ] **D.1 POST /api/groups/:id/members duplicate (personId, groupId) → 409 envelope**. arrange — Group 1 + Person 1 + Membership 1 (동일 personId+groupId) seed → 동일 personId 로 POST → 실 PostgreSQL 의 PersonGroupMembership `@@unique([personId, groupId])` 가 P2002 발화 → `GroupService.addMember()` ConflictException 변환 → 409. `response.body` 가 `{statusCode: 409, error: "Conflict"}` toMatchObject + `body.message` truthy. **본 분기가 REQ-028 N:M middle table unique constraint 의 schema-level enforce 의 e2e HTTP contract depth + envelope shape 박제 완성.**
- [ ] **D.2 POST /api/groups/:id/members missing personId → 404 envelope**. arrange — Group 1 seed (Person 미 seed) → AddMemberDto `{personId: <nonexistent>}` body → ValidationPipe 통과 (`personId` 가 string + non-empty) → `GroupService.addMember()` 가 사전 검증 (`personRepo.findById`) 에서 NotFoundException 발화 → 404 (또는 P2003 → service 변환). `response.body` 가 `{statusCode: 404, error: "Not Found"}` toMatchObject + `body.message` truthy. **GroupService N:M ops 의 사전 검증 분기 (Group/Person findById 둘 다 통과해야 진행) 의 e2e 박제.**

### E. R-112 4 종 (happy / error / branch / negative) cover 확인

- [ ] **Happy-path test**: §B 7 endpoint × 각 1+ + B.8 REQ-051 = 7+ happy test cover.
- [ ] **Error path test**: §C 3+ negative envelope test 가 ValidationPipe + NotFoundException 의 error path + 4xx envelope shape cover. PrismaService.onModuleInit `$connect` 실패 케이스는 globalSetup helper (jest-e2e-setup.ts) 의 DATABASE_URL fail-fast 박제 (T-0054 / T-0060 동일 boundary).
- [ ] **Branch coverage**: §D P2002 N:M duplicate + missing person 404 의 2+ 분기 envelope cover. P2025 (DELETE missing membershipId → 404) 분기는 implementer 선택 — §C 보강 또는 §D 추가.
- [ ] **Negative cases 충분 cover**: ValidationPipe 위반 2 종 (empty CreateGroupDto / empty AddMemberDto) + missing id 404 + duplicate membership 409 + missing person 404 = **5+ negative path envelope cover** (smoke §C+§D 의 1-level status 검증 위에 e2e envelope shape 검증 추가). 단일 negative 함정 회피.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 본 task 는 production code 변경 0 (test 신설만) — src/** coverage 유지.

### F. 5 종 grand validation (tester 의무)

- [ ] `pnpm lint` 통과 (env CRLF skip 허용 — T-0059 lesson Windows CRLF 정책 follow-up 참조).
- [ ] `pnpm build` 통과 (NestJS 빌드 + tsc).
- [ ] `pnpm test:cov` 통과 (unit jest, line/function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 본 task 가 smoke 측 변경 0, 기존 smoke 3 suites / 32 tests (app.smoke 2 + persons.smoke 9 + parts.smoke 10 + groups.smoke 11) green 보존. CI services.postgres 위에서 발화.
- [ ] `pnpm test:e2e` 통과 — 본 task 신설 groups.e2e-spec 이 jest-e2e.json testRegex `.e2e-spec.ts` 자동 picking + globalSetup → PrismaClient connect → truncateAll → disconnect → maxWorkers:1 (T-0060 박제) 직렬 실행 → app.e2e (2 test) + persons.e2e (11 test) + parts.e2e (~10 test) + groups.e2e (~12 test = happy 7 + negative 3 + branch 2) 가 services.postgres 위에서 race-free 발화. 합계 e2e = **~35 test** (기존 23 + 본 task 신설 12).

### G. P3 test-quality closure 박제

- [ ] 본 task 머지 시점부터 backbone 3 도메인 (persons / parts / groups) × 3 layer (unit + smoke + e2e) = **9-cell test 매트릭스 fully closed**.
- [ ] ADR-first split 4-stage trajectory (T-0051 ADR-0004 → T-0052 CI infra → smoke 3 도메인 T-0053/T-0059/T-0061 → e2e 3 도메인 T-0054/T-0060/본 T-0062) 의 자연 수렴 박제.

### H. 박제 / 후속 task 분리

- [ ] 본 task 의 §Out of Scope 가 후속 task 책임을 명확히 carve — phase 2 src/user spec migration (별도) + estimate model 갱신 doc (별도) + P3 → P4 전이 evaluation doc (별도) + AuthGuard / 권한 boundary ADR (P3 또는 P4) + ADR-0006 local-CI-proxy 박제 doc (별도) + .gitattributes CRLF ADR (T-0059 lesson follow-up).
- [ ] 본 task 의 §Follow-ups 에 P3 → P4 전이 evaluation doc-only direct task 후보 박제 (test-quality closure 후 phase 전이 평가 의무).

## Out of Scope

본 task 는 groups 도메인 e2e closure (P3 test-quality 마지막 piece). 다음은 명시적으로 후속 task 책임:

- **GroupController PATCH endpoint** / **Group 의 mutation 박제**: 본 task scope 외, 별도 후속 backbone task.
- **추가 branch cover (P2025 DELETE missing membershipId → 404 envelope / GET :id/persons missing Group 404 envelope)**: §E 권장으로 §C/§D 보강 가능 — 본 task 안에서 처리 또는 별도 후속 task 결정 (implementer 자유도, cap 안전 envelope 안에서).
- **AuthGuard (Admin+ / User+)** — 후속 P3 또는 P4 책임.
- **phase 2 src/user/*.spec migration**: prisma-mock.ts phase 2 fixture variant decision 동반 follow-up. 본 task scope 외.
- **PLAN.md / p3-implementation-plan §6 progress 갱신**: T-0058~T-0062 closure 박제는 별도 doc-only direct task (mid-phase doc-shift 5 회차 후보).
- **estimate model 갱신 doc / R-112 colocated-spec hint 강화 doc / P3 → P4 전이 evaluation doc**: 별도 doc-only direct task.
- **ADR-0006 local-CI-proxy-during-outage 박제 doc-only direct**: HQ-0007 outage 시 사용한 패턴 박제 (별도 doc).
- **HQ-0008 use-local-env-gh 후속 ADR**: cloud cron env 의 gh CLI 부재 패턴 박제 (별도 doc).
- **.gitattributes CRLF 정책 ADR / .wslconfig vmIdleTimeout follow-up**: T-0059 local-CI-proxy lesson 박제. 본 task scope 외.
- **e2e 성능 / parallelism 회복**: maxWorkers:1 의 trade-off 는 직렬 실행으로 e2e suite 시간 ↑. 후속 follow-up — schema 격리 (per-spec DATABASE_URL/schema) 또는 worker-level isolation 도입은 별도 ADR + task.
- **e2e seed factory / fixture builder 도입**: 본 task 는 inline `prisma.X.create` 패턴 (persons.e2e + parts.e2e + groups.smoke 동일) — factory 패턴 도입은 별도 ADR 후 task.

## Follow-ups

(empty at creation — 비워둠. implementer / tester / reviewer 가 spotted work 박제.)

**planner pre-seeded follow-up 후보** (implementer 가 acceptance 진행 중 발견 시 본 섹션 append):

- P3 → P4 전이 evaluation doc-only direct task — 본 task 머지 후 backbone 3 도메인 × 3 layer 9-cell closure 평가 + P4 (External integrations) entry 조건 평가.
- p3-implementation-plan §1/§2/§3/§6 sync — T-0058~T-0062 4 row append + §6 progress 갱신 (test-quality 4/4 closure 박제 + ADR-first split 4-stage 자연 수렴 박제). mid-phase doc-shift 5 회차 후보.
- estimate model 갱신 doc — service/controller-with-spec backbone + smoke/e2e + JSDoc 한국어의 systematic underestimate 박제 (T-0055/T-0056/T-0057/T-0059/T-0061 5 cap-bend precedent).

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0004 §Decision + §Cleanup 정책 + persons.e2e (T-0054) + parts.e2e (T-0060) + groups.smoke (T-0061) 패턴 + jest-e2e-setup.ts re-export + jest-e2e.json maxWorkers:1 모두 박제 완료, 새 의사결정 0). 실 chain:

1. **implementer**: 1 파일 변경 박제.
   - `test/e2e/groups.e2e-spec.ts` 신설 (~280-310 LOC = JSDoc 5 줄 ~30 LOC + describe block ~270 LOC = beforeAll/afterAll/afterEach 헤더 ~25 LOC + GROUP_DTO_FIELDS + expectDtoFields + messageText helper ~15 LOC + happy 7 ~90 LOC (CRUD 4 ~50 + N:M 3 ~40) + REQ-051 다중 group 소속 검증 ~15 LOC + negative 3+ ~40 LOC + branch 2 N:M ~30 LOC + 빈 줄/주석 ~10 LOC). persons.e2e + parts.e2e + groups.smoke 패턴 1:1 mirror — 7 endpoint mass + N:M middle table seed/assertion 의 자연 결과.
   - test/jest-e2e.json 변경 0 — T-0060 박제 maxWorkers:1 위에서 자동 race-free.
   - **cap-bend 정당화**: estimate 300 LOC / 1 파일 cap edge — groups.smoke (T-0061) 342 LOC precedent 위에 e2e envelope shape 검증 추가가 자연 결과 (smoke 1-level status → e2e envelope toMatchObject 검증 mass +). cap 300 까지 안전 envelope, 초과 시 implementer 가 architect 호출 ANOTHER_ROUND 평가 (현 estimate 기준 cap-bend 확률 낮음).
2. **tester**: 5 종 grand validation — `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`. local 검증 시 사용자가 docker-compose 로 PostgreSQL 16 띄우거나 CI 검증 의존 (T-0054 + T-0060 + T-0061 동일 패턴). 본 5 검증의 결과를 TRAIL 의 TESTER 섹션에 박제. **race-free 검증 anchor**: maxWorkers:1 (T-0060 박제) 위에서 groups.e2e + persons.e2e + parts.e2e 동시 발화 시 race fail 0 — T-0061 smoke 측 동등 시나리오 (32/32 test green) 박제와 평행 cover.
3. (reviewer + integrator 는 executor 자체 dispatch — pr-mode 4-게이트 full chain.)

architect 호출이 필요한 트리거 (본 task 미예상): (a) cap 300 LOC 초과 임박 → split 평가 (CRUD 절반 + N:M 절반 으로 T-0062a + T-0062b 분리, smoke 측 단일 task 박제 패턴과 deviation — 권장 ranks low) (b) maxWorkers:1 (T-0060 박제) 후에도 groups.e2e ↔ persons.e2e ↔ parts.e2e 3-way race 잔존 → globalSetup 책임 재결정 (c) Group DTO field shape 의 새 invariant 발견 → ADR 갱신. 셋 다 본 task plannerSource 박제 범위 안의 최소 결정 — implementer 직접 진행, architect escalation 0 예상.
