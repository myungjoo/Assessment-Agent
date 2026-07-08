---
id: T-0836
title: S2 조회 latency harness 를 일곱 번째 조회 endpoint(UserController)에 배선하는 perf-spec 신설
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-07-09
independentStream: p8-load-resilience-s2
dependsOn: [T-0828, T-0829, T-0830]
touchesFiles:
  - test/perf/user-read.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 line148 부하·내성 follow-up #7(load-resilience-test-plan §5-2) — S2 collector 를 일곱 번째 조회 endpoint(UserController findAll @Roles(Admin) guarded read)에 배선, 첫 guarded-list perf-spec(overrideGuard 필요), 신규 dep 0"
---

# T-0836 — S2 조회 latency harness 를 일곱 번째 조회 endpoint(UserController)에 배선하는 perf-spec 신설

## Why

[docs/PLAN.md](../PLAN.md) P8 line148(부하·내성 테스트) 의 follow-up chain 이자
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 item 2("S2
조회 latency 경량 harness — supertest 기반, 신규 dependency 불요")의 다음 slice 다. T-0830
이 첫 조회 controller(`SummaryController`)에, T-0831~T-0835 가 순서대로
`AssessmentController`·`ContributionController`·`PersonController`·`GroupController`·`PartController`
에 S2 collector 를 배선했고, 본 task 는 **일곱 번째 조회 endpoint** 인 `UserController` 의
`GET /api/users`(findAll — 사용자 목록 조회, REQ-086 User read-only whitelist read)에 같은
harness 를 배선하는 `*.perf-spec.ts` 를 추가한다.

앞선 group/part/person 세 slice 는 모두 **guard 미적용** read 였다. `UserController` 의
`GET /api/users` findAll 은 반대로 `@UseGuards(JwtAuthGuard, RolesGuard)` +
`@Roles("Admin")` 로 **가드가 부착된 첫 조회 endpoint** 다(REQ-044/045 Admin tier 게이트).
따라서 본 perf-spec 은 앞선 `summary-read.perf-spec.ts`(가드 부착 + `overrideGuard` 사용)
패턴을 mirror 해 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를
무력화하고 controller 를 결정론적으로 부트스트랩한다. harness 가 guard 미적용 read 뿐 아니라
**가드가 부착된 list read 경로**까지 재사용됨을 실증한다(REQ-048 조회·시각화 3초 이내 back).
non-2xx 분류 실증은 `GET /api/users/:id`(findById — row 부재 시 service 가
`NotFoundException` → 404)로 커버한다(person-read 의 404 실증 패턴 mirror). 신규 외부
dependency 는 0 (supertest 는 기존 devDependency).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2("조회·시각화 read API") / §3 임계 표(p95 < 3s, error rate < 1%) / §4.1 supertest 접근 / §5 follow-up 인덱스.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`·`assertS2Threshold` 시그니처(요청 함수 주입, `now` clock 주입, 2xx/reject 분류).
- [test/perf/summary-read.perf-spec.ts](../../test/perf/summary-read.perf-spec.ts) — **가장 근접한 mirror 대상**(T-0830, guard 부착 + `overrideGuard` 사용하는 첫 spec — 본 task 도 가드 부착 endpoint 이므로 이 구조를 따른다). 대상 controller/route/service 만 교체.
- [test/perf/person-read.perf-spec.ts](../../test/perf/person-read.perf-spec.ts) — 참고용(T-0833, 404 를 상세 조회로 실증하는 negative 패턴).
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`(변경 불요 — 기존 regex 가 신규 파일 자동 매칭).
- [test/perf/README.md](../../test/perf/README.md) — "후속 harness (`*.perf-spec.ts`)" 절(본 task 가 일곱 번째 배선 spec 을 반영해 갱신).
- [src/user/user.controller.ts](../../src/user/user.controller.ts) — `@Controller("api/users")` `@Get()` `findAll`(`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, `userService.findAll()` raw forward)·`@Get(":id")` `findById`(`@UseGuards(JwtAuthGuard)`, row 부재 시 service 가 404, self-vs-admin 분기)·`@Patch(":id")` `@Roles("SuperAdmin")`(범위 밖), `UserService` 주입.
- [src/user/user.service.ts](../../src/user/user.service.ts) — `findAll`/`findById` 시그니처(mock 대상 shape 참조 — perf-spec 은 `findAll`·`findById` 만 배선하되 mock 은 필요한 메서드만 jest.fn 으로).

## Acceptance Criteria

perf-spec 은 결정론적이어야 하며(실 DB·실 LLM·외부 I/O 무의존), collector 배선의 정확성을
검증한다. `UserService` 는 mock(`useValue`)으로 대체한다. UserController 의 `GET /api/users`
는 `JwtAuthGuard`+`RolesGuard`+`@Roles("Admin")` 가 부착돼 있으므로
`summary-read.perf-spec.ts` 처럼 `overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })`
및 `overrideGuard(RolesGuard).useValue({ canActivate: () => true })` 로 가드를 무력화한다.
`summary-read.perf-spec.ts` 의 구조를 mirror 하되 대상 controller/route/service 만 교체한다.

- [ ] `test/perf/user-read.perf-spec.ts` 신설 — `Test.createTestingModule` 로 `UserController` + mocked `UserService`(필요한 메서드만 jest.fn — 최소 `findAll`·`findById`) 를 부트스트랩하고 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한 뒤, `collectLatencySamples(() => request(app.getHttpServer()).get("/api/users"), N)` 로 반복 호출해 표본을 수집하고 `assertS2Threshold(result).pass` 가 `true` 임을 검증(happy-path).
- [ ] Happy-path unit test: mocked `findAll` 이 정상 배열(200) 을 반환할 때 `collectLatencySamples` 가 `total === N`, `failures === 0`, `samplesMs.length === N` 을 만족하고 `assertS2Threshold` 가 pass(p95 < 3000ms) 임을 검증하는 test 1+.
- [ ] Error path unit test: mocked `findAll` 이 예외를 던져 endpoint 가 non-2xx(예: 500) 를 반환할 때 `collectLatencySamples` 가 해당 호출을 `failures` 로 분류하고 `assertS2Threshold` 가 errorRate 위반 사유(`reasons`)를 담아 `pass === false` 를 반환함을 검증하는 test 1+.
- [ ] Branch/flow cover: `assertS2Threshold` 의 pass 분기와 fail 분기(임계 위반) 각각을 실제 endpoint 호출 결과로 도달시키는 test 각 1+ (위 happy/error 로 충족되면 그 명시로 갈음).
- [ ] Negative cases 충분 cover — 예외 상황 각 1+ test:
  - (a) **빈 결과**: `findAll` 이 `[]` 를 반환(User 0)해도 latency 수집이 정상 동작(200, `failures === 0`).
  - (b) **404 분기 배선**: `GET /api/users/:id` 에서 mocked `findById` 이 `NotFoundException` 을 던져 404 를 유발할 때 `collectLatencySamples` 가 이 non-2xx 를 `failures` 로 정확히 분류함을 검증(UserController 의 상세 조회 404 경로 — guarded list 대신 상세 조회 404 로 non-2xx 분류 실증).
  - (c) **mixed 부분 실패**: 다수 호출 중 일부만 실패할 때 `failures` 부분 집계 정확성.
  - (d) **iterations 경계**: `iterations === 1` 등 경계에서 harness 가 깨지지 않음.
- [ ] `pnpm test:perf` 통과 — 신규 perf-spec 이 `jest-perf.json` regex 에 매칭되어 실제로 실행되고 green(기존 summary/assessment/contribution/person/group/part-read perf-spec 과 함께 일곱 다 실행).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — perf-spec 이 기존 unit coverage gate 를 깨지 않음(perf-spec 은 별도 config 이므로 기존 `pnpm test` green 유지도 함께 확인).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `test/perf/README.md` 의 harness 절을 갱신 — 이제 일곱 개의 실 perf-spec(summary + assessment + contribution + person + group + part + user-read) 이 존재함을 반영(파일명·실행법·mock 으로 DB 무의존임을 1~3줄로 명시; UserController 는 가드 부착이라 `overrideGuard` 필요임을 짧게 언급).
- [ ] 신규 외부 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(supertest 는 기존 devDependency).

## Out of Scope

- 실 DB(Postgres) 를 띄운 진짜 round-trip latency 측정 — 본 task 는 harness **배선 검증**이지 baseline 실측이 아니다(baseline 은 §5 item 5 별도 follow-up).
- S1(평가 배치 1h)·S3(동시성 내성) harness — 신규 부하 발생기(k6 등)를 요구하므로 §5 item 1/3 별도 task(owner 승인 BLOCKED).
- k6/artillery/autocannon 등 신규 dependency 도입 — CLAUDE.md §5 BLOCKED, ADR-0054 owner 승인 후 별도 pr-task.
- `.github/workflows/` 에 perf job 상시 편입 — §5 item 4 별도 task(부하는 무거워 PR CI 와 분리).
- PLAN.md line148 checkbox flip — harness 전체 완결 전까지 `[ ]` 유지(본 task 는 slice 7).
- `assertS2Threshold`/`collectLatencySamples` 순수 로직 자체 변경 — 이미 T-0828/T-0829 에서 spec 완료. 본 task 는 그 primitive 를 **호출·배선**만 한다.
- `summary`·`assessment`·`contribution`·`person`·`group`·`part`-read perf-spec 변경 — file-disjoint 유지(본 task 는 신규 `user-read.perf-spec.ts` 만 추가).
- POST/PATCH/DELETE 등 write route perf 배선 — 본 task 는 조회 `findAll`(+ 404 실증용 `findById`)에 집중(추가 route 는 후속 slice).
- `@Get(":id")` 의 self-vs-admin 접근 분기 자체의 정책 검증 — 본 task 는 latency 배선만(접근 정책은 기존 user.controller.spec.ts 가 커버).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
