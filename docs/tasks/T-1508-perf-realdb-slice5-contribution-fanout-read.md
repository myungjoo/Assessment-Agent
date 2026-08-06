---
id: T-1508
title: 실 DB round-trip perf-spec slice 5 — 인증 경유 `GET /api/contributions` 부모→자식 fan-out 조회 p95 실측
phase: P7
status: DONE
prNumber: 1215
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1507]
touchesFiles:
  - test/perf/contribution-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ① (실측 endpoint 3 개뿐) 해소 — slice 5 는 네 번째 endpoint 도메인 + unique-index prefix FK fan-out 실 DB 측정"
---

# T-1508 — 실 DB round-trip perf-spec slice 5 (인증 경유 contribution fan-out 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` P7 성능검증 bullet 의 잔여 ① 은 **실 DB round-trip 실측 범위가
endpoint 3 개(조회 route 6)뿐이고 나머지 read perf-spec 30 개는 여전히 service mock + guard
override(배선 latency)** 라는 것이다. slice 1 [`person-read-realdb`](../../test/perf/person-read-realdb.perf-spec.ts)(T-1500) ·
slice 2 [`group-read-realdb`](../../test/perf/group-read-realdb.perf-spec.ts)(T-1502) ·
slice 3 [`group-persons-scale-realdb`](../../test/perf/group-persons-scale-realdb.perf-spec.ts)(T-1504) ·
slice 4 [`assessment-read-realdb`](../../test/perf/assessment-read-realdb.perf-spec.ts)(T-1506, main
`861add36`) 가 그 잔여를 endpoint 단위로 좁혀 왔고, 본 task 는 그 **slice 5** 로 **네 번째 endpoint
도메인** 인 `ContributionController` 조회 2 route 를 실 Postgres 위에서 측정한다.

slice 4 대비 새 축은 **조회 구조** 다 — `ContributionRepository.findByAssessment` 는 부모
(`Assessment`) 의 id 로 자식 row 를 긁는 **FK fan-out** 이고, 그 필터는 slice 4 처럼 명시
`@@index` 가 아니라 **`@@unique([assessmentId, sourceRef])` composite unique index 의 prefix** 를
탄다(schema `348 행`). 또한 seed 가 `Person → Assessment → Contribution` **3-level FK chain** 이라
앞 slice(2-level)보다 한 단계 깊다. 즉 REQ-048 임계(p95 < 3000ms)가 "부모 필터로 자식 다중 row 를
정렬해 돌려주는" 경로에서도 성립하는지의 첫 증거다.

본 task 는 [T-1506](T-1506-perf-realdb-slice4-assessment-authed-read.md) 과 동일하게 **측정만**
한다 — production code 변경 0, mock 짝(`contribution-read.perf-spec.ts` ·
`contribution-detail-read.perf-spec.ts`) 불변, 문서 정합(PLAN · 부하계획 · REQ-048) 은
[CLAUDE.md](../../CLAUDE.md) §3.1 rule 3(direct·pr 혼합 금지)에 따라 **머지 후 별도 direct task**.

## Required Reading

- [test/perf/assessment-read-realdb.perf-spec.ts](../../test/perf/assessment-read-realdb.perf-spec.ts) —
  **직접 승계할 골격**. 헤더 주석 4 절 구조 · `createAuthenticatedE2EApp([{ role: "User" }])` ·
  `buildAuthCookie` · `beforeAll` 선-`truncateAll` + `reseedAuthenticatedActors` · `afterEach`
  truncate→재-seed · `afterAll` `app.close()` + `$disconnect()` · `getRequest(path, authed)` 헬퍼 ·
  `assertS2Threshold` / `summarizeLatency` 사용법을 그대로 따른다. **이 파일은 수정하지 않는다.**
- [src/user/contribution.controller.ts](../../src/user/contribution.controller.ts) `95 행` ~ `118 행` —
  측정 대상 2 route. `@Get()` `findByAssessment` 는 `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("User")` 이며 **`assessmentId` 가 `undefined` 또는 빈 string 이면 controller 자체가
  `BadRequestException`(400)**. `@Get(":id")` `findOne` 은 service 가 `NotFoundException`(404).
