---
id: T-0381
title: P6 composition wiring ③a 대시보드 컨테이너 조립 + useApiResource fetch hook + GET /api/assessments 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-048]
estimatedDiff: 240
estimatedFiles: 5
created: 2026-06-13
independentStream: p6-frontend-composition
dependsOn: [T-0380]
touchesFiles: [web/src/views/DashboardView.tsx, web/src/views/DashboardView.test.tsx, web/src/api/useApiResource.ts, web/src/api/useApiResource.test.ts, web/src/AppShell.tsx]
plannerNote: "P6 wiring③a; ADR-0041 Decision1·3; DashboardView 컨테이너가 useApiResource(GET /api/assessments) 로 데이터 소유→MetricSummaryCards+DashboardFilterBar+EvaluationResultTable props 배선, AppShell view==dashboard 렌더; ③b(시계열/분포/상세/페이지네이션) follow-up split"
sizeExempt: false
---

# T-0381 — P6 composition wiring ③a 대시보드 컨테이너 조립 + useApiResource fetch hook + GET /api/assessments 배선

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 ③ slice — wiring ②b (T-0380) 가 인증 fetch hook (`apiClient.request` + `auth.login/refresh` + 401→refresh→retry) 을 완성하고 AppShell 이 `AuthGate.onLogin` 에 실 `auth.login` 을 주입해 **로그인 진입 경로가 실 동작**으로 완결됐다. 하지만 인증 후 `view === 'dashboard'` 본문은 아직 `AUTHED_VIEW_LABEL[view]` placeholder 텍스트 ("대시보드 화면 (후속 slice 에서 조립)") 만 렌더한다 (post-merge `web/src/AppShell.tsx`). 본 slice 는 ADR-0041 Decision 1 (controlled lift-up: 컨테이너가 데이터 소유, presentational 은 props 소비) + Decision 3 (data-fetch 경계: thin custom fetch hook, native `fetch`, loading/error → props) 을 cover 해 **대시보드 화면 컨테이너를 첫 cut 으로 조립**한다 — 이미 박제된 presentational 컴포넌트 (`MetricSummaryCards` · `DashboardFilterBar` · `EvaluationResultTable`) 를 **수정 0** 으로 재사용해 `GET /api/assessments` 조회 결과를 props 로 내려보낸다 (README REQ-038 시각화 UI / REQ-048 조회 3초).

③ (대시보드 화면 전체 조립) 은 7+ presentational 컴포넌트 + 컨테이너 + fetch hook + 테스트로 cap (300 LOC / 5 파일) 을 크게 초과하므로 **③a / ③b 로 split** 한다. 본 ③a 는 **컨테이너 골격 + fetch hook + 핵심 조회 표면 (요약 카드 + 필터 바 + 결과 테이블)** 까지로 국소화하고, 시계열 (`TrendTimeSeriesPanel`) · 점수 분포 (`ScoreDistributionChart`) · 상세 (`EvaluationDetailPanel`) · 페이지네이션 (`DashboardPaginationControl`) 조립과 `/api/summaries`·`/api/contributions` 배선은 ③b follow-up 으로 넘긴다.

