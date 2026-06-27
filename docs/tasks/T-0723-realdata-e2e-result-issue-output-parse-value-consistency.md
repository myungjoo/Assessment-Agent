---
id: T-0723
title: realdata-e2e result-issue-output-parse 산출 ↔ raw stdout single-source 재유도 정합 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-06-28
independentStream: realdata-e2e-result-issue-output-parse-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-output-parse-consistency.ts
  - test/helpers/realdata-e2e-result-issue-output-parse-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only 값-정합 가드 — 가드 본체 + colocated spec 두 신규 파일이라 cap 초과 가능. T-0711(+421)/T-0713(+480)/T-0717(+1037)/T-0721(+320) test-only 값-가드 sibling 선례 정합. src 무변경."
plannerNote: "P5 consistency-sweep — result-issue search-parse 짝(T-0721→T-0722) 완결 후 post-execution mirror parseRealDataResultIssueCreateEditOutput 산출↔stdout 재유도 value-guard"
---

# T-0723 — realdata-e2e result-issue-output-parse 산출 ↔ raw stdout single-source 재유도 정합 가드 신설

## Why

PLAN.md 109행 실 평가 e2e bullet 의 build-time 정합-가드 sweep 을 잇는 task. result-issue search side stream(T-0721 가드 신설 → T-0722 self-wire)이 직전에 완결됐다. 본 task 는 그 sweep 을 **실행-전(search) 측의 정확한 대칭인 실행-후(create/edit) 측** genuine NO-GUARD-value leaf 인 `parseRealDataResultIssueCreateEditOutput`(T-0589, `realdata-e2e-result-issue-output-parse.ts`)로 확장한다 — 이 파서는 outcome↔parse-shape set-equality 가드(`assertRealDataResultIssueOutcomeMatchesParseShape`, T-0661/T-0662, 산출 outcome 의 키 집합이 선언 parse-shape 와 set-equal 인지 **shape** 만 검증) 만 self-wire 돼 있고, **파서 산출 `{issueNumber, url}` 전체를 raw stdout 으로부터 독립 재유도해 deep-equal 대조하는 값-정합 가드는 부재**(issueNumber 값·url trim 정규화·첫 매칭 URL 결정론의 값 drift 미cover gap). set-equality 가드는 키 집합만 보므로 issueNumber/url **값**이 drift 하거나 잘못된 매칭 URL 이 선택돼도 통과한다. 본 가드가 그 drift 를 build-time fail-fast 로 차단한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 정합 — 파서가 silent 하게 잘못된 issueNumber/url 을 산출하면 손상 outcome 이 caller live wiring 으로 새기 전 차단). T-0721 search-parse value-guard 의 post-execution mirror.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — 가드 대상 컴포저(`parseRealDataResultIssueCreateEditOutput`). 재유도 로직(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 → URL 전체 trim → `{issueNumber, url}` 정규화)의 single-source 규칙. `RealDataResultIssueOutcome` type · `ISSUE_URL_PATTERN` 정규식 규약 확인.
- `test/helpers/realdata-e2e-result-issue-outcome-parse-shape.ts` — 기존 outcome 키 집합 set-equality 가드(T-0661/T-0662). 본 값-가드와 책임 경계 확인(outcome shape vs 전체 산출 값 재유도).
- `test/helpers/realdata-e2e-result-issue-search-parse-consistency.ts` — 직전 짝(T-0721)의 값-정합 가드 선례. 독립 재유도 + deep-equal + TypeError↔RangeError 분리 패턴의 직접 mirror(search→output 측 변형만).
- `test/helpers/realdata-e2e-result-issue-search-parse-consistency.spec.ts` — colocated spec 패턴(T-0721) 참고.

## Acceptance Criteria

