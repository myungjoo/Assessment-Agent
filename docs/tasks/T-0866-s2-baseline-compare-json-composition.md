---
id: T-0866
title: S2 latency baseline 저장 JSON 회귀 비교 합성 순수 함수 신설 (compareBaselineJson)
phase: P8
status: DONE
completedAt: 2026-07-09T20:54:26Z
result: "compareBaselineJson 합성 순수 함수 신설(parseBaselineReport×2 → compareBaselineReports → formatComparisonReport 조립, 신규 판정 0, 하위 예외 propagate). spec 21케이스, cov line 99.95%/func 100%/branch 99.25% 무회귀. PR #760 squash aa77b510 merged(reviewer APPROVE r1/7 0 finding, CI green)."
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
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — 저장 baseline↔candidate JSON 을 parse→compare→format 합성하는 순수 함수. 기존 primitive 조립·판정 불변. R-112 backbone×1.5 → est 195."
---

# T-0866 — S2 latency baseline 저장 JSON 회귀 비교 합성 순수 함수 신설 (compareBaselineJson)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "baseline 확정 + 임계 fix — 최초 실측으로 §3 임계를 실 수치로 확정"을 요구한다. 지난 5개 슬라이스가 baseline primitive 를 모두 신설했다: `buildBaselineReport`(T-0862, 리포트 조립), `formatBaselineLine`(단일 리포트 포맷), `compareBaselineReports`(T-0863, 두 리포트 비교 → `BaselineComparison`), `serializeBaselineReport`/`parseBaselineReport`(T-0864, JSON 영속화·복원), `formatComparisonReport`(T-0865, 비교 결과 → 사람-친화 문자열). 그러나 이 조각들을 **저장 baseline harness 관점의 단일 진입점으로 묶는 합성 함수**는 아직 없다 — 실 §5 #5 harness 는 디스크에서 기준 baseline JSON 과 새 측정 candidate JSON 을 로드한 뒤 `parseBaselineReport` 2회 → `compareBaselineReports` → `formatComparisonReport` 를 손으로 이어붙여야 한다. 이 4-스텝 조립을 순수 함수 하나로 박제해 harness 가 두 JSON 문자열만 넘기면 `{ comparison, report }` 를 받도록 하는 것이 본 slice 다. 관찰·리포트 전용이며 지표 재계산·재판정·pass/fail 임계 로직은 전혀 바꾸지 않고 기존 primitive 를 조립만 한다(파일 I/O 없음 — 순수).

## Required Reading

- `test/perf/latency-baseline.ts` — 조립 대상 기존 export: `parseBaselineReport`(436행, JSON → `BaselineReport`, 잘못된 JSON `SyntaxError`·형태 불량 `TypeError`), `compareBaselineReports`(268행, 두 리포트 → `BaselineComparison`, `CompareOptions` tolerance 음수/NaN `RangeError`), `formatComparisonReport`(619행, `BaselineComparison` → 문자열), `BaselineComparison`/`CompareOptions` 인터페이스(128·162행). 본 task 가 여기에 `compareBaselineJson` 을 추가한다(신규 판정 로직 0 — 위 셋을 순서대로 호출만).
- `test/perf/latency-baseline.spec.ts` (colocated spec) — 기존 spec 구조를 따라 새 함수 spec 을 여기에 추가한다(신규 spec 파일 만들지 말 것 — colocated 우선).
- `test/perf/README.md` §"baseline 리포트 (`latency-baseline.ts`)" 절 — 새 함수 항목 1~2줄 추가.
- `docs/ops/load-resilience-test-plan.md` §5 #5 — 저장 baseline 로드→비교→리포트 harness 맥락.

## 설계 요지

- `compareBaselineJson(baselineJson: string, candidateJson: string, options?: CompareOptions): { comparison: BaselineComparison; report: string }` — 저장된 두 baseline JSON 문자열을 받아:
  1. `parseBaselineReport(baselineJson)` 와 `parseBaselineReport(candidateJson)` 로 각각 `BaselineReport` 복원(NaN sentinel round-trip 포함),
  2. `compareBaselineReports(baseline, candidate, options)` 로 `BaselineComparison` 산출,
  3. `formatComparisonReport(comparison)` 로 사람-친화 문자열 산출,
  4. `{ comparison, report }` 반환.
