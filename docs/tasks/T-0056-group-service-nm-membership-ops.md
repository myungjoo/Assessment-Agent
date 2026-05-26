---
id: T-0056
title: GroupService N:M membership ops (addMember / removeMember / findPersonsByGroupId, T-0055 Follow-up #1, pr-mode)
phase: P3
status: DONE
prNumber: 52
mergedAs: abb70a704bd31ae2232ff6b1b1a951ac11ba1df0
completedAt: 2026-05-26
reviewRounds: 1
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 240
estimatedFiles: 3
created: 2026-05-26
plannerNote: T-0055 후속 — GroupService N:M ops (addMember/removeMember/findPersonsByGroupId) service-layer 박제. controller endpoint 는 후속 T-0057 분리 (cap 보존). PartService (T-0046) `findPersonsByPartId` 패턴 + PersonGroupMembershipRepository (T-0049) 4 메서드 호출.
dependsOn: [T-0049, T-0050, T-0055]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/architecture/p3-implementation-plan.md §6 (entity 박제 progress 8/11 中 Group entity 의 N:M membership ops service-layer 미박제) + docs/tasks/T-0055 §Follow-ups L183 (선행 후보 #1 — "T-0056 (예상): GroupService N:M membership operations + 관련 controller endpoint — ~250 LOC / 3-4 파일") + driver-supplied 후보 (b) GroupService N:M ops — Service before Controller 자연 순서. src/user/group.service.ts (T-0050 박제 4 메서드 — 본 task 가 3 메서드 추가) + src/user/person-group-membership.repository.ts (T-0049 박제 4 메서드 — 본 task 의 N:M join source) + src/user/part.service.ts L105-117 (findPersonsByPartId 패턴 reference) + src/user/part.service.spec.ts (R-112 4 카테고리 + buildXxxRepositoryMock 패턴 reference). **split 결정** — service + controller 동시 박제는 ~432 LOC > 300 cap → service-layer (~240 LOC / 3 파일) 우선 + controller endpoint (~190 LOC / 2 파일) T-0057 분리. T-0050 → T-0055 패턴 mirror (Service backbone 박제 후 Controller wrap). PartController/PartService 와의 차이: PersonGroupMembershipRepository 의 중간 join entity 책임 (Person → Membership row → Group 의 indirect navigation, PartService 는 PersonRepository.findByPartId 의 direct foreign key) + addMember/removeMember 의 N:M 책임 (PartService 는 1:N 의 직접 mutation 없음). cap-close turn 10 의 planner-only safe pattern — session #14 첫 turn 즉시 execution.
---

# T-0056 — GroupService N:M membership ops (addMember / removeMember / findPersonsByGroupId)

## Why

[T-0050](T-0050-group-service-crud.md) 머지 (4ed4321, PR-45 round 1) 로 `GroupService` 의 4 CRUD 메서드 (`create` / `findAll` / `findById` / `delete`) 박제 + [T-0055](T-0055-group-controller-dto-crud.md) 머지 (a037a4e, PR-51 round 2) 로 `GroupController` 의 4 CRUD endpoint 박제. 그러나 [REQ-028](../requirements.md) 의 핵심 invariant — "한 인원은 임의 group 다중 소속 가능" — 은 N:M membership 의 add/remove/query 메서드가 박제되어야 fully operational. 본 task 는 **GroupService 의 service-layer 에 3 메서드 추가** — `addMember(groupId, personId)` / `removeMember(membershipId)` / `findPersonsByGroupId(groupId)`. PersonGroupMembershipRepository ([T-0049](T-0049-person-group-membership-repository.md), 박제 완료) 의 4 메서드 호출 + PersonRepository.findById (T-0034 박제) + GroupRepository.findById (T-0039 박제) 의 N:M join 조립.

**Out of Scope 분리 (cap 보존)** — driver-supplied 원안 (GroupService N:M ops + GroupController `:id/persons` endpoint 동시 박제) 의 estimate ~432 LOC > 300 cap → service-layer (~240 LOC / 3 파일) 본 task + controller endpoint (~190 LOC / 2 파일) 후속 T-0057 분리:

| task | scope | 예상 |
| --- | --- | --- |
| **본 T-0056** | GroupService 3 메서드 추가 (addMember / removeMember / findPersonsByGroupId) + service.spec 확장 + UserModule providers 에 PersonRepository inject 검증 | ~240 LOC / 3 파일 |
| 후속 T-0057 (예상) | GroupController 3 endpoint 추가 (`POST /:id/members` / `DELETE /:id/members/:personId` / `GET /:id/persons`) + controller.spec 확장 + (필요 시) AddMemberDto | ~190 LOC / 2-3 파일 |

분리 효과 4 항목:

1. **Service-before-Controller 자연 순서** — T-0050 → T-0055 패턴 mirror. backbone 박제 후 HTTP-facing layer wrap.
2. **reviewer noise 감소** — 본 task 는 N:M 도메인 (PersonGroupMembershipRepository 호출 정합 + invariant) 만 검토. controller layer 의 HTTP-status / DTO validation 책임은 T-0057 분리.
3. **cap 안전** — T-0046 의 PartService backbone (~245 LOC) precedent 일치. 본 task 는 service.ts +60 / service.spec.ts +180 = ~240 LOC 안전.
4. **T-0057 reference 안정** — 본 task 머지 후 GroupService 3 신규 메서드 박제됨 → T-0057 의 controller.spec 가 GroupService mock 시그니처 (8 메서드) 만 정합 검산.

**PartService 와의 차이 (Out of Scope 박제)** — PartController 가 `:id/persons` endpoint 보유 (`PartService.findPersonsByPartId`) 이나, 그 직접 source 는 `PersonRepository.findByPartId` (T-0041, Person.partId direct FK navigation). 본 task 의 `findPersonsByGroupId` 는 N:M middle table (PersonGroupMembership row) 를 거치는 indirect navigation — `PersonGroupMembershipRepository.findByGroupId(groupId)` → 결과 row 의 `personId[]` 추출 → `PersonRepository.findManyByIds(personIds)` (또는 loop findById) 의 2-stage query. PartService 패턴의 1:1 mirror 가 아님 — N:M middle table 책임의 first-of-kind 박제.

**Prisma error 분기 정책** (PartService 패턴 mirror + N:M 특수):

- **addMember**: `PersonGroupMembershipRepository.create` 가 P2002 (unique `[personId, groupId]` 위반) / P2003 (FK 위반 — personId 또는 groupId 부재) 두 분기. P2002 → `ConflictException` ("person already in group") + P2003 → `NotFoundException` ("person or group not found"). 사전 존재 검증 (`PersonRepository.findById` + `GroupRepository.findById`) 으로 P2003 분기 사전 fail-fast 가능하나 race window 존재 — repository 호출 후 catch 양 layer 박제.
- **removeMember**: `PersonGroupMembershipRepository.delete` 가 P2025 (row 부재) 1 분기. → `NotFoundException` ("membership not found").
- **findPersonsByGroupId**: Group 사전 존재 검증 (`GroupRepository.findById`) → null 시 `NotFoundException`. Group 있으나 membership row 0 → `[]` 반환 (200 + 빈 배열, 404 변환 안 함). membership row 1+ → personId[] 추출 → PersonRepository.findManyByIds (또는 loop) 호출. PartService.findPersonsByPartId 패턴 reuse + N:M middle 단계 추가.

REQ 매핑: [REQ-028](../requirements.md) (Group 정책 — 한 인원은 임의 group 다중 소속 가능. 본 task 는 N:M membership operations service-layer 박제).

## Required Reading

- [src/user/group.service.ts](../../src/user/group.service.ts) — 본 task 의 확장 대상 (T-0050 박제 4 메서드 + getPrismaErrorCode helper 보존, 3 메서드 추가). `@Injectable()` class + constructor 의 PersonGroupMembershipRepository / PersonRepository / GroupRepository inject 추가 (현재는 GroupRepository 1 종만).
- [src/user/group.service.spec.ts](../../src/user/group.service.spec.ts) — 본 task 의 spec 확장 대상. 기존 buildGroupRepositoryMock 패턴 보존 + buildPersonGroupMembershipRepositoryMock + buildPersonRepositoryMock 신설. 기존 4 메서드 test 보존 + 신규 3 메서드 test 추가.
- [src/user/person-group-membership.repository.ts](../../src/user/person-group-membership.repository.ts) — N:M middle table 의 repository (T-0049 박제). 4 메서드 (create / findByGroupId / findByPersonId / delete) — 본 task 가 `findByGroupId` + `create` + `delete` 3 메서드 호출. Prisma error code policy (P2002 / P2003 / P2025) inline 주석 참조.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — `findById` / (없으면 신설 안 함 — 본 task 는 loop findById 채택, `findManyByIds` 신설은 separate follow-up). Person 의 batch fetch 패턴 reference. 본 task 는 findById 호출만 또는 findManyByIds 신설 결정 (implementer 자유도 — A 항목 참조).
- [src/user/part.service.ts](../../src/user/part.service.ts) L105-117 (`findPersonsByPartId` 메서드) — 본 task 의 `findPersonsByGroupId` 패턴 reference (sub-resource 존재 검증 + reverse query forward). 단 본 task 는 N:M middle table 거치는 indirect navigation 으로 패턴 다름 (loop findById 또는 batch fetch 추가).
- [src/user/part.service.spec.ts](../../src/user/part.service.spec.ts) L84-119 (`buildPrismaError` helper + create() describe) — 본 task spec 의 Prisma error mock 패턴 reference. R-112 4 카테고리 (happy / error / branch / negative) 의 describe() 구조 mirror.
- [src/user/user.module.ts](../../src/user/user.module.ts) — `providers` 배열에 PersonRepository / PersonGroupMembershipRepository 이미 등록 확인 (T-0049 / T-0034 머지로 등록 완료). exports 배열의 GroupService 변경 0 (interface 추가 만). 본 task 의 변경은 0 LOC 또는 헤더 주석 1 줄 갱신만.
- [prisma/schema.prisma](../../prisma/schema.prisma) L116-133 (PersonGroupMembership model) — `@@unique([personId, groupId])` (addMember P2002 source) + `personId / groupId @relation onDelete: Cascade` (cascade 정책) + id PK + createdAt 기본값. PersonGroupMembership 의 schema 차원 invariant 확인.
- [docs/use-cases/UC-03-person-crud.md](../use-cases/UC-03-person-crud.md) §5 main-flow + §9 component/module mapping — Group N:M membership 의 use case context (Admin 이 Group 에 Person add/remove + User 가 Group 소속 Person list 조회). 본 task 의 service-layer 책임 boundary 박제 reference.
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 entity 표 + §3 N:M 관계 mermaid — PersonGroupMembership 의 join entity 위상 + cascade 정책 박제.
- [docs/tasks/T-0049-person-group-membership-repository.md](T-0049-person-group-membership-repository.md) — PersonGroupMembershipRepository 의 4 메서드 시그니처 + Prisma error code policy 박제. 본 task 의 service-layer 가 호출하는 source.
- [docs/tasks/T-0050-group-service-crud.md](T-0050-group-service-crud.md) — GroupService backbone (4 CRUD 메서드) 박제 task. 본 task 의 확장 source — 기존 4 메서드 보존 + 3 메서드 추가 + helper 보존.
- [docs/tasks/T-0055-group-controller-dto-crud.md](T-0055-group-controller-dto-crud.md) — Follow-ups #1 (본 task 의 정의 source) + GroupController CRUD-only 박제 완료. 본 task 머지 후 후속 T-0057 (예상) 가 본 task 의 3 신규 메서드를 controller endpoint 로 wrap.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — `src/` 변경) / §3.2 (R-110~R-114 — happy / error / branch / negative 4 카테고리 + coverage line ≥ 80% / function ≥ 80%) / §11 (trail blob) / §12 (한국어 본문).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — T-0048 race 인지 절차 (T-0049~T-0055 dogfood SUCCESS 10 회 검증, T-0055 round 2 cycle BROKEN 후 본 task 가 새 streak 진입). comment-triggered rerun 자동 absorption 또는 race-disabled variant 기대.

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0056-group-service-nm-membership-ops` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `src/user/group.service.ts` 갱신 (~60 LOC 추가)**:

- [ ] **constructor 확장** — `PersonGroupMembershipRepository` / `PersonRepository` 2 종 inject 추가 (현 GroupRepository 1 종 + 신규 2 종 = 3 종). `private readonly` 패턴.
- [ ] **`addMember(groupId: string, personId: string): Promise<PersonGroupMembership>`** — REQ-028 다중 group 소속의 add 책임.
  - 사전 존재 검증 — `this.findById(groupId)` (기존 메서드 reuse, null 시 NotFoundException) + `personRepository.findById(personId)` (null 시 NotFoundException "person not found: ${personId}").
  - `personGroupMembershipRepository.create({ personId, groupId })` 호출.
  - try/catch — P2002 → `ConflictException` ("person already in group: ${personId} → ${groupId}") + P2003 → `NotFoundException` ("person or group not found") + 그 외 raw forward.
- [ ] **`removeMember(membershipId: string): Promise<void>`** — N:M link 단독 제거 (Person / Group entity 자체는 보존).
  - `personGroupMembershipRepository.delete(membershipId)` 호출.
  - try/catch — P2025 → `NotFoundException` ("membership not found: ${membershipId}") + 그 외 raw forward.
- [ ] **`findPersonsByGroupId(groupId: string): Promise<Person[]>`** — 지정 Group 소속 Person 목록.
  - 사전 존재 검증 — `this.findById(groupId)` (기존 메서드 reuse, null 시 NotFoundException). Group 있으나 membership 0 → `[]` 반환 (200 + 빈 배열).
  - `personGroupMembershipRepository.findByGroupId(groupId)` 호출 → 결과 row 의 `personId[]` 추출.
  - personId 0 → `[]` 반환. personId 1+ → loop `personRepository.findById(id)` (또는 `findManyByIds` 신설 후 batch) → null 결과 (race window — membership row 있으나 Person 삭제됨) 필터링.
  - `findManyByIds` 신설 여부는 implementer 자유도 — loop findById 가 P0 acceptable, batch 가 N+1 query 회피 더 효율적. 결정 시 주석 박제 + person.repository.ts 갱신 추가 1 파일.
- [ ] **getPrismaErrorCode helper 보존** — T-0050 박제 helper 그대로 reuse, 신규 3 메서드 catch 분기에서 동일 호출. 중복 분리 외화는 별도 follow-up.
- [ ] **파일 헤더 주석 갱신** (한국어, §12) — T-0050 의 "GroupRepository CRUD-only" 책임 boundary 에 "+ N:M membership operations (T-0056) — addMember / removeMember / findPersonsByGroupId 3 메서드 추가, PersonGroupMembershipRepository + PersonRepository 2 collaborator 의존성 추가" 단락 append. PartService 와의 차이 (N:M middle table indirect navigation) 박제.
- [ ] import 경로 추가 — `@nestjs/common` 의 `ConflictException` (기존 NotFoundException 외 추가) / `@prisma/client` 의 `Person`, `PersonGroupMembership` type / `./person-group-membership.repository` 의 `PersonGroupMembershipRepository` / `./person.repository` 의 `PersonRepository`.

**B. `src/user/group.service.spec.ts` 갱신 (~180 LOC 추가, R-112 4 카테고리)**:

- [ ] **기존 4 메서드 (create / findAll / findById / delete) test 보존** — 변경 0. 신규 collaborator inject 가 기존 test 의 setup 호환성 깨지 않도록 buildPersonGroupMembershipRepositoryMock + buildPersonRepositoryMock 의 mock 인자 default 추가.
- [ ] **`buildPersonGroupMembershipRepositoryMock()` local helper** — `{ membershipRepository, membershipRepoMock: { create, findByGroupId, findByPersonId, delete } }` 4 jest.fn().
- [ ] **`buildPersonRepositoryMock()` local helper** — `{ personRepository, personRepoMock: { findById } }` (findManyByIds 신설 시 추가). PartService spec 의 동일 패턴 mirror.
- [ ] **`buildPersonFixture()` local helper** — Person fixture (7 컬럼) — PartService spec 의 동일 helper reuse.
- [ ] **`buildPersonGroupMembershipFixture()` local helper** — PersonGroupMembership fixture (id / personId / groupId / createdAt 4 컬럼).
- [ ] **`addMember()` describe (R-112 4 카테고리, ~70 LOC)**:
  - happy — Group + Person 모두 존재 + membership 신규 → repository.create 호출 + 결과 propagate.
  - error — Group 없음 → NotFoundException ("group not found") + repository.create 호출 0 검증.
  - error — Person 없음 → NotFoundException ("person not found") + repository.create 호출 0 검증.
  - error — P2002 (이미 member) → ConflictException + create 호출 1 회 검증.
  - error — P2003 (race window — Person/Group 사전 검증 후 삭제) → NotFoundException.
  - negative — unknown error code → raw propagate (변환 안 함).
  - branch — getPrismaErrorCode 의 code 없는 error → raw propagate.
- [ ] **`removeMember()` describe (R-112 4 카테고리, ~50 LOC)**:
  - happy — membership 존재 → repository.delete 호출 + void return.
  - error — P2025 → NotFoundException ("membership not found") + delete 호출 1 회 검증.
  - negative — unknown error code → raw propagate.
  - branch — code 없는 error → raw propagate.
- [ ] **`findPersonsByGroupId()` describe (R-112 4 카테고리, ~60 LOC)**:
  - happy — Group 존재 + membership 다중 → personId[] 추출 → Person 다중 반환.
  - branch — Group 존재 + membership 0 → `[]` 반환 (PersonRepository.findById 호출 0 검증).
  - branch — Group 존재 + membership 1+ 이나 일부 Person 삭제 (race window) → null 필터링.
  - error — Group 없음 → NotFoundException + membership repository 호출 0 검증.
  - negative — PersonGroupMembershipRepository.findByGroupId throw → 그대로 propagate.
- [ ] **call shape 검증** — 각 메서드의 collaborator 호출 인자가 spec fixture 와 1:1 match. validation reject 시 collaborator 호출 0 검증 (`expect(repo.X).not.toHaveBeenCalled()`).
- [ ] 각 test 마다 새 mock 생성 (호출 카운터 격리 — PartService / GroupService spec 패턴 동일).

**C. `src/user/user.module.ts` 변경 0 또는 헤더 주석 1 줄**:

- [ ] PersonRepository / PersonGroupMembershipRepository providers 이미 등록 확인 (T-0034 / T-0049 머지로 완료). 신규 inject 추가 0.
- [ ] 헤더 주석 1 줄 갱신 (선택) — "T-0056 가 GroupService 에 N:M membership operations (addMember / removeMember / findPersonsByGroupId) 3 메서드 추가 — PersonGroupMembershipRepository + PersonRepository 2 collaborator inject. controller endpoint 는 후속 T-0057 분리."

**D. R-112 5 항목 cover (CLAUDE.md §3.2)**:

- [ ] **happy-path test**: 3 신규 메서드 각각 happy 1+ test (총 3+).
- [ ] **error-path test**: addMember 4+ (Group 없음 / Person 없음 / P2002 / P2003) + removeMember 1+ (P2025) + findPersonsByGroupId 1+ (Group 없음) — 총 6+.
- [ ] **flow / 분기 cover**: addMember (사전 검증 2 분기 + Prisma error 3 분기) / removeMember (P2025 vs 그 외 2 분기) / findPersonsByGroupId (Group 없음 / membership 0 / membership 1+ / Person 부분 삭제 4 분기) — 각 분기 1+ test.
- [ ] **negative cases 충분 cover**: unknown Prisma error code raw propagate (addMember / removeMember 각 1+) + code 없는 error raw propagate (1+) + collaborator throw 그대로 propagate (1+) — 단일 negative 안 됨, 예외 처리 분기마다 cover.
- [ ] **coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, `package.json` 의 `coverageThreshold.global` 검사). 신규 3 메서드 + 신규 분기 모두 cover → 100% line/function 자연 달성 예상.

**E. 검증 명령**:

- [ ] `pnpm lint` pass (0 error).
- [ ] `pnpm build` pass (TypeScript 컴파일 — Person / PersonGroupMembership type @prisma/client 에서 generation).
- [ ] `pnpm test` pass — 신규 test 모두 green + 기존 GroupService spec 의 4 메서드 test regression 0 + 기존 spec 전체 regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` pass (regression 0 — smoke 는 docker 부재 환경에서 globalSetup DATABASE_URL fail-fast 정상, CI services.postgres sole validator).
- [ ] `pnpm test:e2e` pass (regression 0).

**F. PR / commit / push**:

- [ ] feature branch `claude/T-0056-group-service-nm-membership-ops` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `feat(user): GroupService N:M membership ops 3 메서드 (T-0056)`.
- [ ] commit body 본문 한국어 (§12) — why / 추가 항목 / 검증 요약 ~5 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added / result / coverage) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함.
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~F 체크리스트.
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupController N:M endpoint 추가 (POST /:id/members / DELETE /:id/members/:personId / GET /:id/persons)** — 본 task 의 3 service 메서드를 HTTP-facing layer 로 wrap. 후속 T-0057 (예상, ~190 LOC / 2-3 파일) 책임. AddMemberDto 신설 여부도 T-0057 결정.
- **api.md `/api/groups/:id/members` + `/api/groups/:id/persons` row 추가** — doc-only direct follow-up. T-0057 머지 후 controller endpoint 와 정합되어 일괄 박제 권장.
- **`PersonRepository.findManyByIds` batch 메서드 신설** — N+1 query 회피용. 본 task 는 loop findById 채택 (P0 acceptable) — implementer 선택 시 별도 follow-up. 신설 시 PersonRepository.ts + spec 갱신 +1 파일 + ~30 LOC.
- **`GroupService.update` + PATCH endpoint** — CRUD 의 U. 별도 후속 task.
- **AuthGuard / 권한 boundary 적용** — addMember / removeMember 는 Admin+ 권한 / findPersonsByGroupId 는 User+ 권한 boundary. 별도 auth task (P3 closure).
- **응답 envelope 표준화** — Prisma return 그대로 propagate. 별도 envelope ADR.
- **smoke / e2e 확장** — 신규 3 메서드 (또는 T-0057 머지 후 endpoint) 의 smoke / e2e cover 는 별도 test-quality task 책임 (T-0043 / T-0044 + ADR-0004 §Migration persons 패턴 mirror).
- **schema.prisma 변경 / 새 migration** — PersonGroupMembership entity / cascade 정책 / unique constraint 박제 완료 (T-0039). 본 task schema 변경 0.
- **새 외부 dependency** — `@prisma/client` / `@nestjs/common` 만 사용. 새 패키지 0.
- **새 ADR 신설** — 기존 ADR-0001 (NestJS) + ADR-0002 (Prisma + PostgreSQL) 위 mechanical N:M middle table wrapper. 새 결정 0.
- **`getPrismaErrorCode` helper 외화** — PartService + GroupService + PersonService 3 service 중복. T-0050 §Follow-ups 의 phase 2 외화 candidate. 본 task scope 외.
- **p3-implementation-plan.md §2 표 T-0050~T-0056 row 추가** — T-0045 패턴 재실행 doc-only direct follow-up. T-0057 머지 후 7 row 일괄 추가 권장.
- **directory.md 갱신** — 신규 파일 0 (group.service.ts / group.service.spec.ts 갱신만). 갱신 trigger 미달.
- **modules.md UserModule 책임 단락 갱신** — conceptual 변경 0 (GroupService 의 책임 boundary 가 N:M ops 확장이나 module 차원 변동 없음). doc-sync trigger 미달.

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (service 3 메서드 추가 + constructor 확장 + 헤더 주석) + §B (spec 확장 — 3 describe + 신규 buildXxxMock 3 helper + fixture 2 helper) + §C (UserModule 헤더 주석 1 줄 또는 변경 0) 2-3 파일 staging. PartService.findPersonsByPartId + PersonGroupMembershipRepository 의 4 메서드 시그니처 정합 검산. 주석 한국어 + 책임 경계 명시 + PartService 와의 차이 (N:M middle table indirect navigation) 박제. **decision point** — `findManyByIds` 신설 vs loop findById 의 trade-off 평가 + 결정 사유 주석 박제 (loop 가 P0 acceptable, batch 가 효율적 — 본 task 는 loop 권장 + 후속 batch follow-up).
- **tester**: §E 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + coverage threshold 통과 확인. spec 의 R-112 4 카테고리 cover 검산. regression 0 확인 — 기존 GroupService spec / PartService spec / smoke / e2e 영향 0 보장.
- **architect** 호출 안 함 — 새 결정 0 / 새 ADR 0 / module 책임 경계 변동 0. 기존 PartService 패턴 + PersonGroupMembershipRepository 시그니처 mechanical 조립.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]). T-0049~T-0054 dogfood SUCCESS 9 회 + T-0055 round 2 BROKEN 후 새 streak — 본 task 가 round 1 단발 머지 복귀 시도. comment-triggered rerun 자동 absorption 또는 race-disabled variant 기대 (`gh run rerun` 0 회 목표).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **T-0057 (예상): GroupController N:M membership endpoints** — `POST /api/groups/:id/members` + `DELETE /api/groups/:id/members/:personId` + `GET /api/groups/:id/persons` 3 endpoint + controller.spec 확장 + (필요 시) AddMemberDto. 본 task 의 3 service 메서드 wrap. ~190 LOC / 2-3 파일.
- [ ] **api.md `/api/groups/:id/members` + `/api/groups/:id/persons` row 추가** — doc-only direct ~25 LOC. T-0057 머지 후 일괄 박제.
- [ ] **PersonRepository.findManyByIds batch 메서드 신설** — N+1 query 회피. 별도 doc-only direct + spec 갱신 task. ~30 LOC.
- [ ] **GroupService N:M endpoint smoke + e2e** — T-0043 / T-0044 + ADR-0004 §Migration persons 패턴 reuse. 별도 test-quality task.
- [ ] **PartController smoke + e2e** — T-0043 / T-0044 패턴 reuse. 별도 test-quality task (Group N:M 과 병행 가능).
- [ ] **getPrismaErrorCode helper 외화** — PartService / GroupService / PersonService 3 중복 분리. 별도 refactor task (phase 2 candidate).
- [ ] **GroupService.update + UpdateGroupDto + PATCH endpoint** — CRUD 의 U. 별도 후속 task.
- [ ] **AuthGuard 적용 (addMember / removeMember = Admin+ / findPersonsByGroupId = User+)** — 별도 auth task.
- [ ] **응답 envelope 표준화 ADR** — `{ data: ..., meta: ... }` 표준 envelope. 별도 ADR + retroactive.
- [ ] **p3-implementation-plan.md §2 표 T-0050~T-0056 row 추가** — T-0057 머지 후 7 row 일괄.
- [ ] **estimate 정확도 follow-up** — 본 task estimate (240 LOC / 3 파일) 와 실 LOC 검산. PartService backbone (T-0046, ~245 LOC) precedent 비교.
- [ ] **T-0048 race fix dogfood 11 회차 검증** — T-0049~T-0054 9 회 연속 + T-0055 round 2 BROKEN → 본 task 가 round 1 streak 복귀 시도. integrator 의 comment-triggered rerun 자동 absorption 또는 race-disabled variant 지속 monitoring.
