---
id: T-1504
title: 실 DB round-trip perf-spec slice 3 — `GET /api/groups/:id/persons` N+1 규모 민감도(소규모 vs 대규모 membership) 실측
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 275
estimatedFiles: 2
created: 2026-08-05
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1502]
touchesFiles:
  - test/perf/group-persons-scale-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 2 번(대규모 membership N+1 규모 민감도 미측정) 해소 slice 3 — T-1502 reviewer 관찰 이월분, 측정만"
---

# T-1504 — 실 DB round-trip perf-spec slice 3 (N+1 규모 민감도)

## Why

[PLAN.md](../PLAN.md) `142 행` 의 REQ-048 sub-bullet 은 checkbox `[ ]` 유지 사유를 두 갈래로 적고
있다 — ① 실측 범위가 endpoint **2 개(조회 route 4)** 뿐, ② **"slice 2 의 seed 표본이 소규모라
대규모 membership 에서의 N+1 규모 민감도(membership 수 증가에 따른 latency 기울기)는 미측정"**.
②는 [T-1502](T-1502-perf-realdb-group-read-njoin.md) reviewer 가 남긴 관찰이자
[T-1503](T-1503-perf-realdb-slice2-doc-sync.md) AC 5 가 문서에 박제한 잔여다. 본 task 가 그
이월분의 **slice 3** 이며, ① (다른 endpoint 확대) 는 다루지 않는다.

②를 먼저 잡는 이유는 **질적으로 새로운 축** 이기 때문이다. slice 1 · 2 는 "고정된 소규모 seed 에서
p95 < 3000ms" 만 증거화했고, 실 scale 에서의 거동은 전혀 모른다.
[group.service.ts](../../src/user/group.service.ts) 의 `findPersonsByGroupId` 는
`PersonGroupMembership` 에서 `personId[]` 를 뽑은 뒤 `PersonRepository.findById` 를 **loop 호출**
하므로 (헤더 주석 `15 행` ~ `20 행` · `50 행` ~ `51 행` 이 "N+1 query 의 P0 acceptable 패턴" 으로
자인) membership 수가 곧 query 수다. 본 slice 는 같은 route 를 **소규모 seed 와 대규모 seed 두
표본** 으로 각각 측정해, 규모가 커져도 REQ-048 임계(p95 < 3000ms)를 유지하는지를 실 Postgres
위에서 처음 증거화하고 두 표본의 baseline 한 줄을 나란히 **관찰 기록** 한다.

**성능 개선은 하지 않는다** — N+1 을 batch query (`findManyByIds`) 로 고치는 것은 production code
변경이라 범위 밖이다. 본 task 는 오직 **측정** 이며, 실측이 임계를 위협하면 그 사실을 Follow-ups 에
남겨 후속 결정에 넘긴다. 또한 본 slice 의 "대규모" 는 어디까지나 단일 route 의 상대 비교용이며
REQ-047 의 실 scale(100~200명 / 50~100 repo) 부하 검증이 **아니다** — 그 축은 여전히 미착수다.

## Required Reading

- [test/perf/group-read-realdb.perf-spec.ts](../../test/perf/group-read-realdb.perf-spec.ts) —
  slice 2 정본. 헤더 주석 ①~⑤ 구성 · `createE2EApp()` mock override 0 부트스트랩 ·
  `moduleRef.get(PrismaService)` · `prisma.group.createMany` / `person.createMany` /
  `personGroupMembership.createMany` seed 헬퍼 · `afterEach(truncateAll)` ·
  `afterAll(app.close + prisma.$disconnect)` · `personsRequest(groupId)` 형태의 `RequestFn` 조립을
  **구조만 승계** 한다 (문구 복제 금지 — 헤더에서 cross-ref). 이 파일은 **수정하지 않는다**.
- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts) —
  slice 1. 실 DB perf-spec 의 원형 (헤더 주석 · 결정론 전략 서술) 참고용, **수정 금지**.
