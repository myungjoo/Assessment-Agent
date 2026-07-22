#!/usr/bin/env bash
# deploy/daily-test-step-env-source.test.sh
#
# deploy/daily-test.sh 의 `source_realdata_env` 배선(T-1123, issue #1013 slice C-1)의
# executable spec (CLAUDE.md §3.2 R-112). daily-test-step-eval.test.sh(T-0612) 동형의
# 순수 bash — 네트워크 0 / jest 실 spawn 0 / 실 credential echo 0. 검증 대상:
#   - source-guard *앞* 정의라 source 시 함수만 노출 + 실행 블록 부작용 0.
#   - Happy-path: .env.realdata 존재+readable(gating 7 종 더미값) → source 후 그 7 종이
#     export 되어 realdata_eval_gating_enabled 가 enabled(exit 0)로 전환.
#   - Negative(파일 부재): return 0(run 미실패) + env 불변 + 진단 로그는 경로만.
#   - Negative(읽기 불가): return 0(run 미실패) + env 불변 + 진단 로그는 경로만(값 노출 0).
#   - §9: 파일에 든 더미 secret 값이 source_realdata_env 로그(stderr) 어디에도 안 나타남.
#   - override 결정론: 이미 set 된 키를 파일이 재정의하면 source 후 파일 값이 반영.
#   - edge(빈 파일): 존재+readable+빈 내용 → return 0, env 불변, 에러 0.
#
# daily-test.sh 는 source 가드(BASH_SOURCE != $0)로 실행 블록을 건너뛰어 함수 정의만
# 노출하므로, 본 spec 은 그 함수를 직접 호출해 부작용 0 으로 단위 검증한다.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAILY_TEST_SH="$SCRIPT_DIR/daily-test.sh"
fail=0

# spec 전용 격리 WORKDIR — source 시 daily-test.sh top-level mkdir 가 여기에만 닿게 +
# .env.realdata fixture 파일도 여기에 만든다.
WORKDIR="$(mktemp -d 2>/dev/null || echo "/tmp/t1123-$$")"
mkdir -p "$WORKDIR"
trap 'chmod -R u+rwx "$WORKDIR" 2>/dev/null; rm -rf "$WORKDIR"' EXIT

# gating env 7 종 이름 — daily-test.sh 의 REALDATA_E2E_REQUIRED_ENV 와 동일(정본은
# T-0610 realdata-e2e-live-gating.ts).
REQUIRED_ENV=(
  REALDATA_E2E_LIVE_TEST
  REALDATA_E2E_LLM_BASE_URL
  REALDATA_E2E_LLM_API_KEY
  REALDATA_E2E_LLM_MODEL
  REALDATA_E2E_LLM_PROVIDER
  REALDATA_E2E_LLM_API_VERSION
  REALDATA_E2E_GITHUB_READ_PAT
)

DUMMY_SECRET="dummy-not-a-real-secret"

# clear_gating_env: 7 종 gating env 를 모두 unset (skip 기본 상태).
clear_gating_env() {
  local n
  for n in "${REQUIRED_ENV[@]}"; do unset "$n"; done
}

# write_realdata_file: gating 7 종을 더미값으로 담은 .env.realdata fixture 를 <경로> 에 쓴다.
write_realdata_file() {
  local path="$1" n
  : >"$path"
  for n in "${REQUIRED_ENV[@]}"; do
    printf '%s=%s\n' "$n" "$DUMMY_SECRET" >>"$path"
  done
}

pass() { echo "PASS: $1"; }
failtest() { echo "FAIL: $1"; fail=1; }

export REPO_DIR="$WORKDIR"

# === Happy-path: .env.realdata 존재+readable(7 종 더미값) → source 후 gating enabled ===
# ENV_REALDATA_FILE 로 fixture 를 가리키고, 한 subshell 에서 source_realdata_env 호출 후
# 곧바로 realdata_eval_gating_enabled 의 exit code 를 확인한다(source 로 env 상속됨).
ENV_FILE="$WORKDIR/.env.realdata"
write_realdata_file "$ENV_FILE"
clear_gating_env
gating_rc="$( ENV_REALDATA_FILE="$ENV_FILE" bash -c '
  source "$1"; source_realdata_env >/dev/null 2>&1
  realdata_eval_gating_enabled >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$gating_rc" = "0" ]; then
  pass "happy-path: .env.realdata source → gating 7 종 export → enabled(exit 0)"
else
  failtest "happy-path: source 후 gating enabled 기대(0), got '$gating_rc'"
fi

