---
id: T-1541
title: 실 DB perf slice 21 — import job 단건 status polling 조회 실측
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 380
estimatedFiles: 2
created: 2026-08-09
createdAt: 2026-08-09T09:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1540]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~570 LOC (T-1500 275 / T-1526 274 / T-1528 339 / T-1530 345 / T-1537 552 / T-1539 565 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/import-detail-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 21(GET /api/admin/import/:id). 인벤토리 (B) 잔여 2 중 오래된 짝. 새 축 = 같은 depth 정적 2 종 vs :id 라우팅 우선순위. 도메인 14 불변 · route 29 → 30. pr · 2 파일 약 380 LOC."
---

# T-1541 — 실 DB perf slice 21: import job 단건 status polling 조회 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB
round-trip cutover 는 slice 1~20 으로 **endpoint 도메인 14 개 · 조회 route 29 개** 에 도달했고,
T-1540 doc-sync 로 [부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5 인벤토리가 최신이다.
그 인벤토리가 확정한 **진짜 잔여 cutover 후보 (B) 2 route** 는 `GET /api/admin/import/:id` 와
`GET /api` 둘뿐이며, 본 task 는 그중 **더 오래된 미해소 짝** 인 `GET /api/admin/import/:id` 를
slice 21 로 소진한다 (slice 12(T-1522) 가 `modes` · `running` 두 route 만 재고 `:id` 는
`no-such-job-id` **404 negative** 로만 두드려 인벤토리가 (B) 로 **보수 분류** 해 둔 자리다 —
slice 19 가 세운 "보수 분류는 happy-path 실측으로 푼다" 선례를 잇는 두 번째 사례).

고유 구조 축은 **같은 depth 의 정적 세그먼트 2 종(`modes` · `running`) 과 동적 `:id` 의 라우팅
우선순위** 다 — `ImportController` 는 `@Get("running")` · `@Get("modes")` 를 `@Get(":id")` **앞에**
선언해, 문자열 `"modes"` / `"running"` 을 id 로 넣어도 404 가 아니라 정적 route 가 이겨 200 이 된다
(즉 `:id` 로는 도달 불가능한 id 공간이 존재한다). slice 10 의 `ExportController` 는 같은 depth 정적이
`running` **1 종** 이고 나머지는 `:id` **하위** 정적(`status-view` · `download`) 이라, 같은 depth 정적이
2 종인 대상은 본 slice 가 처음이다.

본 slice 는 **측정만** 한다 — production code · schema · 임계값은 건드리지 않는다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  잔여 인벤토리의 (B) 2 route 목록 · 보수 분류 표기 · 계수 검산 (`A + B = 28 + 2 = 30`).
- [test/perf/README.md](../../test/perf/README.md) — slice 20 bullet 과 그 아래 `**잔여**` bullet
  (계수 정본: perf-spec 54 / read glob 49 / 실 DB read 19 / 실 DB 총 20 / mock 잔존 30).
- [test/perf/import-read-realdb.perf-spec.ts](../../test/perf/import-read-realdb.perf-spec.ts) —
  slice 12. 부트스트랩 · `JOB_SEEDS` 4 row · actor 상수 · `afterEach` 구조를 그대로 승계할 대상
  (**이 파일은 수정하지 않는다**).
- [test/perf/export-read-realdb.perf-spec.ts](../../test/perf/export-read-realdb.perf-spec.ts) —
  slice 10. job `:id` 단건 + P2025 + status enum 4 표본의 **선행 사례** — "새 축으로 주장하지 않을
  항목" 의 근거로 삼는다.
- [test/perf/part-detail-read-realdb.perf-spec.ts](../../test/perf/part-detail-read-realdb.perf-spec.ts) —
  slice 20. 단건 상세 slice 의 헤더 서술 형식(위치 / mock 짝 / 새 축 / **새 축으로 주장하지 않는 것** /
  negative 구성)을 형식 선례로 삼는다.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) `344~387 행` —
  `@Get("running")` · `@Get("modes")` · `@Get(":id")` 의 **선언 순서** 와 `@UseGuards(JwtAuthGuard,
  RolesGuard)` + `@Roles("Admin")`.
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) `167~181 행` —
  `findJob` 의 `findUniqueOrThrow` → `mapNotFound`(P2025 → `NotFoundException`) 변환.
