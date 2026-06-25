---
id: T-0664
title: outcome-report composer 산출 직전 outcome-report consistency 가드 self-wire 배선 (buildRealDataResultIssueOutcomeReportFromOutput)
phase: P5
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
status: PENDING
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts
plannerNote: P5 PLAN 109행 step④ realdata-e2e stream — T-0663 신설 outcome-report consistency 가드를 컴포저 반환 직전 self-wire (T-0662 producer self-wire mirror)
---

# T-0664 — outcome-report composer 산출 직전 consistency 가드 self-wire 배선

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(daily-test `step_eval` 결과 이슈 표면) build-time 정합 가드 사슬의 연속 slice. 직전 T-0663 이 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)` 순수 가드를 **신설만** 했고, 컴포저 `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(T-0596) 의 산출 경로에는 아직 배선되지 않았다 (T-0663 Out of Scope + Follow-up ①). 본 task 는 그 가드를 **컴포저가 report 를 반환하기 직전 self-assert** 배선해, 컴포저가 두 위임 layer(parser T-0589 → builder T-0590) 사이에 끼어 결과를 변형/누락하는 합성 회귀를 호출 시점에 fail-fast 로 차단한다 (T-0662 `assertRealDataResultIssueOutcomeMatchesParseShape` producer self-wire 의 composer-side mirror, T-0647 descriptor builder self-wire 와 동형). 정상 합성이면 가드는 void → 컴포저 동작·반환 byte-identical 보존, 회귀 시 컴포저가 손상 report 를 caller 에 넘기기 전에 throw.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — 배선 대상 컴포저. `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(L81~91)이 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` → outcome (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` → report 를 위임-체인으로 엮어 반환. 본 task 는 이 함수가 `return` 하기 직전에 산출 report 를 변수로 받아 self-assert 후 반환하도록 배선.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` — self-wire 할 가드. `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report): void`(L151~) 시그니처 확인 — 인자는 `(stdout, run, report)` 순서. 가드는 내부에서 single-source 재유도(parse→build)로 expected 를 산출해 report 5 필드 정합 검증. import 원천.
- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.spec.ts` — 컴포저 colocated spec. 본 task 는 self-wire 배선 검증 describe/it 를 append (spyOn 으로 가드가 (stdout, run, 산출 report) 인자로 정확히 1회 호출됨 검증 + 정상 합성이면 throw 0, 가드가 throw 하면 컴포저도 throw 전파).
- 패턴 선례: `docs/tasks/T-0662-realdata-result-outcome-parse-shape-self-wire.md` (T-0661 신설 가드의 producer self-wire — import 1줄 + 호출 1지점, 반환 직전 self-assert, byte-identical 보존). 본 task 는 그 composer-seam 동형.

## Acceptance Criteria

- [ ] `buildRealDataResultIssueOutcomeReportFromOutput` 가 `buildRealDataResultIssueOutcomeReport(outcome, run)` 의 산출물을 곧장 `return` 하던 것을, 산출 report 를 지역 변수로 받아 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)` 를 **반환 직전 1회 self-assert** 후 그 report 를 반환하도록 배선. import 1줄(consistency 가드) + 호출 1지점만 추가 — 컴포저 합성 순서·위임 호출·주석 본문 변경 0, 반환 report byte-identical 보존.
- [ ] **비변형 / 순수**: 배선으로 부수효과 0·새 외부 dependency 0·credential/env/네트워크 0. 가드는 read-only 검증이라 report mutate 0. 정상 합성이면 self-assert 가 void → 기존 동작과 관측 불가능하게 동일.
- [ ] **Happy-path unit test**: 정상 stdout(유효 issue URL 1건) + 정상 run 으로 컴포저 호출 시 throw 0(정상 report 반환). 산출 report 가 직전 가드를 통과함을 round-trip 으로 확인.
- [ ] **Error path unit test**: self-assert 가 throw 하는 경로 — 가드를 `jest.spyOn` 으로 throw 하도록 mock 했을 때 컴포저가 그 throw 를 삼키지 않고 caller 로 전파함 1+ test. 또한 위임 파서/빌더가 throw 하는 입력(예: stdout URL 미발견·run 식별자 빈)에서는 가드 진입 전에 위임 throw 가 전파됨 1+ test.
- [ ] **Flow / branch cover**: (a) 정상 합성 → 가드 통과 → report 반환 분기, (b) 가드 throw 전파 분기, (c) 위임(파서/빌더) throw 가 가드 진입 전 전파되는 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) 가드가 (stdout, run, 산출 report) 정확한 인자·순서·1회로 호출됨을 spyOn 으로 검증, (b) 가드 throw 시 컴포저 throw 전파, (c) 파서 throw 입력에서 가드 미호출(위임 단계에서 종료), (d) 빌더 throw 입력(run 식별자 빈/공백)에서 가드 미호출, (e) 동일 입력 두 번 호출 deterministic(같은 report·summaryLine byte-identical), (f) 입력 stdout/run 비변형(mutate 0) 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경 대상 컴포저 파일 `realdata-e2e-result-issue-outcome-report-from-output.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. consistency 가드 값 import 추가로 인한 runtime cycle 0 (tsc green 으로 확인 — 컴포저는 이미 동일 위임 함수들을 import 중, 가드도 같은 위임을 import 하므로 순환 위험 없음).

## Out of Scope

- `assertRealDataResultIssueOutcomeReportConsistentWithOutput` 가드 본문·위임 함수(`parseRealDataResultIssueCreateEditOutput`/`buildRealDataResultIssueOutcomeReport`) 본문 수정 — 본 task 는 self-wire 배선만, 가드·위임은 T-0663/T-0589/T-0590 산출물 그대로 사용.
- 컴포저 합성 로직·반환 형태 변경 — 반환 report 는 byte-identical 보존, 본 task 는 반환 직전 검증 호출 1지점만 추가.
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape)의 추가 가드 또는 self-wire — 본 task 는 outcome-report composer-seam consistency 가드 self-wire 1건만.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 배선만.
- production `src/` 코드 변경 — test helper 단독.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 본 self-wire 로 outcome-report composer-seam consistency chain(가드신설 T-0663 → producer self-wire T-0664)이 완결됨. 다음 후보: realdata-e2e build-time chain 의 잔여 seam 점검 또는 step④ live execFile wiring credential 게이트 진입 여부 PLAN 재검토.)
