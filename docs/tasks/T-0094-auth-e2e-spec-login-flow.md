---
id: T-0094
taskId: T-0094
title: auth.e2e-spec.ts 신설 — POST /api/auth/login + logout + refresh end-to-end (T-0091 helper + T-0092 signup round-trip)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-044]
estimatedDiff: 260
estimatedFiles: 2
estimatedLoc: 260
dependsOn: [T-0091, T-0092]
sizeExempt: false
created: 2026-05-29
createdAt: 2026-05-29T16:30:00+09:00
plannerNote: "loop session #27 turn 1 — RBAC backbone 4/4 + contract source 정합 박제 완결 후 자연 next: auth flow e2e 공백 박제, partial-backbone × 1.3 envelope 260 LOC / 2 파일."
---

# T-0094 — auth.e2e-spec.ts 신설 (POST /api/auth/login + logout + refresh end-to-end, T-0091 helper + T-0092 signup round-trip)

## Why

[T-0082](T-0082-auth-controller-login-logout-refresh.md) 머지 (sha `5314c27` PR-75) 시점에 [AuthController](../../src/auth/auth.controller.ts) 의 `POST /api/auth/login` + `POST /api/auth/logout` + `POST /api/auth/refresh` 3 endpoint 가 박제되었으나 **end-to-end e2e 검증은 0** — 현재 `auth.controller.spec.ts` 의 unit spec 만 cover. [PLAN.md L65 P3 test-quality bullet](../PLAN.md) — _"e2e test domain endpoint 확장 — R-113 e2e 의무 이행"_ 의 마지막 production endpoint 공백.

후속 chain 의 박제 완결 상태:

- [T-0090](T-0090-e2e-app-factory-cookie-parser-helper.md) (MERGED `59d1a26`) — `createE2EApp()` + `applyGlobalMiddleware()` 단일 source 박제 → cookie-parser middleware test-path 일관성 확보. 본 task 의 `req.cookies` 자동 parsing 의 선행 의존.
- [T-0091](T-0091-auth-e2e-helper.md) (MERGED `2e1b4b4`) — `createAuthenticatedE2EApp([seed])` 의 user seed + token 발급 atomic 박제. 본 task 가 두 번째 production 소비 사례 (첫 = T-0092 signup).
- [T-0092](T-0092-signup-endpoint.md) (MERGED `f97329b`) — `POST /api/users` signup + 첫 user SuperAdmin 자동 분기. 본 task 의 e2e setup 이 signup endpoint 통한 user 생성 round-trip 검증 후보 (Out of Scope — 본 task 는 seed 직접 박제 우선, signup round-trip 은 follow-up).

본 task 가 [test/e2e/auth.e2e-spec.ts](../../test/e2e/auth.e2e-spec.ts) 신설 — `users.e2e-spec.ts` (T-0087) + `parts.e2e-spec.ts` (T-0062) 1:1 mirror 패턴:

1. **POST /api/auth/login** — happy (정상 credentials → 200 + access_token + refresh_token cookie set + body.userId) + error (email 부재 → 401 enumeration 차단 동일 메시지 / password 불일치 → 401 동일 메시지) + branch (cookie set 2 종 + ADR-0008 §2 cookie attributes: HttpOnly + Secure + SameSite=Strict) + negative (ValidationPipe: invalid email format / 빈 password / wrong type 등).
2. **POST /api/auth/logout** — happy (cookie 2 종 clear → 204 + Set-Cookie header expire) + idempotent (인증 없는 상태에서도 정상 호출 가능 — guard 0) + branch (cookie attributes 정합: clearCookie 는 set 시점과 동일 attributes 박제 의무).
3. **POST /api/auth/refresh** — happy (login → refresh cookie → rotation → 신규 access + refresh 2 종 발급 + role claim 보존) + error (cookie 부재 → 401 / 만료 → 401 / signature invalid → 401 enumeration 차단 동일 메시지 / role claim 부재 → 401) + branch (rotation 시 신규 token 이 기존 token 과 다름 검증).

[ADR-0008 Decision §3 (TTL: access 15m / refresh 7d)](../decisions/ADR-0008-auth-credential-type.md) + [§2 (cookie attributes)](../decisions/ADR-0008-auth-credential-type.md) + [§5 (refresh secret 분리 AUTH_JWT_REFRESH_SECRET)](../decisions/ADR-0008-auth-credential-type.md) 의 contract 가 본 spec 의 검증 항목.

