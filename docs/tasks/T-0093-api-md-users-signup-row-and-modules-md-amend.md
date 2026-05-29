---
id: T-0093
title: api.md POST /api/users row amend + modules.md UserModule row 갱신 — T-0092 signup 실 구현 박제
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044]
estimatedDiff: 35
estimatedFiles: 2
created: 2026-05-29
dependsOn: [T-0092]
plannerNote: "session #26 turn 6 planner — T-0092 signup 머지 후 api.md POST /api/users row + modules.md UserModule row 실 구현 동기 박제. doc-only inline-amend × 0.64, ~35 LOC."
---

# T-0093 — api.md POST /api/users row amend + modules.md UserModule row 갱신

## Why

[T-0092](T-0092-signup-endpoint.md) (MERGED `f97329b` PR-87, AddUserDto + UserService.signup + UserRepository.countAll + UserController @Post() + 첫 user SuperAdmin 자동 분기 + colocated spec 39 it + e2e 5 it 박제) 머지 후 [docs/architecture/api.md](../architecture/api.md) §5 endpoint 표의 `POST /api/users` row (L70) 가 실 구현 (4 invariant 박제 — 첫 user SuperAdmin / 두 번째 이후 User default / email P2002 → 409 / AddUserDto validation → 400) 박제 0. 현 row description ("신규 user 계정 생성 (등급 default = User)") + auth tier ("Admin+") 가 본 endpoint 의 실 구현과 합치 안 함:

- **분기 박제 누락** — 첫 등록 user 는 role="SuperAdmin" 자동 분기 (REQ-044 후반 "첫 로긴" backbone), 두 번째 이후만 role="User" default. 현 row 가 "등급 default = User" 만 박제하여 분기 불일치.
- **auth tier 불일치** — 현 row 가 "Admin+" 박제이나 실 구현은 **Public** (인증 없는 첫 user 진입 path 필수, T-0092 acceptance §F 박제). 본 Public 박제는 향후 RBAC 강화 task ([T-0092 Out of Scope](T-0092-signup-endpoint.md) Follow-up 박제) 에서 격상 검토 — 단 현 시점 contract 는 Public 정합.
- **에러 분기 누락** — 409 Conflict (email duplicate P2002 → ConflictException 변환) / 400 BadRequest (ValidationPipe — `@IsEmail` / `@IsNotEmpty` / `@MinLength(8)` 위반) / 201 Created (정상 응답 + User row body) 분기 박제 부재.

추가로 [docs/architecture/modules.md](../architecture/modules.md) L34 의 UserModule row 책임 description ("UserRepository (T-0080 박제) + UserService.changeRole (T-0086 박제 — REQ-044 5 invariant) + UserController.PATCH /api/users/:id/role (T-0087 박제 — RBAC 첫 production 사용 사례). ... signup / password reset / list 등 후속 endpoint chain 은 T-0089~T-0091 candidate.") 가 T-0092 머지 후 stale — signup endpoint 가 실 머지되었으므로 chain candidate 가 아니라 실 박제 chain 일부로 갱신 의무. 동시 관련 ADR 컬럼의 ADR-0008 reference 의미를 §6 chain 의 last-mile 박제 완결 ([T-0089](T-0089-adr-0008-section-6-retroactive-amend.md) retroactive amend 박제 기준) 반영.

