---
id: T-0426
title: 최근 N일 manual delete 대상 산출 순수 조립 helper (buildRecentDeletionPlan)
phase: P7
status: DONE
commitMode: pr
completedAt: 2026-06-15T21:08:00Z
result: "PR #343 squash 474fa82 머지(reviewer round1 APPROVE, 4-게이트 PASS, CI green). buildRecentDeletionPlan(reference, days, instants): RecentDeletionPlan{window,toDelete,toKeep} 순수 조립 helper — buildRecentDeletionWindow + selectInDeletionWindow 두 helper 호출만(재구현 0), non-mutating, 인자 검증 위임/전파. 신규 helper 100% line/branch/func cov. src/scheduling/recent-deletion-plan.ts +spec(+203 LOC)."
coversReq: [REQ-041]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-16
independentStream: p7-reeval
dependsOn: []
touchesFiles:
  - src/scheduling/recent-deletion-plan.ts
  - src/scheduling/recent-deletion-plan.spec.ts
plannerNote: "P7 ⑤/R-74(REQ-041) slice 1c — 두 helper 조립 순수 plan helper, pr, buildBackfillPlan 패턴 mirror, schema/cycle/배선 0 (runner 게이트 전 마지막 ungated 단추)"
---

# T-0426 — 최근 N일 manual delete 대상 산출 순수 조립 helper (buildRecentDeletionPlan)

## Why

PLAN.md P7 의 "최근 N일 결과 manual delete → 재수집 (예: 1일/7일/30일, R-74)" 즉 REQ-041 (PLANNED) stream 의 세 번째 순수-helper slice 다. slice 1(T-0424, `buildRecentDeletionWindow`)이 "어느 기간을 지울지"([start,end) PeriodRange)를, slice 1b(T-0425, `selectInDeletionWindow`)가 "주어진 instant 들 중 무엇이 그 기간에 드는가"를 각각 따로 산출했다. 본 slice 는 그 둘을 **순수 조립**해 호출자 한 번의 입력(reference 시점 + days + 후보 결과 instant 목록)으로 "최종 삭제 대상 / 보존 대상" plan 을 산출하는 단일 진입점을 박제한다. backlogNote 의 다음 우선순위인 slice 2(실 삭제 runner + 재수집 trigger 배선)는 repository delete + module wiring 으로 **module-순환 architect 게이트**라 즉시 진행 불가하다 — 본 task 는 그 runner 가 소비할 plan 산출을 게이트 없이 미리 완결하는 마지막 단추다. T-0418 `buildBackfillPlan`(순수 planner) → T-0419 runner 분리와 동형(plan 먼저, 실행 후속). DB·trigger·repository·module 호출 0.

## Required Reading

- `src/scheduling/recent-deletion-window.ts` — slice 1 `buildRecentDeletionWindow(reference, days): PeriodRange`. 본 helper 가 첫 단계로 호출(시그니처 불변·재구현 금지).
- `src/scheduling/deletion-window-select.ts` — slice 1b `selectInDeletionWindow(window, instants): DeletionWindowSelection`(`inWindow` / `outOfWindow`). 본 helper 가 둘째 단계로 호출(시그니처 불변·재구현 금지).
- `src/scheduling/backfill-plan.ts` (lines 1-63) — mirror 할 순수-planner 패턴(KST helper 위임, 자체 산술 금지, 인자 검증 위임/전파, 실행 0). 본 task 는 building block 호출만 하고 자체 경계 산술/필터 산술을 두지 않는다.
- `src/scheduling/recent-deletion-window.spec.ts` (lines 1-40) + `src/scheduling/deletion-window-select.spec.ts` (lines 1-40) — colocated spec 의 R-112 4종 + 고정 window/instant 단언 패턴. 본 task 의 colocated spec `src/scheduling/recent-deletion-plan.spec.ts` 가 따를 convention.

## Acceptance Criteria

