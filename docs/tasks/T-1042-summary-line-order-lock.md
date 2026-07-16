---
id: T-1042
title: result-summary-line formatter self-wire 두 가드 호출 순서(FormatShape→ConsistentWithSummary)를 invocationCallOrder 순서-lock test 로 못박기 (result-summary 축 canonical)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 65
estimatedFiles: 1
created: 2026-07-17
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-line.spec.ts
independentStream: realdata-e2e-result-summary-line
plannerNote: "P5 test-hardening — result-issue/daily-issue 6 축 order-lock(T-1033~T-1041) 완료 후 result-summary 패밀리로 확장. formatRealDataResultSummaryLine 이 L148 FormatShape→L163 ConsistentWithSummary 두 distinct 가드 self-wire 하나 spec invocationCallOrder 0건(실 gap, 기존 ④ test 는 공존만 assert 상대순서 미lock). pr test-only 1파일 file-disjoint dep[] stage5b 병렬-claimable."
---

# T-1042 — result-summary-line formatter self-wire 호출 순서(FormatShape→ConsistentWithSummary) invocationCallOrder 순서-lock test 추가

## Why

P5 test-hardening sweep 은 producer 가 자기 return 경로에서 self-assert 하는 2+ distinct 가드의 **상대 호출 순서**를 `invocationCallOrder` 부등식으로 못박아 silent 재정렬 회귀를 감지하는 defense-in-depth 를 정비해 왔다. result-issue / daily-issue 6 축(command-args T-1033, descriptor T-1034/T-1035, outcome-report T-1036/T-1037, output-parse T-0907/T-1038, search-parse T-1039/T-1040, search-argv T-1041)이 모두 daily canonical + summary mirror 두 leg 완료됐다.

본 task 는 그 sweep 을 **result-summary 패밀리로 확장**하는 첫 축이다. 인벤토리 감사 결과 result-issue/daily-issue 축 밖에서 2 distinct self-wire 가드를 보유하면서 순서-lock 이 부재한 producer 는 `formatRealDataResultSummaryLine`(result-summary-line) 과 `buildRealDataResultReportPlan`(result-report-plan) 두 개다. 이 중 leaf-level formatter 인 `formatRealDataResultSummaryLine` 을 canonical 로 먼저 못박는다.

`formatRealDataResultSummaryLine` 는 라인 합성 후 반환 직전 두 distinct 가드를 순서대로 self-assert 한다 — L148 `assertRealDataResultSummaryLineFormatShape(line)`(형태 불변식 가드: string·개행 0·prefix·토큰·슬롯 형태) → L163 `assertRealDataResultSummaryLineConsistentWithSummary(line, summary)`(값-정합 가드: count/volume·난이도/기여도 슬롯 값·순서·prefix 를 summary 필드로 독립 재합성한 라인과 byte-identical 대조) → L165 `return line`. 그러나 spec `realdata-e2e-result-summary-line.spec.ts` 에는 **두 가드의 상대 호출 순서 lock 이 부재**하다(`invocationCallOrder` grep 0건). 기존 self-wire 검증(④ L453~476)은 두 가드가 각각 1회씩 호출됨(공존)만 assert 할 뿐, 형태 가드와 값 가드의 self-wire 순서가 실수로 뒤바뀌어도(예: 값 가드를 형태 가드 앞으로 이동) 현행 test 는 통과한다. 앞선 6 축 order-lock 선례대로 순서 부등식을 못박는다. production 무변경, test-only 1파일.

## Required Reading

- `test/helpers/realdata-e2e-result-summary-line.spec.ts` — 본 task 가 수정할 유일 파일(548줄). 두 self-wire describe 블록 확인: **T-0644 형태 가드 self-배선 블록(L304~)** + **T-0712 값-정합 가드 self-wire 블록(L397~)**. 특히 L453 `④ 형태 가드 다음·값 가드 둘 다 호출 경로에 있음` test 가 이미 `shapeSpy`(`formatShapeModule`, L455) + `valueSpy`(`lineConsistencyModule`, L459) 두 spy 를 동시에 셋업해 각 `toHaveBeenCalledTimes(1)` 을 assert 한다 — 그 dual-spy 셋업을 재사용해 순서-lock/fail-fast test 를 T-0712 블록 끝(④ 다음)에 append. namespace import alias 는 이미 존재: `formatShapeModule`(L29 = `./realdata-e2e-result-summary-line-format-shape`), `lineConsistencyModule`(L28 = `./realdata-e2e-result-summary-line-consistency`).
- `test/helpers/realdata-e2e-result-summary-line.ts` — producer self-wire 지점 확인용(수정 금지). `formatRealDataResultSummaryLine` 함수 내 L108~L122 입력 guard(null/undefined summary·byDifficulty·byContribution → TypeError) → L135 라인 합성 → L148 `assertRealDataResultSummaryLineFormatShape(line)`(첫 self-assert) → L159~163 lazy `require("./realdata-e2e-result-summary-line-consistency")` 후 `assertRealDataResultSummaryLineConsistentWithSummary(line, summary)`(둘째 self-assert) → L165 `return line`. ⚠️ 값-정합 가드는 순환 의존 회피용 **lazy require** 로 로드되지만, spec 의 `lineConsistencyModule` namespace import 는 동일 require 캐시 객체를 가리켜 `jest.spyOn` 이 컴포저 호출을 가로챈다(spec L26~28·L394~397 이 이미 문서화·검증).
- `test/helpers/realdata-e2e-result-issue-search-argv.spec.ts` (T-1041 선례) — 동일 순서-lock/fail-fast 패턴의 최근 mirror 참조. 두 가드를 실 구현 pass-through `jest.spyOn` 으로 감싸고 `roundTripSpy.mock.invocationCallOrder[0]` 이 다른 spy 의 `invocationCallOrder[0]` 보다 작음을 `toBeLessThan` 으로 검증 + 첫 가드 throw → 둘째 가드 0회 fail-fast + 입력 guard 우선 분기(둘 다 0회) 3종 구조를 result-summary-line 심볼명으로 동형 적용.

