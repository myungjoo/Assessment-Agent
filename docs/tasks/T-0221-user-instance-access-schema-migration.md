---
id: T-0221
title: UserInstanceAccess prisma model + migration 추가 (ADR-0024 §2 schema slice)
phase: P4
status: IN_PROGRESS
commitMode: pr
prNumber: 193
coversReq: [REQ-016, REQ-044]
estimatedDiff: 120
estimatedFiles: 4
created: 2026-06-04
plannerNote: P4 Q-0021 option(1) chain slice (1) — ADR-0024 §2 UserInstanceAccess join table schema + migration (behavior 변경 0)
---

# T-0221 — UserInstanceAccess prisma model + migration 추가 (ADR-0024 §2 schema slice)

## Why

[ADR-0024](../decisions/ADR-0024-user-instance-binding-data-model.md)(머지 완료) 가 audit own-instance 필터의 User↔instance binding 데이터 모델을 `UserInstanceAccess` join table 로 박제했고, 그 "후속 task chain" 의 **slice (1) — prisma schema + migration** 이 본 task 다. ADR 은 결정만 박제(prisma schema 변경 0)했으므로 본 slice 가 ADR-0024 Decision §2 를 단일 source 로 mirror 해 schema model + migration 을 실제로 추가한다. 사용자가 [Q-0021](../STATE.json) option (1) 로 §5 DB-schema 게이트를 승인했고([ADR-0004](../decisions/ADR-0004-smoke-e2e-db-mode.md) migrate-deploy 준수), REQ-016(권한 부족 user/admin audience 분리) non-Admin 절반 + REQ-044(instance 별 권한 분리) 를 조회 측에서 완성하기 위한 첫 backbone 이다.

본 slice 는 **schema + migration 만** — empty table 추가라 동작 변경 0(non-Admin 은 여전히 빈 배열 placeholder). repository / service 필터 결선 / endpoint 동작 변경은 ADR-0024 후속 slice (2)~(4) 의 책임(본 task Out of Scope).

## Required Reading

- [docs/decisions/ADR-0024-user-instance-binding-data-model.md](../decisions/ADR-0024-user-instance-binding-data-model.md) — 특히 **Decision §2**(`UserInstanceAccess` 채택 모델 prisma 블록 L77~89: 필드 + `@@unique([userId, instanceRef])` + `@@index([userId])` + `user @relation(... onDelete: Cascade)` + User back-relation `instanceAccess UserInstanceAccess[]`), **Decision §5**(binding 0 시작 = breaking change 0 migration), **후속 task chain** 표(slice (1) row).
- [prisma/schema.prisma](../../prisma/schema.prisma) — `PersonGroupMembership` model(L131~141, join + `@@unique` + `onDelete: Cascade` mirror 대상) + `User` model(L170~177, back-relation 1 줄 추가 대상) + `PermissionDeniedRecord.instanceRef`(L435, 매핑 대상 식별자, 변경 안 함).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — **§Decision** migration 절차(`prisma migrate deploy`, schema.prisma = source of truth, CI 실 PostgreSQL 16 container). `prisma db push` 금지 — 정식 migration 파일을 생성한다.
- [prisma/migrations/20260604000000_permission_denied_record/migration.sql](../../prisma/migrations/20260604000000_permission_denied_record/migration.sql) — 최신 migration 파일 구조(CreateTable + CreateIndex SQL 포맷) mirror 대상.
- [prisma/migrations/20260526000000_group_part/migration.sql](../../prisma/migrations/20260526000000_group_part/migration.sql) — `PersonGroupMembership` 의 `@@unique` unique index + `onDelete: Cascade` foreign key 의 실제 생성 SQL(`CREATE UNIQUE INDEX` + `ADD CONSTRAINT ... ON DELETE CASCADE`) 참조.
- [prisma-schema.spec.ts](../../prisma-schema.spec.ts) — 기존 schema-validation spec 패턴(runtime DMMF `Prisma.dmmf.datamodel.models` field 열거 + schema 원문 readFileSync 로 `@@unique`/`@@index`/cascade 선언 정규식 단언). 신규 model 검증을 이 spec 의 새 `describe` 블록으로 추가(colocated, 같은 파일).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 에 `UserInstanceAccess` model 추가 — ADR-0024 Decision §2 L77~89 와 **정확히 일치**: `id String @id @default(cuid())` / `userId String` / `instanceRef String` / `createdAt DateTime @default(now())` / `user User @relation(fields: [userId], references: [id], onDelete: Cascade)` / `@@unique([userId, instanceRef])` / `@@index([userId])`.
- [ ] `User` model 에 back-relation 필드 1 줄 추가 — `instanceAccess UserInstanceAccess[]`(Prisma 양방향 relation 요건, ADR-0024 §2 L94).
- [ ] `prisma/migrations/<timestamp>_user_instance_access/migration.sql` 생성 — `UserInstanceAccess` CreateTable + `@@unique([userId, instanceRef])` UNIQUE INDEX + `@@index([userId])` INDEX + `userId` foreign key `ON DELETE CASCADE`. timestamp 는 최신(`20260604000000`)보다 뒤(예: `20260604010000`). ADR-0004 migrate-deploy 패턴 준수 — `prisma db push` 사용 금지, 정식 migration 디렉토리 + `migration.sql` 생성.
- [ ] `pnpm prisma generate` 성공(PrismaClient 가 `userInstanceAccess` delegate 노출) + `pnpm build` 성공.
- [ ] `migration.sql` 이 기존 migration history 와 정합 — `pnpm prisma migrate status`(또는 CI 의 실 PostgreSQL `migrate deploy`) 가 drift 없이 통과. CI 의 real-PostgreSQL `migrate deploy` step 이 본 migration 을 적용해 green.
- [ ] `prisma-schema.spec.ts` 에 신규 `describe` 블록 추가(colocated, 같은 파일 — 기존 패턴 정합) — 다음을 단언:
  - (happy-path) DMMF datamodel 이 `UserInstanceAccess` model 을 포함하고 `id`/`userId`/`instanceRef`/`createdAt`/`user`(relation) field 를 노출. PrismaClient 가 `userInstanceAccess` delegate 노출.
  - (happy-path) `User` model 에 `instanceAccess` relation back-field 존재(`kind === "object"`).
  - (negative 안전망) schema 원문에 `@@unique([userId, instanceRef])` 선언 존재(정규식). `UserInstanceAccess.user` relation 이 `onDelete: Cascade`(schema 원문 정규식). `@@index([userId])` 선언 존재.
  - (negative 안전망) `UserInstanceAccess` 에 secret/token 컬럼(예: `token`/`apiKey`/`password`) 부재(CLAUDE.md §9 schema-level 강제 동형 안전망).
