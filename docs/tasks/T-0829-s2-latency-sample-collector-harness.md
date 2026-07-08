---
id: T-0829
title: S2 조회 latency 반복-호출 표본 수집기 harness 신설 (T-0828 primitive 조합, 신규 dep 0)
phase: P8
status: DONE
mergedAs: 44b6ef9b
prNumber: 723
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 150
estimatedFiles: 4
created: 2026-07-08
independentStream: p8-load-resilience
dependsOn: []
touchesFiles: [test/perf/latency-collector.ts, test/perf/latency-collector.spec.ts, test/perf/README.md]
plannerNote: "P8 line148 부하·내성 follow-up #2 후속 — T-0828 primitive 를 조합하는 표본 수집 loop + 임계 판정 helper(순수 로직, DB 무의존, 신규 dep 0)"
---

# T-0829 — S2 조회 latency 반복-호출 표본 수집기 harness 신설

## Why

PLAN.md P8 line148 부하·내성 테스트의 follow-up([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 #2 "S2 조회 latency 경량 harness")의 다음 slice다. T-0828 이 표본 배열 → 지표 산출 **순수 함수 primitive**(`percentile`/`summarizeLatency`/`errorRate`)를 신설했으나, 실제 measure 는 "요청을 반복 호출해 latency 표본을 **수집**"하는 단계가 빠져 있다. 본 task 는 그 빠진 연결 고리 — async 요청 함수를 N회 호출하며 monotonic clock 으로 각 호출을 계측하고 2xx/non-2xx 를 분류해 `{ samplesMs, total, failures }` 를 모으는 수집기 + T-0828 primitive 를 조합해 REQ-048(p95 < 3s) pass/fail 을 판정하는 helper 를 신설한다. 요청 함수를 인자로 주입받는 **순수 orchestration 로직**이라 DB·앱 부트스트랩·네트워크에 무의존하며, 후속 DB-backed `*.perf-spec.ts` harness 는 이 수집기에 supertest 호출 함수만 넘기면 된다. 신규 dependency 0(k6 등은 ADR-0054 owner 승인 후 별도 task — 본 task 범위 밖).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2, §3 임계 표(p95 < 3s, error rate < 1%), §5 follow-up #2.
- [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) — 조합할 primitive: `summarizeLatency(samplesMs) → { p50, p95, p99, count, maxMs }`, `errorRate(total, failures) → 0~1`, `LatencySummary` interface.
- [test/perf/latency-metrics.spec.ts](../../test/perf/latency-metrics.spec.ts) — colocated spec 패턴(R-112 4종 구조) 참고.
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `*.perf-spec.ts` 매칭 scaffold(본 task 는 `*.spec.ts` 순수 unit 만 추가 — perf-spec 은 후속).
- [test/perf/README.md](../../test/perf/README.md) — 갱신 대상(수집기 사용법 추가).
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md) — S2 는 기존 supertest 2-계층 measure(발생기 도입 없음) 배경.

## Acceptance Criteria

- [ ] `test/perf/latency-collector.ts` 신설 — 다음 순수 로직 함수 export:
  - `collectLatencySamples(request, iterations, opts?)` — `request: () => Promise<{ ok: boolean }>`(또는 status code 반환) 형태의 async 요청 함수를 `iterations` 회 순차 호출하며 각 호출을 monotonic clock(`performance.now()` 또는 주입 가능한 `now`)으로 계측, `{ samplesMs: number[], total: number, failures: number }` 반환. 2xx 판정은 요청 함수가 넘긴 ok/status 기준. clock 은 테스트 주입 가능하도록 `opts.now?` 로 옵션화(결정론적 테스트).
  - `assertS2Threshold(result, thresholds?)` — 위 결과를 `summarizeLatency` + `errorRate` 로 요약해 `{ pass: boolean, summary: LatencySummary, errorRate: number, reasons: string[] }` 반환. 기본 임계: p95 < 3000ms(REQ-048), errorRate < 0.01(§3). 임계 위반 사유를 `reasons` 에 한국어로 축적(throw 하지 않고 판정 결과만 반환 — 호출부가 expect 로 검증).
- [ ] `test/perf/latency-collector.spec.ts` (colocated) 신설 — R-112 4종:
  - happy-path: 정상 요청 함수 N회 호출 → `samplesMs.length === iterations`, `failures === 0`, `assertS2Threshold` 가 낮은 latency stub 에서 `pass === true`.
  - error path: non-2xx 반환 요청 함수 → `failures` 정확 카운트, errorRate 반영. 요청 함수가 reject(throw)하는 경우도 failure 로 집계되는지(또는 명시적 정책) 검증.
  - branch: `iterations === 0`(빈 표본 → summarizeLatency NaN 경로) / p95 임계 초과 / errorRate 임계 초과 각 분기 1+ test. `assertS2Threshold` 의 pass=true 와 pass=false 양 분기 cover.
  - negative cases 충분: `iterations` 음수·비정수·0, 주입 clock 이 비단조(감소)일 때 방어, 요청 함수 미제공/비함수, thresholds 비정상 값 — 예외 처리 분기마다 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 신규 파일이 임계를 끌어내리지 않음.
- [ ] `pnpm lint && pnpm build && pnpm test` 회귀 없음(R-110).
- [ ] `test/perf/README.md` 에 수집기 사용법 절 추가(≤15줄) — `collectLatencySamples` + `assertS2Threshold` 시그니처 + supertest 조합 예시(후속 `*.perf-spec.ts` 가 어떻게 쓰는지). 기존 primitive 절 무손상.
- [ ] 신규 dependency 0 — `package.json`/`pnpm-lock.yaml` 무변경(`git diff` 로 확인).

## Out of Scope

- 실 DB-backed `*.perf-spec.ts` harness(app 부트스트랩 + 실 조회 endpoint round-trip) — 별도 follow-up. 본 task 는 요청 함수 주입 기반 순수 수집 로직만.
- k6/artillery/autocannon 등 신규 부하 발생기 도입(ADR-0054 owner 승인 후 별도 pr-task). BLOCKED 회피.
- CI workflow(`.github/workflows/`) 변경 — perf job 편입은 follow-up #4.
- S1(배치 부하)·S3(동시성 내성) harness — 신규 도구 필요(§4.2).
- PLAN.md line148 checkbox flip — harness 전체(DB-backed 포함) 미완이라 `[ ]` 유지.
- §3 임계 baseline 실측·fix(follow-up #5).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(none yet)
