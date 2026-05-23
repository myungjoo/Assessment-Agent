---
id: T-0009
title: ADR — sub-agent MCP tool exposure pattern (driver-does-MCP)
phase: P0
status: PENDING
commitMode: pr
estimatedDiff: 90
estimatedFiles: 1
created: 2026-05-23
plannerNote: P0 follow-up to Q-0001 fallout; formalize "driver does MCP, sub-agents take file-path inputs" as an ADR so the pattern is not re-derived each turn.
---

# T-0009 — ADR: sub-agent MCP tool exposure pattern ("driver does MCP")

## Why

`STATE.humanQuestions` entry **Q-0001** (resolved 2026-05-23T10:46:40Z) revealed that the `integrator` sub-agent cannot directly call `mcp__github__*` tools — those MCP integrations are exposed to the driver / main conversation, and the current Claude Code sub-agent configuration in `.claude/agents/` does not propagate them. Resolution option (b) was adopted on the fly: the **driver itself** calls `mcp__github__create_pull_request`, then dispatches the `reviewer` sub-agent with the diff written to a file path the sub-agent can `Read`.

That ad-hoc resolution worked, but the underlying question is open: *what is the durable rule for MCP tool access from sub-agents?* If we leave it implicit, the next sub-agent that needs GitHub / Confluence / LLM-provider MCP calls will rediscover the same blocker, and the next driver may improvise differently.

This task writes an ADR that picks one of:

- **(A) Driver-does-MCP, sub-agents get file-path inputs.** Sub-agents are pure: input is a file path (or short prompt), output is SUMMARY + TRAIL + optional file. Driver handles all external API/MCP calls. Matches CLAUDE.md §4 context-minimization spirit.
- **(B) Investigate Claude Code sub-agent tool-loading semantics and propagate MCP tools to specific sub-agents** (e.g., integrator, architect for WebFetch). Requires `.claude/agents/<role>.md` schema work + verification.
- **(C) Hybrid:** driver does write/state-changing MCP calls (PR open, merge); read-only MCP (status fetch, diff fetch) is delegated to sub-agents.

The expected verdict is **(A)** — it preserves the §4 context boundary (sub-agents never grow MCP-tool conversation surface), keeps secret-bearing tool channels on a single trusted actor (driver), and avoids the unresolved Claude Code question. But the ADR should document why (B) and (C) were rejected.

References: STATE.json humanQuestions Q-0001; CLAUDE.md §4 dispatch table; PR #1 reviewer dispatch using diff-via-file-path.

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) §4 (sub-agent dispatch table — the rule being refined)
- [CLAUDE.md](../../CLAUDE.md) §8 (tool use — MCP/WebFetch lines)
- [docs/STATE.json](../STATE.json) `humanQuestions[0]` (Q-0001 + resolution text — the concrete event)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (template / format)
- `.claude/agents/integrator.md` and `.claude/agents/reviewer.md` if they exist (current tool declarations; read only to confirm what is and isn't declared — do not modify in this task)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0003-subagent-mcp-exposure.md` exists with `status: ACCEPTED`, date, deciders, refs (Q-0001, CLAUDE.md §4).
- [ ] ADR Context section reproduces the Q-0001 event briefly and names the three alternatives (A/B/C) above.
- [ ] ADR Decision picks one alternative explicitly and justifies in ≤ 5 bullets.
- [ ] ADR Consequences enumerates: (i) what the driver MUST now do (e.g., owns all `mcp__github__*` calls for PR open / merge / comment), (ii) what sub-agents MUST NOT do, (iii) what fields the driver passes to sub-agents as file paths (diff path, comment path, etc.), (iv) what the follow-up CLAUDE.md §4 / §8 amendment will need to say (without performing that amendment in this task — that is a separate direct-mode task).
- [ ] ADR Compliance section explicitly states the new ADR supersedes the implicit Q-0001 resolution, and cross-references the resolved Q-0001 entry.
- [ ] No edit to CLAUDE.md, no edit to `.claude/agents/*`, no edit to STATE.json (other than what driver's normal post-task bookkeeping does). Those follow as separate direct-mode tasks.
- [ ] `pnpm lint`, `pnpm build`, `pnpm test` still pass (no code change expected; sanity verify).

## Out of Scope

- Editing `.claude/agents/<role>.md` to add tool declarations (separate task if alternative B or C had been picked; under expected (A) there is nothing to edit).
- Editing CLAUDE.md §4 / §8 (separate direct-mode follow-up after ADR-0003 ACCEPTED).
- Implementing a generic "driver passes blob via file path" helper utility in `src/` (premature — wait until 2nd sub-agent invocation pattern).
- Confluence MCP, LLM MCP — same pattern will apply by extension; out of scope for this ADR's text.

## Suggested Sub-agents

`architect` (write ADR-0003) → `tester` (no code; just verify markdown renders and `pnpm lint && pnpm build && pnpm test` still pass).

## Follow-ups

(empty — sub-agents append; expected follow-ups: CLAUDE.md §4/§8 amendment task once ADR ACCEPTED; equivalent ADR for Confluence/LLM MCP when those integrations land in P3)
