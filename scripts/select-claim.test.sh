#!/usr/bin/env bash
# scripts/select-claim.test.sh
#
# scripts/select-claim.sh 의 executable spec (CLAUDE.md §3.2 R-110/R-112).
# ADR-0036 §rollout 2 정확성 게이트 "이중 claim 0" 를 박제한다.
#
# 선례 mirror: scripts/verify-ref-cas-lock.sh(bare-repo + 2 clone self-contained,
# `--force-with-lease` CAS) + scripts/check-doc-only-pr.test.sh(script + .test.sh
# 동형 spec). 네트워크/credential 불요 — 로컬 bare repo + 2 clone. CI ubuntu 통과.
#
# 분기-검증 매핑 (select-claim.sh 의 분기마다 case 1+ — Branch cover):
#   B1 claimable 존재 → claim push 성공          : [T1] happy-path
#   B2 두 driver 가 같은 task 동시 select+claim   : [T2] 이중 claim 0(정확성 게이트)
#   B3 claimable 부재(후보 전부 claimed) → exit≠0 : [T3] negative(빈 claim)
#   B4 stale lease(틀린 old-sha) → CAS 거부       : [T4] negative(verify-ref-cas T3 mirror)
#   B5 CAS race lose → claims 재독 후 재시도       : [T2] 패자가 재시도 시 그 task 가
#                                                   claimed-set 에 들어가 제외됨으로 cover

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/select-claim.sh"
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

# clone 안에서 select-claim.sh 실행(remote=origin.git, 해당 clone cwd).
run_claim() { # <clone> <owner> <task...>  -> stdout=claimed task, rc 반환
  local clone="$1"; shift
  local owner="$1"; shift
  ( cd "$WORK/$clone" \
    && CLAIM_REMOTE="$WORK/origin.git" CLAIM_REF="$REF" CLAIM_NOW="2026-06-10T00:00:00Z" \
       bash "$SCRIPT" "$owner" "$@" )
}

# lock ref tip 의 claims.json 에서 특정 taskId 의 entry 개수.
count_entry() { # <taskId>
  local tip
  tip="$(git -C "$WORK/A" ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
  [ -z "$tip" ] && { echo 0; return; }
  git -C "$WORK/A" fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
  git -C "$WORK/A" cat-file -p "$tip:claims.json" 2>/dev/null \
    | grep -oE "\"taskId\"[[:space:]]*:[[:space:]]*\"$1\"" | wc -l | tr -d ' '
}

# ──────────────────────────────────────────────────────────────────────────
echo "[T1] happy-path — 단일 driver 가 claimable task 1개 정상 claim (B1)"
OUT="$(run_claim A loopA@h-1 T-1001 T-1002)"; RC=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
if [ $RC -eq 0 ] && [ "$OUT" = "T-1001" ]; then
  pass "claim 성공 exit 0, 첫 claimable(T-1001) 선택 (out=$OUT)"
else
  fail "happy-path 실패 (rc=$RC out=$OUT)"
fi
if [ "$(count_entry T-1001)" = "1" ]; then
  pass "claims.json 에 T-1001 entry 정확히 1개 박제"
else
  fail "T-1001 entry 개수 != 1 (got $(count_entry T-1001))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T2] 이중 claim 0 (정확성 게이트, ADR-0036 §rollout 2) — 두 driver 가"
echo "     **같은 task 1개(T-3001)만** select+claim 경쟁 (B2/B5)"
# 동시성을 결정론적으로 박제한다(verify-ref-cas-lock.sh 와 동형 — wall-clock race
# 대신 CAS lease 의미로 직렬화를 증명). 시나리오:
#  (1) A 가 T-3001 을 정상 claim(승자) — old-sha=현재 ref(이미 T-1001/T-2001/T-2002
#      claimed 상태) 위에 박제. exit 0, T-3001 entry +1.
#  (2) B 는 (1) 직전의 stale view 를 가진 패자다. B 가 그 stale old-sha 를 lease 로
#      직접 push 하면 CAS 거부(이중 박제 차단) → B 의 재시도(select-claim.sh 의
#      재독 분기 B5)에서 T-3001 이 이미 claimed → claimable 부재로 non-zero.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
git -C B fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true        # B 가 stale view 객체를 로컬에 확보
STALE_OLD="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"   # B 의 stale view sha
# (1) 승자 A — 정상 primitive 로 T-3001 claim.
OA="$(run_claim A loopA@h-1 T-3001)"; RA=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
if [ $RA -eq 0 ] && [ "$OA" = "T-3001" ] && [ "$(count_entry T-3001)" = "1" ]; then
  pass "승자 A 가 T-3001 claim — entry +1, exit 0 (out=$OA)"
