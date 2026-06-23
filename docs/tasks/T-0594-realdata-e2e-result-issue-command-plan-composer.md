---
id: T-0594
title: 실 평가 e2e EvaluationResult[] + run → 결과 이슈 명령-args 종단 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles: [test/helpers/realdata-e2e-result-issue-command-plan.ts, test/helpers/realdata-e2e-result-issue-command-plan.spec.ts]
plannerNote: P5 PLAN 109행 step③(평가)→④(박제) post-evaluation 종단 컴포저 — EvaluationResult[]+run → 결과 이슈 gh 명령-args(T-0593→T-0583 위임). build-time 순수·cloud-safe·dependency-free·dependsOn []
---

# T-0594 — 실 평가 e2e EvaluationResult[] + run → 결과 이슈 명령-args 종단 순수 컴포저

## Why

[PLAN.md](../PLAN.md) 109행 (🟢 실 평가 e2e, P5) 의 post-evaluation interpretation(평가 산출 → 결과 이슈 박제) 측 build-time chain 은 T-0593 으로 `EvaluationResult[]` + run → 결과 이슈 **descriptor** 까지 닫혔지만(`buildRealDataResultReportPlan(results, run) → {summary, descriptor}`), 그 descriptor 를 step ④ 박제측이 소비하는 **gh 명령-args** 로 바꾸려면 `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) 를 caller 가 한 번 더 수동으로 엮어야 한다 — 즉 `EvaluationResult[]` + run 에서 gh 명령-args(`RealDataResultIssueCommandArgs`)까지의 경로가 아직 두 helper 호출로 흩어져 있다.

본 task 는 그 2 단계를 단일 순수 함수 `buildRealDataResultIssueCommandPlan(results, run)` 로 합성해 post-evaluation interpretation 측을 종단까지 닫는다 — (1) `buildRealDataResultReportPlan(results, run)` (T-0593) → `{summary, descriptor}`, (2) `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) → `RealDataResultIssueCommandArgs`. 산출 `{report, commandArgs}` 의 `commandArgs` 는 정확히 step ④ 종단 컴포저 `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)` (T-0588) 가 받는 두 번째 인자다. 이 slice 가 박제되면 live runner 는 평가 산출(`EvaluationResult[]`)과 run 식별자만 들고 와 결과 이슈 gh 명령-args 까지 단일 컴포저로 도출할 수 있고, 남는 외부 경계는 deferred `execFile('gh', ...)` 호출(step ②·④ live)뿐이다 — seed-side `buildRealDataPipelinePlan` (T-0592), evaluate-side `buildRealDataEvaluationPlan` (T-0591), 박제 종단 `resolveRealDataResultIssueGhCommandPlan` (T-0588) 과 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다.

REQ-059(raw 미저장) 정합: 본 컴포저는 위임 helper 들이 보유하지 않는 raw narrative/원본 활동 본문을 구조적으로 보유할 수 없다 — `RealDataResultReportPlan`(요약 집계 + title/marker/body descriptor 만)과 `RealDataResultIssueCommandArgs`(searchQuery/createArgs/updateArgs, body 는 descriptor.body 전달만) 만 통과시킨다. DB·네트워크·env·live-LLM·credential·gh 실행 0 (build-time 순수, cloud-safe·dependency-free, `dependsOn []`) — 어떤 cron fire 든 claim 가능.

## Required Reading

