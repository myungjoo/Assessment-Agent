---
id: T-1054
title: result-report-plan consistency-guard(assertRealDataResultReportPlanConsistentWithInputs)의 2 distinct builder 재유도 순서(summary → descriptor, 데이터-의존) invocationCallOrder 순서-lock test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 115
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts
independentStream: realdata-e2e-result-report-plan-consistency
plannerNote: "P5 test-hardening — step-args aggregator(T-1053) 후속. T-1053 Follow-up 지목한 두 sub-composer(evaluation-step-args·result-publish-step-args) 감사 결과 둘 다 single-builder+self-wire guard 라 order-lock 불요 확정(builder→guard 는 구조적 순서 implied). 신규 인벤토리 감사로 consistency-guard 재유도 층 채택 — assertRealDataResultReportPlanConsistentWithInputs 는 buildRealDataResultSummary → buildRealDataResultIssueDescriptor 를 데이터-의존(descriptor 가 summary 산출 소비) 순차 재호출하나 spec invocationCallOrder 0(실 gap). T-1052 데이터-의존 chain 을 guard 재유도 층으로 mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1054 — result-report-plan consistency-guard 재유도 2 builder 순서(summary → descriptor) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. guard self-wire 순서-lock 6 축(T-1033~T-1041), result-summary 패밀리(T-1042/T-1043), from-output(T-1044), command-plan(T-1045/T-1046), gh-command-plan(T-1047/T-1048), publish-plan(T-1049/T-1050), descriptor(T-1051), evaluation-plan(T-1052), step-args aggregator(T-1053)이 완료됐다.

**T-1053 Follow-up 이 지목한 두 sub-composer 를 신규 감사했다 — 둘 다 order-lock 불요 확정**:

- `buildRealDataEvaluationStepArgs`(`realdata-e2e-evaluation-step-args.ts` L96~124): 본문은 (1) `buildRealDataEvaluationPlan(activities, runPlan.pipeline.modelId)`(L103, **단일 builder**) → (2) `assertRealDataEvaluationStepArgsConsistentWithSources(plan, ...)`(L117, self-wire guard, 산출 `plan` 을 인자로 받음)만 순차 호출한다. 2 distinct **builder** chain 부재 — builder→guard 는 guard 가 builder 산출을 입력으로 받아 **구조적으로 순서가 implied**(guard 호출 전 plan 이 이미 존재해야 함). spec `invocationCallOrder` = 0(pre-check 확인). → order-lock 불요.
- `buildRealDataResultPublishStepArgs`(`realdata-e2e-result-publish-step-args.ts` L113~135): 동형 — (1) `buildRealDataResultIssuePublishPlan(results, runPlan.run)`(L120, **단일 builder**) → (2) `assertRealDataResultPublishStepArgsConsistentWithSources(plan, ...)`(L128, self-wire guard). 2 distinct builder chain 부재, 구조적 순서 implied. spec `invocationCallOrder` = 0. → order-lock 불요.

따라서 T-1053 Follow-up 축은 두 leg 모두 "single-builder + self-wire guard → 구조적 순서 implied → order-lock 불요"로 종결한다(orchestrator 3종 T-1052 감사·seed/collect T-1053 감사와 동형 결론). 본 task 는 이 확정을 기록하고 **신규 인벤토리 감사로 다음 실 gap 을 채택**한다.

**신규 채택 gap — consistency-guard 재유도 층**: 전 helper 인벤토리를 훑어 2 distinct builder 를 순차 호출하나 spec 이 상대 순서를 못박지 않은(grep `invocationCallOrder` = 0) 미개척 층을 찾았다 — self-wire **consistency guard 의 single-source 재유도**다. 이 중 최고가치는 `realdata-e2e-result-report-plan-consistency.ts` 의 `assertRealDataResultReportPlanConsistentWithInputs`(L221~266)로, 재유도 단계(L238~242)가 **데이터-의존 2 builder chain** 이다:

- L238: `const expectedSummary = buildRealDataResultSummary(results)`
- L239~242: `const expectedDescriptor = buildRealDataResultIssueDescriptor(expectedSummary, run)` — **descriptor 가 앞 summary 재유도 산출 `expectedSummary` 를 첫 인자로 소비**한다.

