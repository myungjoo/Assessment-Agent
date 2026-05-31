---
id: T-0114
title: AssessmentService 추가 (AssessmentRepository 위 HTTP exception 변환 + enum-as-String literal 검증)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-036, REQ-038]
estimatedDiff: 520
estimatedFiles: 3
sizeExempt: true
exemptReason: "R-112 4-카테고리 backbone (service + colocated spec) × 1.5 × P2002 sub-multiplier 1.2 = effective × 1.8. literal 검증 분기(period 3종 / scope 3종 / difficulty 3종)마다 negative test 의무 + P2002/P2025/null 변환 분기별 test → colocated spec 의 test mass 가 envelope 초과. T-0111(521)/T-0112(502)/T-0113(512) actual ~500 LOC precedent 1:1 mirror — service half 도 동등 mass 박제."
created: 2026-05-31
plannerNote: "P3 ~99.6% — ADR-0006 chain T-0111 candidate 의 service half. AssessmentRepository(T-0111) 위 application service. pr-mode, §5 미발동(schema/migration 0)."
---

# T-0114 — AssessmentService 추가 (AssessmentRepository 위 HTTP exception 변환 + enum-as-String literal 검증)

## Why

ADR-0006 repository chain 3/3 (AssessmentRepository T-0111 / ContributionRepository T-0112 / SummaryRepository T-0113) 이 완결되어 **Assessment / Contribution / Summary 의 data-access primitive 는 존재하나, 그 위에 도메인 의미를 부여하는 application service layer 가 0** 인 상태다. [ADR-0006 "후속 구현 task chain" 표](../decisions/ADR-0006-assessment-data-model.md)가 명시한 **T-0111 candidate = AssessmentService / repository** 의 repository half 는 T-0111 으로 박제됐고, 본 task 는 그 **service half** 를 박제한다. 이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장) / REQ-033 (commit·문서 별 데이터) / REQ-036 (상대 비교 정규화 수치) / REQ-038 (시계열 조회) 의 application-service backbone 이다.

기존 `PersonService` (T-0036) 의 exception-translation 패턴을 1:1 mirror 한다 — Prisma known error code (`P2002` unique constraint / `P2025` record not found) 와 repository 의 `null` 반환을 NestJS HttpException (`ConflictException` / `NotFoundException`) 으로 변환한다. 추가로 ADR-0006 §Consequences 음의 4 가 **service-layer 책임으로 박제한 enum-as-String literal 값 검증** (`period` / `scope` / `difficulty` 의 잘못된 literal 차단) 을 본 service 에서 강제한다 — repository 는 값을 그대로 forward 하므로 이 검증은 반드시 service-layer 에 위치한다.

## Required Reading

- `src/user/assessment.repository.ts` (전체) — 본 service 가 inject·forward 할 대상. 4 메서드 (`create` / `findById` / `findByPerson` / `delete`) 시그니처 + `AssessmentCreateInput` / `AssessmentFindByPersonOptions` interface + P2002/P2025/null 정책. Assessment 는 immutable (update 없음).
- `src/user/person.service.ts` (전체) — mirror 대상 패턴. `getPrismaErrorCode` duck-typing helper, `create` 의 P2002 → ConflictException, `findById` 의 null → NotFoundException, `remove` 의 P2025 → NotFoundException 변환 흐름. 본 service 의 메서드 구조 source.
- `src/user/person.service.spec.ts` (전체) — colocated spec 의 R-112 4 카테고리 패턴 + repository 를 Jest mock 으로 대체하는 방식 (실 DB / 실 repository 미연결) + P2002/P2025 fixture (`Object.assign(new Error, { code: "P2002" })`) 패턴 mirror 대상.
- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §1 (Assessment 컬럼 + period `"day"`/`"week"`/`"month"` / scope `"commit"`/`"document"`/`"aggregate"` / difficulty `"easy"`/`"medium"`/`"hard"` 의 허용 literal 집합) / §6 (`@@unique` → P2002 변환 의미) / §Consequences 음의 4 (enum-as-String literal 검증이 service-layer 책임).
- `src/user/user.module.ts` (L43–134) — `AssessmentService` 를 providers / exports 에 등록할 위치. PersonService 등록 패턴 mirror.

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 다음 3 개:

