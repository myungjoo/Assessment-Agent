---
id: T-1514
title: 실 DB round-trip perf-spec slice 8 — self-OR-Admin 분기 User 조회 p95 실측
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1513]
touchesFiles:
  - test/perf/user-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 6 개) 에서 split — 일곱 번째 endpoint 도메인 + 403 인가 분기 + route 별 상이 guard tier + 단일컬럼 unique 축"
---

# T-1514 — 실 DB round-trip perf-spec slice 8 (self-OR-Admin 분기 User 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` P7 성능검증 bullet 의 **잔여 ①** 은 "실 DB round-trip 실측 범위가
endpoint **6 개(조회 route 12)** 뿐" 이라고 박제돼 있다 ([T-1513](T-1513-perf-realdb-slice7-doc-sync.md)
가 main `5ae46df3` 으로 동기 완료). 본 task 는 그 잔여를 **일곱 번째 endpoint 도메인**
(`UserController` 조회 2 route) 으로 한 단계 더 좁히는 slice 8 이며, slice 1 ~ 7
([T-1500](T-1500-perf-realdb-person-read-baseline.md) → [T-1502](T-1502-perf-realdb-group-read-njoin.md) →
[T-1504](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md) →
[T-1506](T-1506-perf-realdb-slice4-assessment-authed-read.md) →
[T-1508](T-1508-perf-realdb-slice5-contribution-fanout-read.md) →
[T-1510](T-1510-perf-realdb-slice6-summary-authed-read.md) →
[T-1512](T-1512-perf-realdb-slice7-part-fk-reverse-read.md)) 구조를 그대로 승계한다 (앞 slice 파일 수정 0).

본 slice 가 새로 더하는 구조 축은 3 개다.

1. **403 인가 분기의 첫 실측** — 앞 slice 4 ~ 6 은 guard 통과 / 401 두 상태만 관측했다.
   `GET /api/users/:id` 는 [`user.controller.ts`](../../src/user/user.controller.ts) 의
   `isSelf || isAdminPlus` OR 분기가 controller layer 에서 인가를 판정해, **권한 부족 403** 과
   **존재 부재 404** 가 의미상 분리된 유일한 실측 경로다. 403 은 `service.findById` 호출 0 (DB 미도달)
   이라 **DB 를 타지 않는 거절 경로의 latency** 를 처음 관측한다.
2. **route 별 guard tier 가 서로 다른 유일 controller** — 목록은
   `@UseGuards(JwtAuthGuard, RolesGuard) + @Roles("Admin")` (escalation 강하), 상세는
   `@UseGuards(JwtAuthGuard)` 만 + controller 분기. 같은 controller 안에서 **guard stack 깊이가
   다른 두 route 의 latency** 를 나란히 잰다.
3. **인증 principal 테이블 자체가 측정 대상** — 앞 slice 의 actor `User` row 는 측정 대상 밖의
   부수물이었으나, 본 slice 는 **조회 결과 집합이 곧 actor 가 속한 테이블**이다. 필터 축도 다르다 —
   `User.email` 은 **단일 컬럼 `@unique`** (slice 4 = composite `@@index`, slice 5 = composite unique
   prefix, slice 6 = unique·index 중복 tuple, slice 7 = 무-index) 이고, 목록 조회는 `findAll` 의
   **무필터 전량 SELECT** 다.

REQ-048 (조회 p95 < 3s) 의 실 DB 증거를 한 도메인 더 넓히는 것이 목적이며, REQ-047 의 실 scale 부하
검증은 본 task 범위 밖이다 (소규모 상대 비교 표본).

## Required Reading

- [test/perf/part-read-realdb.perf-spec.ts](../../test/perf/part-read-realdb.perf-spec.ts) — 직전 slice 7 의 파일 구조·주석 규약 (그대로 승계).
- [test/perf/summary-read-realdb.perf-spec.ts](../../test/perf/summary-read-realdb.perf-spec.ts) — 인증 경유 slice 의 actor seed / 재-seed / 401 도달 패턴.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp` (복수 actor 배열 지원) · `buildAuthCookie` · `reseedAuthenticatedActors`.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll` 의 `"User"` 포함 여부와 순서.
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — `@Get()` (Admin+) · `@Get(":id")` (self OR Admin+, 403/404 분기).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` · `assertS2Threshold` 시그니처.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` — slice 7 항목 바로 뒤에 slice 8 항목 추가.

