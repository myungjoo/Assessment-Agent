---
id: T-0924
title: realdata-e2e dual-leg run report publish chain 을 create/edit stdout 까지 통과시켜 파서 산출 outcome({issueNumber,url}) 전체 값이 raw stdout 으로부터 single-source 독립 재유도한 expected 와 deep-equal 정합함을 assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(T-0906 가드)로 박제하는 post-execution output↔stdout value-consistency convergence non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-output-stdout-value-consistency-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-output-value-consistency-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — post-execution output↔stdout value-consistency(값-정합 재유도) sweep(chain 을 create/edit stdout 까지 통과시켜 파서 산출 outcome 의 issueNumber·url 전체 값이 raw stdout 으로부터 독립 재유도한 expected 와 deep-equal·create/edit 두 경로 동형·issueNumber/url 값-threading·guard TypeError↔RangeError 분기(구조결손/URL미발견/비양정수/값 drift/잉여필드)·descriptor guard·output-parse throw 상류 차단·결정론/no-mutation/credential negative 다수) test-dominated ~290 LOC. 직전 형제 T-0923 은 key-set shape(set-equality) 축만 닫았고 value-consistency seam(T-0906 가드, assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout)은 어느 smoke 도 미참조 — 본 task 가 그 마지막 미커버 값-정합 helper 를 chain 그물로 봉합. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0923 key-set shape 종결 후 T-0906 output-consistency 값-정합 가드가 smoke 0 참조인 마지막 seam gap. summary 축 T-0723 mirror. dep [] file-disjoint stage5b 병렬.
---

# T-0924 — realdata-e2e dual-leg run report output↔stdout value-consistency convergence non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 박제) chain 의 **마지막 미봉합 절단면 — post-execution output↔stdout 값-정합(single-source 독립 재유도) seam** 이 아직 어떤 smoke 에도 묶이지 않았다. `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.ts`(T-0906 신설) 는 파서(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`, T-0903)가 산출한 outcome `{issueNumber, url}` **전체 값**이 raw `gh issue create`/`gh issue edit <n>` stdout 으로부터 **컴포저 재호출 없이 독립 재유도**(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 → URL 전체 trim → `{issueNumber, url}` 정규화)한 expected 와 deep-equal 정합한지 검증하는 순수 가드다. 그러나 `git grep` 결과 이 가드(`assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout`)를 참조하는 smoke 파일은 **0개** — dual-leg run report helper 중 유일하게 build-time smoke 그물에 미포함된 seam 이다.

직전 형제 T-0923 은 **키 집합(shape)** 축만 닫았다:

- **T-0923** (outcome-parse-shape convergence) — 파서 산출 outcome 의 own-key 집합이 선언 parse-shape 키 집합(`REAL_DATA_..._PARSE_SHAPE_KEYS = ["issueNumber","url"]`)과 set-equal 인지 **키 집합**만 검증. 그 Out of Scope 가 "outcome 값-정합 재유도(summary 축 T-0723/T-0724 mirror)·url 본문 byte 대조 — url 본문 정합은 별도 축" 으로 값-정합 축을 명시 defer 했다.

즉 **set-equality 가드는 키 집합만 보므로 issueNumber/url 값이 drift 하거나 잘못된 매칭 URL 이 선택돼도 통과한다** — 파서가 silent 하게 잘못된 `issueNumber`(예: 첫 매칭이 아닌 URL 선택) 또는 잘못 trim 된 `url` 을 산출하는 회귀는 T-0923 형제 smoke 로 잡히지 않는다(outcome 의 값을 raw stdout 으로부터 독립 재유도해 deep-equal 대조하는 단언이 어느 smoke 에도 없으므로). 본 task 는 `report → descriptor → commandArgs → searchArgv → resolve → gh-argv → create/edit stdout → output-parse → outcome` chain 을 **outcome 산출까지 통과**시킨 뒤, 그 outcome 의 `{issueNumber, url}` **전체 값**이 raw create/edit stdout 으로부터 single-source 재유도한 expected 와 deep-equal 정합함을 T-0906 가드(`assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout`)로 박제한다 — summary 축 T-0723(`assertRealDataResultIssueOutputConsistentWithStdout`) value-consistency 커버리지의 dual-leg mirror.

