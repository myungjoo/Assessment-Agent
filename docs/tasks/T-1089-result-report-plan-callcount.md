---
id: T-1089
title: realdata-e2e result-report-plan consistency 재유도 delegate call-count exactly-N 완결성 — 값-drift RangeError 대조 test 2건의 loose toHaveBeenCalled() 을 정확 횟수(buildRealDataResultSummary / buildRealDataResultIssueDescriptor 각 exactly-1)로 못박아 중복 재유도 회귀 차단 (call-count 완결성 sweep leg 24 = §D 후보 (b) 첫 전환, imported-delegate 구조-선행성 축 소진 후)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-07-18
completed: 2026-07-17T17:40:00Z
mergedAs: 47b2f3ef
prNumber: 982
reviewRounds: 1
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts
independentStream: realdata-e2e-callcount-completeness-sweep
plannerNote: "P5 call-count 완결성 sweep leg 24 = T-1065 §D 후보 (b) 첫 전환. pre-check 실증(grep+read, 2026-07-18, HEAD b17f3652=T-1088 머지 포함): imported-value-delegate 구조-선행성 축 소진 확인 — `grep 'from ../../src/' | grep -v 'import type' | (imported symbol 함수-호출)` 로 재유도 delegate 를 호출하면서 spec 에 toHaveBeenCalledTimes(0) 결손인 가드 0건(잔여 value import 는 상수 DIFFICULTIES/CONTRIBUTION_LEVELS 계열=delegate 아님, T-1088 Follow-up 예측 부합). §D 후보 (b) 전환 대상=result-report-plan 가드: 재유도 2-delegate(buildRealDataResultSummary→./realdata-e2e-result-summary L86, buildRealDataResultIssueDescriptor→./realdata-e2e-result-issue-descriptor L84, 각 guard L238~239 재호출)이 spec 의 값-drift RangeError 대조 test 2건((대조 a) summary drift L842~, (대조 b) descriptor drift L869~)에서 loose `expect(summarySpy/descriptorSpy).toHaveBeenCalled()`(L865/866/890/891)만 assert — 정확 횟수 미lock 이라 중복 재유도(build 2회) 회귀 slip 가능. happy-path(L575/576·657/658·710/711)와 구조-error(L631/736/764/791/815/838/839)은 이미 exactly-1/exactly-0 완결 → 잔여 gap 은 이 4 loose 뿐. namespace import(L32/L38)+afterEach restoreAllMocks(L553/L688) 인프라 기존재. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b."
---

# T-1089 — result-report-plan consistency 재유도 delegate call-count exactly-N 완결성 (§D 후보 (b) 첫 전환)

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 descriptor-body 축·step-args 축·evaluation-inputs producer 축·github-collection-live producer 축(T-1088, leg 23)까지 소진했다. T-1088 Follow-up 이 지목한 대로, **imported value 재유도 delegate 를 호출하면서 재유도-앞 error-path 에 delegate 0-call spy 가 결손된 잔여 축을 grep 실증으로 재감사한 결과 적격 가드 0건**으로 확인됐다(잔여 value import 는 전부 상수 `DIFFICULTIES`/`CONTRIBUTION_LEVELS` 계열 — spy-able delegate 아님). 따라서 본 leg 24 는 T-1088 Follow-up 및 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 후보 **(b) call-count exactly-once 완결성 감사**로 전환하는 **첫 leg** 다.

전환 대상은 `realdata-e2e-result-report-plan-consistency` 가드(`assertRealDataResultReportPlanConsistentWithInputs`)다. 이 가드는 result 발행 chain(README.md 109행 result-report step / REQ-032·REQ-059)에서 주입된 `(results, run)` 으로 **동일 2-단계 sub-composer delegate 를 재호출**해 single-source 무결성을 대조한다: (1) `buildRealDataResultSummary(results)`(`./realdata-e2e-result-summary`, guard L238) → summary, (2) `buildRealDataResultIssueDescriptor(expectedSummary, run)`(`./realdata-e2e-result-issue-descriptor`, guard L239) → descriptor. 각 delegate 는 정합 경로에서 **정확히 1회** 재호출된다(단일 재유도).

planner pre-check(실 grep + read, 2026-07-18, HEAD b17f3652 = T-1088 머지 포함)로 확인한 gap: 이 spec(총 894줄)은 happy-path(L575/576·657/658·710/711)와 구조-error path(L631·736·764·791·815·838/839)에서 delegate 2개의 호출 횟수를 이미 `toHaveBeenCalledTimes(1)`(happy) / `toHaveBeenCalledTimes(0)`(구조 결손 → 재유도 前 throw) 으로 **exactly-N 완결**하나, **값-drift RangeError 대조 test 2건만 loose `toHaveBeenCalled()`** 로 남아있다:

