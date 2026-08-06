---
id: T-1516
title: 실 DB round-trip perf-spec slice 9 — audience 차등 audit 조회 p95 실측
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 292
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1515]
touchesFiles:
  - test/perf/permission-denied-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 7 개) 에서 split — 여덟 번째 endpoint 도메인 + 첫 src/user 외부 module + audience 차등(거부 대신 결과 축소) + index 후보 2 개 축"
---

# T-1516 — 실 DB round-trip perf-spec slice 9 (audience 차등 audit 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` 의 잔여 절이 "실측 범위가 endpoint **7 개(조회 route 14)** 뿐" 이라고
적고 "남은 endpoint 의 실 DB cutover 는 endpoint 단위 후속 slice 로 이어간다" 를 남겨 뒀다. slice
1~8 (T-1500 · T-1502 · T-1504 · T-1506 · T-1508 · T-1510 · T-1512 · T-1514) 은 `src/user/` module 의
7 controller (person · group · assessment · contribution · summary · part · user) 를 모두 소진했다.
본 task 는 그 잔여를 한 칸 좁혀 **여덟 번째 endpoint 도메인** 인
`PermissionDeniedRecordController` 의 조회 1 route (`GET /api/permission-denied-records`) 를
실 Postgres 위에서 측정한다 ([REQ-048](../requirements.md) 조회 p95 < 3s).

앞 slice 와의 질적 차이는 **구조 축 3 개** 다 — ① **거부 대신 결과 집합 축소 (audience 차등)**:
slice 8 이 403 **거부** 를 처음 실측했다면 본 slice 는 같은 200 응답인데 **actor role 에 따라 결과
집합 자체가 달라지는** 첫 경로다. `PermissionDeniedRecordService.list` 가 Admin+ 이면 곧바로
`repository.findMany` 1 query, non-Admin 이면 `UserInstanceAccess` allowlist 조회 후 findMany 로
**요청당 2 query**, allowlist 공집합이면 **findMany 미호출 (1 query 후 early return)** 이라 —
**actor 에 따라 발화 query 수가 1 / 2 / 1(조기 종료) 로 갈리는 첫 실측** 이다 (slice 7 의 상수
2 query 와도 다르다). ② **index 후보 2 개 + 정렬 축 공유**: `PermissionDeniedRecord` 는
`@@index([instanceRef, createdAt])` 와 `@@index([provider, httpStatus, createdAt])` **둘** 을 두고
`@unique` 는 **0** 인 유일한 실측 대상이라 (slice 4 = composite `@@index` 1 개, 5 = composite unique
prefix, 6 = unique·index 중복 tuple, 7 = 무-index, 8 = 단일 컬럼 unique) optimizer 가 **필터 조합에
따라 두 후보 중 하나를 고르는** 첫 경로이고, `orderBy: { createdAt: "desc" }` 가 **두 index 의 후행
컬럼과 정렬 축을 공유** 하는 점도 처음이다. ③ **다축 query 조합 + `IN` 절**: 필터가 path param 이
아니라 query param 3 축 (`instanceRef` · `provider` · `httpStatus`) 조합이고, non-Admin 경로는
allowlist 를 `instanceRef in [...]` 로 주입해 **`IN` 절 조회를 처음** 잰다.

부수적으로 본 slice 는 **`src/user/` 밖 module 을 처음** 측정하며, 대상이 write 경로가 emitter 인
**append-only audit 테이블** 이라는 점에서도 앞 slice 와 갈린다. slice 1~8 과 마찬가지로
**측정만 하고 production code · schema · 임계값은 건드리지 않는다**.

## Required Reading

- [test/perf/user-read-realdb.perf-spec.ts](../../test/perf/user-read-realdb.perf-spec.ts) —
  **구조 정본**. 헤더 주석 형식 · `createAuthenticatedE2EApp` 2 actor seed · `buildAuthCookie` ·
  변조 cookie · `beforeAll`/`afterEach` 의 `truncateAll` + `reseedAuthenticatedActors` (원본 id
  그대로) · `getRequest`/`measure` · `collectLatencySamples` + `summarizeLatency` +
  `assertS2Threshold` 사용법을 그대로 승계한다. **이 파일은 수정 금지**.
- [src/permission-denied/permission-denied-record.controller.ts](../../src/permission-denied/permission-denied-record.controller.ts)
  `78 행` ~ `120 행` — 측정 대상 route (`@Get()` + `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("User")`), query param 3 축 추출, `parseHttpStatus` 로 비정상값이 **filter 에서 omit**
  되는 규칙.
