---
id: T-0385
title: P6 composition wiring ④a Admin 화면 컨테이너 shell(AdminView + GET /api/groups + GroupMemberList 첫 패널 배선)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-028, REQ-046, REQ-047]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0384]
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx, web/src/AppShell.tsx]
plannerNote: "P6 wiring④a; ADR-0041 Decision1·3·5; AppShell view==='admin' 분기에 AdminView 컨테이너(controlled lift-up, GET /api/groups useApiResource + GroupMemberList 첫 패널) 조립; 나머지 4패널은 ④b/④c"
sizeExempt: false
---

# T-0385 — P6 composition wiring ④a Admin 화면 컨테이너 shell(AdminView + GET /api/groups + GroupMemberList 첫 패널 배선)

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 **④ (Admin 화면 조립)** 첫 fragment 를 잇는다. wiring ③ chain (③a~③b-3, T-0381~T-0384 머지 5615f50) 이 대시보드 컨테이너를 완성해 `AppShell` 의 `view === 'dashboard'` 분기는 실 `<DashboardView />` 를 렌더한다. 그러나 `view === 'admin'` 분기는 아직 placeholder 문구 (`AUTHED_VIEW_LABEL.admin = 'Admin 화면 (후속 slice 에서 조립)'`) 만 노출한다 (`web/src/AppShell.tsx` 28–31·72–76행). 본 slice 는 그 분기에 **Admin 화면 컨테이너 shell (`AdminView`)** 을 조립해 README REQ-028 (그룹·인원 다대다) / REQ-046·REQ-047 (Admin 관리 화면) 의 frontend 표면 첫 조각을 cover 한다.

전체 Admin 화면 (GET `/api/persons`·`/api/groups`·`/api/parts`·`/api/llm` + Admin+ RBAC + GroupMemberList·DifficultyModelSelector·ReEvaluationTriggerPanel·DataImportExportPanel·SchedulePanel 5 패널 배선) 은 cap (300 LOC / 5 파일) 을 크게 초과한다. 따라서 ③a→③b-1→③b-2→③b-3 split discipline (ADR-0041 Consequences §부정 — App.tsx·View 공유 수정은 잘게 split) 을 그대로 따라 본 **④a 는 컨테이너 shell + 첫 한 패널 (GroupMemberList) 배선까지로 국소화** 한다:

- **AdminView 컨테이너 shell** (`web/src/views/AdminView.tsx`, 신규): controlled lift-up (ADR-0041 Decision 1) — 컨테이너가 데이터 (`GET /api/groups`)·loading/error·선택 그룹 상태를 `useState`/`useApiResource` 로 소유하고, presentational `GroupMemberList` 는 props 로만 소비한다 (컴포넌트 **수정 0**). `useApiResource` (③a 박제 thin fetch hook) 를 **한 번** 호출해 그룹 목록을 받고, 그룹 선택 `<select>` 컨트롤로 한 그룹을 고르면 그 그룹의 멤버 배열을 `GroupMemberList` 의 `members` props 로 내려보낸다 (멤버 데이터는 그룹 목록 응답에 포함된 멤버 또는 group row 의 멤버 필드에서 client-side 파생 — 별도 `GET /api/groups/:id/members` 신규 fetch 는 ④b Out of Scope).
- **AppShell 배선** (`web/src/AppShell.tsx`): `view === 'admin'` 분기를 placeholder 문구 (`<p>{AUTHED_VIEW_LABEL.admin}</p>`) 에서 실 `<AdminView />` 마운트로 교체한다 (③a 가 dashboard 분기에 한 것과 동형). `AUTHED_VIEW_LABEL` 에서 `admin` 키 제거 + 타입 조정 (`superadmin-setup` 만 남김) — `superadmin-setup` 분기는 ⑤/후속까지 placeholder 유지.

본 slice 는 **zero-new-dep** — `react` hooks (`useState`/`useMemo`) + 기존 `useApiResource`/`GroupMemberList` import 만 추가하고, 기박제 presentational (`GroupMemberList`) 은 **수정 0** 으로 props 배선만 한다. axios·react-query·차트 라이브러리·jsdom·@testing-library 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0384]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `AppShell.tsx` 공유 수정이라 file-disjoint 불성립 (다른 stream 과 동시 claim 금지).

