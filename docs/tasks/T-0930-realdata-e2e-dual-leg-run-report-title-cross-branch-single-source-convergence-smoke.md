---
id: T-0930
title: realdata-e2e dual-leg run report 의 create 분기(빈 search) plan.argv `--title` 원소와 update 분기(marker-매칭 hit) plan.argv `--title` 원소가 단일 source(descriptor.title)로부터 byte-identical 하게 관통함을 박제하는 title cross-branch single-source convergence non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-032, REQ-059]
estimatedDiff: 330
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-title-cross-branch-single-source-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-title-cross-branch-convergence-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — title cross-branch single-source convergence sweep(happy: 유효 두 leg outcome + run → report → descriptor → commandArgs 통과 후 create 분기(빈 search `"[]"`) plan.argv 의 `--title` 다음 원소 와 update 분기(marker-매칭 hit) plan.argv 의 `--title` 다음 원소 가 둘 다 descriptor.title 로부터 byte-identical·title 은 두 argv 에서 정확히 `--title` 다음 1원소로만 등장·title !== marker(다른 prefix)이면서 동일 run-token 공유·run 분포 변별(run 을 바꾸면 두 분기 title 이 함께 변하되 여전히 상호 byte-identical)·leg outcome/overallStatus 무관 title 안정·negative(값 drift·guard·상류 차단·결정론/no-mutation/credential) 다수) test-dominated ~330 LOC. 형제 T-0928(create-branch marker cross-call)·T-0929(update-branch marker cross-call)가 marker medium 두 action 분기 cross-call 을 닫았으나 title medium 의 두 action 분기(create argv `--title` + update argv `--title`) single-source 관통은 미결합(T-0916 은 descriptor 수준 title·marker identity-side 공유 run-token 만·argv 하류 관통 미단언). 본 task 가 그 title cross-branch seam 봉합. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0928/T-0929(marker cross-call) 종결 후 title medium 의 두 action 분기 argv single-source 관통 gap. create argv `--title`(빈 search) ↔ update argv `--title`(hit) 이 단일 descriptor.title 로부터 byte-identical. dep [] file-disjoint stage5b 병렬.
---

# T-0930 — realdata-e2e dual-leg run report title cross-branch single-source convergence non-gated smoke

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 멱등 박제) chain 의 **title medium 이 두 action 분기(create / update) 의 gh argv 로 단일 source 관통하는 seam** 이 아직 어떤 smoke 에도 chain 그물로 묶이지 않았다. step④ 의 rolling-issue 박제는 검색 결과에 따라 두 action 분기로 갈린다:

- **create 분기** — 빈 search(`"[]"`, marker 미매칭) → action `{action:"create"}` → 종단 컴포저가 `["issue","create","--title", createArgs.title, "--body", ...]` argv 산출. `createArgs.title` = `descriptor.title`.
- **update 분기** — marker-매칭 hit(1+건) → action `{action:"update", issueNumber:N}` → 컴포저가 `["issue","edit",String(N),"--title", updateArgs.title, "--body", ...]` argv 산출. `updateArgs.title` = `descriptor.title`.

즉 **어느 action 분기로 가든 이슈 제목(`--title` 원소)은 동일 `descriptor.title` 단일 source 로부터 byte-identical 하게 나와야** step④ 의 rolling-issue 안정성(REQ-009 — "동일 run 의 이슈"가 create/update 어느 경로로도 같은 제목으로 수렴)이 성립한다: 오늘 밤 run 이 이슈를 새로 만들 때(create)와 내일 밤 run 이 그 이슈를 갱신할 때(update)의 `--title` 이 동일해야 사람이 rolling-issue 를 한 제목으로 인지한다. 만약 create title 과 update title 이 어긋나면(silent drift) — 갱신마다 제목이 흔들려 이슈 목록에서 동일 run 을 추적하기 어려워진다.

그러나 이 **title 의 두 action 분기 argv single-source 관통** 은 어느 smoke 도 chain 그물로 검증하지 않는다:

- 형제 T-0916(descriptor identity-side confluence)은 **descriptor 수준** 에서 `descriptor.title` 와 `descriptor.marker` 가 동일 run-token(`${dateToken}@${gitSha}`)을 공유함(서로 다른 prefix·leg outcome 무관·run 별 변별)만 자산화한다 — title 이 **하류 commandArgs → gh argv 의 `--title` 원소로 관통** 함(create/update 두 분기 byte-identical)은 미단언. descriptor 문자열 정체성 축과 argv 관통 축은 다르다.
- 형제 T-0928(create-branch marker cross-call)·T-0929(update-branch marker cross-call)는 **marker medium** 의 두 gh 호출 사이 관통만 자산화한다 — title medium 은 다루지 않는다.
- 형제 T-0927(gh-command-plan argv single-source)은 plan.argv 가 single-source gh-argv 빌더 산출과 byte-identical 함(각 분기 내부 argv 정합)만 자산화한다 — create title 과 update title 이 **서로** byte-identical 함(cross-branch title 수렴)은 미단언(분기별 독립 대조라 두 분기 title 을 서로 대조하지 않음).

본 task 는 그 **title cross-branch seam** 을 닫는다 — T-0928/T-0929(marker cross-call, medium=marker)의 **title medium 대칭 sibling(축=cross-branch)**. chain: 두 leg outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, (1) 빈 search(`"[]"`)에 종단 컴포저를 적용해 create-branch plan 을, (2) marker-매칭 hit stdout 에 적용해 update-branch plan 을 각각 산출한 뒤, **create-branch plan.argv 의 `--title` 다음 원소 와 update-branch plan.argv 의 `--title` 다음 원소 가 둘 다 `descriptor.title` 와 byte-identical** 함을 박제한다.