## Acceptance Criteria

- [ ] `test/perf/user-read-realdb.perf-spec.ts` 신설 — mock override 0 / guard override 0 으로 `createAuthenticatedE2EApp([{ role: "User" }, { role: "Admin" }])` 부트스트랩 후 실 `PrismaService` 로 User row 를 seed 하고 `GET /api/users` · `GET /api/users/:id` 를 실측한다.
- [ ] **happy-path** — Admin actor 의 목록 조회 200 + Admin actor 의 타 user 상세 조회 200 각 1+ (`assertS2Threshold` 로 p95 < 3000ms 검증).
- [ ] **분기 cover** — 상세 route 의 세 분기를 각각 1+ test 로 도달: ① `isSelf` (User actor 가 본인 id 조회 200) ② `isAdminPlus` (Admin actor 가 타 user 조회 200) ③ 둘 다 false (User actor 가 타 user 조회 **403**).
- [ ] **error path** — 미존재 id 조회 시 **404** 1+ (403 과 의미 분리됨을 status 로 확인).
- [ ] **negative cases 충분 cover** — 각 1+ test: (a) 목록 route 를 User tier actor 로 호출 시 403 (`RolesGuard` escalation 거절), (b) cookie 부재 401 (목록), (c) 변조 토큰 401 (상세), (d) 응답 body 에 `hashedPassword` 키가 어느 route 에서도 포함되지 않음.
- [ ] 실 query 발화 증거는 mock 의 `toHaveBeenCalledTimes` 대신 **응답 body 가 seed row 값(email / role) 과 일치**함으로 입증한다 (slice 7 규약 승계). 401/403/404 분기 assert 에는 `p95MaxMs: 0` 처럼 측정 시간에 무의존한 형태를 쓴다.
- [ ] `afterEach` 에서 `truncateAll` 후 `reseedAuthenticatedActors` 로 actor User 를 **원본 id 그대로** 재삽입 (JWT `sub` 매칭 유지, 새 token 재발급 금지). `beforeAll` 에도 동일 순서 적용.
- [ ] `afterAll` 에서 `app.close()` + `prisma.$disconnect()` — connection 누수 0.
- [ ] `test/perf/README.md` 의 `## 실 DB round-trip baseline (slice 목록)` 에 **slice 8** 항목을 slice 7 뒤에 추가 — 위 Why 의 구조 축 3 개(403 인가 분기 / route 별 상이 guard tier / principal 테이블 + 단일컬럼 unique) 와 "측정만 한다 · 소규모 표본이라 REQ-047 실 scale 아님" 을 명시.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:perf` 로 신설 spec 이 실 DB 대상 전량 통과 (`jest-perf.json` 매칭이라 기본 `pnpm test` 는 picking 하지 않음을 파일 상단 주석에 박제).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 task 는 production code 0 LOC 이라 coverage 수치 변화 없음을 확인.

## Out of Scope

- production code (`src/**`) 변경 — `UserController` / `UserService` / `UserRepository` / DTO 전부 불변.
- `prisma/schema.prisma` 변경 — `User` 에 index 추가 금지 (무필터 전량 SELECT 를 **있는 그대로** 측정하는 것이 본 slice 의 증거값).
- 기존 mock 짝 perf-spec (`user-read.perf-spec.ts` · `user-detail-read.perf-spec.ts`) 수정·삭제.
- 앞 slice 1 ~ 7 의 `*-realdb.perf-spec.ts` 수정.
- 임계값(p95 3000ms) 조정 · baseline 파일 write (`buildBaselineReport` 는 관찰 전용 유지).
- 대규모 표본 / REQ-047 실 scale 부하 (100~200명) 측정 — 별도 slice.
- `docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신 — 머지 후 별도 direct doc-sync task (§3.1 mixed 금지).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
