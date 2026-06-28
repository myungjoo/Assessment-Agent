---
id: T-0765
title: realdata-e2e step④ post-execution resolve↔parse↔outcome-report 3-composer single-source issueNumber 4자 cross-stage 수렴 — search-hit.minNumber ↔ resolveRealDataResultIssueGhCommandPlan.action.issueNumber ↔ parseRealDataResultIssueCreateEditOutput.issueNumber ↔ buildRealDataResultIssueOutcomeReport.issueNumber byte-identical 4자 수렴 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 320
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step④ post-execution sweep 연장 — T-0764 resolve↔parse 2-composer issueNumber 3자 수렴 위에 outcome-report leg 까지 묶어 search-hit.minNumber→resolve.action.issueNumber→parse.output.issueNumber→outcome-report.issueNumber 4자 cross-stage 수렴 박제; git grep resolveRealDataResultIssueGhCommandPlan AND buildRealDataResultIssueOutcomeReport 둘 다 호출하는 smoke 0 확인"
independentStream: realdata-e2e-resolve-parse-outcome-report-issuenumber-4way-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage 4-leg·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~320 LOC 1파일, T-0764/T-0763/T-0758 sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과(T-0763 628·T-0759 461·T-0758 459 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-resolve-parse-outcome-report-issuenumber-4way-convergence-assembly.smoke-spec.ts
---

# T-0765 — realdata-e2e step④ post-execution resolve↔parse↔outcome-report 3-composer single-source issueNumber 4자 cross-stage 수렴 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 **post-execution 결정 → 박제 결과 → 사람-친화 확인 리포트** 의 종단 chain 에서 **issueNumber 식별자가 모든 stage 를 통과해도 손실/swap 없이 동일 N 으로 유지**됨이 핵심 불변식이다. 그 chain 은 4 stage 로 나뉜다 — (1) search-hit (`RealDataResultIssueSearchHit[]` 의 hits 중 최소 `number` = 멱등 source, "가장 오래된 후보 이슈") → (2) resolver(`resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs).action.update.issueNumber` = N picked) → (3) post-execution parse(`parseRealDataResultIssueCreateEditOutput(execStdout).issueNumber` = gh 가 edit 후 stdout 으로 보고한 N) → (4) outcome-report(`buildRealDataResultIssueOutcomeReport(parseOutcome, runPlan.run).issueNumber` = 사람-친화 확인 리포트 descriptor 안 N).

이 4 stage 가 동일 N 으로 byte-identical 수렴해야 — caller live wiring 의 어느 단계에서도 issue 식별자 drift 가 0 임이 박제되어 — **search-or-update 멱등성**(REQ-009 — 같은 run 의 결과 이슈가 항상 동일 issue 로 단일성 유지) 과 **결과 리포트 재실행 정합**(REQ-037 — 같은 run 의 결과가 동일 식별자로 외화) 양쪽이 cross-stage 로 보호된다. 어느 한 leg 에서 N drift(예: parse 가 M≠N 으로 빗나가고 outcome-report 가 M 을 그대로 사람에게 보고)가 발생하면 사람이 보는 확인 리포트의 issue 번호와 실제 박제된 이슈가 어긋난다(stale identifier swap drift).

기존 sweep 은 leg 들을 부분적으로 닫았다:
- **T-0758**: marker 축 pre-execution roundtrip(search-argv ↔ resolve.searchQuery ↔ descriptor.marker 3자) — pre-execution, marker 축.
- **T-0764**: issueNumber 축 post-execution roundtrip(search-hit.minNumber ↔ resolve.action.update.issueNumber ↔ parse.output.issueNumber 3자) — **resolve↔parse 2-composer**, issueNumber 축. outcome-report leg 미포함.
- **T-0701/T-0702/T-0725**: parse → outcome-report 5필드 재유도 sibling(`realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts`) — **parse→outcome-report 단일 leg** 의 deep-equal 정합 박제. resolver leg 미참조, cross-stage 4자 수렴 단언 0.

본 task 는 T-0764 의 자연 후속 — **outcome-report leg 를 chain 에 합류시켜 search-hit.minNumber → resolve.action.update.issueNumber → parse.output.issueNumber → outcome-report.issueNumber 의 4자 byte-identical cross-stage 수렴** 을 단일 smoke 안에서 묶어 박제한다. 이는 sweep 안에서 처음으로 **3 composer 를 동일 source(searchStdout + commandArgs + runPlan.run)로 동시-호출** 해 4 stage 의 N 식별자가 cross-stage 로 손실 0 임을 박제하는 자리다. T-0758(marker 축)·T-0764(issueNumber 축 2-composer)·T-0763(run 축 3-composer descriptor)·T-0762(report 축 2-composer publish↔report)·T-0761(modelId 축 2-composer pipeline↔evaluation)·T-0760(seeds 축 2-composer upsert↔collect) sweep 의 자연 연장 — **issueNumber 축을 outcome-report 까지 3-composer 로 묶는 마지막 그물**.

gap 확인(git grep, origin/main):
- `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (resolveRealDataResultIssueGhCommandPlan AND buildRealDataResultIssueOutcomeReport 둘 다 실 호출 + 4자 cross-stage N 수렴 단언) 여부; done` — **0 파일**. resolver 측 smoke 는 T-0758/T-0764 가 parse 까지만, outcome-report 측 smoke 는 T-0701/T-0702/T-0725 가 parse 부터만 — **resolve→parse→outcome-report 3 composer 를 동시 호출해 4자 수렴 단언한 smoke 부재**.
- T-0758(marker 축 pre-exec)·T-0764(issueNumber 축 resolve↔parse) 와 의도 중복 0 — 본 task 는 outcome-report leg 추가가 새 결정 표면.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — gh-command-plan 종단 컴포저. L38-41 `interface RealDataResultIssueGhCommandPlan {action, argv}`. L61-79 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`. update 분기에서 `action: {action:'update', issueNumber: N}` 박제 — 본 task 의 resolve leg(stage 2) source.
- `test/helpers/realdata-e2e-result-issue-action.ts` — resolver. L77-78 `RealDataResultIssueAction = {action:'create'} | {action:'update', issueNumber: number}`. L106-107 `resolveRealDataResultIssueAction(hits, marker)` — 후보 1+건→update + `Math.min(...hits.map(h => h.number))` 최소 번호(L150). 멱등 source(stage 1: search-hit.minNumber).
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post-execution 파서. L74-81 `interface RealDataResultIssueOutcome {issueNumber, url}`. L88-89 `ISSUE_URL_PATTERN` 결정론. L120-158 `parseRealDataResultIssueCreateEditOutput(stdout)` — issueNumber 양의 정수 guard. 본 task 의 parse leg(stage 3) source.
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — L61-67 `interface RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken, summaryLine}`. L80-88 `assertPositiveIssueNumber`. 그 아래 `buildRealDataResultIssueOutcomeReport(outcome, run)` — outcome.issueNumber/url + run.gitSha/dateToken 을 결합해 사람-친화 confirmation report descriptor 산출. 본 task 의 outcome-report leg(stage 4) source.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}` shape(resolver 입력 합성용).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — L73 `RealDataResultIssueRunRef {gitSha, dateToken}`, L85 `RealDataResultIssueDescriptor {title, marker, body}`. outcome-report 가 받는 runPlan.run source.
- `test/smoke/realdata-e2e-resolve-parse-issuenumber-roundtrip-convergence-assembly.smoke-spec.ts` (T-0764) — 직전 머지된 sibling resolve↔parse 2-composer issueNumber 3자 수렴 smoke. 중복 회피 — 본 task 는 resolve↔parse 의 issueNumber 3자 수렴 위에 **outcome-report leg 1 단을 더 추가해 4자로 확장**(stage 4 가 새 단), resolve↔parse 의 2-composer 3자 수렴 자체는 T-0764 cover 라 본 task 는 outcome-report 의 N === parse.N 합류 만 새로 단언(3자 부분 재단언 금지 — 부속만 짧게 sanity 박제).
- `test/smoke/realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts` (T-0701/T-0702/T-0725) — sibling parse → outcome-report 5필드 재유도 smoke. 중복 회피 — 본 task 는 outcome-report 의 issueNumber 가 **resolve.action.update.issueNumber 와 수렴함**만(resolve leg 와 합류 cross-stage 측), parse → outcome-report 의 5필드 재유도(gitSha/dateToken/summaryLine/url trim 등) 재단언 금지(T-0701/T-0702/T-0725 cover).
- `test/smoke/realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts` (T-0758) — sibling marker 축 pre-execution roundtrip smoke. 중복 회피 — 본 task 는 marker 축 단언 0(T-0758 cover), issueNumber 축 단언만.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-resolve-parse-outcome-report-issuenumber-4way-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path 4자 chain 합성**: 단일 search source(`searchStdout`: marker 포함 `RealDataResultIssueSearchHit[]` JSON 직렬화, 후보 1+건) + 유효 `commandArgs: RealDataResultIssueCommandArgs`(synthetic descriptor literal → descriptor.marker == searchQuery) + 유효 `runPlan.run: RealDataResultIssueRunRef {gitSha, dateToken}` 합성. 다음 3 composer 를 순차 호출 — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)`, `parseOutcome = parseRealDataResultIssueCreateEditOutput(createEditStdout)`(synthetic, resolver 가 picked 한 update.issueNumber N 으로 `https://github.com/owner/repo/issues/N` 한 줄 stdout), `outcomeReport = buildRealDataResultIssueOutcomeReport(parseOutcome, runPlan.run)`. 세 산출물이 모두 정상(resolvePlan: `{action:{action:'update', issueNumber:N}, argv}`, parseOutcome: `{issueNumber:N, url}`, outcomeReport: `{issueNumber:N, url, gitSha, dateToken, summaryLine}`) happy test 1+.
- [ ] **cross-stage issueNumber single-source 4자 수렴(branch — 핵심 불변식)**: 단일 search source(searchStdout 안 hits)로부터 도출된 N 이 4 stage 전부 byte-identical 일치함을 묶어 단언 1+ test — `expect(resolvePlan.action.issueNumber).toBe(Math.min(...hitsNumbers))`(stage 1→2, search-hit.minNumber→resolve) AND `expect(parseOutcome.issueNumber).toBe(resolvePlan.action.issueNumber)`(stage 2→3, resolve→parse) AND `expect(outcomeReport.issueNumber).toBe(parseOutcome.issueNumber)`(stage 3→4, parse→outcome-report) AND **`expect(outcomeReport.issueNumber).toBe(Math.min(...hitsNumbers))`(stage 4 ↔ stage 1 종단 closure, 4자 단일 source 박제)**. 즉 search-hit.minNumber → resolve.action.update.issueNumber → parse.output.issueNumber → outcome-report.issueNumber 4 stage 가 **동일 N 식별 token single-source 4자 수렴**(어느 경로도 stale/swap drift 0).
- [ ] **argv → URL → outcome-report 종단 N 일치(branch — argv/url-mediated 수렴)**: 동일 N 이 모든 매체에 박제됨을 단언 1+ test — `expect(resolvePlan.argv).toContain(String(N))`(argv 안 N) AND `expect(parseOutcome.url).toContain(\`/issues/\${N}\`)`(parse 가 URL 에서 N 추출) AND `expect(outcomeReport.url).toBe(parseOutcome.url)`(outcome-report 가 url 전파, 5필드 재유도 의 일부 — 정합 sanity 만, 본격 5필드 재유도 박제는 T-0701/T-0702/T-0725 cover). 즉 argv/URL/outcome-report 의 3 매체에 박힌 N 식별 token 이 동일.
- [ ] **search-hit 분포 변별성(branch — 멱등 source 박제, 다른 N→다른 4자 수렴 chain)**: 서로 다른 search source 두 개(예: hits 분포 A: `[{number:11},{number:23}]` → N_A=11, hits 분포 B: `[{number:37},{number:59}]` → N_B=37) → 각각 chain 호출(resolve + 대응 createEditStdout parse + outcome-report) → 두 chain 의 4 stage 가 **각각 11/11/11/11, 37/37/37/37 로 분리 수렴**(서로 다른 N, 단 각 chain 안에서 4자 일치) 1+ test. "다른 search source→다른 N, 같은 N→4자 수렴" 의 결정론적 변별 박제.
- [ ] **multi-hit minNumber 정합 분기에서도 4자 수렴 보존(branch)**: hits 가 3+ 원소(예: `[{number:91},{number:13},{number:47}]` — 순서 unsorted)로 chain 호출 → 4 stage 가 모두 13(최소값) 으로 일치 1+ test. 멱등 source(가장 오래된 이슈 = 최소 number) 가 multi-hit 분포에서도 종단 4자 보존됨을 cross-stage 박제.
- [ ] **runPlan.run 무관 — issueNumber 4자 수렴 격리(branch — partial-thread 격리)**: 동일 search source + 동일 createEditStdout (= 동일 N) 을 고정하고 `runPlan.run` 의 gitSha/dateToken 만 다르게 두 chain 호출 → 두 chain 의 `outcomeReport.issueNumber` / `parseOutcome.issueNumber` / `resolvePlan.action.issueNumber` 가 **두 경우 동일 N**(run 식별자 변경이 issueNumber 축에 누설 0 — 결정론 박제, T-0759 의 run 축 cross-leg 격리 mirror). 단 outcomeReport.gitSha/dateToken/summaryLine 는 두 경우 달라야 함(run leg 가 자기 영역에서는 정상 전파). 1+ test.
- [ ] **stdout 무관·resolve 독립(branch — partial-thread 격리, 두 번째 축)**: 동일 `resolvePlan`(=동일 N) 을 고정하고 `createEditStdout` 의 URL **외 텍스트**만 다르게(예: 다중 줄 gh 부가 메시지·trailing 개행/공백·앞뒤 noise) 두 chain 호출 → `parseOutcome.issueNumber` / `outcomeReport.issueNumber` 가 **두 경우 byte-identical N**(첫 매칭 URL 결정론 박제 + 부가 본문 누설 0, R-59 정합) AND `resolvePlan.action.issueNumber` 와 수렴 유지 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(4 stage 각 leg 의 N 식별자 거부 대칭 박제):
  - 빈 `searchStdout = ""`(또는 비JSON `"not-json"`) → resolve leg parse-search 위임 단계 throw 전파(stage 2 미진입, N 미결정 — chain 전체 짧음).
  - 후보 hit number 비양수(`[{number:0,...}]` 또는 `[{number:-3,...}]`) → resolve leg `assertPositiveNumber` 위임 throw(stage 1→2 차단, N 비식별).
  - `createEditStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → parse leg throw(stage 3 미산출, outcome-report 미진입).
  - `createEditStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/007` 또는 `/issues/abc`) → parse leg `assertPositiveIssueNumber` throw(stage 3 비식별, stage 4 미진입).
  - `runPlan.run.gitSha` 빈/공백(`run = {gitSha:"", dateToken:"2026-06-28"}`) → outcome-report leg `assertNonBlank` throw(stage 4 비식별 차단 — N 자체는 stage 3 까지 정상이어도 outcome-report 비식별 시 4자 chain 종단 실패).
  - `runPlan.run.dateToken` 빈/공백 → outcome-report leg throw 대칭(stage 4 비식별).
  - parseOutcome.issueNumber 가 양의 정수지만 0/음수/비정수 직접 주입 시(예: `parseOutcome = {issueNumber:0, url:"https://..."}` 강제 합성) → outcome-report leg `assertPositiveIssueNumber` throw(stage 4 guard 가 stage 3 산출을 재검증함을 박제 — 4 stage 가 독립 guard 보유 → 어느 stage 도 잘못된 N 을 다음 단으로 그대로 전파하지 않음, defense-in-depth 박제).
- [ ] **create 분기 분리(branch — update path 만 4자 수렴 의미)**: 빈 search stdout(`"[]"`) → `resolvePlan.action.action === 'create'`(N 부재 — `action` 에 issueNumber 필드 미존재) 1+ test. 본 task 의 cross-stage 4자 N 수렴 단언은 **적용 대상 아님**(create 분기는 N source 자체가 없어 수렴 단언 무의미, outcome-report 도 stage 4 미진입) 명시 분기 박제. 본 task 의 수렴 불변식은 update 분기에서만 의미.
- [ ] **결정론·무공유·no-mutation**: 동일 (searchStdout, commandArgs, createEditStdout, runPlan.run) 입력으로 chain 두 번 호출 → resolvePlan/parseOutcome/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(commandArgs, hitsNumbers 배열, runPlan.run) 가 chain 호출 후 mutate 0(원본 deep-equal 유지) 1+ test. AND 세 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제.
- [ ] **credential argv 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 resolvePlan.argv / parseOutcome.url / outcomeReport.summaryLine 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern resolve-parse-outcome-report-issuenumber-4way` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 stdout 만.
- parse → outcome-report 5필드(gitSha/dateToken/summaryLine/url trim 등) 재유도 deep-equal 재단언 금지(T-0701/T-0702/T-0725 cover). 본 task 는 issueNumber 축의 4자 수렴 + url 전파 sanity 만.
- marker 축 pre-execution roundtrip 재단언 금지(T-0758 cover). 본 task 는 issueNumber 축만.
- resolve↔parse 2-composer issueNumber 3자 수렴 자체 재단언 금지(T-0764 cover). 본 task 는 outcome-report leg 합류로 4자 확장 부분만 새로 단언(3자 부분은 외화된 N 변수로 짧게 sanity).
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 4 helper(gh-command-plan, output-parse, outcome-report, action) 의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 4개의 export 시그니처만 import 해 4자 cross-stage 수렴을 single-source 로 묶는 합성 smoke 작성).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