- [src/user/contribution.repository.ts](../../src/user/contribution.repository.ts) `90 행` ~ `103 행` —
  `findMany({ where: { assessmentId }, orderBy: { createdAt: "asc" } })`. 매칭 0 이면 **빈 배열**
  (404 아님). 정렬이 `createdAt` 오름차순이라는 사실이 아래 AC 8 의 seed 함정 근거다.
- [src/user/contribution.service.ts](../../src/user/contribution.service.ts) `95 행` ~ `111 행` —
  `findById` 의 null → 404 변환, `findByAssessment` 의 pass-through(존재 검증 없음).
- [prisma/schema.prisma](../../prisma/schema.prisma) `329 행` ~ `349 행` — `Contribution` 필드
  (`sourceType` · `sourceUrl` · `sourceRef` · `difficulty` · `contributionScore` **Decimal** ·
  `volume` · `createdAt`) + `@@unique([assessmentId, sourceRef])` + `onDelete: Cascade`.
- [src/user/contribution.service.ts](../../src/user/contribution.service.ts) `50 행` ~ `51 행` —
  `VALID_SOURCE_TYPES = ["commit", "pr", "document"]` · `VALID_DIFFICULTIES = ["easy", "medium",
  "hard"]`. seed 는 이 허용 집합 안의 값만 쓴다(직접 Prisma seed 라 검증은 안 타지만 문서 정합용).
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절
  (`508 행` 부터) — slice 5 항목을 추가할 위치와 갱신할 `**잔여**` bullet(`550 행` 부근).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` ·
  `assertS2Threshold`(`p95MaxMs` 기본 3000, `errorRate` 사유) 시그니처. **수정 금지**.

## Acceptance Criteria

- [ ] **AC 1 — 신규 spec 파일 1 개.** `test/perf/contribution-read-realdb.perf-spec.ts` 를 신설한다.
  헤더 주석에 ① 본 파일이 **slice 5** 이며 앞 slice 대비 새 축이 **부모→자식 FK fan-out
  (`@@unique([assessmentId, sourceRef])` prefix 를 타는 필터) + 3-level FK chain seed** 라는 것,
  ② `.perf-spec.ts` 라 기본 `pnpm test`(`.spec.ts$`)에는 **picking 되지 않고** `pnpm test:perf` 로만
  실행된다는 것, ③ **service mock 0 · guard override 0**(실 `JwtAuthGuard`/`RolesGuard` 를 실 JWT 로
  통과) 을 명시한다. `jest.setTimeout` 은 slice 4 와 동등 이상으로 둔다.
- [ ] **AC 2 — happy-path test 1+ (fan-out 목록).** `GET /api/contributions?assessmentId=<seed>` 를
  반복 측정한다. 응답이 **200** 이고 body 배열 길이가 seed 한 자식 row 수와 같으며 `sourceRef` 값이
  seed 값과 일치함으로 실 query 발화를 입증하고(mock spec 의 `toHaveBeenCalledTimes` 등가),
  `assertS2Threshold(...).pass` 가 **true**(p95 < 3000ms) 임을 확인한다.
- [ ] **AC 3 — happy-path test 1+ (상세).** `GET /api/contributions/:id` 를 seed 한 실 row id 로 반복
  측정해 **200** + body 의 `id` · `sourceType` · `sourceRef` 일치 + p95 pass 를 확인한다.
  `contributionScore` 는 Prisma `Decimal` 이라 JSON 직렬화 형태가 number 가 아닐 수 있으므로
  **직렬화 형태를 assert 로 못박지 않는다**(문자열화 후 비교하거나 다른 컬럼으로 검증).
- [ ] **AC 4 — 분기 cover (각 1+ test).** `findByAssessment` 의 분기를 각각 별도 test 로 분리한다 —
  ① **FK 격리**: Assessment 를 2 개 seed 하고 각각에 자식을 붙인 뒤, 한쪽 id 로 조회하면 **다른
  Assessment 의 자식이 섞이지 않음**(길이 + `assessmentId` 전부 일치)을 확인, ② **매칭 0**: 자식이
  없는 Assessment id(또는 미존재 id)로 조회 → **404 가 아니라 200 + 빈 배열**, ③ **정렬**: 응답이
  `createdAt` **오름차순** 이며 seed 순서와 일치(AC 8 의 명시 `createdAt` seed 덕에 결정론적).
  세 분기 모두 `summarizeLatency` 의 `count` 가 요청 수와 같음을 확인한다.
- [ ] **AC 5 — error path test 1+.** `GET /api/contributions/:id` 에 **미존재 id** 를 주면 실 DB row
  부재로 **404** 가 나고, 그 표본의 `assertS2Threshold(...).pass === false`(errorRate 위반) +
  `reasons` 에 error 사유가 포함됨을 확인한다. 실 측정 시간에 의존하지 않는 결정론적 fail 분기다.
- [ ] **AC 6 — negative cases 충분 cover (각 1+ test).** 아래 4 종을 **각각 별도 test** 로 박제한다 —
  (a) **`assessmentId` query 누락**(`GET /api/contributions` 만) → controller 자체 분기의 **400**,
  (b) **빈 string**(`?assessmentId=`) → 같은 분기의 다른 입력으로 **400**(`undefined` 와 별개 조건),
  (c) **인증 없음**(Cookie header 미부착) → `JwtAuthGuard` **401** — guard 가 실제로 살아 있음의
  증거, (d) 실측이 아무리 빨라도 **비현실적 임계**(`p95MaxMs: 0`)를 주면 `pass === false` + p95 사유.
  200 / 4xx 가 섞인 표본에서 `errorRate` 가 `0 < er < 1` 로 산출되는 것도 위 어느 test 에서 1 회
  확인한다.
- [ ] **AC 7 — 인증 주체 FK 재-seed (slice 4 승계 함정).** `truncateAll` 의 대상 테이블에 `"User"` 가
  포함돼 `afterEach` 이후 JWT 의 `sub` 가 가리키는 actor row 가 사라진다. `beforeAll` · `afterEach`
  모두 **`truncateAll(prisma)` → `reseedAuthenticatedActors(ctx)`** 순서로 실행해 **원본 id 그대로**
  재삽입하고(새 id 생성·token 재발급 금지), 이 사유를 주석 1 줄로 남긴다.
- [ ] **AC 8 — seed 함정 3 종 (본 slice 고유).** ① `@@unique([assessmentId, sourceRef])` 충돌(P2002)
  회피 — 같은 Assessment 안의 자식은 `sourceRef` 를 row 마다 다르게 준다, ② 정렬 결정론 —
  `createMany` 는 `createdAt` 기본값이 동일 순간으로 몰려 `orderBy asc` 순서가 비결정적이 될 수
  있으므로 **`createdAt` 을 row 마다 명시적으로 다른 값** 으로 seed 한다, ③ **3-level FK chain** —
  `Person` → `Assessment`(`@@unique([personId, period, scope, periodStart])` 회피) → `Contribution`
  순서로 만들고 상위 row 없이 자식을 만들지 않는다(P2003).
- [ ] **AC 9 — 생명주기 · 격리.** `beforeAll` 에서 선-`truncateAll` 로 앞 스위트 잔여 row 를
  배제하고, `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 connection 누수 0. seed 규모
  상수(자식 row 수 · 반복 횟수)는 파일 상단에 모아 이름 붙인다.
