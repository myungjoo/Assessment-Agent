#!/usr/bin/env bash
# deploy/daily-test-step-rediscovery.test.sh
#
# deploy/daily-test.sh 의 `step_rediscovery` gating 배선(T-0943)의 executable spec
# (CLAUDE.md §3.2 R-112). daily-test-step-collect.test.sh(T-0888) 동형의 순수 bash —
# 네트워크 0 / jest 실 spawn 0 / 실 credential echo 0. 검증 대상: (1) 공유 gating env 7 종
# (REALDATA_E2E_*, eval/collect leg 과 realdata_eval_gating_enabled 재사용) 완전성 판정, (2)
# step_rediscovery argv 가 T-0942 rediscovery-search-live smoke 를 단일-spec bound 로 mirror,
# (3) SKIP/run/FAIL 분기 + credential echo 0(§9) + ORDER 회귀 0 + eval/collect leg 교차오염 0
# + write 명령 문자열 0(read-only 보장). daily-test.sh 는 source 가드로 함수만 노출하므로 직접
# 호출로 부작용 0 단위 검증한다.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAILY_TEST_SH="$SCRIPT_DIR/daily-test.sh"
fail=0

# spec 전용 격리 REPO_DIR — source 시 daily-test.sh top-level mkdir 가 여기에만 닿게.
WORKDIR="$(mktemp -d 2>/dev/null || echo "/tmp/t0943-$$")"
mkdir -p "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

# gating env 7 종 이름 — daily-test.sh 의 REALDATA_E2E_REQUIRED_ENV 와 동일(정본 T-0610).
# rediscovery leg 은 eval/collect leg 과 이 gating 공유(read PAT 포함, write-scope 신규 0).
REQUIRED_ENV=(
  REALDATA_E2E_LIVE_TEST
  REALDATA_E2E_LLM_BASE_URL
  REALDATA_E2E_LLM_API_KEY
  REALDATA_E2E_LLM_MODEL
  REALDATA_E2E_LLM_PROVIDER
  REALDATA_E2E_LLM_API_VERSION
  REALDATA_E2E_GITHUB_READ_PAT
)

# rediscovery-search-live smoke spec 경로 — step_rediscovery argv 가 가리켜야 할 대상(T-0942).
REDISCOVERY_SPEC_PATH="test/smoke/realdata-e2e-daily-step-dual-leg-run-report-rediscovery-search-live.smoke-spec.ts"
# eval/collect leg spec 경로 — 교차오염 0 검증용(step_rediscovery 이 가리키면 안 됨).
EVAL_SPEC_PATH="test/smoke/realdata-e2e-live.smoke-spec.ts"
COLLECT_SPEC_PATH="test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts"

# clear_gating_env: 7 종 gating env 모두 unset (skip 기본 상태).
clear_gating_env() {
  local n
  for n in "${REQUIRED_ENV[@]}"; do unset "$n"; done
}

# set_all_gating_env: 7 종 모두 non-blank 더미값으로 set (run 활성). 더미값은 실 credential 0(§9).
set_all_gating_env() {
  local n
  for n in "${REQUIRED_ENV[@]}"; do export "$n=dummy-not-a-real-secret"; done
}

pass() { echo "PASS: $1"; }        # 결과 누적
failtest() { echo "FAIL: $1"; fail=1; }

# assert_gating: <설명> <기대 exit: 0=enabled|1=disabled>
# caller 가 세팅한 env 상태에서 공유 realdata_eval_gating_enabled 를 source 환경에서 호출해
# 종료코드 검증(rediscovery leg 재사용). 부작용 0 — env 읽기만.
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

# === Happy path: gating 7 종 모두 set → enabled(rediscovery run 분기, exit 0) ===
clear_gating_env; set_all_gating_env
assert_gating "gating 7 종 모두 set → enabled(rediscovery run)" 0

# === Error path: gating 전부 부재 → disabled(rediscovery skip 분기, exit 1) ===
clear_gating_env
assert_gating "gating 전부 부재 → disabled(rediscovery skip)" 1

# === Branch 분기: 부분 set(1 종씩 부재) → disabled — 어느 하나 부재면 skip 을 분기마다 cover ===
for missing in "${REQUIRED_ENV[@]}"; do
  clear_gating_env; set_all_gating_env
  unset "$missing"
  assert_gating "gating 부분 set($missing 부재) → disabled(skip)" 1
done

