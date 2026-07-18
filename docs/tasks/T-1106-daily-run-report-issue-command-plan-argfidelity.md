---
id: T-1106
title: realdata-e2e daily-step dual-leg run-report-issue-command-plan 재유도 2-delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg9
phase: P5
status: DONE
mergedAs: 671de38b
prNumber: 998
completedAt: 2026-07-18T03:52:48Z
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg9 — daily-step dual-leg run-report-issue-command-plan 재유도 2-delegate(descriptor(report)/command-args(descriptor)) toHaveBeenCalledWith payload 충실도 lock. spec W=0 적격(T=28/O=11/S=10), T-1101 command-plan+T-1105 daily 형제 패턴 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1106 — realdata-e2e daily-step dual-leg run-report-issue-command-plan 재유도 2-delegate 인자-충실도 완결 (§D 후보 2 leg9)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 후보 (a)/(b) 소진을 확정한 뒤, **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 leg1~leg8(T-1098 result-report-plan · T-1099 evaluation-plan · T-1100 result-issue-publish-plan · T-1101 result-issue-command-plan · T-1102 result-issue-gh-command-plan · T-1103 step-args aggregator · T-1104 result-issue-outcome-report-from-output · [T-1105](T-1105-daily-outcome-report-from-output-argfidelity.md) daily-step dual-leg outcome-report-from-output)로 진행됐다. leg1~7 은 `result-issue` 계열을, leg8 은 daily 형제 계열의 첫 seam(outcome-report-from-output)을 소진했다.

