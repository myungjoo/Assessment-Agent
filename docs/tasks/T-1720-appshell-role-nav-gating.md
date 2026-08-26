---
id: T-1720
title: AppShell 인증 사용자 등급 hydration + 내비게이션 노출 차등 배선 (REQ-073 slice 3)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-073, REQ-070]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-08-26
independentStream: evaluation-target-ui
dependsOn: [T-1719]
touchesFiles:
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
plannerNote: P6 오너 지시(PLAN 130 행 🔴) 분해 slice 4 — T-1718 정보원 + T-1719 판정 규칙을 AppShell nav 노출 차등으로 실제 소비한다.
---

# T-1720 — AppShell 인증 사용자 등급 hydration + 내비게이션 노출 차등 배선 (REQ-073 slice 3)

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `130 행` 🔴 (평가 대상 추가·편집 인터페이스, REQ-070~REQ-073) 분해 slice 4. slice 1([T-1717](T-1717-appshell-authed-view-nav.md))이 인증 후 대시보드↔관리 전환 동선을 살렸고, slice 2([T-1718](T-1718-web-fetch-current-user.md))가 `fetchCurrentUser()` 로 role **정보원** 을, slice 3([T-1719](T-1719-web-role-access-policy.md))이 `canEditAssessmentTargets` 로 **판정 규칙** 을 열었다. 그런데 이 둘의 **소비처가 아직 0** 이다 — `web/src/AppShell.tsx` 는 여전히 `AUTHED_NAV_ITEMS` 전체를 등급 무관하게 렌더하고, `fetchCurrentUser` 를 호출하는 코드가 web 전체에 없다. 즉 User 등급으로 로그인해도 "관리" 항목이 그대로 보이고 클릭하면 AdminView 가 렌더된다(backend `RolesGuard` 가 실 mutation 을 막지만, UI 는 REQ-073 "User 등급은 조회만" 을 반영하지 못한 상태).

REQ-073 ([requirements.md](../requirements.md) `92 행`) 을 UI 표면에서 실제로 만족시키려면 (a) 인증 후 현재 사용자 등급을 **한 번 적재** 하고 (b) 그 등급으로 내비게이션 항목을 **필터** 해야 한다. 본 slice 는 그 두 가지만 배선한다 — 적재 판단(`shouldLoadCurrentUser`)과 항목 필터(`visibleNavItems`)를 **순수 함수로 분리** 해, web 에 `@testing-library/react` 가 없는 제약(ADR-0040 §5 새-dep 게이트) 아래에서도 결정 로직이 단위 검증되게 한다(`isNavItemActive`(T-1717) · `buildSetupErrorMessage`(T-1714) 선례 승계). 화면 자체의 view-level gating 과 AdminView 내부 편집 컨트롤 차등은 후속 slice — 한 task 에 합치면 cap(≤ 300 LOC / 5 파일)을 넘고 검증 축(내비 노출 / 패널 내부 차등)도 섞인다.

## Required Reading

- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `30~70 행`(`View` · `DEFAULT_AUTHED_VIEW` · `AUTHED_NAV_ITEMS` · `isAuthedView` · `isNavItemActive`), `104~125 행`(`AppShellProps` · state 선언부), `200~232 행`(`AuthGate` children 안의 `<nav>` 렌더와 view 분기) — 본 task 의 유일한 production 수정 대상.
- [web/src/api/roleAccess.ts](../../web/src/api/roleAccess.ts) — T-1719 가 연 판정 규칙(`canEditAssessmentTargets` · `canViewAssessmentTargets` · `hasRoleAtLeast`). 본 task 는 **import 만** 하고 수정하지 않으며, 등급 비교를 인라인으로 재구현하지 않는다.
- [web/src/api/auth.ts](../../web/src/api/auth.ts) `125~185 행` — `fetchCurrentUser(): Promise<CurrentUser | null>` 의 계약(401/404/필드 결손 → `null`, 5xx·네트워크는 **전파**) 과 `CurrentUser` 타입. 수정하지 않는다.
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) `1~30 행`(정적 렌더 방식 · 식별 토큰 관례) 과 `285~310 행`(기존 `AUTHED_NAV_ITEMS` 목록 단언) — 본 task 가 확장할 colocated spec. 기존 케이스는 삭제하지 않는다.
- [docs/requirements.md](../requirements.md) `92 행` — REQ-073 row (본 task 에서 수정하지 않는다).

