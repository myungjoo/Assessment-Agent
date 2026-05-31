---
id: T-0117
title: AssessmentController + CreateAssessmentDto 추가 (AssessmentService 위 /api/assessments REST endpoint + e2e)
phase: P3
status: DONE
commitMode: pr
mergedAs: 91331f7
prNumber: 119
reviewRounds: 2
coversReq: [REQ-029, REQ-032, REQ-033, REQ-036, REQ-038]
estimatedDiff: 480
estimatedFiles: 5
sizeExempt: true
exemptReason: "R-112 4-카테고리 HTTP backbone (controller + colocated controller spec + DTO + e2e spec) × 1.5. 4 endpoint × (happy + error envelope + branch + negative 충분) unit + e2e 의 test mass 가 envelope 초과 — T-0106(GET /api/auth/me controller + e2e) / persons.e2e-spec.ts(13 test) / group.controller.spec.ts precedent 처럼 controller 의 full unit+e2e spec 은 ~450-500 LOC. base ~130 × 1.5 ≈ 195 직관이나 unit spec + e2e spec 2 layer test mass 로 cap-bend. precedent: T-0111~T-0116 actual ~500 LOC."
created: 2026-05-31
plannerNote: "P3 — ADR-0006 chain 6/6(schema+repo+service) 완결 후 HTTP-facing layer 진입. ADR-0006 T-0112 candidate(AssessmentController+DTO+endpoint). 기존 controller mirror, AuthGuard 미적용(§5 미발동)."
---

# T-0117 — AssessmentController + CreateAssessmentDto 추가 (AssessmentService 위 /api/assessments REST endpoint + e2e)

## Why

ADR-0006 의 data-model chain 이 6/6 완결됐다 — schema (T-0110) + repository 3종 (AssessmentRepository T-0111 / ContributionRepository T-0112 / SummaryRepository T-0113) + service 3종 (AssessmentService T-0114 / ContributionService T-0115 / SummaryService T-0116). data-access + application-service layer 는 존재하나 **Assessment / Contribution / Summary 의 HTTP-facing controller / DTO / endpoint 가 0** 인 상태다 — 외부 API 클라이언트 (향후 WebUI) 가 평가 결과를 조회·생성·삭제할 경로가 없다. [ADR-0006 "후속 구현 task chain" 표](../decisions/ADR-0006-assessment-data-model.md)가 명시한 **"AssessmentController + DTO + endpoint"** 의 첫 slice 를 본 task 가 박제한다 (3 entity 중 Assessment 1 개만 — size cap 보존).

이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장) / REQ-033 (commit·문서 별 데이터) / REQ-036 (상대 비교 정규화 수치) / REQ-038 (시계열 조회) 의 HTTP contract backbone 이다. [api.md §3 L88-92](../architecture/api.md) 의 `/api/assessments` row 중, **AssessmentService 가 이미 노출한 4 primitive (create / findById / findByPerson / remove) 에 대응하는 endpoint** 만 박제한다 — UC-06 의 batch 연산 (run / reeval / reset / 범위 DELETE) 은 평가 pipeline (P5) 의존이라 Out of Scope.

기존 `PersonController` (T-0036) / `GroupController` (T-0055/T-0057) / `PartController` (T-0046) 의 controller 패턴을 1:1 mirror 한다 — controller-scope `@UsePipes(new ValidationPipe({whitelist, forbidNonWhitelisted, transform}))` + `@Body() dto` + service 의 HttpException (`BadRequestException` / `ConflictException` / `NotFoundException`) 자동 status mapping. **AuthGuard / RBAC 는 적용하지 않는다** — 기존 3 controller (Person/Group/Part) 가 모두 AuthGuard 미적용 (auth credential 흐름은 별도 task 책임) 이므로 본 controller 도 동일 정책 유지. 따라서 본 task 는 [CLAUDE.md §5](../../CLAUDE.md) 의 auth/security 모델 변경에 해당하지 않는다 (기존 guard wiring 0 변경).

## Required Reading

