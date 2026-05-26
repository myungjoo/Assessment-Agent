---
id: T-0050
title: GroupService CRUD-only service-layer — Group entity 의 4 메서드 (create/findAll/findById/delete) + R-112 spec (pr-mode)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 310
estimatedFiles: 3
created: 2026-05-26
completedAt: 2026-05-26T14:36:00+09:00
prNumber: 45
mergedAs: 4ed4321
plannerNote: P3 backbone 다음 단계 — GroupService 의 CRUD-only 서비스 레이어 (Controller/DTO/N:M ops 는 후속 task). PartService (T-0046) 1:1 mirror, GroupRepository 위 4 메서드 + R-112 4 카테고리 spec + UserModule wiring. cap envelope (~310 LOC/3 파일).
dependsOn: [T-0039, T-0049]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/architecture/p3-implementation-plan.md §6 (entity 7/11 박제 완료 中 Group entity 의 service-layer 미박제) + docs/tasks/T-0049 §Follow-ups L148 (GroupService backbone 다음 단계 — N:M membership 책임 후속 task 분리 권고) + docs/tasks/T-0046 (PartService backbone 패턴 reuse template) + driver-supplied 후보 (a1.1 GroupService-CRUD-only no-controller split) + src/user/part.service.ts (95 LOC service mirror source) + src/user/part.service.spec.ts (330+ LOC spec R-112 4 카테고리 패턴 source) + src/user/group.repository.ts (T-0039 박제 완료 — 4 메서드 wrapping 대상). 본 task 는 PartService (T-0046) 패턴의 1:1 mirror — Group entity 의 CRUD-only 서비스 4 메서드 (create / findAll / findById / delete) + Jest spec (R-112 happy / error / branch / negative 4 카테고리) + UserModule wiring 의 3 파일 박제. findPersonsByGroupId / N:M membership add/remove operations / GroupController / Group DTO / REST endpoints 는 후속 별도 task 책임 (cap 보존 위해 split). ROI: 본 task 머지 후 GroupController + DTO + N:M membership ops task 가 본 service 의 4 메서드 호출 + PersonGroupMembershipRepository (T-0049) 4 메서드 호출 조합으로 HTTP-facing layer 박제 가능.
---

# T-0050 — GroupService CRUD-only service-layer

## Why

[p3-implementation-plan.md §6](../architecture/p3-implementation-plan.md) P3 closure progress 의 "entity 박제 progress 7/11" 중 **Group entity 의 service-layer 가 미박제**. 결과로 후속 backbone task (GroupController + DTO + N:M membership add/remove operations) 가 진입할 때 service-layer 가 부재해 HTTP-facing layer 가 GroupRepository / PersonGroupMembershipRepository 를 직접 호출해야 하거나 (controller 가 repository inject — NestJS 표준 위반), 본 service + controller + DTO + N:M ops 를 단일 task 로 묶어 cap 초과 (~600 LOC / 8+ 파일) 위험.

본 task 는 **PartService (T-0046, [src/user/part.service.ts](../../src/user/part.service.ts)) 패턴의 1:1 mirror** — Group entity 의 4 메서드 (`create` / `findAll` / `findById` / `delete`) + Jest spec (R-112 4 카테고리 — happy / error / branch / negative 충분 cover) + UserModule wiring 의 3 파일 박제. 본 task 는 새 외부 dependency 0 / 새 ADR 0 / schema 변경 0 / migration 0 — 기존 GroupRepository (T-0039) 위 service 레이어만 박제.

PartService 와 다른 점:

1. **PersonRepository 의존성 없음** — PartService 는 `findPersonsByPartId` 책임으로 PersonRepository.findByPartId 를 호출하나, GroupService 의 동등 메서드 `findPersonsByGroupId` 는 PersonGroupMembershipRepository (N:M join) 의 호출이 필요하므로 별도 task (membership ops) 로 분리. 본 task 의 GroupService 는 GroupRepository 만 inject.
2. **FK constraint (P2003) 처리 분기 없음** — PartService.delete 의 P2003 (소속 Person 1+ 시 Restrict) 분기는 schema 의 `Person.partId` FK 가 default Restrict 이므로 필요. GroupService.delete 는 schema 의 cascade 정책 (`PersonGroupMembership.group onDelete: Cascade`) 으로 인해 FK constraint 가 발생하지 않음 — Group 삭제 시 모든 membership row 가 자동 동반 삭제. 따라서 delete 의 분기는 P2025 (row 부재) 1 종만.