- [src/user/group.service.ts](../../src/user/group.service.ts) 헤더 주석 `15 행` ~ `20 행` ·
  `40 행` ~ `41 행` · `50 행` ~ `51 행` — N+1 indirect navigation 서술 (membership 수 = query 수),
  `findPersonsByGroupId` 의 3 분기 (Group 부재 404 / membership 0 → 빈 배열 / Person null 필터링).
  본 task 의 측정 가치 근거이자 seed 규모 설계의 입력.
- [src/user/group.controller.ts](../../src/user/group.controller.ts) `104 행` ~ `112 행` —
  `@Get(":id/persons")` 계약 (Group 부재 → 404, membership 0 → 200 + 빈 배열). guard 미부착이라
  인증·인가 노이즈 0.
- [prisma/schema.prisma](../../prisma/schema.prisma) — Person (`email` `@unique`) · Group
  (`name` `@unique` **없음**) · PersonGroupMembership (`@@unique([personId, groupId])` · 양측
  `onDelete: Cascade`). 대규모 seed 시 email 충돌(P2002) 회피와 membership 중복 회피에 필요.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) —
  `collectLatencySamples(fn, n)` · `assertS2Threshold(result, opts?)` · `RequestFn` ·
  `DEFAULT_P95_MAX_MS = 3000` 계약 (`S2Assertion.pass` · `reasons`).
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) —
  `buildBaselineReport(env, assertion)` · `formatBaselineLine(report)` (관찰 전용, 파일 I/O 없음).
  `BaselineEnvMeta` 의 `label` · `concurrency` · `dataScale` 필드.
- [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) — `summarizeLatency` 의
  `count` · `p95` 필드.
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createE2EApp()` 반환 shape 와
  `truncateAll(prisma)` 계약.
- [test/perf/README.md](../../test/perf/README.md) `508 행` ~ `541 행`
  (`## 실 DB round-trip baseline (slice 목록)`) — 본 task 가 갱신할 절 (slice 3 항목 추가 + 잔여
  서술 정정).

## Acceptance Criteria

- [ ] **AC 1 — 실 DB perf-spec 신설.** `test/perf/group-persons-scale-realdb.perf-spec.ts` 를
  추가한다. `createE2EApp()` 로 **mock override 0** 부트스트랩 (`GroupService` ·
  `PersonService` · `PrismaService` 어느 것도 `useValue` 로 대체하지 않는다) 후
  `moduleRef.get(PrismaService)` 로 실 client 를 얻어 seed 한다. 헤더 주석 (한국어) 에 ① 본 spec 이
  실 DB round-trip **slice 3** 이며 slice 2 와 **같은 route 를 다른 규모로** 측정한다는 위치,
  ② slice 2 와의 책임 경계 (slice 2 = route 폭 / 본 spec = **규모 축**), ③ 측정 의도 =
  membership 수 = query 수 인 N+1 경로의 **규모 민감도**, ④ 결정론 전략, ⑤ Out of Scope (특히
  "REQ-047 실 scale 부하 검증이 아님") 를 명시한다.
- [ ] **AC 2 — happy path ①: 소규모 표본.** Group 1 + Person 소수 (예: **5 명**) +
  `personGroupMembership` 전건 seed 후 `collectLatencySamples` 로 `GET /api/groups/:id/persons` 를
  반복 측정 (예: 10 회) 한다. 전 요청 status 200 · 배열 길이 = seed membership 수 · 응답 body 의
  `name` (또는 `email`) 집합이 seed 값과 일치 (**실 query 발화 입증**) · `summarizeLatency` 의
  `count` = 요청 수 · `assertS2Threshold(result).pass === true` (p95 < 3000ms, REQ-048) 를 assert.
