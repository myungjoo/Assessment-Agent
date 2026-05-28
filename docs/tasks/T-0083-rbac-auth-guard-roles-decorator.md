---
id: T-0083
title: JwtAuthGuard + JwtStrategy (cookie extractor) + @Roles() decorator + RolesGuard scaffold — ADR-0008 후속 chain 4/4
phase: P3
status: DONE
mergedAs: 6223fdd
prNumber: 77
reviewRounds: 1
completedAt: 2026-05-28T23:15:00+09:00
actualDiff: 1062
actualFiles: 14
estimateOutcome: "+77% over (envelope 600 sizeExempt vs actual 1062, R-112 backbone × 1.5 multiplier + 4 신규 surface 정당화 — exemptReason 박제 적중)"
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 600
estimatedFiles: 8
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 multiplier (Guard + Strategy + decorator + RolesGuard 4 신규 surface 가 동시 도입, 각각 happy/error/branch/negative + negative cases 충분 cover 필수). base intuition 400 LOC (JwtStrategy ~55 + JwtAuthGuard ~35 + @Roles decorator ~20 + RolesGuard ~80 + AuthModule 갱신 ~15 + AuthController login response role claim 박제 ~20 + spec 4 종 colocated ~280 + AuthModule.spec 갱신 ~15) × 1.5 = 600 LOC envelope. T-0055/T-0057/T-0067/T-0082 controller backbone precedent 정합. split 검토: (a) JwtStrategy+JwtAuthGuard 1 task / (b) @Roles+RolesGuard 1 task 의 2 분할 가능하나 두 layer 가 의미적 1 단위 (Guard 등록 + role check 가 한 endpoint 보호 path) — 자연 1-task chain. REQ-044 self-demote invariant 는 별도 T-0084 candidate 로 분리 (UserService.changeRole + 본인 차단 분기 + 후속 endpoint 박제) — 본 task scope 의 cap 추가 초과 방지."
dependsOn: [T-0079, T-0080, T-0081, T-0082]
created: 2026-05-28
plannerNote: "session #25 첫 planner dispatch — ADR-0008 후속 chain 4/4 마지막 task, entity backbone 10/11 → 11/11 도달, P4 entry path 완성. cap-bend pre-justified: R-112 backbone × 1.5 = 600 LOC, T-0055/T-0067/T-0082 precedent."
---

# T-0083 — JwtAuthGuard + JwtStrategy + @Roles() decorator + RolesGuard scaffold (ADR-0008 후속 chain 4/4)

## Why

[ADR-0008](../decisions/ADR-0008-auth-credential-type.md) Decision §1~§5 박제의 마지막 layer — JWT verify path 의 NestJS 표준 stack (passport-jwt `JwtStrategy` + `JwtAuthGuard`) 박제 + RBAC `@Roles()` decorator + `RolesGuard` 박제. [T-0082](T-0082-auth-controller-login-logout-refresh.md) 머지 (5314c27) 로 AuthController login/logout/refresh + cookie middleware + 3 endpoint 박제 완성 → 다음 layer = **endpoint 보호 path 박제** (JWT verify guard + role 검증).

본 task 가 **ADR-0008 후속 chain 의 4/4 단계 마지막 task** — T-0079 (ADR) → T-0080 (User entity) → T-0081 (AuthModule scaffold + 6 종 dep install) → T-0082 (login/logout/refresh endpoint) → **T-0083 (JwtAuthGuard + RolesGuard scaffold) 본 task** chain 의 자연 progression. 본 task 머지로 **entity backbone 10/11 → 11/11 (100%) 도달** + **P4 entry path 완성** ([p3-to-p4-transition.md §4.1](../architecture/p3-to-p4-transition.md) 옵션 (c) hybrid-parallel 의 backbone 완결 trigger).

## Required Reading

- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT hybrid 결정 박제 (Decision §1 token format / §2 cookie attributes / §3 TTL / §4 HS256 / §5 secret 환경변수 + Consequences 의 RBAC backbone 박제).
- [docs/tasks/T-0082-auth-controller-login-logout-refresh.md](T-0082-auth-controller-login-logout-refresh.md) — 직전 layer (AuthController 3 endpoint + cookie middleware + COOKIE_OPTIONS 박제).
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — `ACCESS_TOKEN_COOKIE` / `REFRESH_TOKEN_COOKIE` / `COOKIE_OPTIONS` const + JwtPayload contract. 본 task 의 JwtStrategy cookie extractor 가 동일 cookie name 재사용.
- [src/auth/auth.service.ts](../../src/auth/auth.service.ts) — `JwtPayload` interface (sub claim) + `verifyToken` 메서드 + `REFRESH_SECRET_ENV` / `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` const. 본 task 의 JwtStrategy 가 동일 access secret 사용 (AUTH_JWT_SECRET).
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — `PassportModule` 이미 import 박제 (T-0081). 본 task 에서 JwtStrategy 를 providers 에 등록 + `defaultStrategy` 명시.
- [src/user/user.repository.ts](../../src/user/user.repository.ts) — `findByEmail` + User type (id / email / hashedPassword / **role** 컬럼). RolesGuard 의 role 검증이 token payload 의 role claim 위에서 작동 — 본 task 에서 JWT payload 에 role claim 추가.
- [prisma/schema.prisma](../../prisma/schema.prisma) L150-170 — User model 의 role 컬럼 (String literal "SuperAdmin"/"Admin"/"User"). RolesGuard 의 검증 target.
- [src/person/person.controller.ts](../../src/person/person.controller.ts) — controller backbone precedent (T-0055/T-0067 R-112 4 카테고리). 본 task 는 controller 신규 endpoint 박제 0 — Guard / decorator / Strategy 신설만.
- [src/group/group.controller.spec.ts](../../src/group/group.controller.spec.ts) — controller spec precedent (R-112 4 카테고리 + negative cases 충분 cover + mock service injection).
- [docs/architecture/api.md §3](../architecture/api.md) — Auth tier 정의 (Public / User / Admin / SuperAdmin + escalation 의미). 본 task 의 `@Roles()` decorator 가 tier 토큰을 endpoint metadata 로 박제.
- [docs/architecture/modules.md L32](../architecture/modules.md) — AuthModule row 책임 박제 (JWT 발급·검증).
- [CLAUDE.md §3.2 R-112](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80%.

## Acceptance Criteria

### A. JwtPayload 확장 (role claim 추가)

- [ ] `src/auth/auth.service.ts` 의 `JwtPayload` interface 에 `role: string` 필드 추가 (SuperAdmin / Admin / User 의 string literal). `sub` 와 동일 required.
- [ ] `AuthService.issueAccessToken(userId: string, role: string): string` signature 확장 — 기존 호출자 (AuthController) 도 role 전달.
- [ ] `AuthService.issueRefreshToken(userId: string, role: string): string` 도 동일 확장 (refresh rotation 시점에 role 변경 가능성 cover, 단 본 task 의 rotation 은 cookie 단순 재발급 — DB lookup 없음).
- [ ] `src/auth/auth.controller.ts` 의 login + refresh 경로가 user.role 을 issueAccessToken/issueRefreshToken 의 두 번째 인자로 전달. refresh 경로는 payload.role 을 새 token 의 role 로 재발급 (rotation 시 role 보존).
- [ ] `src/auth/auth.service.spec.ts` 의 기존 test 갱신 — issueAccessToken/issueRefreshToken 의 새 signature 정합 + payload 에 role 박제 검증 happy/negative 추가.

### B. JwtStrategy (passport-jwt cookie extractor)

- [ ] `src/auth/jwt.strategy.ts` 신설. `@Injectable()` + `extends PassportStrategy(Strategy, "jwt")`. `super({ jwtFromRequest, secretOrKey, ignoreExpiration: false })` 박제 — `jwtFromRequest` 가 cookie 의 `access_token` 추출 (AuthController 의 `ACCESS_TOKEN_COOKIE` const 재사용).
- [ ] `jwtFromRequest` extractor 함수: `(req: Request) => req.cookies?.[ACCESS_TOKEN_COOKIE] ?? null` — cookie-parser middleware 가 채운 `req.cookies` 에서 read. null 시 passport-jwt 가 401 자동 변환.
- [ ] `secretOrKey: process.env.AUTH_JWT_SECRET ?? ""` — AuthService.issueAccessToken 의 module default secret 정합. env 미설정 시 빈 secret fallback (boot 단계 검증은 후속 T-0085 candidate).
- [ ] `validate(payload: JwtPayload): JwtPayload` — payload 의 sub + role 검증 + 반환. payload.sub 또는 payload.role 부재 시 `throw new UnauthorizedException("Invalid token payload")`. 반환된 payload 가 `req.user` 에 박제 (NestJS passport 표준).
- [ ] `src/auth/jwt.strategy.spec.ts` colocated spec — R-112 4 카테고리 + negative cases 충분 cover (cookie 부재 / 빈 cookie / payload sub 부재 / payload role 부재 / 정상 payload happy / strategy name "jwt" 박제 검증).

### C. JwtAuthGuard

- [ ] `src/auth/jwt-auth.guard.ts` 신설. `@Injectable()` + `extends AuthGuard("jwt")`. NestJS 표준 패턴 — 명시적 method override 0, passport-jwt 의 strategy 호출 위임.
- [ ] `src/auth/jwt-auth.guard.spec.ts` colocated spec — R-112 4 카테고리 + negative cases 충분 cover (guard instantiation + canActivate happy/error path mock + AuthGuard("jwt") 정합 검증). Note: AuthGuard 의 실 verify path 는 JwtStrategy 의 spec 이 cover — 본 spec 은 guard wiring 만 검증.

### D. @Roles() decorator + RolesGuard

- [ ] `src/auth/roles.decorator.ts` 신설. `export const ROLES_METADATA_KEY = "roles"` const + `export const Roles = (...roles: string[]) => SetMetadata(ROLES_METADATA_KEY, roles)`. 사용 예: `@Roles("Admin", "SuperAdmin")` — 해당 endpoint 가 Admin 이상 권한 필요.
- [ ] `src/auth/roles.guard.ts` 신설. `@Injectable()` + `implements CanActivate`. constructor 에 `Reflector` inject. `canActivate(context)`:
  1. `Reflector.getAllAndOverride<string[]>(ROLES_METADATA_KEY, [context.getHandler(), context.getClass()])` 로 required role 목록 read.
  2. required 가 undefined 또는 빈 배열 → `true` (decorator 미적용 endpoint = public). JwtAuthGuard 가 별도 적용된 endpoint 일 시 인증 자체는 JwtAuthGuard 가 cover, RolesGuard 는 role 검사만.
  3. `request.user` (JwtStrategy 의 validate 반환값) 읽기 → undefined 시 `throw new UnauthorizedException("Authentication required")` (JwtAuthGuard 미적용 endpoint 에서 RolesGuard 만 단독 적용 시의 fallback).
  4. `request.user.role` 이 required 목록에 포함 → `true`. 미포함 → `throw new ForbiddenException("Insufficient role")` (REQ-045/REQ-046 의 권한 부족 path).
- [ ] **escalation 적용**: SuperAdmin ⊇ Admin ⊇ User ⊇ Public (api.md §3 정합). `@Roles("Admin")` 박제 endpoint 는 Admin 또는 SuperAdmin role 모두 허용. RolesGuard 내부에 escalation 매핑 박제 — `const ROLE_HIERARCHY: Record<string, string[]> = { SuperAdmin: ["SuperAdmin", "Admin", "User"], Admin: ["Admin", "User"], User: ["User"] }` — required role 의 escalation 목록과 user.role 매칭.
- [ ] `src/auth/roles.decorator.spec.ts` colocated spec — R-112 4 카테고리 + negative cases 충분 cover (decorator return type 검증 + metadata key 박제 + 빈 인자 / 단일 role / 다중 role 분기).
- [ ] `src/auth/roles.guard.spec.ts` colocated spec — R-112 4 카테고리 + negative cases 충분 cover:
  - happy — `@Roles("Admin")` 박제 + user.role="Admin" → `true`.
  - escalation — `@Roles("User")` + user.role="SuperAdmin" → `true` / user.role="Admin" → `true`.
  - negative — `@Roles("Admin")` + user.role="User" → `ForbiddenException` / decorator 미적용 endpoint → `true` (Reflector 가 undefined 반환) / request.user 부재 → `UnauthorizedException` / required role 이 빈 배열 → `true` / user.role 이 ROLE_HIERARCHY 에 없는 unknown 값 → `ForbiddenException`.
  - 분기 cover — required 부재 vs 존재 / user 부재 vs 존재 / role 일치 vs 불일치 vs escalation 일치 분기 각 1+ test.

### E. AuthModule 등록

- [ ] `src/auth/auth.module.ts` 갱신 — `providers: [AuthService, JwtStrategy, RolesGuard]` 추가. `exports: [AuthService, JwtAuthGuard, RolesGuard]` 갱신 (다른 module 의 controller 가 본 guard 를 `@UseGuards()` 로 적용 위해 export).
- [ ] `PassportModule.register({ defaultStrategy: "jwt" })` 로 defaultStrategy 명시 (T-0081 시점 미명시).
- [ ] `src/auth/auth.module.spec.ts` 갱신 — JwtStrategy + RolesGuard provider 등록 검증 + PassportModule defaultStrategy 검증 + JwtAuthGuard/RolesGuard export 검증.

### F. CI / 4-게이트

- [ ] `pnpm lint` + `pnpm build` + `pnpm test:cov` (line ≥ 80% / function ≥ 80%) + `pnpm test:smoke` + `pnpm test:e2e` 모두 green.
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **REQ-044 self-demote invariant (`UserService.changeRole` + 본인 Admin→User 차단 분기 + PATCH /api/users/:id/role endpoint)** — 별도 follow-up task **T-0084 candidate**. 본 task 는 RolesGuard + @Roles() decorator backbone 만 박제, 실 endpoint 적용 (PersonController / GroupController / PartController / UserController 의 mutation endpoint 에 @Roles("Admin") 박제) 는 별도 task chain. **이유**: 본 task 의 cap-bend pre-justified envelope 600 LOC 가 R-112 backbone × 1.5 의 자연 상한 — 4 surface 동시 박제 + 4 colocated spec 의 R-112 4 카테고리 + negative cases 충분 cover 가 600 LOC 전후. self-demote invariant 까지 같이 박제 시 800-1000 LOC 추가 위협 (UserService.changeRole + spec + PATCH /api/users/:id/role endpoint + e2e). split 의 자연 boundary.
- **endpoint 별 @Roles() 박제 (PersonController / GroupController / PartController 의 mutation endpoint 보호)** — T-0084 또는 T-0085 candidate. 본 task 는 guard / decorator scaffold 만 박제.
- **PATCH /api/users/:id/role endpoint + UserController 신설** — T-0084 candidate (REQ-044 self-demote invariant 와 동일 task chain).
- **GET /api/auth/me endpoint** — T-0085 candidate. JwtAuthGuard 적용 첫 endpoint precedent — 본 task 머지 후 다음 task 의 자연 진입점.
- **POST /api/users (signup) endpoint** — SuperAdmin 권한 scope, T-0086 또는 후속 task.
- **ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET) + secretOrKey fallback 제거** — 별도 T-0087 candidate. 본 task 의 JwtStrategy 는 `?? ""` fallback 유지.
- **RefreshToken DB table + token rotation revocation path** — ADR-0008 양의 Consequences §6 의 박제만, 실 DB layer 박제는 T-0088 candidate.
- **JwtAuthGuard + RolesGuard 의 e2e/smoke test** — 본 task 는 unit (colocated spec) 만 박제, e2e/smoke 는 별도 follow-up (T-0089 candidate, auth-guard.e2e-spec.ts + 실 cookie round-trip + 401/403 검증).
- **api.md §3 의 /api/auth/login + /logout + /refresh 3 row 박제 doc-only direct task** — T-0082 reviewer MINOR follow-up (T-0086 candidate, 본 task 와 독립).

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0, ADR-0008 박제 정공법 정합 — 신규 결정 0, Guard / Strategy / decorator 박제만).

