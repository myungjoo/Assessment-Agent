---
id: T-1113
title: realdata-e2e daily-step collect-command-plan 값-정합 2-call 재유도 per-call 인자-충실도 toHaveBeenNthCalledWith 완결 — §D 후보 2 leg16
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg16 — collect-command-plan 값-정합 2-call RangeError 블록(L678 Times(2))의 delegate resolveRealDataE2eLiveGating(env) 순번별 toHaveBeenNthCalledWith(1/2,env) per-call 인자-충실도 lock. T-1112(eval-command-plan leg15) 동형 sibling. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1113 — realdata-e2e daily-step collect-command-plan 값-정합 2-call 재유도 per-call 인자-충실도 완결 (§D 후보 2 leg16)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg15([T-1098~T-1112](T-1112-eval-command-plan-2call-argfid.md))로 진행됐다. 직전 leg15(T-1112)는 **eval-command-plan** spec 의 값-정합 2-call 블록에 순번별 `toHaveBeenNthCalledWith(1/2, env)` per-call 인자-충실도를 최초 lock 했다. T-1112 Follow-ups 는 명시적으로 **동형 gap 을 가진 sibling `collect-command-plan`(값-정합 2-call `toHaveBeenCalledTimes(2)` at L678, per-call 인자 미lock)을 leg16 으로 동일 패턴 적용** 하라고 지목했다.

본 leg 은 그 sweep 의 **leg16** 이며, **아직 clean seam 이 남아 있어 sweep 을 이어간다**(닫는 leg 아님). collect-command-plan 은 T-1108 이 happy-path 단일-call delegate 를 이미 완전 lock(With+negative+arity)했으나, 그 뒤의 값-정합 위반 2-call 블록은 여전히 횟수만 lock 이라 per-call 인자-충실도가 비어 있다.

