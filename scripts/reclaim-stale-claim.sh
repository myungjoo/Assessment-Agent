#!/usr/bin/env bash
# scripts/reclaim-stale-claim.sh
#
# ADR-0036 fine-grained concurrency — stage 2 slice 2: lock-하 orphan claim
# staleness 회수 + PR-resume 우선 primitive.
#
# 목적: driver 사망 시 남은 orphan claim 을 lock(critical section) 하에서
#   원자적으로 회수한다. 회수 임계는 lock stale 과 **동형 60분 server-time
#   임계**(§Decision 5 보수화) — 짧은 임계는 clock-skew 시 살아있는 driver 의
#   claim 을 오회수할 위험이 커 보수화한다. ADR-0009 ref-CAS lock
#   (`--force-with-lease`) 원자성을 재사용해 회수 commit 직렬화까지 커버.
#   claims.json read·tombstone 동반 release 패턴은 select-claim.sh 와 동형이며,
#   tree-보존 mutation + CAS push 는 공통 헬퍼 scripts/lib-lock-tree.sh 의
#   lock_tree_cas_push 로 위임한다(T-0675, fix-2 slice 1b — acquire/select 와
#   단일 구현 통일, CI ubuntu identity self-provide·빈 commit 가드 헬퍼 내장).
#   토글 `flags.fineGrainedConcurrency` 는 stage 5 까지 OFF — forward-looking
#   primitive. driver loop 통합(언제 본 script 를 호출하는지)은 stage 3 책임.
#   운영 view·절차 상세는 docs/architecture/concurrency.md §5.
#
# ── 두 회수 분기 (ADR-0036 §Decision 1 staleness 단락 — 회수 전 PR-resume 우선) ──
#   orphan claim(claimedAt 이 now-60분 초과)을 식별한 뒤 prNumber 로 분기:
#
#   (1) prNumber == null  → 단순 제거: claims.json 배열에서 그 entry 를 삭제.
#       열린 PR 이 없으므로 회수 후 새로 claim 가능 상태로 풀린다.
#
#   (2) prNumber != null  → PR-resume 신호 + owner 교체(prNumber 보존):
#       그 claim 을 제거하지 않고 owner 를 회수 driver(인자 1)로 교체하되
#       prNumber 는 보존한다. stdout 에 `RESUME prNumber=<n> taskId=<T-NNNN>`
#       1 줄을 박제해 회수 driver 에게 "새 PR 을 만들지 말고 이 PR 을 resume
#       하라"고 신호한다(중복 PR 방지 — ADR-0034 사고 메커니즘 직접 차단).
#       실제 PR checkout/이어작업은 stage 3 driver loop 책임(본 slice 는 신호만).
#
#   살아있는 claim(claimedAt 이 now-60분 이내)은 어느 분기도 타지 않고 보존.
#   회수/resume 대상 부재 시 변경 없이 정상 종료(exit 0, "no stale claim").
#
# ── server-time now 주입 계약 (§Decision 5 — clock-skew 오회수 차단) ──
#   회수 판정의 now 는 **server-time 기준으로 주입**받는다(env RECLAIM_NOW 또는
#   인자 2). 로컬 `date` 를 회수 임계 판정에 직접 쓰지 않는다 — 기기 간 clock
#   skew 가 간헐 실측되는 환경이라 로컬 시각이 살아있는 claim 을 오회수할 수
#   있다. **server-time now 미주입 시 회수를 보류**한다(변경 0, 오회수 0 —
#   §Decision 5 "server-time 확보 불가 시 회수 보류"). 실제 server-time fetch
#   (GitHub API `Date` 헤더 / `gh run` UTC)는 호출측(stage 3 loop) 책임.
#
# 계약: $1=회수 driver owner session id(PR-resume 시 owner 교체 값).
#       $2(선택)=server-time now(ISO 8601). 미지정 시 env RECLAIM_NOW.
#       둘 다 미지정 시 회수 보류(exit 0, "now 미주입 — 회수 보류").
#   env: RECLAIM_REMOTE(기본 origin) / RECLAIM_REF(기본 lock-driver ref) /
#        RECLAIM_NOW(server-time now) / RECLAIM_TTL_MIN(회수 임계 분, 기본 60) /
#        RECLAIM_RETRIES(CAS race 재시도, 기본 3).
#   exit 0 = 회수 성공 / 회수 대상 부재 / now 미주입 보류(전부 정상).
#        non-zero = CAS race 재시도 소진 또는 인자 오류. 사유는 stderr.
#   stdout: 단순 제거 시 `RECLAIM taskId=<T-NNNN>`,
#           PR-resume 시 `RESUME prNumber=<n> taskId=<T-NNNN>`.

