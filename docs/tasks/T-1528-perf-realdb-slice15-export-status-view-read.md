---
id: T-1528
title: 실 DB perf slice 15 — export status-view derived read 실측
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-030]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-07
independentStream: perf-realdb-slices
dependsOn: [T-1527]
touchesFiles:
  - test/perf/export-status-view-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 15(ExportController :id/status-view derived view). slice 14(T-1526) 선례 동형, pr · 2 파일 약 285 LOC.
---

# T-1528 — 실 DB perf slice 15: export status-view derived read 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB round-trip cutover 를 slice 15 로 한 칸 넓힌다. slice 1~14 는 endpoint 도메인 13 개(조회 route 23) 를 실 Postgres 위에서 실측했지만, **DB row 를 그대로(또는 필드 제거만 해서) 반환하는 경로만** 재 왔다. 본 slice 는 `ExportController` 의 `GET /api/admin/export/:id/status-view` — DB 의 `JobStatus` enum 1 개를 순수 helper 로 **파생 payload 로 합성해서** 반환하는 derived-detail 경로 — 를 실 DB 로 처음 실측한다. mock slice(T-0856, [`export-status-view-read.perf-spec.ts`](../../test/perf/export-status-view-read.perf-spec.ts))는 `ExportJobService` 를 mock 으로 대체해 status 2 종만 주입했으므로, 실 DB 에서 읽은 enum 값이 매핑표 → helper 를 타고 응답 shape 전체를 결정하는 end-to-end 는 아직 미측정이다.

본 slice 가 주장하는 **새 구조 축 3 개** (README slice 목록에 그대로 기록할 것):

1. **파생 view 반환 — DB row 와 응답 shape 가 완전히 다른 첫 실 DB 경로**. 앞 14 slice 는 raw record(slice 1~10·12·13) 또는 whitelist sanitize(slice 11 per-row · slice 14 단건 — 둘 다 **필드 제거**)였다. 본 경로는 `phaseLabel` · `stepIndex` · `totalSteps` · `nextStatus` · `terminal` · `downloadable` · 한국어 `message` 를 **신설**해 반환하므로 `ExportJob` row 의 어떤 컬럼도 그대로 나오지 않는다.
2. **DB enum 컬럼 1 개가 응답 전체를 결정하는 첫 경로**. `JobStatus` 4 값(`PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED`)이 `JOB_STATUS_TO_VIEW` 로 lowercase 매핑된 뒤 `describeExportJobStatus` 가 4 종의 서로 다른 view 를 만든다 — slice 10 이 같은 enum 을 **필터 축**(`running` 목록)으로 썼던 것과 달리 본 slice 는 같은 enum 을 **payload 결정 축**으로 쓴다.
3. **같은 row 를 읽는 두 route 가 각각 별도 slice 로 실측되는 첫 페어**. slice 10 이 `GET :id`(raw record) 를 쟀고 본 slice 가 `GET :id/status-view`(derived view) 를 잰다 — slice 13 의 부모–자식 페어는 **두 테이블**이었지만 본 건은 **동일 테이블·동일 row** 다.

`@Roles("Admin")` guard 레벨 403 · `findUniqueOrThrow` 의 P2025 → 404 는 slice 10 과 동일하므로 **새 축으로 주장하지 않고** negative cover 로만 유지한다.

## Required Reading

