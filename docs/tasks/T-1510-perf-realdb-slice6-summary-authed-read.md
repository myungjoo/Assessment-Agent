---
id: T-1510
title: 실 DB round-trip perf-spec slice 6 — 인증 경유 summary 시계열 조회 p95 실측
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1509]
prNumber: 1216
touchesFiles:
  - test/perf/summary-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 4 개) 에서 split — 다섯 번째 endpoint 도메인 + 동일 tuple @@unique·@@index 중복 + long-text payload 축"
---

# T-1510 — 실 DB round-trip perf-spec slice 6 (인증 경유 summary 시계열 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` P7 성능검증 bullet 의 **잔여 ①** 은 "실 DB round-trip 실측 범위가
endpoint **4 개(조회 route 8)** 뿐" 이라고 박제돼 있다 ([T-1509](T-1509-perf-realdb-slice5-doc-sync.md)
가 main `f6148872` 로 동기 완료). 본 task 는 그 잔여를 **다섯 번째 endpoint 도메인**
(`SummaryController` 조회 2 route) 으로 한 단계 더 좁히는 slice 6 이며,
[T-1500](T-1500-perf-realdb-person-read-baseline.md) → [T-1502](T-1502-perf-realdb-group-read-njoin.md)
→ [T-1504](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md) →
[T-1506](T-1506-perf-realdb-slice4-assessment-authed-read.md) →
[T-1508](T-1508-perf-realdb-slice5-contribution-fanout-read.md) 로 이어진 실 DB baseline 축의 연속이다.

slice 6 의 질적 차이는 endpoint 개수 증가에 더해 **조회 구조 축 2 개** 다. ① `Summary` 는
`@@unique([personId, period, periodStart])` 와 `@@index([personId, period, periodStart])` 가 **완전히
같은 tuple 로 중복 정의된 유일한 entity** 다 (slice 4 의 `Assessment` 는 unique 가 `scope` 를 포함한
4 컬럼이라 index tuple 과 다르고, slice 5 의 `Contribution` 은 unique 만 있고 명시 index 가 없다) —
optimizer 가 어느 index 를 타든 REQ-048 임계가 성립하는지의 첫 증거다. ② `narrative` 가 서술형
long text 라 응답 payload 가 앞 slice 보다 크다 — **payload 크기 축** 의 첫 관측 지점이다.

본 task 는 **측정만** 한다. production code · 기존 mock perf-spec · 임계값 · baseline write 는
불변이고, PLAN · 부하계획 · REQ-048 문서 갱신은 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3
(direct·pr mixed 금지) 에 따라 **머지 후 별도 direct doc-sync task** 로 이월한다.

## Required Reading

- [test/perf/contribution-read-realdb.perf-spec.ts](../../test/perf/contribution-read-realdb.perf-spec.ts)
  — slice 5 원형. 부트스트랩 · seed · `afterEach` truncate 후 actor 재-seed · 측정/분기 test 배치를
  그대로 승계한다 (**이 파일 자체는 수정 금지**).
- [test/perf/README.md](../../test/perf/README.md) `508 행` 이후 `## 실 DB round-trip baseline (slice 목록)`
  절 — slice 6 항목과 잔여 bullet 을 갱신할 정본 위치.
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) — `@Controller("api/summaries")`
  의 `@Get()` `findByPerson(personId?, period?)` · `@Get(":id")` `findOne`. 둘 다
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`. `personId` 미지정/빈 문자열이면
  controller 가 `BadRequestException` (400).
- [src/user/summary.repository.ts](../../src/user/summary.repository.ts) — `findByPerson` 의
  `where` 2 분기 (period 지정 시 2 컬럼 / 미지정 시 leftmost prefix) 와 정렬
  `orderBy: { periodStart: "desc" }` (시계열 최신순 — 응답 순서 검증의 근거).
- [src/user/summary.service.ts](../../src/user/summary.service.ts) `56 행` `VALID_PERIODS`
  (`"day"` / `"week"` / `"month"`) — 허용 밖 period 는 400.
- `prisma/schema.prisma` 의 `model Summary` — `@@unique` · `@@index` 동일 tuple, `metricScore Decimal`,
  `narrative String`, `person` FK cascade.
- 공용 helper (이미 존재, 신규 helper 작성 금지): [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts)
  (`createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors`) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) (`truncateAll`) ·
  [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts)
  (`collectLatencySamples` · `assertS2Threshold`) ·
  [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) (`summarizeLatency`).

## Acceptance Criteria

- [ ] `test/perf/summary-read-realdb.perf-spec.ts` 를 신설한다. **mock override 0 · guard override 0**
      — `createAuthenticatedE2EApp` 으로 AppModule 을 실 부트스트랩하고 실 JWT 쿠키로
      `JwtAuthGuard` + `RolesGuard`(`@Roles("User")`) 를 통과한다. seed 는 `moduleRef` 의 실
      `PrismaService` 로 `Person → Summary`(여러 `period` × `periodStart` row) 를 넣고,
      `periodStart` 를 row 마다 명시해 `orderBy: { periodStart: "desc" }` 정렬 결정론을 확보한다.
- [ ] **happy-path 2** — `GET /api/summaries?personId=<seed>` (다중 row 시계열) 와
      `GET /api/summaries/:id` (단일 상세) 각각을 반복 측정해 `assertS2Threshold` 로 p95
      **< 3000ms** 를 검증한다. 두 test 모두 응답 body 가 seed row 값(`narrative` · `period` ·
      `periodStart` 순서)과 일치함을 함께 단언해 **실 query 발화**를 입증한다 (mock spec 의
      `toHaveBeenCalledTimes` 등가 검증).
- [ ] **분기 cover 3** — ① `period` 지정 (`where: { personId, period }` 2 컬럼 경로) ② `period`
      미지정 (leftmost prefix 경로 — 전체 period row 반환) ③ 매칭 row 0 인 `personId` 로 조회 시
      빈 배열 `[]` 정상 반환 (404 아님). 각 분기 1+ test.
- [ ] **error path 1** — 존재하지 않는 `id` 로 `GET /api/summaries/:id` → **404**.
- [ ] **negative cases 충분 cover 4** — ① `personId` query 누락 → **400** ② `VALID_PERIODS` 밖
      period (예: `"year"`) → **400** ③ 인증 쿠키 없음 → **401** ④ 변조/무효 토큰 쿠키 → **401**.
      fail 분기 측정은 `p95MaxMs: 0` 등 측정 시간 무의존 형태로 두어 flaky 를 만들지 않는다.
- [ ] `afterEach` 의 `truncateAll` 이 인증 주체 `User` 를 지우므로 actor 를 **원본 id 그대로**
      재-seed 한다 (slice 4·5 승계 — 새 id 발급·token 재발급 금지).
- [ ] `test/perf/README.md` 의 `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 6** 항목을
      추가하고 잔여 bullet 의 계수를 실측값으로 갱신한다 — 실측 endpoint **4 → 5 개(조회 route 8 → 10)**,
      read 계열 glob **34 → 35**, 실 DB read **4 → 5**, 따라서 **mock 잔존 30 개는 불변**(피감수와
      감수가 함께 1 씩 증가). 완료 선언·임계 fix 문구는 넣지 않는다.
