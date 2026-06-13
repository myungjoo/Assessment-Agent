---
id: T-0384
title: P6 composition wiring ③b-3 대시보드 페이지네이션(DashboardPaginationControl client-side 페이지 상태 + row slicing) 조립
phase: P6
status: DONE
commitMode: pr
completedAt: 2026-06-13T19:14:00Z
mergedAs: 5615f50
prNumber: 315
reviewRounds: 1
coversReq: [REQ-038, REQ-046, REQ-092]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0383]
touchesFiles: [web/src/views/DashboardView.tsx, web/src/views/DashboardView.test.tsx]
plannerNote: "P6 wiring③b-3; ADR-0041 Decision1·3; DashboardView 에 DashboardPaginationControl(client-side page/pageSize state + visibleRows slicing) 조립; presentational·AppShell 수정 0; 다음=④Admin"
sizeExempt: false
---

# T-0384 — P6 composition wiring ③b-3 대시보드 페이지네이션(DashboardPaginationControl client-side 페이지 상태 + row slicing) 조립

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 ③b slice 마지막 fragment 를 잇는다. wiring ③b-2 (T-0383, 머지 0a05a7e PR#314) 가 `DashboardView` 에 평가 상세 (EvaluationDetailPanel / GET /api/contributions, row 선택 연동) 까지 조립을 마쳐 대시보드 컨테이너는 요약 카드 · 필터 바 · 결과 테이블 · 시계열 · 점수 분포 · 평가 상세를 모두 갖췄다 (post-merge `web/src/views/DashboardView.tsx` 491 LOC, 단 helper/주석/배선 합산이라 본 slice 추가분은 작다). 본 slice 는 그 위에 **client-side 페이지네이션** 을 조립해 README REQ-038/REQ-046/REQ-092 (시각화 대시보드 — 정렬·필터·시계열 + 대용량 결과 표 페이지 탐색) 의 frontend 측 마지막 표면을 cover 한다.

- **페이지네이션** (`DashboardPaginationControl`): 컨테이너가 현재 페이지 (`currentPage`) 와 페이지 크기 (`pageSize`) 를 `useState` 로 보유하고, 이미 client-side 로 필터·정렬된 `visibleRows` 를 페이지 단위로 **slicing** 해 결과 테이블 (`EvaluationResultTable`) 에 현재 페이지 row 만 내려보낸다. `DashboardPaginationControl` 에는 `currentPage`/`totalItems` (= filtered/sorted 전체 건수)/`pageSize`/`onPageChange`/`onPageSizeChange` props 를 배선한다 — **서버 페이지네이션 (offset/limit·cursor) 0** (api.md 89: backend 는 plain CRUD, ADR-0040 §1 client-side interaction 정합).

③ (대시보드 전체 조립) 은 cap (300 LOC / 5 파일) 을 크게 초과하므로 ③a (T-0381) → ③b-1 (T-0382) → ③b-2 (T-0383) 에 이어 본 **③b-3 은 페이지네이션까지로 국소화** 해 wiring ③ chain 을 마무리한다. 본 slice 는 `web/src/views/DashboardView.tsx` (+ colocated `.test.tsx`) 두 파일만 만진다 — `AppShell.tsx` 는 ③a 가 이미 `<DashboardView />` 를 마운트했으므로 **수정 0**, presentational (`DashboardPaginationControl` · `EvaluationResultTable`) 도 controlled props 그대로 소비하므로 **수정 0** (충돌 표면 최소, ADR-0041 Consequences §부정 cap 준수).

본 slice 는 **zero-new-dep** — 기존 컴포넌트 import + `react` hooks (`useState`/`useMemo`) 만 추가하고, 기박제 presentational (`DashboardPaginationControl`) 은 **수정 0** 으로 props 배선만 한다. axios · react-query · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0383]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `DashboardView.tsx` 공유 수정이라 file-disjoint 불성립.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/페이지 상태는 컨테이너 소유, presentational 은 props 소비) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (App.tsx·DashboardView 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §1 (정렬·필터·페이지네이션 dashboard 채택 근거 — client-side interaction, 서버 페이지네이션 부재) / §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `web/src/views/DashboardView.tsx` — **갱신 대상** (post-merge 491 LOC). 현재 `buildAssessmentsPath`/`buildSummariesPath`/`buildContributionsPath`/`deriveTrendPoints`/`deriveScoreBuckets`/`deriveContributionMetrics`/`filterRows`/`sortRows`/`deriveMetrics` 순수 helper export, `useApiResource` 를 assessments·summaries·contributions 세 번 호출, `MetricSummaryCards`/`DashboardFilterBar`/`EvaluationResultTable`/`TrendTimeSeriesPanel`/`ScoreDistributionChart`/`EvaluationDetailPanel` 배선. `visibleRows` 는 `filterRows` → `sortRows` 결과 (필터·정렬된 전체 row). 본 slice 는 (1) `currentPage`/`pageSize` 를 보유하는 `useState` 추가 (+ 테스트용 `initialPage`/`initialPageSize` 주입), (2) `visibleRows` 를 페이지 단위로 slicing 하는 순수 helper (예 `pageRows(rows, page, pageSize)`) 추가, (3) slice 결과 (`pagedRows`) 를 `EvaluationResultTable` 의 `rows` 로 내려보내고 `DashboardPaginationControl` 을 `<section>` 본문에 props 배선 추가. 기존 요약/필터/테이블/시계열/분포/상세 배선·정렬/필터/검색/선택 상태·personId 미선택 가드·row 선택 `<select>` 컨트롤은 불변
- `web/src/components/DashboardPaginationControl.tsx` — **재사용 (수정 0)**. props: `currentPage: number`, `totalItems: number`, `pageSize: number`, `pageSizeOptions?: number[]`, `onPageChange?: (page) => void`, `onPageSizeChange?: (size) => void`, `loading?`, `error?`, `labelPrefix?`. `DashboardPaginationControlProps` 타입을 named import 해 배선 props 타입으로 쓴다 (frontend-local 재정의 금지). 내부에 `computeTotalPages` (pageSize 0 이하·totalItems 음수 안전 fallback) + 경계 비활성 (첫/마지막 페이지) 정책이 이미 박제 — 컨테이너는 page/pageSize state 갱신과 slicing 만 책임진다 (경계 판정은 컴포넌트가 표시, 컨테이너의 onPageChange 도 범위 clamp 를 보수적으로)
- `web/src/components/EvaluationResultTable.tsx` — `EvaluationResultRow` 타입 (`{ id, subjectName, metricLabel, score }`) named export + `rows`/`sortKey`/`sortDirection`/`onSortChange`/`loading` props. 본 slice 는 현재 페이지 row (`pagedRows`) 만 `rows` 로 내려보낸다 — 컴포넌트 수정 0 (정렬/표시는 그대로, 입력 row 가 페이지 slice 로 좁아질 뿐). 단 row 선택 `<select>` 옵션은 어느 row 집합을 노출할지 (현재 페이지 vs 전체 visibleRows) 본문 결정 사항 참조 (아래 Acceptance Criteria)
- `web/src/api/useApiResource.ts` — 재사용 (수정 0, 본 slice 는 신규 조회 0 — 페이지네이션은 이미 fetch 한 client-side 데이터에서 파생). 세 조회 (assessments/summaries/contributions) 호출은 ③a/③b-1/③b-2 박제 불변
- `web/src/views/DashboardView.test.tsx` — **갱신 대상**. ③a/③b-1/③b-2 가 박제한 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock, jsdom·@testing-library 미사용, `.test.tsx` 확장자 고정) 을 그대로 따라 페이지네이션/slicing case 를 추가

