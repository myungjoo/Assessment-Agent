---
id: T-0701
title: realdata-e2e outcome-report summaryLine↔필드 single-source 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — buildRealDataResultIssueOutcomeReport 의 summaryLine 독립 재합성 가드 신설(from-output 가드는 동일 함수 재호출이라 summaryLine drift 미cover gap)"
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-outcome-report-guard
---

# T-0701 — realdata-e2e outcome-report summaryLine↔필드 single-source 재유도 정합 가드 신설

## Why

P5 build-time consistency 사슬의 잔여 gap을 닫는다. `buildRealDataResultIssueOutcomeReport(outcome, run)`(T-0590, `test/helpers/realdata-e2e-result-issue-outcome-report.ts`)은 박제 outcome(issueNumber/url) + run 식별자(gitSha/dateToken)를 결합해 실행 리포트 descriptor를 합성하며, 그 중 `summaryLine`은 `[${run.dateToken}@${run.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${url}` 템플릿으로 구성 필드를 단일 source로 재합성한 사람-친화 한 줄 요약이다.

상위 from-output 가드(`assertRealDataResultIssueOutcomeReportConsistentWithOutput`, T-0596)는 expected report를 만들 때 **동일한 `buildRealDataResultIssueOutcomeReport`를 재호출**해 deep-equal 대조하므로 — summaryLine 합성 로직 자체가 회귀로 drift(예: 구분자 변경·필드 누락·순서 뒤바뀜)하면 양쪽이 동일하게 drift해 가드가 잡지 못한다(재구현이 아닌 재호출의 한계). origin/main grep으로 `summaryLine ↔ 박제 5필드` 독립 재합성 정합 가드가 부재함을 확인했다(가드 심볼·파일 grep 0).

본 task는 `summaryLine`을 가드 내부에서 **독립적으로 재합성**(report의 issueNumber/url/gitSha/dateToken만으로)해 `report.summaryLine`과 byte-identical한지 대조하는 순수 가드를 신설한다. 이로써 summaryLine drift가 build-time에 fail-fast로 잡힌다(REQ-059 raw 미저장 정합 — 리포트는 식별자·박제 결과만 보유, narrative 미포함도 함께 단언). T-0699/T-0695 leaf 가드 신설 패턴과 동형이며, 후속으로 컴포저 self-wire 짝(별도 task)을 닫는다.

새 dependency / schema / security 결정 없음 — test helper 단독 신설(타입 import 재사용만). BLOCKED 사유 후보 없음.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — 가드 대상 컴포저. summaryLine 템플릿(L107)과 5필드 descriptor(L49~55), guard 분기(assertNonBlank / assertPositiveIssueNumber)를 그대로 single source로 삼는다.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — 상위 from-output 가드. 재호출 deep-equal 패턴을 참조하되, 본 가드는 **summaryLine을 독립 재합성**하는 점이 다름(동일 함수 재호출 금지).
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` — 기존 leaf 가드의 throw 분기(구조 결손 TypeError / 값 정합 위반 RangeError 분리) + 한국어 명세형 에러 메시지 스타일 참조.
- `test/helpers/realdata-e2e-result-issue-search-argv-consistency.ts` — leaf "보존(preserves)" 가드의 colocated spec 케이스 구성 참조(happy / 필드별 drift negative / 비변형).

## Acceptance Criteria

신규 파일 2개(colocated spec 우선):
- 가드: `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.ts`
- spec: `test/helpers/realdata-e2e-result-issue-outcome-report-summary-line-consistency.spec.ts` (colocated)

- [ ] 순수 가드 함수 1개 export (예: `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report: RealDataResultIssueOutcomeReport): void`). 인자 외 상태 의존 0, 입력 mutate 0, 정상이면 void 반환(동작·반환값 byte-identical 보존).
- [ ] 가드 내부에서 `report`의 issueNumber/url/gitSha/dateToken만으로 expected summaryLine을 **독립 재합성**(컴포저의 `buildRealDataResultIssueOutcomeReport` 재호출 금지 — 재호출은 from-output 가드가 이미 cover, 본 가드는 summaryLine 합성 로직의 독립 재구현이 핵심)한 뒤 `report.summaryLine`과 byte-identical 대조. 불일치 시 한국어 명세형 에러 throw.
- [ ] 구조 결손(필드 부재·타입 불일치 등)과 값 정합 위반(summaryLine drift)을 분리된 에러 종류/분기로 throw(기존 leaf 가드의 TypeError/RangeError 분리 스타일 정합).
- [ ] **Happy-path test**: 정상 report(정상 outcome+run에서 `buildRealDataResultIssueOutcomeReport`로 합성한 산출)에 대해 가드가 void 반환(throw 0) 1+.
- [ ] **Error path test**: summaryLine을 변조한(예: 구분자 변경·issueNumber 숫자 mismatch·url drift·dateToken/gitSha 자리 바뀜) report에 대해 가드가 throw 1+ 각 변조 종류별.
- [ ] **Branch / flow coverage**: 가드 내 모든 분기(구조 결손 throw 분기 vs 값 정합 위반 throw 분기 vs 정상 void)별 test 1+.
- [ ] **Negative cases 충분 cover** — 다음 예외 상황 각 1+ test: (a) summaryLine 빈/공백, (b) 5필드 중 하나 누락/undefined로 구조 결손, (c) issueNumber 0/음수/비정수가 summaryLine과 불일치, (d) url trailing 공백/개행 미정규화 drift, (e) gitSha·dateToken 위치 swap drift, (f) 정상 입력의 비변형(가드 호출 전후 report deep-equal 불변) 검증. 단일 negative만 작성 금지 — 변조 분기마다 cover.
- [ ] **결정론/무공유 test**: 동일 report 두 번 가드 호출 → 동일 결과(void), 가드가 report 객체·하위 필드를 mutate하지 않음 검증.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 가드 파일 line/branch/func/stmt 100% 목표.

## Out of Scope

- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` 컴포저 본문 수정 / self-wire 배선 — 본 task는 **가드 신설만**(self-wire 짝 닫기는 후속 별도 task, T-0699→T-0700 패턴 동형).
- from-output 가드(`...-from-output-consistency.ts`) 수정 — 본 가드와 책임 분리(그쪽은 재호출 chain, 본 가드는 summaryLine 독립 재합성).
- production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
- 실 gh 호출 / execFile / 이슈 실 박제 / live wiring (step④ live, credential gate, deferred).
- summary-line-format-shape(T-0581 shape 가드)·result-summary 집계와의 통합 — 본 가드는 outcome-report summaryLine 단일 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어있음 — sub-agent가 관련 작업 발견 시 추가)
