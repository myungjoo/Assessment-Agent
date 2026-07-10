---
id: T-0891
title: realdata-e2e daily-step-collect-command-plan 컴포저 self-wire 배선 (T-0890 가드 짝 닫기)
phase: P5
status: DONE
mergedAs: 766d81ad
prNumber: 785
reviewRounds: 1
completedAt: 2026-07-10T18:13:37Z
commitMode: pr
coversReq: [REQ-009, REQ-013, REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-consistency-guard
dependsOn: [T-0890]
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-collect-command-plan.spec.ts
plannerNote: "P5 §109 step④ — T-0890 신설 collect 가드를 컴포저 run/skip 양 분기 반환 직전 self-assert 배선(eval-leg T-0694 self-wire mirror). guard self-wire × 1.0."
---

# T-0891 — realdata-e2e daily-step-collect-command-plan 컴포저 self-wire 배선

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 **eval-leg** 은 step④ daily-test `step_eval` 진입측 컴포저에 대해 "가드 신설(T-0693) → self-wire(T-0694)" 짝을 이미 닫았다. **collect-leg** 은 T-0887(컴포저) → T-0888(bash 배선) → T-0889(shell↔TS parity smoke) → T-0890(독립 정합 가드 신설, PR #784 merged)까지 채웠으나, 진입측 컴포저 `buildRealDataDailyStepCollectCommandPlan(env)`(`realdata-e2e-daily-step-collect-command-plan.ts`, T-0887)가 아직 그 가드를 **호출하지 않는다**(self-wire 부재 — origin/main 컴포저 grep 0 확인: skip 분기·run 분기 두 return 사이트 모두 가드 호출 없음). 즉 가드 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env)` 는 main 에 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 합성 회귀(action↔gating 오매핑, argv config/spec-path drift, run/skip 분기 오매핑, reason 재포장, §9 credential 값 argv/reason 누출)를 잡지 못한다.

본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataDailyStepCollectCommandPlan` 을 반환하기 **직전**(run/skip 양 분기 각각) 동일 가드로 self-assert 해, 손상된 command plan 이 step④ daily-test bash 배선(jest spawn)으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **eval-leg T-0694(self-wire) 의 collect-leg mirror** — T-0889 Follow-up slice (a) 의 뒤 절반(짝 닫기).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts` (T-0887) — self-wire 대상 step④ collect 컴포저. 현재 **두 return 사이트**가 있다: skip 분기(`return { action: "skip", reason: gating.reason };` L92 부근) + run 분기(`return { action: "run", argv: [...], reason: gating.reason };` L104 부근). 본 task 는 **각 분기 반환 직전**에 산출 plan 을 const 로 받아 self-assert 후 반환하도록 배선한다. 입력 env mutate 0·매 호출 새 plan 객체·throw 0(부재는 action="skip") 계약은 불변 유지. 파일 상단 주석의 "consistency 가드는 후속 slice — 본 task 는 self-assert 가드를 도입하지 않는다" 문장은 본 task 로 무효화되므로 self-wire 도입에 맞게 갱신(가드 배선 완료 반영).
- `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` (origin/main, T-0890 신설) — 호출할 가드 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env)`. 시그니처·throw 정책(구조 불일치 vs 값 불일치 분기)·read-only(입력 mutate 0)·결정론 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-daily-step-collect-command-plan.spec.ts` (origin/main, T-0887) — 컴포저 colocated spec. self-wire 배선 후 정상 합성(run/skip 양 분기)이면 throw 0(void → 정상 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test 를 본 spec 에 추가한다. gating-enabled/disabled env fixture 재사용.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` (origin/main, T-0694 self-wire 완료본) — **self-wire mirror 정본**. 반환 직전 각 분기에서 `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(skipPlan/runPlan, env);` 호출 + 산출물을 const 로 받아 self-assert 후 반환하는 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파 설명을 본 task 와 동형 차용(helper/타입만 collect 로 교체).
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts` (origin/main, T-0694) — self-wire 회귀 spec 정본. 정상 산출 self-assert 통과·반환 형태 보존·self-wire 발동 증명(jest.spyOn 또는 coverage) test 패턴을 collect-leg 로 mirror.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts` 의 `buildRealDataDailyStepCollectCommandPlan` 가 산출 plan 을 **반환하기 직전(run/skip 양 분기 각각)** `assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env)` 를 호출하도록 배선한다(`import { assertRealDataDailyStepCollectCommandPlanConsistentWithGating } from "./realdata-e2e-daily-step-collect-command-plan-consistency";` 추가 + 각 분기 산출물을 const 로 받아 self-assert 후 반환). 정상 합성이면 가드는 void → 반환 plan(action/argv/reason)·형태 관측 불가능하게 동일.
- [ ] self-wire 배선 외 컴포저 로직(gating 위임·run/skip 분기 매핑·canonical argv 구성·env 읽기-전용·매 호출 새 객체 계약)은 변경 0. 새 분기/정규화/복구 추가 0(가드는 read-only fail-fast 만). 파일 상단 "consistency 가드 후속 slice" 주석만 self-wire 완료로 정합 갱신.
- [ ] **Happy-path unit test 1+** — colocated spec 에서 `buildRealDataDailyStepCollectCommandPlan(env)` 가 정상 입력(gating enabled → action="run" + canonical 4-요소 argv / gating disabled → action="skip" + argv 부재)에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 양 분기 모두 검증. 반환 plan 형태(action/argv/reason)·argv canonical 벡터(`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH]`) 보존도 확인.
- [ ] **Error path unit test 1+** — gating helper 가 throw 0 이라 컴포저 자체는 throw 0 이 정상이므로, self-wire 가 **정상 산출물에 대해 가드를 우회/중복 throw 시키지 않음**을 검증(정상 run/skip plan 각각 throw 0). 손상 plan 에 가드가 throw 하는 정책 자체는 T-0890 spec 이 cover — 본 task 는 컴포저 정상 경로가 self-assert 를 깨지 않음에 집중.
- [ ] **Flow / branch cover** — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 각 분기 직선 경로), 컴포저의 기존 양 분기(run 분기 self-assert 통과 · skip 분기 self-assert 통과)마다 throw 0 정상 반환을 test 1+ 로 cover.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지. 최소: (1) gating disabled env → skip plan self-assert 통과(throw 0), (2) gating enabled env → run plan self-assert 통과 + argv canonical 보존(throw 0), (3) gating-enabled env 에 placeholder credential 을 넣어도 반환 argv/reason 에 credential 값 미surface(§9 정합 — 정규식 단언 1+), (4) self-wire 발동 증명 회귀 test 1+(아래).
- [ ] **Regression test 1+ (self-wire 발동 증명)** — 본 self-wire 가 실제로 가드를 호출함을 입증하는 test. 예: jest.spyOn 으로 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating` 호출이 run/skip 각 분기에서 정확히 1회 발생함을 검증(또는 정상 산출 throw 0 + 가드 호출 경로 coverage). **self-wire 가 누락되면 fail 하도록** 작성.
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] **lint+build green**: `pnpm lint && pnpm build && pnpm test` green. self-wire 배선의 typing 이 가드 시그니처(`plan` + `env`)·컴포저 산출 type 과 정합.
- [ ] **colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-collect-command-plan.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec env fixture + T-0694 self-wire spec 패턴 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-daily-step-collect-command-plan-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책은 T-0890 그대로 불변.
- **gating helper(`realdata-e2e-live-gating.ts`) 수정** — 컴포저가 이미 호출하는 위임 helper. 본 task 에서 변경 0.
- **production `src/` 코드 변경** — daily-test step_collect wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — gating 위임·run/skip 매핑·canonical argv 구성·spec-path 상수·reason 합성은 불변. 자동 복구/정규화/기본값 채움 0.
- **shell↔TS parity smoke(T-0889) / bash test(T-0888) 재구현** — 본 task 는 TS 컴포저 self-wire 만.
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 daily-step-collect-command-plan self-wire 단일 짝만. 그 외 step④ 확장은 후속.
- **live execFile / 실 jest spawn / 실 daily-test.sh step_collect wiring / 실 collectForPerson / Ollama / live-LLM / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

