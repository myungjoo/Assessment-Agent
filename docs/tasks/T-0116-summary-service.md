---
id: T-0116
title: SummaryService 추가 (SummaryRepository 위 HTTP exception 변환 + period literal 검증) + summary.repository.ts period 주석 결함 정정
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-034, REQ-035, REQ-036, REQ-038]
estimatedDiff: 420
estimatedFiles: 4
sizeExempt: true
exemptReason: "R-112 4-카테고리 backbone (service + colocated spec) × 1.5. Summary 는 @@unique 부재라 P2002 sub-multiplier 미적용 (대신 personId FK 의 P2003 분기). literal 검증은 period 1종 (day/week/month) 뿐이라 negative 분기가 Contribution(2종)/Assessment(3종) 보다 작으나, P2003/P2025/null/unknown-error 변환 분기별 test + raw-noretain forward guard + findByPerson 의 period 분기(주어짐/undefined) 2 분기 test 의 colocated spec test mass 가 envelope 초과. T-0115(ContributionService) actual ~490 / T-0114(~515) / T-0111(521)/T-0112(502)/T-0113(512) precedent 1:1 mirror — service half 도 동등 mass 박제. 추가로 summary.repository.ts 의 period 주석 3곳 (L7/L59/L73) comment-only 정정이 4번째 파일로 fold (behavior 변경 0)."
created: 2026-05-31
plannerNote: "P3 — ADR-0006 chain service half 3rd(마지막) slice. SummaryRepository(T-0113) 위 application service. ContributionService(T-0115) mirror(P2003, @@unique 부재). period 주석 결함 fold. pr-mode, §5 미발동."
---

# T-0116 — SummaryService 추가 (SummaryRepository 위 HTTP exception 변환 + period literal 검증) + summary.repository.ts period 주석 결함 정정

## Why

ADR-0006 repository chain 3/3 (AssessmentRepository T-0111 / ContributionRepository T-0112 / SummaryRepository T-0113) 이 완결되고, service half 의 2 slice (AssessmentService T-0114 / ContributionService T-0115) 가 모두 머지되어, 도메인 chain (Assessment → Contribution → Summary) 의 **마지막 application-service slice 인 SummaryService** 가 자연스러운 다음 작업이다. SummaryService 가 머지되면 ADR-0006 의 service half 3/3 이 완결되고, 그 다음은 controller/DTO/endpoint (HTTP-facing) slice 로 진입한다.

이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장) / REQ-034 (일별 활동 요약 평가문) / REQ-035 (주간/월간 요약 평가문) / REQ-036 (상대 비교 정규화 수치) / REQ-038 (시계열 조회) 의 application-service backbone 이다. 기존 `ContributionService` (T-0115) 와 `AssessmentService` (T-0114) / `PersonService` (T-0036) 의 exception-translation 패턴을 1:1 mirror 한다 — Prisma known error code (`P2003` = FK constraint / `P2025` = record not found) 와 repository 의 `null` 반환을 NestJS HttpException (`BadRequestException` / `NotFoundException`) 으로 변환하고, ADR-0006 §Consequences 음의 4 가 service-layer 책임으로 박제한 enum-as-String literal 값 검증 (`period` 의 잘못된 literal 차단) 을 강제한다 — repository 는 값을 그대로 forward 하므로 이 검증은 반드시 service-layer 에 위치한다.

**SummaryService 가 ContributionService 와 같은 구조인 이유** — Summary 는 `@@unique` 가 부재하므로 (schema.prisma L285–299 에 `@@index([personId, period, periodStart])` 만 존재, `@@unique` 없음) `P2002` (unique constraint) 가 발생하지 않는다 → AssessmentService 와 달리 `P2002 → ConflictException` 변환 분기를 박제하지 않는다 (ContributionService 와 동일). 대신 Summary 는 `personId` N:1 FK 를 보유하므로 Person row 부재 시 `P2003` (FK constraint 위반) 이 propagate → ContributionService 의 `assessmentId` FK 패턴과 동일하게 `BadRequestException` 으로 변환한다. literal 검증 대상은 **`period` 1 종뿐** (ContributionService 의 `sourceType`/`difficulty` 2 종, AssessmentService 의 `period`/`scope`/`difficulty` 3 종과 달리 — Summary 는 `scope`/`difficulty` 컬럼 부재).

