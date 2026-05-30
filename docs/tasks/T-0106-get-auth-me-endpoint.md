---
id: T-0106
title: GET /api/auth/me endpoint (User+ tier, req.user.sub 기반 self-detail)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-046]
estimatedDiff: 220
estimatedFiles: 5
created: 2026-05-30
plannerNote: P3 — api.md L69 박제 T-0085 candidate 미구현 GET /api/auth/me 박제. ADR-0008 후속 chain 자연 박제점, JwtAuthGuard + UserService.findById + UserResponseDto.fromEntity 재활용 partial-backbone ×1.3.
---

# T-0106 — GET /api/auth/me endpoint (User+ tier, req.user.sub 기반 self-detail)

## Why

[docs/architecture/api.md](../architecture/api.md) L69 가 박제: `GET /api/auth/me` 가 "T-0085 candidate 미구현 — endpoint 자체는 ADR-0008 후속 chain 의 자연 박제점" 으로 명시되어 있다 — 본 task 가 그 박제점이다. 현재 [`src/auth/auth.controller.ts`](../../src/auth/auth.controller.ts) 는 login / logout / refresh 3 endpoint 만 wire 되어 있고 GET /api/auth/me 는 미구현 — User CRUD-R 표면 4/4 closure (T-0099 GET list + T-0101 GET detail) 박제 후 ADR-0008 §6 application-layer last-mile chain 의 마지막 미박제 endpoint.

본 task 가 박제하는 책임:

1. **AuthController.me 메서드** — `@Get("me")` + `@UseGuards(JwtAuthGuard)` + `req.user.sub` 추출 → `userService.findById(sub)` 호출 → `UserResponseDto.fromEntity(user)` 변환 → 200 응답. T-0101 controller detail 패턴 1:1 mirror BUT path param 없음 (self-detail 박제).
2. **AuthController.me spec (colocated)** — happy / error / branch / negative 4 카테고리 cover. JwtAuthGuard 통과 검증은 e2e 책임이고 unit spec 은 controller 메서드 자체의 흐름 (req.user.sub 추출 + service 호출 + DTO 변환 + 에러 propagate) 검증.
3. **users.e2e-spec.ts (또는 auth.e2e-spec.ts) GET /api/auth/me regression** — JwtAuthGuard 통과 (cookie 박제 + 정상 token) / 통과 실패 (cookie 부재 401 / invalid token 401) / 응답 body shape (UserResponseDto 5 readonly 필드, hashedPassword 누출 차단) / target user 부재 시 404 (`req.user.sub` 유효 token 이지만 DB row 삭제됨 경우, P2025 → 404 변환) regression assert.
4. **AuthModule wiring 보강** — `UserService` inject (T-0092 박제 후 AuthService 가 forwardRef 로 UserService inject 한 cycle 패턴 1:1 mirror, AuthController 가 UserService 직접 inject. `findById` 호출만 필요 — 새 method 추가 0).

