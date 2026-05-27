---
id: T-0078
title: CLAUDE.md §2.5 신설 — multi-task fire opt-in spec (실험적, 기본 OFF)
phase: P3
status: DONE
commitMode: direct
coversReq: []
estimatedDiff: 90
estimatedFiles: 4
created: 2026-05-28
completedAt: 2026-05-28
actualDiff: 130
actualFiles: 4
estimateOutcome: +44% over (envelope 90 vs raw add 130 — §2.5 신설 본문이 활성화 step / 위반 처리 / §10 관계까지 박제하느라 envelope 초과)
reviewRounds: 0
dependsOn: []
parents: []
plannerNote: user-interactive direct path (planner bypass) — 사용자 대화에서 "1 fire 안에서 N=2 task chain 을 opt-in 으로 박제" 결정. §2 step 7 (1-task / 1-fire 종료) 의 기본 룰은 보존하고, 별도 §2.5 로 활성화 조건 5 종 (executor 격리 / N≤2 / 실패 즉시 종료 / lock 45 분 / commitMode mixed 금지) 을 forward-looking spec 으로 박제. 기본 OFF — 별도 ADR + STATE.flags.multiTaskFire 토글로만 활성. 활성화 시 검토 필요 항목은 GitHub issue 로 외화.
---

# T-0078 — CLAUDE.md §2.5 신설 (multi-task fire opt-in spec)

## Why

`/loop` dynamic mode 와 cron/`schedule` 의 본질적 차이는 [§10](../../CLAUDE.md) — cron 은 매 발화 fresh conversation 이라 자동 cleanup, `/loop` 은 같은 conversation 안에서 turn 이 누적 (10-turn cap 으로 완화). 그러나 cron 한 fire 당 1 task 만 처리하는 [§2 step 7](../../CLAUDE.md) 의 기본 룰은 cold-start tax (CLAUDE.md / STATE / PLAN / journal 재로드 ~ 15k tok / fire) 를 N 회 지불하는 구조 — N=multi 로 묶으면 token 측면 cheaper 하지만 driver context 격리 보장이 약화된다.

사용자 대화 중 "1 fire 안에서 2 task chain 을 opt-in 으로 박제" 결정. 본 task 는 §2 step 7 의 기본 룰은 **그대로 보존**하고, 별도 [§2.5](../../CLAUDE.md) 신설로 활성화 조건과 안전 가드레일을 박제 — **현재 기본 OFF** (별도 ADR + STATE 토글로만 활성). 활성화 검토는 별도 ADR 작성 시점에 이뤄지며, 본 task 는 spec 박제만 담당.

[CLAUDE.md §3.1](../../CLAUDE.md) direct-mode 정합 — `CLAUDE.md` 운영규칙 변경 = doc-only direct. PR / reviewer round 불요, R-110 면제 (production code 0).

## Required Reading

- [CLAUDE.md §0.5](../../CLAUDE.md) — hard rule cheat sheet item 8 ("1 task = 1 commit / 1 fire = 1 task"). 본 task 가 amend 대상.
- [CLAUDE.md §2](../../CLAUDE.md) — 실행 루프 step 7 ("Task 1개 완료 후 종료. 다음 task로 자동 진입하지 않는다"). 본 task 가 amend 대상 (조건부 예외 bullet 추가).
- [CLAUDE.md §3](../../CLAUDE.md) — Task / Commit / PR 원칙. §2 와 §3 사이에 §2.5 신설.
- [CLAUDE.md §10](../../CLAUDE.md) — Long-horizon 실행 모드 + 동시 실행 정책. §2.5 (d) lock 45 분 임계 가 §10 의 cron 간격 정책과 상호작용.
- [docs/LOOP.md](../LOOP.md) §1 — 현재 driver loop step 7 종료 분기. §2.5 활성 시 변경 필요 (본 task scope 밖, 활성화 시점에 별도 task).

## Acceptance Criteria

### A. CLAUDE.md §0.5 amend (cheat sheet item 8 update)

