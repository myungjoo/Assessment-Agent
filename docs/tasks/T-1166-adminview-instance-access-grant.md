---
id: T-1166
title: AdminView 에 사용자 인스턴스 접근 권한 부여 배선 (POST /api/users/:id/instance-access)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-016, REQ-044]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-07-24
independentStream: web-admin-user
dependsOn: [T-1165]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 line120 Admin 사용자 관리 arc 9번째 slice — shipped 됐지만 UI 0 인 instance-access grant 계약 배선
---

# T-1166 — AdminView 에 사용자 인스턴스 접근 권한 부여 배선 (POST /api/users/:id/instance-access)

## Why

PLAN.md P6 line 120 (Admin 패널) 사용자 관리 arc 의 9번째 slice 다. T-1158~T-1165 로 목록·생성·역할 변경까지 닫혔지만, backend 에 **이미 shipped 된** `POST /api/users/:id/instance-access` (ADR-0024 instance allowlist, REQ-016 접근 권한 인식 / REQ-044 사용자 권한 관리) 는 web UI 가 **0** 이라 사람이 화면에서 인스턴스 접근 권한을 부여할 경로가 없다. 계약은 있는데 표면이 없는 gap 이라 make-work 가 아니다.

본 task 는 grant(POST) 한 방향만 배선한다 — 이미 조회 중인 사용자 목록에서 대상 사용자를 고르고 인스턴스 주소를 입력해 부여하는 폼 + 순수 async 러너다. revoke(DELETE) 는 별도 slice 로 남긴다(한 slice 한 mutation — T-1153/T-1154 분리 선례 동형).

## Required Reading

- `src/user-instance-access/user-instance-access.controller.ts` 63행 `@Controller("api/users/:id/instance-access")` + 84~93행 `@Post()` — `@UseGuards(JwtAuthGuard, RolesGuard)` + **`@Roles("Admin")` (Admin+ tier — SuperAdmin 전용 아님)**, body 는 `{ instanceRef }`, 성공 201 Created. service 가 self-grant 403 / 중복 409 / unknown user 404 를 판정한다.
- `src/user-instance-access/grant-instance-access.dto.ts` 29~37행 `GrantInstanceAccessDto` — `instanceRef!: string` 에 `@IsString` / `@IsNotEmpty` / `@MaxLength(2048)`. 빈·공백만 값은 400 이므로 프런트에서 trim 후 발사 억제한다.
- `prisma/schema.prisma` 234~247행 `model UserInstanceAccess` — `@@unique([userId, instanceRef])` 가 중복 부여 시 P2002→409 의 근거다(409 전용 문구 정당화).
- `web/src/views/AdminView.tsx` 104~116행 — `USERS_PATH` 상수와 `USER_DUPLICATE_ERROR` / 역할 변경 403 전용 문구. 새 409 전용 문구는 이 상수 블록 옆에 같은 convention 으로 둔다.
- `web/src/views/AdminView.tsx` 1661~1707행 `CreateUserDeps` + `runCreateUser` — **본 task 러너의 1:1 mirror 원본**(가드 → 진행 on + error 비움 → 발사 → 성공/실패 분기 → `finally` 진행 off, throw 0, `isConflict` 409 분기).
- `web/src/views/AdminView.tsx` 1745~1760행 `runChangeRole` 의 path 조립 (`` `${USERS_PATH}/${encodeURIComponent(trimmedId)}/role` ``) — 본 task 의 `:id` path 조립이 따라야 할 인코딩 convention.
- `web/src/views/AdminView.tsx` 3473~3500행 — 사용자 생성 state(`userEmailInput` / `creatingUser` / `createUserError`) 선언과 `handleCreateUser` useCallback. 본 task 의 state·핸들러는 이 mirror 다.
- `web/src/views/AdminView.tsx` 4134~4176행 사용자 관리 섹션 (`<section aria-label="사용자 관리 섹션">` → 생성 폼 → `role="alert"` 문구 → `<UserList ...>`) — 새 폼은 **이 섹션 안**, `<UserList>` 아래에 둔다. 섹션 전체가 이미 `isAdmin` gating 안쪽이라 별도 gating 을 새로 만들지 않는다.
- `web/src/views/AdminView.tsx` 4498행~ test-only `export { ... }` 블록 (값 목록) 과 그 뒤 타입 export 목록 — 새 helper / 러너 / deps 타입을 같은 목록에 추가한다.
- `web/src/views/AdminView.test.tsx` 8299~8466행 `describe('AdminView — 사용자 생성 실 POST create mutation (T-1160 runCreateUser)')` 의 `makeDeps` harness — 본 task 의 새 describe 는 이 convention(러너 직접 호출 + mock deps, RTL 없음, 초기 렌더 단언은 `renderToStaticMarkup`)을 그대로 따른다.

