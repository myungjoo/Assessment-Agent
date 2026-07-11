---
id: T-0923
title: realdata-e2e dual-leg run report publish chain 을 create/edit stdout 까지 통과시켜 산출된 outcome({issueNumber,url})의 own 키 집합이 선언 parse-shape 키 집합과 set-equal 로 수렴함을 assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(T-0904 가드)로 박제하는 post-execution outcome producer↔declared-shape parse-shape convergence non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-outcome-parse-shape-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-outcome-parse-shape-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — post-execution outcome producer↔declared-shape parse-shape convergence sweep(chain 을 create/edit stdout 까지 통과시켜 파서 산출 outcome 의 own 키 집합 ↔ REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS set-equality·create/edit 두 경로 동일 shape·issueNumber 값-threading·guard TypeError↔RangeError 분기(누락/잉여/빈-shape/중복-key/빈-outcome-key)·descriptor guard·output-parse throw·결정론/no-mutation/credential negative 다수) test-dominated ~290 LOC. 형제 T-0918~T-0922 는 pre→resolve→post argv/idempotency 절단면만 닫았고 outcome-parse-shape seam(T-0904 가드)은 어느 smoke 도 미참조 — 본 task 가 그 마지막 미커버 helper 를 chain 그물로 봉합. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0918~0922 pre→resolve→post/idempotency 종결 후 T-0904 outcome-parse-shape 가드가 smoke 0 참조인 마지막 seam gap. summary 축 T-0661 mirror. dep [] file-disjoint stage5b 병렬.
---

# T-0923 — realdata-e2e dual-leg run report outcome↔parse-shape convergence non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 박제) chain 의 **가장 마지막 절단면 — post-execution outcome producer↔declared-shape seam** 이 아직 어떤 smoke 에도 묶이지 않았다. `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts`(T-0904 신설) 는 파서(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`, T-0903)가 산출한 outcome `{issueNumber, url}` 의 **own enumerable 키 집합**이 선언된 정규 parse-shape 키 집합(`REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = ["issueNumber","url"]`)과 정확히 set-equal 인지 검증하는 순수 가드다. 그러나 `git grep` 결과 이 가드·상수를 참조하는 smoke 파일은 **0개** — dual-leg run report helper 중 유일하게 build-time smoke 그물에 미포함된 seam 이다.

기존 형제 smoke 들은 outcome **직전** 까지만 chain 을 통과시켰다:

- **T-0918/T-0919/T-0920** (triple/4-boundary, execute-side) — descriptor→resolve→output-parse 로 `{issueNumber}` 값이 뽑히는 것까지는 단언하나, 그 산출 outcome 의 **키 집합이 선언 parse-shape 와 set-equal 인지**(즉 파서가 몰래 `htmlUrl` 같은 잉여 키를 흘리거나 interface 에 키가 추가돼 outcome 이 shape 을 벗어나는 회귀)는 검증하지 않는다.
- **T-0921/T-0922** (dual-medium orthogonal, re-publish idempotency) — create→update 상태 전이·매체 직교만. outcome shape 무결성 축과 직교.

즉 **outcome shape 회귀** — 파서 산출 outcome 이 선언된 `{issueNumber, url}` shape 을 (a) 키 누락(예: `url` drop)으로, 또는 (b) 잉여 키(예: `htmlUrl`/credential 필드 누출)로 벗어나는 — 는 public CI 에서 직접 발화되지 않고, 각 argv 절단면만 통과하는 기존 smoke 로는 잡히지 않는다(outcome 의 own-key set 을 declared shape 과 대조하는 단언이 어디에도 없으므로). 본 task 는 `report → descriptor → commandArgs → searchArgv → resolve → gh-argv → create/edit stdout → output-parse → outcome` chain 을 **outcome 산출까지 통과**시킨 뒤, 그 outcome 의 키 집합이 `REAL_DATA_..._PARSE_SHAPE_KEYS` 와 set-equal 임을 T-0904 가드(`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape`)로 박제한다 — summary 축 T-0661(`assertRealDataResultIssueOutcomeMatchesParseShape`) parse-shape 커버리지의 dual-leg mirror.

