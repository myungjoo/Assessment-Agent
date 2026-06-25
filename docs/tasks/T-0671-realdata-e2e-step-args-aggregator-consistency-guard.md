---
id: T-0671
title: e2e-step-args aggregator 산출↔(runPlan, activities, results) 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-step-args-consistency.ts
  - test/helpers/realdata-e2e-step-args-consistency.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — 상위 aggregator buildRealDataE2eStepArgs 의 산출 {evaluation,publish}↔single-source 재유도 정합 가드 신설 (sub-level publish/outcome step-args 가드 T-0667/T-0669 의 한 layer 위 aggregator-seam mirror; self-wire 는 후속)"
---

# T-0671 — e2e-step-args aggregator 산출↔(runPlan, activities, results) 재유도 정합 순수 가드 신설

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(평가 산출 → 결과 이슈 박제) build-time 정합 가드 사슬의 다음 slice. 직전까지 sub-level step-args 컴포저 두 개 — publish(`buildRealDataResultPublishStepArgs`, T-0599)와 outcome(`buildRealDataResultOutcomeStepArgs`, T-0600) — 의 가드신설(T-0667/T-0669)+self-wire(T-0668/T-0670) 짝이 모두 닫혔다. 그러나 그 publish step-args 를 evaluation step-args 와 함께 묶는 **상위 aggregator** `buildRealDataE2eStepArgs(runPlan, activities, results) → { evaluation, publish }`(T-0601, `realdata-e2e-step-args.ts`) 에는 아직 합성 무결성을 런타임에서 강제하는 독립 가드가 부재하다 (현재 그 파일은 `assert` import 0). 이 aggregator 는 단일 검증 `runPlan` 을 두 sub-composer(평가 step / publish step)에 동시 thread 하는 seam 인데, run/runPlan 인자 위치를 뒤바꾸거나 한쪽 산출(evaluation 또는 publish)을 변형/누락하는 합성 회귀를 잡을 가드가 없다.

본 task 는 그 빈칸을 채우는 **순수 가드 신설만** 한다 — `assertRealDataE2eStepArgsConsistentWithSources(stepArgs, runPlan, activities, results): void` 가 산출 `stepArgs.evaluation` / `stepArgs.publish` 를 동일 입력에서 single-source 로 직접 재유도한 expected 와 byte-identical 대조해, 합성 회귀로 손상된 step-args 가 step④ live runner 로 새기 전 fail-fast throw 로 차단한다. self-wire(aggregator 반환 직전 self-assert)는 sub-level T-0668/T-0670-style 별도 후속 slice 다. 이로써 sub-level(publish/outcome) 가드 layer 위 aggregator-seam 가드 layer 가 박제된다.

## Required Reading