issue-still-relevant 확인(2026-07-12): dual-leg smoke 중 파일명·본문에 `title` + `cross-branch`(create/update 두 argv) single-source 수렴을 결합한 것 = **0개**(`grep -i dual-leg-run-report | grep -i title` → 0). `descriptor.title`(T-0896)·`createArgs.title`/`updateArgs.title`(T-0897)·종단 컴포저 create/update 분기 argv(T-0899/T-0902) 배선은 이미 main 에 박제됨 — 본 task 는 그 배선을 **다시 만들지 않고** 두 action 분기에서 title 이 동일 source 로부터 관통함을 대조하는 **smoke 그물만** 신설. `git log origin/main` 동일 영역(dual-leg title cross-branch 수렴 smoke) 박제 commit 0. T-0928/T-0929 이 marker medium 을 닫았으므로 본 task 로 두 rolling-issue medium(marker / title)의 두 action 분기 관통이 모두 봉합된다.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0929-realdata-e2e-dual-leg-run-report-update-branch-marker-cross-call-single-source-convergence-smoke.md` — **직전 형제(marker medium, 1순위 템플릿)**. chain assembler(두 leg outcome + run → report → descriptor → commandArgs → 컴포저 두 분기)·synthetic 빌더·import 경로 규약·describe 구조·한국어 헤더 주석·negative 접근·hit stdout literal 주입·빈 search 격리 mirror. 본 task 는 그 **marker cross-call** 축(검색 marker ↔ body 선두 marker) 자체 재단언 금지 — 초점을 medium=marker 에서 **medium=title, 축=cross-branch(create argv `--title` ↔ update argv `--title` single-source byte-identical)** 로 이동.
- `docs/tasks/T-0916-realdata-e2e-dual-leg-run-report-descriptor-identity-confluence-smoke.md` — **descriptor-수준 형제(재단언 금지 대상)**. `descriptor.title` vs `descriptor.marker` identity-side(공유 run-token·title!==marker·leg outcome 무관·run 변별) 자체 재단언 금지 — 본 task 는 그 title 이 **하류 create/update argv 의 `--title` 원소로 관통** 함만. title!==marker 대조는 descriptor 수준이 아니라 argv 원소 수준에서 참고.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — **본 task 핵심 대상 (title single source)**. `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` → `{title, marker, body}`. `title = ${ISSUE_TITLE_PREFIX} ${token}`(token = `${dateToken}@${gitSha}`), marker 는 별도 prefix(`title !== marker`). guard: gitSha/dateToken 빈-공백 → throw(chain 상류 차단 negative 용). title 은 동일 run → 동일(leg status/overallStatus 무관).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)` → `{searchQuery, createArgs{title(=descriptor.title), body, labels}, updateArgs{title(=descriptor.title), body}}`. `createArgs.title` 와 `updateArgs.title` 가 **둘 다 descriptor.title 로부터 파생**(single source 대조 원천). guard: title/body 빈-공백 → throw. 형식 재단언 금지 — 조립 입력·title source 대조에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — **종단 컴포저**. `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → `{action, argv}`. 빈/marker-미매칭 stdout → create 분기 argv `["issue","create","--title",createArgs.title, ...]`, marker-매칭 hit stdout → update 분기 argv `["issue","edit",String(N),"--title",updateArgs.title, ...]`. `--title` 다음 원소 = title. 컴포저 본문·3단계 위임 배선 재단언 금지 — chain 통과 plan.argv 산출에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` — **argv 빌더(두 분기 title index 확인용)**. create 분기 → `["issue","create","--title",createArgs.title,"--body",createArgs.body, ...]`(`--title` = index 2, title = index 3). update 분기 → `["issue","edit",String(issueNumber),"--title",updateArgs.title,"--body",updateArgs.body]`(`--title` = index 3, title = index 4). guard: title/body 빈-공백 → throw. 형식 재단언 금지(T-0927 cover) — title 원소 추출에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, marker)` → `{action:"create"}` | `{action:"update", issueNumber}`. marker-매칭 hit 1+ → update, 빈/미매칭 → create. issueNumber 해석 재단언 금지 — 두 분기 진입 통과에만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}(synthetic literal 원천). leg status/overallStatus 를 바꿔도 title 불변(안정성) negative 조립용.
- `test/jest-smoke.json` — smoke jest config(`testRegex: ".*\\.smoke-spec\\.ts$"` 가 본 신규 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-title-cross-branch-single-source-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / search stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / `gh issue create|edit|search` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). title 은 chain 산출물(descriptor.title / create argv 원소 / update argv 원소)에서 추출해 대조 — literal 하드코딩 최소. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·`execFile` 0·네트워크 0·DB 0·title 이 두 action 분기(create argv `--title` + update argv `--title`) 로 관통하는 절단면·`--title` 다음 원소 추출·동일 descriptor.title byte-identical·REQ-009 멱등 근거/REQ-032/REQ-059 raw 미저장·형제 T-0928/T-0929 marker cross-call 과의 차별=medium 이 marker 가 아니라 title·형제 T-0916 descriptor identity 와의 차별=descriptor 수준 title·marker 공유가 아니라 title 의 하류 argv 두 분기 관통·형제 T-0927 gh-command-plan argv 와의 차별=분기별 내부 정합이 아니라 create title↔update title 상호 byte-identical) 작성.

- [ ] **Happy-path title cross-branch 수렴 test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. chain: report → descriptor → commandArgs 통과. (1) 빈 search stdout(`"[]"`)에 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` → create plan(plan.action.action === "create", plan.argv[0..1] === ["issue","create"]), (2) marker-매칭 hit stdout(`JSON.stringify([{"number":N,"title":descriptor.title,"body":descriptor.body}])`)에 → update plan(plan.action.action === "update", plan.action.issueNumber === N). create plan.argv 의 `--title` 다음 원소(createTitle = `argv[argv.indexOf("--title")+1]`) 와 update plan.argv 의 `--title` 다음 원소(updateTitle) 가 **둘 다 `descriptor.title` 와 byte-identical**(`===`) 함을 각각 대조 1+ test. AND 두 title 이 서로 byte-identical(`createTitle === updateTitle`) 1+.
- [ ] **title 등장 지점 유일성 test 1+** — 두 분기 산출물에서 title 은 정확히 각 argv 의 `--title` 다음 1원소로만 온전한 형태로 등장하고, 다른 원소(create: `issue`/`create`/`--body`/body/`--label` 등, update: `issue`/`edit`/`String(N)`/`--body`/body)에는 title 온전체 부재를 각 1+ test. AND `title !== marker`(create/update argv 의 title 원소 ≠ descriptor.marker — 서로 다른 prefix)이면서 title·marker 가 동일 run-token(`${dateToken}@${gitSha}`)을 공유(공유 substring)함을 각 1+ test(medium 구별 + 공유 source).
- [ ] **run 분포 변별 test 1+ (두 분기 동반 변화 + 여전히 상호 byte-identical)** — 서로 다른 run(run A: gitSha/dateToken, run B: 다른 gitSha 또는 dateToken)으로 각각 chain 을 돌려 (i) run A 의 (createTitle_A, updateTitle_A) 는 서로 byte-identical, run B 의 (createTitle_B, updateTitle_B) 도 서로 byte-identical, (ii) run A ≠ run B 이면 createTitle_A !== createTitle_B AND updateTitle_A !== updateTitle_B(두 분기 title 이 run 에 따라 **함께** 변함) 를 각 1+ test(title 이 run-token 단일 source 로부터 두 분기에 동반 관통함을 박제).
- [ ] **leg outcome 무관 title 안정 test 1+** — 동일 run 으로 leg outcome(예: eval leg passed true→false, collect leg action 변경, overallStatus 변동)을 바꿔도 createTitle 와 updateTitle 가 서로 byte-identical 하고 두 값 모두 leg outcome 변경 전과 동일함(title 은 run-token 만의 함수) 1+ test(멱등 근거 — 같은 run 은 leg status 무관 동일 제목으로 수렴).
- [ ] **single-source 독립 재유도 test 1+** — 컴포저 재호출 없이 별도로 `descriptor.title` 를 진실의 원천으로 삼아, createTitle 와 updateTitle 가 그 descriptor.title 와 각각 deep-equal 함을 단언 1+ test(두 분기 title 이 하드코딩이 아니라 descriptor.title 파생임 반영). **결정론** — 동일 입력(+ 동일 hit stdout) 두 번 chain → 두 (createTitle, updateTitle) 쌍 deep-equal(byte-identical) 1+.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) create title drift 검출 — chain 산출 create plan.argv 를 복제해 `--title` 원소를 변형한 synthetic argv 의 title 이 update plan.argv 의 title 과 `!==`(cross-branch byte-identical 위반 검출) 1+ test.
  - (b) update title drift 검출 — update plan.argv 의 `--title` 원소를 복제해 token 한 글자 변경한 synthetic title 이 create plan.argv 의 title 과 `!==` 1+ test.
  - (c) descriptor guard 상류 차단(title 미산출) — run.gitSha(또는 dateToken)가 빈/공백이면 `buildRealDataDailyStepDualLegRunReportIssueDescriptor` guard throw 로 title·marker·body 자체가 산출되지 않아 chain 조립이 차단됨(비식별 제목으로 이슈 생성/갱신이 새는 것 차단) 1+ test. `expect(() => 조립체인).toThrow()`.
  - (d) commandArgs/argv 빌더 guard 상류 차단 — commandArgs 의 createArgs.title(또는 updateArgs.title)이 빈/공백인 commandArgs 를 컴포저에 넣으면(또는 gh-argv 빌더에 직접 넣으면) title guard throw 로 argv 미산출(빈 제목 이슈 사고 차단) 1+ test. `expect(() => ...).toThrow()`.
  - (e) 컴포저 파서 guard 상류 차단(update 분기 argv 미산출) — 컴포저에 비-JSON(`"{"`)/비배열 JSON(`"{}"`)/number 비양수 hit(`[{"number":0,...}]`) stdout 을 넣으면 파서/빌더 throw 가 컴포저로 전파돼 update plan(및 title argv) 미산출(손상 plan 이 live wiring 으로 새는 것 차단) 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (leg outcome, run, hit stdout) 로 chain 을 두 번 실행 → 두 (create plan.argv, update plan.argv) 가 deep-equal(byte-identical) 이며 서로 다른 배열 인스턴스(무공유) 1+ test. AND chain 호출이 commandArgs(중첩 createArgs/updateArgs 포함) 및 run 을 mutate 0(호출 전후 `JSON.parse(JSON.stringify(...))` snapshot deep-equal) 1+ test.
