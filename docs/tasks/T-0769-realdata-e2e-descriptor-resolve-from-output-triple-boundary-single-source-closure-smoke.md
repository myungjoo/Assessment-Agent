---
id: T-0769
title: realdata-e2e step④ pre→resolve→post triple-boundary single-source closure — buildRealDataResultIssueDescriptor.marker(run token) → buildRealDataResultIssueCommandArgs.searchQuery → resolveRealDataResultIssueGhCommandPlan.action.update.issueNumber ↔ buildRealDataResultIssueOutcomeReportFromOutput.{issueNumber,gitSha,dateToken} 가 단일 (run, summary, search-stdout, exec-stdout) source 로 triple-boundary byte-identical 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ sweep — T-0767(resolve↔from-output issueNumber 2-boundary)·T-0768(descriptor↔from-output run-identity 2-boundary) 위에 resolve leg 합류로 descriptor(pre)+resolve+from-output(post) 세 boundary 를 한 chain 으로 묶는 첫 triple-boundary closure; git grep 3 composer 동시-호출 smoke 0 부재 확인"
independentStream: realdata-e2e-descriptor-resolve-from-output-triple-boundary-closure-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·triple-boundary 3-leg pre/resolve/post·marker+issueNumber+run-identity 2축 동시 수렴·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0768(300)/T-0767(548)/T-0766(659)/T-0765(586) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-descriptor-resolve-from-output-triple-boundary-single-source-closure-assembly.smoke-spec.ts
---

# T-0769 — realdata-e2e step④ pre→resolve→post triple-boundary single-source closure non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 는 실 live caller 가 한 실행 사이클 안에서 **세 개의 boundary 컴포저**를 순서대로 wiring 한다:

1. **pre-execution descriptor** — `buildRealDataResultIssueDescriptor(summary, run)` → `{title, marker, body}`. marker 안에 `${run.dateToken}@${run.gitSha}` run token 박제(L94 `runToken`, L129 marker).
2. **command-args 묶음** — `buildRealDataResultIssueCommandArgs(descriptor)` → `{searchQuery, createArgs, updateArgs}`. `searchQuery` 는 **descriptor.marker 를 그대로** 담는다(helper L15-16·L87: "searchQuery 는 descriptor.marker 를 그대로 담는다").
3. **resolve** — `resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`. marker(=searchQuery)로 기존 이슈를 검색해 hit 가 있으면 `action.update.issueNumber = N`(최소 number), gh edit argv 산출.
4. **post-execution interpretation 단일-진입** — `buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)` → `{issueNumber, url, gitSha, dateToken, summaryLine}`. execStdout URL(`/issues/N`) 의 issueNumber 와 run 의 gitSha/dateToken 을 전파.

이 네 단(특히 1·3·4 = descriptor·resolve·from-output 세 boundary)이 **동일 단일 source `(run, summary, search-stdout, exec-stdout)`** 로부터 도출된 marker run token / issueNumber / run-identity 가 **세 boundary 를 한 chain 으로 묶어** byte-identical 수렴함이 **search-or-update 멱등성**(REQ-009, "동일 run → 동일 marker 로 동일 이슈를 찾아 갱신")의 종단 사람-친화 닫음이다 — 즉 "descriptor 가 만든 marker 로 검색해 찾은 이슈 N" 과 "실행 후 stdout 으로부터 해석한 이슈 N·run-identity" 가 같은 single-source 에서 drift 0 으로 수렴함.

직전 sibling 들은 **두 boundary 씩만** 묶었다:
- **T-0767**: resolve(pre) ↔ from-output(post) **issueNumber** 2-boundary — descriptor leg 미참조(marker 합성 boundary 없이 commandArgs 만 직접 합성).
- **T-0768**: descriptor(pre) ↔ from-output(post) **run-identity(gitSha·dateToken)** 2-boundary — resolve leg 미참조(검색→이슈 N 해소 boundary 없음).
- **T-0766**: publish-plan↔search-argv↔resolve↔descriptor **marker** 4자 — 전부 pre boundary(post from-output 합류 0).

