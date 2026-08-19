---
id: T-1613
title: Expose ConfirmOrCompareResult on compared run outcome for step summary wiring
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-08-19
independentStream: perf-checkin-baseline
dependsOn: []
touchesFiles:
  - test/perf/checkin-baseline-run.ts
  - test/perf/checkin-baseline-run.spec.ts
plannerNote: ADR-0056 §Decision 3 (b) step 요약 배선의 데이터 통로 — compared outcome 이 버리던 ConfirmOrCompareResult 를 그대로 싣는다.
---

# T-1613 — compared 실행 결과에 `ConfirmOrCompareResult` 를 실어 step 요약 입력 통로를 잇는다

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 상대 회귀를 "로그와 **step 요약**으로 가시화만 하고 exit code 는 바꾸지 않는다" 고 못 박았다. 요약 축은 T-1610(포매터) · T-1611(울타리) · T-1612(주입식 append sink) 로 세 조각이 확정됐으나, **정작 그 포매터의 입력인 `ConfirmOrCompareResult` 가 실행 진입점 밖으로 나오지 않는다** — `runCheckinBaselineCheck` 는 비교 결과로 로그 문자열을 만든 뒤 `{status, regressed, log}` 만 반환하고 원본 결과를 버린다. 그래서 호출처(`checkin-baseline-spec-wiring.ts` → perf-spec)는 요약을 조립할 재료가 없어 sink 를 호출할 방법이 없다. 본 task 는 그 **데이터 통로 한 칸** 만 연다 — 새 판정 · 새 표기 · 새 호출처 0.

## Required Reading

- `test/perf/checkin-baseline-run.ts` — 변경 대상 진입점 (`CheckinBaselineRunOutcome` union · 6 단계 조립 순서).
- `test/perf/checkin-baseline-run.spec.ts` — 변경 대상 colocated spec (`toEqual` 로 compared 반환 전체를 고정한 국면 2 곳이 있다: happy-path · 회귀 분기).
- `test/perf/checkin-baseline-step-summary.ts` — 요약 포매터가 요구하는 입력 타입(`ConfirmOrCompareResult`, `formatCheckinStepSummaryBlock` 시그니처) 확인용.
- `test/perf/checkin-baseline-report.ts` — `formatCheckinOutcomeBlock` 이 받는 판별 union 형태(재검증 · 재구현 금지 근거).

## Acceptance Criteria

- [ ] `CheckinBaselineRunOutcome` 의 `compared` 갈래에 `confirmOrCompare: ConfirmOrCompareResult` 필드를 추가한다. `skipped` 갈래(`disabled` · `absent`)에는 **추가하지 않는다** — 비교가 없었다는 사실을 타입으로 유지.
- [ ] `runCheckinBaselineCheck` 는 `{ outcome: "compared", ...result }` 객체를 **한 번만 만들어** `formatCheckinOutcomeBlock` 인자와 반환 필드에 **같은 값**으로 쓴다. 수치 재계산 · 형태 재검증 · 필드 재조립 0.
- [ ] 기존 계약 불변 — `log` 문자열(줄 수 · 순서 · prefix · candidate 줄), `status` · `regressed` 값, 예외 계약(입력 형태 · 비교 진입 후 `compare` 형태 · 하위 위임 전파), 회귀 입력에도 throw 0(exit code 불변). JSDoc `@returns` 를 새 필드까지 포함하도록 갱신.
- [ ] happy-path unit test 1+ — compared 국면 반환의 `confirmOrCompare` 가 `{outcome:"compared", comparison, report}` 로 주입 비교 함수 반환을 그대로 싣는지 검증.
- [ ] error path unit test 1+ — `input` non-object · `null`, 비교 진입 확정 후 `compare` non-function, 주입 비교 함수가 던지는 국면에서 **예외가 그대로 전파되고 반환값이 없음**을 검증(포매터가 던지는 국면 포함).
- [ ] 분기 cover — `compared`(`regressed=true` / `false`) · `skipped:disabled` · `skipped:absent` 각 1+ test. skip 두 국면 반환에는 `confirmOrCompare` 키가 **없음**을 명시 검증.
- [ ] negative cases 충분 cover — (a) 회귀 입력 throw 0, (b) 입력 인자 불변(호출 전후 `JSON.stringify` 동일), (c) 결정성(같은 입력 2 회 호출 결과 동일), (d) 주입 비교 함수 호출 **정확히 1 회**, (e) skip 국면에서 비교 함수 호출 **0 회**, (f) 하위 포매터의 `RangeError`(빈/공백-only `report` 등) 전파, (g) 반환 `confirmOrCompare.report` · `comparison` 이 재가공(trim · 재포맷 · 반올림) 되지 않았음.
- [ ] `checkin-baseline-run.spec.ts` 의 strict `toEqual` 2 곳(happy-path · 회귀 분기)을 새 필드 포함으로 갱신한다. 다른 spec(adapter · spec-wiring · spec-suite)은 `toMatchObject` 라 변경 불요임을 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 변경 모듈은 기존대로 100% 유지.

## Out of Scope

- 포매터 · sink 를 잇는 **합성 모듈**(`emitCheckinStepSummary` 류) 신설 — 다음 slice.
- `checkin-baseline-spec-wiring.ts` · `checkin-baseline-adapter.ts` · perf-spec 의 호출처 배선, `fs.appendFileSync` / `process.env` 기본 주입값 바인딩.
- `.github/workflows/ci.yml` 편입(ADR-0056 `§Follow-ups (b)`) 및 drift-guard smoke spec 갱신.
- 로그 문자열 표기 · 줄 수 · prefix 변경, tolerance 임계 재산정(`§Follow-ups (c)`), baseline JSON 추가/갱신.
- PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` 완료 표기 변경(관찰-only 유지라 여전히 미완).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

