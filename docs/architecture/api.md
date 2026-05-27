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
| Auth credential | **session cookie 또는 Bearer JWT** 중 P3 AuthModule 도입 task 의 ADR 에서 택일 — 본 문서는 둘 다 허용 conceptual 박제 | [ADR-0003 §2](../decisions/ADR-0003-deployment.md) (JWT/session secret 환경변수) / [modules.md](modules.md) AuthModule row |
| API versioning | **unversioned** — `/api/v1/*` 미도입. 필요 시 별도 ADR. | § 8 Out of scope |

## 3. Auth tier

3 권한 등급 ([README.md](../../README.md) L83–86, REQ-044) + Public (인증 불필요) — 모든 endpoint 는 다음 중 하나로 분류된다.

| tier | 의미 | 적용 endpoint 범위 | source REQ |
| --- | --- | --- | --- |
| **Public** | 인증 불필요. 미인증 user 도 접근 가능. | `POST /api/auth/login`, health check (별도 endpoint 도입 시) | REQ-043 (예외 — login 자체는 credential 발급 path) |
| **User** | 일반 사용자 — read-only. 조회 / sort / filter / 시계열만 가능, mutation 0. | UC-02 의 GET, UC-08 의 user-audience GET | REQ-046 (User read-only) |
| **Admin** | 관리자 — 평가 master data / LLM 설정 / 평가 실행·삭제·재수집 / Export·Import·Backup 전반의 mutation 권한 | UC-01 manual trigger / UC-03 person CRUD / UC-05 LLM config / UC-06 delete·reeval / UC-07 export·import / UC-08 admin-audience GET | REQ-045 (Admin 권한) |
| **SuperAdmin** | 최상위 — 사용자 등급 변경 권한 + Admin→User 강등 권한. 본인 self-demote 금지 (REQ-044). | `PATCH /api/users/:id/role` 의 일부 분기 (Admin→User) | REQ-044 (3 등급 + SuperAdmin 만 Admin→User) |

**tier 의 escalation 의미**: SuperAdmin ⊇ Admin ⊇ User ⊇ Public. 상위 등급은 하위 endpoint 도 호출 가능. 단 SuperAdmin self-demote 차단 등 invariant 는 endpoint 내부 검증 (AuthModule guard + UserModule service invariant).

## 4. Resource model

본 시스템의 endpoint 는 다음 conceptual resource path prefix 로 분리된다. 각 prefix 의 책임 module 은 [modules.md](modules.md) 의 9 NestJS module (AuthModule / PersistenceModule / UserModule / GithubModule / ConfluenceModule / LlmModule / AssessmentModule / SchedulerModule / WebModule) 안에서 결정 — **신규 module 신설 0**.

| prefix | 책임 module ([modules.md](modules.md)) | 책임 UC | 비고 |
| --- | --- | --- | --- |
| `/api/auth` | AuthModule | UC-04 | 로그인 / 로그아웃 / 자기 자신 (`me`) 조회 |
| `/api/users` | AuthModule + UserModule | UC-04 | 사용자 (시스템 로그인 계정) 의 CRUD + 등급 변경 (REQ-043, REQ-044) |
| `/api/persons` | UserModule | UC-03 | 평가 대상 인원 (시스템 로그인 user 와 다름) 의 CRUD (REQ-026, REQ-027) |
| `/api/groups` | UserModule | UC-03 | 임의 group N 개 — Person 다대다 (REQ-028) |
| `/api/parts` | UserModule | UC-03 | 조직도 파트 (Person 당 정확히 1, REQ-028) |
| `/api/assessments` | AssessmentModule | UC-01, UC-02, UC-06 | 평가 결과 조회 + manual trigger + 삭제·재수집 (REQ-038, REQ-040, REQ-041, REQ-037) |
| `/api/llm` | LlmModule | UC-05 | LLM provider · 난이도 매핑 설정 (REQ-049, REQ-050) |
| `/api/admin` | AssessmentModule (controller) | UC-07 | Export / Import / Backup / Restore (REQ-030, REQ-032 — Admin 전용 sub-namespace) |
| `/api/me` | AuthModule + AssessmentModule | UC-08 (user audience) | 인증된 user 본인 시점의 read endpoint (예: 본인 관련 권한 부족 통지) |

resource 이름은 영문 복수 + kebab-case — 자세한 path 규약은 § 5 endpoint 표에서 박제.

## 5. Endpoint 표

본 표는 8 UC §5 sequence diagram + §9 component/module mapping 에서 호명된 endpoint 를 모두 수집. **description 컬럼은 ≤ 1 줄로 압축** — 구체 schema 는 P3 controller task 가 박제.

