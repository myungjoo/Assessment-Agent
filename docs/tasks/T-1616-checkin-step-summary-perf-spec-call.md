---
id: T-1616
title: person 실 DB perf-spec 에서 step 요약 배선 helper 를 실호출로 태우기 (첫 route)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 255
estimatedFiles: 1
created: 2026-08-19
createdAt: 2026-08-19T16:42:14Z
independentStream: perf-checkin-baseline
dependsOn: [T-1614, T-1615]
touchesFiles: [test/perf/person-read-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Decision 3 (b) step 요약 축의 첫 실호출처. T-1610~T-1615 조각 5 개를 첫 route 에서 처음으로 실제 실행시킨다.
---

# T-1616 — person 실 DB perf-spec 에서 step 요약 배선 helper 를 실호출로 태우기 (첫 route)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 상대 회귀를
**"로그와 step 요약으로 가시화"** 하라고 못 박았다. 그 축의 조각은 T-1610(포매터) · T-1611(fence
길이) · T-1612(sink) · T-1613(데이터 통로) · T-1614(합성 진입점 `emitCheckinStepSummary`) ·
T-1615(배선 helper `emitCheckinStepSummaryForSpec` + 기본 주입값) 로 **6 slice 전부 머지**됐지만,
`git grep emitCheckinStepSummaryForSpec -- test/` 결과는 여전히 **helper 자신과 그 colocated spec
2 곳뿐**이다 — 즉 실제 perf 실행 경로에서 step 요약이 **단 한 번도 나가지 않는다**. 조각만 쌓고
실호출처가 0 인 상태가 계속되면 `§Decision 3 (b)` 의 가시화 계약은 코드로만 존재하고 CI 화면에는
아무 것도 남지 않는다.

본 slice 는 그 첫 실호출처를 **한 route** 에만 붙인다 — `test/perf/person-read-realdb.perf-spec.ts`
(체크인 baseline 이 가장 먼저 확정된 route, T-1592 → T-1594 로 `baseline-ci-realdb-person-read.json`
체크인 완료). 나머지 4 route(assessment · contribution · summary · app-root) 확산과
`.github/workflows/ci.yml` 편입(`§Follow-ups (b)`)은 각각 별도 slice 다.

**exit code 불변** 은 그대로다 — 요약 경로의 실패(포매터 예외 · append 예외)는 위임이 이미 삼켜
판별 union 으로만 보고하므로(T-1614 계약), 본 배선이 perf 스위트를 red 로 만드는 새 경로를
만들지 않는다(`§Decision 3 (a)` 의 절대 임계만 fail 유지).

## Required Reading

- `test/perf/person-read-realdb.perf-spec.ts` — 본 task 가 **유일하게 수정하는 파일**(628 행).
  특히 `SEED_ROWS`(`76 행`) · `ITERATIONS`(`78 행`) · `WIRING_ITER`(`82 행`) 상수,
  `tmpRoot`(`87 행` 선언 · `105~108 행` `beforeEach` mkdtemp · `110~116 행` `afterEach` rmSync +
  `truncateAll`), `seedPersons`(`125 행`), 그리고 본 task 가 국면을 추가할
  `describe("체크인 baseline 실측 clock 관찰(ci-realdb-person-read)")`(`353~627 행`) 안의 지역
  helper `measureRealClock` · `checkWithLogs` · `enabledEnv` · `expectEnabledOutcome` ·
  `metricsLineOf` 와 상수 `REAL_CLOCK_ITER`(`364 행`) · `realClockEnv`(`370~374 행`) ·
  `METRIC_KEYS`(`376~384 행`), `negative cases 충분 cover` nested describe(`545 행`).
- `test/perf/checkin-baseline-spec-wiring.ts` — 본 task 가 새로 부르는
  `emitCheckinStepSummaryForSpec(outcome, sectionTitle, deps?)`(`deps` 가 `undefined` 일 때만
  `defaultStepSummarySinkDeps()` 로 채우고 `null` 은 그대로 넘겨 위임 `TypeError` 로 노출) ·
  `defaultStepSummarySinkDeps()`(호출 시점 `process.env` + `fs.appendFileSync` utf-8 바인딩) ·
  `seedCheckinBaselineFixture(envMeta, repoRoot, report)`(저장소 실경로 가드 `RangeError`) 계약과
  re-export 타입 `CheckinStepSummarySinkDeps` · `CheckinStepSummaryEmitOutcome`.
- `test/perf/checkin-baseline-step-summary-emit.ts` `26~31 행` · `58~100 행` — 판별 union
  (`appended{path}` / `skipped{not-compared|env-absent|env-blank}` / `failed{format-threw|append-threw}`)
  과 단락 순서(인자 검증 → `status !== "compared"` 단락 → 포매터 1 회 → sink 위임).
- `test/perf/checkin-baseline-step-summary-sink.ts` `23 행`(`GITHUB_STEP_SUMMARY_ENV` 상수) ·
  `96~110 행` — env 부재/공백 단락과 `append-threw` 삼킴 계약. **환경변수명 리터럴을 spec 에 다시
  적지 말고 이 상수를 import** 한다.
- `test/perf/checkin-baseline-spec-wiring.spec.ts` — 이미 cover 된 국면 목록(주입값 형태 위반 ·
  `null` deps 전파 · 기본값 결선). **같은 국면을 perf-spec 에서 재작성하지 않는다**(T-1575 중복
  국면 삭제 선례).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 2` · `§Decision 3 (a) (b)` ·
  `§Follow-ups (b)` — 본 배선의 근거와 exit code 불변 계약.

## Acceptance Criteria

- [ ] `describe("체크인 baseline 실측 clock 관찰(ci-realdb-person-read)")` 안에 **step 요약 축
      전용 nested `describe` 1 개**를 추가하고, 그 안에서만 `emitCheckinStepSummaryForSpec` 을
      부른다. heading 문구는 **spec 지역 상수 1 개**(예: `STEP_SUMMARY_TITLE`)로 두고 국면마다
      리터럴을 반복하지 않는다. 요약 본문 문자열 · 환경변수명 · 판별 슬러그를 **재작성 0**
      (전량 위임 계약과 import 상수 사용).
- [ ] **실호출 배선 1 개(본 slice 의 목적)** — 실측 candidate → `checkWithLogs`(`repoRoot` 생략,
      저장소 실경로 바인딩) 로 얻은 outcome 을 `emitCheckinStepSummaryForSpec(outcome,
      STEP_SUMMARY_TITLE)` 에 **기본 주입값(인자 생략)** 으로 태우는 `it` 1 개. 반환 `status` 는
      실행 환경에 따라 `"appended"` 또는 `"skipped"` 중 하나임을 **하드코딩하지 않고** 단언하되,
      **`"failed"` 는 어떤 경우에도 아님** 과 **예외 0** 을 단언한다(CI 는 `GITHUB_STEP_SUMMARY`
      가 있어 실제 append, 로컬은 `skipped`/`env-absent`). 전역 `process.env` 를 **세팅·삭제하지
      않는다**.
- [ ] **happy-path 1+ (결정적 append 경로)** — `seedCheckinBaselineFixture` 로 `tmpRoot` 안에만
      baseline 을 심고 `repoRoot: tmpRoot` 로 확인 경로를 태워 `status === "compared"` 를
      **결정적으로** 만든 뒤, `processEnv` 에 `tmpRoot` 하위 임시 파일 경로를 실은 주입 `deps`
      로 emit 한다. `status === "appended"` · `path` 가 그 임시 파일과 일치 · append 함수가
      **정확히 1 회** 호출 · 전달 본문에 `STEP_SUMMARY_TITLE` 이 포함됨을 단언한다(본문 전문
      비교 금지 — 포매터 계약은 포매터 spec 의 몫). fixture label 은 실측 label
      (`ci-realdb-person-read`) · 배선 label(`realdb-person-read-wiring`) 과 **분리된 전용 label**
      을 쓴다.
- [ ] **error path 2+** — (a) append 함수가 던지는 주입 `deps` 로 같은 `compared` 국면을 태우면
      **예외 전파 0** 이고 `status === "failed"` · `reason === "append-threw"` 로만 보고된다
      (exit code 불변 직접 증거), (b) 전량 reject 하는 `RequestFn` 의 실측 candidate(errorRate=1 ·
      pass=false) 로 만든 outcome 을 emit 에 태워도 throw 0 이고 요약 경로가 동일 판별 union 으로
      끝난다(오류 표본 축에서도 관찰-only 유지).
- [ ] **분기 cover 3+** — (1) `compared` outcome + env 존재 → `appended` (append 1 회),
      (2) 토글 off(`processEnv: {}` 로 확인 → `skipped`/`disabled`) outcome → emit 은
      `skipped`/`not-compared` 이고 append **0 회**, (3) `compared` outcome + `GITHUB_STEP_SUMMARY`
      부재 → `skipped`/`env-absent`, 공백-only → `skipped`/`env-blank` 이며 두 국면 모두 append
      **0 회**.
- [ ] **negative cases 충분 cover** — 최소 3 종을 각각 별도 `it` 로: (a) emit 호출 전후로
      `process.env[GITHUB_STEP_SUMMARY_ENV]` 값이 **불변**(전역 오염 0 — 주입 record 만 사용),
      (b) 같은 `compared` outcome 을 **연속 2 회** emit 하면 append 가 정확히 2 회 호출되고 두 번째
      호출이 첫 번째와 **같은 본문** 이며 outcome 객체가 변형되지 않는다(부작용 누적 0 ·
      인자 변형 0), (c) `skipped`(not-compared) 국면에서는 주입 append 뿐 아니라 **주입
      `processEnv` 조회도 결과에 영향을 주지 않음** — env 가 있든 없든 동일하게
      `skipped`/`not-compared` 이고 append 0 회. 저장소 실경로(`test/perf/baselines/`) 무오염 ·
      임시 트리 정리는 기존 `afterEach` 가 이미 보장하므로 **재작성 금지**.
- [ ] 기존 국면 불변 — `SEED_ROWS` · `ITERATIONS` · `WIRING_ITER` · `REAL_CLOCK_ITER` ·
      `REAL_CLOCK_ITER_MIN` · `realClockEnv` 값, 기존 `it` 들의 본문과 단언,
      `registerCheckinBaselineWiringSuite` 호출 인자, `beforeAll`/`beforeEach`/`afterEach`/
      `afterAll` 본문을 **수정하지 않는다**(추가만). `src/` · `prisma/` · `.github/` 0 LOC 변경.
- [ ] diff 는 **1 파일 · 300 LOC 이내**를 지킨다. cap 이 위태로우면 negative (c) 를 Follow-ups 로
      이월하고 그 사유를 PR 본문에 1 줄 명시한다.
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요),
      실행 로그에 `[perf][checkin-baseline]` 실측 줄이 종전대로 남는다 — PR 본문에 실호출 `it` 의
      반환 `status` 를 1 줄 인용해 로컬(`skipped`/`env-absent`) 과 CI(append) 의 차이를 박제한다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로
      커버리지 수치 변동이 없어야 한다.

## Out of Scope

- **나머지 4 route 확산 금지** — assessment · contribution · summary · app-root 의
  `*-measure-confirm-realdb.perf-spec.ts` 는 본 task 에서 건드리지 않는다(각각 별도 slice).
- **공유 helper 수정 금지** — `checkin-baseline-spec-wiring.ts` · `checkin-baseline-step-summary*.ts` ·
  `latency-*.ts` · `step-clock.ts` 는 0 LOC 변경. 필요한 계약이 부족하면 helper 를 고치지 말고
  Follow-ups 에 적는다.
- `.github/workflows/ci.yml` 편입 금지 — `§Follow-ups (b)` 는 drift-guard smoke 3 종이 동반돼
  파일 cap 이 걸리는 별도 축이다(T-1122 전례).
- baseline JSON 신규 체크인 · `checkin-baseline-file.spec.ts` 의 `CHECKIN_BASELINES` 표 변경 금지.
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(`§Follow-ups (c)` 의 승격 조건 미충족).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`, T-0877/T-0880 flaky 사고 재발 차단).
- 완료 표기 변경 금지 — PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` 불변(doc-sync 는 별도 slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
