---
id: T-1046
title: 요약축 result-issue command-plan 컴포저 본문 위임 순서(reportPlan → commandArgs)를 invocationCallOrder 순서-lock test 로 못박기 (plan 컴포저 sweep 요약축 mirror leg)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 66
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-plan.spec.ts
independentStream: realdata-e2e-result-issue-command-plan
plannerNote: "P5 test-hardening — plan 컴포저 sweep daily leg(T-1045) 완료 후 T-1045 Follow-up 이 지목한 요약축 mirror. buildRealDataResultIssueCommandPlan 은 본문에서 reportPlan(buildRealDataResultReportPlan) → commandArgs(buildRealDataResultIssueCommandArgs) 두 위임을 순차 호출(commandArgs 는 report.descriptor 의존)하고 self-assert 가드를 self-wire 하나, spec 은 delegate 상대 호출 순서를 invocationCallOrder 로 못박지 않음(grep 0). daily canonical(T-1044/T-1045) 패턴을 요약축 leg 로 확립. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1046 — 요약축 result-issue command-plan 컴포저 본문 위임 순서(reportPlan → commandArgs) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축과 result-summary 패밀리 2 축(T-1042/T-1043), from-output 컴포저 delegate 순서-lock 두 leg(T-1044), plan 컴포저 축 daily leg(T-1045, `daily-step-dual-leg-run-report-issue-command-plan`)이 완료됐다.

본 task 는 T-1045 Follow-up 이 명시적으로 지목한 **plan 컴포저 축 요약축 mirror leg** 로 sweep 을 확장한다. `buildRealDataResultIssueCommandPlan(results, run)` 컴포저는 본문에서 두 위임을 순서대로 호출한다 — (1) `buildRealDataResultReportPlan(results, run)`(reportPlan 위임) → (2) `buildRealDataResultIssueCommandArgs(report.descriptor)`(commandArgs 위임, 산출 report 의 descriptor 를 입력으로 받으므로 순서 의존) → self-wire 가드 `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)`.

