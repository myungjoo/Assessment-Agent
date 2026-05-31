---
id: T-0122
title: ContributionController 에 RBAC guard 적용 (User+/Admin+ tier 강제)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-084, REQ-086]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-05-31
completedAt: 2026-05-31T22:36:33+09:00
mergedAs: 6779cf8b52bd58f71b1a6e466eb22b1d9cf93ea6
prNumber: 124
reviewRounds: 1
sizeExempt: true
exemptReason: "T-0121 precedent — controller RBAC 의 prod diff 는 ~+40 LOC trivial 이나, R-112 가 guard 적용 후 모든 e2e test 에 auth cookie threading 을 의무화해 e2e 전면 재작성 (~+300 LOC) 으로 총량이 300 LOC guideline 을 초과. split 시 guard 가 미검증 상태로 머지 (R-112 위반) 되므로 단일 task 유지. 3 파일 ≤ 5 cap 준수."
plannerNote: "P3 Auth/RBAC bullet — ContributionController 에 의도 auth tier (GET=User+, POST/DELETE=Admin+) enforce. T-0121 AssessmentController RBAC 의 1:1 mirror, controller RBAC chain 2/3 (ADR-0008/T-0083 scaffold 적용, 신규 결정 0)."
---

# T-0122 — ContributionController 에 RBAC guard 적용 (User+/Admin+ tier 강제)

## Why

PLAN.md P3 의 "Auth/RBAC 모델 (SuperAdmin/Admin/User)" + "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" bullet 을 직접 cover 한다. T-0121 이 chain head 인 AssessmentController 에 RBAC guard 를 enforce 했으나, ContributionController (T-0118 shipped) 와 SummaryController (T-0119 shipped) 는 [api.md §4](../architecture/api.md) 의 auth tier 컬럼 (GET = `User+`, POST/DELETE = `Admin+`) 을 **의도값으로만** 표기하고 실제 guard 는 여전히 미적용이다. 본 task 는 그 gap 의 chain 2/3 인 **ContributionController** 의 4 endpoint 에 이미 결정·구축된 RBAC scaffold (ADR-0008 / T-0083 의 JwtAuthGuard + RolesGuard + @Roles) 를 적용해 의도된 auth tier 를 enforce 한다.

이는 **이미 결정된 ADR 의 구현** (CLAUDE.md §5 자동 진행 — 신규 auth-flow / role 의미 / secret 처리 변경 0) 이며, T-0121 의 1:1 mirror 다. RolesGuard 의 escalation 매핑 (User+ / Admin+) 과 e2e auth helper (`createAuthenticatedE2EApp` / `buildAuthCookie`) 는 이미 존재 — 본 task 는 그 패턴을 ContributionController 에 1:1 적용할 뿐이다. (Contribution 은 immutable 이라 PATCH 부재 — endpoint 4 개는 GET list / GET :id / POST / DELETE.)

## Required Reading

