---
id: T-0096
title: api.md POST /api/users + PATCH /api/users/:id/role 응답 shape amend + modules.md UserModule UserResponseDto cross-ref — T-0095 박제
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-043, REQ-044]
estimatedDiff: 35
estimatedFiles: 2
created: 2026-05-29
completedAt: 2026-05-29T18:00:00+09:00
actualDiff: 6
actualFiles: 2
dependsOn: [T-0095]
plannerNote: "session #26 turn 10 (cap) planner — T-0095 UserResponseDto 머지 후 api.md L70/L71 응답 shape doc-amend + modules.md UserModule UserResponseDto cross-ref. doc-only inline-amend × 0.64, ~35 LOC / 2 파일."
driverNote: "cron fire (KST 18:00 scheduled routine, Anthropic 클라우드 fresh checkout) DONE direct main commit. api.md L70 POST /api/users + L71 PATCH /api/users/:id/role row 응답 shape 2 곳 + modules.md L34 UserModule row 책임 description 1 곳 = 총 doc-only inline-amend 3 곳 across 2 파일, +3/-3 LOC actual (row description in-place 갱신, envelope 35 의 × 0.17 sub-multiplier — T-0088 ×0.19 정공법 1:1 mirror, T-0093 ×0.23 보다도 가벼움). D1~D9 grep/inspect self-검증 all PASS: T-0095×2/UserResponseDto×2/hashedPassword×2/defence in depth×1 in api.md, T-0095×1/UserResponseDto×1/fromEntity×1 in modules.md, markdown 표 row count 변동 0 (in-place 갱신), diff 2 파일 한정. T-0095 (UserResponseDto MERGED d842d35 PR-89 round 1 single-shot) 머지 후 contract source 정합 박제 완결. cron env (gh CLI 가용성 unknown) BUT doc-only direct main commit 은 reviewer/integrator/4-게이트 / CI green / gh CLI 모두 불요 — graceful 진행. driver inline 경로 (executor sub-agent dispatch 없이 driver 가 직접 doc edit + grep D1~D9 검증, T-0093 cron driver inline 패턴 1:1 mirror). doc-only direct inline-amend 누적 5 회차: T-0084 ×0.37 + T-0088 ×0.19 + T-0089 ×0.91 + T-0093 ×0.23 + 본 T-0096 ×0.17 (estimate-model.md milestone refinement 데이터, × 0.17~0.91 spread)."
---

# T-0096 — api.md POST /api/users + PATCH /api/users/:id/role 응답 shape amend + modules.md UserModule UserResponseDto cross-ref

## Why

