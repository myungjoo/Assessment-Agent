---
id: T-0380
title: P6 composition wiring ②b 인증 fetch hook + 401→refresh→retry + AuthGate onLogin 주입
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-038, REQ-042]
estimatedDiff: 200
estimatedFiles: 5
created: 2026-06-13
independentStream: p6-frontend-composition
dependsOn: [T-0379]
touchesFiles: [web/src/api/apiClient.ts, web/src/api/apiClient.test.ts, web/src/api/auth.ts, web/src/api/auth.test.ts, web/src/AppShell.tsx]
plannerNote: "P6 wiring②b; ADR-0041 Decision3; native fetch 래퍼+401→refresh→retry+POST /api/auth/login·refresh 호출을 AppShell→AuthGate.onLogin 주입; R-112 backbone×1.5≈200 LOC"
sizeExempt: false
---

# T-0380 — P6 composition wiring ②b 인증 fetch hook + 401→refresh→retry + AuthGate onLogin 주입

## Why

ADR-0041 (composition-wiring 전환, ACCEPTED) Consequences §중립 wiring chain 의 ②b slice — wiring ② (T-0379) 가 인증 게이트·view 전환·LoginForm controlled 배선을 얹으면서 **실제 `POST /api/auth/login`·`/api/auth/refresh` 호출과 401→refresh→retry fetch hook 을 명시적으로 후속 slice 로 deferred** 했다 (T-0379 Out of Scope, ADR-0041 Decision 3). 현재 `AuthGate` 의 `onLogin: (username, password) => Promise<boolean>` 는 콜백 위임 추상화로만 존재하고, AppShell 은 그 콜백에 실 동작을 아직 주입하지 않는다. 본 slice 가 ADR-0041 Decision 3 (data-fetch 경계 — native `fetch` 를 얇게 감싼 custom layer, JWT HttpOnly cookie 자동 동반, 401→refresh→retry 1 회 정책) 을 cover 해 로그인 흐름을 실 동작으로 완성한다 (README REQ-038 시각화 UI 진입 / ADR-0040 §2 인증 흐름).

본 slice 는 **zero-new-dep** — 브라우저 표준 `fetch` 를 얇게 감싼 `apiClient` (credentials 동반) + auth helper (`login`/`refresh`) 만 추가하고, 이를 AppShell 이 `AuthGate.onLogin` 콜백으로 주입한다. axios·react-query·router 등 새 dependency 0 (ADR-0040 §5 게이트). 직렬 chain (`dependsOn: [T-0379]`) 이라 ADR-0041 Decision 5 single-claim 순차 stream 규약을 따른다 — `web/src/AppShell.tsx` 공유 수정이라 file-disjoint 불성립.

## Required Reading

- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — Decision 3 (data-fetch 경계: 컨테이너가 thin custom fetch hook 호출, native `fetch`, `credentials` 로 JWT cookie 자동 동반, **401 시 `POST /api/auth/refresh` 1 회 재시도 → 실패 시 로그인 view 전환**, loading/error → props) / Decision 5 (single-claim 순차 stream + 직렬 dependsOn)
- `docs/decisions/ADR-0040-frontend-stack.md` §2 (인증 흐름 — SPA 는 token 저장/접근 안 함, HttpOnly cookie 자동 동반, `POST /api/auth/login` → cookie 발급 → 401 시 `POST /api/auth/refresh` 재시도 → 실패 시 로그인 화면) / §5 (new-dep 게이트 — react/react-dom 만, router/fetch lib/jsdom/@testing-library 금지)
- `docs/decisions/ADR-0008-auth-credential-type.md` §3 (JWT HttpOnly Secure SameSite=Strict cookie, access 15min + refresh 7day rotation — fetch 가 token 을 다루지 않고 cookie 가 자동 동반됨의 전제)
- `docs/architecture/api.md` 67–71행 — `POST /api/auth/login` (email+password, 성공 200 body `{ userId }` + cookie 발급, 실패 401 `Invalid credentials`) / `POST /api/auth/refresh` (refresh cookie 검증 → rotation + cookie set, body `{ userId }`, 실패 401) / `GET /api/auth/me` (현 인증 user 조회, 401/404)
- `web/src/AuthGate.tsx` — 주입 대상. `onLogin: (username, password) => Promise<boolean>` prop 의 실 구현을 AppShell 이 본 slice 에서 주입 (AuthGate 자체 수정 0 — 콜백 위임 추상화 그대로 소비)
- `web/src/AppShell.tsx` — 갱신 대상. AuthGate 에 `onLogin` 콜백 (auth helper `login` 호출) 을 배선. `onAuthenticated` view 전환은 T-0379 가 이미 배선 — 본 slice 는 onLogin 실 구현 주입만 추가
- `web/src/components/LoginForm.test.tsx` — colocated `.test.tsx` 패턴 참고 (vitest + react-dom/server, jsdom 미사용, `.test.tsx` 확장자 고정 — root jest `*.spec.ts` pickup 충돌 회피)

