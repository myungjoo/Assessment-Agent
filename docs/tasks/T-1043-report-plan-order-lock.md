---
id: T-1043
title: result-report-plan 컴포저 self-wire 두 가드 호출 순서(BodyConsistent→ConsistentWithInputs)를 invocationCallOrder 순서-lock test 로 못박기 (result-summary 축 2번째)
phase: P5
status: DONE
mergedAs: b365c7fc
prNumber: 937
reviewRounds: 1
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 75
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan.spec.ts
independentStream: realdata-e2e-result-report-plan
plannerNote: "P5 test-hardening — result-summary 패밀리 2번째 축. T-1042 가 result-summary-line formatter order-lock 완료 후 sibling producer buildRealDataResultReportPlan 로 확장. L132 BodyConsistent→L150 ConsistentWithInputs 두 distinct 가드 self-wire 하나 spec invocationCallOrder 0건(실 gap 확인, T-0648/T-0700 블록은 공존만 assert 상대순서 미lock). pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1043 — result-report-plan 컴포저 self-wire 호출 순서(BodyConsistent→ConsistentWithInputs) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-assert 하는 2+ distinct 가드의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. result-issue/daily-issue 6 축(T-1033~T-1041)에 이어 result-summary 패밀리로 확장했고, 첫 축 `formatRealDataResultSummaryLine`(T-1042, PR #936 머지)이 완료됐다.

