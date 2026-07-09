---
id: T-0860
title: S2 latency harness 에 throughput(req/s) 집계 순수 함수 추가
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 140
estimatedFiles: 3
created: 2026-07-09
independentStream: s2-perf-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-metrics.ts
  - test/perf/latency-metrics.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §3 관찰지표 미커버 throughput(req/s) 채움 — 30 endpoint 배선 완결 후 primitive 확장으로 시리즈 자연 이행"
---

# T-0860 — S2 latency harness 에 throughput(req/s) 집계 순수 함수 추가

## Why

[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §3 (측정 지표) 은 S2
조회 지연의 관찰 지표로 "latency 는 percentile, **throughput 은 req/s**, error rate 는
non-2xx / 전체" 를 명시하고, §3 임계 표의 "S2 조회 지연 | p50 latency / **throughput**"
행을 관찰용으로 둔다. 그러나 현재 `test/perf/latency-metrics.ts` 의 `LatencySummary` 는
p50/p95/p99/count/maxMs 만 산출하고 **throughput(req/s) 은 미커버**다. 30 개 read
endpoint 배선(T-0830~T-0859)이 exhaustive 하게 완결됐으므로, 시리즈의 자연스러운 다음
단계는 endpoint 추가가 아니라 **§3 이 명시했으나 아직 primitive 에 없는 throughput 지표를
순수 함수로 채우는 것**이다. REQ-048(조회·시각화 3초 이내, `perf` 검증)의 관찰 back 을
넓힌다.

## Required Reading

- `test/perf/latency-metrics.ts` — throughput 함수를 추가할 대상 primitive(percentile /
  summarizeLatency / errorRate 순수 함수 모음).
- `test/perf/latency-metrics.spec.ts` — colocated unit spec. 신규 throughput 함수의
  happy/error/branch/negative test 를 여기에 추가한다(신규 spec 파일 신설 아님 — 기존
  colocated spec 확장).
- `test/perf/README.md` — §"측정 primitive (`latency-metrics.ts`)" 절에 throughput 함수
  1 줄 설명을 추가할 대상.
- `docs/ops/load-resilience-test-plan.md` §3 — throughput 관찰 지표 근거(읽기만; 수정 불요).

## Acceptance Criteria

- [ ] `test/perf/latency-metrics.ts` 에 순수 함수 `throughput(count, elapsedMs)` 추가 —
      성공 요청 수(count) 와 총 wall-clock 경과(elapsedMs) 를 받아 초당 요청 수(req/s,
      `count / (elapsedMs / 1000)`) 를 반환하는 **DB·네트워크 무의존 순수 함수**. 기존
      `errorRate` 와 동형의 입력 검증(음수·비정수·NaN 방어)을 갖춘다.
- [ ] `elapsedMs === 0` 방어 분기 — 경과 0 에서 0 나눗셈으로 `Infinity` 를 뱉지 않도록
      명시 정책(예: `count === 0` 이면 `0`, `count > 0` 이고 `elapsedMs === 0` 이면
      `RangeError` throw 또는 문서화된 sentinel). 정책은 함수 docstring 에 한국어로 명시.
- [ ] happy-path unit test 1+ — 정상 입력(예: 30 요청 / 1500ms → 20 req/s)에서 기대 수치
      반환을 `latency-metrics.spec.ts` 에서 검증.
- [ ] error path unit test 1+ — 음수 count / 음수 elapsedMs / 비정수 / NaN 입력에서
      `RangeError`(또는 `TypeError`) throw 를 검증(기존 `errorRate` spec 스타일 mirror).
- [ ] branch 별 test 분리 — `count === 0` 분기(→ 0), `elapsedMs === 0` 방어 분기,
      정상 나눗셈 분기 각 1+ test.
- [ ] negative cases 충분 cover — 음수 count, 음수 elapsedMs, 소수 count(비정수),
      `NaN` 입력, (정책상 throw 라면) `count>0 && elapsedMs===0` 등 예외 상황 **각 1+
      test**. 단일 negative 만 금지.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). throughput 함수와 그 분기가
      coverage 에 포함되는지 확인(latency-metrics.spec.ts 는 `.spec.ts$` 매칭이라 기본
      `pnpm test` coverage 에 잡힘).
- [ ] `pnpm lint && pnpm build && pnpm test:perf` 통과(회귀 무영향 — 기존 30 perf-spec
      green 유지).
- [ ] `test/perf/README.md` §"측정 primitive" 절에 `throughput(count, elapsedMs)` 1 줄
      설명 추가(§3 throughput 관찰 지표 대응 명시).

## Out of Scope

- `latency-collector.ts` 의 `CollectResult` / `collectLatencySamples` 시그니처 변경 금지 —
  본 task 는 metrics primitive 에 순수 함수 1 개만 추가한다. collector 가 wall-clock
  총 경과를 수집·throughput 을 배선하는 것은 별도 follow-up.
- 30 개 `*.perf-spec.ts` 파일 수정 금지 — 배선 spec 은 건드리지 않는다.
- `LatencySummary` 인터페이스에 throughput 필드 추가 금지(summarizeLatency 는 표본만 받고
  경과 시간을 모름 — throughput 은 독립 함수로 둔다). summary 통합은 follow-up.
- `load-resilience-test-plan.md` §3 표 수정 금지(이미 throughput 관찰 지표를 명시하고 있음).
- 실 DB round-trip baseline 측정·임계 fix 금지(§5 follow-up #5).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 추가)
