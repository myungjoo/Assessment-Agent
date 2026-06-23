#!/usr/bin/env bash
# Assessment-Agent — 일일 배포 후 black-box 스모크 테스트 러너 (T-0447, ADR-0043).
#
# 매일 02:00 에 로컬 PC 의 Claude Desktop 로컬 루틴이 SSH 로 배포 기기(arm64 Pi5,
# 192.168.0.7) 에서 본 스크립트를 1 회 실행한다. 동작:
#   step 1 redeploy  — deploy/redeploy.sh 호출 (origin/main 동기화 → 재빌드 → 컨테이너 교체)
#   step 2 health    — GET /api 가 APP_STATUS_MESSAGE("Assessment-Agent") 될 때까지 폴링
#   step 3 liveness  — GET /api 문자열 일치 + GET / 가 200 + SPA HTML (ADR-0040)
#   step 4 auth      — POST /api/users(201|409) → POST /api/auth/login(200) → GET /api/auth/me(200)
#   step 5 eval      — (gating env 7 종 모두 set 일 때만) realdata-e2e live smoke 1 회 spawn.
#                      gating 부재 시 SKIP(no-op — 네트워크 0 / secret 0 / jest spawn 0). T-0612.
#
# 운영 이미지는 pnpm prune --prod 로 devDependency(jest 등)가 제거돼 컨테이너 안에서
# jest 를 못 돌린다. 그래서 daily 검증은 기동된 컨테이너를 :3000 으로 두드리는 black-box
# HTTP 스모크다 (근거 ADR-0043). CI deploy-artifacts job 이 매 PR 마다 amd64·ephemeral 에서
# boot+serve 를 검증하는 것과 달리, 본 러너는 arm64 실기 + 영속 DB + main HEAD 를 검증한다.
#
# 출력:
#   - 사람용 전체 로그 → deploy/logs/daily-<UTC-ts>.log
#   - 머신 요약 JSON  → deploy/logs/latest-result.json + stdout (루틴이 파싱)
#   - exit 0 (전부 PASS) / non-zero (하나라도 FAIL)
# stdout 은 마지막 1 줄 JSON 요약만, 진행 로그는 stderr + 로그 파일로 분리한다
# (루틴이 stdout 을 JSON 으로 깔끔히 파싱할 수 있도록).
#
# env override:
#   REPO_DIR            배포 체크아웃 (기본 /opt/assessment-agent)
#   BASE_URL            앱 base URL (기본 http://localhost:3000)
#   DAILY_SMOKE_EMAIL   인증 스모크 고정 계정 email (기본 daily-smoke@local.test)
#   DAILY_SMOKE_PASSWORD  동 비밀번호 (기본 길이 ≥ 8 — AddUserDto @MinLength(8))
#   SKIP_REDEPLOY=1     step 1 생략 (디버깅·이미 배포된 상태 테스트용)
#   HEALTH_TIMEOUT      health 폴링 최대 초 (기본 180 — Pi5 빌드·부팅 느림)
#   LOG_KEEP            보관할 daily 로그 개수 (기본 14)
set -uo pipefail

REPO_DIR="${REPO_DIR:-/opt/assessment-agent}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
SMOKE_EMAIL="${DAILY_SMOKE_EMAIL:-daily-smoke@local.test}"
SMOKE_PASSWORD="${DAILY_SMOKE_PASSWORD:-daily-smoke-pw-2026}"
SKIP_REDEPLOY="${SKIP_REDEPLOY:-0}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"
LOG_KEEP="${LOG_KEEP:-14}"

readonly HEALTH_MESSAGE="Assessment-Agent"   # src/app.service.ts APP_STATUS_MESSAGE

LOG_DIR="$REPO_DIR/deploy/logs"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="$LOG_DIR/daily-$TS.log"
RESULT_JSON="$LOG_DIR/latest-result.json"

mkdir -p "$LOG_DIR"

# log: 진행 메시지를 로그 파일과 stderr 양쪽에 기록 (stdout 은 JSON 전용이라 건드리지 않음).
log() {
  printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" | tee -a "$LOG_FILE" >&2
}

