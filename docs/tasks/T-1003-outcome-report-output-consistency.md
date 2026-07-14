---
id: T-1003
title: daily-step dual-leg run report issue outcome-report output-consistency drift-guard 신설 (assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput — 산출 report 5필드를 (outcome, runReport) 로부터 컴포저 재호출 없이 독립 재유도 deep-equal 대조, 요약축 T-0725 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 600
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-outcome-report-output-consistency
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency.spec.ts
sizeExempt: true
exemptReason: "가드+colocated R-112 spec 은 분할 불가 atomic 단위(spec 은 check-spec-presence.sh + coverageThreshold 강제로 필수, 가드만 머지 시 CI fail). 요약축 T-0725 faithful mirror = 가드 ~230 LOC + spec ~450 LOC ≈ 600 LOC(2파일 ≤ 5). 5필드 독립 재유도라 summary-line(T-1001, 500 LOC) 대비 분기·negative case 가 많아 spec 이 exhaustive. split 하면 orphan 가드(무-spec) 가 되어 R-112/CI 위반 — 단일 task 유지가 정합."
plannerNote: "P5 §109 test-hardening — outcome-report 삼단(producer T-1000→summary-line-consistency T-1001→self-wire T-1002) 완결 후 T-1002 Follow-up 1순위 = output-consistency 가드(요약축 T-0725 analog) 신설. issue-still-relevant pre-check(grep origin/main): daily-step 축엔 summary-line-consistency 만 존재, output-consistency 가드 부재(genuine, 중복 아님). 요약축 T-0725(컴포저 재호출 0, (outcome, run) 독립 재유도 5필드 deep-equal) 를 daily-step (outcome, runReport) 관례로 mirror. producer(T-1000) 무변경(self-wire 는 후속 slice). cap-bend pre-justified: 가드+spec atomic 분할불가 × T-0725 faithful mirror ≈ 600 LOC → sizeExempt(T-1001/T-0725 precedent). pr test-only 2파일 신설 dep[] file-disjoint stage5b 병렬."
---

# T-1003 — daily-step dual-leg run report issue outcome-report output-consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, daily-step dual-leg run report 이슈 박제 outcome-report 종단 컴포저 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts`, T-1000)의 삼단(producer T-1000 → summary-line-consistency T-1001 → self-wire T-1002)은 T-1002 머지(PR #896 squash 26a35c96)로 완결됐다.

요약축(result)에는 outcome-report 컴포저에 **두 개의 값-정합 가드**가 붙어있다 — (1) summary-line-consistency(T-0701, `summaryLine` 단일 필드 내부 정합), (2) **output-consistency**(T-0725, `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput`, 산출 report 5필드 전체를 입력 `(outcome, run)` 으로부터 **컴포저 재호출 없이 독립 재유도**한 expected 와 deep-equal 대조). daily-step 축은 (1)만 mirror 됐고 **(2) output-consistency 가드는 아직 부재**다(issue-still-relevant pre-check: `test/helpers/` grep 결과 daily-step 축엔 `...outcome-report-summary-line-consistency.ts` 만 존재, `...outcome-report-output-consistency.ts` 미존재 — genuine, 중복 아님).

**왜 두 번째 가드가 필요한가(요약축 T-0725 동기 그대로)**: summary-line-consistency(T-1001)는 `summaryLine` 이 구성 4필드와 내부 정합한지만 본다. 그래서 issueNumber/url/gitSha/dateToken **전파** 가 어긋나거나 url trim 정규화가 누락돼도, summaryLine 만 그 어긋난 구성 필드에 정합하면 통과한다 — **컴포저 산출 5필드 전체를 입력으로부터 독립 재유도해 대조하는 값-정합 가드는 부재**다. 본 task 는 컴포저 재호출 없이 `(outcome, runReport)` 만으로 expected 5필드를 독립 재유도(issueNumber/gitSha/dateToken 전파 → `url = outcome.url.trim()` → summaryLine 동형 합성)한 뒤 산출 `report` 와 deep-equal 대조하는 순수 가드를 신설해, 전파·정규화 drift 가 build-time fail-fast 로 차단되게 한다.

본 task 는 **가드 helper + colocated R-112 spec 신설만** 한다. producer(T-1000) 반환 직전 self-wire 배선은 별도 후속 slice(요약축 T-0726 의 두 번째 self-assert call mirror). producer·기존 summary-line 가드 무변경.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.ts` (T-0725, 요약축 mirror 원본) — 신설 가드의 직접 형태 선례. `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run): void`. 구조: `assertInputObject`(non-null 객체/비배열) + `assertNonBlankInput` + `assertPositiveIssueNumberInput` + `reDeriveExpectedReport`(컴포저 재호출 0 독립 재유도) + `assertReportStructure`(산출 5필드 type) + `isReportDeepEqual`(5키·추가필드 drop). TypeError(구조 결손) / RangeError(값 정합 위반) 2분기 정책. url trim·summaryLine 템플릿 byte-identical 재구현. **daily-step 축으로 이름·타입만 치환**한다.
- `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts` (T-0725) — mirror 할 spec 의 R-112 배치(happy 다양성 · 각 입력 guard error path · 5필드 개별 drift RangeError · 추가필드 drop · 무공유/mutate-0 · §9 secret 미노출) 참고. daily-step 축으로 이름·타입만 치환.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` (T-1000) — 검증 대상 산출 타입 `RealDataDailyStepDualLegRunReportIssueOutcomeReport`(`{issueNumber, url, gitSha, dateToken, summaryLine}`) 정의 위치. **`import type` 만**(value import 0 — 컴포저 `build...` 재호출 금지, 재호출은 양방향 drift 상쇄로 무의미). summaryLine 템플릿(`[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`)·url trim·양정수/빈공백 guard 규약을 본 가드가 **독립 재구현**할 근거로만 읽는다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.ts` (T-1001) — daily-step 축 consistency 가드 관례(REPORT_NUMBER_FIELDS/REPORT_STRING_FIELDS 순회·TypeError/RangeError 에러 정책·oracle 독립성 주석·`import type` only) 선례. 본 가드도 동일 관례를 따른다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` (T-0903) — `RealDataDailyStepDualLegRunReportIssueOutcome`(issueNumber:number, url:string) 정의 위치. 본 가드의 `outcome` 입력 타입을 여기서 `import type`.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport`(gitSha·dateToken 등 보유) 정의 위치. 본 가드의 `runReport` 입력 타입을 여기서 `import type`. run 식별자(gitSha/dateToken)가 report 에 있음을 확인 — 요약축의 별도 `RealDataResultIssueRunRef` 를 daily-step 관례(runReport 직접 소비)로 치환.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency.ts` 신설 — 순수 가드 `export function assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(report: RealDataDailyStepDualLegRunReportIssueOutcomeReport, outcome: RealDataDailyStepDualLegRunReportIssueOutcome, runReport: RealDataDailyStepDualLegRunReport): void`. 세 입력 타입은 각각 producer(T-1000)·output-parse(T-0903)·run-report(T-0894)에서 **`import type`**(value import·컴포저 `build...` 재호출 0). 실 네트워크/env/DB/gh 실행/외부 라이브러리 0 — 순수 함수.
- [ ] 독립 재유도(요약축 T-0725 동형) — `(outcome, runReport)` 만으로 expected 5필드를 컴포저 재호출 없이 재구현: runReport.gitSha/dateToken 빈/공백 → throw, outcome.url 빈/공백 → throw, outcome.issueNumber 양정수(0/음수/비정수 throw), `url = outcome.url.trim()` 정규화, summaryLine 을 `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}` 로 **byte-identical 동형 합성**, `{issueNumber, url, gitSha, dateToken, summaryLine}` 5키 정규화. 산출 report 와 5필드 값·키 집합(추가필드 drop = 키 정확히 5개) deep-equal(===) 대조.
- [ ] 에러 정책 2분기 — report/outcome/runReport 비-non-null-객체/배열·report 5필드 type 위반·outcome.issueNumber 비양정수·outcome.url 빈/공백·runReport.gitSha/dateToken 빈/공백 → **TypeError**(구조 결손). 재유도 expected 와 report 가 5필드 값·추가필드 면에서 drift → **RangeError**(기대 vs 실측 노출). silent 통과 0, fail-fast. 공백·대소문자 민감(추가 trim·case-fold 0 — url trim 만 컴포저 규약 재현). 비변형/순수(report·outcome·runReport 읽기·비교만, 쓰기 0).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency.spec.ts` 신설(colocated) — R-112 4종:
  - **Happy-path**: 정합 `(report, outcome, runReport)` → throw 0 통과 assert 1+. issueNumber(1·큰 수)·url(trailing 공백/개행 → producer 가 trim 한 산출)·gitSha/dateToken 다양성 각각 정합 통과.
  - **Error path**: 각 TypeError 분기가 개별적으로 throw — (a) report non-object/배열, (b) report 5필드 각 type 위반, (c) outcome non-object, (d) runReport non-object, (e) outcome.url 빈/공백, (f) issueNumber 0/음수/비정수, (g) runReport.gitSha/dateToken 빈/공백 각각 별도 case 1+(예외 상황 분기마다 cover).
  - **Flow/branch cover**: 정상 통과 분기 + 각 TypeError guard 분기 + RangeError 값-drift 분기 모두 test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) issueNumber/url/gitSha/dateToken **각 필드 개별** drift 가 RangeError 로 잡힘(summary-line 가드가 놓치는 전파 drift 를 본 가드가 잡음을 증명 — url raw(비trim) drift, gitSha↔dateToken swap, issueNumber mismatch 각 1+), (b) summaryLine 만 정합하고 구성 필드가 어긋난 report 가 RangeError 로 잡힘 1+, (c) 추가필드 누설(6키) report 가 RangeError(추가필드 drop 불일치) 1+, (d) 가드가 report/outcome/runReport 를 mutate 하지 않음(호출 전후 deep-equal 보존) assert 1+.
  - **§9 / §12 안전성**: fixture/에러 메시지 어디에도 실 secret/PAT/credential 실 값 미노출(비시크릿 더미 string), raw 활동 본문(commit/PR/issue payload 전문) 저장 0 assert.
- [ ] producer(T-1000) `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport` 본문 수정 0, summary-line-consistency 가드(T-1001) 수정 0 — 본 task 는 output-consistency 가드 **신설만**(self-wire·producer 무변경). 두 파일은 read-only(`import type`/참조).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 가드·spec 모두 순수/결정론이라 line/branch/func 완전 커버.

## Out of Scope

- producer(T-1000) 반환 직전 output-consistency 가드 self-wire 배선 0 — 별도 후속 slice(요약축 T-0726 의 두 번째 self-assert call mirror). 본 task 는 가드 신설만.
- summary-line-consistency 가드(T-1001) 로직 수정 0.
- outcome-report-from-output(요약축 T-0589 계열) mirror 0 — 본 outcome-report 베이스에 의존하는 상위 조립, 별도 후속 leaf.
- 여타 미미러 leaf(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title) mirror 0 — 각 별도 slice.
- 기존 daily-step vein helper(producer T-1000 / summary-line T-1001 / output-parse T-0903 / run-report T-0894 / 9개 core leaf) 수정 0 — 신설 가드·그 spec 두 파일 외 무변경.
- 입력 정규화/자동 복구/재합성/기본값 채움 0 — 가드는 drift 시 throw 만(복구는 호출처 책임).
- 컴포저 `build...` 재호출(재호출 deep-equal) 0 — 독립 재유도가 핵심(재호출은 양방향 drift 상쇄).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice 1순위) 본 output-consistency 가드를 producer(T-1000) 반환 직전 self-wire — 요약축 T-0726 의 두 번째 self-assert call mirror. summary-line self-wire(T-1002) 아래에 output-consistency self-assert 를 추가해 outcome-report leg 를 요약축과 완전 동형화(producer → 두 가드 self-wire).
- (그다음) outcome-report-from-output leaf mirror — 본 outcome-report 베이스 + output-parse(T-0903) 조립하는 상위 producer. 이어서 command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등 요약축 대비 미미러 leaf 순차 이식 검토.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제 + outcome-report 를 로그/코멘트로 emit 하도록 재배선.
