---
id: T-1545
title: 실 DB perf slice 23 — GET /api/persons 의 row 수 규모 민감도 실측 (소규모 vs 대규모 + active 필터 선택도)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 290
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T17:40:00Z
completedAt: 2026-08-09T18:57:33Z
prNumber: 1233
independentStream: perf-realdb-slices
dependsOn: [T-1544]
touchesFiles:
  - test/perf/person-list-scale-realdb.perf-spec.ts
  - test/perf/README.md
  - docs/tasks/T-1545-perf-realdb-slice23-person-list-scale.md
plannerNote: "PLAN 140~142 행 성능 검증 bullet 의 잔여 축 (b) 규모 민감도 — (B) 인벤토리 0 소진 후 slice 3 이 한 route 에만 남긴 규모 축을 GET /api/persons 로 확장"
---

# T-1545 — 실 DB perf slice 23: `GET /api/persons` 규모 민감도

## Why

[T-1544](T-1544-perf-realdb-slice22-doc-sync.md) 로 부하계획 `§ 5` item 5 의 **잔여 read route
인벤토리 (B) 가 0** 이 됐다. 즉 "인벤토리가 열거한 조회 route 를 하나씩 실 DB 로 cutover" 하는
축(slice 1~22)은 열거 범위를 소진했다. 그러나 T-1544 가 못박은 대로 이는 **조회 성능 검증 완료가
아니며**, [PLAN.md](../PLAN.md) `140 행` 성능 검증 bullet 은 여전히 `[ ]`, REQ-048 은
`IN_PROGRESS` 다. 남은 축은 4 종 — (a) (A) 부류 mock spec 30 개 retire 판단, (b) **규모 민감도**,
(c) baseline 확정 · 임계 fix, (d) web 렌더 측정 + REQ-047 실 scale 부하.

본 task 는 그중 **(b) 규모 민감도** 를 다음 slice 축으로 택한다 (T-1544 `## Follow-ups` 가
planner 몫으로 이월한 선택). 근거: 현재 규모 축은
[slice 3](../../test/perf/group-persons-scale-realdb.perf-spec.ts)(T-1504) 이
`GET /api/groups/:id/persons` **한 route** 에서 membership 수를 5 → 60 으로 키운 것뿐이고,
[test/perf/README.md](../../test/perf/README.md) `잔여` bullet 이 "다른 endpoint 의 규모 민감도는
여전히 미측정" 이라고 명시한다. 반면 [slice 1](../../test/perf/person-read-realdb.perf-spec.ts)
(T-1500) 은 `GET /api/persons` 를 **고정 20 row** 한 표본으로만 측정했다 — 목록 조회의 p95 가
**응답 row 수에 어떻게 반응하는지** 는 실 Postgres 위에서 한 번도 실측된 적이 없다. 목록 조회는
REQ-048 (조회 3 초) 이 실사용에서 가장 먼저 깨질 지점이라 규모 축 확장의 첫 대상으로 타당하다.

**본 slice 고유 축 ① — 단일 route 의 row 수 민감도.** `PersonController.findActive`
([src/user/person.controller.ts](../../src/user/person.controller.ts) `53~54 행`) 는 guard 미부착 ·
필수 query-param 분기 0 인 단순 list read 라, 인증 · 권한 노이즈 0 에서 **row 수 → latency** 관계만
분리 관측된다. slice 3 이 "membership 수 = 요청당 query 수" 인 **N+1 축** 이었던 것과 달리 본 slice 는
**단일 query 의 결과 집합 크기 축** 이라 셈법이 다르다 — slice 3 문장을 복사하지 않는다.

**본 slice 고유 축 ② — active 필터 선택도.** 대규모 표본에 `active: false` row 를 섞으면 **응답
row 수는 줄지만 테이블 스캔 대상은 그대로** 인 표본이 만들어진다. 필터가 응답 크기와 스캔 비용을
분리하는 이 분기는 실 DB slice 어디에도 없다.

**측정만 한다** — index 추가 · `findActive` 쿼리 최적화 · 페이지네이션 도입은 production code /
schema 변경이라 전부 범위 밖이다 (관측 결과가 어떻든 본 task 에서 고치지 않는다).

**계수 함정 (doc-sync 가 이어받을 사전 인지).** 새 파일명에 `read` 가 **없으므로** (slice 3 과 같은
셈법) `*read*` glob 은 **51 불변**, `*read*realdb*` 도 **21 불변**, 따라서 "mock 잔존 read perf-spec
**30 개**" 도 불변이다. 늘어나는 것은 perf-spec 총계 **56 → 57** 과 실 DB round-trip **22 → 23** 뿐이다.
또한 본 slice 는 **slice 1 과 같은 route** 를 다른 규모로 잴 뿐이라 **실측 도메인 15 · 조회 route 31 ·
인벤토리 (A) 30 / (B) 0 / (C) 0 이 전부 불변** 이다.

## Required Reading

