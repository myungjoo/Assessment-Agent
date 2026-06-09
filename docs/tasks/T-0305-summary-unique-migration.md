---
id: T-0305
title: Summary `@@unique([personId, period, periodStart])` schema + migration (ADR-0035 §Decision 4 첫 구현 slice)
phase: P5
status: DONE
commitMode: pr
prNumber: 256
completedAt: 2026-06-09T23:47:00+09:00
result: DONE — PR #256 squash fbca1e1 머지. Summary @@unique([personId, period, periodStart]) 1줄 + migration 20260609000001 + R-112 5 테스트(happy/P2002 rethrow/negative personId·period·periodStart 독립). implementer→tester(architect 불요). summary.repository.ts 100% cov. reviewer round1 APPROVE(1 NIT inline P2002 mock — idiom 정합, 비차단) + 4-게이트 PASS + CI green(run 27213998521, migrate-deploy+smoke+e2e 포함, approval-gate race rerun 후 success). reviewRounds[T-0305]=1. tasksCompleted 301→302. 새 외부 dependency 0 / credential 0.
coversReq: [REQ-034, REQ-035, REQ-036, REQ-064]
estimatedDiff: 95
estimatedFiles: 4
created: 2026-06-09
plannerNote: ADR-0035(da8089e 머지) §Follow-ups 첫 구현 slice — Summary `@@unique([personId, period, periodStart])` 1 줄 + `20260609000001_summary_person_period_start_unique` migration. T-0298(Contribution @@unique) 동형. Summary 는 이미 write path 존재(SummaryRepository.create / SummaryController POST /api/summaries / CreateSummaryDto, T-0113)라 R-112 P2002 propagation 을 summary.repository.spec.ts 에서 검증. ADR-0004 migrate-deploy 재사용 / dep 0 / credential 0. ADR-0035 §Decision 4 가 SQL·migration 명·idempotency key 박제했으므로 architect 불요(implementer→tester).
---

# T-0305 — Summary `@@unique([personId, period, periodStart])` schema + migration (ADR-0035 §Decision 4 첫 구현 slice)

## Why

