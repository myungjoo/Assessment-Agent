---
id: T-1122
title: realdata-e2e 실 github 평가 full-chain live smoke 를 daily-test.sh step_eval_chain 레그로 배선 + executable bash spec + CI hook
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-037]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-07-21
dependsOn: []
touchesFiles:
  - deploy/daily-test.sh
  - deploy/daily-test-step-eval-chain.test.sh
  - .github/workflows/ci.yml
independentStream: realdata-e2e-github-live-eval-wiring
plannerNote: "PLAN 109행 ④ 잔여 LIVE slice. T-1121 이 신설한 eval-chain command-plan helper 를 daily-test.sh step_eval_chain bash 레그로 mirror 배선(T-0612/T-0888/T-0943 동형) + self-contained executable bash spec + CI hook."
---

# T-1122 — realdata-e2e full-chain live smoke 를 daily-test.sh step_eval_chain 레그로 배선

## Why

Q-0053(옵션 1 승인) 실 github 평가 e2e LIVE wiring 진입의 두 번째 slice 다. PLAN.md 109행 ④ 단계(`deploy/daily-test.sh` 에 실 github 수집 → 실 Ollama 평가 full-chain 을 nightly 로 배선)의 잔여 LIVE slice 를 이어간다.

T-1121(PR #1014, squash 2e0e830e)이 full-chain live smoke(`test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts`, T-0975)의 daily-test command-plan 순수 컴포저 `buildRealDataDailyStepEvalChainCommandPlan`(`test/helpers/realdata-e2e-daily-step-eval-chain-command-plan.ts`)을 이미 신설했으나, 그 정본 argv 를 실제 nightly 스크립트가 **아직 mirror 하지 않는다**. 형제 leg 인 step_eval(T-0612) · step_collect(T-0888) · step_rediscovery(T-0943)는 각각 daily-test.sh 에 bash 레그로 배선돼 있고 self-contained executable bash spec 이 CI 에서 gating/argv/분기를 검증한다. 본 task 는 그 누락된 `step_eval_chain` 레그를 동형으로 daily-test.sh 에 추가하고, executable bash spec + CI hook 을 붙여 T-1121 이 외화한 정본 결정 로직을 실 실행 레이어에 배선한다. credential/Ollama 부재 환경(cloud CI·일반 LAN)은 공유 gating 부재로 조용히 SKIP 되어 네트워크 0 / secret 0 / jest 실 spawn 0 을 보존한다.

## Required Reading

- `deploy/daily-test.sh` (181~356행 — 정확히 mirror 할 정본 bash 패턴: step_eval() / step_collect() / step_rediscovery() 함수 정의 + ORDER 배열 + auth-PASS·gating 조건부 실행 블록 + mark. source-guard(273행) 구조)
- `deploy/daily-test-step-collect.test.sh` (T-0888 — 본 executable bash spec 이 정확히 mirror 할 정본: self-contained gating 판정·argv·SKIP/run/FAIL 분기·교차오염 0·§9 echo 0 검증 구조. 네트워크 0 / jest 실 spawn 0)
- `test/helpers/realdata-e2e-daily-step-eval-chain-command-plan.ts` (T-1121 — bash 레그가 mirror 할 argv 정본: run 분기 argv `["--config", "./test/jest-smoke.json", "--runTestsByPath", "test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts"]`)
- `.github/workflows/ci.yml` (130~152행 — step_eval/collect/rediscovery 검증 CI step 3 개 형태. 본 task 가 추가할 4 번째 step 의 정확한 위치·형식 참고)

## Acceptance Criteria

- [ ] `deploy/daily-test.sh` 에 `step_eval_chain()` 함수 추가 — step_eval/collect/rediscovery 와 동형. 공유 `realdata_eval_gating_enabled`(7 종 REALDATA_E2E_* env) 재사용(새 gating 함수 0). run leg argv 는 T-1121 helper 의 run 분기를 정확히 mirror: `pnpm exec jest --config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts`. exit 0 → `return 0`(PASS), non-zero → `return 1`(FAIL). 실 credential 값은 argv/로그/JSON 에 echo 0(§9) — 자식 jest 가 상속한 process env 로만 전달.
- [ ] `ORDER` 배열에 `eval_chain` 단계 추가(기존 `(redeploy health liveness auth eval collect rediscovery)` 회귀 0 — 추가만) + auth-PASS AND gating 활성일 때만 실행하는 조건부 블록 추가(그 외 `mark eval_chain SKIP`). 조건부 블록은 step_collect/rediscovery 블록과 동형(선행 체인 미통과 → SKIP, gating 부재 → 조용한 SKIP, run leg 성공 → PASS, 실패 → FAIL).
- [ ] `deploy/daily-test-step-eval-chain.test.sh` 신설 — T-0888 `daily-test-step-collect.test.sh` 동형 self-contained executable bash spec. 네트워크 0 / jest 실 spawn 0 / 실 credential echo 0. daily-test.sh 를 source-guard 로 함수만 로드해 검증.
- [ ] Happy-path(run 분기): gating 7 종 env 모두 set + auth PASS 조건에서 step_eval_chain 이 산출하는 jest argv 가 T-1121 helper run 분기와 정확히 일치(config·flag·spec 경로 순서·값)함을 검증(1+).
- [ ] Negative/분기 cover(단일 negative 만으로 부족 — 예외 분기마다 1+): (a) gating env 하나라도 부재 → `mark eval_chain SKIP`(jest spawn 0), (b) 선행 auth 미통과 → SKIP, (c) run leg non-zero → FAIL, (d) 부재 env 조합 여러 경계(빈 env, 일부만 set, read PAT 만 누락 등) 각 1+ 로 SKIP 확인.
- [ ] §9·교차오염 검증: step_eval_chain 이 실 credential 값(PAT·Ollama URL·api key)을 로그/JSON/argv 에 echo 0 + 기존 eval/collect/rediscovery leg 동작 불변(교차오염 0) 검증 1+.
- [ ] `.github/workflows/ci.yml` 에 "daily-test step_eval_chain 배선 검증" step 추가 — step_rediscovery 검증 step(152행) 바로 뒤에 `run: bash deploy/daily-test-step-eval-chain.test.sh` 형태로, 동형 주석(self-contained·credential 불요) 포함.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `bash deploy/daily-test-step-eval-chain.test.sh` exit 0. (본 task 는 `src/` TS 를 변경하지 않으므로 jest coverage threshold 영향 0 — 기존 `pnpm test:cov` line ≥ 80% / function ≥ 80% 유지 확인.)

## Out of Scope

- `test/helpers/realdata-e2e-daily-step-eval-chain-command-plan.ts` / spec(T-1121 정본) 수정 — bash 는 그 argv 를 mirror 만 하고 정본 결정 로직은 helper 소유 불변.
- 본 bash 레그와 T-1121 command-plan helper 의 consistency self-wire 가드(`...-command-plan-consistency.ts` 형제) 추가 — 별도 follow-up slice(collect/rediscovery 형제 존재). 본 task 는 배선 + executable bash spec 까지.
- `resolveRealDataE2eLiveGating` gating 키·완전성 규칙 수정 — 단독 소유자 불변, 재사용만.
- `test/jest-smoke.json` / smoke spec 본문 / `package.json` 수정. write-scope credential / 새 gh mutation / 새 외부 dependency 도입. STATE.json counters / lock write.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append. 예상 후속: (1) step_eval_chain bash 레그와 T-1121 command-plan helper 의 consistency self-wire 가드(`realdata-e2e-daily-step-eval-chain-command-plan-consistency.ts` 형제, argv 동일성 lock), (2) daily-test 머신 JSON step 배열에 eval_chain 반영 확인 가드.)
