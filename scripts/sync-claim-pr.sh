#!/usr/bin/env bash
# scripts/sync-claim-pr.sh
#
# ADR-0036 fine-grained concurrency — claim record PR-open sync primitive.
#
# 목적: driver 가 PR 을 open 한 직후 자기 claim entry 의 `prNumber`(null → 정수)
#   + `status`(CLAIMED/IN_PROGRESS → PR_OPEN)를 lock(critical section) 하에서
#   원자적으로 갱신한다. 이 primitive 가 부재하면 PR open 후 prNumber 갱신 전
#   driver 사망 시 그 claim 이 `prNumber == null` 인 채 남고, reclaim-stale-claim.sh
#   가 그것을 단순 제거(L179~182 bare-prune)해 PR-resume 신호를 잃어 다음 driver 가
#   **중복 PR** 을 연다(T-0730 dup-PR forensic, PR #645 vs #646 패턴). 본 primitive 가
#   reclaim 의 `prNumber != null → RESUME` 분기를 정상 작동하게 만드는 빠진 단계다.
#   ADR-0036 §Decision 8 (a) fail-safe / 안전장치 backbone 직접 보강.
#   토글 `flags.fineGrainedConcurrency` 는 stage 5 까지 OFF — forward-looking
#   primitive. driver/integrator 가 본 script 를 **언제** 호출하는지의 wiring 은
#   별도 direct doc task(follow-up) 책임 — 본 script 는 primitive 만.
#
# ── claims.json schema (ADR-0036 §Decision 1, select-claim.sh 와 동일) ──────────
#   저장 위치 = lock ref `refs/heads/claude/lock-driver` tip commit tree 의
#   `claims.json`(배열). 본 primitive 는 claims.json 만 교체하고 lock.json 은
#   교체하지 않는다 — release 가 아니라 진행 중 claim 의 in-place 갱신이므로
#   tombstone 동반 불요(select-claim/reclaim 의 tombstone 동반 release 와 구별).
#
# 계약: $1=task id, $2=pr number(정수), $3=owner session id.
#   claims.json 에서 `taskId == $1 && owner == $3` entry 1개를 찾아 그 entry 의
#   prNumber 를 $2 로, status 를 PR_OPEN 으로만 갱신한다. 그 외 모든 entry 및
#   sibling tree 엔트리(meta.txt 등)는 byte-보존(preserve_except_regex
#   `\s(claims\.json)$` — claims.json 만 교체, lock.json 포함 나머지 전부 보존).
#   env: SYNC_REMOTE(기본 origin) / SYNC_REF(기본 lock-driver ref) /
#        SYNC_RETRIES(CAS race 재시도, 기본 3).
#   네트워크/credential 불요 — claims.json read + CAS push 만.
#   exit 0 = 갱신 성공 또는 idempotent no-op(이미 같은 prNumber+PR_OPEN).
#        non-zero = 인자 오류 / 대상 부재 / owner 불일치 / CAS 재시도 소진. 사유는 stderr.
#   stdout: 갱신 시 `SYNC taskId=<T-NNNN> prNumber=<n>`.

set -uo pipefail

# tree-보존 CAS mutation 공통 헬퍼(scripts/lib-lock-tree.sh)를 source.
# claims.json 단일 blob 교체 CAS 를 이 헬퍼를 거쳐 수행한다 —
# acquire-lock.sh·select-claim.sh·reclaim-stale-claim.sh 와 동일한 단일 구현
# (ADR-0036 §Decision 1 "보존 불변" 을 lock-ref 변경 경로 모두에서 강제).
# shellcheck source=scripts/lib-lock-tree.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-lock-tree.sh"

REMOTE="${SYNC_REMOTE:-origin}"
REF="${SYNC_REF:-refs/heads/claude/lock-driver}"
RETRIES="${SYNC_RETRIES:-3}"

TASK_ID="${1:-}"
PR_NUMBER="${2:-}"
OWNER="${3:-}"

# 인자 검증: 셋 중 하나라도 빈 값이면 즉시 거부(B: 인자 누락).
if [ -z "$TASK_ID" ] || [ -z "$PR_NUMBER" ] || [ -z "$OWNER" ]; then
  echo "sync-claim-pr: task-id(1) / pr-number(2) / owner(3) 모두 필요" >&2
  exit 2
