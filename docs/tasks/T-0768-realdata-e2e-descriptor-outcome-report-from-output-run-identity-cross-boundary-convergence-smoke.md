---
id: T-0768
title: realdata-e2e step④ pre/post-execution cross-boundary descriptor↔outcome-report-from-output run-identity(gitSha·dateToken) single-source 수렴 — buildRealDataResultIssueDescriptor.{title,marker} ↔ buildRealDataResultIssueOutcomeReportFromOutput.{gitSha,dateToken} byte-identical cross-boundary 수렴 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-037, REQ-059]
estimatedDiff: 300
estimatedFiles: 1
created: 2026-06-29
plannerNote: "P5 §109 step④ pre/post 경계 sweep — T-0767(issueNumber 축 cross-boundary) 의 run-identity 축 mirror; pre descriptor(buildRealDataResultIssueDescriptor)·post from-output(buildRealDataResultIssueOutcomeReportFromOutput) 두 단일-진입이 동일 run ref(gitSha·dateToken)로 cross-boundary 수렴 박제; 기존 smoke 에 descriptor+from-output 동시-호출 0 확인"
independentStream: realdata-e2e-descriptor-outcome-report-from-output-run-identity-cross-boundary-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-stage run-identity 2-leg pre/post 경계·branch·negative 분기 다수 + no-mutation/credential/결정론) = ~300 LOC 1파일, T-0767(548)/T-0766(659)/T-0765(586)/T-0764(525) sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). sweep sibling 이 일관히 cap 초과라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-descriptor-outcome-report-from-output-run-identity-cross-boundary-convergence-assembly.smoke-spec.ts
---

# T-0768 — realdata-e2e step④ pre/post-execution cross-boundary descriptor↔outcome-report-from-output run-identity(gitSha·dateToken) single-source 수렴 non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5)의 step④ 멱등 search-or-update 의 **pre-execution descriptor 합성** 컴포저(`buildRealDataResultIssueDescriptor` — run 식별 token 으로 title/marker 박제)와 **post-execution interpretation 단일-진입** 컴포저(`buildRealDataResultIssueOutcomeReportFromOutput` — T-0596)는 **실 live caller 가 실행 사이클의 양쪽 boundary 에서 동일 `run` ref(gitSha·dateToken)를 실제로 wiring 하는 두 진입점**이다. 그 둘이 동일 run 식별자로 cross-boundary 수렴함이 **search-or-update 멱등성**(REQ-009, "동일 run → 동일 marker·제목")·**결과 리포트 재실행 정합**(REQ-037, "리포트의 gitSha/dateToken 이 실행 run 과 일치")의 종단 사람-친화 닫음이다.

직전 sibling T-0767 은 **issueNumber 축**(search-hit.minNumber → resolve → from-output)을 cross-boundary 로 박제했다. 본 task 는 그 **run-identity 축(gitSha·dateToken) mirror** — issueNumber 가 "어느 이슈에 박제하나"의 식별자라면, run-identity 는 "어느 실행을 박제하나"의 식별자다. 두 단일-진입 컴포저가 같은 `run` ref 를 받아:
- (pre) `buildRealDataResultIssueDescriptor(summary, run).{title, marker}` — 안에 `${run.dateToken}@${run.gitSha}` token 박제(L94 `runToken`).
- (post) `buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run).{gitSha, dateToken}` — 두 번째 위임 단(`buildRealDataResultIssueOutcomeReport(outcome, run)`)이 run 의 gitSha/dateToken 을 그대로 전파.

두 boundary 산출물 안 run-identity token 이 byte-identical 일치함이 본 task 의 새 결정 표면이다 — live caller 의 두 진입점 사이에서 run 식별자 drift 가 0 임을 보장.

기존 sweep 은 **두 진입점 중 어느 한쪽씩만** run ref 를 소비하는 smoke 만 가졌다:
- **T-0767**: descriptor(pre) 미참조 — issueNumber 축만, descriptor 의 title/marker run token 미참조.
- **T-0747** (`create-edit-output-outcome-report-assembly.smoke-spec.ts`): `buildRealDataResultIssueOutcomeReportFromOutput` 의 5필드(gitSha/dateToken 포함) 재유도 — 그러나 descriptor(pre) 측 run token 미참조(post 단독).
- **T-0709 / descriptor identity 가드 sweep**: descriptor.title/marker 의 run token self-consistency 만 — post from-output 측 합류 0.

