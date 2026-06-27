#!/usr/bin/env bash
# scripts/sync-claim-pr.test.sh
#
# scripts/sync-claim-pr.sh 의 executable spec (CLAUDE.md §3.2 R-110/R-112).
# T-0730 dup-PR forensic(double-claim 0→1)의 근본 fix — PR open 직후 claim 의
# prNumber/status 동기 primitive 가 reclaim 의 `prNumber != null → RESUME` 분기를
# 정상 작동하게 하는지 박제한다.
#
# 선례 mirror: scripts/select-claim.test.sh / scripts/reclaim-stale-claim.test.sh
# (bare-repo + 2 clone self-contained, `--force-with-lease` CAS). 네트워크/
# credential 불요 — 로컬 bare repo + clone. CI ubuntu(ambient git identity 0)
# 통과를 위해 모든 commit-tree 는 identity 를 self-provide 한다.
#
# 분기-검증 매핑 (sync-claim-pr.sh 의 분기마다 case 1+ — Branch cover):
#   B1 자기 claim(prNumber null, CLAIMED) → prNumber=N+PR_OPEN 갱신   : [T1] happy-path
#   B2 인자 누락(task/pr/owner 중 하나 빈 값) → non-zero exit         : [T2] negative
#   B3 대상 taskId 부재 → non-zero(no-op)                            : [T3] negative
#   B4 owner 불일치(타 driver claim) → 갱신 거부, 타 claim 무변경     : [T4] negative
#   B5 idempotent(이미 prNumber=N+PR_OPEN) → no-op success(push 0)    : [T5] flow/branch
#   B6 pr-number 비정수(type mismatch) → non-zero exit                : [T6] negative
#   B7 stale lease(틀린 old-sha)로 직접 push → CAS 거부               : [T7] negative(verify-ref-cas mirror)
#   B8 CAS lose(20) → main-loop `20)` 재시도 분기 → 재독 후 성공      : [T8] concurrent CAS-race(서버측 update hook 으로 첫 push 직전 ref 전진, 둘째 시도 성공)
#   B9 빈 claims.json/ref 부재 → non-zero(no-op)                     : [T9] negative
#   B10 sibling 파일(meta.txt)·타 claim entry byte-보존              : [T10] #588 wipe 회귀 가드
#   B11 status=IN_PROGRESS 인 자기 claim → PR_OPEN 갱신(분기)         : [T11] branch(status 진입 분기)
#   B12 CAS lose 매 라운드 반복 → 재시도 소진 → `exit 1` 소진 분기    : [T12] retry-exhaustion(매번 ref 를 전진시키는 competitor + 작은 SYNC_RETRIES)
#   * B8/B12 는 round-1 MAJOR(attempt() rc 캡처 버그로 `20)`/`exit 1`
#     분기가 dead code 였던 것)의 회귀 가드 — OLD 버그 코드에서는 FAIL,
#     fix 후 PASS 하도록 설계됐다.

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/sync-claim-pr.sh"
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

# 주어진 claims.json 배열 내용을 lock ref tip 으로 박제(초기 상태 세팅).
seed_claims() { # <clone> <claims-json>
  local clone="$1" arr="$2" old blob tree commit lease
  ( cd "$WORK/$clone"
    git fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
    old="$(git ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
    blob="$(printf '%s' "$arr" | git hash-object -w --stdin)"
    tree="$(printf '100644 blob %s\tclaims.json\n' "$blob" | git mktree)"
    if [ -n "$old" ]; then
      commit="$(git -c user.name=sync-spec -c user.email=sync-spec@localhost \
        commit-tree "$tree" -p "$old" -m seed)"
      lease="$REF:$old"
    else
      commit="$(git -c user.name=sync-spec -c user.email=sync-spec@localhost \
        commit-tree "$tree" -m seed)"
      lease="$REF:"
    fi
    git push "$WORK/origin.git" "$commit:$REF" --force-with-lease="$lease" >/dev/null 2>&1
  )
}

# claims.json + sibling 파일(meta.txt)을 함께 박제(byte-보존 검증용).
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
      commit="$(git -c user.name=sync-spec -c user.email=sync-spec@localhost \
        commit-tree "$tree" -p "$old" -m seed)"
      lease="$REF:$old"
    else
      commit="$(git -c user.name=sync-spec -c user.email=sync-spec@localhost \
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

