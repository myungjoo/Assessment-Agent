---
id: T-1058
title: daily-step-dual-leg-run-report-issue-command-plan consistency-guard(assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource)의 2 distinct builder 데이터-의존 재유도 순서(descriptor → command-args) invocationCallOrder 순서-lock + reference-페어링 test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 5)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts
independentStream: realdata-e2e-daily-step-dual-leg-command-plan-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 5번째 leg (T-1054~T-1057 후속). T-1057 Follow-up 감사 결과 — daily-step-dual-leg-command-plan-consistency 가 2 distinct builder(descriptor L193 → command-args L195, 둘째가 첫째 산출 소비) 데이터-의존 chain 재유도이나 spec invocationCallOrder=0 (fail-fast short-circuit 은 이미 cover, 정합-경로 순서-lock + reference-페어링 미cover). T-1056 daily-leg mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1058 — daily-step-dual-leg-run-report-issue-command-plan consistency-guard 재유도 2 builder 순서(descriptor → command-args) invocationCallOrder 순서-lock + 데이터-의존 reference-페어링 test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. consistency-guard 재유도 leg 은 leg 1(T-1054, result-report-plan-consistency 의 summary → descriptor), leg 2(T-1055, evaluation-plan-consistency 의 inputs → scoring-call-args fail-fast 게이트), leg 3(T-1056, result-issue-command-plan-consistency 의 report-plan → command-args), leg 4(T-1057, result-issue-publish-plan-consistency 의 command-plan → search-gh-argv)가 완료됐다.