- [src/permission-denied/permission-denied-record.service.ts](../../src/permission-denied/permission-denied-record.service.ts)
  `159 행` ~ `198 행` (`list`) — audience 차등 분기 4 갈래 (Admin bypass / allowlist 공집합 early
  return / allowlist 밖 `instanceRef` 요청 시 빈 배열 / allowlist 주입 후 findMany).
- [src/permission-denied/permission-denied-record.repository.ts](../../src/permission-denied/permission-denied-record.repository.ts)
  `85 행` ~ `115 행` (`findMany`) — `instanceRef` 와 `instanceRefIn` 의 `AND` 합성 · 부재 키 omit ·
  `orderBy: { createdAt: "desc" }`.
- [prisma/schema.prisma](../../prisma/schema.prisma) `513 행` ~ `525 행` (`PermissionDeniedRecord`,
  `@@index` 2 개 · `@unique` 0) 과 `234 행` ~ `247 행` (`UserInstanceAccess`,
  `@@unique([userId, instanceRef])` + `onDelete: Cascade`). **수정 금지** (schema 변경은
  [CLAUDE.md](../../CLAUDE.md) §5 BLOCKED).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) `43 행` ~ `51 행` —
  `TRUNCATE_TABLES` 에 `"PermissionDeniedRecord"` 는 있고 `"UserInstanceAccess"` 는 **없다**.
  `"User"` 의 `TRUNCATE ... CASCADE` 가 FK 로 binding row 를 함께 지우므로 **본 파일 수정 불요**.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 8** bullet (`581 행`) 과 **잔여** bullet (`596 행`) — 본 task 가 갱신할 정본 위치.

## Acceptance Criteria

- [ ] **AC 1 — spec 신설.** `test/perf/permission-denied-read-realdb.perf-spec.ts` 를 추가한다.
  slice 8 과 동일하게 **mock override 0 · guard override 0** 으로 `createAuthenticatedE2EApp` 이
  `AppModule` 을 실 부트스트랩하고, actor 는 `User` tier 1 명 + `Admin` tier 1 명을 seed 해 실 JWT
  cookie 로만 인증한다. 임계 단언은 `assertS2Threshold` (기본 p95 < 3000ms) 를 쓰고 임계값을
  재정의하지 않는다.
- [ ] **AC 2 — happy-path test 2+.** ① Admin actor 무필터 조회 → 200 + seed 한
  `PermissionDeniedRecord` 전량이 응답에 담기고 (`instanceRef`/`provider`/`httpStatus` 값 일치로
  실 query 발화 입증) p95 < 3000ms, ② `UserInstanceAccess` binding 을 가진 User actor 조회 →
  200 + **binding 된 instance 의 row 만** 담기고 (대조군 instance row 비혼입) p95 < 3000ms.
  응답 개수는 `toHaveBeenCalledTimes` 가 아니라 **body 의 seed 값 대조** 로 검증한다.
- [ ] **AC 3 — 분기 test 3+ (audience 차등 4 갈래 cover).** (a) Admin bypass 경로,
  (b) allowlist **공집합** (binding 0 인 User actor) → 200 + **빈 배열** (findMany 미호출 경로),
  (c) allowlist **밖** `instanceRef` 를 query 로 요청한 User actor → 200 + **빈 배열**,
  (d) allowlist **안** `instanceRef` 를 query 로 요청 → 그 단일 instance 로 좁혀진 결과.
  네 갈래를 각각 별도 `it` 으로 두고 모두 p95 < 3000ms 를 단언한다.
- [ ] **AC 4 — index 후보 2 개 축 cover.** `provider` + `httpStatus` 조합 필터 조회 1+ test 를 두어
  `@@index([provider, httpStatus, createdAt])` 후보를 타는 경로를, `instanceRef` 필터 조회로
  `@@index([instanceRef, createdAt])` 후보를 타는 경로를 각각 측정한다. 두 표본의 **대소 관계는
  단언하지 않는다** (slice 3 선례 — wall-clock 비결정성). 아울러 응답이
  `createdAt desc` **정렬 순서** 를 유지하는지 1 곳에서 확인한다.
- [ ] **AC 5 — error / negative test 4+ (예외 분기마다 1+).** (a) Cookie **부재** → 401
  (`JwtAuthGuard`), (b) **변조 토큰** cookie → 401, (c) `httpStatus` 에 **non-numeric** 값
  (예: `abc`) → `parseHttpStatus` 가 omit 하므로 **필터 없이 200** (400 아님), (d) 어떤 필터에도
  매칭되지 않는 값 (예: 미존재 `provider`) → 200 + **빈 배열**. 401 분기는 DB 미도달이라
  `p95MaxMs: 0` 로 측정 시간 무의존 단언을 쓴다.
