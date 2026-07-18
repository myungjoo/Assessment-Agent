---
id: T-1119
title: realdata-e2e seed-collect-call-args consistency 가드 재유도 delegate self-wire 인자-충실도 negative payload-drift + arity봉함(1-arg) — §D 후보 2 leg22
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg22 — seed-collect-call-args-consistency 가드의 재유도 delegate self-wire happy it(L389~409)은 Times(1)+With(SEEDS)+invocationCallOrder 만 lock, negative payload-drift(not.toHaveBeenCalledWith)+arity봉함(len===1) 미lock. 진성 gap(spec not=0/len=0, calledWith=3 positive). delegate buildRealDataCollectInput 는 1-arg(seeds). T-1118(evaluation-plan 3-arg) 형제, 여긴 단일-arg 위임. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1119 — realdata-e2e seed-collect-call-args consistency 가드 재유도 delegate self-wire 인자-충실도 negative + arity봉함 (§D 후보 2 leg22)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg21([T-1098~T-1118](T-1118-evaluation-plan-guard-selfwire-argfid.md))로 진행됐다. 직전 leg21(T-1118)은 `realdata-e2e-evaluation-plan.spec.ts` 의 consistency 가드 self-wire happy it(3-arg `plan, activities, modelId`)에 negative payload-drift 2축 + arity봉함(len===3)을 lock 했다.