**T-1057 Follow-up 이 지목한 나머지 consistency guard 를 pre-check 감사(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정했다.** Follow-up 이 명명한 후보 중 `realdata-e2e-run-plan-consistency.ts` 는 재유도가 **단일 builder**(`buildRealDataPipelinePlan` 만 재유도, run 은 입력 직접 대조)라 order-lock 불요로 확정 기록. 최고가치는 `realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` 의 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource`(L180~210)로, 재유도 단계가 **데이터-의존 chain 을 이룬 2 distinct builder** 다(둘째가 첫째 산출을 source 로 소비 — T-1056 의 daily-leg mirror, 최고가치 패턴):

- L192~193: `const expectedDescriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` — descriptor 위임 재유도(builder ①)
- L194~195: `const expectedCommandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor)` — command-args 위임 재유도(builder ②), **builder ① 산출 `expectedDescriptor` 를 인자로 소비**

즉 두 builder 는 `descriptor → command-args` **순서에 의미가 있다**: builder ②가 builder ① 산출(`expectedDescriptor`)을 source 로 쓰므로 descriptor 재유도가 반드시 먼저 완료돼야 command-args 재유도에 도달한다(데이터-의존 chain). 이는 T-1056(result-issue-command-plan-consistency 재유도 report-plan→command-args)의 **daily-leg sibling consistency-guard leg** 이다.

현행 spec(`realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts`, 550줄)은 happy-path void·구성요소 drift RangeError·구조 결손 TypeError·구성요소 type 위반 TypeError·**재유도 chain throw 전파(L436 command-args spyOn throw 전파)**·**fail-fast short-circuit(L460 descriptor 재유도 throw → command-args 미호출, L482 구조 위반 → descriptor 미호출)**·결정성/비변형은 이미 검증한다. 그러나 두 재유도 builder(descriptor → command-args)의 **정합-경로 상대 호출 순서(`invocationCallOrder` 부등식)와 데이터-의존 방향(builder ②가 builder ① 산출 descriptor 를 소비)은 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인). 따라서 guard 재유도 본문에서 실수로 두 재유도를 재정렬(command-args 를 descriptor 보다 먼저 재유도)하거나 builder ②의 인자를 builder ① 산출이 아닌 다른 값으로 바꿔도(deep-equal 은 순서-무관이라 최종 verdict 는 통과할 수 있는 경로) 검출되지 않는다. spec 은 이미 두 builder module namespace(`descriptorModule` L30·`commandArgsModule` L26)를 import 해 spyOn 배선 인프라를 갖췄으므로, 정합-경로 순서-lock + reference-페어링 test 만 추가하면 이 gap 이 봉해진다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**. 이미 `import * as commandArgsModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args"`(L26)·`import * as descriptorModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor"`(L30) namespace import 를 보유하므로 신규 import 불요 — 두 namespace 프로퍼티(`descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor` · `commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs`)에 `jest.spyOn` 을 건다. 기존 fixture(`makeReport` L34·`HAPPY_REPORT` L53·`makePlan` L57 로 만든 정합 plan)를 재유도 트리거 입력으로 재사용. 최상위 `afterEach(jest.restoreAllMocks)`(L64)가 spy 격리를 이미 보장. 기존 "위임 순차 순서 / short-circuit (spyOn)" describe(L459~500)를 선례 위치로 삼되, 그 안의 기존 fail-fast test(L460 descriptor throw → command-args 미호출)는 **유지**하고 정합-경로 순서-lock + reference-페어링 + 후속-throw 순서 재확인 test 를 **신규 추가**한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource` L180~210: (1) 구조 guard(L186 `assertPlanStructure`) → (2) `const expectedDescriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(L192~193, builder ①) → (3) `const expectedCommandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor)`(L194~195, builder ② — builder ① 산출 expectedDescriptor 소비) → (4) descriptor deep-equal(L198) → (5) commandArgs deep-equal(L205). ⚠️ 순서-lock 은 이 `descriptor → command-args` 재유도 순서 + 데이터-의존(builder ②가 builder ① 산출 `expectedDescriptor` 를 인자로 소비)을 못박는다. reference-페어링 assert 대상은 `commandArgsSpy.mock.calls[0][0]` === `descriptorSpy.mock.results[0].value`(builder ①은 descriptor 객체를 직접 반환하므로 destructuring 없이 반환값 전체가 인자).
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts`(T-1056 산물) — consistency-guard 재유도 2-delegate 데이터-의존 순서-lock 의 pass-through `jest.spyOn`(mockImplementation 없이 원 구현 통과) + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 둘째 위임 인자가 첫째 산출임을 확인하는 reference-페어링 assert + 후속 위임 throw → 첫째 1회(순서 재확인) 구조 선례. 본 task 를 이 sibling leg 로 mirror(대상은 daily-step-dual-leg command-plan-consistency, builder ② 인자는 builder ① 반환값 descriptor 전체).

## Acceptance Criteria