| METHOD | path | UC | description | auth tier |
| --- | --- | --- | --- | --- |
| **UC-04 권한·계정 (`/api/auth`, `/api/users`)** | | | | |
| POST | `/api/auth/login` | [UC-04](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram) | ID / Password 인증, session 또는 JWT 발급 | Public |
| POST | `/api/auth/logout` | UC-04 | 현재 session 또는 JWT 무효화 | User+ |
| GET | `/api/auth/me` | UC-04 | 현재 인증 user 의 등급 + 식별자 조회 | User+ |
| POST | `/api/users` | [UC-04 §5 step 1](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram) | 신규 user 계정 생성 (등급 default = User) | Admin+ |
| PATCH | `/api/users/:id/role` | UC-04 §5 step 4 | user 등급 변경 (Admin→User 분기는 SuperAdmin 전용, self-demote 차단) | Admin (User→Admin) / SuperAdmin (Admin→User) |
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
| GET | `/api/assessments` | [UC-02 §5 step 1](../use-cases/UC-02-evaluation-query.md#5-main-flow-sequence-diagram) | 평가 결과 조회 (`sort`, `filter`, `window=daily/weekly/monthly`, page) — REQ-038 | User+ |
| GET | `/api/assessments/:id` | UC-02 | 단일 평가 결과 row 상세 | User+ |
| POST | `/api/assessments/run` | [UC-01 §5 alt block](../use-cases/UC-01-evaluation-execution.md#5-main-flow-sequence-diagram) | 평가 manual trigger (REQ-040) — 즉시 AssessmentRun 시작 | Admin+ |
| DELETE | `/api/assessments` | [UC-06 §5](../use-cases/UC-06-evaluation-delete-reeval.md#5-main-flow-sequence-diagram) | 최근 N 일치 평가 결과 manual delete (`dateRange`, `personIds` query) — REQ-041 | Admin+ |
| POST | `/api/assessments/reeval` | UC-06 §5 | 평가 없는 부분 일괄 재평가 — REQ-037 | Admin+ |
| POST | `/api/assessments/reset` | UC-06 §5 | Reset & Reeval (전체 또는 범위) — REQ-037 | Admin+ |
| **UC-05 LLM 설정 (`/api/llm`)** | | | | |
| GET | `/api/llm/providers` | [UC-05 §5](../use-cases/UC-05-llm-config.md#5-main-flow-sequence-diagram) | 5 provider (custom / Azure OpenAI / Anthropic / Google Gemini / OpenAI) 설정 목록 — REQ-051~055 | Admin+ |
| POST | `/api/llm/providers` | UC-05 §5 step 2 | provider 추가 (endpoint URL / API key / model 식별자) | Admin+ |
| PATCH | `/api/llm/providers/:id` | UC-05 §5 step 2 | provider 수정 | Admin+ |
| DELETE | `/api/llm/providers/:id` | UC-05 §5 step 2 | provider 삭제 (difficulty-mapping 의 reference 없을 때만) | Admin+ |
| GET | `/api/llm/difficulty-mapping` | UC-05 | 3 난이도 ↔ provider/model 매핑 조회 (REQ-049, REQ-050) | Admin+ |
| PATCH | `/api/llm/difficulty-mapping` | UC-05 §5 step 2 | 3 난이도 ↔ provider/model 매핑 갱신 | Admin+ |
| **UC-07 Export / Import / Backup (`/api/admin`)** | | | | |
| GET | `/api/admin/export` | [UC-07 §5](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram) | 평가 자료 export (raw 미포함, REQ-032·REQ-030) — `scope` query | Admin+ |
| POST | `/api/admin/import` | UC-07 §5 | 평가 자료 import (multipart file upload) | Admin+ |
| POST | `/api/admin/backup` | UC-07 §5 | DB backup 생성 | Admin+ |
| POST | `/api/admin/restore` | UC-07 §5 | backup 으로 reset & restore | Admin+ |
| **UC-08 권한 부족 통지 (`/api/me`, `/api/admin`)** | | | | |
| GET | `/api/me/permission-denied` | [UC-08 §5](../use-cases/UC-08-permission-denied.md#5-main-flow-sequence-diagram) | 본인 관련 권한 부족 event 조회 (REQ-008 — user audience) | User+ |
| GET | `/api/admin/permission-denied` | UC-08 §5 | 시스템 전체 권한 부족 event 조회 (REQ-016 — admin audience) | Admin+ |

**합계**: 약 35 endpoint / 9 resource prefix / 8 UC cover. 향후 UC 추가·세분화 시 본 표가 source — endpoint 신설은 본 표 갱신 PR 의 reviewer 점검 대상.

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
| [UC-02](../use-cases/UC-02-evaluation-query.md#5-main-flow-sequence-diagram) | step 1 (WebUI→BackendAPI GET) | `GET /api/assessments`, `GET /api/assessments/:id` |
| [UC-03](../use-cases/UC-03-person-crud.md#5-main-flow-sequence-diagram) | step 1 (WebUI→BackendAPI mutation) + group/part 분기 | `POST/GET/PATCH/DELETE /api/persons[/:id]`, `/api/groups`, `/api/parts` |
| [UC-04](../use-cases/UC-04-account-auth.md#5-main-flow-sequence-diagram) | step 1 (login 또는 user mutation) | `/api/auth/login`, `/api/auth/me`, `POST /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/password` |
| [UC-05](../use-cases/UC-05-llm-config.md#5-main-flow-sequence-diagram) | step 2 (provider · difficulty-mapping mutation) | `/api/llm/providers`, `/api/llm/difficulty-mapping` |
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

Refs: T-0030, T-0029, T-0028, T-0027, T-0026, T-0025, T-0024, T-0023, T-0022, T-0020, T-0019, T-0017, T-0016, ADR-0001, ADR-0003, REQ-026, REQ-027, REQ-028, REQ-030, REQ-032, REQ-037, REQ-038, REQ-040, REQ-041, REQ-043, REQ-044, REQ-045, REQ-046, REQ-049, REQ-050, REQ-051, REQ-052, REQ-053, REQ-054, REQ-055
