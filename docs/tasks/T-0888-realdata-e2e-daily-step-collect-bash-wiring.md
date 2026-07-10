---
id: T-0888
title: 실 평가 e2e daily-test step_collect bash 배선 — env-gated SKIP/run + executable bash spec + CI step
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-013, REQ-009, REQ-059]
estimatedDiff: 250
estimatedFiles: 3
created: 2026-07-11
independentStream: p5-realdata-e2e-daily-runner
dependsOn: [T-0887]
touchesFiles:
  - deploy/daily-test.sh
  - deploy/daily-test-step-collect.test.sh
  - .github/workflows/ci.yml
plannerNote: "P5 PLAN 109행 ④ — T-0887 collect 컴포저 소비하는 bash step_collect 배선(gating 공유·SKIP no-op). eval-leg T-0612 mirror. 3 파일, 250 LOC, cap 내(gating 함수 재사용)."
---

# T-0888 — 실 평가 e2e daily-test step_collect bash 배선

## Why

[PLAN.md 109행](../PLAN.md) 🟢 실 평가 e2e 의 ④ 단계는 `deploy/daily-test.sh` 가 nightly 로
실 github 수집 leg + 실 LLM 평가 leg 를 각 1 회 round-trip 하는 자율 nightly 실 평가 e2e 다.
현재 `step_eval`(T-0612 배선)은 LLM 평가 leg(`realdata-e2e-live.smoke-spec.ts`, T-0610)만
spawn 하고, 실 github.com 수집 leg(`realdata-e2e-github-collection-live.smoke-spec.ts`,
T-0806)는 nightly runner 가 한 번도 실행하지 않는 gap 이 남아 있다.

