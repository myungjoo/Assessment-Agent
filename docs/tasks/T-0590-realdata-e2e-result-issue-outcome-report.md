---
id: T-0590
title: 실 평가 e2e 결과 이슈 박제 outcome + run → e2e 실행 리포트 순수 컴포저
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-06-23T05:54:42Z
prNumber: 503
squashSha: 88ee477
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report.spec.ts
plannerNote: "P5 PLAN 109행 step④ build-time chain post-실행 종단 — 박제 outcome {issueNumber,url} + run ref → e2e 실행 리포트 descriptor 순수 컴포저. round-trip 닫음, cloud-safe·dependency-free·dependsOn []"
---

# T-0590 — 실 평가 e2e 결과 이슈 박제 outcome + run → e2e 실행 리포트 순수 컴포저

## Why

[PLAN.md](../PLAN.md) 109행 step④ (자율 nightly 실 평가 e2e — 결과를 daily-test result/rolling 이슈에 박제) 의 build-time chain 중 **실행-후 해석(post-execution interpretation) 의 종단 컴포저**를 박제한다.

현재 post-실행 측 chain 은 다음까지 닫혀있다:

- T-0589 `parseRealDataResultIssueCreateEditOutput` 이 `execFile('gh', argv)` 의 stdout(이슈 URL) → `RealDataResultIssueOutcome {issueNumber, url}` 로 파싱한다.

그러나 caller(daily-test live wiring)가 이슈 박제 직후 **"어느 run 이 어느 이슈에 무엇을 박제했는가"를 사람-친화 확인 리포트로 묶는 단계**가 빠져있다. T-0582 `buildRealDataResultIssueDescriptor` 의 `RealDataResultIssueRunRef {gitSha, dateToken}` 가 run 을 식별하고, T-0589 outcome 이 박제 결과(issueNumber/url)를 담으므로, 이 둘을 결합하면 daily-test step 이 로그/이슈 코멘트로 emit 할 수 있는 **결정론적 e2e 실행 리포트 descriptor** 가 만들어진다. 이 slice 가 박제되면 post-실행 측 round-trip(stdout 파싱 → run 식별 결합 → 확인 리포트)이 닫힌다.

REQ-059(raw 미저장) 정합: 리포트는 run 식별자(gitSha/dateToken)와 박제 결과(issueNumber/url)만 보유하고 평가 narrative/원본 활동은 보유하지 않는다. step④ 가 daily-test 자율 e2e 결과 박제 확인(R-30 GitHub Issue 로의 평가 결과 외화)을 cover 한다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-output-parse.ts](../../test/helpers/realdata-e2e-result-issue-output-parse.ts) — T-0589 `RealDataResultIssueOutcome {issueNumber, url}` 정의. 본 컴포저의 입력 1. import type 재사용(신규 정의 0).
- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `RealDataResultIssueRunRef {gitSha, dateToken}` 정의(L70-73) + `assertNonBlank` guard 규약(L93). 본 컴포저의 입력 2 및 guard 동형 정합.
- [test/helpers/realdata-e2e-result-issue-gh-command-plan.ts](../../test/helpers/realdata-e2e-result-issue-gh-command-plan.ts) — 다른 종단 컴포저(build-time 측). 위임 helper throw 그대로 전파·재구현 0·import 재사용·결정론·무공유 패턴을 본 helper 가 동형으로 따른다.
- [test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts](../../test/helpers/realdata-e2e-result-issue-gh-command-plan.spec.ts) — colocated spec 구조(happy/error/negative/결정론 case 묶음) 참고.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-outcome-report.ts` 신규 작성. 순수 함수 `buildRealDataResultIssueOutcomeReport(outcome: RealDataResultIssueOutcome, run: RealDataResultIssueRunRef): RealDataResultIssueOutcomeReport` export — 박제 outcome(issueNumber/url) + run 식별자(gitSha/dateToken) → 결정론적 e2e 실행 리포트 descriptor 로 묶는다.
  - 반환 shape `RealDataResultIssueOutcomeReport` 신규 interface export — 최소 필드: `issueNumber: number`, `url: string`, `gitSha: string`, `dateToken: string`, 사람-친화 `summaryLine: string`(예: `"[<dateToken>@<gitSha>] 결과 이슈 #<issueNumber> 박제 → <url>"`).
  - `RealDataResultIssueOutcome` 와 `RealDataResultIssueRunRef` 는 각 helper 에서 `import type` 재사용(신규 정의 0).
  - run.gitSha / run.dateToken 빈/공백-only guard throw(T-0582 `assertNonBlank` 동형 — 비식별 리포트 방지).
  - outcome.url 빈/공백 guard throw, outcome.issueNumber 양의 정수 아님(0·음수·비정수) guard throw(T-0584 `assertPositiveNumber` 동형).
  - 결정론(동일 입력 → byte-identical `summaryLine`) · 무공유(매 호출 새 객체 반환 · 입력 mutate 0).
- [ ] **Happy-path unit test**: `buildRealDataResultIssueOutcomeReport` 의 정상 입력(유효 outcome + 유효 run) 에 대해 모든 필드 정확 산출 + `summaryLine` 형식 정확 test 1+ 작성.
- [ ] **Error path unit test**: run.gitSha 빈/공백 → throw, run.dateToken 빈/공백 → throw, outcome.url 빈/공백 → throw, outcome.issueNumber 0/음수/비정수 → throw test 각 1+.
- [ ] **Flow / branch coverage**: guard 통과/실패 각 분기(gitSha·dateToken·url·issueNumber 별 throw 분기) + 정상 합성 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 빈 gitSha / 공백-only gitSha / 빈 dateToken / 공백-only dateToken / 빈 url / 공백-only url / issueNumber 0 / issueNumber 음수 / issueNumber 비정수(소수). 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] **결정론·무공유 검증**: 동일 (outcome, run) 두 번 호출 → deep-equal 결과 + 입력 객체 unchanged(mutate 0) test 1+.
- [ ] `pnpm test:cov` 통과 (신규 helper line ≥ 80% / function ≥ 80% — chain norm 대로 100% 목표).
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 실 gh 호출 / `execFile('gh', argv)` / 실 이슈 코멘트 박제 (step④ live wiring — credential gate, deferred). 본 컴포저는 (outcome, run) → report descriptor 만 산출(부수효과 0).
- stdout 파싱(T-0589 위임) · 종단 plan 합성(T-0588 위임) · 결과 요약 마크다운 렌더(T-0581 위임) — 본 helper 는 박제 outcome + run → 실행 리포트 단일 책임.
- `daily-test.sh` step_eval wiring · 실 Ollama LLM round-trip(ADR-0045 LAN=AKIHA 192.168.0.5) — LAN/credential gate deferred 유지.
- 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 검증만.
- production `src/` 코드 변경 — test helper 단독.
- raw 평가 narrative/원본 활동 보유·저장 — REQ-059 정합으로 issueNumber/url/run 식별자만 보유.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점 비어둠)
