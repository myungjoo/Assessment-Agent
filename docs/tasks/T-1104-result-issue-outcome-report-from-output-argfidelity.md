---
id: T-1104
title: realdata-e2e result-issue-outcome-report-from-output 재유도 2-delegate 인자-충실도 toHaveBeenCalledWith 완결 — §D 후보 2 leg7
phase: P5
status: DONE
mergedAs: e2c44af4
prNumber: 996
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 35
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts
independentStream: realdata-e2e-argfidelity
plannerNote: "P5 §D 후보 2(인자-충실도) leg7 — result-issue-outcome-report-from-output 재유도 2-delegate(parse(stdout)/buildOutcomeReport(outcome,run)) toHaveBeenCalledWith payload 충실도 lock. spec W=0 적격, T-1062 order-lock spy 인프라 재사용. test-only 1파일 pr, file-disjoint dep[] stage5b."
---

# T-1104 — realdata-e2e result-issue-outcome-report-from-output 재유도 2-delegate 인자-충실도 완결 (§D 후보 2 leg7)

## Why

P5 test-hardening sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 3 후보를 순차 소진해 왔다. [T-1096](T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md) audit 이 후보 (a)/(b) 소진을 확정한 뒤, **후보 2 — `toHaveBeenCalledWith` 인자-충실도 완결성** sweep 이 leg1~leg6(T-1098 result-report-plan · T-1099 evaluation-plan · T-1100 result-issue-publish-plan · T-1101 result-issue-command-plan · T-1102 result-issue-gh-command-plan · [T-1103](T-1103-step-args-argfidelity.md) step-args aggregator)로 진행됐다.

본 leg 은 그 인자-충실도 sweep 의 **leg7** 로, 결과 이슈 outcome-report composer-seam 가드 `realdata-e2e-result-issue-outcome-report-from-output-consistency` 를 대상으로 한다. 이 가드는 `buildRealDataResultIssueOutcomeReportFromOutput` composer 산출을 두 distinct builder 로 **재유도**(parse → buildOutcomeReport)해 byte-identical 정합을 대조하는 2-delegate 경로다. call-count·순서(invocationCallOrder)·첫-인자 reference chain 은 이미 [T-1062](T-1062-...) order-lock 으로 못박혔으나, 각 order-locked spy 가 **어떤 완전한 인자 payload 로** 호출됐는지(`toHaveBeenCalledWith`)는 미lock(spec 의 `toHaveBeenCalledWith` count = 0)이다.

pre-check(planner, 2026-07-18, origin/main HEAD 기준):
- 대상 spec `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts` 의 `toHaveBeenCalledWith` count = **0**(적격 — 인자-충실도 미lock). 반면 `toHaveBeenCalledTimes` 30건·`invocationCallOrder` 11건·`jest.spyOn` 13건 보유 → order-lock spy 인프라는 이미 조밀(W=0 & T>0 잔여 후보군에 속함).
- 가드 소스 `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` L168~171 실증: 재유도 경로가 2 delegate 를 순차 호출한다 —
  - `parseRealDataResultIssueCreateEditOutput(stdout)`(**1 인자** = 가드의 `stdout`),
  - `buildRealDataResultIssueOutcomeReport(outcome, run)`(**2 인자** = parse 산출 `outcome` + 가드의 `run`).
- 기존 spec 은 T-1062 order-lock describe(L366~397)에 `parseSpy`(outputParseModule)/`buildOutcomeSpy`(outcomeReportModule)를 설치해 `toHaveBeenCalledTimes(1)` ×2 + `invocationCallOrder` 부등식 1개(parse < buildOutcomeReport) + buildOutcome **첫 인자** reference(`.toBe(producedOutcome)`)만 못박고, **parse 위임의 `stdout` 인자·buildOutcome 위임의 둘째 인자 `run` payload 충실도는 assert 하지 않는다** → 진성 인자-충실도 gap. (앞선 2-delegate legs T-1099~T-1101/T-1103 gap 과 동형이나, 본 seam 은 두 delegate arity 가 서로 다르다 — parse 1-arg / buildOutcome 2-arg.)

