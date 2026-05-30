---
id: T-0103
title: race-patterns.md amend — 4 신규 race pattern 박제 (Windows CRLF / Git Bash MSYS / harness phantom worktree / cron-vs-manual overlap)
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 130
estimatedFiles: 1
actualDiff: 99
actualFiles: 1
created: 2026-05-30
completedAt: 2026-05-30T13:12:00+09:00
driverNote: loop session #28 turn 1 — executor 경유 race-patterns.md amend (4 신규 race pattern §4~§7 + §8 20 회차 누적 + §9 refs, 9 section), direct main commit. (task 는 driver-inline 권장이었으나 executor dispatch 진행 — 결과 동일)
dependsOn: []
plannerNote: doc-only inline-amend × 0.4 — race-patterns.md (현재 95 줄, 2 종 14 회차 박제) 에 4 신규 race pattern §4~§7 추가 (cron-vs-manual overlap 3 회차 누적 = TODAY 박제, externalize 우선)
---

# T-0103 — race-patterns.md amend (4 신규 race pattern 박제)

## Why

`docs/architecture/race-patterns.md` 는 현재 95 줄 / 2 종 race pattern (§2 gh pr merge worktree race 7 회차 + §3 reviewer-gate race-fix 7 회차) **14 회차 누적 박제** snapshot. session #25~#27 + manual /loop session (turn 1~5) 동안 **4 신규 race pattern** 누적:

1. **Windows core.autocrlf=true CRLF trap** (T-0099 executor 박제 직전 발화 — prettier entire-repo CRLF errors, local `git config core.autocrlf=false` workaround, T-0100 `.gitattributes` 영구 fix 후 박제 완결).
2. **Git Bash MSYS path translation trap** (T-0098 driver inline 박제 — `gh api -X DELETE refs/heads/<branch>` 의 leading `/` 가 `C:/Program Files/Git/repos/...` 으로 자동 변환되어 invalid endpoint, `MSYS_NO_PATHCONV=1` env prefix 차단).
3. **Harness phantom worktree** (T-0097 driver inline 박제 — system reminder 가 `.claude/worktrees/vigilant-boyd-707106` 를 cwd 로 주장했으나 `git worktree list` 등록 0, main repo 가 directory tree parent 라 absolute path 정공법 진행).
4. **Cron-vs-manual /loop overlap race-condition 3 회차 누적** (TODAY manual /loop session 박제, **가장 신선한 데이터**): turn 1 planner-level race (T-0101 nextTask 동시 queue 양쪽, cron win) + turn 2 executor-level race (T-0101 코드 완성 양쪽 동시 ship → PR-102 close + 76979ec cleanup, cron win) + turn 3 planner-level race (similar to turn 1, cron win). 단일 manual session 3 turn 연속 cron lose. CLAUDE.md §10 동시 실행 정책 point 3 "사용 시간대 분리" 의 실증적 위반 박제 — cron 가 KST 09:25~11:16 6 turn 연속 fire (estimated 평균 fire 간격 약 20 분, §10 의 cron 간격 ≥ 평균 task 소요시간 × 2 의 30 분~2 시간 가이드라인 위반).

본 task 는 race-patterns.md 에 §4~§7 신규 section 4 종 추가 + §6 observed cumulative (현 14 회차 → 18 회차 누적) + §7 References 갱신. doc-only direct inline-amend ~130 LOC / 1 파일. **externalize 우선순위 최고** — TODAY 박제 transcript 가 다음 cron fire / 다음 manual session 으로 fade 하기 전 박제.

## Required Reading

- `docs/architecture/race-patterns.md` (현재 95 줄 — §1 개요 / §2 gh pr merge worktree race / §3 reviewer-gate race-fix / §4 integrator agent procedure / §5 anti-pattern / §6 observed cumulative / §7 References)
- `docs/progress/journal-2026-05-30.md` L3 (turn 4 T-0102 DONE), L5 (turn 10 planner T-0102 queue + parallel manual /loop session race-condition 2 차 박제), L7 (turn 2 race-condition 2 차 사례 T-0101 PR-102 cleanup), L21 (turn 3 T-0098 DONE Git Bash MSYS 박제), L25 (turn 1 T-0097 DONE harness phantom worktree 박제)
- `docs/tasks/T-0100-gitattributes-eol-lf-permanent-fix.md` (Windows core.autocrlf=true CRLF trap 영구 fix 박제 source)
- `CLAUDE.md` §10 (동시 실행 정책 5 rule — race 회피 정책)

