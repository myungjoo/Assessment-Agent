---
id: T-1968
title: /api/schedules cron 스케줄 REST e2e 계약 spec 신설 (등록·조회·삭제 lifecycle · RBAC 축)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-039, REQ-043]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-09-08
independentStream: e2e-contract-gap
dependsOn: []
touchesFiles: [test/e2e/schedules-cron.e2e-spec.ts]
plannerNote: "P7 e2e 공백 — e2e 참조가 0 인 마지막 controller(cron-schedule)를 PUT→GET→DELETE lifecycle + RBAC 축으로 닫는다 (T-1967 동형)"
---

# T-1968 — /api/schedules cron 스케줄 REST e2e 계약 spec 신설 (등록·조회·삭제 lifecycle · RBAC 축)

## Why

`docs/requirements.md` `58 행` REQ-039 는 검증 방법을 `unit + e2e` 로 선언하고 상태 칸도 `DONE` 이지만, 실제로는 e2e 축이 없다 — `test/` 전체에서 `cron-schedule` 을 참조하는 파일은 `test/perf/cron-schedule-read.perf-spec.ts` · `test/perf/cron-schedule-read-realdb.perf-spec.ts` 뿐이고 `test/e2e/` hit 은 0 이다. 직전 T-1967 이 "e2e 참조 0 인 controller 둘(`llm-provider-config` · `cron-schedule`) 중 하나" 를 닫았으므로 본 task 가 나머지 하나를 같은 형태로 닫는다 ([docs/PLAN.md](../PLAN.md) `142~144 행` R-72/R-73 bullet 의 `implemented-on-main` 축에 실 HTTP 왕복 근거를 붙이는 일).

**issue-still-relevant pre-check (origin/main `07cf952d` 기준, 2026-09-08)**:

- `grep -rn "cron" test/e2e/` → 유일 hit 이 `test/e2e/unevaluated-fill-run.e2e-spec.ts` `19 행` 주석의 "cloud cron" 문구라 **cron 스케줄 endpoint e2e 축 0** 확인. 중복 task 아님.
- `src/scheduling/cron-schedule.controller.ts` `70 행` `@Controller("api/schedules")` + `90 행` `@Get()` · `103 행` `@Put()` · `120 행` `@Delete(":name")` 이 main 에 실재 — 대상 route 가 살아 있다.
- `grep -rn "@Cron(\|@Interval(\|@Timeout(" src/` → 0 hit. 부트스트랩 시점 자동 등록 job 이 없으므로 `GET /api/schedules` 의 초기 응답이 `[]` 임이 보장된다 (spec 의 기준선 단언 근거).
- 오너 게이트 미침범 — [docs/PLAN.md](../PLAN.md) `157 행`(R-91 k6) · `158 행`(R-92 per-route perf baseline 신규 slice 금지) · `182 행`(소비처 동반 의무) · `183 행`(AdminView 부채) 어디에도 걸리지 않는다. `test/perf` · `test/load` · `web` · `src` · `docs/requirements.md` 무접촉이고 신설 helper 0 (기존 helper 재사용).

## Required Reading

- `src/scheduling/cron-schedule.controller.ts` — `70 행` `@Controller("api/schedules")`, `90 행` `@Get()`(200 + 이름 배열, 빈 배열 정상), `103 행` `@Put()`(`@HttpCode(200)` + `UpsertCronScheduleDto`), `120 행` `@Delete(":name")`(`@HttpCode(204)`), `140 행` `@Post("trigger")`(202). 4 route 모두 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, controller-scope `ValidationPipe`(`whitelist` · `forbidNonWhitelisted` · `transform`).
- `src/scheduling/cron-schedule.service.ts` — `29 행` `isValidCronExpression`, `50 행` `registerOrReplace`(빈 name → 400 / 유효하지 않은 cron 식 → 400 / 동일 name 재등록 = 교체), `80 행` `remove`(부재 name → `NotFoundException` 404), `88 행` `list`.
- `src/scheduling/dto/upsert-cron-schedule.dto.ts` `27~37 행` — `name` · `cronExpression` 둘 다 `@IsString() @IsNotEmpty() @MaxLength(255)`.
- `test/e2e/llm-provider-configs.e2e-spec.ts` `1~80 행` — 직전 slice(T-1967) 의 spec 골격. `createAuthenticatedE2EApp` 다중 actor seed + `buildAuthCookie` + describe 구성을 1:1 mirror 할 참조.
- `test/helpers/auth-e2e-helper.ts` `53 행` `TEST_AUTH_JWT_SECRET` · `106 행` `buildAuthCookie` · `132 행` `createAuthenticatedE2EApp` — 신규 helper 를 만들지 말고 이 export 만 쓴다.

