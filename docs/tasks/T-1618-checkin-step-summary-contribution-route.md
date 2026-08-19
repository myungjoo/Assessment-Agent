---
id: T-1618
title: contribution 실 DB perf-spec 으로 step 요약 실호출 확산 (세 번째 route)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-08-19
createdAt: 2026-08-19T20:37:34Z
independentStream: perf-checkin-baseline
dependsOn: [T-1617]
touchesFiles: [test/perf/contribution-measure-confirm-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Decision 3 (b) step 요약 실호출을 person·assessment 에 이어 세 번째 route(contribution) 로 확산. 3-level FK 고유 seam 중심, 일반 계약 복제 금지.
---

# T-1618 — contribution 실 DB perf-spec 으로 step 요약 실호출 확산 (세 번째 route)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 의 "상대 회귀를
로그와 step 요약으로 가시화" 계약은 T-1610~T-1615 6 slice 로 조각이 다 갖춰졌고, T-1616(person) ·
T-1617(assessment) 이 실호출처 **2 개** 를 열어 CI 로그에 emit `status=appended` 실측 줄을 박았다.
그러나 체크인 baseline 이 확정된 route 는
`baseline-ci-realdb-{person,assessment,contribution,summary,app-root}-read.json` **5 개** 인데
실호출은 아직 2 개뿐이라, 나머지 3 route 는 회귀를 비교하고도 CI 화면에 아무 것도 남기지 않는다.

본 slice 는 그 확산의 **세 번째 route** 만 맡는다 —
`test/perf/contribution-measure-confirm-realdb.perf-spec.ts`
(실측 label `ci-realdb-contribution-read`, 체크인 baseline
`test/perf/baselines/baseline-ci-realdb-contribution-read.json` 확정 완료). 나머지 2 route
(summary · app-root) 와 `.github/workflows/ci.yml` 편입(`§Follow-ups (b)`) 은 각각 별도 slice 다.

본 route 의 고유 seam 은 앞 두 route 에 없던 **`Person → Assessment → Contribution` 3-level FK
chain 의 부모 선택 축**(부모 A 자식 5 건 vs 부모 B 자식 3 건) · **`assessmentId` 필수 파라미터 누락
전량 400 표본** · **무-매칭 부모 id 의 200 + 빈 배열 표본** 이다. 국면은 그 축들 중심으로만 새로 쓰고,
주입값 형태 위반 · `null` deps 전파 · 기본값 결선 같은 **일반 계약 국면은 helper colocated spec 과
앞 두 route 가 이미 cover** 하므로 복제하지 않는다(T-1575 중복 국면 삭제 선례).

**exit code 불변** 은 그대로다 — 요약 경로의 실패(포매터 예외 · append 예외)는 위임이 이미 삼켜
판별 union 으로만 보고하므로(T-1614 계약) 본 배선이 perf 스위트를 red 로 만드는 새 경로를 만들지
않는다(`§Decision 3 (a)` 의 절대 임계만 fail 유지).

## Required Reading

- `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` — 본 task 가 **유일하게 수정하는
  파일**(596 행). 특히 import 블록(`8~44 행`) · 상수 `PRIMARY_CHILDREN`/`OTHER_CHILDREN`
  (`50~51 행`) · `ITER`(`52 행`) · `WIRING_ITER`(`55 행`) · `lastStatus`(`63 행`) ·
  `tmpRoot`(`64 행` 선언 · `77 행` `beforeEach` mkdtemp · `81 행` `afterEach` rmSync) ·
  `dirOf`(`90~92 행`) · `qOf`(`93 행`) · `seed`(`420 행` 부근, Person 1 → Assessment 2 → 자식
  5 + 3) · `read(query, authed = true)`(`457 행` 부근, `authed=false` 면 401 분기) ·
  `rows`(`146 행`), 그리고 본 task 가 국면을 추가할
  `describe("체크인 baseline 실측 clock 관찰(ci-realdb-contribution-read)")`(`324 행` ~ 파일 끝)
  안의 지역 helper `measureRealClock` · `checkWithLogs` · `enabledEnv` · `expectEnabledOutcome` ·
  `metricsLineOf` 와 상수 `REAL_CLOCK_ITER`(`334 행`) · `REAL_CLOCK_ITER_MIN`(`336 행`) ·
  `realClockEnv`(`345~349 행`) · `METRIC_KEYS`(`351~359 행`).
- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` `595~875 행` — T-1617 이 승계한
  **정본 패턴**(nested `describe("step 요약 배선 실호출(emitCheckinStepSummaryForSpec)")` + 지역
  helper `STEP_SUMMARY_TITLE` · `summaryEnv` · `SUMMARY_ITER` · `probe` · `depsWith` ·
  `summaryPathOf` · `checkForSummary` · `summaryCandidate` · `comparedFor`) 와 import 블록
  `35~42 행`(`emitCheckinStepSummaryForSpec` · `seedCheckinBaselineFixture` ·
  `CheckinStepSummaryEmitOutcome` · `CheckinStepSummarySinkDeps` · `GITHUB_STEP_SUMMARY_ENV`).
  **구조만 승계**하고 문구 · label · 국면 수는 본 route 에 맞게 갈아끼운다(국면 전량 1:1 복제 금지).
- `test/perf/checkin-baseline-spec-wiring.ts` `60 행`(`checkCheckinBaselineForSpec`) ·
  `88 행`(`seedCheckinBaselineFixture(envMeta, repoRoot, report)` — 저장소 실경로 가드 `RangeError`) ·
  `132 행`(`defaultStepSummarySinkDeps()`) · `162 행`
  (`emitCheckinStepSummaryForSpec(outcome, sectionTitle, deps?)` — `deps` 가 `undefined` 일 때만
  기본값으로 채우고 `null` 은 그대로 넘겨 위임 `TypeError` 로 노출).
- `test/perf/checkin-baseline-step-summary-emit.ts` `26~31 행` · `58~100 행` — 판별 union
  (`appended{path}` / `skipped{not-compared|env-absent|env-blank}` / `failed{format-threw|append-threw}`)
  과 단락 순서(인자 검증 → `status !== "compared"` 단락 → 포매터 1 회 → sink 위임).
- `test/perf/checkin-baseline-step-summary-sink.ts` `23 행`(`GITHUB_STEP_SUMMARY_ENV` 상수) ·
  `96~110 행` — env 부재/공백 단락과 `append-threw` 삼킴 계약. **환경변수명 리터럴을 spec 에 다시
  적지 말고 이 상수를 import** 한다.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 2` · `§Decision 3 (a) (b)` ·
  `§Follow-ups (b)` — 본 배선의 근거와 exit code 불변 계약.

## Acceptance Criteria

- [ ] `describe("체크인 baseline 실측 clock 관찰(ci-realdb-contribution-read)")` 안에 **step 요약 축
      전용 nested `describe` 1 개**를 추가하고 그 안에서만 `emitCheckinStepSummaryForSpec` 을
      부른다. heading 문구는 **spec 지역 상수 1 개**(예: `STEP_SUMMARY_TITLE`)로 두고, 요약 본문
      문자열 · 환경변수명 · 판별 슬러그는 **재작성 0**(전량 위임 계약 + import 상수 사용).
      요약 축 fixture label 은 실측 label(`ci-realdb-contribution-read`) · 배선 label
      (`realdb-contrib-mc`) 과 **분리된 전용 label**(예: `realdb-contrib-step-summary`)을 쓴다.
- [ ] **실호출 배선 1 개(본 slice 의 목적)** — 실측 candidate → `checkWithLogs`(`repoRoot` 생략,
      저장소 실경로 바인딩) 로 얻은 outcome 을
      `emitCheckinStepSummaryForSpec(outcome, STEP_SUMMARY_TITLE)` 에 **기본 주입값(인자 생략)** 으로
      태우는 `it` 1 개. 반환 `status` 를 하드코딩하지 않고 **`"failed"` 가 아님** · **예외 0** ·
      `["appended","skipped"]` 중 하나임을 단언하며, 로컬(`skipped`/`env-absent`)과 CI(append)의
      차이를 `CHECKIN_LOG_PREFIX` 접두 로그 1 줄로 박제한다. 전역 `process.env` 는 **세팅 · 삭제
      하지 않는다**.
- [ ] **happy-path 1+ (결정적 append 경로)** — `seedCheckinBaselineFixture` 로 `tmpRoot` 안에만
      기준 baseline 을 심고 `repoRoot: tmpRoot` 로 확인 경로를 태워 `status === "compared"` 를
      **결정적으로** 만든 뒤, `processEnv` 에 `tmpRoot` 하위 임시 파일 경로를 실은 주입 `deps` 로
      emit 한다. `status === "appended"` · `path` 가 그 임시 파일과 일치 · append 함수가 **정확히
      1 회** 호출 · 전달 본문에 `STEP_SUMMARY_TITLE` 포함을 단언한다(본문 전문 비교 금지 — 포매터
      계약은 포매터 spec 의 몫).
- [ ] **error path 2+** — (a) append 함수가 던지는 주입 `deps` 로 같은 `compared` 국면을 태우면
      **예외 전파 0** 이고 `status === "failed"` · `reason === "append-threw"` 로만 보고된다
      (exit code 불변 직접 증거), (b) **본 route 고유 필수 파라미터 축** — `read("")`
      (`assessmentId` 누락 → 전량 400 · `errorRate=1` · `count=0`) 표본으로 만든 outcome 을 emit 에
      태워도 throw 0 이고 동일 판별 union 으로 끝난다(오류 표본 축에서도 관찰-only 유지).
- [ ] **분기 cover 3+** — (1) `compared` outcome + 주입 env 존재 → `appended`(append 1 회),
      (2) 토글 off(`processEnv: {}` 로 확인 → `skipped`/`disabled`) outcome → emit 은
      `skipped`/`not-compared` 이고 append **0 회**, (3) `compared` outcome + `GITHUB_STEP_SUMMARY`
      부재 → `skipped`/`env-absent`, 공백-only → `skipped`/`env-blank` 이며 두 국면 모두 append
      **0 회**.
- [ ] **negative cases 충분 cover** — 최소 2 종을 각각 별도 `it` 로: (a) emit 호출 전후로
      `process.env[GITHUB_STEP_SUMMARY_ENV]` 값이 **불변**(전역 오염 0 — 주입 record 만 사용),
      (b) **본 route 고유 3-level FK 부모 선택 축** — 부모 A(자식 `PRIMARY_CHILDREN` 행) 와
      부모 B(자식 `OTHER_CHILDREN` 행) 두 표본의 outcome 을 연속 emit 해도 두 호출이 서로
      독립이다: append 가 각 1 회씩 정확히 2 회 호출되고, 두 outcome 객체가 **변형되지 않으며**,
      두 번째 호출 결과가 첫 번째의 상태를 이어받지 않는다(부작용 누적 0 · 인자 변형 0).
      저장소 실경로(`test/perf/baselines/`) 무오염 · 임시 트리 정리는 기존 `afterEach` 가 이미
      보장하므로 **재작성 금지**.
- [ ] 기존 국면 불변 — `PRIMARY_CHILDREN` · `OTHER_CHILDREN` · `ITER` · `WIRING_ITER` ·
      `REAL_CLOCK_ITER` · `REAL_CLOCK_ITER_MIN` · `realClockEnv` · `METRIC_KEYS` 값, 기존 `it` 들의
      본문과 단언, `registerCheckinBaselineWiringSuite` 호출 인자,
      `beforeAll`/`beforeEach`/`afterEach`/`afterAll` 본문을 **수정하지 않는다**(추가만).
      `src/` · `prisma/` · `.github/` **0 LOC** 변경.
- [ ] diff 는 **1 파일 · 300 LOC 이내**를 지킨다. 신규 `it` 은 **7 개 이내** 로 묶고(앞 route 국면을
      그대로 복제하지 않는다 — 일반 계약 국면은 이미 cover 됨), cap 이 위태로우면 분기 (3) 의
      공백-only 국면을 Follow-ups 로 이월하고 그 사유를 PR 본문에 1 줄 명시한다.
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요),
      실행 로그에 `[perf][checkin-baseline]` 실측 줄이 종전대로 남는다 — PR 본문에 실호출 `it` 의
      반환 `status` 를 1 줄 인용한다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로
      커버리지 수치 변동이 없어야 한다.

