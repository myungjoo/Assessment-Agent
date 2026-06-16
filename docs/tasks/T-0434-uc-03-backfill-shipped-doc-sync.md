---
id: T-0434
title: UC-03 §6.3 신규 인원 1년치 평가에 shipped backfill 구현 doc-sync
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-027]
estimatedDiff: 9
estimatedFiles: 1
created: 2026-06-16
dependsOn: [T-0419, T-0420, T-0421]
independentStream: p7-req027-doc-sync
touchesFiles: [docs/use-cases/UC-03-person-crud.md]
plannerNote: P7 R-50/REQ-027 — UC-03 §6.3 conceptual NewPersonEvent↔shipped backfill endpoint/runner gap doc-sync, direct doc-only, 게이트 없음
---

# T-0434 — UC-03 §6.3 신규 인원 1년치 평가에 shipped backfill 구현 doc-sync

## Why

PLAN.md P7 "신규 인원 추가 시 1년치 평가 1회 (R-50)" 항목의 구현은 P7 에서 이미 shipped 됐다 — `POST /api/schedules/backfill/:personId` (T-0421 PR #340), `BackfillRunnerService.runBackfill` (T-0419), `AssessmentBackfillChecker` idempotency proxy (T-0420), api.md §5 표 backfill 행. 그러나 UC-03 §6.3 (신규 인원 추가 시 1년치 평가 1회, REQ-027) 은 여전히 P2 설계기 conceptual 흐름 (`NewPersonEvent (personId, windowDays=365)` → AssessmentModule → SchedulerModule/Worker queue enqueue) 만 박제하고 P7 shipped 진입점을 0회 참조한다 — doc/reality gap. 직전 REQ-041 doc-sync chain (UC-06 §6.5 T-0431 / UC-01 §3 T-0432 / modules.md T-0433) 과 동형으로 본 task 가 UC-03 에 shipped 구현 참조 addendum 을 박제해 gap 을 해소한다.

## Required Reading

- `docs/use-cases/UC-03-person-crud.md` — §6.3 (신규 인원 1년치 평가) / §11 References (편집 대상)
- `docs/architecture/api.md` L138 — shipped `POST /api/schedules/backfill/:personId` 행 (참조 link 대상, 편집 안 함)
- `docs/tasks/T-0431-uc-06-recent-deletion-doc-sync.md` — 동형 addendum 패턴 template (UC-06 §6.5 shipped 참조 절)

## Acceptance Criteria

- [ ] UC-03 §6.3 에 짧은 "shipped 구현 참조 (P7 R-50)" addendum 1 문단 추가 — 다음 shipped 사실 박제:
  - `POST /api/schedules/backfill/:personId` (T-0421 PR #340, Admin+) 가 manual 1년치 (52주) backfill 진입점.
  - `BackfillRunnerService.runBackfill(personId)` (T-0419) 가 1년치 window 순회 → triggerCollection 위임 (재구현 0).
  - `AssessmentBackfillChecker` (T-0420) 가 직전 Assessment 존재를 proxy 로 "이미 backfill 됨" 판정해 중복 backfill 차단 (REQ-027 "1회" 보장) — 전용 영속 표식 (예: `Person.backfilledAt`) 은 미shipped (schema 게이트, slice 3 책임) 한정 명시.
  - P2 설계기 `NewPersonEvent` 자동 emit 흐름은 미shipped — 현재는 manual endpoint 가 shipped 진입점임을 명시.
- [ ] §11 References 에 api.md §5 backfill 행 링크 1줄 추가.
- [ ] §3 trigger / §5 sequence diagram / §8 postcondition / §9 mapping / §10 REQ 표 / mermaid 는 불변 (P2 의도·MVA 범위 존중).
- [ ] diff ≤ ~20 LOC, UC-03 1 파일만 변경 (`docs/use-cases/UC-03-person-crud.md`).
- [ ] R-110 / R-112 면제 — direct doc-only commit (src/test 0 LOC, 새 public symbol 0, 분기 0).

## Out of Scope

- 실 `Person.backfilledAt` 또는 전용 영속 표식 신설 (schema 게이트, slice 3).
- `NewPersonEvent` 자동 emit 흐름의 실 배선 (module 순환 / event-bus architect 게이트).
- api.md / modules.md / 다른 UC 편집 (본 task 는 UC-03 1 파일만).
- §5 mermaid sequence diagram 의 P2 conceptual flow 재작성 (P2 의도 존중 — addendum 만 추가).

## Suggested Sub-agents

`implementer` (단일 doc 편집; direct doc-only 라 tester 면제 — R-110 면제 단락 참조).

## Follow-ups

(없음 — 생성 시점)