- [ ] **AC 3 — happy path ②: 대규모 표본 (본 slice 핵심).** 같은 route 를 membership **한 자릿수의
  10 배 이상** 규모 (예: **60 명**, `createMany` 로 일괄 seed — `email` 은 index 접미로 유니크
  보장) 에서 반복 측정 (예: 8 회) 한다. 전 요청 200 · 배열 길이 = 대규모 membership 수 ·
  `assertS2Threshold(result).pass === true` 를 assert 하고, 이 표본이 요청당 **membership 수에
  비례한 query** 를 발화함을 test 이름 또는 주석에 명시한다 (**측정만 — service 최적화 금지**).
- [ ] **AC 4 — 규모 비교 관찰 1 건 (기울기 기록, 대소 assert 금지).** 소규모 · 대규모 두 표본에
  대해 각각 `buildBaselineReport(env, assertion)` + `formatBaselineLine` 로 한 줄씩 조립하고
  (`label` 예: `ci-realdb-group-persons-small` / `...-large`, `concurrency: 1`, `dataScale` = 각
  표본의 membership 수) ① 두 줄 모두 `p95=` · `count=` 키를 포함, ② 두 줄의 `dataScale` 값이
  **서로 다름**, ③ 두 p95 가 모두 **유한한 0 이상 수치** 임을 assert 한다. **latency 대소 관계
  (`large.p95 > small.p95`) 는 assert 하지 않는다** — wall-clock 비결정성으로 flaky 하므로 관찰
  기록에 그친다. **파일 write · baseline 확정 금지** (`writeBaselineFile` /
  `confirmOrCompareBaseline` 미사용).
- [ ] **AC 5 — 분기 cover (각 1+ test).** `findPersonsByGroupId` 의 분기를 각각 별도 test 로 분리한다
  — ① **membership 0** 인 Group → 200 + **빈 배열** (404 아님, [group.controller.ts](../../src/user/group.controller.ts)
  `104 행` ~ `106 행` 주석의 분기) + p95 pass, ② 소규모 membership → 200 + n (AC 2), ③ 대규모
  membership → 200 + N (AC 3). 세 분기 모두 `summarizeLatency` 의 `count` 가 요청 수와 같음을
  확인한다. (Person null 필터링 분기는 `onDelete: Cascade` 로 도달 불가 — 주석에 사유 1 줄 명시.)
- [ ] **AC 6 — negative cases 충분 cover (각 1+ test).** (a) **미존재 Group id** 의 `:id/persons` →
  실 DB row 부재로 404, `errorRate` 반영으로 `assertS2Threshold(...).pass === false` +
  `reasons` 에 error 사유 포함, (b) **존재했다가 삭제된 Group** 의 `:id/persons` — 대규모 seed 후
  `prisma.group.delete` (membership cascade 동반) 하고 재조회 시 404 로 떨어지는 시퀀스를 (a) 와
  **별도 test** 로 박제, (c) 200 / 404 가 섞인 표본의 `errorRate` 가 `0 < er < 1` 로 산출,
  (d) 대규모 실측이라도 비현실적 상한 (`p95MaxMs: 0`) 을 주면 `pass === false` — 4 종을 각각
  test 로 박제한다.
- [ ] **AC 7 — 생명주기 · 격리 · seed 비용.** `afterEach(truncateAll)` 로 row leak 0 (Group ·
  Person · membership 전부), `afterAll` 에서 `app.close()` + `prisma.$disconnect()` 로 connection
  누수 0. 대규모 seed 는 개별 `create` loop 이 아니라 **`createMany`** 로 조립해 seed 시간이 측정
  구간 밖에서도 과다해지지 않게 한다. 본 spec 이 `.perf-spec.ts` 라 `pnpm test` (기본 jest
  `.spec.ts$`) 에 **picking 되지 않음** 을 헤더 주석에 명시한다.
