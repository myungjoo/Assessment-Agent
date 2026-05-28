---
id: T-0086
title: UserService 신설 + changeRole + REQ-044 self-demote invariant + colocated spec
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-044]
estimatedDiff: 260
estimatedFiles: 3
dependsOn: [T-0085, T-0083]
created: 2026-05-29
plannerNote: "session #25 turn 7 — T-0085 머지 후 RBAC 첫 production 사용 사례 chain 의 service layer. partial-backbone × 1.3, ~200 base × 1.3 = ~260 LOC."
---

# T-0086 — UserService 신설 + changeRole + REQ-044 self-demote invariant + colocated spec

## Why

[T-0085](T-0085-user-repository-find-by-id-and-update-role.md) (MERGED f14d6b3) 가 UserRepository.findById + updateRole 2 메서드를 박제 → RBAC 첫 production 사용 사례 chain 의 **service layer 진입점**. README REQ-044 ([README.md L84](../../README.md)) — *"Admin→User 변경은 첫 로긴 Admin (= SuperAdmin) 만 수행할 수 있고, 본인에 대해서는 Admin→User 를 할 수 없다"* invariant 가 본 task 의 핵심 박제 대상. service layer 가 actor 권한 검증 (SuperAdmin 외 reject) + self-demote 차단 (actor === target && target 의 현재 role 이 SuperAdmin/Admin 인데 newRole 이 더 낮은 권한일 때) + target user 부재 변환 (P2025 → NotFoundException) 의 3 invariant 책임.

본 task 는 [T-0085 §Follow-ups](T-0085-user-repository-find-by-id-and-update-role.md) 의 **T-0086 candidate** 정의를 그대로 박제 — UserService 신설 + changeRole(actorUserId, targetUserId, newRole) 메서드 + colocated spec R-112 4 카테고리 + negative cases 충분 cover. PersonService / GroupService 의 partial-backbone × 1.3 multiplier precedent (T-0036 / T-0050 / T-0067 단일 layer 확장) 정공법 정합.

UserModule 의 providers/exports 배열에 UserService 등록도 본 task scope — 후속 T-0087 candidate (UserController + ChangeRoleDto + PATCH /api/users/:id/role + e2e) 가 UserService inject 가능하도록.

## Required Reading

- [src/user/user.repository.ts](../../src/user/user.repository.ts) — UserRepository (T-0085 박제). findById + updateRole 2 메서드의 시그니처 + null-safe / P2025 propagate 분기 정책. 본 task 의 service 가 forward 대상.
- [src/user/user.repository.spec.ts](../../src/user/user.repository.spec.ts) — UserRepository spec (T-0085 박제). Prisma mock forwarding 검증 패턴. 본 task spec 의 PrismaService mock 패턴 reference 0 — UserRepository mock 으로 충분.
- [src/user/group.service.ts](../../src/user/group.service.ts) — GroupService precedent. `getPrismaErrorCode` helper + try/catch P2025 → NotFoundException 변환 + 4 CRUD primitive 위의 service-layer 의미 부여 패턴. 본 task 정공법 정합.
- [src/user/group.service.spec.ts](../../src/user/group.service.spec.ts) — GroupService spec precedent. repository mock + R-112 4 카테고리 + negative cases 충분 cover 패턴 reference.
- [src/user/person.service.ts](../../src/user/person.service.ts) L60-130 — PersonService precedent (T-0036 / T-0037). `findById` 의 null → NotFoundException 변환 + `update` 의 P2025 / P2002 두 분기 처리 패턴. 본 task 의 changeRole 이 P2025 만 cover (User.role 은 `@unique` 미정의).
- [src/user/user.module.ts](../../src/user/user.module.ts) — UserModule. providers / exports 배열에 UserService 등록 대상. T-0082 의 UserRepository 등록 패턴 mirror.
- [src/user/user.module.spec.ts](../../src/user/user.module.spec.ts) — UserModule spec. 본 task 가 UserService 의 provider resolution test 1 it 추가.
- [README.md L84](../../README.md) — REQ-044 본문. *"첫 로긴 SuperAdmin / 3 등급 / Admin→User 는 SuperAdmin 만 / 본인 self-demote 금지"* 4 invariant 박제 출처.
- [prisma/schema.prisma](../../prisma/schema.prisma) — User model 의 role 컬럼 (String, `@unique` 미정의). 본 task 의 invariant 검증은 service-layer 책임, schema 차원 0.
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT in HttpOnly cookie + role claim 박제. 본 task 의 changeRole 후 token rotation 시점에 role 변경 propagate 의 source 의미.
- [CLAUDE.md §3.2 R-112](../../CLAUDE.md) — happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80%.
- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §4 — partial-backbone × 1.3 multiplier (T-0036 / T-0050 / T-0067 / T-0085 precedent) 분류 + sub-multiplier 정합.

## Acceptance Criteria

### A. UserService 신설