else
  fail "승자 claim 이상 (RA=$RA OA=$OA entry=$(count_entry T-3001))"
fi
# (2) 패자 B — A 머지 전 stale view(STALE_OLD)를 lease 로 직접 T-3001 재박제 시도.
LOSE_BLOB="$(printf '[{"taskId":"T-3001","owner":"loopB@h-2","claimedAt":"2026-06-10T00:00:00Z","status":"CLAIMED","prNumber":null}]' \
  | git -C B hash-object -w --stdin)"
LOSE_TREE="$(printf '100644 blob %s\tclaims.json\n' "$LOSE_BLOB" | git -C B mktree)"
LOSE_COMMIT="$(git -C B -c user.name='claim-spec' -c user.email='claim-spec@localhost' \
  commit-tree "$LOSE_TREE" ${STALE_OLD:+-p "$STALE_OLD"} -m lose)"
if git -C B push "$WORK/origin.git" "$LOSE_COMMIT:$REF" \
     --force-with-lease="$REF:$STALE_OLD" >/dev/null 2>&1; then
  fail "패자 B 의 stale-lease claim 이 통과됨 — 이중 claim 발생(CAS 위반)"
else
  pass "패자 B 의 stale-lease claim CAS 거부됨 — 같은 task 이중 박제 차단"
fi
# (3) 패자 B 의 재시도 — primitive 로 다시 T-3001 만 시도하면 claimed-set 제외로 거부.
OB="$(run_claim B loopB@h-2 T-3001)"; RB=$?
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
if [ $RB -ne 0 ]; then
  pass "패자 B 재시도 시 T-3001 claimed → claimable 부재 거부 (rc=$RB)"
else
  fail "패자 B 재시도가 이미-claimed task 를 또 claim (rc=$RB out=$OB)"
fi
# 정확성 게이트: 전 과정 후 T-3001 entry 는 정확히 1 (이중 claim 0).
if [ "$(count_entry T-3001)" = "1" ]; then
  pass "T-3001 entry 최종 정확히 1개 — 이중 claim 0 (정확성 게이트 통과)"
else
  fail "T-3001 이중 claim 발생 (entry=$(count_entry T-3001))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T3] negative — claimable 부재(후보 전부 이미 claimed) → non-zero exit + 빈 claim (B3)"
# 현 시점 claimed = {T-1001(T1), T-3001(T2)}. 후보를 그 둘로만 주면 claimable 부재.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_BEFORE="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
N_BEFORE="$(git -C A cat-file -p "$TIP_BEFORE:claims.json" 2>/dev/null \
  | grep -oE '"taskId"' | wc -l | tr -d ' ')"
OUT3="$(run_claim A loopA@h-1 T-1001 T-3001)"; RC3=$?
if [ $RC3 -ne 0 ]; then
  pass "claimable 부재 시 non-zero exit (rc=$RC3)"
else
  fail "claimable 부재인데 exit 0 (out=$OUT3)"
fi
# 새 entry 0 — claim push 가 일어나지 않았어야 함(전체 entry 수 + ref tip 불변).
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_AFTER="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
N_AFTER="$(git -C A cat-file -p "$TIP_AFTER:claims.json" 2>/dev/null \
  | grep -oE '"taskId"' | wc -l | tr -d ' ')"
if [ "$N_AFTER" = "$N_BEFORE" ] && [ "$TIP_AFTER" = "$TIP_BEFORE" ]; then
  pass "새 entry 0 — claims.json 총 $N_AFTER개 유지 + ref tip 불변, claim push 안 일어남"
