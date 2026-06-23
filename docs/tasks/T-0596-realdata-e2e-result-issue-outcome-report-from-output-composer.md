---
id: T-0596
title: 실 평가 e2e create/edit stdout + run → 결과 이슈 실행 리포트 post-execution 단일 진입 순수 컴포저
phase: P5
status: DONE
mergedAs: 2e5277b
prNumber: 509
reviewRounds: 1
completedAt: 2026-06-23T10:05:01Z
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts
plannerNote: "P5 PLAN 109행 step④ post-execution chain 단일 진입 컴포저 — (stdout,run)→OutcomeReport, T-0589+T-0590 위임 합성, cloud-safe·dependency-free·dependsOn []"
---

# T-0596 — 실 평가 e2e create/edit stdout + run → 결과 이슈 실행 리포트 post-execution 단일 진입 순수 컴포저

## Why

[PLAN.md](../PLAN.md) 109행(🟢 실 평가 e2e, P5) step④(daily-test 결과를 result/rolling 이슈에 박제) 의 **pre-실행** build-time chain 은 T-0595 `buildRealDataResultIssuePublishPlan(results, run)` → `{report, commandArgs, searchArgv}` 로 단일 진입점이 닫혔다. **post-실행(post-execution interpretation)** 측도 단위 layer 가 모두 박제됐다 — T-0589 `parseRealDataResultIssueCreateEditOutput(stdout)` 가 `execFile('gh', argv)` 의 stdout(이슈 URL) → `RealDataResultIssueOutcome {issueNumber, url}` 로 파싱하고, T-0590 `buildRealDataResultIssueOutcomeReport(outcome, run)` 이 그 outcome + run 식별자 → 사람-친화 실행 리포트 `RealDataResultIssueOutcomeReport` 로 묶는다.

그러나 live runner 가 이슈 박제 직후 받는 "create/edit stdout + run" 묶음을 실행 리포트로 바꾸려면 아직 두 helper(T-0589 → T-0590)를 caller 가 수동으로 엮어야 한다. 본 컴포저는 그 2 단계를 단일 순수 함수 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` → `RealDataResultIssueOutcomeReport` 로 합성해 **post-실행 build-time chain 의 단일 진입점**을 닫는다 — (1) `parseRealDataResultIssueCreateEditOutput(stdout)`(T-0589) → outcome, (2) `buildRealDataResultIssueOutcomeReport(outcome, run)`(T-0590) → report.

이 slice 가 박제되면 live runner 의 순수 layer 가 양 끝(pre-실행 `buildRealDataResultIssuePublishPlan`(T-0595) ↔ post-실행 본 컴포저) 단일 진입점 2 개로 줄고, 남는 외부 경계는 deferred `execFile('gh', searchArgv)`·`execFile('gh', argv)` 두 호출과 그 사이 종단 plan 컴포저 `resolveRealDataResultIssueGhCommandPlan`(T-0588) 뿐이다. seed-side `buildRealDataPipelinePlan`(T-0592) / evaluate-side `buildRealDataEvaluationPlan`(T-0591) / 종단 `resolveRealDataResultIssueGhCommandPlan`(T-0588) / pre-실행 `buildRealDataResultIssuePublishPlan`(T-0595) 과 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다. DB/네트워크/env/live-LLM/credential/gh 실행 0 — cloud cron 자율·dependency-free·`dependsOn []`. 실 수집·실 Ollama LLM round-trip·실 gh 박제·daily-test step_eval wiring 은 LAN/credential gate 로 deferred 유지(ADR-0045).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — T-0589 `parseRealDataResultIssueCreateEditOutput(stdout): RealDataResultIssueOutcome` (위임 대상 1) + `RealDataResultIssueOutcome {issueNumber, url}` 정의(L57). URL 패턴·issueNumber guard throw 규약 참조(import type 재사용).
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — T-0590 `buildRealDataResultIssueOutcomeReport(outcome, run): RealDataResultIssueOutcomeReport` (위임 대상 2) + `RealDataResultIssueOutcomeReport {issueNumber, url, gitSha, dateToken, summaryLine}` 정의(L49) + `assertNonBlank`/`assertPositiveIssueNumber` guard 규약(L60-75). import type 재사용.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef {gitSha, dateToken}` 정의(import type 재사용 cross-check).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — 동형 종단 컴포저(T-0588, 위임 throw 그대로 전파·재구현 0·import 재사용·결정론·무공유 패턴 참조).
- `test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts` (T-0588 colocated spec) — 종단 컴포저 spec 구조(위임 throw 전파·무공유·결정론 case 묶음) 참조.

