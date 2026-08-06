---
id: T-1518
title: 실 DB round-trip perf-spec slice 10 — Export job polling 조회 p95 실측
phase: P7
status: DONE
completedAt: 2026-08-06T11:54:20Z
prNumber: 1220
mergeCommit: c1630d402f99d2910b0530536301c55238113144
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 295
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1517]
touchesFiles:
  - test/perf/export-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 8 개) 에서 split — 아홉 번째 endpoint 도메인 + Prisma enum 필터/index 선두 컬럼 + Json? payload + guard 레벨 403 축"
---

# T-1518 — 실 DB round-trip perf-spec slice 10 (Export job polling 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` 의 잔여 절이 "실측 범위가 endpoint **8 개(조회 route 15)** 뿐" 이라고
적고 "남은 endpoint 의 실 DB cutover 는 endpoint 단위 후속 slice 로 이어간다" 를 남겨 뒀다. slice
1~9 (T-1500 · T-1502 · T-1504 · T-1506 · T-1508 · T-1510 · T-1512 · T-1514 · T-1516) 은 `src/user/`
7 controller 와 `PermissionDeniedRecordController` 를 소진했다. 본 task 는 그 잔여를 한 칸 좁혀
**아홉 번째 endpoint 도메인** 인 `ExportController` 의 조회 2 route
(`GET /api/admin/export/running` · `GET /api/admin/export/:id`) 를 실 Postgres 위에서 측정한다
([REQ-048](../requirements.md) 조회 p95 < 3s).

앞 slice 와의 질적 차이는 **구조 축 3 개** 다 — ① **Prisma enum 컬럼 필터 + 명시 `@@index` 의
선두 컬럼만 타는 조회**: `findRunning` 은 `where: { status: "RUNNING" }` 로 `@@index([status,
createdAt])` 의 **leading-edge 1 컬럼만** 쓰고, 그 필터 타입이 String/Int 가 아니라 **Prisma enum
(`JobStatus`)** 인 첫 실측이다 (slice 4 = composite `@@index` 전량, 5 = composite unique prefix,
6 = unique·index 중복 tuple, 7 = 무-index, 8 = 단일 컬럼 `@unique`, 9 = index 2 후보). ②
**`Json?` nullable 컬럼 2 개의 JSONB 역직렬화**: `dateRange` · `entitySelector` 가 nullable Json
이라 **구조화 payload 의 역직렬화 비용 + NULL/비-NULL 혼재 표본** 을 처음 잰다 (slice 6 의
`narrative` long text 는 평문 축이라 다르다). ③ **guard 레벨 403**: 두 route 모두
`@Roles("Admin")` 이라 User tier actor 는 **RolesGuard 단계에서 DB 미도달 403** 이다 — slice 8 의
403 은 controller 가 `isSelf || isAdminPlus` 를 판정한 **controller 레벨** 거절이었으므로 같은
403 이어도 **발생 layer 가 다른 첫 실측** 이다.

부수적으로 본 slice 는 ④ 도메인 데이터가 아닌 **운영 job 생명주기 테이블** 을 처음 재고,
⑤ 단건 조회가 `findUnique` + null 판정이 아니라 **`findUniqueOrThrow` 의 P2025 → 404 변환** 경로
(앞 slice 9 개는 전부 `findUnique`) 라는 점, ⑥ FK 가 `onDelete: Restrict` (앞 slice 는 Cascade 또는
FK 부재) 라는 점에서도 갈린다. slice 1~9 와 마찬가지로 **측정만 하고 production code · schema ·
임계값은 건드리지 않는다**.

## Required Reading

- [test/perf/permission-denied-read-realdb.perf-spec.ts](../../test/perf/permission-denied-read-realdb.perf-spec.ts) —
  **구조 정본** (`281 행`). 헤더 주석 형식 · `jest.setTimeout(120_000)` ·
  `createAuthenticatedE2EApp` 2 actor seed · `buildAuthCookie` · 변조 cookie ·
  `beforeAll`/`afterEach` 의 `truncateAll` + `reseedAuthenticatedActors` (원본 id 그대로) ·
  `collectLatencySamples` + `assertS2Threshold` 사용법을 그대로 승계한다. **이 파일은 수정 금지**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) `143 행`
  (`@Controller("api/admin/export")` — base path 확인) · `183 행` ~ `190 행` (`@Get("running")` +
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) · `479 행` ~ `486 행` (`@Get(":id")`
  단건 polling, path param raw forward).
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) `286 행` ~ `300 행`
  (`findJob` 의 `findUniqueOrThrow` + `findRunning` 의 `where: { status: "RUNNING" }`) ·
  `588 행` ~ `596 행` (`mapNotFound` — P2025 만 `NotFoundException` 으로 변환, 그 외는 raw
  propagate).
