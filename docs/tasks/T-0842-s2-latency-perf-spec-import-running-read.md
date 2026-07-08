---
id: T-0842
title: S2 조회 latency harness 를 열세 번째 조회 endpoint(ImportController GET /api/admin/import/running)에 배선하는 perf-spec 신설
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-07-09
independentStream: p8-load-resilience-s2
dependsOn: []
touchesFiles:
  - test/perf/import-running-read.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 line148 부하·내성 follow-up #13(load-resilience-test-plan §5-2) — S2 collector 를 열세 번째 조회 endpoint(ImportController GET /api/admin/import/running @Roles(Admin) guarded list)에 배선, 신규 dep 0"
---

# T-0842 — S2 조회 latency harness 를 열세 번째 조회 endpoint(ImportController)에 배선하는 perf-spec 신설

## Why

[docs/PLAN.md](../PLAN.md) P8 line148(부하·내성 테스트) 의 follow-up chain 이자
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 item 2("S2
조회 latency 경량 harness — supertest 기반, 신규 dependency 불요")의 다음 slice 다. T-0830
이 첫 조회 controller(`SummaryController`)에, T-0831~T-0841 이 순서대로
`AssessmentController`·`ContributionController`·`PersonController`·`GroupController`·`PartController`·`UserController`·`PermissionDeniedRecordController`·`LlmProviderConfigController`·`DifficultyMappingController`·`CronScheduleController`·`ExportController`
에 S2 collector 를 배선했고, 본 task 는 **열세 번째 조회 endpoint** 인
`ImportController` 의 `GET /api/admin/import/running`(`findRunning` → `service.findRunning()`
— status=RUNNING 인 `ImportJob[]` 목록 조회, UC-07 §8 status polling)에 같은 harness 를
배선하는 `*.perf-spec.ts` 를 추가한다.

`GET /api/admin/import/running` 은 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`
로 **가드가 부착된 read** 이며, `service.findRunning()` 을 raw forward 하는(RUNNING job 배열을
그대로 반환, controller 자체 분기 없음, 빈 배열도 404 로 변환 안 함) list 조회다. 직전
`export-running-read.perf-spec.ts`(T-0841)와 사실상 export↔import counterpart 로 대칭이므로 그
spec 을 mirror 해 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화하고
controller 를 결정론적으로 부트스트랩하되, **Admin 가드 부착 list read 경로**까지 harness 가
재사용됨을 실증한다(REQ-048 조회·시각화 3초 이내 back). non-2xx 분류 실증은 mocked
`service.findRunning` 이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다. 신규
외부 dependency 는 0 (supertest 는 기존 devDependency).

`ImportController` 의 생성자는 `ImportJobService` 하나만 주입받으므로(`@Inject` 토큰 추가 없음),
perf-spec 의 테스트 모듈은 `ImportJobService` mock(`findRunning` jest.fn — list read 에 필요한
메서드만)만 `useValue` 로 제공하면 부트스트랩이 성립한다(export 와 동형으로 부가 provider 불요).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2("조회·시각화 read API") / §3 임계 표(p95 < 3s, error rate < 1%) / §4.1 supertest 접근 / §5 follow-up 인덱스.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`·`assertS2Threshold` 시그니처(요청 함수 주입, `now` clock 주입, 2xx/reject 분류).
- [test/perf/export-running-read.perf-spec.ts](../../test/perf/export-running-read.perf-spec.ts) — **가장 근접한 mirror 대상**(T-0841, export↔import counterpart, guard 부착 + `overrideGuard` 사용, list raw forward, 부가 provider 불요). 대상 controller/route/service 만 교체.
- [test/perf/cron-schedule-read.perf-spec.ts](../../test/perf/cron-schedule-read.perf-spec.ts) — 참고용(T-0840, guard 부착 spec 구조).
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`(변경 불요 — 기존 regex 가 신규 파일 자동 매칭).
- [test/perf/README.md](../../test/perf/README.md) — "후속 harness (`*.perf-spec.ts`)" 절(본 task 가 열세 번째 배선 spec 을 반영해 갱신).
- [src/import/import.controller.ts](../../src/import/import.controller.ts) — `@Controller("api/admin/import")` `@Get("running")` `findRunning`(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, `service.findRunning()` raw forward 반환 `ImportJob[]`, 분기 없음), 생성자에서 `ImportJobService` 만 주입.
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) — `findRunning(): Promise<ImportJob[]>` 시그니처(mock 대상 shape 참조 — perf-spec 은 `findRunning` 만 배선하되 mock 은 필요한 메서드만 jest.fn), 생성자 `PrismaService` 만 주입(perf-spec 은 service 자체를 mock 하므로 PrismaService 불요).
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) — 참고용(mocked `ImportJobService`(`findRunning` jest.fn) + `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 패턴; perf-spec 은 unit spec 이 아니라 latency 배선이지만 provider/mock shape·guard override 재사용 가능).

## Acceptance Criteria

perf-spec 은 결정론적이어야 하며(실 DB·실 Prisma·외부 I/O 무의존), collector 배선의 정확성을
검증한다. `ImportJobService` 는 mock(`useValue`)으로 대체한다. controller 의
`GET /api/admin/import/running` 은 `JwtAuthGuard`+`RolesGuard`+`@Roles("Admin")` 가 부착돼
있으므로 `export-running-read.perf-spec.ts` 처럼
`overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })` 및
`overrideGuard(RolesGuard).useValue({ canActivate: () => true })` 로 가드를 무력화한다.
`export-running-read.perf-spec.ts` 의 구조를 mirror 하되 대상 controller/route/service 만
교체한다(부가 provider 불요).

