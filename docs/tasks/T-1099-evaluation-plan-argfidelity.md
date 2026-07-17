---
id: T-1099
title: realdata-e2e evaluation-plan 재유도 delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg2
phase: P5
status: DONE
commitMode: pr
prNumber: 991
mergedAs: 8a0f951d
reviewRounds: 1
completedAt: 2026-07-17T23:24:48Z
coversReq: [REQ-048]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg2 — evaluation-plan 재유도 2-delegate(inputs/callArgs) toHaveBeenCalledWith payload 충실도 lock. spec count=0 적격, order-lock spy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1099 — realdata-e2e evaluation-plan 재유도 delegate 인자-충실도 완결 (§D 후보 2 leg2)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. 후보 (a) struct-precede(legs T-1080~T-1088)·(b) call-count exactly-N(legs T-1089~T-1095)·(c) e2e 흐름 커버리지(T-1097 leg1)에 이어, [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 섹션 D **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 [T-1098](T-1098-result-report-plan-argfidelity.md)(result-report-plan seam, leg1)로 착수됐다.

본 leg 은 그 인자-충실도 sweep 의 **leg2** 로 `evaluation-plan` consistency-guard 의 재유도 2-delegate 를 대상으로 한다. call-count(호출 횟수)·순서(invocationCallOrder)는 이미 T-1055 order-lock 으로 소진됐으나, 각 order-locked spy 가 **어떤 인자 payload 로** 호출됐는지는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD=218b58ab):
- 대상 spec `test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock).
- 가드 소스 `test/helpers/realdata-e2e-evaluation-plan.ts` L81/L84 실증: 재유도 경로가 `buildRealDataEvaluationInputs(activities)`(단일 인자 = 가드의 `activities` 입력) → `buildRealDataScoringCallArgs(inputs, modelId)`(= 산출 inputs + 가드의 `modelId`) 두 delegate 를 호출한다.
- 기존 spec 은 T-1055 order-lock describe(L485~)에 `inputsSpy`/`callArgsSpy` 를 설치해 `toHaveBeenCalledTimes(1)` + `invocationCallOrder` 부등식(inputs < callArgs)만 못박고 **입력 payload 는 전혀 assert 하지 않는다** → 진성 인자-충실도 gap. (result-report-plan 의 T-1098 gap 과 동형.)

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 D 후보 2만.** 인자-충실도 축의 적격 판정 grep·근거.
- `docs/tasks/T-1098-result-report-plan-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 인자-충실도 leg 의 assert 패턴(canonical `toHaveBeenCalledWith` + 인자-축 negative 2종) 을 본 leg 이 동형 재사용한다.
- `test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts` — **T-1055 order-lock describe(L485~520)의 `inputsSpy`/`callArgsSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder` 패턴만.** 기존 spy 인프라를 재사용한다. 파일 전량(861줄) 광범위 read 금지 — 대상 describe 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-evaluation-plan.ts` — **L81·L84 재유도 call site 2줄만.** `buildRealDataEvaluationInputs(activities)` / `buildRealDataScoringCallArgs(inputs, modelId)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-evaluation-plan-consistency.spec.ts`) 에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit) 로 본 spec 실행.

- [ ] **inputs delegate 인자-충실도(happy-path)**: 재유도 happy-path(또는 T-1055 order-lock) it 에서 `expect(inputsSpy).toHaveBeenCalledWith(activities)` 를 추가해, inputs 위임이 가드의 **정확한 `activities` 입력 배열**로 호출됨(payload 누락/치환 없음)을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **callArgs delegate 인자-충실도(happy-path)**: `expect(callArgsSpy).toHaveBeenCalledWith(producedInputs, modelId)` 를 추가해 callArgs 위임이 (산출 inputs + 가드의 `modelId`) payload 로 호출됨을 canonical matcher 로 lock. `producedInputs` 는 `inputsSpy.mock.results[0].value` 로 캡처(가드가 inputs 산출을 그대로 callArgs 첫 인자로 threading 함을 참조-충실도까지 포함).
- [ ] **negative — shape/payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(inputsSpy).not.toHaveBeenCalledWith([])`(빈 배열 입력으로는 매칭 안 됨) 또는 callArgs 가 잘못된 modelId 로는 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe(negative (4)/(5)/(6)) 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/여분 인자**: callArgs 가 정확히 2 인자로 호출됨(여분 인자 0)을 `callArgsSpy.mock.calls[0].length === 2` 또는 `toHaveBeenCalledWith(producedInputs, modelId)` 의 정확 매칭으로 확인하는 assert 1+. inputs 가 정확히 1 인자(`inputsSpy.mock.calls[0].length === 1`)임도 lock.
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-evaluation-plan-consistency.spec.ts` ≥ 2(본 leg 이 evaluation-plan seam 인자-충실도를 최초 lock — audit 후보 2 leg2 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 T-1055 order-lock·T-1067 struct-precede it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-evaluation-plan.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 evaluation-plan **한 seam** 만. 나머지 seam(result-issue-command-plan·result-issue-publish-plan·daily-step 계열 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **struct-precede(T-1067)·call-count exactly-N(T-1055)·order-lock 재유도** — (a)/(b) 는 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder` assert 제거·변경 금지(유지만).
- **result-report-plan 인자-충실도(T-1098)** — 별개 파일·leg1(머지 완료).
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 다음 seam 확장). implementer 는 T-1055 order-lock describe 의 `inputsSpy`/`callArgsSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 인자-충실도 assert + 인자-축 negative 2종을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 evaluation-plan seam 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 seam(result-issue-command-plan·result-issue-publish-plan·daily-step dual-leg 계열 등 `toHaveBeenCalledWith` count=0 consistency spec) 또는 P5 의 다른 PLAN bullet 로 전환.
