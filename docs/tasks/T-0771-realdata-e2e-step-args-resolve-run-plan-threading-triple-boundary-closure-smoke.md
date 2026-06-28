---
id: T-0771
title: realdata-e2e step④ run-plan-threading triple-boundary single-source closure — buildRealDataResultPublishStepArgs(runPlan, results)(pre) → resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs).action.update.issueNumber ↔ buildRealDataResultOutcomeStepArgs(runPlan, execStdout)(post) 가 단일 검증 runPlan.run(step① 보존) single-source 로 marker+issueNumber+run-identity 동시 수렴 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ sweep — T-0770(top-orchestrator buildRealDataResultIssuePublishPlan(results,run) 진입 triple-boundary closure) 위에 chain 시작을 run-plan-side step-args 컴포저(buildRealDataResultPublishStepArgs / buildRealDataResultOutcomeStepArgs)로 한 단계 더 올려 단일 검증 runPlan.run threading 으로 pre/post run-identity 가 재전달 0 로 수렴함을 resolve 경유 triple-boundary 로 박제; git grep 두 step-args 컴포저 AND resolve 동시-호출 smoke 0 부재 실측 확인"
independentStream: realdata-e2e-step-args-resolve-run-plan-threading-triple-boundary-closure-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·run-plan-threading triple-boundary 3-leg pre/resolve/post·marker+issueNumber+run-identity 3축 동시 수렴·단일 runPlan.run source threading·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0770(300)/T-0769(300)/T-0768(475)/T-0767(548) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-step-args-resolve-run-plan-threading-triple-boundary-single-source-closure-assembly.smoke-spec.ts
---

# T-0771 — realdata-e2e step④ run-plan-threading triple-boundary single-source closure non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 build-time 순수 layer 는 **검증된 run plan(`buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}`, T-0597)의 단일 `runPlan.run` 만을 단계별로 thread** 하는 run-plan-threading 컴포저 쌍으로 닫혀 있다:

- **pre-실행**: `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}` (T-0599) — 독립 `run` 인자를 받지 않고 `runPlan.run` 에서만 도출.
- **post-실행**: `buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` → `RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken, summaryLine}` (T-0600) — 독립 `run` 인자를 받지 않고 `runPlan.run` 에서만 도출.

이 두 컴포저의 박제 의도(helper 주석)는 명시적이다 — "live runner 가 step① 에 넘겨 검증·보존한 `runPlan.run` 과, step④ pre/post 에 넘기는 `run` 이 build-time 에서 같은 값임을 **재전달 없이** 구조적으로 보장"(잘못된 gitSha/dateToken 으로 결과 이슈가 박제되거나 멱등 marker 가 어긋나는 사고 표면 제거). 즉 두 컴포저는 **동일 `runPlan.run` single-source** 에서 run-identity 를 도출한다.

직전 sibling T-0770 은 triple-boundary closure(pre + resolve + post)를 박제했으나 **chain 시작을 `buildRealDataResultIssuePublishPlan(results, run)`(top orchestrator, `run` 을 독립 인자로 받음)으로 잡았고**, post 도 `buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`(역시 `run` 독립 인자)을 직접 호출했다 — 즉 pre/post 에 `run` 을 **각각 따로(두 번) 넘기는** 형태였다. 그래서 "step① 에서 검증된 단일 `runPlan.run` 이 pre/post 양쪽으로 재전달 0 로 thread 되어 run-identity 가 한 chain 안에서 동일 source 로 수렴" 하는 **run-plan-threading triple-boundary closure** 는 아직 미봉이다.

본 task 는 그 자리를 채워 **chain 시작·끝을 run-plan-side step-args 컴포저로 잡아**, 단일 검증 `runPlan.run` 만이 pre/post 양쪽 run-identity 의 source 임을 resolve 경유 triple-boundary 로 박제한다. 단일 source `(runPlan, results, search-stdout, exec-stdout)` 로부터:

