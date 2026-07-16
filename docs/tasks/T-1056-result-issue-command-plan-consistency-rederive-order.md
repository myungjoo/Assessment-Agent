---
id: T-1056
title: result-issue-command-plan consistency-guard(assertRealDataResultIssueCommandPlanConsistentWithInputs)의 2 distinct builder 데이터-의존 재유도 순서(report-plan → command-args) invocationCallOrder 순서-lock test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts
independentStream: realdata-e2e-result-issue-command-plan-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 3번째 leg (T-1054 result-report-plan, T-1055 evaluation-plan 후속). T-1055 Follow-up pre-check 감사 결과 — result-issue-command-plan-consistency 가 2 distinct builder(buildRealDataResultReportPlan L291 → buildRealDataResultIssueCommandArgs(expectedReport.descriptor) L292)를 데이터-의존 chain 으로 재유도(둘째가 첫째 산출 descriptor 소비)하는 최고가치 후보(spec invocationCallOrder=0). T-1054(summary→descriptor 데이터-의존)의 sibling leg. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1056 — result-issue-command-plan consistency-guard 재유도 2 builder 순서(report-plan → command-args) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리(T-1042/T-1043), from-output(T-1044), command-plan(T-1045/T-1046), gh-command-plan(T-1047/T-1048), publish-plan(T-1049/T-1050), descriptor(T-1051), evaluation-plan 컴포저(T-1052), step-args aggregator(T-1053), consistency-guard 재유도 leg 1(T-1054, result-report-plan-consistency 의 summary → descriptor 데이터-의존), consistency-guard 재유도 leg 2(T-1055, evaluation-plan-consistency 의 inputs → scoring-call-args fail-fast 게이트)이 완료됐다.

**T-1055 Follow-up 이 지목한 "나머지 consistency guard 를 pre-check 감사(각 spec invocationCallOrder 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정"을 수행 — 전 consistency-guard 인벤토리(55개)를 훑었다**. `invocationCallOrder` 를 가진 것은 T-1054·T-1055 산물뿐이고 나머지는 전부 0건이다. 이 중 **2 distinct builder 를 순차 재유도**하는 guard 를 감사한 결과, 최고가치는 `realdata-e2e-result-issue-command-plan-consistency.ts` 의 `assertRealDataResultIssueCommandPlanConsistentWithInputs`(L269~319)로, 재유도 단계가 **데이터-의존 chain 을 이룬 2 distinct builder** 다(둘째가 첫째 산출을 source 로 소비 — T-1054 summary→descriptor 와 동형, 최고가치 패턴):

- L291: `const expectedReport = buildRealDataResultReportPlan(results, run)` — report-plan 위임 재유도(builder ①)
- L292~294: `const expectedCommandArgs = buildRealDataResultIssueCommandArgs(expectedReport.descriptor)` — command-args 위임 재유도(builder ②), **builder ① 산출 `expectedReport.descriptor` 를 인자로 소비**

즉 두 builder 는 `report-plan → command-args` **순서에 의미가 있다**: builder ②가 builder ① 산출(`expectedReport.descriptor`)을 source 로 쓰므로 report-plan 재유도가 반드시 먼저 완료돼야 command-args 재유도에 도달한다(데이터-의존 chain). 이는 T-1054(result-report-plan-consistency 재유도 summary→descriptor 데이터-의존)의 **sibling consistency-guard leg** 이자, evaluation-side step④ post-evaluation interpretation 종단 컴포저(`buildRealDataResultIssueCommandPlan`)의 **guard-재유도 mirror** 다.

