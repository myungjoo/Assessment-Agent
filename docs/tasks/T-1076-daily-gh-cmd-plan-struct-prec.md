---
id: T-1076
title: realdata-e2e daily-step-dual-leg run-report-issue-gh-command-plan consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 이 3 재유도 위임(parse → resolveAction → buildGhArgv)보다 먼저 수행됨을 세 delegate 각 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 11, T-1075 Follow-up)
phase: P5
status: DONE
mergedAs: 12dd1546
prNumber: 969
reviewRounds: 1
completedAt: 2026-07-17T10:52:00Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 180
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 11 — daily gh-command-plan consistency 가드(delegates=3). pre-check 실증(grep+read, 2026-07-17): 가드가 5 구조 assert(assertPlanStructure L219 / assertPlanArgvStructure L220 / assertPlanActionEnum L221 / assertStdoutStructure L222 / assertCommandArgsStructure L223)를 3 재유도 위임(parse L229 → resolveAction L230 → buildGhArgv L234)보다 먼저 수행하나, spec(1045줄, zerocall=3)의 0-call assert(L963/964/999)는 전부 delegate throw 주입 value-재유도 fail-fast(구조 아님)다. 구조 error-path 블록(L217~377)·flow/branch(L378~460)은 spy 없이 .toThrow(TypeError)/RangeError 만. 구조 결손 입력 시 세 delegate(parse·resolveAction·buildGhArgv) 각 toHaveBeenCalledTimes(0) 미검증 = gap. 구조 결손 분기(plan null/undefined/array/primitive · argv 비-배열 · action enum 결손 · stdout 비-string · commandArgs 비-object) 대표 각각 × 3 delegate 0-call spy 로 선행성 완결. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1076 — daily-step-dual-leg run-report-issue-gh-command-plan 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → … → leg 9 daily-step-dual-leg run-report-issue-outcome-report-from-output(T-1074) → leg 10 daily-step-dual-leg run-report-issue-publish-plan(T-1075, expansion)으로 이어졌다. 본 task 는 그 **leg 11** 로, T-1075 Follow-up 이 leg 11 후보로 지목한 daily family 종단 컴포저 가드 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts`)를 삼는다. 이 가드는 step④ 결과 박제 종단 컴포저(`resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`)의 산출 `plan({action, argv})` 을 single source `(stdout, commandArgs)` 로 **3층 위임**(parse → resolveAction → buildGhArgv)으로 재유도한 expected 와 deep-equal / byte-identical 대조하는 seam 무결성 조각이다(README.md 109행 step ④ 결과 박제 chain 의 post-composition 무결성). 앞선 legs 가 2-delegate 가드였던 데 비해 본 leg 는 **3-delegate** 가드다.

planner pre-check(실 grep + read, 2026-07-17)로 확인한 gap: 이 가드는 본문에서 **5 구조 assert**(`assertPlanStructure(plan)` L219 — plan null/undefined/비-object/array → TypeError L105, `assertPlanArgvStructure(plan.argv)` L220 — argv 비-배열 → TypeError L115, `assertPlanActionEnum(plan.action)` L221 — action 비-object 또는 action.action 이 'create'/'update' 외 → TypeError L129/135, `assertStdoutStructure(stdout)` L222 — stdout 비-string → TypeError L148, `assertCommandArgsStructure(commandArgs)` L223 — commandArgs 비-object → TypeError L170)를 **3 재유도 위임**(`parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` L229 → `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, searchQuery)` L230 → `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs)` L234)보다 **먼저** 수행한다(구조검사 L219~223 < 첫 재유도 L229). 그러나 대응 spec(총 1045 line, 전역 `toHaveBeenCalledTimes(0)` 등장 3회)의 0-call spy 검증은 **전부 value-재유도 fail-fast** 다 — L963/964 는 parse delegate 를 mock throw 주입했을 때 resolveAction·buildGhArgv 미도달, L999 는 resolveAction delegate mock throw 시 buildGhArgv 미도달을 못박는 T-1060 순서-lock 블록 소속이라 **구조 error-path 가 아니다**. 구조 error-path 블록(L217~377)과 flow/branch 블록(L378~460)은 spy 없이 `.toThrow(TypeError)`/`.toThrow(RangeError)` 만 assert 한다. 즉 **구조 결손 입력을 주면 세 재유도 delegate(parse·resolveAction·buildGhArgv)가 모두 `toHaveBeenCalledTimes(0)` 이어야 한다는 선행성**이 spy 로 못박혀 있지 않다. 이를 구조 결손 대표 분기(plan null·plan undefined·plan array·plan primitive·plan.argv 비-배열·plan.action enum 결손·stdout 비-string·commandArgs 비-object) 각각에 세 delegate 각 `toHaveBeenCalledTimes(0)` 으로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1075 와 동형 defense-in-depth, 단 delegate 가 3개). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataDailyStepDualLegRunReportIssueGhCommandPlanConsistentWithInputs`(L211~) 본문의 5 구조 assert(`assertPlanStructure` L219 / `assertPlanArgvStructure` L220 / `assertPlanActionEnum` L221 / `assertStdoutStructure` L222 / `assertCommandArgsStructure` L223)가 3 재유도 위임(`parse...SearchOutput` L229 + `resolve...Action` L230 + `build...GhArgv` L234)보다 앞섬을 확인(구조검사 L219~223 < 첫 재유도 L229). 각 구조 assert 함수 본문(assertPlanStructure L96~ / assertPlanArgvStructure L113~ / assertPlanActionEnum L125~ / assertStdoutStructure L144~ / assertCommandArgsStructure L158~)의 TypeError 분기를 확인. 값 정합 위반 RangeError 분기(action 매핑 L240 / issueNumber L252 / argv 길이 L260 / argv 원소 L270)는 구조 검사 **통과 후** 재유도 뒤에 위치함을 확인. **광범위 read 금지 — 해당 함수 + 5 구조 assert 본문만.**
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 기존 구조 error-path 블록(L217~377 `error path — 구조 결손(TypeError)`)은 `.toThrow(TypeError)` 만 assert 하고 spy 부재임을 확인. 기존 flow/branch 블록(L378~460)도 spy 부재. 기존 T-1060 순서-lock 블록(L853~1044)의 0-call assert(L963/964 parse throw 주입 시 action·ghArgv 0-call, L999 resolveAction throw 주입 시 ghArgv 0-call)는 **value-재유도 fail-fast**(구조 아님)임을 확인하고 유지 — **새 describe 블록으로 구조-선행성만 추가**. spy target 모듈은 기존 블록의 namespace import `searchParseModule`(L39, `parseRealDataDailyStepDualLegRunReportIssueSearchOutput`)·`actionModule`(L31, `resolveRealDataDailyStepDualLegRunReportIssueAction`)·`ghArgvModule`(L33, `buildRealDataDailyStepDualLegRunReportIssueGhArgv`) 을 재사용. 최상위 `afterEach` `jest.restoreAllMocks()`(L112~114) 가 신규 spyOn 격리를 보장함을 확인. 정상 fixture `makeCommandArgs()`(L49)·`stdoutOf()`(L85)·`buildConsistent()`(L99) 를 재사용.
- `docs/tasks/T-1075-daily-dual-leg-publish-plan-struct-prec-expansion.md` — 본 축 leg 10(패턴 precedent, daily family, 2-delegate). `docs/tasks/T-1073-daily-dual-leg-cmd-plan-struct-prec.md` — leg 8(daily family). 동일 패턴(구조 결손 → 재유도 delegate 각 0-call spy + 구조 vs 값 경계 대조)을 mirror 하되, 본 leg 는 delegate 가 **3개**(parse·resolveAction·buildGhArgv)이므로 각 구조 분기마다 세 delegate 각각 0-call 을 못박는다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `plan`/`stdout`/`commandArgs` 입력에서 가드가 void 반환하고, `parse` → `resolveAction` → `buildGhArgv` spy 가 `invocationCallOrder` 부등식 순서로 정확히 각 1회 호출됨을 재확인(기존 T-1060 정합-경로 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`plan` null, `plan` undefined, `plan` 배열, `plan` 원시(string), `plan.argv` 비-배열, `plan.action` enum 결손('delete'), `stdout` 비-string(number), `commandArgs` 비-object)에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`parse`·`resolveAction`·`buildGhArgv` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 **세 delegate 각각** spy 로 못박는다(기존 spec 의 0-call 은 전부 value-재유도 fail-fast 라 구조 error-path 미커버 → 본 leg 가 신설 완결).
- [ ] **flow/branch cover**: 구조 검사 분기(plan 존재/형태 / plan.argv 배열 / plan.action enum / stdout string / commandArgs object) 각각에 대해 위 "TypeError + 3 delegate 각 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음). plan null 과 undefined 는 별 case 로 분리.
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 배열 · 원시(string/number) · 비-배열 argv · enum 결손 · type mismatch) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: action 매핑 / argv drift)은 구조 검사를 통과해 3 재유도가 호출된 뒤 발생**함(즉 RangeError 경로에서는 parse·resolveAction·buildGhArgv spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, 세 delegate 0-call) vs 값(RangeError, delegate 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` 값이 기존(3)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 대표 분기 전량에 세 delegate(parse·resolveAction·buildGhArgv) 각각 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 daily-step-dual-leg run-report-issue-gh-command-plan **1개** 만(leg 11). 나머지 적격 daily family 가드는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 T-1060 순서-lock 블록(정합-경로 `invocationCallOrder` + value-재유도 fail-fast delegate throw 주입 0-call, L963/964/999)·기존 구조 error-path TypeError 테스트(L217~377)·기존 flow/branch 테스트(L378~460)·기존 negative 블록(L462~)의 삭제·재작성 — 유지하고 새 describe 로 확장 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1075 defense-in-depth 패턴의 daily gh-command-plan mirror, delegate 3개로 확장). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 대표 분기 × 3 delegate 각 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 12+) 본 leg 를 mirror 해 남은 적격 daily family / result-issue family 가드를 순차 leg 화. 적격 grep: 각 guard 의 구조검사(assert*Structure/TypeError)가 재유도(build*/parse*/resolve*)보다 앞서고, spec 의 구조 error-path 테스트에 재유도 위임 `toHaveBeenCalledTimes(0)` assert 가 delegate 전량·분기 전량에 존재하지 않으면(부재 또는 부분 — 기존 0-call 이 value-재유도 fail-fast 뿐인 경우 포함) 적격. daily family 종단 가드가 소진되면 잔여 result-issue / summary family 가드로 확장.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