# === Negative (2): 값이 공백-only(" ") → disabled(non-blank guard mirror) ===
clear_gating_env; set_all_gating_env; export REALDATA_E2E_LLM_API_KEY="   "
assert_gating "gating 값 공백-only → disabled(skip)" 1

# === Negative (2b): 값이 빈 문자열 → disabled ===
clear_gating_env; set_all_gating_env; export REALDATA_E2E_GITHUB_READ_PAT=""
assert_gating "gating 값 빈 문자열 → disabled(skip)" 1

# === Negative (4) + §9: skip 진단 로그가 env *이름* 만 — 실값 echo 0(jest spawn 0 동반) ===
# 더미 credential set 후 일부 부재로 만들고 gating 로그(stderr)에 더미값 미등장 검증(이름만 보고).
clear_gating_env
export REALDATA_E2E_LIVE_TEST="dummy-not-a-real-secret"  # 1 종만 set → skip
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

# === argv mirror(happy): step_rediscovery 의 jest argv 가 T-0942 rediscovery smoke 를 지향 ===
if grep -q -- '--config ./test/jest-smoke.json' "$DAILY_TEST_SH" \
   && grep -q -- "--runTestsByPath $REDISCOVERY_SPEC_PATH" "$DAILY_TEST_SH"; then
  pass "jest argv 가 T-0942 rediscovery smoke(config + rediscovery 단일-spec bound)을 mirror"
else
  failtest "jest argv 가 T-0942 rediscovery smoke 를 mirror 하지 않음"
fi

# === argv parity(negative a — 교차오염 0): rediscovery spec 만 가리키고 eval/collect 아님 ===
# step_rediscovery 함수 본문만 추출해 eval/collect leg spec 경로 미등장 검증(spec 경로만 다름).
rediscovery_body="$( awk '/^step_rediscovery\(\) \{/{f=1} f{print} f&&/^}/{exit}' "$DAILY_TEST_SH" )"
if printf '%s' "$rediscovery_body" | grep -q -- "$REDISCOVERY_SPEC_PATH" \
   && ! printf '%s' "$rediscovery_body" | grep -q -- "$EVAL_SPEC_PATH" \
   && ! printf '%s' "$rediscovery_body" | grep -q -- "$COLLECT_SPEC_PATH"; then
  pass "step_rediscovery argv 가 rediscovery spec 을 가리킴 + eval/collect leg spec 과 교차오염 0"
else
  failtest "step_rediscovery argv 교차오염 — eval/collect spec 참조 또는 rediscovery spec 미참조"
fi

# === Negative (b) §9 / REQ-059: credential no-echo — 함수/elif 에 실 토큰 어휘 미등장 ===
# 함수 본문 + elif 블록에 ghp_/--token/GITHUB_TOKEN 어휘 미등장 검증(실값 argv/로그/JSON echo 0).
rediscovery_elif="$( awk '/step rediscovery\(realdata-e2e/,/^fi$/' "$DAILY_TEST_SH" )"
cred_haystack="$rediscovery_body
$rediscovery_elif"
if printf '%s' "$cred_haystack" | grep -qE 'ghp_|--token|GITHUB_TOKEN'; then
  failtest "step_rediscovery 함수/elif 에 credential 토큰 어휘 등장(§9 / REQ-059 위반)"
else
  pass "step_rediscovery 함수/elif 에 credential 토큰 어휘 미등장(§9 / REQ-059)"
fi

# === Negative (c): write 명령 0 — read-only 보장(write step_report 는 본 task 밖) ===
# 함수/elif 에 write mutation(gh issue create|edit) 미등장 검증(rediscovery 는 read-only only).
if printf '%s' "$cred_haystack" | grep -qE 'gh issue create|gh issue edit'; then
  failtest "step_rediscovery 함수/elif 에 write 명령(gh issue create|edit) 등장(read-only 보장 위반)"
else
  pass "step_rediscovery 함수/elif 에 write 명령 0(read-only 보장 — write step_report 는 본 task 밖)"
fi

# === ORDER parity(negative d): rediscovery 를 정확히 7번째로 포함 + 기존 6 step 순서 불변 ===
# 전체-문자열 등가로 위치·순서를 한 번에 단언(ORDER[6] == rediscovery 를 함의).
order_str="$( ( source "$DAILY_TEST_SH"; printf '%s' "${ORDER[*]}" ) )"
if [ "$order_str" = "redeploy health liveness auth eval collect rediscovery" ]; then
  pass "ORDER = (…eval collect rediscovery) — 기존 6 step 순서 불변 + rediscovery 정확히 7번째"