- [test/perf/group-persons-scale-realdb.perf-spec.ts](../../test/perf/group-persons-scale-realdb.perf-spec.ts)
  — **구조 정본**. 헤더 주석 ①~⑤ 구성 · 두 표본 상수(`SMALL_*` / `LARGE_*` / `SHORT_ITERATIONS`) ·
  `observations` 누적 · `afterEach(truncateAll)` 패턴을 승계한다. **수정 금지**.
- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts) —
  slice 1. 같은 route 의 seed (`prisma.person.createMany`) · `email` `@unique` 회피 접미 ·
  응답 body 대조 방식. **수정 금지** (본 slice 는 별도 파일이다).
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `49~66 행` — `@Get()`
  `findActive` 와 `@Get(":id")` 의 경계. **수정 금지**.
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createE2EApp()` 반환 형태와
  `truncateAll` 의 정리 범위. **둘 다 수정 금지**.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) ·
  [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) ·
  [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) — `collectLatencySamples` ·
  `assertS2Threshold` · `summarizeLatency` · `buildBaselineReport` / `formatBaselineLine` 시그니처.
  **primitive 수정 금지** (관찰 전용, 디스크 write 0).
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의
  **slice 3 bullet** (규모 축 문형) 과 말미 **잔여** bullet — 본 task 가 갱신할 유일한 문서.
- [docs/tasks/T-1544-perf-realdb-slice22-doc-sync.md](T-1544-perf-realdb-slice22-doc-sync.md)
  `## Why` · `## Follow-ups` — 계수 규약과 "완료 선언 0" 원칙의 승계 출처.

## Acceptance Criteria

- [ ] **AC 1 — 신규 spec 1 개.** `test/perf/person-list-scale-realdb.perf-spec.ts` 를 새로 만든다.
  `createE2EApp()` 로 **mock override 0** 인 실 `AppModule` 을 부트스트랩하고
  `moduleRef.get(PrismaService)` 의 실 client 로 seed 한다. 기존 perf-spec · helper · primitive ·
  production code 는 **한 파일도 수정하지 않는다**. 헤더 주석은 slice 3 문형을 **cross-ref** 로
  승계하되 산문 복제 없이 **≤ 25 줄**.
- [ ] **AC 2 — happy-path (규모 축 2 표본).** ① 소규모(**20 row**) 와 ② 대규모(**200 row**) 두 표본
  각각에 대해 `GET /api/persons` 를 반복 측정해 `assertS2Threshold` 가 **p95 < 3000ms** 로 pass 하고,
  응답 배열 길이가 seed 행 수와 **정확히 일치** 함을 확인한다 (실 query 발화 입증). 반복 횟수는
  대규모가 응답 직렬화 비용이 크므로 소규모보다 작게 잡는다 (slice 3 의 `SMALL/LARGE_ITERATIONS` 선례).
- [ ] **AC 3 — 분기 cover ① active 필터 선택도.** `active: true` **120 row** + `active: false`
  **80 row** 혼합 표본에서 응답 길이가 **120** 이고 응답에 inactive row 가 **0 건** 이며 p95 가
  임계 아래임을 확인한다 — 응답 크기(120)와 스캔 대상(200)이 분리되는 표본임을 주석 1 구절로 남긴다.
- [ ] **AC 4 — 분기 cover ② pass / fail 양쪽 도달.** `assertS2Threshold` 의 **pass 분기**(AC 2·3)와
  **fail 분기**(`p95MaxMs: 0` 주입 → 실 측정 시간에 무의존한 결정론적 throw) 를 모두 도달시킨다.
- [ ] **AC 5 — negative cases 충분 cover (각 1+ test).** 최소 다음 4 종 —
  (a) **빈 테이블**(0 row) 요청이 404 가 아니라 **200 + `[]`** (경계값),
  (b) **전량 inactive** seed 요청이 200 + `[]` (빈 응답은 오류가 아님),
  (c) 인위 **non-2xx 주입** 표본의 `errorRate` 위반과, 2xx 혼합 표본의 **`0 < errorRate < 1`**,
  (d) 대규모 표본을 `truncateAll` 로 비운 **전/후 대조 쌍** 에서 응답 길이가 200 → 0 으로 바뀌고
  두 요청 모두 **200** 임 (truncate 후 actor row 재-seed 가 필요하면 원본 id 그대로 재삽입 —
  `db-truncate.ts` 수정 0).
- [ ] **AC 6 — 대소 관계 assert 금지 (flaky 차단).** 두 표본의 p95 대소(`large > small`)는
  **assert 하지 않는다**. `buildBaselineReport` + `formatBaselineLine` 한 줄을 `observations` 에
  선언 순서대로 누적해 **관찰 기록으로만** 남기고, 누적된 관찰 줄 수만 assert 한다.
  `writeBaselineFile` · `confirmOrCompareBaseline` 는 **호출하지 않는다** (디스크 write 0).
- [ ] **AC 7 — 실행 스위트 격리.** 새 파일은 `jest-perf.json` `testRegex` 에만 매칭돼
  `pnpm test:perf` 로만 실행되고 기본 `pnpm test` 에는 picking 되지 않음을 확인한다
  (`pnpm test -- --listTests` 결과에 본 파일이 **없음**). `.github/workflows/ci.yml` · jest config 는
  **수정 불요** (기존 `testRegex` 가 자동 picking).
