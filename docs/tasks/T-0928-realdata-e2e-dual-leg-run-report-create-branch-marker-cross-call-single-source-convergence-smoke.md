---
id: T-0928
title: realdata-e2e dual-leg run report 의 create 분기(빈 search)에서 searchArgv(call 1 `--match body <marker>`)의 검색 marker 와 create-branch plan.argv(call 2 `gh issue create --body`)의 body 선두 marker 라인이 단일 source(descriptor.marker)로부터 byte-identical 하게 관통함을 박제하는 create-branch cross-call marker single-source convergence non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-032, REQ-059]
estimatedDiff: 320
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-create-branch-searchargv-marker-createbody-single-source-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-create-branch-marker-convergence-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — create-branch cross-call marker single-source convergence sweep(happy: 빈 search → action create → searchArgv 검색 marker(=`--match body` 다음 원소) 와 create-branch plan.argv body 선두 marker 라인이 동일 descriptor.marker 로부터 byte-identical·marker 는 chain 안 정확히 검색질의 1원소 + create body 선두 1라인 두 지점에서만 등장·run 분포 변별(run 을 바꾸면 두 지점 marker 가 함께 변하되 여전히 서로 byte-identical)·leg outcome/overallStatus 무관 marker 안정·update 분기 격리(hits 있을 때 create body argv 미산출)·negative(값 drift·구조결손 guard·상류 차단·결정론/no-mutation/credential) 다수) test-dominated ~320 LOC. 형제 T-0919(search-side marker-medium 단일축)/T-0927(gh-command-plan create argv single-source)/T-0921(update-branch marker⊥issueNumber orthogonal) 은 각각 단일 gh 호출 축만 닫아 create 분기의 두 gh 호출(search call 1 + create call 2) 사이 marker single-source 관통은 미결합 — 본 task 가 그 create-side cross-call seam 봉합. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0921(update-branch marker⊥issueNumber orthogonal) 의 create-side 대칭 gap. searchArgv marker(call1) ↔ create-branch body marker(call2) 가 단일 descriptor.marker 로부터 byte-identical 관통(create-side 멱등 근거). dep [] file-disjoint stage5b 병렬.
---

# T-0928 — realdata-e2e dual-leg run report create-branch cross-call marker single-source convergence non-gated smoke

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 멱등 박제) chain 의 **create 분기 두 gh 호출 사이 marker single-source 관통 seam** 이 아직 어떤 smoke 에도 chain 그물로 묶이지 않았다. step④ 의 rolling-issue 박제는 **두 번의 gh 호출** 로 이뤄진다:

- **call 1 (search)** — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)`(T-0900) 가 산출한 `["search","issues","--match","body", searchQuery, "--json", ...]` argv 로 "이 run 의 이슈가 이미 있는가?"를 검색. `searchQuery` = `descriptor.marker`(안정 run-token `${dateToken}@${gitSha}`).
- **call 2 (create)** — 검색이 빈 결과면 action 이 `create` 로 해소되어 종단 컴포저 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)`(T-0902) 가 `["issue","create","--title",title,"--body",body, ...labels]` argv 를 산출. 이 `body` = `descriptor.body` 이며 **body 의 선두 라인이 정확히 `descriptor.marker`** 다(descriptor helper: `body = [marker, "", ...markdown]`).

즉 **검색하는 marker(call 1)와 새로 박제하는 이슈 body 에 심는 marker(call 2)가 동일 `descriptor.marker` 단일 source 로부터 byte-identical 하게 관통해야** step④ 의 create-side 멱등(REQ-009 — "동일 run 의 이슈를 찾아 갱신")이 성립한다: 오늘 밤 run 이 marker M 으로 검색해 없으면 body 선두에 marker M 을 심어 이슈를 만들고, 내일 밤 run 이 다시 marker M 으로 검색하면 그 이슈를 찾아 **중복 생성 대신 갱신** 한다. 만약 검색 marker 와 create body marker 가 어긋나면(silent drift) — 매 nightly 가 자기가 만든 이슈를 못 찾아 **중복 이슈를 무한 양산** 한다.

그러나 이 **create 분기 두 gh 호출 사이 marker single-source 관통** 은 어느 smoke 도 chain 그물로 검증하지 않는다:

