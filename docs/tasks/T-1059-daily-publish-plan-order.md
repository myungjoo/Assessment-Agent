---
id: T-1059
title: daily-step-dual-leg-run-report-issue-publish-plan consistency-guard(assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource)의 2 distinct builder 데이터-의존 재유도 순서(command-plan → search-gh-argv) invocationCallOrder 순서-lock + reference-페어링 test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 6)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 115
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts
independentStream: realdata-e2e-daily-step-dual-leg-publish-plan-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 6번째 leg (T-1054~T-1058 후속). T-1058 Follow-up 감사 결과 — daily-step-dual-leg-publish-plan-consistency 가 2 distinct builder(command-plan L218 → search-gh-argv L219~220, 둘째가 첫째 산출의 commandArgs 를 소비) 데이터-의존 chain 재유도이나 spec invocationCallOrder=0. T-1057 publish-plan-consistency 의 daily-leg mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1059 — daily-step-dual-leg-run-report-issue-publish-plan consistency-guard 재유도 2 builder 순서(command-plan → search-gh-argv) invocationCallOrder 순서-lock + 데이터-의존 reference-페어링 test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. consistency-guard 재유도 leg 은 leg 1(T-1054, result-report-plan-consistency 의 summary → descriptor), leg 2(T-1055, evaluation-plan-consistency 의 inputs → scoring-call-args), leg 3(T-1056, result-issue-command-plan-consistency 의 report-plan → command-args), leg 4(T-1057, result-issue-publish-plan-consistency 의 command-plan → search-gh-argv), leg 5(T-1058, daily-step-dual-leg-command-plan-consistency 의 descriptor → command-args)가 완료됐다.

