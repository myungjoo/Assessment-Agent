---
id: T-1500
title: 실 DB round-trip 첫 perf-spec — `GET /api/persons` p95 실측 (REQ-048 mock 한계 해소 slice 1)
phase: P7
status: DONE
completedAt: 2026-08-05T13:58:12Z
prNumber: 1211
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-08-05
independentStream: p7-perf-realdb-baseline
dependsOn: []
touchesFiles:
  - test/perf/person-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P7 성능검증 bullet(PLAN 142 행) 잔여 = 실 DB round-trip 미실측 — 문서 audit L 축 마감 후 코드 축 전환 slice 1"
---

# T-1500 — 실 DB round-trip 첫 perf-spec (`GET /api/persons`)

## Why

[PLAN.md](../PLAN.md) P7 **성능 검증** bullet (142 행) 의 REQ-048 항목이 `[ ]` 로 남은 유일한 이유는
"service 계층 mock + guard override 라 controller↔collector 배선만 측정하고 **실 DB round-trip
baseline 은 미실측**" 이다 ([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
`§ 5` item 5). [requirements.md](../requirements.md) 의 REQ-048 재판정도 같은 지점을 유일 잔여
서버측 한계로 적시한다 — "mock service 는 즉시 반환 → p95 는 임계 훨씬 아래 … 실 DB 부하 하의
3 초 충족은 미검증".

기존 34 개 perf-spec 은 전부 `useValue` mock service 라 **Prisma round-trip 이 0** 이다. 본 slice 는
그 vein 을 실 Postgres 로 한 endpoint 만 cutover 해, REQ-048 의 p95 < 3000ms 판정이 **실 DB query 를
포함한 경로에서도 성립함** 을 최초로 실측한다. 대상은 guard 미부착 · query 분기 없는 단순 list read 인
`GET /api/persons` (perf harness 4 번째 배선 endpoint 였던 `person-read.perf-spec.ts` 의 실 DB 짝) 로
잡아 인증 · 권한 노이즈 0 인 상태에서 DB 왕복 비용만 측정한다. 새 dependency · schema migration ·
production code 변경은 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §5 게이트에 걸리지 않는다.

직전 111 slice 가 이어진 `uc-doc-audit-resync` 문서 축은 T-1499 로 비-ADR `L` 축이 마감됐고, 그
파생 (1) 은 "소급 census **착수 여부 판단**" 이라 착수 자체가 미정이다 — 따라서 본 호출은 PLAN.md
우선순위상 실측 증거가 비어 있는 **코드 축** 으로 전환한다.

## Required Reading

- [test/perf/person-read.perf-spec.ts](../../test/perf/person-read.perf-spec.ts) — 본 spec 의 mock 짝.
  헤더 주석 · describe 구조 · pass/fail 분기 도달 전략을 그대로 승계한다 (특히 "실 DB round-trip
  baseline 은 §5 item 5 별도 follow-up" 주석 — 본 task 가 그 follow-up 이므로 해당 주석 문구는
  건드리지 말고 새 spec 헤더에서 cross-ref 만 한다).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`,
  `assertS2Threshold`, `RequestFn`, `DEFAULT_P95_MAX_MS = 3000` 계약.
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) — `buildBaselineReport` ·
  `formatBaselineLine` (관찰·리포트 전용, 파일 I/O 없음).
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) — `createE2EApp()` (AppModule
  실 부트스트랩 + global middleware).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll` cleanup 계약.