- `src/user/assessment.service.ts` (전체) — 본 controller 가 inject·forward 할 대상. 4 메서드 (`create(input: AssessmentCreateInput)` / `findById(id)` / `findByPerson(personId, options?)` / `remove(id)`) 시그니처 + 던지는 HttpException 종류 (`BadRequestException` literal 위반 / `ConflictException` P2002 / `NotFoundException` null·P2025). Assessment 는 immutable (update 없음).
- `src/user/assessment.repository.ts` (L39-70) — `AssessmentCreateInput` (8 키: personId / period / scope / periodStart / difficulty / contributionScore / volume / narrative) + `AssessmentFindByPersonOptions` (period?) interface. DTO field 결정의 source. raw 본문 컬럼 부재 = R-59 type-level guard.
- `src/user/person.controller.ts` (전체) — mirror 대상 controller 패턴 (controller-scope ValidationPipe + `@Get`/`@Post`/`@Delete` + `@HttpCode` + service forward + 주석 스타일). 본 controller 의 구조 source.
- `src/user/dto/create-person.dto.ts` (전체) — DTO 패턴 (class-validator decorator + 주석 + Prisma 컬럼 정합). 본 `CreateAssessmentDto` 의 mirror 대상.
- `src/user/group.controller.spec.ts` (전체) — colocated controller spec 의 R-112 4 카테고리 패턴 (service 를 Jest mock 으로 대체, controller 가 올바른 service 메서드를 올바른 인자로 호출 + return propagate 검증).
- `test/e2e/persons.e2e-spec.ts` (전체) — e2e spec 의 R-113 패턴: `createE2EApp()` 부트스트랩 + `truncateAll(prisma)` afterEach + `prisma.<model>.create` 로 실 row seed + status/content-type/body shape/4xx envelope 검증. 본 `assessments.e2e-spec.ts` 의 mirror 대상. (참고: e2e 는 실 PostgreSQL 사용 — Assessment seed 시 FK 인 Person 도 함께 seed 필요.)
- `src/user/user.module.ts` (L64-78, L73 controllers 배열) — `AssessmentController` 를 controllers 배열에 등록할 위치. PersonController / GroupController 등록 패턴 mirror. AssessmentService 는 이미 providers/exports 등록됨 (T-0114) — providers 변경 0.
- `docs/architecture/api.md` (L88-92) — `/api/assessments` endpoint contract row. 본 task 가 cover 하는 GET list / GET :id / POST / DELETE :id 의 path·status·auth tier 정합 (단 auth tier 강제는 AuthGuard task 책임 — 본 task 는 endpoint 만).
- `docs/decisions/ADR-0006-assessment-data-model.md` (Decision §1, §4) — Assessment 컬럼 + period/scope/difficulty 허용 literal + raw 미저장 invariant (DTO 가 raw 키를 노출하지 않음을 보장).

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`, `test/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 다음 5 개 (cap 정합):

- [ ] `src/user/dto/create-assessment.dto.ts` 신설 — `CreateAssessmentDto` 가 `AssessmentCreateInput` (raw 본문 컬럼 부재) 의 8 키를 class-validator decorator 로 검증한다 (CreatePersonDto 패턴 mirror). 권장 decorator 매핑:
  - `personId` → `@IsString @IsNotEmpty`
  - `period` → `@IsString @IsNotEmpty` (literal 값 검증은 service-layer 책임 — DTO 는 형식만; `@IsIn(VALID_PERIODS)` 추가 여부는 implementer 재량이나 service 의 BadRequestException 와 중복이면 형식 검증만 권장)
  - `scope` → `@IsString @IsNotEmpty`
  - `periodStart` → `@IsDateString` 또는 `@Type(() => Date) @IsDate` (transform 으로 Date 변환 — service 가 Date 기대)
  - `difficulty` → `@IsString @IsNotEmpty`
  - `contributionScore` → `@IsNumber` 또는 `@IsNumberString` (Decimal input — number/string accept; implementer 가 service input type 정합으로 결정)
  - `volume` → `@IsInt @Min(0)`
  - `narrative` → `@IsString @IsNotEmpty` (LLM 생성 결과물 — raw 아님, R-59 적용 외)
  - **raw 본문 키 (commit body / diff / 문서 본문 / rawBody / content 등) 를 절대 정의하지 않음** — R-59 schema-level 강제의 DTO-level 정합. `whitelist: true` + `forbidNonWhitelisted: true` 가 정의 외 필드를 400 으로 reject.
