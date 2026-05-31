---
id: T-0115
title: ContributionService 추가 (ContributionRepository 위 HTTP exception 변환 + enum-as-String literal 검증)
phase: P3
status: DONE
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-033, REQ-036]
estimatedDiff: 480
estimatedFiles: 3
sizeExempt: true
exemptReason: "R-112 4-카테고리 backbone (service + colocated spec) × 1.5. Contribution 은 @@unique 부재라 P2002 sub-multiplier 미적용 (대신 P2003 FK 분기). literal 검증 분기(sourceType 3종 / difficulty 3종)마다 negative test 의무 + P2003/P2025 변환 분기별 test → colocated spec 의 test mass 가 envelope 초과. T-0114(AssessmentService) actual ~500 LOC / T-0111(521)/T-0112(502)/T-0113(512) precedent 1:1 mirror — service half 도 동등 mass 박제."
created: 2026-05-31
plannerNote: "P3 ~99.7% — ADR-0006 chain service half 2nd slice. ContributionRepository(T-0112) 위 application service. AssessmentService(T-0114) mirror. pr-mode, §5 미발동(schema/migration 0)."
---

# T-0115 — ContributionService 추가 (ContributionRepository 위 HTTP exception 변환 + enum-as-String literal 검증)

## Why

ADR-0006 repository chain 3/3 (AssessmentRepository T-0111 / ContributionRepository T-0112 / SummaryRepository T-0113) 이 완결되고 service half 의 첫 slice 인 **AssessmentService (T-0114) 가 머지** 되어, 동일 application-service layer 의 다음 sibling 인 **ContributionService** 가 자연스러운 다음 slice 다. Contribution 은 Assessment 의 직접 N:1 component (REQ-033 의 commit·문서 별 기여도·난이도·양 데이터 backbone) 이므로 도메인 chain (Assessment → Contribution → Summary) 상 Assessment 직후 순서가 가장 깔끔하다. SummaryService 보다 우선하는 이유: (a) Contribution 이 Assessment 의 component 라 chain 순서가 자연스럽고, (b) AssessmentService 가 방금 머지돼 동일 layer 패턴이 fresh 하며, (c) summary.repository.ts 의 주석 결함 (period 를 "daily/weekly/monthly" 로 오기) 은 SummaryService 진입 전 별도 doc/comment-fix follow-up 으로 분리 처리하는 편이 깔끔하다 (본 task scope 와 무관 — 다른 entity·다른 파일).

이는 [requirements.md](../requirements.md) REQ-029 (평가 자료 영속) / REQ-032 (raw 미저장) / REQ-033 (commit·문서 별 데이터) / REQ-036 (상대 비교 정규화 수치) 의 application-service backbone 이다. 기존 `AssessmentService` (T-0114) 와 `PersonService` (T-0036) 의 exception-translation 패턴을 1:1 mirror 한다 — Prisma known error code (`P2003` FK constraint / `P2025` record not found) 와 repository 의 `null` 반환을 NestJS HttpException (`BadRequestException` / `NotFoundException`) 으로 변환하고, ADR-0006 §Consequences 음의 4 가 service-layer 책임으로 박제한 enum-as-String literal 값 검증 (`sourceType` / `difficulty` 의 잘못된 literal 차단) 을 강제한다 — repository 는 값을 그대로 forward 하므로 이 검증은 반드시 service-layer 에 위치한다.

## Required Reading

- `src/user/contribution.repository.ts` (전체) — 본 service 가 inject·forward 할 대상. 4 메서드 (`create` / `findById` / `findByAssessment` / `delete`) 시그니처 + `ContributionCreateInput` interface (7 키) + P2003 (assessmentId FK 위반) / P2025 / null 정책. Contribution 은 immutable (update 없음), `@@unique` 부재 (P2002 미발생).
- `src/user/assessment.service.ts` (전체) — 직전 머지된 동일 layer mirror 대상. `getPrismaErrorCode` duck-typing helper, `VALID_*` literal 상수 export 패턴, `create` 의 literal 검증 + error 변환, `findById` 의 null → NotFoundException, `findByPerson` 의 컬렉션 빈 배열 반환, `remove` 의 P2025 → NotFoundException 변환 흐름. 본 service 의 메서드 구조 source.
- `src/user/person.service.ts` (전체) — exception-translation 의 원본 패턴 (AssessmentService 가 mirror 한 source). `getPrismaErrorCode` duck typing + P2025 변환.
- `src/user/assessment.service.spec.ts` (전체) — colocated spec 의 R-112 4 카테고리 패턴 + repository 를 Jest mock 으로 대체하는 방식 (실 repository / 실 DB 미연결) + P2002/P2025 fixture (`Object.assign(new Error, { code: "..." })`) 패턴 mirror 대상. 본 task 는 P2002 대신 **P2003** fixture 사용.
- `docs/decisions/ADR-0006-assessment-data-model.md` — Decision §2 (Contribution 컬럼 + sourceType `"commit"`/`"pr"`/`"document"` / difficulty `"easy"`/`"medium"`/`"hard"` 의 허용 literal 집합, `assessmentId` N:1 FK) / §6 (cascade — Assessment hard delete 시 component Contribution 동반 삭제) / §Consequences 음의 4 (enum-as-String literal 검증이 service-layer 책임).
- `src/user/user.module.ts` (L43–145) — `ContributionService` 를 providers / exports 에 등록할 위치. AssessmentService 등록 패턴 mirror (주석 정합 포함).

