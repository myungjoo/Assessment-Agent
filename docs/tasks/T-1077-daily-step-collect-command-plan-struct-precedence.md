---
id: T-1077
title: realdata-e2e daily-step-collect command-plan consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError) 이 gating 재유도 위임(resolveRealDataE2eLiveGating)보다 먼저 수행됨을 delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 12, T-1076 Follow-up)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 150
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 12 — daily-step-collect command-plan consistency 가드(단일 재유도 delegate=resolveRealDataE2eLiveGating). pre-check 실증(grep+read, 2026-07-17): 가드가 2 구조 assert(assertPlanStructure L162 / assertEnvStructure L163)를 gating 재유도 위임(resolveRealDataE2eLiveGating L174)보다 먼저 수행하나, spec(598줄)은 gating 모듈을 import(L33)만 할 뿐 spyOn/toHaveBeenCalled/invocationCallOrder 0회 — 구조 error-path(L110~180)는 .toThrow(TypeError) 만. 구조 결손 입력 시 delegate toHaveBeenCalledTimes(0) 미검증 = gap. 구조 결손 대표 분기(plan null/undefined/array/primitive · env null/array/primitive) 각각 delegate 0-call spy + happy invocationCallOrder + RangeError(delegate 호출됨) 대조로 선행성 완결. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b(pr-mode 0-active claim 시 단독)."
---

# T-1077 — daily-step-collect command-plan 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → … → leg 11 daily-step-dual-leg run-report-issue-gh-command-plan(T-1076)으로 이어졌다. dual-leg run-report 종단 컴포저 가드 4종(command-plan · gh-command-plan · outcome-report-from-output · publish-plan)이 leg 8~11 로 소진됐으므로, T-1076 Follow-up 이 지목한 "잔여 daily family 가드"로 확장한다. 본 task 는 그 **leg 12** 로, daily step④ collect 커맨드 플랜 컴포저(`buildRealDataDailyStepCollectCommandPlan`)의 산출 `plan({action, argv, reason})` 을 single source `env` 로 **gating 재유도**(`resolveRealDataE2eLiveGating`)로 대조하는 seam 무결성 가드 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating`(`test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts`)를 삼는다. 이 가드는 컴포저 산출 plan 을 live-gating helper 로부터 독립 재유도한 expected(`gating.enabled ⇒ action`, canonical argv, `gating.reason` 전파)와 대조하는 조각이다(README.md 109행 step ④ 결과 박제 chain 의 post-composition 무결성 / REQ-032·REQ-059). 앞선 daily dual-leg legs 가 2~3 delegate 가드였던 데 비해 본 leg 는 **단일 재유도 delegate**(`resolveRealDataE2eLiveGating`) 가드다 — 패턴은 동형이되 delegate 가 1개.

