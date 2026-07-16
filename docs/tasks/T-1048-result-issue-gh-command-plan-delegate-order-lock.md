---
id: T-1048
title: result-issue(요약축) gh-command-plan 컴포저 본문 위임 순서(parse → resolveAction → buildGhArgv)를 invocationCallOrder 순서-lock test 로 못박기 (gh-command-plan 컴포저 sweep summary mirror leg)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 100
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts
independentStream: realdata-e2e-result-issue-gh-command-plan
plannerNote: "P5 test-hardening — T-1047 Follow-up 이 지목한 gh-command-plan 컴포저 축 요약축(result-issue) mirror leg(daily→summary cadence). resolveRealDataResultIssueGhCommandPlan 은 본문에서 세 위임을 순차 호출(parse→resolveAction→buildGhArgv, 각 산출이 다음 입력)하고 self-assert 가드를 self-wire 하나 spec 은 delegate 상대 호출 순서를 invocationCallOrder 로 못박지 않음(grep 0 확인). 3-delegate chain 이라 두 부등식 lock. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1048 — result-issue(요약축) gh-command-plan 컴포저 본문 위임 순서(parse → resolveAction → buildGhArgv) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리 2 축(T-1042/T-1043), from-output 컴포저 delegate 순서-lock(T-1044), plan(command-plan) 컴포저 축 daily·summary 두 leg(T-1045/T-1046), gh-command-plan 컴포저 축 daily canonical leg(T-1047)이 완료됐다.

