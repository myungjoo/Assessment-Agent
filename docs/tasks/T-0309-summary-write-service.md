---
id: T-0309
title: Summary aggregate write service (narrative+metricScore 결합 → reset-and-recreate persist)
phase: P5
status: DONE
completedAt: 2026-06-10T02:18:00+09:00
prNumber: 260
mergedAs: 1f7a028
reviewRounds: 2
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-064]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-06-10
plannerNote: "P5/ADR-0035 §Follow-ups write-service slice(2/2). narrative(T-0307)+metricScore(T-0306) 결합→Summary $transaction reset-and-recreate. 새 migration/dep/credential 0(@@unique T-0305 박제). cap-bend: R-112 backbone×1.5=270 LOC."
---

# T-0309 — Summary aggregate write service (narrative+metricScore 결합 → reset-and-recreate persist)

## Why

[ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Follow-ups 의 "aggregate 평가 write service slice" (write service 분할 2/2) 다. 첫 조각 T-0307 (`SummaryNarrativeService.generateBatchNarrative` — LLM 정성 narrative 생성) 이 머지됐고 (7017581), T-0306 (`aggregateMetricScore` — deterministic metricScore 순수 함수) 도 머지됐다. 본 task 는 이 둘을 한 `(personId, period, periodStart)` 좌표에 대해 **결합**해 `Summary` row 1 개를 **reset-and-recreate** 로 영속화하는 write service 를 신설한다 ([ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Decision 1 narrative=LLM / metricScore=deterministic, §Decision 4 reset-and-recreate + idempotency key `(personId, period, periodStart)`). [PLAN.md](../PLAN.md) P5 L97 "일·주·월 요약 평가 + 자정 경계" 의 영속화 backbone 이며, README L61~L63 (요약 평가문 + Metric 수치 함께 보유) 를 평가 layer 에서 충족한다. `EvaluationResultPersistService` (T-0300, [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md)) 의 `$transaction` reset-and-recreate + fill/reeval + P2002→ConflictException 패턴을 그대로 mirror 한다.

## Required Reading

- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` — §Decision 1 (narrative=LLM batch / metricScore=deterministic field-level 분리), §Decision 4 (Summary reset-and-recreate + idempotency key `(personId, period, periodStart)` + fill/reeval + partial-reset prefix delete), §Follow-ups (본 write service slice 의 정의).
- `src/assessment-evaluation/evaluation-result-persist.service.ts` — **mirror 대상**. `$transaction` 안의 findUnique→모드 분기(fill no-op / reeval delete)→create, `resetByPeriod` partial-reset (`deleteMany where { personId, period }`), `getPrismaErrorCode` 로 P2002→`ConflictException` 변환, `PersistMode = "fill" | "reeval"` 재사용 패턴.
- `src/assessment-evaluation/summary-narrative.service.ts` — 주입해 consume 할 `SummaryNarrativeService.generateBatchNarrative(context, results, { modelId })` 시그니처 (narrative string 반환, DB write 0). module 에 이미 providers+exports 등록됨 (T-0307 round-2).
- `src/assessment-evaluation/domain/summary-aggregate.ts` — `aggregateMetricScore(results: EvaluationResult[]): number` 순수 함수 (deterministic, LLM 무관, 빈 입력 0). 결합할 metricScore source.
- `src/assessment-evaluation/domain/summary-batch-prompt.ts` — `SummaryBatchContext { personId; period; periodStart: Date }` 타입 (narrative service 가 받는 좌표 context). 본 write service 의 입력 context 와 정합.
- `src/user/summary.repository.ts` — `SummaryCreateInput { personId; period; periodStart; narrative; metricScore }` shape + `prisma.summary` delegate 사용 패턴 (단 본 repository 는 thin CRUD 라 reset-and-recreate $transaction 미보유 — write service 가 직접 `prisma.summary` delegate 를 `$transaction` 으로 사용하거나 repository 를 compose).
- `src/assessment-evaluation/assessment-evaluation.module.ts` — `SummaryNarrativeService` / `EvaluationResultPersistService` 가 이미 providers+exports 에 등록됨. 본 write service 도 같은 module 에 등록 (`PrismaService` 는 @Global PersistenceModule 이라 추가 import 0).
- `prisma/schema.prisma` L341~361 — `Summary` model + `@@unique([personId, period, periodStart])` (T-0305 migration 으로 **이미 박제됨** — 본 task 는 schema 변경/migration 0). idempotency key 의 schema backbone.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/summary-persist.service.ts` 에 `SummaryPersistService` (`@Injectable`) 신설. 생성자 주입: `PrismaService` + `SummaryNarrativeService` (둘 다 module DI resolve). 진입 메서드 (예: `persistSummary(context, results, mode, options)`) 는 한 `(personId, period, periodStart)` 좌표에 대해 (1) `aggregateMetricScore(results)` 로 deterministic metricScore 산출, (2) `summaryNarrativeService.generateBatchNarrative(context, results, { modelId })` 로 narrative 생성, (3) `$transaction` 안에서 reset-and-recreate 로 `Summary` row 1 개 write. `PersistMode = "fill" | "reeval"` 은 `evaluation-result-persist.service.ts` 의 것을 import 재사용 (새 enum 발명 0).
- [ ] reset-and-recreate semantics: `$transaction` 안에서 idempotency key `(personId, period, periodStart)` 로 기존 Summary 를 findUnique → `fill` 모드면 존재 시 no-op (기존 보존, 중복 row 0) / `reeval` 모드면 존재 시 delete 후 create. delete+create 를 단일 `$transaction` 으로 묶어 atomicity 보장 (`EvaluationResultPersistService.persistInTransaction` mirror).
- [ ] partial-reset 메서드 (예: `resetByPeriod(personId, period)`): `prisma.summary.deleteMany({ where: { personId, period } })` 로 한 person 의 한 period Summary 만 일괄 삭제, 삭제 row 수 반환. `period` literal 은 `VALID_PERIODS` (assessment.service.ts) 로 검증 (`resetByPeriod` mirror).
- [ ] P2002 (`@@unique` 위반 — reset-and-recreate 경합 등) → `ConflictException` 변환. `getPrismaErrorCode` duck-typing helper 재사용 (또는 동형 inline), 그 외 Prisma error (P2025/P2003/unknown) 는 swallow 0 으로 propagate.
- [ ] `SummaryPersistService` 를 `assessment-evaluation.module.ts` 의 providers 에 등록 + (후속 orchestrator/controller slice 가 inject 받을 수 있도록) exports 에 추가. DI resolve 검증 — module 컴파일 test 또는 `Test.createTestingModule` 로 `SummaryPersistService` resolve 가능 assertion 1+.
- [ ] **Happy-path unit test**: colocated spec `src/assessment-evaluation/summary-persist.service.spec.ts` 에서 mock `PrismaService` (`summary` delegate + `$transaction`) + mock `SummaryNarrativeService` 주입 → `fill`/`reeval` 각 모드의 정상 write happy-path 1+ (생성된 row 의 narrative=mock narrative, metricScore=`aggregateMetricScore` 출력 정합).
- [ ] **Error path unit test**: `SummaryNarrativeService.generateBatchNarrative` reject 전파 (narrative 실패 시 throw, swallow 0) test 1+; `$transaction` / `prisma.summary` delegate 실패 전파 test 1+.
- [ ] **Flow / branch coverage**: fill 존재(no-op) / fill 부재(create) / reeval 존재(delete+create) / reeval 부재(create) 각 분기 1+ test. partial-reset 의 valid period / invalid period 분기 각 1+.
- [ ] **Negative cases 충분 cover** — 예외 상황 분기마다 각 1+ test: P2002→`ConflictException` 변환, P2025/그 외 Prisma error 는 변환 없이 propagate, 빈 묶음 (`results.length === 0` → metricScore 0 + narrative 는 service 위임) write, invalid period (partial-reset) → throw, unknown enum / type mismatch 전파.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec 의 R-112 4 종 (+ negative cases 충분 cover) 으로 `summary-persist.service.ts` 의 모든 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` (+ `pnpm test:smoke && pnpm test:e2e` CI) green.

## Out of Scope

- **orchestrator / controller batch endpoint 배선** — aggregate 평가 trigger endpoint (manual trigger + `isPeriodEvaluable` 게이트) + DTO (personId/period/periodStart/mode) 는 [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Follow-ups 의 별도 후속 slice. 본 task 는 write/persist service + module 등록까지만.
- **`isPeriodEvaluable` 시점 게이트 호출** — 시점 판정 함수 자체는 별도 slice (T-0306 chain) 이고, 본 write service 는 받은 좌표를 무조건 write 한다 (시점 게이트는 caller/orchestrator 책임).
- **period→collection→evaluate bridge** — period/personId → 수집 → 단위 평가 → 집계 의 cross-module bridge 는 본 module 밖 (Q-0029 옵션3, 별도 ADR-worthy slice). 본 task 는 in-memory `EvaluationResult[]` + context 를 입력으로 받을 뿐, 단위 평가 재실행이나 collection 호출 0.
- **영속 `Contribution[]` read source 경로** — [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Decision 1 은 영속 `Contribution[]` read 를 default 방향으로 박제하나, 본 slice 는 in-memory `EvaluationResult[]` 입력만 구현한다 (domain 순수성 — `aggregateMetricScore`/`generateBatchNarrative` 가 이미 `EvaluationResult[]` 입력). `Contribution[]` → `EvaluationResult[]` 재구성 read 경로는 Follow-up.
- **live LLM 실 호출** — §5 credential deferred. 본 task 는 mocked-LLM unit (mock `SummaryNarrativeService`) 으로만 검증.
- **schema 변경 / migration** — `Summary.@@unique` 는 T-0305 가 이미 박제 (prisma/schema.prisma L360). 본 task 는 schema/migration 0.
- **data-model.md / modules.md / api.md doc-sync** — [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Follow-ups 의 별도 direct doc-sync slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0035 §Decision 1/4 가 설계 박제 완료, `EvaluationResultPersistService` mirror precedent 존재).

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
