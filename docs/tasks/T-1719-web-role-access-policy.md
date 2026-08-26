---
id: T-1719
title: web 평가 대상 편집 권한 판정 순수 모듈 roleAccess 신설 (REQ-073 slice 2)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-073, REQ-070]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-08-26
independentStream: evaluation-target-ui
dependsOn: [T-1718]
touchesFiles:
  - web/src/api/roleAccess.ts
  - web/src/api/roleAccess.test.ts
plannerNote: P6 오너 지시(PLAN 130 행 🔴) 분해 slice 3 — T-1718 이 연 role 정보원 위에 편집/조회 권한 판정 규칙을 순수 모듈로 박제한다.
---

# T-1719 — web 평가 대상 편집 권한 판정 순수 모듈 roleAccess 신설 (REQ-073 slice 2)

## Why

오너 최우선 지시 [PLAN](../PLAN.md) `130 행` 🔴 (평가 대상 추가·편집 인터페이스, REQ-070~REQ-073) 분해 slice 3. slice 1([T-1717](T-1717-appshell-authed-view-nav.md))이 인증 후 대시보드↔관리 전환 동선을 살렸고, slice 2([T-1718](T-1718-web-fetch-current-user.md))가 `fetchCurrentUser(): Promise<CurrentUser | null>` 로 web 측 role **정보원** 을 열었다. 그러나 그 role 문자열을 받아 "이 사용자가 평가 대상을 편집할 수 있는가 / 조회만 가능한가" 를 판정하는 **규칙은 web 어디에도 없다** — `web/src/` 전체에 `canEdit` · `hasRole` · role 등급 비교 코드가 0 이라, 지금 노출 차등을 배선하려면 각 소비처가 `'Admin'` · `'SuperAdmin'` 문자열 비교를 제각기 인라인으로 복제하게 된다.

REQ-073 ([requirements.md](../requirements.md) `92 행`) 은 "평가 대상 편집은 Admin 등급만, User 등급은 조회만 (RBAC 일관)" 을 요구하고, backend 는 이미 `ROLE_HIERARCHY`(`SuperAdmin` ⊇ `Admin` ⊇ `User`, [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) `41~45 행`) 를 단일 source of truth 로 두고 있다. 본 slice 는 그 등급 규칙을 web 쪽에 **순수 함수 모듈 1 개** 로 mirror 한다 — 소비처(nav 항목 노출 · AdminView 패널 gating)가 같은 판정을 공유하고, web 에 `@testing-library/react` 가 없는 제약(ADR-0040 §5 새-dep 게이트) 아래에서도 규칙 자체는 단위 검증이 가능해야 하기 때문이다(`isNavItemActive`(T-1717) · `buildSetupErrorMessage`(T-1714) 선례와 동형). 실제 UI 노출 차등 배선은 이 규칙 위에서 후속 slice 가 수행한다 — 규칙과 소비를 한 task 에 합치면 cap(≤ 300 LOC / 5 파일)을 넘고 검증 축(순수 판정 / 렌더 분기)도 섞인다.

## Required Reading

- [web/src/api/auth.ts](../../web/src/api/auth.ts) `133 행` ~ 끝 — `type CurrentUser`(`{ id, email, role }`) 정의와 `fetchCurrentUser` 의 `null` 계약(미인증 · stale token · 필드 결손). 본 task 는 이 파일을 **수정하지 않고 타입만 import** 한다.
- [web/src/api/signupError.ts](../../web/src/api/signupError.ts) — 같은 디렉토리의 **순수 정책 모듈 선례**. 주석 서술 밀도 · named export 형식 · backend 값 동기 시 주석으로 근거를 박제하는 관례를 그대로 승계한다.
- [web/src/api/signupError.test.ts](../../web/src/api/signupError.test.ts) — colocated spec 선례. `describe`/`it` 구성과 순수 함수 단언 패턴을 따른다.
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) `41~45 행` — backend `ROLE_HIERARCHY` 정본(`SuperAdmin: ["SuperAdmin"]` / `Admin: ["Admin", "SuperAdmin"]` / `User: ["User", "Admin", "SuperAdmin"]`). web 쪽 등급 값·서열은 여기서 복사해 오며 **backend 는 읽기만** 한다.
- [docs/requirements.md](../requirements.md) `92 행` — REQ-073 row (본 task 에서 수정하지 않는다).

## Acceptance Criteria

