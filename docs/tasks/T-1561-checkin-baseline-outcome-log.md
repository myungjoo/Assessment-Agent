---
id: T-1561
title: 체크인 baseline confirm/compare outcome CI 로그 포매터 박제 (ADR-0056 Follow-up (b) 선행 slice)
phase: P5
status: DONE
completedAt: 2026-08-11T02:55:24Z
prNumber: 1242
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T01:10:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560]
touchesFiles:
  - test/perf/checkin-baseline-report.ts
  - test/perf/checkin-baseline-report.spec.ts
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b) 순수 선행 slice: outcome CI 로그 포매터 (helper+spec × 1.5)"
---

# T-1561 — 체크인 baseline confirm/compare outcome CI 로그 포매터 박제

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 baseline 대비 상대
회귀를 **로그와 step 요약으로 가시화만 하고 exit code 는 바꾸지 않는다** 고 못 박았고,
`§Follow-ups (b)` 는 그 가시화를 기존 `perf test` step 재사용으로 집행하라고 지시한다. 그러나
현재 `confirmOrCompareBaseline` 이 내는 판별 union `ConfirmOrCompareResult` 를 **CI 로그 한 줄로
요약하는 진입점이 없다** — `established` / `compared` 두 국면을 호출측이 각자 `if` 로 풀어 문자열을
조립하면 그 순간 표기가 갈린다.

본 task 는 Follow-up (b) 중 **workflow · perf-spec 을 전혀 건드리지 않는 순수 부분** 만 떼어,
outcome → 한 줄 로그 문자열 변환을 모듈 1 개로 박제한다. 상세 비교 리포트는 이미
`readCompareBaselineFile` 이 만들어 `result.report` 로 넘겨주므로 **재구현 0** — 본 모듈은 그 문자열을
그대로 이어붙일 뿐이다. T-1560 의 경로 helper 와 같은 이유(후속 slice 간 drift 차단)로 선행한다.

완료 선언 0 — [PLAN.md](../PLAN.md) `142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 3`(절대 임계 fail / 상대 회귀 관찰) · `§Decision 4`(기존 step 재사용) · `§Follow-ups (b)` · `§Out of scope`
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) `331~345 행` — `ConfirmOrCompareResult` 판별 union 정의(`established` = `{ outcome, path }` · `compared` = `{ outcome, comparison, report }`)
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) `604~643 행` — `formatComparisonReport` 의 출력 형태(본 task 는 **호출하지 않는다** — `result.report` 가 이미 그 결과라 중복 호출 방지 확인용)
- [test/perf/checkin-baseline-store.ts](../../test/perf/checkin-baseline-store.ts) — T-1560 선행 helper 의 문서화 스타일 · 예외 계약 표기(동형 유지용)
- [CLAUDE.md](../../CLAUDE.md) `§3.2`(R-110 ~ R-112) · `§12`(언어 정책)

## Acceptance Criteria

- [ ] 신규 `test/perf/checkin-baseline-report.ts` 가 다음 3 개를 export 한다.
  - `CHECKIN_LOG_PREFIX` — 로그 grep 축이 되는 고정 접두 문자열 `"[perf][checkin-baseline]"`.
  - `formatCheckinOutcomeLine(result: ConfirmOrCompareResult): string` — **개행 없는 한 줄**.
    `established` → `<prefix> outcome=established path=<result.path>`,
    `compared` → `<prefix> outcome=compared regressed=<true|false>`.
  - `formatCheckinOutcomeBlock(result: ConfirmOrCompareResult): string` — `compared` 면
    `formatCheckinOutcomeLine(result) + "\n" + result.report`, `established` 면 한 줄만(위 line 과 동일).
- [ ] 예외 계약을 명시적으로 구현한다 — `result` 가 non-object · `null` → `TypeError`,
  `outcome` non-string → `TypeError`, `established`/`compared` 아닌 문자열 → `RangeError`,
  `established` 의 `path` non-string → `TypeError` / 빈·공백-only → `RangeError`,
  `compared` 의 `comparison.regressed` non-boolean → `TypeError`,
  `formatCheckinOutcomeBlock` 에서 `report` non-string → `TypeError` / 빈·공백-only → `RangeError`.
- [ ] **exit code 불변 계약** — `regressed === true` 인 입력에도 **throw 하지 않고 문자열만 반환**한다
  (ADR `§Decision 3 (b)`). 이를 검증하는 test 를 둔다.
- [ ] **재구현 0 검증** — 새 파일이 비교 리포트를 다시 만들지 않는다:
  `grep -nE "formatComparisonReport|compareBaseline|p95|delta|toFixed" test/perf/checkin-baseline-report.ts` 결과 **0 건**.