- [ ] **AC 10 — 문서 갱신.** [test/perf/README.md](../../test/perf/README.md) 의
  `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 5 항목** 을 추가한다 — ① 본 spec 의 위치와
  측정 route 2 개, ② 앞 slice 와의 차이 = **부모→자식 FK fan-out + unique-index prefix 필터 +
  3-level FK chain seed**, ③ 측정만 하며 production code · mock 짝은 불변. 기존 `**잔여**` bullet 의
  endpoint 개수 서술을 **3 개 → 4 개(조회 route 6 → 8)** 로 갱신하되 **임계값 3000ms 불변** ·
  **baseline 미확정** · **다른 endpoint 규모 민감도 미측정** · **REQ-047 실 scale 부하 미검증**
  서술은 그대로 유지한다.
- [ ] **AC 11 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:cov`(line ≥ 80% / function
  ≥ 80% — production code 변경 0 이므로 수치 하락 0 이어야 한다) · `pnpm test:perf` 전부 green.
  로컬에 Postgres 가 없으면 `docker compose up -d postgres` + `DATABASE_URL` export +
  `pnpm prisma migrate deploy` 후 실행하고, 그래도 로컬 DB 확보가 불가한 경우에만 CI 의
  `perf test` step green 으로 대체 검증하며 그 사실을 PR 본문에 명시한다.
