---
id: T-1360
title: requirements.md 53 · 54 행 REQ-034 · REQ-035 일/주/월 요약 평가 상태를 실측 기반 DONE 으로 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-034, REQ-035]
estimatedDiff: 14
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: [T-1359]
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1360-requirements-summary-period-status-rejudge.md
plannerNote: "PLAN 97 행 한 bullet 이 R-61 일/주/월 요약을 [x] implemented-on-main 으로 박제했는데 requirements 53·54 행만 PLANNED stale — T-1359 후속 2 row 재판정"
---

# T-1360 — requirements.md 53 · 54 행 REQ-034 · REQ-035 일/주/월 요약 평가 상태를 실측 기반 DONE 으로 재판정

## Why

[T-1355](T-1355-requirements-llm-provider-status-rejudge.md) (LLM provider 5 row) → [T-1356](T-1356-requirements-scheduling-status-rejudge.md) (스케줄링 3 row) → [T-1357](T-1357-requirements-backfill-status-rejudge.md) (backfill 1 row) → [T-1358](T-1358-requirements-abusing-status-rejudge.md) (abusing 2 row) → [T-1359](T-1359-requirements-github-instance-status-rejudge.md) (GitHub 3 instance 3 row) 로 이어진 **requirements 상태 컬럼 stale 해소** 축의 여섯 번째 slice 다. T-1359 직후에도 [requirements.md](../requirements.md) 66 row 중 **34 row 가 `PLANNED`** 로 남아 있어, 표만 읽는 planner 가 이미 merge 된 기능을 "미착수" 로 오독해 중복 task 를 신설할 위험이 그대로다.

본 slice 의 대상은 **53 행 REQ-034** (일별 활동 요약 평가문 — 당일은 자정까지 안 함, README 61) 와 **54 행 REQ-035** (주간/월간 요약 평가문 — 다음주/다음달 시작 시, README 62) 두 row 다. 두 row 를 한 slice 로 묶는 근거는 T-1358 이 세운 조건 — **"한 bullet · 한 심볼"** — 을 그대로 충족하기 때문이다. [PLAN.md](../PLAN.md) **97 행 단 하나의 bullet** 이 "일/주/월 요약 평가 … 당일 활동은 자정까지 평가 미실시 (R-61). 주간은 다음주 시작 시, 월간은 다음달 시작 시" 를 한 덩어리로 `[x] implemented-on-main` 으로 박제했고, 실제 구현도 day/week/month 를 가르지 않는 **동일 심볼** (`isPeriodEvaluable` / `computePeriodEnd` 의 period 인자 분기) 이다. 즉 두 row 의 판정 근거가 갈리지 않는다.

두 row 의 `검증 위치` 컬럼은 **`unit` 뿐** 이라 (e2e 요구 없음) T-1357 처럼 "e2e 미보유" 부기를 달 필요가 없다 — colocated unit spec 존재만 실측되면 과장 없는 `DONE` 이 된다.

## Required Reading

- [docs/requirements.md](../requirements.md) **9 행** (상태 enum 정의), **31 · 40 행** (T-1358 이 만든 "같은 심볼로 cover" 부기 표기 선례), **53 · 54 행** (편집 대상 2 row)
- [docs/PLAN.md](../PLAN.md) **97 행** (일/주/월 요약 평가 bullet — `[x] implemented-on-main`, 두 row 를 함께 덮는 단일 bullet)
- [src/assessment-evaluation/domain/period-evaluable.ts](../../src/assessment-evaluation/domain/period-evaluable.ts) **51 행** (`computePeriodEnd`) · **72 행** (`isPeriodEvaluable` — `now ≥ periodEnd` 일 때만 평가 허용)
- [src/assessment-evaluation/domain/summary-due-coordinates.ts](../../src/assessment-evaluation/domain/summary-due-coordinates.ts) **95 행** (`enumerateSummaryDueCoordinates` — 평가 대상 personId × period × periodStart 좌표 enumeration)
- [src/assessment-evaluation/summary-batch-orchestrator.service.ts](../../src/assessment-evaluation/summary-batch-orchestrator.service.ts) **146 행** (`SummaryBatchOrchestratorService` — 좌표를 batch 로 소비)
- [src/assessment-evaluation/summary-aggregate-orchestrator.service.ts](../../src/assessment-evaluation/summary-aggregate-orchestrator.service.ts) **69 행** (class) · **104 행** (`evaluateAndPersist` — LLM 정성 narrative + metric 수치 산출·영속)
- [src/common/period-boundary.ts](../../src/common/period-boundary.ts) **193 행** (`getKstPeriodRangeByPeriod` — day/week/month 라벨 → KST 반열림 구간, [ADR-0039](../decisions/ADR-0039-timezone-kst-boundary-policy.md) §Decision 3)

