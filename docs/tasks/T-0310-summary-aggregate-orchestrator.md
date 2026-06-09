---
id: T-0310
title: Summary aggregate 평가 orchestrator service 배선 (isPeriodEvaluable 게이트 + SummaryPersistService 결합)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-034, REQ-035, REQ-036, REQ-064]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-06-10
plannerNote: P5 ADR-0035 §Follow-ups orchestrator slice — in-memory EvaluationResult[] 입력으로 isPeriodEvaluable 게이트+SummaryPersistService 결합. bridge/RBAC/controller OUT → dependency-free.
---

# T-0310 — Summary aggregate 평가 orchestrator service 배선

## Why

[ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Follow-ups 의 "orchestrator/controller batch 평가 endpoint 배선 slice" 중 **orchestrator (controller 미포함) 조각**이다. Summary 평가 backbone 의 순수 함수 / service 들 — `isPeriodEvaluable` 시점 게이트 (T-0306, [period-evaluable.ts](../../src/assessment-evaluation/domain/period-evaluable.ts)) + `SummaryPersistService` (T-0309, narrative+metricScore 결합 reset-and-recreate, [summary-persist.service.ts](../../src/assessment-evaluation/summary-persist.service.ts)) — 가 전부 머지됐으나, 한 `(personId, period, periodStart)` 좌표 + 그 좌표의 단위 평가 묶음 (`EvaluationResult[]`) 을 받아 **시점 게이트 → 영속화** 를 한 흐름으로 묶는 상위 layer 가 0 이다. 본 slice 가 그 빈자리를 채우는 thin orchestrator 다 — `EvaluationOrchestratorService` (T-0292, [evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts)) 가 단위 평가 chain 을 compose 한 패턴을 정확히 mirror 한다 (새 알고리즘 0, compose + 게이트 순서만).

**dependency-free 근거** (Q-0030 게이트 회피): (1) 입력이 caller 가 넘기는 in-memory `EvaluationResult[]` 라 period→collection bridge / 영속 `Contribution[]` read 경로 불요 (ADR-0035 §Decision 1 가 in-memory source 를 명시 허용). (2) controller / HTTP endpoint / DTO 를 추가하지 않으므로 새 RBAC 결정 불요 (Q-0030 이 RBAC 를 ADR-gated 로 본 것은 bridge endpoint 의 HTTP layer 한정). (3) 새 외부 dependency 0 / 새 credential 0 / 새 migration 0 (`@@unique` 는 T-0305 박제, mocked-LLM unit + 기존 PrismaService). README L61~L63 / REQ-034/035/036 (일·주·월 요약 평가 + 시점 경계) 의 평가 layer compose 를 닫는다.

## Required Reading

- [docs/decisions/ADR-0035-aggregate-summary-evaluation.md](../decisions/ADR-0035-aggregate-summary-evaluation.md) — §Decision 1 (in-memory `EvaluationResult[]` source 허용), §Decision 3 (`isPeriodEvaluable` 게이트 — "평가 가능한가"만 판정, scheduler/trigger 발화는 OUT), §Decision 4 (fill/reeval 모드), §Follow-ups (orchestrator slice 경계).
- [src/assessment-evaluation/evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) — mirror 할 thin orchestrator 패턴 (compose + 순서 박제 + 실패 격리 propagate).
- [src/assessment-evaluation/evaluation-orchestrator.service.spec.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) — colocated spec 패턴 (mock service 주입 + compose 정합 검증). 본 slice 의 spec 도 이 위치 convention 을 따른다.
- [src/assessment-evaluation/summary-persist.service.ts](../../src/assessment-evaluation/summary-persist.service.ts) — 위임 대상 `persistSummary(context, results, mode, options)` 시그니처 + `SummaryPersistResult` / `SummaryPersistOptions` / `resetByPeriod`.
- [src/assessment-evaluation/domain/period-evaluable.ts](../../src/assessment-evaluation/domain/period-evaluable.ts) — `isPeriodEvaluable(period, periodStart, now)` 순수 게이트 + `computePeriodEnd` (알 수 없는 period throw).
- [src/assessment-evaluation/domain/summary-batch-prompt.ts](../../src/assessment-evaluation/domain/summary-batch-prompt.ts) L20~32 — `SummaryBatchContext` (personId/period/periodStart) shape (orchestrator 진입 인자).
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) L45 — `PersistMode = "fill" | "reeval"` (재사용 enum).
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) — provider/export 등록 위치 (본 service 를 providers + exports 에 추가).

## Acceptance Criteria

신규 `SummaryAggregateOrchestratorService` ([src/assessment-evaluation/summary-aggregate-orchestrator.service.ts](../../src/assessment-evaluation/summary-aggregate-orchestrator.service.ts)) 를 추가한다 — `SummaryPersistService` 를 생성자 주입받아, 한 `SummaryBatchContext` 좌표 + `EvaluationResult[]` + `mode` (`PersistMode`) + `options` (modelId) + `now: Date` 를 받아 **(1) `isPeriodEvaluable(context.period, context.periodStart, now)` 게이트 → (2) 평가 가능 시 `persistSummary` 위임 / 불가 시 skip 신호 반환** 의 흐름을 compose 하는 thin orchestrator 메서드 (예: `evaluateAndPersist`) 를 둔다. 반환 타입은 영속화 결과 (`SummaryPersistResult`) + "평가 가능 여부" 를 구분할 수 있는 typed surface (예: `{ evaluated: boolean; result?: SummaryPersistResult }` 또는 동등) 로 둔다. 새 알고리즘 0 — 게이트 함수 + persist service 위임의 compose + 순서만.

