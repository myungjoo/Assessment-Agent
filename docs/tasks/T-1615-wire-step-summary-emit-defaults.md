---
id: T-1615
title: Bind default step-summary deps in checkin baseline spec wiring
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-19
independentStream: perf-checkin-baseline
dependsOn: []
touchesFiles:
  - test/perf/checkin-baseline-spec-wiring.ts
  - test/perf/checkin-baseline-spec-wiring.spec.ts
plannerNote: ADR-0056 §Decision 3 (b) step 요약 축의 배선 조각 — emit 진입점에 기본 주입값(process.env · fs.appendFileSync)만 결선(perf-spec 실호출·ci.yml 은 다음 slice).
---

# T-1615 — 체크인 baseline 배선 helper 에 step 요약 기본 주입값 결선

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 상대 회귀를 "로그와 **step 요약**으로 가시화만 하고 exit code 는 바꾸지 않는다" 고 못 박았다. 요약 축의 조각은 이제 다섯이 확정됐다 — T-1610 포매터 · T-1611 울타리 산출 · T-1612 주입식 sink · T-1613 데이터 통로 · T-1614 합성 진입점 `emitCheckinStepSummary`. 그러나 그 진입점은 **전역 접근 0** 계약 때문에 `processEnv` 와 `append` 를 전부 주입받으므로, perf-spec 이 요약을 실제로 내보내려면 `process.env` 와 `fs.appendFileSync` 를 자기 손으로 묶어야 한다. 그 묶기가 spec 마다 복제되면 "무엇을 기본값으로 쓰는가" 가 호출처 수만큼 갈라진다.

본 task 는 그 **기본 주입값 결선 한 칸** 만 배선 helper (`checkin-baseline-spec-wiring.ts`) 에 더한다 — `checkCheckinBaselineForSpec` 이 로거 기본값으로 `console.log` 를 묶은 것과 정확히 동형이다. 새 판정 · 새 문구 · 새 상수 · 새 결과 타입은 **0** 이며, perf-spec 파일 실호출과 `ci.yml` 편입은 다음 slice 로 남긴다.

## Required Reading

