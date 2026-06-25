---
id: T-0661
title: 실 평가 e2e outcome 산출 키 집합 ↔ parse-shape 키 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-059]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ realdata-e2e stream — post-execution outcome 산출 키 집합↔parse-shape 정합 가드(T-0659 search-hit 가드의 post-execution mirror), parser↔declared-shape seam 닫음"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-outcome-parse-shape.ts
  - test/helpers/realdata-e2e-result-issue-outcome-parse-shape.spec.ts
---

# T-0661 — 실 평가 e2e outcome 산출 키 집합 ↔ parse-shape 키 정합 순수 가드 신설

## Why

PLAN 109행 step④(실 평가 e2e gh argv/parse surface 무결성 chain)에서 **pre-execution(search) 측**의 parse-shape 정합은 세 축이 모두 닫혔다 — argv↔commandArgs round-trip(T-0655/56)·`--json`↔parse-shape(T-0657/58)·parse-shape↔produced-hit(T-0659/60). 그러나 그 정확한 대칭인 **post-execution 측** 에는 같은 정합 가드가 없다: `parseRealDataResultIssueCreateEditOutput`(T-0589) 가 `gh issue create`/`gh issue edit` 의 stdout 을 `RealDataResultIssueOutcome {issueNumber, url}` 로 파싱·반환할 때, **실제로 산출하는 outcome 객체의 키 집합**(`{issueNumber, url}`, 파서 본문 line 114~117 에 하드코딩)과 **선언된 outcome shape**(interface `RealDataResultIssueOutcome` 의 키 집합) 사이에 어떤 set-equality 가드도 없다. 누가 outcome interface 에 키를 추가(예: `htmlUrl`)하거나 파서가 추가 필드를 흘려도 silently 정합이 깨질 수 있다. 본 task 는 이 producer↔declared-shape seam 을 닫는 순수 가드 `assertRealDataResultIssueOutcomeMatchesParseShape(outcome, parseShapeKeys)` 를 신설한다 — T-0659 의 search-hit↔parse-shape 가드의 post-execution mirror(set-equality·TypeError/RangeError 구분·fail-fast 패턴 동형). 단, post-execution 측에는 search 의 `--json`/json-fields 같은 선행 상수가 없으므로, 본 가드가 **자체 single-source 정규 키 목록 상수** `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = ["issueNumber", "url"]` 를 신규 정의한다(search 측이 json-fields 상수를 re-export 한 것과 달리, 본 측은 진실의 원천이 없으므로 신규 정의가 정당).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — self-wire 대상이 될 producer(본 task 는 **read-only**, 변경 금지). `RealDataResultIssueOutcome` interface(line 57~60, `{issueNumber:number; url:string}`)와 파서 `parseRealDataResultIssueCreateEditOutput`(line 99~118)의 정규화 반환 지점(line 114~117, `{issueNumber, url}` 만 산출). 본 가드가 검증할 "산출 outcome 키 집합" 의 출처. interface 는 import 만(신규 type 정의 금지).
- `test/helpers/realdata-e2e-result-issue-search-hit-shape.ts` — **동형 mirror 선례**(T-0659 산출물). 순수 가드 / `assertHitStructure`(구조 결손=TypeError) / set-equality 비교(누락·잉여·중복·빈배열=RangeError) / single-source 키 목록 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0. 본 가드는 그 에러 정책·관례·JSDoc 톤을 그대로 mirror 하되, 검증 대상이 "search hit `{number,title,body}`" 가 아니라 "outcome `{issueNumber,url}`" 이고, 정규 키 목록은 re-export 가 아니라 **본 모듈에서 신규 정의**한다.
- `test/helpers/realdata-e2e-result-issue-search-json-fields.ts` — single-source 상수 정의 관례(`REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 정의 + `as const` readonly 패턴, line 70~)를 본 task 의 `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 신규 정의 시 동형으로 따른다. **import 만, 본 파일 변경 금지**.
- `docs/tasks/T-0659-realdata-result-search-hit-parse-shape-guard.md` — 신설 가드 직전 선례(set-equality 정합 순수 가드, pre-execution producer-shape). 본 task 는 그 post-execution sibling — 동형 구조·error 분기·spec 패턴(Acceptance Criteria 구성 참고).

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-result-issue-outcome-parse-shape.ts` 에 다음을 신설:
  - single-source readonly 정규 키 목록 상수 `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = ["issueNumber", "url"] as const`(또는 `readonly string[]` 동형). 이 상수가 본 모듈에서 정의·export 되는 진실의 원천이다(search 측이 json-fields 를 re-export 한 것과 달리 post-execution 측엔 선행 상수가 없으므로 신규 정의).
  - 순수 함수 `assertRealDataResultIssueOutcomeMatchesParseShape(outcome: RealDataResultIssueOutcome, parseShapeKeys: readonly string[]): void` — 파싱 산출 outcome 의 **자기 own enumerable 키 집합**(`Object.keys(outcome)`)이 `parseShapeKeys` 집합과 set-equal 이면 void, 어긋나면 fail-fast throw. `RealDataResultIssueOutcome` 은 `./realdata-e2e-result-issue-output-parse` 에서 import(신규 type 정의 금지).
- [ ] 가드는 `outcome` 인자 자체를 변형하지 않는다(읽기·키 비교만). `parseShapeKeys` 도 읽기만(정렬·mutate 금지).
- [ ] 구조 결손(null/undefined/비객체/배열)은 `TypeError`, 의미 위반(키 집합 불일치)은 `RangeError` 로 구분(T-0659 가드 convention 동형). 메시지에 위반 키 이름·기대 집합·실측 집합 포함.
- [ ] type/함수 import 라 runtime import cycle 0 — `pnpm build`(tsc) green 으로 확인.
- [ ] **Happy-path unit test**: 정상 outcome(`{issueNumber:42, url:"https://github.com/o/r/issues/42"}`)와 `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 입력 시 throw 없이 통과. 추가로 production 상수 자체가 파서 실제 산출 outcome 과 정합임을 회귀-검증하는 test 1+(`parseRealDataResultIssueCreateEditOutput` 를 정상 stdout 으로 호출해 얻은 실 outcome 을 본 가드에 통과시켜 상수↔파서 산출 정합 확인).
- [ ] **Error path unit test**: (a) `outcome` 가 null/undefined/비객체 → `TypeError`, (b) `outcome` 가 배열 → `TypeError`, (c) `parseShapeKeys` 가 비배열/비-string 원소 포함 → `TypeError`, (d) `parseShapeKeys` 빈 배열 → `RangeError`.
- [ ] **Flow / branch cover** — 키 비교 분기마다 1+ test: (i) outcome 에 parse-shape 키 누락(예: `{issueNumber}` 만, url 누락) → `RangeError`(누락 키 메시지), (ii) outcome 에 잉여 키(예: `{issueNumber, url, htmlUrl}`) → `RangeError`(잉여 키 메시지), (iii) 정확히 일치 → void.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) 키 순서만 다르고 집합 동일(`{url, issueNumber}`) → 통과(set-equality 는 순서 무관), (b) parseShapeKeys 에 중복 키 → `RangeError`(중복 거부), (c) outcome 의 키가 빈 문자열/공백 키를 포함 → `RangeError`, (d) 입력 outcome 객체 비변형 확인(가드 호출 후 own keys/값 unchanged), (e) outcome 키 집합과 parseShapeKeys 가 부분 교집합(일부 누락 + 일부 잉여 동시) → `RangeError`(누락·잉여 둘 다 보고 또는 fail-fast 우선순위 명시), (f) 대/소문자 차이 키(`IssueNumber` vs `issueNumber`) → 불일치 거부(대소문자 민감).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 신규 helper line/branch/function 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 파서(`realdata-e2e-result-issue-output-parse.ts`) / `RealDataResultIssueOutcome` interface 본문 변경 — import·read 만. 신설 가드·상수는 본 task 의 새 파일에서만.
- 신설 가드의 producer self-wire — 가드+상수 신설만 한다. self-wire(`parseRealDataResultIssueCreateEditOutput` 산출 직전 self-assert 배선)는 Follow-up(T-0660 self-wire 동형 — T-0662 후보).
- search-side parse-shape 가드(T-0657/T-0659) 변경 — 본 task 는 그 post-execution mirror 신설이지 기존 가드 수정 아님.
- outcome-report 컴포저(`realdata-e2e-result-issue-outcome-report-from-output.ts` 등)의 추가 가드 — 본 task 는 outcome producer↔declared-shape seam 신설 1건만.
- live `gh issue create`/`edit` execFile wiring / 실 네트워크 호출 — credential 게이트 deferred, 본 task 는 build-time 순수 가드만.
- 새 외부 dependency / Prisma migration / STATE schema 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 신설 가드의 producer self-wire(`parseRealDataResultIssueCreateEditOutput` 산출 직전 `assertRealDataResultIssueOutcomeMatchesParseShape(outcome, REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS)` self-assert 배선)는 다음 planner 가 T-0660 self-wire 동형으로 큐잉 후보(T-0662). 이로써 realdata-e2e 의 pre-execution(search) 과 post-execution(outcome) 양 측이 모두 parse-shape↔produced-shape seam 가드로 대칭 완결된다.)