- [x] §0.5 item 8 "1 task = 1 commit / 1 fire = 1 task" 끝에 "기본 OFF — 실험적 multi-task fire 는 §2.5" 한 줄 추가.

### B. CLAUDE.md §2 step 7 amend (조건부 예외 bullet)

- [x] §2 step 7 의 종료 조건 bullet list 에 세 번째 bullet 추가 — "Multi-task fire (§2.5) 활성 시에는 본 step 의 '1 task 후 종료' 가 조건부 — §2.5 (a)~(e) 모두 충족 시에만 다음 task 진입 허용. 현재 기본 OFF."

### C. CLAUDE.md §2.5 신설 (full new section between §2 and §3)

- [x] "## 2.5 Multi-task fire (실험적, 기본 OFF)" heading + intro 단락 (기본 동작 vs opt-in 경로, 기본값 OFF + ADR + STATE 토글 명시).
- [x] "### 활성화 조건 (5 개 모두 충족 시에만 chain 허용)" subsection — (a) sub-agent 격리 + ≤200 char SUMMARY + trail blob 만 / (b) N ≤ 2 / (c) BLOCKED/CI fail/push contention/merge conflict 시 즉시 종료 / (d) lock 45 분 임계 / (e) commitMode mixed chain 금지 5 개 bullet.
- [x] "### 기본 OFF 의 의미" subsection — 현재 driver loop 변경 없음, 활성화 step 4 단계 (ADR / STATE schema / LOOP.md update / 토글), 비활성 동안 forward-looking spec.
- [x] "### 활성 시 위반 처리" subsection — (a)~(e) false 시 `multi-task-fire-violation` BLOCKED, reviewer agent MINOR finding catch, 첫 30 일 dogfood.

### D. 도큐 정합

- [x] §2 step 7 amend 와 §2.5 가 서로 reference (forward / backward) — agent 가 §2 만 읽어도 §2.5 존재를 인지 가능.
- [x] §10 (Long-horizon 실행 모드) 의 cron 간격 정책 / 동시 실행 정책과 §2.5 (d) 의 lock 45 분 임계가 모순 없음 — §10 의 60 분 stale 임계 보호 명문화.
- [x] §0.5 cheat sheet 의 item 8 amend 가 본문 §2 / §2.5 와 일치.

### E. 트레이서빌리티 / direct-mode bookkeeping

- [x] T-0078 task 파일 frontmatter status=DONE + actualDiff/actualFiles/completedAt 박제.
- [x] STATE.json: counters.tasksCompleted 76→77 / mostRecentTasks prepend T-0078 / lastActivity bump.
- [x] journal-2026-05-28.md 에 entry append (5 줄 이내, user-interactive direct path 박제).
- [x] 4 파일 single direct commit on main with trail blob (CLAUDE.md + T-0078 task file + STATE.json + journal).

## Out of Scope

- **STATE.json schema 의 `flags.multiTaskFire` 필드 추가** — 본 task 는 spec 박제만. 실 schema field 는 활성화 시점에 별도 task / ADR.
- **docs/LOOP.md §1 의 chain 분기 step 추가** — 활성화 시점 별도 task.
- **활성화 ADR 작성** — 본 task 는 spec only, 활성 결정 자체는 별도.
- **§10 의 cron 간격 정책 조정** — multi-task fire 활성 시 (N × avg task × 2) 로 scale 해야 하지만 현재 OFF 라 변경 불요. GitHub issue 로 외화.
- **R-114 CI 검증 boundary 명확화 (chained tasks)** — 활성 시점 검토 필요. GitHub issue 로 외화.

## Follow-ups

- 활성화 검토 ADR (예: ADR-0008 multi-task-fire-activation) — N=2 trade-off / dogfood 결과 / 활성 결정.
- §10 cron 간격 정책 scale-up — multi-task fire 활성 시 spacing 재계산.
- LOOP.md §1 chain step — activation 시점 driver loop 분기 추가.
- GitHub issue (filed by this task) 추적.
