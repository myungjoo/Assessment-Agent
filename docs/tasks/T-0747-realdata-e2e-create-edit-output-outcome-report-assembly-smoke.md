---
id: T-0747
title: realdata-e2e create-edit-output→outcome-report 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
completedAt: 2026-06-28T06:42Z
result: "DONE — PR #662 squash 5ed1e477, reviewer round1 APPROVE, 4-게이트 PASS, CI green. test-only +275/-0 1파일 신규 smoke spec 23 it(parseRealDataResultIssueCreateEditOutput→buildRealDataResultIssueOutcomeReport 직접 조립, step④ 박제-후 outcome-report leg)."
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step④ post-execution outcome-report leg 직접 조립 parseRealDataResultIssueCreateEditOutput→buildRealDataResultIssueOutcomeReport smoke. issue-still-relevant: git grep parseRealDataResultIssueCreateEditOutput test/smoke/=NONE(step-args 는 FromOutput aggregator 진입뿐) 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-create-edit-output-outcome-report-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts]
---

# T-0747 — realdata-e2e create-edit-output→outcome-report 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step④(결과 이슈 박제) post-execution(실행-후 해석) side** build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1) `parseRealDataResultIssueCreateEditOutput(stdout)` (T-0589) 가 `gh issue create` / `gh issue edit <n>` 의 stdout(이슈 URL 한 줄)을 `RealDataResultIssueOutcome`(`{issueNumber, url}`)으로 파싱·검증하고, (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` (T-0590) 가 그 outcome 에 run 식별자(`RealDataResultIssueRunRef` = `{gitSha, dateToken}`)를 묶어 결정론적 실행 리포트 descriptor `RealDataResultIssueOutcomeReport`(`{issueNumber, url, gitSha, dateToken, summaryLine}`)로 합성한다.

이 post-execution outcome-report leg 는 step④ 의 **search-side pre-execution leg**(descriptor→commandArgs→searchArgv, T-0746) 의 정확한 round-trip 대칭이다 — search 측은 "이슈 박제 전 명령 합성", outcome-report 측은 "이슈 박제 후 결과 해석". 그러나 **이 두 컴포저(parse→buildReport)를 직접 chain 으로 묶은 non-gated build-time smoke 는 부재**다. 기존 `realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts` (T-0596) 는 **aggregator `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`** (T-0591) 진입 또는 step-args wrapper 진입으로만 검증할 뿐, `stdout → outcome → report` 중간 변환 산출(issueNumber/url 추출·양수 issueNumber 검증·URL 첫-매칭 결정론·run 식별자 thread·summaryLine 합성·5필드 전파)을 **두 helper 의 직접 chain 으로 묶은 단언은 0** 이다 (`git grep parseRealDataResultIssueCreateEditOutput test/smoke/` = NONE — 직접 chain smoke 파일 부재, 컴포저 unit + consistency + parse-shape spec 만 존재 확인).

