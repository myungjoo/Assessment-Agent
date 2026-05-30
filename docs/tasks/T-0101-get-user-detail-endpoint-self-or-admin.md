---
id: T-0101
taskId: T-0101
title: GET /api/users/:id detail endpoint (self OR Admin+ tier) + UserService.findById + e2e
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-046]
estimatedDiff: 260
estimatedFiles: 5
estimatedLoc: 260
dependsOn: [T-0085, T-0091, T-0095, T-0099]
sizeExempt: false
created: 2026-05-30
createdAt: 2026-05-30T10:55:00+09:00
plannerNote: "loop session #27 turn 8/10 — P3 User CRUD-R 표면 4/4 closure (GET detail). partial-backbone × 1.3 envelope 260 LOC / 5 파일. self OR Admin+ 분기 (REQ-046 User self-read 박제) — RBAC 본 system 첫 conditional branch + RolesGuard.optional 정공법 박제."
---

# T-0101 — GET /api/users/:id detail endpoint (self OR Admin+ tier) + UserService.findById + e2e

## Why

[T-0099](T-0099-get-users-list-endpoint-admin-tier.md) (MERGED `e91559b` PR-100) §Out of Scope L143 박제 follow-up — **GET /api/users/:id (single user detail) endpoint** 이 "read-detail 표면은 본 task 0. 별도 follow-up (T-0101 candidate). RBAC tier 결정 별도 (User self-read vs Admin+ other-read 분기)" 으로 자연 progression 박제. 본 task 가 그 박제점.

**User CRUD 표면 완결** — POST signup (T-0092 박제) + GET list (T-0099 박제) + PATCH changeRole (T-0087 박제) production endpoint chain 3/4. 본 task 의 GET /api/users/:id detail 박제 → CRUD-R 표면 **4/4 closure** (P3 user-domain HTTP layer 완결점).

**RBAC tier 결정 — self OR Admin+ 분기** (`:id` 가 인증된 actor 본인 OR actor role ∈ {Admin, SuperAdmin}). 근거:

1. **REQ-046 User read-only 박제** — User tier 가 본인 데이터 조회 가능해야 자연 (login 후 자기 프로필 확인 등 일반적 use case). Admin+ tier 만 강제 시 User 본인 조회 0 → REQ-046 형해화.
2. **Admin+ tier other-read** — 다른 user 조회는 administrative concern (REQ-043 User CRUD 의 read-detail 책임). T-0099 의 list 패턴 정합.
3. **RBAC backbone 의 첫 conditional branch 박제** — T-0087 (SuperAdmin literal match) + T-0099 (Admin+ escalation descent) 이후 **첫 self OR role 의 OR 분기**. RolesGuard 단독 강제 부족 — controller 내부 추가 분기 필요. 본 task 가 그 첫 production 사용 사례.
4. **RolesGuard 적용 정책 — Guard 는 인증만 강제, role 분기는 controller 내부**:
   - decorator stack: `@UseGuards(JwtAuthGuard)` 만 (RolesGuard 미적용) + controller 내부 분기.
   - 분기 로직: `if (req.user.sub === :id) return await this.userService.findById(:id);` (self) `else if (req.user.role === 'Admin' || req.user.role === 'SuperAdmin') return await this.userService.findById(:id);` (Admin+) `else throw new ForbiddenException(...);`.
   - 또는 **대안 — RolesGuard + @Roles("User") + controller 분기 강화** (User tier 이상은 통과, controller 가 self check). User+ 가 사실상 모든 인증된 사용자 → RolesGuard 의의 약화. 본 task 는 첫 안 (Guard 인증만, controller 분기) 정공법 박제.

**hashedPassword 응답 누출 차단** — detail 도 동일 위험. UserResponseDto.fromEntity (T-0095 박제) 가 단일 진입점. T-0099 1:1 mirror.

**not-found 분기** — `:id` 가 DB 에 없으면 `NotFoundException` (404). UserService.changeRole 의 `target` not-found 분기 (L136-140) 정공법 1:1 mirror.