# lock ref tip 의 claims.json 에서 특정 taskId entry 의 한 필드 값.
field_of() { # <taskId> <key>
  local tip
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  git -C "$WORK/A" cat-file -p "$tip:claims.json" 2>/dev/null \
    | sed -E 's/\}\s*,\s*\{/}\n{/g' \
    | grep -F "\"taskId\":\"$1\"" \
    | grep -oE "\"$2\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|null|[0-9]+)" \
    | head -n1 | sed -E "s/\"$2\"[[:space:]]*:[[:space:]]*//; s/^\"//; s/\"$//"
}

run_sync() { # <clone> <task> <pr> <owner>  -> stdout, rc 반환
  local clone="$1" task="$2" pr="$3" owner="$4"
  ( cd "$WORK/$clone" \
    && SYNC_REMOTE="$WORK/origin.git" SYNC_REF="$REF" \
       bash "$SCRIPT" "$task" "$pr" "$owner" )
}

# ──────────────────────────────────────────────────────────────────────────
echo "[T1] happy-path — 자기 claim(prNumber null, CLAIMED)을 prNumber=646+PR_OPEN 으로 갱신 (B1)"
seed_claims A "[{\"taskId\":\"T-1001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
OUT="$(run_sync A T-1001 646 loopA@h-1)"; RC=$?
if [ $RC -eq 0 ] && printf '%s' "$OUT" | grep -qF "SYNC taskId=T-1001 prNumber=646"; then
  pass "sync 성공 exit 0 + SYNC 신호 (out=$OUT)"
else
  fail "happy-path 실패 (rc=$RC out=$OUT)"
fi
if [ "$(field_of T-1001 prNumber)" = "646" ] && [ "$(field_of T-1001 status)" = "PR_OPEN" ]; then
  pass "ref tip 의 claims.json 이 prNumber=646 + status=PR_OPEN 으로 정확히 반영"
else
  fail "갱신 미반영 (prNumber=$(field_of T-1001 prNumber) status=$(field_of T-1001 status))"
fi
if [ "$(field_of T-1001 owner)" = "loopA@h-1" ] && [ "$(count_entry T-1001)" = "1" ]; then
  pass "owner/entry 수 보존 (owner=$(field_of T-1001 owner) entry=$(count_entry T-1001))"
else
  fail "owner/entry 보존 실패 (owner=$(field_of T-1001 owner) entry=$(count_entry T-1001))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T2] negative — 인자 누락(pr/owner 빈 값) → non-zero exit + 사유 (B2)"
seed_claims A "[{\"taskId\":\"T-2001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
ERR2a="$(run_sync A T-2001 "" loopA@h-1 2>&1 >/dev/null)"; RC2a=$?
ERR2b="$(run_sync A T-2001 700 "" 2>&1 >/dev/null)"; RC2b=$?
ERR2c="$( ( cd "$WORK/A" && SYNC_REMOTE="$WORK/origin.git" SYNC_REF="$REF" bash "$SCRIPT" "" 700 loopA@h-1 ) 2>&1 >/dev/null )"; RC2c=$?
if [ $RC2a -ne 0 ] && [ $RC2b -ne 0 ] && [ $RC2c -ne 0 ]; then
  pass "인자 누락 3종(pr/owner/task) 모두 non-zero exit"
else
  fail "인자 누락 일부가 통과 (rc pr=$RC2a owner=$RC2b task=$RC2c)"
fi
if printf '%s' "$ERR2a$ERR2b$ERR2c" | grep -qF "모두 필요"; then
  pass "stderr 에 인자 누락 사유 출력"
else
  fail "stderr 사유 미출력 (err=$ERR2a|$ERR2b|$ERR2c)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T3] negative — 대상 taskId 부재 → non-zero(no-op), 다른 entry 불변 (B3)"
seed_claims A "[{\"taskId\":\"T-3001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
TIP_B3="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
OUT3="$(run_sync A T-9999 800 loopA@h-1)"; RC3=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_B3_AFTER="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC3 -ne 0 ]; then
  pass "대상 taskId 부재 시 non-zero exit (rc=$RC3)"
else
  fail "대상 부재인데 exit 0 (out=$OUT3)"
fi
if [ "$TIP_B3" = "$TIP_B3_AFTER" ] && [ "$(field_of T-3001 prNumber)" = "null" ]; then
  pass "대상 부재 시 ref tip 불변 + 무관 claim(T-3001) prNumber null 보존"
else
  fail "대상 부재인데 상태 변동 (tip 변경=$([ "$TIP_B3" != "$TIP_B3_AFTER" ] && echo yes || echo no))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T4] negative — owner 불일치(타 driver claim) → 갱신 거부, 타 claim 무변경 (B4)"