set -uo pipefail

# tree-보존 CAS mutation 공통 헬퍼(scripts/lib-lock-tree.sh)를 source.
# orphan 회수 CAS(claims.json 재작성 + lock.json tombstone 2 blob 교체)를 이
# 헬퍼를 거쳐 수행한다 — acquire-lock.sh·select-claim.sh 와 동일한 단일 구현
# (ADR-0036 §Decision 1 "보존 불변" 을 lock-ref 변경 경로 셋 모두에서 강제).
# shellcheck source=scripts/lib-lock-tree.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib-lock-tree.sh"

REMOTE="${RECLAIM_REMOTE:-origin}"
REF="${RECLAIM_REF:-refs/heads/claude/lock-driver}"
TTL_MIN="${RECLAIM_TTL_MIN:-60}"
RETRIES="${RECLAIM_RETRIES:-3}"

OWNER="${1:-}"
if [ -z "$OWNER" ]; then
  echo "reclaim-stale-claim: 회수 driver owner session id(인자 1) 필요" >&2
  exit 2
fi

# server-time now: 인자 2 우선, 없으면 env RECLAIM_NOW. 둘 다 없으면 빈 문자열.
NOW="${2:-${RECLAIM_NOW:-}}"

# ISO 8601(`YYYY-MM-DDTHH:MM:SSZ`)을 epoch 초로 변환. GNU `date -d` 우선,
# 실패 시 BSD `date -j`. 변환 불가 시 빈 문자열(상위에서 보류 처리).
to_epoch() { # <iso8601>
  local iso="$1" e
  [ -z "$iso" ] && return 0
  e="$(date -u -d "$iso" +%s 2>/dev/null)" \
    || e="$(date -u -j -f '%Y-%m-%dT%H:%M:%SZ' "$iso" +%s 2>/dev/null)" \
    || e=""
  printf '%s' "$e"
}

# claims.json 배열에서 idx 번째(0-base) entry 의 한 필드를 뽑는다. python 불요 —
# entry 단위로 split 한 뒤 grep/sed 로 추출(select-claim.sh 의 grep 추출 동형).
# entry 들을 줄단위로 정규화: '},{' 경계에서 분리.
split_entries() { # <claims-json-array> -> entry 당 1 줄(중괄호 포함)
  local arr="$1"
  printf '%s' "$arr" \
    | sed -E 's/^\s*\[\s*//; s/\s*\]\s*$//' \
    | sed -E 's/\}\s*,\s*\{/}\n{/g'
}

field() { # <entry> <key> -> value(따옴표 제거, null 은 null 그대로)
  local entry="$1" key="$2"
  printf '%s' "$entry" \
    | grep -oE "\"$key\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|null|[0-9]+)" \
    | head -n1 \
    | sed -E "s/\"$key\"[[:space:]]*:[[:space:]]*//; s/^\"//; s/\"$//"
}

