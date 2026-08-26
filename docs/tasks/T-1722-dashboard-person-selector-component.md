---
id: T-1722
title: 대시보드 평가 대상 인원 선택 presentational 컴포넌트 DashboardPersonSelector 신설 (REQ-074 slice 1)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-074]
estimatedDiff: 270
estimatedFiles: 2
independentStream: p6-dashboard-person-selection
dependsOn: []
touchesFiles:
  - web/src/components/DashboardPersonSelector.tsx
  - web/src/components/DashboardPersonSelector.test.tsx
created: 2026-08-26
prNumber: 1352
completedAt: 2026-08-26T16:11:59Z
plannerNote: P6 — 오너 지시 PLAN 131 행 ①(대시보드 인원 선택 UI) 분해 slice 1. 순수 presentational 컴포넌트만, 배선은 후속 slice
---

# T-1722 — 대시보드 평가 대상 인원 선택 컴포넌트 신설 (REQ-074 slice 1)

## Why

오너가 2026-08-26 에 [PLAN.md](../PLAN.md) `131 행` 🔴 bullet 으로 지시한 "대시보드 실동작" 4 항목 중
**① 대시보드 안에서 평가 대상 인원 선택 UI** 를 착수한다. 직전 slice T-1721 이 그 지시를
[requirements.md](../requirements.md) `93 행` [REQ-074](../requirements.md) row 로 동기했고, 본 task 가 그
row 를 `coversReq` 로 처음 집행한다.

