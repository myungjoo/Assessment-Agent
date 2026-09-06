---
id: T-1920
title: 평가 partial-reset 의 Contribution cascade 동반 삭제 e2e 증명
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 190
estimatedFiles: 1
created: 2026-09-06
independentStream: assessment-evaluation-reset-e2e
dependsOn: []
touchesFiles:
  - test/e2e/assessment-evaluation-reset.e2e-spec.ts
plannerNote: P5 REQ-037 reset — T-1918 Follow-up (b) Contribution cascade 실 조회. 서비스 주석이 단언만 하고 test 0 인 축.
---

# T-1920 — 평가 partial-reset 의 Contribution cascade 동반 삭제 e2e 증명

## Why

**축 선택 근거.** 직전 fire 의 [T-1918](T-1918-reset-route-e2e-seeded-delete-roundtrip.md) 이 `Follow-ups (b)` 로 "Contribution cascade e2e — Assessment 삭제 시 `onDelete: Cascade` 로 하위 Contribution 이 함께 지워짐을 실 DB 로 확인(별도 slice)" 를 명시했고, 같은 사실이 머지된 spec 머리 주석 `37 행` 에도 `Out of Scope (2/2 에서도 유지): Contribution cascade 실 조회 — 별도 slice.` 로 박제돼 있다. 이 축은 **코드가 주석으로 단언만 하고 어떤 test 도 증명하지 않는 계약**이다 — `src/assessment-evaluation/evaluation-result-persist.service.ts` `141 행` ~ `142 행` 이 "component Contribution 은 `onDelete: Cascade` 동반 삭제" 라고 적었지만 unit spec 은 Prisma 를 mock 하므로 DB FK 를 검증할 수 없고, 실 DB e2e 에서도 아직 0 이다. 고아 Contribution 이 남으면 REQ-037 의 Reset & Reeval 재수집이 `@@unique([assessmentId, sourceRef])` 축을 잃은 중복 데이터 위에서 돌게 되므로 검증 가치가 계약적이다.

**issue-still-relevant pre-check (origin/main `b1d69ef8` 실측).** 본 slice 의 변경 의도가 아직 main 에 없음을 실측했다.

- `git grep -niE "cascade" origin/main -- test/` 의 hit 은 전부 **`truncateAll` 이 Person CASCADE 로 하위를 정리한다는 cleanup 주석**뿐이다 (`assessments.e2e-spec.ts` `25`·`103 행`, `contributions.e2e-spec.ts` `27`·`28`·`110`·`111 행`, `period-bridge-*.e2e-spec.ts` 등). **삭제 API 호출이 Contribution 을 동반 삭제한다**를 단언하는 케이스는 0 이다.
- `test/e2e/assessment-evaluation-reset.e2e-spec.ts` 는 `501 행` · `it` 17 개로 실재하지만 `prisma.contribution` 참조가 **0 건**이라 reset 왕복 후 Contribution 건수를 확인하는 케이스가 없다. 파일 `37 행` 이 이 축을 명시적으로 Out of Scope 로 남겨 두었다.
- 반대로 선행 산출물은 전부 안착했다 — schema `prisma/schema.prisma` `342 행` `assessment Assessment @relation(..., onDelete: Cascade)`, 실 DDL `prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql` `58 행` `ON DELETE CASCADE`, route `@Post("reset")`, seed helper `seedPersonWithRows`(spec `126 행`).

따라서 본 task 는 재큐잉이 아니다.

**REQ 재판정 없음.** `docs/requirements.md` `56 행` REQ-037 은 T-1919 에서 이미 `DONE (implemented-on-main — ...)` 으로 재판정됐다. 본 slice 는 그 DONE 판정의 회귀 방어일 뿐이므로 **requirements · PLAN 을 건드리지 않는다** — [docs/PLAN.md](../PLAN.md) `183 행` 오너 지시(REQ 재판정 왕복 제거, 구현 후 1 회만)를 그대로 지킨다.

**경쟁 축 배제.** PLAN `157 행` R-91 은 배포기기 자격증명 주입이 필요해 [CLAUDE.md](../../CLAUDE.md) `§5` HITL 게이트, `158 행` R-92 는 오너가 신규 per-route slice 큐잉을 금지한다. `109`·`110`·`161 행` 도 같은 자격증명 · 오너 게이트 축이다.

