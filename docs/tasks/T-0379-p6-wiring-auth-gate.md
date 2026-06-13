---
id: T-0379
title: P6 composition wiring ② 인증 게이트 + 무라우터 view 전환 + LoginForm controlled 배선
phase: P6
status: DONE
completedAt: 2026-06-13T14:53:00Z
result: "DONE — AuthGate 신설(controlled lift-up + onLogin 콜백 위임 + authenticated 분기) + AppShell view 전환 배선(onAuthenticated→dashboard). web vitest 274 green, build/lint pass, 4파일 +278/-23, zero-new-dep. PR #310 reviewer APPROVE r1/7 → 4-게이트 PASS → squash merge 0298db7. coverage AC pending(@vitest/coverage-v8 미설치 zero-new-dep 제약, T-0355 Follow-up gap)."
commitMode: pr
coversReq: [REQ-038, REQ-042]
estimatedDiff: 175
estimatedFiles: 4
created: 2026-06-13
independentStream: p6-frontend-composition
dependsOn: [T-0378]
touchesFiles: [web/src/AuthGate.tsx, web/src/AuthGate.test.tsx, web/src/AppShell.tsx, web/src/AppShell.test.tsx]
plannerNote: "P6 wiring②; ADR-0041 Decision1·2; 인증 게이트+view 전환+LoginForm 배선(fetch hook 은 ②b 위임); R-112 backbone×1.5≈175 LOC"
sizeExempt: false
---

# T-0379 — P6 composition wiring ② 인증 게이트 + 무라우터 view 전환 + LoginForm controlled 배선

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) 의 Consequences §중립 wiring chain ② — wiring ① (T-0378, AppShell 골격) 위에 **인증 게이트 + 무라우터 view 전환 + LoginForm controlled 배선** 을 얹는 slice 다. 본 task 는 ADR-0041 Decision 1 (AppShell → **인증 게이트** → 화면 컨테이너 위계 중 인증 게이트 레벨, controlled lift-up) 과 Decision 2 (무라우터 useState 기반 view 전환) 을 cover 한다. 현재 `AppShell` (T-0378) 은 view enum 상태를 보유하지만 전환 핸들러를 노출하지 않고 항상 `'login'` placeholder 만 렌더한다. 본 slice 가 미인증/인증 분기와 LoginForm 의 username/password/loading/error props 배선을 추가해 PLAN P6 의 "로그인 → 인증 후 화면" 흐름을 실 동작으로 만든다 (README REQ-038 시각화 UI 진입 / R-84 인증 frontend 진입점).

