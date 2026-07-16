---
id: T-1040
title: summary search-parse self-wire 두 가드 호출 순서(hit-shape→OutputConsistent)를 invocationCallOrder 순서-lock test 로 못박기 (search-parse 축 요약축 mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 64
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-search-parse.spec.ts
independentStream: realdata-e2e-summary-search-parse
plannerNote: "P5 test-hardening — search-parse 축 daily canonical(T-1039) 후 요약축 mirror. summary leg 순서-lock 0건(실 gap 확인). producer L158 hit-shape(per-hit)→L173 OutputConsistent 두 distinct 가드. 기존 T-0660/T-0722 블록이 각 가드 배선만 볼 뿐 상대 순서 미lock. T-1035/T-1037 선례대로 daily→summary mirror. pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1040 — summary search-parse self-wire 호출 순서(hit-shape→OutputConsistent) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-assert 하는 2+ distinct 가드의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 두 축(daily canonical / summary mirror)에 걸쳐 정비해 왔다. command-args 축(daily / summary T-1033), descriptor 축(daily T-1034 / summary T-1035), outcome-report 축(daily T-1036 / summary T-1037), output-parse 축(daily T-0907 / summary T-1038)이 모두 완료됐고, 직전 T-1039 가 **search-parse 축 daily canonical** 을 신설했다.

본 task 는 그 search-parse 축의 **요약축(result-issue) mirror** 다. producer `parseRealDataResultIssueSearchOutput` 은 두 distinct 가드를 순서대로 self-assert 한다: `map` 콜백 안 L158 `assertRealDataResultIssueSearchHitMatchesParseShape` = per-hit 키 집합 정합 가드(각 정규화 hit 마다 1회, 첫 hit 이 최초 호출) → map 종료 후 L173 `assertRealDataResultIssueSearchOutputConsistentWithStdout` = whole-array 값-정합 가드(1회) → L175 `return hits`. 정상 경로에서 첫 hit-shape 호출이 OutputConsistent 호출보다 **먼저** 일어난다.

그런데 spec `realdata-e2e-result-issue-search-parse.spec.ts` 의 self-wire 블록(T-0660 hit-shape 배선, T-0722 값-정합 배선)에는 각 가드가 producer 산출 경로에 걸렸는지만 검증할 뿐 **두 가드의 상대 호출 순서 lock 이 부재**하다(`invocationCallOrder` grep 0건). 두 가드의 self-wire 순서가 실수로 뒤바뀌어도(예: OutputConsistent 를 map 앞으로 이동) 현행 test 는 통과한다. 앞선 descriptor(T-1034 daily → T-1035 summary), outcome-report(T-1036 daily → T-1037 summary), output-parse(T-0907 daily → T-1038 summary) 선례대로 **daily canonical(T-1039) 신설 후 요약축 mirror** 를 두는 흐름을 따른다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-search-parse.spec.ts` — 본 task 가 수정할 유일 파일(504줄). 두 self-wire describe 블록 확인: **T-0660 블록(L242~, hit-shape 가드 `hitShapeModule.assertRealDataResultIssueSearchHitMatchesParseShape` per-hit self-wire)** 과 T-0722 블록(L365~ 끝, 값-정합 가드 `searchParseConsistencyModule.assertRealDataResultIssueSearchOutputConsistentWithStdout` self-wire). 두 블록의 `jest.spyOn` 셋업을 재사용해 순서-lock/fail-fast test 를 마지막 self-wire 블록(T-0722, L365~504) 끝에 append. import alias(`hitShapeModule` L15, `searchParseConsistencyModule` L21)·상수 `REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS`(L16)·producer import(`parseRealDataResultIssueSearchOutput` L20)는 이미 존재.
- `test/helpers/realdata-e2e-result-issue-search-parse.ts` — producer self-wire 지점 확인용(수정 금지). `parseRealDataResultIssueSearchOutput` 함수 내 L132 `parsed.map(...)` 콜백 안 L158 `assertRealDataResultIssueSearchHitMatchesParseShape(...)` (per-hit 첫 호출) → map 종료 후 L173 `assertRealDataResultIssueSearchOutputConsistentWithStdout(hits, stdout)` (둘째 호출) → L175 `return hits`.
- `docs/tasks/T-1039-daily-search-parse-order-lock.md` 및 daily search-parse spec `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-parse.spec.ts` (직전 canonical) — mirror 대상. daily 가 append 한 순서-lock(`hitShapeSpy.mock.invocationCallOrder[0] < consistencySpy.mock.invocationCallOrder[0]` `toBeLessThan` 부등식) + fail-fast(첫 가드 throw → 둘째 가드 0회) 패턴을 요약축 심볼명으로 동형 mirror. 실 구현 pass-through spy 사용.

## Acceptance Criteria

- [ ] **순서-lock test 추가 (happy-path/flow)**: T-0722 self-wire describe 블록 끝에 두 가드의 상대 호출 순서를 못박는 test 1개 추가 — 두 가드(`assertRealDataResultIssueSearchHitMatchesParseShape`, `assertRealDataResultIssueSearchOutputConsistentWithStdout`)를 각각 실 구현 pass-through `jest.spyOn` 으로 감싸고 producer 를 정상 stdout(hit ≥ 1건)으로 1회 호출한 뒤 `hitShapeSpy.mock.invocationCallOrder[0]` 이 `consistencySpy.mock.invocationCallOrder[0]` 보다 **작음(hit-shape 먼저)** 을 `toBeLessThan` 부등식으로 검증(기존 두 블록의 spy 셋업 재사용, 배선 검증 → 순서 lock 으로 강화).
- [ ] **fail-fast test 추가 (error path/negative)**: 첫 가드(hit-shape)가 throw 하면 둘째 가드(OutputConsistent)가 **호출되지 않음(spy 0회)** 을 검증하는 test 1개 추가 — hit-shape 가드를 첫 hit 에서 throw 하도록 mock 하고, producer 호출이 그 에러를 선전파(fail-fast, map 도중 throw)하며 OutputConsistent spy 가 `toHaveBeenCalledTimes(0)` 임을 assert.
- [ ] **branch/negative 보강**: 위 순서-lock test 는 실 구현 pass-through spy 이므로 산출 hits 배열이 self-wire 순서-검증 전후 byte-identical(`{number, title, body}` 필드값·키 순서·개수 불변)임을 함께 재확인(production 무변경 회귀 0). 추가로 빈 배열(`"[]"`) 입력 시 map 미진입으로 두 가드 모두 미호출(순서 부등식 성립 불가 분기)임을 경계값으로 명시하는 test 1개 — invocationCallOrder 접근 없이 `toHaveBeenCalledTimes(0)` 로 확인. 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-issue-search-parse.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-issue-search-parse.spec.ts` 가 1건 이상(이전 0건) — 순서-lock 실배선 확인.

## Out of Scope

- daily search-parse spec 의 순서-lock — 이미 T-1039 에서 신설 완료. 본 task 는 요약축 mirror 만.
- producer `.ts` 의 self-wire 호출 순서 **재정렬 / 정규화** — 현행 순서(hit-shape per-hit → OutputConsistent)를 lock 만 하고 바꾸지 않는다.
- 다른 축(search-argv, search-json-fields, publish-plan, gh-argv 등)의 순서-lock — 각자 별도 후속 task.
- 가드 로직·인자 순서·에러 정책 변경.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
