---
id: T-0906
title: dual-leg run report 이슈 output-parse 산출 ↔ raw stdout single-source 재유도 값-정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-daily-step-dual-leg-run-report-output-consistency-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only 값-정합 가드 — 가드 본체 + colocated spec 두 신규 파일이라 cap 초과 가능. summary 축 T-0723(+320) 및 T-0711/T-0713/T-0717/T-0721 test-only 값-가드 sibling 선례 정합. src 무변경."
plannerNote: "P5 §109 step④ — dual-leg run report output-parse 산출↔stdout single-source 재유도 값-정합 가드 신설(summary 축 T-0723 mirror). shape 가드(T-0904/T-0905) 다음 값-drift cover gap. self-wire 는 후속 T-0907."
---

# T-0906 — dual-leg run report 이슈 output-parse 산출 ↔ raw stdout single-source 재유도 값-정합 가드 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5) step ④ 의 dual-leg run report 축 build-time chain 은 입력(search argv/parse)부터 출력(`gh issue create`/`edit` stdout → `{issueNumber, url}` 파싱, T-0903)까지 순수 함수로 round-trip 이 닫혔고, 직전 T-0904(outcome↔parse-shape set-equality 가드 신설)+T-0905(그 가드 producer self-wire)가 **shape** 축을 완결했다. 그러나 그 set-equality 가드는 산출 outcome 의 **키 집합**만 `{issueNumber, url}` 과 set-equal 인지 본다 — issueNumber **값**이 drift 하거나(잘못된 URL 매칭), url trim 정규화가 어긋나거나, 다중 줄 stdout 의 첫 매칭 결정론이 깨져도 키 집합은 그대로라 통과한다. 이 **값-drift** 는 현재 build-time 에 미cover 인 gap 이다.

