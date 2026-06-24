---
id: T-0640
title: R-61 요약 batch outcome 한 줄 요약을 service 경계 previewOutcomeLine 으로 외화 (shape 가드 배선 동반)
phase: P5
status: DONE
commitMode: pr
prNumber: 554
mergedAs: ba0dd33
reviewRounds: 1
completedAt: 2026-06-24T15:59:58Z
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 R-61(PLAN 97행) — previewRosterPlan(T-0629/T-0636, 계획측) 의 outcome-side mirror. service 가 outcome 한 줄 요약(result.summaryLine)을 standalone 으로 외화하는 진입점 부재 → previewOutcomeLine(result) 신규 + assertSummaryBatchOutcomeFormatShape 산출 직전 배선. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0640 — R-61 요약 batch outcome 한 줄 요약을 service 경계 previewOutcomeLine 으로 외화 (shape 가드 배선 동반)

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". p5-summary-aggregate stream 은 표현 양 반쪽을 service 경계로 외화해 왔다 — 계획측(pre-flight roster plan 라인)은 `previewRosterPlan(roster)`(T-0629, PR #543)이 standalone 진입점으로 외화하고 T-0636(PR #550)이 그 산출 직전에 `assertSummaryBatchRosterPlanShape` 형태 가드를 배선했다. 그러나 **결과측(outcome 한 줄 요약 라인, `result.summaryLine`)에는 대응하는 standalone service 진입점이 없다**. 현재 outcome 라인은 오직 합본 리포트(`formatSummaryBatchReport` → `reportBatch`)의 2번째 라인으로만 흘러가, caller(로그·journal·향후 notification surface)가 outcome 요약만 단독으로 얻으려면 전체 합본 리포트를 거쳐야 한다(계획 라인까지 동반 — 비대칭).

