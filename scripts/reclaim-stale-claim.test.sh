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
#   ── 라우팅 회귀 가드(T-0675, lib-lock-tree 헬퍼 위임) ──
#   B8 회수 시 sibling 파일(meta.txt)·살아있는 entry byte-보존  : [T8] #588 wipe 회귀 가드
#   ── DONE-skip 가드(T-0676, spurious RESUME 차단) ──
#   B9  stale DONE+prNumber → prune(RESUME 미발생)             : [T9] happy + regression(13:00 사고)
#   B10 stale DONE+prNumber null → prune 유지(불변)            : [T10] negative
#   B11 live DONE+prNumber → 보존(stale 아님)                  : [T11] negative
#   B12 status 누락(레거시) stale+prNumber → 기존 resume 분기   : [T12] negative(보수)
#   B13 DONE/PR_OPEN/CLAIMED/IN_PROGRESS 4종 혼재 분기 분리      : [T13] branch(status 분기 분리)

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

# claims.json + sibling 파일(meta.txt)을 함께 lock ref tip 으로 박제.
# 라우팅 회귀 가드용 — 헬퍼가 claims.json/lock.json 만 교체하고 sibling 을
# byte-보존하는지 검증하기 위해 무관 파일을 tip tree 에 함께 심는다.
seed_with_sibling() { # <clone> <claims-json> <sibling-body>
  local clone="$1" arr="$2" sib="$3" old cblob sblob tree commit lease
  ( cd "$WORK/$clone"
    git fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
    old="$(git ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
    cblob="$(printf '%s' "$arr" | git hash-object -w --stdin)"
    sblob="$(printf '%s' "$sib" | git hash-object -w --stdin)"
    tree="$( { printf '100644 blob %s\tclaims.json\n' "$cblob"; \
               printf '100644 blob %s\tmeta.txt\n' "$sblob"; } | git mktree )"
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

# lock ref tip 의 특정 path raw 본문(byte 비교용). 부재 시 <none>.
tip_path_raw() { # <path>
  local tip
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  [ -z "$tip" ] && { echo "<none>"; return; }
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  git -C "$WORK/A" cat-file -p "$tip:$1" 2>/dev/null || echo "<none>"
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
echo "[T8] 라우팅 회귀 가드 — 회수 시 sibling 파일(meta.txt)·살아있는 entry byte-보존 (B8, #588 wipe 가드)"
# stale orphan(T-8001) + live(T-8002, prNumber null) 혼재 + 무관 sibling meta.txt.
# 헬퍼 라우팅이 claims.json/lock.json 만 교체하고 meta.txt 를 byte-보존하며,
# stale 만 제거하고 live entry 는 보존하는지 — #588 류 wipe 가 reclaim 경로에서
# 재발하지 않음을 가드(라우팅 전 inline mktree 가 했던 preserve 를 헬퍼가 동일 보장).
META8='sentinel-사이드파일-reclaim-보존검증'
seed_with_sibling A \
  "[{\"taskId\":\"T-8001\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null},{\"taskId\":\"T-8002\",\"owner\":\"live@h-9\",\"claimedAt\":\"$LIVE_AT\",\"status\":\"IN_PROGRESS\",\"prNumber\":null}]" \
  "$META8"
B_META8="$(tip_path_raw meta.txt)"
OUT8="$(run_reclaim A loopA@h-1)"; RC8=$?
A_META8="$(tip_path_raw meta.txt)"
if [ $RC8 -eq 0 ] && printf '%s' "$OUT8" | grep -qF "RECLAIM taskId=T-8001"; then
  pass "stale T-8001 회수 + exit 0 (out=$(printf '%s' "$OUT8" | tr '\n' ';'))"
else
  fail "T8 회수 신호 이상 (rc=$RC8 out=$OUT8)"
fi
if [ "$(count_entry T-8001)" = "0" ] && [ "$(count_entry T-8002)" = "1" ]; then
  pass "stale(T-8001) 제거 + live(T-8002) entry 보존(선택적 회수)"
else
  fail "회수 범위 이상 (T-8001=$(count_entry T-8001) T-8002=$(count_entry T-8002))"
fi
if [ "$A_META8" = "$B_META8" ] && [ "$A_META8" = "$META8" ]; then
  pass "sibling meta.txt byte-동일 보존 — 헬퍼 라우팅이 #588 wipe 회귀 차단"
else
  fail "sibling wipe/변형 — 라우팅이 sibling 보존 깨뜨림 (meta $B_META8→$A_META8)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T9] DONE-skip happy/regression — stale DONE+prNumber=589 → prune, RESUME 미발생 (B9, T-0674 13:00 사고 회귀 가드)"
seed_claims A "[{\"taskId\":\"T-0673\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"DONE\",\"prNumber\":589}]"
OUT9="$(run_reclaim A loopA@h-1)"; RC9=$?
# (a) RESUME 문자열이 stdout 에 절대 나오지 않음(현 버그면 RESUME 출력 → fail).
if [ $RC9 -eq 0 ] && ! printf '%s' "$OUT9" | grep -qF "RESUME"; then
  pass "stale DONE+prNumber 인데 RESUME 미발생 + exit 0 (spurious RESUME 차단)"
else
  fail "DONE claim 에 RESUME 이 emit 됨 (rc=$RC9 out=$OUT9)"
fi
# (b) entry 가 claims.json 에서 제거됨(prune).
if [ "$(count_entry T-0673)" = "0" ]; then
  pass "T-0673(DONE) entry prune 됨 — merged PR 에 대한 resume 후보 아님"
else
  fail "DONE claim 이 prune 안 됨 (entry=$(count_entry T-0673))"
fi
# (c) RECLAIM/prune 신호 1줄 박제.
if printf '%s' "$OUT9" | grep -qF "RECLAIM taskId=T-0673"; then
  pass "RECLAIM(prune) 신호 출력"
else
  fail "prune 신호 미출력 (out=$OUT9)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T10] negative — stale DONE+prNumber null → 기존 prune 유지(status 가드 추가 후에도 불변) (B10)"
seed_claims A "[{\"taskId\":\"T-1010\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"DONE\",\"prNumber\":null}]"
OUT10="$(run_reclaim A loopA@h-1)"; RC10=$?
if [ $RC10 -eq 0 ] && [ "$(count_entry T-1010)" = "0" ] && printf '%s' "$OUT10" | grep -qF "RECLAIM taskId=T-1010"; then
  pass "DONE+prNumber null prune 유지 + exit 0 (이미 prune 대상 경로 불변)"
else
  fail "DONE+prNumber null 회수 이상 (rc=$RC10 entry=$(count_entry T-1010) out=$OUT10)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T11] negative — live(임계 이내) DONE+prNumber → 보존(stale 아니므로 손대지 않음) (B11)"
seed_claims A "[{\"taskId\":\"T-1111\",\"owner\":\"live@h-9\",\"claimedAt\":\"$LIVE_AT\",\"status\":\"DONE\",\"prNumber\":601}]"
TIP_B11="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
OUT11="$(run_reclaim A loopA@h-1)"; RC11=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_A11="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC11 -eq 0 ] && [ "$(count_entry T-1111)" = "1" ] && [ "$TIP_A11" = "$TIP_B11" ]; then
  pass "live DONE 보존 + ref tip 불변 + exit 0 (stale 아니면 DONE 도 손대지 않음)"
else
  fail "live DONE 이 회수됨 (rc=$RC11 entry=$(count_entry T-1111) tip변경=$([ "$TIP_A11" != "$TIP_B11" ] && echo yes || echo no))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T12] negative — status 필드 누락(레거시) stale+prNumber → DONE 아님으로 간주, 기존 resume 분기 (B12, 보수)"
seed_claims A "[{\"taskId\":\"T-1212\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"prNumber\":701}]"
OUT12="$(run_reclaim A loopA@h-1)"; RC12=$?
if [ $RC12 -eq 0 ] && printf '%s' "$OUT12" | grep -qE "RESUME prNumber=701 taskId=T-1212"; then
  pass "status 누락 claim 은 DONE 미적용 → 기존 RESUME 분기 그대로(보수적 불변)"
else
  fail "status 누락 claim 의 resume 분기 변형 (rc=$RC12 out=$OUT12)"
fi
if [ "$(count_entry T-1212)" = "1" ]; then
  pass "status 누락 claim entry 보존(resume 분기 — 단순 회수 아님)"
else
  fail "status 누락 claim 이 제거됨 (entry=$(count_entry T-1212))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T13] branch — DONE/PR_OPEN/CLAIMED/IN_PROGRESS 4종 한 배열 혼재 시 status 분기 분리 (B13)"
# (a) stale DONE+prNumber → prune, (b) stale PR_OPEN+prNumber → RESUME+보존+owner교체,
# (c) stale CLAIMED+prNumber null → prune, (d) live IN_PROGRESS → 보존.
seed_claims A "[\
{\"taskId\":\"T-1301\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"DONE\",\"prNumber\":589},\
{\"taskId\":\"T-1302\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"PR_OPEN\",\"prNumber\":273},\
{\"taskId\":\"T-1303\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null},\
{\"taskId\":\"T-1304\",\"owner\":\"live@h-9\",\"claimedAt\":\"$LIVE_AT\",\"status\":\"IN_PROGRESS\",\"prNumber\":null}]"
OUT13="$(run_reclaim A loopA@h-1)"; RC13=$?
# (a) DONE prune + RESUME 미발생(이 taskId 에 한해).
if [ "$(count_entry T-1301)" = "0" ] && ! printf '%s' "$OUT13" | grep -qE "RESUME prNumber=589"; then
  pass "(a) stale DONE(T-1301) prune + RESUME prNumber=589 미발생"
else
  fail "(a) DONE 분기 이상 (entry=$(count_entry T-1301) out=$OUT13)"
fi
# (b) PR_OPEN → RESUME + entry 보존 + owner 교체.
if printf '%s' "$OUT13" | grep -qE "RESUME prNumber=273 taskId=T-1302" \
   && [ "$(count_entry T-1302)" = "1" ] && [ "$(owner_of T-1302)" = "loopA@h-1" ]; then
  pass "(b) stale PR_OPEN(T-1302) RESUME + entry 보존 + owner 교체"
else
  fail "(b) PR_OPEN 분기 이상 (entry=$(count_entry T-1302) owner=$(owner_of T-1302) out=$OUT13)"
fi
# (c) CLAIMED+null → prune.
if [ "$(count_entry T-1303)" = "0" ] && printf '%s' "$OUT13" | grep -qF "RECLAIM taskId=T-1303"; then
  pass "(c) stale CLAIMED+null(T-1303) prune"
else
  fail "(c) CLAIMED 분기 이상 (entry=$(count_entry T-1303) out=$OUT13)"
fi
# (d) live IN_PROGRESS → 보존.
if [ $RC13 -eq 0 ] && [ "$(count_entry T-1304)" = "1" ]; then
  pass "(d) live IN_PROGRESS(T-1304) 보존 + exit 0"
else
  fail "(d) live 분기 이상 (rc=$RC13 entry=$(count_entry T-1304))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T14] CAS-race 재시도 분기 회귀 가드 — 첫 회수 push 가 CAS lose(20) →"
echo "      main-loop \`20)\` 재시도 분기 → 새 tip 재독 후 둘째 시도 성공 (B6 재시도)"
echo "      (pre-fix 에서 FAIL: rc 캡처 버그면 첫 lose 가 0 으로 덮여 가짜 exit 0 +"
echo "       회수 미반영 / post-fix 에서 PASS: 재시도 후 실제 회수 + exit 0)"
# sync-claim-pr.test.sh [T8] mirror. attempt() 의 rc 캡처 버그(if helper; then;fi
# 뒤 rc=$? → 항상 0)가 살아있으면 첫 CAS lose(20)가 0 으로 덮여 그대로 exit 0
# 하지만 ref tip 은 갱신되지 않는다 — "회수 보고했는데 entry 미제거" 로 FAIL.
# origin.git 에 **서버측 update hook** 을 심어 lock ref 로의 **첫** push 만 한 번
# 거부(competing pusher ref 전진 효과)하고 자기 무장 해제. 첫 CAS 는 반드시
# lose(20) → \`20)\` 재시도 → 둘째 push 는 hook 통과로 성공해야 한다.
seed_claims A "[{\"taskId\":\"T-1401\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
mkdir -p "$WORK/origin.git/hooks"
HOOK14="$WORK/origin.git/hooks/update"
ARM14="$WORK/origin.git/hooks/.t14-armed"
: > "$ARM14"   # 무장 — 첫 push 1회만 거부.
cat > "$HOOK14" <<EOF
#!/usr/bin/env bash
# T14: lock ref 로의 첫 push 만 1회 거부(CAS lose 시뮬레이션), 이후 통과.
ref="\$1"
if [ "\$ref" = "$REF" ] && [ -e "$ARM14" ]; then
  rm -f "$ARM14"
  echo "T14 update hook: 첫 push 거부(race 시뮬레이션)" >&2
  exit 1
fi
exit 0
EOF
chmod +x "$HOOK14"
OUT14="$(run_reclaim A loopA@h-1)"; RC14=$?
rm -f "$HOOK14" "$ARM14"   # hook 정리.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
if [ $RC14 -eq 0 ] && printf '%s' "$OUT14" | grep -qF "RECLAIM taskId=T-1401"; then
  pass "첫 CAS lose 후 재시도 분기에서 최종 회수 성공 exit 0 + RECLAIM 신호 (out=$(printf '%s' "$OUT14" | tr '\n' ';'))"
else
  fail "CAS-race 재시도 실패 — \`20)\` 분기 dead code 의심(rc 캡처 버그 회귀) (rc=$RC14 out=$OUT14)"
fi
if [ "$(count_entry T-1401)" = "0" ]; then
  pass "재시도 후 ref tip 에서 T-1401 정확 제거(가짜 성공 아님)"
else
  fail "회수 보고했으나 entry 미제거 — rc 캡처 버그 회귀 (entry=$(count_entry T-1401))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T15] 재시도소진 분기 회귀 가드 — hook 이 매 push 영구 거부 + RECLAIM_RETRIES=1"
echo "      → 매 라운드 CAS lose(20) → 재시도소진 → main-loop \`exit 1\` 분기 (B6 소진)"
echo "      (pre-fix 에서 FAIL: 가짜 성공 exit 0 으로 소진 분기 미도달 /"
echo "       post-fix 에서 PASS: 소진 시 non-zero + \"소진\" 사유 + ref tip 불변)"
# sync-claim-pr.test.sh [T12] mirror. rc 캡처 버그면 매 CAS lose(20)가 0 으로 덮여
# 첫 attempt 에서 곧장 exit 0(가짜 성공) → 소진 분기 미도달. update hook 이 lock
# ref 로의 **모든** push 를 거부(항상 lease mismatch 동형)하게 하고 RECLAIM_RETRIES
# 를 1 로 작게 줘 소진을 빠르게 유도. 기대: 매 라운드 CAS lose(20) → 재시도 → 소진
# → "재시도 ... 소진" 사유와 함께 non-zero exit, ref tip 은 끝까지 불변.
seed_claims A "[{\"taskId\":\"T-1501\",\"owner\":\"dead@h-0\",\"claimedAt\":\"$STALE_AT\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_B15="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
HOOK15="$WORK/origin.git/hooks/update"
cat > "$HOOK15" <<EOF
#!/usr/bin/env bash
# T15: lock ref 로의 모든 push 를 항상 거부(competitor 영구 승리 시뮬레이션).
[ "\$1" = "$REF" ] && { echo "T15 update hook: push 영구 거부" >&2; exit 1; }
exit 0
EOF
chmod +x "$HOOK15"
ERR15="$( ( cd "$WORK/A" && RECLAIM_REMOTE="$WORK/origin.git" RECLAIM_REF="$REF" \
  RECLAIM_RETRIES=1 bash "$SCRIPT" loopA@h-1 "$NOW" ) 2>&1 >/dev/null )"; RC15=$?
rm -f "$HOOK15"   # hook 정리.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_A15="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC15 -ne 0 ] && printf '%s' "$ERR15" | grep -qF "소진"; then
  pass "재시도 소진 시 non-zero exit + 소진 사유 — \`exit 1\` 분기 도달 (rc=$RC15)"
else
  fail "소진 분기 미도달 — rc 캡처 버그로 가짜 성공 의심 (rc=$RC15 err=$ERR15)"
fi
if [ "$TIP_B15" = "$TIP_A15" ] && [ "$(count_entry T-1501)" = "1" ]; then
  pass "소진까지 ref tip 불변 + T-1501 claim 보존(부분 회수 0)"
else
  fail "소진인데 상태 변동 (tip변경=$([ "$TIP_B15" != "$TIP_A15" ] && echo yes || echo no) entry=$(count_entry T-1501))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "reclaim-stale-claim 검증 통과 (T1 회수 / T2 PR-resume / T3 live보존 / T4 보류 / T5 stale거부 / T6 이중회수0 / T7 no-op / T8 sibling보존 / T9 DONE-prune / T10 DONE+null prune / T11 live DONE 보존 / T12 status누락보수 / T13 status분기분리 / T14 CAS-race재시도 / T15 재시도소진)"
  exit 0
else
  echo "reclaim-stale-claim 검증 실패"
  exit 1
fi
