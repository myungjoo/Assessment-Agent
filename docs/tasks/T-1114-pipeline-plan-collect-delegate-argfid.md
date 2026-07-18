---
id: T-1114
title: realdata-e2e pipeline-plan collect 위임(buildRealDataCollectCallArgs) 인자-충실도 negative payload-drift + arity봉함 완결 — §D 후보 2 leg17
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-pipeline-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg17 — pipeline-plan 가드의 collect 위임 buildRealDataCollectCallArgs(seeds) 는 happy it(L547)에서 Times(1)+With(seeds)+invocationCallOrder 만 lock, negative payload-drift(not.toHaveBeenCalledWith)+arity봉함 미lock. 진성 gap. T-1108/1112/1113 동형 negative+arity 축 적용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1114 — realdata-e2e pipeline-plan collect 위임 인자-충실도 negative + arity봉함 완결 (§D 후보 2 leg17)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg16([T-1098~T-1113](T-1113-collect-2call-argfid.md))로 진행됐다. 직전 leg15/leg16(T-1112 eval-command-plan / T-1113 collect-command-plan)은 daily-step **값-정합 2-call 블록** 의 per-call `toHaveBeenNthCalledWith` 순번별 인자-충실도를 완결했고, 그 두 sibling 의 다중-call 블록은 모두 소진됐다.

planner pre-check(2026-07-18)로 realdata-e2e consistency spec 전반을 재감사한 결과, 잔여 다중-call `toHaveBeenCalledTimes(N≥2)` per-call 미lock 블록은 **더 없다**(collect/eval 두 곳이 유일했고 완결). 대신 **단일-call 위임의 negative payload-drift + arity봉함 축이 비어 있는 진성 seam** 이 `pipeline-plan` 가드 spec 에서 확인됐다. 본 leg17 은 sweep 을 그 축으로 이어간다(닫는 leg 아님 — negative 축 미lock 잔여 spec 다수 존재, Follow-ups 참조).

