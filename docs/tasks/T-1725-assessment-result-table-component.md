---
id: T-1725
title: backend 필드 정합 평가 결과 표 컴포넌트 AssessmentResultTable 신설 (표시 컬럼 재설계)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-075]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1724]
touchesFiles:
  - web/src/components/AssessmentResultTable.tsx
  - web/src/components/AssessmentResultTable.test.tsx
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-27
completedAt: 2026-08-26T18:56:28Z
prNumber: 1355
mergeCommit: e1843e80
plannerNote: P6 오너지시 PLAN 131행 ② 분해 slice 2 — T-1724 helper 를 소비할 표시 컬럼을 presentational 로 먼저 박제, DashboardView 배선은 slice 3
---

# T-1725 — backend 필드 정합 평가 결과 표 컴포넌트 `AssessmentResultTable` 신설 (표시 컬럼 재설계)

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` 🔴 ② ([requirements.md](../requirements.md) `94 행` REQ-075) 의 분해 slice 2 다. 직전 T-1724 가 backend `GET /api/assessments` 응답을 표시 행으로 옮기는 순수 helper ([assessmentRow.ts](../../web/src/api/assessmentRow.ts), `AssessmentDisplayRow` + 함수 3 개) 를 박제했으나 **소비처가 0** 이다 — 현행 표 컴포넌트 [EvaluationResultTable.tsx](../../web/src/components/EvaluationResultTable.tsx) `9~27 행` 은 `subjectName` / `metricLabel` / `score` 3 컬럼만 렌더해 backend 필드 (`period` / `scope` / `periodStart` / `difficulty` / `contributionScore` / `volume`) 를 **표시할 수단 자체가 없다**.

본 slice 는 그 표시 컬럼을 재설계한 **새 presentational 컴포넌트만** 신설한다. 기존 `EvaluationResultTable` 의 row 계약을 파괴적으로 바꾸면 그것을 소비하는 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) (`sortRows` · `filterRows` · `deriveMetrics` · `deriveScoreBuckets` · `handleHeaderSort` 전부가 `EvaluationResultRow` 키에 결합) 를 같은 commit 에서 함께 고쳐야 해 §3 크기 상한 (300 LOC / 5 파일) 을 넘는다. 그래서 T-1722 (컴포넌트) → T-1723 (배선) 의 2 단 분해 선례를 그대로 승계해, 본 task 는 컴포넌트 + colocated spec 2 파일만 남기고 **`DashboardView` 배선과 기존 `EvaluationResultTable` 처리는 다음 slice 로 미룬다**.

## Required Reading

- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 9 필드 · `ASSESSMENT_DISPLAY_ROW_KEYS` · 숫자 축 `null` 정책 (T-1724 가 박제한 소비 계약, 본 task 는 이 파일을 **수정하지 않는다**)
- [web/src/components/EvaluationResultTable.tsx](../../web/src/components/EvaluationResultTable.tsx) 전문 (109 행) — loading 우선 분기 · 빈 상태 `role="status"` · `aria-sort` 부여 규칙 · `onSortChange` controlled convention · `export type` + default export 형태 (본 task 는 이 파일도 **수정하지 않는다** — convention 승계용)
- [web/src/components/EvaluationResultTable.test.tsx](../../web/src/components/EvaluationResultTable.test.tsx) — `renderToStaticMarkup` 정적 렌더 검증 패턴 (@testing-library 부재, ADR-0040 §5) 과 케이스 분할 관례
- [web/src/components/DashboardPersonSelector.tsx](../../web/src/components/DashboardPersonSelector.tsx) — 직전 T-1722 가 박제한 presentational 컴포넌트 + 순수 named export 동거 형태
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) — Decision 1 (presentational 은 fetch 를 모른다) · Decision 3 (컨테이너가 data/loading/error 소유)
- [docs/architecture/api.md](../architecture/api.md) `93 행` — `GET /api/assessments` 응답 계약 (표시 컬럼 선정 근거)

## Acceptance Criteria

- [ ] `web/src/components/AssessmentResultTable.tsx` 신설 — `fetch` · `useApiResource` · 전역 상태 import **0** 인 controlled presentational 컴포넌트. 새 dependency 0, `throw` 신설 0, props mutation 0.
- [ ] 표시 컬럼은 `AssessmentDisplayRow` 기준 **6 개** — `period`(기간) · `scope`(범위) · `periodStart`(시작) · `difficulty`(난이도) · `contributionScore`(기여 점수) · `volume`(업무량). `id` · `personId` 는 내부 식별자라 컬럼에서 제외하고, `narrative` 는 장문이라 표가 아닌 상세 패널 축이므로 제외한다 (이 3 개 제외 사유를 파일 상단 한국어 주석으로 명시).
- [ ] named export 3 개 + default export 1 개: `ASSESSMENT_TABLE_COLUMNS` (컬럼 키 + 한국어 라벨 배열) · `formatCellValue(row: AssessmentDisplayRow, key: AssessmentSortKey): string` (순수 함수 — 숫자 `null` 은 `'—'`, 빈 문자열도 `'—'`, 숫자는 문자열화, 어떤 입력에도 throw 0) · `export type { AssessmentSortKey, AssessmentResultTableProps }` · default `AssessmentResultTable`.
- [ ] 렌더 분기는 기존 `EvaluationResultTable` convention 승계 — ① `loading === true` 면 rows 유무와 무관하게 `role="status"` 로딩 문구 우선 ② `rows.length === 0` 이면 `role="status"` 빈 상태 문구 (`emptyMessage` 가 빈 문자열이면 기본 문구 fallback) ③ 그 외 `<table>` 렌더. `sortKey` 와 일치하고 `sortDirection` 이 주어진 헤더에만 `aria-sort` 부여, `onSortChange` 가 함수일 때만 헤더에 클릭 핸들러 부착.
- [ ] 정렬·필터·페이지네이션 **로직은 수행하지 않는다** — props 의 `rows` 순서를 그대로 렌더 (상위 컨테이너 책임, ADR-0041 Decision 1).
- [ ] colocated spec `web/src/components/AssessmentResultTable.test.tsx` 신설 (CLAUDE.md §3.2 R-112 4 종 cover):
  - [ ] **happy-path** — 완전한 `AssessmentDisplayRow` 2 건이 6 컬럼 헤더 + 6 셀로 렌더되고 값이 모두 마크업에 나타나는 test 1+, `formatCellValue` happy 1+, `ASSESSMENT_TABLE_COLUMNS` 구성 1+.
  - [ ] **error path** — `onSortChange` 미전달 시 헤더 클릭 핸들러 부재 (렌더 자체가 throw 0) · `emptyMessage=''` 가 기본 문구로 fallback 하는 test 각 1+.
  - [ ] **분기 cover** — loading true / rows 빈 배열 / populated 3 갈래, `aria-sort` 부여 3 갈래(`sortKey` 일치+`asc` / 일치+`desc` / `sortDirection` 미전달 시 미부여), `formatCellValue` 의 숫자 / `null` / 빈 문자열 / 문자열 4 갈래 각 1+ test.
  - [ ] **negative cases 충분 cover** — `contributionScore: null` · `volume: null` 이 `'—'` 로 렌더되고 `'null'` · `'NaN'` · `'undefined'` 문자열이 마크업에 노출되지 않음 · `Object.freeze` 된 rows 입력에도 throw 0 · 입력 배열/객체 mutation 0 · `sortKey` 가 미지의 값이어도 헤더 렌더 정상 · loading true 이면서 rows 비어있지 않아도 로딩 우선 각 1+ test.
  - [ ] **계약 drift guard** — `ASSESSMENT_TABLE_COLUMNS` 의 키 집합이 [assessmentRow.ts](../../web/src/api/assessmentRow.ts) 의 `ASSESSMENT_DISPLAY_ROW_KEYS` 의 부분집합이며 제외 3 키(`id` · `personId` · `narrative`) 를 정확히 뺀 것임을 고정하는 test 1+ (helper 필드 변경 시 fail).
- [ ] `pnpm --dir web test` green (기존 web spec 회귀 0), `pnpm --dir web build` green, `pnpm lint` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` · `test/` · `prisma/` · `.github/workflows/` · `package.json` diff **0 파일** 이라 backend coverage 불변임을 확인한다.
- [ ] `web/src/views/DashboardView.tsx` · `web/src/components/EvaluationResultTable.tsx` · `web/src/api/assessmentRow.ts` diff **0 파일**.

## Out of Scope

- `DashboardView` 배선 (`deriveAssessmentDisplayRows` 소비 · `visibleRows` · `sortRows` · `filterRows` · `deriveMetrics` · `deriveScoreBuckets` 의 새 row 계약 전환 · 표 컴포넌트 교체) — 다음 slice.
- 기존 `EvaluationResultTable` 의 수정 · 삭제 · deprecate 표기 (배선 완료 후 소비처 0 이 확인된 뒤 별도 slice).
- `narrative` 상세 패널 렌더 · 행 선택 콜백 prop 신설.
- 점수 분포 축의 실 `metricScore` 스케일 정합 (REQ-076, PLAN `131 행` ③).
- 기간(일/주/월 + 시작) 지정 UI 와 `POST /api/assessment-evaluation/period` 호출 경로 (REQ-077, PLAN `131 행` ④).
- `GET /api/contributions` · `GET /api/summaries` 표시 계약 정합 — 별도 slice.
- backend `src/` 변경 · 응답 shape 변경 · e2e (`test/e2e/`) 추가 · CSS/스타일 도입 (PLAN `134 행` ①).
- [requirements.md](../requirements.md) `94 행` REQ-075 상태 갱신 — 배선 완료 후 doc-only `direct` 후속.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
