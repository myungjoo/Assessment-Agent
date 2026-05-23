---
id: T-0007
title: Promote inline Jest config in package.json to jest.config.ts (deferred)
phase: P0
status: DEFERRED
commitMode: pr
estimatedDiff: 40
estimatedFiles: 2
created: 2026-05-23
plannerNote: P0 follow-up to T-0001 review m-7; intentionally deferred — schedule only after first feature task introduces setup files or mocks.
---

# T-0007 — Promote inline Jest config to `jest.config.ts` (deferred)

## Why

Reviewer finding **m-7** on PR #1: Jest configuration currently lives inline in `package.json` under the `jest` key. This is perfectly fine for the bootstrap scope (one preset, one `testRegex`, one `transform`). It becomes awkward once we need:

- `setupFilesAfterEach` / `globalSetup` for test fixtures,
- module-name mappers for path aliases,
- multiple `projects` (unit vs integration),
- typed config (autocomplete, refactor-safety).

At that point we should promote to `jest.config.ts` (or `.js`). **Not before** — premature promotion adds a file without benefit and breaks the "smallest possible bootstrap" principle the reviewer also commented on (m-1 / §3 walkthrough).

**This task is `DEFERRED`**: it sits in the backlog and is *not* scheduled by the planner. It should be auto-activated (status → `PENDING`) the first time a follow-up task needs any of the four triggers listed above. The planner that schedules that triggering task should also flip this one to `PENDING` and reorder.

References: [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding m-7.

## Required Reading

(read only when activated; do not pre-load now)

- [package.json](../../package.json) (the `jest` block to extract)
- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding m-7

## Acceptance Criteria

(applies when status becomes `PENDING`)

- [ ] `jest.config.ts` exists at repo root with a typed config (`import type { Config } from 'jest'`).
- [ ] The `jest` key is removed from `package.json`.
- [ ] All existing tests still pass (`pnpm test`).
- [ ] At least one of the four triggers (setup file, name mapper, multi-project, types) is genuinely used in the new config — otherwise this task should NOT have been activated.
- [ ] `pnpm lint`, `pnpm build` still pass.

## Out of Scope

- Adding coverage thresholds (separate task once a coverage baseline exists).
- Splitting into multiple Jest projects (do only when integration tests arrive).
- Migrating to Vitest or another runner (would need a new ADR; out of scope here).

## Activation conditions (planner directive)

Flip `status: DEFERRED` → `PENDING` and re-queue when **any** of:
1. A task needs `setupFilesAfterEach` / `globalSetup`.
2. A task needs Jest module-name mappers (e.g., TypeScript path aliases beyond what `ts-jest` handles inline).
3. Multi-project Jest setup is required (unit vs integration vs e2e separation).
4. Inline config in `package.json` exceeds ~25 lines.

Until then, leave deferred.

## Suggested Sub-agents

`implementer` (extract config, delete `jest` key) → `tester` (full suite).

## Follow-ups

(empty)
