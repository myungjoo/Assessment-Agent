# T-0110 reviewer 검토 상세 (PR-109, round 1)

reviewer agent — README 117–128 8-check + CLAUDE.md §12 + task-specific (i)~(v) 적용. integrator 가 reviewer 역을 겸해 수행 (local /loop fallback).

## 대상

- PR-109 / branch `claude/T-0110-prisma-assessment-contribution-summary-schema` / commit `ca9a01b`.
- diff = 3 파일 (+367 insertions, ~235 substantive): `prisma/schema.prisma` (+103), `prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql` (+61), `prisma-schema.spec.ts` (+203).

## task-specific check (i)~(v)

### (i) Prisma schema ↔ ADR-0006 컬럼/type/relation/@@unique/@@index/cascade 1:1 정합 — PASS

- **Assessment** (schema L224–247): `id`/`personId`/`period`/`scope`/`periodStart`/`difficulty`/`contributionScore Decimal`/`volume Int`/`narrative`/`createdAt` — ADR-0006 Decision §1 표와 컬럼·type 1:1. `updatedAt` 부재 (immutable, Decision §1 정합). Person N:1 `onDelete: Cascade` (Decision §6). `@@unique([personId, period, scope, periodStart])` (Decision §6 backbone) + `@@index([personId, period, periodStart])` (Decision §6 후보). `contributions Contribution[]` back-relation. ✓
- **Contribution** (schema L259–273): `id`/`assessmentId`/`sourceType`/`sourceUrl`/`sourceRef`/`difficulty`/`contributionScore Decimal`/`volume Int`/`createdAt` — Decision §2 1:1. Assessment N:1 `onDelete: Cascade` (Decision §6). raw 컬럼 0, `updatedAt` 부재. ✓
- **Summary** (schema L285–299): `id`/`personId`/`period`/`periodStart`/`narrative`/`metricScore Decimal`/`createdAt` — Decision §3 1:1. Person N:1 `onDelete: Cascade`. `@@index([personId, period, periodStart])`. `updatedAt` 부재. ✓
- **Person back-relation** (schema L88–89): `assessments Assessment[]` + `summaries Summary[]` — Prisma 양방향 relation 요건 충족. ✓
- 컬럼/type/제약 모두 ADR-0006 결정과 drift 0. 임의 추가 컬럼 0.

### (ii) raw 본문 컬럼 ABSENT (R-59 schema-level 강제) — PASS

- 3 model 어디에도 commit body / diff / 문서 본문 / Confluence page body 컬럼 부재. schema 주석(L210–215 / L253–256 / L280–281)이 부재 의도 명시 박제. spec 의 negative test (FORBIDDEN_RAW_FIELDS 12 종 × 3 model) 가 regression 안전망. ✓
- `narrative` 는 LLM 생성 결과물 (R-59 적용 외, ADR-0006 Decision §4 정합). Contribution 의 `sourceUrl`/`sourceRef` 는 참조 식별자 (pointer, 본문 아님). ✓

### (iii) migration SQL ↔ schema 정합 — PASS (apply 검증은 CI)

- migration.sql 3 CreateTable 컬럼·type (TEXT / TIMESTAMP(3) / DECIMAL(65,30) / INTEGER) 이 schema model 과 일치. DECIMAL(65,30) 은 Prisma 의 `Decimal` default (precision 미지정 → ADR-0006 Out of Scope "default 로 시작" 정합).
- CreateIndex: Assessment `_personId_period_periodStart_idx` + `_personId_period_scope_periodStart_key` (UNIQUE) + Summary `_personId_period_periodStart_idx` — schema `@@index`/`@@unique` 와 1:1.
- AddForeignKey 3 종 모두 `ON DELETE CASCADE` — schema relation 정합. Assessment→Person, Contribution→Assessment, Summary→Person.
- migration 은 offline (`prisma migrate diff`) 생성 — 실 apply 가능 여부는 CI 의 **`Prisma migrate deploy` step** (ci.yml L96–103, services.postgres 16 대상) 이 검증. CI green = apply 성공.

### (iv) spec 유의미성 (happy + negative 포함 raw 부재) — PASS

- (a) happy: PrismaClient delegate 노출 + DMMF 3 model 포함 + 각 model 결과 컬럼 단언 (updatedAt 부재 단언 포함).
- (b) negative: FORBIDDEN_RAW_FIELDS 12 종 × 3 model `not.toContain` (R-59 regression) + Contribution 참조 식별자만 보유 단언.
- (c) negative 안전망: relation (object kind) 존재 + `@@unique`/`@@index`(2+) schema 원문 매칭 + cascade(3+) + Decimal 단언. ADR-0006 결정과 schema drift 차단.
- 분기 없는 schema 라 branch coverage 항목은 R-112 단서대로 생략 명시 (spec 헤더 L4–5). 적절.

### (v) spec 파일 위치 (repo root `prisma-schema.spec.ts`) — ACCEPTABLE (move 불요)

- jest config (`rootDir: "."`, `testRegex: ".*\.spec\.ts$"`) 가 repo root 의 `.spec.ts` 를 unit run 에 포함 → orphan 아님, `pnpm test` 가 실행. ✓
- spec 의 `join(__dirname, "prisma", "schema.prisma")` 는 `__dirname` = repo root 이므로 정확히 resolve. ✓
- `collectCoverageFrom: ["src/**/*.(t|j)s"]` 라 root 의 spec/schema 가 coverage source 0 → "schema-only, coverage 변동 0" 주장 정합. ✓
- MINOR(비차단) 의견: 향후 schema spec 이 늘면 `test/schema/` 로 colocate 권장 (task AC 도 "예: test/schema/... 또는 colocated 적절 위치" 로 양자 허용). 현 1 파일은 root 로 충분 — 본 round 차단 사유 아님.

## README 117–128 8-check 요약

- 정확성/완전성: ADR-0006 1:1 — PASS. 보안: raw 미저장 강화, secret 0 — PASS. test 적정성: happy+negative 충분 — PASS. 명세 정합: AC 전 항목 충족 (coverage 변동 0 / smoke·e2e 확장 없음은 task 가 명시 허용) — PASS. Out of Scope: service/repo/controller/DTO 0 (diff 3 파일 schema+migration+spec only) — PASS. §12 언어: commit subject prefix 영어 + 본문/주석/PR 한국어 — PASS. trail blob: commit body 표준 포맷 — PASS (별도 확인).

## VERDICT

**APPROVE** — ADR-0006 1:1 구현, raw 미저장 schema-level 강제 확인, migration↔schema 정합 (실 apply 는 CI migrate deploy 가 검증), spec 유의미 (happy+negative), Out of Scope 무위반. spec root 배치는 jest config 상 acceptable. round 1 승인.