gap 확인(git grep, origin/main):
- `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataResultIssueDescriptor AND buildRealDataResultIssueOutcomeReportFromOutput 둘 다 실 호출 + run-identity gitSha·dateToken cross-boundary 수렴 단언) 여부; done` — **0 파일**(직전 fire 분석 확인). 어떤 smoke 도 descriptor+from-output 두 단일-진입을 같은 run ref 로 동시-호출하지 않는다.
- T-0767(issueNumber 축 cross-boundary)·T-0747(from-output 단독 5필드 재유도) 와 의도 중복 0 — 본 task 는 **run-identity 축(gitSha·dateToken)의 pre descriptor ↔ post from-output 합류**가 새 결정 표면.

live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI 실행·DB·LAN gate) 복제 0·non-gated 항상 실행 — 순수 build-time in-memory 검증만.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — pre-execution descriptor 합성 컴포저. L73-76 `interface RealDataResultIssueRunRef {gitSha, dateToken}`. L85-89 `interface RealDataResultIssueDescriptor {title, marker, body}`. L94-96 `runToken(run)` = `${run.dateToken}@${run.gitSha}`. L118 `buildRealDataResultIssueDescriptor(summary, run)` — title(`prefix + token`)·marker(`prefix + token + -->`) 합성, gitSha/dateToken 빈/공백 → `assertNonBlank` throw(L100). 본 task 의 pre boundary stage 1 source(run-identity token → title/marker 박제).
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — post-execution 단일-진입 컴포저(T-0596). L88-110 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` — 내부에서 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` 으로 outcome(issueNumber/url) 추출, (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` 로 report 합성(run.gitSha/dateToken 전파). 본 task 의 post boundary stage 2 source(run-identity 종단 전파).
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — post-execution 빌더. L102-153 `buildRealDataResultIssueOutcomeReport(outcome, run)` — report 의 `{issueNumber, url, gitSha, dateToken, summaryLine}` 중 gitSha/dateToken 을 run 으로부터 전파, summaryLine 안 `${dateToken}@${gitSha}` 류 run token 합성. `from-output` 의 두 번째 단 위임처 — 본 task 는 직접 호출 0(from-output 안에 위임).
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — post-execution 파서. L74-81 `interface RealDataResultIssueOutcome {issueNumber, url}`. `from-output` 의 첫 번째 단 위임처 — 본 task 는 직접 호출 0. execStdout(URL 한 줄) 합성 시 형식 참조용.
- `test/helpers/realdata-e2e-result-issue-summary.ts` 또는 `RealDataResultSummary` 정의 helper — descriptor 가 받는 `summary` 입력 shape(synthetic literal 합성용). descriptor 의 첫 인자.
- `test/smoke/realdata-e2e-resolve-outcome-report-from-output-issuenumber-3way-cross-boundary-convergence-assembly.smoke-spec.ts` (T-0767) — 직전 sibling 의 issueNumber 축 cross-boundary smoke. 패턴 참고(2 single-entry composer 동시-호출 구조) + 중복 회피 — 본 task 는 issueNumber 축 수렴 자체 재단언 금지(T-0767 cover), run-identity 축(gitSha·dateToken)만 새로 단언.
- `test/smoke/realdata-e2e-create-edit-output-outcome-report-assembly.smoke-spec.ts` (T-0747) — sibling from-output 단독 5필드 재유도 smoke. 중복 회피 — 본 task 는 from-output 의 url/issueNumber/summaryLine 재유도 재단언 금지(T-0747 cover), descriptor(pre boundary) 와의 run-identity cross-boundary 합류만.

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-descriptor-outcome-report-from-output-run-identity-cross-boundary-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path run-identity cross-boundary chain 합성**: 단일 run source(`run: RealDataResultIssueRunRef {gitSha, dateToken}` synthetic literal) + 유효 `summary: RealDataResultSummary`(synthetic literal) + 유효 `execStdout`(synthetic `https://github.com/owner/repo/issues/N` URL 한 줄, 임의 양수 N). 다음 2 single-entry composer 를 호출 — `descriptor = buildRealDataResultIssueDescriptor(summary, run)`, `outcomeReport = buildRealDataResultIssueOutcomeReportFromOutput(execStdout, run)`. 두 산출물이 모두 정상(descriptor: `{title, marker, body}` 비어있지 않음, outcomeReport: `{issueNumber, url, gitSha, dateToken, summaryLine}`) happy test 1+.
- [ ] **cross-boundary run-identity single-source 수렴(branch — 핵심 불변식)**: 단일 run source 로부터 도출된 gitSha·dateToken 이 pre-execution descriptor boundary 와 post-execution interpretation single-entry boundary 양쪽에서 byte-identical 일치함을 묶어 단언 1+ test — `expect(outcomeReport.gitSha).toBe(run.gitSha)` AND `expect(outcomeReport.dateToken).toBe(run.dateToken)`(post boundary 가 run 그대로 전파) AND `expect(descriptor.title).toContain(`${run.dateToken}@${run.gitSha}`)` AND `expect(descriptor.marker).toContain(`${run.dateToken}@${run.gitSha}`)`(pre boundary descriptor 안 run token 박제) AND `expect(descriptor.marker).toContain(`${outcomeReport.dateToken}@${outcomeReport.gitSha}`)`(pre descriptor marker ↔ post from-output run-identity 종단 cross-boundary closure). 즉 run(gitSha·dateToken) → descriptor.{title,marker} 박제 ↔ from-output.{gitSha,dateToken} 전파 가 **동일 run 식별 token single-source cross-boundary 수렴**(pre/post 경계 어느 쪽도 stale/swap drift 0).
- [ ] **summaryLine 매체 run-identity 일치(branch — summaryLine-mediated 수렴)**: 동일 run token 이 outcome-report 의 사람-친화 summaryLine 에도 박제됨을 단언 1+ test — `expect(outcomeReport.summaryLine).toContain(run.gitSha)` AND `expect(outcomeReport.summaryLine).toContain(run.dateToken)`(또는 helper 가 합성하는 실제 run token 형식에 맞춰). 즉 descriptor.title/marker / outcome-report.gitSha·dateToken / outcome-report.summaryLine 의 매체에 박힌 run 식별 token 이 동일.
- [ ] **run 분포 변별성(branch — 다른 run→다른 token, 같은 run→cross-boundary 수렴)**: 서로 다른 run 두 개(예: run_A `{gitSha:"abc1234", dateToken:"2026-06-21"}`, run_B `{gitSha:"def5678", dateToken:"2026-06-29"}`) → 각각 chain 호출(descriptor + from-output) → 두 chain 의 descriptor token / from-output.{gitSha,dateToken} 가 **각각 run_A·run_B 로 분리 수렴**(서로 다른 token, 단 각 chain 안에서 pre↔post 일치) 1+ test. "다른 run→다른 token, 같은 run→cross-boundary 수렴" 의 결정론적 변별 박제.
- [ ] **issueNumber 무관 — run-identity 수렴 격리(branch — partial-thread 격리)**: 동일 `run`(=동일 gitSha·dateToken) 을 고정하고 `execStdout` 의 URL **번호 N 만** 다르게(예: `/issues/11` vs `/issues/47`) 두 chain 호출 → 두 chain 의 `outcomeReport.gitSha` / `outcomeReport.dateToken` 가 **두 경우 동일**(issueNumber 변경이 run-identity 축에 누설 0 — 결정론 박제) AND descriptor token 도 두 경우 동일. 단 `outcomeReport.issueNumber` 는 두 경우 달라야 함(issueNumber leg 가 자기 영역에서는 정상 전파) 1+ test.
- [ ] **summary 무관 — run-identity 수렴 격리(branch — partial-thread 격리, 두 번째 축)**: 동일 `run` 을 고정하고 `summary`(descriptor 입력)의 분포 값만 다르게 두 chain 호출 → 두 chain 의 descriptor.title / descriptor.marker 가 **두 경우 동일 run token**(summary 변경이 run-identity token 에 누설 0 — REQ-009 "동일 run → 동일 marker·제목, summary 무관" 정합) 1+ test. 단 descriptor.body 는 두 경우 달라야 함(body 는 summary 본문 반영 — run leg 와 무관히 정상).
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(pre/post boundary 양쪽의 run-identity 거부 대칭 박제):
  - `run.gitSha` 빈/공백(`run = {gitSha:"", dateToken:"2026-06-29"}`) → descriptor(pre) 측 `assertNonBlank("gitSha")` throw(stage 1 비식별, pre boundary 차단).
  - `run.dateToken` 빈/공백 → descriptor(pre) 측 `assertNonBlank("dateToken")` throw 대칭(stage 1 비식별).
  - `run.gitSha` 빈/공백 → from-output(post) 측 (2) builder 위임 `assertNonBlank` throw(stage 2 builder 비식별 — execStdout URL 이 정상이어도 post boundary 종단 실패, pre/post 대칭 거부).
  - `run.dateToken` 빈/공백 → from-output(post) 측 (2) builder throw 대칭.
  - `execStdout` 에 URL 미발견(빈 문자열·무관 텍스트) → from-output 의 (1) parse 위임 throw(stage 2 미산출 — run 자체가 정상이어도 outcome 추출 실패로 from-output 차단).
  - `execStdout` URL 안 issueNumber 비양수(`/issues/0` 또는 `/issues/abc`) → from-output 의 (1) parse 위임 `assertPositiveIssueNumber` throw(stage 2 비식별).
- [ ] **결정론·무공유·no-mutation**: 동일 (summary, run, execStdout) 입력으로 chain 두 번 호출 → descriptor/outcomeReport 가 두 번 byte-identical deep-equal 1+ test. AND 입력 객체(summary, run) 가 chain 호출 후 mutate 0(원본 deep-equal 유지) 1+ test. AND 두 산출물이 입력 객체와 referential identity 분리(`not.toBe`) — 무공유 박제(매 호출 새 객체).
- [ ] **credential 누출 0**: chain 안 어디에서도 GH_TOKEN/PAT/Bearer/Authorization/x-access-token/x-github-token 토큰이 descriptor.title / descriptor.marker / descriptor.body / outcomeReport.url / outcomeReport.summaryLine 어느 문자열에도 등장하지 않음을 정규식 단언 1+ test(R-59 / REQ-059 raw 미저장 정합).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). test-only 신규 spec 1파일이라 helper 측 src 변경 0 — 본 spec 추가가 helper coverage 를 떨어뜨리지 않음을 확인.
- [ ] **lint+build green**: `pnpm lint`, `pnpm build` 통과. 본 신규 spec 의 typing 이 helper 의 export type 과 정합.
- [ ] **non-gated 실행 확인**: `pnpm test:smoke -- --testPathPattern descriptor-outcome-report-from-output-run-identity` 가 DB/credential/LAN gate 없이 모든 it block 실행·전부 PASS.

