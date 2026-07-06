---
id: T-0799
title: User.timezone 컬럼 additive migration + schema 추가 (ADR-0052 slice 1)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-034, REQ-031]
dependsOn: []
independentStream: timezone-user-setting
touchesFiles:
  - prisma/schema.prisma
  - prisma/migrations/20260706000000_user_timezone/migration.sql
  - test/prisma-schema.spec.ts
hqOrigin: Q-0050
estimatedDiff: 80
estimatedFiles: 3
created: 2026-07-06
plannerNote: "Q-0050 slice1 — ADR-0052 User.timezone additive migration(owner-approved DB schema). schema+migration+schema-spec. helper 일반화/배선은 slice2/3."
---

# T-0799 — User.timezone 컬럼 additive migration + schema 추가 (ADR-0052 slice 1)

## Why

[ADR-0052](../decisions/ADR-0052-user-timezone-storage.md) §Decision (a) 는 per-user timezone 설정의 저장 위치를 로그인 계정 `User` 엔티티의 `timezone` 컬럼(`String @default("Asia/Seoul")`, NOT NULL, additive)으로 확정했다. [Q-0050](../STATE.json) 의 owner 결정이 이 DB schema 변경을 **명시 승인**했다(CLAUDE.md §5 게이트 통과). 본 task 는 ADR-0052 §Follow-ups 의 **slice (1)** — `prisma/schema.prisma` 의 `model User` 에 컬럼 1개 추가 + additive migration SQL + schema-level 검증 spec 만 담당한다. helper 일반화·배선은 후속 slice(§Follow-ups).

## Required Reading

- [docs/decisions/ADR-0052-user-timezone-storage.md](../decisions/ADR-0052-user-timezone-storage.md) — §Decision (a) 저장 위치/타입/default, §Consequences additive 무손상 근거
- [docs/decisions/ADR-0051-user-configurable-timezone.md](../decisions/ADR-0051-user-configurable-timezone.md) — §Decision (b)(c) `Intl.DateTimeFormat(timeZone)` 메커니즘 (본 컬럼 값이 흐를 대상, 배선은 slice 2/3)
- `prisma/schema.prisma` — 현행 `model User` 정의(line 170~194; `id/email/hashedPassword/role/createdAt/updatedAt` + instanceAccess/exportJobs/importJobs relation)
- `prisma/migrations/20260528000000_user/migration.sql` — 기존 User 테이블 생성 migration (컬럼 추가 대상)
- `prisma/migrations/20260618000000_export_import_job/migration.sql` — 최근 additive migration 의 주석/구조 template
- `test/prisma-schema.spec.ts` — schema-level 검증 spec 패턴(생성된 PrismaClient DMMF + schema 원문 as-truth). 본 task 의 timezone 검증 블록을 여기에 추가
- [docs/architecture/data-model.md](../architecture/data-model.md) — User(로그인 계정) 엔티티 정의(line 27) 및 User/Person 분리

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 의 `model User` 에 `timezone String @default("Asia/Seoul")` 컬럼 1개 추가 (NOT NULL, 기존 필드/관계 시그니처 무변경 — additive only).
- [ ] `prisma/migrations/20260706000000_user_timezone/migration.sql` 신설 — `ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul';` (기존 row 는 default 로 자동 backfill). migration 상단에 ADR-0052 참조 한국어 주석.
- [ ] `pnpm prisma validate` (또는 `prisma generate` 시 파싱) 로 schema 유효성 통과 — schema drift 0.
- [ ] `pnpm prisma migrate diff` / `prisma migrate status` 로 migration 이 schema 와 정합(migration 이 위 컬럼을 정확히 반영, 미적용 drift 없음). CI 에서 실행 가능한 형태로 검증.
- [ ] **Happy-path test** (schema-as-truth, `test/prisma-schema.spec.ts` 에 추가): 생성된 `PrismaClient` 의 User 모델 DMMF 에 `timezone` 필드가 존재하고 타입이 `String`, `hasDefaultValue: true` 이며 default 값이 `"Asia/Seoul"` 임을 단언. migration.sql 원문에 `ADD COLUMN "timezone"` + `DEFAULT 'Asia/Seoul'` 이 존재함을 단언.
- [ ] **Negative / regression test**: (i) 기존 User 컬럼/relation(`email @unique`, `instanceAccess`, `exportJobs`, `importJobs`)이 그대로 존재해 additive 무손상임을 단언(기존 시그니처 파괴 regression 방지). (ii) `timezone` 이 nullable 아님(NOT NULL) 을 단언 — default 없는 nullable 로 잘못 선언되는 drift 차단.
- [ ] **분기 cover**: 본 task 는 production 분기 로직 0 LOC(schema 선언 + migration DDL 만) — "분기 없음, 이 항목 생략" 을 spec 주석에 명시(기존 prisma-schema.spec.ts (T-0485) 패턴 정합).
- [ ] `pnpm lint && pnpm build && pnpm test` 전체 green + 기존 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — schema/migration 은 production 코드 0 LOC 라 기존 coverage threshold 유지, 신규 미달 유발 없음).

## Out of Scope

- **period-boundary.ts helper 일반화 금지** — `startOfKstDay`/`startOfKstWeek`/`startOfKstMonth`/`getKstPeriodRange`/formatter 에 `timeZone` 파라미터 추가는 **slice (2)** 책임. 본 task 는 helper 를 건드리지 않는다.
- **R-9 controller / display mapper 배선 금지** — 요청 User.timezone 을 helper 로 전달하는 배선은 **slice (3)** 책임.
- **timezone 설정 변경(mutation) endpoint / 입력 검증(무효 IANA tz) 금지** — ADR-0052 §Out of scope. 본 task 는 저장 위치(컬럼) 만 박제.
- **auth/User service·DTO 변경 금지** — 로그인/응답에 timezone 노출은 후속 배선. 본 task 는 schema layer 만.
- **Person.timezone 도입 금지** — ADR-0052 §NON-goal (요약 경계 KST 고정).
- **frontend UI 금지** — P6 이후.

## Suggested Sub-agents

`implementer → tester` (ADR 재결정 불요 — ADR-0051/0052 가 이미 저장 위치/타입/default 확정. schema + migration + spec 만).

## Follow-ups

- **slice (2)** — `src/common/period-boundary.ts` 의 `startOfKstDay`/`startOfKstWeek`/`startOfKstMonth`/`getKstPeriodRange`/formatter 를 `timeZone` 파라미터(기본값 `"Asia/Seoul"`)를 받도록 일반화. R-112 4종(happy·error·flow·negative: 무효 tz 식별자·DST 있는 zone 경계·기본값 fallback). 기존 호출부는 기본값으로 무변경 동작. pr, 새 dependency 0. (ADR-0051/0052 §Follow-ups)
- **slice (3)** — R-9 사용자 지정 기간 입력 해석부 + 조회 응답/표시 mapper 가 요청 User.timezone 을 helper 에 전달. pr. (ADR-0052 §Decision (b))