- `docs/tasks/T-0122-contribution-controller-rbac.md` (본 파일)
- `docs/tasks/T-0121-assessment-controller-rbac.md` — 본 task 의 직접 mirror precedent (RBAC tier 의도 / unit·e2e 검증 패턴 / size 정당화 1:1)
- `src/user/contribution.controller.ts` — 본 task 가 수정할 controller (현재 guard 미적용)
- `src/user/contribution.controller.spec.ts` — colocated 수정 대상 spec (guard 적용 후 unit test 보강)
- `test/e2e/contributions.e2e-spec.ts` — e2e 수정 대상 (401/403 negative + authed happy 추가)
- `src/user/assessment.controller.ts` — RBAC 적용 reference: T-0121 이 적용한 GET=User+ (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`) / POST·DELETE=Admin+ (`@Roles("Admin")`) 패턴 1:1 mirror 대상
- `test/e2e/assessments.e2e-spec.ts` — e2e RBAC 검증 reference (T-0121 이 작성한 401 cookie 부재 / 401 invalid JWT / 403 tier 미달 / authed happy 패턴)
- `src/auth/roles.guard.ts` (특히 escalation 매핑) — `@Roles("User")` → User+ tier / `@Roles("Admin")` → Admin+ tier 의미 확인
- `src/auth/jwt-auth.guard.ts` — JwtAuthGuard 책임 (cookie → JWT verify → req.user 박제)
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp([{role}])` / `buildAuthCookie` 호출 reference

## Acceptance Criteria

- [ ] `src/user/contribution.controller.ts` 의 4 endpoint 에 api.md §4 의도 tier 를 적용 (T-0121 AssessmentController 1:1 mirror):
  - [ ] `GET /api/contributions` (findByAssessment) → **User+**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`.
  - [ ] `GET /api/contributions/:id` (findOne) → **User+**: 동일 (`@Roles("User")`).
  - [ ] `POST /api/contributions` (create) → **Admin+**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
  - [ ] `DELETE /api/contributions/:id` (remove) → **Admin+**: 동일 (`@Roles("Admin")`).
  - [ ] guard / decorator import 는 `../auth/jwt-auth.guard`, `../auth/roles.guard`, `../auth/roles.decorator` 에서 (assessment.controller.ts 정합). UserModule 이 이미 `forwardRef(() => AuthModule)` 로 두 guard 를 resolve 하므로 `user.module.ts` 변경 불요 — 변경했다면 reviewer 가 catch.
- [ ] **Happy-path unit test** (colocated `src/user/contribution.controller.spec.ts`): 4 endpoint 각각 authed actor (적정 role) 로 호출 시 service 위임 + 정상 반환 검증. assessment.controller.spec.ts (T-0121) 가 쓰는 guard bypass/override 방식 1:1 mirror.
- [ ] **Error path unit test**: 각 endpoint 의 기존 service throw propagation (findByAssessment 누락 assessmentId 시 BadRequest / findById NotFound / create FK 위반 BadRequest / remove NotFound) 이 guard 적용 후에도 유지됨을 검증.
- [ ] **Flow / branch test**: GET (User+) tier 와 POST/DELETE (Admin+) tier 의 분기를 각각 cover — User+ endpoint 는 User role 통과, Admin+ endpoint 는 User role 차단 / Admin role 통과. RolesGuard escalation 분기 (Admin literal 에 SuperAdmin actor 자동 통과) 도 1+ test. 기존 `assessmentId` 누락 시 BadRequest 분기도 guard 통과 후 유지 확인.
- [ ] **Negative cases 충분 cover** (e2e `test/e2e/contributions.e2e-spec.ts`, assessments.e2e-spec.ts 패턴 mirror — 각 1+):
  - [ ] 401 — cookie 부재 시 (JwtAuthGuard reject). 4 endpoint 중 최소 GET 1 + POST/DELETE 1.
  - [ ] 401 — invalid JWT cookie (`buildAuthCookie("garbage.token.invalid")`, JWT verify fail).
  - [ ] 403 — User role token 으로 Admin+ endpoint (POST 또는 DELETE) 호출 시 (RolesGuard tier 미달 reject).
  - [ ] authed happy — User role token 으로 GET endpoint 통과 + Admin role token 으로 POST/DELETE 통과 (`createAuthenticatedE2EApp` + `buildAuthCookie`, 실 PostgreSQL seed, POST 시 FK 인 Assessment row 선행 seed 주의 — Contribution.assessmentId FK).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). contribution.controller.ts 는 100% 유지 (단순 decorator 추가).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. e2e (`pnpm test:e2e`) 는 CI 의 real PostgreSQL job 에서 green (로컬 DB 부재 시 CI-only).
- [ ] CI 전 step green (spec-presence + lint + build + test:cov + smoke + e2e + reviewer-gate).

## Out of Scope

- **SummaryController 의 RBAC 적용** — 동일 패턴의 별도 task (chain 3/3, Follow-ups). 본 task 는 ContributionController 1 개만 (cap ≤5 파일 / e2e auth 전환으로 ~650 LOC 예상, 2 controller 동시 = cap 초과).
- **새 role 의미 / escalation 매핑 변경** — ROLE_HIERARCHY 는 ADR-0008 / T-0083 박제값 그대로 사용. 변경 시 별도 ADR (§5 BLOCKED).
- **새 auth-flow / secret 처리 / JWT 발급 변경** — 0. 기존 cookie → JWT verify chain 그대로.
- **api.md auth tier 컬럼 amend** — 이미 의도값으로 정확히 기재됨 (T-0120). 본 task 가 의도를 reality 로 만들 뿐, 문서 변경 불요. 혹시 "shipped" 표기 보강이 필요하면 doc-only direct follow-up.
- **CurrentUser decorator 추출 / RolesGuard 공용 util refactor** — RBAC chain 완결 (3/3) 후 동일 패턴 3+ 출현 시 별도 refactor task 검토.
- **user.module.ts 변경** — AuthModule 이미 import 됨 (guard resolve 가능), 변경 불요.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0008 + T-0083 이 RBAC 결정 전부 박제 + T-0121 의 assessment.controller.ts / assessments.e2e-spec.ts 가 적용·검증 패턴 1:1 제공. 신규 architecture 결정 0).

## Follow-ups

(작성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
- (planner 예약) SummaryController RBAC 적용 (T-0121/T-0122 mirror, chain 3/3 — RBAC 완결).