즉 두 builder 는 상호 독립이 아니라 `summary → descriptor` **데이터-의존**이다(T-1053 aggregator 의 상호-독립 두 builder 와 달리, T-1052 evaluation-plan 의 `inputs → scoring` 데이터-의존 chain 과 동형). descriptor 재유도는 반드시 summary 재유도 **이후**에 평가돼야 하고, summary 재유도가 throw 하면 descriptor 는 미도달한다(fail-fast). 현행 spec(`realdata-e2e-result-report-plan-consistency.spec.ts`)은 구조 결손 TypeError·재유도 deep-equal 정합·fail-fast 순서(구조 → 재유도 → deep equal)는 검증하나(L67~) 재유도 **두 builder(summary → descriptor)의 상대 호출 순서와 descriptor 의 summary-산출 소비(데이터-의존)는 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인), 두 builder module namespace 를 spyOn 하는 지점 부재. 따라서 guard 재유도 본문에서 실수로 두 재유도를 재정렬하거나 descriptor 가 `expectedSummary` 대신 다른 summary 를 소비하도록 배선이 바뀌어도(deep-equal 은 순서 무관이라 통과) 데이터-의존 계약이 조용히 깨진다. production 무변경, test-only 1파일로 이 gap 을 봉한다.

## Required Reading

- `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**. 현행 import(L29~33)는 `buildRealDataResultReportPlan` 을 named import, `assertRealDataResultReportPlanConsistentWithInputs` 를 named import 로 보유한다. **`jest.spyOn` 을 위해 두 builder 위임의 module namespace import 를 신규 추가**해야 한다: `import * as resultSummaryModule from "./realdata-e2e-result-summary"`(export `buildRealDataResultSummary`) · `import * as resultIssueDescriptorModule from "./realdata-e2e-result-issue-descriptor"`(export `buildRealDataResultIssueDescriptor`) — spyOn 은 namespace 객체 프로퍼티(`resultSummaryModule.buildRealDataResultSummary` · `resultIssueDescriptorModule.buildRealDataResultIssueDescriptor`)에 건다(선례: T-1046/T-1052 의 named-import 컴포저에 spec 이 namespace import 추가해 spyOn — ts-jest 가 ESM named import 를 module 객체 프로퍼티 접근으로 컴파일하므로 소비 측 호출이 spy 를 통과). 기존 fixture `makeResult()`(L36)·`makeRun()`(L49)·`buildConsistent(results, run)`(L61, 정합 plan 합성)을 재유도 트리거 입력으로 재사용. 기존 "flow / branch — fail-fast 순서(구조 → 재유도 → deep equal)" describe(L251~, `makeRun({ gitSha: "" })` 로 descriptor 재유도 throw 전파 L275)를 negative 선례로 삼되 spyOn 대상만 두 builder module 로 바꾼다. `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- `test/helpers/realdata-e2e-result-report-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataResultReportPlanConsistentWithInputs` L221~266: (1) 구조 guard 5개(L229~233) → (2) 재유도 `const expectedSummary = buildRealDataResultSummary(results)`(L238) → `const expectedDescriptor = buildRealDataResultIssueDescriptor(expectedSummary, run)`(L239~242, **expectedSummary 소비 — 데이터-의존**) → (3) summary deep-equal(L246) → (4) descriptor deep-equal(L259). ⚠️ (2)의 descriptor 재유도는 summary 재유도 산출에 **데이터-의존**한다(첫 인자 `expectedSummary`) — 순서-lock 은 이 `summary → descriptor` 평가 순서 + descriptor 의 summary-산출 소비(reference 페어링) + fail-fast(summary throw → descriptor 미도달)를 못박는 defense-in-depth 다.
- `test/helpers/realdata-e2e-evaluation-plan.spec.ts`(T-1052 산물) — 데이터-의존 2-delegate 순서-lock 의 pass-through `jest.spyOn` + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 둘째 위임이 첫째 산출을 인자로 받음(reference 페어링 assert) + fail-fast(첫 위임 throw → 둘째 0회) 구조 선례. 본 task 를 이 축으로 mirror(단, 대상은 컴포저가 아니라 consistency guard 재유도).

## Acceptance Criteria

