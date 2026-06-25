---
id: T-0656
title: buildRealDataResultIssueSearchGhArgv 산출 직전 search argv↔commandArgs round-trip 가드 self-wire
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-argv.ts
  - test/helpers/realdata-e2e-result-issue-search-argv.spec.ts
plannerNote: "P5 PLAN 109행 step④ realdata-e2e stream — T-0655 search argv 가드 신설의 builder self-wire (T-0654 argv-side self-wire 의 search-side mirror), T-0655 Follow-up ①"
---

# T-0656 — buildRealDataResultIssueSearchGhArgv 산출 직전 search argv↔commandArgs round-trip 가드 self-wire

## Why

T-0655 가 신설한 순수 가드 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs`(search argv↔searchQuery round-trip 정합 — 동사 prefix·`--match body`·searchQuery 위치·`--json` 필드·`--limit` 정합)는 현재 신설만 됐고 산출 경로에 미배선이다. 본 task 는 `buildRealDataResultIssueSearchGhArgv` 가 argv 를 반환하기 직전에 이 가드를 self-assert 로 배선해, search-argv 합성이 회귀하면 손상 argv 를 caller 에 반환하기 전에 fail-fast throw 하도록 닫는다. T-0654(create/edit argv 가드 builder self-wire)의 search-side mirror 이자 T-0655 Follow-up ①. PLAN 109행 step④ realdata-e2e 표현/발행 surface 무결성 chain 의 연속 slice.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — 본 task 가 self-wire 를 추가할 빌더(`buildRealDataResultIssueSearchGhArgv`, line 109~128). 현재 반환 직전에 `assertSearchQueryNonBlank` 만 호출 중.
- `test/helpers/realdata-e2e-result-issue-search-argv-consistency.ts` — self-wire 할 가드 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(argv, commandArgs)`(line 164~) export. 본 task 에서 import 만 하고 본문은 변경하지 않는다.
- `test/helpers/realdata-e2e-result-issue-search-argv.spec.ts` — 빌더 colocated spec. self-wire describe 블록을 append 한다.
- `docs/tasks/T-0654-realdata-result-issue-gh-argv-command-args-self-wire.md` — 동형 self-wire 패턴 선례(argv-side). 본 task 는 그 search-side mirror.

## Acceptance Criteria

- [ ] `buildRealDataResultIssueSearchGhArgv` 가 argv 배열을 반환하기 직전에 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs)` self-assert 호출 1지점 배선. import 1줄 추가. 빌더의 argv 합성 로직·상수·반환 형태는 변경 0(byte-identical argv 보존).
- [ ] type-only/함수 import 라 runtime import cycle 0 — `pnpm build`(tsc) green 으로 확인.
- [ ] Happy-path test: 정상 commandArgs 입력 시 빌더가 정합 argv 를 반환하고 self-assert 가 throw 없이 통과함을 검증(기존 happy-path 회귀 무영향 포함).
- [ ] Self-wire 검증 test: 빌더 호출 시 가드가 실제로 호출됨을 `jest.spyOn(consistencyModule, "assertRealDataResultIssueSearchGhArgvPreservesCommandArgs")` 로 확인 — 인자가 `(반환 argv, 입력 commandArgs)` 임을 검증.
- [ ] Error path test: searchQuery 가 빈/공백인 입력에 대해 빌더가 fail-fast throw 함을 검증(기존 `assertSearchQueryNonBlank` 경로 회귀 무영향).
- [ ] Negative cases 충분 cover — 각 1+ test: (a) searchQuery 빈 문자열, (b) searchQuery 공백-only, (c) self-assert 가 RangeError 를 throw 하는 시나리오(가드를 spy 로 강제 throw 시켜 빌더가 손상 argv 를 반환하지 않고 propagate 함), (d) 입력 commandArgs 비변형(빌더 호출 후 입력 객체 unchanged), (e) 반환 argv 가 매 호출 새 배열(반환값 mutate 가 후속 호출에 누설 안 됨).
- [ ] 분기: 본 self-wire 는 단일 반환 지점(search 빌더는 create/update 분기 없음) — "create/update 분기 없음 — 분기별 self-wire 항목 생략" 명시.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 빌더 파일 line/branch/function 100% 유지.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- 가드 본문(`realdata-e2e-result-issue-search-argv-consistency.ts`) 변경 — import 만, 로직 수정 금지.
- 다른 빌더(create/edit argv `buildRealDataResultIssueGhArgv`, command-args, descriptor)의 self-wire — 이미 T-0654/T-0650/T-0652 에서 완결.
- live `gh search issues` execFile wiring / 실 네트워크 호출 — credential 게이트 deferred, 본 task 는 build-time 순수 self-wire 만.
- search-parse / publish-plan 등 downstream layer 변경.
- 새 외부 dependency / Prisma migration / STATE schema 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — search-argv layer 의 신설(T-0655)+self-wire(본 task)로 가드 chain 닫힘. 후속은 planner 가 PLAN 109행 step④ 의 다음 미커버 surface 를 선정.)

## Result (DONE)

- 완료: 2026-06-25T06:18:41Z (KST 15:18)
- PR #570 squash merge `ad65416` — reviewer round1 APPROVE, 4-게이트 PASS, 외부 PR comment 존재, CI green(양 job, no rerun).
- 변경: test-only 2 파일 +162/-1. buildRealDataResultIssueSearchGhArgv 산출 argv 반환 직전 assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs) self-assert 1지점 배선 + import 1줄. 빌더 단일 반환 지점 → create/update 분기 없음. argv byte-identical 보존.
- 검증: 변경 빌더 파일 line/branch/function 100%, 전역 threshold ok. pnpm lint/build/test green (321 suites / 7683 tests).
