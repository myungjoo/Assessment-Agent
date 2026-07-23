---
id: T-1162
title: AdminView 에 사용자 역할 변경 PATCH 배선 (runChangeRole + SuperAdmin gating)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 280
estimatedFiles: 2
independentStream: web-admin-user
dependsOn: [T-1161]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
created: 2026-07-24
plannerNote: P6 line120 Admin 사용자 관리 arc 5번째 slice — T-1161 이 연 onChangeRole 표면을 실 PATCH 러너 + SuperAdmin gating 으로 컨테이너에 배선
---

# T-1162 — AdminView 에 사용자 역할 변경 PATCH 배선 (runChangeRole + SuperAdmin gating)

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 5번째 slice 다. T-1158 (UserList 신설) → T-1159 (읽기 전용 마운트) → T-1160 (생성 mutation) → T-1161 (`onChangeRole` presentational 표면) 까지 왔지만, 컨테이너가 그 콜백을 전달하지 않아 README 84행 / REQ-044 의 **역할 승급·강등** (`PATCH /api/users/:id/role`) 이 아직 화면에서 발사되지 않는다.

본 task 는 T-1161 이 명시적으로 다음 slice 로 미룬 잔여 — `runChangeRole` 러너 · 실 PATCH 호출 · SuperAdmin gating · 진행/에러 상태 · `<UserList onChangeRole={...} />` 마운트 — 를 `runCreateUser` (T-1160) convention 1:1 mirror 로 채운다. backend 의 `PATCH /api/users/:id/role` 은 `@Roles("SuperAdmin")` 이므로, Admin 등급에게는 콜백 자체를 전달하지 않아 확정 403 요청을 사전에 차단한다 (기존 `isAdmin` fail-closed 정책 정합).

## Required Reading

- `web/src/views/AdminView.tsx` 1655~1702행 — `CreateUserDeps` 인터페이스 + `runCreateUser` 순수 async 러너 (발사 억제 가드 → `setCreating(true)` + error 비움 → 요청 → `bumpRefresh()` → catch 에서 error state → `finally` off). 본 task 의 `runChangeRole` 이 이 형태를 그대로 따른다.
- `web/src/views/AdminView.tsx` 3363~3395행 — 사용자 조회 (`useApiResource<UserRow[]>(usersPath)`) + 생성 state 4종 + `handleCreateUser` `useCallback` 배선. 새 state 와 핸들러를 이 블록 옆에 둔다.
- `web/src/views/AdminView.tsx` 3983~4028행 — 사용자 관리 섹션 JSX (heading + 생성 폼 + `<UserList users={usersData ?? []} loading error />`). 본 task 가 `onChangeRole` prop 과 실패 문구 `role="alert"` 를 추가할 지점. 4번째 줄 주석의 "역할 변경 배선은 후속 slice" 문구도 현재 사실로 갱신한다.
- `web/src/views/AdminView.tsx` 460~470행 (`isAdminRole`) + 2747~2756행 (`isAdmin` `useMemo` 파생) — `meData?.role` 로 등급을 파생하는 기존 방식. `isSuperAdmin` 파생을 이와 동형으로 추가한다 (loading / 조회 실패 / role 누락 → false, fail-closed).
- `web/src/views/AdminView.tsx` 100~110행 — `USERS_PATH = '/api/users'` 등 경로·문구 상수 블록. 역할 변경 실패 문구 상수를 여기에 추가한다.
- `web/src/components/UserList.tsx` (T-1161 머지분, 133행) — `onChangeRole?: (id: string, nextRole: string) => void` 시그니처와 렌더 규칙 (`role='User'` → `'Admin'` 인자 / `role='Admin'` → `'User'` 인자 / `SuperAdmin`·role 누락 → 버튼 0). 컴포넌트는 수정하지 않는다.
- `web/src/views/AdminView.test.tsx` 8291~8420행 — `runCreateUser` describe 의 mock deps 구성 + 409 문구 검증 convention. 본 task 의 새 describe 는 파일 끝에 append 하며 기존 test 는 수정하지 않는다.
- `src/user/user.controller.ts` 107~140행 — `@Patch(":id/role")` 이 `@Roles("SuperAdmin")` 이고 body 가 `{ role }` 단일 필드, 응답이 `UserResponseDto` 임을 재확인 (경로·body shape 정합용).

## Acceptance Criteria

