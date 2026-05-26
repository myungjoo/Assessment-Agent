---
id: T-0041
title: PersonRepository 확장 — findByPartId / findByGroupId query 메서드 + spec (R-112 4종 + coverage)
phase: P3
status: DONE
mergedAs: 4cd302f
prNumber: 38
completedAt: 2026-05-26T10:26:33+09:00
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-05-26
plannerNote: T-0039 / T-0040 §Follow-ups 박제 — PersonRepository 에 part/group 기반 조회 추가. 후속 GroupService/PartService backbone 의 prerequisite, ~110 LOC / 2 파일 cap 보존.
dependsOn: [T-0039, T-0040]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/tasks/T-0039-group-part-entity-and-repository.md §Follow-ups L108 ("PersonRepository 확장 — findByPartId(partId) + findByGroupId(groupId) query 메서드") + docs/tasks/T-0040-data-model-group-part-membership-sync.md §Follow-ups L106 (동일 항목 재박제). 후속 GroupService / PartService backbone (Group 멤버 list / Part 소속 인원 list 의 service 호출 source) 의 repository-layer prerequisite. 본 task 는 repository + spec 2 파일 / pr-mode / ~110 LOC, cap 보존.
---

# T-0041 — PersonRepository 확장 (findByPartId / findByGroupId query)

## Why

[T-0039](T-0039-group-part-entity-and-repository.md) 가 Group / Part / PersonGroupMembership 3 entity 의 Prisma model 과 repository 를 박제했고, [T-0040](T-0040-data-model-group-part-membership-sync.md) 이 data-model.md 의 conceptual model 을 동기화했다. 다음 backbone 인 GroupService / PartService / Controller 가 진입하려면 **"이 Part 에 소속된 Person list"** 와 **"이 Group 에 소속된 Person list"** 두 query 가 PersonRepository 에 필요하다 — service-layer 가 호출할 repository primitive.

본 task 는 두 메서드를 추가한다:

- `findByPartId(partId, options?)` — Person.partId == partId 인 Person row list 반환. REQ-028 "조직도 파트 정확히 1" invariant 의 reverse query (Part 에 소속된 모든 Person 조회).
- `findByGroupId(groupId, options?)` — PersonGroupMembership 의 groupId 를 통해 Person 조회. REQ-028 "임의 group 다중 소속" semantics 의 reverse query (Group 의 모든 멤버 조회).

두 메서드는 [PersonRepository](../../src/user/person.repository.ts) 의 기존 6 메서드 (findMany / findById / create / update / softDelete / restore) 와 동일 패턴 — PrismaService 의 `person` delegate 에 1:1 forwarding + activeOnly 분기. 본 task 는 repository + spec 2 파일만 — service / controller / DTO 신설 0 (후속 backbone 책임).

[T-0039](T-0039-group-part-entity-and-repository.md) 의 schema 가 이미 본 query 의 모든 인프라 박제 — Person.partId nullable column + Person.groups (PersonGroupMembership 양방향 relation 필드). 본 task 는 새 schema 변경 0, migration 신설 0 — 순수 repository code + spec.

## Required Reading

- [src/user/person.repository.ts](../../src/user/person.repository.ts) — 본 task 가 확장할 단일 source. 6 메서드 패턴 (findMany / findById / create / update / softDelete / restore) + `PersonFindManyOptions.activeOnly` 분기 + Prisma error 정책 (P2025 / P2002 propagate) + JSDoc 주석 패턴.
- [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) — 본 task 가 확장할 spec 파일. `buildPersonFixture` / `buildPrismaMock` helper 패턴 + 6 메서드 × happy/error/branch/negative 의 test row 구조 + Prisma error code propagation 검증 패턴.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Person.partId nullable + Person.groups (PersonGroupMembership) relation 필드의 schema 검증 source. 본 task 는 schema 변경 0 — 기존 컬럼만 활용.
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 / §3 관계 2 / §3 관계 3 — Person ↔ Part / Person ↔ Group 관계의 conceptual 정합성 검산.
- [docs/requirements.md](../requirements.md) REQ-028 — Group / Part invariant 의 source.
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-112 — happy / error / branch / negative cases 충분 cover + coverage line ≥ 80% AND function ≥ 80%.
- [docs/tasks/T-0039-group-part-entity-and-repository.md](T-0039-group-part-entity-and-repository.md) §Follow-ups L108 — 본 task 의 source.