**period literal 결함 fold (본 task 가 함께 처리)** — 머지된 `src/user/summary.repository.ts` (T-0113) 의 주석이 `Summary.period` 를 `"daily"`/`"weekly"`/`"monthly"` 로 잘못 기술하고 있다 (L7 / L59 / L73). ADR-0006 L85 + schema 의 canonical literal 은 `"day"`/`"week"`/`"month"` 이다 (Assessment 와 동일). 런타임 영향은 0 (repository 는 값을 validate 하지 않음) 이나, 본 task 가 SummaryService 에서 올바른 literal (`"day"`/`"week"`/`"month"`) 을 박제하므로 같은 파일·같은 도메인의 주석 결함을 동시에 정정해 copy-paste 버그를 차단한다 (comment-only edit, behavior 변경 0).

## Required Reading

- `src/user/summary.repository.ts` (전체) — 본 service 가 inject·forward 할 대상 + 주석 결함 정정 대상. 4 메서드 (`create` / `findById` / `findByPerson` / `delete`) 시그니처 + `SummaryCreateInput` interface (5 키: personId / period / periodStart / narrative / metricScore) + `SummaryFindByPersonOptions` (period?) + P2003 (personId FK 위반) / P2025 / null 정책. Summary 는 immutable (update 없음), `@@unique` 부재 (P2002 미발생). **주석 결함 위치**: L7 (`"daily"` / `"weekly"` / `"monthly"`), L59 (`` `"daily"` / `"weekly"` / `"monthly"` enum-as-String ``), L73 (`` `"daily"` / `"weekly"` / `"monthly"` 중 하나 ``) → 모두 `"day"` / `"week"` / `"month"` 로 정정.
- `src/user/contribution.service.ts` (전체) — 직전 머지된 동일 layer mirror 대상 (Summary 와 같은 구조: `@@unique` 부재 → P2002 변환 없음, FK → P2003 → BadRequestException). `getPrismaErrorCode` duck-typing helper, `VALID_*` literal 상수 export 패턴, `create` 의 literal 검증 + P2003 변환, `findById` 의 null → NotFoundException, finder 의 컬렉션 빈 배열 반환, `remove` 의 P2025 → NotFoundException 변환 흐름. 본 service 의 메서드 구조 source.
- `src/user/assessment.service.ts` (전체) — `findByPerson` 의 `options?.period` 분기 (period 가 주어지면 literal 검증 후 forward, undefined 면 그대로 forward) 패턴 mirror 대상. Summary 의 `findByPerson(personId, options?)` 가 동일 분기 구조.
- `src/user/contribution.service.spec.ts` (전체) — colocated spec 의 R-112 4 카테고리 패턴 + repository 를 Jest mock 으로 대체하는 방식 (실 repository / 실 DB 미연결) + P2003/P2025 fixture (`Object.assign(new Error(), { code: "..." })`) 패턴 mirror 대상.
- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §3 (Summary 컬럼 + period `"day"`/`"week"`/`"month"` 의 canonical 허용 literal 집합, `personId` N:1 FK, immutable) / §6 (cascade — Person hard delete 시 Summary 동반 삭제) / §Consequences 음의 4 (enum-as-String literal 검증이 service-layer 책임).
- `src/user/user.module.ts` (L43–155) — `SummaryService` 를 providers / exports 에 등록할 위치. ContributionService 등록 패턴 (L110–116 providers / L148–150 exports) + SummaryRepository 등록 주석 (L117–122 / L151–153) mirror.

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 다음 4 개 (SummaryService 신설 1 + colocated spec 1 + module wiring 1 + summary.repository.ts 주석 정정 1):

