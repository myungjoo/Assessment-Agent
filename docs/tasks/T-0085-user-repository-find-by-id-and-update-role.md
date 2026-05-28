---
id: T-0085
title: UserRepository.findById + updateRole 2 메서드 추가 + spec — UserService.changeRole precursor
phase: P3
status: DONE
mergedAs: f14d6b3
prNumber: 78
reviewRounds: 1
completedAt: 2026-05-29T00:15:00+09:00
actualDiff: 200
actualFiles: 2
estimateOutcome: "+11% over (envelope 180 vs actual 200, partial-backbone × 1.3 multiplier within tolerance; round 0 single-shot 깨짐 — prettier lint fix 1 회 re-push 로 round 1 회복)"
commitMode: pr
coversReq: [REQ-044, REQ-045]
estimatedDiff: 180
estimatedFiles: 2
dependsOn: [T-0080, T-0083]
created: 2026-05-28
plannerNote: "session #25 turn 5 — T-0084 머지 후 UserService.changeRole chain split precursor (T-0086/T-0087 candidate). single-layer partial-backbone × 1.3, ~180 LOC cap-within."
---

# T-0085 — UserRepository.findById + updateRole 2 메서드 추가 + spec

## Why

[T-0083](T-0083-rbac-auth-guard-roles-decorator.md) (MERGED 6223fdd) 의 RBAC scaffold (JwtAuthGuard + @Roles + RolesGuard escalation 박제) + [T-0084](T-0084-api-md-auth-endpoints-amend.md) (MERGED 24b4436) 의 api.md contract 동기 박제 후, RBAC 의 **첫 production 사용 사례** 진입을 위한 자연 precursor. README REQ-044 ([README.md](../../README.md) L84) — **첫 로그인 SuperAdmin 자동 지정 + Admin→User 변경은 SuperAdmin 만 + 본인 self-demote 금지** invariant 박제가 P3 backbone 의 핵심 미박제 layer.

[UserRepository](../../src/user/user.repository.ts) ([T-0080](T-0080-user-entity-and-repository.md) 머지 박제) 는 현재 `create + findByEmail` 2 메서드만 박제 — AuthModule consumption-driven minimal surface ([T-0080 §scope](T-0080-user-entity-and-repository.md) 박제). UserService.changeRole 박제 (T-0086 candidate) 는 추가 repository 메서드 2 종에 의존: (1) **`findById(id: string): Promise<User | null>`** — changeRole target user lookup, (2) **`updateRole(id: string, role: string): Promise<User>`** — 실 update. 본 task 가 이 2 메서드를 repository-layer 에 박제 + spec 갱신.

본 task 가 **UserService.changeRole chain 의 split precursor** — chain 의 자연 boundary 가 layer 별 (repository → service → controller) 인 PersonRepository (T-0034) + PersonService (T-0036) + PersonController (T-0036) 의 precedent 정합. 본 task 는 repository layer 만 박제, T-0086 candidate 가 service layer (REQ-044 invariant), T-0087 candidate 가 controller layer (endpoint + DTO + e2e).

본 task 머지로 **entity backbone 11/11 (T-0083 머지 시점) 유지 + RBAC 첫 사용 사례 진입 path 박제 시작** — `@Roles("SuperAdmin")` 적용 첫 endpoint (T-0087 candidate) 가 본 layer 의존.

## Required Reading

- [src/user/user.repository.ts](../../src/user/user.repository.ts) — 본 task 의 amend target. 현재 create + findByEmail 2 메서드 박제 + UserCreateInput type. 본 task 가 2 메서드 추가 + 2 type 신설 가능 (UpdateRoleInput optional).
- [src/user/user.repository.spec.ts](../../src/user/user.repository.spec.ts) — 본 task 의 amend target. 현재 create + findByEmail 의 R-112 4 카테고리 spec 박제. 본 task 가 findById + updateRole 의 R-112 4 카테고리 spec 추가.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — repository precedent (T-0034). `findById` 의 null-safe API + Prisma findUnique forwarding 패턴 박제 정공법 정합.
- [src/user/person.repository.spec.ts](../../src/user/person.repository.spec.ts) — repository spec precedent (T-0034). R-112 4 카테고리 + Prisma mock forwarding 검증 패턴.
- [prisma/schema.prisma](../../prisma/schema.prisma) — User model L150-170 (id / email / hashedPassword / role / createdAt / updatedAt 6 컬럼). id 는 cuid (`@id @default(cuid())`), role 은 String (enum 미박제, "SuperAdmin"/"Admin"/"User" string literal — invariant 는 service-layer 책임).
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT in HttpOnly cookie + role claim 박제. 본 repository 의 updateRole 이 token rotation 시점에 role 변경 propagate 의 source 데이터.
- [docs/tasks/T-0080-user-entity-and-repository.md](T-0080-user-entity-and-repository.md) — UserRepository 신설 task. AuthModule consumption-driven minimal surface 박제 패턴 (CRUD-U full chain 의 자연 progression).
- [README.md L84](../../README.md) — REQ-044 self-demote 차단 invariant 본문. 본 task 의 repository layer 는 invariant 검증 0 — service layer (T-0086 candidate) 책임 분리.
- [src/user/group.repository.ts](../../src/user/group.repository.ts) L40-65 — update 메서드 precedent (T-0066). Prisma update forwarding + P2002 propagate 패턴.
- [CLAUDE.md §3.2 R-112](../../CLAUDE.md) — happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80%.