`assertSummaryBatchOutcomeFormatShape`(T-0638, PR #552)은 outcome 한 줄 요약의 형태 불변식(① string · ② 개행 0(단일 라인) · ③ prefix `요약 평가 batch: 총 N건` · ④ 5 카운트 토큰(evaluated/skipped/created/existing) · ⑤ `[day N · week N · month N · other N]` 4 버킷 고정 순서)을 런타임 fail-fast 가드로 정의·검증했고, T-0639(PR #553)가 그 가드를 도메인 합본 formatter `formatSummaryBatchReport`(2번째 라인 산출 직전)에 배선했다. 즉 가드는 도메인 formatter 측에는 배선됐으나, **service 경계에는 outcome 라인 standalone 외화 + 그 산출 직전 가드 배선이 부재**다 — `previewRosterPlan`(plan측)의 outcome-side mirror 가 비어 있다.

본 task 는 그 비대칭을 채운다 — `SummaryBatchOrchestratorService.previewOutcomeLine(result)` 신규 진입점을 추가해, `result.summaryLine`(pipeline 이 `formatSummaryBatchOutcome` 으로 산출한 outcome 한 줄 요약)을 산출 직후·반환 전에 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언으로 형태 검증한 뒤 standalone 으로 외화한다. `previewRosterPlan`(T-0629/T-0636)과 동형의 외화-+-가드-배선 slice — 이번엔 결과측 outcome 라인 대상. 본 task 닫히면 p5-summary-aggregate stream 의 표현 양 반쪽이 모두 service 경계 standalone 진입점(계획 라인 `previewRosterPlan` · outcome 라인 `previewOutcomeLine`) + 산출 직전 형태 가드까지 대칭으로 완결된다.

## Required Reading

- [src/assessment-evaluation/summary-batch-orchestrator.service.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.ts) — `previewRosterPlan(roster)`(L312~320 부근, `formatSummaryBatchRosterPlan` 산출 직후 `assertSummaryBatchRosterPlanShape(plan)` 단언 후 반환) 가 본 task 가 mirror 할 정확한 패턴. `reportBatch(roster, result)`(L382~393 부근) 가 `result.summaryLine` 을 읽는 방식(`result` null/undefined 직접 가드 → `result.summaryLine` 역참조)도 참조. 기존 import 블록(L92~97 부근, `assertSummaryBatchReportShape`/`assertSummaryBatchRosterInputConsistent`/`assertSummaryBatchRosterPlanShape` import 존재) 에 `assertSummaryBatchOutcomeFormatShape` import 1줄 추가. 클래스 머리말 주석의 진입점 서술(현재 5 진입점)에 `previewOutcomeLine` 6번째 진입점 한 줄 보강.
- [src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts](../../src/assessment-evaluation/domain/summary-batch-outcome-format-shape.ts) — T-0638 `assertSummaryBatchOutcomeFormatShape(line: string): void` 의 throw 계약(구조·타입 결손=한국어 TypeError / 값·형태 위반=한국어 RangeError 구분) — 본 진입점이 호출할 가드 (본문 변경 0, import 만).
- [src/assessment-evaluation/domain/summary-batch-pipeline.ts](../../src/assessment-evaluation/domain/summary-batch-pipeline.ts) — `SummaryBatchPipelineResult` 타입(L95~107 부근, `{ plan, outcomes, report, summaryLine }`) — `previewOutcomeLine` 입력 `result` 의 타입(`summaryLine: string` 필드 위치) 확인 (본문 변경 0, import type 만 — 기존 service 가 이미 import 하는지 확인 후 재사용).
- [src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts) — 기존 `previewRosterPlan` describe 블록(T-0629/T-0636 박제) — 본 task 가 `previewOutcomeLine` describe 를 append 할 colocated spec. 그 가드-배선 spec 구조(가드 호출 1회 검증·정상 통과 위임·throw 전파·호출 순서 assert: read summaryLine → assert → return) mirror.

## Acceptance Criteria

- [ ] `summary-batch-orchestrator.service.ts` 에 신규 진입점 `previewOutcomeLine(result: SummaryBatchPipelineResult): string` 추가 — `result` null/undefined 직접 가드(한국어 TypeError) 후 `result.summaryLine` 을 읽어 `assertSummaryBatchOutcomeFormatShape(result.summaryLine)` 단언을 호출하고, 정상 형태면 그 outcome 라인 문자열을 그대로 반환. import 1줄(`assertSummaryBatchOutcomeFormatShape`) + 메서드 + JSDoc(`@throws` 가드의 TypeError/RangeError + `result`/`result.summaryLine` 누락 TypeError) 추가. 위반 형태면 가드 throw 가 그대로 전파(로그·notification surface 도달 전 차단).
- [ ] `previewOutcomeLine` 은 `result.summaryLine`(이미 렌더된 string)만 읽는다 — `result.plan`/`outcomes`/`report` 미접촉, `formatSummaryBatchOutcome` 재호출 0(pipeline 산출 재사용, 재렌더 0). `previewRosterPlan`(plan측)과 대칭의 standalone 외화.
- [ ] `assertSummaryBatchOutcomeFormatShape`/`formatSummaryBatchOutcome`/`formatSummaryBatchReport`/pipeline/composer/enumerate **본문 변경 0** — 본 task 는 service 의 import + 신규 메서드 + JSDoc/주석 갱신만. service 생성자·DI·기존 5 진입점(`evaluateBatch`/`evaluateBatchForRoster`/`previewRosterPlan`/`reportBatch`/`evaluateAndReportForRoster`) 무변경.
- [ ] `formatSummaryBatchReport`/`reportBatch` 의 outcome 라인(2번째 라인) 가드는 T-0639(도메인 formatter)가 이미 배선했으므로 본 task 가 그 경로에 추가 배선하지 않는다(이중 단언 금지). 본 task 는 신규 `previewOutcomeLine` standalone 산출 직전 1 지점만 — `previewRosterPlan`(T-0636)과 별개 산출 지점이므로 이중 단언 아님.
- [ ] 순수성·안전 보존: 직접 부수효과 0·새 dependency 0·migration 0·schema 변경 0·raw 미저장(R-59 — 형태 검증만, 평가 본문 미접촉, summaryId 등 본문 미보유)·입력 비변형(`result`·`result.summaryLine` 문자열 변형 0).
- [ ] **Happy-path test 1+**: `previewOutcomeLine(result)` 가 정상 형태 `summaryLine` 을 가진 `result` 를 받으면 가드 단언이 통과하고 `result.summaryLine` 과 byte-identical 한 문자열을 반환(가드가 정상 outcome 라인을 변형·차단하지 않음). 1+.
- [ ] **Error path test 1+**: 가드가 throw 하는 경로 1+ — 손상 outcome 라인(예: `result.summaryLine` 에 개행 혼입·prefix drift·버킷 슬롯 누락 문자열을 주입, 또는 가드 모듈을 jest mock 으로 RangeError throw 하도록 강제)에서 `previewOutcomeLine` 이 그 throw 를 그대로 전파하고 손상 라인을 반환하지 않음을 assert. 추가로 `result` null/undefined → 직접 가드의 한국어 TypeError 전파, `result.summaryLine` 누락(비-string) → 가드(또는 직접 가드)의 TypeError 전파 각 1+.
- [ ] **Flow/branch test**: 가드 통과(정상 형태 → 라인 반환) 분기 1 + 가드 throw(손상 형태 → 전파·반환 미도달) 분기 1 + `result` null/undefined 직접 가드 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 가드 throw 시 `previewOutcomeLine` 이 return 값을 만들지 않음(전파만, 손상 라인 미반환) ② 가드 호출 순서 — `result.summaryLine` 읽은 **후** 가드 호출(spy 호출 순서 assert: read → assert → return) ③ 같은 `result` 2회 호출 독립·결정성(byte-identical 반환·입력 비변형) ④ `result` null/undefined 직접 가드 TypeError 전파(가드 단계 미도달) ⑤ `result.summaryLine` 비-string(undefined/number 등) → TypeError 전파 ⑥ 정상 형태 outcome 라인 입력 비변형(가드가 라인 문자열 변형 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 service 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `assertSummaryBatchOutcomeFormatShape`/`formatSummaryBatchOutcome`/`formatSummaryBatchReport` 가드·formatter **본문** 변경(가드 로직·불변식·formatter 출력 무변경) — 본 task 는 service 의 import + 신규 메서드 + JSDoc/주석 갱신만.
- `formatSummaryBatchReport`/`reportBatch` 합본 리포트 2번째 라인에 본 가드 추가 배선 — T-0639 가 도메인 formatter 측에 이미 배선했으므로 이중 배선 금지. 본 task 는 신규 `previewOutcomeLine` standalone 산출 직전 1 지점만.
- 가드를 로그·journal·notification·관측 layer 의 다른 지점에 추가 배선 — 본 task 는 `previewOutcomeLine` 산출 직전 1 지점만.
- `result.summaryLine` 외 다른 필드(plan/outcomes/report) 노출·가공·재렌더 — 본 진입점은 outcome 라인 standalone 외화만.
- 자동 복구·정규화·drop·재렌더 — 손상 outcome 라인은 fail-fast throw 전파만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 p5-summary-aggregate stream 의 표현 양 반쪽이 service 경계 standalone 진입점(계획 라인 `previewRosterPlan` · outcome 라인 `previewOutcomeLine`) + 산출 직전 형태 가드까지 대칭 완결된다. 남는 자연 follow-up: 둘 다 §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 인접 PLAN bullet(R-9 사용자 지정 기간 임의 평가문 / R-21 중복 제거 등)으로 stream 전환 판단.)