RBAC 측면: `GET /api/groups` 는 api.md 81행 기준 **User+** 라 인증된 모든 사용자가 읽을 수 있다 (Admin+ 전용 mutation 은 본 slice Out of Scope). 따라서 본 ④a 는 RBAC gating UI (Admin+ 미만 시 화면 차단) 없이 읽기 컨테이너만 조립하고, Admin+ RBAC gating 은 mutation 패널 (POST/PATCH/DELETE) 을 조립하는 ④b/④c 또는 후속에서 결정한다 (Out of Scope).

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up — 데이터/loading/error/선택 상태는 컨테이너 소유, presentational 은 props 소비) / Decision 3 (thin fetch hook `useApiResource` 재사용) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn) / Consequences §부정 (AppShell·View 공유 수정의 cap 준수 — 잘게 split)
- `docs/decisions/ADR-0040-frontend-stack.md` §1 (Admin 화면 채택 근거 — client-side interaction) / §5 (new-dep 게이트 — react/react-dom + native fetch 만, router/axios/react-query/차트라이브러리/jsdom/@testing-library 금지)
- `docs/architecture/api.md` 50·81–84행 — `GET /api/groups` (User+, 임의 group 목록, REQ-028) 응답 형태. group row 가 멤버를 포함하는지 여부에 따라 멤버 파생 방식 결정 (포함 안 하면 ④a 는 그룹 목록 + 선택 UI 까지만, 멤버 fetch 는 ④b — 본문에서 응답 형태 확인 후 결정하고 주석으로 근거 남김)
- `web/src/AppShell.tsx` — **갱신 대상** (85 LOC). 현재 `type View = 'login' | 'dashboard' | 'admin' | 'superadmin-setup'`, `AUTHED_VIEW_LABEL: Record<Exclude<View, 'login' | 'dashboard'>, string>` 에 `admin`·`superadmin-setup` placeholder 문구 보유, 본문 72–76행에서 `view === 'dashboard' ? <DashboardView /> : view === 'login' ? null : <p>{AUTHED_VIEW_LABEL[view]}</p>`. 본 slice 는 (1) `import AdminView from './views/AdminView'` 추가, (2) `AUTHED_VIEW_LABEL` 에서 `admin` 키 제거 (타입을 `Record<Exclude<View, 'login' | 'dashboard' | 'admin'>, string>` 로 좁힘 — `superadmin-setup` 만 남김), (3) 본문 분기에 `view === 'admin' ? <AdminView /> :` 절 추가. `dashboard`/`login`/`superadmin-setup` 분기·R-78 배너 슬롯·AuthGate·view 전환 핸들러는 불변
- `web/src/views/DashboardView.tsx` — **참조 (수정 0)**. ③a 가 박제한 컨테이너 패턴 (controlled lift-up + `useApiResource` 조건부 조회 + `initial*` props 주입으로 정적 렌더 검증 가능성 + 순수 helper export + presentational props 배선) 을 그대로 차용한다. 본 slice 의 AdminView 는 동형 구조 — `useApiResource` 한 번 호출 (`GET /api/groups`), 그룹 목록 → 선택 그룹 → 멤버 파생 → `GroupMemberList` 배선
- `web/src/api/useApiResource.ts` — **재사용 (수정 0)**. `useApiResource<T>(path: string | null, options?)` 가 `{ data, loading, error }` 반환. `path === null` 이면 조회 미수행. 본 slice 는 그룹 목록 조회에 한 번 사용 (조건부 가드 — 미인증/초기 상태는 AuthGate 가 이미 차단하므로 `'/api/groups'` 고정 path 로 무조건 조회해도 무방하나, ③a 의 조건부 조회 규약과 정합하게 path 파생 helper 를 둬도 됨 — 본문 결정)
- `web/src/components/GroupMemberList.tsx` — **재사용 (수정 0)**. props: `members: Member[]` (`{ id, name, role? }`), `loading?: boolean`, `error?: string`, `emptyMessage?: string`, `onRemove?: (memberId) => void`. `GroupMemberListProps`·`Member` 타입을 named import 해 배선 props 타입으로 쓴다 (frontend-local 재정의 금지). loading 우선 → error → 빈 데이터 → 목록 분기가 이미 박제 — 컨테이너는 그룹 선택 + 멤버 파생 + loading/error props 전달만 책임진다. `onRemove` 는 본 slice 미배선 (멤버 제거 mutation 은 ④b Out of Scope — 미전달 시 제거 버튼 미렌더)
- `web/src/views/DashboardView.test.tsx` — **참조 (수정 0)**. ③a~③b-3 가 박제한 colocated `.test.tsx` 패턴 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock, jsdom·@testing-library 미사용, `.test.tsx` 확장자 고정) 을 그대로 따라 AdminView.test.tsx 를 신설한다

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 신설 — Admin 화면 컨테이너 shell (controlled lift-up):
  - [ ] `useApiResource` 를 **한 번** 호출해 `GET /api/groups` 그룹 목록을 받는다 (③a thin fetch hook 재사용, 신규 fetch hook 작성 금지). 응답 row 의 frontend-local 최소 타입 (예 `GroupRow { id?, name?, members? }`) 을 보수적으로 정의해 누락/비정상 row 도 throw 없이 받는다 (③a~③b-2 의 frontend-local 최소 타입 convention 정합).
  - [ ] 그룹 선택 상태 (`selectedGroupId`) 를 `useState` 로 보유 + 그룹 선택 `<select aria-label="...">` 컨트롤 배선. 테스트 가능성을 위해 초기값 주입 (`initialSelectedGroupId?` props) 허용 (③a~③b-3 의 `initial*` 주입 패턴 정합).
  - [ ] 선택 그룹 → 멤버 배열 파생 순수 helper (예 `deriveMembers(groups, selectedGroupId)`) 추가 — 선택 그룹의 멤버를 `GroupMemberList` 의 `Member[]` 형태로 매핑한다 (id/name 누락 row 는 보수적 fallback). 그룹 응답이 멤버를 포함하지 않으면 빈 배열 + 주석으로 "멤버 fetch 는 ④b" 명시. 파생 결과를 `GroupMemberList` 의 `members` props 로 내려보낸다 — **컴포넌트 수정 0**.
  - [ ] `GroupMemberList` 에 `members`/`loading` (= 그룹 조회 loading)/`error` (= 그룹 조회 error) props 배선. `onRemove` 미전달 (멤버 제거 mutation 은 ④b Out of Scope — 제거 버튼 미렌더). `GroupMemberListProps`·`Member` 타입 named import (재정의 금지).
