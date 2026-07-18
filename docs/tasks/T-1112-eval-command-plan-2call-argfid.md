---
id: T-1112
title: realdata-e2e daily-step eval-command-plan 값-정합 2-call 재유도 per-call 인자-충실도 toHaveBeenNthCalledWith 완결 — §D 후보 2 leg15
phase: P5
status: DONE
completedAt: 2026-07-18T07:16:00Z
mergedAs: dad60076
prNumber: 1004
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg15 — eval-command-plan 값-정합 2-call RangeError 블록(L648 Times(2))의 delegate resolveRealDataE2eLiveGating(env) 순번별 toHaveBeenNthCalledWith(1/2, env) per-call 인자-충실도 lock. 클린 W=0 seam 소진(seed-upsert=0-call isolation) → 이미 scalar-locked spec 의 잔여 multi-call 블록 완결. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1112 — realdata-e2e daily-step eval-command-plan 값-정합 2-call 재유도 per-call 인자-충실도 완결 (§D 후보 2 leg15)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg14([T-1098~T-1111](T-1111-github-collection-live-argfid.md))로 진행됐다. leg1~7 은 `result-issue` 계열, leg8~10 은 daily-step dual-leg 형제 계열, leg11~12(T-1108/T-1109)는 daily-step **collect/eval-command-plan** leaf 컴포저의 **happy-path 단일-call** delegate seam, leg13(T-1110)은 evaluation-inputs per-element 재유도, leg14(T-1111)는 github-collection-live per-element 재유도 seam 을 소진했다.

본 leg 은 그 sweep 의 **leg15** 다. T-1111 Follow-ups 는 잔여 후보로 `seed-upsert-consistency`(W=0 T=1) 를 지목하며 "다음 pre-check 로 `toHaveBeenCalledWith` count=0 & `toHaveBeenCalledTimes`>0 재확인 후 소진, 잔여 없으면 completion-audit" 이라는 caveat 을 달았다. **본 planner pre-check 결과 seed-upsert 은 인자-충실도 부적격으로 확정됐고**, 대신 **이미 scalar-locked 된 eval-command-plan spec 의 잔여 multi-call(2-call) 블록** 이 진성 per-call 인자-충실도 gap 으로 드러나 이를 leg15 로 삼는다.

