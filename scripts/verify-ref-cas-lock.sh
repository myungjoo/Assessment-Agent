#!/usr/bin/env bash
# ADR-0009 ref-CAS lock 동작 검증 스크립트.
#
# 목적: driver lock 의 상호배제가 의존하는 핵심 primitive —
#   `git push <sha>:refs/locks/driver --force-with-lease=refs/locks/driver:<old>`
# 의 compare-and-swap(CAS) 의미가 실제 git 에서 우리가 가정한 대로 동작함을
# executable spec 으로 박제한다. 로컬 bare repo + 2 clone 으로 self-contained
# 하게 실행하므로 remote 권한/네트워크 불요 (CI ubuntu 에서 그대로 통과).
#
# 검증 3종:
#   T1) 빈 ref 에 두 driver 가 동시 획득 시도 → 정확히 1개만 성공(lease=expect-absent).
#   T2) lock holder 가 올바른 lease(현재 sha)로 ref 갱신 → 성공(정상 해제/교체).
#   T3) stale lease(틀린 old-sha)로 갱신 시도 → 거부(동시 탈취 race 에서 1개만 승리).
set -u

FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

git init -q --bare origin.git
git clone -q origin.git A 2>/dev/null
git clone -q origin.git B 2>/dev/null

# lock blob 생성 후 sha 반환
mk_blob() { printf '{"holder":"%s","since":"t"}' "$1" | git -C "$2" hash-object -w --stdin; }

# CAS push 시도. 성공=0, 실패=non-zero (exit code 를 pipe 없이 직접 캡처)
cas_push() { # <clone> <sha> <lease-old-or-empty>
  git -C "$1" push origin "$2:refs/locks/driver" \
    --force-with-lease="refs/locks/driver:$3" >/dev/null 2>&1
}

pass() { echo "  ok: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

echo "[T1] 빈 ref 동시 획득 — 정확히 1개만 성공"
SA="$(mk_blob loopA A)"
SB="$(mk_blob loopB B)"
cas_push A "$SA" ""; RA=$?    # lease=expect-absent
cas_push B "$SB" ""; RB=$?    # lease=expect-absent
if { [ $RA -eq 0 ] && [ $RB -ne 0 ]; } || { [ $RA -ne 0 ] && [ $RB -eq 0 ]; }; then
  pass "한쪽만 획득 (RA=$RA RB=$RB)"
else
  fail "동시 획득이 직렬화되지 않음 (RA=$RA RB=$RB)"
fi

# 현재 ref 가 가리키는 sha (승자)
CUR="$(git ls-remote origin.git refs/locks/driver | cut -f1)"
[ -n "$CUR" ] && pass "ref 존재(holder 승자 sha=$CUR)" || fail "획득 후 ref 부재"

echo "[T2] 올바른 lease 로 ref 갱신(해제/교체) — 성공"
WIN="A"; [ "$CUR" = "$SB" ] && WIN="B"
git -C "$WIN" fetch -q origin
TOMB="$(printf '{"holder":"","since":""}' | git -C "$WIN" hash-object -w --stdin)"
cas_push "$WIN" "$TOMB" "$CUR"; RT=$?
[ $RT -eq 0 ] && pass "현재 holder 가 올바른 lease 로 갱신 성공" || fail "올바른 lease 갱신 실패 (RT=$RT)"

echo "[T3] stale lease(틀린 old-sha)로 갱신 — 거부"
CUR2="$(git ls-remote origin.git refs/locks/driver | cut -f1)"
STALE="$(printf '{"holder":"loopStale","since":"t"}' | git -C A hash-object -w --stdin)"
cas_push A "$STALE" "$SA"; RS=$?   # lease=SA 는 이미 낡음(현재는 CUR2)
[ $RS -ne 0 ] && pass "stale lease 거부됨 (RS=$RS)" || fail "stale lease 가 통과됨(CAS 위반)"

echo ""
if [ $FAIL -eq 0 ]; then
  echo "ref-CAS lock 검증 통과 (T1/T2/T3)"
  exit 0
else
  echo "ref-CAS lock 검증 실패"
  exit 1
fi
