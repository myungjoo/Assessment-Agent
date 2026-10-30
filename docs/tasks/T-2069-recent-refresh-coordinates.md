---
id: T-2069
title: 최근 N일 재수집 ① — 어제까지의 닫힌 창과 교체 대상 좌표를 계산하는 순수 helper
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: e15ba4cf
prNumber: 1630
reviewRounds: 2
commitMode: pr
coversReq: [REQ-041, REQ-031]
estimatedDiff: 245
estimatedFiles: 2
created: 2026-10-31
dependsOn: []
touchesFiles: [src/scheduling/recent-deletion-coordinates.ts, src/scheduling/recent-deletion-coordinates.spec.ts]
plannerNote: P7 · 오너 지시 — "최근 N일 삭제 후 재수집" 이 아무 일도 안 함. README 58 · 74 행. arc ①
---

# T-2069 — 재수집 대상 좌표 계획

## Why

Admin 패널의 "재수집 시작" 은 빈 `instants` 를 보내 no-op 이고, `RECENT_DELETION_DELETER` 는 바인딩된 적이 없어 삭제도 0 건이다. 재수집 쪽 `triggerCollection` 은 수집만 하고 평가하지 않은 placeholder row 를 만든다. 삭제와 평가를 모두 실제로 수행하도록 고치는 arc 의 첫 조각이다.

## 설계 결정 (arc 전체)

- **삭제 후 재수집이 아니라, 좌표별 "수집 · 평가 후 교체"** 다. 저장본을 먼저 지우면 GitHub 장애 시 결과가 사라진다. 그래서 `generateAndPersistIfCollected(..., reevaluate=true)` 를 좌표마다 호출한다. 수집이 불완전하면 `null` 이라 이전 row 가 남고, 완전하면 `EvaluationResultPersistService` 의 한 트랜잭션에서 delete + create 한다. README `74 행` 의 "다음 평가 때 다시 채운다" 와 표현은 다르지만, 빈 구간을 만들지 않는 더 안전한 형태다.
- **스키마 변경 없음.** `scheduling.module.ts` 주석의 "schema 게이트" 는 사실이 아니다. Assessment · Contribution cascade 만으로 충분하다.
- **창은 어제로 끝나는 닫힌 N 일** 이다. 진행 중인 오늘은 평가하지 않으므로 (README `61 행`), 오늘을 포함하면 "최근 1일" 이 항상 빈 일이 된다. 오늘 row 는 창 밖이라 건드리지 않는다. 창 안에서 시작했지만 아직 안 끝난 주 · 월 row 도 유지하고 not refreshed 로 센다.
- **대상 좌표** = 창 안의 닫힌 aggregate 일 · 주 · 월 좌표 + 창 안에 실제 저장된 다른 scope 좌표. periodStart 가 창 밖인 row 는 평가 기간이 창과 겹쳐도 건드리지 않는다.
- **Summary 는 건드리지 않는다.** 재생성 경로가 이 흐름에 없어 지우면 복구되지 않는다. stale 가능성은 Follow-up.
- **실행은 비동기 + 상태 조회** 다. 좌표 수 × 수집 · LLM 이라 HTTP 요청 하나로 기다리기 어렵다. POST 는 202 로 바로 돌아오고 GET 으로 결과를 본다. 상태는 메모리에만 둔다 (ADR-0060 §Decision 1 과 같은 수명).
- **동시 실행**: 다른 평가 실행 (`RunStatusService` evaluation 축) 이 있으면 409. 재수집 중 tick 이 시작돼도 안전하다 — row 를 먼저 지우지 않으므로 tick 이 채울 빈 좌표가 생기지 않고, 경합한 저장은 충돌로 그 좌표만 not refreshed 가 된다.
- **README `58 행` (최근 1 주 재수집)**: 자동 tick 은 fill 모드라 이미 있는 좌표를 다시 수집하지 않는다. 이 arc 는 Admin 이 7 일을 골라 수동으로 재수집하는 경로만 제공한다. 자동 재수집은 Follow-up.

## Arc 순서

① 본 task → ② runner 실행부 (T-2070) → ③ runner 분기 test (T-2071) → ④ controller 전환 (T-2072) → ⑤ config id 평가 (T-2073) → ⑥ GET 상태 (T-2074) → ⑦ `instants` 선택화 (T-2075) → ⑧ 실 경로 e2e (T-2076) → ⑨ 패널 (T-2077) → ⑩ web 본문 (T-2078) → ⑪ 결과 조회 (T-2079) → ⑫ 인원 옵션 · 패널 배선 (T-2080) → ⑬ `instants` 제거 (T-2081) → ⑭ 사용처 없는 helper 제거 · 주석 · 문서 (T-2082).

## Required Reading

- README `58 행` · `61 행` · `74 행`, `src/scheduling/recent-deletion-window.ts`, `src/common/period-boundary.ts`.

## Acceptance Criteria

- [ ] `buildClosedDaysWindow(now, days)` 는 KST 어제로 끝나는 `days` 일의 반열림 구간이고, 오늘을 포함하지 않는다. 범위 위반은 `RangeError`.
- [ ] `planRecentRefresh` 는 닫힌 aggregate 일 · 주 · 월 좌표와 창 안 저장본을 중복 없이 합치고, 저장본이 있던 좌표를 표시한다.
- [ ] 창 밖 row 는 계획에 들어가지 않고, 창 안의 진행 중 row 는 세기만 한다.
- [ ] 경계는 `period-boundary.ts` helper 만 쓴다.
- [ ] R-112: happy · error · 분기 · negative 를 colocated spec 으로 cover. negative test 이름은 `_n` 으로 끝난다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- 실행 · 저장 · endpoint · web (② 이후).

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) 소비처 포함 시 `estimatedDiff` 약 540 · `estimatedFiles` 4 로 300 LOC cap 을 넘는다 (helper 97 + spec 150 + runner 195 + spec 100). 소비처는 T-2070: `src/scheduling/recent-deletion-runner.service.ts` 의 `startRefresh` 가 `buildClosedDaysWindow` · `planRecentRefresh` 를 호출한다.
- (owner) 자동 tick 의 최근 1 주 재수집 (README `58 행`). 지금 tick 은 빈 좌표만 채운다. reeval 로 바꾸면 인원 × 7 일의 LLM 비용이 매 tick 발생한다.
- (owner) 재수집 후 같은 좌표 Summary 재생성. 지금은 이전 Summary 가 남아 교체된 Assessment 와 어긋날 수 있다.
- `POST /collect` · backfill 의 placeholder row 는 periodStart 가 KST 경계가 아닐 수 있다. 재수집은 그 좌표 그대로 교체하므로 같은 날의 aggregate row 와 공존할 수 있다.
