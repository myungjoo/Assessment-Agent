---
id: T-1116
title: realdata-e2e run-plan 컴포저 consistency 가드 self-wire 인자-충실도 negative payload-drift + arity봉함 완결 — §D 후보 2 leg19
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-run-plan.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg19 — run-plan 컴포저의 consistency 가드 self-wire happy it(L264~281)은 Times(1)+With(plan,SINGLE,MODEL_ID,RUN)+positional mock.calls[0][0..3] 만 lock, negative payload-drift(not.toHaveBeenCalledWith)+arity봉함(4-arg) 미lock. 진성 gap(spec not=0/length-arity=0). leg18(run-plan-consistency 2-arg) sibling — 여긴 4-arg 위임. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1116 — realdata-e2e run-plan 가드 self-wire 인자-충실도 negative + arity봉함 완결 (§D 후보 2 leg19)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg18([T-1098~T-1115](T-1115-run-plan-delegate-argfid.md))로 진행됐다. 직전 leg18(T-1115)은 `realdata-e2e-run-plan-consistency.spec.ts` 의 재유도 위임(2-arg `buildRealDataPipelinePlan(seeds, MODEL_ID)`)에 negative payload-drift + arity봉함을 최초 lock 했다.

planner pre-check(2026-07-18, origin/main HEAD e9af7c8a — T-1115 머지 PR #1007 squash 이후)로 realdata-e2e argfidelity sweep 후보를 재감사한 결과, leg18 의 직접 sibling 인 **`realdata-e2e-run-plan.spec.ts` 의 consistency 가드 self-wire happy it 이 동형 seam** 으로 확인됐다. 본 leg19 는 sweep 을 그 sibling 으로 이어간다(닫는 leg 아님 — negative 축 미lock 잔여 consistency/args spec 다수 존재, Follow-ups 참조).

pre-check(planner, origin/main HEAD e9af7c8a — grep 계측):
- **진성 잔여 gap — run-plan 가드 self-wire negative + arity 미lock**: 대상 spec `test/helpers/realdata-e2e-run-plan.spec.ts` 의 "정상 합성(단일 seed) → 가드가 정확히 1회 호출됨" happy-path it(L264~281)은 consistency 가드 `assertRealDataE2eRunPlanConsistentWithSources` 를 `jest.spyOn`(L265, `spy`, delegate target `consistency` 모듈 L21 `import * as consistency`) 후 `toHaveBeenCalledTimes(1)`(L273)·`toHaveBeenCalledWith(plan, SINGLE, MODEL_ID, RUN)`(L275)·positional `spy.mock.calls[0][0..3]`(L277~280, 각 `.toBe(plan/SINGLE/MODEL_ID/RUN)`)으로 lock 한다. **그러나 그 `With(...)` positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative(`not.toHaveBeenCalledWith(...)`) 대조가 전무**(spec 전체 `not.toHaveBeenCalledWith` = 0)하고, **가드가 정확히 4 인자로만 호출됨(여분-인자 0)을 봉함하는 arity 축(`spy.mock.calls[0].length` 대조) 도 전무**(spec 전체 `mock.calls[...].length` = 0 — positional index 접근만 있고 길이 봉함 없음)하다 → 진성 인자-충실도 gap(positive + positional 축만 lock, negative/arity 축 공백).
- **spec 계측 확정**: 대상 spec `jest.spyOn`=7·`toHaveBeenCalledWith`=3(happy L275 + 다수-seed L292 + 빈-seeds L305, 모두 `With(plan, <seeds>, MODEL_ID, RUN)` positive)·`not.toHaveBeenCalledWith`=0·`toHaveBeenNthCalledWith`=0·`mock.calls`=4(positional index 접근 L277~280, 길이/arity 봉함 0)·delegate=`consistency.assertRealDataE2eRunPlanConsistentWithSources`. 다수-seed(L283)·빈-seeds(L295) 대조 it 은 이미 Times(1)+positive With 를 lock 하지만 인자-충실도 negative/arity 축은 별개 — 본 leg 은 **happy it(L264~281) 한 곳** 에 negative payload-drift + arity봉함을 최초 lock.
- **위임 arity 확정**: leg17(collect 1-arg)·leg18(재유도 pipeline 2-arg)와 달리 본 가드 self-wire 는 **4-arg**(`plan`, `SINGLE`, `MODEL_ID`, `RUN`)로 호출(L275·L270 `buildRealDataE2eRunPlan(SINGLE, MODEL_ID, RUN)` 반환 직전 self-assert 배선). 따라서 arity봉함은 `.length).toBe(4)` — leg17/leg18 과 구분되는 별개 seam.

## Required Reading

- `docs/tasks/T-1115-run-plan-delegate-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg19 는 선행 leg 들이 확립한 인자-충실도 3축(canonical `toHaveBeenCalledWith` positive + 인자-축 negative payload-drift `not.toHaveBeenCalledWith` + arity봉함 `call.length`)을 **run-plan 가드 self-wire happy it** 에 적용한다. leg18 과 동형이되 위임 arity 만 4(plan, seeds, MODEL_ID, RUN)로 다름. 단일-call 이므로 `toHaveBeenNthCalledWith` 순번 축은 불요(Nth 는 다중-call 전용).
- `test/helpers/realdata-e2e-run-plan.spec.ts` — **happy-path it "정상 합성(단일 seed) → 가드가 정확히 1회 호출됨"(L264~281)의 `spy`(L265 `jest.spyOn(consistency, "assertRealDataE2eRunPlanConsistentWithSources")`)·`toHaveBeenCalledWith(plan, SINGLE, MODEL_ID, RUN)`(L275)·positional `spy.mock.calls[0][0..3]`(L277~280) 패턴, `SINGLE`·`MULTIPLE`·`MODEL_ID`·`RUN`·`RealDataSeedDescriptor`·`buildRealDataE2eRunPlan`(L270)·`import * as consistency`(L21)·`afterEach`/`restoreAllMocks`(L260~262) 격리만.** 파일 전량 광범위 read 금지 — happy it(L264~281)와 인접 대조 it(L283 다수-seed·L295 빈-seeds, 대조 참고용) 패턴만.
- `test/helpers/realdata-e2e-run-plan-consistency.ts` — **가드 시그니처(`assertRealDataE2eRunPlanConsistentWithSources(plan, seeds, modelId, run)` 4-arg)만.** 가드가 정확히 4 인자로 1회 호출되고 여분 인자가 없음을 확인(이미 planner pre-check 로 확정 — positional L277~280 이 4 index 만 접근).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-run-plan.spec.ts`)의 happy it(L264~281)에 인자-충실도 negative + arity 축 assert 추가만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **negative — 인자 payload drift 대조(가드 self-wire)**: happy it(L264~281)의 `spy` 에, 기존 `toHaveBeenCalledWith(plan, SINGLE, MODEL_ID, RUN)`(L275) positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative `not.toHaveBeenCalledWith` 1+ 추가. 예: `expect(spy).not.toHaveBeenCalledWith(plan, [], MODEL_ID, RUN)`(빈 seeds drift 미매칭) 또는 modelId 가 실제로 다른 `expect(spy).not.toHaveBeenCalledWith(plan, SINGLE, MODEL_ID + "-drift", RUN)`(modelId drift 미매칭) 형태. **주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 주입 (plan, SINGLE, MODEL_ID, RUN) 와 다르도록 구성.** positional `.toBe` 대조를 재사용 말고 인자-충실도 축 negative 로 별도 명시.
- [ ] **negative — 인자 개수/arity 봉함(가드 self-wire)**: 가드가 정확히 4 인자(`plan`, `SINGLE`, `MODEL_ID`, `RUN`)로만 호출됨(여분 인자 0)을 `expect(spy.mock.calls[0].length).toBe(4)` 로 lock 하는 assert 1+ 추가. 가드가 여분 인자를 함께 받지 않음을 봉함(4-arity). 기존 positional index 접근(L277~280)은 값 대조일 뿐 길이 봉함이 아니므로 별개.
- [ ] **positive 축 유지**: 기존 `toHaveBeenCalledTimes(1)`(L273)·`toHaveBeenCalledWith(plan, SINGLE, MODEL_ID, RUN)`(L275)·positional `spy.mock.calls[0][0..3]`(L277~280)은 제거 말고 유지(횟수+positive 인자+positional+negative+arity 모두 공존).
- [ ] **flow / 분기 cover**: 본 leg 은 happy it(L264) 단일 경로 tighten — 새 분기 도입 0. 가드 self-wire 는 정상 합성 후 1회 호출되는 단일 경로라 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (인접 다수-seed L283·빈-seeds L295 대조 it 은 별개 경계 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c "not.toHaveBeenCalledWith" test/helpers/realdata-e2e-run-plan.spec.ts` ≥ 1(본 leg 이 run-plan 가드 self-wire negative payload-drift 축을 최초 lock — audit 후보 2 leg19).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy 도달 lock·다수-seed·빈-seeds 대조 it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-run-plan.ts`·`realdata-e2e-run-plan-consistency.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다수-seed 대조 it(L283)·빈-seeds 대조 it(L295)** — 이미 Times(1)+positive With lock. 본 leg 은 negative/arity 축을 그 두 it 이 아닌 **happy it(L264) 한 곳** 에만 추가(중복 방지). 두 대조 it 재편집·중복 negative 금지.
- **byte-identical 불변 it(L308)·전파(throw) 분기·구조 결손 it** — 소진(선행 leg). 기존 assert 제거·변경 금지.
- **`toHaveBeenNthCalledWith` 순번 축 도입 금지** — 가드 self-wire 는 happy it 에서 단일-call(1회 호출)이라 Nth 순번 축 무의미. negative payload-drift + arity 축만.
- **run-plan-consistency/pipeline-plan/collect-command-plan/eval-command-plan sibling·seed-collect-call-args 자체 spec 의 negative 축** — 별개 파일, 별개 leg(Follow-ups 참조). 본 leg 은 `realdata-e2e-run-plan.spec.ts` **한 파일** 만.
- 새 컴포저/가드/helper 신설 — 기존 `consistency` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 단일-call 위임 negative+arity 축 확장, 선행 leg 패턴 그대로). implementer 는 happy it(L264~281)의 `spy` 인프라를 재사용해 `not.toHaveBeenCalledWith`(payload drift) + `spy.mock.calls[0].length === 4`(arity봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg19 가 run-plan 가드 self-wire negative+arity 를 lock 하면, 다음 pre-check 로 `toHaveBeenCalledWith`>0 이지만 `not.toHaveBeenCalledWith`=0(negative payload-drift 미lock) 인 잔여 consistency/args spec — pre-check 스캔 확인분: `realdata-e2e-result-report-plan.spec.ts`(spyOn 8·calledWith 3·not 0)·`realdata-e2e-evaluation-plan.spec.ts`(spyOn 12·calledWith 5·not 0)·`realdata-e2e-seed-collect-call-args-consistency.spec.ts`(spyOn 5·calledWith 3·not 0)·`realdata-e2e-seed-collect-call-args.spec.ts`(spyOn 4·calledWith 3·not 0)·`realdata-e2e-result-outcome-step-args*.spec.ts`·`realdata-e2e-result-publish-step-args*.spec.ts`·`realdata-e2e-evaluation-step-args*.spec.ts` 등 — 중 delegate spyOn 을 실제로 쓰는(pure-value 대조 아닌) 곳을 우선순위로 leg20+ 계속. negative 축이 전 spec 소진되면 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 §D candidate / PLAN bullet 로 전환.
