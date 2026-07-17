---
id: T-1073
title: realdata-e2e daily-step-dual-leg run-report-issue-command-plan consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 분기가 값 재유도(descriptor → command-args 2 위임)보다 먼저 수행됨을 재유도-delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 8, T-1072 Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 8 — T-1072(result-issue-outcome-report) mirror, daily family 첫 leg. pre-check 실증(grep 2026-07-17): 가드가 구조검사(assertPlanStructure L186: plan null/undefined + descriptor/commandArgs 비-object → TypeError)를 값 재유도(buildRealDataDailyStepDualLegRunReportIssueDescriptor L193 → …CommandArgs L195) 2 위임보다 먼저 수행하나, spec(693줄, zerocall=1)의 구조 error-path 블록(L298~316 null/undefined→TypeError, L318~405 구성요소 type 위반→TypeError)은 각 분기 .toThrow 만 assert·2 재유도 delegate 0-call 미검증. 유일 zerocall(L658)은 descriptor throw→command-args 0-call = 값-재유도 fail-fast(구조 아님). 구조 결손서 2 delegate spy 0-call 로 선행성 못박음. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1073 — daily-step-dual-leg run-report-issue-command-plan 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → leg 2 evaluation-plan(T-1067) → leg 3 result-issue-command-plan(T-1068) → leg 4 result-issue-publish-plan(T-1069) → leg 5 step-args aggregator(T-1070) → leg 6 result-issue-gh-command-plan(T-1071) → leg 7 result-issue-outcome-report-from-output(T-1072)로 이어졌다. 본 task 는 그 **leg 8** 로, T-1072 Follow-up 이 지시한 daily-step-dual-leg family 첫 mirror 대상 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts`)를 삼는다. 이 가드는 컴포저(`buildRealDataDailyStepDualLegRunReportIssueCommandPlan`)의 산출 `plan`(descriptor + commandArgs 2 구성요소)을 입력 `report` 로 2 위임 helper(descriptor 재유도 → command-args 재유도)로 재유도한 expected 와 byte-identical 대조하는 seam 무결성 조각이다.

planner pre-check(실 grep, 2026-07-17)로 확인한 gap: 이 가드는 본문에서 구조 검사(`assertPlanStructure(plan)`(L186): `plan` null/undefined → TypeError, `plan.descriptor`/`plan.commandArgs` 비-object → TypeError)를 값 재유도 위임(`buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(L193) → `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor)`(L195))보다 **먼저** 수행한다(구조검사 L186 < 첫 재유도 L193). 그러나 대응 spec(총 693 line, 전역 `toHaveBeenCalledTimes(0)` 등장 1회)의 구조 error-path 블록(L298~316 `구조 결손 — null/undefined → TypeError`: plan null/undefined; L318~405 `구성요소 type 위반 → TypeError`: descriptor 비-object[null/배열/primitive], commandArgs 비-object[null/배열/primitive])은 오직 `.toThrow(TypeError)` 만 assert 하며 **구조 위반 시 2 재유도 delegate 가 아예 호출되지 않는(선행 fail-fast) 선행성** 은 검증하지 않는다. 유일한 zerocall(L637~658: descriptor 위임 throw → command-args `toHaveBeenCalledTimes(0)`)은 **값-재유도 fail-fast**(descriptor 재유도가 throw 하면 후속 command-args 재유도 미도달)이지 구조 결손 선행성이 아니다(spec 전역 zerocall 1 = 이것). 구조 결손 입력을 주면 `buildRealDataDailyStepDualLegRunReportIssueDescriptor`·`buildRealDataDailyStepDualLegRunReportIssueCommandArgs` spy 가 모두 `toHaveBeenCalledTimes(0)` 이어야 하며, 이를 spy 로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1072 와 동형 defense-in-depth). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataDailyStepDualLegRunReportIssueCommandPlanConsistentWithSource`(L180~) 본문의 구조 검사(`assertPlanStructure(plan)` L186)가 재유도 위임 2 호출(`buildRealDataDailyStepDualLegRunReportIssueDescriptor` L193 + `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` L195)보다 앞섬을 확인(구조검사 L186 < 첫 재유도 L193). 구조 assert 함수 `assertPlanStructure`(L105~119: plan 비-object → TypeError L109, descriptor 비-object → TypeError L114, commandArgs 비-object → TypeError L119) 분기를 확인. 값 정합 위반 RangeError 분기(L199~206)는 구조 검사 **통과 후** 재유도 뒤에 위치함을 확인. **광범위 read 금지 — 해당 함수 본문만.**
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 기존 구조 error-path 블록(L298~316 `구조 결손 — null/undefined → TypeError`, L318~405 `구성요소 type 위반 → TypeError`)은 `.toThrow(TypeError)` 만 assert 함을 확인. 기존 order-lock 블록(L580~599: 정합-경로 descriptor<commandArgs `invocationCallOrder` 부등식 + 각 1 call; L637~658: descriptor-throw fail-fast command-args `toHaveBeenCalledTimes(0)`; L661~ command-args throw 전파)은 유지하고 **새 describe 블록으로 구조-선행성만 추가**. spy target 모듈은 기존 블록의 namespace import `descriptorModule`(L30, `buildRealDataDailyStepDualLegRunReportIssueDescriptor`)·`commandArgsModule`(L26, `buildRealDataDailyStepDualLegRunReportIssueCommandArgs`) 을 재사용. 최상위 `afterEach` `jest.restoreAllMocks()`(L64~65) 가 신규 spyOn 격리를 보장함을 확인. 기존 정상 fixture(all-pass report 컴포저 산출 plan)를 재사용.
- `docs/tasks/T-1072-result-issue-outcome-report-from-output-struct-precedence.md` — 본 축 leg 7(패턴 precedent). 동일 패턴(구조 결손 → 재유도 delegate 0-call spy + 구조 vs 값 경계 대조)을 mirror 한다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `plan`/`report` 입력에서 가드가 void 반환하고, `buildRealDataDailyStepDualLegRunReportIssueDescriptor` → `buildRealDataDailyStepDualLegRunReportIssueCommandArgs` spy 가 `invocationCallOrder` 부등식 순서로 정확히 각 1회 호출됨을 재확인(기존 정합-경로 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`plan` null/undefined, `plan.descriptor` 비-object[null/배열/primitive 대표], `plan.commandArgs` 비-object[null/배열/primitive 대표])에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`buildRealDataDailyStepDualLegRunReportIssueDescriptor`·`buildRealDataDailyStepDualLegRunReportIssueCommandArgs` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 spy 로 못박는다.
- [ ] **flow/branch cover**: 구조 검사 분기(plan 객체 / descriptor 객체 / commandArgs 객체) 각각에 대해 위 "TypeError + 2 delegate 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음).
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 배열 · primitive[문자열/숫자 등]) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: descriptor.title drift)은 구조 검사를 통과해 재유도가 호출된 뒤 발생**함(즉 RangeError 경로에서는 descriptor/commandArgs spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, delegate 0-call) vs 값(RangeError, delegate 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` 값이 기존(1)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 분기 전량에 2 delegate 각각 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 daily-step-dual-leg run-report-issue-command-plan **1개** 만(leg 8). 나머지 적격 daily family 가드(구조 검사 + 1+ 재유도 위임 보유, 예: -publish-plan / -outcome-report-from-output / -gh-command-plan 3종 — 모두 pre-check 상 zerocall 1~3 로 미lock)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 정합-경로 `invocationCallOrder` 블록·기존 값-재유도 fail-fast(descriptor throw → command-args 0-call) 테스트·기존 구조 error-path TypeError 테스트의 삭제·재작성 — 유지하고 새 describe 로 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1072 defense-in-depth 패턴의 daily-step-dual-leg command-plan mirror). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 분기 2 delegate 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 9+) 본 leg 를 mirror 해 남은 적격 daily family 가드를 순차 leg 화. pre-check 실증(planner grep, 2026-07-17)으로 확인된 미lock 적격 가드 3종: `daily-step-dual-leg-run-report-issue-publish-plan-consistency`(delegates=2, zerocall=1), `daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency`(delegates=2, zerocall=1), `daily-step-dual-leg-run-report-issue-gh-command-plan-consistency`(delegates=3, zerocall=3). 적격 grep: 각 guard 의 구조검사(assert*Structure/TypeError)가 재유도(build*/parse*/resolve*)보다 앞서고, spec 의 구조 error-path 테스트에 재유도 위임 `toHaveBeenCalledTimes(0)` assert 부재면 적격. daily-step-dual-leg 계열 mirror 소진 후 result-issue-\* + daily 양 family 전량 구조-선행성 lock 완료.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