**T-1058 Follow-up 이 지목한 나머지 daily-step-dual-leg 계열 consistency guard 를 pre-check 감사(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정했다.** 후보 3종 중 `realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` 의 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(L200~245)가 최고가치로, 재유도 단계가 **데이터-의존 chain 을 이룬 2 distinct builder** 다(둘째가 첫째 산출의 `commandArgs` 를 source 로 소비 — T-1057 의 daily-leg mirror, 최고가치 패턴):

- L217~218: `const { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } = buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` — command-plan 컴포저 위임 재유도(builder ①, `{descriptor, commandArgs}` 반환)
- L219~220: `const expectedSearchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs)` — search-gh-argv 위임 재유도(builder ②), **builder ① 반환값에서 destructure 한 `expectedCommandArgs` 를 인자로 소비**

즉 두 builder 는 `command-plan → search-gh-argv` **순서에 의미가 있다**: builder ②가 builder ① 산출(`expectedCommandArgs`)을 source 로 쓰므로 command-plan 재유도가 반드시 먼저 완료돼야 search-gh-argv 재유도에 도달한다(데이터-의존 chain). 이는 T-1057(result-issue-publish-plan-consistency 재유도 command-plan→search-gh-argv)의 **daily-leg sibling consistency-guard leg** 이다.

현행 spec(`realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts`, 439줄)은 happy-path void·구성요소 drift RangeError·구조 결손 TypeError·**재유도 chain throw 전파(command-plan 내부 descriptor 단계 throw 전파)**·**command-plan 위임 배선(정상 경로 command-plan 1회·원본 report 인자 호출)**·**short-circuit(구조 위반 시 command-plan 재유도 미호출, command-plan spy throw 주입 시 search-argv 재유도 미호출)**·결정성/비변형은 이미 검증한다. 그러나 두 재유도 builder(command-plan → search-gh-argv)의 **정합-경로 상대 호출 순서(`invocationCallOrder` 부등식)와 데이터-의존 방향(builder ②가 builder ① 산출 `commandArgs` 를 소비)은 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인). 따라서 guard 재유도 본문에서 실수로 두 재유도를 재정렬하거나 builder ②의 인자를 builder ① 산출이 아닌 다른 값으로 바꿔도(deep-equal 은 순서-무관이라 최종 verdict 는 통과할 수 있는 경로) 검출되지 않는다. spec 은 이미 두 builder module namespace(`commandPlanModule` L29·`searchArgvModule` L33)를 import 해 spyOn 배선 인프라를 갖췄으므로, 정합-경로 순서-lock + reference-페어링 test 만 추가하면 이 gap 이 봉해진다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**. 이미 `import * as commandPlanModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan"`(L29)·`import * as searchArgvModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv"`(L33) namespace import 를 보유하므로 신규 import 불요 — 두 namespace 프로퍼티(`commandPlanModule.buildRealDataDailyStepDualLegRunReportIssueCommandPlan` · `searchArgvModule.buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`)에 `jest.spyOn` 을 건다. 기존 fixture(`makeReport` L37·`HAPPY_REPORT` L57·`makePlan` L60 로 만든 정합 plan)를 재유도 트리거 입력으로 재사용. 최상위 `afterEach(jest.restoreAllMocks)`(L67~69)가 spy 격리를 이미 보장. 기존 "command-plan 컴포저 위임 / short-circuit (spyOn)" describe(L326~390)를 선례 위치로 삼되, 그 안의 기존 test(정상 경로 command-plan 1회 호출·구조 위반 short-circuit·command-plan throw 주입 시 search-argv 미호출)는 **유지**하고 정합-경로 순서-lock + reference-페어링 + 후속-throw 순서 재확인 test 를 **신규 추가**한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource` L200~245: (1) 구조 guard(L206 `assertPlanStructure`) → (2) `const { descriptor: expectedDescriptor, commandArgs: expectedCommandArgs } = buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)`(L217~218, builder ①) → (3) `const expectedSearchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs)`(L219~220, builder ② — builder ① 반환값에서 destructure 한 expectedCommandArgs 소비) → (4) descriptor deep-equal → (5) commandArgs deep-equal → (6) searchArgv deep-equal. ⚠️ 순서-lock 은 이 `command-plan → search-gh-argv` 재유도 순서 + 데이터-의존(builder ②가 builder ① 산출 `commandArgs` 를 인자로 소비)을 못박는다. reference-페어링 assert 대상은 `searchArgvSpy.mock.calls[0][0]` === `commandPlanSpy.mock.results[0].value.commandArgs`(builder ①은 `{descriptor, commandArgs}` 객체를 반환하므로 그 `.commandArgs` 프로퍼티가 builder ②의 첫 인자).
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts`(T-1057 산물) — consistency-guard 재유도 2-delegate 데이터-의존 순서-lock 의 pass-through `jest.spyOn`(mockImplementation 없이 원 구현 통과) + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 둘째 위임 인자가 첫째 산출임을 확인하는 reference-페어링 assert + 후속 위임 throw → 첫째 1회(순서 재확인) 구조 선례. 본 task 를 이 sibling leg 로 mirror(대상은 daily-step-dual-leg publish-plan-consistency, builder ② 인자는 builder ① 반환값의 `.commandArgs` 프로퍼티).

## Acceptance Criteria

