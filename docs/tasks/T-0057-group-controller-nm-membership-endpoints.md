---
id: T-0057
title: GroupController N:M membership endpoints + AddMemberDto (T-0056 Follow-up #1, pr-mode)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 280
estimatedFiles: 3
created: 2026-05-26
plannerNote: T-0056 후속 — GroupController 에 N:M endpoint 3 종 추가 (POST /:id/members / DELETE /:id/members/:personId / GET /:id/persons) + AddMemberDto. service-layer 박제 wrap. REQ-028 fully operational closure.
dependsOn: [T-0049, T-0056]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
sizeExempt: false
plannerSource: docs/architecture/p3-implementation-plan.md §6 (entity 박제 progress 8/11 → 본 task 머지 시 9/11, Group entity 의 N:M membership HTTP-facing layer 미박제) + docs/tasks/T-0056 §Follow-ups L189 (선행 후보 #1 — "T-0057 (예상): GroupController N:M membership endpoints — POST /:id/members + DELETE /:id/members/:personId + GET /:id/persons 3 endpoint + controller.spec 확장 + (필요 시) AddMemberDto. ~190 LOC / 2-3 파일") + driver-supplied 후보 (a) GroupController :id/persons + :id/members endpoint — Service-before-Controller 자연 순서 mirror (T-0050 → T-0055 패턴, T-0056 → 본 task) + src/user/group.service.ts L131-220 (T-0056 박제 3 신규 메서드 — 본 task 의 forward 대상) + src/user/group.controller.ts (T-0055 박제 4 endpoint — 본 task 의 확장 source) + src/user/part.controller.ts L62-67 (findPersons endpoint 패턴 reference) + src/user/part.controller.spec.ts (R-112 4 카테고리 + supertest ValidationPipe integration 패턴 reference). estimate 280 LOC / 3 파일 — driver 원안 (~190 LOC) 보다 +90 LOC 보수 추정 (T-0055 4 endpoint 의 actual 413 LOC precedent 적용 — 3 endpoint × ~80 LOC + AddMemberDto + spec 확장). cap close — 280 < 300 안전 envelope, R-112 4 카테고리 spec mass 의 자연 결과.
---

# T-0057 — GroupController N:M membership endpoints + AddMemberDto

## Why

[T-0055](T-0055-group-controller-dto-crud.md) 머지 (a037a4e, PR-51 round 2) 로 `GroupController` 의 4 CRUD endpoint 박제 + [T-0056](T-0056-group-service-nm-membership-ops.md) 머지 (abb70a7, PR-52 round 1) 로 `GroupService` 의 3 N:M membership 메서드 (`addMember` / `removeMember` / `findPersonsByGroupId`) service-layer 박제. 그러나 [REQ-028](../requirements.md) 의 핵심 invariant — "한 인원은 임의 group 다중 소속 가능" — 의 **HTTP-facing layer 가 아직 미박제** — 외부 API 클라이언트 가 N:M 연산을 호출할 수 없는 상태. 본 task 는 **GroupController 에 3 endpoint 추가** + **AddMemberDto** 신설 + controller spec 확장. T-0056 의 3 service 메서드 를 HTTP layer 로 wrap — REQ-028 의 fully operational closure.

본 task 머지 후 backbone 진척:
- entity 박제 progress 8/11 → **9/11** (Group entity 의 N:M HTTP layer 박제 = entity layer fully operational).
- 외부 API 클라이언트 가 `/api/groups/:id/members` (POST/DELETE) + `/api/groups/:id/persons` (GET) 3 endpoint 호출 가능.
- T-0055 → T-0056 → 본 T-0057 의 3-task 체인이 Group entity 의 fully operational closure (controller CRUD + service N:M + controller N:M).

**Service-before-Controller 자연 순서 패턴 박제** — T-0050 (GroupService CRUD) → T-0055 (GroupController CRUD) / T-0046 (PartService) → 본 task 와 동일 phase mirror — T-0056 (GroupService N:M) → T-0057 (GroupController N:M). 본 task 후 backbone 의 3 entity (Person / Part / Group) 모두 service-layer + controller-layer 박제 완료.

**Estimate 보수 추정** (driver 원안 ~190 LOC → 280 LOC) — T-0055 round 1 의 actual 413 LOC (4 endpoint) precedent 적용 시 3 endpoint × ~80 LOC + AddMemberDto + R-112 spec mass = ~280 LOC. cap 300 LOC 의 안전 envelope. 만약 spec describe 분리 마다 ~50 LOC 추가되어 cap-bend 위험이 보이면 implementer 가 본 task 진행 중 follow-up 으로 분리 권장 — 본 task frontmatter 의 estimatedDiff 갱신 + planner 재호출.

**PartController 와의 차이 (Out of Scope 박제)**:

1. **`:id/members` 의 POST + DELETE 신설** — Part entity 의 1:N 패턴 (Person.partId direct FK) 과 달리, Group 의 N:M middle table 책임 — POST 가 PersonGroupMembership row 생성 / DELETE 가 row 삭제. PartController 에는 부재.
2. **`:id/persons` endpoint 의 GroupController 박제** — PartController 의 `findPersons` endpoint (T-0046, L62-67) 와 동일 패턴 — `service.findPersonsByGroupId(id)` forward + 200 OK + 빈 배열 OK. service-layer 의 N:M middle table indirect navigation 은 T-0056 박제 완료.
3. **AddMemberDto 신설** — POST `:id/members` 의 body `{ personId: string }` 검증 — `@IsString()` + `@IsNotEmpty()` 2 decorator. groupId 는 URL path param 으로 추출, personId 만 body 검증.
4. **DELETE `:id/members/:personId` 의 path 설계** — driver-supplied 패턴은 `/api/groups/:id/members/:personId` (personId path param) 이나 alternative 는 `/api/groups/:id/members/:membershipId` (membership row id 직접). T-0056 의 `removeMember(membershipId: string)` 시그니처는 membershipId 받음 — driver 원안의 `:personId` path 와 mismatch. **본 task implementer 가 결정 + 박제** — 선택지 (a) membershipId path (REST 정합 — N:M middle row 의 자체 식별자) (b) personId path + controller 가 membership row 조회 (additional service 메서드 필요) (c) personId + groupId 복합 path + service.removeMember 의 overload — **권장 (a)**: T-0056 의 `removeMember(membershipId)` 시그니처 그대로 reuse, path `:membershipId` 변경. driver 원안의 `:personId` 는 그 시점의 추정으로 task 진행 중 (a) 로 정정 가능.

**Prisma error → HTTP status code 매핑** (T-0056 service 분기 가 이미 NestJS HttpException 변환 완료 → 본 controller layer 는 추가 변환 0, automatic mapping):

- POST `:id/members` happy → 201 / Group 없음 → 404 / Person 없음 → 404 / P2002 (이미 member) → 409 / P2003 (race) → 404 / ValidationPipe 위반 → 400.
- DELETE `:id/members/:membershipId` happy → 204 / P2025 (row 없음) → 404.
- GET `:id/persons` happy → 200 + 배열 (빈 배열 OK) / Group 없음 → 404.

REQ 매핑: [REQ-028](../requirements.md) (Group 정책 — 한 인원은 임의 group 다중 소속 가능. 본 task 가 N:M membership HTTP-facing layer 박제로 fully operational closure).

## Required Reading

- [src/user/group.controller.ts](../../src/user/group.controller.ts) — 본 task 의 확장 대상 (T-0055 박제 4 endpoint + ValidationPipe wire + 헤더 주석 보존, 3 endpoint 추가).
- [src/user/group.controller.spec.ts](../../src/user/group.controller.spec.ts) — 본 task 의 spec 확장 대상 (T-0055 박제 spec — happy 4 / error 2 / validation 4 등 ~250 LOC 기존 test). 신규 3 endpoint 의 describe 추가, 기존 test 보존.
- [src/user/dto/create-group.dto.ts](../../src/user/dto/create-group.dto.ts) — DTO 패턴 source (T-0055 박제, ~29 LOC). 본 task 의 AddMemberDto 는 동일 shape — `personId: string` + `@IsString()` + `@IsNotEmpty()` 2 decorator.
- [src/user/group.service.ts](../../src/user/group.service.ts) L131-220 — 본 task 의 3 endpoint 가 forward 하는 service 메서드 (T-0056 박제). 시그니처:
  - `addMember(groupId: string, personId: string): Promise<PersonGroupMembership>` — POST `:id/members` body 의 personId + path param 의 groupId 결합.
  - `removeMember(membershipId: string): Promise<void>` — DELETE `:id/members/:membershipId` 의 path param. driver 원안 `:personId` 는 implementer 재정정 (위 Why §4 참조).
  - `findPersonsByGroupId(groupId: string): Promise<Person[]>` — GET `:id/persons` 의 path param.
- [src/user/part.controller.ts](../../src/user/part.controller.ts) L62-67 — `findPersons` endpoint 패턴 reference. 본 task 의 `findPersons` endpoint 1:1 mirror (path `:id/persons` 만 동일).
- [src/user/part.controller.spec.ts](../../src/user/part.controller.spec.ts) L1-50 + R-112 4 카테고리 패턴 + ValidationPipe integration via supertest (`createNestApplication` + `app.useGlobalPipes`) — 본 task spec 의 패턴 source. PartController 가 5 endpoint 박제 + spec 분리 reference.
- [src/user/user.module.ts](../../src/user/user.module.ts) — providers / controllers 배열 확인. GroupController 이미 등록 (T-0055), 본 task 변경 0 또는 헤더 주석 1 줄.
- [docs/architecture/api.md](../architecture/api.md) — Groups 섹션 — `/api/groups/:id/members` (POST/DELETE) + `/api/groups/:id/persons` (GET) 의 row 박제 여부 확인. 미박제 시 본 task §A 의 3 endpoint 가 source 가 됨 (api.md 갱신은 별도 doc-only direct follow-up).
- [docs/tasks/T-0055-group-controller-dto-crud.md](T-0055-group-controller-dto-crud.md) — GroupController CRUD-only 박제 task. 본 task 의 확장 source — 기존 4 endpoint 보존 + 3 endpoint 추가.
- [docs/tasks/T-0056-group-service-nm-membership-ops.md](T-0056-group-service-nm-membership-ops.md) — GroupService N:M backbone 박제 task. 본 task 의 forward 대상 source.
- [docs/tasks/T-0046-part-service-controller-dto-backbone.md](T-0046-part-service-controller-dto-backbone.md) — PartController backbone task. 본 task 의 `findPersons` endpoint 패턴 reference.
- [prisma/schema.prisma](../../prisma/schema.prisma) L116-133 (PersonGroupMembership model) — `@@unique([personId, groupId])` (POST P2002 source — 409 변환은 T-0056 service-layer 박제 완료) + `personId / groupId @relation onDelete: Cascade` 정책. 본 task schema 변경 0.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — `src/` 변경) / §3.2 (R-110~R-114 — happy / error / branch / negative 4 카테고리 + coverage line ≥ 80% / function ≥ 80%) / §11 (trail blob) / §12 (한국어 본문).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — T-0048 race 인지 절차 (T-0049~T-0056 dogfood SUCCESS 10 회 검증, T-0055 round 2 cycle BROKEN 후 T-0056 round 1 streak 1 시작 — 본 task 가 streak 2 시도). comment-triggered rerun 자동 absorption 또는 race-disabled variant 기대.

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0057-group-controller-nm-membership-endpoints` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `src/user/group.controller.ts` 갱신 (~50 LOC 추가)**:

- [ ] **3 신규 endpoint 추가** (기존 4 endpoint + ValidationPipe wire + 헤더 주석 보존):
  - **POST `/api/groups/:id/members`** — `@HttpCode(201)` + `addMember(@Param("id") groupId: string, @Body() dto: AddMemberDto): Promise<PersonGroupMembership>` — `service.addMember(groupId, dto.personId)` forward. ValidationPipe 가 dto 검증 — personId 누락 / 빈 문자열 / 타입 mismatch / 추가 필드 시 400 자동. service 분기 → 404 (Group/Person 없음) / 409 (이미 member) / 404 (P2003 race) automatic.
  - **DELETE `/api/groups/:id/members/:membershipId`** — `@HttpCode(204)` + `removeMember(@Param("id") groupId: string, @Param("membershipId") membershipId: string): Promise<void>` — `service.removeMember(membershipId)` forward (groupId path param 은 RESTful URL 정합용, service 호출엔 미사용). T-0056 service 시그니처 정합. service 분기 → 404 (P2025) automatic.
  - **GET `/api/groups/:id/persons`** — `findPersons(@Param("id") id: string): Promise<Person[]>` — `service.findPersonsByGroupId(id)` forward. 200 OK + JSON 배열 (빈 배열 OK). service 분기 → 404 (Group 없음) automatic.
- [ ] **import 경로 추가** — `@nestjs/common` 의 기존 import 에 `Body` (이미 있음 — POST `/api/groups` 가 사용) 확인 + `Param` (이미 있음) + 신규 토큰 0. `@prisma/client` 의 `Person, PersonGroupMembership` type 추가. `./dto/add-member.dto` 의 `AddMemberDto` 추가.
- [ ] **파일 헤더 주석 갱신** (한국어, §12) — T-0055 의 4 endpoint 책임 boundary 에 "+ T-0057 추가 — N:M membership endpoint 3 종 (POST /:id/members / DELETE /:id/members/:membershipId / GET /:id/persons). REQ-028 핵심 invariant fully operational closure" 단락 append. PartController 와의 차이 (N:M middle table 책임의 POST/DELETE 신설) 박제. `:id/persons` endpoint 의 PartController mirror 명시. DELETE path 의 `:membershipId` 결정 사유 박제 (T-0056 service 시그니처 정합, driver 원안 `:personId` 의 정정).
- [ ] **`@UsePipes(new ValidationPipe(...))` controller-scope wire 보존** — T-0055 박제 그대로. 신규 AddMemberDto 의 decorator 가 자동 발화.

**B. `src/user/dto/add-member.dto.ts` 신규 (~28 LOC)**:

- [ ] `AddMemberDto` class — `personId!: string` 1 필드 + `@IsString()` + `@IsNotEmpty()` decorator (CreateGroupDto / CreatePartDto 패턴 mirror).
- [ ] **파일 헤더 주석** (한국어, §12) — REQ-028 의 N:M membership row 신규 등록 시 payload 검증 책임 / ValidationPipe 의 whitelist + forbidNonWhitelisted + transform 결합 동작 / Prisma PersonGroupMembership model 정합 / groupId 가 본 DTO 에 부재 사유 (URL path param 으로 추출) / 책임 경계 (Out of Scope — UUID format regex / Person 존재 검증 등 정교한 invariant 는 service-layer + DB layer 책임, 본 DTO 는 schema-level non-emptiness 만).
- [ ] import 경로: `class-validator` 의 `IsNotEmpty, IsString`.

**C. `src/user/group.controller.spec.ts` 갱신 (~200 LOC 추가, R-112 4 카테고리)**:

- [ ] **기존 4 endpoint test 보존** — 변경 0. service mock helper (`buildGroupServiceMock`) 의 method 추가 — `addMember / removeMember / findPersonsByGroupId` 3 jest.fn() 추가 (T-0056 service 시그니처 정합).
- [ ] **`buildPersonFixture()` local helper** — Person fixture (7 컬럼) — PartController spec / PersonController spec 의 동일 helper reuse.
- [ ] **`buildPersonGroupMembershipFixture()` local helper** — PersonGroupMembership fixture (id / personId / groupId / createdAt 4 컬럼).
- [ ] **`addMember()` describe (R-112 4 카테고리, ~80 LOC)**:
  - happy — valid AddMemberDto + Group + Person 존재 → 201 + 신규 membership propagate. service.addMember 호출 인자 (groupId path / personId body) 1:1 검증.
  - error — service 가 NotFoundException ("group not found") throw → 404 + envelope.
  - error — service 가 NotFoundException ("person not found") throw → 404 + envelope.
  - error — service 가 ConflictException ("already member") throw → 409 + envelope.
  - branch — POST 의 ValidationPipe — missing personId (`{}`) → 400 + service 호출 0.
  - branch — POST 의 ValidationPipe — non-whitelisted field (`{ personId: "p1", foo: "bar" }`) → 400 + service 호출 0.
  - negative — POST 의 ValidationPipe — wrong type (`{ personId: 123 }`) → 400 + service 호출 0.
  - negative — POST 의 ValidationPipe — empty string (`{ personId: "" }`) → 400 + service 호출 0.
- [ ] **`removeMember()` describe (R-112 4 카테고리, ~50 LOC)**:
  - happy — valid membershipId → 204 + body 없음. service.removeMember 호출 인자 (membershipId path) 1:1 검증.
  - error — service 가 NotFoundException ("membership not found") throw → 404 + envelope.
  - branch — service 가 unknown HttpException throw → propagate (변환 안 함).
  - negative — groupId path param 은 service 호출에 미사용 — service 가 단일 인자 (membershipId) 만 받음 검증.
- [ ] **`findPersons()` describe (R-112 4 카테고리, ~60 LOC)**:
  - happy — Group 존재 + Person 다중 → 200 + 배열 propagate (다중 row 길이 검증).
  - branch — Group 존재 + Person 0 → 200 + 빈 배열 propagate (404 변환 안 함).
  - error — service 가 NotFoundException ("group not found") throw → 404 + envelope.
  - negative — service 가 raw error (HttpException 아님) throw → 500 + envelope (NestJS 자동 처리).
- [ ] **call shape 검증** — 각 endpoint 의 GroupService delegate 호출 인자가 spec 의 fixture 와 1:1 match. ValidationPipe 가 400 reject 시 service 호출 0 검증 (`expect(serviceMock.addMember).not.toHaveBeenCalled()`).
- [ ] 각 test 마다 새 mock 생성 (호출 카운터 격리 — T-0055 / PartController spec 패턴 동일).
- [ ] 주석은 R-112 카테고리별 `describe()` 또는 inline 주석으로 구분 — reviewer 의 카테고리 cover 확인 용이.

**D. `src/user/user.module.ts` 변경 0 또는 헤더 주석 1 줄**:

- [ ] GroupController 이미 등록 (T-0055 머지). 본 task 의 controllers 배열 변경 0.
- [ ] 헤더 주석 1 줄 갱신 (선택) — "T-0057 가 GroupController 에 N:M membership endpoint 3 종 추가 — REQ-028 fully operational closure."

**E. R-112 5 항목 cover (CLAUDE.md §3.2)**:

- [ ] **happy-path test**: 3 신규 endpoint 각각 happy 1+ test (POST member 신규 / DELETE membership / GET persons 다중). 총 3+.
- [ ] **error-path test**: POST (Group 없음 / Person 없음 / 이미 member 3 종) + DELETE (membership 없음 1 종) + GET (Group 없음 1 종) — 총 5+.
- [ ] **flow / 분기 cover**: POST (사전 검증 2 분기 + Prisma 분기 + ValidationPipe 4 분기) + DELETE (P2025 vs 그 외) + GET (Group 없음 / Person 0 / Person 다중 3 분기) — 각 분기 1+ test.
- [ ] **negative cases 충분 cover**: AddMemberDto ValidationPipe 의 4 reject case (missing / non-whitelisted / wrong type / empty) — 각 1+. service 호출 0 검증으로 ValidationPipe 가 controller 진입 차단 박제. + GET 의 Person 0 빈 배열 (404 변환 안 함 - happy edge) + DELETE 의 groupId path 가 service 호출에 미사용 의 isolation. 단일 negative 안 됨 — 예외 처리 분기마다 cover.
- [ ] **coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, `package.json` 의 `coverageThreshold.global` 검사). 본 task 의 신규 production 파일 (add-member.dto.ts) + 갱신 (group.controller.ts) 의 신규 3 endpoint 모두 cover → 100% line/function 자연 달성 예상.

**F. 검증 명령**:

- [ ] `pnpm lint` pass (0 error).
- [ ] `pnpm build` pass (TypeScript 컴파일 — Person / PersonGroupMembership type @prisma/client 에서 generation).
- [ ] `pnpm test` pass — 신규 spec 모두 green + 기존 GroupController spec 의 7+ test (T-0055) regression 0 + 기존 spec 전체 regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` pass (regression 0 — smoke 는 docker 부재 환경에서 globalSetup DATABASE_URL fail-fast 정상, CI services.postgres sole validator).
- [ ] `pnpm test:e2e` pass (regression 0).

**G. PR / commit / push**:

- [ ] feature branch `claude/T-0057-group-controller-nm-membership-endpoints` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `feat(user): GroupController N:M membership 3 endpoint + AddMemberDto (T-0057)`.
- [ ] commit body 본문 한국어 (§12) — why / 추가 항목 / 검증 요약 ~5 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added / result / coverage) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함.
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~G 체크리스트.
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupService 신규 메서드 추가** — T-0056 박제 3 N:M 메서드 그대로 사용. 본 task 는 service 호출만, 신규 메서드 추가 0.
- **PersonRepository.findManyByIds batch 메서드 신설** — T-0056 의 loop findById N+1 query 회피용. 별도 doc-only direct + spec 갱신 task 책임.
- **PATCH `/api/groups/:id` endpoint** — Group name 등 update 지원. CRUD 의 U 는 본 task scope 외 (별도 후속 task — GroupService.update + UpdateGroupDto + controller endpoint).
- **api.md `/api/groups/:id/members` + `/api/groups/:id/persons` row 추가** — doc-only direct follow-up (~25 LOC). 본 task 머지 후 일괄 박제 권장.
- **p3-implementation-plan.md §2 표 T-0050~T-0057 row 추가** — T-0045 패턴 재실행 doc-only direct follow-up. 본 task 머지 후 8 row 일괄 추가 권장.
- **AuthGuard / 권한 boundary 적용** — addMember / removeMember = Admin+ 권한 / findPersons = User+ 권한 boundary. 후속 auth task (P3 closure) 책임. PartController 동일 정책.
- **응답 envelope (`{ data: ..., meta: ... }`) 표준화** — Prisma return 그대로 propagate. PartController / 기존 GroupController CRUD 동일 정책 — envelope 표준화 ADR 은 별도 결정 (defer).
- **GET `:id/persons` 의 pagination / sorting / filtering query param** — 후속 task 책임 (REQ-029 평가 자료 조회 시점에 결합).
- **smoke / e2e endpoint 확장** — 신규 3 endpoint 의 smoke / e2e cover 는 별도 test-quality task 책임 (T-0043 / T-0044 + ADR-0004 §Migration persons 패턴 mirror). 본 task 는 unit spec 만.
- **schema.prisma 변경 / 새 migration** — PersonGroupMembership entity / cascade 정책 / unique constraint 박제 완료 (T-0039 / T-0049). 본 task schema 변경 0.
- **새 외부 dependency** — `@prisma/client` / `@nestjs/common` / `class-validator` 만 사용. 새 패키지 0.
- **새 ADR 신설** — 기존 ADR-0001 (NestJS) + ADR-0002 (Prisma + PostgreSQL) + class-validator stack (HQ-0005) 위 mechanical HTTP-facing wrapper. 새 결정 0.
- **`getPrismaErrorCode` helper 외화** — T-0056 §Follow-ups 의 phase 2 외화 candidate. 본 task 는 service-layer 호출만 — controller 에서 Prisma error code 분기 처리 0.
- **directory.md 갱신** — `src/user/dto/add-member.dto.ts` 신규 + `src/user/group.controller.ts` 갱신. 별도 doc-only direct follow-up (~5 LOC).
- **modules.md UserModule 책임 단락 갱신** — conceptual 변경 0 (UserModule 의 책임 boundary 변동 없음, 1 DTO 추가 + 1 controller 확장). 별도 doc-sync trigger 미달.

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (controller 3 endpoint 추가 + 헤더 주석 갱신) + §B (AddMemberDto 신규) + §C (controller spec 확장 — 3 describe + service mock 의 3 method 추가 + fixture 2 helper) + §D (UserModule 헤더 주석 1 줄 또는 변경 0) 3 파일 staging. PartController.findPersons 패턴 + GroupService 의 T-0056 박제 3 메서드 시그니처 정합 검산. 주석 한국어 + 책임 경계 명시 + DELETE path `:membershipId` 결정 사유 박제 (driver 원안 `:personId` 의 정정 — T-0056 service 시그니처 정합). **decision point** — POST `:id/members` 의 path 결정 (driver 원안 `/api/groups/:id/members` 그대로 OK) + DELETE 의 path `:membershipId` 정정 (driver 원안 `:personId` → `:membershipId` 으로 변경 — T-0056 service `removeMember(membershipId)` 시그니처 정합).
- **tester**: §F 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + coverage threshold 통과 확인. spec 의 R-112 4 카테고리 cover 검산. regression 0 확인 — 기존 GroupController spec / persons / parts controller spec / smoke / e2e 영향 0 보장.
- **architect** 호출 안 함 — 새 결정 0 / 새 ADR 0 / module 책임 경계 변동 0. 기존 PartController.findPersons 패턴 + T-0056 service 시그니처 mechanical 조립.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]). T-0049~T-0054 dogfood SUCCESS 9 회 + T-0055 round 2 cycle BROKEN + T-0056 round 1 streak 1 → 본 task 가 streak 2 시도. comment-triggered rerun 자동 absorption 또는 race-disabled variant 기대 (`gh run rerun` 0 회 목표).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **api.md `/api/groups/:id/members` + `/api/groups/:id/persons` row 추가** — doc-only direct ~25 LOC. 본 task 머지 후 일괄 박제. 본 task 의 DELETE path `:membershipId` 결정 사유도 함께 박제.
- [ ] **p3-implementation-plan.md §2 표 T-0050~T-0057 row 추가** — T-0045 패턴 재실행. doc-only direct ~60 LOC. T-0057 머지 후 8 row 일괄 추가 권장.
- [ ] **directory.md `src/user/dto/add-member.dto.ts` 박제** — doc-only direct ~5 LOC.
- [ ] **GroupController smoke + e2e (CRUD + N:M 합쳐서 7 endpoint)** — T-0043 / T-0044 + ADR-0004 §Migration persons 패턴 1:1 mirror. 별도 test-quality task — Group entity 의 real PostgreSQL smoke + e2e 박제. mock 시대 종결의 Group 도메인 확장.
- [ ] **PartController smoke + e2e** — T-0043 / T-0044 패턴 reuse. 별도 test-quality task (Group 과 병행 가능).
- [ ] **GroupService.update + UpdateGroupDto + PATCH endpoint** — CRUD 의 U. 별도 후속 task.
- [ ] **PersonRepository.findManyByIds batch 메서드 신설** — T-0056 의 N+1 query 회피. 별도 doc-only direct + spec 갱신 task. ~30 LOC.
- [ ] **AuthGuard 적용 (addMember / removeMember = Admin+ / findPersons = User+)** — 별도 auth task. PartController 동시 적용 권장.
- [ ] **응답 envelope 표준화 ADR** — `{ data: ..., meta: ... }` 등 표준 envelope. 별도 ADR 결정 + retroactive 적용 task.
- [ ] **`getPrismaErrorCode` helper 외화** — PartService / GroupService / PersonService 3 service 중복. T-0050 §Follow-ups 의 phase 2 외화 candidate.
- [ ] **estimate 정확도 follow-up** — 본 task estimate (280 LOC / 3 파일) 와 실 LOC 검산. T-0055 GroupController CRUD (413 LOC / 4 파일) precedent 비교 — 3 endpoint × spec mass 의 model 갱신.
- [ ] **T-0048 race fix dogfood 11 회차 검증** — T-0049~T-0056 10 회 + T-0055 round 2 BROKEN + T-0056 streak 1 → 본 task 가 streak 2 시도. integrator 의 comment-triggered rerun 자동 absorption 또는 race-disabled variant 지속 monitoring.
- [ ] **REQ-028 fully operational closure 박제** — 본 task 머지 시 Group entity 의 fully operational closure (controller CRUD 4 + service CRUD 4 + service N:M 3 + controller N:M 3 = 합 14 메서드/endpoint). P3 entity backbone 9/11 진척 milestone — p3-implementation-plan.md §6 갱신 doc-only direct follow-up.
