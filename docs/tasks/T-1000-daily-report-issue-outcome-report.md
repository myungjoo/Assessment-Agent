---
id: T-1000
title: daily-step dual-leg run report issue outcome-report 종단 컴포저 순수 helper 신설 (buildRealDataDailyStepDualLegRunReportIssueOutcomeReport — 박제 outcome + run report 식별자 → 사람-친화 e2e 실행 리포트 descriptor, 요약축 T-0590 mirror)
phase: P5
status: DONE
mergedAs: 16a5a06c
prNumber: 894
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts
plannerNote: "P5 §109 test-hardening — daily-step issue vein 9개 core leaf(action·command-args·descriptor·gh-argv·gh-command-plan·outcome-parse-shape·output-parse·search-argv·search-parse) 삼단 전부 완결(T-0999 self-wire 머지). issue-still-relevant pre-check: 드라이버/T-0999 Follow-up 이 제안한 output-parse·search-parse self-wire 는 grep 결과 두 producer 모두 이미 self-wire 됨(중복). genuine 잔여 = 요약축 대비 미미러 leaf. 최소 foundational = outcome-report 베이스 producer(요약축 T-0590 mirror). self-wire·consistency 는 follow-up slice(established 순서). pr test-only 2파일 신설 dep[] file-disjoint stage5b 병렬. R-112 backbone ×1.5."
---

# T-1000 — daily-step dual-leg run report issue outcome-report 종단 컴포저 순수 helper 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, dual-leg run report 이슈 vein 의 9개 core leaf(action·command-args·descriptor·gh-argv·gh-command-plan·outcome-parse-shape·output-parse·search-argv·search-parse)는 producer→consistency→self-wire 삼단이 T-0999(search-argv self-wire) 머지로 전부 완결됐다. 이제 genuine 잔여는 **요약축(result) 대비 아직 daily-step 축에 미미러된 leaf** 의 이식이다.

요약축에는 daily-step 에 없는 finer leaf 가 존재한다: outcome-report / outcome-report-from-output / command-plan / publish-plan / search-hit-shape / search-json-fields / command-args-body-marker / command-args-labels-title. 그중 **outcome-report 베이스 producer**(요약축 `buildRealDataResultIssueOutcomeReport`, T-0590)가 가장 foundational 이다 — outcome-report-from-output 이 이를 조립(compose)하므로 반드시 먼저 이식돼야 한다. 또한 daily-step 축의 `outcome-parse-shape` 가드는 이미 output-parse 에 self-wire 되어 살아있으나(orphan 아님), 그 파싱된 outcome 을 사람-친화 실행 리포트로 묶는 종단 단계가 daily-step 에는 빠져있다.

