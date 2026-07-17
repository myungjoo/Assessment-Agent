---
id: T-1094
title: realdata-e2e result-issue-command-plan consistency 재유도 2-delegate call-count exactly-N 완결 — 값-drift(report/commandArgs drift RangeError) 대조 test 2건의 loose toHaveBeenCalled() 4건을 정확 횟수(buildRealDataResultReportPlan·buildRealDataResultIssueCommandArgs 각 exactly-1)로 못박아 중복 재유도 회귀 차단 (call-count 완결성 sweep leg 29)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts
independentStream: realdata-e2e-callcount-completeness-sweep
plannerNote: "P5 call-count 완결성 sweep leg 29 = T-1065 §D 후보 (b) 후속(T-1093 leg 28 = evaluation-plan). pre-check 실증(정밀 grep+read, 2026-07-18, origin/main 4 loose 잔존 확인): '.not.' 제외 positive loose 만 남은 잔여 realdata consistency spec = result-issue-command-plan(4). 대상=result-issue-command-plan-consistency(1187줄, 2-delegate 재유도: buildRealDataResultReportPlan(L291)+buildRealDataResultIssueCommandArgs(L292) 각 1회, 구조 통과 후 무조건 호출을 가드 코드로 재확인). 값-drift 대조 test 2건((대조 a) report drift L1132~1158, (대조 b) commandArgs drift L1160~1185)이 각 가드 1회 invoke(단일 toThrow) 후 loose expect(...).toHaveBeenCalled() 4건(L1156·L1157·L1183·L1184)을 남김. 두 delegate 는 값 게이트(L299·L312)보다 먼저 무조건 호출되므로 두 test 모두 report=1·commandArgs=1 exact → 4건 전부 toHaveBeenCalledTimes(1). pr test-only 1파일, src/helper .ts 0 LOC, file-disjoint dep[] stage5b."
---

# T-1094 — result-issue-command-plan consistency 재유도 2-delegate call-count exactly-N 완결 (sweep leg 29)

## Why

P5 test-hardening 의 realdata-e2e call-count 완결성 sweep(T-1065 §D 후보 (b))은 leg 28([T-1093](T-1093-eval-plan-callcount.md))에서 evaluation-plan 가드의 값-drift 대조 test 를 exactly-N 으로 못박으며 이어졌다. 본 leg 29 는 정밀 pre-check 로 확정한 **잔여 마지막 positive-loose 가드**인 `result-issue-command-plan` 가드(`assertRealDataResultIssueCommandPlanConsistentWithInputs`)로 sweep 을 이어간다.

이 가드는 result-issue(GitHub issue 명령) step(README.md live-runner result 발행 step / REQ-030·REQ-059)에서 주입된 `(plan, results, run)` 으로 **2단계 build delegate 를 재호출**해 산출 `RealDataResultIssueCommandPlan`({report, commandArgs})을 single-source 로 대조한다:

- (1) `expectedReport = buildRealDataResultReportPlan(results, run)` (`./realdata-e2e-result-report-plan`, L291)
- (2) `expectedCommandArgs = buildRealDataResultIssueCommandArgs(expectedReport.descriptor)` (`./realdata-e2e-result-issue-command-args`, L292)

두 delegate 는 구조 검사(assertPlanStructure 등)를 통과한 뒤 **무조건·각 정확히 1회** 재호출되고(L291~294, 어느 값 게이트보다 먼저), 그 뒤에 report 값 게이트(L299)·commandArgs 값 게이트(L312)가 순차 대조한다. 두 delegate 가 값 게이트 이전에 모두 호출되므로, report drift·commandArgs drift **두 값-drift 경로 모두에서 두 delegate 는 각 exact 1회** 다(evaluation-plan leg 28 의 inputs-게이트 fail-fast 경계와 달리 여기서는 delegate 0-call 경계가 값-drift 경로에 없다).

planner pre-check(정밀 grep + read, 2026-07-18, origin/main 4 loose 잔존 확인)로 확인한 gap: 이 spec(총 1187줄)은 구조-error 분기(재유도-전 차단, L1128·L1129 exact-0)와 happy-path 에서 delegate 호출 횟수를 이미 **exactly-N 완결**하나, **값-drift 경계 대조 test 2건에서 loose `toHaveBeenCalled()`(4건)** 를 남겨둔다:

- **(대조 a) report drift → RangeError** (L1132~1158): 구조 온전 · report.summary.count 값만 drift(`count: 999`) → 두 build 위임(L291~292) 모두 호출된 뒤 report 값 게이트(L299)에서 RangeError. `expect(reportSpy).toHaveBeenCalled()`(L1156) · `expect(commandArgsSpy).toHaveBeenCalled()`(L1157) — 둘 다 loose.
- **(대조 b) commandArgs drift → RangeError** (L1160~1185): report 정합(게이트 통과) · commandArgs.searchQuery 만 drift(`"<!-- 잘못된 검색 토큰 -->"`) → 두 build 위임 재호출된 뒤 commandArgs 값 게이트(L312)에서 RangeError. `expect(reportSpy).toHaveBeenCalled()`(L1183) · `expect(commandArgsSpy).toHaveBeenCalled()`(L1184) — 둘 다 loose.

