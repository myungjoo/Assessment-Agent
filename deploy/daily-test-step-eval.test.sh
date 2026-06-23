#!/usr/bin/env bash
# deploy/daily-test-step-eval.test.sh
#
# deploy/daily-test.sh 의 `step_eval` gating 배선(T-0612)의 executable spec
# (CLAUDE.md §3.2 R-112). scripts/check-doc-only-pr.test.sh 동형의 순수 bash —
# 네트워크 0 / jest 실 spawn 0 / 실 credential echo 0. 검증 대상:
#   - gating env 7 종(REALDATA_E2E_* — T-0610 helper 의 REALDATA_E2E_REQUIRED_ENV 를
#     bash 가 mirror) 완전성 판정(realdata_eval_gating_enabled): 모두 set → enabled,
#     하나라도 부재/빈/공백-only → disabled.
#   - jest argv 가 T-0611 buildRealDataDailyStepEvalCommandPlan 의 run 분기 산출
#     (--config ./test/jest-smoke.json --runTestsByPath
#      test/smoke/realdata-e2e-live.smoke-spec.ts)을 정확히 mirror.
#   - SKIP/run/FAIL 분기 + credential echo 0(§9) + ORDER 회귀 0.
#
# daily-test.sh 는 source 가드(BASH_SOURCE != $0)로 실행 블록을 건너뛰어 함수 정의만
# 노출하므로, 본 spec 은 그 함수를 직접 호출해 부작용 0 으로 단위 검증한다.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAILY_TEST_SH="$SCRIPT_DIR/daily-test.sh"
fail=0

# spec 전용 격리 REPO_DIR — source 시 daily-test.sh 의 top-level mkdir 가 여기에만 닿게.
WORKDIR="$(mktemp -d 2>/dev/null || echo "/tmp/t0612-$$")"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

# gating env 7 종 이름 — daily-test.sh 의 REALDATA_E2E_REQUIRED_ENV 와 동일(정본은
# T-0610 realdata-e2e-live-gating.ts). 본 spec 의 env set/unset 헬퍼가 사용.
REQUIRED_ENV=(
  REALDATA_E2E_LIVE_TEST
  REALDATA_E2E_LLM_BASE_URL
  REALDATA_E2E_LLM_API_KEY
  REALDATA_E2E_LLM_MODEL
  REALDATA_E2E_LLM_PROVIDER
  REALDATA_E2E_LLM_API_VERSION
  REALDATA_E2E_GITHUB_READ_PAT
)

# clear_gating_env: 7 종 gating env 를 모두 unset (skip 기본 상태).
clear_gating_env() {
  local n
  for n in "${REQUIRED_ENV[@]}"; do unset "$n"; done
}

# set_all_gating_env: 7 종 모두 non-blank 더미값으로 set (run 활성 상태).
# 더미값은 spec 내부 토큰 — 실 credential 아님(§9: 실값 0).
set_all_gating_env() {
  local n
  for n in "${REQUIRED_ENV[@]}"; do export "$n=dummy-not-a-real-secret"; done
}

# pass / failtest: 결과 누적.
pass() { echo "PASS: $1"; }
failtest() { echo "FAIL: $1"; fail=1; }

# assert_gating: <설명> <기대 exit: 0=enabled|1=disabled>
# clear+caller 가 세팅한 env 상태에서 realdata_eval_gating_enabled 를 source 환경에서
# 호출해 종료코드를 검증. 부작용 0 — gating 판정은 env 읽기만.
assert_gating() {
  local desc="$1" expected="$2" actual
  ( source "$DAILY_TEST_SH"; realdata_eval_gating_enabled >/dev/null 2>&1 )
  actual=$?
  if [ "$actual" -eq "$expected" ]; then
    pass "$desc"
  else
    failtest "$desc — expected exit $expected, got $actual"
  fi
}

export REPO_DIR="$WORKDIR"

# === Happy path: gating 7 종 모두 set → enabled(run 분기, exit 0) ===
clear_gating_env; set_all_gating_env
assert_gating "gating 7 종 모두 set → enabled(run)" 0

# === Error path: gating 전부 부재 → disabled(skip 분기, exit 1) ===
clear_gating_env
assert_gating "gating 전부 부재 → disabled(skip)" 1

