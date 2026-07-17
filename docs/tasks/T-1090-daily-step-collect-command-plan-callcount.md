---
id: T-1090
title: realdata-e2e daily-step-collect-command-plan consistency 재유도 gating delegate call-count exactly-N 완결성 — 값-drift(재유도-후 RangeError) 대조 test 1건의 loose toHaveBeenCalled() 을 정확 횟수(resolveRealDataE2eLiveGating exactly-2)로 못박아 중복 재유도 회귀 차단 (call-count 완결성 sweep leg 25 = §D 후보 (b) 두 번째 leg)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts
independentStream: realdata-e2e-callcount-completeness-sweep
plannerNote: "P5 call-count 완결성 sweep leg 25 = T-1065 §D 후보 (b) 두 번째 leg(T-1089 leg 24 = result-report-plan 후속). pre-check 실증(grep+read, 2026-07-18, HEAD 47b2f3ef=T-1089 머지 포함): 대상=daily-step-collect-command-plan 가드. 단일 재유도 delegate(resolveRealDataE2eLiveGating→./realdata-e2e-live-gating, guard L174, action 통과 후 정확히 1회)가 spec 의 값-drift 경계 대조 test 1건(재유도-후 RangeError, action↔gating 오매핑 L629~658)에서 loose `expect(resolveSpy).toHaveBeenCalled()`(L657)만 assert — 정확 횟수 미lock 이라 중복 재유도(build 2회) 회귀 slip 가능. 이 test 는 가드를 2회 invoke(L643·L649 두 toThrow)하므로 exact N=2. happy-path(L625 exactly-1)·구조-error 7분기(L601 exactly-0)·재유도-전 enum RangeError(L679 exactly-0)는 이미 exact 완결 → 잔여 gap 은 이 loose 1건뿐. namespace import(L36 gatingModule)+afterEach restoreAllMocks(L515) 인프라 기존재. pr test-only 1파일, src 0 LOC, file-disjoint dep[] stage5b."
---

# T-1090 — daily-step-collect-command-plan consistency 재유도 gating delegate call-count exactly-N 완결성 (§D 후보 (b) 두 번째 leg)

## Why

P5 test-hardening 의 realdata-e2e call-count 완결성 sweep(T-1065 §D 후보 (b))은 leg 24([T-1089](T-1089-result-report-plan-callcount.md))에서 result-report-plan 가드의 값-drift 대조 2 test 를 exactly-N 으로 못박으며 시작됐다. T-1089 Follow-up 이 지목한 잔여 loose-call-count 가드 중 첫 대상인 `daily-step-collect-command-plan` 가드(`assertRealDataDailyStepCollectCommandPlanConsistentWithGating`)로 sweep 을 이어간다(leg 25).

이 가드는 collect step(README.md 109행 collect-command step / REQ-032·REQ-059)에서 주입된 `(plan, env)` 로 **단일 gating delegate `resolveRealDataE2eLiveGating(env)`(`./realdata-e2e-live-gating`, guard L174)를 재호출**해 산출 plan 의 action↔gating.enabled 매핑·argv 벡터·reason 을 single-source 로 대조한다. 이 delegate 는 구조 검사(L162~163)와 action enum 검사(L167 RangeError, 재유도-전)를 통과한 뒤 **정확히 1회** 재호출된다(단일 재유도).

planner pre-check(실 grep + read, 2026-07-18, HEAD 47b2f3ef = T-1089 머지 포함)로 확인한 gap: 이 spec(총 791줄)은 happy-path(L625 `toHaveBeenCalledTimes(1)`)·구조-error 7분기(L601 `toHaveBeenCalledTimes(0)`, 재유도-전 차단)·재유도-전 enum RangeError(L679 `toHaveBeenCalledTimes(0)`)에서 delegate 호출 횟수를 이미 **exactly-N 완결**하나, **값-drift 경계 대조 test 1건만 loose `toHaveBeenCalled()`** 로 남아있다:

- **(경계 대조 재유도-후 RangeError)** (L629~658): action↔gating.enabled 오매핑(`action:"skip"`인데 `gating.enabled=true`) → 구조·enum 통과 → delegate 도달(재유도됨) → 매핑 위반 RangeError. `expect(resolveSpy).toHaveBeenCalled()`(L657) — loose. 이 test 는 가드를 **2회 invoke**(L643·L649 두 `toThrow` assertion)하므로, 단일 재유도(각 invoke 당 delegate 1회) × 2 invoke = **exact 2회** 가 정확 횟수다.