1. **pre-실행 run-plan-threaded** — `publishPlan = buildRealDataResultPublishStepArgs(runPlan, results)` → `{report, commandArgs, searchArgv}`. `report.descriptor.marker` 안에 `${runPlan.run.dateToken}@${runPlan.run.gitSha}` run token 박제(독립 run 인자 미수신 — `runPlan.run` 에서만 도출), `commandArgs.searchQuery === report.descriptor.marker`.
2. **resolve** — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)` → `{action, argv}`. marker(=`publishPlan.commandArgs.searchQuery`)로 검색해 hit 1+ → `action.update.issueNumber = N`(최소 number).
3. **post-실행 run-plan-threaded** — `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)` → `{issueNumber, url, gitSha, dateToken, summaryLine}`. execStdout URL(`/issues/N`)의 issueNumber + **동일 `runPlan.run`**(독립 run 인자 미수신)의 gitSha/dateToken 전파.

이 세 boundary 가 **동일 단일 검증 `runPlan.run`** 으로부터 도출된 marker run token / run-identity 와 search-stdout 종속 issueNumber 를 **한 chain 으로 묶어** byte-identical 수렴함이 **search-or-update 멱등성**(REQ-009)·**결과 리포트 재실행 정합**(REQ-037)의 run-plan-threading layer 종단 닫음이다 — 즉 "step① 에서 한 번 검증된 run 으로 pre 가 산출한 marker run token" 과 "동일 step① run 으로 post 가 해석한 run-identity" 가 **재전달 0** 로 같은 source 에서 drift 0 수렴함.

직전 sibling 들은 진입점·threading 형태가 달랐다:
- **T-0770**: top-orchestrator `buildRealDataResultIssuePublishPlan(results, run)` 진입 triple-boundary — pre/post 에 `run` 을 각각 독립 인자로 두 번 전달(run-plan-threading 미사용).
- **publish-outcome-step-args-run-convergence / step-args-dual-leg-convergence**: 두 step-args 컴포저 run 수렴을 박제하나 **resolve leg 부재**(pre↔post 직결, 멱등 검색 경계 미경유).
- **T-0763** (runplan-publish-descriptor): `buildRealDataResultPublishStepArgs` 진입하나 descriptor run-identity 단일 leg(post from-output·resolve 미합류).

본 task 는 **두 run-plan-side step-args 컴포저(pre/post) + resolve leg 동시-호출**이 새 결정 표면이다 — "단일 검증 `runPlan.run` 이 재전달 0 로 pre/post 양쪽 run-identity 를 thread + resolve 가 marker 로 해소한 이슈 N 이 post 가 해석한 N 과 수렴" 의 cross-boundary 일치가 한 chain 안에서 동시에 성립함.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultPublishStepArgs AND buildRealDataResultOutcomeStepArgs AND resolveRealDataResultIssueGhCommandPlan 셋 다 실 호출) 여부; done` — **0 파일**(직전 fire 실측 확인 — 두 step-args 컴포저 동시-호출 smoke 4개는 전부 resolve leg 0). `git log origin/main` 에서 동일 영역 박제 commit 0.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-run-plan.ts` — 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `RealDataE2eRunPlan {pipeline, run}`. `run: RealDataResultIssueRunRef {gitSha, dateToken}`(검증·보존된 단일 run 식별자). 본 task 의 chain single-source. synthetic `runPlan` literal 합성 shape(또는 `buildRealDataE2eRunPlan` 호출로 합성) 확인 — `runPlan.run` 이 pre/post 두 컴포저로 thread 되는 단일 source.
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — pre-실행 run-plan-threaded 컴포저(T-0599). `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan`. 독립 run 인자 미수신 — `runPlan.run` 만 `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 thread(재전달 0). `runPlan.run.gitSha`/`dateToken` 빈/공백 → 위임 report-plan `assertNonBlank` throw 전파(self-wire guard `assertRealDataResultPublishStepArgsConsistentWithSources` 반환 직전 정합 검증). 본 task 의 chain 시작 source.
- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — post-실행 run-plan-threaded 컴포저(T-0600). `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` → `RealDataResultIssueOutcomeReport`. 독립 run 인자 미수신 — `runPlan.run` 만 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 로 thread(재전달 0). 잘못된 stdout(URL 미발견·`/pull/`·issueNumber 비양수) → 파서 throw 전파, `runPlan.run` 빈/공백 → 빌더 guard throw 전파(self-wire guard `assertRealDataResultOutcomeStepArgsConsistentWithSources`). 본 task 의 chain post boundary.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `interface RealDataResultIssueDescriptor {title, marker, body}`(marker = 멱등 검색·갱신용 안정 토큰). `interface RealDataResultIssueRunRef {gitSha, dateToken}`. `runToken(run)` = `${run.dateToken}@${run.gitSha}`. marker 안 run token 형식 — `publishPlan.report.descriptor.marker` 와 `outcomeReport` run-identity 의 cross-boundary 일치 단언 reference.
- `test/helpers/realdata-e2e-result-report-plan.ts` — `interface RealDataResultReportPlan {summary, descriptor}`. `publishPlan.report.descriptor.marker` 경로로 marker run token 에 도달 reachable 확인.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `interface RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}`. `searchQuery === descriptor.marker`(publishPlan.commandArgs.searchQuery 가 marker 운반). resolve 입력으로 marker 운반함만 사용(commandArgs 자체 정합 재단언 0).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — resolve 종단 컴포저. `interface RealDataResultIssueGhCommandPlan {action, argv}`. `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` — hit 1+ → `action.update.issueNumber = 최소 number`, hit 0 → `action.create`. 본 task 는 `publishPlan.commandArgs` 를 두 번째 인자로 그대로 넘김(resolve stage).
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — search stdout 파서. `parseRealDataResultIssueSearchOutput(stdout)` 가 받는 JSON 배열 stdout 형식(`[{"number": N, ...}]` 류) 확인 — searchStdout synthetic literal 합성용(N 을 search hit 최소 number 로 합성). 비JSON/비배열/원소 number 비양수 → throw 형식 참조.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `action.update.issueNumber`(hit 1+ 시 최소 number) / `action.create`(hit 0 시) 분기 shape 확인. update 분기 issueNumber 접근 경로.
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post 파서. `interface RealDataResultIssueOutcome {issueNumber, url}`. GitHub issue URL 패턴 `https://github.com/<owner>/<repo>/issues/<number>`. execStdout(URL 한 줄) synthetic 합성 형식 — issueNumber N 은 search hit 최소 number 와 동일하게 합성(cross-boundary 수렴 입력 조건).
- `test/helpers/realdata-e2e-result-summary.ts` 또는 `RealDataResultSummary`·`EvaluationResult` 정의 — `buildRealDataResultPublishStepArgs` 의 두 번째 인자 `results: EvaluationResult[]` synthetic literal 합성 shape 확인.
- `test/smoke/realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts` 와 `test/smoke/realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts` — 직전 sibling 두 step-args 컴포저 run 수렴 smoke(resolve leg 부재). 패턴 참고(runPlan synthetic 합성, 두 컴포저 동시-호출) + 중복 회피 — 본 task 는 그 사이에 **resolve leg 를 끼워** marker→issueNumber 해소를 합류시켜 triple-boundary 로 확장. 두 step-args 컴포저 run 수렴 자체 재단언 금지(sibling cover), **resolve 경유 issueNumber 합류 + 단일 runPlan.run threading 이 resolve 경계를 가로질러 pre/post run-identity 를 묶음**이 본 task 의 새 단언.
- `test/smoke/realdata-e2e-publish-plan-resolve-from-output-orchestrator-triple-boundary-single-source-closure-assembly.smoke-spec.ts` (T-0770) — 직전 sibling top-orchestrator(run 독립 인자 2회 전달) triple-boundary smoke. 중복 회피 — 본 task 는 chain 을 **run-plan-side step-args 컴포저(runPlan.run 단일 source threading, 재전달 0)** 로 잡는 부분만 새로 단언. top-orchestrator(`buildRealDataResultIssuePublishPlan`/`...OutcomeReportFromOutput` 직접 호출) triple-boundary 자체 재단언 금지(T-0770 cover).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-step-args-resolve-run-plan-threading-triple-boundary-single-source-closure-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path run-plan-threaded triple-boundary chain 합성**: 단일 source — `runPlan: RealDataE2eRunPlan` synthetic 합성(`buildRealDataE2eRunPlan(seeds, modelId, run)` 호출 또는 literal — Required Reading 의 run-plan helper 로 합성 방식 확인), `results: EvaluationResult[]` synthetic literal, 임의 양수 `N`. 다음을 한 chain 으로 호출: `publishPlan = buildRealDataResultPublishStepArgs(runPlan, results)` → `searchStdout` = N 을 number 로 담은 search hit JSON 배열 한 줄 → `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)`(hit 1+ → update 분기) → `execStdout` = `https://github.com/owner/repo/issues/N` URL 한 줄 → `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`. 세 boundary 산출물이 모두 정상(publishPlan `{report, commandArgs, searchArgv}` 비어있지 않음·`report.descriptor.marker` 존재, resolvePlan.action 이 update 분기로 `issueNumber` 보유, outcomeReport `{issueNumber,url,gitSha,dateToken,summaryLine}`) happy test 1+.
- [ ] **run-plan-threaded issueNumber single-source 수렴(branch — 핵심 불변식 1)**: search hit 에 넣은 N → resolve(`publishPlan.commandArgs.searchQuery`=marker 로 검색)가 해소한 `resolvePlan.action.update.issueNumber` → post(`outcomeReport.issueNumber`)가 **세 지점 모두 동일 N** 임을 묶어 단언 1+ test — `expect(resolvePlan.action.update.issueNumber).toBe(N)` AND `expect(outcomeReport.issueNumber).toBe(N)` AND `expect(outcomeReport.url).toContain(`/issues/${N}`)`. "step-args 컴포저가 산출한 marker 로 검색해 찾은 이슈 N" 과 "step-args 컴포저가 실행 stdout 해석한 이슈 N" 이 한 chain 안에서 byte-identical 수렴(resolve↔post 경계 drift 0).
- [ ] **단일 runPlan.run threading run-identity 수렴(branch — 핵심 불변식 2, 본 task 의 새 표면)**: **동일 `runPlan` 한 객체**를 pre·post 두 컴포저에 넘겼을 때(독립 run 인자 재전달 0), 단일 `runPlan.run` 으로부터 도출된 gitSha·dateToken 이 pre(`publishPlan.report.descriptor.marker` run token)와 post(전파)에서 동일함을 단언 1+ test — `expect(publishPlan.report.descriptor.marker).toContain(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`)` AND `expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha)` AND `expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken)` AND `expect(outcomeReport.summaryLine).toContain(runPlan.run.gitSha)` AND `expect(outcomeReport.summaryLine).toContain(runPlan.run.dateToken)`. 즉 step① 에서 한 번 검증된 단일 `runPlan.run` 이 재전달 0 로 pre/post 양쪽 run-identity 의 source 가 되어 resolve 경계를 가로질러 한 chain 안에서 수렴(run-plan-threading 닫음).
- [ ] **commandArgs → resolve 직결 marker 매개 무결성(branch — step-args-output-as-resolve-input)**: `publishPlan.commandArgs.searchQuery` 가 `publishPlan.report.descriptor.marker` 와 byte-identical 임을 단언(`expect(publishPlan.commandArgs.searchQuery).toBe(publishPlan.report.descriptor.marker)`), 그 marker(=searchQuery)가 resolve 의 검색 매체로 쓰여 hit 를 update 분기로 이끎을 단언(`expect(resolvePlan.action.update).toBeDefined()`). 즉 pre step-args 컴포저가 산출한 commandArgs 가 resolve 입력으로 직결되어 marker 가 chain 의 resolve stage 를 매개함 1+ test. (commandArgs 자체 createArgs/updateArgs 정합·searchArgv 재단언 금지 — searchQuery=marker 운반 + commandArgs 직결만.)
- [ ] **create 분기 격리(branch — 검색 미스 → create, post 무관)**: 동일 runPlan·results 로 chain 을 호출하되 `searchStdout` 을 빈 hit(`[]` 또는 marker 미포함 hit)로 합성 → `resolvePlan.action` 이 **update 가 아니라 create 분기**(`action.create` defined, `action.update` 부재) 임을 단언 1+ test. 이때 post(`buildRealDataResultOutcomeStepArgs`)는 여전히 execStdout 의 N 으로 issueNumber 를 산출 — resolve 의 create 분기 진입이 post 의 issueNumber 산출 경로와 독립(검색 결과 변경이 실행-stdout 해석에 누설 0). marker run token 은 create/update 두 분기 모두 동일.
- [ ] **runPlan.run 변별성(branch — 다른 run→다른 run-identity, 같은 runPlan→triple 수렴)**: 서로 다른 `runPlan.run` 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-06-21"}`, run_B `{gitSha:"def5678", dateToken:"2026-06-29"}`)로 각각 runPlan 합성 → 각각 동일 N 으로 chain 호출 → 두 chain 의 `publishPlan.report.descriptor.marker` run token / outcomeReport.{gitSha,dateToken} 가 **각각 run_A·run_B 로 분리 수렴**(서로 다른 token, 단 각 chain 안에서 pre/post 일치) 1+ test. issueNumber N 은 두 chain 모두 동일(search-stdout 종속, run 과 무관)임도 단언 — "runPlan.run 은 변별, issueNumber 는 search-stdout 종속" 의 축 분리 박제.
- [ ] **results 무관 — triple 수렴 격리(branch — partial-thread 격리)**: 동일 `runPlan`·동일 N(searchStdout/execStdout)을 고정하고 `results`(publishPlan 입력)의 분포 값만 다르게 두 chain 호출 → 두 chain 의 `publishPlan.report.descriptor.marker` run token / resolvePlan.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 가 **두 경우 동일**(results 변경이 marker run token·issueNumber·run-identity 어느 축에도 누설 0 — REQ-009 "동일 run → 동일 marker, results 무관" 정합) 1+ test. 단 `publishPlan.report.summary`(또는 descriptor.body) 는 두 경우 달라야 함(results 본문 반영 — 다른 축은 불변).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(세 boundary 의 거부 대칭 박제):
  - `runPlan.run.gitSha` 빈/공백(`runPlan.run = {gitSha:"", dateToken:"2026-06-29"}`) → pre(`buildRealDataResultPublishStepArgs`) 측 위임 report-plan `assertNonBlank("gitSha")` throw(pre boundary 차단 — chain 시작 비식별).
  - `runPlan.run.dateToken` 빈/공백 → pre 측 위임 report-plan `assertNonBlank("dateToken")` throw 대칭.
  - `runPlan.run.gitSha` 빈/공백 → post(`buildRealDataResultOutcomeStepArgs`) 측 위임 빌더 `assertNonBlank` throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, pre/post 대칭). 단일 runPlan.run 가 비식별이면 pre/post 둘 다 거부됨을 박제.
  - `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve 의 parse 위임 throw(검색 미산출 — publishPlan.commandArgs.searchQuery 정상이어도 hits 추출 실패로 resolve 차단).
  - `execStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → post 의 파서 위임 throw(post 미산출 — runPlan.run 정상이어도 outcome 추출 실패).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/abc`) → post 의 파서 `assertPositiveIssueNumber` throw(post 비식별).
- [ ] **결정론·무공유·no-mutation**: 동일 (runPlan, results, searchStdout, execStdout) 입력으로 chain 두 번 호출 → publishPlan/resolvePlan/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(runPlan, results) 가 chain 호출 후 mutate 0(원본 deep-equal 유지 — 특히 두 컴포저가 같은 `runPlan` 을 공유 읽기 해도 변형 0) 1+ test. AND 각 stage 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제(매 호출 새 객체).
- [ ] **credential 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 publishPlan.searchArgv / publishPlan.commandArgs.searchQuery / publishPlan.report.descriptor.{title,marker,body} / resolvePlan.argv / outcomeReport.{url,summaryLine} 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern step-args-resolve-run-plan-threading` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 search-stdout / exec-stdout 만.
- top-orchestrator(`buildRealDataResultIssuePublishPlan(results, run)` / `buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`, run 독립 인자) 진입 triple-boundary closure 자체 재단언 금지(T-0770 cover). 본 task 는 chain 시작·끝을 **run-plan-side step-args 컴포저(runPlan.run 단일 source threading, 재전달 0)** 로 잡는 부분만 새로 단언.
- 두 step-args 컴포저(publish/outcome)의 run 수렴 자체 단독 재단언 금지(publish-outcome-step-args-run-convergence / step-args-dual-leg-convergence sibling cover, resolve leg 부재). 본 task 는 그 사이에 resolve leg 를 끼워 marker→issueNumber 해소를 합류시킨 triple-boundary 로만.
- runplan-publish-descriptor run-identity 단일 leg(T-0763, resolve·post from-output 미합류) 재단언 금지. 본 task 는 pre/post 양 leg + resolve 동시-호출 triple-boundary 로만.
- 각 step-args 컴포저의 self-wire 가드(`assertRealDataResultPublishStepArgsConsistentWithSources` / `...OutcomeStepArgsConsistentWithSources`) 정합 재단언 금지(컴포저 단위 spec cover). 본 task 는 marker+issueNumber+run-identity cross-boundary 수렴만.
- publishPlan 의 report/commandArgs/searchArgv 개별 필드 shape·self-wire 가드 정합 재단언 금지(publish-plan-tri-leg cover).
- commandArgs 의 createArgs/updateArgs 정합(title/body=descriptor 보존)·labels 재단언 금지(command-args 가드 cover). 본 task 는 `searchQuery=descriptor.marker` 운반 + commandArgs 직결만.
- resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언 금지(gh-command-plan 가드 cover). 본 task 는 `action.update.issueNumber` 해소 결과만.
- from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언 금지(T-0747 cover). 본 task 는 triple-boundary issueNumber/run-identity 수렴만.
- `runPlan` 의 pipeline 측(collectCallArgs·modelId) shape·guard 재단언 금지(run-plan helper spec cover). 본 task 는 `runPlan.run` threading 만.
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper 들(run-plan, publish-step-args, outcome-step-args, descriptor, report-plan, command-args, gh-command-plan, search-parse, action, output-parse, summary)의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 pre(`buildRealDataResultPublishStepArgs(runPlan, results)`)→resolve(`resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)`)→post(`buildRealDataResultOutcomeStepArgs(runPlan, execStdout)`)를 같은 smoke 안에서 single-source(동일 runPlan + results + search-stdout + exec-stdout)로 한 chain 으로 호출하는 합성 smoke 작성. **동일 `runPlan` 한 객체를 pre/post 두 컴포저에 넘겨** run 재전달 0 threading 을 박제하는 것이 핵심. `runPlan` synthetic 합성 방식(`buildRealDataE2eRunPlan` 호출 또는 literal)은 run-plan helper 의 export 시그니처로, `publishPlan.report.descriptor.marker` run token 형식은 report-plan/descriptor helper 로, action.update.issueNumber 접근 경로는 action helper 의 discriminant 로, search hit JSON 형식은 search-parse helper 로 실제 확인해 단언 문자열 결정).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