신규 spec 은 colocated: `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts` (NestJS/jest colocated convention, T-0588/T-0595 동형).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` 신규 — `buildRealDataResultIssueOutcomeReportFromOutput(stdout: string, run: RealDataResultIssueRunRef): RealDataResultIssueOutcomeReport` 순수 함수. 합성 순서(2 단계 위임): (1) `parseRealDataResultIssueCreateEditOutput(stdout)`(T-0589) → outcome, (2) `buildRealDataResultIssueOutcomeReport(outcome, run)`(T-0590) → report. 신규 type 정의 0 — `RealDataResultIssueRunRef` / `RealDataResultIssueOutcome` / `RealDataResultIssueOutcomeReport` 전부 import type 재사용(이미 단일 함수가 기존 `RealDataResultIssueOutcomeReport` 를 그대로 반환하므로 컨테이너 type 도 신규 0).
- [ ] **위임 재구현 0** — URL 파싱·issueNumber 검증·run 식별자 guard·summaryLine 합성 로직을 본 helper 가 재구현하지 않는다(T-0589·T-0590 위임 호출만 순서대로 엮음). grep 으로 `ISSUE_URL_PATTERN`/`assertNonBlank`/`assertPositiveIssueNumber`/정규표현식 직접 사용이 없음(T-0589·T-0590 만 호출) 확인.
- [ ] **import type 재사용** — `RealDataResultIssueRunRef` / `RealDataResultIssueOutcome` / `RealDataResultIssueOutcomeReport` 전부 `import type` 재사용(신규 중복 정의 0).
- [ ] **위임 throw 전파(자체 try/catch 0)** — (1) stdout 에서 issue URL 미발견·`/pull/`·비-github 호스트·issueNumber 0/선행0/비정수 → T-0589 파서 throw 가 자체 try/catch 없이 그대로 전파(T-0590 단계 미도달). (2) run.gitSha/dateToken 빈/공백 → T-0590 guard throw 전파. 본 컴포저는 어느 layer 의 throw 도 삼키지 않는다.
- [ ] **Happy-path unit test 1+** — 유효 stdout(`https://github.com/owner/repo/issues/<n>` 포함) + 유효 run → `RealDataResultIssueOutcomeReport` 산출 검증: `issueNumber`/`url` 이 `parseRealDataResultIssueCreateEditOutput(stdout)` 산출과 일치, 전체 report 가 `buildRealDataResultIssueOutcomeReport(parse(stdout), run)` 단독 호출 결과와 deep-equal(summaryLine 포함).
- [ ] **Error path unit test 1+** — (a) stdout 에서 URL 미발견(빈/공백/무관 텍스트) → 파서 throw 전파(T-0590 미도달). (b) run.gitSha 빈/공백 → outcome-report guard throw 전파. (c) run.dateToken 빈/공백 → throw 전파. 각 1+ test.
- [ ] **Flow / branch 분기 cover** — (a) stdout 다중 줄(부가 메시지 + URL) → 첫 매칭 URL 결정론적 사용. (b) `gh issue edit` stdout vs `gh issue create` stdout 양쪽 형태 모두 정상 파싱→리포트. (c) 정상 합성 분기 vs 각 guard throw 분기. 각 1+ test.
- [ ] **negative cases 충분 cover** — 예외 상황 각 1+ test: stdout URL 미발견 / `/pull/` 경로 / 비-github 호스트 / issueNumber 0 / issueNumber 선행0(`007`) / issueNumber 비정수 토큰(`/issues/abc`) / run.gitSha 빈·공백-only·탭개행 / run.dateToken 빈·공백-only·탭개행. 단일 negative 만 작성 금지 — 각 위임 guard 분기마다 cover.
- [ ] **결정론·무공유** — 동일 (stdout, run) 두 번 호출 → deep-equal 결과(summaryLine byte-identical) + 반환 report 가 매 호출 not-same-ref(새 객체). 입력 `run` 객체 mutate 0 검증(호출 전후 deep-equal 스냅샷; stdout 은 문자열 불변).
- [ ] **R-59 정합** — report 가 raw narrative / 원본 활동 본문 / 이슈 body 를 구조적으로 미보유(위임 helper 들이 issueNumber/url/gitSha/dateToken/summaryLine 만 보유 → 구조적으로 불가). 본문 주석에 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (전체 line ≥ 80% / function ≥ 80%, 신규 helper line/branch/func 100% 목표).

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama / `EvaluationResult` 실 산출(step ③ live, LAN=AKIHA 192.168.0.5, ADR-0045).
- 실 github.com 네트워크 fetch / 실 활동 수집(step ② live, LAN/credential gate).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit·박제(step ④ live wiring — credential gate). 본 컴포저는 (stdout, run) → 실행 리포트 descriptor 만 산출(부수효과 0). stdout 은 이미 실행된 gh 의 산출로 인자로만 받음.
- search stdout → action 분기 → create/edit argv 합성(T-0587/T-0584/T-0585/T-0588 측 `resolveRealDataResultIssueGhCommandPlan`) — 본 helper 는 create/edit stdout(실행 후) → 실행 리포트만 책임(pre-실행 측 미보유).
- pre-실행 publish plan 합성(T-0595 측 `buildRealDataResultIssuePublishPlan`) — 본 helper 는 post-실행 측 단일 진입점.
- URL 파싱(T-0589 위임) / issueNumber 검증(T-0589 위임) / run 식별자 guard·summaryLine 합성(T-0590 위임) — 전부 위임 안에서 처리(재구현 금지).
- run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short sha — 인자로만 받음).
- 외부 라이브러리(zod / execa 등) 도입 — 새 dependency 0, 위임 함수 import 재사용만.
- production `src/` 코드 변경 — test helper 단독.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
