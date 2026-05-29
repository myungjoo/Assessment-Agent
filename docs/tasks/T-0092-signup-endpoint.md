---
id: T-0092
taskId: T-0092
title: POST /api/users 신규 user 등록 + 첫 등록 user SuperAdmin 자동 지정 (REQ-044 후반)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-044]
estimatedDiff: 320
estimatedFiles: 5
estimatedLoc: 320
dependsOn: [T-0086, T-0087, T-0091]
sizeExempt: true
exemptReason: "R-112 backbone × 1.5 × P2002 sub-multiplier × 1.2 = × 1.8 pre-justified — 4 layer 동시 박제 (AddUserDto / UserService.signup / UserController POST / 4 colocated spec) + User.email @unique 의 P2002 분기 추가. base ~ 180 LOC × 1.8 ≈ 320 LOC. T-0086 ×2.28 + T-0087 ×1.98 + T-0091 ×1.86 precedent 정합."
created: 2026-05-29
createdAt: 2026-05-29T13:35:00+09:00
completedAt: 2026-05-29T14:42:00+09:00
prNumber: 87
mergedAs: f97329b
reviewRounds: 1
actualLoc: "+854/-26"
actualFiles: 9
completionNote: "T-0092 MERGED PR-87 sha f97329b round 1 single-shot. AddUserDto (email + password MinLength 8) + UserService.signup (countAll → SuperAdmin/User 분기 + bcrypt 10 rounds + P2002 → 409 변환) + UserRepository.countAll + UserController @Post() (Public, @HttpCode 201) + AuthService inject via forwardRef + colocated spec (AddUserDto 18 it / signup 12 it / countAll 4 it / POST controller 5 it) + e2e 5 it (T-0091 createAuthenticatedE2EApp 첫 production 소비). 실 LOC +854/-26 across 9 파일 (envelope 320 × 1.8 의 ×0.83 within tolerance — under-use 첫 사례, R-112 + P2002 backbone 예측 정확). 신규 surface 100% line/function/branch/statement coverage (40 suites / 713 tests). 4-게이트 all PASS: reviewer round 1 APPROVE comment 4571022205 + PR comment 외부 + integrator self-check + CI run 26620063895 conclusion=success. RBAC backbone last-mile 박제 완결 (T-0083 → T-0086 → T-0087 → T-0092 chain 4/4 closed + ADR-0008 §6 후속 chain 마지막 production endpoint 공백 해소). single-shot first-run pass cadence 5 회차 누적 (T-0086 + T-0087 + T-0090 + T-0091 + T-0092)."
plannerNote: "POST /api/users + AddUserDto + UserService.signup (첫 user SuperAdmin 분기 invariant + email P2002) — REQ-044 후반 첫 로그인 SuperAdmin backbone, T-0091 helper 의 첫 production 소비."
---

# T-0092 — POST /api/users (signup) endpoint + 첫 등록 user SuperAdmin 자동 지정 (REQ-044 후반)

## Why

[T-0087](T-0087-user-controller-change-role.md) 머지 시점에 박제된 UserController scope 의 명시적 Out of Scope ([src/user/user.controller.ts L10-11](../../src/user/user.controller.ts)) — _"POST /api/users (signup) endpoint 부재. 첫 로그인 SuperAdmin 자동 지정 invariant (REQ-044 후반)"_ — 가 RBAC backbone 의 **마지막 production endpoint 공백**. 현재 시스템은 user 를 SQL/Prisma seed 로만 생성 가능 (HTTP API 0) → README L83-84 ([REQ-043](../../README.md) / [REQ-044](../../README.md)) 의 "모든 사용 기능은 보안사항으로서 ID 와 Password 로 보호" + "SuperAdmin (첫 로긴), Admin, User 3 등급" 정합도 부분.

본 task 가 **`POST /api/users` 신규 등록 endpoint 박제** — 다음 4 invariant 박제:

