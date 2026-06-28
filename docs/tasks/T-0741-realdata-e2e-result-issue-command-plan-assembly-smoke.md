---
id: T-0741
title: realdata-e2e result-issue-command-plan 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 210
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step③→④ post-eval interpretation 종단 컴포저 buildRealDataResultIssueCommandPlan(results,run)→{report,commandArgs} 조립 smoke. run 단일 source threading. T-0740 report-plan 의 commandArgs-side 후속 형제, test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-result-issue-command-plan-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts]
---

# T-0741 — realdata-e2e result-issue-command-plan 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 step③(평가) → step④(결과 이슈 박제) 경계에서 post-evaluation interpretation 측 **종단** 컴포저는 `buildRealDataResultIssueCommandPlan(results, run)` (T-0594) 가 닫는다 — 평가 산출 `EvaluationResult[]` + `run`(gitSha + dateToken) 을 (1) `buildRealDataResultReportPlan(results, run)` (T-0593, T-0740 smoke) 로 `report({summary, descriptor})` 를, (2) 그 `report.descriptor` 를 `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) 로 gh issue 멱등 search-or-update 명령-args(`{searchQuery, createArgs, updateArgs}`) 로 합성해 `{report, commandArgs}` 한 묶음으로 반환한다. 이 컴포저의 `commandArgs` 는 정확히 step④ 종단 박제 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` (T-0588) 의 두 번째 인자라, post-evaluation interpretation 체인을 명령-args 까지 종단으로 닫는다. `run` 은 (1) report-plan 단계에서만 thread 되므로 동일 run 이면 descriptor.marker 가 멱등이고 그것이 `commandArgs.searchQuery` 에 그대로 실린다 — step④ live wiring 의 search-or-update 기반이다. 이 컴포저는 unit (`realdata-e2e-result-issue-command-plan.spec.ts`) + consistency (`...-command-plan-consistency.spec.ts`) spec 으로 닫혀 있으나, **results→report→commandArgs 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다 (`git grep buildRealDataResultIssueCommandPlan test/smoke/` = 0 확인). 즉 report↔commandArgs descriptor drift·summary 집계 drift·searchQuery↔descriptor.marker 어긋남·create/update body↔descriptor.body 어긋남·run.gitSha/dateToken blank throw 전파·빈 results 빈-summary 분기 회귀는 public CI 에서 한 번도 발화되지 않고 credential-gated live smoke (`realdata-e2e-live.smoke-spec.ts`) set-up 시에만 잡힌다. 본 task 는 그 gap 을 메운다 — T-0740 result-report-plan (results→summary→descriptor) 조립 smoke 의 **commandArgs-side 후속 형제** 로, `buildRealDataResultIssueCommandPlan` 조립 surface 회귀를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan.ts` — 본 smoke 가 검증할 진입 종단 컴포저 (`buildRealDataResultIssueCommandPlan(results, run)` → `{report, commandArgs}`, 2 위임 합성·run 단일 source thread·throw 전파·self-wire 가드)
- `test/helpers/realdata-e2e-result-report-plan.ts` — 위임 (1) `buildRealDataResultReportPlan(results, run)` 및 `RealDataResultReportPlan` interface (`{summary, descriptor}`) — `plan.report` deep-equal 대조 기준
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 위임 (2) `buildRealDataResultIssueCommandArgs(descriptor)` 및 `RealDataResultIssueCommandArgs` (`{searchQuery, createArgs:{title,body,labels}, updateArgs:{title,body}}`) interface — `plan.commandArgs` deep-equal 대조 기준 + searchQuery=descriptor.marker / create·update body=descriptor.body 멱등 정합
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef` (`{gitSha, dateToken}`) interface (fixture run 구성) + gitSha/dateToken blank throw 출처(`assertNonBlank`, report-plan 경유 전파)
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` type (`{unitId, narrative, difficulty, contribution, volume}`) + `ContributionLevel` (synthetic `EvaluationResult[]` literal 구성에 필요)
- `src/llm/difficulty.ts` — `Difficulty` (EvaluationResult.difficulty literal 구성에 필요)
- `test/smoke/realdata-e2e-result-report-plan-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope·deep-equal 대조·run blank throw 전파·빈 results 분기 패턴의 mirror 템플릿 (result-side 선행 형제 조립 smoke, T-0740)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-issue-command-plan-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — synthetic `EvaluationResult[]` (다수 원소 literal, difficulty/contribution/volume 다양) + 유효 `run`(`{gitSha, dateToken}` non-blank) 으로 `buildRealDataResultIssueCommandPlan(results, run)` 호출 → 산출 plan 이 `{report, commandArgs}` shape 충족 + `report` 가 `{summary, descriptor}` (summary.count === results.length, descriptor.title/marker/body non-empty string) 충족 + `commandArgs` 가 `{searchQuery, createArgs:{title,body,labels}, updateArgs:{title,body}}` (searchQuery non-empty, createArgs.labels 비어있지 않은 string[]) 충족. happy-path 1+ test.
- [ ] **단일 source 조립 단언** — 동일 (results, run) 을 `buildRealDataResultReportPlan(results, run)` 로 직접 호출한 결과와 `plan.report` 가 deep-equal 1+ test. 동일 `plan.report.descriptor` 를 `buildRealDataResultIssueCommandArgs(plan.report.descriptor)` 로 직접 호출한 결과와 `plan.commandArgs` 가 deep-equal 1+ test (조립 체인이 report→commandArgs 를 descriptor 단일 source 로 thread 함을 확인). `plan.commandArgs.searchQuery === plan.report.descriptor.marker` 1+ test (run 단일 source 멱등 marker 가 searchQuery 로 실림). `plan.commandArgs.createArgs.body === plan.report.descriptor.body && plan.commandArgs.updateArgs.body === plan.report.descriptor.body` 1+ test. 동일 run 두 번 → `commandArgs.searchQuery` 동일(멱등 검색 토큰) 1+ test.
- [ ] **Error/negative path test** — `run.gitSha` 가 빈 문자열 → 위임 report-plan 하위 `assertNonBlank` throw 가 자체 try/catch 없이 그대로 전파됨 (`expect(() => ...).toThrow`) 1+ test. `run.gitSha` 공백만 → throw 전파 1+ test. `run.dateToken` 빈 문자열 → throw 전파 1+ test. `run.dateToken` 공백만 → throw 전파 1+ test. (throw 가 (1) report-plan 단계에서 평가돼 commandArgs 단계 도달 0 임을 확인)
- [ ] **Flow / branch coverage** — 빈 `results` 배열 (`[]`) + 유효 run → throw 0 + `plan.report.summary.count === 0`·전 분포 슬롯 0·`totalVolume === 0` + descriptor / commandArgs 정상 합성(non-empty searchQuery/createArgs/updateArgs) 분기 1+ test. 단일·다수 results 분기 각 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 results → 빈-summary report + 정상 commandArgs(throw 0), (b) gitSha 빈 문자열 → throw 전파, (c) gitSha 공백만 → throw 전파, (d) dateToken 빈 문자열 → throw 전파, (e) dateToken 공백만 → throw 전파, (f) 결정론·무공유: 동일 (results, run) 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan 객체 (참조 비동일, report/commandArgs 트리·createArgs.labels 배열도 참조 비동일), (g) 입력 results·run 객체·원소 mutate 0 (호출 전후 deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / EvaluationScoringService.scoreUnit / 실 github 수집 / 실 gh 호출·search·create·edit / 실 jest spawn) 복제 0 — results→report→commandArgs 조립 surface 만 검증 (synthetic `EvaluationResult[]` + `run` literal 직접 주입).
- [ ] 새 외부 dependency 0 — 기존 `build*` 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728/T-0729/T-0730/T-0731/T-0736/T-0737/T-0738/T-0739/T-0740 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- 기존 `realdata-e2e-result-report-plan-assembly.smoke-spec.ts` (T-0740, `buildRealDataResultReportPlan` 진입) — 본 task 는 그 위에서 commandArgs 까지 묶는 `buildRealDataResultIssueCommandPlan` 종단 컴포저만 책임. 선행 smoke 수정·중복 0.
- step④ 박제 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` (T-0588, search stdout → gh argv) — 별개 composer family (search-side). 본 task 는 그 컴포저가 받는 `commandArgs` 산출까지만 책임. 중복·수정 0.
- 실 `deploy/daily-test.sh` bash 배선 / 실 scoreUnit·LLM round-trip·Ollama 호출 / 실 github 수집 / 실 gh 이슈 search·create·edit / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-result-issue-command-plan.ts` / `realdata-e2e-result-report-plan.ts` / `realdata-e2e-result-issue-command-args.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- `EvaluationResult[]` 의 실 산출 (실 scoreUnit) / `run` 식별자 실 도출 (실 gitSha·실 timestamp) — synthetic literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)

## Result

Status: DONE — 2026-06-28. PR #656 squash 머지(adac904c), reviewer round1 APPROVE + 4-게이트 PASS + PR CI green. test-only 1파일(+371/-0) 15 it: buildRealDataResultIssueCommandPlan(results,run)→{report,commandArgs} 종단 조립 — run 단일 source threading · report↔commandArgs descriptor 정합 · blank throw 전파 · 빈/단일/다수 results 분기 cover.
