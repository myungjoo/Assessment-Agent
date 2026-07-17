---
id: T-1064
title: step-args consistency-guard(assertRealDataE2eStepArgsConsistentWithSources)의 2 distinct sub-composer 재유도 fail-fast 순서(evaluation → publish) invocationCallOrder 순서-lock test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 11 — aggregator fail-fast-sequential)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-step-args-consistency.spec.ts
independentStream: realdata-e2e-step-args-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 11번째 leg (T-1054~T-1063 후속). result-issue·daily-step-dual-leg 계열의 데이터-의존 delegate chain guard(command-plan/publish-plan/gh-command-plan/outcome-report-from-output)는 leg 1~10에서 소진 확정. leg 11은 broader realdata-e2e 로 확장 — step-args aggregator guard(assertRealDataE2eStepArgsConsistentWithSources L194~)가 2 distinct sub-composer(buildRealDataEvaluationStepArgs L210 → buildRealDataResultPublishStepArgs L214)를 fail-fast 순차(evaluation 재유도가 publish 재유도보다 먼저 평가 — eval throw 시 publish 미도달)로 재호출하나 spec invocationCallOrder=0. 데이터-의존 chain 이 아닌 aggregator fail-fast-sequential 순서-lock(reference-페어링 없음). pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1064 — step-args consistency-guard 재유도 2 sub-composer fail-fast 순서(evaluation → publish) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. consistency-guard 재유도 leg 은 leg 1~10(T-1054~T-1063)이 result-report-plan / evaluation-plan / result-issue-command-plan / result-issue-publish-plan / daily-step-dual-leg-command-plan / daily-step-dual-leg-publish-plan / daily-step-dual-leg-gh-command-plan / daily-step-dual-leg-outcome-report-from-output / result-issue-outcome-report-from-output / result-issue-gh-command-plan 을 각각 cover 하며 완료됐다.

**result-issue·daily-step-dual-leg 계열의 "데이터-의존 delegate chain" consistency guard 는 leg 10(T-1063)에서 소진 확정됐다** — command-plan / publish-plan / gh-command-plan / outcome-report-from-output 은 순서-lock 배선(각 spec `invocationCallOrder` ≥ 7)이 끝났고, 나머지 0-count result-issue/daily-leg consistency spec(action / command-args / descriptor-body / descriptor-identity / gh-argv / outcome-report-output / outcome-report-summary-line / output-parse / search-argv / search-parse)은 guard 본문이 **inline 독립 재유도**(`reDeriveExpected*` / `composeExpected*` — 위임 빌더 재호출 0) 또는 **단일 delegate 재유도**(예: evaluation-step-args / pipeline-plan / run-plan / result-outcome-step-args / result-publish-step-args 는 각 1개 builder 만 재호출)라 pre-check 조건 "2+ distinct delegate builder 순서-lock" 을 충족하지 못한다.

따라서 leg 11 은 T-1063 Follow-up 지침대로 broader realdata-e2e 스위트에서 next-best delegate 기반 guard 로 확장한다. 전역 감사 결과 **step-args aggregator consistency guard `assertRealDataE2eStepArgsConsistentWithSources`(`realdata-e2e-step-args-consistency.ts` L194~)가 적격**임을 확인했다 — 이 guard 는 2개의 distinct sub-composer 위임을 **직접** 재호출한다:

- L210~213: `const expectedEvaluation = buildRealDataEvaluationStepArgs(runPlan, activities)` — 평가 step-args 재유도(sub-composer ①). 먼저 평가된다.
- L214: `const expectedPublish = buildRealDataResultPublishStepArgs(runPlan, results)` — publish step-args 재유도(sub-composer ②). ① 다음 statement 로 평가된다.

**중요한 성질 구분** — 본 leg 은 leg 1~10 의 "데이터-의존 chain"(뒤 builder 가 앞 builder 산출을 첫 인자로 소비)과는 **다른 flavor 인 aggregator fail-fast-sequential 순서-lock** 이다. 두 sub-composer 는 서로의 산출을 소비하지 않고(둘 다 `runPlan` 을 별도 인자로 받음 — ① 은 `activities`, ② 는 `results`) **데이터상 병렬**이다. 따라서 **reference-페어링(뒤 builder 첫 인자 === 앞 builder 산출) assert 는 적용하지 않는다**. 대신 guard 본문의 **순차 fail-fast 계약**을 못박는다 — guard 주석(L206~209)과 기존 throw-전파 test(spec L482~530)가 명시하듯 "evaluation 재유도가 publish 재유도보다 먼저 평가되므로 modelId 미결정은 run 유효 여부와 무관하게 먼저 차단된다"(eval 위임이 throw 하면 publish 위임은 도달조차 하지 않음). 이 순서(① eval before ② publish)는 **관측 가능한 행동 계약**이다: 만약 실수로 두 재호출을 재정렬하면, eval-drift 와 publish-drift 를 동시에 가진 입력에서 surface 되는 에러(어느 하위 guard throw / 어느 RangeError)가 바뀌므로 fail-fast 방향이 뒤집힌다.