## Acceptance Criteria

- [ ] **순서-lock test 추가 (happy-path/flow)**: T-0712 값-정합 가드 self-wire describe 블록 끝(④ 다음)에 두 가드의 상대 호출 순서를 못박는 test 1개 추가 — 두 가드(`assertRealDataResultSummaryLineFormatShape`, `assertRealDataResultSummaryLineConsistentWithSummary`)를 각각 실 구현 pass-through `jest.spyOn`(형태 가드는 `formatShapeModule`, 값 가드는 `lineConsistencyModule`)으로 감싸고 formatter 를 정상 summary 로 1회 호출한 뒤 `shapeSpy.mock.invocationCallOrder[0]` 이 `valueSpy.mock.invocationCallOrder[0]` 보다 **작음(FormatShape 먼저)** 을 `toBeLessThan` 부등식으로 검증(둘 다 `toHaveBeenCalledTimes(1)`, 기존 ④ 블록의 dual-spy 셋업 재사용, 공존 검증 → 순서 lock 으로 강화).
- [ ] **fail-fast test 추가 (error path/negative)**: 첫 가드(FormatShape)가 throw 하면 둘째 가드(ConsistentWithSummary)가 **호출되지 않음(spy 0회)** 을 검증하는 test 1개 추가 — FormatShape 가드를 throw 하도록 mock 하고, formatter 호출이 그 에러를 선전파(fail-fast)하며 값-정합 spy 가 `toHaveBeenCalledTimes(0)` 임을 assert.
- [ ] **branch/negative 보강**: 입력 guard 우선 분기 — null(또는 byContribution 누락) `summary` 로 L108~122 입력 guard 가 두 self-assert 가드 도달 전에 먼저 TypeError throw 하여 FormatShape spy·ConsistentWithSummary spy 가 **모두 미호출(각 `toHaveBeenCalledTimes(0)`)** 임을 검증하는 test 1개 추가(guard 순서 보존, self-wire 가 입력 guard 우선순위를 깨지 않음을 못박음 — 기존 ⑦ 은 값 가드만 0 을 assert 하므로 두 가드 동시 0 을 명시). 추가로 순서-lock test 는 실 구현 pass-through spy 이므로 산출 라인이 순서-검증 전후 byte-identical(문자열 동일)임을 함께 재확인(production 무변경 회귀 0). 분기 추가 없음(production 코드 무변경, test-only).
- [ ] **production 무변경 확인**: `test/helpers/realdata-e2e-result-summary-line.ts` 및 여타 producer/guard/src 파일 diff 0. 오직 spec 1파일만 변경.
- [ ] `pnpm test` (또는 realdata suite) green — 신규 test 통과 + 전체 suite 무회귀.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 추가라 coverage 영향 무회귀.
- [ ] `git grep invocationCallOrder test/helpers/realdata-e2e-result-summary-line.spec.ts` 가 1건 이상(이전 0건) — 순서-lock 실배선 확인.

## Out of Scope

- `buildRealDataResultReportPlan`(result-report-plan) 의 순서-lock — result-summary 패밀리의 두 번째 2-가드 producer(order=0). 본 task 완료 후 별도 후속 task(Follow-ups 참조).
- producer `.ts` 의 self-wire 호출 순서 **재정렬 / 정규화** — 현행 순서(FormatShape → ConsistentWithSummary)를 lock 만 하고 바꾸지 않는다. lazy require 구조도 무변경.
- result-summary-line-format-shape 또는 result-summary-line-consistency 가드 로직·인자 순서·에러 정책 변경.
- 다른 result-summary 패밀리 producer(result-summary, result-summary-markdown 등 — 단일 가드) 하드닝.

## Suggested Sub-agents

`implementer → tester` (test-only, architect 불요).

## Follow-ups

- (예정) result-report-plan(`buildRealDataResultReportPlan`) self-wire 두 가드(`assertRealDataResultIssueDescriptorBodyConsistent` L132 → `assertRealDataResultReportPlanConsistentWithInputs` L150) 호출 순서 invocationCallOrder 순서-lock — result-summary 패밀리 두 번째 축. ⚠️ 첫 가드는 issue 패밀리 descriptor 가드를 재사용(cross-axis borrow)하므로 arg/spy 대상 모듈 확인 필요.

## Result (DONE — 2026-07-16)

- **완료**: PR [#936](https://github.com/myungjoo/Assessment-Agent/pull/936) squash-merge `ffeec576`, reviewer round1 APPROVE(finding 0), 4-게이트 PASS, branch delete.
- **변경**: `test/helpers/realdata-e2e-result-summary-line.spec.ts` +112/-0 (test-only, production src 0 LOC). 순서-lock(`shapeSpy.invocationCallOrder[0] < valueSpy.invocationCallOrder[0]`, `toBeLessThan`) + fail-fast(첫 가드 throw→값-정합 spy 0회) + 입력 guard 우선(null summary→두 가드 0회) 3 test 추가.
- **검증**: 전체 404 suites/11009 tests green, `pnpm lint`·`build` 통과, coverageThreshold line 99.95%/function 100%(line≥80 AND function≥80 무회귀).
- **후속**: result-report-plan 축(T-1043 큐잉) — result-summary 패밀리 2번째/마지막 order-lock.
