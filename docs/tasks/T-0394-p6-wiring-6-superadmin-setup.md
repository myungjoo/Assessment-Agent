---
id: T-0394
title: P6 wiring⑥ AppShell 에 SuperAdminSetupForm 배선(POST /api/users 첫-user→SuperAdmin)
phase: P6
status: DONE
mergedAs: b152181
prNumber: 325
reviewRounds: 1
commitMode: pr
coversReq: [REQ-044, REQ-043]
estimatedDiff: 200
estimatedFiles: 4
created: 2026-06-14
independentStream: p6-frontend-composition
dependsOn: [T-0380, T-0393]
touchesFiles:
  - web/src/AppShell.tsx
  - web/src/AppShell.test.tsx
  - web/src/api/auth.ts
  - web/src/api/auth.test.ts
sizeExempt: false
plannerNote: "P6 ⑥ — AppShell 의 마지막 placeholder('superadmin-setup')를 SuperAdminSetupForm 실 배선 + POST /api/users signup helper(첫-user→SuperAdmin, Public, shipped) 주입; setup↔login 토글은 controlled lift-up"
---

# T-0394 — P6 wiring⑥ AppShell 에 SuperAdminSetupForm 배선(POST /api/users 첫-user→SuperAdmin)

## Why

PLAN.md P6 첫 항목 "로그인 / SuperAdmin 초기 셋업 흐름" 의 **잔여 절반** 을 완성하는 조립 slice 다. wiring ②~②b(T-0379/T-0380)가 로그인 흐름(LoginForm + `POST /api/auth/login`)을 배선했으나, presentational `SuperAdminSetupForm`(P6 presentational phase 신설, ADR-0040 §2)은 아직 어떤 view 에도 배선되지 않았다 — `AppShell.tsx` 의 `'superadmin-setup'` view 와 `AUTHED_VIEW_LABEL` 은 현재 placeholder("후속 slice 에서 조립")로 명시적으로 남아 있다. 본 task 는 이 마지막 placeholder 를 실 컴포넌트로 교체한다.

backend 계약은 **이미 shipped** 다 — `POST /api/users`(api.md 72, T-0092 박제)는 Public endpoint 로 `countAll === 0` 일 때 첫 user 를 자동으로 `role="SuperAdmin"` 으로 생성하고(`count > 0` 면 `role="User"` default), 응답 201 `{ id, email, role, createdAt, updatedAt }` 을 준다. 즉 SuperAdmin 초기 셋업의 backend backbone 은 미리 있고(REQ-044 첫-로긴 SuperAdmin), 프런트 조립만 남았다. backend 에 "셋업 필요 여부" GET 신호는 없으므로, login↔setup 모드 전환은 controlled lift-up(주입 prop)으로 표현한다(ADR-0041 Decision 1 — 기존 `initialAuthenticated`/`initialError` 주입 패턴과 동형).

## Required Reading

