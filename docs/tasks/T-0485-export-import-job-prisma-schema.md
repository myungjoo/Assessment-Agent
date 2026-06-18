---
id: T-0485
title: prisma/schema.prisma 에 model ExportJob / ImportJob 추가 + migration 생성
phase: P7
status: DONE
prNumber: 396
mergeCommit: b8b8faa
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 190
estimatedFiles: 4
created: 2026-06-18
dependsOn: [T-0484]
independentStream: export-import-wiring
touchesFiles:
  - prisma/schema.prisma
  - prisma/migrations/20260618000000_export_import_job/migration.sql
  - prisma/migrations/migration_lock.toml
  - test/prisma-schema.spec.ts
plannerNote: "P7 export/import 실배선 chain step2 — ADR-0044 Decision §1 의 ExportJob/ImportJob 영속 entity 를 schema+migration 으로 박제(Q-0040 옵션1 승인 범위)"
---

# T-0485 — prisma/schema.prisma 에 model ExportJob / ImportJob 추가 + migration 생성

## Why

[ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) 가 export/import 비동기 진행 추적·재시도·감사를 위한 `ExportJob` / `ImportJob` 영속 entity 의 책임·필드·invariant 를 ACCEPTED 로 박제했다. 본 task 는 그 Decision §1 을 실제 `prisma/schema.prisma` model 코드 + migration 파일로 옮긴다 (ADR-0044 §Follow-ups 의 첫 후속 — "T-0485 후보, commitMode: pr, dependsOn: [T-0484]"). 이는 Q-0040 옵션 1 로 사용자가 승인한 절차 **(1) ADR → (2) Prisma schema/migration → (3) controller/service 배선** 의 step (2) 이며, 누적 45 helper (T-0437~T-0483) 가 배선될 영속 backbone 을 만든다 ([REQ-030](../requirements.md) Export/Import, [REQ-032](../requirements.md) raw 미저장, [REQ-045](../requirements.md) Admin).

## Required Reading

- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — 본 task 의 직접 상류. Decision §1 (필드 박제) / §2 (raw 미저장 전파) / §5 (AuditLog 경계) / §Out of scope (구체 type·index·cascade·artifact 저장소 후속 분리).
- `prisma/schema.prisma` — 기존 model 패턴 참고. 특히 `model User` (FK 대상, `requestedBy` relation), `model Assessment` / `model Summary` (cuid id + `@@unique` + `@@index([..., createdAt])` 시계열 패턴), `model PermissionDeniedRecord` (enum 미사용 standalone audit-유사 패턴 + `@@index` 2종).
- `prisma/migrations/20260604000000_permission_denied_record/migration.sql` — 신규 table 1개 추가 migration SQL 의 최신 선례 (CREATE TABLE + index 형식).
- `prisma/migrations/migration_lock.toml` — provider 고정 확인.
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 (entity 표 — ExportJob/ImportJob row 가 이미 추가됐는지 T-0484 결과 확인) / §4 (raw 미저장 invariant) / §7 (구체 컬럼 type 후속 범위 경계).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 에 `model ExportJob` 추가 — ADR-0044 Decision §1 의 공통 필드 (`id` cuid PK / `status` / `requestedBy` User FK / `createdAt` / `startedAt?` / `finishedAt?` / `error?` / `artifactRef?`) + ExportJob 고유 필드 (`scope` / `dateRange?` / `entitySelector?`). status·scope enum 은 Prisma `enum` 으로 박제 (`ExportJobStatus`: PENDING/RUNNING/SUCCEEDED/FAILED, `ExportScope`: FULL/RANGE/PARTIAL). `dateRange` / `entitySelector` 는 nullable `Json?`.
- [ ] `prisma/schema.prisma` 에 `model ImportJob` 추가 — 공통 필드 동일 + ImportJob 고유 필드 (`mode` enum `ImportMode`: REPLACE/MERGE, default REPLACE / `restoredRowCount Int?`). status enum 은 공통 `JobStatus` 를 재사용하거나 ImportJob 전용 enum 으로 — ADR-0044 §1 의 PENDING/RUNNING/SUCCEEDED/FAILED 4값을 정확히 반영하면 됨.
- [ ] 두 model 의 `requestedBy` 는 기존 `model User` 로의 FK (relation 필드 + scalar FK 컬럼). User 쪽 back-relation 필드 추가는 최소화 — Prisma 가 요구하면 추가하되 User schema 의 기존 필드는 변경하지 않는다 (ADR-0044 Cross-Module Impact "User schema 변경 0" 정합).
- [ ] raw 미저장 invariant (ADR-0044 §2): 두 model 의 어떤 필드도 raw commit message / diff / PR body / page 본문 컬럼을 두지 않는다. `artifactRef` 는 참조 식별자 (String?), `error` 는 사람-친화 요약 (String?) 일 뿐임을 schema 주석으로 명시.
- [ ] status·createdAt 조회 패턴을 위한 `@@index` — 최소 `@@index([status, createdAt])` 또는 `@@index([requestedBy, createdAt])` (UC-07 §8 status polling / 감사 조회 정합). Assessment 의 시계열 `@@index` 패턴 참고. (구체 index 추가 범위는 ADR-0044 §Out of scope 와 충돌하지 않게 최소로.)
- [ ] migration 파일 생성 — `prisma/migrations/20260618000000_export_import_job/migration.sql` (또는 `pnpm prisma migrate dev --create-only --name export_import_job` 으로 생성된 timestamp 디렉토리). 두 enum + 두 table + FK + index 의 CREATE 문 포함. 기존 table 변경 SQL 0 (User table ALTER 가 back-relation 으로 불가피하면 그 한 줄만 — 데이터 손실 없는 additive 만).
- [ ] schema 정합 검증: `pnpm prisma validate` 통과 + `pnpm prisma format` 적용 후 diff 안정.
- [ ] **Happy-path test**: `test/prisma-schema.spec.ts` (또는 colocated 위치) 에서 generated Prisma Client 에 `prisma.exportJob` / `prisma.importJob` delegate 가 존재하고 enum (`ExportJobStatus` 등) 이 export 됨을 검증하는 test 1+ (schema 박제 happy-path).
- [ ] **Error / negative path test**: enum 에 미정의 값을 넣은 객체 type 이 컴파일/런타임 거부되는지, 또는 필수 필드 (`status` / `scope` / `mode` / `requestedBy`) 누락 시 type 거부를 검증하는 negative test 1+. (Prisma Client 의 type-level 검증을 spec 에서 확인 가능한 범위로 — 분기 없는 schema 라 런타임 분기 test 가 어려우면 "분기 없음 — flow test 생략" 명시하고 type 존재·필드 nullable 여부 단언으로 대체.)
- [ ] **Flow / branch coverage**: schema 자체엔 런타임 분기 없음 — 해당 항목은 enum 값별 존재 단언 (PENDING/RUNNING/SUCCEEDED/FAILED 각 1 + REPLACE/MERGE 각 1) 으로 대체. 분기 없는 부분은 본문에 명시.
- [ ] **Migration validation (regression-유사)**: migration SQL 이 빈 DB 에 적용 가능함을 CI 의 e2e DB mode ([ADR-0004](../decisions/ADR-0004-smoke-e2e-db-mode.md)) 에서 `prisma migrate deploy` 가 성공으로 확인. migration 이 깨지면 e2e step 이 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 spec 파일 기준 coverage 충족. (schema 파일은 Prisma DSL 이라 jest coverage 대상 아님 — generated client/enum 을 import 하는 spec 의 coverage 로 충족.)
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green (tester 가 확인).

## Out of Scope

- **새 외부 dependency / credential 추가 금지** — Prisma 는 이미 stack ([ADR-0002](../decisions/ADR-0002-db.md)). Q-0040 승인은 **DB schema 변경 범위만** 해소했고, 새 npm 패키지 / object storage SDK / 새 credential 은 여전히 CLAUDE.md §5·§9 BLOCKED. artifact 저장소 SDK 가 필요해지면 본 task 에서 추가하지 말고 별도 §5 게이트.
- AssessmentModule export/import **controller / service 구현** — 후속 task (dependsOn: [T-0485]). 본 task 는 schema + migration 만.
- 누적 45 helper (T-0437~T-0483) 의 실 호출 배선 — 후속 chain.
- **artifact 저장소 mechanism** (파일시스템 vs object storage) 선택 — ADR-0044 §Out of scope.
- **AuditLog entity 의 구체 schema** — 별도 보안 ADR 책임 (ADR-0044 §5).
- **job row retention / cleanup 정책** — 후속.
- **merge mode conflict resolution 알고리즘** — 후속 service task.
- FK cascade policy 의 정교한 설계 (onDelete 등) 는 최소 안전값만 — 복잡한 cascade 설계는 후속.
- `docs/architecture/data-model.md` 의 §7 "구체 컬럼 type / migration SQL" 경계 문구 갱신은 별도 direct doc task (필요 시 Follow-ups).

## Suggested Sub-agents

`architect (필요 시 enum/index 미세 결정) → implementer → tester`. ADR-0044 가 결정을 이미 박제했으므로 architect 는 필요 시 enum naming / index 선택의 ADR 정합 확인 정도로만 — 신규 ADR 불요.

## Follow-ups

(비어있음 — sub-agent 가 작업 중 발견한 관련 작업을 여기에 적는다.)
