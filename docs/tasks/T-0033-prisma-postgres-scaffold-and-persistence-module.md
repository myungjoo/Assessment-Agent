---
id: T-0033
title: P3 — Prisma + PostgreSQL scaffold + PersistenceModule skeleton (인간 승인 게이트 발화)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-058]
estimatedDiff: 280
estimatedFiles: 5
created: 2026-05-25
plannerNote: P3 첫 task. p3-implementation-plan.md § 2 row 1. 새 외부 dependency 3 종 추가 — CLAUDE.md §5 BLOCKED 게이트 의도적 발화. executor 가 STATE.humanQuestions 박제 후 BLOCKED 종료 → 사용자 승인 후 다음 turn 진입.
dependsOn: [T-0032]
blocks: [T-0034, T-0035, T-0036, T-0037, T-0038, T-0039, T-0040]
hqOrigin: null
humanApprovalGate: true
---

# T-0033 — P3 첫 task: Prisma + PostgreSQL scaffold + PersistenceModule skeleton (인간 승인 게이트 발화)

## Why

[docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) § 2 row 1 + § 5 "인간 승인 게이트" 단락. P3 Domain core 의 모든 후속 task (T-0034 ~ T-0040) 의 transitive prerequisite — Prisma + PostgreSQL 의 실제 도입. [ADR-0002](../decisions/ADR-0002-db.md) (PostgreSQL + Prisma ACCEPTED) 의 "범위 밖 (deferred)" 단락이 본 task 의 직접 source. 본 task 가 머지되면 P3 의 entity Prisma model 작성 / NestJS module 구현 / migration / Docker compose 가 후속 task 의 일관된 dependency 기반 위에서 진행 가능.

본 task 의 본질: **새 외부 dependency 3 종 (`prisma`, `@prisma/client`, `pg`) 추가 — [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트의 의도적 발화**. executor 가 architect / implementer 호출 직전, 본 dependency 추가의 정당성을 `STATE.humanQuestions` 에 entry 로 박제 + STATUS=BLOCKED 반환 → notifier 가 lock 해제 + 사용자 답변 대기. 사용자 승인 후 다음 turn 에 architect (ADR-0002 status 갱신 또는 보강 ADR — Prisma version pinning + `pg` driver 선택 근거) → implementer (`pnpm add` 실행 + `prisma/schema.prisma` skeleton + `src/persistence/prisma.service.ts` + `src/persistence/persistence.module.ts` + `docker-compose.yml` PostgreSQL 16 skeleton) → tester (`pnpm install` 후 `pnpm lint && pnpm build && pnpm test:cov` + Prisma client generate 검증).

산출물: (1) `prisma/schema.prisma` skeleton — datasource postgresql + generator prisma-client-js + Person 1 entity 최소 (id / fullName / email / active / createdAt / updatedAt — data-model.md §2 row 1 의 최소 컬럼만), (2) `src/persistence/prisma.service.ts` — `@Injectable()` PrismaClient extension (`onModuleInit` connect / `enableShutdownHooks`), (3) `src/persistence/persistence.module.ts` — `@Global() @Module({ providers: [PrismaService], exports: [PrismaService] })`, (4) `docker-compose.yml` skeleton — services.postgres image=postgres:16-alpine + DATABASE_URL placeholder, (5) `.env.example` template — DATABASE_URL placeholder, (6) ADR-0002 status 갱신 또는 보강 ADR (Prisma version pinning), (7) `src/app.module.ts` 의 imports 에 PersistenceModule 추가, (8) 관련 unit test (PrismaService spec + PersistenceModule spec).

본 task 는 production code 신규 추가 + 새 외부 dependency + 새 ADR 신설/갱신이므로 **`commitMode: pr`** ([CLAUDE.md §3.1](../../CLAUDE.md) — `src/` / `package.json` / `docs/decisions/*` / docker-compose 모두 pr 컬럼).

**Scope discipline (architect 결정 박제)**:

- **DO**: PersistenceModule + PrismaService skeleton + Person 1 entity Prisma model + Docker compose PostgreSQL 16 skeleton + DATABASE_URL placeholder + ADR-0002 status 갱신 또는 보강 ADR.
- **DO NOT**: 추가 entity (ServiceIdentity / Group / Part / User / Assessment / Contribution / Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord) — T-0034+ 책임. Person 의 CRUD service / controller / repository — T-0034 책임. UserModule / AuthModule / AssessmentModule / LlmModule 신설 — T-0034 ~ T-0038 책임. PostgreSQL 외 DB driver. ORM 외 raw query layer. Production ops 설정 (replicas / health check / network). CI workflow 의 PostgreSQL service container 추가.

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 (L47–60)
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) § 2 row 1 + § 5 인간 승인 게이트
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) (ACCEPTED + "범위 밖 deferred" 단락)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (Node 20 LTS + pnpm 9 + TypeScript + NestJS)
- [docs/architecture/data-model.md](../architecture/data-model.md) § 2 Person entity row (T-0033 의 schema skeleton entity)
- [docs/architecture/directory.md](../architecture/directory.md) (`src/persistence/` 위치)
- [docs/architecture/modules.md](../architecture/modules.md) PersistenceModule 항목 (`@Global()` provider export)
- [CLAUDE.md](../../CLAUDE.md) §5 HITL 새 외부 dependency BLOCKED 게이트
- [package.json](../../package.json) 현재 dependencies / devDependencies inventory

