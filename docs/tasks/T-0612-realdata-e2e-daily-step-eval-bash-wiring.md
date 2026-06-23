---
id: T-0612
title: 실 평가 e2e daily-test step_eval bash 배선 — env-gated SKIP/run + executable bash spec + CI step
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-013, REQ-009, REQ-059]
estimatedDiff: 160
estimatedFiles: 3
created: 2026-06-24
plannerNote: "P5 PLAN 109행 ④ step_eval bash 배선 — T-0611 순수 plan 닫힘. gating 부재→SKIP(cloud-safe no-op), set→jest spawn. bash spec + CI step 동반"
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - deploy/daily-test.sh
  - deploy/daily-test-step-eval.test.sh
  - .github/workflows/ci.yml
---

# T-0612 — 실 평가 e2e daily-test step_eval bash 배선

## Why

PLAN 109행(🟢 실 평가 e2e — github.com `myungjoo`+`leemgs` 공개 활동) 의 ④ 단계는
`deploy/daily-test.sh` 에 **`step_eval`** 을 추가해 T-0610 의 env-gated live smoke
spec(`realdata-e2e-live.smoke-spec.ts`)을 nightly 1 회 실행하는 bash 배선이다.

T-0611 (PR #525, squash ae43d37) 이 그 bash 가 소비할 **결정 로직을 순수 TS 컴포저**
`buildRealDataDailyStepEvalCommandPlan(env)→{action:run|skip, argv?, reason}` 로 외화하고
R-112 unit test 로 cover 했다. 본 slice 는 그 산출을 **소비하는 bash `step_eval()`** 을
배선한다.

핵심 안전 속성 — **gating env 부재 시 SKIP(no-op)**: 본 step 은 gating env(`REALDATA_E2E_*`
7 종) 가 모두 present+non-blank 일 때만 jest live smoke 를 spawn 하고, 부재 시 `mark eval
SKIP`(조용한 SKIP, 네트워크 0 / secret 0 / LLM 호출 0)으로 끝난다. 따라서 **cloud CI 및
gating env 가 없는 모든 환경에서 본 step 은 no-op** 이며, 실 credential 주입+실행은 LAN
머신(로컬 Ollama + github read PAT)에서만 발화한다(`deploy/redeploy.sh`·`seed-llm-config.sh`
와 동일 운영 경계).

bash 로직 자체의 R-112 cover 는 `scripts/check-doc-only-pr.test.sh` 동형의 **executable
bash spec**(`deploy/daily-test-step-eval.test.sh`)로 박제하고, CI 에 그 self-test step 을
추가한다(기존 select-claim.test.sh / check-doc-only-pr.test.sh step 동형). raw 미저장(R-59)
— bash 는 gating boolean 판정 + jest argv spawn 만, 실 활동 본문은 구조적으로 미포함.

## Required Reading

- `deploy/daily-test.sh` L60~137 (`step_*` 구현 골격) + L139~211 (`ORDER` / `mark` /
  결과 JSON 조립) — **변경 대상**. 본 task 는 (a) `step_eval()` 함수 추가, (b) `ORDER`
  에 `eval` 추가, (c) `eval` step 의 SKIP/run 분기 실행 + `mark`, (d) `steps_json` 에
  자동 반영(ORDER 순회라 추가 코드 불요) 만. 기존 redeploy/health/liveness/auth step
  로직은 불변.
- `test/helpers/realdata-e2e-daily-step-eval-command-plan.ts` (T-0611) — bash 가 mirror
  할 **source-of-truth**. argv 산출(`--config ./test/jest-smoke.json --runTestsByPath
  test/smoke/realdata-e2e-live.smoke-spec.ts`)·skip/run 분기·credential echo 0 규율을
  bash 가 그대로 따른다. **변경 금지** — 동작 mirror 만(bash 에서 TS import 불가하므로
  argv 상수를 bash 에 동일하게 박제하되, 이 helper 가 정본임을 주석으로 명시).
- `test/helpers/realdata-e2e-live-gating.ts` (T-0610) L34~60 — gating env 7 종 이름
  상수(`REALDATA_E2E_LIVE_TEST` + LLM 5 종 + `REALDATA_E2E_GITHUB_READ_PAT`) + non-blank
  완전성 규칙. bash 의 gating 검사는 이 7 종 모두 present+non-blank 여부를 mirror 한다.
  **변경 금지** — 이름·규칙 참조만.
- `scripts/check-doc-only-pr.test.sh` 전문 — bash executable spec 패턴(`assert_*`
  helper + happy/negative/edge case + `fail` 누적 + 마지막 exit). 본 task 의
  `deploy/daily-test-step-eval.test.sh` 는 이 형태를 그대로 따른다(순수 bash, 네트워크
  0, jest 실 spawn 0 — gating 판정·argv·SKIP 분기만 검증).
- `.github/workflows/ci.yml` L86~112 (bash `*.test.sh` self-test step 들) + L255
  (`bash -n deploy/daily-test.sh` 구문 검사) — 본 task 는 (a) L255 syntax 검사는 그대로
  daily-test.sh 변경을 cover, (b) `deploy/daily-test-step-eval.test.sh` self-test step
  을 select-claim.test.sh 동형으로 추가. **다른 step 변경 금지**.

## Acceptance Criteria

- [ ] `deploy/daily-test.sh` 에 `step_eval()` 함수 추가 — gating env 7 종(`REALDATA_E2E_
  LIVE_TEST` + LLM 5 종 + `REALDATA_E2E_GITHUB_READ_PAT`) 이 **모두 present+non-blank**
  이면 jest live smoke 를 argv(`--config ./test/jest-smoke.json --runTestsByPath
  test/smoke/realdata-e2e-live.smoke-spec.ts`)로 spawn → exit 0 면 PASS, non-zero 면
  FAIL. 하나라도 부재/공백이면 함수 진입 전 **SKIP 신호**(별도 exit code 또는 반환값)로
  caller 가 `mark eval SKIP`. T-0611 plan helper 의 산출을 bash 로 mirror(정본은 그
  helper — 주석 명시).
- [ ] `ORDER=(redeploy health liveness auth)` 에 `eval` 추가 → `ORDER=(redeploy health
  liveness auth eval)`. `eval` step 은 **auth PASS(또는 그 이전 PASS 체인)** 일 때만
  실행하고, 그 외(health/liveness/auth 미통과)면 `mark eval SKIP`. gating env 부재면
  체인 통과 여부와 무관하게 `mark eval SKIP`. `steps_json` 조립은 `ORDER` 순회라 자동
  반영(추가 코드 불요) 확인.
- [ ] gating 부재 시(cloud CI / 일반 LAN) `step_eval` 은 **네트워크 0 / secret 접근 0 /
  jest spawn 0** — `mark eval SKIP` 으로만 끝나 기존 daily-test 동작을 깨지 않음(no-op).
  실 credential 값을 로그·result JSON 에 echo 0(§9) — gating env *이름* 만 진단 로그.
- [ ] `deploy/daily-test-step-eval.test.sh` 신설 — `check-doc-only-pr.test.sh` 동형의
  순수 bash executable spec. daily-test.sh 를 source 하거나 `step_eval`/gating 판정
  로직을 분리 검증(jest 실 spawn 0 — argv 산출·SKIP/run 분기·credential echo 0 만 검사).
  네트워크/의존성 0, 마지막에 `fail` 누적 결과로 exit.
- [ ] **Happy-path test 1+**: gating env 7 종 모두 set 된 모의 env → `step_eval` 의
  결정이 **run** + argv 가 live smoke spec 경로(`test/smoke/realdata-e2e-live.smoke-spec
  .ts`) + smoke config(`./test/jest-smoke.json`)를 정확히 포함 검증(실 jest spawn 없이
  argv 합성만 assert).
- [ ] **Error path test 1+**: gating env 부재/빈 env → 결정이 **skip** + argv 미합성 +
  `step_eval` 이 throw/비정상 종료 0(SKIP 신호로만 종료). auth 미통과 체인 모의 →
  `mark eval SKIP`.
- [ ] **Flow / branch 분기 cover**: (a) gating 완전 → run 분기, (b) gating 부재 → skip
  분기, (c) 체인 미통과(health/auth FAIL/SKIP) → skip 분기 각 1+ test. 분기별 진단 사유
  문자열 구분 검증.
- [ ] **Negative cases 충분 cover** — 단일 negative 금지, 경계마다 분리:
  (1) gating env 중 정확히 1 종만 부재(부분 set) → skip(완전성 규칙 mirror),
  (2) gating env 값이 공백-only(` `) → skip(non-blank guard mirror),
  (3) jest exit non-zero 모의 → `mark eval FAIL`(SKIP 과 구분, FAILED_STEP 반영),
  (4) skip 산출 시 jest spawn 0 + 실 credential 값 로그/JSON echo 0(§9) 확인,
  (5) 기존 4 step(redeploy/health/liveness/auth) 결과·result JSON 형식이 eval 추가로
    회귀하지 않음(ORDER 순회 호환) 각 1+ test.
- [ ] `.github/workflows/ci.yml` 에 `deploy/daily-test-step-eval.test.sh` self-test
  step 추가 — `bash scripts/check-doc-only-pr.test.sh` step 동형(`run: bash deploy/
  daily-test-step-eval.test.sh`). 기존 `bash -n deploy/daily-test.sh` syntax 검사 step
  은 daily-test.sh 변경을 자동 cover(불변).
- [ ] `bash -n deploy/daily-test.sh` 및 `bash -n deploy/daily-test-step-eval.test.sh`
  구문 통과. `bash deploy/daily-test-step-eval.test.sh` 전부 PASS(fail=0, exit 0).
- [ ] `pnpm lint && pnpm build && pnpm test` green — TS 변경 0 이므로 build/test 무회귀.
  본 task 의 bash 로직 R-112 cover 는 executable bash spec(line/branch 분기 충분 cover)이
  담당(jest coverageThreshold 는 TS 대상이라 bash 미적용 — bash spec 의 분기 cover 로
  R-112 충족 명시).

## Out of Scope

- **실 credential 주입 + nightly 실행 1 회 + 결과 daily-test result/rolling 이슈 박제 금지**
  — period-bridge-live 가 credentialed run 을 별도 slice 로 미룬 것과 동형. 본 task 는
  gating 부재 시 SKIP 으로만 동작하는 build-time/배선 layer 까지. 실 LAN 발화는 후속.
- **`test/helpers/realdata-e2e-daily-step-eval-command-plan.ts`(T-0611) /
  `realdata-e2e-live-gating.ts`(T-0610) / `realdata-e2e-live.smoke-spec.ts`(T-0610)
  변경 금지** — bash 는 소비/mirror 만(재구현 0). 시그니처·argv·gating 규칙 불변.
- **`package.json` 의 `test:smoke`/jest config 변경 금지** — bash 의 jest argv 는 기존
  smoke 실행 관례(`./test/jest-smoke.json`)에 정합하는 인자를 합성할 뿐 config 정의를
  바꾸지 않는다.
- **기존 4 step(redeploy/health/liveness/auth) 로직 변경 금지** — `ORDER` 에 `eval`
  추가 + `step_eval()` 신설 + 그 분기 실행만. 다른 step 의 mark/순서/JSON 키 불변.
- DB write / Prisma migration 0. 새 외부 dependency 0. raw 미저장(R-59).
- **`.github/workflows/ci.yml` 의 다른 step 변경 금지** — self-test step 1 개 추가만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 후속 slice(LAN/credential gate — cloud cron 자율 불가): 실 credential 주입(로컬 Ollama
  `REALDATA_E2E_LLM_*` + github read PAT `REALDATA_E2E_GITHUB_READ_PAT`) + nightly 1 회
  실행 + 결과를 daily-test result/rolling 이슈에 박제 = 자율 nightly 실 평가 e2e
  (PLAN 109행 ④ 완결). 사람/LAN 머신 1 회 발화.
- PLAN 109행 closure 후 P5 잔여 갭: R-9 사용자 지정 기간 평가문(bullet 98), R-61 일/주/월
  요약 평가(bullet 97), timezone KST 반영(bullet 110, ADR-first) 대조.