현행 spec(`realdata-e2e-result-issue-command-plan-consistency.spec.ts`, 756줄)은 구조 결손 TypeError·report summary 집계 drift·descriptor title/marker drift·commandArgs searchQuery/createArgs/updateArgs drift·labels 어긋남·재유도 위임 throw 전파(fail-fast)·결정성은 검증하나(L71~) 두 재유도 builder(report-plan → command-args)의 **상대 호출 순서와 데이터-의존 방향(builder ②가 builder ① 산출 descriptor 를 소비)은 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인), 두 builder module namespace 를 spyOn 하는 지점 부재. 따라서 guard 재유도 본문에서 실수로 두 재유도를 재정렬(command-args 를 report-plan 보다 먼저 재유도)하거나 builder ②의 인자를 builder ① 산출이 아닌 다른 값으로 바꿔도(deep-equal 은 순서-무관이라 최종 verdict 는 통과할 수 있는 경로) 검출되지 않는다. production 무변경, test-only 1파일로 이 gap 을 봉한다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**. 현행 import(L32~37)는 `buildRealDataResultIssueCommandPlan`(정합 plan 합성용)·`assertRealDataResultIssueCommandPlanConsistentWithInputs`(SUT)·`RealDataResultIssueRunRef` 를 named import 로 보유한다. **`jest.spyOn` 을 위해 두 builder 위임의 module namespace import 를 신규 추가**해야 한다: `import * as resultReportPlanModule from "./realdata-e2e-result-report-plan"`(export `buildRealDataResultReportPlan`, L111) · `import * as resultIssueCommandArgsModule from "./realdata-e2e-result-issue-command-args"`(export `buildRealDataResultIssueCommandArgs`, L120) — spyOn 은 namespace 객체 프로퍼티(`resultReportPlanModule.buildRealDataResultReportPlan` · `resultIssueCommandArgsModule.buildRealDataResultIssueCommandArgs`)에 건다(선례: T-1046/T-1052/T-1054/T-1055 의 named-import 위임에 spec 이 namespace import 추가해 spyOn — ts-jest 가 ESM named import 를 module 객체 프로퍼티 접근으로 컴파일하므로 소비 측 guard 호출이 spy 를 통과). 기존 fixture(`makeResult` L40 · `makeRun` L53 · `buildConsistent` L64 로 만든 plan)를 재유도 트리거 입력으로 재사용. 기존 negative describe(L344 negative 충분 cover / L331 재유도 throw fail-fast 선례)를 선례로 삼되 spyOn 대상만 두 builder module 로 바꾼다. `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataResultIssueCommandPlanConsistentWithInputs` L269~319: (1) 구조 guard(L278~285) → (2) `const expectedReport = buildRealDataResultReportPlan(results, run)`(L291, builder ①) → (3) `const expectedCommandArgs = buildRealDataResultIssueCommandArgs(expectedReport.descriptor)`(L292~294, builder ② — builder ① 산출 소비) → (4) report deep-equal(L299) → (5) commandArgs deep-equal(L312). ⚠️ 순서-lock 은 이 `report-plan → command-args` 재유도 순서 + 데이터-의존(builder ②가 builder ① 산출 `expectedReport.descriptor` 를 인자로 소비)을 못박는다. builder ②는 builder ① 산출을 **직접 소비**하므로 T-1055(callArgs 가 plan.inputs 소비)와 달리 **reference-페어링 assert 가 적용된다**(T-1054 mirror — 둘째 위임의 첫 인자가 첫째 위임의 반환 산출 descriptor 임을 assert).
- `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts`(T-1054 산물) — consistency-guard 재유도 2-delegate 데이터-의존 순서-lock 의 pass-through `jest.spyOn` + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 둘째 위임 인자가 첫째 산출임을 확인하는 reference-페어링 assert + 첫 위임 throw → 둘째 0회(fail-fast) + 둘째 위임 throw → 첫째 1회(후속 throw 전파) 구조 선례. 본 task 를 이 sibling leg 로 mirror(대상은 result-issue-command-plan-consistency).

## Acceptance Criteria

