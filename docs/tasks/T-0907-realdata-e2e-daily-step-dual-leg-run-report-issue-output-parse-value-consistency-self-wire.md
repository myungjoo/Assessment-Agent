---
id: T-0907
title: dual-leg run report 이슈 output-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선 (parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-output-consistency-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts
plannerNote: "P5 §109 step④ — T-0906 신설 output-parse 값-정합 가드의 컴포저 self-wire (summary 축 T-0724 mirror). set-equality self-wire(T-0905) 다음·return outcome 직전 assertOutputConsistentWithStdout(outcome, stdout) 1줄. type-only import 라 순환 0·top-level import. 가드 신설→self-wire 2-slice 후반."
---

# T-0907 — dual-leg run report 이슈 output-parse 산출↔stdout 값-정합 가드 컴포저 self-wire 배선

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ dual-leg run report 축 build-time consistency-guard sweep 의 값-정합 짝 닫기 task 다. 직전 T-0906(PR #800, squash 2468effd)이 컴포저 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts`)의 **값-정합 가드** `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout)`(stdout 만으로 expected `{issueNumber, url}` 을 컴포저 재호출 없이 독립 재유도해 deep-equal 대조 — issueNumber/url 값 drift·잘못된 첫 매칭 URL 선택·trim 누락 fail-fast)를 **신설만** 했다. 그러나 컴포저 자신의 단일 return 사이트는 아직 **outcome 키 집합 set-equality 가드**(`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape`, T-0904/T-0905)만 self-wire 하고 있어, 본 신설 값-정합 가드는 spec 에서만 호출되고 컴포저 산출 경로에는 미배선이다(origin/main grep 0 부재 확인). set-equality 가드는 outcome 의 **키 집합**만 보므로 issueNumber/url **값** drift·잘못된 첫 매칭 URL 선택·trim 누락을 놓친다 — 그 gap 을 본 self-wire 가 컴포저 산출 경로에서 build-time fail-fast 로 닫는다.

이는 summary 축 선례 **T-0724**(`parseRealDataResultIssueCreateEditOutput` 의 값-정합 가드 self-wire, T-0723 신설 가드의 컴포저 배선)의 정확한 dual-leg 축 mirror 이며, dual-leg 축 output-parse 값-가드의 "가드 신설(T-0906) → self-wire(T-0907)" 2-slice 패턴 후반이다(summary 축 T-0723→T-0724, search-parse T-0721→T-0722 분리 패턴 동형). REQ-032(이슈 표면 정합·raw 미저장) + REQ-059(입력 외 데이터 생성 0) 가드층을 마저 닫는다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 배선이라 cloud cron 에서 자율 실행 가능하다.

**self-wire 가능성 판정**: 가드 시그니처는 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout)` 로 **두 인자**(산출 `outcome` + raw `stdout`)를 받는다. 컴포저 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` 의 단일 return 사이트(origin/main L148 `return outcome;`)에서 `stdout` 은 파라미터로, `outcome` 은 이미 `const outcome: RealDataDailyStepDualLegRunReportIssueOutcome = {...}`(L134~) 로 묶여 있어 **둘 다 가용**하다. 현 코드는 이미 `const outcome = {...}` → set-equality 가드 self-wire(L143~146) → `return outcome;`(L148) 구조라, 그 set-equality 가드 호출 **다음**·`return outcome;` **직전**에 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout);` 한 줄을 추가하면 된다(outcome 변수 재구성 불요 — T-0724 와 동형).

**순환 의존 없음(top-level import)**: 값-정합 가드 `realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.ts`(T-0906) 는 `RealDataDailyStepDualLegRunReportIssueOutcome` 를 `import type` only 로만 가져오고(origin/main L50 확인) 컴포저로부터 **value 를 import 하지 않는다**. 따라서 컴포저가 본 가드를 **top-level `import`** 해도 CommonJS 순환 의존이 생기지 않는다(T-0724/T-0722/T-0905 set-equality self-wire mirror — lazy require 불요).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — self-wire 대상 컴포저 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout): RealDataDailyStepDualLegRunReportIssueOutcome`. **단일 return 사이트**(L148 `return outcome;`, 직전 L143~146 에 이미 set-equality 가드 `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS)` self-wire 가 있음). self-wire 는 그 set-equality 가드 호출 **다음**·`return outcome;` **직전**에 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout);` 한 줄 추가. 산출 객체 값·shape·결정성 byte-identical 무변경. 파일 상단(L67~70 set-equality 가드 top-level import 블록 인근)에 값-정합 가드 top-level import 1 줄 추가. 기존 set-equality self-wire 는 **유지**(대체·삭제 금지 — outcome shape 가드와 전체 값 가드 공존).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.ts`(T-0906 산출물, main 박제) — self-wire 할 가드. `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout): void`(L168, 정상 시 void / 구조 결손 TypeError / 값 정합 위반 RangeError). `RealDataDailyStepDualLegRunReportIssueOutcome` 를 `import type` only 로 가져오고(L50) 컴포저 value import 0(순환 의존 0 근거). 본 task 는 이 파일을 **변경하지 않는다**(호출만 추가).
- `docs/tasks/T-0724-realdata-e2e-result-issue-output-parse-value-consistency-self-wire.md` + `test/helpers/realdata-e2e-result-issue-output-parse.ts`(T-0724 self-wire 완료본) + 그 spec — **summary 축 동형 self-wire mirror**. type-only import 라 top-level import + 단일 return 직전 self-assert 패턴(lazy require 불요)·jest.spyOn 검증(호출 1회·인자 순서 `(outcome, stdout)`·throw 선전파·산출 byte-identical) 구성을 그대로 따른다. 검증 대상만 summary→dual-leg 로 바꾼 mirror.
- `docs/tasks/T-0905-...-self-wire.md`(직전 sibling) — 같은 컴포저에 set-equality 가드를 self-wire 한 dual-leg 축 선례. spec describe append 위치·byte-identical 보존 룰 참고. 본 값-가드 self-wire 는 그 set-equality self-wire 를 유지한 채 한 줄 더 추가.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 단일 return 사이트 직전(기존 set-equality 가드 호출 다음)에 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout)` self-assert 를 배선한다(top-level type-only-driven import — 순환 의존 0, lazy require 불요). 산출 객체의 값·shape·결정성 byte-identical 무변경(검증 호출만 추가). `src/` 변경 0(test-only), `schema.prisma` 변경 0, 가드 본체(`...output-parse-consistency.ts`) 변경 0.

- [ ] `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` 상단(기존 set-equality 가드 import 블록 인근)에 `import { assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency";`(top-level value import — 가드가 컴포저를 type-only 로만 import 하므로 순환 0) 추가.
- [ ] `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 의 `return outcome;`(L148) 직전, 기존 `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(...)` 호출 **다음**에 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout);` self-assert 추가. 산출 `outcome` 객체 값·참조-무공유(매 호출 새 객체) 무변경. 인자 순서 `(outcome, stdout)` 준수(가드 시그니처와 동일).
- [ ] 컴포저의 산출은 **byte-identical 불변**(가드는 outcome·stdout 을 읽기·재유도·비교만). 기존 set-equality self-wire(`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape`)는 **유지**(대체·삭제 금지) — outcome shape 가드와 전체 값 가드 둘 다 호출.
- [ ] 가드 본체(`...output-parse-consistency.ts`)와 `src/` 는 **무변경**(test-only self-wire).
- [ ] **Happy-path unit test 1+**(`...output-parse.spec.ts` self-wire describe) — `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` 가 정상 stdout(단일 URL 라인·다중 줄 첫 매칭·trailing 개행/공백 trim)에 대해 throw 0 으로 기존과 동일한 `{issueNumber, url}` 을 반환(self-wire 후 무회귀, byte-identical). self-wire 호출이 가드를 정확히 산출 outcome + 원본 stdout 으로 1 회 호출함을 `jest.spyOn`(가드 모듈)으로 검증 — 호출 횟수 1·첫 인자가 반환될 outcome 과 동일 참조·둘째 인자가 입력 stdout 과 동일·인자 순서 `(outcome, stdout)`.
- [ ] **Error path unit test 1+** — 가드 모듈을 spy 로 mock 해 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout` 가 RangeError(값 정합 위반) 또는 TypeError(구조 결손)를 throw 하도록 강제하면 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout)` 호출이 그 에러를 **그대로 선전파**(self-assert 가 삼키지 않음)함을 검증. RangeError 분기·TypeError 분기 각 1+.
- [ ] **Flow / branch cover** — 정상(void → return outcome) 경로 1+ test. self-wire 추가는 분기 0(단일 return 사이트 직전 1 호출). 가드 throw 선전파(error 흐름)와 정상 흐름 두 경로 cover. 기존 컴포저 분기(URL 미발견 throw·issueNumber 비양정수 throw)는 self-wire 도달 전 단계라 self-wire 가 그 분기 동작을 바꾸지 않음을 무회귀로 확인.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(분기·예외 상황마다): (a) 가드 throw 선전파 RangeError·TypeError 각 1+, (b) 기존 컴포저 자체 throw 경로(URL 미발견 stdout·`/issues/0`·선행 0·`/issues/abc`·`/pull/` 경로·비-github 호스트)가 self-wire 도달 **전**에 throw 돼 값-정합 가드를 거치지 않음(spy 0 회 호출)을 1+ test 로 확인(self-wire 가 기존 fail-fast 를 가리지 않음), (c) 정상 outcome 에 대해 가드 throw 0, (d) 입력 stdout 비변형(순수성 보존) test 1+, (e) 동일 stdout 두 번 호출 시 산출 deep-equal·참조-무공유(매 호출 새 객체)·spy 2 회 호출(결정론) — 각 1+ test.
- [ ] **R-59 / REQ-059 정합** — self-wire 후에도 파서는 issueNumber/url 만 산출하고 이슈 본문/narrative/credential 을 보유·노출하지 않는다(가드는 issueNumber·url 값만 다룸 — T-0906 가드 본체 보장 그대로).
- [ ] **build-time 완결·dependency-free** — 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 새 외부 라이브러리(zod/execa 등) 0. import 는 값 import(가드)이며 `process.env` 읽기 0. import 추가로 인한 runtime cycle 0(값 import 이므로 import graph 가 cycle 을 만들지 않는지 tsc green 으로 확인).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts` 에 describe **append**(신규 spec 파일 신설 금지, 기존 colocated 에 추가). `describe`/`it` 문자열 한국어로 self-wire 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안 인라인 구성).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80% — 변경한 `output-parse.ts` line/branch/function 100% 유지 목표). 전체 unit suite green(기존 output-parse spec·consistency spec 무회귀).

## Out of Scope

- 가드 본체(`...output-parse-consistency.ts`) 수정 0(read 만 — self-wire 는 호출만 추가). 가드 함수 시그니처·로직·에러 메시지 변경 금지.
- 컴포저 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 의 파싱·검증 규약(`ISSUE_URL_PATTERN` 첫 매칭·`assertPositiveIssueNumber`·URL trim·`{issueNumber, url}` 정규화) 수정 금지. self-wire 는 산출을 검증만 하고 값을 바꾸지 않는다(byte-identical 보존).
- 기존 set-equality self-wire(`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape`, T-0904/T-0905) 제거/대체 금지(outcome shape 가드와 전체 값 가드 공존).
- top-level import 대신 lazy require 사용 금지 — 가드가 type-only import only 라 순환 0, top-level import 가 정답(T-0724/T-0722/T-0905 mirror).
- 실 gh issue create/edit 호출 / `execFile('gh', argv)` / live wiring(step ④ credential gate, deferred).
- `deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- 다른 realdata-e2e seam(search-hit/descriptor/command-args/gh-argv/command-plan/search-parse/outcome-parse-shape)의 추가 가드 또는 self-wire — 본 task 는 output-parse 값-정합 가드 self-wire 단일.
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, type-only import 라 순환 의존 0·lazy require 불요, T-0724/T-0905 self-wire mirror 라 architect 불요).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. output-parse 값-가드 짝(T-0906 신설 + 본 self-wire) 닫힘 후, 잔여 dual-leg run report seam 의 값-정합 가드 적용 여부는 다음 planner 가 case-by-case 판정 후 별도 task.)

## Result

**Status: DONE** (2026-07-11T03:22Z, PR #801 squash 9713a211, reviewer round 1/7 APPROVE, 4-게이트 PASS, CI green). 컴포저 단일 return 직전(set-equality self-wire 다음)에 값-정합 가드 `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout)` 를 top-level value import + 1호출로 배선(+232/-4 test-only 2 files). 산출 byte-identical 무변경, 가드 본체/src 무변경. all files line 99.95%·func 100%·branch 99.25%, full suite 373 suites·9759 tests green. dual-leg output-parse 값-가드 "신설(T-0906)→self-wire(T-0907)" 2-slice 마감. 다음 nextTask=T-0908(search-parse 값-정합 가드 신설, summary 축 T-0721 mirror).
