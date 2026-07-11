---
id: T-0921
title: realdata-e2e dual-leg run report 한 publish chain 안에서 marker(=searchArgv 검색 매체, run-token 종속) 와 issueNumber(=editArgv[2] 편집 매체, search-hit 종속) 두 매체가 단일 source 로부터 각각 관통하며 서로 직교(cross-contamination 0)함을 박제하는 dual-medium single-source orthogonal convergence non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 295
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-dual-medium-searchargv-marker-editargv-issuenumber-orthogonal-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-dual-medium-orthogonal-convergence-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — dual-medium single-source orthogonal convergence sweep(happy 두-매체 동시 관통·marker→searchArgv 원소 run-token 종속·issueNumber→editArgv[2] search-hit 종속·직교성(marker 는 issueNumber 미결정·issueNumber 는 searchArgv 부재·marker 는 editArgv[2] 부재)·create 분기 격리·run 분포 변별(marker 변·issueNumber 불변)·leg outcome 무관·negative 분기 다수·결정론/no-mutation/credential) test-dominated ~295 LOC. 형제 T-0919(search-side marker-medium 단일축)/T-0920(execute-side issueNumber-medium 단일축)/T-0918(triple, argv 매체 미결합) 정당화. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0919(marker-as-search-medium)·T-0920(issueNumber-as-edit-medium) 각 단일축 종결 후 두 매체가 한 chain 에서 공존·직교함을 미결합한 capstone gap. dep [] file-disjoint stage5b 병렬.
---

# T-0921 — realdata-e2e dual-leg run report dual-medium(searchArgv marker + editArgv issueNumber) single-source orthogonal convergence non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(daily-test dual-leg run 결과 rolling-issue 멱등 박제)** 의 live wiring 은 한 publish chain 안에서 **두 개의 서로 다른 식별 매체(medium)** 를 실 gh argv 로 운반한다:

- **검색 매체(search medium)** — `descriptor.marker`(run-token `${dateToken}@${gitSha}` 보유)가 `commandArgs.searchQuery` 로, 다시 `searchArgv`(=`gh search issues ... <marker> ...`)의 단일 원소로 운반되어 **어느 run 의 이슈를 찾을지**를 결정한다. 이 축은 T-0919 가 marker-as-search-argv-element 4-boundary single-source closure 로 닫았다.
- **편집 매체(edit medium)** — search hit 의 최소 `number` N 을 resolve 가 해소해(`plan.action.update.issueNumber = N`) `plan.argv[2] = String(N)`(=`gh issue edit N ...`)의 argv 원소로 운반해 **어느 이슈를 실제로 갱신할지**를 결정한다. 이 축은 T-0920 이 issueNumber-as-edit-argv-element execute-side single-source closure 로 닫았다.

두 축은 각각 단일 smoke 로 닫혔으나, **한 chain 안에서 두 매체가 동시에 공존하며 서로 직교(orthogonal)함** — 즉 marker 는 **run** 을 식별하고 issueNumber 는 **issue** 를 식별하며, 한 매체의 값이 다른 매체 경로로 새거나 교차오염(cross-contamination)되지 않음 — 은 아직 한 chain 안에 결합돼 박제되지 않았다. 이 직교성이 step④ 멱등성(REQ-009 — "동일 run 의 기존 이슈를 찾아 갱신")의 무결성 핵심이다: marker 로 **run 을 찾고**(search medium), 그 검색이 반환한 issueNumber 로 **그 이슈를 편집**(edit medium)하되, 두 매체가 뒤섞이면(예: marker 가 editArgv 의 issueNumber 자리로 새거나, issueNumber 가 searchArgv 로 새어 검색 질의를 오염) 엉뚱한 run·엉뚱한 issue 를 건드린다.

구체적으로 세 직교 불변식이 한 chain 안에서 동시에 성립해야 한다:

1. **marker 는 searchArgv 원소이되 editArgv 의 issueNumber 자리(argv[2])에는 부재** — 검색 매체는 편집 argv 원소 값으로 새지 않는다.
2. **issueNumber 는 editArgv[2] 원소이되 searchArgv 어느 원소에도 부재** — 편집 매체는 검색 argv 로 새지 않는다(searchArgv 는 marker 로만 검색; issueNumber 는 검색 시점에 아직 미해소).
3. **두 매체의 source 독립** — marker 는 `report/run`(run-token) 종속이고 issueNumber 는 `search-stdout`(hit number) 종속이다. run 을 바꾸면 marker(=searchArgv 원소)는 변하지만 issueNumber(=editArgv[2])는 불변(search-stdout 고정 시); search-stdout 의 number 를 바꾸면 issueNumber(=editArgv[2])는 변하지만 marker(=searchArgv 원소)는 불변(run 고정 시).