- [ ] **AC 8 — 문서 갱신.** [test/perf/README.md](../../test/perf/README.md) 의
  `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 3 항목** 을 추가한다 — ① 본 spec 의 위치,
  ② slice 2 와의 차이 = **같은 route 의 규모 축 측정**, ③ 두 표본 baseline 은 **관찰 기록이며 대소
  assert 를 하지 않는다** 는 결정론 사유, ④ 본 slice 의 "대규모" 가 **REQ-047 실 scale 부하가
  아님**. 기존 `**잔여**` bullet 에 규모 축의 도달 범위를 1 구절 반영하되 **임계값 3000ms 불변** ·
  **baseline 미확정** 서술은 유지한다.
- [ ] **AC 9 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:cov` (line ≥ 80% / function
  ≥ 80% — production code 변경 0 이므로 수치 하락 0 이어야 한다) · `pnpm test:perf` 전부 green.
  로컬에 Postgres 가 없으면 `docker compose up -d postgres` + `DATABASE_URL` export +
  `pnpm prisma migrate deploy` 후 실행하고, 그래도 로컬 DB 확보가 불가한 경우에만 CI 의
  `perf test` step green 으로 대체 검증하며 그 사실을 PR 본문에 명시한다.
- [ ] **AC 10 — cap 준수.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 안임을 확인한다. 분량이
  cap 을 위협하면 AC 4 의 baseline 관찰을 AC 2 · AC 3 test 안으로 흡수하거나 반복 횟수·seed 규모
  상수를 파일 상단에 모아 중복을 줄이되, R-112 항목 (AC 2 · 3 · 5 · 6) 은 **삭제하지 않는다**.

## Out of Scope

- **production code 변경 일체** (`src/`) — 특히 `findPersonsByGroupId` 의 **N+1 최적화 금지**
  (`PersonRepository.findManyByIds` 신설 포함). 본 slice 는 측정만 하며, 최적화 필요가 보이면
  Follow-ups 에만 적는다.
- **기존 perf-spec 수정** — `group-read-realdb.perf-spec.ts` · `group-read.perf-spec.ts` ·
  `person-read-realdb.perf-spec.ts` 를 포함해 기존 36 개 spec 은 불변.
- **다른 endpoint 의 실 DB cutover** (PLAN `142 행` 잔여 ①) — 본 task 는 규모 축 ②만 다룬다.
  endpoint 확대는 별도 slice.
- **`docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신** —
  본 slice 머지 후 별도 `direct` task ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 mixed 금지).
  T-1501 · T-1503 이 slice 1 · 2 에 대해 수행한 것과 동형.
- **REQ-047 실 scale 부하 주장** — 본 slice 의 "대규모" 는 단일 route 의 상대 비교용 표본일 뿐,
  100~200명 / 50~100 repo / ~1000 confluence page / 1h 이내 배치 부하 검증이 아니다. 문서·주석에
  이를 REQ-047 충족으로 읽히게 적지 않는다.
- **임계값 변경 · baseline 파일 확정** — `DEFAULT_P95_MAX_MS = 3000` 불변,
  `writeBaselineFile` / `confirmOrCompareBaseline` 미사용 (관찰 전용, 디스크 write 0).
- **write route perf 배선** (`POST` / `PATCH` / `DELETE` · `:id/members` mutation) 및
  `GET /api/groups/:id/members`.
- **부하 발생기 도입** (k6 / artillery / autocannon) 및
  [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) status flip — 새 dependency 는
  §5 BLOCKED 게이트.
- **CI workflow 변경** (`.github/workflows/ci.yml`) — 기존 `perf test` step 의 `testRegex` 가 새
  spec 을 자동 picking 하므로 편집 불요.
- **동시성(S3) 측정** — `concurrency: 1` 고정. 병렬 클라이언트 표본은 별도 harness.
- **web 렌더 latency 측정** (REQ-048 의 시각화 축) — P6 backlog.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, 기존 harness primitive 를 실 DB 위에서 규모만
바꿔 호출).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
