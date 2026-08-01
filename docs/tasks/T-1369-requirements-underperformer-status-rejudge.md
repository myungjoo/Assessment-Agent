---
id: T-1369
title: requirements.md 32 행 REQ-013 저성과자 식별 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-013]
estimatedDiff: 20
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1369-requirements-underperformer-status-rejudge.md
plannerNote: "requirements-status-resync 15 번째 slice — T-1368 Follow-ups 의 남은 PLANNED row 중 underperformer signal/adjust 실재로 stale 의심이 가장 큰 REQ-013"
---

# T-1369 — requirements.md 32 행 REQ-013 저성과자 식별 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 32 행 REQ-013 (README 27 행 — "코드 작성에 있어 기여가 현격히 떨어지는 저성과자를 식별할 수 있어야 한다") 은 아직 상태 컬럼이 `PLANNED` 이지만, `src/assessment-evaluation/domain/` 에 `evaluation-underperformer-signal.ts` (`computeUnderPerformerSignal`) 와 `evaluation-underperformer-adjust.ts` (`applyUnderPerformerAnnotation`) 및 각 spec 이 실재하고 `evaluation-detection-signals-pipeline.ts` · `evaluation-adjustments-pipeline.ts` 가 이를 참조해, 표가 실제 코드베이스와 어긋날 가능성이 크다. T-1368 Follow-ups 가 "남은 `PLANNED` row 재판정" 을 다음 slice 후보로 남겼고, `requirements-status-resync` stream 의 15 번째 slice 로 표를 requirements 추적의 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 32 행 (REQ-013) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum
- `docs/tasks/T-1368-requirements-batch-fill-reset-reeval-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 27 행 — REQ-013 의 원문 지시 (축 = 코드 기여가 현격히 떨어지는 저성과자의 **식별**)
- `src/assessment-evaluation/domain/evaluation-underperformer-signal.ts` — 67 행 `UNDERPERFORMER_RELATIVE_FLOOR`, 70/81 행 `UnderPerformerEntry` / `UnderPerformerSignal`, 124 행 `computeUnderPerformerSignal` 의 실 signature 와 판정식 실측
- `src/assessment-evaluation/domain/evaluation-underperformer-adjust.ts` — 68 행 `UNDERPERFORMER_NARRATIVE_MARKER`, 120 행 `applyUnderPerformerAnnotation` — 식별 결과가 어디에 노출되는지 실측
- `src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts` · `evaluation-adjustments-pipeline.ts` — 두 심볼이 실제 평가 flow 에 wiring 돼 있는지 실측
- `src/assessment-evaluation/domain/evaluation-underperformer-signal.spec.ts` · `evaluation-underperformer-adjust.spec.ts` — 검증 위치 컬럼 `unit` 의 실 근거 실측

## Acceptance Criteria

- [ ] **식별 로직 축**을 실측한다 — `evaluation-underperformer-signal.ts` 의 export 함수 signature (인자 타입 · 반환 타입) 와 저성과 판정 기준 (어떤 값이 어떤 임계 대비 낮을 때 저성과로 판정하는지, `UNDERPERFORMER_RELATIVE_FLOOR` 의 값과 비교 대상) 을 한 절로 요약해 인용한다. 추측한 심볼명·수식을 적지 않는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "computeUnderPerformerSignal\|applyUnderPerformerAnnotation" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, (a) 실제 평가 pipeline (`evaluation-detection-signals-pipeline.ts` / `evaluation-adjustments-pipeline.ts` / `evaluation-orchestrator.service.ts`) 에서 호출되는지 (b) 정의만 있고 호출 0 인지 구분해 명시한다. 호출 0 이면 `DONE` 근거로 쓰지 않는다.
- [ ] **식별 결과의 노출 경로**를 실측한다 — 저성과 판정이 narrative marker (`UNDERPERFORMER_NARRATIVE_MARKER`) · 점수 조정 · 별도 필드 중 무엇으로 사용자에게 드러나는지, 그리고 그 값이 영속되는 컬럼 (`prisma/schema.prisma` 의 `Summary` / `EvaluationResult` 중 어디) 이 있는지 확인해 경로를 인용한다. 전용 영속 컬럼이 없으면 "narrative 문자열 prefix 로만 노출" 처럼 사실대로 적는다.
- [ ] **검증 위치 컬럼 `unit` 의 실 근거**를 확인한다 — `grep -c "it(" src/assessment-evaluation/domain/evaluation-underperformer-signal.spec.ts` · `evaluation-underperformer-adjust.spec.ts` 로 개수를 실측해 spec 경로와 개수를 상태 문자열에 인용한다. 저성과자 축을 cover 하는 e2e 가 따로 있는지도 확인하고, 없으면 한계로 적는다.
- [ ] REQ-013 (32 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 저성과 임계값의 튜닝 근거, 조직/그룹 상대 비교 기반 여부, UI 노출 여부, 오탐 시 사람 개입 경로) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-013" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분 8 개) 가 인접 행 (REQ-012 · REQ-014) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). 저성과자 식별의 e2e 나 전용 endpoint 가 없더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- T-1368 Follow-ups 가 남긴 명시적 Reset endpoint 신설 — 별도 `pr` task 다.
- 인접 REQ-012 (31 행) · REQ-014 (33 행) 재판정 — 본 task 대상이 아니다.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-013 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