## Acceptance Criteria

본 task 의 변경 대상은 production code (`src/`) → `commitMode: pr`. tester 반드시 호출 (R-110). 산출 파일은 다음 3 개:

- [ ] `src/user/contribution.service.ts` 신설 — `@Injectable()` `ContributionService` 가 `ContributionRepository` 를 생성자 주입받아 다음 메서드를 노출한다 (AssessmentService 의 exception-translation 패턴 mirror, Contribution 은 immutable 이므로 update/deactivate/reactivate 없음):
  - `create(input: ContributionCreateInput): Promise<Contribution>` — (1) `sourceType` / `difficulty` 의 enum-as-String literal 값을 ADR-0006 §2 의 허용 집합으로 검증 (잘못된 literal 이면 `BadRequestException` throw — service-layer 책임, ADR-0006 §Consequences 음의 4). (2) 검증 통과 후 `repository.create` 호출. (3) `assessmentId` FK 위반 (Assessment row 부재) 시 propagate 된 `P2003` 를 catch 하여 `BadRequestException` 으로 변환 (잘못된 참조 input → 400, ADR-0006 §2 + contribution.repository.ts 의 "호출자가 BadRequestException 등으로 변환할 책임" 박제). Contribution 은 `@@unique` 부재 → **P2002 변환 분기 없음** (AssessmentService 와의 차이점).
  - `findById(id: string): Promise<Contribution>` — repository 의 `null` 반환 분기를 `NotFoundException` 으로 변환 (AssessmentService.findById mirror, HTTP 404 자동 mapping).
  - `findByAssessment(assessmentId: string): Promise<Contribution[]>` — REQ-033 의 aggregate-level fan-out (특정 Assessment 의 component Contribution 전체 조회). 매칭 row 0 시 빈 배열 `[]` 그대로 반환 (NotFoundException 던지지 않음 — 컬렉션 조회의 정상 결과). repository 에 그대로 forward (literal 검증 대상 없음).
  - `remove(id: string): Promise<void>` — hard delete (REQ-041 Admin 개별 manual delete lifecycle). repository.delete 가 propagate 한 `P2025` 를 `NotFoundException` 으로 변환 (AssessmentService.remove mirror).
  - `getPrismaErrorCode` duck-typing helper 는 AssessmentService / PersonService 의 것을 mirror (runtime 의존성 늘리지 않도록 `Prisma.PrismaClientKnownRequestError` instanceof 대신 `error.code` duck typing). 기존 service 들과 중복되나 본 task 는 기존 service 를 건드리지 않음 (공용 helper 추출은 Follow-up — 5 file cap + Out of Scope 보존).
  - 허용 literal 집합 (`VALID_SOURCE_TYPES` / `VALID_DIFFICULTIES`) 을 상수로 export 또는 module-private 로 박제 (difficulty 는 AssessmentService 의 `VALID_DIFFICULTIES` 와 동일 값이나 본 task 는 AssessmentService 를 import 해 결합하지 말고 자체 상수로 박제 — 공용화는 Follow-up. 단 본 task 에서 다른 service 수정 금지).
