---
id: T-1838
title: 웹 부트 세션 복원 — GET /api/auth/me hydration 으로 새로고침 인증 유지 (REQ-082)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-082]
estimatedDiff: 320
estimatedFiles: 2
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 — 제품 코드는 ~70 LOC (순수 helper 2 개 ~25 + 부트 effect 배선 ~45) 이고 초과분은 전부 colocated spec LOC. 동형 선례 T-1837 (4 파일, 제품 ~90 LOC + spec 나머지 = +311). 파일 cap(≤ 5) 은 2 파일로 준수."
independentStream: web-ui-basics
dependsOn: []
touchesFiles:
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
created: 2026-09-02
plannerNote: "P6 PLAN 133 행 ③ (REQ-082) 세션 복원 — fetchCurrentUser·sessionEpoch 는 이미 있고 없는 것은 부트 hydration 배선. cap-bend pre-justified: R-112 backbone × 1.5 = 320 LOC, T-1837 패턴."
---

# T-1838 — 웹 부트 세션 복원 hydration (REQ-082)

## Why

[docs/PLAN.md](../PLAN.md) `133 행` (UI 기본기) 의 다섯 조각 중 ⑤ 는 [T-1836](T-1836-requirements-req084-error-lines-rejudge.md), ② 는 [T-1837](T-1837-web-logout-wiring.md) 로 닫혔고 남은 것은 ① · ③ · ④ 다. 그중 ①(전역 CSS)은 새 dependency 가능성이 있어 architect ADR + [CLAUDE.md](../../CLAUDE.md) `§5` 게이트가 선행해야 하고, ④(R-78 polling)는 backend 실행 상태 조회 endpoint 신설을 동반해 slice 가 여럿으로 갈린다. **③ 세션 복원** = [docs/requirements.md](../requirements.md) `101 행` REQ-082 는 backend 변경 0 · 새 dependency 0 으로 한 slice 안에서 닫히는 가장 짧은 조각이라 본 task 로 연다.

지금 사용자는 로그인한 뒤 브라우저를 새로고침하면 **쿠키 세션이 아직 유효한데도 로그인 화면으로 되돌아간다** — 매 새로고침마다 재로그인을 강요하는 상태다.

**planner issue-still-relevant pre-check (실측, origin/main `61a59cf2` 기준)**: ① 부트 hydration 은 **미안착** — [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `201 행` 의 `initialView = 'login'` 이 무조건 미인증 진입점으로 시작하고, `242 행` 의 유일한 `useEffect` 는 `shouldLoadCurrentUser`(`105 행`) 게이트 때문에 **인증 후 view 에서만** `GET /api/auth/me` 를 부른다. `git grep -nE "hydrat|세션 복원|restoreSession|bootAuth" -- web/src` 결과는 [web/src/api/auth.ts](../../web/src/api/auth.ts) `50 행` 주석 한 줄("부트 hydration — Out of Scope") 뿐이고 실 배선은 0 건이다. ② 재료는 **이미 안착** — 세션 조회 helper `fetchCurrentUser()`([auth.ts](../../web/src/api/auth.ts) `171 행`, 401/404 를 `null` 로 흡수)는 T-1718 이, AuthGate 내부 인증 상태를 되돌리는 `key={sessionEpoch}` remount 경로(`237 행` · `352 행` · `362 행`)는 T-1837 이 이미 박제했다 — 본 task 는 **둘 다 신설하지 않고 재사용**한다. ③ `requirements.md` `101 행` REQ-082 는 `PLANNED`, `PLAN.md` `133 행` ③ 서술도 미해소 그대로다 — 중복 아님을 확인했다.

[CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무에 따라 판정 helper 신설과 그 소비처(AppShell 부트 effect 배선)를 **한 PR** 에 담는다.

## Required Reading

- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) — `type View`(`44 행`) · `DEFAULT_AUTHED_VIEW`(`47 행`) · `isAuthedView`(`76 행`) · `shouldLoadCurrentUser`(`105 행`) · `shouldShowLogout`(`120 행`) · `initialView` 기본값(`201 행`) · `view` state(`207 행`) · `currentUser` state(`230 행`) · `sessionEpoch` state(`237 행`) · 등급 적재 effect(`242 행`) · `handleAuthenticated`(`262 행`) · `handleLogout`(`274 행`) · `<AuthGate key={sessionEpoch} initialAuthenticated={isAuthedView(view)}>`(`348~362 행`).
- [web/src/api/auth.ts](../../web/src/api/auth.ts) `171~200 행` — `fetchCurrentUser()` 가 401/404 를 `null` 로 흡수하고 그 밖의 실패는 throw 하며 body shape 이 어긋나면 `null` 을 준다는 계약. `50 행` 주석(부트 hydration 언급)도 본 slice 로 해소되므로 함께 읽는다.
- [web/src/AuthGate.tsx](../../web/src/AuthGate.tsx) `40~50 행` — `authenticated` 를 자기 `useState` 로 소유하고 `initialAuthenticated` 는 **mount 시점 초기값일 뿐**이라는 사실. 복원 성공 시 로그인 폼이 아니라 인증 후 화면이 보이려면 remount 가 필요한 이유.
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) `451~479 행`(`shouldLoadCurrentUser` 순수 helper 케이스군) · `514~530 행`(effect 배선을 소스 문자열로 대조하는 drift-guard 패턴) · `714~742 행`(`shouldShowLogout` 케이스군 — T-1837 선례). **colocated spec 이며 본 task 의 신규 케이스도 이 파일에 추가한다** (새 spec 파일 신설 금지).
- [docs/requirements.md](../requirements.md) `101 행` — REQ-082 문언.

