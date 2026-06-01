---
id: T-0130
title: "LOOP.md gh→MCP 도구 병기 + cron MCP probe/degradation 명세 (ADR-0010 반영)"
phase: P3
status: DONE
completedAt: 2026-06-01T13:52:00+09:00
actualFiles: 1
commitMode: direct
coversReq: []
estimatedDiff: 60
estimatedFiles: 1
created: 2026-06-01
dependsOn: [T-0129]
plannerNote: "ADR-0010 operationalization — LOOP.md §1 의 gh 명령(gh pr view / gh run list)에 GitHub MCP 대안 병기 + §1[4] pr-mode 분기에 cron gh/MCP probe + 둘다 부재 시 graceful degradation(pr-mode 미claim, no-op 종료, BLOCKED 양산 금지) + §3 cron prompt 에 reminder. doc-only direct."
---

# T-0130 — LOOP.md gh→MCP 병기 + cron MCP probe/degradation 명세

## Why

[ADR-0010](../decisions/ADR-0010-cron-github-mcp-pr-mode.md)(ACCEPTED) 을 라이브 driver prompt 에 반영. 현 [LOOP.md](../LOOP.md) §1 은 PR 연산을 `gh` 명령으로만 서술해 cron 클라우드(gh 부재)에서 막힌다. 본 task 가 (1) gh 명령에 GitHub MCP 대안을 병기하고, (2) §1[4] pr-mode 분기에 **cron gh/MCP probe + 둘 다 부재 시 graceful degradation**(pr-mode 미claim, no-op 종료, BLOCKED·stale PR 양산 금지)을 박는다. doc-only direct.

## Required Reading

- `docs/tasks/T-0130-loop-gh-mcp-parity-cron-probe.md` (본 파일)
- `docs/decisions/ADR-0010-cron-github-mcp-pr-mode.md` — 반영할 결정(도구 매핑 + probe + degradation)
- `docs/LOOP.md` §1 [2](resume) / [4](commit mode) / [5](CI) + §3(cron) — 편집 대상

## Acceptance Criteria

- [ ] **§1 [2] resume** — `gh pr view N` 에 `또는 mcp__github__get_pull_request` 병기.
- [ ] **§1 [4] pr-mode 분기** — integrator 호출 전 cron 인 경우 gh/MCP 가용성 probe 명시. gh·MCP 둘 다 부재면 **pr-mode task claim 취소(lock 해제) + no-op 종료**(BLOCKED 아님, stale PR 생성 금지) — ADR-0010 결정 (2)(3). PR 연산 도구 매핑(open/comment/merge/delete)은 ADR-0010 참조 cross-ref.
- [ ] **§1 [5] CI 검증** — `gh run list` 에 `또는 mcp__github__list_check_runs(ref=head_sha)` 병기. gh/MCP 둘 다 부재(cron) 시 CI 확인을 다음 turn 으로 위임(BLOCKED 아님).
- [ ] **§3 cron prompt** — routine prompt 예시에 "pr-mode 는 gh/MCP probe 후, 둘 다 없으면 direct 우선/stand down(ADR-0010)" reminder 1줄.
- [ ] 편집은 `docs/LOOP.md` 1 파일. src/ test/ 변경 0.
- [ ] ADR-0010 / ADR-0009(T-0127 반영본) 서술과 정합.

## Out of Scope

- **cron probe 헬퍼 스크립트 / 실제 분기 코드** — 본 task 는 prompt 문서화만.
- **ref-CAS lock 동작 검증 스크립트/CI** — 별도 task(T-0131 후보, pr-mode).
- **production code 변경** — 0.

## Suggested Sub-agents

driver inline (doc-only direct).

## Follow-ups

- (planner 예약) ref-CAS lock 동작 검증 스크립트/CI (선택, pr-mode).
