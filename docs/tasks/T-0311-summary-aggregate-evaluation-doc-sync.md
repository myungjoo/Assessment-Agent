---
id: T-0311
title: Summary aggregate 평가 chain doc-sync (ADR-0035 reality 반영)
phase: P5
status: DONE
completedAt: 2026-06-10T02:55:00+09:00
mergedAs: 5f06941
commitMode: direct
coversReq: [REQ-034, REQ-035, REQ-036, REQ-064]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-06-10
plannerNote: P5 ADR-0035 §Follow-ups doc-sync slice — Summary 평가 chain(T-0306~T-0310) reality 를 data-model.md §3 관계6/§6 + modules.md AssessmentEvaluationModule 에 박제. doc-only=direct.
---

# T-0311 — Summary aggregate 평가 chain doc-sync (ADR-0035 reality 반영)

## Why

[ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Follow-ups 가 명시한 마지막 dependency-free slice = doc-sync 다. Summary 평가 chain (aggregate → narrative → persist → orchestrator) 이 T-0306~T-0310 으로 main 에 머지 완료 (`Summary.@@unique([personId, period, periodStart])` 박제, `aggregateMetricScore`/`isPeriodEvaluable` 순수 함수, `SummaryNarrativeService`/`SummaryPersistService`/`SummaryAggregateOrchestratorService` shipped) 됐으나, [data-model.md](../architecture/data-model.md) §3 관계 6 + §6 와 [modules.md](../architecture/modules.md) 의 `AssessmentEvaluationModule` row 가 이 reality 를 미반영 (실 drift — origin/main data-model.md 의 ADR-0035/SummaryPersist 언급 0 건 확인). 이 stale 을 reality 로 정합한다. README L61~L63 (REQ-034/REQ-035/REQ-036 의 일·주·월 요약 + Metric 수치 영속화) 의 평가 layer 충족 사실을 문서에 외화하는 doc-only task — 새 코드 0.

## Required Reading

- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` §Decision 1~5 + §Consequences + §Follow-ups (doc-sync 항목) — 반영할 결정 source.
- `docs/architecture/data-model.md` L62~L68 (§3 관계 5 = ADR-0033 정합 패턴 mirror 대상 + 관계 6 = stale 갱신 대상) + L138~L143 (§6 REQ-031~036 매핑) — 갱신 대상.
- `docs/architecture/modules.md` L41 (`AssessmentEvaluationModule` row — ADR-0033 persistence 까지만 박제, ADR-0035 Summary chain 미반영) — 갱신 대상.
- `prisma/schema.prisma` 의 `model Summary` 블록 (`@@unique([personId, period, periodStart])` 박제 확인 — 인용 정확성용).
- (참고만, 변경 X) `docs/progress/journal-2026-06-10.md` L3~L12 — T-0306~T-0310 머지 reality.

## Acceptance Criteria

- [ ] `docs/architecture/data-model.md` §3 **관계 6 (Person ↔ Summary, 현 L68)** 을 ADR-0035 reality 로 갱신 — 관계 5 (ADR-0033, L63~L67) 의 서술 패턴을 mirror: (a) `Summary.@@unique([personId, period, periodStart])` schema-level idempotency 박제 ([T-0305](../tasks/T-0305-summary-unique-migration.md)), (b) 재집계 = Summary 단위 reset-and-recreate (`$transaction` delete→create, fill/reeval 모드, partial-reset `resetByPeriod`, ADR-0035 §Decision 4), (c) 집계 규칙 = deterministic `metricScore` (LLM 무관, `aggregateMetricScore`) + LLM 정성 `narrative` (batch prompt 1 좌표 = 1 호출) 의 field-level 분리 (ADR-0035 §Decision 1). "P3 에서 별도 entity 도입 가능성으로 갱신될 수 있다" 의 stale 추정 문구는 reality 로 정정 (GroupSummary/PartSummary view-time 계산은 §7 / 아래 §7 GroupSummary note 와 정합 유지).
- [ ] `docs/architecture/data-model.md` §6 (REQ→entity 매핑, REQ-031 / REQ-034 / REQ-035 / REQ-036 인근) 에 Summary 영속화 shipped 사실 1~2 줄 반영 — REQ-031 의 Contribution/Assessment unique 박제 서술에 `Summary.@@unique([personId, period, periodStart])` 추가, REQ-034/035/036 의 "Summary entity" 가 이제 aggregate 평가로 영속화됨 ([ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md)) 명시.
- [ ] `docs/architecture/modules.md` `AssessmentEvaluationModule` row (L41) 에 Summary aggregate 평가 chain shipped 사실 추가 — `SummaryNarrativeService` (T-0307, batch narrative) / `SummaryPersistService` (T-0309, narrative+metricScore 결합 reset-and-recreate write service) / `SummaryAggregateOrchestratorService` (T-0310, `isPeriodEvaluable` 시점 게이트 → persist 위임 compose) + domain 순수 함수 `aggregateMetricScore` / `isPeriodEvaluable` (T-0306) 를 ADR-0033 persistence 박제 서술 뒤에 1 문장으로 박제. 관련 ADR 컬럼에 [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) 추가.
- [ ] `git grep "ADR-0035" docs/architecture/data-model.md docs/architecture/modules.md` 가 갱신 후 1+ 건 매칭 (반영 확인).
- [ ] api.md 는 **변경하지 않는다** — Summary aggregate orchestrator 는 service-level only (controller/endpoint 미배선, Q-0030 ADR-gate). 기존 `/api/summaries` CRUD (T-0119) 행과 무관. 변경 시 Out of Scope 위반.
- [ ] 본문 한국어 (§12), 식별자/경로/ADR ID/enum 영어 유지. 인용한 symbol 명·`@@unique` 표현이 `prisma/schema.prisma` 실제와 일치.

## Out of Scope

- 새 코드 / spec / migration 0 — 순수 문서 정합 (doc-only, `commitMode: direct`).
- `api.md` 변경 금지 — Summary aggregate 평가 endpoint 는 미배선 (controller/DTO/RBAC 가 Q-0030 ADR-gate, period→collection bridge 의존). HTTP 표면이 없으므로 api.md 는 stale 아님.
- `prisma/schema.prisma` 변경 금지 — `@@unique` 는 T-0305 로 이미 박제. 본 task 는 인용만.
- ADR-0035 status flip 금지 (PROPOSED → ACCEPTED 는 이미 별도 task 처리 여부 확인 후 — 본 task 범위 밖).
- §7 GroupSummary/PartSummary view-time 결정 재서술 금지 (현 서술 유지) — 본 task 는 Person-단위 Summary 영속화 reality 만.
- period→collection bridge / controller endpoint / live-LLM / timezone (Q-0026) 관련 doc 추가 금지 — 전부 미shipped, 추측 박제 금지.

## Suggested Sub-agents

doc-only direct task — executor 가 직접 Edit (architect/implementer/tester 불요, 코드 0). driver 가 direct commit + push → CI green 확인 (R-114).

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 추가)
