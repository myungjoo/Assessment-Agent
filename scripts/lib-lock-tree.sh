#!/usr/bin/env bash
# scripts/lib-lock-tree.sh
#
# lock ref(`refs/heads/claude/lock-driver`) tip tree 의 **tree-보존 mutation +
# CAS push** 공통 헬퍼. **source 전용 라이브러리**(직접 실행 아님 — `source` 해서
# 함수만 가져다 쓴다).
#
# 목적: acquire-lock.sh·select-claim.sh·reclaim-stale-claim.sh 3 곳에 복붙으로
#   중복돼 있던 "tip tree 를 base 로 한두 blob 만 교체 + self-contained git
#   identity commit-tree + 빈 commit 가드 + `--force-with-lease` CAS push" 로직을
#   단일 구현으로 추출한다. 복붙 중복은 double-claim(#588 — lock-acquire 가
#   claims.json 을 보존 안 하고 lock.json 단독 tree 로 덮어쓴 사고) 류 재발의
#   구조적 원천이었다(한 script 만 패턴을 어기면 다시 claims.json wipe). ADR-0036
#   §Decision 1 의 "보존 불변"(claims.json 동거 tree·CAS 원자성)을 lock-ref 변경
#   경로에서 단일 구현으로 강제한다.
#
# ── 계약: lock_tree_cas_push <remote> <ref> <old_sha> <preserve_except_regex> \
#                             <"path=blobsha" 쌍 N개...> [<commit_msg>] ─────────
#   동작:
#     1) base tree: `git ls-tree "$old_sha" | grep -vE "$preserve_except_regex"`
#        를 깔고(= preserve_except_regex 에 매칭되는 엔트리만 빼고 나머지 전부 보존),
#        인자로 받은 path↔blobsha 쌍을 `100644 blob <sha>\t<path>` 로 추가 →
#        `git mktree` 로 새 tree 객체를 만든다. → 그래서 호출측이 교체하려는
#        path 만 새 blob 으로 갱신되고 claims.json 등 sibling 은 byte-동일 보존된다.
#     2) self-contained identity commit: CI ubuntu runner 는 ambient git identity
#        가 0 이라 `git commit-tree` 가 `fatal: empty ident name` 으로 실패한다 —
#        identity 를 호출 지점에서 self-provide(`-c user.name=... -c user.email=...`)
#        해 self-contained 계약을 지킨다.
#     3) 빈 commit 가드: commit-tree 가 빈 값을 내면(환경 파손 등) **push 안 하고**
#        non-zero(30) return. 빈 $commit 으로 `git push <empty>:$ref` 하면 lock
#        브랜치를 **삭제**한다(MEMORY lock-cas-bash-hazard, 6회 재발) — 절대 차단.
#     4) CAS push: `--force-with-lease="$ref:$old_sha"`. old_sha 가 빈 문자열이면
#        expect-absent lease(첫 생성). 성공 시 이중 mutation 불가.
#
#   preserve_except_regex 의미: `grep -vE` 의 패턴. base tree 에서 **제외(=교체
#     대상)** 할 엔트리를 매칭한다. 예) acquire = `\s(lock\.json)$`(lock.json 만
#     교체), claim = `\s(claims\.json|lock\.json)$`(둘 다 교체). 나머지 엔트리는
#     전부 보존된다.
#
#   blob 쌍 인자 형식: `path=blobsha` (`=` 구분). N 개 가변 — 마지막 인자가 `=` 를
#     포함하지 않으면 commit_msg 로 간주한다. 예) `lock.json=<sha>` 1 쌍(acquire),
#     `claims.json=<sha1> lock.json=<sha2>` 2 쌍(claim).
#
#   old_sha 분기:
#     - old_sha 비어 있음 → 첫 생성. base ls-tree 생략(parent 없음), commit-tree
#       `-p` 생략, lease=expect-absent(`--force-with-lease="$ref:"`).
#     - old_sha 존재 → base = ls-tree(old_sha) 보존분, commit-tree `-p old_sha`,
#       lease=`$ref:$old_sha`.
#
#   return code(현 3 script 의미 보존):
#     0  = CAS push 성공(stdout = 새 tip commit sha)
#     20 = CAS lose(lease mismatch — 다른 driver 가 먼저 push). 호출측 재시도 신호.
#     30 = 빈/누락 commit 가드 발동(push 차단, 브랜치 삭제 방지).
#
#   임시파일: `git mktree` 출력을 임시파일에 받지 않고 command substitution
#     (`tree="$(... | git mktree)"`)으로 직접 캡처한다 — 현 acquire/select 의
#     `/tmp/.al_tree`·`/tmp/.sc_tree` 고정 경로(동시 driver 가 같은 경로를
#     덮어써 race-prone)를 제거한다(고유 경로 불요 = race 표면 0). MEMORY
#     summary-batch/mktemp(MSYS mktemp) hazard 도 자동 회피.

# lock_tree_cas_push <remote> <ref> <old_sha> <preserve_except_regex> \
#                    <"path=blobsha" 쌍...> [<commit_msg>]
lock_tree_cas_push() {
  local remote="$1" ref="$2" old_sha="$3" preserve_except="$4"
  shift 4

  # 가변 인자 파싱: `path=blobsha` 쌍을 모으고, `=` 없는 마지막 인자는 commit_msg.
  local -a pairs=()
  local msg="lock-tree CAS update"
  local arg
  for arg in "$@"; do
    if printf '%s' "$arg" | grep -q '='; then
      pairs+=("$arg")
    else
      msg="$arg"
    fi
  done
  if [ "${#pairs[@]}" -eq 0 ]; then
    echo "lock_tree_cas_push: 교체할 path=blobsha 쌍 1+ 필요" >&2
    return 2
  fi

  # 새 commit tree: 기존 tip tree(old_sha)를 base 로 깔되 preserve_except 매칭
  # 엔트리만 빼고 보존 → 인자 path↔blobsha 쌍을 추가 → mktree.
  local tree
  tree="$(
    {
      if [ -n "$old_sha" ]; then
        git ls-tree "$old_sha" | grep -vE "$preserve_except" || true
      fi
      local p path sha
      for p in "${pairs[@]}"; do
        path="${p%%=*}"
        sha="${p#*=}"
        printf '100644 blob %s\t%s\n' "$sha" "$path"
      done
    } | git mktree 2>/dev/null
  )"

  # self-contained identity commit (CI ubuntu ambient ident 0 대비).
  local commit
  if [ -n "$old_sha" ]; then
    commit="$(git -c user.name='lock-tree' -c user.email='lock-tree@localhost' \
      commit-tree "$tree" -p "$old_sha" -m "$msg" 2>/dev/null)"
  else
    commit="$(git -c user.name='lock-tree' -c user.email='lock-tree@localhost' \
      commit-tree "$tree" -m "$msg" 2>/dev/null)"
  fi

  # 빈/누락 commit push 차단(MEMORY lock-cas-bash-hazard — 빈 $commit push 는
  # lock 브랜치 삭제). tree 가 비어도(mktree 실패) commit 이 비므로 함께 차단된다.
  if [ -z "$commit" ]; then
    echo "lock_tree_cas_push: commit-tree 실패(빈 COMMIT) — push 차단(브랜치 삭제 방지)" >&2
    return 30
  fi

  # CAS push: lease=old_sha(빈 문자열이면 expect-absent). 성공 시 이중 mutation 불가.
  if git push "$remote" "$commit:$ref" \
       --force-with-lease="$ref:$old_sha" >/dev/null 2>&1; then
    printf '%s\n' "$commit"
    return 0
  fi
  return 20
}
