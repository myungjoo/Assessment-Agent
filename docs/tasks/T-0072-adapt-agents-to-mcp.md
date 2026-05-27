---
id: T-0072
title: adapt-agents-to-mcp 영구 fix backbone — ADR-0005 신설 + reviewer.md MCP equivalent path 박제 (HQ-0010 4 회차 영구 fix 1/2)
phase: P3
status: IN_PROGRESS
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-05-27
prNumber: 65
dependsOn: [T-0039, T-0061, T-0066, T-0071]
parents: [HQ-0006, HQ-0008, HQ-0009, HQ-0010]
plannerNote: HQ-0010 4 회차 cron-gh-absent 영구 fix backbone split 1/2 — ADR-0005 신설 + reviewer.md MCP equivalent path 박제 (Path A driver fallback 영구화).
---

# T-0072 — adapt-agents-to-mcp 영구 fix backbone (ADR-0005 신설 + reviewer.md MCP equivalent path 박제)

## Why

[HQ-0006](../STATE.json) (T-0039 / 2026-05-26 09:20) / [HQ-0008](../STATE.json) (T-0061 / 2026-05-27 12:50) / [HQ-0009](../STATE.json) (T-0066 / 2026-05-27 14:10) / [HQ-0010](../STATE.json) (T-0071 / 2026-05-27 16:05) 4 회차 모두 동일 사유 — Anthropic 클라우드 cron 발화 env 의 `gh` CLI 부재로 reviewer/integrator agent 의 4-게이트 자동 진행 차단. 매 회차 사용자 개입 + use-local-env-gh 우회 — cron backbone 의 실효 부재가 systemic 박제 완료. **영구 fix 필요**.

