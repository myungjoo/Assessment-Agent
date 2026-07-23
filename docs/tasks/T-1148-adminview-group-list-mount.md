---
id: T-1148
title: AdminView 에 GroupList 마운트 (기존 GET /api/groups fetch 재사용, 읽기 전용 그룹 목록 섹션)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-028]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-group
dependsOn: [T-1147]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 그룹 관리 — T-1147 GroupList presentational 을 AdminView 에 마운트. 기존 useApiResource<GroupRow[]>(groupsPath) fetch 재사용(double-fetch 금지), 읽기 전용 목록 섹션. T-1142 person mount mirror, pr web 2파일
---

# T-1148 — AdminView 에 GroupList 마운트 (기존 GET /api/groups fetch 재사용, 읽기 전용 그룹 목록 섹션)

## Why

P6 PLAN.md line120 Admin 패널 bullet 은 관리 대상으로 "인원·그룹·재평가·import/export·스케줄" 을 명시한다. 인원(Person) 관리는 presentational-first → mount → CRUD 패턴(T-1141 → T-1142 → T-1143~T-1145)으로 완결됐고, 그룹(Group) 은 읽기 전용 presentational 컴포넌트(T-1147 `GroupList`)까지 신설됐으나 **아직 어느 화면에도 마운트되지 않아 사람이 그룹 목록 카드를 볼 수 없다** — 그룹은 재평가/멤버 관리용 `<select>` 드롭다운과 생성 폼(T-1146)으로만 등장할 뿐 관리 목록이 없다. 본 slice 는 직전 T-1142(PersonList 마운트)와 동일한 방식으로 AdminView 에 `GroupList` 를 마운트해 그룹 스칼라 목록을 별도 섹션으로 표면화한다. 단, AdminView 는 이미 `<select>` 드롭다운용으로 `useApiResource<GroupRow[]>(groupsPath)` 로 그룹 목록을 fetch 하므로 **본 slice 는 그 기존 fetch 결과를 재사용**하고 새 fetch 를 추가하지 않는다(double-fetch 회피). 그룹 삭제/수정 mutation 배선은 이후 별도 slice 가 담당한다. REQ-049(Admin 관리 UI)·REQ-028(임의 Group 등록 표면화) cover.

## Required Reading

- `web/src/views/AdminView.tsx` — 마운트 대상 컨테이너. 특히:
  - 기존 그룹 fetch: `const { data } = useApiResource<GroupRow[]>(groupsPath)` (약 line 1798, `buildGroupsPath(groupsRefreshNonce)`). 본 slice 는 이 destructure 를 `{ data, loading, error }` 로 확장해 재사용한다(새 `useApiResource` 호출 추가 금지).
  - 로컬 `interface GroupRow` (약 line 327, `id?` / `name?` / `members?` / `persons?`). GroupList 도 자체 `GroupRow` 를 named export 하므로 **이름 충돌 주의** — 기존 로컬 `GroupRow` 를 그대로 GroupList 에 넘긴다(구조적 타입 호환). GroupList 의 `GroupRow` 를 별도 import 하지 않는다(중복 식별자 회피).
  - 직전 인원 마운트 섹션(약 line 3011~3119, `PERSON_HEADING` + `<PersonList ... />`)의 heading + 별도 섹션 배선 convention 을 mirror.
