---
id: T-0084
title: api.md §2 Auth credential + §3 Auth tier + §5 /api/auth/* row amend — T-0082/T-0083 실 구현 박제
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 51
estimatedFiles: 1
created: 2026-05-28
dependsOn: [T-0082, T-0083]
plannerNote: "session #25 turn 3 planner dispatch — T-0082 reviewer MINOR follow-up + T-0083 RBAC scaffold 박제 후 api.md 실 구현 동기. doc-only inline-amend × 0.64, ~51 LOC."
---

# T-0084 — api.md §2 Auth credential + §3 Auth tier + §5 /api/auth/* row amend

## Why

[T-0082](T-0082-auth-controller-login-logout-refresh.md) (MERGED 5314c27, AuthController login/logout/refresh + cookie middleware 박제) 의 reviewer round 1 MINOR finding — [docs/architecture/api.md](../architecture/api.md) §5 endpoint 표의 `/api/auth/login` + `/api/auth/logout` row 가 **session 또는 JWT** 의 vague conceptual 박제 상태로 남아있고, T-0082 가 박제한 실 구현 (HttpOnly Secure SameSite=Strict cookie + access 15min + refresh 7day + response body `{userId}` + refresh rotation) 이 표에 미반영. 추가로 `/api/auth/refresh` row 자체가 표에 부재 — T-0082 가 박제한 3 endpoint 중 1 endpoint 가 contract source 에서 누락.

[T-0083](T-0083-rbac-auth-guard-roles-decorator.md) (MERGED 6223fdd, RBAC scaffold — JwtAuthGuard + JwtStrategy + @Roles + RolesGuard 박제) 의 escalation 로직 (SuperAdmin ⊇ Admin ⊇ User) 도 §3 Auth tier 표의 conceptual 박제 상태로 남아있고 실 [ADR-0008](../decisions/ADR-0008-auth-credential-type.md) link / `roles.guard.ts` 의 escalation 박제 사실이 표에 cross-reference 0.

본 task 가 **T-0082 + T-0083 머지 후 api.md 실 구현 동기 first amend** — doc-only inline-amend, 1 파일 (api.md) 의 §2 + §3 + §5 section 3 곳 갱신. **PLAN.md backbone 우선순위와 무관한 backbone clean-up** — RBAC 첫 사용 사례 (T-0085 candidate UserService.changeRole / GET /api/auth/me) 진입 전 contract source 정합을 먼저 박제하여 후속 task 의 spec 참조점을 정확히 만든다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — 본 task 의 amend target. §2 Auth credential row (L23), §3 Auth tier 표 (L29–37), §5 /api/auth/login (L64) + /api/auth/logout (L65) + /api/auth/me (L66) 의 3 row.
- [docs/tasks/T-0082-auth-controller-login-logout-refresh.md](T-0082-auth-controller-login-logout-refresh.md) — 직전 머지 task. Acceptance Criteria §D 의 3 endpoint 실 구현 박제 (HttpOnly + Secure + SameSite=Strict + Path=/, access cookie `access_token` 15min, refresh cookie `refresh_token` 7day, body `{userId}`, refresh rotation).
- [docs/tasks/T-0083-rbac-auth-guard-roles-decorator.md](T-0083-rbac-auth-guard-roles-decorator.md) — 직전 머지 task. Acceptance Criteria §D 의 escalation 로직 박제 (`SuperAdmin: ["SuperAdmin", "Admin", "User"], Admin: ["Admin", "User"], User: ["User"]`).
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — 본 amend 의 source 결정. Decision §1 token format (JWT) / §2 cookie attributes (HttpOnly + Secure + SameSite=Strict) / §3 TTL (15min access / 7day refresh + rotation). api.md §2 의 Auth credential row 가 link 해야 할 ADR.
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — 실 구현 검증 source. ACCESS_TOKEN_COOKIE / REFRESH_TOKEN_COOKIE / COOKIE_OPTIONS const + 3 endpoint method body.
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — escalation 로직 박제 source. ROLE_HIERARCHY 의 박제 내용.
- [CLAUDE.md §3.1](../../CLAUDE.md) — commitMode 정책. doc/architecture/*.md 단일 파일 inline-amend 는 direct.
- [CLAUDE.md §12](../../CLAUDE.md) — 언어 정책. table content 한국어 유지 / METHOD/path/auth tier enum 영어 유지.

## Acceptance Criteria

분기 없음 — 본 task 는 doc-only inline-amend, R-112 의 happy/error/branch/negative test 항목 적용 불가. 검증은 grep / 파일 inspect 로.

### A. §2 Protocol/host 표의 "Auth credential" row 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L23 의 Auth credential row description 갱신: "session cookie 또는 Bearer JWT 중 P3 AuthModule 도입 task 의 ADR 에서 택일 — 본 문서는 둘 다 허용 conceptual 박제" → **"JWT in HttpOnly Secure SameSite=Strict cookie ([ADR-0008](../decisions/ADR-0008-auth-credential-type.md) ACCEPTED, T-0079 박제 + T-0081/T-0082 실 구현). access token 15min + refresh token 7day rotation. T-0083 RBAC scaffold 박제 (JwtStrategy cookie extractor + JwtAuthGuard + @Roles + RolesGuard)."**
- [ ] source 컬럼 갱신: `ADR-0008` + `modules.md` AuthModule row link 추가.

### B. §3 Auth tier 표 amend

- [ ] §3 의 4 tier 표 (Public / User / Admin / SuperAdmin) 본문은 보존 (REQ-046 / REQ-045 / REQ-044 박제 정확).
- [ ] §3 의 **escalation 의미 paragraph** (L37, "tier 의 escalation 의미: SuperAdmin ⊇ Admin ⊇ User ⊇ Public...") 갱신: T-0083 의 RolesGuard ROLE_HIERARCHY 박제를 cross-reference. 추가 1 문장: **"실 적용: [`src/auth/roles.guard.ts`](../../src/auth/roles.guard.ts) 의 `ROLE_HIERARCHY` 가 `SuperAdmin: ["SuperAdmin", "Admin", "User"] / Admin: ["Admin", "User"] / User: ["User"]` 매핑 박제 (T-0083), [`@Roles()`](../../src/auth/roles.decorator.ts) decorator 가 endpoint metadata 로 required tier 박제 + [`JwtAuthGuard`](../../src/auth/jwt-auth.guard.ts) 와 결합하여 인증 + role 검증 layer 분리."**

### C. §5 endpoint 표의 /api/auth/* row amend + /api/auth/refresh row 신규 추가

- [ ] L64 `POST /api/auth/login` row description 갱신: "ID / Password 인증, session 또는 JWT 발급" → **"email + password 인증 (`LoginDto` validation), 성공 시 HttpOnly Secure SameSite=Strict Path=/ cookie 에 access (15min) + refresh (7day) token 발급, response body `{ userId }` (T-0082 박제). 실패 시 401 `Invalid credentials` (email 부재 + password 불일치 동일 응답으로 enumeration attack 차단)."**
- [ ] L65 `POST /api/auth/logout` row description 갱신: "현재 session 또는 JWT 무효화" → **"access_token + refresh_token cookie clear 2 종, 204 No Content. cookie 미존재 상태에서도 idempotent (T-0082 박제)."**
- [ ] L66 `GET /api/auth/me` row 는 미구현 marker 보존: **"현재 인증 user 의 등급 + 식별자 조회 (JwtAuthGuard + req.user.sub/role 반환, T-0085 candidate 미구현 — endpoint 자체는 ADR-0008 후속 chain 의 자연 박제점)"**. auth tier User+ 유지.
- [ ] L65 직후 또는 L66 직전 신규 row 추가: **`| POST | `/api/auth/refresh` | UC-04 | refresh_token cookie 검증 (AuthService.verifyToken with refresh secret) → 신규 access + refresh token 발급 (rotation, ADR-0008 §3) + cookie set 2 종, response body `{ userId }`. 실패 시 401 (missing cookie / expired / invalid signature 동일 응답, T-0082 박제). | User+ |`**.
- [ ] § 5 합계 paragraph (L107, "합계: 약 35 endpoint") 갱신 — 1 endpoint 추가로 "약 36 endpoint" 또는 정확한 count refresh.

### D. 검증

- [ ] `grep -n "ADR-0008" docs/architecture/api.md` → §2 Auth credential row + §3 escalation paragraph 2+ hit.
- [ ] `grep -n "HttpOnly" docs/architecture/api.md` → §2 + §5 login row 2+ hit.
- [ ] `grep -n "/api/auth/refresh" docs/architecture/api.md` → §5 row 1 hit (신규).
- [ ] `grep -n "ROLE_HIERARCHY" docs/architecture/api.md` → §3 paragraph 1 hit.
- [ ] 변경 LOC ≤ 80 (envelope 51 LOC estimate, doc-only inline-amend × 0.64).

## Out of Scope

- **api.md §5 의 PATCH `/api/users/:id/role` row amend (UserService.changeRole + RolesGuard 적용 박제)** — T-0085 candidate (UserService.changeRole + REQ-044 self-demote invariant + endpoint + spec) 의 책임. 본 task 의 amend 대상이 아님 — 그 task 머지 후 별도 doc-amend follow-up 으로 separate.
- **/api/auth/me endpoint 의 실 구현 박제** — T-0086 candidate (JwtAuthGuard 적용 첫 endpoint + req.user.sub/role 반환 + spec). 본 task 는 row description 의 marker 만 갱신.
- **ADR-0008 의 amend (Decision §6 라이브러리 표의 cookie-parser row "install 시점 = T-0082" 박제 + Consequences §6 의 RBAC backbone 실현 시점 = T-0083 박제)** — 별도 doc-only direct task. ADR amend 는 본 task scope 외.
- **modules.md 의 AuthModule row 책임 박제 갱신** — T-0083 머지로 RBAC scaffold 완성, modules.md L32 의 책임 description 도 amend candidate 이나 본 task scope 외.
- **새 endpoint 의 실 controller 구현** — 본 task 는 doc 만, src/ 변경 0.
- **api.md §6 status code policy 갱신** — auth endpoint 의 401 / 400 / 204 는 이미 policy table 에 cover, 추가 amend 불요.

