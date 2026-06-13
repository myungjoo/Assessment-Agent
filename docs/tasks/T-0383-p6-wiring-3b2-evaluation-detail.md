---
id: T-0383
title: P6 composition wiring ③b-2 대시보드 평가 상세(EvaluationDetailPanel/GET /api/contributions, row 선택 연동) 조립
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-033, REQ-038, REQ-036]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-06-13
independentStream: p6-frontend-composition
dependsOn: [T-0382]
touchesFiles: [web/src/views/DashboardView.tsx, web/src/views/DashboardView.test.tsx]
plannerNote: "P6 wiring③b-2; ADR-0041 Decision1·3; DashboardView 에 EvaluationDetailPanel(useApiResource GET /api/contributions?assessmentId=, 테이블 row 선택 연동) 조립; 페이지네이션은 ③b-3 follow-up split"
sizeExempt: false
---

# T-0383 — P6 composition wiring ③b-2 대시보드 평가 상세(EvaluationDetailPanel/GET /api/contributions, row 선택 연동) 조립

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 ③b slice 후속을 잇는다. wiring ③b-1 (T-0382, 머지 5724332 PR#313) 이 `DashboardView` 에 시계열 패널 (TrendTimeSeriesPanel / GET /api/summaries) + 점수 분포 차트 (ScoreDistributionChart, assessments row 클라이언트 파생) 를 조립해 시각화 표면을 넓혔다 (post-merge `web/src/views/DashboardView.tsx` 351 LOC). 본 slice 는 그 위에 **단일 평가 결과 상세 패널** 을 조립해 README REQ-033 (개별 commit/PR/문서 단위 기여) · REQ-038/REQ-036 (시각화 — 단일 평가 결과 상세) 의 frontend 측 표면을 cover 한다.

- **상세** (`EvaluationDetailPanel`): 결과 테이블 (`EvaluationResultTable`) 의 row 선택과 연동해, 선택된 assessment 의 기여 상세를 `GET /api/contributions?assessmentId=` 로 조회한다 (api.md 104행: assessmentId 누락 시 400, 매칭 0 시 빈 배열 — `useApiResource(path=null)` 조건부 조회 가드 재사용). `useApiResource` 를 **세 번째** 로 호출해 컨테이너가 상세 data/loading/error 를 소유하고, contribution row 를 `EvaluationMetricItem[]` (지표 라벨 + 점수 + maxScore + 정성 근거) 로 파생해 패널의 `metrics`/`loading`/`error` props 로 내려보낸다.
- **row 선택**: 컨테이너가 선택된 row id (선택 assessmentId) 를 `useState` 로 보유하고, `EvaluationResultTable` 의 row 선택 콜백 (또는 그에 준하는 선택 상호작용) 으로 갱신한다. 선택이 없으면 상세 조회는 path=null (미수행) + 패널은 빈/안내 상태.

③ (대시보드 전체 조립) 은 cap (300 LOC / 5 파일) 을 크게 초과하므로 ③a (T-0381) → ③b-1 (T-0382) 에 이어 본 **③b-2 는 평가 상세까지로 국소화** 한다. 본 slice 와 같은 chain 의 **페이지네이션 (`DashboardPaginationControl`, client-side 페이지 상태) 조립은 ③b-3 follow-up** (dependsOn T-0383) 으로 split 한다 — 상세 (fetch + row 선택 연동) 와 페이지네이션 (client-side slicing + 페이지 상태) 을 한 task 에 합치면 두 기능 각각의 R-112 4 종 cover 로 `.tsx` + `.test.tsx` 합산 diff 가 cap (300 LOC) 을 넘을 위험이 크기 때문이다 (ADR-0041 Consequences §부정 — App.tsx 충돌 표면을 작게 유지하기 위해 잘게 split). 본 slice 는 `web/src/views/DashboardView.tsx` (+ colocated `.test.tsx`) 두 파일만 만진다 — `AppShell.tsx` 는 ③a 가 이미 `<DashboardView />` 를 마운트했으므로 **수정 0** (충돌 표면 최소).

본 slice 는 **zero-new-dep** — 기존 `useApiResource` + `react` hooks (`useState`/`useMemo`) 만 추가하고, 기박제 presentational (`EvaluationDetailPanel`) 은 **수정 0** 으로 props 배선만 한다. axios · react-query · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0382]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `DashboardView.tsx` 공유 수정이라 file-disjoint 불성립.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error 는 컨테이너 소유, presentational 은 props 소비) / Decision 3 (thin custom fetch hook, native fetch, loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn)
- `docs/decisions/ADR-0040-frontend-stack.md` §1 (시각화 dashboard 채택 근거 — client-side interaction) / §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `web/src/views/DashboardView.tsx` — **갱신 대상** (post-merge 351 LOC). 현재 `buildAssessmentsPath`/`buildSummariesPath`/`deriveTrendPoints`/`deriveScoreBuckets`/`filterRows`/`sortRows`/`deriveMetrics` 순수 helper export, `useApiResource` 를 assessments·summaries 두 번 호출, `MetricSummaryCards`/`DashboardFilterBar`/`EvaluationResultTable`/`TrendTimeSeriesPanel`/`ScoreDistributionChart` 배선. 본 slice 는 (1) `GET /api/contributions?assessmentId=` path 파생 helper + 세 번째 `useApiResource` 호출 추가, (2) 선택 row id 를 보유하는 `useState` + `EvaluationResultTable` 선택 연동, (3) contribution row → `EvaluationMetricItem[]` 파생 helper, (4) `EvaluationDetailPanel` 을 `<section>` 본문에 props 배선 추가. 기존 요약/필터/테이블/시계열/분포 배선·정렬/필터/검색 상태·personId 미선택 가드는 불변
- `web/src/api/useApiResource.ts` — 재사용 (수정 0). `useApiResource<T>(path: string | null, options?): { data?: T; loading: boolean; error?: string }` — `path === null` 이면 fetch 미수행 (조건부 조회), 2xx → data, throw → error. 본 slice 의 contributions 조회도 이 hook 을 세 번째 호출
- `web/src/components/EvaluationDetailPanel.tsx` — **재사용 (수정 0)**. props: `subjectName?`, `periodLabel?`, `metrics?: EvaluationMetricItem[]`, `loading?`, `error?`, `emptyLabel?`, `titlePrefix?`. `EvaluationMetricItem = { id: string; label: string; score: number; maxScore?: number; rationale?: string }` 를 named import 해 컨테이너의 contribution row → metric 파생 결과 타입으로 사용 (frontend-local 재정의 금지). loading 우선 정책·빈 목록 fallback·score 안전 clamp 는 컴포넌트가 이미 박제 (배선만)
- `web/src/components/EvaluationResultTable.tsx` — `EvaluationResultRow` 타입 (`{ id, subjectName, metricLabel, score }`) named export + row 선택 콜백 prop 형태 확인 대상. 선택된 row 의 id 를 contributions 조회의 assessmentId 로 사용 (row.id 가 assessment 식별자라는 전제 — api.md 104 의 `?assessmentId=`). **선택 콜백 prop 이 없으면** EvaluationResultTable 의 기존 prop 경계 안에서 선택 연동을 어떻게 표현할지 (예: 별도 선택 컨트롤 또는 onRowSelect prop 활용) 를 구현 시 결정하되, **컴포넌트 수정이 필요하면 본 task 범위로 들이지 말고 BLOCKED/Follow-up** (file-disjoint·controlled 경계 유지 — ADR-0041 Decision 1)
- `docs/architecture/api.md` 103–105행 — `GET /api/contributions` (`?assessmentId=`, findByAssessment, **assessmentId 누락 시 400**, 매칭 0 시 빈 배열, RBAC User+, T-0118/T-0122 박제, response = assessment 별 기여 row 배열) — 본 slice 의 세 번째 조회 대상. contribution row shape 은 frontend-local 최소 타입으로 정의 (지표 라벨 + 점수 + 정성 근거 필드만 매핑; backend DTO 전수 import 는 후속 DTO 공유 결정 전까지 보수적으로 최소 필드)
- `web/src/views/DashboardView.test.tsx` — **갱신 대상**. ③a/③b-1 이 박제한 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock, jsdom·@testing-library 미사용, `.test.tsx` 확장자 고정) 을 그대로 따라 상세 패널/row 선택 case 를 추가

