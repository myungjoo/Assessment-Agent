---
id: T-1002
title: daily-step dual-leg run report issue outcome-report 반환 직전 summary-line consistency drift-guard self-wire (buildRealDataDailyStepDualLegRunReportIssueOutcomeReport 산출 report 를 단일 반환 지점에서 즉시 자가 검증 — 요약축 T-0702 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-outcome-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts
plannerNote: "P5 §109 test-hardening — outcome-report 삼단(producer T-1000 → consistency T-1001 → self-wire) 中 self-wire 순서. issue-still-relevant pre-check(grep): producer 반환점 raw 반환 + '미이식(follow-up)' 주석 확인, self-wire 미존재(genuine). summary-line 가드(T-1001) 만 존재 → 단일 call 배선, 요약축 T-0702 mirror. output-consistency(T-0726 analog) 미존재라 후속. pr test-only 2파일(producer+spec) file-disjoint dep[] stage5b."
---

# T-1002 — daily-step dual-leg run report issue outcome-report 반환 직전 summary-line consistency drift-guard self-wire

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, daily-step dual-leg run report 이슈 박제 outcome + run 식별자를 사람-친화 e2e 실행 리포트 descriptor 로 묶는 **종단 순수 컴포저** `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts`, T-1000, PR #894 squash 16a5a06c)와, 그 산출 `summaryLine` 을 식별자 4 필드로 독립 재합성해 byte-identical 대조하는 sibling consistency 가드 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent`(T-1001, PR #895 squash a9614b5e)가 각각 신설됐다.

established 순서(producer → consistency → **self-wire**; 예: search-argv 축 T-0998 consistency → T-0999 self-wire, 9개 core leaf 와 동형)의 마지막 단계인 **self-wire** 가 아직 안 됐다. 현재 producer 는 반환점에서 `outcomeReport` 를 raw 로 그대로 반환하며, 본문에 "self-wire·consistency 미이식(Out of Scope) — daily-step 대응 consistency 가드 부재로 요약축(T-0702/T-0726)의 반환 직전 self-assert 두 호출을 넣지 않는다 … (follow-up slice)" 주석이 그대로 남아있다. 이제 consistency 가드(T-1001)가 main 에 박제됐으므로 그 전제가 해소됐다 — 본 task 는 producer 반환 직전에 summary-line consistency 가드를 self-assert 로 배선해 삼단을 닫는다.

**self-wire 의 의도(중요)**: 가드가 helper 로만 존재하면 caller(daily-test live wiring)가 명시적으로 호출해야만 drift 를 잡는다. 반환 직전 self-assert 로 배선하면 **어떤 경로로 producer 를 호출하든** 합성 회귀(summaryLine 템플릿 토큰 순서·구분자·접두 drift, 구성 4 필드↔summaryLine 어긋남)로 손상된 report 가 step ④ 박제/로그 emit wiring 으로 새기 전 build-time 에 fail-fast throw 로 차단된다. 가드는 read-only(report mutate 0)이며 정상 산출물에는 void 반환 — 관측 불가능하게 동일한 report 를 그대로 반환한다.

본 task 는 요약축 선례 T-0702(`buildRealDataResultIssueOutcomeReport` 반환점 line 135 의 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` 단일 self-assert)와 정확히 동형으로, **summary-line consistency 가드(T-1001) 1 개 call 만** 배선한다. output-consistency 가드(요약축 T-0726 analog)는 daily-step 축에 아직 미존재하므로 그 self-wire(요약축 T-0726 의 두 번째 call)는 후속 slice — 본 task 는 존재하는 단일 가드만 배선한다. consistency 가드(T-1001)가 이미 main 에 있으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` (T-1000) — self-wire 대상 producer. 단일 반환 지점(`return outcomeReport;`) 직전에 가드 self-assert 를 삽입한다. 기존 입력 guard(`assertNonBlank`/`assertPositiveIssueNumber`)와 summaryLine 합성 라인은 **그대로 보존**하고, 현재의 "self-wire·consistency 미이식(Out of Scope) … (follow-up slice)" 주석을 self-wire 배선 주석으로 교체한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.ts` (T-1001) — 배선할 가드. export 시그니처 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(report: RealDataDailyStepDualLegRunReportIssueOutcomeReport): void` 를 **value import**(런타임 호출) 로 가져와 반환 직전에 `report` 로 호출한다.
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` (T-0702, 요약축 선례 — main 박제) — **self-wire 의 직접 형태 선례**. line 51 의 value import + line 135 의 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` 단일 self-assert 배치, 그 위 한국어 self-wire 주석(회귀 차단 의도·read-only·void·입력 guard 보존 명시) 스타일을 그대로 daily-step 축으로 옮긴다. **본 task 는 요약축 T-0702 의 summary-line 단일 call 만 mirror** — 그 아래 T-0726 output-consistency 두 번째 call 은 daily-step 축 미존재라 이식 0.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` (T-1000) — 확장할 producer spec. 기존 happy/error/negative 배치를 유지한 채, self-wire 회귀 test(정상 입력 → producer 가 여전히 정합 report 반환 = 가드 통과 / 가드가 실제로 반환 경로에 배선됐음을 증명하는 case)를 추가한다. 요약축 T-0702 spec 의 self-wire test 배치를 참고.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` self-wire — 파일 상단에서 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent` 를 sibling consistency helper 에서 **value import**, 단일 반환 지점(`return outcomeReport;`) **직전**에 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(outcomeReport);` 1 회 호출 삽입. 기존 입력 guard 호출·summaryLine 합성 라인·객체 조립은 무변경 보존. 현재의 "self-wire·consistency 미이식(Out of Scope) … (follow-up slice)" 주석을 self-wire 의도(합성 회귀 fail-fast 차단·read-only·void·입력 guard 보존) 한국어 주석으로 교체. producer 시그니처·반환 타입·정상 산출물 불변(가드 void → 동일 report 반환).
- [ ] output-consistency 가드(요약축 T-0726 analog) self-assert 는 배선 0 — daily-step 축 미존재. 본 task 는 summary-line consistency 가드(T-1001) **단일 call** 만. (요약축 T-0702 는 두 call 이나 daily-step 은 존재하는 하나만 — 분기 없음, 그 두 번째 call 은 후속 slice.)
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` 확장 — R-112 4종 커버(self-wire 관점):
  - **Happy-path**: 정합 입력 `(outcome, report)` 으로 producer 호출 시 배선된 가드가 throw 0 으로 통과하고 정상 report(5 필드 정합)를 그대로 반환함을 assert 1+. issueNumber(1·큰 수)·url(trim 정규화)·gitSha/dateToken 다양성 각각 정상 반환.
  - **Error path / self-wire 증명**: 가드가 실제로 반환 경로에 배선됐음을 증명 — 정상 입력이 producing 하는 report 는 항상 가드를 통과(regression: 배선 제거 시 이 경로 검증이 약화됨을 드러내는 case). producer 는 입력 guard 위반 시 여전히 각각의 TypeError/RangeError 를 던짐(기존 입력 guard 보존 확인) 1+.
  - **Flow/branch cover**: 정상 산출(가드 통과 → report 반환) 분기 + 기존 입력 guard 위반 분기(assertNonBlank/assertPositiveIssueNumber throw) 각각 test 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: 기존 입력 결손(outcome null/비객체, issueNumber ≤0·비정수, url/gitSha/dateToken blank 등) 각 유형이 여전히 적정 throw. producer 가 입력을 mutate 하지 않음(비변형 — 호출 전후 입력 deep-equal 보존) assert 1+. self-wire 삽입이 정상 반환 report 의 필드값·순서를 바꾸지 않음(배선 전후 동일 산출) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문 파일/전역 저장 0 assert.
- [ ] sibling consistency 가드(T-1001) `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent` 본문 수정 0 — 본 task 는 producer 로의 **배선**만(가드 로직 무변경). 가드 helper 파일·그 spec 은 read-only 참조.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설/수정 경로 모두 순수·결정론이라 완전 커버.

## Out of Scope

- output-consistency 가드(요약축 T-0726 `assertRealDataResultIssueOutcomeReportConsistentWithOutput` analog) 신설 및 그 self-wire 0 — daily-step 축 미존재. consistency 가드 신설 후속 slice → 그 self-wire slice 순으로 별도 큐잉. 본 task 는 존재하는 summary-line 가드(T-1001) 단일 배선만.
- summary-line consistency 가드(T-1001) 로직 수정 0 — producer 로의 배선만.
- outcome-report-from-output(요약축 T-0589 계열) mirror 0 — 본 producer 에 의존하는 상위 조립, 별도 후속 leaf.
- 여타 미미러 leaf(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title) mirror 0 — 각 별도 slice.
- 기존 daily-step vein helper(consistency T-1001 / output-parse T-0903 / run-report T-0894 / 9개 core leaf) 수정 0 — producer 와 그 spec 두 파일 외 무변경.
- 입력 정규화/자동 복구/기본값 채움 로직 추가 0 — 배선된 가드가 throw 하면 그대로 전파(복구는 호출처 책임).
- `src/` production 코드 변경 0. `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice 1순위) output-consistency 가드(요약축 T-0726 analog) mirror 신설 — outcome-report 5 필드(`{issueNumber, url, gitSha, dateToken, summaryLine}`) 전체가 입력 `(outcome, report)` 으로부터 컴포저 재호출 없이 독립 재유도한 expected 와 deep-equal 정합한지 대조하는 순수 가드 + colocated R-112 spec. 이어서 그 가드를 producer 반환 직전 self-wire(요약축 T-0726 의 두 번째 call mirror) → outcome-report leg 요약축 완전 동형화.
- (그다음) outcome-report-from-output leaf mirror — 본 outcome-report 베이스 + output-parse(T-0903) 를 조립하는 상위 producer. 이어서 command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등 요약축 대비 미미러 leaf 순차 이식 검토.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제 + outcome-report 를 로그/코멘트로 emit 하도록 재배선.
