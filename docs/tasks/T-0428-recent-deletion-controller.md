---
id: T-0428
title: 최근 N일 결과 manual delete REST endpoint (P7 ⑤ slice 2 후속 b)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 270
estimatedFiles: 5
created: 2026-06-16
independentStream: p7-recent-deletion
dependsOn: [T-0427]
touchesFiles:
  - src/scheduling/recent-deletion.controller.ts
  - src/scheduling/recent-deletion.controller.spec.ts
  - src/scheduling/dto/recent-deletion.dto.ts
  - src/scheduling/dto/recent-deletion.dto.spec.ts
  - src/scheduling/scheduling.module.ts
plannerNote: "P7 ⑤(R-74 REQ-041) slice 2 후속 b — runRecentDeletion 을 노출하는 Admin+ manual delete REST endpoint, T-0421 BackfillController 패턴 mirror + 본문 DTO, pr"
---

# T-0428 — 최근 N일 결과 manual delete REST endpoint (P7 ⑤ slice 2 후속 b)

## Why

PLAN.md Phase P7 의 "Admin 최근 N일 결과 manual delete → 재수집 (R-74 / REQ-041)" bullet 의 외부 진입점 slice. T-0427(slice 2)이 `RecentDeletionRunnerService.runRecentDeletion(personId, instants, reference?, days?)` — 최근 N일 결과를 삭제하고 같은 기간을 재수집하는 runner — 를 박제·머지(PR #344)했으나, 이를 **호출할 외부 REST 진입점이 없다**(T-0427 §Out of Scope 의 후속 b). 본 task 는 그 진입점 — Admin 이 특정 인원의 최근 N일 결과 delete→재수집을 manual 하게 1회 발화하는 REST endpoint — 를 박제한다.

T-0421(BackfillController, PR로 머지됨)이 증명한 패턴을 mirror 한다 — 같은 `@Controller("api/schedules")` prefix 아래 별도 controller 클래스로 단일 책임을 분리하고, runner 를 inject 받아 호출만 하며(재구현 0), service-layer 예외를 raw forward 하고, Admin+ tier RBAC(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`)을 1:1 적용한다. 단 backfill 과 달리 본 endpoint 는 `runRecentDeletion` 이 요구하는 `instants` 후보 집합과 선택적 `days` 를 **요청 본문**으로 받아야 하므로, BackfillController(본문 없음, path param 만)에 더해 본문 DTO(`RecentDeletionDto`) + controller-scope `ValidationPipe` 를 CronScheduleController/UpsertCronScheduleDto 패턴으로 mirror 한다.

## Required Reading

- `docs/PLAN.md` (Phase P7 — "Admin 최근 N일 결과 manual delete → 재수집 (R-74)" bullet)
- `docs/requirements.md` (REQ-041 행 — "Admin 최근 N일 결과 manual delete → 재수집")
- `src/scheduling/recent-deletion-runner.service.ts` — **본 controller 가 inject·호출할 runner**. `RecentDeletionRunnerService.runRecentDeletion(personId: string, instants: ReadonlyArray<Date>, reference?: Date, days?: number): Promise<RecentDeletionRunResult>` 시그니처 + `RecentDeletionRunResult{ personId, deletedCount, recollected }` 반환 shape. 재구현 0 — inject 후 호출만(시그니처 불변).
- `src/scheduling/backfill.controller.ts` — **본 task 가 mirror 할 레퍼런스 controller**. `@Controller("api/schedules")` 공유 + 별도 클래스 분리 + runner inject + raw forward + Admin+ RBAC stack(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) + `@HttpCode(202)` 패턴을 차용. 차이: 본 endpoint 는 요청 본문(DTO)을 받는다.
- `src/scheduling/backfill.controller.spec.ts` — **본 spec 이 mirror 할 4 describe block 구조**(unit / HTTP integration / RBAC guard integration / real RolesGuard escalation) + R-112 4종 cover 패턴 레퍼런스.
- `src/scheduling/cron-schedule.controller.ts` — controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` 패턴(본문 DTO 검증) 레퍼런스. `@Body() dto` 매핑 + service-layer HttpException 자동 status mapping 패턴 참고.
- `src/scheduling/dto/upsert-cron-schedule.dto.ts` — **본 DTO 가 mirror 할 class-validator 패턴**(`@IsString`/`@IsNotEmpty`/`@MaxLength` + 필드 주석 + ValidationPipe 결합 책임 경계). 본 DTO 는 ISO string 배열(instants) + 선택적 days 를 검증.

## Acceptance Criteria

- [ ] `src/scheduling/dto/recent-deletion.dto.ts` 신설 — `RecentDeletionDto` (요청 본문 검증 책임):
  - `instants: string[]` 필드 — 삭제 후보 instant 의 ISO 8601 문자열 배열. `@IsArray()` + `@IsISO8601(..., { each: true })`(또는 동등 element-level string/date 검증) + `@ArrayMaxSize(<상한>)` 로 비정상적으로 큰 배열 거부(application-layer cap, 근거 주석). 빈 배열 허용(runner 가 no-op 처리 — error 아님)인지 도메인 근거와 함께 주석으로 명시.
  - `days?: number` 선택 필드 — `@IsOptional()` + `@IsInt()` + `@IsPositive()`(또는 `@Min(1)`). 실 상한/하한 검증은 `buildRecentDeletionWindow` 의 `assertValidDays` 에 위임(중복 검증 금지)인 점을 주석에 명시. 미지정 시 runner 기본값(`DEFAULT_DAYS=1`) 사용.
  - controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)와 결합돼 정의 외 키 / wrong type 시 400 임을 주석에 명시. `reference` 파라미터화는 Out of Scope(현재 시각 기본값).
- [ ] `src/scheduling/recent-deletion.controller.ts` 신설 — `RecentDeletionController`:
  - `@Controller("api/schedules")` + controller-scope `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`(CronScheduleController mirror).
  - 생성자에 `RecentDeletionRunnerService` inject(재구현 0 — 호출만).
  - endpoint `POST /api/schedules/recent-deletion/:personId` + `@HttpCode(202)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`. `@Param("personId") personId: string` + `@Body() dto: RecentDeletionDto`.
  - 동작: dto 의 `instants`(ISO string[])를 `Date` 배열로 매핑(`new Date(s)`)해 `runner.runRecentDeletion(personId, instants, undefined, dto.days)` 1회 호출 → `RecentDeletionRunResult` 를 202 로 반환. boundary/필터 산술 0 — 모든 도메인 로직은 runner 위임. ISO→Date 매핑 외 가공 금지.
  - `:personId` 형식 검증은 controller 책임 아님 — raw forward(BackfillController 동형). runner / 하위가 부재·비정상 personId 를 거부.
  - service-layer 예외 raw forward(controller 추가 변환 0) — `runRecentDeletion` 이 throw/reject(buildRecentDeletionPlan TypeError/RangeError → 400, triggerCollection reject 등)하면 삼키지 않고 그대로 propagate. RBAC 주석(Admin/SuperAdmin 통과, User 403, 인증 부재 401)은 BackfillController mirror.
- [ ] `src/scheduling/scheduling.module.ts` 의 `controllers` 배열에 `RecentDeletionController` 추가. `RecentDeletionRunnerService` 는 이미 providers/exports 에 등록됨(T-0427) — 새 provider/import/schema 변경 0, controller 등록만.
- [ ] colocated spec `src/scheduling/recent-deletion.controller.spec.ts` 신설 — BackfillController spec 의 4 describe block 구조(unit / HTTP integration / RBAC guard integration / real RolesGuard escalation) mirror. `RecentDeletionRunnerService` 는 jest.fn() mock 으로 주입(실 runner/실 삭제/실 수집 0). R-112 4종 + negative 충분 cover:
  - **happy-path**: 유효 instants(ISO string[]) + days 본문으로 호출 시 `runRecentDeletion` 이 정확히 1회 호출되고, 그 instants 인자가 본문 ISO 문자열을 `Date` 로 매핑한 집합과 일치하며 `days` 가 전달됨을 단언. 반환 `RecentDeletionRunResult` 가 202 body 로 wire 됨을 supertest 로 단언.
  - **error-path**: `runRecentDeletion` reject(BadRequestException → 400, NotFoundException → 404, 일반 Error → 500)를 삼키지 않고 propagate/status mapping 단언.
  - **flow/branch**: `days` 미지정(undefined 전달) vs 명시(예: 7) 두 경로 단언. 빈 instants 배열(정상 no-op 반환) 경로 단언.
  - **negative 충분 cover**: 정의 외 본문 키 포함(forbidNonWhitelisted → 400), `instants` 누락/비-배열/비-ISO 원소(400), `days` 음수/0/비-정수(400), 비정상 personId raw forward(controller 검증 책임 0 — runner 로 그대로 전달 단언), RBAC 거부(JwtAuthGuard reject → 401 + runner 미호출, RolesGuard reject → 403 + runner 미호출, User actor 실 RolesGuard → 403, Admin/SuperAdmin → 202) 등 예외 분기마다 1+.
- [ ] colocated spec `src/scheduling/dto/recent-deletion.dto.spec.ts` 신설 — `validate`(class-validator) 로 DTO decorator 검증. happy(유효 instants+days / days 생략) + negative(빈 instants 허용 여부, 비-ISO 원소, 배열 상한 초과, days 음수/0/비-정수, instants 누락) 각 1+. UpsertCronScheduleDto spec 패턴(존재 시) 또는 AssignDifficultyMappingDto spec 패턴 mirror.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 본 controller/DTO 분기 전수 cover 로 100% 목표).

