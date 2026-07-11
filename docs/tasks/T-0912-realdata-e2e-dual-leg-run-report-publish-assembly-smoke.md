---
id: T-0912
title: realdata-e2e dual-leg run report 이슈 publish 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-059]
estimatedDiff: 220
estimatedFiles: 1
created: 2026-07-11
dependsOn: []
prNumber: 806
touchesFiles:
  - test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts
independentStream: realdata-e2e-dual-leg-run-report-publish-assembly-smoke
sizeExempt: true
exemptReason: test-only smoke spec — happy/error/branch(create vs update)/negative/결정론 cover 로 test-dominated 220 LOC 예상. sibling assembly smoke(T-0729 130 LOC)+dual-leg 축 test-dominated 선례(T-0910 +610 spec) 정당화. production LOC 0.
plannerNote: P5 §109 step④ — dual-leg run report 값-정합 guard sweep(T-0906~T-0911) 종결 후 조립 체인 non-gated smoke gap. summary 축 T-0729 mirror.
---

# T-0912 — realdata-e2e dual-leg run report 이슈 publish 조립 체인 non-gated build-time smoke 신설

## Why

PLAN §109 "🟢 실 평가 e2e" 의 build-time consistency-guard sweep 이 dual-leg run report 축에서 종결됐다 — search-parse(T-0908/T-0909)·output-parse(T-0906/T-0907)·종단 컴포저(T-0910/T-0911) 세 값-정합 가드+self-wire 쌍이 모두 닫혔다(summary 축 T-0721~T-0726 mirror). 개별 layer 의 정합 가드는 완결됐으나, **여러 컴포저를 하나로 묶은 조립 체인 단위의 build-time smoke** 는 아직 부재하다. summary 축이 동일 시점(T-0726 종결 직후)에서 result-issue publish 조립 smoke(T-0729)로 이행한 것을 mirror 해, 본 task 는 dual-leg run report 이슈 publish 조립 체인 — `buildRealDataDailyStepDualLegRunReport`(두 leg outcome + run → report) → `...IssueDescriptor`(→ {title,marker,body}) → `...IssueCommandArgs`(→ {searchQuery,createArgs,updateArgs}) → `...IssueSearchGhArgv`(→ search argv) + `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan`(search stdout + commandArgs → {action,argv}) — 을 build-time(live-LLM 0·네트워크 0·gh 실행 0)으로 끝까지 조립·검증하는 smoke 를 박제한다. 결과 이슈 publish 경로(REQ-037 평가 결과 산출·REQ-059 raw 미저장)의 조립 회귀를 CI 단계에서 잡는 그물이다.

## Required Reading

