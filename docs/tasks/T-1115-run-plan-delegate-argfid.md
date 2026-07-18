---
id: T-1115
title: realdata-e2e run-plan 재유도 위임(buildRealDataPipelinePlan) 인자-충실도 negative payload-drift + arity봉함 완결 — §D 후보 2 leg18
phase: P5
status: DONE
completedAt: 2026-07-18T08:50:04Z
result: "PR #1007 merged (squash e9af7c8a) — run-plan 재유도 위임 buildRealDataPipelinePlan(seeds, MODEL_ID) happy it(L615~638)에 negative payload-drift(not.toHaveBeenCalledWith x2) + arity봉함(mock.calls[0].length===2) 최초 lock. positive 축 유지. test-only 1파일 +8/-0. grep not.toHaveBeenCalledWith 0→2. reviewer round1 APPROVE 4-게이트 PASS. 404 suites/11328 tests green."
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-run-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg18 — run-plan 가드의 재유도 위임 buildRealDataPipelinePlan(seeds, MODEL_ID) 는 happy it(L615~638)에서 Times(1)+With(seeds,MODEL_ID)+invocationCallOrder 만 lock, negative payload-drift(not.toHaveBeenCalledWith)+arity봉함(2-arg) 미lock. 진성 gap(spec not=0/arity=0). T-1114(pipeline-plan) 동형 축 sibling 적용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1115 — realdata-e2e run-plan 재유도 위임 인자-충실도 negative + arity봉함 완결 (§D 후보 2 leg18)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg17([T-1098~T-1114](T-1114-pipeline-plan-collect-delegate-argfid.md))로 진행됐다. 직전 leg17(T-1114)은 `pipeline-plan` 가드의 collect 위임(단일-call 1-arg)에 negative payload-drift + arity봉함을 최초 lock 했다.