[CLAUDE.md §3.2 R-113](../../CLAUDE.md) — _"smoke + end-to-end test 도 CI 에서 함께 수행"_ — 본 task 가 auth flow 의 R-113 의무 이행. e2e 의 CI step (`pnpm test:e2e`) 통과 의무.

## Required Reading

- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — 3 endpoint 박제 (login L127-155 / logout L173-178 / refresh L197-252). 본 spec 의 검증 대상 surface. `ACCESS_TOKEN_COOKIE` / `REFRESH_TOKEN_COOKIE` / `COOKIE_OPTIONS` const export 박제.
- [src/auth/auth.service.ts](../../src/auth/auth.service.ts) — `verifyPassword` / `issueAccessToken` / `issueRefreshToken` 박제 + `REFRESH_SECRET_ENV = "AUTH_JWT_REFRESH_SECRET"` const. 본 spec 이 refresh secret 셋업 시 사용.
- [src/auth/dto/login.dto.ts](../../src/auth/dto/login.dto.ts) — LoginDto (email + password) 박제. 본 spec 의 negative payload 분기 reference.
- [src/auth/auth.controller.spec.ts](../../src/auth/auth.controller.spec.ts) — unit spec precedent. e2e 박제 시 unit-cover 중복 회피 — e2e 는 HTTP layer + DB persistence + cookie set/clear round-trip 만 cover.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — T-0091 박제. `createAuthenticatedE2EApp([seed])` + `TEST_AUTH_JWT_SECRET` 박제. 본 spec 이 두 번째 production 소비 사례.
- [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) — T-0087 + T-0092 박제. **본 spec 의 1:1 mirror 패턴 reference** — beforeAll 부트스트랩 / afterAll close / afterEach truncate / supertest 의 `request(app.getHttpServer())` 호출 / cookie set 검증.
- [test/e2e/parts.e2e-spec.ts](../../test/e2e/parts.e2e-spec.ts) — T-0062 박제. e2e real DB precedent — afterEach truncate 패턴 정합.
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) — T-0090 박제. `createE2EApp()` + cookie-parser middleware wire. 본 spec 이 refresh endpoint 의 `req.cookies` 의존.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll(prisma)` 박제. afterEach 책임.
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — JwtModule.registerAsync (access secret) 박제. 본 spec 이 refresh 검증 시 `process.env.AUTH_JWT_REFRESH_SECRET` 도 셋업 의무.
- [docs/decisions/ADR-0008-auth-credential-type.md §2-§3 + §5](../decisions/ADR-0008-auth-credential-type.md) — cookie attributes + TTL + refresh secret 분리 박제. 본 spec 의 검증 contract.
- [docs/architecture/api.md L17-22](../architecture/api.md) — `/api/auth/*` row 박제 (T-0084 amend 후). status + body shape contract 의 source.
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — partial-backbone × 1.3 multiplier (단일 spec + 기존 helper 소비, production code 변경 0).

## Acceptance Criteria

### A. `test/e2e/auth.e2e-spec.ts` 신설 — 부트스트랩 + setup

- [ ] [test/e2e/auth.e2e-spec.ts](../../test/e2e/auth.e2e-spec.ts) 신설. 파일 상단 한국어 주석 15-20 줄 — 책임 (auth flow end-to-end + ADR-0008 §2/§3/§5 cover) + smoke vs unit vs e2e 경계 (unit = controller.spec / service.spec / dto.spec, e2e = HTTP + DB + cookie round-trip) + 실 DB 전략 (ADR-0004 §Decision 정합, real PostgreSQL services.postgres localhost:5432) + JWT 발급 setup (login flow 자체 통과 — auth-e2e-helper 의 issueAccessTokenFor 는 본 spec 에서 미사용, login endpoint 가 cookie 직접 set) + AUTH_JWT_REFRESH_SECRET 박제 시점 (module load 이전, top-level process.env 셋업) + Out of Scope (RefreshToken DB revocation = T-0092 candidate, signup round-trip = follow-up).
- [ ] import 박제 — `INestApplication` type-only / `request` from supertest / `PrismaService` from `../../src/persistence/prisma.service` / `createE2EApp` from `../helpers/e2e-app-factory` / `truncateAll` from `../helpers/db-truncate` / `ACCESS_TOKEN_COOKIE` + `REFRESH_TOKEN_COOKIE` from `../../src/auth/auth.controller` / `bcrypt`. helper 의 module-load side-effect import — `import "../helpers/auth-e2e-helper"` 또는 `TEST_AUTH_JWT_SECRET` 박제 보존.
- [ ] **AUTH_JWT_REFRESH_SECRET 박제** — 본 spec 의 top-level (import 후 describe 이전) 에 `process.env.AUTH_JWT_REFRESH_SECRET ??= "test-auth-jwt-refresh-secret-e2e"` 박제. AuthController.refresh 의 `process.env[REFRESH_SECRET_ENV] ?? ""` path 정합. 셋업 안 하면 refresh 가 빈 secret 으로 verify 시도 → 모든 refresh test 가 401 — 정상 동작 검증 불가.
- [ ] beforeAll: `createE2EApp()` 호출 → app/moduleRef/prisma 박제. (createAuthenticatedE2EApp 미사용 — 본 spec 은 login endpoint 자체를 검증, helper 의 token 발급 bypass 0 패턴.)
- [ ] afterAll: `app.close()` + `prisma.$disconnect()` 박제 (connection 누수 0).
- [ ] afterEach: `truncateAll(prisma)` 박제 (test 간 state 격리).

### B. POST /api/auth/login 검증 (R-112 4 카테고리 happy/error/branch/negative ≥ 5 it)

- [ ] `describe("POST /api/auth/login", ...)` block. 다음 it 박제 (≥ 5 it):
  - **happy — 정상 login**: prisma.user.create 로 user seed (bcrypt 4-round hashedPassword) → `request(app).post("/api/auth/login").send({email, password:"plain"})` → 200 + body.userId === seedUser.id 검증.
  - **happy — cookie 2 종 set + ADR-0008 §2 attributes**: 위 happy 응답 의 `Set-Cookie` header 2 줄 검증 (access_token + refresh_token) + 각 cookie 에 `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` attribute 박제 검증.
  - **error — email 부재 → 401 enumeration 차단**: 존재하지 않는 email 로 login → 401 + body.message === "Invalid credentials".
  - **error — password 불일치 → 401 enumeration 차단 동일 메시지**: 정상 user seed + wrong password → 401 + body.message === "Invalid credentials" (위 error 와 동일 메시지 검증 — enumeration 차단 정합).
  - **negative — invalid email format (ValidationPipe)**: payload `{email:"not-email", password:"x"}` → 400 BadRequest.
  - **negative — 빈 password (ValidationPipe)**: payload `{email:"a@b.c", password:""}` → 400.
  - **negative — wrong type (ValidationPipe forbidNonWhitelisted)**: payload 에 추가 필드 `{email, password, role:"SuperAdmin"}` → 400 (whitelist 위반).

### C. POST /api/auth/logout 검증 (R-112 4 카테고리 happy/branch/negative ≥ 3 it)

- [ ] `describe("POST /api/auth/logout", ...)` block. 다음 it 박제 (≥ 3 it):
  - **happy — cookie 2 종 clear → 204**: 인증된 cookie 와 함께 logout → 204 No Content + `Set-Cookie` header 의 access_token / refresh_token 의 `Expires=Thu, 01 Jan 1970` 또는 `Max-Age=0` 검증.
  - **branch — idempotent (인증 없는 상태)**: cookie 없이 logout → 204 정상. guard 0 박제 검증 (RBAC guard 미적용 — auth.controller L167 주석).
  - **negative — cookie attributes 정합 (clearCookie 의 attributes 가 set 시점과 동일)**: Set-Cookie header 가 `HttpOnly; Secure; SameSite=Strict; Path=/` 박제 검증 — 브라우저 cookie 매칭 의무 (lowercase secure 분리 시 cookie 제거 실패 가능, ADR-0008 §2 정합).

### D. POST /api/auth/refresh 검증 (R-112 4 카테고리 happy/error/branch/negative ≥ 5 it)

- [ ] `describe("POST /api/auth/refresh", ...)` block. 다음 it 박제 (≥ 5 it):
  - **happy — login → refresh → 200 + cookie rotation**: user seed → login → 응답의 `Set-Cookie` 에서 refresh_token 추출 → refresh endpoint 에 `Cookie: refresh_token=<value>` header 박제 → 200 + body.userId === seedUser.id + 응답의 `Set-Cookie` 가 신규 access + refresh 2 종 박제 검증 (rotation).
  - **happy — role claim 보존**: SuperAdmin seed → login → refresh → 신규 access token 의 payload.role === "SuperAdmin" 검증 (JwtService.verify 후 inspection).
  - **error — cookie 부재 → 401**: refresh endpoint 호출 시 Cookie header 0 → 401 + body.message === "Invalid refresh token".
  - **error — signature invalid → 401 enumeration 차단**: forged refresh token (다른 secret 으로 sign) 박제 → 401 + 동일 메시지.
  - **error — refresh token 만료 → 401**: TTL 1ms refresh token 발급 → 즉시 refresh 호출 → 401 + 동일 메시지.
  - **branch — 신규 token 이 기존 token 과 다름 (rotation 검증)**: login 의 refresh_token 추출 → refresh 후 신규 refresh_token 추출 → 두 token 이 다름 검증 (rotation 정합).
  - **negative — role claim 부재 → 401**: payload `{sub:"user-1"}` 만 (role 없음) refresh secret 으로 sign → refresh 호출 → 401 (AuthController.refresh L227 분기 cover).

### E. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 본 task 신규 surface 없음 (production code 변경 0). 기존 auth.controller.ts / auth.service.ts coverage 유지.
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음.
- [ ] `pnpm test:e2e` 통과 — 신규 auth.e2e-spec.ts 13+ it 모두 green + 기존 users.e2e-spec.ts 12 it (T-0092 후) + persons / groups / parts e2e 모두 green (regression 0).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **RefreshToken DB table + revocation 박제** — ADR-0008 §6 후속 chain candidate (T-0092 candidate, 별도 ID). 본 task 의 refresh rotation 은 cookie 단순 재발급 (revocation gap 인지, follow-up).
- **POST /api/users signup round-trip 검증** — signup → 즉시 login → 200 정상 flow 의 cross-endpoint round-trip. 본 task 는 login endpoint 자체 cover 만, signup → login round-trip 은 별도 task (`auth-signup-roundtrip.e2e-spec.ts` 또는 본 spec 확장).
- **JwtAuthGuard 통과 e2e (인증 필요 endpoint)** — users.e2e-spec.ts 가 이미 PATCH /api/users/:id/role 의 RBAC guard 통과 cover. 본 task 는 auth endpoint 자체만.
- **rate limiting / brute-force 차단** — login endpoint 의 자동화 차단 (rate limit / CAPTCHA / lockout) 없음. 별도 task.
- **email 검증 (verification mail)** — login 전 email confirm flow 0. 별도 task / ADR.
- **CSRF token 검증** — SameSite=Strict cookie 만 박제 (CSRF token 0). 별도 ADR.
- **AuthService.verifyToken 의 refresh secret override path 의 service 화** — 현재 AuthController.refresh 가 JwtService.verify 직접 호출 (manual verify). 별도 refactor task.
- **ConfigModule + Joi schema 도입** — `process.env.AUTH_JWT_REFRESH_SECRET` 의 fail-fast 검증. 별도 task.
- **api.md L17-22 의 `/api/auth/*` row 의 추가 amend** — T-0084 에서 4 row amend 완결 (MERGED `24b4436`). 본 task 머지 후 추가 doc amend 불요 (e2e 박제 후 row description 의 검증 항목 추가는 별도 task).
- **modules.md AuthModule row amend** — 본 task 는 e2e 만, AuthModule 책임 변경 0. amend 불요.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — 신규 결정 0, T-0091/T-0092 helper + production code 정공법 1:1 mirror + ADR-0008 §2/§3/§5 contract 박제 검증만).

## Follow-ups

- **T-0095 candidate** — RefreshToken DB table + revocation path (ADR-0008 §6 박제). 본 task 의 rotation gap 후속 fix.
- **T-0096 candidate** — UserResponseDto / Prisma select projection 으로 hashedPassword 응답 제거. T-0092 signup 응답의 보안 risk fix.
- **T-0097 candidate** — POST /api/users RBAC 강화 ADR (Public → Admin+ 또는 분리 endpoint `/api/auth/setup`). T-0092 Out of Scope 박제.
- **signup → login round-trip e2e** — 본 spec 확장 또는 별도 spec 으로 signup endpoint 통한 user 생성 후 login 까지 round-trip.
- **persons/groups/parts 에 RBAC 적용** — Admin tier endpoint 박제 시 본 spec 의 helper 패턴 reuse.
- **ConfigModule + Joi schema 도입** — `AUTH_JWT_SECRET` + `AUTH_JWT_REFRESH_SECRET` fail-fast. 본 spec 의 박제 패턴 재검토.
- **rate limiting / brute-force 차단** — login endpoint 의 자동화 차단. 별도 ADR + task.
- **estimate-model.md 17+ 회차 milestone refinement** — 본 task 의 partial-backbone × 1.3 (e2e spec only, production code 0) variance 박제. T-0091 ×1.86 e2e helper precedent 와 대조 데이터.