- [ ] [src/user/user.service.ts](../../src/user/user.service.ts) 신설. `@Injectable()` decorator + `UserRepository` 1 collaborator constructor 주입.
- [ ] 파일 상단 한국어 주석 5-10 줄 — 책임 / Out of Scope / Prisma error 정책 / REQ-044 invariant 박제. GroupService 정공법 정합.
- [ ] role 값 enum union 박제 — `export type UserRole = "SuperAdmin" | "Admin" | "User"` (TypeScript-level literal union, schema.prisma 의 String 컬럼과 호환). 향후 enum 전환 ADR 후보 박제 (Out of Scope §).

### B. UserService.changeRole 메서드

- [ ] `async changeRole(actorUserId: string, targetUserId: string, newRole: string): Promise<User>` signature 박제.
- [ ] **invariant 1 — actor 권한 검증**: actorUserId 로 UserRepository.findById 호출 → null 시 `UnauthorizedException` 발화. row 의 role 이 `"SuperAdmin"` 이 아니면 `ForbiddenException("only SuperAdmin can change user role")` 발화. README L84 의 "Admin→User 변경은 첫 로긴 Admin (= SuperAdmin) 만" 박제.
- [ ] **invariant 2 — newRole 값 검증**: newRole 이 `"SuperAdmin"` / `"Admin"` / `"User"` 외이면 `BadRequestException("invalid role: <newRole>")` 발화. UserRole union 정합.
- [ ] **invariant 3 — target user lookup**: targetUserId 로 UserRepository.findById 호출 → null 시 `NotFoundException("user not found: <id>")` 발화.
- [ ] **invariant 4 — self-demote 차단**: `actorUserId === targetUserId && newRole !== "SuperAdmin"` 분기에서 `ForbiddenException("self-demote is not allowed")` 발화. README L84 "본인에 대해서는 Admin→User 를 할 수 없다" 박제. (SuperAdmin 이 자기 role 을 SuperAdmin 으로 재지정하는 noop 은 허용.)
- [ ] **invariant 5 — actor role propagate**: 위 4 invariant 모두 통과 후 `UserRepository.updateRole(targetUserId, newRole)` 호출 → 결과 User 반환. P2025 → `NotFoundException` 변환 (race window 의 target 부재 case).
- [ ] 메서드 직전 한국어 주석 2-4 줄 — REQ-044 5 invariant 명시 + race window 박제.

### C. UserModule wiring

- [ ] [src/user/user.module.ts](../../src/user/user.module.ts) 의 `providers` 배열에 `UserService` 추가 + `exports` 배열에 `UserService` 추가 (후속 T-0087 candidate 의 UserController inject).
- [ ] module 주석 추가 1-2 줄 — "T-0086 추가 — UserService 등록. UserController (T-0087 candidate) 또는 후속 module 이 inject 가능".

### D. UserService colocated spec — R-112 4 카테고리

- [ ] [src/user/user.service.spec.ts](../../src/user/user.service.spec.ts) 신설 (colocated). `UserRepository` 를 jest mock 으로 대체 (`provide: UserRepository, useValue: { findById: jest.fn(), updateRole: jest.fn() }` 패턴). GroupService.spec 정공법 정합.
- [ ] `describe("changeRole()", ...)` block. 다음 it 12+ (5 invariant × 2-3 분기 cover):
  - **happy (1+)** — SuperAdmin actor 가 다른 user 의 role 을 변경 시 UserRepository.updateRole 호출 + 결과 반환.
  - **branch — role 값 변종 3 종** — newRole = "SuperAdmin" / "Admin" / "User" 각각 happy forwarding.
  - **error path — actor 부재** — actorUserId 로 findById null → `UnauthorizedException`.
  - **error path — actor role 부족** — actor role = "Admin" / "User" 각각 `ForbiddenException` ("only SuperAdmin can change user role").
  - **error path — newRole invalid** — newRole = "Owner" / 빈 문자열 / "user" (소문자) → `BadRequestException`.
  - **error path — target 부재** — actorUserId 통과 후 targetUserId 로 findById null → `NotFoundException`.
  - **negative — self-demote 분기 ("Admin" 시도)** — actorUserId === targetUserId && newRole = "Admin" → `ForbiddenException` ("self-demote is not allowed").
  - **negative — self-demote 분기 ("User" 시도)** — actorUserId === targetUserId && newRole = "User" → `ForbiddenException`.
  - **negative — self noop 허용** — actorUserId === targetUserId && newRole = "SuperAdmin" → 정상 처리 (self-demote 차단 분기 false, updateRole 호출).
  - **error path — P2025 propagate** — UserRepository.updateRole 가 `Object.assign(new Error(), { code: "P2025" })` throw → `NotFoundException` 변환.
  - **negative — generic error propagate** — UserRepository.updateRole 가 generic Error throw → 그대로 propagate (try/catch P2025 만 cover, 그 외 raw forward).

### E. UserModule spec — UserService 등록 검증

