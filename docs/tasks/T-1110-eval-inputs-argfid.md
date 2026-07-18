---
id: T-1110
title: realdata-e2e evaluation-inputs per-element 재유도 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg13
phase: P5
status: DONE
mergedAs: 45105961
prNumber: 1002
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg13 — evaluation-inputs per-element 재유도 delegate(mapActivityToEvaluationInput(activity)) toHaveBeenCalledWith/NthCalledWith 인자-충실도 lock. spec W=0 적격(T=10), 기존 evaluationInputMapperModule spyOn 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1110 — realdata-e2e evaluation-inputs per-element 재유도 인자-충실도 완결 (§D 후보 2 leg13)

## Why

P5 test-hardening sweep 의 **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 은 leg1~leg12(T-1098~[T-1109](T-1109-eval-command-plan-argfid.md))로 진행됐다. leg1~7 은 `result-issue` 계열, leg8~10 은 daily-step dual-leg 형제 계열, leg11~12(T-1108/T-1109)는 daily-step **collect/eval-command-plan** leaf 컴포저 seam(각 1-delegate)을 소진했다.

본 leg 은 그 sweep 의 **leg13** 으로, T-1109 Follow-ups 가 지목한 **잔여 W=0 & T>0 non-daily-step seam** 중 첫 후보 **`evaluation-inputs`** 를 대상으로 한다. 이 가드 `assertRealDataEvaluationInputsConsistentWithSources(evaluationInputs, activities)` 는 앞선 command-plan seam 과 달리 **per-element 재유도** 경로다 — 컴포저 산출 evaluationInputs 를 source activities 전량에 대해 delegate `mapActivityToEvaluationInput(activity)` 로 **요소별 재유도**해 byte-identical 정합을 대조한다(guard 소스 L58 import·L150 export). call-count(happy `toHaveBeenCalledTimes(MIXED.length)` / 단일 원소 1 / 구조 결손 0-call / 값-drift RangeError activities.length 회)·구조-검사 선행성은 이미 못박혔으나(T-1087), 그 order-locked spy 가 **어떤 인자 payload 로**(각 호출이 대응 activity 원소 자체) 호출됐는지(`toHaveBeenCalledWith`/`toHaveBeenNthCalledWith`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 2e64cc4a — T-1109 머지 PR #1001 squash 이후):
- 대상 spec `test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 10건 보유 → order/count-lock spy 인프라 조밀(W=0 & T>0 잔여 후보군 첫 항목).
- 가드 소스 `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` L58 실증: named import `mapActivityToEvaluationInput`, 재유도가 source activities 전량에 대해 **per-element**(delegate 1-arg = 개별 `Activity` 원소) 호출.
- 기존 spec 의 "구조-검사 선행성" describe 블록 happy-path it(L291~307)에 `const spy = jest.spyOn(evaluationInputMapperModule, "mapActivityToEvaluationInput")`(L295) 를 설치해 `toHaveBeenCalledTimes(MIXED.length)`(L306)만 못박고, **각 호출의 activity 원소 인자 payload 충실도(`toHaveBeenCalledWith`)는 assert 하지 않는다** → 진성 인자-충실도 gap. fixture 는 `MIXED = [COMMIT, PR, ISSUE, PAGE]`(L72, 순서 있는 length-4 배열)·`buildConsistent(MIXED)`(L77~), module alias `evaluationInputMapperModule`(L23 `import * as evaluationInputMapperModule from "../../src/assessment-evaluation/domain/evaluation-input.mapper"`).

## Required Reading

- `docs/tasks/T-1109-eval-command-plan-argfid.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg 은 command-plan 1-delegate 인자-충실도 leg(T-1109)의 canonical assert 패턴(`toHaveBeenCalledWith(arg)` + 인자-축 negative + arity 봉함)을 **per-element** 로 확장 적용한다. 본 seam 은 delegate 가 activities.length 회(각 1-arg activity) 호출되므로 `toHaveBeenNthCalledWith` 로 순번별 원소 대조가 추가로 필요하다.
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts` — **"구조-검사 선행성" describe 블록 happy-path it(L291~307)의 `spy` spyOn 설치(L295)·`toHaveBeenCalledTimes(MIXED.length)`(L306) 패턴과 fixture(`MIXED = [COMMIT, PR, ISSUE, PAGE]`(L72)·`buildConsistent`(L77))·module alias(`evaluationInputMapperModule`(L23))만.** 기존 spy 인프라·`afterEach(jest.restoreAllMocks)`(L287) 격리를 재사용한다. 파일 전량 광범위 read 금지 — 대상 it(L291~) 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-evaluation-inputs-consistency.ts` — **L58 import·L150 export 시그니처 2줄만.** delegate 가 named `mapActivityToEvaluationInput`(1-arg `Activity`)이며 per-element 호출임을 확인(이미 planner pre-check 로 확정).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-evaluation-inputs-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **mapActivityToEvaluationInput delegate 인자-충실도(happy-path, per-element 순번별)**: happy-path 선행성 it(L291) 에서 delegate 가 각 source activity 원소를 **정확히 그 순번에** 받았음을 `MIXED.forEach((activity, i) => expect(spy).toHaveBeenNthCalledWith(i + 1, activity))`(또는 각 원소별 `toHaveBeenNthCalledWith`) 로 lock. 추가로 canonical `expect(spy).toHaveBeenCalledWith(MIXED[0])` 1+ 도 명시(전체 완전 충실도). 기존 `toHaveBeenCalledTimes(MIXED.length)` 는 제거 말고 유지(횟수+순번+인자 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenNthCalledWith`/`toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(spy).not.toHaveBeenCalledWith({})`(빈 activity drift 미매칭) 또는 실제 값이 다른 activity 원소로 `expect(spy).not.toHaveBeenNthCalledWith(1, MIXED[1])`(1번째 호출이 다른 원소로 오지 않았음) 형태로 payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 it(길이 불일치·원소-내용 drift)을 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.** (주의: `toHaveBeenCalledWith` 는 deep-equality 매칭 — negative 대상은 실제 값이 다르도록 구성.)
- [ ] **negative — 인자 개수/arity 봉함**: 각 delegate 호출이 정확히 1 인자로 호출됨을 `spy.mock.calls.forEach((call) => expect(call.length).toBe(1))`(또는 대표 호출 `expect(spy.mock.calls[0].length).toBe(1)`) 로 lock 하는 assert 1+(여분 인자 0 — per-element map 의 1-arity 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 선행성 재유도 order-lock it(L291) 단일 경로 tighten — 새 분기 도입 0. per-element 재유도 조립 경로에 분기 없음(요소별 동일 호출) → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-evaluation-inputs-consistency.spec.ts` ≥ 1(본 leg 이 evaluation-inputs per-element 재유도 인자-충실도를 최초 lock — audit 후보 2 leg13, non-daily-step seam 소진 착수).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 선행성 happy `toHaveBeenCalledTimes(MIXED.length)`·단일 원소 1·구조 결손 0-call·값-drift RangeError activities.length 회 negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-evaluation-inputs-consistency.ts`·`evaluation-input.mapper.ts` 등) 변경 금지** — test-only assert 추가. 가드/매퍼 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 evaluation-inputs **한 seam** 만. 잔여 W=0 & T>0 seam(github-collection-live·seed-upsert 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **구조-검사 선행성·call-count exactly-N(happy activities.length / 단일 1 / 구조 0)·order-lock 재유도** — 소진(T-1087). 기존 `toHaveBeenCalledTimes` assert 제거·변경 금지(유지만).
- **result-issue 계열·daily-step dual-leg 형제 계열·collect/eval-command-plan(leg1~12: T-1098~T-1109) 인자-충실도** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 `evaluationInputMapperModule` spyOn 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 per-element 재유도 seam 확장). implementer 는 happy-path 선행성 it(L291) 의 `spy` 인프라를 재사용해 `toHaveBeenNthCalledWith(i+1, activity)` per-element 인자-충실도 + canonical `toHaveBeenCalledWith` + 인자-축 negative 2종(payload drift + arity 봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 evaluation-inputs per-element 재유도 인자-충실도를 lock 하면, 잔여 W=0 & T>0 non-daily-step seam 중 `github-collection-live`(W=0 T=11) 또는 `seed-upsert`(W=0 T=1) 를 다음 pre-check 로 `toHaveBeenCalledWith` count=0 & `toHaveBeenCalledTimes`>0 재확인 후 소진. 잔여 없으면 completion-audit(후보 2 소진 확정) 또는 P5 의 다른 PLAN bullet 로 전환.