즉 outcome shape drift(issueNumber/url 추출 오류·비-github 호스트·`/pull/` 경로 오매칭)·issueNumber 비양수(`/issues/0`·선행 0·비정수) throw 전파·URL 미발견(빈/공백/무관 텍스트) throw 전파·run.gitSha/dateToken 빈/공백 throw 전파(report 단계 선평가)·summaryLine 합성 drift(토큰 순서·구분자·접두)·5필드 전파 drift·raw 본문/narrative 누출 0(R-59/REQ-059)·결정론(동일 (stdout, run) → byte-identical) 분기는 public CI 에서 직접 발화되지 않고 step-args wrapper 또는 step④ live gh-gated runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — search-side pre-execution leg(T-0746) 직접 조립 smoke 의 **post-execution outcome-report leg 대칭 sibling** 으로, create/edit stdout→outcome→report 종단 조립 surface 회귀를 public CI 그물로 박제해 step④ 의 박제-전(search-argv)·박제-후(outcome-report) 양 끝 직접-체인 smoke 를 모두 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — 위임 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` → `RealDataResultIssueOutcome`(`{issueNumber, url}`). `https://github.com/<owner>/<repo>/issues/<number>` 첫 매칭·비-github/`/pull/`/미발견 throw·issueNumber 양수(`[1-9]\d*`, 0/선행0/비정수 throw)·url trim 정규화·raw 미저장(R-59)·결정론·매 호출 새 객체(무공유) 규칙. `RealDataResultIssueOutcome` type 정의도 여기
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — 위임 (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` → `RealDataResultIssueOutcomeReport`(`{issueNumber, url, gitSha, dateToken, summaryLine}`). run.gitSha/dateToken 빈/공백 throw·outcome.url 빈/공백 throw·outcome.issueNumber 비양수 throw(각 별도 분기)·summaryLine=`[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}` 합성·5필드 전파·매 호출 새 객체(무공유) 규칙
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef`(`{gitSha, dateToken}`) 정의(73행). synthetic run literal 구성용 필드 집합 참고
- `test/smoke/realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts` — step④ search-side(박제-전) 대칭 sibling smoke(T-0746). non-gated describe·deep-equal 단일 source 대조·throw 전파·결정론·무공유·no-mutation·non-gated·credential 누출 0 패턴의 mirror 템플릿
- `test/smoke/realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts` — aggregator(`buildRealDataResultIssueOutcomeReportFromOutput`) 진입 형제 smoke(T-0596). synthetic stdout/run literal 빌더 패턴 참고용(본 task 는 aggregator 가 아닌 두 helper 직접 chain 으로 재작성)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — synthetic create/edit stdout literal(유효 `https://github.com/<owner>/<repo>/issues/<n>` 포함) + synthetic `RealDataResultIssueRunRef` literal → `parseRealDataResultIssueCreateEditOutput(stdout)` → `buildRealDataResultIssueOutcomeReport(outcome, run)` 종단 chain 을 한 번에 실행. (a) 산출 report 가 `{issueNumber, url, gitSha, dateToken, summaryLine}` 5필드 정확히 보유 1+ test. (b) report 가 expected literal(issueNumber=stdout URL 의 번호·url=trim 된 매칭 URL·gitSha/dateToken=run 전파·summaryLine=합성식 결과)과 deep-equal 1+ test. (c) report.issueNumber·report.url 이 중간 outcome(parse 산출)의 값과 동일하게 전파(재합성 없이 위임 산출만 thread) 1+ test.
- [ ] **단일 source 조립 단언** — 동일 (stdout, run) 에 대해 직접 chain 산출 report 가 `buildRealDataResultIssueOutcomeReport(parseRealDataResultIssueCreateEditOutput(stdout), run)` 와 deep-equal(중간 outcome 단일 source 전파, 재합성 없이 위임 산출만 옮김) 1+ test. report.summaryLine 이 `[${run.dateToken}@${run.gitSha}] 결과 이슈 #${outcome.issueNumber} 박제 → ${outcome.url}` 합성식과 일치(구성 4필드↔summaryLine 정합) 1+ test.
- [ ] **Error/negative path test** — (a) stdout 에 issue URL 미발견(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 경로) → `parseRealDataResultIssueCreateEditOutput` throw 를 자체 try/catch 없이 조립 경로로 그대로 전파 (`expect(() => buildRealDataResultIssueOutcomeReport(parseRealDataResultIssueCreateEditOutput(badStdout), run)).toThrow`) 1+ test. (b) issueNumber 비양수(`/issues/0`·선행 0·비정수) → parse throw 전파 1+ test. (c) `run.gitSha` 빈/공백 → report 단계 guard throw 전파(stdout 유효해도 report guard 발화) 1+ test. (d) `run.dateToken` 빈/공백 → report guard throw 전파 1+ test.
- [ ] **Flow / branch coverage** — (a) raw 본문/narrative 누출 0: report 어느 필드에도 token/secret/raw narrative 패턴 미포함(issueNumber/url/gitSha/dateToken/summaryLine 안정 토큰만, R-59/REQ-059 정합) 1+ test. (b) 다중 줄 stdout 결정론: gh 부가 메시지 줄이 섞인 stdout 에서도 issue URL 첫 매칭만 사용해 동일 outcome→report 산출 1+ test. (c) URL trailing 개행/공백 trim 정규화: stdout 의 URL 에 trailing 공백/개행이 있어도 report.url 이 trim 됨 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) URL 미발견 → throw, (b) issueNumber 비양수 → throw, (c) run.gitSha 빈/공백 → throw 전파, (d) run.dateToken 빈/공백 → throw 전파, (e) **결정론·무공유**: 동일 (stdout, run) 두 번 chain 호출 시 deep-equal report + 매 호출 새 report 객체(반환 참조 비동일), (f) **no-mutation**: 입력 run 객체(및 중첩 필드)가 chain 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (synthetic stdout/run literal 직접 주입).
- [ ] live leg (실 gh 호출 / `execFile('gh', argv)` / `gh issue create`·`gh issue edit` 실 실행 / 실 이슈 박제 / 실 네트워크 / DB 접근 / 실 jest spawn) 복제 0 — create/edit stdout→outcome→report 조립 surface 만 검증 (synthetic stdout/run literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-result-outcome-step-args-assembly.smoke-spec.ts` (T-0596, `buildRealDataResultIssueOutcomeReportFromOutput` aggregator / step-args wrapper 진입) 의 재검증 — 본 task 는 그 aggregator 아래 **parse→buildReport 두 helper 직접 chain** 만 책임 (중복·재검증 0).
- 기존 `realdata-e2e-command-args-search-gh-argv-assembly.smoke-spec.ts` (T-0746, descriptor→commandArgs→searchArgv search-side) — 본 task 는 post-execution outcome-report leg 만, 별개 절단면(박제-전 ↔ 박제-후).
- 기존 step④ stdout-side(`realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts`, T-0742, search stdout→hits→action→create/edit argv) — 본 task 는 create/edit **실행 후** stdout→report 만, 별개 절단면.
- 실 gh issue create·edit 실행 / `execFile('gh', argv)` 실 실행 / 실 이슈 박제 / 실 github 네트워크 / 실 LLM round-trip / Ollama / DB 접근 / 실 jest spawn.
- aggregator 컴포저(`buildRealDataResultIssueOutcomeReportFromOutput`, T-0596 cover) / step-args wrapper(`buildRealDataResultIssueOutcomeStepArgs`) / publish-step-args — 본 task 는 parse→buildReport 직접 chain surface 만.
- 컴포저 소스(`realdata-e2e-result-issue-output-parse.ts` / `realdata-e2e-result-issue-outcome-report.ts`) / 위임 consistency·parse-shape·summary-line 가드 / descriptor·run-ref 정의 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0746 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