- [ ] [src/user/user.module.spec.ts](../../src/user/user.module.spec.ts) 에 `it("provides UserService", ...)` 1 it 추가. NestJS TestingModule 로 UserService resolve 확인. T-0082 의 UserRepository resolve 테스트 패턴 mirror.

### F. CI / 4-게이트

- [ ] `pnpm lint` + `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — UserService 의 line ≥ 80% AND function ≥ 80% 강제 충족. 신규 service 의 모든 분기 cover 로 100% 목표.
- [ ] `pnpm test:smoke` + `pnpm test:e2e` 통과 (본 task production behavior 변경 0 — endpoint 신설 0, service 만 박제).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **UserController + ChangeRoleDto + PATCH /api/users/:id/role endpoint + e2e + @Roles("SuperAdmin")** — **T-0087 candidate** (별도 task). HTTP-facing layer + RBAC 첫 endpoint production 사용 사례 박제. 본 task 는 service layer 만.
- **api.md §5 의 PATCH /api/users/:id/role row amend** — T-0087 머지 후 별도 doc-only direct task (T-0088 candidate).
- **첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반)** — register/signup endpoint 박제 시점 (T-0089+ candidate). UserService.create 또는 별도 메서드의 책임. 본 task scope 외.
- **role enum schema 전환** — schema.prisma 의 User.role 컬럼 String → Prisma enum 또는 TypeScript union strict 박제 검토. 본 task 는 TypeScript literal union 만 (`UserRole` type alias). 별도 ADR 후보.
- **Admin → SuperAdmin 승급 invariant** — README L84 의 "Admin 권한 사용자는 User→Admin 승급" 박제. 본 task 의 invariant 1 (only SuperAdmin can change role) 와 충돌 — Admin 의 승급 권한 분기는 별도 task / ADR 분리.
- **JwtAuthGuard + RolesGuard 적용 endpoint 박제** — T-0087 candidate 의 controller layer 책임. 본 task 는 service layer 만, actor user id 는 임의 input.
- **UserRepository 의 추가 메서드 (delete / list / softDelete 등)** — README REQ 미박제 / consumption-driven 정책 외. 본 task scope 외.
- **AuthService.issueAccessToken role rotation 호출** — changeRole 후 자동 token refresh 박제는 별도 task (refresh endpoint 와 동기). 본 task 는 service-layer 의 invariant + repository forwarding 만.
- **PersistenceModule 직접 의존** — 본 service 는 UserRepository 만 inject (PersonService 의 PrismaService 직접 inject 패턴 mirror 0 — hard delete 같은 repository 우회 케이스 부재).

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0, GroupService / PersonService precedent 정공법 정합 — 신규 설계 결정 0, REQ-044 invariant 는 README L84 명시).

## Follow-ups

- **T-0087 candidate** — UserController 신설 + ChangeRoleDto + PATCH /api/users/:id/role endpoint + @Roles("SuperAdmin") + @UseGuards(JwtAuthGuard, RolesGuard) 박제 (RBAC 첫 production endpoint) + colocated spec R-112 4 카테고리 + e2e (auth cookie + 200 happy + 401 unauth + 403 self-demote + 403 actor=User). ~280-350 LOC, R-112 backbone × 1.5 + e2e 동반으로 sizeExempt 후보.
- **T-0088 candidate** — api.md §5 의 PATCH /api/users/:id/role row 박제 (RBAC 첫 적용 endpoint contract 박제) + modules.md UserModule row 갱신 (UserService 박제 cross-reference). doc-only direct, ~30-50 LOC.
- **T-0089 candidate** — POST /api/users (signup) + 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반). UserService.create + DTO + endpoint + spec + e2e. SuperAdmin 0 명 상태에서만 user creation 자동 SuperAdmin role 부여 invariant.
- **Admin 의 User→Admin 승급 분기** — README L84 의 후반 "Admin 권한 사용자는 User→Admin 승급" 박제. 본 task 의 invariant 1 (only SuperAdmin) 와 충돌 정합 필요. 별도 service 메서드 (promoteToAdmin) 또는 changeRole 의 분기 확장 ADR 박제.
- **role enum schema 전환 ADR** — schema.prisma 의 User.role String → Prisma enum 전환 검토. 본 task 의 TypeScript literal union 정합 + DB-level 강제 동시 박제.
- **getPrismaErrorCode helper 외화** — 본 service 가 GroupService / PartService / PersonService 와 동일 helper 중복 — 4 회차 누적. shared helper 모듈 외화 follow-up task 후보 (T-0050 §Follow-ups phase 2).
- **estimate-model.md 16 회차 milestone refinement** — 본 task 의 partial-backbone × 1.3 multiplier (single-layer 확장) variance 박제 + REQ-044 invariant 5 분기 cover 의 spec mass 박제 + UserRole union type 신설의 doc/code overhead 데이터.
- **ADR-0008 amend follow-up** — Consequences §6 의 RBAC backbone 실현 시점 박제 (T-0083 ~ T-0087 chain 완료 후 일괄 amend 가능).