pre-check(planner, 2026-07-18, origin/main HEAD e233947b — T-1111 머지 PR #1003 squash 이후):
- **클린 W=0 seam 소진 확정**: 전체 realdata-e2e consistency spec 중 `toHaveBeenCalledWith` count=0 & **양(陽)의 delegate 호출(`toHaveBeenCalledTimes(N>0)`)** 을 가진 spec 은 없다. 유일 W=0 & T>0 후보 `seed-upsert-consistency`(W=0 T=1)의 그 단 하나의 `toHaveBeenCalledTimes` 는 **`(0)` — 호출 격리(가드가 delegate `buildRealDataUpsertArgs` 를 재호출하지 않음) assert**(spec L97)라 lock 할 인자 자체가 없다(가드가 순수 대조·재유도 0). 마찬가지로 `seed-resolve-person-id`(W=1)의 delegate 는 단일-call 이 이미 `toHaveBeenCalledTimes(1)`+`toHaveBeenCalledWith(resolved, upsertArgsList, map)`(L804·L806)로 완전 lock, 나머지 spy 는 0-call 격리 → 잔여 per-element gap 0. 즉 후보 2 의 **클린 미착수 seam 은 소진**됐다.
- **진성 잔여 gap — eval-command-plan 값-정합 2-call 블록**: 대상 spec `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts` 의 "T-1078 — 구조-검사 선행성 order-lock" describe(L489, `afterEach(jest.restoreAllMocks)` L490~492) 안 **값-정합 위반 RangeError 대조 it(L625~649)** 은 가드를 **2회 invoke**(두 `toThrow` — L637·L640)해 delegate `resolveRealDataE2eLiveGating` 이 정확히 2회 재유도됨을 `toHaveBeenCalledTimes(2)`(L648)로 못박는다. **그러나 그 2 호출이 각각 어떤 인자로**(매 호출 주입된 동일 `env`) 호출됐는지는 assert 하지 않는다 — 이 블록에는 `toHaveBeenCalledWith`/`toHaveBeenNthCalledWith` 가 전무 → 진성 per-call 인자-충실도 gap. (happy-path 단일-call it(L588~620)은 이미 T-1109 가 `toHaveBeenCalledWith(env)`+인자-축 negative+arity 로 완전 lock — spec 전체 W=4 는 전부 그 happy 블록 소산이라 본 2-call 블록은 미lock.)
- 가드 소스 `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts` L66 실증: named import `resolveRealDataE2eLiveGating`, L172 `const gating = resolveRealDataE2eLiveGating(env)` — 재유도 source 는 주입된 `env` 를 1-arg 로 받는 단일 delegate 호출. 값-정합 2-call 블록의 2 invoke 는 동일 `env` 인스턴스(L626 `const env = makeEnabledEnv()`)를 매 호출 주입 → 두 delegate 호출 모두 인자 = 그 `env`.

## Required Reading

- `docs/tasks/T-1111-github-collection-live-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg 은 T-1111 이 per-element 재유도에 확립한 순번별 `toHaveBeenNthCalledWith(i, arg)` + canonical `toHaveBeenCalledWith` + 인자-축 negative + arity 봉함 패턴을 **본 2-call 블록** 에 그대로 적용한다. 단 본 seam 의 두 호출 인자는 원소별 상이 payload 가 아니라 **매 호출 동일 주입 `env` 인스턴스** 라는 점만 다르다(순번별 동일 `env` 대조).
- `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts` — **"T-1078 구조-검사 선행성 order-lock" describe(L489)의 값-정합 2-call it(L625~649)와, 대조 참고용 happy-path 단일-call it(L588~620)의 `toHaveBeenCalledWith(env)`(L608)·negative(L614·L615)·arity(L620) 패턴, module alias `gatingModule`(L33 `import * as gatingModule from "./realdata-e2e-live-gating"`), `makeEnabledEnv`(L626), `afterEach(jest.restoreAllMocks)`(L490~492) 격리만.** 파일 전량 광범위 read 금지 — 대상 2-call it(L625~) 와 인접 happy 블록 패턴만.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts` — **L66 import·L172 재유도 호출 2줄만.** delegate 가 named `resolveRealDataE2eLiveGating`(1-arg `env`)이며 매 invoke 당 주입 `env` 로 1회 호출됨을 확인(이미 planner pre-check 로 확정).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts`)의 값-정합 2-call it(L625~649)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **resolveRealDataE2eLiveGating delegate 인자-충실도(값-정합 2-call, 순번별)**: 값-정합 위반 RangeError it(L625~649)의 두 invoke 후 delegate 가 각 호출마다 **정확히 주입된 `env` 를 그 순번에** 받았음을 순번별 `toHaveBeenNthCalledWith`(`expect(resolveSpy).toHaveBeenNthCalledWith(1, env)` + `expect(resolveSpy).toHaveBeenNthCalledWith(2, env)`) 로 lock. 추가로 canonical `expect(resolveSpy).toHaveBeenCalledWith(env)` 1+ 도 명시(완전 충실도). 기존 `toHaveBeenCalledTimes(2)`(L648)는 제거 말고 유지(횟수+순번+인자 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenNthCalledWith`/`toHaveBeenCalledWith` 가 `env` payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(resolveSpy).not.toHaveBeenCalledWith({})`(빈 env drift 미매칭) 또는 값이 실제로 다른 env `expect(resolveSpy).not.toHaveBeenCalledWith(makeEnabledEnv({ [REALDATA_E2E_LIVE_TEST_ENV]: "0" }))`(gating 키 값 뒤바뀐 env 미매칭) 형태로 payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError toThrow 대조(action↔gating 매핑 위반)를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.** (주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 `env` 와 다르도록 구성.)
- [ ] **negative — 인자 개수/arity 봉함**: 두 delegate 호출이 각각 정확히 1 인자로 호출됨을 `resolveSpy.mock.calls.forEach((call) => expect(call.length).toBe(1))`(또는 두 호출 `expect(resolveSpy.mock.calls[0].length).toBe(1)` + `[1]`) 로 lock 하는 assert 1+(여분 인자 0 — 매 invoke 1-arity 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 값-정합 2-call order-lock it(L625) 단일 경로 tighten — 새 분기 도입 0. 두 invoke 는 동일 경로(값 매핑 위반) 반복이라 재유도 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (본 블록 인접의 재유도-전 enum RangeError 0-call it(L651~669)은 별개 경계 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenNthCalledWith test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts` ≥ 2(본 leg 이 값-정합 2-call 블록의 per-call 순번별 인자-충실도를 최초 lock — audit 후보 2 leg15, 잔여 multi-call 블록 완결 착수).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy 단일-call `toHaveBeenCalledWith(env)`·값-정합 2-call `toHaveBeenCalledTimes(2)`·재유도-전 enum 0-call negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-daily-step-eval-command-plan-consistency.ts`·`realdata-e2e-live-gating.ts` 등) 변경 금지** — test-only assert 추가. 가드/delegate 시그니처 변경·리팩터 금지.
- **happy-path 단일-call it(L588~620)** — T-1109 가 이미 완전 lock(With+negative+arity). 재편집·중복 assert 금지.
- **재유도-전 enum RangeError 0-call it(L651~669)·구조 결손 0-call·값-정합 `toHaveBeenCalledTimes(2)`** — 소진(선행 leg + 본 leg 은 그 Times(2) 유지만). 기존 assert 제거·변경 금지.
- **collect-command-plan sibling(`realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts`)의 동형 2-call 블록(L678 Times(2))** — 동일 gap 이나 별개 파일 → 후속 leg16(다음 planner turn). 본 leg 은 eval-command-plan **한 파일** 만.
- **result-issue 계열·daily-step dual-leg 형제 계열·evaluation-inputs·github-collection-live(leg1~14) 인자-충실도** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 `gatingModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 값-정합 2-call 블록 per-call 확장). implementer 는 값-정합 2-call it(L625~649)의 `resolveSpy` 인프라를 재사용해 순번별 `toHaveBeenNthCalledWith(1, env)`/`(2, env)` per-call 인자-충실도 + canonical `toHaveBeenCalledWith(env)` + 인자-축 negative 2종(env payload drift + arity 봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 eval-command-plan 값-정합 2-call per-call 인자-충실도를 lock 하면, 동형 gap 을 가진 sibling `collect-command-plan`(값-정합 2-call `toHaveBeenCalledTimes(2)` at L678, per-call 인자 미lock)을 leg16 으로 동일 패턴 적용. 그 후 잔여 multi-call 블록 부재 확인 시 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 PLAN bullet 로 전환.
