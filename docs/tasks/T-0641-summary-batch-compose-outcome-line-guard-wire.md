---
id: T-0641
title: R-61 요약 batch 합성 진입점 evaluateAndReportForRoster 의 반환 result.summaryLine 에 outcome-line 형태 가드 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 R-61(PLAN 97행) — evaluateAndReportForRoster 는 합본 report 만 가드(T-0634 상속), 반환 result.summaryLine(T-0640 이후 standalone caller surface)은 비가드. 그 outcome 라인에 assertSummaryBatchOutcomeFormatShape 배선해 composed 경로 대칭 완결. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0641 — R-61 요약 batch 합성 진입점 evaluateAndReportForRoster 의 반환 result.summaryLine 에 outcome-line 형태 가드 배선

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". p5-summary-aggregate stream 은 표현 surface 의 각 산출 직전에 형태 가드를 배선해 손상 라인이 caller(로그·journal·notification surface)에 도달하기 전 fail-fast 차단해 왔다 — `previewRosterPlan` 은 plan 라인 가드(T-0636), `reportBatch` 는 합본 report 가드(T-0634), `previewOutcomeLine` 은 outcome 라인 가드(T-0640)를 각각 산출 직전에 단언한다.

그러나 합성 진입점 `evaluateAndReportForRoster(roster)`(T-0632)는 **합본 `report` 만 가드되고(`reportBatch` 의 T-0634 단언 자동 상속), 함께 반환하는 `result.summaryLine`(outcome 한 줄 요약)은 독립 형태 가드가 부재**하다. 이 비대칭은 T-0640 이 `previewOutcomeLine` 으로 `result.summaryLine` 을 standalone caller surface 로 외화한 이후 의미가 생겼다 — `evaluateAndReportForRoster` 의 caller 가 반환 객체 `{ result, report }` 에서 `result.summaryLine` 을 직접 읽으면(합본 report 를 거치지 않고 outcome 라인만 단독 사용), T-0639/T-0640 이 다른 경로에 배선한 outcome 형태 가드를 우회한 채 손상 가능 라인을 받는다. `report` 의 2번째 라인(outcome)은 가드되지만, 그 가드는 합본 report 문자열에 대한 것이라 caller 가 `result.summaryLine` 필드를 직접 역참조하는 경로는 보호하지 못한다.

본 task 는 그 비대칭을 채운다 — `evaluateAndReportForRoster` 가 `reportBatch` 로 report 를 산출한 뒤·`{ result, report }` 반환 전에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 를 1회 단언해, 반환되는 `result.summaryLine`(standalone outcome surface)이 형태 불변식을 만족함을 보장한다. `previewOutcomeLine`(T-0640)과 동일 가드를 동일 단언 지점 정책으로 합성 진입점에 상속시키는 narrow wiring — 본 task 닫히면 p5-summary-aggregate stream 의 4 표현 산출(plan 라인 · outcome 라인 · 합본 report · 합성 진입점의 result.summaryLine)이 모두 산출 직전 형태 가드로 대칭 보호된다.

## Required Reading

- [src/assessment-evaluation/summary-batch-orchestrator.service.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.ts) — `evaluateAndReportForRoster(roster)`(L462~472) 가 본 task 가 가드를 배선할 진입점. 현재 `const result = await this.evaluateBatchForRoster(roster)` → `const report = this.reportBatch(roster, result)` → `return { result, report }` 의 3 step. step 2(reportBatch)와 step 3(return) 사이에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언 1줄 배선. `previewOutcomeLine`(L529~) 이 동일 가드를 `result.summaryLine` 에 호출하는 정확한 패턴(읽기 → 가드 → 반환) 참조. 기존 import 블록(상단)에 `assertSummaryBatchOutcomeFormatShape` import 가 T-0640 으로 이미 존재하는지 확인 — 존재하면 재사용(추가 import 0), 없으면 1줄 추가. JSDoc 의 실패 전파/흐름 서술(L419~460)에 outcome-line 가드 step 1줄 보강.
- [src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts) — T-0638 `assertSummaryBatchOutcomeFormatShape(line: string): void` 의 throw 계약(구조·타입 결손=한국어 TypeError / 값·형태 위반=한국어 RangeError 구분) — 본 진입점이 호출할 가드 (본문 변경 0, import 만).
- [src/assessment-evaluation/domain/summary-batch-pipeline.ts](../../src/assessment-evaluation/domain/summary-batch-pipeline.ts) — `SummaryBatchPipelineResult` 타입(`{ plan, outcomes, report, summaryLine }`) — `result.summaryLine: string` 필드 위치 확인 (본문 변경 0).
- [src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts) — 기존 `evaluateAndReportForRoster` describe 블록(T-0632 박제) + `previewOutcomeLine` describe 블록(T-0640 박제, 가드 호출 1회 검증·throw 전파·호출 순서 assert 구조) — 본 task 가 `evaluateAndReportForRoster` describe 에 outcome-line 가드 배선 검증 test 를 append 할 colocated spec. 그 가드-배선 spec 구조(가드 spy 호출 1회·정상 통과 위임·throw 전파·report 가드와의 순서) mirror.

## Acceptance Criteria