# === Branch 분기: 부분 set(정확히 1 종만 부재) → disabled(완전성 규칙 mirror) ===
# 7 종 각각을 하나씩 빼며 — 어느 하나라도 부재면 skip 임을 분기마다 cover.
for missing in "${REQUIRED_ENV[@]}"; do
  clear_gating_env; set_all_gating_env
  unset "$missing"
  assert_gating "gating 부분 set($missing 부재) → disabled(skip)" 1
done

# === Negative (2): 값이 공백-only(" ") → disabled(non-blank guard mirror) ===
clear_gating_env; set_all_gating_env
export REALDATA_E2E_LLM_API_KEY="   "
assert_gating "gating 값 공백-only → disabled(skip)" 1

# === Negative (2b): 값이 빈 문자열 → disabled ===
clear_gating_env; set_all_gating_env
export REALDATA_E2E_GITHUB_READ_PAT=""
assert_gating "gating 값 빈 문자열 → disabled(skip)" 1

# === Negative (4) + §9: skip 산출 시 부재 진단 로그가 env *이름* 만 — 실값 echo 0 ===
# 더미 credential 값을 set 한 뒤 일부 부재 상태로 만들고, gating 로그(stderr)에 더미값
# 문자열이 *나타나지 않음* 을 검증(이름만 보고). 동시에 jest spawn 0(함수가 jest 미호출).
clear_gating_env
export REALDATA_E2E_LIVE_TEST="dummy-not-a-real-secret"  # 1 종만 set, 6 종 부재 → skip
diag="$( ( source "$DAILY_TEST_SH"; realdata_eval_gating_enabled ) 2>&1 )"
if printf '%s' "$diag" | grep -q 'dummy-not-a-real-secret'; then
  failtest "gating skip 진단에 실 credential 값 echo 0(§9) — 값이 로그에 노출됨"
else
  pass "gating skip 진단에 실 credential 값 echo 0(§9) — env 이름만 보고"
fi
if printf '%s' "$diag" | grep -q 'REALDATA_E2E_LLM_BASE_URL'; then
  pass "gating skip 진단이 부재 env 이름을 보고(부분-set 진단)"
else
  failtest "gating skip 진단이 부재 env 이름을 보고하지 않음"
fi

# === argv mirror: step_eval 의 jest argv 가 T-0611 plan helper run 분기 산출과 정확히 일치 ===
# step_eval 을 실 spawn 없이 정적 검증 — daily-test.sh 본문에 단일-spec bound argv 가
# T-0611 buildRealDataDailyStepEvalCommandPlan 의 산출과 토큰 단위로 동일한지 grep.
if grep -q -- '--config ./test/jest-smoke.json' "$DAILY_TEST_SH" \
   && grep -q -- '--runTestsByPath test/smoke/realdata-e2e-live.smoke-spec.ts' "$DAILY_TEST_SH"; then
  pass "jest argv 가 T-0611 plan helper run 분기 산출(config + 단일-spec bound)을 mirror"
else
  failtest "jest argv 가 T-0611 plan helper 산출을 mirror 하지 않음"
fi

# === argv mirror(정본 동기): smoke config / spec 경로 상수가 T-0611 helper 와 동일 ===
# T-0611 정본(test/helpers/realdata-e2e-daily-step-eval-command-plan.ts)의 상수값과
# bash 박제가 drift 하지 않았는지 — 정본 파일에서 같은 경로 토큰을 확인(존재 시).
PLAN_HELPER="$SCRIPT_DIR/../test/helpers/realdata-e2e-daily-step-eval-command-plan.ts"
if [ -f "$PLAN_HELPER" ]; then
  if grep -q 'test/smoke/realdata-e2e-live.smoke-spec.ts' "$PLAN_HELPER" \
     && grep -q './test/jest-smoke.json' "$PLAN_HELPER"; then
    pass "T-0611 정본 helper 의 spec 경로/smoke config 가 bash 박제와 동일(drift 0)"
  else
    failtest "T-0611 정본 helper 의 경로 상수가 bash 박제와 drift"
  fi
else
  pass "T-0611 정본 helper 부재(검증 환경) — bash 박제 grep 만으로 충족(skip)"
fi

