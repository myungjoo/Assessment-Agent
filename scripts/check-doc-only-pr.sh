#!/usr/bin/env bash
# scripts/check-doc-only-pr.sh
#
# CLAUDE.md §3.1 의 direct/pr 경계를 CI 의 reviewer-approval 게이트에 반영한다.
# PR 의 변경 파일이 **전부** direct-mode 문서(STATE/PLAN/journal/task/CLAUDE/
# README/.claude 등) allowlist 에 속하면 exit 0 (reviewer-approval 게이트 면제
# 대상), 하나라도 pr-mode 영역(src/·test/·ADR·architecture·CI·config 등)을
# 건드리면 exit 1 (게이트 필요).
#
# 배경: doc-only driver bookkeeping(예: planner 의 nextTask queue, PLAN
# 체크박스 doc-sync)은 §3.1 상 PR 없이 main 에 direct commit 하는 변경이라
# reviewer 검토 대상이 아니다. 그러나 web harness 등으로 그런 변경이 PR 로
# 라우팅되면 §3.3 게이트 (2) 가 reviewer 승인 부재로 CI 를 red 로 만든다.
# 본 helper 가 그 경우를 식별해 게이트를 면제한다 — §3.1 의 기존 경계를
# CI 에 그대로 옮긴 것이지 새 정책이 아니다.
#
# 입력: 변경 파일 경로 목록을 stdin 으로 (1 줄 1 파일). 호출측이 파일 목록을
#       주입하므로 본 script 는 gh/git/네트워크 의존 0 (순수 bash + grep) —
#       단위 test 가능. CI 에서는 `gh pr view <n> --json files` 가 주입한다.
# 출력: 판정 사유를 stdout/stderr 로. exit code 가 계약(0=면제, 1=게이트 필요).
#
# 보수성: 빈 입력(변경 파일 0)은 exit 1 — 변경을 식별 못 한 PR 을 doc-only 로
#         오인해 게이트를 면제하지 않는다(fail-safe: 의심스러우면 게이트 유지).

set -euo pipefail

# direct-mode 문서 allowlist (CLAUDE.md §3.1). 경로 시작(^) anchor 매칭.
# 주의: docs/architecture/ 와 docs/decisions/(ADR) 는 pr-mode 라 **제외** —
#       면제하지 않고 reviewer 검토를 받게 한다.
ALLOW_RE='^(docs/(STATE\.json|PLAN\.md|PLAN_archive\.md|LOOP\.md|requirements\.md|progress/|tasks/|use-cases/)|CLAUDE\.md|README\.md|\.claude/)'

# stdin 전체를 읽고 공백/빈 줄 제거.
files="$(cat || true)"
files="$(printf '%s\n' "$files" | sed '/^[[:space:]]*$/d')"

if [ -z "$files" ]; then
  echo "doc-only 판정: 변경 파일 0 — 면제 대상 아님(보수적 exit 1)." >&2
  exit 1
fi

# allowlist 에 매칭되지 않는(=pr-mode 영역) 파일 추출.
non_doc="$(printf '%s\n' "$files" | grep -vE "$ALLOW_RE" || true)"

if [ -n "$non_doc" ]; then
  echo "doc-only 아님 — 다음 변경이 pr-mode(코드/ADR/architecture/CI/config) 영역이라 reviewer 검토 대상:" >&2
  printf '  %s\n' $non_doc >&2
  exit 1
fi

echo "doc-only PR — 모든 변경이 direct-mode 문서 allowlist 에 속함(CLAUDE.md §3.1). reviewer-approval 게이트 면제."
exit 0