- **(대조 a) summary drift → RangeError** (L842~867): `expect(summarySpy).toHaveBeenCalled()`(L865) + `expect(descriptorSpy).toHaveBeenCalled()`(L866) — loose.
- **(대조 b) descriptor drift → RangeError** (L869~892): `expect(summarySpy).toHaveBeenCalled()`(L890) + `expect(descriptorSpy).toHaveBeenCalled()`(L891) — loose.

loose `toHaveBeenCalled()` 는 호출 횟수 ≥ 1 만 보장하므로, 가드가 값 대조 과정에서 **동일 delegate 를 중복 재유도(build 2회)** 하는 회귀가 발생해도 이 두 test 가 잡지 못한다. 이를 각 delegate `toHaveBeenCalledTimes(1)`(단일 invocation → 단일 재유도) 으로 못박아 **중복 재유도 회귀를 차단**하고, 이 가드 spec 의 delegate call-count 완결성을 전량(happy·구조·값-drift 3범주) exactly-N 으로 완성한다. T-1066~T-1088 defense-in-depth 와 동형이되 축이 "0-call/N-call 선행성" 에서 "exactly-N 중복 방지 완결성" 으로 이동한 것이다. test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` — 수정 대상 spec(총 894줄, 신규 파일 아님). **값-drift RangeError 대조 describe 블록의 2 test 만 수정**한다: (대조 a) summary drift(L842~867)의 `summarySpy`/`descriptorSpy` loose 호출 assert(L865/866)와 (대조 b) descriptor drift(L869~892)의 loose assert(L890/891)를 각각 정확 횟수로 tighten. namespace import(`import * as resultSummaryModule from "./realdata-e2e-result-summary"` L38 / `import * as resultIssueDescriptorModule from "./realdata-e2e-result-issue-descriptor"` L32)와 각 describe 블록 자체 `afterEach(() => jest.restoreAllMocks())`(L553/L688) 인프라가 이미 존재함을 확인 — 신규 import·spy 인프라 신설 불요. happy-path 이미 `toHaveBeenCalledTimes(1)`(L575/576·657/658·710/711), 구조-error 이미 `toHaveBeenCalledTimes(0)`(L631·736·764·791·815·838/839) 임을 확인해 이 2건만 잔여 gap 임을 확인. **광범위 read 금지 — 값-drift 대조 describe 블록(L842~893) + 각 spy 선언(L821~828·L846~853·L873~880) + happy-path 블록(L560~580 참고) 만.**
- `test/helpers/realdata-e2e-result-report-plan-consistency.ts` — 대상 가드. 재유도가 **2-단계 단일 재호출**(`buildRealDataResultSummary(results)` L238 → 산출 summary 로 `buildRealDataResultIssueDescriptor(expectedSummary, run)` L239, 각 정확히 1회)임을 확인해 tighten 할 정확 횟수(단일 invocation 기준 각 1)를 결정. (대조 a) summary drift 에서도 descriptor delegate 가 호출됨(=값 대조 前 두 delegate 를 모두 재유도)을 코드로 확인 — summary 재유도(L238) → descriptor 재유도(L239) → 값 대조 순서라 summary drift 여도 descriptor build 는 이미 호출된 뒤 summary 값 비교에서 throw 인지, 혹은 그 반대인지 정확 횟수 판정에 반영. **광범위 read 금지 — 메인 함수 재유도 구간(L230~250) + 값 대조 throw 분기 만.**
- `docs/tasks/T-1088-github-collection-live-struct-precede.md` — 직전 leg 23(구조-선행성 축 마지막 leg, imported-delegate 축 소진 확정 근거). 본 leg 는 축을 §D 후보 (b) call-count 완결성으로 전환하는 첫 leg 이므로 패턴(spy·정확 횟수·값 vs 구조 경계)만 mirror 하되, **재유도-앞 0-call 을 신설하는 게 아니라 재유도-후 값-drift 경로의 loose call-count 를 exactly-N 으로 tighten** 하는 점이 차이다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 tighten 하는 call-count 완결성 assert 자체).

- [ ] **happy-path(정합 정상 흐름 재확인)**: 기존 happy-path test(정합 입력 → 가드 void 반환 + `summarySpy`/`descriptorSpy` 각 `toHaveBeenCalledTimes(1)`, L575/576 등)가 무회귀로 통과함을 확인. 본 leg 는 이 exactly-1 완결성을 값-drift 경로까지 확장하는 것이므로 happy-path 는 이미 완결 상태 유지.
- [ ] **error path — 값-drift RangeError 정확 횟수(핵심)**: (대조 a) summary drift → RangeError 및 (대조 b) descriptor drift → RangeError 두 test 에서 loose `expect(summarySpy/descriptorSpy).toHaveBeenCalled()`(L865/866/890/891)를 **정확 횟수 `toHaveBeenCalledTimes(<정확한 N>)`** 으로 tighten. 단일 invocation 기준 각 delegate 는 단일 재유도이므로 원칙상 **exactly-1** — 단 각 test 가 가드를 몇 회 invoke 하는지(현 코드는 각 1회 throw assert)와 가드 내부 재호출 횟수를 코드로 확인해 실제 정확 N 을 확정(summary drift 여도 descriptor delegate 재유도 여부 = guard L238~239 순서 반영). 중복 재유도(build ≥ 2회) 회귀가 발생하면 이 assert 가 fail 하도록 못박는다.
- [ ] **flow/branch cover**: summary-drift 분기와 descriptor-drift 분기 각각에서 2개 delegate 의 정확 호출 횟수를 분리 assert(4개 exact assertion). 구조-error(재유도 0-call, 기존 L838/839)와 값-drift(재유도 후 exactly-N)의 경계가 exactly-N 관점에서 명확히 대비됨을 유지.
- [ ] **negative cases 충분 cover**: 값-drift 2종(summary count drift·descriptor title 위장) 각각을 exact call-count 로 못박고, 구조-error(0-call, 기존)와의 대비를 comment 로 명확화. 추가로 **중복 재유도 회귀 방지 의도**(build 2회 호출 시 fail)를 각 test 의 describe/it 문자열 또는 comment 에 명시해 exactly-N 완결성의 negative-회귀 성격을 문서화. 단일 loose 로 묶지 않고 delegate·drift 조합별 분리 유지.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 assert tighten 만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c 'toHaveBeenCalled()' test/helpers/realdata-e2e-result-report-plan-consistency.spec.ts` 값이 기존(4)에서 **0** 으로 감소(모든 loose 제거)하고, 값-drift 대조 2 test 에 `toHaveBeenCalledTimes(<N>)` exact assert 가 `summarySpy`·`descriptorSpy` 각각 존재.
- [ ] **spy 격리 유지**: 값-drift 대조 describe 블록의 기존 `afterEach(() => jest.restoreAllMocks())`(L688)로 spy 복원 유지 — 신규 import·spy 인프라 신설 없이 기존 namespace import(L32/L38) 재사용. spy 는 실 구현 call-through(mockImplementation 미지정)로 둔다.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 변경(≤300 LOC diff / 1파일, 실제 ~4~20 LOC).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 call-count 완결성 tighten — 본 leg 는 result-report-plan **1개** 만(leg 24). 잔여 loose-call-count 가드(daily-step-collect/eval-command-plan, command-plan, publish-plan, evaluation-plan, result-issue-command-plan/publish-plan, seed-resolve-person-id 등)는 후속 leg 로(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(재유도 순서·에러 메시지 수정 등) — 코드 무변경, spec assert tighten 만.
- 구조-error path·happy-path 의 기존 exact assert 수정 — 이미 완결(0/1), 손대지 않음.
- 새 describe 블록·새 test 신설 — 기존 값-drift 대조 2 test 의 loose assert 를 exact 로 tighten 만(구조 확장 아님). 필요 시 중복-재유도 회귀 의도 comment 만 추가.
- imported-delegate 구조-선행성 축의 추가 leg — 해당 축은 grep 실증으로 소진 확정(적격 0건).
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1065 §D 후보 (b) 전환의 첫 leg, 기존 spy 인프라 재사용, 값-drift 대조 2 test 의 loose call-count 를 exactly-N 으로 tighten). tester 는 R-112 test 4종 + coverage 무회귀 + 값-drift 2 test 의 `summarySpy`/`descriptorSpy` 정확 호출 횟수(가드 코드로 실제 N 확정) tighten + 중복 재유도 회귀 방지 의도 검증 + happy/구조 기존 exact assert 무회귀 + grep(`toHaveBeenCalled()` = 0) 확인.

## Follow-ups

- (call-count 완결성 sweep leg 25+) 잔여 loose-call-count 가드 순차 tighten. 2026-07-18 pre-check 로 `grep -c 'toHaveBeenCalled()'` > 0 인 realdata-e2e consistency spec 확인: daily-step-collect-command-plan(1)·daily-step-eval-command-plan(1)·daily-step-dual-leg-run-report-issue-command-plan(2)·result-issue-publish-plan(4)·evaluation-plan(3)·result-issue-command-plan(4)·seed-resolve-person-id(2) 등. 각각 재유도-후 값-drift 경로의 loose `toHaveBeenCalled()` 를 exactly-N 으로 tighten 하는 leg 로 큐잉(가드별 정확 N 은 재유도 delegate 개수·invoke 횟수로 코드 확인). imported-delegate 구조-선행성 축은 소진 확정이라 §D 후보 (b) 완결성 축으로 sweep 계속.
- (leg N) call-count 완결성 축이 소진되면 T-1065 §D 후보 (c) e2e 흐름 커버리지 확장으로 전환(각 step seam 의 정합 chain 이 실제 e2e 흐름에서 호출됨을 커버).
