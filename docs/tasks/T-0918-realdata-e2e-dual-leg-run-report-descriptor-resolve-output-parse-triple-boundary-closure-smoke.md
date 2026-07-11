---
id: T-0918
title: realdata-e2e dual-leg run report descriptor(pre, marker run-token) → command-plan resolve(marker-as-search-medium → action.update.issueNumber) → output-parse(post, issueNumber) triple-boundary single-source closure non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-resolve-output-parse-triple-boundary-single-source-closure-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-triple-boundary-closure-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — triple-boundary single-source closure sweep(happy·marker-as-search-medium 매개 무결성·issueNumber 3-boundary 수렴·create 분기 격리·run 분포 변별성·leg/summary 무관 격리·negative/결정론/no-mutation) test-dominated ~290 LOC. 요약 축 mirror 선례 T-0769(544 실측)·형제 dual-leg smoke T-0913(478)/T-0917(~270) 정당화. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 PLAN §109 실 평가 e2e step④ — run-token cross-surface(T-0917) 종결 후 요약 축 T-0769(descriptor→resolve→from-output triple-boundary) mirror. T-0913 round-trip 은 searchQuery 를 opaque 로 다뤄 marker-as-search-medium 단일-source 미단언. dep [] file-disjoint stage5b 병렬.
---

# T-0918 — realdata-e2e dual-leg run report descriptor→resolve→output-parse triple-boundary single-source closure non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)** 의 live wiring 은 한 실행 사이클 안에서 **세 개의 boundary 컴포저**를 순서대로 엮는다:

1. **pre-execution descriptor** — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` (T-0896) → `{title, marker, body}`. `marker` 안에 run 식별 token `${report.dateToken}@${report.gitSha}` 박제(descriptor helper `runToken`). 동일 run → 동일 marker(멱등 검색 기반), 서로 다른 run → 서로 다른 marker.
2. **command-args (marker → searchQuery 운반)** — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` (T-0897) → `{searchQuery, createArgs, updateArgs}`. command-args helper 주석 확정: **`searchQuery` 는 descriptor.marker 를 그대로 담는다** — later live wiring 이 이 marker 로 동일 run 의 기존 이슈를 검색한다.
3. **resolve (검색 stdout + marker → 이슈 N 해소)** — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` (T-0902) → `{action, argv}`. marker(=searchQuery)로 기존 이슈를 검색해 hit 1+ → `action.update(최소 number N)`, hit 0 → `action.create`.
4. **post-execution output-parse (실행 stdout → 이슈 N)** — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout)` (T-0903) → `{issueNumber, url}`. `gh issue create`/`gh issue edit <n>` stdout URL(`/issues/N`)의 issueNumber 추출.

이 네 단(특히 1·3·4 = descriptor·resolve·output-parse 세 boundary)이 **동일 단일 source `(report/run, search-stdout, exec-stdout)`** 로부터 도출한 marker run-token / issueNumber 가 **세 boundary 를 한 chain 으로 묶어** 수렴함이 **search-or-update 멱등성**(REQ-009 — "동일 run → 동일 marker 로 동일 이슈를 찾아 갱신")의 사람-친화 닫음이다: "descriptor 가 만든 marker(run-token 보유)로 검색해 찾은 이슈 N" 과 "실행 stdout 해석 이슈 N" 이 같은 single-source 에서 drift 0 으로 수렴한다.

그러나 이 **triple-boundary single-source closure** 를 marker-as-search-medium 축으로 묶은 non-gated smoke 는 **부재**다. 형제 round-trip smoke T-0913 은 descriptor·command-plan·output-parse 세 helper 를 같은 chain 에서 호출은 하지만 — **`searchQuery` 를 opaque 로 다뤄** `searchHitStdout(commandArgs.searchQuery, ...)` 로 넘길 뿐, (a) `commandArgs.searchQuery === descriptor.marker`(marker 가 곧 검색 매체)임을 단언하지 않고, (b) 그 marker 가 run-token `${dateToken}@${gitSha}` 를 담아 pre-boundary run 식별을 post-boundary issueNumber 로 잇는 single-source 임을 단언하지 않는다. T-0913 의 초점은 create/update 분기 round-trip parse 검증(action.update.issueNumber == output-parse.issueNumber)이었고, **marker-as-search-medium 단일-source 관통 + run 분포 변별성**은 미단언 gap 으로 남았다.

