---
id: T-2041
title: 평가 tick runner ①  — 닫힌 기간 미평가 좌표를 기존 경로로 순차 평가하는 EvaluationTickRunnerService 신설
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-040, REQ-042]
estimatedDiff: 295
estimatedFiles: 2
created: 2026-10-30
dependsOn: []
touchesFiles: [src/scheduling/evaluation-tick-runner.service.ts, src/scheduling/evaluation-tick-runner.service.spec.ts]
plannerNote: P7 · 오너 지시 — "지금 실행" · cron 이 stub 이라 아무 일도 안 함. README 64 · 72~74 행. 2 slice 분할의 ①
---

# T-2041 — EvaluationTickRunnerService 신설 (① core)

## Why

`CRON_TICK_HANDLER` (`src/scheduling/scheduling.module.ts` `35 행`) 가 logging stub 이라 "지금 실행" 과 등록 cron 이 아무 일도 하지 않는데 UI 는 "수동 실행을 시작했습니다" 라고 말한다. [ADR-0042](../decisions/ADR-0042-p7-scheduling.md) § Decision 2 는 cron · manual 이 단일 실행 함수를 공유하고 scheduler 는 기존 경로만 호출한다고 정했다. 본 slice 는 그 실행 함수를 만든다. 배선은 T-2042 몫이라 머지 후에도 동작 변화는 0 이다.

`UnevaluatedFillRunOrchestratorService` 는 쓰지 않는다. 그 좌표 runner (`build-unevaluated-fill-coordinate-runner.ts` `149 행`) 가 `{ since }` 만 넘겨 창 이후 활동이 좌표에 영속되기 때문이다.

## Required Reading

- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `154~195 행`, `evaluation-unevaluated-fill-planner.service.ts`, `src/common/period-boundary.ts` `193~205 행`, `src/run-status/run-status.service.ts`, README `58~64` · `72~74 행`.

## Acceptance Criteria

- [ ] `run()` 은 reject 하지 않고, 실행 중 재호출은 경고 후 두 번째 실행을 만들지 않는다.
- [ ] `RunStatusService.begin("evaluation")` / `end` 를 try/finally 로 감싼다.
- [ ] `resolveDefaultModelId()` 실패 시 error 로그 후 아무 작업 없이 멈춘다. 활성 인원 0 이면 계획하지 않는다.
- [ ] 닫힌 기간만 계획한다: 일 = 최근 7 일, 주 · 월 = 직전 1 개. 경계는 `getKstPeriodRangeByPeriod` 만 쓴다.
- [ ] 각 gap 은 같은 range 호출의 `since` · `until` 로 fill 모드 `generateAndPersist` 를 순차 호출한다.
- [ ] 좌표 · 인원 · 계획 실패는 흡수 · 집계되고 나머지를 막지 않으며, 끝에 요약 로그를 남긴다.
- [ ] R-112: happy · error · 분기 · 예외 분기 negative 를 colocated spec 으로 cover (line · function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI (unit · smoke · e2e) green.

## Out of Scope

- module 배선 · controller 주석 · e2e, 수집 불가 인원 skip, 종료 hook — T-2042.
- README `58 행` 지난 주 재수집, `POST /unevaluated-fill-run` 의 `until` 누락 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무 예외) 소비처 포함 시 실측 약 +450 LOC · 5 파일로 300 LOC cap 을 넘는다 (runner 178 · spec 208 · module · controller · e2e 60+, 실 e2e 별도). 그래서 배선을 **T-2042** 로 분리한다: `src/scheduling/scheduling.module.ts` 의 `CRON_TICK_HANDLER` useFactory 를 runner 로 교체 + Evaluation · User · Llm · RunStatus import, `cron-schedule.controller.ts` stale 주석 갱신, service identity 0 · 수집 대상 0 인원 skip, `onModuleDestroy` 종료 대기, `test/e2e/schedules-cron.e2e-spec.ts` 실 e2e.