- `web/src/components/GroupList.tsx` — 마운트할 컴포넌트. `default export GroupList` + props `groups: GroupRow[]` / `loading?` / `error?` / `emptyMessage?` / optional `onDelete?` / `onEdit?`. 컴포넌트 파일 수정 0. 본 slice 는 `onDelete`/`onEdit` 는 **전달하지 않는다**(읽기 전용 마운트 — 버튼 미렌더).
- `web/src/api/useApiResource.ts` — fetch hook 계약(`useApiResource<T>(path)` → `{ data, loading, error }`). 수정 0.
- `web/src/views/AdminView.test.tsx` — colocated test. 기존 useApiResource / apiClient mock 방식과 다른 패널 마운트 test 구성을 참조해 회귀 없이 그룹 목록 섹션 test 를 추가한다.
- `src/user/group.controller.ts` (L92~98 `@Get()`) — `GET /api/groups` 계약(그룹 배열 반환). 응답 shape 확인용(수정 금지 — 읽기 참조).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `GroupList` 를 default import 로 추가(컴포넌트 파일 수정 0). GroupList 의 named type `GroupRow` 는 import 하지 않고 기존 로컬 `GroupRow` 를 재사용한다(이름 충돌 회피 — 구조적 호환으로 props 전달).
- [ ] 기존 그룹 fetch(`useApiResource<GroupRow[]>(groupsPath)`)의 destructure 를 `{ data, loading, error }` 로 확장해 그 값을 `GroupList` 의 `groups`(=`data ?? []`)/`loading`/`error` props 로 전달(마운트). **새 `useApiResource` 호출을 추가하지 않는다**(그룹 목록은 이미 조회 중 — double-fetch 회피). 기존 `<select>` 드롭다운·생성 폼·멤버 패널 배선은 손대지 않는다.
- [ ] `data` 가 `undefined`(미조회/진행 중/실패) 일 때 `groups` 로 빈 배열을 안전하게 넘겨(`data ?? []`) 컴포넌트가 throw 없이 렌더되도록 처리.
- [ ] 마운트 위치는 기존 패널들과 시각적으로 구분되는 별도 섹션 — heading 상수(예: `const GROUP_HEADING = '그룹 관리'`) + `<GroupList />`. 문구는 §12 한국어. `onDelete`/`onEdit` 는 전달하지 않는다(삭제/수정 mutation 은 후속 slice — 버튼 미렌더).
- [ ] backend(`src/user/group*`)·`apiClient`·`useApiResource`·`GroupList` 컴포넌트 수정 0 — 본 task 는 AdminView 2파일(컨테이너 + colocated test)만.
- [ ] **Happy-path test**: 그룹 fetch 가 그룹 1+ 를 반환하면 AdminView 렌더의 그룹 관리 섹션에 각 그룹 name 이 표면화되는지 1+ test(`useApiResource` 또는 `apiClient.request` mock).
- [ ] **Error path test**: 그룹 fetch 가 error 를 반환(예: 401/네트워크)하면 그룹 관리 섹션이 `role="alert"` 에러 표면을 렌더하고 목록은 미렌더하는지 1+ test.
- [ ] **분기 test**: loading 중(로딩 표면 우선) / 빈 배열(빈 상태 문구) / populated 각 분기 1+ test. 기존 AdminView 다른 패널 test(인원·그룹 select·생성·멤버)는 회귀 없이 유지.
- [ ] **Negative cases 충분 cover**: 경계·예외 각 1+ — `data` undefined 시 `data ?? []` 로 throw 없이 렌더 / `name` 없는 그룹 행이 placeholder 로 throw 없이 렌더 / 다건 그룹 key 중복 없음 / `onDelete`/`onEdit` 미전달이므로 행에 삭제·수정 버튼이 렌더되지 않음(읽기 전용 검증) / loading 이 error 보다 우선(둘 다 truthy). 단일 negative 만 두지 않는다.
- [ ] `pnpm --dir web test`(vitest) 통과 + `pnpm --dir web build`(tsc/vite) green, lint clean. web 커버리지 게이트(line ≥ 80% / function ≥ 80%) 통과.

## Out of Scope

- 그룹 삭제(DELETE /api/groups/:id)·수정(PATCH /api/groups/:id) mutation 러너·버튼 배선 — 각각 별도 후속 slice(본 task 는 `onDelete`/`onEdit` 미전달 = 읽기 전용 마운트까지만).
- 새 `useApiResource` 호출 추가 — 기존 groupsPath fetch 를 재사용한다(double-fetch 금지).
- 그룹 생성 폼(T-1146)·`<select>` 드롭다운·멤버 관리 패널 수정.
- 필터/정렬/페이지네이션(상위 컨테이너 책임).
- `GroupList` 컴포넌트 자체 수정, `useApiResource`/`apiClient`/backend 수정.
- api.md 갱신(endpoint 이미 박제됨).
- 다른 stream(인원·LLM provider·permission-denied) 파일 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