pre-check(planner, origin/main HEAD 4235e377 — T-1113 머지 PR #1005 squash 이후):
- **진성 잔여 gap — pipeline-plan collect 위임 negative + arity 미lock**: 대상 spec `test/helpers/realdata-e2e-pipeline-plan-consistency.spec.ts` 의 "구조 검사 통과 → 재유도 delegate 도달" happy-path it(L547~569)은 collect 위임 `buildRealDataCollectCallArgs` 를 `jest.spyOn`(L552) 후 `toHaveBeenCalledTimes(1)`(L566)·`toHaveBeenCalledWith(seeds)`(L567)·`invocationCallOrder[0] > 0`(L568)으로 lock 한다. **그러나 그 `With(seeds)` 가 실제로 인자 drift 를 잡음을 노출하는 negative(`not.toHaveBeenCalledWith(...)`) 대조가 전무**(spec 전체 `not.toHaveBeenCalledWith` = 0)하고, **위임이 정확히 1 인자로만 호출됨(여분-인자 0)을 봉함하는 arity 축(`collectSpy.mock.calls[0].length` 대조) 도 전무**하다 → 진성 인자-충실도 gap(positive 축만 lock, negative/arity 축 공백).
- **spec 계측 확정**: 대상 spec `toHaveBeenCalledWith`=3(happy L567 + 값-경계 대조 2건 L595·L621, 모두 `With(seeds)` positive)·`not.toHaveBeenCalledWith`=0·`toHaveBeenNthCalledWith`=0·`mock.calls[...].length`/arity=0·spyOn=collectModule 단일 delegate. 값-경계 대조 it 2건(L571·L598)은 이미 `toThrow`(RangeError/modelId) + delegate 도달 1-call 을 lock 하지만 인자-충실도 negative 축은 별개 — 본 leg 은 **happy it(L547) 한 곳** 에 negative payload-drift + arity봉함을 최초 lock.
- 가드 소스 `test/helpers/realdata-e2e-pipeline-plan-consistency.ts` L60 실증: `import { buildRealDataCollectCallArgs } from "./realdata-e2e-seed-collect-call-args"`, 재유도는 주입된 `seeds` 배열을 1-arg 로 받는 단일 위임 호출(modelId 는 입력 직접 대조 — 별도 위임 아님). 따라서 위임 인자 = 주입 `seeds` 인스턴스, 여분 인자 0(1-arity). eval/collect-command-plan leg 의 delegate-도달 seam 과 동형(단일-call 판).

## Required Reading

- `docs/tasks/T-1113-collect-2call-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg17 은 선행 leg 들이 확립한 인자-충실도 3축(canonical `toHaveBeenCalledWith` positive + 인자-축 negative payload-drift `not.toHaveBeenCalledWith` + arity봉함 `call.length`)을 **pipeline-plan 의 단일-call collect 위임 happy it** 에 적용한다. 단일-call 이므로 `toHaveBeenNthCalledWith` 순번 축은 불요(Nth 는 다중-call 전용).
- `test/helpers/realdata-e2e-pipeline-plan-consistency.spec.ts` — **happy-path it "구조 검사 통과 → 재유도 delegate 도달"(L547~569)의 `collectSpy`(L552 `jest.spyOn(collectModule, "buildRealDataCollectCallArgs")`)·`toHaveBeenCalledWith(seeds)`(L567)·`invocationCallOrder`(L568) 패턴, `makeSeeds()`(L45)·`makeSeed()`(단일 seed helper, L88 용례)·`MODEL_ID`(L28)·`import * as collectModule`(L24)·`afterEach`/`restoreAllMocks` 격리만.** 파일 전량 광범위 read 금지 — happy it(L547~569)와 인접 값-경계 대조 it(L571·L598, 대조 참고용) 패턴만.
- `test/helpers/realdata-e2e-pipeline-plan-consistency.ts` — **L60 import·재유도 호출 부(collect 위임 `buildRealDataCollectCallArgs(seeds)`)만.** 위임이 named 1-arg(`seeds`)로 1회 호출되고 modelId 는 위임 아닌 직접 대조임을 확인(이미 planner pre-check 로 확정).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-pipeline-plan-consistency.spec.ts`)의 happy it(L547~569)에 인자-충실도 negative + arity 축 assert 추가만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **negative — 인자 payload drift 대조(collect 위임)**: happy it(L547~569)의 `collectSpy` 에, 기존 `toHaveBeenCalledWith(seeds)`(L567) positive 가 실제로 인자 drift 를 잡음을 노출하는 인자-축 negative `not.toHaveBeenCalledWith` 1+ 추가. 예: `expect(collectSpy).not.toHaveBeenCalledWith([])`(빈 seeds drift 미매칭) 또는 값이 실제로 다른 seeds `expect(collectSpy).not.toHaveBeenCalledWith([makeSeed()])`(단일-seed subset drift 미매칭) 형태. **주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 주입 `seeds` 와 다르도록 구성.** 기존 값-경계 `toThrow`(L591·L617) 대조를 재사용 말고 인자-충실도 축 negative 로 별도 명시.
- [ ] **negative — 인자 개수/arity 봉함(collect 위임)**: collect 위임이 정확히 1 인자(`seeds`)로만 호출됨(여분 인자 0)을 `expect(collectSpy.mock.calls[0].length).toBe(1)` 로 lock 하는 assert 1+ 추가. 위임이 modelId 등 여분 인자를 함께 받지 않음을 봉함(1-arity).
- [ ] **positive 축 유지**: 기존 `toHaveBeenCalledTimes(1)`(L566)·`toHaveBeenCalledWith(seeds)`(L567)·`invocationCallOrder[0] > 0`(L568)은 제거 말고 유지(횟수+positive 인자+순번+negative+arity 모두 공존).
- [ ] **flow / 분기 cover**: 본 leg 은 happy it(L547) 단일 경로 tighten — 새 분기 도입 0. collect 위임은 구조 통과 후 1회 도달하는 단일 경로라 재유도 조립에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (인접 값-경계 대조 it L571·L598·구조 결손 0-call it 은 별개 경계 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c "not.toHaveBeenCalledWith" test/helpers/realdata-e2e-pipeline-plan-consistency.spec.ts` ≥ 1(본 leg 이 collect 위임 negative payload-drift 축을 최초 lock — audit 후보 2 leg17).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy 도달 lock·값-경계 대조 RangeError/modelId it·구조 결손 0-call it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-pipeline-plan-consistency.ts`·`realdata-e2e-seed-collect-call-args.ts` 등) 변경 금지** — test-only assert 추가. 가드/위임 시그니처 변경·리팩터 금지.
- **값-경계 대조 it(L571 collectCallArgs drift RangeError·L598 modelId mismatch)** — 이미 `toThrow` + delegate 도달 1-call lock. 본 leg 은 negative/arity 축을 그 두 it 이 아닌 **happy it(L547) 한 곳** 에만 추가(중복 방지). 두 대조 it 재편집·중복 negative 금지.
- **구조 결손 0-call it·`assertPipelinePlanStructure` TypeError 분기** — 소진(선행 leg). 기존 assert 제거·변경 금지.
- **`toHaveBeenNthCalledWith` 순번 축 도입 금지** — collect 위임은 happy it 에서 단일-call(1회 도달)이라 Nth 순번 축 무의미. negative payload-drift + arity 축만.
- **collect-command-plan/eval-command-plan sibling·seed-collect-call-args 자체 spec 의 negative 축** — 별개 파일, 별개 leg(Follow-ups 참조). 본 leg 은 pipeline-plan **한 파일** 만.
- 새 컴포저/가드/helper 신설 — 기존 `collectModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 단일-call 위임 negative+arity 축 확장, 선행 leg 패턴 그대로). implementer 는 happy it(L547~569)의 `collectSpy` 인프라를 재사용해 `not.toHaveBeenCalledWith`(payload drift) + `mock.calls[0].length === 1`(arity봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg17 이 pipeline-plan collect 위임 negative+arity 를 lock 하면, 다음 pre-check 로 `toHaveBeenCalledWith`>0 이지만 `not.toHaveBeenCalledWith`=0(negative payload-drift 미lock) 인 잔여 consistency spec — 예: `run-plan`·`result-report-plan`·`evaluation-plan`·`seed-collect-call-args`·`result-outcome-step-args`·`result-publish-step-args`·`evaluation-step-args`·`result-issue-descriptor-body`·`descriptor-body`·`publish-plan`·`seed-resolve-person-id` 등 — 중 delegate spyOn 을 실제로 쓰는(pure-value 대조 아닌) 곳을 우선순위로 leg18+ 계속. negative 축이 전 spec 소진되면 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 §D candidate / PLAN bullet 로 전환.
