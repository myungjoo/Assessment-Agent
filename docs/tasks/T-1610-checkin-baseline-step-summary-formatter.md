---
id: T-1610
title: 체크인 baseline confirm-or-compare 결과의 CI step 요약 markdown 포매터 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-19
createdAt: 2026-08-19T03:40:04Z
independentStream: perf-checkin-baseline
dependsOn: [T-1607]
touchesFiles:
  - test/perf/checkin-baseline-step-summary.ts
  - test/perf/checkin-baseline-step-summary.spec.ts
plannerNote: P5 perf — ADR-0056 §Decision 3 (b) 의 미착수 축 "step 요약" 진입점(순수 포매터만, io·workflow 0). 리포트 재구현 0 으로 T-1583 report 모듈 승계.
---

# T-1610 — 체크인 baseline confirm-or-compare 결과의 CI step 요약 markdown 포매터 추가

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 baseline 대비 상대
회귀를 **"로그와 step 요약으로 가시화만 하고 exit code 를 바꾸지 않는다"** 고 못 박았다. 이 중 **로그**
축은 `checkin-baseline-report.ts`(`CHECKIN_LOG_PREFIX` · `formatCheckinOutcomeLine` /
`formatCheckinOutcomeBlock`) 로 단일 진입점이 잡혔고, T-1584 의 `PERF_CHECKIN_BASELINE` 토글 +
T-1592 ~ T-1607 의 5 route 체크인으로 CI 가 실제 `compared` 국면을 돈다. 그러나 **step 요약 축은
저장소 전체에서 한 줄도 착수되지 않았다** — `GITHUB_STEP_SUMMARY` · "step 요약" 표기를 `test/` ·
`.github/` 어디에서도 조립하지 않으므로, 회귀 관찰 결과는 수천 줄 CI 로그 안에서만 보이고 job 요약
화면에는 전혀 뜨지 않는다. 관찰-only 정책(`exit code` 불변)에서 **가시성이 유일한 신호**라는 점에서
이 공백은 ADR 결정의 절반이 미집행 상태라는 뜻이다.

본 slice 는 그 공백의 **첫 조각인 순수 포매터 1 개**만 연다 — `ConfirmOrCompareResult` 를 GitHub
Actions job 요약용 markdown 블록으로 바꾸는 진입점이다. 저장소가 이미 쓰는 분해 패턴
(`report`(순수 문자열) → `wiring`/`suite`(배선) → workflow) 을 그대로 승계해, **파일 시스템 write ·
환경변수 read · workflow 변경은 본 task 에 0** 이다. `$GITHUB_STEP_SUMMARY` 실제 append 와 `ci.yml`
노출은 본 포매터를 입력으로 삼는 다음 slice 의 몫이다.

`§Decision 2`(갱신 주체는 pr-mode task 뿐) · `§Decision 3 (b)`(상대 회귀는 관찰만) 는 그대로다 —
본 task 는 표기 수단 하나를 더할 뿐이며 판정 · 임계 · exit code · baseline JSON 을 건드리지 않는다.
[PLAN.md](../PLAN.md) `140 행` 성능 검증 bullet 은 `[ ]` 유지, REQ-048 상태 표기도 불변이다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 3 (b)` (관찰-only · 로그와 step 요약) · `§Follow-ups (b)`.
- [test/perf/checkin-baseline-report.ts](../../test/perf/checkin-baseline-report.ts) — `CHECKIN_LOG_PREFIX` · `formatCheckinOutcomeLine` · `formatCheckinOutcomeBlock` 의 예외 계약(재사용 대상, 재구현 금지).
- [test/perf/checkin-baseline-report.spec.ts](../../test/perf/checkin-baseline-report.spec.ts) — 순수 포매터 spec 의 서술 · 국면 분해 패턴(본 task 의 colocated spec 이 그대로 승계).
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) `331~333 행` — `ConfirmOrCompareResult` union 정의.
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) `164~183 행` — `BaselineComparison.regressed` 계약(throughput 미반영).

## Acceptance Criteria

- [ ] `test/perf/checkin-baseline-step-summary.ts` 신설 — **순수 함수 1 개**를 export 한다:
      `formatCheckinStepSummaryBlock(result: ConfirmOrCompareResult, sectionTitle: string): string`.
      본문은 ① `## <sectionTitle>` markdown heading, ② 회귀 관찰 상태 한 줄
      (`compared` + `regressed === true` → 회귀 관찰됨 / `compared` + `false` → 회귀 없음 /
      `established` → 해당 없음), ③ `formatCheckinOutcomeBlock(result)` 결과를 감싼 fenced code
      block 을 순서대로 이어붙인다. 상태 줄에는 **exit code 불변(관찰-only)** 임을 명시한다.
