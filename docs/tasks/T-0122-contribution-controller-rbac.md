---
id: T-0122
title: ContributionController 에 RBAC guard 적용 (User+/Admin+ tier 강제)
phase: P3
status: PENDING
commitMode: pr
branch: claude/T-0122-contribution-controller-rbac
coversReq: [REQ-043, REQ-045, REQ-046, REQ-084, REQ-086]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-05-31
plannerNote: "P3 Auth/RBAC bullet — ContributionController 4 endpoint 에 api.md 의 의도 tier (GET=User+/POST·DELETE=Admin+) enforce. T-0121 AssessmentController 1:1 mirror, RBAC chain 2/3."
---

# T-0122 — ContributionController 에 RBAC guard 적용 (User+/Admin+ tier 강제)

## Why

PLAN.md P3 의 "Auth/RBAC 모델 (SuperAdmin/Admin/User)" + "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" bullet 의 controller chain 2/3 를 cover 한다. T-0121 이 AssessmentController 의 4 endpoint 에 RBAC 를 적용해 chain 1/3 을 완결했고, 본 task 는 동일 패턴을 **ContributionController** 의 4 endpoint 에 1:1 mirror 로 적용한다. [api.md §4](../architecture/api.md) 의 ContributionController 행은 GET = `User+`, POST/DELETE = `Admin+` 를 의도값으로 표기 — 본 task 가 그 의도를 reality 로 만든다.

이는 **이미 결정된 ADR-0008 (RBAC) + T-0083 (scaffold) 의 구현 mirror** (CLAUDE.md §5 자동 진행 — 신규 auth-flow / role 의미 / secret 처리 변경 0). RolesGuard 의 escalation 매핑 (User+ / Admin+) 과 e2e auth helper (`createAuthenticatedE2EApp` / `buildAuthCookie`) 와 T-0121 이 보강한 unit · e2e 패턴이 모두 존재 — 본 task 는 ContributionController 의 4 endpoint 에 decorator 만 부착하고 spec / e2e 를 1:1 mirror 한다.

Contribution 은 immutable (ADR-0006 §2 — PATCH 부재) 이고 `@@unique` 부재 (Conflict 분기 0) 라 AssessmentController 보다 분기가 단순 — guard 적용 패턴은 동일.

## Required Reading

- `docs/tasks/T-0122-contribution-controller-rbac.md` (본 파일)
- `docs/tasks/T-0121-assessment-controller-rbac.md` — chain 1/3 의 직전 mirror 원본 (acceptance / spec / e2e 패턴 일치 의무)
- `src/user/contribution.controller.ts` — 본 task 가 수정할 controller (현재 guard 미적용, 4 endpoint: GET list / GET :id / POST / DELETE :id)
- `src/user/contribution.controller.spec.ts` — colocated 수정 대상 spec (guard 적용 후 unit test 보강)
- `test/e2e/contributions.e2e-spec.ts` — e2e 수정 대상 (401/403 negative + authed happy 추가)
- `src/user/assessment.controller.ts` — T-0121 적용된 4 endpoint guard 패턴 1:1 reference (decorator 위치 / import path)
- `src/user/assessment.controller.spec.ts` — unit test guard mock / override 패턴 reference
- `test/e2e/assessments.e2e-spec.ts` — e2e 401 (cookie 부재) / 401 (invalid JWT) / 403 (role 미달) / authed happy 패턴 reference
- `src/auth/roles.guard.ts` (특히 L10-18 escalation 매핑) — `@Roles("User")` → User+ tier / `@Roles("Admin")` → Admin+ tier 의미 확인
- `src/auth/jwt-auth.guard.ts` — JwtAuthGuard 책임 (cookie → JWT verify → req.user 박제)
- `test/helpers/auth-e2e-helper.e2e-spec.ts` — `createAuthenticatedE2EApp([{role}])` / `buildAuthCookie` 호출 reference
- `docs/architecture/api.md` (ContributionController 섹션의 auth tier 컬럼만) — 의도 tier 확인 용

## Acceptance Criteria