- [test/e2e/persons.e2e-spec.ts](../../test/e2e/persons.e2e-spec.ts) — 실 DB seed (`prisma.person.create`)
  · `afterEach(truncateAll)` · `afterAll(app.close + prisma.$disconnect)` 표준 life cycle 선례.
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`,
  `maxWorkers: 1`. globalSetup 이 없으므로 DB 정리는 spec 자체 책임.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `perf test` step (234 행 ~ 243 행) —
  `prisma migrate deploy` · e2e 이후에 배치돼 실 Postgres schema 가 준비된 상태에서 실행됨을 확인.

## Acceptance Criteria

- [ ] **AC 1 — 실 DB perf-spec 신설.** `test/perf/person-read-realdb.perf-spec.ts` 를 추가한다.
  `createE2EApp()` 로 **mock override 0** 부트스트랩 (`PersonService`·`PrismaService` 를 대체하지
  않는다) 후 `moduleRef.get(PrismaService)` 로 실 client 를 얻어 seed 한다. 헤더 주석에 목적 ·
  mock 짝 (`person-read.perf-spec.ts`) 과의 차이 · 결정론 전략 · Out of Scope 를 한국어로 명시.
- [ ] **AC 2 — happy path (실 round-trip p95 판정).** `prisma.person.create` 로 person row 를 **다건
  seed** (예: 20 행) 한 뒤 `collectLatencySamples` 로 `GET /api/persons` 를 반복 측정 (예: 20 회),
  전 요청 status 200 · 응답 배열 길이 = seed 수 를 검증하고 `assertS2Threshold(result).pass === true`
  (p95 < 3000ms, REQ-048) 를 assert 한다. mock 이 아니라 **실 Prisma query** 가 발화했음을 응답 body
  가 seed 한 row 값과 일치하는 것으로 함께 검증한다.
- [ ] **AC 3 — error path.** 존재하지 않는 id 로 `GET /api/persons/:id` 를 반복 호출해 실 DB 조회가
  404 를 내는 경로를 측정하고, `errorRate` 가 반영돼 `assertS2Threshold(...).pass === false` +
  `reasons` 에 error 사유가 담기는 것을 assert 한다 (mock 예외가 아니라 **실 DB 미존재 row** 로
  fail 분기에 도달).
- [ ] **AC 4 — 분기 cover.** 최소 두 분기를 각각 test 로 분리한다 — ① seed **0 행** (truncate 직후)
  → 200 + 빈 배열 + p95 pass, ② seed **다건** → 200 + 목록 + p95 pass. 두 분기의 표본 요약
  (`summarizeLatency`) 이 모두 `count = 요청 수` 임을 확인.
- [ ] **AC 5 — negative cases 충분 cover (각 1+ test).** (a) 미존재 id 404 (AC 3), (b) `active: false`
  row 만 seed 했을 때 `GET /api/persons` 가 빈 배열 (경계값 — 목록 필터 분기), (c) 표본이 섞인 경우
  (200 + 404 혼합) 의 `errorRate` 가 0 < er < 1 로 산출되는지, (d) `assertS2Threshold` 에 비현실적으로
  낮은 상한 (예: `p95MaxMs: 0`) 을 주면 실 측정값이라도 `pass === false` 로 떨어지는지 — 4 종을 각각
  test 로 박제한다.
- [ ] **AC 6 — baseline 리포트 관찰 1 건.** `buildBaselineReport(env, assertion)` + `formatBaselineLine`
  로 한 줄 리포트를 조립해 (env label 예: `ci-realdb-person-read`, `concurrency: 1`, `dataScale` = seed
  행 수) 그 문자열이 `p95=` · `count=` 키를 포함함을 assert 한다. **파일 write · baseline 확정 금지**
  (`writeBaselineFile` / `confirmOrCompareBaseline` 미사용 — 관찰 전용).
- [ ] **AC 7 — 생명주기 · 격리.** `afterEach(truncateAll)` 로 row leak 0, `afterAll` 에서 `app.close()`
  + `prisma.$disconnect()` 로 connection 누수 0. 본 spec 은 `.perf-spec.ts` 라 `pnpm test` (기본 jest
  `.spec.ts$`) 에 **picking 되지 않음** 을 헤더 주석에 명시.
- [ ] **AC 8 — 문서 1 절.** [test/perf/README.md](../../test/perf/README.md) 에 "실 DB round-trip
  baseline (첫 slice)" 절을 추가해 ① 본 spec 이 `§ 5` item 5 의 첫 실측이라는 위치, ② mock spec 과의
  책임 경계 (mock = 배선 latency / 실 DB = round-trip 포함 latency), ③ 로컬 실행 전제 (`docker compose
  up -d postgres` + `DATABASE_URL` + `prisma migrate deploy`) 를 한국어로 기록. **임계값 3000ms 는
  불변** 임을 함께 명시.
- [ ] **AC 9 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:cov` (line ≥ 80% / function ≥ 80%
  통과 — production code 변경 0 이므로 수치 하락 0 이어야 한다) · `pnpm test:perf` 전부 green.
  로컬에 Postgres 가 없으면 `docker compose up -d postgres` 로 띄우고 `pnpm prisma migrate deploy`
  후 실행하며, 그래도 로컬 DB 확보가 불가한 경우에만 CI 의 `perf test` step green 으로 대체 검증하고
  그 사실을 PR 본문에 명시한다.

