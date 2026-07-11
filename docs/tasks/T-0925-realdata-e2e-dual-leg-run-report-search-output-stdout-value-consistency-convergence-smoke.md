---
id: T-0925
title: realdata-e2e dual-leg run report chain 을 search-leg stdout 까지 통과시켜 파서 산출 hits(number/title/body[]) 전체 값이 raw `gh search issues --json` stdout 으로부터 single-source 독립 재유도한 expected 배열과 deep-equal(개수·순서·필드값·추가필드 drop) 정합함을 assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(T-0908 가드)로 박제하는 search-output↔stdout value-consistency convergence non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-07-11T16:28:12Z
prNumber: 819
mergeCommit: 0f07ccf7
result: "PR #819 merged (squash 0f07ccf7), reviewer APPROVE round 1/7, 4-게이트 PASS. test-only +502/-0(1 file, production LOC 0), 18 smoke 격리 green. search-leg output↔stdout value-consistency seam(T-0908 가드) 봉합. 신규 dep 0, 중복 PR 0."
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-search-output-stdout-value-consistency-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-search-value-consistency-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — search-leg(입력측) parser 산출 hits[] ↔ raw `gh search issues --json` stdout value-consistency(값-정합 재유도) sweep(chain 을 search argv→search stdout→파서까지 통과시켜 산출 hits 배열의 number·title·body 전체 값이 raw stdout 으로부터 독립 재유도한 expected 배열과 deep-equal·개수·순서·필드값·추가필드 drop 동형·값 drift(number/title/body 값 변형·hit 누락/중복/재정렬·잉여필드)는 RangeError·구조결손(hits 비배열/원소 비객체/stdout 비-string/비-JSON/비배열/원소 number 비양정수/title·body 비문자열)은 TypeError 분리·빈 hit("[]")·multi-hit·descriptor guard 상류 차단·결정론/no-mutation/credential negative 다수) test-dominated ~290 LOC. 직전 형제 T-0924 는 execute-leg(create/edit output) outcome{issueNumber,url} value-consistency 축을 닫았고, 그 입력측 대칭인 search-leg parser 산출 hits[] value-consistency seam(T-0908 가드, assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout)은 어느 smoke 도 미참조 — 본 task 가 그 마지막 미커버 입력-leg 값-정합 helper 를 chain 그물로 봉합. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0924 execute-leg output value-consistency 종결 후 T-0908 search-output value-consistency 가드가 smoke 0 참조인 마지막 대칭 seam gap. summary 축 T-0721 mirror. dep [] file-disjoint stage5b 병렬.
---

# T-0925 — realdata-e2e dual-leg run report search-output↔stdout value-consistency convergence non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 박제) chain 의 **입력측 search leg — 파서 산출 hits[] ↔ raw `gh search issues --json` stdout 값-정합(single-source 독립 재유도) seam** 이 아직 어떤 smoke 에도 묶이지 않았다. `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.ts`(T-0908 신설) 는 파서(`parseRealDataDailyStepDualLegRunReportIssueSearchOutput`, T-0901)가 산출한 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` **전체 값**이 raw `gh search issues --json number,title,body` stdout 으로부터 **컴포저 재호출 없이 독립 재유도**(`JSON.parse` → 배열 필터 → 각 원소 `{number,title,body}` 추출·정규화)한 expected 배열과 개수·순서·필드값·추가필드 drop 면에서 deep-equal 정합한지 검증하는 순수 가드다. 그러나 `git grep` 결과 이 가드(`assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout`)를 참조하는 smoke 파일은 **0개** — dual-leg run report helper 중 build-time smoke 그물에 미포함된 마지막 value-consistency seam 이다.

직전 형제 T-0924 는 **execute-leg(create/edit output)** 축을 닫았다:

