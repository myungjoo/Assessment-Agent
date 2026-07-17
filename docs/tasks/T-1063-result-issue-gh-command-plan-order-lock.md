---
id: T-1063
title: result-issue-gh-command-plan consistency-guard(assertRealDataResultIssueGhCommandPlanConsistentWithInputs)의 3 distinct builder 데이터-의존 재유도 순서(parse → resolveAction → buildGhArgv) invocationCallOrder 순서-lock + reference-페어링 test 로 못박기 (consistency-guard 재유도 delegate 순서-lock leg 10)
phase: P5
status: DONE
completedAt: 2026-07-17T03:08:30Z
mergedAs: 4dbb279b
prNumber: 957
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 135
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts
independentStream: realdata-e2e-result-issue-gh-command-plan-consistency
plannerNote: "P5 test-hardening — consistency-guard 재유도 순서-lock sweep 10번째 leg (T-1054~T-1062 후속). daily-step-dual-leg 계열은 leg 9(T-1062)가 소진 확정. T-1062 Follow-up 이 leg 10 유력 후보로 지목한 result-issue-gh-command-plan-consistency 감사·적격 확인 — assertRealDataResultIssueGhCommandPlanConsistentWithInputs(L207~273)이 3 distinct builder(parse L224 → resolveAction L225 → buildGhArgv L229) 데이터-의존 3-stage(2 edge) 재유도이나 spec invocationCallOrder=0. T-1060 daily-leg gh-command-plan 3-stage 의 result-issue mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1063 — result-issue-gh-command-plan consistency-guard 재유도 3 builder 순서(parse → resolveAction → buildGhArgv) invocationCallOrder 순서-lock + 데이터-의존 reference-페어링 test 추가

## Why

P5 test-hardening sweep 은 producer / 컴포저 / consistency-guard 가 자기 산출·재유도 경로에서 순차 호출하는 2+ distinct 위임(delegate)의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. consistency-guard 재유도 leg 은 leg 1(T-1054, result-report-plan-consistency 의 summary → descriptor), leg 2(T-1055, evaluation-plan-consistency 의 inputs → scoring-call-args), leg 3(T-1056, result-issue-command-plan-consistency 의 report-plan → command-args), leg 4(T-1057, result-issue-publish-plan-consistency 의 command-plan → search-gh-argv), leg 5(T-1058, daily-step-dual-leg-command-plan-consistency 의 descriptor → command-args), leg 6(T-1059, daily-step-dual-leg-publish-plan-consistency 의 command-plan → search-gh-argv), leg 7(T-1060, daily-step-dual-leg-gh-command-plan-consistency 의 parse → resolveAction → buildGhArgv 3-stage), leg 8(T-1061, daily-step-dual-leg-run-report-issue-outcome-report-from-output-consistency 의 parse → buildOutcomeReport 2-stage), leg 9(T-1062, result-issue-outcome-report-from-output-consistency 의 parse → buildOutcomeReport 2-stage)가 완료됐다.

**daily-step-dual-leg 계열의 delegate 기반 consistency guard 는 leg 9(T-1062)에서 소진 확정됐다** — command-plan / publish-plan / gh-command-plan / outcome-report-from-output 은 leg 5~8 이 순서-lock 을 배선(각 spec `invocationCallOrder` ≥ 7)했고, 나머지 0-count daily-leg consistency spec(action / command-args / descriptor-body / descriptor-identity / gh-argv / outcome-report-output / outcome-report-summary-line / output-parse / search-argv / search-parse)은 guard 본문이 **inline 독립 재유도**(`reDeriveExpected*` / `composeExpected*` — 위임 빌더 **재호출 0**)라 pre-check 조건 "2+ distinct delegate builder 데이터-의존 chain" 을 충족하지 못한다.

