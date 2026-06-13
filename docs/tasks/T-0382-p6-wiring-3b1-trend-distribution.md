---
id: T-0382
title: P6 composition wiring ③b-1 대시보드 시계열(TrendTimeSeriesPanel/GET /api/summaries) + 점수 분포(ScoreDistributionChart 파생) 조립
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-038, REQ-034, REQ-035]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0381]
touchesFiles: [web/src/views/DashboardView.tsx, web/src/views/DashboardView.test.tsx]
plannerNote: "P6 wiring③b-1; ADR-0041 Decision1·3; DashboardView 에 TrendTimeSeriesPanel(useApiResource GET /api/summaries) 추가 + ScoreDistributionChart(assessments row 클라이언트 파생) 조립; 상세/페이지네이션은 ③b-2 split"
sizeExempt: false
prNumber: 313
mergedAs: 5724332
reviewRounds: 1
---

# T-0382 — P6 composition wiring ③b-1 대시보드 시계열(TrendTimeSeriesPanel/GET /api/summaries) + 점수 분포(ScoreDistributionChart 파생) 조립

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 ③b slice 를 잇는다. wiring ③a (T-0381, 머지 06c9a53 PR#312) 가 `DashboardView` 컨테이너 + `useApiResource` thin fetch hook + `GET /api/assessments` 배선을 완성하고 요약 카드 · 필터 바 · 결과 테이블의 핵심 조회 표면을 조립했다 (post-merge `web/src/views/DashboardView.tsx` 213 LOC). 본 slice 는 그 컨테이너 위에 **시계열 추이 패널 + 점수 분포 차트** 를 조립해 README REQ-038 (시각화 — 일/주/월 시계열 변화 + 지표별 분포) 와 REQ-034/REQ-035 (시계열 요약 평가) 의 frontend 측 표면을 cover 한다.

- **시계열** (`TrendTimeSeriesPanel`): `useApiResource` 를 **두 번째** 로 호출해 `GET /api/summaries?personId=&period=` 조회 결과를 컨테이너가 소유하고, summary row 를 `TrendPoint[]` (시점 label + value) 로 파생해 패널의 `points`/`loading`/`error` props 로 내려보낸다 (api.md 109행: personId 누락 시 400 — `useApiResource(path=null)` 가드 재사용).
- **분포** (`ScoreDistributionChart`): 이미 ③a 가 fetch 한 **assessments row 를 client-side 로 bucket 집계** (점수 구간별 건수 histogram) 해 차트의 `buckets`/`loading`/`error` props 로 내려보낸다 — **새 endpoint 0** (분포는 서버 aggregation 부재이므로 표시 데이터에서 파생, ADR-0040 §1 client-side interaction 정합).

③ (대시보드 전체 조립) 은 7+ presentational + 2 fetch path 로 cap (300 LOC / 5 파일) 을 크게 초과하므로 ③a (T-0381) 에 이어 **③b 를 다시 ③b-1 / ③b-2 로 split** 한다. 본 ③b-1 은 **시계열 + 분포** 까지로 국소화하고, 평가 상세 (`EvaluationDetailPanel` / `GET /api/contributions`) · 페이지네이션 (`DashboardPaginationControl`) 조립은 **③b-2 follow-up** (dependsOn T-0382) 으로 넘긴다. 본 slice 는 `web/src/views/DashboardView.tsx` (+ 그 colocated `.test.tsx`) 두 파일만 만진다 — `AppShell.tsx` 는 ③a 가 이미 `<DashboardView />` 를 마운트했으므로 **수정 0** (충돌 표면 최소).

본 slice 는 **zero-new-dep** — 기존 `useApiResource` + `react` hooks (`useMemo`) 만 추가하고, 기박제 presentational (`TrendTimeSeriesPanel` · `ScoreDistributionChart`) 은 **수정 0** 으로 props 배선만 한다. axios · react-query · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0381]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `DashboardView.tsx` 공유 수정이라 file-disjoint 불성립.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error 는 컨테이너 소유, presentational 은 props 소비) / Decision 3 (thin custom fetch hook, native fetch, loading/error → props 경계) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn)
- `docs/decisions/ADR-0040-frontend-stack.md` §1 (sort/filter/시계열 dashboard 채택 근거 — client-side interaction) / §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `web/src/views/DashboardView.tsx` — **갱신 대상** (post-merge 213 LOC). 현재 `useApiResource<EvaluationResultRow[]>(path)` 로 assessments 조회, `buildAssessmentsPath`/`filterRows`/`sortRows`/`deriveMetrics` 순수 helper export, `MetricSummaryCards`/`DashboardFilterBar`/`EvaluationResultTable` 배선. 본 slice 는 (1) `GET /api/summaries` path 파생 helper + 두 번째 `useApiResource` 호출 추가, (2) summary row → `TrendPoint[]` 파생 helper, (3) assessments row → `ScoreDistributionBucket[]` 파생 helper, (4) `TrendTimeSeriesPanel`/`ScoreDistributionChart` 를 `<section>` 본문에 props 배선 추가. 기존 요약/필터/테이블 배선·정렬/필터 상태·personId 미선택 가드는 불변
- `web/src/api/useApiResource.ts` — 재사용 (수정 0). `useApiResource<T>(path: string | null, options?): { data?: T; loading: boolean; error?: string }` — `path === null` 이면 fetch 미수행 (조건부 조회), 2xx → data, throw → error. 본 slice 의 summaries 조회도 이 hook 을 그대로 두 번째 호출
- `web/src/components/TrendTimeSeriesPanel.tsx` — **재사용 (수정 0)**. props: `title?`, `points?: TrendPoint[]`, `valueLabel?`, `valueFormatter?`, `loading?`, `error?`, `emptyMessage?`. `TrendPoint = { label: string; value: number }` 를 named import 해 컨테이너의 파생 결과 타입으로 사용 (frontend-local 재정의 금지)
- `web/src/components/ScoreDistributionChart.tsx` — **재사용 (수정 0)**. props: `buckets?: ScoreDistributionBucket[]`, `loading?`, `error?`, `emptyLabel?`, `titlePrefix?`. `ScoreDistributionBucket = { id: string; label: string; count: number }` 를 named import 해 파생 결과 타입으로 사용
- `web/src/components/EvaluationResultTable.tsx` — `EvaluationResultRow` 타입 (`{ id, subjectName, metricLabel, score }`) named export. 분포 bucket 집계의 입력 (score) source
- `docs/architecture/api.md` 108–112행 — `GET /api/summaries` (`?personId=&period=`, findByPerson, **personId 누락 시 400**, RBAC User+, T-0119/T-0123 박제, response = 일/주/월 시계열 요약 row 배열) — 본 slice 의 두 번째 조회 대상. summary row shape 은 frontend-local 최소 타입으로 정의 (period label + score/value 필드만 매핑; 정확한 backend DTO 전수 import 는 ③b-2/후속 DTO 공유 결정 전까지 보수적으로 최소 필드)
- `web/src/views/DashboardView.test.tsx` — **갱신 대상**. ③a 가 박제한 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock, jsdom·@testing-library 미사용, `.test.tsx` 확장자 고정) 을 그대로 따라 시계열/분포 case 를 추가