## Acceptance Criteria

A. `docs/architecture/race-patterns.md` §1 개요 갱신 — "2 종 race pattern 의 14 회차" → "6 종 race pattern 의 18+ 회차 누적 박제" + enumeration list 4 종 추가 (Windows CRLF / Git Bash MSYS / harness phantom worktree / cron-vs-manual overlap).

B. `docs/architecture/race-patterns.md` 에 신규 §4 `Windows core.autocrlf=true CRLF trap` 추가 — 회차 enumeration (T-0099 executor 1 회차) + 원인 (Windows Git system-scope core.autocrlf=true default 가 LF→CRLF 변환, prettier endOfLine=lf 와 충돌) + 처리 (local `git config core.autocrlf=false` workaround → `.gitattributes` 영구 fix T-0100 박제 완결) + cross-ref T-0100.

C. `docs/architecture/race-patterns.md` 에 신규 §5 `Git Bash MSYS path translation trap` 추가 — 회차 enumeration (T-0098 driver inline 1 회차) + 원인 (Git Bash MSYS runtime 의 자동 POSIX→Windows path 변환, leading `/refs/heads/...` 가 `C:/Program Files/Git/refs/heads/...` 으로 변환되어 gh API endpoint invalid) + 처리 (`MSYS_NO_PATHCONV=1` env prefix 차단) + cross-ref T-0098 26 외부 effect.

D. `docs/architecture/race-patterns.md` 에 신규 §6 `Harness phantom worktree` 추가 — 회차 enumeration (T-0097 driver inline 1 회차) + 원인 (Claude Code harness 가 `.claude/worktrees/<random>` 을 cwd 로 주장하나 `git worktree list` 등록 0, directory 빈 상태) + 처리 (main repo 가 directory tree parent 확인 후 absolute path 정공법, cwd reset 자체 무해) + cross-ref T-0097.

E. `docs/architecture/race-patterns.md` 에 신규 §7 `Cron-vs-manual /loop overlap race-condition` 추가 — 회차 enumeration table (3 회차 = TODAY 박제):
   - 1 회차: 2026-05-30 KST ~10:50 planner-level — T-0101 nextTask 양쪽 동시 queue, cron win (cron driver 가 manual planner 보다 먼저 STATE 갱신)
   - 2 회차: 2026-05-30 KST ~11:25 executor-level — T-0101 코드 완성 양쪽 동시 ship, cron win (cron PR-101 sha 432974a merged, manual PR-102 close + 76979ec cleanup, 5 파일 staged executor 작업 폐기)
   - 3 회차: 2026-05-30 KST ~11:29 planner-level — T-0102 nextTask cron planner-only 우선 박제 (cron 가 planner-only 차원으로 manual 발 race 흡수, manual driver 가 turn 4 에서 T-0102 자연 이어받음)
   + 원인 (CLAUDE.md §10 point 3 "사용 시간대 분리" 위반 박제 — cron 가 KST 09:25~11:16 6 turn 연속 fire, 평균 fire 간격 약 20 분, §10 의 cron 간격 ≥ 평균 task 소요시간 × 2 의 30 분~2 시간 가이드라인 위반) + 처리 (manual /loop session 의 substantive pr-mode task 시도 → race 충돌 후 작업 폐기 + cleanup 책임, T-0098 stale-cron-PR cleanup 패턴 1:1 mirror) + lesson (cron 활성 중 manual /loop 는 cron-safe doc-only direct OR cron suspend 후 진입 정공법) + cross-ref CLAUDE.md §10 + T-0098 + journal-2026-05-30.md L7.