## Follow-ups

- **T-0084 candidate** — REQ-044 self-demote invariant (UserService.changeRole + 본인 Admin→User 차단 + PATCH /api/users/:id/role endpoint + colocated spec R-112 4 카테고리 + negative cases 충분 cover).
- **T-0085 candidate** — GET /api/auth/me endpoint (JwtAuthGuard 적용 첫 endpoint precedent + req.user 의 sub/role 반환 + spec).
- **T-0086 candidate** — api.md §3 doc-only direct (T-0082 reviewer MINOR follow-up — /api/auth/login + /logout + /refresh + me + RBAC 적용 endpoint 3+ row 박제 + REQ-043~046 mapping + ADR-0008 link).
- **T-0087 candidate** — ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET, AuthService 의 `?? ""` fallback 제거, JwtStrategy 의 secretOrKey fallback 제거, boot 단계 reject 박제).
- **T-0088 candidate** — RefreshToken DB table 박제 + AuthService.revokeRefreshToken + token rotation 의 DB revocation path (ADR-0008 Consequences §6 박제).
- **T-0089 candidate** — auth-guard.e2e-spec.ts + auth-guard.smoke-spec.ts (실 cookie round-trip + 401/403 검증 + RolesGuard escalation 검증 + JwtStrategy cookie extractor end-to-end).
- **endpoint 별 @Roles() 박제 task chain** — PersonController / GroupController / PartController 의 mutation endpoint 에 @Roles("Admin") 박제 + e2e 의 인증 cookie 추가 (별도 task 들, 각 ~50-80 LOC).
- **ADR-0008 amend follow-up** — Decision §6 라이브러리 표 의 `passport-jwt` row 의 "install 시점 = T-0081 (실)" + Consequences §6 의 RBAC backbone 박제 실현 시점 = T-0083 (본 task) 박제.
- **estimate-model.md 16 회차 milestone refinement** — 본 task 의 envelope 600 vs actual variance 박제 + R-112 backbone × 1.5 의 4-surface 박제 데이터 (T-0079 + T-0080 + T-0081 + T-0082 + 본 T-0083 5 회차 ADR-0008 chain variance 분석).
- **entity backbone 11/11 도달 milestone 박제** — p3-to-p4-transition.md §2.6 갱신 candidate (10/11 → 11/11 + P4 entry path 완성 marker).
