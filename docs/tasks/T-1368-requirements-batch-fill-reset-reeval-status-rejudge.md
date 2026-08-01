---
id: T-1368
title: requirements.md 56 행 REQ-037 평가 없는 부분 일괄 평가 + Reset & Reeval 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-037]
estimatedDiff: 18
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1368-requirements-batch-fill-reset-reeval-status-rejudge.md
plannerNote: "requirements-status-resync 14 번째 slice — T-1367 Follow-ups 가 지목한 REQ-037 (unevaluated-fill chain + deleteMany reset 실재로 PLANNED stale 의심)"
---

# T-1368 — requirements.md 56 행 REQ-037 평가 없는 부분 일괄 평가 + Reset & Reeval 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 56 행 REQ-037 (README 64 행 — "평가 결과가 없는 부분에 대해서는 일괄적으로 평가를 해 주면 되며, 개발 과정에서 디버깅 등의 목적으로 Reset & Reeval을 할 수 있어야 한다") 은 아직 상태 컬럼이 `PLANNED` 이지만, `src/assessment-evaluation/` 에 `evaluation-unevaluated-fill-planner.service.ts` · `unevaluated-fill-run-orchestrator.service.ts` · `domain/evaluation-unevaluated-fill-*.ts` 로 이어지는 일괄 평가 chain 과 `POST /unevaluated-fill-plan` · `POST /unevaluated-fill-run` 두 endpoint, `test/e2e/unevaluated-fill-plan.e2e-spec.ts` · `test/e2e/unevaluated-fill-run.e2e-spec.ts` e2e 2 종이 실재해 표가 실제 코드베이스와 어긋날 가능성이 크다. T-1367 Follow-ups 가 다음 slice 후보로 명시한 row 이며, `requirements-status-resync` stream 의 14 번째 slice 로 표를 requirements 추적의 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 56 행 (REQ-037) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum
- `docs/tasks/T-1367-requirements-relative-comparison-metric-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> / <미충족 축>)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 64 행 — REQ-037 의 원문 지시 (축 2 종 = 평가 결과 없는 부분의 일괄 평가 · 디버깅 목적 Reset & Reeval)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` 538 행 `@Post("unevaluated-fill-plan")` · 599 행 `@Post("unevaluated-fill-run")` — 일괄 평가 축의 외부 노출 지점 실측
- `src/assessment-evaluation/evaluation-unevaluated-fill-planner.service.ts` · `src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts` — plan / run 두 단계의 실 심볼 실측
- `src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts` · `domain/evaluation-unevaluated-fill-plan.ts` — "평가 결과가 없는 부분" 을 판별하는 실제 도메인 로직 실측
- `src/assessment-evaluation/summary-persist.service.ts` 146 행 부근 `deleteMany` — Reset 축 (reset-and-recreate) 의 실 근거 실측
- `test/e2e/unevaluated-fill-plan.e2e-spec.ts` · `test/e2e/unevaluated-fill-run.e2e-spec.ts` — 검증 위치 컬럼 `e2e` 의 실 근거 실측

## Acceptance Criteria

- [ ] **일괄 평가 축**을 실측한다 — `assessment-evaluation.controller.ts` 의 `unevaluated-fill-plan` / `unevaluated-fill-run` endpoint 의 HTTP method · 경로 · 행 번호를 확인하고, 호출되는 service 심볼명 (export class / 메서드) 을 확인해 상태 문자열에 인용한다 (추측한 심볼명을 적지 않는다).
- [ ] **"평가 결과가 없는 부분" 판별 로직**을 실측한다 — `domain/evaluation-unevaluated-period-select.ts` 또는 `domain/evaluation-unevaluated-fill-plan.ts` 의 export 함수 signature 와 "없음" 판정 기준 (어떤 값의 부재로 미평가를 판단하는지) 을 한 절로 요약해 인용한다.
- [ ] **Reset & Reeval 축을 별도로 판정한다** — `grep -rn "deleteMany" src/assessment-evaluation --include=*.ts | grep -v spec` 로 reset 경로를 찾고, 그 호출이 (a) 외부 endpoint 로 노출된 명시적 reset 인지 (b) 재평가 시 자동 overwrite 되는 내부 reset-and-recreate 인지 구분해 명시한다. 사용자가 명시적으로 호출 가능한 reset endpoint 가 없으면 "명시적 Reset endpoint 부재, 재평가 시 내부 overwrite 로만 충족" 으로 한계에 적는다. 없는 기능을 DONE 근거로 쓰지 않는다.
- [ ] **재평가(Reeval) 경로**를 실측한다 — 같은 좌표를 다시 평가했을 때 기존 결과가 덮이는지 (`upsert` / `deleteMany` + `create` 등) 를 `summary-persist.service.ts` 또는 `evaluation-result-persist.service.ts` 에서 확인해 호출 위치·행 번호와 함께 인용한다.
- [ ] **검증 위치 컬럼 `e2e` 의 실 근거**를 확인한다 — `grep -c "it(" test/e2e/unevaluated-fill-plan.e2e-spec.ts` · `grep -c "it(" test/e2e/unevaluated-fill-run.e2e-spec.ts` 로 개수를 실측해 spec 경로와 개수를 상태 문자열에 인용한다. Reset 축을 cover 하는 e2e/unit spec 이 따로 있는지도 확인하고, 없으면 한계로 적는다.
- [ ] REQ-037 (56 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 2 축 중 일부만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: reset 의 범위 — person 단위인지 좌표 단위인지 전체인지, UI/Admin 노출 여부, 일괄 평가의 대상 기간 산정 방식) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-037" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분 8 개) 가 인접 행 (REQ-036 · REQ-038) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). 명시적 Reset endpoint 가 없더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- T-1367 Follow-ups 가 남긴 REQ-036 상대 비교 산출 경로 구현 — 별도 `pr` task 다.
- 인접 REQ-038 (57 행) · REQ-039 (58 행) 재판정 — 이미 `DONE` 이며 본 task 대상이 아니다.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-037 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