## Acceptance Criteria

### A. UserRepository.findById 메서드 추가

- [ ] [src/user/user.repository.ts](../../src/user/user.repository.ts) 에 `async findById(id: string): Promise<User | null>` 메서드 추가. `return this.prisma.user.findUnique({ where: { id } })` 1 줄 본문. PersonRepository.findById ([src/user/person.repository.ts](../../src/user/person.repository.ts)) 정공법 정합.
- [ ] null-safe API — row 부재 시 null 반환 (throw 0). findByEmail 패턴 mirror.
- [ ] 메서드 직전 한국어 주석 1-2 줄 — "본 task (T-0085) 추가, UserService.changeRole 의 target user lookup 책임" + "row 부재 시 null 반환 (throw 0), service-layer 가 NotFoundException 변환 책임".

### B. UserRepository.updateRole 메서드 추가

- [ ] [src/user/user.repository.ts](../../src/user/user.repository.ts) 에 `async updateRole(id: string, role: string): Promise<User>` 메서드 추가. `return this.prisma.user.update({ where: { id }, data: { role } })` 1 줄 본문. GroupRepository.update ([src/user/group.repository.ts](../../src/user/group.repository.ts)) 정공법 정합.
- [ ] role 값 invariant 검증 0 — service-layer (T-0086 candidate) 책임. 본 layer 는 string forwarding 만.
- [ ] Prisma `P2025` (record not found) 분기는 catch 0 — 그대로 propagate, service-layer 가 NotFoundException 변환 책임.
- [ ] 메서드 직전 한국어 주석 1-2 줄 — "본 task (T-0085) 추가, UserService.changeRole 의 실 update 책임" + "role 값 invariant (SuperAdmin/Admin/User) 검증은 service-layer, 본 layer 는 string forwarding 만, P2025 그대로 propagate".

### C. UpdateRoleInput type (선택)

- [ ] (선택) `export interface UserUpdateRoleInput { id: string; role: string }` type alias 추가. 단 single-call site (UserService.changeRole) 일 시 signature 가 단순하면 type 신설 생략 가능. 결정은 implementer 재량 — code clarity 우선.

### D. UserRepository spec — findById R-112 4 카테고리 추가

- [ ] [src/user/user.repository.spec.ts](../../src/user/user.repository.spec.ts) 에 `describe("findById()", ...)` block 추가. 다음 it 4+:
  - **happy** — id 로 호출 시 PrismaService.user.findUnique 의 `{ where: { id } }` 인자로 호출되고 fixture 그대로 반환.
  - **branch (found vs null)** — row 존재 시 fixture 반환 / 부재 시 null 반환 (throw 0).
  - **negative — empty id** — empty string id 로 호출 시 PrismaService 로 그대로 forwarding (input validation 은 service-layer 책임, repository 는 forward 만).
  - **negative — PrismaService reject propagate** — generic Error throw 시 그대로 propagate (catch 0 일반 보장).

### E. UserRepository spec — updateRole R-112 4 카테고리 추가

- [ ] [src/user/user.repository.spec.ts](../../src/user/user.repository.spec.ts) 에 `describe("updateRole()", ...)` block 추가. PrismaService mock 의 `user.update: jest.fn()` 추가 (buildPrismaMock 확장). 다음 it 4+:
  - **happy** — id + role 인자로 호출 시 PrismaService.user.update 의 `{ where: { id }, data: { role } }` 인자로 호출되고 fixture (role 갱신) 반환.
  - **branch (role 값 변종 3 종)** — role "SuperAdmin" / "Admin" / "User" 각각 happy forwarding (3 회 호출 + 인자 검증). T-0080 spec 의 create 패턴 mirror.
  - **error path — P2025 propagate** — Prisma 가 `P2025` (record not found) throw 시 그대로 propagate (catch 0 검증).
  - **negative — generic error propagate** — generic Error throw 시 그대로 propagate.
  - **negative — empty role string** — empty role string 으로 호출 시 PrismaService 로 그대로 forwarding (invariant 검증은 service-layer).