planner pre-check(2026-07-18, origin/main HEAD eb1aa85a — T-1118 머지 PR #1010 squash 3a39f523 이후)로 realdata-e2e argfidelity sweep 후보를 재감사한 결과, T-1118 이 남긴 Follow-ups 최우선 후보인 **`realdata-e2e-seed-collect-call-args-consistency.spec.ts` 의 재유도 delegate self-wire it 이 동형 seam** 으로 확인됐다. 본 leg22 는 sweep 을 그 sibling 으로 이어간다(닫는 leg 아님 — negative 축 미lock 잔여 spec 다수 존재, Follow-ups 참조).

pre-check(planner, origin/main HEAD eb1aa85a — grep 계측):
- **진성 잔여 gap — 재유도 delegate self-wire negative + arity 미lock**: 대상 spec `test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` 의 "구조 검사 통과(정합 callArgs/seeds) → 재유도 delegate 도달(정확히 1회, seeds 인자) 후 void" happy-path it(L389~409)은 재유도 delegate `buildRealDataCollectInput` 를 `jest.spyOn`(L393~396, `inputSpy`, delegate target `seedCollectInputModule` L21 `import * as seedCollectInputModule`) 후 `toHaveBeenCalledTimes(1)`(L406)·`toHaveBeenCalledWith(SEEDS)`(L407)·`inputSpy.mock.invocationCallOrder[0]`(L408, 도달 순번 >0)으로 lock 한다. **그러나 그 `With(SEEDS)` positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative(`not.toHaveBeenCalledWith(...)`) 대조가 전무**(spec 전체 `not.toHaveBeenCalledWith` = 0)하고, **delegate 가 정확히 1 인자(seeds)로만 호출됨(여분-인자 0)을 봉함하는 arity 축(`inputSpy.mock.calls[0].length` 대조) 도 전무**(spec 전체 길이 봉함 0)하다 → 진성 인자-충실도 gap(positive + Times + 도달순번 축만 lock, negative/arity 축 공백).
- **spec 계측 확정**: 대상 spec `jest.spyOn`=5·`toHaveBeenCalledWith`=3(L407·L426·L449, 모두 positive `inputSpy.toHaveBeenCalledWith(SEEDS)`)·`not.toHaveBeenCalledWith`=0·`toHaveBeenNthCalledWith`=0·`mock.calls[0].length`=0(길이/arity 봉함 0)·delegate=`seedCollectInputModule.buildRealDataCollectInput`. 경계 대조 it(길이 불일치 L411·person drift L429)도 delegate 1-call + positive With(SEEDS)를 lock 하지만 인자-충실도 negative/arity 축은 별개 — 본 leg 은 **happy it(구조 통과, L389~409) 한 곳** 에 negative payload-drift + arity봉함을 최초 lock.
- **위임 arity 확정**: T-1118(evaluation-plan 3-arg) 형제이나 본 delegate 는 **1-arg**(`buildRealDataCollectInput(seeds)` — 시그니처 `realdata-e2e-seed-collect-input.ts` L56~58 확정, `seeds: RealDataSeedDescriptor[]` 단일 인자)로 호출(L407). 따라서 arity봉함은 `.length).toBe(1)`.

## Required Reading

- `docs/tasks/T-1118-evaluation-plan-guard-selfwire-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg22 는 선행 leg 들이 확립한 인자-충실도 3축(canonical `toHaveBeenCalledWith` positive + 인자-축 negative payload-drift `not.toHaveBeenCalledWith` + arity봉함 `call.length`)을 **seed-collect-call-args consistency 가드의 재유도 delegate self-wire happy it** 에 적용한다. T-1118 과 동형이되 위임 인자는 `buildRealDataCollectInput(seeds)` 단일-arg. 단일-call 이므로 `toHaveBeenNthCalledWith` 순번 축은 불요(Nth 는 다중-call 전용).
- `test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` — **happy-path it "구조 검사 통과(정합 callArgs/seeds) → 재유도 delegate 도달(정확히 1회, seeds 인자) 후 void"(L389~409)의 `inputSpy`(L393~396 `jest.spyOn(seedCollectInputModule, "buildRealDataCollectInput")`)·`toHaveBeenCalledWith(SEEDS)`(L407)·`toHaveBeenCalledTimes(1)`(L406)·`invocationCallOrder[0]`(L408) 패턴, `buildConsistent`(L35~39)·`SEEDS`(L27)·`SINGLE`(L30, 단일 seed 배열 — 길이 상이 negative 대상 후보)·`import * as seedCollectInputModule`(L21)·해당 describe 의 `afterEach`/`restoreAllMocks`(L310~313) 격리만.** 파일 전량 광범위 read 금지 — happy it(L389~409)와 인접 경계 대조 it(길이 불일치 L411·person drift L429, 대조 참고용) 패턴만.
- `test/helpers/realdata-e2e-seed-collect-input.ts` — **delegate 시그니처(`buildRealDataCollectInput(seeds: RealDataSeedDescriptor[])` 단일 인자, L56~58)만.** delegate 가 정확히 1 인자로 1회 호출되고 여분 인자가 없음을 확인(이미 planner pre-check 로 확정 — L407 `With(SEEDS)` 단일 인자 전달).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-seed-collect-call-args-consistency.spec.ts`)의 happy it(구조 통과, L389~409)에 인자-충실도 negative + arity 축 assert 추가만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **negative — 인자 payload drift 대조(delegate self-wire)**: happy it(L389~409)의 `inputSpy` 에, 기존 `toHaveBeenCalledWith(SEEDS)`(L407) positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative `not.toHaveBeenCalledWith` 1+ 추가. 예: `expect(inputSpy).not.toHaveBeenCalledWith(SINGLE)`(단일 seed 배열 — 길이 상이라 deep-equal 미매칭) 형태. **주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 주입 `SEEDS` 와 다르도록 구성(예: `SINGLE` 은 길이 1 vs `SEEDS` 길이 2, deep-equal 로 우연 매칭 안 됨). `[...SEEDS]` 같은 얕은 복사본은 deep-equal 매칭되므로 negative 대상 금지.** positive `With(SEEDS)` 를 재사용 말고 인자-충실도 축 negative 로 별도 명시.
- [ ] **negative — 인자 개수/arity 봉함(delegate self-wire)**: delegate 가 정확히 1 인자(`seeds`)로만 호출됨(여분 인자 0)을 `expect(inputSpy.mock.calls[0].length).toBe(1)` 로 lock 하는 assert 1+ 추가. delegate 가 여분 인자를 함께 받지 않음을 봉함(1-arity). 기존 `With(SEEDS)` 값 대조는 인자 개수 봉함이 아니므로 별개.
- [ ] **positive 축 유지**: 기존 `toHaveBeenCalledTimes(1)`(L406)·`toHaveBeenCalledWith(SEEDS)`(L407)·`invocationCallOrder[0]`(L408)은 제거 말고 유지(횟수+positive 인자+도달순번+negative+arity 모두 공존).
- [ ] **flow / 분기 cover**: 본 leg 은 happy it(구조 통과 정상 경로, L389) 단일 경로 tighten — 새 분기 도입 0. 재유도 delegate self-wire 는 구조 통과 후 1회 호출되는 단일 경로라 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (인접 경계 대조 it(길이 불일치 L411·person drift L429)은 별개 경계 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c "not.toHaveBeenCalledWith" test/helpers/realdata-e2e-seed-collect-call-args-consistency.spec.ts` ≥ 1(본 leg 이 seed-collect-call-args consistency 재유도 delegate self-wire negative payload-drift 축을 최초 lock — audit 후보 2 leg22).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy·error path·flow/branch·negative·순수성·선행성 order-lock it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-seed-collect-call-args-consistency.ts`·`realdata-e2e-seed-collect-input.ts`·`realdata-e2e-seed-collect-call-args.ts` 등) 변경 금지** — test-only assert 추가. 가드/delegate 시그니처 변경·리팩터 금지.
- **경계 대조 it(길이 불일치 L411·person drift L429)** — 이미 delegate 1-call + positive With(SEEDS) lock. 본 leg 은 negative/arity 축을 그 두 it 이 아닌 **happy it(구조 통과, L389) 한 곳** 에만 추가(중복 방지). 두 경계 it 재편집·중복 negative 금지.
- **구조 결손 6 분기 0-call order-lock it(L363~387)·상단 error-path(L71~119)·flow/branch(L121~181)·negative ①~⑥(L183~272)·순수성(L274~291)** — 별개 seam(0-call 못박기 / throw 전파 / 순수성). 기존 assert 제거·변경 금지.
- **`toHaveBeenNthCalledWith` 순번 축 도입 금지** — 재유도 delegate self-wire 는 happy it 에서 단일-call(1회 호출)이라 Nth 순번 축 무의미. negative payload-drift + arity 축만.
- **seed-collect-call-args(비-consistency)/evaluation-step-args/result-outcome-step-args/result-publish-step-args/scoring-call-args/pipeline-plan 등 sibling 자체 spec 의 negative 축** — 별개 파일, 별개 leg(Follow-ups 참조). 본 leg 은 `realdata-e2e-seed-collect-call-args-consistency.spec.ts` **한 파일** 만.
- 새 컴포저/가드/helper 신설 — 기존 `seedCollectInputModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 단일-call 위임 negative+arity 축 확장, 선행 leg 패턴 그대로). implementer 는 happy it(L389~409)의 `inputSpy` 인프라를 재사용해 `not.toHaveBeenCalledWith`(payload drift, 대상 `SINGLE`) + `inputSpy.mock.calls[0].length === 1`(arity봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg22 가 seed-collect-call-args consistency 재유도 delegate self-wire negative+arity 를 lock 하면, 다음 pre-check 로 `toHaveBeenCalledWith`>0 이지만 `not.toHaveBeenCalledWith`=0(negative payload-drift 미lock) 인 잔여 consistency/args spec — pre-check 스캔 확인분: `realdata-e2e-seed-collect-call-args.spec.ts`(spyOn 4·calledWith 3·not 0)·`realdata-e2e-seed-collect-input.spec.ts`(spyOn 5·calledWith 3·not 0)·`realdata-e2e-scoring-call-args.spec.ts`(spyOn 5·calledWith 3·not 0)·`realdata-e2e-evaluation-inputs.spec.ts`(spyOn 4·calledWith 3·not 0)·`realdata-e2e-result-outcome-step-args-consistency.spec.ts`(spyOn 4·calledWith 3·not 0)·`realdata-e2e-daily-step-collect-command-plan.spec.ts`(spyOn 3·calledWith 3·not 0)·`realdata-e2e-daily-step-eval-command-plan.spec.ts`(spyOn 3·calledWith 3·not 0) 등 — 중 delegate spyOn 을 실제로 쓰는(pure-value 대조 아닌) 곳을 우선순위로 leg23+ 계속. 본 spec 의 경계 대조 it(길이 불일치·person drift)도 동형 negative 미lock — 필요 시 별도 leg 로 완결(중복 회피 위해 본 leg 은 happy it 한 곳만). negative 축이 전 spec 소진되면 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 §D candidate / PLAN bullet 로 전환.