- `docs/tasks/T-0912-realdata-e2e-dual-leg-run-report-publish-assembly-smoke.md` (본 파일)
- `docs/tasks/T-0729-realdata-e2e-result-issue-publish-assembly-smoke.md` — summary 축 mirror 선례(구조·비-gated 규약·happy/error/branch/negative/결정론 test 구성). 본 task 는 이 구조를 dual-leg run report 축으로 옮긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report.ts` — `buildRealDataDailyStepDualLegRunReport(evalOutcome, collectOutcome, run)` 진입점(L158~). 입력 type `RealDataDailyStepLegRunOutcome`(L48)·`RealDataResultIssueRunRef`(run.gitSha/dateToken), 반환 `RealDataDailyStepDualLegRunReport`(L78), run 식별자 빈/공백 throw + leg 라벨 guard.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`(L126) → `{title, marker, body}`(L89).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` — `buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor)`(L134) → `{searchQuery, createArgs, updateArgs}`(L104).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.ts` — `buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs)`(L120) → search argv string[].
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts` — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)`(L68) → `{action, argv}`. 후보 0건→create / 1+건→update 분기(L43~).
- `test/smoke/realdata-e2e-daily-step-command-plan-dual-leg-convergence-assembly.smoke-spec.ts` — 기존 dual-leg smoke 의 헤더 주석·describe 구조·import 경로 규약 참고(단, 본 task 는 **eval↔collect 수렴 축이 아니라 run report 이슈 publish 조립 축**이며 non-gated 는 동일).
- `test/jest-smoke.json` 및 `package.json` 의 `test:smoke` script — smoke suite 수집·실행 규약(rootDir `test/smoke/`, 파일명 `*.smoke-spec.ts`).

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-assembly.smoke-spec.ts` **1 개 파일** 신설. 파일 상단에 한국어 헤더 주석(목적·non-gated·live-LLM 0·네트워크 0·gh 실행 0·dual-leg run report 이슈 publish 조립 체인 범위) 작성.
- [ ] **Happy-path**: 유효한 두 leg outcome(eval·collect, 라벨 정합) + 유효 run(`gitSha`·`dateToken` 비공백)을 조립 체인에 통과시켜 report → descriptor → commandArgs → searchArgv → command-plan 이 모두 산출되고, `descriptor.marker` 가 `commandArgs.searchQuery` 로 전파되며 `searchArgv` 가 비어있지 않은 string[] 임을 검증하는 test 1+.
- [ ] **Error path**: run.gitSha 또는 dateToken 이 빈 문자열/공백일 때 조립 체인 첫 단계(`buildRealDataDailyStepDualLegRunReport`)가 throw 하고 후속 단계 미도달함을 검증하는 test 1+(각 빈-필드 케이스). 추가로 leg 라벨 mislabel(cross-wiring) throw 를 검증하는 test 1+.
- [ ] **분기 cover**: `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan` 의 두 분기 각 1+ test — (i) search stdout `"[]"`(후보 0건) → `action.create` + gh issue create argv, (ii) marker 를 포함한 1+ hit stdout → `action.update`(최소 number) + gh issue edit argv. 두 분기 argv 의 선두 토큰(`issue create` vs `issue edit`)을 검증.
- [ ] **negative cases 충분 cover**: 예외 상황을 분기마다 cover — (i) gitSha 빈/공백, (ii) dateToken 빈/공백, (iii) leg 라벨 cross-wiring, (iv) command-plan 에 넘긴 stdout 이 비-JSON/비배열 → 파서 throw 전파, (v) 동일 입력 2회 조립 시 산출 deep-equal 이면서 참조 무공유(결정론·무공유) — 각 1+ test. 단일 negative 만 작성 금지.
- [ ] **결정론·무공유**: 같은 (evalOutcome, collectOutcome, run) 으로 두 번 조립한 두 결과(report/descriptor/commandArgs/searchArgv/command-plan)가 deep-equal 이면서 최상위·중첩 객체 참조가 공유되지 않음(`not.toBe`)을 검증하는 test 1+.
- [ ] live-LLM·네트워크·DB·credential·gh 실행 사용 0 — 파일 내 fetch/gateway/Ollama/execFile/env-gating/describe.skip 배선 일절 없음(순수 build-time in-memory 조립·검증만).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke suite green).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 파일 추가라 production 커버리지 영향 0, 기존 임계 유지 확인.

## Out of Scope

- 새 컴포저·consistency 가드 helper 신설 0(value-consistency 가드 sweep 은 T-0911 에서 종결 — 추가 가드·self-wire 신설 금지). 본 task 는 기존 helper 를 조립·호출하는 smoke spec 추가만.
- 기존 dual-leg 축 컴포저 소스(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts`) 수정 0 — read-only 검증 대상.
- 기존 dual-leg convergence smoke(`realdata-e2e-daily-step-command-plan-dual-leg-convergence-assembly.smoke-spec.ts` 등 eval↔collect 수렴 축) 파일은 건드리지 않는다(file-disjoint).
- 실 LLM round-trip·실 github 수집·실 gh issue create/edit 실행·env-gated live 실행 leg(이는 §109 step④ daily-test bash 배선 후속 책임).
- `src/`·`package.json`·`.github/workflows/`·schema 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