- [ ] `summary-batch-orchestrator.service.ts` 의 `evaluateAndReportForRoster` 에 outcome-line 형태 가드 배선 — `this.reportBatch(roster, result)` 호출 직후·`return { result, report }` 직전에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언 1회 추가. 정상 형태면 void(무회귀)로 통과해 `{ result, report }` 반환, 위반이면 가드 throw 가 그대로 전파되어 반환 미도달(손상 result.summaryLine 미반환). import 가 T-0640 으로 이미 존재하면 재사용, 없으면 import 1줄 추가.
- [ ] outcome-line 가드는 `report` 가드와 **독립 단언 지점** — `reportBatch` 의 T-0634 `assertSummaryBatchReportShape(report)` 가드는 합본 report 문자열 대상, 본 task 가 추가하는 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 는 `result.summaryLine` 필드(standalone surface) 대상이라 이중 단언 아님(서로 다른 입력·다른 불변식). report 가드가 먼저(reportBatch 내부), outcome 가드가 나중(반환 직전) 순서.
- [ ] `evaluateBatchForRoster`/`reportBatch`/`previewOutcomeLine`/`assertSummaryBatchOutcomeFormatShape`/formatter/pipeline/composer **본문 변경 0** — 본 task 는 `evaluateAndReportForRoster` 의 가드 단언 1줄 추가 + (필요 시) import 1줄 + JSDoc/주석 보강만. service 생성자·DI·기타 진입점(`evaluateBatch`/`evaluateBatchForRoster`/`previewRosterPlan`/`reportBatch`/`previewOutcomeLine`) 무변경.
- [ ] 가드 추가가 step 순서·실패 전파를 깨지 않음 — `evaluateBatchForRoster` reject 시 await 가 즉시 전파해 `reportBatch`·outcome 가드 둘 다 미도달(report·반환 미생성). `reportBatch` 가 report 형태 위반 throw 시 outcome 가드 미도달. 두 가드 모두 통과해야 `{ result, report }` 반환.
- [ ] 순수성·안전 보존: 직접 부수효과 0·새 dependency 0·migration 0·schema 변경 0·raw 미저장(R-59 — 형태 검증만, 평가 본문·summaryId 미접촉)·입력 비변형(`roster`·`result`·`result.summaryLine` 변형 0).
- [ ] **Happy-path test 1+**: `evaluateAndReportForRoster(roster)` 가 정상 roster 로 실행돼 정상 형태 `result.summaryLine` 을 산출하면, outcome 가드가 통과하고 `{ result, report }` 를 정상 반환(가드가 정상 outcome 라인을 변형·차단 0, 반환 `result.summaryLine` 은 산출값과 byte-identical). 1+.
- [ ] **Error path test 1+**: 손상 outcome 라인 경로 1+ — `evaluateBatchForRoster` 가 손상 `summaryLine`(개행 혼입·prefix drift·버킷 슬롯 누락) 을 가진 result 를 산출하도록 mock(또는 `assertSummaryBatchOutcomeFormatShape` 를 jest mock 으로 RangeError throw 강제)해, `evaluateAndReportForRoster` 가 그 throw 를 그대로 전파하고 `{ result, report }` 를 반환하지 않음을 assert. 추가로 `evaluateBatchForRoster` reject → 그 reject 전파(reportBatch·outcome 가드 미도달) 1+, `reportBatch` report 형태 위반 throw → 그 throw 전파(outcome 가드 미도달) 1+.
- [ ] **Flow/branch test**: ① 정상 형태(report 가드 통과 → outcome 가드 통과 → `{ result, report }` 반환) 분기 1 ② outcome 가드 throw(report 가드는 통과했으나 summaryLine 손상 → 전파·반환 미도달) 분기 1 ③ report 가드 throw(reportBatch 단계 fail → outcome 가드 미도달) 분기 1 ④ evaluateBatchForRoster reject(실행 단계 fail → 두 가드 미도달) 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① outcome 가드 throw 시 `evaluateAndReportForRoster` 가 반환값을 만들지 않음(전파만, 손상 result 미반환) ② 가드 호출 순서 — report 가드(reportBatch 내부) → outcome 가드(반환 직전) 순서(spy 호출 순서 assert) ③ outcome 가드는 `result.summaryLine` 만 읽는다(plan/outcomes/report 미접촉, 입력 비변형) ④ report 형태 위반 시 outcome 가드 미도달(report 가드가 먼저 차단) ⑤ evaluateBatchForRoster reject 시 두 가드 모두 미호출(실행 단계 fail-fast) ⑥ 정상 경로에서 outcome 가드는 정확히 1회 호출(중복 단언 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 service 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `assertSummaryBatchOutcomeFormatShape`/`assertSummaryBatchReportShape`/formatter/pipeline 가드·formatter **본문** 변경(가드 로직·불변식·formatter 출력 무변경) — 본 task 는 `evaluateAndReportForRoster` 의 가드 단언 1줄 + import + JSDoc/주석 갱신만.
- `reportBatch`/`formatSummaryBatchReport` 합본 report 의 outcome 라인(2번째 라인)에 추가 배선 — T-0639 가 도메인 formatter 측에 이미 배선했고 본 task 는 `result.summaryLine` 필드(별개 입력)만 대상이라 그 경로 미접촉.
- `previewOutcomeLine`(T-0640) 본문 변경 — 본 task 는 합성 진입점 `evaluateAndReportForRoster` 에만 가드 배선. 두 진입점은 별개 산출 지점이라 이중 단언 아님.
- 가드를 로그·journal·notification·관측 layer 의 다른 지점에 추가 배선 — 본 task 는 `evaluateAndReportForRoster` 반환 직전 1 지점만.
- 자동 복구·정규화·drop·재렌더 — 손상 outcome 라인은 fail-fast throw 전파만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 p5-summary-aggregate stream 의 4 표현 산출(plan 라인 `previewRosterPlan` · outcome 라인 `previewOutcomeLine` · 합본 report `reportBatch` · 합성 진입점 `evaluateAndReportForRoster` 의 result.summaryLine)이 모두 산출 직전 형태 가드로 대칭 보호된다. 남는 자연 follow-up: 둘 다 §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 인접 PLAN bullet 으로 stream 전환 판단. summary-batch 표현 surface 는 본 task 로 가드 대칭이 포화되므로 다음은 stream 전환이 자연스럽다.)
