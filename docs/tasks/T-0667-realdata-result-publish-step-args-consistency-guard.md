---
id: T-0667
title: publish-step-args 컴포저 산출 정합 순수 가드 신설 (assertRealDataResultPublishStepArgsConsistentWithSources)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-26
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-publish-step-args-consistency.ts
  - test/helpers/realdata-e2e-result-publish-step-args-consistency.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — publish-step-args 컴포저 산출↔(runPlan.run, results) 재유도 정합 순수 가드 신설 (T-0665 publish-plan 가드의 상위 step-args 미러; self-wire 는 후속)"
---

# T-0667 — publish-step-args 컴포저 산출 정합 순수 가드 신설

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(평가 산출 → 결과 이슈 박제) build-time 정합 가드 사슬의 다음 상위 slice. 직전 T-0665/T-0666 이 종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run)` 의 consistency 가드 신설+self-wire 짝을 닫았다. 그 위 layer 인 `buildRealDataResultPublishStepArgs(runPlan, results)`(`test/helpers/realdata-e2e-result-publish-step-args.ts` L112~120)는 run-plan 에서 검증·보존된 단일 run 식별자(`runPlan.run` = gitSha + dateToken)를 추출해 `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 thread-위임한다 — 즉 step-args 컴포저가 (1) `runPlan.run` 을 올바른 인자 위치로 추출·재전달하고 (2) 위임 산출 plan 을 변형/누락 없이 그대로 반환하는지가 합성 무결성의 핵심 seam 인데, 이 layer 에는 아직 consistency 가드가 없다(현재 guard helper 부재 — grep 으로 확인).

