---
id: T-0108
title: race-patterns.md §7 amend — user-vs-cron concurrent direct-mode edit race 4 회차 박제 (ff-only graceful absorb)
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 45
estimatedFiles: 1
actualDiff: 12
actualFiles: 1
created: 2026-05-31
completedAt: 2026-05-31
plannerNote: doc-only inline-amend ×0.4 — race-patterns.md §7 cron-vs-manual overlap 에 4 회차 (user-vs-cron concurrent direct-mode edit, ff-only absorb) 추가. cron-safe.
---

# T-0108 — race-patterns.md §7 amend (user-vs-cron concurrent direct-mode edit race 4 회차 박제)

## Why

`docs/architecture/race-patterns.md` §7 `Cron-vs-manual /loop overlap race-condition` 은 현재 **3 회차** (2026-05-30 KST, 모두 planner/executor-level pr-mode race) 누적 박제. 2026-05-31 KST 02:08 에 **4 회차** 가 신규 발화 — 단, 이전 3 회차와 **다른 sub-pattern** 이다:

- 이전 3 회차: 주간 (KST 09:25~11:16) cron 6 turn 연속 fire 중 manual /loop 의 **substantive pr-mode task** 가 충돌 → 작업 폐기 + PR close + branch delete cleanup (cron win, manual 비용 부담).
- 4 회차 (신규): cron 02:05 fire 가 manual /loop session #29 의 active window (KST 01:17~02:03) **직후 5min residual** 과 겹침. 양쪽이 **동일 doc-only direct task (T-0107 api.md L69 amend)** 를 동시에 수행. cron driver 가 push 직전 `git fetch origin main` 으로 origin 이 manual 의 5047bcb 로 이동했음을 감지 → LOOP.md §4 graceful 종료: `git reset --soft HEAD~1` + `git stash --include-untracked` (audit 보존) + `git merge --ff-only origin/main` 으로 **무손실 흡수**. PR close / branch delete cleanup 비용 0 (doc-only direct 라 PR 자체가 없음, ff-only 로 origin 채택).

즉 4 회차는 **doc-only direct edit 의 동시 수행이 ff-only 로 graceful 흡수된 best-case** 사례 — 이전 3 회차의 pr-mode race-loss (작업 폐기) 와 대조되는 "race-patterns.md §7 lesson (cron 활성 시간대 manual 은 cron-safe doc-only direct 선호) 의 실증 검증" 박제. 본 task 는 §7 회차 enumeration table 에 4 회차 row 추가 + 원인/처리에 ff-only absorb sub-pattern 1~2 줄 + §8 observed cumulative 의 누적 카운트 (cron-vs-manual overlap 3 → 4, 전체 20 → 21) 갱신.

**doc-only direct inline-amend ×0.4** — race-patterns.md §7 에 1 row + 1~2 줄 추가 + §8 카운트 갱신, ~45 LOC / 1 파일. **cron-safe externalize 우선** — TODAY 박제 transcript (journal-2026-05-31 02:08) 가 다음 cron fire 로 fade 하기 전 박제. 또한 본 4 회차는 **cron 02:00 schedule overlap 이 반복 (4 회차) 되는 정책 신호** — §10 cron schedule 조정 humanQuestion 후보를 §Follow-ups 에 surface (notifier 역할이므로 본 planner 는 humanQuestion 생성 안 함, 후보만 박제).

## Required Reading

- `docs/architecture/race-patterns.md` §7 `Cron-vs-manual /loop overlap race-condition` (L137~160 — 회차 enumeration table 3 row + 원인 + 처리 + cross-ref) + §8 `observed cumulative` (L162~168 — `7 + 7 + 1 + 1 + 1 + 3 = 20 회차 누적` 식 + ADR escalation marker)
- `docs/progress/journal-2026-05-31.md` L3 (02:08 cron fire race-loser entry — T-0107 RACE-ABSORBED, `git reset --soft` + `git stash` + `git merge --ff-only` graceful 종료 박제 source) + L5 (02:03 driver T-0107 DONE — manual /loop 의 동일 T-0107 amend 박제 source, 5047bcb authoritative)
- `CLAUDE.md` §10 (동시 실행 정책 5 rule — 특히 point 3 "사용 시간대 분리" + cron 발화 시간대 KST 02:00·14:00 권장) + LOOP.md §4 (graceful 종료 — fetch+rebase / push fail reset+재시도)

## Acceptance Criteria

본 task 는 doc-only direct inline-amend — 코드 변경 0 LOC 이므로 R-110 tester 면제 (CLAUDE.md §3.2 direct-mode doc-only commit). 분기 없음 — R-112 happy/error/branch/negative 항목 적용 불가 (생략).

A. `docs/architecture/race-patterns.md` §7 회차 enumeration table 에 **4 회차 row 추가**:
   - `4 | ~02:08 (2026-05-31 KST) | driver-level (direct-mode edit) | T-0107 동일 doc-only direct edit 양쪽 동시 수행, cron loser — cron 가 push 직전 fetch 로 origin 이동 (5047bcb) 감지 후 ff-only graceful 흡수 (작업 폐기 0, PR/branch cleanup 0)`
   - table caption "(3 회차 = TODAY 박제, 가장 신선한 데이터)" → "(4 회차 누적 — 1~3 회차 2026-05-30 pr-mode race-loss, 4 회차 2026-05-31 doc-only direct ff-only graceful absorb)" 갱신.
   - 기존 "단일 manual /loop session 3 turn 연속 cron lose." 문장 아래에 1 줄 추가: "4 회차는 다른 sub-pattern — doc-only direct edit 동시 수행이 ff-only 로 무손실 흡수된 best-case (이전 3 회차 pr-mode race-loss 와 대조, §7 lesson 의 cron-safe doc-only direct 선호 실증)."