## Acceptance Criteria

본 task 는 **pr-mode code task** — feature branch `claude/T-0041-person-repository-find-by-part-and-group` → PR open → reviewer round 1 → integrator 4-게이트 → squash merge. [CLAUDE.md §3.2 R-110 ~ R-114](../../CLAUDE.md) 의 모든 test / CI 절대 규칙 적용.

**Schema / migration / module wiring**:

- [ ] `prisma/schema.prisma` 변경 0 — 본 task 는 schema 변경 없음. 기존 Person.partId / Person.groups 컬럼 / relation 만 활용.
- [ ] 신규 migration 생성 0 — `prisma/migrations/` 에 새 디렉토리 추가 안 함.
- [ ] `src/user/user.module.ts` 변경 0 — PersonRepository 가 이미 UserModule providers / exports 에 박제됨 (T-0034). 메서드 추가만으로 module wiring 영향 없음.

**Repository implementation** (`src/user/person.repository.ts`):

- [ ] `findByPartId(partId: string, options?: PersonFindManyOptions): Promise<Person[]>` 메서드 추가 — `this.prisma.person.findMany({ where: { partId, ...(activeOnly ? { active: true } : {}) } })`. activeOnly 분기는 기존 `findMany` 와 동일 default true.
- [ ] `findByGroupId(groupId: string, options?: PersonFindManyOptions): Promise<Person[]>` 메서드 추가 — PersonGroupMembership 의 join 을 통해 조회. 구현 옵션 (a 권장): `this.prisma.person.findMany({ where: { groups: { some: { groupId } }, ...(activeOnly ? { active: true } : {}) } })` — Prisma 의 nested relation filter. 구현 옵션 (b): PrismaService 의 `personGroupMembership.findMany` + Person nested include — `findByGroupId` 가 `Promise<Person[]>` 시그니처를 유지해야 하므로 옵션 (a) 가 자연. 구현자 (architect / implementer) 가 옵션 (a) vs (b) 의 trade-off 검토 후 결정 박제 + 본문 주석에 사유.
- [ ] 두 메서드 모두 row 부재 시 빈 배열 `[]` 반환 (Prisma findMany 의 native 동작). null 반환 안 함.
- [ ] 두 메서드 모두 Prisma error code (예: 존재하지 않는 partId 자체는 error 아님 — `findMany` 가 빈 배열 반환) 의 본 layer catch 없음 — 호출자 책임 (기존 6 메서드 와 동일).
- [ ] 기존 6 메서드 (findMany / findById / create / update / softDelete / restore) 의 시그니처 / 본문 / 주석 변경 0 — 본 task 는 추가만, 기존 메서드 영향 0.
- [ ] `PersonFindManyOptions` interface 의 `activeOnly?: boolean` 시그니처는 unchanged — 두 신규 메서드도 동일 옵션 type 재사용. 신규 type / interface 신설 0.
- [ ] JSDoc 주석 패턴 일관 — 기존 6 메서드 의 주석 (책임 경계 / Prisma error 정책 / REQ 참조) 와 동일 voice + 한국어 (§12 정책).

**Repository spec** (`src/user/person.repository.spec.ts`):

