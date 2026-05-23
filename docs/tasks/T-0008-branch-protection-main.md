---
id: T-0008
title: Document and request branch-protection rules on main
phase: P0
status: PENDING
commitMode: direct
estimatedDiff: 60
estimatedFiles: 2
created: 2026-05-23
plannerNote: P0 follow-up to T-0001 reviewer recommended #1; operational — agent cannot set GitHub branch-protection, so doc + humanQuestion is the deliverable.
---

# T-0008 — Document and request branch-protection rules on `main`

## Why

Reviewer recommended follow-up **#1** on PR #1: once CI is verified stable, `main` should be protected so that direct pushes by mistake (or by a malfunctioning driver) cannot land unreviewed code, and so that PRs cannot merge while CI is failing.

The agent **cannot** apply GitHub branch-protection rules from inside the loop — that is a repository-administrator action in the GitHub web UI (or via `gh api -X PUT repos/:owner/:repo/branches/main/protection` with a token that carries `admin:repo` scope, which is not available). So the deliverable of this task is two-fold:

1. A short operational document (`docs/ops/branch-protection.md`) that records the exact ruleset the driver expects, the rationale, and the GitHub UI / API steps to apply it.
2. A `humanQuestions` entry in `STATE.json` that asks the repo admin (the user) to perform the change in the GitHub UI and confirm back.

Once the user confirms application, a tiny direct-mode follow-up will tick the box.

References: [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) "Recommended follow-up tasks" #1.

## Required Reading

- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Recommended follow-ups
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commit modes — informs which checks must be required)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) (read only the `jobs.<id>.name` keys so the doc lists the exact check names that should be required)
- [docs/STATE.json](../STATE.json) (`humanQuestions` array — pattern for the new Q entry)

## Acceptance Criteria

- [ ] `docs/ops/branch-protection.md` exists and contains:
  - Required ruleset for `main`: (a) require PR before merging, (b) require status checks to pass before merging — list the exact CI job names from `.github/workflows/ci.yml`, (c) require branches to be up to date before merging, (d) require linear history (no merge commits) **or** explicitly document the choice not to, (e) block force pushes, (f) block deletions.
  - Rationale: 2–3 sentences linking to CLAUDE.md §3.1 (so direct-mode payloads to `main` from the driver remain explicitly allowed via admin path — call this out as an exception), and to §9 (no force push policy).
  - Application steps: GitHub UI path (`Settings → Branches → Add rule`) **and** `gh api` one-liner alternative.
  - Verification steps: how the agent (or admin) can confirm the rule is active (`gh api repos/:owner/:repo/branches/main/protection | jq`).
- [ ] `docs/STATE.json` gains a new `humanQuestions` entry (next `Q-NNNN` id, currently `Q-0002`) referencing this task and asking the admin to apply the ruleset. Status `asked`.
- [ ] No code, no workflow, no ADR. Doc + STATE only → direct-mode commit.
- [ ] After commit, the planner should queue a tiny follow-up `T-NNNN` (likely 1-line STATE update) to record admin confirmation, once received. Do **not** create that follow-up in this task.

## Out of Scope

- Actually invoking the GitHub API to apply the protection (not authorized).
- CODEOWNERS file (separate task once team membership exists).
- Required signed commits (separate decision — may conflict with agent commits).
- Required reviews count (we have one human reviewer + agent reviewer; numeric policy is a separate decision).

## Suggested Sub-agents

`implementer` (write the doc + add STATE.humanQuestions entry) — no tester needed (no code changed; markdown render is sufficient).

## Follow-ups

(empty — sub-agents append here; the "record admin confirmation" task is created by planner after this one completes)
