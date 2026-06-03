---
id: T-0199
title: LOOP.md §1 에 cron 전용 multi-task chain 분기 추가 (ADR-0020 활성화 step 3)
phase: P4
status: DONE
commitMode: direct
coversReq: []
estimatedDiff: 55
estimatedFiles: 1
actualDiff: 43
actualFiles: 1
created: 2026-06-03
completedAt: 2026-06-03T18:32:00+09:00
dependsOn: [T-0197, T-0198]
parents: []
plannerNote: "P4 ADR-0020 롤아웃 step 3 — LOOP.md §1 cron-only N=2 chain 분기(이중 게이트·flag=false 라 dormant). doc-only direct."
---

# T-0199 — LOOP.md §1 에 cron 전용 multi-task chain 분기 추가 (ADR-0020 활성화 step 3)

## Why

[ADR-0020](../decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) 의 4단계 활성화 롤아웃 중 **step 3** 이다. step 1 (ADR 작성, T-0197) 과 step 2 (STATE `flags.multiTaskFire: false` 필드, T-0198) 이 모두 DONE 이므로, 이제 [docs/LOOP.md §1](../LOOP.md) (표준 driver prompt) 에 **cron fire 한정 multi-task chain 분기** 를 추가한다. 직전 task 완료 후 [CLAUDE.md §2.5](../../CLAUDE.md) 조건 (a)~(e) 를 재평가해 모두 true 면 같은 fire 안에서 두 번째 task 1개(N≤2)에만 진입하고, 하나라도 false 면 현행 step [7]/[8] 종료를 그대로 따른다.

**중요 — 본 변경은 flag=false 인 동안 완전히 dormant(무효) 하다**: 분기는 `STATE.flags.multiTaskFire === true` AND `lock.holder === "cron"` 의 **이중 게이트** 위에 놓인다. 현재 `flags.multiTaskFire` 는 `false`(T-0198) 이므로 driver 동작은 전혀 바뀌지 않는다 — step 4 (토글 ON) 가 완료되기 전까지 이 로직은 inert 한 forward-looking 명세다. reviewer / 미래 독자가 "지금은 아무 효과 없음" 을 즉시 알 수 있도록 본문에 명시한다.

## Required Reading

- [docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md](../decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) — Decision (1)~(6), 특히 (2) 조건 (a)~(e), (3) `FIRE-BATCH` marker 형식, (6) 롤아웃 표의 step 3 행.
- [CLAUDE.md](../../CLAUDE.md) §2.5 "활성화 조건 (5개 모두 충족 시에만 chain 허용)" — 조건 (a)~(e) verbatim + "활성 시 위반 처리" + "본 § 와 §10 의 관계".
- [docs/LOOP.md](../LOOP.md) §1 표준 driver prompt 전체, 특히 step [4] COMMIT MODE 분기(commit/CI 흐름) · step [6] STATE/JOURNAL 갱신(lock 해제 위치) · step [7] 종료 요약 · step [8] DYNAMIC SELF-RESCHEDULE (`/loop` 전용임을 확인 — 새 분기는 cron 전용이므로 [8] 과 대칭).
- [docs/STATE.json](../STATE.json) — `flags.multiTaskFire`(line 4-5, 현재 false), `lock.holder`(cron / loop / human 구분), `lock.since`(45분 임계 계산 기준).

## Acceptance Criteria

새 분기는 [docs/LOOP.md §1](../LOOP.md) 표준 prompt 안, **step [7] 종료 요약 직후·step [8] 직전** 에 신규 step (예: `[7.5] CRON MULTI-TASK CHAIN (오직 cron fire 일 때 + flags.multiTaskFire == true 일 때)`) 으로 추가한다. 아래 항목을 모두 인코딩해야 한다 (verifiable: 해당 파일 §1 의 새 step 텍스트 inspection).