- [ ] `src/user/assessment.controller.ts` 신설 — `@Controller("api/assessments")` + controller-scope `@UsePipes(new ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true}))` (PersonController mirror). `AssessmentService` 생성자 주입 + 다음 4 endpoint:
  - `@Get()` `findByPerson(@Query("personId") personId, @Query("period") period?)` — REQ-038 시계열 조회. `GET /api/assessments?personId=<id>&period=<day|week|month>` → `service.findByPerson(personId, period ? { period } : undefined)`. 200 OK + JSON 배열 (빈 배열 가능). `personId` 누락 시 400 (필수 query — implementer 가 `@Query` 필수성 또는 명시 검증으로 강제). period 가 허용 집합 밖이면 service 가 BadRequestException → 400 자동.
  - `@Get(":id")` `findOne(@Param("id") id)` — `service.findById(id)`. row 부재 시 service 가 NotFoundException → 404 자동.
  - `@Post()` `@HttpCode(201)` `create(@Body() dto: CreateAssessmentDto)` — `service.create(dto)`. 201 Created. literal 위반 → 400 (service BadRequestException), `@@unique` 중복 → 409 (service ConflictException) 자동 mapping.
  - `@Delete(":id")` `@HttpCode(204)` `remove(@Param("id") id)` — `service.remove(id)`. 204 No Content. row 부재 시 404. component Contribution 은 schema cascade 동반 삭제.
  - 헤더 주석: api.md row 정합 + 책임 경계 (AuthGuard 미적용 — 기존 controller 동일 정책 / batch 연산 (run/reeval/reset/범위 DELETE) Out of Scope / 응답 envelope 표준화 안 함 / pagination·sort query 미지원) 명시 (PersonController/GroupController 헤더 주석 스타일 mirror).
- [ ] `src/user/assessment.controller.spec.ts` (colocated — `src/user/assessment.controller.spec.ts`) 신설 — R-112 4 카테고리 전부. `AssessmentService` 를 Jest mock 으로 대체 (실 service / 실 DB 미연결, group.controller.spec.ts mock 패턴 mirror):
  - [ ] **Happy-path**: 4 endpoint 각각이 올바른 service 메서드를 올바른 인자로 호출하고 return 값을 propagate 하는지 1+ test (`findByPerson` / `findById` / `create` / `remove`).
  - [ ] **Error path**: (a) `findById` 가 service 의 NotFoundException 을 propagate (변환·삼킴 없음), (b) `create` 가 service 의 ConflictException(P2002) 을 propagate, (c) `create` 가 service 의 BadRequestException(literal 위반) 을 propagate, (d) `remove` 가 service 의 NotFoundException(P2025) 을 propagate 각 1+ test.
  - [ ] **Flow / branch**: `findByPerson` 의 period query 분기 (지정 시 `{ period }` options forward / 미지정 시 `undefined` forward) 각 1+ test — controller 가 service 에 올바른 options 를 결합하는지.
  - [ ] **Negative cases 충분 cover** (예외 분기마다 — 단일 negative 금지): (a) `findByPerson` 의 `personId` 누락 → 400 또는 명시 검증 동작, (b) `findById` 의 NotFoundException propagate (404 의미), (c) `create` 의 literal 위반 BadRequestException propagate, (d) `create` 의 P2002 ConflictException propagate, (e) `remove` 의 P2025 NotFoundException propagate, (f) `create` 가 service 가 던진 unknown error 를 삼키지 않고 propagate. 각 1+ test.
  - [ ] **raw 미저장 (R-59) 정합 재확인**: `CreateAssessmentDto` (또는 controller 의 create) 가 raw 본문 키를 forward 하지 않음 — DTO 에 raw 키 부재 + whitelist 동작 검증 test 1+ (controller spec 또는 DTO spec 중 적합 위치). DTO 검증 단독 spec (`create-assessment.dto.spec.ts`) 추가는 선택 — 5 file cap 안에서 controller spec 에 fold 권장.
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제).
- [ ] `test/e2e/assessments.e2e-spec.ts` (R-113 e2e) 신설 — persons.e2e-spec.ts 패턴 mirror. `createE2EApp()` + `truncateAll(prisma)` afterEach + 실 PostgreSQL seed:
  - [ ] **Happy path** (4 endpoint × status + content-type + body shape): GET list (200 + array, Person + Assessment seed 후 personId query) / GET :id (200 + single object) / POST (201 + 생성된 Assessment + 실 DB 재조회 검증, Person seed 선행 — FK) / DELETE :id (204 + empty body + 실 DB 에서 row 사라짐 검증).
  - [ ] **4xx error envelope** (status + statusCode + error + message): GET :id missing → 404 envelope / POST `{}` 또는 필수 field 누락 → 400 envelope + validation message / POST non-whitelisted field (예: rawBody) → 400 envelope + whitelist message (R-59 e2e 정합).
  - [ ] **Branch** (service-layer HttpException → status mapping): POST 중복 (`@@unique([personId, period, scope, periodStart])` 위반, 동일 키 2회 POST) → 409 envelope / POST 잘못된 literal (예: period="yearly") → 400 envelope / DELETE missing id → 404 envelope.
  - [ ] e2e seed 주의: Assessment 는 `personId` FK 를 가지므로 `prisma.person.create` 로 Person 먼저 seed 후 그 id 로 Assessment seed/POST. `contributionScore` 는 Decimal — seed/assert 시 string 비교 또는 Prisma.Decimal 정합 주의.
