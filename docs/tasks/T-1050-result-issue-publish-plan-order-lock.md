---
id: T-1050
title: result-issue(요약축) publish-plan 컴포저 본문 위임 순서(commandPlan → searchGhArgv)를 invocationCallOrder 순서-lock test 로 못박기 (publish-plan 컴포저 sweep 요약축 mirror leg)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts
independentStream: realdata-e2e-result-issue-publish-plan
plannerNote: "P5 test-hardening — T-1049 Follow-up 이 지목한 publish-plan 컴포저 축 요약축(result-issue) mirror leg. buildRealDataResultIssuePublishPlan(results, run) 은 본문에서 두 위임(commandPlan→searchGhArgv, 산출 commandArgs 가 다음 입력)을 순차 호출하고 self-assert 가드를 self-wire 하나 spec 은 delegate 상대 호출 순서를 invocationCallOrder 로 못박지 않음(grep 0 확인). 2-delegate chain 이라 한 부등식 lock. daily canonical(T-1049) 을 요약축으로 mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1050 — result-issue(요약축) publish-plan 컴포저 본문 위임 순서(commandPlan → searchGhArgv) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리 2 축(T-1042/T-1043), from-output 컴포저 delegate 순서-lock(T-1044), command-plan 컴포저 축 daily·summary 두 leg(T-1045/T-1046), gh-command-plan 컴포저 축 daily·summary 두 leg(T-1047/T-1048), publish-plan 컴포저 축 daily canonical leg(T-1049)이 완료됐다.