- [ ] `src/user/contribution.controller.ts` 의 4 endpoint 에 api.md 의도 tier 를 적용:
  - [ ] `GET /api/contributions` (findByAssessment) → **User+**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`.
  - [ ] `GET /api/contributions/:id` (findOne) → **User+**: 동일 (`@Roles("User")`).
  - [ ] `POST /api/contributions` (create) → **Admin+**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
  - [ ] `DELETE /api/contributions/:id` (remove) → **Admin+**: 동일 (`@Roles("Admin")`).
  - [ ] guard / decorator import 는 `../auth/jwt-auth.guard`, `../auth/roles.guard`, `../auth/roles.decorator` 에서 (assessment.controller.ts T-0121 정합). UserModule 이 이미 `forwardRef(() => AuthModule)` 로 두 guard 를 resolve 하므로 `user.module.ts` 변경 불요 — 변경했다면 reviewer 가 catch.
- [ ] **Happy-path unit test** (colocated `src/user/contribution.controller.spec.ts`): 4 endpoint 각각 authed actor (적정 role) 로 호출 시 service 위임 + 정상 반환 검증. guard 를 `overrideGuard` 또는 mock 으로 bypass 하거나, RolesGuard escalation 을 통과시키는 reflector metadata 검증 중 assessment.controller.spec.ts T-0121 patch 가 쓰는 방식 1:1 mirror.
- [ ] **Error path unit test**: 각 endpoint 의 기존 service throw propagation (BadRequest / NotFound) 이 guard 적용 후에도 유지됨을 검증 (guard 통과 후 service error 가 정상 status mapping). Contribution 은 `@@unique` 부재 → Conflict 분기 cover 불요.
- [ ] **Flow / branch test**: GET (User+) tier 와 POST/DELETE (Admin+) tier 의 분기를 각각 cover — User+ endpoint 는 User role 통과, Admin+ endpoint 는 User role 차단 / Admin role 통과. RolesGuard escalation 분기 (Admin literal 에 SuperAdmin actor 자동 통과) 도 1+ test.
- [ ] **Negative cases 충분 cover** (e2e `test/e2e/contributions.e2e-spec.ts`, assessments.e2e-spec.ts T-0121 패턴 mirror — 각 1+):
  - [ ] 401 — cookie 부재 시 (JwtAuthGuard reject). 4 endpoint 중 최소 GET 1 + POST/DELETE 1.
  - [ ] 401 — invalid JWT cookie (`buildAuthCookie("garbage.token.invalid")`, JWT verify fail).
  - [ ] 403 — User role token 으로 Admin+ endpoint (POST 또는 DELETE) 호출 시 (RolesGuard tier 미달 reject).
  - [ ] authed happy — User role token 으로 GET endpoint 통과 + Admin role token 으로 POST/DELETE 통과 (`createAuthenticatedE2EApp` + `buildAuthCookie`, 실 PostgreSQL seed, FK 인 Assessment row + Person row 선행 seed 주의 — POST 시 assessmentId FK).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). contribution.controller.ts 는 100% 유지 (단순 decorator 추가).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. e2e (`pnpm test:e2e`) 는 CI 의 real PostgreSQL job 에서 green (로컬 DB 부재 시 CI-only).
- [ ] CI 전 step green (spec-presence + lint + build + test:cov + smoke + e2e + reviewer-gate).

## Out of Scope

- **SummaryController 의 RBAC 적용** — chain 3/3 별도 task (Follow-ups). 본 task 는 ContributionController 1 개만 (cap ≤5 파일 / ≤300 LOC 준수, controller 동시 적용은 chain 분할 정책 위반).
- **api.md auth tier 컬럼 amend** — 이미 의도값으로 정확히 기재됨 (T-0120). 본 task 가 의도를 reality 로 만들 뿐, 문서 변경 불요. "shipped" 표기 보강이 필요하면 chain 3/3 완료 후 doc-only direct follow-up 으로 일괄.
- **새 role 의미 / escalation 매핑 변경** — ROLE_HIERARCHY 는 ADR-0008 / T-0083 박제값 그대로 사용. 변경 시 별도 ADR (§5 BLOCKED).
- **새 auth-flow / secret 처리 / JWT 발급 변경** — 0. 기존 cookie → JWT verify chain 그대로.
- **ContributionService / repository / DTO 변경** — 이미 T-0115 / T-0114 / T-0113 완료. 본 task 는 controller layer 만.
- **PATCH endpoint 추가** — Contribution 은 immutable (ADR-0006 §2). 본 task 무관.
- **CurrentUser decorator 추출 / RolesGuard 공용 util refactor** — chain 3/3 완료 후 동일 패턴 3 controller 박제 시점에서 별도 task 로.
- **user.module.ts 변경** — AuthModule 이미 import 됨 (guard resolve 가능), 변경 불요.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0008 + T-0083 + T-0121 이 RBAC 결정 / 적용 / 검증 패턴 전부 박제. 신규 architecture 결정 0).

## Follow-ups

(작성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
- (planner 예약) SummaryController RBAC 적용 (T-0121 / T-0122 mirror, chain 3/3).
- (planner 예약, chain 3/3 완료 후) api.md auth tier 컬럼에 "shipped" 표기 / CurrentUser decorator 추출 검토.
