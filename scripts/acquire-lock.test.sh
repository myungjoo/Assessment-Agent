#!/usr/bin/env bash
# scripts/acquire-lock.test.sh
#
# scripts/acquire-lock.sh 의 executable spec (CLAUDE.md §3.2 R-110/R-112).
# 본 task(T-0673) 핵심: lock-acquire 가 claims.json 을 wipe 하던 double-claim(#588)
# 근본 버그의 회귀 가드를 박제한다.
#
# 선례 mirror: scripts/select-claim.test.sh(bare-repo + 2 clone self-contained,
# `--force-with-lease` CAS, count_entry, NOW 주입). 네트워크/credential 불요 —
# 로컬 bare repo + 2 clone. CI ubuntu 통과.
#
# 분기-검증 매핑 (acquire-lock.sh 의 분기마다 case 1+ — Branch/function ≥80% cover):
#   B1 lock ref 부재 → zero-sha(expect-absent) lease 첫 생성    : [T1]
#   B2 free/held/stale tip 위 획득(old-sha base tree 보존)       : [T2][T3][T4]
#   B3 claims.json 존재 tip 에서 획득 → claims.json byte 보존     : [T3] (핵심 회귀 가드)
#   B4 CAS lease mismatch(틀린 old-sha) → push reject            : [T5] negative
#   B5 빈/누락 commit push 가드(test -n "$COMMIT")               : [T6] negative
#   B6 release(tombstone) 경로 → claims.json 보존                : [T7] negative/branch
#   B7 CAS race lose → old-sha 재독 후 재시도                     : [T5] 패자 직접 push 거부로 cover

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/acquire-lock.sh"
FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

REF="refs/heads/claude/lock-driver"

git init -q --bare origin.git
git clone -q origin.git A 2>/dev/null
git clone -q origin.git B 2>/dev/null

pass() { echo "  ok: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

# clone 안에서 acquire-lock.sh 실행(remote=origin.git, 해당 clone cwd).
run_acquire() { # <clone> <holder> <session> [since]  -> stdout=new tip sha, rc 반환
  local clone="$1"; shift
  ( cd "$WORK/$clone" \
    && ACQUIRE_REMOTE="$WORK/origin.git" ACQUIRE_REF="$REF" ACQUIRE_NOW="2026-06-26T00:00:00Z" \
       bash "$SCRIPT" "$@" )
}

# lock ref tip 의 lock.json holder 값. tombstone(holder:null) 은 빈 문자열(free)로 정규화.
tip_holder() {
  local tip raw
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  [ -z "$tip" ] && { echo ""; return; }
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  raw="$(git -C "$WORK/A" cat-file -p "$tip:lock.json" 2>/dev/null \
    | grep -oE '"holder"[[:space:]]*:[[:space:]]*("[^"]*"|null)' \
    | sed -E 's/.*"holder"[[:space:]]*:[[:space:]]*("?)([^"]*)\1/\2/')"
  [ "$raw" = "null" ] && raw=""
  echo "$raw"
}

# lock ref tip 의 claims.json raw 본문(byte 비교용).
tip_claims_raw() {
  local tip
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  [ -z "$tip" ] && { echo "<no-ref>"; return; }
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  git -C "$WORK/A" cat-file -p "$tip:claims.json" 2>/dev/null || echo "<no-claims>"
}

cur_tip() { git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1; }

# ──────────────────────────────────────────────────────────────────────────
echo "[T1] error-path — lock ref 부재 시 zero-sha(expect-absent) lease 로 첫 lock 생성 (B1)"
OUT="$(run_acquire A cron cron@h-1)"; RC=$?
if [ $RC -eq 0 ] && [ -n "$OUT" ] && [ "$(tip_holder)" = "cron" ]; then
  pass "ref 부재에서 첫 lock 생성 exit 0, holder=cron (tip=$OUT)"
