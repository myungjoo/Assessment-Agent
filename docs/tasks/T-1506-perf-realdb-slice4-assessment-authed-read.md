---
id: T-1506
title: 실 DB round-trip perf-spec slice 4 — 인증 경유 `GET /api/assessments` 시계열 조회 p95 실측
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1505]
touchesFiles:
  - test/perf/assessment-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ① (실측 endpoint 2 개뿐) 해소 — slice 4 는 첫 인증·RBAC guard 경유 + index 필터 경로 실 DB 측정"
---

# T-1506 — 실 DB round-trip perf-spec slice 4 (인증 경유 assessment 시계열 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` P7 성능검증 bullet 의 `**잔여**` 절이 [T-1505](T-1505-perf-realdb-slice3-doc-sync.md)
doc-sync 후 남긴 첫 축은 **"실측 범위가 endpoint 2 개(조회 route 4)뿐"** 이다 — slice 1
([T-1500](T-1500-perf-realdb-person-read-baseline.md), `GET /api/persons`) · slice 2
([T-1502](T-1502-perf-realdb-group-read-njoin.md), `GroupController` 3 route) · slice 3
([T-1504](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md), slice 2 와 같은 route 의 규모 축) 은
전부 **guard 가 없는 두 controller** 만 훑었고, 나머지 read perf-spec 30 개는 여전히 service mock +
guard override(배선 latency) 다.

본 slice 는 실측 대상을 **세 번째 endpoint 도메인** 인 `AssessmentController` 로 넓히며, 앞 세
slice 가 한 번도 건드리지 못한 **두 개의 새 축** 을 처음 실측한다:

1. **인증·RBAC guard 경유** — `AssessmentController` 는 `@UseGuards(JwtAuthGuard, RolesGuard)` +
   `@Roles("User")` 가 붙은 첫 측정 대상이다. slice 1~3 은 guard 가 없는 controller 라 **override 0**
   이 곧 "guard 없음" 이었지만, 본 slice 는 **실 JWT 를 발급해 실제로 guard 를 통과** 시킨다 —
   즉 REQ-048 임계가 **인증 layer + DB round-trip 을 모두 포함한** 경로에서도 성립하는지의 첫 증거다.
2. **index 필터 경로** — `GET /api/assessments?personId=&period=` (REQ-038 시계열 조회) 는
   `@@index([personId, period, periodStart])` 를 타는 **필터 + 다중 row** 조회다. slice 1 의 flat
   전체 목록, slice 2·3 의 N+1 loop 와 구조가 다르다.

측정만 한다 — production code 는 1 LOC 도 바꾸지 않고, mock 짝(`assessment-read.perf-spec.ts` ·
`assessment-detail-read.perf-spec.ts`) 도 불변이다.

## Required Reading

- [test/perf/group-persons-scale-realdb.perf-spec.ts](../../test/perf/group-persons-scale-realdb.perf-spec.ts)
  — 직전 slice 의 **구조 정본**. `createE2EApp()` 부트스트랩 → `moduleRef.get(PrismaService)` →
  `beforeAll` 선-truncate → `afterEach(truncateAll)` → `afterAll` 의 `app.close()` +
  `prisma.$disconnect()` → `createMany` seed → `collectLatencySamples` / `assertS2Threshold` /
  `summarizeLatency` 사용 패턴을 그대로 승계한다. **수정 금지**.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — 본 slice 고유의
  진입점. `createAuthenticatedE2EApp([{ role: "User" }])` (app + prisma + jwtService + users +
  tokens 를 한 번에) · `buildAuthCookie(token)` (supertest `Cookie:` header 값) ·
  **`reseedAuthenticatedActors(ctx)`** 3 개만 쓴다. **수정 금지**.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll` 의 대상 테이블
  명단. **`"User"` 가 명단에 포함** 되므로 afterEach 마다 인증 주체 User row 가 사라진다는 사실을
  반드시 확인한다 (AC 7 의 근거).
- [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) `82 행` ~ `120 행` —
  `@Get()` `findByPerson` (personId 필수 · period optional forward) 과 `@Get(":id")` `findOne`
  (row 부재 → 404) 의 분기·상태코드 정본. **수정 금지**.
- [src/user/assessment.service.ts](../../src/user/assessment.service.ts) `40 행` ~ `42 행`
  (`VALID_PERIODS` = `day` / `week` / `month`, `VALID_SCOPES`, `VALID_DIFFICULTIES`) 와
  `95 행` ~ `110 행` (`findByPerson` 의 period 검증 분기 · 매칭 0 시 빈 배열) — seed 값과
  negative 입력의 **허용 집합 출처**. **수정 금지**.
- [prisma/schema.prisma](../../prisma/schema.prisma) `294 행` ~ `317 행` (`model Assessment`) —
  seed 에 필요한 필수 컬럼(`personId` · `period` · `scope` · `periodStart` · `difficulty` ·
  `contributionScore` Decimal · `volume` · `narrative`) 과 `@@unique([personId, period, scope,
  periodStart])` · `@@index([personId, period, periodStart])`. **수정 금지**.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` ·
  `assertS2Threshold` · `RequestFn` · `S2Assertion` 시그니처. **수정 금지**.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절
  (`508 행` 부근) — slice 1 ~ 3 항목과 `**잔여**` bullet. 본 task 의 **유일한 문서 편집 지점**.