본 task 는 T-1047 Follow-up 이 명시적으로 지목한 **gh-command-plan 컴포저 축 요약축(result-issue) mirror leg** 로 sweep 을 확장한다(daily(T-1047)→summary cadence). `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 컴포저는 본문에서 **세** 위임을 순서대로 호출한다 — (1) `parseRealDataResultIssueSearchOutput(stdout)` → hits → (2) `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)` → action(이전 산출 hits 를 입력으로 받으므로 순서 의존) → (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` → argv(이전 산출 action 을 입력으로 받으므로 순서 의존) → self-wire 가드 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)`.

**현행 spec(458줄)은 이미 happy-path / error-path / negative / 결정론·무공유 블록을 보유**하나, 세 위임의 **상대 호출 순서(parse 먼저 → resolveAction → buildGhArgv)는 못박지 않는다**(`git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` = 0건, grep exit 1 확인). 따라서 컴포저 본문에서 실수로 위임 순서를 재정렬하는 회귀가 발생해도(현행은 각 산출이 다음 입력이라 실제로는 깨지지만, 순서 자체를 못박은 명시 test 는 부재) 순서 부등식 test 가 없다. gh-command-plan 축 daily leg(T-1047) canonical 패턴을 요약축 mirror leg 로 완성한다. 3-delegate chain 이라 두 부등식으로 lock. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` — 본 task 가 수정할 유일 파일(458줄). 현행 import: value `resolveRealDataResultIssueGhCommandPlan`(L17)·namespace `* as consistency`(L18, self-wire spy 대상). **delegate spyOn 을 위해 세 namespace import 신규 추가 필요** — `import * as searchParseModule from "./realdata-e2e-result-issue-search-parse"` · `import * as actionModule from "./realdata-e2e-result-issue-action"` · `import * as ghArgvModule from "./realdata-e2e-result-issue-gh-argv"`(T-1044/T-1045/T-1047 선례가 named import 옆에 `import * as ...Module` 를 나란히 추가한 것과 동형). fixture `makeCommandArgs`(L23)·`stdoutOf`(L48) 재사용. 기존 describe 블록 끝 또는 별도 신규 describe 에 신규 순서-lock/fail-fast/guard-우선 test 를 append.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — 컴포저 위임 지점 확인용(수정 금지). `resolveRealDataResultIssueGhCommandPlan` 함수 L61~: (1) `parseRealDataResultIssueSearchOutput(stdout)` → hits(비JSON/비배열/원소 type/number 비양수 시 여기서 throw, 후속 미도달, L66) → (2) `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)` → action(빈/공백 marker 시 여기서 throw, L69) → (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` → argv(title/body 빈·공백 또는 issueNumber 비양수 시 빌더 throw, L75) → self-assert 가드(L90) → `return plan`.
- ⚠️ 정상 경로에서 self-wire 가드가 **재유도로 세 위임을 다시 호출**하는지 확인(from-output/plan/daily-gh-command-plan 선례는 가드가 입력으로 동일 위임을 독립 재유도). 컴포저 본문 1회 + 가드 재유도 여부에 따라 호출 횟수가 결정되므로, spy 기반 `toHaveBeenCalledTimes(N)` assert 는 실제 가드 재유도 구조를 확인해 N 을 맞춘다. 순서-lock 은 첫 호출(`invocationCallOrder[0]`)로 판정.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts`(T-1047 선례, 동형 3-delegate 컴포저 순서-lock mirror) — 세 delegate 를 실 구현 pass-through `jest.spyOn`(mockImplementation 없이)으로 감싸고 `parseSpy.mock.invocationCallOrder[0] < actionSpy.mock.invocationCallOrder[0]` 및 `actionSpy.mock.invocationCallOrder[0] < ghArgvSpy.mock.invocationCallOrder[0]` 두 부등식을 `toBeLessThan` 으로 검증한 구조를 요약축으로 그대로 mirror.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: 컴포저 본문 세 위임 순서를 못박는 test 1개 추가 — parse 위임(`searchParseModule`)·resolveAction 위임(`actionModule`)·buildGhArgv 위임(`ghArgvModule`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 을 1회 호출한 뒤 `parseSpy.mock.invocationCallOrder[0] < actionSpy.mock.invocationCallOrder[0]` **및** `actionSpy.mock.invocationCallOrder[0] < ghArgvSpy.mock.invocationCallOrder[0]` 두 부등식(parse → resolveAction → buildGhArgv 순서)을 `toBeLessThan` 으로 검증. 추가로 self-wire 재유도 여부에 맞춰 각 spy 호출 횟수(`toHaveBeenCalledTimes(N)`)와 인자 전파(`parseSpy` 는 `(stdout)`, `actionSpy` 는 `(hits, commandArgs.searchQuery)`, `ghArgvSpy` 는 `(action, commandArgs)`)를 assert.
- [ ] **fail-fast test 추가 (error path/negative)**: 앞선 위임이 throw 하면 후속 위임이 **호출되지 않음**을 검증하는 test 1+개 추가 — (a) parse 위임이 throw 하는 입력(비JSON stdout 등)일 때 `actionSpy` 와 `ghArgvSpy` 가 각각 `toHaveBeenCalledTimes(0)`(parse-먼저 순서로 인해 후속 도달 불가)이고 컴포저 호출이 그 에러를 선전파(fail-fast)함을 assert. (b) resolveAction 위임이 throw 하는 입력(빈/공백 `searchQuery`)일 때 `ghArgvSpy` 가 `toHaveBeenCalledTimes(0)`(resolveAction 실패로 buildGhArgv 미도달)이고 `parseSpy` 는 이미 호출됨(`invocationCallOrder[0]` 존재)을 assert.
- [ ] **branch/negative 보강**: buildGhArgv-단계 guard 우선 분기 — parse·resolveAction 은 정상 산출하되 buildGhArgv 위임(또는 그 하위 guard)이 throw 하는 입력(예: `createTitle: ""` 로 빌더 throw)일 때에도 **parse·resolveAction 위임은 그 전에 이미 순서대로 호출됨(`parseSpy.mock.invocationCallOrder[0] < actionSpy.mock.invocationCallOrder[0]` 이 buildGhArgv 단계 실패 시에도 성립)** 을 검증하는 test 1개 추가(3-delegate 순서가 마지막 단계 실패 시에도 보존됨을 못박음). 추가로 순서-lock test 는 pass-through spy 이므로 산출 `plan` 이 순서-검증 전후 deep-equal(byte-identical·무공유)임을 재확인. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` 가 1건 이상(이전 0건) — 세 위임 순서-lock 실배선 확인.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(parse → resolveAction → buildGhArgv)를 lock 만 하고 바꾸지 않는다.
- parse / resolveAction / buildGhArgv 위임 helper·consistency 가드 로직·인자 순서·에러 정책 변경.
- daily 축(dual-leg) gh-command-plan 컴포저 spec 변경 — 이미 T-1047 이 cover.
- publish-plan 등 plan 컴포저 축의 다른 컴포저 delegate 순서-lock — 별도 후속 task.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) gh-command-plan 축 두 leg(daily T-1047 · summary 본 task) 완료 후 **publish-plan 컴포저(daily·summary)**: delegate commandPlan → searchGhArgv → self-assert 순서-lock 부재(grep 0) 확인 후 후속 지목.