## Required Reading

- `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` — **섹션 D 후보 2만.** 인자-충실도 축의 적격 판정 grep·근거.
- `docs/tasks/T-1103-step-args-argfidelity.md` — **Acceptance Criteria·Out of Scope 절만.** 인자-충실도 leg 의 canonical assert 패턴(`toHaveBeenCalledWith` + 인자-축 negative 2종)을 본 leg 이 동형 재사용·2-delegate(mixed arity)로 적용한다.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts` — **T-1062 order-lock describe(L366~397)의 `parseSpy`/`buildOutcomeSpy` spyOn 설치·`toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe(producedOutcome)` 패턴과 fixture(`makeHappyReport()`/`HAPPY_STDOUT`/`HAPPY_RUN`)만.** 기존 spy 인프라(`outputParseModule`/`outcomeReportModule` alias)를 재사용한다. 파일 전량 광범위 read 금지 — 대상 describe(L366~) 와 인접 spy 설치 패턴만.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — **L168~171 재유도 call site 3줄만.** `parseRealDataResultIssueCreateEditOutput(stdout)` / `buildRealDataResultIssueOutcomeReport(outcome, run)` 인자 형태 확인(이미 planner pre-check 로 확정 — 재확인용).

## Acceptance Criteria

test-only `commitMode: pr` — production src 변경 0 LOC. 기존 spec 1파일(`realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts`)에 인자-충실도 assert 추가/tighten만. CI 는 `pnpm test:cov`(unit)로 본 spec 실행.

- [ ] **parse delegate 인자-충실도(happy-path, 1-arg)**: T-1062 order-lock happy-path it(L367) 에서 `expect(parseSpy).toHaveBeenCalledWith(HAPPY_STDOUT)` 를 추가해, sub-composer ① 위임이 가드의 **정확한 `stdout` 문자열** 완전 충실도(payload 누락/치환 없음)로 호출됨을 canonical matcher 로 lock. 기존 `toHaveBeenCalledTimes(1)` 는 유지(횟수+인자 둘 다).
- [ ] **buildOutcomeReport delegate 인자-충실도(happy-path, 둘째 인자 `run` 포함)**: `expect(buildOutcomeSpy).toHaveBeenCalledWith(producedOutcome, HAPPY_RUN)` 를 추가해(`producedOutcome = parseSpy.mock.results[0].value`), sub-composer ② 위임이 **첫 인자 outcome reference 뿐 아니라 둘째 인자 `run` payload 까지** 두 인자 완전 충실도로 호출됨을 lock. 기존 첫-인자 `.toBe(producedOutcome)` reference assert·`invocationCallOrder` 부등식(parse < buildOutcomeReport)은 제거 말고 유지(순서 + reference + full payload 모두).
- [ ] **negative — shape/payload drift 대조**: `toHaveBeenCalledWith` 가 인자 payload drift 를 실제로 잡음을 노출하는 인자-축 대조 assert 1+. 예: `expect(parseSpy).not.toHaveBeenCalledWith(HAPPY_RUN)`(다른 payload 를 인자로 넣으면 매칭 안 됨) 또는 `expect(buildOutcomeSpy).not.toHaveBeenCalledWith(producedOutcome, HAPPY_STDOUT)` 형태로 둘째 인자 drift 가 매칭되지 않음을 보이는 negative 1+. **기존 값-drift RangeError 대조 describe(L92~) 를 재사용하지 말고 인자-충실도 축 negative 로 별도 명시.**
- [ ] **negative — 인자 개수/arity 봉함**: parse 가 정확히 1 인자로 호출됨을 `parseSpy.mock.calls[0].length === 1` 로, buildOutcomeReport 가 정확히 2 인자임을 `buildOutcomeSpy.mock.calls[0].length === 2` 로 lock 하는 assert 각 1+(여분 인자 0 — 두 delegate 의 서로 다른 arity 각각 봉함).
- [ ] **flow / 분기 cover**: 본 leg 은 happy-path 재유도 it(L367) 단일 경로 tighten — 새 분기 도입 0. 조립 경로에 분기 없음 → "분기 없음, 항목 생략" 을 spec 주석 또는 task 이행 메모에 명시.
- [ ] **coverage 통과**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only assert 추가라 production coverage 무회귀.
- [ ] **재현 grep 갱신**: 머지 후 `grep -c toHaveBeenCalledWith test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts` ≥ 2(본 leg 이 outcome-report-from-output seam 2-delegate 인자-충실도를 최초 lock — audit 후보 2 leg7 실증).
- [ ] **회귀 무영향 확인**: 대상 spec 전체 통과(기존 T-1062 order-lock·T-1072 구조-검사 선행성·값-drift RangeError negative it 등 green 유지) + 전체 `pnpm test` suite green.

## Out of Scope

- **production src/·helper 소스(`realdata-e2e-result-issue-outcome-report-from-output-consistency.ts`·`realdata-e2e-result-issue-output-parse.ts`·`realdata-e2e-result-issue-outcome-report.ts` 등) 변경 금지** — test-only assert 추가. 가드/컴포저 시그니처 변경·리팩터 금지.
- **다른 consistency spec 의 인자-충실도** — 본 leg 은 outcome-report-from-output **한 seam** 만. 나머지 W=0 & T>0 seam(daily-step dual-leg run-report-issue-command-plan/gh-command-plan/outcome-report-from-output · daily-step collect/eval-command-plan 계열 등 planner pre-check 로 확인한 잔여 8건)의 `toHaveBeenCalledWith` 완결은 후속 leg(다음 planner turn).
- **구조-검사 선행성(T-1072)·call-count exactly-N·order-lock 재유도(T-1062)** — 소진(T-1096 audit). 기존 `toHaveBeenCalledTimes`/`invocationCallOrder`/`.toBe(producedOutcome)` assert 제거·변경 금지(유지만).
- **result-report-plan(T-1098)·evaluation-plan(T-1099)·result-issue-publish-plan(T-1100)·result-issue-command-plan(T-1101)·result-issue-gh-command-plan(T-1102)·step-args(T-1103) 인자-충실도** — 별개 파일·leg1~6(머지 완료).
- 새 컴포저/가드/helper 신설 — 기존 spy 인프라 재사용만.
- `docs/PLAN.md`·`docs/STATE.json` 편집 — driver/planner loop 소관.

## Suggested Sub-agents

`implementer → tester`. architect 불요(새 아키텍처 결정 0 — 인자-충실도 sweep 의 다음 seam 확장). implementer 는 T-1062 order-lock describe 의 `parseSpy`/`buildOutcomeSpy` 인프라를 재사용해 `toHaveBeenCalledWith` 2-delegate(mixed arity: parse 1-arg / buildOutcome 2-arg) 인자-충실도 assert(둘째 인자 `run` 포함) + 인자-축 negative 2종을 추가. tester 는 `pnpm lint && pnpm build && pnpm test:cov` 로 본 spec 실행·통과 확인(R-110/R-112/R-114).

## Follow-ups

- (다음 planner turn) 본 leg 이 outcome-report-from-output seam 2-delegate 인자-충실도를 lock 하면, 다음은 인자-충실도 sweep 의 다음 seam(daily-step dual-leg run-report-issue-command-plan(T=28 O=11 S=18)/gh-command-plan(T=19 O=15 S=20)/outcome-report-from-output(T=30 O=11 S=10) · daily-step collect-command-plan/eval-command-plan(각 T=5 O=2 S=7) 등 `toHaveBeenCalledWith` count=0 이면서 order-lock spy 인프라(invocationCallOrder/spyOn) 보유 consistency spec — planner pre-check 로 W=0 & T>0 목록 잔여 8건 확인) 또는 P5 의 다른 PLAN bullet 로 전환.