seed_claims A "[{\"taskId\":\"T-4001\",\"owner\":\"otherDriver@h-9\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
TIP_B4="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
OUT4="$(run_sync A T-4001 900 loopA@h-1)"; RC4=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_B4_AFTER="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC4 -ne 0 ]; then
  pass "owner 불일치 시 갱신 거부 non-zero exit (rc=$RC4)"
else
  fail "owner 불일치인데 exit 0 (out=$OUT4)"
fi
if [ "$TIP_B4" = "$TIP_B4_AFTER" ] && [ "$(field_of T-4001 prNumber)" = "null" ] && [ "$(field_of T-4001 owner)" = "otherDriver@h-9" ]; then
  pass "타 driver claim 무변경(prNumber null, owner otherDriver@h-9 보존, tip 불변)"
else
  fail "타 driver claim 변동 (prNumber=$(field_of T-4001 prNumber) owner=$(field_of T-4001 owner))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T5] flow/branch — idempotent 재호출(이미 prNumber=646+PR_OPEN) → no-op success, push 0 (B5)"
seed_claims A "[{\"taskId\":\"T-5001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"PR_OPEN\",\"prNumber\":646}]"
TIP_B5="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
OUT5="$(run_sync A T-5001 646 loopA@h-1)"; RC5=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_B5_AFTER="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC5 -eq 0 ]; then
  pass "idempotent 재호출 exit 0 (rc=$RC5)"
else
  fail "idempotent 인데 non-zero (rc=$RC5 out=$OUT5)"
fi
if [ "$TIP_B5" = "$TIP_B5_AFTER" ]; then
  pass "idempotent 시 새 commit push 0 — ref tip 불변(불필요한 CAS 회피)"
else
  fail "idempotent 인데 ref tip 변경됨(push 발생)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T6] negative — pr-number 비정수(type mismatch) → non-zero exit (B6)"
seed_claims A "[{\"taskId\":\"T-6001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
ERR6="$(run_sync A T-6001 "abc" loopA@h-1 2>&1 >/dev/null)"; RC6=$?
if [ $RC6 -ne 0 ] && printf '%s' "$ERR6" | grep -qF "양의 정수"; then
  pass "비정수 pr-number 거부 non-zero + 사유 (rc=$RC6)"
else
  fail "비정수 pr-number 가 통과 (rc=$RC6 err=$ERR6)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T7] negative — stale lease(틀린 old-sha)로 직접 push → CAS 거부 (B7, verify-ref-cas mirror)"
seed_claims A "[{\"taskId\":\"T-7001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
CUR="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
STALE_BLOB="$(printf '[{"taskId":"T-7001","owner":"evil","claimedAt":"t","status":"PR_OPEN","prNumber":999}]' \
  | git -C A hash-object -w --stdin)"
STALE_TREE="$(printf '100644 blob %s\tclaims.json\n' "$STALE_BLOB" | git -C A mktree)"
STALE_COMMIT="$(git -C A -c user.name='sync-spec' -c user.email='sync-spec@localhost' \
  commit-tree "$STALE_TREE" -p "$CUR" -m evil)"
# 일부러 틀린(빈) lease 로 push — 현재 ref 는 CUR 이므로 expect-absent 는 stale.
if git -C A push "$WORK/origin.git" "$STALE_COMMIT:$REF" \
     --force-with-lease="$REF:" >/dev/null 2>&1; then
  fail "stale lease(expect-absent)가 통과됨 — CAS 위반"
else
  pass "stale lease 거부됨 — sync 의 CAS 가 동시 race 에서 1개만 승리 보장"
fi
if [ "$(field_of T-7001 prNumber)" != "999" ]; then
  pass "거부된 stale push 미반영 (prNumber=$(field_of T-7001 prNumber))"
else
  fail "stale push 가 반영됨 (prNumber=999)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T8] concurrent CAS-race — 첫 push 가 lease mismatch 로 CAS lose(20) →"
