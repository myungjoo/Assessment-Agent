---
id: T-0052
title: CI services.postgres + DATABASE_URL + migrate deploy step + db-truncate helper (ADR-0004 follow-up, pr-mode)
phase: P3
status: IN_PROGRESS
prNumber: 47
commitMode: pr
coversReq: [REQ-029, REQ-058]
estimatedDiff: 140
estimatedFiles: 3
created: 2026-05-26
plannerNote: ADR-0004 후속 — CI infra 절반 (services.postgres 16-alpine + DATABASE_URL env + migrate deploy step + db-truncate helper) 단독 박제. spec override 제거는 cap 보존 위해 T-0053 분리.
dependsOn: [T-0051]
blocks: []
hqOrigin: null
humanApprovalGate: false
supersedes: null
plannerSource: docs/decisions/ADR-0004-smoke-e2e-db-mode.md §Decision + §Migration 의무 + §Cleanup 정책 (T-0051 mergeCommit 9109e65, ACCEPTED) + docs/tasks/T-0051 §Follow-ups L195 (예상 T-0052 5 항목 a~e) + driver-supplied 후보 (a) "실 CI infra 변경 (ADR-0004 follow-up, ~200-250 LOC / 4-5 파일 pr-mode)" 우선순위 1. **분리 결정**: 후보 (a) 의 원안 5 항목 (workflow services + DATABASE_URL env + migrate step + spec override 제거 + afterEach truncate helper) 중 spec override 제거가 4 spec 파일 × ~50 LOC = ~200 LOC 단독으로 cap 위협. 본 T-0052 = (1) workflow services.postgres 16-alpine + health-cmd + (2) DATABASE_URL env + (3) pnpm prisma migrate deploy step + (4) test/helpers/db-truncate.ts helper + (5) helper unit spec — 3 파일 / ~140 LOC. 후속 T-0053 = smoke/e2e 4 spec 의 PrismaService override 제거 + buildPersonFixture → prisma.person.create 실 seed 전환 + afterEach truncate hook wiring + 가능 시 unit-only 보조 mock 표기 박제. 본 분리 효과: (i) workflow + helper 의 reviewer 검토가 spec migration 의 noise 와 분리 (ii) helper 가 단독 spec 으로 검증되어 T-0053 진입 시 reference 안정 (iii) helper 박제 후에도 4 spec 은 mock override 유지로 regression 0 — incremental cutover 가능. coversReq: REQ-029 (CI 안에서 실 PostgreSQL durability path 발화 — ADR-0004 §Decision 근거 1) + REQ-058 (운영 정책 underlying — CI 정책 박제).
---

# T-0052 — CI services.postgres + DATABASE_URL + migrate deploy step + db-truncate helper (ADR-0004 follow-up)

## Why

[T-0051](T-0051-adr-0004-smoke-e2e-db-mode-policy.md) 이 머지한 [ADR-0004](../decisions/ADR-0004-smoke-e2e-db-mode.md) (mergeCommit 9109e65) 는 **smoke/e2e test 가 CI 안에서 실 PostgreSQL 16 container 위에서 실행** 한다는 정책을 ACCEPTED 로 박제했다. 단 ADR 자체는 의사결정만 — 실 CI 인프라 변경은 명시적으로 후속 task (본 T-0052) 의 책임으로 carve out 되었다 ([ADR-0004 §Migration 의무](../decisions/ADR-0004-smoke-e2e-db-mode.md) 5 항목).

ADR-0004 §Migration 의무 5 항목 중 본 task 가 박제하는 범위:

1. ✅ `.github/workflows/ci.yml` 에 `services.postgres:16-alpine` block 추가 (health-cmd / health-interval / health-retries 포함).
2. ✅ `.github/workflows/ci.yml` 의 `test:smoke` / `test:e2e` step 에 `DATABASE_URL` env var 주입.
3. ✅ `.github/workflows/ci.yml` 에 `pnpm prisma migrate deploy` step 추가 (test step 직전).
4. ⏭ smoke/e2e test 파일의 `Test.overrideProvider(PrismaService)` 제거 — **T-0053 (후속) 책임**.
5. ✅ `test/helpers/db-truncate.ts` helper 신설 — helper 코드 + spec 만 본 task. 실 hook 부착 (`test/jest-smoke.json` / `test/jest-e2e.json` 의 `afterEach` / `globalSetup`) 은 **T-0053 (후속) 책임**.