## Acceptance Criteria

- [ ] `web/src/views/DashboardView.tsx` 갱신 — 평가 상세 조회 (controlled lift-up):
  - [ ] 선택 assessmentId 로 `GET /api/contributions?assessmentId=` path 를 파생하는 순수 helper (예 `buildContributionsPath(assessmentId)`) 추가 — assessmentId falsy 면 `null` 반환 (조회 미수행, api.md 104 의 400 회피). 이 path 로 `useApiResource<ContributionRow[]>(contributionsPath)` 를 **세 번째** 호출해 컨테이너가 상세 data/loading/error 를 소유.
  - [ ] 선택 row id (선택 assessmentId) 를 보유하는 `useState` 추가 + `EvaluationResultTable` 의 선택 상호작용으로 갱신 (row 선택 → 선택 id 변경 → contributions path 변경 → 재조회). 테스트 가능성을 위해 초기 선택 id 주입 (예 `initialSelectedId?` prop) 을 허용 (③a/③b-1 의 initial* 주입 패턴 정합).
- [ ] `web/src/views/DashboardView.tsx` 갱신 — 평가 상세 패널 조립:
  - [ ] contribution row 배열 → `EvaluationMetricItem[]` (지표 라벨 + 점수 + maxScore? + 정성 근거?) 파생 순수 helper 추가. data 미도착이면 빈 배열로 간주. `EvaluationDetailPanel` 을 `<section>` 본문에 추가하고 파생 metrics/loading/error 를 props 로만 내려보낸다 — **컴포넌트 수정 0**. 선택된 row 의 subjectName/period 를 패널의 `subjectName`/`periodLabel` props 로 전달 (선택 row 메타 표시).
  - [ ] contribution row 의 비정상/누락 필드 (점수 누락·NaN, 라벨 누락) fallback 분기를 helper 안에서 명확히 (off-by-one/NaN 회피 — EvaluationDetailPanel 의 safeScore 가 추가로 막지만 컨테이너 파생도 보수적으로).