## Acceptance Criteria

- [ ] **AC 1 — 신규 spec 파일 1 개.** `test/perf/assessment-read-realdb.perf-spec.ts` 를 신설한다.
  헤더 주석에 ① 본 파일이 **slice 4** 이며 앞 slice 대비 새 축이 **인증 guard 경유 + index 필터
  경로** 라는 것, ② `.perf-spec.ts` 라 기본 `pnpm test` (`.spec.ts$`) 에는 **picking 되지 않고**
  `pnpm test:perf` 로만 실행된다는 것, ③ **service mock 0 · guard override 0** (실 `JwtAuthGuard` /
  `RolesGuard` 를 실 JWT 로 통과) 을 명시한다. `jest.setTimeout` 은 slice 3 과 동등 이상으로 둔다.
- [ ] **AC 2 — happy-path test 1+ (목록).** `createAuthenticatedE2EApp([{ role: "User" }])` 로 발급한
  실 token 을 `buildAuthCookie` 로 실어 `GET /api/assessments?personId=<seed>&period=week` 를 반복
  측정한다. 응답이 **200** 이고 body 배열 길이·`narrative` 값이 **seed 한 row 와 일치** 함으로 실
  query 발화를 입증하고 (mock spec 의 `toHaveBeenCalledTimes` 등가), `assertS2Threshold(...).pass`
  가 **true** (p95 < 3000ms) 임을 확인한다.
- [ ] **AC 3 — happy-path test 1+ (상세).** `GET /api/assessments/:id` 를 seed 한 실 row id 로 반복
  측정해 **200** + body 의 `id` · `period` · `scope` 일치 + p95 pass 를 확인한다. `contributionScore`
  가 Prisma `Decimal` 이라 JSON 직렬화 형태가 number 가 아닐 수 있으므로 **값 동등성 비교는
  문자열화 후** 하거나 해당 필드 대신 다른 컬럼으로 검증한다 (직렬화 형태를 assert 로 못박지 않는다).
- [ ] **AC 4 — 분기 cover (각 1+ test).** `findByPerson` 의 분기를 각각 별도 test 로 분리한다 —
  ① **period 지정** (`?period=week`) → 해당 period row 만 반환, ② **period 미지정** (`?personId=` 만)
  → 전체 period row 반환 (개수가 ① 보다 크거나 같음), ③ **매칭 row 0** (assessment 가 없는 Person id)
  → **200 + 빈 배열** (404 아님). 세 분기 모두 `summarizeLatency` 의 `count` 가 요청 수와 같음을
  확인한다.
- [ ] **AC 5 — error path test 1+.** `GET /api/assessments/:id` 에 **미존재 id** 를 주면 실 DB row
  부재로 **404** 가 나고, 그 표본의 `assertS2Threshold(...).pass === false` (errorRate 위반) +
  `reasons` 에 error 사유가 포함됨을 확인한다. 실 측정 시간에 의존하지 않는 결정론적 fail 분기다.
- [ ] **AC 6 — negative cases 충분 cover (각 1+ test).** 아래 4 종을 **각각 별도 test** 로 박제한다 —
  (a) **personId query 누락** (`GET /api/assessments` 만) → controller 의 `BadRequestException`
  **400**, (b) **허용 집합 밖 period** (`?personId=<id>&period=year`) → service 검증 **400**,
  (c) **인증 없음** (Cookie header 미부착) → `JwtAuthGuard` **401** — guard 가 실제로 살아 있음의
  증거, (d) 실측이 아무리 빨라도 **비현실적 임계** (`p95MaxMs: 0`) 를 주면 `pass === false`.
  200 / 4xx 가 섞인 표본에서 `errorRate` 가 `0 < er < 1` 로 산출되는 것도 위 어느 test 에서 1 회
  확인한다.
