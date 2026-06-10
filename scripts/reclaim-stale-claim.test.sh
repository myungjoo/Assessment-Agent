#!/usr/bin/env bash
# scripts/reclaim-stale-claim.test.sh
#
# scripts/reclaim-stale-claim.sh 의 executable spec (CLAUDE.md §3.2 R-110/R-112).
# ADR-0036 §rollout 2 정확성 게이트의 나머지 절반 "orphan 회수 정상 동작 검증" 을
# 박제한다(slice 1 의 "이중 claim 0" 와 짝).
#
# 선례 mirror: scripts/verify-ref-cas-lock.sh / scripts/select-claim.test.sh
# (bare-repo + 2 clone self-contained, `--force-with-lease` CAS). 네트워크/
# credential 불요 — 로컬 bare repo + clone. CI ubuntu(ambient git identity 0)
# 통과를 위해 모든 commit-tree 는 identity 를 self-provide 한다.
#
# 분기-검증 매핑 (reclaim-stale-claim.sh 의 분기마다 case 1+ — Branch cover):
#   B1 stale orphan(prNumber null) → 단순 제거          : [T1] happy-path
#   B2 stale orphan(prNumber non-null) → PR-resume 신호   : [T2] 중복 PR 차단(정확성)
#   B3 살아있는 claim(임계 미만) → 보존, no-op           : [T3] negative(불변)
#   B4 server-time now 미주입 → 회수 보류                : [T4] negative(§Decision 5)
#   B5 stale lease(틀린 old-sha)로 회수 push → CAS 거부   : [T5] negative(verify-ref-cas T3 mirror)
#   B6 동시 회수 시도 → CAS 로 1개만 성공(이중 회수 0)    : [T6] CAS race(정확성)
#   B7 회수 대상 부재(claims.json 빈 배열/ref 부재) → no-op exit 0 : [T7] negative

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/reclaim-stale-claim.sh"
FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

REF="refs/heads/claude/lock-driver"
# 고정 server-time now. claimedAt 을 이 기준으로 stale/live 로 배치한다.
NOW="2026-06-10T12:00:00Z"
# now-90분(임계 60분 초과 → stale). now-30분(임계 이내 → live).
STALE_AT="2026-06-10T10:30:00Z"
LIVE_AT="2026-06-10T11:30:00Z"

git init -q --bare origin.git
git clone -q origin.git A 2>/dev/null
git clone -q origin.git B 2>/dev/null