## Out of Scope

- **나머지 2 route 확산 금지** — summary · app-root 의 `*-measure-confirm-realdb.perf-spec.ts` 는
  본 task 에서 건드리지 않는다(각각 별도 slice). `person-read-realdb.perf-spec.ts` ·
  `assessment-measure-confirm-realdb.perf-spec.ts` 도 **읽기 전용**(참조만, 0 LOC 변경).
- **공유 helper 수정 금지** — `checkin-baseline-spec-wiring.ts` · `checkin-baseline-step-summary*.ts` ·
  `latency-*.ts` · `step-clock.ts` 는 0 LOC 변경. 필요한 계약이 부족하면 helper 를 고치지 말고
  Follow-ups 에 적는다.
- `.github/workflows/ci.yml` 편입 금지 — `§Follow-ups (b)` 는 drift-guard smoke 3 종이 동반돼
  파일 cap 이 걸리는 별도 축이다(T-1122 전례 / Q-0054).
- baseline JSON 신규 체크인 · `checkin-baseline-file.spec.ts` 의 `CHECKIN_BASELINES` 표 변경 금지.
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(`§Follow-ups (c)` 의 승격 조건 미충족).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`, T-0877/T-0880 flaky 사고 재발 차단).
- 완료 표기 변경 금지 — PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` 불변(doc-sync 는 별도 slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)

