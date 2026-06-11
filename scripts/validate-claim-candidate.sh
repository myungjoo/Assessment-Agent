#!/usr/bin/env bash
# scripts/validate-claim-candidate.sh
#
# ADR-0036 fine-grained concurrency — §Decision 8 (a)(b): select+claim 직전
# 호출되는 read-only claim 후보 런타임 재검증 + fail-safe 강등 primitive.
#
# 목적: planner 의 큐잉-시점 사전 인코딩(stage 1)을 신뢰하되, driver 가 select
#   단계에서 후보 task 가 **동시 claim 안전**한지 런타임 재검증한다(2차 방어).
#   본 script 는 **읽기 전용** — lock/CAS push 에 일절 접근하지 않고(claims.json
#   read + task frontmatter read + origin/main ref read 만), 순수 판정 후 stdout
#   신호만 낸다. STATE.json/journal/counters write 금지(CLAUDE.md §9 single-writer
#   — driver 전용). 실제 select+claim CAS 는 scripts/select-claim.sh 가, 본 판정의
#   driver loop wiring(언제 호출)은 별도 slice(LOOP.md §1[2], 토글 OFF 동안 inert).
#   slice 1/2 scripts/select-claim.sh · reclaim-stale-claim.sh 의 claims.json read·
#   field/split_entries 추출·CI ubuntu self-contained 패턴을 mirror(단 CAS 없음).
#   토글 `flags.fineGrainedConcurrency` 는 stage 5 까지 OFF — forward-looking.
#   운영 view·절차 상세는 docs/architecture/concurrency.md §7.
#
# ── 판정 3 분기 (ADR-0036 §Decision 8 (a)(b)) ────────────────────────────────
#   (b)-(i) touchesFiles 교집합: 후보 frontmatter 의 touchesFiles 가 **활성 claim
#       보유 task 들**(lock ref tip claims.json 의 taskId)의 touchesFiles 와 교집합
#       1+ 이면 → DEMOTE reason=files-overlap.
#   (b)-(ii) dependsOn 머지: 후보 frontmatter 의 dependsOn 전원이 origin/main 에
#       머지됐는지 확인. 판정 기준(§Decision 8 (a)(b) amend, T-0346):
#       1차 = 각 dependsOn task 파일 frontmatter `status: DONE`,
#       2차(1차 부재/불확실 시) = origin/main `git log --grep "(<taskId>)"` 매칭.
#       둘 다 미충족인 dependsOn 1+ 이면 → DEMOTE reason=unmerged-dependency.
#   (a) fail-safe 강등 — 모르면 직렬화: 판정 불확실 시(claims.json 파싱 실패·
#       손상 JSON · 후보 frontmatter 의 touchesFiles/dependsOn 누락 · dependsOn
#       task 파일 미발견 등) → DEMOTE reason=uncertain. fail-closed.
#       (활성 claim 0 이면 교집합 대상 자체가 없어 disjoint → 정상 PASS 가능.)
# ────────────────────────────────────────────────────────────────────────────
#
# 계약: $1=후보 task id(필수).
#   env: VCC_REMOTE(기본 origin) / VCC_REF(기본 lock-driver ref) /
#        VCC_MAIN_REF(dependsOn 머지 판정용 main ref, 기본 origin/main) /
#        VCC_TASKS_DIR(task 파일 디렉토리, 기본 docs/tasks).
#   출력(stdout): `PASS <taskId>`(동시 claim 안전) 또는
#        `DEMOTE <taskId> reason=<files-overlap|unmerged-dependency|uncertain>`.
#   exit 0 = 판정 완료(PASS·DEMOTE 둘 다 정상). non-zero = 인자 오류만(후보 id 누락).
#   사유 보조 메시지는 stderr.

set -uo pipefail

REMOTE="${VCC_REMOTE:-origin}"
REF="${VCC_REF:-refs/heads/claude/lock-driver}"
MAIN_REF="${VCC_MAIN_REF:-origin/main}"
TASKS_DIR="${VCC_TASKS_DIR:-docs/tasks}"

CAND="${1:-}"
if [ -z "$CAND" ]; then
  echo "validate-claim-candidate: 후보 task id(인자 1) 필요" >&2
  exit 2
fi