issue-still-relevant 확인(2026-07-12): `git grep -l "OutputConsistentWithStdout" -- test/smoke/*` = **0 hit**. `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout` 를 참조하는 smoke 파일 0 — dual-leg run report helper 중 유일 미커버 value-consistency seam. 가드 helper 자체(T-0906)와 파서 self-wire(T-0907, output-parse.ts line 162~)는 이미 main 에 박제됨 — 본 task 는 그 self-wire 를 **다시 배선하지 않고** chain 을 통과한 outcome 을 가드로 검증하는 **smoke 그물만** 신설. `git log origin/main` 동일 영역(output-consistency smoke) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0923-realdata-e2e-dual-leg-run-report-outcome-parse-shape-convergence-smoke.md` — 직전 형제. chain assembler·synthetic 빌더(searchStdout·execStdout)·import 경로 규약·describe 구조·한국어 헤더 주석 mirror 1순위 템플릿. 본 task 는 그 **key-set shape(set-equality) 자체 재단언 금지** — 초점을 키 집합에서 **파서 산출 outcome 의 issueNumber·url 전체 값 ↔ stdout 독립 재유도 deep-equal** 로 이동.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.ts` — **본 task 핵심 대상**. `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout): void`. stdout 만으로 expected 를 독립 재유도(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양정수 → URL 전체 trim → `{issueNumber, url}`) 후 산출 outcome 과 deep-equal 대조. 에러 정책: 구조 결손(outcome 비-non-null-객체/배열·stdout 비-string·URL 미발견·`<number>` 비양정수)=TypeError, 값 정합 위반(issueNumber/url 값·추가필드 drift)=RangeError. 정합이면 void, 부정합이면 throw. 컴포저 재호출 0(독립 재유도 핵심).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `RealDataDailyStepDualLegRunReportIssueOutcome {issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`) throw·raw 미저장(R-59). create-exec·edit-exec 두 stdout 모두 동일 `{issueNumber, url}` outcome 산출. line 146~164 에 이미 self-wire(shape 가드 T-0905 + consistency 가드 T-0907) 된 상태 — 본 smoke 는 chain 통과 outcome 을 consistency 가드로 재검증.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary `{title, marker, body}`, marker = private prefix + `${report.dateToken}@${report.gitSha}`. gitSha/dateToken 빈/공백 → 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → `searchQuery === descriptor.marker` 운반 layer.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → search argv. 형식 재단언 금지 — chain 조립 입력으로만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — searchStdout JSON 배열(`[{"number":N,...,"body":<marker 포함>}]`) synthetic 합성용. 빈 hit(`"[]"`)=create 경로, number=M hit=update 경로.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`. 빈 hit → create 분기, hit 1+ → update 분기.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` / `...-issue-action.ts` — argv 빌더·action narrowing. 형식 재단언 금지 — chain 조립용.
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-output-stdout-value-consistency-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). outcome 은 chain 산출(파서 결과)에서 얻어 가드에 create/edit stdout 과 함께 넣는다 — 값 drift negative 는 chain 산출 outcome 을 복제·변형한 synthetic outcome 으로 주입(literal 하드코딩 최소). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·output producer↔raw stdout 값-정합 절단면·single-source 독립 재유도 deep-equal·REQ-032 raw 미저장/REQ-059·형제 T-0923 과의 차별=키 집합이 아니라 issueNumber/url 전체 값 축) 작성.

- [ ] **Happy-path create-exec value-consistency test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. chain: `report → descriptor → commandArgs → searchArgv → searchStdout(빈 hit "[]") → plan(create) → gh-argv` 통과 후 create-exec stdout(`https://github.com/owner/repo/issues/M`) 에 `parse...IssueCreateEditOutput` 적용 → outcome. `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, createExecStdout)` 가 **throw 없이 void**(값-정합) 임을 `expect(() => ...).not.toThrow()` 로 1+ test. AND outcome 의 `issueNumber === M` 및 `url === "https://github.com/owner/repo/issues/M"`(create-exec stdout 이 담은 URL 전체) 직접 대조 1+.
- [ ] **Happy-path edit-exec value-consistency 동형 test 1+ (create/edit 두 경로 동형)** — 동일 run·동일 leg 로 update 경로 chain(`searchStdout` number=M hit → plan(update) → gh-argv → edit-exec stdout `.../issues/M`) → outcome. 그 outcome 도 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, editExecStdout)` 가 void(값-정합) AND edit-exec outcome 의 `{issueNumber, url}` 값이 create-exec outcome 과 동일(두 실행 경로가 같은 이슈 M 을 겨눠 같은 값 산출) 1+ test.
- [ ] **issueNumber/url 값-threading 단언 test 1+ (outcome 이 chain target 과 수렴)** — update 경로에서 `outcome.issueNumber === M`(search-hit number = resolve 가 좁힌 `plan.action.update.issueNumber` = editArgv[2] 의 String 원본) AND create/update 두 경로 모두 `outcome.url` 이 해당 exec stdout 의 첫 매칭 issue URL 전체(trim)와 byte-identical 1+ test. 즉 value-consistency 는 키 집합뿐 아니라 outcome 이 chain 이 겨눈 바로 그 이슈의 issueNumber·url 값을 담음을 함께 박제.
- [ ] **single-source 독립 재유도 단언 test 1+** — 동일 create/edit stdout 에서 컴포저 재호출 없이 별도로 첫 매칭 issue URL 을 뽑아(`https://github.com/<owner>/<repo>/issues/<number>` 정규 규약) 산출한 expected `{issueNumber, url}` 이 chain 산출 outcome 과 deep-equal 임을 단언 1+ test(가드가 stdout 을 진실의 원천으로 삼음을 반영 — 하드코딩 대신 stdout 파생). **첫 매칭 우선 결정론** — stdout 에 issue URL 이 두 개(`.../issues/M` 다음 `.../issues/K`, K≠M) 담긴 경우 outcome·재유도 expected 모두 첫 매칭 M 을 취함을 확인 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) issueNumber 값 drift(RangeError) — chain 산출 outcome 을 spread 복제해 `issueNumber` 를 M+1 등 stdout 과 다른 값으로 변형 → `assert...OutputConsistentWithStdout(mutated, execStdout)` 가 **RangeError**(값 정합 위반) throw 1+ test. `expect(...).toThrow(RangeError)`.
  - (b) url 값 drift(RangeError) — outcome 복제 후 `url` 을 stdout 의 URL 과 다른 문자열(다른 issue 번호/호스트/미trim 공백)로 변형 → guard RangeError 1+ test.
  - (c) 잉여 필드 drift(RangeError) — outcome 복제 후 `htmlUrl`(또는 `token` 같은 credential-형 키) 1개 추가 → guard RangeError(추가필드 drift) 1+ test.
  - (d) 구조 결손(TypeError) — outcome=null / undefined / 숫자·문자열(비객체) / 배열 각각, 그리고 stdout=비-string(number/null) → guard **TypeError** 1+ test(값 정합 위반 RangeError 와 분리; 최소 outcome null·비객체·배열 + stdout 비-string 4종).
  - (e) stdout 재유도 단계 구조 결손(TypeError) — 정상 outcome 을 넘기되 stdout 이 issue URL 미발견(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 경로) 또는 `<number>` 비양정수(`/issues/0`·선행 0·`/issues/abc`) → 재유도 자체 불가로 guard TypeError 1+ test(URL-미발견 분기와 비양정수 분기 분리).
  - (f) chain-상류 차단 — `run.gitSha` 빈/공백 → descriptor(stage 1) guard throw 로 outcome 산출 자체 차단 1+ test; create/edit-exec stdout 이 issue URL 미발견 또는 issueNumber 비양수 → `parse...IssueCreateEditOutput` throw 로 outcome 미산출(잘못된 outcome 이 value-consistency 가드에 도달하는 것 자체 차단) 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, execStdout) 로 chain→outcome→guard 를 두 번 실행 → 두 outcome deep-equal(byte-identical) 1+ test. AND guard 호출이 outcome·stdout 을 mutate 0(호출 전후 `JSON.parse(JSON.stringify(outcome))` snapshot deep-equal, stdout 문자열 불변 확인) 1+ test.