본 task 는 그 정합을 검증하는 **순수 가드만 신설**한다(self-wire 는 후속 task — T-0665→T-0666 cadence 동형). 가드는 `(plan, runPlan, results)` 를 받아 `runPlan.run` 을 추출해 `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 single-source expected 를 직접 재유도한 뒤 plan 과 byte-identical 정합을 검증한다 — step-args 컴포저가 run 추출/재전달/반환을 변형하는 합성 회귀를 fail-fast 로 차단할 도구. 본 task 는 가드 신설만이며 컴포저 self-wire 배선은 하지 않는다(Out of Scope).

## Required Reading

- `test/helpers/realdata-e2e-result-publish-step-args.ts` — 정합 검증 대상 컴포저. `buildRealDataResultPublishStepArgs(runPlan: RealDataE2eRunPlan, results: EvaluationResult[]): RealDataResultIssuePublishPlan`(L112~120)이 L119 에서 `return buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 위임한다. 가드는 이 위임을 정확히 같은 인자 순서로 직접 재유도해 expected 산출.
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 위임 종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run)`. 가드가 expected 재유도 시 import 해 호출할 single-source. 시그니처·반환 형태(`{report, commandArgs, searchArgv}`) 확인.
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` — 패턴 선례 가드(`assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)`, L179~). 구조 검증(TypeError 분기 — plan/run null·비-object·searchArgv 비-배열) + 재유도 expected deepEqual 정합 비교(RangeError 분기) + 위임 throw 전파 패턴을 그대로 미러. `deepEqual` / `assertPlanStructure` 유틸 재사용 방식 확인.
- `test/helpers/realdata-e2e-run-plan.ts` — `RealDataE2eRunPlan` interface(L76~, `run: RealDataResultIssueRunRef`) 와 `RealDataResultIssueRunRef`(gitSha + dateToken) type. 가드 인자 type 재사용 — 신규 type 정의 0.
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-publish-step-args-consistency.ts` 신설 — `export function assertRealDataResultPublishStepArgsConsistentWithSources(plan: RealDataResultIssuePublishPlan, runPlan: RealDataE2eRunPlan, results: EvaluationResult[]): void`. 내부에서 (1) plan/runPlan 구조 검증(null·undefined → TypeError, `plan.report`/`plan.commandArgs` 비-object 또는 `plan.searchArgv` 비-배열·원소 비-string → TypeError, `runPlan.run` 비-object → TypeError), (2) `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 single-source expected 직접 재유도(위임 helper 가 빈/공백 gitSha·dateToken 에 throw 하면 가드가 삼키지 않고 그대로 전파), (3) plan 의 report/commandArgs/searchArgv 3 구성요소 각각 `deepEqual` byte-identical 정합 비교 — drift 시 RangeError(어느 구성요소가 어긋났는지 메시지에 포함). JSDoc 으로 `@param`·`@returns void`·`@throws` 명시.
- [ ] **순수 / read-only**: 가드는 plan/runPlan/results 를 mutate 0, 부수효과 0, 새 외부 dependency 0, credential/env/네트워크 0. 컴포저 본문은 건드리지 않는다(본 task 는 가드 신설만 — self-wire 미수행).
- [ ] **Happy-path unit test** (colocated `realdata-e2e-result-publish-step-args-consistency.spec.ts`): 정상 (runPlan, results) — 빈 results·단일 result·다수 result 분기 각각 — 으로 `buildRealDataResultPublishStepArgs` 산출 plan 을 가드에 넣으면 throw 0(void 반환) 1+ test. 실제 컴포저 산출물이 가드를 통과함을 round-trip 으로 확인.
- [ ] **Error path unit test**: (a) `plan`/`runPlan` null·undefined → TypeError 1+, (b) `plan.report`/`plan.commandArgs` 비-object 또는 `plan.searchArgv` 비-배열·원소 비-string → TypeError 1+, (c) `runPlan.run.gitSha`/`dateToken` 빈/공백 → 위임 helper throw 전파(가드가 삼키지 않음) 1+, (d) plan 의 report/commandArgs/searchArgv 중 하나라도 손상(변형·누락·원소 추가) → RangeError 1+.
- [ ] **Flow / branch cover**: 가드의 각 분기 — (a) 구조 검증 통과 → 재유도 → 정합 통과 → void, (b) 구조 결손 → TypeError, (c) 위임 throw 전파, (d) 값 drift → RangeError — 각 1+ test.
- [ ] **Negative cases 충분 cover** (각 1+ test): (a) report 만 손상, (b) commandArgs 만 손상, (c) searchArgv 만 손상(원소 변형·길이 변경·순서 뒤바뀜) 으로 각각 RangeError + 메시지에 해당 구성요소 식별자 포함 검증, (d) 동일 입력 두 번 호출 deterministic(같은 throw/void), (e) 입력 plan/runPlan/results 비변형(가드 호출 후 원본 객체·배열·원소 mutate 0), (f) 가드는 expected 재유도 외 위임 함수에 부수효과 전달 0 — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 신설 가드 파일 `realdata-e2e-result-publish-step-args-consistency.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. 가드가 import 하는 위임 종단 컴포저·type 들로 인한 runtime cycle 0(tsc green 으로 확인).

## Out of Scope

- `buildRealDataResultPublishStepArgs` 컴포저에 본 가드를 self-assert 배선(self-wire) — 본 task 는 순수 가드 **신설만**. 컴포저 산출 직전 self-wire 배선은 후속 task(T-0665→T-0666 cadence 동형).
- 위임 종단 컴포저 `buildRealDataResultIssuePublishPlan`·그 하위 위임 함수(command-plan/search-argv) 본문 수정 — 가드는 T-0595/T-0665 산출물 그대로 import 재사용.
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape/outcome-report/publish-plan)의 추가 가드 또는 self-wire — 본 task 는 publish-step-args layer consistency 가드 신설 1건만.
- 상위 `buildRealDataE2eStepArgs`/`realdata-e2e-run-plan` 컴포저용 가드 — 별도 후속 slice.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 가드만.
- production `src/` 코드 변경 — test helper 단독.
- 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함 / 신규 type 정의 0(인자 type 은 위임 측 import 재사용).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 가드 신설 후 후속 task 에서 `buildRealDataResultPublishStepArgs` 컴포저 산출 직전 self-wire 배선 → publish-step-args layer seam 의 가드신설+self-wire 짝 완결. 그 위 상위 step-args/run-plan 컴포저 seam 점검은 그다음 slice.)