- **T-0924** (output↔stdout value-consistency convergence) — chain 을 create/edit exec stdout 까지 통과시킨 뒤 파서 산출 outcome `{issueNumber, url}` **전체 값**이 raw exec stdout 으로부터 독립 재유도한 expected 와 deep-equal 정합함을 T-0906 가드로 박제. 즉 **출력측(post-execution) leg** 의 값-정합만 닫았다.

본 task 는 그 **입력측(pre-resolve) 대칭 — search leg** 을 닫는다. dual-leg publish chain 은 (1) 먼저 marker 로 `gh search issues` 를 실행해 기존 이슈를 찾고(입력 leg), (2) 그 hits 로 create/update 를 결정해 실행한 뒤 output 을 파싱한다(출력 leg). T-0924 는 (2) 의 값-정합을 닫았으나 (1) 의 값-정합 — 파서가 search stdout 으로부터 hits 배열을 **개수·순서·number/title/body 값·추가필드 drop** 이 올바르게 산출했는가 — 는 어느 smoke 도 chain 그물로 검증하지 않았다.

즉 **search 파서가 silent 하게 number/title/body 값을 drift 시키거나 hit 을 누락/중복/재정렬하거나 추가 필드를 누설해도**, 그 손상 산출이 resolve(action 분기 결정, T-0898)로 새기 전에 build-time smoke 로 잡히지 않았다(파서 산출 hits 를 raw stdout 으로부터 독립 재유도해 deep-equal 대조하는 단언이 어느 smoke 에도 없으므로). 본 task 는 `report → descriptor → commandArgs → searchArgv` chain 을 통과시켜 얻은 search argv 규약과 정합하는 synthetic search stdout 을 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 로 파싱한 뒤, 그 산출 hits 배열 **전체 값**이 raw search stdout 으로부터 single-source 재유도한 expected 와 deep-equal 정합함을 T-0908 가드(`assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout`)로 박제한다 — summary 축 T-0721(`assertRealDataResultIssueSearchOutputConsistentWithStdout`) value-consistency 커버리지의 dual-leg mirror.

