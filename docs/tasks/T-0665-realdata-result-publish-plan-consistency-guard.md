---
id: T-0665
title: realdata-e2e publish-plan 산출↔single-source 재유도 정합 순수 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-25
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts
  - test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts
plannerNote: "P5 109행 step④ realdata-e2e stream — publish-plan {report,commandArgs,searchArgv} 산출↔single-source 재유도 byte-identical 가드 신설, T-0663 outcome-report-consistency mirror"
---

# T-0665 — realdata-e2e publish-plan 산출↔single-source 재유도 정합 순수 가드 신설

## Why

PLAN.md 109행("🟢 실 평가 e2e 테스트 데이터", P5)의 step④(평가 산출 → 결과 이슈 박제) build-time chain 은 pre-실행 종단 컴포저 `buildRealDataResultIssuePublishPlan(results, run) → {report, commandArgs, searchArgv}`(T-0595)로 단일 진입점이 닫혀 있다. 그러나 이 컴포저가 3 구성요소를 single-source 위임 helper(`buildRealDataResultIssueCommandPlan` + `buildRealDataResultIssueSearchGhArgv`)로부터 정합하게 합성하는지를 검증하는 회귀 fail-fast 가드는 아직 부재하다. T-0663(outcome-report-from-output-consistency)·T-0646(descriptor-body-consistency)이 닫은 하위 seam 들의 **종단 컴포저-side mirror** 로, publish-plan 합성 회귀(예: 위임 누락·순서 뒤바뀜·재구현 drift)를 byte-identical 재유도로 차단하는 가드를 신설한다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 가드 대상 컴포저 `buildRealDataResultIssuePublishPlan(results, run)`, `RealDataResultIssuePublishPlan` interface(`{report, commandArgs, searchArgv}`), 위임 합성 순서.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — mirror 패턴 원본(`assertRealDataResultIssueOutcomeReportConsistentWithOutput`): single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast 형태.
- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — single-source 재유도 helper ① `buildRealDataResultIssueCommandPlan(results, run) → {report, commandArgs}`.
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — single-source 재유도 helper ② `buildRealDataResultIssueSearchGhArgv(commandArgs) → searchArgv`.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts` — colocated spec 의 happy/TypeError/RangeError/negative 구성 참고(R-112 패턴).
- `CLAUDE.md` §3.2 (R-112 4종 + negative 충분 cover), §12 (언어 정책).

## Acceptance Criteria

신규 2 파일(둘 다 colocated, helper 옆에 spec):
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts`
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts`

- [ ] 순수 가드 `assertRealDataResultIssuePublishPlanConsistentWithSources(plan, results, run)` 신설 — `plan: RealDataResultIssuePublishPlan` 의 3 구성요소를 single-source 재유도값과 byte-identical 비교:
  - `buildRealDataResultIssueCommandPlan(results, run) → {report, commandArgs}` 재유도 → `plan.report` / `plan.commandArgs` deep-equal 검증.
  - `buildRealDataResultIssueSearchGhArgv(재유도 commandArgs) → searchArgv` 재유도 → `plan.searchArgv` deep-equal 검증.
  - 정상 합성이면 `void`(부수효과 0), 회귀 시 fail-fast throw. 가드는 입력 비변형(읽기만).
- [ ] 구조 결손(plan 또는 구성요소 누락·타입 불일치, null/undefined 등) → `TypeError` fail-fast. 값 정합 위반(재유도값과 byte-identical 불일치) → `RangeError` fail-fast. 두 카테고리 명확히 구분.
- [ ] **Happy-path test 1+**: 정상 (results, run, plan) 에서 가드 void 반환(throw 0). 빈 results·단일·다수 result 분기 각각 happy 검증.
- [ ] **Error path test 1+ (TypeError)**: plan/report/commandArgs/searchArgv 각 필드 결손·null/undefined·타입 불일치마다 TypeError throw 검증(각 분기 1+).
- [ ] **Error path test 1+ (RangeError)**: 재유도값과 불일치하는 손상 plan(예: report.summary count 조작·commandArgs.searchQuery 변형·searchArgv 위치 swap)마다 RangeError throw 검증(각 분기 1+).
- [ ] **Flow/branch coverage**: TypeError 분기 ↔ RangeError 분기 ↔ void 분기 각각 cover.
- [ ] **Negative cases 충분 cover** (각 1+ test): 결정성(같은 입력 두 번 호출 동일 결과)·입력 비변형(results 배열/원소·run·plan mutate 0)·빈 results 경계·searchArgv 배열 길이/원소 변형 거부·report 트리 부분 변형 거부·run.gitSha/dateToken 빈/공백 시 하위 throw 전파(가드 자체 try/catch 0) — 단일 negative 금지, 분기마다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%); 신규 helper line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` green.

## Out of Scope

- `buildRealDataResultIssuePublishPlan` 본문 변경 0 (가드는 신설만 — composer self-wire 배선은 별도 Follow-up task, T-0664 self-wire 동형).
- single-source 위임 helper(`command-plan` / `search-argv`) 로직 변경 0 — import type/함수 재사용만.
- 신규 type 정의 0 (전부 import type 재사용 — `RealDataResultIssuePublishPlan` / `EvaluationResult` / `RealDataResultIssueRunRef`).
- production `src/` 변경 0. 실 gh 호출 / `execFile` / 실 네트워크 0 (build-time 순수·dependency-free·credential 0).
- 새 외부 dependency 0 / Prisma migration 0 / R-59 raw 본문 미포함.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)

## Result (DONE)

- 완료: 2026-06-25T15:26Z (cron@aa-local-15-4a7d, 로컬 매시 15분 schedule cron fire)
- PR #579 squash merge `96e9ec5` — round 1/7, 4-게이트 통과(reviewer APPROVE + 외부 PR comment + integrator self-check + PR CI green: lint·build·test:cov·smoke·e2e). post-merge main run 96e9ec5 completed/success.
- 신규 2 파일(test-only, +629 LOC): `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` (순수 가드 `assertRealDataResultIssuePublishPlanConsistentWithSources`) + `.spec.ts`. src/ 변경 0.
- 가드: publish-plan `{report, commandArgs, searchArgv}` 을 command-plan + search-argv single-source 위임 재유도와 byte-identical 비교. 구조 결손=TypeError / 값 정합 위반=RangeError fail-fast. T-0663 outcome-report-consistency 종단-composer mirror.
- 신규 helper coverage line/branch/function 100%, R-112 4종 + negative 충분 cover.
- 동시 fire cron@vm-2495e3 는 select-claim 패배로 NO-OP race-loss(b56d915) 정상 stand-down — double-claim 아님(claims 항상 단일 T-0665).