# 판정 결과를 stdout 에 1 줄로 내고 종료(exit 0). DEMOTE 도 정상 종료.
emit_pass()   { printf 'PASS %s\n' "$CAND"; exit 0; }
emit_demote() { # <reason-slug>
  printf 'DEMOTE %s reason=%s\n' "$CAND" "$1"
  exit 0
}

# ── frontmatter 추출 헬퍼 (task 파일 머리의 YAML frontmatter) ────────────────
# task 파일 경로 후보: <dir>/<id>.md 또는 <dir>/<id>-*.md 첫 매칭.
task_file() { # <taskId> -> 파일 경로(없으면 빈 문자열)
  local id="$1" f
  if [ -f "$TASKS_DIR/$id.md" ]; then
    printf '%s' "$TASKS_DIR/$id.md"; return 0
  fi
  for f in "$TASKS_DIR/$id"-*.md; do
    [ -f "$f" ] && { printf '%s' "$f"; return 0; }
  done
  return 0
}

# frontmatter(첫 '---' ~ 다음 '---') 안에서 한 줄짜리 키의 값을 추출(없으면 빈 값).
fm_value() { # <file> <key>
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  awk -v k="$key" '
    NR==1 && $0 ~ /^---[[:space:]]*$/ { infm=1; next }
    infm && $0 ~ /^---[[:space:]]*$/ { exit }
    infm {
      if ($0 ~ "^"k"[[:space:]]*:") {
        sub("^"k"[[:space:]]*:[[:space:]]*", "")
        print
        exit
      }
    }
  ' "$file"
}

# frontmatter 의 인라인 list 값(`[a, b, c]`)을 줄단위 토큰으로(따옴표/공백 제거).
# 키 자체가 없으면 비어 있는 출력(상위에서 누락 판정). 빈 list `[]` 는 0 토큰.
fm_list() { # <file> <key>
  local raw
  raw="$(fm_value "$1" "$2")"
  [ -z "$raw" ] && return 0
  printf '%s' "$raw" \
    | sed -E 's/^\[//; s/\][[:space:]]*$//' \
    | tr ',' '\n' \
    | sed -E "s/^[[:space:]]*//; s/[[:space:]]*$//; s/^[\"']//; s/[\"']$//" \
    | grep -v '^$' || true
}

# 키가 frontmatter 에 존재하는지(빈 list 와 키-누락을 구분 — fail-safe 판정용).
fm_has_key() { # <file> <key>  -> exit 0 if present
  local file="$1" key="$2"
  [ -f "$file" ] || return 1
  awk -v k="$key" '
    NR==1 && $0 ~ /^---[[:space:]]*$/ { infm=1; next }
    infm && $0 ~ /^---[[:space:]]*$/ { exit }
    infm && $0 ~ "^"k"[[:space:]]*:" { found=1; exit }
    END { exit (found?0:1) }
  ' "$file"
}

