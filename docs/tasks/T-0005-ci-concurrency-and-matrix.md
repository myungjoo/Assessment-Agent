---
id: T-0005
title: CI hygiene — add concurrency group and resolve single-element matrix
phase: P0
status: SUPERSEDED
commitMode: pr
estimatedDiff: 25
estimatedFiles: 1
created: 2026-05-23
supersededAt: 2026-05-23T11:45:00Z
supersededBy: "PR #1 round 1 (commit to follow on branch claude/assessment-agent-long-horizon-t2xNF)"
supersededReason: "CLAUDE.md §3.2 reviewer-round consensus rule requires same-PR resolution. m-3 concurrency + m-4 matrix-decoration removed in round 1 of PR #1. Also caught a side bug (CI test command `pnpm test -- --ci` was producing 'No tests found' due to argument-forwarding shape; switched to `pnpm exec jest --ci`)."
plannerNote: P0 follow-up to T-0001 review m-3+m-4; small CI workflow polish; ideal candidate to verify the pr-mode flow end-to-end on a tiny PR.
---

# T-0005 — CI hygiene: concurrency group + matrix decoration

## Why

Reviewer findings **m-3** and **m-4** on PR #1, both touching `.github/workflows/ci.yml`:

- **m-3**: No `concurrency` group → rapid pushes queue multiple redundant runs, wasting Action minutes.
- **m-4**: `strategy.matrix.node: [22]` with `fail-fast: false` is decorative — a single-element matrix adds run-time noise (matrix axis in run titles, no extra coverage).

Both are one-file edits, both clearly belong together (CI workflow hygiene), and together they form an ideal small pr-mode PR to verify the integrator/reviewer/merge flow end-to-end after the T-0001 round 0 experience (where merge hit a mock-env divergence — see STATE.pullRequests.T-0001.mergeAttempt).

## Required Reading

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) (the only file to modify)
- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Findings m-3 and m-4
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (confirms Node.js 22 LTS is the only currently-supported runtime; informs the matrix decision)

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` adds a top-level `concurrency:` block with `group: ${{ github.workflow }}-${{ github.ref }}` and `cancel-in-progress: true`.
- [ ] For the matrix: pick **one** of (a) drop `strategy.matrix` entirely and keep a single `node-version: 22` step, **or** (b) expand the matrix to include at least one additional supported Node version (e.g., 20 LTS) and verify locally that both versions install and test. Choose (a) unless a clear reason for (b) is documented in the PR body.
- [ ] The chosen direction is justified in 1 sentence inside the workflow file as a YAML comment above the relevant block.
- [ ] All other workflow steps (`pnpm install --frozen-lockfile`, lint, build, test) remain unchanged in order and command.
- [ ] The job still triggers on `push` and `pull_request` to the same branches/paths as before.
- [ ] `pnpm lint`, `pnpm build`, `pnpm test` still pass locally (no code change expected, but verify).

## Out of Scope

- Caching `pnpm store` (separate optional task).
- Adding new jobs (coverage upload, security scan, etc.).
- Branch-protection rules (T-0008).
- Any change outside `.github/workflows/ci.yml`.

## Suggested Sub-agents

`implementer` (edit workflow) → `tester` (re-run `pnpm lint && pnpm build && pnpm test` and assert workflow YAML parses with a lint such as `yamllint` if available, otherwise a manual eyeball).

## Follow-ups

(empty)