# curl_code: HTTP status code 만 반환 (응답 body 는 버림). --max-time 으로 hang 방지.
curl_code() {
  curl -s -o /dev/null -w '%{http_code}' --max-time "${1}" "${@:2}"
}

# --- step 구현 -------------------------------------------------------------

step_redeploy() {
  log "step redeploy: deploy/redeploy.sh 실행"
  if REPO_DIR="$REPO_DIR" bash "$REPO_DIR/deploy/redeploy.sh" >>"$LOG_FILE" 2>&1; then
    log "step redeploy: OK"
    return 0
  fi
  log "step redeploy: FAIL (redeploy.sh non-zero — 로그 참조)"
  return 1
}

step_health() {
  log "step health: GET /api == '$HEALTH_MESSAGE' 대기 (max ${HEALTH_TIMEOUT}s)"
  local deadline body
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    body="$(curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true)"
    if [ "$body" = "$HEALTH_MESSAGE" ]; then
      log "step health: OK"
      return 0
    fi
    sleep 3
  done
  log "step health: TIMEOUT (마지막 응답='${body:-<none>}')"
  return 1
}

step_liveness() {
  local body code root
  body="$(curl -s --max-time 5 "$BASE_URL/api" 2>/dev/null || true)"
  if [ "$body" != "$HEALTH_MESSAGE" ]; then
    log "step liveness: FAIL — GET /api 불일치 ('${body:-<none>}')"
    return 1
  fi
  code="$(curl_code 10 "$BASE_URL/")"
  root="$(curl -s --max-time 10 "$BASE_URL/" 2>/dev/null || true)"
  if [ "$code" != "200" ]; then
    log "step liveness: FAIL — GET / status=$code"
    return 1
  fi
  if ! printf '%s' "$root" | grep -qiE '<!doctype html|id="root"'; then
    log "step liveness: FAIL — GET / 가 SPA HTML 아님"
    return 1
  fi
  log "step liveness: OK (GET /api 일치, GET / 200 + SPA HTML)"
  return 0
}

step_auth() {
  local payload jar code
  payload="$(printf '{"email":"%s","password":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD")"
  jar="$(mktemp)"

  # signup — 멱등: 첫 호출 201, 이미 존재하면 409 (둘 다 정상). 그 외는 FAIL.
  code="$(curl_code 10 -X POST "$BASE_URL/api/users" \
    -H 'Content-Type: application/json' -d "$payload")"
  case "$code" in
    201 | 409) log "step auth: signup OK ($code)" ;;
    *) log "step auth: FAIL — signup status=$code"; rm -f "$jar"; return 1 ;;
  esac

  # login — 200 + Set-Cookie (cookie jar 저장).
  code="$(curl_code 10 -c "$jar" -X POST "$BASE_URL/api/auth/login" \
    -H 'Content-Type: application/json' -d "$payload")"
  if [ "$code" != "200" ]; then
    log "step auth: FAIL — login status=$code"; rm -f "$jar"; return 1
  fi

  # me — 200 (jar 의 access_token cookie 로 인증).
  code="$(curl_code 10 -b "$jar" "$BASE_URL/api/auth/me")"
  rm -f "$jar"
  if [ "$code" != "200" ]; then
    log "step auth: FAIL — me status=$code"; return 1
  fi
  log "step auth: OK (signup→login→me round-trip)"
  return 0
}

# realdata-e2e live smoke 의 gating env 7 종 이름 (T-0610 realdata-e2e-live-gating.ts 의
# REALDATA_E2E_REQUIRED_ENV 를 bash 로 mirror — 정본은 그 helper, 본 배열은 그 이름
# 집합·순서를 그대로 따른다. bash 에서 TS import 불가하므로 이름만 동일 박제).
#   enable flag → Ollama 접속 5 종 → github read PAT.
REALDATA_E2E_REQUIRED_ENV=(
  REALDATA_E2E_LIVE_TEST
  REALDATA_E2E_LLM_BASE_URL
  REALDATA_E2E_LLM_API_KEY
  REALDATA_E2E_LLM_MODEL
  REALDATA_E2E_LLM_PROVIDER
  REALDATA_E2E_LLM_API_VERSION
  REALDATA_E2E_GITHUB_READ_PAT
)

