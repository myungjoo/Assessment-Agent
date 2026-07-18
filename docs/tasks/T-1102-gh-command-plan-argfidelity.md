---
id: T-1102
title: realdata-e2e result-issue-gh-command-plan 재유도 3-delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg5
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 44
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg5 — result-issue-gh-command-plan 재유도 3-delegate(parse(stdout)/resolveAction(hits,searchQuery)/buildGhArgv(action,commandArgs)) toHaveBeenCalledWith payload 충실도 lock. spec W=0 적격, T-1063 order-lock spy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1102 — realdata-e2e result-issue-gh-command-plan 재유도 3-delegate 인자-충실도 완결 (§D 후보 2 leg5)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 후보 (a)/(b) 소진을 확정한 뒤, **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 [T-1098](T-1098-result-report-plan-argfidelity.md)(result-report-plan, leg1)·[T-1099](T-1099-evaluation-plan-argfidelity.md)(evaluation-plan 2-delegate, leg2)·[T-1100](T-1100-publish-plan-argfidelity.md)(result-issue-publish-plan 2-delegate, leg3)·[T-1101](T-1101-result-issue-command-plan-argfidelity.md)(result-issue-command-plan 2-delegate, leg4)로 진행됐다.

본 leg 은 그 인자-충실도 sweep 의 **leg5** 로, T-1101 result-issue-command-plan seam 의 **gh-command 형제 seam** 인 `result-issue-gh-command-plan` consistency-guard 를 대상으로 한다. 이 seam 은 앞선 legs 의 2-delegate 보다 큰 **3-delegate 재유도**(parse → resolveAction → buildGhArgv)라 인자-충실도 표면이 더 넓다. call-count·순서(invocationCallOrder)·**첫 인자 reference threading** 은 이미 [T-1063](T-1063-... ) order-lock 으로 못박혔으나, 각 order-locked spy 가 **어떤 완전한 인자 payload 로** 호출됐는지(특히 첫 인자가 아닌 **둘째 인자** — resolveAction 의 `commandArgs.searchQuery`, buildGhArgv 의 `commandArgs`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준):
- 대상 spec `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 48건·`invocationCallOrder` 18건·`jest.spyOn` 17건 보유 → order-lock spy 인프라는 이미 매우 조밀(W=0 & T>0 후보 11건 중 order-lock 인프라 최다).
- 가드 소스 `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` L224~232 실증: 재유도 경로가 3 delegate 를 순차 호출한다 —
  - `parseRealDataResultIssueSearchOutput(stdout)`(1 인자 = 가드의 `stdout`),
  - `resolveRealDataResultIssueAction(expectedHits, commandArgs.searchQuery)`(2 인자 = builder ① 산출 hits + `commandArgs.searchQuery`),
  - `buildRealDataResultIssueGhArgv(expectedAction, commandArgs)`(2 인자 = builder ② 산출 action + `commandArgs` 전체).
- 기존 spec 은 T-1063 order-lock describe(L730~775)에 `parseSpy`(searchParseModule)/`actionSpy`(actionModule)/`ghArgvSpy`(ghArgvModule)를 설치해 `toHaveBeenCalledTimes(1)` ×3 + `invocationCallOrder` 부등식 2개(parse < resolveAction < buildGhArgv) + threading `.toBe(producedHits)`(L770)·`.toBe(producedAction)`(L774)로 **첫 인자 reference** 만 못박고 **완전한 입력 payload(특히 둘째 인자)는 assert 하지 않는다** → 진성 인자-충실도 gap. (command-plan 의 T-1101 gap 과 동형이되 delegate 3개·둘째 인자 2개로 표면이 더 넓음.)

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 D 후보 2만.** 인자-충실도 축의 적격 판정 grep·근거.
- `docs/tasks/T-1101-result-issue-command-plan-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 인자-충실도 leg 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative 2종)을 본 leg 이 동형 재사용·3-delegate 로 확장한다.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` — **T-1063 order-lock describe(L730~775)의 `parseSpy`/`actionSpy`/`ghArgvSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder`·첫-인자 threading(`.toBe(producedHits)`/`.toBe(producedAction)`) 패턴만.** 기존 spy 인프라(`searchParseModule`/`actionModule`/`ghArgvModule` alias, `makeCommandArgs()`/`stdoutOf()` fixture)를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.ts` — **L224~232 재유도 call site 3줄만.** `parseRealDataResultIssueSearchOutput(stdout)` / `resolveRealDataResultIssueAction(expectedHits, commandArgs.searchQuery)` / `buildRealDataResultIssueGhArgv(expectedAction, commandArgs)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **parse delegate 인자-충실도(happy-path)**: T-1063 order-lock it(L731) 에서 `expect(parseSpy).toHaveBeenCalledWith(stdout)` 를 추가해, builder ① 위임이 가드의 **정확한 `stdout` 문자열**로 호출됨(payload 누락/치환 없음)을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **resolveAction delegate 인자-충실도(happy-path, 둘째 인자 포함)**: `expect(actionSpy).toHaveBeenCalledWith(producedHits, commandArgs.searchQuery)` 를 추가해, builder ② 위임이 builder ① 산출 hits + **가드의 `commandArgs.searchQuery`**(첫 인자 reference 뿐 아니라 둘째 인자 marker payload 까지) 두 인자 완전 충실도로 호출됨을 lock. 기존 `.toBe(producedHits)`(첫 인자 reference)는 제거 말고 유지(reference + full payload 둘 다).
- [ ] **buildGhArgv delegate 인자-충실도(happy-path, 둘째 인자 포함)**: `expect(ghArgvSpy).toHaveBeenCalledWith(producedAction, commandArgs)` 를 추가해, builder ③ 위임이 builder ② 산출 action + **가드의 `commandArgs` 전체**로 호출됨을 lock. 기존 `.toBe(producedAction)`(첫 인자 reference)는 유지(reference + full payload 둘 다).
- [ ] **negative — shape/payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(actionSpy).not.toHaveBeenCalledWith(producedHits, "다른-marker")`(둘째 인자 marker 가 다르면 매칭 안 됨) 또는 `expect(ghArgvSpy).not.toHaveBeenCalledWith(producedAction, expect.objectContaining({ searchQuery: "drift" }))` 형태로 둘째 인자 drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe(negative ①~⑥ 계열, L332~) 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/여분 인자**: parse 가 정확히 1 인자로 호출됨을 `parseSpy.mock.calls[0].length === 1` 로, resolveAction 이 정확히 2 인자임을 `actionSpy.mock.calls[0].length === 2` 로, buildGhArgv 가 정확히 2 인자임을 `ghArgvSpy.mock.calls[0].length === 2` 로 lock 하는 assert 각 1+(여분 인자 0 — 3 delegate 각 arity 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it(L731) 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-result-issue-gh-command-plan-consistency.spec.ts` ≥ 3(본 leg 이 result-issue-gh-command-plan seam 3-delegate 인자-충실도를 최초 lock — audit 후보 2 leg5 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 T-1063 order-lock·T-1071 struct-precede·negative ①~⑥ it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-result-issue-gh-command-plan.ts`·`-consistency.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 result-issue-gh-command-plan **한 seam** 만. 나머지 W=0 & T>0 seam(step-args·result-issue-outcome-report-from-output·daily-step dual-leg 계열 등 planner pre-check 로 확인한 잔여 10건)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **struct-precede(T-1071)·call-count exactly-N·order-lock 재유도(T-1063)** — 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe` threading assert 제거·변경 금지(유지만).
- **result-report-plan(T-1098)·evaluation-plan(T-1099)·result-issue-publish-plan(T-1100)·result-issue-command-plan(T-1101) 인자-충실도** — 별개 파일·leg1~4(머지 완료).
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 다음 seam 확장). implementer 는 T-1063 order-lock describe 의 `parseSpy`/`actionSpy`/`ghArgvSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 3-delegate 인자-충실도 assert(둘째 인자 포함) + 인자-축 negative 2종을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 result-issue-gh-command-plan seam 3-delegate 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 seam(step-args·result-issue-outcome-report-from-output·daily-step dual-leg run-report-issue-command-plan/gh-command-plan/outcome-report-from-output·daily-step-collect-command-plan·daily-step-eval-command-plan·evaluation-inputs·github-collection-live·seed-upsert 등 `toHaveBeenCalledWith` count=0 이면서 order-lock spy 인프라 보유 consistency spec — planner pre-check 로 W=0 & T>0 목록 잔여 10건 확인) 또는 P5 의 다른 PLAN bullet 로 전환.
