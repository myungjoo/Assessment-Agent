---
id: T-1071
title: realdata-e2e result-issue-gh-command-plan consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 분기가 값 재유도(parse/resolveAction/buildGhArgv 3 위임)보다 먼저 수행됨을 재유도-delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 6, T-1070 Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 6 — T-1070(step-args aggregator) mirror. pre-check: gh-command-plan 가드가 구조검사(assertPlanStructure line 215 / assertPlanArgvStructure 216 / assertPlanActionEnum 217 / assertStdoutStructure 218 / assertCommandArgsStructure 219, 6분기)를 값 재유도(parseRealDataResultIssueSearchOutput 224 → resolveRealDataResultIssueAction 225 → buildRealDataResultIssueGhArgv 229)보다 먼저 수행하나, spec(ico=12)의 구조 error-path 블록(line 156~296)은 각 분기 .toThrow(TypeError) 만 assert·3 재유도 delegate 0-call 미검증. 기존 값-재유도 fail-fast(parse throw→action/ghArgv 0-call, line 806~829)만 lock 됨. 구조 결손 6분기서 3 delegate spy 0-call 로 선행성 못박음. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1071 — result-issue-gh-command-plan 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → leg 2 evaluation-plan(T-1067) → leg 3 result-issue-command-plan(T-1068) → leg 4 result-issue-publish-plan(T-1069) → leg 5 step-args aggregator(T-1070)로 이어졌다. 본 task 는 그 **leg 6** 으로, T-1070 Follow-up 이 명시한 후보 가드 `assertRealDataResultIssueGhCommandPlanConsistentWithInputs`(`test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts`)를 mirror 대상으로 삼는다. 이 가드는 step④ 결과 박제 종단 컴포저(`resolveRealDataResultIssueGhCommandPlan`)의 산출 plan 을 입력 `(stdout, commandArgs)` 로 3 위임 helper(parse → resolveAction → buildGhArgv)를 재호출해 single-source 재유도한 expected 와 대조하는 seam 무결성 조각이다.

