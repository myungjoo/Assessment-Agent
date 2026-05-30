# Race patterns — 누적 박제 (long-horizon agent 운영)

본 doc 는 Assessment-Agent driver / sub-agent 운영 중 누적 박제된 **race pattern** 을 모은다. 결정 신설 0 — observation 박제만. 결정 박제는 별도 ADR.

## §1 개요

본 doc 의 범위는 다음 6 종 race pattern 의 18+ 회차 누적 박제:

1. **gh pr merge worktree race (7 회차)** — integrator 의 `gh pr merge` 가 local exit 1 / remote SUCCESS 의 split-state 를 일으키는 패턴.
2. **reviewer-gate race-fix (7 회차)** — CI 의 reviewer comment 검증 step 이 reviewer post timing 과 race 하는 패턴 + issue_comment-triggered second run 의 main-HEAD-context 의존 박제.
3. **Windows core.autocrlf=true CRLF trap (1 회차)** — Windows Git system-scope core.autocrlf=true default 의 LF→CRLF 변환이 prettier endOfLine=lf 와 충돌하는 environment trap.
4. **Git Bash MSYS path translation trap (1 회차)** — Git Bash MSYS runtime 의 자동 POSIX→Windows path 변환이 gh API endpoint 를 invalid 화하는 trap.
5. **Harness phantom worktree (1 회차)** — Claude Code harness 가 `git worktree list` 미등록 cwd 를 주장하는 environment 환각.
6. **Cron-vs-manual /loop overlap race-condition (3 회차)** — cron driver 와 manual /loop session 의 동시 실행이 planner / executor 차원에서 충돌하는 패턴 (CLAUDE.md §10 동시 실행 정책 위반 박제).

본 doc 는 결정 신설 0 (ADR 신설 0) — observation 박제만. 다음 회차 누적 시 architect agent 가 본 doc 의 §2~§7 enumeration 을 갱신. 결정 박제 필요 시 별도 ADR (예: ADR-0009+ race-handling policy escalation).

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

## §4 Windows core.autocrlf=true CRLF trap

### 회차 enumeration

| # | task | 박제 |
| --- | --- | --- |
| 1 | T-0099 | executor 박제 — prettier entire-repo CRLF errors → local `git config core.autocrlf=false` workaround (tracked 0) → T-0100 `.gitattributes` 영구 fix 후 박제 완결 |

### 원인

- Windows Git 의 system-scope `core.autocrlf=true` default 가 checkout 시 LF→CRLF 변환을 강제.
- prettier 의 `endOfLine=lf` (v3 default) 와 충돌 — working tree 의 CRLF 가 prettier 의 lint check 를 entire-repo 규모로 fail.
- local override (`git config core.autocrlf=false`) 는 해당 clone 1 개에만 적용 — 미래 contributor / 새 clone / 새 worktree 마다 동일 trap 재발.

### 처리

1. 즉시 완화: local `git config core.autocrlf=false` workaround (T-0099 executor 박제, tracked 0 — 임시 방편).
2. 영구 fix: `.gitattributes` 에 `* text=auto eol=lf` default + explicit text/binary 확장자 enumeration (T-0100 박제 완결). `.gitattributes` 는 git 정책 우선이라 `core.autocrlf` 무관 LF 정규화 강제.
3. cross-ref: [docs/tasks/T-0100-gitattributes-eol-lf-permanent-fix.md](../tasks/T-0100-gitattributes-eol-lf-permanent-fix.md) — Windows CRLF trap 영구 fix source.

## §5 Git Bash MSYS path translation trap

### 회차 enumeration

| # | task | 박제 |
| --- | --- | --- |
| 1 | T-0098 | driver inline 박제 — `gh api -X DELETE refs/heads/<branch>` leading `/` 가 Windows path 로 자동 변환 → invalid endpoint, `MSYS_NO_PATHCONV=1` prefix 차단 후 26 외부 effect (13 PR close + 13 branch delete) 완수 |

### 원인

- Git Bash MSYS runtime 은 POSIX-style path 를 Windows path 로 자동 변환 (path translation).
- gh API endpoint 의 leading `/refs/heads/...` 가 `C:/Program Files/Git/refs/heads/...` 으로 변환되어 invalid endpoint error 발생.
- `gh api -X DELETE refs/heads/<branch>` 같은 ref-manipulation 호출이 직접적 피해 대상.