issue-still-relevant 확인(2026-07-12): `git grep -l "SearchOutputConsistentWithStdout" -- test/smoke/*` = **0 hit**, `git grep -l "parseRealDataDailyStepDualLegRunReportIssueSearchOutput" -- test/smoke/*` = **0 hit** — dual-leg run report search 파서·그 value-consistency 가드를 참조하는 smoke 파일 0. 가드 helper 자체(T-0908)와 파서 self-wire(T-0909, search-parse.ts line 167~)는 이미 main 에 박제됨 — 본 task 는 그 self-wire 를 **다시 배선하지 않고** chain 을 통과한 search stdout 을 파서로 통과시켜 산출 hits 를 가드로 검증하는 **smoke 그물만** 신설. `git log origin/main` 동일 영역(search-output-consistency smoke) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0924-realdata-e2e-dual-leg-run-report-output-stdout-value-consistency-convergence-smoke.md` — 직전 형제(execute-leg 대칭). chain assembler·synthetic 빌더·import 경로 규약·describe 구조·한국어 헤더 주석·value-consistency 접근(독립 재유도 deep-equal·값 drift RangeError·구조결손 TypeError 분리·결정론/no-mutation/credential negative) mirror 1순위 템플릿. 본 task 는 그 **execute-leg output outcome{issueNumber,url}** 축 자체 재단언 금지 — 초점을 출력 leg 에서 **입력 leg 파서 산출 hits[] 의 number·title·body 전체 값 ↔ search stdout 독립 재유도 deep-equal** 로 이동.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse-consistency.ts` — **본 task 핵심 대상**. `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, stdout): void`. stdout 만으로 expected 를 독립 재유도(`JSON.parse` → 배열 → 각 원소 non-null 객체 → number 양정수 → title/body 문자열 → `{number,title,body}` 정규화·추가필드 drop) 후 산출 hits 와 개수·순서·필드값·키집합(3키) deep-equal 대조. 에러 정책: 구조 결손(hits 비배열/원소 비객체·stdout 비-string/비-JSON/비배열/원소 number 비양정수/title·body 비문자열)=TypeError, 값 정합 위반(number/title/body 값·개수·순서·추가필드 drift)=RangeError. 정합이면 void, 부정합이면 throw. 컴포저 재호출 0(독립 재유도 핵심).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` — 파서 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` → `RealDataDailyStepDualLegRunReportIssueSearchHit[]`. `JSON.parse` → 배열 guard → 각 원소 number 양정수·title/body 문자열 검증 → `{number,title,body}` 정규화(추가필드 drop). `"[]"` → `[]`(후보 0건). line 161~172 에 이미 self-wire(consistency 가드 T-0909) 된 상태 — 본 smoke 는 chain 통과 search stdout 을 파서로 통과시켜 산출 hits 를 consistency 가드로 재검증.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` — `RealDataDailyStepDualLegRunReportIssueSearchHit`{number,title,body} interface·`resolveRealDataDailyStepDualLegRunReportIssueAction(hits)` create/update 분기(hits 를 chain 산출로 잇는 하류 확인용 — 형식 재단언 금지). type import 원천.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — pre-boundary `{title, marker, body}`, marker = private prefix + `${report.dateToken}@${report.gitSha}`. gitSha/dateToken 빈/공백 → 합성 측 guard throw(chain 상류 차단 negative 용).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — marker → `searchQuery === descriptor.marker` 운반 layer.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)` → `gh search issues --json number,title,body ...` argv. `..._SEARCH_JSON_FIELDS`("number,title,body")·`..._SEARCH_LIMIT` 규약 — synthetic search stdout 의 필드 집합이 이 `--json` 요청과 정합하도록 조립 입력으로만 사용(argv 형식 재단언 금지).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. 입력 type `RealDataDailyStepLegRunOutcome`{leg,action,passed?,specPath?}·`RealDataResultIssueRunRef`{gitSha,dateToken}.
- `test/jest-smoke.json` — smoke jest config(testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-search-output-stdout-value-consistency-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` / search stdout(JSON) literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). hits 는 chain 산출(파서 결과)에서 얻어 가드에 search stdout 과 함께 넣는다 — 값 drift negative 는 chain 산출 hits 를 복제·변형한 synthetic hits 로 주입(literal 하드코딩 최소). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·search-leg parser↔raw stdout 값-정합 절단면·single-source 독립 재유도 deep-equal·REQ-032 raw 미저장/REQ-059·형제 T-0924 와의 차별=출력 leg output outcome 이 아니라 입력 leg search hits[] 의 number/title/body 전체 값 축) 작성.

- [ ] **Happy-path multi-hit value-consistency test 1+** — 단일 source: 유효 두 leg outcome literal + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. chain: `report → descriptor → commandArgs → searchArgv` 통과 후, 그 marker 를 body 에 담은 유효 search stdout(JSON 배열 `[{"number":N1,"title":...,"body":<marker>...},{"number":N2,...}]`, `--json number,title,body` 정합)에 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` 적용 → hits. `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, searchStdout)` 가 **throw 없이 void**(값-정합) 임을 `expect(() => ...).not.toThrow()` 로 1+ test. AND hits 의 개수·각 원소 `{number,title,body}` 값이 search stdout 이 담은 값과 index 별 정확 일치(hits[i].number===N(i) 등) 직접 대조 1+.
- [ ] **Happy-path 빈 hit("[]") value-consistency test 1+ (create 경로 후보 0건)** — 동일 chain 으로 얻은 marker 로 search stdout 이 `"[]"`(빈 배열) → 파서 산출 hits === `[]`(길이 0) AND `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout([], "[]")` 가 void(값-정합) 1+ test(빈 배열은 정상 — 후보 0건). 즉 create 경로 진입 전 search leg 값-정합도 빈 hit 에서 성립.
- [ ] **필드값·순서·개수-threading 단언 test 1+ (hits 가 stdout 원소와 index 수렴)** — multi-hit stdout 에서 파서 산출 hits 의 개수 === stdout JSON 배열 length, hits[i].number/title/body === stdout[i].number/title/body(순서 보존·값 threading), 그리고 각 hit 의 own key 집합이 정확히 `{number,title,body}` 3키(추가필드 drop — stdout 원소에 `url`/`state`/`labels` 등 잉여 필드를 넣어도 hits 에는 미누출) 1+ test. 즉 value-consistency 는 값뿐 아니라 개수·순서·추가필드 drop 정합을 함께 박제.
- [ ] **single-source 독립 재유도 단언 test 1+** — 동일 search stdout 에서 파서 재호출 없이 별도로 `JSON.parse` → 각 원소 `{number,title,body}` 추출·정규화로 산출한 expected 배열이 chain 산출 hits 와 deep-equal 임을 단언 1+ test(가드가 stdout 을 진실의 원천으로 삼음을 반영 — 하드코딩 대신 stdout 파생). **순서 보존 결정론** — stdout 원소 순서(N1 다음 N2, N2≠N1)를 hits·재유도 expected 모두 그대로 보존함을 확인 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) number 값 drift(RangeError) — chain 산출 hits 를 복제해 한 원소 `number` 를 stdout 과 다른 값(N1+1)으로 변형 → `assert...SearchOutputConsistentWithStdout(mutated, searchStdout)` 가 **RangeError**(값 정합 위반) throw 1+ test. `expect(...).toThrow(RangeError)`.
  - (b) title/body 값 drift(RangeError) — hits 복제 후 한 원소 `title` 또는 `body` 를 stdout 과 다른 문자열(공백 추가/대소문자 변경 포함 — trim·case-fold 0 확인)로 변형 → guard RangeError 1+ test.
  - (c) hit 누락/중복/재정렬(RangeError) — hits 복제 후 원소 1개 제거(개수 불일치) / 원소 순서 swap(순서 불일치) / 원소 1개 복제(중복) 각각 → guard RangeError 1+ test(개수·순서 축 각 cover).
  - (d) 잉여 필드 drift(RangeError) — hits 복제 후 한 원소에 `url`(또는 `token` 같은 credential-형 키) 1개 추가(키 4개) → guard RangeError(추가필드 drop 위반) 1+ test.
  - (e) 구조 결손(TypeError) — hits=null / undefined / 숫자·문자열(비배열) / 배열 원소가 비객체(null/숫자), 그리고 stdout=비-string(number/null) / 비-JSON(`"{"`) / 비배열 JSON(`"{}"`)/ 원소 number 비양정수(0·음수·선행0 문자열은 number 아님) / title·body 비문자열 각각 → guard **TypeError** 1+ test(값 정합 위반 RangeError 와 분리; 최소 hits null·비배열·원소 비객체 + stdout 비-string·비-JSON·비배열·원소 number 비양정수·title 비문자열 다수).
  - (f) chain-상류 차단 — `run.gitSha` 빈/공백 → descriptor(stage 1) guard throw 로 chain 조립 자체 차단(잘못된 marker 로 search stdout 산출 자체가 불가) 1+ test; search stdout 이 비-JSON 또는 원소 number 비양정수 → `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`(self-wire 포함) throw 로 hits 미산출(잘못된 hits 가 value-consistency 가드나 resolve 로 새는 것 자체 차단) 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (run, leg outcomes, searchStdout) 로 chain→hits→guard 를 두 번 실행 → 두 hits 배열 deep-equal(byte-identical) 이며 서로 다른 배열 인스턴스(무공유) 1+ test. AND guard 호출이 hits·stdout 을 mutate 0(호출 전후 `JSON.parse(JSON.stringify(hits))` snapshot deep-equal, stdout 문자열 불변 확인) 1+ test.