planner pre-check(실 grep + read, 2026-07-17)로 확인한 gap: 이 가드는 본문에서 **2 구조 assert**(`assertPlanStructure(plan)` L162 — plan null/undefined/비-object/array → TypeError L93, `assertEnvStructure(env)` L163 — env null/비-object/array → TypeError L110)를 **gating 재유도 위임**(`resolveRealDataE2eLiveGating(env)` L174)보다 **먼저** 수행한다(구조검사 L162~163 < 재유도 L174). 그 사이에 action enum RangeError 분기(L166 — `plan.action` 이 "run"/"skip" 외)가 끼며, 재유도 **후** 값 정합 위반 RangeError(action↔gating 매핑 L179 / argv 부재·비-배열·길이·원소 L188~210 / reason 전파 L223)가 온다. 그러나 대응 spec(총 598 line)은 gating 모듈을 `import`(L33 `./realdata-e2e-live-gating`)만 할 뿐 **`spyOn`·`toHaveBeenCalled`·`invocationCallOrder` 가 0회** 다 — 구조 error-path 블록(L110~180 `error path — 구조 결손(TypeError)`)은 plan/env 구조 결손에 `.toThrow(TypeError)` 만 assert 하고 delegate 호출 횟수를 못박지 않는다. 즉 **구조 결손 입력을 주면 gating 재유도 delegate 가 `toHaveBeenCalledTimes(0)` 이어야 한다는 선행성**이 spy 로 못박혀 있지 않다. 이를 구조 결손 대표 분기(plan null·plan undefined·plan array·plan primitive·env null·env array·env primitive) 각각에 delegate `toHaveBeenCalledTimes(0)` 으로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 gating 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1076 와 동형 defense-in-depth, delegate 1개). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating`(L157~228) 본문의 2 구조 assert(`assertPlanStructure` L162 / `assertEnvStructure` L163)가 gating 재유도 위임(`resolveRealDataE2eLiveGating(env)` L174)보다 앞섬을 확인(구조검사 L162~163 < 재유도 L174). 각 구조 assert 함수 본문(assertPlanStructure L84~ / assertEnvStructure L101~)의 TypeError 분기를 확인. action enum RangeError(L166) 가 구조 검사와 재유도 **사이**에 위치함(즉 이 RangeError 도 delegate 0-call — 값 boundary 대조 시 이 분기 대신 재유도 **후** RangeError 를 사용해야 delegate 1-call 이 됨), 값 정합 위반 RangeError(action↔gating 매핑 L179 / argv L188~210 / reason L223)는 재유도 **뒤** 에 위치함을 확인. **광범위 read 금지 — 해당 함수 + 2 구조 assert 본문 + import 라인(L67 `resolveRealDataE2eLiveGating`)만.**
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님, 총 598줄). 기존 구조 error-path 블록(L110~180 `error path — 구조 결손(TypeError)`)은 plan null/undefined/array/string · env null/array/string 에 `.toThrow(TypeError)` 만 assert 하고 **spy 부재**임을 확인. gating 모듈 import(L33)는 값 fixture 용이고 `spyOn` 없음을 확인. 기존 flow/branch 블록(L181~)·negative 블록(L250~)·credential 누출(L490~)·비변형(L538~)·결정론(L562~) 블록은 유지 — **새 describe 블록으로 구조-선행성만 추가**. spy target 은 gating 모듈의 `resolveRealDataE2eLiveGating` — 신규 `import * as gatingModule from "./realdata-e2e-live-gating"` namespace import 후 `jest.spyOn(gatingModule, "resolveRealDataE2eLiveGating")`. 최상위(또는 새 describe) `afterEach` 에 `jest.restoreAllMocks()` 를 두어 신규 spyOn 격리를 보장. 정상 fixture(happy path 블록 L70~ 의 정합 plan/env)를 재사용.
- `docs/tasks/T-1076-daily-gh-cmd-plan-struct-prec.md` — 본 축 leg 11(패턴 precedent, 3-delegate). `docs/tasks/T-1070-step-args-struct-precedence.md` — 단일/소수 delegate leg 참고. 동일 패턴(구조 결손 → 재유도 delegate 0-call spy + 구조 vs 값 경계 대조)을 mirror 하되, 본 leg 는 delegate 가 **1개**(`resolveRealDataE2eLiveGating`)이므로 각 구조 분기마다 그 delegate 1개의 `toHaveBeenCalledTimes(0)` 을 못박는다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `plan`/`env` 입력에서 가드가 void 반환하고, `resolveRealDataE2eLiveGating` spy 가 정확히 1회 호출됨을 재확인 — 구조 검사(assertPlanStructure·assertEnvStructure)가 통과한 뒤에 delegate 가 호출되는 정상 도달 경로. 가능하면 `invocationCallOrder` 로 delegate 가 구조 검사 뒤임을 부등식으로 못박는다(구조 검사는 spy 대상이 아니므로, 최소한 delegate call 이 1회이고 happy 결과 void 임을 확인).
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`plan` null, `plan` undefined, `plan` 배열, `plan` 원시(string), `env` null, `env` 배열, `env` 원시(string))에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`resolveRealDataE2eLiveGating` spy 가 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 gating 재유도보다 먼저 수행(선행 차단)됨을 delegate spy 로 못박는다(기존 spec 은 구조 error-path 에서 delegate 호출 횟수 미검증 → 본 leg 가 신설 완결).
- [ ] **flow/branch cover**: 구조 검사 분기(plan 존재/형태 / env 존재/형태) 각각에 대해 위 "TypeError + delegate 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음). plan null 과 undefined 는 별 case 로 분리. env 결손(null/array/string)도 별 case 로 분리.
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 배열 · 원시(string) · type mismatch)을 plan/env 각각에 대표 negative 로 배치하고, 추가로 **값 정합 위반(RangeError)은 구조 검사를 통과해 gating 재유도가 호출된 뒤 발생**함(즉 RangeError 경로에서는 `resolveRealDataE2eLiveGating` spy 가 1회 call)을 대조 테스트로 1+ 추가 — 재유도 **후** RangeError(예: action↔gating 매핑 위반 L179 또는 reason drift L223 또는 argv drift)를 사용해 delegate 1-call 을 확인. 주의: action enum RangeError(L166)는 재유도 **전**이라 delegate 0-call 이므로 값-boundary 대조용으로 쓰지 말 것(대조는 재유도 뒤 RangeError 여야 delegate 호출됨을 입증). 구조(TypeError, delegate 0-call) vs 값(재유도-후 RangeError, delegate 1-call) 경계를 선행성 관점에서 명확화.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` 값이 기존(0)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 대표 분기 전량(plan null/undefined/array/primitive · env null/array/primitive)에 delegate `resolveRealDataE2eLiveGating` 각각 존재.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 daily-step-collect command-plan **1개** 만(leg 12). 나머지 적격 daily family 가드(daily-step-eval command-plan 등)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 구조 error-path TypeError 테스트(L110~180)·flow/branch(L181~)·negative(L250~)·credential 누출(L490~)·비변형(L538~)·결정론(L562~) 블록의 삭제·재작성 — 유지하고 새 describe 로 확장 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1076 defense-in-depth 패턴의 daily-step-collect command-plan mirror, 단일 delegate). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 대표 분기 각 delegate 0-call spy + 재유도-후 RangeError delegate 1-call 대조 검증.

## Follow-ups

- (구조-선행성 sweep leg 13+) 본 leg 를 mirror 해 남은 적격 daily family 가드를 순차 leg 화. **leg 13 후보: `realdata-e2e-daily-step-eval-command-plan-consistency`**(delegate 1개 import, spec zerocall=0 — 동형 gap). 적격 grep: 각 guard 가 재유도 delegate 모듈을 `import`(`^import \{ (parse|resolve|build)RealData`)하고 구조검사(assert*Structure/TypeError)가 재유도보다 앞서며, spec 에 그 delegate 의 `toHaveBeenCalledTimes(0)` 구조-선행성 assert 가 부재(spyOn 0회 포함)하면 적격. daily family 소진 시 잔여 pipeline-plan / run-plan / seed-collect / step-args family(evaluation-step-args · result-outcome-step-args · result-publish-step-args) 등 delegate-import 가드로 확장.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
