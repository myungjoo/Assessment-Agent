---
id: T-0920
title: realdata-e2e dual-leg run report search-hit(N) → resolve(action.update.issueNumber) → edit-gh-argv(issueNumber-as-argv-element) → output-parse(issueNumber) execute-side single-source closure non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 814
completedAt: 2026-07-11T13:00:00Z
result: "DONE — PR #814 squash 34c225b3. execute-side issueNumber-as-edit-medium(plan.argv[2]===String(N)) 4지점 single-source closure non-gated smoke 신설(+596/-0 test-only 1 file, production LOC 0, 신규 helper/type/dep 0). reviewer round1 APPROVE(0 BLOCKER·0 MAJOR·0 MINOR·1 NIT sizeExempt), 4-게이트 PASS, CI green(merge run 34c225b3 success). counters 910→911."
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-edit-argv-resolve-output-parse-issuenumber-medium-execute-side-single-source-closure-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-editargv-issuenumber-medium-closure-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — execute-side issueNumber-as-edit-argv-element single-source closure sweep(happy·plan.argv[2]===String(N) byte-identical·issueNumber 4지점 수렴·create 분기 argv 형태 격리·run 무관 issueNumber·leg outcome 무관 issueNumber·negative 분기 다수·결정론/no-mutation/credential) test-dominated ~290 LOC. 형제 T-0919(search-side marker-as-argv-element, 대칭)/T-0918(triple, exec-argv 미단언)/T-0913(round-trip, searchArgv+single-source 미결합) 정당화. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0919(marker-as-search-argv-element 4-boundary) 다음 대칭면. resolve.plan.argv(=gh issue edit <N> 실 exec argv) 가 issueNumber 를 argv 원소로 운반함을 single-source 로 미결합 gap. dep [] file-disjoint stage5b 병렬.
---

# T-0920 — realdata-e2e dual-leg run report edit-argv(issueNumber-as-argv-element) resolve→output-parse execute-side single-source closure non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)** 의 live wiring 은 marker 로 검색해 기존 이슈 N 을 해소한 뒤, **실제로 `gh issue edit <N> ...` 명령에 넘길 argv** 를 산출하고, 그 명령을 실행한 stdout 을 파싱해 issueNumber 를 확인한다. 이 흐름의 **검색-매체(input) 축**은 T-0919 가 이미 닫았다: marker(run-token 보유)가 `searchArgv` 의 단일 원소로 운반되어 실 `gh search` 검색 매체로 chain 을 관통함을 4-boundary single-source 로 박제했다. 그러나 그 **대칭면인 실행-argv(execute) 축**은 아직 미결합이다:

resolve(`resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`, T-0902)는 `{action, argv}` 를 산출하며, update 분기에서 `argv = ["issue", "edit", String(issueNumber), "--title", ..., "--body", ...]` — 즉 **`plan.argv[2]` 가 해소한 issueNumber N 을 문자열화한 실 exec argv 원소**다(`buildRealDataDailyStepDualLegRunReportIssueGhArgv` T-0899). 실 live runner 는 이 `plan.argv` 를 `execFile('gh', plan.argv)` 로 그대로 실행하므로, **"resolve 가 해소한 issueNumber N"** 과 **"실제로 `gh issue edit` 에 넘길 argv 원소 N"** 과 **"실행 stdout 해석 issueNumber N"** 이 byte-identical 로 수렴함이 execute-side 무결성의 핵심이다. marker 가 검색 매체(search medium)였듯, issueNumber 는 **편집 매체(edit medium)** — 어느 이슈를 실제로 갱신할지 결정하는 실 argv 원소다.