loose `toHaveBeenCalled()` 는 호출 횟수 ≥ 1 만 보장하므로, 가드가 값 대조 과정에서 **동일 delegate 를 중복 재유도(build ≥ 2회/invoke)** 하는 회귀가 발생해도 이 test 가 잡지 못한다. 이를 `toHaveBeenCalledTimes(2)`(2 invoke × 단일 재유도) 으로 못박아 **중복 재유도 회귀를 차단**하고, 이 가드 spec 의 delegate call-count 완결성을 전량(happy·구조·enum·값-drift 4범주) exactly-N 으로 완성한다. test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` — 수정 대상 spec(총 791줄, 신규 파일 아님). **값-drift 경계 대조 test 1건만 수정**한다: (경계 대조 재유도-후 RangeError, L629~658)의 `resolveSpy` loose 호출 assert(L657)를 정확 횟수 `toHaveBeenCalledTimes(2)` 로 tighten(가드를 2회 invoke 하므로 — 정확 N 은 코드로 재확인). namespace import(`import * as gatingModule from "./realdata-e2e-live-gating"` L36)와 `T-1077 구조-검사 선행성` describe 블록 자체 `afterEach(() => jest.restoreAllMocks())`(L515) 인프라가 이미 존재함을 확인 — 신규 import·spy 인프라 신설 불요. happy-path 이미 `toHaveBeenCalledTimes(1)`(L625), 구조-error 7분기 이미 `toHaveBeenCalledTimes(0)`(L601), 재유도-전 enum RangeError 이미 `toHaveBeenCalledTimes(0)`(L679) 임을 확인해 이 1건만 잔여 gap 임을 확인. **광범위 read 금지 — 값-drift 경계 대조 test(L629~658) + spy 선언(L638~641) + happy-path exact assert(L606~627 참고) + 재유도-전 대조(L660~680 참고) 만.**
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` — 대상 가드. 재유도가 **단일 delegate 단일 재호출**(구조 검사 L162~163 → action enum L167 → `resolveRealDataE2eLiveGating(env)` L174 정확히 1회 → 매핑/argv/reason 값 대조 L178+)임을 확인해 tighten 할 정확 횟수(값-drift test 의 guard 2-invoke × delegate 1-call = 2)를 확정. 매핑 위반 RangeError(L178~181)가 delegate 호출 **뒤** 발생함을 코드로 확인. **광범위 read 금지 — 가드 본문 구조·enum·재유도·매핑 구간(L160~185) 만.**
- `docs/tasks/T-1089-result-report-plan-callcount.md` — 직전 leg 24(§D 후보 (b) 첫 전환). 본 leg 는 동일 축(재유도-후 값-drift 경로의 loose call-count 를 exactly-N 으로 tighten)의 후속이므로 패턴(spy·정확 횟수·값 vs 구조 경계·중복 재유도 회귀 방지 의도)을 mirror 하되, **단일 delegate**(T-1089 는 2-delegate)이고 **정확 N=2**(guard 2-invoke, T-1089 는 각 test 1-invoke → 1)인 점이 차이다.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 tighten 하는 call-count 완결성 assert 자체).

