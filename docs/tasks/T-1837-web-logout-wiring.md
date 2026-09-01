---
id: T-1837
title: 웹 로그아웃 동선 배선 — auth.logout helper + AppShell 세션 종료 (REQ-081)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-081]
estimatedDiff: 390
estimatedFiles: 4
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 — 제품 코드는 ~90 LOC (auth.ts helper ~30 + AppShell 배선 ~60) 이고 초과분은 전부 colocated spec LOC. 동형 선례 T-1834 (4 파일, 제품 ~100 LOC + spec 나머지). 파일 cap(≤ 5) 은 준수."
independentStream: web-ui-basics
dependsOn: []
touchesFiles:
  - web/src/api/auth.ts
  - web/src/api/auth.test.ts
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
created: 2026-09-01
plannerNote: "P6 PLAN 133 행 ② (REQ-081) 로그아웃 — backend endpoint 는 이미 shipped, 없는 것은 web 동선. helper+소비처 한 PR. cap-bend pre-justified: R-112 backbone × 1.5 = 390 LOC, T-1834 패턴."
---

# T-1837 — 웹 로그아웃 동선 배선 (REQ-081)

## Why

[docs/PLAN.md](../PLAN.md) `133 행` (UI 기본기 R-187~R-191) 의 다섯 조각 중 ⑤ 는 [T-1836](T-1836-requirements-req084-error-lines-rejudge.md) 으로 닫혔고, 남은 ①~④ 중 **② 로그아웃** = [docs/requirements.md](../requirements.md) `100 행` REQ-081 을 여는 slice 다. 사용자는 현재 한 번 로그인하면 브라우저에서 세션을 끝낼 수단이 전혀 없다 — 인증 후 화면에 로그아웃 컨트롤이 하나도 없고, 쿠키를 지우는 호출도 web 에서 일어나지 않는다.

**planner issue-still-relevant pre-check (실측, origin/main `658ffa51` 기준)**: ① backend 축은 **이미 안착** — [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) `194 행` 에 `@Post("logout")` 이 있고 access/refresh 쿠키 clear 2 종 + 204 를 반환하며 e2e 단언도 존재한다([auth.controller.spec.ts](../../src/auth/auth.controller.spec.ts) `759 행`). 그래서 본 task 는 **backend 를 건드리지 않는다**. ② web 축은 **미안착** — `git grep logout -- web/src` 결과가 [AdminView.auth-me-contract.test.ts](../../web/src/views/AdminView.auth-me-contract.test.ts) (controller 소스를 파싱해 형제 handler 를 판별하는 drift-guard) 뿐이고, 실제 호출·버튼·상태 초기화는 0 건이다. [web/src/api/auth.ts](../../web/src/api/auth.ts) `180 행` export 목록에도 `logout` 이 없다. `requirements.md` `100 행` REQ-081 은 `PLANNED`, `PLAN.md` `133 행` ② 서술도 미해소 그대로다 — 중복 아님을 확인했다.

[CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무에 따라 helper(`auth.logout`) 신설과 그 소비처(AppShell 의 로그아웃 컨트롤 + 세션 상태 초기화) 배선을 **한 PR** 에 담는다.

## Required Reading

- [web/src/api/auth.ts](../../web/src/api/auth.ts) — 상수 정의(`20~24 행`), `refresh()` 의 "실패를 boolean 으로 흡수" 패턴(`49~60 행`), export 목록(`180 행`).
- [web/src/api/auth.test.ts](../../web/src/api/auth.test.ts) `108~157 행` (`auth.refresh` 케이스군 — fetch mock 패턴의 정본). colocated spec 이며 본 task 의 신규 케이스도 이 파일에 추가한다.
- [web/src/api/apiClient.ts](../../web/src/api/apiClient.ts) `39~45 행`(`parseBody` — 204/비-JSON 응답은 `text()`), `110 행`(`request` signature), `131 행` export.
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) — `isAuthedView`(`75 행`) · `visibleNavItems`(`92 행`) · `shouldLoadCurrentUser`(`101~109 행`) · `view` state(`190 행`) · `currentUser` state(`213 행`) · `handleAuthenticated`(`238 행`) · `<AuthGate>` 배선(`309~316 행`) · 내비게이션 렌더(`324~336 행`).
- [web/src/AuthGate.tsx](../../web/src/AuthGate.tsx) — `authenticated` 를 자기 `useState` 로 소유하며 `initialAuthenticated` 는 **mount 시점 초기값일 뿐**이라는 사실(`47~50 행`). 로그아웃 후 로그인 화면으로 되돌리려면 이 상태를 초기화해야 한다.
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) `262~354 행`(인증 후 내비게이션 정적 렌더 단언) · `450~481 행`(`shouldLoadCurrentUser` 순수 helper 케이스군). colocated spec 이며 본 task 의 신규 케이스도 이 파일에 추가한다.
- [docs/requirements.md](../requirements.md) `100 행` — REQ-081 문언.

## Acceptance Criteria