본 task 는 그 확장의 **두 번째(마지막) 축**이다. T-1042 감사에서 result-summary 패밀리 안 2-distinct-self-wire-가드 producer 로 지목된 나머지 하나가 sibling 컴포저 `buildRealDataResultReportPlan`(result-report-plan)이다. 이 컴포저는 반환 직전 두 distinct 가드를 순서대로 self-assert 한다 — L132 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)`(plan 내부 cross 정합 가드: descriptor.body ↔ summary 재유도 대조 / issue 패밀리 descriptor 가드 cross-axis 재사용) → L150 `assertRealDataResultReportPlanConsistentWithInputs(plan, results, run)`(plan↔inputs 재유도 가드: (results, run) 2 위임 재유도로 plan 전체 정합 대조) → L152 `return plan`.

그러나 spec `realdata-e2e-result-report-plan.spec.ts` 에는 **두 가드의 상대 호출 순서 lock 이 부재**하다(`git grep invocationCallOrder` 0건). 기존 두 self-wire 검증 블록(T-0648 body-consistency L285~, T-0700 consistency 가드 L491~)은 각 가드가 1회씩 호출됨(공존)·인자·throw 전파만 assert 할 뿐, 두 가드의 self-wire 순서가 실수로 뒤바뀌어도(예: ConsistentWithInputs 를 BodyConsistent 앞으로 이동) 현행 test 는 통과한다. 앞선 7 축 order-lock 선례(T-1033~T-1042)대로 순서 부등식을 못박는다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-report-plan.spec.ts` — 본 task 가 수정할 유일 파일(653줄). 두 self-wire describe 블록 확인: **T-0648 body-consistency self-wire 블록(L285~483)** + **T-0700 consistency 가드 self-wire 블록(L491~652)**. 두 블록은 각각 자기 가드 1개만 spy 하므로, 순서-lock test 는 **두 가드를 동시에 spy** 해야 한다. namespace import alias 는 이미 존재: `bodyConsistencyModule`(L22 = `./realdata-e2e-result-issue-descriptor-body-consistency`, export `assertRealDataResultIssueDescriptorBodyConsistent`), `reportPlanConsistency`(L24 = `./realdata-e2e-result-report-plan-consistency`, export `assertRealDataResultReportPlanConsistentWithInputs`). fixture helper `makeResult`(L29~)·`makeRun`(L42~) 재사용. 신규 순서-lock/fail-fast/input-guard-priority describe 블록을 T-0700 블록 끝(파일 최하단 top-level describe 닫힘 `});` 직전)에 append.
- `test/helpers/realdata-e2e-result-report-plan.ts` — producer self-wire 지점 확인용(수정 금지). `buildRealDataResultReportPlan` 함수: L117 `buildRealDataResultSummary(results)` → L122 `buildRealDataResultIssueDescriptor(summary, run)`(내부 `assertNonBlank` 가 run.gitSha/dateToken 빈/공백 시 여기서 throw — 두 self-wire 가드 도달 전) → L132 `assertRealDataResultIssueDescriptorBodyConsistent(descriptor, summary)`(첫 self-assert) → L150 `assertRealDataResultReportPlanConsistentWithInputs(plan, results, run)`(둘째 self-assert) → L152 `return plan`. ⚠️ 첫 가드는 issue 패밀리 descriptor 가드를 cross-axis 재사용(`bodyConsistencyModule`)하고, 둘째 가드는 report-plan 전용 모듈(`reportPlanConsistency`)이다 — spy 대상 모듈이 서로 다름에 주의.
- `test/helpers/realdata-e2e-result-summary-line.spec.ts` (T-1042 선례, PR #936) — 동일 순서-lock/fail-fast 패턴의 최근 mirror 참조. 두 가드를 실 구현 pass-through `jest.spyOn` 으로 감싸고 `shapeSpy.mock.invocationCallOrder[0]` 이 다른 spy 의 `invocationCallOrder[0]` 보다 작음을 `toBeLessThan` 으로 검증 + 첫 가드 throw → 둘째 가드 0회 fail-fast + 입력 guard 우선 분기(둘 다 0회) 3종 구조를 result-report-plan 심볼명(BodyConsistent 첫·ConsistentWithInputs 둘째)으로 동형 적용.

## Acceptance Criteria

- [ ] **순서-lock test 추가 (happy-path/flow)**: T-0700 consistency 가드 self-wire describe 블록 끝에 두 가드의 상대 호출 순서를 못박는 test 1개 추가 — 두 가드(`assertRealDataResultIssueDescriptorBodyConsistent` = `bodyConsistencyModule`, `assertRealDataResultReportPlanConsistentWithInputs` = `reportPlanConsistency`)를 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 `buildRealDataResultReportPlan` 을 정상 (results, run) 으로 1회 호출한 뒤 `bodyConsistentSpy.mock.invocationCallOrder[0]` 이 `consistentWithInputsSpy.mock.invocationCallOrder[0]` 보다 **작음(BodyConsistent 먼저)** 을 `toBeLessThan` 부등식으로 검증(둘 다 `toHaveBeenCalledTimes(1)`, 공존 검증 → 순서 lock 으로 강화).
- [ ] **fail-fast test 추가 (error path/negative)**: 첫 가드(BodyConsistent)가 throw 하면 둘째 가드(ConsistentWithInputs)가 **호출되지 않음(spy 0회)** 을 검증하는 test 1개 추가 — BodyConsistent 가드를 throw 하도록 mock 하고, `buildRealDataResultReportPlan` 호출이 그 에러를 선전파(fail-fast)하며 ConsistentWithInputs spy 가 `toHaveBeenCalledTimes(0)` 임을 assert.
- [ ] **branch/negative 보강**: 입력 guard 우선 분기 — run.gitSha 빈/공백 `run` 으로 L122 descriptor 단계(`assertNonBlank`)가 두 self-assert 가드 도달 전에 먼저 throw 하여 BodyConsistent spy·ConsistentWithInputs spy 가 **모두 미호출(각 `toHaveBeenCalledTimes(0)`)** 임을 검증하는 test 1개 추가(guard 순서 보존, self-wire 가 위임 입력 guard 우선순위를 깨지 않음을 못박음 — 기존 T-0648 블록은 BodyConsistent 가드 단독 0 만 assert 하므로 두 가드 동시 0 을 명시). 추가로 순서-lock test 는 실 구현 pass-through spy 이므로 산출 plan 이 순서-검증 전후 deep-equal(무공유·byte 동일)임을 함께 재확인(production 무변경 회귀 0). 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-report-plan.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-report-plan.spec.ts` 가 1건 이상(이전 0건) — 순서-lock 실배선 확인.

## Out of Scope

- producer `.ts` 의 self-wire 호출 순서 **재정렬 / 정규화** — 현행 순서(BodyConsistent → ConsistentWithInputs)를 lock 만 하고 바꾸지 않는다.
- body-consistency 가드 또는 report-plan-consistency 가드 로직·인자 순서·에러 정책 변경.
- 위임 helper(`buildRealDataResultSummary`, `buildRealDataResultIssueDescriptor`)의 로직·guard 변경.
- 다른 result-summary 패밀리 producer(result-summary, result-summary-markdown 등 — 단일 가드) 하드닝.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 결과) result-summary 패밀리의 2-distinct-self-wire-가드 producer 2개(result-summary-line T-1042, result-report-plan 본 task)가 모두 order-lock 완료되면 result-summary 패밀리 order-lock sweep 종료. 이후 축은 planner 가 신규 인벤토리 감사로 다음 2-가드 producer 패밀리(존재 시)를 지목.
