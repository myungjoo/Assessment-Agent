---
id: T-1356
title: requirements.md 58~60 행 REQ-039~041 스케줄링 상태 컬럼을 실측 shipped 로 재판정
phase: P7
status: DONE
completedAt: 2026-08-01
commitMode: direct
coversReq: [REQ-039, REQ-040, REQ-041]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1356-requirements-scheduling-status-rejudge.md
plannerNote: "P7 135~137 행이 이미 [x] implemented-on-main 인데 requirements 58~60 행만 PLANNED stale — 3 row 재판정"
---

# T-1356 — requirements.md 58~60 행 REQ-039~041 스케줄링 상태 컬럼을 실측 shipped 로 재판정

## Why

[T-1354](T-1354-plan-p7-perf-verification-evidence.md) 가 지목하고 [T-1355](T-1355-requirements-llm-provider-status-rejudge.md) 가 첫 slice 를 처리한 **requirements 상태 컬럼 stale** 축의 두 번째 slice 다. T-1355 이후에도 [requirements.md](../requirements.md) 66 row 중 **45 row 가 `PLANNED`** 로 남아 있고, 표만 읽는 planner 가 이미 merge 된 기능을 "미착수" 로 오독해 중복 신설할 위험이 그대로다. 다만 전 row 일괄 flip 은 판정 근거가 row 마다 달라 한 slice 로 묶을 수 없다 — 본 slice 도 **판정 근거가 동형인 묶음 하나**만 처리한다.

대상은 **58~60 행 REQ-039 · REQ-040 · REQ-041** (P7 스케줄링 3 종) 이다. 이 3 row 는 판정 근거가 가장 강하다 — [PLAN.md](../PLAN.md) **P7 135 · 136 · 137 행이 이미 `[x]` + `implemented-on-main`** 으로 파일·심볼까지 링크해 두었고, 같은 사실이 [src/scheduling/](../../src/scheduling/) 의 실제 route 로 확인된다. 즉 PLAN 은 shipped 로, requirements 표는 PLANNED 로 서로 **모순된 상태**이며 본 slice 는 그 모순을 requirements 쪽에 맞춰 닫는다. LLM provider 5 row 를 같은 방식으로 처리한 T-1355 가 직전 선례다.

## Required Reading

- [docs/requirements.md](../requirements.md) **9 행**(상태 enum 정의), **41 행**(REQ-022 — 괄호 부기 표기 선례), **58 · 59 · 60 행**(편집 대상 3 row)
- [docs/PLAN.md](../PLAN.md) **135 · 136 · 137 행** (P7 cron 주기 지정 / manual trigger / 최근 N일 delete→재수집 — 셋 다 `[x] implemented-on-main` + 파일 링크)
- [src/scheduling/cron-schedule.controller.ts](../../src/scheduling/cron-schedule.controller.ts) **90 · 103 · 120 · 140 행** (`@Get()` / `@Put()` / `@Delete(":name")` / `@Post("trigger")`)
- [src/scheduling/recent-deletion.controller.ts](../../src/scheduling/recent-deletion.controller.ts) **96 행** (`@Post("recent-deletion/:personId")`)
- [docs/architecture/api.md](../architecture/api.md) **146~151 행** (`/api/schedules` endpoint 표 — T-0414/T-0417/T-0428 박제) 및 **97 행** (REQ-041 의 옛 `DELETE /api/assessments` path 는 never-built, capability 는 recent-deletion route 로 이관됐다는 기박제 사실)

## Acceptance Criteria

- [ ] 편집은 [docs/requirements.md](../requirements.md) **58 · 59 · 60 행 3 줄뿐**이며, 각 줄에서 바뀌는 것은 **마지막 `상태` 컬럼 1 개**다. `REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치` 6 컬럼은 **글자 무수정**.
- [ ] 3 row 의 상태를 `PLANNED` → 아래 3 문자열로 각각 재판정 (row 마다 근거 route 가 다르므로 문자열도 다르다. `|` 문자를 넣지 않는다):
  - REQ-039 → `DONE (GET·PUT·DELETE /api/schedules 런타임 cron registry)`
  - REQ-040 → `DONE (POST /api/schedules/trigger 즉시 1회 발화)`
  - REQ-041 → `DONE (POST /api/schedules/recent-deletion/:personId delete→재수집)`
- [ ] **실측 선행** (편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제). 아래 4 개가 모두 기대치와 일치할 때만 flip 하고, 하나라도 어긋나면 그 row 는 flip 하지 않고 Follow-ups 에 근거와 함께 남긴다:
  - `grep -n "@Get()\|@Put()\|@Delete(\":name\")" src/scheduling/cron-schedule.controller.ts` → **3 hit** (90 · 103 · 120 행)
  - `grep -n "@Post(\"trigger\")" src/scheduling/cron-schedule.controller.ts` → **1 hit** (140 행)
  - `grep -n "@Post(\"recent-deletion/:personId\")" src/scheduling/recent-deletion.controller.ts` → **1 hit** (96 행)
  - `grep -n "^- \[x\]" docs/PLAN.md | sed -n '/R-72\|R-73\|R-74/p'` → **3 hit** (135 · 136 · 137 행이 모두 `[x]`)
