---
id: T-0681
title: realdata-e2e evaluation-plan 컴포저 산출↔(activities,modelId) 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
dependsOn: []
independentStream: realdata-e2e
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-plan-consistency.ts
  - test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
plannerNote: P5 109행 step②→③ — buildRealDataEvaluationPlan 종단 컴포저 {inputs,callArgs}↔single-source 재유도 정합 가드 신설(가드신설만, self-wire 후속). run-plan 가드(T-0677) 의 evaluate-side mirror
---

# T-0681 — realdata-e2e evaluation-plan 컴포저 산출↔(activities,modelId) 재유도 정합 순수 가드 신설

## Why

PLAN.md P5 109행 step②→③ 실 평가 e2e(github.com `myungjoo`+`leemgs` 실 공개활동 입력) build-time consistency 가드 사슬은, seed-side 측(pipeline-plan 가드 T-0679 + self-wire T-0680, run-plan 최외곽 가드 T-0677 + self-wire T-0678)을 모두 닫았다. 그러나 **evaluate-side 종단 컴포저** `buildRealDataEvaluationPlan(activities, modelId)`(T-0591, step② 수집 산출 `Activity[]` + modelId → `{inputs, callArgs}` scoreUnit 호출-args plan)는 두 sub-composer(`buildRealDataEvaluationInputs(activities)` T-0578 + `buildRealDataScoringCallArgs(inputs, modelId)` T-0579)를 순서 조립하는 핵심 seam 인데도 **독립 consistency 가드가 부재**하다(현재 `realdata-e2e-evaluation-plan.ts` 는 `assert*Consistent` import 0). activities/modelId 인자 위치를 뒤바꾸거나 한쪽 산출(inputs 또는 callArgs)을 변형/누락하거나 `callArgs[i].input !== inputs[i]` reference 페어링을 깨는 합성 회귀를 잡을 가드가 없다.

본 task 는 그 빈칸을 채운다 — run-plan 가드 `assertRealDataE2eRunPlanConsistentWithSources`(T-0677)의 evaluate-side mirror 로, 순수 가드 `assertRealDataEvaluationPlanConsistentWithSources(plan, activities, modelId)` 를 **신설만** 한다. single-source 재유도(두 sub-composer 직접 재호출)와 산출 plan 을 byte-identical 대조해, 합성 회귀로 손상된 evaluation plan 이 step③ live runner(실 LLM scoreUnit) 로 새기 전 fail-fast throw 로 차단한다. `buildRealDataEvaluationPlan` 의 실제 산출 경로에 self-wire 하는 일은 **후속 task**(T-0678/T-0680 self-wire 동형)로 분리한다 — 본 task 는 가드 신설 + colocated spec 만. test-only build-time 순수, 새 dependency / src 변경 / migration / credential 0, R-59 정합.

## Required Reading