else
  fail "claimable 부재인데 상태 변동 (entry $N_BEFORE→$N_AFTER, tip 변경=$([ "$TIP_AFTER" != "$TIP_BEFORE" ] && echo yes || echo no))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T4] negative — stale lease(틀린 old-sha)로 직접 push → CAS 거부 (B4, verify-ref-cas T3 mirror)"
# select-claim 의 CAS 가 의존하는 --force-with-lease 의 stale 거부 의미를 직접 박제.
CUR="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
STALE_BLOB="$(printf '[{"taskId":"T-9999","owner":"evil","claimedAt":"t","status":"CLAIMED","prNumber":null}]' \
  | git -C A hash-object -w --stdin)"
STALE_TREE="$(printf '100644 blob %s\tclaims.json\n' "$STALE_BLOB" | git -C A mktree)"
STALE_COMMIT="$(git -C A -c user.name='claim-spec' -c user.email='claim-spec@localhost' \
  commit-tree "$STALE_TREE" -p "$CUR" -m evil)"
# 일부러 틀린(빈) lease 로 push — 현재 ref 는 CUR 이므로 expect-absent 는 stale.
if git -C A push "$WORK/origin.git" "$STALE_COMMIT:$REF" \
     --force-with-lease="$REF:" >/dev/null 2>&1; then
  fail "stale lease(expect-absent)가 통과됨 — CAS 위반"
else
  pass "stale lease 거부됨 — CAS 가 동시 탈취 race 에서 1개만 승리 보장"
fi
# 거부 후 T-9999 가 들어가지 않았는지 확인.
if [ "$(count_entry T-9999)" = "0" ]; then
  pass "거부된 stale claim(T-9999) 미반영"
else
  fail "stale claim 이 반영됨 (T-9999 entry=$(count_entry T-9999))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T5] CAS-race 재시도 분기 회귀 가드 — 첫 push 가 CAS lose(20) → main-loop"
echo "     \`20)\` 재시도 분기 → 새 tip 재독 후 둘째 시도 성공 (B5)"
echo "     (pre-fix 에서 FAIL: rc 캡처 버그면 첫 lose 가 0 으로 덮여 가짜 exit 0 +"
echo "      claim 미박제 / post-fix 에서 PASS: 재시도 후 실제 claim 박제 + exit 0)"
# sync-claim-pr.test.sh [T8] mirror. attempt() 의 rc 캡처 버그(if helper; then;fi
# 뒤 rc=$? → 항상 0)가 살아있으면 첫 CAS lose(20)가 0 으로 덮여 그대로 exit 0
# 하지만 ref tip 은 갱신되지 않는다 — "성공 보고했는데 claim 미박제" 로 본 test 가
# FAIL 한다. 동시성을 결정론적으로 박제하기 위해 origin.git 에 **서버측 update
# hook** 을 심어, lock ref 로의 **첫** push 만 한 번 거부(competing pusher 가 끼어든
# ref 전진 효과)하고 자기 자신을 무장 해제한다. 그러면 첫 CAS 는 반드시 lose(20)
# → \`20)\` 재시도 → 둘째 push 는 hook 통과로 성공해야 한다.
mkdir -p "$WORK/origin.git/hooks"
HOOK5="$WORK/origin.git/hooks/update"
ARM5="$WORK/origin.git/hooks/.t5-armed"
: > "$ARM5"   # 무장 — hook 이 존재하는 동안 첫 push 1회만 거부.
cat > "$HOOK5" <<EOF
#!/usr/bin/env bash
# T5: lock ref 로의 첫 push 만 1회 거부(CAS lose 시뮬레이션), 이후 통과.
ref="\$1"
if [ "\$ref" = "$REF" ] && [ -e "$ARM5" ]; then
  rm -f "$ARM5"
  echo "T5 update hook: 첫 push 거부(race 시뮬레이션)" >&2
  exit 1