- 형제 T-0919(search-side marker-medium 4-boundary closure)는 **call 1 의 searchArgv 원소 marker** 만 자산화하고 create body argv 를 다루지 않는다.
- 형제 T-0927(gh-command-plan create argv single-source)은 **call 2 의 create-branch plan.argv 가 single-source 빌더 산출과 byte-identical** 함만 자산화하고 그 body 선두 marker 가 call 1 searchArgv 의 검색 marker 와 동일 source 임은 미단언(searchArgv 를 다루지 않음).
- 형제 T-0921(dual-medium orthogonal)은 **update/edit 분기** 의 marker(=search 매체) ⊥ issueNumber(=edit 매체) 직교성만 자산화하고 **create 분기** 는 명시적으로 격리 대상(재단언 금지). create 분기에는 issueNumber 매체가 없고 대신 marker 가 **검색·생성 두 지점에 동시 등장** 하므로 T-0921 의 직교 축과 다른 축(marker single-source cross-call 수렴)이다.

본 task 는 그 **create-branch cross-call marker seam** 을 닫는다 — T-0921(update-branch marker⊥issueNumber orthogonal)의 **create-side 대칭 sibling**. chain: 두 leg outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, (1) `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` 로 searchArgv 를 산출, (2) 빈 search stdout(`"[]"`)에 종단 컴포저를 적용해 `{action:"create", argv}` plan 을 산출한 뒤, **searchArgv 안의 검색 marker(=`--match body` 다음 원소) 와 create-branch plan.argv 의 `--body` 값 선두 라인 marker 가 동일 `descriptor.marker` 로부터 byte-identical** 함을 박제한다.

