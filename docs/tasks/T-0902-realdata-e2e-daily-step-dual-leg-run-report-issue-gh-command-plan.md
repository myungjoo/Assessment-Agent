---
id: T-0902
title: realdata-e2e daily-step dual-leg run report 이슈 search stdout + commandArgs → gh 실행 plan 순수 컴포저 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 185
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts
plannerNote: "P5 §109 step④ — T-0901 search-parse 다음 자연 경계(build-time chain 종단 컴포저, T-0588 mirror). parse(T-0901)→resolve(T-0898)→gh argv(T-0899) 3단계를 단일 순수 함수로 합성, 실 execFile 만 남김. test-only pr 2파일 dep0 stage5b 병렬 후보."
---

# T-0902 — realdata-e2e daily-step dual-leg run report 이슈 search stdout + commandArgs → gh 실행 plan 순수 컴포저 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 는 `deploy/daily-test.sh` 가 nightly 로 **eval leg** + **collect leg** 두 jest run 을 spawn 한 뒤 그 **결과를 daily-test result/rolling 이슈에 멱등 박제**(create-or-update)하라 지시한다. 박제 직전 build-time chain 의 **종단 컴포저** 를 박제한다.

dual-leg run report 축의 단위 layer 는 이미 (1) 컴포저(T-0894) → (2) 마크다운 렌더러(T-0895) → (3) rolling-issue descriptor(T-0896) → (4) 명령-args `...IssueCommandArgs`{searchQuery, createArgs, updateArgs}(T-0897) → (5) create-or-update action resolver(T-0898) → (6) action+명령-args → `gh issue create/edit` 인자-벡터 빌더(T-0899) → (7) `gh search issues` 인자-벡터 빌더(T-0900) → (8) search stdout → `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 파서(T-0901)까지 순수 함수로 닫혔다. 그러나 caller(live wiring)가 이들을 정확한 순서로 엮는 책임은 여전히 여러 helper 호출로 흩어져 있다 — caller 가 (8) `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` → (5) `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, marker)` → (6) `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs)` 를 손으로 연결해야 한다.

본 task 는 이 **3-단계 합성을 단일 순수 함수 `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs)` 로 박제** 해, build-time chain 을 종단까지 닫는다. 이는 summary 축의 선례 **T-0588**(`resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs): {action, argv}`)과 정확히 동형이며, 그 dual-leg 축 mirror 다.

이로써 live wiring chain 은 (1) search argv(T-0900) → (2) `execFile('gh', searchArgv)`(deferred, credential gate) → (3~5) **search stdout + commandArgs → gh 실행 argv(본 컴포저)** → (6) `execFile('gh', argv)`(deferred) 로 줄어든다. 순수 함수 layer 가 모두 한 진입점으로 합성되고, 남는 외부 경계는 (2)·(6) 두 `execFile` 뿐이다 — LAN/credential gate(ADR-0045)로 deferred 유지. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 컴포저라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0588-realdata-e2e-result-issue-gh-command-plan.md` — summary 축의 동형 선례(컴포저 동작·3단계 위임 규약·throw 전파·R-112 cover 구조·Out of Scope 표기). 본 task 는 그 dual-leg 축 mirror.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.ts` line 111~ — `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout): RealDataDailyStepDualLegRunReportIssueSearchHit[]`(본 컴포저의 1단계 위임 대상, T-0901 결과물).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-action.ts` line 72~135 — `RealDataDailyStepDualLegRunReportIssueSearchHit`, `RealDataDailyStepDualLegRunReportIssueAction`(discriminated union: `{action:'create'}` | `{action:'update', issueNumber}`), `resolveRealDataDailyStepDualLegRunReportIssueAction(searchHits, marker)`(2단계 위임 대상, T-0898 결과물).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts` line 104~ — `RealDataDailyStepDualLegRunReportIssueCommandArgs`({searchQuery, createArgs, updateArgs}) 구조. `marker` 는 별도 입력이 아니라 `commandArgs.searchQuery`(= descriptor.marker)를 그대로 resolver 의 marker 로 전달한다(재합성 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-argv.ts` line 111~ — `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs): string[]`(3단계 위임 대상, T-0899 결과물).
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제" + raw 미저장(R-59) 명시.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] 신규 파일 2개만 추가: `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.ts`(순수 컴포저) + colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts`. production `src/`·T-0894~T-0901 helper·summary-축 helper 수정 0.
- [ ] **컴포저 신설** — `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout: string, commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs): { action: RealDataDailyStepDualLegRunReportIssueAction; argv: string[] }` 순수 함수. enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
- [ ] **타입 재사용(중복 정의 0)** — `RealDataDailyStepDualLegRunReportIssueCommandArgs`·`RealDataDailyStepDualLegRunReportIssueAction`(및 필요 시 `...SearchHit`)은 기존 helper 에서 `import type` 재사용. 신규 type 정의 없음.
- [ ] **동작 정합(3단계 위임)** — (1) `parseRealDataDailyStepDualLegRunReportIssueSearchOutput(stdout)` 로 `RealDataDailyStepDualLegRunReportIssueSearchHit[]` 산출 → (2) `resolveRealDataDailyStepDualLegRunReportIssueAction(hits, commandArgs.searchQuery)` 로 action 결정 → (3) `buildRealDataDailyStepDualLegRunReportIssueGhArgv(action, commandArgs)` 로 argv 합성. 반환은 `{action, argv}`(caller 가 action 종류 로깅·argv 실행 모두 가능). marker 는 `commandArgs.searchQuery` 를 그대로 전달(별도 marker 인자 없음 — 재합성 0).
- [ ] **위임 throw 전파(자체 try/catch 로 삼키지 않음)** — 잘못된 stdout(비JSON/비배열/원소 type 불일치/number 비양수) → 파서 throw 전파, 빈/공백 searchQuery → resolver throw 전파, create/update title·body 빈/공백 → argv 빌더 throw 전파.
- [ ] **결정론·무공유** — 동일 `(stdout, commandArgs)` 두 번 호출 → byte-identical 결과(deep equal). 입력 `commandArgs`(중첩 createArgs.labels 포함) mutate 0, 매 호출 새 `{action, argv}` 객체·새 argv 배열 반환(위임 helper 들이 이미 무공유 — 본 컴포저도 입력 보존).
- [ ] **Happy-path unit test 1+** — (a) 후보 0건 stdout(`"[]"`) → `{action:{action:'create'}, argv: gh issue create ...}` 검증(argv 에 `--title`/`--body`/`--label` 포함), (b) marker 포함 후보 1건 stdout → `{action:{action:'update', issueNumber:N}, argv: gh issue edit String(N) ...}` 검증, (c) 후보 2+ 건 → 최소 number update 로 합성됨 검증(T-0898 멱등 회귀 보호가 컴포저 경유에서도 보존).
- [ ] **Error path unit test 1+** — (a) 잘못된 JSON stdout(`"not json"`) → 파서 throw 전파, (b) 빈/공백 `searchQuery` → resolver throw 전파, (c) create 분기에서 createArgs.title 빈/공백 → argv 빌더 throw 전파 — 각 별도 case(어느 layer 의 throw 인지 분리 검증).
- [ ] **Flow / branch cover** — create 분기(후보 0건) + update 분기(후보 1+건) 각 1+ test. 각 위임 helper throw 전파 분기도 cover. 분기마다 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지(분기마다): (a) stdout 이 비배열 JSON object, (b) hit number 0/음수/비정수, (c) searchQuery 공백-only, (d) update 분기 updateArgs.body 빈/공백 같은 빌더 guard → 각 1+ throw 검증(위임 helper 의 guard 가 컴포저 경유에서도 전파됨 확인).
- [ ] **R-59 정합** — 컴포저는 입력 외 데이터를 생성·저장하지 않는다(위임 helper 들이 이미 raw narrative 미보유 — 본 컴포저도 hits 의 body 를 분기 판정에만 쓰고 반환 argv 에 descriptor.body(=marker 라인 포함)만 전달, 추가 활동 본문 0). 헤더 주석에 R-59 정합 + step ④ 박제 chain 의 종단(gh command plan) 컴포저 + "실 `execFile('gh', ...)` 은 deferred(본 컴포저는 stdout + commandArgs → 실행할 argv 산출까지만)" 명시.
- [ ] **build-time 완결·dependency-free** — 실 gh 실행(`execFile('gh', ...)`/`gh search issues`/`gh issue create/edit`) / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 외부 라이브러리 0. 단위 layer import 재사용 + 합성만. `process.env` 읽기 0.
- [ ] **새 외부 dependency 0** — 신규 import 는 기존 dual-leg helper 의 `import type` + 함수 import 만. execa/zod 등 도입 금지.
- [ ] **lint+build+unit green**: `pnpm lint && pnpm build && pnpm test` 통과(신규 colocated spec 격리 실행 green).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 컴포저 파일 branch/func/line 100% 목표(single-helper 라 100% 기대).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan.spec.ts`(T-0901 search-parse spec·summary-축 T-0588 gh-command-plan spec 과 동일 디렉토리·convention). `describe`/`it` 문자열 한국어로 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안에 인라인 구성).

## Out of Scope

- **실 `execFile('gh', argv)` 실행** — search 든 create/edit 든(step ④ live wiring, credential gate, deferred). 본 컴포저는 stdout(이미 받은) + commandArgs → 실행할 argv 산출까지만.
- **단위 layer 자체 재구현** — parse(T-0901) / resolve(T-0898) / gh argv(T-0899) 는 import 재사용만, 로직 복제 0.
- **search argv 합성(T-0900 위임 — 본 컴포저는 search 결과 stdout 을 받는 시점부터).**
- **descriptor → command-args 합성(T-0897 위임 — 본 컴포저 입력은 이미 합성된 commandArgs).**
- **`RealDataDailyStepDualLegRunReportIssueCommandArgs`/`...IssueAction`/`...IssueSearchHit` type 신규 정의(import 재사용 — 중복 금지).**
- **T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor / T-0897 명령-args / T-0898 action / T-0899 gh argv / T-0900 search argv / T-0901 search parse 수정·재계산** — 이미 확정.
- **summary 축(T-0580~T-0590) / 단일 issue-post outcome-report 수정** — 재구현/재호출 0. 본 task 는 dual-leg 축의 종단 gh command plan 컴포저 신설만.
- **`deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).**
- **production `src/` 코드 / `package.json` / `test/jest-smoke.json` / schema / migration / 새 dependency / auth 변경** — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

## Result (DONE — 2026-07-11T00:42Z)

- PR #796 squash 머지(`bc27c0d0`), reviewer APPROVE round 1/7(0 BLOCKER·0 MAJOR·0 MINOR), 4-게이트 PASS, branch delete.
- 신규 2파일(test-only, +408/-0): `resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(stdout, commandArgs): {action, argv}` 순수 컴포저 + colocated R-112 spec(21 case). parse(T-0901)→resolveAction(T-0898)→buildGhArgv(T-0899) 3단계 위임 합성, 타입 import type 재사용(신규 정의 0), marker=commandArgs.searchQuery. 실 execFile deferred.
- 신규 파일 stmt/branch/func/line 100% cov, lint/build/full(370 suites/9658 tests) green, dep0.
- diff 408>300 cap 은 test-dominated(code ~89 LOC) 로 reviewer 가 justified 분류(형제 T-0899/T-0900/T-0901 동형). 이로써 dual-leg run report build-time chain 이 종단까지 닫힘 — 남는 외부 경계는 search/exec 두 execFile 뿐(LAN/credential gate deferred).
- cron@aa-local-06da fire, fineGrainedConcurrency ON stage 5b claim-pickup.
