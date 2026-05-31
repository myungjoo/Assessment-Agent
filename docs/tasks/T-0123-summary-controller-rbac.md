---
id: T-0123
title: SummaryController 에 RBAC guard 적용 (User+/Admin+ tier 강제)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-046, REQ-084, REQ-086]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-05-31
dependsOn: [T-0119, T-0122]
sizeExempt: true
exemptReason: "T-0121/T-0122 precedent — controller RBAC 의 prod diff 는 ~+40 LOC trivial 이나, R-112 가 guard 적용 후 모든 e2e test 에 auth cookie threading 을 의무화해 e2e 전면 재작성 (~+300 LOC) 으로 총량이 300 LOC guideline 을 초과. split 시 guard 가 미검증 상태로 머지 (R-112 위반) 되므로 단일 task 유지. 3 파일 ≤ 5 cap 준수."
plannerNote: "P3 Auth/RBAC bullet — SummaryController 에 의도 auth tier (GET=User+, POST/DELETE=Admin+) enforce. T-0121/T-0122 1:1 mirror, controller RBAC chain 3/3 (최종 — RBAC 완결)."
---

# T-0123 — SummaryController 에 RBAC guard 적용 (User+/Admin+ tier 강제)

## Why

PLAN.md P3 의 "Auth/RBAC 모델 (SuperAdmin/Admin/User)" + "User read-only 권한 범위 명시 — 조회·sort·filter 만 (R-86)" bullet 을 직접 cover 한다. T-0121 (AssessmentController) 과 T-0122 (ContributionController) 가 chain 1/3 · 2/3 으로 RBAC guard 를 enforce 했으나, SummaryController (T-0119 shipped) 는 [api.md §5](../architecture/api.md) 의 auth tier 컬럼 (GET = `User+`, POST/DELETE = `Admin+`) 을 **의도값으로만** 표기하고 실제 guard 는 여전히 미적용이다. 본 task 는 그 gap 의 **chain 3/3 (최종)** 인 SummaryController 의 4 endpoint 에 이미 결정·구축된 RBAC scaffold (ADR-0008 / T-0083 의 JwtAuthGuard + RolesGuard + @Roles) 를 적용해 의도된 auth tier 를 enforce 한다.

이는 **이미 결정된 ADR 의 구현** (CLAUDE.md §5 자동 진행 — 신규 auth-flow / role 의미 / secret 처리 변경 0) 이며, T-0121 / T-0122 의 1:1 mirror 다. RolesGuard 의 escalation 매핑 (User+ / Admin+) 과 e2e auth helper (`createAuthenticatedE2EApp` / `buildAuthCookie`) 는 이미 존재 — 본 task 는 그 패턴을 SummaryController 에 1:1 적용할 뿐이다. (Summary 는 immutable 이라 PATCH 부재 — endpoint 4 개는 GET list / GET :id / POST / DELETE.) 본 task 완결 시 user-facing CRUD controller 3 종 (Assessment / Contribution / Summary) 의 RBAC chain 이 종결되며 P3 Auth/RBAC bullet 의 controller enforcement layer 가 reality 와 의도값으로 align 된다.

## Required Reading

