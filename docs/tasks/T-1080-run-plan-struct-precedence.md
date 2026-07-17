---
id: T-1080
title: realdata-e2e run-plan consistency-guard 구조-검사 선행성 order-lock — 구조 결손(TypeError)이 pipeline 재유도 위임(buildRealDataPipelinePlan)보다 먼저 수행됨을 delegate 0-call spy 로 못박는 defense-in-depth (구조-guard 선행성 sweep leg 15, T-1079 Follow-up)
phase: P5
status: DONE
commitMode: pr
prNumber: 973
mergedAs: 232e6fdf
completedAt: 2026-07-17T12:52:00Z
coversReq: [REQ-032, REQ-059]
estimatedDiff: 160
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-run-plan-consistency.spec.ts
independentStream: realdata-e2e-structure-precedence-sweep
plannerNote: "P5 구조-guard 선행성 sweep leg 15 — pipeline-plan(leg 14, T-1079) 소진 후 T-1079 Follow-up 이 우선 후보로 지목한 run-plan consistency 가드(최외곽 컴포저 seam, 단일 재유도 delegate=buildRealDataPipelinePlan). pre-check 실증(grep+read, 2026-07-17, HEAD 15d3407f=T-1079 머지 포함): 가드가 2 구조 assert(assertRunPlanStructure L195 / assertSourcesStructure L196)를 pipeline 재유도 위임(buildRealDataPipelinePlan L202)보다 먼저 수행하나, spec(467줄)은 delegate 를 spyOn 조차 안 하고(spyOn/toHaveBeenCalled/toHaveBeenCalledTimes(0)/invocationCallOrder 전부 0회) 구조 error-path(L246 null/undefined · L282 type 위반)는 .toThrow(TypeError) 만. 구조 결손 시 delegate 0-call 미검증 = gap. 구조와 delegate 사이 RangeError 없음(pipeline drift L206 / run drift L214 전부 재유도 후). pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b."
---

# T-1080 — run-plan 구조-검사 선행성 order-lock

## Why

P5 test-hardening 의 realdata-e2e 구조-guard 선행성 sweep(T-1065 §D 후보 (a))은 leg 1 result-report-plan(T-1066) → … → leg 14 pipeline-plan(T-1079)으로 이어졌다. T-1079 Follow-up 이 **우선 후보**로 지목한 run-plan consistency 가드를 leg 15 로 삼는다(최외곽 컴포저 seam — 가장 바깥 진입점). 이 가드 `assertRealDataE2eRunPlanConsistentWithSources`(`test/helpers/realdata-e2e-run-plan-consistency.ts`)는 실 평가 e2e build-time chain 의 **최외곽 단일 진입점** `buildRealDataE2eRunPlan(seeds, modelId, run)` 의 산출 `{ pipeline, run }`(`RealDataE2eRunPlan`) 을 single source `(seeds, modelId, run)` 로 재유도해 대조하는 seam 무결성 가드다(pipeline 측 위임 `buildRealDataPipelinePlan(seeds, modelId)` 재유도 + run 직접 대조; README.md 109행 step ① 실 평가 e2e build-time chain 의 최외곽 run-plan-seam 무결성 / REQ-032·REQ-059). 앞선 pipeline-plan leg(T-1079)와 동형이며 재유도 delegate 는 **1개**(`buildRealDataPipelinePlan`).