따라서 leg 10 은 broader realdata-e2e 스위트에서 next-best consistency-guard leg 로 확장한다. T-1062 Follow-up 이 지목한 유력 후보 `realdata-e2e-result-issue-gh-command-plan-consistency.ts` 를 pre-check 감사(spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정해 **적격 확인**했다. `assertRealDataResultIssueGhCommandPlanConsistentWithInputs`(L207~273)의 재유도가 **데이터-의존 chain 을 이룬 3 distinct builder**(뒤 builder 가 앞 builder 산출을 첫 인자로 소비 — 2개의 order-edge, T-1060 형제 패턴)다:

- L224: `const expectedHits = parseRealDataResultIssueSearchOutput(stdout)` — search stdout 파서 재유도(builder ①, `stdout` → hits). 먼저 평가된다.
- L225~228: `const expectedAction = resolveRealDataResultIssueAction(expectedHits, commandArgs.searchQuery)` — action resolver 재유도(builder ②), **builder ① 산출(hits)을 첫 인자로 소비**.
- L229~232: `const expectedArgv = buildRealDataResultIssueGhArgv(expectedAction, commandArgs)` — gh argv 빌더 재유도(builder ③), **builder ② 산출(action)을 첫 인자로 소비**.

즉 세 builder 는 `parse → resolveAction → buildGhArgv` **순서에 의미가 있다**(2개의 데이터-의존 edge): builder ②가 builder ① 산출(hits)을, builder ③이 builder ② 산출(action)을 source 로 쓰므로 JS 인자 평가 규칙상 반드시 parse → resolveAction → buildGhArgv 순으로 완료된다. fail-fast 게이트(L215~219: assertPlanStructure/assertPlanArgvStructure/assertPlanActionEnum/assertStdoutStructure/assertCommandArgsStructure → TypeError)도 존재. 이는 T-1060 의 3-builder leg 과 동형이며 pre-check 3조건(spec `invocationCallOrder`=0 · 2+ distinct builder 데이터-의존 chain · fail-fast 게이트)을 모두 충족한다.

현행 spec(`...-result-issue-gh-command-plan-consistency.spec.ts`, 691줄)은 happy-path void(create/update/멱등)·argv drift RangeError·action 분기 오매핑·issueNumber drift·argv 길이/원소 byte 위반·구조 결손 TypeError·**위임 helper throw 전파**·결정성·비변형을 이미 검증한다. 그러나 세 재유도 builder(parse → resolveAction → buildGhArgv)의 **정합-경로 상대 호출 순서(`invocationCallOrder` 부등식 2개)와 데이터-의존 방향(② 가 ① 산출을, ③ 이 ② 산출을 첫 인자로 소비)은 못박지 않는다** — spec `invocationCallOrder` = 0(pre-check 확인). 따라서 guard 재유도 본문에서 실수로 세 재유도를 재정렬하거나 builder ②/③의 첫 인자를 앞 산출이 아닌 다른 값으로 바꿔도(argv/action 비교는 순서-무관이라 특정 경로에선 최종 verdict 통과 가능) 검출되지 않는다. 현행 spec 은 아직 세 delegate 를 namespace 로 import 하지 않고(실 입력으로만 throw 유발) spyOn 배선이 없으므로, 세 delegate 의 namespace import + 정합-경로 순서-lock(2 edge) + reference-페어링(2개) test 를 추가해 이 gap 을 봉한다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` — 본 task 가 수정할 **유일 파일**(691줄). 현재 세 delegate 를 namespace 로 import 하지 **않으므로**(L27~32 은 command-args type · gh-command-plan 컴포저/type · guard 자체만 import) **신규 namespace import 3줄 추가**가 필요하다:
  - `import * as searchParseModule from "./realdata-e2e-result-issue-search-parse"` (프로퍼티 `parseRealDataResultIssueSearchOutput`)
  - `import * as actionModule from "./realdata-e2e-result-issue-action"` (프로퍼티 `resolveRealDataResultIssueAction`)
  - `import * as ghArgvModule from "./realdata-e2e-result-issue-gh-argv"` (프로퍼티 `buildRealDataResultIssueGhArgv`)

  세 namespace 프로퍼티에 `jest.spyOn` 을 건다. 기존 fixture(`makeCommandArgs()` L37·`stdoutOf()` L62·`buildConsistent(stdout, commandArgs)` L76)로 정합 plan 을 만든다 — ⚠️ **`buildConsistent()` 가 컴포저(`resolveRealDataResultIssueGhCommandPlan`)를 돌려 세 delegate 를 호출하므로 spy 설정 전에 미리 plan 을 만든다**(spy 이후 생성 시 관측 오염 — T-1060/T-1062 선례). 정합 update plan 을 쓰려면 `stdoutOf([{ number: N }])`(marker 포함 후보 1건 → update 분기)를 source 로 쓰고, create 분기는 `"[]"`. 최상위 `afterEach`/`restoreAllMocks` **현재 없으므로 최상위에 추가**(spy 격리 필수 — 없으면 후속 test 오염). 기존 "위임 helper throw 전파(가드 자체 try/catch 0)" describe(L540~) 를 선례 위치로 삼되 그 안의 기존 throw-전파 test 는 **유지**하고, `parse → resolveAction → buildGhArgv` 정합-경로 순서-lock(2 edge) + reference-페어링(2개) + 후속-throw 순서 재확인 test 를 **신규 추가**한다(새 describe 블록 권장 — T-1060 spec 의 "T-1060 — 재유도 위임 순서-lock" describe 를 모델로).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` — guard 재유도 지점 확인용(**수정 금지**). `assertRealDataResultIssueGhCommandPlanConsistentWithInputs` L207~273: (1) 구조 guard(L215~219 assertPlanStructure/assertPlanArgvStructure/assertPlanActionEnum/assertStdoutStructure/assertCommandArgsStructure → TypeError) → (2) `parseRealDataResultIssueSearchOutput(stdout)`(L224) → `resolveRealDataResultIssueAction(expectedHits, commandArgs.searchQuery)`(L225) → `buildRealDataResultIssueGhArgv(expectedAction, commandArgs)`(L229) 3-stage 재유도 → (3) action 분기 매핑 · update issueNumber · argv 길이/원소 비교. ⚠️ 순서-lock 은 이 `parse → resolveAction → buildGhArgv` 재유도 순서(2 edge, JS 인자 평가 규칙상 앞 builder 가 뒤 builder 보다 먼저) + 데이터-의존(② 가 ① 산출 hits 를, ③ 이 ② 산출 action 을 첫 인자로 소비)을 못박는다. reference-페어링 assert 대상: `actionSpy.mock.calls[0][0]` === `parseSpy.mock.results[0].value`(builder ①은 hits 배열을 직접 반환), `ghArgvSpy.mock.calls[0][0]` === `actionSpy.mock.results[0].value`(builder ②는 action 객체를 직접 반환).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts`(T-1060 산물) — 본 task 의 **직계 형제(daily-leg mirror)** 선례. consistency-guard 재유도 데이터-의존 3-stage 순서-lock 의 pass-through `jest.spyOn`(mockImplementation 없이 원 구현 통과) + `parseSpy.mock.invocationCallOrder[0] < actionSpy.mock.invocationCallOrder[0]` 및 `actionSpy.mock.invocationCallOrder[0] < ghArgvSpy.mock.invocationCallOrder[0]` 부등식 2개(`toBeLessThan`) + 각 위임 `toHaveBeenCalledTimes(1)` + 둘째/셋째 위임 인자가 앞 산출임을 확인하는 reference-페어링 2개 + fail-fast(parse throw → resolveAction/buildGhArgv 미도달) + 후속-위임 throw(buildGhArgv throw → parse·resolveAction 이미 각 1회, 순서 재확인) 구조 선례. 본 task 는 이 3-builder 선례를 result-issue 식별자로 그대로(2 edge·reference-페어링 2개) 옮긴다.

## Acceptance Criteria

- [ ] **정합-경로 재유도 순서-lock test 추가 (happy-path/flow, 2 edge)**: guard 재유도 세 builder 순서를 못박는 test 1개 추가 — parse 위임(`searchParseModule.parseRealDataResultIssueSearchOutput`)·resolveAction 위임(`actionModule.resolveRealDataResultIssueAction`)·buildGhArgv 위임(`ghArgvModule.buildRealDataResultIssueGhArgv`)을 각각 **실 구현 pass-through** `jest.spyOn`(mockImplementation 없이 원 구현 통과)으로 감싸고, spy 설정 **전**에 미리 만든 정합 plan(`buildConsistent(stdout, commandArgs)`)·같은 `stdout`/`commandArgs` 로 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs(plan, stdout, commandArgs)`(재유도 트리거)을 1회 호출한 뒤 두 부등식 `parseSpy.mock.invocationCallOrder[0] < actionSpy.mock.invocationCallOrder[0]` 및 `actionSpy.mock.invocationCallOrder[0] < ghArgvSpy.mock.invocationCallOrder[0]`(edge 2개)을 `toBeLessThan` 으로 검증. 추가로 세 위임이 각 `toHaveBeenCalledTimes(1)` 임을 assert(정합 경로에서 각 재유도 정확히 1회).
- [ ] **데이터-의존 reference-페어링 assert 추가 (flow, 2개)**: 위 순서-lock test 안에서(또는 별도 test 로) 데이터-의존 방향을 못박는다 — (1) resolveAction 위임이 parse 위임의 **반환값(hits)을 첫 인자로 소비**: `actionSpy.mock.calls[0][0]` 이 `parseSpy.mock.results[0].value` 와 동일(`toBe` 참조 동등)임을 검증. (2) buildGhArgv 위임이 resolveAction 위임의 **반환값(action)을 첫 인자로 소비**: `ghArgvSpy.mock.calls[0][0]` 이 `actionSpy.mock.results[0].value` 와 동일(`toBe` 참조 동등)임을 검증. 두 builder 의 첫 인자가 앞 builder 산출임을 못박아 3-stage 데이터-의존 chain 방향을 lock(T-1060 reference-페어링 선례 그대로).
- [ ] **error path/negative 보강 (fail-fast + 후속 위임 throw 순서 재확인)**: 다음 negative case 를 추가 —
  (a) **fail-fast edge(parse 재유도 throw → resolveAction·buildGhArgv 미도달)**: pass-through 대신 `parseSpy.mockImplementation(() => { throw new Error("parse-boom"); })` 로 첫 위임을 강제 throw 시키고, guard 호출이 그 에러를 전파(`toThrow(/parse-boom/)`)하며 `actionSpy` 와 `ghArgvSpy` 가 각 `toHaveBeenCalledTimes(0)` 임을 검증(첫 stage throw → 뒤 stage 미도달).
  (b) **후속-위임 throw 순서 재확인(buildGhArgv 재유도 throw → parse·resolveAction 이미 각 1회 호출)**: pass-through `parseSpy`·`actionSpy` 유지 + `ghArgvSpy.mockImplementation(() => { throw new Error("argv-boom"); })` 로 셋째 위임을 throw 시키고(정합 입력으로 앞 두 재유도는 통과), guard 호출이 그 에러를 전파(`toThrow(/argv-boom/)`)하며 `parseSpy` 와 `actionSpy` 가 각 `toHaveBeenCalledTimes(1)`(순서 상 parse·resolveAction 이 buildGhArgv 보다 먼저 평가됨을 negative 경로에서도 재확인)임을 검증.
  단일 negative 로 부족하지 않도록 (a)(b) 두 분기 각각 cover(edge chain 의 fail-fast 방향 + 종단 throw 순서 재확인).
- [ ] **branch/무공유 재확인**: 순서-lock test 는 pass-through spy 이므로 정합 경로에서 guard 가 정상 `void`(throw 0) 반환하고 입력 plan/stdout/commandArgs mutate 0(read-only guard)임을 재확인하는 assert 1개 추가. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` 및 여타 producer/guard/builder/`src` 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] **spy 격리**: 최상위 `afterEach(jest.restoreAllMocks)` 가 존재하지 않으면 추가(신규 spyOn 격리 필수 — 없으면 후속 test 관측 오염).
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep -c invocationCallOrder test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` 가 0 → ≥1(정합-경로 순서-lock 부등식 실배선 확인).

## Out of Scope

- consistency guard `.ts` 의 재유도 호출 순서 **재정렬 / 정규화** — 현행 순서(parse → resolveAction → buildGhArgv)를 lock 만 하고 바꾸지 않는다.
- `parseRealDataResultIssueSearchOutput` / `resolveRealDataResultIssueAction` / `buildRealDataResultIssueGhArgv` 위임 helper 로직·인자·guard 정책 변경.
- result-issue gh-command-plan **컴포저**(`realdata-e2e-result-issue-gh-command-plan.ts`, `resolveRealDataResultIssueGhCommandPlan`)의 위임 순서 — 본 task 는 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs` **내부**의 세 builder 재유도만, 다른 층·다른 delegate(컴포저 self-wire 순서-lock 은 별도 후속).
- result-report-plan / evaluation-plan / result-issue-command-plan / result-issue-publish-plan / daily-step-dual-leg-command-plan / daily-step-dual-leg-publish-plan / daily-step-dual-leg-gh-command-plan / daily-step-dual-leg-outcome-report-from-output / result-issue-outcome-report-from-output 재유도 — 이미 T-1054~T-1062 가 cover(본 task 는 sibling consistency-guard leg 10, T-1060 daily-leg gh-command-plan 3-stage 의 result-issue mirror).

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 후속, leg 11 후보) 본 task(result-issue gh-command-plan-consistency 3-stage 재유도 순서-lock) 완결 후 나머지 delegate 기반 consistency/composer guard 를 pre-check(각 spec `invocationCallOrder` 0건 여부 + guard 본문 재유도 builder 개수 + fail-fast 게이트/데이터-의존 여부)로 재판정. 확인 대상: result-issue-publish-plan 재유도가 이미 T-1057 이 cover 인지(daily 계열은 소진), outcome-report-from-output **컴포저** self-wire 재유도(`build/resolveRealData...FromOutput` producer-seam, 양쪽 spec invocationCallOrder 부분 배선 여부), 그리고 result-issue-command-plan-consistency 의 3-stage 여부. 단일 builder 재유도·inline 독립 재유도(`reDeriveExpected*`/`composeExpected*` — 위임 재호출 0)·게이트 없는 상호-독립 병렬 재유도는 "order-lock 불요" 확정 기록. 적격 delegate 기반 consistency guard 가 realdata-e2e 전역에서 소진 확인되면 sweep 완료 선언 + P5 test-hardening 의 next 축(예: producer-seam self-wire 순서-lock 또는 e2e 흐름 커버리지)으로 전환.