- [ ] `src/user/user.module.ts` 의 `controllers` 배열에 `AssessmentController` 추가 (PersonController/GroupController 등록 패턴 mirror, import 정렬 유지). providers/exports 변경 0 — AssessmentService 는 T-0114 에서 이미 등록.
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) CI 에서 실행 — 본 task 가 신규 e2e (`assessments.e2e-spec.ts`) 추가. 기존 smoke/e2e 회귀 없이 green 유지 확인.

## Out of Scope

- **ContributionController / SummaryController + 각 DTO/endpoint** — 각 별도 후속 slice (Follow-ups). 본 task 는 Assessment entity 의 controller 1 개만 (3 entity 동시 박제는 cap 초과).
- **UC-06 batch 연산 endpoint** — `POST /api/assessments/run` (manual trigger, REQ-040) / `POST /api/assessments/reeval` / `POST /api/assessments/reset` (REQ-037) / 범위 `DELETE /api/assessments` (dateRange·personIds query, REQ-041) 은 평가 pipeline (P5) 또는 scheduler (P7) 의존 — 별도 task. 본 task 는 AssessmentService 가 이미 노출한 4 primitive 에 대응하는 endpoint 만.
- **AuthGuard / RBAC 권한 적용** — 기존 Person/Group/Part controller 가 모두 AuthGuard 미적용 (auth credential 흐름 별도 task). 본 controller 도 동일 정책 — guard wiring 0. api.md 의 auth tier (User+ / Admin+) 강제는 후속 AuthGuard task 책임. **본 task 가 auth/security 모델을 변경하지 않음** ([CLAUDE.md §5](../../CLAUDE.md) 미발동).
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **응답 envelope (`{ data, meta }`) 표준화 / pagination / sort / filter query param** — Prisma return 그대로 (기존 controller 동일 정책). REQ-038 의 sort/filter/window 정밀 query 는 평가 조회 UC-02 결합 시점 별도 task.
- **`update` endpoint (PATCH)** — Assessment 는 immutable (ADR-0006 §1, AssessmentService 에 update 메서드 부재). 박제하지 않는다.
- **`getPrismaErrorCode` / DTO 공용 util 추출** — 기존 service/DTO 와 중복되나 본 task 에서 건드리면 diff 확장 + 회귀 위험. 공용화는 별도 refactor follow-up.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 컬럼/literal 집합/invariant 결정을 박제했고, PersonController / GroupController / persons.e2e-spec.ts 가 controller + DTO + e2e mirror 패턴을 모두 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
