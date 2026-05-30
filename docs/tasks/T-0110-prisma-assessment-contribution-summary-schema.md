---
id: T-0110
title: prisma/schema.prisma 에 Assessment/Contribution/Summary 3 model + relation + migration 추가 (ADR-0006 구현 first slice)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036]
estimatedDiff: 180
actualDiff: 367
estimatedFiles: 4
actualFiles: 3
created: 2026-05-31
completedAt: 2026-05-31
prNumber: 109
mergedAs: e076c92
reviewRounds: 1
plannerNote: P3 backbone — ADR-0006 reviewer 사인오프 완료 → §5 DB-schema 해소된 additive schema. 3 model + relation + migration only, service/repo/controller 는 T-0111+ defer.
---

# T-0110 — prisma/schema.prisma 에 Assessment/Contribution/Summary 3 model 추가 (ADR-0006 구현 first slice)

## Why

[PLAN.md](../PLAN.md) Phase P3 의 "평가 결과 저장 모델 (commit/document 단위, 일/주/월 요약)" + "🔥 Raw data 저장 금지 (R-59)" + "상대 비교 가능 데이터 구조 (R-63)" bullet (L57–59) 을 구현하는 backbone 첫 slice 다. 직전 머지된 [ADR-0006](../decisions/ADR-0006-assessment-data-model.md) (PR-108, sha b9fd482) 이 3 entity 의 구체 컬럼·type·`@@unique`·cascade·hard-delete 를 reviewer 사인오프와 함께 결정 박제했고, 그 결정의 "후속 구현 task chain" 표가 본 task 를 **T-0110 candidate = `prisma/schema.prisma` 에 3 model 추가 + migration** 로 명시한다. ADR 머지로 [CLAUDE.md §5](../../CLAUDE.md) DB-schema BLOCKED 게이트가 해소됐으므로 본 task 는 일반 additive pr-mode schema task 다 (기존 데이터 migration 0 — Person/ServiceIdentity/Group/Part/User 와 동일 패턴).

## Required Reading

