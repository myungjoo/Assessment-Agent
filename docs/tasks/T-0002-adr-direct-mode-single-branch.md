---
id: T-0002
title: ADR amendment — direct-mode docs reach main under single-working-branch constraint
phase: P0
status: PENDING
commitMode: pr
estimatedDiff: 120
estimatedFiles: 2
created: 2026-05-23
plannerNote: P0 follow-up to T-0001 review M-1; new ADR formalizes how direct-mode docs land on main when env restricts driver to one branch.
---

# T-0002 — ADR amendment: direct-mode docs on a single working branch

## Why

Reviewer finding **M-1** (informational MAJOR) on PR #1 noted that CLAUDE.md §3.1 prescribes direct-mode commits (STATE.json, journal, task frontmatter, `.claude/`, CLAUDE.md operating rules) land **directly on `main`** without PR. The current environment restricts the driver to one designated working branch, so those direct-mode payloads got co-bundled into the pr-mode PR for T-0001. This (a) lets reviewer comment on docs that policy says are not gated, (b) bloats PR diffs, (c) erodes the direct/pr split as a precedent.

We need an ADR that **either** ratifies a procedural workaround (e.g., a dedicated fast-path PR with auto-merge for direct-mode bundles) **or** amends §3.1 to acknowledge that under single-branch constraint, direct-mode payloads may piggyback on the next pr-mode PR with a clear marker. The ADR drives the rule change; CLAUDE.md itself is not modified by this task (that is a separate direct-mode follow-up after the ADR is accepted).

References: [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding M-1.

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) §3.1 (direct vs pr commit modes — the rule being amended)
- [CLAUDE.md](../../CLAUDE.md) §0 (priority-of-conflict preamble — relevant to env-vs-policy framing)
- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding M-1 (problem statement + mitigation context)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (template / format reference)
- [docs/STATE.json](../STATE.json) `pullRequests.T-0001` entry (concrete example of co-bundled commits)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0002-direct-mode-single-branch.md` exists with status `ACCEPTED`, date, deciders, refs.
- [ ] ADR Context section names the constraint (driver restricted to one working branch under current env) and the three example co-bundled commits from PR #1 (`6393b24`, `5373fd5`, `c32c64e`).
- [ ] ADR Decision section picks **one** procedural rule among at least these alternatives, with reasoning: (a) co-bundle direct payloads into the next pr-mode PR with an explicit `direct-mode-payload:` trail marker, (b) open a separate "docs fast-path" PR that auto-merges, (c) carve a second working branch reserved for direct-mode pushes. Document the rejected alternatives too.
- [ ] ADR Consequences section explicitly states what changes in driver / planner / integrator behavior, and what CLAUDE.md §3.1 follow-up edit will be needed (without performing that edit in this task).
- [ ] ADR Compliance section cross-references CLAUDE.md §3.1 and notes the pending §3.1 amendment as a separate direct-mode task (to be created as follow-up).
- [ ] No other file changes (no CLAUDE.md edit, no STATE.json, no code) — those are separate direct-mode tasks once this ADR is ACCEPTED.

## Out of Scope

- Editing CLAUDE.md §3.1 itself (separate direct-mode task after ADR acceptance).
- Modifying integrator / planner sub-agent definitions in `.claude/agents/`.
- Reorganizing existing PR #1 commits (history is frozen).
- Branch-protection configuration (T-0008).

## Suggested Sub-agents

`architect` (write ADR) → `tester` (lint/build/test must still pass since no code changed; verify ADR markdown renders)

## Follow-ups

(empty — sub-agents append here)