[CLAUDE.md §3.2 R-112](../../CLAUDE.md) — UserService.findById / UserController.detail 2 신규 public symbol + UserResponseDto.fromEntity 재활용 → happy / error / branch / negative 4 카테고리 cover 의무. 특히 **negative cases 충분 cover** — Guard 의 401 (cookie 부재) / controller 의 403 (다른 user + non-admin actor) / 404 (not-found) / hashedPassword 누출 차단 / self ID match 분기 / Admin escalation 분기 / User other-read 차단 분기 모두 cover.

[docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — **partial-backbone × 1.3 multiplier** (단일 신규 endpoint + service 신규 메서드 + RolesGuard 미적용 controller 분기 + e2e regression — full R-112 4 카테고리 backbone 이 아닌 partial — repository 재활용 (T-0085 박제 findById), DTO 재활용 (T-0095 박제 fromEntity)). base 200 LOC × 1.3 = 260 LOC / 5 파일 envelope.

## Required Reading

- [src/user/user.controller.ts](../../src/user/user.controller.ts) — UserController 박제 (signup L155-165, changeRole L118-137, list L203-216). `:id` Param 패턴 (changeRole L123 `@Param("id") id: string`) + `@Req()` Request 패턴 (changeRole L125 `@Req() req: Request`) + UserResponseDto.fromEntity 매핑 (changeRole L137) reference. 본 task 의 detail 메서드는 list 패턴 1:1 mirror + changeRole 의 `:id` Param + `@Req()` 패턴 reuse + self OR Admin+ 분기 추가.
- [src/user/user.service.ts](../../src/user/user.service.ts) — UserService 박제 (changeRole L111-150, findAll L180-184, signup L210-...). findById 메서드 추가 책임 (현재 findById 부재 — controller 가 직접 repository.findById 호출 안 함, service 가 not-found 분기 변환 책임). UserService.changeRole 의 `target` not-found 분기 (L136-140 `if (!target) throw new NotFoundException(...)`) 정공법 1:1 mirror.
- [src/user/user.repository.ts](../../src/user/user.repository.ts) — UserRepository.findById (L62-66, T-0085 박제, 단순 `this.prisma.user.findUnique({ where: { id } })` raw forward, row 부재 시 null 반환). 본 task 의 service 가 그 위에 wrapping. 새 repository 메서드 0.
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — UserResponseDto 박제 (private constructor + fromEntity + fromEntities). 본 task 의 detail 매핑은 단일 entity → fromEntity 호출 1 회 (재활용). 새 메서드 0.
- [src/user/user.controller.spec.ts](../../src/user/user.controller.spec.ts) — 기존 signup 5 it + changeRole 22 it + UserResponseDto regression 4 it + list 6 it 박제. detail endpoint 의 happy / error / branch / negative 추가 it 박제 (≥ 8 it 추가).
- [src/user/user.service.spec.ts](../../src/user/user.service.spec.ts) — UserService spec 박제 reference. findById 의 happy / branch / negative 추가 it 박제 (≥ 4 it 추가).
- [src/auth/jwt.strategy.ts](../../src/auth/jwt.strategy.ts) — JwtStrategy 박제 (T-0083). `req.user` 의 shape 박제 — `{ sub: string, role: UserRole }` payload 정합 (controller 분기 의 `req.user.sub` / `req.user.role` 정합 검증 source). UserController.changeRole L132 `(req.user as { sub: string }).sub` cast 정공법 reference.
- [src/auth/roles.guard.ts](../../src/auth/roles.guard.ts) — ROLE_HIERARCHY 박제 (`Admin: ["Admin", "User"]` 매핑, SuperAdmin: ["SuperAdmin", "Admin", "User"]). 본 task 의 controller 분기 가 그 hierarchy 의 inverse 검증 — actor role ∈ {Admin, SuperAdmin} ↔ Admin+ tier 등가. ROLE_HIERARCHY 의 reverse 매핑 직접 사용 0 (분기 단순화).
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — @Roles decorator 박제 reference. 본 task 의 detail 은 @Roles 미적용 (RolesGuard 미적용 정공법).
- [test/e2e/users.e2e-spec.ts](../../test/e2e/users.e2e-spec.ts) — 기존 e2e 박제 (signup 4 it + changeRole 7 it + UserResponseDto regression + list 7+ it). detail endpoint 의 happy / error / negative e2e 추가 it 박제 (≥ 8 it 추가).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — createAuthenticatedE2EApp + buildAuthCookie 박제 (T-0091). 본 task 의 e2e seed (User actor + Admin actor + SuperAdmin actor + target user) + buildAuthCookie 3 종 (각 role 별) reuse.
- [docs/architecture/api.md L33-35 RBAC tier table + L65-72 UC-04 row 박제](../architecture/api.md) — Admin tier 정의 + 기존 user endpoint row 정합. GET /api/users/:id row 추가는 별도 doc-only direct follow-up (Out of Scope).
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — User entity password 컬럼 application-layer 보호 박제 reference (본 task 가 detail endpoint 에서도 동일 보호 박제).
- [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) — happy / error / branch / negative + coverage line ≥ 80% AND function ≥ 80% + e2e CI 강제.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — partial-backbone × 1.3 multiplier 적용 (단일 신규 endpoint + service 신규 메서드 + RolesGuard 미적용 controller 분기 + e2e regression).

## Acceptance Criteria

### A. `src/user/user.service.ts` 의 findById 메서드 추가

- [ ] [src/user/user.service.ts](../../src/user/user.service.ts) 에 `async findById(id: string): Promise<User>` 메서드 추가. 본문: `const user = await this.userRepository.findById(id); if (!user) throw new NotFoundException(\`User \${id} 가 존재하지 않습니다.\`); return user;` — changeRole L136-140 `target` not-found 분기 1:1 mirror.
- [ ] 한국어 주석 ≥ 8 줄 — UserController.detail (T-0101) 의 raw forward 책임, not-found 분기 NotFoundException 변환 (HTTP 404 NestJS default mapping), DTO 변환 책임 0 (controller layer 가 UserResponseDto.fromEntity 변환 — clean separation 정공법 정합), 도메인 invariant 0 (단순 조회 + null-safe 검증), Prisma error 정책 (findUnique 의 row 부재는 null 반환 — Prisma error code 0, NestJS NotFoundException 으로 변환), changeRole `target` 분기 정공법 cross-ref.

### B. `src/user/user.service.spec.ts` 의 findById 추가 it (≥ 4 it)

- [ ] **happy — repository.findById 결과 raw forward**: mockRepository.findById → user entity → service.findById 결과 user entity 정합 + 동일 reference (`expect(result).toBe(user)`).
- [ ] **branch — id 인자가 repository 에 그대로 전달**: mockRepository.findById 호출 인자가 controller 에서 받은 id 와 동일 (`expect(mockRepository.findById).toHaveBeenCalledWith("user-123")`).
- [ ] **negative — repository null 반환 시 NotFoundException throw**: mockRepository.findById → `null` → service.findById 가 `NotFoundException` throw + message 에 id 포함 (정합 검증).
- [ ] **negative — repository throw propagate**: mockRepository.findById → `throw new Error("db down")` → service.findById 가 동일 error throw (catch 0 — raw propagate, NestJS default 500 자동 mapping).

### C. `src/user/user.controller.ts` 의 detail endpoint 추가

- [ ] [src/user/user.controller.ts](../../src/user/user.controller.ts) 에 `@Get(":id")` detail endpoint 추가:
  - method signature: `async detail(@Param("id") id: string, @Req() req: Request): Promise<UserResponseDto>`.
  - decorator stack (위 → 아래): `@Get(":id")` + `@UseGuards(JwtAuthGuard)` (RolesGuard 미적용 — controller 내부 분기).
  - body 분기 로직:
    ```ts
    const actor = req.user as { sub: string; role: UserRole };
    const isSelf = actor.sub === id;
    const isAdminPlus = actor.role === "Admin" || actor.role === "SuperAdmin";
    if (!isSelf && !isAdminPlus) {
      throw new ForbiddenException("다른 user 의 상세 조회는 Admin+ 권한이 필요합니다.");
    }
    const user = await this.userService.findById(id);
    return UserResponseDto.fromEntity(user);
    ```
  - import 추가: `ForbiddenException` (`@nestjs/common`). UserRole type import 정합 검증.
- [ ] 한국어 주석 ≥ 18 줄 (signup / changeRole / list 주석 패턴 1:1 mirror) — self OR Admin+ 분기 박제 근거 (REQ-046 User self-read 박제 + REQ-043 Admin other-read administrative concern), RolesGuard 미적용 정책 박제 (@Roles literal match 의 OR 분기 불가 — controller layer 가 분기 책임), JwtAuthGuard 단독 stack 의의 (인증만 강제, role 분기는 application logic), `req.user` shape 박제 (`{ sub: string, role: UserRole }` JwtStrategy validate L40+ 반환 정합), 분기 우선순위 (isSelf check 먼저 — self 인 경우 role 검증 skip / isAdminPlus 다음 — 다른 user 인 경우 role 검증), ForbiddenException vs NotFoundException 분리 박제 (403: 권한 부족 / 404: 존재 부재 — service layer 가 not-found 책임), UserResponseDto.fromEntity 매핑 박제 (T-0095 hashedPassword 차단 invariant 자동 propagate), RBAC backbone 의 **첫 conditional branch 박제** (T-0087 SuperAdmin literal + T-0099 Admin+ escalation 이후 self OR role OR 분기 첫 production 사용 사례), endpoint 순서 박제 (`@Get(":id")` 는 `@Get()` list 보다 **뒤** 또는 NestJS routing 우선순위 정합 — list 가 `@Get()` 이라 충돌 없음).

### D. `src/user/user.controller.spec.ts` 의 detail 추가 it (≥ 8 it)

- [ ] **happy — self detail (User role actor 가 본인 조회 성공)**: req.user = `{ sub: "user-self", role: "User" }`, :id = "user-self", mockService.findById → user entity → controller.detail 결과 UserResponseDto + 5 필드 정합 + hashedPassword 키 부재.
- [ ] **happy — Admin actor 가 다른 user 조회 성공**: req.user = `{ sub: "admin-self", role: "Admin" }`, :id = "other-user", mockService.findById → other user entity → controller.detail 결과 UserResponseDto + 5 필드 정합.
- [ ] **happy — SuperAdmin actor 가 다른 user 조회 성공 (escalation 박제)**: req.user = `{ sub: "sa-self", role: "SuperAdmin" }`, :id = "other-user" → 200 + UserResponseDto (Admin+ 분기 의 SuperAdmin 분기 포함 검증).
- [ ] **happy — Admin actor 가 본인 조회 성공 (self 우선순위 분기 박제)**: req.user = `{ sub: "admin-self", role: "Admin" }`, :id = "admin-self" → 200 (isSelf=true 이미 통과, isAdminPlus 평가 skip 또는 통과 무관).
- [ ] **negative — User role actor 가 다른 user 조회 → 403 ForbiddenException**: req.user = `{ sub: "user-self", role: "User" }`, :id = "other-user" → controller.detail 가 `ForbiddenException` throw (mockService.findById 호출 0 — 분기 차단 검증).
- [ ] **negative — detail 응답에 hashedPassword 키 부재**: happy 의 모든 it 의 결과 DTO 가 `not.toHaveProperty("hashedPassword")` (regression — T-0095 의 fromEntity whitelist 가 단일 entity 에서도 정합).
- [ ] **negative — service NotFoundException propagate**: req.user = `{ sub: "admin-self", role: "Admin" }`, :id = "non-existent", mockService.findById → `throw new NotFoundException(...)` → controller.detail 가 동일 NotFoundException throw (catch 0 — raw propagate).
- [ ] **negative — req.user undefined 시 graceful 처리**: req.user = undefined (theoretical — JwtAuthGuard 미통과 시점) → controller.detail 가 TypeError 또는 ForbiddenException (분기 실패 박제 — Guard 가 통상 401 차단하나 unit spec mock 에서 검증, 분기 안전성 박제).

### E. `test/e2e/users.e2e-spec.ts` 의 detail e2e 추가 it (≥ 8 it)

- [ ] **happy — User actor 가 본인 detail 호출 성공 (200)**: seed user (role="User") → user token cookie → `GET /api/users/<self-id>` → 200 + body UserResponseDto + 5 필드 정합 + hashedPassword 키 부재.
- [ ] **happy — Admin actor 가 다른 user detail 호출 성공 (200)**: seed admin + target user → admin token → `GET /api/users/<target-id>` → 200 + body UserResponseDto + target user 의 데이터 정합.
- [ ] **happy — SuperAdmin actor 가 다른 user detail 호출 성공 (escalation 박제, 200)**: seed superadmin + target user → superadmin token → 200 (escalation OR 분기 의 SuperAdmin 분기).
- [ ] **negative — cookie 부재 시 401**: cookie 미동반 `GET /api/users/<any-id>` → 401 (JwtAuthGuard reject).
- [ ] **negative — invalid cookie 시 401**: 임의 invalid JWT cookie → 401.
- [ ] **negative — User actor 가 다른 user detail 호출 → 403**: seed user (User role) + target user → user token → `GET /api/users/<target-id>` → 403 (controller 내부 분기 차단 — service layer 호출 0 검증은 unit spec 에 위임).
- [ ] **negative — Admin actor 가 non-existent ID 호출 → 404**: seed admin → admin token → `GET /api/users/<uuid-not-in-db>` → 404 (service NotFoundException → NestJS 자동 404 변환).
- [ ] **negative — detail 응답에 hashedPassword 키 부재 (e2e regression)**: 모든 happy it 의 body 에 `expect(body).not.toHaveProperty("hashedPassword")` 박제 + body shape 가 `["createdAt", "email", "id", "role", "updatedAt"]` 5 키만 포함 (round-trip JSON 직렬화 정합 — T-0099 e2e 패턴 1:1 mirror).

### F. CI / 4-게이트

- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — user.service.ts (findById) + user.controller.ts (detail) 신규 surface 모두 line ≥ 80% AND function ≥ 80%. 신규 2 public symbol 100% cover 의무. controller 의 self/Admin/SuperAdmin/User-other 4 분기 모두 cover.
- [ ] `pnpm test:smoke` 통과 — smoke 변경 없음.
- [ ] `pnpm test:e2e` 통과 — users.e2e-spec.ts 전체 (기존 signup 4 + changeRole 7 + UserResponseDto regression + list ≥ 7 + 본 task 의 detail 추가 ≥ 8 it = 총 ≥ 26 it) 모두 green + auth.e2e-spec.ts + persons / groups / parts e2e 모두 green (regression 0).
- [ ] PR 4-게이트 all PASS (reviewer APPROVE + PR comment 외부 + integrator self-check + CI green).

## Out of Scope

- **api.md L65-72 UC-04 row 의 GET /api/users/:id 추가 박제** — doc-only direct follow-up (× 0.64 inline-amend multiplier).
- **modules.md L48 UserModule row description 갱신** — detail endpoint 추가 박제. doc-only direct follow-up.
- **UC-04 §5 sequence diagram 의 detail flow 추가** — use-case spec 정합. doc-only direct follow-up.
- **fine-grained field-level access control** — User self-read 시점에 일부 sensitive 필드만 노출 / Admin 만 전체 노출 등의 분기. 본 task 는 단일 UserResponseDto 5 필드 균일 노출. 별도 ADR 후속.
- **other entity (Person / Group / Part) detail endpoint 의 self OR Admin+ 분기 일반화** — Person 의 self/other 정의 자체가 user-binding 미박제 → 별도 ADR 진입점.
- **RolesGuard 의 `@RolesOrSelf("Admin", "id")` 같은 declarative decorator 박제** — 본 task 의 controller 내부 분기 패턴 누적 2+ 회차 박제 후 abstraction 후보. 별도 ADR.
- **`req.user` type 안전성 강화** — 현재 `as { sub: string; role: UserRole }` cast 패턴 (changeRole L132 정합). 향후 `@CurrentUser()` custom decorator + 타입 안전 propagation 박제 시점에 일괄 갱신.
- **pagination / sorting / filtering (detail 표면 무관)** — list endpoint follow-up 박제 따로.
- **POST /api/users RBAC 강화 ADR** — 별도 task / ADR.
- **RefreshToken DB table + revocation (ADR-0008 §6 후속 chain)** — 별도 task.
- **ClassSerializerInterceptor 도입 (NestJS 전역 직렬화 전략)** — 별도 ADR (T-0095 follow-up 박제).
- **첫 conditional branch 박제 의 ADR-0008 §RBAC 별도 박제** — 본 task 가 첫 사용 사례, 박제 자체는 ADR-0008 §RBAC 또는 별도 ADR 후속 follow-up.

## Suggested Sub-agents

`implementer → tester → reviewer → integrator` (architect=0 — RBAC tier 결정 (self OR Admin+) 은 본 task §Why 의 inline 박제 + REQ-046 + JwtStrategy `req.user` shape + ROLE_HIERARCHY 박제 source 로 결정, 신규 ADR 0. 패턴은 UserController.changeRole / UserController.list / UserService.changeRole `target` not-found 분기 / UserResponseDto.fromEntity 4 precedent 1:1 mirror — 새 결정 0).

## Follow-ups

- **api.md L65-72 UC-04 row 의 GET /api/users/:id 추가 + L33-35 tier table 의 self OR Admin+ 분기 패턴 박제 cross-ref** — doc-only direct inline-amend × 0.64.
- **modules.md L48 UserModule row description 갱신** — detail endpoint 추가 박제. doc-only direct.
- **UC-04 §5 sequence diagram 의 detail flow 추가** — doc-only direct (T-0097 정공법 mirror).
- **`@RolesOrSelf("Admin", "id")` declarative decorator 추출** — 본 task 의 controller 내부 분기 패턴 누적 2+ 회차 박제 후 abstraction. 별도 ADR.
- **`@CurrentUser()` custom decorator 도입** — `req.user as { sub, role }` cast 패턴 누적 3+ 회차 (changeRole + 본 task + 향후 task) 후 type-safe propagation 박제. 별도 task.
- **fine-grained field-level access control ADR** — self vs Admin tier 별 응답 필드 분기. 별도 ADR.
- **first conditional-branch RBAC 박제 ADR-0008 §RBAC 별도 박제** — 본 task 의 self OR role OR 분기 첫 production 사용 사례 → ADR 박제 follow-up.
- **cron env permanent fix ADR** (HQ-0006/8/9/10/13 5+ 회차 systemic) — install-gh-cli-in-cron-env / adapt-agents-to-mcp / cron driver "doc-only 만 진행" 분기 / cron stale PR 자동 cleanup hook 4 options trade-off + 결정 + chain.
- **race-patterns.md phantom worktree + MSYS path translation + Windows CRLF trap 박제 amend** — T-0097 / T-0098 / T-0099 박제 데이터.
- **estimate-model.md milestone refinement** — 본 task 의 partial-backbone × 1.3 (단일 신규 endpoint + service 신규 메서드 + RolesGuard 미적용 controller 분기 + e2e regression) variance 박제 데이터 추가.
- **stale cron branch cleanup × 5** — 2 old task branch (claude/T-0082-..., claude/T-0085-...) + 3 cron-created (claude/affectionate-babbage-{BcMbw, WjvJW, qjS2L}) — T-0098 pattern 1:1 mirror reactive cleanup.