즉 marker-drift(descriptor 는 run-token 을 담는데 searchQuery 가 다른 문자열을 운반해 검색이 다른 이슈를 찾음)·표면-분열(pre-boundary marker 의 run-token 과 post-boundary issueNumber 가 같은 run source 를 관통하지 않음)·부분-thread(다른 run 인데 같은 marker→같은 이슈로 오갱신, 또는 같은 run 인데 issueNumber 가 run 에 종속되어 흔들림) 회귀는 public CI 에서 직접 발화되지 않고, 컴포저 unit 또는 step④ live gh-gated runner set-up 시에만 잡힌다. 본 task 는 요약 축 T-0769(descriptor→resolve→from-output triple-boundary single-source closure)의 dual-leg 축 mirror 로, `report → descriptor → commandArgs(searchQuery=marker) → resolve → output-parse` 종단 조립에서 **marker(run-token 보유)가 검색 매체로 chain 의 resolve stage 를 관통**하고 **issueNumber 가 세 boundary 를 한 chain 안에서 수렴**함을 public CI 그물로 박제한다.

issue-still-relevant 확인(2026-07-11): `for f in test/smoke/*dual-leg-run-report*.smoke-spec.ts; do (descriptor AND gh-command-plan resolve AND output-parse 세 helper 동시 호출); done` = round-trip(T-0913) 1파일뿐. 그 파일 안 `grep "descriptor.marker" | grep searchQuery` 로 marker↔searchQuery byte-identical 단언 0 확인 — searchQuery 는 `commandArgs.searchQuery` 로만 참조되고 descriptor.marker 와 대조되지 않음. → marker-as-search-medium single-source 관통 단언 부재 확인.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0769-realdata-e2e-descriptor-resolve-from-output-triple-boundary-single-source-closure-smoke.md` — 요약 축 triple-boundary single-source closure mirror 선례. 특히 Acceptance Criteria 의 "marker → searchQuery → resolve 매개 무결성(marker-as-search-medium)"·"create 분기 격리"·"run 분포 변별성"·"summary 무관 triple 수렴 격리" 4 단언이 본 task 의 dual-leg 축 mirror 대상. (단 dual-leg 축엔 from-output run-identity 컴포저가 없어 post 축은 issueNumber 만 — run-identity post 수렴은 T-0917 이 pre-surface 로 이미 cover, 본 task 는 issueNumber triple-boundary + marker-as-search-medium 관통만.)
- `docs/tasks/T-0913-realdata-e2e-dual-leg-run-report-publish-roundtrip-smoke.md` — 형제 round-trip smoke. 본 task 는 그 위에 **marker↔searchQuery byte-identical + run-token 관통 + run 분포 변별성**을 추가하는 별개 절단면(중복 재검증 아님). create/update 분기 round-trip parse 정합 자체는 T-0913 cover — 재단언 금지.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary. `RealDataDailyStepDualLegRunReportIssueDescriptor {title, marker, body}`, `runToken(report) = ${report.dateToken}@${report.gitSha}`(private), marker/title = prefix + runToken. **ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 는 private const(export 0)** — smoke 는 literal prefix 하드코딩이 아니라 **구조적 단언**(marker 가 `${run.dateToken}@${run.gitSha}` substring 포함)으로 박제할 것. gitSha/dateToken 빈/공백 → report 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → searchQuery 운반 layer. **`searchQuery` = descriptor.marker 그대로**(helper 주석 확정). 본 task 는 commandArgs 의 createArgs/updateArgs/labels 정합 재단언 0 — `searchQuery === descriptor.marker` 운반만 stage 2 로 사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — resolve 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`. 후보 0(stdout "[]"/marker 미포함) → `action.create`, 1+(marker 포함) → `action.update(최소 number)`. searchStdout 은 hit 가 있는 JSON 배열 한 줄(search-parse helper 형식).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` = `{action:'create'} | {action:'update', issueNumber}`. update 분기 issueNumber 접근 경로(discriminated union narrowing).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — post-boundary 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `{issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`, 0/선행0/비정수 throw)·url trim·raw 미저장(R-59). execStdout URL 안 N 은 search hit 의 최소 number 와 동일하게 합성(cross-boundary 수렴 입력 조건).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — search stdout 파서. `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 가 받는 JSON 배열 stdout 형식(`[{"number": N, "title": ..., "body": ...}]`) — searchStdout synthetic literal 합성용. body 에 marker 포함 여부가 hit 판정 매체.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}(descriptor 축 재사용). 동일 run + 서로 다른 leg outcome literal 구성용.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-roundtrip.smoke-spec.ts` (T-0913) — 헤더 주석·describe 구조·synthetic 입력 빌더(`commandArgsOf`·`searchHitStdout`·`issueUrlStdout`)·import 경로 규약 mirror 템플릿. 본 task 는 여기에 marker↔searchQuery byte-identical + run-token 관통 + run 분포 변별성 단언을 추가한 별개 파일.
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-resolve-output-parse-triple-boundary-single-source-closure-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). run-token 은 literal prefix 하드코딩이 아니라 `${run.dateToken}@${run.gitSha}` 를 계산해 `toContain`/`split` 으로 구조적으로 검증. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·triple-boundary marker-as-search-medium single-source 절단면·round-trip T-0913 와 직교) 작성.

- [ ] **Happy-path triple-boundary chain 합성 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}` + 임의 양수 `N`. 한 chain 으로 호출: `report = buildRealDataDailyStepDualLegRunReport(evalLeg, collectLeg, run)` → `descriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `commandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `searchStdout` = N 을 담은 search hit JSON 배열 한 줄(body 에 `commandArgs.searchQuery` 포함) → `plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)`(hit 1+ → update 분기) → `execStdout` = `https://github.com/owner/repo/issues/N` URL 한 줄 → `outcome = parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout)`. 세 boundary 산출물이 모두 정상(descriptor `{title,marker,body}` 비어있지 않음, plan.action 이 update 분기로 issueNumber 보유, outcome `{issueNumber,url}` 2필드 정확히 보유) happy test 1+.
- [ ] **marker → searchQuery → resolve 매개 무결성 단언 (핵심 1 — marker-as-search-medium)** — (a) `commandArgs.searchQuery` 가 `descriptor.marker` 와 **byte-identical**(`expect(commandArgs.searchQuery).toBe(descriptor.marker)`) 1+ test. (b) `descriptor.marker` 가 run-token `${run.dateToken}@${run.gitSha}` 를 `toContain`(marker 가 run 식별 매체) 1+ test. (c) 그 marker(=searchQuery)를 body 에 담은 searchStdout 이 resolve 를 **update 분기**로 이끎(`plan.action.action === "update"`) 1+ test. 즉 descriptor marker(run-token 보유)가 검색 token 으로 chain 의 resolve stage 를 관통함. (commandArgs 의 createArgs/updateArgs/labels 정합 재단언 금지 — searchQuery=marker 운반만.)
- [ ] **triple-boundary issueNumber single-source 수렴 단언 (핵심 2)** — search hit 에 넣은 N → resolve(marker 로 검색)가 해소한 `plan.action.update.issueNumber` → output-parse(실행 stdout 해석)의 `outcome.issueNumber` 가 **세 지점 모두 동일 N** 임을 한 test 로 묶어 단언: `plan.action.action === "update"` 로 narrowing 후 `expect(plan.action.issueNumber).toBe(N)` AND `expect(outcome.issueNumber).toBe(N)` AND `expect(outcome.url).toContain(`/issues/${N}`)` 1+ test. 즉 "marker 로 검색해 찾은 이슈 N" 과 "실행 stdout 해석 이슈 N" 이 한 chain 안에서 byte-identical 수렴(resolve↔output-parse 경계 drift 0). (round-trip parse 정합 자체 재단언 아닌 — marker→검색→N→post N 의 single-source 관통 각도.)
- [ ] **create 분기 격리 단언 (branch — 검색 미스 → create, output-parse 무관)** — 동일 run·leg outcome 으로 chain 호출하되 `searchStdout` 을 빈 hit(`"[]"` 또는 marker 미포함 hit)로 합성 → `plan.action` 이 **update 가 아니라 create 분기**(`plan.action.action === "create"`, argv 선두 `issue create`) 1+ test. 이때 output-parse 는 여전히 execStdout 의 N 으로 issueNumber 산출 — resolve 의 create 분기 진입이 output-parse 의 issueNumber 산출 경로와 독립(검색 결과 변경이 실행-stdout 해석에 누설 0). descriptor.marker run-token 은 create/update 두 분기 모두 동일(marker 는 run 만의 함수).
- [ ] **run 분포 변별성 단언 (branch — 다른 run→다른 marker, 같은 run→수렴, issueNumber 는 run-독립)** — 서로 다른 run 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-07-11"}`, run_B `{gitSha:"def5678", dateToken:"2026-07-12"}`, gitSha·dateToken 이 서로 substring 아닌 구별 가능 값) → 각각 동일 N 으로 chain 호출 → (a) 두 chain 의 `descriptor.marker`(=searchQuery) 가 서로 **다름**(각 run-token 으로 분리) 1+ test. (b) 그러나 두 chain 의 `outcome.issueNumber` 는 **동일 N**(issueNumber 는 search/exec-stdout 종속, run 무관) 1+ test. "run 은 marker 로 변별, issueNumber 는 stdout 종속" 축 분리 박제.
- [ ] **leg outcome / summary 무관 — marker 격리 단언 (branch — partial-thread 격리)** — 동일 `run` 을 고정하고 leg outcome 조합(예: eval pass/collect pass vs eval fail/collect skip)만 다르게 두 chain 호출 → (a) 두 chain 의 `descriptor.marker`(=searchQuery) 가 **동일**(marker 는 run 만의 함수, leg status/overallStatus 무관 — REQ-009 "동일 run → 동일 marker") 1+ test. (b) 따라서 동일 marker → 동일 searchStdout hit → resolve 가 두 조합 모두 같은 issueNumber N 으로 수렴 1+ test. (marker/issueNumber 축은 불변, descriptor.body/summaryLine 은 leg outcome 반영해 달라질 수 있음 — 다른 축 불변만 단언, body 변별은 out-of-scope.)
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(세 boundary 의 거부 대칭 박제, 단일 negative 금지):
  - (a) `run.gitSha` 빈/공백(`{gitSha:"", dateToken:...}`) → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단(`expect(() => assembleViaChain(...)).toThrow`) 1+ test.
  - (b) `run.dateToken` 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 — 필드별 독립 분기) 1+ test.
  - (c) `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve(stage 3) 의 파서 위임 throw(marker 정상이어도 hits 추출 실패로 resolve 차단) 1+ test.
  - (d) `execStdout` 에 issue URL 미발견(빈/무관 텍스트/비-github/`/pull/`) → output-parse(stage 4) throw(post 미산출 — run 정상이어도 outcome 추출 실패) 1+ test.
  - (e) `execStdout` URL 안 issueNumber 비양수(`/issues/0`·선행0·비정수) → output-parse(stage 4) `assertPositiveIssueNumber` throw(post 비식별) 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, searchStdout, execStdout) 입력으로 chain 두 번 호출 → descriptor/commandArgs/plan/outcome 가 두 번 deep-equal(byte-identical) 1+ test. AND 입력 객체(run, leg outcome) 가 chain 호출 후 mutate 0(원본 deep-equal 유지, `JSON.parse(JSON.stringify(...))` snapshot 대조) 1+ test. AND 각 stage 산출물이 입력/다음 호출 결과와 referential identity 분리(`not.toBe`, argv 배열 포함) — 무공유 박제.
- [ ] **raw / credential 누출 0 test 1+** — chain 안 어디에서도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘가 descriptor.{title,marker,body} / commandArgs.searchQuery / plan.argv / outcome.{url} 어느 문자열에도 미등장(정규식/`not.toContain` 단언, R-59 / REQ-059 raw 미저장 정합). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 marker/searchQuery/issueNumber 표면에 sentinel 미누출(run-token 표면은 run 식별자 + status 파생만) 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma` 변경 0. 새 외부 dependency 0.
- 형제 round-trip smoke(T-0913, `...publish-roundtrip.smoke-spec.ts`)의 create/update 분기 round-trip parse 정합(action.update.issueNumber == output-parse.issueNumber) 자체 단독 재단언 금지 — 본 task 는 그 위에 marker↔searchQuery byte-identical + run-token 관통 + run 분포 변별성 single-source 각도만 추가.
- forward publish assembly(T-0912)·markdown assembly(T-0914)·descriptor body/identity confluence(T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면은 이미 닫힘(중복 단언 0). 특히 run-identity(gitSha·dateToken) pre-surface 수렴은 T-0917 cover — 본 task 는 issueNumber triple-boundary + marker-as-search-medium 관통만.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 `buildRealDataDailyStepDualLegRunReport` / `...IssueDescriptor` / `...IssueCommandArgs` / `resolve...IssueGhCommandPlan` / `parse...IssueCreateEditOutput` import 만. value-consistency 가드 sweep 은 T-0911 에서 종결.
- commandArgs 의 createArgs/updateArgs/labels 정합(title/body=descriptor 보존)·argv 합성(gh issue create/edit argv 형식·플래그 순서) 재단언 금지(command-args·gh-argv 가드 cover). 본 task 는 `searchQuery=descriptor.marker` 운반 + `action.update.issueNumber` 해소 결과만.
- descriptor.body 의 marker→markdown 2블록 구조·body 변별성 무결성 재단언 금지(body confluence 가드 cover). 본 task 는 title/marker(=searchQuery) 축 + issueNumber 만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / `execFile('gh', argv)` / 실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred).
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs(searchQuery=marker) → resolve(search-stdout + commandArgs → action.update.issueNumber) → output-parse(exec-stdout → issueNumber) 를 같은 smoke 안에서 single-source(run + leg outcomes + search-stdout + exec-stdout) 로 한 chain 으로 호출하는 합성 smoke 작성. marker↔searchQuery byte-identical·run-token substring·issueNumber 3-boundary 수렴·run 분포 변별성·create 분기 격리·negative/결정론/no-mutation 을 실제 helper export 시그니처로 확인해 단언 문자열 결정.)

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