각 test 는 가드를 **1회 invoke**(단일 `toThrow`)하고 가드는 각 delegate 를 invoke 당 1회 재유도하므로(delegate 1 = L291 · delegate 2 = L292 각 단일 호출, `buildRealDataResultIssueCommandArgs` 는 `buildRealDataResultReportPlan` 산출 descriptor 만 인자로 받고 내부에서 report-plan 을 재호출하지 않음을 코드로 확인), 도달한 delegate 는 **exact 1회** 가 정확 횟수다. loose `toHaveBeenCalled()` 는 ≥ 1 만 보장하므로 가드가 값 대조 과정에서 **동일 delegate 를 중복 재유도(build ≥ 2회/invoke)** 하는 회귀가 발생해도 잡지 못한다. 4건 전부 `toHaveBeenCalledTimes(1)` 로 못박아 **중복 재유도 회귀를 차단**하고, 이 가드 spec 의 delegate call-count 완결성을 전량(happy·구조·값-drift 범주) exactly-N 으로 완성한다. 이로써 realdata consistency spec 전량의 positive-loose call-count 를 소진한다. test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts` — 수정 대상 spec(총 1187줄, 신규 파일 아님). **값-drift 대조 test 2건만 수정**한다: (대조 a) report drift(L1132~1158)의 `reportSpy`(L1156)·`commandArgsSpy`(L1157) loose assert 2건, (대조 b) commandArgs drift(L1160~1185)의 `reportSpy`(L1183)·`commandArgsSpy`(L1184) loose assert 2건 — 총 4건을 정확 횟수 `toHaveBeenCalledTimes(1)` 로 tighten. 구조-error(L1128·L1129 `toHaveBeenCalledTimes(0)`)는 이미 exact-0 완결이므로 손대지 않는다. 각 test 가 가드를 1회 invoke(단일 `toThrow`)함을 코드로 재확인해 exact N=1 확정. namespace import(`import * as resultReportPlanModule from "./realdata-e2e-result-report-plan"` L42 · `import * as resultIssueCommandArgsModule from "./realdata-e2e-result-issue-command-args"` L35)와 describe 블록 `afterEach(() => jest.restoreAllMocks())`(L935~936)·`spyOnBuilders()`(L941~) 인프라가 이미 존재함을 확인 — 신규 import·spy 인프라 신설 불요. **광범위 read 금지 — 값-drift 대조 test 2건(L1132~1185) 만.**
- `test/helpers/realdata-e2e-result-issue-command-plan-consistency.ts` — 대상 가드. 재유도가 **2-delegate 각 단일 재호출**(`buildRealDataResultReportPlan`(delegate 1, L291) → `buildRealDataResultIssueCommandArgs`(delegate 2, L292, expectedReport.descriptor 인자) → report 값 게이트(L299 throw) → commandArgs 값 게이트(L312 throw))이고, 두 delegate 가 **어느 값 게이트보다 먼저 무조건 호출**됨을 코드로 확인해, 값-drift test 의 두 spy exact 횟수가 두 test 모두 각 1임을 확정. **광범위 read 금지 — 가드 본문의 2 재유도·값 게이트 구간(L288~318) 만.**
- `docs/tasks/T-1093-eval-plan-callcount.md` — 직전 leg 28(동일 §D 후보 (b) 축). 본 leg 는 동일 패턴(재유도-후 값-drift 경로의 loose call-count 를 exactly-N 으로 tighten, 여기서는 2-delegate·2-test·4-assert, 두 test 모두 두 delegate 각 exact 1)의 mirror 이므로 spy·정확 횟수·값 vs 구조 경계·중복 재유도 회귀 방지 의도를 동일하게 적용. 단 evaluation-plan(leg 28)은 inputs 게이트 fail-fast 로 (대조 a)의 callArgsSpy 가 exact-0 라 loose 3건이었으나, 본 result-issue-command-plan 은 두 delegate 가 값 게이트 이전 무조건 호출이라 두 test 모두 4건 전부 exact-1 인 점이 차이.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 tighten 하는 call-count 완결성 assert 자체).

- [ ] **happy-path(정합 정상 흐름 재확인)**: 기존 happy-path test(정합 plan/results/run → 가드 void 반환, 두 delegate 각 1회 재유도)가 무회귀로 통과함을 확인. 본 leg 는 exactly-N 완결성을 값-drift 경로까지 확장하는 것이므로 happy-path 는 이미 완결 상태 유지.
- [ ] **error path — 값-drift RangeError 정확 횟수(핵심)**: (대조 a) report drift(L1156·L1157) · (대조 b) commandArgs drift(L1183·L1184)의 loose `expect(reportSpy).toHaveBeenCalled()` · `expect(commandArgsSpy).toHaveBeenCalled()` 총 4건을 **정확 횟수 `toHaveBeenCalledTimes(1)`** 으로 tighten. 각 test 가드 1-invoke × 도달 delegate 1-재유도 = exact 1 — 단 코드로 실제 invoke 횟수 × delegate 재유도 횟수를 재확인해 정확 N 을 확정. 중복 재유도(delegate ≥ 2회 for 1-invoke) 회귀가 발생하면 이 assert 가 fail 하도록 못박는다.
- [ ] **flow/branch cover**: 재유도-후 값-drift 두 분기(report 게이트 throw · commandArgs 게이트 throw)에서 두 delegate 의 정확 호출 횟수를 exact assert 로 못박아, 구조-error(재유도 0-call, L1128·L1129)와 재유도-후 값-drift(두 delegate exactly-1)의 경계가 exactly-N 관점에서 명확히 대비됨을 유지. 특히 두 delegate 가 값 게이트 이전 무조건 호출이라 두 값-drift 경로 모두 report=1·commandArgs=1 임을 exact 로 확정.
- [ ] **negative cases 충분 cover**: report drift · commandArgs drift 두 값-drift 경로를 exact call-count 로 못박고, 재유도-전 구조(0-call, L1128·L1129)와의 대비를 comment 로 명확화. 추가로 **중복 재유도 회귀 방지 의도**(delegate 가 invoke 당 2회 이상 호출되면 fail)를 두 test 의 comment 에 명시해 exactly-N 완결성의 negative-회귀 성격을 문서화. 기존 구조-error 의 `toHaveBeenCalledTimes(0)`(L1128·L1129)은 손대지 않고 유지.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 assert tighten 만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/helpers/realdata-e2e-result-issue-command-plan-consistency.spec.ts | grep -v '\.not\.' | wc -l` 값이 기존(4)에서 **0** 으로 감소(positive loose 제거)하고, 두 값-drift test 에 `reportSpy`·`commandArgsSpy` `toHaveBeenCalledTimes(1)` exact assert 가 각각 존재.
- [ ] **spy 격리 유지**: describe 블록의 기존 `afterEach(() => jest.restoreAllMocks())`(L935~936)로 spy 복원 유지 — 신규 import·spy 인프라 신설 없이 기존 namespace import(L35·L42)·`spyOnBuilders()`(L941~) 재사용. spy 는 실 구현 call-through(mockImplementation 미지정)로 둔다.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 변경(≤300 LOC diff / 1파일, 실제 ~4~8 LOC).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 call-count 완결성 tighten — 본 leg 는 result-issue-command-plan **1개** 만(leg 29). 이로써 realdata consistency spec 의 positive-loose 잔여 대상이 소진되므로, sweep 축 마감 후 다음 방향은 Follow-ups 참조.
- 가드 `.ts` production 로직 변경(재유도 순서·에러 메시지 수정 등) — 코드 무변경, spec assert tighten 만.
- 구조-error 분기(0-call, L1128·L1129)·happy-path 의 기존 assert 수정 — 이미 완결, 손대지 않음.
- `.not.toHaveBeenCalled()`(exact-0 negative) assert 수정 — 이미 exact 이므로 대상 아님.
- 새 describe 블록·새 test 신설 — 기존 값-drift 대조 2 test 의 loose assert 4건을 exact 로 tighten 만(구조 확장 아님). 필요 시 중복-재유도 회귀 의도 comment 만 추가.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1065 §D 후보 (b) 완결성 축의 후속 leg, 기존 spy 인프라 재사용, 값-drift 대조 2 test 의 loose call-count 4건을 exactly-N=1 으로 tighten). tester 는 R-112 test 4종 + coverage 무회귀 + 두 값-drift test 의 `reportSpy`·`commandArgsSpy` 정확 호출 횟수(가드 코드로 실제 N=1 확정) tighten + 중복 재유도 회귀 방지 의도 검증 + happy/구조(0-call) 기존 exact assert 무회귀 + 정밀 grep(positive loose = 0) 확인.

## Follow-ups

- (call-count 완결성 축 마감) 본 leg 29 로 realdata consistency spec 전량의 positive-loose `toHaveBeenCalled()` 가 소진될 전망(2026-07-18 정밀 pre-check 기준 evaluation-plan(leg 28)·result-issue-command-plan(본 leg) 이 마지막 2개였음). 후속 planner 는 tighten 완료 후 잔여 positive-loose 가 실제 0 인지 realdata consistency spec 전량 재-grep 으로 재확인하고, 남으면 leg 30 으로, 없으면 T-1065 §D 후보 (c) e2e 흐름 커버리지 확장(각 step seam 의 정합 chain 이 실제 e2e 흐름에서 호출됨을 커버)으로 전환.
