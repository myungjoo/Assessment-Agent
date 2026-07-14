---
id: T-1005
title: daily-step dual-leg run report issue outcome-report from-output 컴포저 신설 (buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput — gh create/edit stdout + run report → 실행 리포트, output-parse → outcome-report 2단 위임 순수 합성, 요약축 T-0596 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 340
estimatedFiles: 2
created: 2026-07-15
sizeExempt: true
exemptReason: "새 컴포저 helper + colocated R-112 spec 은 atomic(helper 는 spec 없이 merge 불가 — R-112). 요약축 선례 from-output producer 110 LOC + spec 466 LOC = 576 LOC 대비, 본 slice 는 self-wire·consistency 가드 제외한 bare 2단 위임 컴포저 + 집중 spec 으로 ~340 LOC 억제. helper+spec 분리 불가라 T-1000/T-1003 처럼 atomic sizeExempt."
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts
plannerNote: "P5 §109 test-hardening — outcome-report from-output leaf(요약축 T-0596 mirror). issue-still-relevant pre-check(grep origin/main): daily-step 축 FromOutput 컴포저 0건(git grep -c FromOutput daily-step helpers = none) 확인 → genuine, 중복 아님. building block(output-parse T-0903·outcome-report base T-1000) 둘 다 main 박제됨. self-wire·consistency 가드는 후속 slice(요약축 T-0663/T-0664 계열). pr test-only 2파일 신설 file-disjoint dep[] stage5b 병렬."
---

# T-1005 — daily-step dual-leg run report issue outcome-report from-output 컴포저 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 는 요약축(result/rolling 이슈)과 daily-step 축 두 갈래로 동형 박제 중이다. 요약축은 이미 **post-실행 단일 진입 컴포저** `buildRealDataResultIssueOutcomeReportFromOutput`(T-0596, `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts`)를 갖는다 — `gh issue create` / `gh issue edit <n>` 의 stdout + run 식별자를 받아 (1) output-parse → outcome, (2) outcome-report build 의 2단 위임을 단일 순수 함수로 합성한다.

daily-step 축에는 이 **from-output 컴포저가 아직 없다**. building block 은 둘 다 main 에 박제돼 있다 — (a) output-parse `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → `RealDataDailyStepDualLegRunReportIssueOutcome {issueNumber, url}`(`...issue-output-parse.ts`), (b) outcome-report base `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome, report)` → `RealDataDailyStepDualLegRunReportIssueOutcomeReport`(T-1000). 그러나 live runner 가 이슈 박제 직후 받는 "create/edit stdout + run report" 묶음을 실행 리포트로 바꾸려면 아직 두 helper 를 caller 가 수동으로 엮어야 한다. 본 컴포저가 그 2단을 단일 순수 함수로 합성해 daily-step 축 post-실행 단일 진입점을 닫는다 — **요약축 T-0596 의 daily-step mirror**.

issue-still-relevant pre-check(origin/main grep): daily-step helpers 에 `FromOutput` 어휘 0건(`git grep -c FromOutput 'test/helpers/realdata-e2e-daily-step*'` = none) → genuine gap, 중복 아님. self-wire(요약축 T-0664 계열)·from-output-consistency 가드(요약축 T-0663 계열)는 본 slice 범위 밖(후속 leaf) — 본 task 는 **bare 2단 위임 컴포저 + spec 만**.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` (T-0596, 요약축 선례 — main 박제) — **직접 template**. 단, 현 main 본체는 T-0664 self-wire 가 배선된 형태(`assertRealDataResultIssueOutcomeReportConsistentWithOutput` 호출 포함)다. 본 task 는 그 self-wire **이전** 형태(2단 위임 + 바로 return)를 mirror 한다 — self-wire·consistency 가드는 후속 slice. 합성 순서·throw 전파(자체 try/catch 0)·결정론·무공유·raw 미저장·dependency-free 주석 backbone 을 daily-step 축으로 옮긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — 위임 (1). export `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout: string): RealDataDailyStepDualLegRunReportIssueOutcome`. stdout URL 미발견·비-github·`/pull/`·issueNumber 0/선행0/비정수 → throw. outcome 타입 `RealDataDailyStepDualLegRunReportIssueOutcome {issueNumber, url}` 도 이 파일 export(84행 interface).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` (T-1000) — 위임 (2). export `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome: RealDataDailyStepDualLegRunReportIssueOutcome, report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueOutcomeReport`. **두 번째 파라미터 명은 `report`(타입 `RealDataDailyStepDualLegRunReport` = run report)**. run.gitSha / run.dateToken 빈/공백 → guard throw. 산출 타입 `RealDataDailyStepDualLegRunReportIssueOutcomeReport` 도 이 파일 export(83행 interface).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — run report 타입 `RealDataDailyStepDualLegRunReport` 원 정의(위 위임 (2)의 두 번째 인자 타입). `import type` only 로 가져온다.
- `docs/tasks/T-0596-realdata-e2e-result-issue-outcome-report-from-output.md` — 요약축 from-output 컴포저 신설 task(합성 순서·위임 재구현 0·throw 선전파·순수성 acceptance 형태의 직접 참조). 본 task 는 두 번째 인자가 run report(요약축은 RunRef)인 점만 다르고 동형.
- **신규 colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts` (컴포저 옆 colocated — R-112 spec). 요약축 선례 spec `realdata-e2e-result-issue-outcome-report-from-output.spec.ts`(466 LOC) 의 describe 구조를 daily-step 축으로 이식.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.ts` 신설 — export `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(stdout: string, report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueOutcomeReport`. 본체는 정확히 2단 위임: (1) `const outcome = parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout);` (2) `const outcomeReport = buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome, report);` → `return outcomeReport;`. 자체 try/catch 0(위임 throw 그대로 전파). 입력 타입은 `import type` only(`RealDataDailyStepDualLegRunReport`), 위임 함수는 value import.
- [ ] URL 파싱·issueNumber 검증·run guard·summaryLine 합성 로직 **재구현 0** — 전부 위임 호출만(요약축 T-0596 "위임 재구현 0" mirror). 파일 상단 주석에 책임(post-실행 단일 진입점)·위임 순서·throw 전파·결정론/무공유·raw 미저장(REQ-059)·dependency-free 를 한국어로 박제.
- [ ] self-wire·from-output-consistency 가드 배선 **0**(본 slice 범위 밖 — 후속 leaf). 컴포저는 위임 (2) 산출을 바로 반환.
- [ ] 산출 report 는 위임 (2)가 매 호출 새 객체로 산출 → 본 컴포저도 매 호출 새 객체 반환(무공유). 입력 외 상태(시각·난수·env·network·DB·gh) 의존 0(결정론). 입력 stdout(불변)·report(읽기만, mutate 0).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts` 신설 — R-112 4종:
  - **Happy-path 1+**: 정합 create stdout(github issues URL 포함)·edit stdout·비공백 gitSha/dateToken 다양성 + issueNumber 양수/큰 수 조합으로 컴포저 호출 시 5필드 report(`{issueNumber, url, gitSha, dateToken, summaryLine}`) 반환·값 정합 확인. `jest.spyOn`(output-parse·outcome-report 두 위임 모듈)으로 위임 순서(parse 먼저 1회 → build 다음 1회)·인자 전파(build 첫 인자 = parse 반환 outcome, 둘째 인자 = 입력 report) 검증.
  - **Error path 1+**: (1) 위임 parse throw 경로 — stdout URL 미발견·비-github·`/pull/`·issueNumber 0/선행0/비정수 → 컴포저가 parse throw 그대로 선전파(삼키지 않음) + **build 위임 미도달(spy 0회 호출)** 확인, 각 유형 1+. (2) 위임 build guard throw 경로 — report.gitSha 빈/공백·report.dateToken 빈/공백·outcome.issueNumber 비양수(parse 우회 mock 시) → build guard throw 선전파, 각 1+.
  - **Flow/branch cover**: 정상(parse void→build void→return) 경로 + parse throw 조기 종료 경로 + build throw 경로 각 test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) 결정성 — 동일 (stdout, report) 두 번 호출 산출이 deep-equal·참조-무공유(!==) 유지 + summaryLine byte-identical 1+, (b) 무-mutate — 호출 전후 입력 report deep-equal 보존(입력 객체 참조 불변) 1+, (c) parse 조기 throw 시 build spy 0회(fail-fast 가 build 로 새지 않음) 각 유형 1+, (d) 반환 report 가 입력/다음 호출 결과와 무공유(새 객체) 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0 assert.
