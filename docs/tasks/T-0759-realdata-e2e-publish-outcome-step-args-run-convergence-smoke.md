---
id: T-0759
title: realdata-e2e step④ publish↔outcome step-args 두 leg(buildRealDataResultPublishStepArgs·buildRealDataResultOutcomeStepArgs) single-source runPlan.run convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step④ post-실행 round-trip — pre-실행 publish leg 와 post-실행 outcome leg 가 동일 runPlan.run 단일 source 로 수렴함을 묶는 smoke 0 gap; git grep 두 leg 동시-호출 cross convergence 부재 확인"
independentStream: realdata-e2e-publish-outcome-step-args-run-convergence-smoke
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts
---

# T-0759 — realdata-e2e step④ publish↔outcome step-args 두 leg single-source runPlan.run convergence non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) step ④(결과 이슈 박제)는 **pre-실행**과 **post-실행** 두 단계로 갈린다 — (1) **publish leg**: `buildRealDataResultPublishStepArgs(runPlan, results)` 가 `runPlan.run`(gitSha+dateToken) 으로부터 멱등 marker(= `report.descriptor.marker` = `commandArgs.searchQuery`)를 합성해 이슈를 어떤 marker 로 검색/생성/갱신할지 결정하고, (2) **outcome leg**: 실행 후 `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` 가 **같은 `runPlan.run`** 으로부터 결과 리포트의 `gitSha`/`dateToken` 을 전파한다. step④ 멱등 round-trip 의 핵심 불변식은 **두 leg 가 동일 단일 `runPlan.run` source 로 수렴**한다는 것 — 즉 run X 로 박제(publish)한 이슈의 outcome 도 반드시 run X 로 보고돼야 한다. 두 leg 가 같은 `runPlan.run` 을 공유하지 않으면(예: 한 leg 가 독립 run 인자를 재전달하거나 다른 run 식별자를 끌어쓰면) 박제한 이슈와 보고하는 outcome 의 run 식별자가 drift 해 멱등 search-or-update 가 깨진다.

