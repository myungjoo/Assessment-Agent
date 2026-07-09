---
id: T-0865
title: S2 latency baseline 회귀 비교 결과 포맷 순수 함수 신설 (formatComparisonReport)
phase: P8
status: DONE
completedAt: 2026-07-09T19:53:03Z
prNumber: 759
mergedAs: f2f38161
reviewRounds: 1
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 195
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline.ts
  - test/perf/latency-baseline.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — compareBaselineReports 결과(BaselineComparison)를 사람-친화 리포트 문자열로 포맷하는 순수 함수. 관찰·리포트 전용·판정 불변. R-112 backbone×1.5 → est 195."
---

# T-0865 — S2 latency baseline 회귀 비교 결과 포맷 순수 함수 신설 (formatComparisonReport)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "baseline 확정 + 임계 fix — 최초 실측으로 §3 임계를 실 수치로 확정"을 요구한다. 직전 슬라이스들이 `compareBaselineReports`(T-0863, 두 리포트 비교 → `BaselineComparison`)와 serialize/parse(T-0864, 저장 baseline 영속화)를 신설했다. 그러나 `BaselineComparison` 레코드를 **사람이 읽고 회귀 여부·지표별 delta 를 한눈에 파악**할 수 있는 리포트 문자열로 렌더링하는 순수 함수는 아직 없다. `formatBaselineLine`(단일 `BaselineReport` → 한 줄)의 회귀-비교 짝으로서, 실 baseline 확정 harness(§5 #5)가 "이번 측정이 기준 대비 회귀했는가"를 로그·CI 출력으로 사람에게 보여주려면 이 포맷 primitive 를 import 만 하면 되도록 최소 선행 slice 를 박제한다. 관찰·리포트 전용이며, S2 pass/fail 임계 로직(assertS2Threshold)·회귀 판정 로직(compareBaselineReports)은 전혀 바꾸지 않는다.

## Required Reading

- `test/perf/latency-baseline.ts` — `BaselineComparison` / `MetricComparison` 인터페이스(268행 이하 `compareBaselineReports` 반환 형태) + 기존 `formatBaselineLine`(509행)·내부 `fmt` 헬퍼. 본 task 가 여기에 `formatComparisonReport` 를 추가한다(기존 `fmt` NaN 방어 스타일 재사용).
- `test/perf/latency-baseline.spec.ts` (colocated spec) — 기존 spec 구조를 따라 새 함수 spec 을 여기에 추가한다.
- `test/perf/README.md` §"baseline 리포트 (`latency-baseline.ts`)" 절 — 새 함수 항목 1~2줄 추가.
- `docs/ops/load-resilience-test-plan.md` §3(측정 임계·관찰) / §5 #5 — 회귀 리포트의 근거 맥락.

## 설계 요지

- `formatComparisonReport(comparison: BaselineComparison): string` — `compareBaselineReports` 가 반환한 `BaselineComparison` 을 **사람-친화 + 파싱 용이한 여러 줄(또는 key=value 집합) 문자열**로 포맷한다. 지표별로 baseline·candidate·delta·회귀 표시(예: `REGRESSED` / `ok`)를 렌더링한다.
  - 예 형태: 헤더 1줄(종합 `regressed=true|false`) + 지표별 줄(`p95: base=15.0ms cand=18.0ms delta=+3.0ms REGRESSED`).
  - throughput 은 §3 상 관찰 전용이므로 `regressed` 표시 대신 delta 만 렌더링하고 "(관찰)" 같은 표기로 판정 제외임을 명시한다.
- NaN 지표(빈 표본)는 `formatBaselineLine` 과 동형으로 "n/a" 로 방어적으로 표기한다(기존 `fmt` 헬퍼 재사용). delta 가 NaN 인 지표(어느 한쪽 빈 표본)도 "n/a".
- delta 부호는 명시(증가는 `+`, 감소는 `-`)해 개선/악화 방향을 사람이 즉시 읽게 한다.
- 지표 재계산·재판정 없음 — `BaselineComparison` 의 이미 파생된 값(baseline/candidate/delta/regressed)을 그대로 전사만 한다.
- 입력이 유효한 `BaselineComparison` 형태가 아니면 `TypeError` throw(방어적 형태 가드 — 최소한 p50/p95/p99/errorRate/throughput 이 `MetricComparison` 형태이고 최상위 `regressed` 가 boolean 인지 검사).

## Acceptance Criteria

- [ ] `test/perf/latency-baseline.ts` 에 `formatComparisonReport(comparison: BaselineComparison): string` 함수를 export 추가. 지표 재계산·재판정 없이 `BaselineComparison` 의 파생값만 전사하며, 기존 `fmt` NaN-방어 헬퍼 스타일을 재사용한다.
- [ ] Happy-path unit test 1+ — 회귀 없는(regressed=false) 정상 `BaselineComparison` 을 포맷하면 종합 `regressed=false` + 각 지표의 base/cand/delta 값이 기대 문자열과 일치. 회귀 있는(regressed=true) 케이스도 1+ — 회귀 지표에 회귀 표시(예: `REGRESSED`)가 포함.
- [ ] Error path unit test 1+ — `formatComparisonReport` 에 (1) `null`/`undefined` 입력, (2) object 이나 `p95` 등이 `MetricComparison` 형태가 아닌 형태 불량 입력, (3) 최상위 `regressed` 가 boolean 아닌 입력 각각에 대해 `TypeError` throw.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) delta 양수(증가) vs 음수(감소) 부호 표기 분기, (2) NaN 지표(빈 표본) → "n/a" 표기 분기 vs 유한 지표 정상 렌더링 분기, (3) throughput 은 회귀 표시 없이 delta·"(관찰)" 만 렌더링(다른 지표와 다른 분기), (4) 종합 regressed=true 헤더 vs false 헤더 분기.
- [ ] Negative cases 충분 cover — 각 1+ test: 모든 지표 NaN(전부 빈 표본) 입력 렌더링, candidate 만 NaN(측정 소실) 지표의 표기, delta=0(변화 없음) 지표의 부호 표기, 최상위 `regressed=true` 이나 개별 지표 표시와의 정합(latency/errorRate 중 하나 REGRESSED), 결과 문자열이 비어 있지 않고 각 지표명이 모두 포함되는지 검증.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 `formatComparisonReport` 항목 1~2줄 추가(회귀 비교 결과 포맷·관찰 전용·NaN "n/a" 방어 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- assertS2Threshold / S2Assertion / collector orchestration / compareBaselineReports 판정 로직 변경 금지 — pass/fail 임계·회귀 판정 로직 불변(본 task 는 이미 판정된 결과의 **포맷**만).
- 실제 파일 I/O(디스크 read/write, `fs` 호출), CI job 편입, 실 Postgres 실측 — 전부 별도 follow-up(§5 #4·#5 harness). 본 task 는 순수 문자열 포맷만.
- baseline 파일 경로 규약·CI 로그 출력 배선 — 저장/실행 harness 착수 시 별도 task.
- 신규 외부 dependency 추가 금지(supertest/jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
