---
id: T-0767
title: realdata-e2e step④ pre/post-execution cross-boundary resolve↔outcome-report-from-output 단일-진입 issueNumber 3자 수렴 — search-hit.minNumber ↔ resolveRealDataResultIssueGhCommandPlan.action.update.issueNumber ↔ buildRealDataResultIssueOutcomeReportFromOutput.issueNumber byte-identical 3자 cross-boundary 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step④ pre/post 경계 sweep — T-0764/T-0765(post 3-composer 단편) 위에 buildRealDataResultIssueOutcomeReportFromOutput(T-0596, post 단일-진입) 합류로 live caller 가 실제 wiring 하는 단일 진입점 ↔ pre 측 resolve action 의 issueNumber 가 동일 N 으로 수렴함을 박제; 기존 smoke 에 resolve+from-output 동시-호출 0 확인"
independentStream: realdata-e2e-resolve-outcome-report-from-output-issuenumber-3way-cross-boundary-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage 3-leg pre/post 경계·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0766(659)/T-0765(586)/T-0764(525)/T-0763(628) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-resolve-outcome-report-from-output-issuenumber-3way-cross-boundary-convergence-assembly.smoke-spec.ts
---

# T-0767 — realdata-e2e step④ pre/post-execution cross-boundary resolve↔outcome-report-from-output 단일-진입 issueNumber 3자 수렴 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 **pre-execution decision** 컴포저(`resolveRealDataResultIssueGhCommandPlan`)와 **post-execution interpretation 단일-진입** 컴포저(`buildRealDataResultIssueOutcomeReportFromOutput` — T-0596)는 **실 live caller 가 실행 사이클의 양쪽 boundary 에서 실제로 wiring 하는 두 진입점**이다. 그 둘이 동일 멱등 source 의 N(issueNumber) 식별자로 cross-boundary 수렴함이 **search-or-update 멱등성**(REQ-009)·**결과 리포트 재실행 정합**(REQ-037)의 종단 사람-친화 닫음이다.

이 3 stage 는 — (1) search-hit (`RealDataResultIssueSearchHit[]` 의 hits 중 최소 `number` = 멱등 source, "가장 오래된 후보 이슈") → (2) **pre-execution decision** (`resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs).action.update.issueNumber` = N picked, 다음 단계 gh edit argv 안에도 같은 N 박힘) → (3) **post-execution single-entry interpretation** (`buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run).issueNumber` = gh edit 실행 후 stdout(URL `/issues/N`) 을 단일 진입 컴포저가 outcome → outcome-report 2-단계 위임으로 합성한 결과 안 N).

기존 sweep 은 **두 진입점 중 어느 한쪽씩만** smoke 안에서 호출했다:
- **T-0764/T-0765**: resolve(pre)·parse(post atomic)·outcome-report(post atomic) 3 개를 **각각** 호출 — `buildRealDataResultIssueOutcomeReportFromOutput` 단일 진입은 미참조(post 측은 parse+outcome-report atomic 두 단으로만 본다).
- **T-0747** (`create-edit-output-outcome-report-assembly.smoke-spec.ts`): `buildRealDataResultIssueOutcomeReportFromOutput` 호출 — 그러나 resolve(pre) 측 leg 미참조(post 단독 5필드 재유도만).
- **T-0729 / T-0617 / T-0758**: publish-plan / publish-tri-leg / search-resolve marker — pre-execution 측만, post 단일-진입 미참조.

본 task 는 **두 단일-진입 boundary 컴포저(resolve + from-output)를 같은 smoke 안에서 single-source(searchStdout + commandArgs + execStdout + run)로 동시-호출** 해 search-hit.minNumber → resolve.action.update.issueNumber → from-output.issueNumber 3자 cross-boundary 수렴을 박제한다. live caller 가 두 진입점만 wiring 한다는 관점에서, 이는 sweep 안에서 가장 사람-친화 (live wiring 관점) 의 종단 그물이다 — caller 의 단일-진입 두 컴포저 사이에서 N 식별자 drift 가 0 임을 보장.

