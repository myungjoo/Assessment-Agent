---
id: T-0672
title: e2e-step-args aggregator 산출 직전 consistency 가드 self-wire 배선 (buildRealDataE2eStepArgs)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-step-args.ts
  - test/helpers/realdata-e2e-step-args.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — T-0671 신설 e2e-step-args aggregator consistency 가드를 buildRealDataE2eStepArgs 반환 직전 self-wire (T-0668/T-0670 sub-level composer self-wire 의 한 layer 위 aggregator-seam mirror)"
---

# T-0672 — e2e-step-args aggregator 산출 직전 consistency 가드 self-wire 배선

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(평가 산출 → 결과 이슈 박제) build-time 정합 가드 사슬의 다음 slice. 직전 T-0671 가 `assertRealDataE2eStepArgsConsistentWithSources(stepArgs, runPlan, activities, results)` 순수 가드를 **신설만** 했고(상위 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results) → { evaluation, publish }`(T-0601, `realdata-e2e-step-args.ts`) 의 산출 경로에는 아직 미배선 — T-0671 Out of Scope + Follow-up). 본 task 는 그 가드를 **aggregator 가 `{ evaluation, publish }` 컨테이너를 반환하기 직전 self-assert** 배선해, aggregator 가 두 sub-composer(평가 step / publish step)에 같은 `runPlan` 을 thread·합성하는 과정에서 run/runPlan 인자 위치를 뒤바꾸거나 한쪽 산출(evaluation 또는 publish)을 변형/누락하는 합성 회귀를 호출 시점에 fail-fast 로 차단한다 (T-0668 publish-step-args / T-0670 outcome-step-args composer self-wire 의 한 layer 위 aggregator-seam mirror, T-0666/T-0664 self-wire 와 동형). 정상 합성이면 가드는 void → aggregator 반환 컨테이너 byte-identical·무공유 보존, 회귀 시 aggregator 가 손상 step-args 를 caller(step④ live runner)에 넘기기 전에 throw. 이로써 e2e-step-args aggregator-seam 의 가드신설(T-0671)+self-wire(T-0672) 짝이 닫힌다.

## Required Reading

- `test/helpers/realdata-e2e-step-args.ts` — 배선 대상 aggregator. `buildRealDataE2eStepArgs(runPlan, activities, results)`(L137~155)이 (1) `const evaluation = buildRealDataEvaluationStepArgs(runPlan, activities)`(L145), (2) `const publish = buildRealDataResultPublishStepArgs(runPlan, results)`(L150) 합성 후 L154 에서 `return { evaluation, publish };` 한다. 본 task 는 이 함수가 컨테이너를 `return` 하기 직전에 산출 stepArgs 를 지역 변수(`const stepArgs: RealDataE2eStepArgs = { evaluation, publish }`)로 받아 self-assert 후 반환하도록 배선.
- `test/helpers/realdata-e2e-step-args-consistency.ts` — self-wire 할 가드. `assertRealDataE2eStepArgsConsistentWithSources(stepArgs, runPlan, activities, results): void`(T-0671 신설) 시그니처 확인 — 인자 순서 `(stepArgs, runPlan, activities, results)`. 가드는 내부에서 두 sub-composer 를 같은 인자 순서로 직접 재유도해 `stepArgs.evaluation`/`stepArgs.publish` 와 byte-identical 정합 검증. import 원천.
- `test/helpers/realdata-e2e-step-args.spec.ts` — aggregator colocated spec(이미 존재). 본 task 는 self-wire 배선 검증 describe/it 를 append(spyOn 으로 가드가 (산출 stepArgs, runPlan, activities, results) 인자로 정확히 1회 호출됨 검증 + 정상 합성이면 throw 0, 가드가 throw 하면 aggregator 도 throw 전파).
- 패턴 선례: `docs/tasks/T-0670-realdata-result-outcome-step-args-consistency-self-wire.md` (T-0669 신설 가드의 composer self-wire — import 1줄 + 호출 1지점, 반환 직전 self-assert, byte-identical·무공유 보존). 본 task 는 그 한 layer 위 aggregator 동형. 다른 점: (a) 반환이 `{ evaluation, publish }` 컨테이너(단일 객체 아님), (b) 가드 인자 순서 `(stepArgs, runPlan, activities, results)` 4 인자, (c) self-assert 대상이 이미 만든 컨테이너(반환 직전 1회). `docs/tasks/T-0668-realdata-result-publish-step-args-consistency-self-wire.md` 도 동형 참고.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] `buildRealDataE2eStepArgs` 가 L154 에서 `return { evaluation, publish };` 하던 것을, 산출 컨테이너를 지역 변수(`const stepArgs: RealDataE2eStepArgs = { evaluation, publish }`)로 받아 `assertRealDataE2eStepArgsConsistentWithSources(stepArgs, runPlan, activities, results)` 를 **반환 직전 1회 self-assert** 후 그 `stepArgs` 를 반환하도록 배선. import 1줄(consistency 가드) + 지역 변수 1개 + 호출 1지점만 추가 — 두 위임 호출(`buildRealDataEvaluationStepArgs`/`buildRealDataResultPublishStepArgs`)·인자 순서·주석 본문 변경 0, 반환 컨테이너 byte-identical·무공유(evaluation/publish 트리 보존) 보존.
- [ ] **비변형 / 순수**: 배선으로 부수효과 0·새 외부 dependency 0·credential/env/네트워크 0. 가드는 read-only 검증이라 stepArgs/runPlan/activities/results mutate 0. 정상 합성이면 self-assert 가 void → 기존 동작과 관측 불가능하게 동일.
- [ ] **Happy-path unit test**: 정상 (runPlan, activities, results) — 빈 activities/results 분기 + 단일/다수 분기 각각 — 으로 aggregator 호출 시 throw 0(정상 `{ evaluation, publish }` 반환). 산출 stepArgs 가 직전 가드를 통과함을 round-trip 으로 확인.
- [ ] **Error path unit test**: self-assert 가 throw 하는 경로 — 가드를 `jest.spyOn` 으로 throw 하도록 mock 했을 때 aggregator 가 그 throw 를 삼키지 않고 caller 로 전파함 1+ test. 또한 위임 sub-composer(`buildRealDataEvaluationStepArgs`/`buildRealDataResultPublishStepArgs`)가 throw 하는 입력(runPlan.pipeline.modelId 빈/공백 → 평가 위임 throw, runPlan.run.gitSha/dateToken 빈/공백 → publish 위임 throw)에서는 가드 진입 전에 위임 throw 가 전파됨 1+ test.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 가드 통과 → 컨테이너 반환 분기, (b) 가드 throw 전파 분기, (c) 평가 위임 throw 가 가드 진입 전 전파되는 분기(modelId 빈/공백), (d) publish 위임 throw 가 가드 진입 전 전파되는 분기(gitSha/dateToken 빈/공백) 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) 가드가 (산출 stepArgs, runPlan, activities, results) 정확한 인자·순서·1회로 호출됨을 spyOn 으로 검증, (b) 가드 throw 시 aggregator throw 전파, (c) 평가 위임 throw 입력(modelId 빈/공백)에서 가드 미호출(평가 위임 단계 종료 — publish 위임도 가드도 미도달), (d) publish 위임 throw 입력(gitSha/dateToken 빈/공백)에서 가드 미호출, (e) 동일 입력 두 번 호출 deterministic(같은 evaluation/publish byte-identical), (f) 입력 runPlan/activities/results 비변형(가드 호출 후 입력 deep-equal 보존), (g) 반환 컨테이너 무공유(반환값 또는 그 evaluation/publish 트리 mutate 가 후속 호출 결과에 누출 0) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경 대상 aggregator 파일 `realdata-e2e-step-args.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. consistency 가드 값 import 추가로 인한 runtime cycle 0 (tsc green 으로 확인 — aggregator 와 가드는 같은 두 sub-composer 를 import 하므로 순환 위험 없음).

