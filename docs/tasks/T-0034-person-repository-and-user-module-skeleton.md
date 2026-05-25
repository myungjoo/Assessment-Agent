---
id: T-0034
title: P3 — Person Repository + UserModule skeleton + Prisma migration init
phase: P3
status: DONE
completedAt: 2026-05-25T20:30:00+09:00
mergeCommit: 087b322
prNumber: 33
ciRunUrl: https://github.com/myungjoo/Assessment-Agent/actions/runs/26400363781
reviewRounds: 1
commitMode: pr
coversReq: [REQ-023, REQ-026]
estimatedDiff: 240
estimatedFiles: 5
created: 2026-05-25
plannerNote: P3 둘째 task. p3-implementation-plan.md §2 row 2 의 split — T-0034 cap discipline (≤300 LOC / ≤5 파일) 준수 위해 Person CRUD 전체 범위 (entity + repo + service + controller + DTO) 중 **repository + UserModule skeleton + 첫 migration** 까지만. ServiceIdentity / PersonService / PersonController 는 후속 T-0035 / T-0036 책임.
dependsOn: [T-0033]
blocks: [T-0035, T-0036, T-0037]
hqOrigin: null
humanApprovalGate: false
---

# T-0034 — P3 둘째 task: Person Repository + UserModule skeleton + Prisma migration init

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 단락 (L51 — "평가 대상 인원 관리 (CRUD, group, deactivate/activate)") + [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 row 2 (T-0034 Person + ServiceIdentity entity + UserModule) 의 **cap discipline split** 첫 슬라이스. 직전 T-0033 머지 ([c7cb9b0](https://github.com/myungjoo/Assessment-Agent/commit/c7cb9b0)) 로 `prisma/schema.prisma` 에 Person 1 entity skeleton 이 이미 박제됨 — 본 task 는 그 위에 **첫 migration** (DB table 실제 생성) + **PersonRepository** (PrismaService wrapping CRUD primitives) + **UserModule skeleton** (`@Module` + provider 등록) 까지만 진행한다.

본 task 의 split 의도 (p3-implementation-plan.md §2 footnote "T-0034 임계 task — split 의무 평가" 명시 대상):

- **DO (본 task)**: PostgreSQL 첫 migration 생성 + PersonRepository (Prisma client wrapping; CRUD 메서드 — `findMany` / `findById` / `create` / `update` / `softDelete` (active=false) / `restore` (active=true)) + UserModule skeleton (`@Module` providers/exports + AppModule.imports 추가) + repository unit test (happy/error/branch/negative + coverage line/function ≥ 80%).
- **DO NOT (후속 task 책임)**: ServiceIdentity entity Prisma model 추가 → T-0035. Primary key 역할 ID (`isPrimary` invariant) → T-0035. Group / Part entity → T-0036. PersonService (도메인 로직 — group/part invariant 검증 / soft delete cascade 등) → T-0036. PersonController + REST endpoint + DTO + class-validator → T-0036. User (로그인 계정) entity / AuthModule → T-0037 (당초 plan §2 의 T-0036 책임을 split 으로 한 자리 뒤로 미룸).

본 split 결정의 정당성: plan §2 의 T-0034 추정 ~290 LOC × 7+ 파일은 [CLAUDE.md §3](../../CLAUDE.md) cap (≤300 LOC / ≤5 파일) 의 변경 파일 수 cap 을 위반. plan §2 footnote 가 사전 허용한 "PersonModule + ServiceIdentityModule 별도" split 패턴을 적용. 본 task 머지 후 후속 planner 호출이 T-0035 (ServiceIdentity + Person 관계) / T-0036 (PersonService + Controller + DTO) / T-0037 (Group + Part) / T-0038 (User + Auth) 순으로 진행 — plan §2 의 task ID 가 한 자리씩 뒤로 밀림. p3-implementation-plan.md 의 §2 표 자체 갱신은 별도 doc-only follow-up task (본 task scope 외 — cap discipline).

산출물: (1) `prisma/migrations/<timestamp>_init/migration.sql` (Prisma CLI 자동 생성, Person table 만), (2) `prisma/migrations/migration_lock.toml` (provider lock), (3) `src/user/user.module.ts` (`@Module({ providers: [PersonRepository], exports: [PersonRepository] })`), (4) `src/user/person.repository.ts` (PrismaService 주입 + 6 CRUD 메서드), (5) `src/user/person.repository.spec.ts` (Jest unit test — happy/error/branch/negative + coverage line/function ≥ 80%), (6) `src/app.module.ts` 의 `imports` 에 `UserModule` 한 줄 추가.

cap 검산: 5–6 파일 (migration 2 파일 한 묶음 + 3 신규 src 파일 + 1 줄 app.module.ts 수정 = **5 파일 cap 안**). LOC ≈ 240. 추정 검증은 architect 가 첫 read 직후 재검산 + 필요 시 더 작게 split (예: migration 만 + repository 만 으로 분할). 추정 초과 시 planner 재호출.

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 (L51) — "평가 대상 인원 관리" bullet
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) §2 row 2 + footnote "T-0034 임계 task — split 의무 평가"
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 row 1 Person entity (책임 module UserModule)
- [docs/architecture/modules.md](../architecture/modules.md) UserModule 항목 (책임 + 의존성)
- [docs/architecture/directory.md](../architecture/directory.md) `src/user/` 위치 + module sub-structure 표준
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) PostgreSQL + Prisma + adapter-pg 결정
- [prisma/schema.prisma](../../prisma/schema.prisma) 현재 Person model skeleton (T-0033 산출)
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) PrismaService 시그니처 (주입 source)
- [src/persistence/persistence.module.ts](../../src/persistence/persistence.module.ts) `@Global()` export — UserModule 이 별도 import 불필요한지 확인
- [src/app.module.ts](../../src/app.module.ts) imports 배열 (UserModule 추가 위치)
- [package.json](../../package.json) `scripts.postinstall` / Prisma CLI 명령 확인
- [docker-compose.yml](../../docker-compose.yml) PostgreSQL container — `pnpm prisma migrate dev` 가 본 container 의 DATABASE_URL 로 접속 가능한지 확인
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr) / §3.2 (R-110~R-114 test coverage)

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) (R-110~R-114) 강제 항목 포함.