- [ ] **부작용 0 검증** — 새 파일이 `fs` · `process.env` 를 쓰지 않는다:
  `grep -nE "from \"fs\"|require\(\"fs\"\)|process\.env" test/perf/checkin-baseline-report.ts` 결과 0 건.
- [ ] colocated spec `test/perf/checkin-baseline-report.spec.ts` 를 추가하고 아래를 모두 cover 한다.
  - **happy-path** — 3 export 각각 1+ test: 상수 값 일치 / `established` 한 줄에 접두·`path` 원문이 그대로 등장 /
    `compared` 한 줄에 `regressed=false` 등장 / block 이 line + `report` 를 개행 1 개로 이어붙임.
  - **error path** — 위 예외 계약의 **각 유형 1+ test**(`TypeError` · `RangeError` 를 종류까지 단언).
  - **분기 cover** — `established` vs `compared` 두 분기, `regressed` `true` vs `false` 두 분기,
    block 의 `established`(한 줄) vs `compared`(두 덩어리) 두 분기 각각 1+ test.
  - **negative cases 충분 cover** — 위 예외 유형 각 1+ 에 더해: line 결과에 `"\n"` 이 **포함되지 않음**,
    `path` 를 가공·정규화하지 않고 **원문 그대로** 실음(경로 문자열 변형 0), `regressed=true` 여도
    **throw 0**(exit code 불변), `compared` 입력에 `path` 가 섞여 있어도 line 에 `path=` 가 등장하지 않음,
    같은 입력 반복 호출이 항상 같은 문자열을 냄(결정성).
- [ ] `pnpm test` 출력에 새 spec 파일이 실행된 것이 보인다(unit jest `testRegex` 가 `.*\.spec\.ts$` 라 config 편집 불요 — `test/perf/checkin-baseline-store.spec.ts` 와 동일 경로 규약).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일 **2 개** · diff ≤ 300 LOC (cap 준수). 초과 조짐이 보이면 spec 의 중복 case 를 줄여 cap 안에서 끝낸다.

## Out of Scope

- **`.github/workflows/ci.yml` 편집** — Follow-up (b) 본체의 workflow 부분(본 task 는 순수 포매터만).
- **기존 measure→confirm perf-spec 5 개 배선 변경** — 어느 spec 도 본 포매터를 아직 호출하지 않는다(배선은 별도 slice).
- **`test/perf/baselines/` 아래 baseline JSON 생성·commit** — Follow-up (a).
- `test/perf/latency-baseline.ts` · `latency-baseline-io.ts` · `checkin-baseline-store.ts` 수정.
- 회귀 시 `throw` · exit code 변경 · 임계값 `DEFAULT_P95_MAX_MS = 3000` 변경(ADR `§Decision 3` 위배).
- 부하계획 `§ 3` 임계 확정 · `§ 5` item 4/5 본문 갱신 · PLAN `142 행` · REQ-048 재판정(전부 doc-sync 별건).
- 신규 dependency 추가 · `test/perf/README.md` 계수 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## 결과 (2026-08-11 완료)

- **DONE** — `pr` mode PR **#1242** squash merge (`9fb32a7f`). 변경 **2 파일 `+289/-0`** (cap `300 LOC / 5 파일` 이내).
- 산출: `test/perf/checkin-baseline-report.ts` (신규 3 export — `CHECKIN_LOG_PREFIX` 상수 · `formatCheckinOutcomeLine` · `formatCheckinOutcomeBlock`) + colocated spec `test/perf/checkin-baseline-report.spec.ts` (happy/error/branch/negative 4 종).
- 형태 검증을 `requireOutcome` / `requireNonBlankString` 공유 helper 로 모아 line/block 의 예외 계약(TypeError/RangeError) 을 일치시켰다.
- 상세 비교 리포트 **재구현 0** (`result.report` 위임) · **부작용 0** (`fs` / `process.env` 무의존) · exit code 불변 (`regressed=true` 여도 throw 0).
- 4-게이트 충족 — reviewer APPROVE (round 1) PR comment 외화 + integrator 자체 점검 + PR CI 2 job pass (run `31453532518`) + squash merge.
- R-110/R-112 충족: unit **431 suite / 12355 test** pass, `test:cov` line·function 임계 80% 통과.
- Out of Scope 보존 — `ci.yml` 편집 0 · 기존 perf-spec 미변경 · baseline JSON 생성 0 · PLAN / REQ-048 재판정 0.
