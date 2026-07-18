---
id: T-1107
title: realdata-e2e daily-step dual-leg run-report-issue-gh-command-plan 재유도 3-delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg10
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 42
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg10 — daily-step dual-leg run-report-issue-gh-command-plan 재유도 3-delegate(parse(stdout)/resolveAction(hits,searchQuery)/buildGhArgv(action,commandArgs)) toHaveBeenCalledWith payload 충실도 lock. spec W=0 적격(T=19/O=15/S=17), T-1060 order-lock spy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1107 — realdata-e2e daily-step dual-leg run-report-issue-gh-command-plan 재유도 3-delegate 인자-충실도 완결 (§D 후보 2 leg10)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 후보 (a)/(b) 소진을 확정한 뒤, **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 leg1~leg9(T-1098 result-report-plan · T-1099 evaluation-plan · T-1100 result-issue-publish-plan · T-1101 result-issue-command-plan · T-1102 result-issue-gh-command-plan · T-1103 step-args aggregator · T-1104 result-issue-outcome-report-from-output · T-1105 daily-step dual-leg outcome-report-from-output · [T-1106](T-1106-daily-run-report-issue-command-plan-argfidelity.md) daily-step dual-leg run-report-issue-command-plan)로 진행됐다. leg1~7 은 `result-issue` 계열을, leg8~9 은 daily 형제 계열의 outcome-report-from-output·run-report-issue-command-plan seam(모두 2-delegate)을 소진했다.