- [ ] `src/user/summary.service.ts` 신설 — `@Injectable()` `SummaryService` 가 `SummaryRepository` 를 생성자 주입받아 다음 메서드를 노출한다 (ContributionService 의 exception-translation 패턴 mirror, Summary 는 immutable 이므로 update/deactivate/reactivate 없음):
  - `create(input: SummaryCreateInput): Promise<Summary>` — (1) `period` 의 enum-as-String literal 값을 ADR-0006 §3 의 허용 집합 (`"day"` / `"week"` / `"month"`) 으로 검증 (잘못된 literal 이면 `BadRequestException` throw — service-layer 책임, ADR-0006 §Consequences 음의 4). (2) 검증 통과 후 `repository.create` 호출. (3) `personId` FK 위반 (Person row 부재) 시 propagate 된 `P2003` 를 catch 하여 `BadRequestException` 으로 변환 (잘못된 참조 input → 400, ADR-0006 §3 + summary.repository.ts 의 "호출자가 BadRequestException 등으로 변환할 책임" 박제). Summary 는 `@@unique` 부재 → **P2002 변환 분기 없음** (ContributionService 와 동일, AssessmentService 와의 차이점 — stray P2002 는 그대로 re-throw).
  - `findById(id: string): Promise<Summary>` — repository 의 `null` 반환 분기를 `NotFoundException` 으로 변환 (ContributionService.findById mirror, HTTP 404 자동 mapping).
  - `findByPerson(personId: string, options?: SummaryFindByPersonOptions): Promise<Summary[]>` — REQ-038 시계열 조회. `options.period` 가 주어지면 literal 값 검증 후 forward (잘못된 literal 이면 `BadRequestException`), undefined 면 그대로 forward (전체 period). 매칭 row 0 시 빈 배열 `[]` 그대로 반환 (NotFoundException 던지지 않음 — 컬렉션 조회의 정상 결과). AssessmentService.findByPerson 의 `options?.period` 분기 패턴 mirror.
  - `remove(id: string): Promise<void>` — hard delete (REQ-041 Admin 개별 manual delete + 재계산 lifecycle, ADR-0006 §3 / §6). repository.delete 가 propagate 한 `P2025` 를 `NotFoundException` 으로 변환 (ContributionService.remove mirror). Person 전체 hard delete 시 동반 Summary 삭제는 schema 의 `onDelete: Cascade` 책임 (본 메서드 우회).
  - `getPrismaErrorCode` duck-typing helper 는 ContributionService / AssessmentService / PersonService 의 것을 mirror (runtime 의존성 늘리지 않도록 `Prisma.PrismaClientKnownRequestError` instanceof 대신 `error.code` duck typing). 기존 service 들과 중복되나 본 task 는 기존 service 를 건드리지 않음 (공용 helper 추출은 Follow-up — 5 file cap + Out of Scope 보존).
  - 허용 literal 집합 (`VALID_PERIODS`) 을 상수로 export 또는 module-private 로 박제. `VALID_PERIODS` 는 AssessmentService 의 동일 값 (`["day", "week", "month"]`) 이나 본 task 는 AssessmentService 를 import 해 결합하지 말고 자체 상수로 박제 — 공용화는 Follow-up. 단 본 task 에서 다른 service 수정 금지.