- `docs/tasks/T-0123-summary-controller-rbac.md` (본 파일)
- `docs/tasks/T-0122-contribution-controller-rbac.md` — 본 task 의 직접 mirror precedent (RBAC tier 의도 / unit·e2e 검증 패턴 / size 정당화 1:1)
- `docs/tasks/T-0121-assessment-controller-rbac.md` — chain head precedent (assessment.controller.ts / assessments.e2e-spec.ts 의 RBAC 패턴 원형)
- `src/user/summary.controller.ts` — 본 task 가 수정할 controller (현재 guard 미적용, 4 endpoint 명세 박제)
- `src/user/summary.controller.spec.ts` — colocated 수정 대상 spec (guard 적용 후 unit test 보강)
- `test/e2e/summaries.e2e-spec.ts` — e2e 수정 대상 (현재 unauthenticated 형태 → auth cookie threading 으로 전면 재작성)
- `src/user/contribution.controller.ts` — RBAC 적용 reference: T-0122 가 적용한 GET=User+ (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`) / POST·DELETE=Admin+ (`@Roles("Admin")`) 패턴 1:1 mirror 대상
- `test/e2e/contributions.e2e-spec.ts` — e2e RBAC 검증 reference (T-0122 가 작성한 401 cookie 부재 / 401 invalid JWT / 403 tier 미달 / authed happy 패턴)
- `src/auth/roles.guard.ts` (특히 escalation 매핑) — `@Roles("User")` → User+ tier / `@Roles("Admin")` → Admin+ tier 의미 확인
- `src/auth/jwt-auth.guard.ts` — JwtAuthGuard 책임 (cookie → JWT verify → req.user 박제)
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp([{role}])` / `buildAuthCookie` 호출 reference

## Acceptance Criteria

- [ ] `src/user/summary.controller.ts` 의 4 endpoint 에 api.md §5 의도 tier 를 적용 (T-0122 ContributionController 1:1 mirror):
  - [ ] `GET /api/summaries` (findByPerson) → **User+**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`.
  - [ ] `GET /api/summaries/:id` (findOne) → **User+**: 동일 (`@Roles("User")`).
  - [ ] `POST /api/summaries` (create) → **Admin+**: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
  - [ ] `DELETE /api/summaries/:id` (remove) → **Admin+**: 동일 (`@Roles("Admin")`).
  - [ ] guard / decorator import 는 `../auth/jwt-auth.guard`, `../auth/roles.guard`, `../auth/roles.decorator` 에서 (contribution.controller.ts 정합). UserModule 이 이미 `forwardRef(() => AuthModule)` 로 두 guard 를 resolve 하므로 `user.module.ts` 변경 불요 — 변경했다면 reviewer 가 catch.
- [ ] **Happy-path unit test** (colocated `src/user/summary.controller.spec.ts`): 4 endpoint 각각 authed actor (적정 role) 로 호출 시 service 위임 + 정상 반환 검증. contribution.controller.spec.ts (T-0122) 가 쓰는 guard bypass/override 방식 1:1 mirror.
- [ ] **Error path unit test**: 각 endpoint 의 기존 service throw propagation (findByPerson 누락 personId 시 controller 의 BadRequest / findById NotFound / create period literal 위반 BadRequest / create FK 위반 BadRequest / remove NotFound) 이 guard 적용 후에도 유지됨을 검증.
- [ ] **Flow / branch test**: GET (User+) tier 와 POST/DELETE (Admin+) tier 의 분기를 각각 cover — User+ endpoint 는 User role 통과, Admin+ endpoint 는 User role 차단 / Admin role 통과. RolesGuard escalation 분기 (Admin literal 에 SuperAdmin actor 자동 통과) 도 1+ test. 기존 `personId` query 누락 시 BadRequest 분기도 guard 통과 후 유지 확인. period query 분기 (지정 / 미지정) 도 cover.
- [ ] **Negative cases 충분 cover** (e2e `test/e2e/summaries.e2e-spec.ts`, contributions.e2e-spec.ts 패턴 mirror — 각 1+):
  - [ ] 401 — cookie 부재 시 (JwtAuthGuard reject). 4 endpoint 중 최소 GET 1 + POST/DELETE 1.
  - [ ] 401 — invalid JWT cookie (`buildAuthCookie("garbage.token.invalid")`, JWT verify fail).
  - [ ] 403 — User role token 으로 Admin+ endpoint (POST 또는 DELETE) 호출 시 (RolesGuard tier 미달 reject).
  - [ ] authed happy — User role token 으로 GET endpoint 통과 + Admin role token 으로 POST/DELETE 통과 (`createAuthenticatedE2EApp` + `buildAuthCookie`, 실 PostgreSQL seed, POST 시 FK 인 Person row 선행 seed 주의 — Summary.personId FK).
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). summary.controller.ts 는 100% 유지 (단순 decorator 추가).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. e2e (`pnpm test:e2e`) 는 CI 의 real PostgreSQL job 에서 green (로컬 DB 부재 시 CI-only).
- [ ] CI 전 step green (spec-presence + lint + build + test:cov + smoke + e2e + reviewer-gate).

## Out of Scope

- **다른 controller 의 RBAC 적용** — Assessment (T-0121) / Contribution (T-0122) 가 chain 1/3 · 2/3 으로 이미 적용. 본 task 가 chain 3/3 종결. 다른 controller (Person / Group / Part / User) 의 RBAC 는 별도 task / chain.
- **새 role 의미 / escalation 매핑 변경** — ROLE_HIERARCHY 는 ADR-0008 / T-0083 박제값 그대로 사용. 변경 시 별도 ADR (§5 BLOCKED).
- **새 auth-flow / secret 처리 / JWT 발급 변경** — 0. 기존 cookie → JWT verify chain 그대로.
- **api.md auth tier 컬럼 amend** — 이미 의도값으로 정확히 기재됨 (T-0120). 본 task 가 의도를 reality 로 만들 뿐, 문서 변경 불요. 혹시 "shipped" 표기 보강이 필요하면 chain 3/3 종결 후 doc-only direct follow-up.
- **CurrentUser decorator 추출 / RolesGuard 공용 util refactor** — RBAC chain 완결 (3/3) 후 동일 패턴 3+ 출현했으므로 추출 검토 가능 — 별도 refactor task 로 분리.
- **user.module.ts 변경** — AuthModule 이미 import 됨 (guard resolve 가능), 변경 불요.
- **Summary update 엔드포인트 / PATCH 추가** — Summary 는 immutable (ADR-0006 §3, service 에 update 메서드 부재). 본 task 는 기존 4 endpoint 에만 RBAC 적용.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0008 + T-0083 이 RBAC 결정 전부 박제 + T-0121 / T-0122 의 controller / e2e 가 적용·검증 패턴 1:1 제공. 신규 architecture 결정 0).

## Follow-ups

(작성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
- (planner 예약) controller RBAC chain 3/3 종결 후 api.md auth tier 컬럼 "shipped" 표기 보강 (doc-only direct).
- (planner 예약) 3 controller 동일 패턴 출현 — CurrentUser decorator 추출 / RolesGuard 공용 util refactor task 검토.