- [prisma/schema.prisma](../../prisma/schema.prisma) `649~666 행` — `ImportJob` 모델
  (`status`/`mode` enum 2 종 + nullable scalar 4 + `requestedById` FK `Restrict` +
  `@@index([status, createdAt])`).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) —
  `createAuthenticatedE2EApp` / `buildAuthCookie` / **`reseedAuthenticatedActors`**. `afterEach` 의
  `truncateAll` 이 actor `User` 까지 지우는데 `ImportJob.requestedById` 는 `User` 로의 FK(`Restrict`)
  라, **seed 전 actor 재seed 가 필수** 다 (미이행 시 FK 위반으로 seed 실패).

## Acceptance Criteria

- [ ] `test/perf/import-detail-read-realdb.perf-spec.ts` 신설 — mock override **0** 으로 AppModule 을
      실 부트스트랩(`createAuthenticatedE2EApp`)하고 `PrismaService` 실 client 로 seed 해
      `GET /api/admin/import/:id` 의 **DB round-trip 포함 latency** 를 측정한다. 검증은 호출 횟수가
      아니라 **응답 body 가 seed row 값과 일치** 함으로 한다.
- [ ] **happy-path test 1+** — Admin cookie 로 `GET /api/admin/import/:id` 를 반복 조회해 전부 200 이고
      응답 `id` · `status` · `mode` 가 seed 값과 일치하며 `assertS2Threshold` 가 p95 < 3000ms 로 pass.
- [ ] **error path test 1+** — 미존재 id 조회가 전부 404(P2025 → `NotFoundException`) 로 수렴하고 성공
      표본이 0 임을 단언. **500 이 아님** 을 명시적으로 확인.
- [ ] **분기 cover** — 최소 3 분기: ① 200 (존재 row), ② 404 (부재 row, `findUniqueOrThrow` throw 분기),
      ③ **nullable scalar 채움 정도가 반대인 두 표본** (`error`/`artifactRef`/`restoredRowCount` 가
      모두 NULL 인 job vs 셋 다 채워진 job) 의 단건 응답이 각각 null / 실값으로 갈리고 두 p95 가 모두
      임계 미만.
- [ ] **새 축 test — 라우팅 우선순위** — `:id` 자리에 문자열 `"modes"` · `"running"` 을 넣으면 404 가
      아니라 **정적 route 가 이겨 200** 이고 응답 body 가 각각 modes 고정 2 원소 / RUNNING 목록 형태임을
      단언한다 (`:id` 로 도달 불가능한 id 공간의 존재 증거). 세 route 의 p95 는 모두 임계 미만으로
      단언하되 **대소 관계는 assert 하지 않는다** (slice 3 선례 — wall-clock 비결정성).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: (a) cookie 부재 **401** (표본 0),
      (b) 변조 토큰 cookie **401** (403 아님), (c) User tier actor **403** (guard 레벨, DB 미도달),
      (d) 미존재 id 반복 주입 시 errorRate 임계 위반으로 `pass === false`, 200 혼합 표본에서는
      `0 < errorRate < 1`, (e) `p95MaxMs: 0` 비현실적 임계 주입 시 실 측정값이라도 `pass === false`
      + p95 사유, (f) **빈 DB** 에서 임의 id 조회가 500 이 아니라 404 로 수렴, (g) 비-cuid 형태 · 빈
      대체 토큰 id 도 404 로 수렴, (h) 대조군 job 이 함께 존재해도 응답에 다른 job 의 `id` / `mode` 가
      섞이지 않음(혼입 0) + 응답에 `requestedBy` 키 부재(미조인 SELECT 증거).