fi
# pr-number 는 양의 정수만 허용(잘못된 입력 거부 — type mismatch).
if ! printf '%s' "$PR_NUMBER" | grep -qE '^[0-9]+$'; then
  echo "sync-claim-pr: pr-number 는 양의 정수여야 함 (got '$PR_NUMBER')" >&2
  exit 2
fi

# claims.json 배열을 entry 당 1 줄로 분해('},{' 경계 split — reclaim-stale-claim.sh 동형).
split_entries() { # <claims-json-array> -> entry 당 1 줄(중괄호 포함)
  local arr="$1"
  printf '%s' "$arr" \
    | sed -E 's/^\s*\[\s*//; s/\s*\]\s*$//' \
    | sed -E 's/\}\s*,\s*\{/}\n{/g'
}

# entry 한 줄에서 한 필드 값을 뽑는다(따옴표/숫자/null 모두 — reclaim-stale-claim.sh 동형).
field() { # <entry> <key> -> value(따옴표 제거, null/숫자 그대로)
  local entry="$1" key="$2"
  printf '%s' "$entry" \
    | grep -oE "\"$key\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|null|[0-9]+)" \
    | head -n1 \
    | sed -E "s/\"$key\"[[:space:]]*:[[:space:]]*//; s/^\"//; s/\"$//"
}

