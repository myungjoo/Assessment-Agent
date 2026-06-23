---
id: T-0611
title: 실 평가 e2e daily-test step_eval 실행 command plan 순수 컴포저 — gating 판정 + jest invocation argv 산출
phase: P5
status: DONE
completedAt: 2026-06-23T23:06:09Z
commitMode: pr
prNumber: 525
mergeCommit: ae43d37
result: "PR #525 r1 APPROVE squash merge ae43d37. step_eval gating 판정 + jest argv 순수 command plan 컴포저 + spec 박제(test-only). 4-게이트 PASS, CI green."
coversReq: [REQ-013, REQ-009, REQ-059]
estimatedDiff: 175
estimatedFiles: 2
created: 2026-06-24
plannerNote: "P5 PLAN 109행 ④ step_eval — T-0610 live smoke spec 닫힘. daily-test bash 배선 전 gating+jest argv 순수 plan 박제(gh-command-plan 동형). deploy 미변경"
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-eval-command-plan.ts
  - test/helpers/realdata-e2e-daily-step-eval-command-plan.spec.ts
---

# T-0611 — 실 평가 e2e daily-test step_eval 실행 command plan 순수 컴포저

## Why

PLAN 109행(🟢 실 평가 e2e — github.com `myungjoo`+`leemgs` 공개 활동) 의 build-time
순수 layer 는 seed → collect-args → evaluate-plan → result-issue gh-command-plan
(T-0573~T-0601) 까지 닫혔고, T-0610 이 **env-gated live smoke spec**
(`realdata-e2e-live.smoke-spec.ts` + `realdata-e2e-live-gating.ts`) 인프라를 박제했다.
남은 ④ 단계는 `deploy/daily-test.sh` 에 **`step_eval`** 을 추가해 그 live smoke 를
nightly 로 1 회 실행하는 bash 배선이다(PLAN 109행 ④).

그러나 bash step 을 직접 추가하기 전에, step_eval 이 "어떤 gating env 면 실행하고
부재 시 SKIP 할지" + "실행 시 어떤 jest invocation argv 로 live smoke spec 을 돌릴지"
의 **결정 로직을 순수 TS helper 로 분리**해 R-112 unit test 로 cover 한다. 이는
result-issue 측 `resolveRealDataResultIssueGhCommandPlan`(T-0588) 이 step④ 이슈 박제의
gh argv 합성을 순수 함수로 닫아 bash 배선이 그 산출만 execFile 하면 되게 만든 것과
**동형**이다 — bash 결정 로직을 testable 한 순수 plan 으로 외화하고, 남는 외부 경계는
jest 프로세스 spawn 한 번뿐으로 줄인다.

본 slice 는 **순수 plan 컴포저 + spec 1 쌍**만 박제한다. `deploy/daily-test.sh` 실
배선(bash `step_eval()` + `ORDER` 추가) 과 실 credential 주입·실행 1 회는 후속 slice
책임이다(period-bridge-live 가 daily-test 배선을 별도 slice 로 미룬 것과 동형).

raw 미저장(R-59) — plan 은 gating 판정 boolean + jest argv(spec 경로 + env flag 전달
정책) 만 담으며, 실 활동 본문은 구조적으로 포함되지 않는다.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-gh-command-plan.ts` — **mirror 대상**.
  분리된 순수 link 들을 단일 plan 컴포저(`{action, argv}`)로 묶는 종단 합성 패턴 +
  위임 throw 그대로 전파(자체 try/catch 0) + 결정론·무공유(매 호출 새 객체/새 argv
  배열) + 신규 type 정의 0(import type 재사용) 규율을 그대로 따른다.
- `test/helpers/realdata-e2e-live-gating.ts` — `resolveRealDataE2eLiveGating(env):
  { enabled, ... }`(T-0610). 본 컴포저는 이 gating helper 를 **소비**해 `enabled`
  분기를 plan 의 `action`(예: `"run"` | `"skip"`)으로 매핑한다. **변경 금지** — 호출만.
- `test/smoke/realdata-e2e-live.smoke-spec.ts` — step_eval 이 실행할 **대상 spec**
  (T-0610). 본 컴포저의 jest argv 가 가리킬 spec 경로(`test/smoke/realdata-e2e-live.
  smoke-spec.ts`) + 어떤 jest config(예: `--config` smoke 설정)로 돌릴지의 source.
  **변경 금지** — 경로 참조만.
- `deploy/daily-test.sh` L60~137 (`step_auth` 등 step 구현) + L139~178 (`ORDER` /
  `mark` 실행 골격) — 후속 bash 배선이 본 plan 산출을 어떻게 소비할지의 형태 확인용.
  **변경 금지** — 본 task 는 deploy 파일 미변경. 배선은 후속 slice.
- `package.json` 의 `test:smoke` script 정의 — jest smoke 실행 명령(어느 config /
  testPathPattern 으로 smoke 가 돌아가는지) 확인. 본 컴포저의 jest argv 는 이 기존
  smoke 실행 관례와 정합해야 한다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` 신설 —
  `buildRealDataDailyStepEvalCommandPlan(env): { action: "run" | "skip", argv?:
  string[], reason: string }` 순수 컴포저. (a) `resolveRealDataE2eLiveGating(env)
  .enabled === true` → `{action: "run", argv: [<jest 실행 argv — live smoke spec
  경로 + smoke config + 단일 실행 bound>], reason}`, (b) `enabled === false` →
  `{action: "skip", reason}`(argv 미포함, throw 0 — 조용한 SKIP 유도). gating
  helper(T-0610) 위임만, gating env 키 재구현 0.