- [ ] **구조 무손상**: 편집 후 `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-" docs/requirements.md` = **66**, 편집한 3 행 각각의 `|` 개수 = **8**.
- [ ] **잔여 stale 정직 보고**: 편집 후 `grep -c "PLANNED" docs/requirements.md` = **42** (45 − 3). 이 수치를 commit trail 에 적어 남은 stale 규모를 다음 planner 가 그대로 이어받게 한다. 날조 금지 — 실제 출력값을 적는다.
- [ ] 변경 파일은 **2 개뿐** ([docs/requirements.md](../requirements.md) + 본 task 파일). `src/` · `web/` · `test/` · [PLAN.md](../PLAN.md) · `STATE.json` 무수정.
- [ ] doc-only direct commit 이라 R-110 tester 면제 — 그 사유를 commit trail `TESTER.coverage` 에 한 줄 명시하고, 위 grep 검증 결과로 대체한다.

## Result (2026-08-01)

**DONE.** [requirements.md](../requirements.md) 58 · 59 · 60 행의 `상태` 컬럼 1 개씩만 `PLANNED` → `DONE (…)` 로 재판정했다. 나머지 6 컬럼과 다른 65 row 는 무수정.

실측 선행 결과 (4/4 기대치 일치 — 전 row flip 조건 충족):

- `cron-schedule.controller.ts` `@Get()` / `@Put()` / `@Delete(":name")` → **3 hit (90 · 103 · 120 행)**
- `cron-schedule.controller.ts` `@Post("trigger")` → **1 hit (140 행)**
- `recent-deletion.controller.ts` `@Post("recent-deletion/:personId")` → **1 hit (96 행)**
- [PLAN.md](../PLAN.md) R-72 / R-73 / R-74 `- [x]` → **3 hit (135 · 136 · 137 행, 모두 `implemented-on-main`)**

구조 무손상 확인: `wc -l` = **97**, `^| REQ-` = **66**, 편집 3 행의 `|` 개수 = **8 / 8 / 8**.

잔여 stale 정직 보고: `grep -c "PLANNED"` = **42** (45 − 3). 남은 42 row 는 근거가 row 마다 달라 다음 slice 로 이월한다 — 최우선 후보는 아래 Follow-ups 의 REQ-027 · REQ-030.

## Out of Scope

- **나머지 42 개 `PLANNED` row 의 일괄 flip 금지.** 근거가 row 마다 달라 한 commit 에 묶을 수 없다 — 다음 slice 로 남긴다.
- [PLAN.md](../PLAN.md) 135~137 행 수정 금지 (이미 `[x] implemented-on-main` 으로 정확하다 — 본 task 는 requirements 쪽만 맞춘다).
- [docs/architecture/api.md](../architecture/api.md) 수정 금지 (`/api/schedules` 표는 이미 정확 — 읽기 전용 근거로만 쓴다).
- `src/scheduling/` 코드·spec 변경 금지 (본 task 는 상태 표기 doc-sync 이지 기능 변경이 아니다).
- 상태 enum 자체(9 행) 또는 표 schema 변경 금지.
- REQ-027 (46 행, 신규 인원 1년치 backfill) 은 P7 138 행이 `[x]` 라 같은 부류지만 **본 slice 밖** — 아래 Follow-ups 참조.

## Suggested Sub-agents

`implementer` (doc-only direct 이므로 단독. R-110 면제 — Acceptance Criteria 의 grep 검증으로 대체)

## Follow-ups

- **REQ-027 (46 행, `신규 인원 1년치 평가 1회`) 상태 재판정** — [PLAN.md](../PLAN.md) **138 행**이 `[x] implemented-on-main` 이고 근거는 [backfill-plan.ts](../../src/scheduling/backfill-plan.ts) (`DEFAULT_WEEKS=52`) + [backfill-runner.service.ts](../../src/scheduling/backfill-runner.service.ts) + [backfill.controller.ts](../../src/scheduling/backfill.controller.ts) `@Post("backfill/:personId")` (69 행). 본 slice 와 근거 모듈은 같지만 row 위치(46)가 떨어져 있어 분리했다. 다음 slice 최우선 후보.
- **REQ-030 (49 행, `Export/backup + Restore`) 상태 재판정** — [PLAN.md](../PLAN.md) **139 행**이 `[x] implemented-on-main` (export/import controller + job service + restore plan 다수). 근거 파일이 많아 별도 slice 필요.