planner pre-check 로 확인한 gap: 이 가드는 본문에서 구조 검사(`assertPlanStructure`(line 215) → `assertPlanArgvStructure`(216) → `assertPlanActionEnum`(217) → `assertStdoutStructure`(218) → `assertCommandArgsStructure`(219))를 값 재유도 위임(`parseRealDataResultIssueSearchOutput`(224) → `resolveRealDataResultIssueAction`(225) → `buildRealDataResultIssueGhArgv`(229))보다 **먼저** 수행한다(구조검사 line 215~219 < 첫 재유도 line 224). 그러나 대응 spec(현 `invocationCallOrder` 등장 12회)의 구조 error-path 블록(line 156~296 `error path — 구조 결손(TypeError)`: plan null/undefined/배열/string, plan.argv 비배열/null, plan.action.action enum 결손, plan.action null, stdout null/number, commandArgs null/배열)은 오직 `.toThrow(...)`(TypeError) 만 assert 하며 **구조 위반 시 3 재유도 delegate 가 아예 호출되지 않는(선행 fail-fast) 선행성** 은 검증하지 않는다. 기존 순서-lock 블록(line 711~870)은 정합-경로 `invocationCallOrder` 부등식 + **값-재유도 fail-fast**(parse throw → action/ghArgv 0-call, line 806~829)만 못박아 구조 error-path 는 미커버다. 구조 결손 입력을 주면 `parseRealDataResultIssueSearchOutput`·`resolveRealDataResultIssueAction`·`buildRealDataResultIssueGhArgv` spy 가 모두 `toHaveBeenCalledTimes(0)` 이어야 하며, 이를 spy 로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1070 와 동형 defense-in-depth). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` — 대상 가드. `assertRealDataResultIssueGhCommandPlanConsistentWithInputs` 본문(line 207~)의 구조 검사 5 호출(`assertPlanStructure` 215 / `assertPlanArgvStructure` 216 / `assertPlanActionEnum` 217 / `assertStdoutStructure` 218 / `assertCommandArgsStructure` 219)이 재유도 위임 3 호출(`parseRealDataResultIssueSearchOutput` 224 / `resolveRealDataResultIssueAction` 225 / `buildRealDataResultIssueGhArgv` 229)보다 앞섬을 확인(구조검사 라인 < 첫 재유도 라인). 구조 assert 함수 분기(`assertPlanStructure` 99~112 / `assertPlanArgvStructure` 116~122 / `assertPlanActionEnum` 127~141 의 non-object + enum 2분기 / `assertStdoutStructure` 146~154 / `assertCommandArgsStructure` 160~173)를 확인. **광범위 read 금지 — 해당 함수 본문만.**
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님). 기존 구조 error-path 블록(line 156~296 `error path — 구조 결손(TypeError)`)은 `.toThrow(...)` 만 assert 함을 확인. 기존 순서-lock 블록(line 711~870: 정합-경로 parse<resolveAction<buildGhArgv `invocationCallOrder` 부등식 + parse-throw fail-fast `toHaveBeenCalledTimes(0)` line 828~829)은 유지하고 **새 describe 블록으로 구조-선행성만 추가**. spy target 모듈은 기존 블록의 `searchParseModule`(line 38, `parseRealDataResultIssueSearchOutput`)·`actionModule`(line 27, `resolveRealDataResultIssueAction`)·`ghArgvModule`(line 29, `buildRealDataResultIssueGhArgv`) 을 재사용. 최상위 `afterEach` mock 복원(line 90~91) 이 신규 spyOn 격리를 보장함을 확인.
- `docs/tasks/T-1070-step-args-struct-precedence.md` — 본 축 leg 5(패턴 precedent). 동일 패턴(구조 결손 → 재유도 delegate 0-call spy + 구조 vs 값 경계 대조)을 mirror 한다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `plan`/`stdout`/`commandArgs` 입력에서 가드가 void 반환하고, `parseRealDataResultIssueSearchOutput` → `resolveRealDataResultIssueAction` → `buildRealDataResultIssueGhArgv` spy 가 `invocationCallOrder` 부등식 순서로 정확히 각 1회 호출됨을 재확인(기존 정합-경로 ico 블록과 정합 — 구조 검사 통과 후 값 재유도 도달 경로).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`plan` 비-object[null/undefined/배열/string 대표], `plan.argv` 비-배열, `plan.action` 비-object, `plan.action.action` enum 결손['delete'], `stdout` 비-string, `commandArgs` 비-object)에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`parseRealDataResultIssueSearchOutput`·`resolveRealDataResultIssueAction`·`buildRealDataResultIssueGhArgv` spy 가 모두 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 값 재유도보다 먼저 수행(선행 차단)됨을 spy 로 못박는다.
- [ ] **flow/branch cover**: 구조 검사 6분기(plan 객체 / plan.argv 배열 / plan.action 객체 / plan.action.action enum / stdout 문자열 / commandArgs 객체) 각각에 대해 위 "TypeError + 3 delegate 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음).
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 비-object mismatch[배열/원시값] · enum 이탈값) 대표 negative 를 각 분기에 배치하고, 추가로 **값 정합 위반(RangeError, 예: action 매핑 drift)은 구조 검사를 통과해 재유도가 호출된 뒤 발생**함(즉 RangeError 경로에서는 parse/resolveAction/buildGhArgv spy 가 1+ call)을 대조 테스트로 1+ 추가 — 구조(TypeError, delegate 0-call) vs 값(RangeError, delegate 호출됨) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c invocationCallOrder test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` 값이 기존(12) 이상으로 유지되고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 6분기 전량에 3 delegate 각각 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 result-issue-gh-command-plan **1개** 만(leg 6). 나머지 적격 가드(구조 검사 + 1+ 재유도 위임 보유)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 정합-경로 `invocationCallOrder` 블록·기존 값-재유도 fail-fast(parse throw) 테스트·기존 구조 error-path TypeError 테스트의 삭제·재작성 — 유지하고 새 describe 로 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1070 defense-in-depth 패턴의 gh-command-plan mirror). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 6분기 3 delegate 0-call spy 검증.

## Follow-ups

- (구조-선행성 sweep leg 7+) 본 leg 를 mirror 해 구조 검사 + 1+ 재유도 위임을 보유한 다른 적격 가드(예: result-issue-command-args / result-issue-descriptor-body / daily-step-dual-leg-run-report-issue-command-plan 등)를 pre-check 로 재판정 후 순차 leg 화. 적격 grep: 각 spec 의 구조 결손 error-path 테스트에 재유도 위임 `toHaveBeenCalledTimes(0)` assert 부재면 적격. 주의: daily-step-dual-leg-run-report-issue-command-plan 은 이미 구조 위반 1분기(descriptor null)를 부분 lock 하므로, 그 leg 는 잔여 분기 완결로 축소된다.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