## Acceptance Criteria

- [ ] `web/src/views/DashboardView.tsx` 갱신 — client-side 페이지 상태 (controlled lift-up):
  - [ ] 현재 페이지 (`currentPage`, 1-base) 와 페이지 크기 (`pageSize`) 를 보유하는 `useState` 추가. 테스트 가능성을 위해 초기값 주입 (예 `initialPage?`/`initialPageSize?` props) 을 허용 (③a/③b-1/③b-2 의 `initial*` 주입 패턴 정합). `pageSize` 기본값은 `DashboardPaginationControl` 의 기본 옵션 (10) 과 정합.
  - [ ] 페이지 변경 콜백 (`onPageChange`) 과 페이지 크기 변경 콜백 (`onPageSizeChange`) 핸들러 추가 — `DashboardPaginationControl` 에 배선. 페이지 크기 변경 시 현재 페이지를 1 로 재설정 (또는 범위 안으로 clamp) 해 빈 페이지 표시를 피한다 (필터/검색 변경으로 totalItems 가 줄어 currentPage 가 totalPages 를 넘는 경우도 보수적으로 clamp).
- [ ] `web/src/views/DashboardView.tsx` 갱신 — row slicing + 페이지네이션 컨트롤 조립:
  - [ ] 필터·정렬된 `visibleRows` 를 `(currentPage, pageSize)` 로 slicing 하는 순수 helper (예 `pageRows(rows, page, pageSize)`) 추가 — `rows.slice((page-1)*pageSize, page*pageSize)` 의미. page/pageSize 비정상 입력 (0 이하·NaN·범위 밖) 은 안전 fallback (빈 slice 또는 첫 페이지) 로 처리해 throw/NaN 인덱스를 피한다. 이 slice 결과 (`pagedRows`) 를 `EvaluationResultTable` 의 `rows` 로 내려보낸다 — **컴포넌트 수정 0**.
  - [ ] `DashboardPaginationControl` 을 `<section>` 본문에 추가하고 `currentPage`/`totalItems` (= `visibleRows.length`, 페이지 slice 전 필터·정렬된 전체 건수)/`pageSize`/`onPageChange`/`onPageSizeChange`/`loading` (assessments 조회의 loading) props 를 배선한다 — **컴포넌트 수정 0**. `totalItems` 는 slice 후 `pagedRows.length` 가 아니라 slice 전 `visibleRows.length` 여야 totalPages 가 정확하다 (off-by-one 회피).