- [ ] `pnpm lint` · `pnpm build` · `pnpm test:cov` 가 green (**line ≥ 80% / function ≥ 80%**).
      production code 변경 0 이라 회귀가 없음을 결과에 명시한다. 로컬 Postgres 부재 시
      `pnpm test:perf` 는 CI `perf test` step 이 검증하며, PR CI green 을 4-게이트 판정에 사용한다.
- [ ] 총 diff **≤ 300 LOC / 2 파일** (§3 cap). 파일 머리 설명 주석은 slice 5 대비 **축약** 해
      cap 여유를 확보한다.

## Out of Scope

- `docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신 — §3.1 rule 3
  (mixed 금지) 에 따라 **머지 후 별도 direct doc-sync task** 로 이월.
- production code (`src/**`) 변경 일체 — N+1 / index / 직렬화 최적화 포함.
- 앞 slice 의 `*-realdb.perf-spec.ts` 5 개 및 기존 mock perf-spec 수정.
- write route (`POST` / `DELETE /api/summaries`) 측정, 임계값 변경, baseline 파일 write 확정.
- 규모 민감도 (소·대 표본 대소 관계) **assert** — 필요하면 관찰 한 줄만, 대소 단언은 flaky 회피를 위해 금지.
- 신규 test helper 추출 · 신규 dependency 추가.

## Suggested Sub-agents

`implementer → tester` (새 아키텍처 결정 없음 — architect 불요).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-06T03:54Z DONE)

- pr-mode. PR [#1216](https://github.com/myungjoo/Assessment-Agent/pull/1216) squash merge `403a1240` (main).
  2 파일 +297/-2, production code 변경 0 LOC.
- `test/perf/summary-read-realdb.perf-spec.ts` 신설 (284 행 / 10 test) — 실 `PrismaService`
  경유 `SummaryController` 조회 2 route (목록 `GET /api/summaries?personId`, 상세 `GET /api/summaries/:id`)
  의 p95 를 mock·guard override 0 으로 실측. `Person → Summary` 시계열 seed (week 4 + month 2,
  `periodStart` 명시) 로 `@@unique([personId, period, periodStart])` 와 동일 tuple `@@index` 가
  **중복 정의된 유일 entity** 축 + `narrative` long-text payload 축을 처음 관측.
- R-112 cover 10 test: happy 2 (시계열 목록 · 상세) · 분기 3 (period 지정 · 미지정 · 매칭 0 빈 배열) ·
  error 1 (미존재 :id → 404) · negative 4 (personId 누락 400 · period=year 400 · cookie 부재 401 ·
  변조 토큰 401).
- `afterEach` truncate 후 actor User 를 **원본 id 로 재-seed** (slice 5 승계 — FK 재사용 함정 차단).
- 4-게이트 PASS: reviewer VERDICT=APPROVE round 1/7 (PR comment 외부 박제) · integrator 자체 점검 ·
  CI green (unit · smoke · e2e · perf).
- 실측 검산(driver 재확인): `test/perf/*.perf-spec.ts` **40 개** · `*read*` **35 개** ·
  `*read-realdb*` **5 개** · `summary-read-realdb.perf-spec.ts` **10 test**.
- 문서 반영(PLAN `142 행` · 부하계획 `§ 5` item 5 · REQ-048)은 Out of Scope — direct doc-sync
  [T-1511](T-1511-perf-realdb-slice6-doc-sync.md) 로 이월.
