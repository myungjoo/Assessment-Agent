---
id: T-0926
title: realdata-e2e dual-leg run report chain 을 종단 컴포저 산출까지 통과시켜 report 6 필드(gitSha/dateToken/eval/collect/overallStatus/summaryLine) 전체 값이 입력 (evalOutcome, collectOutcome, run) 으로부터 single-source 독립 재유도한 expected 와 deep-equal(값·per-leg status 파생·overallStatus 파생·summaryLine 합성·추가필드 drop) 정합함을 assertRealDataDailyStepDualLegRunReportConsistentWithInput(T-0911 가드)로 박제하는 report↔input value-consistency convergence non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-07-11T16:45:00Z
mergedAs: b57afefa
prNumber: 820
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 290
estimatedFiles: 1
created: 2026-07-12
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-terminal-composer-report-input-value-consistency-convergence-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-terminal-composer-value-consistency-smoke
sizeExempt: true
exemptReason: test-only smoke 1파일 — 종단 컴포저 산출 report 6 필드(gitSha/dateToken/eval/collect/overallStatus/summaryLine) ↔ 입력 (evalOutcome, collectOutcome, run) value-consistency(값-정합 재유도) sweep(chain 을 두 leg outcome + run → 컴포저까지 통과시켜 산출 report 6 필드 전체 값이 세 입력으로부터 컴포저 재호출 없이 독립 재유도한 expected 와 deep-equal·per-leg status 파생·overallStatus 파생·gitSha/dateToken 전파·summaryLine 합성·추가필드 drop 동형·값 drift(gitSha/dateToken/status/overallStatus/summaryLine 값 변형·추가필드)는 RangeError·구조결손(report/입력 비-non-null-객체·6 필드 type 위반·gitSha/dateToken 빈-공백·leg 라벨 오류·action="run"+passed=undefined·action="skip"+passed 정의)은 TypeError 분리·all-pass/some-fail/all-skip/partial 4 overallStatus 분기·결정론/no-mutation/credential negative 다수) test-dominated ~290 LOC. 직전 형제 T-0924(execute-leg output outcome value-consistency)·T-0925(search-leg hits value-consistency)는 파서 seam 값만 닫았고, 그 상류의 종단 컴포저 report 6 필드 value-consistency seam(T-0911 가드, assertRealDataDailyStepDualLegRunReportConsistentWithInput)은 어느 smoke 도 미참조 — 본 task 가 그 마지막 미커버 종단 산출 값-정합 helper 를 chain 그물로 봉합. production LOC 0, coverageThreshold 회귀 0.
plannerNote: P5 §109 step④ — T-0924/25 파서 seam value-consistency 종결 후 T-0911 종단 컴포저 report↔input 가드가 smoke 0 참조인 마지막 상류 seam gap. summary 축 T-0725 mirror. dep [] file-disjoint stage5b 병렬.
---

# T-0926 — realdata-e2e dual-leg run report terminal-composer report↔input 6-field value-consistency convergence non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) step④ (daily-test dual-leg run 결과 rolling-issue 박제) chain 의 **종단 컴포저 seam — 산출 `report` 6 필드 ↔ 입력 `(evalOutcome, collectOutcome, run)` 값-정합(single-source 독립 재유도) seam** 이 아직 어떤 smoke 에도 chain 그물로 묶이지 않았다. `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.ts`(T-0911 신설) 의 `assertRealDataDailyStepDualLegRunReportConsistentWithInput` 는 종단 컴포저(`buildRealDataDailyStepDualLegRunReport`, T-0894)가 산출한 `RealDataDailyStepDualLegRunReport` **6 필드 전체 값**(gitSha/dateToken/eval/collect/overallStatus/summaryLine)이 세 입력으로부터 **컴포저 재호출 없이 독립 재유도**(run.gitSha/dateToken guard → leg 라벨 정합 → per-leg status 파생 → overallStatus 파생 → gitSha/dateToken 전파 → summaryLine 동형 합성 → 6 키 정규화)한 expected 와 값·키집합(추가필드 drop) 면에서 deep-equal 정합한지 검증하는 순수 가드다. 그러나 `git grep` 결과 이 가드를 참조하는 smoke 파일은 **0개** — dual-leg run report helper 중 build-time smoke 그물에 미포함된 마지막 value-consistency seam 이다.

직전 형제 T-0924·T-0925 는 **파서 seam** 축을 닫았다:

- **T-0924** (output↔stdout value-consistency) — chain 을 create/edit exec stdout 까지 통과시킨 뒤 파서 산출 outcome `{issueNumber, url}` 값이 raw exec stdout 으로부터 독립 재유도한 expected 와 deep-equal 정합함을 T-0906 가드로 박제(출력 leg 파서 seam).
- **T-0925** (search-output↔stdout value-consistency) — chain 을 search stdout 까지 통과시킨 뒤 파서 산출 hits[] 의 number/title/body 값이 raw search stdout 으로부터 독립 재유도한 expected 와 deep-equal 정합함을 T-0908 가드로 박제(입력 leg 파서 seam).

즉 T-0924/T-0925 는 **두 파서 seam(출력·입력 leg)** 의 값-정합만 닫았고, 그 **상류의 종단 컴포저** — 두 leg outcome + run 식별자를 하나의 rolling-issue report 로 묶는 단계의 산출 6 필드 값-정합 — 은 어느 smoke 도 chain 그물로 검증하지 않았다.

본 task 는 그 **종단 컴포저 seam** 을 닫는다. dual-leg publish chain 은 (1) 두 leg(eval/collect) jest run outcome 을 얻고, (2) run 식별자(gitSha/dateToken)와 함께 종단 컴포저에 넣어 하나의 report(per-leg status + overallStatus + summaryLine)를 산출한다. 파서 seam(T-0924/25)은 leg 별 gh 산출물 파싱 정합만 검증하므로, **컴포저가 silent 하게 per-leg status 를 오파생하거나 overallStatus 를 오판정하거나 gitSha/dateToken 을 오전파하거나 summaryLine 을 오합성하거나 추가 필드를 누설해도**, 그 손상 report 가 rolling-issue 박제로 새기 전에 build-time smoke 로 잡히지 않았다(산출 report 를 세 입력으로부터 독립 재유도해 deep-equal 대조하는 단언이 어느 smoke 에도 없으므로). 본 task 는 두 leg outcome + run 을 종단 컴포저로 통과시켜 얻은 report **6 필드 전체 값**이 세 입력으로부터 single-source 재유도한 expected 와 deep-equal 정합함을 T-0911 가드(`assertRealDataDailyStepDualLegRunReportConsistentWithInput`)로 박제한다 — summary 축 T-0725(`assertRealDataResultSummaryConsistentWithInput`) value-consistency 커버리지의 dual-leg 축 mirror.

issue-still-relevant 확인(2026-07-12): `git grep -l "assertRealDataDailyStepDualLegRunReportConsistentWithInput" -- test/smoke/*` = **0 hit** — 종단 컴포저 report↔input value-consistency 가드를 참조하는 smoke 파일 0. 가드 helper 자체(T-0911)와 컴포저 self-wire(단일 return 사이트 직전 self-assert, `report.ts` line 199)는 이미 main 에 박제됨 — 본 task 는 그 self-wire 를 **다시 배선하지 않고** chain 을 통과한 두 leg outcome + run 을 컴포저로 통과시켜 산출 report 를 가드로 검증하는 **smoke 그물만** 신설. `git log origin/main` 동일 영역(report-input-consistency smoke) 박제 commit 0.

## Required Reading

