---
id: T-1727
title: DashboardView 행 파이프라인·결과 표를 AssessmentDisplayRow 계약으로 교체 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-075]
independentStream: p6-dashboard-actual-behavior
dependsOn: [T-1724, T-1725, T-1726]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.test.tsx
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-27
plannerNote: P6 오너지시 PLAN 131행 ② 분해 slice 3b — 3 slice(T-1724~T-1726)로 준비된 새 행 계약을 DashboardView 가 실제 소비하도록 배선
---

# T-1727 — DashboardView 행 파이프라인·결과 표를 AssessmentDisplayRow 계약으로 교체 배선

## Why

[PLAN.md](../PLAN.md) `131 행` 🔴 오너 지시 ② ([requirements.md](../requirements.md) `94 행` REQ-075) 의 분해 slice 3b 다. slice 1 (T-1724) 이 매핑 helper `deriveAssessmentDisplayRows`, slice 2 (T-1725) 가 표시 컴포넌트 `AssessmentResultTable`, slice 3a (T-1726) 가 정렬·검색 순수 모듈 `assessmentRowOps` 를 박제했으나 **셋 다 소비처가 0** 이다 (web 전체에서 `deriveAssessmentDisplayRows` · `AssessmentResultTable` · `sortAssessmentRows` import 0). 그 사이 실제 화면인 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 는 여전히 옛 행 계약 `EvaluationResultRow{subjectName,metricLabel,score}` 로 `GET /api/assessments` 응답을 해석해, backend 가 실제로 돌려주는 `volume · difficulty · contributionScore · narrative · period/periodStart` 가 화면에 **한 칸도 렌더되지 않는다** (모든 셀이 `undefined`).

본 slice 가 그 셋을 실제로 소비해 **실데이터 렌더** 를 성립시킨다 — 준비된 조각을 더 쌓지 않고 배선으로 전환하는 지점이다. 단 요약 지표·점수 분포의 **축 스케일 정합** (REQ-076) 까지 한 commit 에 넣으면 §3 크기 상한 (300 LOC / 5 파일) 을 넘으므로, 그 두 helper 는 **시그니처를 바꾸지 않고** 얇은 브리지 (`toLegacyScoreRows`) 로 이어 두고 후속 slice 로 넘긴다. 이 경계가 본 task 의 diff 를 2 파일로 묶는 핵심 장치다.

## Required Reading

- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 전체. 특히 `SORT_OPTIONS` (`48~53 행`), `filterRows` · `sortRows` (`285~318 행`), `deriveMetrics` · `deriveScoreBuckets` (본 task 는 **수정 금지**), `visibleRows` 파생, 표·선택 `<select>`·`EvaluationDetailPanel` 렌더부, 파일 말미 `export { ... }` 목록.
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) — `AssessmentDisplayRow` 9 키 · `deriveAssessmentDisplayRows(raw: unknown)` (배열 아닌 입력·결손 행 흡수, throw 0) · 숫자 축 `null` 정책 (값 없음 ≠ 0 점).
- [web/src/api/assessmentRowOps.ts](../../web/src/api/assessmentRowOps.ts) — `ASSESSMENT_SORTABLE_KEYS` · `AssessmentRowSortKey` · `filterAssessmentRows` · `sortAssessmentRows` 시그니처와 계약 (비파괴 정렬, `null` 은 항상 마지막, 빈 검색어 전체 통과).
- [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `18~30 행` + `60~136 행` — `ASSESSMENT_TABLE_COLUMNS` (키·한국어 라벨 6 개) · props (`rows` · `sortKey` · `sortDirection` · `onSortChange` · `loading` · `emptyMessage`) · loading 우선 · 빈 상태 분기.
- [web/src/views/DashboardView.test.tsx](../../web/src/views/DashboardView.test.tsx) — `SAMPLE` fixture (`94~98 행`), `sortRows`/`filterRows` 를 직접 부르는 `it` 2 개 (`186~208 행` 부근), 표 내용을 검사하는 렌더 assertion 위치.
- [web/src/views/DashboardView.person-selector.test.tsx](../../web/src/views/DashboardView.person-selector.test.tsx) — 조회 path 만 검사해 행 형태에 비의존 (본 task 에서 **수정 0** 이어야 함을 확인용).

## Acceptance Criteria

- [ ] `useApiResource<EvaluationResultRow[]>(path)` → `useApiResource<unknown[]>(path)` 로 바꾸고, `visibleRows` 를 `sortAssessmentRows(filterAssessmentRows(deriveAssessmentDisplayRows(data), searchTerm), sortKey, sortDirection)` 로 파생한다 (타입 `AssessmentDisplayRow[]`). 컨테이너 안에서 응답을 직접 캐스팅·정규화하지 않는다 (매핑 책임은 `assessmentRow.ts`).
- [ ] 컨테이너 지역 함수 `filterRows` · `sortRows` 와 그 named export 를 **삭제** 한다 (동등 cover 는 [assessmentRowOps.test.ts](../../web/src/api/assessmentRowOps.test.ts) 에 이미 있으므로 test 를 옮겨 적지 않는다 — 중복 재작성 금지). 타입 `SortKey` 는 `AssessmentRowSortKey` 로 대체하고, `DashboardViewProps.initialSortKey` 기본값을 `'contributionScore'` 로 바꾼다.
- [ ] `SORT_OPTIONS` 를 하드코딩 대신 `ASSESSMENT_TABLE_COLUMNS` 를 import 해 `{key,label}` 매핑으로 파생한다 (표 헤더와 툴바 정렬 옵션의 drift 0).
- [ ] 표 렌더를 `EvaluationResultTable` → `AssessmentResultTable` 로 교체한다 (`rows={pagedRows}` · `sortKey` · `sortDirection` · `onSortChange={handleHeaderSort}` · `loading`). `handleHeaderSort` 인자 타입을 `AssessmentSortKey`/`AssessmentRowSortKey` 로 맞춘다.
- [ ] 선택 `<select>` 옵션 라벨을 `{row.period} · {row.scope}` 로, `EvaluationDetailPanel` 의 `subjectName` 을 `selectedRow?.period` 로 바꾼다 (선택·상세 동선 유지).
- [ ] 브리지 순수 helper `toLegacyScoreRows(rows: AssessmentDisplayRow[]): EvaluationResultRow[]` 를 신설·export 하고 `deriveMetrics` · `deriveScoreBuckets` 호출부에만 적용한다. `contributionScore` 가 `null` 인 행은 **집계에서 제외** 한다 (0 점 위장 금지). 주석에 "REQ-076 축 스케일 정합 slice 에서 제거될 임시 브리지" 명시.
- [ ] `deriveMetrics` · `deriveScoreBuckets` · `pageRows` · `deriveTrendPoints` · `deriveContributionMetrics` · `buildAssessmentsPath` · `buildSummariesPath` · `buildContributionsPath` · `derivePersonOptions` 의 **시그니처·본문 불변** (그 helper 를 검사하는 기존 spec 블록 diff 0 — 이 경계가 본 task 를 2 파일로 묶는다).
- [ ] happy-path unit test 1+ — 새 fixture (backend 응답 형태 raw 행 3 개) 로 마운트했을 때 표에 6 컬럼 헤더 (`기간` · `범위` · `시작` · `난이도` · `기여 점수` · `업무량`) 와 실제 값이 렌더됨 1+, `toLegacyScoreRows` 정상 매핑 1+.
- [ ] error path unit test 1+ — 조회 실패 (error) · `data` 미도착 (`undefined`) 시 throw 0 + 표가 빈 상태/로딩 표시로 흡수됨 1+, `toLegacyScoreRows(null as never)` 류 비정상 입력이 빈 배열을 반환하고 throw 하지 않음 1+.
- [ ] 분기 cover — (a) `loading=true` 표 분기, (b) 행 0 건 빈 상태 분기, (c) 헤더 클릭 정렬: 같은 키 → 방향 토글 / 다른 키 → `asc` 전환 각 1+, (d) `contributionScore` 가 `null` 인 행이 섞였을 때 정렬 순서 (마지막) 1+, (e) 검색어 입력 시 행이 걸러짐 1+.
- [ ] negative cases 충분 cover — 각 1+ test: (a) 배열이 아닌 응답 (객체 · 문자열) 이 와도 빈 표 + throw 0, (b) 결손 행 (키 누락 · 타입 불일치) 이 `—` 로 흡수되고 `'undefined'` · `'NaN'` 문자열이 화면에 새지 않음, (c) `contributionScore=null` 행이 요약 평균·점수 분포 집계에 **포함되지 않음** (0 으로 위장되지 않음), (d) `personId` 미선택 시 조회 미수행 + 안내 문구 유지 (기존 가드 회귀 0), (e) 표에 `narrative` · `personId` · `id` 컬럼이 노출되지 않음.
- [ ] `cd web && pnpm test` (vitest) 전량 green — `DashboardView.person-selector.test.tsx` · `DashboardView.*-contract.test.ts` 3 종은 **수정 없이** green 이어야 한다 (path 계약 회귀 0).
- [ ] `cd web && pnpm build` 통과 (TypeScript 오류 0 — 옛 `EvaluationResultRow` 잔존 참조 없음).
- [ ] 루트 `pnpm lint` 통과 + 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` diff 0 이라 backend coverage 불변임을 확인.

## Out of Scope

- 요약 지표 · 점수 분포의 **축 스케일 정합** (REQ-076, PLAN `131 행` ③) — `deriveMetrics` · `deriveScoreBuckets` 를 새 행 계약으로 옮기고 `BUCKET_EDGES` 0–100 가정을 실 metricScore 스케일에 맞추는 작업은 브리지 제거와 함께 별도 slice.
- 기간 (일/주/월 + 시작) 지정 UI 와 `POST /api/assessment-evaluation/period` 호출 경로 (REQ-077, PLAN `131 행` ④) — 본 task 는 `period` prop 을 그대로 둔다.
- [AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) · [assessmentRow.ts](../../web/src/api/assessmentRow.ts) · [assessmentRowOps.ts](../../web/src/api/assessmentRowOps.ts) 수정 — 세 파일 모두 diff **0 파일** (import 만 한다). 부족한 기능이 보이면 Follow-ups 로.
- [EvaluationResultTable.tsx](../../web/src/components/EvaluationResultTable.tsx) 파일 삭제 · 그 spec 수정 — 다른 소비처 여부 확인이 필요하므로 별도 정리 slice. 본 task 는 `EvaluationResultRow` **type-only import** 만 남긴다.
- 상세 패널을 `narrative` 축으로 재설계하는 작업 · `EvaluationDetailPanel` 컴포넌트 수정.
- 서버 정렬 · 서버 페이지네이션 전환, 새 endpoint 추가.
- `src/` · `test/e2e/` · `package.json` · 새 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 여기에 append)