- [ ] `test/perf/import-running-read.perf-spec.ts` 신설 — `Test.createTestingModule` 로 `ImportController` + mocked `ImportJobService`(필요한 메서드만 jest.fn — 최소 `findRunning`) 를 부트스트랩하고 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한 뒤, `collectLatencySamples(() => request(app.getHttpServer()).get("/api/admin/import/running"), N)` 로 반복 호출해 표본을 수집하고 `assertS2Threshold(result).pass` 가 `true` 임을 검증(happy-path).
- [ ] Happy-path unit test: mocked `findRunning` 이 정상 배열(200) 을 반환할 때 `collectLatencySamples` 가 `total === N`, `failures === 0`, `samplesMs.length === N` 을 만족하고 `assertS2Threshold` 가 pass(p95 < 3000ms) 임을 검증하는 test 1+.
- [ ] Error path unit test: mocked `findRunning` 이 예외를 던져(또는 reject) endpoint 가 non-2xx(예: 500) 를 반환할 때 `collectLatencySamples` 가 해당 호출을 `failures` 로 분류하고 `assertS2Threshold` 가 errorRate 위반 사유(`reasons`)를 담아 `pass === false` 를 반환함을 검증하는 test 1+.
- [ ] Branch/flow cover: `assertS2Threshold` 의 pass 분기와 fail 분기(임계 위반) 각각을 실제 endpoint 호출 결과로 도달시키는 test 각 1+ (위 happy/error 로 충족되면 그 명시로 갈음).
- [ ] Negative cases 충분 cover — 예외 상황 각 1+ test:
  - (a) **빈 결과**: `findRunning` 이 `[]` 를 반환(진행 중 job 0)해도 latency 수집이 정상 동작(200, `failures === 0`) — controller 가 빈 배열을 404 로 변환하지 않는 raw forward 도 collector 가 커버함을 실증.
  - (b) **mixed 부분 실패**: 다수 호출 중 일부만 실패할 때 `failures` 부분 집계 정확성.
  - (c) **iterations 경계**: `iterations === 1` 등 경계에서 harness 가 깨지지 않음.
  - (d) **다건 결과**: `findRunning` 이 다수 RUNNING `ImportJob` 배열을 반환해도 latency 수집이 정상 동작(200, `failures === 0`).
- [ ] `pnpm test:perf` 통과 — 신규 perf-spec 이 `jest-perf.json` regex 에 매칭되어 실제로 실행되고 green(기존 summary/assessment/contribution/person/group/part/user/permission-denied/llm-provider-config/difficulty-mapping/cron-schedule/export-running-read perf-spec 과 함께 열세 개 다 실행).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — perf-spec 이 기존 unit coverage gate 를 깨지 않음(perf-spec 은 별도 config 이므로 기존 `pnpm test` green 유지도 함께 확인).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `test/perf/README.md` 의 harness 절을 갱신 — 이제 열세 개의 실 perf-spec(summary + assessment + contribution + person + group + part + user + permission-denied-read + llm-provider-config-read + difficulty-mapping-read + cron-schedule-read + export-running-read + import-running-read) 이 존재함을 반영(파일명·실행법·mock 으로 DB 무의존임을 1~3줄로 명시; 본 endpoint 는 Admin 가드 부착이라 `overrideGuard` 필요하나 부가 provider 는 불요임을 짧게 언급).
- [ ] 신규 외부 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(supertest 는 기존 devDependency).

## Out of Scope

- 실 DB(Postgres)·실 Prisma 를 띄운 진짜 round-trip latency 측정 — 본 task 는 harness **배선 검증**이지 baseline 실측이 아니다(baseline 은 §5 item 5 별도 follow-up).
- S1(평가 배치 1h)·S3(동시성 내성) harness — 신규 부하 발생기(k6 등)를 요구하므로 §5 item 1/3 별도 task(owner 승인 BLOCKED).
- k6/artillery/autocannon 등 신규 dependency 도입 — CLAUDE.md §5 BLOCKED, ADR-0054 owner 승인 후 별도 pr-task.
- `.github/workflows/` 에 perf job 상시 편입 — §5 item 4 별도 task(부하는 무거워 PR CI 와 분리).
- PLAN.md line148 checkbox flip — harness 전체 완결 전까지 `[ ]` 유지(본 task 는 slice 13).
- `assertS2Threshold`/`collectLatencySamples` 순수 로직 자체 변경 — 이미 T-0828/T-0829 에서 spec 완료. 본 task 는 그 primitive 를 **호출·배선**만 한다.
- `summary`·`assessment`·`contribution`·`person`·`group`·`part`·`user`·`permission-denied`·`llm-provider-config`·`difficulty-mapping`·`cron-schedule`·`export-running`-read perf-spec 변경 — file-disjoint 유지(본 task 는 신규 `import-running-read.perf-spec.ts` 만 추가).
- `POST /api/admin/import`(create — write)·`GET /api/admin/import/modes`·`GET /api/admin/import/:id` endpoint 배선 — 본 task 는 running list read(`findRunning`) 만 배선. write/modes/:id 경로는 필요 시 별도 slice.
- Import job 생명주기·restore/preview·descriptor 정합 자체 검증 — 본 task 는 latency 배선만(정책은 기존 controller/service spec 이 커버).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
