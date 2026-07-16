---
id: T-1052
title: 종단 evaluation-plan 컴포저의 2 sub-composer 위임 순서(buildRealDataEvaluationInputs → buildRealDataScoringCallArgs)를 invocationCallOrder 순서-lock test 로 못박기 (evaluation-plan delegate 순서-lock leg)
phase: P5
status: DONE
commitMode: pr
prNumber: 946
mergedAs: 29a1f8ae
reviewRounds: 1
completedAt: 2026-07-16T21:10:00Z
coversReq: [REQ-032, REQ-059]
estimatedDiff: 100
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-plan.spec.ts
independentStream: realdata-e2e-evaluation-plan
plannerNote: "P5 test-hardening — descriptor 축(T-1051) 완결 후 T-1051 Follow-up 이 지목한 orchestrator 컴포저 4종(result-summary/pipeline-plan/run-plan/evaluation-plan) 신규 감사. 4종 전부 spec invocationCallOrder=0. 그중 buildRealDataEvaluationPlan 이 유일하게 2 distinct sub-composer 위임(inputs→scoring, inputs 산출이 scoring 입력)을 순차 호출하는 데이터-의존 chain 이라 순서 부등식 lock 가치 최상(publish-plan T-1049/T-1050 의 commandPlan→searchGhArgv 데이터-의존 mirror). 기존 spec 은 T-0682 self-wire 가드(consistency) spyOn 뿐 — 두 builder 위임 상대 호출 순서 미lock. 한 부등식 lock. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1052 — 종단 evaluation-plan 컴포저 2 sub-composer 위임 순서(inputs → scoring) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저가 자기 산출 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리(T-1042/T-1043), from-output(T-1044), command-plan daily·summary(T-1045/T-1046), gh-command-plan(resolve) daily·summary(T-1047/T-1048), publish-plan daily·summary(T-1049/T-1050), descriptor body-합성(T-1051)이 완료됐다.

T-1051 Follow-up 이 다음 감사 지점으로 지목한 상위 orchestrator 컴포저 4종(`realdata-e2e-result-summary.ts` · `realdata-e2e-pipeline-plan.ts` · `realdata-e2e-run-plan.ts` · `realdata-e2e-evaluation-plan.ts`)을 신규 감사했다(pre-check: 4종 전부 spec `invocationCallOrder` = 0건). 그중:

- `result-summary` / `pipeline-plan` / `run-plan` 은 자기 산출 경로에서 **단일 builder 위임 + self-wire 가드 1개**만 순차 호출한다(builder→guard 는 이미 T-0680/T-0682 계열 self-wire 가 값-대조로 cover, 2 distinct **builder** chain 없음).
- **`buildRealDataEvaluationPlan(activities, modelId)` 는 유일하게 두 distinct sub-composer builder 를 순차 호출**한다 — (1) `buildRealDataEvaluationInputs(activities)` → `inputs` (2) `buildRealDataScoringCallArgs(inputs, modelId)` → `callArgs`. **(2) 는 (1) 의 산출 `inputs` 를 첫 인자로 받는 데이터-의존 chain** 이므로 inputs 가 먼저 평가돼야만 scoring 위임이 성립한다(publish-plan 축 T-1049/T-1050 의 commandPlan→searchGhArgv 데이터-의존 mirror).

