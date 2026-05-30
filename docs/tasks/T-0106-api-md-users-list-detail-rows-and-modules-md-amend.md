---
id: T-0106
taskId: T-0106
title: api.md UC-04 user list/detail rows + modules.md UserModule row architecture spec 정합 amend
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044, REQ-045, REQ-046]
estimatedDiff: 25
estimatedFiles: 2
estimatedLoc: 25
dependsOn: []
sizeExempt: false
created: 2026-05-30
createdAt: 2026-05-30T14:00:00+09:00
plannerNote: "loop session #29 turn 1 — T-0099/T-0101 production endpoint 박제 후 누락된 architecture spec 정합 batch amend (doc-only inline-amend × 0.4 sub-multiplier 12 회차 누적, cron-safe direct)."
---

# T-0106 — api.md UC-04 user list/detail rows + modules.md UserModule row architecture spec 정합 amend

## Why

[T-0099](T-0099-get-users-list-endpoint-admin-tier.md) (MERGED `e91559b` PR-100) 의 §Follow-ups L161 박제 + [T-0101](T-0101-get-user-detail-endpoint-self-or-admin.md) (MERGED `432974a` PR-101) 의 §Follow-ups L155 박제 — **api.md L65-72 UC-04 row 에 GET /api/users (list, Admin+) + GET /api/users/:id (detail, self OR Admin+) 2 row 추가 + modules.md L34 UserModule row description 갱신** 이 두 production endpoint 박제 후 자연 progression. 본 task 가 2 row 일괄 박제 (batched inline-amend).

**architecture spec → use-case spec 정합 동기 chain 박제 reactivate** — T-0095 (UserResponseDto src 신설) → T-0096 (api.md/modules.md architecture spec 정합) → T-0097 (UC-04 use-case spec 정합) 3-stage chain 이 T-0099 (GET list 박제) + T-0101 (GET detail 박제) 두 production endpoint 추가로 재트리거. 본 task = chain 의 stage 2 (architecture spec) 박제. stage 3 (UC-04 §5 sequence diagram list/detail flow 추가) 는 별도 follow-up.

**선택 근거 5 가지**:

1. **T-0099 / T-0101 박제 직후 자연 follow-up** — 각 task §Out of Scope + §Follow-ups 가 본 task 명시 박제. 데이터 fresh state 동안 박제 친화 (architecture spec drift 차단).
2. **doc-only direct inline-amend × 0.4 sub-multiplier 11 회차 누적** (T-0070 ×0.37 + T-0073 ×0.86 + T-0076 ×0.99 + T-0084 ×0.37 + T-0088 ×0.19 + T-0089 ×0.91 + T-0093 ×0.23 + T-0096 ×0.17 + T-0097 ×0.16 + T-0100 ×2.07 + T-0102 ×0.89) — under-estimate 0 systematic over 박제 backbone. 본 task = 12 회차.
3. **cron 활성 시간대 (~14:00 KST window) collision 회피** — doc-only direct 1-turn 친화 (PR cycle 0, race-patterns.md §7 lesson 정합). 본 task PLANNER turn 직후 driver turn 1 회로 완수, cron 발화 시점 직전 마감 가능.
4. **api.md 의 UC-04 row 완결성 박제** — 현재 L70 POST + L71 PATCH role + L72 PATCH password 3 row. GET list + GET detail 2 row 누락 → 본 task 박제 후 user CRUD 표면 5 row (POST + GET list + GET detail + PATCH role + PATCH password) 완결. P3 user-domain HTTP layer 의 architecture spec 정합 closure.
5. **RBAC tier table 의 User tier example 갱신 박제 가능** — 현재 L33 User row 의 example 이 "UC-02 의 GET, UC-08 의 user-audience GET" 만. T-0101 박제 후 첫 self-conditional branch production 사용 사례 — User tier 의 GET /api/users/:id (self) example 추가 가치 (Out of Scope 처리 — minimal scope 박제, RBAC tier table 의 example 갱신은 별도 follow-up 후보).

**modules.md L34 UserModule row 갱신 — 2 endpoint 박제 추가**:

- UserController GET /api/users (T-0099 박제 — RBAC backbone 두 번째 production 사용 사례 + Admin+ tier escalation hierarchy descent + UserResponseDto.fromEntities batch helper 박제).
- UserController GET /api/users/:id (T-0101 박제 — RBAC backbone 첫 conditional branch (self OR Admin+) 사용 사례 + UserService.findById 신규 + UserResponseDto.fromEntity 재활용 + UserRepository.findById (T-0085 박제 미사용 surface) 활성화).

[CLAUDE.md §3.2 R-110](../../CLAUDE.md) 면제 — direct-mode doc-only commit (코드 없음 + tester 미호출 친화).