## Out of Scope

- 실 repository delete provider 바인딩 — `RecentDeletionDeleter`(RECENT_DELETION_DELETER token)의 실 구현(Prisma 로 Assessment/Contribution row 삭제)은 schema/repository 게이트 동반 별도 sub-slice(slice 2 후속 a). 본 task 는 runner 미주입 기본(삭제 0)을 그대로 사용 — endpoint 는 배선만, 실 삭제 0.
- `RecentDeletionRunnerService` 자체 수정 0 — inject 재사용만(시그니처 불변).
- `reference` 파라미터화 — endpoint 는 현재 시각 기본값만 사용(runner `reference ?? new Date()`). 명시 reference 노출은 Out of Scope.
- `instants` 후보 자동 도출(DB에서 해당 인원의 결과 instant 조회) — 본 endpoint 는 후보를 본문으로 받음. 자동 도출(repository 조회)은 schema/repository 게이트 동반 별도 sub-slice.
- PersonService / `src/user/` 연동 — `personId` 는 path param raw forward. `src/user/` 무변경.
- DB persistence / Prisma schema 변경 — 삭제 audit/표식 영속화는 schema 게이트 동반 별도 sub-slice(slice 3). 본 task schema 무변경.
- 새 auth-flow / RBAC 정책 변경 0 — 기존 guard stack(JwtAuthGuard/RolesGuard/@Roles) 적용만(BackfillController/CronScheduleController mirror).
- api.md / data-model.md doc-sync — 별도 direct task(slice 4).
- timezone / KST 재논의 — ADR-0039 확정, boundary 는 runner→helper 가 도출.
- 실 live/credentialed 수집·삭제 — Q-0022(만료 6/30) deferred. 본 controller 는 mock-testable(runner mock 주입), 실 token·실 DB 0.

## Suggested Sub-agents

`implementer → tester`

## Status

PENDING

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
- (slice 2 후속 a) 실 `RecentDeletionDeleter` provider — Prisma 로 해당 기간 Assessment/Contribution 삭제 + module 바인딩(schema/repository 게이트).
- (slice 2 후속 a-2) `instants` 후보 자동 도출 — repository 조회로 해당 인원 결과 instant 수집(endpoint 본문 대신 서버 도출, schema/repository 게이트).
- (slice 3) 삭제 audit/표식 영속화 — schema 게이트.
- (slice 4) api.md / data-model.md doc-sync(REQ-041 endpoint 문서화) — direct.