- [ ] `src/user/assessment.service.ts` 신설 — `@Injectable()` `AssessmentService` 가 `AssessmentRepository` 를 생성자 주입받아 다음 메서드를 노출한다 (PersonService 의 exception-translation 패턴 mirror, Assessment 는 immutable 이므로 update/deactivate/reactivate 없음):
  - `create(input: AssessmentCreateInput): Promise<Assessment>` — (1) `period` / `scope` / `difficulty` 의 enum-as-String literal 값을 ADR-0006 §1 의 허용 집합으로 검증 (잘못된 literal 이면 `BadRequestException` throw — service-layer 책임, ADR-0006 §Consequences 음의 4). (2) 검증 통과 후 `repository.create` 호출. (3) `@@unique([personId, period, scope, periodStart])` 위반 시 propagate 된 `P2002` 를 catch 하여 `ConflictException` 으로 변환 (PersonService.create 의 P2002 정책 mirror).
  - `findById(id: string): Promise<Assessment>` — repository 의 `null` 반환 분기를 `NotFoundException` 으로 변환 (PersonService.findById mirror, HTTP 404 자동 mapping).
  - `findByPerson(personId: string, options?: AssessmentFindByPersonOptions): Promise<Assessment[]>` — REQ-038 시계열 조회. `options.period` 가 주어지면 literal 값 검증 후 forward (잘못된 literal 이면 `BadRequestException`), undefined 면 그대로 forward (전체 period). 매칭 row 0 시 빈 배열 `[]` 그대로 반환 (NotFoundException 던지지 않음 — 컬렉션 조회의 정상 결과).
  - `remove(id: string): Promise<void>` — hard delete (REQ-041 / REQ-037 lifecycle). repository.delete 가 propagate 한 `P2025` 를 `NotFoundException` 으로 변환 (PersonService.remove mirror).
  - `getPrismaErrorCode` duck-typing helper 는 PersonService 의 것을 mirror (runtime 의존성 늘리지 않도록 `Prisma.PrismaClientKnownRequestError` instanceof 대신 `error.code` duck typing). PersonService 와 중복되나 본 task 는 PersonService 를 건드리지 않음 (공용 helper 추출은 Follow-up — 5 file cap + Out of Scope 보존).
  - 허용 literal 집합 (`VALID_PERIODS` / `VALID_SCOPES` / `VALID_DIFFICULTIES`) 을 상수로 export 또는 module-private 로 박제 (후속 SummaryService 등이 재사용 가능하도록 export 권장, 단 본 task 에서 다른 service 수정 금지).
- [ ] `src/user/assessment.service.spec.ts` (colocated — `src/user/assessment.service.spec.ts`) 신설 — R-112 4 카테고리 전부. `AssessmentRepository` 를 Jest mock 으로 대체 (실 repository / 실 DB 미연결, person.service.spec.ts 의 mock 패턴 mirror):
  - [ ] **Happy-path**: `create` (유효 literal) / `findById` (row 존재) / `findByPerson` (period 지정 + 미지정) / `remove` (정상 삭제) 각각이 올바른 repository 메서드를 올바른 인자로 호출하고 return 값을 propagate 하는지 1+ test.
  - [ ] **Error path**: (a) `create` 가 repository 의 `P2002` 를 `ConflictException` 으로 변환하는지, (b) `findById` 가 repository 의 `null` 을 `NotFoundException` 으로 변환하는지, (c) `remove` 가 repository 의 `P2025` 를 `NotFoundException` 으로 변환하는지 각 1+ test.
  - [ ] **Flow / branch**: `findByPerson` 의 `options.period` 분기 (지정 vs 미지정) 각 1+ test — repository 에 올바른 options 가 forward 되는지. `create` 의 literal 검증 통과 분기 (정상 흐름) 1+ test.
  - [ ] **Negative cases 충분 cover** (예외 분기마다 — 단일 negative 금지): (a) `create` 의 `period` 가 허용 집합 밖 (예: `"yearly"`) → `BadRequestException`, (b) `create` 의 `scope` 가 허용 집합 밖 (예: `"merge"`) → `BadRequestException`, (c) `create` 의 `difficulty` 가 허용 집합 밖 (예: `"trivial"`) → `BadRequestException`, (d) `findByPerson` 의 `options.period` 가 허용 집합 밖 → `BadRequestException`, (e) `create` 의 P2002 propagate → ConflictException (위 error path 와 별개 시나리오로 unique 축 중복 명시), (f) `remove` 의 P2025 propagate → NotFoundException, (g) `create` 가 P2002 가 아닌 unknown error 를 받으면 그대로 re-throw (변환 안 함) 검증. 각 1+ test.
  - [ ] **raw 미저장 (R-59) invariant 재확인**: `create` 가 `AssessmentCreateInput` (raw 본문 컬럼 부재 type) 만 받아 repository 로 forward 하며 raw 키를 주입하지 않음을 검증하는 test 1+ (type-level 은 컴파일 차원, runtime 은 forward 키 집합 assert — repository spec 의 guard 와 service layer 의 일관성 확인).
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 service 는 분기 + 단순 변환이라 100% 도달 자연스러움.
- [ ] `src/user/user.module.ts` 에 `AssessmentService` 를 `providers` 에 등록 + `exports` 에 추가 (후속 AssessmentController / endpoint 가 inject 가능하도록 — PersonService 등록 패턴 mirror). import 정렬 유지.
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 service unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **AssessmentController + DTO + endpoint** — ADR-0006 T-0112 candidate, 별도 후속 task. 본 task 는 service layer 1 개만 (HTTP-facing 0).
- **NewPersonEvent / 도메인 이벤트 emit** (REQ-027) — AssessmentModule 의 이벤트 흐름은 별도 task. 본 service 는 CRUD + 변환 + literal 검증만.
- **ContributionService / SummaryService** — 각 별도 slice (Follow-ups). 본 task 는 Assessment entity 의 service 1 개만.
- **`getPrismaErrorCode` / literal 검증 helper 의 공용 util 추출** — PersonService 와 중복되나 본 task 에서 PersonService 를 건드리면 diff 확장 + 회귀 위험. 공용화는 별도 refactor follow-up (Follow-ups 박제).
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **AuthGuard / RBAC 권한 적용** — endpoint 가 없으므로 본 task 범위 외 (controller task 책임).
- **`update` / `softDelete` / `restore`** — Assessment 는 immutable (ADR-0006 §1). 박제하지 않는다.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 컬럼/literal 집합/invariant 결정을 박제했고, PersonService 가 exception-translation mirror 패턴을 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