## Acceptance Criteria

- [ ] `AdminView.tsx` 에 순수 helper `buildInstanceAccessPath(userId)` 를 추가한다 — `` `${USERS_PATH}/${encodeURIComponent(userId)}/instance-access` `` 를 돌려준다(`runChangeRole` 의 role path 조립 동형). test-only export 목록에 추가한다.
- [ ] 409 전용 한국어 문구 상수 1개(예: `INSTANCE_ACCESS_DUPLICATE_ERROR = '이미 부여된 인스턴스 접근 권한입니다'`)를 `USER_DUPLICATE_ERROR` 옆에 추가하고, 근거(`@@unique([userId, instanceRef])` → P2002 → 409)를 한국어 주석 한 줄로 남긴다.
- [ ] `GrantInstanceAccessDeps` + 순수 async 러너 `runGrantInstanceAccess(userId, instanceRef, deps)` 를 추가한다(`CreateUserDeps` / `runCreateUser` mirror). 계약: (a) `userId` 또는 trim 된 `instanceRef` 가 빈 값이거나 `granting` 이 true 면 **미발사**(상태 전이 0), (b) 발사 시 진행 on + 직전 error·성공 안내 비움, (c) `POST` (`headers: { 'Content-Type': 'application/json' }`, body `{ instanceRef: trimmed }`), (d) 성공 시 성공 안내 문구 set + 인스턴스 입력만 초기화(선택된 사용자 유지 — 연속 부여 편의), (e) 실패 시 409 면 전용 문구, 그 외 `describeError` 파생 문구를 error state 로 표면화하고 **throw 하지 않는다**, (f) `finally` 로 진행 off.
- [ ] 조회 계약 부재를 주석으로 박제한다 — instance-access 는 **GET(목록) endpoint 가 없어** 재조회 nonce bump 대신 성공 안내 문구(`role="status"`)로만 피드백한다는 근거 한국어 1~2줄. `usersRefreshNonce` 는 건드리지 않는다.
- [ ] 컨테이너에 grant 폼을 마운트한다 — 대상 사용자 `<select aria-label="접근 권한을 부여할 사용자">`(옵션은 이미 조회된 `usersData ?? []` 중 `id` 가 있는 행만, 라벨은 email 없으면 id fallback + 미선택 기본 옵션 1개) + `<input aria-label="부여할 인스턴스 주소">` + `type="button"` 버튼(라벨 예: `인스턴스 접근 권한 부여`) + 실패 `role="alert"` + 성공 `role="status"`. 사용자 미선택·입력 공백·진행 중이면 버튼과 입력을 비활성화한다(러너 가드와 이중 방어).
- [ ] 기존 사용자 생성 폼 / 역할 변경 / `UserList` 배선 / `createUserError`·`changeRoleError` alert 는 **한 줄도 바꾸지 않는다** (계약 회귀 0). 새 상태는 instance-access 전용 이름으로 분리해 다른 mutation 상태와 섞지 않는다.
- [ ] happy-path unit test 1+ — 유효 사용자 id + 인스턴스 주소로 러너 호출 시 `post` mock 이 `'/api/users/u1/instance-access'` path 와 `{ method: 'POST', body: JSON.stringify({ instanceRef: '<trim 값>' }) }` 로 정확히 1회 호출되고, 성공 안내 set · 입력 초기화 · 진행 on→off 순서가 확인된다.
- [ ] error path unit test 1+ — (a) 409 reject 시 error state 가 **전용 문구**이고 `describeError` 는 호출되지 않는다, (b) 403(self-grant) · 404(unknown user) · 400 · 네트워크 실패는 각각 `describeError` 파생 문구로 표면화되고 throw 가 새어나오지 않으며 성공 안내는 set 되지 않는다.
- [ ] 분기 cover — 각 1+ test: `granting` true(미발사) / 빈 `userId`(미발사) / 빈 `instanceRef`(미발사) / 공백만 `instanceRef`(미발사) / 409 분기 / 비-409 분기 / 성공 분기. 미발사 경로에서는 `post` · setter 호출이 **모두 0** 이어야 한다.
- [ ] negative cases 충분 cover — 각 1+ test: (a) 공백 padding 이 든 인스턴스 주소는 body 에 trim 된 값이 실리고, (b) slash·물음표 등이 든 사용자 id 는 `encodeURIComponent` 로 인코딩된 path 가 나가며(`buildInstanceAccessPath` 단독 test 포함), (c) 실패 후 재발사가 정상 통과한다(진행 플래그 영구 잠금 0), (d) 성공 직후 직전 error 문구가 남지 않고 실패 직후 직전 성공 안내가 남지 않는다(두 표면 상호 배타), (e) `AdminView` 초기 렌더(`renderToStaticMarkup`)에서 새 select·input·버튼이 사용자 관리 섹션 안에 존재하고 기존 사용자 목록·생성 폼 렌더가 회귀 0 이며, 비-Admin 렌더에서는 새 폼이 **미노출**(fail-closed) 이다.
- [ ] 기존 T-1159 / T-1160 / T-1162 / T-1164 / T-1165 describe 의 assertion 을 **하나도 삭제·약화하지 않는다** — 전부 그대로 통과해야 한다.
- [ ] `pnpm --dir web test` (vitest) 전체 green + `pnpm --dir web build` (tsc + vite) green. 루트 `pnpm lint` clean.
- [ ] `pnpm test:cov` 기준선 유지 — 본 task 는 `src/` 를 건드리지 않으므로 backend coverage (line ≥ 80% / function ≥ 80%) 가 그대로 통과해야 한다.
- [ ] 사이즈 게이트 — 최종 diff ≤ 300 LOC / 파일 2개. 목표 배분: `AdminView.tsx` ≤ 110 LOC, `AdminView.test.tsx` ≤ 180 LOC. 초과 예상 시 (1) 주석을 선례 참조(`runCreateUser` mirror) 한 줄로 압축하고 (2) 분기 / negative test 를 `it.each` 표로 합친다. **test 항목 자체를 빼서 줄이지 말 것** (R-112 위반).

