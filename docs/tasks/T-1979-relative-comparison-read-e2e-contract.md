---
id: T-1979
title: GET /api/assessment-evaluation/relative-comparison 조회 e2e 계약 spec 신설 (순위·백분위 산출 · RBAC 축)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-036, REQ-043]
estimatedDiff: 290
estimatedFiles: 1
dependsOn: []
touchesFiles: [test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts]
independentStream: relative-comparison-e2e
created: 2026-09-08
plannerNote: P5 · PLAN 166 행 e2e 커버리지 축 — REQ-036 이 스스로 "실 부팅 왕복 e2e 는 0" 이라 자인한 좌표 조회 route 를 계약 고정
---

# T-1979 — GET /api/assessment-evaluation/relative-comparison 조회 e2e 계약 spec 신설

## Why

[docs/PLAN.md](../PLAN.md) `166 행` 의 "E2E 시나리오 커버리지" 축에서 `/api/assessment-evaluation` controller 는 `period` · `reset` · `unevaluated-fill-*` 만 실 부팅 e2e 를 가지고 있고, **좌표 상대 비교 조회 route 는 e2e 가 0** 이다. 그 공백은 [docs/requirements.md](../requirements.md) `55 행` REQ-036 행이 한계로 **스스로 자인**한다 — "(a) 실 부팅 왕복 e2e 는 0 이다(`git grep -c "relative-comparison" -- test/` 히트 0)". 이 route 는 한 좌표 안 전원의 rank · percentile 을 돌려주는 노출 표면이라, 계약이 깨지면 (i) 남의 상대 위치가 tier 완화로 새거나 (ii) Prisma `Decimal` 이 문자열로 새서 정렬·평균이 조용히 뒤집힌다. 둘 다 unit mock 축으로는 원리적으로 잡히지 않는다.

issue-still-relevant pre-check (origin/main `2dde2b00`, 실측):

