---
id: T-1614
title: Add emitCheckinStepSummary composing formatter and step-summary sink
phase: P5
status: DONE
prNumber: 1292
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-08-19
completedAt: 2026-08-19T14:00:45Z
independentStream: perf-checkin-baseline
dependsOn: []
touchesFiles:
  - test/perf/checkin-baseline-step-summary-emit.ts
  - test/perf/checkin-baseline-step-summary-emit.spec.ts
plannerNote: ADR-0056 §Decision 3 (b) step 요약 축의 합성 조각 — run outcome → 포매터 → sink 를 잇는 진입점 1 개 신설(호출처 배선은 다음 slice).
---

# T-1614 — 실행 결과 → 포매터 → sink 를 잇는 합성 진입점 `emitCheckinStepSummary` 신설

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 상대 회귀를 "로그와 **step 요약**으로 가시화만 하고 exit code 는 바꾸지 않는다" 고 못 박았다. 요약 축의 조각은 이미 넷이 확정됐다 — T-1610 포매터(`formatCheckinStepSummaryBlock`) · T-1611 울타리 동적 산출 · T-1612 주입식 sink(`appendCheckinStepSummary`) · T-1613 데이터 통로(`compared` 반환에 `confirmOrCompare` 적재). 그러나 **네 조각을 잇는 곳이 아직 없다** — 호출처가 요약을 내보내려면 `status === "compared"` 분기 · 포매터 호출 · sink 호출 · 예외 삼킴을 전부 자기 손으로 조립해야 하고, 그 조립 로직이 perf-spec 마다 복제되면 관찰-only 계약(어떤 실패도 exit code 를 바꾸지 않음)이 호출처 수만큼 흩어진다.

본 task 는 그 **합성 진입점 1 개** 만 신설한다 — `CheckinBaselineRunOutcome` 을 받아 (1) 비교하지 않은 국면은 단락, (2) 비교 국면은 포매터로 블록 조립, (3) sink 로 append 위임 하는 얇은 잇기. 새 markdown 문구 · 새 판정 · 새 상수 · 새 호출처는 **0** 이며 `ci.yml` 도 건드리지 않는다(다음 slice).

## Required Reading

- `test/perf/checkin-baseline-run.ts` — 입력 타입 `CheckinBaselineRunOutcome`(`compared` 는 `confirmOrCompare` 적재, `skipped` 두 갈래는 필드 부재) 확인용.
- `test/perf/checkin-baseline-step-summary.ts` — `formatCheckinStepSummaryBlock(result, sectionTitle)` 시그니처와 예외 계약(`TypeError` / `RangeError`).
- `test/perf/checkin-baseline-step-summary-sink.ts` — `appendCheckinStepSummary(block, deps)` · `CheckinStepSummarySinkDeps` · `CheckinStepSummarySinkOutcome` · `GITHUB_STEP_SUMMARY_ENV` (재기술 금지, 그대로 재사용).
- `test/perf/checkin-baseline-step-summary-sink.spec.ts` — colocated spec 서술 스타일 · 주입 mock 패턴 참고.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3` — 관찰-only · exit code 불변 근거 (`95~116 행` 부근).

## Acceptance Criteria

구현 (신규 `test/perf/checkin-baseline-step-summary-emit.ts`):

- [x] `emitCheckinStepSummary(outcome, sectionTitle, deps)` 1 개를 export 한다. `outcome` 은 `CheckinBaselineRunOutcome`, `deps` 는 sink 의 `CheckinStepSummarySinkDeps` 를 **그대로 재사용**(새 deps 타입 정의 금지 — 재-export 또는 import 만).
- [x] 반환은 판별 union `CheckinStepSummaryEmitOutcome` — `{status:"appended"; path}` · `{status:"skipped"; reason:"not-compared"|"env-absent"|"env-blank"}` · `{status:"failed"; reason:"format-threw"|"append-threw"}`. sink 결과는 **그대로 통과**시키고(재조립 · 재판정 0) `not-compared` · `format-threw` 두 국면만 본 모듈이 새로 낸다.
- [x] `outcome.status !== "compared"` 이면 **포매터 · sink 를 각 0 회 호출**하고 `skipped`(`not-compared`) 반환 — "비교가 없었다" 는 사실이 요약으로 새지 않게 한다.
- [x] `compared` 국면은 `formatCheckinStepSummaryBlock(outcome.confirmOrCompare, sectionTitle)` 을 **정확히 1 회** 호출하고, 그 결과를 가공 없이 `appendCheckinStepSummary` 에 넘긴다(trim · 재정렬 · 이스케이프 · 개행 조작 0 — 끝 개행 보장은 sink 책임).
- [x] **관찰 경로 최외곽 계약** — 포매터가 던진 값은 어떤 것도 전파하지 않고 삼켜 `failed`(`format-threw`) 로만 보고한다(sink 가 append 실패를 삼키는 것과 동형). 단 **본 모듈 자신의 인자 형태 위반**(`sectionTitle` non-string / 빈·공백-only, `outcome` non-object · `null`, `deps` non-object · `null`) 은 형제 모듈과 동일하게 `TypeError` / `RangeError` 로 던진다. 이 경계를 JSDoc 에 한국어로 명시한다.
- [x] 전역 접근 0 — `process.env` 읽기 · `fs` import 0(모든 외부 접촉은 주입된 `deps` 경유). 인자 변형 0(같은 입력은 늘 같은 결과).
- [x] `regressed === true` 입력에서도 throw 0 이고 반환 status 가 회귀 여부에 따라 갈리지 않는다(exit code 불변 — 회귀는 요약 본문으로만 드러난다).

테스트 (신규 colocated `test/perf/checkin-baseline-step-summary-emit.spec.ts`, CLAUDE.md §3.2 R-112):

- [x] **happy-path** — `compared` 입력에서 append 가 1 회 호출되고 넘겨진 블록이 포매터 결과와 일치, 반환이 `{status:"appended", path}` 인 test 1+.
- [x] **error path** — 포매터가 던지는 입력(예: `confirmOrCompare.report` 가 빈 문자열 / `outcome` 이 허용 밖 형태)에서 예외가 밖으로 새지 않고 `failed`(`format-threw`) 로 보고되며 append 가 **0 회** 호출되는 test 1+, sink append 가 던지는 국면에서 `failed`(`append-threw`) 로 통과되는 test 1+.
- [x] **분기 cover** — `compared` / `skipped(disabled)` / `skipped(absent)` 세 입력 갈래 각 1+, sink 단락 두 갈래(`env-absent` · `env-blank`) 각 1+, `regressed` true/false 양쪽 각 1+.
- [x] **negative cases 충분 cover** — 예외 상황마다 각 1+ test: (a) `sectionTitle` non-string → `TypeError`, (b) `sectionTitle` 빈/공백-only → `RangeError`, (c) `outcome` non-object · `null` · `undefined` → `TypeError`, (d) `deps` non-object · `null` → `TypeError`, (e) `deps.append` non-function 국면(하위 sink 예외 계약 유지 확인), (f) `not-compared` 국면에서 append **0 회** 호출, (g) 인자(`deps` · `outcome`) 를 변형하지 않음(호출 전후 deep-equal).
- [x] `pnpm lint` · `pnpm build` · `pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 모듈은 stmt/branch/func/line **100%** 를 목표로 한다(T-1610~T-1613 선례).