- [docs/decisions/ADR-0006-assessment-data-model.md](../decisions/ADR-0006-assessment-data-model.md) — **single source of truth**. Decision §1~§6 의 컬럼명·type·`@@unique`·`@@index`·cascade·hard-delete 를 그대로 구현. 임의 컬럼 추가/변경 금지 (ADR 결정과 1:1).
- [prisma/schema.prisma](../../prisma/schema.prisma) — 기존 6 entity (Person/ServiceIdentity/Group/Part/PersonGroupMembership/User) 의 `id String @id @default(cuid())` + `createdAt DateTime @default(now())` + `@@unique` + `onDelete: Cascade` 패턴. 본 3 model 이 1:1 mirror. Person model 에 Assessment/Summary back-relation 필드 추가 필요.
- [prisma/migrations/20260528000000_user/migration.sql](../../prisma/migrations/20260528000000_user/migration.sql) — hand-authored timestamped SQL migration convention (CreateTable + CreateIndex + AddForeignKey). 본 task 의 신규 migration 디렉토리가 동 형식.
- [docs/architecture/data-model.md](../architecture/data-model.md) §2 (Assessment/Contribution/Summary 행) / §3 (관계 4·5·6) / §4 (raw 미저장 invariant) — conceptual 정합 확인용 (구체 결정은 ADR-0006 우선).

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 에 **Assessment model** 추가 — ADR-0006 Decision §1 의 컬럼 (`id`/`personId`/`period`/`scope`/`periodStart`/`difficulty`/`contributionScore Decimal`/`volume Int`/`narrative`/`createdAt`) + Person N:1 relation (`onDelete: Cascade`) + `@@unique([personId, period, scope, periodStart])` + `@@index([personId, period, periodStart])`. `updatedAt` 미정의 (immutable).
- [ ] `prisma/schema.prisma` 에 **Contribution model** 추가 — Decision §2 컬럼 (`id`/`assessmentId`/`sourceType`/`sourceUrl`/`sourceRef`/`difficulty`/`contributionScore Decimal`/`volume Int`/`createdAt`) + Assessment N:1 relation (`onDelete: Cascade`). raw 본문 컬럼 0. `updatedAt` 미정의.
- [ ] `prisma/schema.prisma` 에 **Summary model** 추가 — Decision §3 컬럼 (`id`/`personId`/`period`/`periodStart`/`narrative`/`metricScore Decimal`/`createdAt`) + Person N:1 relation (`onDelete: Cascade`) + `@@index([personId, period, periodStart])`. `updatedAt` 미정의.
- [ ] Person model 에 back-relation 필드 (`assessments Assessment[]`, `summaries Summary[]`) + Assessment model 에 `contributions Contribution[]` back-relation 추가 (Prisma 양방향 relation 요건). 주석은 한국어, 기존 schema 주석 스타일 mirror.
- [ ] **raw 본문 컬럼 0 검증** — 3 model 어디에도 commit body / diff / 문서 본문 / Confluence page 본문 컬럼이 없음을 spec 또는 schema 주석으로 명시 (R-59 schema-level 강제, ADR-0006 Decision §4).
- [ ] 새 migration 디렉토리 `prisma/migrations/<timestamp>_assessment_contribution_summary/migration.sql` 추가 — 기존 user migration 형식 (CreateTable + CreateIndex + AddForeignKey) mirror. `pnpm prisma validate` 통과 (schema 문법 유효).
- [ ] **R-112 schema-validation test (분기 없는 schema 라 happy-path + negative 중심)**: 신규 spec (예: `test/schema/assessment-schema.spec.ts` 또는 colocated 적절 위치) 로 (a) PrismaClient type 에 `assessment`/`contribution`/`summary` delegate 가 존재 (happy-path), (b) Assessment/Contribution/Summary type 에 raw 본문 필드 (`commitBody`/`diff`/`pageBody` 등) 가 **존재하지 않음** 을 type-level 또는 model field 열거로 검증 (negative — R-59 regression 방지). 본 task 에 분기 로직 production 코드는 없음 — branch coverage 항목은 "schema 선언만, 분기 없음 — 이 항목 생략" 명시.
- [ ] negative 충분 cover — raw 컬럼 부재 검증 (위 b) + 3 model 각각의 `@@unique`/relation 존재를 1+ 씩 단언 (잘못 정의 시 fail 하는 안전망).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 단 본 task 가 production runtime 함수를 추가하지 않으면 (schema-only) coverage 변동 0 이 정상. PR 본문에 "schema 선언만 — 신규 runtime 함수 0, coverage 변동 0" 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` (R-110 tester 의무) + `pnpm prisma generate` 가 신규 type 을 무오류 생성.
- [ ] R-113 — 본 task 는 schema-only 라 smoke/e2e 신규 시나리오 불요. 단 기존 smoke/e2e suite 가 신규 model 로 인해 깨지지 않음을 확인 (회귀 0). PR 본문에 "Assessment/Contribution/Summary endpoint 는 T-0112+ 책임 — 본 task smoke/e2e 확장 없음" 명시.

## Out of Scope

- **AssessmentService / repository / CRUD 로직** — ADR-0006 후속 표의 T-0111 candidate. 본 task 는 schema 선언 + migration + schema-validation spec 까지만.
- **AssessmentController / DTO / endpoint** — T-0112 candidate.
- **`@db.Decimal(p,s)` 의 구체 precision/scale 확정** — ADR-0006 Decision §5 가 "후속 schema task 책임" 으로 defer 하나, precision 미지정 default 로 시작하고 query pattern 확정 후 별도 task. 본 task 에서 임의 precision 박제 금지.
- **`@@index` 최종 확정 / 추가 index** — ADR-0006 이 박제한 후보 index 만 추가. query pattern 기반 추가 index 는 후속.
- **Group/Part aggregate Summary entity** — ADR-0006 Alternatives (c) defer (view-time 계산). 신설 0.
- **timezone (UTC/KST) / audit-source (createdBy) cross-cutting field** — ADR-0006 Out of Scope, 별도 doc-only ADR 책임.
- **CI real-PostgreSQL 전환** (PLAN L66, ADR-0004) — 별개 task line.
- data-model.md §2 REQ-063→REQ-036 정정 / INDEX.md ADR row 추가 — 별도 doc-only direct follow-up (아래 Follow-ups).

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 schema 결정을 이미 박제, 재결정 불요).

## Follow-ups

- (planner 박제) **T-0111 candidate** — AssessmentService / repository (CRUD + raw 미저장 invariant unit test). dependsOn T-0110.
- (planner 박제) **T-0112 candidate** — AssessmentController + DTO + endpoint + e2e. dependsOn T-0111.
- (T-0109 executor flagged) doc-only direct cleanup: (1) [data-model.md](../architecture/data-model.md) §2 Assessment 행 REQ-063 인용 → REQ-036 정정 + ADR-0006 link, (2) [docs/decisions/INDEX.md](../decisions/INDEX.md) ADR 매핑 표에 ADR-0004/0005/0006/0008 row 추가 (현재 ADR-0001~0003 만 stale).
- (planner 박제) `@db.Decimal(p,s)` precision/scale 확정 + query-pattern 기반 추가 `@@index` 검토 task (query 요구 확정 후).