**분리 결정의 사유**:

- 원안 5 항목 단일 task 시 spec 4 파일 (app.smoke / persons.smoke / app.e2e / persons.e2e) 의 mock override 제거 + 실 seed 전환 (`mockPrisma.person.findMany.mockResolvedValueOnce([fixture])` → `await prisma.person.create({data:{...}})`) + afterEach hook 부착이 ~50 LOC × 4 spec = **~200 LOC 단독으로 cap 위협** ([CLAUDE.md §3](../../CLAUDE.md) 300 LOC 상한).
- ADR-first split ([T-0051](T-0051-adr-0004-smoke-e2e-db-mode-policy.md)) 의 자연 연장 — 본 task = "infra + helper", 후속 T-0053 = "spec cutover". 본 task 머지 후 helper 의 단독 검증 (db-truncate.spec.ts) 이 T-0053 진입 시 reference 안정.
- 본 task 머지 후에도 4 spec 은 mock override 유지로 regression 0 — incremental cutover 가능. T-0053 머지 시점에 비로소 real DB 동작 검증 발화.

본 task 의 변경은 모두 [ADR-0004 §Decision](../decisions/ADR-0004-smoke-e2e-db-mode.md) 의 정책 박제를 1:1 reference 로 구현 — 새 의사결정 0, architect 호출 0.

REQ 매핑:

- [REQ-029](../requirements.md) — 평가 자료 non-volatile 저장. CI 안에서 실 PostgreSQL durability path 가 발화돼야 정합 검증이 의미를 갖는다 (ADR-0004 §Decision 근거 1). 본 task 가 그 path 의 절반 (services + migrate) 박제 — 나머지 절반 (실 query 발화) 은 T-0053.
- [REQ-058](../requirements.md) — 운영 정책 underlying. CI 정책 박제의 long-horizon 일관성 유지.

## Required Reading

- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — 본 task 의 1차 reference. §Decision 의 services.postgres 채택 / migration / cleanup 정책 + §Migration 의무 5 항목 (본 task 가 그 중 3 + 1 부분 박제) + §Cleanup 정책의 helper signature inline 예시 (`test/helpers/db-truncate.ts` 의 `truncateAll(prisma)` shape).
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 본 task 의 1차 변경 대상. 현 8 step 구성 (checkout → spec-presence → spec-presence-test → pnpm → Node → install → lint → build → test:cov → test:smoke → test:e2e → reviewer-gate). 본 task 가 (a) `services.postgres` block 신설 (b) DATABASE_URL env (c) migrate deploy step 추가.
- [prisma/schema.prisma](../../prisma/schema.prisma) — 5 model (Person / Group / Part / PersonGroupMembership / ServiceIdentity). 본 task 의 helper 가 TRUNCATE 대상 테이블 명단 도출의 source. 본 task 는 schema 변경 0.
- [prisma/migrations/20260525000000_init/migration.sql](../../prisma/migrations/20260525000000_init/migration.sql) + [prisma/migrations/20260525000001_service_identity/migration.sql](../../prisma/migrations/20260525000001_service_identity/migration.sql) + [prisma/migrations/20260526000000_group_part/migration.sql](../../prisma/migrations/20260526000000_group_part/migration.sql) — 3 migration. `pnpm prisma migrate deploy` 가 적용할 candidate. 본 task 는 migration 신설 0 — 기존 3 migration 의 deploy 만.
- [src/persistence/prisma.service.ts](../../src/persistence/prisma.service.ts) — PrismaService 박제. 본 task 의 helper 가 PrismaService 의 `$executeRawUnsafe` 호출 (PrismaClient 상속 메서드). 본 task 는 본 파일 변경 0 (helper 가 외부에서 prisma 인스턴스 받기만 함).
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 기존 mock helper. 본 task 의 새 db-truncate helper 와 위치 / 이름 / export 패턴 mirror reference (단일 단순 helper export 패턴 일관).
- [test/jest-smoke.json](../../test/jest-smoke.json) + [test/jest-e2e.json](../../test/jest-e2e.json) — 현 jest config 2 종. 본 task 는 본 파일 변경 0 — afterEach hook 부착은 T-0053 책임. (Required Reading 에 두는 이유: helper 신설 시 향후 hook 부착 지점 인지 + 본 task 가 변경 안 함을 명확화).
- [package.json](../../package.json) L11-23 (scripts) + L86-93 (coverageThreshold) — 본 task 가 호출할 script (`pnpm prisma migrate deploy`, `pnpm test:smoke`, `pnpm test:e2e`) 와 coverage threshold (line ≥ 80% / function ≥ 80%). 본 task 는 package.json 변경 0.
- [docs/tasks/T-0051-adr-0004-smoke-e2e-db-mode-policy.md](T-0051-adr-0004-smoke-e2e-db-mode-policy.md) §Follow-ups L195 — 예상 T-0052 5 항목 a~e 박제. 본 task 의 책임 carve 의 직접 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode pr — `.github/workflows/` 는 pr 대상) / §3.2 R-110~R-114 (test/CI 절대 규칙 — 본 task 는 CI infra 자체를 변경하므로 R-110~R-114 검증이 본질적으로 가장 직접 발화) / §11 (trail blob) / §12 (한국어 본문).

