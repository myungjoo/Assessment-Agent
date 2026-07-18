---
id: T-1108
title: realdata-e2e daily-step collect-command-plan 재유도 1-delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg11
phase: P5
status: DONE
mergedAs: 086161ee
prNumber: 1000
reviewRounds: 1
completedAt: 2026-07-18T04:47:00Z
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg11 — daily-step collect-command-plan 재유도 1-delegate(resolveRealDataE2eLiveGating(env)) toHaveBeenCalledWith payload 충실도 lock. spec W=0 적격(T=5/O=2), 기존 resolveSpy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1108 — realdata-e2e daily-step collect-command-plan 재유도 1-delegate 인자-충실도 완결 (§D 후보 2 leg11)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 후보 (a)/(b) 소진을 확정한 뒤, **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 leg1~leg10(T-1098~[T-1107](T-1107-daily-run-report-issue-gh-command-plan-argfidelity.md))로 진행됐다. leg1~7 은 `result-issue` 계열을, leg8~10 은 daily-step dual-leg 형제 계열(outcome-report-from-output · run-report-issue-command-plan · run-report-issue-gh-command-plan)의 seam 을 소진했다. daily-step dual-leg 계열의 W=0 & T>0 잔여 seam 은 planner pre-check(2026-07-18 grep) 에서 소진 확정됐다.

본 leg 은 그 인자-충실도 sweep 의 **leg11** 로, dual-leg 계열이 아닌 **`daily-step collect-command-plan` leaf 컴포저 seam** 을 대상으로 한다(T-1107 Follow-ups 가 지목한 collect-command-plan/eval-command-plan 잔여 seam 의 첫 소진). 이 가드 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating` 는 leg8~10 의 다중 delegate 변형과 달리 컴포저 산출 plan 을 **단일 delegate `resolveRealDataE2eLiveGating(env)` 로 재유도**해 gating 정합을 대조하는 **1-delegate** 경로다(guard 소스 L174). call-count(happy exactly-1 · double-invoke exactly-2 · 구조 결손 0-call)·도달 순번(`invocationCallOrder[0] > 0`)은 이미 못박혔으나, 그 order-locked resolveSpy 가 **어떤 인자 payload 로**(정확히 주입 `env` 객체 자체) 호출됐는지(`toHaveBeenCalledWith`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준 — T-1107 머지 PR #999 squash 3000a013 이후):
- 대상 spec `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 5건·`invocationCallOrder` 2건·`jest.spyOn` 다수 보유 → order-lock spy 인프라 조밀(W=0 & T>0 잔여 후보군).
- 가드 소스 `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` L174 실증: 재유도 경로가 단일 delegate `resolveRealDataE2eLiveGating(env)`(**1 인자** = 가드의 주입 `env` 객체)를 호출해 expected gating 을 single-source 로 얻는다.
- 기존 spec 의 happy-path order-lock it(L606~627)에 `resolveSpy = jest.spyOn(gatingModule, "resolveRealDataE2eLiveGating")`(L611)를 설치해 `toHaveBeenCalledTimes(1)`(L625) + `invocationCallOrder[0] > 0`(L626)만 못박고, **delegate 위임의 `env` 인자 payload 충실도(`toHaveBeenCalledWith`)는 assert 하지 않는다** → 진성 인자-충실도 gap. fixture 는 `env = makeEnabledEnv()`(L609)·`plan = buildConsistent(env)`(L610), module alias `gatingModule`(L36 `import * as gatingModule from "./realdata-e2e-live-gating"`).

## Required Reading