- [ ] jest argv 는 **deterministic**: 동일 env 두 번 호출 → deep-equal 산출. 입력
  `env` 객체 mutate 0, 매 호출 새 plan 객체(+ 새 argv 배열) 반환. 실 credential
  값을 argv / reason 문자열에 echo 하지 않음(§9) — argv 는 spec 경로 + config flag
  만, 실 LLM/PAT 값은 자식 프로세스 env 로 별도 전달(plan 에 미포함).
- [ ] **Happy-path unit test 1+**: gating env 모두 set 된 모의 env →
  `action === "run"` + argv 가 live smoke spec 경로(`test/smoke/realdata-e2e-live.
  smoke-spec.ts`)와 smoke config 를 정확히 포함 + 단일-spec bound 검증.
- [ ] **Error path unit test 1+**: gating env 부재/공백 모의 env → `action === "skip"`
  + argv 미포함 + throw 0. 빈 객체 env → `action === "skip"`.
- [ ] **Flow / branch 분기 cover**: (a) enabled true → `"run"` 분기, (b) enabled
  false → `"skip"` 분기 각 1+ test. reason 문자열이 분기별로 구분됨 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) gating env 중 정확히 1 종 부재(부분 set) → `"skip"`(gating helper 위임 결과
    그대로 전파),
  (2) 공백만 든 env 값 → `"skip"`(gating 의 non-blank guard 동작 전파),
  (3) plan 산출이 실 credential 값을 argv 또는 reason 에 노출하지 않음(§9) — argv 는
    spec 경로/config flag 만, 부수효과 0 확인,
  (4) `"skip"` 산출 시 argv key 가 없음(undefined) — caller 가 잘못 spawn 하지 않도록
    명시적 부재 보장,
  (5) 입력 env 객체 mutate 0(무공유) — 호출 전후 deep-equal 확인 각 1+ test.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) —
  `realdata-e2e-daily-step-eval-command-plan.ts` 의 모든 분기 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- **`deploy/daily-test.sh` 변경 금지** — bash `step_eval()` 함수 추가 + `ORDER` 배선 +
  `mark` 통합은 후속 slice. 본 task 는 그 bash 가 소비할 **순수 plan 산출**만 박제한다.
- **실 credential 주입 + 실행 1 회 + 결과 daily-test 이슈 박제 금지** — period-bridge-live
  가 daily-test 배선·credentialed run 을 별도 slice 로 미룬 것과 동형. 본 task 는
  build-time 순수 helper + spec 1 쌍만.
- `realdata-e2e-live-gating.ts` / `realdata-e2e-live.smoke-spec.ts` / `realdata-e2e-
  result-issue-gh-command-plan.ts` 등 기존 helper·spec 변경 금지 — 본 컴포저는 소비/
  mirror 만(재구현 0). 시그니처·throw 계약 불변.
- `package.json` 의 `test:smoke` script 변경 금지 — 본 컴포저는 기존 smoke 실행 관례에
  정합하는 argv 를 산출할 뿐, jest config / script 정의를 바꾸지 않는다.
- DB write / Prisma migration 0 — 순수 함수 산출 검증만. raw 미저장(R-59) — plan 은
  gating boolean + jest argv 만, 실 활동 본문 미포함.
- 신규 외부 dependency 0 — 기존 helper import 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice: `deploy/daily-test.sh` 에 본 plan 산출을 소비하는 env-gated bash
  `step_eval()` 추가(gating env 부재 시 `mark eval SKIP`, set 시 plan.argv 로 jest
  spawn → exit code 로 PASS/FAIL) + `ORDER` 에 `eval` 추가 + `latest-result.json`
  요약에 eval step 반영. period-bridge-live 의 daily-test 배선 slice 동형.
- 그 다음: 실 credential 주입(로컬 Ollama LLM_LIVE_* + github read PAT) + nightly
  1 회 실행 + 결과 daily-test result/rolling 이슈 박제 = 자율 nightly 실 평가 e2e
  (PLAN 109행 ④ 완결, LAN/credential gate — cloud cron 자율 불가, 사람/LAN 머신 1 회).
- PLAN 109행 closure 후 P5 잔여 갭: R-9 사용자 지정 기간 평가문(bullet 98), R-61
  일/주/월 요약 평가(bullet 97), timezone KST 반영(bullet 110, ADR-first) 대조.