## Acceptance Criteria

- [ ] `web/src/views/DashboardView.tsx` 갱신 — 시계열 패널 조립 (controlled lift-up):
  - [ ] `GET /api/summaries?personId=&period=` path 를 파생하는 순수 helper (예 `buildSummariesPath(personId, period)`) 추가 — personId falsy 면 `null` 반환 (조회 미수행, api.md 109 의 400 회피). 이 path 로 `useApiResource<SummaryRow[]>(summariesPath)` 를 **두 번째** 호출해 컨테이너가 시계열 data/loading/error 를 소유.
  - [ ] summary row 배열 → `TrendPoint[]` (시점 label + value) 파생 순수 helper 추가. data 미도착이면 빈 배열로 간주. `TrendTimeSeriesPanel` 을 `<section>` 본문에 추가하고 파생 points/loading/error 를 props 로만 내려보낸다 — **컴포넌트 수정 0**.
- [ ] `web/src/views/DashboardView.tsx` 갱신 — 점수 분포 차트 조립 (client-side 파생):
  - [ ] 이미 fetch 한 assessments row (`visibleRows` 또는 raw `data`) 의 score 를 점수 구간 bucket 으로 집계하는 순수 helper (예 `deriveScoreBuckets(rows)`) 추가 — 빈 배열이면 빈 bucket 목록 반환. `ScoreDistributionChart` 를 `<section>` 본문에 추가하고 파생 buckets/loading/error 를 props 로만 내려보낸다 — **컴포넌트 수정 0**. **새 endpoint 0** (분포는 표시 데이터에서 파생).
  - [ ] 분포 집계의 bucket 경계 (예 0–20 / 20–40 / … / 80–100) 와 라벨은 컨테이너 helper 안에서 결정 (서버 aggregation 부재 — ADR-0040 §1 client-side). 경계값 (score == 경계, score 0, score 만점) 의 bucket 귀속 분기를 명확히 (off-by-one 회피).