- [docs/tasks/T-0593-realdata-e2e-result-report-plan-composer.md](T-0593-realdata-e2e-result-report-plan-composer.md) — 직전 동형 종단 컴포저 패턴(위임 throw 전파·import type 재사용·무공유·결정론 규약).
- [test/helpers/realdata-e2e-result-report-plan.ts](../../test/helpers/realdata-e2e-result-report-plan.ts) — `buildRealDataResultReportPlan(results: EvaluationResult[], run: RealDataResultIssueRunRef): RealDataResultReportPlan` (위임 1) + `RealDataResultReportPlan {summary, descriptor}` 정의(L79). `EvaluationResult` / `RealDataResultIssueRunRef` import type 출처 확인.
- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) — `buildRealDataResultIssueCommandArgs(descriptor: RealDataResultIssueDescriptor): RealDataResultIssueCommandArgs` (위임 2) + `RealDataResultIssueCommandArgs` 정의(L88) + `assertNonBlank` guard 규약(L96-102, descriptor.title/marker 빈/공백 throw). import type 재사용.
- [test/helpers/realdata-e2e-result-issue-gh-command-plan.ts](../../test/helpers/realdata-e2e-result-issue-gh-command-plan.ts) — 동형 종단 컴포저(위임 합성·throw 전파·무공유 본문 주석 패턴 참고). 본 task 산출 `commandArgs` 가 이 helper 의 두 번째 인자임 확인.
- **colocated spec 작성 위치**: `test/helpers/realdata-e2e-result-issue-command-plan.spec.ts` (NestJS/jest colocated convention — 기존 realdata-e2e helper spec 들과 동일 배치). helper 본문은 `test/helpers/realdata-e2e-result-issue-command-plan.ts`.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-plan.ts` 신설 — `buildRealDataResultIssueCommandPlan(results: EvaluationResult[], run: RealDataResultIssueRunRef): RealDataResultIssueCommandPlan` 순수 함수 + `RealDataResultIssueCommandPlan` 컨테이너 type 1개 (`{ report: RealDataResultReportPlan; commandArgs: RealDataResultIssueCommandArgs }`). `EvaluationResult` / `RealDataResultIssueRunRef` / `RealDataResultReportPlan` / `RealDataResultIssueCommandArgs` 는 전부 import type 재사용 (신규 정의 0 — 컨테이너 1개만).
- [ ] 합성 순서(2 단계 위임): (1) `buildRealDataResultReportPlan(results, run)` → report(`{summary, descriptor}`), (2) `buildRealDataResultIssueCommandArgs(report.descriptor)` → commandArgs. 위임 helper 의 집계/렌더/명령-args 합성 로직 재구현 0. 위임 guard throw(run.gitSha/dateToken 빈/공백 → report-plan 측, descriptor.title/marker 빈/공백 → command-args 측)는 자체 try/catch 없이 그대로 전파.
- [ ] **Happy-path test 1+**: 정상 `EvaluationResult[]` + 유효 run → `{ report, commandArgs }` 산출. report 가 `buildRealDataResultReportPlan(results, run)` 단독 호출 결과와 deep-equal, commandArgs 가 `buildRealDataResultIssueCommandArgs(report.descriptor)` 단독 호출 결과와 deep-equal 검증.
- [ ] **Error path test 1+**: run.gitSha 빈/공백(`""`, `"  "`, `"\t\n"`) → report-plan 위임 guard throw 전파, run.dateToken 빈/공백 → throw 전파 검증(자체 try/catch 없이 그대로 전파).
- [ ] **Flow / branch test**: 빈 `results` 배열 → report.summary count 0·전 슬롯 0·totalVolume 0 + descriptor/commandArgs 정상 합성(run 유효 시 throw 0) / 단일 result / 다수 result(서로 다른 difficulty·contribution 슬롯 포함) 각 분기 1+ test. run guard 분기(gitSha 유효/빈, dateToken 유효/빈) 각 1+.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: (1) run.gitSha 빈 / 공백-only / 탭개행, (2) run.dateToken 빈 / 공백-only / 탭개행, (3) 빈 results 배열 경계(throw 0, 빈 분포 report·commandArgs.searchQuery 정상 marker), (4) 무공유 — 반환 plan·report·commandArgs 가 입력 results·run 과 무공유(입력 mutate 0·매 호출 새 객체 트리·중첩 createArgs.labels 배열 not-same-reference·deep-equal 이지만 not-same-reference), (5) 결정론(동일 (results, run) 2회 호출 deep-equal). 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] **결정론·무공유 검증**: 동일 (results, run) 두 번 호출 → deep-equal 결과 + 입력 객체 unchanged(mutate 0) test 1+. 반환 commandArgs.createArgs.labels 배열 mutate 가 다음 호출/위임 상수에 누설되지 않음 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 helper line/branch/func 100% 목표).
- [ ] R-59 정합: plan 은 요약 집계 + 이슈 descriptor + 명령-args(searchQuery/title/body/labels) 만 보유 — raw 활동/narrative 본문 구조적으로 포함 불가(위임 helper 들이 이미 미보유). 본문 주석에 명시.

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama / `EvaluationResult` 실 산출 (step ③ live, LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로 — ADR-0045).
- 실 github.com 네트워크 fetch / 실 활동 수집 (step ② live, LAN/credential gate).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 search·create·edit / 실 이슈 박제 (step ④ live wiring — credential gate). 본 컴포저는 (results, run) → command plan descriptor 만 산출(부수효과 0).
- gh search stdout 파싱 → action 분기 → argv 합성(T-0587/T-0584/T-0585/T-0588 측 `resolveRealDataResultIssueGhCommandPlan`) — 본 helper 는 그 컴포저가 받는 `commandArgs` 입력까지만 책임.
- run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short sha) — 인자로만 받음.
- 마크다운 렌더(T-0581 위임, descriptor 내부) · 요약 집계(T-0580) · descriptor 합성(T-0582) — 본 helper 는 EvaluationResult[]+run → 결과 이슈 명령-args 단일 책임(위임만).
- `deploy/daily-test.sh` step_eval wiring (step ④ live).
- 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 검증만.
- production `src/` 코드 변경 — test helper 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점 비어둠)