- [prisma/schema.prisma](../../prisma/schema.prisma) `614 행` ~ `632 행` (`ExportJob` — `status`
  `JobStatus` default `PENDING` · `scope` `ExportScope` 필수 · `dateRange`/`entitySelector`
  `Json?` · `requestedById` FK `onDelete: Restrict` · `@@index([status, createdAt])`) ·
  `549 행` ~ `554 행` (`JobStatus` = PENDING/RUNNING/SUCCEEDED/FAILED) · `560 행` ~ `564 행`
  (`ExportScope` = FULL/RANGE/PARTIAL). **수정 금지** (schema 변경은
  [CLAUDE.md](../../CLAUDE.md) §5 BLOCKED).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) `43 행` ~ `51 행` —
  `TRUNCATE_TABLES` 에 `"ExportJob"` 은 **없다**. `"User"` 의 `TRUNCATE ... CASCADE` 가 참조
  테이블을 함께 비우므로 (`ON DELETE RESTRICT` 는 DELETE 에만 적용되고 TRUNCATE CASCADE 와 무관)
  **본 파일 수정 불요** — slice 9 의 `UserInstanceAccess` 판단과 동형.
- [test/perf/README.md](../../test/perf/README.md) 의
  `## 실 DB round-trip baseline (slice 목록)` 절 — **slice 9** bullet (`596 행`) 과 **잔여** bullet
  (`612 행`). 본 task 가 갱신할 정본 위치.

## Acceptance Criteria

- [ ] **AC 1 — spec 신설.** `test/perf/export-read-realdb.perf-spec.ts` 를 추가한다. slice 9 와
  동일하게 **mock override 0 · guard override 0** 으로 `createAuthenticatedE2EApp` 이 `AppModule` 을
  실 부트스트랩하고, actor 는 `User` tier 1 명 + `Admin` tier 1 명을 seed 해 실 JWT cookie 로만
  인증한다. seed 한 `ExportJob` row 의 `requestedById` 는 **Admin actor 의 id** 를 쓴다 (FK
  `Restrict`). 임계 단언은 `assertS2Threshold` (기본 p95 < 3000ms) 를 쓰고 임계값을 재정의하지
  않는다.
- [ ] **AC 2 — happy-path test 2+.** ① Admin actor 의 `GET /api/admin/export/running` → 200 +
  seed 한 `RUNNING` job 만 담기고 (`id`/`scope` 대조로 실 query 발화 입증) p95 < 3000ms,
  ② Admin actor 의 `GET /api/admin/export/:id` → 200 + 해당 job 의 `status`/`scope` 가 seed 값과
  일치하고 p95 < 3000ms. 검증은 `toHaveBeenCalledTimes` 가 아니라 **body 의 seed 값 대조** 로 한다.
- [ ] **AC 3 — 분기 test 3+.** (a) `PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED` 4 status 를 섞은 표본에서
  `running` 이 **`RUNNING` row 만** 반환 (다른 status 비혼입 — enum 필터 + index 선두 컬럼 경로),
  (b) `RUNNING` row 가 **0 개** 인 상태의 `running` → 200 + **빈 배열**, (c) `dateRange` ·
  `entitySelector` 가 **모두 채워진 job** 과 **모두 NULL 인 job** 을 각각 `:id` 로 조회해 Json 역
  직렬화 결과 (객체 그대로 / `null`) 를 확인. 각 갈래를 별도 `it` 으로 두고 모두 p95 < 3000ms 를
  단언한다. 두 Json 표본의 **latency 대소 관계는 단언하지 않는다** (slice 3 선례 — wall-clock
  비결정성).
- [ ] **AC 4 — error / negative test 4+ (예외 분기마다 1+).** (a) Cookie **부재** → 401
  (`JwtAuthGuard`), (b) **변조 토큰** cookie → 401, (c) **User tier actor** 의 두 route 접근 →
  **403** (`RolesGuard` 가 DB 미도달로 거절 — 본 slice 의 핵심 축, 두 route 각각 확인),
  (d) **미존재 id** 의 `:id` 조회 → **404** (`findUniqueOrThrow` 의 P2025 → `NotFoundException`
  변환). 401/403 분기는 DB 미도달이라 `p95MaxMs: 0` 로 측정 시간 무의존 단언을 쓴다.
- [ ] **AC 5 — 정리 invariant 준수.** `afterEach` 는 `truncateAll` 후 `reseedAuthenticatedActors` 로
  actor 를 **원본 id 그대로** 재-seed 한다 (JWT `sub` 매칭 유지 — 새 id·token 재발급 금지).
  `ExportJob` row 는 `"User"` truncate 의 CASCADE 로 함께 지워지는 것을 전제로 하되, 만약 잔존이
  관측되면 **`test/helpers/db-truncate.ts` 를 수정하지 말고** 각 test 의 정리 단계에서
  `prisma.exportJob.deleteMany()` 로 흡수한다 (helper 수정은 drift-guard spec 동반 수정을 유발해
  파일 수 상한이 깨진다).