본 slice 는 **zero-new-dep** — 브라우저 표준 `fetch` 를 감싼 기존 `apiClient.request` 를 소비하는 thin custom hook (`useApiResource`) + `react` hooks (`useState`/`useEffect`) 만 추가한다. axios·react-query·router 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0380]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `web/src/AppShell.tsx` 공유 수정이라 file-disjoint 불성립.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (컴포지션 구조: AppShell → 인증 게이트 → 화면 컨테이너 → presentational, **controlled lift-up — 데이터/loading/error 는 컨테이너 소유, presentational 은 props 소비**) / Decision 3 (data-fetch 경계: thin custom fetch hook, native `fetch`, `credentials` 자동 cookie, loading/error → props) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn)
- `docs/decisions/ADR-0040-frontend-stack.md` §1 (sort/filter dashboard 채택 근거) / §2 (`/api/*` REST 순수 소비) / §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/jsdom/@testing-library 금지)
- `web/src/api/apiClient.ts` — 소비 대상. `request<T>(path, options): Promise<T>` (2xx body 파싱 반환, 비-2xx/네트워크 throw `ApiError(status, message)`, 401→refresh→retry 캡슐화). export: `{ ApiError, request }` + type `RequestOptions`. **본 slice 의 `useApiResource` 는 이 `request` 를 그대로 호출** (credentials/refresh 의무는 apiClient 가 이미 담당 — hook 은 loading/error/data 상태 보유만)
- `web/src/AppShell.tsx` — 갱신 대상. 현재 `view === 'dashboard'` 본문은 `AUTHED_VIEW_LABEL[view]` placeholder. 본 slice 는 인증 후 view 가 `'dashboard'` 일 때 `<DashboardView />` 를 렌더하도록 본문 분기만 교체 (헤더 레이아웃·R-78 배너 슬롯·AuthGate onLogin 주입·view enum·handleAuthenticated 는 T-0378/T-0379/T-0380 박제 불변)
- `web/src/components/EvaluationResultTable.tsx` — 재사용 (수정 0). props: `rows: EvaluationResultRow[]`, `sortKey?`, `sortDirection?`, `onSortChange?`, `loading?`, `emptyMessage?`. **`EvaluationResultRow` 타입 export 를 그대로 import 해 컨테이너의 row shape 으로 사용** (frontend-local 재정의 금지 — 정합 유지)
- `web/src/components/DashboardFilterBar.tsx` — 재사용 (수정 0). props: `searchTerm?`, `onSearchChange?`, `sortOptions?`, `sortKey?`, `onSortKeyChange?`, `sortDirection?`, `onSortDirectionToggle?`, `onReset?`, `loading?`
- `web/src/components/MetricSummaryCards.tsx` — 재사용 (수정 0). props: `metrics?: MetricSummaryItem[]`, `loading?`, `error?`, `emptyLabel?`, `titlePrefix?`
- `docs/architecture/api.md` 89–96행 — `GET /api/assessments` (`?personId=&period=`, findByPerson, **personId 누락 시 400**, RBAC User+, T-0117/T-0121 박제, response = 평가 결과 row 배열) — 본 slice 의 조회 대상
- `web/src/components/LoginForm.test.tsx` — colocated `.test.tsx` 패턴 참고 (vitest + `react-dom/server` renderToStaticMarkup, jsdom·@testing-library 미사용, `.test.tsx`/`.test.ts` 확장자 고정 — root jest `*.spec.ts` pickup 충돌 회피)

## Acceptance Criteria

- [ ] `web/src/api/useApiResource.ts` 신설 — `apiClient.request` 를 소비하는 thin custom fetch hook:
  - [ ] `useApiResource<T>(path: string | null, options?): { data?: T; loading: boolean; error?: string }` (또는 동등 모양) — mount/`path` 변경 시 `request<T>(path, options)` 호출, loading/error/data 상태를 `useState`/`useEffect` 로 보유해 반환. `path === null` (또는 falsy) 이면 fetch 미수행 (조건부 조회 — personId 미선택 시 호출 안 함).
  - [ ] 성공 (2xx) 시 `data` set + `loading=false`. 실패 (`ApiError` throw) 시 `error` (status + 메시지) set + `loading=false`. data-fetch 의 loading/error/data 를 호출 컨테이너가 presentational 의 props 로 내려보낼 수 있도록 노출 (ADR-0041 Decision 3 loading/error → props 경계).
  - [ ] **unmount/재요청 race 가드**: 컴포넌트 unmount 후 또는 `path` 가 또 바뀐 뒤 도착한 stale 응답이 state 를 덮어쓰지 않도록 cleanup (예 `useEffect` cleanup 의 cancelled 플래그). 무한 refetch 루프 방지 (`useEffect` deps 정확).
  - [ ] axios/react-query 등 새 dependency import 0 — `react` hooks + `apiClient.request` 만.
