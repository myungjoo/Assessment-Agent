---
id: T-1041
title: summary search-argv self-wire 두 가드 호출 순서(GhArgvPreserves→JsonFieldsMatchParseShape)를 invocationCallOrder 순서-lock test 로 못박기 (search-argv 축 요약축 mirror)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-argv.spec.ts
independentStream: realdata-e2e-summary-search-argv
plannerNote: "P5 test-hardening — search-argv 축 daily canonical(spec (d) 순서 보존 test 이미 존재) 후 요약축 mirror. summary leg invocationCallOrder 0건(실 gap 확인, grep 0). producer L142 GhArgvPreserves→L157 JsonFieldsMatchParseShape 두 distinct 가드. 기존 T-0656/T-0658 self-wire 블록이 각 배선만 볼 뿐 상대 순서 미lock. T-1035/T-1037/T-1040 daily→summary 선례. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1041 — summary search-argv self-wire 호출 순서(GhArgvPreserves→JsonFieldsMatchParseShape) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-assert 하는 2+ distinct 가드의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 두 축(daily canonical / summary mirror)에 걸쳐 정비해 왔다. command-args 축(daily / summary T-1033), descriptor 축(daily T-1034 / summary T-1035), outcome-report 축(daily T-1036 / summary T-1037), output-parse 축(daily T-0907 / summary T-1038), search-parse 축(daily T-1039 / summary T-1040)이 모두 완료됐다.

본 task 는 다음 축인 **search-argv 축의 요약축(result-issue) mirror** 다. daily leg 는 이미 canonical order-lock 을 보유한다 — `realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts` L619 `(d) 가드 순서 보존` test 가 `roundTripSpy.mock.invocationCallOrder[0] < jsonFieldsSpy.mock.invocationCallOrder[0]` 부등식으로 두 가드 상대 순서를 못박고 있다. 반면 요약축 producer `buildRealDataResultIssueSearchGhArgv` 는 두 distinct 가드를 순서대로 self-assert 하지만(L142 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs` = argv↔command-args 보존 가드, 1회 → L157 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape` = --json↔parse-shape 정합 가드, 1회 → L162 `return searchArgv`), 요약축 spec `realdata-e2e-result-issue-search-argv.spec.ts` 에는 **두 가드의 상대 호출 순서 lock 이 부재**하다(`invocationCallOrder` grep 0건).

기존 요약축 spec 의 self-wire 블록(T-0656 GhArgvPreserves 배선 L273~, T-0658 JsonFields 배선 L417~)에는 각 가드가 producer 산출 경로에 걸렸는지만 검증할 뿐, 두 가드의 self-wire 순서가 실수로 뒤바뀌어도(예: JsonFields 를 GhArgvPreserves 앞으로 이동) 현행 test 는 통과한다. 앞선 5개 축의 daily→summary mirror 선례대로 요약축 mirror 를 두는 흐름을 따른다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-argv.spec.ts` — 본 task 가 수정할 유일 파일(562줄). 두 self-wire describe 블록 확인: **T-0656 블록(L273~, GhArgvPreserves 가드 `searchArgvConsistency.assertRealDataResultIssueSearchGhArgvPreservesCommandArgs` self-wire)** 과 T-0658 블록(L417~ 끝, JsonFields 가드 `searchJsonFields.assertRealDataResultIssueSearchJsonFieldsMatchParseShape` self-wire). L489 `negative cases 충분 cover (a~d)` 블록에 이미 `roundTripSpy`(L529) + `jsonFieldsSpy`(L535) 두 spy 를 동시에 셋업하는 셋업이 있으니 그 패턴을 재사용해 순서-lock/fail-fast test 를 T-0658 블록 끝에 append. import alias(`searchArgvConsistency` L30, `searchJsonFields` L31)·producer import(L25~)는 이미 존재.
- `test/helpers/realdata-e2e-result-issue-search-argv.ts` — producer self-wire 지점 확인용(수정 금지). `buildRealDataResultIssueSearchGhArgv` 함수 내 L119 `assertSearchQueryNonBlank(searchQuery)` (입력 guard, self-assert 아님) → L142 `assertRealDataResultIssueSearchGhArgvPreservesCommandArgs(searchArgv, commandArgs)` (첫 self-assert, 1회) → L157 `assertRealDataResultIssueSearchJsonFieldsMatchParseShape(...)` (둘째 self-assert, 1회) → L162 `return searchArgv`.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv.spec.ts` (daily canonical) — mirror 대상. L619 `(d) 가드 순서 보존` test 가 append 한 순서-lock(`roundTripSpy.mock.invocationCallOrder[0]` 이 `jsonFieldsSpy.mock.invocationCallOrder[0]` 보다 작음, `toBeLessThan` 부등식, 둘 다 1회) 패턴을 요약축 심볼명으로 동형 mirror. 실 구현 pass-through spy 사용.

## Acceptance Criteria

- [ ] **순서-lock test 추가 (happy-path/flow)**: T-0658 self-wire describe 블록 끝에 두 가드의 상대 호출 순서를 못박는 test 1개 추가 — 두 가드(`assertRealDataResultIssueSearchGhArgvPreservesCommandArgs`, `assertRealDataResultIssueSearchJsonFieldsMatchParseShape`)를 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 producer 를 정상 입력으로 1회 호출한 뒤 `roundTripSpy.mock.invocationCallOrder[0]` 이 `jsonFieldsSpy.mock.invocationCallOrder[0]` 보다 **작음(GhArgvPreserves 먼저)** 을 `toBeLessThan` 부등식으로 검증(둘 다 `toHaveBeenCalledTimes(1)`, 기존 L489 블록의 spy 셋업 재사용, 배선 검증 → 순서 lock 으로 강화).
- [ ] **fail-fast test 추가 (error path/negative)**: 첫 가드(GhArgvPreserves)가 throw 하면 둘째 가드(JsonFields)가 **호출되지 않음(spy 0회)** 을 검증하는 test 1개 추가 — GhArgvPreserves 가드를 throw 하도록 mock 하고, producer 호출이 그 에러를 선전파(fail-fast)하며 JsonFields spy 가 `toHaveBeenCalledTimes(0)` 임을 assert.
- [ ] **branch/negative 보강**: 입력 guard 우선 분기 — 빈/공백 `searchQuery` 로 `assertSearchQueryNonBlank`(L119) 가 두 self-assert 가드 도달 전에 먼저 throw 하여 GhArgvPreserves spy·JsonFields spy 가 **모두 미호출(각 `toHaveBeenCalledTimes(0)`)** 임을 검증하는 test 1개 추가(guard 순서 보존, self-wire 추가가 입력 guard 우선순위를 깨지 않음을 못박음). 추가로 순서-lock test 는 실 구현 pass-through spy 이므로 산출 argv 배열이 순서-검증 전후 byte-identical(요소값·순서·개수 불변)임을 함께 재확인(production 무변경 회귀 0). 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-search-argv.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-search-argv.spec.ts` 가 1건 이상(이전 0건) — 순서-lock 실배선 확인.

## Out of Scope

- daily search-argv spec 의 순서-lock — 이미 canonical `(d) 가드 순서 보존` test 로 존재. 본 task 는 요약축 mirror 만.
- producer `.ts` 의 self-wire 호출 순서 **재정렬 / 정규화** — 현행 순서(GhArgvPreserves → JsonFields)를 lock 만 하고 바꾸지 않는다.
- 다른 축(search-json-fields 단독, publish-plan, gh-argv 등)의 순서-lock — 각자 별도 후속 task.
- 가드 로직·인자 순서·에러 정책 변경.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