- [ ] 새 파일 `web/src/api/roleAccess.ts` 를 만들고 다음 3 심볼을 named export 한다 — ① `ROLE_ORDER`(또는 동등한 등급 서열 상수, `User` < `Admin` < `SuperAdmin`, backend `ROLE_HIERARCHY` 와 값이 같음을 주석으로 박제), ② `hasRoleAtLeast(role: string | null | undefined, required: string): boolean`, ③ `canEditAssessmentTargets(user: CurrentUser | null | undefined): boolean` 와 `canViewAssessmentTargets(user: CurrentUser | null | undefined): boolean`.
- [ ] 판정 규칙: `canEditAssessmentTargets` 는 `Admin` **이상**(`Admin` · `SuperAdmin`) 일 때만 `true`(REQ-073 "편집은 Admin 등급만"). `canViewAssessmentTargets` 는 `User` 이상 — 즉 인증된 3 등급 모두 `true`("User 등급은 조회만").
- [ ] 모든 함수는 **순수** 하다 — 네트워크 호출 0 · module-level 가변 상태 0 · `throw` 0. 어떤 입력(`null` · `undefined` · 빈 문자열 · 미지 role 문자열 · 대소문자 불일치)에도 예외 없이 `boolean` 을 반환한다.
- [ ] 미지 role 및 미지 `required` 는 **거부(`false`)로 fail-safe** 한다 — 등급표에 없는 문자열을 권한 있음으로 해석하지 않는다. 대소문자는 backend 토큰(`"Admin"` 등)과 **정확히 일치할 때만** 인정한다(`"admin"` 은 `false`). 이 두 판단의 근거를 주석으로 박제한다.
- [ ] R-112 happy-path: `canEditAssessmentTargets({ id, email, role: 'Admin' })` 이 `true`, `canViewAssessmentTargets({ ..., role: 'User' })` 가 `true` 인 test 각 1+.
- [ ] R-112 error path: 의존성·입력 오류 상당 경로 — `user` 가 `null`(미인증) 및 `undefined` 일 때 두 함수 모두 `false` 를 반환하고 **throw 하지 않는지** 검증하는 test 1+.
- [ ] R-112 분기 cover: `hasRoleAtLeast` 의 분기 각 1+ test — (a) role 이 required 보다 상위, (b) role 이 required 와 동일, (c) role 이 required 보다 하위, (d) role 이 미지 문자열, (e) `required` 가 미지 문자열, (f) role 이 `null`/`undefined`.
- [ ] R-112 negative 충분 cover — 각 1+ test: ① `role: 'User'` 인데 편집 판정 `false`, ② `role: ''`(빈 문자열) → `false`, ③ `role: 'admin'`(소문자) → `false`, ④ `role: 'Root'` 등 미지 등급 → `false`, ⑤ `user` 가 `null` → 두 함수 모두 `false`, ⑥ `role` 이 타입 우회 비문자열(예: `42` 를 `as unknown as string`) → `false` 이고 throw 하지 않음.
- [ ] backend 값 동기 회귀 방지: web 의 등급 3 종 토큰이 `'SuperAdmin' | 'Admin' | 'User'` 로 정확히 이 철자임을 단언하는 test 1+ (backend `ROLE_HIERARCHY` 키와 drift 시 fail).
- [ ] `pnpm --dir web lint` · `pnpm --dir web build` · `pnpm --dir web test` 3 종 green. 추가로 root `pnpm test:cov` 를 돌려 line ≥ 80% / function ≥ 80% 무회귀 확인(`src/` diff 0 이므로 자동 무회귀 — web 은 `coverageThreshold` 미도입, PLAN `127 행` 게이트된 backlog).
- [ ] 새 dependency 0 · `src/` diff 0 파일 · `web/src/api/auth.ts` · `web/src/AppShell.tsx` · `web/src/views/AdminView.tsx` · `web/package.json` diff **0 파일**.

## Out of Scope

- **UI 노출 차등 실배선** — nav 항목(`AUTHED_NAV_ITEMS`) 필터링 · AdminView 패널 gating · 편집 버튼 비활성화는 후속 slice. 본 task 는 판정 규칙만 연다.
- `AppShell` 의 role state hydration(로그인 성공 후 `fetchCurrentUser` 호출 · 결과 보관) — 후속 slice.
- `web/src/api/auth.ts` 수정 — `CurrentUser` 타입은 import 만 하고 원본은 무수정.
- backend 변경 일체 — `ROLE_HIERARCHY` · `RolesGuard` · `@Roles()` 는 읽기만. 두 곳의 등급표를 하나로 합치는 공유 package 추출도 하지 않는다(web/backend 는 별도 package, ADR-0040 §5).
- `docs/requirements.md` REQ-073 status 갱신 · `docs/architecture/*` 동기 — 노출 차등이 실제 배선된 뒤 별도 `direct` doc task.
- e2e spec(`test/e2e/`) 추가 — REQ-073 의 e2e 축은 UI 배선 후 별도 slice.
- `web/package.json` 에 `@vitest/coverage-v8` 도입(새 dependency, §5 게이트 — PLAN `127 행`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
