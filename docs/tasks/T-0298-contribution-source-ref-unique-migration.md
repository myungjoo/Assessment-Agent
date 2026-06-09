---
id: T-0298
title: Contribution `@@unique([assessmentId, sourceRef])` schema + migration (ADR-0033 §4 첫 구현 slice)
phase: P5
status: DONE
commitMode: pr
prNumber: 250
completedAt: 2026-06-09T18:02:00+09:00
result: DONE — PR #250 squash 149907b 머지. reviewer round1 APPROVE(0 BLOCKER/0 MAJOR/2 NIT-cosmetic) + 4-게이트 PASS + CI green(run 27195152523). @@unique([assessmentId, sourceRef]) + migration + R-112 test 7개. tasksCompleted 294→295.
coversReq: [REQ-029, REQ-031, REQ-032, REQ-064]
estimatedDiff: 90
estimatedFiles: 4
created: 2026-06-09
plannerNote: ADR-0033 §Follow-ups 첫 slice — Contribution `@@unique([assessmentId, sourceRef])` 추가 + `20260609000000_contribution_source_ref_unique` migration. ADR-0004 migrate-deploy 재사용 / dep 0 / credential 0. R-112 backbone×1.5 × P2002 sub×1.2.
---

# T-0298 — Contribution `@@unique([assessmentId, sourceRef])` schema + migration (ADR-0033 §4 첫 구현 slice)

## Why