# source_realdata_env 자체가 존재+readable 시 return 0 인지도 확인.
src_rc="$( ENV_REALDATA_FILE="$ENV_FILE" bash -c '
  source "$1"; source_realdata_env >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$src_rc" = "0" ]; then
  pass "happy-path: source_realdata_env 존재+readable → return 0"
else
  failtest "source_realdata_env 존재+readable return — expected 0, got '$src_rc'"
fi

# === Negative/branch (파일 부재): return 0(run 미실패) + env 불변 + 진단 로그 경로만 ===
# 없는 경로를 가리키고, 부모 env 는 clear 상태 → source 후에도 gating 여전히 disabled(1).
ABSENT_FILE="$WORKDIR/does-not-exist.env"
clear_gating_env
absent_rc="$( ENV_REALDATA_FILE="$ABSENT_FILE" bash -c '
  source "$1"; source_realdata_env >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$absent_rc" = "0" ]; then
  pass "negative(파일 부재): source_realdata_env return 0(run 미실패, no-op)"
else
  failtest "negative(파일 부재): expected return 0, got '$absent_rc'"
fi
absent_gating="$( ENV_REALDATA_FILE="$ABSENT_FILE" bash -c '
  source "$1"; source_realdata_env >/dev/null 2>&1
  realdata_eval_gating_enabled >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$absent_gating" = "1" ]; then
  pass "negative(파일 부재): env 불변 → gating 여전히 disabled(기존 no-op 보존)"
else
  failtest "negative(파일 부재): gating disabled 기대(1), got '$absent_gating'"
fi
absent_log="$( ENV_REALDATA_FILE="$ABSENT_FILE" bash -c '
  source "$1"; source_realdata_env 2>&1 1>/dev/null' _ "$DAILY_TEST_SH" )"
if printf '%s' "$absent_log" | grep -q '부재' \
   && printf '%s' "$absent_log" | grep -q "$ABSENT_FILE"; then
  pass "negative(파일 부재): 진단 로그가 경로만 보고(부재 표기 + 경로)"
else
  failtest "negative(파일 부재): 진단 로그가 경로를 보고하지 않음 — got '$absent_log'"
fi

# === Negative/branch (읽기 불가): chmod 000 → return 0 + env 불변 + 로그 경로만(값 노출 0) ===
# 일부 CI 환경(root/컨테이너)은 chmod 000 을 무시하고 읽을 수 있으므로, 실제로 unreadable
# 이 됐을 때만 unreadable 분기를 assert 하고, 그렇지 않으면 skip 처리(환경 의존 회피).
UNREADABLE_FILE="$WORKDIR/.env.unreadable"
write_realdata_file "$UNREADABLE_FILE"
chmod 000 "$UNREADABLE_FILE" 2>/dev/null || true
if [ -r "$UNREADABLE_FILE" ]; then
  pass "negative(읽기 불가): 환경이 chmod 000 을 무시(root 등) — unreadable 분기 skip"
else
  clear_gating_env
  unread_rc="$( ENV_REALDATA_FILE="$UNREADABLE_FILE" bash -c '
    source "$1"; source_realdata_env >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
  if [ "$unread_rc" = "0" ]; then
    pass "negative(읽기 불가): source_realdata_env return 0(run 미실패, 안전 우선)"
  else
    failtest "negative(읽기 불가): expected return 0, got '$unread_rc'"
  fi
  unread_gating="$( ENV_REALDATA_FILE="$UNREADABLE_FILE" bash -c '
    source "$1"; source_realdata_env >/dev/null 2>&1
    realdata_eval_gating_enabled >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
  if [ "$unread_gating" = "1" ]; then
    pass "negative(읽기 불가): env 불변 → gating 여전히 disabled(source 안 됨)"
  else
    failtest "negative(읽기 불가): gating disabled 기대(1), got '$unread_gating'"
  fi
  unread_log="$( ENV_REALDATA_FILE="$UNREADABLE_FILE" bash -c '
    source "$1"; source_realdata_env 2>&1 1>/dev/null' _ "$DAILY_TEST_SH" )"
  if printf '%s' "$unread_log" | grep -q "$UNREADABLE_FILE" \
     && ! printf '%s' "$unread_log" | grep -q "$DUMMY_SECRET"; then
    pass "negative(읽기 불가): 진단 로그가 경로만 보고 + 값 노출 0(§9)"
  else
    failtest "negative(읽기 불가): 로그가 경로 미보고 또는 값 노출 — got '$unread_log'"
  fi
