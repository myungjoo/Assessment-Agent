---
id: T-1081
title: realdata-e2e seed-collect-call-args consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError)이 person 매퍼 재유도 위임(buildRealDataCollectInput)보다 먼저 수행됨을 delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 16, T-1080 Follow-up)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 160
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 16 — run-plan(leg 15, T-1080) 소진 후 T-1080 Follow-up 이 우선 후보로 지목한 seed-collect-call-args consistency 가드(seed-side leaf 컴포저 seam, 단일 재유도 delegate=buildRealDataCollectInput). pre-check 실증(grep+read, 2026-07-17, HEAD 232e6fdf=T-1080 머지 포함): 가드가 2 구조 assert(assertCallArgsStructure L183 / assertSeedsStructure L184)를 person 매퍼 재유도 위임(buildRealDataCollectInput L190)보다 먼저 수행하나, spec(290줄)은 delegate 를 import·spyOn 조차 안 하고(spyOn 0 / toHaveBeenCalled 0 / toHaveBeenCalledTimes(0) 0 / invocationCallOrder 0) 구조 error-path(L68 null/undefined·비-배열·원소 type 위반)는 .toThrow(TypeError) 만. 구조 결손 시 delegate 0-call 미검증 = gap. 구조와 delegate 사이 RangeError 없음(길이 L194 / person drift L207 / since L215 / assessmentId L223 전부 재유도 후). pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b."
---

# T-1081 — seed-collect-call-args 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → … → leg 15 run-plan(T-1080)으로 이어졌다. T-1080 Follow-up 이 **우선 후보**(step-args family 의 재유도 source)로 지목한 seed-collect-call-args consistency 가드를 leg 16 으로 삼는다. 이 가드 `assertRealDataCollectCallArgsConsistentWithSources`(`test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts`)는 실 평가 e2e build-time chain 의 **seed-side leaf 컴포저** `buildRealDataCollectCallArgs(seeds)` 산출 `RealDataCollectCallArgs[]`(각 원소 `{ person, since, assessmentId }`)를 single source `seeds` 로 production-위임 person 매퍼 `buildRealDataCollectInput(seeds)` 재유도해 person 을 deep-equal 대조하고 since/assessmentId 정책 상수를 직접 대조하는 seam 무결성 가드다(README.md 109행 step ① 실 평가 e2e build-time chain 의 seed-side leaf-seam 무결성 / REQ-032·REQ-059). 앞선 run-plan leg(T-1080)와 동형이며 재유도 delegate 는 **1개**(`buildRealDataCollectInput`).

