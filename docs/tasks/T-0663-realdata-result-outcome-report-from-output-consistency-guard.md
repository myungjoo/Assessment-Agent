---
id: T-0663
title: outcome-report composer 산출 ↔ single-source 재유도 정합 순수 가드 신설 (buildRealDataResultIssueOutcomeReportFromOutput)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-25
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts
  - test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.spec.ts
plannerNote: P5 PLAN 109행 step④ realdata-e2e stream — outcome-report composer 산출↔parse→build single-source 재유도 byte-identical 정합 가드 신설 (T-0646 descriptor-body-consistency mirror, 가드신설만 self-wire deferred)
---

# T-0663 — outcome-report composer 산출 ↔ single-source 재유도 정합 순수 가드 신설

## Why

P5 PLAN.md 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(daily-test `step_eval` 결과 이슈 표면) build-time 정합 가드 사슬의 연속 slice. 직전 chain 은 parse-shape seam(search-hit T-0659/T-0660, outcome T-0661/T-0662)을 가드신설→producer self-wire 2-slice 로 닫았다. 그 한 단계 downstream 인 **post-실행 단일 진입 컴포저** `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run)`(T-0596)은 parser(T-0589) → report builder(T-0590) 2 단계 위임을 엮어 `RealDataResultIssueOutcomeReport` 를 반환하지만, 그 합성 결과가 single-source 재유도와 정합한지 검증하는 가드는 아직 없다. 본 task 는 **컴포저 산출 report 가 `buildRealDataResultIssueOutcomeReport(parseRealDataResultIssueCreateEditOutput(stdout), run)` single-source 재유도와 byte-identical 함**을 검증하는 순수 가드를 신설해, 컴포저가 두 위임 layer 사이에 끼어 결과를 변형하거나 누락하는 합성 회귀를 fail-fast 로 차단한다 (T-0646 `assertRealDataResultIssueDescriptorBodyConsistent` body-consistency 가드의 outcome-report composer-seam mirror — 가드신설만, builder self-wire 는 별도 후속 slice).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-outcome-report-from-output.ts` — 검증 대상 컴포저. `buildRealDataResultIssueOutcomeReportFromOutput(stdout, run): RealDataResultIssueOutcomeReport`(L81~91)이 (1) `parseRealDataResultIssueCreateEditOutput(stdout)` → outcome (2) `buildRealDataResultIssueOutcomeReport(outcome, run)` → report 를 위임-체인으로 엮어 반환. 본 가드가 재유도 single-source 로 호출할 두 위임 함수의 import 원천.
- `test/helpers/realdata-e2e-result-issue-outcome-report.ts` — `RealDataResultIssueOutcomeReport` interface(L49~55: `issueNumber/url/gitSha/dateToken/summaryLine`) + single-source builder `buildRealDataResultIssueOutcomeReport(outcome, run)`(L90~117). 재유도 기준. (summaryLine 합성식 L107 — `[${dateToken}@${gitSha}] 결과 이슈 #${issueNumber} 박제 → ${url}`.)
- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — `parseRealDataResultIssueCreateEditOutput(stdout): RealDataResultIssueOutcome`. 재유도 chain 의 첫 단계.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `RealDataResultIssueRunRef` type(run 식별자 `gitSha`/`dateToken`).
- 패턴 선례: `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts` 의 `assertRealDataResultIssueDescriptorBodyConsistent` (single-source 재유도 byte-identical 비교 + 구조 결손=TypeError / 값 정합 위반=RangeError 구분 fail-fast). 본 가드는 그 outcome-report composer-seam mirror — describe/throw 계약·메시지 포맷을 동형으로 따른다.
- 직전 가드신설 slice 선례: `docs/tasks/T-0661-realdata-result-outcome-parse-shape-guard.md` (가드신설만, self-wire deferred to Follow-up — 본 task 도 동일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` 에 순수 가드 `assertRealDataResultIssueOutcomeReportConsistentWithOutput(stdout, run, report)` 신설. 가드는 `buildRealDataResultIssueOutcomeReport(parseRealDataResultIssueCreateEditOutput(stdout), run)` 로 single-source 재유도한 expected report 를 산출하고, 인자 `report` 의 5 필드(`issueNumber`/`url`/`gitSha`/`dateToken`/`summaryLine`)가 expected 와 **각각 정합(byte-identical for string, ===  for number)** 함을 검증한다. 정합이면 void 반환, 위반 시 throw. (재유도 chain 의 URL 파싱·issueNumber 검증·summaryLine 합성 로직은 일절 재구현 금지 — 위임 호출만.)
- [ ] **에러 정책 — 구조 결손=TypeError / 값 정합 위반=RangeError 구분**: (a) `stdout` 비-string·`run`/`report` null/undefined·`report` 필드 type 위반 → 한국어 TypeError. (b) 재유도 expected 와 `report` 의 어느 필드라도 drift → 한국어 RangeError (메시지에 어느 필드가 expected vs actual 로 어긋났는지 포함). silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 필드에서 throw).
- [ ] **비변형 / 순수**: `stdout`(문자열·불변) / `run`(읽기만, mutate 0) / `report`(읽기·비교만). 부수효과 0·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0·env/네트워크/credential 0. 동일 입력 → 동일 동작(정합 report 면 항상 void, drift report 면 항상 동일 필드에서 throw).
- [ ] **Happy-path unit test**: 정상 stdout(유효 issue URL 1건) + 정상 run 으로 `buildRealDataResultIssueOutcomeReportFromOutput` 가 산출한 report 를 가드에 넘기면 throw 0(void). (컴포저 실제 산출물이 가드를 통과함을 round-trip 으로 확인.)
- [ ] **Error path unit test**: 각 필드(`issueNumber`/`url`/`gitSha`/`dateToken`/`summaryLine`)를 하나씩 변조한 손상 report 를 가드에 넘기면 RangeError throw — 필드별 1+ test. 메시지에 해당 필드명·expected·actual 노출 검증.
- [ ] **Flow / branch cover**: 구조 결손 분기(TypeError: `stdout` 비-string / `run` null / `report` null / `report` 필드 type 위반)와 값 정합 위반 분기(RangeError: 필드 drift) 각 1+ test. 재유도 chain 이 throw 하는 경우(stdout URL 미발견 등)는 가드 진입 전 파서 throw 가 그대로 전파됨을 검증(가드가 삼키지 않음) 1+ test.
- [ ] **Negative cases 충분 cover** — (a) `report` 의 5 필드 각각 drift → RangeError(5 필드 각 1+), (b) `stdout`/`run`/`report` null/undefined → TypeError(각 1+), (c) `report` 필드 type 위반(예: `issueNumber` 문자열, `summaryLine` 숫자) → TypeError(각 1+), (d) 정상 정합 report → throw 0, (e) 동일 입력 두 번 호출 deterministic(같은 결과), (f) 입력 비변형(`stdout`/`run`/`report` mutate 0) 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 신규 helper `realdata-e2e-result-issue-outcome-report-from-output-consistency.ts` 의 line/branch/function 100%.
- [ ] `pnpm lint && pnpm build` 통과. import(값 import 4종: 두 위임 함수 + type)로 인한 runtime cycle 0 (tsc green 으로 확인).

## Out of Scope

- `buildRealDataResultIssueOutcomeReportFromOutput` 컴포저 또는 위임 함수(`parseRealDataResultIssueCreateEditOutput`/`buildRealDataResultIssueOutcomeReport`) 본문 수정 — 본 task 는 가드 **신설만**, 컴포저·위임은 T-0596/T-0589/T-0590 산출물 그대로 사용.
- **가드의 컴포저 self-wire 배선** — 본 task 는 가드신설만. `buildRealDataResultIssueOutcomeReportFromOutput` 반환 직전 self-assert 배선은 별도 후속 slice(T-0647/T-0662-style self-wire mirror, Follow-up ①).
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields/search-hit/parse-shape)의 추가 가드 또는 self-wire — 본 chain 의 outcome-report composer-seam consistency 가드 1건만.
- 재유도 chain 의 URL 파싱·issueNumber 양수성 검증·run guard·summaryLine 합성 로직 재구현 — 전부 위임 호출로 재유도(재구현 금지).
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 가드만.
- production `src/` 코드 변경 — test helper 단독(위임 함수·타입 import 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 예상 후속 ①: 본 가드를 `buildRealDataResultIssueOutcomeReportFromOutput` 반환 직전 self-wire 배선 — T-0662 producer self-wire 동형.)