본 task 가 **T-0092 머지 후 contract source 정합 박제** — doc-only inline-amend, 2 파일 (api.md + modules.md) 의 row 2 곳 amend. [T-0088](T-0088-api-md-users-role-row-and-modules-md-amend.md) (api.md PATCH /api/users/:id/role row + modules.md UserModule row amend, direct-mode doc-only inline-amend × 0.64, MERGED actual +3/-3 LOC × 0.19 sub-multiplier) 정공법 1:1 mirror — RBAC backbone last-mile 박제 (T-0083 → T-0086 → T-0087 → T-0092 chain 4/4 closed) 후 contract source 정합 동기.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) — 본 task 의 amend target 1. §5 endpoint 표의 `POST /api/users` row (L70).
- [docs/architecture/modules.md](../architecture/modules.md) — 본 task 의 amend target 2. L34 UserModule row 책임 description.
- [docs/tasks/T-0092-signup-endpoint.md](T-0092-signup-endpoint.md) — 직전 머지 task. Acceptance Criteria §F (POST endpoint 박제) + §C (UserService.signup 4 invariant) + Out of Scope (RBAC 강화 / response shape 정제 / password 정책 등 follow-up 박제).
- [docs/tasks/T-0088-api-md-users-role-row-and-modules-md-amend.md](T-0088-api-md-users-role-row-and-modules-md-amend.md) — 정공법 precedent. 본 task 와 동일 doc-only inline-amend 패턴, api.md row + modules.md UserModule row 갱신 + grep 검증 패턴 1:1 mirror.
- [docs/tasks/T-0084-api-md-auth-endpoints-amend.md](T-0084-api-md-auth-endpoints-amend.md) — 정공법 precedent (api.md /api/auth/* row amend × 0.37 multiplier).
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — 실 구현 검증 source. `@Post()` + `@HttpCode(201)` + AddUserDto + Public (guard 0) + service.signup forwarding 박제.
- [src/user/user.service.ts](../../src/user/user.service.ts) — service layer 박제 source. signup 메서드의 4 invariant (countAll → SuperAdmin/User 분기 + bcrypt 10 rounds hash + P2002 → ConflictException 변환).
- [src/user/dto/add-user.dto.ts](../../src/user/dto/add-user.dto.ts) — DTO 박제 source. `@IsEmail` / `@IsNotEmpty` / `@MinLength(8)` 박제.
- [docs/decisions/ADR-0008-auth-credential-type.md §6](../decisions/ADR-0008-auth-credential-type.md) — 후속 chain 실현 박제 sub-section (T-0089 amend). T-0092 머지 시점이 §6 chain last-mile (POST signup controller) 완결 박제 — 본 task 가 contract source 에 동 박제 반영.
- [CLAUDE.md §3.1](../../CLAUDE.md) — commitMode 정책. docs/architecture/*.md 단일 파일 inline-amend 는 direct.
- [CLAUDE.md §12](../../CLAUDE.md) — 언어 정책. table content 한국어 / METHOD/path/auth tier enum 영어 유지.
- [docs/architecture/estimate-model.md §4](../architecture/estimate-model.md) — doc-only inline-amend × 1.6 × 0.4 = × 0.64 multiplier (T-0070 / T-0073 / T-0076 / T-0084 / T-0088 / T-0089 박제 누적).

## Acceptance Criteria

분기 없음 — 본 task 는 doc-only inline-amend, R-112 의 happy/error/branch/negative test 항목 적용 불가. 검증은 grep / 파일 inspect 로.

### A. api.md §5 POST /api/users row description 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L70 의 row description 갱신: "신규 user 계정 생성 (등급 default = User)" → **"신규 user 계정 생성 — `AddUserDto` validation (`@IsEmail` + `@IsNotEmpty` + `@MinLength(8)` password) + `UserService.signup` 4 invariant 박제 (countAll === 0 → role="SuperAdmin" 자동 / count > 0 → role="User" default / bcrypt 10 rounds password hash / P2002 email duplicate → 409 ConflictException 변환). 응답 201 + User row body. 실패 409 (email 중복) / 400 (DTO 위반 — `@IsEmail` / `@IsNotEmpty` / `@MinLength(8)`) / 500 (그 외 Prisma raw propagate). T-0092 박제 — REQ-044 후반 첫 로긴 SuperAdmin backbone + ADR-0008 §6 chain last-mile 박제 완결."**

### B. api.md §5 POST /api/users row auth tier 갱신

- [ ] [docs/architecture/api.md](../architecture/api.md) L70 의 auth tier 컬럼 갱신: "Admin+" → **"Public (T-0092 박제 — 첫 user 진입 path 필수, guard 미적용. 향후 첫 user 등록 후 endpoint 를 Admin+ 격상 또는 분리 endpoint `/api/auth/setup` 박제는 별도 ADR — [T-0092 Out of Scope](../tasks/T-0092-signup-endpoint.md) 박제 follow-up)"**.

### C. modules.md UserModule row 책임 description 갱신

- [ ] [docs/architecture/modules.md](../architecture/modules.md) L34 의 UserModule row 책임 description 갱신: "UserRepository (T-0080 박제) + UserService.changeRole (T-0086 박제 — REQ-044 5 invariant) + UserController.PATCH /api/users/:id/role (T-0087 박제 — RBAC 첫 production 사용 사례). 평가 대상 인원 (Person / Group / Part) 은 별도 PersonModule / GroupModule / PartModule 책임 (모듈 분리 박제 — T-0035 + T-0039 chain). signup / password reset / list 등 후속 endpoint chain 은 T-0089~T-0091 candidate." → **"UserRepository (T-0080 박제) + UserService.changeRole (T-0086 박제 — REQ-044 5 invariant) + UserService.signup (T-0092 박제 — countAll === 0 → SuperAdmin 자동 / bcrypt 10 rounds / P2002 → 409 4 invariant) + UserController PATCH /api/users/:id/role (T-0087 박제 — RBAC 첫 production 사용 사례) + UserController POST /api/users (T-0092 박제 — Public tier signup endpoint + REQ-044 후반 첫 로긴 SuperAdmin backbone). AuthService inject via forwardRef (T-0092 박제 — AuthModule↔UserModule circular 해결). 평가 대상 인원 (Person / Group / Part) 은 별도 PersonModule / GroupModule / PartModule 책임 (모듈 분리 박제 — T-0035 + T-0039 chain). password reset / list / response shape 정제 등 후속 endpoint chain 은 follow-up task."**

### D. 검증 (grep + 파일 inspect)

- [ ] D1: `grep -c "T-0092" docs/architecture/api.md` ≥ 1 — 본 task 의 api.md L70 amend 가 T-0092 cross-ref 박제 검증.
- [ ] D2: `grep -c "AddUserDto" docs/architecture/api.md` ≥ 1 — DTO 박제 검증.
- [ ] D3: `grep -c "countAll" docs/architecture/api.md` ≥ 1 — 첫 user 분기 invariant 박제 검증.
- [ ] D4: `grep -c "Public" docs/architecture/api.md` ≥ 1 — auth tier 박제 검증 (기존 §3 Public row 1 + 본 amend 1 = ≥ 2 가 자연 결과).
- [ ] D5: `grep -c "T-0092" docs/architecture/modules.md` ≥ 1 — modules.md UserModule row 의 T-0092 cross-ref 박제 검증.
- [ ] D6: `grep -c "UserService.signup" docs/architecture/modules.md` ≥ 1 — signup service 박제 검증.
- [ ] D7: `grep -c "forwardRef" docs/architecture/modules.md` ≥ 1 — AuthService inject 패턴 박제 검증.
- [ ] D8: 두 파일 모두 markdown 표 syntax 깨짐 없음 — 본 task 후 `grep -n "^|.*|.*|" docs/architecture/api.md` 으로 row count 변동 0 확인 (row 추가 / 삭제 없이 in-place 갱신).
- [ ] D9: 본 commit 의 diff 가 docs/architecture/api.md + docs/architecture/modules.md 2 파일에만 한정. 그 외 파일 (src/* / test/* / package.json / prisma/schema.prisma 등) 변경 0 — direct main commit scope 박제.

### E. STATE / journal / commit

- [ ] [docs/STATE.json](../STATE.json): `currentTask` → null, `mostRecentTasks` prepend `"T-0093"` (cap 5), `counters.tasksCompleted` +1 (read-modify-write — `git fetch origin main` 직후 base 값 +1), `lastCommit` → 본 commit sha, `lastActivity` → 본 ISO. `lock` 해제 (`holder: ""`, `since: ""`).
- [ ] [docs/tasks/T-0093-api-md-users-signup-row-and-modules-md-amend.md](T-0093-api-md-users-signup-row-and-modules-md-amend.md) (본 파일) frontmatter `status: DONE` + `completedAt` + `actualDiff` + `actualFiles` + `driverNote` 박제.
- [ ] [docs/progress/journal-2026-05-29.md](../progress/journal-2026-05-29.md) 에 1~5 줄 append — 본 task 의 amend 결과 + multiplier variance + cross-ref.
- [ ] Direct main commit — feature branch 0, PR 0, reviewer/integrator 4-게이트 0 (doc-only direct, [CLAUDE.md §3.1](../../CLAUDE.md) 분기 정합).
- [ ] Commit message subject (한국어 본문 + 영어 prefix): `docs(architecture): T-0093 api.md POST /api/users row + modules.md UserModule row amend — T-0092 signup 박제 (T-0093)`.
- [ ] Commit message body 에 trail blob 박제 ([CLAUDE.md §11](../../CLAUDE.md) 표준 포맷) — planner / implementer / acceptance section.

## Out of Scope

- **POST /api/users 의 RBAC 강화 (Admin+ tier 격상)** — 별도 ADR + task 의 책임. 본 task 는 현 시점 Public 박제만 contract source 에 반영. T-0092 Out of Scope 박제 follow-up 그대로 보존.
- **첫 user 분기 race window 강제** — DB advisory lock / unique constraint on role="SuperAdmin" 등의 강제는 별도 ADR + task. 본 task 의 amend 도 service-layer count check 분기만 박제 (race 박제 0).
- **User response shape 정제 (hashedPassword 제거)** — UserResponseDto 또는 Prisma select projection. 별도 task. 본 task 의 amend 가 응답 body 박제 시 "User row body" 만 박제하고 hashedPassword 컬럼 포함/배제 명시 0 (T-0092 Out of Scope follow-up 그대로).
- **password 정책 강화** — 복잡도 (대문자/숫자/특수문자) / blacklist / breach API check 등 별도 task / ADR. 본 task 는 현 시점 `@MinLength(8)` 만 박제.
- **email 검증 (verification mail)** — email confirm flow 0. 별도 task / ADR.
- **rate limiting / brute-force 차단** — signup endpoint 의 자동화 차단 (CAPTCHA / rate limit) 없음. 별도 task.
- **auth.e2e-spec.ts 신설 (login flow e2e)** — POST /api/auth/login + logout + refresh end-to-end e2e. 별도 task (T-0094 후보).
- **RefreshToken DB table + revocation** — ADR-0008 §6 박제 별도 chain. 별도 task (T-0095 후보).
- **UC-04 use case doc 의 §5 sequence diagram amend** — UC-04 본문이 signup flow 박제 추가 의무 검토 시 별도 doc-only direct task. 본 task 는 architecture spec layer (api.md + modules.md) 만 amend.
- **estimate-model.md doc-only inline-amend × 0.64 multiplier variance 박제** — 본 task 의 envelope 35 LOC vs actual variance 데이터 누적은 estimate-model.md milestone refinement (별도 task) 의 책임.

## Suggested Sub-agents

`implementer → tester` 만 (doc-only direct). tester 는 변경 0 — direct doc commit 은 R-110~R-114 면제 (production code 0). 단 driver 가 D1~D9 grep / inspect 자체 검증.

architect=0, reviewer=0, integrator=0 (direct main commit).

## Follow-ups

- **auth.e2e-spec.ts 신설 (login flow e2e)** — POST /api/auth/login + logout + refresh end-to-end. T-0091 helper + T-0092 signup 의 round-trip 검증. T-0094 후보.
- **RefreshToken DB table + revocation path** — ADR-0008 §6 박제. Prisma schema RefreshToken 신설 + UserService 또는 AuthService rotation 분기. 별도 task (T-0095 후보, architect=1 — schema 결정 layer).
- **POST /api/users RBAC 강화 ADR** — 첫 user 후 endpoint 를 Admin+ 격상 또는 분리 endpoint (`POST /api/auth/setup`) 박제. 별도 ADR + task.
- **첫 user 분기 race window 강제 ADR** — DB advisory lock 또는 unique constraint on role="SuperAdmin" 의 trade-off 박제. 별도 ADR.
- **User response shape 정제** — UserResponseDto 또는 Prisma select projection (hashedPassword 제거). 별도 task.
- **password 정책 강화 ADR** — 복잡도 / blacklist / breach API. 별도 ADR + task.
- **email verification flow ADR** — verification mail + token. 별도 ADR.
- **UC-04 use case doc amend** — signup flow 박제 + 첫 user SuperAdmin 분기 sequence diagram. 별도 doc-only direct task.
- **estimate-model.md milestone refinement** — 본 task 의 doc-only inline-amend × 0.64 multiplier variance 누적 데이터 박제 (T-0070 / T-0073 / T-0076 / T-0084 / T-0088 / T-0089 / 본 task 7 회차). 별도 task.