- `test/helpers/realdata-e2e-evaluation-plan.ts` — 가드의 검증 대상 종단 컴포저 `buildRealDataEvaluationPlan(activities, modelId)`. 산출 type `RealDataEvaluationPlan { inputs: EvaluationInput[]; callArgs: RealDataScoringCallArgs[] }` + 합성 순서(2 단계 위임)·분기(빈 activities·modelId 빈/공백 throw 전파)·`callArgs[i].input === inputs[i]` reference 페어링 계약을 그대로 따라야 한다.
- `test/helpers/realdata-e2e-evaluation-inputs.ts` — sub-composer (1) `buildRealDataEvaluationInputs(activities)` 의 시그니처. 가드가 single-source 재유도 시 직접 호출한다(재구현 0).
- `test/helpers/realdata-e2e-scoring-call-args.ts` — sub-composer (2) `buildRealDataScoringCallArgs(inputs, modelId)` 의 시그니처 + modelId 빈/공백 guard throw. 가드가 single-source 재유도 시 직접 호출한다(재구현 0).
- `test/helpers/realdata-e2e-run-plan-consistency.ts` — **패턴 mirror single reference**(편집 안 함). 가드 구조: single-source 재유도 직접 호출 → deep-equal byte-identical 대조 / 구조 결손=TypeError·값 정합 위반=RangeError 구분 / 위임 throw 전파(자체 try/catch 0) / silent 통과 0 / read-only 비변형. 본 task 의 evaluation-plan 가드는 이 파일의 구조를 동형으로 따른다(차이: 검증 대상이 `{inputs, callArgs}` 2 배열 + reference 페어링 불변식).
- `test/helpers/realdata-e2e-run-plan-consistency.spec.ts` — colocated spec 패턴 single reference(편집 안 함). describe 구성·happy/error/negative 분기 cover 스타일을 mirror.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-evaluation-plan-consistency.ts` 신설 — 순수 가드 `assertRealDataEvaluationPlanConsistentWithSources(plan: RealDataEvaluationPlan, activities: Activity[], modelId: string): void` export. 검증 불변식: (a) `expectedInputs = buildRealDataEvaluationInputs(activities)` 재유도 → `plan.inputs` 와 deep-equal byte-identical(원소·순서·길이), (b) `expectedCallArgs = buildRealDataScoringCallArgs(plan.inputs, modelId)` 재유도 → `plan.callArgs` 와 deep-equal byte-identical, (c) reference 페어링 불변식 `plan.callArgs[i].input === plan.inputs[i]`(모든 i) 검증. 재유도 chain(매핑·modelId guard·options 페어링)은 일절 재구현 안 함 — 두 sub-composer 위임 호출만(drift 0).
- [ ] 에러 정책 — 구조 결손(`plan`/`activities` null·undefined·비-object/비-배열, `plan.inputs`/`plan.callArgs` 비-배열, `modelId` 비-string) → 한국어 TypeError. 값 정합 위반(재유도 expected 와 `plan.inputs` 또는 `plan.callArgs` drift, 또는 reference 페어링 깨짐) → 한국어 RangeError(어느 구성요소가 어긋났는지 — inputs 인지 callArgs 인지 reference 인지 — 메시지 포함). 재유도 위임이 throw(modelId 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0).
- [ ] happy-path unit test 1+ — 유효 `(activities, modelId)` 로 `buildRealDataEvaluationPlan` 산출 plan 을 가드에 통과시키면 void(throw 0). 단일/다수 Activity, 빈 `activities` 배열(inputs/callArgs 빈 배열) 모두 정합 시 void.
- [ ] error path unit test 1+ — 각 분기마다: (a) `plan.inputs` drift(원소 변형/순서 뒤바꿈/길이 불일치) → RangeError, (b) `plan.callArgs` drift → RangeError, (c) reference 페어링 깨짐(`plan.callArgs[i].input !== plan.inputs[i]`, 동일 값 새 객체) → RangeError, (d) `plan`/`activities` null·undefined·비-object → TypeError, (e) 재유도 위임 throw(modelId 빈/공백) 전파.
- [ ] flow / branch coverage — 가드의 각 분기(TypeError 구조 검사 분기 · inputs deep-equal 분기 · callArgs deep-equal 분기 · reference 페어링 분기 · 위임 throw 전파 분기) 각 1+ test.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) `plan` null, (2) `activities` 비-배열, (3) `modelId` 비-string, (4) `plan.inputs` 원소 변형 drift, (5) `plan.callArgs` 원소 변형 drift, (6) reference 페어링 깨짐(동일 값 새 객체로 교체), (7) modelId 빈 문자열 위임 throw 전파, (8) modelId 공백-only 위임 throw 전파 — 각 1+ test.
- [ ] 입력 비변형 — 전달받은 `plan`(읽기·비교만) / `activities`(읽기만 — 위임에 전달) / `modelId`(읽기만) 를 mutate 하지 않음(테스트로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(신설 파일 line ≥ 80% / function ≥ 80% — mirror-family 선례대로 신설 helper 100% 목표).
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts`(가드와 colocated). 새 mock helper 추출 불요 — 기존 realdata-e2e seed/Activity fixture 패턴 재사용(run-plan-consistency.spec 의 fixture 구성 mirror).

## Out of Scope

- **self-wire 배선** — 본 task 는 가드 신설만. `buildRealDataEvaluationPlan` 반환 직전에 가드를 self-assert 배선하는 일은 후속 task(T-0678/T-0680 self-wire 동형)로 분리. 본 task 는 `realdata-e2e-evaluation-plan.ts` 를 **편집하지 않는다**.
- **sub-composer 본문 변경** — `buildRealDataEvaluationInputs`(T-0578) / `buildRealDataScoringCallArgs`(T-0579) 의 로직·시그니처·throw 불변. 가드는 import 하여 재유도 호출만.
- **다른 seam 가드 추가** — 본 task 는 evaluation-plan seam 가드 1개만. 다른 layer/seam 의 신규 consistency 가드는 본 task 밖(별도 task).
- **live execFile / 실 네트워크 / Ollama / credential wiring** — build-time 순수 가드 신설만. 실 nightly 실행(deploy/daily-test.sh step_eval)·live-LLM(ADR-0045)·credential 주입은 본 task 와 직교.
- **schema / migration / 새 dependency / auth / src 변경** — 없음(test/helpers 2 파일만). 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **standing 게이트** — ADR-0036 stage5c·P6 frontend·timezone Q-0026·import upload infra·export download chain 은 본 task 와 직교 — 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(self-wire 후속)** 본 가드를 `buildRealDataEvaluationPlan` 반환 직전에 self-assert 배선하는 task 를 큐잉(T-0678 run-plan self-wire / T-0680 pipeline-plan self-wire 동형 — import 1줄 + 단일 반환 지점 `const plan` 분리 후 self-assert, byte-identical 보존). 가드신설(본 task)+self-wire 짝으로 evaluation-plan seam build-time 회귀 fail-fast 완결.
- **(stale backlog 정리 — 이전 task 에서 이월)** PENDING 이나 이미 main 박제된 stale task(T-0511/T-0541/T-0544/T-0549 — T-0556~T-0570 unevaluated-fill 사슬로 supersede)의 frontmatter `status: PENDING → SUPERSEDED` + `supersededBy` 박제는 별도 doc-only direct bookkeeping pass 로 정리 권장.