- [ ] `src/scheduling/recent-deletion-plan.ts` 신설 — `buildRecentDeletionPlan(reference: Date, days: number, instants: ReadonlyArray<Date>): RecentDeletionPlan` 순수 함수 export. 내부에서 (1) `buildRecentDeletionWindow(reference, days)` 로 window 를 산출하고 (2) 그 window 와 `instants` 를 `selectInDeletionWindow` 에 넘겨 분류한 뒤, (3) 결과를 도메인 의미로 매핑한 plan 을 반환. **두 building block 의 시그니처/로직을 재구현하지 않는다** — 호출만(backfill-plan.ts 동형, 자체 경계/필터 산술 0).
- [ ] `RecentDeletionPlan` interface export — 최소 필드: `window: PeriodRange`(산출된 삭제 기간), `toDelete: Date[]`(window 안 = 삭제 대상, `selectInDeletionWindow` 의 `inWindow` 매핑), `toKeep: Date[]`(window 밖 = 보존, `outOfWindow` 매핑). 필드명/도메인 라벨은 본문 주석으로 의미 명시(삭제 대상=in-window 반열림 [start,end)). non-mutating — 입력 `instants` 배열 변형 0, 새 배열 반환.
- [ ] 인자 검증은 **building block 에 위임**(자체 중복 검증 불요, backfill-plan.ts 동형): `days` 정수 아님/0 이하/상한 초과 → `buildRecentDeletionWindow` 의 `RangeError` 전파, 비-Date/Invalid `reference` → 위임 helper `TypeError` 전파, `instants` 비-배열/원소 Invalid → `selectInDeletionWindow` 의 `TypeError` 전파. 빈 `instants` 배열은 정상(빈 `toDelete`/`toKeep`, error 아님).
- [ ] colocated spec `src/scheduling/recent-deletion-plan.spec.ts` 신설 — R-112 4종 충분 cover:
  - happy-path: 고정 `reference` + days=1/7/30 각각에 대해, window 안/밖/경계가 섞인 고정 instant 목록을 넣어 `toDelete`(in-window) / `toKeep`(out-of-window) 가 입력 순서 보존하며 정확히 분류됨을 단언. `plan.window` 가 `buildRecentDeletionWindow` 출력과 정합(자체 경계 산술 단언 금지 — 위임 helper 출력과 비교).
  - error path: 비-Date / Invalid Date `reference` → `TypeError`(위임 전파 확인).
  - branch/negative (예외 분기마다 1+ test, 단일 negative 금지): `days` 가 0 / 음수 / 소수 / 상한(366) 초과 → 각각 `RangeError`; `instants` 가 비-배열 → `TypeError`; `instants` 원소 중 Invalid Date 포함 → `TypeError`(index 메시지 확인).
  - 경계/non-mutating: 빈 `instants` → 빈 `toDelete`/`toKeep`(error 아님); 입력 `instants` 배열이 호출 후에도 변형되지 않음 단언; `toDelete` + `toKeep` 길이 합 == 입력 길이(중복/누락 0).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 helper 는 100% 목표).
- [ ] tester 가 `pnpm test:smoke` / `pnpm test:e2e` 회귀 없음 확인(신규 순수 helper 라 영향 0 예상).

## Out of Scope

- 실 삭제 호출(AssessmentRepository.delete / deleteMany / findByPerson 연동) — 후속 slice 2 delete runner service.
- 재수집(re-collect) trigger 배선(CollectionTriggerService.triggerCollection 순회) — 후속 slice 2 runner.
- REST endpoint(controller/DTO) — 후속 slice.
- DB schema 변경(삭제 표식 컬럼 등) — schema 게이트, 사람 승인 필요(§5 BLOCKED).
- PersonService hook / module wiring(`scheduling.module.ts` provider 추가) 변경 — module 순환 게이트(ADR-0029 §1), 본 task 무관. 본 helper 는 어떤 service/module 에도 등록되지 않는 순수 함수.
- 두 building block helper 의 동작/시그니처 수정 — 본 task 는 조립만, 재구현 0.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어있음)