# realdata_eval_gating_enabled: gating env 7 종이 *모두* present+non-blank(trim 후 길이
# > 0)인지 검사 (T-0610 helper 의 isPresent / 완전성 규칙 mirror). 하나라도 부재/빈/
# 공백-only 면 1(disabled) 반환. 실 credential 값은 절대 echo 0 — 부재 시 *이름* 만
# 진단 로그(§9). enabled 면 0, disabled 면 1.
realdata_eval_gating_enabled() {
  local name val missing=()
  for name in "${REALDATA_E2E_REQUIRED_ENV[@]}"; do
    val="${!name-}"
    # trim 후 비어있으면 부재로 간주(공백-only guard — helper 의 non-blank 규칙 mirror).
    if [ -z "${val//[[:space:]]/}" ]; then
      missing+=("$name")
    fi
  done
  if [ "${#missing[@]}" -ne 0 ]; then
    # 실값 0 — 부재 env *이름* 만 보고(§9). 부분-set 진단.
    log "step eval: gating env 부재 — ${missing[*]}"
    return 1
  fi
  return 0
}

# step_eval: gating 활성(7 종 모두 set)이면 realdata-e2e live smoke 를 단일-spec bound
# jest argv 로 1 회 spawn → exit 0 면 PASS(return 0), non-zero 면 FAIL(return 1).
# gating 부재면 함수가 호출되지 않는다(caller 가 gating 검사 후 분기 — 본 함수는 run leg
# 만 담당). jest argv 는 T-0611 buildRealDataDailyStepEvalCommandPlan 의 run 분기 산출을
# bash 로 mirror (정본은 그 helper). 실 credential 값은 argv 미포함 — 자식 jest 프로세스가
# 상속한 process env 로 전달되며 본 함수는 그 값을 로그/JSON 에 echo 0(§9).
step_eval() {
  log "step eval: realdata-e2e live smoke 실행 (gating env 7 종 set)"
  # T-0611 plan helper 의 run argv mirror: 단일-spec bound · smoke jest config 재사용.
  #   ["--config", "./test/jest-smoke.json", "--runTestsByPath",
  #    "test/smoke/realdata-e2e-live.smoke-spec.ts"]
  if ( cd "$REPO_DIR" && pnpm exec jest \
        --config ./test/jest-smoke.json \
        --runTestsByPath test/smoke/realdata-e2e-live.smoke-spec.ts ) >>"$LOG_FILE" 2>&1; then
    log "step eval: OK (live smoke PASS)"
    return 0
  fi
  log "step eval: FAIL (live smoke non-zero — 로그 참조)"
  return 1
}

# --- 실행 ------------------------------------------------------------------

# step 상태 누적·순서·mark 헬퍼는 source 시에도 노출돼야 spec 이 ORDER 순회/JSON 조립
# 호환(eval 추가로 기존 4 step 회귀 0)을 검증할 수 있으므로 가드 *앞* 에 정의한다.
declare -A STEP_STATUS=()
FAILED_STEP="null"
ORDER=(redeploy health liveness auth eval)

mark() { # mark <step> <PASS|FAIL|SKIP>
  STEP_STATUS["$1"]="$2"
  if [ "$2" = "FAIL" ] && [ "$FAILED_STEP" = "null" ]; then
    FAILED_STEP="$1"
  fi
}

# 본 스크립트가 source 될 때(executable bash spec 의 함수 단위 검증용)는 아래 실행 블록을
# 건너뛰어 함수 정의(step_eval / realdata_eval_gating_enabled / mark 등)만 노출한다.
# 직접 실행(`bash deploy/daily-test.sh`)이면 정상적으로 전체 step 을 수행한다. T-0612 —
# deploy/daily-test-step-eval.test.sh 가 이 가드를 통해 HTTP/redeploy 부작용 0 으로
# gating 판정·argv·SKIP 분기만 단위 검증한다.
if [ "${BASH_SOURCE[0]}" != "${0}" ]; then
  return 0 2>/dev/null || true