# 한 회 회수 시도. 성공 0 / 회수 대상 부재(no-op) 5 / now 미주입 보류 6 /
# CAS race lose 20.
attempt() {
  git fetch -q "$REMOTE" "$REF" 2>/dev/null || true
  local old_sha
  old_sha="$(git ls-remote "$REMOTE" "$REF" 2>/dev/null | cut -f1)"

  # ref 부재 / claims.json 부재 → 회수 대상 없음(no-op).
  local base_arr
  if [ -n "$old_sha" ]; then
    base_arr="$(git cat-file -p "$old_sha:claims.json" 2>/dev/null || echo '[]')"
  else
    return 5
  fi
  [ -z "$base_arr" ] && base_arr='[]'
  if printf '%s' "$base_arr" | grep -qE '\[[[:space:]]*\]'; then
    return 5  # 빈 배열 — 회수 대상 없음.
  fi

  # now epoch. 미주입/변환불가 → 회수 보류(§Decision 5).
  local now_epoch
  now_epoch="$(to_epoch "$NOW")"
  if [ -z "$now_epoch" ]; then
    return 6
  fi
  local threshold=$((TTL_MIN * 60))

  # 각 entry 를 순회하며 살아있는 claim/제거/resume 3 분류로 새 배열을 만든다.
  local entries kept_entries resume_msg reclaim_msg changed
  entries="$(split_entries "$base_arr")"
  kept_entries=""
  resume_msg=""
  reclaim_msg=""
  changed=0

  local entry tid cat prn cat_epoch age is_stale
  while IFS= read -r entry; do
    [ -z "$entry" ] && continue
    tid="$(field "$entry" taskId)"
    cat="$(field "$entry" claimedAt)"
    prn="$(field "$entry" prNumber)"
    cat_epoch="$(to_epoch "$cat")"

    is_stale=0
    if [ -n "$cat_epoch" ]; then
      age=$((now_epoch - cat_epoch))
      if [ "$age" -gt "$threshold" ]; then
        is_stale=1
      fi
    fi

    if [ "$is_stale" -eq 0 ]; then
      # 살아있는 claim(임계 이내) 또는 claimedAt 파싱 불가 → 보수적으로 보존.
      kept_entries="${kept_entries}${kept_entries:+,}${entry}"
      continue
    fi

    # orphan(stale) claim — prNumber 로 분기.
    if [ -z "$prn" ] || [ "$prn" = "null" ]; then
      # (1) prNumber null → 단순 제거(kept 에 넣지 않음).
      reclaim_msg="${reclaim_msg}RECLAIM taskId=${tid}"$'\n'
      changed=1
    else
      # (2) prNumber non-null → PR-resume: owner 교체, prNumber 보존, entry 유지.
      local new_entry
      new_entry="$(printf '%s' "$entry" \
        | sed -E "s/(\"owner\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")/\1${OWNER}\2/")"
      kept_entries="${kept_entries}${kept_entries:+,}${new_entry}"
      resume_msg="${resume_msg}RESUME prNumber=${prn} taskId=${tid}"$'\n'
      changed=1
    fi
  done <<< "$entries"

  if [ "$changed" -eq 0 ]; then
    return 5  # stale 인 회수/resume 대상 없음.
  fi

  local new_arr
  new_arr="[${kept_entries}]"

  # 새 commit tree: 기존 tip tree 를 base 로 claims.json 재작성 + lock.json
  # tombstone 동반(즉시 release — select-claim.sh mirror). tree 구성·
  # self-contained identity commit·빈 commit 가드·CAS push 는 lock_tree_cas_push
  # 에 위임(claims.json/lock.json 만 교체, 나머지 엔트리 byte-보존 — #588 류 wipe
  # 회귀 차단). 회수 외부 동작(분류·exit code·신호)은 불변, plumbing 만 헬퍼로 통일.
  local claims_blob tomb_blob rc
  claims_blob="$(printf '%s' "$new_arr" | git hash-object -w --stdin)"
  tomb_blob="$(printf '{"holder":"","since":""}' | git hash-object -w --stdin)"

  # 헬퍼는 성공 시 새 tip sha 를 stdout 으로 내지만, 회수 성공 시 본 함수는
  # RESUME/RECLAIM 신호를 stdout 으로 내야 하므로 헬퍼 출력은 버리고 rc 만 본다.
  if lock_tree_cas_push "$REMOTE" "$REF" "$old_sha" '\s(claims\.json|lock\.json)$' \
       "claims.json=${claims_blob}" "lock.json=${tomb_blob}" \
       "reclaim stale claim by ${OWNER}" >/dev/null; then
    [ -n "$resume_msg" ] && printf '%s' "$resume_msg"
    [ -n "$reclaim_msg" ] && printf '%s' "$reclaim_msg"
    return 0
  fi
  rc=$?
  # 헬퍼의 빈 commit 가드(30)는 상위 case 에서 그대로 전파되고, CAS lose(20)는
  # 재시도 루프가 받는다(현 의미 보존 — select-claim.sh 와 동형).
  return "$rc"
}

i=0
while [ "$i" -le "$RETRIES" ]; do
  attempt
  rc=$?
  case "$rc" in
    0)  exit 0 ;;                       # 회수/resume 성공
    5)  echo "reclaim-stale-claim: no stale claim (회수 대상 없음)" >&2
        exit 0 ;;                       # 회수 대상 부재 — 정상 no-op
    6)  echo "reclaim-stale-claim: server-time now 미주입 — 회수 보류" >&2
        exit 0 ;;                       # §Decision 5 보류 — 정상
    20) i=$((i + 1)) ;;                 # CAS race lose — claims 재독 후 재시도
    *)  exit "$rc" ;;                   # 그 외 오류 그대로 전파
  esac
done

echo "reclaim-stale-claim: CAS race 재시도 ${RETRIES}회 소진 — 회수 실패" >&2
exit 1
