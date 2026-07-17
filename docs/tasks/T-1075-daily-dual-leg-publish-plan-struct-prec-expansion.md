---
id: T-1075
title: realdata-e2e daily-step-dual-leg run-report-issue-publish-plan consistency-guard 구조-검사 선행성 order-lock 확장 — 구조 결손(TypeError) 6 분기가 값 재유도(command-plan → search-gh-argv 2 위임)보다 먼저 수행됨을 두 재유도-delegate 각 0-call spy 로 전량 못박는 defense-in-depth (구조-guard 선행성 sweep leg 10 expansion, T-1074 Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 150
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 10 (expansion) — daily 형제 publish-plan 은 L344 에 부분 short-circuit 만 보유. pre-check 실증(grep+read, 2026-07-17): 가드 assertPlanStructure(L206)가 재유도 2 위임(buildRealDataDailyStepDualLegRunReportIssueCommandPlan L217 → buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv L219)보다 먼저 수행되나, spec(584줄, zerocall=1)의 구조-선행성 spy assert 는 L344 descriptor:null 1 분기 × 첫 delegate commandPlanSpy 만(searchArgvSpy 0-call 미검증). searchArgvSpy 의 유일 0-call(L387/L500)은 command-plan throw 주입 value-재유도 fail-fast(구조 아님). 구조 결손 6 분기(plan null·plan undefined·descriptor 비-object·commandArgs 비-object·searchArgv 비-배열·searchArgv 원소 비-string) × 2 delegate 각 toHaveBeenCalledTimes(0) 로 선행성 전량 완결. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1075 — daily-step-dual-leg run-report-issue-publish-plan 구조-검사 선행성 order-lock 확장

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → … → leg 8 daily-step-dual-leg run-report-issue-command-plan(T-1073) → leg 9 daily-step-dual-leg run-report-issue-outcome-report-from-output(T-1074)으로 이어졌다. 본 task 는 그 **leg 10 (expansion)** 으로, T-1074 Follow-up 이 leg 10+ 후보로 지목한 daily 형제 가드 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts`)를 삼는다. 이 가드는 publish-plan 컴포저(`buildRealDataDailyStepDualLegRunReportIssuePublishPlan`)의 산출 `plan({descriptor, commandArgs, searchArgv})`을 single source `report` 로 2층 위임(command-plan 컴포저 → search-gh-argv 빌더)으로 재유도한 expected 와 byte-identical 대조하는 seam 무결성 조각이다(README.md 109행 step ④ 결과 박제 chain 의 post-composition 무결성).

planner pre-check(실 grep + read, 2026-07-17)로 확인한 gap: 이 가드는 본문에서 구조 검사(`assertPlanStructure(plan)`(L206) — plan null/undefined → TypeError L113, `plan.descriptor` 비-object → TypeError L118, `plan.commandArgs` 비-object → TypeError L123, `plan.searchArgv` 비-배열 → TypeError L128, `plan.searchArgv` 원소 비-string → TypeError L133)를 값 재유도 위임(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)`(L217) → `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs)`(L219))보다 **먼저** 수행한다(구조검사 L206 < 첫 재유도 L217). 그러나 대응 spec(총 584 line, 전역 `toHaveBeenCalledTimes(0)` 등장 1회)의 구조-선행성 spy 검증은 L344 의 **단일 분기·단일 delegate** 만 못박는다 — `descriptor: null` 1 분기에서 `commandPlanSpy`(첫 delegate)의 `.not.toHaveBeenCalled()` 만 assert 하고, **2nd delegate `searchArgvSpy` 의 구조 위반 시 0-call 은 전혀 검증하지 않으며**, 나머지 5 구조 분기(plan null·plan undefined·commandArgs 비-object·searchArgv 비-배열·searchArgv 원소 비-string)는 spy 없이 `.toThrow(TypeError)`(L220~296) 만 assert 한다. spec 전역 유일한 `searchArgvSpy` 0-call(L387·L500)은 **command-plan 컴포저 throw 주입 시** search-gh-argv 미도달을 못박는 값-재유도 fail-fast(구조 아님)라 구조 error-path 는 미커버다. 구조 결손 입력을 주면 두 재유도 delegate(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`·`buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`) spy 가 **모두** `toHaveBeenCalledTimes(0)` 이어야 하며, 이를 6 구조 분기 전량에 두 delegate 각각 spy 로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1074 와 동형 defense-in-depth). 본 leg 는 clean 신설이 아니라 부분 short-circuit(L344)을 6 분기 × 2 delegate 로 **확장 완결** 하는 expansion leg 다. test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataDailyStepDualLegRunReportIssuePublishPlanConsistentWithSource`(L200~) 본문의 구조 검사(`assertPlanStructure(plan)` L206)가 재유도 2 위임(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan(report)` L217 + `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(expectedCommandArgs)` L219)보다 앞섬을 확인(구조검사 L206 < 첫 재유도 L217). 구조 assert 함수 `assertPlanStructure`(L110~)의 6 분기(plan null/undefined L113 / descriptor 비-object L118 / commandArgs 비-object L123 / searchArgv 비-배열 L128 / searchArgv 원소 비-string L133)를 확인. 값 정합 위반 RangeError 분기(descriptor L225 / commandArgs L232 / searchArgv L239)는 구조 검사 **통과 후** 재유도 뒤에 위치함을 확인. **광범위 read 금지 — 해당 함수 + assertPlanStructure 본문만.**
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 기존 구조 error-path 블록(L220~ `구조 결손 — null/undefined → TypeError`, L240~ `구성요소 type 위반 → TypeError`)은 `.toThrow(TypeError)` 만 assert 하고 spy 부재임을 확인. 기존 short-circuit 블록(L326~ `command-plan 컴포저 위임 / short-circuit`)의 L344 는 `descriptor: null` 1 분기에서 `commandPlanSpy`(첫 delegate)만 `.not.toHaveBeenCalled()` 하고 `searchArgvSpy` 0-call 은 미검증임을 확인. 기존 순서-lock 블록(T-1059, L417~: 정합-경로 command-plan<search-gh-argv `invocationCallOrder` 부등식) + command-plan throw 주입 시 `searchArgvSpy` 0-call(L500, 값-재유도 fail-fast)은 유지하고 **새 describe 블록으로 구조-선행성만 추가**. spy target 모듈은 기존 블록의 namespace import `commandPlanModule`(L29, `buildRealDataDailyStepDualLegRunReportIssueCommandPlan`)·`searchArgvModule`(L33, `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv`) 을 재사용. 최상위 `afterEach` `jest.restoreAllMocks()`(L67~68) 가 신규 spyOn 격리를 보장함을 확인. 정상 fixture `makePlan()`(L60)·`HAPPY_REPORT`(L56) 를 재사용.
- `docs/tasks/T-1074-daily-dual-leg-outcome-report-from-output-struct-prec.md` — 본 축 leg 9(패턴 precedent, daily family). `docs/tasks/T-1069-publish-plan-struct-precedence.md` — 본 가드의 result-issue 형제(result-issue-publish-plan) 구조-선행성 leg 4. 동일 패턴(구조 결손 → 두 재유도 delegate 각 0-call spy + 구조 vs 값 경계 대조)을 mirror 하되, 본 leg 는 부분 short-circuit(L344) 을 6 분기 × 2 delegate 로 확장 완결한다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `plan`/`report` 입력에서 가드가 void 반환하고, `buildRealDataDailyStepDualLegRunReportIssueCommandPlan` → `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` spy 가 `invocationCallOrder` 부등식 순서로 정확히 각 1회 호출됨을 재확인(기존 T-1059 정합-경로 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`plan` null, `plan` undefined, `plan.descriptor` 비-object, `plan.commandArgs` 비-object, `plan.searchArgv` 비-배열, `plan.searchArgv` 원소 비-string)에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`·`buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 **두 delegate 각각** spy 로 못박는다(기존 L344 의 descriptor:null 1 분기·commandPlan-only 를 6 분기 × 2 delegate 로 확장 완결).
- [ ] **flow/branch cover**: 구조 검사 분기(plan 존재 / descriptor object / commandArgs object / searchArgv 배열 / searchArgv 원소 문자열) 각각에 대해 위 "TypeError + 2 delegate 각 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음). plan null 과 undefined 는 별 case 로 분리.
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 비-object/배열 mismatch · 원소 type mismatch[문자열↔숫자]) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: descriptor/commandArgs/searchArgv drift)은 구조 검사를 통과해 재유도가 호출된 뒤 발생**함(즉 RangeError 경로에서는 command-plan·search-gh-argv spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, 두 delegate 0-call) vs 값(RangeError, delegate 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts` 값이 기존(1)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 6 분기 전량에 두 delegate(command-plan·search-gh-argv) 각각 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 daily-step-dual-leg run-report-issue-publish-plan **1개** 만(leg 10). 나머지 적격 daily family 가드는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 정합-경로 `invocationCallOrder` 블록(T-1059)·기존 값-재유도 fail-fast(command-plan throw → search-gh-argv 0-call, L500) 테스트·기존 구조 error-path TypeError 테스트(L220~296)·기존 부분 short-circuit(L344) 테스트의 삭제·재작성 — 유지하고 새 describe 로 확장 추가만.
- daily 형제 `-gh-command-plan-consistency`(delegates=3, zerocall=3) 의 구조-선행성 잔여 gap 판정·확장 — 본 leg 아님(별도 leg 로 이연, Follow-ups 참조).
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1074 defense-in-depth 패턴의 daily publish-plan mirror·부분 short-circuit 확장). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 6 분기 × 2 delegate 각 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 11+) 본 leg 를 mirror 해 남은 적격 daily family 가드를 순차 leg 화. pre-check 실증(planner grep+read, 2026-07-17)으로 확인된 미(또는 부분)lock 적격 가드: `daily-step-dual-leg-run-report-issue-gh-command-plan-consistency`(delegates=3, zerocall=3 at L963/964/999 — 이미 일부 구조-선행성 0-call 보유 가능성 → read 정밀 pre-check 후 잔여 gap 판정: 3 delegate 전량이 구조 결손 분기 각각에 0-call 로 못박혔는지 확인, 부분이면 확장 leg). 적격 grep: 각 guard 의 구조검사(assert*Structure/TypeError)가 재유도(build*/parse*/resolve*)보다 앞서고, spec 의 구조 error-path 테스트에 재유도 위임 `toHaveBeenCalledTimes(0)` assert 가 delegate 전량·분기 전량에 존재하지 않으면(부재 또는 부분) 적격.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
