---
id: T-1092
title: realdata-e2e result-issue-publish-plan consistency 재유도 2-delegate call-count exactly-N 완결 — 값-drift(report/commandArgs drift RangeError) 대조 test 2건의 loose toHaveBeenCalled() 4건을 정확 횟수(buildRealDataResultIssueCommandPlan·buildRealDataResultIssueSearchGhArgv 각 exactly-1)로 못박아 중복 재유도 회귀 차단 (call-count 완결성 sweep leg 27)
phase: P5
status: DONE
mergedAs: 802e6b79
prNumber: 985
reviewRounds: 2
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts
independentStream: realdata-e2e-callcount-completeness-sweep
plannerNote: "P5 call-count 완결성 sweep leg 27 = T-1065 §D 후보 (b) 후속(T-1091 leg 26 = daily-step-eval-command-plan). pre-check 실증(정밀 grep+read, 2026-07-18, HEAD c72878ae=T-1091 머지): '.not.' 제외한 positive loose 만 남은 realdata consistency spec 은 3개(evaluation-plan=3·result-issue-command-plan=4·result-issue-publish-plan=4) — 나머지 후보(daily-step-dual-leg-run-report-issue-command-plan·seed-resolve-person-id)의 loose 2건은 전부 .not.toHaveBeenCalled()(exact-0)라 false positive 로 확인, 이미 완결. 대상=result-issue-publish-plan-consistency(800줄, 2-delegate 재유도: buildRealDataResultIssueCommandPlan+buildRealDataResultIssueSearchGhArgv). 값-drift 대조 test 2건((대조 a) report drift L747~774, (대조 b) commandArgs drift L776~798)이 각각 가드 1회 invoke(단일 toThrow) 후 두 spy 를 loose expect(...).toHaveBeenCalled()(L772·773·796·797)로 assert — 정확 횟수 미lock. 구조 6분기(0-call, L704/725/743 등)·happy 는 이미 exact 완결. 각 test 가드 1-invoke × 각 delegate 1-재유도 = exact 1 → 4건 전부 toHaveBeenCalledTimes(1). pr test-only 1파일, src/helper .ts 0 LOC, file-disjoint dep[] stage5b."
---

# T-1092 — result-issue-publish-plan consistency 재유도 2-delegate call-count exactly-N 완결 (sweep leg 27)

## Why

P5 test-hardening 의 realdata-e2e call-count 완결성 sweep(T-1065 §D 후보 (b))은 leg 26([T-1091](T-1091-eval-command-plan-callcount.md))에서 daily-step-eval-command-plan 가드의 값-drift 대조 test 를 exactly-N 으로 못박으며 이어졌다. 본 leg 27 은 정밀 pre-check 로 확정한 잔여 loose-call-count 가드 중 다음 대상인 `result-issue-publish-plan` 가드(`assertRealDataResultIssuePublishPlanConsistentWithSources`)로 sweep 을 이어간다.

이 가드는 result issue publish step(README.md live-runner step ④ / REQ-030·REQ-059)에서 주입된 `(plan, results, run)` 로 **2단계 build delegate 를 재호출**해 산출 `RealDataResultIssuePublishPlan`({report, commandArgs, searchArgv})을 single-source 로 대조한다:

- (1) `{report, commandArgs} = buildRealDataResultIssueCommandPlan(results, run)` (`./realdata-e2e-result-issue-command-plan`)
- (2) `searchArgv = buildRealDataResultIssueSearchGhArgv(재유도 commandArgs)` (`./realdata-e2e-result-issue-search-argv`)

두 delegate 는 구조 검사(TypeError, 6분기)를 통과한 뒤 **각 정확히 1회** 재호출되고, 그 뒤에 report·commandArgs·searchArgv 값 게이트가 순차 대조한다.

planner pre-check(정밀 grep + read, 2026-07-18, HEAD c72878ae = T-1091 머지 포함)로 확인한 gap: 이 spec(총 800줄)은 구조-error 6분기(재유도-전 차단, 예: L704/L725/L743 `toHaveBeenCalledTimes(0)`)와 happy-path 에서 delegate 호출 횟수를 이미 **exactly-N 완결**하나, **값-drift 경계 대조 test 2건에서 두 delegate 를 loose `toHaveBeenCalled()`(4건)** 로 남겨둔다:

- **(대조 a) report drift → RangeError** (L747~774): 구조 온전 · `report.summary.count` 만 drift → 두 build 위임 재호출된 뒤 report 값 게이트에서 RangeError. `expect(commandPlanSpy).toHaveBeenCalled()`(L772) · `expect(searchArgvSpy).toHaveBeenCalled()`(L773) — 둘 다 loose.
- **(대조 b) commandArgs drift → RangeError** (L776~798): report 정합(통과) · `commandArgs.searchQuery` 만 drift → 두 build 위임 재호출된 뒤 commandArgs 값 게이트에서 RangeError. `expect(commandPlanSpy).toHaveBeenCalled()`(L796) · `expect(searchArgvSpy).toHaveBeenCalled()`(L797) — 둘 다 loose.