- [ ] **AC 12 — cap 준수.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 안임을 확인한다. 분량이 cap 을
  위협하면 반복 횟수·seed 규모 상수를 상단에 모으고 request 헬퍼를 공유해 중복을 줄이되, R-112 항목
  (AC 2 · 3 · 4 · 5 · 6) 은 **삭제하지 않는다**. 그래도 초과하면 AC 3(상세 route) 을 후속 slice 로
  떼어내고 Follow-ups 에 적는다.

## Out of Scope

- **production code 변경 일체**(`src/`) — 본 task 는 `test/` 만 건드리는 측정 slice 다. fan-out 조회가
  느리더라도 index 추가·query 최적화는 하지 않고 Follow-ups 에만 적는다.
- **mock 짝 spec 수정·삭제**(`contribution-read.perf-spec.ts` · `contribution-detail-read.perf-spec.ts`)
  — 배선 latency 측정 축은 그대로 둔다(대체가 아니라 보완).
- **앞 slice spec 4 개 수정**(`person-read-realdb` · `group-read-realdb` ·
  `group-persons-scale-realdb` · `assessment-read-realdb`) — 참조만 한다.
- **PLAN · 부하계획 `§ 5` item 5 · REQ-048 문서 갱신** — direct·pr 혼합 금지(§3.1 rule 3)로 **머지 후
  별도 direct doc-sync task**. 본 task 가 갱신하는 문서는 `test/perf/README.md` 하나뿐이다.
- **write route**(`POST` / `DELETE /api/contributions`) 측정 — 본 slice 는 조회 2 route 한정.
- **규모 민감도 축**(자식 row 수 소·대규모 두 표본 비교) — slice 3 이 `:id/persons` 한 route 에서 한
  방식이며, contribution fan-out 의 규모 축은 별도 후속 slice.
- **임계값 변경 · baseline 파일 write** — `DEFAULT_P95_MAX_MS = 3000`(REQ-048) 불변,
  `writeBaselineFile` / `confirmOrCompareBaseline` 미사용(관찰 한 줄만).
- **CI workflow 편집** — `jest-perf.json` 의 `testRegex` 가 새 spec 을 자동 picking 하므로 불요.
- **REQ-047(실 scale 배치 부하) 충족 주장** — 본 seed 는 상대 비교용 소규모 표본이다. 문서에 그렇게
  읽힐 표현을 쓰지 않는다.
- **새 dependency 추가 · ADR-0054 status flip** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, 기존 slice 4 골격 승계).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-05T21:58Z DONE)

- PR [#1215](https://github.com/myungjoo/Assessment-Agent/pull/1215) round 1 reviewer APPROVE →
  4-게이트 충족 후 squash 머지. main `b15ffb0e`.
- `test/perf/contribution-read-realdb.perf-spec.ts` 신설 + `test/perf/README.md` slice 목록 갱신,
  2 파일 +299/-1, production code 0 LOC.
- test 구성: happy 2 / 분기 3 / error 1 / negative 4. seed 는 Person → Assessment 3 개 →
  Contribution 3-level FK chain, `sourceRef` · `createdAt` 을 row 마다 명시해 정렬 결정론 확보.
- `afterEach` truncate 가 인증 주체 `User` 를 지우므로 actor 를 원본 id 그대로 재-seed (slice 4 승계).
- 로컬 Docker · Postgres 부재로 `test:perf` 는 CI `perf test` step 이 검증 (PR CI green).
  로컬에서는 `pnpm lint` · `pnpm build` · `pnpm test:cov` (429 suite / 12302 test) green.