본 task 는 그 세 sibling 이 각각 한 boundary 씩 빠뜨린 자리를 채워 **descriptor(pre) + resolve + from-output(post) 세 boundary 를 한 chain 으로 동시-호출**하는 **첫 triple-boundary single-source closure** 다. 새 결정 표면은 "marker 매체로 검색한 이슈 N(resolve.action.update.issueNumber) ↔ 실행 stdout 해석 이슈 N(from-output.issueNumber)" 의 cross-boundary 일치 + "descriptor.marker run token ↔ from-output.{gitSha,dateToken} run-identity" 의 cross-boundary 일치가 **한 chain 안에서 동시에** 성립함이다.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultIssueDescriptor AND resolveRealDataResultIssueGhCommandPlan AND buildRealDataResultIssueOutcomeReportFromOutput 세 composer 모두 호출) 여부; done` — **0 파일**(직전 fire 실측 확인). 어떤 smoke 도 세 boundary 컴포저를 같은 chain 에서 동시-호출하지 않는다.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — pre-execution descriptor 합성 컴포저. L73-76 `interface RealDataResultIssueRunRef {gitSha, dateToken}`. L85-89 `interface RealDataResultIssueDescriptor {title, marker, body}`. L93-95 `runToken(run)` = `${run.dateToken}@${run.gitSha}`. L118 `buildRealDataResultIssueDescriptor(summary, run)` — title(`prefix + token`)·marker(`prefix + token + -->`) 합성, gitSha/dateToken 빈/공백 → `assertNonBlank` throw(L99). 본 task chain 의 stage 1(pre boundary — marker run token source).
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — command-args 묶음 빌더. L90-95 `interface RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}`. L87 주석 "searchQuery: descriptor.marker 기반 검색 문자열". L119 `buildRealDataResultIssueCommandArgs(descriptor)` — `searchQuery = descriptor.marker`(그대로), createArgs/updateArgs 에 descriptor.title/body 전달. 본 chain 의 stage 2(marker → searchQuery 전달 layer). 본 task 는 commandArgs 자체 정합 재단언 0 — searchQuery 가 marker 를 운반함만 stage 2 로 사용.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — resolve 종단 컴포저. L38-41 `interface RealDataResultIssueGhCommandPlan {action, argv}`. L61 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` — (1) `parseRealDataResultIssueSearchOutput(stdout)` → hits, (2) `resolveRealDataResultIssueAction(hits, commandArgs.searchQuery)` → action(hit 1+ → `action.update.issueNumber = 최소 number`), (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` → argv. 본 chain 의 stage 3(검색 stdout + marker → 이슈 N 해소). searchStdout 은 hit 가 있는 JSON 배열 한 줄(아래 search-parse helper 형식 참조).
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — search stdout 파서. `parseRealDataResultIssueSearchOutput(stdout)` 가 받는 JSON 배열 stdout 형식(`[{"number": N, ...}]` 류) 확인 — searchStdout synthetic literal 합성용. 비JSON/비배열/원소 number 비양수 → throw 형식 참조.
- `test/helpers/realdata-e2e-result-issue-action.ts` 또는 `RealDataResultIssueAction` 정의 helper — `action.update.issueNumber`(hit 1+ 시 최소 number) / `action.create`(hit 0 시) 분기 shape 확인. 본 task 의 update 분기 issueNumber 접근 경로.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — post-execution 단일-진입 컴포저(T-0596). L88 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` — 내부에서 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` → outcome(issueNumber/url), (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` → report(run.gitSha/dateToken 전파). 본 chain 의 stage 4(post boundary — 실행 stdout 해석 → issueNumber·run-identity).
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post 파서. L78-81 `interface RealDataResultIssueOutcome {issueNumber, url}`. L83 GitHub issue URL 패턴 `https://github.com/<owner>/<repo>/issues/<number>`. execStdout(URL 한 줄) synthetic 합성 형식 참조 — issueNumber N 은 search hit 의 최소 number 와 동일하게 합성(cross-boundary 수렴 입력 조건).
- `test/smoke/realdata-e2e-resolve-outcome-report-from-output-issuenumber-3way-cross-boundary-convergence-assembly.smoke-spec.ts` (T-0767) — sibling resolve↔from-output issueNumber 2-boundary smoke. 패턴 참고(resolve + from-output 동시-호출 구조, searchStdout/execStdout synthetic 합성) + 중복 회피 — 본 task 는 descriptor leg 를 chain 시작에 추가해 triple-boundary 로 확장. resolve↔from-output issueNumber 2-boundary 자체 재단언은 transitive 로만 두고, **descriptor(marker run token)가 chain 시작 source 임을 추가**하는 부분이 본 task 의 새 단언.
- `test/smoke/realdata-e2e-descriptor-outcome-report-from-output-run-identity-cross-boundary-convergence-assembly.smoke-spec.ts` (T-0768) — sibling descriptor↔from-output run-identity 2-boundary smoke. 중복 회피 — 본 task 는 그 사이에 resolve leg 를 끼워 "descriptor.marker 로 검색→이슈 N→from-output" 의 issueNumber 합류를 추가. run-identity 축 단독 cross-boundary 재단언 금지(T-0768 cover), 본 task 는 marker+issueNumber 가 resolve 를 경유해 triple-boundary 로 묶이는 closure 만 새로 단언.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-descriptor-resolve-from-output-triple-boundary-single-source-closure-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path triple-boundary chain 합성**: 단일 source — `run: RealDataResultIssueRunRef {gitSha, dateToken}` synthetic literal, 유효 `summary: RealDataResultSummary` synthetic literal, 임의 양수 `N`. 다음을 한 chain 으로 호출: `descriptor = buildRealDataResultIssueDescriptor(summary, run)` → `commandArgs = buildRealDataResultIssueCommandArgs(descriptor)` → `searchStdout` = N 을 number 로 담은 search hit JSON 배열 한 줄(아래 search-parse 형식) → `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)`(hit 1+ → update 분기) → `execStdout` = `https://github.com/owner/repo/issues/N` URL 한 줄 → `outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`. 세 boundary 산출물이 모두 정상(descriptor `{title,marker,body}` 비어있지 않음, resolvePlan.action 이 update 분기로 `issueNumber` 보유, outcomeReport `{issueNumber,url,gitSha,dateToken,summaryLine}`) happy test 1+.
- [ ] **triple-boundary issueNumber single-source 수렴(branch — 핵심 불변식 1)**: search hit 에 넣은 N → resolve(marker 로 검색)가 해소한 `resolvePlan.action.update.issueNumber` → from-output(실행 stdout 해석)의 `outcomeReport.issueNumber` 가 **세 지점 모두 동일 N** 임을 묶어 단언 1+ test — `expect(resolvePlan.action.update.issueNumber).toBe(N)` AND `expect(outcomeReport.issueNumber).toBe(N)` AND `expect(outcomeReport.url).toContain(`/issues/${N}`)`. 즉 "descriptor marker 로 검색해 찾은 이슈 N" 과 "실행 stdout 해석 이슈 N" 이 한 chain 안에서 byte-identical 수렴(resolve↔from-output 경계 drift 0).
- [ ] **triple-boundary run-identity single-source 수렴(branch — 핵심 불변식 2)**: 단일 run source 로부터 도출된 gitSha·dateToken 이 descriptor(pre, marker run token)와 from-output(post, 전파)에서 동일함을 단언 1+ test — `expect(descriptor.marker).toContain(`${run.dateToken}@${run.gitSha}`)` AND `expect(outcomeReport.gitSha).toBe(run.gitSha)` AND `expect(outcomeReport.dateToken).toBe(run.dateToken)` AND `expect(outcomeReport.summaryLine).toContain(run.gitSha)` AND `expect(outcomeReport.summaryLine).toContain(run.dateToken)`. 즉 marker 의 run token 과 from-output 의 run-identity 가 한 chain 안에서 동일 run single-source 로 수렴(descriptor↔from-output 경계 drift 0).
- [ ] **marker → searchQuery → resolve 매개 무결성(branch — marker-as-search-medium)**: `commandArgs.searchQuery` 가 `descriptor.marker` 와 byte-identical 임을 단언(`expect(commandArgs.searchQuery).toBe(descriptor.marker)`), 그 marker(=searchQuery)가 resolve 의 검색 매체로 쓰여 hit 를 update 분기로 이끎을 단언(`expect(resolvePlan.action.update).toBeDefined()` 또는 action discriminant 가 update). 즉 descriptor marker 가 검색 token 으로 chain 의 resolve stage 를 매개함 1+ test. (commandArgs 자체 createArgs/updateArgs 정합 재단언 금지 — searchQuery=marker 운반만.)
- [ ] **create 분기 격리(branch — 검색 미스 → create, from-output 무관)**: 동일 run·summary 로 chain 을 호출하되 `searchStdout` 을 빈 hit(`[]` 또는 marker 미포함 hit)로 합성 → `resolvePlan.action` 이 **update 가 아니라 create 분기**(`action.create` defined, `action.update` 부재) 임을 단언 1+ test. 이때 from-output(post)은 여전히 execStdout 의 N 으로 issueNumber 를 산출 — resolve 의 create 분기 진입이 from-output 의 issueNumber 산출 경로와 독립(검색 결과 변경이 실행-stdout 해석에 누설 0). marker run token 은 create/update 두 분기 모두 동일.
- [ ] **run 분포 변별성(branch — 다른 run→다른 marker/run-identity, 같은 run→triple 수렴)**: 서로 다른 run 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-06-21"}`, run_B `{gitSha:"def5678", dateToken:"2026-06-29"}`) → 각각 동일 N 으로 chain 호출 → 두 chain 의 descriptor.marker token / outcomeReport.{gitSha,dateToken} 가 **각각 run_A·run_B 로 분리 수렴**(서로 다른 token, 단 각 chain 안에서 triple-boundary 일치) 1+ test. issueNumber N 은 두 chain 모두 동일(run 과 무관)임도 단언 — "run 은 변별, issueNumber 는 search-stdout 종속" 의 축 분리 박제.
- [ ] **summary 무관 — triple 수렴 격리(branch — partial-thread 격리)**: 동일 `run`·동일 N(searchStdout/execStdout)을 고정하고 `summary`(descriptor 입력)의 분포 값만 다르게 두 chain 호출 → 두 chain 의 descriptor.marker / resolvePlan.action.update.issueNumber / outcomeReport.{issueNumber,gitSha,dateToken} 가 **두 경우 동일**(summary 변경이 marker run token·issueNumber·run-identity 어느 축에도 누설 0 — REQ-009 "동일 run → 동일 marker, summary 무관" 정합) 1+ test. 단 descriptor.body 는 두 경우 달라야 함(body 는 summary 본문 반영 — 다른 축은 불변).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(세 boundary 의 거부 대칭 박제):
  - `run.gitSha` 빈/공백(`run = {gitSha:"", dateToken:"2026-06-29"}`) → descriptor(stage 1) 측 `assertNonBlank("gitSha")` throw(pre boundary 차단 — chain 시작 비식별).
  - `run.dateToken` 빈/공백 → descriptor(stage 1) 측 `assertNonBlank("dateToken")` throw 대칭.
  - `run.gitSha` 빈/공백 → from-output(stage 4) 측 builder 위임 `assertNonBlank` throw(post boundary 종단 비식별 — execStdout URL 정상이어도 차단, pre/post 대칭).
  - `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve(stage 3) 의 parse 위임 throw(검색 미산출 — marker 정상이어도 hits 추출 실패로 resolve 차단).
  - `execStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → from-output(stage 4) 의 (1) parse 위임 throw(post 미산출 — run 정상이어도 outcome 추출 실패).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/abc`) → from-output(stage 4) 의 (1) parse `assertPositiveIssueNumber` throw(post 비식별).
- [ ] **결정론·무공유·no-mutation**: 동일 (run, summary, searchStdout, execStdout) 입력으로 chain 두 번 호출 → descriptor/commandArgs/resolvePlan/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(summary, run) 가 chain 호출 후 mutate 0(원본 deep-equal 유지) 1+ test. AND 각 stage 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제(매 호출 새 객체).
- [ ] **credential 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 descriptor.{title,marker,body} / commandArgs.searchQuery / resolvePlan.argv / outcomeReport.{url,summaryLine} 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern descriptor-resolve-from-output-triple-boundary` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 search-stdout / exec-stdout 만.
- resolve↔from-output issueNumber 2-boundary 수렴 자체 단독 재단언 금지(T-0767 cover). 본 task 는 그 위에 descriptor(marker) leg 를 chain 시작에 합류시켜 triple-boundary closure 로만 단언.
- descriptor↔from-output run-identity 2-boundary 수렴 자체 단독 재단언 금지(T-0768 cover). 본 task 는 resolve leg 를 사이에 끼운 triple-boundary 형태로만.
- commandArgs 의 createArgs/updateArgs 정합(title/body=descriptor 보존)·labels 재단언 금지(command-args 가드 cover). 본 task 는 `searchQuery=descriptor.marker` 운반만 stage 2 로 사용.
- resolve 의 argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언 금지(gh-command-plan 가드 cover). 본 task 는 `action.update.issueNumber` 해소 결과만.
- from-output 단독 5필드(url trim 정규화·summaryLine 합성) 재유도 재단언 금지(T-0747 cover). 본 task 는 triple-boundary issueNumber/run-identity 수렴만.
- marker 축 search-resolve roundtrip 자체 재단언 금지(T-0758/T-0766 cover). 본 task 는 marker 가 chain 의 resolve 매체임만 부수 참조.
- descriptor.body 의 3블록 구조(marker→summaryLine→markdown) 무결성 재단언 금지(descriptor body 가드 cover).
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper 들(descriptor, command-args, gh-command-plan, search-parse, action, outcome-report-from-output, output-parse, summary)의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 pre boundary(descriptor)→command-args(searchQuery=marker)→resolve(search-stdout+commandArgs→action.update.issueNumber)→post boundary(from-output)를 같은 smoke 안에서 single-source(run + summary + search-stdout + exec-stdout)로 한 chain 으로 호출하는 합성 smoke 작성. search-stdout 의 hit JSON 형식은 search-parse helper 의 export 시그니처로, marker run token 형식은 descriptor helper 의 `runToken`(`${dateToken}@${gitSha}`)로, action.update.issueNumber 접근 경로는 action helper 의 discriminant 로 실제 확인해 단언 문자열 결정).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