- [ ] **정합-경로 재유도 순서-lock test 추가 (happy-path/flow)**: guard 재유도 두 builder 순서를 못박는 test 1개 추가 — command-plan 위임(`commandPlanModule.buildRealDataDailyStepDualLegRunReportIssueCommandPlan`)·search-gh-argv 위임(`searchArgvModule.buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, `makePlan()`(정합 plan)·`HAPPY_REPORT` 로 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource(plan, HAPPY_REPORT)`(재유도 트리거)을 1회 호출한 뒤 `commandPlanSpy.mock.invocationCallOrder[0] < searchArgvSpy.mock.invocationCallOrder[0]` 부등식(command-plan → search-gh-argv 순서)을 `toBeLessThan` 으로 검증. 추가로 두 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회). ⚠️ plan 은 spy 설정 **전**에 `makePlan()` 으로 미리 만든다(makePlan 자체가 컴포저 chain 을 돌려 두 builder 를 호출하므로 spy 이후 생성 시 관측 오염 — L328~330 주석 선례).
- [ ] **데이터-의존 reference-페어링 assert 추가 (flow)**: 위 순서-lock test 안에서(또는 별도 test 로) search-gh-argv 위임이 command-plan 위임의 **반환값에서 destructure 한 `commandArgs` 를 인자로 소비**함을 assert — `searchArgvSpy.mock.calls[0][0]` 이 `commandPlanSpy.mock.results[0].value.commandArgs` 와 동일(`toBe` 참조 동등 또는 `toEqual` deep 동등)임을 검증. builder ②의 첫 인자가 builder ① 산출의 commandArgs 임을 못박아 데이터-의존 chain 방향을 lock(T-1057 reference-페어링 선례 mirror).
- [ ] **error path/negative 보강 (fail-fast + 후속 위임 throw 순서 재확인)**: 두 negative case 를 확인/추가 —
  (a) **fail-fast 순서(command-plan 재유도 throw → search-gh-argv 미도달)**: 기존 L363 test(command-plan throw 주입 → `searchArgvSpy` 미호출)가 이미 cover — 유지하고, 필요 시 `searchArgvSpy` 가 `toHaveBeenCalledTimes(0)` 임을 명시적으로 재확인. command-plan throw 를 pass-through 대신 `commandPlanSpy.mockImplementation(() => { throw new Error("commandplan-boom"); })` 로 강제해 `toThrow(/commandplan-boom/)` + `searchArgvSpy` `toHaveBeenCalledTimes(0)` 를 검증하는 test 가 순서-lock 의 데이터-의존 fail-fast 방향을 못박음을 확인(기존 test 유지, 필요 시 명시 assert 보강).
  (b) **후속-위임 throw 순서 재확인(search-gh-argv 재유도 throw → command-plan 이미 1회 호출)**: pass-through `commandPlanSpy` 를 유지하고 `searchArgvSpy.mockImplementation(() => { throw new Error("searchargv-boom"); })` 로 둘째 위임을 throw 시킨 뒤(정합 plan·report 로 command-plan 재유도는 통과) guard 호출이 그 에러를 전파(`toThrow(/searchargv-boom/)`)하고, 이때 **command-plan 위임은 이미 호출됨**(`commandPlanSpy` `toHaveBeenCalledTimes(1)` — 순서 상 command-plan 이 search-gh-argv 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증하는 test 를 신규 추가. 단일 negative 로 부족하지 않도록 (a)(b) 두 분기 각각 cover.
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/report mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -c invocationCallOrder test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` 가 0 → ≥1(정합-경로 순서-lock 부등식 실배선 확인).

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(command-plan → search-gh-argv)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` / `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 위임 helper 로직·인자·guard 정책 변경.
- command-plan 컴포저 내부 descriptor → command-args 순서 — 이미 T-1058 이 `command-plan-consistency` guard 층에서 cover. 본 task 는 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource` **내부**의 command-plan(1회 위임) → search-gh-argv 재유도만, 다른 층·다른 delegate.
- daily-step-dual-leg publish-plan **컴포저**(`realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.ts`)의 위임 순서 — 본 task 는 guard 내부의 두 builder 재유도만.
- result-report-plan / evaluation-plan / result-issue-command-plan / result-issue-publish-plan / daily-step-dual-leg-command-plan 재유도 — 이미 T-1054~T-1058 이 cover(본 task 는 sibling consistency-guard leg 6, daily-leg publish-plan 변형).
- 여타 daily-step-dual-leg 계열 consistency guard(gh-command-plan / outcome-report-from-output / descriptor-body 등)의 재유도 순서-lock — 감사 결과 후순위. 후속 Follow-up 감사 대상.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) 본 task(daily-step-dual-leg publish-plan-consistency 재유도 순서-lock) 완결 후 나머지 daily-step-dual-leg 계열 consistency guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. 남은 2+ distinct builder 데이터-의존 chain 후보: `realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts`(action → argv 3-단계 재유도, resolveAction → buildGhArgv 데이터-의존) · `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts`(parse-output → outcome-report 2-단계) 등을 각 guard 본문의 재유도 데이터-의존 여부로 우선순위 재판정. 단일 builder 재유도·게이트 없는 상호-독립 병렬 재유도는 "order-lock 불요" 확정 기록.
