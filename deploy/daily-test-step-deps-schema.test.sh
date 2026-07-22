#!/usr/bin/env bash
# deploy/daily-test-step-deps-schema.test.sh
#
# deploy/daily-test.sh 의 `ensure_realdata_deps_and_schema` 배선(T-1124, issue #1013 slice
# C-2)의 executable spec (CLAUDE.md §3.2 R-112). daily-test-step-env-source.test.sh(T-1123)
# 동형의 순수 bash — 네트워크 0 / 실 install·migrate spawn 0 / 실 credential echo 0. 실
# pnpm 은 PATH-shim 으로 대체해 invocation 만 파일에 기록하고 exit code 를 주입한다. 검증 대상:
#   - source-guard *앞* 정의라 source 시 함수만 노출 + 실행 블록 부작용 0.
#   - Happy-path(gating 활성 + shim exit 0): install --frozen-lockfile → exec prisma migrate
#     deploy 순서로 호출 + return 0.
#   - 순서 결정론: install invocation 이 migrate invocation 보다 먼저 기록됨.
#   - Negative(gating 부재): no-op return 0 + shim 미호출(invocation 기록 비어있음) + 로그 no-op.
#   - Negative(install 실패): return 1 + migrate 미호출(short-circuit).
#   - Negative(migrate 실패): install 성공 + migrate 실패 → return 1.
#   - §9: 더미 DATABASE_URL 값이 헬퍼 로그(stderr) 어디에도 안 나타남.
#
# daily-test.sh 는 source 가드(BASH_SOURCE != $0)로 실행 블록을 건너뛰어 함수 정의만
# 노출하므로, 본 spec 은 그 함수를 직접 호출해 부작용 0 으로 단위 검증한다.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAILY_TEST_SH="$SCRIPT_DIR/daily-test.sh"
fail=0

# spec 전용 격리 WORKDIR — source 시 daily-test.sh top-level mkdir 가 여기에만 닿게 +
# PATH-shim / invocation 기록 / gating env fixture 도 여기에 만든다.
WORKDIR="$(mktemp -d 2>/dev/null || echo "/tmp/t1124-$$")"
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
DUMMY_DB_URL="postgres://dummy-not-a-real-secret@x/y"

export REPO_DIR="$WORKDIR"

pass() { echo "PASS: $1"; }
failtest() { echo "FAIL: $1"; fail=1; }

# PATH-shim pnpm: 실 install/migrate 를 spawn 하지 않고 invocation 을 PNPM_INVOCATION_LOG 에
# 한 줄씩 기록한 뒤 주입된 exit code 로 반환한다(install → PNPM_INSTALL_RC, exec → PNPM_MIGRATE_RC).
SHIM_DIR="$WORKDIR/shim"
mkdir -p "$SHIM_DIR"
cat >"$SHIM_DIR/pnpm" <<'SHIM'
#!/usr/bin/env bash
echo "$*" >> "$PNPM_INVOCATION_LOG"
case "$1" in
  install) exit "${PNPM_INSTALL_RC:-0}" ;;
  exec)    exit "${PNPM_MIGRATE_RC:-0}" ;;
  *)       exit 0 ;;
esac
SHIM
chmod +x "$SHIM_DIR/pnpm"

# gating 활성 env fixture — 7 종 gating + 더미 DATABASE_URL 를 export 한다(§9: 실 credential
# 아닌 spec 내부 더미 토큰).
GATING_ENV_FILE="$WORKDIR/gating.env"
: >"$GATING_ENV_FILE"
for n in "${REQUIRED_ENV[@]}"; do
  printf 'export %s=%s\n' "$n" "$DUMMY_SECRET" >>"$GATING_ENV_FILE"
done
printf 'export DATABASE_URL=%s\n' "$DUMMY_DB_URL" >>"$GATING_ENV_FILE"

