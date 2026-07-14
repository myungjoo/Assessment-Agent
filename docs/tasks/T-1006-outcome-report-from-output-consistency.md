---
id: T-1006
title: daily-step dual-leg run report issue outcome-report from-output-consistency 순수 가드 신설 (assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput — 컴포저 산출 5필드 ↔ (stdout, report) single-source 재유도 byte-identical 대조, 요약축 T-0663 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — daily-step from-output 컴포저(T-1005) 산출↔single-source 재유도 정합 가드 신설(요약축 T-0663 mirror). issue-still-relevant pre-check(grep origin/main): daily-step helpers 에 ConsistentWithOutput 0건 + from-output-consistency 파일 부재 확인 → genuine gap, 중복 아님. 가드신설만(self-wire 는 후속 T-0664 계열). pr test-only 2파일 file-disjoint dep[] stage5b 병렬."
---

# T-1006 — daily-step outcome-report from-output-consistency 순수 가드 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time 정합 가드 사슬의 연속 slice. 직전 T-1005 가 daily-step 축 **post-실행 단일 진입 컴포저** `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(stdout, report)`(요약축 T-0596 mirror)를 신설했다 — 이 컴포저는 (1) output-parse → outcome, (2) outcome-report build 2단 위임을 엮어 `RealDataDailyStepDualLegRunReportIssueOutcomeReport` 를 반환한다. 그러나 그 합성 결과가 single-source 재유도와 정합한지 검증하는 가드는 아직 없다.

본 task 는 **컴포저 산출 report 가 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout), report)` single-source 재유도와 byte-identical 함**을 검증하는 순수 가드를 신설해, 컴포저가 두 위임 layer 사이에 끼어 결과를 변형/누락하는 합성 회귀를 fail-fast 로 차단한다. 요약축 `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(T-0663, `realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`)의 daily-step mirror — describe/throw 계약(구조 결손=TypeError / 값 정합 위반=RangeError)·재유도 재구현 0 backbone 을 동형으로 옮긴다. **가드신설만** — 컴포저 반환 직전 self-wire 배선은 후속 slice(요약축 T-0664 계열).