- **신규 판정·계산 로직 0** — 세 기존 primitive 를 순서대로 호출만 하는 얇은 합성. delta·회귀 판정·NaN 방어·포맷은 전부 하위 primitive 가 이미 책임진다.
- **오류 전파(재래핑 없음)** — 하위 primitive 가 던지는 예외를 그대로 propagate 한다: 잘못된 JSON → `parseBaselineReport` 의 `SyntaxError`, 형태 불량 리포트 → `parseBaselineReport` 의 `TypeError`, `options.latencyTolerance`/`errorRateTolerance` 음수·NaN → `compareBaselineReports` 의 `RangeError`. 본 함수가 별도 error 타입을 새로 만들지 않는다(합성이라 하위 계약을 그대로 노출).
- `options` 미지정 시 `compareBaselineReports` 기본 tolerance(latency 0.10 / errorRate 0.01)를 그대로 사용한다.
- 반환 object 의 `comparison` 은 `compareBaselineReports` 결과 그대로, `report` 는 `formatComparisonReport(comparison)` 결과 그대로 — 두 값의 정합(같은 comparison 에서 파생)을 보장한다.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline.ts` 에 `compareBaselineJson(baselineJson, candidateJson, options?): { comparison, report }` 함수를 export 추가. 신규 판정·계산 없이 `parseBaselineReport`×2 → `compareBaselineReports` → `formatComparisonReport` 를 순서대로 호출해 조립하며, 하위 primitive 예외를 재래핑 없이 그대로 propagate 한다.
- [ ] Happy-path unit test 1+ — 회귀 없는 baseline·candidate 를 `serializeBaselineReport` 로 직렬화한 두 JSON 을 넘기면 `comparison.regressed===false` + `report` 가 비어 있지 않고 종합 `regressed=false` 표기를 포함. 회귀 있는(예: candidate p95 가 tolerance 초과 증가) 케이스도 1+ — `comparison.regressed===true` + `report` 에 회귀 표시(`REGRESSED`) 포함. 반환 `report` 가 `formatComparisonReport(반환 comparison)` 와 정확히 일치(정합)함도 assert.
- [ ] Error path unit test 1+ — 각 하위 예외가 그대로 propagate 됨을 검증: (1) `baselineJson`/`candidateJson` 이 잘못된 JSON(예: `"{"`)이면 `SyntaxError` throw, (2) 유효 JSON 이나 `BaselineReport` 형태 불량(예: env 누락·지표 타입 불일치)이면 `TypeError` throw, (3) `options.latencyTolerance` 가 음수·NaN 이면 `RangeError` throw.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) `baselineJson` 이 불량인 경우 vs `candidateJson` 이 불량인 경우(어느 인자가 던지든 propagate), (2) `options` 지정(예: `latencyTolerance: 0.5`) 시 tolerance 가 `compareBaselineReports` 에 전달돼 회귀 판정이 달라짐 vs 미지정(기본 0.10) 분기, (3) NaN 지표(빈 표본)를 포함한 baseline round-trip 이 comparison·report 에 정상 반영되는 분기.
- [ ] Negative cases 충분 cover — 각 1+ test: 두 JSON 모두 NaN 지표(전부 빈 표본) 입력의 정상 조립, candidate 만 측정 소실(NaN)인 baseline 의 회귀 표기 정합, `options.errorRateTolerance` 음수 → `RangeError`, `baselineJson` 이 빈 문자열(`""`) → `SyntaxError`, 정상 입력에서 반환 object 가 `comparison`·`report` 두 키를 모두 가지고 `report` 에 모든 지표명이 포함되는지 검증.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 `compareBaselineJson` 항목 1~2줄 추가(저장 두 JSON → parse→compare→format 합성·관찰 전용·하위 예외 propagate 명시). §5 #5 harness 가 이 함수를 진입점으로 import 함도 1줄 언급.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- `parseBaselineReport` / `compareBaselineReports` / `formatComparisonReport` / `serializeBaselineReport` / `buildBaselineReport` / `assertS2Threshold` / collector 판정·계산 로직 변경 금지 — 본 task 는 기존 primitive 를 **조립**만(신규 판정·계산·포맷 0).
- 실제 파일 I/O(디스크 read/write, `fs` 호출), CI job 편입, 실 Postgres 실측 — 전부 별도 follow-up(§5 #4·#5 harness). 본 task 는 순수 문자열-in/object-out 합성만.
- baseline 파일 경로 규약·CI 로그 출력 배선·디렉토리 레이아웃 — 저장/실행 harness 착수 시 별도 task.
- 새 error 타입·새 옵션 필드 신설 금지 — 하위 primitive 계약을 그대로 노출.
- 신규 외부 dependency 추가 금지(supertest/jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
