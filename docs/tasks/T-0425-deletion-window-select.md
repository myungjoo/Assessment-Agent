---
id: T-0425
title: 삭제 window 내 평가 결과 선별 순수 helper
phase: P7
status: DONE
prNumber: 342
mergedAs: 9455809
reviewRounds: 1
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-16
independentStream: p7-reeval
dependsOn: []
touchesFiles:
  - src/scheduling/deletion-window-select.ts
  - src/scheduling/deletion-window-select.spec.ts
plannerNote: "P7 ⑤/R-74(REQ-041) slice 1b — 삭제 window [start,end) 내 결과 선별 순수 helper, pr, buildRecentDeletionWindow(T-0424) 소비, schema/cycle/배선 0"
---

# T-0425 — 삭제 window 내 평가 결과 선별 순수 helper

## Why

PLAN.md P7 의 "최근 N일 결과 manual delete → 재수집 (예: 1일/7일/30일, R-74)" 즉 REQ-041 의 두 번째 순수-helper slice 다. slice 1(T-0424, `buildRecentDeletionWindow`)이 "어느 기간을 지울지"([start, end) PeriodRange)를 산출했다면, 본 slice 는 그 window 를 소비해 "주어진 결과 instant 들 중 무엇이 그 기간에 드는가"를 **순수 선별**한다. 실 삭제 runner(slice 2)는 repository delete + 재수집 trigger 배선이 필요해 module 순환 architect 게이트 대상(backlogNote 명시)이라 즉시 진행 불가하다. 본 task 는 그 runner 가 소비할 선별 로직을 게이트 없이 미리 박제하는 schema-free·cycle-free 단추로, T-0418 `buildBackfillPlan` → T-0419 runner 분리와 동형(helper 먼저, 실행은 후속)이다. DB·trigger·repository 호출 0.

## Required Reading

- `src/scheduling/recent-deletion-window.ts` — 본 helper 가 소비할 `buildRecentDeletionWindow` 출력(`PeriodRange [start, end)`)과 KST 일 경계 의미. 본 task 는 이 함수를 직접 호출하지 않아도 되며, 인자로 `PeriodRange` 를 받는 형태로 분리한다(호출자가 window 를 만들어 넘김 — runner 가 두 helper 를 조립).
- `src/scheduling/backfill-plan.ts` — mirror 할 순수 helper 패턴(자체 경계/시간 산술 금지, 인자 검증 RangeError/TypeError 전파, 부수효과 0).
- `src/common/period-boundary.ts` (lines 1-50) — `PeriodRange` 타입 정의([start, end) 반열림 — start 포함, end 배타)와 `assertValidDate` 의 비-Date/Invalid Date → `TypeError` convention.

## Acceptance Criteria

- [ ] `src/scheduling/deletion-window-select.ts` 신설 — 다음 순수 함수 1개 export. 시그니처 예: `selectInDeletionWindow(window: PeriodRange, instants: ReadonlyArray<Date>): { inWindow: Date[]; outOfWindow: Date[] }` (또는 동등하게 in-window 만 반환 + 본문에 분류 정책 명시). 각 instant 가 `window.start <= instant < window.end` 반열림 규칙을 만족하면 in-window 로 분류한다(end 배타 — `PeriodRange` 의미 정합).
- [ ] **반열림 [start, end) 경계 정책을 정확히 준수** — `instant === window.start` 는 in-window, `instant === window.end` 는 out-of-window. 자체 timezone/offset 산술 금지(instant 끼리 `getTime()` 비교만 — 경계 의미는 호출자가 넘긴 `window` 가 이미 KST 일 경계에 snap 돼 있음).
- [ ] `window` 검증: `window.start` / `window.end` 가 Date instance 아님 / Invalid Date → `TypeError`(period-boundary 의 `assertValidDate` 와 동형 메시지 또는 재사용). `start >= end`(역전/빈 구간) → `RangeError`.
- [ ] `instants` 검증: 배열 아님 → `TypeError`. 배열 원소 중 비-Date / Invalid Date 가 있으면 `TypeError`(어느 index 인지 메시지에 포함). 빈 배열은 정상(빈 분류 결과 반환 — error 아님).
- [ ] 입력 배열을 변형하지 않는다(non-mutating — 입력 `instants` 의 순서/내용 보존, 새 배열 반환). 결과 분류 배열의 순서는 입력 순서 보존.
- [ ] colocated spec `src/scheduling/deletion-window-select.spec.ts` 신설 — R-112 4종 cover:
  - happy-path: window 안/밖/경계 섞인 instant 목록 → in-window/out-of-window 정확 분류(start 포함·end 배타 단언 포함). 빈 배열 입력 → 빈 분류.
  - error path: `window.start`/`window.end` 비-Date·Invalid Date → `TypeError`; `instants` 배열 아님 → `TypeError`.
  - branch/negative: `start >= end` → `RangeError`(start==end 와 start>end 각각); `instants` 원소에 Invalid Date 포함 → `TypeError`(예외 분기마다 1+ test — 단일 negative 금지).
  - 경계 정합: `instant === window.start` 는 in-window, `instant === window.end` 는 out-of-window 임을 명시 단언; 입력 배열 non-mutating 단언.
- [ ] 추가/수정된 public symbol(`selectInDeletionWindow`)에 happy-path test 1+ 및 error path test 1+ 포함(위 항목으로 충족).
- [ ] 분기마다 test branch 분리(검증 분기 · 경계 분기 각 1+).
- [ ] negative cases 충분 cover — 역전 구간·Invalid Date·비-배열·경계값 각 1+ test(단일 negative 금지).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%; 신규 helper 는 100% 목표).
- [ ] tester 가 `pnpm test:smoke` / `pnpm test:e2e` 회귀 없음 확인(신규 순수 helper 라 영향 0 예상).

## Out of Scope

- 실 삭제 호출(AssessmentRepository.delete / deleteMany / findByPerson 연동) — slice 2 delete runner(module 순환 architect 게이트).
- 재수집(re-collect) trigger 배선(CollectionTriggerService 호출) — slice 2.
- REST endpoint(controller/DTO) 추가 — 후속 slice.
- DB schema 변경(삭제 표식 컬럼 등) — schema 게이트, 사람 승인 필요(§5 BLOCKED).
- PersonService hook / SchedulingModule provider 등록 변경 — module 순환 게이트, 본 task 무관(순수 helper 라 DI 불요).
- `buildRecentDeletionWindow` 직접 호출 — 본 helper 는 `PeriodRange` 를 인자로만 받고, 두 helper 조립은 후속 runner 책임.
- api.md doc-sync — 본 helper 는 endpoint 가 아니므로 doc-sync 불요(후속 runner/endpoint slice 에서).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어있음)