- [ ] **happy-path(정합 정상 흐름 재확인)**: 기존 happy-path test(정합 plan/env → 가드 void 반환 + `resolveSpy` `toHaveBeenCalledTimes(1)`, L625)가 무회귀로 통과함을 확인. 본 leg 는 이 exactly-N 완결성을 값-drift 경로까지 확장하는 것이므로 happy-path 는 이미 완결 상태 유지.
- [ ] **error path — 값-drift RangeError 정확 횟수(핵심)**: (경계 대조 재유도-후 RangeError, L629~658) test 에서 loose `expect(resolveSpy).toHaveBeenCalled()`(L657)를 **정확 횟수 `toHaveBeenCalledTimes(<정확한 N>)`** 으로 tighten. 이 test 는 가드를 2회 invoke(L643·L649 두 `toThrow`)하고 가드 내부 재유도는 invoke 당 1회이므로 원칙상 **exact 2** — 단 코드로 실제 invoke 횟수 × 재유도 횟수를 재확인해 정확 N 을 확정. 중복 재유도(delegate ≥ 3회 for 2-invoke) 회귀가 발생하면 이 assert 가 fail 하도록 못박는다.
- [ ] **flow/branch cover**: 재유도-후 값-drift 분기(action↔gating 매핑 위반)에서 delegate 의 정확 호출 횟수를 exact assert 로 못박아, 구조-error(재유도 0-call, 기존 L601)·재유도-전 enum RangeError(0-call, 기존 L679)와 재유도-후 값-drift(exactly-N)의 경계가 exactly-N 관점에서 명확히 대비됨을 유지.
- [ ] **negative cases 충분 cover**: 재유도-후 값-drift(action↔gating 오매핑) 경로를 exact call-count 로 못박고, 재유도-전(구조 0-call·enum 0-call, 기존)과의 대비를 comment 로 명확화. 추가로 **중복 재유도 회귀 방지 의도**(delegate 가 invoke 당 2회 이상 호출되면 fail)를 해당 test 의 comment 에 명시해 exactly-N 완결성의 negative-회귀 성격을 문서화. 기존 0-call 대비 축(구조·enum)은 손대지 않고 유지.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 assert tighten 만이라 커버리지 하락 없어야 함.
- [ ] **재현 grep 갱신 확인**: `grep -c 'toHaveBeenCalled()' test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts` 값이 기존(1)에서 **0** 으로 감소(loose 제거)하고, 값-drift 경계 대조 test 에 `resolveSpy` `toHaveBeenCalledTimes(<N>)` exact assert 가 존재.
- [ ] **spy 격리 유지**: `T-1077 구조-검사 선행성` describe 블록의 기존 `afterEach(() => jest.restoreAllMocks())`(L515)로 spy 복원 유지 — 신규 import·spy 인프라 신설 없이 기존 namespace import(L36)·`jest.spyOn(gatingModule, "resolveRealDataE2eLiveGating")` 재사용. spy 는 실 구현 call-through(mockImplementation 미지정)로 둔다.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 spec 1파일만 변경(≤300 LOC diff / 1파일, 실제 ~2~10 LOC).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e 전량 통과, suites 무회귀.

## Out of Scope

- 다른 consistency-guard 의 call-count 완결성 tighten — 본 leg 는 daily-step-collect-command-plan **1개** 만(leg 25). 잔여 loose-call-count 가드(daily-step-eval-command-plan, daily-step-dual-leg-run-report-issue-command-plan, result-issue-publish-plan, evaluation-plan, result-issue-command-plan, seed-resolve-person-id 등)는 후속 leg 로(Follow-ups 참조).
- 가드 `.ts` production 로직 변경(재유도 순서·에러 메시지 수정 등) — 코드 무변경, spec assert tighten 만.
- 구조-error path(0-call)·재유도-전 enum RangeError(0-call)·happy-path(exactly-1)의 기존 exact assert 수정 — 이미 완결, 손대지 않음.
- 새 describe 블록·새 test 신설 — 기존 값-drift 경계 대조 1 test 의 loose assert 를 exact 로 tighten 만(구조 확장 아님). 필요 시 중복-재유도 회귀 의도 comment 만 추가.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1065 §D 후보 (b) 완결성 축의 후속 leg, 기존 spy 인프라 재사용, 값-drift 경계 대조 1 test 의 loose call-count 를 exactly-N 으로 tighten). tester 는 R-112 test 4종 + coverage 무회귀 + 값-drift test 의 `resolveSpy` 정확 호출 횟수(가드 코드로 실제 N=2 확정) tighten + 중복 재유도 회귀 방지 의도 검증 + happy/구조/enum 기존 exact assert 무회귀 + grep(`toHaveBeenCalled()` = 0) 확인.

## Follow-ups

- (call-count 완결성 sweep leg 26+) 잔여 loose-call-count 가드 순차 tighten. 2026-07-18 pre-check 로 `grep -c 'toHaveBeenCalled()'` > 0 인 realdata-e2e consistency spec: daily-step-eval-command-plan(1)·daily-step-dual-leg-run-report-issue-command-plan(2)·result-issue-publish-plan(4)·evaluation-plan(3)·result-issue-command-plan(4)·seed-resolve-person-id(2) 등. 각각 재유도-후 값-drift 경로의 loose `toHaveBeenCalled()` 를 exactly-N 으로 tighten 하는 leg 로 큐잉(가드별 정확 N 은 재유도 delegate 개수·invoke 횟수로 코드 확인).
- (leg N) call-count 완결성 축이 소진되면 T-1065 §D 후보 (c) e2e 흐름 커버리지 확장으로 전환(각 step seam 의 정합 chain 이 실제 e2e 흐름에서 호출됨을 커버).