echo "     main-loop \`20)\` 재시도 분기 → 새 tip 재독 후 둘째 시도 성공 (B8)"
# round-1 MAJOR 회귀 가드: attempt() 의 rc 캡처 버그가 살아있으면 첫 CAS lose(20)
# 가 0 으로 덮여 그대로 exit 0 하지만 ref tip 은 갱신되지 않는다 — 즉 "성공
# 보고했는데 prNumber 미반영" 으로 본 test 가 FAIL 한다. 동시성을 결정론적으로
# 박제하기 위해 origin.git 에 **서버측 update hook** 을 심어, 그 ref 로의 **첫**
# push 만 한 번 거부(ref 전진 시뮬레이션 — competing pusher 가 끼어든 효과)하고
# 자기 자신을 무장 해제한다. 그러면 sync 의 첫 CAS 는 반드시 lose(20) → `20)`
# 재시도 → 둘째 push 는 hook 통과로 성공해야 한다.
seed_claims A "[{\"taskId\":\"T-8001\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
mkdir -p "$WORK/origin.git/hooks"
HOOK8="$WORK/origin.git/hooks/update"
ARM8="$WORK/origin.git/hooks/.t8-armed"
: > "$ARM8"   # 무장 — hook 이 존재하는 동안 첫 push 1회만 거부.
cat > "$HOOK8" <<EOF
#!/usr/bin/env bash
# T8: lock ref 로의 첫 push 만 1회 거부(CAS lose 시뮬레이션), 이후 통과.
ref="\$1"
if [ "\$ref" = "$REF" ] && [ -e "$ARM8" ]; then
  rm -f "$ARM8"
  echo "T8 update hook: 첫 push 거부(race 시뮬레이션)" >&2
  exit 1
fi
exit 0
EOF
chmod +x "$HOOK8"
OUT8="$(run_sync A T-8001 810 loopA@h-1)"; RC8=$?
rm -f "$HOOK8" "$ARM8"   # hook 정리(이후 test 영향 0).
if [ $RC8 -eq 0 ] && printf '%s' "$OUT8" | grep -qF "SYNC taskId=T-8001 prNumber=810"; then
  pass "첫 CAS lose 후 재시도 분기에서 최종 성공 exit 0 + SYNC 신호 (out=$OUT8)"
else
  fail "CAS-race 재시도 실패 — \`20)\` 분기 dead code 의심 (rc=$RC8 out=$OUT8)"
fi
if [ "$(field_of T-8001 prNumber)" = "810" ] && [ "$(field_of T-8001 status)" = "PR_OPEN" ]; then
  pass "재시도 후 ref tip 에 prNumber=810 + PR_OPEN 정확 반영(가짜 성공 아님)"
else
  fail "성공 보고했으나 ref 미반영 — rc 캡처 버그 회귀 (prNumber=$(field_of T-8001 prNumber) status=$(field_of T-8001 status))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T9] negative — 빈 claims.json / ref 부재 → non-zero(no-op) (B9)"
# 새 bare repo(C clone)로 ref 부재 상태 테스트.
git clone -q origin.git C 2>/dev/null
OUT9="$( ( cd "$WORK/C" && SYNC_REMOTE="$WORK/origin.git" SYNC_REF="refs/heads/claude/lock-absent" bash "$SCRIPT" T-1001 646 loopA@h-1 ) 2>&1 )"; RC9=$?
if [ $RC9 -ne 0 ]; then
  pass "ref 부재 시 non-zero(no-op) (rc=$RC9)"
else
  fail "ref 부재인데 exit 0 (out=$OUT9)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T10] #588 wipe 회귀 가드 — sibling(meta.txt) + 타 claim entry byte-보존 (B10)"
SIB_BODY='locked-by=cron@h-0;since=2026-06-28T00:00:00Z'
seed_with_sibling A \
  "[{\"taskId\":\"T-10A\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null},{\"taskId\":\"T-10B\",\"owner\":\"loopB@h-2\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"IN_PROGRESS\",\"prNumber\":555}]" \
  "$SIB_BODY"
SIB_BEFORE="$(tip_path_raw meta.txt)"
OUT10="$(run_sync A T-10A 1010 loopA@h-1)"; RC10=$?
SIB_AFTER="$(tip_path_raw meta.txt)"
if [ $RC10 -eq 0 ] && [ "$SIB_BEFORE" = "$SIB_AFTER" ] && [ "$SIB_AFTER" = "$SIB_BODY" ]; then
  pass "sibling meta.txt byte-보존 (헬퍼가 claims.json 만 교체)"
else
  fail "sibling 변동/소실 (before=$SIB_BEFORE after=$SIB_AFTER)"
fi
if [ "$(field_of T-10B prNumber)" = "555" ] && [ "$(field_of T-10B owner)" = "loopB@h-2" ] && [ "$(field_of T-10B status)" = "IN_PROGRESS" ]; then
  pass "타 driver claim(T-10B) byte-보존 (prNumber 555 / owner / status 불변)"
else
  fail "타 claim 변동 (prNumber=$(field_of T-10B prNumber) owner=$(field_of T-10B owner) status=$(field_of T-10B status))"