## Acceptance Criteria

- [ ] `web/src/AppShell.tsx` 에 순수 함수 `visibleNavItems(user: CurrentUser | null | undefined)` 를 named export 로 추가한다 — `AUTHED_NAV_ITEMS` 를 단일 근거로 삼아 필터한 배열을 반환하고, "관리"(`admin`) 항목은 `canEditAssessmentTargets(user)` 가 `true` 일 때만 포함한다. "대시보드"(`dashboard`) 항목은 인증 후 항상 포함한다(REQ-073 "User 등급은 조회만" — 조회 동선은 막지 않는다). 등급 비교 문자열(`'Admin'` 등)을 이 파일에 다시 적지 않고 `roleAccess` 판정만 사용한다.
- [ ] 항목별 필요 등급은 `AUTHED_NAV_ITEMS` 항목 자체에 표식(예: `editOnly: true`)으로 두고 `visibleNavItems` 가 그 표식을 읽게 한다 — view 문자열을 함수 안에 하드코딩해 분기하지 않는다(항목 추가 시 수정 지점 1 곳).
- [ ] `web/src/AppShell.tsx` 에 순수 함수 `shouldLoadCurrentUser(view: View, currentUser: CurrentUser | null | undefined)` 를 named export 로 추가한다 — 인증 후 view(`isAuthedView`) 이고 아직 적재된 사용자가 없을 때만 `true`. 미인증 view(`login` · `superadmin-setup`)이거나 이미 사용자가 있으면 `false`(중복 조회 방지).
- [ ] `AppShell` 이 `currentUser` state 를 보유하고, `useEffect` 안에서 `shouldLoadCurrentUser(...)` 가 `true` 일 때만 `fetchCurrentUser()` 를 1 회 호출해 결과를 state 에 반영한다. 조회 실패(reject — 5xx·네트워크)는 **삼켜서 조회-전용 상태(`null`)를 유지** 하고 렌더를 깨지 않는다(사용자에게 편집 권한을 임의로 부여하지 않는 fail-safe). 언마운트/재진입 경쟁 상태를 막는 cancel 플래그를 둔다.
- [ ] `AppShellProps` 에 `initialCurrentUser?: CurrentUser | null` 주입점을 추가한다(기본 미설정 → `null`). `renderToStaticMarkup` 은 effect 를 실행하지 않으므로, 등급별 내비 렌더를 정적 렌더로 검증하기 위한 주입점이다(`initialView` · `AuthGate.initialAuthenticated` 선례와 동형).
- [ ] `<nav>` 렌더가 `AUTHED_NAV_ITEMS` 직접 map 대신 `visibleNavItems(currentUser)` 결과를 map 한다. `isNavItemActive` 활성 표식 동작은 변경하지 않는다.
- [ ] R-112 happy-path: ① `visibleNavItems({ id, email, role: 'Admin' })` 이 `dashboard` · `admin` 두 항목을 모두 포함하는 test 1+, ② `renderToStaticMarkup(<AppShell initialView="dashboard" initialCurrentUser={{ ..., role: 'Admin' }} />)` 결과에 "관리" 버튼(`app-shell-nav-item-admin`)이 존재하는 test 1+.
- [ ] R-112 error path: `fetchCurrentUser` 가 reject 하는 상황에 해당하는 상태(= 적재 실패로 `currentUser` 가 `null` 로 남음)에서 `visibleNavItems(null)` 이 throw 없이 조회 항목만 반환하는 test 1+. `shouldLoadCurrentUser` 에 타입을 우회한 비정상 view(빈 문자열 등)를 넘겨도 throw 없이 `false` 인 test 1+.
- [ ] R-112 분기 cover — `visibleNavItems` 각 분기 1+ test: (a) `role: 'Admin'`, (b) `role: 'SuperAdmin'`, (c) `role: 'User'`, (d) `user` 가 `null`, (e) `user` 가 `undefined`, (f) 미지 role 문자열. `shouldLoadCurrentUser` 각 분기 1+ test: (g) 인증 view + 미적재 → `true`, (h) 인증 view + 적재 완료 → `false`, (i) 미인증 view(`login`) + 미적재 → `false`, (j) `superadmin-setup` + 미적재 → `false`.
- [ ] R-112 negative 충분 cover — 각 1+ test: ① `role: 'User'` 일 때 `visibleNavItems` 결과에 `admin` 항목이 **없다**, ② 같은 조건의 정적 렌더 결과 HTML 에 "관리" 라벨과 `app-shell-nav-item-admin` 이 **없다**, ③ `role: ''`(빈 문자열) → `admin` 미포함, ④ `role: 'admin'`(소문자) → `admin` 미포함, ⑤ `role: 'Root'`(미지 등급) → `admin` 미포함, ⑥ `initialCurrentUser` 미주입(적재 전 초기 상태) → "관리" 미렌더이면서 "대시보드" 는 렌더(조회 동선 무회귀).
- [ ] 기존 spec 무회귀 — `AUTHED_NAV_ITEMS` 목록 오염 방지 test 를 포함한 기존 `AppShell.test.tsx` 케이스를 삭제·약화하지 않는다(항목에 표식 필드가 추가돼 단언이 깨지면 필드 추가에 맞춰 **보강** 하되 기존 검증 의도는 보존).
- [ ] `pnpm --dir web lint` · `pnpm --dir web build` · `pnpm --dir web test` 3 종 green. 추가로 root `pnpm test:cov` 를 돌려 line ≥ 80% / function ≥ 80% 무회귀 확인(`src/` diff 0 이므로 자동 무회귀 — web 은 `coverageThreshold` 미도입, PLAN `127 행` 게이트된 backlog).
- [ ] 새 dependency 0 · `src/` diff 0 파일 · `web/src/api/auth.ts` · `web/src/api/roleAccess.ts` · `web/src/views/AdminView.tsx` · `test/e2e/` · `web/package.json` diff **0 파일**.