- [ ] [web/src/api/auth.ts](../../web/src/api/auth.ts) 에 `logout(): Promise<boolean>` 을 신설하고 named export 에 추가한다 — `POST /api/auth/logout` 을 `request` 로 호출하고 2xx 면 `true`, 그 외(401·5xx·네트워크 `ApiError`)는 `false` 로 **흡수**한다(throw 0). 흡수 이유(클라이언트 측 세션 정리는 서버 응답과 무관하게 진행돼야 한다)를 주석으로 명시하고, 경로 문자열은 `LOGOUT_PATH` 상수로 둔다(`REFRESH_PATH` 선례와 동형).
- [ ] [web/src/AppShell.tsx](../../web/src/AppShell.tsx) 에 `shouldShowLogout(view: View): boolean` 을 named export 순수 함수로 신설한다 — 인증 후 view 에서만 `true`(판정은 기존 `isAuthedView` 를 재사용하고 view 문자열을 다시 하드코딩하지 않는다), 미인증 view(`'login'` · `'superadmin-setup'`) 와 타입 우회 입력에는 `false`(throw 0).
- [ ] AppShell 이 인증 후 내비게이션(`324 행` `<nav>`) 안에 로그아웃 버튼을 렌더한다 — `shouldShowLogout(view)` 가 `true` 일 때만, `type="button"` + 식별 가능한 className(`app-shell-logout`) + 한국어 라벨. `AUTHED_NAV_ITEMS` 목록에는 넣지 않는다(등급 필터 대상이 아니라 인증되면 항상 보이는 동선).
- [ ] 로그아웃 핸들러가 세션을 실제로 끝낸다 — `logout()` 을 await 한 뒤 **반환값과 무관하게** ① `currentUser` 를 `null` 로 되돌리고 ② `view` 를 `'login'` 으로 전환하고 ③ `AuthGate` 의 내부 `authenticated` 를 초기화한다. ③ 은 `AuthGate` 에 `key={sessionEpoch}` 를 주어 remount 하는 방식으로 하고, 같은 commit 에서 `initialAuthenticated={isAuthedView(initialView)}` 를 `isAuthedView(view)` 로 바꾼다(mount 시점에는 `view === initialView` 라 기존 동작 불변임을 주석에 명시). `AuthGate.tsx` · `LoginForm.tsx` 는 수정하지 않는다.
- [ ] 로그아웃 후 `shouldLoadCurrentUser` 재적재 루프가 생기지 않는지 확인한다 — `view === 'login'` 이면 `isAuthedView` 가 `false` 라 `GET /api/auth/me` 를 부르지 않는다는 점을 spec 으로 고정한다.
- [ ] happy-path unit test 1+ — 신규 public symbol 각각: `logout()` 이 2xx 응답에 `true` 를 반환하고 `POST` + `/api/auth/logout` + `credentials` 동반으로 정확히 1 회 호출되는지, `shouldShowLogout('dashboard')`/`('admin')` 가 `true` 인지, 인증 후 정적 렌더에 로그아웃 버튼이 1 개 있는지.
- [ ] error path unit test 1+ — `logout()` 이 5xx `ApiError` 와 네트워크 실패(status 0) 에서 각각 `false` 를 반환하고 throw 하지 않는지.
- [ ] 분기 cover — (가) `logout()` 성공 (나) `logout()` 실패 흡수 (다) `shouldShowLogout` true (라) `shouldShowLogout` false 네 분기 각각 1+ test.
- [ ] negative cases 충분 cover — 각 1+ test: 미인증 view(`'login'`)·셋업 view(`'superadmin-setup'`) 정적 렌더에 로그아웃 버튼 미노출 · 타입 우회 입력(빈 문자열 · `undefined`)에 `shouldShowLogout` 이 `false` 이고 throw 0 · `logout()` 이 401 에서도 `false` 반환(자동 refresh 재시도로 인한 무한 루프 없음, fetch 호출 횟수 단언) · 응답 body 가 비어 있어도(204 + no content-type) 파싱 예외 0 · 로그아웃 라벨/마크업에 사용자 자격증명 문자열이 새지 않음.
- [ ] `pnpm --dir web test` 전량 green (기존 케이스 회귀 0), 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build` green (web 빌드 `tsc --noEmit` 포함).

## Out of Scope

- **backend (`src/`) 변경 금지** — `POST /api/auth/logout` 은 이미 shipped 다(위 Why 의 pre-check). 쿠키 clear 정책·status code·e2e 는 그대로 둔다.
- **세션 복원(REQ-082, PLAN `133 행` ③) 금지** — 부트 시 `GET /api/auth/me` 로 인증 상태를 복원하는 hydration 은 별도 slice 다. 본 task 는 이미 있는 `shouldLoadCurrentUser` 조건을 **바꾸지 않는다**.
- **R-78 polling(REQ-083, ④) · 전역 CSS(①) 금지** — ① 은 새 dependency 가능성이 있어 architect ADR + [CLAUDE.md](../../CLAUDE.md) `§5` 게이트가 선행해야 한다. 본 slice 는 스타일 파일을 만들지 않는다(className 부여까지만).
- **AdminView 변경 금지** — [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 는 6,000 줄대라 손대면 cap 을 넘긴다. 로그아웃 동선은 AppShell 내비게이션 한 곳에만 둔다.
- **새 dependency 0** — `@testing-library/react` 등 추가 금지(ADR-0040 §5). 상호작용은 순수 helper + 정적 렌더 단언으로 검증한다(`shouldLoadCurrentUser` 선례와 동형).
- **`docs/requirements.md` REQ-081 status 재판정 금지** — [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 에 따라 본 slice 머지 **후** 1 회만, 별도 `direct` task 로 한다. `docs/PLAN.md` `133 행` ② 마커 갱신도 같은 후속 task 소관.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