이 **dual-medium single-source orthogonal convergence** 를 한 chain 안에 묶은 non-gated smoke 는 **부재**다. 형제 smoke 들이 각기 단일 축만 닫았다:

- **T-0919** (search-side marker-medium 4-boundary closure) — `searchArgv` 원소의 marker 운반·검색 매체 관통·marker 3지점 수렴은 닫았으나, `plan.argv`(=editArgv)를 **opaque 로 다뤄** 선두 branch 토큰(`argv[0]="issue"`, `argv[1]="edit"`)과 no-share/credential 만 단언한다. issueNumber-as-edit-argv-element 및 **두 매체의 직교성**은 미단언.
- **T-0920** (execute-side issueNumber-medium closure) — `plan.argv[2]===String(N)` 편집 매체·issueNumber 4지점 수렴은 닫았으나, `searchArgv`(marker 검색 매체 원소)를 **chain 조립 입력으로만 포함**하고 그 marker 원소가 editArgv issueNumber 축과 **직교함**(marker↛issueNumber, issueNumber↛searchArgv)은 미단언(T-0919 대칭 재단언 금지 Out-of-Scope).

즉 매체-교차오염 회귀(marker 가 editArgv issueNumber 자리로 새거나, issueNumber 가 searchArgv 검색 질의로 새거나, 한 매체의 source 변화가 다른 매체를 오염)는 public CI 에서 직접 발화되지 않고, 두 단일축 smoke 를 각각 통과해도 잡히지 않는다(각 smoke 가 상대 매체를 opaque/입력-only 로 다루므로). 본 task 는 T-0919·T-0920 을 한 chain 으로 결합한 capstone 으로, `report → descriptor → commandArgs → searchArgv → resolve(action + plan.argv editArgv) → output-parse` 종단 조립에서 **두 매체(marker=search / issueNumber=edit)가 단일 source 로부터 각각 관통하면서 서로 직교**함을 public CI 그물로 박제한다.