- [ ] **AC 6 — 정리 invariant 준수.** `afterEach` 는 `truncateAll` 후 `reseedAuthenticatedActors` 로
  actor 를 **원본 id 그대로** 재-seed 한다 (JWT `sub` 매칭 유지 — 새 id·token 재발급 금지).
  `UserInstanceAccess` binding 은 `"User"` truncate 의 CASCADE 로 함께 지워지므로 각 test 안에서
  필요한 binding 을 seed 한다. `test/helpers/db-truncate.ts` 는 **수정하지 않는다**.
- [ ] **AC 7 — README slice 목록 갱신.** `test/perf/README.md` 의
  `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 9** bullet 을 추가한다 — 파일명 · task ID ·
  조회 1 route · **구조 축 3 개** (거부 대신 결과 집합 축소 = actor 별 query 수 1/2/1 분기 /
  `@@index` 2 개 후보 + 정렬 축 공유 · `@unique` 0 / query param 3 축 조합 + `IN` 절) · 첫
  `src/user/` 외부 module · append-only audit 테이블 · **소규모 표본이라 REQ-047 실 scale 부하가
  아님** 을 적는다. 이어 **잔여** bullet 의 계수를 실측값으로 갱신한다 — endpoint **7 → 8**
  (조회 route **14 → 15**), read glob **37 → 38**, 실 DB read **7 → 8**, 그리고
  **mock 잔존 30 개는 불변** (파일명에 `read` 가 있어 피감수·감수가 함께 +1). 개수는 추정 금지 —
  `ls test/perf/*.perf-spec.ts | wc -l` · `ls test/perf/*read*.perf-spec.ts | wc -l` ·
  `ls test/perf/*realdb*.perf-spec.ts` 실측값만 쓴다.
- [ ] **AC 8 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:perf` 가 모두 green 이어야 한다
  (새 spec 이 실 Postgres 로 통과). 아울러 `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 를 유지함을
  확인한다 (본 task 는 production code 0 LOC 변경이라 coverage 수치가 내려가서는 안 된다).
- [ ] **AC 9 — 크기 상한.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 임을 확인한다. 초과가 예상되면
  test 수를 줄이지 말고 **헤더 주석과 test 내 설명 주석을 축약** 해 맞춘다 (AC 2~5 의 test 종류는
  필수). 그래도 초과하면 진행하지 말고 Follow-ups 에 split 필요를 적고 BLOCKED 로 넘긴다.
- [ ] **AC 10 — 범위 표기 규약.** 본 task 가 새로 추가하는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md)
  §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를 따른다 — 구분자 `~`,
  단일 행은 `98 행`, `L` prefix 금지. 기존 표기의 소급 치환은 금지.

## Out of Scope

- **production code 변경 일체** (`src/`) — 본 task 는 **측정만** 한다. `PermissionDeniedRecord` 에
  index 추가 · audience 차등 분기 리팩터링 · `parseHttpStatus` 동작 변경 모두 금지.
- **`prisma/schema.prisma` · migration 변경** — [CLAUDE.md](../../CLAUDE.md) §5 DB schema 게이트
  (BLOCKED 대상). 필요 판단이 서면 Follow-ups 에만 적는다.
- **`test/helpers/db-truncate.ts` 에 `"UserInstanceAccess"` 추가** — `"User"` CASCADE 로 충분하고,
  추가하면 `db-truncate.spec.ts` 등 drift-guard spec 동반 수정으로 파일 수 상한이 깨진다.
- **앞 slice spec 수정** (`*-realdb.perf-spec.ts` 8 개) 및 `latency-*.ts` primitive 수정 —
  본 task 는 신설 1 파일 + README 만 건드린다.
- **PLAN · 부하계획 `§ 5` · REQ-048 doc-sync** — [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr
  mixed 금지) 에 따라 **머지 후 별도 direct task** 로 이월한다 (T-1501 · T-1503 · T-1505 · T-1507 ·
  T-1509 · T-1511 · T-1513 · T-1515 선례).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 불변, baseline 파일 write 금지
  (`buildBaselineReport` 는 관찰 전용).
- **REQ-047 실 scale 부하 주장** — seed 는 상대 비교용 소규모 표본이다. spec 주석·README 어디에도
  REQ-047 충족으로 읽히는 표현을 쓰지 않는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip** — 잔여 축이 살아 있으므로 금지.
- **regression test 항목** — 본 task 는 patch 가 아니다 (`hqOrigin` 없음).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, slice 1~8 의 확립된 구조 승계).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
