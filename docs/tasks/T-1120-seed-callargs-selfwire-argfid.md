---
id: T-1120
title: realdata-e2e seed-collect-call-args 가드 self-wire 재유도 delegate 인자-충실도 negative payload-drift + arity봉함(2-arg) — §D 후보 2 leg23
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-call-args.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg23 — seed-collect-call-args 가드 self-wire happy it(L255~271)은 Times(1)+With(result,seeds)+calls[0][0/1] toBe 만 lock, negative payload-drift(not.toHaveBeenCalledWith)+arity봉함(len===2) 미lock. 진성 gap(spec not=0/len=0, calledWith=3 positive). delegate assertRealDataCollectCallArgsConsistentWithSources 는 2-arg(result, seeds). T-1119(1-arg) 형제, 여긴 2-arg 위임. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1120 — realdata-e2e seed-collect-call-args 가드 self-wire 재유도 delegate 인자-충실도 negative + arity봉함 (§D 후보 2 leg23)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg22([T-1098~T-1119](T-1119-seed-collect-call-args-consistency-selfwire-argfid.md))로 진행됐다. 직전 leg22(T-1119)는 `realdata-e2e-seed-collect-call-args-consistency.spec.ts` 의 재유도 delegate self-wire happy it(1-arg `buildRealDataCollectInput(seeds)`)에 negative payload-drift + arity봉함(len===1)을 lock 했다.

