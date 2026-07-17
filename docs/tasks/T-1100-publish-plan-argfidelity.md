---
id: T-1100
title: realdata-e2e result-issue-publish-plan 재유도 delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg3
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 42
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg3 — result-issue-publish-plan 재유도 2-delegate(command-plan/search-gh-argv) toHaveBeenCalledWith payload 충실도 lock. spec count=0 적격, T-1057 order-lock spy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1100 — realdata-e2e result-issue-publish-plan 재유도 delegate 인자-충실도 완결 (§D 후보 2 leg3)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 섹션 D **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 [T-1098](T-1098-result-report-plan-argfidelity.md)(result-report-plan seam, leg1)·[T-1099](T-1099-evaluation-plan-argfidelity.md)(evaluation-plan 2-delegate, leg2)로 진행됐다.

본 leg 은 그 인자-충실도 sweep 의 **leg3** 로 `result-issue-publish-plan` consistency-guard 의 재유도 2-delegate 를 대상으로 한다. call-count(호출 횟수)·순서(invocationCallOrder)는 이미 [T-1092](T-1092-result-issue-publish-plan-callcount.md) call-count·T-1057 order-lock 으로 소진됐고 threading(reference 동일성)도 못박혔으나, 각 order-locked spy 가 **어떤 인자 payload 로** 호출됐는지는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준):
- 대상 spec `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock).
- 가드 소스 `test/helpers/realdata-e2e-result-issue-publish-plan.ts` L142/L148 실증: 재유도 경로가 `buildRealDataResultIssueCommandPlan(results, run)`(2 인자 = 가드의 `results` + `run` 입력) → `buildRealDataResultIssueSearchGhArgv(commandArgs)`(1 인자 = builder ① 산출 commandArgs) 두 delegate 를 호출한다.
- 기존 spec 은 T-1057 order-lock describe(L442~)에 `commandPlanSpy`/`searchArgvSpy` 를 설치해 `toHaveBeenCalledTimes(1)` + `invocationCallOrder` 부등식(command-plan < search-gh-argv) + threading `.toBe(producedCommandPlan.commandArgs)`(reference 동일성)만 못박고 **입력 payload 는 assert 하지 않는다** → 진성 인자-충실도 gap. (evaluation-plan 의 T-1099 gap 과 동형.)

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 D 후보 2만.** 인자-충실도 축의 적격 판정 grep·근거.
- `docs/tasks/T-1099-evaluation-plan-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 인자-충실도 leg 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative 2종) 을 본 leg 이 동형 재사용한다.
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts` — **T-1057 order-lock describe(L442~480)의 `commandPlanSpy`/`searchArgvSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder`·threading 패턴만.** 기존 spy 인프라(`commandPlanModule`/`searchArgvModule` alias, `HAPPY_RESULTS`/`HAPPY_RUN` fixture)를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — **L142·L148 재유도 call site 2줄만.** `buildRealDataResultIssueCommandPlan(results, run)` / `buildRealDataResultIssueSearchGhArgv(commandArgs)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-result-issue-publish-plan-consistency.spec.ts`) 에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit) 로 본 spec 실행.

- [ ] **command-plan delegate 인자-충실도(happy-path)**: T-1057 order-lock it(또는 재유도 happy-path)에서 `expect(commandPlanSpy).toHaveBeenCalledWith(HAPPY_RESULTS, HAPPY_RUN)` 를 추가해, builder ① 위임이 가드의 **정확한 `results` 배열 + `run` 식별자**로 호출됨(payload 누락/치환 없음)을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **search-gh-argv delegate 인자-충실도(happy-path)**: `expect(searchArgvSpy).toHaveBeenCalledWith(producedCommandArgs)` 를 추가해 builder ② 위임이 builder ① 산출 commandArgs payload 로 호출됨을 canonical matcher 로 lock. `producedCommandArgs` 는 `commandPlanSpy.mock.results[0].value.commandArgs` 로 캡처(가드가 command-plan 산출 commandArgs 를 그대로 search-gh-argv 첫 인자로 threading 함을 값-충실도까지 포함). 기존 `.toBe(...)` reference 동일성 assert 는 제거 말고 유지.
- [ ] **negative — shape/payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(commandPlanSpy).not.toHaveBeenCalledWith([], HAPPY_RUN)`(빈 results 로는 매칭 안 됨) 또는 search-gh-argv 가 다른 commandArgs 로는 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe(negative (a) 계열) 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/여분 인자**: command-plan 이 정확히 2 인자로 호출됨(여분 인자 0)을 `commandPlanSpy.mock.calls[0].length === 2` 또는 `toHaveBeenCalledWith(HAPPY_RESULTS, HAPPY_RUN)` 의 정확 매칭으로 확인하는 assert 1+. search-gh-argv 가 정확히 1 인자(`searchArgvSpy.mock.calls[0].length === 1`)임도 lock.
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts` ≥ 2(본 leg 이 result-issue-publish-plan seam 인자-충실도를 최초 lock — audit 후보 2 leg3 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 T-1057 order-lock·T-1069 struct-precede·negative (a)~(f) it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-result-issue-publish-plan.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 result-issue-publish-plan **한 seam** 만. 나머지 seam(result-issue-command-plan·daily-step dual-leg 계열 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **struct-precede(T-1069)·call-count exactly-N(T-1092)·order-lock 재유도(T-1057)** — (a)/(b) 는 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe` threading assert 제거·변경 금지(유지만).
- **result-report-plan(T-1098)·evaluation-plan(T-1099) 인자-충실도** — 별개 파일·leg1/leg2(머지 완료).
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 다음 seam 확장). implementer 는 T-1057 order-lock describe 의 `commandPlanSpy`/`searchArgvSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 인자-충실도 assert + 인자-축 negative 2종을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 result-issue-publish-plan seam 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 seam(result-issue-command-plan·daily-step dual-leg 계열 등 `toHaveBeenCalledWith` count=0 이면서 2-delegate order-lock 인프라 보유 consistency spec) 또는 P5 의 다른 PLAN bullet 로 전환.