본 turn 의 사용자 결정: 영구 fix 채택 = **Path A (driver fallback) 영구화** — sub-agent 는 verdict + finding 만 반환, driver 가 `mcp__github__*` 외부 API call 직접 호출. T-0032 PR-31 round 3 (2026-05-25 12:35 cron #1 turn 1) 의 머지에서 driver 가 `mcp__github__add_issue_comment` + `mcp__github__merge_pull_request --squash` 로 end-to-end review-amend-merge 를 cron env 에서 이미 성공 시연 — **기술적으로는 이미 검증됨**, 영구화만 박으면 됨. install-gh-cli-in-cron-env path 회피 사유: PAT 보관 risk + 매 cron 발화 setup 비용. Path B (sub-agent 에 MCP grant) 는 Claude Code sub-agent 의 MCP server 상속 mechanism 이 본질적 unknown 이라 별도 검증 task (T-0072 Follow-ups) 로 분리.

본 task 는 영구 fix backbone 의 split 1/2 — **ADR-0005 신설 (Path A 의사결정 박제) + reviewer.md amend (MCP equivalent path 박제 + driver fallback 책임 분담)**. integrator.md amend + CLAUDE.md amend 는 후속 [T-0073](#) (본 task 머지 후 planner queue) 로 분리.

REQ-057 (planner / size cap 정책 자체 박제 — 정책 REQ) + REQ-058 (REST 표준 — gh / MCP path unified 명세) 의 영구 fix 인프라 박제.

## Required Reading

- [CLAUDE.md §3.3](../../CLAUDE.md) — Reviewer + Committer 이중 합의 (README 116행) + 4-게이트 정의 (reviewer.APPROVE + PR comment 외부 + integrator self-check + CI green) + reviewer-gate CI step 자동 검증.
- [CLAUDE.md §4](../../CLAUDE.md) — Sub-agent dispatch + driver context 누적 방지 룰 (3 단계 chain 금지, 모든 sub-agent ≤ 200 char SUMMARY + trail blob 만 반환).
- [CLAUDE.md §10](../../CLAUDE.md) — long-horizon 실행 모드 + ScheduleWakeup cron 발화 정책 + 동시 실행 정책 (race 회피).
- [CLAUDE.md §11](../../CLAUDE.md) — Commit message agent-trail 표준 포맷 (헤더 영어 / 본문 한국어).
- [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) — reviewer agent 전체. 14+ `gh pr ...` occurrence (PR diff 조회 + PR comment post + verdict 외부 박제 책임).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) — integrator agent 전체. 14+ `gh ...` occurrence (`gh pr view`, `gh pr checks`, `gh pr view --json comments`, `gh pr create`, `gh pr merge --squash --delete-branch`, `gh run list`, `gh run watch`, `gh run rerun`, `gh run view --log-failed`) — 본 task 에서는 amend 안 함 (T-0073 책임), 단 ADR-0005 의 명세에 본 path 도 포함.
- [docs/STATE.json](../STATE.json) HQ-0006 / HQ-0008 / HQ-0009 / HQ-0010 4 entry + B-0001 blocker history.
- [docs/progress/journal-2026-05-25.md](../progress/journal-2026-05-25.md) — cron #1 turn 1 T-0032 PR-31 round 3 머지의 MCP first dogfood 박제 (Path A 검증 evidence).
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — HQ-0008 / HQ-0009 / HQ-0010 dogfood 박제 + session #21 turn 1 stale-worktree cleanup pattern.
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — ADR 표준 포맷 (Context / Decision / Consequences / Alternatives).
- [docs/decisions/ADR-0004-smoke-e2e-db-mode.md](../decisions/ADR-0004-smoke-e2e-db-mode.md) — 가장 최근 ADR 형식 참고.

## Acceptance Criteria

### ADR-0005 신설

- [ ] `docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md` 신설. status: ACCEPTED. date: 2026-05-27.
- [ ] **Context 섹션** — HQ-0006/HQ-0008/HQ-0009/HQ-0010 4 회차 박제 인용 + cron backbone 실효 부재 systemic 확정 명시. T-0032 cron #1 turn 1 MCP merge 첫 dogfood evidence 한 단락. cron env 의 `which gh` exit 1 박제 + driver 가 보유한 `mcp__github__*` tool 의 가용성 박제.
- [ ] **Decision 섹션** — **Path A (driver fallback) 영구화** 명시. reviewer/integrator agent 는 verdict + finding 만 반환, driver 가 `mcp__github__*` 외부 API call 직접 호출. agent 의 모든 `gh pr|run|api` 호출에 대해 MCP equivalent 와 함께 명세 (예: `gh pr comment <num> --body <text>` ↔ `mcp__github__add_issue_comment(issue_number, body)` / `gh pr merge <num> --squash --delete-branch` ↔ `mcp__github__merge_pull_request(pull_number, merge_method="squash") + mcp__github__delete_branch` / `gh pr checks <num>` ↔ `mcp__github__list_check_runs(ref=head_sha)` 등). 본 ADR 은 mapping 자체를 표로 박제 + Path A 선택 사유 (가장 즉시 가용 / T-0032 검증) 박제.
- [ ] **Consequences 섹션** — 긍정 (cron / loop / local 어디서나 동일 동작 / gh 의존 영구 제거 / PAT 보관 risk 회피) + 부정 (driver context 에 raw MCP response 가 들어오면 누적 — CLAUDE.md §4 의 ≤200 char SUMMARY 룰을 driver 가 self-enforce 의무 / MCP server 의존 — server 불가용 시 BLOCKED) + 4-게이트 평가 도구가 gh 또는 MCP equivalent 로 unified 박제 (게이트 자체 불변).
- [ ] **Alternatives 섹션** — (1) install-gh-cli-in-cron-env (회피: PAT 보관 risk + setup 비용) (2) Path B sub-agent MCP grant (회피: Claude Code sub-agent 의 MCP server 상속 mechanism unknown, T-0032 journal 의 "본 sub-agent 환경에서 MCP add_issue_comment 미노출" 박제 — 별도 throwaway 검증 task 로 분리) (3) cron 폐기 (회피: long-horizon driver 의 핵심 인프라).
- [ ] **Tool mapping 표 박제** — `gh` command ↔ `mcp__github__*` tool mapping. 최소 reviewer 와 integrator 에서 사용되는 14+ occurrence 모두 cover. 표 형식: `gh subcommand | MCP tool | 책임 단계`.
- [ ] ADR-0005 본문 한국어 (Context / Decision / Consequences / Alternatives) — CLAUDE.md §12 정합.
- [ ] [docs/decisions/](../decisions/) 의 INDEX 파일 또는 ADR-0001~0004 와 동일 디렉토리 박제 — 별도 INDEX 부재 시 ADR 파일 자체로 충분.

### reviewer.md amend

- [ ] `.claude/agents/reviewer.md` 의 14+ `gh pr ...` occurrence 매핑 — verdict 책임은 reviewer 가 유지 (APPROVE / REQUEST_CHANGES / COMMENT) 하나, **post 의무는 driver 로 이전 박제**.
- [ ] reviewer 의 §Post 의무 (PR 외부 사실 박제) 단락 amend — "reviewer 는 verdict + finding 본문만 driver 에 return (≤200 char SUMMARY + 자기 trail section). driver 가 `mcp__github__add_issue_comment` 으로 PR 에 post 책임". 단 local /loop 환경 (gh 가용) 에서는 reviewer 가 직접 `gh pr comment` 호출 가능 — fallback path 박제 (CLAUDE.md §3.3 게이트 #2 외부 사실은 어느 path 든 결과만 보면 됨).
- [ ] reviewer.md frontmatter `tools:` 박제 그대로 (sub-agent MCP grant 는 Path B / T-0072 Follow-ups, 본 task 안에서 변경 안 함).
- [ ] reviewer.md 본문 한국어 정합 — 명령어 / `gh` / `mcp__github__*` 토큰은 영어 유지, 본문은 한국어 (CLAUDE.md §12).
- [ ] 4-게이트 평가 procedure (CLAUDE.md §3.3) 가 MCP path 로도 동일하게 작동함을 reviewer.md §Post 의무 단락에 명시 — driver fallback 후에도 게이트 #2 (PR comment 외부 존재) 충족 박제.

### Test / 검증

- [ ] 본 task 는 doc-only + agent 정의 변경. production code 0 변경 — R-110 ([README 110행](../../README.md)) 의 `pnpm test` 면제 (코드 부재).
- [ ] 단 `pnpm lint && pnpm build` 는 실행 — `package.json` 미변경 정합 검증. R-112 4 카테고리 unit test 면제 (production symbol 0 추가).
- [ ] **MCP path dogfood 의무** — 본 PR 의 reviewer round 1 + 4-게이트 평가 자체를 MCP path (driver fallback) 로 진행 = 본 task 의 dogfood. driver 가 `mcp__github__add_issue_comment` (verdict post) + `mcp__github__merge_pull_request` (게이트 4 통과 후 squash merge) 호출. T-0032 패턴 재확인 + 영구화 첫 박제.
- [ ] CI workflow (`.github/workflows/ci.yml`) 의 `reviewer agent approval 검증` step 미변경 — PR comment 외부 사실만 보기 때문에 gh / MCP path 어느 쪽이든 통과 정합.

### 기타

- [ ] 본 task 의 frontmatter `commitMode: pr` 정합 — 새 ADR 신설 + agent 정의 변경 = pr-mode (CLAUDE.md §3.1).
- [ ] PR 본문 한국어, agent-trail blob (CLAUDE.md §11) 표준 포맷 + ARCHITECT 섹션 (ADR-0005 link) + IMPLEMENTER 섹션 (2 파일 변경) + REVIEWER + INTEGRATOR (MCP path dogfood 명시).

## Out of Scope

- **install-gh-cli-in-cron-env path** (PAT 관리 risk 영구 회피, ADR-0005 의 Alternatives 에 회피 사유만 명시 — 본 task 의 변경 surface 0).
- **sub-agent 에 MCP grant 의 실 mechanism 검증** (Path B) — Claude Code sub-agent 의 MCP server 상속 mechanism 이 본질적 unknown, 별도 throwaway 검증 task 로 분리 (Follow-ups 명시).
- **integrator.md amend** — 14+ `gh ...` occurrence (`gh pr view / checks / merge / view --json comments`, `gh run list / watch / rerun / view --log-failed` 등) 의 MCP equivalent 박제 + 4-게이트 procedure 명세 — 후속 [T-0073](#) 별도 task. 본 task 의 ADR-0005 Tool mapping 표 안에는 포함되나 integrator.md 자체 amend 는 미수행.
- **CLAUDE.md §4 amend** — "driver 의 직접 외부 API call 예외" 새 단락 (T-0032 패턴 영구화) — 후속 [T-0073](#) 별도 task. 본 task 의 ADR-0005 Consequences 에는 결정 사실 박제하나 CLAUDE.md 자체 amend 는 미수행.
- **CLAUDE.md §3.3 amend** — 4-게이트 평가 도구 unified 명세 — 후속 T-0073.
- **CLAUDE.md §11 amend** — agent-trail blob 의 `tool: gh|mcp` 표기 1 줄 (선택, T-0073 의 stretch goal).
- **CI workflow (`reviewer agent approval 검증` step) 자체 변경** — MCP path 와 무관 (PR comment 외부 사실만 보기 때문).
- **이전 PR / 머지 history 의 retroactive 박제** — T-0032 의 PR comment / merge 가 이미 MCP path 였음을 ADR Context 에만 한 줄 인용.
- **package.json / dependency 추가 / removal** — agent 정의 변경 only.

## Suggested Sub-agents

`architect → implementer → tester → reviewer → integrator`

- **architect** — ADR-0005 작성 (Context / Decision / Consequences / Alternatives + Tool mapping 표). HQ-0006/8/9/10 4 회차 history + T-0032 evidence 박제. Path A 영구화 의사결정 박제 + Path B + install-gh-cli 회피 사유.
- **implementer** — reviewer.md amend (Post 의무 단락 driver fallback path 박제 + MCP equivalent occurrence 매핑). frontmatter `tools:` 미변경. 2 파일 staged (ADR-0005 신설 + reviewer.md amend).
- **tester** — lint + build pass 검증 (production code 0, R-112 unit test 면제). MCP path dogfood 는 integrator 가 reviewer round 1 + 4-게이트 평가 시 driver 가 호출.
- **reviewer** — round 1 PR diff 8-check ([README 117-128](../../README.md)) + 본 ADR 의사결정 정당성 검증 + reviewer.md amend 본문 의미 정확성 + frontmatter `tools:` 미변경 확인. **verdict 만 driver 에 return** — driver 가 `mcp__github__add_issue_comment` 으로 외부 post (본 task 의 첫 dogfood).
- **integrator** — 4-게이트 평가 (a APPROVE / b PR comment 외부 / c integrator self-check / d CI green) + 게이트 통과 시 driver 가 `mcp__github__merge_pull_request(squash)` + `mcp__github__delete_branch` 호출 (본 task 의 머지 자체가 MCP path 영구화 dogfood).

## Follow-ups

- **T-0073 — integrator.md amend + CLAUDE.md §3.3/§4/§11 amend (HQ-0010 4 회차 영구 fix 2/2)** — 본 task 머지 후 planner queue. ADR-0005 의 Tool mapping 표 + driver fallback 패턴을 integrator.md 의 14+ `gh ...` occurrence 에 적용 + CLAUDE.md §4 "driver 의 직접 외부 API call 예외" 신설 + §3.3 4-게이트 평가 도구 unified 명세 + §11 trail blob `tool: gh|mcp` 표기 (stretch). estimate ~280 LOC (integrator amend ~200 + CLAUDE.md amend ~80) / 2~3 파일.
- **Path B 검증 task (별도 throwaway, frontmatter status SCRATCH)** — reviewer.md frontmatter `tools:` 에 `mcp__github__add_issue_comment` 추가 + cron throwaway invocation 으로 sub-agent 의 MCP tool access 작동 여부 검증. 작동 시 reviewer 가 직접 post 가능 → Path A driver fallback 책임 일부 제거 가능. T-0032 journal 의 "본 sub-agent 환경에서 MCP add_issue_comment 미노출" 박제가 이미 부정 evidence — Path B 무효 가능성 높음, 단 mechanism 확정은 별도 검증 필요.
- **cron env 의 `which gh` 결과 박제용 reconnaissance** — 미래 setup script 가능성 평가 (HQ 4 회차 박제 후 가설 0 — cron env 자체에 gh 설치 여부, 권한, GitHub Actions runner image 변경 가능성 등). doc-only.
- **estimate model multiplier 갱신** — 4 회차 cron BLOCKED 의 평균 turn-loss 박제 (~1.5 turn / BLOCKED). [docs/architecture/estimate-model.md](../architecture/estimate-model.md) §6 milestone row 추가.
- **race-patterns.md §8 cron-vs-loop variant 박제** — cron BLOCKED + local /loop unblock 4 회차 dogfood 패턴 박제. ADR-0005 의 Consequences 에서 한 줄 참조 가능.