else
  failtest "ORDER 회귀 — got '$order_str'"
fi

# mark 헬퍼 호환 — rediscovery mark 반영 + FAIL 없으면 FAILED_STEP=null(기존 6 step 회귀 0).
mark_result="$( ( source "$DAILY_TEST_SH"
  mark auth PASS; mark eval SKIP; mark collect SKIP; mark rediscovery SKIP
  printf '%s|%s|%s|%s|%s' "${STEP_STATUS[auth]}" "${STEP_STATUS[eval]}" "${STEP_STATUS[collect]}" "${STEP_STATUS[rediscovery]}" "$FAILED_STEP" ) )"
if [ "$mark_result" = "PASS|SKIP|SKIP|SKIP|null" ]; then
  pass "mark 가 rediscovery 포함 STEP_STATUS 반영 + FAIL 없으면 FAILED_STEP=null(기존 6 step 회귀 0)"
else
  failtest "mark 회귀 — got '$mark_result'"
fi

# === Negative (5): 6 step mark + steps_json 형식 회귀 0(rediscovery 키 말미 추가 호환) ===
steps_json_probe="$( ( source "$DAILY_TEST_SH"
  mark redeploy PASS; mark health PASS; mark liveness PASS; mark auth PASS; mark eval SKIP; mark collect SKIP; mark rediscovery SKIP
  sj=""
  for s in "${ORDER[@]}"; do sj="$sj,\"$s\":\"${STEP_STATUS[$s]}\""; done
  printf '{%s}' "${sj#,}" ) )"
expected_json='{"redeploy":"PASS","health":"PASS","liveness":"PASS","auth":"PASS","eval":"SKIP","collect":"SKIP","rediscovery":"SKIP"}'
if [ "$steps_json_probe" = "$expected_json" ]; then
  pass "steps_json 이 기존 6 step 키 불변 + rediscovery 키 말미 추가(형식 회귀 0)"
else
  failtest "steps_json 회귀 — got '$steps_json_probe'"
fi

# === Negative (3): jest exit non-zero → step_rediscovery FAIL(SKIP 과 구분) ===
# 항상 non-zero 반환 stub `pnpm` 을 PATH 에 주입해 FAIL 분기(return 1) 검증. 실 네트워크/jest 0.
STUBDIR="$WORKDIR/stubbin"
mkdir -p "$STUBDIR"
cat >"$STUBDIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# T-0943 spec stub — `pnpm exec jest ...` 를 가로채 non-zero 종료(FAIL 분기 검증). 실 jest 0.
exit 7
STUB
chmod +x "$STUBDIR/pnpm"
clear_gating_env; set_all_gating_env
rediscovery_fail_rc="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_rediscovery >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$rediscovery_fail_rc" = "1" ]; then
  pass "jest exit non-zero → step_rediscovery return 1(FAIL, SKIP 과 구분)"
else
  failtest "step_rediscovery FAIL 분기 — expected return 1, got '$rediscovery_fail_rc'"
fi

# === Negative (3b): jest exit 0 → step_rediscovery PASS(return 0) ===
cat >"$STUBDIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# T-0943 spec stub — exit 0 으로 rediscovery PASS 모의(실 jest 0).
exit 0
STUB
chmod +x "$STUBDIR/pnpm"
clear_gating_env; set_all_gating_env
rediscovery_pass_rc="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_rediscovery >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$rediscovery_pass_rc" = "0" ]; then
  pass "jest exit 0 → step_rediscovery return 0(PASS)"
else
  failtest "step_rediscovery PASS 분기 — expected return 0, got '$rediscovery_pass_rc'"
fi

# === Negative (4b) §9: run leg 로그(stderr)에 실 credential 값 echo 0(stub jest, 값 미노출) ===
clear_gating_env; set_all_gating_env
rediscovery_log="$( PATH="$STUBDIR:$PATH" bash -c '
  source "$1"; step_rediscovery 2>&1 1>/dev/null' _ "$DAILY_TEST_SH" )"
if printf '%s' "$rediscovery_log" | grep -q 'dummy-not-a-real-secret'; then
  failtest "step_rediscovery 로그에 실 credential 값 echo 0(§9) — 값 노출됨"
else
  pass "step_rediscovery 로그에 실 credential 값 echo 0(§9) — 진단 메시지에 값 미포함"
fi

# === 결과 집계 ===
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
