---
id: T-1053
title: 종단 step-args aggregator(buildRealDataE2eStepArgs)의 2 sub-composer 위임 순서(evaluation → publish) invocationCallOrder 순서-lock test 로 못박기 (step-args aggregator delegate 순서-lock leg)
phase: P5
status: DONE
completedAt: 2026-07-16T21:41:00Z
prNumber: 947
squashCommit: e570e42a
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 105
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-step-args.spec.ts
independentStream: realdata-e2e-step-args
plannerNote: "P5 test-hardening — evaluation-plan(T-1052) 완결 후 T-1052 Follow-up 이 지목한 seed/collect-side 신규 감사. seed-collect-call-args·evaluation-inputs 는 single-builder+self-wire guard 라 order-lock 불요 확정(builder→guard 는 구조적 순서 implied). 신규 인벤토리 감사로 buildRealDataE2eStepArgs aggregator 채택 — 2 distinct sub-composer builder(evaluation→publish) 순차 위임 + spec invocationCallOrder 0 실 gap. 기존 spec 은 consistency self-wire guard spyOn 뿐, 두 builder 상대 호출 순서 미lock. 한 부등식 lock. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1053 — 종단 step-args aggregator 2 sub-composer 위임 순서(evaluation → publish) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리(T-1042/T-1043), from-output(T-1044), command-plan(T-1045/T-1046), gh-command-plan(T-1047/T-1048), publish-plan(T-1049/T-1050), descriptor(T-1051), evaluation-plan(T-1052)이 완료됐다.

T-1052 Follow-up 이 다음 감사 지점으로 지목한 seed-side / collect-side 컴포저를 신규 감사했다:

- `realdata-e2e-seed-collect-call-args.ts`(`buildRealDataCollectCallArgs`) · `realdata-e2e-evaluation-inputs.ts`(`buildRealDataEvaluationInputs`) 등은 **single-builder 위임 + self-wire 가드 1개**만 순차 호출한다(builder→guard 는 guard 가 builder 산출을 입력으로 받아 구조적으로 순서가 implied, 2 distinct **builder** chain 부재). 따라서 order-lock 불요(orchestrator 3종 T-1052 감사와 동형 결론).
- 신규 인벤토리 감사로 **`buildRealDataE2eStepArgs(runPlan, activities, results)` aggregator 채택** — 두 distinct sub-composer builder 를 순차 위임한다: (1) `buildRealDataEvaluationStepArgs(runPlan, activities)` → `evaluation` (2) `buildRealDataResultPublishStepArgs(runPlan, results)` → `publish`. 두 builder 는 각각 별개 module(`realdata-e2e-evaluation-step-args` · `realdata-e2e-result-publish-step-args`)에서 export 돼 namespace spyOn 가능. 동일 `runPlan` 이 두 step 에 동시 thread 되나(둘 다 runPlan 을 첫 인자로 받음, evaluation 산출이 publish 입력이 아님 — T-1052 evaluation-plan 의 데이터-의존 chain 과 달리 두 builder 는 상호 독립) **호출 순서는 evaluation → publish 로 고정**돼 있고, 컴포저 본문 주석(L145)이 "modelId guard throw → publish 위임 미도달"을 fail-fast 계약으로 명시한다.

**현행 spec 은 두 builder 산출이 컨테이너에 deep-equal 로 박히는지(값 대조, L149~L172)와 self-wire 가드(`assertRealDataE2eStepArgsConsistentWithSources`, T-0672) 배선/미도달(L440·L520·L537·L554)은 검증하나, 두 builder 위임의 상대 호출 순서(evaluation → publish)는 못박지 않는다** — spec 의 spyOn 지점은 `consistency` 네임스페이스 1개뿐이고(pre-check: 해당 spec `invocationCallOrder` = 0건) 두 builder module namespace 를 spyOn 하는 지점은 부재. 따라서 aggregator 본문에서 실수로 두 위임 평가 순서를 재정렬하는 회귀가 발생해도(값 대조는 순서 무관이라 통과, 두 builder 가 상호 독립이라 최종 컨테이너도 동일) fail-fast 계약(evaluation-first, modelId-empty 시 publish 미도달)이 조용히 깨진다. production 무변경, test-only 1파일로 이 gap 을 봉한다.