# run_rc: <gating on|off> <install_rc> <migrate_rc> <inv_log> → 헬퍼 exit code 를 echo.
#   invocation 은 inv_log 에 기록, stderr/stdout 은 버린다.
run_rc() {
  local gating="$1" irc="$2" mrc="$3" invlog="$4" pre=""
  : >"$invlog"
  [ "$gating" = "on" ] && pre="source '$GATING_ENV_FILE'; "
  PATH="$SHIM_DIR:$PATH" PNPM_INVOCATION_LOG="$invlog" \
    PNPM_INSTALL_RC="$irc" PNPM_MIGRATE_RC="$mrc" \
    bash -c "${pre}source \"\$1\"; ensure_realdata_deps_and_schema >/dev/null 2>&1; echo \$?" \
    _ "$DAILY_TEST_SH"
}

# run_log: 위와 동일하되 헬퍼의 stderr 로그를 stdout 으로 캡처(§9 / no-op 문구 검증).
run_log() {
  local gating="$1" irc="$2" mrc="$3" invlog="$4" pre=""
  : >"$invlog"
  [ "$gating" = "on" ] && pre="source '$GATING_ENV_FILE'; "
  PATH="$SHIM_DIR:$PATH" PNPM_INVOCATION_LOG="$invlog" \
    PNPM_INSTALL_RC="$irc" PNPM_MIGRATE_RC="$mrc" \
    bash -c "${pre}source \"\$1\"; ensure_realdata_deps_and_schema 2>&1 1>/dev/null" \
    _ "$DAILY_TEST_SH"
}

# === Happy-path: gating 활성 + shim exit 0 → install 후 migrate 호출 + return 0 ===
HAPPY_LOG="$WORKDIR/inv-happy.log"
happy_rc="$(run_rc on 0 0 "$HAPPY_LOG")"
if [ "$happy_rc" = "0" ]; then
  pass "happy-path: gating 활성 + install/migrate 성공 → return 0"
else
  failtest "happy-path: return 0 기대, got '$happy_rc'"
fi
if grep -q '^install --frozen-lockfile$' "$HAPPY_LOG"; then
  pass "happy-path: pnpm install --frozen-lockfile 호출됨"
else
  failtest "happy-path: install --frozen-lockfile invocation 없음 — got '$(cat "$HAPPY_LOG")'"
fi
if grep -q '^exec prisma migrate deploy$' "$HAPPY_LOG"; then
  pass "happy-path: pnpm exec prisma migrate deploy 호출됨"
else
  failtest "happy-path: exec prisma migrate deploy invocation 없음 — got '$(cat "$HAPPY_LOG")'"
fi

# === 순서 결정론: install invocation 이 migrate invocation 보다 먼저 기록됨 ===
install_ln="$(grep -n '^install --frozen-lockfile$' "$HAPPY_LOG" | head -1 | cut -d: -f1)"
migrate_ln="$(grep -n '^exec prisma migrate deploy$' "$HAPPY_LOG" | head -1 | cut -d: -f1)"
if [ -n "$install_ln" ] && [ -n "$migrate_ln" ] && [ "$install_ln" -lt "$migrate_ln" ]; then
  pass "순서 결정론: install(line $install_ln) → migrate(line $migrate_ln) 고정 순서"
else
  failtest "순서 결정론: install→migrate 순서 위반 (install=$install_ln migrate=$migrate_ln)"
fi

# === Negative(gating 부재): no-op return 0 + shim 미호출 + 로그 no-op 문구 ===
ABSENT_LOG="$WORKDIR/inv-absent.log"
absent_rc="$(run_rc off 0 0 "$ABSENT_LOG")"
if [ "$absent_rc" = "0" ]; then
  pass "negative(gating 부재): no-op return 0(기존 SKIP 동작 보존)"
else
  failtest "negative(gating 부재): return 0 기대, got '$absent_rc'"
fi
if [ ! -s "$ABSENT_LOG" ]; then
  pass "negative(gating 부재): pnpm shim 한 번도 호출 안 됨(invocation 기록 비어있음)"
else
  failtest "negative(gating 부재): shim 호출됨 — got '$(cat "$ABSENT_LOG")'"
fi
absent_log_out="$(run_log off 0 0 "$ABSENT_LOG")"
if printf '%s' "$absent_log_out" | grep -q 'no-op'; then
  pass "negative(gating 부재): 진단 로그가 no-op 문구만 출력"
else
  failtest "negative(gating 부재): no-op 문구 없음 — got '$absent_log_out'"
fi