[docs/architecture/estimate-model.md §3.2.2](../architecture/estimate-model.md) — **doc-only inline-amend × 0.4 sub-multiplier 12 회차 누적 + under-estimate 0 회차 박제**. base 60 LOC × 0.4 = 25 LOC envelope (api.md 2 row + modules.md 1 row description 추가).

## Required Reading

- [docs/architecture/api.md L31-37 RBAC tier table + L65-72 UC-04 row 박제](../architecture/api.md) — RBAC tier 정의 (Public / User / Admin / SuperAdmin) + 기존 user endpoint row (POST L70 + PATCH role L71 + PATCH password L72). 본 task = L72 직후 2 row 추가 (GET list / GET detail).
- [docs/architecture/modules.md L34 UserModule row 박제](../architecture/modules.md) — UserController POST signup + PATCH changeRole + UserResponseDto 박제 description. 본 task = GET list (T-0099) + GET detail (T-0101) 박제 추가.
- [docs/tasks/T-0099-get-users-list-endpoint-admin-tier.md](T-0099-get-users-list-endpoint-admin-tier.md) — GET /api/users list endpoint 박제 source (Admin+ tier + UserResponseDto.fromEntities + RBAC backbone escalation hierarchy descent 첫 production).
- [docs/tasks/T-0101-get-user-detail-endpoint-self-or-admin.md](T-0101-get-user-detail-endpoint-self-or-admin.md) — GET /api/users/:id detail endpoint 박제 source (self OR Admin+ 분기 + UserService.findById 신규 + RBAC backbone 첫 conditional branch 박제).
- [docs/tasks/T-0096-api-md-user-response-shape-amend.md](T-0096-api-md-user-response-shape-amend.md) — 직전 architecture spec amend 정공법 reference (api.md row 갱신 + modules.md row 갱신 패턴 1:1 mirror).
- [docs/tasks/T-0093-api-md-users-signup-row-and-modules-md-amend.md](T-0093-api-md-users-signup-row-and-modules-md-amend.md) — POST signup 박제 후 동일 패턴 (api.md row 추가 + modules.md row 갱신) 1:1 mirror reference.
- [CLAUDE.md §3.1](../../CLAUDE.md) — direct-mode commit 분기 (doc-only direct main, reviewer/integrator/4-게이트/CI green 면제).
- [docs/architecture/estimate-model.md §3.2.2](../architecture/estimate-model.md) — inline-amend × 0.4 sub-multiplier 11 회차 누적 + under-estimate 0 회차 박제.

## Acceptance Criteria

### A. `docs/architecture/api.md` UC-04 row 에 GET /api/users (list) row 추가

