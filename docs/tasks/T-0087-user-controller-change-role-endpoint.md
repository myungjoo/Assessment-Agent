---
id: T-0087
title: UserController + ChangeRoleDto + PATCH /api/users/:id/role + @Roles SuperAdmin + colocated spec + e2e
phase: P3
status: DONE
commitMode: pr
mergedAs: fabeb408a73481a3d5d87948142a2d5099838197
prNumber: 82
completedAt: 2026-05-29T01:32:00+09:00
reviewRounds: 1
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 540
estimatedFiles: 5
dependsOn: [T-0086, T-0083]
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 multiplier (HTTP-facing controller layer 신규 surface 1 + DTO 신규 surface 1 + colocated spec R-112 4 카테고리 + negative cases 충분 cover + e2e RBAC 첫 production 사용 사례 박제, 4 surface 동시 박제). base intuition 360 LOC (ChangeRoleDto 신설 ~25 + UserController 신설 ~70 + UserModule amend ~5 + user.controller.spec.ts colocated ~270 + users.e2e-spec.ts 신설 ~100) × 1.5 multiplier = ~540 LOC envelope. T-0083 (envelope 600 sizeExempt actual 1062, R-112 backbone × 1.5 의 4 surface 동시 박제 precedent) + T-0086 (envelope 260 actual 594 ×2.28 single-layer service R-112 22 it spec mass precedent) 정합. split 검토: (a) DTO+Controller+Module+spec 한 task / (b) e2e 별도 task 의 2 분할 가능하나 controller-e2e 가 동일 production endpoint 의 contract anchor (controller 단일 surface 의 unit + HTTP 라운드트립 의미 1 단위) — 자연 1-task chain. RBAC 첫 production 사용 사례 박제의 e2e cover 가 controller 와 동일 task 안에서 박제되어야 'RBAC backbone 첫 적용' milestone 의 의미적 완결성 보장."
created: 2026-05-29
plannerNote: "loop session #25 turn 9/10 — T-0086 머지 후 RBAC 첫 production 사용 사례 chain 의 HTTP-facing controller layer + RBAC 첫 endpoint production 사용. cap-bend pre-justified: R-112 backbone × 1.5 = ~540 LOC, T-0083/T-0086 precedent."
---

# T-0087 — UserController + ChangeRoleDto + PATCH /api/users/:id/role + @Roles SuperAdmin + colocated spec + e2e

## Why

[T-0086](T-0086-user-service-change-role-self-demote-invariant.md) (MERGED f1d5aa8) 가 UserService.changeRole + REQ-044 5 invariant 박제 → RBAC 첫 production 사용 사례 chain 의 **HTTP-facing controller layer 진입점**. [PLAN.md L61 P3 RBAC bullet](../PLAN.md) — *"Auth/RBAC 모델 (SuperAdmin/Admin/User) — 첫 로그인 SuperAdmin 지정, Admin→User 변경은 SuperAdmin만, 본인 self-demote 금지 (R-84)"* — service layer 가 박제한 invariant 를 HTTP endpoint 위에 노출 + JwtAuthGuard 의 인증 + RolesGuard 의 권한 검증 + ChangeRoleDto 의 payload 검증 의 4 layer 동시 박제.

본 task 가 **RBAC backbone 의 첫 production 적용 사용 사례** — [T-0083](T-0083-rbac-auth-guard-roles-decorator.md) (MERGED 6223fdd) 가 JwtAuthGuard + JwtStrategy + @Roles() decorator + RolesGuard 4 surface scaffold 박제만 — 본 시점까지 production controller 의 어느 endpoint 도 `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles(...)` 박제 0. 본 task 의 PATCH /api/users/:id/role 이 **RBAC 첫 적용 endpoint** + UserService.changeRole 의 actor 인자가 token payload 의 sub 로 정합 박제 + REQ-043/044/045/046 의 HTTP 차원 full closure.