planner pre-check(2026-07-18, origin/main HEAD f1253454 — T-1114 머지 PR #1006 squash 이후)로 realdata-e2e consistency spec 전반을 재감사한 결과, `pipeline-plan` 의 직접 sibling 인 **`run-plan` 가드 spec 의 재유도 위임 happy it 이 동형 seam** 으로 확인됐다. 본 leg18 은 sweep 을 그 sibling 으로 이어간다(닫는 leg 아님 — negative 축 미lock 잔여 consistency spec 다수 존재, Follow-ups 참조).

pre-check(planner, origin/main HEAD f1253454):
- **진성 잔여 gap — run-plan 재유도 위임 negative + arity 미lock**: 대상 spec `test/helpers/realdata-e2e-run-plan-consistency.spec.ts` 의 "구조 검사 통과 → 재유도 delegate 도달" happy-path it(L615~638)은 재유도 위임 `buildRealDataPipelinePlan` 을 `jest.spyOn`(L620, `pipelineSpy`) 후 `toHaveBeenCalledTimes(1)`(L635)·`toHaveBeenCalledWith(seeds, MODEL_ID)`(L636)·`invocationCallOrder[0] > 0`(L637)으로 lock 한다. **그러나 그 `With(seeds, MODEL_ID)` 가 실제로 인자 drift 를 잡음을 노출하는 negative(`not.toHaveBeenCalledWith(...)`) 대조가 전무**(spec 전체 `not.toHaveBeenCalledWith` = 0)하고, **위임이 정확히 2 인자로만 호출됨(여분-인자 0)을 봉함하는 arity 축(`pipelineSpy.mock.calls[0].length` 대조) 도 전무**하다 → 진성 인자-충실도 gap(positive 축만 lock, negative/arity 축 공백).
- **spec 계측 확정**: 대상 spec `toHaveBeenCalledWith`=3(happy L636 + 값-경계 대조 2건 L668·L695, 모두 `With(seeds, MODEL_ID)` positive)·`not.toHaveBeenCalledWith`=0·`toHaveBeenNthCalledWith`=0·`mock.calls[...].length`/arity=0·spyOn=`pipelinePlanModule.buildRealDataPipelinePlan` 단일 delegate. 값-경계 대조 it 2건(L640·L671)은 이미 `toThrow`(pipeline drift / run drift RangeError) + delegate 도달 1-call 을 lock 하지만 인자-충실도 negative 축은 별개 — 본 leg 은 **happy it(L615~638) 한 곳** 에 negative payload-drift + arity봉함을 최초 lock.
- **위임 arity 확정**: leg17 pipeline-plan 의 collect 위임은 단일-call **1-arg**(`seeds`)였으나, 본 run-plan 재유도 위임은 **2-arg**(`seeds`, `MODEL_ID`)로 호출(L636·L619 `buildRealDataE2eRunPlan(seeds, MODEL_ID, RUN)` 의 재유도 도달 경로). 따라서 arity봉함은 `.length).toBe(2)` — leg17(1-arg)와 구분되는 별개 seam. run 인자(RUN)는 재유도 위임이 받지 않고 run drift 는 별도 직접 대조(L671 대조 it)임을 pre-check 로 확정.

## Required Reading

- `docs/tasks/T-1114-pipeline-plan-collect-delegate-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg18 은 선행 leg 들이 확립한 인자-충실도 3축(canonical `toHaveBeenCalledWith` positive + 인자-축 negative payload-drift `not.toHaveBeenCalledWith` + arity봉함 `call.length`)을 **run-plan 의 재유도 위임 happy it** 에 적용한다. leg17 과 동형이되 위임 arity 만 2(seeds, MODEL_ID)로 다름. 단일-call 이므로 `toHaveBeenNthCalledWith` 순번 축은 불요(Nth 는 다중-call 전용).
- `test/helpers/realdata-e2e-run-plan-consistency.spec.ts` — **happy-path it "구조 검사 통과 → 재유도 delegate 도달"(L615~638)의 `pipelineSpy`(L620 `jest.spyOn(pipelinePlanModule, "buildRealDataPipelinePlan")`)·`toHaveBeenCalledWith(seeds, MODEL_ID)`(L636)·`invocationCallOrder`(L637) 패턴, `makeSeeds()`·`MODEL_ID`·`RUN`·`buildRealDataE2eRunPlan`(L619)·`import * as pipelinePlanModule`(L21)·`afterEach`/`restoreAllMocks` 격리만.** 파일 전량 광범위 read 금지 — happy it(L615~638)와 인접 값-경계 대조 it(L640·L671, 대조 참고용) 패턴만.
- `test/helpers/realdata-e2e-run-plan-consistency.ts` — **재유도 호출 부(위임 `buildRealDataPipelinePlan(seeds, modelId)`)만.** 위임이 named 2-arg(`seeds`, `modelId`)로 1회 호출되고 run 인자는 위임 아닌 직접 대조임을 확인(이미 planner pre-check 로 확정).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-run-plan-consistency.spec.ts`)의 happy it(L615~638)에 인자-충실도 negative + arity 축 assert 추가만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **negative — 인자 payload drift 대조(재유도 위임)**: happy it(L615~638)의 `pipelineSpy` 에, 기존 `toHaveBeenCalledWith(seeds, MODEL_ID)`(L636) positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative `not.toHaveBeenCalledWith` 1+ 추가. 예: `expect(pipelineSpy).not.toHaveBeenCalledWith([], MODEL_ID)`(빈 seeds drift 미매칭) 또는 modelId 가 실제로 다른 `expect(pipelineSpy).not.toHaveBeenCalledWith(seeds, MODEL_ID + "-drift")`(modelId subset drift 미매칭) 형태. **주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 주입 (seeds, MODEL_ID) 와 다르도록 구성.** 기존 값-경계 `toThrow` 대조를 재사용 말고 인자-충실도 축 negative 로 별도 명시.
- [ ] **negative — 인자 개수/arity 봉함(재유도 위임)**: 재유도 위임이 정확히 2 인자(`seeds`, `MODEL_ID`)로만 호출됨(여분 인자 0 — run 인자 미전달)을 `expect(pipelineSpy.mock.calls[0].length).toBe(2)` 로 lock 하는 assert 1+ 추가. 위임이 RUN 등 여분 인자를 함께 받지 않음을 봉함(2-arity).
- [ ] **positive 축 유지**: 기존 `toHaveBeenCalledTimes(1)`(L635)·`toHaveBeenCalledWith(seeds, MODEL_ID)`(L636)·`invocationCallOrder[0] > 0`(L637)은 제거 말고 유지(횟수+positive 인자+순번+negative+arity 모두 공존).
- [ ] **flow / 분기 cover**: 본 leg 은 happy it(L615) 단일 경로 tighten — 새 분기 도입 0. 재유도 위임은 구조 통과 후 1회 도달하는 단일 경로라 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (인접 값-경계 대조 it L640·L671·구조 결손 0-call it L579 은 별개 경계 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c "not.toHaveBeenCalledWith" test/helpers/realdata-e2e-run-plan-consistency.spec.ts` ≥ 1(본 leg 이 run-plan 재유도 위임 negative payload-drift 축을 최초 lock — audit 후보 2 leg18).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy 도달 lock·값-경계 대조 RangeError it·구조 결손 0-call it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-run-plan-consistency.ts`·`realdata-e2e-pipeline-plan.ts` 등) 변경 금지** — test-only assert 추가. 가드/위임 시그니처 변경·리팩터 금지.
- **값-경계 대조 it(L640 pipeline drift RangeError·L671 run drift RangeError)** — 이미 `toThrow` + delegate 도달 1-call lock. 본 leg 은 negative/arity 축을 그 두 it 이 아닌 **happy it(L615) 한 곳** 에만 추가(중복 방지). 두 대조 it 재편집·중복 negative 금지.
- **구조 결손 0-call it(L579)·`assertRealDataE2eRunPlanConsistentWithSources` 구조 fail-fast TypeError 분기** — 소진(선행 leg). 기존 assert 제거·변경 금지.
- **`toHaveBeenNthCalledWith` 순번 축 도입 금지** — 재유도 위임은 happy it 에서 단일-call(1회 도달)이라 Nth 순번 축 무의미. negative payload-drift + arity 축만.
- **pipeline-plan/collect-command-plan/eval-command-plan sibling·seed-collect-call-args 자체 spec 의 negative 축** — 별개 파일, 별개 leg(Follow-ups 참조). 본 leg 은 run-plan **한 파일** 만.
- 새 컴포저/가드/helper 신설 — 기존 `pipelinePlanModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 단일-call 위임 negative+arity 축 확장, 선행 leg 패턴 그대로). implementer 는 happy it(L615~638)의 `pipelineSpy` 인프라를 재사용해 `not.toHaveBeenCalledWith`(payload drift) + `mock.calls[0].length === 2`(arity봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg18 이 run-plan 재유도 위임 negative+arity 를 lock 하면, 다음 pre-check 로 `toHaveBeenCalledWith`>0 이지만 `not.toHaveBeenCalledWith`=0(negative payload-drift 미lock) 인 잔여 consistency/args spec — pre-check 스캔 확인분: `realdata-e2e-run-plan.spec.ts`·`realdata-e2e-result-report-plan.spec.ts`·`realdata-e2e-evaluation-plan.spec.ts`·`realdata-e2e-seed-collect-call-args-consistency.spec.ts`·`realdata-e2e-seed-collect-call-args.spec.ts`·`realdata-e2e-result-outcome-step-args*.spec.ts`·`realdata-e2e-result-publish-step-args*.spec.ts`·`realdata-e2e-evaluation-step-args*.spec.ts` 등 — 중 delegate spyOn 을 실제로 쓰는(pure-value 대조 아닌) 곳을 우선순위로 leg19+ 계속. negative 축이 전 spec 소진되면 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 §D candidate / PLAN bullet 로 전환.