- [ ] **raw / credential 누출 0 test 1+** — chain 산출 outcome 의 own key 집합이 정확히 `{issueNumber, url}` 뿐이며 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘를 키/값 어디에도 담지 않음(정규식/`not.toContain`, R-59 / REQ-059). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 outcome.url/issueNumber 및 값-정합 재유도에 sentinel 미누출 1+ test. 가드 throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(issueNumber·url 값만 노출)을 negative case 에서 확인 1+.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- 파서(`...-issue-output-parse.ts`) / `RealDataDailyStepDualLegRunReportIssueOutcome` interface / `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout` 가드 **본문 변경 금지** — import·호출만. 가드의 producer self-wire(파서 산출 직전 가드 호출 배선)는 **이미 main 에 T-0907 로 박제됨** — 재배선 금지, chain 통과 outcome 검증 smoke 그물만.
- 형제 T-0923 의 **key-set shape(set-equality) 축**(outcome own-key set ↔ `REAL_DATA_..._PARSE_SHAPE_KEYS`) 자체 재단언 금지 — 본 task 는 issueNumber/url **전체 값** ↔ stdout 독립 재유도 deep-equal 축만. 잉여-key set-equality 재단언 대신 값-drift(RangeError) 축으로 접근.
- 형제 T-0918~T-0922 의 pre→resolve→post argv 절단면·create→update 상태 전이·idempotency·dual-medium 직교 자체 재단언 금지 — searchArgv 원소 순서/`--match body`/`--limit`·gh-argv 의 `--title`/`--body`/labels 형식 재단언 금지(각 가드 cover).
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github publish 부작용·실 gh `execFile('gh', argv)`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). create/edit-exec 의 URL·M 은 synthetic stdout literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs → searchArgv → resolve → gh-argv → create/edit stdout → output-parse 를 outcome 산출까지 통과시킨 뒤 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, execStdout)` 로 값-정합을 박제하는 합성 smoke 작성. 핵심: create/edit 두 경로 outcome 값이 각 exec stdout 첫 매칭 issue URL 과 deep-equal·issueNumber 가 chain target M 과 수렴·url byte-identical(trim)·값 drift(issueNumber/url/잉여필드)는 RangeError·구조결손(outcome 비객체/stdout 비-string/URL 미발견/비양정수)은 TypeError 분리·descriptor guard·output-parse throw 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. 가드가 stdout 만으로 expected 를 독립 재유도(컴포저 재호출 0)함을 유의 — 값 축은 issueNumber·url 둘 다.)

## Follow-ups

(없음 — output-consistency 가드가 이미 self-wire(T-0907) 돼 있고 본 smoke 로 chain-그물 커버까지 닫히면 dual-leg run report publish chain 의 build-time seam 은 전량 봉합. 잔여는 step④ live wiring(credential gate deferred) — 다음 turn 의 planner 가 PLAN 재평가로 판단)
