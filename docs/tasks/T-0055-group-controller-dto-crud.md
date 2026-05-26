---
id: T-0055
title: GroupController + CreateGroupDto + REST endpoints CRUD-only (T-0050 Follow-up #1, pr-mode)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 305
estimatedFiles: 4
created: 2026-05-26
plannerNote: P3 backbone 다음 단계 — GroupController + DTO + REST endpoints CRUD-only (N:M ops 후속 T-0056). PartController (T-0046) 1:1 mirror minus :id/persons endpoint. cap envelope (~305 LOC / 4 파일).
dependsOn: [T-0050]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/architecture/p3-implementation-plan.md §6 (entity 박제 progress 7/11 中 Group entity 의 HTTP-facing layer 미박제) + docs/tasks/T-0050 §Follow-ups L173 (선행 후보 #1 — "T-0051 (예상): GroupController + Group DTO + REST endpoints — PartController 패턴 reuse, ~270 LOC / 3 파일") + src/user/part.controller.ts (85 LOC, 5 endpoint controller mirror source) + src/user/part.controller.spec.ts (358 LOC, R-112 4 카테고리 spec mirror source) + src/user/dto/create-part.dto.ts (29 LOC, DTO + class-validator decorator pattern mirror source) + src/user/group.service.ts (T-0050 머지 완료 — 4 메서드 wrapping 대상) + driver-supplied 후보 (a) GroupController + DTO + REST endpoints — layer cake 진척 + cap 안전. 본 task 는 PartController (T-0046) 패턴 1:1 mirror minus `:id/persons` endpoint (Group 의 findPersonsByGroupId 는 N:M membership ops 책임으로 후속 T-0056 task 의존). 4 endpoint 노출 (GET list / GET by id / POST create / DELETE) + CreateGroupDto + UserModule controllers 배열 추가. ROI: 본 task 머지 후 외부 API 클라이언트 가 `/api/groups` 4 endpoint 호출 가능 — GroupService 의 4 메서드 가 HTTP layer 로 expose. PartController 와 다른 점: P2002 분기 부재 (Group.name @unique 없음) + P2003 분기 부재 (cascade 처리) + findPersons endpoint 부재 (N:M 분리).
---

# T-0055 — GroupController + CreateGroupDto + REST endpoints CRUD-only

## Why

[T-0050](T-0050-group-service-crud.md) 머지 (4ed4321, PR-45 round 1) 로 `GroupService` 의 4 메서드 (`create` / `findAll` / `findById` / `delete`) 가 박제 + UserModule 의 providers/exports 에 등록 완료. 그러나 외부 API 클라이언트 가 본 service 를 호출하려면 HTTP-facing layer (`GroupController`) 가 필요. 본 task 는 **PartController (T-0046, [src/user/part.controller.ts](../../src/user/part.controller.ts)) 패턴의 1:1 mirror** — `/api/groups` 4 endpoint (GET list / GET by id / POST create / DELETE) + `CreateGroupDto` + UserModule `controllers` 배열 추가.

**Out of Scope 분리 (cap 보존)** — PartController 가 5 endpoint (CRUD 4 + `:id/persons`) 인 반면 본 task 는 4 endpoint 만 (CRUD-only) — 5 번째 endpoint `findPersonsByGroupId` 는 PersonGroupMembershipRepository 의 N:M join 책임으로 후속 T-0056 (예상) 의 N:M membership operations task 에 통합:

| task | scope | 예상 |
| --- | --- | --- |
| **본 T-0055** | GroupController CRUD-only (4 endpoint) + CreateGroupDto + UserModule wiring + spec | ~305 LOC / 4 파일 |
| 후속 T-0056 (예상) | GroupService N:M ops (`addMember` / `removeMember` / `findPersonsByGroupId`) + 관련 controller endpoint (`POST /api/groups/:id/members` / `DELETE /api/groups/:id/members/:personId` / `GET /api/groups/:id/persons`) + spec | ~250 LOC / 3-4 파일 |

분리 효과:
1. 본 task 의 reviewer 검토가 N:M 책임의 noise 와 격리 — PartController 패턴 mirror 의 1:1 검산만.
2. 본 task 의 spec 이 `GroupRepository`/`PersonGroupMembershipRepository`/`PersonRepository` 3 collaborator mock 의 복합 setup 없이 `GroupService` mock 1 종만 — spec LOC 보존.
3. T-0056 진입 시 본 task 박제된 GroupController 에 endpoint 만 추가 — controller 책임 boundary 자연 확장 가능.

PartController 와 다른 점 (Out of Scope 박제):
1. **`:id/persons` endpoint 미노출** — Group 의 Person list 조회는 PersonGroupMembershipRepository N:M join 책임. 후속 T-0056 책임.
2. **POST 의 P2002 (unique 위반) → 409 변환 미적용** — `Group.name` schema 에 `@unique` 미정의 (prisma/schema.prisma L89-91 참조, 동명 Group 허용). GroupService.create 가 raw forward 이므로 controller 는 추가 변환 없음.
3. **DELETE 의 P2003 (FK 위반) → 409 변환 미적용** — `PersonGroupMembership.group onDelete: Cascade` 가 schema 차원 처리, FK constraint 발생 안 함. GroupService.delete 가 P2025 → NotFoundException 만 변환.
4. **CreateGroupDto 가 PartController 와 동일 shape** — `{ name: string }` + `@IsString()` + `@IsNotEmpty()` (Group.name 도 String non-null). class-validator decorator 1:1.

REQ 매핑: [REQ-028](../requirements.md) (Group 정책 — 한 인원은 임의 group 다중 소속 가능. 본 task 는 Group entity 자체의 CRUD HTTP-facing layer 박제, N:M membership 책임은 후속 T-0056).

## Required Reading

- [src/user/part.controller.ts](../../src/user/part.controller.ts) — 본 task 의 1:1 mirror 패턴 source (85 LOC, 5 endpoint). `@Controller("api/parts")` + `@UsePipes(new ValidationPipe({...}))` controller-scope wire + 4 endpoint method (findAll / findById / create / delete) — **본 task 는 `findPersons` endpoint 미포함**.
- [src/user/part.controller.spec.ts](../../src/user/part.controller.spec.ts) — 본 task 의 spec 패턴 source (358 LOC). R-112 4 카테고리 + supertest 패턴 없이 NestJS Testing module + ValidationPipe wire + PartService mock 패턴 + buildXxxFixture helper + 4xx envelope 검증.
- [src/user/dto/create-part.dto.ts](../../src/user/dto/create-part.dto.ts) — DTO 패턴 source (29 LOC). `@IsString()` + `@IsNotEmpty()` decorator + 책임 경계 주석. **본 task 의 CreateGroupDto 는 shape 동일** (필드 name 1 종).
- [src/user/group.service.ts](../../src/user/group.service.ts) — 본 task 의 wrapping 대상. T-0050 박제 완료의 4 메서드 (create / findAll / findById / delete) + helper. 본 task 는 GroupService 변경 0, 호출만.
- [src/user/group.service.spec.ts](../../src/user/group.service.spec.ts) — GroupService spec 패턴 (T-0050 박제 완료). 본 task 의 spec mock 시그니처 정합 source — `buildGroupRepositoryMock` 의 4 jest.fn() 패턴을 controller spec 의 `buildGroupServiceMock` 로 1:1 mirror.
- [src/user/user.module.ts](../../src/user/user.module.ts) — 본 task 의 wiring 추가 대상. `controllers` 배열에 `GroupController` 추가 (providers/exports 는 T-0050 머지로 GroupService 이미 등록 — 변경 0).
- [prisma/schema.prisma](../../prisma/schema.prisma) L84-97 (Group model) + L116-133 (PersonGroupMembership cascade 정책) — schema 차원의 Group 삭제 시 cascade 동작 확인 (FK constraint P2003 발생 안 함 — DELETE endpoint 의 분기가 404 1 종으로 충분한 근거).
- [docs/architecture/api.md](../architecture/api.md) — REST endpoint 정의 source. Groups 섹션이 박제된 경우 정합 reference, 미박제 시 본 task §A 의 4 endpoint 가 source 가 됨 (api.md 갱신은 별도 doc-only direct follow-up).
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §6 P3 closure progress + §2 task 시퀀스 — 본 task 의 정합성 source. T-0055 row 의 본 §2 표 추가는 별도 doc-only direct follow-up task 책임 (본 task 는 plan 변경 0).
- [docs/tasks/T-0050-group-service-crud.md](T-0050-group-service-crud.md) — GroupService backbone task 의 acceptance 패턴 + Follow-ups #1 (본 task 의 source) + PartService 와의 차이점 4 항목 박제 reference.
- [docs/tasks/T-0046-part-service-controller-dto-backbone.md](T-0046-part-service-controller-dto-backbone.md) — PartController backbone task 의 acceptance 패턴 source (참고). 본 task 는 그 중 controller + DTO 부분만 박제 (service split 은 T-0050 으로 분리 완료).
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — `src/` 변경) / §3.2 (R-110~R-114) / §11 (trail blob) / §12 (한국어 본문).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — T-0048 race 인지 절차 (T-0049~T-0054 dogfood SUCCESS 9 회 연속 검증, 본 task 도 동일 절차 적용 — comment-triggered rerun 자동 absorption 또는 race-disabled variant 기대).

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0055-group-controller-dto-crud` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `src/user/group.controller.ts` 신규 (~70 LOC)**:

- [ ] `@Controller("api/groups")` + `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` controller-scope wire (PartController 패턴 1:1 mirror).
- [ ] constructor 에서 `GroupService` private readonly 주입 (PersonService / PersonGroupMembershipRepository 미주입 — N:M ops 는 후속 task).
- [ ] **GET `/api/groups`** — `findAll(): Promise<Group[]>` — `groupService.findAll()` forward. 200 OK + JSON 배열 (빈 배열 가능). 정렬 / pagination 미지원 (raw forward).
- [ ] **GET `/api/groups/:id`** — `findById(@Param("id") id: string): Promise<Group>` — `groupService.findById(id)` forward. row 부재 시 service 가 `NotFoundException` throw → 404 자동 mapping.
- [ ] **POST `/api/groups`** — `@HttpCode(201)` + `create(@Body() dto: CreateGroupDto): Promise<Group>` — `groupService.create(dto)` forward. ValidationPipe 가 dto 의 2 decorator (`@IsString()` / `@IsNotEmpty()`) 검증 — 위반 시 400 BadRequest 자동. **P2002 (409) 변환 분기 부재** — Group.name 에 `@unique` 미정의, raw forward.
- [ ] **DELETE `/api/groups/:id`** — `@HttpCode(204)` + `delete(@Param("id") id: string): Promise<void>` — `groupService.delete(id)` forward. row 부재 시 service 가 `NotFoundException` throw → 404 자동. **P2003 (409) 변환 분기 부재** — cascade 가 schema 차원 처리.
- [ ] **`:id/persons` endpoint 미노출** — `findPersons` 메서드 신설 안 함 (후속 T-0056 책임).
- [ ] **`PATCH` endpoint 미노출** — Group name 등 update 미지원 (별도 후속 task 책임 — CRUD 의 U).
- [ ] 파일 헤더 주석 (한국어, §12) — 책임 / api.md 정합 / ValidationPipe wire 결정 (PartController 동일 reuse) / 책임 경계 (Out of Scope) — `:id/persons` endpoint 미포함 / PATCH 미포함 / AuthGuard 미적용 / 응답 envelope 미표준화 / GET list pagination 미지원 등.
- [ ] import 경로: `@nestjs/common` 의 `Body, Controller, Delete, Get, HttpCode, Param, Post, UsePipes, ValidationPipe` / `@prisma/client` 의 `Group` type / `./dto/create-group.dto` 의 `CreateGroupDto` / `./group.service` 의 `GroupService`.

**B. `src/user/dto/create-group.dto.ts` 신규 (~28 LOC)**:

- [ ] `CreateGroupDto` class — `name!: string` 1 필드 + `@IsString()` + `@IsNotEmpty()` decorator (CreatePartDto 1:1 mirror).
- [ ] 파일 헤더 주석 (한국어, §12) — REQ-028 의 신규 Group 등록 payload 검증 책임 / ValidationPipe 의 whitelist + forbidNonWhitelisted + transform 결합 동작 / Prisma Group model 정합 / 책임 경계 (Out of Scope — trim / regex / case-insensitive 중복 검증 등 정교한 invariant 는 후속 task 책임 / UpdateGroupDto 신설 안 함 — PATCH endpoint 미노출).
- [ ] import 경로: `class-validator` 의 `IsNotEmpty, IsString`.

**C. `src/user/group.controller.spec.ts` 신규 (~200 LOC, R-112 4 카테고리)**:

- [ ] `Test.createTestingModule({ controllers: [GroupController], providers: [{ provide: GroupService, useValue: serviceMock }] })` 기반 NestJS Testing module setup (PartController spec 1:1 mirror).
- [ ] `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` global wire — controller decorator 의 effect 가 testing context 에서 발화 보장 (PartController spec 동일 패턴).
- [ ] `buildGroupFixture(overrides: Partial<Group> = {}): Group` local helper — id / name / createdAt / updatedAt 4 필드 default 채움 (PartFixture / GroupFixture 패턴 mirror).
- [ ] `buildGroupServiceMock()` local helper — `{ groupService: GroupService; serviceMock: { create, findAll, findById, delete } }` 4 jest.fn() 보유 (GroupService 의 4 메서드 1:1).
- [ ] **happy path 4 종 (각 endpoint 1+ test)**:
  - GET `/api/groups` → 200 + 배열 propagate (다중 row 길이 검증).
  - GET `/api/groups/:id` → 200 + 단일 객체 propagate (service mock return 그대로).
  - POST `/api/groups` → 201 + 신규 객체 propagate. ValidationPipe 가 valid dto 통과.
  - DELETE `/api/groups/:id` → 204 + body 없음 (NestJS 자동 처리).
- [ ] **error path 2 종**:
  - GET `/api/groups/:id` 가 service 가 `NotFoundException` throw 시 → 404 + envelope (statusCode / message / error).
  - DELETE `/api/groups/:id` 가 service 가 `NotFoundException` throw 시 → 404 + envelope.
- [ ] **branch / negative 충분 cover**:
  - GET list 가 빈 배열 반환 시 → 200 + 빈 배열 propagate (404 변환 안 함).
  - POST 의 ValidationPipe — missing name (`{}`) → 400 BadRequest + envelope.
  - POST 의 ValidationPipe — non-whitelisted field (`{ name: "ok", foo: "bar" }`) → 400 BadRequest (forbidNonWhitelisted).
  - POST 의 ValidationPipe — wrong type (`{ name: 123 }`) → 400 BadRequest.
  - POST 의 ValidationPipe — empty string (`{ name: "" }`) → 400 BadRequest (@IsNotEmpty).
- [ ] **call shape 검증**: 각 endpoint 의 GroupService delegate 호출 인자가 spec 의 fixture 와 1:1 match (예: `expect(serviceMock.create).toHaveBeenCalledWith({ name: "fixture-name" })`). 단 ValidationPipe 가 400 reject 시 service 호출 0 검증 (`expect(serviceMock.create).not.toHaveBeenCalled()`).
- [ ] 각 test 마다 새 mock 생성 (호출 카운터 격리 — PartController spec 패턴 동일).
- [ ] 주석은 R-112 카테고리별 `describe()` 또는 inline 주석으로 구분 — reviewer 의 카테고리 cover 확인 용이.

**D. `src/user/user.module.ts` 갱신 (~5 LOC)**:

- [ ] `import { GroupController } from "./group.controller";` 추가.
- [ ] `controllers` 배열에 `GroupController` 추가 — 결과: `controllers: [PersonController, PartController, GroupController]`.
- [ ] 파일 헤더 주석 한 줄 추가 — "T-0055 가 GroupController + CreateGroupDto 를 추가 — Group entity 의 HTTP-facing layer 박제 (CRUD-only 4 endpoint). N:M membership operations (addMember / removeMember / findPersonsByGroupId) 는 후속 별도 task (T-0056 예상) 책임."
- [ ] `providers` / `exports` 배열 변경 0 — GroupService 는 T-0050 머지로 이미 등록.

**E. R-112 5 항목 cover (CLAUDE.md §3.2)**:

- [ ] **happy-path test**: 4 endpoint (GET list / GET by id / POST / DELETE) 각각 happy path 1+ test (총 4+).
- [ ] **error-path test**: 2+ error case (GET by id 의 404 / DELETE 의 404).
- [ ] **flow / 분기 cover**: GET list (빈 배열 vs 다중 row 2 분기) / GET by id (404 vs 200 2 분기) / DELETE (404 vs 204 2 분기) / POST (valid vs 4 validation reject 분기) 각 분기 1+ test.
- [ ] **negative cases 충분 cover**: ValidationPipe 4 reject case (missing name / non-whitelisted field / wrong type / empty string) — 각 1+ test. service 호출 0 검증으로 ValidationPipe 가 controller 진입 차단 박제.
- [ ] **coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, `package.json` 의 `coverageThreshold.global` 검사). 본 task 의 신규 production 파일 (group.controller.ts + create-group.dto.ts) 은 모든 endpoint + dto 1 필드 cover → 100% line/function 자연 달성 예상.

**F. 검증 명령**:

- [ ] `pnpm lint` pass (0 error).
- [ ] `pnpm build` pass (TypeScript 컴파일 — Group type @prisma/client 에서 generation 됨).
- [ ] `pnpm test` pass — 신규 spec 모두 green + 기존 test regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` pass (regression 0 — smoke 는 docker 부재 환경에서 globalSetup DATABASE_URL fail-fast 정상, CI services.postgres 가 sole validator).
- [ ] `pnpm test:e2e` pass (regression 0 — e2e 도 동일 fail-fast 패턴).

**G. PR / commit / push**:

- [ ] feature branch `claude/T-0055-group-controller-dto-crud` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `feat(user): GroupController + CreateGroupDto CRUD-only 4 endpoint (T-0055)`.
- [ ] commit body 본문 한국어 (§12) — why / 추가 항목 / 검증 요약 ~5 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added / result / coverage) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함.
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~G 체크리스트.
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **N:M membership operations (addMember / removeMember / findPersonsByGroupId)** — `GroupService.addMember(groupId, personId)` + `GroupService.removeMember(membershipId)` + `GroupService.findPersonsByGroupId(groupId)` + 관련 controller endpoint (`POST /api/groups/:id/members` + `DELETE /api/groups/:id/members/:personId` + `GET /api/groups/:id/persons`). 별도 후속 task (T-0056 예상, ~250 LOC / 3-4 파일). PersonGroupMembershipRepository (T-0049) 의 4 메서드 호출 + PersonRepository 의 findManyByIds (T-0041 또는 신설) 조합 source.
- **`GET /api/groups/:id/persons` endpoint** — Group 소속 Person list 의 HTTP-facing endpoint. N:M membership ops task (T-0056) 책임 — service-layer (`findPersonsByGroupId`) + controller-layer 동시 박제.
- **`PATCH /api/groups/:id` endpoint** — Group name 등 update 지원. CRUD 의 U 는 본 task scope 외 (별도 후속 task — GroupService.update 메서드 + UpdateGroupDto + controller endpoint).
- **GroupService 변경** — T-0050 박제 4 메서드 그대로 사용. 본 task 는 service 호출만, 신규 메서드 추가 0.
- **GroupRepository 확장** — 신규 메서드 추가 없음 (예: findByName / findByMemberCount 등). T-0039 박제 4 메서드 그대로.
- **AuthGuard / 권한 적용** — Admin+ / User+ 권한 boundary 적용 안 함. 후속 auth task (P3 closure 의 별도 row) 책임. PartController 동일 정책.
- **응답 envelope (`{ data: ..., meta: ... }`) 표준화** — Prisma return 그대로 propagate. PartController 동일 정책 — envelope 표준화 ADR 은 별도 결정 (defer).
- **GET list 의 pagination / sorting / filtering query param** — 후속 task 책임 (REQ-029 평가 자료 조회 시점에 결합).
- **smoke / e2e endpoint 확장** — 신규 4 endpoint 의 smoke / e2e cover 는 별도 test-quality task 책임 (T-0043 / T-0044 패턴 reuse, ADR-0004 §Migration 의 persons 패턴 mirror). 본 task 는 unit spec 만.
- **schema.prisma 변경 / 새 migration** — Group entity 박제 (T-0039) 완료. 본 task 는 schema 변경 0.
- **새 외부 dependency** — `@prisma/client` 의 `Group` type / `@nestjs/common` 의 8 종 / `class-validator` 의 `IsNotEmpty, IsString` 만 사용. 새 패키지 0.
- **새 ADR 신설** — 본 task 는 기존 ADR-0001 (NestJS) + ADR-0002 (Prisma + PostgreSQL) + class-validator stack 결정 (HQ-0005) 위 mechanical HTTP-facing wrapper. 새 결정 0.
- **api.md `/api/groups` 4 endpoint row 추가** — doc-only direct follow-up (~20 LOC, 4 row 추가). 본 task 머지 후 T-0056 (N:M endpoint) 동시 박제가 더 효율적.
- **p3-implementation-plan.md §2 표 T-0050~T-0055 row 추가** — T-0045 패턴 재실행 doc-only direct follow-up. 본 task 머지 후 일괄 6 row 추가 권장.
- **directory.md 갱신** — `src/user/group.controller.ts` + `src/user/dto/create-group.dto.ts` 추가 박제. 별도 doc-only direct follow-up (~5 LOC).
- **modules.md UserModule 책임 단락 갱신** — conceptual 변경 0 (UserModule 의 책임 boundary 변동 없음, 1 controller + 1 DTO 추가). 별도 doc-sync trigger 미달.
- **PartService 와 GroupService 의 `getPrismaErrorCode` helper 중복 외화** — T-0050 §Follow-ups 의 phase 2 외화 candidate. 본 task scope 외.

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (controller 신규) + §B (DTO 신규) + §C (controller spec 신규) + §D (UserModule wiring) 4 파일 staging. PartController 패턴 1:1 mirror minus `:id/persons` endpoint — 자유도 낮음. 주석 한국어 + 책임 경계 명시 + PartController 와의 차이점 4 항목 (P2002 분기 부재 / P2003 분기 부재 / `:id/persons` endpoint 부재 / `PATCH` endpoint 부재) 명시.
- **tester**: §F 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + coverage threshold 통과 확인. spec 의 R-112 4 카테고리 cover 검산. regression 0 확인 — 기존 persons / parts controller spec / smoke / e2e 영향 0 보장.
- **architect** 호출 안 함 — 새 결정 0 / 새 ADR 0 / module 책임 경계 변동 0. 기존 PartController 패턴 1:1 mirror.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]). T-0049~T-0054 dogfood SUCCESS 9 회 연속 패턴 reuse — comment-triggered rerun 자동 absorption 또는 race-disabled variant 기대 (`gh run rerun` 0 회 목표).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **T-0056 (예상): GroupService N:M membership operations + 관련 controller endpoint** — `addMember` / `removeMember` / `findPersonsByGroupId` service 메서드 + `POST /api/groups/:id/members` / `DELETE /api/groups/:id/members/:personId` / `GET /api/groups/:id/persons` controller endpoint + spec. PersonGroupMembershipRepository (T-0049) + PersonRepository 의 N:M join. ~250 LOC / 3-4 파일.
- [ ] **api.md `/api/groups` 4 endpoint row 추가** — doc-only direct ~20 LOC. T-0056 머지 후 7 endpoint 한꺼번에 박제가 효율적.
- [ ] **p3-implementation-plan.md §2 표 T-0050~T-0055 row 추가** — T-0045 패턴 재실행. doc-only direct ~50 LOC. T-0055 머지 후 일괄 6 row 추가 권장.
- [ ] **directory.md `src/user/group.controller.ts` + `src/user/dto/create-group.dto.ts` 박제** — doc-only direct ~5 LOC.
- [ ] **GroupController smoke + e2e 확장** — T-0043 / T-0044 + ADR-0004 §Migration persons 패턴 1:1 mirror. 별도 test-quality task — Group entity 의 real PostgreSQL smoke (9+ test) + e2e (11+ test) 박제. mock 시대 종결의 Group 도메인 확장.
- [ ] **PartController smoke + e2e 확장** — T-0043 / T-0044 + ADR-0004 §Migration persons 패턴 reuse. Part entity 의 real PostgreSQL smoke + e2e 박제. 별도 test-quality task (Group 과 병행 가능).
- [ ] **GroupService.update + UpdateGroupDto + PATCH endpoint** — CRUD 의 U. Group name 등 mutation 지원. 별도 후속 task.
- [ ] **AuthGuard / 권한 boundary 적용** — Admin+ / User+ 권한 boundary. PartController 동시 적용 권장 (별도 ADR + auth task — P3 closure 의 별도 row).
- [ ] **응답 envelope 표준화 ADR** — `{ data: ..., meta: ... }` 등 표준 envelope. 별도 ADR 결정 + retroactive 적용 task.
- [ ] **estimate 정확도 follow-up** — 본 task estimate (305 LOC / 4 파일) 와 실 LOC 검산. PartController (T-0046) 의 actual 비교 — 4 endpoint vs 5 endpoint 의 spec LOC 차이 측정.
- [ ] **T-0048 race fix dogfood 10 회차 검증** — T-0049~T-0054 9 회 연속 SUCCESS, 본 task 가 10 회차. integrator 의 comment-triggered rerun 자동 absorption 또는 race-disabled variant 지속 동작 monitoring.