## Acceptance Criteria

- [ ] `web/src/api/apiClient.ts` 신설 — native `fetch` 를 얇게 감싼 래퍼:
  - [ ] `request(path, options)` (또는 `get`/`post` helper) 가 `fetch` 를 `credentials: 'same-origin'` (또는 `'include'` 동등 — JWT HttpOnly cookie 자동 동반, ADR-0041 Decision 3) 으로 호출.
  - [ ] **401→refresh→retry 1 회 정책**: 응답이 401 이면 `POST /api/auth/refresh` 를 1 회 호출하고, refresh 성공 시 원 요청을 1 회 재시도. refresh 실패 (401) 면 원 401 을 그대로 전파 (또는 인증 만료 신호 반환). 재시도는 **1 회만** — 무한 루프 방지 (refresh 요청 자체는 retry 대상에서 제외).
  - [ ] 비-2xx 응답 (401 외) 은 명확한 에러로 변환 (status + 메시지). 네트워크 throw 도 에러로 표면화.
  - [ ] axios/react-query 등 새 dependency import 0 — 브라우저 표준 `fetch` 만.
- [ ] `web/src/api/auth.ts` 신설 — 인증 helper (apiClient 소비):
  - [ ] `login(username, password): Promise<boolean>` — `POST /api/auth/login` 호출 (api.md: email+password body), 성공 (2xx, body `{ userId }`) 시 `true`, 401 (Invalid credentials) 시 `false` 반환. 그 외 에러는 throw (또는 false 로 흡수 — 본문에 정책 명시).
  - [ ] `refresh(): Promise<boolean>` — `POST /api/auth/refresh` 호출, 성공 시 `true`, 401 시 `false`. (apiClient 의 401 재시도 경로에서 사용하거나 별도 노출 — 구현 위치는 본문 명시.)
  - [ ] AuthGate 의 `onLogin` prop signature (`(username, password) => Promise<boolean>`) 와 정합 — AppShell 이 `auth.login` 을 그대로 주입 가능.
- [ ] `web/src/AppShell.tsx` 갱신 — AuthGate 의 `onLogin` 에 실 `auth.login` 을 주입 (T-0379 의 콜백 위임 placeholder 를 실 helper 로 교체). `onAuthenticated` view 전환·R-78 배너 슬롯·헤더 레이아웃 골격은 유지 (T-0378/T-0379 박제 불변). 본 slice 변경은 onLogin 주입 1 지점에 국소화 — App.tsx 를 크게 흔들지 않음 (ADR-0041 Consequences §부정 cap 준수).
- [ ] 새 dependency 0 — `react`/`react-dom` + 브라우저 표준 `fetch` 만 (router/axios/react-query/jsdom/@testing-library import·추가 금지, ADR-0040 §5). 추가 필요 시 BLOCKED (§5 new-dep 게이트).
- [ ] `web/src/api/apiClient.test.ts` 신설 (vitest, `fetch` 를 vi.fn mock — jsdom·@testing-library 미사용). `.test.ts` 확장자 고정. R-112 4 종:
  - [ ] happy-path: 2xx 응답 시 apiClient 가 파싱된 body 를 반환하고 `credentials` 옵션을 동반해 fetch 를 호출함 1+.
  - [ ] error path: 비-2xx (예 500) 응답 시 에러로 변환 1+ / fetch 가 throw (네트워크 실패) 시 에러 표면화 1+.
  - [ ] flow/branch: 401 → refresh 성공 → 원 요청 재시도 성공 분기 1+ AND 401 → refresh 실패 (401) → 원 401 전파 분기 1+ (양 분기 cover).
  - [ ] negative cases 충분 cover: refresh 후 재시도는 **1 회만** (재-401 시 무한 재시도 안 함) 검증 1+ / refresh 요청 자체는 retry 대상에서 제외 1+ / 401 외 status 는 refresh 트리거 안 함 1+ — 예외 상황 분기마다 각 1+.
