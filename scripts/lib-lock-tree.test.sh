#!/usr/bin/env bash
# scripts/lib-lock-tree.test.sh
#
# scripts/lib-lock-tree.sh(tree-보존 CAS mutation 공통 헬퍼)의 executable spec
# (CLAUDE.md §3.2 R-110/R-112). 본 slice(T-0674) 핵심: lock_tree_cas_push 가
# tip tree 의 sibling 엔트리(claims.json 등)를 byte-보존하며 지정 blob 만 교체하는
# 것 — double-claim(#588) wipe 버그의 구조적 회귀 가드를 헬퍼 단에서 박제한다.
# 라우팅 대상이 acquire/select 2 script 뿐이어도 헬퍼 분기 검증은 script 비의존이라
# 여기서 완결한다(slice 1b 는 이미 검증된 함수 호출만 추가).
#
# 선례 mirror: scripts/select-claim.test.sh / acquire-lock.test.sh
# (bare-repo + clone self-contained, `--force-with-lease` CAS, NOW 주입).
# 네트워크/credential 불요 — 로컬 bare repo + clone. **live lock ref 미접촉**
# (origin 은 throwaway bare repo). CI ubuntu 통과.
#
# 분기-검증 매핑 (lib-lock-tree.sh 의 분기마다 case 1+ — line·branch·function ≥80%):
#   B1 old_sha 부재 → 첫 생성(ls-tree/-p 생략, expect-absent lease)  : [T1] error-path
#   B2 old_sha 존재 + 1 blob 교체(acquire 경로) → sibling 보존          : [T2] happy-path/회귀가드
#   B3 old_sha 존재 + 2 blob 교체(claim 경로) → sibling 보존            : [T3] branch(2 blob)
#   B4 CAS lease mismatch(틀린 old_sha) → push reject(return 20)       : [T4] negative
#   B5 빈/누락 commit 가드(commit-tree 실패) → push 차단(return 30,    : [T5] negative
#      ref 미삭제)                                                       (브랜치 삭제 방지)
#   B6 같은 work-tree 에서 연속 2회 호출 → 임시파일 충돌 0(고유 캡처)   : [T6] 동시성(temp-collision)
#      (T-0674 이연 — command-substitution 직접 캡처라 고정 /tmp 경로 race 0)

set -uo pipefail

LIB="$(cd "$(dirname "$0")" && pwd)/lib-lock-tree.sh"
FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

REF="refs/heads/claude/lock-driver"
REMOTE="$WORK/origin.git"

git init -q --bare origin.git
git clone -q origin.git A 2>/dev/null

# 헬퍼를 본 shell 에 source — 함수 lock_tree_cas_push 를 직접 호출해 검증.
# shellcheck source=scripts/lib-lock-tree.sh
. "$LIB"