gap 확인(git grep, origin/main):
- `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (resolveRealDataResultIssueGhCommandPlan AND buildRealDataResultIssueOutcomeReportFromOutput 둘 다 실 호출 + 3자 cross-boundary N 수렴 단언) 여부; done` — **0 파일**(직전 fire 분석 확인). T-0764/T-0765 는 from-output 미호출, T-0747 는 resolve 미호출.
- T-0764(resolve↔parse 2-composer)·T-0765(resolve↔parse↔outcome-report 3-composer, atomic post)·T-0747(from-output 단독 5필드 재유도) 와 의도 중복 0 — 본 task 는 **live wiring 의 단일-진입 두 boundary 컴포저 합류**가 새 결정 표면.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — pre-execution 종단 single-entry 컴포저. L38-41 `interface RealDataResultIssueGhCommandPlan {action, argv}`. L61-79 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`. update 분기에서 `action: {action:'update', issueNumber: N}` 박제. 본 task 의 stage 2 source(pre boundary 단일 진입).
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — post-execution 단일-진입 컴포저(T-0596). L88-110 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` — 내부에서 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` 으로 outcome 추출, (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` 로 report 합성. 합성 직후 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)` self-wire. 본 task 의 stage 3 source(post boundary 단일 진입).
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post-execution 파서. L74-81 `interface RealDataResultIssueOutcome {issueNumber, url}`. L88-89 `ISSUE_URL_PATTERN` 결정론. `from-output` 내부 위임처 — 본 task 는 직접 호출 0(from-output 안에 위임).
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — post-execution 빌더. L102-153 `buildRealDataResultIssueOutcomeReport(outcome, run)` — `from-output` 의 두 번째 단 위임처. 본 task 는 직접 호출 0.
- `test/helpers/realdata-e2e-result-issue-action.ts` — resolver. L77-78 `RealDataResultIssueAction = {action:'create'} | {action:'update', issueNumber: number}`. L106-107 `resolveRealDataResultIssueAction(hits, marker)` — 후보 1+건→update + `Math.min(...hits.map(h => h.number))` 최소 번호(L150). 멱등 source(stage 1: search-hit.minNumber).
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}` shape(resolver 입력 합성용).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — L73 `RealDataResultIssueRunRef {gitSha, dateToken}`, L85 `RealDataResultIssueDescriptor {title, marker, body}`. from-output 가 받는 run source.
- `test/smoke/realdata-e2e-resolve-parse-outcome-report-issuenumber-4way-convergence-assembly.smoke-spec.ts` (T-0765) — 직전 sibling post-execution 3-composer atomic 4자 수렴 smoke. 중복 회피 — 본 task 는 atomic parse+outcome-report 두 단을 묶은 **단일-진입 from-output 컴포저**로 호출, atomic 5필드 재유도(gitSha/dateToken/summaryLine/url trim 등)·atomic parse-leg 의 issueNumber 재검증·search-hit↔resolve(2자) 수렴 자체 재단언 금지(T-0765 cover). 본 task 는 cross-boundary 3자 — search-hit.minNumber → resolve.action.update.issueNumber → from-output.issueNumber — 의 단일-진입 합류만 새로 단언.
- `test/smoke/realdata-e2e-resolve-parse-issuenumber-roundtrip-convergence-assembly.smoke-spec.ts` (T-0764) — 직전 sibling 2-composer 3자 roundtrip. 중복 회피 — 본 task 는 resolve↔parse 2-composer 의 atomic 3자 수렴 자체 재단언 금지(T-0764 cover), from-output 단일-진입 으로의 cross-boundary 합류만.
- `test/smoke/realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts` (T-0747) — sibling from-output 단독 5필드 재유도 smoke. 중복 회피 — 본 task 는 from-output 의 5필드(url/gitSha/dateToken/summaryLine 등) 재유도 재단언 금지(T-0747 cover), resolve(pre boundary) leg 합류로 cross-boundary N 수렴 박제만.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-resolve-outcome-report-from-output-issuenumber-3way-cross-boundary-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path 3자 cross-boundary chain 합성**: 단일 search source(`searchStdout`: marker 포함 `RealDataResultIssueSearchHit[]` JSON 직렬화, 후보 1+건) + 유효 `commandArgs: RealDataResultIssueCommandArgs`(synthetic descriptor literal → descriptor.marker == searchQuery) + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}` 합성. 다음 2 single-entry composer 를 순차 호출 — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)`, `outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`(synthetic execStdout, resolvePlan.action.update.issueNumber N 으로 `https://github.com/owner/repo/issues/N` 한 줄). 두 산출물이 모두 정상(resolvePlan: `{action:{action:'update', issueNumber:N}, argv}`, outcomeReport: `{issueNumber:N, url, gitSha, dateToken, summaryLine}`) happy test 1+.
- [ ] **cross-boundary issueNumber single-source 3자 수렴(branch — 핵심 불변식)**: 단일 search source(searchStdout 안 hits)로부터 도출된 N 이 pre-execution decision boundary 와 post-execution interpretation single-entry boundary 양쪽에서 byte-identical 일치함을 묶어 단언 1+ test — `expect(resolvePlan.action.issueNumber).toBe(Math.min(...hitsNumbers))`(stage 1→2, search-hit.minNumber→resolve, pre boundary) AND `expect(outcomeReport.issueNumber).toBe(resolvePlan.action.issueNumber)`(stage 2→3, resolve(pre)→from-output(post), cross-boundary) AND `expect(outcomeReport.issueNumber).toBe(Math.min(...hitsNumbers))`(stage 3 ↔ stage 1 종단 closure, 3자 single source 박제). 즉 search-hit.minNumber → resolve.action.update.issueNumber → from-output.issueNumber 3 stage 가 **동일 N 식별 token single-source 3자 cross-boundary 수렴**(pre/post 경계 어느 쪽도 stale/swap drift 0).
- [ ] **argv → execStdout URL → outcome-report URL 종단 N 일치(branch — argv/url-mediated 수렴)**: 동일 N 이 모든 매체에 박제됨을 단언 1+ test — `expect(resolvePlan.argv).toContain(String(N))`(resolve.argv 안 N, pre boundary 매체) AND `expect(outcomeReport.url).toContain(\`/issues/\${N}\`)`(from-output 가 execStdout URL 에서 N 추출, post boundary 매체) AND `expect(outcomeReport.summaryLine).toContain(\`#\${N}\`)`(사람-친화 summaryLine 안 #N — outcome-report 합성 산출). 즉 resolve.argv / execStdout URL / outcome-report.url / outcome-report.summaryLine 의 4 매체에 박힌 N 식별 token 이 동일.
- [ ] **search-hit 분포 변별성(branch — 멱등 source 박제, 다른 N→다른 3자 수렴 chain)**: 서로 다른 search source 두 개(예: hits 분포 A: `[{number:11},{number:23}]` → N_A=11, hits 분포 B: `[{number:37},{number:59}]` → N_B=37) → 각각 chain 호출(resolve + 대응 execStdout from-output) → 두 chain 의 3 stage 가 **각각 11/11/11, 37/37/37 으로 분리 수렴**(서로 다른 N, 단 각 chain 안에서 3자 일치) 1+ test. "다른 search source→다른 N, 같은 N→3자 수렴" 의 결정론적 변별 박제.
- [ ] **multi-hit minNumber 정합 분기에서도 3자 수렴 보존(branch)**: hits 가 3+ 원소(예: `[{number:91},{number:13},{number:47}]` — 순서 unsorted)로 chain 호출 → 3 stage 가 모두 13(최소값) 으로 일치 1+ test. 멱등 source(가장 오래된 이슈 = 최소 number) 가 multi-hit 분포에서도 cross-boundary 단일-진입 두 컴포저 사이에서 보존됨을 박제.
- [ ] **run 무관 — issueNumber 3자 수렴 격리(branch — partial-thread 격리)**: 동일 search source + 동일 execStdout (= 동일 N) 을 고정하고 `run` 의 gitSha/dateToken 만 다르게 두 chain 호출 → 두 chain 의 `outcomeReport.issueNumber` / `resolvePlan.action.issueNumber` 가 **두 경우 동일 N**(run 식별자 변경이 issueNumber 축에 누설 0 — 결정론 박제). 단 outcomeReport.gitSha/dateToken/summaryLine 은 두 경우 달라야 함(run leg 가 자기 영역에서는 정상 전파) 1+ test.
- [ ] **execStdout 부가 noise 무관 — from-output 단일-진입 분리(branch — partial-thread 격리, 두 번째 축)**: 동일 `resolvePlan`(=동일 N) 을 고정하고 `execStdout` 의 URL **외 텍스트**만 다르게(예: 다중 줄 gh 부가 메시지·trailing 개행/공백·앞뒤 noise) 두 chain 호출 → `outcomeReport.issueNumber` 가 **두 경우 byte-identical N**(첫 매칭 URL 결정론 박제 + 부가 본문 누설 0, R-59 정합) AND `resolvePlan.action.issueNumber` 와 수렴 유지 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(pre/post boundary 양쪽의 N 식별자 거부 대칭 박제):
  - 빈 `searchStdout = ""`(또는 비JSON `"not-json"`) → resolve leg parse-search 위임 단계 throw 전파(stage 2 미진입, pre boundary 차단).
  - 후보 hit number 비양수(`[{number:0,...}]` 또는 `[{number:-3,...}]`) → resolve leg `assertPositiveNumber` 위임 throw(stage 1→2 차단, N 비식별).
  - `execStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → from-output 의 (1) parse 위임 throw(stage 3 미산출, post boundary 단일-진입이 자체 try/catch 0 으로 전파).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/007` 또는 `/issues/abc`) → from-output 의 (1) parse 위임 `assertPositiveIssueNumber` throw(stage 3 비식별).
  - `run.gitSha` 빈/공백(`run = {gitSha:"", dateToken:"2026-06-29"}`) → from-output 의 (2) builder 위임 `assertNonBlank` throw(stage 3 builder 단계 비식별 — N 자체는 (1) 까지 정상이어도 post boundary 종단 실패).
  - `run.dateToken` 빈/공백 → from-output 의 (2) builder throw 대칭(stage 3 builder 비식별).