- [ ] `web/src/api/auth.test.ts` 신설 (vitest, apiClient 또는 fetch mock). `.test.ts` 확장자 고정. R-112 4 종:
  - [ ] happy-path: `login` 이 2xx (`{ userId }`) 시 `true` 반환 1+.
  - [ ] error path: `login` 이 401 (Invalid credentials) 시 `false` 반환 1+ / 비-401 에러 시 정책대로 처리 (throw 또는 false) 1+.
  - [ ] flow/branch: `refresh` 성공/실패 양 분기 각 1+.
  - [ ] negative cases 충분 cover: 빈 username/password 전달 시 동작 1+ / 401 응답이 enumeration-safe 동일 처리됨 (email 부재·password 불일치 구분 안 함) 1+ — 예외 상황 분기마다 각 1+.
- [ ] `pnpm --dir web test` (vitest) 통과 — apiClient.test.ts + auth.test.ts + 기존 AppShell/AuthGate/컴포넌트 test 전부 green.
- [ ] `pnpm --dir web build` (tsc + vite build) 통과 — 타입 에러 0.
- [ ] root `pnpm lint && pnpm build` 통과 (web 변경이 root NestJS 빌드/lint 를 깨지 않음 확인).
- [ ] coverage: web vitest 의 본 task 신규 파일 (apiClient.ts, auth.ts) line ≥ 80% AND function ≥ 80% 충족 (`pnpm --dir web test` coverage 리포트로 확인). web vitest 의 ci.yml 미배선은 T-0355 Follow-up 의 기존 tracked gap.

## Out of Scope

- 대시보드 · Admin · SuperAdmin 셋업 화면 컨테이너의 실 `/api/*` 데이터 fetch 배선 (조회/시계열/mutation) — wiring ③~④ 책임. 본 slice 는 **인증 (`/api/auth/*`) fetch 만**.
- 로그아웃 흐름 (`POST /api/auth/logout`) / 세션 만료 후 자동 로그인 view 전환 (refresh 최종 실패 시 AppShell view 를 `'login'` 으로 되돌리는 전역 배선) — 본 slice 는 apiClient 의 401→refresh→retry 단위까지. 전역 세션 만료 → view 전환 정책은 후속 slice.
- `GET /api/auth/me` 부트 시 세션 복원 (새로고침 후 인증 상태 hydration) — 후속 slice (본 slice 는 login 진입 경로만).
- AuthGate.tsx · LoginForm.tsx 등 기존 컴포넌트 수정 (콜백 위임 추상화 그대로 소비 — AppShell 의 onLogin 주입 지점만 변경).
- R-78 `evaluationInProgress` 실 polling — wiring ⑤ 책임.
- DTO 타입 공유 (backend `src/` 와 frontend 간 shape 공유 방식) — ADR-0040 §중립 별도 결정. 본 slice 는 frontend-local 최소 타입만.
- react-router · @tanstack/react-query · axios · jsdom · @testing-library 등 새 dependency 도입 (ADR-0041 Decision 3 deferred 캐싱/dedup 제안 — §5-gated, 사용자 승인 필요).
- vite dev proxy (`vite.config.ts` `server.proxy`) 설정 — 이미 scaffold 단계 박제 가정; 본 slice 가 새로 추가하면 Follow-up.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 없음 — sub-agent 가 관련 작업 발견 시 추가. 예상되는 다음 slice: wiring ③ — 대시보드 화면 컨테이너 조립 + `/api/assessments`·`/api/summaries`·`/api/contributions` 조회 fetch 배선 (apiClient 재사용). 그리고 세션 만료 → view 전환 / `GET /api/auth/me` 부트 hydration 전역 배선.)