- [ ] **AC 8 — 명령 실행.** `pnpm lint` · `pnpm build` · `pnpm test` · **`pnpm test:cov` 통과
  (line ≥ 80% / function ≥ 80%)** · `pnpm test:perf` 통과. production code 변경이 0 이라 coverage
  수치는 불변이어야 한다 (감소 시 원인 규명 후 되돌린다). 실 Postgres 전제는 CI `perf test` step 이
  충족하며, 로컬은 README `로컬 실행 전제` 절차를 따른다.
- [ ] **AC 9 — README slice 23 bullet 추가.** [test/perf/README.md](../../test/perf/README.md) 의
  slice 목록 말미에 **slice 23** bullet 1 개를 추가하고, **잔여** bullet 의 계수를 갱신한다 —
  perf-spec **56 → 57**, 실 DB round-trip **22 → 23**, 그리고 `*read*` glob **51 불변** ·
  `*read*realdb*` **21 불변** · **mock 잔존 30 불변** 인 이유(파일명에 `read` 없음 — slice 3 과 같은
  셈법)를 1 구절로 남긴다. 추가 분량 **≤ 40 LOC**.
- [ ] **AC 10 — 계수 오독 차단 (본 task 최대 함정).** README 에 **실측 도메인 15 · 조회 route 31 ·
  인벤토리 (A) 30 / (B) 0 / (C) 0 이 전부 불변** 임을 1 구절로 명시한다 — 본 slice 는 **새 route 가
  아니라 slice 1 과 같은 route 의 다른 규모** 이기 때문이다. 새 route · 새 도메인을 실측했다고 읽히는
  표현을 쓰지 않는다.
- [ ] **AC 11 — 완료 선언 0.** README 어디에도 "규모 축 해소" · "조회 성능 검증 완료" 로 읽히는 표현을
  쓰지 않는다. 본 slice 의 대규모 표본은 **상대 비교용 소규모 표본** 일 뿐 **REQ-047 실 scale 부하
  (100~200명 / 50~100 repo / ~1000 confluence page / 1h) 가 아님** 을 명시하고, 잔여 4 축
  ((A) 30 retire · 다른 endpoint 규모 민감도 · baseline 확정 · 임계 fix · web 렌더) 서술을
  삭제하거나 완화하지 않는다.
- [ ] **AC 12 — 크기 검산.** `git diff --stat` 이 **3 파일 이하 / ≤ 300 LOC** 임을 확인한다
  (spec ≤ 250 LOC + README ≤ 40 LOC + 본 task 파일). 초과 예상 시 test 수를 줄이지 말고 **헤더 주석과
  중복 서술을 cross-ref 로 압축** 한다.

## Out of Scope

- **production code · schema 변경 일체** (`src/` · `prisma/`) — `findActive` 쿼리 최적화 · index 추가
  (`@@index`) · 페이지네이션 도입 · guard 부착은 관측 결과와 무관하게 전부 범위 밖. 개선 후보가
  보이면 Follow-ups 에만 적는다.
- **기존 perf-spec · helper · primitive 수정** — `person-read-realdb.perf-spec.ts` ·
  `group-persons-scale-realdb.perf-spec.ts` · `person-read.perf-spec.ts`(mock 짝) ·
  `latency-*.ts` · `db-truncate.ts` · `e2e-app-factory.ts` 모두 불변.
- **(A) 부류 mock perf-spec 30 개의 retire · 삭제 · 통합** — T-1536 이 명시 유보한 별도 주제.
- **baseline 파일 확정 · 임계값 변경** — `DEFAULT_P95_MAX_MS = 3000` 불변,
  `writeBaselineFile` · `confirmOrCompareBaseline` 미사용 (AC 6).
- **동시성(S3) · 부하 발생기(S1) 도입** — `concurrency: 1` 고정, ADR-0054 는 PROPOSED 그대로 두고
  status flip 하지 않는다. 새 dependency 추가는 §5 BLOCKED 게이트 대상.
- **`docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신** —
  §3.1 rule 3 (direct · pr mixed 금지) 에 따라 **머지 후 별도 `direct` doc-sync task** 로 이월한다
  (slice 20~22 와 동일 절차). 본 PR 은 `test/` 만 건드린다.
- **write / trigger route 의 perf 인벤토리화 · 측정** — 인벤토리 범위는 read (조회) route 라는
  기존 경계를 유지한다.
- **web 렌더 측정 축 착수** — 별도 slice.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, slice 3 구조 승계).

## Follow-ups

- **slice 23 doc-sync (`direct`)** — 머지 후 PLAN `142 행` · 부하계획 `§ 5` item 5 · REQ-048 행에
  perf-spec 57 / 실 DB 23 / read glob 51 불변 / mock 잔존 30 불변 / 도메인 15 · 조회 route 31 불변 ·
  인벤토리 (A)(B)(C) 불변 을 반영 (완료 선언 0).