planner pre-check(실 grep + read, 2026-07-17, HEAD 15d3407f = T-1079 머지 포함)로 확인한 gap: 이 가드는 본문에서 **2 구조 assert**(`assertRunPlanStructure(runPlan)` L195 — runPlan null/undefined → TypeError, `runPlan.pipeline`/`runPlan.run` 비-object → TypeError; `assertSourcesStructure(seeds, modelId, run)` L196 — seeds 비-배열 / modelId 비-string / run 비-object → TypeError)를 **pipeline 재유도 위임**(`buildRealDataPipelinePlan(seeds, modelId)` L202)보다 **먼저** 수행한다(구조검사 L195~196 < 재유도 L202). pipeline-plan(T-1079)과 마찬가지로 구조 검사와 재유도 **사이에 RangeError 분기가 없다** — 값 정합 위반 RangeError(pipeline drift L206 / run drift L214)는 전부 재유도 **뒤**에 온다. 그러나 대응 spec(총 467 line)은 delegate `buildRealDataPipelinePlan` 를 value 로 import 하되(L18 — drift fixture 재유도용) `spyOn`·`toHaveBeenCalled`·`toHaveBeenCalledTimes(0)`·`invocationCallOrder` 가 **0회** 다 — 구조 error-path 블록(L246 `구조 결손 — null/undefined → TypeError`, L282 `구성요소 type 위반 → TypeError`)은 `.toThrow(TypeError)` 만 assert 하고 delegate 호출 횟수를 못박지 않는다. 즉 **구조 결손 입력을 주면 pipeline 재유도 delegate 가 `toHaveBeenCalledTimes(0)` 이어야 한다는 선행성**이 spy 로 못박혀 있지 않다. 이를 구조 결손 대표 분기(runPlan null·runPlan undefined·pipeline 비-object·run 비-object·seeds 비-배열·modelId 비-string·run(인자) 비-object)에 delegate `toHaveBeenCalledTimes(0)` 으로 못박아 "구조 검사 → 값 재유도" 순서를 silent 재정렬(예: 리팩터가 pipeline 재유도를 구조 검사 위로 끌어올림)로부터 방어한다(T-1066~T-1079 와 동형 defense-in-depth, delegate 1개). test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-run-plan-consistency.ts` — 대상 가드. 메인 함수 `assertRealDataE2eRunPlanConsistentWithSources`(L187~) 본문의 2 구조 assert(`assertRunPlanStructure` L195 / `assertSourcesStructure` L196)가 pipeline 재유도 위임(`buildRealDataPipelinePlan(seeds, modelId)` L202)보다 앞섬을 확인(구조검사 L195~196 < 재유도 L202). 각 구조 assert 함수 본문(assertRunPlanStructure L87~105 → runPlan null/undefined·pipeline/run 비-object TypeError / assertSourcesStructure L111~131 → seeds 비-배열·modelId 비-string·run 비-object TypeError)의 TypeError 분기를 확인. 값 정합 위반 RangeError(pipeline drift L206 / run drift L214)는 재유도 **뒤**에 위치함을 확인(구조 검사와 재유도 사이 RangeError 분기 없음 — pipeline-plan T-1079 와 동일 단순 구조). delegate import 라인(L60 `import { buildRealDataPipelinePlan } from "./realdata-e2e-pipeline-plan"`) 확인. **광범위 read 금지 — 해당 함수 + 2 구조 assert 본문 + import 라인만.**
- `test/helpers/realdata-e2e-run-plan-consistency.spec.ts` — colocated spec(추가 대상, 신규 파일 아님, 총 467줄). 기존 구조 error-path 블록(L246 `구조 결손 — null/undefined → TypeError`: runPlan null/undefined; L282 `구성요소 type 위반 → TypeError`: pipeline 비-object(null)·run 비-object(null)·seeds 비-배열(object)·modelId 비-string(number)·run(인자) 비-object(null/array))은 `.toThrow(TypeError)` 만 assert 하고 **spy 부재**임을 확인. spec 이 delegate `buildRealDataPipelinePlan` 를 value 로 import 하나(L18) `spyOn` 0회임을 확인(grep: spyOn 0 / toHaveBeenCalled 0 / toHaveBeenCalledTimes(0) 0 / invocationCallOrder 0). 기존 happy-path 블록(L54~)·값 정합 위반 RangeError 블록(L125~)·재유도 위임 throw 전파 블록(L366~)·결정성/비변형 블록(L404~) 은 유지 — **새 describe 블록으로 구조-선행성만 추가**. spy target 은 pipeline-plan 모듈의 `buildRealDataPipelinePlan` — 신규 `import * as pipelinePlanModule from "./realdata-e2e-pipeline-plan"` namespace import 후 `jest.spyOn(pipelinePlanModule, "buildRealDataPipelinePlan")`. 새 describe 블록의 `afterEach` 에 `jest.restoreAllMocks()` 를 두어 신규 spyOn 격리 보장(기존 블록이 value import 로 실 delegate 를 fixture 재유도에 쓰므로 leak 방지 필수). happy-path delegate-1-call test 는 spy 가 실 구현을 call-through(`jest.spyOn` 기본 동작 — mockImplementation 미지정) 하도록 두어 재유도 정합이 성립하게 한다. 정상 fixture(happy path 블록 L54~ 의 정합 runPlan·seeds·modelId·run)를 재사용.
- `docs/tasks/T-1079-pipeline-plan-struct-precedence.md` — 본 축 leg 14(패턴 precedent, 단일 delegate). 동일 패턴(구조 결손 → 재유도 delegate 0-call spy + 구조 vs 값 경계 대조)을 mirror 하되, 본 leg 는 (a) delegate 가 **1개**(`buildRealDataPipelinePlan`)이고, (b) 구조 검사와 재유도 **사이에 RangeError 분기가 없어** 값-boundary 대조를 재유도-후 RangeError(pipeline drift 또는 run drift) 로 바로 쓸 수 있으며, (c) 검증 대상이 `{ pipeline, run }` 2 구성요소 컨테이너라 구조 결손 대표 분기에 pipeline/run object 결손 + run(인자) object 결손이 추가된다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 추가하는 spy-기반 선행성 테스트 자체의 완결성).

- [ ] **happy-path(선행성 정상 흐름)**: 정합 `runPlan`/`seeds`/`modelId`/`run` 입력에서 가드가 void 반환하고, `buildRealDataPipelinePlan` spy 가 정확히 1회 호출됨을 재확인 — 구조 검사(assertRunPlanStructure·assertSourcesStructure)가 통과한 뒤에 delegate 가 호출되는 정상 도달 경로. delegate call 이 1회이고 happy 결과 void 임을 확인(가능하면 spy 가 정확히 `seeds, modelId` 인자로 호출됨도 함께 못박는다). spy 는 실 구현 call-through 로 두어 재유도 정합이 성립하게 한다.
- [ ] **error path — 구조-선행성 fail-fast(핵심)**: 구조 결손 입력 각각(`runPlan` null, `runPlan` undefined, `runPlan.pipeline` 비-object(null), `runPlan.run` 비-object(null), `seeds` 비-배열(object), `modelId` 비-string(number), `run`(인자) 비-object(null))에서 가드가 `TypeError`(한국어 라벨) throw 하고 **`buildRealDataPipelinePlan` spy 가 `toHaveBeenCalledTimes(0)`** 임을 assert — 구조 검사가 pipeline 재유도보다 먼저 수행(선행 차단)됨을 delegate spy 로 못박는다(기존 spec 은 구조 error-path 에서 delegate 호출 횟수 미검증 → 본 leg 가 신설 완결).
- [ ] **flow/branch cover**: 구조 검사 분기(runPlan 존재 / pipeline object 여부 / run object 여부 / seeds 배열 여부 / modelId string 여부 / run(인자) object 여부) 각각에 대해 위 "TypeError + delegate 0-call" 테스트 1+ 로 분기 분리(단일 negative 로 묶지 않음). runPlan null 과 undefined 는 별 case 로 분리.
- [ ] **negative cases 충분 cover**: 구조 결손 유형별(null · undefined · 비-object · 비-배열 · 비-string · type mismatch)을 runPlan/pipeline/run/seeds/modelId/run(인자) 각 구성요소에 대표 negative 로 배치하고, 추가로 **값 정합 위반(RangeError)은 구조 검사를 통과해 pipeline 재유도가 호출된 뒤 발생**함(즉 pipeline drift 든 run drift 든 RangeError 경로에서는 `buildRealDataPipelinePlan` spy 가 1회 call)을 대조 테스트로 1+ 추가 — 재유도 **후** RangeError(pipeline drift L206 또는 run drift L214)를 사용해 delegate 1-call 을 확인. 구조(TypeError, delegate 0-call) vs 값(재유도-후 RangeError, delegate 1-call) 경계를 선행성 관점에서 명확화. (참고: 본 가드는 pipeline-plan T-1079 와 같이 구조 검사와 재유도 사이 RangeError 분기가 없으므로 모든 RangeError 가 delegate 호출을 수반한다 — pipeline drift 와 run drift 둘 다 재유도 후.)
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 test 추가만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c "toHaveBeenCalledTimes(0)" test/helpers/realdata-e2e-run-plan-consistency.spec.ts` 값이 기존(0)보다 증가하고, 새 describe 블록에 구조-선행성 spy assert(`toHaveBeenCalledTimes(0)`)가 구조 결손 대표 분기 전량(runPlan null/undefined · pipeline 비-object · run 비-object · seeds 비-배열 · modelId 비-string · run(인자) 비-object)에 delegate `buildRealDataPipelinePlan` 각각 존재.
- [ ] **spy 격리 확인**: 새 describe 블록에서만 `import * as pipelinePlanModule` namespace import 로 `jest.spyOn` 하고 `afterEach(() => jest.restoreAllMocks())` 로 복원 — 기존 블록(value import 로 실 delegate 를 fixture 재유도에 사용)이 spy 오염 없이 통과함을 확인.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 추가 변경(≤300 LOC diff / 1파일).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 구조-선행성 order-lock — 본 leg 는 run-plan **1개** 만(leg 15). 나머지 적격 잔여 가드(seed-collect-call-args · step-args family: evaluation-step-args · result-outcome-step-args · result-publish-step-args)는 후속 leg 로 mirror(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(구조 검사 순서 재배치·에러 메시지 수정 등) — 코드 무변경, spec 추가만.
- 기존 happy-path(L54~)·값 정합 위반 RangeError(L125~)·구조 결손 TypeError(L246·L282)·재유도 위임 throw 전파(L366~)·결정성/비변형(L404~) 블록의 삭제·재작성 — 유지하고 새 describe 로 확장 추가만.
- T-1065 §D 후보 (b) call-count exactly-once 완결성·(c) e2e 흐름 커버리지 — 별도 후속 leg.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1066~T-1079 defense-in-depth 패턴의 run-plan mirror, 단일 delegate). tester 는 R-112 test 4종 + coverage 무회귀 + 구조 위반 대표 분기 각 delegate 0-call spy + 재유도-후 RangeError delegate 1-call 대조 + spy 격리(namespace import + restoreAllMocks) 검증.

## Follow-ups

- (구조-선행성 sweep leg 16+) 본 leg 를 mirror 해 남은 적격 non-daily 가드를 순차 leg 화. 적격 grep(2026-07-17 실증, t0=0 ico=0): `realdata-e2e-seed-collect-call-args-consistency` · step-args family(`realdata-e2e-evaluation-step-args-consistency` · `realdata-e2e-result-outcome-step-args-consistency` · `realdata-e2e-result-publish-step-args-consistency`). 각 guard 가 재유도 delegate 모듈을 `import`(`^import \{ (parse|resolve|build)RealData`)하고 구조검사(assert*Structure/TypeError)가 재유도보다 앞서며, spec 에 그 delegate 의 `toHaveBeenCalledTimes(0)` 구조-선행성 assert 가 부재(spyOn 0회 포함)하면 적격. seed-collect-call-args 를 leg 16 후보로 우선(step-args family 의 재유도 source).
- 구조-선행성 축이 소진되면 T-1065 §D 후보 (b) call-count exactly-once 완결성 감사로 전환.
