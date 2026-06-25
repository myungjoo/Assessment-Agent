---
id: T-0659
title: 실 평가 e2e search-hit 키 집합 ↔ parse-shape 키 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ realdata-e2e stream — 파싱 산출 hit 키 집합↔PARSE_SHAPE_KEYS 정합 가드(json-fields request-side 가드의 parse-output consumer-side mirror), constant↔produced-hit seam 닫음"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-hit-shape.ts
  - test/helpers/realdata-e2e-result-issue-search-hit-shape.spec.ts
---

# T-0659 — 실 평가 e2e search-hit 키 집합 ↔ parse-shape 키 정합 순수 가드 신설

## Why

PLAN 109행 step④(실 평가 e2e gh argv/parse surface 무결성 chain)에서 search 경로의 build-time 정합 가드는 두 축이 닫혀 있다 — argv↔commandArgs round-trip(T-0655/T-0656)과 `--json` 요청 필드↔parse-shape 키(T-0657/T-0658). 그러나 **세 번째 coupling 축이 미커버**다: `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS = ["number","title","body"]` 상수와, 파서 `parseRealDataResultIssueSearchOutput` 가 **실제로 산출하는 hit 객체의 키 집합**(`{number, title, body}`, parse 함수 본문에 하드코딩) 사이에는 어떤 가드도 없다. 상수가 드리프트(예: 누가 `author` 를 parse-shape 키에 추가)해도 파서는 옛 3키만 계속 추출·검증해 정합이 silently 깨지며, json-fields 가드는 이를 못 잡는다(그 가드는 상수를 `--json` 요청 필드와만 묶지, 파서가 실제 산출하는 hit 와 묶지 않는다). 본 task 는 파싱 산출 hit 의 자기 키 집합 ↔ 선언된 parse-shape 키 집합을 set-equality 로 검증하는 순수 가드 `assertRealDataResultIssueSearchHitMatchesParseShape(hit, parseShapeKeys)` 를 신설해 이 constant↔produced-hit seam 을 닫는다. T-0657 json-fields 가드(request-side)의 parse-output consumer-side mirror — set-equality·TypeError/RangeError 구분·fail-fast 패턴 동형.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — 파서 `parseRealDataResultIssueSearchOutput`(line 100~137). 산출 hit 가 `{number, title, body}` 만 추출(line 130~135, 추가 필드 drop)·`assertHitNumber`/`assertHitString` 으로 number·title·body 만 검증함을 확인. 본 가드가 검증할 "산출 hit 키 집합" 의 출처. **본 task 는 이 파일을 변경하지 않는다**(read-only — 정합 대상 확인용).
- `test/helpers/realdata-e2e-result-issue-search-json-fields.ts` — 단일 출처 상수 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(line 70~)와, 동형 가드 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape`(line 188~). 본 task 의 신설 가드는 이 상수를 두 번째 인자로 받는 consumer-side mirror. 그 가드의 TypeError(구조 결손)/RangeError(빈 배열·누락·잉여) 분기 convention 을 그대로 따른다(line 188~230 참조). **상수 import 만, 가드 본문·상수 변경 금지**.
- `test/helpers/realdata-e2e-result-issue-action.ts` — `RealDataResultIssueSearchHit` interface(line 65~69, `{number:number; title:string; body:string}`). 본 가드가 받는 `hit` 인자 타입의 출처(import 만, type 신규 정의 금지).
- `docs/tasks/T-0657-realdata-result-search-json-fields-parse-shape-guard.md` — 신설 가드 선례(set-equality 정합 순수 가드, request-side). 본 task 는 그 parse-output consumer-side sibling — 동형 구조·error 분기·spec 패턴.

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-result-issue-search-hit-shape.ts` 에 순수 함수 `assertRealDataResultIssueSearchHitMatchesParseShape(hit: RealDataResultIssueSearchHit, parseShapeKeys: readonly string[]): void` 신설. 동작: 파싱 산출 hit 의 **자기 own enumerable 키 집합**(`Object.keys(hit)`)이 `parseShapeKeys` 집합과 set-equal 이면 void, 어긋나면 fail-fast throw. `RealDataResultIssueSearchHit` 와 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 는 각각 `./realdata-e2e-result-issue-action`·`./realdata-e2e-result-issue-search-json-fields` 에서 import(신규 type/상수 정의 금지).
- [ ] 가드는 `hit` 인자 자체를 변형하지 않는다(읽기·키 비교만). `parseShapeKeys` 도 읽기만(정렬·mutate 금지).
- [ ] 구조 결손은 `TypeError`, 의미 위반(키 집합 불일치)은 `RangeError` 로 구분(T-0657 가드 convention 동형). 메시지에 위반 키 이름·기대 집합·실측 집합 포함.
- [ ] type-only/함수 import 라 runtime import cycle 0 — `pnpm build`(tsc) green 으로 확인.
- [ ] Happy-path test: 정상 hit(`{number:42, title:"t", body:"b"}`)와 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 입력 시 throw 없이 통과. 추가로 production 상수 자체가 파서 실제 산출 hit 와 정합임을 회귀-검증하는 test 1+(파서를 정상 stdout 으로 호출해 얻은 실 hit 를 본 가드에 통과시켜 상수↔파서 산출 정합 확인).
- [ ] Error path test: (a) `hit` 가 null/undefined/비객체 → `TypeError`, (b) `parseShapeKeys` 가 비배열/비-string 원소 포함 → `TypeError`, (c) `parseShapeKeys` 빈 배열 → `RangeError`.
- [ ] Flow / branch: 키 비교 분기마다 1+ test — (i) hit 에 parse-shape 키 누락(예: `{number, title}` 만, body 누락) → `RangeError`(누락 키 메시지), (ii) hit 에 잉여 키(예: `{number, title, body, author}`) → `RangeError`(잉여 키 메시지), (iii) 정확히 일치 → void.
- [ ] Negative cases 충분 cover — 각 1+ test: (a) 키 순서만 다르고 집합 동일 → 통과(set-equality 는 순서 무관), (b) parseShapeKeys 에 중복 키 → `RangeError`(중복 거부), (c) hit 의 키가 빈 문자열/공백 키를 포함 → `RangeError`, (d) 입력 hit 객체 비변형 확인(가드 호출 후 hit own keys/값 unchanged), (e) hit 키 집합과 parseShapeKeys 가 부분 교집합(일부 누락 + 일부 잉여 동시) → `RangeError`(누락·잉여 둘 다 보고 또는 fail-fast 우선순위 명시), (f) 대/소문자 차이 키(`Number` vs `number`) → 불일치 거부(대소문자 민감).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 helper line/branch/function 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 파서(`realdata-e2e-result-issue-search-parse.ts`) / `RealDataResultIssueSearchHit` interface(`realdata-e2e-result-issue-action.ts`) / 상수(`realdata-e2e-result-issue-search-json-fields.ts`) 본문 변경 — import·read 만. 신설 가드는 본 task 의 새 파일에서만.
- 신설 가드의 builder/파서 self-wire — 가드 신설만 한다. self-wire(파서 산출 직전 또는 호출부 배선)는 Follow-up(T-0658 self-wire 동형).
- json-fields request-side 가드(T-0657) 변경 — 본 task 는 그 parse-output consumer-side sibling 신설이지 기존 가드 수정 아님.
- live `gh search issues` execFile wiring / 실 네트워크 호출 — credential 게이트 deferred, 본 task 는 build-time 순수 가드만.
- 새 외부 dependency / Prisma migration / STATE schema 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 신설 가드의 self-wire(파서 또는 resolver 산출 경로 배선)는 다음 planner 가 T-0658 self-wire 동형으로 큐잉 후보. 이로써 search 경로의 세 정합 축 — argv↔commandArgs(T-0655/56)·--json↔parse-shape(T-0657/58)·parse-shape↔produced-hit(본 task) — 의 가드 신설이 모두 닫힌다.)