본 task 는 T-1049 Follow-up 이 명시적으로 지목한 **publish-plan 컴포저 축 요약축(result-issue) mirror leg** 로 sweep 을 확장한다(daily canonical → summary mirror cadence — T-1046/T-1048 선례). `buildRealDataResultIssuePublishPlan(results, run)` 컴포저는 본문에서 **두** 위임을 순서대로 호출한다 — (1) `buildRealDataResultIssueCommandPlan(results, run)` → `{report, commandArgs}` → (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)` → `searchArgv`(이전 산출 `commandArgs` 를 입력으로 받으므로 순서 의존) → self-wire 가드 `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)`.

**현행 spec 은 이미 happy-path / flow(빈·단일·다수 results) / error-path / negative(guard 분기마다 throw) / 결정론·무공유·입력 보존 / R-59 필드 정합 / self-wire 가드(T-0666) 블록을 보유**하나, 두 위임의 **상대 호출 순서(commandPlan 먼저 → searchGhArgv)는 못박지 않는다**(`git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` = 0건, grep exit 1 확인). 따라서 컴포저 본문에서 실수로 위임 순서를 재정렬하는 회귀가 발생해도(현행은 commandArgs 가 다음 입력이라 실제로는 깨지지만, 순서 자체를 못박은 명시 test 는 부재) 순서 부등식 test 가 없다. daily canonical(T-1049) 을 요약축으로 mirror 해 publish-plan 축을 완결한다. 2-delegate chain 이라 한 부등식으로 lock. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` — 본 task 가 수정할 유일 파일. 현행 import 는 두 위임을 **named import** 로 보유한다 — `import { buildRealDataResultIssueCommandPlan } from "./...-command-plan"`(L19) · `import { buildRealDataResultIssueSearchGhArgv } from "./...-search-argv"`(L23) · `import * as consistencyModule from "./...-publish-plan-consistency"`(L22, 기존 self-wire 가드 spyOn 대상). **`jest.spyOn` 을 위해 두 위임의 module namespace import 를 신규 추가**해야 한다(예: `import * as commandPlanModule from "./realdata-e2e-result-issue-command-plan"` · `import * as searchArgvModule from "./realdata-e2e-result-issue-search-argv"`) — 기존 named import 는 그대로 두고 spyOn 은 namespace 객체 프로퍼티에 건다. fixture `makeResult`(L33)·`RUN`(L26)·`SINGLE`(L45) 재사용. 기존 describe 블록 끝 또는 별도 신규 describe 에 신규 순서-lock/fail-fast/guard-우선 test 를 append.
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 컴포저 위임 지점 확인용(수정 금지). `buildRealDataResultIssuePublishPlan` 함수 L135~161: (1) `buildRealDataResultIssueCommandPlan(results, run)` → `{report, commandArgs}`(run.gitSha/dateToken 빈·공백 시 내부 하위 assertNonBlank throw, 자체 try/catch 0, search-argv 단계 미도달, L142) → (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)` → `searchArgv`(L148) → `plan = {report, commandArgs, searchArgv}` → self-assert 가드(L158) → `return plan`. ⚠️ daily leg 의 `descriptor` 필드와 달리 요약축은 첫 위임 산출 필드가 `report` 다.
- ⚠️ 정상 경로에서 self-wire 가드가 **재유도로 하위 위임을 다시 호출**하는지 확인(`realdata-e2e-result-issue-publish-plan-consistency`). 본 task 가 spyOn 하는 것은 **top-level 두 위임**(commandPlan, searchGhArgv)이므로 가드 재유도가 이들을 다시 호출할 수 있다. spy 기반 `toHaveBeenCalledTimes(N)` assert 는 실제 가드 재유도 구조를 확인해 N 을 맞춘다. 순서-lock 은 첫 호출(`invocationCallOrder[0]`)로 판정하므로 재유도 횟수와 무관하게 부등식은 안정적.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts`(T-1049 선례, 동형 2-delegate publish-plan 컴포저 순서-lock daily canonical) — 두 delegate 를 실 구현 pass-through `jest.spyOn`(mockImplementation 없이)으로 감싸고 `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식을 `toBeLessThan` 으로 검증한 구조를 요약축으로 그대로 mirror.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: 컴포저 본문 두 위임 순서를 못박는 test 1개 추가 — commandPlan 위임(`commandPlanModule.buildRealDataResultIssueCommandPlan`)·searchGhArgv 위임(`searchArgvModule.buildRealDataResultIssueSearchGhArgv`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `buildRealDataResultIssuePublishPlan(SINGLE, RUN)`(또는 재사용 fixture)을 1회 호출한 뒤 `commandPlanSpy.mock.invocationCallOrder[0] < searchGhArgvSpy.mock.invocationCallOrder[0]` 부등식(commandPlan → searchGhArgv 순서)을 `toBeLessThan` 으로 검증. 추가로 self-wire 재유도 여부에 맞춰 각 spy 호출 횟수(`toHaveBeenCalledTimes(N)`)와 인자 전파(`commandPlanSpy` 는 `(results, run)`, `searchGhArgvSpy` 는 첫 호출 `(commandArgs)` — commandPlan 산출 commandArgs 가 그대로 전달됨)를 assert.
- [ ] **fail-fast test 추가 (error path/negative)**: 앞선 위임이 throw 하면 후속 위임이 **호출되지 않음**을 검증하는 test 1+개 추가 — commandPlan 위임이 throw 하는 입력(`RUN` 의 `gitSha: ""` 또는 `dateToken: ""` — command-plan 내부 하위 descriptor guard throw)일 때 `searchGhArgvSpy` 가 `toHaveBeenCalledTimes(0)`(commandPlan-먼저 순서로 인해 search-argv 미도달)이고 컴포저 호출이 그 에러를 선전파(fail-fast)함을 assert.
- [ ] **branch/negative 보강**: search-argv-단계(또는 self-assert 가드) 우선 분기 — commandPlan 은 정상 산출하되 후속 단계에서 문제가 발생하는 시나리오에서도 **commandPlan 위임은 그 전에 이미 순서상 먼저 호출됨(`commandPlanSpy.mock.invocationCallOrder[0]` 이 존재하고 `searchGhArgvSpy` 의 첫 호출보다 앞섬)** 을 검증하는 test 1개 추가(2-delegate 순서가 후속 단계 실패 시에도 보존됨을 못박음). 추가로 순서-lock test 는 pass-through spy 이므로 산출 `plan` 이 순서-검증 전후 deep-equal(byte-identical·무공유; `report`/`commandArgs`/`searchArgv` 필드만 보유)임을 재확인. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-publish-plan.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-publish-plan.spec.ts` 가 1건 이상(이전 0건) — 두 위임 순서-lock 실배선 확인.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(commandPlan → searchGhArgv)를 lock 만 하고 바꾸지 않는다.
- commandPlan / searchGhArgv 위임 helper·consistency 가드 로직·인자 순서·에러 정책 변경.
- daily(dual-leg) publish-plan 컴포저 spec 변경 — 이미 T-1049 이 cover.
- command-plan 위임 내부의 report/descriptor→command-args 하위 순서-lock — 이미 T-1046 이 cover(요약축 command-plan leg).

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) publish-plan 컴포저 축 daily(T-1049)·요약축(본 task) 두 leg 완료 → publish-plan 축 order-lock sweep 완결. 다음 후속 축은 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 계열의 delegate 순서-lock 부재 여부를 감사해 sweep 확장 지점 지목.