# === Negative(install 실패): gating 활성 + install shim exit 1 → return 1 + migrate 미호출 ===
INSTALL_FAIL_LOG="$WORKDIR/inv-installfail.log"
installfail_rc="$(run_rc on 1 0 "$INSTALL_FAIL_LOG")"
if [ "$installfail_rc" = "1" ]; then
  pass "negative(install 실패): return 1"
else
  failtest "negative(install 실패): return 1 기대, got '$installfail_rc'"
fi
if grep -q '^install --frozen-lockfile$' "$INSTALL_FAIL_LOG" \
   && ! grep -q '^exec prisma migrate deploy$' "$INSTALL_FAIL_LOG"; then
  pass "negative(install 실패): migrate 미호출(short-circuit)"
else
  failtest "negative(install 실패): short-circuit 위반 — got '$(cat "$INSTALL_FAIL_LOG")'"
fi

# === Negative(migrate 실패): gating 활성 + install 성공 + migrate shim exit 1 → return 1 ===
MIGRATE_FAIL_LOG="$WORKDIR/inv-migratefail.log"
migratefail_rc="$(run_rc on 0 1 "$MIGRATE_FAIL_LOG")"
if [ "$migratefail_rc" = "1" ]; then
  pass "negative(migrate 실패): install 성공 후 migrate 실패 → return 1"
else
  failtest "negative(migrate 실패): return 1 기대, got '$migratefail_rc'"
fi
if grep -q '^install --frozen-lockfile$' "$MIGRATE_FAIL_LOG" \
   && grep -q '^exec prisma migrate deploy$' "$MIGRATE_FAIL_LOG"; then
  pass "negative(migrate 실패): install→migrate 모두 시도됨"
else
  failtest "negative(migrate 실패): invocation 기록 이상 — got '$(cat "$MIGRATE_FAIL_LOG")'"
fi

# === §9 값-echo 0: 더미 DATABASE_URL 값이 헬퍼 로그(stderr) 어디에도 안 나타남 ===
S9_LOG="$WORKDIR/inv-s9.log"
s9_log_out="$(run_log on 0 0 "$S9_LOG")"
if printf '%s' "$s9_log_out" | grep -q "$DUMMY_DB_URL"; then
  failtest "§9: 헬퍼 로그에 DATABASE_URL 값 노출됨"
else
  pass "§9: 헬퍼 로그에 DATABASE_URL 값 echo 0 — 명령/단계만 보고"
fi

# === source-guard 무결성: daily-test.sh source 시 실행 블록 부작용 0 ===
# source 만으로 install/migrate/HTTP 가 돌지 않고 함수만 노출되는지 확인.
guard_ok="$( bash -c '
  source "$1" >/dev/null 2>&1
  if declare -F ensure_realdata_deps_and_schema >/dev/null; then echo yes; else echo no; fi' \
  _ "$DAILY_TEST_SH" )"
if [ "$guard_ok" = "yes" ]; then
  pass "source-guard: source 시 ensure_realdata_deps_and_schema 함수만 노출(부작용 0)"
else
  failtest "source-guard: ensure_realdata_deps_and_schema 함수 미노출 — got '$guard_ok'"
fi

# === 실행 블록 배선: source_realdata_env 이후·첫 step 이전 1 회 호출 존재 ===
# 정적 grep — 실행 블록에 ensure_realdata_deps_and_schema 호출문 존재(배선 회귀 가드).
if grep -q '^ensure_realdata_deps_and_schema' "$DAILY_TEST_SH"; then
  pass "실행 블록에 ensure_realdata_deps_and_schema 호출 배선 존재"
else
  failtest "실행 블록에 ensure_realdata_deps_and_schema 호출 배선 없음"
fi

# === ORDER/cascade 불변 회귀 가드: 본 task 는 ORDER 배열을 변경하지 않는다 ===
if grep -q '^ORDER=(redeploy health liveness auth eval collect rediscovery eval_chain)$' "$DAILY_TEST_SH"; then
  pass "ORDER 배열 불변(leg 미추가 → drift-guard smoke spec 3 종 계약 보존)"
else
  failtest "ORDER 배열이 변경됨 — drift-guard 계약 위반 위험"
fi

# === 결과 집계 ===
if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
