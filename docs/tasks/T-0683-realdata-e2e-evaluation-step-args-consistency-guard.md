---
id: T-0683
title: realdata-e2e evaluate-side evaluation-step-args 컴포저 산출↔재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-009]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-evaluate-consistency
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-step-args-consistency.ts
  - test/helpers/realdata-e2e-evaluation-step-args-consistency.spec.ts
plannerNote: P5 109행 step②→③ realdata-e2e stream — evaluation-step-args 컴포저 step-args layer 정합 가드 신설(publish/outcome step-args 가드 T-0667/T-0669 의 evaluate-side mirror)
---

# T-0683 — realdata-e2e evaluate-side evaluation-step-args 컴포저 산출↔재유도 정합 순수 가드 신설

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5) realdata-e2e stream. evaluate-side build-time consistency 가드 사슬은 run-plan(T-0677/T-0678)·pipeline-plan(T-0679/T-0680)·evaluation-plan(T-0681/T-0682) 3 layer 의 가드신설+self-wire 가 완결됐다. 그러나 그 한 layer 아래 `buildRealDataEvaluationStepArgs(runPlan, activities)`(T-0598) 컴포저 — `runPlan.pipeline.modelId` 를 추출해 `buildRealDataEvaluationPlan` 으로 thread 하는 step-args 종단 — 의 산출 `{inputs, callArgs}` 가 single-source `(runPlan, activities)` 재유도와 byte-identical 함을 보장하는 가드가 없다. publish-side 의 publish-step-args(T-0667)·outcome-step-args(T-0669) 가드가 동형으로 step-args layer 를 닫은 것을 evaluate-side 로 mirror 한다. 본 task 는 가드 신설만 — composer 반환 직전 self-wire 는 후속 분리(T-0682-style).

## Required Reading

- `test/helpers/realdata-e2e-evaluation-step-args.ts` — 가드가 검증할 대상 컴포저 `buildRealDataEvaluationStepArgs(runPlan, activities) -> {inputs, callArgs}`. modelId 를 `runPlan.pipeline.modelId` 에서만 도출.
- `test/helpers/realdata-e2e-result-publish-step-args-consistency.ts` — pattern mirror 원본(publish-side step-args 가드 T-0667). 구조검증 TypeError 분기 + 재유도 expected 산출 + deep-equal byte-identical RangeError 분기 + 위임 throw 전파의 정확한 형태.
- `test/helpers/realdata-e2e-evaluation-plan-consistency.ts` — evaluate-side evaluation-plan 가드(T-0681). `callArgs[i].input === inputs[i]` reference 페어링 불변식 검증 형태 참고.
- `test/helpers/realdata-e2e-evaluation-plan.ts` — 위임 종단 `buildRealDataEvaluationPlan(activities, modelId)` 의 산출 shape `{inputs, callArgs}`.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-step-args-consistency.ts` 에 순수 함수 `assertRealDataEvaluationStepArgsConsistentWithSources(plan, runPlan, activities): void` 신설. 동작:
  - 구조 검증(TypeError 분기) — `plan`/`runPlan`/`activities` 존재 + `plan.inputs`/`plan.callArgs` array + `runPlan.pipeline` object + `runPlan.pipeline.modelId` 도출 가능.
  - 재유도 expected 산출 — 본 가드가 `buildRealDataEvaluationStepArgs(runPlan, activities)` (또는 동등하게 `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)`) 를 직접 호출해 single-source expected `{inputs, callArgs}` 산출(drift 0). 위임 guard throw(빈/공백 modelId 등) 는 삼키지 않고 그대로 전파.
  - `plan.inputs` deep-equal byte-identical 비교 — 불일치 시 RangeError(기대/실측 JSON 포함).
  - `plan.callArgs` deep-equal byte-identical 비교 — 불일치 시 RangeError.
  - `callArgs[i].input === inputs[i]` reference 페어링 불변식 검증 — 위반 시 RangeError(evaluation-plan 가드 T-0681 mirror).
- [ ] 추가/수정된 public symbol `assertRealDataEvaluationStepArgsConsistentWithSources` 에 happy-path unit test 1+ — 정상 `(plan, runPlan, activities)` 가 throw 없이 통과.
- [ ] error path unit test 1+ — 구조 결손(plan/runPlan/activities null·필드 누락) 시 TypeError, byte 불일치 시 RangeError, modelId 빈/공백 시 위임 throw 전파.
- [ ] 분기마다 test 분리 — inputs 불일치 / callArgs 불일치 / 페어링 불변식 위반 각 RangeError 분기 1+ test. 구조검증 TypeError 분기 각 1+ test.
- [ ] negative cases 충분 cover — null·undefined plan, 빈 activities, modelId 공백, callArgs[i].input 이 inputs[i] 와 다른 reference, inputs/callArgs 길이 mismatch, 위임 helper throw 전파 등 예외 분기마다 1+ test.
- [ ] `test/helpers/realdata-e2e-evaluation-step-args-consistency.spec.ts` colocated spec(test/helpers/ 하 동일 위치) 신설 — describe/it 한국어 명확.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(전체 suite green).
- [ ] `pnpm test:cov` 통과 — 신설 파일 line ≥ 80% / function ≥ 80%(가드는 100% 목표).

## Out of Scope

- composer `buildRealDataEvaluationStepArgs` 반환 직전 self-assert self-wire 배선 — 후속 task(T-0682-style, dependsOn 본 task).
- 가드 로직을 production `src/` 로 이동(현 stream 은 test/helpers/ 박제 유지).
- publish/outcome step-args 가드(T-0667/T-0669) 수정.
- evaluation-step-args 컴포저 자체 동작 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
