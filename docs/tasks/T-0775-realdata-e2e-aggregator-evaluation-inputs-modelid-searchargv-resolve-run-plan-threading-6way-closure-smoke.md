---
id: T-0775
title: realdata-e2e step④ aggregator evaluation-inputs 합류 6-way single-source closure — buildRealDataE2eStepArgs(runPlan, activities, results) 한 호출의 {evaluation.inputs(=buildRealDataEvaluationInputs(activities) byte-identical, callArgs[i].input === inputs[i] reference), evaluation.callArgs[].options.modelId(=runPlan.pipeline.modelId), publish.{descriptor.marker, commandArgs.searchQuery, searchArgv(--match 토큰)}} ↔ resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs).action.update.issueNumber ↔ buildRealDataResultOutcomeStepArgs(runPlan, execStdout) run-identity 가 단일 검증 source(runPlan+activities)로 inputs+modelId+marker+searchArgv+issueNumber+run-identity 6축 동시 수렴 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T23:40:00Z
mergedAs: 418f8e5e
prNumber: 690
reviewRounds: 1
commitMode: pr
coversReq: [REQ-009, REQ-032, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ sweep — T-0774(aggregator dual-leg 5-way: evaluation.modelId+searchArgv+descriptor.marker+commandArgs.searchQuery+resolve+post) 위에 evaluation leg 의 inputs 축(stepArgs.evaluation.inputs == buildRealDataEvaluationInputs(activities) byte-identical, callArgs[i].input === inputs[i] reference)을 6번째 축으로 합류 — 단일 source(runPlan+activities)가 inputs(activities 재유도)+modelId(runPlan.pipeline)+publish marker/searchArgv/run-identity 양쪽 source 임을 resolve+post 까지 묶어 박제; gap 실측(origin/main 0076fd68): aggregator+resolve+outcome+buildRealDataEvaluationInputs 4 동시-호출 smoke 0 부재(T-0774 는 inputs 를 Array.isArray 만 단언·callArgs[i].input 페어링·activities 재유도 미합류, Out of Scope line 100 명시 제외; T-0752 는 resolve·post 미합류). dependsOn [] file-disjoint stage5b 병렬"
independentStream: realdata-e2e-aggregator-evaluation-inputs-modelid-searchargv-resolve-run-plan-threading-6way-closure-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·aggregator 6-way 6-축 동시 수렴(evaluation.inputs activities-재유도 byte-identical + callArgs[i].input===inputs[i] reference + evaluation.modelId + searchArgv --match 마커 + commandArgs.searchQuery + descriptor.marker + resolve issueNumber + post run-identity)·단일 source(runPlan+activities)·post threading·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0774(300)/T-0773(300)/T-0772(300)/T-0771(300)/T-0770(573) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-aggregator-evaluation-inputs-modelid-searchargv-resolve-run-plan-threading-6way-single-source-closure-assembly.smoke-spec.ts
---

# T-0775 — realdata-e2e step④ aggregator evaluation-inputs 합류 6-way single-source closure non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 build-time 순수 layer 는 **검증된 단일 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}`, T-0597)을 pre-실행 aggregator(`buildRealDataE2eStepArgs(runPlan, activities, results)` → `{evaluation, publish}`, T-0601)에 통째로 넘긴다**. 이 aggregator 의 `.evaluation` leg(`RealDataEvaluationPlan {inputs, callArgs}`)는 **두 개의 활동-side 축**을 동시에 운반한다:

- **inputs 축(본 task 의 새 표면)** — `stepArgs.evaluation.inputs` 는 수집 산출 `activities: Activity[]` 를 `buildRealDataEvaluationInputs(activities)`(T-0578, production `mapActivityToEvaluationInput` 위임)로 변환한 `EvaluationInput[]` 와 **byte-identical** 이고, 각 `callArgs[i].input === inputs[i]`(reference 동일) 페어링이 보장된다. 즉 평가 입력 식별자 set 이 단일 검증 `activities` source 로부터 재유도된다.
- **modelId 축(T-0774 cover)** — 각 `stepArgs.evaluation.callArgs[i].options.modelId` 가 `runPlan.pipeline.modelId` 와 같음(ADR-0048 단일 modelId source).

직전 sibling 들은 이 inputs 축을 closure 에 합류시키지 않았다:
- **T-0774 (aggregator dual-leg 5-way)**: evaluation leg 의 modelId 축 + publish leg 4축(searchArgv-marker + commandArgs.searchQuery + descriptor.marker + resolve + post)을 단일 runPlan single-source 로 수렴 박제. 그러나 **evaluation leg 의 inputs 축은 `Array.isArray(stepArgs.evaluation.inputs)` 존재만 단언**하고 `callArgs[i].input === inputs[i]` 페어링·`buildRealDataEvaluationInputs(activities)` 재유도와의 byte-identical 정합을 closure 에 묶지 않았다(T-0774 Out of Scope line 100 명시 제외).
- **T-0752 (step-args dual-leg convergence)**: aggregator 의 두 leg 가 단일 runPlan source 로 수렴함을 박제했으나 **resolve · post 미합류**.

본 task 는 그 빈 자리를 채워 **단일 검증 source `(runPlan, activities)` 가 aggregator 의 evaluation leg 의 inputs(activities 재유도) + modelId(runPlan.pipeline) 양 축과 publish leg(marker/searchArgv/run-identity) 의 source 임을 resolve+post 까지 묶은 한 chain 으로** 박제한다. 단일 source `(runPlan, activities, results, search-stdout, exec-stdout)` 로부터:

1. **evaluation-leg inputs 재유도 + 페어링(축 6, 본 task 의 새 표면)** — `stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results)` → `stepArgs.evaluation.inputs` 가 동일 `activities` 로 직접 호출한 `buildRealDataEvaluationInputs(activities)` 와 **byte-identical deep-equal**, 그리고 모든 `stepArgs.evaluation.callArgs[i].input === stepArgs.evaluation.inputs[i]`(reference 동일). 단일 `activities` 의 활동 식별자 set 이 평가 입력·호출-args input 으로 동형 재유도.
2. **evaluation-leg modelId thread(축 5, T-0774 cover 영역의 6-way 묶음 한 항)** — 모든 `stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId`.
3. **publish-leg 내부 marker 3-축 일치(축 2~4)** — `descriptor.marker === commandArgs.searchQuery === extractSearchMarker(searchArgv)`.
4. **resolve issueNumber + post run-identity(축 1, 종단)** — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)` → `action.update.issueNumber = N` → `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` → `{issueNumber, gitSha, dateToken, ...}` 가 동일 runPlan.run 전파.

이 6-way(inputs 재유도 + modelId + marker 3-축 + resolve issueNumber + post run-identity)가 **동일 단일 검증 source `(runPlan, activities)`** single-source 로 수렴함이 **search-or-update 멱등성**(REQ-009)·**raw 미보유 평가 입력 정합**(REQ-032)·**결과 리포트 재실행 정합**(REQ-037)의 aggregator-level "평가 입력 식별(inputs)과 평가 정책(modelId)과 publish 식별(marker/searchArgv/run-identity)이 같은 검증 source 에서 나옴" 의 종단 닫음이다.

gap 확인(git grep, origin/main 0076fd68): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataE2eStepArgs AND resolveRealDataResultIssueGhCommandPlan AND buildRealDataResultOutcomeStepArgs AND buildRealDataEvaluationInputs 4 동시 실 호출) 여부; done` — **0 파일**(직전 fire 실측 확인 — T-0774 는 inputs 를 `Array.isArray` 만 단언·`buildRealDataEvaluationInputs` 재유도 미import·callArgs[i].input 페어링 미합류; T-0752 는 resolve·post 미합류). `git log origin/main` 동일 영역 박제 commit 0.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-step-args.ts` — pre-실행 aggregator(T-0601). `buildRealDataE2eStepArgs(runPlan, activities, results)` → `RealDataE2eStepArgs {evaluation, publish}`. `runPlan`·`activities` 를 `buildRealDataEvaluationStepArgs(runPlan, activities)`(evaluation leg)·`buildRealDataResultPublishStepArgs(runPlan, results)`(publish leg)에 thread. 본 task 의 chain 시작 source — `stepArgs.evaluation` 가 evaluation leg(inputs+modelId 축), `stepArgs.publish` 가 publish leg(marker/searchArgv/run-identity 축).
- `test/helpers/realdata-e2e-evaluation-inputs.ts` — **본 task 의 핵심 새 source**. `buildRealDataEvaluationInputs(activities)` → `EvaluationInput[]`(production `mapActivityToEvaluationInput` 위임, 순서 보존, 매 호출 새 배열). 본 spec 이 직접 import 해 `stepArgs.evaluation.inputs` 와 byte-identical 재유도 단언에 사용. 빈 activities → `[]`(throw 0) 분기 확인.
- `test/helpers/realdata-e2e-evaluation-step-args.ts` — aggregator 의 evaluation leg 위임(T-0598). `buildRealDataEvaluationStepArgs(runPlan, activities)` → `RealDataEvaluationPlan {inputs, callArgs}`. `runPlan.pipeline.modelId` thread + activities → inputs 재유도가 어떻게 위임되는지 확인.
- `test/helpers/realdata-e2e-evaluation-plan.ts` — `interface RealDataEvaluationPlan {inputs, callArgs}`. `callArgs[i].input === inputs[i]`(reference 동일) 보장 — 본 task 의 페어링 단언 reference. inputs 는 `buildRealDataEvaluationInputs(activities)` 산출, callArgs 는 그 inputs 에 modelId options 페어링.
- `test/helpers/realdata-e2e-scoring-call-args.ts` — `interface RealDataScoringCallArgs {input, options}`. `callArgs[i].input`(EvaluationInput reference)·`callArgs[i].options.modelId` 접근 경로 — inputs 페어링 + modelId 두 축의 정확한 경로 reference.
- `test/helpers/realdata-e2e-pipeline-plan.ts` — `interface RealDataPipelinePlan {collectCallArgs, modelId}`. `runPlan.pipeline.modelId: string` 경로 — modelId 축 source.
- `test/helpers/realdata-e2e-run-plan.ts` — 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `RealDataE2eRunPlan {pipeline, run}`. synthetic `runPlan` 합성 방식 확인 — `runPlan` 이 aggregator·post 두 곳으로 thread 되는 단일 source. modelId 인자가 `runPlan.pipeline.modelId` 로, run 인자가 `runPlan.run` 으로 도달.
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — aggregator 의 publish leg 위임(T-0599). `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`. `searchArgv` 합성 + marker 위치 확인.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `interface RealDataResultIssueDescriptor {title, marker, body}`. `runToken(run)` = `${run.dateToken}@${run.gitSha}`. marker 안 run token 형식 — descriptor.marker 와 outcomeReport run-identity cross-boundary 일치 reference.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — resolve 종단 컴포저. `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` — hit 1+ → `action.update.issueNumber = 최소 number`, hit 0 → `action.create`. 본 task 는 `stepArgs.publish.commandArgs` 를 두 번째 인자로 그대로 넘김.
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — search stdout 파서. searchStdout synthetic JSON 배열 형식(`[{"number": N, ...}]`) + 비JSON/비배열/원소 number 비양수 → throw 형식 참조.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `action.update.issueNumber`(hit 1+) / `action.create`(hit 0) 분기 shape.
- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — post-실행 run-plan-threaded 컴포저(T-0600). `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` → `RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken, summaryLine}`. 독립 run 인자 미수신 — `runPlan.run` 만 thread. 파서 throw 형식 참조.
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post 파서. issue URL 패턴 `https://github.com/<owner>/<repo>/issues/<number>`. execStdout synthetic 형식 — issueNumber N 은 search hit 최소 number 와 동일 합성(cross-boundary 수렴 입력 조건).
- `test/smoke/realdata-e2e-aggregator-dual-leg-modelid-searchargv-resolve-run-plan-threading-5way-single-source-closure-assembly.smoke-spec.ts` (T-0774) — 직전 5way sibling. dual-leg(evaluation modelId + publish 4축) + spec 로컬 `extractSearchMarker(searchArgv)` 패턴 참고 + 중복 회피. **본 task 는 그 위에 evaluation leg 의 inputs 재유도(`buildRealDataEvaluationInputs(activities)` byte-identical) + `callArgs[i].input===inputs[i]` 페어링을 6번째 축으로 합류**시킨 부분만 새로 단언. modelId/marker/searchArgv/resolve/post 자체 로직은 같음.
- `test/smoke/realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts` (T-0752) — dual-leg sibling. 중복 회피 — 본 task 는 그 위에 resolve+post 합류 + inputs 재유도까지 묶은 6-way single-source closure 만 새로 단언.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-aggregator-evaluation-inputs-modelid-searchargv-resolve-run-plan-threading-6way-single-source-closure-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path aggregator 6-way chain 합성**: 단일 source — `runPlan: RealDataE2eRunPlan` synthetic 합성(`buildRealDataE2eRunPlan(seeds, modelId, run)`), `activities: Activity[]`(여러 원소, github/confluence 등 다양) + `results: EvaluationResult[]` synthetic literal, 임의 양수 `N`. 다음을 한 chain 으로 호출: `stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results)` → `searchStdout` = N 담은 search hit JSON 배열 한 줄 → `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)`(hit 1+ → update 분기) → `execStdout` = `https://github.com/owner/repo/issues/N` URL 한 줄 → `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`. 산출물이 모두 정상(stepArgs.evaluation `{inputs, callArgs}` 배열 비어있지 않음, stepArgs.publish `{report, commandArgs, searchArgv}` 정상·`report.descriptor.marker` 존재, resolvePlan.action update 분기로 `issueNumber` 보유, outcomeReport `{issueNumber,url,gitSha,dateToken,summaryLine}`) happy test 1+.
- [ ] **evaluation-leg inputs 재유도 byte-identical 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면)**: 동일 `activities` 로 직접 호출한 `buildRealDataEvaluationInputs(activities)` 가 `stepArgs.evaluation.inputs` 와 **byte-identical deep-equal**(`expect(stepArgs.evaluation.inputs).toEqual(buildRealDataEvaluationInputs(activities))`) 임을 단언 1+ test. 즉 aggregator 의 evaluation leg inputs 가 단일 `activities` source 로부터 재유도됨(평가 입력 식별자 set 이 같은 검증 source).
- [ ] **callArgs[i].input === inputs[i] reference 페어링(branch — 핵심 불변식 2, 본 task 의 새 표면)**: 모든 `stepArgs.evaluation.callArgs[i].input` 이 `stepArgs.evaluation.inputs[i]` 와 **referential 동일**(`expect(stepArgs.evaluation.callArgs[i].input).toBe(stepArgs.evaluation.inputs[i])`)·길이 일치(`callArgs.length === inputs.length`) 임을 단언 1+ test(callArgs 비어있지 않은 경우 forEach). inputs ↔ callArgs.input 페어링이 1:1 보존.
- [ ] **evaluation-leg modelId thread 수렴(branch — 핵심 불변식 3)**: 모든 `stepArgs.evaluation.callArgs[i].options.modelId` 가 `runPlan.pipeline.modelId` 와 **byte-identical**(`callArgs.forEach(c => expect(c.options.modelId).toBe(runPlan.pipeline.modelId))`, callArgs 비어있지 않은 경우) 단언 1+ test.
- [ ] **publish-leg 내부 marker 3-축 일치(branch — 핵심 불변식 4)**: spec 로컬 `extractSearchMarker(searchArgv)`(`searchArgv.indexOf("--match")` 다음 토큰, T-0774 패턴 차용)로 추출한 marker 가 `stepArgs.publish.report.descriptor.marker` 및 `stepArgs.publish.commandArgs.searchQuery` 와 **세 지점 모두 byte-identical** 단언 1+ test.
- [ ] **marker → resolve issueNumber + post run-identity 수렴(branch — 핵심 불변식 5)**: search hit N → `resolvePlan.action.update.issueNumber` → `outcomeReport.issueNumber` 가 **세 지점 모두 동일 N**(`expect(resolvePlan.action.update.issueNumber).toBe(N)` AND `expect(outcomeReport.issueNumber).toBe(N)` AND `expect(outcomeReport.url).toContain(`/issues/${N}`)`) AND 동일 `runPlan.run` 전파(`expect(stepArgs.publish.report.descriptor.marker).toContain(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`)` AND `expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha)` AND `expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken)` AND `expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha)` AND `expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken)`) 단언 1+ test.
- [ ] **6-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)**: 위 다섯 불변식의 핵심 등식을 한 test 안에 묶어 "evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[].input === inputs[i], callArgs[].options.modelId == runPlan.pipeline.modelId, searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken}" 6-way 가 단일 source(runPlan+activities) single-source 에서 동시 성립함을 1+ test 로 명시(중복이 아니라 6-way 동시 closure 의 명시적 박제 — inputs 축이 modelId/marker/searchArgv/run-identity 와 같은 검증 source 의 산물).
- [ ] **inputs 축 변별성(branch — activities 가 inputs 를 결정, modelId·run 은 독립 축)**: 두 chain — activities_A(원소 집합 X) vs activities_B(원소 집합 Y, 서로 다른 unitId set)로 같은 runPlan·N 으로 chain 호출 → A chain 의 `stepArgs.evaluation.inputs` 는 `buildRealDataEvaluationInputs(activities_A)`, B chain 은 `(activities_B)` 와 각각 byte-identical(activities 가 inputs/callArgs.input 을 결정) → 그러나 두 chain 의 `callArgs[].options.modelId`(=runPlan.pipeline.modelId) / `descriptor.marker` / `searchArgv` --match / resolve issueNumber / outcomeReport.{gitSha,dateToken} 는 **동일**(activities 변경이 modelId·marker·run-identity·issueNumber 어느 축에도 누설 0 — REQ-009 정합) 1+ test. "activities 는 inputs 만 변별, modelId·marker·run-identity·issueNumber 는 불변" 의 축 분리 박제.
- [ ] **modelId·run 변별성(branch — 같은 activities, 다른 runPlan → inputs 불변·modelId/run-identity 변별)**: 동일 `activities`·동일 N 을 고정하고 runPlan_A `{pipeline.modelId:"model-x", run:{gitSha:"abc1234", dateToken:"2026-06-21"}}` vs runPlan_B `{pipeline.modelId:"model-y", run:{gitSha:"def5678", dateToken:"2026-06-29"}}` → 두 chain 의 `stepArgs.evaluation.inputs` 는 **동일**(`buildRealDataEvaluationInputs(activities)` 가 modelId·run 무관) 이나 `callArgs[].options.modelId` 는 A="model-x"/B="model-y", `descriptor.marker`·searchArgv·outcomeReport.{gitSha,dateToken} 는 각 run token 으로 **변별** 1+ test. "modelId·run 변경이 inputs(=activities 종속)에 누설 0" 박제.
- [ ] **create 분기 격리(branch — 검색 미스 → create, inputs·modelId·searchArgv·post 무관)**: 동일 runPlan·activities·results 로 chain 호출하되 `searchStdout` 빈 hit(`[]`) → `resolvePlan.action` 이 **create 분기**(`action.create` defined, `action.update` 부재) 단언 1+ test. 이때 `stepArgs.evaluation.inputs`(= activities 재유도) / `callArgs[].options.modelId` / `stepArgs.publish.searchArgv` --match marker 는 create/update 두 분기 모두 동일(검색 결과가 evaluation inputs·modelId·검색 인자 벡터를 바꾸지 0).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(boundary 거부 대칭 박제):
  - `runPlan.pipeline.modelId` 빈/공백(modelId="") → aggregator 측 evaluation 위임 modelId guard throw(evaluation leg 비식별 — inputs 재유도 도달 전 차단 가능). **참고: `buildRealDataE2eRunPlan` 자체가 modelId guard 를 먼저 걸 수 있으므로 throw 지점(run-plan 합성 vs aggregator)을 helper 시그니처로 확인해 단언**(어느 단계든 throw 발생을 단언).
  - `runPlan.run.gitSha` 빈/공백 → publish 위임 report-plan `assertNonBlank("gitSha")` throw(publish leg 비식별). modelId·activities 정상이어도 차단.
  - `runPlan.run.dateToken` 빈/공백 → publish 위임 report-plan `assertNonBlank("dateToken")` throw 대칭.
  - `runPlan.run.gitSha` 빈/공백 → post(`buildRealDataResultOutcomeStepArgs`) 위임 `assertNonBlank` throw(post boundary 비식별 — execStdout 정상이어도 차단, aggregator/post 대칭).
  - `searchStdout` 비JSON/비배열(`"not json"`) → resolve parse 위임 throw(검색 미산출 — stepArgs.publish.commandArgs 정상이어도 차단).
  - `execStdout` URL 미발견(빈 문자열·무관 텍스트) → post 파서 위임 throw(post 미산출 — runPlan.run 정상이어도 차단).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/abc`) → post 파서 `assertPositiveIssueNumber` throw(post 비식별).
  - **inputs 축 negative** — `activities` 중 변환 불가 원소(production 매퍼가 throw 하는 형식, 예: 미지원 sourceType) 포함 → aggregator evaluation 위임(`buildRealDataEvaluationInputs` 내 `mapActivityToEvaluationInput`) throw 가 자체 try/catch 없이 그대로 전파(inputs 재유도 실패 → step-args 산출 차단). modelId·run 정상이어도 차단. **단 production 매퍼의 throw 형식을 helper 시그니처로 확인해 실제 throw 하는 입력만 사용**(매퍼가 모든 sourceType 을 관대하게 받으면 본 negative 는 "빈 activities → inputs `[]` 정상(throw 0)" 경계 단언으로 대체하고 본문에 그 대체 사유 명시).