`implementer → tester` (self-wire 선례 eval-leg T-0694 명확 — architect 생략. 컴포저 1줄 import + 양 분기 반환 직전 산출물 const 화 + self-assert 삽입 + 상단 주석 정합 갱신 + spec self-wire 회귀 test 추가. eval-leg `realdata-e2e-daily-step-eval-command-plan.ts` self-wire 완료본을 정본으로 mirror 하되 helper/타입/상수를 collect 로 교체.)

## Follow-ups

(없음 — 단, 본 task 머지로 collect-leg command-plan "가드 신설 → self-wire" 짝(T-0890→T-0891)이 eval-leg(T-0693→T-0694)와 동형으로 완결된다. 이후 P5 잔여 갭: R-9 사용자 지정 기간 평가문(bullet 98)·R-61 일/주/월 요약 평가(bullet 97)·timezone KST(bullet 110, ADR-first)·step④ result-issue 계열 잔여 가드 짝 재survey — 별도 슬라이스로 planner 가 큐잉.)

<!-- planner calibration note (별도 task 불요): T-0890 task 파일은 실제 +826 LOC(추정 230) 임에도 sizeExempt 마커 부재로 reviewer MINOR advisory 를 유발했다. 향후 mirror guard/spec 신설 task(JSDoc + R-112 negative-case 볼륨 + prettier long-symbol wrapping 으로 팽창)는 300 LOC 초과 예상 시 estimatedDiff 를 현실적으로 잡고 sizeExempt:true + 한 줄 justification 을 박제할 것. 본 T-0891 은 self-wire(소규모, T-0694 선례 80 LOC/2파일)라 cap 안 — sizeExempt 불요. -->