## Out of Scope

- **view-level gating** — `view === 'admin'` 일 때 `AdminView` 자체를 권한으로 막는 분기는 후속 slice. 본 slice 는 내비 노출만 차등한다(권한 없는 사용자에게 도달 컨트롤이 사라지고, 실 mutation 은 backend `RolesGuard` 가 정본으로 집행하므로 보안 회귀 0).
- **AdminView 내부 편집 컨트롤 차등** — 패널별 생성/삭제 버튼 비활성화·조회 전용 표시는 후속 slice(`web/src/views/AdminView.tsx` 무수정).
- `web/src/api/roleAccess.ts` · `web/src/api/auth.ts` 수정 — 판정 규칙과 조회 helper 는 그대로 사용만 한다.
- backend 변경 일체 — `RolesGuard` · `@Roles()` · `GET /api/auth/me` 는 읽기만.
- `docs/requirements.md` REQ-073 status 갱신 · `docs/architecture/*` 동기 — 축이 UI 에 완결된 뒤 별도 `direct` doc task.
- e2e spec(`test/e2e/`) 추가 — REQ-073 의 e2e 축은 view-level gating 까지 배선된 뒤 별도 slice.
- `web/package.json` 에 `@vitest/coverage-v8` 도입(새 dependency, CLAUDE.md §5 게이트 — PLAN `127 행`).
- 로그아웃·토큰 만료 시 `currentUser` 무효화 흐름 — 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
