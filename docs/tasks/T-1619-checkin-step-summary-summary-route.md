---
id: T-1619
title: summary 실 DB perf-spec 으로 step 요약 실호출 확산 (네 번째 route)
phase: P5
status: SUPERSEDED
supersededAt: 2026-08-20T02:37:58Z
supersededBy: owner-directive-PLAN-144
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-08-20
createdAt: 2026-08-20T01:52:00Z
independentStream: perf-checkin-baseline
dependsOn: [T-1618]
touchesFiles: [test/perf/summary-measure-confirm-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Decision 3 (b) step 요약 실호출을 person·assessment·contribution 에 이어 네 번째 route(summary) 로 확산. period 2 차 필터 고유 seam 만, 일반 계약 복제 금지.
---

# T-1619 — summary 실 DB perf-spec 으로 step 요약 실호출 확산 (네 번째 route)

## Superseded

**SUPERSEDED (2026-08-20T02:37:58Z) — 오너 지시로 무효화.** 오너가 main `e9c3fa6f`
(2026-08-20T02:29Z) 에서 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) 를
ACCEPTED 로 flip 하고 `docs/PLAN.md` `144 행` 에 **"R-91 k6 부하검증 최우선·즉시 착수, R-92
per-route perf baseline churn 중단"** 을 확정했다. 본 task 의 큐잉 시각(`01:52Z`) 이 그 지시
(`02:29Z`) 보다 앞서, 지시 대상인 R-92 per-route churn slice 에 정확히 해당한다. driver 가 claim 만
하고 **실행 없이** 본 supersede 로 종결한다(코드 변경 0).

잔여 2 route(`summary` · `app-root`) 의 step 요약 실호출 확산은 `docs/PLAN.md` `145 행`(신규
per-route baseline slice 큐잉 금지) 에 따라 **신규 slice 로 큐잉하지 않는다** — 필요 시 훗날 다른
사유로 해당 perf-spec 을 건드리는 task 가 있을 때 그 안에 흡수한다. 아래 본문은 historical record
로 보존한다(삭제 금지).

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 의 "상대 회귀를 로그와
step 요약으로 가시화" 계약은 T-1610~T-1615 6 slice 로 조각이 다 갖춰졌고, T-1616(person) ·
T-1617(assessment) · T-1618(contribution) 이 실호출처 **3 개** 를 열어 CI 로그에 emit
`status=appended` 실측 줄을 박았다. 그러나 체크인 baseline 이 확정된 route 는
`baseline-ci-realdb-{person,assessment,contribution,summary,app-root}-read.json` **5 개** 인데
실호출은 아직 3 개뿐이라, 나머지 2 route 는 회귀를 비교하고도 CI 화면에 아무 것도 남기지 않는다.

본 slice 는 그 확산의 **네 번째 route** 만 맡는다 —
`test/perf/summary-measure-confirm-realdb.perf-spec.ts` (실측 label `ci-realdb-summary-read`,
체크인 baseline `test/perf/baselines/baseline-ci-realdb-summary-read.json` 확정 완료). 마지막
1 route(app-root) 와 `.github/workflows/ci.yml` 편입(`§Follow-ups (b)`) 은 각각 별도 slice 다.

본 route 의 고유 seam 은 앞 세 route 에 없던 **`personId` + `period` 2 차 필터 조합**(같은 부모의
부분집합을 week `WEEK_ROWS`=3 · month `MONTH_ROWS`=2 로 자르는 축) · **`@@unique([personId, period,
periodStart])` 를 회피하는 seed 형태** · **`personId` 필수 파라미터 누락 전량 400 표본** 이다. 국면은
그 축들 중심으로만 새로 쓰고, 주입값 형태 위반 · `null` deps 전파 · 기본값 결선 같은 **일반 계약
국면은 helper colocated spec 과 앞 세 route 가 이미 cover** 하므로 복제하지 않는다(T-1575 중복 국면
삭제 선례).

**exit code 불변** 은 그대로다 — 요약 경로의 실패(포매터 예외 · append 예외)는 위임이 이미 삼켜
판별 union 으로만 보고하므로(T-1614 계약) 본 배선이 perf 스위트를 red 로 만드는 새 경로를 만들지
않는다(`§Decision 3 (a)` 의 절대 임계만 fail 유지).

## Required Reading

- `test/perf/summary-measure-confirm-realdb.perf-spec.ts` — 변경 대상. 특히 `seed()` ·
  `read()` helper, `WEEK_ROWS`/`MONTH_ROWS`/`TOTAL_ROWS` 상수, `describe("체크인 baseline 실측 clock
  관찰(ci-realdb-summary-read)")` 블록의 지역 helper(`measureRealClock` · `checkWithLogs` ·
  `enabledEnv` · `expectEnabledOutcome`).
- `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` — **읽기 전용 정본 패턴**
  (`describe("step 요약 배선 실호출(emitCheckinStepSummaryForSpec)")` 블록 구조 · `STEP_SUMMARY_TITLE`
  상수 · 요약 축 전용 label · `depsWith` 지역 helper). 0 LOC 변경.