## Acceptance Criteria

본 task 는 **pr-mode** — feature branch `claude/T-0052-ci-postgres-services-and-db-truncate-helper` → commit → push → PR open → reviewer round → integrator 4-게이트 → squash merge ([CLAUDE.md §3.1](../../CLAUDE.md)).

**A. `.github/workflows/ci.yml` 변경 (~25 LOC 추가)**:

- [ ] `jobs.ci` 에 `services:` block 추가:
  ```yaml
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: assessment_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd "pg_isready -U postgres"
        --health-interval 5s
        --health-timeout 5s
        --health-retries 10
  ```
  ADR-0004 §Decision 의 health-cmd / health-interval / health-retries 박제와 1:1 정합.
- [ ] `jobs.ci.env` (job 전체 scope) 에 `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/assessment_test?schema=public` 주입. 모든 step (`pnpm prisma migrate deploy` / `pnpm test:smoke` / `pnpm test:e2e`) 이 본 env var 를 읽는다. unit test (`pnpm test:cov`) 도 본 env 를 보지만 mock override 가 PrismaService 를 mock 으로 치환하므로 영향 0.
- [ ] `의존성 설치` step 직후 + `Lint 검사` step 직전 (또는 `Build` 직후 + `테스트 + 커버리지 검사` 직전 — 적절한 위치 선택) 에 새 step 추가:
  ```yaml
  - name: Prisma migrate deploy
    run: pnpm prisma migrate deploy
  ```
  `pnpm prisma migrate deploy` 는 prisma/migrations/ 의 3 migration 을 services.postgres container 의 assessment_test DB 에 적용. 본 step 이 fail 하면 후속 test step 도 자연 fail (test 가 DB schema 없이는 못 돔).
- [ ] 기존 step 의 순서 / name / run / if 조건 변경 0 — 신규 추가만 (additive).
- [ ] `reviewer agent approval 검증` step 의 if 조건 / 본문 변경 0.

**B. `test/helpers/db-truncate.ts` 신규 (~30 LOC)**:

- [ ] 파일 헤더 한국어 주석 (~10 LOC) — 책임 / ADR-0004 §Cleanup 정책 reference / 사용 예시 / 위치 정책 (jest testRegex 매칭 0 / coverageFrom scope 밖) 박제.
- [ ] export 함수 `truncateAll(prisma: PrismaService): Promise<void>` — ADR-0004 §Cleanup 정책 inline 예시와 1:1 시그니처:
  ```ts
  export async function truncateAll(prisma: PrismaService): Promise<void> {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE persons, parts, groups, person_group_memberships, service_identities RESTART IDENTITY CASCADE',
    );
  }
  ```
  - 테이블 명단: 현 schema.prisma 의 5 model 의 Prisma snake_case mapping. **검증 필수**: Prisma 의 default `@@map` 정책 — `Person` → `Person` (PascalCase 유지). 실제 SQL table 이름은 migration.sql 의 `CREATE TABLE` 문에서 확인 (3 migration 의 actual table 이름). 만약 PascalCase (`"Person"` / `"Group"` / `"Part"` / `"PersonGroupMembership"` / `"ServiceIdentity"`) 라면 quoted identifier 로 박제 (`TRUNCATE TABLE "Person", "Part", "Group", "PersonGroupMembership", "ServiceIdentity" RESTART IDENTITY CASCADE`).
  - `RESTART IDENTITY` — serial / identity sequence reset (ADR-0004 §Cleanup 박제).
  - `CASCADE` — foreign key cascade 자동 처리 (ADR-0004 §Cleanup 박제).
- [ ] PrismaService import path 는 `../../src/persistence/prisma.service` (test/helpers/ → src/persistence/).
- [ ] 한국어 본문 (§12 의무).

**C. `test/helpers/db-truncate.spec.ts` 신규 (~80 LOC) — R-112 4 종 cover**:

본 spec 은 unit jest scope (testRegex `.*\.spec\.ts$`) 에 picking 되어 `pnpm test` / `pnpm test:cov` 에서 실행. PrismaService 의 `$executeRawUnsafe` 를 mock 으로 spy. 실 DB 의존성 0.

