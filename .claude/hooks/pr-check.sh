#!/usr/bin/env bash
# Stop-hook guard for pr-mode tasks.
#
# Blocks turn-end when the most recent commit on a non-main branch added
# non-doc (code) changes that may not yet have been wrapped into a PR.
# Doc-only commits pass through, so a normal turn sequence is:
#
#   1. code commit + push   ← hook blocks if you stop here
#   2. PR open + integrator dispatch
#   3. STATE/journal doc commit + push  ← hook passes (doc-only)
#
# Already-merged HEADs also pass (`git merge-base --is-ancestor HEAD
# origin/main`). The guard only inspects the latest commit, per the
# "1 task = 1 commit" rule (CLAUDE.md §3).

set -u

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ "$BRANCH" = "main" ] && exit 0
[ "$BRANCH" = "HEAD" ] && exit 0

git fetch origin main --quiet 2>/dev/null || true
if git merge-base --is-ancestor HEAD origin/main 2>/dev/null; then
  exit 0
fi

LAST_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null) || exit 0
NON_DOC=$(echo "$LAST_FILES" \
  | grep -Ev '^(docs/|README\.md$|CLAUDE\.md$|\.claude/)' \
  | grep -v '^$' \
  | head -3)
[ -z "$NON_DOC" ] && exit 0

cat >&2 <<EOF
[pr-check] Most recent commit on $BRANCH includes non-doc changes:
$(echo "$NON_DOC" | sed 's/^/  - /')

Before ending this turn (LOOP.md §1 [4]):
  1. Open a PR against main — mcp__github__create_pull_request.
  2. Dispatch the integrator sub-agent.

Doc-only follow-up commits pass this guard, so the recommended sequence
is: code commit + push + PR open + integrator dispatch FIRST, then any
STATE/journal doc commits.
EOF
exit 2
