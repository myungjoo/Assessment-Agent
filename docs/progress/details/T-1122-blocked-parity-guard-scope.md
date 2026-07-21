# T-1122 BLOCKED — parity-guard scope overflow

## 상황

`deploy/daily-test.sh` 에 8번째 leg `step_eval_chain` 을 배선(형제 eval/collect/rediscovery 동형)하고
executable bash spec + CI hook 을 추가하는 작업은 완료됐고 로컬 `pnpm lint && pnpm build && pnpm test`
(405 suite / 11349 test) + 새 bash spec 24 case 전부 green. 커밋·push·PR #1015 open 완료.

그러나 **CI smoke 스위트(`pnpm test:smoke`)가 red** — 로컬 `pnpm test` 는 unit 만 돌려 못 잡았다(R-113 smoke 는 CI 에서만).

## 근본 원인 — 구조적 drift-guard 3종이 leg 추가를 강제 catch

다음 3개 smoke spec 은 `deploy/daily-test.sh` 의 정확한 `ORDER` 벡터(7-leg)와 cascade gate 횟수(3)를
하드코딩한 **drift 감시 가드**다. 새 leg 가 추가되면 의도적으로 fail 하여 parity 재검토를 강제한다:

- `test/smoke/realdata-e2e-daily-test-machine-result-json-schema-order-driven-steps-parity-drift.smoke-spec.ts` (T-0791)
  → `ORDER=(redeploy health liveness auth eval collect rediscovery)` 정확 일치 + 7-원소 `EXPECTED_ORDER` 하드코딩. Expected 7, got 8.
- `test/smoke/realdata-e2e-daily-test-machine-result-status-aggregation-skip-nonfailing-failedstep-firstwins-contract.smoke-spec.ts` (T-0944)
- `test/smoke/realdata-e2e-daily-test-step-chain-skip-propagation-gate-cascade-downstream-never-passfail-contract.smoke-spec.ts` (T-0947)
  → `authGateCount === 3`, `gatingGateCount === 3`, `REALDATA_LEGS = ["eval","collect","rediscovery"]`,
    7-원소 `EXPECTED_ORDER`, cascade 모델. Expected 3, got 4.

이들 갱신은 leg 추가에 **내재적**이다 — 사전 증거: 형제 T-0943(rediscovery 배선)이
json-schema-order-driven parity spec(T-0791)을 그때 함께 갱신했다(commit c4fb3f92).

## 왜 BLOCKED

완결에 필요한 변경이 task 정의와 이중 충돌:

1. **5-파일 cap 초과** — 선언된 3파일(daily-test.sh · daily-test-step-eval-chain.test.sh · ci.yml)에
   위 parity spec 3개를 더하면 **6 파일** > 5-파일 상한. 현재 declared-scope 커밋만으로도 +308/-1 LOC 로
   이미 300-LOC 상한 근처(parity 편집분 추가 시 확실히 초과).
2. **Out of Scope 명시 충돌** — task Out of Scope 가 "smoke spec 본문 수정" 을 금지하는데, 위 3 parity
   guard 갱신은 green CI 에 **필수**다. task 가 요구하는 것을 task 가 금지하는 내부 모순(planner 미스코핑).

## 재스코핑 권고 (planner)

- 옵션 A: 본 task 의 `touchesFiles` 에 위 3 parity spec 을 추가하고 Out of Scope 의 "smoke spec 본문 수정"
  문구를 "eval-chain-live 대상 smoke spec 본문 수정"으로 좁힌 뒤, cohesive-mechanical parity 갱신에 한해
  6-파일 cap 예외로 round 2 재진입(같은 branch/PR #1015 resume). leg 추가 + 그 drift-guard 갱신은
  분리 불가(중간 red 상태 불가피)라 split 보다 cap 예외가 적절.
- 옵션 B: parity guard 3종을 미래-leg 성장에 resilient 하도록(prefix-slice + targeted-index 방식,
  daily-test-step-*.test.sh 패턴) 먼저 리팩터하는 별도 direct-불가/pr task 를 선행 배치 후 본 task 재개.

현재 branch `claude/T-1122-eval-chain-bash-wire` 의 3-파일 커밋(031d80ac)은 정상이며 보존됨 — round 2 가 이어받으면 됨.