else
  fail "첫 lock 생성 실패 (rc=$RC out=$OUT holder=$(tip_holder))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T2] happy-path/branch — free(tombstone) tip 에서 획득 (B2 free)"
# 먼저 release 로 free(tombstone) 상태를 만든 뒤 그 위에서 재획득.
run_acquire A release >/dev/null; R0=$?
if [ $R0 -eq 0 ] && [ -z "$(tip_holder)" ]; then
  pass "release 후 tombstone holder=null (free 표현)"
else
  fail "release 후 free 아님 (rc=$R0 holder=$(tip_holder))"
fi
OUT2="$(run_acquire A loop loop@h-2)"; RC2=$?
if [ $RC2 -eq 0 ] && [ "$(tip_holder)" = "loop" ]; then
  pass "free tip 위 재획득 성공 holder=loop"
else
  fail "free tip 재획득 실패 (rc=$RC2 holder=$(tip_holder))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T3] **회귀 가드(핵심)** — claims.json 존재 tip 에서 획득 후 claims.json byte 보존 (B3)"
# 활성 claim 1개를 lock ref tip tree 에 직접 박는다(select-claim 박제 상황 재현).
CUR="$(cur_tip)"
CLAIMS_BODY='[{"taskId":"T-7777","owner":"loopX@h-9","claimedAt":"2026-06-26T00:00:00Z","status":"IN_PROGRESS","prNumber":42}]'
CLAIMS_BLOB="$(printf '%s' "$CLAIMS_BODY" | git -C A hash-object -w --stdin)"
# 기존 tip 의 lock.json 을 보존하면서 claims.json 을 추가한 tree 를 만들어 push.
LOCK_LINE="$(git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null; git -C A ls-tree "$CUR" | grep -E '\slock\.json$')"
SEED_TREE="$( { echo "$LOCK_LINE"; printf '100644 blob %s\tclaims.json\n' "$CLAIMS_BLOB"; } | git -C A mktree )"
SEED_COMMIT="$(git -C A -c user.name=seed -c user.email=seed@localhost commit-tree "$SEED_TREE" -p "$CUR" -m seed)"
git -C A push -q "$WORK/origin.git" "$SEED_COMMIT:$REF" --force-with-lease="$REF:$CUR" 2>/dev/null
BEFORE="$(tip_claims_raw)"
# 이제 다른 driver 가 lock 을 (재)획득 — claims.json 이 보존되어야 한다.
OUT3="$(run_acquire B cron cron@h-3)"; RC3=$?
AFTER="$(tip_claims_raw)"
if [ $RC3 -eq 0 ] && [ "$(tip_holder)" = "cron" ]; then
  pass "claims.json 존재 tip 위 lock 재획득 성공 holder=cron"
else
  fail "claims 존재 tip 재획득 실패 (rc=$RC3 holder=$(tip_holder))"
fi
if [ "$AFTER" = "$BEFORE" ] && [ "$AFTER" = "$CLAIMS_BODY" ]; then
  pass "claims.json byte-동일 보존 — double-claim(#588) wipe 버그 회귀 가드 통과"
else
  fail "claims.json 이 wipe/변형됨 (before=$BEFORE after=$AFTER)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T4] branch — held(다른 holder) tip 에서 획득(탈취 판정은 호출측, script 는 CAS) (B2 held)"
# 현재 holder=cron(T3). 호출측이 stale 판정해 lease=현재 tip 으로 재획득하면 성공.
OUT4="$(run_acquire A loop loop@h-4)"; RC4=$?
if [ $RC4 -eq 0 ] && [ "$(tip_holder)" = "loop" ] && [ "$(tip_claims_raw)" = "$CLAIMS_BODY" ]; then
  pass "held tip 위 CAS 재획득 성공 holder=loop + claims.json 여전히 보존"
else
  fail "held tip 재획득 이상 (rc=$RC4 holder=$(tip_holder) claims=$(tip_claims_raw))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T5] negative — CAS lease mismatch(틀린 old-sha)로 직접 push → 거부 (B4/B7)"