- [ ] `web/src/views/AdminView.tsx` 에 `ChangeRoleDeps` 인터페이스 + `runChangeRole(id, nextRole, deps)` 순수 async 러너를 추가한다 (`runCreateUser` mirror). 동작: (a) `id` / `nextRole` 이 빈 값이거나 `deps.changing` 이면 미발사 no-op, (b) 발사 시 진행 on + 직전 error 비움, (c) `PATCH ${USERS_PATH}/${id}/role` 을 `Content-Type: application/json` + `JSON.stringify({ role: nextRole })` 로 호출, (d) 성공 시 `bumpRefresh()` 로 권위 재조회 (낙관 갱신 금지), (e) 실패는 throw 없이 error state 로 흡수, (f) `finally` 에서 진행 off.
- [ ] 실패 문구 분기: 403 (`ApiError.status === 403`) 은 권한 부족 전용 상수 문구, 그 외는 `toErrorMessage` 파생. 상수는 기존 상수 블록에 한국어로 추가한다.
- [ ] `isSuperAdmin` 파생을 `isAdmin` (2752행) 과 동형 `useMemo` 로 추가한다 — `!meLoading && meData?.role === 'SuperAdmin'`. loading / 조회 실패 / role 누락 / 소문자 등 미지 값은 모두 `false` (fail-closed).
- [ ] 컨테이너 state 2종 (`changingRole` in-flight, `changeRoleError`) + `handleChangeRole` `useCallback` 을 사용자 생성 state 블록 옆에 추가하고, `<UserList>` 에 `onChangeRole={isSuperAdmin ? handleChangeRole : undefined}` 로 전달한다. **Admin(비-SuperAdmin) 등급에서는 `undefined` 가 내려가 역할 버튼이 렌더되지 않는다.**
- [ ] `changeRoleError` 가 있을 때만 사용자 관리 섹션에 `<p role="alert">` 문구 1개를 렌더한다. 기존 `createUserError` alert 와 섞지 않는다 (별개 상태).
- [ ] happy-path unit test 1+ — `runChangeRole('u1', 'Admin', deps)` 가 `PATCH /api/users/u1/role` 을 body `{"role":"Admin"}` 으로 정확히 1회 호출하고, 성공 시 `bumpRefresh` 1회 + `setChangeError(undefined)` + 진행 on→off 순서가 성립한다. 강등 방향 (`'u2', 'User'`) 도 1+ test.
- [ ] error path unit test 1+ — (a) 요청이 403 `ApiError` 로 reject 하면 권한 부족 전용 문구가 error state 에 담기고 `bumpRefresh` 0회 + throw 0 (`resolves.toBeUndefined()`), (b) 500 / 네트워크 등 그 외 실패는 `describeError` 파생 문구가 담기고 역시 throw 0.
- [ ] 분기 cover — 각 1+ test: `changing === true` (미발사 no-op, 상태 전이 0) / `id` 빈 문자열 (미발사) / `nextRole` 빈 문자열 (미발사) / 성공 경로 / 403 실패 / 기타 실패 / `isSuperAdmin === true` (콜백 전달) / `isSuperAdmin === false` (콜백 `undefined`).
- [ ] negative cases 충분 cover — 각 1+ test: (a) `meData?.role` 이 `'Admin'` → `isSuperAdmin === false`, (b) `'superadmin'` 같은 소문자·미지 값 → `false`, (c) `meLoading === true` 또는 `meData` undefined → `false`, (d) 실패 후 재호출이 정상 발사되어 직전 error 가 비워진다 (error 잔류 금지), (e) 실패해도 `finally` 로 진행 flag 가 반드시 off 되어 UI 가 영구 잠기지 않는다, (f) `UserList` 에 `onChangeRole` 이 `undefined` 로 내려갈 때 기존 목록 렌더가 그대로 유지된다 (T-1159/T-1161 회귀 0).
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `AdminView.tsx` ≤ 120 LOC, `AdminView.test.tsx` ≤ 170 LOC. 초과 예상 시 (1) 주석을 mirror 선례 참조 한 줄 (`runCreateUser mirror`) 로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- `web/src/components/UserList.tsx` 수정 — T-1161 이 이미 콜백 표면을 완성했다 (컴포넌트 수정 0).
- 확인 다이얼로그 / 역할 3종 select box / 낙관적 UI 갱신 — 본 slice 는 버튼 클릭 → PATCH → 권위 재조회만.
- 자기 자신 강등 방지 (self-demote) 클라이언트 가드 — backend 정책 확인이 선행돼야 하므로 별도 task 후보.
- 역할 변경 후 access token 즉시 rotation (`user.controller.ts` 45~46행 주석의 알려진 잔여) — backend 사안.
- 사용자 삭제 UI — backend 에 `DELETE /api/users/:id` endpoint 자체가 없다.
- `web/src/api/apiClient.ts` · `useApiResource.ts` · backend (`src/`) · prisma schema · `docs/architecture/api.md` 수정.
- **(이월 1 — T-1160 reviewer MINOR)** AdminView 사용자 조회 주석 블록 재배치 — 본 task 가 같은 주석 블록의 "역할 변경 배선은 후속 slice" 문구를 갱신하므로, 그 한 줄 갱신은 범위 안이지만 주석 블록 전체 재배치는 하지 않는다.
- **(이월 2 — T-1160 reviewer MINOR)** RTL 등 상호작용 렌더 harness 부재 — 본 task 도 러너 직접 호출 + `renderToStaticMarkup` convention 을 그대로 따른다. harness 도입은 별도 task.
- **(이월 3 — T-1159 reviewer MINOR)** Admin+ endpoint 4종 무조건 조회 convention 전환 — 별도 task.
- **(이월 4 — T-1158 reviewer MINOR)** `web/` vitest coverage 수치 미강제 해소 — CI 인프라 사안, 별도 task.
- **(이월 5 — T-1158 reviewer MINOR)** `emptyMessage` 빈 문자열 truthy 처리의 4개 List 컴포넌트 일괄 수정 — 별도 task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