- [ ] `web/src/views/DashboardView.tsx` 신설 — 대시보드 화면 컨테이너 (controlled lift-up):
  - [ ] `useApiResource` 로 `GET /api/assessments?personId=&period=` 조회 결과를 **컨테이너가 소유** (data/loading/error 보유). personId 미선택 시 `path=null` 로 조회 미수행 (api.md: personId 누락 시 400 회피) + 안내 표시.
  - [ ] 조회 결과 row 배열을 `EvaluationResultTable` 의 `rows`/`loading`/`emptyMessage` props 로, 검색/정렬 상태를 `DashboardFilterBar` 의 `searchTerm`/`sortKey`/`sortDirection`/콜백 props 로, 파생 요약 지표를 `MetricSummaryCards` 의 `metrics`/`loading`/`error` props 로 내려보낸다. **세 presentational 컴포넌트 수정 0** — props 배선만.
  - [ ] 정렬/필터 상태 (`sortKey`/`sortDirection`/`searchTerm`) 는 컨테이너가 `useState` 로 보유하고, 표시 직전 client-side 정렬/필터를 컨테이너에서 수행 (presentational 은 순서 그대로 표시 — EvaluationResultTable 책임 경계 정합). 정렬 변경 콜백이 컨테이너 상태를 갱신하는 분기 cover.
  - [ ] loading/error → props 경계 준수 — presentational 은 fetch 를 모른다 (ADR-0041 Decision 1).
- [ ] `web/src/AppShell.tsx` 갱신 — 인증 후 `view === 'dashboard'` 일 때 `<DashboardView />` 를 렌더하도록 본문 분기만 교체 (현 `AUTHED_VIEW_LABEL[view]` placeholder 를 dashboard 에 한해 컨테이너로 교체; `admin`/`superadmin-setup` 은 placeholder 유지 — ③b/④ 책임). 헤더 레이아웃·R-78 배너 슬롯·AuthGate onLogin 주입·view enum·handleAuthenticated 는 T-0378/T-0379/T-0380 박제 불변. 본 slice 변경은 view 분기 1 지점에 국소화 — App.tsx 를 크게 흔들지 않음 (ADR-0041 Consequences §부정 cap 준수).
- [ ] 새 dependency 0 — `react`/`react-dom` + 브라우저 표준 `fetch` (apiClient 경유) 만 (router/axios/react-query/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `web/src/api/useApiResource.test.ts` 신설 (vitest, `apiClient.request` 또는 `fetch` 를 `vi.fn` mock — jsdom·@testing-library 미사용; hook 은 순수 함수 추출 또는 react 의 act 없이 검증 가능한 형태로 작성하거나 `react-dom/server` 로 컨테이너 경유 검증). `.test.ts` 확장자 고정. R-112 4 종:
  - [ ] happy-path: 2xx 응답 시 hook 이 `data` 를 노출하고 `loading=false` 로 전이함 1+.
  - [ ] error path: `request` 가 `ApiError` throw 시 `error` set + `loading=false` 1+ / `path=null` 시 fetch 미수행 (request 미호출) 1+.
  - [ ] flow/branch: loading → success 전이 분기 1+ AND loading → error 전이 분기 1+ (양 분기 cover).
  - [ ] negative cases 충분 cover: `path` 변경 후 도착한 stale 응답이 state 를 덮어쓰지 않음 1+ / unmount 후 응답 도착 시 state 갱신 안 함 (cancelled 가드) 1+ / 무한 refetch 안 함 1+ — 예외 상황 분기마다 각 1+.
- [ ] `web/src/views/DashboardView.test.tsx` 신설 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock). `.test.tsx` 확장자 고정. R-112 4 종:
  - [ ] happy-path: 조회 성공 시 결과 row 가 `EvaluationResultTable` 로, 요약 지표가 `MetricSummaryCards` 로 렌더됨 1+.
  - [ ] error path: 조회 실패 (error) 시 에러 표시 + 테이블 미렌더 1+ / personId 미선택 시 조회 미수행 + 안내 표시 1+.
  - [ ] flow/branch: loading 분기 (진행 표시) 1+ AND empty (결과 0) 분기 1+ AND populated 분기 1+.
  - [ ] negative cases 충분 cover: 정렬 변경 콜백이 컨테이너 상태를 갱신해 표시 순서가 바뀜 1+ / 빈 검색어/빈 결과 fallback 1+ / personId 누락 path=null 가드 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — useApiResource.test.ts + DashboardView.test.tsx + 기존 AppShell/AuthGate/컴포넌트/api test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파일 (useApiResource.ts, DashboardView.tsx) line ≥ 80% AND function ≥ 80% 충족 (`pnpm --dir web test` coverage 리포트로 확인). web vitest 의 ci.yml 미배선은 T-0355 Follow-up 의 기존 tracked gap.

