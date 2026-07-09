---
id: T-0861
title: S2 latency collector 에 wall-clock 총 경과 수집 + throughput(req/s) 배선
phase: P8
status: DONE
mergedAs: cf80540b
prNumber: 755
completedAt: 2026-07-09T16:08:00Z
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: [T-0860]
touchesFiles:
  - test/perf/latency-collector.ts
  - test/perf/latency-collector.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §3 throughput(req/s) 관찰지표를 collector orchestration 에 배선 — T-0860 primitive 를 CollectResult.elapsedMs + S2Assertion.throughput 으로 통합(T-0860 Out of Scope 이월 follow-up)"
---

# T-0861 — S2 latency collector 에 wall-clock 총 경과 수집 + throughput(req/s) 배선

## Why

P8 부하·내성 테스트 계획([docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §2 S2 / §3)은
S2 조회 지연의 **관찰 지표**로 p50/p95/p99 latency + error rate 와 함께 **throughput(req/s)** 를 명시한다.
T-0860 이 `throughput(count, elapsedMs)` 순수 함수를 `latency-metrics.ts` 에 신설했으나, collector
orchestration 은 아직 이를 산출하지 못한다 — `CollectResult` 가 총 wall-clock 경과를 담지 않고
`assertS2Threshold` 의 `S2Assertion` 이 throughput 을 노출하지 않기 때문이다. 본 task 는 T-0860 이
Out of Scope 로 명시 이월한 follow-up(collector wall-clock 경과 수집 + throughput 배선)을 처리해,
§3 관찰 지표 3종(latency / error rate / throughput)이 harness 출력에서 모두 관찰 가능하도록 완결한다.

## Required Reading

- `test/perf/latency-collector.ts` — 배선 대상. `CollectResult`(samplesMs/total/failures) 에 총 경과
  필드 추가 + `assertS2Threshold` 의 `S2Assertion` 에 throughput 추가.
- `test/perf/latency-metrics.ts` — T-0860 이 추가한 `throughput(count, elapsedMs)` 순수 함수 시그니처·
  0 나눗셈 방어 정책(count=0→0, count>0&&elapsedMs=0→RangeError) 확인.
- `test/perf/latency-collector.spec.ts` — 기존 collector 순수 spec. throughput 배선 test 를 여기에 추가.
- `test/perf/README.md` — §"측정 primitive"/orchestration 절. throughput 배선 1 줄 반영.

## Acceptance Criteria

- [ ] `collectLatencySamples` 가 전체 반복의 **총 wall-clock 경과(ms)** 를 monotonic clock 으로 측정해
      `CollectResult` 에 `elapsedMs: number` 필드로 담는다 — 첫 요청 시작 직전 `now()` 와 마지막 요청
      종료 직후 `now()` 의 차(단조 증가 가정). iterations=0 이면 `elapsedMs === 0`.
- [ ] `S2Assertion` 에 `throughput: number` 필드 추가 — `assertS2Threshold` 가 `throughput(성공표본수,
      result.elapsedMs)` 로 산출한 관찰값(req/s)을 담는다. 성공 표본수는 `summary.count`(= samplesMs.length).
      throughput 은 **관찰 전용** — pass/fail 판정에는 넣지 않는다(§3 표: throughput 은 "baseline 후 fix"
      관찰 지표).
- [ ] `throughput` 산출 시 T-0860 primitive 의 0 나눗셈 방어가 collector 레벨에서 안전하게 흐르도록
      배선 — 성공 표본 0(count=0)이면 throughput=0, count>0 인데 elapsedMs=0 인 이론적 경계는 primitive
      가 RangeError 를 던지므로, collector 는 이 경계를 회피(성공 표본이 있으면 elapsedMs>0 가 보장되는
      단조 clock 전제) 하거나 명시적으로 처리한다 — 선택한 정책을 주석에 1 줄 명시.
- [ ] Happy-path unit test 1+ — 정상 수집 결과(성공 표본 N개 + 주입 clock 으로 고정 elapsedMs)에서
      `assertS2Threshold` 가 기대 throughput(= count / (elapsedMs/1000))을 반환하고 pass 판정을 유지함을
      검증. `CollectResult.elapsedMs` 가 주입 clock 기준으로 정확히 계산됨을 별도 검증.
- [ ] Error path unit test 1+ — throughput 배선이 기존 error 계약을 깨지 않음 검증: `assertS2Threshold`
      의 `result` 형태 검증(TypeError) 이 `elapsedMs` 필드 추가 후에도 유지되고, thresholds 음수/NaN
      RangeError 도 유지됨.
- [ ] Flow / branch coverage — throughput 산출의 각 분기 test 분리: (a) 성공 표본 0(count=0 → throughput=0),
      (b) 성공 표본 >0 & elapsedMs>0(정상 req/s), (c) iterations=0(elapsedMs=0 & throughput=0).
- [ ] Negative cases 충분 cover — 각 1+ test: 전부 실패라 성공 표본 0(throughput=0), 단조 clock 위반으로
      음수 elapsed(기존 collectLatencySamples RangeError 유지), 빈 표본에서 throughput 이 NaN/Infinity 를
      뱉지 않고 0 으로 방어됨, `elapsedMs` 필드 누락된 legacy `CollectResult` 를 assertS2Threshold 에 넘길 때
      정책(정의된 처리 — 예: elapsedMs undefined → 0 취급 또는 명시 검증)에 따른 결정론적 동작.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `pnpm lint && pnpm build && pnpm test:perf`
      (30 perf-spec + collector/metrics spec) 전부 green — 기존 30 개 `*.perf-spec.ts` 무회귀.
- [ ] `test/perf/README.md` orchestration 절에 collector 의 elapsedMs 수집 + S2Assertion.throughput 관찰
      배선을 1~2 줄 반영.

## Out of Scope

- 30 개 `*.perf-spec.ts` 파일 수정 금지 — 본 task 는 collector orchestration + spec 만 건드린다. 개별
  endpoint spec 이 새 throughput 필드를 assert 하도록 배선하는 것은 필요 시 별도 follow-up.
- `latency-metrics.ts` 의 `throughput` 순수 함수 시그니처·정책 변경 금지 — T-0860 이 확정. 본 task 는
  그것을 **호출·배선**만 한다.
- throughput 을 pass/fail 임계로 승격하는 것(§3 "baseline 후 fix") — 실측 baseline 확정 전까지 관찰 전용.
- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 도입 / CI perf job 상시 편입 — 신규 dependency ADR
  선행 필요(계획 문서 §4.2 / §5 follow-up).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
