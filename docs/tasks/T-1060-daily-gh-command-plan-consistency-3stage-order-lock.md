---
id: T-1060
title: daily-step-dual-leg-run-report-issue-gh-command-plan consistency-guard(assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs)의 3 distinct builder 데이터-의존 재유도 순서(parse → resolveAction → buildGhArgv) invocationCallOrder 순서-lock + reference-페어링 test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 7)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 135
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts
independentStream: realdata-e2e-daily-step-dual-leg-gh-command-plan-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 7번째 leg (T-1054~T-1059 후속). T-1059 Follow-up 감사 결과 — gh-command-plan-consistency 가 3 distinct builder(parse L228→resolveAction L230→buildGhArgv L234) 데이터-의존 chain(2 order-edge) 재유도이나 spec invocationCallOrder=0. 최고가치 3-stage 패턴. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1060 — daily-step-dual-leg-run-report-issue-gh-command-plan consistency-guard 재유도 3 builder 순서(parse → resolveAction → buildGhArgv) invocationCallOrder 순서-lock + 데이터-의존 reference-페어링 test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. consistency-guard 재유도 leg 은 leg 1(T-1054, result-report-plan-consistency 의 summary → descriptor), leg 2(T-1055, evaluation-plan-consistency 의 inputs → scoring-call-args), leg 3(T-1056, result-issue-command-plan-consistency 의 report-plan → command-args), leg 4(T-1057, result-issue-publish-plan-consistency 의 command-plan → search-gh-argv), leg 5(T-1058, daily-step-dual-leg-command-plan-consistency 의 descriptor → command-args), leg 6(T-1059, daily-step-dual-leg-publish-plan-consistency 의 command-plan → search-gh-argv)가 완료됐다.

