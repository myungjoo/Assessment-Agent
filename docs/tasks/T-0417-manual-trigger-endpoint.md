---
id: T-0417
title: manual trigger 엔드포인트 (POST /api/schedules/trigger — 즉시 1회 평가 발화)
phase: P7
status: DONE
commitMode: pr
prNumber: 336
mergedAs: 62edc3b
reviewRounds: 1
completed: 2026-06-15
coversReq: [REQ-040]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-15
independentStream: p7-scheduling
dependsOn: [T-0414]
touchesFiles:
  - src/scheduling/cron-schedule.controller.ts
  - src/scheduling/cron-schedule.controller.spec.ts
plannerNote: "P7 ④ — T-0414 CronScheduleController 위 manual trigger endpoint. cron tick 과 동일 CRON_TICK_HANDLER 공유(ADR-0042 §Decision2 R-73). backlogNote split."
---

# T-0417 — manual trigger 엔드포인트 (POST /api/schedules/trigger — 즉시 1회 평가 발화)

## Why

PLAN.md P7 ④ (L128 `Manual trigger (R-73)`). README R-73 / REQ-040 — "평가 진행을 Admin 이 Manual 하게 Trigger 할 수 있다" — 주기(cron) 와 무관하게 즉시 1회 평가를 발화하는 Admin 진입점이다. [ADR-0042 §Decision 2 R-73](../decisions/ADR-0042-nestjs-schedule-adoption.md) 이 박제한 대로, **cron tick callback 과 manual trigger 가 같은 내부 실행 함수를 공유**하도록 — 즉 T-0414 가 신설한 `CRON_TICK_HANDLER` 주입형 handler 를 즉시 1회 호출하는 경로로 — 구현한다 (중복 구동 로직 방지). cron 등록(③)·manual 즉시(④)·one-shot backfill(⑤) 3 진입이 같은 하위 실행 추상으로 수렴한다. 실 평가 pipeline 결선(EvaluationOrchestrator 실 호출)은 T-0414 와 동일하게 Out of Scope — 본 task 는 주입형 handler 위의 manual trigger HTTP surface 만 박제한다.

## Required Reading

- `src/scheduling/cron-schedule.controller.ts` — 본 task 가 endpoint 를 추가할 controller. `@Controller("api/schedules")`, controller-scope `ValidationPipe`, `CRON_TICK_HANDLER` 주입 패턴, 기존 3 endpoint(list/upsert/remove)의 Admin+ RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`).
- `src/scheduling/cron-schedule.controller.spec.ts` — 본 task 가 확장할 colocated spec. 4 describe block(unit / ValidationPipe integration / RBAC guard integration / real RolesGuard escalation) 구조 — manual trigger 의 happy/error/RBAC test 를 동일 구조로 추가.
- `src/scheduling/cron-schedule.service.ts` — `CronTickHandler` 타입(`() => void | Promise<void>`). manual trigger 가 service 를 거치지 않고 주입된 handler 를 직접 호출할지, service 에 위임할지 결정 시 참조(아래 Acceptance Criteria 의 권장 = controller 가 주입 handler 를 직접 호출 — service 무변경).
- `src/scheduling/scheduling.module.ts` — `defaultCronTickHandlerProvider`(no-op/logging stub) 와 `CRON_TICK_HANDLER` provider 배선. 본 task 는 module 을 수정하지 않으나(기존 provider 재사용), 주입 경로 이해를 위해 참조.
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` (§Decision 2 R-73 / §Consequences) — cron callback 과 manual trigger 가 단일 실행 추상을 공유한다는 결정 + 실 평가 결선/timezone/영속화 후속 분리.

## Acceptance Criteria

- [ ] `src/scheduling/cron-schedule.controller.ts` 에 manual trigger endpoint 1 개 추가 — `POST /api/schedules/trigger`. 주입된 `tickHandler`(`CRON_TICK_HANDLER`)를 **즉시 1회 호출**하고 `202 Accepted`(`@HttpCode(202)`) 를 반환한다(요청 본문 없음 — fire-and-forget trigger, DTO 불요). handler 가 `Promise` 를 반환하면 `await` 한다(async 메서드, `void | Promise<void>` 양쪽 분기 처리). 기존 3 endpoint 와 동일한 Admin+ RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) 적용 — Admin/SuperAdmin 통과, User 403, 인증 부재 401.
- [ ] **Happy-path unit test**: 신규 `trigger` 메서드에 대해 — 주입된 tickHandler 가 정확히 1회 호출되는지 + 정상 완료(resolve) 케이스 — happy-path test 1+. controller spec 의 unit describe block 에 `CronScheduleService` mock + jest.fn() tickHandler 주입으로 추가.
- [ ] **Error path unit test**: tickHandler 가 throw(또는 reject)하는 경우 — controller 가 그 에러를 삼키지 않고 그대로 propagate 하는지 — test 1+ (sync throw + async reject 각각 권장). handler 실패가 500 으로 표면화됨을 negative 로 cover.
- [ ] **Flow / branch coverage**: tickHandler 가 (a) 동기 `void` 반환 / (b) `Promise` 반환(await 분기) 두 경로 각각 1+ test — async/await 분기 cover. 분기 외 추가 분기 없음(있으면 각 1+).
- [ ] **Negative cases 충분 cover**: 권한 미달(User actor → 403, 인증 부재 → 401) 각 1+ test — ValidationPipe integration / RBAC guard integration / real RolesGuard escalation describe block 에 `POST /api/schedules/trigger` 케이스 추가. 실 RolesGuard escalation block 에 User 403 + Admin/SuperAdmin 202 통과(`it.each(["Admin","SuperAdmin"])`) 분기 박제. 단일 negative 만으로 부족 — 예외/권한 분기마다 cover.
- [ ] supertest integration 으로 `POST /api/schedules/trigger` 정상 시 202 + tickHandler 위임 검증 1+ (guard override 통과 mock 하에서 status code wire 확인).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global`).

## Out of Scope

- cron tick / manual trigger 의 **실 평가 pipeline 결선** (EvaluationOrchestrator / collect→evaluate 실 호출 wiring) — T-0414 와 동일하게 Out of Scope. 본 task 는 주입형 `CRON_TICK_HANDLER` 위의 manual trigger HTTP surface 까지만. 실 결선은 별도 후속 task(`defaultCronTickHandlerProvider` override).
- ⑤ 신규 인원 1년치 1회 backfill (R-50 / REQ-027) — 별도 task.
- 최근 N일 결과 manual delete → 재수집 (R-74 / REQ-041) — 별도 task.
- manual trigger 의 **대상 지정**(특정 personId / period / scope 파라미터로 부분 평가) — 현 trigger 는 cron tick 과 동일한 전체 발화 1회. 대상 파라미터화가 필요하면 별도 DTO + ADR(현 ADR-0042 §Decision 2 는 "동일 실행 진입 함수 즉시 1회" 만 박제).
- `scheduling.module.ts` 변경 0 — 기존 `CRON_TICK_HANDLER` provider 재사용(새 provider/token 추가 금지).
- `docs/architecture/api.md` 의 `POST /api/schedules/trigger` 계약 doc-sync — direct doc-only 후속 task (commitMode 분리, T-0416 패턴 동형).
- 신규 dependency 추가 0 / 새 auth-flow·RBAC 정책 변경 0 / DB schema 변경 0 (기존 guard stack + 기존 handler 추상 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(none yet)