[T-0095](T-0095-user-response-dto-hashed-password-removal.md) (MERGED `d842d35` PR-89, `src/user/dto/user-response.dto.ts` 신설 — private constructor + `fromEntity` static factory + 5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` + UserController `signup` / `changeRole` 응답 매핑 `Promise<UserResponseDto>` 박제 + colocated spec 9 it + controller spec 5 it + e2e regression assert 5 곳 박제) 머지 후 [docs/architecture/api.md](../architecture/api.md) §5 endpoint 표의 두 row 가 실 구현 응답 shape (UserResponseDto 5 readonly 필드 / `hashedPassword` 컬럼 제거 / JSON 직렬화 round-trip whitelist) 박제 0:

- **POST /api/users row (L70) 의 응답 shape stale** — 현 row description 이 "응답 201 + User row body" 박제하나 실 구현은 **201 + UserResponseDto** (5 필드 whitelist, `hashedPassword` 응답 누출 0). T-0095 가 application-layer last-mile fix 박제 후 contract source 가 stale.
- **PATCH /api/users/:id/role row (L71) 의 응답 shape stale** — 현 row description 이 "응답 200 + user body" 박제하나 실 구현은 **200 + UserResponseDto** (T-0095 박제 후 두 endpoint 응답 매핑 동일 UserResponseDto.fromEntity 박제).
- **defence in depth 2 layer 박제 0** — 본 contract source 가 DB-level (bcrypt 10 rounds hash, T-0092 박제) + HTTP-layer (UserResponseDto whitelist, T-0095 박제) 의 2 layer security primary intent attack surface 0 박제 cross-ref 부재.
- **modules.md UserModule row (L34) 의 UserResponseDto cross-ref 부재** — 현 책임 description 이 `UserService.signup` (T-0092) + `UserController PATCH /api/users/:id/role` (T-0087) + `UserController POST /api/users` (T-0092) 박제 후 stale — `UserResponseDto` (T-0095 박제 — 응답 shape whitelist DTO, `fromEntity` static factory + 5 readonly 필드) 박제 추가 의무.

본 task 가 **T-0095 머지 후 contract source 정합 박제** — doc-only inline-amend, 2 파일 (api.md + modules.md) 의 row 2 곳 (api.md L70 + L71) + row 1 곳 (modules.md L34) 갱신. [T-0093](T-0093-api-md-users-signup-row-and-modules-md-amend.md) (api.md L70 POST /api/users row + modules.md L34 UserModule row amend, direct-mode doc-only inline-amend × 0.23 sub-multiplier, MERGED `29eb63b` actual +8/-2 LOC) + [T-0088](T-0088-api-md-users-role-row-and-modules-md-amend.md) (api.md PATCH /api/users/:id/role row + modules.md UserModule row amend × 0.19 sub-multiplier MERGED) 정공법 1:1 mirror — T-0095 머지 후 contract source 정합 동기 5 회차 누적 doc-only inline-amend (T-0084 × 0.37 + T-0088 × 0.19 + T-0089 × 0.91 + T-0093 × 0.23 + 본 task × 0.64 envelope estimate).

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — 본 task 의 amend target 1. §5 endpoint 표의 `POST /api/users` row (L70) + `PATCH /api/users/:id/role` row (L71).
- [docs/architecture/modules.md](../architecture/modules.md) — 본 task 의 amend target 2. L34 UserModule row 책임 description.
- [docs/tasks/T-0095-user-response-dto-hashed-password-removal.md](T-0095-user-response-dto-hashed-password-removal.md) — 직전 머지 task. UserResponseDto 박제 source (private constructor + `fromEntity` static factory + 5 readonly 필드) + Acceptance Criteria A~F + Out of Scope (api.md / modules.md 응답 shape amend = 본 task scope).
- [docs/tasks/T-0093-api-md-users-signup-row-and-modules-md-amend.md](T-0093-api-md-users-signup-row-and-modules-md-amend.md) — 정공법 precedent 1. 본 task 와 동일 doc-only inline-amend 패턴, api.md row + modules.md UserModule row 갱신 + grep 검증 패턴 1:1 mirror.
- [docs/tasks/T-0088-api-md-users-role-row-and-modules-md-amend.md](T-0088-api-md-users-role-row-and-modules-md-amend.md) — 정공법 precedent 2. PATCH /api/users/:id/role row 의 직전 amend (× 0.19 sub-multiplier).
- [src/user/dto/user-response.dto.ts](../../src/user/dto/user-response.dto.ts) — 실 구현 검증 source. UserResponseDto class + private constructor + `fromEntity` static factory + 5 readonly 필드 (`id` / `email` / `role` / `createdAt` / `updatedAt`) + `hashedPassword` 컬럼 미포함 박제.
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — 응답 매핑 박제 source. `signup()` / `changeRole()` 두 메서드 반환 type `Promise<UserResponseDto>` + `UserResponseDto.fromEntity(user)` 매핑.
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — 후속 chain 박제 sub-section (T-0089 amend). T-0095 머지 시점이 §6 application-layer last-mile (HTTP 응답 layer 의 hashedPassword 차단) 완결 박제 — 본 task 가 contract source 에 동 박제 반영.
- [CLAUDE.md §3.1](../../CLAUDE.md) — commitMode 정책. docs/architecture/*.md 단일 파일 inline-amend 는 direct.
- [CLAUDE.md §12](../../CLAUDE.md) — 언어 정책. table content 한국어 / METHOD/path/auth tier enum 영어 유지.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — doc-only inline-amend × 1.6 × 0.4 = × 0.64 multiplier (T-0070 / T-0073 / T-0076 / T-0084 / T-0088 / T-0089 / T-0093 박제 누적 7 회차).

## Acceptance Criteria

분기 없음 — 본 task 는 doc-only inline-amend, R-112 의 happy/error/branch/negative test 항목 적용 불가. 검증은 grep / 파일 inspect 로.

### A. api.md §5 POST /api/users row 응답 shape 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L70 의 row description 응답 부분 갱신: "응답 201 + User row body" → **"응답 201 + `UserResponseDto` body (5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` — `hashedPassword` 응답 누출 차단, T-0095 박제 — `UserResponseDto.fromEntity(user)` static factory 매핑, private constructor + whitelist 5 필드 securing). defence in depth 2 layer 박제 — DB-level bcrypt 10 rounds (T-0092 박제) + HTTP-layer UserResponseDto whitelist (T-0095 박제), ADR-0008 §6 application-layer last-mile 완결."**. 기존 "실패 409 / 400 / 500" 분기 + "T-0092 박제 — REQ-044 후반 첫 로긴 SuperAdmin backbone + ADR-0008 §6 chain last-mile 박제 완결" 박제는 유지.