- [ ] `src/user/summary.service.spec.ts` (colocated — `src/user/summary.service.spec.ts`) 신설 — R-112 4 카테고리 전부. `SummaryRepository` 를 Jest mock 으로 대체 (실 repository / 실 DB 미연결, contribution.service.spec.ts 의 mock 패턴 mirror):
  - [ ] **Happy-path**: `create` (유효 period) / `findById` (row 존재) / `findByPerson` (period 주어짐 / period undefined / 0 건) / `remove` (정상 삭제) 각각이 올바른 repository 메서드를 올바른 인자로 호출하고 return 값을 propagate 하는지 1+ test.
  - [ ] **Error path**: (a) `create` 가 repository 의 `P2003` 를 `BadRequestException` 으로 변환하는지, (b) `findById` 가 repository 의 `null` 을 `NotFoundException` 으로 변환하는지, (c) `remove` 가 repository 의 `P2025` 를 `NotFoundException` 으로 변환하는지 각 1+ test.
  - [ ] **Flow / branch**: `create` 의 literal 검증 통과 분기 (정상 흐름) 1+ test. `findByPerson` 의 `options?.period` 2 분기 (period 주어짐 → literal 검증 후 forward / period undefined → 검증 skip 후 전체 forward) 각 1+ test. `findByPerson` 의 컬렉션 결과 (다수 vs 빈 배열) 분기 각 1+ test.
  - [ ] **Negative cases 충분 cover** (예외 분기마다 — 단일 negative 금지): (a) `create` 의 `period` 가 허용 집합 밖 (예: `"daily"` 또는 `"year"`) → `BadRequestException` (특히 `"daily"`/`"weekly"`/`"monthly"` 같이 정정된 결함 literal 이 reject 되는지 명시 — copy-paste 버그 regression 차단), (b) `findByPerson` 의 `options.period` 가 허용 집합 밖 → `BadRequestException`, (c) `create` 의 P2003 propagate → BadRequestException (FK 위반 시나리오 — personId 가 존재하지 않는 Person 을 가리킴), (d) `remove` 의 P2025 propagate → NotFoundException, (e) `create` 가 P2003 가 아닌 unknown error 를 받으면 그대로 re-throw (변환 안 함) 검증, (f) `create` 가 P2002 (또는 기타 known code) 를 받아도 본 service 는 P2002 변환 분기가 없으므로 그대로 re-throw 됨 검증 — Summary 는 unique 제약 부재라 ConflictException 변환을 하지 않음. 각 1+ test.
  - [ ] **raw 미저장 (R-59) invariant 재확인**: `create` 가 `SummaryCreateInput` (raw 본문 컬럼 부재 type, narrative 는 LLM 생성 결과물) 만 받아 repository 로 forward 하며 raw 키를 주입하지 않음을 검증하는 test 1+ (type-level 은 컴파일 차원, runtime 은 forward 키 집합 assert — repository spec 의 guard 와 service layer 의 일관성 확인).
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 service 는 분기 + 단순 변환이라 100% 도달 자연스러움.
- [ ] `src/user/summary.repository.ts` 의 period 주석 결함 정정 (comment-only edit, behavior 변경 0): L7 / L59 / L73 의 `"daily"` / `"weekly"` / `"monthly"` 를 ADR-0006 L85 의 canonical literal `"day"` / `"week"` / `"month"` 로 정정. 코드 (메서드 시그니처 / interface / forwarding 로직) 는 일절 변경 금지 — 주석 텍스트만. (Required Reading 의 주석 결함 위치 참조. 다른 주석에 `"daily"` 류 잔존이 있으면 함께 정정하되 코드는 불변.)
- [ ] `src/user/user.module.ts` 에 `SummaryService` 를 `providers` 에 등록 + `exports` 에 추가 (후속 SummaryController / endpoint 가 inject 가능하도록 — ContributionService 등록 패턴 mirror). import 정렬 유지. 등록 위치 주석은 ContributionService 주석 (L110–116) 스타일 mirror.
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 service unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **SummaryController + DTO + endpoint** — 별도 후속 task. 본 task 는 service layer 1 개만 (HTTP-facing 0).
- **Group/Part aggregate Summary 의 view-time 계산** (ADR-0006 §3 / Alternatives (c)) — 별도 entity 신설 없이 query-time 집계하는 로직은 별도 task. 본 service 는 개별 Person 의 Summary CRUD + 변환 + period 검증만.
- **NewPersonEvent / 도메인 이벤트 emit** (REQ-027) — 별도 task. 본 service 는 CRUD + 변환 + literal 검증만.
- **`getPrismaErrorCode` / literal 검증 helper 의 공용 util 추출** — PersonService / AssessmentService / ContributionService 와 중복되나 본 task 에서 기존 service 를 건드리면 diff 확장 + 회귀 위험. 공용화는 별도 refactor follow-up (Follow-ups 박제).
- **`VALID_PERIODS` 의 AssessmentService import 재사용** — 본 task 는 자체 상수로 박제 (다른 service 결합 금지). 공용 상수 추출은 Follow-up.
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **AuthGuard / RBAC 권한 적용** — endpoint 가 없으므로 본 task 범위 외 (controller task 책임).
- **`update` / `softDelete` / `restore`** — Summary 는 immutable (ADR-0006 §3, 재계산 = hard delete 후 재생성). 박제하지 않는다.
- **P2002 → ConflictException 변환 분기** — Summary 는 `@@unique` 부재이므로 P2002 가 발생하지 않는다. AssessmentService 와 달리 ConflictException 변환을 박제하지 않는다 (negative test 로 re-throw 됨만 확인). ContributionService 와 동일.
- **summary.repository.ts 의 코드 변경** — 본 task 의 repository 수정은 **주석 텍스트 정정 only** (period literal `"daily"/"weekly"/"monthly"` → `"day"/"week"/"month"`). 메서드 시그니처 / interface / forwarding 로직 / Prisma error 정책 변경 0.

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 컬럼/literal 집합/invariant 결정을 박제했고, ContributionService (T-0115) 가 동일 구조 (@@unique 부재 → P2002 없음, FK → P2003 → BadRequestException) 의 exception-translation mirror 패턴을 fresh 하게 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