1. **첫 user 등록 시 SuperAdmin 자동 지정** — DB 의 User row 카운트 0 일 때 등록 user 의 role = "SuperAdmin" 강제 (REQ-044 후반 "첫 로긴 Admin" 해석 — 본 시스템에서는 "첫 등록 user" 로 박제). 두 번째 user 이후는 default role = "User".
2. **email unique constraint (P2002) → 409 Conflict** — User.email `@unique` schema-level enforce ([prisma/schema.prisma L164](../../prisma/schema.prisma)) 의 Prisma P2002 error → ConflictException 변환. PartService.update 의 P2002 분기 1:1 mirror (T-0071 precedent).
3. **password bcrypt 10 rounds hash** — AuthService.hashPassword ([src/auth/auth.service.ts L75-77](../../src/auth/auth.service.ts)) 호출, ADR-0008 Decision §6 정합. plain password DB write 0.
4. **AddUserDto validation** — email (RFC 5322) + password (min 8 char) + 빈 string / wrong type reject. LoginDto + CreatePersonDto 정공법 정합.

본 task 는 [T-0091](T-0091-auth-e2e-helper.md) 의 `createAuthenticatedE2EApp` helper 의 **첫 production 소비** — e2e 가 본 helper 호출로 SuperAdmin seed + token + signup flow 검증 (단순 inline 패턴 0).

[PLAN.md L61 P3 backbone](../PLAN.md) — _"Auth/RBAC 모델 (SuperAdmin/Admin/User) — 첫 로그인 SuperAdmin 지정, Admin→User 변경은 SuperAdmin만"_. 본 task 가 **첫 로그인 SuperAdmin** 분기를 service-layer 박제 (controller / DTO 동반). [ADR-0008 §6 후속 chain](../decisions/ADR-0008-auth-credential-type.md) 의 T-0080 (UserRepository.create), T-0083 (RBAC scaffold), T-0086 (changeRole), T-0087 (PATCH endpoint) 이후 자연 progression — User entity backbone 의 last-mile.

## Required Reading

- [src/user/user.service.ts](../../src/user/user.service.ts) — UserService.changeRole 박제. 본 task 가 동 service 에 `signup(email, password): Promise<User>` 메서드 추가. VALID_ROLES const + getPrismaErrorCode helper 재사용.
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — UserController PATCH /api/users/:id/role 박제. 본 task 가 동 controller 에 `@Post()` signup endpoint 추가. @Public (no guard) — signup 은 인증 없이 접근.
- [src/user/user.repository.ts L33-49](../../src/user/user.repository.ts) — UserCreateInput + create 박제. P2002 propagate 정공법 (catch 0 — service layer 변환 책임).
- [src/auth/auth.service.ts L70-77](../../src/auth/auth.service.ts) — AuthService.hashPassword 박제. signup service 가 plain password → hash 변환에 사용. bcrypt 10 rounds.
- [src/auth/dto/login.dto.ts](../../src/auth/dto/login.dto.ts) — LoginDto 정공법 precedent (email + password 2 필드, @IsEmail + @IsNotEmpty + @IsString). 본 task 의 AddUserDto 가 동 패턴 + password min 8.
- [src/user/dto/change-role.dto.ts](../../src/user/dto/change-role.dto.ts) — ChangeRoleDto + VALID_ROLE_VALUES 박제. AddUserDto 의 일관 패턴 reference (한국어 주석 / Out of Scope / decorator stack).
- [src/user/dto/create-person.dto.ts](../../src/user/dto/create-person.dto.ts) — CreatePersonDto 박제. AddUserDto 의 class-validator decorator stack 정공법.
- [src/user/user.module.ts](../../src/user/user.module.ts) — providers/exports/imports 박제. 본 task 는 UserController 가 AuthService 를 inject (hashPassword 위해) → AuthService export 가 AuthModule 에서 이미 있는지 확인 + 필요 시 amend. controller 등록 변경 0 (UserController 이미 등록).
- [src/auth/auth.module.ts](../../src/auth/auth.module.ts) — AuthModule providers/exports 박제. AuthService export 여부 확인 — 미export 시 본 task 의 amend 항목 포함.
- [test/e2e/users.e2e-spec.ts L36-49](../../test/e2e/users.e2e-spec.ts) — 기존 e2e setup 박제. 본 task 가 동 spec 에 `POST /api/users` it 3+ 추가 (T-0091 createAuthenticatedE2EApp 의 첫 production 소비). beforeEach 의 user seed reset 패턴 활용.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — T-0091 박제. `createAuthenticatedE2EApp([])` 호출로 빈 seed + signup 자체 검증 (첫 signup → SuperAdmin 자동 분기 검증).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — truncateAll(prisma) 박제. 본 spec 의 afterEach 책임 — 첫 user 분기 검증 시 매 it 마다 User table 비우기 의무.
- [prisma/schema.prisma L162-169](../../prisma/schema.prisma) — User model 박제 (email @unique + hashedPassword + role + createdAt + updatedAt). 본 task 는 schema 변경 0 (기존 model 사용).
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — 후속 chain candidate 표 박제. 본 task 는 ADR-0008 의 자연 progression.
- [docs/architecture/api.md L70](../architecture/api.md) — `POST /api/users` row 박제 ("신규 user 계정 생성 (등급 default = User), Admin+"). 본 task 가 **분기 박제 의무** — 첫 user 는 SuperAdmin 자동 지정, 그 외는 default User. api.md amend 는 별도 follow-up task (doc-only direct).
- [docs/architecture/api.md §3 L32](../architecture/api.md) — Public tier 박제 ("`POST /api/auth/login`, health check"). 본 task 의 `POST /api/users` 는 **현 시점 Public 박제** (인증 없는 첫 user 진입 path 필수) — 향후 RBAC 강화 시 별도 ADR 로 Admin+ 로 격상 검토 (Out of Scope).
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy/error/branch/negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — R-112 backbone × 1.5 × P2002 sub-multiplier × 1.2 = × 1.8 적용.

