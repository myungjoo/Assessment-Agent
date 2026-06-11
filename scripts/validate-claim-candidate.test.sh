#!/usr/bin/env bash
# scripts/validate-claim-candidate.test.sh
#
# scripts/validate-claim-candidate.sh 의 executable spec (CLAUDE.md §3.2 R-110/R-112).
# ADR-0036 §Decision 8 (a)(b) 의 런타임 재검증·fail-safe 강등 분기를 박제한다.
#
# 선례 mirror: scripts/select-claim.test.sh / reclaim-stale-claim.test.sh
# (bare-repo + clone self-contained, claims.json read). 네트워크/credential 불요
# — 로컬 bare repo + clone + 임시 task 파일. CI ubuntu(ambient git identity 0) 통과.
# 본 primitive 는 CAS push 가 없어 더 단순(read-only 판정만).
#
# 분기-검증 매핑 (validate-claim-candidate.sh 의 분기마다 case 1+ — Branch cover):
#   B1 disjoint touchesFiles + dependsOn 전원 머지 → PASS        : [T1] happy-path
#   B2 touchesFiles 활성 claim 과 교집합 1+         → DEMOTE files-overlap        : [T2] negative
#   B3 dependsOn 미머지 1+(status≠DONE & commit無)  → DEMOTE unmerged-dependency  : [T3] negative
#   B4 후보 frontmatter touchesFiles 누락           → DEMOTE uncertain (fail-safe): [T4] negative
#   B5 claims.json 손상 JSON                        → DEMOTE uncertain (fail-safe): [T5] negative
#   B6 활성 claim 0(claims.json 부재/빈 배열)+dep머지 → PASS(disjoint 자명)      : [T6] negative-경계
#   B7 후보 id 인자 누락                            → non-zero exit               : [T7] negative
#   B8 dependsOn 머지 2차 신호(status 부재 but origin/main commit 매칭) → PASS    : [T8] branch
#   B9 dependsOn task 파일 자체 부재               → DEMOTE unmerged-dependency  : [T9] negative

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/validate-claim-candidate.sh"
FAIL=0
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

REF="refs/heads/claude/lock-driver"

git init -q --bare origin.git
git clone -q origin.git A 2>/dev/null

pass() { echo "  ok: $1"; }
fail() { echo "  FAIL: $1"; FAIL=1; }

TASKS_DIR="$WORK/A/docs/tasks"
mkdir -p "$TASKS_DIR"

# task 파일 frontmatter 생성 헬퍼.
write_task() { # <id> <status> <touchesFiles-inline> <dependsOn-inline>
  cat > "$TASKS_DIR/$1.md" <<EOF
---
id: $1
status: $2
touchesFiles: $3
dependsOn: $4
---
# $1 본문
EOF
}

# touchesFiles/dependsOn 키를 의도적으로 빠뜨린 task(fail-safe 검증용).
write_task_no_touches() { # <id>
  cat > "$TASKS_DIR/$1.md" <<EOF
---
id: $1
status: PENDING
dependsOn: []
---
# $1 본문(touchesFiles 누락)
EOF
}

# lock ref tip 에 claims.json 배열을 박제(활성 claim 세팅). raw 문자열 그대로.
seed_claims() { # <claims-json-raw>
  local blob tree commit
  blob="$(printf '%s' "$1" | git -C A hash-object -w --stdin)"
  tree="$(printf '100644 blob %s\tclaims.json\n' "$blob" | git -C A mktree)"
  commit="$(git -C A -c user.name='vcc-spec' -c user.email='vcc-spec@localhost' \
    commit-tree "$tree" -m seed)"
  git -C A push -q "$WORK/origin.git" "$commit:$REF" --force 2>/dev/null
  git -C A fetch -q "$WORK/origin.git" "$REF" 2>/dev/null || true
}

# 후보를 검증 실행(clone A cwd, remote=origin.git).
run_vcc() { # <candidate-id>  -> stdout=판정, rc 반환
  ( cd "$WORK/A" \
    && VCC_REMOTE="$WORK/origin.git" VCC_REF="$REF" \
       VCC_MAIN_REF="HEAD" VCC_TASKS_DIR="docs/tasks" \
       bash "$SCRIPT" "$1" )
}

# origin/main commit 매칭(2차 dependsOn 신호) 박제용: A 의 HEAD 에 "(T-id)" commit.
commit_with_msg() { # <subject>
  ( cd "$WORK/A" \
    && git -c user.name='vcc-spec' -c user.email='vcc-spec@localhost' \
       commit -q --allow-empty -m "$1" )
}

# 초기 HEAD 커밋(merge-base / git log 가 동작하도록 비어있지 않게).
commit_with_msg "chore: init"

# ──────────────────────────────────────────────────────────────────────────
echo "[T1] happy-path — disjoint touchesFiles + dependsOn 전원 머지 → PASS (B1)"
write_task T-2001 DONE "[src/a.ts]" "[]"           # 활성 claim 보유 task
write_task T-1000 PENDING "[src/b.ts]" "[T-2001]"  # 후보: 파일 disjoint, dep DONE
seed_claims '[{"taskId":"T-2001","owner":"loopA@h-1","claimedAt":"2026-06-11T00:00:00Z","status":"CLAIMED","prNumber":null}]'
OUT="$(run_vcc T-1000)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "PASS T-1000" ]; then
  pass "PASS T-1000 exit 0 (out=$OUT)"
