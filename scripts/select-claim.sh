#!/usr/bin/env bash
# scripts/select-claim.sh
#
# ADR-0036 fine-grained concurrency — stage 2 slice 1: lock-하 atomic
# select+claim CAS primitive.
#
# 목적: claim 박제를 lock(critical section) 하에서 원자적으로 수행해 두 driver 가
#   같은 task 를 이중 claim 하지 못하게 한다. ADR-0009 ref-CAS lock
#   (`--force-with-lease`) 원자성을 재사용해 claim 직렬화까지 커버(§Decision 1).
#   토글 `flags.fineGrainedConcurrency` 는 stage 5 까지 OFF — forward-looking
#   primitive. 운영 view·절차 상세는 docs/architecture/concurrency.md §3.
#
# ── claims.json schema (ADR-0036 §Decision 1, 그대로 박제) ──────────────────
#   저장 위치 = lock ref `refs/heads/claude/lock-driver` tip commit tree 의
#   추가 파일 `claims.json` (배열). lock blob(lock.json) 과 같은 commit 에 동거해
#   단일 CAS 평면(ADR-0028) + 단일 조회로 lock + 모든 claim 을 본다.
#
#   [
#     {
#       "taskId":    "T-NNNN",
#       "owner":     "<session — <holder>@<host>-<rand>, lock blob session 동형>",
#       "claimedAt": "<ISO 8601 — server time 기준, §Decision 5>",
#       "status":    "CLAIMED | IN_PROGRESS | PR_OPEN | DONE",
#       "prNumber":  <int | null>
#     }
#   ]
# ────────────────────────────────────────────────────────────────────────────
#
# 경계: claimed-set 제외만 구현. `dependsOn` 미머지 등 런타임 의존성 평가는
#   호출측 책임(§Decision 3, slice 2+). staleness 회수·PR-resume 도 slice 2.
#   런타임 재검증(touchesFiles 교집합·dependsOn 머지) + fail-safe 강등은
#   별도 read-only primitive scripts/validate-claim-candidate.sh 가 담당하며
#   본 CAS 경로 밖에서 select 직전 호출된다(ADR-0036 §Decision 8 (a)(b), T-0346).
#
# 계약: $1=owner session id, $2..=후보 task id(공백 구분).
#   env: CLAIM_REMOTE(기본 origin) / CLAIM_REF(기본 lock-driver ref) /
#        CLAIM_RETRIES(CAS race 재시도, 기본 3) / CLAIM_NOW(claimedAt, 미지정 시 UTC).
#   exit 0 = claim 성공(claimed taskId stdout). non-zero = claimable 부재 또는
#        재시도 소진. 사유는 stderr.

set -uo pipefail

# tree-보존 CAS mutation 공통 헬퍼(scripts/lib-lock-tree.sh)를 source.
# claim CAS(claims.json + lock.json tombstone 2 blob 교체)를 이 헬퍼를 거쳐 수행.
# shellcheck source=scripts/lib-lock-tree.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-lock-tree.sh"

REMOTE="${CLAIM_REMOTE:-origin}"
REF="${CLAIM_REF:-refs/heads/claude/lock-driver}"
RETRIES="${CLAIM_RETRIES:-3}"
NOW="${CLAIM_NOW:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

OWNER="${1:-}"
if [ -z "$OWNER" ]; then
  echo "select-claim: owner session id(인자 1) 필요" >&2
  exit 2
fi
shift
CANDIDATES=("$@")
if [ "${#CANDIDATES[@]}" -eq 0 ]; then
  echo "select-claim: 후보 task id 목록(인자 2..) 비어 있음" >&2
  exit 2
fi

