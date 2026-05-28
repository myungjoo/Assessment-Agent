---
id: ADR-0008
title: Auth credential type 결정 — JWT vs session cookie 택일
status: ACCEPTED
date: 2026-05-28
relatedTask: T-0079
supersedes: null
amendments: ["T-0089"]
amendedAt: 2026-05-29
amendReason: "T-0083 (RBAC scaffold) + T-0086 (UserService.changeRole) + T-0087 (UserController PATCH /api/users/:id/role) 머지 후 RBAC backbone 의 첫 production endpoint 적용 박제 완결 — §6 후속 chain candidate 가 실현 시점 박제 0 인 stale 상태, retroactive amend 로 source of truth 정합 (T-0089)."
---

# ADR-0008 — Auth credential type 결정 박제

## Context

본 ADR 은 [docs/architecture/api.md §2 L23](../architecture/api.md) 의 **Auth credential 행 "택일" 의무** 를 박제한다 — 동 행이 명시: "session cookie 또는 Bearer JWT 중 P3 AuthModule 도입 task 의 ADR 에서 택일". 본 ADR 이 그 택일을 박제하는 single source of truth.

### P3 진척 status quo 박제

[docs/architecture/p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) (session #22 turn 1, T-0075 머지 직후 refresh) — P3 entity backbone 진척:

- **8/11 entity backbone fully closed** (T-0075 closure 기준) — User · UserRole · Group · Part · Assessment · Contribution · Summary · PermissionDeniedRecord 중 Group + Part CRUD-U 4-layer 완성.
- **잔여 P3 backbone ~5~6 task** — User entity + AuthModule + ADR-0008 신설 chain 의 진입 시점.
- **AuthModule 미박제** — [docs/architecture/modules.md L32](../architecture/modules.md) AuthModule row 만 박제 (책임 · dependency), 실 service / controller / guard 신설 0.
- **ADR-0008 트리거 시점 도달** — p3-to-p4-transition.md §2.3 ADR-0008 row "P3 진행 중 우선" 트리거.

### REQ 외력 (본 ADR 이 cover)

- **REQ-043** ([README.md L83](../../README.md)) — "모든 사용 기능은 보안사항으로서 ID 와 Password 로 보호". 본 ADR 이 ID/Password 인증의 credential format 결정.
- **REQ-044** ([README.md L84](../../README.md)) — "SuperAdmin (첫 로긴), Admin, User 3 등급. Admin→User 변경은 첫 로긴 Admin 만 수행, 본인에 대해서는 Admin→User 불가". 본 ADR 의 token / cookie 가 user role claim 을 carry + self-demote 차단 invariant 의 backbone.
- **REQ-045** ([README.md L85](../../README.md)) — "Admin 은 평가 자료 재작성 / Reset / Import-Export / 인원 편집 등". Admin tier endpoint 의 RBAC guard 가 본 credential 을 verify.
- **REQ-046** ([README.md L86](../../README.md)) — "User 등급은 시각화 자료의 조회 / Sorting / Filtering 등 read-only". User tier endpoint guard 도 동일.

### 시스템 deployment 환경 박제 (ADR-0003 §2 정합)

[docs/decisions/ADR-0003-deployment.md §2](ADR-0003-deployment.md) (Secret = env 기반 `@nestjs/config`) 의 박제와 본 ADR 의 정합:

- **monolithic NestJS process 1 개** (ADR-0003 §1) — auth credential verify 가 동일 process 안에서 일어남, 별도 auth service hop 0.
- **secret 은 환경변수** (ADR-0003 §2) — JWT signing secret 또는 session secret 모두 `process.env` 의 `@nestjs/config` getter 로 read. dev `.env` (gitignore) / prod systemd `EnvironmentFile=` 표준.
- **HTTPS-only** ([docs/architecture/api.md §2 L19](../architecture/api.md)) — TLS over TCP, 평문 HTTP 미사용. cookie 의 `Secure` flag / Bearer header 의 TLS 보호 모두 본 전제 위에 성립.
- **horizontal scaling 미확정** (ADR-0003 §1 의 "P5 이후 NFR 압박 시 worker 분리 ADR 전환") — 본 ADR 시점에서는 monolithic 1 process 이나, 향후 scale-out 시 session store (Redis) 도입 ADR 발화 risk 회피 의무.

### P6 frontend 정합

[docs/architecture/modules.md WebModule row](../architecture/modules.md) — SPA 자체 framework (React / Vite 후보) 는 P6 ADR 별도 결정. 본 ADR 은 SPA 의 credential 보관 패턴 (localStorage / sessionStorage / cookie / in-memory) 의 backbone 결정.

## Decision

본 ADR 은 **JWT (JSON Web Token) 를 HttpOnly Secure SameSite=Strict cookie 에 담아 전송하는 hybrid 패턴** 을 채택한다. 본 결정의 핵심 4 항목:

### Decision §1 — Token format: JWT (Bearer)

- **JWT 채택** — 표준 RFC 7519 token format. payload 에 `sub` (userId) + `role` (SuperAdmin / Admin / User) + `iat` + `exp` claim. NestJS 의 `@nestjs/jwt` 의 `JwtService.sign()` / `verify()` 표준 API 사용.
- **session cookie 거부 사유** — server-side session store (Redis 또는 PostgreSQL session table) 가 monolithic 1 process 에서는 ROI 낮음 + horizontal scale 전환 시 별도 store dependency 추가 의무 발생 (ADR-0003 §1 의 worker 분리 ADR 발화와 결합 risk).

### Decision §2 — Token delivery: HttpOnly Secure SameSite=Strict cookie

- **cookie 전송** — 순수 Bearer header (`Authorization: Bearer <jwt>`) 는 SPA 의 token 저장 위치 (localStorage / sessionStorage) 가 XSS 노출 surface. **HttpOnly cookie 에 JWT 담아 자동 전송** 이 XSS 안전 (`document.cookie` 로 JS read 불가).
- **cookie attributes 박제**:
  - `HttpOnly: true` — JS read 차단 (XSS 안전).
  - `Secure: true` — HTTPS 전용 (ADR-0003 §4 의 HTTPS-only 정합).
  - `SameSite: 'Strict'` — CSRF 차단 (cross-site request 시 cookie 미전송).
  - `Path: '/'` — 모든 API endpoint 적용.
  - `Domain` — 명시 안 함 (운영 호스트의 default domain). subdomain 분리 시 별도 ADR.
- **API 호출 시 fetch credentials**: SPA 의 `fetch(url, { credentials: 'include' })` 또는 `axios.defaults.withCredentials = true` 로 cookie 자동 동봉.

### Decision §3 — Token TTL

- **Access token TTL: 15 분** — 짧은 lifetime 으로 token 탈취 risk 최소화. JWT payload 의 `exp` claim.
- **Refresh token TTL: 7 일** — 별도 cookie (`refresh_token`, 동일 HttpOnly Secure SameSite=Strict) 로 발급. Refresh endpoint (`POST /api/auth/refresh`) 에서 access token 재발급.
- **Refresh token rotation** — refresh 시점에 신규 refresh token 재발급 + 기존 refresh token 무효화 (DB 의 `RefreshToken` table 에 jti claim 박제 + revoked flag, 후속 T-0080 candidate). rotation 이 refresh token 탈취 → 정상 user 의 refresh 시 detect path.

### Decision §4 — Signing algorithm: HS256

- **HS256 (HMAC SHA-256)** — symmetric key, single secret (`AUTH_JWT_SECRET`) 으로 sign + verify. monolithic 1 process 에서는 asymmetric (RS256) 의 public/private key pair 분리 의미가 작음 (verify subject = signer subject = 동일 process).
- **RS256 거부 사유** — multi-service (예: API gateway 별도, microservice 분리) 시 public key 로 verify 만 가능한 분리가 유의미하나, ADR-0003 §1 의 monolithic 정합으로 본 시점 ROI 0.
- **HS256 → RS256 전환 조건** — worker 분리 ADR (ADR-0003 §1 의 SUPERSEDE) 발화 시점에 함께 검토.

### Decision §5 — Secret 관리 (ADR-0003 §2 정합)

- **환경변수 이름 박제**:
  - `AUTH_JWT_SECRET` — access token signing secret (HS256 key, ≥ 256-bit random).
  - `AUTH_JWT_REFRESH_SECRET` — refresh token signing secret (별도 secret, access secret 과 분리 — refresh 탈취 시 access forge 차단).
- **rotation 정책**: 본 ADR 시점에는 manual rotation (process restart). 자동 rotation 은 P7 / P8 vault 도입 ADR (ADR-0003 §2 의 후속) 동반.
- **dev/prod 분리**: dev 는 `.env` (`.gitignore` 등록 의무), prod 는 systemd `EnvironmentFile=` 또는 Docker `--env-file`. ADR-0003 §2 표준 패턴 정합.

### Decision §6 — 라이브러리 채택 박제 (실 install 은 후속 task)

본 ADR 은 **라이브러리 채택 결정만 박제** — 실 `pnpm add` 는 후속 T-0081 candidate 의 책임. [CLAUDE.md §5](../../CLAUDE.md) "새 외부 dependency 추가" BLOCKED 게이트 정합:

| 라이브러리 | 책임 | install 시점 |
| --- | --- | --- |
| `@nestjs/jwt` | `JwtService.sign()` / `verify()` 표준 API | 후속 T-0081 |
| `@nestjs/passport` | Passport strategy 통합 base | 후속 T-0081 |
| `passport-jwt` | JWT strategy (cookie / Bearer header extractor) | 후속 T-0081 |
| `bcrypt` 또는 `argon2` | Password hashing (User entity password column) | 후속 T-0080 (User entity 신설 task) |
| `cookie-parser` | NestJS app middleware (`app.use(cookieParser())`) | 후속 T-0081 |

본 task scope 안에서 `package.json` 변경 0, `pnpm add` 0, dependency lockfile 변경 0.

## Consequences

### 양의 (positive)

1. **NestJS ecosystem 정합 강화** — `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` 표준 stack 채택 → agent (architect / implementer) 의 framework convention 환각 ↓ + docs 풍부 + 사례 누적.
2. **Horizontal scaling 친화** — stateless JWT verify 로 monolithic → worker 분리 ADR 발화 시 session store (Redis) 추가 dependency BLOCKED 게이트 회피. ADR-0003 §1 의 future-proof 정합.
3. **XSS 안전** — HttpOnly cookie 의 JS read 차단 으로 SPA storage (localStorage) XSS 노출 surface 회피. P6 web frontend 도입 시 credential 보관 ADR 동반 불요 (본 ADR 이 cover).
4. **CSRF 방어 backbone** — SameSite=Strict cookie 가 cross-site request 시 자동 미전송. 추가 CSRF token middleware 도입 부담 회피 (필요 시 별도 ADR).
5. **REQ-044 self-demote 차단 invariant backbone** — JWT payload 의 `role` claim 이 매 request 마다 verify, AuthModule guard + UserModule service 에서 token 의 role + DB 의 role 양쪽 검증 (token-tamper + DB-bypass 둘 다 차단).
6. **revocation path 박제** — Refresh token rotation + DB 의 `RefreshToken` table (revoked flag) 로 logout / role 변경 시 즉시 revocation 가능. Stateless JWT 의 일반적 "revocation 비용" 단점을 access TTL 15 분 + refresh rotation 으로 mitigate.
7. **Token tamper 방어** — HS256 signing 의 secret 미공개로 server-side verify 가 절대 path. payload 의 role claim tampering 시 verify fail.

### 음의 (negative) / trade-off

1. **Access TTL 15 분의 refresh 빈도** — SPA 가 access expire 시점 마다 refresh endpoint 호출 → 호출 빈도 ↑. mitigation: HttpOnly cookie 의 expire 시점 모니터링 + 401 응답 시 refresh + retry interceptor 패턴 (SPA-side 표준 pattern).
2. **Refresh token rotation 의 race** — concurrent request 가 동일 refresh token 으로 동시 refresh 시 race (1 개만 성공, 나머지 401). mitigation: refresh 시점에 DB row lock + grace window (1 초) 박제 (후속 T-0081 의 implementer 책임).
3. **cookie 의 multi-domain 제약** — `Domain` 명시 안 함으로 단일 운영 호스트 domain 가정. multi-domain (예: api.example.com / app.example.com 분리) 시 별도 ADR 의 `Domain=.example.com` + CORS 설정 동반.
4. **HS256 의 secret share** — symmetric key 가 worker 분리 ADR (ADR-0003 §1 SUPERSEDE) 발화 시 모든 worker 에 share 의무. mitigation: RS256 전환 ADR 동반 (Decision §4 의 전환 조건).
5. **Refresh token 의 DB write 비용** — 매 refresh 시 token rotation + DB write (RefreshToken row 갱신). mitigation: refresh 빈도 자체가 access TTL 의 1/N (15 분 1 회) 로 낮음.

### 후속 task chain 박제 (ADR-first split 4-stage pattern reuse)

본 ADR 의 후속 task chain — T-0051 → T-0054 의 ADR-first split 4-stage precedent 재사용:

| 후속 task | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **T-0080 candidate** | User entity + UserRole + Prisma model + repository | (없음, ADR-0008 머지 후 즉시) | 없음 — 기존 Prisma schema 확장 + repository 신설. password 컬럼 박제 시 `bcrypt` / `argon2` install 발화 → BLOCKED 게이트 발화 가능 (별도 분리 권장). |
| **T-0081 candidate** | `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` + `cookie-parser` install + AuthModule scaffold (`AuthService`, `AuthController`, `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`) | T-0080 (User entity) | **있음 — 새 dep install 발화** ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트). 본 ADR 박제 후 사용자 승인 → install 만 trigger. |
| **T-0082 candidate** | `POST /api/auth/login` + `POST /api/auth/logout` + `POST /api/auth/refresh` + `GET /api/me` endpoint + RBAC guard 적용 | T-0081 (AuthModule) | 없음 — endpoint 신설 + e2e test. |
| **T-0083 candidate** | RBAC self-demote invariant (REQ-044 본인 Admin→User 차단) + 401/403 error shape ([api.md §7 error shape](../architecture/api.md) 정합) | T-0082 (endpoint) | 없음 — service layer invariant + test. |

