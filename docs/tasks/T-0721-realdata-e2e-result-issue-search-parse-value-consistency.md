---
id: T-0721
title: realdata-e2e result-issue-search-parse 산출 ↔ raw stdout single-source 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-06-27
independentStream: realdata-e2e-result-issue-search-parse-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-parse-consistency.ts
  - test/helpers/realdata-e2e-result-issue-search-parse-consistency.spec.ts
sizeExempt: true
exemptReason: "test-only 값-정합 가드 — 가드 본체 + colocated spec 두 신규 파일이라 cap 초과 가능. T-0701(+300)/T-0705(+586)/T-0711(+421)/T-0713(+480)/T-0717(+1037) test-only 값-가드 sibling 선례 정합. src 무변경."
plannerNote: "P5 consistency-sweep — result-issue-side 첫 value-guard, parseRealDataResultIssueSearchOutput 산출↔stdout 재유도(seed-side 사슬 완결 후 result-issue parse leaf 진입)"
---

# T-0721 — realdata-e2e result-issue-search-parse 산출 ↔ raw stdout single-source 재유도 정합 가드 신설

## Why

PLAN.md 109행 실 평가 e2e bullet 의 build-time 정합-가드 sweep 을 잇는 task. seed-side stream(seed-fixture / collect-input / collect-call-args / upsert / resolve-person-id)이 T-0716~T-0720 으로 모두 값-정합 가드 + 컴포저 self-wire 짝까지 완결됐다. 본 task 는 그 sweep 을 result-issue side 의 genuine NO-GUARD-value leaf 인 `parseRealDataResultIssueSearchOutput`(T-0587) 로 확장한다 — 이 파서는 per-hit 키 집합 set-equality 가드(T-0660)만 self-wire 돼 있고, **파서 산출 `RealDataResultIssueSearchHit[]` 전체를 raw stdout 으로부터 독립 재유도해 deep-equal 대조하는 값-정합 가드는 부재**(개수·순서·필드값·추가필드 drop 의 값 drift 미cover gap). 본 가드가 그 drift 를 build-time fail-fast 로 차단한다(REQ-032 raw 미저장·REQ-059 입력 외 데이터 생성 0 정합 — 파서가 silent 하게 추가 필드를 누설하거나 hit 을 누락/중복하면 손상 산출이 caller resolver(T-0584)로 새기 전 차단). T-0711/T-0713 result-summary value-guard mirror.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — 가드 대상 컴포저(`parseRealDataResultIssueSearchOutput`). 재유도 로직(JSON.parse → 배열 guard → 원소 객체 guard → number/title/body 검증 → `{number,title,body}` 정규화)의 single-source 규칙.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `RealDataResultIssueSearchHit` type(import type 재사용 대상, 중복 정의 금지).
- `test/helpers/realdata-e2e-result-issue-search-hit-shape.ts` — 기존 per-hit set-equality 가드(T-0659/T-0660). 본 값-가드와 책임 경계 확인(per-hit shape vs 전체 산출 값 재유도).
- `test/helpers/realdata-e2e-result-summary-line-consistency.ts` — 값-정합 가드 선례(T-0711). 독립 재유도 + deep-equal + TypeError↔RangeError 분리 패턴 참고.
- `test/helpers/realdata-e2e-result-summary-line-consistency.spec.ts` — colocated spec 패턴(T-0711) 참고.

## Acceptance Criteria

- [ ] **신규 가드 파일** `test/helpers/realdata-e2e-result-issue-search-parse-consistency.ts` 추가. `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)` (또는 동형 명세) export — 산출 `hits` 와 raw `stdout` 을 입력받아, stdout 을 컴포저 재호출 없이 독립 재유도(JSON.parse → 배열 필터 → 각 원소 `{number,title,body}` 추출)한 expected 배열과 deep-equal 대조한다. 컴포저(`parseRealDataResultIssueSearchOutput`)는 **호출하지 않는다**(재호출 deep-equal 은 양방향 drift 상쇄라 무의미 — 독립 재유도가 핵심).
- [ ] **구조결손 TypeError ↔ 값정합 위반 RangeError 분리** — 입력 자체가 비정상(hits 가 배열 아님·원소 비객체 등)이면 TypeError, 재유도 expected 와 값/개수/순서/필드가 어긋나면 RangeError(또는 명세형 Error)로 분기. 한국어 명세형 에러 메시지.
- [ ] **happy-path unit test 1+** — 정상 stdout(1~2 hit)에 대해 컴포저 산출이 가드를 void 통과하는 test. `"[]"` → `[]`(0건) happy-path 도 1+.
- [ ] **error path unit test 1+** — 추가 필드가 산출에 누설된 hits·개수 불일치(hit 누락/중복)·순서 뒤바뀜·number/title/body 값 drift 각각에 대해 가드가 throw 하는 test(값-정합 위반 RangeError).
- [ ] **분기마다 test branch 분리** — 배열 guard / 원소 객체 guard / number 양의 정수 / title·body 문자열 / 추가필드 drop / 정렬·개수 등 각 재유도 분기 1+ test.
- [ ] **negative cases 충분 cover** — 구조결손(hits 비배열·원소 null/숫자/문자열·stdout 비-JSON·stdout JSON 이 비배열) TypeError 경로 각 1+, 값정합 위반(필드값·개수·순서·추가필드) RangeError 경로 각 1+. 단일 negative 만 금지 — 예외 분기마다 cover.
- [ ] **결정성·비변형 검증** — 동일 입력 두 번 호출 deep-equal, 입력 `hits`/`stdout` 비변형(가드가 입력 mutate 0) test 1+.
- [ ] **§9 정합** — raw 활동 본문·credential 이 에러 메시지/산출에 노출되지 않음 단언(가드는 키 집합·필드 타입만 다룸).
- [ ] colocated spec `test/helpers/realdata-e2e-result-issue-search-parse-consistency.spec.ts` 에 위 test 박제(colocated 우선 — NestJS/discoverability convention).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신규 가드 파일은 line/branch/func/stmt 100% 목표).
- [ ] `RealDataResultIssueSearchHit` 는 `realdata-e2e-result-issue-action` 에서 `import type` 재사용(신규 type 정의 금지).

## Out of Scope

- 컴포저 `parseRealDataResultIssueSearchOutput` 의 self-wire 배선(본 task 는 가드 신설만 — self-wire 짝은 후속 task, T-0711→T-0712 분리 패턴 동형).
- 컴포저 본체·`realdata-e2e-result-issue-search-parse.ts` 로직 변경(가드 신설 단독, 출력 byte-identical 보존).
- 기존 per-hit set-equality 가드(`realdata-e2e-result-issue-search-hit-shape.ts`, T-0659/T-0660) 변경.
- 실 gh search 호출 / `execFile` / live wiring(step ④ credential gate).
- production `src/` 코드 변경 — test helper 단독.
- 새 dependency 도입(zod 등 금지 — 내장 `JSON.parse` + 수동 재유도만).
- 다른 NO-GUARD leaf(output-parse·outcome-report 등) 가드 — 본 task 는 search-parse 단일.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 신설 시)