fi
chmod u+rwx "$UNREADABLE_FILE" 2>/dev/null || true

# === §9 값-echo 0: 존재+readable source 시 로그(stderr)에 더미 secret 값 미노출 ===
clear_gating_env
src_log="$( ENV_REALDATA_FILE="$ENV_FILE" bash -c '
  source "$1"; source_realdata_env 2>&1 1>/dev/null' _ "$DAILY_TEST_SH" )"
if printf '%s' "$src_log" | grep -q "$DUMMY_SECRET"; then
  failtest "§9: source_realdata_env 로그에 더미 secret 값 노출됨"
else
  pass "§9: source_realdata_env 로그에 값 echo 0 — 경로/\"sourced\" 만 보고"
fi
if printf '%s' "$src_log" | grep -q 'sourced'; then
  pass "§9: source 성공 시 로그가 \"sourced\" + 경로만 보고"
else
  failtest "§9: source 성공 로그에 'sourced' 표기 없음 — got '$src_log'"
fi

# === override 결정론: 이미 set 된 키를 파일이 재정의 → source 후 파일 값 반영 ===
# 부모에서 한 키를 preexisting-value 로 export 한 뒤 파일이 같은 키를 DUMMY_SECRET 로
# 정의 → source 후 그 키의 값이 파일 값(DUMMY_SECRET)으로 바뀌었는지 확인(silently-partial
# 아님). §9: preexisting-value 는 spec 내부 토큰이라 실 credential 아님.
override_val="$( REALDATA_E2E_LLM_MODEL='preexisting-value' \
  ENV_REALDATA_FILE="$ENV_FILE" bash -c '
    source "$1"; source_realdata_env >/dev/null 2>&1
    printf "%s" "$REALDATA_E2E_LLM_MODEL"' _ "$DAILY_TEST_SH" )"
if [ "$override_val" = "$DUMMY_SECRET" ]; then
  pass "override 결정론: 파일이 재정의한 키는 source 후 파일 값이 반영(결정론적 override)"
else
  failtest "override 결정론: 파일 값 기대('$DUMMY_SECRET'), got '$override_val'"
fi

# === edge(빈 파일): 존재+readable+빈 내용 → return 0, env 불변, 에러 0 ===
EMPTY_FILE="$WORKDIR/.env.empty"
: >"$EMPTY_FILE"
clear_gating_env
empty_rc="$( ENV_REALDATA_FILE="$EMPTY_FILE" bash -c '
  source "$1"; source_realdata_env >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$empty_rc" = "0" ]; then
  pass "edge(빈 파일): source_realdata_env return 0(에러 0)"
else
  failtest "edge(빈 파일): expected return 0, got '$empty_rc'"
fi
empty_gating="$( ENV_REALDATA_FILE="$EMPTY_FILE" bash -c '
  source "$1"; source_realdata_env >/dev/null 2>&1
  realdata_eval_gating_enabled >/dev/null 2>&1; echo $?' _ "$DAILY_TEST_SH" )"
if [ "$empty_gating" = "1" ]; then
  pass "edge(빈 파일): 정의 0 → env 불변 → gating 여전히 disabled"
else
  failtest "edge(빈 파일): gating disabled 기대(1), got '$empty_gating'"
fi

# === source-guard 무결성: daily-test.sh source 시 실행 블록 부작용 0 ===
# source 만으로 HTTP/redeploy/jest 가 돌지 않고 함수만 노출되는지 — source_realdata_env 가
# 함수로 정의됐는지 확인(source 가드가 실행 블록을 건너뜀).
guard_ok="$( bash -c '
  source "$1" >/dev/null 2>&1
  if declare -F source_realdata_env >/dev/null; then echo yes; else echo no; fi' \
  _ "$DAILY_TEST_SH" )"
if [ "$guard_ok" = "yes" ]; then
  pass "source-guard: source 시 source_realdata_env 함수만 노출(실행 블록 부작용 0)"
else
  failtest "source-guard: source_realdata_env 함수 미노출 — got '$guard_ok'"
fi

# === 실행 블록 배선: 시작 로그 직후 gating 이전에 source_realdata_env 1 회 호출 ===
# 정적 grep — 실행 블록에 source_realdata_env 호출문이 존재하는지(배선 회귀 가드).
if grep -q '^source_realdata_env$' "$DAILY_TEST_SH"; then
  pass "실행 블록에 source_realdata_env 호출 배선 존재(gating 이전 1 회)"
else
  failtest "실행 블록에 source_realdata_env 호출 배선 없음"
fi

# === 결과 집계 ===
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