본 task 는 요약축 `buildRealDataResultIssueOutcomeReport`(T-0590) 를 daily-step 축으로 mirror 한 순수 함수 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport` 를 신설한다 — 박제 outcome(`RealDataDailyStepDualLegRunReportIssueOutcome`: issueNumber/url, output-parse T-0903 산출) + run 식별자(`RealDataDailyStepDualLegRunReport`: gitSha/dateToken)를 결합해 caller(daily-test live wiring)가 로그/이슈 코멘트로 emit 할 수 있는 **결정론적 e2e 실행 리포트 descriptor** `{ issueNumber, url, gitSha, dateToken, summaryLine }` 로 묶는다.

**요약축 대비 축-차이(중요)**: 요약축은 run 식별자를 별도 `RealDataResultIssueRunRef` 로 받지만, daily-step 축은 별도 run ref 타입이 없고 **run 식별자(gitSha·dateToken)를 `RealDataDailyStepDualLegRunReport` 가 이미 보유**한다(descriptor T-0896 도 report 를 그대로 받는 것과 동일 관례). 따라서 본 producer 는 `(outcome, report)` 를 입력받는다 — 요약축의 `(outcome, run)` 을 daily-step 관례로 치환.

**self-wire·consistency 는 본 task 범위 아님(follow-up slice)**: 요약축 producer 는 반환 직전 두 값-정합 가드(summary-line-consistency T-0701 / output-consistency T-0725)를 self-wire 하지만, 그 두 가드는 daily-step 축에 **아직 존재하지 않는다**. established 순서(producer → consistency → self-wire; 예: descriptor T-0896→T-0988→T-0989)에 맞춰 본 task 는 **producer + 입력 guard 만** 이식하고 consistency 가드 신설·self-wire 는 별도 후속 slice 로 둔다. 즉 본 producer 는 요약축과 달리 반환 직전 consistency self-assert 없이 report 를 반환한다(단, 입력 guard 인 assertNonBlank/assertPositiveIssueNumber 는 그대로 이식).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` (T-0590) — mirror 원본 producer. `buildRealDataResultIssueOutcomeReport(outcome, run): RealDataResultIssueOutcomeReport`. 입력 guard(assertNonBlank gitSha/dateToken/url + assertPositiveIssueNumber issueNumber), url trim 정규화, `summaryLine = `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`` 합성, 새 객체 무공유 반환 패턴을 그대로 옮긴다. **단 반환 직전 두 self-wire 호출(assertRealDataResultIssueOutcomeReportSummaryLineConsistent / ...OutputConsistentWithInput)은 본 task 에서 이식하지 않는다** — daily-step 대응 가드 부재, follow-up slice.
- `test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts` (T-0590) — mirror 할 spec 의 R-112 배치(happy 다양성 · 입력 guard error path · 무공유/mutate-0 · §9 secret 미노출) 참고. daily-step 축으로 이름·타입만 치환하고 self-wire 검증 case 는 제외(본 producer 미배선).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` (T-0903) — `RealDataDailyStepDualLegRunReportIssueOutcome`(issueNumber:number, url:string) 정의 위치. 본 producer 의 `outcome` 입력 타입을 여기서 `import type`.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport`(gitSha·dateToken 등 보유) 정의 위치. 본 producer 의 `report` 입력 타입을 여기서 `import type`. run 식별자가 report 에 있음을 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896) — daily-step 축이 별도 RunRef 없이 `report` 를 직접 받아 gitSha/dateToken 을 소비하는 관례(assertNonBlank 메시지 문구·runToken `${dateToken}@${gitSha}` 합성)의 daily-step 선례. summaryLine 토큰 순서·구분자를 이 관례에 정합시킨다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` 신설 — 순수 함수 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome: RealDataDailyStepDualLegRunReportIssueOutcome, report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueOutcomeReport` export. 반환 타입 interface `RealDataDailyStepDualLegRunReportIssueOutcomeReport { issueNumber: number; url: string; gitSha: string; dateToken: string; summaryLine: string; }` export. 입력 타입은 각각 output-parse(T-0903)·run-report(T-0894)에서 `import type`(value import 0). 실 네트워크/env/DB/gh 실행/외부 라이브러리 0 — 순수 함수.
- [ ] 입력 guard 이식 — `report.gitSha` 빈/공백-only → throw, `report.dateToken` 빈/공백-only → throw, `outcome.url` 빈/공백-only → throw, `outcome.issueNumber` 0/음수/비정수 → throw(각 **별도 분기**, daily-step descriptor T-0896 assertNonBlank 문구·T-0898 assertPositiveNumber 규약과 동형). url 은 `.trim()` 정규화. summaryLine 은 daily-step runToken 관례(`${dateToken}@${gitSha}`)에 정합하는 결정론 합성(동일 입력 → byte-identical).
- [ ] **self-wire·consistency 미이식 명시** — 요약축의 반환 직전 consistency self-assert 두 호출은 본 producer 에 넣지 않는다(daily-step 대응 가드 부재, follow-up slice). 정상 산출 경로는 report 를 그대로 반환.
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` 신설 — R-112 4종:
  - **Happy-path**: 정합 `(outcome, report)` → throw 0 으로 `{ issueNumber, url, gitSha, dateToken, summaryLine }` 정상 산출 assert 1+. issueNumber/url/gitSha/dateToken 전파 값·url trim 정규화·summaryLine byte-identical(동일 입력 두 번 호출 deep-equal) 검증. issueNumber(1·큰 수)·url(trailing 공백/개행 포함 → trim)·gitSha/dateToken 다양성 각각 정합.
  - **Error path**: 각 입력 guard 분기가 개별적으로 throw 함을 assert — (a) gitSha 빈/공백, (b) dateToken 빈/공백, (c) url 빈/공백, (d) issueNumber 0, (e) 음수, (f) 비정수 각각 별도 case 1+(예외 상황 분기마다 cover).
  - **Flow/branch cover**: 정상 분기 + 각 guard throw 분기 모두 test 로 도달.
  - **Negative 충분 cover**: (a) 산출 report 가 입력 outcome/report 객체를 mutate 하지 않음(입력 deep-equal 보존) assert, (b) 매 호출 새 report 객체 반환(무공유 — 두 호출 결과가 별개 참조) assert, (c) summaryLine 이 gitSha/dateToken/issueNumber/url 전파 값과 정합(토큰 순서·구분자 회귀 감지) assert 1+.
  - **§9 / §12 안전성**: fixture/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 저장 0(본 리포트는 issueNumber/url/run 식별자만, REQ-059 raw 미저장 정합) assert.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). helper·spec 모두 순수/결정론이라 신설 helper line/branch/func 완전 커버.

## Out of Scope

- 반환 직전 consistency self-wire(요약축 T-0701/T-0725 대응) 이식 0 — daily-step 대응 가드 부재. 별도 후속 slice(먼저 consistency 가드 신설, 그다음 self-wire).
- outcome-report-from-output(요약축 T-0589 계열) mirror 0 — 본 producer(outcome-report 베이스)에 의존하는 상위 조립, 별도 후속 leaf.
- 여타 미미러 leaf(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title) mirror 0 — 각 별도 slice.
- 기존 daily-step vein helper(output-parse T-0903 / descriptor T-0896 / run-report T-0894 / 9개 core leaf) 수정 0 — read-only `import type` 만.
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).
- 실 gh 호출 / `execFile('gh', argv)` / stdout 파싱(T-0903 위임) 재현 0 — 본 producer 는 이미 파싱된 outcome + report → 리포트 descriptor 만 산출.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice 1순위) daily-step outcome-report producer 의 값-정합 consistency 가드 신설 — 요약축 summary-line-consistency(T-0701) 또는 output-consistency(T-0725) mirror. report 5 필드가 입력 `(outcome, report)` 으로부터 producer 재호출 없이 독립 재유도한 expected 와 deep-equal 정합한지 대조하는 순수 fail-fast 가드 + colocated R-112 spec.
- (그다음) 위 consistency 가드를 본 producer 반환 직전 self-wire → outcome-report leg 삼단 완결(producer T-1000 → consistency → self-wire), 9개 core leaf 와 동형.
- (이후) outcome-report-from-output leaf mirror — 본 outcome-report 베이스 + output-parse(T-0903) 를 조립하는 상위 producer. 이어서 command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등 요약축 대비 미미러 leaf 순차 이식 검토.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제 + outcome-report 를 로그/코멘트로 emit 하도록 재배선.
