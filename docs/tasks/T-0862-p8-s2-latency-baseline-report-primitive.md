---
id: T-0862
title: S2 latency harness 에 baseline 리포트 순수 함수(env-meta + 지표 요약) 추가
phase: P8
status: DONE
completedAt: 2026-07-09T16:57:00Z
mergedAs: 59e31207
prNumber: 756
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 115
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline.ts
  - test/perf/latency-baseline.spec.ts
  - test/perf/README.md
plannerNote: P8 load-resilience §5 follow-up #5(baseline 확정) 선행 — S2Assertion 을 env-meta 동반 baseline 리포트로 포맷하는 순수 함수 신설(§3 '환경 고정' 대응, 관찰 전용)
---

# T-0862 — S2 latency harness 에 baseline 리포트 순수 함수 추가

## Why

P8 부하·내성 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5("baseline 확정 + 임계 fix") 는
최초 실측으로 §3 의 "baseline 후 fix" 임계(p50 / throughput 등 관찰 지표)를 확정할 것을 요구하며,
§3 "환경 고정" 은 각 run 이 **환경 메타(하드웨어·동시성·데이터 규모)를 함께 기록**해 비교 가능하게 할 것을 명시한다.
T-0860/T-0861 이 `throughput`(req/s) primitive 와 collector 관찰 배선을 완료했으므로,
다음 자연스러운 증분은 `assertS2Threshold` 가 낸 `S2Assertion` 을 **env-meta 를 동반한
baseline 리포트 레코드**로 포맷하는 순수 함수를 신설하는 것이다. 이는 DB·네트워크 무의존
순수 함수 한 개(+ colocated spec)로, 실 baseline 실측 harness(별도 follow-up)가 이 primitive 를
import 만 하면 되도록 하는 최소 선행 slice 다. **관찰·리포트 전용**이며 pass/fail 판정 로직·
임계 자체는 바꾸지 않는다.

## Required Reading

- `test/perf/latency-collector.ts` — `S2Assertion` 인터페이스(pass / summary / errorRate / throughput / reasons) 형태 확인. baseline 리포트의 입력 소스.
- `test/perf/latency-metrics.ts` — `LatencySummary`(p50/p95/p99/count/maxMs) 형태 + 순수 함수 스타일(입력 검증·throw 규약) 참고.
- `test/perf/latency-collector.spec.ts` — colocated `.spec.ts` 스타일(describe/it 한국어 문자열, happy/error/branch/negative 구성) 참고.
- `test/perf/README.md` — 측정 primitive 절 문구 스타일(신설 primitive 를 한 항목으로 추가).
- `docs/ops/load-resilience-test-plan.md` §3(측정 지표·임계 표 + "환경 고정" 문단) — baseline 리포트가 담아야 할 지표·env-meta 근거.

## Acceptance Criteria

신설 파일 `test/perf/latency-baseline.ts` 에 다음을 순수 함수로 구현한다(DB·네트워크·앱 부트스트랩 무의존):

- [ ] `BaselineEnvMeta` 인터페이스 — 실행 환경 메타(예: `cpu?: string`, `memoryMb?: number`, `concurrency: number`, `dataScale?: string`, `label: string`) 정의. §3 "환경 고정" 대응. 필드명·타입은 영어 식별자.
- [ ] `BaselineReport` 인터페이스 — env-meta + 핵심 지표(p50 / p95 / p99 / throughput / errorRate / count / pass) 를 담는 machine-readable 레코드 형태.
- [ ] `buildBaselineReport(env: BaselineEnvMeta, assertion: S2Assertion): BaselineReport` 순수 함수 — `S2Assertion` 과 env-meta 를 합쳐 `BaselineReport` 를 조립. 지표는 assertion 에서 파생(재계산하지 않음 — pass/fail·임계 로직 불변).
- [ ] `formatBaselineLine(report: BaselineReport): string` 순수 함수 — 리포트를 사람-친화 한 줄(예: `[label] p50=..ms p95=..ms p99=..ms tput=..req/s err=..% pass=..` + env-meta)로 포맷. 파싱 용이하도록 key=value 형태.
- [ ] 입력 검증: `env` 가 유효 형태가 아니거나 `label` 이 빈 string 이면 `TypeError`/`RangeError` throw(latency-metrics.ts 의 throw 규약과 동형). `assertion` 이 `S2Assertion` 형태가 아니면 `TypeError`.

테스트(`test/perf/latency-baseline.spec.ts`, colocated `.spec.ts` — 기본 `pnpm test` 가 picking 해 unit coverage gate 에 포함):

- [ ] happy-path: 정상 `S2Assertion`(pass=true, 표본 있음) + 완전한 env-meta → `buildBaselineReport` 가 지표를 정확히 전사하고 `formatBaselineLine` 이 기대 한 줄을 낸다. `buildBaselineReport`·`formatBaselineLine` 각 public 함수에 대해 happy-path test 1+.
- [ ] error path: `label` 빈 string, `env` null/undefined, `assertion` 형태 불량(예: summary 누락) 각각에 대해 기대 예외(TypeError/RangeError) throw 를 검증하는 test 1+.
- [ ] branch/flow cover: pass=true 리포트와 pass=false 리포트(reasons 비어있지 않음)의 포맷 분기, throughput=0(성공 표본 0)·errorRate=0 vs 0 초과 등 분기마다 test 1+.
- [ ] negative cases 충분 cover — 예외 상황 각 1+: (a) 빈 표본(count=0, p95=NaN) 리포트가 NaN 을 방어적으로 포맷(예: "n/a")하는지, (b) errorRate>0 인 부분 실패 리포트, (c) optional env-meta 필드 누락(cpu/memoryMb/dataScale 미지정)에도 포맷이 성립, (d) label 이 공백만인 string(trim 후 빈 값) 거부 — 각각 별도 test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% — 신설 파일 무회귀). 신설 `latency-baseline.ts` 의 line·function coverage 가 gate 를 충족.
- [ ] `pnpm test:perf` 는 무회귀(perf-spec 30개 그대로 green — 본 slice 는 perf-spec 을 추가하지 않으므로 개수 불변).
- [ ] `pnpm lint && pnpm build` 통과.

문서:

- [ ] `test/perf/README.md` 의 "측정 primitive" 절에 `latency-baseline.ts`(env-meta 동반 baseline 리포트 순수 함수, 관찰·리포트 전용, pass/fail 로직 불변) 항목 1개 추가.

## Out of Scope

- 실제 DB-backed baseline 실측(실 Postgres round-trip) — §5 follow-up #5 의 본 실측은 별도 task.
- §3 의 "baseline 후 fix" 임계값을 실 수치로 확정하는 것 — 실측 이후 별도 task(본 slice 는 리포트 **형태**만 신설).
- `assertS2Threshold` 의 pass/fail 판정·임계 로직 변경(불변 — throughput 은 여전히 관찰 전용).
- 새 perf-spec(`*.perf-spec.ts`) 추가 — endpoint 배선은 30개로 exhaustive.
- 리포트를 파일·CI artifact 로 영속화하는 배선(CI 통합은 §5 follow-up #4).
- 신규 외부 dependency 추가.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음. 후속 slice 후보: 본 baseline 리포트를 실 DB-backed 실측 harness 에 배선(§5 #5), CI 별도 job 편입(§5 #4), §3 임계 실 수치 확정.)