T-0887 (PR #781, merged)이 그 gap 을 메우는 첫 slice 로 **순수 TS 컴포저**
`buildRealDataDailyStepCollectCommandPlan(env) → {action:run|skip, argv?, reason}` 를
외화하고 R-112 unit test 로 cover 했다. 본 slice 는 그 산출을 **소비하는 bash
`step_collect()`** 을 배선한다 — eval-leg 이 T-0611(컴포저) → **T-0612(bash 배선)** 순으로
쌓은 것과 **동형**이다.

핵심 안전 속성 — **gating env 부재 시 SKIP(no-op)**: collect leg 의 gating env 는 eval leg
과 동일한 7 종(`REALDATA_E2E_*`)이라 daily-test.sh 에 이미 존재하는
`realdata_eval_gating_enabled()`(T-0612 신설, 7 종 공유)를 **그대로 재사용**한다 — 새 gating
함수 추가 0. 따라서 gating env 가 모두 present+non-blank 이고 선행 체인이 PASS 일 때만
collection live smoke 를 spawn 하고, 그 외에는 `mark collect SKIP`(조용한 SKIP, 네트워크
0 / secret 0 / jest spawn 0)으로 끝난다. cloud CI 및 gating env 가 없는 모든 환경에서
본 step 은 no-op 이며, 실 credential 주입+실행은 LAN 머신에서만 발화한다.

bash 로직 자체의 R-112 cover 는 `deploy/daily-test-step-eval.test.sh` 동형의 **executable
bash spec**(`deploy/daily-test-step-collect.test.sh`)로 박제하고, CI 에 그 self-test step
을 추가한다. raw 미저장(R-59) — bash 는 gating boolean 판정 + jest argv spawn 만.

## Required Reading

- `deploy/daily-test.sh` L140~264 — **변경 대상**. (a) `step_eval()`(L182~195) 골격을
  mirror 해 `step_collect()` 함수 추가(argv 의 spec 경로만 collection spec 으로 교체),
  (b) `ORDER=(redeploy health liveness auth eval)`(L203)에 `collect` 추가, (c) `eval`
  분기(L249~264) 골격을 mirror 해 `collect` 의 SKIP/run 분기 실행 + `mark`,
  (d) `steps_json` 조립(L274~279)은 `ORDER` 순회라 자동 반영(추가 코드 불요). 기존
  redeploy/health/liveness/auth/eval step 로직·`realdata_eval_gating_enabled()`(gating
  7 종 공유) 는 **불변** — 재사용만.
- `test/helpers/realdata-e2e-daily-step-collect-command-plan.ts` (T-0887) — bash 가 mirror
  할 **source-of-truth**. run 분기 argv(`--config ./test/jest-smoke.json --runTestsByPath
  test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`)·skip/run 분기·credential
  echo 0 규율을 bash 가 그대로 따른다. **변경 금지** — 동작 mirror 만(bash 에서 TS import
  불가하므로 argv 상수를 bash 에 동일 박제하되, 이 helper 가 정본임을 주석으로 명시).
- `deploy/daily-test-step-eval.test.sh` (T-0612) 전문 — 본 task 의
  `deploy/daily-test-step-collect.test.sh` 가 그대로 따를 **executable bash spec 패턴**
  (source 가드로 함수만 노출 → 직접 호출, `assert_*` helper + happy/negative/edge + `fail`
  누적 + 마지막 exit). collect 버전은 이 spec 을 mirror 하되 argv 검증 대상을 collection
  spec 경로로 교체하고 `step_collect`/`collect` 분기를 검증한다(jest 실 spawn 0).
- `.github/workflows/ci.yml` L130~136 (`deploy/daily-test-step-eval.test.sh` self-test
  step) + L290 (`bash -n deploy/daily-test.sh` 구문 검사) — 본 task 는 (a) L290 syntax
  검사는 그대로 daily-test.sh 변경을 cover, (b) `deploy/daily-test-step-collect.test.sh`
  self-test step 을 L136 step 동형으로 추가. **다른 step 변경 금지**.

## Acceptance Criteria

- [ ] `deploy/daily-test.sh` 에 `step_collect()` 함수 추가 — gating 활성(공유
  `realdata_eval_gating_enabled()` = 7 종 모두 present+non-blank) 시 collection live smoke
  를 argv(`--config ./test/jest-smoke.json --runTestsByPath
  test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts`)로 spawn → exit 0 면 PASS
  (return 0), non-zero 면 FAIL(return 1). T-0887 plan helper 의 run 분기 산출을 bash 로
  mirror(정본은 그 helper — 주석 명시). 새 gating 함수 추가 0(기존 공유 함수 재사용).
- [ ] `ORDER` 에 `collect` 추가. `collect` step 은 **선행 체인 PASS(auth PASS)** AND
  gating env 7 종 set 일 때만 실행하고, 그 외(체인 미통과 또는 gating 부재)면 `mark collect
  SKIP`. `steps_json` 조립은 `ORDER` 순회라 자동 반영(추가 코드 불요) 확인. 기존 4 step +
  eval 의 mark/순서/JSON 키 불변(append 배치로 기존 분기 positional churn 최소화).
- [ ] gating 부재 시(cloud CI / 일반 LAN) `step_collect` 는 **네트워크 0 / secret 접근 0 /
  jest spawn 0** — `mark collect SKIP` 으로만 끝나 기존 daily-test 동작(redeploy~eval)을
  깨지 않음(no-op). 실 credential 값을 로그·result JSON 에 echo 0(§9) — gating env *이름*
  만 진단 로그(공유 gating 함수가 이미 담당).
- [ ] `deploy/daily-test-step-collect.test.sh` 신설 — `daily-test-step-eval.test.sh` 동형의
  순수 bash executable spec. daily-test.sh 를 source(BASH_SOURCE 가드로 함수만 노출)하여
  `step_collect`/gating 판정/argv 산출을 직접 검증(jest 실 spawn 0 — argv 산출·SKIP/run
  분기·credential echo 0 만 검사). 네트워크/의존성 0, 마지막에 `fail` 누적 결과로 exit.
- [ ] **Happy-path test 1+**: gating env 7 종 모두 set 된 모의 env → `step_collect` 결정이
  **run** + argv 가 collection smoke spec 경로(`test/smoke/realdata-e2e-github-collection-
  live.smoke-spec.ts`) + smoke config(`./test/jest-smoke.json`)를 정확히 포함 검증(실 jest
  spawn 없이 argv 합성만 assert).
- [ ] **Error path test 1+**: gating env 부재/빈 env → 결정이 **skip** + argv 미합성 +
  `step_collect` 이 throw/비정상 종료 0(SKIP 신호로만 종료). 선행 체인 미통과 모의 →
  `mark collect SKIP`.
- [ ] **Flow / branch 분기 cover**: (a) gating 완전 → run 분기, (b) gating 부재 → skip
  분기, (c) 체인 미통과(auth FAIL/SKIP) → skip 분기 각 1+ test. 분기별 진단 사유 문자열
  구분 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) gating env 중 정확히 1 종만 부재(부분 set) → skip(완전성 규칙 mirror),
  (2) gating env 값이 공백-only(` `) → skip(non-blank guard mirror),
  (3) collection jest exit non-zero 모의 → `mark collect FAIL`(SKIP 과 구분, FAILED_STEP
    반영),
  (4) skip 산출 시 jest spawn 0 + 실 credential 값 로그/JSON echo 0(§9) 확인,
  (5) 기존 5 step(redeploy/health/liveness/auth/eval) 결과·result JSON 형식이 collect
    추가로 회귀하지 않음(ORDER 순회 호환) 각 1+ test.