- `test/helpers/realdata-e2e-step-args.ts` — 가드 대상 aggregator. `buildRealDataE2eStepArgs(runPlan, activities, results)`(L137~155)이 (1) `buildRealDataEvaluationStepArgs(runPlan, activities)` → `evaluation`, (2) `buildRealDataResultPublishStepArgs(runPlan, results)` → `publish` 로 2 위임 합성 후 `{ evaluation, publish }`(`RealDataE2eStepArgs`, L100~103) 를 반환한다. 본 가드는 이 두 위임을 정확히 같은 인자 순서로 직접 재유도해 산출과 대조한다.
- `test/helpers/realdata-e2e-evaluation-step-args.ts` — evaluation 측 위임 종단 컴포저. `buildRealDataEvaluationStepArgs(runPlan, activities) → RealDataEvaluationPlan`(L95~). 재유도 source 1. import 원천.
- `test/helpers/realdata-e2e-evaluation-plan.ts` — `RealDataEvaluationPlan` interface(L52~) 정의. 재유도 expected 의 type. `import type` 재사용.
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — publish 측 위임 종단 컴포저. `buildRealDataResultPublishStepArgs(runPlan, results) → RealDataResultIssuePublishPlan`. 재유도 source 2. import 원천.
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — `RealDataResultIssuePublishPlan` interface. publish 측 expected 의 type. `import type` 재사용.
- `test/helpers/realdata-e2e-run-plan.ts` — `RealDataE2eRunPlan`(`{ pipeline, run }`) interface. 가드 인자 `runPlan` type. `import type` 재사용.
- **패턴 선례 (가장 가까움)**: `test/helpers/realdata-e2e-result-publish-step-args-consistency.ts` (T-0667 — single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast + `isPlainObject`/`describe`/`deepEqual` helper + JSDoc 계약). 본 가드는 그 한 layer 위 aggregator-seam mirror — 차이점: (a) 검증 대상이 단일 publish plan 이 아니라 `{ evaluation, publish }` 컨테이너 2 구성요소, (b) 재유도 source 가 두 sub-composer(평가/publish) 호출, (c) `evaluation` 은 별개 type(`RealDataEvaluationPlan`)이므로 publish 와 별도 deep-equal.
- `test/helpers/realdata-e2e-result-outcome-step-args-consistency.ts` (T-0669) — outcome layer mirror, describe/throw 계약 동형 참고용.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-step-args-consistency.ts` 에 순수 가드 `assertRealDataE2eStepArgsConsistentWithSources(stepArgs: RealDataE2eStepArgs, runPlan: RealDataE2eRunPlan, activities: Activity[], results: EvaluationResult[]): void` 신설. 검증 불변식: `expectedEvaluation = buildRealDataEvaluationStepArgs(runPlan, activities)` 와 `expectedPublish = buildRealDataResultPublishStepArgs(runPlan, results)` 를 정확히 같은 인자 순서로 직접 재유도해, `stepArgs.evaluation` 이 `expectedEvaluation` 와, `stepArgs.publish` 가 `expectedPublish` 와 각각 deep-equal(JSON.stringify 기반 byte-identical) 정합함을 강제. 재유도 chain(평가 plan 합성·publish plan 합성)은 일절 재구현 0 — 두 위임 종단 컴포저 호출만(drift 0 보장).
- [ ] **에러 정책 (구조 결손 = TypeError / 값 정합 위반 = RangeError)**: (a) `stepArgs`/`runPlan` null/undefined · `stepArgs.evaluation`/`stepArgs.publish` 비-object · `runPlan` 비-object(또는 재유도에 필요한 `runPlan.run`/`runPlan.pipeline` 비-object) → 한국어 TypeError. (b) 재유도 expected 와 `stepArgs.evaluation` 또는 `stepArgs.publish` 가 drift → 한국어 RangeError(메시지에 어느 구성요소가 어긋났는지 — `evaluation` 인지 `publish` 인지 — 포함). (c) 재유도 위임이 throw(runPlan.pipeline.modelId 또는 run.gitSha/dateToken 빈/공백 등)하면 가드가 삼키지 않고 그대로 전파(자체 try/catch 0). silent 통과 0, fail-fast.
- [ ] **비변형 / 순수**: `stepArgs`(읽기·비교만) / `runPlan`(읽기만 — 두 위임에 전달) / `activities`(읽기만) / `results`(읽기만) mutate 0. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · env/네트워크/credential 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정합 stepArgs 면 항상 void, drift 면 항상 동일 구성요소에서 throw).
- [ ] **Happy-path unit test** (`test/helpers/realdata-e2e-step-args-consistency.spec.ts` 신설): 정상 (runPlan, activities, results) — 빈 activities/results 분기 + 단일/다수 분기 각각 — 으로 산출한 `stepArgs`(실 aggregator `buildRealDataE2eStepArgs` 호출 결과)를 가드에 넣으면 throw 0(void 반환) 1+ test. round-trip(aggregator 산출이 직접 가드를 통과)으로 확인.
- [ ] **Error path unit test**: (a) `stepArgs.evaluation` 을 변조(예: 임의 필드 추가/제거)한 plan → RangeError(evaluation 구성요소 명시) 1+, (b) `stepArgs.publish` 변조 → RangeError(publish 구성요소 명시) 1+, (c) `stepArgs`/`runPlan` null/undefined·`evaluation`/`publish` 비-object·`runPlan.run`/`runPlan.pipeline` 비-object → TypeError 각 1+, (d) runPlan.pipeline.modelId 또는 run.gitSha/dateToken 빈/공백 → 재유도 위임 throw 가 가드를 통해 전파됨 1+.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 양 구성요소 통과 → void 분기, (b) evaluation drift → RangeError 분기, (c) publish drift → RangeError 분기, (d) 구조 결손 → TypeError 분기, (e) 재유도 위임 throw 전파 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 구조 검증 순서가 fail-fast — `stepArgs` null 이 `evaluation`/`publish` 비-object 보다 먼저 throw, (b) evaluation 검사가 publish 검사보다 먼저(evaluation drift 시 publish 변조 무관하게 evaluation RangeError), (c) deep-equal 이 원소·순서·길이까지 byte-identical 강제(publish.searchArgv 원소 순서만 뒤바꿔도 drift 검출), (d) 동일 입력 두 번 호출 deterministic(같은 void 또는 같은 throw), (e) 입력 stepArgs/runPlan/activities/results 비변형(가드 호출 후 입력 deep-equal 보존), (f) 빈 activities + 빈 results + 유효 runPlan 정상 통과(throw 0) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 신규 가드 파일 `realdata-e2e-step-args-consistency.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. 가드가 두 sub-composer 를 값 import 하므로 runtime cycle 0 (tsc green 으로 확인 — aggregator 와 가드가 같은 위임 함수를 import 하므로 순환 위험 없음).

## Out of Scope

- aggregator self-wire 배선(`buildRealDataE2eStepArgs` 반환 직전 self-assert) — 별도 후속 slice(sub-level T-0668/T-0670-style self-wire mirror). 본 task 는 **가드 신설만**.
- `buildRealDataE2eStepArgs` aggregator / 두 sub-composer(`buildRealDataEvaluationStepArgs` / `buildRealDataResultPublishStepArgs`) / 그 하위 위임 본문 수정 — 본 가드는 import·재유도 비교·throw 만(재정의 0).
- 자동 복구 / step-args 재합성 / 정규화 / 기본값 채움 0 — 손상 stepArgs 를 고치거나 silent 수선하지 않는다(fail-fast). 복구는 호출처 책임.
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 비교만.
- 재유도 chain 의 평가 plan·publish plan 합성 재구현 — 전부 두 위임 종단 컴포저 호출로 재유도(재구현 금지).
- outcome step-args(post-실행) aggregator 가드 — outcome 은 실 gh stdout 의존이라 pre-실행 aggregator 와 분리(별도 후속).
- 상위 `realdata-e2e-run-plan` / `realdata-e2e-pipeline-plan` 등 다른 seam 가드 — 본 task 는 e2e-step-args aggregator consistency 가드 1건만.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 가드만.
- production `src/` 코드 변경 — test helper 단독. 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 도메인 type 정의 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 가드신설 후 다음 후보: aggregator self-wire(`buildRealDataE2eStepArgs` 반환 직전 `assertRealDataE2eStepArgsConsistentWithSources` self-assert, T-0668/T-0670-style) 로 e2e-step-args aggregator seam 의 가드신설+self-wire 짝 닫기. 그 위 상위 `buildRealDataE2eRunPlan`(T-0597) seam 또는 step④ live execFile wiring credential 게이트 진입 여부 PLAN 재검토도 후보.)