## Out of Scope

- src 변경 0(`src/`, `prisma/`, `package.json`, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
- 실 gh CLI 호출 / `execFile('gh', argv)` 실행 / 실 issue 검색·박제(step④ live wiring — credential gate, deferred). 본 task 는 in-memory 합성 stdout 만.
- issueNumber 축 cross-boundary 수렴 자체 재단언 금지(T-0767 cover). 본 task 는 issueNumber leg 를 격리 입력(partial-thread)으로만 쓰고, run-identity(gitSha·dateToken) 축 cross-boundary 수렴만 새로 단언.
- from-output 단독 5필드(url/issueNumber/summaryLine 합성·url trim 정규화) 재유도 재단언 금지(T-0747 cover). 본 task 는 run-identity 축 cross-boundary 수렴만.
- descriptor.title/marker 의 run token self-consistency 자체 재단언 금지(T-0709 descriptor identity 가드 cover). 본 task 는 descriptor ↔ from-output 두 boundary 사이의 cross-boundary 합류만.
- descriptor.body 의 3블록 구조(marker→summaryLine→markdown) 무결성 재단언 금지(descriptor body 가드 cover). 본 task 는 body 의 run token 박제 여부만 부수 참조.
- marker 축 search-resolve roundtrip 재단언 금지(T-0758/T-0766 cover).
- DB 의존(prisma client·테스트 DB·migration) 0 — 본 spec 은 DB-free.
- live-LLM·실 fetch·실 collectForPerson 의존 0.
- 새 helper 모듈 신설 금지(`test/helpers/` 변경 0). 기존 helper 들(descriptor, outcome-report-from-output, outcome-report, output-parse, summary)의 export 를 그대로 import 만.
- gating / describe.skip / `if (process.env.REAL_E2E ...)` 분기 0 — non-gated 항상 실행.

## Suggested Sub-agents

`implementer → tester` (test-only, src 변경 0 이라 architect 불요. 기존 helper 들의 export 시그니처만 import 해 pre/post boundary 의 두 단일-진입 컴포저(descriptor + from-output)를 같은 smoke 안에서 single-source(summary + run + execStdout)로 동시-호출 하는 합성 smoke 작성. run token 형식은 descriptor helper 의 `runToken`(`${dateToken}@${gitSha}`) 및 outcome-report helper 의 summaryLine 합성 형식을 실제 export 시그니처로 확인해 단언 문자열 결정).

## Follow-ups

(없음 — sweep 안에서 자연 후속이 더 있으면 다음 turn 의 planner 가 박제)