B. `docs/architecture/race-patterns.md` §7 `원인` 에 1 줄 추가 — "4 회차는 cron KST 02:05 fire 가 manual /loop session #29 active window (KST 01:17~02:03) 의 직후 ~5min residual 과 겹침 — §10 cron 권장 발화 시간대 (KST 02:00·14:00) 자체가 야간 manual /loop 과 충돌 가능한 구조적 overlap 박제 (4 회차 반복)."

C. `docs/architecture/race-patterns.md` §7 `처리` 에 1 줄 추가 — "doc-only direct edit 동시 수행 race 는 LOOP.md §4 ff-only graceful 흡수로 무손실 처리 (`git reset --soft HEAD~1` + `git stash --include-untracked` audit 보존 + `git merge --ff-only origin/main`) — PR/branch cleanup 불요 (pr-mode race 의 폐기 비용 0)."

D. `docs/architecture/race-patterns.md` §8 `observed cumulative` 갱신 — `7 + 7 + 1 + 1 + 1 + 3 = 20 회차 누적` → `7 + 7 + 1 + 1 + 1 + 4 = 21 회차 누적` + 괄호 안 "cron-vs-manual overlap 3" → "cron-vs-manual overlap 4". `20 회차 누적 marker` → `21 회차 누적 marker` (ADR 신설 검토 후보 marker 유지).

E. grep 검증 — `grep -c "회차" docs/architecture/race-patterns.md` 결과 ≥ 21 keyword (4 회차 row + §8 갱신으로 +1~2) + `grep "21 회차" docs/architecture/race-patterns.md` 1+ match + `grep "ff-only" docs/architecture/race-patterns.md` 1+ match + `grep "5047bcb" docs/architecture/race-patterns.md` (선택 — 4 회차 row 에 origin SHA 박제 시 1 match).

F. STATE/journal bookkeeping (driver 책임) — `docs/STATE.json` `nextTask`: null → "T-0108" (본 planner turn) → driver inline 진행 시 currentTask transfer 후 완료 시 counters.tasksCompleted 106→107 + mostRecentTasks prepend T-0108 (cap 5 = [T-0108, T-0107, T-0106, T-0105, T-0104]) + lastCommit 갱신 + `docs/progress/journal-2026-05-31.md` 1 줄 append + 본 task 파일 status DONE + actualDiff + actualFiles + driverNote 박제.

## Out of Scope

- **CLAUDE.md §10 cron schedule 조정** (예: KST 02:00 → 03:30 quiet hour 이동, 또는 cron 발화 시간대 강화 점검) — 본 task 는 observation 박제만 (race-patterns.md §1 "결정 신설 0" 정책 유지). cron schedule 변경은 **사용자 binding decision 필요** → §Follow-ups 의 humanQuestion 후보로 surface (planner 는 humanQuestion 생성 안 함 — notifier 역할).
- ADR-0009+ race-handling policy escalation 신설 — 21 회차 누적 marker 만 갱신, escalation 결정은 별도 ADR.
- §7 이외 section (§2~§6) 변경 — 본 task 는 §7 + §8 카운트만 amend. §4 Windows CRLF / §5 Git Bash MSYS / §6 harness phantom 회차는 변경 0.
- substantive P3 backbone task (Assessment + Contribution + Summary entity + raw 미저장 R-59 schema-level 강제) — pr-mode DB-schema task 로, cron-active overlap window 의 manual /loop 에서 진행 시 race-loss 위험 (§7 lesson). cron suspend 후 또는 quiet runway 진입 권장 — 별도 planner task (다음 dispatch 책임).
- p3-to-p4-transition.md / PLAN.md L53~66 P3 진척 marker 갱신 — 본 task 는 race-patterns.md 만.

## Suggested Sub-agents

driver inline (T-0103 race-patterns.md amend + T-0107/T-0102/T-0100/T-0097/T-0096/T-0093 inline-amend 패턴 1:1 mirror, 11 회차 누적 doc-only direct inline-amend). sub-agent dispatch 0 — doc-only direct, tester 면제 (코드 변경 0).

## Follow-ups

- **🔥 humanQuestion 후보 (driver/user surface — planner 는 생성 안 함)**: cron-vs-manual overlap 이 **4 회차 반복** (CLAUDE.md §10 point 3 "사용 시간대 분리" 의 구조적 위반). cron 권장 발화 시간대 KST 02:00 이 야간 manual /loop 과 겹치는 구조 — 사용자 결정 후보 2 안: (1) cron 02:00 → 03:30 같은 quiet hour 이동, (2) manual /loop 야간 사용 금지 (cron 전용 야간) + 주간 manual 분리 강화. 4 회차 모두 graceful 흡수 (1~3 pr-mode 폐기, 4 doc-only ff-only) 되어 데이터 손실 0 이었으나 반복 패턴은 정책 신호. driver 가 notifier dispatch 또는 사용자 직접 결정 권장.
