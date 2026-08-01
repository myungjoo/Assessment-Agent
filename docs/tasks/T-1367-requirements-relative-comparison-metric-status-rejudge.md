---
id: T-1367
title: requirements.md 55 행 REQ-036 상대 비교·LLM 정성·Metric 수치 보유 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-036]
estimatedDiff: 18
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1367-requirements-relative-comparison-metric-status-rejudge.md
plannerNote: "requirements-status-resync 13 번째 slice — T-1366 Follow-ups 가 지목한 REQ-036 (Summary.narrative + metricScore 실재로 PLANNED stale 의심)"
---

# T-1367 — requirements.md 55 행 REQ-036 상대 비교·LLM 정성·Metric 수치 보유 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 55 행 REQ-036 (README 63 행 — "평가 문은 개발자들 간 상대적인 비교도 가능할 수 있어야 하며, 주간/월간 활동 요약기록은 LLM에 의한 정성적 평가 결과 외에 개발된 Metric에 의한 수치적 평가 결과도 함께 보유하도록 한다") 은 아직 상태 컬럼이 `PLANNED` 이지만, `prisma/schema.prisma` 361 행 `Summary` model 에 `narrative String` (LLM 정성) 과 `metricScore Decimal` (Metric 수치) 두 컬럼이 나란히 실재하고 `src/assessment-evaluation/summary-narrative.service.ts` · `domain/summary-aggregate.ts` 의 `aggregateMetricScore()` 가 두 축의 산정 경로로 존재해 표가 실제 코드베이스와 어긋날 가능성이 크다. T-1366 Follow-ups 가 다음 slice 후보로 명시한 row 이며, `requirements-status-resync` stream 의 13 번째 slice 로 표를 requirements 추적의 신뢰 가능한 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 55 행 (REQ-036) 및 9 행의 상태 enum 정의, 10 행의 검증 위치 enum
- `docs/tasks/T-1366-requirements-per-unit-contribution-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 63 행 — REQ-036 의 원문 지시 (축 3 종 = 개발자 간 상대 비교 가능성 · LLM 정성 평가 · Metric 수치 평가, 대상 = 주간/월간 활동 요약기록)
- `prisma/schema.prisma` 361~380 행 `Summary` model — `narrative String` · `metricScore Decimal` 컬럼과 `@@unique([personId, period, periodStart])` · `@@index([personId, period, periodStart])` 실측
- `src/assessment-evaluation/summary-narrative.service.ts` — LLM 정성 축 (좌표당 `gateway.generate` 1 회로 narrative 생성) 실측
- `src/assessment-evaluation/domain/summary-aggregate.ts` 84 행 `aggregateMetricScore()` — Metric 수치 축의 산정 함수 실측
- `src/assessment-evaluation/summary-persist.service.ts` · `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` — 두 축이 하나의 Summary row 로 결합·영속되는 배선 실측
- `docs/decisions/ADR-0035-*.md` — §Decision 1 (narrative = LLM 정성) / §Decision 4 (좌표 unique) 등 두 축 분리 결정의 근거 확인

## Acceptance Criteria

- [ ] `prisma/schema.prisma` 의 `Summary` model 을 실측해 LLM 정성 축과 Metric 수치 축에 대응하는 실제 컬럼명·타입 (예: `narrative String` · `metricScore Decimal`) 과 좌표 키 (`personId` · `period` · `periodStart` + `@@unique`) 를 상태 문자열에 행 번호와 함께 인용한다 (추측한 컬럼명을 적지 않는다).
- [ ] LLM 정성 축의 산정 지점을 실측한다 — `summary-narrative.service.ts` 의 export class/메서드명과 LLM 호출 지점 (행 번호 포함) 을 확인해 상태 문자열에 인용한다.
- [ ] Metric 수치 축의 산정 지점을 실측한다 — `domain/summary-aggregate.ts` 의 `aggregateMetricScore()` signature 와 입력 (어떤 값들로 수치를 만드는지) 을 확인해 상태 문자열에 인용한다. "개발된 Metric" 의 실체가 무엇인지 (단순 평균인지 가중 합인지 등) 를 한 절로 요약한다.
- [ ] 두 축이 **하나의 Summary row 에 함께** 영속되는 배선을 grep 으로 확인한다 (예: `grep -n "metricScore\|narrative" src/assessment-evaluation/summary-persist.service.ts`). create/upsert 호출 위치와 행 번호를 확인해 상태 문자열에 명시한다. 배선이 확인되지 않으면 DONE 근거로 쓰지 않는다.
- [ ] README 원문의 대상 범위 (주간/월간 활동 요약기록) 가 cover 되는지 `period` 가 취하는 값 집합으로 확인한다 (예: `grep -rn "week\|month" src/assessment-evaluation --include=*.ts | grep -v spec | head`). 주간·월간 중 한쪽만 확인되면 그 사실을 한계로 적는다.
- [ ] **"개발자 간 상대적인 비교 가능" 축을 별도로 판정한다** — 비교를 가능케 하는 실 근거 (예: 동일 척도 `metricScore` 의 person 간 비교 가능성, `@@index([personId, period, periodStart])` 기반 조회, sort/filter 를 제공하는 controller/endpoint) 를 grep 으로 찾는다. 순위 · 백분위 · person 간 비교 전용 산출 심볼이 없으면 "비교 전용 산출 경로는 부재, 동일 척도 컬럼 제공까지만 충족" 으로 한계에 명시한다. 없는 기능을 DONE 근거로 쓰지 않는다.
- [ ] 관련 spec 파일 목록과 각 파일의 `it(` 개수를 실측해 (예: `grep -c "it(" src/assessment-evaluation/domain/summary-aggregate.spec.ts`), 검증 위치 컬럼 `unit` 이 실제 근거를 갖는지 확인한 뒤 spec 경로와 개수를 상태 문자열에 인용한다.
- [ ] REQ-036 (55 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)` 또는 3 축 중 일부만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 상대 비교의 UI/API 노출 여부, Metric 정의의 README 의도 부합, 일별 요약과 주간/월간 요약의 축 차이) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-036" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분 8 개) 가 인접 행 (REQ-035 · REQ-037) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). 상대 비교 산출 경로가 없더라도 본 task 에서 구현하지 않는다 — Follow-ups 로만 남긴다.
- 인접 REQ-037 (56 행, 일괄 평가 + Reset & Reeval) 의 재판정 — 다음 slice 다. 건드리지 않는다.
- 난이도 3 종 모델 (REQ-050) · 성능 (REQ-047/048) row 재판정 — 각각 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-036 외 다른 `PLANNED` row 재판정.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어있음 — sub-agent 가 관련 작업 발견 시 append)
