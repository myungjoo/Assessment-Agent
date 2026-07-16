---
id: T-1038
title: summary(result-issue) output-parse self-wire 두 가드 호출 순서(Shape→OutputConsistent)를 invocationCallOrder 순서-lock test 로 못박기 (daily output-parse T-0907 canonical mirror, 요약축 leg)
phase: P5
status: DONE
mergedAs: 9844c4c5
prNumber: 932
reviewRounds: 1
completed: 2026-07-16
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-output-parse.spec.ts
independentStream: realdata-e2e-result-issue-output-parse
plannerNote: "P5 test-hardening — outcome-report 축 완료(T-1036/37) 후 output-parse 축 요약축 leg 로 sweep 확장. daily canonical(output-parse.spec T-0907 L498 shapeSpy<valueSpy) 이미 존재, 요약축 spec invocationCallOrder 0건(실 gap). producer L143 Shape→L155 OutputConsistent 두 distinct 가드 self-wire. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1038 — summary(result-issue) output-parse self-wire 호출 순서(Shape→OutputConsistent) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-assert 하는 2+ distinct 가드의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 두 축(daily canonical / summary mirror)에 걸쳐 정비해 왔다. command-args 축(daily L832 / summary T-1033), descriptor 축(daily T-1034 / summary T-1035), outcome-report 축(daily T-1036 / summary T-1037)이 모두 완료됐다.

다음 미정비 축은 **output-parse** 다. producer `parseRealDataResultIssueCreateEditOutput` 은 return 직전 두 distinct 가드를 순서대로 self-assert 한다(L143 `assertRealDataResultIssueOutcomeMatchesParseShape` = 키 집합 set-equality 가드 → L155 `assertRealDataResultIssueOutputConsistentWithStdout` = 값-정합 가드). 그런데 spec `realdata-e2e-result-issue-output-parse.spec.ts` 에는 각 가드 self-wire 배선 검증(T-0662 Shape, T-0724 OutputConsistent)만 있고 **두 가드의 상대 호출 순서 lock 이 부재**하다(`invocationCallOrder` grep 0건). Shape 가드와 OutputConsistent 가드의 self-wire 순서가 실수로 뒤바뀌어도 현행 test 는 통과한다.

daily output-parse leg 는 이미 canonical 순서-lock 을 보유한다(`realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts` 의 T-0907 블록 L498~499 `shapeSpy.invocationCallOrder[0] < valueSpy...`). 본 task 는 그 canonical 패턴을 output-parse 축의 **요약축(result-issue) leg** 로 mirror 한다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.spec.ts` — 본 task 가 수정할 유일 파일(465줄). 두 self-wire describe 블록 구조·spy 셋업 확인: T-0662 블록(L195~, Shape 가드 `outcomeShapeModule.assertRealDataResultIssueOutcomeMatchesParseShape` self-wire)과 T-0724 블록(L341~, 값-정합 가드 `outputParseConsistencyModule.assertRealDataResultIssueOutputConsistentWithStdout` self-wire). 본 task 는 마지막 블록(T-0724) 끝에 순서-lock/fail-fast test 를 append. 두 모듈 import alias(`outcomeShapeModule`, `outputParseConsistencyModule`) 는 이미 존재.
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — producer self-wire 지점 확인용(수정 금지). `parseRealDataResultIssueCreateEditOutput` 함수 내 L143 `assertRealDataResultIssueOutcomeMatchesParseShape(outcome, ...)` (첫 호출) → L155 `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout)` (둘째 호출) → 이후 `return outcome`.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts` (daily canonical, T-0907 블록 L498~499 에 `shapeSpy.mock.invocationCallOrder[0] < valueSpy.mock.invocationCallOrder[0]` 순서-lock 이 박제된 블록) — mirror 대상 canonical 패턴. 동일 스타일(실 구현 pass-through spy + `toBeLessThan` 부등식 + Shape throw → OutputConsistent 0회 fail-fast)으로 작성.

## Acceptance Criteria

- [ ] **순서-lock test 추가 (happy-path/flow)**: T-0724 self-wire describe 블록 끝에 두 가드의 상대 호출 순서를 못박는 test 1개 추가 — 두 가드를 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 producer 를 정상 stdout 1회로 호출한 뒤 `shapeSpy.mock.invocationCallOrder[0]` 이 `valueSpy.mock.invocationCallOrder[0]` 보다 **작음(Shape 먼저)** 을 `toBeLessThan` 부등식으로 검증.
- [ ] **fail-fast test 추가 (error path/negative)**: 첫 가드(Shape)가 throw 하면 둘째 가드(OutputConsistent)가 **호출되지 않음(spy 0회)** 을 검증하는 test 1개 추가 — Shape 가드를 throw 하도록 mock 하고, producer 호출이 그 에러를 선전파(fail-fast)하며 OutputConsistent spy 가 호출되지 않았음(`toHaveBeenCalledTimes(0)`)을 assert.
- [ ] **branch/negative 보강**: 위 순서-lock test 는 실 구현 pass-through spy 이므로 산출 outcome 이 self-wire 삽입 전후 byte-identical(`{issueNumber, url}` 필드값·키 순서 불변)임을 함께 재확인(production 무변경 회귀 0). 분기 추가 없음 — production 코드 무변경, test-only.
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-output-parse.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-output-parse.spec.ts` 가 1건 이상(이전 0건) — 순서-lock 실배선 확인.

## Out of Scope

- daily `realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts` 의 순서-lock — 이미 T-0907 canonical 로 완료(본 task 는 요약축 mirror leg 만).
- producer `.ts` 의 self-wire 호출 순서 **재정렬 / 정규화** — 현행 순서(Shape→OutputConsistent)를 lock 만 하고 바꾸지 않는다.
- 다른 축(search-parse, search-argv, outcome-report-from-output 등)의 요약축 순서-lock — 각자 별도 후속 task(daily canonical 은 이미 존재하나 요약축 mirror 미정비).
- 가드 로직·인자 순서·에러 정책 변경.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