## Out of Scope

- **revoke(`DELETE /api/users/:id/instance-access`) 배선** — 별도 slice. 본 task 는 grant 한 방향만.
- 인스턴스 접근 권한 **목록 표시** — backend 에 조회 endpoint 가 없다. 없는 계약을 프런트에서 추측 구현하지 않는다.
- `web/src/components/UserList.tsx` / `UserList.test.tsx` 수정 — 본 slice 는 컨테이너 폼이며 presentational 층 확장은 불요. 파일 수 cap 도 깨진다.
- `web/src/api/*` (apiClient · useApiResource) 수정 — 기존 `request` primitive 를 그대로 주입한다.
- 403(self-grant) / 404(unknown user) 전용 문구 분화 — 본 task 는 409 전용 문구 1개만. 나머지는 `toErrorMessage` 일반 경로.
- instanceRef 형식 검증(URL/host 파싱 · 2048 길이 cap 프런트 재구현) — backend DTO 가 판정한다.
- T-1165 의 `createInFlightIdGate` ref 패턴을 본 mutation 이나 다른 mutation 으로 확산 — 별도 task.
- backend (`src/`) · prisma schema · `deploy/daily-test.sh` · smoke drift-guard spec · `docs/architecture/*` 수정.
- `web/package.json` 의 vitest coverage threshold 도입 — `@vitest/coverage-v8` 새 외부 dependency 가 필요해 CLAUDE.md §5 게이트 대상이다(PLAN.md P6 backlog 에 박제됨).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