**현행 spec 은 두 builder 산출이 plan 에 byte-identical 로 박히는지(값 대조)와 self-wire 가드(`assertRealDataEvaluationPlanConsistentWithSources`, T-0682) 배선은 검증하나, 두 builder 위임의 상대 호출 순서(inputs → scoring)는 못박지 않는다** — spec 의 spyOn 지점은 `consistency` 네임스페이스 1개뿐이고 두 builder module namespace 를 spyOn 하는 지점은 부재(pre-check 확인). 따라서 컴포저 본문에서 실수로 두 위임 평가 순서를 재정렬하는 회귀가 발생해도(값 대조는 순서 무관이라 통과) 순서 부등식 test 가 없다. production 무변경, test-only 1파일로 이 gap 을 봉한다.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-plan.spec.ts` — 본 task 가 수정할 유일 파일. 현행 import 는 `buildRealDataEvaluationInputs` 를 **named import**(L20)로 보유하고 `buildRealDataScoringCallArgs` 는 spec 에 **미 import**(컴포저 내부 위임)다. **`jest.spyOn` 을 위해 두 builder 위임의 module namespace import 를 신규 추가**해야 한다(예: `import * as evaluationInputsModule from "./realdata-e2e-evaluation-inputs"` · `import * as scoringCallArgsModule from "./realdata-e2e-scoring-call-args"`) — 기존 named import 는 그대로 두고 spyOn 은 namespace 객체 프로퍼티(`evaluationInputsModule.buildRealDataEvaluationInputs` · `scoringCallArgsModule.buildRealDataScoringCallArgs`)에 건다. 기존 fixture `MODEL_ID`(L24)·`mixedActivities()`(L69)·`COMMIT`(L27) 재사용. 기존 T-0682 self-wire 가드 describe(L212~, `jest.spyOn(consistency, "assertRealDataEvaluationPlanConsistentWithSources")` + `afterEach(jest.restoreAllMocks)`)를 새 delegate 순서-lock describe 의 spyOn/restore 구조 선례로 삼되, spyOn 대상만 두 builder module 로 바꾼다.
- `test/helpers/realdata-e2e-evaluation-plan.ts` — 컴포저 위임 지점 확인용(수정 금지). `buildRealDataEvaluationPlan` L76~99: **(1) `const inputs = buildRealDataEvaluationInputs(activities)`(L81) → (2) `const callArgs = buildRealDataScoringCallArgs(inputs, modelId)`(L84, inputs 데이터-의존) → self-wire 가드 `assertRealDataEvaluationPlanConsistentWithSources(plan, activities, modelId)`(L97) → `return plan`**. ⚠️ (2) 는 (1) 의 산출 `inputs` 를 첫 인자로 받으므로 inputs 위임이 **반드시 먼저** 평가돼야 한다 — 순서-lock 은 이 데이터-의존 좌→우 평가 순서를 못박는 defense-in-depth 다. modelId 빈/공백은 (2) `buildRealDataScoringCallArgs` guard 가 throw(자체 try/catch 없이 전파, L69 주석).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan.spec.ts`(T-1049 산물) — 데이터-의존 2-delegate 순서-lock(commandPlan → searchGhArgv, 산출이 다음 입력)의 pass-through `jest.spyOn` + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식 + fail-fast(첫 위임 throw → 둘째 0회) 구조 선례. 본 task 를 이 축으로 mirror.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: 컴포저 두 builder 위임 순서를 못박는 test 1개 추가 — inputs 위임(`evaluationInputsModule.buildRealDataEvaluationInputs`)·scoring 위임(`scoringCallArgsModule.buildRealDataScoringCallArgs`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고 `buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID)`(재사용 fixture)을 1회 호출한 뒤 `inputsSpy.mock.invocationCallOrder[0] < scoringSpy.mock.invocationCallOrder[0]` 부등식(inputs → scoring 순서)을 `toBeLessThan` 으로 검증. 추가로 inputs 위임이 `(activities)` 인자로, scoring 위임이 `(inputs, MODEL_ID)` 인자(scoring 첫 인자가 inputs 위임의 반환값과 reference 동일 — 데이터-의존 못박기)로 각각 정확히 1회(`toHaveBeenCalledTimes(1)`) 호출됨을 assert. `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- [ ] **error path/negative 보강 (fail-fast + guard-throw 전파)**: 두 negative case 추가 —
  (a) **fail-fast 순서**: inputs 위임을 `mockImplementation(() => { throw ... })` 로 강제 throw 시키고 `buildRealDataEvaluationPlan(mixedActivities(), MODEL_ID)` 호출이 그 에러를 선전파(`toThrow`)하며 **scoring 위임이 `toHaveBeenCalledTimes(0)`**(inputs 먼저 순서로 인해 scoring 위임 미도달)임을 검증. 순서-lock 의 fail-fast 방향 못박기.
  (b) **guard-throw 전파**: 실 guard 분기 — `MODEL_ID` 대신 빈 문자열(또는 공백) `modelId` 로 호출 시 scoring 위임(`buildRealDataScoringCallArgs`) guard 가 throw 해 컴포저가 그 에러를 전파(`toThrow`)하고, 이때 **inputs 위임은 이미 호출됨**(`inputsSpy` `toHaveBeenCalledTimes(1)` — 순서 상 inputs 가 scoring 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 단일 negative 만으로 부족하지 않도록 (a)(b) 두 분기 각각 cover.
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 산출 `plan` 이 순서-검증 전후 정합(`{ inputs, callArgs }` 필드만 보유, `callArgs[i].input === inputs[i]` reference 페어링 보존 — 기존 값 대조 test 와 정합)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-evaluation-plan.ts` 및 여타 producer/guard/builder/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -n "evaluationInputsModule\|scoringCallArgsModule" test/helpers/realdata-e2e-evaluation-plan.spec.ts` 가 1건 이상(이전 0건) — 두 builder 위임의 namespace spyOn 실배선 확인. `git grep -c invocationCallOrder test/helpers/realdata-e2e-evaluation-plan.spec.ts` 가 0 → ≥1.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(inputs → scoring)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataEvaluationInputs` / `buildRealDataScoringCallArgs` 위임 helper 로직·인자·guard 정책 변경.
- self-wire 가드(`assertRealDataEvaluationPlanConsistentWithSources`) 배선·순서-lock — 이미 T-0682 이 cover(본 task 는 두 builder delegate 쌍만).
- result-summary / pipeline-plan / run-plan 컴포저 순서-lock — 감사 결과 2 distinct builder chain 부재(builder→guard 단일 위임, self-wire 가 이미 cover). 본 task 대상 아님.
- resolve...GhCommandPlan / command-plan / publish-plan / descriptor 컴포저 순서-lock — 이미 T-1045~T-1051 이 cover.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) evaluation-plan delegate 순서-lock(본 task) 완결로 T-1051 Follow-up 이 지목한 orchestrator 4종 감사 종료(result-summary/pipeline-plan/run-plan 은 2-builder chain 부재로 순서-lock 불요 확정). 다음 sweep 확장 지점은 아직 미감사인 seed-side / collect-side 컴포저(`realdata-e2e-seed-collect-call-args.ts` · `realdata-e2e-evaluation-inputs.ts` 등)가 2+ distinct delegate 순차 호출을 갖는지 pre-check(각 spec invocationCallOrder 0건 여부 + 함수 본문 위임 개수)로 판정.
