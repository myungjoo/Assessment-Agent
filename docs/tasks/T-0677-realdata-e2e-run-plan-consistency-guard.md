---
id: T-0677
title: e2e run-plan 최외곽 컴포저 산출↔(seeds, modelId, run) 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-run-plan-consistency.ts
  - test/helpers/realdata-e2e-run-plan-consistency.spec.ts
plannerNote: "P5 109행 step① realdata-e2e stream — 최외곽 buildRealDataE2eRunPlan 산출 {pipeline,run}↔single-source 재유도 정합 가드 신설 (step-args aggregator 가드 T-0671 의 한 layer 위 run-plan seam mirror; self-wire 후속)"
---

# T-0677 — e2e run-plan 최외곽 컴포저 산출↔(seeds, modelId, run) 재유도 정합 순수 가드 신설

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 build-time 정합 가드 사슬의 다음 slice. 직전까지 step-args **aggregator** `buildRealDataE2eStepArgs(runPlan, activities, results)`(T-0601) 의 가드신설(T-0671)+self-wire(T-0672) 짝이 닫혔다. 그러나 그보다 한 layer 위 — 실 평가 e2e build-time chain 의 **최외곽 단일 진입점** `buildRealDataE2eRunPlan(seeds, modelId, run) → { pipeline, run }`(T-0597, `realdata-e2e-run-plan.ts`) — 에는 아직 합성 무결성을 런타임에서 강제하는 독립 가드가 부재하다 (그 파일은 `assert*Consistent` 가드 import 0). 이 컴포저는 (1) seed-side 진입 plan 위임(`buildRealDataPipelinePlan(seeds, modelId)`)과 (2) run 식별자 guard·복사를 묶는 seam 인데, seeds/modelId 인자 위치를 뒤바꾸거나 한쪽 산출(pipeline 또는 run)을 변형/누락하는 합성 회귀를 잡을 가드가 없다 (T-0671 Follow-ups 가 가리킨 다음 후보 seam).

본 task 는 그 빈칸을 채우는 **순수 가드 신설만** 한다 — `assertRealDataE2eRunPlanConsistentWithSources(runPlan, seeds, modelId, run): void` 가 산출 `runPlan.pipeline` 을 `buildRealDataPipelinePlan(seeds, modelId)` 로 single-source 재유도한 expected 와, `runPlan.run` 을 입력 `run`(gitSha/dateToken) 과 byte-identical 대조해, 합성 회귀로 손상된 run plan 이 step① live runner 로 새기 전 fail-fast throw 로 차단한다. self-wire(컴포저 반환 직전 self-assert)는 T-0672-style 별도 후속 slice 다. 이로써 step-args aggregator 가드 layer 위 최외곽 run-plan seam 가드 layer 가 박제된다.

## Required Reading