- [ ] 추가/수정된 모든 public symbol (findByPartId / findByGroupId) 에 대한 **happy-path test 1+ 작성** — partId / groupId 와 일치하는 Person 1 + 반환 검증.
- [ ] 각 symbol 의 **error path test 1+ 작성** — PrismaService 의 `findMany` 가 throw (e.g., DB connection error) 시 본 layer 가 catch 없이 throw 그대로 propagate.
- [ ] **branch test 1+ 작성** — activeOnly 분기 (default true 시 active=true 만 / 명시 false 시 전체) 각각 cover. 두 메서드 × 2 분기 = 최소 4 test.
- [ ] **negative cases 충분 cover** (R-112 negative 분기마다):
  - 빈 입력 — partId = "" / groupId = "" (Prisma 는 string 으로 통과, 결과 0 행 또는 invalid id format 의 native 동작 — test 가 fixture 의 PrismaService mock return 값에 의존).
  - 매칭 row 0 행 — Prisma 가 빈 배열 반환 시 본 메서드도 빈 배열 반환 검증.
  - partId 가 null 인 Person (Part 미배정) 는 `findByPartId` 의 결과에서 제외됨 — fixture 의 partId=null Person 1 + partId="part-1" Person 1 인 상황을 mock 으로 setup 후 `findByPartId("part-1")` 가 후자만 반환 검증.
  - PersonGroupMembership 0 행인 Person 은 `findByGroupId` 결과 제외 — fixture mock 으로 검증.
  - activeOnly=true (default) + active=false Person 은 결과 제외 — fixture mock 의 where 조건 검증.
- [ ] 각 test 의 PrismaService mock 호출 인자 (call shape contract) 검증 — `personMock.findMany` 가 어떤 where 객체로 호출되었는지 `expect(personMock.findMany).toHaveBeenCalledWith({ where: {...} })`.
- [ ] 기존 6 메서드 의 test (findMany / findById / create / update / softDelete / restore) 의 fixture / mock setup / expect 본문 변경 0 — 본 task 는 추가만, 기존 test 영향 0.

**Test / lint / build / CI**:

- [ ] `pnpm lint` 통과 (eslint + prettier — env CRLF skip 정책 적용).
- [ ] `pnpm build` 통과 (TypeScript compile + NestJS 의존성 graph 검증).
- [ ] `pnpm test` 통과 — 신규 test + 기존 159+ test 모두 pass. fail 0.
- [ ] `pnpm test:cov` 통과 — coverage threshold (line ≥ 80% AND function ≥ 80%). 본 task 의 변경 파일 (person.repository.ts) coverage 100% 목표 (기존 6 메서드 가 이미 100% — 추가 2 메서드도 동일 수준 유지).
- [ ] `pnpm test:smoke` 통과 — smoke test 인프라 (T-0009 박제) 의 NestJS bootstrap + DB connection placeholder 검증 unchanged.
- [ ] `pnpm test:e2e` 통과 — e2e test 인프라 (T-0010 박제) 의 HTTP endpoint smoke 검증 unchanged (controller 변경 0, 신규 endpoint 0).
- [ ] CI workflow (GitHub Actions) green — push 후 `gh run list --limit 1` conclusion=success.

**PR / reviewer / integrator**:

- [ ] feature branch `claude/T-0041-person-repository-find-by-part-and-group` 으로 작업.
- [ ] PR title / body 한국어 (§12). body 에 task 파일 링크 + 본 Acceptance Criteria 체크리스트 포함.
- [ ] reviewer round 1 APPROVE + `gh pr comment` 외부 post (4-게이트 #2).
- [ ] integrator 4-게이트 (APPROVE / comment 외부 / self-check / CI green) 모두 true 시 `gh pr merge --squash --delete-branch`.

**Commit / trail**:

- [ ] commit subject ≤ 70 char, type=feat scope=user 권장 — `feat(user): PersonRepository 에 findByPartId / findByGroupId 추가 (T-0041)`.
- [ ] commit body 의 agent-trail blob 에 ARCHITECT (필요 시 — 옵션 a vs b 결정 박제) / IMPLEMENTER (files / loc / notes) / TESTER (added / result / coverage) / ACCEPTANCE 섹션 포함.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupService + PartService + Controller + DTO + class-validator decorator** — 후속 backbone task (T-0042 후보). 본 task 는 repository primitive 만 박제, service / HTTP layer 신설 0.
- **Person.partId NOT NULL 전환 + default Part seed migration** — T-0039 §Follow-ups 의 별도 backbone task (T-0042 또는 T-0043 후보) 책임. 본 task 는 schema 변경 0.
- **`prisma/schema.prisma` 의 Person / Group / Part / PersonGroupMembership model 컬럼 추가** — T-0039 의 schema 가 final 형태. 본 task 는 schema 변경 0.
- **GroupRepository / PartRepository 의 reverse 메서드 추가** — 예: `GroupRepository.findByPersonId(personId)` 같은 reverse query. 본 task 는 PersonRepository 만 — 다른 repository 의 reverse query 는 별도 follow-up.
- **PersonGroupMembershipRepository 신설** — 본 task 는 Prisma 의 nested relation filter (`person.findMany({ where: { groups: { some: ... } } })`) 로 충분. join entity 의 별도 repository 는 (membership 의 add / remove 같은 mutation 책임이 생기는 후속 backbone) 책임.
- **api.md endpoint 행 갱신** — 본 task 는 controller / endpoint 신설 0, api.md 영향 0.
- **data-model.md 갱신** — T-0040 이 이미 PersonGroupMembership row + §3 관계 박제 완료. 본 task 는 data-model.md 변경 0.
- **p3-implementation-plan.md §2 표 task ID shift 정정** — 별도 doc-only direct task (T-0042 후보) 책임. 본 task 는 p3-implementation-plan.md 변경 0.
- **PersonRepository 의 다른 query 메서드 추가** — 예: `findByEmail(email)` / `findByServiceIdentity(service, externalId)` 같은 잠재 메서드. 본 task scope 는 part / group 2 메서드만.
- **activeOnly 외의 query option 확장** — 예: orderBy / pagination / cursor 같은 옵션. 본 task 는 기존 `PersonFindManyOptions.activeOnly?` 만 재사용, type 확장 0.

## Suggested Sub-agents

`architect → implementer → tester` (pr-mode 표준 chain).

- **architect**: 옵션 (a) Prisma nested relation filter (`{ groups: { some: { groupId } } }`) vs (b) PersonGroupMembershipRepository 경유 의 trade-off 검토 후 결정 박제 — 옵션 (a) 가 자연 (repository 시그니처 `Promise<Person[]>` 유지 + Prisma idiomatic + extra abstraction layer 0). ADR 신설 불요 — 본 결정은 person.repository.ts JSDoc 주석에 한 줄 박제 (architect 호출 자체가 옵션이며 결정이 간단할 시 implementer 단계에서 직접 결정 + 주석 박제도 허용).
- **implementer**: person.repository.ts 의 6 메서드 패턴 (forwarding + activeOnly 분기 + JSDoc 주석) 를 따라 findByPartId / findByGroupId 2 메서드 추가. spec 의 buildPersonFixture / buildPrismaMock helper 재사용.
- **tester**: 5종 grand validation (`pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e`) + coverage line/function ≥ 80% 검증.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **GroupService + PartService + Controller + DTO + class-validator decorator backbone** — Group 멤버 list endpoint (`GET /api/groups/:id/members`) / Part 소속 인원 endpoint (`GET /api/parts/:id/persons`) 가 본 task 의 findByGroupId / findByPartId 를 호출. pr-mode large backbone — 별도 task 또는 split.
- [ ] **Person.partId NOT NULL 전환 + default Part seed migration** — T-0039 schema 차원에서 nullable 유지된 invariant 의 service-layer + schema-level enforcement 동시 진입. 별도 backbone task.
- [ ] **p3-implementation-plan.md §2 표 task ID shift 정정** — T-0040 / T-0041 / T-0042 / T-0043 의 실제 진행 시퀀스 박제. doc-only direct ~50 LOC.
- [ ] **ADR-? size cap exception rationale** — T-0039 reviewer round 1 MAJOR finding (size cap 1.7× 수용 사유 + 선례 패턴 박제). 미래 backbone task 가 동일 패턴 reuse 가능. doc-only direct or new ADR.
- [ ] **GroupRepository / PartRepository 의 reverse query 메서드** — 예: GroupRepository.findByPersonId(personId), PartRepository.findByPersonId(personId). 본 task 의 대칭 — Group / Part 관점에서 person → group/part traversal 의 service-layer 필요 시 추가.
