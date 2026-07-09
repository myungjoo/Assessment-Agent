---
id: T-0863
title: S2 latency baseline 회귀 비교 순수 함수 신설 (compareBaselineReports)
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 175
estimatedFiles: 3
created: 2026-07-10
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline.ts
  - test/perf/latency-baseline.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #5(baseline 확정+임계 fix) — baseline↔candidate 회귀 비교 순수 함수 신설. 관찰 전용, doc-only inline README amend 아님(코드=pr)."
---

# T-0863 — S2 latency baseline 회귀 비교 순수 함수 신설 (compareBaselineReports)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "baseline 확정 + 임계 fix — 최초 실측으로 §3 임계를 실 수치로 확정"을 요구한다. 직전 T-0862 가 단일 run 의 `BaselineReport` 를 조립·포맷하는 primitive 를 신설했으나, 두 baseline(저장된 기준 vs 새 candidate)을 **비교해 회귀를 탐지**하는 순수 함수는 아직 없다. 실 baseline 확정 harness 가 "이번 실측이 기준 대비 나빠졌는가"를 판정하려면 이 비교 primitive 를 import 만 하면 되도록 최소 선행 slice 를 박제한다. 관찰·리포트 전용이며, S2 pass/fail 임계 로직(assertS2Threshold)은 전혀 바꾸지 않는다.

## Required Reading

- `test/perf/latency-baseline.ts` — `BaselineReport` / `BaselineEnvMeta` 인터페이스 및 `buildBaselineReport` / `formatBaselineLine`. 본 task 가 여기에 `compareBaselineReports` + 관련 인터페이스를 추가한다.
- `test/perf/latency-baseline.spec.ts` (colocated spec) — 기존 spec 구조를 따라 새 함수의 spec 을 여기에 추가한다.
- `test/perf/latency-collector.ts` — `S2Assertion` / summary(p50/p95/p99/count/errorRate/throughput) 필드 형태 참고(비교 대상 지표 근거).
- `test/perf/README.md` — §"baseline 리포트 (`latency-baseline.ts`)" 절에 새 함수 항목을 추가한다.
- `docs/ops/load-resilience-test-plan.md` §3(측정 임계) / §5 #5 — 회귀 판정의 근거 맥락.

## Why (설계 요지)

`compareBaselineReports(baseline: BaselineReport, candidate: BaselineReport, options?)` 는 두 리포트의 p50/p95/p99/throughput/errorRate 를 비교해 **회귀 여부(regressed: boolean)** 와 지표별 delta 를 담은 `BaselineComparison` 레코드를 반환한다.

- latency 지표(p50/p95/p99)는 candidate 가 baseline 대비 **허용 비율(기본 tolerance 예: 0.10 = +10%)을 초과해 증가**하면 회귀.
- errorRate 는 candidate 가 baseline 보다 유의하게 증가하면 회귀(절대 delta 기준, 기본 0.01).
- throughput 은 §3 상 관찰 지표이므로 회귀 판정에는 **반영하지 않고 delta 만 리포트**(관찰 전용 유지).
- NaN 지표(빈 표본) 방어: baseline 또는 candidate 의 p95 등이 NaN 이면 해당 지표 delta 는 NaN 으로 두고, 그 지표는 회귀 판정에서 제외(명시적 문서화). 단 candidate 만 NaN(표본 소실)인 경우는 회귀로 표기(측정 소실 = 악화).

지표 재계산 없음 — 두 리포트의 이미 파생된 값만 비교한다. pass/fail 임계·assertion 로직 불변.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline.ts` 에 `compareBaselineReports` 함수 + `BaselineComparison` / (필요 시) `CompareOptions` 인터페이스를 export 추가. 지표 재계산 없이 두 `BaselineReport` 의 파생값만 비교한다.
- [ ] Happy-path unit test 1+ — 정상 baseline·candidate 로 회귀 없음(regressed=false) + 지표별 delta 가 기대값과 일치.
- [ ] Error path unit test 1+ — `baseline` / `candidate` 가 유효 `BaselineReport` 형태가 아닐 때 `TypeError` throw(형태 가드), tolerance 가 음수·NaN 일 때 `RangeError`.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) latency 회귀 발생(candidate p95 가 tolerance 초과 증가 → regressed=true), (2) errorRate 회귀 발생, (3) tolerance 경계 근처(정확히 tolerance 만큼 증가 = 회귀 아님, tolerance 초과 = 회귀), (4) NaN 지표 제외 분기(baseline NaN → 해당 지표 판정 제외), (5) candidate 만 NaN(측정 소실 → 회귀) 분기.
- [ ] Negative cases 충분 cover — 각 1+ test: 빈 표본(count=0, p95=NaN) baseline vs 정상 candidate, throughput 이 크게 나빠져도 회귀 판정에 반영 안 됨(관찰 전용) 검증, errorRate 개선(감소) 시 회귀 아님, latency 개선(감소) 시 delta 음수·회귀 아님, tolerance=0 극단값에서의 판정.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 `compareBaselineReports` 항목 1줄 추가(회귀 비교·관찰 전용 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- assertS2Threshold / S2Assertion / collector orchestration 변경 금지 — pass/fail 임계 로직 불변.
- throughput 을 회귀 판정 기준으로 사용하지 않는다(§3 관찰 지표 유지 — delta 만 리포트).
- 실 baseline 값 파일(JSON) 저장·로드, CI job 편입, 실 Postgres 실측 — 전부 별도 follow-up(§5 #4·#5 harness).
- 신규 외부 dependency 추가 금지(supertest/jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