- `test/helpers/realdata-e2e-run-plan.ts` — 가드 대상 최외곽 컴포저. `buildRealDataE2eRunPlan(seeds, modelId, run)`(L120~137)이 (1) `buildRealDataPipelinePlan(seeds, modelId)` → `pipeline`, (2) `assertRunRefNonBlank(run.gitSha/dateToken)` guard 후 `run` 을 새 객체 `{ gitSha, dateToken }` 로 복사 → `run` 합성해 `{ pipeline, run }`(`RealDataE2eRunPlan`, L74~77) 를 반환한다. 본 가드는 이 두 합성을 정확히 같은 인자 순서로 직접 재유도/대조한다.
- `test/helpers/realdata-e2e-pipeline-plan.ts` — pipeline 측 위임 종단 컴포저. `buildRealDataPipelinePlan(seeds, modelId) → RealDataPipelinePlan`. 재유도 source 1. 값 import 원천. `RealDataPipelinePlan` type 정의도 여기 — `import type` 재사용.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` interface 정의. 가드 인자 `seeds` type. `import type` 재사용.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef`(`{ gitSha, dateToken }`) interface 정의. 가드 인자 `run` 및 `runPlan.run` 의 type. `import type` 재사용.
- **패턴 선례 (가장 가까움)**: `test/helpers/realdata-e2e-step-args-consistency.ts` (T-0671 — single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast + `isPlainObject`/`describe`/`deepEqual` helper + JSDoc 계약). 본 가드는 그 한 layer 위 run-plan seam mirror — 차이점: (a) 검증 대상이 `{ pipeline, run }` 컨테이너 2 구성요소, (b) 재유도 source 가 pipeline 측 위임 1 호출(`buildRealDataPipelinePlan`) + run 은 입력 run 직접 대조(별도 sub-composer 없음 — run 은 컴포저가 새 객체 복사만 하므로 입력 `run` 자체가 expected), (c) `pipeline` 과 `run` 은 별개 type 이므로 별도 deep-equal.
- `test/helpers/realdata-e2e-step-args-consistency.spec.ts` (T-0671 spec) — describe/it 구조·negative 분기 배치 동형 참고용.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-run-plan-consistency.ts` 에 순수 가드 `assertRealDataE2eRunPlanConsistentWithSources(runPlan: RealDataE2eRunPlan, seeds: RealDataSeedDescriptor[], modelId: string, run: RealDataResultIssueRunRef): void` 신설. 검증 불변식: `expectedPipeline = buildRealDataPipelinePlan(seeds, modelId)` 를 정확히 같은 인자 순서로 직접 재유도해 `runPlan.pipeline` 이 `expectedPipeline` 와 deep-equal(JSON.stringify 기반 byte-identical) 정합함을 강제하고, `runPlan.run` 이 입력 `run`(gitSha/dateToken 양 필드) 과 deep-equal 정합함을 강제. 재유도 chain(pipeline 합성)은 일절 재구현 0 — 위임 종단 컴포저 호출만(drift 0 보장).
- [ ] **에러 정책 (구조 결손 = TypeError / 값 정합 위반 = RangeError)**: (a) `runPlan`/`run` null/undefined · `runPlan.pipeline`/`runPlan.run` 비-object · `run` 비-object · `seeds` 비-배열 · `modelId` 비-string → 한국어 TypeError. (b) 재유도 expected 와 `runPlan.pipeline` 또는 `runPlan.run` 이 drift → 한국어 RangeError(메시지에 어느 구성요소가 어긋났는지 — `pipeline` 인지 `run` 인지 — 포함). (c) 재유도 위임이 throw(modelId 빈/공백, externalId 빈/공백 seed 등)하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0). silent 통과 0, fail-fast.
- [ ] **비변형 / 순수**: `runPlan`(읽기·비교만) / `seeds`(읽기만 — 위임에 전달) / `run`(읽기만 — 비교만) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · env/네트워크/credential 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 runPlan 이면 항상 void, drift 면 항상 동일 구성요소에서 throw).
- [ ] **Happy-path unit test** (`test/helpers/realdata-e2e-run-plan-consistency.spec.ts` 신설): 정상 (seeds, modelId, run) — 빈 seeds 분기 + 단일/다수 seed 분기 각각 — 으로 산출한 `runPlan`(실 컴포저 `buildRealDataE2eRunPlan` 호출 결과)을 가드에 넣으면 throw 0(void 반환) 1+ test. round-trip(컴포저 산출이 직접 가드를 통과)으로 확인.
- [ ] **Error path unit test**: (a) `runPlan.pipeline` 을 변조(예: collectCallArgs 원소 추가/제거 또는 modelId 변경)한 plan → RangeError(pipeline 구성요소 명시) 1+, (b) `runPlan.run` 변조(gitSha 또는 dateToken 값 변경) → RangeError(run 구성요소 명시) 1+, (c) `runPlan`/`run` null/undefined · `runPlan.pipeline`/`runPlan.run` 비-object · `seeds` 비-배열 · `modelId` 비-string → TypeError 각 1+, (d) modelId 빈/공백 또는 externalId 빈/공백 seed → 재유도 위임 throw 가 가드를 통해 전파됨 1+.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 양 구성요소 통과 → void 분기, (b) pipeline drift → RangeError 분기, (c) run drift → RangeError 분기, (d) 구조 결손 → TypeError 분기, (e) 재유도 위임 throw 전파 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 구조 검증 순서가 fail-fast — `runPlan` null 이 `pipeline`/`run` 비-object 보다 먼저 throw, (b) pipeline 검사가 run 검사보다 먼저(pipeline drift 시 run 변조 무관하게 pipeline RangeError), (c) deep-equal 이 원소·순서·길이까지 byte-identical 강제(pipeline.collectCallArgs 원소 순서만 뒤바꿔도 drift 검출), (d) 동일 입력 두 번 호출 deterministic(같은 void 또는 같은 throw), (e) 입력 runPlan/seeds/run 비변형(가드 호출 후 입력 deep-equal 보존), (f) 빈 seeds + 유효 modelId + 유효 run 정상 통과(throw 0) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 신규 가드 파일 `realdata-e2e-run-plan-consistency.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. 가드가 pipeline 위임 함수를 값 import 하므로 runtime cycle 0 (tsc green 으로 확인 — 컴포저와 가드가 같은 위임 함수를 import 하므로 순환 위험 없음).

## Out of Scope

- run-plan self-wire 배선(`buildRealDataE2eRunPlan` 반환 직전 self-assert) — 별도 후속 slice(T-0672-style self-wire mirror). 본 task 는 **가드 신설만**.
- `buildRealDataE2eRunPlan` 컴포저 / `buildRealDataPipelinePlan` 위임 / `assertRunRefNonBlank` guard 본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
- 자동 복구 / run plan 재합성 / 정규화 / 기본값 채움 0 — 손상 runPlan 을 고치거나 silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
- 재유도 chain 의 pipeline 합성(collect 호출-args 매핑·modelId guard) 재구현 — 전부 위임 종단 컴포저 호출로 재유도(재구현 금지).
- 상위/하위 다른 seam 가드(`realdata-e2e-pipeline-plan` 자체 / step-args aggregator 등) — 본 task 는 e2e run-plan consistency 가드 1건만.
- live execFile / gh / 실 수집 / 실 LLM wiring — credential 게이트 deferred, build-time 순수 가드만.
- production `src/` 코드 변경 — test helper 단독. 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 도메인 type 정의 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 가드신설 후 다음 후보: run-plan self-wire(`buildRealDataE2eRunPlan` 반환 직전 `assertRealDataE2eRunPlanConsistentWithSources` self-assert, T-0672-style) 로 run-plan seam 의 가드신설+self-wire 짝 닫기. 그 후 realdata-e2e build-time consistency 가드 사슬이 최외곽까지 닫히면, step① live execFile/gh/수집 wiring credential 게이트 진입 여부 또는 daily-test step_eval 배선 PLAN 재검토가 다음 자연 후보.)