ADR-0035 (PR #255 round1 APPROVE → da8089e 머지) 가 batch/aggregate 평가 + Summary 영속화의 설계를 박제했고, 그 §Follow-ups 가 dependency-free 구현 chain 의 **첫 slice** 로 "prisma `Summary` `@@unique` 추가 + migration" 을 지정했다. 본 task 가 그 slice 다 — `Summary` 모델에 `@@unique([personId, period, periodStart])` 1 줄을 박제하고 `20260609000001_summary_person_period_start_unique` migration 1 개를 생성한다.

이 unique index 가 필요한 이유는 ADR-0035 §Decision 4 가 명시한 대로 — aggregate 평가의 재집계 semantics 는 **`Summary` 단위 reset-and-recreate** 이며 idempotency key 가 `(personId, period, periodStart)` 다(한 person 의 한 granularity·구간 요약은 정확히 1 row). 현 `Summary` schema 는 `@@index([personId, period, periodStart])` 만 있고 `@@unique` 가 **부재**해 같은 좌표의 Summary 중복을 schema 차원에서 막지 못한다(ADR-0035 §Context 가 이 부재를 명시). 후속 aggregate write service slice 의 reset-and-recreate 트랜잭션이 이 schema-level backbone 위에서만 견고해진다. 본 slice 가 끝나야 후속 chain(aggregate 매핑/시점 판정 함수 → write service → orchestrator/controller batch endpoint → doc-sync)이 진입할 수 있다.

`Summary` 는 이미 write path 가 존재한다(`SummaryRepository.create` / `SummaryController` POST `/api/summaries` / `CreateSummaryDto`, T-0113) — 따라서 본 slice 의 R-112 P2002 propagation 검증은 **기존 `summary.repository.spec.ts` 에 colocate** 한다(T-0298 이 `assessment.repository.spec.ts` 에서 Contribution P2002 를 검증한 패턴과 동형).

## Required Reading

- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` (특히 §Decision 2 영속화 매핑 + §Decision 4 재집계 reset-and-recreate / idempotency key + §Context 의 `@@unique` 부재 명시 + §Cross-Module Impact) — 본 slice 의 결정 source.
- `docs/decisions/ADR-0004-smoke-e2e-db-mode.md` — `pnpm prisma migrate deploy` + CI 실 PostgreSQL 16 container 패턴(본 slice 가 재사용).
- `docs/decisions/ADR-0006-assessment-data-model.md` (§Decision §6) — Summary 의 immutable + Person N:1 cascade + 기존 `@@index` backbone.
- `prisma/schema.prisma` L341–355 (Summary 모델 정의) — 본 task 의 1 줄 추가 대상.
- `prisma/migrations/20260609000000_contribution_source_ref_unique/migration.sql` — 직전 동형 migration(T-0298). 명명·구조·SQL 형식 mirror 패턴.
- `prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql` — Summary 원 CREATE TABLE 의 컬럼 형식 / 기존 index 패턴 확인.
- `src/user/summary.repository.ts` — 기존 `prisma.summary.create` write path + P2002 propagation 정책(호출자 catch 여부). 본 slice 는 이 정책을 **변경하지 않는다** — schema 만 추가.
- `src/user/summary.repository.spec.ts` — 신규 negative 테스트의 colocated 위치 + PrismaService mock(buildPrismaMock 등) 패턴.
- `src/user/summary.service.ts` — P2002 → ConflictException 매핑이 service 에 있는지 확인(있으면 그 정책 유지, 본 slice 변경 0 — Out of Scope 경계).
- `.github/workflows/ci.yml` (migrate deploy step 부분) — 본 migration 이 자동 적용되는 step 확인(변경 0).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 의 `Summary` 모델 끝(현재 `@@index([personId, period, periodStart])` 직후)에 단 1 줄 `@@unique([personId, period, periodStart])` 추가. 추가 직전 주석 2~4 줄로 의도(ADR-0035 §Decision 4: 한 person 의 한 granularity·구간 요약은 1 row — 재집계 reset-and-recreate 의 idempotency key, application-layer aggregate 의 schema backbone) 박제. 다른 컬럼/관계/cascade/`@@index` 변경 0.
- [ ] `prisma/migrations/20260609000001_summary_person_period_start_unique/migration.sql` 신규 생성. 단일 `CREATE UNIQUE INDEX "Summary_personId_period_periodStart_key" ON "Summary"("personId", "period", "periodStart");` SQL 1 줄(+ 헤더 주석 1~2 줄). 새 table / 새 컬럼 / FK 변경 0.
- [ ] `prisma/migrations/migration_lock.toml` 변경 0 (provider 그대로).
- [ ] **R-112 happy path**: `summary.repository.spec.ts` 에 신규 test "정상 unique 입력(서로 다른 좌표)은 P2002 없이 통과" 1+ test (mock `summary.create` 가 정상 반환).
- [ ] **R-112 error path**: "duplicate `(personId, period, periodStart)` 가 P2002 로 propagate" — PrismaService mock 의 `summary.create` 가 `Prisma.PrismaClientKnownRequestError { code: "P2002" }` 를 throw 하는 시나리오에서 `SummaryRepository.create` 가 catch 없이 그대로 throw 확인 1+ test (기존 propagation 정책 유지 검증).
- [ ] **R-112 branch / negative cases 충분 cover** (예외 상황 분기마다 1+): (a) 동일 `period`+`periodStart` 지만 `personId` 가 다른 두 Summary 는 unique 위반 아님 1+ test, (b) 동일 `personId` 지만 `period` 가 다른(day vs week) 두 Summary 는 위반 아님 1+ test, (c) 동일 `personId`+`period` 지만 `periodStart` 가 다른 두 Summary 는 위반 아님 1+ test, (d) 동일 `(personId, period, periodStart)` 재집계(같은 좌표 2번) 의 P2002 시뮬레이션 1+ test (reset-and-recreate 전 단계의 raw insert 충돌). 분기 자체가 DB-level 강제라 mock 패스만인 항목은 명시.
- [ ] **R-112 coverage 통과**: `pnpm test:cov` line ≥ 80% AND function ≥ 80% jest `coverageThreshold` 통과. summary.repository.ts / .spec.ts 추가가 기존 coverage 를 떨어뜨리지 않음.
- [ ] `pnpm prisma format` 통과(schema 정합) + `pnpm build` + `pnpm lint` 통과.
- [ ] CI(ADR-0004 migrate deploy step)가 본 migration 을 자동 적용해 unit / smoke / e2e 가 모두 green. `pnpm test:smoke` / `pnpm test:e2e` 의 기존 Summary fixture 가 중복 `(personId, period, periodStart)` 를 의도치 않게 만들지 않는지 확인(기존 시나리오 영향 0 임을 PR 본문에 1 줄 명시).
- [ ] PR 본문에 ADR-0035 §Decision 4 / §Follow-ups 첫 항목 / ADR-0004 migrate-deploy 재사용 / 새 dep 0 / 새 credential 0 명시.

## Out of Scope

- aggregate 매핑 함수(`Contribution[]`/`EvaluationResult[]` → `SummaryCreateInput` deterministic 집계) + `isPeriodEvaluable(period, periodStart, now)` 시점 판정 함수 — ADR-0035 §Follow-ups 의 다음 slice(pure functions).
- aggregate 평가 write service(Summary reset-and-recreate + fill/reeval + partial-reset + batch LLM narrative) — §Follow-ups write service slice.
- orchestrator / controller batch 평가 endpoint 배선 — §Follow-ups 배선 slice.
- `data-model.md` / `modules.md` / `api.md` doc-sync — §Follow-ups doc-sync slice(direct).
- ADR-0035 status PROPOSED → ACCEPTED flip — 별도 task(구현 chain 검증 후 마지막, ADR-0033→T-0303 패턴).
- `SummaryService` / `SummaryRepository` 의 P2002 → ConflictException 매핑 변경 — 기존 정책 유지(schema 만 추가). aggregate write service 의 도메인 의미 부여는 후속 write service slice 책임.
- backfill / data migration — 현 Summary 영속 데이터 0 이므로 unique 추가에 backfill 불요(ADR-0035 §Consequences 박제).
- 새 외부 dependency / 새 credential — §5 게이트, 본 slice 미해당(Prisma + DATABASE_URL 기존 재사용).

## Suggested Sub-agents

`implementer → tester`

(architect 호출 불필요 — ADR-0035 §Decision 4 가 이미 결정·SQL 형태·migration 명·idempotency key 를 박제했다. 본 slice 는 그 결정의 단순 박제 — T-0298 동형.)

## Follow-ups

(비어 있음 — 매 sub-agent 가 작업 중 발견한 관련 항목을 여기 append.)