F. `docs/architecture/race-patterns.md` §6 (현재) `observed cumulative` → §8 로 renumber + 갱신: "14 회차" → "18+ 회차" (gh worktree 7 + reviewer-gate 7 + Windows CRLF 1 + Git Bash MSYS 1 + harness phantom 1 + cron-vs-manual overlap 3 = 20 회차 누적) + ADR 신설 검토 marker 갱신 (race-handling policy escalation 후보).

G. `docs/architecture/race-patterns.md` §7 (현재) `References` → §9 로 renumber + 신규 reference 4 추가:
   - `docs/tasks/T-0100-gitattributes-eol-lf-permanent-fix.md` (Windows CRLF trap 영구 fix)
   - `docs/tasks/T-0098-*.md` (Git Bash MSYS 26 외부 effect 박제)
   - `docs/tasks/T-0097-*.md` (harness phantom worktree)
   - `docs/progress/journal-2026-05-30.md` (cron-vs-manual overlap 3 회차 박제 source)

H. grep 검증 — `grep -c "^## §" docs/architecture/race-patterns.md` 결과 9 (현재 7, +2 not — §4/§5/§6/§7 신규 4 종 추가, 기존 §6/§7 renumber to §8/§9, 결과 9 section) + `grep -c "회차" docs/architecture/race-patterns.md` 결과 ≥ 20 회차 keyword + `grep "T-0097\|T-0098\|T-0099\|T-0100" docs/architecture/race-patterns.md` 각 1+ match.

I. STATE/journal bookkeeping — `docs/STATE.json` `nextTask`: null → "T-0103" (본 planner turn) → driver inline 진행 시 currentTask transfer 후 완료 시 counters.tasksCompleted 101→102 + mostRecentTasks prepend T-0103 (cap 5 = [T-0103, T-0102, T-0101, T-0100, T-0099]) + lastCommit 갱신 + `docs/progress/journal-2026-05-30.md` 1 줄 append `<time> driver (manual /loop session turn 5/5 DONE OR next session driver): T-0103 DONE direct main commit — race-patterns.md amend (4 신규 race pattern + 20 회차 누적 박제)` + 본 task 파일 status DONE + actualDiff + actualFiles + driverNote 박제.

## Out of Scope

- ADR-0009+ race-handling policy 신설 — 본 task 는 observation 박제만 (race-patterns.md §1 의 "결정 신설 0" 정책 유지). 20 회차 누적 marker 만 박제, escalation 결정은 별도 ADR.
- CLAUDE.md §10 동시 실행 정책 갱신 — 본 task 의 박제 데이터 (cron-vs-manual overlap 3 회차) 가 §10 point 3 위반 박제 source 이지만, 정책 텍스트 갱신은 별도 task (cron 간격 권장 30 분~2 시간 갱신 / 사용 시간대 분리 강화 / multi-driver lock 강한 mutex 도입 등).
- cron env permanent fix ADR — Git Bash MSYS 는 local Windows env 박제, cron env (Anthropic 클라우드) gh CLI 부재 systemic breakage (HQ-0006/8/9/10/13 5+ 회차) 와는 별개 트랙. 본 task scope 0.
- estimate-model.md milestone refinement 추가 amend — T-0102 가 이미 31 회차 milestone 박제 완료. 본 task 는 race-patterns.md 만.
- stale local branch cleanup (~5 old `claude/T-00xx-*` and `claude/affectionate-babbage-*`) — 본 task scope 0, 별도 cleanup task.
- planner.md / p3-to-p4-transition.md multiplier sync — T-0102 §Out of Scope 의 follow-up, 별도 task.
- api.md / modules.md L48 UC-04 detail flow 갱신 (T-0101 follow-up) — 별도 task.

## Suggested Sub-agents

driver inline (T-0070 / T-0076 / T-0084 / T-0088 / T-0089 / T-0093 / T-0096 / T-0097 / T-0100 / T-0102 driver inline 패턴 1:1 mirror, 10 회차 누적 doc-only direct inline-amend). sub-agent dispatch 0.

## Follow-ups

(empty — sub-agent / driver inline 진행 후 spot 시 append)
