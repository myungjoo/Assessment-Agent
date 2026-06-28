---
id: T-0763
title: realdata-e2e step①↔step④ run-identity convergence — buildRealDataE2eRunPlan.run ↔ buildRealDataResultPublishStepArgs.report.descriptor marker/title ↔ standalone buildRealDataResultIssueDescriptor single-source run 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 seed-side step① 최외곽 run-plan(buildRealDataE2eRunPlan).run 과 result-side step④ publish-step-args 가 산출하는 report.descriptor marker/title 가 동일 단일 run source 로 byte-identical 수렴함을 standalone descriptor 와 함께 묶는 cross-stage smoke 0 gap; git grep 두 composer 동시-호출 0 확인"
independentStream: realdata-e2e-runplan-publish-descriptor-run-identity-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage·multi-source·guard-order·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0762/T-0761/T-0759 sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 근접/초과(T-0758 459·T-0759 461 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-runplan-publish-descriptor-run-identity-convergence-assembly.smoke-spec.ts
---

# T-0763 — realdata-e2e step①↔step④ run-identity convergence: run-plan.run ↔ publish-step-args report.descriptor ↔ standalone descriptor single-source run 수렴 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 build-time chain 은 seed-side 최외곽 진입점 `buildRealDataE2eRunPlan(seeds, modelId, run)` 가 `run`(`RealDataResultIssueRunRef {gitSha, dateToken}`)을 **검증·보존**(`assertRunRefNonBlank` guard 통과 후 새 객체로 복사)해 `runPlan.run` 으로 박제하고, result-side step④ 연결 컴포저 `buildRealDataResultPublishStepArgs(runPlan, results)` 가 **그 `runPlan.run` 만을 단일 source 로 thread**(독립 `run` 인자 미수신 — 재전달 0)해 `RealDataResultIssuePublishPlan {report, commandArgs, searchArgv}` 의 `report.descriptor`(멱등 marker·제목 token)를 합성한다. 이 chain 의 핵심 불변식은: **step① 에서 검증·보존된 `runPlan.run` 과, step④ publish plan 이 산출하는 `report.descriptor.marker`/`title` 의 run 식별 token 이, 동일 run 으로 standalone `buildRealDataResultIssueDescriptor(summary, runPlan.run)` 가 내는 marker/title 과 byte-identical single-source 로 수렴**해야 한다는 것이다. publish-step-args helper 헤더가 명시한 사고 표면 그대로 — step① 과 step④ 에 run 을 따로 두 번 넘기면(또는 한쪽이 stale run 을 쓰면) "잘못된 gitSha/dateToken 로 결과 이슈가 박제되거나 멱등 marker 가 어긋나" 같은 run 인데 검색→갱신(search-or-update, REQ-009)이 깨지고 결과 리포트 단일성·재실행 정합(REQ-037)이 무너진다.

기존 sweep 은 각 leg 를 **각각 따로** 닫았다: run-plan 측은 `realdata-e2e-run-plan-dual-leg-convergence-assembly.smoke-spec.ts`(T-0753, runPlan.pipeline↔직접 pipeline-plan 수렴 단독), publish-step-args 측은 `realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts`(T-0737, publish-step-args↔`buildRealDataResultIssuePublishPlan(results, runPlan.run)` 수렴 단독), descriptor 측은 `realdata-e2e-summary-descriptor-*-confluence`(T-0750/T-0751, summary↔descriptor 내부 confluence 단독). 그러나 **seed-side 최외곽 `buildRealDataE2eRunPlan` 의 보존된 `run` 과 result-side step④ `buildRealDataResultPublishStepArgs` 가 산출한 `report.descriptor` marker/title 가 동일 run single-source 로 수렴**하고, 나아가 그 둘이 standalone `buildRealDataResultIssueDescriptor(summary, runPlan.run)` 와도 **3자 수렴**함을 박제한 smoke 는 NONE 이다(git grep `buildRealDataE2eRunPlan` AND `buildRealDataResultIssueDescriptor` 동시-호출 smoke 0 확인 — origin/main). 직전 머지된 T-0762 가 publish-plan↔report-plan cross-composer report 수렴을 닫았다면, 본 task 는 그 위 layer — **seed-side step① run-plan 의 run 식별자가 result-side step④ descriptor marker/title 로 손실·drift 없이 수렴**하는 cross-stage run-identity 불변식을 닫는 sweep 의 다음 대칭(T-0761 modelId cross-stage 수렴의 run-축 형제)이다. live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataE2eRunPlan AND buildRealDataResultPublishStepArgs AND buildRealDataResultIssueDescriptor 셋 다 실제 호출 + runPlan.run↔publishPlan.report.descriptor↔standalone descriptor marker/title 수렴 단언) 여부; done` — **세 composer 를 동일 (seeds,modelId,run) single-source 로 동시 호출해 step① run↔step④ descriptor marker/title 수렴을 단언한 smoke 파일 0** 확인.

## Required Reading

- `test/helpers/realdata-e2e-run-plan.ts` — seed-side 최외곽 진입 composer. L77 `interface RealDataE2eRunPlan {pipeline, run}`. L121 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}`. L133-134 run guard(`assertRunRefNonBlank(run.gitSha/dateToken)` 필드별 throw), L138-141 검증 통과 run 을 **새 객체로 복사**(`{gitSha, dateToken}`, 입력 run 과 무공유)해 plan 보존. L112-114 guard 순서: pipeline 위임(modelId/seed guard)이 run guard 보다 먼저 — 빈 modelId+유효 run 경계에서 pipeline guard 우선 throw.
- `test/helpers/realdata-e2e-result-publish-step-args.ts` — result-side step④ 연결 composer. L113 `buildRealDataResultPublishStepArgs(runPlan, results)` → `RealDataResultIssuePublishPlan`. L120 `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 위임 — **`runPlan.run` 만 단일 source 로 thread**(독립 run 인자 미수신, 재전달 0). 빈/공백 gitSha/dateToken guard throw 는 위임 helper 가 자체 try/catch 없이 전파(L117-119 주석).
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — publish 진입 composer. L135 `buildRealDataResultIssuePublishPlan(results, run)` → `{report, commandArgs, searchArgv}`, `report`(=`{summary, descriptor}`)는 `buildRealDataResultIssueCommandPlan` 위임 chain 으로 산출. run.gitSha/dateToken 빈/공백 → descriptor 단계 throw 전파.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — standalone descriptor composer(run→marker/title source). L73 `interface RealDataResultIssueRunRef {gitSha, dateToken}`, L85 `interface RealDataResultIssueDescriptor {title, marker, body}`. L118 `buildRealDataResultIssueDescriptor(summary, run)` — marker/title 는 run 식별 token(gitSha+dateToken)의 안정 string 합성(동일 run→동일 marker, 다른 run→다른 marker — 멱등 search-or-update source). run.gitSha/dateToken 빈/공백 → throw.
- `test/helpers/realdata-e2e-result-summary.ts` — L64 `interface RealDataResultSummary {count, byDifficulty, byContribution, totalVolume}` + L105 `buildRealDataResultSummary(results)`(빈 results→count 0·전 슬롯 0·totalVolume 0). standalone descriptor 호출용 summary 산출(publishPlan.report.summary 와 동일 source 대조용).
- `test/smoke/realdata-e2e-pipeline-evaluation-plan-modelid-convergence-assembly.smoke-spec.ts` (T-0761) — 직전 머지된 cross-stage convergence sibling(seed-side↔eval-side modelId). 두 composer 동시-호출·single-source 수렴 단언·negative throw 전파·결정론/무공유/no-mutation/credential 누출 0 패턴 참고(구조 sibling-consistent — 본 task 는 run-축 cross-stage 대칭).
- `test/smoke/realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts` (T-0759) — publish↔outcome step-args 가 동일 runPlan.run 으로 수렴하는 sibling. 중복 회피 — 본 task 는 runPlan.run↔publish plan **report.descriptor marker/title** 수렴 + standalone descriptor 3자 수렴만, publish↔outcome step-args run 수렴 재단언 금지(T-0759 cover).
- `test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` (T-0737) — publish-step-args↔`buildRealDataResultIssuePublishPlan(results, runPlan.run)` 내부 수렴 smoke. 중복 회피 — 본 task 는 step① run-plan 의 run↔step④ descriptor marker/title cross-stage 수렴 + standalone descriptor 대조만, publish-step-args↔publish-plan 내부 위임 수렴 재단언 금지(T-0737 cover).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-runplan-publish-descriptor-run-identity-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: 단일 source(`seeds: RealDataSeedDescriptor[]` literal + 유효 `modelId` + 유효 `run: RealDataResultIssueRunRef {gitSha, dateToken}` + synthetic `EvaluationResult[]` literal)를 확보한 뒤 — `runPlan = buildRealDataE2eRunPlan(seeds, modelId, run)`, `publishPlan = buildRealDataResultPublishStepArgs(runPlan, results)`, `summary = buildRealDataResultSummary(results)`, `descriptor = buildRealDataResultIssueDescriptor(summary, runPlan.run)` 를 동일 source 로 호출 — 네 산출물 정상(runPlan: `{pipeline, run}`, publishPlan: `{report, commandArgs, searchArgv}`) happy test 1+.
- [ ] **cross-stage run single-source 수렴(branch — 핵심 불변식)**: step① 보존 run 이 step④ descriptor 로 손실 없이 수렴함을 묶어 단언 1+ test — `expect(publishPlan.report.descriptor.marker).toBe(descriptor.marker)`(byte-identical) AND `expect(publishPlan.report.descriptor.title).toBe(descriptor.title)`(byte-identical), 그리고 `runPlan.run`↔원본 `run` deep-equal(`toEqual`)·무공유(`not.toBe` — 검증 후 새 객체 복사 보존). 즉 입력 `run` → `runPlan.run` → step④ `publishPlan.report.descriptor.marker/title` → standalone `descriptor.marker/title` 가 **동일 run 식별 token single-source 3자 수렴**(marker/title 어느 경로도 stale/drift 0)을 박제.
- [ ] **run 변별성(branch — 멱등 marker source)**: 서로 다른 `run`(다른 gitSha 또는 다른 dateToken) 두 개로 각각 위 chain 을 호출 → 두 `publishPlan.report.descriptor.marker` 가 **서로 다름**(`not.toBe`/`not.toEqual`) AND 각각 동일 run 의 standalone `descriptor.marker` 와는 일치 1+ test — "동일 run→동일 marker, 다른 run→다른 marker"(search-or-update 식별의 결정론적 변별)를 cross-stage 에서 박제.
- [ ] **results 무관·run 독립(branch — partial-thread 격리)**: 동일 `run` 을 고정하고 `results` 만 다르게(빈 `[]` vs 다수 원소) 두 chain 을 호출 → `publishPlan.report.descriptor.marker`/`title` 는 **두 경우 byte-identical**(marker/title 은 run 식별 token 만의 함수 — results/summary 무관)이되 `publishPlan.report.summary` 는 results 따라 달라짐(`count`/`totalVolume` drift)을 동시에 단언 1+ test. 또한 빈 `results`(`[]`) + 유효 run 이면 chain 전체가 throw 0(summary count 0·전 슬롯 0·descriptor 정상 합성)이고 marker/title 수렴 보존 1+(경계값).
- [ ] **multi-seed 집계 분기에서도 run 수렴 보존(branch)**: `seeds` 가 2+ 원소(다양 externalId)인 입력으로 chain 호출 → `runPlan.pipeline.collectCallArgs` 가 seed 따라 달라져도 `publishPlan.report.descriptor.marker/title` 는 `run` source 만 따라 standalone descriptor 와 일치(seed 분포가 run 식별 token 에 누설 0) 1+ test.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(seed-side run guard·result-side 위임 guard 의 run 식별자 거부 대칭 박제):
  - 빈 문자열 `run.gitSha = ""` → step① `buildRealDataE2eRunPlan` 의 run guard throw(pipeline 위임 통과 후 run guard 단계, `assertRunRefNonBlank`).
  - 빈 문자열 `run.gitSha = ""` → standalone `buildRealDataResultIssueDescriptor(summary, run)` throw(descriptor 단계) — 두 경로 run guard 대칭.
  - 공백-only `run.dateToken = "   "` → step① run-plan throw AND standalone descriptor throw(각 1+ test) — gitSha·dateToken 두 식별자 축 negative 경로 분리 박제.
  - 유효 runPlan 으로 step④ 진입했으나 위임 publish plan 단계가 빈/공백 run 을 받지 못하도록 — 빈/공백 gitSha 의 runPlan-유사 객체를 `buildRealDataResultPublishStepArgs` 에 주입 시 위임 guard throw 전파 1+ test(step④ 가 stale/비식별 run 으로 descriptor 를 박지 못함).
- [ ] **flow / branch — guard 우선순위 cross-stage 정합(branch)**: 빈 `modelId` + 유효 `run` 경계에서 step① `buildRealDataE2eRunPlan` 은 **pipeline 위임 modelId guard 가 run guard 보다 먼저 throw**(run 유효해도 modelId 미결정 우선 차단) 1+ test — seed-side guard ordering 이 result-side run 수렴 진입 전에 modelId/seed 미결정을 막음을 박제(run guard 미도달).
- [ ] **credential 누출 0(branch)**: 산출물(`runPlan`·`publishPlan`·`descriptor`) 어느 출력에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth` 등) 미포함 단언(§9 정합) + raw 외부 활동 데이터(commit/PR/issue 본문) 미포함(R-59 정합 — descriptor 는 식별 token·집계·요약 렌더 본문만) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 (`seeds`/`modelId`/`run`/`results`)로 chain 을 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(runPlan·publishPlan·descriptor 참조 각각 `not.toBe`) + 입력 `seeds`(중첩 원소)·`run`(gitSha/dateToken string 원시)·`results`(중첩 원소) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 composer/가드도 수정하지 않고 세 기존 composer(seed-side 최외곽 run-plan·result-side step④ publish-step-args·standalone descriptor)를 동일 단일 source 로 묶은 cross-stage run-identity 수렴 불변식(run 식별 token byte-identical 3자 일치·run 변별성·results 무관/partial-thread 격리·multi-seed 보존·guard 대칭/우선순위 throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 run-convergence/변별성/partial-thread/multi-seed/guard-order/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-run-plan.ts`·`...-result-publish-step-args.ts`·`...-result-issue-publish-plan.ts`·`...-result-issue-descriptor.ts`·`...-result-summary.ts` 또는 어떤 composer/가드 helper 의 로직 변경(composer 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- run-plan 내부 runPlan.pipeline↔직접 pipeline-plan 수렴 전수 재단언(T-0753 이미 cover — 본 task 는 run 축 cross-stage 수렴만).
- publish-step-args↔`buildRealDataResultIssuePublishPlan(results, runPlan.run)` 내부 위임 수렴 전수 재단언(T-0737 이미 cover — 본 task 는 run-plan.run↔descriptor marker/title 수렴만).
- publish↔outcome step-args 가 동일 runPlan.run 으로 수렴하는 dual-leg 재단언(T-0759 이미 cover).
- summary↔descriptor 내부 confluence(body 3-블록·identity) 전수 재단언(T-0750/T-0751 이미 cover — 본 task 는 cross-stage run marker/title 수렴만).
- modelId cross-stage 수렴 재단언(T-0761 이미 cover — 본 task 는 run 축 대칭).
- descriptor body 의 marker→한 줄 요약→markdown 합성 구조 전수 재단언(T-0750/T-0580/T-0582 이미 cover).
- 실 github.com 네트워크 fetch / 실 활동 수집(`collectForPerson`) / 실 `prisma.upsert` / 실 LLM scoring round-trip / 실 gh CLI 실행(create/edit) / placeholder 치환 runner(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa/prisma client 등 0).
- 기존 run-plan/publish-step-args/descriptor unit·consistency·convergence spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