**현행 spec 은 이미 self-wire 가드(`consistency` namespace)를 `jest.spyOn` 으로 감싸는 self-wire 블록(L339~)과 happy-path/flow/error-path 블록을 보유**하나, 두 위임의 **상대 호출 순서(reportPlan 먼저)는 못박지 않는다**(`git grep invocationCallOrder ...result-issue-command-plan.spec.ts` = 0건). 따라서 컴포저 본문에서 실수로 commandArgs 위임을 reportPlan 위임 앞으로 옮기는 재정렬 회귀가 발생해도(현행은 산출 report.descriptor 를 commandArgs 가 참조하므로 실제로는 깨지지만, 순서 자체를 못박은 명시 test 는 부재) 순서 부등식 test 가 없다. daily 축(T-1045) canonical 패턴을 요약축 leg 로 확립한다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` — 본 task 가 수정할 유일 파일(506줄). 현행 named import: `buildRealDataResultReportPlan`(L27)·`buildRealDataResultIssueCommandArgs`(L23)·`buildRealDataResultIssueCommandPlan`(L24)·`* as consistency`(L25). **delegate spyOn 을 위해 두 namespace import 신규 추가 필요** — `import * as reportPlanModule from "./realdata-e2e-result-report-plan"` 및 `import * as commandArgsModule from "./realdata-e2e-result-issue-command-args"`(T-1044 선례가 named import 옆에 `import * as ...Module` 를 나란히 추가한 것과 동형). fixture `makeResult`(L31)·`makeRun`(L44) 재사용. 기존 self-wire describe 블록(L345~) 끝 또는 별도 신규 describe 에 신규 순서-lock/fail-fast/guard-우선 test 를 append.
- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — 컴포저 위임 지점 확인용(수정 금지). `buildRealDataResultIssueCommandPlan` 함수 L119~: (1) `buildRealDataResultReportPlan(results, run)` → report(run.gitSha/dateToken 빈/공백 시 여기서 throw, command-args 미도달) → (2) `buildRealDataResultIssueCommandArgs(report.descriptor)` → commandArgs(report.descriptor.title/marker 빈/공백 시 여기서 throw) → self-assert 가드(L148) → `return plan`.
- ⚠️ 정상 경로에서 self-wire 가드가 **재유도로 두 위임을 다시 호출**하는지 확인(daily 선례는 각 2회). 컴포저 본문 1회 + 가드 재유도 여부에 따라 호출 횟수가 결정되므로, spy 기반 `toHaveBeenCalledTimes(N)` assert 는 실제 가드 재유도 구조를 확인해 N 을 맞춘다. 순서-lock 은 첫 호출(`invocationCallOrder[0]`)로 판정.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts`(T-1044 선례, L488~553) — mirror 패턴 참조. 두 delegate 를 실 구현 pass-through `jest.spyOn`(mockImplementation 없이)으로 감싸고 `parseSpy.mock.invocationCallOrder[0]` 이 `buildSpy.mock.invocationCallOrder[0]` 보다 작음을 `toBeLessThan` 으로 검증한 구조를 reportPlan → commandArgs 로 동형 적용.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: 컴포저 본문 위임 순서를 못박는 test 1개 추가 — reportPlan 위임(`reportPlanModule`)과 commandArgs 위임(`commandArgsModule`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `buildRealDataResultIssueCommandPlan(results, run)` 을 1회 호출한 뒤 `reportPlanSpy.mock.invocationCallOrder[0]` 이 `commandArgsSpy.mock.invocationCallOrder[0]` 보다 **작음(reportPlan 먼저)** 을 `toBeLessThan` 부등식으로 검증. 추가로 self-wire 재유도 여부에 맞춰 각 spy 호출 횟수(`toHaveBeenCalledTimes(N)`)와 인자 전파(`reportPlanSpy` 는 `(results, run)` 로, `commandArgsSpy` 첫 인자 = report.descriptor = `plan.report.descriptor`)를 assert.
- [ ] **fail-fast test 추가 (error path/negative)**: reportPlan 위임이 throw 하면(`run.gitSha` 또는 `run.dateToken` 빈/공백) commandArgs 위임이 **호출되지 않음(`commandArgsSpy` 0회)** 을 검증하는 test 1개 추가 — reportPlan throw 를 실제 유발하고 `buildRealDataResultIssueCommandPlan` 호출이 그 에러를 선전파(fail-fast)하며 `commandArgsSpy` 가 `toHaveBeenCalledTimes(0)`(reportPlan-먼저 순서로 인해 commandArgs 도달 불가) 임을 assert.
- [ ] **branch/negative 보강**: commandArgs-단계 guard 우선 분기 — reportPlan 은 정상 산출하되 commandArgs 위임(또는 그 하위 guard)이 throw 하는 입력(예: `commandArgsModule` mock throw 또는 descriptor.title/marker 를 비게 만드는 fixture)일 때에도 **reportPlan 위임은 그 전에 이미 호출됨(`reportPlanSpy.mock.invocationCallOrder[0]` 존재, 즉 reportPlan 호출됨)** 을 검증하는 test 1개 추가(reportPlan → commandArgs 순서가 commandArgs 단계 실패 시에도 보존됨을 못박음). 추가로 순서-lock test 는 pass-through spy 이므로 산출 `plan` 이 순서-검증 전후 deep-equal(byte-identical·무공유)임을 재확인. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-command-plan.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` 가 1건 이상(이전 0건) — 위임 순서-lock 실배선 확인.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(reportPlan → commandArgs)를 lock 만 하고 바꾸지 않는다.
- reportPlan / commandArgs 위임 helper·consistency 가드 로직·인자 순서·에러 정책 변경.
- daily 축(`daily-step-dual-leg-run-report-issue-command-plan`) command-plan 컴포저 spec 변경 — T-1045 에서 이미 완료.
- publish-plan 등 plan 컴포저 축의 다른 컴포저(gh-command-plan 등) delegate 순서-lock — 별도 후속 task.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) plan 컴포저 축 요약축(본 task) 완료 후 **gh-command-plan 컴포저**: `realdata-e2e-result-issue-gh-command-plan.spec.ts` / `realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts` 의 delegate(commandPlan → searchGhArgv/gh-args → self-assert) 순서-lock 부재(grep 0) 확인 후 plan 컴포저 축 다음 leg 로 지목.
- (감사 후속) publish-plan 컴포저(daily·summary): delegate commandPlan → searchGhArgv → self-assert 순서-lock 부재 → 후속 지목.