- `docs/tasks/T-0394-p6-wiring-6-superadmin-setup.md` (본 파일)
- `web/src/AppShell.tsx` — 배선 대상(`View` enum 의 `'superadmin-setup'`, `AUTHED_VIEW_LABEL` placeholder, `view` useState, AuthGate children 분기, `onLogin = authLogin` 주입 패턴)
- `web/src/AppShell.test.tsx` — colocated spec(추가 위치, `renderToStaticMarkup` 정적 렌더 패턴 + view 분기 단언 정합)
- `web/src/api/auth.ts` — `login`/`refresh` helper 패턴(추가할 `signup` helper 의 형태·`request`/`ApiError` 사용·email 매핑 주석 참고)
- `web/src/api/auth.test.ts` — `login`/`refresh` 단위 test 패턴(`request` mock 주입·2xx/401/throw 분기 검증 — 추가할 `signup` test 의 틀)
- `web/src/components/SuperAdminSetupForm.tsx` — 배선할 presentational(props: `username`/`password`/`onUsernameChange`/`onPasswordChange`/`onSubmit`/`loading?`/`error?`; 컴포넌트 수정 0)
- `web/src/api/apiClient.ts` — `request(path, init)` + `ApiError`(status 필드) 시그니처(signup helper 가 호출)
- `docs/architecture/api.md` (72행 `POST /api/users` 행만 — 첫-user→SuperAdmin/Public/`AddUserDto` email+password(MinLength 8)/응답 201 `{id,email,role,...}`)
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` (Decision 1 controlled lift-up·presentational 수정 0 경계만 — 전문 재독 불요)

## Acceptance Criteria

- [ ] `web/src/api/auth.ts` 에 `signup(username, password) => Promise<string | null>` helper 추가 — `POST /api/users` body `{ email: username, password }`(login 과 동일하게 username→email 매핑) 호출, 성공 시 응답 body 의 `role` 문자열 반환(첫-user 여부를 `role === 'SuperAdmin'` 로 호출측이 판정 가능하게), **409**(email 중복) 또는 **400**(`AddUserDto` 위반 — `@MinLength(8)` 등)는 `null` 반환(중복/검증 실패를 enumeration-safe 단순 분기로), 그 외 에러(네트워크/5xx)는 `throw` 전파(호출측 catch 표면화). `login`/`refresh` helper 수정 0.
- [ ] `web/src/AppShell.tsx` 가 `SuperAdminSetupForm` 을 import 하고, `view === 'superadmin-setup'` 분기에서 placeholder(`<p>{AUTHED_VIEW_LABEL[...]}</p>`) 대신 실 `SuperAdminSetupForm` 을 controlled props 로 배선해 렌더한다. setup 입력값(username/password)·loading·error 는 AppShell 이 useState 로 소유(controlled lift-up), `onSubmit` 은 `signup` 을 호출하는 핸들러에 위임한다. `AUTHED_VIEW_LABEL` 에서 `'superadmin-setup'` 키 제거(placeholder 소거 — 비면 객체 자체 제거 가능).
- [ ] login↔setup 모드 전환은 주입형(controlled) — AppShell 에 setup 모드 진입 트리거(예: 미인증 화면에서 "초기 셋업" 전환 콜백 또는 `initialView` 주입 prop)를 두되, **새 라우터 도입 0**. AuthGate 의 미인증 분기와 setup 분기가 상호배타임을 보장(둘 다 동시 렌더 금지). setup 성공(`role` 반환, 특히 `'SuperAdmin'`) 시 view 를 인증 흐름(예: `'login'` 재진입 또는 `DEFAULT_AUTHED_VIEW`)으로 전환하는 핸들러 분기 명시.
- [ ] 새 dependency 0 (ADR-0040 §5 게이트) — react hooks + 기존 `apiClient`/`request` 만 사용. `package.json`/lockfile 미변경. `SuperAdminSetupForm`/`apiClient`/`AuthGate`/다른 presentational 수정 0.
- [ ] happy-path test 1+: (a) `signup` — `request` mock 이 201 `{role:'SuperAdmin'}` 반환 시 `signup` 이 `'SuperAdmin'` 반환. (b) AppShell — `initialView='superadmin-setup'`(또는 setup 진입 prop) 주입 후 `renderToStaticMarkup` 정적 렌더 시 SuperAdminSetupForm 의 셋업 제목(`SuperAdmin 초기 셋업`) 문구가 출력에 포함됨.
- [ ] error path test 1+: (a) `signup` — `request` mock 이 `ApiError(409)` throw 시 `signup` 이 `null` 반환(중복), `ApiError(400)` throw 시 `null` 반환(검증 실패). (b) `signup` — 비-409/400 에러(예: `ApiError(500)` 또는 일반 Error) throw 시 `signup` 이 throw 전파(흡수 안 함).
- [ ] branch test: signup helper 의 (1) 2xx→role 반환, (2) 409→null, (3) 400→null, (4) 그외→throw 4 분기 각각 1+ test. AppShell 의 view 분기 — `'superadmin-setup'`(SuperAdminSetupForm 렌더) vs `'login'`(LoginForm via AuthGate, setup 폼 부재) 두 분기 각각 정적 렌더로 검증.
- [ ] negative cases 충분 cover: signup 응답 body 에 `role` 누락/비문자열일 때 안전 처리(throw 없이 정의된 값 반환 또는 명세된 분기) / setup 모드와 login 모드 동시 렌더 금지(setup 화면에 LoginForm 부재, login 화면에 셋업 폼 부재) / setup error(`null` 반환 시) AppShell 이 SuperAdminSetupForm 의 `error` props 로 안전 표시(throw 없음) — 각 1+ test.
- [ ] `pnpm --dir web test`(vitest) 로 신규 test 포함 전체 green 로컬 검증. root `pnpm lint && pnpm build` green. (web vitest 의 ci.yml 배선은 T-0355 Follow-up 으로 별도 tracked — 본 PR 은 로컬 검증 + reviewer NOTE 명시. `@vitest/coverage-v8` 미설치라 coverage threshold 는 구성적 cover; line/function ≥ 80% 의도는 signup 4 분기 + AppShell view 분기 전수 test 로 충족.)

## Out of Scope

- `SuperAdminSetupForm.tsx` 컴포넌트 자체 수정(props 추가·문구 변경 등) — 배선만.
- backend "셋업 필요 여부" 자동 감지(GET 신호 소비/조건부 setup 화면 자동 진입) — api.md 에 해당 endpoint 미shipped. 본 slice 는 controlled(주입형) setup 모드 진입만. 자동 감지는 계약 확정 후 Follow-up.
- setup 성공 후 자동 로그인(셋업한 자격증명으로 `POST /api/auth/login` 연쇄) — `POST /api/users` 는 세션 쿠키를 발급하지 않으므로 본 slice 는 setup 후 login 화면 재진입까지만. 자동 로그인 연쇄는 Follow-up.
- `Admin → User 승급/강등` UI(`PATCH /api/users/:id/role`) — 별도 slice(AdminView RBAC 흐름 외).
- `apiClient`/`AuthGate`/`LoginForm`/다른 presentational/`DashboardView`/`AdminView` 수정.
- 라우터(react-router) 도입 — 무라우터 view enum 유지(ADR-0041 Decision 2).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (defer until backend signal) setup 화면 자동 진입: backend 가 "user count 0 / 셋업 필요" GET 신호(예: `GET /api/auth/setup-needed`)를 shipped 하면 AppShell 진입 시 그 신호로 setup 모드를 자동 결정하도록 배선. 현재는 controlled(주입형)만.
- (defer) setup 성공 후 자동 로그인 연쇄(`signup` 성공 → 같은 자격증명으로 `auth.login`) — UX 개선, 별도 slice.
- (tracked) web vitest 를 `.github/workflows/ci.yml` 에 배선(T-0355, `onHold: credential-workflow-scope`) — 현재 web test 는 로컬 tester 실행으로만 검증.