pre-check(planner, 2026-07-18, origin/main HEAD dad60076 — T-1112 머지 PR #1004 squash 이후):
- **진성 잔여 gap — collect-command-plan 값-정합 2-call 블록**: 대상 spec `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` 의 "경계 대조(재유도-후 RangeError)" it(L647~679)은 가드를 **2회 invoke**(두 `toThrow` — L661·L667)해 delegate `resolveRealDataE2eLiveGating` 이 정확히 2회 재유도됨을 `toHaveBeenCalledTimes(2)`(L678)로 못박는다. **그러나 그 2 호출이 각각 어떤 인자로**(매 호출 주입된 동일 `env` L650) 호출됐는지는 assert 하지 않는다 — 이 블록에는 `toHaveBeenCalledWith`/`toHaveBeenNthCalledWith` 가 전무 → 진성 per-call 인자-충실도 gap. (happy-path 단일-call it(L606~645)은 이미 T-1108 이 `toHaveBeenCalledWith(env)`(L632)+인자-축 negative(L638·L639)+arity(L644)로 완전 lock — spec 전체 W=4 는 전부 그 happy 블록 소산이라 본 2-call 블록은 미lock.)
- **spec 계측 확정**: 대상 spec W(toHaveBeenCalledWith)=4·NthCalledWith=0·T(toHaveBeenCalledTimes)=5·invocationCallOrder=2·spyOn=7. `toHaveBeenCalledTimes` 5개는 각각 happy(L625 Times(1))·구조 결손 0-call(L601 Times(0))·값-정합 2-call(L678 Times(2))·재유도-전 enum 0-call(L700 Times(0)) — 이 중 **L678 Times(2) 블록만 per-call 인자 미lock**.
- 가드 소스 `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` L67 실증: named import `resolveRealDataE2eLiveGating`, L174 `const gating = resolveRealDataE2eLiveGating(env)` — 재유도 source 는 주입된 `env` 를 1-arg 로 받는 단일 delegate 호출. 값-정합 2-call 블록의 2 invoke 는 동일 `env` 인스턴스(L650 `const env = makeEnabledEnv()`)를 매 호출 주입 → 두 delegate 호출 모두 인자 = 그 `env`. eval-leg(T-1112)과 동형 seam.

## Required Reading

- `docs/tasks/T-1112-eval-command-plan-2call-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg16 은 T-1112 가 eval-command-plan 값-정합 2-call 블록에 확립한 순번별 `toHaveBeenNthCalledWith(1/2, env)` + canonical `toHaveBeenCalledWith(env)` + 인자-축 negative(payload drift + arity 봉함) 패턴을 **sibling collect-command-plan 의 동형 2-call 블록** 에 그대로 적용한다. 두 호출 인자는 매 호출 동일 주입 `env` 인스턴스(순번별 동일 `env` 대조).
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` — **"경계 대조(재유도-후 RangeError)" 값-정합 2-call it(L647~679)와, 대조 참고용 happy-path 단일-call it(L606~645)의 `toHaveBeenCalledWith(env)`(L632)·negative(L638·L639)·arity(L644) 패턴, module alias `gatingModule`(L33 부근 `import * as gatingModule`), `makeEnabledEnv`(L650)·`REALDATA_E2E_LIVE_TEST_ENV`(negative env 구성용), `afterEach(jest.restoreAllMocks)` 격리만.** 파일 전량 광범위 read 금지 — 대상 2-call it(L647~) 와 인접 happy 블록 패턴만.
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` — **L67 import·L174 재유도 호출 2줄만.** delegate 가 named `resolveRealDataE2eLiveGating`(1-arg `env`)이며 매 invoke 당 주입 `env` 로 1회 호출됨을 확인(이미 planner pre-check 로 확정).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts`)의 값-정합 2-call it(L647~679)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **resolveRealDataE2eLiveGating delegate 인자-충실도(값-정합 2-call, 순번별)**: 값-정합 위반 RangeError it(L647~679)의 두 invoke 후 delegate 가 각 호출마다 **정확히 주입된 `env` 를 그 순번에** 받았음을 순번별 `toHaveBeenNthCalledWith`(`expect(resolveSpy).toHaveBeenNthCalledWith(1, env)` + `expect(resolveSpy).toHaveBeenNthCalledWith(2, env)`) 로 lock. 추가로 canonical `expect(resolveSpy).toHaveBeenCalledWith(env)` 1+ 도 명시(완전 충실도). 기존 `toHaveBeenCalledTimes(2)`(L678)는 제거 말고 유지(횟수+순번+인자 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenNthCalledWith`/`toHaveBeenCalledWith` 가 `env` payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(resolveSpy).not.toHaveBeenCalledWith({})`(빈 env drift 미매칭) 또는 값이 실제로 다른 env `expect(resolveSpy).not.toHaveBeenCalledWith(makeEnabledEnv({ [REALDATA_E2E_LIVE_TEST_ENV]: "0" }))`(gating 키 값 뒤바뀐 env 미매칭) 형태로 payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError toThrow 대조(action↔gating 매핑 위반)를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.** (주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 값 자체가 실제 `env` 와 다르도록 구성. happy-path it 의 L638·L639 패턴 재사용.)
- [ ] **negative — 인자 개수/arity 봉함**: 두 delegate 호출이 각각 정확히 1 인자로 호출됨을 `resolveSpy.mock.calls.forEach((call) => expect(call.length).toBe(1))`(또는 두 호출 `expect(resolveSpy.mock.calls[0].length).toBe(1)` + `[1]`) 로 lock 하는 assert 1+(여분 인자 0 — 매 invoke 1-arity 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 값-정합 2-call it(L647) 단일 경로 tighten — 새 분기 도입 0. 두 invoke 는 동일 경로(값 매핑 위반) 반복이라 재유도 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시. (본 블록 인접의 재유도-전 enum RangeError 0-call it(L681~701)은 별개 경계 — 본 leg 손대지 않음.)
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenNthCalledWith test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` ≥ 2(본 leg 이 값-정합 2-call 블록의 per-call 순번별 인자-충실도를 최초 lock — audit 후보 2 leg16, sibling 완결).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 happy 단일-call `toHaveBeenCalledWith(env)`·값-정합 2-call `toHaveBeenCalledTimes(2)`·재유도-전 enum 0-call negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-daily-step-collect-command-plan-consistency.ts`·`realdata-e2e-live-gating.ts` 등) 변경 금지** — test-only assert 추가. 가드/delegate 시그니처 변경·리팩터 금지.
- **happy-path 단일-call it(L606~645)** — T-1108 이 이미 완전 lock(With+negative+arity). 재편집·중복 assert 금지.
- **재유도-전 enum RangeError 0-call it(L681~701)·구조 결손 0-call(L601 Times(0))·값-정합 `toHaveBeenCalledTimes(2)`(L678)** — 소진(선행 leg + 본 leg 은 그 Times(2) 유지만). 기존 assert 제거·변경 금지.
- **eval-command-plan sibling(`realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts`)의 동형 2-call 블록** — T-1112(leg15)가 이미 완결. 본 leg 은 collect-command-plan **한 파일** 만.
- **result-issue 계열·daily-step dual-leg 형제 계열·evaluation-inputs·github-collection-live(leg1~14) 인자-충실도** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 `gatingModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 값-정합 2-call 블록 per-call 확장, T-1112 sibling 패턴 그대로). implementer 는 값-정합 2-call it(L647~679)의 `resolveSpy` 인프라를 재사용해 순번별 `toHaveBeenNthCalledWith(1, env)`/`(2, env)` per-call 인자-충실도 + canonical `toHaveBeenCalledWith(env)` + 인자-축 negative 2종(env payload drift + arity 봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg16 이 collect-command-plan 값-정합 2-call per-call 인자-충실도를 lock 하면, eval/collect 두 sibling 의 값-정합 2-call 블록이 모두 완결된다. 다음 pre-check 로 realdata-e2e consistency spec 전반에 잔여 multi-call `toHaveBeenCalledTimes(N≥2)` per-call 미lock 블록(예: gh-command-plan 계열의 다-delegate 2-call)이 남았는지 재확인. 잔여 없으면 후보 2 completion-audit(§D candidate-2 소진 확정) 또는 P5 의 다른 §D candidate / PLAN bullet 로 전환.