- [ ] loading/error → props 경계 준수 (ADR-0041 Decision 1) — `GroupMemberList` 는 fetch 를 모른다. 그룹 조회의 loading/error 를 컨테이너가 받아 props 로 내려보낸다. 그룹 미선택 시 (`!selectedGroupId`) 멤버 목록은 빈 상태 (`emptyMessage`) 또는 그룹 선택 안내를 표시한다 (본문 결정 + 주석 근거).
- [ ] `web/src/AppShell.tsx` 갱신 — `view === 'admin'` 분기를 placeholder 문구에서 실 `<AdminView />` 마운트로 교체:
  - [ ] `import AdminView from './views/AdminView'` 추가.
  - [ ] `AUTHED_VIEW_LABEL` 에서 `admin` 키 제거 (타입을 `Exclude<View, 'login' | 'dashboard' | 'admin'>` 로 좁힘 — `superadmin-setup` 만 남김). 본문 view 분기에 `view === 'admin' ? <AdminView /> :` 절 추가.
  - [ ] `dashboard`/`login`/`superadmin-setup` 분기·R-78 배너 슬롯·AuthGate·view 전환 핸들러 (`handleAuthenticated`)·`evaluationInProgress` 상태는 **불변**.
- [ ] 새 dependency 0 — `react` hooks (`useState`/`useMemo`) + 기존 `useApiResource`/`GroupMemberList` import 만 (router/axios/react-query/차트라이브러리/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `GroupMemberList.tsx` 등 presentational **수정 0** — controlled props 그대로 소비. 배선이 컴포넌트 수정을 요구하면 BLOCKED/Follow-up (file-disjoint·controlled 유지, ADR-0041 Decision 1).
- [ ] `web/src/views/AdminView.test.tsx` 신설 (vitest + `react-dom/server` renderToStaticMarkup, `apiClient.request`/`useApiResource` mock). `.test.tsx` 확장자 고정. AdminView 컨테이너 + 파생 helper (`deriveMembers` 등) 에 대한 R-112 4 종:
  - [ ] **happy-path**: 그룹 목록 조회 성공 + 그룹 선택 (`initialSelectedGroupId`) 시 그 그룹의 멤버가 `GroupMemberList` 로 렌더됨 1+ AND 그룹 선택 `<select>` 가 모든 그룹 옵션을 노출함 1+.
  - [ ] **error path**: 그룹 조회 loading 중 `GroupMemberList` 가 loading 표시 (props 로 loading 전달) 1+ / 그룹 조회 error 시 `GroupMemberList` 가 error alert 표시 (props 로 error 전달) 1+.
  - [ ] **flow/branch**: 그룹 미선택 (`!selectedGroupId`) 분기에서 빈 상태/선택 안내 렌더 1+ AND 다른 그룹 선택 시 멤버 집합이 달라지는 분기 1+.
  - [ ] **negative cases 충분 cover**: 그룹 응답이 빈 배열 (그룹 0 건) 일 때 안전 표시 (throw 없음) 1+ / 그룹 row 의 id·name·members 누락 시 보수적 fallback (throw/undefined 렌더 없음) 각 1+ / 선택된 `selectedGroupId` 가 그룹 목록에 없을 때 (stale 선택) 빈 멤버 안전 표시 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — AdminView.test.tsx (신규) + 기존 AppShell/AuthGate/DashboardView/useApiResource/컴포넌트 test 전부 green (AppShell.test 가 admin 분기 placeholder 를 단언한다면 그 단언도 AdminView 마운트로 갱신).
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파생 helper (`deriveMembers` / 그룹 path·선택 로직 등) line ≥ 80% AND function ≥ 80% 충족 (`pnpm --dir web test` coverage 리포트로 확인). 단 web vitest 는 아직 ci.yml 미배선 (T-0355 Follow-up 의 기존 tracked gap) 이고 `@vitest/coverage-v8` 미설치 (ADR-0040 §5 zero-new-dep) 라 coverage 는 신규 helper 의 분기별 spec 으로 **구성적 cover** 한다 — ③a~③b-3 와 동일.

## Out of Scope

- **나머지 4 Admin 패널 배선** — `DifficultyModelSelector` (난이도/모델 설정, GET/PATCH `/api/parts`·`/api/llm`) · `ReEvaluationTriggerPanel` (재평가 trigger, POST `/api/assessments/run`) · `DataImportExportPanel` (데이터 import/export) · `SchedulePanel` (스케줄 설정) 배선은 **④b/④c follow-up slice 책임**. 본 ④a 는 컨테이너 shell + GroupMemberList 첫 패널까지.
- **멤버 추가/제거 mutation** — `GroupMemberList` 의 `onRemove` 배선 (DELETE 멤버) · 멤버 추가 (`POST /api/groups/:id/members`) · 낙관적 업데이트 — ④b Out of Scope. 본 slice 는 그룹 멤버 **읽기 표시** 까지.
- **별도 `GET /api/groups/:id/members` fetch** — 그룹 응답이 멤버를 포함하면 client-side 파생, 포함 안 하면 본 slice 는 그룹 목록 + 선택 UI 까지만 하고 멤버 fetch 는 ④b (본문에서 api.md 응답 형태 확인 후 결정·주석 근거).
- **Admin+ RBAC gating UI** — Admin+ 미만 사용자 화면 차단/패널 비활성. `GET /api/groups` 는 User+ 라 읽기에는 gating 불요. mutation 패널 (④b/④c) 조립 시 RBAC gating 결정. 본 slice 는 읽기 컨테이너만.
- **`GET /api/persons`·`/api/parts`·`/api/llm` 조회 배선** — ④b/④c 또는 후속. 본 slice 는 `GET /api/groups` 한 조회만.
- **`view === 'superadmin-setup'` 분기 컨테이너 조립** (`SuperAdminSetupForm` 배선) — 후속 slice. 본 slice 는 placeholder 유지.
- **세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선** — 후속 slice (이전 task Out of Scope 그대로 유지).
- **R-78 `evaluationInProgress` 실 polling + mutation 가드** — wiring ⑤ 책임.
- **react-router · @tanstack/react-query · axios · 차트 라이브러리 · jsdom · @testing-library 등 새 dependency 도입** (ADR-0041 Decision 2·3 deferred — §5-gated, 사용자 승인 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: **wiring ④b Admin 패널 2~3** — AdminView 에 `DifficultyModelSelector` (GET/PATCH `/api/parts`·`/api/llm`) + `ReEvaluationTriggerPanel` (POST `/api/assessments/run`) 배선 + 멤버 추가/제거 mutation (`onRemove` 배선) + Admin+ RBAC gating. 그 후 **④c** — `DataImportExportPanel` + `SchedulePanel` 배선. 그 후 **⑤** R-78 `evaluationInProgress` 실 polling + EvaluationGuardBanner 토글 + mutation 가드. 그리고 `superadmin-setup` view 컨테이너 (`SuperAdminSetupForm`) 조립 / 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration / personId 선택 드롭다운 `GET /api/persons` 배선.)
