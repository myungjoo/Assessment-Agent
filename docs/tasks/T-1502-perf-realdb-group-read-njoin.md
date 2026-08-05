---
id: T-1502
title: 실 DB round-trip perf-spec slice 2 — `GET /api/groups` + `:id/persons` (N+1 indirect navigation) p95 실측
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-08-05
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1500]
touchesFiles:
  - test/perf/group-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 P7 성능검증 잔여(read perf-spec 30 개 mock 잔존) 해소 slice 2 — T-1500 Follow-up 2 의 endpoint 확대 첫 건"
---

# T-1502 — 실 DB round-trip perf-spec slice 2 (`GET /api/groups` · `:id/persons`)

## Why

[PLAN.md](../PLAN.md) `142 행` 의 REQ-048 sub-bullet 이 checkbox `[ ]` 를 유지하는 잔여 사유 중
첫 항목은 **"실측 범위가 endpoint 1 개 뿐이고 나머지 read perf-spec 30 개 는 여전히 service mock +
guard override (배선 latency)"** 다. 직전 T-1500 (PR #1211, main `0395c51e`) 이 실 DB round-trip
perf-spec 의 첫 사례를 박제했고, 그 `## Follow-ups` 2 번이 **"나머지 mock perf-spec 실 DB cutover
확대 — endpoint 단위로 쪼개 cap 준수"** 를 명시 이월했다. 본 task 가 그 이월분의 **slice 2** 다.

두 번째 대상으로 `GroupController` 를 잡는 이유는 단순 목록 read 하나만 늘리는 것이 아니라
**질적으로 다른 query 형태를 실측** 하기 때문이다 — `GET /api/groups/:id/persons` 는
[group.service.ts](../../src/user/group.service.ts) 의 `findPersonsByGroupId` 가
`PersonGroupMembership` 중간 테이블을 거쳐 `personId[]` 를 뽑은 뒤 `PersonRepository.findById` 를
loop 호출하는 **N+1 indirect navigation** 경로다 (service 헤더 주석이 "N+1 query 의 P0 acceptable
패턴" 으로 자인). T-1500 이 실측한 flat 단일 SELECT 목록과 달리, 본 slice 는 **row 수에 비례해
query 가 늘어나는 경로가 REQ-048 의 p95 < 3000ms 를 실 Postgres 위에서 충족하는지** 를 처음으로
증거화한다. `GroupController` 는 `@UseGuards` / `@Roles` 미부착이라 인증·인가 노이즈 0 이고,
production code 변경 · schema migration · 새 dependency 가 **전부 0** 이라
[CLAUDE.md](../../CLAUDE.md) §5 게이트에 걸리지 않는다.

**성능 개선은 하지 않는다** — N+1 을 batch query 로 고치는 것은 production code 변경이라 본 slice
범위 밖이다. 본 task 는 오직 **측정** 이며, 만약 실측이 임계를 위협하면 그 사실을 Follow-ups 에
남겨 후속 결정에 넘긴다.

## Required Reading

- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts)
  (275 행) — T-1500 이 박제한 **실 DB perf-spec 의 정본 형태**. 헤더 주석 구성 · `createE2EApp()`
  부트스트랩 · `moduleRef.get(PrismaService)` · `afterEach(truncateAll)` · `afterAll(app.close +
  prisma.$disconnect)` · `buildBaselineReport` 관찰 블록을 그대로 승계한다. 본 spec 은 그 파일의
  **문구를 복제하지 말고** 구조만 따르며, 헤더에서 cross-ref 한다.
- [test/perf/group-read.perf-spec.ts](../../test/perf/group-read.perf-spec.ts) (220 행) — 본 spec 의
  **mock 짝**. 측정 대상 route 선택 근거 (`findAll` 주 measure + `findById` 404 로 fail 분기 도달)
  와 "guard 미부착 controller 라 `overrideGuard` 불요" 서술이 그대로 유효하다. 이 파일은
  **수정하지 않는다**.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) `92 행` ~ `112 행` —
  `@Get()` (목록) · `@Get(":id")` (404 분기) · `@Get(":id/persons")` (membership 조인) 3 route 계약.
  특히 `:id/persons` 주석의 "Group 부재 → 404 / membership 0 → 200 + 빈 배열" 2 분기.
