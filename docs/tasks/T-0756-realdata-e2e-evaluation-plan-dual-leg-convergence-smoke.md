---
id: T-0756
title: realdata-e2e evaluation-plan 컴포저 dual-leg(inputs·callArgs) convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e eval-side 종단 컴포저 buildRealDataEvaluationPlan dual-leg convergence — seed-side(T-0753/T-0754)·result-side(T-0755) 의 eval-side 대칭 sibling; gap git grep 확인됨"
independentStream: realdata-e2e-evaluation-plan-dual-leg-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-evaluation-plan-dual-leg-convergence-assembly.smoke-spec.ts
---

# T-0756 — realdata-e2e evaluation-plan 컴포저 dual-leg(inputs·callArgs) convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) 의 **evaluation 단계**(수집 산출 `Activity[]` → 실 LLM 평가 호출-args 합성 직전) 측 build-time 종단 컴포저 `buildRealDataEvaluationPlan(activities, modelId)` 은 **두 leg 를 단일 plan 으로 합류**시킨다 — (1) `inputs` leg(`buildRealDataEvaluationInputs(activities)` 위임 산출)와 (2) `callArgs` leg(`buildRealDataScoringCallArgs(inputs, modelId)` 위임 산출)가 `{ inputs, callArgs }` 로 동시 수렴한다. T-0753(run-plan dual-leg pipeline·run)·T-0754(pipeline-plan dual-leg collectCallArgs·modelId)가 **seed-side** 컴포저들의 dual-leg convergence 를 직접-체인 byte-identical 로 닫고, T-0755(publish-plan tri-leg report·commandArgs·searchArgv)가 **result-side** 를 닫았다면, 본 task 는 그 사이의 **eval-side** 대칭 sibling 으로 evaluation-plan 의 dual-leg(inputs·callArgs) convergence 를 직접-체인 byte-identical 로 박제한다 — seed→eval→result 3 구간 컴포저 convergence 그물의 가운데 구멍을 닫는다.