- [ ] **AC 7 — 인증 주체 FK 재-seed (본 slice 고유 함정).** `truncateAll` 의 대상 테이블에 `"User"`
  가 포함돼 있어 `afterEach` 이후 JWT 의 `sub` 가 가리키는 actor row 가 사라진다. `afterEach` 는
  **`truncateAll(prisma)` → `reseedAuthenticatedActors(ctx)`** 순서로 실행해 **원본 id 그대로**
  재삽입하고 (새 id 생성 금지 — token 재발급도 하지 않는다), 이 사유를 주석 1 줄로 남긴다.
- [ ] **AC 8 — 생명주기 · 격리 · seed 비용.** `beforeAll` 에서 선-`truncateAll` +
  `reseedAuthenticatedActors` 로 앞 스위트 잔여 row 를 배제하고, `afterAll` 에서 `app.close()` +
  `prisma.$disconnect()` 로 connection 누수 0. Assessment seed 는 개별 `create` loop 이 아니라
  **`createMany`** 로 조립하되 `@@unique([personId, period, scope, periodStart])` 를 피하도록
  `periodStart` 를 row 마다 다르게 준다 (충돌 시 P2002 로 seed 자체가 깨진다).
- [ ] **AC 9 — 문서 갱신.** [test/perf/README.md](../../test/perf/README.md) 의
  `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 4 항목** 을 추가한다 — ① 본 spec 의 위치와
  측정 route 2 개, ② 앞 slice 와의 차이 = **인증·RBAC guard 를 실제로 통과하는 첫 실 DB perf slice**
  + **index 필터 경로**, ③ 측정만 하며 production code · mock 짝은 불변. 기존 `**잔여**` bullet 의
  endpoint 개수 서술을 **2 개 → 3 개 (조회 route 4 → 6)** 로 갱신하되 **임계값 3000ms 불변** ·
  **baseline 미확정** · **REQ-047 실 scale 부하 미검증** 서술은 그대로 유지한다.
- [ ] **AC 10 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:cov` (line ≥ 80% / function
  ≥ 80% — production code 변경 0 이므로 수치 하락 0 이어야 한다) · `pnpm test:perf` 전부 green.
  로컬에 Postgres 가 없으면 `docker compose up -d postgres` + `DATABASE_URL` export +
  `pnpm prisma migrate deploy` 후 실행하고, 그래도 로컬 DB 확보가 불가한 경우에만 CI 의
  `perf test` step green 으로 대체 검증하며 그 사실을 PR 본문에 명시한다.
- [ ] **AC 11 — cap 준수.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 안임을 확인한다. 분량이 cap 을
  위협하면 반복 횟수·seed 규모 상수를 파일 상단에 모으고 request 헬퍼를 공유해 중복을 줄이되,
  R-112 항목 (AC 2 · 3 · 4 · 5 · 6) 은 **삭제하지 않는다**. 그래도 초과하면 AC 3 (상세 route) 을
  후속 slice 로 떼어내고 Follow-ups 에 적는다.

## Out of Scope

- **production code 변경 일체** (`src/`) — `AssessmentController` · `AssessmentService` ·
  `AssessmentRepository` 는 1 LOC 도 바꾸지 않는다. 최적화 여지가 보이면 Follow-ups 에만 적는다.
- **mock 짝 perf-spec 수정** — `assessment-read.perf-spec.ts` · `assessment-detail-read.perf-spec.ts`
  는 배선 latency 축으로 계속 유지한다 (대체 아님, 보완이다).
- **doc-sync** — `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 ·
  `docs/requirements.md` REQ-048 갱신은 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr 혼합
  금지) 에 따라 **머지 후 별도 direct task** 로 이월한다 (slice 1~3 의 T-1501 · T-1503 · T-1505 선례).
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip** — 잔여 축이 살아 있으므로 금지.
- **규모 민감도 측정** — 본 slice 는 slice 3 이 한 **규모 축** 을 assessment route 로 반복하지 않는다
  (고정 소규모 seed). 다른 endpoint 의 규모 민감도는 후속 slice 후보.
- **baseline 파일 저장 · 임계 fix · `compareBaselineReports` 배선** — `buildBaselineReport` 는 관찰
  한 줄 용도로만 쓰고 파일 write 는 하지 않는다 (`§ 5` item 5 별도 축).
- **REQ-047 실 scale 부하 주장** — 본 slice 의 seed 규모는 상대 비교용 표본일 뿐이며 문서 어디에도
  REQ-047 (100~200명 / 50~100 repo / ~1000 confluence page / 1h) 충족으로 읽히는 표현을 쓰지 않는다.
- **새 dependency 추가 · k6 등 부하 발생기 도입** ([ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md)
  PROPOSED) — §5 BLOCKED 게이트.
- **행 좌표 표기 소급 정규화** — 새로 쓰는 좌표만 §12 `§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)` 를
  따르고 기존 표기는 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, 기존 harness·helper 조립만).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