## Required Reading

- `test/helpers/realdata-e2e-step-args.spec.ts` — 본 task 가 수정할 유일 파일. 현행 import 는 두 builder 를 **named import**(L33 `buildRealDataEvaluationStepArgs`, L35 `buildRealDataResultPublishStepArgs`)로 보유하고 consistency 는 namespace import(L38 `import * as consistency`)다. **`jest.spyOn` 을 위해 두 builder 위임의 module namespace import 를 신규 추가**해야 한다(예: `import * as evaluationStepArgsModule from "./realdata-e2e-evaluation-step-args"` · `import * as resultPublishStepArgsModule from "./realdata-e2e-result-publish-step-args"`) — 기존 named import 는 그대로 두고 spyOn 은 namespace 객체 프로퍼티(`evaluationStepArgsModule.buildRealDataEvaluationStepArgs` · `resultPublishStepArgsModule.buildRealDataResultPublishStepArgs`)에 건다. 기존 fixture `MODEL_ID`(L41)·`makeRunPlan()`(L51)·`mixedActivities()`(L107)·`SINGLE_RESULTS`/`MULTIPLE_RESULTS` 재사용. 기존 self-wire 가드 describe(L436~, `jest.spyOn(consistency, "assertRealDataE2eStepArgsConsistentWithSources")` + `afterEach(jest.restoreAllMocks)`, L520/L537/L554 의 위임-throw→가드-미도달 negative)를 새 delegate 순서-lock describe 의 spyOn/restore 구조 선례로 삼되, spyOn 대상만 두 builder module 로 바꾼다.
- `test/helpers/realdata-e2e-step-args.ts` — aggregator 위임 지점 확인용(수정 금지). `buildRealDataE2eStepArgs` L138~172: **(1) `const evaluation = buildRealDataEvaluationStepArgs(runPlan, activities)`(L146) → (2) `const publish = buildRealDataResultPublishStepArgs(runPlan, results)`(L151) → 컨테이너 합성(L155) → self-wire 가드 `assertRealDataE2eStepArgsConsistentWithSources(stepArgs, runPlan, activities, results)`(L164) → `return stepArgs`**. ⚠️ (2) 는 (1) 의 산출에 데이터-의존하지 **않는다**(둘 다 `runPlan` 을 첫 인자로 받는 상호 독립 위임) — 그러나 호출 순서는 evaluation → publish 로 고정돼 있고 modelId 빈/공백 runPlan 은 (1) evaluation 위임 guard 가 throw 해 publish 위임 미도달(L145 주석), gitSha/dateToken 빈/공백은 (2) publish 위임 guard 가 throw(L149 주석). 순서-lock 은 이 좌→우 평가 순서 + fail-fast 계약을 못박는 defense-in-depth 다.
- `test/helpers/realdata-e2e-evaluation-plan.spec.ts`(T-1052 산물) 또는 `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts`(T-1049 산물) — 2-delegate 순서-lock 의 pass-through `jest.spyOn` + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + fail-fast(첫 위임 throw → 둘째 0회) 구조 선례. 본 task 를 이 축으로 mirror(단, 두 builder 는 상호 독립이라 데이터-의존 reference 페어링 assert 는 생략).

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: aggregator 두 builder 위임 순서를 못박는 test 1개 추가 — evaluation 위임(`evaluationStepArgsModule.buildRealDataEvaluationStepArgs`)·publish 위임(`resultPublishStepArgsModule.buildRealDataResultPublishStepArgs`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `buildRealDataE2eStepArgs(makeRunPlan(), mixedActivities(), MULTIPLE_RESULTS)`(재사용 fixture)을 1회 호출한 뒤 `evaluationSpy.mock.invocationCallOrder[0] < publishSpy.mock.invocationCallOrder[0]` 부등식(evaluation → publish 순서)을 `toBeLessThan` 으로 검증. 추가로 evaluation 위임이 `(runPlan, activities)` 인자로, publish 위임이 `(runPlan, results)` 인자로 각각 정확히 1회(`toHaveBeenCalledTimes(1)`) 호출됨을 assert(두 위임 모두 첫 인자가 같은 `runPlan` reference — 단일 runPlan 동시 thread 못박기). `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- [ ] **error path/negative 보강 (fail-fast + guard-throw 전파)**: 두 negative case 추가 —
  (a) **fail-fast 순서(evaluation 위임 throw → publish 미도달)**: `makeRunPlan("   ")`(modelId 공백-only)로 호출 시 evaluation 위임 guard 가 throw 해 aggregator 가 그 에러를 선전파(`toThrow(/modelId/)`)하며 **publish 위임이 `toHaveBeenCalledTimes(0)`**(evaluation 먼저 순서로 인해 publish 위임 미도달)임을 검증. 순서-lock 의 fail-fast 방향 못박기.
  (b) **후속-위임 throw 전파(publish 위임 throw → evaluation 이미 호출)**: `makeRunPlan(MODEL_ID, { gitSha: "  ", dateToken: "2026-06-23" })`(gitSha 공백-only)로 호출 시 publish 위임(`buildRealDataResultPublishStepArgs`) guard 가 throw 해 aggregator 가 그 에러를 전파(`toThrow(/gitSha/)`)하고, 이때 **evaluation 위임은 이미 호출됨**(`evaluationSpy` `toHaveBeenCalledTimes(1)` — 순서 상 evaluation 이 publish 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 단일 negative 만으로 부족하지 않도록 (a)(b) 두 분기 각각 cover.
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 산출 컨테이너가 순서-검증 전후 정합(`{ evaluation, publish }` 필드만 보유, 두 field 가 각 위임의 반환 reference 와 동일 — 기존 값 대조 test 와 정합)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-step-args.ts` 및 여타 producer/guard/builder/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -n "evaluationStepArgsModule\|resultPublishStepArgsModule" test/helpers/realdata-e2e-step-args.spec.ts` 가 1건 이상(이전 0건) — 두 builder 위임의 namespace spyOn 실배선 확인. `git grep -c invocationCallOrder test/helpers/realdata-e2e-step-args.spec.ts` 가 0 → ≥1.

## Out of Scope

- aggregator `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(evaluation → publish)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataEvaluationStepArgs` / `buildRealDataResultPublishStepArgs` 위임 helper 로직·인자·guard 정책 변경.
- self-wire 가드(`assertRealDataE2eStepArgsConsistentWithSources`) 배선·순서-lock — 이미 T-0672 이 cover(본 task 는 두 builder delegate 쌍만).
- seed-collect-call-args / evaluation-inputs / orchestrator(result-summary/pipeline-plan/run-plan) 컴포저 순서-lock — 감사 결과 single-builder+self-wire guard 라 2 distinct builder chain 부재. 본 task 대상 아님.
- evaluation-plan / publish-plan / command-plan / gh-command-plan / descriptor / from-output 컴포저 순서-lock — 이미 T-1044~T-1052 이 cover.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) step-args aggregator delegate 순서-lock(본 task) 완결 후 다음 sweep 확장 지점은 evaluation-step-args / result-publish-step-args 각 sub-composer 자체가 2+ distinct delegate 순차 호출을 갖는지 pre-check(각 spec invocationCallOrder 0건 여부 + 함수 본문 위임 개수)로 판정. sub-composer 가 단일 builder+guard 만이면 order-lock 불요(구조적 순서 implied) 확정.