이 흐름은 네 지점에서 issueNumber N 이 수렴한다: (1) **search hit** — searchStdout 의 최소 number N, (2) **resolve action** — `plan.action.update.issueNumber = N`, (3) **edit-gh-argv (issueNumber-as-argv-element)** — `plan.argv[2] === String(N)`(실 runner 가 `gh issue edit N` 로 실행할 argv 원소), (4) **output-parse** — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(execStdout)` 의 `outcome.issueNumber = N`. 이 네 지점이 **동일 단일 source `(report/run, search-stdout, exec-stdout)`** 로부터 drift 0 으로 수렴함이 **search-or-update 멱등성**(REQ-009 — "동일 run 의 기존 이슈를 찾아 갱신")의 execute-side 사람-친화 닫음이다.

그러나 이 **execute-side issueNumber-as-edit-argv-element single-source closure** 를 묶은 non-gated smoke 는 **부재**다. 형제 smoke 들이 각기 절반만 닫았다:

- **T-0919** (search-argv→resolve→output-parse **4-boundary** closure) — search-side marker-as-argv-element(입력 검색 매체)를 닫았으나 `plan.argv` 를 **opaque 로 다뤄** update 분기 판정에서 `plan.argv[0]="issue"`, `plan.argv[1]="edit"`(선두 토큰 branch identity) 와 no-share/credential 만 단언한다. 즉 **`plan.argv[2]` 가 해소 issueNumber N 을 실 exec argv 원소로 운반**하고 그것이 search-hit N·output-parse N 과 수렴함(execute-side medium)은 미단언 gap.
- **T-0912/T-0913** (forward publish-assembly / round-trip) — `plan.argv[2]).toBe("42")` 를 **하드코딩 literal** 로 단언하나, (a) 그 N 을 단일 source 인 search hit number 로 묶지 않고(commandArgs opaque·N 고정), (b) `searchArgv`(검색-argv boundary)와 결합하지 않으며, (c) run/leg outcome 분포에 대한 issueNumber 불변(run·leg 무관)을 execute-argv 원소 축에서 박제하지 않는다.

즉 issueNumber-drift(resolve 가 N 을 해소했는데 `plan.argv` 가 다른 번호를 edit argv 원소로 운반해 실 runner 가 엉뚱한 이슈를 갱신)·매체-분열(search hit N 과 실 `gh issue edit` argv 원소가 같은 single-source 를 관통하지 않음)·post-단절(edit argv 로 갱신한 이슈 N 과 실행 stdout 해석 이슈 N 이 다름) 회귀는 public CI 에서 직접 발화되지 않고, 컴포저 unit 또는 step④ live gh-gated runner set-up 시에만 잡힌다. 본 task 는 T-0919 의 search-side 대칭면으로, `report → descriptor → commandArgs → searchArgv → resolve(action + plan.argv edit-argv) → output-parse` 종단 조립에서 **issueNumber 가 실 `gh issue edit` argv 원소로서 편집 매체로 chain 을 관통**하고 **네 지점(search-hit / resolve.action / plan.argv[2] / output-parse)에서 한 chain 안에 수렴**함을 public CI 그물로 박제한다.

issue-still-relevant 확인(2026-07-11): `plan.argv` 를 참조하는 dual-leg smoke 4개(triple-boundary T-0918 / publish-assembly T-0912 / roundtrip T-0913 / 4-boundary T-0919) 중 `plan.argv[2]` 를 **단일 source search-hit N 과 묶어** 단언하는 파일 0 — T-0912/T-0913 은 `plan.argv[2]).toBe("42")` 하드코딩 literal(단일-source 미결합·searchArgv 미포함), T-0918/T-0919 는 `plan.argv[2]` 미단언(선두 branch 토큰만). → issueNumber-as-edit-argv-element single-source 관통(search-hit→resolve→plan.argv[2]→output-parse 4지점 수렴) 부재 확인. `git log origin/main` 동일 영역 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0919-realdata-e2e-dual-leg-run-report-search-argv-resolve-output-parse-4-boundary-marker-medium-closure-smoke.md` — 직전 형제(search-side marker-as-search-argv-element 4-boundary). 본 task 는 그 **대칭 execute-side**(issueNumber-as-edit-argv-element). marker→searchArgv→resolve 검색 매체 관통 자체는 T-0919 cover — 재단언 금지. 본 task 는 resolve 이후 **plan.argv(=gh issue edit N 실 exec argv)가 issueNumber 를 argv 원소로 운반 + 그것이 output-parse N 으로 이어짐** 각도만. describe 구조·synthetic 빌더(searchHitStdout·issueUrlStdout·chain assembler)·import 규약 mirror 템플릿으로 참조.
- `docs/tasks/T-0918-realdata-e2e-dual-leg-run-report-descriptor-resolve-output-parse-triple-boundary-closure-smoke.md` — 형제 triple-boundary. resolve↔output-parse issueNumber 수렴 자체(action.update.issueNumber == outcome.issueNumber)는 T-0918 cover — 그 부분 재단언 금지. 본 task 는 그 사이에 **plan.argv[2] edit-argv 원소** 를 삽입한 별개 절단면.
- `docs/tasks/T-0913-realdata-e2e-dual-leg-run-report-publish-roundtrip-smoke.md` — 형제 round-trip. `plan.argv[2]).toBe("42")` 하드코딩 literal + create/update round-trip parse 정합 cover. 본 task 는 그 위에 **N 을 단일 source search-hit number 로 묶고 + searchArgv boundary 와 결합 + run/leg 분포 불변**을 추가하는 별개 절단면. round-trip parse 정합 자체 재단언 금지.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — resolve 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`. update 분기 → `action.update(최소 number)` + `argv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs)`. **`plan.argv` 가 곧 실 `gh issue edit`/`gh issue create` exec argv**(gh 실행 파일명 제외). searchStdout 은 hit JSON 배열 한 줄.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` — argv 빌더. update 분기 → `["issue", "edit", String(issueNumber), "--title", updateArgs.title, "--body", updateArgs.body]` — **`argv[2] === String(issueNumber)`**(issueNumber 를 문자열화한 실 exec argv 원소). create 분기 → `["issue", "create", "--title", ..., "--body", ..., ...labels]`(issueNumber 원소 없음). `assertPositiveIssueNumber` / `assertNonBlank` guard. 본 task 는 create argv 의 title/body/labels 형식 재단언 금지 — update 분기 `argv[2]` 원소가 issueNumber 운반만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` = `{action:'create'} | {action:'update', issueNumber}`. update 분기 issueNumber 접근 경로(discriminated union narrowing).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary. `RealDataDailyStepDualLegRunReportIssueDescriptor {title, marker, body}`, `runToken(report) = ${report.dateToken}@${report.gitSha}`(private), marker = prefix + runToken. **ISSUE_MARKER_PREFIX 는 private const(export 0)** — smoke 는 literal prefix 하드코딩이 아니라 구조적 단언. gitSha/dateToken 빈/공백 → report 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → searchQuery 운반 layer. `searchQuery === descriptor.marker`. 본 task 는 commandArgs 의 createArgs/updateArgs/labels 정합 재단언 0 — chain 조립 입력으로만 사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — search-gh-argv layer(chain 조립 입력으로 포함하되 argv 원소 순서/`--match body`/`--limit` 형식 재단언 금지 — search-argv 가드 및 T-0919 cover). 본 task 초점은 execute-side edit argv.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — post-boundary 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `{issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`, 0/선행0/비정수 throw)·url trim·raw 미저장(R-59). execStdout URL 안 N 은 search hit 최소 number 와 동일 합성(cross-boundary 수렴 입력 조건).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — search stdout 파서가 받는 JSON 배열 형식(`[{"number": N, "title": ..., "body": ...}]`) — searchStdout synthetic literal 합성용. body 에 marker 포함 여부가 hit 판정 매체.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}. 동일 run + 서로 다른 leg outcome literal 구성용.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-search-argv-resolve-output-parse-marker-medium-4-boundary-single-source-closure-assembly.smoke-spec.ts` (T-0919) — 헤더 주석·describe 구조·synthetic 입력 빌더·import 경로 규약 mirror 템플릿. 본 task 는 search-side 초점을 execute-side(plan.argv[2] edit 원소)로 옮긴 별개 파일.
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-edit-argv-resolve-output-parse-issuenumber-medium-execute-side-single-source-closure-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). issueNumber 원소는 literal 이 아니라 chain 이 산출한 `plan.argv` 에서 구조적으로(`plan.argv[2]` / `plan.argv.includes(String(N))`) 검증하고, run-token 은 `${run.dateToken}@${run.gitSha}` 계산으로 검증. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·execute-side issueNumber-as-edit-argv-element single-source 절단면·search-side T-0919 대칭·round-trip T-0913 와 직교) 작성.