## Acceptance Criteria

- [x] 편집은 [docs/requirements.md](../requirements.md) **53 · 54 행 두 줄뿐** 이며, 각 줄에서 바뀌는 것은 **마지막 `상태` 컬럼 1 개** 다. `REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치` 6 컬럼은 **글자 무수정** (특히 `구현 위치` 의 `P5` 와 `검증 위치` 의 `unit` 은 그대로 둔다).
- [x] 두 행 상태를 `PLANNED` → 다음 문자열로 재판정 (`|` 문자를 넣지 않는다):
  - 53 행 REQ-034: `DONE (isPeriodEvaluable/computePeriodEnd 의 day 경로 — 다음 KST 자정 이후에만 Summary 생성 허용, enumerateSummaryDueCoordinates → SummaryBatchOrchestrator 배선)`
  - 54 행 REQ-035: `DONE (같은 심볼의 week/month 경로 — 다음 KST 월요일 00:00 · 다음 달 1 일 00:00 이후 허용, ADR-0035 aggregate summary 평가로 cover)`
- [x] **실측 선행** (편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제). 아래 7 개가 모두 기대치와 일치할 때만 flip 하고, 하나라도 어긋나면 flip 하지 않고 Follow-ups 에 실제 출력값과 함께 남긴다:
  - `grep -c "^| REQ-" docs/requirements.md` → **66**, `wc -l < docs/requirements.md` → **97** (편집 전후 동일)
  - `grep -n "export function computePeriodEnd" src/assessment-evaluation/domain/period-evaluable.ts` → **1 hit (51 행)**
  - `grep -n "export function isPeriodEvaluable" src/assessment-evaluation/domain/period-evaluable.ts` → **1 hit (72 행)**
  - `grep -n "export function enumerateSummaryDueCoordinates" src/assessment-evaluation/domain/summary-due-coordinates.ts` → **1 hit (95 행)**
  - `grep -n "export class SummaryBatchOrchestratorService" src/assessment-evaluation/summary-batch-orchestrator.service.ts` → **1 hit (146 행)** — day 전용이 아니라 batch 배선까지 shipped 라는 근거
  - `grep -n "evaluateAndPersist(" src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` → **104 행 포함 1 hit 이상** (LLM 정성 + metric 산출·영속 경로 존재 근거)
  - `ls src/assessment-evaluation/domain/period-evaluable.spec.ts src/assessment-evaluation/domain/summary-due-coordinates.spec.ts src/assessment-evaluation/summary-batch-orchestrator.service.spec.ts src/assessment-evaluation/summary-aggregate-orchestrator.service.spec.ts` → **4 파일 모두 존재** (`검증 위치` 컬럼 `unit` 충족 근거). 하나라도 없으면 그 사실을 상태 문자열에 정직하게 반영하거나 flip 을 보류한다.