- [ ] **리포트 재구현 0** — 수치 계산 · 재포맷 · 임계 판정 · 반올림을 본 모듈에서 하지 않고
      `formatCheckinOutcomeBlock` 결과 문자열을 그대로 싣는다. `CHECKIN_LOG_PREFIX` 같은 기존
      상수를 새 문자열로 다시 적지 않는다 (import 로 참조).
- [ ] **부작용 0** — 파일 시스템 접근 · `process.env` read/write · 시각 · 난수 사용이 0 이며 인자를
      변형하지 않는다. `regressed === true` 입력에도 **throw 하지 않는다**(ADR-0056 §Decision 3 (b)).
- [ ] colocated spec `test/perf/checkin-baseline-step-summary.spec.ts` 신설 — **happy-path** test 1+:
      `compared`(회귀 있음 · 회귀 없음 두 국면) 와 `established` 국면 각각에서 heading · 상태 줄 ·
      code block 이 기대 순서로 조립되는지 단언.
- [ ] **error path** test 1+ — `result` 가 non-object · `null` 일 때 `TypeError`, `outcome` 이 허용 밖
      문자열일 때 `RangeError` 가 (하위 진입점에서 전파되어) 나오는지 단언.
- [ ] **분기 cover** — `outcome === "established"` / `"compared" + regressed=true` /
      `"compared" + regressed=false` 3 분기 각각 1+ test.
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: (a) `sectionTitle` 이 non-string →
      `TypeError`, (b) `sectionTitle` 이 빈/공백-only → `RangeError`, (c) `compared` 의 `report` 가
      빈/공백-only → `RangeError`, (d) `regressed` 가 non-boolean → 예외 계약대로 거부,
      (e) 회귀 입력에서 **throw 0** 임을 명시 단언(관찰-only 계약 보호),
      (f) 같은 입력 2 회 호출이 같은 문자열을 내고 인자가 변형되지 않음(순수성).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일 2 개 · diff ≤ 300 LOC 유지 (모듈 본문은 주석 포함 ~90 LOC 이내로 억제).

## Out of Scope

- `$GITHUB_STEP_SUMMARY` 로의 실제 append(파일 io) — 다음 slice.
- `.github/workflows/ci.yml` 변경 (perf step · 토글 · 요약 노출) 0.
- 기존 `*-measure-confirm-realdb` / `*-read-realdb` perf-spec 배선 변경 0 (본 모듈을 호출하는 곳을
  만들지 않는다).
- `test/perf/baselines/*.json` 추가 · 갱신 0, `CHECKIN_BASELINES` 가드 표 변경 0.
- 상대 회귀의 fail 승격 · tolerance 재산정 (ADR-0056 §Decision 3 (b) 의 20 run 표본 조건 미충족).
- `docs/PLAN.md` · `docs/requirements.md` · 부하계획 완료 표기 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)

## 결과 (2026-08-19T04:48:40Z, DONE)

- `pr` mode — PR [#1288](https://github.com/myungjoo/Assessment-Agent/pull/1288) squash 머지 `93bd570b` + branch 삭제 확인. 2 파일 `+261/-0`, `src/` 0 LOC.
- `formatCheckinStepSummaryBlock` 순수 함수 1 개 신설 — heading · 상태 줄 · code block 순서 조립만 자기 책임이고, 결과 형태 검증 · 본문 조립은 `formatCheckinOutcomeBlock` 에 위임해 **리포트 재구현 0 · 상수 재기술 0**. fs · env · 시각 · 난수 접근 0, 인자 변형 0, 호출처 신설 0 (Out of Scope 준수).
- **관찰-only 계약 유지** — 회귀 입력에도 throw 0 이라 `§Decision 3 (b)` 의 "가시화만 하고 exit code 를 바꾸지 않는다" 가 포매터 층에서 그대로 성립.
- **R-112** — 신규 spec 19 국면(happy 4 · 분기 3 · error path 4 · negative (a)~(f) 8). 신규 모듈 stmt/branch/func/line **100%**. 로컬 439 suite · 12595 test pass, `lint` · `build` green, global coverage line · function 임계 충족.
- **4-게이트** — reviewer VERDICT=APPROVE(round 1, comment `#issuecomment-5337634326`) + PR comment 외화 + integrator 자체 점검 + PR CI green 으로 4/4. Nit 1 건(코드 울타리 길이 고정) 은 다음 배선 slice 로 이관.
- **남은 축** — `$GITHUB_STEP_SUMMARY` 실제 append 와 `ci.yml` 노출은 미착수(다음 slice). ADR-0056 `§Follow-ups (b)`(본체 ci.yml perf step 편입) · `§Follow-ups (c)`(20 run 표본 미충족) 도 그대로.
