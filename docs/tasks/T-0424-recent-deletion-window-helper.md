---
id: T-0424
title: 최근 N일 결과 manual delete 대상 window 산출 순수 helper
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 95
estimatedFiles: 2
created: 2026-06-16
independentStream: p7-reeval
dependsOn: []
touchesFiles:
  - src/scheduling/recent-deletion-window.ts
  - src/scheduling/recent-deletion-window.spec.ts
plannerNote: "P7 ⑤/R-74(REQ-041) slice 1 — 최근 N일 삭제 window 순수 helper, pr, buildBackfillPlan(T-0418) 패턴 mirror, schema/cycle 게이트 없음"
---

# T-0424 — 최근 N일 결과 manual delete 대상 window 산출 순수 helper

## Why

PLAN.md P7 의 "최근 N일 결과 manual delete → 재수집 (예: 1일/7일/30일, R-74)" 즉 REQ-041 (현재 PLANNED) 의 첫 slice 다. backlogNote 의 두 우선순위(slice 2 후속 a-2 PersonService hook = module 순환 게이트, slice 3 = DB schema 게이트)는 모두 architect/ADR 또는 사람 승인 게이트라 즉시 진행 불가하다. 본 task 는 게이트가 전혀 없는 REQ-041 stream 의 schema-free·cycle-free 첫 단추로, "최근 N일" 의 삭제 대상 기간 window([cutoff, end))만 산출하는 순수 helper 를 박제한다. 실 삭제/재수집은 후속 slice 가 본 출력을 소비한다(T-0418 buildBackfillPlan → T-0419 runner 와 동형 분리). DB·trigger·repository 호출 0.

## Required Reading

- `src/scheduling/backfill-plan.ts` — mirror 할 순수 helper 패턴(KST helper 위임, 자체 산술 금지, 인자 검증 RangeError/TypeError).
- `src/scheduling/backfill-plan.spec.ts` (colocated spec) — 본 task 의 colocated spec `src/scheduling/recent-deletion-window.spec.ts` 가 따를 R-112 4종 + KST helper 출력 정합 단언 패턴.
- `src/common/period-boundary.ts` (lines 1-110) — `startOfKstDay`, `getKstPeriodRange("daily", ...)`, `PeriodRange`, `KST_TIMEZONE`. 주 경계 산술 금지·KST helper 위임 정책.

## Acceptance Criteria

- [ ] `src/scheduling/recent-deletion-window.ts` 신설 — `buildRecentDeletionWindow(reference: Date, days: number): PeriodRange` 순수 함수 export. `reference` 가 속한 KST 일(day)의 끝(다음날 00:00 KST = 그 날 [start,end) 의 end)을 window 의 `end` 로, 그 시점에서 `days` 일 전 KST 일 시작을 `start` 로 하는 반열림 구간 `[start, end)` 를 반환. **반드시 `period-boundary.ts` 의 KST helper(`startOfKstDay` / `getKstPeriodRange("daily", ...)`)에 위임** — hardcoded +09:00 / 일 ms 누산으로 경계를 직접 snap 하지 않는다(근사 instant 산출용 ms 보조는 허용, 실 경계 snap 은 helper 책임, backfill-plan.ts 와 동형).
- [ ] 정규 N 옵션(1 / 7 / 30 일, R-74 명시 예)을 포함해 임의 양의 정수 `days` 를 수용. 기본값 미지정(호출자가 항상 명시) 또는 합리적 기본값 1개 — 본문에 명시.
- [ ] `days` 검증 분기: 정수 아님 / 0 이하 → `RangeError`, 상한(예: 366일=1년) 초과 → `RangeError`. 상한 상수는 module-level 명명.
- [ ] `reference` 가 `Date` instance 아님 / Invalid Date → 위임 helper 의 `assertValidDate` 가 `TypeError` 전파(자체 중복 검증 불요, backfill-plan.ts 와 동형).
- [ ] colocated spec `src/scheduling/recent-deletion-window.spec.ts` 신설 — R-112 4종 cover:
  - happy-path: days=1/7/30 각각에 대해 `[start, end)` 가 정확히 `days` KST 일 폭이고 KST 일 경계에 snap 됨을 KST helper 출력과 정합으로 단언(자체 산술 단언 금지 — helper 위임 검증).
  - error path: 비-Date / Invalid Date `reference` → `TypeError`.
  - branch/negative: `days` 가 0 / 음수 / 소수 / 상한 초과 → 각각 `RangeError`(예외 분기마다 1+ test — 단일 negative 금지).
  - 경계 정합: `start < end` 이고 `end` 가 reference 일의 다음 KST 자정과 일치, `start` 가 `days` 일 전 KST 자정과 일치.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 helper 는 100% 목표).
- [ ] tester 가 `pnpm test:smoke` / `pnpm test:e2e` 회귀 없음 확인(신규 순수 helper 라 영향 0 예상).

## Out of Scope

- 실 삭제 호출(AssessmentRepository.delete / deleteMany / findByPerson 연동) — 후속 slice(delete runner service).
- 재수집(re-collect) trigger 배선 — 후속 slice.
- REST endpoint(controller/DTO) — 후속 slice.
- DB schema 변경(삭제 표식 컬럼 등) — schema 게이트, 사람 승인 필요(§5 BLOCKED).
- PersonService hook / module wiring 변경 — module 순환 게이트(ADR-0029 §1), 본 task 무관.
- api.md doc-sync — 별도 direct doc-only follow-up.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어있음)