## Out of Scope

- **production code 변경 일체** (`src/`) — 본 task 는 test-only 다. controller · service · Prisma 설정을
  손대지 않는다.
- **기존 34 개 mock perf-spec 의 실 DB cutover** — 본 slice 는 endpoint **1 개** 만 실증한다. 나머지
  endpoint 확대는 후속 slice (Follow-ups).
- **임계값 변경 · baseline 파일 확정** — `DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` /
  `confirmOrCompareBaseline` 로 디스크에 baseline 을 확정하지 않는다 (`§ 5` item 5 의 "임계 fix" 는
  별도 결정).
- **부하 발생기 도입** (k6 / artillery / autocannon) 및 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md)
  status flip — 새 dependency 는 §5 BLOCKED 게이트.
- **S1 (배치 부하) · S3 (동시성 내성) harness** · 대규모 scale fixture (100~200명 · 50~100 repo) 생성.
- **CI workflow 변경** (`.github/workflows/ci.yml`) — 기존 `perf test` step 이 새 spec 을 자동 picking
  하므로 편집 불요.
- **`docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신** — 실측이
  머지된 뒤 별도 `direct` task 로 처리 (§3.1 rule 3 mixed 금지).
- **web 렌더 latency 측정** (REQ-048 의 시각화 축) — P6 backlog.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 없음, 기존 harness primitive 를 실 DB 위에서 호출만).

## Follow-ups

- **문서 정합 3 종** — `docs/PLAN.md` P7 성능검증 bullet · `docs/ops/load-resilience-test-plan.md`
  `§ 5` item 5 · `docs/requirements.md` REQ-048 재판정 이 아직 "실 DB round-trip 미실측" 으로
  서술한다. 본 실측 머지로 어긋났으므로 `direct` doc-sync 로 갱신 → **T-1501 로 큐잉됨**.
- **나머지 mock perf-spec 실 DB cutover 확대** — 본 slice 는 `GET /api/persons` 1 개만 실증했다.
  나머지 read 계열 perf-spec 의 실 DB 전환은 후속 slice (endpoint 단위로 쪼개 cap 준수).

## 완료 요약 (2026-08-05)

- PR [#1211](https://github.com/myungjoo/Assessment-Agent/pull/1211) squash 머지 (main `0395c51e`).
- `test/perf/person-read-realdb.perf-spec.ts` 신설 (8 test — happy 1 / error 1 / 분기 2 / negative 4 +
  baseline 관찰 1) + `test/perf/README.md` 에 "실 DB round-trip baseline (첫 slice)" 절 추가. 2 파일 +300/-0.
- production code (`src/`) 변경 0. 로컬 `lint` · `build` · `test:cov` green (line 99.95% / function 100%),
  실 Postgres 의존 `test:perf` 는 CI 에서 green (perf 총 276 test).
- 4-게이트 충족 — reviewer APPROVE comment 외부 존재 + CI `reviewer agent approval 검증` step success +
  integrator 자체 점검 + CI green.