- [ ] **Happy path 1** (R-112 #1): `truncateAll(prisma)` 호출 시 `prisma.$executeRawUnsafe` 가 **정확히 1 회** 호출되고, 첫 인자가 `'TRUNCATE TABLE ' ` 로 시작하며 `' RESTART IDENTITY CASCADE'` 로 끝나는 SQL 문자열 검증. resolve 시 함수 반환값이 `undefined` (Promise<void>) 검증.
- [ ] **Happy path 2** (R-112 #1 추가): SQL 문 안에 5 테이블 (persons / parts / groups / person_group_memberships / service_identities — 또는 PascalCase 변종) 이 모두 포함되어 있는지 검증 (substring 5 개 each). 실 schema 와 helper 의 분기 추가 시 회귀 anchor.
- [ ] **Error path 1** (R-112 #2): `prisma.$executeRawUnsafe` 가 reject 시 (예: connection error / SQL syntax error) `truncateAll(prisma)` 가 동일 error 를 propagate. `await expect(truncateAll(prismaWithFailingExec)).rejects.toThrow('boom')` 패턴.
- [ ] **Error path 2** (R-112 #2 추가): `prisma` 인자가 `null` / `undefined` 일 때 — `$executeRawUnsafe` 호출 시점 `TypeError` propagate. `await expect(truncateAll(null as any)).rejects.toThrow()` 패턴.
- [ ] **Branch coverage** (R-112 #3): 본 helper 는 단일 `await` line — 분기 없음. spec 의 acceptance 본문에 "분기 없음 — 본 항목 생략 (helper 가 단일 SQL 호출, conditional 0)" 명시.
- [ ] **Negative cases** (R-112 #4 — 충분 cover): 위 Error path 2 종 + 다음 변종 1+ 추가:
  - 빈 객체 `{}` (즉 `prisma` 가 `$executeRawUnsafe` property 없음) — `TypeError` propagate.
  - `$executeRawUnsafe` 가 함수가 아닌 string — `TypeError` propagate.
  총 negative cover 3+ (Error path 2 + 변종 1).
- [ ] coverage line / function / branch / statement — db-truncate.ts 가 단일 export 함수 1 개 (단순 await SQL) 라 line/function/statement 100% 자연 달성. branch 0 (no conditional) — 100% 자연 달성 (분기 없음 = 100%).

**D. R-110~R-114 cover**:

- [ ] **R-110 (코드 검토 + test + 실행)** — production code 변경 1 (test/helpers/db-truncate.ts) + CI workflow 변경 + test 추가 1 (db-truncate.spec.ts). tester 가 `pnpm lint && pnpm build && pnpm test && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 6 명령 실행.
- [ ] **R-111 (CI fail = merge 차단)** — 본 task 의 PR 의 CI 가 (a) services.postgres 부트 성공 (b) `pnpm prisma migrate deploy` exit 0 (c) test:smoke / test:e2e 가 기존 mock override 유지 상태로 regression 0 (d) test:cov 의 coverage threshold 통과 — 전부 green 시에만 merge. helper spec 의 4 test 가 unit scope 에서 함께 green.
- [ ] **R-112 (happy/error/branch/negative)** — 본 task §C 5 항목 (happy 2 + error 2 + branch 생략 명시 + negative 3+) 박제.
- [ ] **R-113 (smoke + e2e)** — 본 task 는 smoke/e2e test 파일 변경 0 — 기존 spec 의 mock override 유지로 regression 0. 단 CI infra 변경 (services.postgres 추가) 가 기존 smoke/e2e 실행 환경에 영향 0 — mock override 가 PrismaService 의존을 mock 으로 치환하므로 실 DB connection 호출 자체 0 (기존 PrismaService 부트는 `onModuleInit` 의 `$connect` 가 실 DB 부트 시도하나 mock override 가 `onModuleInit` 자체를 mock 호출로 치환 — 영향 검증은 tester 의 `pnpm test:smoke` 실행으로).
- [ ] **R-114 (CI 수행)** — driver 가 push 후 `gh run list` 로 CI conclusion 확인 (LOOP.md §1 [5]).

**E. 검증 명령 (tester)**:

- [ ] `pnpm lint` pass (0 error). 새 helper + spec 의 lint clean.
- [ ] `pnpm build` pass (TypeScript 컴파일 — helper 가 src/ scope 밖이라 build 영향 0, spec 도 build scope 밖).
- [ ] `pnpm test` pass — 기존 unit + 새 db-truncate.spec.ts 4 test 추가. regression 0.
- [ ] `pnpm test:cov` pass — coverage threshold (line ≥ 80% / function ≥ 80%) 통과. helper 는 `collectCoverageFrom: ["src/**/*"]` scope 밖이라 coverage 통계 영향 0 (test/helpers/ 가 src/ 아님). spec 만 unit jest 에 picking.
- [ ] `pnpm test:smoke` pass — 기존 9 test (app.smoke 2 + persons.smoke 7) 의 mock override 유지로 regression 0.
- [ ] `pnpm test:e2e` pass — 기존 e2e test 의 mock override 유지로 regression 0.

**F. PR / commit / push**:

- [ ] feature branch `claude/T-0052-ci-postgres-services-and-db-truncate-helper` 에서 작업, main 으로 PR.
- [ ] commit message subject ≤ 70 char — `ci(db): services.postgres + migrate deploy + truncate helper (T-0052)`.
- [ ] commit body 본문 한국어 (§12) — why / ADR-0004 follow-up 박제 / 5 항목 중 3+1 부분 박제 / T-0053 carve out ~5-7 줄.
- [ ] commit body 의 agent-trail blob (§11) — PLANNER (본 frontmatter plannerNote 동일) + IMPLEMENTER (files / loc / notes) + TESTER (added: test/helpers/db-truncate.spec.ts / result: pass / coverage: helper 100%, regression 0) + INTEGRATOR (pr=NN round=N ci=pass) + ACCEPTANCE 섹션 포함. ARCHITECT 섹션 생략 (ADR-0004 reference 만, architect 호출 0).
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria A~F 체크리스트 + ADR-0004 §Decision 인용 (reviewer 의 의사결정 확인 용이).
- [ ] integrator 4-게이트 (a APPROVE / b PR comment 외부 / c self-check / d CI green) 통과 후 `gh pr merge <num> --squash --delete-branch`.

## Out of Scope

본 task 는 **하지 않는다** — 후속 task 책임:

- **smoke/e2e 4 spec (app.smoke / persons.smoke / app.e2e / persons.e2e) 의 `Test.overrideProvider(PrismaService)` 제거 + 실 seed 전환 (`mockPrisma.person.findMany.mockResolvedValueOnce([fixture])` → `await prisma.person.create({data:{...}})`)** — **T-0053 (후속) 책임**. 본 task 머지 후 4 spec 은 mock override 유지로 regression 0 — incremental cutover 가능.
- **`test/jest-smoke.json` / `test/jest-e2e.json` 의 `afterEach` / `globalSetup` / `globalTeardown` hook 부착** — **T-0053 (후속) 책임**. 본 task 는 helper 코드 + spec 만 신설, 실 hook 부착은 spec 의 override 제거와 함께 박제.
- **`test/helpers/prisma-mock.ts` 의 unit-only 보조 표기 / deprecation 마커 박제** — T-0053 또는 별도 doc-only follow-up 책임. ADR-0004 §Decision 의 "unit-only 보조 유지" 결정의 helper 헤더 박제.
- **ADR-0004 의 `amendments[]` 갱신 (T-0052 mergeCommit + 실 services.postgres image tag / health-cmd 정밀 박제)** — T-0053 머지 후 (둘 다 머지된 시점) 한꺼번에 1 LOC ADR frontmatter 갱신 (doc-only direct).
- **새 외부 dependency** — postgres docker image 는 GitHub Actions runtime services, package.json 의존성 0. `pg` / `@prisma/adapter-pg` / `prisma` / `@prisma/client` 는 이미 [package.json](../../package.json) L28-33 에 존재 (T-0033 도입). 새 npm 패키지 추가 0.
- **prisma schema 변경** — 본 task 는 기존 3 migration 의 deploy 만, schema 변경 / 새 migration 신설 0.
- **PrismaService 의 `onModuleInit` / `enableShutdownHooks` 변경** — src/persistence/prisma.service.ts 변경 0. 본 task 가 호출하는 helper 는 외부에서 prisma 인스턴스 받기만 함.
- **GroupController + Group DTO + REST endpoints** — driver-supplied 후보 (b). 별도 후속 task 책임 (T-0054+ 후보).
- **GroupService.addMember / removeMember N:M ops** — driver-supplied 후보 (c). 별도 후속 task 책임.
- **phase 2 src/user/*.spec.ts migration to prisma-mock.ts helper** — driver-supplied 후보 (d). 별도 후속 task 책임.
- **p3-implementation-plan.md §2 표 T-0046~T-0052 row 추가** — driver-supplied 후보 (e). 별도 doc-only direct follow-up.
- **PLAN.md L66 bullet 의 "T-0052 완료" 마커 append** — 본 task 머지 시점 PLAN.md L66 의 ADR-0004 마커가 이미 "T-0052 가 본 ADR 의 결정에 따라 ... 추가" 로 박제됨 (T-0051 commit). 본 task 머지 시점에 "(T-0052 = infra + helper 박제 완료; T-0053 = spec cutover 후속)" 한 줄 append 는 T-0053 머지 시점에 한꺼번에 박제 (split avoid pollution).

## Suggested Sub-agents

`implementer → tester` (pr-mode 기본 chain).

- **implementer**: §A (.github/workflows/ci.yml 변경) + §B (test/helpers/db-truncate.ts 신설) + §C (test/helpers/db-truncate.spec.ts 신설) 3 파일 staging. SQL 의 table 이름 PascalCase vs snake_case 결정은 prisma/migrations/20260525000000_init/migration.sql 의 `CREATE TABLE` 문 확인 후 1:1 일치 (Prisma 의 default mapping). 한국어 본문 (§12).
- **tester**: §E 6 명령 (lint / build / test / test:cov / test:smoke / test:e2e) 실행 + regression 0 + helper coverage 100% 확인. 신규 spec 4 test (happy 2 + error 2) 가 unit scope 에 picking 되어 통과.
- **architect** 호출 안 함 — 본 task 는 ADR-0004 §Decision / §Migration 의무 / §Cleanup 정책의 1:1 박제, 새 의사결정 0. 만약 implementer 가 (a) GitHub Actions services.postgres 의 정확한 health-cmd / port 설정 (b) DATABASE_URL 의 URL form / schema query param (c) helper 의 prisma 인스턴스 acquisition (lazy vs eager) 중 ADR-0004 가 명시 안 한 의사결정 발생 시 architect 호출 후 재진입.
- **reviewer + integrator** 호출은 driver 가 push 후 자동 dispatch (LOOP.md §1 [4]). T-0048 race-fix 4 회차 dogfood 발화 예정 (T-0049 / T-0050 / T-0051 의 누적 3 회차 SUCCESS 이후 본 task 가 4 회차) — comment-triggered rerun 자동 absorption 의 지속 동작 monitoring (`gh run rerun` 0 회 목표).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 작업 중 발견한 항목을 본 섹션에 append.)

선행 후보 (planner pre-fill, sub-agent 가 검토 후 유지 / 제거):

- [ ] **T-0053 (예상): smoke/e2e spec cutover off mock override + afterEach truncate hook** — ADR-0004 §Migration 의무 5 항목 중 본 task 가 carve out 한 #4 + #5 일부. (a) test/smoke/app.smoke-spec.ts + test/smoke/persons.smoke-spec.ts + test/e2e/app.e2e-spec.ts + test/e2e/persons.e2e-spec.ts 4 spec 의 `Test.overrideProvider(PrismaService)` 제거 + `mockPrisma.X.mockResolvedValueOnce(...)` → `await prisma.X.create({data:{...}})` 실 seed 전환 (b) test/jest-smoke.json + test/jest-e2e.json 의 globalSetup (PrismaService 인스턴스 생성 + `$connect` + truncateAll 1 회) + afterEach hook (truncateAll 호출) (c) test/helpers/prisma-mock.ts 의 헤더 주석에 "ADR-0004: unit-only 보조 유지, smoke/e2e 에서 deprecated (T-0053 mergeCommit)" 박제. **~200-250 LOC / 5-6 파일 pr-mode** — cap 보존 위해 추가 split 가능성 (예: smoke / e2e 별 split).
- [ ] **GroupController + Group DTO + REST endpoints** (driver-supplied 후보 b) — `/api/groups` 5 endpoint + CreateGroupDto + class-validator + module wiring + controller spec. PartController (T-0046) 1:1 mirror. ~350-400 LOC / 4-5 파일 pr-mode (자체 split 가능성).
- [ ] **GroupService.addMember / removeMember N:M ops** (driver-supplied 후보 c) — PersonGroupMembershipRepository (T-0049) 호출 + spec + controller endpoint. ~200 LOC / 2-3 파일.
- [ ] **phase 2 src/user/*.spec.ts migration to test/helpers/prisma-mock.ts** (driver-supplied 후보 d) — 5 spec 파일 mechanical migration. T-0047 helper 의 본격 활용. ~150 LOC / 5 파일 pr-mode (cap-borderline — split 가능성).
- [ ] **p3-implementation-plan.md §2 표 T-0046~T-0052 row 추가** (driver-supplied 후보 e) — T-0045 패턴 재실행. doc-only direct ~40-50 LOC.
- [ ] **ADR-0004 amendments[] 갱신** — T-0052 + T-0053 둘 다 머지된 시점에 한꺼번에 ADR-0004 frontmatter `amendments[]` 에 `{date: ..., task: T-0052, decision: services.postgres 16-alpine + ...}` + `{date: ..., task: T-0053, decision: spec cutover off mock override}` 2 entry 추가. 1-3 LOC doc-only direct.
- [ ] **T-0048 race-fix 4 회차 dogfood 검증** — T-0049 (1 회차) + T-0050 (2 회차) + T-0051 (3 회차) 모두 SUCCESS 후 본 task 가 4 회차. integrator 의 comment-triggered rerun 자동 absorption 의 지속 동작 monitoring. `gh run rerun` 0 회 목표 — race fix 의 누적 4 PR 안정성 검증.
- [ ] **CI 시간 모니터링** — ADR-0004 §Consequences "음의 1: CI 시간 +30-60s 증가" 박제. 본 task 머지 후 첫 CI run 의 wall time 측정 → ADR-0004 의 "30-60s" 예측 검증. 만약 실제 +90s 초과 시 별도 follow-up (예: docker image cache layer 최적화 / services.postgres 의 health-interval 단축).