### A. Migration 생성

- [ ] `pnpm prisma migrate dev --name init` 실행하여 `prisma/migrations/<timestamp>_init/migration.sql` 생성 (Person table 만 — id PK / fullName / email UNIQUE / active default true / createdAt / updatedAt). schema.prisma 와 정합.
- [ ] `prisma/migrations/migration_lock.toml` 생성 — `provider = "postgresql"` 박제.
- [ ] 본 migration SQL 은 Prisma CLI 자동 생성물 — 수동 편집 안 함. SQL inspect 시 `CREATE TABLE "Person"` + `CREATE UNIQUE INDEX "Person_email_key"` 가 존재.

### B. UserModule + PersonRepository 코드

- [ ] `src/user/user.module.ts` 신규 — `@Module({ providers: [PersonRepository], exports: [PersonRepository] })`. PersistenceModule 은 `@Global()` 이므로 별도 import 불필요 (확인).
- [ ] `src/user/person.repository.ts` 신규 — `@Injectable()` class 가 PrismaService 를 생성자 주입받고 다음 6 메서드 공개:
  - `findMany(options?: { activeOnly?: boolean }): Promise<Person[]>` — default activeOnly=true (휴직자 숨김 invariant REQ-026).
  - `findById(id: string): Promise<Person | null>` — id 존재 안 함 시 null 반환 (throw 안 함).
  - `create(input: { fullName: string; email: string }): Promise<Person>` — active 는 default true.
  - `update(id: string, patch: Partial<{ fullName: string; email: string }>): Promise<Person>` — id 부재 시 Prisma `P2025` error 그대로 throw.
  - `softDelete(id: string): Promise<Person>` — active=false 로 설정 (REQ-026 휴직/비활성). hard delete 아님.
  - `restore(id: string): Promise<Person>` — active=true 로 복원.
- [ ] `src/app.module.ts` 의 `imports: [...]` 배열에 `UserModule` 한 줄 추가.

### C. Unit test (R-112 강제)

