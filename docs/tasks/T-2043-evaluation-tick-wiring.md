---
id: T-2043
title: 평가 tick runner ③ — "지금 실행" · cron 을 실 평가에 결선하고 e2e 로 검증
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: c4467315
prNumber: 1604
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-039, REQ-040, REQ-042]
estimatedDiff: 274
estimatedFiles: 5
created: 2026-10-30
dependsOn: [T-2041, T-2042]
touchesFiles: [src/scheduling/evaluation-tick-runner.service.ts, src/scheduling/evaluation-tick-runner.service.spec.ts, src/scheduling/scheduling.module.ts, src/scheduling/cron-schedule.controller.ts, test/e2e/schedules-cron.e2e-spec.ts]
plannerNote: P7 · 평가 tick arc ③ — T-2041 runner 와 T-2042 빈 평가 차단을 소비해 stub 을 교체
---

# T-2043 — tick handler 실 결선

## Why

`CRON_TICK_HANDLER` 가 logging stub 이라 "지금 실행" 과 등록 cron 이 아무 일도 하지 않는다 (README `64` · `72~74 행`). [T-2041](T-2041-evaluation-tick-runner-core.md) 의 runner 와 [T-2042](T-2042-collection-blank-row-guard.md) 의 빈 평가 차단을 소비해 결선한다.

## Required Reading

- `src/scheduling/scheduling.module.ts`, `cron-schedule.controller.ts`, `evaluation-tick-runner.service.ts`, `src/assessment-evaluation/period-bridge-admin-persist.service.ts` `generateAndPersistIfCollected`, `test/e2e/schedules-cron.e2e-spec.ts`, `test/e2e/unevaluated-fill-run.e2e-spec.ts` `76~135 행`.

## Acceptance Criteria

- [ ] handler 는 동기 fire-and-forget 이고 POST 는 즉시 202 다.
- [ ] `SchedulingModule` 이 Evaluation · User · Llm · RunStatus 를 import 한다. 순환 없음.
- [ ] runner 는 `generateAndPersistIfCollected` 를 쓰고 `null` 을 skipped 로 집계한다. identity 0 인원은 건너뛴다.
- [ ] `app.close()` 시 종료 hook 은 새 좌표 진입을 막고 진행 중 좌표만 기다린다. production SIGTERM 연결은 범위 밖이다 (Follow-ups).
- [ ] stale 주석 (stub · Out of Scope) 을 갱신한다.
- [ ] e2e: trigger 202 → 좌표 9 개 저장 → 재실행 무중복. 장애 (401) · 미설정은 무저장 (negative), 복구 후 채움. identity 0 · provider 0 은 unit 으로 검증한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI (unit · smoke · e2e) green.

## Out of Scope

- 실 GitHub · 실 LLM round-trip, 활동이 있는 평가의 e2e.
- `POST /unevaluated-fill-run` 의 `until` 누락, README `58 행` 재수집, 창 확대, cron 영속화.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `src/main.ts` 에 `app.enableShutdownHooks()` 가 없어 production SIGTERM 에서는 종료 hook 이 돌지 않는다. 프로세스 전역 동작 변경이고 6 파일째라 별도 slice 다. 끊겨도 `persist` 는 transaction 이고 다음 tick 이 다시 채우므로 데이터 위험은 낮다.
- `src/app.module.spec.ts` `136~137 행` 주석이 사라진 stub 을 가리킨다. cap 상 본 PR 밖이다.
- e2e 재실행 단언은 월요일 · 1 일 KST 자정을 두 trigger 사이에 넘으면 실패할 수 있다 (창 1 초 안팎, 실패는 red 로 드러남).
- (CI 게이트 결함, 담당 미정) `.github/workflows/ci.yml` `304 행` 의 approve 어휘 패턴이 `approval` · `통과` 등도 매칭해 REQUEST_CHANGES comment 로도 `reviewer agent approval 검증` 이 통과한다. 본 PR 의 run 41055950788 이 그 사례다. verdict 는 comment 본문으로 판단했다.
- (별개 버그, 담당 미정) `POST /unevaluated-fill-run` 의 좌표 runner (`build-unevaluated-fill-coordinate-runner.ts` `149 행`) 가 `{ since }` 만 넘겨 창 이후 활동이 좌표에 영속된다.