- [src/user/group.service.ts](../../src/user/group.service.ts) — `findPersonsByGroupId` 의 N+1
  indirect navigation 서술 (헤더 주석 `15 행` ~ `20 행`, `40 행` ~ `41 행`). 본 task 의 측정 가치
  근거이자 seed 설계 (membership 수 = query 수) 의 입력.
- [prisma/schema.prisma](../../prisma/schema.prisma) `55 행` ~ `77 행` (Person — `email` `@unique`,
  `partId` nullable), `97 행` ~ `105 행` (Group — `name` `@unique` **없음**), `131 행` ~ `141 행`
  (PersonGroupMembership — `@@unique([personId, groupId])` · 양측 `onDelete: Cascade`). seed 시
  email 충돌 (P2002) 회피와 membership 중복 회피에 필요.
- [test/e2e/groups.e2e-spec.ts](../../test/e2e/groups.e2e-spec.ts) `197 행` ~ `250 행` — 실 DB seed
  선례 (`prisma.group.create` → `prisma.person.create` → `prisma.personGroupMembership.create`) 와
  `GET /api/groups/:id/persons` 응답 shape 확인용.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` ·
  `assertS2Threshold` · `RequestFn` · `DEFAULT_P95_MAX_MS = 3000` 계약.
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) — `buildBaselineReport` ·
  `formatBaselineLine` (관찰 전용, 파일 I/O 없음).
- [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) — `summarizeLatency` (`count` ·
  `p95` 필드).
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createE2EApp()` 반환 shape 와
  `truncateAll(prisma)` 계약.
- [test/perf/README.md](../../test/perf/README.md) `509 행` ~ `531 행` (`## 실 DB round-trip baseline
  (첫 slice)`) — 본 task 가 갱신할 절.

## Acceptance Criteria

- [ ] **AC 1 — 실 DB perf-spec 신설.** `test/perf/group-read-realdb.perf-spec.ts` 를 추가한다.
  `createE2EApp()` 로 **mock override 0** 부트스트랩 (`GroupService` · `PersonService` ·
  `PrismaService` 어느 것도 `useValue` 로 대체하지 않는다) 후 `moduleRef.get(PrismaService)` 로 실
  client 를 얻어 seed 한다. 헤더 주석 (한국어) 에 ① 본 spec 이 실 DB round-trip **slice 2** 라는
  위치, ② mock 짝 `group-read.perf-spec.ts` 와의 책임 경계, ③ T-1500 (`person-read-realdb`) 과의
  차이 = **N+1 indirect navigation 경로 측정**, ④ 결정론 전략, ⑤ Out of Scope 를 명시한다.
- [ ] **AC 2 — happy path (목록 read p95 판정).** `prisma.group.create` 로 Group 을 **다건 seed**
  (예: 15 행) 한 뒤 `collectLatencySamples` 로 `GET /api/groups` 를 반복 측정 (예: 20 회) 한다.
  전 요청 status 200 · 응답 배열 길이 = seed 수 를 검증하고, 응답 body 의 `name` 집합이 seed 한
  값과 일치함으로 **실 Prisma query 발화** 를 입증한 뒤 `assertS2Threshold(result).pass === true`
  (p95 < 3000ms, REQ-048) 를 assert 한다.
- [ ] **AC 3 — N+1 조인 경로 happy path.** Group 1 + Person **다건** (예: 10 명, `email` 은
  index 로 유니크 보장) + `personGroupMembership` 전건 seed 후 `GET /api/groups/:id/persons` 를
  반복 측정한다. 전 요청 200 · 배열 길이 = membership 수 · `assertS2Threshold(...).pass === true`
  를 assert 하고, 이 경로가 membership 수에 비례한 query 를 발화함을 헤더 주석 또는 test 이름에
  명시한다 (**측정만 — service 최적화 금지**).
