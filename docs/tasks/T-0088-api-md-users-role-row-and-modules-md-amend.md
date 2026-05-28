---
id: T-0088
title: api.md PATCH /api/users/:id/role row amend + modules.md UserModule row 갱신 — T-0087 실 구현 박제
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 32
estimatedFiles: 2
created: 2026-05-29
dependsOn: [T-0087]
plannerNote: "session #26 turn 1 planner — T-0087 RBAC 첫 production endpoint 머지 후 api.md row + modules.md UserModule row 실 구현 동기 박제. doc-only inline-amend × 0.64, ~32 LOC."
---

# T-0088 — api.md PATCH /api/users/:id/role row amend + modules.md UserModule row 갱신

## Why

[T-0087](T-0087-user-controller-change-role-endpoint.md) (MERGED fabeb40, UserController + ChangeRoleDto + PATCH /api/users/:id/role + @Roles SuperAdmin + colocated spec 22 it + e2e 7 it 박제) 의 reviewer round 1 MINOR follow-up — [docs/architecture/api.md](../architecture/api.md) §5 endpoint 표의 PATCH /api/users/:id/role row (L71) 와 §3 SuperAdmin tier row (L35) 가 본 endpoint 의 실 구현 (`@Roles("SuperAdmin")` + JwtAuthGuard + RolesGuard + ChangeRoleDto 4 layer + REQ-044 5 invariant) 박제 0. auth tier 컬럼이 "Admin (User→Admin) / SuperAdmin (Admin→User)" conceptual 박제로 남아있으나 실 구현은 `@Roles("SuperAdmin")` 단일 — 분기 합치 정합 박제 필요.

추가로 [docs/architecture/modules.md](../architecture/modules.md) L34 의 UserModule row 책임 description ("평가 대상 인원 CRUD + group / part 소속 / activate·deactivate") 가 T-0080~T-0087 chain 박제 (UserRepository + UserService.changeRole + UserController + RBAC 첫 사용 사례) 와 의미적 불일치 — UserModule 의 책임 = 평가 대상 인원이 아니라 **시스템 로그인 user (등급 변경 포함)** 이고, "평가 대상 인원" 은 PersonModule 의 책임 (T-0035 박제). UserModule row 의 description + 관련 REQ 컬럼이 retroactive 갱신 대상.

