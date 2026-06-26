#!/usr/bin/env bash
# scripts/acquire-lock.sh
#
# ADR-0009 ref-CAS lock 의 canonical 획득/해제 primitive — lock ref tip tree 의
# `lock.json` 만 교체하고 **claims.json 및 그 외 모든 tree 엔트리를 보존**한다.
#
# 목적: lock 획득 commit 이 `lock.json` 단독 fresh tree 로 lock ref 를 덮어써
#   다른 driver 의 활성 claim(claims.json)을 wipe 하던 근본 버그(#588 double-claim,
#   사고 commit be74f97 — parent tree=claims.json+lock.json 인데 획득 tree=lock.json
#   단독)를 차단한다. select-claim.sh(line 121~131)·reclaim-stale-claim.sh
#   (line 184~191)의 tree-보존 패턴(`git ls-tree "$old_sha" | grep -vE` base +
#   blob 교체)을 그대로 mirror 해 ADR-0036 §Decision 1/8 의 "보존 불변"(claims.json
#   동거 tree·CAS 원자성)을 lock-acquire 경로에서도 실제로 지킨다.
#   운영 절차 prose 는 docs/LOOP.md §1[1] + lock 절(획득/해제) 참조.
#
# ── lock.json schema (ADR-0009, 그대로 박제) ────────────────────────────────
#   저장 위치 = lock ref `refs/heads/claude/lock-driver` tip commit tree 의
#   `lock.json` blob. 같은 tree 의 claims.json(ADR-0036) 과 동거 — 단일 CAS
#   평면(ADR-0028). 획득:
#     {"holder":"loop"|"cron"|"human","session":"<holder>@<host>-<rand>","since":"<ISO>"}
#   해제(tombstone): {"holder":null,"since":""}  (브랜치 delete 금지 — ADR-0028)
# ────────────────────────────────────────────────────────────────────────────
#
# 경계: 본 primitive 는 CAS 획득/해제만 수행한다. held(<60분) vs stale(≥60분)
#   판정·탈취 여부는 호출측(driver loop §1[1]) 책임 — 본 script 는 주어진
#   lease(old-sha)로 CAS 만 시도하고, lease mismatch(다른 driver 가 먼저 push)
#   면 reject 를 그대로 전파한다(이중 획득 0). staleness TTL 판정 없음.
#
# 계약(획득): $1=holder(loop|cron|human), $2=session(<holder>@<host>-<rand>),
#             $3(선택)=since(ISO 8601, 미지정 시 env ACQUIRE_NOW 또는 UTC now).
#   계약(해제): $1=release  (tombstone 으로 lock.json 교체, claims.json 보존).
#   env: ACQUIRE_REMOTE(기본 origin) / ACQUIRE_REF(기본 lock-driver ref) /
#        ACQUIRE_RETRIES(CAS race 재시도, 기본 3) / ACQUIRE_NOW(since, 미지정 시 UTC).
#   exit 0 = 획득/해제 성공. non-zero = CAS lose 재시도 소진(1) 또는 인자 오류(2).
#   stdout: 성공 시 새 lock ref tip sha. stderr: 실패 사유.

set -uo pipefail

REMOTE="${ACQUIRE_REMOTE:-origin}"
REF="${ACQUIRE_REF:-refs/heads/claude/lock-driver}"
RETRIES="${ACQUIRE_RETRIES:-3}"
NOW="${ACQUIRE_NOW:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

MODE="acquire"
HOLDER="${1:-}"
if [ "$HOLDER" = "release" ]; then
  MODE="release"
else
  if [ -z "$HOLDER" ]; then
    echo "acquire-lock: holder(인자 1) 필요 — loop|cron|human 또는 release" >&2
    exit 2
  fi
  SESSION="${2:-}"
  if [ -z "$SESSION" ]; then
    echo "acquire-lock: session(인자 2) 필요 — <holder>@<host>-<rand>" >&2
    exit 2
  fi
  [ -n "${3:-}" ] && NOW="$3"
fi

# 모드별 새 lock.json blob 본문을 만든다.
lock_blob_body() {
  if [ "$MODE" = "release" ]; then
    printf '{"holder":null,"since":""}'
  else
    printf '{"holder":"%s","session":"%s","since":"%s"}' "$HOLDER" "$SESSION" "$NOW"
  fi
}

# 한 회 CAS 획득/해제 시도. 성공 0 / CAS race lose 20.
attempt() {
  git fetch -q "$REMOTE" "$REF" 2>/dev/null || true
  # lock ref 현재 tip(old-sha). 부재면 빈 문자열 → expect-absent lease(첫 lock 생성).
  local old_sha
  old_sha="$(git ls-remote "$REMOTE" "$REF" 2>/dev/null | cut -f1)"

  # 새 commit tree: 기존 tip tree 를 base 로 lock.json **만** 교체.
  # claims.json 및 그 외 모든 엔트리는 ls-tree base 로 그대로 보존(본 버그 차단).
  local lock_blob tree commit
  lock_blob="$(lock_blob_body | git hash-object -w --stdin)"

  {
    if [ -n "$old_sha" ]; then
      git ls-tree "$old_sha" \
        | grep -vE '\s(lock\.json)$' || true
    fi
    printf '100644 blob %s\tlock.json\n' "$lock_blob"
  } | git mktree >/tmp/.al_tree 2>/dev/null
  tree="$(cat /tmp/.al_tree)"
  rm -f /tmp/.al_tree

  # CI ubuntu runner 는 ambient git identity 가 0 이라 commit-tree 가
  # `fatal: empty ident name` 으로 실패한다 — select-claim.sh 와 동형으로
  # identity 를 호출 지점에서 self-provide 해 self-contained 계약을 지킨다.
  local msg
  if [ "$MODE" = "release" ]; then
    msg="release lock"
  else
    msg="acquire lock by ${SESSION}"
  fi
  if [ -n "$old_sha" ]; then
    commit="$(git -c user.name='lock-acquire' -c user.email='lock-acquire@localhost' \
      commit-tree "$tree" -p "$old_sha" -m "$msg" 2>/dev/null)"
  else
    commit="$(git -c user.name='lock-acquire' -c user.email='lock-acquire@localhost' \
      commit-tree "$tree" -m "$msg" 2>/dev/null)"
  fi

  # 빈/누락 commit push 방지 가드(MEMORY lock-cas-bash-hazard — 빈 $commit 으로
  # `git push <empty>:$REF` 하면 lock-driver 브랜치를 **삭제**한다, 6회 재발).
  if [ -z "$commit" ]; then
    echo "acquire-lock: commit-tree 실패(빈 COMMIT) — push 차단(브랜치 삭제 방지)" >&2
    return 30
  fi

  # CAS push: lease=old-sha(빈 문자열이면 expect-absent). 성공 시 이중 획득 불가.
  if git push "$REMOTE" "$commit:$REF" \
       --force-with-lease="$REF:$old_sha" >/dev/null 2>&1; then
    printf '%s\n' "$commit"
    return 0
  fi
  return 20
}

i=0
while [ "$i" -le "$RETRIES" ]; do
  attempt
  rc=$?
  case "$rc" in
    0)  exit 0 ;;                       # 획득/해제 성공
    20) i=$((i + 1)) ;;                 # CAS race lose — old-sha 재독 후 재시도
    *)  exit "$rc" ;;                   # 빈 commit 가드(30) 등 그대로 전파
  esac
done

echo "acquire-lock: CAS race 재시도 ${RETRIES}회 소진 — ${MODE} 실패" >&2
exit 1
