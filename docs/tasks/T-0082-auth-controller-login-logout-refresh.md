---
id: T-0082
title: AuthController login/logout/refresh endpoint + LoginDto + cookie-parser dep install — ADR-0008 후속 chain 2/4
phase: P3
status: BLOCKED
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 450
estimatedFiles: 6
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 + R-112 negative cases 충분 cover (cookie 검증 + 401 invalid credentials + missing refresh + expired refresh + rotation race 등 6+ negative branch) = effective × 1.7. base intuition 270 LOC (AuthController login/logout/refresh ~110 + LoginDto ~25 + main.ts cookie-parser middleware ~5 + auth.controller.spec ~280 + package.json/lockfile noise) → estimated 450 LOC (cap 초과 250%). T-0055/T-0057/T-0067 controller backbone precedent 정합. split 검토 결과: cookie-parser install 과 endpoint 박제는 자연 1-task chain (install 만 분리 시 endpoint 가 의미적으로 nullary — middleware 없이는 cookie set/clear 불가), R-112 spec 도 endpoint 와 colocated 필수 — single-task pre-justified."
estimatedBlocker: new-dep (cookie-parser + @types/cookie-parser 2 종 — ADR-0008 Decision §6 의 deferred list 박제 정합, T-0081 의 6 종 install 명시 list 에서 누락된 2 종, CLAUDE.md §5 trigger 발화 expected)
dependsOn: [T-0079, T-0080, T-0081]
created: 2026-05-28
plannerNote: "session #23 후 첫 planner dispatch — ADR-0008 후속 chain 2/4 (T-0079 ADR / T-0080 User / T-0081 AuthModule scaffold DONE → T-0082 endpoint 본 task → T-0083 RBAC). cap-bend pre-justified: R-112 backbone × 1.5 + negative cases 충분 cover = 450 LOC, T-0055/T-0057 precedent."
---

# T-0082 — AuthController login/logout/refresh endpoint + cookie-parser install

## Why

[ADR-0008](../decisions/ADR-0008-auth-credential-type.md) Decision §1~§3 박제 의 실 endpoint layer — login 시 HttpOnly Secure SameSite=Strict cookie 에 access (15min) + refresh (7day) token 발급, logout 시 cookie clear, refresh endpoint 에서 access token 재발급. [T-0081](T-0081-auth-module-and-dep-install.md) 머지 (ea1cfcd) 로 AuthService 의 5 메서드 (`hashPassword` / `verifyPassword` / `issueAccessToken` / `issueRefreshToken` / `verifyToken`) 박제 완성 → 다음 layer = **AuthController endpoint 박제 + cookie-parser middleware wire**.

본 task 가 ADR-0008 후속 chain 의 **2/4 단계** — T-0079 (ADR 박제) → T-0080 (User entity) → T-0081 (AuthModule + 6 종 dep install) → **T-0082 (endpoint + cookie-parser)** → T-0083 (RBAC AuthGuard + @Role()) chain 의 자연 progression.

**BLOCKED risk new-dep** — ADR-0008 Decision §6 의 라이브러리 채택 표 L96 에 박제된 `cookie-parser` 가 T-0081 의 실 install 6 종 list 에서 누락 (typo/scope 누락) — 본 task 의 cookie set/clear 가 `cookie-parser` middleware 의존 → CLAUDE.md §5 "새 외부 dependency 추가" trigger 발화 expected. executor 진입 시 immediate BLOCKED return 또는 사용자 사전 승인 후 unblock path.

## Required Reading

- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT hybrid 결정 박제 (Decision §1 token format / §2 cookie attributes 박제 의무 / §3 TTL / §6 라이브러리 표 의 cookie-parser deferred).
- [docs/tasks/T-0081-auth-module-and-dep-install.md](T-0081-auth-module-and-dep-install.md) — 직전 layer 박제 (AuthService 5 메서드 + AuthModule scaffold).
- [src/auth/auth.service.ts](../../src/auth/auth.service.ts) — 본 controller 가 consume 할 5 메서드 + `JwtPayload` / `REFRESH_SECRET_ENV` / `BCRYPT_ROUNDS` / `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` const.
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — AuthService export + JwtModule.registerAsync 박제. 본 task 는 AuthModule 에 `controllers: [AuthController]` 추가.
- [src/user/user.repository.ts](../../src/user/user.repository.ts) — `findByEmail` 메서드 (login 의 자연 의존성, password verify 의 source).
- [src/main.ts](../../src/main.ts) — `cookie-parser` middleware wire 대상 (`app.use(cookieParser())` 추가).
- [src/app.module.ts](../../src/app.module.ts) — UserModule + AuthModule import 확인 (AuthController 의 UserRepository inject 의존).
- [src/person/person.controller.ts](../../src/person/person.controller.ts) — controller backbone precedent (T-0055/T-0057/T-0067 의 R-112 4 카테고리 cover + DTO + ValidationPipe 정합).
- [src/group/group.controller.spec.ts](../../src/group/group.controller.spec.ts) — controller spec precedent (R-112 4 카테고리 + negative cases 충분 cover + mock service injection).
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-112 — happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80%.
- [CLAUDE.md](../../CLAUDE.md) §5 — BLOCKED 처리 ("새 외부 dependency 추가").
- [package.json](../../package.json) — 현재 dep 목록 (cookie-parser 부재 확인).

## Acceptance Criteria

### A. Dep install (BLOCKED 게이트 expected — 사용자 결정 후 진행)

- [ ] `pnpm add cookie-parser` (production dep).
- [ ] `pnpm add -D @types/cookie-parser` (dev dep).
- [ ] `package.json` + `pnpm-lock.yaml` commit.

### B. cookie-parser middleware wire

- [ ] `src/main.ts` 의 `bootstrap()` 안에 `app.use(cookieParser())` 추가. `import * as cookieParser from "cookie-parser"` (또는 default import — 라이브러리 typing 정합).
- [ ] main.ts 가 entrypoint 예외 (CLAUDE.md §3.2 R-112 entrypoint 예외 정책) 정합 보존 — 분기 있는 helper 추가 0, middleware wire 만.

### C. LoginDto

- [ ] `src/auth/dto/login.dto.ts` 신설. `class-validator` decorator (`@IsEmail()` + `@IsString()` + `@IsNotEmpty()`) 박제. 필드: `email: string`, `password: string`.
- [ ] `src/auth/dto/login.dto.spec.ts` colocated spec (R-112 4 카테고리 + negative cases 충분 cover — empty email / invalid email format / empty password / missing fields / extra fields rejection).

### D. AuthController login/logout/refresh endpoint

- [ ] `src/auth/auth.controller.ts` 신설. 3 endpoint:
  - `POST /api/auth/login` — body `LoginDto` → UserRepository.findByEmail → AuthService.verifyPassword → success 시 access + refresh token 발급 → cookie set (HttpOnly + Secure + SameSite=Strict + Path=/, access cookie name `access_token`, refresh cookie name `refresh_token`) → 200 응답 (body `{ userId: string }`). 실패 시 401 (`Invalid credentials` — email 부재 + password 불일치 동일 응답으로 enumeration attack 차단).
  - `POST /api/auth/logout` — cookie clear (`access_token` + `refresh_token` 둘 다 `clearCookie`) → 204 응답 (No Content).
  - `POST /api/auth/refresh` — cookie 의 `refresh_token` 읽기 → AuthService.verifyToken (refresh secret override) → success 시 신규 access token 발급 + cookie set (refresh token rotation: 신규 refresh token 도 같이 발급 + cookie set, ADR-0008 Decision §3 rotation 박제) → 200 응답 (body `{ userId: string }`). 실패 시 401 (missing cookie / expired / invalid signature 동일 응답).
- [ ] AuthController 를 AuthModule 의 `controllers: [AuthController]` 에 등록.
- [ ] AuthModule 이 UserRepository inject 위해 UserModule import.

### E. AuthController spec — R-112 4 카테고리 cover backbone