[api.md L71](../architecture/api.md) — *"PATCH /api/users/:id/role — user 등급 변경 (Admin→User 분기는 SuperAdmin 전용, self-demote 차단)"* 박제 — 본 task 가 그 endpoint 의 실 구현. api.md 의 row amend 자체는 별도 doc-only direct task ([T-0088 candidate](#follow-ups)) 책임 — 본 task scope 는 code + spec + e2e 만.

## Required Reading

- [src/user/user.service.ts](../../src/user/user.service.ts) — T-0086 박제. `changeRole(actorUserId, targetUserId, newRole)` signature + 5 invariant + Prisma error 변환 정책. 본 task 의 controller 가 inject + 호출 대상.
- [src/user/user.service.spec.ts](../../src/user/user.service.spec.ts) — T-0086 spec. mock 패턴 reference (controller spec 의 UserService mock 패턴 정공법).
- [src/user/user.module.ts](../../src/user/user.module.ts) — T-0086 박제. UserController 등록 대상 (controllers 배열 추가).
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) — controller backbone precedent (T-0082). `@Controller()` prefix + `@UsePipes(ValidationPipe)` 패턴 + `@HttpCode` + `@Body() dto` + `@Req() req` 의 cookie/user 접근 패턴. **본 task 의 UserController 가 정공법 정합 mirror** (특히 ValidationPipe wire + `@Req() req` 로 `req.user` 접근).
- [src/auth/jwt.strategy.ts](../../src/auth/jwt.strategy.ts) — T-0083 박제. `validate(payload)` 가 `req.user = payload` (sub + role) 박제. 본 task 의 controller 가 `req.user.sub` 를 actor user id 로 사용.
- [src/auth/jwt-auth.guard.ts](../../src/auth/jwt-auth.guard.ts) — T-0083 박제. `@UseGuards(JwtAuthGuard)` 첫 production 사용 — 본 task 가 첫 endpoint 적용.
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — T-0083 박제. `@Roles("SuperAdmin")` 사용 패턴 + ROLES_METADATA_KEY const.
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — T-0083 박제. ROLE_HIERARCHY escalation 매핑 (SuperAdmin ⊇ Admin ⊇ User) + ForbiddenException / UnauthorizedException 분기.
- [src/auth/roles.guard.spec.ts](../../src/auth/roles.guard.spec.ts) — T-0083 spec. RolesGuard mock 패턴 (Reflector mock + context mock + request mock with user).
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — T-0083 박제. JwtAuthGuard + RolesGuard exports. UserModule 가 본 module 을 imports 해야 controller 가 guard 를 `@UseGuards` 로 사용 가능 — **task 진행 중 import 추가 의무**.
- [src/user/dto/add-member.dto.ts](../../src/user/dto/add-member.dto.ts) — DTO 정공법 precedent (T-0057). class-validator decorator 사용 패턴 (`@IsString` / `@IsNotEmpty` / `@IsIn` 등).
- [src/auth/dto/login.dto.ts](../../src/auth/dto/login.dto.ts) — DTO 정공법 precedent (T-0082). 본 task 의 ChangeRoleDto 와 동일 minimal field count 패턴.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — controller spec precedent (T-0055). @Controller prefix + @Patch(':id') + @Param/@Body/@HttpCode 패턴 + ValidationPipe wire. 본 task 는 guard 추가 + Req 사용만 차이.
- [src/user/group.controller.spec.ts](../../src/user/group.controller.spec.ts) — controller spec precedent. service mock + Test.createTestingModule + R-112 4 카테고리 + negative cases 충분 cover 패턴.
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — e2e precedent (T-0054 real DB cutover). `AppModule` import + PrismaService seed + truncateAll afterEach + supertest 호출 패턴.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — truncateAll helper. e2e cleanup 정공법.
- [test/helpers/jest-e2e-setup.ts](../../test/helpers/jest-e2e-setup.ts) — globalSetup. PrismaClient connect/truncate/disconnect 패턴.
- [docs/architecture/api.md](../architecture/api.md) L35 + L48 + L65 + L71 — `/api/users` prefix + PATCH /api/users/:id/role row 의 SuperAdmin 책임 표 + auth tier 정의. 본 task 는 doc-amend 0 (T-0088 candidate 책임) — read-only 정합 검증만.
- [docs/use-cases/UC-04-account-auth.md](../use-cases/UC-04-account-auth.md) §5 step 4 — user mutation 의 main flow. 본 task 의 PATCH endpoint 가 step 4 의 일부 cover.
- [README.md L84](../../README.md) — REQ-044 본문. *"첫 로긴 SuperAdmin / 3 등급 / Admin→User 는 SuperAdmin 만 / 본인 self-demote 금지"* — service layer 가 박제 완료, 본 task 는 HTTP layer 위에 노출만.
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT in HttpOnly cookie + role claim 박제. 본 task 의 e2e 가 JwtService 로 직접 token issue 하는 setup 의 의미적 근거 (login flow bypass — bcrypt seeded user 없이 token 직접 발급).
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §4 — R-112 backbone × 1.5 multiplier + sizeExempt pre-justified 절차.

## Acceptance Criteria

### A. ChangeRoleDto 신설

- [ ] [src/user/dto/change-role.dto.ts](../../src/user/dto/change-role.dto.ts) 신설. `export class ChangeRoleDto` 박제. `role` 필드 1 종만.
- [ ] `role` 필드 decorator: `@IsString()` + `@IsNotEmpty()` + `@IsIn(["SuperAdmin", "Admin", "User"])` — UserService.changeRole 의 invariant 2 (UserRole literal union) 정합. class-validator 가 wrong type / 빈 문자열 / enum 외 값 reject (400 자동 변환).
- [ ] DTO 의 role 값 enum 목록은 inline const 박제 (UserService 의 `VALID_ROLES` 와 의미 정합 — 직접 import 0, DTO 가 production HTTP boundary 라 독립 박제). 주석 1 줄 — "UserService.VALID_ROLES 와 정합 의무 — invariant 2 의 DB boundary".
- [ ] 파일 상단 한국어 주석 5-8 줄 — 책임 (PATCH /api/users/:id/role payload 검증) + Out of Scope (다른 user mutation field 없음, signup DTO 별도) + LoginDto / AddMemberDto 정공법 정합 박제.

### B. UserController 신설

- [ ] [src/user/user.controller.ts](../../src/user/user.controller.ts) 신설. `@Controller("api/users")` prefix (api.md L48 `/api/users` 정합 + AuthController 의 `@Controller("api/auth")` 패턴 mirror).
- [ ] controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` — PersonController / GroupController / AuthController 정공법 정합.
- [ ] constructor 에 `UserService` 1 collaborator inject (private readonly).
- [ ] PATCH endpoint 박제:
  - `@Patch(":id/role")` route.
  - `@UseGuards(JwtAuthGuard, RolesGuard)` — 두 guard stacked 순서 박제 (JwtAuthGuard 가 인증 먼저, RolesGuard 가 권한 검증).
  - `@Roles("SuperAdmin")` — REQ-044 의 Admin→User 변경 권한 박제 (escalation 매핑상 SuperAdmin 만 통과). **NOTE**: README L84 의 후반 "Admin 권한 사용자는 User→Admin 승급" 분기는 본 endpoint 의 scope 외 — Out of Scope § 박제 + 별도 task chain.
  - signature: `async changeRole(@Param("id") id: string, @Body() dto: ChangeRoleDto, @Req() req: Request): Promise<User>`.
  - 본문: `const actorUserId = (req.user as { sub: string }).sub; return this.userService.changeRole(actorUserId, id, dto.role);`. AuthController.refresh 의 `req.cookies` 접근 패턴 정공법 정합 (req.user 의 type narrowing).
  - service layer 의 throw 는 그대로 propagate — NestJS 가 NotFoundException → 404 / ForbiddenException → 403 / UnauthorizedException → 401 / BadRequestException → 400 자동 변환.
- [ ] 파일 상단 한국어 주석 10-15 줄 — 책임 (PATCH /api/users/:id/role + RBAC 첫 production 사용 사례) + 책임 경계 (Out of Scope — POST /api/users 신설 0, PATCH /api/users/:id/password 0, GET /api/users 0, Admin→User 분기 외 승급 분기 0) + JwtAuthGuard + RolesGuard 의 actor user id propagate path (cookie → JwtStrategy.validate → req.user.sub → service.changeRole 의 첫 인자) 박제.

### C. UserModule wiring

- [ ] [src/user/user.module.ts](../../src/user/user.module.ts) 의 `controllers` 배열에 `UserController` 추가.
- [ ] `imports` 배열에 `AuthModule` 추가 (JwtAuthGuard + RolesGuard 의 inject path 확보). 본 추가는 의존성 cycle 위험 검증 — UserModule 이 AuthModule import + AuthModule 가 UserModule import (T-0082 박제) 의 양방향 cycle. **검증**: NestJS 가 `forwardRef` 없이도 양방향 import 를 정상 처리하는 시점 (provider resolution 이 lazy 한 경우) 인지 확인. cycle 시 `forwardRef(() => AuthModule)` 적용 + AuthModule 측에도 동일 wrap 적용. **test 단계에서 UserModule spec 의 provider resolution test 가 fail 시 cycle 확정** — fix 후 재시도.
- [ ] module 주석 추가 1-2 줄 — "T-0087 추가 — UserController 등록 + AuthModule import (JwtAuthGuard + RolesGuard 의존성). RBAC 첫 production 사용 사례 박제".

### D. UserController colocated spec — R-112 4 카테고리

- [ ] [src/user/user.controller.spec.ts](../../src/user/user.controller.spec.ts) 신설 (colocated). `UserService` 를 jest mock 으로 대체 (`provide: UserService, useValue: { changeRole: jest.fn() }` 패턴) + `Reflector` mock 또는 실 inject. JwtAuthGuard + RolesGuard 의 실 verify path 는 별도 layer 책임 (각각 본 system 의 spec 이 cover) — 본 spec 은 controller 단일 책임 + service mock 으로 cover.

- [ ] **테스트 setup 패턴**: `Test.createTestingModule({ controllers: [UserController], providers: [{ provide: UserService, useValue: mockUserService }, { provide: APP_GUARD, useValue: null }, ... ] })` 또는 `overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` + `overrideGuard(RolesGuard).useValue({ canActivate: () => true })` 정공법. supertest + INestApplication.init() 패턴 (group.controller.spec.ts 정공법 정합) — 분기 cover 의 정밀성 위해 supertest 호출 패턴 채택.

- [ ] `describe("PATCH /api/users/:id/role", ...)` block. 다음 it 15+ (R-112 4 카테고리 + negative cases 충분 cover, branch 마다 1+ test):

  **happy (3+)**
  - SuperAdmin actor 가 다른 user 의 role 을 "Admin" 으로 변경 → 200 + UserService.changeRole 호출 + 결과 user body 반환.
  - SuperAdmin actor 가 다른 user 의 role 을 "User" 로 변경 → 200 + service 호출.
  - SuperAdmin actor 가 다른 user 의 role 을 "SuperAdmin" 으로 변경 → 200 + service 호출.

  **branch — role 값 변종 (DTO @IsIn 분기, 3 종 모두 cover)**
  - body `{ role: "SuperAdmin" }` → 200 (위 happy 와 별도 직접 분기 검증).
  - body `{ role: "Admin" }` → 200.
  - body `{ role: "User" }` → 200.

  **branch — route param 분기**
  - `:id` 가 valid string (예: "user-id-1") → 200.
  - `:id` 가 빈 string 또는 (NestJS route param 빈 분기 — route 자체 가 매치 안 됨, 별도 분기 박제 — 또는 service layer 가 NotFoundException 변환).

  **error path — DTO validation 실패 (400, ValidationPipe)**
  - body `{}` (role 부재) → 400.
  - body `{ role: 123 }` (wrong type) → 400.
  - body `{ role: "" }` (빈 string, @IsNotEmpty) → 400.
  - body `{ role: "Owner" }` (enum 외) → 400.
  - body `{ role: "user" }` (소문자, enum 외) → 400.
  - body `{ role: "Admin", extra: "foo" }` (forbidNonWhitelisted) → 400.

  **error path — service throw propagation**
  - UserService.changeRole 가 `UnauthorizedException` throw → 401 응답 (actor 부재 case).
  - UserService.changeRole 가 `ForbiddenException("only SuperAdmin can change user role")` throw → 403.
  - UserService.changeRole 가 `ForbiddenException("self-demote is not allowed")` throw → 403.
  - UserService.changeRole 가 `NotFoundException` throw → 404 (target 부재 또는 race window P2025).
  - UserService.changeRole 가 `BadRequestException("invalid role: ...")` throw → 400 (service 차원 invariant 2 — DTO 통과 후 race 또는 의도된 우회 시).
  - UserService.changeRole 가 generic Error throw → 500 (NestJS default error handler).

  **negative — actor user id propagation**
  - req.user.sub 가 controller 의 service.changeRole 첫 인자로 정확히 전달되는지 mock spy 로 검증 (jest.fn.mock.calls[0][0] === expected sub).
  - req.user 가 부재 (guard overrideGuard 가 req.user 셋팅 누락) → controller 가 sub undefined 로 service 호출 → service 가 UnauthorizedException throw → 401 응답 (또는 type narrowing assertion fail).

- [ ] 본 spec 은 R-112 4 카테고리 cover 의무 — happy 3+ / error path 6+ / branch 6+ / negative 2+ = 17+ it. spec 본문 ~270 LOC 예상 (T-0086 spec 22 it 433 LOC 의 비례).

### E. UserModule spec — UserController 등록 검증

- [ ] [src/user/user.module.spec.ts](../../src/user/user.module.spec.ts) 에 `it("registers UserController", ...)` 1 it 추가. NestJS TestingModule.get<UserController>(UserController) 으로 resolve 확인. AuthModule import 의 cycle 검증 — provider 미해결 시 fail.

### F. e2e — users.e2e-spec.ts 신설

- [ ] [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) 신설. `AppModule` import + 실 PrismaService + truncateAll afterEach + supertest 패턴 (persons.e2e-spec.ts 정공법 정합).

- [ ] **JWT 발급 setup 패턴** — login flow bypass:
  - `beforeAll` 에서 JwtService 를 `moduleRef.get<JwtService>(JwtService)` 로 가져옴.
  - SuperAdmin token + User token 2 종 inline 발급 (sub + role payload, AUTH_JWT_SECRET 으로 sign).
  - cookie 형식 박제 — `Cookie: access_token=<token>` (AuthController 의 ACCESS_TOKEN_COOKIE 정합).
  - 환경변수 `AUTH_JWT_SECRET` 미설정 시 default 값 setup (jest setup 또는 spec 내 process.env 박제).
  - **follow-up 박제**: 본 inline 패턴이 2+ e2e 에 필요 시 `test/helpers/auth-e2e-helper.ts` 추출. 본 task 는 inline (T-0091 candidate 가 추출).

- [ ] e2e it 5+ (R-113 + RBAC 첫 e2e):
  - **happy** — SuperAdmin token + target user (PrismaService seed) → PATCH /api/users/:id/role body `{ role: "Admin" }` → 200 + 응답 body 의 role === "Admin" + DB query 결과의 role === "Admin".
  - **negative — 401 (no cookie)** — cookie 없이 PATCH 호출 → 401.
  - **negative — 401 (invalid token)** — cookie `access_token=garbage` → 401.
  - **negative — 403 (User role token)** — User token + target user → 403 (RolesGuard 의 escalation 검증 negative).
  - **negative — 403 (self-demote)** — SuperAdmin token + 본인 id 로 PATCH body `{ role: "Admin" }` → 403 (service layer invariant 4).
  - **negative — 404 (target 부재)** — SuperAdmin token + 존재하지 않는 id → 404.
  - **negative — 400 (DTO 위반)** — SuperAdmin token + body `{ role: "Owner" }` → 400.

- [ ] e2e 본문 ~100-140 LOC 예상.

### G. CI / 4-게이트

- [ ] `pnpm lint` + `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — UserController + ChangeRoleDto 의 line ≥ 80% AND function ≥ 80% 강제 충족. 신규 controller 의 모든 분기 cover 로 100% 목표.
- [ ] `pnpm test:smoke` 통과 (smoke 변경 없음 — 본 task production behavior 추가만, 기존 smoke 영향 0).
- [ ] `pnpm test:e2e` 통과 — users.e2e-spec.ts 의 happy 1 + negative 6 모두 green.
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **api.md §5 의 PATCH /api/users/:id/role row amend + modules.md UserModule row 갱신** — **T-0088 candidate** (별도 doc-only direct task). 본 task 머지 후 별도 direct commit.
- **POST /api/users (signup) endpoint + UserService.create** — T-0089 candidate. 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반) 포함.
- **PATCH /api/users/:id/password endpoint** — api.md L72 박제. self vs other 분기 + bcrypt 변환 + AuthService.hashPassword 호출. 별도 task chain.
- **GET /api/users (list) + GET /api/users/:id endpoint** — read-only path, RBAC tier 검토 필요 (Admin+ 만 또는 self). 별도 task.
- **Admin 의 User→Admin 승급 분기** — README L84 후반 박제. UserService.changeRole 의 invariant 1 (only SuperAdmin) 와 충돌 — 별도 service 메서드 (promoteToAdmin) 또는 분기 확장 ADR 박제 필요. 본 task 의 `@Roles("SuperAdmin")` 정공법 정합 유지.
- **AuthService.issueAccessToken role rotation** — changeRole 후 변경된 role 의 즉시 token rotation 박제. 본 task 의 endpoint 는 user.role 변경 후 다음 refresh 시점에 새 role propagate (cookie rotation 7day TTL) — immediate rotation 은 별도 task.
- **CurrentUser decorator 신설** — `@CurrentUser() actor: { sub: string; role: string }` 의 NestJS custom param decorator. 본 task 는 `@Req() req` + `req.user` type narrowing 정공법 정합 (AuthController.refresh 패턴 mirror). 별도 task 가 추출 — 2+ controller 가 동일 사용 시.
- **test/helpers/auth-e2e-helper.ts 추출** — 본 e2e 의 inline JWT 발급 패턴을 helper 로 추출. 본 task 는 inline 유지 (단일 사용). T-0091 candidate — 2+ e2e 가 필요한 시점.
- **e2e 에서 login flow 통과 (bcrypt 박제 user seed + POST /api/auth/login 으로 cookie 발급)** — 본 task 는 JwtService 직접 발급으로 cycle 단축. login flow 의 end-to-end 검증은 별도 auth.e2e-spec.ts task (T-0089 chain 의 일부).
- **ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET)** — T-0090 candidate. 본 task 는 fallback 정합 (JwtService 가 빈 secret 시 빈 sign — e2e setup 에서 secret 명시 박제).
- **RefreshToken DB rotation + revocation path** — ADR-0008 §6 박제, 별도 T-0092 candidate.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0, ADR-0008 + REQ-044 박제 정공법 정합 — 신규 결정 0, controller layer 정공법 mirror).