### B. api.md §5 PATCH /api/users/:id/role row 응답 shape 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L71 의 row description 응답 부분 갱신: "응답 200 + user body" → **"응답 200 + `UserResponseDto` body (5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` — `hashedPassword` 응답 누출 차단, T-0095 박제 — `UserResponseDto.fromEntity(user)` static factory 매핑, POST /api/users 응답과 동일 shape)."**. 기존 "실패 401 / 403 / 404 / 400" 분기 + "T-0087 박제 — RBAC 첫 production 적용 endpoint" 박제는 유지.

### C. modules.md UserModule row 책임 description 갱신

- [ ] [docs/architecture/modules.md](../architecture/modules.md) L34 의 UserModule row 책임 description 의 chain 박제 추가: 기존 "... + UserController POST /api/users (T-0092 박제 — Public tier signup endpoint + REQ-044 후반 첫 로긴 SuperAdmin backbone). AuthService inject via forwardRef ..." → **"... + UserController POST /api/users (T-0092 박제 — Public tier signup endpoint + REQ-044 후반 첫 로긴 SuperAdmin backbone) + UserResponseDto (T-0095 박제 — 응답 shape whitelist DTO, private constructor + `fromEntity` static factory + 5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` — POST signup + PATCH changeRole 두 endpoint 응답 매핑 동일 박제, `hashedPassword` 응답 누출 차단 application-layer last-mile). AuthService inject via forwardRef ..."**. 기존 "password reset / list / response shape 정제 등 후속 endpoint chain 은 follow-up task" 박제는 **"password reset / list / fromEntities 배열 helper (GET /api/users list endpoint 박제 시점) / ClassSerializerInterceptor 도입 ADR 등 후속 endpoint chain 은 follow-up task"** 로 갱신 — T-0095 머지 후 잔여 follow-up 정합 박제.

### D. 검증 (grep + 파일 inspect)

