---
id: T-0421
title: manual backfill 엔드포인트 (POST /api/schedules/backfill/:personId — 신규 인원 1년치 1회 backfill)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-027]
estimatedDiff: 280
estimatedFiles: 3
created: 2026-06-16
independentStream: p7-backfill
dependsOn: [T-0420]
touchesFiles:
  - src/scheduling/backfill.controller.ts
  - src/scheduling/backfill.controller.spec.ts
  - src/scheduling/scheduling.module.ts
hqOrigin:
plannerNote: "P7 ⑤ slice 2 후속 b — BackfillRunnerService.runBackfill 을 Admin+ REST 로 노출. T-0417 controller 패턴 mirror, 순환 게이트 없음. backlogNote split."
---

# T-0421 — manual backfill 엔드포인트 (POST /api/schedules/backfill/:personId — 신규 인원 1년치 1회 backfill)

## Why

PLAN.md Phase P7 의 "신규 인원 추가 시 1년치 평가 1회 (R-50 / REQ-027)" bullet 의 slice 2 후속 b. T-0419(`BackfillRunnerService`, merged) 가 `runBackfill(personId)` 실행 runner 를, T-0420(`AssessmentBackfillChecker`, merged) 가 idempotency 실 판정자를 박제해 — 이미 "신규 인원이면 1년치 backfill, 기존 인원이면 skip" 의 도메인 로직이 완성됐다. 그러나 이를 호출할 **외부 진입점이 아직 없다** (PersonService create hook 자동 배선은 module 순환 의존 게이트로 별도 architect task 로 분리됨, T-0420 §Out of Scope). 본 task 는 그 게이트가 없는 진입점 — **Admin 이 특정 인원의 1년치 backfill 을 manual 하게 1회 발화하는 REST endpoint** — 를 박제해, 순환 해소 전이라도 backfill 을 실 사용 가능하게 한다.

backlogNote 가 명시한 후속 b("manual backfill REST endpoint POST /api/schedules/backfill/:personId, Admin+ RBAC, T-0417 controller 패턴 mirror") 를 그대로 구현한다. `BackfillRunnerService` 는 이미 `SchedulingModule` 의 export 이므로(scheduling.module.ts L72), 신규 controller 가 inject 받아 `runBackfill` 을 호출하면 된다 — 새 서비스/스키마/순환 0. RBAC 는 T-0417(`CronScheduleController`) 이 박제한 Admin+ tier stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) 의 1:1 mirror — 신규 auth 결정 0.

## Required Reading

