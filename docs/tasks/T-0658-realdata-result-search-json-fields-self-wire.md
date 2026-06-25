---
id: T-0658
title: buildRealDataResultIssueSearchGhArgv 산출 직전 search --json 필드↔parse-shape 정합 가드 self-wire
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ realdata-e2e stream — T-0657 신설 json-fields 정합 가드의 builder self-wire (T-0656 search-argv self-wire 의 sibling), T-0657 Follow-up ①"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-argv.ts
  - test/helpers/realdata-e2e-result-issue-search-argv.spec.ts
---

# T-0658 — buildRealDataResultIssueSearchGhArgv 산출 직전 search --json 필드↔parse-shape 정합 가드 self-wire

## Why

T-0657 이 신설한 순수 가드 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape`(search argv 의 `--json` 요청 필드 집합 ↔ search-parse 추출 shape 키 집합 set-equality 정합)는 현재 신설만 됐고 산출 경로에 미배선이다. 본 task 는 `buildRealDataResultIssueSearchGhArgv`(`test/helpers/realdata-e2e-result-issue-search-argv.ts`)가 argv 를 반환하기 직전에 이 가드를 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 로 self-assert 배선해, `--json` 요청 필드가 parse-shape 와 어긋나게 회귀하면 손상 argv 를 caller 에 반환하기 전에 fail-fast throw 하도록 닫는다. T-0656(search argv↔commandArgs round-trip 가드 builder self-wire)의 sibling 이자 T-0657 Follow-up ①. PLAN 109행 step④ realdata-e2e 표현/발행 surface 무결성 chain 의 연속 slice.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — 본 task 가 self-wire 를 추가할 빌더 `buildRealDataResultIssueSearchGhArgv`(line 110~144). 현재 반환 직전에 `assertSearchQueryNonBlank`(line 115) + `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs`(line 138, T-0656 self-wire) 호출 중. `REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS`(line 76) 가 본 모듈에 이미 export 돼 있어 self-wire 시 import 없이 그대로 인자로 사용 가능.
- `test/helpers/realdata-e2e-result-issue-search-json-fields.ts` — self-wire 할 가드 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(requestedFields, parseShapeKeys)`(line 188~) 와 단일 출처 상수 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(line 70). 본 task 에서 이 둘을 import 만 하고 본문은 변경하지 않는다.
- `test/helpers/realdata-e2e-result-issue-search-argv.spec.ts` — 빌더 colocated spec. self-wire describe 블록을 append 한다.
- `docs/tasks/T-0656-realdata-result-search-argv-consistency-self-wire.md` — 동형 self-wire 패턴 선례(같은 빌더에 round-trip 가드 배선). 본 task 는 그 json-fields-side sibling — 동일 빌더에 두 번째 self-assert 추가.

## Acceptance Criteria

- [ ] `buildRealDataResultIssueSearchGhArgv` 가 argv 배열을 반환하기 직전에 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` self-assert 호출 1지점 배선(기존 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs` self-assert 직후 또는 직전, return 이전). `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS` import 1줄 추가(`REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS` 는 동일 모듈 상수라 import 불요). 빌더의 argv 합성 로직·상수·반환 형태는 변경 0(byte-identical argv 보존).
- [ ] type-only/함수 import 라 runtime import cycle 0 — `pnpm build`(tsc) green 으로 확인.
- [ ] Happy-path test: 정상 commandArgs 입력 시 빌더가 정합 argv 를 반환하고 self-assert 가 throw 없이 통과함을 검증(기존 happy-path 회귀 무영향 — 두 production 상수가 현재 정합이므로 빌더 정상 동작).
- [ ] Self-wire 검증 test: 빌더 호출 시 가드가 실제로 호출됨을 `jest.spyOn(jsonFieldsModule, "assertRealDataResultIssueSearchJsonFieldsMatchParseShape")` 로 확인 — 인자가 `(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS, REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS)` 임을 검증.
- [ ] Error path test: searchQuery 가 빈/공백인 입력에 대해 빌더가 기존 `assertSearchQueryNonBlank` 경로로 fail-fast throw 함을 검증(json-fields self-wire 추가가 기존 guard 순서·회귀에 무영향).
- [ ] Negative cases 충분 cover — 각 1+ test: (a) json-fields 가드를 spy 로 강제 throw 시켜 빌더가 손상 argv 를 반환하지 않고 그 에러를 propagate 함, (b) self-wire 추가 후에도 입력 commandArgs 비변형(빌더 호출 후 입력 객체 unchanged), (c) 반환 argv 가 매 호출 새 배열(반환값 mutate 가 후속 호출에 누설 안 됨), (d) 두 self-assert(round-trip 가드 + json-fields 가드)가 모두 호출되며 둘 중 어느 하나라도 throw 하면 argv 미반환임을 검증.
- [ ] 분기: 본 self-wire 는 단일 반환 지점(search 빌더는 create/update 분기 없음) — "create/update 분기 없음 — 분기별 self-wire 항목 생략" 명시.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 빌더 파일 line/branch/function 100% 유지.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 가드 본문(`realdata-e2e-result-issue-search-json-fields.ts`) 변경 — import 만, 로직·상수 수정 금지.
- search-parse(`realdata-e2e-result-issue-search-parse.ts`) / `RealDataResultIssueSearchHit` interface 변경 — self-wire 는 argv 빌더 측에서만.
- 다른 빌더(create/edit argv, command-args, descriptor)의 self-wire — 이미 완결.
- live `gh search issues` execFile wiring / 실 네트워크 호출 — credential 게이트 deferred, 본 task 는 build-time 순수 self-wire 만.
- 새 외부 dependency / Prisma migration / STATE schema 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — search 경로의 argv↔commandArgs(T-0655/T-0656)와 --json↔parse-shape(T-0657/본 task) 두 정합 가드가 모두 신설+self-wire 로 닫힘. 후속은 planner 가 PLAN 109행 step④ 의 다음 미커버 surface 를 선정.)
