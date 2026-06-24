---
id: T-0632
title: R-61 요약 batch roster 실행+합본 리포트 단일 진입점 evaluateAndReportForRoster 합성
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — T-0631 reportBatch 외화 후 run+report 두 메서드 수동 chain 공백을 단일 진입점으로 합성. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0632 — R-61 요약 batch roster 실행+합본 리포트 단일 진입점 evaluateAndReportForRoster 합성

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". T-0631(`reportBatch`, PR #545 squash 2243cc4)이 닫혀 `SummaryBatchOrchestratorService` 의 4 진입점(좌표 실행 `evaluateBatch` / roster 실행 `evaluateBatchForRoster` / roster 사전조회 `previewRosterPlan` / 사후 합본 리포트 `reportBatch`)이 모두 머지된 후, **roster 실행과 합본 리포트가 두 메서드로 분리**돼 있어 caller(로그·journal·notification·관측 surface)가 "roster batch 를 실행하고 그 계획+결과를 한 블록으로 받기" 위해 `evaluateBatchForRoster(roster)` → `reportBatch(roster, result)` 를 손수 이어 호출해야 한다. 본 task 는 그 두 호출을 단일 진입점 `evaluateAndReportForRoster(roster)` → `{ result, report }` 로 합성해(재구현 0, 합성만) caller 의 호출 순서·인자 drift 를 구조적으로 차단한다. T-0625 `evaluateBatchForRoster`(composer→실행 wiring)·T-0629 `previewRosterPlan`(formatter→service 외화) 과 동형의 합성 slice.

## Required Reading

- [src/assessment-evaluation/summary-batch-orchestrator.service.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.ts) — 4 진입점 정의(특히 `evaluateBatchForRoster` L225~, `reportBatch` L316~) + 클래스 머리말 주석(진입점 열거)
- [src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts) — 기존 spec 의 mock 주입(SummaryAggregateOrchestratorService) + roster-entry describe 패턴(T-0625/T-0627/T-0629/T-0631 케이스 mirror)
- [src/assessment-evaluation/domain/summary-batch-report-format.ts](../../src/assessment-evaluation/domain/summary-batch-report-format.ts) — `reportBatch` 가 위임하는 `formatSummaryBatchReport(roster, result)` 의 입력 계약(result.summaryLine 재사용, roster 위임 전파)

## Acceptance Criteria

- [ ] `SummaryBatchOrchestratorService` 에 `async evaluateAndReportForRoster(roster): Promise<{ result, report }>` 추가 — 내부에서 `const result = await this.evaluateBatchForRoster(roster)` 후 `const report = this.reportBatch(roster, result)` 를 호출하고 `{ result, report }` 반환. **두 메서드 합성만(재구현 0)** — pipeline 실행·formatter 렌더 로직 복제 금지.
- [ ] 반환 `result` 는 `evaluateBatchForRoster` 가 반환하는 `SummaryBatchPipelineResult`(`{ plan, outcomes, report, summaryLine }`) 와 동일 instance, `report` 는 `reportBatch(roster, result)` 가 반환하는 결정적 한국어 2 라인 블록 문자열(계획 라인 + 결과 라인).
- [ ] 기존 4 진입점(`evaluateBatch`/`evaluateBatchForRoster`/`previewRosterPlan`/`reportBatch`)·생성자·DI·주입 provider **무변경**. 클래스 머리말 주석의 진입점 열거를 "5 진입점(… + (5) `evaluateAndReportForRoster` — roster 실행 후 합본 리포트까지 한 호출로 반환)" 으로 정정.
- [ ] **Happy-path test 1+**: roster 입력 시 `evaluateBatchForRoster` 가 mock orchestrator 로 실행되고, 반환 `{ result, report }` 의 `result` 가 pipeline 산출과 일치하며 `report` 가 `formatSummaryBatchReport(roster, result)` 와 byte-identical.
- [ ] **Error path test 1+**: 주입된 orchestrator `evaluateAndPersist` 가 reject → `evaluateAndReportForRoster` 가 그 error 를 전파(swallow 0)하고 `reportBatch` 에 도달하지 않음(report 미생성). 추가로 `assertSummaryBatchRosterInputConsistent` 가 던지는 orphan-key RangeError / roster null·undefined TypeError 전파 검증.
- [ ] **Flow/branch test**: (a) 정상 경로 = 실행 성공 → report 생성·반환 / (b) 실행 reject → report 미생성·전파. 두 분기 각 1+. 호출 순서 assert(`evaluateBatchForRoster` 가 `reportBatch` 보다 먼저, reject 시 `reportBatch` spy 미호출).
- [ ] **Negative cases 충분 cover (각 1+)**: ① 빈 roster(personIds 빈 배열) → `evaluator` 호출 0·report 빈 batch 2 라인 ② roster null/undefined → TypeError 전파 ③ orphan 좌표 key → RangeError 전파·실행 미도달 ④ 입력 roster 객체 비변형(호출 후 deep-equal) ⑤ 2회 호출 독립(상태 누수 0, report 결정성). 단일 negative 만 작성 금지 — 위 예외 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 service 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- 좌표-진입점(`evaluateBatch`)에 동형 합성 메서드 추가 — roster-진입점만 본 task 대상(좌표-진입점은 caller 가 reportBatch 에 줄 roster 를 보유하지 않음).
- `formatSummaryBatchReport`/`reportBatch`/`evaluateBatchForRoster`/pipeline/composer/enumerate 본문 변경 — import·합성 호출만.
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

## Status

DONE — 2026-06-24T10:12:00Z. PR #546 squash merge d668402 (r1 APPROVE, 4-게이트 PASS). evaluateAndReportForRoster(roster)→{result,report} 합성 진입점 추가(재구현 0), 변경 service line/branch/function 100%, 전체 311 suite/7238 test green.
