---
id: T-1070
title: realdata-e2e step-args(aggregator) consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 분기가 값 재유도(evaluation/publish sub-composer build 위임)보다 먼저 수행됨을 build-delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 5, T-1065 §D 후보 a)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-step-args-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 5 — T-1069(result-issue-publish-plan) mirror. pre-check: step-args aggregator 가드가 구조검사(assertStepArgsStructure→assertRunPlanStructure, 6분기 line 202-203)를 값 재유도(buildRealDataEvaluationStepArgs line 210→buildRealDataResultPublishStepArgs line 214)보다 먼저 수행하나, spec(ico=8)의 유일 toHaveBeenCalledTimes(0)(line 725, T-1064 재유도 순서-lock 블록)은 값-재유도 fail-fast(evaluation throw→publish 0)만 lock, 구조 error-path(line 355 구조 결손·413 구성요소 type 위반)는 TypeError throw 만 assert·build 0-call 미검증. 구조 결손 6분기서 두 build spy 0-call 로 선행성 못박음. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1070 — step-args(aggregator) 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e delegate 재유도/self-wire 순서-lock sweep(legs T-1054~T-1064)은 T-1065 완료 audit 으로 소진 확정됐고, 그 §D 후보 (a) **구조-guard 선행성 order-lock** 축이 T-1066(result-report-plan, leg 1) → T-1067(evaluation-plan, leg 2) → T-1068(result-issue-command-plan, leg 3) → T-1069(result-issue-publish-plan, leg 4)로 이어졌다. 본 task 는 그 새 축의 **leg 5** 로, 가드 `assertRealDataE2eStepArgsConsistentWithSources`(`test/helpers/realdata-e2e-step-args-consistency.ts`)를 mirror 대상으로 삼는다(precedent-traceable — T-1069 Follow-up ① 의 후보 step-args). 이 가드는 aggregator-seam 무결성 조각이라 검증 대상이 단일 plan 이 아니라 `{ evaluation, publish }` 컨테이너 2 구성요소이고 재유도 source 가 두 sub-composer 호출인 점이 특징이다.

