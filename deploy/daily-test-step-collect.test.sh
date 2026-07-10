#!/usr/bin/env bash
# deploy/daily-test-step-collect.test.sh
#
# deploy/daily-test.sh 의 `step_collect` gating 배선(T-0888)의 executable spec
# (CLAUDE.md §3.2 R-112). daily-test-step-eval.test.sh(T-0612) 동형의 순수 bash —
# 네트워크 0 / jest 실 spawn 0 / 실 credential echo 0. 검증 대상: (1) gating env 7 종
# (REALDATA_E2E_* — collect leg 은 eval leg 과 동일 gating 을 공유해 realdata_eval_gating
# _enabled 를 재사용) 완전성 판정, (2) step_collect argv 가 T-0887 컴포저 run 분기 산출
# (--config ./test/jest-smoke.json --runTestsByPath 위 collection spec)을 정확히 mirror,
# (3) SKIP/run/FAIL 분기 + credential echo 0(§9) + ORDER 회귀 0 + eval leg 교차오염 0.
# daily-test.sh 는 source 가드로 실행 블록을 건너뛰어 함수만 노출하므로 직접 호출로
# 부작용 0 단위 검증한다.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAILY_TEST_SH="$SCRIPT_DIR/daily-test.sh"
fail=0

# spec 전용 격리 REPO_DIR — source 시 daily-test.sh 의 top-level mkdir 가 여기에만 닿게.
WORKDIR="$(mktemp -d 2>/dev/null || echo "/tmp/t0888-$$")"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

# gating env 7 종 이름 — daily-test.sh 의 REALDATA_E2E_REQUIRED_ENV 와 동일(정본은
# T-0610 realdata-e2e-live-gating.ts). collect leg 은 eval leg 과 이 gating 을 공유한다.
REQUIRED_ENV=(
  REALDATA_E2E_LIVE_TEST
  REALDATA_E2E_LLM_BASE_URL
  REALDATA_E2E_LLM_API_KEY
  REALDATA_E2E_LLM_MODEL
  REALDATA_E2E_LLM_PROVIDER
  REALDATA_E2E_LLM_API_VERSION
  REALDATA_E2E_GITHUB_READ_PAT
)

# collection live smoke spec 경로 — step_collect argv 가 가리켜야 할 대상(T-0887 정본).
COLLECT_SPEC_PATH="test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts"
# eval leg spec 경로 — 교차오염 0 검증용(step_collect 이 이 경로를 가리키면 안 됨).
EVAL_SPEC_PATH="test/smoke/realdata-e2e-live.smoke-spec.ts"

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
# clear+caller 가 세팅한 env 상태에서 공유 realdata_eval_gating_enabled 를 source 환경에서
# 호출해 종료코드를 검증(collect leg 은 이 함수를 재사용). 부작용 0 — env 읽기만.
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

# === Happy path: gating 7 종 모두 set → enabled(collect run 분기, exit 0) ===
clear_gating_env; set_all_gating_env
assert_gating "gating 7 종 모두 set → enabled(collect run)" 0

# === Error path: gating 전부 부재 → disabled(collect skip 분기, exit 1) ===
clear_gating_env
assert_gating "gating 전부 부재 → disabled(collect skip)" 1

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

# === argv mirror: step_collect 의 jest argv 가 T-0887 컴포저 run 분기 산출과 일치 ===
# 실 spawn 없이 정적 grep — daily-test.sh 의 단일-spec bound argv 가 토큰 단위 동일한지.
if grep -q -- '--config ./test/jest-smoke.json' "$DAILY_TEST_SH" \
   && grep -q -- "--runTestsByPath $COLLECT_SPEC_PATH" "$DAILY_TEST_SH"; then
  pass "jest argv 가 T-0887 plan helper run 분기 산출(config + collection 단일-spec bound)을 mirror"
else
  failtest "jest argv 가 T-0887 plan helper 산출을 mirror 하지 않음"
fi

# === argv parity(교차오염 0): step_collect 이 collection spec 을 가리키고 eval spec 이 아님 ===
# step_collect 함수 본문만 추출해 그 안에서 eval leg spec 경로가 나타나지 않음을 검증 —
# collect/eval argv 교차오염 0(spec 경로만 다름).
collect_body="$( awk '/^step_collect\(\) \{/{f=1} f{print} f&&/^}/{exit}' "$DAILY_TEST_SH" )"
if printf '%s' "$collect_body" | grep -q -- "$COLLECT_SPEC_PATH" \
   && ! printf '%s' "$collect_body" | grep -q -- "$EVAL_SPEC_PATH"; then
  pass "step_collect argv 가 collection spec 을 가리킴 + eval leg spec 과 교차오염 0"
else
  failtest "step_collect argv 교차오염 — eval spec 참조 또는 collection spec 미참조"
fi

# === argv mirror(정본 동기): smoke config / spec 경로 상수가 T-0887 helper 와 동일 ===
# 정본(realdata-e2e-daily-step-collect-command-plan.ts)의 상수값과 bash 박제 drift 0 확인.
PLAN_HELPER="$SCRIPT_DIR/../test/helpers/realdata-e2e-daily-step-collect-command-plan.ts"
if [ -f "$PLAN_HELPER" ]; then
  if grep -q "$COLLECT_SPEC_PATH" "$PLAN_HELPER" \
     && grep -q './test/jest-smoke.json' "$PLAN_HELPER"; then
    pass "T-0887 정본 helper 의 spec 경로/smoke config 가 bash 박제와 동일(drift 0)"
  else
    failtest "T-0887 정본 helper 의 경로 상수가 bash 박제와 drift"
  fi
