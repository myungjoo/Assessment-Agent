---
id: T-0039
title: Group + Part entity Prisma model + GroupRepository + PartRepository + UserModule wiring (Service/Controller 는 후속 task 책임)
phase: P3
status: IN_PROGRESS
prNumber: 37
mergedAs: pending
commitMode: pr
coversReq: [REQ-028]
estimatedDiff: 280
estimatedFiles: 5
created: 2026-05-26
plannerNote: P3 plan §2 의 "Group + Part entity backbone" row (cron #7 T-0038 갱신 후 ID shift 의 다음 자리) 의 entity+repository 부분만 cap 보존 우선 split.
dependsOn: [T-0037]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/architecture/p3-implementation-plan.md §2 표 row "Group + Part entity Prisma model 추가 + Person↔Group N:M (join entity) + Person↔Part N:1 (mandatory) invariant 강제 + GroupService / PartService (UserModule 내부)" — 본 task 는 entity + repository + UserModule wiring scope 만, GroupService/PartService 는 후속 T-0040 책임 (cap 보존).
---

# T-0039 — Group + Part entity Prisma model + GroupRepository + PartRepository + UserModule wiring

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 의 L54 bullet ("**Group 정책** — 한 인원은 임의 group 다중 소속 가능, 단 조직도 파트는 정확히 1개 (R-51)") 와 [docs/architecture/data-model.md](../architecture/data-model.md) §2 entity row 3·4 (Group / Part) + §3 관계 2·3 (Person ↔ Group N:M / Person ↔ Part N:1 mandatory) 의 schema-level 박제. [REQ-028](../requirements.md) 가 source.

[docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 표 row "Group + Part" (cron #7 T-0038 갱신에서 task ID = T-0038 으로 박제되었으나 실제 T-0038 이 doc-only direct task 로 사용되어 backbone 책임은 다음 ID 로 자연 shift) 의 책임을 본 task 가 채택한다. 단 cap 보존을 위해 **GroupService / PartService / Controller / DTO 는 후속 T-0040 책임** 으로 분리 — 본 task 는 entity Prisma model + repository CRUD primitive + UserModule provider wiring 까지.

## Required Reading

- [docs/architecture/data-model.md](../architecture/data-model.md) §2 entity row 3 (Group) · row 4 (Part) + §3 관계 2 (Person↔Group N:M) · 관계 3 (Person↔Part N:1 mandatory)
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 표 의 "Group + Part" 책임 row + §7 Out of scope
- [prisma/schema.prisma](../../prisma/schema.prisma) — 현재 Person / ServiceIdentity 2 entity. 본 task 가 Group / Part / PersonGroupMembership join entity + Person 의 part / groups relation 필드를 추가.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — 본 task 의 GroupRepository / PartRepository 가 따를 repository pattern (PrismaService 얇은 wrapping + spec mock 패턴) reference.
- [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) — 본 task 의 spec 들이 따를 jest mock 패턴.
- [src/user/user.module.ts](../../src/user/user.module.ts) — providers / exports 에 GroupRepository · PartRepository 추가 대상.
- [docs/requirements.md](../requirements.md) REQ-028 — Group 정책 1 인 N Group / 정확히 1 Part invariant 의 source.

## Acceptance Criteria

**Schema / migration**:

- [ ] `prisma/schema.prisma` 에 **Group** model 추가 (id cuid / name String / createdAt / updatedAt).
- [ ] `prisma/schema.prisma` 에 **Part** model 추가 (id cuid / name String unique / createdAt / updatedAt).
- [ ] `prisma/schema.prisma` 에 **PersonGroupMembership** join model 추가 (id cuid / personId / groupId / createdAt; `@@unique([personId, groupId])`).
- [ ] Person model 에 `partId String?` (nullable — mandatory invariant 의 service-layer 강제는 후속 T-0040 책임; 본 task 는 schema 차원에서 nullable 유지 + Follow-up 명시) + `part Part? @relation(fields: [partId], references: [id])` + `groups PersonGroupMembership[]` 추가.
- [ ] Part / Group model 에 reverse relation 필드 추가 (Part 의 `persons Person[]`, Group 의 `memberships PersonGroupMembership[]`).
- [ ] `prisma migrate dev --name group_part` 로 새 migration 디렉토리 생성 (예: `prisma/migrations/20260526000000_group_part/migration.sql`). migration SQL 이 자동 생성된 그대로 commit. 수동 편집 금지.
- [ ] `pnpm prisma format` 후 schema.prisma 가 formatter 출력과 동일.

**Repository (TypeScript)**:

- [ ] `src/user/group.repository.ts` 생성. **GroupRepository** class 가 `@Injectable()` 데코레이터 + PrismaService 생성자 주입. 메서드 4 종 노출:
  - `create(input: { name: string }): Promise<Group>`
  - `findById(id: string): Promise<Group | null>` — 부재 시 null
  - `findMany(): Promise<Group[]>`
  - `delete(id: string): Promise<Group>` — 부재 시 Prisma `P2025` propagate
- [ ] `src/user/part.repository.ts` 생성. **PartRepository** class 가 `@Injectable()` 데코레이터 + PrismaService 생성자 주입. 메서드 4 종 노출:
  - `create(input: { name: string }): Promise<Part>`
  - `findById(id: string): Promise<Part | null>` — 부재 시 null
  - `findMany(): Promise<Part[]>`
  - `delete(id: string): Promise<Part>` — 부재 시 Prisma `P2025` propagate; 소속 Person 1+ 일 때 FK constraint 위반 (Prisma `P2003`) propagate (REQ-028 invariant 의 schema-level enforce).
- [ ] 본 repository 들은 PersonRepository 와 동일 pattern — PrismaService 의 `group` / `part` delegate 에 1:1 forwarding 만. 도메인 invariant (정확히 1 Part 강제 등) 는 후속 service layer 책임 명시 (주석).
- [ ] `src/user/user.module.ts` 의 `providers` 와 `exports` 에 `GroupRepository` + `PartRepository` 추가.

**Unit test (R-110 ~ R-114 적용)**:

- [ ] `src/user/group.repository.spec.ts` 작성 — happy-path 1+ test 각 메서드 (create / findById / findMany / delete 의 happy case 4+). PrismaService 의 `group` delegate 를 jest mock 으로 대체.
- [ ] `src/user/group.repository.spec.ts` 의 error path 1+ test 각 메서드 — findById row 부재 (null 반환), delete row 부재 (`P2025` propagate), create 호출 시 PrismaService.group 이 throw 하면 그대로 propagate.
- [ ] `src/user/group.repository.spec.ts` 의 negative cases 충분 cover — 빈 name (PrismaService delegate 가 그대로 받음 — validation 은 service-layer 책임 명시; 본 layer 는 forwarding 만 검증), null id 입력 시 PrismaService 가 받는 인자 그대로 검증, findMany 가 빈 배열 반환 시 정상 동작.
- [ ] 분기 cover — repository 자체에 분기 없음 (1:1 forwarding) → "분기 없음 — 이 항목 생략" 본문 명시 가능. 단 jest mock 의 throw vs return 분기는 error path test 가 cover.
- [ ] `src/user/part.repository.spec.ts` 작성 — 동일 패턴 (happy 4+ / error 4+ / negative 충분). 추가로 **delete row 부재 시 P2025 + delete 시 FK 위반 P2003 propagate** 2 종 error path 박제.
- [ ] `src/user/user.module.spec.ts` (기존 파일) 갱신 — GroupRepository + PartRepository 가 providers 에 등록되었는지 expect, exports 에서 inject 가능 한지 1+ test 추가.
- [ ] `pnpm test:cov` 통과 — **line ≥ 80% AND function ≥ 80%** ([package.json](../../package.json) coverageThreshold global). 본 task 가 추가하는 코드는 100% cover 가능 (1:1 forwarding repository).
- [ ] `pnpm lint` 통과 (ESLint).
- [ ] `pnpm build` 통과 (TypeScript compile + Prisma client generate). `pnpm prisma generate` 가 새 Group / Part / PersonGroupMembership type 을 `@prisma/client` 에 생성.
- [ ] `pnpm test:smoke` 통과 (기존 smoke 미회귀).
- [ ] `pnpm test:e2e` 통과 (기존 e2e 미회귀).

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **GroupService / PartService 도메인 layer 구현** — Person↔Group multi-membership 추가/제거 API · Part 변경 API · 정확히 1 Part invariant 의 service-layer 강제 (Person 생성 시 part 필수 / Person.part 변경 시 이전 Part 의 reverse relation 정합성) → 후속 **T-0040** 책임.
- **GroupController / PartController + DTO + class-validator decorator** — REST endpoint 노출 → 후속 **T-0040** 또는 그 다음 task 책임.
- **Person.partId 의 NOT NULL invariant schema 강제** — 본 task 는 nullable 유지. mandatory 1 Part invariant 의 schema 차원 강제는 (a) 기존 Person row 의 default Part seed migration + (b) `partId String NOT NULL` 전환 의 2 단계 필요 — 별도 task 분리.
- **Part 의 default seed (예: "Unassigned" Part 1 row)** — 본 task scope 외. T-0040 책임.
- **PersonRepository 의 part / groups 통합 메서드** — `findByPartId` / `findByGroupId` 등 query 확장 → 후속 task.
- **api.md / data-model.md / modules.md 갱신** — entity 추가에 따른 doc artifact 갱신은 본 task 가 schema 만 박제 후 별도 doc task 로 분리 (architect 가 후속 호출에서 living document 갱신 권장).
- **p3-implementation-plan §2 표의 Group+Part row 재정렬** (task ID 가 T-0038 으로 박제되어 있으나 실제 T-0039 로 진입 — Follow-up 으로 분리).
- **REQ-028 의 abusing 방지 / Part 의 부서 hierarchy** 등 (R-51 외) 의 확장 invariant — P3 scope 외.

## Suggested Sub-agents

`architect → implementer → tester` (pr-mode 표준 chain). architect 는 Prisma model 박제 결정 (join entity 이름 / cascade 정책 / unique constraint) + Follow-up 박제. implementer 는 schema + repository + spec + module wiring. tester 는 `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 5 종 grand validation + coverage line/function ≥ 80% 검증.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지/제거):

- [ ] p3-implementation-plan §2 표 갱신 — "Group + Part" row 의 task ID 를 T-0038 (cron #7 박제) → T-0039 (본 task 실제 ID) 로 정정 + 후속 row (User+AuthModule / Assessment / LlmProviderConfig / PermissionDeniedRecord / Cross-cutting) 의 ID shift 박제. doc-only direct task 로 분리.
- [ ] T-0040 (또는 다음 backbone) — GroupService + PartService + Controller + DTO + class-validator decorator + Person.partId NOT NULL 전환 + default Part seed.
- [ ] PersonRepository 확장 — `findByPartId(partId)` + `findByGroupId(groupId)` query 메서드.
- [ ] data-model.md / api.md / modules.md living document 갱신 — Group / Part / PersonGroupMembership entity 의 컬럼 박제 + Person↔Part / Person↔Group endpoint 추가.

## Blocker (Resolved 2026-05-26T09:20:22+09:00)

**Status**: RESOLVED — HQ-0006 사용자 결정 `install-gh-cli` (session #9 turn 1, KST 09:20). 직전 BLOCKED 전제 ('gh CLI 부재') 가 stale 로 판명: 본 환경에 gh v2.88.1 + auth login=myungjoo + scopes [gist, read:org, repo] 가 이미 설치되어 있다. 추가 설치 action 불요.

**현황 (변경 없음)**:

- 코드 작업 완료 — feature branch `claude/T-0039-group-part-entity-and-repository` 의 commit **612a02b** 가 push 되고 [PR-37](https://github.com/myungjoo/Assessment-Agent/pull/37) open. base=main / head=claude/T-0039-group-part-entity-and-repository. `gh pr view 37` 으로 state=OPEN / mergeable=MERGEABLE 재확인 (2026-05-26T09:20 KST).
- executor sub-agent 안에서 5종 grand validation 통과 — `pnpm lint` + `pnpm build` + `pnpm test:cov` (line/function 100% / threshold global 80% 통과) + `pnpm test:smoke` + `pnpm test:e2e` (총 159 tests pass).
- **size cap 위반** — 11 파일 / +867 / -28 LOC (cap: ≤5 파일 / ≤300 LOC). reviewer 의 size check 판단 대상 (README 117–128 §size) — T-0035 (1 entity = 510 LOC / 5 파일 MERGED) 선례의 3 entity 비례 정당화 시도가 본 round 에서 reviewer judgment 의 핵심.

**Resume 경로** (다음 turn = session #9 turn 2):

- LOOP.md §1 [2] resume 분기 적용: currentTask=T-0039 / commitMode=pr / prNumber=37 → `gh pr view 37 --json state,mergedAt,reviews,comments,headRefOid,mergeable` 으로 PR 현 상태 fetch → state=OPEN + head sha 변화 없음 + reviewer comment 0 → §1 [3] EXECUTOR 호출 (reviewer dispatch round 1).
- reviewer 가 PR diff 8-check 진행 후 `gh pr comment 37` 으로 verdict 외부 post (4-게이트 #2 자동 충족) → integrator 가 `gh pr checks 37` (게이트 #4) + 자체 점검 (게이트 #3) → APPROVE 종합 시 `gh pr merge 37 --squash --delete-branch` → merge commit SHA 를 STATE.lastCommit / task.mergedAs 박제.

**관련 commit**:

- feature branch tip: `612a02b` (push 완료).
- PR-37 open via GitHub MCP — base main / head claude/T-0039-group-part-entity-and-repository.