- [ ] **정합-경로 재유도 순서-lock test 추가 (happy-path/flow)**: guard 재유도 두 builder 순서를 못박는 test 1개 추가 — descriptor 위임(`descriptorModule.buildRealDataDailyStepDualLegRunReportIssueDescriptor`)·command-args 위임(`commandArgsModule.buildRealDataDailyStepDualLegRunReportIssueCommandArgs`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, `makePlan()`(정합 plan)·`HAPPY_REPORT` 로 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource(plan, HAPPY_REPORT)`(재유도 트리거)을 1회 호출한 뒤 `descriptorSpy.mock.invocationCallOrder[0] < commandArgsSpy.mock.invocationCallOrder[0]` 부등식(descriptor → command-args 순서)을 `toBeLessThan` 으로 검증. 추가로 두 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회). ⚠️ plan 은 spy 설정 **전**에 `makePlan()` 으로 미리 만든다(makePlan 자체가 컴포저 chain 을 돌려 두 builder 를 호출하므로 spy 이후 생성 시 관측 오염 — L468 주석 선례).
- [ ] **데이터-의존 reference-페어링 assert 추가 (flow)**: 위 순서-lock test 안에서(또는 별도 test 로) command-args 위임이 descriptor 위임의 **반환값(descriptor 객체)을 인자로 소비**함을 assert — `commandArgsSpy.mock.calls[0][0]` 이 `descriptorSpy.mock.results[0].value` 와 동일(`toBe` 참조 동등 또는 `toEqual` deep 동등)임을 검증. builder ②의 첫 인자가 builder ① 산출 descriptor 임을 못박아 데이터-의존 chain 방향을 lock(T-1056 reference-페어링 선례 mirror).
- [ ] **error path/negative 보강 (fail-fast + 후속 위임 throw 순서 재확인)**: 두 negative case 를 확인/추가 —
  (a) **fail-fast 순서(descriptor 재유도 throw → command-args 미도달)**: 기존 L460 test(blankReport gitSha 공백 → descriptor 재유도 위임 throw → `commandArgsSpy` 미호출)가 이미 cover — 유지하고, 필요 시 `commandArgsSpy` 가 `toHaveBeenCalledTimes(0)` 임을 명시적으로 재확인. descriptor throw 를 pass-through 대신 `descriptorSpy.mockImplementation(() => { throw new Error("descriptor-boom"); })` 로 강제해 `toThrow(/descriptor-boom/)` + `commandArgsSpy` `toHaveBeenCalledTimes(0)` 를 검증하는 test 를 신규 추가해 순서-lock 의 데이터-의존 fail-fast 방향을 spy 주입으로도 못박는다(기존 report-경로 test 와 병존).
  (b) **후속-위임 throw 순서 재확인(command-args 재유도 throw → descriptor 이미 1회 호출)**: pass-through `descriptorSpy` 를 유지하고 `commandArgsSpy.mockImplementation(() => { throw new Error("commandargs-boom"); })` 로 둘째 위임을 throw 시킨 뒤(정합 plan·report 로 descriptor 재유도는 통과) guard 호출이 그 에러를 전파(`toThrow(/commandargs-boom/)`)하고, 이때 **descriptor 위임은 이미 호출됨**(`descriptorSpy` `toHaveBeenCalledTimes(1)` — 순서 상 descriptor 가 command-args 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 기존 L436(command-args throw 전파) test 는 descriptor 호출 횟수를 assert 하지 않으므로 본 항목이 순서 증거를 보강. 단일 negative 로 부족하지 않도록 (a)(b) 두 분기 각각 cover.
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/report mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -c invocationCallOrder test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` 가 0 → ≥1(정합-경로 순서-lock 부등식 실배선 확인).

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(descriptor → command-args)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataDailyStepDualLegRunReportIssueDescriptor` / `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` 위임 helper 로직·인자·guard 정책 변경.
- daily-step-dual-leg command-plan **컴포저**(`realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan.ts`)의 위임 순서 — 본 task 는 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource` **내부**의 두 builder 재유도만, 다른 층·다른 delegate.
- result-report-plan-consistency / evaluation-plan-consistency / result-issue-command-plan-consistency / result-issue-publish-plan-consistency 재유도 — 이미 T-1054~T-1057 이 cover(본 task 는 sibling consistency-guard leg 5, daily-leg 변형).
- `realdata-e2e-run-plan-consistency.ts`(단일 builder 재유도 — order-lock 불요 확정) 순서-lock — 본 감사에서 후보 제외 확정.
- 여타 daily-step-dual-leg 계열 consistency guard(descriptor-body / gh-command-plan / publish-plan / search-argv 등)의 재유도 순서-lock — 감사 결과 후순위. 후속 Follow-up 감사 대상.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) 본 task(daily-step-dual-leg command-plan-consistency 재유도 순서-lock) 완결 후 나머지 daily-step-dual-leg 계열 consistency guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. 남은 2+ distinct builder 데이터-의존 chain 후보: `realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` · `realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` · `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts` 등을 각 guard 본문의 재유도 데이터-의존 여부로 우선순위 재판정. 단일 builder 재유도·게이트 없는 상호-독립 병렬 재유도는 "order-lock 불요" 확정 기록.