- `docs/tasks/T-1107-daily-run-report-issue-gh-command-plan-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg 은 인자-충실도 sweep 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative + arity 봉함)을 동형 재사용한다. 단 본 seam 은 delegate 가 3개가 아니라 **1개**(resolveRealDataE2eLiveGating, 1-arg `env`)다 — arg-fidelity assert·arity 봉함이 각 1개씩만 필요.
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` — **happy-path order-lock it(L606~627)의 `resolveSpy` spyOn 설치(L611)·`toHaveBeenCalledTimes(1)`(L625)/`invocationCallOrder[0] > 0`(L626) 패턴과 fixture(`makeEnabledEnv()`(L49~)·`buildConsistent(env)`(L64~))·module alias(`gatingModule`(L36))만.** 기존 spy 인프라를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe(L605~) 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` — **L174 재유도 call site 1줄만.** `const gating = resolveRealDataE2eLiveGating(env);` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용, 단일 1-arg `env` delegate).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **resolveRealDataE2eLiveGating delegate 인자-충실도(happy-path, 1-arg `env`)**: happy-path order-lock it(L606) 에서 `expect(resolveSpy).toHaveBeenCalledWith(env)` 를 추가해(fixture `env = makeEnabledEnv()`), 재유도 위임이 가드에 주입된 **정확한 `env` 객체** 완전 충실도(payload 누락/치환/부분 복사 없음)로 호출됨을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)`·`invocationCallOrder[0] > 0` 는 제거 말고 유지(횟수+순번+인자 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(resolveSpy).not.toHaveBeenCalledWith(makeEnabledEnv())`(구조적으로 동등하나 **다른 인스턴스** env 는 `toBe` 참조 매칭이 아닌 값 매칭이므로, 값이 실제로 다른 env — 예: 다른 gating 키/값을 담은 별도 env — 로 대조) 또는 `expect(resolveSpy).not.toHaveBeenCalledWith({})`(빈 env drift 가 매칭 안 됨) 형태로 payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 it(action↔gating 매핑 위반 등)을 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.** (주의: `toHaveBeenCalledWith` 는 deep-equality 매칭이므로 negative 대상 env 는 실제 값이 다르도록 구성 — 동일 값 다른 인스턴스는 match 될 수 있음.)
- [ ] **negative — 인자 개수/arity 봉함**: resolveRealDataE2eLiveGating 이 정확히 1 인자로 호출됨을 `expect(resolveSpy.mock.calls[0].length).toBe(1)` 로 lock 하는 assert 1+(여분 인자 0 — 단일 delegate 의 1-arity 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 order-lock it(L606) 단일 경로 tighten — 새 분기 도입 0. 재유도 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` ≥ 1(본 leg 이 daily-step collect-command-plan seam 1-delegate 인자-충실도를 최초 lock — audit 후보 2 leg11, dual-leg 계열 소진 후 leaf 컴포저 계열 첫 소진).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 order-lock happy exactly-1·double-invoke exactly-2·구조 결손 0-call·값-drift RangeError negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-daily-step-collect-command-plan-consistency.ts`·`realdata-e2e-live-gating.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저/gating helper 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 daily-step collect-command-plan **한 seam** 만. 형제 seam `eval-command-plan`(동일 W=0/T=5/O=2 적격)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **구조-검사 선행성·call-count exactly-N(happy 1 / double 2 / 구조 0)·order-lock 재유도** — 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder` assert 제거·변경 금지(유지만).
- **result-issue 계열·daily-step dual-leg 형제 계열(outcome-report-from-output·run-report-issue-command-plan·run-report-issue-gh-command-plan) 인자-충실도(leg1~10: T-1098~T-1107)** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 leaf 컴포저 계열 확장). implementer 는 happy-path order-lock it(L606) 의 `resolveSpy` 인프라를 재사용해 `toHaveBeenCalledWith(env)` 1-delegate(resolveRealDataE2eLiveGating, 1-arg) 인자-충실도 assert + 인자-축 negative 2종(payload drift + arity 봉함 1개)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 daily-step collect-command-plan seam 1-delegate 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 형제 seam `eval-command-plan`(W=0 & T=5 & O=2 적격 — `toHaveBeenCalledWith` count=0 이면서 order-lock spy 인프라 보유; 다음 planner pre-check 로 grep 재확인) 또는 잔여 W=0 & T>0 seam(evaluation-inputs·github-collection-live·seed-upsert 등 non-daily-step 계열) 소진 후 completion-audit(후보 2 소진 확정) 또는 P5 의 다른 PLAN bullet 로 전환.