- `test/perf/checkin-baseline-spec-wiring.ts` — `emitCheckinStepSummaryForSpec` 시그니처와
  `CheckinStepSummarySinkDeps` 계약 (0 LOC 변경).
- `test/perf/checkin-baseline-step-summary-emit.ts` — `CheckinStepSummaryEmitOutcome` 판별 union
  (`appended` · `not-compared` · `env-absent` · `env-blank` · `append-threw`) 확인용 (0 LOC 변경).
- `test/perf/checkin-baseline-step-summary-sink.ts` — `GITHUB_STEP_SUMMARY_ENV` 상수 (0 LOC 변경).
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md)
  — `§Decision 3 (a)(b)` · `§Follow-ups (a)(b)`.

## Acceptance Criteria

- [ ] `test/perf/summary-measure-confirm-realdb.perf-spec.ts` 의 `ci-realdb-summary-read` 실측
      describe 안에 `describe("step 요약 배선 실호출(emitCheckinStepSummaryForSpec)")` 블록 1 개를
      **추가만** 으로 넣는다 (기존 상수 · `it` 본문 · 훅 · suite factory 인자 무수정).
- [ ] **happy-path** — 실 clock candidate 를 확인 경로에 태운 뒤 `emitCheckinStepSummaryForSpec` 을
      실호출해 `outcome.status === "appended"` 이고 append 대상 파일 본문에 `STEP_SUMMARY_TITLE`
      heading 이 포함됨을 단언하는 `it` 1+.
- [ ] **error path** — (1) 주입 append 가 throw 하면 판별 union 이 `append-threw` 로 보고되고
      **예외가 밖으로 전파되지 않음**, (2) 본 route 고유 축인 `personId` 누락 전량 400 표본
      (`errorRate=1`) 에서도 요약 경로가 throw 0 임을 단언하는 `it` 각 1+ (총 2+).
- [ ] **분기 cover** — `CheckinStepSummaryEmitOutcome` 의 `appended` · `not-compared` ·
      `env-absent`|`env-blank` 분기를 각각 도달시키는 단언 1+ (`it` 1~2 개로 묶어도 무방).
- [ ] **negative cases 충분 cover** — 최소 2 종: (1) 전역 `process.env` 를 읽지도 쓰지도 않음
      (`GITHUB_STEP_SUMMARY` 전역 키가 실행 전후 불변), (2) 본 route 고유 축인 `period=week`(3 건) ·
      `period=month`(2 건) 두 실측 표본이 서로 독립적으로 요약 경로를 통과(한쪽 결과가 다른 쪽 append
      본문을 오염시키지 않음).
- [ ] 요약 heading 문구는 상수 1 개(`STEP_SUMMARY_TITLE`), 환경변수명은 `GITHUB_STEP_SUMMARY_ENV`
      import 로만 쓴다 — 리터럴 재작성 0.
- [ ] append 대상 경로는 **격리 tmpRoot 아래** 만 쓴다 (`test/perf/baselines/` · 저장소 실경로 오염 0).
- [ ] `pnpm lint && pnpm build` green, `pnpm test` 전량 pass, `pnpm test:cov` 통과
      (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일 **1 개** · diff ≤ 300 LOC (신규 `it` 7 개 이내로 유지 — T-1616~T-1618 이 각각
      +281~+293 LOC 로 착지한 선례).

## Out of Scope

- **마지막 1 route 확산 금지** — `app-root-measure-confirm-realdb.perf-spec.ts` 는 본 task 에서
  건드리지 않는다(별도 slice). `person-read-realdb.perf-spec.ts` ·
  `assessment-measure-confirm-realdb.perf-spec.ts` · `contribution-measure-confirm-realdb.perf-spec.ts`
  는 **읽기 전용**(참조만, 0 LOC 변경).
- **공유 helper 수정 금지** — `checkin-baseline-spec-wiring.ts` · `checkin-baseline-step-summary*.ts` ·
  `latency-*.ts` · `step-clock.ts` 는 0 LOC 변경. 계약이 부족하면 helper 를 고치지 말고 Follow-ups 에
  적는다.
- `.github/workflows/ci.yml` 편입 금지 — `§Follow-ups (b)` 는 drift-guard smoke 3 종이 동반돼 파일
  cap 이 걸리는 별도 축이다(T-1122 전례 / Q-0054).
- baseline JSON 신규 체크인 · `checkin-baseline-file.spec.ts` 의 `CHECKIN_BASELINES` 표 변경 금지.
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(`§Follow-ups (c)` 승격 조건 미충족).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`, T-0877/T-0880 flaky 사고 재발 차단).
- 일반 계약 국면(주입값 형태 위반 · `null` deps 전파 · 기본값 결선) 복제 금지 — helper colocated
  spec 과 앞 세 route 가 이미 cover.
- `src/` · `prisma/` · 완료 표기(PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS`) 변경 금지 — doc-sync 는
  별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
