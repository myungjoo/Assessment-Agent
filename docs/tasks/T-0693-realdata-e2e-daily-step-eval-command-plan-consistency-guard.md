---
id: T-0693
title: realdata-e2e daily-step-eval-command-plan 컴포저 산출 ↔ gating single-source 재유도 정합 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 109행 step④ — daily-step-eval-command-plan 컴포저 정합 가드 신설(gating↔action/argv 재유도 대조). guard category × 1.5 × 1.0.
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts
  - test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts
dependsOn: []
independentStream: realdata-e2e-consistency-guard
---

# T-0693 — realdata-e2e daily-step-eval-command-plan 컴포저 산출 ↔ gating single-source 재유도 정합 순수 가드 신설

## Why

PLAN 109행(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 seed-side / evaluate-side / result-issue-side leaf 컴포저들은 "가드 신설 → self-wire" 짝이 모두 닫혔다(T-0687→T-0688, T-0691→T-0692, T-0649~T-0651 등). 그러나 step ④ daily-test `step_eval` 진입측 컴포저 `buildRealDataDailyStepEvalCommandPlan(env)`(`realdata-e2e-daily-step-eval-command-plan.ts`, T-0611)는 아직 **독립 정합 가드가 없다**(origin/main grep 0 확인 — `assertRealDataDailyStepEvalCommandPlan*` 심볼·파일 부재). 이 컴포저는 gating 판정(`resolveRealDataE2eLiveGating(env)`)을 받아 `action`("run"/"skip"), `argv`(run 시 단일-spec bound jest 인자), `reason` 을 합성하는데, gating 결과와 산출 plan 사이의 정합(예: `enabled=true ⇒ action="run" ∧ argv 정확히 4-요소 canonical 벡터 ∧ reason==gating.reason`, `enabled=false ⇒ action="skip" ∧ argv 부재`)을 자동 강제하는 장치가 없다. 따라서 합성 회귀(action↔argv 어긋남, argv config/spec-path drift, run-skip 분기 오매핑, reason 재포장, §9 credential 값 argv/reason 누출)를 build-time 에 잡지 못한다. 본 task 는 그 짝의 **앞 절반(가드 신설)** 을 박제한다 — 산출 plan 을 입력 env 의 gating 결과로 single-source 재유도해 대조하는 read-only fail-fast 순수 가드를 신설한다. self-wire(컴포저 반환 직전 배선)는 후속 task 로 짝을 닫는다. **T-0691 scoring-call-args 가드 신설의 step④-side mirror**.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` — 가드 대상 컴포저. 산출 타입 `RealDataDailyStepEvalCommandPlan`({action, argv?, reason}) + canonical argv 상수(`REALDATA_E2E_SMOKE_JEST_CONFIG`, `REALDATA_E2E_LIVE_SMOKE_SPEC_PATH`) + run/skip 분기 로직 확인. 가드는 이 컴포저가 export 한 타입·상수를 import 재사용해 expected 를 재유도한다(중복 정의 0). **본 task 는 이 컴포저 파일을 수정하지 않는다**(self-wire 는 후속).
- `test/helpers/realdata-e2e-live-gating.ts` — gating 위임 helper `resolveRealDataE2eLiveGating(env)`({enabled, reason}) 시그니처. 가드는 입력 env 로 이 helper 를 재호출해 expected gating 을 single-source 로 재유도한다(gating 키 규칙 재구현 0 — 위임만).
- `test/helpers/realdata-e2e-scoring-call-args-consistency.ts` (origin/main, T-0691 신설) — **가드 신설 선례**. single-source 재유도 대조 구조·throw 정책(구조 불일치 TypeError / 값 불일치 RangeError 또는 Error 명세형 메시지)·read-only(입력 mutate 0)·결정론 패턴을 본 task 와 동형 차용. 한국어 명세형 에러 메시지 스타일 차용.
- `test/helpers/realdata-e2e-scoring-call-args-consistency.spec.ts` (origin/main, T-0691) — 가드 colocated spec 선례. happy/negative/branch cover 구조·재유도 대조 test 패턴 차용.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts` (origin/main) — 컴포저 기존 spec 의 R-112 cover 구조·env fixture(`REALDATA_E2E_LIVE_TEST_ENV` 등) 재사용 참고. 가드 spec 의 정상/회귀 plan fixture 구성에 차용.

## Acceptance Criteria

- [ ] 신설 가드 파일 `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts` 에 `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env)`(또는 동형 시그니처 — plan + 입력 env 를 받아 env 로 gating 재유도) 를 export 한다. 가드는 입력 env 로 `resolveRealDataE2eLiveGating(env)` 를 재호출해 expected gating 을 single-source 재유도한 뒤, plan 의 `action`/`argv`/`reason` 이 그와 정합하는지 대조한다: (a) `gating.enabled=true ⇒ plan.action==="run" ∧ plan.argv` 가 canonical 4-요소 벡터(`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_LIVE_SMOKE_SPEC_PATH]`)와 정확히 일치, (b) `gating.enabled=false ⇒ plan.action==="skip" ∧ plan.argv` 부재(undefined), (c) `plan.reason === gating.reason`. 불일치 시 한국어 명세형 에러로 fail-fast throw(구조 불일치 vs 값 불일치 분기). canonical argv 상수·spec-path 상수는 컴포저 모듈에서 import 재사용(중복 정의 0).
- [ ] 가드는 **read-only fail-fast** 만 — 입력 `plan`/`env` 를 mutate 0, 자동 복구/정규화/기본값 채움 0. 정상 정합이면 void 반환(부수효과 0). 가드는 결정론(입력만의 함수, 시각/난수/전역 env 의존 0).
- [ ] production `src/` 코드 변경 0 · 새 외부 dependency 0 · schema/migration 0 · env/네트워크/credential 0 · 컴포저 파일(`realdata-e2e-daily-step-eval-command-plan.ts`) 수정 0(self-wire 는 후속). test helper 단독 신설.
- [ ] happy-path unit test 1+ — colocated spec 에서 정상 plan(gating 전부 set → action="run" + canonical argv / gating 부재 → action="skip" + argv 부재) 각각에 대해 가드가 void(throw 0) 임을 검증. 정상 입력의 양 분기(run/skip) 모두 통과 확인.
- [ ] error path unit test 1+ — 손상 plan(예: action="run" 인데 argv 부재 / argv 가 canonical 벡터와 다름 / action="skip" 인데 argv 존재 / reason 이 gating.reason 과 불일치)에 대해 가드가 throw 함을 각 1+ test 로 검증.
- [ ] flow / branch cover — 가드의 모든 대조 분기(enabled-true 경로의 action 대조 / argv 4-요소 대조 / enabled-false 경로의 action="skip" 대조 / argv 부재 대조 / reason 대조)마다 통과 case 와 실패 case 각 1+ test.
- [ ] negative cases 충분 cover — 단일 negative 만 작성 금지, 각 회귀 유형마다 분리: (1) action↔gating.enabled 오매핑(run인데 enabled=false 또는 그 반대), (2) argv config drift(`REALDATA_E2E_SMOKE_JEST_CONFIG` 와 다른 값), (3) argv spec-path drift(`REALDATA_E2E_LIVE_SMOKE_SPEC_PATH` 와 다른 값), (4) argv 길이/순서 어긋남(`--runTestsByPath` 누락 등), (5) action="skip" 인데 argv 존재(잘못 spawn 유발), (6) reason 재포장(gating.reason 과 불일치) — 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신설 가드 helper 의 line/branch/func/stmt 높은 cover(가능하면 100%), 전역 threshold ok.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] colocated spec 위치: `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts`(가드와 colocated, 신설). 새 공용 mock helper 추출 불요 — 컴포저 기존 spec 의 env fixture(`REALDATA_E2E_LIVE_TEST_ENV` 등) + T-0691 가드 spec 패턴 재사용.