else
  pass "T-0887 정본 helper 부재(검증 환경) — bash 박제 grep 만으로 충족(skip)"
fi

# === ORDER 회귀 0: ORDER 에 collect 말미 추가 + 기존 5 step 순서/JSON 조립 호환 ===
order_str="$( ( source "$DAILY_TEST_SH"; printf '%s' "${ORDER[*]}" ) )"
if [ "$order_str" = "redeploy health liveness auth eval collect" ]; then
  pass "ORDER = (redeploy health liveness auth eval collect) — 기존 5 step 순서 불변 + collect 말미 추가"
else
  failtest "ORDER 회귀 — got '$order_str'"
fi

# mark 헬퍼 ORDER 순회 호환 — collect mark 반영 + FAIL 없으면 FAILED_STEP=null(회귀 0).
mark_result="$( ( source "$DAILY_TEST_SH"
  mark auth PASS; mark eval SKIP; mark collect SKIP
  printf '%s|%s|%s|%s' "${STEP_STATUS[auth]}" "${STEP_STATUS[eval]}" "${STEP_STATUS[collect]}" "$FAILED_STEP" ) )"
if [ "$mark_result" = "PASS|SKIP|SKIP|null" ]; then
  pass "mark 가 collect 포함 STEP_STATUS 반영 + FAIL 없으면 FAILED_STEP=null(기존 5 step 회귀 0)"
else
  failtest "mark 회귀 — got '$mark_result'"
fi

# === Negative (5): 기존 5 step mark + steps_json 형식 회귀 0(collect 추가 호환) ===
steps_json_probe="$( ( source "$DAILY_TEST_SH"
  mark redeploy PASS; mark health PASS; mark liveness PASS; mark auth PASS; mark eval SKIP; mark collect SKIP
  sj=""
  for s in "${ORDER[@]}"; do sj="$sj,\"$s\":\"${STEP_STATUS[$s]}\""; done
  printf '{%s}' "${sj#,}" ) )"
expected_json='{"redeploy":"PASS","health":"PASS","liveness":"PASS","auth":"PASS","eval":"SKIP","collect":"SKIP"}'
if [ "$steps_json_probe" = "$expected_json" ]; then
  pass "steps_json 이 기존 5 step 키 불변 + collect 키 말미 추가(형식 회귀 0)"
else
  failtest "steps_json 회귀 — got '$steps_json_probe'"
fi

# === Negative (3): jest exit non-zero → step_collect FAIL(SKIP 과 구분) ===
# 실 jest 대신 항상 non-zero 를 반환하는 stub `pnpm` 을 PATH 에 주입해 FAIL 분기(return 1)를
# 검증(SKIP 과 구분). 실 네트워크/실 jest 0.
STUBDIR="$WORKDIR/stubbin"
mkdir -p "$STUBDIR"
cat >"$STUBDIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# T-0888 spec stub — 실 jest 미실행. step_collect 의 run leg 가 호출하는 `pnpm exec jest ...`
# 를 가로채 항상 non-zero 로 종료(FAIL 분기 검증). 실 네트워크/실 credential 0.
exit 7
STUB
chmod +x "$STUBDIR/pnpm"
clear_gating_env; set_all_gating_env
collect_fail_rc="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_collect >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$collect_fail_rc" = "1" ]; then
  pass "jest exit non-zero → step_collect return 1(FAIL, SKIP 과 구분)"
else
  failtest "step_collect FAIL 분기 — expected return 1, got '$collect_fail_rc'"
fi

# === Negative (3b): jest exit 0 → step_collect PASS(return 0) ===
cat >"$STUBDIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# T-0888 spec stub — exit 0 으로 collection live smoke PASS 모의(실 jest 0).
exit 0
STUB
chmod +x "$STUBDIR/pnpm"
clear_gating_env; set_all_gating_env
collect_pass_rc="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_collect >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$collect_pass_rc" = "0" ]; then
  pass "jest exit 0 → step_collect return 0(PASS)"
else
  failtest "step_collect PASS 분기 — expected return 0, got '$collect_pass_rc'"
fi

# === Negative (4b) §9: run leg 로그에 실 credential 값 echo 0 ===
# 더미 credential 주입 채 step_collect 실행(stub jest) → 로그(stderr)에 credential 값
# 문자열 미노출(§9 — argv/로그에 실값 미포함).
clear_gating_env; set_all_gating_env
collect_log="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_collect 2>&1 1>/dev/null' _ "$DAILY_TEST_SH" )"
if printf '%s' "$collect_log" | grep -q 'dummy-not-a-real-secret'; then
  failtest "step_collect 로그에 실 credential 값 echo 0(§9) — 값 노출됨"
else
  pass "step_collect 로그에 실 credential 값 echo 0(§9) — 진단 메시지에 값 미포함"
fi

# === 결과 집계 ===
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
