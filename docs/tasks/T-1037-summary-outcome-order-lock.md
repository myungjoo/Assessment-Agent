---
id: T-1037
title: summary(result-issue) outcome-report self-wire 두 가드 호출 순서(SummaryLine→OutputConsistent)를 invocationCallOrder 순서-lock test 로 못박기 (daily outcome-report T-1036 mirror, 요약축 leg)
phase: P5
status: DONE
mergedAs: 3cf578eb
prNumber: 931
reviewRounds: 1
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts
independentStream: realdata-e2e-result-issue-outcome-report
plannerNote: "P5 test-hardening — outcome-report 축 canonical daily(T-1036) 순서-lock 을 요약축 result-issue leg 로 mirror. producer L135 SummaryLine→L146 OutputConsistent 두 distinct 가드 self-wire 하나 spec invocationCallOrder 0건(실 gap). pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1037 — summary(result-issue) outcome-report self-wire 호출 순서(SummaryLine→OutputConsistent) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-assert 하는 2+ distinct 가드의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 두 축(daily canonical / summary mirror)에 걸쳐 정비해 왔다. command-args 축(daily L832 canonical, summary T-1033 mirror)과 descriptor 축(daily T-1034 canonical, summary T-1035 mirror)은 완료됐고, outcome-report 축은 canonical daily leg(T-1036)가 완료됐다.

그러나 outcome-report 축의 **요약축(result-issue) leg** 는 producer `buildRealDataResultIssueOutcomeReport` 가 return 직전 두 distinct 가드를 순서대로 self-assert 하는데도(L135 `...SummaryLineConsistent` → L146 `...OutputConsistentWithInput`), spec 에는 각 가드 self-wire 배선(T-0702 SummaryLine, T-0726 OutputConsistent) 검증과 공존 test(⑨ 둘 다 1회 호출)만 있고 **두 가드의 상대 호출 순서 lock 이 부재**하다(`invocationCallOrder` grep 0건). SummaryLine 가드와 OutputConsistent 가드의 self-wire 순서가 실수로 뒤바뀌어도 현행 test 는 통과한다. 본 task 는 daily canonical T-1036 이 확립한 순서-lock 패턴을 outcome-report 축의 **요약축 leg** 로 mirror 한다(canonical daily 는 T-1036 로 이미 완료). production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts` — 본 task 가 수정할 유일 파일. 마지막 describe 블록(T-0726 값-정합 가드 self-wire, 대략 L314~L461, 순환번호 ①~⑨)의 구조·spy 셋업 확인. 이미 `summaryLineConsistency`·`outputConsistency` 두 모듈 import alias 와 공존 test ⑨(두 가드 각 1회 호출)가 존재 — 본 task 는 그 뒤에 순서-lock/fail-fast test 를 append.
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — producer self-wire 지점 확인용(수정 금지). L135 `assertRealDataResultIssueOutcomeReportSummaryLineConsistent(report)` (첫 호출) → L146 `assertRealDataResultIssueOutcomeReportOutputConsistentWithInput(...)` (둘째 호출) → 이후 return.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` (T-1036 canonical, invocationCallOrder 순서-lock ⑦ + fail-fast ⑧ 이 박제된 블록) — mirror 대상 canonical 패턴. 동일 스타일(실 구현 pass-through spy + `toBeLessThan` 부등식 + SummaryLine throw → OutputConsistent 0회)으로 작성.

## Acceptance Criteria

- [ ] **순서-lock test 추가 (happy-path/flow)**: 기존 self-wire describe 블록 끝(⑨ 다음)에 두 가드의 상대 호출 순서를 못박는 test 1개 추가 — 두 가드를 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 producer 를 1회 호출한 뒤 `summarySpy.mock.invocationCallOrder[0]` 이 `outputSpy.mock.invocationCallOrder[0]` 보다 **작음(SummaryLine 먼저)** 을 `toBeLessThan` 부등식으로 검증. (기존 번호 체계를 이어 예: ⑩)
- [ ] **fail-fast test 추가 (error path/negative)**: 첫 가드(SummaryLine)가 throw 하면 둘째 가드(OutputConsistent)가 **호출되지 않음(spy 0회)** 을 검증하는 test 1개 추가 — SummaryLine 가드를 throw 하도록 mock 하고, producer 호출이 그 에러를 선전파(fail-fast)하며 OutputConsistent spy 가 호출되지 않았음(`toHaveBeenCalledTimes(0)`)을 assert. (예: ⑪)
- [ ] **branch/negative 보강**: 위 순서-lock test 는 실 구현 pass-through spy 이므로 산출 report 가 self-wire 삽입 전후 byte-identical(필드값·순서 불변)임을 함께 재확인(production 무변경 회귀 0). 분기 추가 없음 — production 코드 무변경, test-only.
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-outcome-report.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts` 가 1건 이상(이전 0건) — 순서-lock 실배선 확인.

## Out of Scope

- daily `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report.spec.ts` 의 순서-lock — 이미 T-1036 canonical 로 완료(본 task 는 요약축 mirror leg 만).
- producer `.ts` 의 self-wire 호출 순서 **재정렬 / 정규화** — 현행 순서(SummaryLine→OutputConsistent)를 lock 만 하고 바꾸지 않는다. 순서가 broad-first 관례에 맞는지의 판단은 out-of-scope.
- 다른 축(search-parse, output-parse 등)의 순서-lock — 각자 별도 task.
- 가드 로직·인자 순서·에러 정책 변경.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
