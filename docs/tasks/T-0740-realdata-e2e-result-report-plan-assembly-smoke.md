---
id: T-0740
title: realdata-e2e result-report-plan 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T03:14:00Z
mergedAs: f79e529fd3aa5688ae9a85a98b01c2e3ea9f8940
prNumber: 655
reviewRounds: 1
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 195
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step③→④ post-eval interpretation 컴포저 buildRealDataResultReportPlan(results,run)→{summary,descriptor} 조립 smoke. run 단일 source threading. result-side sibling, test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-result-report-plan-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-result-report-plan-assembly.smoke-spec.ts]
---

# T-0740 — realdata-e2e result-report-plan 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 step③(평가) → step④(결과 이슈 박제) 경계의 post-evaluation interpretation 측 build-time 종단 컴포저는 `buildRealDataResultReportPlan(results, run)` (T-0593) 가 닫는다 — 평가 산출 `EvaluationResult[]` 를 `buildRealDataResultSummary` (T-0580) 로 집계해 `summary` 를, 그 summary + `run` 식별자를 `buildRealDataResultIssueDescriptor` (T-0582) 로 합성해 daily-test 결과 이슈 박제용 `descriptor`(title/marker/body) 를 산출하고 둘을 `{summary, descriptor}` 한 묶음으로 반환한다. 이 컴포저는 `run`(gitSha + dateToken) 을 descriptor 측에 단일 source 로 thread 하므로 동일 run 이면 멱등 marker 가 동일해 step④ live wiring 의 search-or-update 기반을 이룬다. 컴포저 자체는 unit (`realdata-e2e-result-report-plan.spec.ts`) + 2 consistency self-wire spec (`...-plan-consistency` / `...-descriptor-body-consistency`) 로 닫혀 있으나, **results→summary→descriptor 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다. 즉 summary 집계 drift·descriptor title/marker/body drift·summary↔descriptor cross 어긋남·run.gitSha/dateToken blank throw 전파·빈 results 빈-summary 분기 회귀는 public CI 에서 한 번도 발화되지 않고 credential-gated live smoke (`realdata-e2e-live.smoke-spec.ts`) set-up 시에만 잡힌다. 본 task 는 그 gap 을 메운다 — step④ publish-step-args (T-0737) / outcome-step-args (T-0738) / evaluation-step-args (T-0739) 의 result-side 형제 조립 smoke 로, `buildRealDataResultReportPlan` 조립 surface 회귀 (run 재전달 drift·summary↔descriptor 불일치·합성 누락·빈 results 분기) 를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-result-report-plan.ts` — 본 smoke 가 검증할 진입 컴포저 (`buildRealDataResultReportPlan(results, run)` → `{summary, descriptor}`, 2 위임 합성·run 단일 source thread·throw 전파·self-wire 2 가드)
- `test/helpers/realdata-e2e-result-summary.ts` — 위임 (1) `buildRealDataResultSummary(results)` 및 `RealDataResultSummary` interface (`{count, byDifficulty, byContribution, totalVolume}`) — deep-equal 대조 기준
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — 위임 (2) `buildRealDataResultIssueDescriptor(summary, run)` 및 `RealDataResultIssueDescriptor` (`{title, marker, body}`) / `RealDataResultIssueRunRef` (`{gitSha, dateToken}`) interface — fixture run 구성 + 산출 shape 단언 + deep-equal 대조 기준 + gitSha/dateToken blank throw 출처(`assertNonBlank`)
- `src/assessment-evaluation/domain/evaluation-result.ts` — `EvaluationResult` type (`{unitId, narrative, difficulty, contribution, volume}`) + `ContributionLevel` / `isContributionLevel` (synthetic `EvaluationResult[]` literal 구성에 필요)
- `src/llm/difficulty.ts` — `Difficulty` / `isDifficulty` (EvaluationResult.difficulty literal 구성에 필요)
- `test/smoke/realdata-e2e-result-publish-step-args-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope·deep-equal 대조·run blank throw 전파 패턴의 mirror 템플릿 (result-side sibling 조립 smoke, T-0737)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-result-report-plan-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — synthetic `EvaluationResult[]` (다수 원소 literal, difficulty/contribution/volume 다양) + 유효 `run`(`{gitSha, dateToken}` non-blank) 으로 `buildRealDataResultReportPlan(results, run)` 호출 → 산출 plan 이 `{summary, descriptor}` shape 충족 + `summary` 가 `{count, byDifficulty, byContribution, totalVolume}` 충족 (`count === results.length`) + `descriptor` 가 `{title, marker, body}` (전부 non-empty string) 충족. happy-path 1+ test.
- [ ] **단일 source 조립 단언** — 동일 (results) 를 `buildRealDataResultSummary(results)` 로 직접 호출한 결과와 `plan.summary` 가 deep-equal 1+ test. 동일 (plan.summary, run) 을 `buildRealDataResultIssueDescriptor(plan.summary, run)` 로 직접 호출한 결과와 `plan.descriptor` 가 deep-equal 1+ test (조립 체인이 summary→descriptor 를 같은 run 단일 source 로 thread 함을 확인). 동일 run 두 번 → `descriptor.marker` 동일(멱등 marker) 1+ test.
- [ ] **Error/negative path test** — `run.gitSha` 가 빈 문자열 → 위임 descriptor `assertNonBlank` throw 가 자체 try/catch 없이 그대로 전파됨 (`expect(() => ...).toThrow`) 1+ test. `run.gitSha` 공백만 → throw 전파 1+ test. `run.dateToken` 빈 문자열 → throw 전파 1+ test. `run.dateToken` 공백만 → throw 전파 1+ test.
- [ ] **Flow / branch coverage** — 빈 `results` 배열 (`[]`) + 유효 run → throw 0 + `summary.count === 0`·전 분포 슬롯 0·`totalVolume === 0` + descriptor 정상 합성(non-empty title/marker/body) 분기 1+ test. 단일·다수 results 분기 각 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) 빈 results → 빈-summary plan(throw 0), (b) gitSha 빈 문자열 → throw 전파, (c) gitSha 공백만 → throw 전파, (d) dateToken 빈 문자열 → throw 전파, (e) dateToken 공백만 → throw 전파, (f) 결정론·무공유: 동일 (results, run) 두 번 호출 시 deep-equal 산출 + 매 호출 새 plan 객체 (참조 비동일, summary/descriptor 트리도 참조 비동일), (g) 입력 results·run 객체·원소 mutate 0 (호출 전후 deep-equal) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체 직접 주입).
- [ ] live leg (실 LLM / 네트워크 / DB / Ollama / EvaluationScoringService.scoreUnit / 실 github 수집 / 실 gh 호출 / 실 jest spawn) 복제 0 — results→summary→descriptor 조립 surface 만 검증 (synthetic `EvaluationResult[]` + `run` literal 직접 주입).
- [ ] 새 외부 dependency 0 — 기존 `build*` 컴포저 import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728/T-0729/T-0730/T-0731/T-0736/T-0737/T-0738/T-0739 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- 기존 `realdata-e2e-result-issue-publish-assembly.smoke-spec.ts` (T-0729, `buildRealDataResultIssuePublishPlan` 진입) — 별개 composer family. 본 task 는 `buildRealDataResultReportPlan`(summary+descriptor) 만 책임. 중복·수정 0.
- 실 `deploy/daily-test.sh` bash 배선 / 실 scoreUnit·LLM round-trip·Ollama 호출 / 실 github 수집 / 실 gh 이슈 search·create·edit / 실 jest 프로세스 spawn / 실 live smoke 실행.
- 컴포저 소스 (`realdata-e2e-result-report-plan.ts` / `realdata-e2e-result-summary.ts` / `realdata-e2e-result-issue-descriptor.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- `EvaluationResult[]` 의 실 산출 (실 scoreUnit) / `run` 식별자 실 도출 (실 gitSha·실 timestamp) — synthetic literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
