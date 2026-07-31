---
id: T-1357
title: requirements.md 46 행 REQ-027 신규 인원 backfill 상태를 실측 기반 DONE 으로 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-027]
estimatedDiff: 10
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1357-requirements-backfill-status-rejudge.md
plannerNote: "P7 138 행이 이미 [x] implemented-on-main 인데 requirements 46 행만 PLANNED stale — T-1356 후속 1 row 재판정"
---

# T-1357 — requirements.md 46 행 REQ-027 신규 인원 backfill 상태를 실측 기반 DONE 으로 재판정

## Why

[T-1355](T-1355-requirements-llm-provider-status-rejudge.md) (LLM provider 5 row) → [T-1356](T-1356-requirements-scheduling-status-rejudge.md) (스케줄링 3 row) 로 이어진 **requirements 상태 컬럼 stale 해소** 축의 세 번째 slice 다. T-1356 직후에도 [requirements.md](../requirements.md) 66 row 중 **42 row 가 `PLANNED`** 로 남아 있어, 표만 읽는 planner 가 이미 merge 된 기능을 "미착수" 로 오독해 중복 task 를 신설할 위험이 그대로다.

본 slice 의 대상은 T-1356 의 Follow-ups 가 **다음 slice 최우선 후보**로 지목한 **46 행 REQ-027** (신규 인원 1년치 평가 1회) 하나다. 근거가 가장 강한 row 다 — [PLAN.md](../PLAN.md) **138 행이 이미 `[x]` + `implemented-on-main`** 으로 심볼까지 링크했고, 같은 사실이 [src/scheduling/](../../src/scheduling/) 의 실제 route·상수로 확인된다. 즉 PLAN 은 shipped, requirements 표는 PLANNED 로 **서로 모순**이며 본 slice 는 그 모순을 requirements 쪽에 맞춰 닫는다. 다만 이 row 의 `검증 위치` 는 `unit + e2e` 인데 **e2e 는 실측상 0 건**이라, 상태 문자열에 그 한계를 함께 박제해 과장 없는 재판정을 남긴다.

## Required Reading

- [docs/requirements.md](../requirements.md) **9 행**(상태 enum 정의), **58~60 행**(T-1356 이 만든 `DONE (…)` 부기 표기 선례), **46 행**(편집 대상 1 row)
- [docs/PLAN.md](../PLAN.md) **138 행** (R-50 신규 인원 1년치 평가 1회 — `[x] implemented-on-main` + `buildBackfillPlan` / `runBackfill` 링크)
- [src/scheduling/backfill.controller.ts](../../src/scheduling/backfill.controller.ts) **69 행** (`@Post("backfill/:personId")`)
- [src/scheduling/backfill-plan.ts](../../src/scheduling/backfill-plan.ts) **17 행** (`DEFAULT_WEEKS = 52`)
- [src/scheduling/backfill-runner.service.ts](../../src/scheduling/backfill-runner.service.ts) **80 행** (`async runBackfill(`)
- [docs/architecture/api.md](../architecture/api.md) **149 행** (`POST /api/schedules/backfill/:personId` 표 행 — R-50 / REQ-027 를 이미 명시적으로 cross-ref)

## Acceptance Criteria

- [x] 편집은 [docs/requirements.md](../requirements.md) **46 행 1 줄뿐**이며, 그 줄에서 바뀌는 것은 **마지막 `상태` 컬럼 1 개**다. `REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치` 6 컬럼은 **글자 무수정** (특히 `구현 위치` 의 `P7 + P5` 와 `검증 위치` 의 `unit + e2e` 는 그대로 둔다).
- [x] 46 행 상태를 `PLANNED` → 다음 문자열로 재판정 (`|` 문자를 넣지 않는다):
  - `DONE (POST /api/schedules/backfill/:personId · buildBackfillPlan DEFAULT_WEEKS=52 · unit spec 3종 — e2e 미보유)`
