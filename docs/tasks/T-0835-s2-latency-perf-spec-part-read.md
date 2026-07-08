---
id: T-0835
title: S2 조회 latency harness 를 여섯 번째 조회 endpoint(PartController)에 배선하는 perf-spec 신설
phase: P8
status: DONE
completedAt: 2026-07-08T14:50:31Z
mergedAs: d508628f
prNumber: 729
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-07-08
independentStream: p8-load-resilience-s2
dependsOn: [T-0828, T-0829, T-0830]
touchesFiles:
  - test/perf/part-read.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 line148 부하·내성 follow-up #6(load-resilience-test-plan §5-2) — S2 collector 를 여섯 번째 조회 endpoint(PartController findAll/findById, guard 미적용 read + 404)에 배선, 신규 dep 0. group-read slice mirror"
---

# T-0835 — S2 조회 latency harness 를 여섯 번째 조회 endpoint(PartController)에 배선하는 perf-spec 신설

## Why

[docs/PLAN.md](../PLAN.md) P8 line148(부하·내성 테스트) 의 follow-up chain 이자
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 item 2("S2
조회 latency 경량 harness — supertest 기반, 신규 dependency 불요")의 다음 slice 다. T-0830
이 첫 조회 controller(`SummaryController`)에, T-0831 이 두 번째(`AssessmentController`)에,
T-0832 가 세 번째(`ContributionController`)에, T-0833 이 네 번째(`PersonController`)에,
T-0834 가 다섯 번째(`GroupController`)에 S2 collector 를 배선했고, 본 task 는 **여섯 번째
조회 endpoint** 인 `PartController` 의 `GET /api/parts`(findAll — Part 목록 조회)에 같은
harness 를 배선하는 `*.perf-spec.ts` 를 추가한다. harness 가 특정 조회 controller 다섯 개에
국한되지 않고 Part list read 경로까지 재사용됨을 실증한다(REQ-048 조회·시각화 3초 이내
back).

이 endpoint 는 앞선 `GroupController`/`PersonController` 와 동일하게 **`JwtAuthGuard`/`RolesGuard`
를 적용하지 않는다**(part.controller.ts 는 `@UseGuards`/`@Roles` 미부착 — 확인 완료). 따라서
본 perf-spec 은 `overrideGuard` 없이 controller 를 순수 부트스트랩하며, `GET /api/parts` 는
query-param 필수 분기(400)가 없는 단순 list read 라 harness 의 happy-path/error/empty 분류를
guard·query 분기 노이즈 없이 측정한다. non-2xx 분류 실증은 `GET /api/parts/:id`(findById —
row 부재 시 service 가 `NotFoundException` → 404)로 커버한다(group-read/person-read 의 404
실증 패턴 mirror). 신규 외부 dependency 는 0 (supertest 는 기존 devDependency).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2("조회·시각화 read API") / §3 임계 표(p95 < 3s, error rate < 1%) / §4.1 supertest 접근 / §5 follow-up 인덱스.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`·`assertS2Threshold` 시그니처(요청 함수 주입, `now` clock 주입, 2xx/reject 분류).
- [test/perf/group-read.perf-spec.ts](../../test/perf/group-read.perf-spec.ts) — **가장 근접한 mirror 대상**(T-0834, guard 미적용 + query-400 분기 없음 + 404 를 상세 조회로 실증하는 동일 구조). 본 task 는 대상 controller/route/service 만 교체.
- [test/perf/person-read.perf-spec.ts](../../test/perf/person-read.perf-spec.ts) — 참고용(T-0833, guard-free read + negative case 배치 참고).
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`(변경 불요 — 기존 regex 가 신규 파일 자동 매칭).
- [test/perf/README.md](../../test/perf/README.md) — "후속 harness (`*.perf-spec.ts`)" 절(본 task 가 여섯 번째 배선 spec 을 반영해 갱신).
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — `@Controller("api/parts")` `@Get()` `findAll`(guard 미적용, query-param 필수 분기 없음)·`@Get(":id")` `findById`(row 부재 시 service 가 404)·`@Get(":id/persons")` `findPersons`(Part 없으면 404), `GroupService` 대응인 `PartService` 주입.
- [src/user/part.service.ts](../../src/user/part.service.ts) — `create`/`findAll`/`findById`/`findPersonsByPartId`/`update`/`delete` 시그니처(mock 대상 shape 참조 — perf-spec 은 `findAll`·`findById` 만 배선하되 mock 은 필요한 메서드만 jest.fn 으로).

## Acceptance Criteria

perf-spec 은 결정론적이어야 하며(실 DB·실 LLM·외부 I/O 무의존), collector 배선의 정확성을
검증한다. `PartService` 는 mock(`useValue`)으로 대체한다. PartController 는 guard
미적용이므로 `overrideGuard` 는 불필요하다(적용 시 no-op — 넣지 않는 것을 기본으로).
`group-read.perf-spec.ts` 의 구조를 mirror 하되 대상 controller/route/service 만 교체한다.

- [ ] `test/perf/part-read.perf-spec.ts` 신설 — `Test.createTestingModule` 로 `PartController` + mocked `PartService`(필요한 메서드만 jest.fn — 최소 `findAll`·`findById`) 를 부트스트랩하고, `collectLatencySamples(() => request(app.getHttpServer()).get("/api/parts"), N)` 로 반복 호출해 표본을 수집하고 `assertS2Threshold(result).pass` 가 `true` 임을 검증(happy-path).
- [ ] Happy-path unit test: mocked `findAll` 이 정상 배열(200) 을 반환할 때 `collectLatencySamples` 가 `total === N`, `failures === 0`, `samplesMs.length === N` 을 만족하고 `assertS2Threshold` 가 pass(p95 < 3000ms) 임을 검증하는 test 1+.
- [ ] Error path unit test: mocked `findAll` 이 예외를 던져 endpoint 가 non-2xx(예: 500) 를 반환할 때 `collectLatencySamples` 가 해당 호출을 `failures` 로 분류하고 `assertS2Threshold` 가 errorRate 위반 사유(`reasons`)를 담아 `pass === false` 를 반환함을 검증하는 test 1+.
- [ ] Branch/flow cover: `assertS2Threshold` 의 pass 분기와 fail 분기(임계 위반) 각각을 실제 endpoint 호출 결과로 도달시키는 test 각 1+ (위 happy/error 로 충족되면 그 명시로 갈음).
- [ ] Negative cases 충분 cover — 예외 상황 각 1+ test:
  - (a) **빈 결과**: `findAll` 이 `[]` 를 반환(Part 0)해도 latency 수집이 정상 동작(200, `failures === 0`).
  - (b) **404 분기 배선**: `GET /api/parts/:id` 에서 mocked `findById` 이 `NotFoundException` 을 던져 404 를 유발할 때 `collectLatencySamples` 가 이 non-2xx 를 `failures` 로 정확히 분류함을 검증(PartController 의 상세 조회 404 경로 — query-param 400 이 없는 대신 상세 조회 404 로 non-2xx 분류 실증).
  - (c) **mixed 부분 실패**: 다수 호출 중 일부만 실패할 때 `failures` 부분 집계 정확성.
  - (d) **iterations 경계**: `iterations === 1` 등 경계에서 harness 가 깨지지 않음.
- [ ] `pnpm test:perf` 통과 — 신규 perf-spec 이 `jest-perf.json` regex 에 매칭되어 실제로 실행되고 green(기존 summary-read·assessment-read·contribution-read·person-read·group-read perf-spec 과 함께 여섯 다 실행).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — perf-spec 이 기존 unit coverage gate 를 깨지 않음(perf-spec 은 별도 config 이므로 기존 `pnpm test` green 유지도 함께 확인).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `test/perf/README.md` 의 harness 절을 갱신 — 이제 여섯 개의 실 perf-spec(summary-read + assessment-read + contribution-read + person-read + group-read + part-read) 이 존재함을 반영(파일명·실행법·mock 으로 DB 무의존임을 1~3줄로 명시; PartController 는 guard 미적용이라 override 불요임을 짧게 언급).
- [ ] 신규 외부 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(supertest 는 기존 devDependency).

## Out of Scope

- 실 DB(Postgres) 를 띄운 진짜 round-trip latency 측정 — 본 task 는 harness **배선 검증**이지 baseline 실측이 아니다(baseline 은 §5 item 5 별도 follow-up).
- S1(평가 배치 1h)·S3(동시성 내성) harness — 신규 부하 발생기(k6 등)를 요구하므로 §5 item 1/3 별도 task(owner 승인 BLOCKED).
- k6/artillery/autocannon 등 신규 dependency 도입 — CLAUDE.md §5 BLOCKED, ADR-0054 owner 승인 후 별도 pr-task.
- `.github/workflows/` 에 perf job 상시 편입 — §5 item 4 별도 task(부하는 무거워 PR CI 와 분리).
- PLAN.md line148 checkbox flip — harness 전체 완결 전까지 `[ ]` 유지(본 task 는 slice 6).
- `assertS2Threshold`/`collectLatencySamples` 순수 로직 자체 변경 — 이미 T-0828/T-0829 에서 spec 완료. 본 task 는 그 primitive 를 **호출·배선**만 한다.
- `summary-read`·`assessment-read`·`contribution-read`·`person-read`·`group-read` perf-spec 변경 — file-disjoint 유지(본 task 는 신규 `part-read.perf-spec.ts` 만 추가).
- POST/PATCH/DELETE 등 write route perf 배선 — 본 task 는 조회 `findAll`(+ 404 실증용 `findById`)에 집중(추가 route 는 후속 slice).
- `GET /api/parts/:id/persons`(findPersons) 배선 — 본 task 는 findAll 을 주 measure 로, findById 를 404 실증으로 커버(findPersons 는 후속 slice 후보).
- User read endpoint 배선 — 다음 slice 후보(별도 task).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