## Acceptance Criteria

executor 가 본 task 진입 시 다음 절차를 **순서대로** 수행한다:

### A. 인간 승인 게이트 발화 (architect / implementer 호출 직전)

- [ ] `docs/STATE.json` 의 `humanQuestions` 배열에 다음 형식 entry 1 개 박제 (driver 가 STATE 의 single writer 이므로 executor 는 박제 요청만 + driver 가 commit):
  ```
  {
    "id": "HQ-NNNN",
    "createdAt": "<ISO>",
    "taskId": "T-0033",
    "question": "T-0033 (P3 첫 task) 는 새 외부 dependency 3 종 추가가 필수: `prisma`, `@prisma/client`, `pg`. ADR-0002 (PostgreSQL + Prisma ACCEPTED) 가 본 도입을 정당화. version 결정 후보 (a) prisma@5.x + @prisma/client@5.x + pg@8.x latest stable / (b) 다른 version. 옵션 선택 + 명령 승인.",
    "options": ["accept-latest-stable", "specify-versions", "other"],
    "decision": null,
    "resolvedAt": null
  }
  ```
- [ ] executor 가 STATUS=BLOCKED 반환 (reason: `human-approval-required`) → notifier 가 STATE.lock 해제 + 종료.

### B. 사용자 답변 후 다음 turn 의 acceptance

- [ ] architect: ADR-0002 status 갱신 (예: "version pinning: prisma@5.x, @prisma/client@5.x, pg@8.x") **또는** 보강 ADR 신설 (예: ADR-0002-amendment 또는 ADR-0006-prisma-version-pinning) — 사용자 결정값 (`decision` 필드) 에 따른 정확한 version 박제.
- [ ] implementer 의 acceptance:
  - [ ] `pnpm add prisma @prisma/client pg` 실행 (`package.json` + `pnpm-lock.yaml` 갱신).
  - [ ] `prisma/schema.prisma` skeleton 작성 — datasource `postgresql` (DATABASE_URL 환경변수 source) + generator `prisma-client-js` + Person model 1 개 (id String `@id @default(cuid())` / fullName String / email String `@unique` / active Boolean `@default(true)` / createdAt DateTime `@default(now())` / updatedAt DateTime `@updatedAt`).
  - [ ] `src/persistence/prisma.service.ts` 작성 — `@Injectable()` PrismaClient extension + `onModuleInit` 의 `await this.$connect()` + `enableShutdownHooks(app)` 메서드 (PrismaClient 의 `beforeExit` event 후 `app.close()` 호출).
  - [ ] `src/persistence/persistence.module.ts` 작성 — `@Global() @Module({ providers: [PrismaService], exports: [PrismaService] })`.
  - [ ] `docker-compose.yml` 신설 — services.postgres image=postgres:16-alpine + environment (POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB placeholder) + ports 5432:5432 + volumes (postgres-data 명명 볼륨).
  - [ ] `.env.example` template 신설 — DATABASE_URL=`postgresql://user:password@localhost:5432/assessment_agent?schema=public` placeholder.
  - [ ] `src/app.module.ts` 의 `imports` 배열에 `PersistenceModule` 추가.

### C. 테스트 acceptance (CLAUDE.md §3.2 R-112 강제 — 모든 5 항목 포함 의무)

- [ ] **Happy-path unit test**:
  - [ ] `src/persistence/prisma.service.spec.ts` — `PrismaService` instance 가 정상 생성됨 / `onModuleInit` 이 `$connect` 호출함을 mock 검증.
  - [ ] `src/persistence/persistence.module.spec.ts` — Testing module compile 시 `PrismaService` provider resolve / `@Global()` flag 박제 검증.
