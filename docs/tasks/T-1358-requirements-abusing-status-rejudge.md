---
id: T-1358
title: requirements.md 31 · 40 행 REQ-012 · REQ-021 abusing 방지 상태를 실측 기반 DONE 으로 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-012, REQ-021]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1358-requirements-abusing-status-rejudge.md
plannerNote: "PLAN 101 행 한 bullet 이 R-26·R-40 을 [x] implemented-on-main 으로 박제했는데 requirements 31·40 행만 PLANNED stale — T-1357 후속 2 row 재판정"
---

# T-1358 — requirements.md 31 · 40 행 REQ-012 · REQ-021 abusing 방지 상태를 실측 기반 DONE 으로 재판정

## Why

[T-1355](T-1355-requirements-llm-provider-status-rejudge.md) (LLM provider 5 row) → [T-1356](T-1356-requirements-scheduling-status-rejudge.md) (스케줄링 3 row) → [T-1357](T-1357-requirements-backfill-status-rejudge.md) (backfill 1 row) 로 이어진 **requirements 상태 컬럼 stale 해소** 축의 네 번째 slice 다. T-1357 직후에도 [requirements.md](../requirements.md) 66 row 중 **41 row 가 `PLANNED`** 로 남아 있어, 표만 읽는 planner 가 이미 merge 된 기능을 "미착수" 로 오독해 중복 task 를 신설할 위험이 그대로다.

본 slice 의 대상은 **31 행 REQ-012** (코드 abusing 방지, README 26) 와 **40 행 REQ-021** (문서 abusing 방지, README 40) 두 row 다. 두 row 를 한 slice 로 묶는 근거는 **판정 근거가 완전히 동형** 이기 때문이다 — [PLAN.md](../PLAN.md) **101 행 단 하나의 bullet** 이 "코드 abusing (R-26) + 문서 abusing (R-40)" 을 함께 `[x] implemented-on-main` 으로 박제했고, 실제 구현도 두 REQ 를 가르지 않는 **동일 심볼 쌍** (`computeAbuseSignal` 신호 + `applyAbuseSignalToVolume` 감점) 이다. T-1357 이 근거 파일이 row 마다 다르면 묶지 말라고 남긴 제약을, 본 slice 는 "한 bullet · 한 심볼 쌍" 이라는 조건으로 충족한다.

[T-1357](T-1357-requirements-backfill-status-rejudge.md) Follow-ups 1 순위였던 **REQ-030 (49 행)** 은 의도적으로 건너뛴다 — [T-1339](T-1339-api-doc-backup-restore-placeholder.md) 가 backup/restore 를 placeholder 로 표기했고 Q-0055 가 import 복원 엔진을 "chain 완주 전 false-success" 로 판정한 상태라, 지금 `DONE` 으로 flip 하면 **문서가 실제보다 과장** 된다. 근거가 정리된 뒤 별도 slice 로 남긴다.

## Required Reading

- [docs/requirements.md](../requirements.md) **9 행**(상태 enum 정의), **58~60 행**(T-1356 이 만든 `DONE (…)` 부기 표기 선례), **31 행 · 40 행**(편집 대상 2 row)
- [docs/PLAN.md](../PLAN.md) **101 행** (Abusing 방지 metric — `[x]` + R-26 / R-40 를 한 bullet 으로 cover, `evaluation-abuse-signal.ts` · `evaluation-abuse-adjust.ts` 링크)
- [src/assessment-evaluation/domain/evaluation-abuse-signal.ts](../../src/assessment-evaluation/domain/evaluation-abuse-signal.ts) **2 행 주석 · 120 행** (`computeAbuseSignal` — 주석이 R-26 코드 abusing + R-40 문서 abusing 둘 다 명시)
- [src/assessment-evaluation/domain/evaluation-abuse-adjust.ts](../../src/assessment-evaluation/domain/evaluation-abuse-adjust.ts) **78 행** (`applyAbuseSignalToVolume`)
- [src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) **106 행** (`abuse: computeAbuseSignal(deduped)` — 신호 pipeline 배선)
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) **199 행** (`applyAbuseSignalToVolume(entries, signals.abuse)` — 감점 pipeline 1 순위 배선)

## Acceptance Criteria

- [x] 편집은 [docs/requirements.md](../requirements.md) **31 행과 40 행 두 줄뿐**이며, 각 줄에서 바뀌는 것은 **마지막 `상태` 컬럼 1 개**다. `REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치` 6 컬럼은 **글자 무수정** (특히 `구현 위치` 의 `P5` 와 `검증 위치` 의 `unit` 은 그대로 둔다).
- [x] 두 행 상태를 `PLANNED` → 다음 문자열로 재판정 (`|` 문자를 넣지 않는다):
  - 31 행 REQ-012: `DONE (computeAbuseSignal 반복 부풀리기 신호 + applyAbuseSignalToVolume volume 감점, adjustments pipeline 1 순위 배선)`
  - 40 행 REQ-021: `DONE (같은 computeAbuseSignal 의 R-40 문서 abusing 경로 — 코드 abusing 과 동일 심볼 쌍으로 cover)`