- `src/scheduling/backfill-runner.service.ts` — 본 task 가 노출할 `BackfillRunnerService.runBackfill(personId: string, reference?: Date, weeks?: number): Promise<BackfillRunResult>` 시그니처 + `BackfillRunResult` shape(`{ personId, totalWindows, triggeredCount, skipped }`). fail-fast(중간 window throw 시 전파) 정책 + idempotency 게이트(이미 backfill 됨 → `skipped: true`, triggerCollection 0회) 동작 이해.
- `src/scheduling/cron-schedule.controller.ts` — 본 task 가 mirror 할 controller 패턴. `@Controller("api/schedules")`, controller-scope `@UsePipes(new ValidationPipe({...}))`, Admin+ RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`), `@HttpCode`, service-layer HttpException raw forward 패턴. (본 task 의 backfill endpoint 는 다른 controller 로 분리하되 동형 RBAC/패턴을 따른다 — 아래 Acceptance 참조.)
- `src/scheduling/cron-schedule.controller.spec.ts` — 본 task 가 mirror 할 colocated spec 구조. 4 describe block(unit / ValidationPipe integration / RBAC guard integration / real RolesGuard escalation). backfill endpoint 의 happy/error/RBAC test 를 동일 구조로 작성.
- `src/scheduling/scheduling.module.ts` — 본 task 가 신규 controller 를 `controllers[]` 에 추가할 module. `BackfillRunnerService` 가 이미 providers + exports 에 등록돼 있음(L58, L72) — 새 provider 추가 0, controller 등록만.
- `src/auth/roles.guard.ts` 와 `src/auth/jwt-auth.guard.ts` — RBAC guard stack 동작(Admin/SuperAdmin escalation 통과, User 403, 인증 부재 401). 재사용만 — 수정 0.

## Acceptance Criteria

- [ ] `src/scheduling/backfill.controller.ts` 신설 — `@Controller("api/schedules")` 의 별도 controller `BackfillController`(또는 동등 명) 에 endpoint 1개: `POST /api/schedules/backfill/:personId`. `:personId` 를 path param 으로 받아 주입된 `BackfillRunnerService.runBackfill(personId)` 를 1회 호출하고, 그 `BackfillRunResult`(JSON, 예: `{ personId, totalWindows, triggeredCount, skipped }`) 를 `202 Accepted`(`@HttpCode(202)`) 로 반환한다. 요청 본문 없음(reference/weeks 파라미터화는 Out of Scope — 기본값 사용). 기존 cron endpoint 와 동일한 Admin+ RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) 적용. `runBackfill` 이 throw/reject 하면(Person 404 / P2002 409 / collect reject) 그 에러를 삼키지 않고 그대로 propagate(controller 추가 변환 0, raw forward).
- [ ] `src/scheduling/scheduling.module.ts` 의 `controllers[]` 에 신규 controller 등록 — `BackfillRunnerService` 는 이미 providers 에 있으므로 inject 가능(새 provider 0). controller 1줄 추가 외 module 변경 0.
- [ ] **Happy-path unit test**: 신규 backfill 메서드에 대해 — 주입된 `BackfillRunnerService` mock 의 `runBackfill` 이 정확히 1회, 전달된 `:personId` 인자로 호출되는지 + 정상 결과(`skipped:false` 신규 인원 / `skipped:true` 기존 인원 각각)를 그대로 반환하는지 — happy-path test 1+. spec 의 unit describe block 에 jest mock 주입으로 추가.
- [ ] **Error path unit test**: `runBackfill` 이 reject(의존성 실패 — Person 404 NotFoundException / triggerCollection reject / P2002 409)하는 경우, controller 가 그 에러를 삼키지 않고 그대로 propagate 하는지 — test 1+ (NotFoundException 전파 + 일반 reject 전파 각각 권장). 에러 표면화를 negative 로 cover.
- [ ] **Flow / branch coverage**: `runBackfill` 결과의 (a) `skipped:false`(신규 인원, triggeredCount>0) / (b) `skipped:true`(기존 인원, triggeredCount=0) 두 반환 경로 각각 1+ test — 두 결과 모두 동일하게 202 + result body wire 되는지 cover. controller 자체 분기가 없으면(단순 위임) "분기 없음 — service 결과 pass-through" 를 명시하고 두 결과 형상 cover 로 갈음.
- [ ] **Negative cases 충분 cover**: 권한 미달(User actor → 403, 인증 부재 → 401) 각 1+ test — ValidationPipe/RBAC guard integration describe block + real RolesGuard escalation block 에 `POST /api/schedules/backfill/:personId` 케이스 추가. real RolesGuard escalation block 에 User 403 + Admin/SuperAdmin 202 통과(`it.each(["Admin","SuperAdmin"])`) 분기 박제. 추가로 `:personId` path param 이 빈/비정상 형태일 때 runBackfill 로 그대로 전달(controller 는 검증 책임 없음 — service/하위가 거부)되는지 1+. 단일 negative 만으로 부족 — 권한/에러 분기마다 cover.
- [ ] supertest integration 으로 `POST /api/schedules/backfill/:personId` 정상 시 202 + `BackfillRunnerService.runBackfill` 위임(전달 personId 일치) 검증 1+ (guard override 통과 mock 하에서 status code + body wire 확인).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `coverageThreshold.global` — 신규 controller 분기 전수 cover 로 높은 cov 목표).

## Out of Scope

- **PersonService create hook 자동 배선** — 신규 인원 생성 시점 자동 `runBackfill` 호출은 module 순환 의존(`UserModule → SchedulingModule → AssessmentCollectionModule → UserModule`) 해소 architect 결정 선행 게이트. T-0420 §Out of Scope 그대로 — 본 task 는 `src/user/` 무변경. 본 manual endpoint 가 그 게이트 없이 backfill 을 실 사용 가능하게 하는 임시·영구 진입점.
- **backfill 대상 파라미터화**(reference/weeks/period/scope 를 query·body 로 지정) — 현 endpoint 는 `runBackfill(personId)` 기본값(현재 시각 기준 52주, week/aggregate)만 호출. 파라미터화가 필요하면 별도 DTO + ADR(현 runner 기본값으로 충분).
- **backfill 1회 완료 영속화 표식(flag/row, 예: `Person.backfilledAt`) + schema 변경** — backlogNote slice 3, Prisma migration §5 BLOCKED 게이트. 본 task 의 idempotency 는 T-0420 의 "Assessment 존재 여부" 보수적 proxy 를 그대로 사용(추가 schema 0).
- `BackfillRunnerService` / `AssessmentBackfillChecker` / `CronScheduleController` 자체 수정 — 전부 재사용만(시그니처 불변). cron trigger endpoint 와의 통합/공유는 하지 않음(별도 controller 로 분리해 단일 책임 유지).
- `docs/architecture/api.md` 의 `POST /api/schedules/backfill/:personId` 계약 doc-sync — backlogNote slice 4, direct doc-only 별도 task(T-0416 패턴 동형, commitMode 분리).
- 신규 dependency 추가 0 / 새 auth-flow·RBAC 정책 변경 0 / DB schema 변경 0 (기존 guard stack + 기존 export service 재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
- (slice 2 후속 a-2, **게이트**) PersonService create hook — 신규 인원 생성 시점 `runBackfill` 1회 자동 호출. module 순환 해소 architect/ADR 선행(event-emitter 디커플링 후보).
- (slice 3) backfill 1회 완료 영속화 표식(flag/row) + schema 게이트.
- (slice 4) api.md / data-model.md doc-sync — 본 endpoint 계약 포함.