- [ ] **Error path unit test**:
  - [ ] `PrismaService.onModuleInit` 의 `$connect` 가 reject 할 경우 (예: DATABASE_URL 미설정 / 연결 실패) error 가 propagate 됨을 mock 검증.
  - [ ] `PersistenceModule` 의 `PrismaService` provider 가 mock 으로 대체된 경우 테스팅 환경에서 instance resolve 됨 검증.
- [ ] **Flow / branch coverage**:
  - [ ] PrismaService 의 `enableShutdownHooks` 메서드의 `beforeExit` event listener 가 등록되고 `app.close()` 가 호출됨을 mock 검증 (분기 1: hook 미등록 vs 등록 — 분기 명시).
- [ ] **Negative cases 충분 cover**:
  - [ ] DATABASE_URL 환경변수가 빈 문자열일 때 PrismaClient instantiation 의 거동 (Prisma 의 default error 검증 또는 throw).
  - [ ] `onModuleInit` 이 두 번 호출될 경우 idempotent 한지 (Prisma 의 `$connect` 가 중복 호출 안전한지) 검증.
  - [ ] PersistenceModule 이 `@Global()` 없이 다른 module 에서 import 했을 때의 거동 (테스트로 `@Global()` 플래그 박제 검증 — Reflect metadata).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80% — `package.json` 의 `coverageThreshold.global` 강제).

### D. 통합 검증

- [ ] `pnpm install` (lockfile 갱신 / lockfile commit).
- [ ] `pnpm lint` pass.
- [ ] `pnpm build` pass (TypeScript compile + Prisma client generate 사전).
- [ ] `pnpm test:cov` pass (위 C 항목의 coverage threshold 포함).
- [ ] `pnpm test:smoke` pass (T-0009 의 smoke 인프라 — PersistenceModule import 가 smoke 를 깨지 않음 검증).
- [ ] `pnpm test:e2e` pass (T-0010 의 e2e 인프라 — `/health` endpoint 가 PersistenceModule 도입 후에도 정상 응답).
- [ ] CI green (lint + build + test:cov + test:smoke + test:e2e + reviewer approval step).

## Out of Scope

본 task 는 **PersistenceModule + PrismaService + Person 1 entity skeleton 까지만** 책임. 다음은 후속 task 의 책임이므로 **DO NOT**:

- **추가 entity Prisma model** (ServiceIdentity / Group / Part / User / Assessment / Contribution / Summary / LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord) — T-0034+ 책임. 본 task 는 Person 1 entity skeleton 만.
- **Person 의 CRUD service / controller / repository** — T-0034 책임. 본 task 는 PersistenceModule + PrismaService skeleton 만.
- **UserModule / AuthModule / AssessmentModule / LlmModule 신설** — T-0034 ~ T-0038 책임.
- **migration SQL 작성** — `prisma migrate dev` 자동 생성. 본 task 에서 initial migration 파일 1 회 commit 은 선택 (architect 결정), 또는 T-0034 로 deferred.
- **DATABASE_URL secret** — `.env` 에 placeholder 만, secret 자체 commit 절대 금지 ([CLAUDE.md §9](../../CLAUDE.md)). `.env.example` 으로 template 제공.
- **PostgreSQL 외 DB driver** (`mysql2`, `sqlite3`, `mongodb` 등) — ADR-0002 위반.
- **ORM 외 raw query layer** (`knex`, `typeorm`, `kysely`) — ADR-0002 Prisma 선택과 충돌.
- **Prisma version 의 사전 결정** — 사용자 답변 (HQ-NNNN) 으로 결정.
- **Docker compose 의 production 설정** (replicas / health check / network — placeholder 만, 본격 ops 는 P7).
- **CI workflow 의 PostgreSQL service container 추가** — 별도 ops task. 본 task 는 application code + docker-compose.yml 만.

## Suggested Sub-agents

순서: **(BLOCKED phase 1)** `executor → notifier` (인간 승인 게이트 발화 + 종료) → **(사용자 결정 후 phase 2)** `executor → architect → implementer → tester → reviewer → integrator`.

## Follow-ups

(executor / 후속 sub-agent 가 작업 중 발견한 후속 항목 append)

- T-0034 — Person + ServiceIdentity entity Prisma model 추가 + UserModule skeleton (service / controller / repository).
- ADR-0002 status / amendment ADR 의 cross-document marker (data-model.md / directory.md 의 Prisma 관련 단락).
- CI workflow 의 PostgreSQL service container 추가 (별도 ops task — PR 본문에 "PostgreSQL service container 미존재 — 별도 ops task 에서 도입 예정" 명시).
- `.env.example` template 의 DATABASE_URL placeholder 박제 (본 task 에서 완료 시 follow-up 제거).