- [ ] loading/error → props 경계 준수 — `DashboardPaginationControl` 은 fetch 를 모른다 (ADR-0041 Decision 1). 페이지네이션 컨트롤은 assessments 조회의 loading 을 받아 진행 중 페이지 컨트롤을 미렌더한다 (조작 중복 차단 — 컴포넌트의 loading 우선 정책). 다른 조회 (summaries·contributions) 의 상태와 섞이지 않는다.
- [ ] 선택 `<select>` 옵션 row 집합 결정 — 현재 row 선택 컨트롤 (`<select aria-label="평가 결과 선택">`) 이 어느 row 집합을 옵션으로 노출할지 본문에서 결정한다: **현재 페이지 row (`pagedRows`)** 로 좁히거나 전체 `visibleRows` 유지 둘 중 하나를 택하고 그 근거를 주석으로 남긴다. 어느 쪽이든 선택된 `selectedId` 가 현재 페이지에 없을 때 상세 패널이 깨지지 않도록 (selectedRow 조회는 visibleRows 기준 유지) 보수적으로 처리.
- [ ] personId 미선택 분기 불변 — `!personId` 면 기존 안내 문구 (NO_PERSON_TEXT) 만 렌더 (페이지네이션 컨트롤·테이블 미렌더). assessments·summaries·contributions 조회 가드와 row 선택 가드는 ③a/③b-1/③b-2 그대로.
- [ ] `web/src/AppShell.tsx` **수정 0** — ③a 가 이미 `<DashboardView />` 를 마운트했으므로 본 slice 는 DashboardView 내부만 변경 (충돌 표면 최소). `DashboardPaginationControl.tsx`·`EvaluationResultTable.tsx` 등 presentational **수정 0** — 페이지네이션 배선이 컴포넌트 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] 새 dependency 0 — `react` hooks (`useState`/`useMemo`) + 기존 컴포넌트 import 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `web/src/views/DashboardView.test.tsx` 갱신 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock). `.test.tsx` 확장자 고정. 추가 파생 helper (`pageRows` 등) · 페이지네이션 배선에 대한 R-112 4 종:
  - [ ] happy-path: visibleRows 가 pageSize 를 초과할 때 현재 페이지 row 만 `EvaluationResultTable` 로 렌더됨 1+ AND `DashboardPaginationControl` 의 현재/전체 페이지 표식 (예 "1 / N 페이지") + 전체 항목 수가 정확히 표시됨 1+.
  - [ ] error path: assessments 조회 loading 중 페이지네이션 컨트롤이 진행 표시 (컨트롤 미렌더) 1+ / 빈 결과 (visibleRows 0 건) 시 페이지네이션이 totalPages 1·빈 테이블로 안전 표시 1+.
  - [ ] flow/branch: page 2 로 이동 (`initialPage=2`) 시 두 번째 페이지 row slice 가 렌더됨 분기 1+ AND pageSize 변경 (`initialPageSize` 다른 값) 시 slice 폭이 달라짐 분기 1+ / currentPage 가 totalPages 초과 시 clamp (빈 페이지 미표시) 분기 1+.
  - [ ] negative cases 충분 cover: page/pageSize 비정상 입력 (0·음수·NaN) 의 안전 fallback (throw/NaN 인덱스 없음) 각 1+ / totalItems 가 slice 후 길이가 아니라 slice 전 visibleRows.length 임 (totalPages 정확) 1+ / 페이지네이션 slicing 이 정렬/필터/시계열/분포/상세 배선을 깨지 않음 (다른 패널 정상 표시) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — DashboardView.test.tsx (페이지네이션/slicing 신규 case 포함) + 기존 AppShell/AuthGate/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파생 helper (pageRows / page·pageSize clamp 로직 등) line ≥ 80% AND function ≥ 80% 충족 (`pnpm --dir web test` coverage 리포트로 확인). 단 web vitest 는 아직 ci.yml 미배선 (T-0355 Follow-up 의 기존 tracked gap) 이고 `@vitest/coverage-v8` 미설치 (ADR-0040 §5 zero-new-dep) 라 coverage 는 신규 helper 의 분기별 spec 으로 **구성적 cover** 한다 — ③a~③b-2 와 동일.