분리 효과 (cap 보존):

1. **본 task** (~310 LOC / 3 파일): GroupService + spec + module wiring.
2. **후속 T-0051** (예상 ~270 LOC / 3 파일): GroupController + Group DTO + REST endpoints (`/api/groups` 5 endpoint) + controller spec.
3. **후속 T-0052** (예상 ~200 LOC / 2-3 파일): N:M membership operations — `addMember(groupId, personId)` / `removeMember(membershipId or groupId+personId)` + 관련 controller endpoint (`POST /api/groups/:id/members` / `DELETE /api/groups/:id/members/:personId`).

각 task 가 cap 안에서 분리되면 reviewer round 1 단발 머지 가능성 ↑, debugging 시 책임 boundary 명확.

REQ 매핑: [REQ-028](../requirements.md) (Group 정책 — 한 인원은 임의 group 다중 소속 가능. 본 task 는 Group entity 자체의 CRUD service-layer 만 박제, N:M membership 책임은 후속 T-0052).

## Required Reading

- [src/user/part.service.ts](../../src/user/part.service.ts) — 본 task 의 1:1 mirror 패턴 source. `@Injectable()` + constructor injection + 4 메서드 (create / findAll / findById / delete) + Prisma error code 변환 helper (`getPrismaErrorCode`) + ConflictException / NotFoundException 변환 패턴 + 책임 경계 주석 정책. **본 task 는 findPersonsByPartId 미포함**.
- [src/user/part.service.spec.ts](../../src/user/part.service.spec.ts) — 본 task 의 spec 패턴 source. R-112 4 카테고리 (happy / error / branch / negative) + Prisma error code (P2002 / P2025) 변환 검증 + buildXxxFixture / buildPartRepositoryMock / buildPrismaError 헬퍼 패턴. **본 task 는 personRepository mock 미사용**.
- [src/user/group.repository.ts](../../src/user/group.repository.ts) — 본 task 의 wrapping 대상. T-0039 박제 완료의 4 메서드 (create / findById / findMany / delete) + GroupCreateInput interface. 본 task 는 GroupRepository 변경 0, 호출만.
- [src/user/group.repository.spec.ts](../../src/user/group.repository.spec.ts) — Group repository 의 기존 R-112 spec 패턴. 본 task 의 spec mock 시그니처 정합 source.
- [src/user/dto/create-part.dto.ts](../../src/user/dto/create-part.dto.ts) — DTO 패턴 source. 본 task 는 CreateGroupDto **신설 안 함** (Controller/DTO 는 T-0051 책임). GroupService.create 의 input 은 `{ name: string }` shape 의 inline type — DTO class 신설 없이 GroupRepository.GroupCreateInput interface 직접 사용 또는 service-local interface.
- [src/user/user.module.ts](../../src/user/user.module.ts) — 본 task 의 wiring 추가 대상. providers + exports 배열에 `GroupService` 추가. controllers 변경 0 (GroupController 는 T-0051 책임).
- [prisma/schema.prisma](../../prisma/schema.prisma) L84-97 (Group model) + L116-133 (PersonGroupMembership cascade 정책) — schema 차원의 Group 삭제 시 cascade 동작 확인 (FK constraint P2003 발생 안 함 — delete 분기가 P2025 1 종으로 충분한 근거).
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §6 P3 closure progress + §2 task 시퀀스 — 본 task 의 정합성 source. T-0050 row 의 본 §2 표 추가는 별도 doc-only direct follow-up task 책임 (본 task 는 plan 변경 0).
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 row 3 (Group) + §3 관계 2 (Person↔Group N:M) — 본 task 의 entity scope source.
- [docs/architecture/modules.md](../architecture/modules.md) UserModule 단락 — 본 task 의 책임 module 정합성 source.
- [docs/tasks/T-0046-part-service-controller-dto-backbone.md](T-0046-part-service-controller-dto-backbone.md) — PartService backbone task 의 acceptance 패턴 source (참고). 본 task 는 그 중 service 부분만 박제 (controller / dto split).
- [docs/tasks/T-0049-person-group-membership-repository.md](T-0049-person-group-membership-repository.md) — PersonGroupMembershipRepository task — 후속 GroupService N:M membership ops task (T-0052 예상) 가 본 repository 호출 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — `src/` 변경) / §3.2 (R-110~R-114) / §11 (trail blob) / §12 (한국어 본문).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — T-0048 race 인지 절차 (T-0049 dogfood SUCCESS 확인, 본 task 도 동일 절차 적용 — comment-triggered rerun 자동 absorption 기대).

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0050-group-service-crud` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `src/user/group.service.ts` 신규 (~85 LOC)**:

- [ ] `GroupService` class `@Injectable()` + constructor 에서 `GroupRepository` private readonly 주입 (PersonRepository / PersonGroupMembershipRepository 미주입 — N:M ops 는 후속 task).
- [ ] `create(dto: { name: string }): Promise<Group>` — `groupRepository.create({ name: dto.name })` forward. Prisma `P2002` (unique 위반 가능성 있다면) 변환 — **단 Group.name 은 schema 에 `@unique` 미정의** (prisma/schema.prisma L89-91 참조: name 컬럼은 `@unique` 없음, 동명 Group 허용). 따라서 P2002 변환 분기 **불필요** — try/catch 미적용, raw forward. 본 결정의 근거는 service 헤더 주석에 한 줄 박제 (PartService 와의 차이점).
- [ ] `findAll(): Promise<Group[]>` — `groupRepository.findMany()` raw forward. 정렬 / pagination 은 후속 task 책임 (본 layer 는 raw forward, PartService.findAll 패턴 mirror).
- [ ] `findById(id: string): Promise<Group>` — `groupRepository.findById(id)` 호출 → null 시 `NotFoundException("group not found: <id>")` throw. PartService.findById 패턴 1:1 mirror.
- [ ] `delete(id: string): Promise<void>` — `groupRepository.delete(id)` 호출 → P2025 (row 부재) 시 `NotFoundException("group not found: <id>")` 변환. **P2003 (FK 위반) 분기 미적용** — PersonGroupMembership 의 `onDelete: Cascade` 가 schema 차원 처리. 본 결정의 근거는 service 헤더 주석에 한 줄 박제.
- [ ] `getPrismaErrorCode(error: unknown): string | undefined` private helper — PartService 와 동일 duck typing 패턴 (`Prisma.PrismaClientKnownRequestError` 의 instanceof check 대신 runtime 의존성 회피). PartService 와의 helper 중복은 본 task scope 외 — phase 2 helper 외화 follow-up (T-0047 패턴 확장) 으로 분리.
- [ ] 파일 헤더 주석 — PartService 패턴 mirror: 책임 / 책임 경계 (Out of Scope) / Prisma error 정책 / N:M membership ops 는 후속 task 책임 / Controller 부재 (HTTP-facing layer 는 T-0051) / Group.name `@unique` 없음 → P2002 변환 분기 부재 / cascade 정책 → P2003 분기 부재.
- [ ] import 경로: `@nestjs/common` 의 `Injectable` + `NotFoundException` / `@prisma/client` 의 `Group` type / `./group.repository` 의 `GroupRepository`.
- [ ] **분기 없는 메서드 (create, findAll)** — 본 메서드는 try/catch 분기 없는 raw forward. R-112 의 "각 분기 1+ test" 항목 — 본 메서드는 분기 0 이므로 happy path 만 cover, R-112 본 항목 적용 면제 (Acceptance §B 의 R-112 검산에서 "분기 없음 — 적용 면제" 명시).

**B. `src/user/group.service.spec.ts` 신규 (~220 LOC, R-112 4 카테고리)**:

- [ ] `buildGroupFixture(overrides: Partial<Group> = {}): Group` local helper — id / name / createdAt / updatedAt 4 필드 default 채움 (PartFixture 패턴 mirror).
- [ ] `buildGroupRepositoryMock()` local helper — `{ groupRepository: GroupRepository; groupRepoMock: { create, findById, findMany, delete } }` 4 jest.fn() 보유. PartRepository mock 패턴 mirror.
- [ ] `buildPrismaError(code: string, message?: string): Error` local helper — PartService spec 과 동일 duck typing 패턴.
- [ ] **happy path 4 종 (각 메서드 1+ test)**:
  - create() 가 dto 의 name 을 GroupRepository.create 에 forward + 결과 propagate.
  - findAll() 이 GroupRepository.findMany 호출 + 배열 propagate (다중 row 길이 검증).
  - findById() 가 GroupRepository.findById 호출 + 결과 propagate (row 존재 case).
  - delete() 가 GroupRepository.delete 호출 + 정상 종료 (void return).
- [ ] **error path 3 종**:
  - findById() 가 GroupRepository.findById 가 null 반환 시 `NotFoundException` throw + message regex `/group not found:.*/` 검증.
  - delete() 가 GroupRepository.delete 가 P2025 throw 시 `NotFoundException` 변환 + message 검증.
  - delete() 가 unknown Prisma error (예: P2003 또는 미지 code) throw 시 그대로 propagate (catch 안 함).
- [ ] **branch / negative 충분 cover**:
  - findAll() 이 빈 배열 반환 시 빈 배열 그대로 propagate (NotFoundException 변환 안 함 — 빈 list 는 정상).
  - findById() 의 null 분기 vs found 분기 둘 다 cover.
  - delete() 의 P2025 분기 vs unknown code 분기 cover (위 error 섹션과 union).
  - create() 가 GroupRepository.create 의 unknown error 그대로 propagate (catch 0 검증) — Group.name `@unique` 없음 따라 P2002 변환 부재의 spec 차원 검증.
  - **negative: Empty / non-existent id** — findById("") / delete("") 가 underlying repo 의 raw forward 패턴 — 본 service 는 id validation 없음, GroupRepository / Prisma 차원 처리.
- [ ] **call shape 검증**: 각 메서드의 GroupRepository delegate 호출 인자가 spec 의 fixture 와 1:1 match (예: `expect(groupRepoMock.create).toHaveBeenCalledWith({ name: "fixture-name" })`).
- [ ] 각 test 마다 새 mock 생성 (호출 카운터 격리 — PartService spec 패턴 동일).
- [ ] 주석은 R-112 카테고리별 `describe()` 또는 inline 주석으로 구분 — reviewer 의 카테고리 cover 확인 용이.

**C. `src/user/user.module.ts` 갱신 (~10 LOC)**:

- [ ] `import { GroupService } from "./group.service";` 추가.
- [ ] `providers` 배열에 `GroupService` 추가.
- [ ] `exports` 배열에 `GroupService` 추가 (후속 GroupController + N:M membership ops task 가 inject 가능).
- [ ] 파일 헤더 주석 한 줄 추가 — "T-0050 가 GroupService 를 추가 — Group entity 의 CRUD-only service layer. GroupController + Group DTO + REST endpoint + N:M membership add/remove operations 는 후속 별도 task (T-0051 / T-0052 예상) 책임."
- [ ] `controllers` 배열 변경 0 — 본 task 는 controller 부재.

**D. R-112 5 항목 cover (CLAUDE.md §3.2)**:

- [ ] **happy-path test**: 4 메서드 (create / findAll / findById / delete) 각각 happy path 1+ test (총 4+).
- [ ] **error-path test**: 3+ error case (findById NotFound / delete P2025 NotFound / delete unknown error propagate).
- [ ] **flow / 분기 cover**: findById (null vs found 2 분기) / delete (P2025 vs unknown 2 분기) 각 분기 1+ test. **create, findAll 은 분기 없음 — 본 항목 적용 면제** (raw forward + 분기 없음).
- [ ] **negative cases 충분 cover**: empty id forward 검증 / unknown Prisma error code 의 raw propagate / findAll 빈 배열 / create 의 unknown error 의 raw propagate (P2002 변환 미적용 spec 차원 검증).
- [ ] **coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, `package.json` 의 `coverageThreshold.global` 검사). 본 task 의 신규 production 파일 (group.service.ts) 은 4 메서드 모두 cover → 100% line/function 자연 달성 예상. helper `getPrismaErrorCode` 의 duck typing 분기 4 종 (object null / code 없음 / code non-string / code string 정상) 도 spec 의 unknown error / null / non-Error throw 케이스로 자연 cover.

**E. 검증 명령**:

- [ ] `pnpm lint` pass (0 error).
- [ ] `pnpm build` pass (TypeScript 컴파일 — Group type @prisma/client 에서 generation 됨).
- [ ] `pnpm test` pass — 신규 spec 모두 green + 기존 test regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` pass (regression 0).
- [ ] `pnpm test:e2e` pass (regression 0).

