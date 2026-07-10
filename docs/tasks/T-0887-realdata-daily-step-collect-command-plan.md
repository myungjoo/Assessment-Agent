---
id: T-0887
title: 실 평가 e2e daily-test step_collect 실행 command plan 순수 컴포저 — gating 판정 + github-collection leg jest argv 산출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-059]
estimatedDiff: 185
estimatedFiles: 2
created: 2026-07-11
independentStream: p5-realdata-e2e-daily-runner
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-collect-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-collect-command-plan.spec.ts
plannerNote: "P5 PLAN 109행 ④ — collection leg(T-0806) 이 nightly runner 미실행 gap. eval-plan(T-0611) mirror 로 collection command plan 순수 컴포저 박제. bash 배선은 후속 slice, deploy 미변경."
---

# T-0887 — 실 평가 e2e daily-test step_collect command plan 순수 컴포저

## Why

[PLAN.md 109행](../PLAN.md) 🟢 실 평가 e2e 의 ④ 단계는 `deploy/daily-test.sh` 가 nightly 로 실 github 수집 + 실 LLM 평가를 각 1 회 round-trip 하는 **자율 nightly 실 평가 e2e** 다. 현재 `step_eval`(daily-test.sh) 은 LLM 평가 leg(`realdata-e2e-live.smoke-spec.ts`, T-0610) 만 spawn 하고, 실 github.com 수집 leg(`realdata-e2e-github-collection-live.smoke-spec.ts`, T-0806) 는 **nightly runner 가 한 번도 실행하지 않는다** (grep 확인: `deploy/` 에 collection-live 참조 0). 즉 자율 nightly e2e 가 실 github 수집 round-trip 을 빠뜨린 채 돌고 있다.

본 task 는 그 gap 을 메우는 **첫 slice** 다. eval leg 이 T-0610(live smoke spec) → T-0611(bash 배선 전 gating+argv 순수 command plan) → 이후 bash `step_eval` 순으로 쌓인 것과 **동형**으로, collection leg 도 T-0806(live smoke spec 이미 존재) → 본 task(gating+argv 순수 command plan) → 후속 bash `step_collect` 순으로 쌓는다. 본 task 는 순수 TS 컴포저 + colocated spec 만 박제하고 `deploy/` 는 건드리지 않는다 (bash 배선은 후속 slice — parity 가드 동반).

## Required Reading

- [test/helpers/realdata-e2e-daily-step-eval-command-plan.ts](../../test/helpers/realdata-e2e-daily-step-eval-command-plan.ts) — mirror 대상 eval-leg 컴포저 (T-0611). argv 구조·순수성·§9 credential-echo 금지 관용구를 그대로 따른다.
- [test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts](../../test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts) — mirror 대상 colocated spec 의 test 구성(run/skip 분기 + negative).
- [test/helpers/realdata-e2e-live-gating.ts](../../test/helpers/realdata-e2e-live-gating.ts) — `resolveRealDataE2eLiveGating(env)` gating 위임 대상 (gating env 키 재구현 금지 — 이 helper 에 전적 위임).
- [test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts](../../test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts) — argv 가 `--runTestsByPath` 로 가리킬 대상 spec (T-0806, 경로 = `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`).

## Acceptance Criteria

신설 파일 2개 (colocated spec 위치는 helper 와 동일 디렉토리 `test/helpers/`):

- [ ] `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts` 신설 — 순수 컴포저 `buildRealDataDailyStepCollectCommandPlan(env)` export. eval-leg 컴포저와 동형이되 argv 의 spec 경로만 collection spec(`test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`) 로 교체. spec 경로·jest config 경로는 named export 상수(`REALDATA_E2E_GITHUB_COLLECTION_SMOKE_SPEC_PATH` 등)로 박제. gating 판정은 `resolveRealDataE2eLiveGating(env)` 에 위임(gating env 키 재구현 0).
- [ ] 반환 타입은 eval-leg 과 동형 `{ action: "run" | "skip"; argv?: string[]; reason: string }`. `action="run"` 시 argv = `["--config", <smoke jest config>, "--runTestsByPath", <collection spec path>]` canonical 4-요소 벡터. `action="skip"` 시 argv 부재(undefined).
- [ ] **Happy-path unit test** (`...spec.ts`): gating env 7 종 모두 set → `action==="run"`, argv 가 canonical 4-요소 벡터와 정확히 일치(config·`--runTestsByPath`·collection spec path), `reason` 은 gating.reason 전파.
- [ ] **Error/negative path unit test**: gating env 1+ 부재 → `action==="skip"`, argv 미존재(undefined), throw 0(조용한 skip). null/undefined/비-객체 env 입력에 대한 방어 동작 검증(eval-leg spec 의 negative 케이스 mirror).
- [ ] **Flow / branch coverage**: run 분기·skip 분기 각각 1+ test (gating enabled/disabled 두 분기 모두 cover).
- [ ] **Negative cases 충분 cover**: (a) gating env 각 키별 부재 시 skip, (b) 빈 문자열/공백-only 값이 부재로 취급되는지(gating helper 위임 결과 반영), (c) 실 credential 값(PAT·API key·base URL)이 argv/reason 어디에도 echo 되지 않음(§9) — argv 는 spec 경로 + config flag 만 담음, (d) 매 호출 새 plan 객체 + 새 argv 배열 반환(입력 env mutate 0, 결정론) 각 1+ test.
- [ ] **Coverage 최소치**: `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green (신규 helper 는 pure TS, 새 외부 dependency 0 — Node 내장만).

## Out of Scope

- `deploy/daily-test.sh` / `deploy/daily-test-step-eval.test.sh` bash 배선 (후속 slice — `step_collect` 함수 + ORDER 배열 + parity-drift smoke 가드 동반). 본 task 는 순수 컴포저만.
- 기존 eval-leg 컴포저(`realdata-e2e-daily-step-eval-command-plan.ts`)·그 consistency 가드·parity-drift smoke spec 수정 (canonical eval 벡터 불변 — 본 task 는 순수 additive 신설이라 eval 측 parity 무영향).
- collection leg 전용 consistency 가드(`...-collect-command-plan-consistency.ts`) 신설 (eval-leg 은 T-0693 별도 slice 로 가드를 붙였음 — 본 collect 컴포저의 대칭 가드도 후속 slice. 단 컴포저 내 self-assert 를 넣을지는 구현 재량 — Follow-up 참조).
- 실 credential 주입·실 네트워크 실행 (§5 ops 게이트, 오너 승인됨 — Q-0051). 본 task 는 env-gated skip-by-default 결정 로직만.
- `package.json` script / jest config 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