- [ ] `src/user/contribution.service.spec.ts` (colocated — `src/user/contribution.service.spec.ts`) 신설 — R-112 4 카테고리 전부. `ContributionRepository` 를 Jest mock 으로 대체 (실 repository / 실 DB 미연결, assessment.service.spec.ts 의 mock 패턴 mirror):
  - [ ] **Happy-path**: `create` (유효 literal) / `findById` (row 존재) / `findByAssessment` (component 다수 + 0건) / `remove` (정상 삭제) 각각이 올바른 repository 메서드를 올바른 인자로 호출하고 return 값을 propagate 하는지 1+ test.
  - [ ] **Error path**: (a) `create` 가 repository 의 `P2003` 를 `BadRequestException` 으로 변환하는지, (b) `findById` 가 repository 의 `null` 을 `NotFoundException` 으로 변환하는지, (c) `remove` 가 repository 의 `P2025` 를 `NotFoundException` 으로 변환하는지 각 1+ test.
  - [ ] **Flow / branch**: `create` 의 literal 검증 통과 분기 (정상 흐름) 1+ test. `findByAssessment` 의 컬렉션 결과 (다수 vs 빈 배열) 분기 각 1+ test.
  - [ ] **Negative cases 충분 cover** (예외 분기마다 — 단일 negative 금지): (a) `create` 의 `sourceType` 가 허용 집합 밖 (예: `"issue"`) → `BadRequestException`, (b) `create` 의 `difficulty` 가 허용 집합 밖 (예: `"trivial"`) → `BadRequestException`, (c) `create` 의 P2003 propagate → BadRequestException (FK 위반 시나리오 — assessmentId 가 존재하지 않는 Assessment 를 가리킴), (d) `remove` 의 P2025 propagate → NotFoundException, (e) `create` 가 P2003 가 아닌 unknown error 를 받으면 그대로 re-throw (변환 안 함) 검증, (f) `create` 가 P2002 (또는 기타 known code) 를 받아도 본 service 는 P2002 변환 분기가 없으므로 그대로 re-throw 됨 검증 — Contribution 은 unique 제약 부재라 ConflictException 변환을 하지 않음. 각 1+ test.
  - [ ] **raw 미저장 (R-59) invariant 재확인**: `create` 가 `ContributionCreateInput` (raw 본문 컬럼 부재 type, sourceUrl/sourceRef 는 pointer) 만 받아 repository 로 forward 하며 raw 키를 주입하지 않음을 검증하는 test 1+ (type-level 은 컴파일 차원, runtime 은 forward 키 집합 assert — repository spec 의 guard 와 service layer 의 일관성 확인).
  - [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` 의 `coverageThreshold.global` 강제). 본 service 는 분기 + 단순 변환이라 100% 도달 자연스러움.
- [ ] `src/user/user.module.ts` 에 `ContributionService` 를 `providers` 에 등록 + `exports` 에 추가 (후속 ContributionController / endpoint 가 inject 가능하도록 — AssessmentService 등록 패턴 mirror). import 정렬 유지. 등록 위치 주석은 AssessmentService 주석 (L98–102) 스타일 mirror.
- [ ] `pnpm lint && pnpm build && pnpm test` (또는 `test:cov`) green. tester 가 결과 확인 (R-110).
- [ ] R-113: smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 도 CI 에서 실행 — 본 task 는 service unit layer 라 신규 e2e 추가 의무 없음 (endpoint 0). 기존 smoke/e2e 가 회귀 없이 green 유지함을 확인.

## Out of Scope

- **ContributionController + DTO + endpoint** — 별도 후속 task. 본 task 는 service layer 1 개만 (HTTP-facing 0).
- **SummaryService** — 별도 slice (Follow-ups). 본 task 는 Contribution entity 의 service 1 개만. SummaryService 진입 시 summary.repository.ts 의 period 주석 결함 (`"daily"/"weekly"/"monthly"` → ADR-0006 L85 의 `"day"/"week"/"month"`) 정정을 그 task scope 또는 별도 doc/comment-fix task 에 fold (본 task 는 contribution.repository.ts 만 사용하므로 무관).
- **NewPersonEvent / 도메인 이벤트 emit** (REQ-027) — AssessmentModule 의 이벤트 흐름은 별도 task. 본 service 는 CRUD + 변환 + literal 검증만.
- **`getPrismaErrorCode` / literal 검증 helper 의 공용 util 추출** — PersonService / AssessmentService 와 중복되나 본 task 에서 기존 service 를 건드리면 diff 확장 + 회귀 위험. 공용화는 별도 refactor follow-up (Follow-ups 박제).
- **`prisma/schema.prisma` / migration 변경 0** — schema 는 T-0110 으로 머지 완료. 본 task 가 schema 를 건드리면 §5 DB-schema BLOCKED 게이트 재발동 — 절대 금지.
- **AuthGuard / RBAC 권한 적용** — endpoint 가 없으므로 본 task 범위 외 (controller task 책임).
- **`update` / `softDelete` / `restore`** — Contribution 은 immutable (ADR-0006 §2). 박제하지 않는다.
- **P2002 → ConflictException 변환 분기** — Contribution 은 `@@unique` 부재이므로 P2002 가 발생하지 않는다. AssessmentService 와 달리 ConflictException 변환을 박제하지 않는다 (negative test 로 re-throw 됨만 확인).

## Suggested Sub-agents

`implementer → tester` (architect 미호출 — ADR-0006 이 모든 컬럼/literal 집합/invariant 결정을 박제했고, AssessmentService (T-0114) 가 동일 layer 의 exception-translation mirror 패턴을 fresh 하게 제공하므로 신규 아키텍처 결정 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append.)