pass() { echo "  ok: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

cur_tip() { git -C A ls-remote "$REMOTE" "$REF" | cut -f1; }

# A clone 안에서 헬퍼를 호출(remote=throwaway bare repo). 인자 그대로 전달.
run_push() { # <old_sha> <preserve_except> <pair...|msg>  -> stdout=tip sha, rc 반환
  ( cd "$WORK/A" && lock_tree_cas_push "$REMOTE" "$REF" "$@" )
}

# blob 본문을 hash-object 로 박아 sha 반환(A clone 의 object DB).
mkblob() { printf '%s' "$1" | git -C A hash-object -w --stdin; }

# tip tree 의 특정 path raw 본문(byte 비교용). 부재 시 <none>.
tip_path_raw() { # <path>
  local tip; tip="$(cur_tip)"
  [ -z "$tip" ] && { echo "<none>"; return; }
  git -C A fetch -q "$REMOTE" "$REF" 2>/dev/null || true
  git -C A cat-file -p "$tip:$1" 2>/dev/null || echo "<none>"
}

# ──────────────────────────────────────────────────────────────────────────
echo "[T1] error-path — old_sha 부재(빈 문자열) → expect-absent lease 로 첫 생성 (B1)"
# parent 없는 commit, ls-tree base 생략. lock.json 1 blob 만 있는 tree 생성.
LOCK0="$(mkblob '{"holder":"cron","session":"cron@h-1","since":"t0"}')"
OUT1="$(run_push '' '\s(lock\.json)$' "lock.json=${LOCK0}" "first create")"; RC1=$?
git -C A fetch -q "$REMOTE" "$REF" 2>/dev/null || true
if [ $RC1 -eq 0 ] && [ -n "$OUT1" ] && [ "$(tip_path_raw lock.json)" = '{"holder":"cron","session":"cron@h-1","since":"t0"}' ]; then
  pass "old_sha 부재에서 첫 생성 exit 0, tip=$OUT1, lock.json 박제"
else
  fail "첫 생성 실패 (rc=$RC1 out=$OUT1 lock=$(tip_path_raw lock.json))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T2] **회귀 가드(핵심)** — 1 blob 교체(acquire 경로): claims.json+sibling byte 보존 (B2)"
# 현 tip(T1) 위에 claims.json + 무관 파일(meta.txt)을 seed 한 뒤, lock.json 만 교체.
CUR="$(cur_tip)"
CLAIMS_BODY='[{"taskId":"T-7777","owner":"loopX@h-9","claimedAt":"t","status":"IN_PROGRESS","prNumber":42}]'
META_BODY='sentinel-사이드파일-보존검증'
CLAIMS_BLOB="$(mkblob "$CLAIMS_BODY")"
META_BLOB="$(mkblob "$META_BODY")"
LOCK_LINE="$(git -C A ls-tree "$CUR" | grep -E '\slock\.json$')"
SEED_TREE="$( { echo "$LOCK_LINE"; \
  printf '100644 blob %s\tclaims.json\n' "$CLAIMS_BLOB"; \
  printf '100644 blob %s\tmeta.txt\n' "$META_BLOB"; } | git -C A mktree )"
SEED_COMMIT="$(git -C A -c user.name=seed -c user.email=seed@localhost commit-tree "$SEED_TREE" -p "$CUR" -m seed)"
git -C A push -q "$REMOTE" "$SEED_COMMIT:$REF" --force-with-lease="$REF:$CUR" 2>/dev/null
SEED_TIP="$(cur_tip)"
B_CLAIMS="$(tip_path_raw claims.json)"; B_META="$(tip_path_raw meta.txt)"
# 이제 lock.json 만 교체(preserve-except = lock.json) — claims.json/meta.txt 보존돼야.
NEWLOCK="$(mkblob '{"holder":"loop","session":"loop@h-2","since":"t2"}')"
OUT2="$(run_push "$SEED_TIP" '\s(lock\.json)$' "lock.json=${NEWLOCK}" "acquire")"; RC2=$?
A_CLAIMS="$(tip_path_raw claims.json)"; A_META="$(tip_path_raw meta.txt)"
if [ $RC2 -eq 0 ] && [ "$(tip_path_raw lock.json)" = '{"holder":"loop","session":"loop@h-2","since":"t2"}' ]; then
  pass "1 blob 교체 성공 — lock.json 갱신 (out=$OUT2)"
else
  fail "1 blob 교체 실패 (rc=$RC2 lock=$(tip_path_raw lock.json))"
fi
if [ "$A_CLAIMS" = "$B_CLAIMS" ] && [ "$A_CLAIMS" = "$CLAIMS_BODY" ] \
   && [ "$A_META" = "$B_META" ] && [ "$A_META" = "$META_BODY" ]; then
  pass "claims.json + meta.txt byte-동일 보존 — #588 wipe 버그 회귀 가드 통과"
else
  fail "sibling wipe/변형 (claims $B_CLAIMS→$A_CLAIMS / meta $B_META→$A_META)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T3] branch — 2 blob 교체(claim 경로): claims.json+lock.json 동시 교체 + sibling 보존 (B3)"
# preserve-except = claims.json|lock.json 둘 다 교체, meta.txt 는 보존.
CUR3="$(cur_tip)"
NEW_CLAIMS='[{"taskId":"T-7777","owner":"loopX@h-9","claimedAt":"t","status":"IN_PROGRESS","prNumber":42},{"taskId":"T-8888","owner":"loop@h-2","claimedAt":"t2","status":"CLAIMED","prNumber":null}]'
NC_BLOB="$(mkblob "$NEW_CLAIMS")"
TOMB_BLOB="$(mkblob '{"holder":"","since":""}')"
OUT3="$(run_push "$CUR3" '\s(claims\.json|lock\.json)$' \
  "claims.json=${NC_BLOB}" "lock.json=${TOMB_BLOB}" "claim T-8888")"; RC3=$?
if [ $RC3 -eq 0 ] \
   && [ "$(tip_path_raw claims.json)" = "$NEW_CLAIMS" ] \
   && [ "$(tip_path_raw lock.json)" = '{"holder":"","since":""}' ] \
   && [ "$(tip_path_raw meta.txt)" = "$META_BODY" ]; then
  pass "2 blob 동시 교체 성공 — claims.json+lock.json 갱신 + meta.txt 보존 (out=$OUT3)"
else
  fail "2 blob 교체 이상 (rc=$RC3 claims=$(tip_path_raw claims.json) lock=$(tip_path_raw lock.json) meta=$(tip_path_raw meta.txt))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T4] negative — CAS lease mismatch(틀린 old_sha) → push reject return 20 (B4)"
# 현재 tip 과 다른(stale) old_sha 를 lease 로 넘기면 --force-with-lease 가 거부.
TIP_BEFORE4="$(cur_tip)"
STALE_LOCK="$(mkblob '{"holder":"evil","session":"e","since":"t"}')"
# stale old_sha = T2 시점의 SEED_TIP(현재 tip 아님). 헬퍼가 그 lease 로 push → reject.
run_push "$SEED_TIP" '\s(lock\.json)$' "lock.json=${STALE_LOCK}" "stale" >/dev/null 2>&1; RC4=$?
TIP_AFTER4="$(cur_tip)"
if [ $RC4 -eq 20 ] && [ "$TIP_AFTER4" = "$TIP_BEFORE4" ]; then
  pass "stale lease → return 20 + ref tip 불변(CAS 가 동시 race 1개만 승리 보장)"
else
  fail "CAS lease mismatch 처리 이상 (rc=$RC4 기대 20, tip $TIP_BEFORE4→$TIP_AFTER4)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T5] negative — 빈/누락 commit 가드 → push 차단 return 30 + ref 미삭제 (B5)"
# commit-tree 실패를 결정론적으로 유발(잘못된 GIT_DIR) → 빈 $commit → 가드(30).
# 핵심: 빈 commit push 가 lock 브랜치를 삭제하면 안 된다(MEMORY lock-cas-bash-hazard).
TIP_BEFORE5="$(cur_tip)"
CUR5="$(cur_tip)"
DUMMY="$(mkblob '{"holder":"x","since":"t"}')"
OUT5="$( cd "$WORK/A" \
  && GIT_DIR=/nonexistent/path/.git \
     lock_tree_cas_push "$REMOTE" "$REF" "$CUR5" '\s(lock\.json)$' "lock.json=${DUMMY}" "broken" 2>&1 )"; RC5=$?
TIP_AFTER5="$(cur_tip)"
if [ $RC5 -eq 30 ] && [ "$TIP_AFTER5" = "$TIP_BEFORE5" ] && [ -n "$TIP_AFTER5" ]; then
  pass "commit-tree 실패 시 빈 COMMIT push 차단 — return 30 + ref tip 불변(브랜치 미삭제)"
else
  fail "빈 commit 가드 미발동 (rc=$RC5 기대 30, tip $TIP_BEFORE5→$TIP_AFTER5)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T6] 동시성 — 같은 work-tree 연속 2회 호출 시 임시파일 충돌 0(고유 캡처) (B6, T-0674 이연)"
# 헬퍼는 `git mktree` 출력을 고정 /tmp 경로가 아니라 command substitution 으로
# 직접 캡처한다(헬퍼 상단 주석 박제 — 옛 acquire/select 의 /tmp/.al_tree·.sc_tree
# 고정 경로가 동시 driver race-prone 이었던 것을 제거). 같은 work-tree 에서 2회
# 연속 호출이 서로의 중간 산출물을 덮어쓰지 않고 각자 올바른 tip 을 내는지 가드.
# (1) 고정 임시 경로 잔재가 헬퍼 **코드**에 없음을 정적 확인 — race 표면 0 의 직접
#     증거. 주석(`#` 줄)에는 옛 /tmp/.al_tree·mktemp hazard 설명이 박제돼 있으므로
#     comment 행을 제거한 코드 본문만 검사한다(주석 매칭 false-positive 차단).
LIB_CODE="$(sed -E 's/[[:space:]]*#.*$//' "$LIB")"
if printf '%s\n' "$LIB_CODE" | grep -qE '/tmp/\.[a-z]+_tree|[^a-z]mktemp'; then
  fail "헬퍼 코드에 고정 임시 경로/mktemp 잔재 — 동시 호출 race 표면 존재"
else
  pass "헬퍼 코드에 고정 임시 경로 없음(command-substitution 직접 캡처) — race 표면 0"
fi
# (2) 같은 work-tree 에서 2회 연속 호출이 서로 간섭 없이 순차 성공 + 두 번째
#     호출이 첫 번째 결과를 base 로 누적(claims.json 2 entry)되는지.
CUR6="$(cur_tip)"
C6A='[{"taskId":"T-A","owner":"o1","claimedAt":"t","status":"CLAIMED","prNumber":null}]'
C6A_BLOB="$(mkblob "$C6A")"; TOMB6="$(mkblob '{"holder":"","since":""}')"
T6_OUT1="$(run_push "$CUR6" '\s(claims\.json|lock\.json)$' \
  "claims.json=${C6A_BLOB}" "lock.json=${TOMB6}" "concurrent-1")"; T6_RC1=$?
MID6="$(cur_tip)"
C6B='[{"taskId":"T-A","owner":"o1","claimedAt":"t","status":"CLAIMED","prNumber":null},{"taskId":"T-B","owner":"o2","claimedAt":"t2","status":"CLAIMED","prNumber":null}]'
C6B_BLOB="$(mkblob "$C6B")"
T6_OUT2="$(run_push "$MID6" '\s(claims\.json|lock\.json)$' \
  "claims.json=${C6B_BLOB}" "lock.json=${TOMB6}" "concurrent-2")"; T6_RC2=$?
if [ $T6_RC1 -eq 0 ] && [ $T6_RC2 -eq 0 ] \
   && [ -n "$T6_OUT1" ] && [ -n "$T6_OUT2" ] && [ "$T6_OUT1" != "$T6_OUT2" ] \
   && [ "$(tip_path_raw claims.json)" = "$C6B" ] \
   && [ "$(tip_path_raw meta.txt)" = "$META_BODY" ]; then
  pass "연속 2회 호출 각자 고유 tip 성공 + 임시파일 간섭 0 + sibling 보존"
else
  fail "연속 호출 간 충돌/누적 이상 (rc1=$T6_RC1 rc2=$T6_RC2 tip1=$T6_OUT1 tip2=$T6_OUT2 claims=$(tip_path_raw claims.json))"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "lib-lock-tree 검증 통과 (T1 첫생성 / T2 1blob회귀가드 / T3 2blob분기 / T4 CAS거부20 / T5 빈commit가드30 / T6 temp충돌0)"
  exit 0
else
  echo "lib-lock-tree 검증 실패"
  exit 1
fi
