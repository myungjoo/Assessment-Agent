---
id: T-0415
title: AppModule 에 SchedulingModule import — cron 지정 엔드포인트 런타임 활성화
phase: P7
status: DONE
completedAt: 2026-06-15T10:18:00Z
mergedAs: cc2eeff
prNumber: 335
reviewRounds: 1
commitMode: pr
coversReq: [REQ-039]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-06-15
independentStream: p7-scheduling
dependsOn: [T-0414]
touchesFiles:
  - src/app.module.ts
  - src/app.module.spec.ts
plannerNote: "P7 ③ slice 2 Out-of-Scope follow-up — SchedulingModule 을 AppModule 에 import 해 /api/schedules 엔드포인트를 런타임에 활성화. T-0414 backlogNote split #1."
---

# T-0415 — AppModule 에 SchedulingModule import (cron 지정 엔드포인트 런타임 활성화)

## Why

PLAN.md P7 ③ slice 2 의 Out-of-Scope follow-up. T-0414 가 머지한 `SchedulingModule`(CronScheduleController + CRON_TICK_HANDLER provider + CronScheduleService 배선) 은 self-contained 하나 **AppModule 에 import 되지 않아 `/api/schedules` 엔드포인트가 런타임에 살아있지 않다**. T-0414 가 5 파일 cap 보호를 위해 AppModule import 를 의도적으로 별도 micro-task 로 분리했고(`src/scheduling/scheduling.module.ts` 주석 + T-0414 §Out of Scope 명시), 본 task 가 그 단일 import 줄을 추가해 REQ-039 / R-72 ("Admin 이 cron 주기를 런타임 지정 — 재배포 없이 변경") 의 HTTP 진입점을 실제로 NestJS 런타임에 노출한다.

## Required Reading

- `src/app.module.ts` — `imports` 배열에 `SchedulingModule` 추가 대상. 기존 module 등록 패턴(WebModule / ScheduleModule.forRoot() 등) 1:1 mirror.
- `src/scheduling/scheduling.module.ts` — import 대상 module. `ScheduleModule.forRoot()` 를 재import 하지 않는 이유(전역 SchedulerRegistry 중복 방지) 가 주석에 박제됨 — 본 task 도 그 계약을 깨지 않는다(AppModule 의 기존 `ScheduleModule.forRoot()` 1회 등록 유지).
- `src/app.module.spec.ts` — 기존 AppModule wiring 검증 spec. SchedulingModule import 후 `CronScheduleController` / `CronScheduleService` 가 root DI 그래프에서 주입 가능한지 단언을 추가할 지점.
- `src/scheduling/cron-schedule.controller.ts` — 주입 가능 여부를 단언할 controller symbol + `CRON_TICK_HANDLER` 토큰.

## Acceptance Criteria

- [ ] `src/app.module.ts` 의 `imports` 배열에 `SchedulingModule` 추가 + 상단 import 문 추가. 기존 `ScheduleModule.forRoot()` 등록은 **변경/제거하지 않는다**(전역 SchedulerRegistry 1회 등록 유지 — SchedulingModule 은 forRoot 재import 없이 전역 registry 를 주입받음). module 등록 의도를 설명하는 한국어 주석 1줄 추가(기존 module 주석 패턴 일관).
- [ ] **Happy-path unit test**: `src/app.module.spec.ts` 에 SchedulingModule import 검증 추가 — root DI 그래프 컴파일 후 `CronScheduleController` 가 주입 가능(`moduleRef.get(CronScheduleController)` 정의됨) + `CronScheduleService` 주입 가능 + `CRON_TICK_HANDLER` 토큰 resolve 가능. happy-path 1+.
- [ ] **Error path / negative test**: SchedulingModule 미import 회귀를 catch 하는 단언 — 주입 결과가 `undefined`/`null` 이 아님 1+. (기존 spec 의 SchedulerRegistry 단언 패턴 mirror — 본 import 가 빠지면 `get(CronScheduleController)` 가 throw 하므로 wiring 누락을 catch.)
- [ ] **Flow / branch coverage**: 본 task 는 선언적 import 1줄로 분기 코드를 추가하지 않는다 — "분기 없음 — flow/branch 항목은 부팅 직후 빈 cron registry 상태 단언으로 갈음"(기존 `getCronJobs().size === 0` 계약이 SchedulingModule import 후에도 유지됨을 단언). 이 항목은 명시적으로 생략 근거를 spec 주석에 박제.
- [ ] **Negative cases 충분 cover**: (a) `CronScheduleController` 주입 결과 not undefined/null, (b) `CronScheduleService` 주입 결과 not undefined/null, (c) `CRON_TICK_HANDLER` 기본 handler resolve 가능(no-op stub) 각 1+ test. 단일 negative 만으로 부족 — 주입 대상별 분리.
- [ ] 기존 AppModule spec 의 SchedulerRegistry 단언(부팅 직후 동적 cron job 0개 등) 이 **여전히 green** — SchedulingModule import 가 부팅 시점 declarative job 을 0 으로 유지함을 회귀 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global`).

## Out of Scope

- `docs/architecture/api.md` 의 `/api/schedules` 계약 doc-sync — 별도 direct doc-only 후속 task(commitMode 분리, backlogNote #1b).
- ④ manual trigger endpoint (R-73 / REQ-040) — 별도 task.
- ⑤ 신규 인원 1년치 1회 backfill (R-50 / REQ-027) — 별도 task.
- cron tick callback 의 **실 평가 pipeline 결선** — ④/⑤ 후속. 본 task 는 import 배선만(기본 no-op tick handler stub 그대로).
- 등록 cron job 의 영속화 / timezone(KST) 처리 — ADR-0042 §Consequences 별도 후속/ADR.
- `ScheduleModule.forRoot()` 의 중복 등록 / SchedulingModule 내부 배선 변경 — 본 task 는 AppModule import 1줄 + spec 검증만.
- 신규 dependency 추가 0 / 새 auth-flow·RBAC 정책 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(none yet)