- [ ] loading/error → props 경계 준수 — `EvaluationDetailPanel` 은 fetch 를 모른다 (ADR-0041 Decision 1). 상세 패널은 contributions 조회의 loading/error 를, 다른 패널 (테이블·시계열·분포) 은 각자의 조회 상태를 받는다 (세 조회의 상태가 섞이지 않도록 분리 — contributionLoading/contributionError 등 prefix 분리).
- [ ] 선택 미존재 분기 — row 선택이 없으면 (`!selectedId`) contributions 조회 path=null (미수행) + 상세 패널은 빈/안내 상태 (EvaluationDetailPanel 의 빈 목록 fallback 활용). personId 미선택 분기 (assessments·summaries 미수행) 는 ③a/③b-1 그대로 불변.
- [ ] `web/src/AppShell.tsx` **수정 0** — ③a 가 이미 `<DashboardView />` 를 마운트했으므로 본 slice 는 DashboardView 내부만 변경 (충돌 표면 최소, ADR-0041 Consequences §부정 cap 준수). `EvaluationResultTable.tsx` 등 presentational **수정 0** — 선택 연동이 컴포넌트 수정을 요구하면 BLOCKED/Follow-up.
- [ ] 새 dependency 0 — `react` hooks (`useState`/`useMemo`) + 기존 `useApiResource` 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `web/src/views/DashboardView.test.tsx` 갱신 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock). `.test.tsx` 확장자 고정. 추가 파생 helper·패널 배선에 대한 R-112 4 종:
  - [ ] happy-path: row 선택 후 contributions 조회 성공 시 기여 metric 이 `EvaluationDetailPanel` 로 렌더됨 1+ (선택 row 의 subjectName/period 도 표시됨).
  - [ ] error path: contributions 조회 실패 (error) 시 상세 패널이 에러 표시 + 항목 미렌더 1+ / 선택 미존재 시 상세 조회 미수행 + 패널 빈 상태 1+.
  - [ ] flow/branch: contributions loading 분기 (진행 표시) 1+ AND contributions empty (기여 0 건, api.md 104 매칭 0 → 빈 배열 → 빈 상태) 분기 1+ / row 선택 변경 → contributions path 변경 (재조회) 분기 1+.
  - [ ] negative cases 충분 cover: assessmentId falsy → path=null (조회 미수행) 1+ / contribution row 의 비정상/누락 필드 (점수 NaN·라벨 누락) fallback 1+ / 상세 조회와 (테이블·시계열·분포) 다른 조회의 loading/error 가 서로 오염되지 않음 (한쪽 실패 시 다른 쪽 정상 표시) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — DashboardView.test.tsx (상세/row 선택 신규 case 포함) + 기존 AppShell/AuthGate/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파생 helper (buildContributionsPath / contribution row → metric 파생 등) line ≥ 80% AND function ≥ 80% 충족 (`pnpm --dir web test` coverage 리포트로 확인). web vitest 의 ci.yml 미배선은 T-0355 Follow-up 의 기존 tracked gap.