- [ ] **R-112 branch coverage 항목 — 본 slice 는 production 분기 로직 0**(schema 선언 + empty table migration 뿐, 동작 변경 0): happy-path symbol(신규 model) 단언 + negative 안전망 단언이 위 spec 으로 cover 되며, **분기 없음 → branch/error-path test 항목은 "schema 선언만, 분기 없음 — 생략"**(prisma-schema.spec.ts L4~5 기존 패턴 정합). coverage-theater(인위적 logic 추가로 cover 율 맞추기) 금지 — 이 점을 spec 주석에 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 slice 가 production 로직 0 LOC 이라 global coverage 를 떨어뜨리지 않음(schema/migration 은 coverage 집계 대상 아님). 기존 threshold 유지 확인.

## Out of Scope

- **repository / allowlist lookup** — `UserInstanceAccess` repository(`findInstanceRefsByUserId` 등) + 입력 시 정규화(ADR-0024 §4)는 후속 slice (2). 본 task 는 schema + migration 만.
- **service own-instance 필터 결선** — `PermissionDeniedRecordService.list` 의 non-Admin 분기는 **현 placeholder("항상 빈 배열") 그대로 유지**. allowlist lookup → `instanceRef in (allowlist)` 필터 주입은 후속 slice (3). 본 task 에서 service/controller/`PermissionDeniedRecordFilter` 를 건드리지 않는다.
- **endpoint 동작 변경** — `GET /api/permission-denied-records` 의 응답은 변하지 않는다(empty table → allowlist 항상 공집합 → 빈 배열, ADR-0024 §5). 기존 controller/service/e2e test 는 green 유지.
- **binding 부여 경로**(Admin endpoint / seed) — ADR-0024 §5 조건부 후속 task. 본 slice 는 empty table 만 생성(backfill/seed 0).
- **instanceRef 정규화 로직** — ADR-0024 §4 정규화(case/trailing-slash)는 후속 repository slice (2) 의 입력 경로 책임. 본 task 는 컬럼 정의만.
- **`JwtPayload` 확장** — ADR-0023 §2 / ADR-0024 server-side lookup 재확인(claim 비확장). 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester` (schema model + migration 추가 + schema-validation spec — ADR-0024 §2 가 이미 설계를 박제했으므로 architect 불요).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append. ADR-0024 후속 slice (2) binding repository / (3) service 필터 결선 / (4) R-112 test block 은 본 slice 머지 후 planner 가 순차 큐잉.)