각 test 는 가드를 **1회 invoke**(단일 `toThrow`)하고 가드는 각 delegate 를 invoke 당 1회 재유도하므로, 두 delegate 모두 **exact 1회** 가 정확 횟수다. loose `toHaveBeenCalled()` 는 ≥ 1 만 보장하므로 가드가 값 대조 과정에서 **동일 delegate 를 중복 재유도(build ≥ 2회/invoke)** 하는 회귀가 발생해도 잡지 못한다. 4건 전부 `toHaveBeenCalledTimes(1)` 로 못박아 **중복 재유도 회귀를 차단**하고, 이 가드 spec 의 delegate call-count 완결성을 전량(happy·구조·값-drift 범주) exactly-N 으로 완성한다. test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts` — 수정 대상 spec(총 800줄, 신규 파일 아님). **값-drift 대조 test 2건만 수정**한다: (대조 a) report drift(L747~774)의 `commandPlanSpy`(L772)·`searchArgvSpy`(L773) loose assert 2건, (대조 b) commandArgs drift(L776~798)의 `commandPlanSpy`(L796)·`searchArgvSpy`(L797) loose assert 2건 — 총 4건을 정확 횟수 `toHaveBeenCalledTimes(1)` 로 tighten. 각 test 가 가드를 1회 invoke(단일 `toThrow`)함을 코드로 재확인해 exact N=1 확정. namespace import(`import * as commandPlanModule from "./realdata-e2e-result-issue-command-plan"` L23 · `import * as searchArgvModule from "./realdata-e2e-result-issue-search-argv"` L28)와 describe 블록 `afterEach(() => jest.restoreAllMocks())`(L444) · `spyOnBuilders()` 헬퍼(L590 근방) 인프라가 이미 존재함을 확인 — 신규 import·spy 인프라 신설 불요. 구조 6분기(예: L704·L725·L743·L705 `toHaveBeenCalledTimes(0)`)가 이미 exact-0 완결임을 확인해 이 4건만 잔여 gap 임을 확인. **광범위 read 금지 — 값-drift 대조 test 2건(L747~798) + 인접 spy 헬퍼(L580~600) 만.**
- `test/helpers/realdata-e2e-result-issue-publish-plan-consistency.ts` — 대상 가드. 재유도가 **2-delegate 각 단일 재호출**(`buildRealDataResultIssueCommandPlan`(delegate 1) → `buildRealDataResultIssueSearchGhArgv`(delegate 2) 각 1회, 그 뒤 report/commandArgs/searchArgv 값 게이트 순차 대조)임을 코드로 확인해, 값-drift test 의 두 spy exact 횟수가 각 1 임을 확정. report/commandArgs drift RangeError 가 두 delegate 호출 **뒤** 발생함을 확인. **광범위 read 금지 — 가드 본문의 구조 게이트·2 재유도·값 게이트 구간 만.**
- `docs/tasks/T-1091-eval-command-plan-callcount.md` — 직전 leg 26(동일 §D 후보 (b) 축). 본 leg 는 동일 패턴(재유도-후 값-drift 경로의 loose call-count 를 exactly-N 으로 tighten, 단 여기서는 2-delegate·2-test·4-assert, 각 exact 1)의 mirror 이므로 spy·정확 횟수·값 vs 구조 경계·중복 재유도 회귀 방지 의도를 동일하게 적용.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 tighten 하는 call-count 완결성 assert 자체).

- [ ] **happy-path(정합 정상 흐름 재확인)**: 기존 happy-path test(정합 plan/results/run → 가드 void 반환)가 무회귀로 통과함을 확인. 본 leg 는 exactly-N 완결성을 값-drift 경로까지 확장하는 것이므로 happy-path 는 이미 완결 상태 유지.
- [ ] **error path — 값-drift RangeError 정확 횟수(핵심)**: (대조 a) report drift(L772·L773) · (대조 b) commandArgs drift(L796·L797)의 loose `expect(commandPlanSpy).toHaveBeenCalled()` · `expect(searchArgvSpy).toHaveBeenCalled()` 총 4건을 **정확 횟수 `toHaveBeenCalledTimes(1)`** 으로 tighten. 각 test 가드 1-invoke × 각 delegate 1-재유도 = exact 1 — 단 코드로 실제 invoke 횟수 × delegate 재유도 횟수를 재확인해 정확 N 을 확정. 중복 재유도(delegate ≥ 2회 for 1-invoke) 회귀가 발생하면 이 assert 가 fail 하도록 못박는다.
- [ ] **flow/branch cover**: 재유도-후 값-drift 두 분기(report 게이트 throw · commandArgs 게이트 throw)에서 두 delegate 의 정확 호출 횟수를 exact assert 로 못박아, 구조-error(재유도 0-call, 기존 6분기)와 재유도-후 값-drift(각 delegate exactly-1)의 경계가 exactly-N 관점에서 명확히 대비됨을 유지.
- [ ] **negative cases 충분 cover**: report drift · commandArgs drift 두 값-drift 경로를 exact call-count 로 못박고, 재유도-전 구조(0-call, 기존)과의 대비를 comment 로 명확화. 추가로 **중복 재유도 회귀 방지 의도**(delegate 가 invoke 당 2회 이상 호출되면 fail)를 두 test 의 comment 에 명시해 exactly-N 완결성의 negative-회귀 성격을 문서화. 기존 0-call 대비 축(구조 6분기)은 손대지 않고 유지.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 assert tighten 만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/helpers/realdata-e2e-result-issue-publish-plan-consistency.spec.ts | grep -v '\.not\.' | wc -l` 값이 기존(4)에서 **0** 으로 감소(positive loose 제거)하고, 두 값-drift test 에 `commandPlanSpy`·`searchArgvSpy` `toHaveBeenCalledTimes(1)` exact assert 가 각각 존재.
- [ ] **spy 격리 유지**: describe 블록의 기존 `afterEach(() => jest.restoreAllMocks())`(L444)로 spy 복원 유지 — 신규 import·spy 인프라 신설 없이 기존 namespace import(L23·L28)·`spyOnBuilders()` 헬퍼(또는 인라인 `jest.spyOn`) 재사용. spy 는 실 구현 call-through(mockImplementation 미지정)로 둔다.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 변경(≤300 LOC diff / 1파일, 실제 ~4~14 LOC).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 call-count 완결성 tighten — 본 leg 는 result-issue-publish-plan **1개** 만(leg 27). 잔여 positive-loose 가드(evaluation-plan-consistency(3)·result-issue-command-plan-consistency(4))는 후속 leg 로(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(재유도 순서·에러 메시지 수정 등) — 코드 무변경, spec assert tighten 만.
- 구조-error 6분기(0-call)·happy-path 의 기존 assert 수정 — 이미 완결, 손대지 않음.
- `.not.toHaveBeenCalled()`(exact-0 negative) assert 수정 — 이미 exact 이므로 대상 아님(short-circuit 0-call 검증은 그대로 유지).
- 새 describe 블록·새 test 신설 — 기존 값-drift 대조 2 test 의 loose assert 4건을 exact 로 tighten 만(구조 확장 아님). 필요 시 중복-재유도 회귀 의도 comment 만 추가.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1065 §D 후보 (b) 완결성 축의 후속 leg, 기존 spy 인프라 재사용, 값-drift 대조 2 test 의 loose call-count 4건을 exactly-N=1 으로 tighten). tester 는 R-112 test 4종 + coverage 무회귀 + 두 값-drift test 의 `commandPlanSpy`·`searchArgvSpy` 정확 호출 횟수(가드 코드로 실제 N=1 확정) tighten + 중복 재유도 회귀 방지 의도 검증 + happy/구조 6분기 기존 exact assert 무회귀 + 정밀 grep(positive loose = 0) 확인.

