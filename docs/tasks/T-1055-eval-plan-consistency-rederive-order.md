---
id: T-1055
title: evaluation-plan consistency-guard(assertRealDataEvaluationPlanConsistentWithSources)의 2 distinct builder 재유도 순서(inputs → scoring-call-args) invocationCallOrder 순서-lock test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 2)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 115
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts
independentStream: realdata-e2e-evaluation-plan-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 2번째 leg (T-1054 result-report-plan-consistency 후속). T-1054 Follow-up 이 지목한 나머지 consistency guard 재유도 순서를 pre-check 감사 — evaluation-plan-consistency 가 유일하게 2 distinct builder(buildRealDataEvaluationInputs L207 → buildRealDataScoringCallArgs L221)를 순차 재유도하고 그 사이에 fail-fast 게이트(inputs deep-equal L211 이 callArgs 재유도보다 먼저)를 가진 실 gap(spec invocationCallOrder=0). T-1052 evaluation-plan 컴포저 inputs→scoring 순서-lock 의 guard-재유도 mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1055 — evaluation-plan consistency-guard 재유도 2 builder 순서(inputs → scoring-call-args) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리(T-1042/T-1043), from-output(T-1044), command-plan(T-1045/T-1046), gh-command-plan(T-1047/T-1048), publish-plan(T-1049/T-1050), descriptor(T-1051), evaluation-plan 컴포저(T-1052), step-args aggregator(T-1053), consistency-guard 재유도 첫 leg(T-1054, result-report-plan-consistency 의 summary → descriptor)이 완료됐다.

**T-1054 Follow-up 이 지목한 "나머지 consistency guard 의 재유도 delegate 순서를 pre-check 감사"를 수행 — 전 consistency-guard 인벤토리를 훑었다**. 전체 55개 `*-consistency.spec.ts` 중 `invocationCallOrder` 를 가진 것은 T-1054 산물(result-report-plan-consistency, 7건)뿐이고 나머지는 전부 0건이다. 이 중 **2 distinct builder 를 순차 재유도하는** guard 를 찾았다 — 최고가치는 `realdata-e2e-evaluation-plan-consistency.ts` 의 `assertRealDataEvaluationPlanConsistentWithSources`(L194~240)로, 재유도 단계가 **fail-fast 게이트를 낀 2 distinct builder** 다:

- L207: `const expectedInputs = buildRealDataEvaluationInputs(activities)` — inputs sub-composer 재유도(builder ①)
- L211: `if (!deepEqual(plan.inputs, expectedInputs)) throw new RangeError(...)` — inputs 정합 fail-fast 게이트
- L221: `const expectedCallArgs = buildRealDataScoringCallArgs(plan.inputs, modelId)` — callArgs sub-composer 재유도(builder ②)

즉 두 builder 는 `inputs → callArgs` **순서에 의미가 있다**: inputs 재유도 산출로 deep-equal 게이트(L211)를 먼저 통과해야 callArgs 재유도(L221)에 도달한다(fail-fast — inputs drift 시 callArgs 재유도 전에 RangeError 선전파). 이는 T-1052 가 lock 한 evaluation-plan **컴포저**(`buildRealDataEvaluationPlan` inputs→scoring 데이터-의존 chain)의 **guard-재유도 mirror** 이자, T-1054(result-report-plan-consistency 재유도 summary→descriptor)의 **sibling consistency-guard leg** 다.