- [ ] **raw / credential 누출 0 test 1+** — create·update plan.argv 의 어느 원소도 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘를 담지 않음(정규식/`not.toContain`, R-59 / REQ-059) 1+ test. title(=`--title` 원소)이 안정 run-token(`${dateToken}@${gitSha}` + 고정 prefix)만 담고 raw 활동 narrative 본문·credential 미포함 1+. descriptor/argv guard throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(필드명·유효성만) 을 negative case 에서 확인 1+.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- descriptor(`...-issue-descriptor.ts`) / command-args 빌더(`...-issue-command-args.ts`) / gh-argv 빌더(`...-issue-gh-argv.ts`) / gh-command-plan 컴포저(`...-issue-gh-command-plan.ts`) / action resolver **본문 변경 금지** — import·호출만. 각 배선(title 합성·descriptor.title→createArgs/updateArgs.title·title→argv 원소·컴포저 3단계 위임)은 **이미 main 에 T-0896~T-0902 로 박제됨** — 재배선 금지, chain 통과 산출물의 title 을 대조하는 smoke 그물만.
- 형제 T-0928/T-0929 의 **marker cross-call(검색 marker ↔ body 선두 marker) single-source 수렴 축** 재단언 금지 — 본 task 는 medium 이 marker 가 아니라 **title**, 축이 두 gh 호출(search+create/edit)이 아니라 **두 action 분기(create argv ↔ update argv)**.
- 형제 T-0916 의 **descriptor 수준 title·marker identity-side(공유 run-token) confluence 축** 재단언 금지 — 본 task 는 descriptor 문자열 정체성이 아니라 title 의 **하류 create/update argv `--title` 원소 관통(single-source cross-branch)**.
- 형제 T-0927 의 **gh-command-plan create/update argv single-source byte-identical(분기별 내부 정합) 축** 재단언 금지 — 본 task 는 분기별 내부 정합이 아니라 **create title ↔ update title 상호 byte-identical(두 분기 간 대조)**.
- 형제 T-0920 의 edit-argv issueNumber·T-0921 의 marker⊥issueNumber 직교·T-0919 의 search-argv marker 4-boundary·T-0922 의 re-publish idempotency·T-0924/25/26 의 value-consistency 축 자체 재단언 금지.
- descriptor body 의 markdown 본문·marker 라인·issueNumber 해석·labels 형식 재단언 금지 — 각 helper/smoke 가 이미 cover. 본 task 는 title 원소(create·update 두 분기) single-source 수렴만.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github·실 gh `execFile('gh', argv)`·`gh issue create|edit`/`gh search issues`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). gitSha/dateToken·leg outcome·search stdout·N 은 synthetic literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 두 leg outcome + run → report → descriptor → commandArgs 를 통과시켜 유효 commandArgs 를 얻고, 종단 컴포저를 (1) 빈 search `"[]"` 로 create plan, (2) marker-매칭 hit stdout(`[{"number":N,"title":descriptor.title,"body":descriptor.body}]`) 로 update plan 을 각각 산출한 뒤, create plan.argv 와 update plan.argv 에서 `--title` 다음 원소를 추출해 둘 다 `descriptor.title` 와 byte-identical 함을 대조하는 합성 smoke 작성. 핵심: 두 분기 title 상호 byte-identical·title 등장 지점 유일성(각 argv `--title` 다음 1원소)·title!==marker+공유 run-token·run 분포 변별(run 을 바꾸면 두 분기 title 동반 변화 + 여전히 상호 identical)·leg outcome 무관 title 안정·create/update title drift `!==` 검출·descriptor/argv/파서 guard 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. create argv 의 `--title`=index 2·title=index 3, update argv 의 `--title`=index 3·title=index 4 임을 유의하되 `indexOf("--title")+1` 로 위치 무관 추출 권장 — 축은 title 의 두 action 분기 단일 source 관통.)

## Follow-ups

(없음 — title cross-branch single-source 수렴이 봉합되면 dual-leg run report step④ 의 두 rolling-issue medium(marker: T-0928/T-0929 두 gh 호출 관통, title: 본 task 두 action 분기 관통)이 모두 chain 그물에 편입. 잔여는 step④ live wiring(credential gate deferred, ADR-0045 LAN gate) — 다음 turn 의 planner 가 PLAN 재평가로 판단)