- [ ] `src/auth/auth.controller.spec.ts` colocated spec 신설. **각 endpoint 별 R-112 4 카테고리** + **negative cases 충분 cover** (예외 분기마다 1+):
  - **login happy** — 정상 email + password → 200 + cookie set 검증 (HttpOnly/Secure/SameSite/Path attribute 4 검증) + body `{ userId }`.
  - **login error/negative** — email 부재 (UserRepository.findByEmail null 반환) → 401 + cookie set 안 됨 / password 불일치 (AuthService.verifyPassword false) → 401 / DTO validation fail (empty email / invalid email format / empty password) → 400 / UserRepository throw → 500 propagate.
  - **logout happy** — cookie clear 2 종 (access + refresh) 호출 검증 + 204 응답.
  - **logout negative** — cookie 미존재 상태에서도 clearCookie 정상 (idempotent) → 204.
  - **refresh happy** — 유효 refresh cookie → AuthService.verifyToken 호출 (refresh secret override 검증) → 신규 access + refresh token 발급 + cookie set 2 종 + 200 + body `{ userId }`.
  - **refresh error/negative** — refresh cookie 부재 → 401 / refresh token expired (TokenExpiredError throw) → 401 / refresh token 의 signature invalid (JsonWebTokenError throw) → 401 / refresh secret env 미설정 fallback path → 401.
  - **분기 cover** — login 의 user 존재 vs 부재 분기 / password 일치 vs 불일치 분기 / refresh 의 token valid vs invalid 3 종 분기 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). auth.controller.ts 의 colocated coverage 100% line/function 목표 (controller 분기 단순).

### F. CI / 4-게이트

- [ ] `pnpm lint` + `pnpm build` + `pnpm test:cov` + `pnpm test:smoke` + `pnpm test:e2e` 모두 green.
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET)** — 별도 follow-up task (T-0084 candidate). 본 task 는 AuthService 의 `?? ""` fallback 유지, env 검증 layer 박제 안 함.
- **JwtStrategy + JwtAuthGuard (passport-jwt cookie extractor)** — T-0083 RBAC chain 의 책임. 본 task 의 refresh endpoint 는 JwtService.verify 직접 호출 (controller layer manual verify) — guard / strategy 도입은 RBAC layer 와 함께 박제.
- **RBAC @Role() decorator + RolesGuard + REQ-044 self-demote invariant** — T-0083 후속 task.
- **Refresh token rotation DB persistence (RefreshToken table)** — ADR-0008 Decision §3 의 박제만, 실 DB layer 박제는 후속 task. 본 task 의 rotation 은 cookie 단순 재발급만 (DB revocation 없음, ADR-0008 양의 Consequences §6 의 "revocation path 박제" 는 후속 layer).
- **GET /api/me endpoint** — ADR-0008 후속 chain 의 별도 follow-up (T-0083 또는 T-0084 candidate).
- **AuthController e2e/smoke test 신설** — 본 task 는 unit (colocated spec) 만 박제, e2e/smoke 는 별도 follow-up task (T-0085 candidate, auth.e2e-spec.ts + smoke 동반).
- **`AddUserDto` / SignupController** — User 추가는 SuperAdmin RBAC scope (T-0083 후속).

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0, ADR-0008 박제 정공법 정합 — 신규 결정 0, dep install + endpoint 박제만).

## Follow-ups

- **T-0083** — RBAC AuthGuard + @Role() decorator + RolesGuard + REQ-044 self-demote invariant + JwtStrategy (passport-jwt cookie extractor 적용) + GET /api/me endpoint.
- **T-0084 candidate** — ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET) + AuthService 의 `?? ""` fallback 제거 + AuthModule.useFactory 의 env 미설정 시 boot 단계 reject 박제.
- **T-0085 candidate** — auth.e2e-spec.ts + auth.smoke-spec.ts 신설 (real PostgreSQL + cookie round-trip 검증 + 401 negative + refresh rotation 검증).
- **T-0086 candidate** — RefreshToken DB table 박제 + token rotation 의 DB revocation path (ADR-0008 Decision §3 rotation 의 race mitigation invariant + revocation 양의 Consequences §6 박제).
- **ADR-0008 amend follow-up** — Decision §6 라이브러리 표 의 `cookie-parser` row 의 "install 시점 = T-0082" 박제 (실 install 시점 박제로 ADR 정합 강화).
- **estimate-model.md 16 회차 milestone** — 본 task 의 envelope 450 vs actual variance 박제 + R-112 backbone × 1.5 + negative-cover sub-multiplier 박제 candidate (T-0081 +350% over learning + 본 task 데이터로 sub-multiplier 정량화).
- **CLAUDE.md §3.2 R-112 "negative cases 충분 cover" sub-multiplier 박제** — T-0081 의 lockfile 자연 inflation + R-112 negative cover 자연 확장 박제가 estimate-model.md §4 의 추가 sub-multiplier 후보로 누적.