- [ ] **이중 게이트 명시** — 새 분기는 `STATE.flags.multiTaskFire === true` **AND** `lock.holder == "cron"` 두 조건이 **모두** 참일 때만 진입한다. 둘 중 하나라도 거짓이면 이 step 을 skip 하고 현행 종료(step [7] cron 의 경우 그냥 종료 / `/loop` 는 step [8])로 간다고 명시.
- [ ] **dormant 표기** — 본 step 에 "`flags.multiTaskFire` 가 현재 `false`(T-0198) 이므로 이 분기는 inert — step 4 토글 ON 전까지 driver 동작 불변" 취지의 한 줄을 박제.
- [ ] **cron-only 명시** — `lock.holder == "loop"` 또는 `"human"` 일 때는 본 분기가 **절대 trigger 되지 않음** 을 명시. `/loop` 의 기존 step [8] turn-cap self-reschedule 동작은 건드리지 않는다고 명시.
- [ ] **N≤2 hard cap** — 한 fire 당 추가 task 는 **최대 1개**(총 2개). 두 번째 task 완료 후에는 무조건 종료하며 **세 번째 task 진입 금지** 라고 명시.
- [ ] **조건 (a)~(e) 재평가** — 두 번째 task 진입 전에 [CLAUDE.md §2.5](../../CLAUDE.md) / [ADR-0020](../decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) Decision (2) 의 5조건을 **모두** 재평가한다고 명시하고, 각 조건을 driver 가 점검 가능한 형태로 요약:
  - (a) 직전 task 를 `executor` 1회 호출로 처리했고 driver 가 받은 게 ≤200 char SUMMARY + 표준 trail blob 뿐(raw output / 긴 log 끌고 왔으면 chain 차단).
  - (b) N≤2 (이미 두 번째면 더 진입 안 함).
  - (c) 직전 task 가 `BLOCKED` / CI fail / push contention / merge conflict 중 하나라도면 **즉시 종료(fail-fast)** — chain 안 함.
  - (d) `STATE.lock.since` 로부터 경과 ≥ 45분이면 추가 진입 금지(§2 60분 stale 임계 보호).
  - (e) 두 task 의 `commitMode` 가 같을 때만(direct+direct OR pr+pr) — 혼합(direct+pr / pr+direct) 금지.
  - **하나라도 false → 두 번째 task 진입 안 하고 현행 종료**(현 step [7] cron 종료) 라고 명시.
- [ ] **두 번째 task 진입 경로** — 모든 게이트·조건 통과 시 `STATE.nextTask` 를 `currentTask` 로 옮겨 step [2]~[6] 를 한 번 더 수행하는 흐름임을 명시(planner 가 미리 큐잉한 nextTask 가 있어야 진입 — 없으면 종료).
- [ ] **`FIRE-BATCH` marker 지침** — chain 된 두 task 의 commit trail footer 에 `FIRE-BATCH: <task1>+<task2>` 형식(예: `FIRE-BATCH: T-0210+T-0211`)을 박는다고 명시. [ADR-0020](../decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) Decision (3) 참조. marker 가 trail blob 인접 footer 에 위치한다는 점 포함.
- [ ] **§10 관계 한 줄** — fire 자체는 매 발화 fresh conversation 이므로 격리 약화는 1 fire 내부(2 task 사이)에만 국한된다는 [CLAUDE.md §2.5](../../CLAUDE.md) "본 § 와 §10 의 관계" 취지 한 줄 박제(optional 이지만 권장).
- [ ] LOOP.md §4 에 이미 박제된 `flags.multiTaskFire` 설명(T-0198) 과 모순되지 않게 cross-reference(예: "활성 토글은 §4 / ADR-0020 step 4").
- [ ] 변경은 LOOP.md 단일 파일, doc-only — `git diff --stat` 결과가 `docs/LOOP.md` 1개 파일이고 추가 diff ≤ 300 LOC / ≤ 5 파일 cap 안.

> 비고: 본 task 는 `commitMode: direct` (운영 문서 prompt 텍스트 편집) 이고 `src/` 를 건드리지 않으므로 unit test / R-112 4종은 적용 대상이 아니다(코드 0 LOC). 분기 추가는 LOOP.md prompt 텍스트의 inline-amend 다.

## Out of Scope

- `STATE.flags.multiTaskFire` 를 `true` 로 토글하지 **않는다** — 이는 롤아웃 **step 4**(별도 task) 이며 step 3(본 task) 완료가 선행 조건이다. 본 task 에서 토글하면 분기만 있고 검증 안 된 상태로 활성화돼 위험.
- [CLAUDE.md §10](../../CLAUDE.md) 의 cron 간격 수치(예: `(2×평균)×2` 명문화 / 30분→60분 조정)를 변경하지 **않는다** — 이것도 step 4 의 일이다.
- `/loop` step [8] DYNAMIC SELF-RESCHEDULE 의 동작(turn-cap 10, reschedule 조건 등)을 변경하지 **않는다** — 새 분기는 cron 전용이고 [8] 과 독립.
- `src/`, `web/`, `test/`, `.github/workflows/`, `package.json` 등 pr-territory 파일을 전혀 건드리지 않는다(건드리면 commitMode 가 pr 로 바뀌어 task split 필요).

## Suggested Sub-agents

`implementer` → `tester` (단, doc-only direct 이므로 driver 가 sub-agent 없이 직접 LOOP.md §1 inline edit 후 direct commit 해도 무방 — single-writer 가 아닌 운영 문서이지만 `direct` mode 라 reviewer/PR 불요. driver 판단으로 직접 수행 가능).

## Follow-ups

- **step 4 (마지막 활성화 단계)** — [CLAUDE.md §10](../../CLAUDE.md) cron 간격을 `(2×평균)×2` 로 명문화 + `docs/STATE.json.flags.multiTaskFire = true` **토글 ON** (commitMode: direct). **선행 조건: 본 step 3(T-0199) 완료**. step 4 의 토글이 바로 본 분기를 **live 로 만드는 활성화** 다 — 그 전까지 본 task 의 분기는 dormant. (ADR-0020 Decision (6) 롤아웃 표 step 4 / T-0197 Follow-ups.)