- [ ] **Happy-path execute-side chain 합성 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}` + 임의 양수 `N`. 한 chain 으로 호출: `report = buildRealDataDailyStepDualLegRunReport(evalLeg, collectLeg, run)` → `descriptor = ...IssueDescriptor(report)` → `commandArgs = ...IssueCommandArgs(descriptor)` → `searchArgv = ...IssueSearchGhArgv(commandArgs)` → `searchStdout`(marker 를 body 에 담고 number=N 인 hit JSON 배열 한 줄) → `plan = resolve...IssueGhCommandPlan(searchStdout, commandArgs)`(hit 1+ → update) → `execStdout = https://github.com/owner/repo/issues/N` 한 줄 → `outcome = parse...IssueCreateEditOutput(execStdout)`. 산출물이 모두 정상(descriptor `{title,marker,body}` 비어있지 않음, `plan.action` update 분기로 issueNumber 보유, `plan.argv` 비어있지 않은 string[], outcome `{issueNumber,url}` 2필드 정확히 보유) happy test 1+.
- [ ] **edit-argv issueNumber-element byte-identical 단언 (핵심 1 — issueNumber-as-edit-medium)** — (a) update 분기에서 `plan.argv[0] === "issue"` AND `plan.argv[1] === "edit"` AND `plan.argv[2] === String(N)` — 즉 실 runner 가 `execFile('gh', plan.argv)` 로 실행할 argv 가 **`gh issue edit N` 경로 + issueNumber 를 argv 원소로 운반** 1+ test. (b) `plan.argv.includes(String(N))`(issueNumber 가 argv 안 원소로 존재) 1+ test. (c) `plan.action.action === "update"` narrowing 후 `plan.argv[2] === String(plan.action.issueNumber)` — resolve 가 해소한 action.issueNumber 와 실 exec argv 원소가 byte-identical 수렴 1+ test. (plan.argv 의 `--title`/`--body` 값·순서·labels 형식 재단언 금지 — issueNumber 원소 운반만.)
- [ ] **4지점 issueNumber single-source 수렴 단언 (핵심 2)** — 한 test 로 묶어: search hit 에 넣은 `N` → resolve 가 해소한 `plan.action.update.issueNumber` → **`plan.argv[2]`(edit exec argv 원소, `String(N)`)** → output-parse 의 `outcome.issueNumber` 가 네 지점 모두 동일 `N`(`plan.action.action === "update"` narrowing 후 `expect(plan.action.issueNumber).toBe(N)` AND `expect(plan.argv[2]).toBe(String(N))` AND `expect(outcome.issueNumber).toBe(N)` AND `expect(outcome.url).toContain(`/issues/${N}`)`) 1+ test. 즉 issueNumber 가 검색·해소·실 edit argv 원소·실행 stdout 해석 네 지점을 한 chain 안에서 drift 0 으로 관통. (resolve↔output-parse 정합 자체 재단언 아닌 — search-hit N 이 실 `gh issue edit` argv 원소로 운반되어 post N 과 같음의 execute-argv 각도.)
- [ ] **create 분기 argv 형태 격리 단언 (branch — 검색 미스 → create, edit-argv 무관)** — 동일 run·leg outcome 으로 chain 호출하되 `searchStdout` 을 빈 hit(`"[]"` 또는 marker 미포함 hit)로 합성 → `plan.action.action === "create"` 이고 `plan.argv[0] === "issue"` AND `plan.argv[1] === "create"` 1+ test. 이때 **create argv 에는 issueNumber 원소가 없음**(`plan.argv[2] !== String(N)`, create argv 는 `--title`/`--body`/labels 만 — issueNumber 는 update 분기 전용) 1+ test. 즉 검색 미스가 edit-argv 경로를 우회함(issueNumber-as-edit-medium 은 update 분기에서만). output-parse 는 여전히 execStdout 의 N 으로 issueNumber 산출(검색 분기 변경이 output-parse 경로와 독립) 1+ test.
- [ ] **run 분포 무관 — issueNumber 불변 단언 (branch — 다른 run→같은 edit-argv issueNumber)** — 서로 다른 run 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-07-11"}`, run_B `{gitSha:"def5678", dateToken:"2026-07-12"}`, 서로 substring 아닌 구별 값) → 각각 동일 N(같은 search hit number)으로 chain 호출 → (a) 두 chain 의 `plan.argv[2]` 가 **동일 `String(N)`**(issueNumber 는 search-stdout 종속, run 무관 — run 은 marker 로만 변별) 1+ test. (b) 그러나 두 chain 의 `descriptor.marker`(=searchQuery)는 서로 **다름**(run-token 으로 분리) 1+ test. "run 은 marker 로 변별, issueNumber(edit-argv 원소)는 stdout 종속" 축 분리 박제.
- [ ] **leg outcome 무관 — edit-argv issueNumber 격리 단언 (branch — partial-thread 격리)** — 동일 `run`·동일 searchStdout(같은 N)을 고정하고 leg outcome 조합(예: eval pass/collect pass vs eval fail/collect skip)만 다르게 두 chain 호출 → (a) 두 chain 의 `plan.argv[2]` 가 **동일 `String(N)`**(issueNumber 는 leg status/overallStatus 무관 — search hit 종속) 1+ test. (b) 두 chain 의 `outcome.issueNumber` 도 동일 N 으로 수렴 1+ test. (issueNumber 축 불변만 단언, updateArgs.title/body 의 leg 반영 변별은 out-of-scope.)
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(경계의 거부 대칭 박제, 단일 negative 금지):
  - (a) `run.gitSha` 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 chain 시작 차단(`expect(() => assembleViaChain(...)).toThrow`) 1+ test.
  - (b) `run.dateToken` 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 — 필드별 독립 분기) 1+ test.
  - (c) `plan.argv` 산출 시 update 분기 issueNumber 비양수(`/issues/0`·선행0·비정수를 유발하는 search hit number 예: `[{"number": 0, ...}]`)를 담은 searchStdout → resolve 위임 `assertPositiveIssueNumber`(gh-argv 빌더) 또는 search-parse number 검증 throw(비정상 number 가 edit argv 원소로 새는 것 차단) 1+ test. (issueNumber 원소 거부 대칭 — edit-argv boundary 자체가 비양수 N 을 argv 로 흘리지 않음.)
  - (d) `searchStdout` 비JSON/비배열(예: `"not json"`) → resolve(stage 4) 파서 위임 throw(marker/argv 정상이어도 hits 추출 실패로 resolve+argv 차단) 1+ test.
  - (e) `execStdout` 에 issue URL 미발견(빈/무관/비-github/`/pull/`) 또는 issueNumber 비양수(`/issues/0`·선행0) → output-parse(post) throw 각 1+ test(둘 다 — URL-미발견 분기와 비양수 분기 분리).
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, searchStdout, execStdout) 입력으로 chain 두 번 호출 → descriptor/commandArgs/searchArgv/plan/outcome 가 두 번 deep-equal(byte-identical, `plan.argv` 배열 포함) 1+ test. AND 입력 객체(run, leg outcome)·commandArgs 가 chain 호출 후 mutate 0(원본 deep-equal 유지, `JSON.parse(JSON.stringify(...))` snapshot 대조) 1+ test. AND `plan.argv` 배열이 입력/다음 호출 결과와 referential identity 분리(`not.toBe`) — 무공유 박제.
- [ ] **raw / credential 누출 0 test 1+** — chain 안 어디에서도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘가 descriptor.{title,marker,body} / commandArgs.searchQuery / searchArgv(배열 전체) / **plan.argv(배열 전체)** / outcome.{url} 어느 문자열에도 미등장(정규식/`not.toContain` 단언, R-59 / REQ-059 raw 미저장 정합). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 plan.argv/issueNumber 표면에 sentinel 미누출 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma` 변경 0. 새 외부 dependency 0.
- 형제 search-side 4-boundary smoke(T-0919)의 marker-as-search-argv-element(searchArgv 원소 운반·검색 매체 관통·marker 3지점 수렴) 자체 재단언 금지 — 본 task 는 그 대칭 **execute-side plan.argv(edit-argv) issueNumber 원소** 각도만.
- 형제 triple-boundary smoke(T-0918)의 descriptor→resolve→output-parse issueNumber 수렴(action.update.issueNumber == outcome.issueNumber) 자체 단독 재단언 금지 — 본 task 는 그 사이에 `plan.argv[2]` edit-argv 원소를 삽입한 각도만.
- 형제 round-trip smoke(T-0913)의 create/update round-trip parse 정합·`plan.argv[2]` 하드코딩 literal 자체 재단언 금지 — 본 task 는 N 을 단일 source search-hit number 로 묶고 + searchArgv 결합 + run/leg 분포 불변을 execute-argv 축에 추가.
- forward publish assembly(T-0912)·markdown assembly(T-0914)·descriptor body/identity confluence(T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면 이미 닫힘. searchArgv argv 원소 순서/`--match body`/`--limit` 형식·gh-argv 의 `--title`/`--body`/labels 형식 재단언 금지(각 가드 cover).
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만. value-consistency 가드 sweep 은 T-0911 에서 종결.
- descriptor.body 의 marker→markdown 2블록 구조·body 변별성 재단언 금지(body confluence 가드 cover). 본 task 는 issueNumber(edit-argv 원소) 축 + create/update argv 형태 격리만.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / `execFile('gh', argv)` / 실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred).
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs → searchArgv → resolve(search-stdout + commandArgs → {action.update.issueNumber, plan.argv}) → output-parse(exec-stdout → issueNumber) 를 같은 smoke 안에서 single-source(run + leg outcomes + search-stdout + exec-stdout) 로 한 chain 으로 호출하는 합성 smoke 작성. `plan.argv[2] === String(N)` edit-argv 원소 byte-identical·issueNumber 4지점 수렴·create 분기 argv 형태 격리(issueNumber 원소 부재)·run 무관 issueNumber·leg 무관 issueNumber·비양수 issueNumber 거부·negative/결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정.)

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