issue-still-relevant 확인(2026-07-12): dual-leg smoke 중 파일명·본문에 `create-branch` + `searchArgv` + `body marker` cross-call 수렴을 결합한 것 = **0개**. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`(T-0900)·`descriptor.body` 선두 marker(T-0896)·종단 컴포저 create 분기 argv(T-0902) 배선은 이미 main 에 박제됨 — 본 task 는 그 배선을 **다시 만들지 않고** create 분기에서 두 gh 호출의 marker 가 동일 source 로부터 관통함을 대조하는 **smoke 그물만** 신설. `git log origin/main` 동일 영역(dual-leg create-branch cross-call marker 수렴 smoke) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0921-realdata-e2e-dual-leg-run-report-dual-medium-searchargv-marker-editargv-issuenumber-orthogonal-convergence-smoke.md` — **create-side 대칭 원본**. update-branch 의 marker(=search 매체) ⊥ issueNumber(=edit 매체) 직교 축·chain assembler(두 leg outcome + run → report → descriptor → commandArgs → searchArgv → resolve)·synthetic 빌더·import 경로 규약·describe 구조·한국어 헤더 주석·negative 접근 mirror 1순위 템플릿. 본 task 는 그 **update-branch orthogonal** 축 자체 재단언 금지 — 초점을 update 직교에서 **create-branch 검색 marker(call 1) ↔ create body 선두 marker(call 2) single-source byte-identical 수렴** 으로 이동.
- `docs/tasks/T-0927-realdata-e2e-dual-leg-run-report-gh-command-plan-argv-single-source-assembly-smoke.md` — 직전 형제(gh-command-plan create/update argv single-source). create 분기 plan.argv 가 빌더 산출과 byte-identical 함은 이미 cover — 본 task 는 그 축 재단언 금지, **create body argv 의 선두 marker 라인 ↔ searchArgv 검색 marker 원소** cross-call 수렴으로 확장.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — **본 task 핵심 대상 (marker single source)**. `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `{title, marker, body}`. `marker = ${ISSUE_MARKER_PREFIX} ${token} -->`(token = `${dateToken}@${gitSha}`, line 137), `body = [marker, "", ...markdown].join("\n")`(marker 가 body 선두 라인, line 141~). guard: gitSha/dateToken 빈-공백 → throw(chain 상류 차단 negative 용). marker 는 동일 run → 동일(leg status/overallStatus 무관).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — **call 1 대상**. `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `["search","issues","--match","body", searchQuery, "--json", ...]`(line 104~). `searchQuery` = commandArgs.searchQuery(= descriptor.marker), `--match body` 다음 단일 원소로 escape 없이 운반. guard: searchQuery 빈/공백 → throw. 형식 규약(argv 원소 순서·`--json` 필드) 자체 재단언 금지(T-0919 cover) — 검색 marker 원소 추출에만 사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — **call 2 종단 컴포저**. `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`(line 82~). 빈 search stdout(`"[]"`) → action create → create 분기 argv `["issue","create","--title",title,"--body",body, ...labels]`. `--body` 다음 원소 = descriptor.body(선두 라인 = marker). 컴포저 본문·3단계 위임 배선 재단언 금지 — chain 통과 plan.argv 산출에만 사용.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `{searchQuery(=descriptor.marker), createArgs{title,body,labels}, updateArgs{title,body}}`. `searchQuery` 와 `createArgs.body` 가 둘 다 descriptor 로부터 파생(searchQuery = marker, createArgs.body = descriptor.body). chain 산출 commandArgs 원천 — 형식 재단언 금지, 조립 입력·marker source 대조에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}(synthetic literal 원천). leg status/overallStatus 를 바꿔도 marker 불변(안정성) negative 조립용.
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-dual-medium-searchargv-marker-editargv-issuenumber-orthogonal-convergence-assembly.smoke-spec.ts` — 형제 T-0921 실물. chain assembler·synthetic literal 주입·marker 추출 유틸·describe 구조 참고. **update-branch 축 재단언 금지** — 본 task 는 create-branch marker cross-call 수렴만.
- `test/jest-smoke.json` — smoke jest config(`testRegex: ".*\\.smoke-spec\\.ts$"` 가 본 신규 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-create-branch-searchargv-marker-createbody-single-source-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / search stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / `gh issue create|search` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). marker 는 chain 산출물(descriptor.marker / searchArgv 원소 / create body 선두 라인)에서 추출해 대조 — literal 하드코딩 최소. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·`execFile` 0·네트워크 0·DB 0·create 분기 두 gh 호출(search call 1 + create call 2) 사이 marker single-source 관통 절단면·searchArgv 검색 marker=`--match body` 다음 원소·create body 선두 라인 marker·동일 descriptor.marker byte-identical·REQ-009 멱등 근거/REQ-032/REQ-059 raw 미저장·형제 T-0921 update-branch orthogonal 과의 차별=update 직교가 아니라 create 분기 검색·생성 두 지점 marker single-source 수렴·형제 T-0919/T-0927 각 단일 gh 호출 축과의 차별=두 gh 호출 cross-call 결합) 작성.

- [ ] **Happy-path create-branch marker cross-call 수렴 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. chain: report → descriptor → commandArgs 통과. (1) `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → searchArgv, (2) 빈 search stdout(`"[]"`)에 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan("[]", commandArgs)` → plan. plan.action.action === "create". searchArgv 의 검색 marker(= `--match body` 원소 바로 다음 원소) 와 create-branch plan.argv 의 `--body` 다음 원소(body) 의 **선두 라인**(`body.split("\n")[0]`) 가 **둘 다 `descriptor.marker` 와 byte-identical**(`===`) 함을 각각 대조 1+ test. AND 두 marker 가 서로 byte-identical(`searchMarker === createBodyHeadLine`) 1+.
- [ ] **marker 등장 지점 유일성 test 1+** — chain 산출물에서 marker 는 정확히 (i) searchArgv 의 검색질의 1원소 (ii) create body 의 선두 1라인 두 지점에서만 온전한 형태로 등장하고, searchArgv 의 다른 원소(`search`/`issues`/`--match`/`body`/`--json`/필드/`--limit` 등)에는 marker 부재, create plan.argv 의 title 원소·labels 원소에는 marker 온전체 부재(title 은 별도 prefix+token 이므로 body 선두 marker 라인 문자열과 `!==`) 를 각 1+ test. body 안에서도 marker 라인이 정확히 1회만 등장(`body.split(marker).length === 2`, 중복 0) 1+.
- [ ] **run 분포 변별 test 1+ (두 지점 동반 변화 + 여전히 상호 byte-identical)** — 서로 다른 run(run A: gitSha/dateToken, run B: 다른 gitSha 또는 dateToken)으로 각각 chain 을 돌려 (i) run A 의 (searchMarker_A, createBodyHead_A) 는 서로 byte-identical, run B 의 (searchMarker_B, createBodyHead_B) 도 서로 byte-identical, (ii) run A ≠ run B 이면 searchMarker_A !== searchMarker_B AND createBodyHead_A !== createBodyHead_B(두 지점이 run 에 따라 **함께** 변함) 를 각 1+ test(marker 가 run-token 단일 source 로부터 두 지점에 동반 관통함을 박제).
- [ ] **leg outcome 무관 marker 안정 test 1+** — 동일 run 으로 leg outcome(예: eval leg passed true→false, collect leg action 변경, overallStatus 변동)을 바꿔도 searchMarker 와 createBodyHead 가 서로 byte-identical 하고 두 값 모두 leg outcome 변경 전과 동일함(marker 는 run-token 만의 함수) 1+ test(멱등 근거 — 같은 run 은 leg status 무관 동일 이슈로 수렴).
- [ ] **update 분기 격리 test 1+** — 후보 1+건 search stdout(marker 를 body 에 담은 `[{"number":N,"title":...,"body":<marker>...}]`)에 컴포저 적용 → plan.action.action === "update" AND plan.argv 가 `["issue","edit",String(N), ...]` 로 **create body argv 미산출**(create-branch 의 `issue create` argv 는 update 분기에서 생성되지 않음 — plan.argv[1] !== "create") 를 확인 1+ test(본 task 의 create-branch marker 수렴 축은 create 분기에서만 성립함을 명시).
- [ ] **single-source 독립 재유도 test 1+** — 컴포저·searchArgv 빌더 재호출 없이 별도로 `descriptor.marker` 를 진실의 원천으로 삼아, searchMarker 와 createBodyHead 가 그 descriptor.marker 와 각각 deep-equal 함을 단언 1+ test(두 지점 marker 가 하드코딩이 아니라 descriptor.marker 파생임 반영). **결정론** — 동일 입력 두 번 chain → 두 (searchMarker, createBodyHead) 쌍 deep-equal(byte-identical) 1+.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) searchArgv 검색 marker drift 검출 — chain 산출 searchArgv 를 복제해 검색 marker 원소를 변형한 synthetic argv 의 검색 marker 가 create body 선두 marker 와 `!==`(cross-call byte-identical 위반 검출) 1+ test.
  - (b) create body 선두 marker drift 검출 — create-branch plan.argv 의 body 원소를 복제해 선두 marker 라인을 변형(예: token 한 글자 변경)한 synthetic body 의 선두 라인이 searchArgv 검색 marker 와 `!==` 1+ test.
  - (c) descriptor guard 상류 차단(marker 미산출) — run.gitSha(또는 dateToken)가 빈/공백이면 `buildRealDataDailyStepDualLegRunReportIssueDescriptor` guard throw 로 marker·searchQuery·body 자체가 산출되지 않아 chain 조립이 차단됨(잘못된 비식별 marker 로 검색/생성이 새는 것 차단) 1+ test. `expect(() => 조립체인).toThrow()`.
  - (d) searchArgv 빌더 guard 상류 차단 — commandArgs.searchQuery(= marker)가 빈/공백인 commandArgs 를 searchArgv 빌더에 직접 넣으면 throw 로 searchArgv 미산출(빈 검색질의 전체 매칭 사고 차단) 1+ test. `expect(() => build...SearchGhArgv(badArgs)).toThrow()`.
  - (e) 컴포저 파서 guard 상류 차단(create 분기 argv 미산출) — 컴포저에 비-JSON(`"{"`)/비배열 JSON(`"{}"`) stdout 을 넣으면 파서 throw 가 컴포저로 전파돼 plan(및 create body argv) 미산출(손상 plan 이 live wiring 으로 새는 것 차단) 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (leg outcome, run) 로 chain 을 두 번 실행 → 두 (searchArgv, plan.argv) 가 deep-equal(byte-identical) 이며 서로 다른 배열 인스턴스(무공유) 1+ test. AND chain 호출이 commandArgs(중첩 createArgs/labels 포함) 및 run 을 mutate 0(호출 전후 `JSON.parse(JSON.stringify(...))` snapshot deep-equal) 1+ test.
- [ ] **raw / credential 누출 0 test 1+** — searchArgv·create-branch plan.argv 의 어느 원소도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘를 담지 않음(정규식/`not.toContain`, R-59 / REQ-059) 1+ test. marker(=검색질의·create body 선두 라인)가 안정 run-token(`${dateToken}@${gitSha}` + 고정 prefix)만 담고 raw 활동 narrative 본문·credential 미포함 1+. descriptor/searchArgv guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) 을 negative case 에서 확인 1+.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- descriptor(`...-issue-descriptor.ts`) / searchArgv 빌더(`...-issue-search-argv.ts`) / gh-command-plan 컴포저(`...-issue-gh-command-plan.ts`) / command-args 빌더 **본문 변경 금지** — import·호출만. 각 배선(marker 합성·searchQuery→argv 운반·컴포저 3단계 위임)은 **이미 main 에 T-0896/T-0900/T-0902 로 박제됨** — 재배선 금지, chain 통과 산출물의 marker 를 대조하는 smoke 그물만.
- 형제 T-0921 의 **update-branch marker(=search 매체) ⊥ issueNumber(=edit 매체) 직교 축** 재단언 금지 — 본 task 는 **create 분기** 의 검색 marker(call 1) ↔ create body 선두 marker(call 2) single-source cross-call 수렴 축(update 분기는 격리 확인만).
- 형제 T-0919 의 search-argv marker 4-boundary single-source closure 축·T-0927 의 gh-command-plan create/update argv single-source byte-identical 축 자체 재단언 금지 — 본 task 는 두 gh 호출을 결합한 cross-call marker 수렴 단일 축.
- 형제 T-0920 의 edit-argv issueNumber·T-0922 의 re-publish idempotency·T-0924/25/26 의 value-consistency 3-seam 자체 재단언 금지.
- descriptor body 의 markdown 본문 렌더(marker 이후 블록)·title 형식·labels 형식 재단언 금지 — 각 helper/smoke 가 이미 cover. 본 task 는 marker 라인(검색·생성 두 지점) single-source 수렴만.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github·실 gh `execFile('gh', argv)`·`gh issue create`/`gh search issues`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). gitSha/dateToken·leg outcome·search stdout·N 은 synthetic literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 두 leg outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, (1) searchArgv 빌더로 searchArgv 를, (2) 빈 search stdout(`"[]"`)에 종단 컴포저를 적용해 `{action:"create", argv}` plan 을 산출한 뒤, searchArgv 의 검색 marker(= `--match body` 다음 원소)와 create-branch plan.argv 의 `--body` 다음 원소 body 의 선두 라인 marker 가 둘 다 `descriptor.marker` 와 byte-identical 함을 대조하는 합성 smoke 작성. 핵심: 두 지점 marker 상호 byte-identical·marker 등장 지점 유일성(searchArgv 검색질의 1원소 + create body 선두 1라인)·run 분포 변별(run 을 바꾸면 두 지점 marker 동반 변화 + 여전히 상호 identical)·leg outcome 무관 marker 안정·update 분기 격리(create body argv 미산출)·검색 marker/create body marker drift `!==` 검출·descriptor/searchArgv/파서 guard 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. descriptor.body 선두 라인이 정확히 marker 임(`body.split("\n")[0] === marker`) 을 유의 — 축은 검색 marker ↔ create body 선두 marker 의 단일 source 관통.)

## Follow-ups

(없음 — create-branch cross-call marker single-source 수렴이 봉합되면 dual-leg run report step④ 의 create 분기 두 gh 호출(search call 1 + create call 2) marker 관통이 chain 그물에 편입. T-0921(update-branch marker⊥issueNumber orthogonal) + 본 task(create-branch marker cross-call 수렴)로 두 action 분기(create/update)의 cross-call 매체 관통이 모두 봉합. 잔여는 step④ live wiring(credential gate deferred, ADR-0045 LAN gate) — 다음 turn 의 planner 가 PLAN 재평가로 판단)
