---
id: T-1072
title: realdata-e2e result-issue-outcome-report-from-output consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 분기가 값 재유도(parse → buildOutcomeReport 2 위임)보다 먼저 수행됨을 재유도-delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 7, T-1071 Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 7 — T-1071(gh-command-plan) mirror. pre-check 실증: 가드가 구조검사(assertReportStructure L157 / assertRunStructure L158 / stdout 비-string TypeError L160)를 값 재유도(parseRealDataResultIssueCreateEditOutput → buildRealDataResultIssueOutcomeReport L168~169)보다 먼저 수행하나, spec 의 구조 error-path 블록(L159~263: null/undefined→TypeError, 필드 type 위반→TypeError)은 각 분기 .toThrow(TypeError) 만 assert·2 재유도 delegate 0-call 미검증. 기존 순서-lock 블록(T-1062, L366~473)은 정합-경로 parse<build ico + 값-재유도 fail-fast(parse throw→build 0-call, L441)만 lock(spec 전역 zerocall=1). 구조 결손서 2 delegate spy 0-call 로 선행성 못박음. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1072 — result-issue-outcome-report-from-output 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → leg 2 evaluation-plan(T-1067) → leg 3 result-issue-command-plan(T-1068) → leg 4 result-issue-publish-plan(T-1069) → leg 5 step-args aggregator(T-1070) → leg 6 result-issue-gh-command-plan(T-1071)로 이어졌다. 본 task 는 그 **leg 7** 로, T-1071 Follow-up 이 지시한 "구조 검사 + 1+ 재유도 위임 보유 가드 재판정" 을 이행해 남은 result-issue-\* family 적격 가드 `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(`test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`)를 mirror 대상으로 삼는다. 이 가드는 step④ 결과 박제 종단 컴포저(`buildRealDataResultIssueOutcomeReportFromOutput`)의 산출 `report` 를 입력 `(stdout, run)` 로 2 위임 helper(parse → buildOutcomeReport)로 재유도한 expected 와 byte-identical 대조하는 seam 무결성 조각이다.

planner pre-check(실 grep)로 확인한 gap: 이 가드는 본문에서 구조 검사(`assertReportStructure(report)`(L157) → `assertRunStructure(run)`(L158) → `stdout` 비-string TypeError(L160~166))를 값 재유도 위임(`buildRealDataResultIssueOutcomeReport(parseRealDataResultIssueCreateEditOutput(stdout), run)`(L168~169))보다 **먼저** 수행한다(구조검사 L157~166 < 첫 재유도 L168). 그러나 대응 spec(총 474 line, 전역 `toHaveBeenCalledTimes(0)` 등장 1회)의 구조 error-path 블록(L159~219 `구조 결손 — null/undefined → TypeError`: report null/undefined, run null/undefined, stdout 비-string/null; L221~263 `report 필드 type 위반 → TypeError`: issueNumber 문자열, summaryLine 숫자, url 누락)은 오직 `.toThrow(TypeError)` 만 assert 하며 **구조 위반 시 2 재유도 delegate 가 아예 호출되지 않는(선행 fail-fast) 선행성** 은 검증하지 않는다. 기존 순서-lock 블록(T-1062, L366~473)은 정합-경로 `invocationCallOrder` 부등식(parse < buildOutcomeReport) + **값-재유도 fail-fast**(parse throw → build 0-call, L441)만 못박아 구조 error-path 는 미커버다(이 값 fail-fast 가 spec 전역 유일한 0-call = zerocall 1). 구조 결손 입력을 주면 `parseRealDataResultIssueCreateEditOutput`·`buildRealDataResultIssueOutcomeReport` spy 가 모두 `toHaveBeenCalledTimes(0)` 이어야 하며, 이를 spy 로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1071 와 동형 defense-in-depth). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataResultIssueOutcomeReportConsistentWithOutput`(L151~) 본문의 구조 검사 3 지점(`assertReportStructure(report)` L157 / `assertRunStructure(run)` L158 / `stdout` 비-string TypeError L160~166)이 재유도 위임 2 호출(`parseRealDataResultIssueCreateEditOutput` + `buildRealDataResultIssueOutcomeReport` L168~169)보다 앞섬을 확인(구조검사 라인 < 첫 재유도 라인). 구조 assert 함수 분기(`assertReportStructure` L71~93: report 비-object + 5 필드 type / `assertRunStructure` L98~113ish: run 비-object + gitSha/dateToken type)를 확인. 값 정합 위반 RangeError 분기(L176~)는 구조 검사 **통과 후** 재유도 뒤에 위치함을 확인. **광범위 read 금지 — 해당 함수 본문만.**
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 기존 구조 error-path 블록(L159~219 `구조 결손 — null/undefined → TypeError`, L221~263 `report 필드 type 위반 → TypeError`)은 `.toThrow(TypeError)` 만 assert 함을 확인. 기존 순서-lock 블록(L366~473: 정합-경로 parse<buildOutcomeReport `invocationCallOrder` 부등식 + parse-throw fail-fast `toHaveBeenCalledTimes(0)` L441)은 유지하고 **새 describe 블록으로 구조-선행성만 추가**. spy target 모듈은 기존 블록의 namespace import `outputParseModule`(L24, `parseRealDataResultIssueCreateEditOutput`)·`outcomeReportModule`(L21, `buildRealDataResultIssueOutcomeReport`) 을 재사용. 최상위 `afterEach` `jest.restoreAllMocks()`(L45~46) 가 신규 spyOn 격리를 보장함을 확인. `makeHappyReport()`(L34~40) 정상 fixture 재사용.
- `docs/tasks/T-1071-realdata-e2e-result-issue-gh-command-plan-order-lock.md` — 본 축 leg 6(패턴 precedent). 동일 패턴(구조 결손 → 재유도 delegate 0-call spy + 구조 vs 값 경계 대조)을 mirror 한다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `report`/`stdout`/`run` 입력에서 가드가 void 반환하고, `parseRealDataResultIssueCreateEditOutput` → `buildRealDataResultIssueOutcomeReport` spy 가 `invocationCallOrder` 부등식 순서로 정확히 각 1회 호출됨을 재확인(기존 정합-경로 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`report` null/undefined, `report` 필드 type 위반[issueNumber 문자열 · summaryLine 숫자 · url 누락 대표], `run` null/undefined, `stdout` 비-string)에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`parseRealDataResultIssueCreateEditOutput`·`buildRealDataResultIssueOutcomeReport` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 spy 로 못박는다.
- [ ] **flow/branch cover**: 구조 검사 분기(report 객체 / report 필드 type / run 객체 / stdout 문자열) 각각에 대해 위 "TypeError + 2 delegate 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음).
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 비-object/필드 type mismatch[문자열↔숫자 등]) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: report 필드 drift)은 구조 검사를 통과해 재유도가 호출된 뒤 발생**함(즉 RangeError 경로에서는 parse/buildOutcomeReport spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, delegate 0-call) vs 값(RangeError, delegate 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts` 값이 기존(1)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 분기 전량에 2 delegate 각각 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 result-issue-outcome-report-from-output **1개** 만(leg 7). 나머지 적격 가드(구조 검사 + 1+ 재유도 위임 보유, 예: daily-step-dual-leg-run-report-issue-command-plan / -publish-plan / -gh-command-plan / -outcome-report-from-output 4종 — 모두 pre-check 상 zerocall 1~3 로 미lock)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 정합-경로 `invocationCallOrder` 블록(T-1062)·기존 값-재유도 fail-fast(parse throw) 테스트·기존 구조 error-path TypeError 테스트의 삭제·재작성 — 유지하고 새 describe 로 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1071 defense-in-depth 패턴의 outcome-report-from-output mirror). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 분기 2 delegate 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 8+) 본 leg 를 mirror 해 남은 적격 가드를 순차 leg 화. pre-check 실증(planner grep, 2026-07-17)으로 확인된 미lock 적격 가드 4종: `daily-step-dual-leg-run-report-issue-command-plan-consistency`(delegates=2, zerocall=1), `daily-step-dual-leg-run-report-issue-publish-plan-consistency`(delegates=2, zerocall=1), `daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency`(delegates=2, zerocall=1), `daily-step-dual-leg-run-report-issue-gh-command-plan-consistency`(delegates=3, zerocall=3). 적격 grep: 각 guard 의 구조검사(assert*Structure/TypeError)가 재유도(build*/parse*/resolve*)보다 앞서고, spec 의 구조 error-path 테스트에 재유도 위임 `toHaveBeenCalledTimes(0)` assert 부재면 적격. daily-step-dual-leg 계열 mirror 소진 후 result-issue-\* + daily 양 family 전량 구조-선행성 lock 완료.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