- [ ] **argv parity assert**: collect 산출 argv 가 T-0887 컴포저의 run 분기 canonical
  4-요소 벡터(config + `--runTestsByPath` + collection spec path)와 정확히 일치하고,
  eval leg argv(spec 경로만 다름)와 교차오염 0(collect spec 을 가리키는지) 검증.
- [ ] `.github/workflows/ci.yml` 에 `deploy/daily-test-step-collect.test.sh` self-test step
  추가 — L136 `bash deploy/daily-test-step-eval.test.sh` step 동형(`run: bash deploy/
  daily-test-step-collect.test.sh`). 기존 `bash -n deploy/daily-test.sh` syntax 검사 step
  은 daily-test.sh 변경을 자동 cover(불변).
- [ ] `bash -n deploy/daily-test.sh` 및 `bash -n deploy/daily-test-step-collect.test.sh`
  구문 통과. `bash deploy/daily-test-step-collect.test.sh` 전부 PASS(fail=0, exit 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green — TS 변경 0 이므로 build/test 무회귀.
  본 task 의 bash 로직 R-112 cover 는 executable bash spec(line/branch 분기 충분 cover)이
  담당(jest coverageThreshold 는 TS 대상이라 bash 미적용 — bash spec 의 분기 cover 로
  R-112 충족 명시).

## Out of Scope

- **실 credential 주입 + nightly 실행 1 회 + 결과 daily-test result/rolling 이슈 박제 금지**
  — eval-leg 이 credentialed run 을 별도 slice 로 미룬 것과 동형. 본 task 는 gating 부재
  시 SKIP 으로만 동작하는 build-time/배선 layer 까지. 실 LAN 발화는 후속.
- **`test/helpers/realdata-e2e-daily-step-collect-command-plan.ts`(T-0887) /
  `realdata-e2e-live-gating.ts`(T-0610) / `realdata-e2e-github-collection-live.smoke-
  spec.ts`(T-0806) 변경 금지** — bash 는 소비/mirror 만(재구현 0). 시그니처·argv·gating
  규칙 불변.
- **collection-leg 전용 parity-drift smoke 가드 신설** — eval-leg 이 T-0790 별도 slice 로
  shell argv ↔ helper plan full-vector parity-drift smoke spec 을 붙인 것과 대칭으로 후속
  slice(`...-step-collect-shell-argv-helper-plan-full-vector-parity-drift.smoke-spec.ts`).
  본 task 는 bash spec 내 argv assert 로 1 차 parity 만 담보하고 smoke-레벨 parity 가드는
  Follow-up.
- **collection-leg 전용 command-plan consistency 가드 신설** — eval-leg 이 T-0693 별도
  slice 로 붙인 것과 대칭으로 후속 slice. 본 task 는 bash 배선만.
- **`package.json` 의 `test:smoke`/jest config 변경 금지** — bash 의 jest argv 는 기존
  smoke 실행 관례(`./test/jest-smoke.json`)에 정합하는 인자를 합성할 뿐 config 정의를
  바꾸지 않는다.
- **기존 5 step(redeploy/health/liveness/auth/eval) 로직 변경 금지** — `ORDER` 에
  `collect` 추가 + `step_collect()` 신설 + 그 분기 실행만. 다른 step 의 mark/순서/JSON 키
  불변. 공유 `realdata_eval_gating_enabled()` 는 재사용만(수정 0).
- DB write / Prisma migration 0. 새 외부 dependency 0. raw 미저장(R-59).
- **`.github/workflows/ci.yml` 의 다른 step 변경 금지** — self-test step 1 개 추가만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 task 머지 후) collection-leg **parity-drift smoke 가드** 신설 — eval-leg T-0790
  mirror. bash `step_collect` shell argv ↔ T-0887 helper plan full-vector parity 를
  smoke-레벨에서 대조(`test/smoke/realdata-e2e-daily-test-step-collect-shell-argv-helper-
  plan-full-vector-parity-drift.smoke-spec.ts`).
- (본 task 머지 후) collection-leg **command-plan consistency 가드** 신설 + self-wire —
  eval-leg T-0693→T-0694 mirror. `buildRealDataDailyStepCollectCommandPlan` 산출 ↔ gating
  single-source 재유도 정합 read-only 가드 + 컴포저 반환 직전 self-wire.
- PLAN 109행 closure 후 P5 잔여 갭: R-9 사용자 지정 기간 평가문(bullet 98), R-61 일/주/월
  요약 평가(bullet 97), timezone KST 반영(bullet 110, ADR-first) 대조.