## Out of Scope

- `checkin-baseline-spec-wiring.ts` · perf-spec 등 **실제 호출처 배선과 기본 주입값 바인딩**(`process.env` · `fs.appendFileSync` 실주입) — 다음 slice.
- `.github/workflows/ci.yml` 편입(ADR-0056 `§Follow-ups (b)`) 및 drift-guard smoke spec 갱신 — 5 파일 cap 위험이 있어 별도 task.
- `formatCheckinStepSummaryBlock` · `appendCheckinStepSummary` · `runCheckinBaselineCheck` **본체 수정 금지**(본 task 는 합성만 — 세 모듈은 import 만 한다).
- markdown 문구 · heading · 상태 줄 · 상수(`GITHUB_STEP_SUMMARY_ENV`) 신설 또는 변경.
- 완료 표기 변경 금지 — PLAN `140 행` `[ ]` · requirements REQ-048 `IN_PROGRESS` 불변(상대 회귀는 여전히 관찰-only).
- `*-realdb` / `*-read` 계열 perf-spec 의 factory 배선.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기 적는다.)

## Result (2026-08-19)

`pr` mode 로 완료 — PR [#1292](https://github.com/myungjoo/Assessment-Agent/pull/1292) squash 머지 `b2022c8f` (2 파일 `+299/-0`, `src/` 0 LOC · `ci.yml` 변경 0).
`emitCheckinStepSummary` 합성 진입점 1 개 + 판별 union `CheckinStepSummaryEmitOutcome` 신설 — `compared` 아닌 국면은 `skipped(not-compared)` 로 단락해 포매터·sink 각 **0 회** 호출, `compared` 는 포매터 **정확히 1 회** 후 결과 가공 0 으로 sink 에 위임하고 sink 결과를 그대로 통과시킨다. 포매터 예외는 삼켜 `failed(format-threw)` 로만 보고 — 관찰-only · exit code 불변 계약 유지. 새 문구 · 새 상수 · 새 호출처 **0**.
R-112 — colocated spec 22 케이스(happy / error path 2 종 / 분기 / negative (a)~(g)), 신규 모듈 stmt·branch·func·line **100%**, 전체 441 suite / 12665 test green.
4-게이트 — reviewer VERDICT=APPROVE(round 1/7) + PR comment 외화 + integrator 자체 점검 + PR CI green 으로 **4/4**.