- **e2e 0 재확인** — `git grep -c "relative-comparison" origin/main -- test/` 히트 **0**, `test/e2e/` 34 개 spec 중 본 route 를 부팅해 호출하는 파일 **0**. 신설 대상 파일명 `test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts` 도 부재. T-1979 ID 미사용.
- **구현은 이미 main 에 실재** (= 미구현 신설이 아니라 **계약 고정**) — [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `845~855 행` 의 `@Get("relative-comparison")` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 이 그대로 있고, 위임 chain(reader → `SummaryService.findByCoordinate` → `computeRelativeComparison`) 도 전량 머지돼 있다.
- **e2e 로만 검증 가능한 축이 2 개** — ① `metricScore` 는 schema 상 `Decimal` 이라 reader `54~69 행` `toEntryScore` 의 `toNumber()` 분기가 실 왕복에서만 타고, unit spec 은 number 리터럴을 mock 으로 넣어 이 분기를 건너뛴다. ② "동점 내부 순서 = 입력 최초 등장 순서" 라는 domain `181~188 행` 의 결정적 tie-break 는 **입력 배열 순서가 결정적일 때만** 의미가 있고, 그 순서를 실제로 만드는 것은 repository `137~145 행` 의 `orderBy: { personId: "asc" }` 다 — 두 파일의 결합은 실 DB 왕복에서만 관찰된다.
- **부분 안착 아님** — `web/` 소비 0 (`git grep` 히트 0) 이라 UI 축 회귀 위험은 없고, 본 task 는 API 계약 축만 닫는다.
- 오너 게이트 침범 0 — `test/perf` · `test/load` 신규 slice 0 (PLAN `157~158 행`), helper 신설 0 (PLAN `182 행` 소비처 동반 의무), REQ 재판정 0 (PLAN `183 행` once-rule — 머지 후 1 회만, 아래 `Follow-ups`).

## Required Reading

- [test/e2e/summaries.e2e-spec.ts](../../test/e2e/summaries.e2e-spec.ts) — `56~65 행`(import 집합: `PrismaService` · `buildAuthCookie` / `createAuthenticatedE2EApp` / `AuthenticatedE2EContext` · `truncateAll`), `78~81 행`(`messageText` — ValidationPipe message 가 string / string[] 양쪽인 것을 흡수), `96~107 행`(actor 2 종 seed + cookie 준비), `117~120 행`(`afterEach` 의 `truncateAll` 만 — 본 route 는 **읽기** 라 User FK write 가 없어 actor 재-seed 불요), `123~155 행`(`seedSummary` — Person 선행 create 후 Summary create; `metricScore` 는 문자열로 주면 Prisma 가 Decimal 로 적재).
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `159~163 행`(controller-scope ValidationPipe: `whitelist` + `forbidNonWhitelisted` + `transform`), `845~855 행`(route + guard stack + `new Date(dto.periodStart)` 위임 형태).
- [src/assessment-evaluation/dto/relative-comparison-query.dto.ts](../../src/assessment-evaluation/dto/relative-comparison-query.dto.ts) `28~48 행` — `period`(`@IsString` + `@IsNotEmpty`) · `periodStart`(`@IsString` + `@IsNotEmpty` + `@IsISO8601`).
- [src/user/summary.service.ts](../../src/user/summary.service.ts) — `56 행`(`VALID_PERIODS = ["day", "week", "month"]`), `136~146 행`(`findByCoordinate` 의 2 단 검증), `169~175 행`(`assertValidPeriod` 의 `invalid period: ... (allowed: ...)` 메시지).
- [src/user/summary.repository.ts](../../src/user/summary.repository.ts) `137~145 행` — `where: { period, periodStart }` + `orderBy: { personId: "asc" }`(동점 tie-break 의 결정성 출처).
- [src/assessment-evaluation/summary-relative-comparison-reader.service.ts](../../src/assessment-evaluation/summary-relative-comparison-reader.service.ts) — `54~69 행`(`toEntryScore` 의 number / `toNumber()` / string 분기), `90~110 행`(조회 → 매핑 → 위임 3 단).
- [src/assessment-evaluation/domain/summary-relative-comparison.ts](../../src/assessment-evaluation/domain/summary-relative-comparison.ts) — `169~171 행`(빈 좌표 → `{ cohortSize: 0, mean: 0, byPerson: [] }`), `177 행`(mean 은 소수 6 자리 round), `181~188 행`(내림차순 + order 오름차순 tie-break), `203~210 행`(competition ranking `1,1,3` + percentile = 자신보다 낮은 인원 / cohortSize × 100).
- [prisma/schema.prisma](../../prisma/schema.prisma) `377 행`(`Summary` 의 `@@unique([personId, period, periodStart])` — 좌표당 person 1 행) + `379 행`(`@@index([personId, period, periodStart])`).

## Acceptance Criteria

production 파일 변경 **0 LOC** — 신규 e2e spec [test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts](../../test/e2e/assessment-evaluation-relative-comparison.e2e-spec.ts) **1 파일만** 추가한다(기존 e2e spec 34 개 · `test/helpers/` 무수정, 공용 helper 신설 0 — 지역 helper 는 본 spec 안에서만).

- [ ] 부트스트랩은 `summaries.e2e-spec.ts` `96~120 행` mirror — `createAuthenticatedE2EApp` 으로 User / Admin / SuperAdmin actor 3 종 seed, `afterAll` 에서 `app.close()` + `prisma.$disconnect()`, `afterEach` 는 `truncateAll(prisma)` 만(읽기 route 라 actor 재-seed 불요). Summary seed 는 `prisma.person.create` → `prisma.summary.create` 순의 지역 helper 1 개.
- [ ] **happy + 좌표 격리(분기)** — 좌표 `(week, 2026-01-05T00:00:00.000Z)` 에 `metricScore` `"0.9"` / `"0.5"` / `"0.1"` 3 명을 seed 하고, **잡음 row 2 건**(같은 `week` 의 다른 `periodStart`, 같은 `periodStart` 의 다른 `period`)을 추가로 seed 한 뒤 Admin 쿠키로 조회하면 **200** 이고 `cohortSize` 가 **3**(잡음 2 건 미포함), `mean` 이 **0.5**, `byPerson` 이 점수 내림차순이며 `rank` 가 `[1, 2, 3]` · `percentile` 이 `[66.666667, 33.333333, 0]`, 잡음 row 의 `personId` 가 `byPerson` 에 **미등장**.
- [ ] **happy(Decimal 축)** — 같은 응답에서 `byPerson[].metricScore` 가 전부 `typeof === "number"` 이고 값이 `0.9 / 0.5 / 0.1` 과 정확히 일치(문자열 `"0.9"` · 객체 형태 아님). reader `54~69 행` 의 `toNumber()` 분기가 실 Prisma `Decimal` 로 도는 유일한 경로다.
- [ ] **분기(동점 tie-break)** — 같은 좌표에 `"0.8"` 2 명 + `"0.2"` 1 명을 seed 하면 `rank` 가 **`1, 1, 3`**(competition ranking), 동점 2 명의 `percentile` 이 서로 같은 **33.333333**, 최하위가 **0**, `mean` 이 **0.6** 이고, 동점 2 명의 `byPerson` 내부 순서가 두 `personId` 의 **사전순 오름차순** 과 일치(repository `137~145 행` 의 `orderBy` 가 만드는 결정성 — 기대 순서는 seed 후 두 id 를 비교해 산출).
- [ ] **분기(빈 좌표는 오류가 아님)** — 다른 좌표에 row 가 **존재하는 상태**에서 row 가 없는 좌표를 조회하면 404 가 아니라 **200** 이고 본문이 정확히 `{ cohortSize: 0, mean: 0, byPerson: [] }`(DB 공백이 아니라 좌표 부재임을 잡음 row 로 구분).
- [ ] **error path(허용 literal 밖)** — `period=quarter` 는 **400** 이고 메시지에 `invalid period` 와 허용 집합(`day, week, month`)이 등장(service `169~175 행` 소유), 그리고 이 실패가 `cohortSize` 0 의 200 으로 새지 않는다.
- [ ] **negative `it.each` 4 종(ValidationPipe)** — `period` 누락 / `period` 빈 문자열 / `periodStart` 누락 / `periodStart` 비-ISO(`not-a-date`) 가 각각 **400** 이고 본문에 `Invalid Date` 파생 500 이 아님(응답 status 가 400 임을 각 케이스마다 단언).
- [ ] **negative `it.each` 3 종(guard 선행)** — cookie 부재 **401** / 변조 JWT **401** / User role **403**. 셋 다 200 으로 새지 않고 응답 본문에 `byPerson` · `cohortSize` 키가 등장하지 않는다(권한 미달자에게 타인의 rank·percentile 이 누출되지 않음).
- [ ] **negative(과차단 0)** — SuperAdmin 쿠키로 같은 happy 좌표를 조회하면 **200** 이고 `cohortSize` 가 Admin 결과와 동일(RolesGuard 상위 tier 통과 — Admin+ 가 SuperAdmin 을 막지 않는다).
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 임계 통과(본 task 는 production 0 LOC 라 임계 유지 확인 목적).
- [ ] CI 의 `pnpm test:e2e`(R-113) 에서 본 spec 이 PASS 하고 e2e 합계 suite 수가 직전 대비 **+1**, case 수가 실측 증가(직전 값은 T-1978 머지 후 CI run 로그 기준 `610 total` · suite 36).

## Out of Scope

- `src/`, `web/`, `prisma/`, `.github/workflows/`, `package.json` 변경 — 본 task 는 test 1 파일 신설 전용(production 0 LOC). 조회 route 의 tier 완화(User self-view 변형)나 좌표 축 index 추가는 각각 auth 정책 · DB schema 결정이라 CLAUDE.md §5 게이트 대상.
- 같은 controller 의 다른 route(`POST /evaluate`, `POST /summary`) e2e 신설 — 각각 LLM 왕복 · RunStatus 전이를 끼고 있어 별건이며 본 파일에 섞지 않는다.
- 기존 e2e spec 34 개 수정 · `test/helpers/` 변경(특히 `db-truncate.ts` 의 `TRUNCATE_TABLES` 명단).
- `docs/requirements.md` REQ-036 status · 근거 칸 재판정(PLAN `183 행` once-rule — 구현/계약 slice 머지 **후 1 회만**, 아래 `Follow-ups`).
- `test/perf/` · `test/load/` 신규 slice(PLAN `157~158 행` 오너 게이트 — per-route baseline slice 큐잉 금지).
- 소수점 정밀도(`RELATIVE_COMPARISON_PRECISION` 6 자리) 자체의 재검토 · 비유한수 0 절하 규약 검증 — domain unit spec 이 이미 소유.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견 시 append)

- 후보(planner 예고, 본 task 머지 후 1 회): `docs/requirements.md` `55 행` REQ-036 의 한계 (a) "실 부팅 왕복 e2e 는 0" 자인을 본 spec 좌표로 정정하는 doc-sync 1 회(once-rule).