- `docs/PLAN.md` (§109 실 평가 e2e 항목만)
- `docs/tasks/T-0925-realdata-e2e-dual-leg-run-report-search-output-stdout-value-consistency-convergence-smoke.md` — 직전 형제(search-leg 파서 seam). chain assembler·synthetic 빌더·import 경로 규약·describe 구조·한국어 헤더 주석·value-consistency 접근(독립 재유도 deep-equal·값 drift RangeError·구조결손 TypeError 분리·결정론/no-mutation/credential negative) mirror 1순위 템플릿. 본 task 는 그 **search-leg 파서 hits[] 값** 축 자체 재단언 금지 — 초점을 파서 seam 에서 **상류 종단 컴포저 산출 report 6 필드 ↔ (evalOutcome, collectOutcome, run) 독립 재유도 deep-equal** 로 이동.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-consistency.ts` — **본 task 핵심 대상**. `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run): void`(line 340~). 세 입력만으로 expected 를 독립 재유도(run.gitSha/dateToken 빈-공백 guard → leg 라벨 정합 → per-leg status 파생(run+passed=true→"pass"/run+passed=false→"fail"/skip→"skip") → overallStatus 파생(all-pass/some-fail/all-skip/partial) → gitSha/dateToken 전파 → summaryLine 동형 합성 → 6 키 정규화·추가필드 drop) 후 산출 report 와 6 필드 값·키집합 deep-equal 대조. 에러 정책: 구조 결손(report/입력 비-non-null-객체·6 필드 type 위반·gitSha/dateToken 빈-공백·leg 라벨 오류·action="run"+passed=undefined·action="skip"+passed 정의)=TypeError, 값 정합 위반(6 필드 값·추가필드 drift)=RangeError. 정합이면 void, 부정합이면 throw. 컴포저 재호출 0(독립 재유도 핵심).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — 종단 컴포저 `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → `RealDataDailyStepDualLegRunReport`{gitSha, dateToken, eval{action,status}, collect{action,status}, overallStatus, summaryLine}(interface line 78~, 함수 line 158~). 입력 type `RealDataDailyStepLegRunOutcome`{leg:"eval"|"collect", action:"run"|"skip", passed?, specPath?}(line 48~)·`RealDataDailyStepLegStatus`("pass"|"fail"|"skip")·`RealDataDailyStepDualLegOverallStatus`("all-pass"|"some-fail"|"all-skip"|"partial"). 컴포저는 line 199 에서 이미 가드를 self-assert(단일 return 직전) — 본 smoke 는 chain 통과 입력을 컴포저로 통과시켜 산출 report 를 consistency 가드로 재검증(재배선 금지).
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef`{gitSha, dateToken} type 원천(컴포저 run 인자). gitSha/dateToken 빈-공백 → 컴포저/가드 guard throw(chain 상류 차단 negative 용).
- `test/jest-smoke.json` — smoke jest config(`testRegex: ".*\\.smoke-spec\\.ts$"` 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용).

## Acceptance Criteria

새 파일 `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-terminal-composer-report-input-value-consistency-convergence-assembly.smoke-spec.ts` **1개**만 추가(test-only, `src/` 변경 0, gating/`describe.skip`/`process.env` 읽기 0 — 순수 build-time in-memory 검증만, R-113 public CI 항상 green). 모든 입력은 synthetic `RealDataDailyStepLegRunOutcome` / `RealDataResultIssueRunRef` literal 직접 주입(실 LLM / scoreUnit / Ollama / 실 github / 실 gh / `execFile` / jest spawn / DB / 네트워크 0 복제). describe/it 문자열은 한국어 + 영어 식별자 혼용(§12). report 는 chain 산출(컴포저 결과)에서 얻어 가드에 세 입력과 함께 넣는다 — 값 drift negative 는 chain 산출 report 를 복제·변형한 synthetic report 로 주입(literal 하드코딩 최소). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-gh 0·네트워크 0·DB 0·종단 컴포저 report↔input 6 필드 값-정합 절단면·single-source 독립 재유도 deep-equal·REQ-032 raw 미저장/REQ-059·형제 T-0924/T-0925 와의 차별=파서 seam(output/search) 값이 아니라 상류 종단 컴포저 report 6 필드 값 축) 작성.

- [ ] **Happy-path all-pass value-consistency test 1+** — 단일 source: 두 leg outcome literal(eval leg {leg:"eval", action:"run", passed:true} + collect leg {leg:"collect", action:"run", passed:true}) + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}`. `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` → report. `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run)` 가 **throw 없이 void**(값-정합) 임을 `expect(() => ...).not.toThrow()` 로 1+ test. AND report 의 gitSha/dateToken === run 의 값, eval.status/collect.status === "pass", overallStatus === "all-pass" 직접 대조 1+.
- [ ] **overallStatus 4 분기 value-consistency test 1+ (all-pass/some-fail/all-skip/partial 각 cover)** — 동일 run 으로 두 leg outcome 조합을 바꿔: (i) 둘 다 run+passed=true → overallStatus "all-pass", (ii) 하나 run+passed=false → "some-fail"(fail 최우선), (iii) 둘 다 skip → "all-skip", (iv) 하나 skip + 하나 pass → "partial" 각각에서 report 산출 후 가드 void(값-정합) AND report.overallStatus 가 기대 분기값과 일치함을 각 1+ test(overallStatus 파생 threading 을 4 분기 모두 박제).
- [ ] **6 필드 값 threading·추가필드 drop 단언 test 1+** — report 의 own key 집합이 정확히 `{gitSha, dateToken, eval, collect, overallStatus, summaryLine}` 6키(eval/collect 는 각 `{action, status}` 2키)이며, gitSha/dateToken 가 run 에서, eval.action/collect.action 이 각 leg outcome 에서, status/overallStatus/summaryLine 이 파생 규약으로 threading 됨을 직접 대조 1+ test. summaryLine 이 gitSha/dateToken + 두 leg status + overallStatus 를 포함(byte-identical 결정론)함을 substring 또는 정확 일치로 확인 1+.
- [ ] **single-source 독립 재유도 단언 test 1+** — 동일 (evalOutcome, collectOutcome, run) 에서 컴포저 재호출 없이 별도로 gitSha/dateToken 전파 + per-leg status 파생 + overallStatus 파생 + summaryLine 합성 규약으로 산출한 expected report 객체가 chain 산출 report 와 deep-equal 임을 단언 1+ test(가드가 입력을 진실의 원천으로 삼음을 반영 — 하드코딩 대신 입력 파생). **결정론** — 동일 입력 두 번 컴포저 → 두 report deep-equal(byte-identical) 확인 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 예외 분기마다 각 1+ test(단일 negative 금지):
  - (a) gitSha/dateToken 값 drift(RangeError) — chain 산출 report 를 복제해 `gitSha`(또는 `dateToken`)를 run 과 다른 값으로 변형(공백 추가/대소문자 변경 포함 — trim·case-fold 0 확인) → `assert...ConsistentWithInput(mutated, eval, collect, run)` 가 **RangeError**(값 정합 위반) throw 1+ test. `expect(...).toThrow(RangeError)`.
  - (b) per-leg status 값 drift(RangeError) — report 복제 후 eval.status(또는 collect.status)를 파생 규약과 다른 값("pass"→"fail")으로 변형 → guard RangeError 1+ test.
  - (c) overallStatus 값 drift(RangeError) — report 복제 후 overallStatus 를 두 leg status 로 재유도한 값과 다른 분기값("all-pass"→"partial")으로 변형 → guard RangeError 1+ test.
  - (d) summaryLine 값 drift(RangeError) — report 복제 후 summaryLine 을 파생 합성과 다른 문자열(끝에 공백 1개 추가)로 변형 → guard RangeError(값 정합 위반) 1+ test.
  - (e) 잉여 필드 drift(RangeError) — report 복제 후 `url`(또는 `token` 같은 credential-형 키) 1개 추가(키 7개) → guard RangeError(추가필드 drop 위반) 1+ test.
  - (f) 구조 결손(TypeError) — report=null / undefined / 숫자·문자열(비객체) / 배열, 그리고 6 필드 type 위반(gitSha=number / eval=null / overallStatus=미정의 분기), 입력측 run.gitSha 빈-공백 / evalOutcome leg 라벨 오류(eval 자리에 {leg:"collect",...}) / action="run"+passed=undefined / action="skip"+passed=true(action/passed 모순) 각각 → guard **TypeError** 1+ test(값 정합 위반 RangeError 와 분리; 최소 report null·비객체·gitSha 비-string + run.gitSha 빈-공백·leg 라벨 오류·action/passed 모순 다수).
  - (g) chain-상류 차단 — `run.gitSha` 빈/공백 → 컴포저(`buildRealDataDailyStepDualLegRunReport`, self-wire 포함) throw 로 report 미산출(잘못된 report 가 value-consistency 가드나 rolling-issue 박제로 새는 것 자체 차단) 1+ test; eval 자리에 collect leg outcome cross-wiring → 컴포저 leg 라벨 guard throw 로 조립 자체 차단 1+ test.