## Out of Scope

- 시계열 패널 (`TrendTimeSeriesPanel`) · 점수 분포 (`ScoreDistributionChart`) · 평가 상세 (`EvaluationDetailPanel`) · 페이지네이션 (`DashboardPaginationControl`) 컴포넌트의 대시보드 조립 — **wiring ③b 책임** (본 slice 는 요약 카드 + 필터 바 + 결과 테이블 핵심 조회 표면까지).
- `GET /api/summaries` (시계열) · `GET /api/contributions` (기여 상세) fetch 배선 — ③b 책임 (본 slice 는 `GET /api/assessments` 만).
- Admin 화면 (`view === 'admin'`) · SuperAdmin 셋업 화면 (`view === 'superadmin-setup'`) 컨테이너 조립 — wiring ④ 책임 (본 slice 는 dashboard view 만; admin/superadmin-setup 은 placeholder 유지).
- personId 선택 UI 의 실 인원 목록 fetch (`GET /api/persons` 드롭다운 채우기) — ③b 또는 ④ 에서 결정. 본 slice 는 personId 입력/미선택 가드 + 조회 분기까지 (실 인원 목록 소스는 후속).
- 서버 측 정렬/필터/페이지네이션 (`?sort=&filter=&page=`) — api.md 89행 기준 backend 는 plain CRUD (고도화 P5 deferred). 본 slice 는 client-side 정렬/필터만.
- 로그아웃 · 세션 만료 → view 전환 (refresh 최종 실패 시 AppShell view 를 `'login'` 으로 되돌리는 전역 배선) / `GET /api/auth/me` 부트 hydration — 후속 slice (T-0380 Out of Scope 그대로 유지).
- R-78 `evaluationInProgress` 실 polling + mutation 가드 — wiring ⑤ 책임.
- presentational 컴포넌트 (`EvaluationResultTable`/`DashboardFilterBar`/`MetricSummaryCards`) 자체 수정 — controlled props 그대로 소비 (DashboardView 의 배선 지점만).
- DTO 타입 공유 (backend `src/` 와 frontend 간 shape 공유 방식) — ADR-0040 §중립 별도 결정. 본 slice 는 EvaluationResultTable 의 `EvaluationResultRow` export 재사용 + frontend-local 최소 타입만.
- react-router · @tanstack/react-query · axios · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 3 deferred 캐싱/dedup 제안 — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ③b** — DashboardView 에 `TrendTimeSeriesPanel`(`GET /api/summaries`) + `ScoreDistributionChart` + `EvaluationDetailPanel`(`GET /api/contributions`) + `DashboardPaginationControl` 조립 (useApiResource 재사용, dependsOn [T-0381]). 그 후 wiring ④ Admin 화면 조립, ⑤ R-78 polling. 그리고 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