기존 sweep 은 두 leg 를 **각각 따로** 닫았다: publish leg 는 `realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts`(T-0737, `buildRealDataResultPublishStepArgs` 단독 호출 + run 단일 source threading vs `buildRealDataResultIssuePublishPlan(results, runPlan.run)`), outcome leg 는 `realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts`(T-0738, `buildRealDataResultOutcomeStepArgs` 단독 호출). pre-실행 dual-leg aggregator(`buildRealDataE2eStepArgs` → `{evaluation, publish}`)는 T-0752 가 닫았다. 그러나 **publish leg 와 outcome leg 를 동일 `runPlan` 으로 동시 호출해, publish 가 쓰는 marker 의 run source 와 outcome 이 보고하는 run 식별자가 byte-identical 단일 source(`runPlan.run.gitSha`/`dateToken`)로 수렴**함을 박제한 smoke 는 NONE 이다. 이 cross-leg run 수렴이야말로 step④ round-trip 멱등성의 핵심인데 public CI 그물에 외화돼 있지 않다 — search-resolve round-trip(T-0758)이 단일 run 안의 search↔resolve 정합을 닫았다면, 본 task 는 pre-실행 publish↔post-실행 outcome 의 run source 정합을 닫는 post-실행 round-trip 대칭이다. live leg(실 gh search/create/edit·`execFile('gh', argv)`·실 LLM·DB·네트워크) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultPublishStepArgs AND buildRealDataResultOutcomeStepArgs 둘 다 실제 호출) 여부; done` — 세 파일이 두 심볼을 import 하나(`result-publish-step-args-assembly`·`result-outcome-step-args-assembly`·`step-args-dual-leg-convergence`), publish-assembly 는 publish 만 호출·outcome-assembly 는 outcome 만 호출·dual-leg(T-0752)는 publish+evaluation 만 호출(outcome 미포함). **두 leg 를 동일 runPlan 으로 동시 호출해 run source 수렴을 단언한 파일 0** 확인. publish↔outcome cross-leg run-convergence 전용 smoke 부재.

## Required Reading

- `test/helpers/realdata-e2e-result-publish-step-args.ts` — pre-실행 publish leg. L113 `export function buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}`. `runPlan.run` 만 thread(독립 run 인자 0). `commandArgs.searchQuery` = `report.descriptor.marker` = run 식별자 기반 멱등 marker.
- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — post-실행 outcome leg. L110 `export function buildRealDataResultOutcomeStepArgs(runPlan, stdout)` → `RealDataResultIssueOutcomeReport`. `runPlan.run` 만 thread(독립 run 인자 0). 잘못된 stdout/빈 run → 위임 throw 전파.
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — outcome report shape. L61 `interface RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken, summaryLine}`. `gitSha`/`dateToken` 은 run 에서 전파(L58-59). 본 두 필드가 outcome leg 의 run source 관측점.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — L73 `interface RealDataResultIssueRunRef {gitSha, dateToken}`, L85 `interface RealDataResultIssueDescriptor {title, marker, body}`. marker 가 publish leg 의 run source 관측점(run 식별자 기반 안정 marker — 동일 run = 동일 marker).
- `test/helpers/realdata-e2e-run-plan.ts` — `buildRealDataE2eRunPlan(seed)` → `RealDataE2eRunPlan {pipeline, run}`. 두 leg 공유 단일 source `runPlan.run` 확보. seed fixture 합성용 `buildRealDataE2eSeed`(`test/helpers/realdata-e2e-seed-fixture.ts`) 참조.
- `test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` (T-0737) — publish leg 단독 smoke. seed→run-plan→publish-step-args fixture 합성 패턴·synthetic EvaluationResult literal·run 단일 source threading 단언·credential 누출 0 패턴 참고(중복 회피 — 본 task 는 publish leg 자체의 plan shape/threading 재단언 금지, cross-leg run 수렴만).
- `test/smoke/realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts` (T-0738) — outcome leg 단독 smoke. synthetic gh create/edit stdout literal(`CREATE_STDOUT`/`EDIT_STDOUT`)·outcome report shape·잘못된 stdout throw·run guard throw 패턴 참고(중복 회피 — outcome leg 자체 재유도 재단언 금지).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: seed→`runPlan = buildRealDataE2eRunPlan(seed)` 단일 source 확보 후 동일 `runPlan` 으로 두 leg 호출 — `publishPlan = buildRealDataResultPublishStepArgs(runPlan, results)` 와 `outcomeReport = buildRealDataResultOutcomeStepArgs(runPlan, CREATE_STDOUT)` 가 모두 정상 산출(publishPlan: `{report, commandArgs, searchArgv}`, outcomeReport: `{issueNumber, url, gitSha, dateToken, summaryLine}`) happy test 1+.
- [ ] **cross-leg run single-source 수렴(branch — 핵심 불변식)**: 두 leg 가 동일 `runPlan.run` 으로 수렴함을 단언 1+ test — `outcomeReport.gitSha === runPlan.run.gitSha` AND `outcomeReport.dateToken === runPlan.run.dateToken` AND publish leg 의 run source(`publishPlan.report.descriptor.marker` 또는 `publishPlan.commandArgs.searchQuery` 가 `runPlan.run.gitSha`/`dateToken` 으로부터 도출됨 — marker 가 두 run 필드를 모두 포함하거나 동일 run 으로 합성됨을 `toContain`/직접 비교)를 byte-identical(`toBe`) 로 묶어, publish marker 의 run source 와 outcome report 의 run 필드가 **같은 단일 `runPlan.run`** 임을 단언.
- [ ] **edit(갱신) stdout 분기에서도 run 수렴(branch)**: outcome leg 를 `EDIT_STDOUT`(갱신 경로 gh edit stdout) 으로 호출해도 `outcomeReport.gitSha`/`dateToken` 이 동일 `runPlan.run` 과 일치 AND publish marker run source 와 수렴 1+ test — create/edit 두 outcome 분기 모두 run source drift 0.
- [ ] **partial-thread 격리(branch)**: 서로 다른 seed→다른 `runPlan`(run.gitSha/dateToken 변) 으로 두 leg 를 함께 호출 → publish marker 의 run source 와 outcome 의 `gitSha`/`dateToken` 이 **함께** 동형 변화(두 leg 가 같은 source 따라 동시 이동, drift 0) 1+ test — 한 leg 만 stale run 을 쓰면 멱등 round-trip 깨짐을 회귀 그물로 박제. 또한 같은 `runPlan` 이면 `results`/`stdout` 가 달라도 두 leg 의 run source 는 불변(run 은 results/stdout 와 독립) 단언 1+.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(어느 leg 도 자체 try/catch 0 → 위임 throw 그대로 전파):
  - `runPlan.run.gitSha` 빈 문자열 → publish leg(`buildRealDataResultPublishStepArgs`) throw 전파 AND outcome leg(`buildRealDataResultOutcomeStepArgs`) throw 전파(두 leg 모두 빈 run 식별자 거부).
  - `runPlan.run.gitSha` 공백-only → 두 leg throw 전파.
  - `runPlan.run.dateToken` 빈 문자열 → 두 leg throw 전파.
  - `runPlan.run.dateToken` 공백-only → 두 leg throw 전파.
  - outcome leg 에 잘못된 stdout(URL 미발견 문자열) → 파서 throw 전파.
  - outcome leg 에 빈 stdout(`""`) → 파서 throw 전파.
  - outcome leg 에 비-github/PR(`/pull/`) URL 또는 issueNumber 0/비정수 stdout → 파서 throw 전파(최소 1종).
- [ ] **flow / branch — pre-실행 vs post-실행 leg 분리(branch)**: publish leg(pre-실행, results 입력) / outcome leg(post-실행, stdout 입력) 두 leg 를 각각 분리 단언(분기마다 별 it) 1+ test each — 두 leg 가 독립 입력(results vs stdout)을 받되 run source 만 공유함을 박제.
- [ ] **credential 누출 0(branch)**: publish leg 의 `searchArgv`(및 commandArgs)·outcome report 어느 쪽에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth` 등) 미포함 단언(§9 정합) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (`runPlan`, `results`, `stdout`) 으로 두 leg 각각 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(publishPlan·outcomeReport 참조 각각 `not.toBe`) + 입력 `runPlan`(중첩 run/pipeline 포함)/`results`/`stdout`(문자열 불변) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 컴포저/가드도 수정하지 않고 두 기존 leg(pre-실행 publish·post-실행 outcome)를 동일 `runPlan.run` 단일 source 로 묶은 cross-leg run 수렴 불변식(run 식별자 단일 source 일치·create/edit 분기·partial-thread 격리·throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 run-convergence/partial-thread/create-edit/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-result-publish-step-args.ts`·`...-result-outcome-step-args.ts`·`...-result-issue-outcome-report.ts`·`...-run-plan.ts` 또는 어떤 컴포저/가드 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- publish leg 자체의 plan shape({report, commandArgs, searchArgv}) 전수 재단언 + run 단일 source threading(vs `buildRealDataResultIssuePublishPlan`) 재단언(T-0737 이미 cover — 본 task 는 cross-leg run 수렴만).
- outcome leg 자체의 report shape/파싱 재유도 재단언(T-0738 이미 cover — 본 task 는 두 leg run source 수렴만).
- pre-실행 dual-leg aggregator(`buildRealDataE2eStepArgs` → {evaluation, publish}) convergence 재단언(T-0752 이미 cover).
- 단일 run 안의 search↔resolve round-trip 재단언(T-0758 이미 cover — 본 task 는 publish↔outcome run source 정합).
- 실 github.com 네트워크 fetch / 실 gh 호출 / `execFile('gh', argv)`(search·create·edit) / 실 이슈 박제·갱신 wiring / 실 LLM round-trip(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa 등 0).
- 기존 publish-step-args/outcome-step-args/step-args-dual-leg unit·assembly·consistency spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)

## Result (DONE 2026-06-28)

- PR #674 squash merge `d752cdd1` — reviewer round 1/7 APPROVE(0 finding), 4-게이트 전부 PASS, PR CI green.
- test-only +461/-0 1 파일 신설(`test/smoke/realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts`), 신규 smoke 18/18 pass. lint·build·unit(8910)·test:cov green. src 변경 0.
- publish↔outcome 두 leg 동일 runPlan.run single-source 수렴(marker run source ↔ outcome gitSha/dateToken)·create/edit 분기·partial-thread 격리·negative 전파 단언.