본 leg 은 그 인자-충실도 sweep 의 **leg10** 로, **`daily-step dual-leg` 형제 계열의 세 번째 seam** — 일일 실행 gh 명령 argv composer-seam 가드 `realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency` 를 대상으로 한다. 이 가드는 leg8~9 의 2-delegate 변형과 달리 composer 산출 plan(`{action, argv}`)을 **세 distinct builder 로 재유도**(parse → resolveAction → buildGhArgv)해 정합을 대조하는 **3-delegate chain** 경로다. call-count·순서(invocationCallOrder 2 edges)·첫-인자 reference chain(2 페어링)은 이미 [T-1060 order-lock] 선행성으로 못박혔으나, 각 order-locked spy 가 **어떤 완전한 인자 payload 로** 호출됐는지(`toHaveBeenCalledWith`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준 — T-1106 머지 PR #998 squash 671de38b 이후):
- 대상 spec `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 19건·`invocationCallOrder` 15건·`jest.spyOn` 17건 보유 → order-lock spy 인프라는 이미 조밀(W=0 & T>0 잔여 후보군에 속함).
- 가드 소스 `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` L228~237 실증: 재유도 경로가 3 delegate 를 순차 호출한다 —
  - `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)`(**1 인자** = 가드의 `stdout`),
  - `resolveRealDataDailyStepDualLegRunReportIssueAction(expectedHits, commandArgs.searchQuery)`(**2 인자** = parse 산출 `expectedHits` + 가드의 `commandArgs.searchQuery`),
  - `buildRealDataDailyStepDualLegRunReportIssueGhArgv(expectedAction, commandArgs)`(**2 인자** = resolveAction 산출 `expectedAction` + 가드의 `commandArgs`).
- 기존 spec 의 T-1060 order-lock happy-path it(L854~898)에 `parseSpy`(searchParseModule)/`actionSpy`(actionModule)/`ghArgvSpy`(ghArgvModule)를 설치해 `toHaveBeenCalledTimes(1)` ×3 + `invocationCallOrder` 부등식 2개(parse < resolveAction < buildGhArgv) + **첫-인자** reference 페어링 2개(`actionSpy.mock.calls[0][0].toBe(producedHits)`(L893) · `ghArgvSpy.mock.calls[0][0].toBe(producedAction)`(L897))만 못박고, **parse 위임의 `stdout` 인자·resolveAction 위임의 둘째 인자 `searchQuery`·buildGhArgv 위임의 둘째 인자 `commandArgs` payload 충실도(`toHaveBeenCalledWith`)는 assert 하지 않는다** → 진성 인자-충실도 gap. (leg8~9 gap 과 동형 주제 — 단 본 seam 은 3-delegate chain 이며 둘째·셋째 delegate 각각 2-arg 라 둘째 인자 충실도 lock 이 2개 필요하다.)

## Required Reading

- `docs/tasks/T-1106-daily-run-report-issue-command-plan-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 본 leg 은 daily 형제 sweep 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative + arity 봉함)을 동형 재사용한다. 단 본 seam 은 delegate 가 2개가 아니라 **3개**(parse 1-arg / resolveAction 2-arg / buildGhArgv 2-arg)다 — arg-fidelity assert·arity 봉함이 각 3개씩 필요.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` — **T-1060 order-lock happy-path it(L854~898)의 `parseSpy`/`actionSpy`/`ghArgvSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe(producedHits)`/`.toBe(producedAction)` 패턴과 fixture(`stdout = "[]"`(L857)·`makeCommandArgs()`(L49~, default `searchQuery = MARKER` L60))·module alias(`searchParseModule`(L39)/`actionModule`(L31)/`ghArgvModule`(L33))만.** 기존 spy 인프라를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe(L853~) 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts` — **L228~237 재유도 call site 3줄만.** `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` / `resolveRealDataDailyStepDualLegRunReportIssueAction(expectedHits, commandArgs.searchQuery)` / `buildRealDataDailyStepDualLegRunReportIssueGhArgv(expectedAction, commandArgs)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **parse delegate 인자-충실도(happy-path, 1-arg)**: T-1060 order-lock happy-path it(L854) 에서 `expect(parseSpy).toHaveBeenCalledWith(stdout)` 를 추가해(fixture `stdout = "[]"`), sub-composer ① 위임이 가드의 **정확한 `stdout` 문자열** 완전 충실도(payload 누락/치환 없음)로 호출됨을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **resolveAction delegate 인자-충실도(happy-path, 둘째 인자 `searchQuery` 포함)**: `expect(actionSpy).toHaveBeenCalledWith(producedHits, commandArgs.searchQuery)` 를 추가해(`producedHits = parseSpy.mock.results[0].value`), sub-composer ② 위임이 **첫 인자 hits reference 뿐 아니라 둘째 인자 `searchQuery` payload 까지** 두 인자 완전 충실도로 호출됨을 lock. 기존 첫-인자 `.toBe(producedHits)`(L893) reference assert·`invocationCallOrder` 부등식은 제거 말고 유지.
- [ ] **buildGhArgv delegate 인자-충실도(happy-path, 둘째 인자 `commandArgs` 포함)**: `expect(ghArgvSpy).toHaveBeenCalledWith(producedAction, commandArgs)` 를 추가해(`producedAction = actionSpy.mock.results[0].value`), sub-composer ③ 위임이 **첫 인자 action reference 뿐 아니라 둘째 인자 `commandArgs` payload 까지** 두 인자 완전 충실도로 호출됨을 lock. 기존 첫-인자 `.toBe(producedAction)`(L897) reference assert·`invocationCallOrder` 부등식(resolveAction < buildGhArgv)은 제거 말고 유지(순서 + reference + full payload 모두).
- [ ] **negative — 인자 payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(actionSpy).not.toHaveBeenCalledWith(producedHits, "다른-searchQuery")`(둘째 인자 drift 가 매칭 안 됨) 또는 `expect(ghArgvSpy).not.toHaveBeenCalledWith(producedAction, {} )`(둘째 인자 commandArgs drift 가 매칭 안 됨) 형태로 payload drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/arity 봉함**: parse 가 정확히 1 인자로 호출됨을 `parseSpy.mock.calls[0].length === 1` 로, resolveAction·buildGhArgv 가 각각 정확히 2 인자임을 `actionSpy.mock.calls[0].length === 2`·`ghArgvSpy.mock.calls[0].length === 2` 로 lock 하는 assert 각 1+(여분 인자 0 — 세 delegate 의 서로 다른 arity 각각 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it(L854) 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.spec.ts` ≥ 3(본 leg 이 daily-step dual-leg run-report-issue-gh-command-plan seam 3-delegate 인자-충실도를 최초 lock — audit 후보 2 leg10, daily 형제 계열 세 번째 seam·첫 3-delegate seam 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 T-1060 order-lock·구조-검사 선행성·값-drift RangeError negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan-consistency.ts`·`realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts`·`realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts`·`realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 daily-step dual-leg run-report-issue-gh-command-plan **한 seam** 만. 나머지 W=0 & T>0 & O>0 daily-step seam(collect-command-plan/eval-command-plan 등)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **구조-검사 선행성·call-count exactly-N·order-lock 재유도(T-1060)** — 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe(producedHits)`/`.toBe(producedAction)` assert 제거·변경 금지(유지만).
- **result-issue 계열·daily outcome-report-from-output·run-report-issue-command-plan 인자-충실도(leg1~9: T-1098~T-1106)** — 별개 파일, 머지 완료.
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 daily 형제 계열 확장). implementer 는 T-1060 order-lock happy-path it 의 `parseSpy`/`actionSpy`/`ghArgvSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 3-delegate(parse 1-arg / resolveAction 2-arg / buildGhArgv 2-arg) 인자-충실도 assert(둘째 인자 `searchQuery`·`commandArgs` 포함) + 인자-축 negative 2종(payload drift + arity 봉함 3개)을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 daily-step dual-leg run-report-issue-gh-command-plan seam 3-delegate 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 daily-step seam(collect-command-plan·eval-command-plan 등 잔여 W=0 & T>0 seam — 모두 `toHaveBeenCalledWith` count=0 이면서 order-lock spy 인프라 보유; 정확한 파일명·적격은 다음 planner pre-check 로 grep 확인) 또는 잔여 seam 소진 후 completion-audit(후보 2 소진 확정) 또는 P5 의 다른 PLAN bullet 로 전환.
