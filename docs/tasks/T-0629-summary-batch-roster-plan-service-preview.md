---
id: T-0629
title: R-61 요약 batch roster pre-flight 요약을 service 경계로 외화 (previewRosterPlan)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-24
independentStream: p5-summary-aggregate
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/summary-batch-orchestrator.service.ts
  - src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts
plannerNote: P5 R-61(PLAN 97행) p5-summary-aggregate — T-0628 formatSummaryBatchRosterPlan(미소비)을 service 경계로 외화, T-0623 outcome-formatter 외화 패턴 동형
---

# T-0629 — R-61 요약 batch roster pre-flight 요약을 service 경계로 외화 (previewRosterPlan)

## Why

PLAN.md P5 bullet 97 (R-61 "일·주·월 요약 평가") 의 p5-summary-aggregate stream 후속 wiring slice 다. T-0628(PR #542, squash) 이 닫은 순수 formatter `formatSummaryBatchRosterPlan(roster) → string`(roster 입력 pre-flight 평가 범위를 결정적 한국어 단일 라인으로 렌더)는 정의·검증만 됐고 어떤 caller 도 소비하지 않는다(grep `src/**/*.ts` 매치 = 자기 + spec 2 파일뿐). 이는 T-0619 outcome formatter / T-0620 outcome 가드가 직전 처해 있던 것과 동일한 exists-but-unwired 공백이다.

outcome(결과) 측은 T-0622 가 `summaryLine` 을 pipeline 산출에 부착하고 T-0623 이 `SummaryBatchOrchestratorService` 경계로 그 산출의 service-경계 통과를 박제했다. 그러나 input(입력) 측 pre-flight 요약(어느 roster·granularity·좌표 수)은 service 경계 어디에도 노출돼 있지 않다. 본 task 는 T-0623 의 outcome-formatter 외화 패턴과 동형으로, `SummaryBatchOrchestratorService` 에 roster pre-flight 요약을 산출하는 작은 순수-위임 메서드 `previewRosterPlan(roster): string` 을 추가해 그 공백을 닫는다 — caller(로그·journal·향후 notification surface)가 batch 를 실제 실행하기 **전에** "무엇이 돌아갈 것인가" 를 service 모듈 하나만 import 해 받을 수 있게 한다.

## Required Reading

- `src/assessment-evaluation/summary-batch-orchestrator.service.ts` — 본 task 가 메서드를 추가할 service. 기존 `evaluateBatch` / `evaluateBatchForRoster` 진입점과 클래스 머리말 주석 패턴 확인.
- `src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts` — colocated spec. 기존 `evaluateBatchForRoster` describe 블록의 mock 주입(`{ evaluateAndPersist: jest.fn() }`)·roster 입력 fixture 패턴을 mirror 한다.
- `src/assessment-evaluation/domain/summary-batch-roster-plan-format.ts` — 위임 대상 순수 formatter `formatSummaryBatchRosterPlan(roster)` 의 signature·throw 계약(null/undefined roster fail-fast, enumerate 위임 전파) 확인.
- `src/assessment-evaluation/domain/summary-batch-roster-input.ts` — `SummaryBatchRosterInput` 타입(이미 service 에 import 됨) 확인.

## Acceptance Criteria

- [ ] `SummaryBatchOrchestratorService` 에 public 메서드 `previewRosterPlan(roster: SummaryBatchRosterInput): string` 추가 — 본문은 `return formatSummaryBatchRosterPlan(roster);` 위임 1줄(재구현 0, 가공 0). formatter import 1줄 추가. 기존 `evaluateBatch` / `evaluateBatchForRoster` / 생성자 / DI 무변경.
- [ ] 메서드는 동기(`string` 반환, async 아님) — formatter 가 순수 동기 함수이므로 평가·영속화·DB write·LLM 호출 0. 클래스 머리말 주석에 새 메서드(pre-flight 요약 외화, T-0628 formatter service-경계 노출)를 1~3줄로 박제하고, 진입점이 셋(`evaluateBatch` 좌표 / `evaluateBatchForRoster` roster 실행 / `previewRosterPlan` roster 사전조회)임을 정정.
- [ ] happy-path test: `previewRosterPlan(roster)` 가 `formatSummaryBatchRosterPlan(roster)` 와 byte-identical 문자열을 반환함을 검증(직접 비교 또는 알려진 fixture 의 기대 문자열 매칭) 1+.
- [ ] error path test: roster null/undefined 전달 시 formatter 의 한국어 `TypeError` 가 그대로 전파됨 1+, 그리고 잘못된 granularity / Invalid Date `now` 로 인한 enumerate 위임 throw 전파 1+.
- [ ] branch / flow test: 빈 roster(빈 `personIds` 또는 빈 `granularities`) → 좌표 0 의 pre-flight 요약 문자열 정상 반환(throw 0) 1+, person 다건 roster → 좌표 다건 반영 1+.
- [ ] negative cases 충분 cover: (a) roster null·(b) roster undefined·(c) `personIds` null·(d) 알 수 없는 granularity·(e) Invalid Date `now`·(f) 2회 호출 결정성(동일 roster → byte-identical)·(g) 입력 비변형(호출 후 roster 객체·배열·map 미변형) 각 1+ test. 단일 negative 만 작성 금지.
- [ ] `previewRosterPlan` 는 평가 경로를 호출하지 않음을 검증 — 주입된 orchestrator mock `evaluateAndPersist` 가 호출 0 임을 spy 로 단언(pre-flight 요약은 실행 0) 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 변경 service 파일 신규 메서드 line/branch/function 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `domain/summary-batch-roster-plan-format.ts` / `summary-batch-roster-input.ts` / `summary-due-coordinates.ts` / `summary-batch-outcome.ts` 변경 금지 — import·위임만, 값/순서/로직 무변경.
- `evaluateBatch` / `evaluateBatchForRoster` 메서드 본문·signature·DI·생성자 변경 금지(import 1줄 + 메서드 1개 + 클래스 주석 외 무변경).
- manual-trigger HTTP endpoint / controller / DTO / RBAC 추가 금지 — Q-0030 RBAC ADR-gated (§5 BLOCKED).
- 좌표 → `EvaluationResult[]` collection bridge 금지 — cross-module RBAC ADR (§5 BLOCKED).
- 로그·journal·notification surface 에 실제 출력(side-effect) 배선 금지 — 본 task 는 service 경계 노출(반환)까지. 실 호출처 결선은 별도 follow-up.
- pre-flight 요약을 `evaluateBatchForRoster` 흐름 안에 자동 emit 하도록 결합 금지 — 별개의 독립 사전조회 메서드로만 제공(실행 경로 무회귀).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