**F. PR / commit / push**:

- [ ] feature branch `claude/T-0050-group-service-crud` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `feat(user): GroupService CRUD-only 4 메서드 + R-112 spec (T-0050)`.
- [ ] commit body 본문 한국어 (§12) — why / 추가 항목 / 검증 요약 ~5 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added / result / coverage) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함.
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~F 체크리스트.
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupController + Group DTO + REST endpoints** — `/api/groups` 5 endpoint (POST / GET list / GET by id / DELETE) + class-validator decorator. 별도 후속 task (T-0051 예상, ~270 LOC / 3 파일). PartController + CreatePartDto (T-0046) 패턴 reuse.
- **N:M membership operations (addMember / removeMember)** — `GroupService.addMember(groupId, personId)` + `GroupService.removeMember(membershipId)` + 관련 controller endpoint (`POST /api/groups/:id/members` + `DELETE /api/groups/:id/members/:personId`). 별도 후속 task (T-0052 예상, ~200 LOC / 2-3 파일). PersonGroupMembershipRepository (T-0049) 의 4 메서드 호출 source.
- **findPersonsByGroupId 메서드** — 지정 Group 소속 Person list. PersonGroupMembershipRepository.findByGroupId 호출 후 PersonRepository 의 ID list 조회 조합 필요 — N:M membership ops 와 함께 T-0052 책임.
- **GroupService.update 메서드** — Group name 등 PATCH 지원. CRUD 의 U 는 본 task scope 외 (별도 후속 task).
- **GroupRepository 확장** — 신규 메서드 추가 없음 (예: findByName / findByMemberCount 등). T-0039 박제 4 메서드 그대로 사용.
- **Person.partId 의 mandatory invariant 강제** — REQ-028 의 "조직도 파트 정확히 1" service-layer 강제는 PersonService 책임 (별도 task).
- **schema.prisma 변경 / 새 migration** — Group entity 박제 (T-0039) 완료. 본 task 는 schema 변경 0.
- **새 외부 dependency** — `@prisma/client` 의 `Group` type / `@nestjs/common` 의 `Injectable` + `NotFoundException` 만 사용. 새 패키지 0.
- **새 ADR 신설** — 본 task 는 기존 ADR-0001 (NestJS) + ADR-0002 (Prisma + PostgreSQL) 위 mechanical service-layer wrapper. 새 결정 0.
- **PartService 와 GroupService 의 `getPrismaErrorCode` helper 중복 외화** — phase 2 helper 외화 follow-up (T-0047 패턴 확장) 으로 분리. 본 task 는 service-local helper.
- **test/helpers/prisma-mock.ts 에 GroupRepository mock 추가** — 본 task 의 spec 은 local helper 사용. T-0047 phase 2 follow-up 의 scope 에 통합. 본 task 가 helper 외화 동시 수행하면 cap + scope creep 위험.
- **p3-implementation-plan.md §2 표 T-0046~T-0050 row 추가** — T-0045 패턴 재실행 doc-only direct follow-up. 본 task 는 plan 변경 0.
- **directory.md 갱신** — `src/user/group.service.ts` 추가 박제. 별도 doc-only direct follow-up (~5 LOC).
- **data-model.md 갱신** — Group entity 의 service-layer 박제는 conceptual 변경 0 (data-model.md 는 entity 차원만, service layer 미박제). 본 task 변경 0.
- **modules.md UserModule 책임 단락 갱신** — conceptual 변경 0 (UserModule 의 책임 boundary 변동 없음, 1 service 추가). 별도 doc-sync trigger 미달.
- **REQ-COVERAGE-AUDIT.md 갱신** — REQ-028 의 coverage 기존 박제 (T-0039 시점) 유지. 본 task 는 REQ 추가 0.

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (service 신규) + §B (spec 신규) + §C (UserModule wiring) 3 파일 staging. PartService 패턴 1:1 mirror — 자유도 낮음. 주석 한국어 + 책임 경계 명시 + PartService 와의 차이점 (P2002 분기 부재 / P2003 분기 부재 / PersonRepository 미주입) 명시.
- **tester**: §E 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + coverage threshold 통과 확인. spec 의 R-112 4 카테고리 cover 검산 (단 분기 없는 메서드 면제 항목 포함). regression 0 확인.
- **architect** 호출 안 함 — 새 결정 0 / 새 ADR 0 / module 책임 경계 변동 0. 기존 PartService 패턴 1:1 mirror.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]). T-0049 dogfood SUCCESS 패턴 reuse — comment-triggered rerun 자동 absorption 기대 (`gh run rerun` 0 회 목표).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **T-0051 (예상): GroupController + Group DTO + REST endpoints** — `/api/groups` 5 endpoint (POST / GET list / GET by id / DELETE) + CreateGroupDto + class-validator decorator. PartController (T-0046) 패턴 reuse. ~270 LOC / 3 파일.
- [ ] **T-0052 (예상): GroupService N:M membership operations + endpoint** — addMember / removeMember + findPersonsByGroupId + `POST /api/groups/:id/members` + `DELETE /api/groups/:id/members/:personId`. PersonGroupMembershipRepository (T-0049) 의 4 메서드 호출 source. ~200 LOC / 2-3 파일.
- [ ] **`getPrismaErrorCode` helper 외화** — PersonService / PartService / GroupService 3 service 동일 helper 중복 (3+ 회 임계). test 패턴 외화 (T-0047) 와 동일하게 src/persistence 또는 src/user/shared 로 외화 candidate. 단 production 코드 외화는 reviewer 의 module boundary 검토 필요 — doc-direct ADR + 후속 pr-mode task 분리.
- [ ] **p3-implementation-plan.md §2 표 T-0046~T-0050 row 추가** — T-0045 패턴 재실행. doc-only direct ~40 LOC. T-0050 머지 후 일괄 5 row 추가 권장.
- [ ] **directory.md `src/user/group.service.ts` 박제** — doc-only direct ~5 LOC.
- [ ] **estimate 정확도 follow-up** — T-0049 (estimate 180 → actual 368 LOC) + 본 task estimate 검산. spec 의 R-112 4 카테고리 의 자연 LOC (메서드 수 × 카테고리 4 × ~15 LOC = ~60 LOC/method) 박제로 planner estimate 정확도 회복.
- [ ] **T-0048 race fix dogfood 2 회차 검증** — T-0049 첫 dogfood SUCCESS, 본 task 가 2 회차. integrator 의 comment-triggered rerun 자동 absorption 이 지속 동작 하는지 monitoring.
- [ ] **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse, PartService HTTP-facing layer (T-0046) 의 test 확장. 별도 test-quality task (본 task scope 외).
- [ ] **GroupController smoke + e2e 확장** — T-0051 머지 후 별도 test-quality task. T-0043 / T-0044 패턴 reuse.
