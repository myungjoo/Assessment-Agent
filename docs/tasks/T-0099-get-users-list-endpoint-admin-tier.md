---
id: T-0099
taskId: T-0099
title: GET /api/users list endpoint (Admin+ tier) + UserResponseDto.fromEntities 배열 helper + e2e
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045]
estimatedDiff: 260
estimatedFiles: 5
estimatedLoc: 260
dependsOn: [T-0085, T-0091, T-0095]
sizeExempt: false
created: 2026-05-30
createdAt: 2026-05-30T09:55:00+09:00
completedAt: 2026-05-30T10:25:00+09:00
actualDiff: 660
actualFiles: 9
prNumber: 100
mergedAs: e91559b
reviewRounds: 1
plannerNote: "loop session #27 turn 4/10 — P3 user CRUD-R 자연 progression. partial-backbone × 1.3 envelope 260 LOC / 5 파일 (UserResponseDto.fromEntities + UserRepository.findAll + UserService.findAll + UserController.list + Admin+ RBAC + colocated spec 4 + e2e regression)."
driverNote: "loop session #27 turn 5/10 (KST 2026-05-30 10:25, local Windows env, gh CLI v2.88.1) — executor sub-agent dispatch (implementer + tester) → driver branch create + commit + push + PR open + integrator sub-agent dispatch (reviewer round 1 APPROVE + self-check 6/6 + 4-게이트) → squash merge sha e91559b PR-100 round 1 single-shot. **첫 Admin+ tier production 활용 박제** — UserController.list `@Get() @UseGuards(JwtAuthGuard, RolesGuard) @Roles('Admin')` — escalation hierarchy descent (SuperAdmin actor → Admin gate 통과) production 첫 활용, RBAC backbone 두 번째 production 사용 사례 (T-0087 SuperAdmin literal match 이후). **UserResponseDto.fromEntities batch helper 박제** — T-0095 §Out of Scope L122 follow-up 박제점 완결 (private constructor + fromEntity static factory + fromEntities batch helper 3 factory 박제). 실 LOC +658/-2 across 9 파일 (envelope 260 × 1.3 partial-backbone 의 ×2.53 over within R-112 spec mass tolerance — T-0095 ×2.34 + T-0094 ×2.19 + T-0091 ×1.86 + T-0086 ×2.28 + T-0083 ×1.77 precedent 6 회차 누적 정합 MINOR-only, production source 108 LOC envelope 정합, 나머지 ~550 LOC 가 spec / e2e mass 본질, scope creep 0). 신규 surface 100% line/branch/function/statement coverage (795/795 tests pass — smoke/e2e local DATABASE_URL 부재로 CI services.postgres 위임 R-113 정공법). 4-게이트 all PASS: reviewer round 1 APPROVE comment 4581119897 (8-check pass + R-112 4 카테고리 + Admin+ tier RBAC + MINOR task-text-paraphrase-only code-correct) + PR comment 외부 박제 + integrator self-check 6/6 comment 4581131319 + CI run 26670596589 issue_comment trigger second-run conclusion=success 10/10 step green (push-event first-run 26670536435 reviewer-gate race fail expected → issue_comment second-run authority 정합 — race-pattern 15+ 회차 누적 backbone). **single-shot first-run pass cadence 8 회차 누적** (T-0086 + T-0087 within-round 2 fix + T-0090 + T-0091 + T-0092 + T-0094 + T-0095 + 본 T-0099). **size variance ×2.53 7 회차 누적** (T-0083/T-0086/T-0087/T-0091/T-0094/T-0095/T-0099) — R-112 spec mass underestimate 패턴 박제. **CI step 'reviewer agent approval 검증' 자동 게이트 박제 17 회차 누적** (T-0066~T-0099). counters.tasksCompleted 97→98, mostRecentTasks prepend T-0099 (cap 5 = [T-0099, T-0098, T-0097, T-0096, T-0095]), reviewRounds[T-0099]=1. **User CRUD-R 표면 첫 박제 완결** — POST signup (T-0092) + GET list (본 T-0099) + PATCH changeRole (T-0087) production endpoint chain 3/4 closed (GET /:id detail 만 미박제 — follow-up). **core.autocrlf=false local config 부산물** — Windows 기본 autocrlf=true 의 prettier entire-repo CRLF errors 차단 위해 executor 가 변경, follow-up: .gitattributes `* text=auto eol=lf` 박제 (doc-only direct task) 로 미래 contributor trap 방지."
---