planner pre-check(2026-07-18, origin/main HEAD b7e78ef1 — T-1119 머지 PR #1011 squash 0b50c49f 이후)로 realdata-e2e argfidelity sweep 후보를 재감사한 결과, T-1119 이 남긴 Follow-ups 최우선 후보인 **`realdata-e2e-seed-collect-call-args.spec.ts` 의 consistency 가드 self-wire happy it 이 동형 seam**(delegate spyOn 실사용, negative/arity 미lock)으로 확인됐다. 본 leg23 은 sweep 을 그 sibling 으로 이어간다(닫는 leg 아님 — negative 축 미lock 잔여 spec 다수 존재, Follow-ups 참조).

pre-check(planner, origin/main HEAD b7e78ef1 — grep 계측):
- **진성 잔여 gap — 가드 self-wire negative + arity 미lock**: 대상 spec `test/helpers/realdata-e2e-seed-collect-call-args.spec.ts` 의 "정상 합성(다수 seed) → 가드가 (산출 callArgs, seeds) 인자로 정확히 1회 호출됨" happy-path self-wire it(L255~271)은 delegate `consistency.assertRealDataCollectCallArgsConsistentWithSources` 를 `jest.spyOn`(L256~259, `spy`, delegate target `consistency` L18 `import * as consistency`) 후 `toHaveBeenCalledTimes(1)`(L265)·`toHaveBeenCalledWith(result, seeds)`(L267)·`spy.mock.calls[0][0]).toBe(result)`(L269)·`spy.mock.calls[0][1]).toBe(seeds)`(L270)로 lock 한다. **그러나 그 `With(result, seeds)` positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative(`not.toHaveBeenCalledWith(...)`) 대조가 전무**(spec 전체 `not.toHaveBeenCalledWith` = 0)하고, **delegate 가 정확히 2 인자(`result`, `seeds`)로만 호출됨(여분-인자 0)을 봉함하는 arity 축(`spy.mock.calls[0].length` 대조) 도 전무**(spec 전체 길이 봉함 0)하다 → 진성 인자-충실도 gap(positive + Times + 인자 참조-동일성 축만 lock, negative/arity 축 공백).
- **spec 계측 확정**: 대상 spec `jest.spyOn`=4·`toHaveBeenCalledWith`=3(L267·L283·L296, 모두 positive `spy.toHaveBeenCalledWith(result, seeds|empty)`)·`not.toHaveBeenCalledWith`=0·`toHaveBeenNthCalledWith`=0·`mock.calls[0].length`=0(길이/arity 봉함 0)·delegate=`consistency.assertRealDataCollectCallArgsConsistentWithSources`. 인접 분기 it(단일 seed L273·빈 seeds 경계 L286)도 delegate 1-call + positive With 를 lock 하지만 인자-충실도 negative/arity 축은 별개 — 본 leg 은 **happy it(정상 합성 다수 seed, L255~271) 한 곳** 에 negative payload-drift + arity봉함을 최초 lock.
- **위임 arity 확정**: T-1119(seed-collect-input 1-arg) 형제이나 본 delegate 는 **2-arg**(`assertRealDataCollectCallArgsConsistentWithSources(result, seeds)` — L267 `With(result, seeds)`, `calls[0][0]`=산출 callArgs·`calls[0][1]`=seeds 확정)로 호출. 따라서 arity봉함은 `.length).toBe(2)`.

## Required Reading

- `docs/tasks/T-1119-seed-collect-call-args-consistency-selfwire-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg23 은 선행 leg 들이 확립한 인자-충실도 3축(canonical `toHaveBeenCalledWith` positive + 인자-축 negative payload-drift `not.toHaveBeenCalledWith` + arity봉함 `call.length`)을 **seed-collect-call-args 가드 self-wire happy it** 에 적용한다. T-1119 과 동형이되 위임 인자는 `assertRealDataCollectCallArgsConsistentWithSources(result, seeds)` **2-arg**. 단일-call 이므로 `toHaveBeenNthCalledWith` 순번 축은 불요(Nth 는 다중-call 전용).
- `test/helpers/realdata-e2e-seed-collect-call-args.spec.ts` — **happy-path self-wire it "정상 합성(다수 seed) → 가드가 (산출 callArgs, seeds) 인자로 정확히 1회 호출됨"(L255~271)의 `spy`(L256~259 `jest.spyOn(consistency, "assertRealDataCollectCallArgsConsistentWithSources")`)·`toHaveBeenCalledWith(result, seeds)`(L267)·`toHaveBeenCalledTimes(1)`(L265)·`calls[0][0]).toBe(result)`(L269)·`calls[0][1]).toBe(seeds)`(L270) 패턴, `buildRealDataCollectCallArgs`·`buildRealDataE2eSeed`(L260)·`MULTI_IDENTITY_DESCRIPTOR`(L278, 단일 descriptor — 길이 상이 negative 대상 후보)·`import * as consistency`(L18)·해당 describe 의 `afterEach`/`restoreAllMocks`(L251~253) 격리만.** 파일 전량 광범위 read 금지 — happy it(L255~271)와 인접 분기 it(단일 seed L273·빈 seeds L286, 대조 참고용) 패턴만.
- (선택) delegate 시그니처는 이미 pre-check 로 확정(`assertRealDataCollectCallArgsConsistentWithSources(callArgs, seeds)` 2-arg, L267 `With(result, seeds)` 로 정확히 2 인자 전달). 소스 read 불요 — negative/arity assert 는 spec 내 값(`result`, `seeds`)만 사용.

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-seed-collect-call-args.spec.ts`)의 happy it(정상 합성 다수 seed, L255~271)에 인자-충실도 negative + arity 축 assert 추가만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **negative — 인자 payload drift 대조(가드 self-wire)**: happy it(L255~271)의 `spy` 에, 기존 `toHaveBeenCalledWith(result, seeds)`(L267) positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative `not.toHaveBeenCalledWith` 1+ 추가. 예: `expect(spy).not.toHaveBeenCalledWith(seeds, result)`(인자 순서 뒤바뀜 — callArgs↔seeds 구조 상이라 deep-equal 미매칭) 또는 `expect(spy).not.toHaveBeenCalledWith(result, [])`(seeds 공배열 drift) 형태. **주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 주입 `(result, seeds)` 와 다르도록 구성(순서 뒤바뀜 또는 공배열). `(result, [...seeds])` 같은 얕은 복사본은 deep-equal 매칭되므로 negative 대상 금지.** positive `With(result, seeds)` 를 재사용 말고 인자-충실도 축 negative 로 별도 명시.
- [ ] **negative — 인자 개수/arity 봉함(가드 self-wire)**: delegate 가 정확히 2 인자(`result`, `seeds`)로만 호출됨(여분 인자 0)을 `expect(spy.mock.calls[0].length).toBe(2)` 로 lock 하는 assert 1+ 추가. delegate 가 여분 인자를 함께 받지 않음을 봉함(2-arity). 기존 `With(result, seeds)` 값 대조·`calls[0][0/1]).toBe` 참조 대조는 인자 개수 봉함이 아니므로 별개.
- [ ] **positive 축 유지**: 기존 `toHaveBeenCalledTimes(1)`(L265)·`toHaveBeenCalledWith(result, seeds)`(L267)·`calls[0][0]).toBe(result)`(L269)·`calls[0][1]).toBe(seeds)`(L270)은 제거 말고 유지(횟수+positive 인자+참조-동일성+negative+arity 모두 공존).
- [ ] **flow / 분기 cover**: 본 leg 은 happy it(정상 합성 정상 경로, L255) 단일 경로 tighten — 새 분기 도입 0. 가드 self-wire 는 정상 합성 후 1회 호출되는 단일 경로라 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (인접 분기 it(단일 seed L273·빈 seeds L286)은 별개 분기 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c "not.toHaveBeenCalledWith" test/helpers/realdata-e2e-seed-collect-call-args.spec.ts` ≥ 1(본 leg 이 seed-collect-call-args 가드 self-wire negative payload-drift 축을 최초 lock — audit 후보 2 leg23).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy·분기·negative·불변·전파 it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-seed-collect-call-args.ts`·`realdata-e2e-seed-collect-call-args-consistency.ts`·`realdata-e2e-seed-collect-input.ts` 등) 변경 금지** — test-only assert 추가. 가드/delegate 시그니처 변경·리팩터 금지.
- **인접 분기 it(단일 seed L273·빈 seeds 경계 L286)** — 이미 delegate 1-call + positive With lock. 본 leg 은 negative/arity 축을 그 두 it 이 아닌 **happy it(정상 합성 다수 seed, L255) 한 곳** 에만 추가(중복 방지). 두 분기 it 재편집·중복 negative 금지.
- **byte-identical 불변 it(L301~332)·위임 매퍼 throw 전파 negative it(L334~)·상단 error-path/flow/branch/순수성 it** — 별개 seam(불변 / throw 전파 / 순수성). 기존 assert 제거·변경 금지.
- **`toHaveBeenNthCalledWith` 순번 축 도입 금지** — 가드 self-wire 는 happy it 에서 단일-call(1회 호출)이라 Nth 순번 축 무의미. negative payload-drift + arity 축만.
- **seed-collect-input/scoring-call-args/evaluation-inputs/result-outcome-step-args-consistency/daily-step-collect-command-plan/daily-step-eval-command-plan 등 sibling 자체 spec 의 negative 축** — 별개 파일, 별개 leg(Follow-ups 참조). 본 leg 은 `realdata-e2e-seed-collect-call-args.spec.ts` **한 파일** 만.
- 새 컴포저/가드/helper 신설 — 기존 `consistency` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 2-arg 위임 negative+arity 축 확장, 선행 leg 패턴 그대로). implementer 는 happy it(L255~271)의 `spy` 인프라를 재사용해 `not.toHaveBeenCalledWith`(payload drift, 순서 뒤바뀜 또는 공배열) + `spy.mock.calls[0].length === 2`(arity봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg23 가 seed-collect-call-args 가드 self-wire negative+arity 를 lock 하면, 다음 pre-check 로 `toHaveBeenCalledWith`>0 이지만 `not.toHaveBeenCalledWith`=0(negative payload-drift 미lock) 인 잔여 args/consistency spec — pre-check 스캔 확인분: `realdata-e2e-seed-collect-input.spec.ts`(spyOn 5·calledWith 3·not 0)·`realdata-e2e-scoring-call-args.spec.ts`(spyOn 5·calledWith 3·not 0)·`realdata-e2e-evaluation-inputs.spec.ts`(spyOn 4·calledWith 3·not 0)·`realdata-e2e-result-outcome-step-args-consistency.spec.ts`(spyOn 4·calledWith 3·not 0)·`realdata-e2e-daily-step-collect-command-plan.spec.ts`(spyOn 3·calledWith 3·not 0)·`realdata-e2e-daily-step-eval-command-plan.spec.ts`(spyOn 3·calledWith 3·not 0) 등 — 중 delegate spyOn 을 실제로 쓰는(pure-value 대조 아닌) 곳을 우선순위로 leg24+ 계속. negative 축이 전 spec 소진되면 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 §D candidate / PLAN bullet 로 전환.