issue-still-relevant pre-check(origin/main grep): daily-step helpers 에 `ConsistentWithOutput` 어휘 0건(`git grep -c ConsistentWithOutput 'test/helpers/*daily-step*'` = none) + `...from-output-consistency.ts` 파일 부재 확인 → genuine gap, 중복 아님. 재유도 building block(output-parse·outcome-report base T-1000·컴포저 T-1005) 셋 다 main 박제됨.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.ts` (T-1005, main 박제) — 검증 대상 컴포저. `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(stdout: string, report: RealDataDailyStepDualLegRunReport): RealDataDailyStepDualLegRunReportIssueOutcomeReport`(L94~109). 본 가드가 재유도 single-source 로 호출할 두 위임 함수(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`, `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`)의 import 원천(L70~73 참조).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` (T-1000) — `RealDataDailyStepDualLegRunReportIssueOutcomeReport` interface(5필드 `issueNumber`/`url`/`gitSha`/`dateToken`/`summaryLine`) + single-source builder `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome, report)`. 재유도 기준. summaryLine 합성식·outcome 타입 export 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout): RealDataDailyStepDualLegRunReportIssueOutcome`. 재유도 chain 첫 단계. stdout URL 미발견·비-github·`/pull/`·issueNumber 0/선행0/비정수 → throw.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` (T-0894) — `RealDataDailyStepDualLegRunReport` type(재유도 빌더의 두 번째 인자 = 컴포저의 `report` 인자 타입). `import type` only.
- **패턴 선례 (직접 template)**: `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`(T-0663, 요약축 — main 박제) 의 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)`. single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast. 본 가드는 그 daily-step composer-seam mirror — describe/throw 계약·메시지 포맷을 동형으로 따르되, 두 번째 인자가 요약축 RunRef 가 아니라 daily-step run report(`RealDataDailyStepDualLegRunReport`)인 점만 다르다.
- `docs/tasks/T-0663-realdata-result-outcome-report-from-output-consistency-guard.md` — 요약축 가드신설 task 정의(재유도 재구현 0·에러 정책·순수성 acceptance 형태의 직접 참조).
- **신규 colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.spec.ts` (가드 옆 colocated — R-112 spec).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(stdout: string, report: RealDataDailyStepDualLegRunReport, outcomeReport: RealDataDailyStepDualLegRunReportIssueOutcomeReport): void`. 가드는 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout), report)` 로 single-source 재유도한 expected outcomeReport 를 산출하고, 인자 `outcomeReport` 의 5필드(`issueNumber`/`url`/`gitSha`/`dateToken`/`summaryLine`)가 expected 와 **각각 정합(string byte-identical / number ===)** 함을 검증. 정합이면 void, 위반 시 throw. 재유도 chain 의 URL 파싱·issueNumber 검증·run guard·summaryLine 합성 로직은 일절 **재구현 0** — 위임 호출만. 위임 함수는 value import, 타입은 `import type` only.
- [ ] **에러 정책 — 구조 결손=TypeError / 값 정합 위반=RangeError 구분**(요약축 T-0663 mirror): (a) `stdout` 비-string·`report`/`outcomeReport` null/undefined·`outcomeReport` 필드 type 위반 → 한국어 TypeError. (b) 재유도 expected 와 `outcomeReport` 의 어느 필드라도 drift → 한국어 RangeError(메시지에 어느 필드가 expected vs actual 로 어긋났는지 포함). silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 필드에서 throw). 파일 상단 주석에 책임(composer-seam 정합 검증)·재유도 순서·에러 정책·순수성·dependency-free 를 한국어로 박제.
- [ ] **비변형 / 순수**: `stdout`(문자열·불변) / `report`(읽기만, mutate 0) / `outcomeReport`(읽기·비교만). 부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0·env/network/credential 0. 동일 입력 → 동일 동작(정합이면 항상 void, drift 면 항상 동일 필드에서 throw).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.spec.ts` 신설 — R-112 4종:
  - **Happy-path 1+**: 정상 stdout(유효 github issues URL 1건) + 정상 report(비공백 gitSha/dateToken)로 컴포저 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput` 가 산출한 outcomeReport 를 가드에 넘기면 throw 0(void). 컴포저 실제 산출물이 가드를 round-trip 으로 통과함 확인. gitSha/dateToken/issueNumber 다양성 조합 1+.
  - **Error path 1+**: 각 필드(`issueNumber`/`url`/`gitSha`/`dateToken`/`summaryLine`)를 하나씩 변조한 손상 outcomeReport 를 가드에 넘기면 RangeError throw — 필드별 1+. 메시지에 해당 필드명·expected·actual 노출 검증.
  - **Flow/branch cover**: 구조 결손 분기(TypeError: `stdout` 비-string / `report` null / `outcomeReport` null / `outcomeReport` 필드 type 위반)와 값 정합 위반 분기(RangeError: 필드 drift) 각 1+. 재유도 chain 이 throw 하는 입력(stdout URL 미발견·비-github·`/pull/`·issueNumber 비정상 / report 식별자 빈·공백)에서는 가드 진입 후 위임 throw 가 그대로 전파됨(가드가 삼키지 않음) 각 1+.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) `outcomeReport` 5필드 각각 drift → RangeError(5필드 각 1+), (b) `stdout`/`report`/`outcomeReport` null/undefined → TypeError(각 1+), (c) `outcomeReport` 필드 type 위반(예: `issueNumber` 문자열, `summaryLine` 숫자) → TypeError(각 1+), (d) 정상 정합 → throw 0, (e) 동일 입력 두 번 호출 deterministic(같은 결과·summaryLine byte-identical), (f) 입력 비변형(`stdout`/`report`/`outcomeReport` mutate 0, 호출 전후 deep-equal) 각 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0 assert.
- [ ] `src/` 무변경(test helper 단독 — 위임 함수·타입 import 재사용만). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 가드 파일 line/branch/function 100% 목표. 전체 unit suite green(기존 위임·컴포저 helper spec 무회귀).

## Out of Scope

- **가드의 컴포저 self-wire 배선** — 본 task 는 가드신설만. `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput` 반환 직전 self-assert 배선은 별도 후속 slice(요약축 T-0664 mirror, Follow-up ①).
- 컴포저(T-1005) 또는 위임 함수(output-parse·outcome-report base T-1000·summary-line 가드 T-1001·output-consistency 가드 T-1003) 본문·시그니처·에러 메시지 수정 0 — 본 task 는 가드 **신설만**, 컴포저·위임은 산출물 그대로 사용.
- 재유도 chain 의 URL 파싱·issueNumber 양수성 검증·run guard·summaryLine 합성 로직 재구현 0 — 전부 위임 호출로 재유도.
- 다른 realdata-e2e seam(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등)의 추가 가드 또는 mirror — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit·박제(step ④ live wiring — credential 게이트). 본 가드는 build-time 순수 검증만.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: 본 가드를 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput` 반환 직전 self-wire 배선(요약축 T-0664 producer self-wire mirror — import 1줄 + 호출 1지점, byte-identical 보존). 이로써 daily-step from-output composer-seam consistency chain(가드신설 → self-wire)이 완결됨. 이후: §109 잔여 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉.