- `test/perf/checkin-baseline-spec-wiring.ts` — 본 task 가 확장할 모듈. 특히 `checkCheckinBaselineForSpec` 의 **기본값 결선 패턴**(`input.log ?? console.log` — 모듈 로드 시점 고정이 아니라 **호출 시점** 조회) 과 상단 JSDoc 의 책임 경계 서술.
- `test/perf/checkin-baseline-step-summary-emit.ts` — 위임 대상 `emitCheckinStepSummary(outcome, sectionTitle, deps)` 시그니처 · 반환 union `CheckinStepSummaryEmitOutcome` · 예외 계약(형태 위반은 던지고 포매터/append 예외는 삼킴).
- `test/perf/checkin-baseline-step-summary-sink.ts` — `CheckinStepSummarySinkDeps`(`processEnv` · `append`) · `StepSummaryAppendFn` · `GITHUB_STEP_SUMMARY_ENV` (재기술 금지, 그대로 재사용).
- `test/perf/checkin-baseline-spec-wiring.spec.ts` — colocated spec 서술 스타일 · 임시 디렉토리 격리 · 전역 원복 패턴 참고(본 task 의 새 `describe` 는 이 파일에 덧붙인다).
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3` — 관찰-only · exit code 불변 근거.

## Acceptance Criteria

구현 (`test/perf/checkin-baseline-spec-wiring.ts` 확장):

- [ ] `defaultStepSummarySinkDeps(): CheckinStepSummarySinkDeps` 를 신설한다 — `processEnv` 는 **호출 시점의** `process.env`, `append` 는 `fs.appendFileSync` 를 utf-8 로 감싼 얇은 바인딩. 모듈 로드 시점에 값을 캡처하지 않는다(spec 이 env 를 바꿔도 관측돼야 한다).
- [ ] `emitCheckinStepSummaryForSpec(outcome, sectionTitle, deps?): CheckinStepSummaryEmitOutcome` 를 신설한다 — `deps` 미지정(`undefined`) 시 `defaultStepSummarySinkDeps()` 를 쓰고, 지정 시 그 값을 **가공 없이** 그대로 넘긴다. `emitCheckinStepSummary` 를 **정확히 1 회** 호출하고 반환을 **재조립 · 재판정 없이** 그대로 반환한다.
- [ ] **재구현 0** — 단락 판정(`not-compared` / `env-absent` / `env-blank`) · 예외 삼킴 · markdown 문구 · 환경변수명 상수를 본 모듈에서 다시 적지 않는다. 필요한 타입은 sink/emit 모듈에서 import 하거나 그대로 re-export 한다(새 타입 정의 금지).
- [ ] **중복 검증 금지** — `outcome` · `sectionTitle` · 지정된 `deps` 의 형태 검증은 `emitCheckinStepSummary` 계약에 맡기고 본 helper 에서 다시 던지지 않는다(예외는 전파).
- [ ] **exit code 불변** — 본 helper 는 어떤 국면에서도 위임 대상이 던지지 않는 값을 새로 던지지 않는다(관찰-only 계약 보존).
- [ ] `checkCheckinBaselineForSpec` · `seedCheckinBaselineFixture` 의 시그니처 · 동작 · 로그 문자열은 **불변**.
- [ ] 신설 심볼에 한국어 JSDoc(책임 · 기본값 결선 근거 · `@param` · `@returns` · `@throws`) 을 형제 모듈과 같은 밀도로 단다.

테스트 (`test/perf/checkin-baseline-spec-wiring.spec.ts` 에 `describe` 추가, R-112):

- [ ] **happy-path** — `compared` outcome + 주입 `deps`(가짜 `processEnv` + 임시 파일 append) 로 호출 시 `appended` 반환 + 대상 파일에 요약 블록이 정확히 1 회 기록됨.
- [ ] **error path** — (1) 포매터가 던지는 형태 불량 `confirmOrCompare` 입력에서 `failed`(`format-threw`) 반환 + throw 0, (2) `append` 가 던지는 국면에서 `failed`(`append-threw`) 반환 + throw 0.
- [ ] **분기 cover** — `deps` 지정 갈래 / 미지정(기본 바인딩) 갈래, `compared` / 비-`compared`(`skipped`(`not-compared`), 하위 호출 0 회) 갈래, 환경변수 부재(`env-absent`) / 빈-공백(`env-blank`) 갈래 각 1+.
- [ ] **기본 바인딩 검증** — `deps` 미지정 호출이 `process.env[GITHUB_STEP_SUMMARY]` 를 **호출 시점에** 읽는지 확인(spec 안에서 env 를 임시 디렉토리 경로로 설정 → 실제 파일에 기록 → 원복; env 부재 국면은 `skipped`(`env-absent`)). 전역 env 는 국면마다 저장 · 원복해 부작용 0.
- [ ] **negative cases 충분 cover** — (a) `outcome` `null` / `undefined` → `TypeError` 전파, (b) `sectionTitle` non-string → `TypeError` 전파, (c) `sectionTitle` 빈/공백-only → `RangeError` 전파, (d) `deps` 가 지정됐으나 `null` → `TypeError` 전파, (e) `deps.append` non-function → `TypeError` 전파, (f) 비-`compared` 국면에서 주입 `append` 가 **0 회** 호출됨, (g) 인자(`outcome` · `deps`) 가 호출 전후로 변형되지 않음(순수성).
- [ ] `pnpm lint` · `pnpm build` green, `pnpm test` 전량 pass, `pnpm test:cov` 임계 통과(line ≥ 80% / function ≥ 80%) — 변경 모듈은 stmt/branch/func/line 100% 유지.

## Out of Scope

- perf-spec 파일(`*.perf-spec.ts`) 에서 새 helper 를 **실제로 호출**하는 배선 — 다음 slice.
- `.github/workflows/ci.yml` 의 perf step 편입(ADR-0056 `§Follow-ups (b)` 본체).
- 요약 markdown 문구 · 임계 · 회귀 판정 로직 변경(`§Follow-ups (c)` 임계 fix 는 별건).
- `src/` 변경 · PLAN `140 행` / REQ-048 완료 표기 변경(둘 다 **불변** 유지).
- `checkin-baseline-run.ts` · `-step-summary*.ts` 3 모듈 수정(본 task 는 배선 helper 만 건드린다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 여기에 append)