본 leg 은 그 인자-충실도 sweep 의 **leg9** 로, **`daily-step dual-leg` 형제 계열의 두 번째 seam** — 일일 실행 command-plan composer-seam 가드 `realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency` 를 대상으로 한다. 이 가드는 leg4(T-1101)의 result-issue command-plan 변형과 **주제가 동형인 daily 형제**로, composer 산출 plan 을 두 distinct builder 로 **재유도**(descriptor → command-args)해 byte-identical 정합을 대조하는 2-delegate 경로다. call-count·순서(invocationCallOrder)·첫-인자 reference chain 은 이미 [T-1061 계열 order-lock] 선행성으로 못박혔으나, 각 order-locked spy 가 **어떤 완전한 인자 payload 로** 호출됐는지(`toHaveBeenCalledWith`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준 — T-1105 머지 PR #997 squash 3bd9ec17 이후):
- 대상 spec `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 28건·`invocationCallOrder` 11건·`jest.spyOn` 10건 보유 → order-lock spy 인프라는 이미 조밀(W=0 & T>0 잔여 후보군에 속함).
- 가드 소스 `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` L192~195 실증: 재유도 경로가 2 delegate 를 순차 호출한다 —
  - `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(**1 인자** = 가드의 `report`),
  - `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor)`(**1 인자** = descriptor 산출). (T-1104/T-1105 와 달리 두 delegate 모두 1-arg — mixed arity 아님.)
- 기존 spec 의 order-lock happy-path it(L576~605)에 `descriptorSpy`(descriptorModule)/`commandArgsSpy`(commandArgsModule)를 설치해 `toHaveBeenCalledTimes(1)` ×2 + `invocationCallOrder` 부등식 1개(descriptor < command-args) + command-args **첫 인자** reference(`.toBe(producedDescriptor)`, L604~605)만 못박고, **descriptor 위임의 `report` 인자 payload·command-args 위임 인자의 canonical `toHaveBeenCalledWith` 봉함은 assert 하지 않는다** → 진성 인자-충실도 gap. (leg4 T-1101 gap 과 동형 주제 — 단 본 daily 변형은 첫 delegate 가 `report-plan(results,run)` 2-arg 가 아니라 `descriptor(report)` 1-arg 다.)

## Required Reading

- `docs/tasks/T-1105-daily-outcome-report-from-output-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg 은 daily 형제 sweep 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative + arity 봉함)을 동형 재사용한다. 단 본 seam 은 두 delegate 모두 1-arg(descriptor(report)/command-args(descriptor))다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` — **order-lock happy-path it(L576~605)의 `descriptorSpy`/`commandArgsSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe(producedDescriptor)` 패턴과 fixture(`makeReport()`/`HAPPY_REPORT`(L53))·module alias(`descriptorModule`(L30)/`commandArgsModule`(L26))만.** 기존 spy 인프라를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe(L576~) 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts` — **L192~195 재유도 call site 2줄만.** `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` / `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(expectedDescriptor)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **descriptor delegate 인자-충실도(happy-path, 1-arg)**: order-lock happy-path it(L576) 에서 `expect(descriptorSpy).toHaveBeenCalledWith(HAPPY_REPORT)` 를 추가해, sub-composer ① 위임이 가드의 **정확한 `report` 객체** 완전 충실도(payload 누락/치환 없음)로 호출됨을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **command-args delegate 인자-충실도(happy-path, 1-arg)**: `expect(commandArgsSpy).toHaveBeenCalledWith(producedDescriptor)` 를 추가해(`producedDescriptor = descriptorSpy.mock.results[0].value`), sub-composer ② 위임이 descriptor 산출을 canonical `toHaveBeenCalledWith` 로 봉함함을 lock. 기존 첫-인자 `.toBe(producedDescriptor)`(L604~605) reference assert·`invocationCallOrder` 부등식(descriptor < command-args)은 제거 말고 유지(순서 + reference + full payload 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(descriptorSpy).not.toHaveBeenCalledWith(producedDescriptor)`(descriptor 위임에 산출 descriptor 를 넣으면 매칭 안 됨) 또는 `expect(commandArgsSpy).not.toHaveBeenCalledWith(HAPPY_REPORT)`(command-args 위임에 원본 report 를 넣으면 매칭 안 됨) 형태로 payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe(L116~) 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/arity 봉함**: descriptor 가 정확히 1 인자로 호출됨을 `descriptorSpy.mock.calls[0].length === 1` 로, command-args 가 정확히 1 인자임을 `commandArgsSpy.mock.calls[0].length === 1` 로 lock 하는 assert 각 1+(여분 인자 0 — 두 1-arg delegate 각각 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it(L576) 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.spec.ts` ≥ 2(본 leg 이 daily-step dual-leg run-report-issue-command-plan seam 2-delegate 인자-충실도를 최초 lock — audit 후보 2 leg9, daily 형제 계열 두 번째 seam 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 order-lock·구조-검사 선행성·값-drift RangeError negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-daily-step-dual-leg-run-report-issue-command-plan-consistency.ts`·`realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`·`realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 daily-step dual-leg run-report-issue-command-plan **한 seam** 만. 나머지 W=0 & T>0 & O>0 daily-step seam(run-report-issue-gh-command-plan(T=19 O=15 S=20) · collect-command-plan/eval-command-plan(각 T=5 O=2 S=4))의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **구조-검사 선행성·call-count exactly-N·order-lock 재유도** — 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe(producedDescriptor)` assert 제거·변경 금지(유지만).
- **result-issue 계열·daily outcome-report-from-output 인자-충실도(leg1~8: T-1098~T-1105)** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 daily 형제 계열 확장). implementer 는 order-lock happy-path it 의 `descriptorSpy`/`commandArgsSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 2-delegate(둘 다 1-arg) 인자-충실도 assert + 인자-축 negative 2종(payload drift + arity 봉함)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 daily-step dual-leg run-report-issue-command-plan seam 2-delegate 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 daily-step seam(run-report-issue-gh-command-plan(T=19 O=15 S=20 — 3-delegate 추정) / collect-command-plan·eval-command-plan(각 T=5 O=2 S=4) — 모두 `toHaveBeenCalledWith` count=0 이면서 order-lock spy 인프라 보유) 또는 잔여 3 seam 소진 후 completion-audit(후보 2 소진 확정) 또는 P5 의 다른 PLAN bullet 로 전환.