- [ ] **신규 가드 파일** `test/helpers/realdata-e2e-result-issue-output-parse-consistency.ts` 추가. `assertRealDataResultIssueOutputConsistentWithStdout(outcome, stdout)` (또는 동형 명세) export — 산출 `outcome`(`RealDataResultIssueOutcome`)과 raw `stdout` 을 입력받아, stdout 을 컴포저 재호출 없이 독립 재유도(ISSUE_URL_PATTERN 첫 매칭 → `<number>` 양의 정수 검증 → URL 전체 trim → `{issueNumber, url}` 정규화)한 expected 와 deep-equal 대조한다. 컴포저(`parseRealDataResultIssueCreateEditOutput`)는 **호출하지 않는다**(재호출 deep-equal 은 양방향 drift 상쇄라 무의미 — 독립 재유도가 핵심).
- [ ] **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** — 입력 자체가 비정상(outcome 이 non-null 객체 아님·stdout 이 string 아님 등)이면 TypeError, stdout 에 issue URL 매칭 0건·`<number>` 비양정수면 재유도 단계 구조 결손 TypeError, 재유도 expected 와 산출 outcome 의 issueNumber/url 값이 어긋나면 RangeError(기대 vs 실측 노출)로 분기. 한국어 명세형 에러 메시지.
- [ ] **happy-path unit test 1+** — 정상 stdout(단일 줄 URL · 다중 줄 중 첫 매칭 URL)에 대해 컴포저 산출이 가드를 void 통과하는 test. trailing 개행/공백이 trim 되어 정합하는 happy-path 1+.
- [ ] **error path unit test 1+** — issueNumber 값 drift(산출 number ≠ stdout URL 의 number)·url 값 drift(trim 누락·다른 매칭 URL 선택)·잘못된 첫 매칭(2개 URL 중 두 번째를 산출) 각각에 대해 가드가 throw 하는 test(값-정합 위반 RangeError).
- [ ] **분기마다 test branch 분리** — URL 매칭 0건(빈/공백/무관 텍스트/비-github 호스트/`/pull/` 경로) / `<number>` 비양정수(`/issues/0`·선행 0·`/issues/abc`) / outcome 비객체 / stdout 비-string / url trim 정규화 / issueNumber 값 비교 등 각 재유도·비교 분기 1+ test.
- [ ] **negative cases 충분 cover** — 구조결손(outcome 이 null/숫자/문자열·stdout 비-string·stdout 에 URL 미발견·`<number>` 비양정수) TypeError 경로 각 1+, 값정합 위반(issueNumber 값·url 값·첫 매칭 선택) RangeError 경로 각 1+. 단일 negative 만 금지 — 예외 분기마다 cover.
- [ ] **결정성·비변형 검증** — 동일 입력 두 번 호출 deep-equal(다중 줄 stdout 의 첫 매칭 결정론 포함), 입력 `outcome`/`stdout` 비변형(가드가 입력 mutate 0) test 1+.
- [ ] **§9 정합** — raw 활동 본문·credential 이 에러 메시지/산출에 노출되지 않음 단언(가드는 issueNumber·url 값·키 집합만 다룸, 비-issue 본문 미보유).
- [ ] colocated spec `test/helpers/realdata-e2e-result-issue-output-parse-consistency.spec.ts` 에 위 test 박제(colocated 우선 — NestJS/discoverability convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 가드 파일은 line/branch/func/stmt 100% 목표).
- [ ] `RealDataResultIssueOutcome` 는 `realdata-e2e-result-issue-output-parse` 에서 `import type` 재사용(신규 type 정의 금지). ISSUE_URL_PATTERN 규약은 컴포저와 동형으로 **독립 재구현**(상수 import 가능하면 재사용, 아니면 가드 내 동일 규약 재선언 — 재호출 0 원칙 유지).

## Out of Scope

- 컴포저 `parseRealDataResultIssueCreateEditOutput` 의 self-wire 배선(본 task 는 가드 신설만 — self-wire 짝은 후속 task, T-0721→T-0722 분리 패턴 동형).
- 컴포저 본체·`realdata-e2e-result-issue-output-parse.ts` 로직 변경(가드 신설 단독, 출력 byte-identical 보존).
- 기존 outcome 키 집합 set-equality 가드(`realdata-e2e-result-issue-outcome-parse-shape.ts`, T-0661/T-0662) 변경.
- 실 gh issue create/edit 호출 / `execFile('gh', argv)` / live wiring(step ④ credential gate).
- production `src/` 코드 변경 — test helper 단독.
- 새 dependency 도입(zod 등 금지 — 내장 정규표현식 + 수동 재유도만).
- 다른 NO-GUARD leaf(command-args·outcome-report 등) 가드 — 본 task 는 output-parse 단일.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 신설 시)