- [ ] **AC 4 — error path (실 DB 미존재 row).** 존재하지 않는 id 로 `GET /api/groups/:id` 를 반복
  호출해 **실 DB 미존재** 로 404 가 나는 경로를 측정하고, `errorRate` 가 반영돼
  `assertS2Threshold(...).pass === false` + `reasons` 에 error 사유가 담기는 것을 assert 한다
  (mock 예외가 아니라 실제 row 부재로 fail 분기 도달).
- [ ] **AC 5 — 분기 cover (각 1+ test).** 최소 3 분기를 각각 별도 test 로 분리한다 — ① seed **0 행**
  (truncate 직후) → `GET /api/groups` 200 + 빈 배열 + p95 pass, ② seed **다건** → 200 + 목록 +
  p95 pass (AC 2), ③ **membership 0 인 Group** 의 `:id/persons` → **404 가 아니라** 200 + 빈 배열
  ([group.controller.ts](../../src/user/group.controller.ts) `104 행` ~ `106 행` 주석의 분기).
  세 분기 모두 `summarizeLatency` 의 `count` 가 요청 수와 같음을 확인한다.
- [ ] **AC 6 — negative cases 충분 cover (각 1+ test).** (a) 미존재 Group id 의 `GET /api/groups/:id`
  404 (AC 4), (b) **미존재 Group id 의 `:id/persons`** 도 404 — `findPersonsByGroupId` 의 사전 존재
  검증 분기 (200 + 빈 배열이 아님) 를 (a) 와 **별도 test** 로 박제, (c) 200 / 404 가 섞인 표본의
  `errorRate` 가 `0 < er < 1` 로 산출되는지, (d) `assertS2Threshold` 에 비현실적으로 낮은 상한
  (`p95MaxMs: 0`) 을 주면 실 측정값이라도 `pass === false` 로 떨어지는지 — 4 종을 각각 test 로
  박제한다.
- [ ] **AC 7 — baseline 리포트 관찰 1 건.** `buildBaselineReport(env, assertion)` +
  `formatBaselineLine` 로 한 줄 리포트를 조립하고 (env label 예: `ci-realdb-group-persons`,
  `concurrency: 1`, `dataScale` = seed 한 membership 수) 그 문자열이 `p95=` · `count=` 키를 포함함을
  assert 한다. **파일 write · baseline 확정 금지** (`writeBaselineFile` /
  `confirmOrCompareBaseline` 미사용 — 관찰 전용).
- [ ] **AC 8 — 생명주기 · 격리.** `afterEach(truncateAll)` 로 row leak 0 (Group · Person ·
  membership 전부), `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 connection 누수 0.
  본 spec 이 `.perf-spec.ts` 라 `pnpm test` (기본 jest `.spec.ts$`) 에 **picking 되지 않음** 을 헤더
  주석에 명시한다. seed 시 `Person.email` 은 test 간 충돌하지 않도록 index 접미를 부여한다.
- [ ] **AC 9 — 문서 갱신.** [test/perf/README.md](../../test/perf/README.md) 의
  `## 실 DB round-trip baseline (첫 slice)` 절을 **slice 목록 형태로 갱신** 한다 (절 제목이 "첫
  slice" 단수 전제라면 slice 2 를 포함하도록 자연스럽게 조정). 추가할 내용 = ① 본 spec 의 위치
  (slice 2), ② `person-read-realdb` 와의 차이 = **N+1 indirect navigation 측정**, ③ 실측 범위가
  아직 endpoint 소수라는 잔여. **임계값 3000ms 불변** · **baseline 미확정** 서술은 유지한다.