### 처리

1. `MSYS_NO_PATHCONV=1` env prefix 로 MSYS path translation 차단: `MSYS_NO_PATHCONV=1 gh api -X DELETE refs/heads/<branch>`.
2. T-0098 에서 본 prefix 로 13 branch delete (claude/affectionate-babbage-* + claude/loop-command-*) 모두 404 verify 완수 — 26 외부 effect 박제.
3. cross-ref: [docs/tasks/T-0098-stale-cron-pr-cleanup.md](../tasks/T-0098-stale-cron-pr-cleanup.md) — Git Bash MSYS 26 외부 effect 박제 source.

## §6 Harness phantom worktree

### 회차 enumeration

| # | task | 박제 |
| --- | --- | --- |
| 1 | T-0097 | driver inline 박제 — system reminder 가 `.claude/worktrees/vigilant-boyd-707106` 를 cwd 로 주장했으나 `git worktree list` 등록 0, main repo 가 directory tree parent 라 absolute path 정공법 진행 |

### 원인

- Claude Code harness 가 `.claude/worktrees/<random>` (예: `vigilant-boyd-707106`) 을 cwd 로 주장.
- `git worktree list` 에는 해당 path 가 등록되지 않음 — directory 는 빈 상태 (`.claude/` 만 존재) 의 phantom.
- agent thread 의 cwd 가 bash call 마다 reset 되는 동작과 결합되어 path 혼란 유발 가능.

### 처리

1. main repo 가 phantom worktree path 의 directory tree parent 임을 확인 — cwd reset 자체는 무해.
2. absolute path 정공법 진행 (relative path 의존 0). 모든 file 작업을 absolute path 로 수행.
3. cross-ref: [docs/tasks/T-0097-uc-04-sequence-user-response-dto-amend.md](../tasks/T-0097-uc-04-sequence-user-response-dto-amend.md) — harness phantom worktree 첫 박제 source.

## §7 Cron-vs-manual /loop overlap race-condition

### 회차 enumeration (4 회차 누적 — 1~3 회차 2026-05-30 pr-mode race-loss, 4 회차 2026-05-31 doc-only direct ff-only graceful absorb)

| # | 시각 (2026-05-30 KST) | level | 박제 |
| --- | --- | --- | --- |
| 1 | ~10:50 | planner-level | T-0101 nextTask 양쪽 동시 queue, **cron win** — cron driver 가 manual planner 보다 먼저 STATE 갱신 |
| 2 | ~11:25 | executor-level | T-0101 코드 완성 양쪽 동시 ship, **cron win** — cron PR-101 sha 432974a merged, manual PR-102 close + 76979ec cleanup, 5 파일 staged executor 작업 폐기 |
| 3 | ~11:29 | planner-level | T-0102 nextTask cron planner-only 우선 박제, **cron win** — cron 가 planner-only 차원으로 manual 발 race 흡수, manual driver 가 turn 4 에서 T-0102 자연 이어받음 |
| 4 | ~02:08 (2026-05-31 KST) | driver-level (direct-mode edit) | T-0107 동일 doc-only direct edit 양쪽 동시 수행, **cron loser** — cron 가 push 직전 fetch 로 origin 이동 (5047bcb) 감지 후 ff-only graceful 흡수 (작업 폐기 0, PR/branch cleanup 0) |

단일 manual /loop session 3 turn 연속 cron lose.

4 회차는 다른 sub-pattern — doc-only direct edit 동시 수행이 ff-only 로 무손실 흡수된 best-case (이전 3 회차 pr-mode race-loss 와 대조, §7 lesson 의 cron-safe doc-only direct 선호 실증).

### 원인

- CLAUDE.md §10 동시 실행 정책 point 3 "사용 시간대 분리" 의 실증적 위반 박제 — cron 가 KST 09:25~11:16 6 turn 연속 fire.
- estimated 평균 fire 간격 약 20 분 — §10 의 "cron 간격 ≥ 평균 task 소요시간 × 2" 의 30 분~2 시간 가이드라인 위반.
- manual /loop session 이 같은 lock / STATE 를 공유하며 substantive pr-mode task 를 시도 → race 충돌.
- 4 회차는 cron KST 02:05 fire 가 manual /loop session #29 active window (KST 01:17~02:03) 의 직후 ~5min residual 과 겹침 — §10 cron 권장 발화 시간대 (KST 02:00·14:00) 자체가 야간 manual /loop 과 충돌 가능한 구조적 overlap 박제 (4 회차 반복).