# 한 회 sync 시도. 성공 0 / 대상 부재(no-op) 5 / owner 불일치 7 /
# idempotent no-op(이미 동일) 8 / CAS race lose 20.
attempt() {
  git fetch -q "$REMOTE" "$REF" 2>/dev/null || true
  local old_sha
  old_sha="$(git ls-remote "$REMOTE" "$REF" 2>/dev/null | cut -f1)"

  # ref 부재 / claims.json 부재 → 대상 없음(no-op non-zero).
  local base_arr
  if [ -n "$old_sha" ]; then
    base_arr="$(git cat-file -p "$old_sha:claims.json" 2>/dev/null || echo '[]')"
  else
    return 5
  fi
  [ -z "$base_arr" ] && base_arr='[]'
  if printf '%s' "$base_arr" | grep -qE '\[[[:space:]]*\]'; then
    return 5  # 빈 배열 — 대상 없음.
  fi

  # 각 entry 를 순회: taskId 일치 시 owner 검사 후 갱신, 그 외는 그대로 보존.
  local entries kept_entries changed found owner_conflict idempotent
  entries="$(split_entries "$base_arr")"
  kept_entries=""
  changed=0
  found=0
  owner_conflict=0
  idempotent=0

  local entry tid eowner eprn estatus
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    tid="$(field "$entry" taskId)"
    if [ "$tid" != "$TASK_ID" ]; then
      # 무관 entry — byte 단위 그대로 보존(타 claim wipe 0, #588 류 회귀 가드).
      kept_entries="${kept_entries}${kept_entries:+,}${entry}"
      continue
    fi

    found=1
    eowner="$(field "$entry" owner)"
    if [ "$eowner" != "$OWNER" ]; then
      # owner 불일치 — 타 driver claim 은 무변경으로 보존하고 거부 플래그만 세운다.
      owner_conflict=1
      kept_entries="${kept_entries}${kept_entries:+,}${entry}"
      continue
    fi

    eprn="$(field "$entry" prNumber)"
    estatus="$(field "$entry" status)"
    if [ "$eprn" = "$PR_NUMBER" ] && [ "$estatus" = "PR_OPEN" ]; then
      # idempotent — 이미 같은 prNumber + PR_OPEN. 갱신 불요(no-op success).
      idempotent=1
      kept_entries="${kept_entries}${kept_entries:+,}${entry}"
      continue
    fi

    # prNumber(null/다른 값 → $PR_NUMBER) + status(→ PR_OPEN) in-place 갱신.
    # 다른 필드(taskId/owner/claimedAt)는 sed 치환으로 보존한다.
    local new_entry
    new_entry="$(printf '%s' "$entry" \
      | sed -E "s/(\"prNumber\"[[:space:]]*:[[:space:]]*)(\"[^\"]*\"|null|[0-9]+)/\1${PR_NUMBER}/" \
      | sed -E "s/(\"status\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")/\1PR_OPEN\2/")"
    kept_entries="${kept_entries}${kept_entries:+,}${new_entry}"
    changed=1
  done <<< "$entries"

  # 분기 처리: 대상 부재 / owner 불일치 / idempotent / 정상 갱신.
  if [ "$found" -eq 0 ]; then
    return 5  # taskId 부재.
  fi
  if [ "$owner_conflict" -eq 1 ] && [ "$changed" -eq 0 ]; then
    return 7  # owner 불일치(타 driver claim) — 갱신 거부.
  fi
  if [ "$idempotent" -eq 1 ] && [ "$changed" -eq 0 ]; then
    return 8  # 이미 동일 — no-op success(push 불요).
  fi

  local new_arr
  new_arr="[${kept_entries}]"

  # 새 commit tree: 기존 tip tree 를 base 로 claims.json 만 교체(lock.json 미교체 —
  # release 아님). tree 구성·identity commit·빈 commit 가드·CAS push 는
  # lock_tree_cas_push 에 위임(claims.json 만 교체, lock.json 포함 나머지 byte-보존).
  local claims_blob rc
  claims_blob="$(printf '%s' "$new_arr" | git hash-object -w --stdin)"

  # 헬퍼는 성공 시 새 tip sha 를 stdout 으로 내지만, 본 함수는 SYNC 신호를
  # stdout 으로 내야 하므로 헬퍼 출력은 버린다(>/dev/null). rc 를 **헬퍼 호출
  # 직후 즉시** 캡처해야 한다 — `if helper; then ...; fi` 뒤에서 `rc=$?` 를 읽으면
  # if 가 false 분기(else 없음)일 때 compound `if` 자체의 종료코드 0 을 받게 돼
  # CAS lose(20)/빈 commit 가드(30)가 0 으로 덮여 재시도/소진 분기가 dead code 가
  # 된다(round-1 MAJOR). 그래서 rc 를 먼저 캡처한 뒤 분기한다.
  lock_tree_cas_push "$REMOTE" "$REF" "$old_sha" '\s(claims\.json)$' \
    "claims.json=${claims_blob}" \
    "sync claim ${TASK_ID} pr ${PR_NUMBER} by ${OWNER}" >/dev/null
  rc=$?
  if [ "$rc" -eq 0 ]; then
    printf 'SYNC taskId=%s prNumber=%s\n' "$TASK_ID" "$PR_NUMBER"
    return 0
  fi
  # 헬퍼의 빈 commit 가드(30)는 상위 case 에서 그대로 전파되고, CAS lose(20)는
  # 재시도 루프가 받는다(현 의미 보존 — select-claim.sh / reclaim-stale-claim.sh 동형).
  return "$rc"
}

i=0
while [ "$i" -le "$RETRIES" ]; do
  attempt
  rc=$?
  case "$rc" in
    0)  exit 0 ;;                       # 갱신 성공
    5)  echo "sync-claim-pr: 대상 claim 부재 (taskId=$TASK_ID owner=$OWNER)" >&2
        exit 1 ;;                       # 대상 부재 — 재시도 무의미, non-zero
    7)  echo "sync-claim-pr: owner 불일치 — 타 driver claim 갱신 거부 (taskId=$TASK_ID)" >&2
        exit 1 ;;                       # owner 불일치 — 갱신 거부
    8)  echo "sync-claim-pr: 이미 prNumber=$PR_NUMBER + PR_OPEN — no-op (idempotent)" >&2
        exit 0 ;;                       # idempotent — 정상 no-op success
    20) i=$((i + 1)) ;;                 # CAS race lose — claims 재독 후 재시도
    *)  exit "$rc" ;;                   # 그 외 오류 그대로 전파(예: 빈 commit 가드 30)
  esac
done

echo "sync-claim-pr: CAS race 재시도 ${RETRIES}회 소진 — sync 실패" >&2
exit 1