issue-still-relevant 확인(2026-07-11): `git grep -l "dual-leg-run-report-issue-outcome-parse-shape" -- test/smoke/*` = **0 hit**. `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape` / `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 를 참조하는 smoke 파일 0 — dual-leg run report helper 중 유일 미커버 seam. `git log origin/main` 동일 영역(outcome-parse-shape convergence) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0922-realdata-e2e-dual-leg-run-report-republish-create-update-idempotency-smoke.md` — 직전 형제. chain assembler·synthetic 빌더(searchStdout·execStdout)·import 경로 규약·describe 구조·한국어 헤더 주석 mirror 1순위 템플릿. 본 task 는 그 create→update 상태 전이/idempotency **자체 재단언 금지** — 초점을 argv/상태 전이에서 **파서 산출 outcome 의 own-key set ↔ 선언 parse-shape set-equality** 로 이동.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts` — **본 task 핵심 대상**. `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, parseShapeKeys): void` + `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = ["issueNumber","url"] as const`. 불변식 O0~O5(구조 온전 / parseShapeKeys 비-빈 / 빈·중복 key 부재 / outcome 빈 key 부재 / 누락 0(O4) / 잉여 0(O5)). 에러 정책: 구조 결손=TypeError, 값·의미 위반=RangeError. 정합이면 void, 부정합이면 동일 위치 throw. outcome 값(issueNumber/url 본문)은 미열람(키만 비교).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — 파서 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `RealDataDailyStepDualLegRunReportIssueOutcome {issueNumber, url}`. `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`) throw·raw 미저장(R-59). create-exec·edit-exec 두 stdout 모두 동일 `{issueNumber, url}` outcome 산출.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary `{title, marker, body}`, marker = private prefix + `${report.dateToken}@${report.gitSha}`. gitSha/dateToken 빈/공백 → 합성 측 guard throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → `searchQuery === descriptor.marker` 운반 layer.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → search argv. 원소 순서/`--match body`/`--limit` 형식 재단언 금지 — chain 조립 입력으로만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — searchStdout JSON 배열(`[{"number":N,...,"body":<marker 포함>}]`) synthetic 합성용. 빈 hit(`"[]"`)=create 경로, number=M hit=update 경로.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(searchStdout, commandArgs)` → `{action, argv}`. 빈 hit → create 분기, hit 1+ → update 분기.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` / `...-issue-action.ts` — argv 빌더·action narrowing. 형식 재단언 금지 — chain 조립용.
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-outcome-parse-shape-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / stdout literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). outcome 은 chain 산출(파서 결과)에서 얻어 가드에 넣는다 — 잉여/누락 negative 는 chain 산출 outcome 을 복제·변형한 synthetic outcome 으로 주입(literal 하드코딩 최소). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·outcome producer↔declared-shape parse-shape 절단면·set-equality·REQ-059 raw 미저장·형제 T-0918~T-0922 와의 차별=outcome own-key set 축) 작성.

- [ ] **Happy-path create-exec outcome convergence test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. chain: `report → descriptor → commandArgs → searchArgv → searchStdout(빈 hit "[]") → plan(create) → gh-argv` 통과 후 create-exec stdout(`https://github.com/owner/repo/issues/M`) 에 `parse...IssueCreateEditOutput` 적용 → outcome. `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS)` 가 **throw 없이 void** (set-equal) 임을 `expect(() => ...).not.toThrow()` 로 1+ test. AND `Object.keys(outcome).sort()` deep-equal `[...KEYS].sort()` (`["issueNumber","url"]`) 직접 대조 1+.
- [ ] **Happy-path edit-exec outcome 동일 shape test 1+ (create/edit 두 경로 동형)** — 동일 run·동일 leg 로 update 경로 chain(`searchStdout` number=M hit → plan(update) → gh-argv → edit-exec stdout `.../issues/M`) → outcome. 그 outcome 도 KEYS 와 set-equal(guard `not.toThrow`) AND `Object.keys(outcome)` 가 create-exec outcome 의 키 집합과 동일(두 실행 경로가 같은 `{issueNumber,url}` shape 산출) 1+ test.
- [ ] **issueNumber 값-threading 단언 test 1+ (outcome 이 chain target 과 수렴)** — update 경로에서 `outcome.issueNumber === M`(search-hit number = resolve 가 좁힌 `plan.action.update.issueNumber` = editArgv[2] 의 String 원본) AND create 경로에서 `outcome.issueNumber === M`(create-exec URL 의 M) 1+ test. 즉 parse-shape convergence 는 키 집합뿐 아니라 outcome 이 chain 이 겨눈 바로 그 이슈 번호를 담음을 함께 박제(값 축은 issueNumber 만 — url 본문 대조는 out-of-scope).
- [ ] **KEYS 상수 single-source 단언 test 1+** — `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 가 정확히 `["issueNumber","url"]`(길이 2·중복 0·빈 key 0) 이고, 이를 진실의 원천으로 삼아 chain 산출 outcome 과 set-equal 임을 단언 1+ test(하드코딩 배열 대신 상수 참조).
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) 잉여 키(O5) — chain 산출 outcome 을 spread 복제해 `htmlUrl`(또는 `token` 같은 credential-형 키) 1개 추가 → guard 가 **RangeError**(잉여 키 검출) throw 1+ test. `expect(...).toThrow(RangeError)`.
  - (b) 누락 키(O4) — outcome 복제 후 `url`(또는 `issueNumber`) 삭제 → guard RangeError(누락 키 검출) 1+ test.
  - (c) 구조 결손(O0) — outcome=null / undefined / 숫자·문자열(비객체) / 배열 각각 → guard **TypeError** 1+ test(값·정합 위반 RangeError 와 분리; 최소 null·비객체·배열 3종).
  - (d) parseShapeKeys 구조/의미 위반 — `null`/비배열/원소 비-string → TypeError; 빈 배열 `[]` → RangeError; 중복 key `["issueNumber","issueNumber"]` → RangeError; 빈/공백 key `["issueNumber",""]` → RangeError 각 1+ test.
  - (e) chain-상류 차단 — `run.gitSha` 빈/공백 → descriptor(stage 1) guard throw 로 outcome 산출 자체 차단 1+ test; create/edit-exec stdout 이 issue URL 미발견(빈/비-github/`/pull/`) 또는 issueNumber 비양수(`/issues/0`·선행0) → `parse...IssueCreateEditOutput` throw 로 outcome 미산출(잘못된 outcome 이 shape 가드에 도달하는 것 자체 차단) 각 1+ test(URL-미발견 분기와 비양수 분기 분리).
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, execStdout) 로 chain→outcome→guard 를 두 번 실행 → 두 outcome deep-equal(byte-identical) 1+ test. AND guard 호출이 outcome·`REAL_DATA_..._PARSE_SHAPE_KEYS` 를 mutate 0(호출 전후 `JSON.parse(JSON.stringify(...))` snapshot deep-equal, KEYS 는 `Object.isFrozen`/원소 불변 확인) 1+ test. AND 동일 outcome 을 서로 다른 두 parseShapeKeys 인스턴스(`["issueNumber","url"]` 새 배열)로 각각 guard 호출 시 둘 다 void — 참조 identity 무관 1+.
- [ ] **raw / credential 누출 0 test 1+** — chain 산출 outcome 의 own key 집합이 정확히 `{issueNumber, url}` 뿐이며 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN`/`narrative` 어휘를 키/값 어디에도 담지 않음(정규식/`not.toContain`, R-59 / REQ-059). synthetic leg outcome `specPath` 에 sentinel 을 넣어도 outcome.url/issueNumber 및 키 집합에 sentinel 미누출 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- 파서(`...-issue-output-parse.ts`) / `RealDataDailyStepDualLegRunReportIssueOutcome` interface / `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape` 가드 / `REAL_DATA_..._PARSE_SHAPE_KEYS` 상수 **본문 변경 금지** — import·호출만. 가드의 producer self-wire(파서 산출 직전 가드 호출 배선, summary 축 T-0662 mirror)는 후속 slice — 본 task 는 smoke 그물만.
- 형제 T-0918~T-0922 의 pre→resolve→post argv 절단면·create→update 상태 전이·idempotency·dual-medium 직교 **자체 재단언 금지** — 본 task 는 outcome own-key set ↔ declared parse-shape set-equality 축만. searchArgv 원소 순서/`--match body`/`--limit`·gh-argv 의 `--title`/`--body`/labels 형식 재단언 금지(각 가드 cover).
- outcome 값-정합 재유도(summary 축 T-0723/T-0724 mirror)·url 본문 byte 대조 — 본 task 는 키 집합(shape) + issueNumber 값-threading 만. url 본문 정합은 별도 축.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github publish 부작용·실 gh `execFile('gh', argv)`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). create/edit-exec 의 URL·M 은 synthetic stdout literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs → searchArgv → resolve → gh-argv → create/edit stdout → output-parse 를 outcome 산출까지 통과시킨 뒤 `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, REAL_DATA_..._PARSE_SHAPE_KEYS)` 로 set-equality 를 박제하는 합성 smoke 작성. 핵심: create/edit 두 경로 outcome 이 동일 `{issueNumber,url}` shape·issueNumber 가 chain target M 과 수렴·잉여(htmlUrl)/누락(url drop)/구조결손 negative 는 RangeError↔TypeError 분리·parseShapeKeys 빈/중복/빈-key RangeError·descriptor guard·output-parse throw 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. 가드가 outcome 값을 안 읽고 키만 비교함을 유의 — 값 축 단언은 issueNumber 만.)

## Follow-ups

(없음 — outcome-parse-shape 가드의 producer self-wire smoke(파서 산출 직전 가드 호출 배선 확인, summary 축 T-0662 mirror)가 자연 후속이면 다음 turn 의 planner 가 박제)