- [ ] loading/error → props 경계 준수 — `TrendTimeSeriesPanel`·`ScoreDistributionChart` 는 fetch 를 모른다 (ADR-0041 Decision 1). 시계열은 summaries 조회의 loading/error, 분포는 assessments 조회의 loading/error 를 각각 받는다 (두 조회의 상태가 섞이지 않도록 분리).
- [ ] personId 미선택 분기 불변 — `!personId` 면 두 조회 모두 path=null (미수행) + 기존 안내 문구 유지 (시계열/분포 패널도 미선택 시 렌더 안 함 또는 빈 상태). assessments 조회 / summaries 조회가 독립적으로 personId 가드를 받음.
- [ ] `web/src/AppShell.tsx` **수정 0** — ③a 가 이미 `<DashboardView />` 를 마운트했으므로 본 slice 는 DashboardView 내부만 변경 (충돌 표면 최소, ADR-0041 Consequences §부정 cap 준수).
- [ ] 새 dependency 0 — `react` hooks (`useMemo`) + 기존 `useApiResource` 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `web/src/views/DashboardView.test.tsx` 갱신 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock). `.test.tsx` 확장자 고정. 추가 파생 helper·패널 배선에 대한 R-112 4 종:
  - [ ] happy-path: summaries 조회 성공 시 시계열 포인트가 `TrendTimeSeriesPanel` 로 렌더됨 1+ AND assessments row 로부터 분포 bucket 이 `ScoreDistributionChart` 로 렌더됨 1+.
  - [ ] error path: summaries 조회 실패 (error) 시 시계열 패널이 에러 표시 + 추이 미렌더 1+ / personId 미선택 시 시계열·분포 조회 미수행 + 패널 빈/미렌더 1+.
  - [ ] flow/branch: summaries loading 분기 (진행 표시) 1+ AND summaries empty (시계열 0 포인트) 분기 1+ / 분포 빈 bucket (assessments 0 건) 분기 1+ AND populated bucket 분기 1+.
  - [ ] negative cases 충분 cover: bucket 경계값 (score == 경계 / score 0 / score 만점) 의 귀속이 정확함 1+ / summary row 의 비정상/누락 필드 (value 누락·NaN) fallback 1+ / 시계열 조회와 분포 파생이 서로의 loading/error 를 오염시키지 않음 (한쪽 실패 시 다른 쪽 정상 표시) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — DashboardView.test.tsx (시계열/분포 신규 case 포함) + 기존 AppShell/AuthGate/useApiResource/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파생 helper (buildSummariesPath / TrendPoint 파생 / deriveScoreBuckets 등) line ≥ 80% AND function ≥ 80% 충족 (`pnpm --dir web test` coverage 리포트로 확인). web vitest 의 ci.yml 미배선은 T-0355 Follow-up 의 기존 tracked gap.

## Out of Scope

- 평가 상세 (`EvaluationDetailPanel`) · 페이지네이션 (`DashboardPaginationControl`) 의 대시보드 조립 — **wiring ③b-2 책임** (dependsOn T-0382). 본 slice 는 시계열 + 분포까지.
- `GET /api/contributions?assessmentId=` (기여 상세) fetch 배선 — ③b-2 책임 (본 slice 는 `GET /api/summaries` 만 추가; `GET /api/assessments` 는 ③a 박제 불변).
- 서버 측 분포 aggregation / 시계열 그룹핑 (period 그룹·이동평균·KST 경계 계산) — backend 는 plain CRUD (api.md). 본 slice 는 client-side 파생 (bucket 집계 · summary row → point 매핑) 만.
- Admin 화면 (`view === 'admin'`) · SuperAdmin 셋업 화면 컨테이너 조립 — wiring ④ 책임.
- personId 선택 UI 의 실 인원 목록 fetch (`GET /api/persons` 드롭다운) — ③b-2/④ 에서 결정. 본 slice 는 personId 입력/미선택 가드 + 조회 분기까지 (③a 와 동일).
- summary row 의 backend DTO 전수 타입 공유 (`src/` ↔ `web/` shape 공유 방식) — ADR-0040 §중립 별도 결정. 본 slice 는 frontend-local 최소 SummaryRow 타입 (period label + value 필드) 만 정의.
- 로그아웃 · 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration — 후속 slice (T-0380/T-0381 Out of Scope 그대로 유지).
- R-78 `evaluationInProgress` 실 polling + mutation 가드 — wiring ⑤ 책임.
- presentational 컴포넌트 (`TrendTimeSeriesPanel`/`ScoreDistributionChart`) 자체 수정 — controlled props 그대로 소비 (DashboardView 의 배선 지점만).
- react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 3 deferred 캐싱/dedup — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ③b-2** — DashboardView 에 `EvaluationDetailPanel`(`GET /api/contributions?assessmentId=`, row 선택 연동) + `DashboardPaginationControl`(client-side 페이지 상태) 조립 (useApiResource 재사용, dependsOn [T-0382]). 그 후 wiring ④ Admin 화면 조립, ⑤ R-78 polling. 그리고 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