# claims.json 배열에서 taskId 들을 줄단위로(select-claim.sh claimed_task_ids 동형).
claimed_task_ids_from() { # <claims-json>
  printf '%s' "$1" \
    | grep -oE '"taskId"[[:space:]]*:[[:space:]]*"[^"]+"' \
    | sed -E 's/.*"taskId"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

# JSON 배열이 형태상 유효한 array 인지 보수적 검사([ 로 시작, ] 로 끝).
looks_like_array() { # <str>
  printf '%s' "$1" | grep -qE '^[[:space:]]*\[' \
    && printf '%s' "$1" | grep -qE '\][[:space:]]*$'
}

# dependsOn 1 개가 origin/main 에 머지됐는지: 1차 frontmatter status DONE,
# 2차 git log --grep "(<id>)" 매칭. 둘 다 실패면 미머지로 판정(1 반환).
dep_merged() { # <depId> -> 0 머지됨 / 1 미머지·불확실
  local dep="$1" df status
  df="$(task_file "$dep")"
  if [ -n "$df" ]; then
    status="$(fm_value "$df" status)"
    if [ "$status" = "DONE" ]; then
      return 0
    fi
  fi
  # 2차: origin/main 커밋 메시지에 "(<depId>)" 가 박힌 commit 존재?
  if git log "$MAIN_REF" --grep="($dep)" --max-count=1 --pretty=%H 2>/dev/null \
       | grep -q .; then
    return 0
  fi
  return 1
}

fetch_ref() { git fetch -q "$REMOTE" "$REF" 2>/dev/null || true; }

# ── 본 판정 ──────────────────────────────────────────────────────────────────
CAND_FILE="$(task_file "$CAND")"
if [ -z "$CAND_FILE" ]; then
  echo "validate-claim-candidate: 후보 task 파일 미발견 → fail-safe 강등" >&2
  emit_demote uncertain
fi

# (a) 후보 frontmatter 의 touchesFiles/dependsOn 키 자체가 없으면 fail-safe 강등.
if ! fm_has_key "$CAND_FILE" touchesFiles; then
  echo "validate-claim-candidate: 후보 touchesFiles 누락 → fail-safe 강등" >&2
  emit_demote uncertain
fi
if ! fm_has_key "$CAND_FILE" dependsOn; then
  echo "validate-claim-candidate: 후보 dependsOn 누락 → fail-safe 강등" >&2
  emit_demote uncertain
fi

CAND_TOUCHES="$(fm_list "$CAND_FILE" touchesFiles)"
CAND_DEPS="$(fm_list "$CAND_FILE" dependsOn)"

# ── (b)-(i) touchesFiles 교집합 검사 ─────────────────────────────────────────
fetch_ref
TIP="$(git ls-remote "$REMOTE" "$REF" 2>/dev/null | cut -f1)"
CLAIMS_JSON=""
if [ -n "$TIP" ]; then
  CLAIMS_JSON="$(git cat-file -p "$TIP:claims.json" 2>/dev/null || true)"
fi

# claims.json 이 존재하는데 형태가 깨졌으면 fail-safe 강등(파싱 불확실).
if [ -n "$CLAIMS_JSON" ] && ! looks_like_array "$CLAIMS_JSON"; then
  echo "validate-claim-candidate: claims.json 손상 → fail-safe 강등" >&2
  emit_demote uncertain
fi

# 활성 claim 보유 task 들의 touchesFiles 합집합을 모은다(후보 자신 제외).
ACTIVE_TOUCHES=""
if [ -n "$CLAIMS_JSON" ]; then
  while IFS= read -r aid; do
    [ -z "$aid" ] && continue
    [ "$aid" = "$CAND" ] && continue
    af="$(task_file "$aid")"
    if [ -z "$af" ]; then
      # 활성 claim 의 task 파일을 못 찾으면 교집합 판정 불가 → fail-safe 강등.
      echo "validate-claim-candidate: 활성 claim($aid) task 파일 미발견 → fail-safe 강등" >&2
      emit_demote uncertain
    fi
    if ! fm_has_key "$af" touchesFiles; then
      echo "validate-claim-candidate: 활성 claim($aid) touchesFiles 누락 → fail-safe 강등" >&2
      emit_demote uncertain
    fi
    ACTIVE_TOUCHES="${ACTIVE_TOUCHES}$(fm_list "$af" touchesFiles)"$'\n'
  done <<< "$(claimed_task_ids_from "$CLAIMS_JSON")"
fi

# 교집합: 후보 touchesFiles 중 활성 합집합에 정확히 일치하는 경로가 1+ 면 overlap.
if [ -n "$CAND_TOUCHES" ] && [ -n "$ACTIVE_TOUCHES" ]; then
  while IFS= read -r ct; do
    [ -z "$ct" ] && continue
    if printf '%s\n' "$ACTIVE_TOUCHES" | grep -qxF "$ct"; then
      echo "validate-claim-candidate: touchesFiles 교집합($ct) → files-overlap 강등" >&2
      emit_demote files-overlap
    fi
  done <<< "$CAND_TOUCHES"
fi

# ── (b)-(ii) dependsOn 머지 검사 ─────────────────────────────────────────────
if [ -n "$CAND_DEPS" ]; then
  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    if ! dep_merged "$dep"; then
      echo "validate-claim-candidate: dependsOn($dep) 미머지 → unmerged-dependency 강등" >&2
      emit_demote unmerged-dependency
    fi
  done <<< "$CAND_DEPS"
fi

# 모든 검사 통과 — 동시 claim 안전.
emit_pass