planner pre-check 로 확인한 gap: 이 가드는 본문에서 구조 검사(`assertStepArgsStructure`(stepArgs null/undefined · stepArgs.evaluation 비-object · stepArgs.publish 비-object) → `assertRunPlanStructure`(runPlan null/undefined · runPlan.pipeline 비-object · runPlan.run 비-object))를 값 재유도 위임(`buildRealDataEvaluationStepArgs` → `buildRealDataResultPublishStepArgs`)보다 **먼저** 수행한다(가드 본문 구조검사 line 202~203 < 첫 `buildRealData` 위임 line 210). 그러나 대응 spec(현 `invocationCallOrder`=8)의 유일한 `toHaveBeenCalledTimes(0)`(line 725, 기존 `T-1064 — 재유도 위임 순서-lock` 블록)은 **값-재유도 fail-fast**(evaluation 위임 throw → publish 위임 0-call)만 못박고, 구조 error-path 테스트들(line 355~412 `구조 결손 — null/undefined → TypeError` + line 413~493 `구성요소 type 위반 → TypeError`: stepArgs null/undefined, runPlan null/undefined, evaluation 비-object, publish 비-object, runPlan.pipeline 비-object, runPlan.run 비-object)은 오직 `.toThrow(...)`(TypeError) 만 assert 하며 **구조 위반 시 build 위임이 아예 호출되지 않는(선행 fail-fast) 선행성** 은 검증하지 않는다. 구조 결손 입력을 주면 `buildRealDataEvaluationStepArgs` spy·`buildRealDataResultPublishStepArgs` spy 가 모두 `toHaveBeenCalledTimes(0)` 이어야 하며, 이를 spy 로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 build 를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1069 와 동형 defense-in-depth). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-step-args-consistency.ts` — 대상 가드. `assertRealDataE2eStepArgsConsistentWithSources` 본문(line 194~)의 구조 검사(`assertStepArgsStructure`(line 202)/`assertRunPlanStructure`(line 203))가 값 재유도 위임(`buildRealDataEvaluationStepArgs`(line 210)·`buildRealDataResultPublishStepArgs`(line 214))보다 앞서 위치함을 확인(구조 검사 라인 < 첫 `buildRealData` 라인). `assertStepArgsStructure`(line 87~105)·`assertRunPlanStructure`(line 113~131)의 분기 3+3=6개를 확인. **광범위 read 금지 — 해당 함수 본문만.**
- `test/helpers/realdata-e2e-step-args-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 기존 구조 error-path 블록(line 355~412 `구조 결손 — null/undefined → TypeError` + line 413~493 `구성요소 type 위반 → TypeError`)은 `.toThrow(...)` 만 assert 함을 확인. 기존 `T-1064 — 재유도 위임 순서-lock` 블록(line 645~: evaluation<publish `invocationCallOrder` + evaluation-throw fail-fast, `toHaveBeenCalledTimes(0)` line 725)은 유지하고 **새 describe 블록으로 구조-선행성만 추가**. spy target 모듈은 기존 블록의 `evaluationStepArgsModule`(`buildRealDataEvaluationStepArgs`)·`publishStepArgsModule`(`buildRealDataResultPublishStepArgs`) 을 재사용. 최상위 `afterEach` mock 복원(line 135~) 이 신규 spyOn 격리를 보장함을 확인.
- `docs/tasks/T-1069-publish-plan-struct-precedence.md` — 본 축 leg 4(패턴 precedent). 동일 패턴(구조 결손 → 두 build 위임 0-call spy + 구조 vs 값 경계 대조)을 mirror 한다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `stepArgs`/`runPlan`/`activities`/`results` 입력에서 가드가 void 반환하고, `buildRealDataEvaluationStepArgs` spy 가 `buildRealDataResultPublishStepArgs` spy 보다 먼저(`invocationCallOrder` 부등식) 정확히 각 1회 호출됨을 재확인(기존 T-1064 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`stepArgs`=null/undefined, `runPlan`=null/undefined, `stepArgs.evaluation` 비-object, `stepArgs.publish` 비-object, `runPlan.pipeline` 비-object, `runPlan.run` 비-object)에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`buildRealDataEvaluationStepArgs` spy·`buildRealDataResultPublishStepArgs` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 spy 로 못박는다.
- [ ] **flow/branch cover**: 구조 검사 6분기(stepArgs 존재 / stepArgs.evaluation object / stepArgs.publish object / runPlan 존재 / runPlan.pipeline object / runPlan.run object) 각각에 대해 위 "TypeError + build 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음).
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 비-object mismatch — 원시값/배열/null 대표) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: evaluation/publish drift)은 구조 검사를 통과해 build 위임이 호출된 뒤 발생**함(즉 RangeError 경로에서는 evaluation build spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, build 0-call) vs 값(RangeError, build 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c invocationCallOrder test/helpers/realdata-e2e-step-args-consistency.spec.ts` 값이 기존(8) 이상으로 유지되고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 6분기 전량 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 step-args **1개** 만(새 축 leg 5). 나머지 적격 가드(구조 검사 + 2+ build 위임 보유)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 `T-1064` 값-재유도 `invocationCallOrder` 블록·기존 구조 error-path TypeError 테스트의 삭제·재작성 — 유지하고 새 describe 로 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1069 defense-in-depth 패턴의 step-args mirror). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 6분기 build 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 6+) 본 leg 를 mirror 해 구조 검사 + 2+ build 위임을 보유한 다른 적격 가드(예: result-issue-gh-command-plan / daily-step-dual-leg-run-report-issue-command-plan 등 T-1065 섹션 A 표의 값-재유도 order-locked 11종 중 구조-선행성 미lock 인 것)를 pre-check 로 재판정 후 순차 leg 화. 적격 grep: 각 spec 의 구조 결손 error-path 테스트에 build 위임 `toHaveBeenCalledTimes(0)` assert 부재면 적격. 주의: daily-step-dual-leg-run-report-issue-command-plan 은 이미 구조 위반 1분기(descriptor null → descriptor spy `not.toHaveBeenCalled()`)를 부분 lock 하므로, 그 leg 는 잔여 5분기 + 두 번째 build spy(commandArgs) 완결로 축소된다.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
