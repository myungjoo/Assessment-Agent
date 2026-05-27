# Race patterns — 누적 박제 (long-horizon agent 운영)

본 doc 는 Assessment-Agent driver / sub-agent 운영 중 누적 박제된 **race pattern** 을 모은다. 결정 신설 0 — observation 박제만. 결정 박제는 별도 ADR.

## §1 개요

본 doc 의 범위는 다음 2 종 race pattern 의 7 회차 누적 박제:

1. **gh pr merge worktree race (7 회차)** — integrator 의 `gh pr merge` 가 local exit 1 / remote SUCCESS 의 split-state 를 일으키는 패턴.
2. **reviewer-gate race-fix (7 회차)** — CI 의 reviewer comment 검증 step 이 reviewer post timing 과 race 하는 패턴 + issue_comment-triggered second run 의 main-HEAD-context 의존 박제.

본 doc 는 결정 신설 0 (ADR 신설 0). 다음 회차 누적 시 architect agent 가 본 doc 의 §2 / §3 enumeration 을 갱신. 결정 박제 필요 시 별도 ADR (예: ADR-0009+ race-handling policy).

## §2 gh pr merge worktree race (7 회차)

### 회차 enumeration

| # | task | 박제 |
| --- | --- | --- |
| 1 | T-0048 | first explicit 박제 — race-fix dogfood 의 entry point |
| 2 | T-0056 | local exit 1 / remote merged=true |
| 3 | T-0057 | manual branch delete fallback dogfood |
| 4 | T-0059 | worktree race 4 회차 누적 (journal-2026-05-26) |
| 5 | T-0060 | worktree race 5 회차 누적 (journal-2026-05-26) |
| 6 | T-0061 | worktree race 6 회차 + issue_comment race-fix 첫 dogfood SUCCESS |
| 7 | T-0062 | worktree race 7 회차 — cumulative observation 7 회차 박제 완료 |

### 원인

- gh CLI 의 `pr merge --squash --delete-branch` 는 **두 단계**: (a) GitHub API 의 squash merge action 호출, (b) local branch delete + remote prune.
- (a) 는 GitHub 측에서 정상 수행되어 remote merge SUCCESS.
- (b) 는 worktree 가 다른 branch 에 있거나 (`HEAD detached` / `feature branch checked out elsewhere`) stale ref 가 있으면 fail.
- gh CLI 는 (b) fail 을 exit 1 로 표면화. 사용자 / agent 는 "merge 실패" 로 오인할 수 있음.

### 처리 (integrator agent procedure)

1. `gh pr merge <num> --squash --delete-branch` exit 1 → 즉시 BLOCKED 판정 금지.
2. `gh api repos/<owner>/<repo>/pulls/<num> --jq .merged` 로 merged=true 재확인.
3. true → remote 측 merge SUCCESS. 다음 step 진행.
4. remote branch 가 아직 존재하면 manual delete: `gh api -X DELETE repos/<owner>/<repo>/git/refs/heads/<branch>`.
5. STATE/journal 박제 시 `mergeMethod: gh-pr-merge-worktree-race` 같은 라벨 부착 — 다음 회차 누적 데이터 보존.

## §3 reviewer-gate race-fix (7 회차)

### 회차 enumeration

| # | task | 박제 |
| --- | --- | --- |
| 1 | T-0036 | first run reviewer-gate race — issue_comment-triggered second run green |
| 2 | T-0039 | reviewer-gate race 2 회차 |
| 3 | T-0041 | reviewer-gate race 3 회차 |
| 4 | T-0042 | reviewer-gate race 4 회차 |
| 5 | T-0044 | reviewer-gate race 5 회차 |
| 6 | T-0046 | reviewer-gate race 6 회차 |
| 7 | T-0047 | reviewer-gate race 7 회차 — T-0048 race-fix 박제 trigger |
| + | T-0061 | issue_comment trigger main-HEAD-context 의존 dogfood 3 회차 — `gh run rerun` fallback 첫 SUCCESS |

### 원인

- integrator 가 feature branch push → `pull_request` event → CI first run trigger.
- CI 의 `reviewer agent approval 검증` step ([.github/workflows/ci.yml](../../.github/workflows/ci.yml) L82-115) 은 PR 의 comments 를 조회.
- reviewer sub-agent 가 약 10-30 초 후 `gh pr comment` post — 그 전에 first run step 이 실행되면 matches 0 → exit 1 → first run fail (race).
- GitHub 의 `issue_comment: [created]` trigger 가 comment post 시 발화 → second run (event=issue_comment) 자동 실행 → comments 1+ 존재 → step pass → second run green.
- **issue_comment trigger 의 main-HEAD-context 의존** (T-0061 박제): `issue_comment` event 는 default branch (main) HEAD context 위에서 발화. feature branch 의 CI 가 안 도는 경우 발생 (workflow 정책 / GitHub event delay) → `gh run rerun <firstRunId>` ad-hoc fallback 필요.

### 처리 (integrator agent procedure)

1. reviewer sub-agent SUMMARY / COMMENT_URL 로 post 완료 fact 확인.
2. `gh run list --workflow=ci.yml --branch=<feature-branch> --limit 5` 로 event=issue_comment run 존재 확인.
3. 존재 → `gh run watch <runId>` polling (timeout 5 min) → conclusion=success 시 게이트 (d) PASS.
4. ~60 초 안에 trigger 안 되면 `gh run rerun <firstRunId>` fallback (self-heal — T-0061 SUCCESS 박제).

## §4 integrator agent 의 race-aware 평가 절차

본 doc 는 detailed elaboration. procedural source 는 [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 의 5 step 체크리스트 — 본 doc 와 cross-reference 동기.

## §5 anti-pattern (사용 금지)

- **`close+reopen`** — integrator.md §Hard rules 의 금지 패턴. issue_comment trigger 우회 목적의 close-then-reopen 은 PR review state 를 reset 하므로 사용 금지. `gh run rerun` 사용.
- **`gh pr merge --force`** — 4-게이트 우회. 사용 금지.
- **`--no-verify`** — pre-commit hook 우회. CLAUDE.md §9 의 안전장치 위반. 사용 금지.

## §6 observed cumulative

- 7 + 7 = 14 회차 누적 (T-0048 ~ T-0062 의 P3 진행 중).
- 다음 회차 시점 update 책임 — architect agent follow-up (race 발견 추가 회차 누적 시 §2 / §3 enumeration 갱신).
- 14 회차 누적 시 ADR 신설 검토 (race-handling policy 박제 — 본 doc 의 observation 을 decision 으로 escalate).

## §7 References

- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — procedural source.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) L13-16 (issue_comment trigger) + L82-115 (reviewer-gate step).
- [docs/progress/journal-2026-05-26.md](../progress/journal-2026-05-26.md) — T-0059 / T-0060 worktree race 4-5 회차 박제 source.
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — T-0061 / T-0062 race-fix `gh run rerun` 첫 SUCCESS 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3.3 (4-게이트 정책) + §9 (안전장치 — `--no-verify` / force push 금지).