본 task 는 그 gap 을 메우는 **값-정합 가드**를 신설한다 — 산출 `outcome` 과 raw `stdout` 을 입력받아 stdout 을 컴포저 재호출 없이 독립 재유도(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 → URL 전체 trim → `{issueNumber, url}` 정규화)한 expected 와 deep-equal 대조해, 파서가 silent 하게 잘못된 issueNumber/url 을 산출하면 build-time fail-fast 로 차단한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 정합 — 손상 outcome 이 caller live wiring 으로 새기 전 차단). 이는 summary 축 선례 **T-0723**(`assertRealDataResultIssueOutputConsistentWithStdout`, T-0721 search-parse value-guard 의 post-execution mirror)의 정확한 dual-leg 축 mirror 다. self-wire 짝은 후속 T-0907(summary 축 T-0724 mirror)로 분리한다(T-0721→T-0722·T-0723→T-0724 신설/self-wire 분리 패턴 동형). 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 test helper 신설이라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` — 가드 대상 컴포저(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`)와 재유도 single-source 규칙: `ISSUE_URL_PATTERN`(`/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/(\d+)(?![\w])/`) 첫 매칭 → `<number>` 양의 정수 검증(`^[1-9]\d*$`, 0/선행 0 차단) → `match[0].trim()` URL 정규화 → `{issueNumber, url}`. `RealDataDailyStepDualLegRunReportIssueOutcome` type · `assertPositiveIssueNumber` 규약 확인.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts` — 기존 outcome 키 집합 set-equality 가드(T-0904/T-0905). 본 값-가드와 책임 경계 확인(outcome **shape** vs 전체 산출 **값** 재유도). 본 task 는 shape 가드를 변경하지 않는다.
- `docs/tasks/T-0723-realdata-e2e-result-issue-output-parse-value-consistency.md` — summary 축의 동형 값-정합 가드 신설 선례. 독립 재유도 + deep-equal + 구조결손 TypeError ↔ 값정합 위반 RangeError 분리 패턴의 직접 mirror(result→dual-leg-run-report 측 변형만). Acceptance Criteria 구성·negative case 커버 폭 참고.
- `test/helpers/realdata-e2e-result-issue-output-parse-consistency.ts` + `...consistency.spec.ts` — T-0723 산출물(main 박제). 재유도 로직·에러 분기·colocated spec 구성의 직접 참조 원본. 본 helper 는 이를 dual-leg 축 심볼명으로 mirror.
- CLAUDE.md §3.2(R-112 4종 + coverage 임계) · §12(언어 정책).

## Acceptance Criteria

- [ ] **신규 가드 파일** `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.ts` 추가. `assertRealDataDailyStepDualLegRunReportIssueOutputConsistentWithStdout(outcome, stdout)`(또는 동형 명세) export — 산출 `outcome`(`RealDataDailyStepDualLegRunReportIssueOutcome`)과 raw `stdout` 을 입력받아, stdout 을 컴포저 재호출 없이 독립 재유도(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 → URL 전체 trim → `{issueNumber, url}` 정규화)한 expected 와 deep-equal 대조한다. 컴포저(`parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput`)는 **호출하지 않는다**(재호출 deep-equal 은 양방향 drift 상쇄라 무의미 — 독립 재유도가 핵심).
- [ ] **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** — 입력 자체가 비정상(outcome 이 non-null 객체 아님·stdout 이 string 아님 등)이면 TypeError, stdout 에 issue URL 매칭 0건·`<number>` 비양정수면 재유도 단계 구조 결손 TypeError, 재유도 expected 와 산출 outcome 의 issueNumber/url 값이 어긋나면 RangeError(기대 vs 실측 노출)로 분기. 한국어 명세형 에러 메시지.
- [ ] **Happy-path unit test 1+** — 정상 stdout(단일 줄 URL · 다중 줄 중 첫 매칭 URL · trailing 개행/공백 trim 후 정합)에 대해 컴포저 산출이 가드를 void 통과하는 test 1+.
- [ ] **Error path unit test 1+** — issueNumber 값 drift(산출 number ≠ stdout URL 의 number)·url 값 drift(trim 누락·다른 매칭 URL 선택)·잘못된 첫 매칭(2개 URL 중 두 번째를 산출) 각각에 대해 가드가 throw(값-정합 위반 RangeError)하는 test.
- [ ] **Flow / branch cover** — 각 재유도·비교 분기 1+ test: URL 매칭 0건(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 경로) / `<number>` 비양정수(`/issues/0`·선행 0·`/issues/abc`) / outcome 비객체 / stdout 비-string / url trim 정규화 / issueNumber 값 비교.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 금지(예외 분기마다): 구조결손(outcome 이 null/숫자/문자열·stdout 비-string·stdout 에 URL 미발견·`<number>` 비양정수) TypeError 경로 각 1+, 값정합 위반(issueNumber 값·url 값·첫 매칭 선택) RangeError 경로 각 1+.
- [ ] **결정성·비변형 검증** — 동일 입력 두 번 호출 결과 동형(다중 줄 stdout 의 첫 매칭 결정론 포함), 입력 `outcome`/`stdout` 비변형(가드가 입력 mutate 0) test 1+.
- [ ] **R-59 / REQ-059 정합** — raw 활동 본문·narrative·credential 이 에러 메시지/산출에 노출되지 않음 단언(가드는 issueNumber·url 값·키 집합만 다룸, 비-issue 본문 미보유).
- [ ] `RealDataDailyStepDualLegRunReportIssueOutcome` 는 `realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse` 에서 `import type` 재사용(신규 type 정의 금지). ISSUE_URL_PATTERN 규약은 컴포저와 동형으로 **독립 재구현**(상수 export 가능하면 재사용, 아니면 가드 내 동일 규약 재선언 — 컴포저 재호출 0 원칙 유지).
- [ ] **spec 위치 ordering** — colocated `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse-consistency.spec.ts` 에 위 test 박제(colocated 우선 — NestJS/discoverability convention). `describe`/`it` 문자열 한국어로 가드 의도 명확화. 새 공용 mock helper 추출 불요(fixture 는 spec 안 인라인 구성).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80% — 신규 가드 파일은 line/branch/func/stmt 100% 목표).

## Out of Scope

- 컴포저 `parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput` 의 self-wire 배선(본 task 는 가드 **신설만** — self-wire 짝은 후속 T-0907, summary 축 T-0723→T-0724 분리 패턴 동형).
- 컴포저 본체·`realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse.ts` 로직 변경(가드 신설 단독, 출력 byte-identical 보존).
- 기존 outcome 키 집합 set-equality 가드(`realdata-e2e-daily-step-dual-leg-run-report-issue-outcome-parse-shape.ts`, T-0904/T-0905) 변경.
- 실 gh issue create/edit 호출 / `execFile('gh', argv)` / live wiring(step ④ credential gate, deferred).
- `deploy/daily-test.sh` step wiring / `latest-result.json` 실 읽기 / Ollama 실 LLM round-trip(ADR-0045 LAN gate).
- 다른 realdata-e2e seam(search-hit/descriptor/command-args/gh-argv/command-plan/search-parse) 가드 또는 self-wire — 본 task 는 output-parse 값-정합 가드 단일.
- production `src/` 코드 / `package.json` / schema / migration / 새 dependency(zod/execa 등 금지 — 내장 정규표현식 + 수동 재유도만) / auth 변경 — 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 값-정합 가드 producer self-wire(summary 축 T-0724 mirror)는 다음 planner 가 후속 slice T-0907 로 큐잉 후보.)
