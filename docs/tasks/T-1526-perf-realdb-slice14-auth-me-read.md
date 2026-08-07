---
id: T-1526
title: 실 DB round-trip perf-spec slice 14 — AuthController `GET /api/auth/me`(토큰 payload 키 self 조회) p95 실측
phase: P7
status: DONE
prNumber: 1224
completedAt: 2026-08-07T02:54:38Z
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-07
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1525]
touchesFiles:
  - test/perf/auth-me-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 12 개) 을 열세 번째 도메인으로 확장 — 새 축은 토큰 payload 가 조회 키인 self 경로 + JwtAuthGuard 단독(403 구조적 부재) + stale token 404"
---

# T-1526 — 실 DB round-trip slice 14 (AuthController `GET /api/auth/me`)

## Why

[PLAN.md](../PLAN.md) `142 행` (R-92 조회 3초 이내) 의 잔여 절은 실 DB round-trip 실측 범위가
**endpoint 12 개(조회 route 22)** 뿐이고 나머지 read perf-spec **30 개** 는 여전히 service mock +
guard override(배선 latency) 임을 명시한다. slice 1~13 은 그 잔여를 endpoint 도메인 단위로 하나씩
좁혀 왔다(직전 slice 13 = [T-1524](T-1524-perf-realdb-slice13-difficulty-mapping-read.md), 그
doc-sync = [T-1525](T-1525-perf-realdb-slice13-doc-sync.md), main `45089b1e`). 본 task 는 같은 방식으로
**열세 번째 endpoint 도메인** 인 `AuthController` 의 조회 route `GET /api/auth/me` 를 실 Prisma
round-trip 으로 실측해 REQ-048(p95 < 3000ms) 의 실 DB 증거를 1 도메인 더 넓힌다(조회 route 22 → 23).

앞 slice 와 겹치지 않는 **새 구조 축 3 개** 를 고른 결과다:

1. **조회 키가 요청 표면이 아니라 인증 토큰 payload(`req.user.sub`) 에서 나오는 첫 경로** — path param 0 ·
   query 0 이라 요청 표면이 **cookie 뿐** 이고 결과 집합이 **actor 자신 1 row** 로 고정된다. 앞 13 slice 의
   필터 입력은 예외 없이 URL path param 또는 query 였다(slice 8 의 `User` 상세도 path param `:id` 기반).
2. **`JwtAuthGuard` 단독 — `RolesGuard` 미부착으로 403 분기가 구조적으로 부재** — slice 8 은 같은 controller
   안 route 별 guard tier 차이(둘 다 `RolesGuard` 관여), slice 10~13 은 `@Roles("Admin")` guard 레벨 403,
   slice 7 은 guard **0** 이었다. **인증만 있고 인가 0** 인 guard stack 은 본 slice 가 처음이다(401 만 존재).
3. **stale token 404 — 인증 통과 + DB 도달 + principal row 부재 조합의 첫 실측** — 서명이 유효한 토큰인데
   해당 `User` row 가 삭제된 상태에서 `userService.findById(sub)` 가 P2025 → **404** 로 변환된다. slice 10 도
   `findUniqueOrThrow` P2025 404 였지만 그건 **임의 path param id** 의 부재였고, 본 경로는 **actor 자신의
   row 부재** 라 401 이 아니라 404 로 갈리는 지점이 다르다.

부수 축으로 응답이 `UserResponseDto.fromEntity` 를 거쳐 `hashedPassword` 를 차단하는 **단건 sanitize** 다
(slice 11 의 per-row sanitize 는 목록 · row 수 비례 변환이라 성격이 다르다). PK 직행 `findUnique` 자체는
slice 11 과 같으므로 **새 축으로 주장하지 않는다**.

## Required Reading

