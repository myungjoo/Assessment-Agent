---
id: T-0634
title: R-61 요약 batch 합본 리포트 shape 가드를 service reportBatch 산출 직전에 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — T-0633 assertSummaryBatchReportShape(PR #547 50d5625)가 exists-but-unwired. reportBatch 가 formatSummaryBatchReport 산출 직후·반환 전 가드 단언 배선. T-0621/T-0627 wiring 패턴 동형. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0634 — R-61 요약 batch 합본 리포트 shape 가드를 service reportBatch 산출 직전에 배선

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". T-0633(`assertSummaryBatchReportShape`, PR #547 squash 50d5625)이 합본 리포트 2-라인 블록 형태 불변식(① string · ② 정확히 2 라인 = `\n` 1개·후행 개행 0 · ③ 1번째 라인 `계획: ` 라벨+본문 · ④ 2번째 라인 `결과: ` 라벨+본문 · ⑤ 라벨 뒤 본문 non-empty)을 런타임 fail-fast 가드로 **정의·검증만** 했고, `src/` 의 어떤 caller 도 호출하지 않는 **exists-but-unwired** 상태다(grep 매치 = 자기 + 자기 spec 2 파일).

`SummaryBatchOrchestratorService.reportBatch(roster, result)` 는 `formatSummaryBatchReport(roster, result)` 로 합본 리포트 문자열을 산출해 caller(로그·journal·향후 notification surface)로 그대로 흘려보낸다. 그러나 그 산출 직후 형태 불변식을 단언하는 지점이 없어, 합성 단계의 미래 회귀(라벨 drift·라인 수 변형·후행 개행 혼입·빈 라인 위장)가 발생하면 손상된 합본 리포트가 표현 surface 로 **silent leak** 한다.

본 task 는 그 빈칸을 채운다 — `reportBatch` 가 `formatSummaryBatchReport(roster, result)` 산출 직후·반환 전에 `assertSummaryBatchReportShape(report)` 단언을 배선해, 손상 report 가 surface 로 새기 전 fail-fast 차단한다. T-0621 `assertSummaryBatchOutcomeConsistent` 배선·T-0627 `assertSummaryBatchRosterInputConsistent` 배선과 동형의 wiring slice — 이번엔 합본 표현 형태 가드 대상. `evaluateAndReportForRoster(roster)` 는 내부에서 `reportBatch` 를 호출하므로 가드를 자동 상속(별도 배선 0).

## Required Reading

- [src/assessment-evaluation/summary-batch-orchestrator.service.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.ts) — `reportBatch(roster, result)` 가 `formatSummaryBatchReport` 산출을 반환하는 지점(가드 단언 배선 대상) + `evaluateAndReportForRoster` 가 `reportBatch` 를 호출해 가드 자동 상속하는 경로
- [src/assessment-evaluation/domain/summary-batch-report-shape.ts](../../src/assessment-evaluation/domain/summary-batch-report-shape.ts) — T-0633 `assertSummaryBatchReportShape(report: string): void` 의 throw 계약(구조 결손=TypeError / 형태 위반=RangeError) — 본 배선이 호출할 가드 (본문 변경 0, import 만)
- [src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts) — 기존 `reportBatch`·`evaluateAndReportForRoster` describe 블록(T-0631/T-0632 박제) — 본 task 가 가드 호출 배선 케이스를 append 할 colocated spec. T-0627 의 가드-배선 spec 구조(가드 호출 1회 검증·정상 통과 위임·throw 전파·호출 순서 assert) mirror

## Acceptance Criteria

- [ ] `summary-batch-orchestrator.service.ts` 의 `reportBatch(roster, result)` 가 `formatSummaryBatchReport(roster, result)` 로 합본 리포트 문자열을 산출한 직후·반환 전에 `assertSummaryBatchReportShape(report)` 단언을 호출하도록 배선 — import 1줄 + 호출 1줄 + JSDoc `@throws`(가드의 TypeError/RangeError) 갱신. 정상 형태면 가드가 void 반환 후 그 report 를 그대로 반환(동작 무회귀), 위반 형태면 가드 throw 가 그대로 전파(로그·notification surface 도달 전 차단).
- [ ] `evaluateAndReportForRoster(roster)` 는 내부에서 `reportBatch` 를 호출하므로 가드를 **자동 상속** — 별도 가드 호출 배선 0(이중 단언 금지). spec 으로 상속 동작(roster 실행 후 합본 리포트가 가드를 통과해 반환됨)을 검증.
- [ ] `formatSummaryBatchReport`/`assertSummaryBatchReportShape`/`evaluateBatchForRoster`/pipeline/composer/enumerate **본문 변경 0** — 본 task 는 service 의 import + 단언 호출 + JSDoc 갱신만. service 생성자·DI·기존 진입점(`evaluateBatch`/`evaluateBatchForRoster`/`previewRosterPlan`) 무변경.
- [ ] 순수성·안전 보존: 직접 부수효과 0·새 dependency 0·migration 0·schema 변경 0·raw 미저장(R-59 — 형태 검증만, 평가 본문 미접촉)·입력 비변형.
- [ ] **Happy-path test 1+**: `reportBatch(roster, result)` 가 정상 2-라인 블록을 산출하면 가드 단언이 통과하고 `formatSummaryBatchReport` 산출과 byte-identical 한 문자열을 반환(가드가 정상 report 를 변형·차단하지 않음). `evaluateAndReportForRoster` 의 자동 상속 happy-path 1+ 포함.
- [ ] **Error path test 1+**: 가드가 throw 하는 경로 1+ — 손상 report(예: 가드 모듈을 jest mock 으로 RangeError throw 하도록 강제, 또는 `formatSummaryBatchReport` 를 mock 해 잘못된 형태 반환)에서 `reportBatch` 가 그 throw 를 그대로 전파하고 손상 report 를 반환하지 않음을 assert. `evaluateAndReportForRoster` 도 동일 전파 1+.
- [ ] **Flow/branch test**: 가드 통과(정상 형태 → report 반환) 분기 1 + 가드 throw(손상 형태 → 전파·반환 미도달) 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 가드 throw 시 `reportBatch` 가 return 값을 만들지 않음(전파만, 손상 report 미반환) ② 가드 호출 순서 — `formatSummaryBatchReport` 산출 **후** 가드 호출(spy 호출 순서 assert: format → assert → return) ③ 같은 입력 2회 호출 독립·결정성(byte-identical 반환·입력 비변형) ④ `evaluateAndReportForRoster` 경로에서 가드 전파(roster 실행은 성공했으나 합본 형태 손상 시 reject·return 미도달) ⑤ 정상 형태 report 입력 비변형(가드가 report 문자열 변형 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 service 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `assertSummaryBatchReportShape`/`formatSummaryBatchReport`/`reportBatch` 가드 **본문** 변경(가드 로직·불변식·formatter 출력 무변경) — 본 task 는 service 의 import + 호출 1줄 + JSDoc 갱신만.
- `evaluateAndReportForRoster` 에 별도 가드 호출 추가(이중 단언) — `reportBatch` 위임으로 자동 상속만.
- 가드를 로그·journal·notification·관측 layer 의 다른 지점에 추가 배선 — 본 task 는 service `reportBatch` 산출 직전 1 지점만.
- 자동 복구·정규화·drop·재렌더 — 손상 report 는 fail-fast throw 전파만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. p5-summary-aggregate stream 의 순수 layer·service 5 진입점·표현 양 반쪽·3 가드(outcome/roster-input/report-shape)·가드 배선이 모두 머지되면, 남는 자연 follow-up 은 둘 다 §5 BLOCKED 인 ① manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) ② 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 인접 PLAN bullet 으로 stream 전환 판단.)