# lock ref tip 의 claims.json 에서 이미 claim 된 taskId 집합을 줄단위로 출력.
# ref 부재 / claims.json 부재 시 빈 출력(아직 아무도 claim 안 함).
claimed_task_ids() { # <tip-sha>
  local tip="$1"
  [ -z "$tip" ] && return 0
  git cat-file -p "$tip:claims.json" 2>/dev/null \
    | grep -oE '"taskId"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | sed -E 's/.*"taskId"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

# 후보 중 claimed-set 에 없는 첫 task 를 고른다(없으면 빈 문자열).
pick_claimable() { # <claimed-newline-list>
  local claimed="$1" c
  for c in "${CANDIDATES[@]}"; do
    if ! printf '%s\n' "$claimed" | grep -qxF "$c"; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 0
}

# 한 회 select+claim 시도. 성공 0 / claimable 부재 10 / CAS race lose 20.
attempt() {
  git fetch -q "$REMOTE" "$REF" 2>/dev/null || true
  # lock ref 의 현재 tip(old-sha). 부재면 빈 문자열(첫 claim — lease=expect-absent).
  local old_sha
  old_sha="$(git ls-remote "$REMOTE" "$REF" 2>/dev/null | cut -f1)"

  local claimed task
  claimed="$(claimed_task_ids "$old_sha")"
  task="$(pick_claimable "$claimed")"
  if [ -z "$task" ]; then
    echo "select-claim: no claimable task (후보 전부 이미 claimed)" >&2
    return 10
  fi

  # 기존 claims.json(있으면)을 base 로 새 claim 을 append 한 배열을 만든다.
  local base_arr new_entry new_arr
  if [ -n "$old_sha" ]; then
    base_arr="$(git cat-file -p "$old_sha:claims.json" 2>/dev/null || echo '[]')"
  else
    base_arr='[]'
  fi
  [ -z "$base_arr" ] && base_arr='[]'

  new_entry="$(printf '{"taskId":"%s","owner":"%s","claimedAt":"%s","status":"CLAIMED","prNumber":null}' \
    "$task" "$OWNER" "$NOW")"
  # 배열 끝 ']' 직전에 항목을 끼운다(빈 배열이면 그냥 [entry]).
  if printf '%s' "$base_arr" | grep -qE '\[[[:space:]]*\]'; then
    new_arr="[$new_entry]"
  else
    new_arr="$(printf '%s' "$base_arr" | sed -E "s/[[:space:]]*\]$/,${new_entry//\//\\/}]/")"
  fi

  # 새 commit tree: 기존 tip tree 를 base 로 claims.json blob 교체 + lock.json
  # 을 tombstone 으로 동반 = 즉시 release(ADR-0036 §Decision 1). tree 구성·
  # self-contained identity commit·빈 commit 가드·CAS push 는 lock_tree_cas_push
  # 에 위임(claims.json/lock.json 만 교체, 나머지 엔트리 보존 — claim CAS 의미 불변).
  local claims_blob tomb_blob rc
  claims_blob="$(printf '%s' "$new_arr" | git hash-object -w --stdin)"
  tomb_blob="$(printf '{"holder":"","since":""}' | git hash-object -w --stdin)"

  # 헬퍼는 성공 시 새 tip sha 를 stdout 으로, claim 성공 시 호출측은 task id 를
  # stdout 으로 내야 하므로 헬퍼 출력은 버린다(>/dev/null). rc 를 **헬퍼 호출
  # 직후 즉시** 캡처해야 한다 — `if helper; then ...; fi` 뒤에서 `rc=$?` 를 읽으면
  # if 가 false 분기(else 없음)일 때 compound `if` 자체의 종료코드 0 을 받게 돼
  # CAS lose(20)/빈 commit 가드(30)가 0 으로 덮여 재시도/소진 분기가 dead code 가
  # 된다(T-0732 PR #648 동형 버그). 그래서 rc 를 먼저 캡처한 뒤 분기한다.
  lock_tree_cas_push "$REMOTE" "$REF" "$old_sha" '\s(claims\.json|lock\.json)$' \
    "claims.json=${claims_blob}" "lock.json=${tomb_blob}" \
    "claim ${task} by ${OWNER}" >/dev/null
  rc=$?
  if [ "$rc" -eq 0 ]; then
    printf '%s\n' "$task"
    return 0
  fi
  # 헬퍼의 빈 commit 가드(30)는 본 script 의 상위 case 에서 그대로 전파되고,
  # CAS lose(20)는 재시도 루프가 받는다(현 의미 보존).
  return "$rc"
}

i=0
while [ "$i" -le "$RETRIES" ]; do
  attempt
  rc=$?
  case "$rc" in
    0)  exit 0 ;;                       # claim 성공
    10) exit 1 ;;                       # claimable 부재 — 재시도 무의미
    20) i=$((i + 1)) ;;                 # CAS race lose — claims 재독 후 재시도
    *)  exit "$rc" ;;                   # 그 외 오류 그대로 전파
  esac
done

echo "select-claim: CAS race 재시도 ${RETRIES}회 소진 — claim 실패" >&2
exit 1