## Suggested Sub-agents

`implementer` (doc-only direct, sub-agent 1 회 — tester / architect / reviewer / integrator 모두 0).

## Follow-ups

- **T-0085 candidate** — UserService.changeRole + REQ-044 self-demote invariant (본인 SuperAdmin→Admin / Admin→User 차단) + PATCH /api/users/:id/role endpoint + spec R-112 4 카테고리 + negative cases 충분 cover. RBAC scaffold (T-0083) 의 첫 production 사용 사례 — `@Roles("SuperAdmin")` 적용 endpoint 박제.
- **T-0086 candidate** — GET /api/auth/me endpoint (JwtAuthGuard 적용 첫 endpoint precedent + req.user.sub/role 반환 + spec). T-0083 의 JwtAuthGuard 의 첫 production 적용점.
- **T-0087 candidate** — ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET, AuthService 의 `?? ""` fallback 제거, JwtStrategy 의 secretOrKey fallback 제거, boot 단계 reject 박제).
- **ADR-0008 amend follow-up** — Decision §6 라이브러리 표의 `cookie-parser` row + `passport-jwt` row 의 "install 시점 = T-0081 (실)" + Consequences §6 의 RBAC backbone 실현 시점 = T-0083 박제.
- **modules.md AuthModule row 책임 description amend** — T-0083 머지로 RBAC scaffold 완성 박제, modules.md L32 의 책임 description 도 RBAC + escalation 박제 cross-reference candidate.
- **endpoint 별 @Roles() 박제 task chain** — PersonController / GroupController / PartController 의 mutation endpoint 에 @Roles("Admin") 박제 + e2e 의 인증 cookie 추가 (별도 task 들, 각 ~50-80 LOC).
- **api.md §5 의 합계 endpoint count refresh** — 본 task 로 1 endpoint 추가 박제 후 35 → 36. 향후 endpoint 신설 시 본 표가 source — endpoint 신설은 본 표 갱신 PR 의 reviewer 점검 대상.
- **estimate-model.md 16 회차 milestone refinement** — 본 task 의 doc-only inline-amend × 0.64 sub-multiplier 4 회차 누적 (T-0070 + T-0073 + T-0076 + 본 T-0084) variance 박제.
