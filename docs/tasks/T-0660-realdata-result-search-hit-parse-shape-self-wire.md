---
id: T-0660
title: search-hit↔parse-shape set-equality 가드 producer self-wire (parseRealDataResultIssueSearchOutput)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-parse.ts
  - test/helpers/realdata-e2e-result-issue-search-parse.spec.ts
plannerNote: P5 PLAN 109행 step④ realdata-e2e stream — T-0659 신설 search-hit↔parse-shape 가드의 producer self-wire (T-0658 mirror)
---

# T-0660 — search-hit↔parse-shape set-equality 가드 producer self-wire

## Why

P5 PLAN 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(daily-test `step_eval` 결과 이슈 표면) build-time 정합 가드 사슬의 연속 slice. 직전 T-0659 가 `assertRealDataResultIssueSearchHitMatchesParseShape`(산출 hit 키 집합 ↔ `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` set-equality) 순수 가드를 **신설만** 했고 producer 산출 경로에는 미배선이다. 본 task 는 그 가드를 `parseRealDataResultIssueSearchOutput` 가 각 정규화 hit 을 반환하기 직전에 self-assert 하도록 배선해, 파서가 선언 shape 와 어긋난 hit 을 산출하면 production 시점에 fail-fast 하게 한다 (T-0658 의 builder self-wire 와 동형 — 가드-신설 → self-wire 2-slice 패턴).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — self-wire 대상 producer. `parseRealDataResultIssueSearchOutput(stdout): RealDataResultIssueSearchHit[]` 의 `parsed.map(...)` 정규화 반환 지점(L114~136). 각 원소를 `{number, title, body}` 로 정규화해 반환하는 그 자리가 self-assert 삽입 지점.
- `test/helpers/realdata-e2e-result-issue-search-hit-shape.ts` — import 원천. `assertRealDataResultIssueSearchHitMatchesParseShape(hit, parseShapeKeys)`(L191~) + re-export 된 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(L54). 가드 시그니처·throw 계약(구조 결손=TypeError / set 불일치=RangeError) 확인.
- `test/helpers/realdata-e2e-result-issue-search-parse.spec.ts` — colocated spec. self-wire 검증 case 를 append 할 위치. (이 파일이 R-112 4종 + negative 의 home — 신규 spec 파일 신설 금지, 기존 colocated 에 describe append.)
- 패턴 선례: `docs/tasks/T-0658-realdata-result-search-json-fields-self-wire.md` (직전 동형 self-wire task — import 1줄 + 호출 1지점, byte-identical 보존 룰).

## Acceptance Criteria

- [ ] `parseRealDataResultIssueSearchOutput` 의 정규화 반환 지점에서, 새로 만든 `{number, title, body}` 객체를 반환(push)하기 직전에 `assertRealDataResultIssueSearchHitMatchesParseShape(hit, REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 를 self-assert 호출하도록 배선한다 (import 1줄 + 호출 1지점). 가드가 void 반환 시 정상 hit 그대로 반환.
- [ ] 정상 입력에 대해 산출 hit 배열이 **byte-identical 보존** — self-wire 전후 `{number, title, body}` 정규화 결과·필드 순서·무공유 불변(추가 필드 drop, 새 객체) 그대로. self-assert 는 검증만 하고 출력을 변형하지 않음.
- [ ] **Happy-path unit test**: 정상 stdout(1건 이상 hit) → 산출 배열이 self-wire 전과 동일(`{number, title, body}`), self-assert 통과로 throw 0. `"[]"` → `[]` 정상.
- [ ] **Error path unit test**: producer 가 산출하려는 hit 이 선언 shape 와 어긋나는 상황을 가드가 catch 함을 검증 — 예: `jest.spyOn` 또는 가드 모듈을 통해 set 불일치(잉여/누락 키) hit 이 들어오면 가드가 RangeError throw 하여 producer 가 손상 hit 을 반환하기 전에 fail-fast. (정상 파서 경로에서는 정규화가 항상 `{number,title,body}` 만 산출하므로, 가드 호출이 실제로 매 hit 마다 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 로 일어남을 spy 로 확인.)
- [ ] **Flow / branch cover**: producer 의 기존 분기(비배열 throw / 비객체 원소 throw / number·title·body 검증 throw)는 self-wire 전후 동일하게 동작해야 함 — 각 분기 회귀 test 1+ (self-assert 가 그 분기 도달 전에 끼어들지 않음 — 정규화 후에만 호출됨을 검증).
- [ ] **Negative cases 충분 cover** — (a) 다건 hit 모두에 대해 가드가 각각 호출됨(매 원소 self-assert), (b) 빈 배열일 때 가드 미호출(반복 0), (c) producer 의 기존 number 누락·title 비문자열·body 누락 throw 가 가드 도달 전에 발생(검증 순서 보존), (d) self-assert 가 정상 hit 에 대해 throw 0, (e) 입력 stdout 비변형(순수성 보존) 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경한 `realdata-e2e-result-issue-search-parse.ts` 의 line/branch/function 100% 유지.
- [ ] `pnpm lint && pnpm build` 통과. import 추가로 인한 runtime cycle 0 (`type-only` 가 아닌 값 import 이므로 import graph 가 cycle 을 만들지 않는지 tsc green 으로 확인).

## Out of Scope

- 가드 함수 본문(`assertRealDataResultIssueSearchHitMatchesParseShape`) 또는 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` 상수 수정 — 본 task 는 **배선만**, 가드/상수는 T-0657/T-0659 산출물 그대로 사용.
- 신규 helper/spec 파일 신설 — 기존 2 파일(`search-parse.ts` + colocated spec)만 변경.
- `parseRealDataResultIssueSearchOutput` 의 정규화 로직·필드 집합·검증 순서 변경.
- 다른 realdata-e2e seam(descriptor/command-args/gh-argv/json-fields)의 추가 가드 — 본 chain 의 search-hit↔parse-shape seam self-wire 1건만.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 가드만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
