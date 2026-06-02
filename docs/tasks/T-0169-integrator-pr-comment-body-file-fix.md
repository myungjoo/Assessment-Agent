---
id: T-0169
title: integrator.md PR comment posting 을 --body-file 로 명문화 (@- heredoc 버그 차단)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 18
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 process-debt — integrator @- heredoc 버그(PR-154 approval-gate CI fail + PR-155 driver 수동개입) 를 --body-file 박제로 영구 차단. dependency-free, real value.
---

# T-0169 — integrator.md PR comment posting 을 --body-file 로 명문화 (@- heredoc 버그 차단)

## Why

PR-154 에서 integrator 가 reviewer comment 를 `gh pr comment --body @-` (heredoc 이 stdin 에 연결 안 됨) 로 post 하여 literal `@-` 가 박제됐고, CI 의 `reviewer agent approval 검증` step (approval gate) 이 1 회 fail 한 뒤 재post+rerun 으로 자가치유했다. PR-155 에서는 driver 가 이를 막기 위해 integrator 에게 `--body-file` 사용을 수동으로 지시해야 했다 — 즉 driver 가 매번 기억해야 하는 의존이 생겼다. `.claude/agents/integrator.md` 에 comment-posting 시 `--body-file <tempfile>` (또는 `--body "<inline>"`) 사용을 명문화하고 검증 step 을 추가하면 이 반복 실패와 driver 의존이 영구히 제거된다. (CLAUDE.md §0/§3.1 운영규칙 정비 — direct meta 변경.)

## Required Reading

- `D:\Assessment-Agent\.claude\agents\integrator.md` — 특히 line 88 (게이트 (c) self-finding post) 와 line 134~136 (local /loop fallback path)
- `D:\Assessment-Agent\.claude\agents\reviewer.md` line 90 / 127 — 이미 `gh pr comment <num> --body-file <path>` 를 올바르게 쓰는 reference convention (integrator 를 이에 정합)

## Acceptance Criteria

- [ ] integrator.md 의 `gh pr comment` 를 사용하는 모든 comment-posting 지시 (최소 line 88 게이트 (c) self-finding post, 그리고 local /loop fallback path 의 comment post 언급) 가 **반드시 `gh pr comment <num> --body-file <tempfile>`** (또는 짧은 단일 줄이면 `--body "<inline>"`) 을 쓰도록 명시. **`--body @-` / heredoc-to-stdin 패턴 금지** 를 명문으로 기재.
- [ ] comment post 직후 **post 된 comment body 검증 step** 추가 — `gh pr view <num> --json comments` (또는 MCP `mcp__github__list_issue_comments`) 로 최신 comment 가 의도한 body 인지 (literal `@-` / 빈 body 가 아닌지) 확인하고, 불일치 시 재post 하라는 지시.
- [ ] **사유 note 1~2 줄** 을 integrator.md 의 해당 절 근처에 박제 — "PR-154 incident: `--body @-` heredoc 미연결로 literal `@-` post → approval-gate CI 1 회 fail. `--body-file` 로 차단." (한국어, §12 정합).
- [ ] reviewer.md 와의 convention 정합 확인 — reviewer.md 가 이미 `--body-file` 을 쓰므로 integrator.md 도 동일 패턴이어야 함을 inline 으로 1 줄 명시 (cross-reference).
- [ ] 변경 범위가 `.claude/agents/integrator.md` 단일 파일 (direct mode, 코드/test/CI/dependency 무변경) 임을 유지 — diff ≤ 30 LOC.

## Out of Scope

- `reviewer.md` 수정 (이미 `--body-file` 사용 — 변경 불요).
- `.github/workflows/ci.yml` 의 approval-gate step 로직 변경 (별도 주제).
- production code (`src/`), test, dependency manifest 변경 — 본 task 는 순수 meta 문서 정비.
- integrator 의 다른 워크플로우 (merge / 4-게이트 / round loop) 재설계 — comment-posting 방식만.

## Suggested Sub-agents

direct-mode meta 변경 — sub-agent dispatch 불요. driver 가 직접 Edit 후 main 에 direct commit.

## Follow-ups

(비어 있음 — 작업 중 관련 항목 발견 시 여기에 추가)
