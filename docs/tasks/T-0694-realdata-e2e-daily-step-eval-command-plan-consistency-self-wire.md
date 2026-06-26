---
id: T-0694
title: realdata-e2e daily-step-eval-command-plan 컴포저 self-wire 배선 (T-0693 가드 짝 닫기)
phase: P5
status: DONE
commitMode: pr
prNumber: 610
mergedAs: 82c0853ef7afac065a308bf93b39c95c3de65a2d
reviewRounds: 1
completedAt: 2026-06-26T20:20:00Z
coversReq: [REQ-030, REQ-059]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — T-0693 신설 daily-step-eval-command-plan 가드를 컴포저 run/skip 양 분기 반환 직전 self-assert 배선(T-0692 self-wire mirror). guard self-wire × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-eval-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts
dependsOn: [T-0693]
independentStream: realdata-e2e-consistency-guard
---

# T-0694 — realdata-e2e daily-step-eval-command-plan 컴포저 self-wire 배선

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 seed-side / evaluate-side leaf 컴포저는 "가드 신설 → self-wire" 짝이 모두 닫혔다(T-0687→T-0688, T-0691→T-0692 등). step④ daily-test `step_eval` 진입측 컴포저 `buildRealDataDailyStepEvalCommandPlan(env)`(`realdata-e2e-daily-step-eval-command-plan.ts`, T-0611)는 직전 T-0693 이 독립 정합 가드 `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env)`(`realdata-e2e-daily-step-eval-command-plan-consistency.ts`)를 **신설**했지만, 컴포저 본문이 아직 이 가드를 호출하지 않는다(self-wire 부재 — origin/main 컴포저 grep 0 확인: 두 return 사이트 L81 skip 분기 / L88 run 분기 모두 가드 호출 없음). 즉 가드는 존재하나 build-time 경로에 자동 발동되지 않아, 외부에서 명시 호출하지 않는 한 합성 회귀(action↔gating 오매핑, argv config/spec-path drift, run/skip 분기 오매핑, reason 재포장, §9 credential 값 argv/reason 누출)를 잡지 못한다. 본 task 는 그 짝을 닫는다 — 컴포저가 산출 `RealDataDailyStepEvalCommandPlan` 을 반환하기 **직전**(run/skip 양 분기 각각) 동일 가드로 self-assert 해, 손상된 command plan 이 step④ daily-test bash 배선(jest spawn)으로 새기 전 호출 시점에 fail-fast throw 하도록 배선한다. **T-0692 scoring-call-args self-wire 의 step④-side mirror**.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` — self-wire 대상 step④ 컴포저. 현재 **두 return 사이트**가 있다: skip 분기(`return { action: "skip", reason };` 부근 L81) + run 분기(`return { action: "run", argv: [...], reason };` 부근 L88). 본 task 는 **각 분기 반환 직전**에 산출 plan 을 const 로 받아 self-assert 후 반환하도록 배선한다. 입력 env mutate 0·매 호출 새 plan 객체·throw 0(부재는 action="skip") 계약은 불변 유지.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts` — 호출할 가드 `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env)`(T-0693 신설). 시그니처·throw 정책(구조 불일치 TypeError / 값 정합 위반 RangeError) 확인. **본 task 는 이 가드 파일을 수정하지 않는다**(호출만).
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts` — 컴포저 colocated spec. self-wire 배선 후 정상 합성(run/skip 양 분기)이면 throw 0(void → 반환) 임을 추가 검증하고, 기존 happy/negative case 가 self-assert 통과를 깨지 않음을 확인. self-wire 발동 회귀 test 를 본 spec 에 추가한다.
- `test/helpers/realdata-e2e-scoring-call-args.ts` (origin/main, T-0692 self-wire 완료본) — **self-wire mirror 선례**. 반환 직전 `assert...(callArgs, inputs, modelId);` 호출 + 책임 주석 구조·정상 시 동일 반환·가드 read-only(mutate 0)·위임 가드 throw 선전파 설명을 본 task 와 동형 차용(여기선 env 인자 동반 + 양 분기 배선).
- `test/helpers/realdata-e2e-scoring-call-args.spec.ts` (origin/main, T-0692) — self-wire 회귀 spec 선례. 정상 산출 self-assert 통과·반환 형태 보존·self-wire 발동 증명(jest.spyOn 또는 coverage) test 패턴 차용.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` 의 `buildRealDataDailyStepEvalCommandPlan` 가 산출 plan 을 **반환하기 직전(run/skip 양 분기 각각)** `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env)` 를 호출하도록 배선한다(`import { assertRealDataDailyStepEvalCommandPlanConsistentWithGating } from "./realdata-e2e-daily-step-eval-command-plan-consistency";` 추가 + 각 분기 산출물을 const 로 받아 self-assert 후 반환). 정상 합성이면 가드는 void → 반환 plan(action/argv/reason)·형태 보존(관측 불가능하게 동일).
- [ ] self-wire 배선 외 컴포저 로직(gating 위임·run/skip 분기 매핑·canonical argv 구성·env 읽기-전용·매 호출 새 객체 계약)은 변경 0. 새 분기/정규화/복구 추가 0(가드는 read-only fail-fast 만).
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0. test helper 단독 변경.
- [ ] happy-path unit test 1+ — colocated spec 에서 `buildRealDataDailyStepEvalCommandPlan(env)` 가 정상 입력(gating enabled → action="run" + canonical argv / gating disabled → action="skip" + argv 부재)에 대해 self-assert 를 통과해 throw 0 으로 정상 반환함을 양 분기 모두 검증. 반환 plan 형태(action/argv/reason)·argv 4-요소 canonical 벡터 보존도 확인.
- [ ] error path unit test 1+ — gating helper 가 throw 0 이라 컴포저 자체는 throw 0 이 정상이므로, self-wire 가 **정상 산출물에 대해 가드를 우회/중복 throw 시키지 않음**을 검증(정상 run/skip plan 각각 throw 0). 추가로 가드가 손상 plan 에 throw 하는 정책은 T-0693 spec 이 cover — 본 task 는 컴포저 정상 경로가 self-assert 를 깨지 않음에 집중.
- [ ] flow / branch cover — self-wire 삽입으로 추가되는 분기는 없으나(가드 호출은 각 분기 직선 경로), 컴포저의 기존 양 분기(run 분기 self-assert 통과 · skip 분기 self-assert 통과)마다 throw 0 정상 반환을 test 1+ 로 cover.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지. 최소: (1) gating disabled env → skip plan self-assert 통과(throw 0), (2) gating enabled env → run plan self-assert 통과 + argv canonical 보존(throw 0), (3) self-wire 발동 증명 회귀 test 1+(정상 산출물이 가드 불변식을 만족해 void 임 — self-wire 경로가 실제로 가드를 호출함을 jest.spyOn(consistency 모듈) 호출 1회 검증 또는 coverage 로 입증). self-wire 누락 시 fail 하도록.
- [ ] regression test 1+ (self-wire 발동 증명) — 본 self-wire 가 실제로 가드를 호출함을 입증하는 test. (예: jest.spyOn 으로 `assertRealDataDailyStepEvalCommandPlanConsistentWithGating` 호출이 run/skip 각 분기에서 정확히 1회 발생함을 검증, 또는 정상 산출 throw 0 + 가드 호출 경로 coverage). self-wire 가 누락되면 fail 하도록.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 컴포저 helper line/branch/func/stmt 보존(self-wire 후에도 100% 유지 목표), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts`(컴포저와 colocated, 기존 파일). 새 공용 mock helper 추출 불요 — 기존 spec env fixture + T-0692 self-wire spec 패턴 재사용.

## Out of Scope

- **가드 파일(`realdata-e2e-daily-step-eval-command-plan-consistency.ts`) 수정** — 본 task 는 호출(self-wire)만. 가드 본문/시그니처/에러 정책은 T-0693 그대로 불변.
- **gating helper(`realdata-e2e-live-gating.ts`) 수정** — 컴포저가 이미 호출하는 위임 helper. 본 task 에서 변경 0.
- **production `src/` 코드 변경** — daily-test step_eval wiring·서비스 등 변경 0.
- **컴포저 정책 변경** — gating 위임·run/skip 매핑·canonical argv 구성·spec-path 상수·reason 합성은 불변. 자동 복구/정규화/기본값 채움 0.
- **다른 leaf 가드/컴포저 신설/배선** — 본 task 는 daily-step-eval-command-plan self-wire 단일 짝만. 그 외 step④ 확장은 후속.
- **live execFile / 실 jest spawn / 실 daily-test.sh step_eval wiring / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 배선만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (self-wire 선례 T-0692 명확 — architect 생략. 컴포저 1줄 import + 양 분기 반환 직전 self-assert 삽입 + spec self-wire 회귀 test 추가).

## Follow-ups

- (본 task 머지 후) step④ result-issue gh-command-plan(`resolveRealDataResultIssueGhCommandPlan`, T-0588) 계열의 잔여 가드 짝 점검 — build-time consistency 사슬의 step④ 측 완결 여부 재survey 후 planner 가 다음 짝(가드 신설 또는 self-wire) 큐잉.
