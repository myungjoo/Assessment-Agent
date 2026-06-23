---
id: T-0593
title: 실 평가 e2e EvaluationResult[] + run → 결과 이슈 descriptor 종단 순수 컴포저
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles: [test/helpers/realdata-e2e-result-report-plan.ts, test/helpers/realdata-e2e-result-report-plan.spec.ts]
plannerNote: P5 PLAN 109행 step③(평가)→④(박제) post-evaluation 종단 컴포저 — EvaluationResult[]+run → 결과 이슈 descriptor 묶음(T-0580→T-0582 위임). build-time 순수·cloud-safe·dependency-free·dependsOn []
---

# T-0593 — 실 평가 e2e EvaluationResult[] + run → 결과 이슈 descriptor 종단 순수 컴포저

## Why

[PLAN.md](../PLAN.md) 109행 (🟢 실 평가 e2e, P5) 의 post-evaluation interpretation(평가 산출 → 결과 이슈 박제 직전) 측 build-time chain 은 현재 **두 개의 분리된 순수 link** 로 끊겨 있다 — (a) `buildRealDataResultSummary(results: EvaluationResult[])` (T-0580) 가 step ③ scoreUnit 산출 `EvaluationResult[]` → `RealDataResultSummary`(count + 분포 + totalVolume) 로 집계하고, (b) `buildRealDataResultIssueDescriptor(summary, run)` (T-0582) 가 그 요약 + `RealDataResultIssueRunRef` → daily-test 결과 이슈 박제용 `RealDataResultIssueDescriptor`(title/marker/body) 로 묶는다. step ④ live runner 가 `EvaluationResult[]` + run 식별자만 들고 와 이슈 descriptor 까지 한 번에 도출하려면 이 두 helper 를 **수동으로 순서 조립**해야 한다.

본 task 는 그 2 단계를 단일 순수 함수 `buildRealDataResultReportPlan(results, run)` 로 합성해 step ③→④ 경계의 build-time round-trip 을 닫는다 — seed-side 진입 컴포저 `buildRealDataPipelinePlan` (T-0592), evaluate-side `buildRealDataEvaluationPlan` (T-0591), step ④ 박제측 `resolveRealDataResultIssueGhCommandPlan` (T-0588) / `buildRealDataResultIssueOutcomeReport` (T-0590) 과 동형의 "분리된 순수 link 들을 단일 plan 컴포저로 묶는" 박제다. 이 slice 가 박제되면 post-evaluation interpretation 측 진입(`EvaluationResult[]` → 요약 집계 → 이슈 descriptor)이 단일 컴포저로 닫혀, live runner 는 평가 산출과 run 식별자만 넘기면 된다.

REQ-059(raw 미저장) 정합: 본 컴포저는 위임 helper 들이 보유하지 않는 raw narrative/원본 활동 본문을 구조적으로 보유할 수 없다 — `RealDataResultSummary`(식별자 카운트·분류 enum 분포·정량 합산만)와 `RealDataResultIssueDescriptor`(title/marker/body, body 는 요약 렌더만) 만 통과시킨다. DB·네트워크·env·live-LLM·credential·gh 실행 0 (build-time 순수, cloud-safe·dependency-free, `dependsOn []`) — 어떤 cron fire 든 claim 가능.

## Required Reading