- [ ] D1: `grep -c "T-0095" docs/architecture/api.md` ≥ 2 — 본 task 의 api.md L70 + L71 두 amend 가 T-0095 cross-ref 박제 검증.
- [ ] D2: `grep -c "UserResponseDto" docs/architecture/api.md` ≥ 2 — 두 row 응답 shape 박제 검증 (L70 + L71 각 1+).
- [ ] D3: `grep -c "hashedPassword" docs/architecture/api.md` ≥ 2 — 응답 누출 차단 박제 검증 (L70 + L71 각 1+).
- [ ] D4: `grep -c "defence in depth" docs/architecture/api.md` ≥ 1 — 2 layer security primary intent 박제 검증 (L70 amend 박제).
- [ ] D5: `grep -c "T-0095" docs/architecture/modules.md` ≥ 1 — modules.md UserModule row 의 T-0095 cross-ref 박제 검증.
- [ ] D6: `grep -c "UserResponseDto" docs/architecture/modules.md` ≥ 1 — UserResponseDto 박제 검증.
- [ ] D7: `grep -c "fromEntity" docs/architecture/modules.md` ≥ 1 — static factory 박제 검증.
- [ ] D8: 두 파일 모두 markdown 표 syntax 깨짐 없음 — 본 task 후 `grep -n "^|.*|.*|" docs/architecture/api.md` 으로 row count 변동 0 확인 (row 추가 / 삭제 없이 in-place 갱신).
- [ ] D9: 본 commit 의 diff 가 docs/architecture/api.md + docs/architecture/modules.md 2 파일에만 한정. 그 외 파일 (src/* / test/* / package.json / prisma/schema.prisma 등) 변경 0 — direct main commit scope 박제.

### E. STATE / journal / commit

- [ ] [docs/STATE.json](../STATE.json): `currentTask` → null, `mostRecentTasks` prepend `"T-0096"` (cap 5), `counters.tasksCompleted` +1 (read-modify-write — `git fetch origin main` 직후 base 값 +1), `lastCommit` → 본 commit sha, `lastActivity` → 본 ISO. `lock` 해제 (`holder: ""`, `since: ""`).
- [ ] [docs/tasks/T-0096-api-md-user-response-shape-amend.md](T-0096-api-md-user-response-shape-amend.md) (본 파일) frontmatter `status: DONE` + `completedAt` + `actualDiff` + `actualFiles` + `driverNote` 박제.
- [ ] [docs/progress/journal-YYYY-MM-DD.md](../progress/) 에 1~5 줄 append — 본 task 의 amend 결과 + multiplier variance + cross-ref.
- [ ] Direct main commit — feature branch 0, PR 0, reviewer/integrator 4-게이트 0 (doc-only direct, [CLAUDE.md §3.1](../../CLAUDE.md) 분기 정합).
- [ ] Commit message subject (한국어 본문 + 영어 prefix): `docs(architecture): T-0096 api.md POST /api/users + PATCH role row 응답 shape + modules.md UserModule UserResponseDto cross-ref amend — T-0095 박제 (T-0096)`.
- [ ] Commit message body 에 trail blob 박제 ([CLAUDE.md §11](../../CLAUDE.md) 표준 포맷) — planner / implementer / acceptance section.

## Out of Scope

- **GET /api/users list endpoint 박제** — UserResponseDto fromEntities 배열 helper + UserController.list + pagination. 별도 task (planner 후보).
- **ClassSerializerInterceptor 도입 ADR** — class-transformer `@Expose` / `@Exclude` 기반의 nest-wide response serialization. UserResponseDto 정공법과 trade-off 박제 별도 ADR.
- **다른 entity ResponseDto 일반화** — PersonResponseDto / GroupResponseDto / PartResponseDto. 별도 task chain (entity 별 layer 박제 의무).
- **Prisma select projection 박제** — DB query 시점 hashedPassword 컬럼 자체 제외 — UserResponseDto whitelist 와 별도 layer (defence in depth 추가 layer 후보). 별도 task / ADR.
- **POST /api/users RBAC 강화 ADR** — 첫 user 후 endpoint 를 Admin+ 격상 또는 분리 endpoint `/api/auth/setup` 박제. 별도 ADR + task ([T-0092 Out of Scope](T-0092-signup-endpoint.md) 박제 그대로).
- **RefreshToken DB table + revocation** — ADR-0008 §6 후속 chain (DB layer). 별도 task (architect=1 — schema 결정 layer).
- **signup → login round-trip e2e** — POST /api/users + POST /api/auth/login + GET /api/auth/me 의 e2e. 별도 task.
- **UC-04 use case doc 의 §5 sequence diagram amend** — UC-04 본문이 UserResponseDto 응답 매핑 박제 추가 의무 검토 시 별도 doc-only direct task. 본 task 는 architecture spec layer (api.md + modules.md) 만 amend.
- **estimate-model.md doc-only inline-amend × 0.64 multiplier variance 박제** — 본 task 의 envelope 35 LOC vs actual variance 데이터 누적은 estimate-model.md milestone refinement (별도 task) 의 책임.

## Suggested Sub-agents

`implementer → tester` 만 (doc-only direct). tester 는 변경 0 — direct doc commit 은 R-110~R-114 면제 (production code 0). 단 driver 가 D1~D9 grep / inspect 자체 검증.

architect=0, reviewer=0, integrator=0 (direct main commit).

driver inline 경로 (executor sub-agent dispatch 없이 driver 가 직접 doc edit + grep D1~D9 검증) 도 정합 — T-0093 driver inline 패턴 1:1 mirror.

## Follow-ups

- **GET /api/users list endpoint 박제** — UserResponseDto.fromEntities 배열 helper + UserController.list + pagination. 별도 task.
- **ClassSerializerInterceptor 도입 ADR** — class-transformer 기반 nest-wide response serialization trade-off. 별도 ADR + task.
- **다른 entity ResponseDto 일반화** — Person / Group / Part 도메인 별 ResponseDto chain. 별도 task chain.
- **Prisma select projection 박제** — DB query 시점 hashedPassword 컬럼 자체 제외. 별도 task / ADR.
- **POST /api/users RBAC 강화 ADR** — 첫 user 후 endpoint 를 Admin+ 격상 또는 분리 endpoint `/api/auth/setup` 박제. 별도 ADR + task.
- **RefreshToken DB table + revocation path** — ADR-0008 §6 박제. Prisma schema RefreshToken 신설 + UserService 또는 AuthService rotation 분기. 별도 task (architect=1 — schema 결정 layer).
- **signup → login round-trip e2e** — POST /api/users + POST /api/auth/login + GET /api/auth/me 의 e2e. 별도 task.
- **UC-04 use case doc amend** — UserResponseDto 응답 매핑 박제 + sequence diagram amend. 별도 doc-only direct task.
- **estimate-model.md milestone refinement** — 본 task 의 doc-only inline-amend × 0.64 multiplier variance 누적 데이터 박제 (T-0070 / T-0073 / T-0076 / T-0084 / T-0088 / T-0089 / T-0093 / 본 task 8 회차). 별도 task.