- [ ] **Happy-path unit test**: `now ≥ periodEnd` (평가 가능) 일 때 `persistSummary` 가 정확히 1 회 호출되고 그 결과 (`SummaryPersistResult`) 가 `evaluated: true` 와 함께 반환되는지 검증 (mock `SummaryPersistService` 주입). `EvaluationOrchestratorService` spec 의 mock 주입 패턴 mirror.
- [ ] **시점 게이트 분기 (branch 1 — 미평가)**: `now < periodEnd` (진행 중 구간) 일 때 `persistSummary` 가 **호출되지 않고** `evaluated: false` 가 반환되는지 검증 (day/week/month 각각 1+ 경계 case — 진행 중 vs 종료 직후 `now == periodEnd`).
- [ ] **시점 게이트 분기 (branch 2 — 평가 가능)**: day/week/month 각각 종료 후 (`now ≥ periodEnd`) persist 위임이 일어나는지 1+ test.
- [ ] **fill / reeval mode 전달 정합**: 받은 `mode` 가 `persistSummary` 에 그대로 전달되는지 (fill / reeval 각 1+) 검증.
- [ ] **Error path unit test 1**: `persistSummary` 가 reject (예: `ConflictException`) 하면 orchestrator 가 그 error 를 **swallow 하지 않고 전파 (throw)** 하는지 검증 (실패 격리 — `EvaluationOrchestratorService` 의 propagate 정책 mirror).
- [ ] **Error path unit test 2 (negative — 알 수 없는 period)**: `context.period` 가 `VALID_PERIODS` 밖 (예: `"year"`) 이면 `isPeriodEvaluable` → `computePeriodEnd` 가 throw 하고 그 error 가 전파되며 `persistSummary` 가 호출되지 않는지 검증.
- [ ] **Negative — 빈 묶음**: `results` 가 빈 배열이어도 게이트가 평가 가능을 반환하면 persist 위임이 일어나는지 (빈 묶음 자체는 본 orchestrator 가 reject 하지 않음 — `persistSummary`/`aggregateMetricScore` 가 빈 입력 결정적 처리, ADR-0035 §Decision 1) 1+ test.
- [ ] **module 배선 + DI resolve assertion**: `SummaryAggregateOrchestratorService` 를 [assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) 의 `providers` + `exports` 에 등록하고, module.spec 에서 DI resolve assertion 1+ 추가 (T-0307 round2 MAJOR 학습 — provider 미배선 선제 차단). `SummaryPersistService` 가 이미 provider 라 추가 import 0 (같은 module 내 DI resolve).
- [ ] **colocated spec 위치**: spec 은 `src/assessment-evaluation/summary-aggregate-orchestrator.service.spec.ts` (colocated) 에 둔다 — `EvaluationOrchestratorService` spec convention 정합.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 orchestrator service line/function 100% 목표 (thin compose 라 충분히 도달 가능).
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과 확인 (R-110).

## Out of Scope

- **controller / HTTP endpoint / DTO 추가 금지** — manual trigger batch 평가 endpoint 배선은 별도 후속 slice (새 RBAC 결정 = Q-0030 ADR-gated). 본 slice 는 service layer compose 까지만.
- **period→collection→evaluate bridge 금지** — `personId`/`period` → collection → `Activity[]` → 단위 평가 → `EvaluationResult[]` 도출 경로는 cross-module/RBAC ADR (Q-0030 옵션 2) 영역. 본 orchestrator 는 caller 가 in-memory `EvaluationResult[]` 를 **이미 넘긴다** 고 전제.
- **영속 `Contribution[]` DB read source 금지** — ADR-0035 §Decision 1 의 "영속 source 우선" 경로는 별도 slice. 본 slice 는 in-memory `EvaluationResult[]` 입력만.
- **scheduler / 자동 trigger 금지** — `isPeriodEvaluable` 은 "평가 가능한가" 만 판정, 자동 발화 (@nestjs/schedule cron) 는 P7 새 dep (ADR-0035 §Decision 3 OUT). 본 orchestrator 는 `now` 를 주입받아 게이트만.
- **live LLM 실 호출 금지** — mocked-LLM unit 으로 검증 (§5 credential deferred). `SummaryPersistService` 가 이미 narrative service 를 통해 mocked gateway 를 쓰므로 orchestrator spec 은 `SummaryPersistService` 자체를 mock 주입.
- **새 dependency / migration / credential 금지** — 발생 시 BLOCKED (§5).
- **timezone 확정 금지** — `isPeriodEvaluable` 의 자정/주/월 timezone 경계 확정은 Q-0026 동행 후속. 본 slice 는 게이트 함수를 현 계약 (periodStart 가 경계 시각으로 주어짐) 그대로 호출.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0035 §Decision 1/3/4 + `EvaluationOrchestratorService` 패턴이 설계를 이미 박제, 새 결정 0).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