issue-still-relevant 확인(2026-07-11): dual-leg-run-report smoke 9개 중 `IssueSearchGhArgv`(searchArgv) 와 `plan.argv[2]`(editArgv issueNumber) 를 **한 chain 안에서 동시에 단언하며 두 매체의 직교성(marker↛editArgv[2], issueNumber↛searchArgv)** 을 박제하는 파일 0 — T-0919 는 editArgv opaque(argv[2] 미단언), T-0920 은 searchArgv 입력-only(marker 원소·직교성 미단언). `git log origin/main` 동일 영역(직교 convergence) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0919-realdata-e2e-dual-leg-run-report-search-argv-resolve-output-parse-4-boundary-marker-medium-closure-smoke.md` — search-side 축(marker-as-search-argv-element). 본 task 는 그 marker→searchArgv 원소·검색 매체 관통·marker 3지점 수렴 **자체는 재단언 금지**(T-0919 cover). 본 task 는 marker 원소가 **issueNumber 축과 직교**(marker↛editArgv[2]·marker source 독립)함만. describe 구조·synthetic 빌더·import 규약 mirror 템플릿으로 참조.
- `docs/tasks/T-0920-realdata-e2e-dual-leg-run-report-edit-argv-resolve-output-parse-issuenumber-medium-closure-smoke.md` — execute-side 축(issueNumber-as-edit-argv-element). 본 task 는 그 issueNumber→editArgv[2]·4지점 수렴 **자체는 재단언 금지**(T-0920 cover). 본 task 는 issueNumber 원소가 **marker 축과 직교**(issueNumber↛searchArgv·issueNumber source 독립)함만. 직전 형제 — describe 구조·chain assembler·import 규약 mirror 1순위 템플릿.
- `docs/tasks/T-0918-realdata-e2e-dual-leg-run-report-descriptor-resolve-output-parse-triple-boundary-closure-smoke.md` — 형제 triple-boundary. descriptor→resolve→output-parse issueNumber 수렴 자체 재단언 금지. 본 task 는 그 위에 **두 argv 매체(searchArgv·editArgv)의 직교** 절단면.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — search-gh-argv layer `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `["search","issues","--match","body",<searchQuery=marker>,"--json",...,"--limit",...]`. marker 가 argv 단일 원소. 본 task 는 원소 순서/`--match body`/`--limit` 형식 재단언 금지(T-0919·가드 cover) — searchArgv 안에 marker 원소 존재 + issueNumber 부재만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — resolve 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`. update 분기 → `plan.argv = ["issue","edit",String(issueNumber),"--title",...,"--body",...]`. **`plan.argv` = 실 gh edit exec argv**(editArgv). searchStdout 은 hit JSON 배열 한 줄.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` — argv 빌더. update 분기 → `argv[2] === String(issueNumber)`. create 분기 → issueNumber 원소 없음(`--title`/`--body`/labels 만). 본 task 는 title/body/labels 형식 재단언 금지 — editArgv[2] issueNumber 원소 + create 분기 issueNumber 부재만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueAction` = `{action:'create'} | {action:'update', issueNumber}`. update narrowing 경로.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary. `{title, marker, body}`, marker = private prefix + `${report.dateToken}@${report.gitSha}`(runToken). **prefix 는 private const(export 0)** — smoke 는 literal 하드코딩이 아니라 구조적 단언(marker 안에 `${dateToken}@${gitSha}` 포함 여부). gitSha/dateToken 빈/공백 → report 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → searchQuery 운반 layer(`searchQuery === descriptor.marker`). chain 조립 입력으로만 사용 — createArgs/updateArgs/labels 정합 재단언 0.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — post-boundary 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `{issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`) throw·raw 미저장(R-59). execStdout URL 안 N 은 search hit 최소 number 와 동일 합성(수렴 입력 조건).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — searchStdout JSON 배열 형식(`[{"number": N, "title": ..., "body": <marker 포함>}]`) — synthetic literal 합성용. body 에 marker 포함 여부가 hit 판정 매체.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}. 동일 run + 서로 다른 leg outcome 구성용.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-edit-argv-resolve-output-parse-issuenumber-medium-execute-side-single-source-closure-assembly.smoke-spec.ts` (T-0920) — chain assembler·synthetic 입력 빌더(searchHitStdout·issueUrlStdout)·import 경로 규약 mirror 1순위 템플릿. 본 task 는 초점을 단일축(issueNumber)에서 **두 매체 직교**로 옮긴 별개 파일.
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-dual-medium-searchargv-marker-editargv-issuenumber-orthogonal-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). marker 는 `${run.dateToken}@${run.gitSha}` 계산으로, issueNumber 원소는 chain 산출 `searchArgv`/`plan.argv` 에서 구조적으로 검증(literal 하드코딩 금지). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·dual-medium 직교 절단면·search-side T-0919·execute-side T-0920 결합 capstone) 작성.