- [docs/tasks/T-0592-realdata-e2e-pipeline-plan-composer.md](T-0592-realdata-e2e-pipeline-plan-composer.md) — seed-side 진입 종단 컴포저 패턴 (동형 참조, 위임 throw 전파·import type 재사용·무공유·결정론 규약).
- [test/helpers/realdata-e2e-result-summary.ts](../../test/helpers/realdata-e2e-result-summary.ts) — `buildRealDataResultSummary(results: EvaluationResult[]): RealDataResultSummary` (위임 1, 집계). `EvaluationResult` 는 `src/assessment-evaluation/domain/evaluation-result` 에서 import type 재사용.
- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `buildRealDataResultIssueDescriptor(summary, run): RealDataResultIssueDescriptor` (위임 2, 이슈 descriptor) + `RealDataResultIssueRunRef {gitSha, dateToken}` 정의(L70-73) + `assertNonBlank` guard 규약(L93-99, gitSha/dateToken 빈/공백 throw). import type 재사용.
- [test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts](../../test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts) — colocated spec 구조(happy/error/negative/결정론 case 묶음) 참고.
- **colocated spec 작성 위치**: `test/helpers/realdata-e2e-result-report-plan.spec.ts` (NestJS/jest colocated convention — 기존 realdata-e2e helper spec 들과 동일 배치). helper 본문은 `test/helpers/realdata-e2e-result-report-plan.ts`.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-report-plan.ts` 신설 — `buildRealDataResultReportPlan(results: EvaluationResult[], run: RealDataResultIssueRunRef): RealDataResultReportPlan` 순수 함수 + `RealDataResultReportPlan` 컨테이너 type 1개 (`{ summary: RealDataResultSummary; descriptor: RealDataResultIssueDescriptor }`). `EvaluationResult` / `RealDataResultSummary` / `RealDataResultIssueRunRef` / `RealDataResultIssueDescriptor` 는 전부 import type 재사용 (신규 정의 0 — 컨테이너 1개만).
- [ ] 합성 순서(2 단계 위임): (1) `buildRealDataResultSummary(results)` → summary, (2) `buildRealDataResultIssueDescriptor(summary, run)` → descriptor. 위임 helper 의 매핑/집계/guard 로직 재구현 0. 위임 `assertNonBlank`(run.gitSha/dateToken 빈/공백) throw 는 자체 try/catch 없이 그대로 전파.
- [ ] **Happy-path test 1+**: 정상 `EvaluationResult[]` + 유효 run → `{ summary, descriptor }` 산출. summary 가 `buildRealDataResultSummary` 단독 호출 결과와 deep-equal, descriptor 가 `buildRealDataResultIssueDescriptor(summary, run)` 단독 호출 결과와 deep-equal 검증.
- [ ] **Error path test 1+**: run.gitSha 빈/공백(`""`, `"  "`, `"\t\n"`) → 위임 guard throw 전파, run.dateToken 빈/공백 → throw 전파 검증(자체 try/catch 없이 그대로 전파).
- [ ] **Flow / branch test**: 빈 `results` 배열 → summary count 0·전 슬롯 0·totalVolume 0 + descriptor 정상 합성(run 유효 시 throw 0) / 단일 result / 다수 result(서로 다른 difficulty·contribution 슬롯 포함) 각 분기 1+ test. run guard 분기(gitSha 유효/빈, dateToken 유효/빈) 각 1+.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: (1) run.gitSha 빈 / 공백-only / 탭개행, (2) run.dateToken 빈 / 공백-only / 탭개행, (3) 빈 results 배열 경계(throw 0, 빈 분포 descriptor), (4) 무공유 — 반환 plan·summary·descriptor 가 입력 results·run 과 무공유(입력 mutate 0·매 호출 새 객체 트리·deep-equal 이지만 not-same-reference), (5) 결정론(동일 (results, run) 2회 호출 deep-equal). 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] **결정론·무공유 검증**: 동일 (results, run) 두 번 호출 → deep-equal 결과 + 입력 객체 unchanged(mutate 0) test 1+.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 helper line/branch/func 100% 목표).
- [ ] R-59 정합: plan 은 요약 집계 descriptor + 이슈 descriptor 만 보유 — raw 활동/narrative 본문 구조적으로 포함 불가(위임 helper 들이 이미 미보유). 본문 주석에 명시.

## Out of Scope

- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama / `EvaluationResult` 실 산출 (step ③ live, LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로 — ADR-0045).
- 실 github.com 네트워크 fetch / 실 활동 수집 (step ② live, LAN/credential gate).
- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 박제 (step ④ live wiring — credential gate). 본 컴포저는 (results, run) → report plan descriptor 만 산출(부수효과 0).
- run.gitSha / run.dateToken 의 실 도출(daily-test latest-result.json / git short sha) — 인자로만 받음.
- 마크다운 렌더(T-0581 위임, descriptor 내부) · gh 명령-args 합성(T-0583/T-0588 측) · 종단 outcome 리포트(T-0590) — 본 helper 는 EvaluationResult[]+run → 이슈 descriptor 단일 책임.
- `deploy/daily-test.sh` step_eval wiring (step ④ live).
- 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 검증만.
- production `src/` 코드 변경 — test helper 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점 비어둠)
