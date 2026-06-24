---
id: T-0631
title: R-61 요약 batch "계획 vs 결과" 합본 요약을 service 경계로 외화 (reportBatch)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 97행 R-61 p5-summary-aggregate — T-0630 formatSummaryBatchReport(미소비)을 service 경계로 외화. T-0623·T-0629 외화 패턴 동형. 새 dep 0, §5 BLOCKED 회피."
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
---

# T-0631 — R-61 요약 batch "계획 vs 결과" 합본 요약을 service 경계로 외화 (reportBatch)

## Why

PLAN.md P5 bullet 97 (REQ-061 "일·주·월 요약 평가") 의 p5-summary-aggregate stream
후속 wiring slice 다. T-0630(PR #544, squash 5a601e5) 이 닫은 순수 합본 formatter
`formatSummaryBatchReport(roster, result) → string`(pre-flight 범위 라인 + batch 결과
`summaryLine` 을 "계획:" / "결과:" 라벨로 묶은 정확히 2 라인 블록)는 정의·검증만 됐고
어떤 caller 도 소비하지 않는다(grep `src/**/*.ts` 매치 = 자기 + spec 2 파일뿐). 이는
T-0628 formatter(→T-0629 가 `previewRosterPlan` 으로 외화)·T-0619 outcome formatter
(→T-0623 가 service 경계로 외화)가 직전 처해 있던 것과 동일한 **exists-but-unwired**
공백이다.

`SummaryBatchOrchestratorService` 는 이미 진입점 셋(`evaluateBatch` 좌표 실행 /
`evaluateBatchForRoster` roster 실행 / `previewRosterPlan` roster 사전조회 요약)을
노출한다. 그러나 batch 를 실행한 **후** "무엇을 평가하려 했는가(계획) vs 무엇을
평가했는가(결과)" 를 한 블록으로 합쳐 받는 service-경계 메서드는 빈칸이다 — caller(로그·
journal·향후 notification surface)가 지금은 `previewRosterPlan(roster)` 와 batch 결과의
`summaryLine` 을 각각 따로 받아 손수 이어 붙이거나, 순수 formatter `formatSummaryBatchReport`
를 domain 모듈에서 직접 import 해야 한다. 본 task 는 T-0623·T-0629 의 외화 패턴과
동형으로, `SummaryBatchOrchestratorService` 에 합본 요약을 산출하는 작은 순수-위임
메서드 `reportBatch(roster, result): string` 을 추가해 그 공백을 닫는다 — caller 가
service 모듈 하나만 import 해 "계획 vs 결과" 합본 한 블록을 받을 수 있게 한다.

## Required Reading

- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` — 본 task 가 메서드를
  추가할 service. 기존 `evaluateBatch` / `evaluateBatchForRoster` / `previewRosterPlan`
  (L266~268) 진입점과 클래스 머리말 주석 패턴(L28~33 진입점 enumeration), `previewRosterPlan`
  의 순수-위임 JSDoc(L240~265) 구조를 mirror 대상으로 확인. `SummaryBatchPipelineResult`
  타입이 이미 service 에 import 돼 있는지 확인(re-export 경로) — 없으면 import 1줄 추가.
- `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts` — colocated spec.
  기존 `previewRosterPlan` describe 블록의 roster fixture·mock 주입(`{ evaluateAndPersist:
  jest.fn() }`)·byte-identical 비교 패턴을 mirror.
- `src/assessment-evaluation/domain/summary-batch-report-format.ts` — 위임 대상 순수
  formatter `formatSummaryBatchReport(roster: SummaryBatchRosterInput, result:
  SummaryBatchPipelineResult): string`(L97~100) 의 signature·throw 계약(roster null/undefined
  위임 전파, result null/undefined·summaryLine 비-string 직접 가드 한국어 TypeError, 정확히
  2 라인 블록 반환) 확인. **변경 금지**(import·호출만).
- `src/assessment-evaluation/domain/summary-batch-pipeline.ts` — `SummaryBatchPipelineResult`
  타입(`{ plan, outcomes, report, summaryLine }`) 정의 확인. **import type 만**.
- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — `SummaryBatchRosterInput`
  타입(이미 service 에 import 됨) 확인. **import type 만**.

## Acceptance Criteria

- [ ] `SummaryBatchOrchestratorService` 에 public 메서드 `reportBatch(roster:
  SummaryBatchRosterInput, result: SummaryBatchPipelineResult): string` 추가 — 본문은
  `return formatSummaryBatchReport(roster, result);` 위임 1줄(재구현 0, 가공 0). formatter
  import 1줄 추가(+ 필요 시 `SummaryBatchPipelineResult` import type 1줄). 기존
  `evaluateBatch` / `evaluateBatchForRoster` / `previewRosterPlan` / 생성자 / DI 무변경.
- [ ] 메서드는 동기(`string` 반환, async 아님) — formatter 가 순수 동기 함수이므로 평가·
  영속화·DB write·LLM 호출 0. 클래스 머리말 주석에 새 메서드(합본 요약 외화, T-0630
  formatter service-경계 노출)를 1~3줄로 박제하고, 진입점이 넷(`evaluateBatch` 좌표 /
  `evaluateBatchForRoster` roster 실행 / `previewRosterPlan` roster 사전조회 / `reportBatch`
  계획-결과 합본 요약)임을 정정. `reportBatch` 는 평가 경로를 호출하지 않음을 JSDoc 에 명시.
- [ ] **Happy-path test 1+**: `reportBatch(roster, result)` 가 `formatSummaryBatchReport(
  roster, result)` 와 byte-identical 문자열을 반환함을 검증(직접 비교 또는 알려진 fixture
  의 기대 2 라인 블록 매칭). 반환이 정확히 2 라인(개행 1개)·계획 라벨 라인 + 결과 라벨 라인
  포함 확인 1+.
- [ ] **Error path test 1+**: (a) `roster` null/undefined → formatter 위임의 한국어
  `TypeError` 전파 1+. (b) `result` null/undefined → formatter 직접 가드의 한국어 `TypeError`
  전파 1+. (c) `result.summaryLine` 누락/비-string → 한국어 `TypeError` 전파 1+.
- [ ] **Flow / branch 분기 cover** — 분기마다 1+: (a) 비어있지 않은 roster + 정상 summaryLine
  → 2 라인 정상 블록, (b) 빈 roster(빈 `personIds`) + 정상 summaryLine → 계획 라인 `총
  0좌표` + 결과 라인 → 여전히 정확히 2 라인(throw 0). (분기 없는 단순 위임이므로 입력
  variation 으로 cover.)
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리(각 1+):
  (1) `roster` null·undefined → 한국어 `TypeError` 2종 test,
  (2) `result` null·undefined → 한국어 `TypeError` 2종 test,
  (3) `result.summaryLine` 누락/비-string → 한국어 `TypeError` test,
  (4) 빈 roster(personIds 빈 배열) + 정상 summaryLine → `총 0좌표` 계획 라인 + 결과 라인,
    정확히 2 라인 test,
  (5) 동일 (roster, result) 2회 호출 → 두 출력 byte-identical(결정성·잔여 상태 누수 0) test,
  (6) 호출 후 입력 비변형(`roster`·`roster.personIds`·`result`·`result.summaryLine` deep
    동일성) test.
- [ ] **평가 경로 무호출 검증** — `reportBatch` 가 평가 경로를 호출하지 않음을 검증: 주입된
  orchestrator mock `evaluateAndPersist` 가 호출 0 임을 spy 로 단언(합본 요약은 실행 0,
  formatter 위임뿐) 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 변경 service 파일 신규 메서드
  line/branch/function 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `domain/summary-batch-report-format.ts` / `summary-batch-roster-plan-format.ts` /
  `summary-batch-outcome-format.ts` / `summary-batch-pipeline.ts` /
  `summary-batch-roster-input.ts` 변경 금지 — import(type · 함수)·위임만. formatter 본문·
  pipeline 계약 무변경.
- `evaluateBatch` / `evaluateBatchForRoster` / `previewRosterPlan` 메서드 본문·signature·
  DI·생성자 변경 금지(import 1~2줄 + 메서드 1개 + 클래스 주석 외 무변경).
- **합본 요약을 `evaluateBatchForRoster` 흐름 안에 자동 emit 하도록 결합 금지** — 별개의
  독립 사후조회 메서드로만 제공(실행 경로 무회귀). batch 결과 `result` 는 caller 가 이미
  보유한 산출을 인자로 받는다(service 가 재실행하지 않음).
- 로그·journal·notification surface 에 실제 출력(side-effect) 배선 금지 — 본 task 는 service
  경계 노출(반환)까지. 실 호출처 결선은 별도 follow-up.
- manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 0 — Q-0030 RBAC
  ADR-gated(§5 BLOCKED).
- 좌표 → `EvaluationResult[]` collection bridge 0 — cross-module/RBAC ADR (§5 BLOCKED).
- DB write / Prisma migration 0 · 새 외부 dependency 0 · live LLM 호출 0 · raw 미저장
  (R-59 — pre-flight 좌표 축·결과 카운트만, 평가 본문 미접촉).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)

후보 후속 slice(참고 — 본 task 범위 밖):
- 합본 요약(`reportBatch` / `previewRosterPlan` / pipeline `summaryLine`)을 실 호출처
  (로그·journal·향후 notification surface)에 emit(side-effect) 배선 — 실 결선 slice.
- manual-trigger 요약 batch 평가 HTTP endpoint(Q-0030 RBAC ADR-first) — **§5 BLOCKED**.
- 좌표 → `EvaluationResult[]` collection bridge(cross-module/RBAC ADR) — **§5 BLOCKED**.
- PLAN 98행 R-9 사용자 지정 기간 임의 평가문 생성(P5 잔여).

## Result (DONE 2026-06-24)

- PR #545 squash merge `2243cc4` (reviewer round 1/7 APPROVE, CI green).
- `SummaryBatchOrchestratorService.reportBatch(roster, result): string` 추가 — 순수 formatter
  `formatSummaryBatchReport` 위임 1줄, 도메인 formatter 무변경, 새 dep 0.
- spec reportBatch describe 5블록 19케이스(happy/error/branch/negative). 변경 파일 coverage 100%, 전체 7221 tests green.
