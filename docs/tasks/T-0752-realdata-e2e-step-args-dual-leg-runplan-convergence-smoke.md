---
id: T-0752
title: realdata-e2e step-args aggregator dual-leg runPlan single-source convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 250
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step②③④ pre-실행 aggregator buildRealDataE2eStepArgs 의 evaluation·publish 두 leg 가 동일 runPlan 단일 source 로 합류함을 직접-체인 byte-identical 로 박제. T-0728 assembly smoke 는 toBeDefined 만·leg deep-equal 0. issue-still-relevant: 두 sub-composer 공동-import smoke grep 0 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-step-args-dual-leg-convergence-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts]
---

# T-0752 — realdata-e2e step-args aggregator dual-leg runPlan single-source convergence 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **pre-실행 step-args aggregator** 최외곽 컴포저 `buildRealDataE2eStepArgs(runPlan, activities, results)` (T-0601) 는 단일 검증 `runPlan`(`buildRealDataE2eRunPlan` 산출 = `{pipeline, run}`) 을 **두 leg 로 동시 thread** 해 `{evaluation, publish}` 를 합성한다:

1. **evaluation leg** — `buildRealDataEvaluationStepArgs(runPlan, activities)` (T-0598 위임). `runPlan.pipeline.modelId` 를 평가 plan(scoreUnit 호출-args) 으로 thread.
2. **publish leg** — `buildRealDataResultPublishStepArgs(runPlan, results)` (T-0599 위임). `runPlan.run`(gitSha + dateToken) 을 step④ 결과 이슈 publish plan 으로 thread.

이 aggregator 의 핵심 불변식은 **두 leg 가 같은 단일 `runPlan` source 로부터 합류**한다는 것이다 — caller 가 평가 step 과 publish step 에 서로 다른 runPlan(divergent modelId / run)을 넘길 수 없고(재전달 0), modelId(평가측)와 run(publish측)이 같은 검증 source 에서 나옴이 구조적으로 보장된다.

그러나 이 **dual-leg single-source convergence(두 leg ↔ 같은 runPlan 합류)를 직접-체인으로 묶은 non-gated build-time smoke 는 부재**다. 기존 `realdata-e2e-assembly.smoke-spec.ts`(T-0728) 의 happy-path 는 `stepArgs.evaluation`·`stepArgs.publish` 가 `toBeDefined()`(존재) 인지만 단언할 뿐, **각 leg 가 같은 `runPlan` 으로 직접 호출한 sub-composer 산출과 byte-identical**(`stepArgs.evaluation` === `buildRealDataEvaluationStepArgs(runPlan, activities)`, `stepArgs.publish` === `buildRealDataResultPublishStepArgs(runPlan, results)`) 임은 0 이다. 또한 **두 sub-composer 를 한 smoke 에 공동-import** 해 aggregator 가 두 leg 를 어긋남 없이 합류시키는지 확인하는 smoke 도 0 이다 (`git grep` 으로 `stepArgs.evaluation).toEqual` / `stepArgs.publish).toEqual` 단언이 test/smoke/ 에 부재 확인 + 두 sub-composer `buildRealDataEvaluationStepArgs` & `buildRealDataResultPublishStepArgs` 를 동시 import 하는 smoke 파일 0 확인).