# === ORDER 회귀 0: ORDER 에 eval 추가 + 기존 4 step 순서/JSON 조립 호환 ===
# source 한 ORDER 가 redeploy→...→eval 순서를 가지고, 기존 4 step 이 앞순서 그대로인지
# (eval 추가로 기존 step 회귀 0) + mark/steps_json 조립이 ORDER 순회 기반인지 검증.
order_str="$( ( source "$DAILY_TEST_SH"; printf '%s' "${ORDER[*]}" ) )"
if [ "$order_str" = "redeploy health liveness auth eval" ]; then
  pass "ORDER = (redeploy health liveness auth eval) — 기존 4 step 순서 불변 + eval 말미 추가"
else
  failtest "ORDER 회귀 — got '$order_str'"
fi

# mark 헬퍼가 ORDER 순회 호환 — eval 을 mark 하면 STEP_STATUS 에 반영되고 FAIL 시
# FAILED_STEP 설정. 기존 4 step mark 동작이 eval 추가로 깨지지 않음을 동일 헬퍼로 확인.
mark_result="$( ( source "$DAILY_TEST_SH"
  mark auth PASS; mark eval SKIP
  printf '%s|%s|%s' "${STEP_STATUS[auth]}" "${STEP_STATUS[eval]}" "$FAILED_STEP" ) )"
if [ "$mark_result" = "PASS|SKIP|null" ]; then
  pass "mark 가 eval 포함 STEP_STATUS 반영 + FAIL 없으면 FAILED_STEP=null(회귀 0)"
else
  failtest "mark 회귀 — got '$mark_result'"
fi

# === Negative (3): jest exit non-zero → step_eval FAIL(SKIP 과 구분) ===
# 실 jest 대신 PATH 에 항상 non-zero 를 반환하는 stub `pnpm` 을 주입해 step_eval 의
# FAIL 분기(return 1)를 검증. SKIP(gating 부재)과 FAIL(jest non-zero)의 구분 확인 —
# 실 네트워크/실 jest 0(stub 가 즉시 exit 1).
STUBDIR="$WORKDIR/stubbin"
mkdir -p "$STUBDIR"
cat >"$STUBDIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# T-0612 spec stub — 실 jest 미실행. step_eval 의 run leg 가 호출하는 `pnpm exec jest ...`
# 를 가로채 항상 non-zero 로 종료(FAIL 분기 검증). 실 네트워크/실 credential 0.
exit 7
STUB
chmod +x "$STUBDIR/pnpm"
clear_gating_env; set_all_gating_env
eval_fail_rc="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_eval >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$eval_fail_rc" = "1" ]; then
  pass "jest exit non-zero → step_eval return 1(FAIL, SKIP 과 구분)"
else
  failtest "step_eval FAIL 분기 — expected return 1, got '$eval_fail_rc'"
fi

# === Negative (3b): jest exit 0 → step_eval PASS(return 0) ===
cat >"$STUBDIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# T-0612 spec stub — exit 0 으로 live smoke PASS 모의(실 jest 0).
exit 0
STUB
chmod +x "$STUBDIR/pnpm"
clear_gating_env; set_all_gating_env
eval_pass_rc="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_eval >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$eval_pass_rc" = "0" ]; then
  pass "jest exit 0 → step_eval return 0(PASS)"
else
  failtest "step_eval PASS 분기 — expected return 0, got '$eval_pass_rc'"
fi

# === Negative (4b) §9: run leg 의 result 로그에 실 credential 값 echo 0 ===
# 더미 credential 을 env 로 주입한 채 step_eval 실행(stub jest) → step_eval 의 로그
# 출력(stderr)에 credential 값 문자열이 나타나지 않음(§9 — argv/로그에 실값 미포함).
clear_gating_env; set_all_gating_env
eval_log="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_eval 2>&1 1>/dev/null' _ "$DAILY_TEST_SH" )"
if printf '%s' "$eval_log" | grep -q 'dummy-not-a-real-secret'; then
  failtest "step_eval 로그에 실 credential 값 echo 0(§9) — 값 노출됨"
else
  pass "step_eval 로그에 실 credential 값 echo 0(§9) — 진단 메시지에 값 미포함"
fi

# === 결과 집계 ===
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