- [ ] **create 분기 분리(branch — update path 만 3자 수렴 의미)**: 빈 search stdout(`"[]"`) → `resolvePlan.action.action === 'create'`(N 부재 — `action` 에 issueNumber 필드 미존재) 1+ test. 본 task 의 cross-boundary 3자 N 수렴 단언은 **적용 대상 아님**(create 분기는 N source 자체가 없어 수렴 단언 무의미, from-output 도 post boundary 진입 가능하나 N 합류 표면이 없음) 명시 분기 박제. 본 task 의 수렴 불변식은 update 분기에서만 의미.
- [ ] **결정론·무공유·no-mutation**: 동일 (searchStdout, commandArgs, execStdout, run) 입력으로 chain 두 번 호출 → resolvePlan/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(commandArgs, hitsNumbers 배열, run) 가 chain 호출 후 mutate 0(원본 deep-equal 유지) 1+ test. AND 두 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제(매 호출 새 객체).
- [ ] **credential argv 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 resolvePlan.argv / outcomeReport.url / outcomeReport.summaryLine 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern resolve-outcome-report-from-output-issuenumber-3way-cross-boundary` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 stdout 만.
- post-execution atomic 3-composer(resolve↔parse↔outcome-report) 4자 수렴 자체 재단언 금지(T-0765 cover). 본 task 는 atomic parse+outcome-report 두 단을 **단일-진입 from-output 컴포저**로 호출 — 5필드 재유도 / atomic parse 단의 issueNumber 재검증 / search-hit↔resolve 2자 수렴 자체 재단언 금지.
- resolve↔parse 2-composer 3자 roundtrip 재단언 금지(T-0764 cover).
- from-output 단독 5필드 재유도(url/gitSha/dateToken/summaryLine 합성·url trim 정규화) 재단언 금지(T-0747 cover). 본 task 는 issueNumber 축 cross-boundary 수렴만.
- marker 축 pre-execution roundtrip 재단언 금지(T-0758/T-0766 cover). 본 task 는 issueNumber 축만.
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper 들(gh-command-plan, outcome-report-from-output, action, command-args, descriptor)의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 pre/post boundary 의 두 단일-진입 컴포저를 같은 smoke 안에서 single-source(searchStdout + commandArgs + execStdout + run)로 동시-호출 하는 합성 smoke 작성).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
