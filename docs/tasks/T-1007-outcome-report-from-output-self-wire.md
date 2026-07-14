---
id: T-1007
title: daily-step dual-leg run report issue outcome-report from-output composer 산출 직전 from-output-consistency 가드 self-wire 배선 (buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput → assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput, 요약축 T-0664 mirror)
phase: P5
status: DONE
completedAt: 2026-07-14T20:58:29Z
result: "PR #901 squash bd2b92aa merged. from-output 컴포저 반환 직전 T-1006 consistency 가드 self-wire(composer-seam chain 완결). test-only 2파일 +219/-12, 컴포저 100% cov, 394 suite/10574 test green. round1 APPROVE 4-게이트 PASS."
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-07-15
plannerNote: "P5 §109 test-hardening — daily-step from-output 컴포저(T-1005) 반환 직전 T-1006 신설 consistency 가드를 self-wire(요약축 T-0664 mirror, import 1줄+호출 1지점, byte-identical 보존). issue-still-relevant pre-check(grep origin/main): 컴포저 L40-43/64-65 가 self-wire 배선 0 명시 + T-1006 가드 파일 main 박제 확인 → genuine gap, 중복 아님. pr test-only 2파일 file-disjoint dep[] stage5b 병렬."
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts
---

# T-1007 — daily-step outcome-report from-output composer 산출 직전 consistency 가드 self-wire 배선

## Why

PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동 수집 → 로컬 Ollama 실 LLM 평가" bullet 의 step ④(daily-test dual-leg run report rolling-issue 결과 박제) build-time 정합 가드 사슬의 연속 slice. 직전 T-1006 이 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(stdout, report, outcomeReport)` 를 **신설만** 했고, 컴포저 `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(stdout, report)`(T-1005) 의 산출 경로에는 아직 배선되지 않았다 (T-1005 컴포저 L40-43/64-65 "self-wire 배선 0 — 후속 leaf" 명시 + T-1006 Out of Scope + Follow-up ①).

본 task 는 그 가드를 **컴포저가 outcomeReport 를 반환하기 직전 self-assert** 배선해, 컴포저가 두 위임 layer(T-0903 파서 → T-1000 리포트 빌더) 사이에 끼어 결과를 변형/누락하는 합성 회귀를 호출 시점에 fail-fast 로 차단한다. 요약축 `buildRealDataResultIssueOutcomeReportFromOutput` self-wire(T-0664)의 daily-step composer-seam mirror — import 1줄 + 호출 1지점 추가, 정상 합성이면 가드는 void → 컴포저 동작·반환 byte-identical 보존, 회귀 시 컴포저가 손상 outcomeReport 를 caller 에 넘기기 전에 throw. 이로써 daily-step from-output composer-seam consistency chain(가드신설 T-1006 → producer self-wire T-1007)이 완결된다.

issue-still-relevant pre-check(origin/main grep): 컴포저 파일에 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput` / `ConsistentWithOutput` 호출 0건(L40-43·L64-65 는 "배선 0" 주석뿐) + T-1006 가드 파일(`...from-output-consistency.ts`) main 박제 확인 → genuine gap, 중복 아님.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.ts` (T-1005, main 박제) — 배선 대상 컴포저. `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput(stdout, report)`(L94~109)가 (1) `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` → outcome (2) `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport(outcome, report)` → outcomeReport 를 위임-체인으로 엮어 L104~108 에서 `outcomeReport` 지역 변수를 그대로 `return` 한다. 본 task 는 이 `return outcomeReport;`(L108) 직전에 self-assert 호출 1줄만 삽입. L40-43·L60-67 의 "self-wire 배선 0 — 후속 slice" 주석을 배선 완료에 맞게 갱신.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts` (T-1006, main 박제) — self-wire 할 가드. `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(stdout: string, report: RealDataDailyStepDualLegRunReport, outcomeReport: RealDataDailyStepDualLegRunReportIssueOutcomeReport): void` 시그니처 확인 — 인자는 `(stdout, report, outcomeReport)` 순서. 가드는 내부에서 single-source 재유도(parse→build)로 expected 를 산출해 outcomeReport 5필드(`issueNumber`/`url`/`gitSha`/`dateToken`/`summaryLine`) 정합 검증. import 원천.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts` (T-1005 colocated spec) — 컴포저 colocated spec. 본 task 는 self-wire 배선 검증 describe/it 를 append (`jest.spyOn` 으로 가드가 `(stdout, report, 산출 outcomeReport)` 인자로 정확히 1회 호출됨 검증 + 정상 합성이면 throw 0, 가드가 throw 하면 컴포저도 throw 전파).
- 패턴 선례 (직접 template): `docs/tasks/T-0664-realdata-result-outcome-report-from-output-consistency-self-wire.md` (요약축 — DONE). T-0663 신설 가드의 composer producer self-wire — import 1줄 + 호출 1지점, 반환 직전 self-assert, byte-identical 보존. 본 task 는 그 daily-step composer-seam 동형 (인자 순서만 요약축 `(stdout, run, report)` → daily-step `(stdout, report, outcomeReport)`).