- [ ] `src/` 무변경(test helper 단독 — 위임 함수·타입 import 재사용만). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 컴포저 파일 cov 100% 목표. 전체 unit suite green(기존 위임 helper spec 무회귀).

## Out of Scope

- from-output-consistency 가드 신설(요약축 T-0663 계열) — 별도 후속 slice. 본 task 는 bare 2단 위임 컴포저만.
- 컴포저 반환 경로 self-wire(요약축 T-0664 계열) — 가드 신설 후 별도 후속 slice.
- 위임 helper(output-parse·outcome-report base T-1000·summary-line 가드 T-1001·output-consistency 가드 T-1003) 로직·시그니처·에러 메시지 수정 0 — 본 task 는 **합성**만.
- URL 파싱·issueNumber 검증·run guard·summaryLine 합성 재구현 0(전부 위임).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit·박제(step ④ live wiring — credential gate). 본 컴포저는 (stdout, report) → 실행 리포트 descriptor 만 산출.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).
- 여타 미미러 leaf(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title) mirror 0 — 각 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice) daily-step from-output-consistency 가드 신설(요약축 T-0663 mirror — 컴포저 산출 5필드를 (stdout, report) single-source 로부터 독립 재유도 deep-equal 대조), 이어서 그 가드를 컴포저 반환 직전 self-wire(요약축 T-0664 mirror).
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제 + outcome-report 를 로그/코멘트로 emit 하도록 재배선.
