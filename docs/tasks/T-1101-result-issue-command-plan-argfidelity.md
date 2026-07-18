---
id: T-1101
title: realdata-e2e result-issue-command-plan 재유도 2-delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg4
phase: P5
status: DONE
completedAt: 2026-07-18T00:54:04Z
mergedAs: 2f1cf2149c1324bae95beca3df3c8d4c07d36a2b
prNumber: 993
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 38
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg4 — result-issue-command-plan 재유도 2-delegate(report-plan(results,run)/command-args(descriptor)) toHaveBeenCalledWith payload 충실도 lock. spec count=0 적격, T-1056 order-lock spy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1101 — realdata-e2e result-issue-command-plan 재유도 2-delegate 인자-충실도 완결 (§D 후보 2 leg4)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 섹션 D **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 [T-1098](T-1098-result-report-plan-argfidelity.md)(result-report-plan, leg1)·[T-1099](T-1099-evaluation-plan-argfidelity.md)(evaluation-plan 2-delegate, leg2)·[T-1100](T-1100-publish-plan-argfidelity.md)(result-issue-publish-plan 2-delegate, leg3)로 진행됐다.

본 leg 은 그 인자-충실도 sweep 의 **leg4** 로 `result-issue-command-plan` consistency-guard 의 재유도 2-delegate 를 대상으로 한다. call-count(호출 횟수)·순서(invocationCallOrder)는 이미 [T-1094](T-1094-result-issue-command-plan-callcount.md) call-count·T-1056 order-lock 으로 소진됐고 threading(builder ② 첫 인자 = builder ① 산출 descriptor 의 reference 동일성)도 못박혔으나, 각 order-locked spy 가 **어떤 인자 payload 로** 호출됐는지는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준):
- 대상 spec `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 26건·`invocationCallOrder` 9건·`jest.spyOn` 9건 보유 → order-lock spy 인프라는 이미 조밀.
- 가드 소스 `test/helpers/realdata-e2e-result-issue-command-plan.ts` L126/L131 실증: 재유도 경로가 `buildRealDataResultReportPlan(results, run)`(2 인자 = 가드의 `results` 배열 + `run` 입력) → `buildRealDataResultIssueCommandArgs(report.descriptor)`(1 인자 = builder ① 산출 report 의 descriptor) 두 delegate 를 순차 호출한다.
- 기존 spec 은 T-1056 order-lock describe(L787~830)에 `reportSpy`(resultReportPlanModule)/`commandArgsSpy`(resultIssueCommandArgsModule)를 설치해 `toHaveBeenCalledTimes(1)` + `invocationCallOrder` 부등식(report-plan < command-args) + threading `.toBe(producedReport.descriptor)`(reference 동일성, L823)만 못박고 **입력 payload 는 assert 하지 않는다** → 진성 인자-충실도 gap. (publish-plan 의 T-1100 gap 과 동형.)

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 D 후보 2만.** 인자-충실도 축의 적격 판정 grep·근거.
- `docs/tasks/T-1100-publish-plan-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 인자-충실도 leg 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative 2종) 을 본 leg 이 동형 재사용한다.
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` — **T-1056 order-lock describe(L787~830)의 `reportSpy`/`commandArgsSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder`·threading(`.toBe(producedReport.descriptor)`) 패턴만.** 기존 spy 인프라(`resultReportPlanModule`/`resultIssueCommandArgsModule` alias, `makeResult()`/`makeRun()` fixture)를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — **L126·L131 재유도 call site 2줄만.** `buildRealDataResultReportPlan(results, run)` / `buildRealDataResultIssueCommandArgs(report.descriptor)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-result-issue-command-plan-consistency.spec.ts`) 에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit) 로 본 spec 실행.

- [ ] **report-plan delegate 인자-충실도(happy-path)**: T-1056 order-lock it(L792, "정합 재유도 시 report-plan 위임이 command-args 위임보다 먼저 호출된다") 에서 `expect(reportSpy).toHaveBeenCalledWith(results, run)` 를 추가해, builder ① 위임이 가드의 **정확한 `results` 배열 + `run` 식별자**로 호출됨(payload 누락/치환 없음)을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **command-args delegate 인자-충실도(happy-path)**: `expect(commandArgsSpy).toHaveBeenCalledWith(producedReport.descriptor)` 를 추가해 builder ② 위임이 builder ① 산출 report 의 descriptor payload 로 호출됨을 canonical matcher 로 lock. `producedReport` 는 이미 spec 에 캡처된 `reportSpy.mock.results[0].value`(L822) 재사용. 기존 `.toBe(producedReport.descriptor)` reference 동일성 assert 는 제거 말고 유지(reference + payload 둘 다).
- [ ] **negative — shape/payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(reportSpy).not.toHaveBeenCalledWith([], run)`(빈 results 로는 매칭 안 됨) 또는 command-args 가 다른 descriptor 로는 매칭되지 않음(`expect(commandArgsSpy).not.toHaveBeenCalledWith(expect.objectContaining({ ... 다른 값 }))` 형태)을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe(negative ①~⑥ 계열, L349~) 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/여분 인자**: report-plan 이 정확히 2 인자로 호출됨(여분 인자 0)을 `reportSpy.mock.calls[0].length === 2` 로, command-args 가 정확히 1 인자임을 `commandArgsSpy.mock.calls[0].length === 1` 로 lock 하는 assert 각 1+.
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` ≥ 2(본 leg 이 result-issue-command-plan seam 인자-충실도를 최초 lock — audit 후보 2 leg4 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 T-1056 order-lock·T-1068 struct-precede·negative ①~⑥ it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-result-issue-command-plan.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 result-issue-command-plan **한 seam** 만. 나머지 seam(step-args·result-issue-gh-command-plan·daily-step dual-leg 계열 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **struct-precede(T-1068)·call-count exactly-N(T-1094)·order-lock 재유도(T-1056)** — (a)/(b) 는 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe` threading assert 제거·변경 금지(유지만).
- **result-report-plan(T-1098)·evaluation-plan(T-1099)·result-issue-publish-plan(T-1100) 인자-충실도** — 별개 파일·leg1/leg2/leg3(머지 완료).
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 다음 seam 확장). implementer 는 T-1056 order-lock describe 의 `reportSpy`/`commandArgsSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 인자-충실도 assert + 인자-축 negative 2종을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 result-issue-command-plan seam 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 seam(step-args·result-issue-gh-command-plan·result-issue-outcome-report-from-output·daily-step dual-leg 계열 등 `toHaveBeenCalledWith` count=0 이면서 2+-delegate order-lock 인프라 보유 consistency spec — planner pre-check 로 W=0 & T>0 목록 12건 확인) 또는 P5 의 다른 PLAN bullet 로 전환.
