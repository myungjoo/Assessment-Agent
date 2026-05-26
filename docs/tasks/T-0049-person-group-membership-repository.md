---
id: T-0049
title: PersonGroupMembershipRepository — Group ↔ Person N:M join repository CRUD primitive 4 종 (pr-mode)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-05-26
completedAt: 2026-05-26T14:08:00+09:00
prNumber: 44
mergedAs: dc3e056
plannerNote: P3 backbone 다음 단계 — GroupService 의 membership add/remove 책임 prerequisite. PersonGroupMembership repository (findByGroupId/findByPersonId/create/delete) + spec (R-112 4 + negative cases) + UserModule wiring. cap 보존 (~180 LOC/3 파일).
dependsOn: [T-0039, T-0041]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/architecture/p3-implementation-plan.md §6 (P3 closure — 박제 완료 5 entity 中 PersonGroupMembership 의 repository-layer 미박제, GroupService N:M membership add/remove 책임의 prerequisite) + docs/tasks/T-0048 §Follow-ups (GroupService backbone 진입 후보 — N:M PersonGroupMembership 책임 동반) + driver-supplied 후보 (c) PersonGroupMembershipRepository methods first (smaller scope ~150 LOC / 3 파일, GroupService split 의 cleanest sequence prerequisite) + prisma/schema.prisma L116-133 (PersonGroupMembership join entity 박제 완료, repository wrapper 만 부재) + src/user/group.repository.ts (4 메서드 시그니처 박제 패턴 reuse) + src/user/part.repository.spec.ts (R-112 4 카테고리 + negative cases spec 패턴 reuse). 본 task 는 PartRepository (T-0039) 패턴의 1:1 mirror — Group↔Person N:M join entity 의 4 메서드 (findByGroupId / findByPersonId / create / delete) + jest spec + UserModule wiring 의 3 파일 박제. **T-0048 race fix 후 첫 pr-mode task** — race 인지 절차 (.claude/agents/integrator.md L52-69) 의 실 검증 첫 발화. ROI: 본 task 머지 후 GroupService backbone task 가 N:M membership add/remove 책임을 repository 호출만으로 박제 가능 (cap 분리 효과).
---

# T-0049 — PersonGroupMembershipRepository (Group ↔ Person N:M join repository CRUD primitive 4 종)

## Why

[p3-implementation-plan.md §6](../architecture/p3-implementation-plan.md) P3 closure 의 "entity Prisma model 박제 progress 5/11" 중 **PersonGroupMembership** 는 schema-level 박제 (T-0039) 완료되었으나 **repository wrapper 가 부재**. 결과로 후속 backbone task (GroupService — N:M membership add/remove 책임) 가 진입할 때 service-layer 가 PrismaService 의 `personGroupMembership` delegate 를 직접 호출해야 하거나 (repository pattern 위반), 본 task 와 GroupService backbone task 를 한 commit 으로 묶어 cap 초과 (~250-280 LOC + ~150 LOC = ~400 LOC) 위험.

본 task 는 **PartRepository (T-0039, [src/user/part.repository.ts](../../src/user/part.repository.ts)) 패턴의 1:1 mirror** — PersonGroupMembership join entity 의 4 메서드 (`findByGroupId` / `findByPersonId` / `create` / `delete`) + Jest spec (R-112 4 카테고리 + negative cases 충분 cover) + UserModule wiring 의 3 파일 박제. 별도 새 외부 dependency 0 / 새 ADR 0 / schema 변경 0 / migration 0 — 기존 prisma/schema.prisma L116-133 의 `PersonGroupMembership` model 위 repository wrapper 만 박제.

분리 효과:

1. **GroupService backbone task** (별도 후속 T-NNNN) 가 본 repository 의 4 메서드 호출만으로 N:M membership add/remove 책임 박제 가능 → GroupService 자체는 entity-CRUD + N:M operations 의 분리 없이도 cap 보존.
2. **T-0048 race fix 후 첫 pr-mode task** — `.claude/agents/integrator.md` L52-69 의 race 인지 절차 (comment-triggered CI run wait) 의 실 검증 첫 발화. 본 task 머지 시 ad-hoc `gh run rerun` 없이 second run conclusion 으로 게이트 (d) PASS 평가 가능한지 monitoring 시작.
3. **cap 보존** — ~180 LOC / 3 파일 (repository ~70 LOC + spec ~95 LOC + user.module 수정 ~15 LOC). PartRepository 선례 비례 (~67 LOC repository + ~290 LOC spec) 보다 spec 이 짧음 (delete cascade enforce 분기 없음 — Prisma onDelete: Cascade 가 schema 차원 처리).

REQ 매핑: [REQ-028](../requirements.md) (Group 정책 — 한 인원은 임의 group 다중 소속 가능. N:M membership 의 repository-layer 박제가 본 REQ 의 schema↔service-layer bridge).

## Required Reading

- [prisma/schema.prisma](../../prisma/schema.prisma) L116-133 — PersonGroupMembership join entity 박제 (id / personId / groupId / createdAt + `@@unique([personId, groupId])` + cascade 정책). 본 task 의 repository 가 wrapping 할 model.
- [src/user/part.repository.ts](../../src/user/part.repository.ts) — 본 task 의 1:1 mirror 패턴 source. `@Injectable()` + constructor injection + 4 메서드 + create input interface + 주석 정책 (Prisma error code propagate / null-safe API / 책임 경계).
- [src/user/group.repository.ts](../../src/user/group.repository.ts) — 동일 패턴 reference. delete 의 cascade 정책 주석 (PersonGroupMembership row 들의 cascade 동반 삭제) 본 task 의 delete 와 대칭.
- [src/user/part.repository.spec.ts](../../src/user/part.repository.spec.ts) — 본 task 의 spec 패턴 source. R-112 4 카테고리 (happy / error / branch / negative) + Prisma error code (P2002 / P2003 / P2025) propagate 검증 + null-safe findById 검증 + buildXxxFixture + buildPrismaMock 패턴.
- [src/user/group.repository.spec.ts](../../src/user/group.repository.spec.ts) — 동일 패턴 추가 reference.
- [src/user/user.module.ts](../../src/user/user.module.ts) — 본 task 의 wiring 추가 대상. providers + exports 배열에 `PersonGroupMembershipRepository` 추가 (controller 는 본 task scope 외 — service-layer 부재).
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — `personGroupMembership` delegate 의 source. 본 task 는 PrismaService 변경 0, 기존 delegate 호출만.
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — T-0047 추출 helper. 본 task 의 spec 은 본 helper 의 `buildMockPrismaService` 를 직접 사용하지 않는다 (현 helper 는 `person` delegate 만 보유 — `personGroupMembership` 미보유). spec 안 local helper (`buildPersonGroupMembershipFixture` + `buildPrismaMock` 2 종) 박제 후, phase 2 follow-up 에서 본 helper 에 통합. 본 결정의 이유는 §Out of Scope 참조.
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §6 P3 closure progress + §2 task 시퀀스 — 본 task 의 정합성 source. T-0049 row 의 본 §2 표 추가는 별도 doc-only direct follow-up task 책임 (본 task 는 plan 변경 0).
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 row 5 (PersonGroupMembership) + §3 관계 2 — 본 task 의 entity scope source.
- [docs/architecture/modules.md](../architecture/modules.md) UserModule 단락 — 본 task 의 책임 module 정합성 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — `src/` 변경) / §3.2 (R-110~R-114) / §11 (trail blob) / §12 (한국어 본문).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — T-0048 race 인지 절차 (본 task 머지 시 검증 첫 발화 — integrator 가 본 절차로 게이트 (d) 평가 시도).

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0049-person-group-membership-repository` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `src/user/person-group-membership.repository.ts` 신규 (~70 LOC)**:

- [ ] `PersonGroupMembershipRepository` class `@Injectable()` + constructor 에서 `PrismaService` private readonly 주입.
- [ ] `PersonGroupMembershipCreateInput` interface export — { personId: string; groupId: string } 2 필드 (createdAt 은 schema default 가 cover).
- [ ] `create(input: PersonGroupMembershipCreateInput): Promise<PersonGroupMembership>` — `prisma.personGroupMembership.create({ data: input })` 1:1 forward. unique (`[personId, groupId]`) 위반 시 Prisma `P2002` 그대로 propagate (catch 0).
- [ ] `findByGroupId(groupId: string): Promise<PersonGroupMembership[]>` — `prisma.personGroupMembership.findMany({ where: { groupId } })` 1:1 forward. row 0+ 빈 배열 반환 (null 아님).
- [ ] `findByPersonId(personId: string): Promise<PersonGroupMembership[]>` — `prisma.personGroupMembership.findMany({ where: { personId } })` 1:1 forward. 동일 동작.
- [ ] `delete(id: string): Promise<PersonGroupMembership>` — `prisma.personGroupMembership.delete({ where: { id } })` 1:1 forward. id 부재 시 `P2025` propagate.
- [ ] 파일 헤더 주석 — PartRepository 패턴 mirror: 책임 경계 / Prisma error 정책 (P2002 unique / P2025 not-found) / REQ-028 의 schema 차원 / cascade 정책 (Person 또는 Group 삭제 시 본 row 동반 삭제 — schema `onDelete: Cascade` 가 처리, 본 layer 가공 0).
- [ ] import 경로: `@nestjs/common` 의 `Injectable` / `@prisma/client` 의 `PersonGroupMembership` type / `../persistence/prisma.service` 의 `PrismaService`.

**B. `src/user/person-group-membership.repository.spec.ts` 신규 (~95 LOC, R-112 4 카테고리)**:

- [ ] `buildPersonGroupMembershipFixture(overrides: Partial<PersonGroupMembership> = {}): PersonGroupMembership` local helper — id / personId / groupId / createdAt 4 필드 default 채움. (Phase 2 follow-up: test/helpers/prisma-mock.ts 통합).
- [ ] `buildPrismaMock(): { prisma: PrismaService; membershipMock: { findMany, create, delete } }` local helper — `personGroupMembership` delegate 만 3 jest.fn() 보유 (findByGroupId/findByPersonId 둘 다 findMany 사용).
- [ ] **happy path 4 종**: create() 가 input 을 data 로 전달 + return 값 propagate / findByGroupId() 가 where.groupId 로 호출 + 배열 propagate / findByPersonId() 가 where.personId 로 호출 + 배열 propagate / delete() 가 where.id 로 호출 + return 값 propagate.
- [ ] **error path 3 종**: create() 의 P2002 (unique 위반 — 동일 personId/groupId 쌍 재삽입) propagate / delete() 의 P2025 (row 부재) propagate / findByGroupId() 의 PrismaService throw (예: connection error) propagate.
- [ ] **branch / negative cases**: findByGroupId() 가 row 0 일 때 빈 배열 (null 아님) 반환 / findByPersonId() 가 row 0 일 때 빈 배열 / findByGroupId() / findByPersonId() 가 동일 groupId 또는 personId 의 row 1+ 시 그대로 propagate (다중 row 길이 검증) / create() 가 personId 또는 groupId 가 부재한 reference 일 때 Prisma `P2003` (FK 위반) propagate.
- [ ] **call shape 검증**: 각 메서드의 Prisma delegate 호출 인자가 spec 의 fixture 와 1:1 match (`expect(membershipMock.create).toHaveBeenCalledWith({ data: { personId, groupId } })` 패턴).
- [ ] 각 test 마다 새 mock 생성 (호출 카운터 격리 — PartRepository 패턴 동일).
- [ ] 주석은 R-112 카테고리 (happy / error / branch / negative) 별 `describe()` 또는 inline 주석으로 구분 — reviewer 가 카테고리 cover 확인 용이.

**C. `src/user/user.module.ts` 갱신 (~15 LOC)**:

- [ ] `import { PersonGroupMembershipRepository } from "./person-group-membership.repository";` 추가.
- [ ] `providers` 배열에 `PersonGroupMembershipRepository` 추가.
- [ ] `exports` 배열에 `PersonGroupMembershipRepository` 추가 (후속 GroupService 가 inject 가능).
- [ ] 파일 헤더 주석 한 줄 추가 — "T-0049 가 PersonGroupMembershipRepository 를 추가 wiring. GroupService 의 N:M membership add/remove 책임의 repository-layer prerequisite."
- [ ] `controllers` 배열 변경 0 — 본 task 는 service-layer / controller 부재.

**D. R-112 5 항목 cover (CLAUDE.md §3.2)**:

- [ ] **happy-path test**: 4 메서드 (create / findByGroupId / findByPersonId / delete) 각각 happy path 1+ test (총 4+).
- [ ] **error-path test**: 3+ error case (create P2002 / delete P2025 / find PrismaService throw).
- [ ] **branch / negative cases 충분 cover**: 분기 cover (findByGroupId/findByPersonId 가 row 0 vs row 1+ 의 2 분기 각각) + negative (FK 위반 P2003, 다중 row 길이 검증). 각 분기 1+.
- [ ] **coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, `package.json` 의 `coverageThreshold.global` 검사). 본 task 의 신규 production 파일 (repository) 은 1:1 forward 4 메서드 → 100% line/function 자연 달성 예상.

**E. 검증 명령**:

- [ ] `pnpm lint` pass.
- [ ] `pnpm build` pass (TypeScript 컴파일 — PersonGroupMembership type @prisma/client 에서 generation 됨).
- [ ] `pnpm test` pass — 신규 spec 모두 green + 기존 test regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold 통과.
- [ ] `pnpm test:smoke` pass (regression 0).
- [ ] `pnpm test:e2e` pass (regression 0).

**F. PR / commit / push**:

- [ ] feature branch `claude/T-0049-person-group-membership-repository` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `feat(user): PersonGroupMembershipRepository 4 메서드 + R-112 spec (T-0049)`.
- [ ] commit body 본문 한국어 (§12) — why / 추가 항목 / 검증 요약 ~5 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added / result / coverage) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함.
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~F 체크리스트.
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupService + GroupController + Group DTO backbone** — Part 와 대칭 구조의 Group service-layer + HTTP-facing layer. N:M membership add/remove 책임 동반 (본 task 의 repository 호출). 별도 backbone task 책임 (본 task 머지 후 진입 후보, ~250-280 LOC 단일 task 또는 GroupService-CRUD + N:M-operations 2 task split).
- **PersonGroupMembership 의 service-layer** — Person↔Group membership add / remove operations 의 service. invariant (중복 membership 차단 / Person 또는 Group 부재 시 에러 등) 의 service-layer 강제. 별도 task (보통 GroupService backbone 의 일부).
- **PersonGroupMembership controller / DTO / HTTP endpoint** — `/api/persons/:id/groups` 또는 `/api/groups/:id/members` 등. 별도 task (GroupService backbone 또는 PersonGroupMembership 전용 controller).
- **test/helpers/prisma-mock.ts 에 `personGroupMembership` delegate 통합** — 본 task 의 spec 은 local helper 사용. T-0047 phase 2 follow-up (src/user/*.spec.ts 5 spec migration + fixture variant 결정 동반) 의 scope 에 통합. 본 task 가 helper 외화를 동시 수행하면 cap + scope creep 위험.
- **phase 2 src/user/*.spec.ts 5 spec migration** — T-0047 §Follow-ups. 본 task 와 독립 (별도 task).
- **schema.prisma 변경 / 새 migration** — PersonGroupMembership entity 박제 (T-0039) 완료. 본 task 는 schema 변경 0.
- **새 외부 dependency** — `@prisma/client` 의 `PersonGroupMembership` type 사용. 새 패키지 0.
- **새 ADR 신설** — 본 task 는 기존 ADR-0002 (Prisma + PostgreSQL) + ADR-0001 (NestJS) 위 mechanical wrapper. 새 결정 0.
- **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse, PartService HTTP-facing layer (T-0046) 의 test 확장. 별도 test-quality task.
- **p3-implementation-plan.md §2 표 T-0046~T-0049 row 추가** — T-0045 패턴 재실행 doc-only direct follow-up. 본 task 는 plan 변경 0.
- **directory.md 갱신** — `src/user/person-group-membership.repository.ts` 추가 박제. 별도 doc-only direct follow-up (~5 LOC).
- **data-model.md PersonGroupMembership 추가 박제** — T-0040 가 이미 처리 완료. 본 task 변경 0.
- **modules.md UserModule 책임 단락 갱신** — conceptual 변경 0 (UserModule 의 책임 boundary 자체는 변동 없음, 1 repository 추가). 별도 doc-sync 의 trigger 미달.
- **REQ-COVERAGE-AUDIT.md 갱신** — REQ-028 의 coverage 기존 박제 (T-0039 시점) 유지. 본 task 는 REQ 추가 0.

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (repository 신규) + §B (spec 신규) + §C (UserModule wiring) 3 파일 staging. PartRepository 패턴 1:1 mirror — 자유도 낮음. 주석 한국어 + 책임 경계 명시 + Prisma error 정책 박제 (PartRepository 헤더 패턴 reuse).
- **tester**: §E 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + coverage threshold 통과 확인. spec 의 R-112 4 카테고리 cover 검산. regression 0 확인.
- **architect** 호출 안 함 — 새 결정 0 / 새 ADR 0 / module 책임 경계 변동 0. 기존 PartRepository 패턴 1:1 mirror.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **GroupService + GroupController + Group DTO backbone** — 본 task 머지 후 자연 다음 단계. PersonGroupMembershipRepository 의 4 메서드 호출만으로 N:M membership add/remove 책임 박제 가능. cap ~250-280 LOC 단일 task 또는 2 task split (GroupService-CRUD + N:M-operations) 결정은 다음 planner 가.
- [ ] **test/helpers/prisma-mock.ts 에 `personGroupMembership` delegate 통합** — T-0047 phase 2 follow-up 의 scope 에 본 task 의 local helper migration 동반. 5 → 6 spec migration 으로 expansion.
- [ ] **p3-implementation-plan.md §2 표 T-0046~T-0049 row 추가** — T-0045 패턴 재실행. doc-only direct ~30 LOC.
- [ ] **directory.md `src/user/person-group-membership.repository.ts` 박제** — doc-only direct ~5 LOC.
- [ ] **PersonGroupMembership controller (HTTP endpoint) 박제** — `/api/persons/:id/groups` 또는 `/api/groups/:id/members` 의 list / add / remove. 별도 task — GroupService backbone 의 일부 또는 별도 PersonGroupMembership 전용 controller.
- [ ] **T-0048 race fix 검증 결과 박제** — 본 task 가 T-0048 머지 후 첫 pr-mode task — integrator 의 race 인지 절차 (comment-triggered CI run wait) 가 실 동작 했는지 모니터링 결과를 journal 에 박제. ad-hoc `gh run rerun` 0 회로 게이트 (d) PASS 시 절차 효과 검증 완료.
- [ ] **PartController smoke + e2e 확장** — T-0043 / T-0044 패턴 reuse. 별도 test-quality task (본 task scope 외).