**cap · 소비처 판정.** production `src/` 변경 0 LOC · 새 helper 파일 신설 0 이라 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무는 해당 없다(소비처인 route 는 T-1916 에서 머지). 기존 spec 1 파일 증축이라 `testRegex` 자동 수집으로 등록 파일 수정 0 (Q-0054 동형 parity 사고 회피). 새 dependency 0 · 새 결정 0(따라서 새 ADR 0).

## Required Reading

- `test/e2e/assessment-evaluation-reset.e2e-spec.ts` — 증축 대상 전체 `501 행` 중 특히:
  - `1 행` ~ `38 행` 머리 주석 (1/2 · 2/2 책임 목록과 `37 행` 의 Out of Scope 문장 — 본 slice 가 닫는다).
  - `59 행` ~ `82 행` (`ROUTE` · `TARGET_PERSON_ID` · `VALID_PERIOD` · `validBody()` · `OTHER_PERIOD` · `WEEK_START` · `MONTH_START` · `SeedCoordinate` 타입).
  - `84 행` ~ `124 행` (`beforeAll` / `afterAll` / `afterEach(truncateAll + reseedAuthenticatedActors)`).
  - `126 행` ~ `164 행` `seedPersonWithRows` — Person → Assessment · Summary seed helper. 본 task 는 여기서 만든 Assessment id 를 알아야 Contribution 을 매달 수 있다(현 helper 는 Person id 만 반환).
  - `165 행` ~ `171 행` `postReset` 공용 호출부 (재사용).
  - `332 행` ~ `378 행` 기존 실 삭제 왕복 happy-path — 중복 케이스를 새로 만들지 않기 위한 경계.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` `140 행` ~ `152 행` — `resetByPeriod` 가 `assessment.deleteMany({ where: { personId, period } })` 만 호출하고 Contribution 을 **명시적으로 지우지 않는다**는 사실(= DB FK 가 유일한 방어선이라는 근거)과 `141 행` ~ `142 행` 의 주석 단언.
- `prisma/schema.prisma` `329 행` ~ `348 행` — `Contribution` 필수 컬럼(`assessmentId` · `sourceType` · `sourceUrl` · `sourceRef` · `difficulty` · `contributionScore` · `volume`) + `@@unique([assessmentId, sourceRef])` + `342 행` 의 `onDelete: Cascade`.
- `prisma/migrations/20260531000000_assessment_contribution_summary/migration.sql` `58 행` — 실 DDL 의 `ON DELETE CASCADE` (스키마 선언이 실제 제약으로 반영돼 있다는 근거).
- `test/e2e/contributions.e2e-spec.ts` `117 행` ~ `171 행` — `seedAssessment` / `seedContribution` 관행(필드 기본값 · `sourceRef` 중복 회피). 본 task 는 이 파일을 **수정하지 않고 패턴만 참고**한다.
- `test/helpers/db-truncate.ts` (전체) — `truncateAll` 의 CASCADE 범위(case 간 격리가 이미 보장된다는 근거).

## Acceptance Criteria

- [ ] `test/e2e/assessment-evaluation-reset.e2e-spec.ts` **1 파일만** 수정한다 (production `src/` 변경 0 LOC, 다른 spec · `test/helpers/*` · `test/jest-e2e.json` · `prisma/*` 수정 0, 신규 파일 0). 기존 `it` 17 개는 삭제 · 개작하지 않는다.
- [ ] Contribution seed 를 위해 **Assessment id 를 얻는 경로**를 만든다 — 기존 `seedPersonWithRows` 를 파괴하지 않는 방식으로(예: 생성된 Assessment id 배열을 함께 반환하도록 확장하거나, 별도의 작은 helper 를 파일 안에 추가). 기존 호출부 시그니처가 깨지면 안 된다.
- [ ] **happy-path (cascade 동반 삭제)** — 대상 Person 의 `week` 좌표에 Assessment 1 건 + 그 Assessment 에 매달린 Contribution 2 건을 seed 한 뒤 Admin 쿠키로 `period="week"` reset → 200 · `deletedAssessments === 1` 이고, **삭제 후 실 DB 조회로 그 `assessmentId` 의 Contribution 이 0 건**임을 단언한다(응답 숫자만이 아니라 `prisma.contribution.count({ where: { assessmentId } })` 로 확인).
- [ ] **응답 계약 경계** — 같은 케이스에서 응답 body 는 여전히 4 필드(`personId` · `period` · `deletedAssessments` · `deletedSummaries`)뿐이고 **Contribution 건수는 응답에 노출되지 않음**을 단언한다(cascade 는 DB 레벨이라 service 반환 count 에 포함되지 않는다는 경계 박제).
- [ ] **좌표 격리 (분기별 cover)** — 같은 Person 의 `month` 좌표 Assessment 에 매달린 Contribution 을 함께 seed 한 뒤 `week` 만 reset → `month` Assessment 의 Contribution 이 **건수 그대로 보존**됨을 실 DB 조회로 단언한다.
- [ ] **negative — 다른 person 격리** — 별개 Person 의 같은 `week` 좌표 Assessment + Contribution 을 seed 한 뒤 대상 Person 만 reset → 다른 Person 의 Contribution 이 보존됨을 단언한다.
- [ ] **negative — 오삭제 방지 (실패 경로가 Contribution 을 파괴하지 않음)** — seed 된 상태에서 (1) 허용 외 period(`"quarter"`) 요청 시 500 (2) User tier 쿠키 요청 시 403 이고, 두 경우 모두 **Contribution 이 한 건도 지워지지 않았음**을 실 DB count 로 단언한다(검증 · 인가 실패가 부분 파괴를 남기지 않는 회귀). 두 상황은 각각 별도 `it` 으로 분리해도 되고 한 `it` 안에서 순차 단언해도 된다.
- [ ] 새로 추가하는 `it` 은 **4 개 이내**로 유지한다. cap 압박 시 "다른 person 격리" 항목을 `Follow-ups` 로 미루고 나머지를 우선한다(전체 diff ≤ 300 LOC · 파일 1 개 유지).
- [ ] 머리 주석은 **10 행 이내**로만 증보한다 — 본 slice 의 책임(Contribution cascade 실 조회)을 추가하고, `37 행` 의 `Out of Scope (2/2 에서도 유지): Contribution cascade 실 조회 — 별도 slice.` 문장을 본 task 로 닫혔다고 정정한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`). e2e 는 unit coverage 집계 대상이 아니고 신규 production symbol 이 0 이므로 게이트는 기존 unit 으로 유지된다.
- [ ] 로컬에 `DATABASE_URL` 이 없어 e2e 를 돌릴 수 없으면 CI 의 `test:e2e` step 결과로 검증을 위임하고 그 사실을 tester trail 에 명시한다(실행하지 않은 것을 통과로 적지 않는다).

## Out of Scope

- `src/` 변경 일체 — controller · 두 persist service · DTO · module 을 있는 그대로 소비한다. 응답에 `deletedContributions` 를 추가하고 싶어도 본 task 에서 만들지 않고 `Follow-ups` 에 적는다(응답 계약 변경 = 새 결정).
- `prisma/schema.prisma` · `prisma/migrations/*` 수정 — cascade 는 이미 선언 · DDL 양쪽에 안착했고 본 task 는 그 사실의 **검증**만 한다.
- `docs/requirements.md` REQ-037 재판정 · PLAN `106 행` checkbox 변경 — T-1919 에서 이미 1 회 수행됐다(PLAN `183 행` 왕복 금지).
- 기존 e2e spec(`contributions.e2e-spec.ts` 등) · `test/helpers/*` · `test/jest-e2e.json` · `deploy/daily-test*` 수정 — 파생 drift-guard smoke spec 을 건드리면 파일 수 cap 이 깨진다(Q-0054 선례).
- Summary 쪽 하위 관계 · Person hard delete cascade · `truncateAll` 의 CASCADE 범위 재검증 — 다른 축이다.
- Admin UI(web) 노출 · 광역 reset · dry-run · 삭제 감사 로그 — 새 결정이 필요한 범위.
- 대량 row(수백 건) cascade 성능 측정 — 계약 검증이 목적이지 부하 측정이 아니다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) 응답에 `deletedContributions` 노출 여부 검토 — 현재 cascade 건수는 호출자에게 보이지 않는다. 노출하려면 응답 계약 변경(ADR 급 결정)이라 별도 판단.
