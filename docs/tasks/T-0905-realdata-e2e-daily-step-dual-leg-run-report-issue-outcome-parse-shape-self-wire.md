---
id: T-0905
title: dual-leg run report 이슈 outcome↔parse-shape set-equality 가드 producer self-wire (parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput)
phase: P5
status: DONE
completedAt: 2026-07-11T02:10:00Z
result: "PR #799 squash d386e544 머지. dual-leg run report 이슈 outcome↔parse-shape 가드 producer self-wire (import 1줄+호출 1지점, byte-identical 보존). round1 APPROVE 4-게이트 PASS, test-only +179 2파일, lint/build/test:cov green, dep0."
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-outcome-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts
plannerNote: "P5 §109 step④ — T-0904 신설 outcome↔parse-shape 가드의 producer self-wire (summary 축 T-0662 mirror). 가드 신설→self-wire 2-slice 패턴 후반. import 1줄+호출 1지점, byte-identical 보존."
---

# T-0905 — dual-leg run report 이슈 outcome↔parse-shape set-equality 가드 producer self-wire

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 의 dual-leg run report 축 build-time chain 은 입력(search argv/parse)부터 출력(create/edit stdout → `{issueNumber, url}` 파싱, T-0903)까지 순수 함수로 round-trip 이 닫혔고, 직전 T-0904 가 그 base 파서 뒤에 **산출 outcome 키 집합 ↔ 선언 parse-shape set-equality 가드**(`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape` + single-source `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`)를 **신설만** 했다. 그러나 producer(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`)의 산출 경로에는 가드가 미배선이다 — 파서가 선언 shape 와 어긋난 outcome 을 산출해도 production 시점에 걸러지지 않는다.

본 task 는 그 가드를 파서가 정규화 outcome 을 반환하기 직전에 self-assert 하도록 배선해, 파서가 선언 shape 와 어긋난 outcome 을 산출하면 fail-fast 하게 한다. 이는 summary 축의 선례 **T-0662**(`parseRealDataResultIssueCreateEditOutput` self-wire, T-0661 신설 가드의 producer 배선)의 정확한 dual-leg 축 mirror 이며, dual-leg 축 outcome-guard 의 "가드 신설(T-0904) → self-wire(T-0905)" 2-slice 패턴 후반이다. 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 배선이라 cloud cron 에서 자율 실행 가능하다(REQ-059 raw 미저장 정합 — 가드는 키 집합만 비교).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — self-wire 대상 producer. `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(stdout): RealDataDailyStepDualLegRunReportIssueOutcome`(L108~) 의 단일 반환 지점(L123~128: `const outcome = { issueNumber, url: match[0].trim() }; return outcome;`). 그 `outcome` 을 반환하기 직전(L126~128 사이)이 self-assert 삽입 지점 — 이미 const 로 묶여 있어 매직 객체 재생성 불요.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts` — import 원천(T-0904 산출물, main 박제 완료). `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, parseShapeKeys)`(L223~) + `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS`(L80~). 가드 시그니처·throw 계약(구조 결손=TypeError / set 불일치=RangeError) 확인. 본 상수는 본 모듈에서 정의·export(re-export 아님).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.spec.ts` — colocated spec. self-wire 검증 case 를 **describe append** 할 위치(신규 spec 파일 신설 금지, 기존 colocated 에 추가).
- 패턴 선례: `docs/tasks/T-0662-realdata-result-outcome-parse-shape-self-wire.md` — summary 축의 동형 producer self-wire task(import 1줄 + 호출 1지점, byte-identical 보존 룰, spy 기반 self-assert 검증 case 구성). 본 task 는 검증 대상을 summary outcome 에서 dual-leg outcome 으로 바꾼 mirror.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 의 단일 반환 지점에서, `outcome`(`{ issueNumber, url }`) 을 반환하기 직전에 `assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape(outcome, REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS)` 를 self-assert 호출하도록 배선한다(import 1줄 + 호출 1지점). 이미 `const outcome` 으로 묶여 있으므로 그 변수를 가드에 넘긴 뒤 그대로 반환 — 매직 객체 재생성 금지.
- [ ] 정상 입력에 대해 산출 outcome 이 **byte-identical 보존** — self-wire 전후 `{ issueNumber, url }` 필드 값·순서·무공유(새 객체) 그대로. self-assert 는 검증만 하고 출력을 변형하지 않음.
- [ ] **Happy-path unit test 1+**: 정상 stdout(유효 issue URL 1건, 다중 줄 포함) → 산출 outcome 이 self-wire 전과 동일(`{ issueNumber, url }`), self-assert 통과로 throw 0.
- [ ] **Error path unit test 1+**: producer 가 선언 shape 와 어긋난 outcome 을 산출하는 상황을 가드가 catch 함을 검증 — `jest.spyOn`(가드 모듈)으로 set 불일치(잉여/누락 키) 반환을 강제하거나, self-assert 가 실제 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 인자로 매 정상 호출마다 일어남을 spy 로 확인해 producer 가 손상 outcome 을 반환하기 전 fail-fast 함을 검증.
- [ ] **Flow / branch cover**: producer 의 기존 분기(URL 미매칭 throw / issueNumber 비양정수 throw)는 self-wire 전후 동일하게 동작 — 각 분기 회귀 test 1+. self-assert 가 그 분기 도달 전에 끼어들지 않음(정규화·검증 완료 후에만 호출됨)을 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(분기·예외 상황마다): (a) URL 미발견(빈/공백/비-github 호스트/`/pull/` 경로) → 가드 도달 전 기존 throw, (b) issueNumber `0`·선행 0(`007`)·비정수 → 가드 도달 전 기존 throw, (c) 정상 outcome 에 대해 가드 throw 0, (d) self-assert 가 매 정상 호출마다 `["issueNumber","url"]` 상수로 일어남(spy), (e) 입력 stdout 비변형(순수성 보존), (f) 동일 stdout 두 번 호출 시 결정론(에러 여부·outcome 동형) — 각 1+ test.
- [ ] **R-59 정합** — self-wire 후에도 파서는 issueNumber/url 만 산출하고 이슈 본문/narrative/credential 을 보유·노출하지 않는다(가드는 키 집합만 비교).
- [ ] **build-time 완결·dependency-free**: 실 gh 실행 / 실 jest spawn / 네트워크 / DB / env 읽기 / live-LLM / credential / 새 외부 라이브러리(zod/execa 등) 0. import 는 값 import(가드+상수)이며 `process.env` 읽기 0.
- [ ] `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%). 변경한 `output-parse.ts` 의 line/branch/function 100% 유지.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. import 추가로 인한 runtime cycle 0(값 import 이므로 import graph 가 cycle 을 만들지 않는지 tsc green 으로 확인).
- [ ] **spec 위치 ordering** — colocated `output-parse.spec.ts` 에 describe append(신규 spec 파일 신설 금지). `describe`/`it` 문자열 한국어로 self-wire 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안 인라인 구성).