## Expected Blocker (사전 박제)

- **trigger**: 본 task 의 cookie-parser + @types/cookie-parser 2 종 신규 dep install 발화 → CLAUDE.md §5 "새 외부 dependency 추가" BLOCKED 게이트 발화 expected.
- **expected resolution**: 사용자가 ADR-0008 Decision §6 의 cookie-parser 박제 정합 사전 인지 → 4 옵션 (A=2 종 install 승인 ADR-0008 정공법 / B=cookie-parser 만 install + @types 보류 / C=cookie-parser pivot — 직접 cookie set/clear via `res.cookie()` 표준 express API + cookie-parser 회피 / D=후속 chain delay, 다른 P3 task 우선) 중 결정. 권장 A (정공법, ADR-0008 박제 정합 + npm canonical + NestJS 표준).
- **unblock path**: HQ resolved → blockers[] pop → status BLOCKED → IN_PROGRESS → executor pr-mode full chain → implementer (pnpm add 2 종 + src/auth/dto/login.dto.ts + auth.controller.ts + main.ts middleware wire + auth.module.ts controllers 추가) → tester (R-112 4 카테고리 + negative 충분 + coverage ≥ 80%) → integrator (feature branch claude/T-0082-auth-controller-login-logout-refresh + PR + reviewer + 4-게이트 + merge).

## Blocker (HQ-0012)

본 task 의 cookie set/clear (login/logout/refresh) + req.cookies 파싱 (refresh endpoint) 이 `cookie-parser` middleware 의존 → CLAUDE.md §5 "새 외부 dependency 추가" 게이트 발화로 graceful BLOCKED. ADR-0008 Decision §6 라이브러리 채택 표 L96 에 박제된 `cookie-parser` 가 [T-0081](T-0081-auth-module-and-dep-install.md) (MERGED ea1cfcd) 의 실 install 6 종 list 에서 누락 — 본 회차에서 2 종 (production `cookie-parser` + dev `@types/cookie-parser`) 추가 install 사용자 결정 필요.

executor 코드 변경 0 LOC / branch 미신설 / commit·push 미수행 — graceful return only. [STATE.json](../STATE.json) humanQuestions[HQ-0012] 에 4 옵션 박제:

- **A (권장, ADR-0008 정공법)** — `pnpm add cookie-parser` (production) + `pnpm add -D @types/cookie-parser` (dev) 2 종 install. ADR-0008 Decision §6 박제 정합 + NestJS / express 표준 cookie middleware.
- **B (축소 install)** — `cookie-parser` 만 install, `@types/cookie-parser` 보류 (typing any 허용). TypeScript strict 환경에서 implicit any warning + R-112 spec type-safety 약화, 후속 task 에서 @types 보강 chain.
- **C (cookie-parser pivot)** — 직접 `res.cookie()` / `req.cookies` 표준 express API 활용으로 cookie-parser 회피. express 4.x 가 cookie set/clear 는 native 지원하나 req.cookies 파싱은 middleware 부재 시 수동 parsing 필요 — ADR-0008 §6 amend (cookie-parser deferred → 영구 미도입 박제 갱신) 의무.
- **D (chain delay)** — T-0082 PENDING 보류, T-0083 (RBAC AuthGuard) 또는 다른 P3 task 우선. ADR-0008 후속 chain 2/4 단계 지연, entity backbone 10/11 유지. 추후 dep 정책 정착 후 T-0082 재진입.

사용자 결정 후 unblock path: HQ-0012 resolved → blockers[B-0002] pop → status BLOCKED → IN_PROGRESS → executor pr-mode full chain (선택 옵션에 따라 dep install + main.ts middleware wire 또는 pivot 박제).