### 처리

1. manual /loop session 의 substantive pr-mode task 시도가 race 충돌 시 → 직접 작업 폐기 + cleanup 책임 (PR close + branch delete + ff sync).
2. T-0098 stale-cron-PR cleanup 패턴 1:1 mirror (직전은 13 PR + 13 branch / 본 회차는 1 PR + 1 branch).
3. **lesson**: cron 활성 중 manual /loop 는 cron-safe doc-only direct task OR cron suspend 후 진입 정공법. substantive pr-mode 시도는 race-loss 후 폐기 비용 부담.
4. **doc-only direct edit 동시 수행 race** 는 LOOP.md §4 ff-only graceful 흡수로 무손실 처리 (`git reset --soft HEAD~1` + `git stash --include-untracked` audit 보존 + `git merge --ff-only origin/main`) — PR/branch cleanup 불요 (pr-mode race 의 폐기 비용 0, 4 회차 실증).
5. cross-ref: [CLAUDE.md](../../CLAUDE.md) §10 (동시 실행 정책) + [docs/tasks/T-0098-stale-cron-pr-cleanup.md](../tasks/T-0098-stale-cron-pr-cleanup.md) (cleanup 패턴 mirror) + [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) L7 (race-condition 2 차 사례 source) + [docs/progress/journal-2026-05-31.md](../progress/journal-2026-05-31.md) L3 (4 회차 ff-only absorb source).

## §8 observed cumulative

- 7 + 7 + 1 + 1 + 1 + 4 = **21 회차 누적** (gh worktree 7 + reviewer-gate 7 + Windows CRLF 1 + Git Bash MSYS 1 + harness phantom 1 + cron-vs-manual overlap 4).
- 다음 회차 시점 update 책임 — architect agent follow-up (race 발견 추가 회차 누적 시 §2~§7 enumeration 갱신).
- **21 회차 누적 marker — ADR 신설 검토 후보** (race-handling policy escalation — 본 doc 의 observation 을 decision 으로 escalate). 특히 cron-vs-manual overlap 은 CLAUDE.md §10 동시 실행 정책 갱신 (cron 간격 권장 / 사용 시간대 분리 강화 / 강한 mutex 도입) 의 박제 source.
- **integrator agent 의 race-aware 평가 절차** — procedural source 는 [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 의 5 step 체크리스트, 본 doc 와 cross-reference 동기.
- **anti-pattern (사용 금지)**: `close+reopen` (issue_comment trigger 우회 목적의 close-then-reopen 은 PR review state reset → `gh run rerun` 사용) / `gh pr merge --force` (4-게이트 우회) / `--no-verify` (pre-commit hook 우회, CLAUDE.md §9 위반).

## §9 References

- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) L52-69 — procedural source.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) L13-16 (issue_comment trigger) + L82-115 (reviewer-gate step).
- [docs/progress/journal-2026-05-26.md](../progress/journal-2026-05-26.md) — T-0059 / T-0060 worktree race 4-5 회차 박제 source.
- [docs/progress/journal-2026-05-27.md](../progress/journal-2026-05-27.md) — T-0061 / T-0062 race-fix `gh run rerun` 첫 SUCCESS 박제 source.
- [docs/tasks/T-0100-gitattributes-eol-lf-permanent-fix.md](../tasks/T-0100-gitattributes-eol-lf-permanent-fix.md) — Windows CRLF trap 영구 fix.
- [docs/tasks/T-0098-stale-cron-pr-cleanup.md](../tasks/T-0098-stale-cron-pr-cleanup.md) — Git Bash MSYS 26 외부 effect 박제.
- [docs/tasks/T-0097-uc-04-sequence-user-response-dto-amend.md](../tasks/T-0097-uc-04-sequence-user-response-dto-amend.md) — harness phantom worktree.
- [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) — cron-vs-manual overlap 3 회차 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3.3 (4-게이트 정책) + §9 (안전장치 — `--no-verify` / force push 금지) + §10 (동시 실행 정책).