현행 spec(`realdata-e2e-evaluation-plan-consistency.spec.ts`, 451줄)은 구조 결손 TypeError·inputs/callArgs drift RangeError·reference 페어링 깨짐·재유도 위임 throw 전파·결정성은 검증하나(L79~) 두 재유도 builder(inputs → callArgs)의 **상대 호출 순서와 fail-fast 방향(inputs 게이트가 callArgs 재유도보다 먼저)은 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인), 두 builder module namespace 를 spyOn 하는 지점 부재. 따라서 guard 재유도 본문에서 실수로 두 재유도를 재정렬(callArgs 를 inputs 게이트보다 먼저 재유도)하면 fail-fast 순서가 조용히 깨져도(deep-equal 은 순서-무관이라 최종 verdict 는 통과) 검출되지 않는다. production 무변경, test-only 1파일로 이 gap 을 봉한다.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**. 현행 import(L26~28)는 `buildRealDataEvaluationPlan`(정합 plan 합성용)·`assertRealDataEvaluationPlanConsistentWithSources`(SUT)를 named import 로 보유한다. **`jest.spyOn` 을 위해 두 builder 위임의 module namespace import 를 신규 추가**해야 한다: `import * as evaluationInputsModule from "./realdata-e2e-evaluation-inputs"`(export `buildRealDataEvaluationInputs`) · `import * as scoringCallArgsModule from "./realdata-e2e-scoring-call-args"`(export `buildRealDataScoringCallArgs`) — spyOn 은 namespace 객체 프로퍼티(`evaluationInputsModule.buildRealDataEvaluationInputs` · `scoringCallArgsModule.buildRealDataScoringCallArgs`)에 건다(선례: T-1046/T-1052/T-1054 의 named-import 위임에 spec 이 namespace import 추가해 spyOn — ts-jest 가 ESM named import 를 module 객체 프로퍼티 접근으로 컴파일하므로 소비 측 guard 호출이 spy 를 통과). 기존 fixture(정합 activities·modelId·`buildRealDataEvaluationPlan(...)` 으로 만든 plan)를 재유도 트리거 입력으로 재사용. 기존 negative describe(L145 inputs drift / L209 callArgs drift / L383 재유도 위임 throw 전파)를 선례로 삼되 spyOn 대상만 두 builder module 로 바꾼다. `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- `test/helpers/realdata-e2e-evaluation-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataEvaluationPlanConsistentWithSources` L194~240: (1) 구조 guard(L201~202) → (2) `const expectedInputs = buildRealDataEvaluationInputs(activities)`(L207, builder ①) → (3) inputs deep-equal fail-fast 게이트(L211) → (4) `const expectedCallArgs = buildRealDataScoringCallArgs(plan.inputs, modelId)`(L221, builder ②) → (5) callArgs deep-equal(L224) → (6) reference 페어링 loop(L233). ⚠️ 순서-lock 은 이 `inputs → callArgs` 재유도 순서 + fail-fast(inputs 게이트 통과 후에만 callArgs 재유도)를 못박는다. builder ②는 `plan.inputs`(guard 인자)를 source 로 쓰므로 builder ① 산출을 reference 로 소비하지는 않는다 — 따라서 reference-페어링 assert 는 하지 않고 **호출 순서(invocationCallOrder 부등식)와 호출 횟수(fail-fast)만** lock 한다.
- `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts`(T-1054 산물) — consistency-guard 재유도 2-delegate 순서-lock 의 pass-through `jest.spyOn` + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 첫 위임 throw → 둘째 0회(fail-fast) + 둘째 위임 throw → 첫째 1회(후속 throw 전파) 구조 선례. 본 task 를 이 sibling leg 로 mirror(대상은 evaluation-plan-consistency).

## Acceptance Criteria

- [ ] **재유도 순서-lock test 추가 (happy-path/flow)**: guard 재유도 두 builder 순서를 못박는 test 1개 추가 — inputs 위임(`evaluationInputsModule.buildRealDataEvaluationInputs`)·callArgs 위임(`scoringCallArgsModule.buildRealDataScoringCallArgs`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, 정합 activities·modelId 로 `buildRealDataEvaluationPlan(...)` plan 을 만든 뒤 `assertRealDataEvaluationPlanConsistentWithSources(plan, activities, modelId)`(재유도 트리거)을 1회 호출한 뒤 `inputsSpy.mock.invocationCallOrder[0] < callArgsSpy.mock.invocationCallOrder[0]` 부등식(inputs → callArgs 순서)을 `toBeLessThan` 으로 검증. 추가로 두 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회). `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- [ ] **error path/negative 보강 (fail-fast + 후속 위임 throw 전파)**: 두 negative case 추가 —
  (a) **fail-fast 순서(inputs 재유도 게이트 → callArgs 미도달)**: `inputsSpy.mockImplementation(() => { throw new Error("inputs-boom"); })` 로 첫 위임을 throw 시키고 guard 호출 시 그 에러가 선전파(`toThrow(/inputs-boom/)`)하며 **callArgs 위임이 `toHaveBeenCalledTimes(0)`**(inputs 먼저 순서로 인해 callArgs 재유도 미도달)임을 검증. 순서-lock 의 fail-fast 방향 못박기.
  (b) **후속-위임 throw 전파(callArgs 재유도 throw → inputs 이미 호출)**: pass-through inputsSpy 를 유지하고 `callArgsSpy.mockImplementation(() => { throw new Error("callargs-boom"); })` 로 둘째 위임을 throw 시킨 뒤(정합 plan·activities·modelId 로 inputs 게이트는 통과) guard 호출이 그 에러를 전파(`toThrow(/callargs-boom/)`)하고, 이때 **inputs 위임은 이미 호출됨**(`inputsSpy` `toHaveBeenCalledTimes(1)` — 순서 상 inputs 가 callArgs 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 단일 negative 로 부족하지 않도록 (a)(b) 두 분기 각각 cover(기존 L383 재유도 throw 전파 선례와 정합).
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/activities mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-evaluation-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -n "evaluationInputsModule\|scoringCallArgsModule" test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts` 가 1건 이상(이전 0건) — 두 builder 위임의 namespace spyOn 실배선 확인. `git grep -c invocationCallOrder test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts` 가 0 → ≥1.

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(inputs → callArgs)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataEvaluationInputs` / `buildRealDataScoringCallArgs` 위임 helper 로직·인자·guard 정책 변경.
- evaluation-plan **컴포저**(`realdata-e2e-evaluation-plan.ts`)의 inputs→scoring 위임 순서 — 이미 T-1052 가 lock(본 task 는 `assertRealDataEvaluationPlanConsistentWithSources` **내부**의 두 builder 재유도만, 다른 층·다른 delegate).
- result-report-plan-consistency 재유도(summary → descriptor) — 이미 T-1054 가 cover(본 task 는 sibling consistency-guard leg).
- reference-페어링 assert(첫 재유도 산출을 둘째가 소비) — 본 guard 의 callArgs 재유도는 builder ① 산출이 아니라 `plan.inputs` 를 source 로 쓰므로 두 재유도 간 reference 데이터-의존 부재. 순서(invocationCallOrder)·횟수(fail-fast)만 lock, reference 페어링은 대상 아님(guard 내부 plan.callArgs↔plan.inputs 페어링은 이미 기존 spec L268 이 cover).
- 여타 consistency guard(step-args-consistency / command-plan-consistency / publish-plan-consistency 등)의 재유도 순서-lock — 감사 결과 단일 builder 재유도 또는 상호-독립 재유도(fail-fast 게이트 없는 병렬 재유도)라 우선순위 낮음. 후속 Follow-up 감사 대상.
- evaluation-plan / publish-plan / command-plan / gh-command-plan / descriptor / from-output / step-args aggregator 순서-lock — 이미 T-1044~T-1053 이 cover.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) 본 task(evaluation-plan-consistency 재유도 순서-lock) 완결 후 나머지 consistency guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. fail-fast 게이트를 낀 순차 2 builder 재유도 또는 데이터-의존 chain(둘째가 첫째 산출 소비)을 가진 guard 를 우선, 단일 builder 재유도·게이트 없는 상호-독립 병렬 재유도는 defense-in-depth 가치가 낮으므로 후순위 또는 "order-lock 불요" 확정 기록.