본 task 는 README 110-114 R-110 (test 의무) + R-112 (4 카테고리 cover + negative 충분) + R-113 (e2e regression) + R-114 (CI 검증) 모두 적용 — pr-mode partial-backbone × 1.3 envelope 220 LOC / 5 파일 cap 안.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) §5 L69 — GET /api/auth/me row (auth tier User+ + T-0085 candidate 미구현 박제) + §3 L33 User tier 정의
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) §1~§3 (JWT in cookie + access 15m / refresh 7d) + §6 application-layer chain
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — 기존 3 endpoint 패턴 (UsePipes / controller-scope ValidationPipe / ACCESS_TOKEN_COOKIE / COOKIE_OPTIONS / @HttpCode) + L45 "GET /api/me endpoint — T-0083 또는 T-0084 candidate" 박제 (현 T-0106 으로 박제)
- [src/auth/auth.controller.spec.ts](../../src/auth/auth.controller.spec.ts) — 기존 spec 구조 + mock 패턴 + 응답 body shape regression assert 위치
- [src/auth/jwt-auth.guard.ts](../../src/auth/jwt-auth.guard.ts) + [src/auth/jwt.strategy.ts](../../src/auth/jwt.strategy.ts) — JwtAuthGuard 통과 시 `req.user = { sub, role }` 박제 (T-0083)
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — T-0101 박제 `detail` 메서드 (self OR Admin+ 분기 패턴) — 본 task 는 self 만 (분기 없음)
- [src/user/user.service.ts](../../src/user/user.service.ts) — `findById(id)` 메서드 (T-0101 박제, P2025 → NotFoundException 변환 invariant 재활용)
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — UserResponseDto.fromEntity static factory (T-0095 박제, 5 readonly 필드 + hashedPassword 차단 invariant)
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — AuthModule wiring (UserModule import 또는 forwardRef 패턴 박제 — T-0092 의 AuthService↔UserService circular 해결 패턴 1:1 mirror)
- [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) 또는 [test/e2e/auth.e2e-spec.ts](../../test/e2e/auth.e2e-spec.ts) — 기존 e2e cookie-based auth 패턴 + UserResponseDto 응답 shape regression assert 위치
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp` / `issueAccessTokenFor` / `buildAuthCookie` 재활용 (T-0091 박제)
- [docs/tasks/T-0101-get-user-detail-endpoint-self-or-admin.md](T-0101-get-user-detail-endpoint-self-or-admin.md) — controller detail 패턴 박제 source

## Acceptance Criteria

A. AuthController.me 메서드 박제 — [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts):

- [ ] `@Get("me")` + `@UseGuards(JwtAuthGuard)` decorator 적용. RolesGuard 미적용 (User+ 면 누구나 자기 자신 조회).
- [ ] `me(@Req() req)` 시그니처 — req 의 type 박제 (`req: Request & { user: { sub: string; role: string } }` 또는 별도 interface).
- [ ] 흐름: `const userId = req.user.sub` 추출 → `await this.userService.findById(userId)` 호출 → `UserResponseDto.fromEntity(user)` 변환 → return.
- [ ] `findById` 가 `NotFoundException` throw 시 controller 가 그대로 propagate (P2025 변환 invariant — T-0101 패턴).
- [ ] `req.user` 가 undefined / `req.user.sub` 가 빈 문자열 / `req.user.sub` 가 undefined 인 경우 graceful 처리 (UnauthorizedException 또는 BadRequestException — 분기 선택은 architect 또는 implementer 가 결정. JwtAuthGuard 가 정상 작동 시 req.user 는 항상 set 되므로 일반 분기에서는 발생 0 — defence in depth).
- [ ] 한국어 주석으로 흐름 + ADR-0008 §6 cross-ref + T-0101 detail 패턴 mirror + UserResponseDto 재활용 invariant 박제.

B. AuthController.me spec 박제 (colocated) — [src/auth/auth.controller.spec.ts](../../src/auth/auth.controller.spec.ts):

- [ ] **happy path 1+**: `req.user.sub` 가 valid id + `userService.findById` 가 User entity 반환 → UserResponseDto shape 응답 (5 필드 박제, hashedPassword 부재 검증).
- [ ] **error path 1+**: `userService.findById` 가 NotFoundException throw → controller 가 propagate (404 변환).
- [ ] **branch 분리**: branch 없음 — single happy + error + negative 분기만 (선택적으로 service throw 다른 종류 — 분기 없음 항목 생략 가능).
- [ ] **negative cases 충분 cover**:
  - `req.user` undefined → graceful 처리 (UnauthorizedException 또는 BadRequestException — 위 A 와 동일 선택).
  - `req.user.sub` 빈 문자열 → graceful.
  - `req.user.sub` undefined → graceful.
  - `userService.findById` raw Error throw (P2025 외 unexpected) → controller 가 propagate (500 변환).
  - 응답 body 에 `hashedPassword` 누출 차단 — `UserResponseDto.fromEntity` 변환 후 응답 verify.
- [ ] colocated 위치 박제 ([src/auth/auth.controller.spec.ts](../../src/auth/auth.controller.spec.ts) 갱신 — 신규 describe block "me" 추가).
- [ ] me 신규 it ≥ 6.

C. AuthModule wiring 보강 — [src/auth/auth.module.ts](../../src/auth/auth.module.ts):

- [ ] AuthController 가 UserService inject 가능하도록 UserModule import 또는 forwardRef 추가 (T-0092 의 AuthService↔UserService circular 해결 패턴 1:1 mirror — 이미 forwardRef 박제됐으면 추가 변경 0).
- [ ] AuthModule spec 갱신 (controller / providers / module export 검증) — 변경 0 또는 minor.
- [ ] `pnpm build` 통과 — circular dependency 0 (forwardRef 가 박제됐다면 자동 해소).

D. e2e regression 박제 — [test/e2e/auth.e2e-spec.ts](../../test/e2e/auth.e2e-spec.ts) (또는 [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts), 더 적합한 곳에 박제):

- [ ] `GET /api/auth/me` 신규 describe block ≥ 5 it:
  - happy — cookie 박제 + 정상 token → 200 + UserResponseDto body (5 필드 + hashedPassword 부재).
  - 401 — cookie 부재 → 401 (JwtAuthGuard 차단).
  - 401 — invalid signature token → 401.
  - 401 — expired token → 401.
  - 404 — valid token 이지만 DB user row 삭제됨 → 404 (P2025 변환 — `req.user.sub` 가 stale token 으로 valid 하지만 user 존재 0).
  - (선택) — User role / Admin role / SuperAdmin role 모두 200 동일 응답 (User+ tier).
- [ ] `createAuthenticatedE2EApp` helper 재활용 — JWT issue + cookie 박제 패턴 박제. 신규 helper 추출 0.
- [ ] UserResponseDto 응답 shape regression assert: `toMatchObject({ id, email, role, createdAt, updatedAt })` + `not.toHaveProperty("hashedPassword")`.

E. api.md L69 amend (Out of Scope or 별도 후속 task 분리) — 본 task scope 0:

- [ ] api.md L69 의 "T-0085 candidate 미구현" 문구 amend 는 본 task 의 Out of Scope. 후속 doc-only direct task (T-0107 candidate) 가 inline-amend × 0.4 envelope ~15 LOC / 1 파일로 박제. 본 task 에서는 amend 0.

F. CI / 4-게이트 — pr-mode:

- [ ] `pnpm lint && pnpm build && pnpm test:cov && pnpm test:smoke && pnpm test:e2e` 모두 local PASS.
- [ ] coverage line ≥ 80% AND function ≥ 80% 유지 (jest.coverageThreshold) — auth.controller.ts 신규 surface 100% 목표.
- [ ] PR open + reviewer dispatch + reviewer round 1 APPROVE (4-게이트 모두 PASS) + integrator squash merge + CI green.
- [ ] reviewer-gate CI step (case-insensitive approve 어휘 1+ 매칭) 통과.

## Out of Scope

- **api.md L69 amend** — 별도 doc-only direct task (T-0107 candidate, inline-amend × 0.4 envelope ~15 LOC). 본 task 는 production 박제만.
- **UC-04 §5 sequence amend** — GET /api/auth/me 의 sequence step 박제는 별도 doc-only task (UC-04 §5 step 추가 + Note + §8 postconditions).
- **modules.md AuthModule row amend** — AuthController 책임 description 에 me 추가는 별도 doc-only task.
- **POST /api/users RBAC 강화 ADR** — T-0092 박제 Out of Scope, 본 task scope 0.
- **RefreshToken DB table + revocation** — ADR-0008 §6 후속 chain, 별도 task.
- **GET /api/auth/me 의 me audience extension** — README L107 박제 `GET /api/me/permission-denied` 같은 user audience aggregate endpoint 는 별도 UC-08 chain task.
- **DELETE /api/users/:id** — User CRUD-D 박제는 P4 후속 (README "DELETE 는 P4 후속" 박제).
- **JwtAuthGuard 의 testing utility 신규 추출** — `createAuthenticatedE2EApp` (T-0091 박제) 재활용으로 cover, 신규 helper 0.
- **JwtStrategy / RolesGuard 변경** — 본 task 는 기존 guard chain 활용, 변경 0.
- **req.user type 의 global type augmentation** — `Express.Request.user` 의 global declaration 박제 는 별도 chore task (현재는 controller 안 local interface 박제 또는 type assertion).

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect 없음 — 신규 ADR 0, 신규 결정 0, T-0101 detail + T-0095 UserResponseDto + T-0092 forwardRef 패턴 모두 박제 source 재활용).

## Follow-ups

(공백 — sub-agent 가 발견한 follow-up 박제)
