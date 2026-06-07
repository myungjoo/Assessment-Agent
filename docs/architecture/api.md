# API contract

> **본 문서는 P2 의 넷째 entry artifact ([T-0030](../tasks/T-0030-p2-api-contract.md)) 의 산출물이다.** [docs/PLAN.md](../PLAN.md) Phase P2 의 "API contract 초안" bullet (L37) 을 cover. 8 UC ([UC-01](../use-cases/UC-01-evaluation-execution.md) ~ [UC-08](../use-cases/UC-08-permission-denied.md)) 의 §5 sequence diagram + §9 component/module mapping 에서 호명된 HTTP endpoint 를 단일 표로 박제하여 P3+ Backend API 구현 task 의 contract source 로 사용한다. **본 문서는 living document** — endpoint 가 새로 식별되거나 기존 endpoint 가 분리·통합되면 architect agent 가 본 표를 갱신한다.

## 1. 개요

본 문서의 범위는 **MVA (Minimum Viable Architecture)** 수준에 한정한다 — METHOD / path / 책임 UC / 1 줄 description / auth tier 5 컬럼의 endpoint 표 + 표준 status code policy + UC §5 sequence step cross-reference 까지만 박제. **구체 JSON request/response schema · validation rule · OpenAPI YAML · 예시 payload · endpoint 별 특수 status code 는 본 문서의 범위 밖** 이며 [§ 8](#-8-out-of-scope) 에 명시. 그 구체화는 P3+ 의 `src/<module>/<module>.controller.ts` + DTO + class-validator + e2e test fixture 의 책임이다.

본 문서가 박제하는 것 (총 9 section):

- § 1 개요 / § 2 Protocol & host / § 3 Auth tier / § 4 Resource model — 시스템 차원의 base
- § 5 Endpoint 표 — **핵심 산출물**, 8 UC §5 sequence 의 호명을 1:1 row 로 박제
- § 6 표준 status code policy / § 7 UC §5 sequence cross-reference / § 8 Out of scope / § 9 References

## 2. Protocol / host

| 항목 | 결정 | source |
| --- | --- | --- |
| Protocol | **HTTPS** (TLS over TCP) — 평문 HTTP 미사용 | [ADR-0003 §4](../decisions/ADR-0003-deployment.md) (direct egress + 사내 CA `NODE_EXTRA_CA_CERTS`) |
| Host model | **단일 NestJS process** 의 HTTP listener 1 개 (port 별도 결정 — 운영 환경별 변경 가능) | [ADR-0003 §1](../decisions/ADR-0003-deployment.md) (monolithic) / [components.md](components.md) "Backend API" |
| Base path | `/api` prefix — 모든 backend endpoint 가 `/api/*` 하위 | NestJS 표준 `app.setGlobalPrefix('api')` (구체 적용은 P3) |
| Content type | `application/json; charset=utf-8` (default) / `multipart/form-data` (UC-07 Import upload 만) | UC-07 §5 sequence (file upload) |
| Auth credential | **JWT in HttpOnly Secure SameSite=Strict cookie** ([ADR-0008](../decisions/ADR-0008-auth-credential-type.md) ACCEPTED, T-0079 박제 + T-0081/T-0082 실 구현). access token 15min + refresh token 7day rotation. T-0083 RBAC scaffold 박제 (JwtStrategy cookie extractor + JwtAuthGuard + @Roles + RolesGuard). | [ADR-0008](../decisions/ADR-0008-auth-credential-type.md) / [ADR-0003 §2](../decisions/ADR-0003-deployment.md) / [modules.md](modules.md) AuthModule row |
| API versioning | **unversioned** — `/api/v1/*` 미도입. 필요 시 별도 ADR. | § 8 Out of scope |

## 3. Auth tier

3 권한 등급 ([README.md](../../README.md) L83–86, REQ-044) + Public (인증 불필요) — 모든 endpoint 는 다음 중 하나로 분류된다.

| tier | 의미 | 적용 endpoint 범위 | source REQ |
| --- | --- | --- | --- |
| **Public** | 인증 불필요. 미인증 user 도 접근 가능. | `POST /api/auth/login`, health check (별도 endpoint 도입 시) | REQ-043 (예외 — login 자체는 credential 발급 path) |
| **User** | 일반 사용자 — read-only. 조회 / sort / filter / 시계열만 가능, mutation 0. | UC-02 의 GET, UC-08 의 user-audience GET | REQ-046 (User read-only) |
| **Admin** | 관리자 — 평가 master data / LLM 설정 / 평가 실행·삭제·재수집 / Export·Import·Backup 전반의 mutation 권한 | UC-01 manual trigger / UC-03 person CRUD / UC-05 LLM config / UC-06 delete·reeval / UC-07 export·import / UC-08 admin-audience GET | REQ-045 (Admin 권한) |
| **SuperAdmin** | 최상위 — 사용자 등급 변경 권한 + Admin→User 강등 권한. 본인 self-demote 금지 (REQ-044). | `PATCH /api/users/:id/role` 전체 (T-0087 박제 — `@Roles("SuperAdmin")` 단일 적용. RBAC 첫 production 사용 사례 — JwtAuthGuard + RolesGuard + ChangeRoleDto + UserService.changeRole 4 layer 동시 박제) | REQ-044 (3 등급 + SuperAdmin 만 Admin→User) |

**tier 의 escalation 의미**: SuperAdmin ⊇ Admin ⊇ User ⊇ Public. 상위 등급은 하위 endpoint 도 호출 가능. 단 SuperAdmin self-demote 차단 등 invariant 는 endpoint 내부 검증 (AuthModule guard + UserModule service invariant).

**실 적용**: [`src/auth/roles.guard.ts`](../../src/auth/roles.guard.ts) 의 `ROLE_HIERARCHY` 가 `SuperAdmin: ["SuperAdmin", "Admin", "User"] / Admin: ["Admin", "User"] / User: ["User"]` 매핑 박제 (T-0083), [`@Roles()`](../../src/auth/roles.decorator.ts) decorator 가 endpoint metadata 로 required tier 박제 + [`JwtAuthGuard`](../../src/auth/jwt-auth.guard.ts) 와 결합하여 인증 + role 검증 layer 분리.

## 4. Resource model

본 시스템의 endpoint 는 다음 conceptual resource path prefix 로 분리된다. 각 prefix 의 책임 module 은 [modules.md](modules.md) 의 9 NestJS module (AuthModule / PersistenceModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule / SchedulerModule / WebModule) 안에서 결정 — **신규 module 신설 0**.

| prefix | 책임 module ([modules.md](modules.md)) | 책임 UC | 비고 |
| --- | --- | --- | --- |
| `/api/auth` | AuthModule | UC-04 | 로그인 / 로그아웃 / 자기 자신 (`me`) 조회 |
| `/api/users` | AuthModule + UserModule | UC-04 | 사용자 (시스템 로그인 계정) 의 CRUD + 등급 변경 (REQ-043, REQ-044) |
| `/api/persons` | UserModule | UC-03 | 평가 대상 인원 (시스템 로그인 user 와 다름) 의 CRUD (REQ-026, REQ-027) |
| `/api/groups` | UserModule | UC-03 | 임의 group N 개 — Person 다대다 (REQ-028) |
| `/api/parts` | UserModule | UC-03 | 조직도 파트 (Person 당 정확히 1, REQ-028) |
| `/api/assessments` | AssessmentModule | UC-01, UC-02, UC-06 | 평가 결과 조회 + manual trigger + 삭제·재수집 (REQ-038, REQ-040, REQ-041, REQ-037). **CRUD 는 UserModule controller 에서 shipped (T-0117); batch (manual trigger·bulk delete·reeval) 는 P5 deferred** |
| `/api/contributions` | UserModule | UC-01, UC-02 | 개별 commit/PR/문서 단위 기여 (REQ-033) — Assessment 의 component, immutable (PATCH 부재). T-0118 박제 |
| `/api/summaries` | UserModule | UC-02 | 일/주/월 시계열 요약 평가 (REQ-034, REQ-035, REQ-038) — immutable (PATCH 부재). T-0119 박제 |
| `/api/llm` | LlmModule | UC-05 | LLM provider · 난이도 매핑 설정 (REQ-049, REQ-050) |
| `/api/admin` | AssessmentModule (controller) | UC-07 | Export / Import / Backup / Restore (REQ-030, REQ-032 — Admin 전용 sub-namespace) |
| `/api/me` | AuthModule + AssessmentModule | UC-08 (user audience) | 인증된 user 본인 시점의 read endpoint (예: 본인 관련 권한 부족 통지) |

resource 이름은 영문 복수 + kebab-case — 자세한 path 규약은 § 5 endpoint 표에서 박제.

## 5. Endpoint 표

본 표는 8 UC §5 sequence diagram + §9 component/module mapping 에서 호명된 endpoint 를 모두 수집. **description 컬럼은 ≤ 1 줄로 압축** — 구체 schema 는 P3 controller task 가 박제.

| METHOD | path | UC | description | auth tier |
| --- | --- | --- | --- | --- |
| **UC-04 권한·계정 (`/api/auth`, `/api/users`)** | | | | |
| POST | `/api/auth/login` | [UC-04](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram) | email + password 인증 (`LoginDto` validation), 성공 시 HttpOnly Secure SameSite=Strict Path=/ cookie 에 access (15min) + refresh (7day) token 발급, response body `{ userId }` (T-0082 박제). 실패 시 401 `Invalid credentials` (email 부재 + password 불일치 동일 응답으로 enumeration attack 차단). | Public |
| POST | `/api/auth/logout` | UC-04 | access_token + refresh_token cookie clear 2 종, 204 No Content. cookie 미존재 상태에서도 idempotent (T-0082 박제). | User+ |
| POST | `/api/auth/refresh` | UC-04 | refresh_token cookie 검증 (AuthService.verifyToken with refresh secret) → 신규 access + refresh token 발급 (rotation, [ADR-0008 §3](../decisions/ADR-0008-auth-credential-type.md)) + cookie set 2 종, response body `{ userId }`. 실패 시 401 (missing cookie / expired / invalid signature 동일 응답, T-0082 박제). | User+ |
| GET | `/api/auth/me` | UC-04 | 현재 인증 user 본인의 등급 + 식별자 self-detail 조회 (JwtAuthGuard 단독 + req.user.sub → UserService.findById → UserResponseDto.fromEntity → 200, 5 readonly 필드 id/email/role/createdAt/updatedAt, hashedPassword 응답 누출 차단). 실패 401 (cookie 부재 / invalid token) / 404 (token 유효하나 DB row 부재 — P2025 → NotFoundException propagate). T-0106 박제 (PR-107, sha 62f93aa, round 1 single-shot) — T-0101 controller-detail 패턴의 path-param 없는 self-detail mirror, ADR-0008 §6 application-layer last-mile chain 완결 박제점. | User+ |
| POST | `/api/users` | [UC-04 §5 step 1](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram) | 신규 user 계정 생성 — `AddUserDto` validation (`@IsEmail` + `@IsNotEmpty` + `@MinLength(8)` password) + `UserService.signup` 4 invariant 박제 (countAll === 0 → role="SuperAdmin" 자동 / count > 0 → role="User" default / bcrypt 10 rounds password hash / P2002 email duplicate → 409 ConflictException 변환). 응답 201 + `UserResponseDto` body (5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` — `hashedPassword` 응답 누출 차단, T-0095 박제 — `UserResponseDto.fromEntity(user)` static factory 매핑, private constructor + whitelist 5 필드 securing). defence in depth 2 layer 박제 — DB-level bcrypt 10 rounds (T-0092 박제) + HTTP-layer UserResponseDto whitelist (T-0095 박제), ADR-0008 §6 application-layer last-mile 완결. 실패 409 (email 중복) / 400 (DTO 위반 — `@IsEmail` / `@IsNotEmpty` / `@MinLength(8)`) / 500 (그 외 Prisma raw propagate). T-0092 박제 — REQ-044 후반 첫 로긴 SuperAdmin backbone + ADR-0008 §6 chain last-mile 박제 완결. | Public (T-0092 박제 — 첫 user 진입 path 필수, guard 미적용. 향후 첫 user 등록 후 endpoint 를 Admin+ 격상 또는 분리 endpoint `/api/auth/setup` 박제는 별도 ADR — [T-0092 Out of Scope](../tasks/T-0092-signup-endpoint.md) 박제 follow-up) |
| PATCH | `/api/users/:id/role` | UC-04 §5 step 4 | user 등급 변경 — `ChangeRoleDto.role` validation (`@IsIn(["SuperAdmin", "Admin", "User"])`) + `UserService.changeRole` 5 invariant 박제 (actor=SuperAdmin / role enum / target 부재 → 404 / self-demote → 403 / P2025 race → 404). 응답 200 + `UserResponseDto` body (5 readonly 필드 `id` / `email` / `role` / `createdAt` / `updatedAt` — `hashedPassword` 응답 누출 차단, T-0095 박제 — `UserResponseDto.fromEntity(user)` static factory 매핑, POST /api/users 응답과 동일 shape). 실패 401 (cookie 부재 또는 invalid token) / 403 (User+Admin role 또는 self-demote) / 404 (target 부재) / 400 (DTO 위반). T-0087 박제 — RBAC 첫 production 적용 endpoint. | SuperAdmin (T-0087 박제 — `@Roles("SuperAdmin")` 단일. Admin 의 User→Admin 승급 분기는 README L84 후반 박제하나 본 endpoint scope 외 — 별도 task chain) |
| PATCH | `/api/users/:id/password` | UC-04 §5 step 4, §6.3 | user password 재설정 (`:id == self` → User 본인 변경 허용; `:id != self` → Admin+ 만) | User (self) / Admin+ (other) |
| **UC-03 평가 대상 인원 (`/api/persons`, `/api/groups`, `/api/parts`)** | | | | |
| GET | `/api/persons` | [UC-03 §5](../use-cases/UC-03-person-crud.md#5-main-flow-sequence-diagram) | 평가 대상 인원 목록 (active filter / group filter 가능) | User+ (조회) |
| POST | `/api/persons` | UC-03 §5 step 2 | 신규 인원 추가 (서비스 ID 매핑 + primary key + group/part) | Admin+ |
| GET | `/api/persons/:id` | UC-03 | 단일 인원 상세 조회 | User+ |
| PATCH | `/api/persons/:id` | UC-03 §5 step 2 | 인원 수정 — RFC-7396 JSON Merge Patch partial update semantic (전달된 모든 필드 적용). `fullName` / `email` / `active` 의 단독 또는 동시 patch 모두 허용 — `{active:false}` 가 Deactivate, `{active:true}` 가 Activate, 다른 필드와의 동시 patch 도 자연스러운 partial update (T-0037 박제 — 동시 patch 에서 active 묵시 drop 안 함). | Admin+ |
| DELETE | `/api/persons/:id` | UC-03 §5 step 2 | 인원 hard delete (REQ-026 — soft 는 PATCH active=false) | Admin+ |
| GET | `/api/groups` | UC-03 | 임의 group 목록 (REQ-028) | User+ |
| POST | `/api/groups` | UC-03 | group 신설 | Admin+ |
| PATCH | `/api/groups/:id` | UC-03 | group 수정 | Admin+ |
| DELETE | `/api/groups/:id` | UC-03 | group 삭제 (소속 인원의 다대다 link 만 제거) | Admin+ |
| GET | `/api/parts` | UC-03 | 조직도 파트 목록 (REQ-028) | User+ |
| POST | `/api/parts` | UC-03 | 파트 신설 | Admin+ |
| PATCH | `/api/parts/:id` | UC-03 | 파트 수정 — RFC-7396 JSON Merge Patch partial update (T-0075 박제). body shape `UpdatePartDto` (`name?: string`, IsOptional / IsString / IsNotEmpty / MaxLength(255)). response 200 OK + Part row. error: 404 NotFound (P2025 변환, T-0071 박제) / 409 Conflict (P2002 변환 — Part.name `@unique` schema-level enforce, Group 도메인 차별 분기) / 400 BadRequest (ValidationPipe 위반). | Admin+ |
| DELETE | `/api/parts/:id` | UC-03 | 파트 삭제 (소속 인원 0 일 때만 — invariant) | Admin+ |
| **UC-01 / UC-02 / UC-06 평가 (`/api/assessments`)** | | | | |
| GET | `/api/assessments` | [UC-02 §5 step 1](../use-cases/UC-02-evaluation-query.md#5-main-flow-sequence-diagram) | 평가 결과 시계열 조회 (`?personId=&period=`, findByPerson) — REQ-038. personId 누락 시 400. **T-0117 박제 (PR-119) — plain CRUD; `sort`/`filter`/`window`/page 고도화는 P5**. **T-0121 박제 (PR-122) — RBAC enforced (User+ via JwtAuthGuard+RolesGuard, @Roles(USER, ADMIN, SUPERADMIN))** | User+ |
| GET | `/api/assessments/:id` | UC-02 | 단일 평가 결과 row 상세 (404 if 부재). T-0117 박제. **T-0121 박제 (PR-122) — RBAC enforced (User+)** | User+ |
| POST | `/api/assessments` | UC-01 | 평가 결과 생성 (201, `CreateAssessmentDto` whitelist) — literal 위반 400 / `@@unique`(personId+period) 중복 409. T-0117 박제. **T-0121 박제 (PR-122) — RBAC enforced (Admin+ via @Roles(ADMIN, SUPERADMIN))** | Admin+ |
| DELETE | `/api/assessments/:id` | UC-06 | 단일 평가 결과 삭제 (204, 404 if 부재). T-0117 박제. **T-0121 박제 (PR-122) — RBAC enforced (Admin+)** | Admin+ |
| POST | `/api/assessments/run` | [UC-01 §5 alt block](../use-cases/UC-01-evaluation-execution.md#5-main-flow-sequence-diagram) | 평가 manual trigger (REQ-040) — **미구현, P5 evaluation pipeline 에서 도입 예정 (UC-06 batch)** | Admin+ |
| DELETE | `/api/assessments` | [UC-06 §5](../use-cases/UC-06-evaluation-delete-reeval.md#5-main-flow-sequence-diagram) | 최근 N 일치 bulk delete (`dateRange`, `personIds` query) — REQ-041 — **미구현, P5 (UC-06 batch)** | Admin+ |
| POST | `/api/assessments/reeval` | UC-06 §5 | 평가 없는 부분 일괄 재평가 — REQ-037 — **미구현, P5 (UC-06 batch)** | Admin+ |
| POST | `/api/assessments/reset` | UC-06 §5 | Reset & Reeval (전체 또는 범위) — REQ-037 — **미구현, P5 (UC-06 batch)** | Admin+ |
| **수집 manual trigger (`/api/assessment-collection`) — T-0271~T-0275 박제 ([ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md))** | | | | |
| POST | `/api/assessment-collection/collect` | [UC-01](../use-cases/UC-01-evaluation-execution.md) | 한 Person 의 활동 수집 manual trigger (REQ-040) — `deriveSince → Assessment 생성(placeholder 평가필드) → collectForPerson` orchestration. body `CollectTriggerDto` { `personId`, `period`, `scope`, `periodStart?`(ISO-8601) } / response 201 `CollectionTriggerSummary` { `assessmentId`, `personId`, `since`, `period`, `scope`, `periodStart`, `contributionCount` }. error: 404 (Person 부재) / 400 (literal 위반·정의 외 필드 whitelist reject) / 409 (`@@unique` 동일 경계 P2002). **T-0271~T-0275 박제 ([ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md)) — RBAC enforced (Admin+ via JwtAuthGuard+RolesGuard, @Roles("Admin")).** live/credentialed 수집(실 token)은 Q-0025 deferred. | Admin+ |
| **`/api/contributions` — 개별 commit/PR/문서 단위 기여 (T-0118 박제, PR-120; RBAC enforced T-0122)** | | | | |
| GET | `/api/contributions` | UC-01, UC-02 | assessment 별 기여 목록 (`?assessmentId=`, findByAssessment) — assessmentId 누락 시 400, 매칭 0 시 빈 배열. T-0118 박제. **T-0122 박제 (PR-124) — RBAC enforced (User+ via JwtAuthGuard+RolesGuard, @Roles(USER, ADMIN, SUPERADMIN))** | User+ |
| GET | `/api/contributions/:id` | UC-02 | 단일 기여 상세 (404 if 부재). T-0118 박제. **T-0122 박제 (PR-124) — RBAC enforced (User+)** | User+ |
| POST | `/api/contributions` | UC-01 | 기여 생성 (201, `CreateContributionDto` whitelist) — literal·FK(P2003) 위반 400, `@@unique` 부재라 409 분기 없음. T-0118 박제. **T-0122 박제 (PR-124) — RBAC enforced (Admin+ via @Roles(ADMIN, SUPERADMIN))** | Admin+ |
| DELETE | `/api/contributions/:id` | UC-06 | 단일 기여 삭제 (204, 404 if 부재). immutable 이라 PATCH 부재. T-0118 박제. **T-0122 박제 (PR-124) — RBAC enforced (Admin+)** | Admin+ |
| **`/api/summaries` — 일/주/월 시계열 요약 평가 (T-0119 박제, PR-121; RBAC enforced T-0123)** | | | | |
| GET | `/api/summaries` | UC-02 | person 별 요약 시계열 조회 (`?personId=&period=`, findByPerson) — personId 누락 시 400. T-0119 박제. **T-0123 박제 (PR-125) — RBAC enforced (User+ via JwtAuthGuard+RolesGuard, @Roles(USER, ADMIN, SUPERADMIN))** | User+ |
| GET | `/api/summaries/:id` | UC-02 | 단일 요약 상세 (404 if 부재). T-0119 박제. **T-0123 박제 (PR-125) — RBAC enforced (User+)** | User+ |
| POST | `/api/summaries` | UC-02 | 요약 생성 (201, `CreateSummaryDto` whitelist) — period literal·FK(P2003) 위반 400, 409 분기 없음. T-0119 박제. **T-0123 박제 (PR-125) — RBAC enforced (Admin+ via @Roles(ADMIN, SUPERADMIN))** | Admin+ |
| DELETE | `/api/summaries/:id` | UC-06 | 단일 요약 삭제 (204, 404 if 부재). immutable 이라 PATCH 부재. T-0119 박제. **T-0123 박제 (PR-125) — RBAC enforced (Admin+)** | Admin+ |
| **UC-05 LLM 설정 (`/api/llm`)** | | | | |
| GET | `/api/llm/providers` | [UC-05 §5](../use-cases/UC-05-llm-config.md#5-main-flow-sequence-diagram) | 등록된 LLM provider config 목록 조회 (REQ-051~055) — `LlmProviderConfigService.findAll()` 가 **apiKey (secret) 를 redact 한 sanitize view** 반환 (6 필드 id/provider/endpointUrl/modelId/createdAt/updatedAt — `apiKey` 응답 누출 차단, 명시 field pick allow-list). 다중 row / 빈 배열 (등록 0) 모두 정상. T-0140 박제 (PR-136). | Admin+ |
| GET | `/api/llm/providers/:id` | [UC-05 §5](../use-cases/UC-05-llm-config.md#5-main-flow-sequence-diagram) | 단일 LLM provider config 단건 조회 — row 부재 시 `findById` null → `NotFoundException` (404, §6 정책 align). 기존 `sanitize` view 재사용 (id/provider/endpointUrl/modelId/createdAt/updatedAt — `apiKey` (secret) 응답 누출 차단, 목록/단건 동일 allow-list). T-0142 박제 (PR #137). | Admin+ |
| POST | `/api/llm/providers` | UC-05 §5 step 2 | provider 추가 (endpoint URL / API key / model 식별자) — 201 + sanitize view (6 필드 id/provider/endpointUrl/modelId/createdAt/updatedAt — `apiKey` 응답 누출 차단). `apiKey` 는 AES-256-GCM envelope 으로 encrypt-at-rest, never-read-back ([ADR-0014](../decisions/ADR-0014-llm-provider-apikey-encryption.md)). 실패 400 (`isLlmProvider` false 미지원 provider · `@IsNotEmpty`/`@IsString`/`@MaxLength` DTO 위반 · `forbidNonWhitelisted` extra 키). **T-0149 박제 (PR #142)** | Admin+ |
| PATCH | `/api/llm/providers/:id` | UC-05 §5 step 2 | provider 수정 — 200 + sanitize view (apiKey 응답 누출 차단). 부분 갱신 시멘틱: `apiKey` 부재 시 기존 ciphertext 유지·재암호화 0·never-read-back, 명시 시 AES-256-GCM 재암호화 교체. 실패 400 (`isLlmProvider` false · DTO 위반) · 404 (P2025 부재 id). `@unique` 부재라 409 분기 없음. **T-0151 박제 (PR #144)** | Admin+ |
| DELETE | `/api/llm/providers/:id` | UC-05 §5 step 2 | provider 삭제 — 204 No Content (body 0). 실패 404 (P2025 부재 id) · 409 (P2003 — DifficultyMapping 가 in-use `onDelete: Restrict`, 먼저 슬롯 재지정 후 삭제). **T-0150 박제 (PR #143)** | Admin+ |
| GET | `/api/llm/difficulty-mappings` | UC-05 | 3 난이도 슬롯 (easy/medium/hard) ↔ provider/model 매핑 배열 조회 (REQ-049, REQ-050) — `findAllMappings`, 빈 배열 (seed 전) 도 정상. T-0139 박제 (PR-135). | Admin+ |
| PATCH | `/api/llm/difficulty-mappings/:difficulty` | UC-05 §5 step 2 | `:difficulty` slot 별 `AssignDifficultyMappingDto.llmProviderConfigId` 재지정 (REQ-049, REQ-050) — service 4xx mapping: 미지원 난이도 400 (`isDifficulty` false) / config 부재·슬롯 부재 P2025 404. T-0139 박제 (PR-135). | Admin+ |
| **UC-07 Export / Import / Backup (`/api/admin`)** | | | | |
| GET | `/api/admin/export` | [UC-07 §5](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram) | 평가 자료 export (raw 미포함, REQ-032·REQ-030) — `scope` query | Admin+ |
| POST | `/api/admin/import` | UC-07 §5 | 평가 자료 import (multipart file upload) | Admin+ |
| POST | `/api/admin/backup` | UC-07 §5 | DB backup 생성 | Admin+ |
| POST | `/api/admin/restore` | UC-07 §5 | backup 으로 reset & restore | Admin+ |
| **UC-08 권한 부족 통지 (`/api/me`, `/api/admin`)** | | | | |
| GET | `/api/me/permission-denied` | [UC-08 §5](../use-cases/UC-08-permission-denied.md#5-main-flow-sequence-diagram) | 본인 관련 권한 부족 event 조회 (REQ-008 — user audience) — **conceptual placeholder** (§5 sequence audience-split 표현, 미구현). 실제 shipped 된 통합 audit endpoint 는 아래 `/api/permission-denied-records` (단일 endpoint 가 actor.role 로 audience 차등). | User+ |
| GET | `/api/admin/permission-denied` | UC-08 §5 | 시스템 전체 권한 부족 event 조회 (REQ-016 — admin audience) — **conceptual placeholder** (위와 동일, 미구현). | Admin+ |
| GET | `/api/permission-denied-records` | UC-08 §5 | 권한 거부 record audit 조회 (REQ-016·REQ-044, 권한 부족 가시화) — RBAC `@Roles("User")` 라 authenticated 면 접근 (`JwtAuthGuard`+`RolesGuard`), audience 차등은 service-layer (Admin/SuperAdmin = 전체 record bypass / non-Admin authenticated = UserInstanceAccess allowlist 기반 own-instance 필터 — 자기 instance record 만 조회, allowlist 공집합이면 빈 배열, query.instanceRef 는 정규화 후 allowlist 와 교집합). query param `instanceRef` / `provider` (github/confluence) / `httpStatus` 필터. 응답은 record view 배열 (provider/instanceRef/resourceRef/principal/httpStatus/reason/createdAt — secret 컬럼 부재라 redaction 불요). 401 (미인증) / 200 빈 배열 (매칭 0 또는 non-Admin allowlist 공집합 — binding 0). T-0214 박제 (PR-188; [ADR-0023](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md) §5), own-instance 필터 T-0221~T-0224 박제 ([ADR-0024](../decisions/ADR-0024-user-instance-binding-data-model.md) §3). | User+ |
| **`/api/users/{id}/instance-access` — UserInstanceAccess binding grant/revoke (REQ-016·REQ-044, ADR-0027 grant chain 박제)** | | | | |
| POST | `/api/users/{id}/instance-access` | UC-08 (REQ-016·REQ-044) | path `{id}` user 에게 `instanceRef` binding 1 개 runtime 부여 (Admin 이 non-Admin 의 own-instance audit 가시 범위를 부여 → [ADR-0024](../decisions/ADR-0024-user-instance-binding-data-model.md) "safe but useless" 해소). Admin-only `@Roles("Admin")` (`JwtAuthGuard`+`RolesGuard`) — 201 Created + 생성된 binding row. self-grant (`actor.sub === {id}`) 403, 중복 binding (P2002) 409, unknown user (P2003) 404, invalid instanceRef (DTO `@IsNotEmpty` 위반 / 정규화 후 빈값) 400, 미인증 401. body `{ instanceRef: string }` (`GrantInstanceAccessDto`). T-0237 (DTO+service)·T-0238 (controller) 박제 ([ADR-0027 §1/§4](../decisions/ADR-0027-instance-access-grant-rbac-contract.md#decision-1--endpoint-surface-grant--revoke)). | Admin+ |
| DELETE | `/api/users/{id}/instance-access` | UC-08 (REQ-016·REQ-044) | path `{id}` user 의 `instanceRef` binding 1 개 runtime 회수. Admin-only `@Roles("Admin")` (`JwtAuthGuard`+`RolesGuard`) — 204 No Content (body 0). **부재 binding 은 idempotent no-op (204)** — grant 의 중복 409 와 비대칭 (revoke 는 멱등). self-revoke (`actor.sub === {id}`) 403, unknown user (P2003) 404, 미인증 401. 회수 대상 `instanceRef` 를 `DELETE` body 로 수신 (`{ instanceRef: string }`, `GrantInstanceAccessDto`). T-0238 (controller) 박제 ([ADR-0027 §1/§4](../decisions/ADR-0027-instance-access-grant-rbac-contract.md#decision-1--endpoint-surface-grant--revoke)). | Admin+ |

**합계**: 약 49 endpoint / 13 resource prefix / 8 UC cover (T-0117/T-0118/T-0119 박제로 `/api/assessments` CRUD 정정 + `/api/contributions` 4 + `/api/summaries` 4 추가, prefix 9 → 11; T-0214 박제로 `/api/permission-denied-records` audit 조회 endpoint 1 추가, prefix 11 → 12; T-0237/T-0238 박제로 `/api/users/{id}/instance-access` grant(POST)/revoke(DELETE) WRITE endpoint 2 추가, prefix 12 → 13 (ADR-0027 grant chain); `/api/assessments` 의 batch 4 건 [`/run`·bulk `DELETE`·`/reeval`·`/reset`] 은 P5 evaluation pipeline 의존 미구현 deferred). 향후 UC 추가·세분화 시 본 표가 source — endpoint 신설은 본 표 갱신 PR 의 reviewer 점검 대상.

**Auth/RBAC chain 3/3 종결 (T-0124 박제)**: Assessment/Contribution/Summary 3 controller (총 12 endpoint) 의 RBAC enforcement (User+ GET / Admin+ POST·DELETE) 는 T-0121 (PR-122) / T-0122 (PR-124) / T-0123 (PR-125) chain 으로 완료 — auth tier 컬럼 의도값 ↔ reality 가 JwtAuthGuard+RolesGuard+@Roles decorator 로 align (R-43/R-45/R-46/R-84/R-86). 다른 controller (Person / Group / Part / User / Llm / Admin / `/api/me`) 의 RBAC 적용은 별도 후속 chain (현재 미적용, P3 backbone task).

## 6. 표준 status code policy

본 시스템의 모든 endpoint 가 따르는 기본 status code 정책 — **endpoint 별 특수 status code (예: 409, 422 의 특정 발화 조건) 는 P3 implementation task 의 책임** ([§ 8](#-8-out-of-scope)).

| status | 발화 조건 | 적용 범위 |
| --- | --- | --- |
| **200 OK** | GET / PATCH / POST (action) 의 정상 완료 — body 동반 | 모든 read / mutation |
| **201 Created** | POST 가 새 resource 생성 시 — body 동반 (또는 `Location` header) | POST `/api/persons`, `/api/groups`, `/api/parts`, `/api/users`, `/api/llm/providers`, `/api/assessments/run` (run row 생성) |
| **204 No Content** | DELETE / mutation 성공 시 body 불필요한 경우 | DELETE 계열 일부 |
| **400 Bad Request** | payload validation 실패 / required 필드 누락 / 타입 불일치 | 모든 POST / PATCH |
| **401 Unauthorized** | 미인증 (login 안 함 / 세션 만료 / JWT invalid) — REQ-043 | Public 외 전체 |
| **403 Forbidden** | 인증은 됐으나 권한 부족 (예: User 가 mutation 시도 — REQ-045·046, SuperAdmin self-demote — REQ-044) | mutation endpoint 전반 |
| **404 Not Found** | resource (`:id`) 존재 안 함 | 모든 `:id` path |
| **409 Conflict** | invariant 위반 (예: SuperAdmin self-demote / part 삭제 시 소속 인원 잔존 / provider 삭제 시 difficulty-mapping 참조) | 일부 mutation — 구체 분기는 P3 |
| **500 Internal Server Error** | 서버 측 미처리 예외 — 본문은 generic 메시지 (스택 미노출, 보안) | 전 endpoint fallback |

**race / concurrency 관련 status (예: optimistic lock 의 412 Precondition Failed)** 는 본 표의 default 가 아님 — P3+ 의 concurrency 정책 ADR 시 본 § 6 갱신.

## 7. UC §5 sequence step ↔ endpoint cross-reference

각 UC §5 sequence 의 어느 step 이 본 § 5 의 어느 endpoint group 을 호출하는지 1:1 박제. step 번호는 각 UC §5 의 mermaid `autonumber` 기준.

| UC | §5 의 핵심 endpoint 호출 step | 본 문서의 endpoint group |
| --- | --- | --- |
| [UC-01](../use-cases/UC-01-evaluation-execution.md#5-main-flow-sequence-diagram) | manual trigger 의 alt block (Admin→AssessmentModule) | `POST /api/assessments/run` |
| [UC-02](../use-cases/UC-02-evaluation-query.md#5-main-flow-sequence-diagram) | step 1 (WebUI→BackendAPI GET) | `GET /api/assessments`, `GET /api/assessments/:id` (+ `/api/contributions`·`/api/summaries` — P3 controller chain 으로 신설된 backing store, REQ-033/034/035, UC sequence 직접 호명 0) |
| [UC-03](../use-cases/UC-03-person-crud.md#5-main-flow-sequence-diagram) | step 1 (WebUI→BackendAPI mutation) + group/part 분기 | `POST/GET/PATCH/DELETE /api/persons[/:id]`, `/api/groups`, `/api/parts` |
| [UC-04](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram) | step 1 (login 또는 user mutation) | `/api/auth/login`, `/api/auth/me`, `POST /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/password` |
| [UC-05](../use-cases/UC-05-llm-config.md#5-main-flow-sequence-diagram) | step 2 (provider · difficulty-mapping mutation) | `/api/llm/providers`, `/api/llm/difficulty-mappings[/:difficulty]` |
| [UC-06](../use-cases/UC-06-evaluation-delete-reeval.md#5-main-flow-sequence-diagram) | step 1 (DELETE 또는 POST reeval/reset) | `DELETE /api/assessments`, `POST /api/assessments/reeval`, `POST /api/assessments/reset` |
| [UC-07](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram) | step 1 (Admin → export 또는 import) | `GET /api/admin/export`, `POST /api/admin/import`, `POST /api/admin/backup`, `POST /api/admin/restore` |
| [UC-08](../use-cases/UC-08-permission-denied.md#5-main-flow-sequence-diagram) | step 1 (user / admin audience filter) | `GET /api/me/permission-denied`, `GET /api/admin/permission-denied` |

**UC-01 의 cron trigger path 는 HTTP endpoint 가 아닌 in-process `@Cron` handler** ([ADR-0003 §3](../decisions/ADR-0003-deployment.md)) — 본 표의 endpoint 는 manual trigger path 만 박제.

## 8. Out of scope

본 문서는 **하지 않는다** — 다음 항목은 후속 phase task 의 책임:

- **구체 JSON request/response schema** (필드 이름·타입·required 표시) — P3 의 DTO + class-validator decorator (`src/<module>/dto/*.ts`).
- **구체 validation rule** (min/max length, regex, enum 값 list, cross-field rule) — P3 의 class-validator 또는 별도 validation pipe.
- **예시 payload** (sample request / response body) — P3 의 e2e test fixture.
- **OpenAPI / Swagger YAML 자동 생성** — `@nestjs/swagger` 도입은 P3+ 별도 ADR ([ADR-0001 §본문](../decisions/ADR-0001-stack.md) 가 "별도 ADR 불필요" 라 박제했으나 실제 도입 task 는 별도 ADR 권장 — endpoint 표가 source-of-truth 인지 swagger annotation 이 source-of-truth 인지의 단일 결정 필요).
- **endpoint 별 특수 status code** (예: 이 endpoint 만 회피용 409 반환) — P3 implementation 의 책임.
- **WebSocket / SSE / streaming endpoint** — 현재 8 UC §5 sequence 어디에도 호명 없음. P5+ 의 realtime feature 도입 시 별도 ADR + 본 문서 갱신.
- **외부 webhook receiver** (GitHub webhook / Confluence webhook) — 현재 8 UC §5 sequence 어디에도 호명 없음. P4 외부 통합 task 의 책임.
- **API versioning policy** (`/api/v1/*`) — 현 시점 unversioned. 필요 시 별도 ADR.
- **Rate limiting / throttling / quota / CORS specifics** — P4+ 의 책임.
- **gap REQ-004** (사용자 지정 기간 임의 평가문) — [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 gap 1 건. UC-09 신설 또는 UC-01 확장 후 본 § 5 에 endpoint 추가 예정.
- **PUT 전체 교체 vs PATCH 부분 갱신 선택** — UC-03 §5 / §9 의 `POST/PUT/PATCH/DELETE` 4-method enumeration 중 본 문서는 **PATCH 만 채택** (RFC 5789 — 부분 갱신 표준 + REST 관행). 사용자 의도가 "전체 자원 교체" 인 케이스가 발견되면 별도 row 로 PUT 추가 예정. P3 implementation 에서 controller decorator 선택 확정.

## 9. References

- [docs/PLAN.md](../PLAN.md) Phase P2 의 넷째 bullet (L37) — 본 문서가 cover
- [docs/architecture/INDEX.md](INDEX.md) — architecture document 목록 + MVA 원칙
- [docs/architecture/components.md](components.md) — "Backend API" component (본 문서의 책임 component) + Contracts 표 (Web UI ↔ Backend API)
- [docs/architecture/modules.md](modules.md) — 9 NestJS module — 본 문서의 endpoint 가 어느 module controller 의 책임인지 mapping
- [docs/architecture/directory.md](directory.md) — `src/<module>/<module>.controller.ts` layout — 본 문서의 endpoint 가 디렉토리 어디에 박제될지 conceptual
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — 8 UC backbone 표
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) ~ [UC-08-permission-denied.md](../use-cases/UC-08-permission-denied.md) — **본 문서의 endpoint source** (각 UC §5 sequence + §9 component/module mapping)
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — uc-covered 48 REQ 의 분류 / gap 1 (REQ-004) 추적
- [docs/requirements.md](../requirements.md) — REQ-NNN source of truth (REQ-026 ~ REQ-055 위주)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / REST / TypeScript 선택 (본 문서의 protocol 기반)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — monolithic / direct egress / @nestjs/schedule (본 문서의 host model 기반)
- **future ADR hook**: `@nestjs/swagger` 도입 ADR (P3+) — endpoint 표 ↔ swagger annotation 의 single source 결정 필요. 본 문서가 swagger annotation 의 design source 역할 유지 권장.

Refs: T-0030, T-0029, T-0028, T-0027, T-0026, T-0025, T-0024, T-0023, T-0022, T-0020, T-0019, T-0017, T-0016, T-0079, T-0081, T-0082, T-0083, T-0084, ADR-0001, ADR-0003, ADR-0008, REQ-026, REQ-027, REQ-028, REQ-030, REQ-032, REQ-037, REQ-038, REQ-040, REQ-041, REQ-043, REQ-044, REQ-045, REQ-046, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, T-0117, T-0118, T-0119, REQ-033, REQ-034, REQ-035, REQ-036