본 slice 는 **인증 상태 lift-up + LoginForm 배선 + 로그인 성공 시 view 전환** 까지만 — 실제 `POST /api/auth/login`·`/api/auth/refresh` 호출과 401→refresh→retry fetch hook 은 후속 slice (②b) 의 책임이라 본 slice 는 로그인 제출을 **주입된 `onLogin` 콜백 prop 으로 위임** 한다 (Out of Scope). 이로써 zero-new-dep · testable (콜백 mock) · cap 준수를 동시에 만족한다. 직렬 chain (`dependsOn: [T-0378]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 1 (controlled lift-up: 컨테이너가 상태 소유, presentational 은 props 소비) / Decision 2 (무라우터 view enum 전환) / Decision 3 (data-fetch 경계는 ②b 이후 — 본 slice 는 onLogin 콜백 위임) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn chain)
- `docs/decisions/ADR-0040-frontend-stack.md` §2 (인증 흐름 — JWT HttpOnly cookie 소비자) / §5 (new-dep 게이트 — react/react-dom 만, router/fetch/jsdom/@testing-library 도입 금지)
- `web/src/AppShell.tsx` — 갱신 대상 (T-0378 가 박제한 view enum 상태 보유 골격). 본 slice 가 인증 상태 + view 전환 + AuthGate 배선을 얹는다.
- `web/src/AppShell.test.tsx` — 갱신할 기존 spec (vitest + react-dom/server renderToStaticMarkup, jsdom 미사용)
- `web/src/components/LoginForm.tsx` — 인증 게이트가 배선할 presentational (props: `username`/`password`/`onUsernameChange`/`onPasswordChange`/`onSubmit`/`loading?`/`error?`; controlled — 상위가 상태 소유)
- `web/src/components/LoginForm.test.tsx` — colocated controlled test 작성 패턴 참고 (.test.tsx 확장자 고정 — root jest testRegex `.*\.spec\.ts$` pickup 충돌 회피)

## Acceptance Criteria

- [ ] `web/src/AuthGate.tsx` 신설 — 인증 게이트 컴포넌트 (controlled lift-up). 다음을 포함:
  - [ ] 인증 여부 상태 (예 `authenticated: boolean`, 초기값 `false`) 와 LoginForm 의 입력 상태 (`username`/`password`) 를 `useState` 로 소유.
  - [ ] `loading`/`error` 상태 보유. 로그인 제출 시 `loading=true` 로 두고, 주입된 `onLogin(username, password)` 콜백 (prop) 의 결과 (성공/실패) 에 따라 `authenticated` 전환 또는 `error` 설정.
  - [ ] props 로 `onLogin: (username, password) => Promise<boolean>` (또는 동등 — 성공 여부 반환) 과 `onAuthenticated: () => void` (인증 성공 시 상위 view 전환 트리거) 를 받음. 실 fetch 는 주입하지 않고 콜백에 위임 (fetch hook 은 ②b).
  - [ ] 미인증 (`authenticated=false`) 이면 `LoginForm` 을 username/password/onUsernameChange/onPasswordChange/onSubmit/loading/error props 로 배선해 렌더. 인증되면 `children` (또는 인증 후 슬롯) 을 렌더 (실 화면 컨테이너 조립은 ③~④ — 본 slice 는 children pass-through 또는 인증 완료 placeholder).
- [ ] `web/src/AppShell.tsx` 갱신 — view 전환 핸들러를 노출하고 `AuthGate` 를 배선:
  - [ ] `setView` 를 `useState` 로 활성화 (T-0378 의 read-only `view` 를 전환 가능하게). 인증 게이트의 `onAuthenticated` 가 view 를 `'dashboard'` (또는 적절한 인증 후 기본 view) 로 전환.
  - [ ] R-78 배너 슬롯 (T-0378) · 헤더 · 본문 레이아웃 골격은 유지. 본문이 AuthGate 를 감싸 미인증 시 LoginForm, 인증 시 view 별 placeholder 를 렌더.
- [ ] 새 dependency 0 — `react`/`react-dom` 만 사용 (router/axios/react-query/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 실 `/api/*` 호출 코드 0 (콜백 위임). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `web/src/AuthGate.test.tsx` 신설 (vitest + `react-dom/server` renderToStaticMarkup, jsdom 미사용 — 기존 web test 패턴 동일). `.test.tsx` 확장자 고정. R-112 4 종:
  - [ ] happy-path: 미인증 초기 상태에서 AuthGate 가 LoginForm (사용자명/비밀번호 입력 + 로그인 버튼 식별 토큰) 을 렌더.
  - [ ] error path: `error` prop/상태가 설정된 경우 (또는 onLogin 실패 시) LoginForm 의 `role="alert"` 에러 영역이 렌더되도록 배선 검증 1+ (error 전달 경로).
  - [ ] flow/branch: 인증 분기 — `authenticated=true` 상태 (초기값 주입 또는 onLogin 성공 시뮬레이션) 에서는 LoginForm 이 렌더되지 않고 인증 후 슬롯/children 이 렌더됨 (양 분기 cover). renderToStaticMarkup 으로 상태 변경 핸들러를 직접 호출할 수 없으면, `authenticated` 초기값을 prop 으로 주입 가능하게 해 양 분기를 각각 정적 렌더로 검증.
  - [ ] negative cases 충분 cover: 미인증 시 인증 후 placeholder 미렌더 1+ / 인증 시 LoginForm 미렌더 1+ / error 없을 때 alert 미렌더 1+ — 예외 상황 분기마다 각 1+.
- [ ] `web/src/AppShell.test.tsx` 갱신 — AppShell 이 AuthGate 를 배선함을 검증 (미인증 초기 상태에서 LoginForm 식별 토큰 렌더 + R-78 배너 비활성 유지 + 헤더 식별 토큰 유지). T-0378 의 기존 단언 (헤더 식별 토큰·배너 비활성·view placeholder) 중 본 slice 변경에 맞게 갱신 (login view 가 이제 LoginForm 으로 대체되므로 해당 placeholder 단언 조정).
- [ ] `pnpm --dir web test` (vitest) 통과 — AuthGate.test.tsx + AppShell.test.tsx + 기존 컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파일 (AuthGate.tsx) line ≥ 80% AND function ≥ 80% 충족. (web vitest 는 root jest `coverageThreshold` 와 별개 — `pnpm --dir web test` 의 coverage 리포트로 확인. ci.yml 미배선은 T-0355 Follow-up 의 기존 tracked gap.)

## Out of Scope

- 실제 `POST /api/auth/login`·`POST /api/auth/refresh`·`GET /api/auth/me` fetch 호출 + native `fetch` 래퍼 + 401→refresh→retry 정책 + JWT cookie credential 흐름 — wiring ②b 책임 (본 slice 는 `onLogin` 콜백 위임으로 추상화). ②b 가 fetch hook 을 구현하고 AuthGate 에 주입한다.
- 대시보드 · Admin · SuperAdmin 셋업 화면 컨테이너 실 조립 (presentational 컴포넌트 props 배선) — wiring ③~④ 책임. 본 slice 는 인증 후 view 별 placeholder/children 만.
- 로그아웃 흐름 / 세션 만료 후 재로그인 전환 — 후속 slice.
- R-78 `evaluationInProgress` 실 polling — wiring ⑤ 책임 (T-0378 가 둔 false 고정 + 배너 슬롯 유지).
- SuperAdmin 셋업 화면 진입 분기 (첫 user 부재 시) — ④ 또는 별도 slice.
- LoginForm 등 기존 presentational 컴포넌트 수정 (controlled lift-up — props 배선만, 컴포넌트 수정 0).
- react-router · @tanstack/react-query · axios · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 2·3 deferred — §5-gated).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: wiring ②b — native fetch hook + 401→refresh→retry + `/api/auth/*` 호출을 AuthGate 의 onLogin 에 주입.)
