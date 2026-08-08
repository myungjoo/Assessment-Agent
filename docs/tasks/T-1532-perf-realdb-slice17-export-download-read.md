---
id: T-1532
title: 실 DB perf slice 17 — export dump download 실측
phase: P5
status: DONE
completedAt: 2026-08-08T17:06:00Z
prNumber: 1227
mergeCommit: 2b632266
commitMode: pr
coversReq: [REQ-048, REQ-030, REQ-032, REQ-045]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-08-08
createdAt: 2026-08-08T15:37:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1531]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~340 LOC (T-1526 274 / T-1528 339 / T-1530 373 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/export-download-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 17(GET /api/admin/export/:id/download). 첫 5-entity fan-out read + 첫 stream artifact 응답. export 는 기존 도메인이라 도메인 14 불변 · route 25 → 26. pr · 2 파일 약 330 LOC."
---

# T-1532 — 실 DB perf slice 17: export dump download 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB round-trip cutover 를 slice 17 로 한 칸 넓힌다. slice 1~16 은 endpoint 도메인 **14 개**(조회 route 25) 를 실 Postgres 위에서 실측했지만, 그 25 route 는 예외 없이 **단일 테이블(또는 FK 로 이어진 한 chain)** 을 읽어 **JSON object / array** 를 돌려주는 경로였다. 본 slice 는 `ExportController` 의 `GET /api/admin/export/:id/download` — 저장된 export job 의 scope 로 **5 entity full-record dump 를 만들어 단일 stream artifact 로 내려주는** Admin 전용 route (REQ-030 Export / REQ-032 raw 미저장 / REQ-045 Admin 전용) — 를 실 부트스트랩으로 처음 실측한다. mock slice([`export-download-read.perf-spec.ts`](../../test/perf/export-download-read.perf-spec.ts), T-0868 계열)는 `ExportJobService` 를 mock 으로 대체하고 guard 를 무력화했으므로 **실 5-entity DB read + 실 guard stack 을 타는 end-to-end 는 미측정**이다.

본 slice 가 주장하는 **새 구조 축 3 개** (README slice 목록에 그대로 근거와 함께 기록할 것):

1. **한 요청이 5 개 테이블을 병렬로 읽는 첫 실측 경로**. `materializeFullExportDownload` → `collectFullExportRecords` 가 `EXPORT_ENTITY_SOURCES` 5 entity(Assessment · Person · Group · LlmConfig · AuditLog) 에 대해 `Promise.all` 로 각각 `findMany` 를 던진다 ([src/export/export-job.service.ts](../../src/export/export-job.service.ts) `465~490 행`). 앞 16 slice 의 최대 fan-out 은 slice 2·3 의 membership indirect navigation(같은 chain 안 loop) 이었고, **서로 무관한 5 테이블을 한 응답으로 합치는 구조는 본 slice 가 처음**이다.
2. **응답이 JSON body 가 아니라 stream artifact 인 첫 slice**. handler 는 `StreamableFile` 을 반환하고 `serializeExportDownloadHeaders` 가 `Content-Type` / `Content-Disposition` / `Content-Length` 를 세팅한다 ([src/export/export.controller.ts](../../src/export/export.controller.ts) `405~460 행`). 즉 latency 에 **직렬화 + Buffer 수집 + header 산출** 비용이 포함되고, 응답 크기가 byte 로 관측 가능한 첫 경로다 (slice 15 의 status-view 는 파생 view 였지만 여전히 작은 JSON object 였다).
3. **DB 읽기량과 응답 크기가 분리되는 첫 경로**. scope 선별(`selectExportRecords`)이 **DB 가 아니라 in-process** 에서 일어나므로 RANGE / PARTIAL job 은 응답이 작아져도 **읽는 row 수는 FULL 과 동일**하다. 따라서 규모 축이 "응답 크기" 가 아니라 "총 DB row 수" 이며, scope 3 종(FULL / RANGE / PARTIAL) 표본의 p95 를 각각 재 이 성질을 관측 기록으로 남긴다. 세 표본의 **대소 관계는 wall-clock 비결정성 때문에 단언하지 않는다**(slice 3 선례).

`@Roles("Admin")` guard 레벨 403 · cookie 미부착/서명 변조 401 · 부재 id 404 는 slice 10~16 과 동일하므로 **새 축으로 주장하지 않고** negative cover 로만 유지한다.

**계수 함정** — export 도메인은 slice 10([`export-read-realdb.perf-spec.ts`](../../test/perf/export-read-realdb.perf-spec.ts)) · slice 15([`export-status-view-read-realdb.perf-spec.ts`](../../test/perf/export-status-view-read-realdb.perf-spec.ts)) 에서 **이미 실측 도메인으로 잡혀 있다**. 따라서 본 slice 는 **실측 endpoint 도메인 14 가 불변이고 조회 route 만 25 → 26** 으로 늘어난다 (slice 15 와 같은 셈법, slice 16 과는 반대 — slice 16 문장을 복사하면 도메인을 잘못 올린다).

## Required Reading

- [docs/tasks/T-1530-perf-realdb-slice16-cron-schedule-registry-read.md](T-1530-perf-realdb-slice16-cron-schedule-registry-read.md) — 직전 slice 의 task 구조 · AC · Out of Scope 선례 (본 task 는 그 동형).
- [test/perf/export-status-view-read-realdb.perf-spec.ts](../../test/perf/export-status-view-read-realdb.perf-spec.ts) — slice 15. `ExportJob` seed(FK `requestedById`) + 실 JWT cookie + `measure` 구조의 **직접 mirror 대상**.
- [test/perf/export-read-realdb.perf-spec.ts](../../test/perf/export-read-realdb.perf-spec.ts) — slice 10. 같은 controller 의 `GET :id` / `running` 실측 선례 (route 중복 측정 회피 대조용).
- [test/perf/export-download-read.perf-spec.ts](../../test/perf/export-download-read.perf-spec.ts) — mock slice. 커버 항목 대조용 (실 판에서 무엇이 추가되는지).
- [src/export/export.controller.ts](../../src/export/export.controller.ts) `405~460 행` (`download`) + `308~330 행` (`buildScopePayload`) — guard · `StreamableFile` 반환 · header 세팅 · `findJob` 404 raw propagate · **`@UseFilters(ScopeInputExceptionFilter)` 미부착** 계약.
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) `426~495 행` — `materializeFullExportDownload` 의 4 단계(5 entity full-record read → scope 선별 → dump envelope → `Readable`) 와 예외 raw-forward 경계.
- [prisma/schema.prisma](../../prisma/schema.prisma) `model ExportJob` — `scope`(`ExportScope` enum) · `dateRange` / `entitySelector`(Json?) · `requestedById`(User FK `onDelete: Restrict`) 필드.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의 slice 16 항목 + `- **잔여**` 항목(`766 행` 부근) — 본 slice 항목을 그 뒤에 append 하고 계수를 갱신한다.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) · [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createAuthenticatedE2EApp` / `reseedAuthenticatedActors` / `truncateAll` 시그니처 (helper 수정 0).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` 시그니처.

## Acceptance Criteria

- [ ] 신규 [`test/perf/export-download-read-realdb.perf-spec.ts`](../../test/perf/export-download-read-realdb.perf-spec.ts) 를 추가한다. 파일명에 `read` 를 포함시켜 README 의 read glob 계수 규칙(slice 14·15·16 선례)을 유지한다. **mock override 0** — `createAuthenticatedE2EApp` 로 AppModule 을 실 부트스트랩하고(실 `PrismaService` · 실 guard stack) 실 JWT cookie 로 요청한다 (`overrideProvider` / `overrideGuard` 사용 금지).
- [ ] **happy path** — Admin actor 가 FULL scope job 의 `GET /api/admin/export/:id/download` 를 호출하면 200 이고, `collectLatencySamples` + `assertS2Threshold` 로 p95 **< 3000ms** 를 실측 pass 한다 (test 1+). 응답 body 를 `JSON.parse` 해 `schemaVersion` · `scope` · `entityCounts` · `recordCount` · `records` 가 존재함을 단언한다.
- [ ] **artifact 계약 단언** — 응답 header 의 `Content-Type` · `Content-Disposition`(파일명 토큰 포함) · `Content-Length` 가 세팅되고, `Content-Length` 가 **실 body byte 길이와 일치**함을 단언한다 (`serializeExportDownloadHeaders` + `byteSizeHint` 실값 보정 경로 검증). 또한 `recordCount` 가 `entityCounts` 5 값의 합과 일치함을 단언한다.
- [ ] **error path** — 존재하지 않는 job id 로 호출하면 `findJob` 의 `NotFoundException` 이 raw propagate 해 **404** 이고, 응답 body 에 raw stack / Prisma 메시지가 노출되지 않음(REQ-032 정합)을 단언한다 (test 1+).
- [ ] **분기 cover** — 저장된 scope 3 분기마다 test 를 둔다: (a) `FULL` → seed 한 5 entity row 가 모두 dump 에 포함(각 `entityCounts` 가 seed 수와 일치), (b) `RANGE` + `dateRange` 창 → **`[start, end)` 반열림** 이라 `end` 시각과 정확히 같은 row 가 **제외** 됨을 단언(경계 row 를 의도적으로 seed), (c) `PARTIAL` + `entitySelector: ["Person"]` → Person 이외 entity 의 count 가 0. 세 분기 각각에서 `GET` p95 < 3000ms 를 함께 측정한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 각 1+ test: (a) Cookie 미부착 → 401(표본 0, `errorRate` 로 확인), (b) 서명 변조 cookie → 401(403 아님), (c) User tier actor → guard 레벨 **403**(service·DB 미도달), (d) 부재 id → 404(위 error path 와 동일 test 재사용 가능), (e) **저장 scope 손상 job**(`scope: RANGE` 인데 `dateRange` null) → `selectExportRecords` 의 `RangeError` 가 **filter 미부착 경로** 라 5xx 로 나타남을 확인하고 응답 body 에 raw stack 미노출을 단언한다, (f) 다른 job id 의 응답이 서로 섞이지 않음(FULL job 과 PARTIAL job 을 연달아 호출해 `entityCounts` 가 각각 자기 scope 기준임) 단언.
- [ ] **규모 관찰** — 같은 FULL job 을 **소규모 seed**(entity 당 1~2 row) 와 **상대적 대규모 seed**(Person ≥ 20 + Assessment ≥ 20) 두 상태에서 각각 측정해 두 p95 를 모두 3000ms 미만으로 단언한다. **두 값의 대소 관계와 body byte 증가량은 assert 하지 않고 관찰 기록만** 남긴다(slice 3 선례).
- [ ] **actor FK 재-seed** — `afterEach` 는 `truncateAll(prisma)` 후 `reseedAuthenticatedActors(ctx)` 로 actor `User` 를 **원본 id 그대로** 재-seed 한다. `ExportJob.requestedById` 가 `User` FK(`onDelete: Restrict`) 이므로 재-seed id 가 달라지면 job seed 가 FK 위반으로 깨진다 (slice 10·15 선례, [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 수정 0).
- [ ] `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 open handle 0. seed 는 각 test 안에서 자기 몫만 만들고 다른 perf-spec 로 row 가 새지 않게 한다.
- [ ] `DEFAULT_P95_MAX_MS = 3000` (REQ-048) 를 변경하지 않고 baseline 파일을 확정하지 않는다 — `buildBaselineReport` / `formatBaselineLine` 은 관찰 전용 한 줄로만 쓴다.
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 slice 목록에 `- **slice 17**` 항목을 append 하고(§Why 의 새 축 3 개를 근거와 함께 기술, "새 축으로 주장하지 않는" 항목도 명시), `- **잔여**` 항목의 계수를 실검산해 갱신한다: perf-spec **50 → 51**, read glob **45 → 46**, 실 DB **16 → 17**(그중 read **15 → 16**), mock 잔존은 `46 − 16 = 30` 으로 **불변**, 실측 endpoint 도메인 **14 불변**(export 는 slice 10·15 에서 이미 도메인), 조회 route **25 → 26**. 실측치와 어긋나면 문서 대신 계수를 고친다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` 변경 0 이므로 기존 수치 유지).
- [ ] 로컬 실 DB 전제(`docker compose up -d postgres` + `DATABASE_URL` + `pnpm prisma migrate deploy`) 하에 `pnpm test:perf` 로 신규 spec 이 picking 되어 통과. `jest-perf.json` 의 `testRegex` 가 자동 매칭하므로 workflow / config 편집 0. 로컬 Postgres 부재 시 CI 의 postgres service `perf test` step success 로 확정한다.

## Out of Scope

- **doc-sync** — `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 · `docs/requirements.md` REQ-048 에 slice 17 실측을 반영하는 작업은 **머지 후 별도 `direct` task** 로 이월한다 (slice 13~16 선례 T-1525 / T-1527 / T-1529 / T-1531 동형 — CLAUDE.md §3.1 rule 3 direct·pr mixed 금지). 본 task 는 `test/` 만 건드린다.
- 같은 controller 의 이미 실측된 route(`GET :id` slice 10 · `GET running` slice 10 · `GET :id/status-view` slice 15) **재측정** — 본 slice 는 `:id/download` 1 route 만 측정한다. `POST` 계열(`create` · `describe-scope` · `preview-selection`) 의 latency 측정도 범위 밖(job seed 는 Prisma 직접 write 로 준비).
- **손상 scope 경로의 400 매핑 여부 판단** — 위 negative (e) 는 현재 동작(filter 미부착 → 5xx) 을 관측·박제만 한다. `@UseFilters(ScopeInputExceptionFilter)` 를 download route 에 부착하는 것은 `src/` 변경이므로 본 task 금지 (Follow-ups 로 이월).
- `src/` production code · `prisma/schema.prisma` · `test/helpers/*` 수정 일체 (helper 재사용만).
- 임계값(3000ms) 변경 · baseline 파일 확정(`writeBaselineFile` / `confirmOrCompareBaseline`) · k6 등 부하 발생기 도입 · REQ-047 실 scale 부하 측정.
- 나머지 mock 잔존 read perf-spec 30 개의 실 DB cutover · `GET /api/admin/import/:id` · `GET /api/groups/:id/members` 등 미측정 read route — endpoint / route 단위 후속 slice.
- `.github/workflows/ci.yml` · `jest-perf.json` · `package.json` 편집.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **doc-sync (direct, 다음 slice 전 필요)** — 본 slice 가 Out of Scope 로 이월한 3 문서 동기: [docs/PLAN.md](../PLAN.md) `142 행` · [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 · [docs/requirements.md](../requirements.md) REQ-048. perf-spec 51 / 실 DB slice 17(read 16) / **실측 endpoint 도메인 14 불변 · 조회 route 25 → 26** 으로 갱신(slice 15 와 같은 셈법 — slice 16 문장 복사 금지). slice 16(T-1531) 의 doc-sync task 와 동형.
- **`GET :id/download` 의 손상 scope 400 매핑 검토 (pr, 별도 task)** — `describe-scope` / `preview-selection` 은 `@UseFilters(ScopeInputExceptionFilter)` 로 `RangeError` 를 400 으로 매핑하는데 `:id/download` 는 미부착이라 저장된 job 의 scope 가 손상된 경우 5xx 가 된다. 저장 데이터 결함을 client 입력 오류(400) 로 볼지 서버 결함(5xx) 으로 볼지 판단이 필요하므로 architect 판단이 선행하는 별도 task 로 분리한다.
