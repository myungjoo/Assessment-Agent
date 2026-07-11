---
id: T-0919
title: realdata-e2e dual-leg run report descriptor(marker) → command-args(searchQuery) → search-gh-argv(marker-as-argv-element) → resolve(action.update.issueNumber) → output-parse(issueNumber) 4-boundary marker-as-search-medium single-source closure non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-search-argv-resolve-output-parse-marker-medium-4-boundary-single-source-closure-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-searchargv-marker-medium-closure-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — 4-boundary marker-as-search-medium single-source closure sweep(happy·searchArgv marker-element byte-identical·marker 4지점 수렴·issueNumber 3지점 수렴·create 분기 격리·run 분포 변별성·leg outcome 무관 marker 격리·negative 분기 다수·결정론/no-mutation/credential) test-dominated ~290 LOC. 요약 축 T-0766(publish-plan↔search-argv↔resolve↔descriptor marker 4-way) mirror + 형제 T-0918(triple-boundary, searchArgv 미포함)/T-0912(forward, output-parse 미포함) 정당화. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0918(descriptor→resolve→output-parse triple-boundary, searchArgv 미포함) 다음. searchGhArgv(실 gh search argv, marker 운반)가 resolve+output-parse 와 한 chain 미결합 gap. 요약 축 T-0766 mirror. dep [] file-disjoint stage5b 병렬.
---

# T-0919 — realdata-e2e dual-leg run report search-argv→resolve→output-parse 4-boundary marker-as-search-medium single-source closure non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)** 의 live wiring 은 한 실행 사이클 안에서 marker(run 식별 token 보유)를 **실제로 `gh search issues` 명령에 넘기는 argv** 를 산출하고, 그 검색 결과로 기존 이슈를 해소한 뒤, 실행 stdout 을 파싱해 issueNumber 를 확인한다. 이 marker 의 흐름은 **네 개의 boundary** 를 통과한다:

1. **descriptor** — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` (T-0896) → `{title, marker, body}`. `marker` 안에 run token `${report.dateToken}@${report.gitSha}` 박제.
2. **command-args** — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` (T-0897) → `{searchQuery, createArgs, updateArgs}`. `searchQuery === descriptor.marker`(helper 확정 주석).
3. **search-gh-argv (marker-as-argv-element)** — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` (T-0900) → `["search", "issues", "--match", "body", searchQuery, "--json", "number,title,body", "--limit", "30"]`. **`searchQuery`(=marker)가 argv 의 단일 원소로 운반** — 실 live runner 가 `gh search issues --match body <marker> ...` 를 실행할 때 marker 가 곧 검색 매체다.
4. **resolve → output-parse** — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` (T-0902) 가 marker(=searchQuery)로 검색해 hit 1+ → `action.update.issueNumber = N`, 그리고 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout)` (T-0903) 가 실행 stdout URL 에서 `issueNumber = N` 추출.

이 네 boundary 가 **동일 단일 source `(report/run, search-stdout, exec-stdout)`** 로부터 도출한 marker run-token / issueNumber 를 **한 chain 으로 묶어** 수렴함이 **search-or-update 멱등성**(REQ-009 — "동일 run → 동일 marker 로 동일 이슈를 찾아 갱신")의 사람-친화 닫음이다. 특히 **searchArgv 안 marker 원소** 가 곧 실 live 검색 매체이므로, "실 runner 가 `gh search` 에 넘기는 argv 원소" 와 "descriptor 가 만든 marker" 와 "resolve 가 searchStdout 에서 매칭하는 marker" 가 byte-identical 로 수렴함이 marker-as-search-medium 무결성의 핵심이다.

그러나 이 **4-boundary marker-as-search-medium single-source closure** 를 묶은 non-gated smoke 는 **부재**다. 형제 smoke 두 개가 각각 절반만 닫았다:

- **T-0918** (descriptor→command-args→resolve→output-parse **triple-boundary** closure) — resolve 와 output-parse 를 한 chain 으로 닫았으나 **`searchGhArgv` boundary 를 건너뛴다**: `commandArgs.searchQuery` 에서 곧바로 synthetic searchStdout 으로 점프하며, 실 runner 가 실제로 `gh search` 에 넘길 **argv 원소가 marker 를 byte-identical 로 운반**하는지는 미단언. 즉 "검색 매체가 실제 argv 로는 무엇인가" 는 gap.
- **T-0912** (report→descriptor→commandArgs→searchArgv→resolve forward assembly) — `searchGhArgv` 를 포함하나 **output-parse(post) boundary 를 건너뛴다**(forward-only, 박제-전 조립만): searchArgv 의 marker 원소가 최종 실행 stdout 의 issueNumber 로 이어지는 post-through-line 미단언.

즉 marker-drift(searchArgv 가 descriptor.marker 와 다른 문자열을 argv 원소로 운반해 실 검색이 다른 이슈를 찾음)·매체-분열(pre-boundary marker 의 run-token 과 실제 `gh search` argv 원소가 같은 single-source 를 관통하지 않음)·post-단절(searchArgv 로 검색한 이슈 N 과 실행 stdout 해석 이슈 N 이 다름) 회귀는 public CI 에서 직접 발화되지 않고, 컴포저 unit 또는 step④ live gh-gated runner set-up 시에만 잡힌다. 본 task 는 요약 축 T-0766(publish-plan↔search-argv↔resolve↔descriptor marker 4-way convergence)의 dual-leg 축 mirror 로, `report → descriptor → commandArgs → searchArgv(marker 원소) → resolve → output-parse` 종단 조립에서 **marker(run-token 보유)가 실 `gh search` argv 원소로서 검색 매체로 chain 을 관통**하고 **issueNumber 가 resolve↔output-parse 를 한 chain 안에서 수렴**함을 public CI 그물로 박제한다.

issue-still-relevant 확인(2026-07-11): `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 를 참조하는 smoke 는 T-0912(publish-assembly)뿐이며 그 파일은 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`(output-parse) 미참조(forward-only). T-0918 triple-boundary smoke 는 `SearchGhArgv` 미참조. → searchArgv boundary + output-parse boundary 를 한 chain 에서 묶은 marker-medium 4-boundary closure 부재 확인. `git log origin/main` 동일 영역 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0766-realdata-e2e-publish-plan-search-argv-resolve-marker-4way-convergence-smoke.md` — 요약 축 search-argv↔resolve↔marker 4-way convergence mirror 선례. 특히 "searchArgv 의 marker 원소가 descriptor.marker 와 byte-identical"·"marker 가 resolve 의 검색 매체로 관통"·"run 분포 변별성" 단언이 본 task 의 dual-leg 축 mirror 대상. (단 dual-leg 축엔 top publishPlan orchestrator 가 없어 chain 시작을 최상위 report 컴포저 `buildRealDataDailyStepDualLegRunReport` 로 잡고, 요약 축과 달리 post output-parse boundary 를 추가로 닫는다.)
- `docs/tasks/T-0918-realdata-e2e-dual-leg-run-report-descriptor-resolve-output-parse-triple-boundary-closure-smoke.md` — 형제 triple-boundary closure. 본 task 는 그 위에 **searchGhArgv(실 gh search argv, marker 원소) boundary** 를 추가하는 별개 절단면(중복 재검증 아님). resolve↔output-parse issueNumber 수렴 자체는 T-0918 cover — 그 부분 재단언 금지, 본 task 는 **searchArgv 원소가 marker 운반 + 그 marker 가 resolve 검색 매체로 관통 + post issueNumber 로 이어짐** 각도만 추가.
- `docs/tasks/T-0912-realdata-e2e-dual-leg-run-report-publish-assembly-smoke.md` — 형제 forward publish-assembly smoke. searchArgv 를 포함하나 output-parse 미참조(forward-only). 본 task 는 그 위에 **post output-parse boundary** 를 추가하는 별개 절단면. searchArgv 자체의 형식(argv 원소 순서·`--match body`·`--limit`) 재단언 금지 — search-argv 가드가 cover, 본 task 는 searchArgv 안 marker 원소가 검색 매체로 관통함만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary. `RealDataDailyStepDualLegRunReportIssueDescriptor {title, marker, body}`, `runToken(report) = ${report.dateToken}@${report.gitSha}`(private), marker = prefix + runToken. **ISSUE_MARKER_PREFIX 는 private const(export 0)** — smoke 는 literal prefix 하드코딩이 아니라 **구조적 단언**(marker 가 `${run.dateToken}@${run.gitSha}` substring 포함)으로 박제. gitSha/dateToken 빈/공백 → report 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → searchQuery 운반 layer. **`searchQuery` = descriptor.marker 그대로**(helper 확정). 본 task 는 commandArgs 의 createArgs/updateArgs/labels 정합 재단언 0 — `searchQuery === descriptor.marker` 운반만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — search-gh-argv layer. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `["search", "issues", "--match", "body", searchQuery, "--json", "number,title,body", "--limit", "30"]`. **searchQuery(=marker)가 argv index 4 의 단일 원소**(shell 미경유·인젝션 불가). 빈/공백 searchQuery → `assertSearchQueryNonBlank` throw. 본 task 는 argv 원소 순서·플래그 재단언 금지 — argv 안 **marker 원소가 descriptor.marker 와 byte-identical** 임만 단언(argv 원소 위치는 `--match body` 다음 원소 또는 `argv.includes(descriptor.marker)` 로 구조적 접근).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — resolve 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`. 후보 0(stdout "[]"/marker 미포함) → `action.create`, 1+(marker 포함) → `action.update(최소 number)`. searchStdout 은 hit JSON 배열 한 줄(search-parse 형식).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` = `{action:'create'} | {action:'update', issueNumber}`. update 분기 issueNumber 접근 경로(discriminated union narrowing).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — post-boundary 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `{issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`, 0/선행0/비정수 throw)·url trim·raw 미저장(R-59). execStdout URL 안 N 은 search hit 최소 number 와 동일 합성(cross-boundary 수렴 입력 조건).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — search stdout 파서 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 가 받는 JSON 배열 형식(`[{"number": N, "title": ..., "body": ...}]`) — searchStdout synthetic literal 합성용. body 에 marker 포함 여부가 hit 판정 매체.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}. 동일 run + 서로 다른 leg outcome literal 구성용.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-descriptor-resolve-output-parse-triple-boundary-single-source-closure-assembly.smoke-spec.ts` (T-0918) — 헤더 주석·describe 구조·synthetic 입력 빌더(searchHitStdout·issueUrlStdout·chain assembler)·import 경로 규약 mirror 템플릿. 본 task 는 여기에 searchGhArgv boundary 를 삽입한 별개 파일.
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-search-argv-resolve-output-parse-marker-medium-4-boundary-single-source-closure-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). run-token 은 literal prefix 하드코딩이 아니라 `${run.dateToken}@${run.gitSha}` 를 계산해 `toContain`/`split`/`includes` 로 구조적으로 검증. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·4-boundary marker-as-search-medium single-source 절단면·triple-boundary T-0918·forward T-0912 와 직교) 작성.

- [ ] **Happy-path 4-boundary chain 합성 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}` + 임의 양수 `N`. 한 chain 으로 호출: `report = buildRealDataDailyStepDualLegRunReport(evalLeg, collectLeg, run)` → `descriptor = buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `commandArgs = buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `searchArgv = buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `searchStdout`(marker 를 body 에 담고 number=N 인 hit JSON 배열 한 줄) → `plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)`(hit 1+ → update) → `execStdout = https://github.com/owner/repo/issues/N` 한 줄 → `outcome = parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout)`. 네 boundary 산출물이 모두 정상(descriptor `{title,marker,body}` 비어있지 않음, searchArgv 비어있지 않은 string[], plan.action 이 update 분기로 issueNumber 보유, outcome `{issueNumber,url}` 2필드 정확히 보유) happy test 1+.
- [ ] **searchArgv marker-element byte-identical 단언 (핵심 1 — marker-as-search-medium)** — (a) `searchArgv` 안에 `descriptor.marker` 가 **byte-identical 단일 원소로 포함**됨(`expect(searchArgv).toContain(descriptor.marker)` 또는 `expect(searchArgv.includes(descriptor.marker)).toBe(true)`) 1+ test. (b) 그 marker 원소가 곧 `commandArgs.searchQuery` 와도 byte-identical(`expect(searchArgv).toContain(commandArgs.searchQuery)` AND `expect(commandArgs.searchQuery).toBe(descriptor.marker)`) — 즉 실 `gh search` argv 원소·commandArgs.searchQuery·descriptor.marker 세 곳이 한 marker 로 수렴 1+ test. (c) `descriptor.marker` 가 run-token `${run.dateToken}@${run.gitSha}` 를 `toContain`(argv 로 운반되는 검색 매체가 run 식별 token 보유) 1+ test. (searchArgv 의 argv 원소 순서·`--match body`·`--limit` 재단언 금지 — marker 원소 운반만.)
- [ ] **marker → resolve 검색 매체 관통 단언 (핵심 1 연장)** — searchArgv 가 운반하는 그 marker(=searchQuery)를 body 에 담은 searchStdout 을 resolve 에 넘기면 **update 분기**로 이끎(`plan.action.action === "update"`) 1+ test. 즉 실 argv 로 운반될 marker 가 resolve stage 에서 실제로 hit 를 유발하는 검색 매체임을 argv boundary 를 관통해 박제.
- [ ] **4-boundary issueNumber / marker single-source 수렴 단언 (핵심 2)** — 한 test 로 묶어: marker 가 descriptor.marker → commandArgs.searchQuery → searchArgv 원소 세 지점에서 동일, AND search hit 에 넣은 `N` → resolve 가 해소한 `plan.action.update.issueNumber` → output-parse 의 `outcome.issueNumber` 가 세 지점 모두 동일 `N`(`plan.action.action === "update"` narrowing 후 `expect(plan.action.issueNumber).toBe(N)` AND `expect(outcome.issueNumber).toBe(N)` AND `expect(outcome.url).toContain(`/issues/${N}`)`) 1+ test. 즉 marker 3지점 수렴 + issueNumber 3지점 수렴이 한 chain 안에서 drift 0. (resolve↔output-parse issueNumber 정합 자체 재단언 아닌 — searchArgv 원소가 검색 매체로 관통한 marker 로 찾은 이슈 N 이 post N 과 같음의 4-boundary 각도.)
- [ ] **create 분기 격리 단언 (branch — 검색 미스 → create, searchArgv/output-parse 무관)** — 동일 run·leg outcome 으로 chain 호출하되 `searchStdout` 을 빈 hit(`"[]"` 또는 marker 미포함 hit)로 합성 → `plan.action` 이 **update 가 아니라 create 분기**(`plan.action.action === "create"`) 1+ test. 이때 searchArgv 는 여전히 동일 marker 원소를 운반(검색 결과가 argv 합성에 누설 0), output-parse 는 여전히 execStdout 의 N 으로 issueNumber 산출(검색 분기 변경이 argv/output-parse 경로와 독립) — 각 1+ 단언.
- [ ] **run 분포 변별성 단언 (branch — 다른 run→다른 searchArgv marker 원소, issueNumber 는 run-독립)** — 서로 다른 run 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-07-11"}`, run_B `{gitSha:"def5678", dateToken:"2026-07-12"}`, 서로 substring 아닌 구별 가능 값) → 각각 동일 N 으로 chain 호출 → (a) 두 chain 의 `searchArgv` 가 운반하는 marker 원소가 서로 **다름**(각 run-token 으로 분리 — 실 검색 매체가 run 별 분리) 1+ test. (b) 그러나 두 chain 의 `outcome.issueNumber` 는 **동일 N**(issueNumber 는 stdout 종속, run 무관) 1+ test.
- [ ] **leg outcome 무관 — searchArgv marker 격리 단언 (branch — partial-thread 격리)** — 동일 `run` 을 고정하고 leg outcome 조합(예: eval pass/collect pass vs eval fail/collect skip)만 다르게 두 chain 호출 → (a) 두 chain 의 `searchArgv` 가 운반하는 marker 원소가 **동일**(marker 는 run 만의 함수, leg status 무관 — REQ-009 "동일 run → 동일 marker") 1+ test. (b) 따라서 동일 marker → 동일 searchStdout hit → resolve 가 두 조합 모두 같은 issueNumber N 으로 수렴 1+ test. (marker/issueNumber 축 불변만 단언, descriptor.body 변별은 out-of-scope.)
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(네 boundary 의 거부 대칭 박제, 단일 negative 금지):
  - (a) `run.gitSha` 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단(`expect(() => assembleViaChain(...)).toThrow`) 1+ test.
  - (b) `run.dateToken` 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 — 필드별 독립 분기) 1+ test.
  - (c) searchQuery 빈/공백을 유발하는 경로에서 `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` 의 `assertSearchQueryNonBlank` throw — 정상 marker 로는 이 분기 미도달이므로, 빈 searchQuery 를 담은 `commandArgs` literal 을 직접 합성해 searchArgv(stage 3) guard throw 단언 1+ test(searchArgv boundary 자체 거부 대칭).
  - (d) `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve(stage 4) 의 파서 위임 throw(marker/argv 정상이어도 hits 추출 실패로 resolve 차단) 1+ test.
  - (e) `execStdout` 에 issue URL 미발견(빈/무관/비-github/`/pull/`) 또는 issueNumber 비양수(`/issues/0`·선행0) → output-parse(stage 5) throw(post 미산출) 각 1+ test(둘 다 — URL-미발견 분기와 비양수 분기 분리).
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, searchStdout, execStdout) 입력으로 chain 두 번 호출 → descriptor/commandArgs/searchArgv/plan/outcome 가 두 번 deep-equal(byte-identical) 1+ test. AND 입력 객체(run, leg outcome)·commandArgs 가 searchArgv 호출 후 mutate 0(원본 deep-equal 유지, `JSON.parse(JSON.stringify(...))` snapshot 대조) 1+ test. AND searchArgv 반환 배열이 입력/다음 호출 결과와 referential identity 분리(`not.toBe`) — 무공유 박제.
- [ ] **raw / credential 누출 0 test 1+** — chain 안 어디에서도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘가 descriptor.{title,marker,body} / commandArgs.searchQuery / searchArgv(배열 전체) / plan.argv / outcome.{url} 어느 문자열에도 미등장(정규식/`not.toContain` 단언, R-59 / REQ-059 raw 미저장 정합). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 marker/searchArgv/issueNumber 표면에 sentinel 미누출 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma` 변경 0. 새 외부 dependency 0.
- 형제 triple-boundary smoke(T-0918)의 descriptor→resolve→output-parse issueNumber 수렴 자체 단독 재단언 금지 — 본 task 는 그 위에 **searchGhArgv boundary(실 gh search argv, marker 원소)** single-source 관통 각도만 추가.
- 형제 forward publish-assembly smoke(T-0912)의 report→descriptor→commandArgs→searchArgv forward 조립·searchArgv argv 원소 순서/`--match body`/`--limit` 형식 재단언 금지 — 본 task 는 그 위에 **post output-parse boundary** + marker 원소가 검색 매체로 관통함만 추가.
- forward publish assembly(T-0912)·markdown assembly(T-0914)·descriptor body/identity confluence(T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면 이미 닫힘. run-identity(gitSha·dateToken) pre-surface 수렴은 T-0917 cover — 본 task 는 issueNumber 4-boundary + marker-as-search-medium(argv 포함) 관통만.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만. value-consistency 가드 sweep 은 T-0911 에서 종결.
- commandArgs 의 createArgs/updateArgs/labels 정합·gh create/edit argv 합성(gh-argv 가드 cover) 재단언 금지. 본 task 는 `searchQuery=descriptor.marker` 운반 + searchArgv marker 원소 + `action.update.issueNumber` 해소 결과만.
- descriptor.body 의 marker→markdown 2블록 구조·body 변별성 재단언 금지(body confluence 가드 cover). 본 task 는 title/marker(=searchQuery=searchArgv 원소) 축 + issueNumber 만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / `execFile('gh', argv)` / 실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred).
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs(searchQuery=marker) → searchArgv(marker 원소) → resolve(search-stdout + commandArgs → action.update.issueNumber) → output-parse(exec-stdout → issueNumber) 를 같은 smoke 안에서 single-source(run + leg outcomes + search-stdout + exec-stdout) 로 한 chain 으로 호출하는 합성 smoke 작성. searchArgv 안 marker 원소 byte-identical·marker 3지점 수렴·issueNumber 3지점 수렴·run 분포 변별성·leg 무관 marker 격리·create 분기 격리·searchArgv guard throw·negative/결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정.)

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)

---

## Completion

- **Status**: DONE (2026-07-11T11:58Z)
- **PR**: #813 (squash 8eb9d6ce) — reviewer APPROVE round 1/7, 0 BLOCKER·0 MAJOR·0 MINOR·0 NIT, 4-게이트 PASS.
- **결과**: descriptor→command-args→search-gh-argv(marker-as-argv-element)→resolve→output-parse 4-boundary marker-as-search-medium single-source closure non-gated build-time smoke 신설(+623/-0, test-only 1 file, production LOC 0). 기존 6 helper import 재사용·신규 helper/type/dep 0. 로컬 smoke 23/23 격리 green. CI green(first run reviewer-gate race 후 rerun --failed self-heal). counters 909→910.
- **fire**: cron@aa-local-0aaa (fineGrainedConcurrency stage 5b claim-pickup).