즉 leg-swap(평가 산출과 publish 산출 위치 뒤바뀜)·leg-drift(aggregator 가 한 leg 에 다른 runPlan/modelId/run 을 넘겨 sub-composer 직접 호출과 어긋남)·partial-thread(한 leg 만 runPlan thread, 다른 leg 는 누락/변형)·source-divergence(evaluation 의 modelId 와 publish 의 run 이 같은 runPlan 에서 나오지 않음) 회귀는 public CI 에서 직접 발화되지 않고, aggregator unit/consistency 가드(`assertRealDataE2eStepArgsConsistentWithSources`) 또는 step②③④ live runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — T-0750(descriptor body 3-블록 confluence)·T-0751(descriptor title·marker identity confluence) 이 descriptor 의 두 confluence 축을 직접-체인으로 닫은 것과 **동형**으로, 최외곽 aggregator 의 **두 leg(evaluation·publish) ↔ 단일 runPlan source convergence** 를 직접-체인 smoke 로 박제해, seed→run-plan→step-args 종단 조립의 합류 불변식을 public CI 그물로 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-step-args.ts` — pre-실행 aggregator `buildRealDataE2eStepArgs(runPlan, activities, results)` → `RealDataE2eStepArgs`(`{evaluation, publish}`). (1) `buildRealDataEvaluationStepArgs(runPlan, activities)` evaluation leg, (2) `buildRealDataResultPublishStepArgs(runPlan, results)` publish leg, 합성 순서(평가 위임 먼저 → publish 위임 나중), 단일 runPlan thread(재전달 0), 위임 throw 자체 try/catch 없이 전파, 무공유·결정론
- `test/helpers/realdata-e2e-evaluation-step-args.ts` — evaluation leg sub-composer `buildRealDataEvaluationStepArgs(runPlan, activities)` → `RealDataEvaluationPlan`. `runPlan.pipeline.modelId` thread·modelId 빈/공백 guard throw. 본 smoke 가 직접 재호출해 `stepArgs.evaluation` 와 byte-identical 대조용
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — publish leg sub-composer `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan`. `runPlan.run` thread·gitSha/dateToken 빈/공백 guard throw. 본 smoke 가 직접 재호출해 `stepArgs.publish` 와 byte-identical 대조용
- `test/helpers/realdata-e2e-run-plan.ts` — 최외곽 진입 plan `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}`. runPlan fixture 구성용(modelId·run 단일 검증 source)
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` 무인자 결정론 상수 seed 빌더(runPlan 입력용)
- `src/assessment-collection/domain/activity.ts` — `Activity` / `GithubActivity` type. synthetic activity literal 구성용(evaluation leg 입력)
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` interface + `CONTRIBUTION_LEVELS`. synthetic EvaluationResult literal 구성용(publish leg 입력)
- `src/llm/difficulty.ts` — `DIFFICULTIES` value + `Difficulty` type. synthetic literal 의 difficulty 슬롯 참고
- `test/smoke/realdata-e2e-assembly.smoke-spec.ts` — seed→run-plan→step-args assembly smoke(T-0728, aggregator existence·결정성·빈-배열·negative guard 전파 cover). 본 task 의 **dual-leg byte-identical convergence 는 미cover** — 본 smoke 와 비중복 절단면(leg 존재 단언 중복 0). synthetic activity / EvaluationResult literal·RUN_REF·MODEL_ID fixture·non-gated describe 패턴의 mirror 템플릿
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper·spec 수정 0).
- [ ] **Happy-path test** — `buildRealDataE2eSeed()` → `buildRealDataE2eRunPlan(seeds, MODEL_ID, run)` → synthetic `Activity[]` + synthetic `EvaluationResult[]` → `buildRealDataE2eStepArgs(runPlan, activities, results)` 종단 chain 을 한 번에 실행. `stepArgs.evaluation`·`stepArgs.publish` 가 둘 다 정의됨이고 각각 객체/예상 shape(예: evaluation 에 inputs/callArgs, publish 에 report/commandArgs/searchArgv 존재) 1+ test.
- [ ] **dual-leg single-source convergence 단언 (핵심)** — 동일 `runPlan`·`activities`·`results` 로: (a) `stepArgs.evaluation` 이 직접 호출 `buildRealDataEvaluationStepArgs(runPlan, activities)` 와 `toEqual`(byte-identical — evaluation leg 이 같은 runPlan source 로부터 합류) 1+ test. (b) `stepArgs.publish` 가 직접 호출 `buildRealDataResultPublishStepArgs(runPlan, results)` 와 `toEqual`(byte-identical — publish leg 이 같은 runPlan source 로부터 합류) 1+ test. (c) 두 leg 가 같은 단일 `runPlan` 에서 thread 됨을 보이는 source-convergence 단언: `stepArgs.evaluation` 의 modelId 경로(예: evaluation plan 의 modelId 흔적)와 `stepArgs.publish` 의 run 경로(예: searchArgv/marker 의 `runPlan.run` 토큰)가 각각 `runPlan.pipeline.modelId` / `runPlan.run` 에 정합 1+ test (leg 별 단일 source threading 확인 — leg-swap/leg-drift 차단).
- [ ] **partial-thread 차단 단언** — `stepArgs.evaluation` 은 `runPlan.pipeline.modelId` 에만 의존하고 `results`(publish 입력)에는 무관, `stepArgs.publish` 는 `runPlan.run`+`results` 에 의존하고 `activities`(evaluation 입력)에는 무관함을 분리 단언: 동일 runPlan·동일 activities + **다른 results** → `stepArgs.evaluation` 불변(`toEqual`)이고 `stepArgs.publish` 는 변함 1+ test. 동일 runPlan·동일 results + **다른 activities** → `stepArgs.publish` 불변이고 `stepArgs.evaluation` 변함 1+ test (leg 간 입력 격리·교차 누출 0).
- [ ] **Error/negative path test** — (a) `runPlan.pipeline.modelId` 빈/공백 runPlan(또는 그런 runPlan 을 만들려는 시도가 run-plan 단계에서 throw 되므로, modelId guard 전파를 보이려면 evaluation sub-composer 가 직접 throw 하는 경계 — aggregator 호출이 evaluation leg guard throw 를 자체 try/catch 없이 전파)을 `expect(() => buildRealDataE2eStepArgs(...)).toThrow` 1+ test. (b) `runPlan.run.gitSha`/`dateToken` 빈/공백 → publish leg guard throw 가 aggregator 경로로 그대로 전파(modelId 유효해도 — 필드별 분기) 1+ test. (c) evaluation guard(modelId)와 publish guard(run)가 **각 leg 독립 분기**임을 별개 test 로 분리(단일 negative 금지). 주: `buildRealDataE2eRunPlan` 이 modelId·run 을 선검증하므로, leg guard 전파를 직접 보이려면 sub-composer 가 받는 runPlan-유사 객체를 literal 로 구성(런타임 비식별 runPlan)해 aggregator 에 주입 — 실제 fail-fast 위치(run-plan vs leg)에 맞춰 throw 단언.
- [ ] **Flow / branch coverage** — (a) 빈 `activities` + 빈 `results` → 두 leg 모두 throw 0(evaluation leg 빈-inputs·publish leg count 0 plan) 으로 합류·convergence 유지(leg deep-equal 직접 호출과 정합) 1+ test. (b) 단일 activities/results → convergence 유지 1+ test. (c) 다수 activities/results(분포 다양) → convergence 유지 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) modelId guard 전파(evaluation leg), (b) run guard 전파(publish leg), (c) 다른 results → publish 만 변함(evaluation 격리), (d) 다른 activities → evaluation 만 변함(publish 격리), (e) raw 본문/narrative 누출 0: synthetic `Activity`/`EvaluationResult` 에 sentinel 문자열을 넣고 `stepArgs`(evaluation·publish 양 leg 직렬화) 에 sentinel 미등장 또는 식별자/토큰 경로에만 한정(R-59/REQ-059 정합) 1+ test, (f) **결정론·무공유**: 동일 (runPlan, activities, results) 두 번 aggregator 호출 시 `toEqual` byte-identical + 매 호출 새 컨테이너 객체(반환 참조 비동일 `not.toBe`), (g) **no-mutation**: 입력 `runPlan`·`activities` 배열·원소·`results` 배열·원소가 aggregator 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic Activity/EvaluationResult literal + runPlan/run literal 직접 주입).
- [ ] live leg (실 수집 / `collectForPerson` 실호출 / 실 scoring / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / 실 네트워크 / DB 접근 / 실 git sha·timestamp 읽기 / 실 jest spawn / 실 gh) 복제 0 — runPlan→step-args 두 leg 조립 surface 만 검증 (synthetic literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-assembly.smoke-spec.ts` (T-0728, seed→run-plan→step-args aggregator existence·결정성·빈-배열·negative guard 전파) 의 재검증 — 본 task 는 aggregator 의 **dual-leg byte-identical convergence**(각 leg ↔ 직접 sub-composer 호출 deep-equal + leg 간 입력 격리) 만 책임, leg 존재(`toBeDefined`) 단언 중복 0.
- 기존 `realdata-e2e-evaluation-step-args-assembly.smoke-spec.ts` (T-0739) / `realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` (T-0737) / `realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts` (T-0738) / descriptor·summary 렌더 계열(T-0748~T-0751) smoke — 본 task 는 두 sub-composer 를 한 aggregator 로 합류시키는 절단면만, 각 sub-composer 고립 smoke 와 별개.
- post-실행 outcome step-args(`buildRealDataResultOutcomeStepArgs`) 합류 — 본 aggregator(`buildRealDataE2eStepArgs`)는 pre-실행(evaluation + publish) 만 묶음, outcome 미포함(별개 절단면).
- 실 수집 / `collectForPerson` 실호출 / 실 scoring / `EvaluationScoringService.scoreUnit` 실호출 / 실 EvaluationResult 산출 / 실 LLM round-trip / Ollama / DB 접근 / 실 gh / 실 git sha·timestamp 읽기 / 실 jest spawn / 실 네트워크.
- 컴포저 소스(`realdata-e2e-step-args.ts` / `realdata-e2e-evaluation-step-args.ts` / `realdata-e2e-result-publish-step-args.ts` / `realdata-e2e-run-plan.ts`) / 각 consistency 가드 / Activity·EvaluationResult·Difficulty 정의 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0751 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