pass() { echo "  ok: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

# 주어진 claims.json 배열 내용을 lock ref tip 으로 박제(초기 상태 세팅).
seed_claims() { # <clone> <claims-json>
  local clone="$1" arr="$2" old blob tree commit lease
  ( cd "$WORK/$clone"
    git fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
    old="$(git ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
    blob="$(printf '%s' "$arr" | git hash-object -w --stdin)"
    tree="$(printf '100644 blob %s\tclaims.json\n' "$blob" | git mktree)"
    if [ -n "$old" ]; then
      commit="$(git -c user.name=claim-spec -c user.email=claim-spec@localhost \
        commit-tree "$tree" -p "$old" -m seed)"
      lease="$REF:$old"
    else
      commit="$(git -c user.name=claim-spec -c user.email=claim-spec@localhost \
        commit-tree "$tree" -m seed)"
      lease="$REF:"
    fi
    git push "$WORK/origin.git" "$commit:$REF" --force-with-lease="$lease" >/dev/null 2>&1
  )
}

# lock ref tip 의 claims.json 에서 특정 taskId entry 개수.
count_entry() { # <taskId>
  local tip
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  [ -z "$tip" ] && { echo 0; return; }
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  git -C "$WORK/A" cat-file -p "$tip:claims.json" 2>/dev/null \
    | grep -oE "\"taskId\"[[:space:]]*:[[:space:]]*\"$1\"" | wc -l | tr -d ' '
}

# lock ref tip 의 claims.json 에서 특정 taskId entry 의 owner 값.
owner_of() { # <taskId>
  local tip
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  git -C "$WORK/A" cat-file -p "$tip:claims.json" 2>/dev/null \
    | sed -E 's/\}\s*,\s*\{/}\n{/g' \
    | grep -F "\"taskId\":\"$1\"" \
    | grep -oE '"owner"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n1 | sed -E 's/.*"owner"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/'
}

run_reclaim() { # <clone> <owner> [now]  -> stdout, rc 반환
  local clone="$1"; shift
  local owner="$1"; shift
  local now="${1:-$NOW}"
  ( cd "$WORK/$clone" \
    && RECLAIM_REMOTE="$WORK/origin.git" RECLAIM_REF="$REF" \
       bash "$SCRIPT" "$owner" "$now" )
}

# ──────────────────────────────────────────────────────────────────────────
echo "[T1] happy-path — stale orphan(prNumber null) 1개 정상 회수(제거) (B1)"
seed_claims A "[{\"taskId\":\"T-1001\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
OUT="$(run_reclaim A loopA@h-1)"; RC=$?
if [ $RC -eq 0 ] && printf '%s' "$OUT" | grep -qF "RECLAIM taskId=T-1001"; then
  pass "stale orphan 회수 exit 0 + RECLAIM 신호 (out=$(printf '%s' "$OUT" | tr '\n' ';'))"
else
  fail "happy-path 실패 (rc=$RC out=$OUT)"
fi
if [ "$(count_entry T-1001)" = "0" ]; then
  pass "T-1001 entry claims.json 에서 제거됨(회수 완료)"
else
  fail "T-1001 회수 안 됨 (entry=$(count_entry T-1001))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T2] PR-resume 분기 — stale orphan(prNumber non-null)은 제거 대신 resume 신호 + owner 교체 (B2, 중복 PR 차단)"
seed_claims A "[{\"taskId\":\"T-2002\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"PR_OPEN\",\"prNumber\":273}]"
OUT2="$(run_reclaim A loopA@h-1)"; RC2=$?
if [ $RC2 -eq 0 ] && printf '%s' "$OUT2" | grep -qE "RESUME prNumber=273 taskId=T-2002"; then
  pass "RESUME 신호 출력 + exit 0 (out=$(printf '%s' "$OUT2" | tr '\n' ';'))"
else
  fail "PR-resume 신호 미출력 (rc=$RC2 out=$OUT2)"
fi
if [ "$(count_entry T-2002)" = "1" ]; then
  pass "T-2002 entry 보존됨(단순 회수 아님 — 중복 PR 차단)"
else
  fail "T-2002 entry 가 제거됨 — PR-resume 인데 단순 회수 발생 (entry=$(count_entry T-2002))"
fi
if [ "$(owner_of T-2002)" = "loopA@h-1" ]; then
  pass "T-2002 owner 가 회수 driver(loopA@h-1)로 교체됨, prNumber 보존"
else
  fail "owner 교체 안 됨 (owner=$(owner_of T-2002))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T3] negative — 살아있는 claim(임계 미만, now-30분)은 회수 안 됨 (B3, 불변)"
seed_claims A "[{\"taskId\":\"T-3003\",\"owner\":\"live@h-9\",\"claimedAt\":\"$LIVE_AT\",\"status\":\"IN_PROGRESS\",\"prNumber\":null}]"
TIP_BEFORE="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
OUT3="$(run_reclaim A loopA@h-1)"; RC3=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_AFTER="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC3 -eq 0 ] && [ "$(count_entry T-3003)" = "1" ] && [ "$TIP_AFTER" = "$TIP_BEFORE" ]; then
  pass "live claim 보존 + ref tip 불변 + exit 0 (오회수 0)"
else
  fail "live claim 이 회수됨 (rc=$RC3 entry=$(count_entry T-3003) tip변경=$([ "$TIP_AFTER" != "$TIP_BEFORE" ] && echo yes || echo no))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T4] negative — server-time now 미주입 시 회수 보류 (B4, §Decision 5)"
seed_claims A "[{\"taskId\":\"T-4004\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
TIP_B4="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
# now 인자/env 둘 다 비움.
OUT4="$( cd "$WORK/A" && RECLAIM_REMOTE="$WORK/origin.git" RECLAIM_REF="$REF" \
         bash "$SCRIPT" loopA@h-1 )"; RC4=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_A4="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC4 -eq 0 ] && [ "$(count_entry T-4004)" = "1" ] && [ "$TIP_A4" = "$TIP_B4" ]; then
  pass "now 미주입 → 회수 보류(stale 인데도 불변) + exit 0 (clock-skew 오회수 0)"
else
  fail "now 미주입인데 회수 발생 (rc=$RC4 entry=$(count_entry T-4004) tip변경=$([ "$TIP_A4" != "$TIP_B4" ] && echo yes || echo no))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T5] negative — stale lease(틀린 old-sha)로 회수 push → CAS 거부 (B5, verify-ref-cas T3 mirror)"
seed_claims A "[{\"taskId\":\"T-5005\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
CUR="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
# 회수 결과를 모사한 빈 배열 commit 을 일부러 틀린(빈) lease 로 push.
EMPTY_BLOB="$(printf '[]' | git -C A hash-object -w --stdin)"
EMPTY_TREE="$(printf '100644 blob %s\tclaims.json\n' "$EMPTY_BLOB" | git -C A mktree)"
EMPTY_COMMIT="$(git -C A -c user.name=claim-spec -c user.email=claim-spec@localhost \
  commit-tree "$EMPTY_TREE" -p "$CUR" -m evil-reclaim)"
if git -C A push "$WORK/origin.git" "$EMPTY_COMMIT:$REF" \
     --force-with-lease="$REF:" >/dev/null 2>&1; then
  fail "stale lease(expect-absent) 회수가 통과됨 — CAS 위반"
else
  pass "stale lease 회수 거부됨 — 동시 회수 race 에서 1개만 승리 보장"
fi
if [ "$(count_entry T-5005)" = "1" ]; then
  pass "거부 후 T-5005 가 잘못 회수되지 않음(stale lease push 무효)"
else
  fail "stale lease push 가 반영됨 (entry=$(count_entry T-5005))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T6] CAS race — 두 clone 이 같은 stale claim 동시 회수 시 1개만 성공(이중 회수 0) (B6)"
seed_claims A "[{\"taskId\":\"T-6006\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
# B 가 회수 직전의 stale view sha 를 확보(승자 A 머지 전).
git -C B fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
STALE_OLD="$(git -C B ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
# (1) 승자 A — 정상 primitive 로 T-6006 회수.
OA="$(run_reclaim A loopA@h-1)"; RA=$?
if [ $RA -eq 0 ] && [ "$(count_entry T-6006)" = "0" ]; then
  pass "승자 A 가 T-6006 회수 — entry 제거, exit 0"
else
  fail "승자 회수 이상 (RA=$RA entry=$(count_entry T-6006))"
fi
# (2) 패자 B — A 머지 전 stale view 를 lease 로 직접 회수 push 시도(이중 회수 모사).
LOSE_BLOB="$(printf '[]' | git -C B hash-object -w --stdin)"
LOSE_TREE="$(printf '100644 blob %s\tclaims.json\n' "$LOSE_BLOB" | git -C B mktree)"
LOSE_COMMIT="$(git -C B -c user.name=claim-spec -c user.email=claim-spec@localhost \
  commit-tree "$LOSE_TREE" ${STALE_OLD:+-p "$STALE_OLD"} -m lose-reclaim)"
if git -C B push "$WORK/origin.git" "$LOSE_COMMIT:$REF" \
     --force-with-lease="$REF:$STALE_OLD" >/dev/null 2>&1; then
  fail "패자 B 의 stale-lease 회수가 통과됨 — 이중 회수 발생(CAS 위반)"
else
  pass "패자 B 의 stale-lease 회수 CAS 거부됨 — 이중 회수 0"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T7] negative — 회수 대상 부재(빈 claims.json 배열) → no-op exit 0 (B7)"
seed_claims A "[]"
TIP_B7="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
OUT7="$(run_reclaim A loopA@h-1)"; RC7=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_A7="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC7 -eq 0 ] && [ "$TIP_A7" = "$TIP_B7" ]; then
  pass "회수 대상 부재 시 변경 없이 exit 0 (ref tip 불변)"
else
  fail "회수 대상 부재인데 상태 변동 (rc=$RC7 tip변경=$([ "$TIP_A7" != "$TIP_B7" ] && echo yes || echo no))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "reclaim-stale-claim 검증 통과 (T1 회수 / T2 PR-resume / T3 live보존 / T4 보류 / T5 stale거부 / T6 이중회수0 / T7 no-op)"
  exit 0
else
  echo "reclaim-stale-claim 검증 실패"
  exit 1
fi