## Acceptance Criteria

### A. `src/user/dto/add-user.dto.ts` 신설

- [ ] [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) 신설. `AddUserDto` class export. 다음 필드 박제:
  - `email: string` — `@IsEmail() @IsNotEmpty()` (LoginDto 정공법 정합 — RFC 5322 + 빈 string reject).
  - `password: string` — `@IsString() @IsNotEmpty() @MinLength(8)` (LoginDto 패턴 + minimum length backbone — 본 task 가 password 정책 첫 박제).
- [ ] 파일 상단 한국어 주석 15-20 줄 — 책임 (POST /api/users payload 검증) + ValidationPipe 정합 (whitelist + forbidNonWhitelisted + transform — UserController @UsePipes 박제) + Out of Scope (role 필드 0 — signup 은 자동 분기 / fullName / displayName 등 추가 필드 0 — 별도 task) + LoginDto + ChangeRoleDto cross-ref + ADR-0008 정합 (plain password HTTPS 보호 → service-layer bcrypt hash).

### B. `src/user/dto/add-user.dto.spec.ts` colocated spec (R-112 4 카테고리)

- [ ] [src/user/dto/add-user.dto.spec.ts](../../src/user/dto/add-user.dto.spec.ts) 신설. `class-validator.validate(plainToInstance(AddUserDto, payload))` 패턴 (CreatePersonDto.spec / ChangeRoleDto.spec 정공법 정합). 다음 it 박제 (≥ 12 it):
  - **happy — valid payload**: `{email:"test@example.com", password:"securepass"}` → errors.length === 0.
  - **happy — long password**: 30 char password → pass.
  - **error — missing email**: payload 에 email 부재 → IsEmail / IsNotEmpty 위반.
  - **error — missing password**: payload 에 password 부재 → IsString / IsNotEmpty 위반.
  - **error — invalid email format**: `"not-an-email"` → IsEmail 위반.
  - **error — empty email string**: `""` → IsEmail / IsNotEmpty 위반.
  - **error — empty password string**: `""` → IsNotEmpty 위반.
  - **error — password too short**: 7 char password → MinLength 위반 (boundary 검증).
  - **error — password exactly 8 char**: 8 char password → pass (boundary 검증, MinLength 의 inclusive 분기).
  - **negative — wrong type email (number)**: `email: 12345` → IsEmail / IsString 위반.
  - **negative — wrong type password (boolean)**: `password: true` → IsString 위반.
  - **negative — null email**: `email: null` → IsEmail / IsNotEmpty 위반.

### C. `src/user/user.service.ts` 의 signup 메서드 추가

