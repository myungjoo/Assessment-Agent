---
id: T-0847
title: S2 조회 latency harness 를 PersonController :id detail-read 에 배선하는 열여덟 번째 perf-spec 신설
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
independentStream: s2-latency-perf-wiring
dependsOn: []
touchesFiles: [test/perf/person-detail-read.perf-spec.ts]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-07-09
plannerNote: "P8 load-resilience §5 follow-up #2 (S2 latency harness) — T-0846(assessment :id) 다음 detail(:id) slice, PersonController GET /api/persons/:id 배선 (guard 미적용, T-0845 group-detail mirror)"
---

# T-0847 — S2 조회 latency harness 를 PersonController :id detail-read 에 배선하는 열여덟 번째 perf-spec 신설

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up #2 (S2 조회 latency 경량 harness) 의 endpoint 배선 backlog 를 한 slice 더 진행한다. T-0828/T-0829 가 신설한 latency primitive/collector 를, T-0830~T-0846 가 17 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment :id detail 3)에 배선했다. 본 task 는 **열여덟 번째 slice** 로 `PersonController` 의 detail(:id) read `GET /api/persons/:id` (`findOne` → `service.findById(id)`, row 부재 시 `NotFoundException`→404) 에 collector 를 배선해, T-0846(assessment :id) 에 이어 **네 번째 path-param `:id` detail read** 이자 첫 Person entity 상세 조회 경로에서 harness 재사용을 실증한다. PersonController 는 guard 미적용이라 T-0845(group :id detail) 의 guard-free 부트스트랩 패턴을 mirror 한다. REQ-048 (조회·시각화 3초 이내, `perf` 검증) 을 back 한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §5 follow-up 인덱스, S2 시나리오·임계 (p95 < 3s, error rate < 1%).
- [test/perf/group-detail-read.perf-spec.ts](../../test/perf/group-detail-read.perf-spec.ts) — 직전 guard-free detail(:id) slice(T-0845), guard 미적용 :id read 배선 패턴 (mirror 대상).
- [test/perf/person-read.perf-spec.ts](../../test/perf/person-read.perf-spec.ts) — Person list 배선(T-0833), PersonController 는 guard 미적용 부트스트랩 패턴 참조.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처.
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — `@Get(":id") findOne` 핸들러 (line 60~63), guard 미적용, `service.findById(id)` raw forward.

## Acceptance Criteria

- [ ] `test/perf/person-detail-read.perf-spec.ts` 신설. `PersonController` 를 부트스트랩하고 `PersonService` 를 mock(`useValue`) 으로 주입, `GET /api/persons/:id` 를 `collectLatencySamples` 로 반복 호출하는 perf-spec 작성. PersonController 는 guard 미적용이므로 `overrideGuard` 없이 순수 부트스트랩 (group-detail-read.perf-spec.ts / person-read.perf-spec.ts 패턴).
- [ ] **Happy-path test**: mock `findById` 가 단일 Person 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, `service.findById` 가 N회 호출됨 검증.
- [ ] **Error path test**: mock `findById` 가 `NotFoundException` throw → endpoint 404 → 전부 failures, `assertS2Threshold` pass===false + "error rate 임계 초과" 사유 포함 검증.
- [ ] **Flow / branch coverage**: collector 의 성공(2xx)/실패(non-2xx) 분기를 각각 1+ test 로 도달 (happy=200 분기, error=404/500 분기).
- [ ] **Negative cases 충분 cover** — 최소 4 종: (a) 존재하지 않는 id 조회 → `NotFoundException`(404) failures 분류, (b) 일반 `Error` → 500 (404 와 구분되는 non-2xx), (c) mixed 부분 실패 (N회 중 1회만 404 → `failures===1` 부분 집계 정확 + `errorRateMax:0` 로도 fail), (d) `iterations===1` 경계에서 harness 정상 동작.
- [ ] `pnpm test:perf` 실행 시 신규 spec 포함 전 perf-spec suite green (jest-perf.json `testRegex` 매칭 확인).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). perf-spec 은 기본 `pnpm test` (`.spec.ts$`) 매칭 밖이라 coverage 회귀 무영향임을 확인.

## Out of Scope

- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 도입 / CI perf job 상시 편입 (§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- POST/PATCH/DELETE 등 write route perf 배선 — 본 spec 은 detail(:id) 조회(findById)에 집중.
- 다른 미배선 detail(:id) endpoint(part/user/contribution/import/export/llm-config :id) 및 sub-resource read(예: `/api/parts/:id/persons`) 배선 — 각각 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