## Out of Scope

- 서버 측 페이지네이션 (offset/limit·cursor 쿼리·전체 건수 헤더) — backend 는 plain CRUD (api.md 89). 본 slice 는 이미 fetch 한 client-side `visibleRows` 의 slicing 만 (서버 페이지네이션은 대용량 데이터 부상 시 별도 ADR/task).
- prefetch · 무한 스크롤 · 가상 스크롤 (windowing) — ADR-0040 §1 정렬·필터·페이지네이션 범위 밖. 본 slice 는 단순 페이지 slice 컨트롤만.
- `DashboardPaginationControl.tsx`·`EvaluationResultTable.tsx` 등 presentational 컴포넌트 자체 수정 — controlled props 그대로 소비 (DashboardView 의 배선 지점만). 페이지네이션 배선이 prop 경계를 넘어 컴포넌트 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지).
- `GET /api/assessments`·`/api/summaries`·`/api/contributions` fetch 배선 — ③a/③b-1/③b-2 박제 불변 (본 slice 는 신규 조회 0 — 페이지네이션은 client-side 파생).
- Admin 화면 (`view === 'admin'`) · SuperAdmin 셋업 화면 컨테이너 조립 — wiring ④ 책임 (본 ③b-3 가 wiring ③ chain 의 마지막).
- personId 선택 UI 의 실 인원 목록 fetch (`GET /api/persons` 드롭다운) — ④ 또는 후속에서 결정. 본 slice 는 personId 입력/미선택 가드까지 (③a~③b-2 와 동일).
- 로그아웃 · 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration — 후속 slice (이전 task Out of Scope 그대로 유지).
- R-78 `evaluationInProgress` 실 polling + mutation 가드 — wiring ⑤ 책임.
- react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ④ Admin 화면 조립** — AppShell 의 `view === 'admin'` 분기에 Admin 컨테이너 (`GET /api/persons`·`/api/groups`·`/api/parts`·`/api/llm`·`/api/admin` mutation, Admin+ RBAC, GroupMemberList·DifficultyModelSelector·ReEvaluationTriggerPanel·DataImportExportPanel·SchedulePanel 배선) 를 조립. 그 후 ⑤ R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