- [ ] [src/user/user.service.ts](../../src/user/user.service.ts) 의 `UserService` class 에 `signup(email: string, plainPassword: string): Promise<User>` 메서드 추가. AuthService inject 의무 (constructor 에 `private readonly authService: AuthService` 추가, AuthModule export 필요 시 amend).
- [ ] signup invariant 박제 (early-return 정공법, changeRole 패턴 1:1 mirror):
  1. **첫 user 분기 검증** — UserRepository 에 `countAll(): Promise<number>` 새 메서드 추가 (단순 `prisma.user.count()` wrapping). signup 시점 count === 0 → 등록 role = "SuperAdmin", count > 0 → role = "User".
  2. **password hash** — `this.authService.hashPassword(plainPassword)` 호출, bcrypt 10 rounds (ADR-0008 §6).
  3. **UserRepository.create forwarding** + P2002 → ConflictException 변환 (try/catch). 그 외 raw propagate.
- [ ] 한국어 주석 25-30 줄 추가 (changeRole 패턴 정합) — 책임 분기 명시 + invariant 순서 + Prisma P2002 → ConflictException + 첫 user race window (race condition 시 두 user 가 동시 첫 → 둘 다 SuperAdmin, schema 미강제) 박제 + Out of Scope (race 강제는 후속 task — `@@check` / DB advisory lock 등 별도 ADR).
- [ ] `import { ConflictException } from "@nestjs/common"` 추가. `import { AuthService } from "../auth/auth.service"` 추가.

### D. `src/user/user.repository.ts` 의 countAll 메서드 추가

- [ ] [src/user/user.repository.ts](../../src/user/user.repository.ts) 의 `UserRepository` class 에 `countAll(): Promise<number>` 메서드 추가. 단순 `return this.prisma.user.count()`. 한국어 주석 5-7 줄 — UserService.signup 의 첫 user 분기 backbone, null-safe (count 0 정상 분기).

### E. `src/user/user.service.spec.ts` 의 signup it 추가

- [ ] [src/user/user.service.spec.ts](../../src/user/user.service.spec.ts) 의 `describe("signup")` block 추가 (changeRole describe block 정공법 정합). 다음 it 박제 (≥ 8 it):
  - **happy — 첫 user → SuperAdmin 자동**: mockUserRepo.countAll → 0 + mockAuthService.hashPassword → "hashed" + mockUserRepo.create → user with role="SuperAdmin". signup("a@b.c","plain") 호출 검증.
  - **happy — 두 번째 user → User default**: countAll → 1 + create → user with role="User".
  - **happy — N 번째 user → User default**: countAll → 42 → role="User" 검증.
  - **branch — countAll === 0 분기**: 위 happy 첫 user 케이스 검증.
  - **branch — countAll > 0 분기**: 위 happy default user 케이스 검증.
  - **error — UserRepository.create P2002 → ConflictException**: mock create throw error with code "P2002" → service 가 ConflictException throw.
  - **error — UserRepository.create 의 그 외 error raw propagate**: code "P9999" throw → raw propagate (ConflictException 변환 0).
  - **negative — empty email forward**: signup("", "p") → DB 까지 forward (DTO layer 의 책임). 서비스가 빈 string 도 raw forward 검증.
  - **negative — AuthService.hashPassword throw**: mock hashPassword reject → signup 도 raw propagate (catch 0).
- [ ] signup mock setup: `mockAuthService = { hashPassword: jest.fn() }` constructor inject.

### F. `src/user/user.controller.ts` 의 POST /api/users endpoint 추가

- [ ] [src/user/user.controller.ts](../../src/user/user.controller.ts) 의 `UserController` class 에 `@Post()` signup endpoint 추가. 다음 박제:
  - **`@Post()`** decorator (path 없음 — controller 의 base path "api/users" 만).
  - **`@HttpCode(201)`** — Created.
  - **guard 없음** — signup 은 Public (인증 없는 첫 user 진입 path 필수, RBAC 강화는 별도 ADR/task).
  - **`@Body() dto: AddUserDto`** — ValidationPipe 가 controller-scope @UsePipes 로 적용.
  - **`return this.userService.signup(dto.email, dto.password)`**.
