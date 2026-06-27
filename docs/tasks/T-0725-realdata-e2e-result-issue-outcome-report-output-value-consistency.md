---
id: T-0725
title: realdata-e2e result-issue outcome-report 산출 ↔ (outcome, run) single-source 재유도 정합 가드 신설
phase: P5
status: DONE
completedAt: 2026-06-27T16:54:45Z
mergedAs: a7636a8e
prNumber: 641
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-06-28
independentStream: realdata-e2e-result-issue-outcome-report-output-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only 값-정합 가드 — 가드 본체 + colocated spec 두 신규 파일이라 cap 초과 가능. T-0711(+421)/T-0713(+480)/T-0717(+1037)/T-0721(+320)/T-0723(+547) test-only 값-가드 sibling 선례 정합. src 무변경."
plannerNote: "P5 consistency-sweep — output-parse 짝(T-0723→T-0724) 완결 후 outcome-report 산출 측 NO-GUARD-value leaf buildRealDataResultIssueOutcomeReport 산출↔(outcome,run) 독립 재유도 value-guard"
---

# T-0725 — realdata-e2e result-issue outcome-report 산출 ↔ (outcome, run) single-source 재유도 정합 가드 신설

## Why

PLAN.md 109행 실 평가 e2e bullet 의 build-time 정합-가드 sweep 을 잇는 task. 직전 result-issue output-parse stream(T-0723 가드 신설 → T-0724 self-wire)이 완결됐다. 본 task 는 그 sweep 을 outcome-report 측의 genuine NO-GUARD-value leaf 인 `buildRealDataResultIssueOutcomeReport`(T-0590, `realdata-e2e-result-issue-outcome-report.ts`)로 확장한다 — 이 컴포저는 `(outcome, run)` 을 `RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken, summaryLine}` 로 묶는 종단 컴포저인데, 현재 self-wire 된 가드는 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent`(T-0701/T-0702, **summaryLine 필드 한 종만** 그 구성 필드와의 내부 정합 검증) 하나뿐이다. **컴포저 산출 5 필드 전체를 `(outcome, run)` 입력으로부터 컴포저 재호출 없이 독립 재유도해 deep-equal 대조하는 값-정합 가드는 부재**(issueNumber/url 전파 정확성·url trim 정규화·gitSha/dateToken 전파·summaryLine 합성의 값 drift 미cover gap). summary-line 가드는 summaryLine ↔ 구성 필드 내부 정합만 보므로, issueNumber/url/gitSha/dateToken **전파** 가 어긋나거나 url trim 정규화가 누락돼도 통과한다(기존 `from-output-consistency` 가드 T-0663 은 `from-output` 래퍼 컴포저를 `buildRealDataResultIssueOutcomeReport` **재호출** 로 재유도하므로 이 leaf 자체의 독립 재유도가 아님 — 양방향 drift 상쇄). 본 가드가 그 drift 를 build-time fail-fast 로 차단한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 정합 — 컴포저가 silent 하게 잘못된 issueNumber/url 을 전파하거나 잘못된 summaryLine 을 합성하면 손상 report 가 step④ 박제/로그 emit wiring 으로 새기 전 차단). T-0723 output-parse value-guard 의 outcome-report 측 mirror.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — 가드 대상 컴포저(`buildRealDataResultIssueOutcomeReport`). 재유도 로직(run.gitSha/dateToken 빈/공백 guard → outcome.url 빈/공백 guard → issueNumber 양의 정수 guard → `url = outcome.url.trim()` 정규화 → `summaryLine = `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`` 합성 → `{issueNumber, url, gitSha, dateToken, summaryLine}` 정규화)의 single-source 규칙. `RealDataResultIssueOutcomeReport` 출력 type 확인.
- `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts` — 기존 summaryLine 내부 정합 가드(T-0701). 본 값-가드와 책임 경계 확인(summaryLine 단일 필드 vs 5 필드 전체 산출 값 재유도).
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — 기존 `from-output` 래퍼 정합 가드(T-0663). 책임 경계 확인 — 그 가드는 `buildRealDataResultIssueOutcomeReport` 를 **재호출** 해 재유도하므로 leaf 자체 독립 재유도가 아님(본 가드는 컴포저 미호출, 5 필드를 입력으로부터 직접 재유도).
- `test/helpers/realdata-e2e-result-issue-output-parse-consistency.ts` — 직전 짝(T-0723)의 값-정합 가드 선례. 독립 재유도 + deep-equal + TypeError↔RangeError 분리 패턴의 직접 mirror(output-parse→outcome-report 측 변형만).
- `test/helpers/realdata-e2e-result-issue-output-parse-consistency.spec.ts` — colocated spec 패턴(T-0723) 참고.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef` type(`import type` 재사용 대상, 중복 정의 금지). `RealDataResultIssueOutcome` type 은 `realdata-e2e-result-issue-output-parse.ts` 에서 재사용.

## Acceptance Criteria