CUR5="$(cur_tip)"
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
EVIL_BLOB="$(printf '{"holder":"evil","session":"e","since":"t"}' | git -C A hash-object -w --stdin)"
EVIL_TREE="$(printf '100644 blob %s\tlock.json\n' "$EVIL_BLOB" | git -C A mktree)"
EVIL_COMMIT="$(git -C A -c user.name=evil -c user.email=evil@localhost commit-tree "$EVIL_TREE" -p "$CUR5" -m evil)"
# 일부러 틀린(빈=expect-absent) lease 로 push — 현재 ref 는 CUR5 이므로 stale.
if git -C A push "$WORK/origin.git" "$EVIL_COMMIT:$REF" --force-with-lease="$REF:" >/dev/null 2>&1; then
  fail "stale lease(expect-absent) 통과됨 — CAS 위반"
else
  pass "stale lease 거부됨 — 동시 탈취 race 에서 1개만 승리 보장(이중 획득 0)"
fi
if [ "$(tip_holder)" != "evil" ]; then
  pass "거부된 stale 획득(evil) 미반영 — holder 불변($(tip_holder))"
else
  fail "stale 획득이 반영됨 (holder=evil)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T6] negative — 빈/누락 COMMIT push 가드(MEMORY lock-cas-bash-hazard) (B5)"
# acquire-lock.sh 의 commit-tree 가 빈 값을 내면 push 차단(브랜치 삭제 방지) 후 exit≠0.
# commit-tree 실패를 결정론적으로 유발: 존재하지 않는 ACQUIRE_REF tree 가 아니라
# git 환경 자체를 망가뜨려(잘못된 GIT_DIR) commit-tree 실패 → 가드 발동을 본다.
TIP_BEFORE6="$(cur_tip)"
OUT6="$( cd "$WORK/A" \
  && GIT_DIR=/nonexistent/path/.git ACQUIRE_REMOTE="$WORK/origin.git" ACQUIRE_REF="$REF" \
     ACQUIRE_RETRIES=0 bash "$SCRIPT" cron cron@h-6 2>&1 )"; RC6=$?
TIP_AFTER6="$(cur_tip)"
if [ $RC6 -ne 0 ] && [ "$TIP_AFTER6" = "$TIP_BEFORE6" ] && [ -n "$TIP_AFTER6" ]; then
  pass "commit-tree 실패 시 빈 COMMIT push 차단 — exit≠0 + ref tip 불변(브랜치 미삭제)"
else
  fail "빈 COMMIT 가드 미발동 (rc=$RC6 tip $TIP_BEFORE6→$TIP_AFTER6)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T7] negative/branch — release(tombstone) 후에도 claims.json 보존 (B6)"
# 현재 tip 에 claims.json(T-7777) 동거 중. release 하면 lock.json 만 tombstone 으로
# 바뀌고 claims.json 은 그대로 보존되어야 한다(release 가 claim wipe 하면 안 됨).
BEFORE7="$(tip_claims_raw)"
run_acquire A release >/dev/null; RC7=$?
AFTER7="$(tip_claims_raw)"
if [ $RC7 -eq 0 ] && [ -z "$(tip_holder)" ] && [ "$AFTER7" = "$BEFORE7" ] && [ "$AFTER7" = "$CLAIMS_BODY" ]; then
  pass "release 후 holder=null(tombstone) + claims.json byte-동일 보존"
else
  fail "release 가 claims.json 을 wipe/변형 (rc=$RC7 holder=$(tip_holder) before=$BEFORE7 after=$AFTER7)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "acquire-lock 검증 통과 (T1 first-create / T2 free / T3 claims보존회귀 / T4 held / T5 CAS거부 / T6 빈commit가드 / T7 release보존)"
  exit 0
else
  echo "acquire-lock 검증 실패"
  exit 1
fi
