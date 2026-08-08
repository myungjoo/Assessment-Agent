---
id: T-1530
title: 실 DB perf slice 16 — cron schedule registry read 실측
phase: P5
status: DONE
prNumber: 1226
completedAt: 2026-08-08T12:59:53Z
commitMode: pr
coversReq: [REQ-048, REQ-096]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-08
independentStream: perf-realdb-slices
dependsOn: [T-1529]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~340 LOC (T-1526 274 / T-1528 339 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/cron-schedule-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 16(CronScheduleController GET /api/schedules, 14 번째 도메인·첫 scheduling 모듈). slice 15(T-1528) 동형, pr · 2 파일 약 290 LOC.
---

# T-1530 — 실 DB perf slice 16: cron schedule registry read 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB round-trip cutover 를 slice 16 으로 한 칸 넓힌다. slice 1~15 는 endpoint 도메인 **13 개**(조회 route 24) 를 실 Postgres 위에서 실측했지만 그 13 개는 모두 `src/user/` · `src/llm/` · `src/export/` · `src/import/` · `src/permission-denied/` · `src/auth/` 모듈이고, **`src/scheduling/` 모듈은 아직 한 route 도 실측되지 않았다**. 본 slice 는 `CronScheduleController` 의 `GET /api/schedules` — 등록된 cron job 이름 배열을 실 `SchedulerRegistry` 에서 읽는 Admin 가시성 route (REQ-096) — 를 실 부트스트랩으로 처음 실측해 **14 번째 endpoint 도메인 · 조회 route 25** 로 만든다. mock slice(T-0840, [`cron-schedule-read.perf-spec.ts`](../../test/perf/cron-schedule-read.perf-spec.ts))는 `CronScheduleService` 를 mock 으로 대체하고 `overrideGuard` 로 guard 두 개를 무력화했으므로, 실 guard stack + 실 registry 를 타는 end-to-end 는 미측정이다.

본 slice 가 주장하는 **새 구조 축 3 개** (README slice 목록에 그대로 기록할 것):

1. **결과 집합이 DB row 가 아니라 in-process 상태인 첫 실측 경로**. 앞 15 slice 의 응답은 예외 없이 Prisma delegate 가 읽은 row(또는 그 row 로 합성한 파생 view)였다. 본 route 는 `SchedulerRegistry.getCronJobs()` Map 의 key 배열이라 **어떤 테이블도 읽지 않고 프로세스 메모리 상태를 직렬화**한다 — slice 12 의 `GET /api/admin/import/modes` 도 0-query 였지만 그것은 DB·상태와 무관한 **고정 2 원소 상수**였고, 본 route 의 응답은 **선행 write 로 변하는 가변 상태**다.
2. **같은 spec 안의 write(PUT/DELETE) 가 read 결과를 바꾸는 첫 페어**. `PUT /api/schedules` 로 job 을 등록하면 같은 프로세스의 `GET /api/schedules` 결과 배열이 즉시 커지고 `DELETE /api/schedules/:name` 으로 다시 줄어든다 — 앞 15 slice 는 seed 를 Prisma 로 직접 심고 read 만 측정했으므로 **HTTP write 가 read 표본을 만드는 구조는 본 slice 가 처음**이다.
3. **규모 축이 DB row 수가 아니라 registry 등록 수인 첫 slice**. 등록 **0 건(빈 배열)** 과 **N 건** 두 표본으로 p95 를 재 규모 민감도를 관측한다 — slice 3 의 규모 축은 membership row 수, slice 13 은 schema 로 3 슬롯 bounded, slice 14·15 는 결과 집합 1 row 고정이었다. 두 표본의 대소 관계는 slice 3 선례대로 wall-clock 비결정성 때문에 **단언하지 않고 관찰 기록만** 남긴다.

`@Roles("Admin")` guard 레벨 403 · 401 두 종은 slice 10~13 과 동일하므로 **새 축으로 주장하지 않고** negative cover 로만 유지한다. 본 slice 는 `test/` 만 건드리며 실 DB 는 actor `User` seed / `truncateAll` 경로로만 관여한다(측정 route 자체는 0 query — 그 사실이 위 축 1 의 근거다).

## Required Reading

- [docs/tasks/T-1528-perf-realdb-slice15-export-status-view-read.md](T-1528-perf-realdb-slice15-export-status-view-read.md) — 직전 slice 의 task 구조 · AC · Out of Scope 선례 (본 task 는 그 동형).
- [test/perf/auth-me-read-realdb.perf-spec.ts](../../test/perf/auth-me-read-realdb.perf-spec.ts) — 실 JWT cookie 기반 실 부트스트랩 · `afterEach` actor 재-seed · `measure` 구조의 직접 원본 (본 slice 는 seed 할 도메인 entity 가 없어 이 spec 이 slice 10 보다 가까운 mirror 대상).
- [test/perf/cron-schedule-read.perf-spec.ts](../../test/perf/cron-schedule-read.perf-spec.ts) — mock slice(T-0840). 커버 항목 대조용 (실 판에서 무엇이 추가되는지).
- [src/scheduling/cron-schedule.controller.ts](../../src/scheduling/cron-schedule.controller.ts) `90~125 행` — `list` / `upsert`(PUT, 200) / `remove`(DELETE `:name`, 204) 의 guard · status code · raw propagate 계약.
- [src/scheduling/cron-schedule.service.ts](../../src/scheduling/cron-schedule.service.ts) — `list` 가 `getCronJobs()` key 배열이라는 점, `registerOrReplace` 의 빈 name / 유효하지 않은 cron 식 400 분기, `remove` 의 부재 404 분기.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의 slice 15 항목 + `- **잔여**` 항목 — 본 slice 항목을 그 뒤에 append 하고 계수를 갱신한다.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) · [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createAuthenticatedE2EApp` / `reseedAuthenticatedActors` / `truncateAll` 시그니처 (helper 수정 0).

## Acceptance Criteria

- [ ] 신규 [`test/perf/cron-schedule-read-realdb.perf-spec.ts`](../../test/perf/cron-schedule-read-realdb.perf-spec.ts) 를 추가한다. 파일명에 `read` 를 포함시켜 README 의 read glob 계수 규칙(slice 14·15 선례)을 유지한다. **mock override 0** — `createAuthenticatedE2EApp` 로 AppModule 을 실 부트스트랩하고(실 `ScheduleModule.forRoot()` · 실 `SchedulerRegistry` · 실 `PrismaService`) 실 JWT cookie 로 요청한다 (`overrideProvider` / `overrideGuard` 사용 금지).
- [ ] **happy path** — Admin actor 가 `GET /api/schedules` 를 호출하면 200 이고 body 가 `string[]` 이며, `collectLatencySamples` + `assertS2Threshold` 로 p95 **< 3000ms** 를 실측 pass 한다 (test 1+).
- [ ] **error path** — 등록되지 않은 name 으로 `DELETE /api/schedules/:name` 을 호출하면 service 의 `NotFoundException` 이 raw propagate 해 **404** 이고, 그 실패가 직후 `GET /api/schedules` 결과 배열을 바꾸지 않음을 단언한다 (test 1+). 응답 body 에 raw stack 이 노출되지 않음(REQ-032 정합)도 함께 확인한다.
- [ ] **분기 cover** — 상태 전이 분기마다 test 를 둔다: (a) 등록 0 건 → 빈 배열(404 로 변환하지 않음), (b) `PUT` 1 건 후 → 그 name 포함, (c) 같은 name 을 다른 cron 식으로 `PUT` (교체 분기 — 배열 길이 불변), (d) `DELETE` 후 → 그 name 미포함. 각 상태에서 `GET` p95 < 3000ms 를 함께 측정한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 각 1+ test: (a) Cookie 미부착 `GET` → 401(표본 0, `errorRate` 로 확인), (b) 서명 변조 cookie → 401(403 아님), (c) User tier actor → guard 레벨 **403**(registry 미도달), (d) `PUT` 의 빈 name → 400, (e) `PUT` 의 유효하지 않은 cron 식 → 400, (f) (d)·(e) 실패가 `GET` 결과 배열에 아무 job 도 남기지 않음(부분 등록 0) 단언.
- [ ] **규모 관찰** — 등록 **0 건** 표본과 **N 건**(N ≥ 4, 서로 다른 name) 표본에서 `GET /api/schedules` 를 각각 측정해 두 p95 를 모두 3000ms 미만으로 단언한다. **두 값의 대소 관계는 assert 하지 않고 관찰 기록만** 남긴다(slice 3 선례).
- [ ] **baseline 은 절대값이 아니라 delta 로 단언** — 부트스트랩 시점 registry 에 이미 등록된 job 이 있어도 깨지지 않도록, 각 test 는 시작 시 `GET` 으로 baseline 배열을 snapshot 한 뒤 **자기가 등록한 name 의 포함/미포함과 길이 delta** 로만 단언한다 (전역 빈 배열 가정 금지 — 단 (a) 분기는 본 spec 이 등록한 name 이 0 개임을 delta 로 확인).
- [ ] **registry 누수 0** — 본 spec 이 등록한 모든 job 은 `afterEach` 에서 `DELETE /api/schedules/:name` (또는 실패 시 무해한 재시도) 로 반드시 제거해 다른 perf-spec 로 timer 가 새지 않게 한다. cron 식은 테스트 실행 중 tick 이 발화하지 않도록 **드문 주기**(예: `0 0 5 1 1 *` 류)만 쓴다. `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 open handle 0.
- [ ] `afterEach` 는 `truncateAll(prisma)` 후 `reseedAuthenticatedActors(ctx)` 로 actor User 를 **원본 id 그대로** 재-seed 한다 (slice 10·14·15 선례, [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 수정 0).
- [ ] `DEFAULT_P95_MAX_MS = 3000` (REQ-048) 를 변경하지 않고 baseline 파일을 확정하지 않는다 — `buildBaselineReport` / `formatBaselineLine` 은 관찰 전용 한 줄로만 쓴다.
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 slice 목록에 `- **slice 16**` 항목을 append 하고(§Why 의 새 축 3 개를 근거와 함께 기술, "새 축으로 주장하지 않는" 항목도 명시), `- **잔여**` 항목의 계수를 실검산해 갱신한다: perf-spec **49 → 50**, read glob **44 → 45**, 실 DB **15 → 16**(그중 read **14 → 15**), mock 잔존은 `45 − 15 = 30` 으로 **불변**, 실측 endpoint 도메인 **13 → 14**, 조회 route **24 → 25**. 실측치와 어긋나면 문서 대신 계수를 고친다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` 변경 0 이므로 기존 수치 유지).
- [ ] 로컬 실 DB 전제(`docker compose up -d postgres` + `DATABASE_URL` + `pnpm prisma migrate deploy`) 하에 `pnpm test:perf` 로 신규 spec 이 picking 되어 통과. `jest-perf.json` 의 `testRegex` 가 자동 매칭하므로 workflow / config 편집 0. 로컬 Postgres 부재 시 CI 의 postgres service `perf test` step success 로 확정한다.

## Out of Scope

- **doc-sync** — `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 · `docs/requirements.md` REQ-048 에 slice 16 실측을 반영하는 작업은 **머지 후 별도 `direct` task** 로 이월한다 (slice 13·14·15 선례 T-1525 / T-1527 / T-1529 동형). 본 task 는 `test/` 만 건드린다.
- `POST /api/schedules/trigger` · `POST /api/schedules/backfill/:id` · `POST /api/schedules/recent-deletion` 등 **write / trigger route 의 latency 측정** — 본 slice 는 read 1 route(`GET /api/schedules`) 만 측정하고, PUT / DELETE 는 read 표본을 만들기 위한 **상태 준비 수단**으로만 쓴다(그 자체 p95 단언 금지).
- 실 cron tick 발화 · `CronTickHandler` 의 실 평가 pipeline 결선 검증 — controller / service spec 및 별도 task 책임.
- `src/` production code · `prisma/schema.prisma` · `test/helpers/*` 수정 일체 (helper 재사용만).
- 임계값(3000ms) 변경 · baseline 파일 확정(`writeBaselineFile` / `confirmOrCompareBaseline`) · k6 등 부하 발생기 도입 · REQ-047 실 scale 부하 측정.
- 나머지 mock 잔존 read perf-spec 30 개의 실 DB cutover · `GET /api/admin/export/:id/download` · `GET /api/admin/import/:id` · `GET /api/groups/:id/members` 등 미측정 read route — endpoint / route 단위 후속 slice.
- `.github/workflows/ci.yml` · `jest-perf.json` · `package.json` 편집.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **doc-sync (direct, 다음 slice 전 필요)** — 본 slice 가 Out of Scope 로 이월한 3 문서 동기: [docs/PLAN.md](../PLAN.md) `142 행` · [부하계획](../architecture/load-resilience-test-plan.md) `§ 5` item 5 · [REQ-048](../use-cases/REQ-COVERAGE-AUDIT.md). perf-spec 50 / 실 DB slice 16(read 15) / 실측 endpoint 도메인 14 · 조회 route 25 로 갱신. slice 15(T-1529) 의 doc-sync task 와 동형.

## Result

- **DONE** (2026-08-08 12:59:53Z) — PR **#1226** squash 머지 (`a276beb4`), reviewer round 1 APPROVE + 4-게이트 충족, CI green.
- 신규 `test/perf/cron-schedule-read-realdb.perf-spec.ts` (13 test) + `test/perf/README.md` slice 16 항목 · 계수 갱신 — 2 파일 `+373/-2` (frontmatter `sizeExempt` 로 LOC 상한 면제, 파일 수 2 유지).
- 실측: 신규 slice p95 **2.2~4.3 ms** (임계 3000 ms), err 0%. CI `perf test` step 에서 50 suite 전량 pass.
- 구조 축 3 종 (in-process 상태 직렬화 · 같은 spec 의 write 가 read 표본을 만드는 첫 페어 · 규모 축이 registry 등록 수) 박제, 규모 0 건 vs 4 건 대소 관계는 선례대로 미단언.
