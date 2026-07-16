---
id: T-1044
title: result-issue outcome-report-from-output 컴포저 본문 위임 순서(parse → build)를 invocationCallOrder 순서-lock test 로 못박기 (daily from-output canonical 요약축 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 62
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts
independentStream: realdata-e2e-result-issue-outcome-report-from-output
plannerNote: "P5 test-hardening — guard order-lock sweep(T-1033~T-1043, 6 result/daily 축 + result-summary 2 축) 완료 후 daily/summary 비대칭 감사에서 from-output 컴포저 delegate order-lock gap 발견. daily leg 는 컴포저 본문 위임 순서(parse→build)를 invocationCallOrder 로 lock(daily spec L122~151) 하나 summary mirror 부재(spec invocationCallOrder grep 0). summary 컴포저 L93 parse→L97 build→L103 guard. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1044 — result-issue outcome-report-from-output 컴포저 본문 위임 순서(parse → build) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-wire 하는 2+ distinct 호출의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. result-issue / daily-issue 6 축(command-args·descriptor·outcome-report·output-parse·search-parse·search-argv, T-1033~T-1041)과 result-summary 패밀리 2 축(result-summary-line T-1042, result-report-plan T-1043)이 모두 두 self-assert 가드의 상대 순서를 못박아 완료됐다.

본 task 는 그 sweep 을 **from-output 컴포저의 "위임(delegate) 순서" 축으로 확장**하되, daily/summary 두 leg 사이의 **비대칭을 해소**한다. `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)` 컴포저는 본문에서 두 위임을 순서대로 호출한다 — L93 `const outcome = parseRealDataResultIssueCreateEditOutput(stdout)`(파서 위임) → L97 `const report = buildRealDataResultIssueOutcomeReport(outcome, run)`(빌더 위임) → L103 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)`(self-assert 가드) → L109 `return report`.

**daily leg 는 이 위임 순서(parse → build)를 이미 못박았다** — daily spec `realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts` L122~151 이 `parseSpy.mock.invocationCallOrder[0]` 이 `buildSpy.mock.invocationCallOrder[0]` 보다 작음(parse 먼저)을 `toBeLessThan` 으로 검증하고, 인자 전파(parse(stdout); build(parseReturn, run))까지 assert 한다. 그러나 **summary leg 의 mirror 는 부재**하다(`git grep invocationCallOrder realdata-e2e-result-issue-outcome-report-from-output.spec.ts` = 0건). 기존 T-0664 self-wire 블록(L311~)은 self-assert 가드가 `(stdout, run, 산출 report)` 인자·순서로 1회 호출됨과 산출물 byte-identical 만 assert 할 뿐, 컴포저 본문의 파서·빌더 위임 순서가 실수로 뒤바뀌어도(예: build 를 parse 앞으로 이동) 현행 test 는 통과한다. daily canonical 을 요약축으로 mirror 해 순서 부등식을 못박는다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts` — 본 task 가 수정할 유일 파일(466줄). 기존 describe 블록: happy-path(L45~)·flow/branch(L79~)·error path(L118~)·negative(L147~)·결정론(L245~)·**T-0664 outcome-report consistency 가드 composer self-wire 블록(L311~)**. 신규 delegate 순서-lock/fail-fast describe 블록을 T-0664 블록 끝(파일 최하단 top-level describe 닫힘 `});` 직전)에 append. ⚠️ **현재 named import** 만 있음 — `buildRealDataResultIssueOutcomeReport`(L19), `parseRealDataResultIssueCreateEditOutput`(L22). `jest.spyOn` 은 module namespace 객체를 요구하므로 daily 처럼 namespace import 를 추가해야 한다: `import * as outputParseModule from "./realdata-e2e-result-issue-output-parse"` + `import * as outcomeReportModule from "./realdata-e2e-result-issue-outcome-report"`(기존 named import 는 유지/공존 가능, 또는 namespace 로 통일). fixture `RUN`(L24)·`CREATE_STDOUT`(L30)·`makeRun`(L35) 재사용.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — 컴포저 위임 지점 확인용(수정 금지). `buildRealDataResultIssueOutcomeReportFromOutput` 함수: L93 `parseRealDataResultIssueCreateEditOutput(stdout)`(파서 위임, stdout 에 issue URL 없으면 여기서 throw — build 미도달) → L97 `buildRealDataResultIssueOutcomeReport(outcome, run)`(빌더 위임, run.gitSha/dateToken 빈/공백 시 여기서 throw) → L103 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)`(self-assert 가드) → L109 `return report`.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — self-assert 가드가 **재유도로 parse·build 를 다시 호출**함을 확인(L168~169 `buildRealDataResultIssueOutcomeReport(parseRealDataResultIssueCreateEditOutput(stdout), run)`). ⚠️ 따라서 T-0664 self-wire 이후 정상 경로에서 **각 위임은 정확히 2회 호출**된다 — (1) 컴포저 본문 1회 + (2) 가드 재유도 1회. 순서-lock 은 첫 호출(`invocationCallOrder[0]`)로 판정(daily 동형).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-report-from-output.spec.ts` (daily canonical, L122~151) — mirror 원본. `parseSpy`/`buildSpy` 를 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 `parseSpy.mock.invocationCallOrder[0]` 이 `buildSpy.mock.invocationCallOrder[0]` 보다 작음을 `toBeLessThan` 으로 검증 + `toHaveBeenCalledTimes(2)` 각 + 인자 전파(parse(stdout); build(parseReturn, report)) 구조를 요약축 심볼명(run 인자)으로 동형 적용.