- [ ] **Happy-path dual-medium chain 합성 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}` + 임의 양수 `N`. 한 chain: `report = buildRealDataDailyStepDualLegRunReport(evalLeg, collectLeg, run)` → `descriptor = ...IssueDescriptor(report)` → `commandArgs = ...IssueCommandArgs(descriptor)` → `searchArgv = ...IssueSearchGhArgv(commandArgs)` → `searchStdout`(marker 를 body 에 담고 number=N 인 hit JSON 배열 한 줄) → `plan = resolve...IssueGhCommandPlan(searchStdout, commandArgs)`(hit 1+ → update) → `execStdout = https://github.com/owner/repo/issues/N` 한 줄 → `outcome = parse...IssueCreateEditOutput(execStdout)`. 산출물이 모두 정상(descriptor `{title,marker,body}` 비어있지 않음, `searchArgv` 비어있지 않은 string[], `plan.action` update 분기로 issueNumber 보유, `plan.argv` 비어있지 않은 string[], outcome `{issueNumber,url}`) happy test 1+.
- [ ] **두 매체 동시 관통 단언 (핵심 1 — coexistence)** — 같은 chain 산출에서 (a) `searchArgv.includes(descriptor.marker)`(검색 매체: marker 가 searchArgv 원소) AND (b) `plan.action.action === "update"` narrowing 후 `plan.argv[2] === String(N)`(편집 매체: issueNumber 가 editArgv[2] 원소) 를 **한 test 안에서 동시에** 단언 1+ test. 즉 한 publish chain 안에서 두 매체가 각각 자기 argv 원소로 공존.
- [ ] **직교 단언 1 — marker 는 editArgv issueNumber 자리(argv[2])에 부재 (핵심 2)** — `descriptor.marker !== plan.argv[2]` AND `plan.argv[2]` 가 marker 를 포함하지 않음(`expect(plan.argv[2]).not.toContain(run.dateToken)` 등 run-token 조각 미포함, 단 `plan.argv[2]===String(N)` 는 이미 위에서 cover). 즉 검색 매체(run-token)가 편집 argv 원소 값으로 새지 않음 1+ test. (marker 가 editArgv 의 `--body`/`--title` 값에 정상 등장하는 것은 별개 — 본 단언은 issueNumber 자리 argv[2] 한정.)
- [ ] **직교 단언 2 — issueNumber 는 searchArgv 어느 원소에도 부재 (핵심 3)** — `searchArgv.every(el => el !== String(N))` AND `searchArgv` 전체 join 문자열이 `String(N)` 을 issueNumber 로서 포함하지 않음(검색 시점엔 issueNumber 미해소 — searchArgv 는 marker 로만 검색). 즉 편집 매체(issueNumber)가 검색 argv 로 새지 않음 1+ test. (주의: N 이 우연히 marker/searchQuery 문자열 substring 이 되지 않도록 N 을 marker 와 disjoint 한 값으로 합성 — 예: marker 는 dateToken@gitSha 형태, N 은 그와 substring 관계 없는 양수.)
- [ ] **직교 단언 3 — source 독립: run 변화 → marker 변·issueNumber 불변 (핵심 4)** — 서로 다른 run 두 개(run_A `{gitSha:"abc1234", dateToken:"2026-07-11"}`, run_B `{gitSha:"def5678", dateToken:"2026-07-12"}`, 서로 substring 아님) + **동일 searchStdout(같은 N)** 로 각각 chain 호출 → (a) 두 chain 의 `searchArgv` 안 marker 원소는 서로 **다름**(run-token 종속) 1+ test, (b) 그러나 두 chain 의 `plan.argv[2]` 는 **동일 `String(N)`**(issueNumber 는 search-stdout 종속, run 무관) 1+ test. "run 은 marker(검색 매체)로만 변별, issueNumber(편집 매체)는 stdout 종속" 직교 박제.
- [ ] **직교 단언 4 — source 독립: search-hit number 변화 → issueNumber 변·marker 불변 (핵심 5)** — **동일 run** + 서로 다른 searchStdout(number N_A vs N_B, 둘 다 body 에 같은 marker 포함) 로 각각 chain 호출 → (a) 두 chain 의 `plan.argv[2]` 는 서로 **다름**(`String(N_A)` vs `String(N_B)`, search-hit 종속) 1+ test, (b) 그러나 두 chain 의 `searchArgv` 안 marker 원소는 **동일**(run 고정 시 marker 불변, search-stdout 무관) 1+ test. 앞 단언과 대칭으로 "issueNumber 는 hit number 로만 변별, marker 는 run 종속" 직교 박제.
- [ ] **create 분기 격리 단언 (branch — 검색 미스 → 두 매체 모두 무관)** — 동일 run·leg outcome 으로 chain 호출하되 `searchStdout` 을 빈 hit(`"[]"` 또는 marker 미포함 hit)로 합성 → `plan.action.action === "create"` 이고 (a) create argv 는 `plan.argv[0]==="issue"` AND `plan.argv[1]==="create"` AND **issueNumber 원소 부재**(`plan.argv[2] !== String(N)`) 1+ test, (b) 그러나 `searchArgv`(검색 매체)는 여전히 marker 원소 보유(검색 시도 자체는 marker 로 수행됨 — 검색 미스는 검색-argv 를 바꾸지 않음) 1+ test. 즉 검색 결과(hit/miss)가 검색 매체(searchArgv marker)를 바꾸지 않고 편집 매체(editArgv issueNumber)만 우회.
- [ ] **leg outcome 무관 — 두 매체 격리 단언 (branch — partial-thread 격리)** — 동일 `run`·동일 searchStdout(같은 N) 고정 + leg outcome 조합(eval pass/collect pass vs eval fail/collect skip)만 다르게 두 chain 호출 → (a) 두 chain 의 `searchArgv` marker 원소 동일 AND `plan.argv[2]` 동일 `String(N)`(두 매체 모두 leg status 무관) 1+ test. (updateArgs.title/body 의 leg 반영 변별은 out-of-scope — 두 매체 argv 원소 축 불변만.)
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) `run.gitSha` 빈/공백 → descriptor(stage 1) guard throw 로 chain 시작 차단 1+ test.
  - (b) `run.dateToken` 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도) 1+ test.
  - (c) 비양수 issueNumber(`[{"number": 0, ...}]` 또는 선행0/비정수 유발 searchStdout) → resolve 위임 guard throw(비정상 number 가 editArgv 원소로 새는 것 차단) 1+ test.
  - (d) `searchStdout` 비JSON/비배열(`"not json"`) → resolve(stage 4) 파서 위임 throw 1+ test.
  - (e) `execStdout` issue URL 미발견(빈/무관/비-github/`/pull/`) 또는 issueNumber 비양수(`/issues/0`·선행0) → output-parse throw 각 1+ test(URL-미발견 분기와 비양수 분기 분리).
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, searchStdout, execStdout) 입력으로 chain 두 번 호출 → descriptor/commandArgs/searchArgv/plan/outcome 가 두 번 deep-equal(byte-identical, `searchArgv`·`plan.argv` 배열 포함) 1+ test. AND 입력 객체(run, leg outcome)·commandArgs 가 chain 호출 후 mutate 0(원본 deep-equal 유지, `JSON.parse(JSON.stringify(...))` snapshot 대조) 1+ test. AND `searchArgv`·`plan.argv` 배열이 입력/다음 호출 결과와 referential identity 분리(`not.toBe`).
- [ ] **raw / credential 누출 0 test 1+** — chain 안 어디에서도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘가 descriptor.{title,marker,body} / commandArgs.searchQuery / **searchArgv(배열 전체)** / **plan.argv(배열 전체)** / outcome.{url} 어느 문자열에도 미등장(정규식/`not.toContain`, R-59 / REQ-059). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 searchArgv/plan.argv 표면에 sentinel 미누출 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma` 변경 0. 새 외부 dependency 0.
- 형제 search-side smoke(T-0919)의 marker-as-search-argv-element(searchArgv marker 원소 운반·검색 매체 관통·marker 3지점 수렴) **자체 재단언 금지** — 본 task 는 marker 원소가 **issueNumber 축과 직교**(marker↛editArgv[2]·run 종속)함만.
- 형제 execute-side smoke(T-0920)의 issueNumber-as-edit-argv-element(plan.argv[2] byte-identical·issueNumber 4지점 수렴) **자체 재단언 금지** — 본 task 는 issueNumber 원소가 **marker 축과 직교**(issueNumber↛searchArgv·search-hit 종속)함만.
- 형제 triple-boundary smoke(T-0918)의 descriptor→resolve→output-parse issueNumber 수렴 자체 단독 재단언 금지.
- forward publish assembly(T-0912)·round-trip(T-0913)·markdown assembly(T-0914)·descriptor body/identity confluence(T-0915/T-0916)·run-token cross-surface(T-0917) 재검증 — 각 절단면 이미 닫힘. searchArgv 원소 순서/`--match body`/`--limit` 형식·gh-argv 의 `--title`/`--body`/labels 형식 재단언 금지(각 가드 cover).
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만. value-consistency 가드 sweep 은 T-0911 에서 종결.
- 실 LLM / `EvaluationScoringService.scoreUnit` / Ollama / 실 github / 실 gh / `execFile('gh', argv)` / 실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred).
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs → searchArgv → resolve → output-parse 를 같은 smoke 안에서 single-source 로 한 chain 으로 호출하는 합성 smoke 작성. 두 매체 동시 관통(searchArgv marker + editArgv[2] issueNumber)·직교 4종(marker↛editArgv[2]·issueNumber↛searchArgv·run→marker변·issueNumber불변·hit-number→issueNumber변·marker불변)·create 분기 격리·leg 무관·negative/결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. N 을 marker 와 substring-disjoint 한 값으로 합성해 직교 단언의 우연 매칭 회피.)

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
