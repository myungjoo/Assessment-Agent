---
id: T-0636
title: R-61 요약 batch roster pre-flight 계획 라인 shape 가드를 service previewRosterPlan 산출 직전에 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 R-61(PLAN 97행) — T-0635 assertSummaryBatchRosterPlanShape(PR #549 bd9a69c)가 exists-but-unwired. previewRosterPlan 이 formatSummaryBatchRosterPlan 산출 직후·반환 전 가드 단언 배선. T-0634 report-shape wiring 패턴 동형. p5-summary-aggregate, dependsOn []"
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0636 — R-61 요약 batch roster pre-flight 계획 라인 shape 가드를 service previewRosterPlan 산출 직전에 배선

## Why

[PLAN.md](../PLAN.md) P5 97행 R-61 "일/주/월 요약 평가". T-0635(`assertSummaryBatchRosterPlanShape`, PR #549 squash bd9a69c)이 roster pre-flight 계획 라인의 6 형태 불변식(① string · ② 개행 0(단일 라인) · ③ prefix `요약 평가 batch 예정: ` · ④ `person N명` 토큰 · ⑤ `· 총 N좌표 [` 토큰 · ⑥ `[day N · week N · month N · other N]` 4 버킷 슬롯 고정 순서)을 런타임 fail-fast 가드로 **정의·검증만** 했고, `src/` 의 어떤 caller 도 호출하지 않는 **exists-but-unwired** 상태다(grep 매치 = 자기 + 자기 spec 2 파일, format 모듈·service 모두 미참조 확인).

`SummaryBatchOrchestratorService.previewRosterPlan(roster)`(T-0629, PR #543)는 `formatSummaryBatchRosterPlan(roster)` 로 pre-flight 계획 라인 문자열을 산출해 caller(로그·journal·향후 notification surface)로 그대로 흘려보낸다(현재 본문 = 위임 1줄 `return formatSummaryBatchRosterPlan(roster);`). 그러나 그 산출 직후 단일 라인 형태 불변식을 단언하는 지점이 없어, 합성 단계의 미래 회귀(개행 혼입·prefix drift·person/총 좌표 토큰 누락·버킷 슬롯 누락·빈 라인 위장)가 발생하면 손상된 계획 라인이 표현 surface 로 **silent leak** 한다.

본 task 는 그 빈칸을 채운다 — `previewRosterPlan` 이 `formatSummaryBatchRosterPlan(roster)` 산출 직후·반환 전에 `assertSummaryBatchRosterPlanShape(plan)` 단언을 배선해, 손상 계획 라인이 surface 로 새기 전 fail-fast 차단한다. T-0621 `assertSummaryBatchOutcomeConsistent` 배선·T-0627 `assertSummaryBatchRosterInputConsistent` 배선·T-0634 `assertSummaryBatchReportShape` 배선과 동형의 wiring slice — 이번엔 roster 계획 라인 형태 가드 대상(T-0634 합본 report-shape 배선의 입력측 mirror). 본 task 닫히면 p5-summary-aggregate stream 의 표현 양 반쪽(plan 라인 · outcome 라인 · 합본 블록) 가드가 모두 정의·검증 + 산출 지점 배선까지 완결된다.

## Required Reading

- [src/assessment-evaluation/summary-batch-orchestrator.service.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.ts) — `previewRosterPlan(roster)`(L286~288 부근) 가 `formatSummaryBatchRosterPlan(roster)` 산출을 반환하는 지점(가드 단언 배선 대상). 기존 import 블록(L89~92 부근, `formatSummaryBatchRosterPlan` import 존재) 에 가드 import 1줄 추가. 클래스 머리말 주석의 진입점 서술(previewRosterPlan = roster 사전조회 진입점)은 가드 배선 노트만 한 줄 보강(동작 무변경).
- [src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts](../../src/assessment-evaluation/domain/summary-batch-roster-plan-shape.ts) — T-0635 `assertSummaryBatchRosterPlanShape(plan: string): void` 의 throw 계약(구조 결손=한국어 TypeError / 형태 위반=한국어 RangeError 구분) — 본 배선이 호출할 가드 (본문 변경 0, import 만).
- [src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts) — 기존 `previewRosterPlan` describe 블록(T-0629 박제) — 본 task 가 가드 호출 배선 케이스를 append 할 colocated spec. T-0634 의 report-shape 가드-배선 spec 구조(가드 호출 1회 검증·정상 통과 위임·throw 전파·호출 순서 assert: format → assert → return) mirror.

## Acceptance Criteria

- [ ] `summary-batch-orchestrator.service.ts` 의 `previewRosterPlan(roster)` 가 `formatSummaryBatchRosterPlan(roster)` 로 계획 라인 문자열을 산출한 직후·반환 전에 `assertSummaryBatchRosterPlanShape(plan)` 단언을 호출하도록 배선 — import 1줄 + 호출 1줄 + JSDoc `@throws`(가드의 TypeError/RangeError) 갱신. 정상 형태면 가드가 void 반환 후 그 계획 라인을 그대로 반환(동작 무회귀), 위반 형태면 가드 throw 가 그대로 전파(로그·notification surface 도달 전 차단).
- [ ] `formatSummaryBatchReport`/`reportBatch`/`evaluateAndReportForRoster` 는 본 가드 배선 대상이 **아니다** — 합본 리포트 1번째 라인은 `formatSummaryBatchRosterPlan` 위임으로 산출되나, 본 task 는 service `previewRosterPlan` 산출 직전 1 지점만 배선(이중 단언·다중 배선 금지). `reportBatch` 경로의 합본 1번째 라인 가드 배선은 별도 follow-up(Out of Scope).
- [ ] `formatSummaryBatchRosterPlan`/`assertSummaryBatchRosterPlanShape`/`formatSummaryBatchReport`/pipeline/composer/enumerate **본문 변경 0** — 본 task 는 service 의 import + 단언 호출 + JSDoc/주석 갱신만. service 생성자·DI·기존 진입점(`evaluateBatch`/`evaluateBatchForRoster`/`reportBatch`/`evaluateAndReportForRoster`) 무변경.
- [ ] 순수성·안전 보존: 직접 부수효과 0·새 dependency 0·migration 0·schema 변경 0·raw 미저장(R-59 — 형태 검증만, 평가 본문 미접촉)·입력 비변형(`roster`·`plan` 문자열 변형 0).
- [ ] **Happy-path test 1+**: `previewRosterPlan(roster)` 가 정상 단일 라인을 산출하면 가드 단언이 통과하고 `formatSummaryBatchRosterPlan` 산출과 byte-identical 한 문자열을 반환(가드가 정상 plan 라인을 변형·차단하지 않음). roster 빈/non-empty 둘 다 통과 1+.
- [ ] **Error path test 1+**: 가드가 throw 하는 경로 1+ — 손상 plan 라인(예: 가드 모듈을 jest mock 으로 RangeError throw 하도록 강제, 또는 `formatSummaryBatchRosterPlan` 을 mock 해 잘못된 형태 반환)에서 `previewRosterPlan` 이 그 throw 를 그대로 전파하고 손상 라인을 반환하지 않음을 assert. 추가로 `roster` null/undefined → formatter 위임 가드의 한국어 TypeError 전파(기존 동작 보존) 1+.
- [ ] **Flow/branch test**: 가드 통과(정상 형태 → 라인 반환) 분기 1 + 가드 throw(손상 형태 → 전파·반환 미도달) 분기 1 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① 가드 throw 시 `previewRosterPlan` 이 return 값을 만들지 않음(전파만, 손상 라인 미반환) ② 가드 호출 순서 — `formatSummaryBatchRosterPlan` 산출 **후** 가드 호출(spy 호출 순서 assert: format → assert → return) ③ 같은 roster 2회 호출 독립·결정성(byte-identical 반환·입력 비변형) ④ `roster` null/undefined formatter 위임 TypeError 전파(가드 단계 미도달, 기존 동작 보존) ⑤ 정상 형태 plan 라인 입력 비변형(가드가 라인 문자열 변형 0). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 service 파일 line/branch/function 100% 유지.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) — §5 BLOCKED 회피.
- 좌표 → EvaluationResult[] collection bridge(cross-module/RBAC ADR) — §5 BLOCKED 회피.
- `assertSummaryBatchRosterPlanShape`/`formatSummaryBatchRosterPlan`/`previewRosterPlan` 가드·formatter **본문** 변경(가드 로직·불변식·formatter 출력 무변경) — 본 task 는 service 의 import + 호출 1줄 + JSDoc/주석 갱신만.
- `formatSummaryBatchReport`/`reportBatch`/`evaluateAndReportForRoster` 합본 리포트 1번째 라인에 본 가드 추가 배선 — 별도 follow-up(이중 단언·다중 배선 회피). 본 task 는 service `previewRosterPlan` 산출 직전 1 지점만.
- 가드를 로그·journal·notification·관측 layer 의 다른 지점에 추가 배선 — 본 task 는 `previewRosterPlan` 산출 직전 1 지점만.
- 자동 복구·정규화·drop·재렌더 — 손상 plan 라인은 fail-fast throw 전파만(silent 수선 금지).
- 새 dependency·migration·schema 변경·raw 저장(R-59) — 전부 금지.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 p5-summary-aggregate stream 의 표현 3 가드(plan 라인 · outcome 라인 · 합본 블록)가 모두 정의·검증 + 산출 지점 배선까지 완결된다. 남는 자연 follow-up: (a) `formatSummaryBatchReport` 합본 1번째 라인에 plan-shape 가드 배선(다중 배선 회피 차원에서 본 task 가 제외한 잔여) — 단 `assertSummaryBatchReportShape`(T-0633/T-0634)가 2-라인 블록 외형을 이미 보호하므로 ROI 재평가 필요 / (b) 둘 다 §5 BLOCKED 인 manual-trigger HTTP endpoint(Q-0030 RBAC ADR-gated) · 좌표→EvaluationResult[] collection bridge(cross-module RBAC ADR) — planner 가 다음 turn 에 ADR 진입 또는 인접 PLAN bullet(R-9 사용자 지정 기간 임의 평가문 등)으로 stream 전환 판단.)