- [ ] [docs/architecture/api.md](../architecture/api.md) L71 (POST /api/users row) 직후 신규 row 1 추가:
  - METHOD: `GET`
  - PATH: `/api/users`
  - UC link: `[UC-04 §5](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram)` (또는 UC-04 §5 step 1 정합 link)
  - description (한국어): 시스템 등록 user 전체 list 조회 — `UserResponseDto.fromEntities(users)` 배열 매핑 (T-0099 박제). 응답 200 + `UserResponseDto[]` body (각 element 5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` — `hashedPassword` 응답 누출 차단, T-0095 박제). 빈 list 분기 (사용자 0 명 시 `[]` 반환). 실패 401 (cookie 부재 또는 invalid token) / 403 (User tier — Admin 미달). pagination / sorting / filtering 미지원 (별도 task chain). T-0099 박제 — **RBAC backbone 두 번째 production 사용 사례** (T-0087 SuperAdmin literal 이후 첫 Admin+ tier 적용 — escalation hierarchy descent 첫 production 활용).
  - tier: `Admin (T-0099 박제 — @Roles("Admin") + RolesGuard 의 ROLE_HIERARCHY.Admin: ["Admin", "User"] 매핑으로 SuperAdmin 자동 통과 — escalation hierarchy descent 첫 production 활용)`

### B. `docs/architecture/api.md` UC-04 row 에 GET /api/users/:id (detail) row 추가

- [ ] A 의 row 직후 신규 row 1 추가:
  - METHOD: `GET`
  - PATH: `/api/users/:id`
  - UC link: `[UC-04 §5](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram)`
  - description (한국어): 단일 user detail 조회 — `UserService.findById(id)` (T-0101 박제 — repository raw forward + null → NotFoundException 변환). `UserResponseDto.fromEntity(user)` 매핑 (T-0095 박제). 응답 200 + `UserResponseDto` body. 실패 401 (cookie 부재 또는 invalid token) / 403 (User tier actor + `:id != self` 조합 — controller 내부 분기 차단) / 404 (`:id` 부재 — Prisma findUnique null 반환 → NotFoundException). T-0101 박제 — **RBAC backbone 첫 conditional branch 사용 사례** (self OR role OR 분기 — `:id === req.user.sub` self check OR `req.user.role ∈ {Admin, SuperAdmin}` Admin+ check, else 403). RolesGuard 미적용 + JwtAuthGuard 단독 stack + controller 내부 분기 정공법 박제.
  - tier: `User (self) / Admin+ (other) — T-0101 박제. self check 가 isAdminPlus check 보다 분기 우선순위 우선 (self 인 경우 role 검증 skip)`

### C. `docs/architecture/modules.md` L34 UserModule row 의 description 갱신

- [ ] [docs/architecture/modules.md](../architecture/modules.md) L34 UserModule row 의 description 컬럼 (기존 박제 끝부분 "password reset / list / fromEntities 배열 helper (GET /api/users list endpoint 박제 시점) / ClassSerializerInterceptor 도입 ADR 등 후속 endpoint chain 은 follow-up task." 문구) 직전에 다음 박제 삽입:
  - UserController GET /api/users (T-0099 박제 — Admin+ tier list endpoint + UserResponseDto.fromEntities 배열 helper 박제 — RBAC backbone 두 번째 production 사용 사례, escalation hierarchy descent 첫 production 활용).
  - UserController GET /api/users/:id (T-0101 박제 — self OR Admin+ 분기 detail endpoint + UserService.findById 신규 + UserResponseDto.fromEntity 재활용 + UserRepository.findById 미사용 surface 활성화 — RBAC backbone 첫 conditional branch 사용 사례).
- [ ] 기존 박제 끝부분 문구 "fromEntities 배열 helper (GET /api/users list endpoint 박제 시점)" → "ClassSerializerInterceptor 도입 ADR / pagination / sorting / filtering query param 등 후속 endpoint chain 은 follow-up task." 로 동기 갱신 (fromEntities + list endpoint 가 위 박제 추가로 무효화됨).
- [ ] REQ 컬럼 (UserModule row 의 마지막 컬럼) `REQ-046 (read User+)` 박제 유지 — 본 task 박제 후 production endpoint 가 REQ-046 (User self-read) cover 완결.

### D. 박제 정합 검증 (grep 기반)

- [ ] `grep -c "GET | \`/api/users\`" docs/architecture/api.md` ≥ 1 (정합 — A 박제 후).
- [ ] `grep -c "GET | \`/api/users/:id\`" docs/architecture/api.md` ≥ 1 (정합 — B 박제 후).
- [ ] `grep -c "T-0099" docs/architecture/api.md` ≥ 1 (A 박제 source 정합).
- [ ] `grep -c "T-0101" docs/architecture/api.md` ≥ 1 (B 박제 source 정합).
- [ ] `grep -c "T-0099" docs/architecture/modules.md` ≥ 1 (C 박제 source 정합).
- [ ] `grep -c "T-0101" docs/architecture/modules.md` ≥ 1 (C 박제 source 정합).
- [ ] `grep -c "escalation hierarchy descent" docs/architecture/modules.md` ≥ 1 (RBAC backbone 두 번째 사용 사례 박제 정합).
- [ ] `grep -c "첫 conditional branch" docs/architecture/modules.md` ≥ 1 (RBAC backbone 첫 conditional branch 박제 정합).
- [ ] diff 가 2 파일 한정 (api.md + modules.md) — src/* test/* docs/decisions/* docs/use-cases/* 변경 0 확인.

### E. STATE / journal / 본 task 파일 bookkeeping (driver 책임)

- [ ] `docs/STATE.json`: currentTask=null, nextTask=null 정리, lastActivity 갱신, lastCommit=본 commit SHA 박제, mostRecentTasks prepend T-0106 (cap 5 = [T-0106, T-0105, T-0104, T-0103, T-0102]), counters.tasksCompleted 104→105 bump, lock release.
- [ ] `docs/progress/journal-2026-05-30.md`: driver line 1 줄 append (한국어, ~5 줄 이내, 박제 데이터 + actualDiff / inline-amend × 0.4 sub-multiplier 12 회차 누적 정합 박제).
- [ ] 본 task 파일 (T-0106-...md): frontmatter `status: PENDING` → `DONE`, `completedAt` 추가, `actualDiff` + `actualFiles` 추가, `driverNote` 박제.

## Out of Scope

- **UC-04 §5 sequence diagram 의 list / detail flow 추가** — use-case spec 정합 박제 (T-0097 정공법 mirror, architecture → use-case chain 의 stage 3). 별도 doc-only direct follow-up.
- **api.md RBAC tier table L33 User row 의 example 갱신** — "UC-02 의 GET, UC-08 의 user-audience GET" → "+ GET /api/users/:id (self-read 첫 production)" 박제 추가. 본 task scope 0 — minimal amend 박제 (별도 follow-up 후보).
- **api.md L65 UC-04 header 의 "(`/api/auth`, `/api/users`)" 박제 갱신** — production endpoint 5 종 완결 박제 후 header 갱신은 별도 follow-up.
- **api.md L139 UC-04 cross-ref 의 GET endpoint 추가** — `GET /api/users`, `GET /api/users/:id` 박제 추가. 본 task scope 0.
- **modules.md L171 component map 의 UserModule row 갱신** — 본 task 박제로 변경 0 (description 만 갱신).
- **DELETE /api/users/:id endpoint 박제** — User CRUD 표면 D 부분. 별도 task / ADR (RBAC 정책 결정 + cascade delete invariant + soft-delete 전략 박제 필요).
- **POST /api/users RBAC 강화 ADR** (Public tier → Admin+ 격상 또는 분리 endpoint `/api/auth/setup` 박제) — T-0092 Out of Scope follow-up. 별도 ADR.
- **RefreshToken DB table + revocation (ADR-0008 §6 후속 chain)** — 별도 task.
- **ClassSerializerInterceptor 도입 ADR** — 본 task scope 0 (T-0095 follow-up 박제).
- **fine-grained field-level access control ADR** (User self-read vs Admin tier 별 응답 필드 분기) — T-0101 Out of Scope follow-up. 별도 ADR.

## Suggested Sub-agents

`driver inline` (T-0084 / T-0088 / T-0089 / T-0093 / T-0096 / T-0097 / T-0100 / T-0102 driver inline 패턴 1:1 mirror 8 회차 누적 — STATE write 부재 시에도 doc-only direct cron-safe inline-amend 친화, sub-agent dispatch overhead 0, single-writer STATE 룰 친화).

## Follow-ups

- **UC-04 §5 sequence diagram 의 list / detail flow 추가** — use-case spec 정합 박제 chain stage 3 (T-0097 정공법 mirror). doc-only direct × 0.4 inline-amend.
- **api.md RBAC tier table L33 User row 의 example 갱신** — "UC-02 의 GET, UC-08 의 user-audience GET" → "+ GET /api/users/:id (self-read 첫 production)" 박제 추가. doc-only direct.
- **api.md L139 UC-04 cross-ref 의 GET endpoint 추가** — `GET /api/users`, `GET /api/users/:id` 박제 추가. doc-only direct.
- **DELETE /api/users/:id endpoint 박제** — User CRUD 표면 D 부분. 별도 task / ADR.
- **POST /api/users RBAC 강화 ADR** — T-0092 follow-up. 별도 ADR.
- **RefreshToken DB table + revocation ADR-0008 §6 후속 chain** — 별도 task.
- **`@RolesOrSelf("Admin", "id")` declarative decorator 추출** — controller 내부 self OR role 분기 패턴 누적 2+ 회차 박제 후 abstraction (T-0101 follow-up 박제). 별도 ADR.
- **`@CurrentUser()` custom decorator 도입** — `req.user as { sub, role }` cast 패턴 누적 3+ 회차 (changeRole T-0087 + detail T-0101 + 향후 task) 후 type-safe propagation 박제. 별도 task.
- **fine-grained field-level access control ADR** (T-0101 follow-up 박제). 별도 ADR.
- **RBAC backbone 의 first conditional-branch 박제 ADR-0008 §RBAC 별도 박제** (T-0101 follow-up). 별도 ADR.
- **RBAC backbone 의 escalation hierarchy descent 첫 production 사용 사례 ADR-0008 §RBAC 별도 박제** (T-0099 follow-up). 별도 ADR.
- **cron env permanent fix ADR** (HQ-0006/8/9/10/13 5+ 회차 systemic) — install-gh-cli-in-cron-env / adapt-agents-to-mcp / cron driver "doc-only 만 진행" 분기 / cron stale PR 자동 cleanup hook 4 options trade-off + 결정 + chain.
- **race-patterns.md phantom worktree + MSYS path translation + Windows CRLF trap 박제 amend** — T-0097 / T-0098 / T-0099 박제 데이터 (T-0103 박제 후 신규 race 누적 시 follow-up).
- **estimate-model.md milestone refinement** — 본 task 의 doc-only inline-amend × 0.4 sub-multiplier 12 회차 누적 데이터 박제.
- **stale cron branch cleanup × 5** — 2 old task branch + 3 cron-created branch. T-0098 pattern 1:1 mirror reactive cleanup.