gap 확인(git grep, origin/main): 기존 `test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`(T-0682)는 `plan.inputs`/`plan.callArgs` 를 `toBeDefined()` + `toHaveLength(activities.length)` + `callArgs[i].options.modelId` `toBe` + `callArgs[i].input === inputs[i]` reference 페어링 + 빈-배열 `toEqual([])` + 결정론 `toEqual`/`not.toBe` + no-mutation snapshot 만 한다. **두 leg 가 직접 sub-컴포저 호출 산출과 byte-identical(`toEqual`) 인지**(`plan.inputs` 가 `buildRealDataEvaluationInputs(activities)` 의 단일 source·`plan.callArgs` 가 `buildRealDataScoringCallArgs(plan.inputs, modelId)` 의 단일 source)와 **partial-thread 격리**(다른 activities/modelId → 두 leg 모두 변하되 각각 직접 sub-컴포저 재유도와 정합 유지)를 직접 단언하는 smoke 는 NONE 이다(`git grep` 결과 evaluation-plan dual-leg convergence smoke·`directInputs`/`directCallArgs` 패턴 0 — run-plan(T-0753)·pipeline-plan(T-0754)·publish-plan(T-0755) 에만 leg-level deep-equal 존재). 본 smoke 가 그 회귀 그물을 public CI 에 박제한다. live leg(실 평가·실 LLM·DB·jest spawn) 복제 0·non-gated.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-plan.ts` (L53 `interface RealDataEvaluationPlan`, L76 `export function buildRealDataEvaluationPlan`) — 본 task 가 검증할 eval-side 종단 컴포저. 합성 순서((1) evaluation-inputs 위임 → inputs, (2) scoring-call-args 위임 → callArgs), modelId guard 는 (2) callArgs 단계, self-wire(`assertRealDataEvaluationPlanConsistentWithSources`), `callArgs[i].input === inputs[i]` reference 페어링 계약 박제.
- `test/helpers/realdata-e2e-evaluation-inputs.ts` (L61 `export function buildRealDataEvaluationInputs`) — inputs leg 직접 재유도용 위임 컴포저(Activity[]→EvaluationInput[], contributionKind 정규화·unitId 합성).
- `test/helpers/realdata-e2e-scoring-call-args.ts` (L60 `interface RealDataScoringCallArgs`, L80 `export function buildRealDataScoringCallArgs`) — callArgs leg 직접 재유도용 위임 컴포저(EvaluationInput[]+modelId→{input, options:{modelId}}[], modelId 빈/공백 throw 전파, input reference 그대로 페어링).
- `test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts` (T-0682 산출) — `syntheticActivity(unitId, login)` 결정론 fixture·`MODEL_ID` 상수·`isContributionKind` import·기존 shape/reference 단언 패턴 참고(중복 회피용) + Activity import 위치 참고.
- `test/smoke/realdata-e2e-pipeline-plan-dual-leg-convergence-assembly.smoke-spec.ts` (T-0754 산출) — seed-side dual-leg convergence smoke 구조 — colocated spec 스타일·describe 골격·byte-identical(`toEqual`)/`not.toBe` 무공유/partial-thread/guard-ordering 단언 패턴 대칭 참고.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-evaluation-plan-dual-leg-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0). 다음을 모두 만족한다:

- [ ] **Happy-path**: `buildRealDataEvaluationPlan(activities, modelId)` 의 정상 합성 — 반환 `{ inputs, callArgs }` 두 필드 모두 정의·길이 정합 happy test 1+(synthetic Activity[] literal·유효 modelId 입력).
- [ ] **inputs leg single-source byte-identical**: `plan.inputs` 가 직접 호출 `buildRealDataEvaluationInputs(activities)` 결과와 `toEqual`(deep byte-identical) — inputs leg 가 evaluation-inputs 위임 단일 source 임을 단언. 동시에 새 배열(`not.toBe`)로 무공유 1+ test.
- [ ] **callArgs leg single-source byte-identical**: `plan.callArgs` 가 직접 호출 `buildRealDataScoringCallArgs(plan.inputs, modelId)`(또는 `directInputs`) 결과와 `toEqual`(전체 배열 deep-equal) — callArgs leg 가 scoring-call-args 위임 단일 source 임을 단언. 동시에 새 배열(`not.toBe`)로 무공유 1+ test.
- [ ] **dual-leg cross 정합(branch)**: `plan.callArgs[i].input` 이 `plan.inputs[i]` 와 **reference 동일**(`toBe`, 복제 아님) — callArgs leg 가 inputs leg 산출을 reference 그대로 thread 함을 박제 + 모든 `callArgs[i].options.modelId` 가 동일 modelId 적용 1+ test.
- [ ] **partial-thread 격리(branch)**: 다른 `activities`(같은 modelId) → 두 leg 모두 변할 수 있으나 `plan.inputs`/`plan.callArgs` 가 각각 직접 sub-컴포저 재유도와 여전히 `toEqual`(단일 source 정합 유지) 1+ test / 다른 `modelId`(같은 activities) → inputs 불변·callArgs.options.modelId 만 반영하되 두 leg 각각 단일 source 정합 유지 1+ test(두 leg 가 동일 (activities, modelId) 단일 source 로부터 합류함을 박제).
- [ ] **guard-ordering(branch)**: modelId guard 가 callArgs 단계(inputs 단계보다 뒤)에서 평가됨 — modelId 빈/공백 시 callArgs 위임 throw 가 전파되되, inputs leg 자체는 modelId 무관(별도 직접 호출 `buildRealDataEvaluationInputs(activities)` 가 modelId 없이 정상 산출됨)을 단언 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test:
  - modelId 빈 문자열 → 위임 `buildRealDataScoringCallArgs` guard throw 전파(callArgs 단계).
  - modelId 공백만 → 위임 throw 전파.
  - 빈 activities([]) + 빈/공백 modelId → modelId guard 가 빈-배열 분기보다 먼저 차단(빈 activities 경계에서도 조용한 통과 0).
- [ ] **flow / 빈·단일·다수 activities 분기**: 빈 activities + 유효 modelId → `plan.inputs: []`·`plan.callArgs: []`(throw 0) / 단일 activity(length 1) / 다수 activity(length = activities 길이) 각 1+ test, 각 분기에서 두 leg 가 직접 sub-컴포저 재유도와 `toEqual` 유지.
- [ ] **결정론·무공유·no-mutation**: 동일 (activities, modelId) 두 번 호출 → deep-equal 산출 + 새 plan 객체(`not.toBe`) + `plan.inputs`/`plan.callArgs` 참조 각각 비공유(`not.toBe`) + `callArgs[i].options` 비공유(`not.toBe`) + 입력 `activities` 배열·원소 mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). local DB 부재 시 non-gated build-time smoke 라 DB 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 컴포저 자체를 수정하지 않고 기존 분기(guard 순서·dual-leg 격리·위임 전파·reference 페어링)를 외부 smoke 로 박제하므로, 위 partial-thread/guard-ordering/cross/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-evaluation-plan.ts` 또는 어떤 컴포저 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- 실 github.com 네트워크 fetch / 실 활동 수집 / 실 LLM round-trip / 실 scoreUnit 호출 wiring(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 `realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`(T-0682)의 shape/reference 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 파일만).
- seed-side run-plan(T-0753)/pipeline-plan(T-0754) convergence 재단언 + result-side publish-plan(T-0755) tri-leg 재단언(이미 cover — 본 task 는 eval-side evaluation-plan dual-leg 합성만).
- step-args aggregator(T-0752) dual-leg 재단언.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