- [test/perf/user-read-realdb.perf-spec.ts](../../test/perf/user-read-realdb.perf-spec.ts) — slice 8. 실 JWT cookie 발급 + `truncateAll` 후 actor User **원본 id 그대로 재-seed** 패턴의 직접 mirror 원본.
- [test/perf/difficulty-mapping-read-realdb.perf-spec.ts](../../test/perf/difficulty-mapping-read-realdb.perf-spec.ts) — 직전 slice 13. 최신 구조(측정 helper 사용법 · negative 배치) 참조.
- [test/perf/auth-me-read.perf-spec.ts](../../test/perf/auth-me-read.perf-spec.ts) — 같은 route 의 기존 mock 짝 spec. **수정 금지**, 구조 참조만.
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) 의 `@Get("me")` — 측정 대상. `JwtAuthGuard` 단독 · `req.user.sub` 추출 · `UnauthorizedException` 방어선 · `findById` → DTO 변환.
- [src/user/user.service.ts](../../src/user/user.service.ts) 의 `findById` — row 부재 시 `NotFoundException`(P2025 → 404 변환) 경로.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `TRUNCATE_TABLES` 가 `"User"` 를 지운다(수정하지 말 것).
- [test/perf/README.md](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)` 과 `**잔여**` bullet — 본 task 가 갱신할 정본.

## Acceptance Criteria

- [ ] `test/perf/auth-me-read-realdb.perf-spec.ts` 신설 — mock override 0 으로 `AppModule` 을 부트스트랩하고 실 `PrismaService` 로 actor 를 seed 한 뒤 `GET /api/auth/me` 를 실 JWT cookie 로 측정한다(`collectLatencySamples` + `assertS2Threshold`, 임계 `DEFAULT_P95_MAX_MS = 3000` 그대로 사용).
- [ ] **happy-path** 1+ — 인증된 actor 의 self 조회가 200 + 응답 `id`/`email` 이 seed 한 actor 와 일치 + p95 < 3000ms pass.
- [ ] **error path** 1+ — 인증 실패(401) 표본이 성공 표본으로 집계되지 않고 `failures` 로 분류됨을 단언.
- [ ] **분기 cover** 3 — (a) 응답 본문에 `hashedPassword` 키 **부재**(단건 sanitize invariant 직접 증거), (b) role 이 다른 두 actor(User tier · Admin tier) 모두 **403 없이 200** 이고 각자 자기 row 만 반환(축 ② 의 인가 0 증거), (c) **stale token** — 토큰 발급 후 해당 `User` row 를 삭제하면 같은 cookie 로 **404**(401 아님) 이고 그 표본도 p95 측정에서 `failures` 로 분류됨.
- [ ] **negative cases 충분 cover** 4 — (a) Cookie 미부착 401, (b) 서명 변조 토큰 cookie 401, (c) 만료/형식 불량 cookie 값 401(200 아님), (d) path 변형(`GET /api/auth/me/extra`) 404 — 측정 대상 route 가 path param 을 받지 않음의 negative 증거.
- [ ] 정리 규율 — `afterEach` 는 `truncateAll(prisma)` 호출 후 actor User 를 **원본 id 그대로** 재-seed 한다(FK/토큰 sub 정합). `test/helpers/db-truncate.ts` 는 **수정하지 않는다**.
- [ ] 두 표본(예: User tier vs Admin tier actor, 200 vs 404 경로)의 **대소 관계는 단언하지 않는다** — wall-clock 비결정성(slice 3 선례), 관찰 기록만.
- [ ] [test/perf/README.md](../../test/perf/README.md) 에 `- **slice 14** — ...` bullet 추가 + `**잔여**` bullet 계수를 **실검산** 으로 갱신(실측 endpoint 12 → **13**, 조회 route 22 → **23**, perf-spec 47 → **48**, read glob 42 → **43**, 실 DB 13 → **14**(read 12 → **13**), mock 잔존 **30 불변** = `43 − 13`). 계수는 추정이 아니라 실제 `ls test/perf` 결과로 검산할 것.
- [ ] `pnpm test:perf` 가 로컬 실 Postgres(`docker compose up -d postgres` + `DATABASE_URL` + `pnpm prisma migrate deploy`) 전제에서 통과하고, `pnpm lint && pnpm build && pnpm test` 도 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` 변경 0 이므로 coverage 수치가 흔들리지 않음을 확인.

## Out of Scope

- **production code · `prisma/schema.prisma` · 임계값(`DEFAULT_P95_MAX_MS`) 변경 0** — 본 slice 는 측정만 한다.
- `POST /api/auth/login` · `POST /api/auth/logout` 등 write/세션 route 측정 — 본 slice 는 `me` read 만. 필요 시 별도 slice.
- 기존 mock 짝 spec [`auth-me-read.perf-spec.ts`](../../test/perf/auth-me-read.perf-spec.ts) 수정·삭제 — 배선 latency 측정 책임은 그대로 둔다(mock 잔존 30 불변의 근거).
- `test/helpers/db-truncate.ts` 의 `TRUNCATE_TABLES` 명단 변경.
- `writeBaselineFile` / `confirmOrCompareBaseline` 로 baseline 파일 확정 — `buildBaselineReport` 한 줄 관찰 전용 유지(부하계획 §5 item 5 별도).
- `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 · `docs/requirements.md` REQ-048 doc-sync — 본 PR 머지 **후 별도 direct task**(slice 12·13 선례: T-1523 · T-1525). commitMode 혼합 금지(CLAUDE.md §3.1).
- REQ-047 실 scale(100~200명 / 50~100 repo) 부하 검증 — 본 slice 의 seed 는 상대 비교용 소규모 표본이다.
- 파일 2 개 · 300 LOC cap 준수 — spec 이 커지면 test 수를 줄이지 말고 주석을 압축한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

## Result (2026-08-07)

- **DONE** — PR [#1224](https://github.com/myungjoo/Assessment-Agent/pull/1224) round 1 APPROVE → squash 머지 `d5a5a1b8`. CI green, 4-게이트 전량 충족.
- 변경 2 파일 `+298/-2` — `test/perf/auth-me-read-realdb.perf-spec.ts` 신설 + `test/perf/README.md` slice 14 bullet.
- 실 JWT cookie 로 `GET /api/auth/me` self 조회를 `collectLatencySamples` + `assertS2Threshold` 로 측정. test 9 종 (happy 1 · error 1 · 분기 3 · negative 4).
- `afterEach` 는 `truncateAll` 후 actor 를 **원본 id 로 재-seed** 해 stale token test 가 지운 row 를 복원 (`db-truncate.ts` 수정 0).
- 잔여 계수 실검산: perf-spec **48** / read glob **43** / 실 DB **14**(그중 read **13**) / mock 잔존 **30** 불변.
- `pnpm lint && build && test` 전량 통과 (429 suite · 12302 test), `test:cov` line 99.95% · function 100%. `test:perf` 는 CI perf step 이 green 으로 검증.
- doc-sync (PLAN `142 행` · 부하계획 `§ 5` item 5 · REQ-048) 는 Out of Scope 대로 **머지 후 별도 direct task** 로 이월 (slice 12·13 선례 동형).
