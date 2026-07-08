---
id: T-0844
title: S2 조회 latency harness 를 열다섯 번째 조회 endpoint(SummaryController GET /api/summaries/:id)에 배선하는 perf-spec 신설
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-09
independentStream: p8-load-resilience-s2
dependsOn: []
touchesFiles:
  - test/perf/summary-detail-read.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 line148 부하·내성 follow-up #15(load-resilience-test-plan §5-2) — S2 collector 를 첫 detail(:id) read(SummaryController GET /api/summaries/:id findById, 404 분기)에 배선, 신규 dep 0"
---

# T-0844 — S2 조회 latency harness 를 열다섯 번째 조회 endpoint(SummaryController `GET /api/summaries/:id`)에 배선하는 perf-spec 신설

## Why

[docs/PLAN.md](../PLAN.md) P8 line148(부하·내성 테스트) 의 follow-up chain 이자
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 item 2("S2
조회 latency 경량 harness — supertest 기반, 신규 dependency 불요")의 다음 slice 다. T-0830
이 첫 조회 controller(`SummaryController`)의 **list/query** endpoint(`GET
/api/summaries?personId=`)에, T-0831~T-0843 가 순서대로 assessment·contribution·person·
group·part·user·permission-denied·llm-provider-config·difficulty-mapping·cron-schedule·
export-running·import-running·auth-me 에 S2 collector 를 배선했다. 앞선 14 개 slice 는
전부 **list/query/self-read** 경로였고, 본 task 는 **열다섯 번째 조회 endpoint** 이자
**첫 path-param detail(`:id`) read** 인 `SummaryController` 의 `GET /api/summaries/:id`
(`findOne` → `service.findById(id)` — 단일 Summary 상세, row 부재 시 service 가
`NotFoundException` throw → 404 자동 mapping, REQ-048 back)에 같은 harness 를 배선하는
`*.perf-spec.ts` 를 추가한다.

`GET /api/summaries/:id` 는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`
tier 로, list endpoint(T-0830)와 같은 가드 스택을 공유하나 **경로가 다르다**:
`@Param("id")` 로 받은 id 를 `service.findById(id)` 로 raw forward 하고, row 존재 시
200(단일 Summary), row 부재 시 service 가 `NotFoundException`(404)을 던진다. 따라서 본
perf-spec 은 T-0830 의 list-read passGuard(canActivate 항상 true) 패턴을 그대로 mirror
하되 요청 함수를 `GET /api/summaries/:id` 로 바꾸고, mocked `service.findById` 가 정상
Summary(200) / `NotFoundException`(404) / 일반 예외(500) 를 반환하도록 제어해 pass/fail
분기를 결정론적으로 도달시킨다. 이로써 harness 가 **path-param 단일 상세 조회(`:id`,
404 분기 있는 detail read)** 경로까지 재사용됨을 실증한다(REQ-048 조회 3초 이내 back).
non-2xx 분류 실증은 mocked `findById` 가 `NotFoundException`/일반 예외를 던져 endpoint
가 404/500 을 반환하는 error path 로 커버한다. 신규 외부 dependency 는 0(supertest 는
기존 devDependency).

`SummaryController` 의 생성자는 `SummaryService` 1 개만 주입받으므로(`summary.controller.ts`
constructor 참조), perf-spec 의 테스트 모듈은 `SummaryService` mock 하나만 `useValue` 로
제공하면 되고(`findByPerson`/`findById`/`create`/`remove` 4 jest.fn — shape 정합용,
detail 경로가 실제로 호출하는 것은 `findById` 뿐), `JwtAuthGuard`/`RolesGuard` 는 T-0830
과 동일하게 `overrideGuard(...).useValue({ canActivate: () => true })` 로 통과시킨다
(list endpoint 와 달리 self-read 가 아니므로 req.user 박제 불요 — auth-me-read 의 sub
박제 패턴과 대비).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2("조회·시각화 read API") / §3 임계 표(p95 < 3s, error rate < 1%) / §4.1 supertest 접근 / §5 follow-up 인덱스.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`·`assertS2Threshold` 시그니처(요청 함수 주입, `now` clock 주입, 2xx/reject 분류, `RequestFn` 타입).
- [test/perf/summary-read.perf-spec.ts](../../test/perf/summary-read.perf-spec.ts) — **가장 근접한 mirror 대상**(T-0830, 같은 controller 의 list endpoint). passGuard(canActivate 항상 true) + `SummaryService` 4 jest.fn mock + describe 구조(happy/error/negative a~c) + `readRequest` 형태. 본 task 는 요청 URL 을 `?personId=` → `/:id` 로, 배선 대상 메서드를 `findByPerson` → `findById` 로 교체한다.
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`(변경 불요 — 기존 regex 가 신규 파일 자동 매칭).
- [test/perf/README.md](../../test/perf/README.md) — "후속 harness (`*.perf-spec.ts`)" 절(본 task 가 열다섯 번째 배선 spec + 첫 detail(:id) read 를 반영해 갱신).
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) — L116~L126 `@Get(":id")` `@UseGuards(JwtAuthGuard, RolesGuard)` `@Roles("User")` `findOne(@Param("id") id)` → `service.findById(id)`(row 부재 시 service NotFoundException → 404). constructor 는 `SummaryService` 1 개만 주입.
- [src/user/summary.service.ts](../../src/user/summary.service.ts) — `findById(id: string): Promise<Summary>`(row 부재 시 `NotFoundException`) 시그니처(mock 대상 shape 참조 — perf-spec 은 `findById` 만 배선하되 mock 은 4 메서드 jest.fn shape).

## Acceptance Criteria

perf-spec 은 결정론적이어야 하며(실 DB·실 Prisma·외부 I/O 무의존), collector 배선의 정확성을
검증한다. `SummaryService` 는 mock(`useValue`)으로 대체하고(`findByPerson`/`findById`/`create`/
`remove` 4 jest.fn — detail 경로가 실제 호출하는 것은 `findById` 뿐), `JwtAuthGuard`/`RolesGuard`
는 T-0830 과 동일하게 `overrideGuard(...).useValue({ canActivate: () => true })` 로 통과시킨다
(self-read 아니므로 req.user 박제 불요). `summary-read.perf-spec.ts` 의 describe 구조를 mirror
하되 요청 URL(`/api/summaries/:id`)·배선 대상 메서드(`findById`)만 교체한다.

- [ ] `test/perf/summary-detail-read.perf-spec.ts` 신설 — `Test.createTestingModule` 로 `SummaryController` + `SummaryService` mock(4 jest.fn) 를 부트스트랩하고 `JwtAuthGuard`/`RolesGuard` 를 passGuard 로 override 한 뒤, `collectLatencySamples(() => request(app.getHttpServer()).get("/api/summaries/s-1"), N)` 로 반복 호출해 표본을 수집하고 `assertS2Threshold(result).pass` 가 `true` 임을 검증(happy-path).
- [ ] Happy-path unit test: mocked `findById` 가 정상 단일 Summary(200) 를 반환할 때 `collectLatencySamples` 가 `total === N`, `failures === 0`, `samplesMs.length === N` 을 만족하고 `assertS2Threshold` 가 pass(p95 < 3000ms, `errorRate === 0`, `reasons` 비어 있음) 임을 검증하는 test 1+. `service.findById` 가 N 회 호출됐음도 assert.
- [ ] Error path unit test: mocked `findById` 가 `NotFoundException`(row 부재) 을 던져 endpoint 가 non-2xx(404) 를 반환할 때 `collectLatencySamples` 가 해당 호출을 `failures` 로 분류하고 `assertS2Threshold` 가 errorRate 위반 사유(`reasons`)를 담아 `pass === false` 를 반환함을 검증하는 test 1+.
- [ ] Branch/flow cover: `assertS2Threshold` 의 pass 분기(200)와 fail 분기(임계 위반, 404/500) 각각을 실제 endpoint 호출 결과로 도달시키는 test 각 1+ (위 happy/error 로 충족되면 그 명시로 갈음).
- [ ] Negative cases 충분 cover — 예외 상황 각 1+ test:
  - (a) **row 부재(404)**: `findById` 가 `NotFoundException` 을 던질 때 endpoint 가 404 를 반환하고 collector 가 `failures` 로 분류, `assertS2Threshold` fail(위 error path 와 동일 사유를 detail 관점에서 별도 명시하거나 error path test 로 갈음).
  - (b) **일반 예외(500)**: `findById` 가 일반 `Error`(NotFound 아닌 장애)를 던질 때 endpoint 가 500 을 반환하고 collector 가 `failures` 로 분류함을 실증(404 와 500 두 non-2xx 를 구분해 최소 1개는 500 도 커버).
  - (c) **mixed 부분 실패**: 다수 호출 중 일부만 404/500 일 때 `failures` 부분 집계 정확성(예: 4회 중 1회 실패 → `failures === 1`, `samplesMs.length === 3`).
  - (d) **iterations 경계**: `iterations === 1` 등 경계에서 harness 가 깨지지 않음(단일 호출로도 정상 동작).
- [ ] `pnpm test:perf` 통과 — 신규 perf-spec 이 `jest-perf.json` regex 에 매칭되어 실제로 실행되고 green(기존 14 perf-spec 과 함께 열다섯 개 다 실행).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — perf-spec 이 기존 unit coverage gate 를 깨지 않음(perf-spec 은 별도 config 이므로 기존 `pnpm test` green 유지도 함께 확인).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `test/perf/README.md` 의 harness 절을 갱신 — 이제 열다섯 개의 실 perf-spec(summary-read(list) + assessment + contribution + person + group + part + user + permission-denied-read + llm-provider-config-read + difficulty-mapping-read + cron-schedule-read + export-running-read + import-running-read + auth-me-read + **summary-detail-read**) 이 존재함을 반영(파일명·실행법·mock 으로 DB 무의존임을 1~3줄로 명시; 본 spec 이 첫 path-param `:id` detail read 배선이며 404 분기를 collector failures 로 커버함을 짧게 언급).
- [ ] 신규 외부 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(supertest 는 기존 devDependency).

## Out of Scope

- 실 DB(Postgres)·실 Prisma 를 띄운 진짜 round-trip latency 측정 — 본 task 는 harness **배선 검증**이지 baseline 실측이 아니다(baseline 은 §5 item 5 별도 follow-up).
- S1(평가 배치 1h)·S3(동시성 내성) harness — 신규 부하 발생기(k6 등)를 요구하므로 §5 item 1/3 별도 task(owner 승인 BLOCKED).
- k6/artillery/autocannon 등 신규 dependency 도입 — CLAUDE.md §5 BLOCKED, ADR-0054 owner 승인 후 별도 pr-task.
- `.github/workflows/` 에 perf job 상시 편입 — §5 item 4 별도 task(부하는 무거워 PR CI 와 분리).
- PLAN.md line148 checkbox flip — harness 전체 완결 전까지 `[ ]` 유지(본 task 는 slice 15).
- `assertS2Threshold`/`collectLatencySamples` 순수 로직 자체 변경 — 이미 T-0828/T-0829 에서 spec 완료. 본 task 는 그 primitive 를 **호출·배선**만 한다.
- 기존 14 perf-spec(summary-read(list)~auth-me-read) 변경 — file-disjoint 유지(본 task 는 신규 `summary-detail-read.perf-spec.ts` 만 추가).
- `POST /api/summaries`(생성)·`DELETE /api/summaries/:id`(삭제) endpoint 배선 — 본 task 는 read(`GET /api/summaries/:id`) 만 배선. create/remove 는 write 경로라 S2 조회 범위 밖.
- 다른 controller 의 `@Get(":id")` detail read(assessment/contribution/person/group/part/user/summary 등) 배선 — 각각 별도 slice(본 task 는 첫 detail read 로 SummaryController `:id` 만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
