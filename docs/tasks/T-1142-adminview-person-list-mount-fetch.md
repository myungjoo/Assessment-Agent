---
id: T-1142
title: AdminView 에 PersonList 마운트 + GET /api/persons 실 fetch 배선
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-023]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-frontend-person
dependsOn: [T-1141]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 패널 "인원" — T-1141 presentational 을 AdminView 에 마운트 + GET /api/persons 실 fetch(useApiResource, T-1140 mount 패턴 mirror), pr web 2파일
---

# T-1142 — AdminView 에 PersonList 마운트 + GET /api/persons 실 fetch 배선

## Why

P6 line 120 Admin 패널 bullet 이 명시한 관리 대상 "인원(Person)" 은 backend
(`GET /api/persons` — active 인원 `Person[]` 반환, PersonController T-0036 박제)와 읽기 전용
presentational 컴포넌트(T-1141, `PersonList`)까지 완결됐으나, 아직 **어느 화면에도 마운트되지 않아
사람이 볼 수 없다** — Person 은 재평가 패널의 `<select>` 옵션으로만 등장할 뿐 관리 목록이 없다. 본
slice 는 직전 T-1140 (DashboardView 마운트) 과 동일한 mount + 실 fetch 방식으로, Admin 전용 컨테이너인
AdminView 에 `useApiResource` 로 인원 목록을 조회해 `PersonList` 에 props 로 전달한다. Person 관리 CRUD
mutation 은 이후 별도 slice 가 담당한다. REQ-049(인원 관리 UI)·REQ-023(인원 리소스 표면화) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 마운트 대상 컨테이너. `useApiResource` 로 데이터 소유 + presentational 컴포넌트에 props 전달하는 기존 배선 패턴(GroupMemberList / LlmProviderConfigList 마운트, buildXxxPath 상수)을 그대로 mirror. Person 은 mutation 없는 단순 read-only 마운트라 nonce 재조회 불필요.
- `web/src/components/PersonList.tsx` — 마운트할 컴포넌트. default export `PersonList` + named type `PersonRow`/`PersonListProps`(props: `persons`/`loading?`/`error?`/`emptyMessage?`). 컴포넌트 파일 수정 0.
- `web/src/api/useApiResource.ts` — fetch hook 계약(`useApiResource<T>(path)` → `{ data, loading, error }`, `path` falsy 면 미조회). 수정 0.
- `web/src/views/AdminView.test.tsx` — colocated test. 기존 useApiResource / apiClient mock 방식과 다른 패널 마운트 test 구성을 참조해 회귀 없이 새 섹션 test 를 추가한다.
- `src/user/person.controller.ts` (L52~63) — `GET /api/persons` 계약(active 인원 `Person[]` 배열 반환). 응답 shape 확인용(수정 금지 — 읽기 참조).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `PersonList` 를 default import + `PersonRow` 를 named type import 로 추가(컴포넌트 파일 수정 0).
- [ ] 새 `useApiResource<PersonRow[]>('/api/persons')` 호출을 추가해 인원 목록을 조회하고, 그 `data`/`loading`/`error` 를 `PersonList` 의 `persons`/`loading`/`error` props 로 전달(마운트). path 상수는 파일 상단에 `const PERSONS_PATH = '/api/persons'` 형태로 박제.
- [ ] `data` 가 `undefined`(미조회/진행 중/실패) 일 때 `persons` 로 빈 배열을 안전하게 넘겨 컴포넌트가 throw 없이 렌더되도록 처리(예: `data ?? []`).
- [ ] 마운트 위치는 기존 패널들과 시각적으로 구분되는 별도 섹션(예: heading "인원 관리" + 컴포넌트). 문구는 §12 한국어. 필터/재조회/mutation/query param 배선은 하지 않는다(읽기 전용 마운트).
- [ ] backend(`src/user/person*`)·`apiClient`·`useApiResource`·`PersonList` 컴포넌트 수정 0 — 본 task 는 AdminView 2파일(컨테이너 + colocated test)만.
- [ ] **Happy-path test**: fetch 가 인원 1+ 를 반환하면 AdminView 렌더에 각 인원의 fullName·email·active 라벨이 표면화되는지 1+ test(`useApiResource` 또는 `apiClient.request` mock).
- [ ] **Error path test**: fetch 가 error 를 반환(예: 401/네트워크)하면 인원 섹션이 `role="alert"` 에러 표면을 렌더하고 목록은 미렌더하는지 1+ test.
- [ ] **분기 test**: loading 중(로딩 표면 우선) / 빈 배열(빈 상태 문구) / populated 각 분기 1+ test. 기존 AdminView 다른 패널 test 는 회귀 없이 유지.
- [ ] **Negative cases 충분 cover**: 경계·예외 각 1+ — `data` undefined 시 `data ?? []` 로 throw 없이 렌더, active=false 인원 행의 상태 라벨 표시, `partId` 없는 인원 행이 throw 없이 렌더, 다건 key 중복 없음. 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc/vite) green. web 커버리지 게이트(line ≥ 80% / function ≥ 80%) 통과.

## Out of Scope

- Person 생성/수정/삭제/deactivate/reactivate mutation UI — 각각 별도 후속 slice.
- 필터(active-only / part 별 query param)·정렬·페이지네이션 — 후속 slice.
- 재조회 nonce / mutation 배선(본 slice 는 순수 read-only 마운트라 nonce 불필요).
- DashboardView 에도 별도 마운트(인원 관리는 Admin 관심사 = AdminView 로 충분).
- `PersonList` 컴포넌트 자체 수정, `useApiResource`/`apiClient`/backend 수정.
- api.md 갱신(endpoint 이미 박제됨).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