- [ ] **raw / credential 누출 0 test 1+** — chain 산출 hits 각 원소의 own key 집합이 정확히 `{number, title, body}` 뿐이며 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘를 키/값 어디에도 담지 않음(정규식/`not.toContain`, R-59 / REQ-059). stdout 원소에 credential-형 sentinel 잉여 필드를 넣어도 hits 및 값-정합 재유도에 sentinel 미누출 1+ test. 가드 throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(number/title/body 값·index·타입만 노출)을 negative case 에서 확인 1+.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- 파서(`...-issue-search-parse.ts`) / `RealDataDailyStepDualLegRunReportIssueSearchHit` interface / `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout` 가드 **본문 변경 금지** — import·호출만. 가드의 producer self-wire(파서 산출 직전 가드 호출 배선)는 **이미 main 에 T-0909 로 박제됨** — 재배선 금지, chain 통과 hits 검증 smoke 그물만.
- 형제 T-0924 의 **execute-leg output outcome{issueNumber,url} value-consistency 축**(create/edit exec stdout↔outcome deep-equal) 자체 재단언 금지 — 본 task 는 입력 leg search hits[] 의 number/title/body **전체 값** ↔ search stdout 독립 재유도 deep-equal 축만.
- 형제 T-0923 의 **outcome-parse-shape set-equality 축**(execute-leg outcome own-key set ↔ PARSE_SHAPE_KEYS) 재단언 금지. 형제 T-0918~T-0922 의 pre→resolve→post argv 절단면·create→update 상태 전이·idempotency·dual-medium 직교 자체 재단언 금지 — searchArgv 원소 순서/`--match body`/`--limit`·gh-argv 의 `--title`/`--body`/labels 형식 재단언 금지(각 가드 cover).
- resolve(action 분기 결정, `resolveRealDataDailyStepDualLegRunReportIssueAction`) 본문·create/update 분기 규약 재단언 금지 — 본 task 는 search stdout→hits 값-정합 단일 축(hits 를 resolve 로 잇는 하류는 상류-차단 negative 맥락에서만 언급).
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github search 부작용·실 gh `execFile('gh', argv)`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). search stdout·N 은 synthetic JSON literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 report → descriptor → commandArgs → searchArgv 를 통과시켜 search argv 규약(`--json number,title,body`)과 정합하는 synthetic search stdout 을 조립한 뒤 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(searchStdout)` 로 hits 를 산출하고 `assertRealDataDailyStepDualLegRunReportIssueSearchOutputConsistentWithStdout(hits, searchStdout)` 로 값-정합을 박제하는 합성 smoke 작성. 핵심: 파서 산출 hits 배열의 개수·순서·number/title/body 값이 search stdout 원소와 index 별 deep-equal·추가필드 drop(3키만)·빈 hit("[]")→[]·값 drift(number/title/body/개수/순서/중복/잉여필드)는 RangeError·구조결손(hits 비배열/원소 비객체/stdout 비-string·비-JSON·비배열·원소 number 비양정수·title/body 비문자열)은 TypeError 분리·descriptor guard 상류 차단·파서 self-wire throw 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. 가드가 stdout 만으로 expected 를 독립 재유도(파서 재호출 0)함을 유의 — 값 축은 number·title·body 셋 다 + 개수·순서·추가필드 drop.)

## Follow-ups

(없음 — search-output value-consistency 가드가 이미 self-wire(T-0909) 돼 있고 본 smoke 로 chain-그물 커버까지 닫히면 dual-leg run report publish chain 의 입력 leg·출력 leg value-consistency seam 이 양쪽 다 봉합. 잔여는 step④ live wiring(credential gate deferred) 및 report↔input consistency 가드(assertRealDataDailyStepDualLegRunReportConsistentWithInput) smoke 커버 — 다음 turn 의 planner 가 PLAN 재평가로 판단)