- [ ] `src/user/person.repository.spec.ts` 신규 — PrismaService 의 `person` 를 Jest mock (`jest.fn()`) 으로 대체. 다음 6 case 의 **happy path** 각 1 + 분기/error 추가 cover:
  - **happy path × 6 메서드**: findMany / findById / create / update / softDelete / restore 각 1 test (PrismaService mock 호출 인자 + return 값 검증).
  - **error path**: findById 가 null 반환하는 분기 (id 부재) / update 가 `P2025` throw (id 부재) / create 가 `P2002` throw (email 중복 unique constraint) 각 1 test.
  - **branch**: findMany 의 activeOnly=true (default) vs activeOnly=false (2 분기) 각 1 test.
  - **negative**: create 의 email 형식이 empty string 또는 undefined 인 경우 PrismaService 에 그대로 전달되는지 (validator 는 service 책임이므로 repo 는 raw pass-through) + softDelete 가 이미 active=false 인 row 에 호출 시 idempotent 동작 + restore 가 이미 active=true 인 row 에 호출 시 idempotent 동작 — 3 test.
- [ ] `pnpm test:cov` 실행 결과 line ≥ 80% AND function ≥ 80% (jest `coverageThreshold.global` 강제, [package.json](../../package.json) 의 jest config). 미달 시 jest exit 1 → CI red.

### D. Lint / build / unit / smoke / e2e (R-111 / R-113)

- [ ] `pnpm lint` 통과 (새 파일 0 lint error).
- [ ] `pnpm build` 통과 (TypeScript 컴파일 성공).
- [ ] `pnpm test` 통과 (모든 unit test green).
- [ ] `pnpm test:cov` 통과 (coverage threshold line/function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 (기존 smoke 가 regression 없이 통과).
- [ ] `pnpm test:e2e` 통과 (기존 e2e 가 regression 없이 통과).
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green.

### E. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE 또는 결함 사항 후속 round 처리.
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-112 coverage / 4 항목) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline):

- **ServiceIdentity entity / Prisma model / `isPrimary` invariant** → T-0035. p3-implementation-plan.md §2 row 2 의 잔여 절반.
- **PersonService (도메인 로직)** — group/part invariant 검증 / soft delete cascade / 동명이인 핸들링 등 → T-0036.
- **PersonController (REST endpoint)** — `GET/POST/PATCH/DELETE /api/persons` → T-0036.
- **DTO + class-validator** — Person request/response shape → T-0036.
- **Group / Part entity Prisma model** + Person↔Group N:M + Person↔Part N:1 invariant → T-0037 (당초 plan §2 의 T-0035 책임을 한 자리 뒤로).
- **User (로그인 계정) entity + AuthModule + RBAC guard + SuperAdmin 첫 로긴 자동 지정** → T-0038 (당초 plan §2 의 T-0036).
- **Assessment / Contribution / Summary entity + AssessmentModule** → T-0039 (당초 plan §2 의 T-0037).
- **p3-implementation-plan.md §2 표 task ID 시퀀스 갱신** (T-0034 split 으로 후속 task ID 가 한 자리씩 밀림 박제) — 별도 doc-only follow-up task. 본 task scope (코드 + migration) 외.
- **PostgreSQL container 의 CI service container 도입** — CI workflow 에 PostgreSQL service 추가는 별도 ops task. 본 task 의 unit test 는 PrismaService mock 으로 cover (DB 실제 connection 불필요).
- **Migration rollback / down migration** — Prisma 는 단방향 migration 만 (별도 ADR 없으면 미도입).
- **Seed data** (`prisma db seed`) — 별도 task.
- **Prisma Studio / GUI 통합** — 별도 ops task.
- **Repository pattern 의 abstract base class / interface 추상화** — over-engineering 회피. PersonRepository 는 concrete class 1 개로 진행, 향후 동일 패턴 N entity 등장 시 별도 refactor task.

## Suggested Sub-agents

`architect → implementer → tester` — architect 가 본 task 첫 read 직후 (a) cap 재검산 (실제 LOC > 300 또는 파일 > 5 면 split 요청) (b) PersistenceModule 의 `@Global()` 확인 + UserModule 의 imports 결정 (c) PersonRepository 의 6 메서드 시그니처 확정 박제 + 1 줄 결정 사유 (별도 ADR 신설 필요 없음 — data-model.md §2 + REQ-026 invariant 만으로 충분). implementer 가 migration 생성 + 3 신규 파일 + app.module.ts 1 줄 수정. tester 가 repository spec + lint/build/test:cov/smoke/e2e 검증.

## Follow-ups

(architect / implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)