- [ ] **재유도 순서-lock test 추가 (happy-path/flow)**: guard 재유도 두 builder 순서를 못박는 test 1개 추가 — summary 위임(`resultSummaryModule.buildRealDataResultSummary`)·descriptor 위임(`resultIssueDescriptorModule.buildRealDataResultIssueDescriptor`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, `buildConsistent([makeResult()], makeRun())` 로 정합 plan 을 만든 뒤 `assertRealDataResultReportPlanConsistentWithInputs(plan, [makeResult()], makeRun())`(재유도 트리거)을 1회 호출한 뒤 `summarySpy.mock.invocationCallOrder[0] < descriptorSpy.mock.invocationCallOrder[0]` 부등식(summary → descriptor 순서)을 `toBeLessThan` 으로 검증. 추가로 두 위임이 각 `toHaveBeenCalledTimes(1)` 이고 **descriptor 위임의 첫 인자가 summary 위임의 반환값과 동일 reference**(`descriptorSpy.mock.calls[0][0] === summarySpy.mock.results[0].value` — 데이터-의존 못박기)임을 assert. `afterEach(jest.restoreAllMocks)` 로 spy 격리.
- [ ] **error path/negative 보강 (fail-fast + 데이터-의존 throw 전파)**: 두 negative case 추가 —
  (a) **fail-fast 순서(summary 재유도 throw → descriptor 미도달)**: `summarySpy.mockImplementation(() => { throw new Error("summary-boom"); })` 로 첫 위임을 throw 시키고 guard 호출 시 그 에러가 선전파(`toThrow(/summary-boom/)`)하며 **descriptor 위임이 `toHaveBeenCalledTimes(0)`**(summary 먼저 순서로 인해 descriptor 미도달)임을 검증. 순서-lock 의 fail-fast 방향 못박기.
  (b) **후속-위임 throw 전파(descriptor 재유도 throw → summary 이미 호출)**: pass-through spy 상태로 `assertRealDataResultReportPlanConsistentWithInputs(buildConsistent([makeResult()], makeRun()), [makeResult()], makeRun({ gitSha: "   " }))`(공백-only gitSha) 호출 시 descriptor 재유도 하위 `assertNonBlank` guard 가 throw 해 guard 가 그 에러를 전파(`toThrow`)하고, 이때 **summary 위임은 이미 호출됨**(`summarySpy` `toHaveBeenCalledTimes(1)` — 순서 상 summary 가 descriptor 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증. 단일 negative 로 부족하지 않도록 (a)(b) 두 분기 각각 cover(기존 L275 fail-fast 선례와 정합).
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/results/run mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-report-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -n "resultSummaryModule\|resultIssueDescriptorModule" test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` 가 1건 이상(이전 0건) — 두 builder 위임의 namespace spyOn 실배선 확인. `git grep -c invocationCallOrder test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` 가 0 → ≥1.

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(summary → descriptor)를 lock 만 하고 바꾸지 않는다.
- `buildRealDataResultSummary` / `buildRealDataResultIssueDescriptor` 위임 helper 로직·인자·guard 정책 변경.
- result-report-plan **컴포저**(`realdata-e2e-result-report-plan.ts`)의 self-wire 두 guard 호출 순서(BodyConsistent → ConsistentWithInputs) — 이미 T-1043 이 lock(본 task 는 `assertRealDataResultReportPlanConsistentWithInputs` **내부**의 두 builder 재유도만, 다른 층·다른 delegate).
- evaluation-step-args / result-publish-step-args sub-composer 순서-lock — 감사 결과 single-builder + self-wire guard 라 2 distinct builder chain 부재(구조적 순서 implied). 본 task 대상 아님(Why 에 확정 기록).
- 여타 consistency guard(step-args-consistency / evaluation-plan-consistency / command-plan-consistency / publish-plan-consistency 등)의 재유도 순서-lock — 상호-독립 재유도(데이터-의존 부재)라 우선순위 낮음. 후속 Follow-up 감사 대상.
- evaluation-plan / publish-plan / command-plan / gh-command-plan / descriptor / from-output / step-args aggregator 순서-lock — 이미 T-1044~T-1053 이 cover.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) consistency-guard 재유도 순서-lock(본 task) 완결 후 다음 sweep 확장 지점은 나머지 consistency guard 의 재유도 delegate 순서를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + 데이터-의존 여부)로 판정. 데이터-의존 chain(둘째 builder 가 첫째 산출 소비)을 가진 guard 를 우선, 상호-독립 재유도는 defense-in-depth 가치가 낮으므로 후순위 또는 "order-lock 불요(상호-독립, deep-equal 이 이미 순서-무관 정합 보장)" 확정 기록.

---

## Status: DONE (2026-07-16T22:10:00Z)

PR #948 merged (squash e012c4cb). reviewer round1 APPROVE, 4-게이트 PASS. test-only 1파일 test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts (+142/-0, 기존 spec 확장 4 test), production src 0 LOC. 대상 suite 37 pass(신규 4), 전체 404 suites/11051 tests green, coverageThreshold line≥80 AND function≥80 무회귀. happy-path 순서-lock(summary<descriptor invocationCallOrder 부등식·데이터-의존 reference) + fail-fast negative + guard-throw negative + branch/무공유 재확인. Follow-up: T-1055 (evaluation-plan consistency-guard 재유도 순서-lock).