- [ ] **신규 가드 파일** `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.ts` 추가. `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(report, outcome, run)` (또는 동형 명세) export — 컴포저 산출 `report`(`RealDataResultIssueOutcomeReport`)와 입력 `outcome`(`RealDataResultIssueOutcome`)·`run`(`RealDataResultIssueRunRef`)을 받아, `(outcome, run)` 으로부터 컴포저 재호출 없이 독립 재유도(issueNumber/gitSha/dateToken 전파 → `url = outcome.url.trim()` 정규화 → summaryLine 동형 합성)한 expected 5 필드와 deep-equal 대조한다. 컴포저(`buildRealDataResultIssueOutcomeReport`)는 **호출하지 않는다**(재호출 deep-equal 은 양방향 drift 상쇄라 무의미 — 독립 재유도가 핵심).
- [ ] **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** — 입력 자체가 비정상(report/outcome/run 이 non-null 객체 아님·필드 type 위반·issueNumber 비양정수·url/gitSha/dateToken 빈/공백 등)이면 TypeError, 재유도 expected 와 산출 report 의 어느 5 필드라도 값이 어긋나면 RangeError(어느 필드가 expected vs actual 로 drift 했는지 메시지에 노출)로 분기. 한국어 명세형 에러 메시지. (가드 진입 전 입력 자체 비정상은 TypeError, 정상 입력에서 산출 report 가 expected 와 drift 면 RangeError.)
- [ ] **happy-path unit test 1+** — 정상 `(outcome, run)`(issueNumber 양수·url 정상·gitSha/dateToken 비공백)에 대해 컴포저 산출 report 가 가드를 void 통과하는 test. outcome.url 에 trailing 개행/공백이 있어 trim 후 정합하는 happy-path 1+.
- [ ] **error path unit test 1+** — issueNumber 전파 drift(report.issueNumber ≠ outcome.issueNumber)·url 값 drift(trim 누락·다른 url)·gitSha/dateToken 전파 drift·summaryLine 합성 drift(템플릿 토큰 순서·구분자·접두 어긋남) 각각에 대해 가드가 throw 하는 test(값-정합 위반 RangeError).
- [ ] **분기마다 test branch 분리** — issueNumber 비교 / url trim 정규화·비교 / gitSha 비교 / dateToken 비교 / summaryLine 합성·비교 / report 비객체 / outcome 비객체 / run 비객체 / report 필드 type 위반 등 각 재유도·비교 분기 1+ test.
- [ ] **negative cases 충분 cover** — 구조결손(report/outcome/run 이 null/숫자/문자열·report 필드 type 위반·outcome.issueNumber 비양정수·outcome.url 빈/공백·run.gitSha/dateToken 빈/공백) TypeError 경로 각 1+, 값정합 위반(issueNumber 값·url 값·gitSha 값·dateToken 값·summaryLine 값) RangeError 경로 각 1+. 단일 negative 만 금지 — 예외 분기마다 cover.
- [ ] **결정성·비변형 검증** — 동일 입력 두 번 호출 deep-equal, 입력 `report`/`outcome`/`run` 비변형(가드가 입력 mutate 0) test 1+.
- [ ] **§9 정합** — raw 활동 본문·credential 이 에러 메시지/산출에 노출되지 않음 단언(가드는 issueNumber·url·gitSha·dateToken·summaryLine 값만 다룸, 비-report 본문 미보유).
- [ ] colocated spec `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.spec.ts` 에 위 test 박제(colocated 우선 — NestJS/discoverability convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 가드 파일은 line/branch/func/stmt 100% 목표).
- [ ] `RealDataResultIssueOutcomeReport` 는 `realdata-e2e-result-issue-outcome-report` 에서, `RealDataResultIssueOutcome` 는 `realdata-e2e-result-issue-output-parse` 에서, `RealDataResultIssueRunRef` 는 `realdata-e2e-result-issue-descriptor` 에서 각각 `import type` 재사용(신규 type 정의 금지). summaryLine 템플릿 규약은 컴포저와 동형으로 **독립 재구현**(재호출 0 원칙 유지).

## Out of Scope

- 컴포저 `buildRealDataResultIssueOutcomeReport` 의 self-wire 배선(본 task 는 가드 신설만 — self-wire 짝은 후속 task, T-0723→T-0724 분리 패턴 동형).
- 컴포저 본체·`realdata-e2e-result-issue-outcome-report.ts` 로직 변경(가드 신설 단독, 출력 byte-identical 보존).
- 기존 summaryLine 내부 정합 가드(`realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts`, T-0701/T-0702) 변경.
- 기존 `from-output` 래퍼 정합 가드(`realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`, T-0663/T-0664) 변경.
- 실 gh issue create/edit 호출 / `execFile('gh', argv)` / live wiring(step ④ credential gate).
- production `src/` 코드 변경 — test helper 단독.
- 새 dependency 도입(zod 등 금지 — 내장 string 합성 + 수동 재유도만).
- 다른 NO-GUARD leaf(command-args·search-json-fields 등) 가드 — 본 task 는 outcome-report 산출 단일.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 신설 시)