fi

log "=== daily-test 시작 (ts=$TS, base=$BASE_URL) ==="

# SKIP_REDEPLOY=1(디버깅·이미 배포된 상태 테스트)은 redeploy 를 SKIP 으로 명확히 표기한다.
# "PASS"(실제 실행 성공)와 구분해 머신 JSON 이 무인 모니터링에 false 신호를 주지 않게 한다.
if [ "$SKIP_REDEPLOY" = "1" ]; then
  log "step redeploy: SKIP (SKIP_REDEPLOY=1)"
  mark redeploy SKIP
elif step_redeploy; then
  mark redeploy PASS
else
  mark redeploy FAIL
fi

# redeploy 가 FAIL 이 아니면(PASS 또는 SKIP) health 를 실행한다.
if [ "${STEP_STATUS[redeploy]}" != "FAIL" ]; then
  if step_health; then mark health PASS; else mark health FAIL; fi
else
  mark health SKIP
fi

if [ "${STEP_STATUS[health]:-SKIP}" = "PASS" ]; then
  if step_liveness; then mark liveness PASS; else mark liveness FAIL; fi
  if step_auth; then mark auth PASS; else mark auth FAIL; fi
else
  mark liveness SKIP
  mark auth SKIP
fi

# step eval(realdata-e2e live smoke): auth PASS(체인 통과) AND gating env 7 종 set 일 때만
# 실행. 그 외(체인 미통과 또는 gating 부재)는 mark eval SKIP — cloud CI / 일반 LAN 에서
# 네트워크 0 / secret 0 / jest spawn 0 의 no-op(기존 4 step 동작 불변). T-0612.
if [ "${STEP_STATUS[auth]:-SKIP}" != "PASS" ]; then
  log "step eval: SKIP (선행 체인 미통과 — auth=${STEP_STATUS[auth]:-SKIP})"
  mark eval SKIP
elif ! realdata_eval_gating_enabled; then
  # gating 부재 — 조용한 SKIP(no-op). gating 진단 로그는 realdata_eval_gating_enabled 가
  # 부재 env 이름만 출력(실값 echo 0, §9).
  log "step eval: SKIP (gating env 부재 — cloud CI / 일반 LAN no-op)"
  mark eval SKIP
elif step_eval; then
  mark eval PASS
else
  mark eval FAIL
fi

# 전체 결과: 하나라도 FAIL 이면 FAIL.
RESULT="PASS"
for s in "${ORDER[@]}"; do
  [ "${STEP_STATUS[$s]}" = "FAIL" ] && RESULT="FAIL"
done

GIT_SHA="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"

# steps JSON object 조립.
steps_json=""
for s in "${ORDER[@]}"; do
  steps_json="$steps_json,\"$s\":\"${STEP_STATUS[$s]}\""
done
steps_json="{${steps_json#,}}"

# latest-result.json 기록 (필드 전부 통제된 토큰/경로라 별도 escape 불요).
printf '{"ts":"%s","gitSha":"%s","result":"%s","failedStep":%s,"steps":%s,"logPath":"%s"}\n' \
  "$TS" "$GIT_SHA" "$RESULT" \
  "$([ "$FAILED_STEP" = "null" ] && echo null || printf '"%s"' "$FAILED_STEP")" \
  "$steps_json" "$LOG_FILE" >"$RESULT_JSON"

log "=== daily-test 종료: $RESULT (failedStep=$FAILED_STEP, sha=$GIT_SHA) ==="

# 오래된 daily 로그 prune (최근 LOG_KEEP 개 유지).
# shellcheck disable=SC2012
ls -1t "$LOG_DIR"/daily-*.log 2>/dev/null | tail -n +"$((LOG_KEEP + 1))" | xargs -r rm -f

# 머신 요약을 stdout 으로 (루틴이 파싱).
cat "$RESULT_JSON"

[ "$RESULT" = "PASS" ]