planner pre-check(실 grep + read, 2026-07-17, HEAD 232e6fdf = T-1080 머지 포함)로 확인한 gap: 이 가드는 본문에서 **2 구조 assert**(`assertCallArgsStructure(callArgs)` L183 — callArgs null/undefined/비-배열 → TypeError, 각 원소 비-object → TypeError; `assertSeedsStructure(seeds)` L184 — seeds 비-배열 → TypeError)를 **person 매퍼 재유도 위임**(`buildRealDataCollectInput(seeds)` L190)보다 **먼저** 수행한다(구조검사 L183~184 < 재유도 L190). run-plan(T-1080)과 마찬가지로 구조 검사와 재유도 **사이에 RangeError 분기가 없다** — 값 정합 위반 RangeError(길이 불일치 L194 / person drift L207 / since 정책 위반 L215 / assessmentId 정책 위반 L223)는 전부 재유도 **뒤**에 온다. 그러나 대응 spec(총 290 line)은 delegate `buildRealDataCollectInput` 를 **import 조차 하지 않으며**(spec 은 leaf 컴포저 `buildRealDataCollectCallArgs` 만 import L15) `spyOn`·`toHaveBeenCalled`·`toHaveBeenCalledTimes(0)`·`invocationCallOrder` 가 **0회** 다 — 구조 error-path 블록(L68 `구조 결손(TypeError)`)은 `.toThrow(TypeError)` / 라벨 regex 만 assert 하고 delegate 호출 횟수를 못박지 않는다. 즉 **구조 결손 입력을 주면 person 매퍼 재유도 delegate 가 `toHaveBeenCalledTimes(0)` 이어야 한다는 선행성**이 spy 로 못박혀 있지 않다. 이를 구조 결손 대표 분기(callArgs null·callArgs undefined·callArgs 비-배열(object)·callArgs 원소 비-object(type mismatch)·seeds null·seeds 비-배열)에 delegate `buildRealDataCollectInput` `toHaveBeenCalledTimes(0)` 으로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1080 와 동형 defense-in-depth, delegate 1개). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataCollectCallArgsConsistentWithSources`(L177~) 본문의 2 구조 assert(`assertCallArgsStructure(callArgs)` L183 / `assertSeedsStructure(seeds)` L184)가 person 매퍼 재유도 위임(`buildRealDataCollectInput(seeds)` L190)보다 앞섬을 확인(구조검사 L183~184 < 재유도 L190). 각 구조 assert 함수 본문(assertCallArgsStructure L89~105 → callArgs 비-배열·원소 비-object TypeError / assertSeedsStructure L111~119 → seeds 비-배열 TypeError)의 TypeError 분기를 확인. 값 정합 위반 RangeError(길이 L194 / person drift L207 / since L215 / assessmentId L223)는 재유도 **뒤**에 위치함을 확인(구조 검사와 재유도 사이 RangeError 분기 없음 — run-plan T-1080 과 동일 단순 구조). delegate import 라인(L69 `import { buildRealDataCollectInput } from "./realdata-e2e-seed-collect-input"`) 확인. **광범위 read 금지 — 해당 함수 + 2 구조 assert 본문 + import 라인만.**
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님, 총 290줄). 기존 구조 error-path 블록(L68 `error path — 구조 결손(TypeError)`: callArgs null/undefined/비-배열·seeds null/비-배열)은 `.toThrow(TypeError)` / 라벨 regex 만 assert 하고 **spy 부재**임을 확인. spec 이 delegate `buildRealDataCollectInput` 를 **import 조차 안 함**을 확인(grep: spyOn 0 / toHaveBeenCalled 0 / toHaveBeenCalledTimes(0) 0 / invocationCallOrder 0). 기존 happy-path 블록(L39~)·flow/branch 블록(L118~ 구조 vs 값 정합 위반 분리)·negative 블록(L180~)·비변형/순수성 블록(L271~) 은 유지 — **새 describe 블록으로 구조-선행성만 추가**. spy target 은 seed-collect-input 모듈의 `buildRealDataCollectInput` — 신규 `import * as seedCollectInputModule from "./realdata-e2e-seed-collect-input"` namespace import 후 `jest.spyOn(seedCollectInputModule, "buildRealDataCollectInput")`. 새 describe 블록의 `afterEach` 에 `jest.restoreAllMocks()` 를 두어 신규 spyOn 격리 보장(기존 블록이 실 delegate 를 재유도에 쓰므로 leak 방지 필수). happy-path delegate-1-call test 는 spy 가 실 구현을 call-through(`jest.spyOn` 기본 동작 — mockImplementation 미지정) 하도록 두어 재유도 정합이 성립하게 한다. 정상 fixture(happy path 블록 L39~ 의 정합 SEEDS/SINGLE 를 `buildConsistent` 로 합성)를 재사용.
- `docs/tasks/T-1080-run-plan-struct-precedence.md` — 본 축 leg 15(패턴 precedent, 단일 delegate). 동일 패턴(구조 결손 → 재유도 delegate 0-call spy + 구조 vs 값 경계 대조)을 mirror 하되, 본 leg 는 (a) delegate 가 **1개**(`buildRealDataCollectInput`)이고, (b) 구조 검사와 재유도 **사이에 RangeError 분기가 없어** 값-boundary 대조를 재유도-후 RangeError(길이·person drift·since·assessmentId 중 아무거나) 로 바로 쓸 수 있으며, (c) 구조 결손 대표 분기에 **callArgs 원소 비-object(type mismatch)** 분기가 추가된다(run-plan 엔 없던 원소-차원 결손 — assertCallArgsStructure 의 loop 검사). spec 이 delegate 를 **아직 import 조차 안 함**도 차이점(run-plan spec 은 value import 는 있었음).

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `callArgs`/`seeds` 입력(SEEDS 를 `buildConsistent` 로 합성)에서 가드가 void 반환하고, `buildRealDataCollectInput` spy 가 정확히 1회 호출됨을 재확인 — 구조 검사(assertCallArgsStructure·assertSeedsStructure)가 통과한 뒤에 delegate 가 호출되는 정상 도달 경로. delegate call 이 1회이고 happy 결과 void 임을 확인(가능하면 spy 가 정확히 `seeds` 인자로 호출됨도 함께 못박는다). spy 는 실 구현 call-through 로 두어 재유도 정합이 성립하게 한다.
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`callArgs` null, `callArgs` undefined, `callArgs` 비-배열(object), `callArgs` 원소 비-object(예: `[42]` 또는 `[null]`), `seeds` null, `seeds` 비-배열(string))에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`buildRealDataCollectInput` spy 가 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 person 매퍼 재유도보다 먼저 수행(선행 차단)됨을 delegate spy 로 못박는다(기존 spec 은 구조 error-path 에서 delegate 호출 횟수 미검증 → 본 leg 가 신설 완결). (참고: callArgs 원소 비-object case 는 callArgs 자체는 배열이라 assertCallArgsStructure 의 loop 원소 검사에서 TypeError — 이 역시 재유도 전이므로 delegate 0-call.)
- [ ] **flow/branch cover**: 구조 검사 분기(callArgs 배열 여부 / callArgs 원소 object 여부 / seeds 배열 여부) 각각에 대해 위 "TypeError + delegate 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음). callArgs null 과 undefined 는 별 case 로 분리.
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 비-배열 · 원소 비-object · type mismatch)을 callArgs/callArgs-원소/seeds 각 구성요소에 대표 negative 로 배치하고, 추가로 **값 정합 위반(RangeError)은 구조 검사를 통과해 person 매퍼 재유도가 호출된 뒤 발생**함(즉 길이 불일치·person drift·since 위반·assessmentId 위반 중 어느 RangeError 경로든 `buildRealDataCollectInput` spy 가 1회 call)을 대조 테스트로 1+ 추가 — 재유도 **후** RangeError(예: 길이 불일치 L194 또는 person drift L207)를 사용해 delegate 1-call 을 확인. 구조(TypeError, delegate 0-call) vs 값(재유도-후 RangeError, delegate 1-call) 경계를 선행성 관점에서 명확화. (참고: 본 가드는 run-plan T-1080 과 같이 구조 검사와 재유도 사이 RangeError 분기가 없으므로 모든 RangeError 가 delegate 호출을 수반한다.)
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` 값이 기존(0)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 대표 분기 전량(callArgs null/undefined · callArgs 비-배열 · callArgs 원소 비-object · seeds null · seeds 비-배열)에 delegate `buildRealDataCollectInput` 각각 존재.
- [ ] **spy 격리 확인**: 새 describe 블록에서만 `import * as seedCollectInputModule` namespace import 로 `jest.spyOn` 하고 `afterEach(() => jest.restoreAllMocks())` 로 복원 — 기존 블록(실 delegate 를 재유도에 사용)이 spy 오염 없이 통과함을 확인.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 seed-collect-call-args **1개** 만(leg 16). 나머지 적격 잔여 가드(step-args family: evaluation-step-args · result-outcome-step-args · result-publish-step-args)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 happy-path(L39~)·구조 결손 TypeError(L68~)·flow/branch(L118~)·negative(L180~)·비변형/순수성(L271~) 블록의 삭제·재작성 — 유지하고 새 describe 로 확장 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1080 defense-in-depth 패턴의 seed-collect-call-args mirror, 단일 delegate). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 대표 분기 각 delegate 0-call spy + 재유도-후 RangeError delegate 1-call 대조 + spy 격리(namespace import + restoreAllMocks) 검증.

## Follow-ups

- (구조-선행성 sweep leg 17+) 본 leg 를 mirror 해 남은 적격 non-daily 가드를 순차 leg 화. 적격 grep(2026-07-17 실증, t0=0 ico=0): step-args family(`realdata-e2e-evaluation-step-args-consistency` · `realdata-e2e-result-outcome-step-args-consistency` · `realdata-e2e-result-publish-step-args-consistency`). 각 guard 가 재유도 delegate 모듈을 `import`(`^import \{ (parse|resolve|build)RealData`)하고 구조검사(assert*Structure/TypeError)가 재유도보다 앞서며, spec 에 그 delegate 의 `toHaveBeenCalledTimes(0)` 구조-선행성 assert 가 부재(spyOn 0회 포함)하면 적격. evaluation-step-args 를 leg 17 후보로 우선.
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