## Out of Scope

- 페이지네이션 (`DashboardPaginationControl`) 의 대시보드 조립 (client-side 페이지 상태 + row slicing) — **wiring ③b-3 책임** (dependsOn T-0383, 본 task split 로 분리). 본 slice 는 평가 상세까지.
- `EvaluationResultTable.tsx` 등 presentational 컴포넌트 자체 수정 — controlled props 그대로 소비 (DashboardView 의 배선 지점만). 선택 연동이 EvaluationResultTable 의 prop 경계를 넘어 컴포넌트 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지).
- `GET /api/summaries` (시계열) · `GET /api/assessments` (조회) fetch 배선 — ③a/③b-1 박제 불변 (본 slice 는 `GET /api/contributions` 만 추가).
- 서버 측 기여 집계 / metric 산정 — backend 는 plain CRUD (api.md). 본 slice 는 client-side 파생 (contribution row → metric 매핑) 만.
- Admin 화면 (`view === 'admin'`) · SuperAdmin 셋업 화면 컨테이너 조립 — wiring ④ 책임.
- personId 선택 UI 의 실 인원 목록 fetch (`GET /api/persons` 드롭다운) — ③b-3/④ 에서 결정. 본 slice 는 personId 입력/미선택 가드 + row 선택 가드까지.
- contribution row 의 backend DTO 전수 타입 공유 (`src/` ↔ `web/` shape 공유 방식) — ADR-0040 §중립 별도 결정. 본 slice 는 frontend-local 최소 ContributionRow 타입 (지표 라벨 + 점수 + 정성 근거 필드) 만 정의.
- 로그아웃 · 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration — 후속 slice (이전 task Out of Scope 그대로 유지).
- R-78 `evaluationInProgress` 실 polling + mutation 가드 — wiring ⑤ 책임.
- react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 3 deferred 캐싱/dedup — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ③b-3** — DashboardView 에 `DashboardPaginationControl`(client-side 페이지 상태 + visibleRows slicing) 조립 (dependsOn [T-0383], independentStream p6-frontend-composition single-claim). 그 후 wiring ④ Admin 화면 조립, ⑤ R-78 polling. 그리고 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