- [ ] **재유도 순서-lock test 추가 (happy-path/flow)**: guard 재유도 두 builder 순서를 못박는 test 1개 추가 — report-plan 위임(`resultReportPlanModule.buildRealDataResultReportPlan`)·command-args 위임(`resultIssueCommandArgsModule.buildRealDataResultIssueCommandArgs`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, 정합 results·run 으로 `buildRealDataResultIssueCommandPlan(...)`(또는 `buildConsistent`) plan 을 만든 뒤 `assertRealDataResultIssueCommandPlanConsistentWithInputs(plan, results, run)`(재유도 트리거)을 1회 호출한 뒤 `reportSpy.mock.invocationCallOrder[0] < commandArgsSpy.mock.invocationCallOrder[0]` 부등식(report-plan → command-args 순서)을 `toBeLessThan` 으로 검증. 추가로 두 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회). `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- [ ] **데이터-의존 reference-페어링 assert 추가 (flow)**: 위 순서-lock test 안에서(또는 별도 test 로) command-args 위임이 report-plan 위임의 **반환 산출 descriptor 를 인자로 소비**함을 assert — `commandArgsSpy.mock.calls[0][0]` 이 `reportSpy.mock.results[0].value.descriptor` 와 동일(`toBe` 참조 동등 또는 `toEqual` deep 동등)임을 검증. builder ②의 첫 인자가 builder ① 산출 descriptor 임을 못박아 데이터-의존 chain 방향을 lock(T-1054 reference-페어링 선례 mirror).
- [ ] **error path/negative 보강 (fail-fast + 후속 위임 throw 전파)**: 두 negative case 추가 —
  (a) **fail-fast 순서(report-plan 재유도 throw → command-args 미도달)**: `reportSpy.mockImplementation(() => { throw new Error("report-boom"); })` 로 첫 위임을 throw 시키고 guard 호출 시 그 에러가 선전파(`toThrow(/report-boom/)`)하며 **command-args 위임이 `toHaveBeenCalledTimes(0)`**(report-plan 먼저 순서 + builder ②가 builder ① 산출 소비이므로 command-args 재유도 미도달)임을 검증. 순서-lock 의 데이터-의존 fail-fast 방향 못박기.
  (b) **후속-위임 throw 전파(command-args 재유도 throw → report-plan 이미 호출)**: pass-through reportSpy 를 유지하고 `commandArgsSpy.mockImplementation(() => { throw new Error("commandargs-boom"); })` 로 둘째 위임을 throw 시킨 뒤(정합 plan·results·run 으로 report-plan 재유도는 통과) guard 호출이 그 에러를 전파(`toThrow(/commandargs-boom/)`)하고, 이때 **report-plan 위임은 이미 호출됨**(`reportSpy` `toHaveBeenCalledTimes(1)` — 순서 상 report-plan 이 command-args 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 단일 negative 로 부족하지 않도록 (a)(b) 두 분기 각각 cover(기존 L331 재유도 throw fail-fast 선례와 정합).
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/results/run mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -n "resultReportPlanModule\|resultIssueCommandArgsModule" test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` 가 1건 이상(이전 0건) — 두 builder 위임의 namespace spyOn 실배선 확인. `git grep -c invocationCallOrder test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` 가 0 → ≥1.

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(report-plan → command-args)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataResultReportPlan` / `buildRealDataResultIssueCommandArgs` 위임 helper 로직·인자·guard 정책 변경.
- step④ post-evaluation interpretation **컴포저**(`realdata-e2e-result-issue-command-plan.ts`)의 report→command-args 위임 순서 — 본 task 는 `assertRealDataResultIssueCommandPlanConsistentWithInputs` **내부**의 두 builder 재유도만, 다른 층·다른 delegate.
- result-report-plan-consistency 재유도(summary → descriptor) / evaluation-plan-consistency 재유도(inputs → scoring-call-args) — 이미 T-1054/T-1055 가 cover(본 task 는 sibling consistency-guard leg).
- 여타 consistency guard(pipeline-plan-consistency 는 단일 builder 재유도 + modelId 직접 대조라 순서-lock 불요, publish-plan / gh-command-plan / daily-step-dual-leg 계열의 재유도 순서-lock) — 감사 결과 단일 builder 재유도이거나 후순위. 후속 Follow-up 감사 대상.
- evaluation-plan / publish-plan / command-plan / gh-command-plan / descriptor / from-output / step-args aggregator 순서-lock — 이미 T-1044~T-1053 이 cover.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) 본 task(result-issue-command-plan-consistency 재유도 순서-lock) 완결 후 나머지 consistency guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. 남은 2+ distinct builder 데이터-의존 chain 후보: `realdata-e2e-result-issue-publish-plan-consistency.ts`(buildRealDataResultIssueCommandPlan → publish-plan/search-gh-argv) · `realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts`(3 builder) · `realdata-e2e-run-plan-consistency.ts`(run-plan + pipeline-plan) 등을 각 guard 본문의 재유도 데이터-의존 여부로 우선순위 재판정. 단일 builder 재유도(pipeline-plan 처럼 modelId 직접 대조)·게이트 없는 상호-독립 병렬 재유도는 "order-lock 불요" 확정 기록.