실측 근거: [AppShell.tsx](../../web/src/AppShell.tsx) `315 행` 이 `<DashboardView />` 를 **무-prop** 으로
마운트하고, [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 는 `personId` 를 prop 으로만 받아
(`75~77 행`) 미선택이면 `49 행` 의 `NO_PERSON_TEXT`("평가 대상을 선택하면 결과가 표시됩니다") 만 렌더한다 —
**화면 안에 선택 수단이 0** 이라 사용자가 안내문에서 더 나아갈 수 없다. 이것이 오너가 지적한 "빈 상태에서
막힘" 의 직접 원인이다.

본 slice 는 [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) Decision 1 의 경계
(presentational 컴포넌트는 fetch 를 모르고 props 로만 소비, 데이터·상태는 컨테이너 소유) 를 지켜
**선택 UI 컴포넌트 1 개 + colocated spec** 만 신설한다. `GET /api/persons` 조회·`DashboardView` 상태
lift-up·`AppShell` 배선은 후속 slice 소관이라 본 task 에서 건드리지 않는다 (같은 방식으로 진행한
`DifficultyModelSelector`(T-1132) · `PersonList`(T-1141) 선례 승계 — 컴포넌트 → 배선 2 단 분해).

## Required Reading

- [web/src/components/DifficultyModelSelector.tsx](../../web/src/components/DifficultyModelSelector.tsx) — 본 컴포넌트가 그대로 차용할 선례: props-only controlled `<select>`, `loading` 우선 분기, `role="status"` / `role="alert"`, `named + default export` convention.
- [web/src/components/DifficultyModelSelector.test.tsx](../../web/src/components/DifficultyModelSelector.test.tsx) — colocated spec 선례: `vitest` + `react-dom/server` 의 `renderToStaticMarkup` 정적 렌더 문자열 검증 (jsdom·@testing-library 미사용, dep 표면 0 증가). 파일명은 `.test.tsx` 고정 (root jest `testRegex` pickup 충돌 회피).
- [web/src/components/PersonList.tsx](../../web/src/components/PersonList.tsx) `17~30 행` — `PersonRow` 필드 정의 (`id` / `fullName` / `email` / `active` / 선택적 `partId` · `createdAt`). 본 컴포넌트의 옵션 타입은 이 shape 의 부분집합으로 맞춘다.
- [web/src/components/GroupMemberList.tsx](../../web/src/components/GroupMemberList.tsx) — 이벤트를 발화할 수 없는 정적 렌더 환경에서 콜백을 검증하기 위해 **순수 export 함수**(`submitAdd` 계열) 를 분리한 선례.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `48~49 행` · `75~77 행` — 미선택 안내 문구와 `personId` prop 계약 (본 컴포넌트가 장차 채울 자리. 본 task 에서 이 파일은 **수정하지 않는다**).
- [docs/requirements.md](../requirements.md) `93 행` — REQ-074 원문 ("안내문만 있고 선택 수단이 없는 상태 금지").
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-112 test 4 종 + coverage 최소치 규칙.

## Acceptance Criteria

- [ ] `web/src/components/DashboardPersonSelector.tsx` 를 신설하고, 다음 **public symbol 3 개** 를 export 한다 (그 이상 늘리지 않는다):
  - `DashboardPersonSelector` (default export) — controlled presentational 컴포넌트.
  - `filterSelectablePersons(persons)` (named, 순수 함수) — `active === false` 인 인원만 제외하고 순서를 보존해 반환. `active` 가 `undefined` 면 **포함** (backend 응답 shape 다양성 보수적 수용 — `PersonList` 선례 동형).
  - `submitSelection(value, onSelect?)` (named, 순수 함수) — `value` 를 `trim` 한 뒤 `onSelect` 가 함수일 때만 정확히 1 회 호출하고 호출 여부를 `boolean` 으로 반환. 빈 문자열도 "선택 해제" 로 간주해 그대로 전달한다 (안내문 상태 복귀는 상위 컨테이너의 정당한 상태).
- [ ] props 계약: `persons` (필수) · `selectedId?` · `onSelect` (필수) · `loading?` · `error?`. 컴포넌트 안에서 `fetch` / `useApiResource` / 전역 상태를 **사용하지 않는다** (ADR-0041 Decision 1 경계 — import 0).
- [ ] 렌더 분기 3 갈래를 아래 순서로 구현한다:
  1. `loading === true` → `role="status"` 로딩 문구만 렌더 (`persons` 유무 무관 — loading 우선 정책).
  2. `error` 가 truthy → `role="alert"` 영역을 먼저 렌더하되 **아래 목록/빈 상태를 삼키지 않고 이어서 렌더** 한다 (에러가 선택 수단을 없애면 REQ-074 위반).
  3. `filterSelectablePersons(persons).length === 0` → `role="status"` 빈 상태 문구 (예: `선택 가능한 평가 대상 인원이 없습니다`). 그 외에는 `<select name="personId">` + placeholder `<option value="">` + 인원별 `<option>` 렌더.
- [ ] `<select>` 는 controlled — `value={selectedId ?? ''}` 이고, 알 수 없는 `selectedId` 는 throw 없이 placeholder 로 fallback 한다. `<option>` 라벨은 `fullName` 을 주 라벨로 쓰고 `email` 이 있으면 함께 표시한다 (동명이인 식별). 문구 상수는 `const` 로 파일 상단에 박제한다 (§12 한국어).
- [ ] `web/src/components/DashboardPersonSelector.test.tsx` 를 colocated 로 신설하고 아래를 cover 한다:
  - **happy-path 1+**: `persons` 3 인 + `selectedId` 지정 → `<select name="personId">` · placeholder option · 3 인 라벨이 모두 렌더되고, 선택된 인원 option 에 `selected` 가 반영되며, `role="status"` / `role="alert"` 분기로 빠지지 않음.
  - **happy-path (순수 함수) 1+**: `submitSelection('p2', onSelect)` → `onSelect` 가 `'p2'` 로 정확히 1 회 호출 + 반환 `true`. `filterSelectablePersons` 가 활성 인원 순서를 보존해 반환.
  - **error path 1+**: `error` 문구 전달 시 `role="alert"` 에 그 문구가 렌더되고 **동시에** `<select>` 와 인원 option 이 그대로 남아 있음 (에러가 선택 수단을 대체하지 않음).
  - **branch cover (각 1+)**: ① `loading === true` (로딩 문구만, `<select>` 미렌더) ② 빈 목록 (빈 상태 문구, `<select>` 미렌더) ③ 정상 목록 렌더 ④ `submitSelection` 의 `onSelect` 호출/미호출 두 갈래.
  - **negative cases 충분 cover (각 1+)**: ① `persons: []` → 빈 상태 문구 + throw 0 ② 전원 `active: false` → 필터 후 0 명이라 빈 상태 (원본 배열 mutate 0 도 함께 검증) ③ `selectedId` 가 목록에 없는 미지의 id → throw 없이 placeholder fallback, `selected` 속성 0 ④ `submitSelection('p1', undefined)` → throw 없이 `false` 반환 (콜백 미전달 안전성) ⑤ `submitSelection('  ', onSelect)` → `trim` 결과 빈 문자열이 그대로 전달되고 공백 원본은 전달되지 않음 ⑥ `email` 이 없거나 빈 문자열인 인원 → `undefined` / `()` 같은 깨진 라벨이 마크업에 노출되지 않음 ⑦ `fullName` 에 포함된 HTML 특수문자가 이스케이프되어 렌더 (마크업 주입 0).
- [ ] `pnpm --filter web test` 전량 green (기존 web 스위트 회귀 0).
- [ ] `pnpm --filter web build` (tsc --noEmit + vite build) green — 신규 타입 export 가 빌드를 깨지 않음.
- [ ] backend 는 `src/` · `test/` · `prisma/` · `.github/workflows/` · `package.json` diff **0 파일** 이라 전역 coverage 불변 — `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 를 유지함을 CI green 으로 확인한다.
- [ ] `git diff --name-only origin/main` 결과가 위 `touchesFiles` **2 파일 뿐** 이다.

## Out of Scope

- **`DashboardView.tsx` / `AppShell.tsx` 수정 일체** — 컴포넌트 마운트·`personId` 상태 lift-up·안내문(`NO_PERSON_TEXT`) 대체는 후속 배선 slice 소관. 본 task 는 컴포넌트를 **만들기만** 한다 (미마운트 상태로 머지되는 것이 정상 — `DifficultyModelSelector` · `PersonList` 선례 동형).
- **`GET /api/persons` 실 조회 배선** (`useApiResource` / `apiClient` 호출) — 컨테이너 책임.
- **REQ-075 (표시 필드 계약 정합) · REQ-076 (분포 축 스케일) · REQ-077 (기간 지정 UI)** — PLAN `131 행` 의 ②③④ 는 각각 별도 slice.
- **REQ-078 ~ REQ-084** (ServiceIdentity CRUD · 전역 CSS · 로그아웃 · 세션 복원 · polling · 오류 줄 단위 표시) — PLAN `132~133 행` 소관.
- **전역 CSS · `className` 체계 도입** — REQ-080 slice 소관. 본 컴포넌트는 기존 컴포넌트와 동일하게 스타일 없는 마크업만 낸다.
- **새 dependency 추가** (`@testing-library/*` · jsdom · CSS 라이브러리 등) — CLAUDE.md §5 게이트. 기존 `vitest` + `react-dom/server` 로만 검증한다.
- **backend 변경 · 새 ADR 작성** — 본 slice 는 ADR-0041 이 이미 박제한 경계 안에서만 움직인다.
- **`docs/` 갱신** (REQ-074 상태 전이 · api.md · modules.md) — doc-sync 는 별도 `direct` task.

## Suggested Sub-agents

`implementer` → `tester` (컴포넌트 + colocated spec). pr-mode 라 push 후 `reviewer` → `integrator` 4-게이트.

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