현행 spec(`realdata-e2e-step-args-consistency.spec.ts`, 606줄)은 happy-path void·구성요소 drift RangeError(evaluation/publish 각각)·구조 결손 TypeError·type 위반·**위임 throw 전파**(L482~530: modelId 공백 → eval throw / gitSha·dateToken 공백 → publish throw)·결정성·비변형을 이미 검증한다. 그러나 두 sub-composer 재유도의 **정합-경로 상대 호출 순서(`invocationCallOrder` 부등식 1개: eval < publish)와 fail-fast 방향(eval throw → publish 미도달)은 `invocationCallOrder`/spy 로 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인). 기존 throw-전파 test 는 실 입력으로 throw 행동만 확인할 뿐 두 위임의 **호출 순서·호출 횟수**를 spy 로 lock 하지 않으므로, 재정렬 회귀(예: publish 를 먼저 재호출)를 검출하지 못한다. 현행 spec 은 아직 두 sub-composer 를 namespace 로 import 하지 않고 spyOn 배선이 없으므로, 두 delegate 의 namespace import + 정합-경로 순서-lock(1 edge) + fail-fast(양방향) test 를 추가해 이 gap 을 봉한다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-step-args-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**(606줄). 현재 두 sub-composer 를 namespace 로 import 하지 **않으므로**(L25 은 aggregator `buildRealDataE2eStepArgs` · guard 자체만 import) **신규 namespace import 2줄 추가**가 필요하다:
  - `import * as evaluationStepArgsModule from "./realdata-e2e-evaluation-step-args"` (프로퍼티 `buildRealDataEvaluationStepArgs`)
  - `import * as publishStepArgsModule from "./realdata-e2e-result-publish-step-args"` (프로퍼티 `buildRealDataResultPublishStepArgs`)

  두 namespace 프로퍼티에 `jest.spyOn` 을 건다. 기존 fixture(`makeRunPlan()` L58 · `makeStepArgs(runPlan, activities, results)` L119 · `HAPPY_ACTIVITIES` · `HAPPY_RESULTS` 상수)로 정합 stepArgs 를 만든다 — ⚠️ **`makeStepArgs()` 가 aggregator(`buildRealDataE2eStepArgs`)를 돌려 두 sub-composer 를 호출하므로 spy 설정 전에 미리 stepArgs 를 만든다**(spy 이후 생성 시 관측 오염 — T-1060/T-1062/T-1063 선례). 최상위 `afterEach`/`restoreAllMocks` **현재 없으므로 최상위(top-level `describe` 바로 안 또는 파일 상단)에 추가**(spy 격리 필수 — 없으면 후속 test 오염). 기존 "재유도 위임 throw 전파 — 가드가 삼키지 않음 (branch cover)" describe(L482~530) 를 선례 위치로 삼되 그 안의 기존 throw-전파 test 는 **유지**하고, `evaluation → publish` 정합-경로 순서-lock(1 edge) + fail-fast(양방향) test 를 **신규 추가**한다(새 describe 블록 권장 — T-1060/T-1063 spec 의 "재유도 위임 순서-lock" describe 를 모델로).
- `test/helpers/realdata-e2e-step-args-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataE2eStepArgsConsistentWithSources` L194~: (1) 구조 guard(L202~203 `assertStepArgsStructure` / `assertRunPlanStructure` → TypeError) → (2) `buildRealDataEvaluationStepArgs(runPlan, activities)`(L210) → `buildRealDataResultPublishStepArgs(runPlan, results)`(L214) 2 sub-composer 재유도(순차 statement) → (3) evaluation drift 비교(L219~) → publish drift 비교(L225~). ⚠️ 순서-lock 은 이 `evaluation → publish` 재유도 순서(1 edge, JS statement 순차 평가상 eval 이 publish 보다 먼저) + fail-fast(eval 위임 throw → publish 위임 미도달)를 못박는다. **reference-페어링 없음**(두 위임은 데이터-의존이 아니라 각각 `runPlan` 을 독립 소비 — 병렬 데이터, 순차 fail-fast 평가).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts`(T-1063 산물, 및 T-1060 daily-leg mirror) — 본 task 의 **선례 패턴**. consistency-guard 재유도 순서-lock 의 pass-through `jest.spyOn`(mockImplementation 없이 원 구현 통과) + `spyA.mock.invocationCallOrder[0] < spyB.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 각 위임 `toHaveBeenCalledTimes(1)` + fail-fast(앞 위임 throw → 뒤 위임 미도달) + 후속-위임 throw(뒤 위임 throw → 앞 위임 이미 1회, 순서 재확인) 구조 선례. 본 task 는 3-builder(2-edge) 선례를 **2-sub-composer(1-edge) aggregator fail-fast** 로 축소 적용하고 reference-페어링 2개는 **적용하지 않는다**(데이터-의존 아님).