- [x] **실측 선행** (편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제). 아래 6 개가 모두 기대치와 일치할 때만 flip 하고, 하나라도 어긋나면 flip 하지 않고 Follow-ups 에 근거와 함께 남긴다:
  - `grep -n "export function computeAbuseSignal" src/assessment-evaluation/domain/evaluation-abuse-signal.ts` → **1 hit (120 행)**
  - `grep -n "export function applyAbuseSignalToVolume" src/assessment-evaluation/domain/evaluation-abuse-adjust.ts` → **1 hit (78 행)**
  - `grep -n "abuse: computeAbuseSignal(deduped)" src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` → **1 hit (106 행)**
  - `grep -n "applyAbuseSignalToVolume(entries, signals.abuse);" src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` → **1 hit (199 행)**
  - `ls src/assessment-evaluation/domain/evaluation-abuse-*.spec.ts` → **2 개** (`evaluation-abuse-signal.spec.ts` · `evaluation-abuse-adjust.spec.ts` — `검증 위치` 컬럼의 `unit` 충족 근거)
  - `grep -n "R-40" src/assessment-evaluation/domain/evaluation-abuse-signal.ts` → **1+ hit** (같은 심볼이 문서 abusing 까지 cover 한다는 근거. 0 이면 REQ-021 은 flip 하지 않고 REQ-012 만 처리한 뒤 Follow-ups 에 남긴다)
- [x] **구조 무손상**: 편집 후 `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-" docs/requirements.md` = **66**, 편집한 31 행 · 40 행의 `|` 개수 = **각 8**.
- [x] **잔여 stale 정직 보고**: 편집 후 `grep -c "PLANNED" docs/requirements.md` = **39** (41 − 2). 이 수치를 commit trail 에 적어 남은 stale 규모를 다음 planner 가 그대로 이어받게 한다. 날조 금지 — 실제 출력값을 적는다.
- [x] 변경 파일은 **2 개뿐** ([docs/requirements.md](../requirements.md) + 본 task 파일). `src/` · `web/` · `test/` · [PLAN.md](../PLAN.md) · `STATE.json` 무수정.
- [x] doc-only direct commit 이라 R-110 tester 면제 — 그 사유를 commit trail `TESTER.coverage` 에 한 줄 명시하고, 위 grep 검증 결과로 대체한다.

## Out of Scope

- **나머지 39 개 `PLANNED` row 의 일괄 flip 금지.** 근거가 row 마다 달라 한 commit 에 묶을 수 없다 — 다음 slice 로 남긴다.
- **REQ-030 (49 행, Export/backup + Restore) 처리 금지.** [T-1339](T-1339-api-doc-backup-restore-placeholder.md) 가 backup/restore 를 placeholder 로 표기했고 Q-0055 가 복원 엔진을 미완결(false-success) 로 판정했다 — 지금 flip 하면 과장이다.
- **REQ-022 (41 행, update 횟수 중립화) 동시 처리 금지.** [ADR-0049](../decisions/ADR-0049-doc-update-count-neutralization.md) 가 REQ-022 를 abusing set 과 **다른 stage** 로 명시 분리했으므로 근거 파일 (`evaluation-update-count-*`) 이 다르다 — 별도 slice.
- [PLAN.md](../PLAN.md) 101 행 수정 금지 (이미 `[x] implemented-on-main` 으로 정확하다 — 본 task 는 requirements 쪽만 맞춘다).
- `src/assessment-evaluation/` 코드·spec 변경 금지, **abusing 로직 보강·신규 spec 작성 금지** (본 task 는 상태 표기 doc-sync 이지 기능 확충이 아니다).
- 상태 enum 자체(9 행) 또는 표 schema 변경 금지.
- ADR 신설·갱신 금지.

## Suggested Sub-agents

`implementer` (doc-only direct 이므로 단독. R-110 면제 — Acceptance Criteria 의 grep 검증으로 대체)

## Follow-ups

- **REQ-022 (41 행, 문서 update 횟수 중립화) 상태 재판정** — [PLAN.md](../PLAN.md) **102 행**이 `[x] implemented-on-main` (`computeUpdateCountNeutralization` + `applyUpdateCountNeutralization`). 근거 심볼이 본 slice 와 다르므로 별도 slice 로 남긴다.
- **REQ-018 / REQ-019 (37 · 38 행, 품질 분류)** — [PLAN.md](../PLAN.md) **103 행** 한 bullet 이 R-37 · R-38 을 함께 `[x]` 로 박제해 본 slice 와 동형 구조다. 다음 묶음 후보 1 순위.
- **REQ-030 (49 행)** — 복원 엔진 완결 여부가 정리된 뒤에야 판정 가능 (Q-0055 chain 참조). T-1357 Follow-ups 에서 이월.

## Result (2026-08-01, DONE)

실측 6 개가 모두 기대치와 일치해 두 row 를 그대로 flip 했다.

| 검증 | 기대 | 실측 |
| --- | --- | --- |
| `computeAbuseSignal` 정의 | 1 hit (120 행) | 1 hit — 120 행 |
| `applyAbuseSignalToVolume` 정의 | 1 hit (78 행) | 1 hit — 78 행 |
| `abuse: computeAbuseSignal(deduped)` 배선 | 1 hit (106 행) | 1 hit — 106 행 |
| `applyAbuseSignalToVolume(entries, signals.abuse);` 배선 | 1 hit (199 행) | 1 hit — 199 행 |
| `evaluation-abuse-*.spec.ts` | 2 개 | 2 개 (`-signal` · `-adjust`) |
| `R-40` 주석 | 1+ hit | 2 hit — 2 행 · 94 행 |

구조 무손상: `wc -l` = 97, `^| REQ-` = 66, 31 · 40 행 `|` = 각 8. 잔여 stale: `PLANNED` = **39** (41 − 2). 변경 파일 2 개 ([docs/requirements.md](../requirements.md) + 본 파일), `src/` · [PLAN.md](../PLAN.md) · `STATE.json` 무수정. doc-only direct 라 R-110 tester 면제 — 위 grep 표로 대체.