- [ ] spec 헤더 주석에 다음을 명시: ① slice 위치와 계수(도메인 **14 불변** — `ImportController` 는
      slice 12 에서 이미 도메인, 조회 route **29 → 30**), ② mock 짝이
      `test/perf/import-detail-read.perf-spec.ts` 이며 **수정하지 않음**, ③ 새 구조 축(같은 depth 정적
      2 종 vs `:id` 의 라우팅 우선순위 실측 · slice 12 가 404 negative 로만 두드린 (B) 보수 분류의
      happy-path 해소), ④ **새 축으로 주장하지 않는 항목** — `findUniqueOrThrow` 의 P2025 →
      `NotFoundException` 변환(slice 10 `ExportJob.findJob` 동일) · job status enum 4 상태 표본
      (slice 10 동일) · `JwtAuthGuard + RolesGuard` + `@Roles("Admin")` 의 401 / 403 layer
      (slice 10·11·12 동일) · PK 직행 단건 조회(slice 11·14·19·20 동일) · 한 controller 의 조회 route
      전량 실측 도달(Group slice 18 · Person 19 · Part 20 선례가 있어 새 축 아님).
- [ ] `test/perf/README.md` 에 **slice 21 bullet** 추가 + 그 아래 `**잔여**` bullet 의 계수 갱신 —
      perf-spec **54 → 55**, read glob **49 → 50**, 실 DB read **19 → 20**, 실 DB 총 **20 → 21**,
      **mock 잔존 30 은 불변**(`50 − 20 = 30` 검산 명시), 조회 route **29 → 30**, 도메인 **14 불변**.
      계수는 추정 금지 — `ls` glob + `grep -c` 실측값만 기재.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 — 본 파일은 `jest-perf.json` 의 `testRegex` 에만 매칭돼 기본 `pnpm test` 에는
      picking 되지 않음을 확인.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production code 변경이 0 이라 coverage 영향
      0 임을 함께 확인.
- [ ] `pnpm test:perf` 로 본 spec 이 실 Postgres(`DATABASE_URL` + `prisma migrate deploy` 전제) 에서
      통과. CI 의 `perf test` step 이 이 전제를 자동 충족함을 확인(workflow 편집 0).

## Out of Scope

- production code 변경 **0** — `ImportJobService.findJob` 에 필터 / `include` 추가, route 선언 순서
  변경, guard 조정, 404 메시지 변경 금지.
- `prisma/schema.prisma` 수정 · migration 추가 (`ImportJob` index 추가 판단은 본 실측을 근거로 하는
  별도 task).
- slice 12 spec(`import-read-realdb.perf-spec.ts`) 수정 — 정적 route 는 본 spec 안에서 호출만 한다.
- mock 짝(`import-detail-read.perf-spec.ts`) 수정 · retire · 통합 — T-1536 이 명시 유보한 별도 주제
  (mock 잔존 계수 불변).
- 남은 (B) 1 route(`GET /api` — `app-root-read`) 측정 — 다음 slice 소관.
- write / trigger route(`POST /api/admin/import` · `preview`) 의 latency 측정 — seed 는 Prisma 직접 write.
- 임계값 변경 · baseline 파일 확정 (`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` ·
  `confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크 write 0).
- 동시성 S3 시나리오 (`concurrency: 1` 고정).
- REQ-047 실 scale 부하 · REQ-048 완료 선언 — PLAN `140 행` checkbox `[ ]` 와 REQ-048 `IN_PROGRESS` 불변.
- doc-sync (PLAN `142 행` · 부하계획 `§ 5` item 5 인벤토리 (B) **2 → 1** 재분류 · requirements 반영) —
  CLAUDE.md `§3.1` rule 3(direct·pr mixed 금지) 에 따라 머지 후 별도 `direct` task 로 이월.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