## Acceptance Criteria

- [ ] **정합-경로 재유도 순서-lock test 추가 (happy-path/flow, 1 edge)**: guard 재유도 두 sub-composer 순서를 못박는 test 1개 추가 — evaluation 위임(`evaluationStepArgsModule.buildRealDataEvaluationStepArgs`)·publish 위임(`publishStepArgsModule.buildRealDataResultPublishStepArgs`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, spy 설정 **전**에 미리 만든 정합 stepArgs(`makeStepArgs()`)·같은 `runPlan`/`activities`/`results` 로 `assertRealDataE2eStepArgsConsistentWithSources(stepArgs, runPlan, activities, results)`(재유도 트리거)을 1회 호출한 뒤 부등식 `evalSpy.mock.invocationCallOrder[0] < publishSpy.mock.invocationCallOrder[0]`(edge 1개)을 `toBeLessThan` 으로 검증. 추가로 두 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회).
- [ ] **fail-fast edge test 추가 (error path/negative (a): eval 재유도 throw → publish 미도달)**: pass-through 대신 `evalSpy.mockImplementation(() => { throw new Error("eval-boom"); })` 로 evaluation 위임을 강제 throw 시키고, guard 호출이 그 에러를 전파(`toThrow(/eval-boom/)`)하며 `publishSpy` 가 `toHaveBeenCalledTimes(0)` 임을 검증(첫 sub-composer throw → 뒤 sub-composer 미도달 — fail-fast 방향 lock).
- [ ] **후속-위임 throw 순서 재확인 test 추가 (error path/negative (b): publish 재유도 throw → eval 이미 1회)**: pass-through `evalSpy` 유지 + `publishSpy.mockImplementation(() => { throw new Error("publish-boom"); })` 로 둘째 위임을 throw 시키고(정합 입력으로 앞 재유도는 통과), guard 호출이 그 에러를 전파(`toThrow(/publish-boom/)`)하며 `evalSpy` 가 `toHaveBeenCalledTimes(1)`(순서 상 evaluation 이 publish 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 단일 negative 로 부족하지 않도록 위 (a)(b) 두 분기 각각 cover(fail-fast 방향 + 종단 throw 순서 재확인).
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 stepArgs/runPlan/activities/results mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-step-args-consistency.ts` 및 여타 aggregator/guard/sub-composer/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] **spy 격리**: 최상위 `afterEach(jest.restoreAllMocks)` 가 존재하지 않으면 추가(신규 spyOn 격리 필수 — 없으면 후속 test 관측 오염).
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -c invocationCallOrder test/helpers/realdata-e2e-step-args-consistency.spec.ts` 가 0 → ≥1(정합-경로 순서-lock 부등식 실배선 확인).

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(evaluation → publish)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataEvaluationStepArgs` / `buildRealDataResultPublishStepArgs` sub-composer 로직·인자·하위 guard 정책 변경.
- step-args **aggregator**(`realdata-e2e-step-args.ts`, `buildRealDataE2eStepArgs`)의 sub-composer 호출 순서 — 본 task 는 `assertRealDataE2eStepArgsConsistentWithSources` **내부**의 두 sub-composer 재유도만, aggregator self-wire 순서-lock 은 별도 후속.
- reference-페어링(뒤 builder 첫 인자 === 앞 builder 산출) assert — 본 guard 는 데이터-의존 chain 이 아니라 aggregator fail-fast-sequential 이므로 **적용하지 않는다**(두 sub-composer 는 각각 `runPlan` 을 독립 소비).
- result-report-plan / evaluation-plan / result-issue-* / daily-step-dual-leg-* 재유도 — 이미 T-1054~T-1063 이 cover(본 task 는 sweep leg 11, broader realdata-e2e 로의 확장 첫 aggregator fail-fast-sequential leg).

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속, leg 12 후보) 본 task(step-args aggregator 2 sub-composer fail-fast 순서-lock) 완결 후 나머지 delegate 기반 guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 sub-composer 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. 확인 대상: (1) daily-step 계열의 aggregator/step-args 대응 guard(daily-step-collect/eval-command-plan 은 단일 delegate `resolveRealDataE2eLiveGating` 재유도 — order-lock 불요 확정 기록), (2) seed-collect-call-args 가 buildRealDataCollectInput 단일 재유도인지(단일이면 불요), (3) run-plan/pipeline-plan 이 각 단일 delegate 재유도인지(불요 확정 기록). 단일 delegate 재유도·inline 독립 재유도(`reDeriveExpected*`/`composeExpected*`)·게이트 없는 상호-독립 병렬 재유도는 "order-lock 불요" 확정 기록. 적격 delegate 기반 guard(데이터-의존 chain 또는 aggregator fail-fast-sequential 2+ delegate)가 realdata-e2e 전역에서 소진 확인되면 sweep 완료 선언 + P5 test-hardening 의 next 축(예: producer-seam self-wire 순서-lock 또는 e2e 흐름 커버리지)으로 전환.
