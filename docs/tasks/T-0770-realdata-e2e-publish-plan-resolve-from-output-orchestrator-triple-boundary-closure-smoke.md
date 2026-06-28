---
id: T-0770
title: realdata-e2e step④ top-orchestrator pre→resolve→post triple-boundary single-source closure — buildRealDataResultIssuePublishPlan(results,run).{searchArgv,commandArgs,report.descriptor.marker} → resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs).action.update.issueNumber ↔ buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run).{issueNumber,gitSha,dateToken} 가 단일 (results, run, search-stdout, exec-stdout) source 로 marker+issueNumber+run-identity 동시 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ sweep — T-0769(descriptor 진입 triple-boundary closure) 위에 top-orchestrator buildRealDataResultIssuePublishPlan 진입으로 확장; descriptor 가 아니라 최상위 publish-plan 컴포저를 chain 시작 source 로 한 publishPlan→resolve→from-output full-orchestrator closure; git grep publishPlan AND from-output 동시-호출 smoke 0 부재 실측 확인"
independentStream: realdata-e2e-publish-plan-resolve-from-output-orchestrator-triple-boundary-closure-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·top-orchestrator triple-boundary 3-leg pre/resolve/post·marker+issueNumber+run-identity 3축 동시 수렴·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0769(300)/T-0768(475)/T-0767(548)/T-0766(659) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-publish-plan-resolve-from-output-orchestrator-triple-boundary-single-source-closure-assembly.smoke-spec.ts
---

# T-0770 — realdata-e2e step④ top-orchestrator pre→resolve→post triple-boundary single-source closure non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 **pre-execution build-time chain 의 최상위 단일 진입점**은 `buildRealDataResultIssuePublishPlan(results, run)` 이다(T-0595 박제) — 실 live runner 가 `EvaluationResult[]` + run 식별자만 넘기면 받게 되는 "결과 리포트 + 멱등 명령-args + 실행할 첫 gh argv(search)" 한 묶음 `{report, commandArgs, searchArgv}` 를 산출한다. 그 `report.descriptor.marker`(run token 박제) / `commandArgs.searchQuery`(=marker) / `searchArgv`(marker 운반 argv) 는 모두 동일 `(results, run)` single-source 에서 도출된다.

직전 sibling T-0769 는 triple-boundary closure(descriptor(pre) + resolve + from-output(post))를 박제했으나 **chain 시작을 `buildRealDataResultIssueDescriptor(summary, run)`(하위 컴포저)로 잡았다** — 즉 실 live caller 의 최상위 진입점(`buildRealDataResultIssuePublishPlan`)이 아니라 그 안에 위임되는 descriptor leg 에서 출발했다. 그래서 "최상위 orchestrator 가 산출한 commandArgs/marker 가 resolve 와 from-output 까지 한 chain 으로 수렴" 하는 **full-orchestrator closure** 는 아직 미봉이다.

본 task 는 그 자리를 채워 **top-level orchestrator(`buildRealDataResultIssuePublishPlan`) 진입 → resolve → from-output 세 boundary 를 한 chain 으로 동시-호출**하는 **첫 full-orchestrator triple-boundary single-source closure** 다. 단일 source `(results, run, search-stdout, exec-stdout)` 로부터:

1. **pre-execution top orchestrator** — `publishPlan = buildRealDataResultIssuePublishPlan(results, run)` → `{report, commandArgs, searchArgv}`. `report.descriptor.marker` 안에 `${run.dateToken}@${run.gitSha}` run token 박제, `commandArgs.searchQuery === report.descriptor.marker`, `searchArgv` 가 marker 를 단일 argv 원소로 운반.
2. **resolve** — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)` → `{action, argv}`. marker(=`publishPlan.commandArgs.searchQuery`)로 기존 이슈를 검색해 hit 1+ → `action.update.issueNumber = N`(최소 number).
3. **post-execution interpretation 단일-진입** — `outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)` → `{issueNumber, url, gitSha, dateToken, summaryLine}`. execStdout URL(`/issues/N`)의 issueNumber + run 의 gitSha/dateToken 전파.

이 세 boundary 가 **동일 단일 source** 로부터 도출된 marker run token / issueNumber / run-identity 를 **한 chain 으로 묶어** byte-identical 수렴함이 **search-or-update 멱등성**(REQ-009, "동일 run → 동일 marker 로 동일 이슈를 찾아 갱신")·**결과 리포트 재실행 정합**(REQ-037)의 종단 full-orchestrator 사람-친화 닫음이다 — 즉 "최상위 orchestrator 가 산출한 marker 로 검색해 찾은 이슈 N" 과 "실행 후 stdout 으로부터 해석한 이슈 N·run-identity" 가 같은 single-source 에서 drift 0 으로 수렴함.

직전 sibling 들은 진입점·boundary 수가 달랐다:
- **T-0769**: descriptor(하위 컴포저) 진입 triple-boundary closure — 최상위 orchestrator(`buildRealDataResultIssuePublishPlan`) 미참조(commandArgs/searchArgv/report 묶음 합성 boundary 없이 descriptor 단독에서 출발).
- **T-0766**: publish-plan↔search-argv↔resolve↔descriptor **marker** 4자 — publishPlan 진입하나 전부 pre boundary(post from-output 합류 0).
- **T-0768**: descriptor↔from-output **run-identity** 2-boundary — publishPlan 미진입.
- **T-0767**: resolve↔from-output **issueNumber** 2-boundary — publishPlan·descriptor 미진입.

본 task 는 **publishPlan(top orchestrator) 진입 + resolve + from-output(post) 세 boundary 동시-호출**이 새 결정 표면이다 — "최상위 orchestrator 가 산출한 commandArgs/marker(resolve 입력) ↔ resolve 가 해소한 이슈 N ↔ 실행 stdout 해석 이슈 N·run-identity" 의 cross-boundary 일치가 한 chain 안에서 동시에 성립함.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultIssuePublishPlan AND buildRealDataResultIssueOutcomeReportFromOutput 둘 다 실 호출) 여부; done` — **0 파일**(직전 fire 실측 확인). 어떤 smoke 도 최상위 orchestrator 와 post from-output 단일-진입을 같은 chain 에서 동시-호출하지 않는다. `git log origin/main` 에서 동일 영역 박제 commit 0.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — pre-execution 최상위 종단 publish 컴포저(T-0595). `interface RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`. `buildRealDataResultIssuePublishPlan(results, run)` — `EvaluationResult[]` + run → `{report, commandArgs, searchArgv}`. (1) `buildRealDataResultIssueCommandPlan(results, run)` → `{report, commandArgs}`, (2) `buildRealDataResultIssueSearchGhArgv(commandArgs)` → searchArgv. self-wire 가드(`assertRealDataResultIssuePublishPlanConsistentWithSources`)가 반환 직전 정합 검증. run.gitSha/dateToken 빈/공백 → 하위 report-plan `assertNonBlank` throw 전파(searchArgv 단계 미도달). 본 task 의 chain 시작 source(top orchestrator).
- `test/helpers/realdata-e2e-result-report-plan.ts` — `interface RealDataResultReportPlan {summary, descriptor}`(L81-83). `report.descriptor` = `RealDataResultIssueDescriptor {title, marker, body}`. 본 task 는 `publishPlan.report.descriptor.marker` 경로로 marker run token 에 도달(orchestrator 출력에서 reachable 함을 확인).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `interface RealDataResultIssueDescriptor {title, marker, body}`(marker = 멱등 검색·갱신용 안정 식별 토큰, "동일 run → 동일 marker"). `interface RealDataResultIssueRunRef {gitSha, dateToken}`. `runToken(run)` = `${run.dateToken}@${run.gitSha}`. marker 안 run token 형식 확인 — `publishPlan.report.descriptor.marker` 와 `outcomeReport` run-identity 의 cross-boundary 일치 단언 reference.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `interface RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}`. `searchQuery === descriptor.marker`(orchestrator 가 산출하는 `publishPlan.commandArgs.searchQuery` 가 marker 운반). 본 task 는 commandArgs 자체 정합 재단언 0 — searchQuery 가 resolve 입력으로 marker 를 운반함만 사용.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — resolve 종단 컴포저. `interface RealDataResultIssueGhCommandPlan {action, argv}`. `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` — (1) `parseRealDataResultIssueSearchOutput(stdout)` → hits, (2) `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)` → action(hit 1+ → `action.update.issueNumber = 최소 number`), (3) argv 산출. 본 task 는 `publishPlan.commandArgs` 를 두 번째 인자로 그대로 넘김(chain 의 resolve stage). searchStdout 은 hit JSON 배열 한 줄(아래 search-parse 형식 참조).
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — search stdout 파서. `parseRealDataResultIssueSearchOutput(stdout)` 가 받는 JSON 배열 stdout 형식(`[{"number": N, ...}]` 류) 확인 — searchStdout synthetic literal 합성용(N 을 search hit 의 최소 number 로 합성). 비JSON/비배열/원소 number 비양수 → throw 형식 참조.
- `test/helpers/realdata-e2e-result-issue-action.ts` 또는 `RealDataResultIssueAction` 정의 helper — `action.update.issueNumber`(hit 1+ 시 최소 number) / `action.create`(hit 0 시) 분기 shape 확인. 본 task 의 update 분기 issueNumber 접근 경로.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — post-execution 단일-진입 컴포저(T-0596). `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` — 내부에서 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` → outcome(issueNumber/url), (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` → report(run.gitSha/dateToken 전파, summaryLine 안 run token 합성). 본 task 의 chain post boundary(실행 stdout 해석 → issueNumber·run-identity).
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post 파서. `interface RealDataResultIssueOutcome {issueNumber, url}`. GitHub issue URL 패턴 `https://github.com/<owner>/<repo>/issues/<number>`. execStdout(URL 한 줄) synthetic 합성 형식 참조 — issueNumber N 은 search hit 최소 number 와 동일하게 합성(cross-boundary 수렴 입력 조건).
- `test/helpers/realdata-e2e-result-issue-summary.ts` 또는 `RealDataResultSummary`·`EvaluationResult` 정의 — `buildRealDataResultIssuePublishPlan` 의 첫 인자 `results: EvaluationResult[]` synthetic literal 합성 shape 확인.
- `test/smoke/realdata-e2e-descriptor-resolve-from-output-triple-boundary-single-source-closure-assembly.smoke-spec.ts` (T-0769) — 직전 sibling descriptor 진입 triple-boundary smoke. 패턴 참고(3 composer 동시-호출 구조, searchStdout/execStdout synthetic 합성) + 중복 회피 — 본 task 는 chain 시작을 descriptor 가 아니라 **최상위 orchestrator `buildRealDataResultIssuePublishPlan`** 로 잡아 full-orchestrator 로 확장. descriptor 진입 triple-boundary closure 자체 재단언 금지(T-0769 cover), **publishPlan(top orchestrator)이 chain 시작 source 임 + publishPlan.commandArgs 가 resolve 입력으로 직결됨**이 본 task 의 새 단언.
- `test/smoke/realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-assembly.smoke-spec.ts` (T-0766) — sibling publishPlan↔search-argv↔resolve↔descriptor marker 4자(pre 전부) smoke. 중복 회피 — 본 task 는 marker 4자 cross-stage 수렴 자체 재단언 금지(T-0766 cover, pre boundary 전부), post from-output 합류(issueNumber·run-identity 가 실행 stdout 해석과 cross-boundary 수렴)만 새로 단언.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-publish-plan-resolve-from-output-orchestrator-triple-boundary-single-source-closure-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path full-orchestrator triple-boundary chain 합성**: 단일 source — `results: EvaluationResult[]` synthetic literal, `run: RealDataResultIssueRunRef {gitSha, dateToken}` synthetic literal, 임의 양수 `N`. 다음을 한 chain 으로 호출: `publishPlan = buildRealDataResultIssuePublishPlan(results, run)`(top orchestrator) → `searchStdout` = N 을 number 로 담은 search hit JSON 배열 한 줄 → `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)`(hit 1+ → update 분기) → `execStdout` = `https://github.com/owner/repo/issues/N` URL 한 줄 → `outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`. 세 boundary 산출물이 모두 정상(publishPlan `{report, commandArgs, searchArgv}` 비어있지 않음·`report.descriptor.marker` 존재, resolvePlan.action 이 update 분기로 `issueNumber` 보유, outcomeReport `{issueNumber,url,gitSha,dateToken,summaryLine}`) happy test 1+.
- [ ] **full-orchestrator issueNumber single-source 수렴(branch — 핵심 불변식 1)**: search hit 에 넣은 N → resolve(orchestrator 가 산출한 `publishPlan.commandArgs.searchQuery`=marker 로 검색)가 해소한 `resolvePlan.action.update.issueNumber` → from-output(실행 stdout 해석)의 `outcomeReport.issueNumber` 가 **세 지점 모두 동일 N** 임을 묶어 단언 1+ test — `expect(resolvePlan.action.update.issueNumber).toBe(N)` AND `expect(outcomeReport.issueNumber).toBe(N)` AND `expect(outcomeReport.url).toContain(`/issues/${N}`)`. 즉 "최상위 orchestrator 가 산출한 marker 로 검색해 찾은 이슈 N" 과 "실행 stdout 해석 이슈 N" 이 한 chain 안에서 byte-identical 수렴(resolve↔from-output 경계 drift 0).
- [ ] **full-orchestrator run-identity single-source 수렴(branch — 핵심 불변식 2)**: 단일 run source 로부터 도출된 gitSha·dateToken 이 publishPlan(pre, `report.descriptor.marker` run token)과 from-output(post, 전파)에서 동일함을 단언 1+ test — `expect(publishPlan.report.descriptor.marker).toContain(`${run.dateToken}@${run.gitSha}`)` AND `expect(outcomeReport.gitSha).toBe(run.gitSha)` AND `expect(outcomeReport.dateToken).toBe(run.dateToken)` AND `expect(outcomeReport.summaryLine).toContain(run.gitSha)` AND `expect(outcomeReport.summaryLine).toContain(run.dateToken)`. 즉 orchestrator 가 산출한 marker 의 run token 과 from-output 의 run-identity 가 한 chain 안에서 동일 run single-source 로 수렴(publishPlan↔from-output 경계 drift 0).
- [ ] **orchestrator commandArgs → resolve 직결 marker 매개 무결성(branch — orchestrator-output-as-resolve-input)**: `publishPlan.commandArgs.searchQuery` 가 `publishPlan.report.descriptor.marker` 와 byte-identical 임을 단언(`expect(publishPlan.commandArgs.searchQuery).toBe(publishPlan.report.descriptor.marker)`), 그 marker(=searchQuery)가 resolve 의 검색 매체로 쓰여 hit 를 update 분기로 이끎을 단언(`expect(resolvePlan.action.update).toBeDefined()` 또는 action discriminant 가 update). 즉 최상위 orchestrator 가 산출한 commandArgs 가 resolve 입력으로 직결되어 marker 가 chain 의 resolve stage 를 매개함 1+ test. (commandArgs 자체 createArgs/updateArgs 정합·searchArgv 4자 수렴 재단언 금지 — searchQuery=marker 운반 + commandArgs 직결만.)
- [ ] **create 분기 격리(branch — 검색 미스 → create, from-output 무관)**: 동일 results·run 으로 chain 을 호출하되 `searchStdout` 을 빈 hit(`[]` 또는 marker 미포함 hit)로 합성 → `resolvePlan.action` 이 **update 가 아니라 create 분기**(`action.create` defined, `action.update` 부재) 임을 단언 1+ test. 이때 from-output(post)은 여전히 execStdout 의 N 으로 issueNumber 를 산출 — resolve 의 create 분기 진입이 from-output 의 issueNumber 산출 경로와 독립(검색 결과 변경이 실행-stdout 해석에 누설 0). marker run token 은 create/update 두 분기 모두 동일.
- [ ] **results/run 분포 변별성(branch — 다른 source→다른 marker/run-identity, 같은 source→triple 수렴)**: 서로 다른 source 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-06-21"}`, run_B `{gitSha:"def5678", dateToken:"2026-06-29"}` — 또는 descriptor.marker 합성이 results 의존이면 results 분포로) → 각각 동일 N 으로 chain 호출 → 두 chain 의 `publishPlan.report.descriptor.marker` run token / outcomeReport.{gitSha,dateToken} 가 **각각 source_A·source_B 로 분리 수렴**(서로 다른 token, 단 각 chain 안에서 triple-boundary 일치) 1+ test. issueNumber N 은 두 chain 모두 동일(search-stdout 종속, source 와 무관)임도 단언 — "source 는 변별, issueNumber 는 search-stdout 종속" 의 축 분리 박제. (변별 입력 축은 Required Reading 의 descriptor.marker 합성 source 를 확인해 run-axis 인지 results-axis 인지 정한다.)
- [ ] **results 무관 — triple 수렴 격리(branch — partial-thread 격리)**: 동일 `run`·동일 N(searchStdout/execStdout)을 고정하고 `results`(publishPlan 입력)의 분포 값만 다르게 두 chain 호출 → 두 chain 의 `publishPlan.report.descriptor.marker` run token / resolvePlan.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 가 **두 경우 동일**(results 변경이 marker run token·issueNumber·run-identity 어느 축에도 누설 0 — REQ-009 "동일 run → 동일 marker, results 무관" 정합) 1+ test. 단 `publishPlan.report.summary`(또는 descriptor.body) 는 두 경우 달라야 함(results 본문 반영 — 다른 축은 불변).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(세 boundary 의 거부 대칭 박제):
  - `run.gitSha` 빈/공백(`run = {gitSha:"", dateToken:"2026-06-29"}`) → publishPlan(top orchestrator) 측 하위 report-plan `assertNonBlank("gitSha")` throw(pre boundary 차단 — chain 시작 비식별, searchArgv 단계 미도달).
  - `run.dateToken` 빈/공백 → publishPlan 측 하위 report-plan `assertNonBlank("dateToken")` throw 대칭.
  - `run.gitSha` 빈/공백 → from-output(post) 측 builder 위임 `assertNonBlank` throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, pre/post 대칭).
  - `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve 의 parse 위임 throw(검색 미산출 — publishPlan.commandArgs.searchQuery 정상이어도 hits 추출 실패로 resolve 차단).
  - `execStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → from-output 의 (1) parse 위임 throw(post 미산출 — run 정상이어도 outcome 추출 실패).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/abc`) → from-output 의 (1) parse `assertPositiveIssueNumber` throw(post 비식별).
- [ ] **결정론·무공유·no-mutation**: 동일 (results, run, searchStdout, execStdout) 입력으로 chain 두 번 호출 → publishPlan/resolvePlan/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(results, run) 가 chain 호출 후 mutate 0(원본 deep-equal 유지) 1+ test. AND 각 stage 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제(매 호출 새 객체).
- [ ] **credential 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 publishPlan.searchArgv / publishPlan.commandArgs.searchQuery / publishPlan.report.descriptor.{title,marker,body} / resolvePlan.argv / outcomeReport.{url,summaryLine} 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern publish-plan-resolve-from-output-orchestrator` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 search-stdout / exec-stdout 만.
- descriptor 진입 triple-boundary closure(descriptor→resolve→from-output) 자체 재단언 금지(T-0769 cover). 본 task 는 chain 시작을 **최상위 orchestrator `buildRealDataResultIssuePublishPlan`** 로 잡아 full-orchestrator 로 확장하는 부분만 새로 단언(publishPlan 이 chain source 임 + publishPlan.commandArgs 가 resolve 입력 직결).
- marker 4자 cross-stage 수렴(publishPlan.searchArgv↔search-argv↔resolve↔descriptor.marker, pre 전부) 재단언 금지(T-0766 cover). 본 task 는 post from-output 합류(issueNumber·run-identity cross-boundary 수렴)만.
- resolve↔from-output issueNumber 2-boundary 수렴 자체 단독 재단언 금지(T-0767 cover). 본 task 는 그 위에 publishPlan(top orchestrator) leg 를 chain 시작에 합류시켜 full-orchestrator triple-boundary closure 로만.
- descriptor↔from-output run-identity 2-boundary 수렴 자체 단독 재단언 금지(T-0768 cover). 본 task 는 orchestrator+resolve leg 를 끼운 triple-boundary 형태로만.
- publishPlan 의 report/commandArgs/searchArgv 개별 필드 shape·self-wire 가드 정합 재단언 금지(publish-plan-tri-leg / T-0729 cover). 본 task 는 marker+issueNumber+run-identity cross-boundary 수렴만.
- commandArgs 의 createArgs/updateArgs 정합(title/body=descriptor 보존)·labels 재단언 금지(command-args 가드 cover). 본 task 는 `searchQuery=descriptor.marker` 운반 + commandArgs 직결만.
- resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언 금지(gh-command-plan 가드 cover). 본 task 는 `action.update.issueNumber` 해소 결과만.
- from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언 금지(T-0747 cover). 본 task 는 triple-boundary issueNumber/run-identity 수렴만.
- descriptor.body 의 3블록 구조(marker→summaryLine→markdown) 무결성 재단언 금지(descriptor body 가드 cover).
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper 들(publish-plan, report-plan, descriptor, command-args, gh-command-plan, search-parse, action, outcome-report-from-output, output-parse, summary)의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 top orchestrator(`buildRealDataResultIssuePublishPlan(results, run)`)→resolve(`resolveRealDataResultIssueGhCommandPlan(searchStdout, publishPlan.commandArgs)`)→post(`buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`)를 같은 smoke 안에서 single-source(results + run + search-stdout + exec-stdout)로 한 chain 으로 호출하는 합성 smoke 작성. `publishPlan.report.descriptor.marker` 경로의 reachable 여부와 run token 형식은 report-plan/descriptor helper 의 export 시그니처로, action.update.issueNumber 접근 경로는 action helper 의 discriminant 로, search hit JSON 형식은 search-parse helper 의 export 로 실제 확인해 단언 문자열 결정. descriptor.marker 합성이 run-axis 인지 results-axis 인지 확인해 변별성 test 입력 축을 정한다).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
