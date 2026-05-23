---
id: T-0006
title: Move tsconfig include into tsconfig.build.json (clean up override reliance)
phase: P0
status: SUPERSEDED
commitMode: pr
estimatedDiff: 20
estimatedFiles: 2
created: 2026-05-23
supersededAt: 2026-05-23T11:45:00Z
supersededBy: "PR #1 round 1 (commit to follow on branch claude/assessment-agent-long-horizon-t2xNF)"
supersededReason: "CLAUDE.md §3.2 reviewer-round consensus rule requires same-PR resolution. m-5 fixed by narrowing tsconfig.build.json to include only src/**/* in round 1 of PR #1."
plannerNote: P0 follow-up to T-0001 review m-5; tsconfig.json includes test/**/* and tsconfig.build.json only excludes; cleaner to scope include in build config.
---

# T-0006 — Move tsconfig `include` into `tsconfig.build.json`

## Why

Reviewer finding **m-5** on PR #1: `tsconfig.json` currently has `include: ["src/**/*", "test/**/*"]` and `tsconfig.build.json` only overrides `exclude` to drop `test/**/*`. Build correctness therefore depends on a reader knowing that TypeScript extension semantics let `exclude` override an inherited `include`. The behavior is correct but fragile and non-obvious; a future editor of either file can break the build by reordering or adding a glob.

Cleaner: have the base `tsconfig.json` carry only what is universally needed for editor / lint / test (which can include `test/**/*`), and let `tsconfig.build.json` *narrow* `include` to just `src/**/*` rather than rely on `exclude` override gymnastics. This makes intent explicit at the build-config level.

References: [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding m-5.

## Required Reading

- [tsconfig.json](../../tsconfig.json) (current base config)
- [tsconfig.build.json](../../tsconfig.build.json) (current build override — uses `exclude`)
- [package.json](../../package.json) (only the `scripts.build` line — confirms which config the build uses)
- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding m-5

## Acceptance Criteria

- [ ] `tsconfig.build.json` carries an explicit `include` (or `files`) that restricts compilation to `src/**/*` only.
- [ ] `tsconfig.build.json` no longer relies on overriding an inherited `exclude` to drop tests (i.e., the `exclude` line for `test/**/*` may be removed if the new `include` makes it redundant — choose the form that needs the fewest cross-config assumptions).
- [ ] `tsconfig.json` (base) still resolves correctly for editor tooling, `ts-jest`, and `pnpm lint` (which references TS files in both `src/` and `test/`).
- [ ] `pnpm build` continues to emit only `src/**/*` artifacts into `dist/` — no `test/**/*` compiled output appears under `dist/`.
- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass locally.
- [ ] Diff stays ≤ 20 LOC across the two tsconfig files.

## Out of Scope

- Switching to project references (`composite: true`, `references: [...]`) — separate larger refactor.
- Enabling stricter compiler options (`noUncheckedIndexedAccess`, etc.) — separate task.
- Touching `.eslintrc.cjs` or its `parserOptions.project` (that is finding m-6, deferred).
- Any change to `package.json` scripts.

## Suggested Sub-agents

`implementer` (edit the two tsconfig files) → `tester` (run `pnpm lint && pnpm build && pnpm test` and inspect `dist/` to confirm no test artifacts).

## Follow-ups

(empty — sub-agents append here)
