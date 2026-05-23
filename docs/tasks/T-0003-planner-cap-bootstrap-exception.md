---
id: T-0003
title: Document planner-cap exception for bootstrap-style tasks
phase: P0
status: PENDING
commitMode: direct
estimatedDiff: 30
estimatedFiles: 2
created: 2026-05-23
plannerNote: P0 follow-up to T-0001 review m-1; CLAUDE.md §3 cap was unrealistic for irreducible bootstrap; add named exception.
---

# T-0003 — Planner cap exception for bootstrap-style tasks

## Why

Reviewer finding **m-1** on PR #1: T-0001 frontmatter declared `estimatedDiff: 250 / estimatedFiles: 5`, actual was `447 / 11`. A NestJS bootstrap is *irreducibly* multi-file (package.json, tsconfig, tsconfig.build, eslintrc, gitignore, ci.yml, ADR, README edit, src/app.module.ts, src/main.ts, sanity test, lockfile). The CLAUDE.md §3 cap (≤300 LOC / ≤5 files) was incompatible with the very first task. Future bootstrap-class tasks (frontend scaffold, DB scaffold, e2e infra) will hit the same wall.

Document a named exception so the planner does not split a bootstrap task into unworkable fragments and does not flag itself as over-cap when the over-cap is structural.

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) §3 (current cap statement — needs the exception clause)
- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding m-1 + §3 "코드 크기 / 범위" walkthrough
- [docs/PLAN.md](../PLAN.md) (touch only if cross-reference helps; not required to edit)
- [docs/tasks/T-0001-bootstrap-stack-and-ci.md](T-0001-bootstrap-stack-and-ci.md) frontmatter (the concrete data point)

## Acceptance Criteria

- [ ] `CLAUDE.md` §3 gains a short paragraph (or sub-bullet) defining "bootstrap-class task": a task whose acceptance criteria require introducing a new stack/framework scaffold (initial NestJS/web/db/e2e scaffold) where the minimum viable diff intrinsically exceeds the cap.
- [ ] The paragraph states: (a) planner may mark such tasks with `bootstrap: true` in frontmatter, (b) for `bootstrap: true` tasks the 300 LOC / 5 file cap is advisory not enforced, (c) lockfile lines are always excluded from LOC counting, (d) such tasks must still remain atomic (one commit) and self-contained.
- [ ] The paragraph names at least one safeguard so the exception isn't abused (e.g., "bootstrap exception requires explicit ADR-referenced justification in the task's Why section").
- [ ] No code, no `.claude/`, no `src/`, no workflows touched. Only CLAUDE.md (and optionally PLAN.md if you add a one-line cross-ref).
- [ ] Direct-mode commit on `main` (or current working branch under the single-branch constraint — see T-0002).

## Out of Scope

- Re-estimating already-completed T-0001 frontmatter (history is frozen).
- Adding the `bootstrap: true` flag to any existing task file.
- Changing the cap numbers themselves (300/5).
- Any change that requires architect or new ADR.

## Suggested Sub-agents

`implementer` (CLAUDE.md edit) — no tester needed (doc-only, no code changes).

## Follow-ups

(empty)