## Acceptance Criteria

- [ ] `test/e2e/schedules-cron.e2e-spec.ts` 1 파일만 신설한다. `src/` · `web/` · 기존 spec · helper 변경 0.
- [ ] **happy path (public symbol 축)** — 각 route 1+ 케이스: `GET /api/schedules` Admin 200 + 초기 `[]`; `PUT /api/schedules` Admin 200 + 직후 `GET` 이 등록한 name 을 포함; `DELETE /api/schedules/:name` Admin 204 + 직후 `GET` 이 그 name 을 더는 포함하지 않음; `POST /api/schedules/trigger` Admin 202. 즉 PUT→GET→DELETE→GET lifecycle 왕복 1 개가 성립해야 한다.
- [ ] **error path** — 부재 name `DELETE` → 404(service 의 `NotFoundException` raw forward), 유효하지 않은 cron 식 `PUT` → 400, 공백만 `name` `PUT` → 400(DTO 는 통과하고 service 가 거부하는 경계).
- [ ] **분기별 축** — (a) 동일 name 재등록(`PUT` 2 회, 두 번째는 다른 cron 식) 이 200 이고 `GET` 결과에 그 name 이 **1 개만** 남는다(교체지 중복 등록이 아님) (b) 등록 0 건 `GET` 이 200 + `[]` 이며 404 가 아니다 (c) `ValidationPipe` 거부 축을 `it.each` 표로 압축해 필드 누락 · 빈 문자열 · wrong type · 정의되지 않은 extra 키 각각 400.
- [ ] **negative case (예외 분기마다 1+)** — RBAC · 인증 실패를 `it.each` 표로 4 route × (User 쿠키 403 / 쿠키 부재 401 / 변조 JWT 401) 조합으로 cover 하고, SuperAdmin 이 `RolesGuard` escalation 으로 통과(과차단 없음)함을 1+ 케이스로 고정한다. 실패 경로 어느 것도 cron registry 상태를 바꾸지 않음(직후 Admin `GET` 이 기대 배열 그대로)을 1+ 단언으로 확인한다.
- [ ] **정리 책임** — `afterEach` 에서 본 spec 이 등록한 cron name 을 모두 제거해 registry 를 빈 상태로 되돌린다(살아 있는 `CronJob` 이 jest open handle 로 남지 않도록). `test/helpers/db-truncate.ts` 의 `truncateAll` 은 actor seed 를 지우므로, 쓰려면 `reseedAuthenticatedActors` 와 짝지어 쓰거나 아예 쓰지 않는다 — 본 endpoint 군은 DB row 를 만들지 않으므로 truncate 불요가 기본 선택.
- [ ] cron 식은 테스트 실행 중 실제로 발화하지 않는 값을 쓴다(예: 매일 03:00 류). 발화 대기 · 타이머 sleep 0.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `src/` diff 0 이라 전역 coverage 는 불변이며 `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 게이트를 유지 통과해야 한다.
- [ ] `pnpm test:e2e` 는 로컬 `DATABASE_URL` 부재 시 실행 불가하므로 CI e2e job(R-113)에 위임하고, 그 사실을 spec 머리 주석에 1 줄 남긴다. CI e2e job 에서 `PASS test/e2e/schedules-cron.e2e-spec.ts` 확인.
- [ ] 파일 머리 주석에 책임 경계 · 고정하는 계약 목록 · 실 DB 전략(mock override 0)을 T-1967 spec 과 동형으로 한국어로 박제한다.
- [ ] cap 준수 — 1 파일 · ≤ 300 LOC. RBAC/validation 축을 개별 `it` 로 나열하면 초과하므로 위 지시대로 `it.each` 표로 압축한다.

## Out of Scope

- `src/scheduling/` production 코드 수정 (controller · service · DTO · module 무접촉). 결함을 발견하면 고치지 말고 Follow-ups 에 적는다.
- `POST /api/schedules/trigger` 의 tick handler 실 동작 검증 — module 기본 provider 가 logging stub 이라 e2e 로는 202 수락만 고정한다. 실 평가 pipeline 결선 검증은 별도 arc.
- `test/perf/*` · `test/load/*` 변경 (PLAN `157 · 158 행` 오너 게이트).
- `docs/requirements.md` REQ-039 / REQ-040 상태 칸 재판정 — CLAUDE.md §3.1 판정 규칙 6(구현 후 1 회)에 따라 본 spec 머지 **후** 별도 direct task 로 1 회만.
- `web/` · AdminView 관련 변경 (PLAN `183 행`).
- 신규 test helper 신설 · 기존 helper signature 변경.
- backfill · recent-deletion controller 축 (이미 T-1958 / T-1963 이 cover).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음)