fi
if [ "$(field_of T-10A prNumber)" = "1010" ] && [ "$(field_of T-10A status)" = "PR_OPEN" ]; then
  pass "자기 claim(T-10A)은 정상 갱신(prNumber 1010 + PR_OPEN)"
else
  fail "자기 claim 갱신 실패 (prNumber=$(field_of T-10A prNumber) status=$(field_of T-10A status))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T11] branch — status=IN_PROGRESS 인 자기 claim → PR_OPEN 갱신(진입 분기) (B11)"
seed_claims A "[{\"taskId\":\"T-11A\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"IN_PROGRESS\",\"prNumber\":null}]"
OUT11="$(run_sync A T-11A 1111 loopA@h-1)"; RC11=$?
if [ $RC11 -eq 0 ] && [ "$(field_of T-11A status)" = "PR_OPEN" ] && [ "$(field_of T-11A prNumber)" = "1111" ]; then
  pass "IN_PROGRESS → PR_OPEN 갱신 + prNumber 1111 (rc=$RC11)"
else
  fail "IN_PROGRESS 진입 분기 실패 (rc=$RC11 status=$(field_of T-11A status) prNumber=$(field_of T-11A prNumber))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T12] retry-exhaustion — competitor 가 매 라운드 push 를 거부 → 재시도 소진"
echo "      → main-loop \`exit 1\` 소진 분기로 non-zero + 사유 (B12)"
# round-1 MAJOR 회귀 가드: rc 캡처 버그가 살아있으면 매 CAS lose(20) 가 0 으로
# 덮여 첫 attempt 에서 곧장 exit 0(가짜 성공) → 소진 분기에 도달하지 못한다.
# competitor 를 매번 이기게 만들기 위해 origin.git 의 update hook 이 lock ref 로의
# **모든** push 를 거부(항상 ref 가 전진해 lease mismatch 인 상황과 동형)하게
# 하고, SYNC_RETRIES 를 작게(1) 줘 소진을 빠르게 유도한다. 기대: 매 라운드 CAS
# lose(20) → 재시도 → 결국 소진 → "재시도 ... 소진" 사유와 함께 non-zero exit,
# ref tip 은 끝까지 불변(가짜 성공/부분 반영 0).
seed_claims A "[{\"taskId\":\"T-12A\",\"owner\":\"loopA@h-1\",\"claimedAt\":\"2026-06-28T00:00:00Z\",\"status\":\"CLAIMED\",\"prNumber\":null}]"
TIP_B12="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
HOOK12="$WORK/origin.git/hooks/update"
cat > "$HOOK12" <<EOF
#!/usr/bin/env bash
# T12: lock ref 로의 모든 push 를 항상 거부(competitor 영구 승리 시뮬레이션).
[ "\$1" = "$REF" ] && { echo "T12 update hook: push 영구 거부" >&2; exit 1; }
exit 0
EOF
chmod +x "$HOOK12"
ERR12="$( ( cd "$WORK/A" && SYNC_REMOTE="$WORK/origin.git" SYNC_REF="$REF" SYNC_RETRIES=1 \
  bash "$SCRIPT" T-12A 1212 loopA@h-1 ) 2>&1 >/dev/null )"; RC12=$?
rm -f "$HOOK12"   # hook 정리.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_B12_AFTER="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC12 -ne 0 ] && printf '%s' "$ERR12" | grep -qF "소진"; then
  pass "재시도 소진 시 non-zero exit + 소진 사유 — \`exit 1\` 분기 도달 (rc=$RC12)"
else
  fail "소진 분기 미도달 — rc 캡처 버그로 가짜 성공 의심 (rc=$RC12 err=$ERR12)"
fi
if [ "$TIP_B12" = "$TIP_B12_AFTER" ] && [ "$(field_of T-12A prNumber)" = "null" ]; then
  pass "소진까지 ref tip 불변 + claim prNumber null 보존(부분 반영 0)"
else
  fail "소진인데 상태 변동 (tip변경=$([ "$TIP_B12" != "$TIP_B12_AFTER" ] && echo yes || echo no) prNumber=$(field_of T-12A prNumber))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "sync-claim-pr 검증 통과 (T1 happy / T2 인자누락 / T3 대상부재 / T4 owner불일치 / T5 idempotent / T6 비정수 / T7 stale거부 / T8 CAS-race재시도 / T9 ref부재 / T10 byte보존 / T11 status분기 / T12 재시도소진)"
  exit 0
else
  echo "sync-claim-pr 검증 실패"
  exit 1
fi