- [ ] **결정론·무공유·no-mutation test 1+** — 동일 (evalOutcome, collectOutcome, run) 로 컴포저를 두 번 실행 → 두 report deep-equal(byte-identical) 이며 서로 다른 객체 인스턴스(무공유) 1+ test. AND guard 호출이 report·세 입력을 mutate 0(호출 전후 `JSON.parse(JSON.stringify(...))` snapshot deep-equal) 1+ test.
- [ ] **raw / credential 누출 0 test 1+** — chain 산출 report 각 필드가 GH_TOKEN/PAT/`ghp_`/`--token`/`GITHUB_TOKEN` 어휘를 키/값 어디에도 담지 않음(정규식/`not.toContain`, R-59 / REQ-059). report 는 narrative 본문·raw 활동 본문·평가 정량 없이 gitSha/dateToken/leg status/overallStatus/summaryLine 만 보유함을 확인 1+ test. 가드 throw 메시지가 raw 활동 본문·credential 을 노출하지 않음(6 필드 값·타입만 노출)을 negative case 에서 확인 1+.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe`(env-gated `describe.skip`/`if (process.env...)` 금지 — public CI always green, R-113). `process.env` 읽기 0.
- [ ] `pnpm lint && pnpm build` green, `pnpm test:smoke`(또는 해당 smoke 격리 실행) green, 전체 unit suite 무회귀(`pnpm test`). 본 smoke 는 production 코드 0 LOC 변경(test-only)이라 `coverageThreshold`(line ≥ 80% / function ≥ 80%) 회귀 유발 0 — `pnpm test:cov` 또는 smoke 격리 실행으로 기존 임계 유지 확인.

## Out of Scope

- production / `src/` 코드 변경 금지(test-only smoke 1 파일). `package.json`·lockfile·`.github/workflows/`·`test/jest-smoke.json`·`prisma/schema.prisma`·helper(`*.ts`) 변경 0. 새 외부 dependency 0.
- 종단 컴포저(`...-dual-leg-run-report.ts`) / `RealDataDailyStepDualLegRunReport` interface / `assertRealDataDailyStepDualLegRunReportConsistentWithInput` 가드 **본문 변경 금지** — import·호출만. 가드의 producer self-wire(컴포저 단일 return 직전 self-assert)는 **이미 main 에 T-0911 로 박제됨** — 재배선 금지, chain 통과 report 검증 smoke 그물만.
- 형제 T-0924 의 **execute-leg output outcome{issueNumber,url} 파서 value-consistency 축**·T-0925 의 **search-leg hits[] number/title/body 파서 value-consistency 축** 자체 재단언 금지 — 본 task 는 상류 종단 컴포저 산출 report 6 필드 ↔ (evalOutcome, collectOutcome, run) 독립 재유도 deep-equal 축만.
- 형제 T-0923 의 outcome-parse-shape set-equality·T-0918~T-0922 의 pre→resolve→post argv 절단면·create→update 상태 전이·idempotency·dual-medium 직교 자체 재단언 금지 — searchArgv/gh-argv 형식·per-leg command-plan 형식 재단언 금지(각 가드 cover).
- 파서(output-parse / search-parse) 및 그 consistency 가드 seam 재단언 금지 — 본 task 는 종단 컴포저 report↔input 값-정합 단일 축.
- 새 컴포저·새 helper·새 type·consistency 가드 신설 금지 — 기존 helper import 만.
- 실 github·실 gh `execFile('gh', argv)`·실 jest spawn / DB / 네트워크 / 실 git sha·timestamp 읽기 0 — synthetic literal 만(step④ live wiring 은 credential gate deferred). gitSha/dateToken·leg outcome 은 synthetic literal 로 대체.
- gating(`process.env` 기반 skip) 도입 금지 — non-gated 항상 실행(R-113 public CI green).

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 두 leg `RealDataDailyStepLegRunOutcome` outcome + `RealDataResultIssueRunRef` run 을 `buildRealDataDailyStepDualLegRunReport` 로 통과시켜 report 를 산출하고 `assertRealDataDailyStepDualLegRunReportConsistentWithInput(report, evalOutcome, collectOutcome, run)` 로 값-정합을 박제하는 합성 smoke 작성. 핵심: 컴포저 산출 report 6 필드(gitSha/dateToken/eval/collect/overallStatus/summaryLine)가 세 입력으로부터 독립 재유도한 expected 와 deep-equal·추가필드 drop(6키만)·overallStatus 4 분기(all-pass/some-fail/all-skip/partial)·값 drift(gitSha/dateToken/status/overallStatus/summaryLine/잉여필드)는 RangeError·구조결손(report/입력 비객체·6 필드 type·gitSha/dateToken 빈-공백·leg 라벨 오류·action/passed 모순)은 TypeError 분리·컴포저 self-wire throw 상류 차단·leg cross-wiring guard 상류 차단·결정론/no-mutation/credential 을 실제 helper export 시그니처로 확인해 단언 문자열 결정. 가드가 입력만으로 expected 를 독립 재유도(컴포저 재호출 0)함을 유의 — 값 축은 gitSha·dateToken·per-leg status·overallStatus·summaryLine 전부 + 추가필드 drop.)

## Follow-ups

(없음 — report↔input value-consistency 가드가 이미 self-wire(T-0911) 돼 있고 본 smoke 로 chain-그물 커버까지 닫히면 dual-leg run report publish chain 의 두 파서 seam(output T-0924·search T-0925)에 더해 종단 컴포저 seam 까지 value-consistency 3 seam 이 모두 봉합. 잔여는 step④ live wiring(credential gate deferred) — 다음 turn 의 planner 가 PLAN 재평가로 판단)