### F. CI / 4-게이트

- [ ] `pnpm lint` + `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — UserRepository 의 line ≥ 80% AND function ≥ 80% 강제 충족 (현재 100% 박제 유지). 본 task spec 추가로 coverage 변동 0 또는 상승.
- [ ] `pnpm test:smoke` + `pnpm test:e2e` 통과 (본 task 가 production behavior 변경 0, 신규 메서드는 spec 만 cover — smoke/e2e 변동 0).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **UserService 신설 + UserService.changeRole + REQ-044 self-demote invariant 분기** — **T-0086 candidate** (별도 task). 본 task 는 repository layer 만, service layer (invariant 검증 + actorUserId 와 targetUserId 비교 분기 + ForbiddenException 발화) 는 후속 task. **이유**: layer 별 split — repository 의 forward-only contract 와 service 의 invariant 검증을 한 task 로 묶으면 R-112 backbone × 1.5 cap-bend 가 필수 (~400-500 LOC), 작은 precursor 로 분리하여 review 부담 감소.
- **UserController + ChangeRoleDto + PATCH /api/users/:id/role endpoint + e2e** — **T-0087 candidate** (별도 task). HTTP-facing layer + @Roles("SuperAdmin") 적용 첫 endpoint 박제.
- **api.md §5 의 PATCH /api/users/:id/role row amend + REQ mapping** — T-0087 머지 후 별도 doc-only direct task (T-0088 candidate).
- **User entity 의 추가 메서드 (delete / list / softDelete 등)** — README REQ 미박제 / AuthModule consumption-driven 정책 외 surface. 후속 task chain 의 자연 progression — 본 task 박제 안 함.
- **role enum 값 검증 박제 (TypeScript union type `"SuperAdmin" | "Admin" | "User"` 또는 Prisma enum)** — schema.prisma 의 User.role 컬럼이 현재 String — enum 박제 검토는 별도 ADR / task. 본 task 는 string forwarding 만.
- **첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반)** — register/signup endpoint 박제 시점 (T-0089+ candidate). 본 task scope 외.
- **JwtAuthGuard + RolesGuard 적용 첫 endpoint precedent (GET /api/auth/me)** — T-0085 alternative candidate, 본 task chain 과 독립. UserService.changeRole chain 이 RBAC 첫 production 사용 사례로 자연 우선.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0, 기존 repository precedent 정공법 정합 — 신규 결정 0).

## Follow-ups

- **T-0086 candidate** — UserService 신설 + UserService.changeRole(actorUserId, targetUserId, newRole) + REQ-044 self-demote invariant (actorUserId === targetUserId && newRole !== "SuperAdmin" 분기 차단 + ForbiddenException) + colocated spec R-112 4 카테고리 + negative cases 충분 cover (self-demote / target 부재 / role 값 unknown / actor role 부족 등 4+ negative). ~250-300 LOC, cap-within 또는 sizeExempt × 1.3 partial-backbone.
- **T-0087 candidate** — UserController 신설 + ChangeRoleDto + PATCH /api/users/:id/role endpoint + @Roles("SuperAdmin") + @UseGuards(JwtAuthGuard, RolesGuard) 박제 (RBAC 첫 production 사용 사례) + colocated spec R-112 4 카테고리 + e2e (auth cookie + 200 happy + 401 unauth + 403 self-demote + 403 actor=User). ~280-350 LOC, sizeExempt × 1.5 backbone candidate.
- **T-0088 candidate** — api.md §5 의 PATCH /api/users/:id/role row 박제 (RBAC 첫 적용 endpoint contract 박제) + modules.md UserModule row 갱신 (UserService / UserController 박제 cross-reference). doc-only direct, ~30-50 LOC.
- **T-0089 candidate** — POST /api/users (signup) + 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반). UserService.create + DTO + endpoint + spec + e2e. SuperAdmin 0 명 상태에서만 user creation 자동 SuperAdmin role 부여 invariant.
- **estimate-model.md 16 회차 milestone refinement** — 본 task 의 partial-backbone × 1.3 multiplier (single-layer 확장) variance 박제 + R-112 backbone × 1.5 (T-0083 4-surface) 와의 비교 데이터 + sub-multiplier 분류 정밀화.
- **role enum invariant ADR 후보** — schema.prisma 의 User.role String → enum 전환 검토 (Prisma enum vs TypeScript union 만). 결정 시점은 SuperAdmin 자동 지정 박제 (T-0089) 후 자연.
- **ADR-0008 amend follow-up** — Consequences §6 의 RBAC backbone 실현 시점 박제 (T-0083 ~ T-0087 chain 완료 후 일괄 amend 가능).
