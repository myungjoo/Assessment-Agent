---
id: T-0773
title: realdata-e2e step④ aggregator-publish-leg search-argv 합류 4-way single-source closure — buildRealDataE2eStepArgs(runPlan, activities, results).publish 의 {report.descriptor.marker, commandArgs.searchQuery, searchArgv(--match 토큰)} 3-내부-축 ↔ resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs).action.update.issueNumber ↔ buildRealDataResultOutcomeStepArgs(runPlan, execStdout) run-identity 가 단일 검증 runPlan single-source 로 marker+issueNumber+run-identity+search-argv 동시 수렴 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ sweep — T-0772(aggregator.publish→resolve→outcome triple-boundary run-plan-threading) 위에 stepArgs.publish.searchArgv(live runner 가 gh issue list 에 넘기는 실 CLI 벡터) 의 --match 마커를 4번째 축으로 합류시켜 aggregator-anchored 4-way single-source closure 로 확장; git grep buildRealDataE2eStepArgs AND searchArgv AND resolve AND buildRealDataResultOutcomeStepArgs 4축 동시-호출 smoke 0 부재 실측 확인(기존 4way T-0729 는 top-orchestrator publishPlan 진입·post 미합류)"
independentStream: realdata-e2e-aggregator-publish-searchargv-resolve-run-plan-threading-4way-closure-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·aggregator-publish-leg 4-way 4-축 동시 수렴(searchArgv --match 마커 + commandArgs.searchQuery + descriptor.marker + resolve issueNumber + post run-identity)·단일 runPlan aggregator·post threading·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0772(300)/T-0771(300)/T-0770(573)/T-0769(544) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-aggregator-publish-searchargv-resolve-run-plan-threading-4way-single-source-closure-assembly.smoke-spec.ts
---

# T-0773 — realdata-e2e step④ aggregator-publish-leg search-argv 합류 4-way single-source closure non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 build-time 순수 layer 는 **검증된 단일 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}`, T-0597)을 pre-실행 aggregator(`buildRealDataE2eStepArgs(runPlan, activities, results)` → `{evaluation, publish}`, T-0601)에 통째로 넘기고**, 그 aggregator 의 `.publish` leg(`RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`)가 **세 내부 축에 동일 marker 를 일관 운반**한다:

1. `stepArgs.publish.report.descriptor.marker` — 멱등 검색·갱신용 안정 run token(`${run.dateToken}@${run.gitSha}` 포함).
2. `stepArgs.publish.commandArgs.searchQuery` — `= descriptor.marker`(검색 문자열).
3. `stepArgs.publish.searchArgv` — **live runner 가 `execFile('gh', searchArgv)` 로 실 실행하는 gh issue list CLI 벡터**. `--match <marker>` 위치에 동일 marker 가 박혀 있어, 실제 gh 검색이 거는 토큰이 곧 descriptor.marker / commandArgs.searchQuery 와 byte-identical 이어야 멱등 검색이 성립한다.

직전 sibling T-0772 는 aggregator-publish-leg run-plan-threading triple-boundary closure 를 박제했으나 **publish leg 의 내부 marker 축을 `report.descriptor.marker` + `commandArgs.searchQuery` 두 개만** 다뤘다. 즉 "live runner 가 gh 검색에 **실제로** 넘기는 인자 벡터(`searchArgv`)" 가 같은 marker 를 운반하는지는 triple-boundary chain 에 합류되지 않았다. 기존 4-way sibling(T-0729, `realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence`)은 searchArgv 를 다루나 **top-orchestrator `buildRealDataResultIssuePublishPlan(results, run)` 진입**(run 독립 인자, aggregator 미경유·run-plan-threading 미사용)이며 **post-실행 outcome leg(`buildRealDataResultOutcomeStepArgs`) 미합류**(run-identity 수렴 경계 미경유).

본 task 는 그 자리를 채워 **chain 을 pre-실행 aggregator `buildRealDataE2eStepArgs` 의 `.publish` leg 로 잡고 searchArgv 를 4번째 축으로 합류**시켜, 단일 검증 `runPlan` 이 aggregator 경유로 thread 된 `.publish` 의 세 내부 marker 축(descriptor.marker / commandArgs.searchQuery / searchArgv --match 토큰)이 서로 byte-identical 이고, 그 marker 가 resolve 의 issueNumber 해소 + post 의 run-identity 전파와 한 chain 으로 묶여 **단일 source 4-way 수렴**함을 박제한다. 단일 source `(runPlan, activities, results, search-stdout, exec-stdout)` 로부터:

1. **aggregator-publish 내부 marker 3-축 일치** — `stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results)` → `stepArgs.publish.report.descriptor.marker === stepArgs.publish.commandArgs.searchQuery === extractSearchMarker(stepArgs.publish.searchArgv)`(searchArgv 의 `--match` 다음 토큰). 세 내부 축이 동일 marker 운반.
2. **resolve** — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)` → marker 로 검색해 hit 1+ → `action.update.issueNumber = N`.
3. **post-실행 run-plan-threaded** — `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` → `{issueNumber, url, gitSha, dateToken, summaryLine}`. **동일 `runPlan`**(독립 run 인자 미수신)의 gitSha/dateToken 전파.

이 4-way(aggregator-publish 내부 marker 3-축 + resolve issueNumber + post run-identity)가 **동일 단일 검증 `runPlan`** single-source 로 byte-identical 수렴함이 **search-or-update 멱등성**(REQ-009)·**결과 리포트 재실행 정합**(REQ-037)의 aggregator-level "실 검색 인자 벡터까지 포함한" 종단 닫음이다 — 즉 "live runner 가 gh 에 실제로 거는 검색 토큰" 과 "resolve 가 검색에 쓰는 토큰" 과 "post 가 해석한 run-identity" 가 재전달 0 로 같은 source 에서 drift 0 수렴함.

직전 sibling 들은 진입점·축 구성이 달랐다:
- **T-0772 (aggregator-publish triple-boundary)**: aggregator `.publish` leg 진입하나 marker 축이 `descriptor.marker` + `commandArgs.searchQuery` 두 개만(searchArgv 미합류).
- **T-0771 (step-level 컴포저 triple-boundary)**: `buildRealDataResultPublishStepArgs` 직접 진입(aggregator 미경유, searchArgv 미합류).
- **T-0770 (top-orchestrator triple-boundary)**: `buildRealDataResultIssuePublishPlan(results, run)` 진입(run 독립 2회 전달, searchArgv 미합류).
- **T-0729 (publish-plan-search-argv-resolve-marker 4way)**: searchArgv 합류하나 **top-orchestrator 진입**(aggregator 미경유·run-plan-threading 미사용) + **post outcome 미합류**(run-identity 수렴 경계 미경유).

본 task 는 **aggregator(`buildRealDataE2eStepArgs`).publish 진입 + searchArgv 합류 + post outcome 합류 동시 성립**이 새 결정 표면이다 — "단일 검증 `runPlan` 이 aggregator 를 통과해 publish leg 로 thread 된 후, 그 leg 가 산출한 실 gh 검색 인자 벡터(searchArgv)의 marker 가 descriptor.marker / commandArgs.searchQuery 와 같고, 그 marker 로 resolve 가 해소한 N 과 post 가 같은 runPlan 으로 해석한 run-identity 가 한 chain 안에서 동시 수렴" 의 4-way 일치.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataE2eStepArgs AND searchArgv AND resolveRealDataResultIssueGhCommandPlan AND buildRealDataResultOutcomeStepArgs 4축 다 실 호출) 여부; done` — **0 파일**(직전 fire 실측 확인 — 유일 MATCH 는 T-0772 spec 의 Out-of-Scope 주석 텍스트뿐, 실 호출 0). `git log origin/main` 에서 동일 영역 박제 commit 0.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-step-args.ts` — pre-실행 aggregator(T-0601). `buildRealDataE2eStepArgs(runPlan, activities, results)` → `RealDataE2eStepArgs {evaluation, publish}`. `runPlan` 을 한 번만 받아 `buildRealDataResultPublishStepArgs(runPlan, results)`(publish leg)·`buildRealDataEvaluationStepArgs(runPlan, activities)`(evaluation leg)에 통째로 thread(재전달 0). `runPlan.run.gitSha`/`dateToken` 빈/공백 → publish 위임 guard throw 전파. 본 task 의 chain 시작 source — `stepArgs.publish` 가 publish leg, 그 안 `{report, commandArgs, searchArgv}` 세 내부 marker 축의 source.
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — aggregator 의 publish leg 위임(T-0599). `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`. `searchArgv` 가 어떻게 합성되는지(어느 helper 가 `--match <marker>` 박는지) 확인 — searchArgv 의 marker 위치 식별에 필요.
- `test/helpers/realdata-e2e-result-issue-publish.ts` 또는 `realdata-e2e-result-issue-command-args.ts` — `interface RealDataResultIssuePublishPlan` 의 `searchArgv: string[]` 필드 정의 + `searchQuery: descriptor.marker`(commandArgs). searchArgv 가 `gh issue list ... --match <marker> ...` 형태인지 / marker 가 어느 인덱스(예: `--match` 다음, `--search` 다음)에 박히는지 실제 export 로 확인 — `extractSearchMarker(searchArgv)` 헬퍼 구현(spec 로컬)에 필요.
- `test/smoke/realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-assembly.smoke-spec.ts` (T-0729) — 직전 4way sibling. spec 로컬 `extractSearchMarker(searchArgv)` 구현(`searchArgv.indexOf("--match")` → `+2` 토큰 등) 패턴 참고 + 중복 회피. T-0729 는 **top-orchestrator publishPlan 진입·post 미합류** — 본 task 는 **aggregator(`buildRealDataE2eStepArgs`).publish 진입 + post outcome 합류 + 단일 runPlan threading** 부분만 새로 단언. searchArgv↔commandArgs.searchQuery↔descriptor.marker 3-축 일치 자체 로직은 같으나 진입점·run-plan-threading·post 합류가 달라 새 표면.
- `test/helpers/realdata-e2e-run-plan.ts` — 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `RealDataE2eRunPlan {pipeline, run}`. `run: RealDataResultIssueRunRef {gitSha, dateToken}`. synthetic `runPlan` 합성 방식(`buildRealDataE2eRunPlan` 호출 또는 literal) 확인 — `runPlan` 이 aggregator·post 두 곳으로 thread 되는 단일 source.
- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — post-실행 run-plan-threaded 컴포저(T-0600). `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` → `RealDataResultIssueOutcomeReport`. 독립 run 인자 미수신 — `runPlan.run` 만 thread(재전달 0). 잘못된 stdout(URL 미발견·`/pull/`·issueNumber 비양수) → 파서 throw 전파, `runPlan.run` 빈/공백 → 빌더 guard throw 전파. 본 task 의 chain post boundary.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `interface RealDataResultIssueDescriptor {title, marker, body}`. `interface RealDataResultIssueRunRef {gitSha, dateToken}`. `runToken(run)` = `${run.dateToken}@${run.gitSha}`. marker 안 run token 형식 — `stepArgs.publish.report.descriptor.marker` 와 `outcomeReport` run-identity 의 cross-boundary 일치 단언 reference.
- `test/helpers/realdata-e2e-result-report-plan.ts` — `interface RealDataResultReportPlan {summary, descriptor}`. `stepArgs.publish.report.descriptor.marker` 경로로 marker 에 도달 reachable 확인.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — resolve 종단 컴포저. `interface RealDataResultIssueGhCommandPlan {action, argv}`. `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` — hit 1+ → `action.update.issueNumber = 최소 number`, hit 0 → `action.create`. 본 task 는 `stepArgs.publish.commandArgs` 를 두 번째 인자로 그대로 넘김(resolve stage).
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — search stdout 파서. `parseRealDataResultIssueSearchOutput(stdout)` 가 받는 JSON 배열 stdout 형식(`[{"number": N, ...}]` 류) 확인 — searchStdout synthetic literal 합성용. 비JSON/비배열/원소 number 비양수 → throw 형식 참조.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `action.update.issueNumber`(hit 1+) / `action.create`(hit 0) 분기 shape. update 분기 issueNumber 접근 경로.
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post 파서. `interface RealDataResultIssueOutcome {issueNumber, url}`. GitHub issue URL 패턴 `https://github.com/<owner>/<repo>/issues/<number>`. execStdout(URL 한 줄) synthetic 합성 형식 — issueNumber N 은 search hit 최소 number 와 동일하게 합성(cross-boundary 수렴 입력 조건).
- `test/helpers/realdata-e2e-evaluation-step-args.ts` 또는 `Activity`·`EvaluationResult` 정의 — `buildRealDataE2eStepArgs` 의 `activities: Activity[]` / `results: EvaluationResult[]` synthetic literal 합성 shape 확인(aggregator 입력 3종).
- `test/smoke/realdata-e2e-aggregator-publish-resolve-run-plan-threading-triple-boundary-single-source-closure-assembly.smoke-spec.ts` (T-0772) — 직전 sibling aggregator-publish triple-boundary smoke. 중복 회피 — 본 task 는 그 위에 **searchArgv 를 4번째 축으로 합류**시킨 부분만 새로 단언. descriptor.marker + commandArgs.searchQuery 2-축 일치 + resolve + post run-identity triple-boundary 자체 재단언 금지(T-0772 cover). searchArgv --match 토큰 ↔ marker byte-identical + 그 marker 가 동일 chain 의 resolve/post 와 4-way 수렴이 본 task 의 새 단언.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-aggregator-publish-searchargv-resolve-run-plan-threading-4way-single-source-closure-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path aggregator-publish-leg 4-way chain 합성**: 단일 source — `runPlan: RealDataE2eRunPlan` synthetic 합성(Required Reading 의 run-plan helper 로 합성 방식 확인), `activities: Activity[]` + `results: EvaluationResult[]` synthetic literal, 임의 양수 `N`. 다음을 한 chain 으로 호출: `stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results)` → `searchStdout` = N 을 number 로 담은 search hit JSON 배열 한 줄 → `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)`(hit 1+ → update 분기) → `execStdout` = `https://github.com/owner/repo/issues/N` URL 한 줄 → `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`. 네 산출물이 모두 정상(stepArgs.publish `{report, commandArgs, searchArgv}` 비어있지 않음·`Array.isArray(stepArgs.publish.searchArgv)`·`report.descriptor.marker` 존재, resolvePlan.action 이 update 분기로 `issueNumber` 보유, outcomeReport `{issueNumber,url,gitSha,dateToken,summaryLine}`) happy test 1+.
- [ ] **aggregator-publish 내부 marker 3-축 일치(branch — 핵심 불변식 1, 본 task 의 새 표면)**: spec 로컬 `extractSearchMarker(searchArgv)`(예: `searchArgv.indexOf("--match")` 위치의 다음 토큰 — 실제 helper 의 searchArgv 형식으로 인덱스 확정) 로 추출한 marker 가 `stepArgs.publish.report.descriptor.marker` 및 `stepArgs.publish.commandArgs.searchQuery` 와 **세 지점 모두 byte-identical** 임을 단언 1+ test — `expect(stepArgs.publish.commandArgs.searchQuery).toBe(stepArgs.publish.report.descriptor.marker)` AND `expect(extractSearchMarker(stepArgs.publish.searchArgv)).toBe(stepArgs.publish.report.descriptor.marker)`. 즉 "live runner 가 gh 검색에 실제로 거는 인자 벡터의 marker" 가 descriptor.marker / commandArgs.searchQuery 와 같음(실 검색 토큰 drift 0).
- [ ] **marker → resolve issueNumber 수렴(branch — 핵심 불변식 2)**: search hit 에 넣은 N → resolve(`stepArgs.publish.commandArgs.searchQuery`=marker 로 검색)가 해소한 `resolvePlan.action.update.issueNumber` → post(`outcomeReport.issueNumber`)가 **세 지점 모두 동일 N** 임을 묶어 단언 1+ test — `expect(resolvePlan.action.update.issueNumber).toBe(N)` AND `expect(outcomeReport.issueNumber).toBe(N)` AND `expect(outcomeReport.url).toContain(`/issues/${N}`)`.
- [ ] **단일 runPlan aggregator·post threading run-identity 수렴(branch — 핵심 불변식 3)**: **동일 `runPlan` 한 객체**를 aggregator(`buildRealDataE2eStepArgs`)와 post(`buildRealDataResultOutcomeStepArgs`)에 넘겼을 때(독립 run 인자 재전달 0), 단일 `runPlan.run` 으로부터 도출된 gitSha·dateToken 이 aggregator 의 publish leg(`stepArgs.publish.report.descriptor.marker` run token, 따라서 searchArgv --match 토큰에도 동일)와 post(전파)에서 동일함을 단언 1+ test — `expect(stepArgs.publish.report.descriptor.marker).toContain(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`)` AND `expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha)` AND `expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken)` AND `expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha)` AND `expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken)`. 즉 step① 검증된 단일 `runPlan` 이 aggregator 를 통과해 publish leg(+searchArgv)로 thread 된 후에도 재전달 0 로 pre/post 양쪽 run-identity 의 source 가 됨.
- [ ] **4-way 단일-source 묶음 단언(branch — closure 종단)**: 위 세 불변식의 핵심 등식을 한 test 안에 묶어 "searchArgv --match 토큰 == descriptor.marker == commandArgs.searchQuery, 그 marker 로 resolve 가 찾은 N == post 가 해석한 N, 그 marker 의 run token == post 가 전파한 {gitSha,dateToken}" 4-way 가 단일 runPlan single-source 에서 동시 성립함을 1+ test 로 명시(중복 단언이 아니라 4-way 동시 closure 의 명시적 박제).
- [ ] **create 분기 격리(branch — 검색 미스 → create, searchArgv·post 무관)**: 동일 runPlan·activities·results 로 chain 을 호출하되 `searchStdout` 을 빈 hit(`[]` 또는 marker 미포함 hit)로 합성 → `resolvePlan.action` 이 **update 가 아니라 create 분기**(`action.create` defined, `action.update` 부재) 임을 단언 1+ test. 이때 `stepArgs.publish.searchArgv` 의 --match marker 는 create/update 두 분기 모두 동일(검색 결과가 검색 인자 벡터를 바꾸지 0). post(`buildRealDataResultOutcomeStepArgs`)는 여전히 execStdout 의 N 으로 issueNumber 산출 — resolve 의 create 분기 진입이 searchArgv·post 의 산출 경로와 독립(검색 결과 변경이 검색 인자·실행-stdout 해석에 누설 0).
- [ ] **runPlan.run 변별성(branch — 다른 run→다른 marker+searchArgv, 같은 runPlan→4-way 수렴)**: 서로 다른 `runPlan.run` 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-06-21"}`, run_B `{gitSha:"def5678", dateToken:"2026-06-29"}`)로 각각 runPlan 합성 → 각각 동일 N 으로 chain 호출 → 두 chain 의 `extractSearchMarker(stepArgs.publish.searchArgv)` / `descriptor.marker` / outcomeReport.{gitSha,dateToken} 가 **각각 run_A·run_B 로 분리 수렴**(서로 다른 token, 단 각 chain 안에서 searchArgv-marker/descriptor.marker/post run-identity 일치) 1+ test. issueNumber N 은 두 chain 모두 동일(search-stdout 종속, run 과 무관)임도 단언 — "runPlan.run 은 변별(searchArgv 까지), issueNumber 는 search-stdout 종속" 의 축 분리 박제.
- [ ] **activities·results 무관 — 4-way 수렴 격리(branch — partial-thread 격리)**: 동일 `runPlan`·동일 N(searchStdout/execStdout)을 고정하고 `activities`·`results`(aggregator 입력)의 분포 값만 다르게 두 chain 호출 → 두 chain 의 `extractSearchMarker(searchArgv)` / `descriptor.marker` / `commandArgs.searchQuery` / resolvePlan.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 가 **두 경우 동일**(activities·results 변경이 marker·searchArgv·issueNumber·run-identity 어느 축에도 누설 0 — REQ-009 "동일 run → 동일 marker, 활동·결과 무관" 정합) 1+ test. 단 `stepArgs.publish.report.summary`(또는 descriptor.body) 는 두 경우 달라야 함(results 본문 반영 — 다른 축은 불변).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(boundary 의 거부 대칭 박제):
  - `runPlan.run.gitSha` 빈/공백(`runPlan.run = {gitSha:"", dateToken:"2026-06-29"}`) → aggregator(`buildRealDataE2eStepArgs`)측 publish 위임 report-plan `assertNonBlank("gitSha")` throw(chain 시작 비식별 — searchArgv 도 합성 안 됨).
  - `runPlan.run.dateToken` 빈/공백 → aggregator측 publish 위임 report-plan `assertNonBlank("dateToken")` throw 대칭.
  - `runPlan.run.gitSha` 빈/공백 → post(`buildRealDataResultOutcomeStepArgs`)측 위임 빌더 `assertNonBlank` throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, aggregator/post 대칭).
  - `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve 의 parse 위임 throw(검색 미산출 — stepArgs.publish.commandArgs.searchQuery·searchArgv 정상이어도 hits 추출 실패로 resolve 차단).
  - `execStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → post 의 파서 위임 throw(post 미산출 — runPlan.run 정상이어도 outcome 추출 실패).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/abc`) → post 의 파서 `assertPositiveIssueNumber` throw(post 비식별).
- [ ] **결정론·무공유·no-mutation**: 동일 (runPlan, activities, results, searchStdout, execStdout) 입력으로 chain 두 번 호출 → stepArgs.publish(searchArgv 포함)/resolvePlan/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(runPlan, activities, results) 가 chain 호출 후 mutate 0(원본 deep-equal 유지 — 특히 aggregator 와 post 가 같은 `runPlan` 공유 읽기 해도 변형 0) 1+ test. AND 각 stage 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제.
- [ ] **credential 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 stepArgs.publish.searchArgv(배열 각 원소) / stepArgs.publish.commandArgs.searchQuery / stepArgs.publish.report.descriptor.{title,marker,body} / resolvePlan.argv / outcomeReport.{url,summaryLine} 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합(특히 `searchArgv: string[]` 인덱싱).
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern aggregator-publish-searchargv-resolve-run-plan-threading` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', searchArgv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 search-stdout / exec-stdout 만. searchArgv 는 **벡터의 marker 토큰만** 검증(실 실행 0).
- aggregator-publish-leg run-plan-threading **triple-boundary**(descriptor.marker + commandArgs.searchQuery 2-축 + resolve + post) 자체 재단언 금지(T-0772 cover). 본 task 는 **searchArgv 를 4번째 축으로 합류**시킨 부분만 새로 단언.
- top-orchestrator(`buildRealDataResultIssuePublishPlan(results, run)`) 진입 search-argv-resolve-marker 4way(post 미합류) 자체 재단언 금지(T-0729 cover). 본 task 는 aggregator 진입 + post outcome 합류 + run-plan-threading 부분만.
- step-level 컴포저(`buildRealDataResultPublishStepArgs`) 직접 진입 triple-boundary 자체 재단언 금지(T-0771 cover).
- aggregator 의 evaluation/publish 두 leg ↔ 직접 호출 byte-identical 자체 재단언 금지(T-0752 step-args-dual-leg cover). 본 task 는 `.publish` leg 의 searchArgv 합류 4-way 수렴만.
- aggregator 의 evaluation leg(`stepArgs.evaluation`) shape·modelId thread·callArgs 정합 재단언 금지(dual-leg / evaluation-step-args 가드 cover).
- searchArgv 의 **전체 형식**(gh issue list 플래그 순서·--repo·--state 등 전 인자 정합) 재단언 금지(search-gh-argv 가드 / T-0729 cover). 본 task 는 `--match` 위치의 marker 토큰이 descriptor.marker 와 같음만(나머지 인자 형식 재단언 0).
- commandArgs 의 createArgs/updateArgs 정합(title/body=descriptor 보존)·labels 재단언 금지(command-args 가드 cover). 본 task 는 `searchQuery=descriptor.marker` 운반 + searchArgv marker 운반만.
- resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언 금지(gh-command-plan 가드 cover). 본 task 는 `action.update.issueNumber` 해소 결과만.
- from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언 금지(T-0747 cover). 본 task 는 4-way issueNumber/run-identity/searchArgv-marker 수렴만.
- `runPlan` 의 pipeline 측(collectCallArgs·modelId) shape·guard 재단언 금지(run-plan helper spec cover). 본 task 는 `runPlan.run` threading 만.
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper 들의 export 를 그대로 import 만. `extractSearchMarker` 는 spec 로컬 함수(T-0729 패턴 차용).
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 pre-aggregator(`buildRealDataE2eStepArgs(runPlan, activities, results)`)→resolve(`resolveRealDataResultIssueGhCommandPlan(searchStdout, stepArgs.publish.commandArgs)`)→post(`buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`)를 같은 smoke 안에서 single-source(동일 runPlan + activities + results + search-stdout + exec-stdout)로 한 chain 으로 호출하는 합성 smoke 작성. **핵심 새 표면 = `stepArgs.publish.searchArgv` 의 `--match` marker 토큰(live runner 가 gh 에 실제로 거는 검색 인자)이 `descriptor.marker` / `commandArgs.searchQuery` 와 byte-identical 이고, 그 marker 가 resolve 의 issueNumber 해소 + post 의 run-identity 와 4-way 수렴**. `extractSearchMarker(searchArgv)` 는 T-0729 spec 의 로컬 헬퍼 패턴(`searchArgv.indexOf("--match")` → 다음 토큰 등) 차용하되, **실제 helper 의 searchArgv 형식**(--match 위치·인덱스)을 export 로 확인해 추출 인덱스를 확정. `runPlan` synthetic 합성 방식·`stepArgs.publish.report.descriptor.marker` run token 형식·action.update.issueNumber 접근 경로·search hit JSON 형식은 각 helper 의 export 시그니처로 실제 확인해 단언 문자열 결정).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