## Follow-ups

- (call-count 완결성 sweep leg 28+) 잔여 positive-loose 가드 순차 tighten. 2026-07-18 정밀 pre-check(`.not.` 제외 positive loose)로 확인된 잔여 realdata consistency spec: evaluation-plan-consistency(3)·result-issue-command-plan-consistency(4). 각각 재유도-후 값-drift 경로의 loose `toHaveBeenCalled()` 를 exactly-N 으로 tighten 하는 leg 로 큐잉(가드별 정확 N 은 재유도 delegate 개수·invoke 횟수로 코드 확인).
- (관측) daily-step-dual-leg-run-report-issue-command-plan-consistency·seed-resolve-person-id-consistency 의 loose 2건은 정밀 pre-check 결과 전부 `.not.toHaveBeenCalled()`(exact-0)로 이미 완결 — sweep 대상 아님(T-1091 Follow-up 의 loose count 는 `.not.` 포함 grep 이라 false positive 였음). 잔여 sweep 은 위 2 consistency spec 소진으로 마감 예정.
- (leg N) call-count 완결성 축이 소진되면 T-1065 §D 후보 (c) e2e 흐름 커버리지 확장으로 전환(각 step seam 의 정합 chain 이 실제 e2e 흐름에서 호출됨을 커버).