- [ ] **결정론·무공유·no-mutation**: 동일 (runPlan, activities, results, searchStdout, execStdout) 입력으로 chain 두 번 호출 → stepArgs(evaluation+publish)/resolvePlan/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(runPlan, activities, results) 가 chain 호출 후 mutate 0(원본 deep-equal 유지 — 특히 aggregator 의 두 leg 와 post 가 같은 `runPlan` / `activities` 공유 읽기 해도 변형 0) 1+ test. AND 직접 호출 `buildRealDataEvaluationInputs(activities)` 와 `stepArgs.evaluation.inputs` 는 deep-equal 이되 top-level 배열은 referential 분리(`not.toBe`, 무공유) 1+ test.
- [ ] **credential 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 stepArgs.evaluation.inputs(직렬화)·callArgs / stepArgs.publish.searchArgv(배열 각 원소) / commandArgs.searchQuery / report.descriptor.{title,marker,body} / resolvePlan.argv / outcomeReport.{url,summaryLine} 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper export type 과 정합(특히 `callArgs[].input`/`inputs[i]` EvaluationInput·`searchArgv: string[]` 인덱싱).
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern aggregator-evaluation-inputs-modelid-searchargv-resolve-run-plan-threading` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 LLM scoreUnit 호출 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 search-stdout / exec-stdout 만. evaluation.inputs 는 **식별자 운반만** 검증(실 scoreUnit 호출 0).
- aggregator dual-leg(evaluation modelId + publish searchArgv) 5-way 자체 재단언 금지(T-0774 cover). 본 task 는 **evaluation leg inputs 재유도(`buildRealDataEvaluationInputs(activities)` byte-identical) + `callArgs[i].input===inputs[i]` 페어링을 6번째 축으로 합류**시킨 부분만 새로 단언.
- aggregator dual-leg ↔ 직접 호출(`buildRealDataEvaluationStepArgs`·`buildRealDataResultPublishStepArgs`) byte-identical 자체 재단언 금지(T-0752 cover). 본 task 는 inputs 재유도 + resolve+post 합류 6-way closure 만.
- `mapActivityToEvaluationInput` 의 contributionKind 정규화·unitId 합성·raw 미보유 매핑 로직 자체 재단언 금지(evaluation-inputs helper spec / production mapper spec cover). 본 task 는 aggregator 산출 inputs 가 단일 source `activities` 재유도와 byte-identical 함만.
- 난이도별 modelId routing(R-97 deferred) 검증 금지 — 단일 modelId 동형 적용(ADR-0048)만.
- searchArgv 전체 형식(gh issue list 플래그 순서·--repo·--state 등) 재단언 금지(search-gh-argv 가드 / T-0729 cover). 본 task 는 `--match` 위치 marker 토큰만.
- commandArgs createArgs/updateArgs 정합·labels 재단언 금지(command-args 가드 cover).
- resolve argv 합성(gh issue create/edit argv 형식) 재단언 금지(gh-command-plan 가드 cover). 본 task 는 `action.update.issueNumber` 해소 결과만.
- from-output 단독 5필드(url trim·summaryLine 합성) 재유도 재단언 금지(T-0747 cover). 본 task 는 6-way 수렴만.
- `runPlan` pipeline 측 collectCallArgs shape·guard 재단언 금지(run-plan / pipeline-plan helper spec cover).
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper export 그대로 import 만. `extractSearchMarker` 는 spec 로컬 함수(T-0774/T-0729 패턴 차용).
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper export 시그니처만 import 해 single-source(동일 runPlan + activities + results + search-stdout + exec-stdout)로 `buildRealDataE2eStepArgs(runPlan, activities, results)` → `resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)` → `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` 를 한 chain 으로 호출하는 합성 smoke 작성. **핵심 새 표면 = evaluation leg inputs 축 합류 — `stepArgs.evaluation.inputs` 가 동일 activities 로 직접 호출한 `buildRealDataEvaluationInputs(activities)` 와 byte-identical deep-equal AND `callArgs[i].input === inputs[i]` reference 페어링**, 이 inputs 축이 modelId(=runPlan.pipeline.modelId) + searchArgv --match marker == descriptor.marker == commandArgs.searchQuery + resolve issueNumber + post run-identity 와 함께 단일 source(runPlan+activities) 6-way 동시 수렴. `extractSearchMarker(searchArgv)` 는 T-0774/T-0729 로컬 헬퍼 패턴 차용하되 실제 helper searchArgv 형식으로 인덱스 확정. `runPlan` synthetic 합성은 `buildRealDataE2eRunPlan(seeds, modelId, run)` 으로. inputs negative 의 throw 가능 여부(production 매퍼가 미지원 sourceType 에 throw 하는지)를 helper 시그니처로 확인해, throw 안 하면 "빈 activities → inputs `[]` 정상" 경계 단언으로 대체하고 사유 명시.).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
