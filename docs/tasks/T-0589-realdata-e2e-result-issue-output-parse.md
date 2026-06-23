---
id: T-0589
title: 실 평가 e2e 결과 이슈 gh create/edit stdout → 박제 결과 순수 파서
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-output-parse.ts
  - test/helpers/realdata-e2e-result-issue-output-parse.spec.ts
plannerNote: "P5 PLAN 109행 step④ build-time chain post-실행 interpretation slice — gh issue create/edit stdout(이슈 URL) → {issueNumber,url} 순수 파서. T-0587 search-parse 의 대칭(실행 후 측), cloud-safe·dependency-free·dependsOn []"
---

# T-0589 — 실 평가 e2e 결과 이슈 gh create/edit stdout → 박제 결과 순수 파서

## Why

[PLAN.md](../PLAN.md) 109행 step④ (자율 nightly 실 평가 e2e — 결과를 daily-test result/rolling 이슈에 박제) 의 build-time chain 중 **실행-후 해석(post-execution interpretation) 측**의 누락 link 를 채운다. 현재 chain 의 양 끝은 이미 박제됨:

- T-0585 `buildRealDataResultIssueGhArgv` 가 `gh issue create` / `gh issue edit <n>` 의 argv 를 합성하고,
- T-0588 `resolveRealDataResultIssueGhCommandPlan` 이 search stdout + commandArgs → `{action, argv}` 종단 plan 을 산출한다.

그러나 caller(live wiring)가 `execFile('gh', argv)` 로 issue 를 실 박제한 뒤 **그 stdout(생성/수정된 이슈 URL — 예: `https://github.com/owner/repo/issues/42`) 을 구조화된 결과 `{issueNumber, url}` 로 파싱·검증하는 단계**가 빠져있다. 이는 T-0587 `parseRealDataResultIssueSearchOutput`(검색 응답 파싱, **실행 전** 측)의 정확한 대칭 — **실행 후** 측 stdout 파싱이다. 본 slice 가 박제되면 build-time chain 이 입력(search)부터 출력(create/edit 결과 확인)까지 round-trip 으로 닫힌다.

REQ-059(raw 미저장) 정합: 파서는 stdout 에서 issueNumber/url 만 추출하고 본문/narrative 는 보유하지 않는다. step④ 가 daily-test 자율 e2e 의 결과 이슈 박제 확인(R-30 GitHub Issue 평가 결과의 외화)을 cover 한다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-search-parse.ts](../../test/helpers/realdata-e2e-result-issue-search-parse.ts) — T-0587 대칭 파서. 엄격 검증·무공유·결정론·dependency-free 패턴을 본 helper 가 동형으로 따른다.
- [test/helpers/realdata-e2e-result-issue-search-parse.spec.ts](../../test/helpers/realdata-e2e-result-issue-search-parse.spec.ts) — colocated spec 구조(happy/error/negative case 묶음) 참고.
- [test/helpers/realdata-e2e-result-issue-gh-command-plan.ts](../../test/helpers/realdata-e2e-result-issue-gh-command-plan.ts) — chain 종단 컴포저. 본 파서가 그 후속 단계(execFile 결과 해석)임을 확인.
- [test/helpers/realdata-e2e-result-issue-action.ts](../../test/helpers/realdata-e2e-result-issue-action.ts) — `assertPositiveNumber`(양의 정수 number 규약). issueNumber 검증을 동형으로 정합.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-output-parse.ts` 신규 작성. 순수 함수 `parseRealDataResultIssueCreateEditOutput(stdout: string): RealDataResultIssueOutcome` export — `gh issue create` / `gh issue edit` 의 stdout(이슈 URL 한 줄)을 `{ issueNumber: number, url: string }` 로 파싱·검증한다.
  - URL 패턴 `https://github.com/<owner>/<repo>/issues/<number>` 에서 `<number>`(양의 정수) 와 정규화된 `url`(trailing whitespace/개행 trim) 추출.
  - stdout 은 여러 줄일 수 있다(gh 가 부가 메시지를 출력할 수 있음) — issue URL 을 포함한 줄을 찾아 파싱(첫 매칭 URL 사용, 결정론적).
- [ ] **Happy-path unit test**: `parseRealDataResultIssueCreateEditOutput` 의 정상 입력(단일 URL 줄, trailing 개행 포함 URL, 여러 줄 중 URL 줄 포함) 에 대해 `{issueNumber, url}` 정확 추출 test 1+ 작성.
- [ ] **Error path unit test**: URL 패턴 미포함 stdout(빈 문자열, 무관한 텍스트, github.com 아닌 호스트, `/issues/` 경로 아님) → 명시적 throw test 1+. issueNumber 가 양의 정수로 파싱 안 되는 경우(예: `/issues/0`, `/issues/abc`) throw test 1+.
- [ ] **Flow / branch coverage**: URL 발견/미발견 분기, number 검증 통과/실패 분기, 다중 줄 vs 단일 줄 분기 각 1+ test (각 분기 cover).
- [ ] **Negative cases 충분 cover** — 예외 상황 각 1+ test: 빈 stdout / 공백-only stdout / URL 형식 깨짐(번호 누락 `…/issues/`) / number 0 또는 음수 또는 비정수 / 비-github 호스트 URL / `/issues/` 가 아닌 `/pull/` 경로 / 앞뒤 공백·탭·개행 혼입. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- [ ] **결정론·무공유 검증**: 동일 stdout 두 번 호출 → deep-equal 결과(매 호출 새 객체 반환·입력 mutate 0) test 1+.
- [ ] `pnpm test:cov` 통과 (신규 helper line ≥ 80% / function ≥ 80% — chain norm 대로 100% 목표).
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 실 gh 호출 / `execFile('gh', argv)` / `gh issue create`·`gh issue edit` 실 실행 (step④ live wiring — credential gate, deferred). 본 파서는 stdout → outcome 만 산출(부수효과 0).
- argv 합성(T-0585 위임) · 종단 plan 합성(T-0588 위임) · search 응답 파싱(T-0587 위임) — 본 helper 는 create/edit stdout 파싱 단일 책임.
- `daily-test.sh` step_eval wiring · 실 Ollama LLM round-trip(ADR-0045 LAN=AKIHA 192.168.0.5) — LAN/credential gate deferred 유지.
- 외부 라이브러리(zod 등) 도입 — 새 dependency 0, 내장 정규표현식 + 수동 검증만.
- production `src/` 코드 변경 — test helper 단독.
- raw issue 본문/narrative 보유·저장 — REQ-059 정합으로 issueNumber/url 만 추출.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점 비어둠)