## Acceptance Criteria

- [ ] `buildRealDataDailyStepDualLegRunReportIssueOutcomeReportFromOutput` 가 위임 (2) 산출 `outcomeReport` 를 곧장 `return` 하던 것을, `return` 직전에 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput(stdout, report, outcomeReport)` 를 **1회 self-assert** 후 그 `outcomeReport` 를 반환하도록 배선. import 1줄(consistency 가드) + 호출 1지점만 추가 — 컴포저 합성 순서·위임 호출 변경 0, 반환 outcomeReport byte-identical 보존. L40-43·L60-67 의 "self-wire 배선 0" 주석은 배선 완료 상태로 갱신.
- [ ] **비변형 / 순수**: 배선으로 부수효과 0·새 외부 dependency 0·credential/env/네트워크 0. 가드는 read-only 검증이라 `stdout`(불변)·`report`(읽기만)·`outcomeReport`(읽기만) mutate 0. 정상 합성이면 self-assert 가 void → 기존 동작과 관측 불가능하게 동일(반환 byte-identical).
- [ ] **Happy-path unit test 1+**: 정상 stdout(유효 github issues URL 1건) + 정상 report(비공백 gitSha/dateToken)로 컴포저 호출 시 throw 0(정상 outcomeReport 반환). 산출 outcomeReport 가 직전 self-assert 가드를 round-trip 으로 통과함 확인. gitSha/dateToken/issueNumber 다양성 조합 1+.
- [ ] **Error path unit test 1+**: self-assert 가 throw 하는 경로 — 가드를 `jest.spyOn` 으로 throw(RangeError/TypeError) 하도록 mock 했을 때 컴포저가 그 throw 를 삼키지 않고 caller 로 전파함 1+. 또한 위임 파서/빌더가 throw 하는 입력(예: stdout URL 미발견·비-github·`/pull/`·issueNumber 비정상 / report.gitSha·dateToken 빈·공백)에서는 가드 진입 전에 위임 throw 가 전파됨 1+.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 가드 통과(void) → outcomeReport 반환 분기, (b) 가드 throw 전파 분기, (c) 위임(파서/빌더) throw 가 가드 진입 전 전파되는 분기(파서 throw 입력·빌더 throw 입력 각각) 각 1+ test.
- [ ] **Negative cases 충분 cover — 예외 상황 분기마다 1+**: (a) 가드가 `(stdout, report, 산출 outcomeReport)` 정확한 인자·순서·1회로 호출됨을 `jest.spyOn` mock.calls 로 검증, (b) 가드 throw 시 컴포저 throw 전파, (c) 파서 throw 입력(stdout URL 미발견·비-github·`/pull/`·issueNumber 0/선행0/비정수)에서 가드 미호출(위임 (1) 단계에서 종료), (d) 빌더 throw 입력(report.gitSha/dateToken 빈·공백)에서 가드 미호출(위임 (2) 단계에서 종료), (e) 동일 입력 두 번 호출 deterministic(같은 outcomeReport·summaryLine byte-identical), (f) 입력 stdout(문자열)·report 비변형(mutate 0, 호출 전후 deep-equal) 각 1+ test.
- [ ] **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0 assert.
- [ ] `src/` 무변경(test helper 단독 — 가드·위임 함수·타입 import 재사용만). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build` 통과. consistency 가드 값 import 추가로 인한 runtime cycle 0(tsc green 확인 — 컴포저·가드가 동일 위임 함수를 import 하므로 순환 위험 없음).
- [ ] `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%). 변경 대상 컴포저 파일 `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.ts` 의 line/branch/function 100%. 전체 unit suite green(기존 위임·가드·컴포저 helper spec 무회귀).

## Out of Scope

- `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportConsistentWithOutput` 가드 본문(T-1006) 및 위임 함수(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` T-0903 / `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport` T-1000) 본문·시그니처·에러 메시지 수정 — 본 task 는 self-wire 배선만, 가드·위임은 산출물 그대로 사용.
- 컴포저 합성 로직·2단 위임 순서·반환 형태 변경 — 반환 outcomeReport 는 byte-identical 보존, 본 task 는 반환 직전 검증 호출 1지점 + import 1줄만 추가.
- 다른 realdata-e2e seam(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등)의 추가 가드 또는 self-wire — 각 별도 slice.
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit·박제(step ④ live wiring — credential 게이트). 본 배선은 build-time 순수 검증 호출만.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).
- production `src/` 코드 변경 — test helper 단독.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 self-wire 로 daily-step outcome-report from-output composer-seam consistency chain(가드신설 T-1006 → producer self-wire T-1007)이 완결됨. 다음 후보: §109 realdata-e2e build-time chain 의 잔여 seam 점검 또는 step ④ live execFile/gh wiring credential 게이트 진입 여부 PLAN 재검토.)
