---
id: T-1001
title: daily-step dual-leg run report issue outcome-report summary-line consistency drift-guard 신설 (assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent — report 5필드의 summaryLine 을 4 식별자 필드로 독립 재합성 대조, 요약축 T-0701 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-07-15
independentStream: realdata-e2e-daily-report-issue-outcome-report-summary-line-consistency
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — outcome-report producer(T-1000, PR#894 머지) 삼단(producer→consistency→self-wire) 중 consistency 1순위 slice. issue-still-relevant pre-check: grep 결과 daily-step outcome-report consistency 가드 부재(genuine). 요약축 T-0701(summary-line-consistency, 컴포저 재호출 0 독립 재합성) mirror — output-consistency(T-0725)는 별도 후속. producer 무변경(self-wire 후속). pr test-only 2파일 신설 dep[] file-disjoint stage5b 병렬. R-112 backbone ×1.5."
---

# T-1001 — daily-step dual-leg run report issue outcome-report summary-line consistency drift-guard 신설

## Why

PLAN.md 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 에서, daily-step dual-leg run report 이슈 박제 outcome + run 식별자를 사람-친화 e2e 실행 리포트 descriptor 로 묶는 **종단 순수 컴포저** `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts`, T-1000, PR #894 squash 16a5a06c)가 방금 신설됐다. 이 producer 는 `summaryLine = `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`` 를 합성하지만, 그 합성 로직의 회귀(구분자 변경·필드 누락·순서 뒤바뀜·issueNumber↔url swap 등)를 build-time 에 잡아줄 **sibling consistency drift-guard 짝이 아직 없다**.

established 순서(producer → consistency → self-wire; 예: descriptor T-0896→T-0988→T-0989)에 맞춰, T-1000 Follow-ups 가 **1순위 후속 slice** 로 명시한 것이 바로 이 consistency 가드 신설이다. 요약축(summary axis)에는 outcome-report 에 대해 두 consistency 가드가 존재한다 — `-summary-line-consistency`(T-0701, summaryLine 을 4 필드로 **독립 재합성**해 대조) 와 `-output-consistency`(T-0725). 본 task 는 그중 더 foundational 한 **summary-line-consistency**(요약축 T-0701)를 daily-step 축으로 mirror 한다. output-consistency(T-0725) mirror 는 별도 후속 slice.

**독립 재합성이 핵심(중요)**: 상위 from-output 계열 가드가 expected 를 만들 때 **동일 producer `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(T-1000)를 재호출**해 deep-equal 대조하면, summaryLine 합성 로직 자체가 drift 할 때 양쪽이 똑같이 drift 해 가드가 놓친다(재구현이 아닌 재호출의 한계). 본 가드는 summaryLine 템플릿을 **컴포저 재호출 없이 독립 재구현**해 `report.summaryLine` 과 byte-identical 대조하므로 drift 가 양방향 상쇄되지 않고 build-time 에 fail-fast 로 잡힌다. 이것이 요약축 T-0701 의 설계 의도이며, 본 task 가 그대로 daily-step 축으로 옮기는 판이다.

본 task 는 요약축 선례 T-0701(`assertRealDataResultIssueOutcomeReportSummaryLineConsistent`)과 정확히 동형으로, report 5 필드(issueNumber/url/gitSha/dateToken/summaryLine)를 입력받아, **식별자 4 필드만으로 expected summaryLine 을 독립 재합성**한 뒤 `report.summaryLine` 과 byte-identical(===) 대조하는 순수 fail-fast 가드 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent` + colocated R-112 spec 을 신설한다. **producer(T-1000) 본문은 무변경** — self-wire(컴포저 반환 직전 자가 호출)는 후속 slice(요약축 T-0702 mirror)로 분리한다. 가드는 producer(T-1000)를 import 하지 않고(oracle 독립성 — 템플릿 독립 재구현) report 타입만 `import type` 로 참조하므로, 나중에 producer 에 value import 로 self-wire 돼도 런타임 순환 의존이 생기지 않는다. producer(T-1000)가 이미 main 에 박제됐으므로 `dependsOn: []`.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.ts` (T-1000) — 대조 대상 producer 및 검증 대상 타입 정의. 반환 인터페이스 `RealDataDailyStepDualLegRunReportIssueOutcomeReport { issueNumber: number; url: string; gitSha: string; dateToken: string; summaryLine: string; }` 를 `import type` 로 재사용. summaryLine 합성 템플릿(`[${report.dateToken}@${report.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${url}`)을 정확히 확인해 가드의 독립 재합성 템플릿이 byte-identical 하도록 정합시킨다. **가드는 이 파일의 `build...` 함수를 import/재호출하지 않는다** — summaryLine 템플릿을 독립 재구현한다(양방향 drift 상쇄 방지).
- `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts` (T-0701, 요약축 선례 — main 박제) — **신설 가드의 직접 형태 선례**. `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report): void` 의 독립 재합성 방식(`composeExpectedSummaryLine` 을 report 4 필드로 직접 합성, producer 재호출 0), 구조 검증 분리(REPORT_NUMBER_FIELDS=[issueNumber] / REPORT_STRING_FIELDS=[url,gitSha,dateToken,summaryLine] 순회 type 검증), 에러 정책(구조/타입 결손 = TypeError / summaryLine 값 정합 위반 = RangeError, 기대 vs 실측 노출, fail-fast), oracle 독립성(producer import 0), 한국어 JSDoc·책임 경계 주석 스타일을 그대로 daily-step 축으로 옮긴다.
- `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.spec.ts` (T-0701) — mirror 할 spec 의 R-112 배치(happy round-trip · 구조 결손 TypeError · summaryLine drift RangeError mutant 다양성 · 비변형 · §9 secret 미노출) 참고. daily-step 축으로 이름·타입만 치환한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` (T-1000) — producer 기존 spec. fixture(outcome + report → outcomeReport) 구성 형태·happy/error/negative 배치 관례를 참고해 신설 consistency spec 의 정합 fixture 를 producer 실 호출로 얻는 round-trip case 를 작성한다(가드 spec 은 별도 colocated 파일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.ts` 신설 — 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueOutcomeReportSummaryLineConsistent(report: RealDataDailyStepDualLegRunReportIssueOutcomeReport): void` export. 입력 `report` 의 식별자 4 필드(dateToken/gitSha/issueNumber/url)만으로 expected summaryLine 을 **독립 재합성**(producer T-1000 의 `build...` 재호출 0, 템플릿 독립 재구현)한 뒤 `report.summaryLine` 과 byte-identical(===) 대조. `RealDataDailyStepDualLegRunReportIssueOutcomeReport` 타입은 T-1000 helper 에서 `import type` 재사용만(value import 0). 실 네트워크/env/DB/gh 실행/외부 라이브러리 0 — 순수 함수.
- [ ] 에러 정책 — 구조/타입 결손(report null/undefined·비객체; issueNumber 가 number 아님; url/gitSha/dateToken/summaryLine 중 하나가 string 아님) = 한국어 `TypeError`(독립 재합성 정합 비교 진행 불가). summaryLine 값 정합 위반(독립 재합성 expected 와 byte drift — 구분자 변경·issueNumber mismatch·url drift·dateToken↔gitSha swap 등) = 한국어 `RangeError`(기대 vs 실측 노출, drift 식별). silent 통과(위반인데 정상 void) 0, fail-fast. 검사 순서 = 구조/타입(report → number 필드 → string 필드) → 독립 재합성 → summaryLine 대조. 공백·대소문자 민감(trim·case-fold 0).
- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-summary-line-consistency.spec.ts` 신설 — R-112 4종 커버(colocated):
  - **Happy-path**: producer(T-1000) 실제 호출로 얻은 정합 outcomeReport 를 가드가 throw 0 으로 통과시킴을 assert 1+(oracle ↔ producer 합성 일치 증명하는 round-trip case). issueNumber(1·큰 수)·url(trim 정규화된 값)·gitSha/dateToken 다양성 각각 정합 통과.
  - **Error path**: 구조/타입 결손 각 유형이 각각 `TypeError` 를 던짐 1+ — (a) report null, (b) report 비객체, (c) issueNumber 가 number 아님(string/undefined), (d) url 비-string, (e) gitSha 비-string, (f) dateToken 비-string, (g) summaryLine 비-string.
  - **Flow/branch cover**: 정상 분기(정합 → void) + 구조 TypeError 분기 + 값 RangeError 분기 모두 test 로 도달.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: summaryLine drift mutant 각각이 `RangeError` 를 던짐 — (a) summaryLine 구분자/토큰 변경(예: `@`→`/`, `박제 →`→`박제:`), (b) summaryLine 의 issueNumber 를 report.issueNumber 와 다른 값으로 변조, (c) summaryLine 의 url 을 report.url 과 다른 값으로 변조, (d) summaryLine 의 dateToken↔gitSha 순서 swap, (e) summaryLine 에 trailing 공백/개행 부착(byte drift). 각 mutant 독립 case. 가드가 report 입력을 mutate 하지 않음(비변형 — 호출 전후 deep-equal 보존) assert 1+.
  - **§9 / §12 안전성**: 모든 fixture 는 비시크릿 더미 string(실 secret/PAT/credential 실 값 미노출), raw 활동 본문(commit/PR/issue payload 전문) 파일/전역 저장 0(본 가드는 report 식별자 필드만 재합성·비교) assert.
- [ ] producer `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(T-1000) 본문 수정 0 — 신설 가드는 별도 파일. producer 반환 직전 self-wire 배선은 후속 slice(본 task 범위 밖).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 helper·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- producer `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(T-1000) 반환 직전 가드 self-wire 배선 0 — 후속 slice(요약축 T-0702 mirror). 본 task 는 consistency 가드 **신설**만.
- output-consistency 가드(요약축 T-0725 `assertRealDataResultIssueOutcomeReportConsistentWithOutput` 계열) mirror 0 — 별도 후속 slice. 본 task 는 summary-line-consistency(독립 재합성) 단독.
- outcome-report-from-output(요약축 T-0589 계열) mirror 0 — 본 producer 에 의존하는 상위 조립, 별도 후속 leaf.
- 여타 미미러 leaf(command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title) mirror 0 — 각 별도 slice.
- 기존 daily-step vein helper(outcome-report producer T-1000 / output-parse T-0903 / run-report T-0894 / 9개 core leaf) 수정 0 — read-only `import type` 만.
- 자동 복구/재합성/정규화/기본값 채움 0 — 가드가 throw 하면 그대로 전파(복구는 호출처 책임).
- `src/` production 코드 변경 0(타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency(zod·ajv·해시·템플릿·CLI 라이브러리 포함) 도입 0.
- `deploy/daily-test.sh` step ④ 실 gh 이슈 코멘트/로그 emit live wiring 0(운영/env 층 §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (다음 slice 1순위) 본 가드를 producer `buildRealDataDailyStepDualLegRunReportIssueOutcomeReport`(T-1000) 반환 직전 self-wire → outcome-report summary-line leg 삼단 완결(producer T-1000 → consistency T-1001 → self-wire), 9개 core leaf 와 동형(요약축 T-0702 mirror).
- (그다음) output-consistency 가드(요약축 T-0725) mirror — outcome-report 의 5 필드가 입력 `(outcome, report)` 으로부터 producer 재호출로 재유도한 expected 와 deep-equal 정합한지 대조하는 순수 가드 + colocated R-112 spec. 이후 그 가드 self-wire.
- (이후) outcome-report-from-output leaf mirror — 본 outcome-report 베이스 + output-parse(T-0903) 를 조립하는 상위 producer. 이어서 command-plan·publish-plan·search-hit-shape·search-json-fields·command-args-body-marker·command-args-labels-title 등 요약축 대비 미미러 leaf 순차 이식 검토.
- §109 잔여(credential/env 게이트라 별도 큐잉): 실 credential 주입 하 credentialed live run 1회, `deploy/daily-test.sh` step ④ 가 dual-leg run report 를 실 gh rolling-issue 에 박제 + outcome-report 를 로그/코멘트로 emit 하도록 재배선.