**T-1059 Follow-up 이 지목한 나머지 daily-step-dual-leg 계열 consistency guard 를 pre-check 감사(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정했다.** 후보 2종 중 `realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` 의 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs`(L211~245)가 **최고가치**로, 재유도 단계가 지금까지 sweep 이 다룬 2-builder 를 넘어선 **데이터-의존 chain 을 이룬 3 distinct builder** 다(각 뒤 builder 가 앞 builder 산출을 source 로 소비 — 2개의 order-edge 를 가진 최초의 3-stage leg):

- L228~229: `const expectedHits = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` — search-output 파서 재유도(builder ①, `stdout` → hits 배열)
- L230~233: `const expectedAction = resolveRealDataDailyStepDualLegRunReportIssueAction(expectedHits, commandArgs.searchQuery)` — action resolver 재유도(builder ②), **builder ① 산출 `expectedHits` 를 첫 인자로 소비**
- L234~237: `const expectedArgv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(expectedAction, commandArgs)` — gh-argv 빌더 재유도(builder ③), **builder ② 산출 `expectedAction` 을 첫 인자로 소비**

즉 세 builder 는 `parse → resolveAction → buildGhArgv` **순서에 의미가 있다**(2개의 데이터-의존 edge): builder ②가 builder ① 산출(`expectedHits`)을, builder ③이 builder ② 산출(`expectedAction`)을 각각 source 로 쓰므로 반드시 parse → resolveAction → buildGhArgv 순으로 완료돼야 한다. 이는 지금까지의 2-builder leg(T-1054~T-1059)를 잇는 **3-builder chain sibling** 으로, order-lock edge 2개 + reference-페어링 2개를 동시에 못박는 최고가치 패턴이다.

현행 spec(`realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts`, 813줄)은 happy-path void·구조 결손 TypeError·fail-fast 순서(구조 → 재유도 → 매핑 → argv)·negative 충분 cover·**위임 helper throw 전파(parse/resolveAction/buildGhArgv 각 layer 를 실 입력으로 throw 유발해 전파 확인)**·비변형/결정론은 이미 검증한다. 그러나 세 재유도 builder(parse → resolveAction → buildGhArgv)의 **정합-경로 상대 호출 순서(`invocationCallOrder` 부등식 2개)와 데이터-의존 방향(builder ②가 builder ① 산출을, builder ③이 builder ② 산출을 소비)은 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인). 따라서 guard 재유도 본문에서 실수로 세 재유도를 재정렬하거나 어느 builder 의 인자를 앞 builder 산출이 아닌 다른 값으로 바꿔도(deep-equal 은 순서-무관이라 최종 verdict 는 통과할 수 있는 경로) 검출되지 않는다. 현행 spec 은 아직 세 delegate 를 namespace 로 import 하지 않고(실 입력으로만 throw 유발) spyOn 배선이 없으므로, 세 delegate 의 namespace import + 정합-경로 순서-lock + reference-페어링 test 를 추가해 이 gap 을 봉한다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**. 현재 세 delegate 를 namespace 로 import 하지 **않으므로**(L28~33 은 command-args type · gh-command-plan · guard 자체만 import) **신규 namespace import 3줄 추가**가 필요하다:
  - `import * as searchParseModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse"` (프로퍼티 `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`)
  - `import * as actionModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-action"` (프로퍼티 `resolveRealDataDailyStepDualLegRunReportIssueAction`)
  - `import * as ghArgvModule from "./realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv"` (프로퍼티 `buildRealDataDailyStepDualLegRunReportIssueGhArgv`)

  세 namespace 프로퍼티에 `jest.spyOn` 을 건다. 기존 fixture(`makeCommandArgs` L43·`stdoutOf` L79·`buildConsistent` L93)로 정합 plan 을 만들어 재유도 트리거 입력으로 재사용. 최상위 `afterEach(jest.restoreAllMocks)` 존재 여부를 확인하고 없으면 최상위에 추가(spy 격리 필수 — 없으면 후속 test 오염). 기존 "위임 helper throw 전파" describe(L665~735)를 선례 위치로 삼되 그 안의 기존 throw-전파 test 는 **유지**하고, `parse → resolveAction → buildGhArgv` 정합-경로 순서-lock(2 edge) + reference-페어링(2개) + 후속-throw 순서 재확인 test 를 **신규 추가**한다(새 describe 블록 권장).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs` L211~245: (1) 구조 guard(L219~223 assertPlanStructure/…/assertCommandArgsStructure) → (2) `const expectedHits = parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`(L228~229, builder ①) → (3) `const expectedAction = resolveRealDataDailyStepDualLegRunReportIssueAction(expectedHits, commandArgs.searchQuery)`(L230~233, builder ② — builder ① 산출 expectedHits 소비) → (4) `const expectedArgv = buildRealDataDailyStepDualLegRunReportIssueGhArgv(expectedAction, commandArgs)`(L234~237, builder ③ — builder ② 산출 expectedAction 소비) → (5) action 분기/issueNumber/argv 길이·원소 deep-equal. ⚠️ 순서-lock 은 이 `parse → resolveAction → buildGhArgv` 재유도 순서(2 edge) + 데이터-의존(② 가 ① 산출 hits, ③ 이 ② 산출 action 을 각 첫 인자로 소비)을 못박는다. reference-페어링 assert 대상: `actionSpy.mock.calls[0][0]` === `parseSpy.mock.results[0].value`(builder ①은 hits 배열을 직접 반환), `ghArgvSpy.mock.calls[0][0]` === `actionSpy.mock.results[0].value`(builder ②는 action 객체를 직접 반환).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts`(T-1058 산물) 또는 `realdata-e2e-daily-step-dual-leg-run-report-issue-publish-plan-consistency.spec.ts`(T-1059 산물) — consistency-guard 재유도 데이터-의존 순서-lock 의 pass-through `jest.spyOn`(mockImplementation 없이 원 구현 통과) + `firstSpy.mock.invocationCallOrder[0] < secondSpy.mock.invocationCallOrder[0]` 부등식(`toBeLessThan`) + 둘째 위임 인자가 첫째 산출임을 확인하는 reference-페어링 assert + 후속 위임 throw → 앞 위임 1회(순서 재확인) 구조 선례. 본 task 는 이 2-builder 선례를 **3-builder chain(edge 2개·reference-페어링 2개)** 로 확장 적용.

## Acceptance Criteria

- [ ] **정합-경로 재유도 순서-lock test 추가 (happy-path/flow, 2 edge)**: guard 재유도 세 builder 순서를 못박는 test 1개 추가 — parse 위임(`searchParseModule.parseRealDataDailyStepDualLegRunReportIssueSearchOutput`)·resolveAction 위임(`actionModule.resolveRealDataDailyStepDualLegRunReportIssueAction`)·buildGhArgv 위임(`ghArgvModule.buildRealDataDailyStepDualLegRunReportIssueGhArgv`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, 정합 plan(`buildConsistent("[]", makeCommandArgs())`)·같은 `stdout`/`commandArgs` 로 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)`(재유도 트리거)을 1회 호출한 뒤 `parseSpy.mock.invocationCallOrder[0] < actionSpy.mock.invocationCallOrder[0]` **및** `actionSpy.mock.invocationCallOrder[0] < ghArgvSpy.mock.invocationCallOrder[0]` 두 부등식(edge 2개)을 각 `toBeLessThan` 으로 검증. 추가로 세 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회). ⚠️ plan 은 spy 설정 **전**에 `buildConsistent(...)` 로 미리 만든다(buildConsistent 자체가 컴포저 chain 을 돌려 세 delegate 를 호출하므로 spy 이후 생성 시 관측 오염 — 형제 leg 의 makePlan 주석 선례).
- [ ] **데이터-의존 reference-페어링 assert 추가 (flow, 2개)**: 위 순서-lock test 안에서(또는 별도 test 로) 두 데이터-의존 방향을 못박는다 —
  (i) resolveAction 위임이 parse 위임의 **반환값(hits 배열)을 첫 인자로 소비**: `actionSpy.mock.calls[0][0]` 이 `parseSpy.mock.results[0].value` 와 동일(`toBe` 참조 동등 또는 `toEqual` deep 동등)임을 검증.
  (ii) buildGhArgv 위임이 resolveAction 위임의 **반환값(action 객체)을 첫 인자로 소비**: `ghArgvSpy.mock.calls[0][0]` 이 `actionSpy.mock.results[0].value` 와 동일(`toBe` 또는 `toEqual`)임을 검증.
  builder ②/③ 의 첫 인자가 각 앞 builder 산출임을 못박아 3-stage 데이터-의존 chain 방향을 lock(T-1058/T-1059 reference-페어링 선례를 2 edge 로 확장).
- [ ] **error path/negative 보강 (fail-fast + 후속 위임 throw 순서 재확인)**: 다음 negative case 를 추가 —
  (a) **fail-fast 순서 edge 1(parse 재유도 throw → resolveAction·buildGhArgv 미도달)**: pass-through 대신 `parseSpy.mockImplementation(() => { throw new Error("parse-boom"); })` 로 첫 위임을 강제 throw 시키고, guard 호출이 그 에러를 전파(`toThrow(/parse-boom/)`)하며 `actionSpy` `toHaveBeenCalledTimes(0)` **및** `ghArgvSpy` `toHaveBeenCalledTimes(0)` 임을 검증(첫 stage throw → 뒤 두 stage 미도달).
  (b) **fail-fast 순서 edge 2(resolveAction 재유도 throw → parse 이미 1회·buildGhArgv 미도달)**: pass-through `parseSpy` 유지 + `actionSpy.mockImplementation(() => { throw new Error("action-boom"); })` 로 둘째 위임을 throw 시키고, guard 호출이 그 에러를 전파(`toThrow(/action-boom/)`)하며 `parseSpy` `toHaveBeenCalledTimes(1)`(앞 stage 는 이미 호출됨) **및** `ghArgvSpy` `toHaveBeenCalledTimes(0)`(뒤 stage 미도달)임을 검증.
  (c) **후속-위임 throw 순서 재확인(buildGhArgv 재유도 throw → parse·resolveAction 이미 각 1회 호출)**: pass-through `parseSpy`·`actionSpy` 유지 + `ghArgvSpy.mockImplementation(() => { throw new Error("ghargv-boom"); })` 로 셋째 위임을 throw 시키고(정합 입력으로 앞 두 재유도는 통과), guard 호출이 그 에러를 전파(`toThrow(/ghargv-boom/)`)하며 `parseSpy` `toHaveBeenCalledTimes(1)` **및** `actionSpy` `toHaveBeenCalledTimes(1)`(순서 상 두 앞 stage 가 buildGhArgv 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증.
  단일 negative 로 부족하지 않도록 (a)(b)(c) 세 분기 각각 cover(2 edge 의 fail-fast 방향 + 종단 throw 순서 재확인).
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/stdout/commandArgs mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -c invocationCallOrder test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` 가 0 → ≥2(2 edge 정합-경로 순서-lock 부등식 실배선 확인).

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(parse → resolveAction → buildGhArgv)를 lock 만 하고 바꾸지 않는다.
- `parseRealDataDailyStepDualLegRunReportIssueSearchOutput` / `resolveRealDataDailyStepDualLegRunReportIssueAction` / `buildRealDataDailyStepDualLegRunReportIssueGhArgv` 위임 helper 로직·인자·guard 정책 변경.
- gh-command-plan **컴포저**(`realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts`, `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`)의 위임 순서 — 본 task 는 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs` **내부**의 세 builder 재유도만, 다른 층·다른 delegate.
- result-report-plan / evaluation-plan / result-issue-command-plan / result-issue-publish-plan / daily-step-dual-leg-command-plan / daily-step-dual-leg-publish-plan 재유도 — 이미 T-1054~T-1059 이 cover(본 task 는 sibling consistency-guard leg 7, daily-leg gh-command-plan 3-stage 변형).
- `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts`(parse-output → outcome-report 2-stage) 순서-lock — 본 감사에서 후순위(2-stage). 후속 Follow-up 감사 대상.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속) 본 task(daily-step-dual-leg gh-command-plan-consistency 3-stage 재유도 순서-lock) 완결 후 나머지 daily-step-dual-leg 계열 consistency guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. 남은 2+ distinct builder 데이터-의존 chain 후보: `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency.ts`(parse-output → outcome-report 2-stage, spec invocationCallOrder=0 확인) 등을 각 guard 본문의 재유도 데이터-의존 여부로 우선순위 재판정. 단일 builder 재유도·게이트 없는 상호-독립 병렬 재유도는 "order-lock 불요" 확정 기록.
