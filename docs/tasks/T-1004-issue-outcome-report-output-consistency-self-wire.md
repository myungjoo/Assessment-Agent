---
id: T-1004
title: daily-step dual-leg run report issue outcome-report 반환 직전 output-consistency drift-guard self-wire (buildRealDataDailyStepDualLegRunReportIssueOutcomeReport 산출 5필드를 (outcome, runReport) 로부터 독립 재유도 대조하는 T-1003 가드를 단일 반환 지점에 배선 — 요약축 T-0726 의 두 번째 self-assert call mirror)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts
plannerNote: "P5 §109 test-hardening — outcome-report leg 요약축 완전 동형화. issue-still-relevant pre-check(grep origin/main): output-consistency 가드(T-1003) 박제됨 + producer 반환점에 그 가드 미배선(OutputConsistent grep 0, '두 번째 self-assert 미배선(후속 slice)' 주석 잔존) 확인 → genuine, 중복 아님. summary-line self-wire(T-1002) 아래에 output-consistency self-assert 1개 추가 = 요약축 T-0726 두 번째 call mirror. producer 2번째 param 명이 report(run report)라 self-wire 호출은 (outcomeReport, outcome, report). pr test-only 2파일(producer+spec) file-disjoint dep[] stage5b 병렬."
---

# T-1004 — daily-step dual-leg run report issue outcome-report 반환 직전 output-consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, daily-step dual-leg run report 이슈 박제 outcome-report 종단 컴포저 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts`, T-1000)에는 요약축(result)과 동형으로 **두 개의 값-정합 가드**가 붙어야 한다 — (1) summary-line-consistency(`assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent`, T-1001, `summaryLine` 단일 필드 내부 정합), (2) output-consistency(`assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput`, T-1003, 산출 report 5필드 전체를 입력 `(outcome, runReport)` 으로부터 **컴포저 재호출 없이 독립 재유도**한 expected 와 deep-equal 대조).

