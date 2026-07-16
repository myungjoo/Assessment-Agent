---
id: T-1045
title: daily command-plan 컴포저 본문 위임 순서(descriptor → commandArgs)를 invocationCallOrder 순서-lock test 로 못박기 (plan 컴포저 sweep daily canonical leg)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 66
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts
independentStream: realdata-e2e-daily-step-command-plan
plannerNote: "P5 test-hardening — from-output 컴포저 delegate 순서-lock sweep(T-1044 두 leg 완료) 후 신규 인벤토리 감사에서 plan 컴포저 축 delegate 순서-lock gap 발견. daily command-plan 컴포저는 본문에서 descriptor→commandArgs 두 위임을 순차 호출(commandArgs 는 descriptor 산출물 의존)하고 self-assert 가드를 self-wire 하나, spec 은 두 delegate 를 이미 spyOn 하면서도 상대 호출 순서를 invocationCallOrder 로 못박지 않음(grep 0). daily canonical leg 먼저, 요약축(result-issue-command-plan) mirror 는 후속. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1045 — daily command-plan 컴포저 본문 위임 순서(descriptor → commandArgs) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(command-args·descriptor·outcome-report·output-parse·search-parse·search-argv)과 result-summary 패밀리 2 축(result-summary-line·result-report-plan), 그리고 from-output 컴포저 delegate 순서-lock(daily·summary 두 leg, T-1044)이 완료됐다.

본 task 는 그 sweep 을 T-1044 Follow-up 이 지목한 **신규 인벤토리 감사 결과 — "plan 컴포저" 축**으로 확장한다. `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` 컴포저는 본문에서 두 위임을 순서대로 호출한다 — (1) `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(descriptor 위임) → (2) `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`(commandArgs 위임, 산출 descriptor 를 입력으로 받으므로 순서 의존) → self-wire 가드 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(plan, report)`.