- [ ] 한국어 주석 15-20 줄 추가 — signup endpoint 책임 (REQ-044 후반 첫 등록 user SuperAdmin) + Public tier 박제 (RBAC 강화는 follow-up) + 응답 (201 + User row, hashedPassword 컬럼 포함된 채 반환 — Out of Scope 의 user response shape 정제는 별도 task) + service throw mapping (ConflictException → 409 / BadRequestException → 400 / 그 외 → 500).
- [ ] import 박제 — `Post`, `HttpCode` from `@nestjs/common`. `AddUserDto` from `./dto/add-user.dto`.

### G. `src/user/user.controller.spec.ts` 의 signup it 추가

- [ ] [src/user/user.controller.spec.ts](../../src/user/user.controller.spec.ts) 의 `describe("POST signup")` block 추가. 다음 it 박제 (≥ 5 it):
  - **happy — 정상 forward**: mockService.signup → user. controller.signup({email:"a@b.c", password:"securepass"}) 호출 → service.signup 가 ("a@b.c", "securepass") 인자로 호출됨 + 반환값 그대로 propagate.
  - **error — service throw ConflictException → controller raw propagate**: mockService.signup throw ConflictException → controller 가 동일 exception throw.
  - **error — service throw 그 외 → controller raw propagate**: mockService.signup throw generic Error → controller 가 동일 throw.
  - **branch — signup 인자 propagation**: dto.email + dto.password 가 service 의 첫/두 번째 인자로 그대로 전달됨 검증 (.mock.calls inspection).
  - **negative — service throw BadRequestException → controller raw propagate**: mockService.signup throw BadRequestException → controller propagate.

### H. `test/e2e/users.e2e-spec.ts` 의 signup e2e it 추가 (T-0091 helper 첫 production 소비)

- [ ] [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) 에 `describe("POST /api/users signup", ...)` block 추가. 기존 7 it 보존 + 다음 it 박제 (≥ 4 it):
  - **happy — 첫 signup → SuperAdmin 자동 지정**: `createAuthenticatedE2EApp([])` 호출 (빈 seed = User table 비어있음) → `request(app).post("/api/users").send({email:"first@e2e.test", password:"securepass"})` → 201 + body.role === "SuperAdmin" 검증. DB query 로도 role === "SuperAdmin" 재검증.
  - **happy — 두 번째 signup → User default**: `createAuthenticatedE2EApp([{role:"SuperAdmin", email:"existing@e2e.test"}])` 으로 1 user seed → signup 신규 user → body.role === "User" 검증.
  - **error — duplicate email → 409**: 1 seed user + same email 로 signup → 409 Conflict.
  - **error — invalid payload → 400**: `password: ""` 또는 `email: "not-email"` → 400 BadRequest (ValidationPipe).
- [ ] afterEach 의 truncateAll 호출 보존 (기존 패턴). 본 it block 의 beforeEach 가 helper 호출 — 첫 signup it 의 빈 seed 보장.

### I. AuthService export wiring (필요 시)

- [ ] [src/auth/auth.module.ts](../../src/auth/auth.module.ts) 의 exports 에 `AuthService` 가 미포함이면 추가. UserService 가 inject 의무. AuthModule ↔ UserModule forwardRef 박제 (T-0087 의 forwardRef 정합 — circular 해결).
- [ ] AuthService 가 이미 exports 에 있으면 본 항목 생략 (no-op 박제, follow-up 항목으로 "이미 export 됨" 명시).