## Follow-ups

- **T-0088 candidate** — api.md §5 의 PATCH /api/users/:id/role row 박제 amend (RBAC 첫 적용 endpoint contract 박제 + auth tier 컬럼 SuperAdmin 정합) + modules.md UserModule row 갱신 (UserController 추가 cross-reference). doc-only direct, ~40-60 LOC.
- **T-0089 candidate** — POST /api/users (signup) + UserService.create + 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반). SuperAdmin 0 명 상태에서만 user creation 자동 SuperAdmin role 부여 invariant.
- **T-0090 candidate** — ConfigModule fail-fast (Joi schema for AUTH_JWT_SECRET / AUTH_JWT_REFRESH_SECRET). 본 task 의 e2e 가 env 직접 박제하는 brittle 패턴 영구 fix.
- **T-0091 candidate** — test/helpers/auth-e2e-helper.ts 추출. 본 task 의 inline JWT 발급 패턴 + cookie 형식 박제 + SuperAdmin/Admin/User 3 종 token 발급 utility. 2+ e2e 에서 reuse.
- **T-0092 candidate** — RefreshToken DB table + revocation path (ADR-0008 §6 박제).
- **CurrentUser decorator 추출** — `@CurrentUser() actor: JwtPayload` custom param decorator. 2+ controller 가 `req.user` 사용 시 추출 — 본 task 머지 후 follow-up candidate.
- **Admin 의 User→Admin 승급 분기** — README L84 후반 박제. 본 task 의 `@Roles("SuperAdmin")` 정공법 정합 — 승급 분기는 별도 service 메서드 (promoteToAdmin) + 별도 endpoint 또는 changeRole 의 분기 확장 ADR.
- **PersonController / GroupController / PartController 의 mutation endpoint @Roles 박제 chain** — REQ-045 (Admin+ 만 mutation) 적용. 각 controller 의 POST / PATCH / DELETE 에 `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles("Admin")` 박제 + e2e cover. 본 task 머지 후 자연 chain (각 ~50-80 LOC).
- **estimate-model.md 17 회차 milestone refinement** — 본 task 의 R-112 backbone × 1.5 multiplier (4 surface) variance 박제 + e2e 동반 task 의 envelope 패턴 + JWT setup inline 의 LOC overhead 데이터.
- **AuthController.refresh 의 role 변경 propagate** — changeRole 후 cookie 의 token 은 변경 전 role 유지. refresh endpoint 가 DB lookup 으로 신규 role 발급하도록 변경하는 별도 task (immediate role rotation).
- **getPrismaErrorCode helper 외화** — 5 회차 중복 누적 (Group / Part / Person / User service + 본 task 의 controller 가 service throw propagate). shared helper 모듈 외화 후보.
