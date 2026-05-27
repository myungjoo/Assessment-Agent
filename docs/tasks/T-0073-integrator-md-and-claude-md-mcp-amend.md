---
id: T-0073
title: integrator.md amend + CLAUDE.md §3.3/§4/§11 amend — MCP path 영구화 split 2/2 (T-0072 follow-up)
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 280
estimatedFiles: 3
created: 2026-05-27
completedAt: 2026-05-27
actualDiff: 38
actualFiles: 2
reviewRounds: 0
dependsOn: [T-0072]
parents: [ADR-0005]
plannerNote: HQ-0006/8/9/10 4 회차 cron-gh-absent 영구 fix backbone split 2/2 — ADR-0005 Tool mapping 표를 integrator.md 의 14+ gh occurrence 에 적용 + CLAUDE.md §3.3 (4-게이트 평가 도구 unified) + §4 (driver의 직접 외부 API call 예외) + §11 (trail tool 표기 stretch) 명문화.
---

# T-0073 — integrator.md amend + CLAUDE.md §3.3/§4/§11 amend (HQ 4 회차 영구 fix split 2/2)

## Why

[T-0072](T-0072-adapt-agents-to-mcp.md) 머지 (6053d76) 로 [ADR-0005](../decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) (Path A driver fallback 영구화) + [reviewer.md](../../.claude/agents/reviewer.md) amend (verdict-only return + driver MCP post + local fallback) 박제 완료. 본 task 는 split 2/2 closure — ADR-0005 의 Tool mapping 표 (15 row) 를 **integrator.md 의 14+ `gh` occurrence 에 적용** + **CLAUDE.md §3.3/§4/§11 의 명문화** 박제.

[CLAUDE.md §3.1](../../CLAUDE.md) direct-mode 정합 — `.claude/` 메타 변경 + `CLAUDE.md` 운영규칙 변경 = doc-only direct. PR / reviewer round 불요, R-110 면제 (production code 0).

REQ-057 (planner / size cap 정책 자체 박제) + REQ-058 (REST 표준 — gh / MCP unified 명세) 의 영구 fix backbone closure.

## Required Reading

- [docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md](../decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) — 본 task 의 source of truth. Tool mapping 표 15 row + Path A 영구화 의사결정 + Consequences §5 (race 평가 복잡도 mitigation 가 본 task scope).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) — 본 task 의 변경 대상. 14+ `gh` occurrence — `gh pr view / checks / create / merge`, `gh run list / watch / view --log-failed / rerun` 모두 MCP equivalent 박제 의무.
- [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) — T-0072 박제 amend (verdict-only return + Post 의무 단락 driver fallback path) 의 정합 reference.
- [CLAUDE.md §3.3](../../CLAUDE.md) — Reviewer + Committer 이중 합의 + 4-게이트 정의. 본 task 의 §3.3 amend — 4-게이트 평가 도구 unified (gh / MCP 양쪽 path 명시).
- [CLAUDE.md §4](../../CLAUDE.md) — Sub-agent dispatch + driver context 누적 방지. 본 task 의 §4 amend — "driver 의 직접 외부 API call 예외" 새 단락 신설 (sub-agent 가 verdict 만 반환, driver 가 MCP 호출).
- [CLAUDE.md §11](../../CLAUDE.md) — Commit message agent-trail 포맷. 본 task 의 §11 amend (stretch) — `INTEGRATOR:` 섹션에 `toolPath: gh|mcp` 표기 1 줄 추가.
- [docs/tasks/T-0072-adapt-agents-to-mcp.md](T-0072-adapt-agents-to-mcp.md) — split 1/2 박제. 본 task 의 직전 사전 context.

## Acceptance Criteria

### A. integrator.md amend (ADR-0005 Tool mapping 표 적용)

- [ ] `.claude/agents/integrator.md` 의 모든 `gh pr <subcommand>` / `gh run <subcommand>` / `gh api` occurrence 에 **MCP equivalent** 를 코드 블록 또는 inline 으로 박제 — 형식: ``gh ... ↔ mcp__github__...``. ADR-0005 §Tool mapping 표 15 row 의 integrator 측 14 row 그대로 적용.
- [ ] integrator 의 §Workflow A (First push) 단계 — `gh pr create` ↔ `mcp__github__create_pull_request`.
- [ ] integrator 의 §Workflow B (Review round) 단계 — `gh pr view --json comments` ↔ `mcp__github__list_issue_comments` (gate (b) 평가), `gh pr checks` ↔ `mcp__github__list_check_runs(ref=head_sha)` (gate (d) 평가).
- [ ] integrator 의 race 평가 절차 (issue_comment trigger run 식별) — `gh run list --workflow=ci.yml --branch=<branch> --limit 5` ↔ `mcp__github__list_workflow_runs(workflow_id="ci.yml", branch=<branch>, per_page=5)`. ADR-0005 Consequences §5 mitigation 의 정식 박제.
- [ ] integrator 의 머지 단계 — `gh pr merge --squash --delete-branch` ↔ `mcp__github__merge_pull_request(squash) + mcp__github__delete_branch`.
- [ ] integrator 의 CI fail 분석 — `gh run view --log-failed` ↔ `mcp__github__get_workflow_run_logs`.
- [ ] integrator 의 §Inputs 단락 — `gh pr view` / `gh pr checks` / `gh pr view --json comments` 의 MCP equivalent 명시.
- [ ] integrator.md 의 **driver fallback 책임 분담** 단락 신설 — reviewer 와 동일 패턴 (verdict / decision 만 return, driver 가 외부 API call) + local /loop (gh 가용) fallback path 박제.