### J. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — user.service.ts + user.controller.ts + add-user.dto.ts + user.repository.ts (countAll 추가) 의 line ≥ 80% AND function ≥ 80%. 본 task 신규 surface 는 모두 신규 spec 으로 cover 의무.
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음.
- [ ] `pnpm test:e2e` 통과 — 변환된 users.e2e-spec.ts 기존 7 it + 신규 signup 4+ it 모두 green.
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **첫 user 분기의 race window 강제** — DB advisory lock / `@@check` / unique constraint on role="SuperAdmin" 등의 강제는 본 task 0. 현재는 service-layer count check 후 create 분기 — concurrent 2 signup 동시 첫 → 둘 다 SuperAdmin 가능. 별도 ADR + task. 단 docstring 에 명시 의무.
- **POST /api/users 의 RBAC 강화 (Admin+ tier 격상)** — api.md L70 박제 default 는 "Admin+" 이나 본 task 는 **Public 박제** (첫 user 진입 path 필수). 향후 첫 user 등록 후 endpoint 를 Admin+ 로 격상 (예: `POST /api/users` 가 RolesGuard 로 SuperAdmin+ 만 허용 + 첫 user 진입 path 는 별도 `POST /api/auth/setup` 으로 분리) 는 별도 ADR.
- **api.md L70 row amend** — 본 task 머지 후 doc-only direct follow-up task. 분기 박제 (Public 첫 user / Admin+ 두 번째 이후) + 첫 SuperAdmin 자동 지정 invariant + 409 P2002 분기 + 400 ValidationPipe 분기. (T-0093 candidate)
- **modules.md L34 UserModule row amend** — 본 task 의 signup 메서드 추가 후 책임 description 확장. doc-only direct follow-up.
- **auth.e2e-spec.ts (login flow e2e)** — POST /api/auth/login + logout + refresh end-to-end e2e 신설. 본 task 의 signup 이 user seed 진입 path 박제, login e2e 는 helper + 본 signup 후 login round-trip 검증 — 별도 task.
- **User response shape 정제 (hashedPassword 제거)** — signup 응답이 hashedPassword 컬럼 포함된 채 반환. 보안 risk 박제 — 별도 task (UserResponseDto 또는 Prisma select projection).
- **password 정책 강화** — 본 task 는 min 8 char 만. 복잡도 (대문자/숫자/특수문자) / blacklist / breach API check 등 별도 task / ADR.
- **rate limiting / brute-force 차단** — signup endpoint 의 자동화 차단 (CAPTCHA / rate limit) 없음. 별도 task.
- **email 검증 (verification mail)** — email confirm flow 0. 별도 task / ADR.
- **첫 SuperAdmin 의 강제 password 변경** — 첫 signup 시 임시 password 박제 + 다음 login 시 강제 변경 등의 flow 0. 별도 task.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — 신규 결정 0, ADR-0008 §6 chain 의 자연 progression + LoginDto / ChangeRoleDto / CreatePersonDto 정공법 1:1 mirror + PartService.update P2002 분기 1:1 mirror).

## Follow-ups

- **T-0093 candidate** — api.md L70 row amend (POST /api/users 분기 박제: Public 첫 user / Admin+ 두 번째 이후 + SuperAdmin 자동 지정 invariant + 409 P2002 분기). doc-only direct inline-amend × 0.64.
- **modules.md L34 UserModule row amend** — 책임 description 에 UserService.signup + REQ-044 후반 첫 user SuperAdmin invariant + AuthService inject 추가. doc-only direct.
- **첫 user 분기 race window 강제 ADR** — DB advisory lock 또는 unique constraint on role="SuperAdmin" 의 trade-off 박제. 별도 ADR.
- **POST /api/users RBAC 강화 ADR** — 첫 user 후 endpoint 를 Admin+ 격상 또는 분리 endpoint (`/api/auth/setup`) 박제. 별도 ADR.
- **auth.e2e-spec.ts (login flow e2e)** — POST /api/auth/login + logout + refresh end-to-end. T-0091 helper + 본 signup 의 round-trip 검증.
- **User response shape 정제 (hashedPassword 제거)** — UserResponseDto 또는 Prisma select projection. 별도 task.
- **password 정책 강화** — 복잡도 / blacklist / breach API. 별도 ADR + task.
- **email 검증 flow** — verification mail + token. 별도 ADR.
- **T-0092 candidate (별도 ID, RefreshToken DB table + revocation)** — 본 task 와 무관, ADR-0008 §6 박제 별도 chain. 본 task 머지 후 자연 progression.
- **estimate-model.md milestone refinement** — 본 task 의 R-112 × 1.5 × P2002 × 1.2 = × 1.8 multiplier variance 박제 (T-0091 × 1.86 / T-0086 × 2.28 precedent 정합 누적 데이터).