ADR-0033 (PR #247 round2 APPROVE → 92309d7 머지) 가 P5 평가 결과 영속화의 데이터 모델·재평가 semantics·migration 전략을 박제했고, 그 §Follow-ups 가 dependency-free 구현 chain 의 **첫 slice** 로 "Prisma schema 1 줄 변경 + migration" 을 지정했다. 본 task 가 그 slice 다 — `Contribution` 모델에 `@@unique([assessmentId, sourceRef])` 1 줄을 박제하고 `20260609000000_contribution_source_ref_unique` migration 1 개를 생성한다.

이 unique index 가 필요한 이유는 ADR-0033 §4 가 정확히 명시한 대로 — Assessment-level idempotency (`@@unique([personId, period, scope, periodStart])`) 는 이미 존재하지만 **한 Assessment 안에서 동일 `unitId` (= `sourceRef`) 의 Contribution 중복** 은 schema 차원에서 막혀 있지 않다. 후속 write service slice 의 reset-and-recreate 트랜잭션이 이 schema-level backbone 위에서만 견고해진다. 본 slice 가 끝나야 후속 chain (매핑 함수 → write service → orchestrator/controller persist-return → doc-sync) 이 진입할 수 있다.

## Required Reading

- `docs/decisions/ADR-0033-evaluation-result-persistence.md` (특히 §Decision 4 + §Consequences Cross-Module Impact + §Follow-ups 첫 항목) — 본 slice 의 결정 source.
- `docs/decisions/ADR-0004-smoke-e2e-db-mode.md` — `pnpm prisma migrate deploy` + CI 실 PostgreSQL 16 container 패턴 (본 slice 가 재사용).
- `docs/decisions/ADR-0006-assessment-data-model.md` (§Decision §2 / §6) — Assessment·Contribution 의 immutable + cascade + 기존 `@@unique` backbone.
- `prisma/schema.prisma` L299–323 (Contribution 모델 정의) — 본 task 의 1 줄 추가 대상.
- `prisma/migrations/20260604000000_permission_denied_record/migration.sql` — migration 명명·구조 homolog 패턴 (Q-0019 PermissionDeniedRecord).
- `prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql` — Contribution 원 CREATE TABLE 의 컬럼 형식 / 기존 unique 패턴 mirror.
- `src/user/assessment.repository.ts` (L20–80) — 기존 P2002 propagation 정책 (호출자 catch X, AssessmentService 가 ConflictException 변환). 본 slice 는 이 정책을 **변경하지 않는다** — schema 만 추가, 매핑 변환은 후속 write service slice 책임.
- `src/user/assessment.repository.spec.ts` (L1–60 + 기존 P2002 테스트 ~L100~150) — 신규 negative 테스트의 colocated 위치 + buildPrismaMock 패턴.
- `.github/workflows/ci.yml` (migrate deploy step 부분) — 본 migration 이 자동 적용되는 step 확인 (변경 0).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 의 `Contribution` 모델 끝 (현재 L322 `assessment Assessment @relation(...)` 직후) 에 단 1 줄 `@@unique([assessmentId, sourceRef])` 추가. 추가 직전 주석 2~4 줄로 의도 (ADR-0033 §4: Assessment 안에서 동일 unitId Contribution 중복 차단 — REQ-031 재수집 중복 방지의 Contribution-level mirror, application-layer dedup 의 schema backbone) 박제. 다른 컬럼/관계/cascade 변경 0.
- [ ] `prisma/migrations/20260609000000_contribution_source_ref_unique/migration.sql` 신규 생성. 단일 `CREATE UNIQUE INDEX "Contribution_assessmentId_sourceRef_key" ON "Contribution"("assessmentId", "sourceRef");` SQL 1 줄 (+ 헤더 주석 1~2 줄). 새 table / 새 컬럼 / FK 변경 0.
- [ ] `prisma/migrations/migration_lock.toml` 변경 0 (provider 그대로).
- [ ] **R-112 happy path**: `assessment.repository.spec.ts` 에 신규 test "duplicate (assessmentId, sourceRef) 가 P2002 로 propagate" 추가 — PrismaService mock 의 `assessment.create` 가 `Prisma.PrismaClientKnownRequestError { code: "P2002" }` 를 throw 하는 시나리오를 nested Contribution[] 입력으로 구성, repository.create 가 catch 없이 그대로 throw 확인. happy path 측면 = "정상 unique 입력은 P2002 없이 통과" 1+ test.
- [ ] **R-112 error path**: 위 P2002 외에 추가로 (a) 빈 Contribution[] 입력 (assessmentId/sourceRef 충돌 표면 0) 은 P2002 미발생 1+ test, (b) `sourceRef` 가 동일하지만 `assessmentId` 가 다른 두 Contribution 은 unique 위반 아님 (다른 Assessment 의 동일 unitId 는 정상) 1+ test — 이는 mock 단에서 두 번의 별개 create 호출 시 P2002 미발생으로 검증.
- [ ] **R-112 branch / negative cases 충분 cover**: (분기 자체는 mock 패스만 — schema 강제는 DB-level. 분기 없음 항목 명시 가능). negative 추가 — (c) 동일 `(assessmentId, sourceRef)` 가 1 batch 안에서 2번 등장하는 입력의 mock 시나리오 1+ test (P2002 시뮬레이션), (d) `sourceRef` 가 빈 문자열인 두 Contribution 동시 입력은 schema 가 `String NOT NULL` 만 강제 + unique 는 빈 문자열 2 개도 충돌로 간주 → P2002 시뮬레이션 1+ test (운영 시 placeholder 빈 문자열 사용 risk 박제, 후속 write service slice 의 sanitize 책임 hint).
- [ ] **R-112 coverage 통과**: `pnpm test:cov` 실행 시 line ≥ 80% AND function ≥ 80% jest `coverageThreshold` 통과. assessment.repository.ts / .spec.ts 의 추가가 기존 coverage 를 떨어뜨리지 않음.
- [ ] `pnpm prisma format` (또는 lint 동등) 통과 — schema 정합. `pnpm build` 통과. `pnpm lint` 통과.
- [ ] CI (ADR-0004 migrate deploy step) 가 본 migration 을 자동 적용해 unit / smoke / e2e 가 모두 green. `pnpm test:smoke` / `pnpm test:e2e` 의 기존 Contribution 관련 fixture 가 중복 `sourceRef` 를 의도치 않게 만들지 않는지 확인 (기존 시나리오 영향 0 임을 PR 본문에 1 줄 명시).
- [ ] PR 본문에 ADR-0033 §4 / §Follow-ups 첫 항목 / ADR-0004 migrate-deploy 재사용 / 새 dep 0 / 새 credential 0 명시.

## Out of Scope

- AssessmentService / AssessmentRepository 의 P2002 → ConflictException 매핑 변경 — 기존 정책 (호출자 책임) 유지. Contribution-level P2002 도 동일 propagation 으로 두고, 도메인 의미 부여 (ConflictException with sourceRef context 등) 는 후속 **write service slice** 책임 (ADR-0033 §Follow-ups 3 번째 항목).
- `EvaluationResult → AssessmentCreateInput / ContributionCreateInput` 매핑 함수 작성 — ADR-0033 §Follow-ups 2 번째 slice.
- orchestrator / controller 의 persist-return 전환 — §Follow-ups 4 번째 slice.
- `data-model.md` / `modules.md` / `api.md` 의 본 변경 doc-sync — §Follow-ups 5 번째 slice (direct doc-only).
- ADR-0033 status PROPOSED → ACCEPTED flip — 별도 1 줄 direct task (T-0297 closeout 에서 분리 박제).
- Summary 영속화 — §Follow-ups deferred 항목.
- 새 외부 dependency 추가 / 새 credential 주입 — §5 게이트, 본 slice 미해당 (Prisma + DATABASE_URL 기존 재사용).
- backfill / data migration — 현 평가 영속 데이터 0 이므로 unique 추가에 backfill 불요 (ADR-0033 §Cross-Module Impact 박제).

## Suggested Sub-agents

`implementer → tester`

(architect 호출 불필요 — ADR-0033 §4 가 이미 결정·SQL 형태·migration 명을 박제했다. 본 slice 는 그 결정의 단순 박제.)

## Follow-ups

(비어 있음 — 매 sub-agent 가 작업 중 발견한 관련 항목을 여기 append.)
