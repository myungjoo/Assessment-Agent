---
id: T-0764
title: realdata-e2e step④ post-execution resolve↔parse issueNumber single-source roundtrip 수렴 — resolveRealDataResultIssueGhCommandPlan(update path).action.issueNumber ↔ parseRealDataResultIssueCreateEditOutput(stdout).issueNumber byte-identical 3자 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step④ 멱등 search-or-update 의 post-execution complement — resolve.action(update).issueNumber 와 parse(create/edit stdout).issueNumber 가 동일 N 단일 source 로 byte-identical 3자 수렴함을 묶는 cross-stage non-gated smoke 0 gap; git grep resolveRealDataResultIssueGhCommandPlan AND parseRealDataResultIssueCreateEditOutput 동시-호출 smoke 0 확인"
independentStream: realdata-e2e-resolve-parse-issuenumber-roundtrip-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage·multi-source·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0763/T-0762/T-0761/T-0758 sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과(T-0759 461·T-0758 459 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-resolve-parse-issuenumber-roundtrip-convergence-assembly.smoke-spec.ts
---

# T-0764 — realdata-e2e step④ post-execution resolve↔parse issueNumber single-source 3자 roundtrip 수렴 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 핵심 불변식은 **pre-execution 결정과 post-execution 관측이 동일 issue 식별자에 수렴**한다는 것이다 — 즉 resolver `resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)` 가 update 분기에서 `action: {action:'update', issueNumber: N}` 으로 박은 N 과, 그 plan 의 edit argv(`['issue','edit', String(N), ...]`)를 caller 가 `execFile('gh', argv)` 로 실행한 뒤 받는 stdout 을 `parseRealDataResultIssueCreateEditOutput(stdout)` 가 산출하는 `{issueNumber, url}` 의 `issueNumber` 가 **동일 N 으로 byte-identical 수렴**해야 한다. 또한 그 N 은 resolver 가 입력으로 받은 `searchStdout` JSON 안의 후보 hit 들 중 최소 `number`(멱등 source — 가장 오래된 이슈) 와도 일치해 **search-hit.minNumber ↔ resolve.action.update.issueNumber ↔ parse.output.issueNumber 3자 수렴** 박제한다.

이 수렴이 깨지면(예: resolver 가 N=7 을 picked 했으나 parse 가 M=8 을 outcome 으로 보고하면) — 우리는 "issue #7 을 edit 하라" 고 gh 에 지시했는데 stdout 이 #8 의 URL 을 reporting 한 셈이라 **result-issue 식별자가 멱등 갱신 chain 안에서 stale/swap drift** 했음을 의미한다. caller live wiring 은 이 drift 를 모른 채 `RealDataResultIssueOutcomeReport` 의 `issueNumber` 로 N 대신 M 을 박제하게 되어, 다음 평가 run 의 search-or-update 단계가 동일 marker 로 다른 issue 를 매칭해 **search-or-update 멱등성**(REQ-009 — 같은 run 의 결과 이슈가 항상 동일 issue 로 단일성 유지) 과 **결과 리포트 재실행 정합**(REQ-037 — 같은 run 의 결과가 동일 식별자로 외화) 이 동시에 무너진다. resolver 헤더(L25, L77-78, L150)가 명시한 사고 표면 그대로 — "update issueNumber = 후보 최소 number, 멱등 source" 가드 의 post-execution mirror.

기존 sweep 은 두 leg 를 **각각 따로** 닫았다: resolver 측은 `realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts`(T-0758, search marker ↔ resolve searchQuery ↔ descriptor.marker 3자 수렴 — **marker 축, pre-execution leg 단독**)·`realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts`(T-0698, gh-command-plan 내부 위임 chain 단독), parse 측은 `realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts`(T-0701/T-0702/T-0725, parse 산출 outcome ↔ outcome-report 5필드 재유도 — **post-execution leg 단독, run+outcome 축, pre-execution resolve 미참조**). 그러나 **resolver update 분기의 `action.issueNumber` 와 parse 의 `output.issueNumber` 를 동일 search stdout source 로 묶어 cross-stage roundtrip 수렴**(post-execution complement of T-0758 marker 축)을 박제한 smoke 는 NONE 이다(git grep `resolveRealDataResultIssueGhCommandPlan` AND `parseRealDataResultIssueCreateEditOutput` 둘 다 실호출 + `action.issueNumber === outcome.issueNumber` 단언 smoke 0 확인 — origin/main). 직전 머지된 T-0763 이 run 축 cross-stage(runPlan.run ↔ publishPlan.report.descriptor ↔ standalone descriptor 3자 수렴)을 닫았다면, 본 task 는 그 marker/run 축의 보완 — **issueNumber 축 post-execution roundtrip** 수렴을 닫는 sweep 의 다음 자연 대칭이다(T-0758 marker 축의 post-execution mirror). live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (resolveRealDataResultIssueGhCommandPlan AND parseRealDataResultIssueCreateEditOutput 둘 다 실 호출 + resolve.action.update.issueNumber === parse.output.issueNumber 수렴 단언) 여부; done` — **두 composer 를 동일 searchStdout single-source 로 동시 호출해 resolve→edit→parse roundtrip 의 issueNumber 수렴을 단언한 smoke 파일 0** 확인. resolve↔parse cross-stage issueNumber-convergence 전용 smoke 부재.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — gh-command-plan 종단 컴포저. L38-41 `interface RealDataResultIssueGhCommandPlan {action, argv}`. L61-79 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` 3 단계 위임(parse search → resolve action → buildGhArgv). update 분기에서 `action: {action:'update', issueNumber: N}` 박제, argv 는 `['issue','edit', String(N), ...]` (action.issueNumber 가 argv 안 number 와 동일).
- `test/helpers/realdata-e2e-result-issue-action.ts` — resolver. L77-78 `type RealDataResultIssueAction = {action:'create'} | {action:'update', issueNumber: number}`. L106-107 `resolveRealDataResultIssueAction(hits, marker)` — 후보 0건→create, 1+건→update + `Math.min(...hits.map(h => h.number))` 최소 번호(L150). 멱등 source.
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post-execution 파서. L74-81 `interface RealDataResultIssueOutcome {issueNumber, url}`. L88-89 `ISSUE_URL_PATTERN`(`https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭, 결정론). L120-158 `parseRealDataResultIssueCreateEditOutput(stdout)` — issueNumber 양의 정수 guard(0/선행 0/비정수 throw)·URL trim·매칭 0건 throw(빈/공백/무관/비-github/`/pull/`).
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — `RealDataResultIssueCommandArgs {searchQuery, createArgs, updateArgs}` shape 참조(resolver 입력의 commandArgs 합성용). title/body·labels·marker source.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — L73 `interface RealDataResultIssueRunRef {gitSha, dateToken}`, L85 `interface RealDataResultIssueDescriptor {title, marker, body}`. resolve 의 commandArgs.searchQuery = descriptor.marker source(synthetic descriptor literal 합성용).
- `test/smoke/realdata-e2e-search-resolve-roundtrip-convergence-assembly.smoke-spec.ts` (T-0758) — 직전 머지된 sibling pre-execution roundtrip smoke(marker 축 — search.marker ↔ resolve.searchQuery ↔ descriptor.marker 3자 수렴). 중복 회피 — 본 task 는 marker 축이 아니라 **issueNumber 축 post-execution roundtrip**(resolve.action.update.issueNumber ↔ parse.output.issueNumber ↔ search-hit.minNumber 3자 수렴)만, marker leg 재단언 금지(T-0758 cover).
- `test/smoke/realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts` (T-0701/T-0702/T-0725) — parse → outcome-report 5필드 재유도 sibling. 중복 회피 — 본 task 는 parse 의 issueNumber 가 resolve.action.update.issueNumber 와 수렴함만, parse → outcome-report 5필드 재유도(gitSha/dateToken/summaryLine) 재단언 금지(T-0701/T-0702/T-0725 cover).
- `test/smoke/realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` (T-0698) — gh-command-plan 내부 위임 chain(parse → resolve → buildGhArgv) 단독 smoke. 중복 회피 — 본 task 는 resolve 의 update.issueNumber 가 **post-execution parse(create/edit stdout)** 의 issueNumber 와 수렴함만(post-execution 측 leg 가 본 task 의 새 축), gh-command-plan 내부 위임 chain 재단언 금지(T-0698 cover).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-resolve-parse-issuenumber-roundtrip-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: 단일 search source(`searchStdout`: marker 포함 `RealDataResultIssueSearchHit[]` 의 JSON 직렬화, 후보 1+건) + 유효 `commandArgs: RealDataResultIssueCommandArgs`(synthetic descriptor literal → descriptor.marker == searchQuery)를 확보한 뒤 — `resolvePlan = resolveRealDataResultIssueGhCommandPlan(searchStdout, commandArgs)`, synthetic `createEditStdout`(resolver 가 picked 한 update.issueNumber N 으로 `https://github.com/owner/repo/issues/N` URL 한 줄 포함 stdout 합성) 으로 `parseOutcome = parseRealDataResultIssueCreateEditOutput(createEditStdout)` — 두 산출물 정상(resolvePlan: `{action:{action:'update', issueNumber:N}, argv}`, parseOutcome: `{issueNumber:N, url}`) happy test 1+.
- [ ] **cross-stage issueNumber single-source 3자 수렴(branch — 핵심 불변식)**: 단일 search source(searchStdout 안 hits)로부터 도출된 resolve.action.update.issueNumber 가 post-execution parse.output.issueNumber 로 손실 없이 수렴함을 묶어 단언 1+ test — `expect(parseOutcome.issueNumber).toBe(resolvePlan.action.issueNumber)`(byte-identical, both === N) AND `expect(resolvePlan.action.issueNumber).toBe(Math.min(...hitsNumbers))`(resolver 의 멱등 source 박제 — 최소 hit number) AND `resolvePlan.argv.includes(String(N))`(edit argv 안 number 박제). 즉 search-hit.minNumber → resolve.action.update.issueNumber → parse.output.issueNumber 가 **동일 N 식별 token single-source 3자 수렴**(어느 경로도 stale/swap drift 0).
- [ ] **resolve→edit argv→parse roundtrip 의 argv N 일치(branch — argv-mediated 수렴)**: `resolvePlan.argv` 안의 issueNumber 위치(L74-79 argv 합성 — `['issue','edit', String(N), ...]`)가 `String(parseOutcome.issueNumber)` 와 byte-identical(`expect(resolvePlan.argv).toContain(String(parseOutcome.issueNumber))`) 1+ test. caller 가 argv 를 `execFile('gh', argv)` 로 보낸 뒤 stdout 을 parse 하면 issueNumber 가 동일 — argv 중간 단계가 swap 변형되지 않음을 박제.
- [ ] **search-hit 분포 변별성(branch — 멱등 source 박제)**: 서로 다른 search source 두 개(예: hits 분포 A: `[{number:7},{number:13}]`, hits 분포 B: `[{number:21},{number:42}]`) → 각각 resolve + 대응하는 createEditStdout(각각 N=7, N=21) parse 호출 → 두 chain 의 `resolvePlan.action.issueNumber` / `parseOutcome.issueNumber` 가 **각각 7/7, 21/21 으로 분리 수렴**(서로 다른 N, 단 각 chain 안에서는 cross-stage 일치) 1+ test — "다른 search source→다른 N, 같은 N→3자 수렴" 의 결정론적 변별 박제(N drift 시 detection).
- [ ] **stdout 무관·resolve 독립(branch — partial-thread 격리)**: 동일 `resolvePlan` (= 동일 N) 을 고정하고 `createEditStdout` 의 URL **외 텍스트**만 다르게(예: 다중 줄 gh 부가 메시지·trailing 개행/공백·앞뒤 noise) 두 parse 호출 → `parseOutcome.issueNumber` / `url` 는 **두 경우 byte-identical**(첫 매칭 URL 결정론 박제, R-59 정합 — 부가 본문 누설 0) AND 그 N 이 `resolvePlan.action.issueNumber` 와 수렴 유지 1+ test. 또한 동일 createEditStdout + 동일 hits 분포로 resolve 두 번 호출 → resolve.action.issueNumber 가 두 번 동일 1+(결정론).
- [ ] **multi-hit minNumber 정합 분기에서도 N 수렴 보존(branch)**: hits 가 3+ 원소(예: `[{number:99},{number:7},{number:55}]` — 순서 unsorted 의도)인 입력으로 chain 호출 → `resolvePlan.action.issueNumber === 7`(최소값, 순서 무관 결정론 박제) AND 해당 N=7 의 createEditStdout parse 가 `parseOutcome.issueNumber === 7` 1+ test. 멱등 source(가장 오래된 이슈 = 최소 number) 가 multi-hit 분포에서도 보존됨을 cross-stage 박제.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(resolve-side guard·parse-side guard 양 leg N 식별자 거부 대칭 박제):
  - 빈 `searchStdout = ""`(또는 비JSON `"not-json"`) → resolve leg `parseRealDataResultIssueSearchOutput` 위임 단계 throw 전파(N 미결정 — argv 미산출).
  - 후보 hit number 비양수(`[{number:0,...}]` 또는 `[{number:-1,...}]`) → resolve leg `assertPositiveNumber` 위임 단계 throw 전파(N 비식별).
  - `createEditStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → parse leg throw(URL 미발견 — issueNumber 미결정).
  - `createEditStdout` 의 URL 안 issueNumber 가 비양수(`/issues/0` 또는 `/issues/007` 또는 `/issues/abc`) → parse leg `assertPositiveIssueNumber` throw(post-execution issueNumber 비식별).
  - `createEditStdout` 가 `/pull/N` URL(비-issue 경로) → parse leg throw(issue URL 패턴 미매칭, 잘못된 경로 차단).
  - 비-github 호스트 URL(`https://gitlab.com/o/r/issues/7`) → parse leg throw(호스트 mismatch 차단).
- [ ] **flow / branch — create 분기 분리(branch — update path 만 N 수렴 의미)**: 빈 search stdout(`"[]"`) → `resolvePlan.action.action === 'create'`(N 부재 — `action` 에 issueNumber 필드 미존재) 1+ test. 이 경우 본 task 의 cross-stage N 수렴 단언은 **적용 대상 아님**(create 분기는 N source 자체가 없어 수렴 단언 무의미)임을 명시 분기 박제 — 본 task 의 수렴 불변식은 update 분기에서만 의미. create 분기는 별도 sibling(T-0758 search→create) 이 cover.
- [ ] **credential 누출 0(branch)**: 산출물(`resolvePlan.argv`·`parseOutcome.url`·`createEditStdout` 합성 fixture) 어느 출력에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth`) 미포함 단언(§9 정합) + raw 외부 활동 데이터(commit/PR/issue 본문 narrative) 미포함(R-59/REQ-059 정합 — outcome 은 issueNumber/url 만, argv 는 식별자/제목/본문/labels 만) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (`searchStdout`/`commandArgs`/`createEditStdout`)로 chain 을 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(resolvePlan·parseOutcome 참조 각각 `not.toBe`) + 입력 `searchStdout`(string 원시·불변)·`commandArgs`(중첩 createArgs.labels·updateArgs 포함)·`createEditStdout`(string 원시) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 composer/가드도 수정하지 않고 두 기존 composer(resolve gh-command-plan·post-execution parse)를 동일 단일 search source 로 묶은 cross-stage issueNumber-roundtrip 수렴 불변식(N byte-identical 3자 일치·argv-mediated 수렴·search-hit 분포 변별성·partial-thread 격리·multi-hit minNumber 보존·create/update 분기 분리·resolve/parse 양 leg negative throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 N-convergence/argv-mediated/변별성/partial-thread/multi-hit/create-분리/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts`·`...-result-issue-action.ts`·`...-result-issue-output-parse.ts`·`...-result-issue-command-args.ts`·`...-result-issue-descriptor.ts` 또는 어떤 composer/가드 helper 의 로직 변경(composer 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- resolve 의 search-marker↔searchQuery↔descriptor.marker 3자 수렴(marker 축, pre-execution leg) 재단언(T-0758 이미 cover — 본 task 는 issueNumber 축 post-execution 만).
- parse → outcome-report 5필드(`{issueNumber,url,gitSha,dateToken,summaryLine}`) 재유도 수렴 재단언(T-0701/T-0702/T-0725 이미 cover — 본 task 는 parse.issueNumber ↔ resolve.action.update.issueNumber 만, outcome-report 합성 미관여).
- gh-command-plan 내부 위임 chain(parse → resolve → buildGhArgv) 단독 수렴 재단언(T-0698 이미 cover — 본 task 는 resolve↔post-execution parse cross-stage 만).
- search hit shape(number/title/labels 슬롯 전수)·outcome shape 키 집합 set-equality 가드 재단언(T-0661/T-0662 이미 cover).
- 결과 이슈 publish chain(buildRealDataResultIssuePublishPlan 진입 — report/commandArgs/searchArgv 합성) 재단언(T-0729/T-0755 이미 cover — 본 task 는 publish chain 미관여, post-execution roundtrip 만).
- 실 github.com 네트워크 fetch / 실 활동 수집(`collectForPerson`) / 실 `prisma.upsert` / 실 LLM scoring round-trip / 실 gh CLI 실행(`gh issue edit`/`gh issue create`) / placeholder 치환 runner(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa/prisma client 등 0).
- 기존 resolve/parse/gh-command-plan/outcome-report unit·consistency·convergence spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
