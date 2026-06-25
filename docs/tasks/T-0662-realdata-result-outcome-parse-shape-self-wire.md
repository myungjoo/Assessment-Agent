---
id: T-0662
title: outcome↔parse-shape set-equality 가드 producer self-wire (parseRealDataResultIssueCreateEditOutput)
phase: P5
status: DONE
commitMode: pr
prNumber: 576
mergedAs: 9d35cc1d29af33db3d198d17c931d41a219e7ec8
reviewRounds: 1
coversReq: [REQ-030, REQ-059]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-output-parse.ts
  - test/helpers/realdata-e2e-result-issue-output-parse.spec.ts
plannerNote: P5 PLAN 109행 step④ realdata-e2e stream — T-0661 신설 outcome↔parse-shape 가드의 producer self-wire (T-0660 mirror)
---

# T-0662 — outcome↔parse-shape set-equality 가드 producer self-wire

## Why

P5 PLAN 109행 🟢 "실 평가 e2e = github.com 공개 활동" bullet 의 step④(daily-test `step_eval` 결과 이슈 표면) build-time 정합 가드 사슬의 연속 slice. 직전 T-0661 이 `assertRealDataResultIssueOutcomeMatchesParseShape`(산출 outcome 키 집합 ↔ `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` set-equality) 순수 가드를 **신설만** 했고 producer 산출 경로에는 미배선이다. 본 task 는 그 가드를 `parseRealDataResultIssueCreateEditOutput` 가 정규화 outcome 을 반환하기 직전에 self-assert 하도록 배선해, 파서가 선언 shape 와 어긋난 outcome 을 산출하면 production 시점에 fail-fast 하게 한다 (T-0660 의 search-hit producer self-wire 와 동형 — 가드-신설 → self-wire 2-slice 패턴, post-execution side mirror).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-output-parse.ts` — self-wire 대상 producer. `parseRealDataResultIssueCreateEditOutput(stdout): RealDataResultIssueOutcome` 의 단일 반환 지점(L114~117, `return { issueNumber, url: match[0].trim() }`). 그 객체를 반환하기 직전이 self-assert 삽입 지점.
- `test/helpers/realdata-e2e-result-issue-outcome-parse-shape.ts` — import 원천. `assertRealDataResultIssueOutcomeMatchesParseShape(outcome, parseShapeKeys)`(L210~) + `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS = ["issueNumber","url"]`(L67~). 가드 시그니처·throw 계약(구조 결손=TypeError / set 불일치=RangeError) 확인. (search 측과 달리 본 상수는 본 모듈에서 정의·export — re-export 아님.)
- `test/helpers/realdata-e2e-result-issue-output-parse.spec.ts` — colocated spec. self-wire 검증 case 를 append 할 위치. (R-112 4종 + negative 의 home — 신규 spec 파일 신설 금지, 기존 colocated 에 describe append.)
- 패턴 선례: `docs/tasks/T-0660-realdata-result-search-hit-parse-shape-self-wire.md` (직전 동형 producer self-wire task — import 1줄 + 호출 1지점, byte-identical 보존 룰).

## Acceptance Criteria

- [ ] `parseRealDataResultIssueCreateEditOutput` 의 단일 반환 지점에서, `{ issueNumber, url }` 객체를 반환하기 직전에 `assertRealDataResultIssueOutcomeMatchesParseShape(outcome, REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS)` 를 self-assert 호출하도록 배선한다 (import 1줄 + 호출 1지점). 가드가 void 반환 시 정상 outcome 그대로 반환. (반환 객체를 먼저 const 로 묶어 가드에 넘긴 뒤 그 변수를 반환하는 형태 권장 — 매직 객체 두 번 생성 금지.)
- [ ] 정상 입력에 대해 산출 outcome 이 **byte-identical 보존** — self-wire 전후 `{ issueNumber, url }` 필드 값·순서·무공유(새 객체) 그대로. self-assert 는 검증만 하고 출력을 변형하지 않음.
- [ ] **Happy-path unit test**: 정상 stdout(유효 issue URL 1건) → 산출 outcome 이 self-wire 전과 동일(`{ issueNumber, url }`), self-assert 통과로 throw 0.
- [ ] **Error path unit test**: producer 가 산출하려는 outcome 이 선언 shape 와 어긋나는 상황을 가드가 catch 함을 검증 — `jest.spyOn`(가드 모듈 또는 호출 spy)으로 set 불일치(잉여/누락 키) outcome 이 가드에 들어오면 RangeError throw 하여 producer 가 손상 outcome 을 반환하기 전에 fail-fast 함을 확인. (정상 파서 경로는 항상 `{issueNumber,url}` 만 산출하므로, 가드 호출이 실제로 `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 인자로 일어남을 spy 로 확인.)
- [ ] **Flow / branch cover**: producer 의 기존 분기(URL 미매칭 throw / issueNumber 비양정수 throw)는 self-wire 전후 동일하게 동작 — 각 분기 회귀 test 1+ (self-assert 가 그 분기 도달 전에 끼어들지 않음 — 정규화/검증 완료 후에만 호출됨을 검증).
- [ ] **Negative cases 충분 cover** — (a) URL 미발견(빈/공백/비-github 호스트/`/pull/` 경로) → 가드 도달 전 기존 throw, (b) issueNumber 0·선행 0·비정수 → 가드 도달 전 기존 throw, (c) 정상 outcome 에 대해 가드 throw 0, (d) self-assert 가 매 정상 호출마다 `["issueNumber","url"]` 로 일어남(spy), (e) 입력 stdout 비변형(순수성 보존) 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%). 변경한 `realdata-e2e-result-issue-output-parse.ts` 의 line/branch/function 100% 유지.
- [ ] `pnpm lint && pnpm build` 통과. import 추가로 인한 runtime cycle 0 (값 import 이므로 import graph 가 cycle 을 만들지 않는지 tsc green 으로 확인).

## Out of Scope

- 가드 함수 본문(`assertRealDataResultIssueOutcomeMatchesParseShape`) 또는 `REAL_DATA_RESULT_ISSUE_OUTCOME_PARSE_SHAPE_KEYS` 상수 수정 — 본 task 는 **배선만**, 가드/상수는 T-0661 산출물 그대로 사용.
- 신규 helper/spec 파일 신설 — 기존 2 파일(`output-parse.ts` + colocated spec)만 변경.
- `parseRealDataResultIssueCreateEditOutput` 의 URL 매칭·issueNumber 검증·정규화 로직·필드 집합·검증 순서 변경.
- 다른 realdata-e2e seam(search-hit/descriptor/command-args/gh-argv/json-fields)의 추가 가드 또는 self-wire — 본 chain 의 outcome↔parse-shape seam producer self-wire 1건만.
- live execFile / gh 실호출 wiring — credential 게이트 deferred, build-time 순수 가드만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