else
  fail "happy-path 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T2] negative — 후보 touchesFiles 가 활성 claim 과 교집합 1+ → DEMOTE files-overlap (B2)"
write_task T-1001 PENDING "[src/a.ts, src/c.ts]" "[]"  # src/a.ts 가 T-2001 과 겹침
OUT="$(run_vcc T-1001)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "DEMOTE T-1001 reason=files-overlap" ]; then
  pass "files-overlap 강등 (out=$OUT)"
else
  fail "files-overlap 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T3] negative — dependsOn 미머지 1+(status≠DONE & commit無) → DEMOTE unmerged-dependency (B3)"
write_task T-3001 PENDING "[src/x.ts]" "[]"            # dep: status PENDING, commit 매칭 無
write_task T-1002 PENDING "[src/y.ts]" "[T-3001]"      # 후보: 파일 disjoint, dep 미머지
OUT="$(run_vcc T-1002)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "DEMOTE T-1002 reason=unmerged-dependency" ]; then
  pass "unmerged-dependency 강등 (out=$OUT)"
else
  fail "unmerged-dependency 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T4] negative — 후보 frontmatter touchesFiles 키 누락 → fail-safe DEMOTE uncertain (B4/§D8 a)"
write_task_no_touches T-1003
OUT="$(run_vcc T-1003)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "DEMOTE T-1003 reason=uncertain" ]; then
  pass "touchesFiles 누락 → uncertain 강등 (out=$OUT)"
else
  fail "fail-safe(touchesFiles 누락) 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T5] negative — claims.json 손상 JSON → fail-safe DEMOTE uncertain (B5/§D8 a)"
seed_claims 'not-a-json-array{{{'
write_task T-1004 PENDING "[src/z.ts]" "[]"
OUT="$(run_vcc T-1004)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "DEMOTE T-1004 reason=uncertain" ]; then
  pass "claims.json 손상 → uncertain 강등 (out=$OUT)"
else
  fail "fail-safe(claims 손상) 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T6] negative-경계 — 활성 claim 0(빈 배열) + dep 전원 머지 → PASS disjoint 자명 (B6)"
seed_claims '[]'
write_task T-2002 DONE "[src/dep.ts]" "[]"
write_task T-1005 PENDING "[src/a.ts]" "[T-2002]"   # 활성 claim 0 이라 교집합 대상 없음
OUT="$(run_vcc T-1005)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "PASS T-1005" ]; then
  pass "활성 claim 0 → PASS (out=$OUT)"
else
  fail "빈 claim 경계 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T7] negative — 후보 id 인자 누락 → non-zero exit (B7)"
OUT="$( ( cd "$WORK/A" && VCC_REMOTE="$WORK/origin.git" VCC_REF="$REF" \
         VCC_MAIN_REF="HEAD" VCC_TASKS_DIR="docs/tasks" bash "$SCRIPT" ) 2>/dev/null )"; RC=$?
if [ $RC -ne 0 ]; then
  pass "후보 id 누락 시 non-zero exit (rc=$RC)"
else
  fail "후보 id 누락인데 exit 0 (out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T8] branch — dependsOn 2차 신호: status≠DONE 이나 origin/main commit 매칭 → PASS (B8)"
seed_claims '[]'
write_task T-4001 PENDING "[src/d4.ts]" "[]"        # status PENDING(1차 신호 무)
commit_with_msg "feat(x): T-4001 머지 박제 (T-4001)" # 2차 신호: HEAD 에 commit 매칭
write_task T-1006 PENDING "[src/e6.ts]" "[T-4001]"  # 후보: dep 는 commit 으로 머지 인정
OUT="$(run_vcc T-1006)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "PASS T-1006" ]; then
  pass "dependsOn 2차 commit 신호 → PASS (out=$OUT)"
else
  fail "dependsOn 2차 신호 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo "[T9] negative — dependsOn task 파일 자체 부재(status·commit 둘 다 무) → unmerged-dependency (B9)"
write_task T-1007 PENDING "[src/f7.ts]" "[T-9999]"  # T-9999 파일 없음 + commit 매칭 없음
OUT="$(run_vcc T-1007)"; RC=$?
if [ $RC -eq 0 ] && [ "$OUT" = "DEMOTE T-1007 reason=unmerged-dependency" ]; then
  pass "dependsOn 파일 부재 → unmerged-dependency 강등 (out=$OUT)"
else
  fail "dependsOn 파일 부재 분기 실패 (rc=$RC out=$OUT)"
fi

# ──────────────────────────────────────────────────────────────────────────
echo ""
if [ $FAIL -eq 0 ]; then
  echo "validate-claim-candidate 검증 통과 (T1 happy / T2 files-overlap / T3 unmerged-dep / T4 touchesFiles누락-uncertain / T5 claims손상-uncertain / T6 빈claim-PASS / T7 인자누락 / T8 dep2차신호-PASS / T9 dep파일부재)"
  exit 0
else
  echo "validate-claim-candidate 검증 실패"
  exit 1
fi
