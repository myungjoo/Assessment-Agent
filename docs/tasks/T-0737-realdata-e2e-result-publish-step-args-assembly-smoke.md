---
id: T-0737
title: realdata-e2e result-publish step-args 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 195
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e — seed→run-plan→step④ publish-step-args 조립 smoke. 컴포저 unit/consistency 닫힘·조립 smoke 부재 gap. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-result-publish-step-args-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts]
---

# T-0737 — realdata-e2e result-publish step-args 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e) step ④ 결과 이슈 박제의 **pre-실행** run-plan 연결은 순수 컴포저 `buildRealDataResultPublishStepArgs(runPlan, results)` (T-0599) 가 닫는다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` (T-0597) 가 산출한 검증된 `runPlan.run` (gitSha + dateToken) 만을 publish plan 으로 thread 해 step①↔step④ run 식별자 일관을 구조적으로 보장하고, `buildRealDataResultIssuePublishPlan(results, runPlan.run)` (T-0595) 로 위임해 `{report, commandArgs, searchArgv}` 를 합성한다. 이 컴포저는 unit (`realdata-e2e-result-publish-step-args.spec.ts`) + consistency (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→run-plan→step④ publish-step-args 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다 (sibling 조립 smoke T-0728/T-0729/T-0730/T-0731/T-0736 은 다른 composer family 만 cover — T-0729 는 `buildRealDataResultIssuePublishPlan` 직접 진입이라 run-plan threading layer 밖). 본 task 는 그 gap 을 메워 조립 surface 회귀 (run 재전달로 인한 gitSha/dateToken drift·runPlan.run↔publish plan 불일치·report/commandArgs/searchArgv 합성 누락·빈 results 분기) 를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-result-publish-step-args.ts` — 본 smoke 가 검증할 진입 컴포저 (`buildRealDataResultPublishStepArgs(runPlan, results)` — run 단일 source threading + T-0595 위임)
- `test/helpers/realdata-e2e-run-plan.ts` — 선행 컴포저 `buildRealDataE2eRunPlan(seeds, modelId, run)` 및 `RealDataE2eRunPlan` interface (`{pipeline, run}`), run guard (fixture runPlan 구성에 필요)
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` / `RealDataSeedDescriptor` (seed fixture 진입)
- `test/helpers/realdata-e2e-result-issue-publish-plan.ts` — 위임 대상 `RealDataResultIssuePublishPlan` interface (`{report, commandArgs, searchArgv}`) — 산출 shape 단언에 필요
- `test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope 패턴의 mirror 템플릿 (sibling 조립 smoke)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — `buildRealDataE2eSeed()` seed + 유효 modelId + 유효 run(`{gitSha, dateToken}`) → `buildRealDataE2eRunPlan` 으로 runPlan 구성 후 synthetic `EvaluationResult[]` (다수 원소 literal) 과 함께 `buildRealDataResultPublishStepArgs(runPlan, results)` 호출 → 산출 plan 이 `{report, commandArgs, searchArgv}` shape 충족 + `searchArgv` 가 비어있지 않은 string[] + `report.summary` 가 results 카운트 반영. happy-path 1+ test.
- [ ] **run 단일 source 조립 단언** — 산출 plan 이 `runPlan.run.gitSha` / `runPlan.run.dateToken` 을 (직접 또는 위임 산출 안에서) 반영하고, 동일 results 를 `buildRealDataResultIssuePublishPlan(results, runPlan.run)` 로 직접 호출한 결과와 deep-equal (조립 체인이 run 을 재전달 없이 runPlan 에서만 thread 함을 확인) 1+ test.
- [ ] **Error/negative path test** — runPlan.run.gitSha 가 빈/공백인 runPlan(직접 구성한 불완전 runPlan literal) → 위임 guard throw 가 자체 try/catch 없이 그대로 전파됨 (`expect(() => ...).toThrow`) 1+ test. runPlan.run.dateToken 빈/공백 → throw 전파 1+ test.
- [ ] **Flow / branch coverage** — 빈 `results` 배열 (`[]`) → throw 0 + `report.summary` count 0 / totalVolume 0 의 빈-count plan 반환 분기 1+ test. 단일·다수 results 분기 각 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 results → 빈-count plan (throw 0), (b) gitSha 빈/공백 → throw, (c) dateToken 빈/공백 → throw, (d) 결정론·무공유: 동일 (runPlan, results) 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan 객체 (참조 비동일), (e) 입력 runPlan·results 객체 mutate 0 (호출 전후 deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / orchestrator / 실 gh 호출 / 실 jest spawn) 복제 0 — seed→run-plan→publish-step-args 조립 surface 만 검증.
- [ ] 새 외부 dependency 0 — 기존 `build*` 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728/T-0729/T-0730/T-0731/T-0736 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- post-실행 측 `buildRealDataResultOutcomeStepArgs` (T-0600) 의 조립 smoke — 본 task 는 pre-실행 publish-step-args 만 책임 (outcome 측은 별도 후속 sibling 후보).
- 실 `deploy/daily-test.sh` bash 배선 / 실 gh issue create·edit·search 실행 / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-result-publish-step-args.ts` / `realdata-e2e-run-plan.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- `EvaluationResult` 의 실 산출 (실 scoreUnit / 실 LLM round-trip) — synthetic literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