## Out of Scope

- 가드 함수 본문(`assertRealDataDailyStepDualLegRunReportIssueOutcomeMatchesParseShape`) 또는 `REAL_DATA_DAILY_STEP_DUAL_LEG_RUN_REPORT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 상수 수정 — 본 task 는 **배선만**, 가드/상수는 T-0904 산출물 그대로 사용(파일 무변경).
- 신규 helper/spec 파일 신설 — 기존 2 파일(`output-parse.ts` + colocated spec)만 변경.
- `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 의 URL 매칭·issueNumber 검증·정규화 로직·필드 집합·검증 순서 변경(출력 byte-identical 보존).
- **outcome 값-정합 재유도 가드**(산출 `{issueNumber,url}` 전체를 raw stdout 으로부터 독립 재유도해 deep-equal 대조 — summary 축 T-0723/T-0724 mirror) — 본 task 는 shape self-wire 만. 값-drift 가드는 별도 후속 slice.
- 다른 realdata-e2e seam(search-hit/descriptor/command-args/gh-argv/command-plan)의 추가 가드 또는 self-wire — 본 chain 의 outcome↔parse-shape seam producer self-wire 1건만.
- 실 `execFile('gh', argv)` / `gh issue create`·`gh issue edit` 실 실행(step ④ live wiring — credential gate, deferred).
- `deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 값-정합 가드(summary 축 T-0723/T-0724 mirror)는 다음 planner 가 후속 slice 로 큐잉 후보.)