- [ ] **AC 6 — README slice 목록 갱신.** `test/perf/README.md` 의
  `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 10** bullet 을 추가한다 — 파일명 ·
  task ID · 조회 2 route · **구조 축 3 개** (Prisma enum(`JobStatus`) 필터 + `@@index([status,
  createdAt])` 선두 컬럼 / `Json?` 2 컬럼의 JSONB 역직렬화 + NULL 혼재 / `@Roles("Admin")` **guard
  레벨** 403 — slice 8 의 controller 레벨 403 과 layer 상이) + 부수 축 (운영 job 테이블 ·
  `findUniqueOrThrow` P2025 → 404 · FK `Restrict`) · **소규모 표본이라 REQ-047 실 scale 부하가
  아님** 을 적는다. 이어 **잔여** bullet 의 계수를 실측값으로 갱신한다 — endpoint **8 → 9**
  (조회 route **15 → 17**), read glob **38 → 39**, 실 DB read **8 → 9**, 그리고 **mock 잔존
  30 개는 불변** (파일명에 `read` 가 있어 피감수·감수가 함께 +1). 개수는 추정 금지 —
  `ls test/perf/*.perf-spec.ts | wc -l` · `ls test/perf/*read*.perf-spec.ts | wc -l` ·
  `ls test/perf/*realdb*.perf-spec.ts` 실측값만 쓴다.
- [ ] **AC 7 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:perf` 가 모두 green 이어야 한다
  (새 spec 이 실 Postgres 로 통과). 아울러 `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 를
  유지함을 확인한다 (본 task 는 production code 0 LOC 변경이라 coverage 수치가 내려가서는 안 된다).
- [ ] **AC 8 — 크기 상한.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 임을 확인한다. 초과가
  예상되면 test 수를 줄이지 말고 **헤더 주석과 test 내 설명 주석을 축약** 해 맞춘다 (AC 2~4 의
  test 종류는 필수). 그래도 초과하면 진행하지 말고 Follow-ups 에 split 필요를 적고 BLOCKED 로
  넘긴다.
- [ ] **AC 9 — 범위 표기 규약.** 본 task 가 새로 추가하는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md)
  §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를 따른다 — 구분자 `~`,
  단일 행은 `98 행`, `L` prefix 금지. 기존 표기의 소급 치환은 금지.

## Out of Scope

- **production code 변경 일체** (`src/`) — 본 task 는 **측정만** 한다. `ExportJob` index 추가 ·
  `findRunning` 필터 확장 (`IN [PENDING, RUNNING]` 등) · 404 매핑 변경 모두 금지.
- **`prisma/schema.prisma` · migration 변경** — [CLAUDE.md](../../CLAUDE.md) §5 DB schema 게이트
  (BLOCKED 대상). 필요 판단이 서면 Follow-ups 에만 적는다.
- **`GET /api/admin/export/:id/status-view` · `:id/download` 측정** — 전자는 파생 view 합성
  (DB read + CPU 후처리) 축이라 **후속 slice** 로 이월하고, 후자는 streaming 응답이라 latency 측정
  계약 자체가 다르다. 본 task 는 `running` + `:id` 2 route 만 잰다.
- **`ImportController` 측정** — `GET running`/`modes`/`:id` 대칭 도메인이지만 **별도 slice** 다
  (한 task 2 route 원칙 유지).
- **`test/helpers/db-truncate.ts` 에 `"ExportJob"` 추가** — `"User"` CASCADE 로 충분하고, 추가하면
  `db-truncate.spec.ts` 등 drift-guard spec 동반 수정으로 파일 수 상한이 깨진다.
- **앞 slice spec 수정** (`*-realdb.perf-spec.ts` 9 개) 및 `latency-*.ts` primitive 수정 — 본 task 는
  신설 1 파일 + README 만 건드린다.
- **PLAN · 부하계획 `§ 5` · REQ-048 doc-sync** — [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr
  mixed 금지) 에 따라 **머지 후 별도 direct task** 로 이월한다 (T-1501 · T-1503 · T-1505 · T-1507 ·
  T-1509 · T-1511 · T-1513 · T-1515 · T-1517 선례).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 불변, baseline 파일 write 금지
  (`buildBaselineReport` 는 관찰 전용).
- **REQ-047 실 scale 부하 주장** — seed 는 상대 비교용 소규모 표본이다. spec 주석·README 어디에도
  REQ-047 충족으로 읽히는 표현을 쓰지 않는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip** — 잔여 축이 살아 있으므로 금지.
- **regression test 항목** — 본 task 는 patch 가 아니다 (`hqOrigin` 없음).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, slice 1~9 의 확립된 구조 승계).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