fi
exit 0
EOF
chmod +x "$HOOK5"
OUT5="$(run_claim A loopA@h-1 T-5001)"; RC5=$?
rm -f "$HOOK5" "$ARM5"   # hook 정리(이후 test 영향 0).
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
if [ $RC5 -eq 0 ] && [ "$OUT5" = "T-5001" ]; then
  pass "첫 CAS lose 후 재시도 분기에서 최종 성공 exit 0 + claim 신호 (out=$OUT5)"
else
  fail "CAS-race 재시도 실패 — \`20)\` 분기 dead code 의심(rc 캡처 버그 회귀) (rc=$RC5 out=$OUT5)"
fi
if [ "$(count_entry T-5001)" = "1" ]; then
  pass "재시도 후 ref tip 에 T-5001 정확 박제(가짜 성공 아님)"
else
  fail "성공 보고했으나 claim 미박제 — rc 캡처 버그 회귀 (entry=$(count_entry T-5001))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T6] 재시도소진 분기 회귀 가드 — hook 이 매 push 영구 거부 + CLAIM_RETRIES=1"
echo "     → 매 라운드 CAS lose(20) → 재시도소진 → main-loop \`exit 1\` 분기 (B5 소진)"
echo "     (pre-fix 에서 FAIL: 가짜 성공 exit 0 으로 소진 분기 미도달 /"
echo "      post-fix 에서 PASS: 소진 시 non-zero + \"소진\" 사유 + ref tip 불변)"
# sync-claim-pr.test.sh [T12] mirror. rc 캡처 버그면 매 CAS lose(20)가 0 으로
# 덮여 첫 attempt 에서 곧장 exit 0(가짜 성공) → 소진 분기에 도달하지 못한다.
# competitor 를 매번 이기게 만들기 위해 update hook 이 lock ref 로의 **모든** push
# 를 거부(항상 ref 가 전진해 lease mismatch 인 상황과 동형)하게 하고, CLAIM_RETRIES
# 를 작게(1) 줘 소진을 빠르게 유도한다. 기대: 매 라운드 CAS lose(20) → 재시도 →
# 소진 → "재시도 ... 소진" 사유와 함께 non-zero exit, ref tip 은 끝까지 불변.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_B6="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
HOOK6="$WORK/origin.git/hooks/update"
cat > "$HOOK6" <<EOF
#!/usr/bin/env bash
# T6: lock ref 로의 모든 push 를 항상 거부(competitor 영구 승리 시뮬레이션).
[ "\$1" = "$REF" ] && { echo "T6 update hook: push 영구 거부" >&2; exit 1; }
exit 0
EOF
chmod +x "$HOOK6"
ERR6="$( ( cd "$WORK/A" && CLAIM_REMOTE="$WORK/origin.git" CLAIM_REF="$REF" \
  CLAIM_NOW="2026-06-10T00:00:00Z" CLAIM_RETRIES=1 \
  bash "$SCRIPT" loopA@h-1 T-6001 ) 2>&1 >/dev/null )"; RC6=$?
rm -f "$HOOK6"   # hook 정리.
git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
TIP_A6="$(git -C A ls-remote "$WORK/origin.git" "$REF" | cut -f1)"
if [ $RC6 -ne 0 ] && printf '%s' "$ERR6" | grep -qF "소진"; then
  pass "재시도 소진 시 non-zero exit + 소진 사유 — \`exit 1\` 분기 도달 (rc=$RC6)"
else
  fail "소진 분기 미도달 — rc 캡처 버그로 가짜 성공 의심 (rc=$RC6 err=$ERR6)"
fi
if [ "$TIP_B6" = "$TIP_A6" ] && [ "$(count_entry T-6001)" = "0" ]; then
  pass "소진까지 ref tip 불변 + T-6001 미박제(부분 반영 0)"
else
  fail "소진인데 상태 변동 (tip변경=$([ "$TIP_B6" != "$TIP_A6" ] && echo yes || echo no) entry=$(count_entry T-6001))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "select-claim 검증 통과 (T1 happy / T2 이중claim0 / T3 claimable부재 / T4 stale거부 / T5 CAS-race재시도 / T6 재시도소진)"
  exit 0
else
  echo "select-claim 검증 실패"
  exit 1
fi