# T-0099 — GET /api/users list endpoint (Admin+ tier) + UserResponseDto.fromEntities 배열 helper + e2e

## Why

[T-0095](T-0095-user-response-dto-hashed-password-removal.md) (MERGED `d842d35` PR-89) 의 **§Out of Scope L122 박제 follow-up** — `fromEntities(users: User[]): UserResponseDto[]` 배열 helper 가 "GET /api/users list endpoint 박제 시점에 도입 (별도 task)" 으로 자연 progression 박제. 본 task 가 그 박제점.

User CRUD 표면 중 **read-list 만 미박제** — POST (T-0092 박제) / PATCH (T-0087 박제) 는 production endpoint, GET list/detail 는 부재. 본 task 가 GET list 박제 → CRUD-R 표면 첫 박제점. detail (`GET /api/users/:id`) 은 별도 follow-up (Out of Scope).

**RBAC tier 결정 — Admin+** (Admin / SuperAdmin 만 통과). 근거:
1. User list 는 **privileged data** — email + role + 등록 시각 5 컬럼 모두 administrative view. 일반 User 가 다른 user 목록을 조회할 정상적 use case 0 (REQ-046 User read-only 는 본인 데이터 한정 의미가 자연 — 본 endpoint 의 "다른 user" 조회 분기는 Admin+ 책임).
2. [api.md L33-35 RBAC tier table](../architecture/api.md) — Admin tier 의 정의 "관리자 — 평가 master data / 사용자·시스템 설정". User 관리 = Admin 의 정공법.
3. `@Roles("Admin")` + RolesGuard 의 `ROLE_HIERARCHY.SuperAdmin: ["SuperAdmin", "Admin", "User"] / Admin: ["Admin", "User"]` (T-0083 박제) → Admin 명시 시 SuperAdmin 도 자동 통과. User → 403.
4. **RBAC backbone 의 두 번째 production 사용 사례** — T-0087 (SuperAdmin 단일) 이후 첫 Admin+ tier 적용. RBAC 4 layer (JwtAuthGuard + RolesGuard + @Roles + escalation hierarchy) 의 **escalation 매핑 자체** 가 첫 활용. T-0087 은 SuperAdmin literal match 만, 본 task 는 hierarchy descent 분기 (SuperAdmin actor 통과) 검증 박제.

**hashedPassword 응답 누출 차단** — list 도 동일 위험. UserResponseDto.fromEntities 가 단일 진입점. T-0095 의 fromEntity 정공법 1:1 mirror (배열 wrap 만 추가).

[CLAUDE.md §3.2 R-112](../../CLAUDE.md) — UserRepository.findAll / UserService.findAll / UserController.list / UserResponseDto.fromEntities 4 신규 public symbol → happy / error / branch / negative 4 카테고리 cover 의무. 특히 **negative cases 충분 cover** — Admin+ guard 의 401 (cookie 부재) / 403 (User role / Public role 등) / hashedPassword 누출 차단 / 빈 list 분기 / 다중 row 정합 분기 모두 cover.

[docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — **partial-backbone × 1.3 multiplier** (단일 신규 endpoint + 배열 helper + Admin+ RBAC + e2e regression — full R-112 4 카테고리 backbone 이 아닌 partial — repository / service 의 단순 raw forward, RBAC 분기는 기존 backbone 재활용). base 200 LOC × 1.3 = 260 LOC / 5 파일 envelope.

## Required Reading

- [src/user/user.controller.ts](../../src/user/user.controller.ts) — UserController 박제 (signup L155-165, changeRole L118-137). Admin+ tier 신규 endpoint 추가 시 기존 controller 의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("...")` decorator stack 1:1 mirror.
- [src/user/user.service.ts](../../src/user/user.service.ts) — UserService 박제. findAll 메서드 추가 책임. 도메인 invariant 0 — 단순 raw forward 패턴 (GroupService.findAll L101-106 정공법 정합).
- [src/user/user.repository.ts](../../src/user/user.repository.ts) — UserRepository 박제 (현재 5 메서드: create / findByEmail / findById / updateRole / countAll). findAll 메서드 추가. GroupRepository.findMany (L66-70) 정공법 1:1 mirror.
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — UserResponseDto 박제 (private constructor + fromEntity static factory + 5 readonly 필드). fromEntities 배열 helper 추가 책임 (단순 `.map(fromEntity)` wrap).
- [src/user/dto/user-response.dto.spec.ts](../../src/user/dto/user-response.dto.spec.ts) — 기존 8 it 박제 reference. fromEntities 의 happy / branch / negative 추가 it 박제 (≥ 4 it 추가).
- [src/user/user.controller.spec.ts](../../src/user/user.controller.spec.ts) — 기존 signup 5 it + changeRole 22 it + UserResponseDto regression 4 it 박제. list endpoint 의 happy / error / negative 추가 it 박제 (≥ 6 it 추가).
- [src/user/user.service.spec.ts](../../src/user/user.service.spec.ts) — UserService spec 박제 reference. findAll 의 happy / branch (빈 list) / negative (repository throw propagate) 추가 it 박제 (≥ 4 it 추가).
- [src/user/user.repository.spec.ts](../../src/user/user.repository.spec.ts) — UserRepository spec 박제 reference. findAll 의 prisma.user.findMany 위임 검증 it 추가 (≥ 2 it 추가).
- [src/user/group.controller.ts L88-95](../../src/user/group.controller.ts) — GroupController.findAll 정공법 reference (`@Get()` + service raw forward). 본 task 의 UserController.list 패턴 source.
- [src/user/group.service.ts L101-106](../../src/user/group.service.ts) — GroupService.findAll 정공법 reference (repository raw forward).
- [src/user/group.repository.ts L66-70](../../src/user/group.repository.ts) — GroupRepository.findMany 정공법 reference (prisma raw forward).
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — ROLE_HIERARCHY 박제 (`Admin: ["Admin", "User"]` 매핑 — Admin 명시 시 SuperAdmin actor 자동 통과 검증 source).
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — @Roles decorator 박제 reference.
- [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) — 기존 e2e 박제 (signup 4 it + changeRole 7 it + UserResponseDto regression). list endpoint 의 happy / error / negative e2e 추가 it 박제 (≥ 7 it 추가).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — createAuthenticatedE2EApp + buildAuthCookie 박제 (T-0091). 본 task 의 e2e seed 다중 user (Admin actor + User actor + 추가 seed users) 박제 source.
- [docs/architecture/api.md L33-35 RBAC tier table + L65-72 UC-04 row 박제](../architecture/api.md) — Admin tier 정의 + 기존 user endpoint row 정합. GET /api/users row 추가는 별도 doc-only direct follow-up (Out of Scope, T-0100 candidate × 0.64 multiplier).
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — User entity password 컬럼 application-layer 보호 박제 reference (본 task 가 list endpoint 에서도 동일 보호 박제).
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — partial-backbone × 1.3 multiplier 적용 (단일 신규 endpoint + 배열 helper + RBAC tier 분기 + e2e regression).

## Acceptance Criteria

### A. `src/user/dto/user-response.dto.ts` 의 fromEntities 배열 helper 추가

- [ ] [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) 에 `static fromEntities(users: User[]): UserResponseDto[]` 메서드 추가. 단순 `users.map((u) => UserResponseDto.fromEntity(u))` 박제 — fromEntity 의 single-entity 변환 1:1 wrap.
- [ ] 한국어 주석 ≥ 10 줄 — fromEntity 와의 책임 분리 (single → array wrap), GET /api/users list endpoint 의 응답 mapping source 박제 (T-0099 cross-ref), hashedPassword 차단 invariant 가 자동 propagate (fromEntity 의 whitelist 정합 reuse), 빈 배열 input → 빈 배열 output 분기 명시 (throw 0), Out of Scope (pagination / sorting / cursor 등은 본 helper scope 0 — service / controller layer 책임).

### B. `src/user/dto/user-response.dto.spec.ts` 의 fromEntities 추가 it (≥ 4 it)

- [ ] **happy — fromEntities 정상 배열 변환**: 3 user row 배열 → 3 DTO 배열, 각 DTO 의 5 필드 정합 + hashedPassword 키 부재.
- [ ] **branch — 빈 배열 input**: `[]` 입력 → `[]` 출력 (throw 0).
- [ ] **branch — 단일 element 배열**: 1 user 배열 → 1 DTO 배열, fromEntity single-entity 와 결과 정합.
- [ ] **negative — 다중 element 에서도 hashedPassword 누출 차단**: 3 user 모두 hashedPassword="hashed" 박제 → 결과 3 DTO 모두 `not.toHaveProperty("hashedPassword")` (regression — fromEntity 의 whitelist 가 array map 에서도 정합).

### C. `src/user/user.repository.ts` 의 findAll 메서드 추가

- [ ] [src/user/user.repository.ts](../../src/user/user.repository.ts) 에 `async findAll(): Promise<User[]>` 메서드 추가. 단순 `this.prisma.user.findMany()` 박제 — GroupRepository.findMany (L66-70) 1:1 mirror.
- [ ] 한국어 주석 ≥ 5 줄 — UserService.findAll 의 raw forward 책임, GET /api/users list endpoint 의 data source 박제 (T-0099 cross-ref), pagination / sorting / filtering 미지원 (Prisma default 순서 유지 — service / controller layer 결정 책임), 빈 list 분기 (prisma.user.findMany 는 항상 array 반환, throw 0).

### D. `src/user/user.repository.spec.ts` 의 findAll 추가 it (≥ 2 it)

- [ ] **happy — prisma.user.findMany 위임 검증**: mockPrisma.user.findMany 가 인자 없이 1회 호출 + 반환 user 배열이 결과로 propagate.
- [ ] **branch — 빈 배열 분기**: mockPrisma.user.findMany 가 `[]` 반환 → repository.findAll 결과 `[]` (raw forward, throw 0).

### E. `src/user/user.service.ts` 의 findAll 메서드 추가

- [ ] [src/user/user.service.ts](../../src/user/user.service.ts) 에 `async findAll(): Promise<User[]>` 메서드 추가. 단순 `this.userRepository.findAll()` 박제 — GroupService.findAll (L101-106) 1:1 mirror.
- [ ] 한국어 주석 ≥ 5 줄 — UserController.list 의 raw forward 책임, 도메인 invariant 0 (단순 조회), DTO 변환 책임 0 (controller layer 가 UserResponseDto.fromEntities 변환 — clean separation 정공법 정합), Prisma error 정책 (findMany 는 known error code 0 — raw propagate, NestJS default 500), pagination / sorting 미지원.

### F. `src/user/user.service.spec.ts` 의 findAll 추가 it (≥ 4 it)

- [ ] **happy — repository.findAll 결과 raw forward**: mockRepository.findAll → 3 user 배열 → service.findAll 결과 3 user 배열 정합.
- [ ] **happy — 결과 reference 동일성**: service 가 transform 0 — repository 반환 그대로 통과 (`expect(result).toBe(repoResult)` 또는 element-wise toEqual).
- [ ] **branch — 빈 list 분기**: mockRepository.findAll → `[]` → service.findAll → `[]` (throw 0).
- [ ] **negative — repository throw propagate**: mockRepository.findAll → `throw new Error("db down")` → service.findAll 가 동일 error throw (catch 0 — raw propagate, NestJS default 500 자동 mapping).

### G. `src/user/user.controller.ts` 의 list endpoint 추가

- [ ] [src/user/user.controller.ts](../../src/user/user.controller.ts) 에 `@Get()` list endpoint 추가:
  - method signature: `async list(): Promise<UserResponseDto[]>`.
  - decorator stack (위 → 아래): `@Get()` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
  - body: `const users = await this.userService.findAll(); return UserResponseDto.fromEntities(users);`.
  - import 추가 0 (UserResponseDto / JwtAuthGuard / RolesGuard / Roles / Get 모두 기존 import — `@Get` 만 `@nestjs/common` import 추가).
- [ ] 한국어 주석 ≥ 15 줄 (changeRole / signup 주석 패턴 1:1 mirror) — Admin+ tier 박제 근거 (RolesGuard ROLE_HIERARCHY 의 Admin: ["Admin", "User"] → SuperAdmin 자동 통과 + Admin literal match + User → 403), UserResponseDto.fromEntities 매핑 박제 (hashedPassword 차단 invariant 자동 propagate), pagination / sorting / filtering 미지원 (Out of Scope — 향후 별도 task), service-layer 의 raw forward 책임 + DTO 변환 controller 단일 책임 (clean separation 정공법), RBAC backbone 의 두 번째 production 적용 endpoint (T-0087 SuperAdmin 단일 이후 첫 Admin+ tier 적용 — escalation hierarchy descent 첫 production 활용).

### H. `src/user/user.controller.spec.ts` 의 list 추가 it (≥ 6 it)

- [ ] **happy — list 응답이 UserResponseDto[] 배열**: mockService.findAll → 3 user 배열 → controller.list 결과가 3 DTO 배열, 각 DTO 의 5 필드 정합 (id / email / role / createdAt / updatedAt) + 각 DTO 의 hashedPassword 키 부재.
- [ ] **happy — 빈 list 분기**: mockService.findAll → `[]` → controller.list 결과 `[]` (throw 0).
- [ ] **negative — list 응답에 hashedPassword 키 부재**: mockService.findAll → 3 user 모두 hashedPassword="$2b$10$..." 박제 → controller.list 결과 3 DTO 모두 `not.toHaveProperty("hashedPassword")` (regression — 본 task 의 핵심 보호 + T-0095 의 fromEntity whitelist 가 array map 에서도 정합).
- [ ] **negative — list 응답 instance 검증**: controller.list 결과의 각 element 가 `UserResponseDto` instance + 추가 컬럼 (예: 가상의 `extraField`) 부재.
- [ ] **branch — 다중 role mix**: mockService.findAll → user 3 명 (role="SuperAdmin" + role="Admin" + role="User") 박제 → controller.list 결과 3 DTO 의 role 필드 정합 (escalation hierarchy 박제 0 — controller 는 list 변환만, RBAC 검증은 Guard layer).
- [ ] **negative — service throw propagate**: mockService.findAll → `throw new Error("svc down")` → controller.list 가 동일 error throw (catch 0 — raw propagate).

### I. `test/e2e/users.e2e-spec.ts` 의 list e2e 추가 it (≥ 7 it)

- [ ] **happy — Admin actor 가 list 호출 성공 (200 + UserResponseDto[] body)**: seed 4 user (admin actor + 3 추가 user) → admin token cookie 로 `GET /api/users` → 200 + body 가 4 element 배열 + 각 element 의 5 필드 (id / email / role / createdAt / updatedAt) 정합 + 각 element 의 hashedPassword 키 부재.
- [ ] **happy — SuperAdmin actor 가 list 호출 성공 (escalation hierarchy 박제)**: seed superadmin actor + 추가 user → superadmin token → 200 (RBAC ROLE_HIERARCHY 의 SuperAdmin ⊇ Admin 검증 — RBAC backbone 의 escalation descent 첫 e2e 박제).
- [ ] **happy — 빈 list 분기는 적용 불가 명시**: e2e 의 seed 가 ≥ 1 user (actor) 박제하므로 빈 list 분기는 unit spec 만. 본 e2e 항목 명시 skip (`it.skip("빈 list 분기는 unit spec 박제", ...)` 또는 description 만 박제).
- [ ] **negative — cookie 부재 시 401**: cookie 미동반 `GET /api/users` → 401 + body 가 user 데이터 부재 (e2e 의 unauthenticated path).
- [ ] **negative — invalid cookie 시 401**: 임의 invalid JWT cookie → 401 (JwtAuthGuard reject).
- [ ] **negative — User role actor → 403**: seed user (role="User") + user token cookie → `GET /api/users` → 403 (RolesGuard reject — Admin tier 미달).
- [ ] **negative — list 응답에 hashedPassword 키 부재 (e2e regression)**: 모든 happy it 의 body element 에 `expect(element).not.toHaveProperty("hashedPassword")` 박제 + body shape 가 `["createdAt", "email", "id", "role", "updatedAt"]` 5 키만 포함 (e2e 의 round-trip JSON 직렬화 정합 검증 — T-0095 의 round-trip 패턴 1:1 mirror).

### J. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — user-response.dto.ts (fromEntities) + user.repository.ts (findAll) + user.service.ts (findAll) + user.controller.ts (list) 신규 surface 모두 line ≥ 80% AND function ≥ 80%. 신규 4 public symbol 100% cover 의무.
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음.
- [ ] `pnpm test:e2e` 통과 — users.e2e-spec.ts 전체 (기존 signup 4 + changeRole 7 + UserResponseDto regression + 본 task 의 list 추가 ≥ 7 it = 총 ≥ 18 it) 모두 green + auth.e2e-spec.ts + persons / groups / parts e2e 모두 green (regression 0).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **GET /api/users/:id (single user detail) endpoint** — read-detail 표면은 본 task 0. 별도 follow-up (T-0101 candidate). RBAC tier 결정 별도 (User self-read vs Admin+ other-read 분기 + decorator 분기 필요).
- **pagination (page / pageSize) / sorting (orderBy) / filtering (role / email substring) query param** — REST 표준 query parameter 박제는 별도 task. Prisma findMany 의 skip/take/orderBy/where 정공법 reference. 본 task 는 단순 raw findMany 만.
- **응답 envelope (`{ data: [...], meta: { total, page, ... } }`) 표준화** — pagination 도입 시점에 같이. 본 task 는 raw array 만 (GroupController.findAll / PartController.findAll / PersonController.findActive 정공법 1:1 mirror).
- **api.md L65-72 UC-04 row 의 GET /api/users 추가 박제** — doc-only direct follow-up (T-0100 candidate × 0.64 inline-amend multiplier).
- **modules.md L48 UserModule row description 갱신** — list endpoint 추가 박제. doc-only direct follow-up.
- **UC-04 §5 sequence diagram 의 list flow 추가** — use-case spec 정합. doc-only direct follow-up (T-0097 정공법 mirror).
- **다른 entity (Person / Group / Part) 의 ResponseDto 추출 + list 응답 변환** — Person / Group / Part 는 hashedPassword 같은 민감 컬럼 0 — 일반화 추출은 2+ entity 동일 패턴 출현 시점 / 별도 ADR.
- **ClassSerializerInterceptor 도입 (NestJS 전역 직렬화 전략)** — 별도 ADR (T-0095 follow-up 박제). 본 task 는 단순 static factory 패턴 유지.
- **RefreshToken DB table + revocation (ADR-0008 §6 후속 chain)** — 별도 task.
- **GET /api/users 의 actor self-info 검증** — self 의 데이터 만 노출 / 다른 user 의 hashedPassword 외 필드 추가 차단 등의 fine-grained access control. 별도 ADR.
- **RBAC backbone 의 Admin 명시 시 escalation hierarchy descent (SuperAdmin 자동 통과) 의 ADR-0008 §RBAC 별도 박제** — 본 task 가 첫 production 사용 사례, 박제 자체는 ADR-0008 §RBAC 또는 별도 ADR 후속 follow-up.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — RBAC tier 결정 (Admin+) 은 본 task §Why 의 inline 박제 + api.md L33-35 + roles.guard.ts ROLE_HIERARCHY 박제 source 로 결정, 신규 ADR 0. 패턴은 GroupController.findAll / GroupService.findAll / GroupRepository.findMany / UserResponseDto.fromEntity 4 precedent 1:1 mirror — 새 결정 0).

## Follow-ups

- **T-0100 candidate** — api.md L65-72 UC-04 row 의 GET /api/users 추가 + L33-35 tier table 의 Admin tier example 갱신 + RBAC backbone 의 escalation hierarchy descent 첫 production 박제 cross-ref. doc-only direct inline-amend × 0.64.
- **modules.md L48 UserModule row description 갱신** — list endpoint 추가 박제. doc-only direct.
- **UC-04 §5 sequence diagram 의 list flow 추가** — doc-only direct (T-0097 정공법 mirror).
- **T-0101 candidate** — GET /api/users/:id (single user detail) endpoint. RBAC tier 결정 별도 (User self-read vs Admin+ other-read).
- **pagination / sorting / filtering query param 도입** — REST 표준 query parameter + 응답 envelope 표준화. 별도 task / ADR.
- **다른 entity (Person / Group / Part) 의 ResponseDto 일반화 추출** — 2+ entity 의 동일 패턴 출현 시점에 별도 task.
- **ClassSerializerInterceptor 도입 ADR** — 전역 직렬화 전략 박제 시 본 fromEntities 패턴의 위상 재검토.
- **cron env permanent fix ADR** (HQ-0006/8/9/10/13 5+ 회차 systemic) — install-gh-cli-in-cron-env / adapt-agents-to-mcp / cron driver "doc-only 만 진행" 분기 / cron stale PR 자동 cleanup hook 4 options trade-off + 결정 + chain. T-0098 reactive cleanup 의 permanent fix.
- **race-patterns.md phantom worktree + MSYS path translation 박제 amend** — T-0097 / T-0098 박제 데이터. doc-only direct × 0.64.
- **estimate-model.md milestone refinement** — 본 task 의 partial-backbone × 1.3 (단일 신규 endpoint + 배열 helper + RBAC Admin+ tier 분기 + e2e regression) variance 박제 데이터 추가.
- **RBAC backbone 의 Admin 명시 시 escalation hierarchy descent ADR-0008 §RBAC 별도 박제** — 본 task 의 escalation descent 첫 production 사용 사례 → ADR 박제 follow-up.