## Acceptance Criteria

- [ ] **위임 순서-lock test 추가 (happy-path/flow)**: T-0664 self-wire describe 블록 끝에 컴포저 본문 위임 순서를 못박는 test 1개 추가 — 파서 위임(`parseRealDataResultIssueCreateEditOutput` = `outputParseModule`)과 빌더 위임(`buildRealDataResultIssueOutcomeReport` = `outcomeReportModule`)을 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 `buildRealDataResultIssueOutcomeReportFromOutput(CREATE_STDOUT, RUN)` 을 1회 호출한 뒤 `parseSpy.mock.invocationCallOrder[0]` 이 `buildSpy.mock.invocationCallOrder[0]` 보다 **작음(parse 먼저)** 을 `toBeLessThan` 부등식으로 검증. 추가로 self-wire 재유도 포함 `parseSpy`·`buildSpy` 각 `toHaveBeenCalledTimes(2)`(daily 동형) + 인자 전파(`parseSpy` 는 `CREATE_STDOUT` 로 호출, `buildSpy` 첫 인자 = parse 반환 outcome·둘째 = 입력 `RUN`)를 assert.
- [ ] **fail-fast test 추가 (error path/negative)**: 파서 위임이 throw 하면(issue URL 없는 stdout — 예: `"URL 없음"`) 빌더 위임이 **호출되지 않음(`buildSpy` 0회)** 을 검증하는 test 1개 추가 — 파서 throw 를 실제 유발(또는 mock throw)하고, `buildRealDataResultIssueOutcomeReportFromOutput` 호출이 그 에러를 선전파(fail-fast)하며 `buildSpy` 가 `toHaveBeenCalledTimes(0)` 임을 assert(parse-먼저 순서로 인해 build 도달 불가를 못박음).
- [ ] **branch/negative 보강**: 빌더-하위 guard 우선 분기 — `run.gitSha` 빈/공백 `run` 으로 빌더 위임(`buildRealDataResultIssueOutcomeReport`) 내부 guard 가 throw 하는 경우에도 **파서 위임은 그 전에 이미 1회 호출됨(`parseSpy.mock.invocationCallOrder[0]` 존재, 즉 `parseSpy` 호출됨)** 을 검증하는 test 1개 추가(parse → build 순서가 build 단계 실패 시에도 보존됨을 못박음). 추가로 순서-lock test 는 실 구현 pass-through spy 이므로 산출 report 가 순서-검증 전후 deep-equal(byte-identical·무공유)임을 함께 재확인(production 무변경 회귀 0). 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts`·`-consistency.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts` 가 1건 이상(이전 0건) — 위임 순서-lock 실배선 확인.

## Out of Scope

- 컴포저 `.ts` 의 위임 호출 순서 **재정렬 / 정규화** — 현행 순서(parse → build)를 lock 만 하고 바꾸지 않는다.
- 파서(`parseRealDataResultIssueCreateEditOutput`)·빌더(`buildRealDataResultIssueOutcomeReport`)·consistency 가드 로직·인자 순서·에러 정책 변경.
- daily from-output leg spec 변경(이미 delegate 순서-lock 보유 — 본 task 는 요약축 mirror 만).
- 다른 result-issue/daily 축(모두 guard 순서-lock 완료)이나 self-assert 가드의 상대 순서 재검증.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (감사 결과) from-output 컴포저의 delegate 순서-lock 이 daily(기존)·summary(본 task) 두 leg 모두 완료되면 from-output 축 종료. 이후 planner 는 신규 인벤토리 감사로 daily/summary 비대칭이 남은 다른 컴포저(delegate 순서-lock 또는 guard 순서-lock 부재 leg)를 지목.
