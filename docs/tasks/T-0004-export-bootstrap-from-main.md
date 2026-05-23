---
id: T-0004
title: Refactor src/main.ts to export bootstrap() and cover with test
phase: P0
status: SUPERSEDED
commitMode: pr
estimatedDiff: 60
estimatedFiles: 3
created: 2026-05-23
supersededAt: 2026-05-23T11:45:00Z
supersededBy: "PR #1 round 1 (commit to follow on branch claude/assessment-agent-long-horizon-t2xNF)"
supersededReason: "CLAUDE.md §3.2 (reviewer-round consensus rule, added 2026-05-23) requires findings to be resolved in the same PR rather than split into separate PRs. m-2 was small enough to fix in round 1 of PR #1."
plannerNote: P0 follow-up to T-0001 review m-2; current sanity test bypasses main.ts entry; export bootstrap() so test covers real entry path.
---

# T-0004 — Export bootstrap() from src/main.ts and cover with test

## Why

Reviewer finding **m-2** on PR #1: `test/sanity.spec.ts` calls `NestFactory.createApplicationContext(AppModule)` directly. This proves the DI graph composes but **does not exercise `src/main.ts`** — the actual production entry point. If `main.ts` later grows real responsibilities (logger setup, env validation, global pipes, `app.listen()`), regressions there will not be caught by the sanity suite.

Refactor `src/main.ts` so the NestFactory wiring lives in an exported `bootstrap()` function, and the IIFE / module-load side-effect only invokes it. Add a test that imports and calls `bootstrap()` (or its testable variant) to lock the entry path under coverage *before* it grows.

## Required Reading

- [src/main.ts](../../src/main.ts) (current IIFE)
- [src/app.module.ts](../../src/app.module.ts) (root module — should not need changes)
- [test/sanity.spec.ts](../../test/sanity.spec.ts) (existing test — pattern to extend)
- [docs/progress/details/T-0001-review-round-0.md](../progress/details/T-0001-review-round-0.md) Finding m-2 + §5 "미래 영향 감지"
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (NestJS choice context only — no decisions need amending)

## Acceptance Criteria

- [ ] `src/main.ts` exports a named async function `bootstrap()` that constructs the Nest application and (when called as entry) starts listening. The module-load side-effect (the existing IIFE) only runs `bootstrap()` when the module is executed as the entry point — guard with a check such as `if (require.main === module)` or equivalent.
- [ ] `bootstrap()` returns the constructed `INestApplication` (or context) so a test can assert on it and dispose it cleanly.
- [ ] A new test (extend `test/sanity.spec.ts` or add `test/main.spec.ts`) imports `bootstrap` and asserts it resolves to a non-null Nest application object, then closes it. Listening port is **not** opened during the test (use `createApplicationContext` inside `bootstrap()` for non-HTTP path, or mock `listen`, or skip `listen` when invoked from test). Document the approach in a short comment in `main.ts`.
- [ ] `pnpm test` passes locally; total test count increases by at least 1 (or an existing test is replaced with a stronger one of equivalent count).
- [ ] `pnpm build` and `pnpm lint` still pass.
- [ ] Diff stays ≤ 100 LOC total across `src/main.ts` + the test file.

## Out of Scope

- Introducing a real HTTP supertest (that's P1).
- Adding global pipes / filters / interceptors (separate task — keep this purely structural).
- Logger or env validation (out of scope until ADR for logging stack).
- Any new dependency.

## Suggested Sub-agents

`implementer` (refactor `main.ts` + write the test) → `tester` (run `pnpm lint`, `pnpm build`, `pnpm test`; verify count delta).

## Follow-ups

(empty)