**현행 spec 은 이미 두 위임을 `jest.spyOn`(descriptorSpy·commandArgsSpy) 으로 감싸는 self-wire 블록을 보유**하나(호출 횟수·인자 전파만 assert), 두 위임의 **상대 호출 순서(descriptor 먼저)는 못박지 않는다**(`git grep invocationCallOrder ...command-plan.spec.ts` = 0건). 따라서 컴포저 본문에서 실수로 commandArgs 위임을 descriptor 위임 앞으로 옮기는 재정렬 회귀가 발생해도(현행은 산출 descriptor 를 commandArgs 가 참조하므로 실제로는 깨지지만, 순서 자체를 못박은 명시 test 는 부재) 순서 부등식 test 가 없다. from-output 축(T-1044) canonical 패턴을 plan 축의 daily leg 로 확립한다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts` — 본 task 가 수정할 유일 파일(561줄). 이미 namespace import 보유: `descriptorModule`(L28)·`commandArgsModule`(L25)·`consistencyModule`(L27). 기존 self-wire describe 블록(L135~180): 가드를 `mockImplementation(()=>{})` 로 no-op 처리한 뒤 `descriptorSpy`(각 1회, `REPORT` 인자)·`commandArgsSpy`(각 1회, `plan.descriptor` 인자) 호출을 assert 하는 test + "가드 재유도 포함 각 2회" test. 기존 error-path 블록(L184~): `report.gitSha` 빈/공백 시 descriptor 단계 throw → `commandArgsSpy` 미호출(fail-fast) test. 신규 delegate 순서-lock/fail-fast/guard-우선 test 는 기존 self-wire describe 블록 끝(또는 별도 신규 describe)에 append. fixture `REPORT`(L48)·`makeReport`(L48 부근) 재사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` — 컴포저 위임 지점 확인용(수정 금지). `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 함수 L148~: (1) `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → descriptor(report.gitSha/dateToken 빈/공백 시 여기서 throw, command-args 미도달) → (2) `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → commandArgs(descriptor.title/marker 빈/공백 시 여기서 throw) → self-assert 가드 호출 → `return plan`.
- ⚠️ 정상 경로에서 self-wire 가드가 **재유도로 두 위임을 다시 호출**하므로 각 위임은 정확히 **2회** 호출된다(컴포저 본문 1회 + 가드 재유도 1회 — 기존 "각 2회" test 가 이를 증거). 순서-lock 은 첫 호출(`invocationCallOrder[0]`)로 판정.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts`(T-1044 선례) — mirror 패턴 참조. 두 delegate 를 실 구현 pass-through `jest.spyOn` 으로 감싸고 `parseSpy.mock.invocationCallOrder[0]` 이 `buildSpy.mock.invocationCallOrder[0]` 보다 작음을 `toBeLessThan` 으로 검증한 구조를 descriptor→commandArgs 로 동형 적용.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: 컴포저 본문 위임 순서를 못박는 test 1개 추가 — descriptor 위임(`descriptorModule`)과 commandArgs 위임(`commandArgsModule`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan(REPORT)` 을 1회 호출한 뒤 `descriptorSpy.mock.invocationCallOrder[0]` 이 `commandArgsSpy.mock.invocationCallOrder[0]` 보다 **작음(descriptor 먼저)** 을 `toBeLessThan` 부등식으로 검증. 추가로 self-wire 재유도 포함 `descriptorSpy`·`commandArgsSpy` 각 `toHaveBeenCalledTimes(2)` + 인자 전파(`descriptorSpy` 는 `REPORT` 로, `commandArgsSpy` 첫 인자 = descriptor 산출물 = `plan.descriptor`)를 assert.
- [ ] **fail-fast test 추가 (error path/negative)**: descriptor 위임이 throw 하면(`report.gitSha` 빈/공백) commandArgs 위임이 **호출되지 않음(`commandArgsSpy` 0회)** 을 검증하는 test 1개 추가 — descriptor throw 를 실제 유발하고 `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` 호출이 그 에러를 선전파(fail-fast)하며 `commandArgsSpy` 가 `toHaveBeenCalledTimes(0)`(descriptor-먼저 순서로 인해 commandArgs 도달 불가) 임을 assert. (기존 error-path test 가 존재하나 순서 인과를 invocationCallOrder 관점으로 명시하는 신규 test 로 보강.)
- [ ] **branch/negative 보강**: commandArgs-하위 guard 우선 분기 — descriptor 는 정상 산출하되 commandArgs 위임 내부 guard 가 throw 하는 입력(예: descriptor.title/marker 를 비게 만드는 fixture 또는 commandArgs mock throw)일 때에도 **descriptor 위임은 그 전에 이미 호출됨(`descriptorSpy.mock.invocationCallOrder[0]` 존재, 즉 `descriptorSpy` 호출됨)** 을 검증하는 test 1개 추가(descriptor → commandArgs 순서가 commandArgs 단계 실패 시에도 보존됨을 못박음). 추가로 순서-lock test 는 pass-through spy 이므로 산출 `plan` 이 순서-검증 전후 deep-equal(byte-identical·무공유)임을 재확인(production 무변경 회귀 0). 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.spec.ts` 가 1건 이상(이전 0건) — 위임 순서-lock 실배선 확인.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(descriptor → commandArgs)를 lock 만 하고 바꾸지 않는다.
- descriptor / commandArgs 위임 helper·consistency 가드 로직·인자 순서·에러 정책 변경.
- 요약축(result-issue-command-plan) command-plan 컴포저 spec 변경 — 본 task 는 daily canonical leg 만. 요약축 mirror 는 후속 task(Follow-up 참조).
- publish-plan 등 plan 컴포저 축의 다른 컴포저 delegate 순서-lock — 별도 후속 task.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) plan 컴포저 축 daily canonical(본 task) 완료 후 **요약축 mirror**: `realdata-e2e-result-issue-command-plan.spec.ts` 의 command-plan 컴포저(delegate: reportPlan → commandArgs, self-assert)에 invocationCallOrder 순서-lock 부재(grep 0) → 요약축 mirror task 로 지목.
- (감사 후속) publish-plan 컴포저(daily·summary): delegate commandPlan → searchGhArgv → self-assert 순서-lock 부재 → plan 컴포저 축 2번째 컴포저로 후속 지목.