- [docs/tasks/T-1526-perf-realdb-slice14-auth-me-read.md](T-1526-perf-realdb-slice14-auth-me-read.md) — 직전 slice 의 task 구조·Out of Scope 선례 (본 task 는 그 동형).
- [test/perf/export-read-realdb.perf-spec.ts](../../test/perf/export-read-realdb.perf-spec.ts) — slice 10. 같은 도메인의 실 DB 부트스트랩 · `JOB_SEEDS` 4 status seed · `seedJobs` · `measure` · `afterEach` 재-seed 구조의 **직접 원본**. 본 slice 는 이 harness 를 mirror 한다.
- [test/perf/export-status-view-read.perf-spec.ts](../../test/perf/export-status-view-read.perf-spec.ts) — mock slice(T-0856). 커버 항목 대조용 (실 DB 판에서 무엇이 추가되는지).
- [src/export/export.controller.ts](../../src/export/export.controller.ts) `136 행` 부근 `JOB_STATUS_TO_VIEW` 와 `464~471 행` `statusView` 핸들러 — controller 자체 분기 0 · 404 raw propagate 계약.
- [src/export/export-job-status-view.ts](../../src/export/export-job-status-view.ts) — `describeExportJobStatus` 와 view 불변식(`downloadable === true ⟹ status === "ready"`, `nextStatus === null ⟺ terminal === true`).
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의 slice 14 항목 + `- **잔여**` 항목 — 본 slice 항목을 그 뒤에 append 하고 계수를 갱신한다.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) · [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createAuthenticatedE2EApp` / `reseedAuthenticatedActors` / `truncateAll` 시그니처 (helper 수정 0).

## Acceptance Criteria

- [ ] 신규 [`test/perf/export-status-view-read-realdb.perf-spec.ts`](../../test/perf/export-status-view-read-realdb.perf-spec.ts) 를 추가한다. 파일명에 `read` 를 포함시켜 README 의 read glob 계수 규칙(slice 14 선례)을 유지한다. `mock override 0` — `createAuthenticatedE2EApp` 로 AppModule 을 실 부트스트랩하고 실 `PrismaService` 로 `ExportJob` 을 seed 하며 실 JWT cookie 로 요청한다 (`overrideProvider` / `overrideGuard` 사용 금지).
- [ ] **happy path** — Admin actor 가 `GET /api/admin/export/:id/status-view` 를 호출하면 200 이고 body 가 seed 한 status 에 대응하는 view(`phaseLabel` · `stepIndex` · `totalSteps` · `nextStatus` · `terminal` · `downloadable` · `message`) 이며, `collectLatencySamples` + `assertS2Threshold` 로 p95 **< 3000ms** 를 실측 pass 한다 (test 1+).
- [ ] **error path** — 미존재 id 로 조회 시 `findUniqueOrThrow` 의 P2025 → `NotFoundException` 이 helper 도달 전에 raw propagate 해 **404** 임을 확인한다 (test 1+). 응답 body 에 raw stack / Prisma 내부 메시지가 노출되지 않음(REQ-032 정합)도 함께 단언한다.
- [ ] **분기 cover** — `JobStatus` 4 값(`PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED`)을 각각 seed 해 4 route 호출이 서로 다른 view 로 갈리는지 분기마다 test 를 둔다: (a) `PENDING` → `queued` · `terminal false` · `downloadable false` · `nextStatus` 비-null, (b) `RUNNING` → `running` · `stepIndex` 가 (a) 보다 뒤, (c) `SUCCEEDED` → `ready` · `terminal true` · `downloadable true`, (d) `FAILED` → `failed` · `terminal true` · `downloadable false` · `nextStatus === null`. 4 응답 모두에서 `downloadable === true ⟹ status === "ready"` 와 `nextStatus === null ⟺ terminal === true` 불변식을 단언한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 각 1+ test: (a) Cookie 미부착 → 401(표본 0, `errorRate` 로 확인), (b) 서명 변조 cookie → 401(403 아님), (c) User tier actor → guard 레벨 **403** (DB 미도달), (d) 미존재 id → 404, (e) `:id` 자리에 `running` 같은 형제 route 토큰을 넣은 path 변형이 500 으로 새지 않고 4xx 로 갈리는지 확인.
- [ ] **동일 row 두 route 관찰** — 같은 `ExportJob` row 를 `GET :id`(slice 10 이 잰 raw record) 와 `GET :id/status-view`(본 slice) 로 각각 측정해 두 p95 를 모두 3000ms 미만으로 단언한다. **두 값의 대소 관계는 wall-clock 비결정성 때문에 assert 하지 않고 관찰 기록만** 남긴다(slice 3 선례).
- [ ] `afterEach` 는 `truncateAll(prisma)` 후 `reseedAuthenticatedActors(ctx)` 로 actor User 를 **원본 id 그대로** 재-seed 한다 (slice 10·14 선례, [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 수정 0). `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 connection 누수 0.
- [ ] `DEFAULT_P95_MAX_MS = 3000` (REQ-048) 를 변경하지 않고 baseline 파일을 확정하지 않는다 — `buildBaselineReport` / `formatBaselineLine` 은 관찰 전용 한 줄로만 쓴다.
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 slice 목록에 `- **slice 15**` 항목을 append 하고(§Why 의 새 축 3 개를 근거와 함께 기술, "새 축으로 주장하지 않는" 항목도 명시), `- **잔여**` 항목의 계수를 실검산해 갱신한다: perf-spec **48 → 49**, read glob **43 → 44**, 실 DB **14 → 15**(그중 read **13 → 14**), mock 잔존은 `44 − 14 = 30` 으로 **불변**, 실측 endpoint 도메인 **13 불변** · 조회 route **23 → 24**.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — `src/` 변경 0 이므로 기존 수치 유지).
- [ ] 로컬 실 DB 전제(`docker compose up -d postgres` + `DATABASE_URL` + `pnpm prisma migrate deploy`) 하에 `pnpm test:perf` 로 신규 spec 이 picking 되어 통과. `jest-perf.json` 의 `testRegex` 가 자동 매칭하므로 workflow / config 편집 0.

## Out of Scope

- **doc-sync** — `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 · `docs/requirements.md` REQ-048 에 slice 15 실측을 반영하는 작업은 **머지 후 별도 `direct` task** 로 이월한다 (slice 12·13·14 선례 T-1523 / T-1525 / T-1527 동형). 본 task 는 `test/` 만 건드린다.
- `GET /api/admin/export/:id/download` (streaming artifact) 의 실 DB 실측 — 별도 slice. 본 slice 는 `:id/status-view` 만.
- `src/` production code · `prisma/schema.prisma` · `test/helpers/*` 수정 일체 (helper 재사용만).
- 임계값(3000ms) 변경 · baseline 파일 확정(`writeBaselineFile` / `confirmOrCompareBaseline`) · k6 등 부하 발생기 도입 · REQ-047 실 scale 부하 측정.
- 나머지 mock 잔존 perf-spec 30 개의 실 DB cutover — endpoint / route 단위 후속 slice.
- `.github/workflows/ci.yml` · `jest-perf.json` · `package.json` 편집.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
