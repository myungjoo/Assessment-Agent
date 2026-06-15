---
id: T-0414
title: cron 지정 엔드포인트 (controller/DTO) + 평가 tick callback 배선
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-039]
estimatedDiff: 250
estimatedFiles: 5
created: 2026-06-15
independentStream: p7-scheduling
dependsOn: [T-0413]
touchesFiles:
  - src/scheduling/cron-schedule.controller.ts
  - src/scheduling/cron-schedule.controller.spec.ts
  - src/scheduling/dto/upsert-cron-schedule.dto.ts
  - src/scheduling/dto/upsert-cron-schedule.dto.spec.ts
  - src/scheduling/scheduling.module.ts
plannerNote: "P7 ③ slice 2 — T-0413 CronScheduleService 위 Admin cron 지정 REST endpoint + tick callback 배선. backlogNote split."
---

# T-0414 — cron 지정 엔드포인트 (controller/DTO) + 평가 tick callback 배선

## Why

PLAN.md P7 ③ slice 2. T-0413 이 머지한 `CronScheduleService`(SchedulerRegistry 동적 cron 등록 wrapper) 위에 Admin 이 런타임에 cron 주기를 지정/조회/삭제하는 HTTP 진입점을 신설한다. README R-72 / REQ-039 ("Admin 이 cron 주기를 런타임 지정 — 재배포 없이 변경") 을 충족하는 controller·DTO layer 이며, ADR-0042 §Decision 2 의 동적 registry 경로를 외부에 노출한다. cron tick 시 호출될 callback 은 실 평가 pipeline 에 직접 결선하지 않고 **주입형 handler 추상(`CRON_TICK_HANDLER`)** 으로 배선해, ④ manual trigger / ⑤ backfill 과 공유 가능한 경계만 박제한다 (실 평가 실행 결선은 본 task Out of Scope).

## Required Reading

- `src/scheduling/cron-schedule.service.ts` — 본 task 가 노출할 4 primitive (`registerOrReplace` / `remove` / `list` / `exists`) 와 `CronTickHandler` 타입.
- `src/scheduling/scheduling.module.ts` — provider/export 배선 지점 (controller·tick handler provider 추가 대상).
- `src/scheduling/cron-schedule.service.spec.ts` — cron CronJob mock(test-only) 패턴 (`jest.mock("cron")`) — controller spec 에서 동일하게 leaked timer 방지 위해 재사용.
- `src/llm/difficulty-mapping.controller.ts` — Admin+ RBAC controller 1:1 mirror 패턴 (`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` + controller-scope `ValidationPipe`).
- `docs/decisions/ADR-0042-nestjs-schedule-adoption.md` (§Decision 2 / §Consequences) — 동적 registry 책임 경계 + 영속화/timezone 후속 분리.

## Acceptance Criteria

- [ ] `src/scheduling/dto/upsert-cron-schedule.dto.ts` 신설 — `UpsertCronScheduleDto` { `name`(string, `@IsNotEmpty`), `cronExpression`(string, `@IsNotEmpty`) }. cron 식의 실 형식 검증은 service 의 `isValidCronExpression` 이 책임 (DTO 는 빈 값/형식 기본 검증만).
- [ ] `src/scheduling/cron-schedule.controller.ts` 신설 — `@Controller("api/schedules")`, controller-scope `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, 전 endpoint `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (Admin/SuperAdmin 통과, User 403, 인증 부재 401). 다음 3 endpoint:
  - `GET /api/schedules` → `service.list()` 반환 (등록 cron 이름 배열, 빈 배열도 200 정상).
  - `PUT /api/schedules` → `service.registerOrReplace(dto.name, dto.cronExpression, tickHandler)` 호출 후 200 (유효하지 않은 cron 식/빈 name → service 가 BadRequestException 400 raw forward).
  - `DELETE /api/schedules/:name` → `service.remove(name)` 후 204 (부재 시 service 가 NotFoundException 404 raw forward).
- [ ] cron tick callback 배선 — `CRON_TICK_HANDLER` injection token + 기본 provider(no-op 또는 logging stub, 실 평가 미결선)를 `scheduling.module.ts` 에 추가. controller 는 이 주입된 handler 를 `registerOrReplace` 의 callback 인자로 전달. 실 평가 pipeline 결선은 Out of Scope.
- [ ] `scheduling.module.ts` 에 controller 등록 (`controllers: [CronScheduleController]`) + `CRON_TICK_HANDLER` provider 추가. `SchedulingModule` 을 `app.module.ts` 에 import 하는 변경은 본 task 가 아니라면 Out of Scope 로 명시 (5 파일 cap 보호 — 단, 엔드포인트가 런타임에 살려면 import 필요. cap 안에서 가능하면 app.module.ts import 추가를 포함하되, 그 경우 touchesFiles/파일수 재산정. 기본은 SchedulingModule 자체 배선까지만, AppModule import 는 별도 micro-task 로 분리).
- [ ] **Happy-path unit test**: 신규 public symbol 각각 — `CronScheduleController.list/upsert/remove` 3 메서드 + `UpsertCronScheduleDto` 검증 통과 케이스 — happy-path test 1+. controller spec 은 `CronScheduleService` 를 mock 으로 주입(getCronJobs/addCronJob 호출 검증), `jest.mock("cron")` no-timer stub 으로 leaked timer 0.
- [ ] **Error path unit test**: 각 endpoint error 경로 1+ — upsert 시 유효하지 않은 cron 식(service throw BadRequestException 전파), remove 시 부재(service throw NotFoundException 전파).
- [ ] **Flow / branch coverage**: registerOrReplace 의 신규-등록 vs 교체 분기, exists true/false 분기가 controller 경유로 cover 되도록 spec 분리 (분기마다 1+ test). DTO 의 name/cronExpression 누락 각 분기 1+.
- [ ] **Negative cases 충분 cover**: 권한 미달(User → 403, 인증 부재 → 401) · 빈 입력(name 빈/cronExpression 빈 → 400 whitelist/validation) · 정의 외 필드(forbidNonWhitelisted → 400) · 부재 삭제(404) 각 1+ test. 단일 negative 만으로 부족 — 예외 분기마다 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global`).

## Out of Scope

- cron tick callback 의 **실 평가 pipeline 결선** (EvaluationOrchestrator / collect→evaluate 실 호출) — ④/⑤ 후속 task. 본 task 는 주입형 handler 추상 + no-op/logging 기본 provider 까지만.
- ④ manual trigger endpoint (R-73 / REQ-040) — 별도 task.
- ⑤ 신규 인원 1년치 1회 backfill (R-50 / REQ-027) — 별도 task.
- 등록 cron job 의 **영속화** (재시작 후 복원) 및 timezone(KST) 처리 — ADR-0042 §Consequences 대로 별도 후속/ADR.
- `docs/architecture/api.md` 의 `/api/schedules` 계약 doc-sync — direct doc-only 후속 task (commitMode 분리).
- 신규 dependency 추가 0 / 새 auth-flow·RBAC 정책 변경 0 (기존 guard stack 적용만).
- AppModule import 배선이 본 task 파일 cap 을 넘기면 별도 micro-task 로 분리 (위 criteria 참조).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(none yet)