## Acceptance Criteria

- [ ] [web/src/AppShell.tsx](../../web/src/AppShell.tsx) 에 `shouldRestoreSession(view: View, attempted: boolean, currentUser: CurrentUser | null | undefined): boolean` 을 named export 순수 함수로 신설한다 — 미인증 진입 view 이고(`isAuthedView` 가 `false`) 아직 복원을 시도하지 않았고(`attempted === false`) 적재된 사용자도 없을 때만 `true`. 셋업 view(`'superadmin-setup'`)에서는 `false`(사용자가 의도적으로 들어온 화면을 부트 복원이 가로채지 않는다) — 이 판정을 위해 view 문자열을 새로 하드코딩하지 말고 미인증 진입점 상수 1 곳(예: `UNAUTHED_ENTRY_VIEW`)을 근거로 삼는다. 타입 우회 입력(빈 문자열 · `undefined` · 숫자)에도 `false` 이며 throw 0.
- [ ] `restoredView(user: CurrentUser | null | undefined): View` 를 named export 순수 함수로 신설한다 — 유효한 사용자 객체면 `DEFAULT_AUTHED_VIEW`, `null`/`undefined`/비객체면 미인증 진입 view 를 반환한다(throw 0). 반환 view 문자열은 기존 상수(`DEFAULT_AUTHED_VIEW` · 미인증 진입점 상수)만 사용한다.
- [ ] AppShell 이 부트 시 세션을 1 회 복원 시도한다 — `shouldRestoreSession(...)` 이 `true` 일 때만 `fetchCurrentUser()` 를 호출하고, 결과가 사용자면 ① `currentUser` 설정 ② `view` 를 `restoredView(user)` 로 전환 ③ `sessionEpoch` 를 올려 `AuthGate` 를 remount(그 시점 `initialAuthenticated={isAuthedView(view)}` 가 `true` 라 로그인 폼 대신 인증 후 화면이 보인다) 한다. `AuthGate.tsx` · `LoginForm.tsx` · `api/auth.ts` 의 **함수 본문은 수정하지 않는다**(`auth.ts` `50 행` 주석 문구 갱신은 허용).
- [ ] 복원 실패는 조용히 흡수한다 — `fetchCurrentUser()` 가 `null` 을 주거나(세션 없음/401) reject 하면(5xx · 네트워크) 사유를 지어내지 않고 로그인 화면을 그대로 유지한다(오류 배너 표시 0, throw 0). 성공·실패 **어느 쪽이든** 시도 플래그를 `true` 로 확정해 **재시도 루프가 생기지 않게** 하고, 기존 등급 적재 effect(`242 행`)와 동형으로 `cancelled` 플래그로 언마운트 경쟁 상태의 늦은 `setState` 를 막는다.
- [ ] 로그아웃 후 자동 재로그인이 일어나지 않는다 — `handleLogout` 이 `view` 를 `'login'` 으로 되돌려도 시도 플래그가 이미 `true` 라 `shouldRestoreSession` 이 `false` 임을 spec 으로 고정한다. `handleLogout` 본문은 시도 플래그를 되돌리지 않는다.
- [ ] 중복 조회가 생기지 않는다 — 복원이 성공해 `currentUser` 가 채워지면 `shouldLoadCurrentUser` 가 `false` 라 `GET /api/auth/me` 가 두 번 불리지 않는다는 점을 spec 으로 고정한다.
- [ ] happy-path unit test 1+ — 신규 public symbol 각각: `shouldRestoreSession('login', false, null)` 이 `true`, `restoredView(<유효 사용자>)` 가 `'dashboard'`, 그리고 부트 effect 배선이 소스에 존재함을 drift-guard(`514~530 행` 선례 — 시도 게이트 · `fetchCurrentUser()` 호출 · `sessionEpoch` 증가 · `cancelled` 플래그 대조)로 단언.
- [ ] error path unit test 1+ — `restoredView(null)` · `restoredView(undefined)` 가 미인증 진입 view 를 반환하고 throw 0, 조회 실패 흡수(catch) 분기가 소스에 배선돼 있음을 단언.
- [ ] 분기 cover — (가) 미인증 + 미시도 → `true` (나) 이미 시도 → `false` (다) 인증 후 view → `false` (라) 이미 적재된 사용자 → `false` (마) `restoredView` 사용자 있음 (바) `restoredView` 사용자 없음, 여섯 분기 각각 1+ test.
- [ ] negative cases 충분 cover — 각 1+ test: 셋업 view(`'superadmin-setup'`)에서 복원 미시도 · 타입 우회 입력(빈 문자열 · `undefined` · 숫자)에 두 helper 모두 `false`/미인증 view 이고 throw 0 · 비객체 사용자(문자열 · 배열 · 빈 객체)에 `restoredView` 가 인증 후 view 를 주지 않음 · 로그아웃 직후 재복원 미발생 · 미인증 진입 상태의 정적 렌더에 인증 후 내비게이션/로그아웃 버튼이 여전히 미노출(무회귀).
- [ ] `pnpm --dir web test` 전량 green (기존 케이스 회귀 0), 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build` green (web 빌드 `tsc --noEmit` 포함).

## Out of Scope

- **backend (`src/`) 변경 금지** — `GET /api/auth/me` 는 이미 shipped 다. 쿠키 정책 · status code · e2e 를 건드리지 않는다.
- **전역 CSS(①) · R-78 polling(④) 금지** — ① 은 새 dependency 판단이 걸려 architect ADR + [CLAUDE.md](../../CLAUDE.md) `§5` 게이트가 선행해야 하고, ④ 는 backend 실행 상태 조회 endpoint 신설을 동반하는 별도 chain 이다. 본 slice 는 스타일 파일을 만들지 않고 배너 상태도 그대로 둔다.
- **라우터 도입 금지** — URL 별 화면 복원(예: 새로고침 시 `admin` 화면 유지)은 무라우터 view enum(ADR-0041 Decision 2) 밖의 주제다. 본 slice 의 복원 도착지는 `DEFAULT_AUTHED_VIEW` 하나다.
- **AdminView · DashboardView 변경 금지** — [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 는 6,000 줄대라 손대면 cap 을 넘긴다.
- **새 spec 파일 신설 금지** — 신규 케이스는 colocated [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) 에 추가한다.
- **새 dependency 0** — `@testing-library/react` 등 추가 금지(ADR-0040 §5). 상호작용 검증은 순수 helper + 정적 렌더 + 소스 drift-guard 로 한다.
- **`docs/requirements.md` · `docs/PLAN.md` 갱신 금지** — [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 에 따라 재판정은 본 slice 머지 **후** 별도 `direct` task 소관이다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **REQ-081 + REQ-082 배치 재판정 (direct)** — 본 slice 머지 후, [T-1837](T-1837-web-logout-wiring.md)(REQ-081) 과 본 task(REQ-082) 의 실측 재판정 + [docs/PLAN.md](../PLAN.md) `133 행` ② · ③ 마커 갱신을 **한 direct task 로 묶어** 처리한다([T-1833](T-1833-requirements-collection-target-ui-rejudge.md) 이 3 REQ 를 한 번에 재판정한 선례 — PLAN `182 행` 오너 지시의 doc-sync commit 절감 취지). REQ 당 1 회 원칙(§3.1 규칙 6)은 그대로 지킨다.
