---
id: T-0890
title: realdata-e2e daily-step-collect-command-plan 컴포저 산출 ↔ gating single-source 재유도 정합 순수 가드 신설 (eval-leg T-0693 collect-leg mirror)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-013, REQ-059]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-07-11
independentStream: realdata-e2e-consistency-guard
dependsOn: [T-0887]
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts
  - test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts
plannerNote: "P5 §109 step④ — T-0889 Follow-up slice(a) 앞절반. eval-leg T-0693 mirror: collect 컴포저 산출 plan ↔ gating single-source 재유도 정합 가드 신설(self-wire 는 후속 T-0891). guard category × 1.5 × 1.0."
---

# T-0890 — realdata-e2e daily-step-collect-command-plan 컴포저 산출 ↔ gating single-source 재유도 정합 순수 가드 신설

## Why

[PLAN.md 109행](../PLAN.md)(🟢 실 평가 e2e, P5)의 build-time consistency 가드 사슬에서 **eval-leg** 은 step④ daily-test `step_eval` 진입측 컴포저에 대해 "가드 신설(T-0693) → self-wire(T-0694)" 짝을 이미 닫았다. **collect-leg** 은 T-0887(컴포저) → T-0888(bash 배선) → T-0889(shell↔TS full-vector parity drift smoke, PR #783 merged)까지 채웠으나, 그 진입측 컴포저 `buildRealDataDailyStepCollectCommandPlan(env)`(`realdata-e2e-daily-step-collect-command-plan.ts`, T-0887)에는 아직 **독립 정합 가드가 없다**(origin/main grep 0 확인 — `assertRealDataDailyStepCollectCommandPlan*` 심볼·파일 부재. 기존 `*collect*consistency*` 파일은 seed-collect-call-args / seed-collect-input 계열로 별개 표면).

이 컴포저는 gating 판정(`resolveRealDataE2eLiveGating(env)`)을 받아 `action`("run"/"skip"), `argv`(run 시 단일-spec bound jest 인자 4-요소 벡터), `reason` 을 합성하는데, gating 결과와 산출 plan 사이의 정합(예: `enabled=true ⇒ action="run" ∧ argv 정확히 4-요소 canonical 벡터 ∧ reason==gating.reason`, `enabled=false ⇒ action="skip" ∧ argv 부재`)을 자동 강제하는 장치가 없다. 따라서 합성 회귀(action↔argv 어긋남, argv config/spec-path drift, run-skip 분기 오매핑, reason 재포장, §9 credential 값 argv/reason 누출)를 build-time 에 잡지 못한다.

본 task 는 그 짝의 **앞 절반(가드 신설)** 을 collect-leg 에 박제한다 — 산출 plan 을 입력 env 의 gating 결과로 single-source 재유도해 대조하는 read-only fail-fast 순수 가드를 신설한다. self-wire(컴포저 반환 직전 배선)는 후속 task(T-0891 짝 닫기)로. **eval-leg T-0693(가드 신설) 의 collect-leg mirror** — T-0889 Follow-up slice (a) 의 앞 절반.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts` (T-0887) — **가드 대상 컴포저**. 산출 타입 `RealDataDailyStepCollectCommandPlan`({action: "run"|"skip", argv?: string[], reason: string}) + canonical argv 상수 `REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`, 45행) · `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH`(`test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`, 40행) + run/skip 분기 로직(82~108행: skip → argv 부재 / run → 4-요소 ordered 벡터 `["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH]`) 확인. 가드는 이 컴포저가 export 한 타입·상수를 import 재사용해 expected 를 재유도한다(중복 정의 0). **본 task 는 이 컴포저 파일을 수정하지 않는다**(self-wire 는 후속 T-0891).
- `test/helpers/realdata-e2e-live-gating.ts` — gating 위임 helper `resolveRealDataE2eLiveGating(env)`({enabled, reason}) 시그니처. 가드는 입력 env 로 이 helper 를 재호출해 expected gating 을 single-source 로 재유도한다(gating 키 규칙 재구현 0 — 위임만).
- `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.ts` (origin/main, T-0693 신설) — **eval-leg 동형 가드 정본**. `assertRealDataDailyStepEvalCommandPlanConsistentWithGating(plan, env)` 의 single-source 재유도 대조 구조·throw 정책(구조 불일치 vs 값 불일치 분기, 한국어 명세형 에러 메시지)·read-only(입력 mutate 0)·결정론 패턴을 본 task 가 collect-leg 로 mirror(helper·상수·spec 경로만 collect 로 교체). 시그니처·에러 스타일 확인.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan-consistency.spec.ts` (origin/main, T-0693) — **eval-leg 가드 colocated spec 정본**. happy/negative/branch cover 구조·재유도 대조 test 패턴·env fixture 구성을 collect-leg 로 mirror. spec 위치 ordering 확인용(colocated 우선).
- `test/helpers/realdata-e2e-daily-step-collect-command-plan.spec.ts` (origin/main, T-0887) — 컴포저 기존 spec 의 R-112 cover 구조·gating-enabled/disabled env fixture(7종 env 합성 규칙) 재사용 참고. 가드 spec 의 정상/회귀 plan fixture 구성에 차용.

## Acceptance Criteria

신규 파일 2개(`test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts` + colocated `.spec.ts`)를 추가한다. test helper 단독 신설, production `src/` 변경 0. 다음을 모두 만족한다:

- [ ] **가드 export + single-source 재유도 대조**: `assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env)`(또는 동형 시그니처 — plan + 입력 env 를 받아 env 로 gating 재유도) 를 export 한다. 가드는 입력 env 로 `resolveRealDataE2eLiveGating(env)` 를 재호출해 expected gating 을 single-source 재유도한 뒤, plan 의 `action`/`argv`/`reason` 정합을 대조한다: (a) `gating.enabled=true ⇒ plan.action==="run" ∧ plan.argv` 가 canonical 4-요소 ordered 벡터(`["--config", REALDATA_E2E_SMOKE_JEST_CONFIG, "--runTestsByPath", REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH]`)와 정확히 일치(요소값·순서·길이 1:1), (b) `gating.enabled=false ⇒ plan.action==="skip" ∧ plan.argv` 부재(undefined), (c) `plan.reason === gating.reason`. 불일치 시 한국어 명세형 에러로 fail-fast throw(구조 불일치 vs 값 불일치 분기). canonical argv 상수·spec-path 상수는 컴포저 모듈에서 import 재사용(중복 정의 0).
- [ ] **read-only fail-fast + 결정론**: 가드는 입력 `plan`/`env` 를 mutate 0, 자동 복구/정규화/기본값 채움 0. 정상 정합이면 void 반환(부수효과 0). 결정론(입력만의 함수 — 시각/난수/전역 env 의존 0).
- [ ] **Happy-path unit test 1+**: colocated spec 에서 정상 plan(gating-enabled env → action="run" + canonical argv / gating-disabled env → action="skip" + argv 부재) 각각에 대해 가드가 void(throw 0) 임을 검증. 정상 입력의 양 분기(run/skip) 모두 통과 확인.
- [ ] **Error path unit test 1+**: 손상 plan(예: action="run" 인데 argv 부재 / argv 가 canonical 벡터와 다름 / action="skip" 인데 argv 존재 / reason 이 gating.reason 과 불일치)에 대해 가드가 throw 함을 각 1+ test 로 검증.
- [ ] **Flow / branch cover**: 가드의 모든 대조 분기(enabled-true 경로의 action 대조 / argv 4-요소 대조 / enabled-false 경로의 action="skip" 대조 / argv 부재 대조 / reason 대조)마다 통과 case 와 실패 case 각 1+ test.
- [ ] **Negative cases 충분 cover** — 단일 negative 만 작성 금지, 각 회귀 유형마다 test 분리:
  - (1) **action↔gating.enabled 오매핑** — run 인데 gating-disabled env, 또는 skip 인데 gating-enabled env → throw 각 1+.
  - (2) **argv config drift** — `REALDATA_E2E_SMOKE_JEST_CONFIG`(`./test/jest-smoke.json`)와 다른 config 값을 담은 plan → throw 1+.
  - (3) **argv spec-path drift** — `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` 와 다른 spec 경로(특히 eval-leg spec `test/smoke/realdata-e2e-live.smoke-spec.ts` 로의 교차오염)를 담은 plan → throw 1+.
  - (4) **argv 길이/순서 어긋남** — `--runTestsByPath` 누락 / flag↔value 순서 뒤집힘 / 요소 개수 mismatch plan → throw 1+.
  - (5) **action="skip" 인데 argv 존재** — 잘못 spawn 유발 plan → throw 1+.
  - (6) **reason 재포장** — gating.reason 과 불일치하는 reason plan → throw 1+.
- [ ] **credential 누출 0(REQ-059 / §9)**: gating-enabled env 에 placeholder credential 을 넣어 가드를 통과시켰을 때, 가드가 접근/비교하는 어떤 문자열(에러 메시지 포함)에도 GH_TOKEN/PAT/Bearer/Authorization/실 토큰 placeholder 값이 등장하지 않음을 정규식 단언 1+ test(argv 는 jest 실행 인자만·credential 미surface).
- [ ] **R-112 coverage 보장**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신설 가드 helper 의 line/branch/func/stmt 높은 cover(가능하면 100%), 전역 threshold ok.
- [ ] **lint+build green**: `pnpm lint && pnpm build && pnpm test` green. 가드 typing 이 컴포저 export type(`RealDataDailyStepCollectCommandPlan`·상수 string type·`plan.action` "run"/"skip" union narrowing·`plan.argv?: string[]` optional narrowing)과 정합.
- [ ] **colocated spec 위치**: `test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.spec.ts`(가드와 colocated, 신설). 새 공용 mock helper 추출 불요 — 컴포저 기존 spec 의 gating env fixture + T-0693 가드 spec 패턴 재사용.

## Out of Scope

- **컴포저 self-wire(반환 직전 가드 호출 배선)** — 본 task 는 가드 신설만. 컴포저 `buildRealDataDailyStepCollectCommandPlan` 본문에 `assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env)` 호출을 삽입하는 self-wire 는 후속 task(짝 닫기, eval-leg T-0694 패턴 mirror).
- **gating helper(`realdata-e2e-live-gating.ts`) 수정** — 본 task 는 호출(재유도)만. gating 키 규칙·시그니처 불변.
- **production `src/` 코드 변경 / 새 외부 dependency / schema·migration / env·네트워크·credential / package.json / CI workflow** — 없음. test helper 단독 신설. 컴포저 타입·상수·gating 함수 import 재사용만. 하나라도 필요해지면 즉시 멈추고 BLOCKED(planner 재호출).
- **컴포저 파일(`realdata-e2e-daily-step-collect-command-plan.ts`) 수정** — self-wire 는 후속.
- **canonical argv / spec-path / smoke config 정책 변경** — 컴포저가 소유한 상수를 import 해 expected 로 쓸 뿐, 값/구성 변경 0.
- **shell↔TS parity smoke(T-0889) / bash test(T-0888) 재구현** — 본 task 는 TS 컴포저 산출↔gating single-source 재유도 정합 가드만(별개 표면 — parity smoke 는 shell 사본 대조, 본 가드는 gating 재유도 대조).
- **다른 leaf 가드 신설 / step④ 확장** — collect-command-plan 가드 단일 신설만. 그 외는 후속.
- **live execFile / 실 jest spawn / 실 daily-test.sh step_collect wiring / 실 collectForPerson / Ollama / live-LLM / credential wiring** — build-time 순수 가드 신설만.

## Suggested Sub-agents

`implementer → tester` (가드 신설 선례 eval-leg T-0693 명확 — architect 생략. 신설 가드 파일 1개 + colocated spec 1개. eval-leg `realdata-e2e-daily-step-eval-command-plan-consistency.ts` 를 정본으로 mirror 하되 (a) helper 를 `buildRealDataDailyStepCollectCommandPlan`/`resolveRealDataE2eLiveGating` 로, (b) 상수를 `REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH`/`REALDATA_E2E_SMOKE_JEST_CONFIG` 로, (c) 타입을 `RealDataDailyStepCollectCommandPlan` 으로 교체. single-source 재유도 대조 + 분기별 throw + R-112 4종 + negative 충분 cover(action↔gating 오매핑·config drift·spec-path drift(eval-leg 교차오염)·순서/길이 어긋남·skip 인데 argv·reason 재포장). canonical argv 상수는 컴포저 모듈에서 import(중복 정의 0), credential placeholder 만(§9).)

## Follow-ups

(없음 — 단, 본 task 머지 후 **collect-leg command-plan self-wire 짝 닫기 task(T-0891 예정)** — 컴포저 `buildRealDataDailyStepCollectCommandPlan` 반환 직전(run/skip 양 분기 반환 전) `assertRealDataDailyStepCollectCommandPlanConsistentWithGating(plan, env)` 호출 배선(eval-leg T-0694 self-wire 패턴 mirror). 가드가 build-time 경로에 자동 발동되도록. 이후 P5 잔여 갭: R-9 사용자 지정 기간 평가문(bullet 98)·R-61 일/주/월 요약 평가(bullet 97)·timezone KST(bullet 110, ADR-first) — 별도 슬라이스.)