- [ ] **AC 10 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:cov` (line ≥ 80% / function
  ≥ 80% — production code 변경 0 이므로 수치 하락 0 이어야 한다) · `pnpm test:perf` 전부 green.
  로컬에 Postgres 가 없으면 `docker compose up -d postgres` + `DATABASE_URL` export +
  `pnpm prisma migrate deploy` 후 실행하고, 그래도 로컬 DB 확보가 불가한 경우에만 CI 의
  `perf test` step green 으로 대체 검증하며 그 사실을 PR 본문에 명시한다.
- [ ] **AC 11 — cap 준수.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 안임을 확인한다. test 수가
  늘어 cap 을 위협하면 baseline 관찰 (AC 7) 을 기존 test 안에 흡수하는 식으로 줄이되, R-112 항목
  (AC 2 · 3 · 4 · 5 · 6) 은 **삭제하지 않는다**.

## Out of Scope

- **production code 변경 일체** (`src/`) — 특히 `findPersonsByGroupId` 의 **N+1 최적화 금지**.
  본 slice 는 측정만 한다. 최적화 필요가 보이면 Follow-ups 에만 적는다.
- **기존 mock perf-spec 수정** — `group-read.perf-spec.ts` 를 포함해 기존 34 개 spec 은 불변.
- **write route perf 배선** (`POST` / `PATCH` / `DELETE` · `:id/members` mutation) 및
  `GET /api/groups/:id/members` — 본 slice 는 조회 3 route 에 집중.
- **나머지 read perf-spec 의 실 DB cutover** — endpoint 단위 후속 slice.
- **임계값 변경 · baseline 파일 확정** — `DEFAULT_P95_MAX_MS = 3000` 불변,
  `writeBaselineFile` / `confirmOrCompareBaseline` 미사용.
- **`docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신** —
  본 slice 머지 후 별도 `direct` task ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 mixed 금지).
- **부하 발생기 도입** (k6 / artillery / autocannon) 및
  [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) status flip — 새 dependency 는
  §5 BLOCKED 게이트.
- **CI workflow 변경** (`.github/workflows/ci.yml`) — 기존 `perf test` step 의 `testRegex` 가 새
  spec 을 자동 picking 하므로 편집 불요.
- **S1 (배치 부하) · S3 (동시성 내성) harness · 대규모 scale fixture** (100~200명 / 50~100 repo).
- **web 렌더 latency 측정** (REQ-048 의 시각화 축) — P6 backlog.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, 기존 harness primitive 를 실 DB 위에서 호출만).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result (2026-08-05)

`Status: DONE` — PR [#1212](https://github.com/myungjoo/Assessment-Agent/pull/1212) squash 머지
(main `97198504`). 2 파일 +298/-2, production code 변경 0.

- [test/perf/group-read-realdb.perf-spec.ts](../../test/perf/group-read-realdb.perf-spec.ts) 신설 —
  mock override 0 으로 `createE2EApp()` 부트스트랩 + `moduleRef.get(PrismaService)` seed 하여
  `GET /api/groups` 목록 · `:id` · `:id/persons` (N+1 indirect navigation) 를 실 DB round-trip 으로
  p95 실측. 7 test (happy 2 / error 1 / 분기 2 / negative 3 — negative (a) 는 error test 겸용).
- [test/perf/README.md](../../test/perf/README.md) — slice 목록에 slice 2 추가
  (임계 3000ms 불변 · baseline 미확정 유지).

AC 1~11 전부 ok (AC 7 baseline 관찰은 AC 11 cap 준수를 위해 AC 3 test 에 흡수 — AC 11 이 허용한 축약).
로컬 `pnpm lint · build · test:cov` green (429 suite / 12302 test), `test:perf` 는 로컬 Postgres 부재로
CI `perf test` step 으로 대체 검증 (`PASS test/perf/group-read-realdb.perf-spec.ts`, perf 36 suite /
284 test green). reviewer VERDICT=APPROVE round 1/7 (BLOCKER·MAJOR·MINOR 0), 4-게이트 모두 충족.

후속: reviewer 관찰 1 건 — 대규모 membership 에서의 N+1 규모 민감도 미측정 (별도 slice 후보).
문서 3 지점 반영은 T-1503 (direct doc-sync) 로 이월.
