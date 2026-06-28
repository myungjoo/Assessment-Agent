---
id: T-0738
title: realdata-e2e result-outcome step-args 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 195
estimatedFiles: 1
created: 2026-06-28
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts]
independentStream: realdata-e2e-result-outcome-step-args-assembly-smoke
plannerNote: "P5 §109 실 평가 e2e — seed→run-plan→step④ post-실행 outcome-step-args 조립 smoke. T-0737 publish 의 post-실행 대칭. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
---

# T-0738 — realdata-e2e result-outcome step-args 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e) step ④ 결과 이슈 박제의 **post-실행** run-plan 연결은 순수 컴포저 `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` (T-0600) 가 닫는다 — seed-side 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` (T-0597) 가 산출한 검증된 `runPlan.run` (gitSha + dateToken) 만을 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` (T-0596) 로 thread 해, `gh issue create`/`gh issue edit` 의 stdout 으로부터 실행 리포트 `RealDataResultIssueOutcomeReport` (`{issueNumber, url, gitSha, dateToken, summaryLine}`) 를 합성하면서 step①↔step④ post-실행 run 식별자 일관을 구조적으로 보장한다. 이는 직전 T-0737 의 pre-실행 publish-step-args 조립 smoke 의 **post-실행 대칭**이다. 이 컴포저는 unit (`realdata-e2e-result-outcome-step-args.spec.ts`) + consistency (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→run-plan→step④ post-실행 outcome-step-args 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다 (sibling 조립 smoke T-0728~T-0731/T-0736/T-0737 은 다른 composer family 또는 pre-실행 측만 cover). 본 task 는 그 gap 을 메워 조립 surface 회귀 (run 재전달로 인한 gitSha/dateToken drift·runPlan.run↔outcome report 불일치·stdout 파싱/리포트 합성 누락·잘못된 stdout throw 전파 누락) 를 public CI 그물로 박제해, step④ 의 두 sub-path (pre-실행 publish T-0737 / post-실행 outcome 본 task) 조립 smoke 쌍을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-outcome-step-args.ts` — 본 smoke 가 검증할 진입 컴포저 (`buildRealDataResultOutcomeStepArgs(runPlan, stdout)` — `runPlan.run` 단일 source threading + T-0596 위임)
- `test/helpers/realdata-e2e-run-plan.ts` — 선행 컴포저 `buildRealDataE2eRunPlan(seeds, modelId, run)` 및 `RealDataE2eRunPlan` interface (`{pipeline, run}`), run guard (fixture runPlan 구성에 필요)
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` / `RealDataSeedDescriptor` (seed fixture 진입)
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — 산출 type `RealDataResultIssueOutcomeReport` (`{issueNumber, url, gitSha, dateToken, summaryLine}`) — 산출 shape 단언에 필요
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — 위임 대상 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` — deep-equal 대조의 직접 진입에 필요
- `test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope 패턴의 mirror 템플릿 (pre-실행 대칭 sibling, T-0737)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — `buildRealDataE2eSeed()` seed + 유효 modelId + 유효 run(`{gitSha, dateToken}`) → `buildRealDataE2eRunPlan` 으로 runPlan 구성 후 유효 issue URL stdout (`https://github.com/<owner>/<repo>/issues/<n>\n`, create / edit 둘 다) 과 함께 `buildRealDataResultOutcomeStepArgs(runPlan, stdout)` 호출 → 산출 report 가 `{issueNumber, url, gitSha, dateToken, summaryLine}` shape 충족 + `issueNumber` 가 양의 정수 + `url` 이 stdout URL(trim 정규화) 반영 + `summaryLine` 이 비어있지 않은 string. happy-path 1+ test (create stdout / edit stdout 각 1+).
- [ ] **run 단일 source 조립 단언** — 산출 report 의 `gitSha` / `dateToken` 이 `runPlan.run.gitSha` / `runPlan.run.dateToken` 을 반영하고, 동일 stdout 을 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, runPlan.run)` 로 직접 호출한 결과와 deep-equal (조립 체인이 run 을 재전달 없이 runPlan 에서만 thread 함을 확인) 1+ test.
- [ ] **Error/negative path test** — (a) `runPlan.run.gitSha` 가 빈/공백인 runPlan(직접 구성한 불완전 runPlan literal) → 위임 빌더 guard throw 가 자체 try/catch 없이 그대로 전파됨 (`expect(() => ...).toThrow`) 1+ test, (b) `runPlan.run.dateToken` 빈/공백 → throw 전파 1+ test.
- [ ] **Flow / branch coverage** — 잘못된 stdout 분기 각 1+ test: (i) URL 미발견 stdout → 위임 파서 throw 전파, (ii) 비-github 호스트 또는 `/pull/` PR URL → throw 전파, (iii) issueNumber 0/선행0/비정수 → throw 전파. 분기마다 test 분리. (본 컴포저 자체 추가 분기는 없음 — 전부 위임 helper 가 담당하므로 위임 분기를 조립 레벨에서 cover.)
- [ ] **Negative cases 충분 cover** — (a) gitSha 빈/공백 → throw, (b) dateToken 빈/공백 → throw, (c) URL 미발견 stdout → throw, (d) 비-github/PR URL stdout → throw, (e) 잘못된 issueNumber stdout → throw, (f) 결정론·무공유: 동일 (runPlan, stdout) 두 번 호출 시 deep-equal 산출 + 매 호출 새 report 객체 (참조 비동일), (g) 입력 runPlan·stdout mutate 0 (runPlan 호출 전후 deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체·stdout literal 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / orchestrator / 실 gh issue create·edit / 실 jest spawn) 복제 0 — seed→run-plan→outcome-step-args 조립 surface 만 검증 (stdout 은 literal 로만 주입).
- [ ] 새 외부 dependency 0 — 기존 `build*` 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728/T-0729/T-0730/T-0731/T-0736/T-0737 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- pre-실행 측 `buildRealDataResultPublishStepArgs` (T-0599) 의 조립 smoke — T-0737 이 이미 cover (본 task 는 post-실행 outcome 측만 책임).
- 실 `deploy/daily-test.sh` bash 배선 / 실 gh issue create·edit·search 실행 / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-result-outcome-step-args.ts` / `realdata-e2e-run-plan.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- 실 `gh` stdout 산출 (실 issue create/edit round-trip) — synthetic stdout literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