## 완료 기록

- 완료: 2026-08-19T22:03:55Z (`cron@aa-local-9cf72b03` fire)
- PR [#1296](https://github.com/myungjoo/Assessment-Agent/pull/1296) squash 머지 `a099c4a2` — 1 파일 `+281/-1`
  (`test/perf/contribution-measure-confirm-realdb.perf-spec.ts` 만 변경, `src/`·`prisma/`·`.github/` **0 LOC**).
- 결과: ADR-0056 `§Decision 3 (b)` step 요약 실호출을 person·assessment 에 이어 **세 번째 route(contribution)** 로 확산.
  요약 축 전용 label(`realdb-contrib-step-summary`) + `STEP_SUMMARY_TITLE` 상수 1 개 + 지역 helper 6 종만 추가하고
  기존 상수·`it` 본문·훅은 무수정(추가만). CI 로그에 emit `status=appended` 실측 1 줄 박제.
- R-112: 신규 `it` **7 개**(실호출 1 · happy/분기 1 · error 2(`append-threw` · `assessmentId` 누락 400 전량 표본) ·
  분기 1 · negative 2(전역 env 불변 · 부모 A/B 두 표본 독립)), 4-게이트 4/4
  (reviewer VERDICT=APPROVE round 1/7 + PR comment 외화 + integrator 자체 점검 + PR CI green).