### 후속 chain 실현 박제 (T-0089 retroactive amend, 2026-05-29)

본 § 의 위 후속 task chain candidate 표 (T-0080~T-0083) 는 박제 시점 (2026-05-28, T-0079 머지 직후) 의 후보 estimate. 그 후 RBAC 실현 chain 이 다음과 같이 머지되어 **RBAC backbone 의 첫 production endpoint 적용 박제 완결** — 본 amend 가 그 실현 시점 + cross-ref + lesson 박제.

| 실 머지 task | scope | 머지 sha | PR | 완료 일자 |
| --- | --- | --- | --- | --- |
| **T-0083** | JwtAuthGuard + JwtStrategy (cookie extractor) + @Roles() decorator + RolesGuard scaffold (4 신규 surface) | `6223fdd` | PR-77 | 2026-05-28 23:15 KST |
| **T-0086** | UserService.changeRole + REQ-044 5 invariant (actor=SuperAdmin / role enum / target null / self-demote 차단 / P2025 변환) + UserRole literal union + colocated spec 22 it | `f1d5aa8` | PR-80 | 2026-05-29 (session #25 turn 8) |
| **T-0087** | UserController + ChangeRoleDto + PATCH /api/users/:id/role + @Roles SuperAdmin 단일 + colocated spec 22 it + e2e 7 it + AuthModule↔UserModule forwardRef cycle 해결 + db-truncate User 추가 | `fabeb40` | PR-82 | 2026-05-29 (session #25 turn 10) |

**RBAC backbone 실현 시점 = T-0087 머지 (PR-82 `fabeb40`)** — "scaffold (T-0083) → service (T-0086) → controller endpoint (T-0087)" 3 chain closed. 첫 production endpoint 가 `PATCH /api/users/:id/role` 로 @Roles SuperAdmin 단일 보호 + JwtAuthGuard + RolesGuard 전 layer 실 적용.

#### Within-round 2 fix push lesson (T-0087 박제)

T-0087 round 1 안에서 push 가 2 회 fix 후 final green 도달 — 본 ADR 후속 chain 박제 의 lesson:

1. **prettier lint auto-fix** — push 1 차 후 CI lint step 에서 `test/e2e/users.e2e-spec.ts` L60 + L230 두 곳 prettier formatting error 발견 → `pnpm prettier --write` 로 자동 보정 후 push 2 차. lint step pass 도달.
2. **cookie-parser middleware test-path 격차 catch** — push 2 차 후 CI e2e step 7/7 fail with 401 (인증 실패) 진단. root cause: `src/main.ts` boot path 에만 `app.use(cookieParser())` wire 되어 있고, `Test.createTestingModule(...).compile()` path (supertest e2e 진입점) 에는 cookie-parser middleware 가 미적용 → e2e 가 cookie 기반 JWT verify 실패. **production code path 와 test path 의 격차가 처음 발견된 사례**. fix: e2e setup helper (또는 `beforeAll`) 에 1 라인 `app.use(cookieParser())` 추가 → push 3 차 → e2e 7/7 green.

본 lesson 의 follow-up 후보: **production-test path 격차 영구 fix task** (T-0091 candidate — main.ts 의 middleware wire 를 test path 도 자동 포함하는 helper 함수 추출, 또는 ConditionalMiddleware / NestApplication.create() 공통 setup 패턴 박제). 본 amend 는 lesson 만 박제, fix 자체는 별도 task.

### 후속 amend 후보 (별도 doc-only direct task)

- **[api.md §2 L23](../architecture/api.md) Auth credential 행 amend** — "택일" → 본 ADR 의 결정값 (JWT + HttpOnly cookie hybrid) 으로 박제 + ADR-0008 link.
- **[p3-to-p4-transition.md §2.3 ADR-0008 row](../architecture/p3-to-p4-transition.md) status amend** — "P3 진행 중 우선" → "ACCEPTED (2026-05-28, T-0079)".
- **[modules.md AuthModule row](../architecture/modules.md) amend** — "JWT 또는 session cookie 발급·검증" → "JWT (HttpOnly cookie hybrid) 발급·검증 — ADR-0008".

본 ADR 자체는 위 amend 를 **결정만** 박제 — 실 amend 는 별도 doc-only direct follow-up task (envelope ~30 LOC) 의 책임.

### STATE.phase 변경 0 박제

본 ADR 머지 후에도 [docs/STATE.json](../STATE.json) 의 `phase` 는 **P3-in-progress 유지** — [docs/architecture/p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) 옵션 (c) hybrid-parallel 정의 정합. ADR-0008 박제는 옵션 (c) 의 자연 trigger marker 이나, phase 전환 / binding-decision 의 실제 박제는 별도 planner / humanQuestion 의 책임 (T-0063 invariant 유지).

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) JWT in HttpOnly Secure SameSite cookie (hybrid)** (채택) | stateless verify / horizontal scaling 친화 / XSS 안전 (HttpOnly) / CSRF 차단 (SameSite=Strict) / NestJS `@nestjs/jwt` 표준 / refresh rotation 으로 revocation path 박제 / ADR-0003 §1 monolithic 정합 + future worker 분리 ADR 친화 | access TTL 15 분 refresh 빈도 ↑ / refresh token DB write 비용 / multi-domain 시 별도 ADR 동반 / HS256 의 secret share (worker 분리 시) | **✓ 채택** |
| (2) Server-side session cookie (express-session / `@nestjs/passport-local` + PostgreSQL session store) | server-side revocation 자유 (DB row 삭제 1 회) / 표준 패턴 / payload tampering 본질 차단 (token 에 user data 없음, sessionId 만) | session store dependency 추가 (PostgreSQL 또는 Redis) → ADR-0003 §1 worker 분리 ADR 발화 시 Redis dep BLOCKED 게이트 risk / horizontal scaling 시 sticky session 또는 분산 store 필요 / `express-session` + `connect-pg-simple` 또는 `connect-redis` 추가 dep / CSRF 보호 별도 middleware 의무 | 기각 — horizontal scaling 친화도 (i) NestJS 정합 (iii) frontend 정합 (iv) revocation 정합 4 차원 평가 의 (ii) horizontal scaling 차원에서 채택안 대비 명확 열세 |
| (3) JWT in localStorage / sessionStorage + Bearer Authorization header | SPA 표준 패턴 (단순) / cookie 처리 부담 0 / CORS 단순 | **XSS 노출 surface** — `document.cookie` 가 아닌 `localStorage.getItem('token')` 도 JS read 가능, XSS 1 회 발생 시 token 전부 유출 / refresh token 도 동일 storage = 탈취 시 영구 / SameSite cookie 의 CSRF 자동 방어 부재 → CSRF token middleware 추가 의무 | 기각 — REQ-043 보안 backbone 약화 + XSS 노출의 영구화 risk |
| (4) OAuth / OIDC 외부 위임 (예: Samsung 내부 IdP / Azure AD / Google Workspace SSO) | 외부 IdP 의 audit / MFA / SSO 통합 / 자체 자격증명 backbone 부담 0 / password reset / lock-out 정책 외부 위임 | **REQ-043 self-contained 인증 backbone 요구와 어긋남** — README L83 "ID 와 Password 로 보호" 가 system-internal account 박제 / 사내 환경 외부 IdP 의존 시 IdP outage 가 본 system outage 전파 / OIDC client SDK 추가 dep / SuperAdmin 첫 로긴 invariant (REQ-044) 가 외부 IdP 의 user mapping 과 어울리지 않음 | 기각 — REQ-043 의 self-contained 의도와 정합 0 |
| (5) Bearer header (Authorization: Bearer <jwt>) — cookie 미사용 | mobile / API client 정합 / SPA 외 client 다양성 친화 / CORS 단순 | XSS storage risk (대안 (3) 동일) / SPA storage 책임이 client 측 / cookie 의 HttpOnly 안전 net 부재 | 기각 — 본 시스템의 1 차 client 는 P6 web SPA + (선택적) API client. cookie hybrid 패턴이 SPA 안전 net + API client 도 cookie support (curl `--cookie` / Postman cookie jar) 로 cover |
| (6) Hybrid — JWT in cookie + 동시 Bearer header 지원 | SPA (cookie) + API client (Bearer header) 둘 다 1 등 시민 | 두 path 의 verify logic / CSRF 정책 / 보관 위치가 분기 → 코드 복잡도 ↑ / 두 path 의 secret share 또는 분리 결정 추가 / 본 시점 client 다양성 요구 없음 | 미채택 (deferred) — 본 ADR 의 채택안에서 향후 자연 확장 가능 (`passport-jwt` 의 extractor 가 cookie + header 양쪽 fromExtractors 패턴 표준). 별도 ADR supersede 없이 본 ADR 안에서 extractor 만 추가하면 됨. |

## References

- [README.md](../../README.md) L80–86 — REQ-043 (ID/Password 인증) / REQ-044 (3 등급 + SuperAdmin 첫 로긴 + self-demote 차단) / REQ-045 (Admin 권한) / REQ-046 (User read-only)
- [docs/architecture/api.md §2](../architecture/api.md) L15–25 — Auth credential 행 "택일" 의무 source (본 ADR 의 직접 motivation)
- [docs/architecture/api.md §3](../architecture/api.md) L26–37 — Auth tier 4 등급 (Public / User / Admin / SuperAdmin) + escalation 의미
- [docs/architecture/api.md §4](../architecture/api.md) L39–53 — `/api/auth` + `/api/users` + `/api/me` prefix 책임 module 매핑
- [docs/architecture/modules.md L32](../architecture/modules.md) — AuthModule row (책임 · dependency · cover REQ)
- [docs/architecture/p3-to-p4-transition.md §2.3](../architecture/p3-to-p4-transition.md) — ADR-0008 row (트리거 시점 "P3 진행 중 우선")
- [docs/architecture/p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) — session #22 binding-decision 권장 강화 박제
- [docs/decisions/ADR-0001-stack.md](ADR-0001-stack.md) — NestJS / TypeScript / pnpm stack baseline
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma (RefreshToken table 의 backbone)
- [docs/decisions/ADR-0003-deployment.md §1](ADR-0003-deployment.md) — Monolithic NestJS process (본 ADR 의 horizontal scaling 정합 baseline)
- [docs/decisions/ADR-0003-deployment.md §2](ADR-0003-deployment.md) — Secret = env 기반 `@nestjs/config` (`AUTH_JWT_SECRET` / `AUTH_JWT_REFRESH_SECRET` 환경변수 backbone)
- [docs/decisions/ADR-0003-deployment.md §4](ADR-0003-deployment.md) — HTTPS-only (cookie Secure flag backbone)
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](ADR-0004-smoke-e2e-db-mode.md) — NEW-doc ADR-first split 4-stage chain precedent
- [docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md](ADR-0005-mcp-tools-for-pr-review-flow.md) — 최근 ACCEPTED ADR format / depth / Refs trailer 패턴 precedent
- [CLAUDE.md §3.1](../../CLAUDE.md) — pr-mode 정합 (ADR 신설 = pr-column)
- [CLAUDE.md §5](../../CLAUDE.md) — 새 외부 dependency BLOCKED 게이트 (본 ADR 안에서 install 0, 후속 T-0081 trigger)
- [CLAUDE.md §9](../../CLAUDE.md) — secret 코드·journal·task 파일에 절대 적지 않는다 (환경변수 이름 박제는 OK, 실 secret 값 박제 0)

Refs: T-0079, ADR-0003, ADR-0004