## Out of Scope

- `assertRealDataE2eStepArgsConsistentWithSources` 가드 본문·두 sub-composer(`buildRealDataEvaluationStepArgs`/`buildRealDataResultPublishStepArgs`) 본문 수정 — 본 task 는 self-wire 배선만, 가드·위임은 T-0671/T-0598/T-0599 산출물 그대로 사용.
- aggregator 합성 로직·반환 형태 변경 — 반환 `{ evaluation, publish }` 컨테이너는 byte-identical·무공유 보존, 본 task 는 반환 직전 검증 호출 1지점 + 지역 변수 1개만 추가.
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape/outcome-report/publish-plan/publish-step-args/outcome-step-args)의 추가 가드 또는 self-wire — 본 task 는 e2e-step-args aggregator consistency 가드 self-wire 1건만.
- 상위 `buildRealDataE2eRunPlan`(T-0597)/`realdata-e2e-pipeline-plan` 등 다른 컴포저용 가드 또는 self-wire — 별도 후속 slice.
- post-실행 outcome-step-args aggregator 가드/self-wire — outcome 은 실 gh stdout 의존이라 pre-실행 aggregator 와 분리(별도 후속).
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 배선만.
- production `src/` 코드 변경 — test helper 단독.
- 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 type 정의 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 self-wire 로 e2e-step-args aggregator-seam consistency chain(가드신설 T-0671 → aggregator self-wire T-0672)이 완결됨. 그로써 step④ 의 sub-level publish(T-0667/T-0668)·outcome(T-0669/T-0670) step-args + 상위 aggregator(T-0671/T-0672) 세 layer seam 짝이 모두 닫힘. 다음 후보: 그 위 상위 `buildRealDataE2eRunPlan`(T-0597) seam 의 가드신설+self-wire 짝, 또는 step④ live execFile wiring credential 게이트 진입 여부 PLAN 재검토.)