- [x] **day/week/month 3 분기 cover 확인** — `grep -c '"day"' src/assessment-evaluation/domain/period-evaluable.spec.ts` · `'"week"'` · `'"month"'` 가 **각 1 hit 이상** (planner 실측 시점 값 17 · 8 · 13). 한 granularity 라도 0 이면 그 granularity 를 담당하는 row 는 flip 하지 않고 Follow-ups 로 넘긴다 — REQ-035 는 week 와 month 둘 다 필요하다.
- [x] **구조 무손상**: 편집 후 `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-" docs/requirements.md` = **66**, 편집한 53 · 54 행의 `|` 개수 = **각 8**.
- [x] **잔여 stale 정직 보고**: 편집 후 `grep -c "PLANNED" docs/requirements.md` = **34** (36 − 2). 이 중 2 hit 은 row 가 아니라 **9 행 상태 enum 정의** 와 **96 행 planner 지침** 이므로 실제 잔여 `PLANNED` **row 는 32 개** 다. 두 수치를 모두 commit trail 에 적어 다음 planner 가 규모를 오독하지 않게 한다. 날조 금지 — 실제 출력값을 적는다.
- [x] 변경 파일은 **2 개뿐** ([docs/requirements.md](../requirements.md) + 본 task 파일). `src/` · `web/` · `test/` · [PLAN.md](../PLAN.md) · `docs/architecture/` · `STATE.json` 무수정.
- [x] doc-only direct commit 이라 R-110 tester 면제 — 그 사유를 commit trail `TESTER.coverage` 에 한 줄 명시하고, 위 grep 검증 결과로 대체한다.

## Out of Scope

- **나머지 32 개 `PLANNED` row 의 일괄 flip 금지.** 근거가 row 마다 달라 한 commit 에 묶을 수 없다 — 다음 slice 로 남긴다.
- **REQ-036 (55 행, 상대 비교 + LLM 정성 + Metric 수치) 동시 처리 금지.** 요약 도메인과 인접하지만 판정 근거가 "상대 비교" 축 (person 간 비교 가능성) 이라 본 slice 의 심볼 (`isPeriodEvaluable`) 로 덮이지 않는다 — 별도 slice 후보로 Follow-ups 에만 남긴다.
- **REQ-037 (56 행, 일괄 평가 + Reset & Reeval) 동시 처리 금지.** `검증 위치` 가 `e2e` 라 근거 수집 범위가 다르다.
- **REQ-030 (49 행, Export/backup + Restore) 처리 금지.** [T-1339](T-1339-api-doc-backup-restore-placeholder.md) 의 placeholder 표기 + Q-0055 의 복원 엔진 미완결 판정이 유지되는 한 flip 은 과장이다.
- **[PLAN.md](../PLAN.md) · `docs/architecture/` 동기 편집 금지.** 97 행 bullet 은 이미 `[x] implemented-on-main` 이라 손댈 것이 없다 — 본 slice 는 requirements 표 한 축만 닫는다.
- **`src/` 리팩터 · spec 신설 · timezone 정책 재논의 금지.** 상태 재판정은 실측 서술일 뿐 구현 변경이 아니다.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 편집). tester 는 doc-only 라 면제 — grep self-check 로 대체.

## Follow-ups

- **다음 slice 후보: REQ-036 (55 행, 상대 비교 + LLM 정성 + Metric 수치).** 본 slice 의 심볼로 덮이지 않아 별도 근거 수집 필요 — `검증 위치` 가 `unit` 이라 수집 범위는 본 slice 와 동형.
- **잔여 `PLANNED` row 32 개** (`grep -c "PLANNED"` = 34 중 9 행 enum 정의 · 96 행 planner 지침 2 hit 제외). requirements 상태 stale 해소 축은 계속 slice 단위로.

## 완료 요약 (2026-08-01)

- 실측 7 종 + granularity 3 종 전부 기대치 일치 (`REQ-` row 66 / 97 행 / `computePeriodEnd` 51 행 / `isPeriodEvaluable` 72 행 / `enumerateSummaryDueCoordinates` 95 행 / `SummaryBatchOrchestratorService` 146 행 / `evaluateAndPersist` 104 행 1 hit / spec 4 파일 존재 / `"day"` 17 · `"week"` 8 · `"month"` 13) → 53 · 54 행 상태 컬럼만 `PLANNED` → `DONE (…)` flip.
- 편집 후 구조 무손상 확인: 97 행 · `REQ-` row 66 · 편집 2 행의 `|` 각 8 · `PLANNED` 36 → 34 (실 row 32).
