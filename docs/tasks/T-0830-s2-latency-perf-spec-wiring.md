---
id: T-0830
title: S2 조회 latency harness 를 실제 조회 endpoint 에 배선하는 첫 perf-spec 신설
phase: P8
status: DONE
commitMode: pr
mergedAs: 67f9bb06
prNumber: 724
reviewRounds: 1
completedAt: 2026-07-08T09:52:00Z
coversReq: [REQ-048]
estimatedDiff: 160
estimatedFiles: 3
created: 2026-07-08
independentStream: p8-load-resilience-s2
dependsOn: [T-0828, T-0829]
touchesFiles:
  - test/perf/summary-read.perf-spec.ts
  - test/perf/README.md
  - test/perf/jest-perf.json
plannerNote: "P8 line148 부하·내성 follow-up #2(load-resilience-test-plan §5-2) — S2 collector 를 supertest·Nest 앱에 배선하는 첫 *.perf-spec.ts, 신규 dep 0"
---

# T-0830 — S2 조회 latency harness 를 실제 조회 endpoint 에 배선하는 첫 perf-spec 신설

## Why

[docs/PLAN.md](../PLAN.md) P8 line148(부하·내성 테스트) 의 follow-up chain 이자
[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 item 2("S2
조회 latency 경량 harness — supertest 기반, 신규 dependency 불요")의 다음 slice 다. T-0828
(percentile/summarizeLatency/errorRate 순수 primitive)·T-0829(collectLatencySamples/
assertS2Threshold 순수 orchestration)가 순수 로직만 신설했고 실제 요청 함수 배선은 미완이다.
본 task 는 그 collector 를 **실제 Nest 조회 controller + supertest** 에 배선하는 **첫
`*.perf-spec.ts`** 를 신설해 S2(REQ-048, 조회 p95 < 3s) 측정 harness 를 end-to-end 로 검증
가능하게 만든다. 신규 외부 dependency 는 0 (supertest 는 기존 devDependency).

`jest-perf.json` 은 현재 `*.perf-spec.ts` 매칭 0 으로 `passWithNoTests: true` scaffold
상태다 — 본 task 가 그 첫 실 spec 을 채워 `pnpm test:perf` 가 실제 검증을 수행하게 한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2 / §3 임계 표 / §4.1 supertest 접근 / §5 follow-up 인덱스.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples`·`assertS2Threshold` 시그니처(요청 함수 주입, `now` clock 주입).
- [test/perf/latency-collector.spec.ts](../../test/perf/latency-collector.spec.ts) — 순수 primitive 사용 패턴 참조.
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$`, `maxWorkers: 1`, `passWithNoTests`.
- [test/perf/README.md](../../test/perf/README.md) — "후속 harness (DB-backed `*.perf-spec.ts`)" 절(본 task 가 채운다).
- [test/e2e/summaries.e2e-spec.ts](../../test/e2e/summaries.e2e-spec.ts) — Nest 앱 부트스트랩 + 가드 override + supertest 패턴 참조.
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) — `@Controller("api/summaries")` `@Get()`·`@Get(":id")`, `JwtAuthGuard`/`RolesGuard`, `SummaryService` 주입.

## Acceptance Criteria

첫 실 perf-spec 은 결정론적이어야 하며(실 DB·실 LLM·외부 I/O 무의존), collector 배선의
정확성을 검증한다. `SummaryService` 는 mock, 가드는 `overrideGuard` 로 통과시켜 순수
harness 배선만 측정한다.

- [ ] `test/perf/summary-read.perf-spec.ts` 신설 — `Test.createTestingModule` 로 `SummaryController` + mocked `SummaryService` 를 부트스트랩하고, `JwtAuthGuard`/`RolesGuard` 를 `overrideGuard(...).useValue({ canActivate: () => true })` 로 통과시킨 뒤, `collectLatencySamples(() => request(app.getHttpServer()).get("/api/summaries").set(...), N)` 로 반복 호출해 표본을 수집하고 `assertS2Threshold(result).pass` 가 `true` 임을 검증(happy-path).
- [ ] Happy-path: mocked service 가 정상 응답(200) 을 반환할 때 `collectLatencySamples` 가 `total === N`, `failures === 0`, `samplesMs.length === N` 을 만족하고 `assertS2Threshold` 가 pass(p95 < 3000ms) 임을 검증하는 test 1+.
- [ ] Error path: mocked service 가 예외를 던져 endpoint 가 non-2xx(예: 500) 를 반환할 때 `collectLatencySamples` 가 해당 호출을 `failures` 로 분류하고 `assertS2Threshold` 가 errorRate 위반 사유(`reasons`)를 담아 `pass === false` 를 반환함을 검증하는 test 1+.
- [ ] Branch/flow cover: `assertS2Threshold` 의 pass 분기와 fail 분기(임계 위반) 각각을 실제 endpoint 호출 결과로 도달시키는 test 각 1+ (위 happy/error 로 충족되면 그 명시로 갈음).
- [ ] Negative cases 충분 cover: (a) 빈 결과(service 가 `[]` 반환) 에서도 latency 수집이 정상 동작, (b) 다수 호출 중 일부만 실패(mixed) 일 때 `failures` 부분 집계 정확성, (c) `iterations` 경계(예: 1 회) 에서 harness 가 깨지지 않음 — 예외 상황 각 1+ test.
- [ ] `pnpm test:perf` 통과 — 신규 perf-spec 이 `jest-perf.json` regex 에 매칭되어 실제로 실행되고 green(더 이상 `passWithNoTests` 로 skip 되지 않음).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — perf-spec 이 기존 unit coverage gate 를 깨지 않음(perf-spec 이 별도 config 라면 기존 `pnpm test` green 유지도 함께 확인).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `test/perf/README.md` 의 "후속 harness (DB-backed `*.perf-spec.ts`)" 절을 갱신 — 이제 첫 실 perf-spec 이 존재함을 반영(파일명·실행법·mock/guard-override 로 DB 무의존임을 1~3줄로 명시).
- [ ] 신규 외부 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(supertest 는 기존 devDependency).

## Out of Scope

- 실 DB(Postgres) 를 띄운 진짜 round-trip latency 측정 — 본 task 는 harness **배선 검증**이지 baseline 실측이 아니다(baseline 은 §5 item 5 별도 follow-up).
- S1(평가 배치 1h)·S3(동시성 내성) harness — 신규 부하 발생기(k6 등)를 요구하므로 §5 item 1/3 별도 task(owner 승인 BLOCKED).
- k6/artillery/autocannon 등 신규 dependency 도입 — CLAUDE.md §5 BLOCKED, ADR-0054 owner 승인 후 별도 pr-task.
- `.github/workflows/` 에 perf job 상시 편입 — §5 item 4 별도 task(부하는 무거워 PR CI 와 분리).
- PLAN.md line148 checkbox flip — harness 전체 완결 전까지 `[ ]` 유지(본 task 는 slice 1).
- `assertS2Threshold`/`collectLatencySamples` 순수 로직 자체 변경 — 이미 T-0828/T-0829 에서 spec 완료. 본 task 는 그 primitive 를 **호출·배선**만 한다.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