producer 반환 직전 self-wire 는 (1)만 배선돼 있다(T-1002, PR #896 squash 26a35c96). (2) output-consistency 가드는 T-1003(PR #897 squash 23fd6122)으로 helper + colocated spec 이 main 에 박제됐으나, **아직 producer 반환 경로에 self-wire 되지 않았다** — issue-still-relevant pre-check(origin/main): producer 파일 `OutputConsistent` grep 0, 본문에 "output-consistency 가드(요약축 T-0726 analog)는 daily-step 축 미존재라 그 두 번째 self-assert 는 미배선(후속 slice)" 주석이 잔존(T-1003 머지 후 전제가 이미 해소됐으나 주석·배선은 미갱신 — genuine gap, 중복 아님).

**왜 두 번째 self-assert 가 필요한가(요약축 T-0726 동기 그대로)**: summary-line self-wire(T-1002)는 `summaryLine` ↔ 구성 4필드 내부 정합만 본다. 그래서 issueNumber/url/gitSha/dateToken **전파** drift 나 url trim 정규화 누락은 summaryLine 만 그 어긋난 구성 필드에 정합하면 통과한다 — 산출 5필드 전체를 입력으로부터 독립 재유도해 대조하는 값-정합 가드가 반환 경로에 없으면 그 drift 가 step ④ 박제/로그 emit wiring 으로 새기 전에 잡히지 않는다. 본 task 는 T-1003 가드를 producer 단일 반환 지점(기존 summary-line self-assert 다음)에 배선해, **어떤 경로로 producer 를 호출하든** 전파·정규화 drift 가 build-time fail-fast throw 로 차단되게 한다. 가드는 read-only(report/outcome/runReport mutate 0)이며 정상 산출물에는 void 반환 — 관측 불가능하게 동일한 report 를 그대로 반환한다.

본 task 로 outcome-report leg 는 요약축과 완전 동형(producer → 두 가드 self-wire)으로 닫힌다. 가드 본체(T-1003)·summary-line 가드(T-1001)·summary-line self-wire(T-1002) 무변경 — 본 task 는 두 번째 가드의 **배선(호출 1줄 + top-level import)만**.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` (T-1000, self-wire 대상 producer — 현 origin/main) — 시그니처 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome: RealDataDailyStepDualLegRunReportIssueOutcome, report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueOutcomeReport`. 단일 반환 지점 `return outcomeReport;` 직전에 **이미 summary-line self-assert**(`assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(outcomeReport);`)가 있음. 그 호출 **다음**·`return outcomeReport;` **직전**에 output-consistency self-assert 1줄을 추가한다. **주의: producer 의 두 번째 파라미터 명이 `report`(타입 `RealDataDailyStepDualLegRunReport`, 즉 run report)** 이고, output-consistency 가드의 첫 인자는 산출 outcome-report(`outcomeReport`)·세 번째 인자가 runReport 다 — 따라서 self-wire 호출은 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(outcomeReport, outcome, report);`(guard arg1=outcomeReport, arg2=outcome, arg3=producer 의 `report` 파라미터=runReport). 기존 입력 guard(`assertNonBlank`/`assertPositiveIssueNumber`)·summaryLine 합성 라인·객체 조립·summary-line self-assert 는 **그대로 보존**하고, "output-consistency 가드 … 미배선(후속 slice)" 주석을 self-wire 배선 주석으로 교체한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency.ts` (T-1003, self-wire 할 가드 — 현 origin/main) — export 시그니처 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(report: RealDataDailyStepDualLegRunReportIssueOutcomeReport, outcome: RealDataDailyStepDualLegRunReportIssueOutcome, runReport: RealDataDailyStepDualLegRunReport): void`(정상 void / 구조 결손 TypeError / 값 정합 위반 RangeError). 세 입력 타입을 전부 `import type` only 로만 가져오고 producer value import 0 → producer 가 본 가드를 **top-level value import** 해도 CommonJS 순환 의존 0(요약축 T-0726 / T-0724 top-level import mirror — lazy require 불요).
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` (T-0726 self-wire 완료본, 요약축 선례 — main 박제) — **self-wire 의 직접 형태 선례**. 단일 return 직전 summary-line self-assert **다음**에 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run)` 두 번째 self-assert 를 배치한 형태·top-level value import·byte-identical 무변경·기존 summary-line self-wire 유지 스타일을 daily-step 축으로 옮긴다.
- `docs/tasks/T-0726-realdata-e2e-result-issue-outcome-report-output-value-consistency-self-wire.md` — **self-wire idiom 참조 task**(top-level import 위치·return 직전 배선·jest.spyOn 호출수/인자순서 검증·throw 선전파·byte-identical 무변경·기존 self-wire 유지 패턴의 직접 template). 본 task 는 인자 3개(report, outcome, runReport)로 T-0726 과 동형이며 producer 두 번째 param 명만 `report`(run) 로 다르다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` (T-1000/T-1002 로 확장된 producer spec — 확장 대상) — 기존 happy/error/negative/self-wire(summary-line) describe 를 유지한 채, output-consistency self-wire describe(가드 호출수 1·인자 순서 (outcomeReport, outcome, report)·throw 선전파·byte-identical 무변경)를 추가한다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` 상단에 `import { assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-output-consistency";`(top-level value import — 가드가 producer 를 type-only 로만 import 하므로 순환 0) 추가. 기존 summary-line 가드 value import 는 유지.
- [ ] `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport` 의 단일 반환 지점(`return outcomeReport;`) **직전**, 기존 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(outcomeReport);` 호출 **다음**에 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportOutputConsistentWithInput(outcomeReport, outcome, report);` self-assert 1줄 추가. 인자 순서 `(outcomeReport, outcome, report)` 준수(guard 시그니처 `(report, outcome, runReport)` 에 대응 — 첫 인자=산출 outcomeReport, 셋째 인자=producer 의 `report` 파라미터=runReport). "output-consistency 가드 … 미배선(후속 slice)" 주석을 self-wire 의도(전파·정규화 drift fail-fast 차단·read-only·void·기존 두 가드 공존) 한국어 주석으로 교체.
- [ ] 컴포저 산출은 **byte-identical 불변**(가드는 outcomeReport·outcome·report 를 읽기·재유도·비교만, 쓰기 0). producer 시그니처·반환 타입·정상 산출물(5필드 값·순서·참조-무공유 = 매 호출 새 객체) 무변경. 기존 summary-line self-wire(T-1002)는 **유지**(대체·삭제 금지 — summaryLine 내부 정합 가드와 5필드 전체 값 가드 둘 다 반환 직전 호출).
- [ ] 가드 본체(`...outcome-report-output-consistency.ts`, T-1003)·summary-line 가드 본체(T-1001)·`src/` 는 **무변경**(test-only self-wire — 호출만 추가).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` 확장 — R-112 4종(output-consistency self-wire 관점):
  - **Happy-path 1+**: 정합 입력(issueNumber 양수·큰 수·url trailing 공백/개행 → trim 산출·gitSha/dateToken 비공백 다양성)으로 producer 호출 시 배선된 output-consistency 가드가 throw 0 통과하고 기존과 동일한 5필드 report 반환(self-wire 후 무회귀, byte-identical). `jest.spyOn`(output-consistency 가드 모듈)으로 가드가 정확히 `(반환될 outcomeReport, 입력 outcome, 입력 report)` 로 1회 호출됨을 검증 — 호출 횟수 1·첫 인자가 반환 report 와 동일 참조·둘째 인자가 입력 outcome·셋째 인자가 입력 report(runReport)·인자 순서 정확.
  - **Error path 1+**: 가드 모듈을 spy 로 mock 해 output-consistency 가드가 RangeError(값 정합 위반)/TypeError(구조 결손)를 throw 하도록 강제하면 producer 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증 — RangeError·TypeError 각 1+.
  - **Flow/branch cover**: 정상(두 가드 void → return report) 경로 + output-consistency 가드 throw 선전파 경로 각 test 도달. self-wire 추가는 분기 0(단일 return 직전 1 호출).
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 기존 컴포저 자체 throw 경로(report.gitSha 빈/공백·report.dateToken 빈/공백·outcome.url 빈/공백·outcome.issueNumber 0/음수/비정수)가 self-wire 도달 **전**에 throw 돼 output-consistency 가드를 거치지 않음(spy 0회 호출)을 각 유형 1+ 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음), (b) 결정성: self-wire 후에도 동일 입력 두 번 호출 산출이 deep-equal·참조-무공유 유지 + spy 가 호출당 1회씩(두 번 호출 시 2회) 1+, (c) producer 가 입력 outcome/report 를 mutate 하지 않음(호출 전후 입력 deep-equal 보존) 1+, (d) summary-line self-assert(T-1002)와 output-consistency self-assert 가 **둘 다** 호출됨(각 spy 1회) 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0 assert.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). self-wire 후 producer 파일 cov 100% 유지 목표. 전체 unit suite green(기존 producer spec·summary-line spec·output-consistency spec 무회귀).

## Out of Scope

- 가드 본체(`...outcome-report-output-consistency.ts`, T-1003)·summary-line 가드 본체(T-1001) 로직·시그니처·에러 메시지 수정 0 — 본 task 는 producer 로의 **배선**만.
- 기존 summary-line self-wire(T-1002) 제거/대체 0 — summaryLine 내부 정합 가드와 5필드 전체 값 가드 공존(반환 직전 두 self-assert).
- 컴포저 산출 규약(입력 guard·url trim 정규화·summaryLine 합성·`{issueNumber, url, gitSha, dateToken, summaryLine}` 정규화) 수정 0 — self-wire 는 검증만 하고 값 불변(byte-identical).
- top-level import 대신 lazy require 사용 0 — 가드가 type-only import only 라 순환 0, top-level value import 가 정답(요약축 T-0726/T-0724 mirror).
- outcome-report-from-output(요약축 T-0589 계열) mirror 0 — 본 outcome-report 베이스에 의존하는 상위 조립, 별도 후속 leaf.
- 여타 미미러 leaf(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title) mirror 0 — 각 별도 slice.
- 기존 daily-step vein helper(가드 T-1003/T-1001 / output-parse T-0903 / run-report T-0894 / 9개 core leaf) 수정 0 — producer 와 그 spec 두 파일 외 무변경. (output-consistency spec 은 무변경 — 가드 본체 불변이므로 touchesFiles 에서 제외; 동기가 불가피하면 describe/호출 count assert 정도만.)
- `src/` production 코드 변경 0(타입 read-only + 가드 value import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice) outcome-report-from-output leaf mirror — 본 outcome-report 베이스 + output-parse(T-0903) 를 조립하는 상위 producer(요약축 T-0589 계열). 이어서 command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등 요약축 대비 미미러 leaf 순차 이식 검토.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제 + outcome-report 를 로그/코멘트로 emit 하도록 재배선.