### B. CLAUDE.md §3.3 amend (4-게이트 평가 도구 unified)

- [ ] CLAUDE.md §3.3 "Reviewer + Committer 이중 합의" 단락 안에 **4-게이트 평가 도구 unified** 박제 — 게이트 (a) 평가 = reviewer agent verdict, 게이트 (b) = `gh pr view --json comments` OR `mcp__github__list_issue_comments`, 게이트 (c) = integrator self-check (도구 무관), 게이트 (d) = `gh pr checks` OR `mcp__github__list_check_runs(ref=head_sha)`. ADR-0005 §Decision 의 unified 표 참조 + 한 줄 link.
- [ ] §3.3 안에 ADR-0005 ACCEPTED reference 한 단락 추가 — "본 게이트 평가는 gh / MCP path unified" 명시.

### C. CLAUDE.md §4 amend (driver의 직접 외부 API call 예외 신설)

- [ ] CLAUDE.md §4 "Sub-agent dispatch" 의 "Driver context 누적 방지 룰" 4 개 (현재 1~4) 뒤에 **5. driver 의 외부 API call 예외** 신설 — "reviewer / integrator sub-agent 가 verdict / finding 만 return 하고 driver 가 `mcp__github__add_issue_comment` / `mcp__github__merge_pull_request` 등 직접 호출하는 패턴은 ≤200 char SUMMARY 룰의 예외. 단 driver 가 raw MCP response 를 받자마자 핵심 결과 (boolean / sha / id 1~2 개) 만 남기고 즉시 discard — context 외화 의무는 driver 책임 self-enforce."
- [ ] §4 sub-agent table 의 `reviewer` row 의 "무엇을 반환" 컬럼 amend — "verdict 본문 (≤200 char SUMMARY + trail section). PR 외부 post 는 driver 가 `mcp__github__add_issue_comment` 또는 reviewer 가 직접 `gh pr comment` (local 환경 fallback) — ADR-0005 참조".
- [ ] §4 sub-agent table 의 `integrator` row 의 "무엇을 반환" 컬럼 amend — "merge decision (게이트 4/4 PASS / ANOTHER_ROUND / BLOCKED). 실 머지 action 은 driver 가 `mcp__github__merge_pull_request(squash)` + `mcp__github__delete_branch` 또는 integrator 가 직접 `gh pr merge` (local 환경 fallback)".

### D. CLAUDE.md §11 amend (trail tool 표기 stretch)

- [ ] CLAUDE.md §11 "표준 포맷" 의 `INTEGRATOR:` 섹션 명세에 `toolPath: gh|mcp` 표기 1 줄 (선택) 명시. driver 가 어느 path 로 머지했는지 trail 박제 — multi-driver collab pattern (T-0072 turn 2 의 cron MCP + local gh 합작) 의 추적 가능성.

### E. Test / 검증

- [ ] 본 task 는 doc-only direct + agent 정의 + CLAUDE.md 변경. production code 0 — R-110 면제.
- [ ] `pnpm lint && pnpm build` 통과 — `package.json` 미변경 정합 검증.
- [ ] R-112 unit test 면제 (production symbol 0 추가).

### F. 기타

- [ ] 본 task 의 frontmatter `commitMode: direct` 정합 — `.claude/` 메타 + `CLAUDE.md` 운영규칙 = direct (CLAUDE.md §3.1).
- [ ] 본 commit 본문 한국어 + agent-trail blob (CLAUDE.md §11) 표준 포맷 + IMPLEMENTER 섹션 (3 파일 amend) + TESTER 섹션 (lint/build).

## Out of Scope

- **reviewer.md 추가 amend** — T-0072 박제 유지, 본 task 변경 surface 0.
- **ADR-0005 amend** — T-0072 박제 유지, status 갱신 0.
- **Path B sub-agent MCP grant 검증** — 별도 throwaway 검증 task (ADR-0005 §Alternatives §(2) + T-0072 §Follow-ups 박제).
- **install-gh-cli-in-cron-env path** — ADR-0005 §Alternatives §(1) 회피 사유 박제 유지, 본 task 변경 surface 0.
- **CI workflow (`reviewer agent approval 검증` step) 변경** — MCP path 와 무관 (PR comment 외부 사실만 보기 때문).
- **race-patterns.md amend** — cron-vs-loop variant / 12 회차 worktree race milestone 박제는 별도 follow-up task.
- **estimate-model.md amend** — 11 회차 milestone 박제 직전 turn (T-0070), 본 task 후 12 회차 milestone refinement 별도 task.

## Suggested Sub-agents

`implementer → tester` (architect 호출 0 — ADR-0005 가 모든 의사결정 박제 완료, reviewer / integrator skip — direct-mode)

- **implementer** — A.1~A.7 (integrator.md amend) + B.1~B.2 (§3.3 amend) + C.1~C.3 (§4 amend) + D.1 (§11 amend stretch). 3 파일 staged (integrator.md + CLAUDE.md). estimate ~280 LOC / 2~3 파일.
- **tester** — E.2 (lint + build pass).

## Follow-ups

- **Path B 검증 task** — T-0072 박제 유지, 별도 throwaway.
- **race-patterns.md §8 cron-vs-loop variant + 12 회차 worktree race milestone** — T-0072 의 multi-driver collab pattern (cron MCP + local gh + parent main planner 3-way) 박제 follow-up.
- **estimate-model.md §6 15 회차 milestone refinement** — T-0066~T-0073 누적 후 multiplier 재산출.
- **multi-worktree planner stale-STATE ADR** — turn 5 lesson (session #20 turn 5) + turn 6/7 parent-write rule 정착 박제.