본 task 가 **T-0087 머지 후 contract source 정합 박제** — doc-only inline-amend, 2 파일 (api.md + modules.md) 의 row 4 곳 amend. T-0084 (api.md §2 + §3 + §5 /api/auth/* row amend, direct-mode doc-only inline-amend × 0.64, MERGED 24b4436) 정공법 1:1 mirror. **PLAN.md backbone 우선순위와 무관한 backbone clean-up** — RBAC 첫 production 사용 사례 박제 완결 후 contract source 정합 동기, 후속 task chain (T-0089 candidate POST /api/users signup, T-0091 candidate auth-e2e-helper 등) 진입 전 spec 참조점 정확히 박제.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — 본 task 의 amend target 1. §3 Auth tier 표 SuperAdmin row (L35), §5 endpoint 표의 PATCH /api/users/:id/role row (L71).
- [docs/architecture/modules.md](../architecture/modules.md) — 본 task 의 amend target 2. L34 UserModule row 책임 description + 관련 REQ 컬럼.
- [docs/tasks/T-0087-user-controller-change-role-endpoint.md](T-0087-user-controller-change-role-endpoint.md) — 직전 머지 task. Acceptance Criteria §B 의 endpoint 실 구현 박제 (@Patch(":id/role") + @UseGuards(JwtAuthGuard, RolesGuard) + @Roles("SuperAdmin") + ValidationPipe whitelist + req.user.sub → service.changeRole actor 첫 인자).
- [docs/tasks/T-0086-user-service-change-role-self-demote-invariant.md](T-0086-user-service-change-role-self-demote-invariant.md) — 직전 머지 task. UserService.changeRole 의 5 invariant 박제 (actor=SuperAdmin / role enum / target null / self-demote / P2025 변환).
- [docs/tasks/T-0084-api-md-auth-endpoints-amend.md](T-0084-api-md-auth-endpoints-amend.md) — 정공법 precedent. 본 task 와 동일 doc-only inline-amend 패턴, api.md row description 갱신 + grep 검증 패턴 1:1 mirror.
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — 실 구현 검증 source. @Roles("SuperAdmin") + @UseGuards(JwtAuthGuard, RolesGuard) + ChangeRoleDto + actor=req.user.sub 박제.
- [src/user/user.service.ts](../../src/user/user.service.ts) — service layer 박제 source. 5 invariant + Prisma error 변환 정책.
- [CLAUDE.md §3.1](../../CLAUDE.md) — commitMode 정책. docs/architecture/*.md 단일 파일 inline-amend 는 direct.
- [CLAUDE.md §12](../../CLAUDE.md) — 언어 정책. table content 한국어 유지 / METHOD/path/auth tier enum 영어 유지.

## Acceptance Criteria

분기 없음 — 본 task 는 doc-only inline-amend, R-112 의 happy/error/branch/negative test 항목 적용 불가. 검증은 grep / 파일 inspect 로.

### A. api.md §5 PATCH /api/users/:id/role row 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L71 의 row description 갱신: "user 등급 변경 (Admin→User 분기는 SuperAdmin 전용, self-demote 차단)" → **"user 등급 변경 — `ChangeRoleDto.role` validation (`@IsIn(["SuperAdmin", "Admin", "User"])`) + `UserService.changeRole` 5 invariant 박제 (actor=SuperAdmin / role enum / target 부재 → 404 / self-demote → 403 / P2025 race → 404). 응답 200 + user body. 실패 401 (cookie 부재 또는 invalid token) / 403 (User+Admin role 또는 self-demote) / 404 (target 부재) / 400 (DTO 위반). T-0087 박제 — RBAC 첫 production 적용 endpoint."**
- [ ] L71 auth tier 컬럼 갱신: "Admin (User→Admin) / SuperAdmin (Admin→User)" → **"SuperAdmin (T-0087 박제 — `@Roles("SuperAdmin")` 단일. Admin 의 User→Admin 승급 분기는 README L84 후반 박제하나 본 endpoint scope 외 — 별도 task chain)"**.

### B. api.md §3 Auth tier 표 SuperAdmin row 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L35 의 SuperAdmin row "실 적용 endpoint" 컬럼 갱신: "`PATCH /api/users/:id/role` 의 일부 분기 (Admin→User)" → **"`PATCH /api/users/:id/role` 전체 (T-0087 박제 — `@Roles("SuperAdmin")` 단일 적용. RBAC 첫 production 사용 사례 — JwtAuthGuard + RolesGuard + ChangeRoleDto + UserService.changeRole 4 layer 동시 박제)"**.

### C. modules.md UserModule row 갱신

- [ ] [docs/architecture/modules.md](../architecture/modules.md) L34 의 UserModule row 책임 description 갱신: "평가 대상 인원 CRUD + group / part 소속 / activate·deactivate (휴직 시 숨김) 의 service / controller. 평가 대상자 메타데이터 관리." → **"시스템 로그인 user 계정 + 등급 (SuperAdmin / Admin / User) 의 service / controller. UserRepository (T-0080 박제) + UserService.changeRole (T-0086 박제 — REQ-044 5 invariant) + UserController.PATCH /api/users/:id/role (T-0087 박제 — RBAC 첫 production 사용 사례). 평가 대상 인원 (Person / Group / Part) 은 별도 PersonModule / GroupModule / PartModule 책임 (모듈 분리 박제 — T-0035 + T-0039 chain). signup / password reset / list 등 후속 endpoint chain 은 T-0089~T-0091 candidate."**
- [ ] L34 관련 REQ 컬럼 갱신: "REQ-026 (인원 CRUD), REQ-027 (group/part), REQ-028 (activate/deactivate)" → **"REQ-043 (ID/Password), REQ-044 (3 등급 + SuperAdmin 만 Admin→User + self-demote 금지), REQ-045 (mutation Admin+), REQ-046 (read User+)"**.
- [ ] L34 관련 ADR 컬럼 갱신: "ADR-0001" → **"ADR-0001 (NestJS), ADR-0008 (Auth credential — JWT cookie)"**.

### D. 검증

- [ ] `grep -n "T-0087" docs/architecture/api.md` → §3 SuperAdmin row + §5 PATCH /api/users/:id/role row 2+ hit.
- [ ] `grep -n "ChangeRoleDto" docs/architecture/api.md` → §5 PATCH /api/users/:id/role row 1+ hit.
- [ ] `grep -n "@Roles" docs/architecture/api.md` → §3 SuperAdmin row + §5 PATCH /api/users/:id/role row 2+ hit.
- [ ] `grep -n "REQ-044" docs/architecture/modules.md` → UserModule row 1+ hit (이전 REQ-026 자리에).
- [ ] `grep -n "ADR-0008" docs/architecture/modules.md` → UserModule row 1+ hit.
- [ ] `grep -n "T-0087\|T-0086\|T-0080" docs/architecture/modules.md` → UserModule row 3+ hit.
- [ ] 변경 LOC ≤ 60 (envelope 32 LOC estimate, doc-only inline-amend × 0.64).

## Out of Scope

- **api.md §5 의 POST /api/users (signup) row 갱신** — T-0089 candidate (signup + 첫 로그인 자동 SuperAdmin 지정 분기) 의 책임. 본 task 머지 후 별도 doc-amend follow-up 으로 separate.
- **api.md §5 의 PATCH /api/users/:id/password row 갱신** — UserService.changePassword 미박제 (별도 task chain). 본 task 는 row 갱신 0.
- **modules.md L34 외의 row 갱신** — AuthModule (L32), PersistenceModule (L33), PersonModule / GroupModule / PartModule (modules.md 에 직접 row 없음, P3 후속 amend candidate) 은 본 task scope 외.
- **ADR-0008 의 amend** — Consequences §6 의 RBAC backbone 실현 시점 = T-0083 박제 + T-0087 첫 production 적용 cross-reference. 별도 doc-only direct task.
- **modules.md L150 의 cycle 의존성 표 갱신** — "AuthModule → UserModule" 의 cycle 박제가 T-0087 의 forwardRef 해결 (실 구현은 양방향 import) 와 의미 불일치. 별도 doc-amend task.
- **새 endpoint 의 실 controller 구현** — 본 task 는 doc 만, src/ 변경 0.
- **api.md §6 status code policy 갱신** — auth endpoint 의 401 / 403 / 404 / 400 는 이미 policy table 에 cover, 추가 amend 불요.
- **modules.md L171 component 표 갱신** — UserModule 의 component 매핑은 본 task 외.

## Suggested Sub-agents

`implementer` (doc-only direct, sub-agent 1 회 — tester / architect / reviewer / integrator 모두 0).

## Follow-ups

- **T-0089 candidate** — POST /api/users (signup) + UserService.create + 첫 로그인 SuperAdmin 자동 지정 분기 (REQ-044 후반). SuperAdmin 0 명 상태에서만 user creation 자동 SuperAdmin role 부여 invariant + DTO + spec.
- **T-0090 candidate** — production-test path 격차 영구 fix. T-0087 의 within-round 2 fix push 박제 — cookie-parser middleware 가 src/main.ts boot path 만 wire 되어 Test.createTestingModule path 에서 누락. test-helper 또는 ConditionalMiddleware 로 양쪽 wire 일관성 박제.
- **T-0091 candidate** — test/helpers/auth-e2e-helper.ts 추출. T-0087 e2e 의 inline JWT 발급 패턴 + cookie 형식 박제 + SuperAdmin/Admin/User 3 종 token 발급 utility.
- **T-0092 candidate** — RefreshToken DB table + revocation path (ADR-0008 §6 박제).
- **ADR-0008 Consequences §6 amend** — RBAC backbone 실현 시점 = T-0083 박제 + T-0087 첫 production 적용 cross-reference + within-round 2 fix push lesson 박제.
- **modules.md L150 cycle 의존성 표 amend** — "AuthModule → UserModule" 의 cycle 표시가 T-0087 의 forwardRef 해결 (양방향 import 실제 박제) 와 의미 불일치. UserModule ↔ AuthModule 양방향 forwardRef 박제 + cycle 표 update.
- **estimate-model.md 16+ 회차 milestone refinement** — doc-only inline-amend × 0.64 sub-multiplier 5 회차 누적 (T-0070 + T-0073 + T-0076 + T-0084 + 본 T-0088) variance 박제.
- **api.md §5 의 합계 endpoint count 정합 검증** — T-0084 가 36 endpoint 로 갱신 후 본 task 는 row 추가 0 (description 갱신만) — count 정합 유지.
- **CurrentUser decorator 추출** — T-0087 follow-up. 2+ controller 가 req.user 사용 시 추출 — 본 task 머지 후 candidate.
- **PersonController / GroupController / PartController 의 mutation endpoint @Roles 박제 chain** — REQ-045 (Admin+ 만 mutation). 각 controller 의 POST / PATCH / DELETE 에 `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles("Admin")` 박제 + e2e cover. 본 task 머지 후 자연 chain.