## Out of Scope

- **컴포저 self-wire(반환 직전 가드 호출 배선)** — 본 task 는 가드 신설만. 컴포저 `buildRealDataDailyStepEvalCommandPlan` 본문에 가드 호출을 삽입하는 self-wire 는 후속 task(짝 닫기, T-0692 패턴).
- **gating helper(`realdata-e2e-live-gating.ts`) 수정** — 본 task 는 호출(재유도)만. gating 키 규칙·시그니처 불변.
- **production `src/` 코드 변경** — 타입·상수·gating 함수 import 재사용만.
- **canonical argv / spec-path / smoke config 정책 변경** — 컴포저가 소유한 상수를 import 해 expected 로 쓸 뿐, 값/구성 변경 0.
- **다른 leaf 가드 신설/배선** — 본 task 는 daily-step-eval-command-plan 가드 단일 신설만. 그 외 step④ 확장은 후속.
- **live execFile / 실 jest spawn / 실 daily-test.sh step_eval wiring / Ollama / live-LLM(ADR-0045) / credential wiring** — build-time 순수 가드 신설만.
- **schema / migration / 새 dependency / auth 변경** — 없음. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).

## Suggested Sub-agents

implementer → tester (가드 신설 선례 T-0691 명확 — architect 생략. 신설 가드 파일 1개 + colocated spec 1개. single-source 재유도 대조 + 분기별 throw + R-112 4종 + negative 충분 cover).

## Follow-ups

- (본 task 머지 후) daily-step-eval-command-plan 컴포저 **self-wire** 짝 닫기 task — 컴포저 반환 직전(run/skip 양 분기 반환 전) `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env)` 호출 배선(T-0692 self-wire 패턴). 가드가 build-time 경로에 자동 발동되도록.
- step④ result-issue gh-command-plan(`resolveRealDataResultIssueGhCommandPlan`, T-0588) 계열의 잔여 가드 짝 점검 — build-time consistency 사슬의 step④ 측 완결 여부 재survey 후 planner 가 다음 짝 큐잉.