- [x] **실측 선행** (편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제). 아래 5 개가 모두 기대치와 일치할 때만 flip 하고, 하나라도 어긋나면 flip 하지 않고 Follow-ups 에 근거와 함께 남긴다:
  - `grep -n "@Post(\"backfill/:personId\")" src/scheduling/backfill.controller.ts` → **1 hit (69 행)**
  - `grep -n "DEFAULT_WEEKS = 52" src/scheduling/backfill-plan.ts` → **1 hit (17 행)**
  - `grep -n "async runBackfill(" src/scheduling/backfill-runner.service.ts` → **1 hit (80 행)**
  - `ls src/scheduling/backfill*.spec.ts` → **3 개** (`backfill-plan.spec.ts` · `backfill-runner.service.spec.ts` · `backfill.controller.spec.ts`)
  - `grep -rl "backfill" test/e2e/ | wc -l` → **0** (e2e 부재 — 상태 문자열의 `e2e 미보유` 부기 근거. 0 이 아니면 그 부기를 빼고 flip)
- [x] **구조 무손상**: 편집 후 `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-" docs/requirements.md` = **66**, 편집한 46 행의 `|` 개수 = **8**.
- [x] **잔여 stale 정직 보고**: 편집 후 `grep -c "PLANNED" docs/requirements.md` = **41** (42 − 1). 이 수치를 commit trail 에 적어 남은 stale 규모를 다음 planner 가 그대로 이어받게 한다. 날조 금지 — 실제 출력값을 적는다.
- [x] 변경 파일은 **2 개뿐** ([docs/requirements.md](../requirements.md) + 본 task 파일). `src/` · `web/` · `test/` · [PLAN.md](../PLAN.md) · [api.md](../architecture/api.md) · `STATE.json` 무수정.
- [x] doc-only direct commit 이라 R-110 tester 면제 — 그 사유를 commit trail `TESTER.coverage` 에 한 줄 명시하고, 위 grep 검증 결과로 대체한다.

## Out of Scope

- **나머지 41 개 `PLANNED` row 의 일괄 flip 금지.** 근거가 row 마다 달라 한 commit 에 묶을 수 없다 — 다음 slice 로 남긴다.
- **REQ-030 (49 행, Export/backup + Restore) 동시 처리 금지.** [PLAN.md](../PLAN.md) 139 행이 `[x]` 라 같은 부류지만 근거 파일이 export/import/restore 다수라 검증 절차가 다르다 — 별도 slice.
- [PLAN.md](../PLAN.md) 138 행 수정 금지 (이미 `[x] implemented-on-main` 으로 정확하다 — 본 task 는 requirements 쪽만 맞춘다).
- [docs/architecture/api.md](../architecture/api.md) 149 행 수정 금지 (이미 REQ-027 cross-ref 정확 — 읽기 전용 근거로만 쓴다).
- `src/scheduling/` 코드·spec 변경 금지, **e2e 신규 작성 금지** (본 task 는 상태 표기 doc-sync 이지 test 확충이 아니다 — e2e 부재는 Follow-ups 로 이월).
- 상태 enum 자체(9 행) 또는 표 schema 변경 금지.

## Suggested Sub-agents

`implementer` (doc-only direct 이므로 단독. R-110 면제 — Acceptance Criteria 의 grep 검증으로 대체)

## Follow-ups

- **REQ-030 (49 행, `Export/backup + Restore`) 상태 재판정** — [PLAN.md](../PLAN.md) **139 행**이 `[x] implemented-on-main` (export controller + export-job service + import controller + import-job service + restore plan/preview/result). 근거 파일이 많아 별도 slice 로 남긴다 (T-1356 Follow-ups 에서 이월).
- **REQ-027 e2e 부재** — `test/e2e/` 에 backfill 경로 e2e 가 0 건이라 `검증 위치` 컬럼의 `e2e` 가 미충족이다. 상태 문자열에 부기로만 남겼으니, 실제 e2e 신설은 별도 `commitMode: pr` task 로 판단해야 한다 (R-113 관점).
