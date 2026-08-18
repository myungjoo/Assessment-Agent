---
id: T-1592
title: 체크인 baseline JSON 최초 생성·commit (ci-realdb-person-read) + 체크인 파일 가드 spec
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-18
createdAt: 2026-08-18T03:30:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1591]
touchesFiles:
  - test/perf/baselines/baseline-ci-realdb-person-read.json
  - test/perf/checkin-baseline-file.spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (a) 본체: T-1591 이 연 실측 승인 입력으로 첫 체크인 baseline JSON 을 확정한다"
---

# T-1592 — 체크인 baseline JSON 최초 생성·commit (ci-realdb-person-read)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)`(체크인 baseline JSON
최초 생성·commit)의 **본체**다. `§Decision 1` 이 저장 위치(`test/perf/baselines/`)를, `§Decision 2` 가
갱신 주체(사람 승인을 거치는 `pr` mode task 만 — CI 자동 commit 비채택)를 이미 못 박았고,
경로 해석(`resolveCheckinBaselinePath`) · 판정 조립(`runCheckinBaselineCheck`) · 로그 표기
(`formatCheckinCandidateLine`) primitive 도 전부 박제돼 있다. **남은 것은 파일 1 개를 실제로
확정해 저장소에 남기는 일** 뿐이다.

마지막 선행 조건이던 "`§Consequences (d)` 가 요구하는 값 타당성 확인 입력"은 T-1591 이 열었다 —
체크인 배선 소비자 11 개가 전부 `createStepClock` 합성값을 쓰던 상태를 깨고, 실측 축
(`label: "ci-realdb-person-read"`)의 candidate 수치가 PR [#1271](https://github.com/myungjoo/Assessment-Agent/pull/1271)
CI 로그에 처음 찍혔다:

```
[perf][checkin-baseline] candidate label=ci-realdb-person-read concurrency=1 p50=2.955065000000104 p95=3.2266453999991427 p99=3.250785879999057 throughput=333.33333333333337 errorRate=0 count=3 pass=true
```

본 task 는 그 수치를 **전사(transcribe)만** 해 baseline JSON 1 개로 확정하고, 그 파일이 이후에도
정본 규약(경로 · 직렬화 형태 · 값 범위)을 지키는지 감시하는 가드 spec 1 개를 붙인다. 이로써 현재
매 run 이 `skipped(absent)` 로 떨어지던 실측 축이 처음으로 `compared` 분기에 진입해,
`§Consequences` "회귀 탐지의 전제 확보"가 실제로 성립한다.

`§Decision 2`(write 국면 부재 — 코드가 baseline 을 쓰지 않는다) · `§Decision 3 (b)`(상대 회귀는 관찰만,
exit code 불변)는 그대로다. 본 task 는 **사람이 검토하는 PR diff 로 값을 박제**할 뿐 write 국면을
만들지 않는다.

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 1`(저장 위치 = `baseDir` 값 하나 ·
  명명 규약은 `resolveBaselinePath` 위임) · `§Decision 2`(갱신 주체 · 갱신이 정당한 3 경우) ·
  `§Decision 3 (b)`(상대 회귀 비-fail) · `§Consequences (d)`(첫 run 자기 승인 위험) · `§Follow-ups (a)`.
- `test/perf/checkin-baseline-store.ts` — `CHECKIN_BASELINE_DIR = "test/perf/baselines"` 상수와
  `resolveCheckinBaselineDir` / `resolveCheckinBaselinePath`(본 task 가 파일을 놓을 경로의 **유일한**
  해석 진입점 — 경로 문자열을 새로 적지 말고 이 함수로 유도할 것).
- `test/perf/latency-baseline.ts` — `BaselineEnvMeta`(`label` · `concurrency` 필수, `dataScale` optional) ·
  `BaselineReport`(7 지표) · `serializeBaselineReport`(직렬화 형태 = `JSON.stringify` 단일 행, 키 순서
  `env` → `p50` → `p95` → `p99` → `throughput` → `errorRate` → `count` → `pass`, `env` 는 `label` →
  `concurrency` → optional 존재분만, NaN 은 sentinel 치환) · `parseBaselineReport` · `resolveBaselinePath`
  (`baseline-` prefix + `slugifyLabel` + `.json`).
- `test/perf/latency-baseline-io.ts` — `readBaselineFile`(경로 결정 → UTF-8 read → parse, `ENOENT` 무래핑
  전파) · `baselineFileExists` · `readCompareBaselineFile`(기준 로드 → `compareBaselineReports` → 리포트
  포맷) · `compareBaselineReports` 의 기본 tolerance(latency +10% · errorRate +0.01)와 NaN 방어
  (baseline NaN 이면 그 지표는 회귀 판정 제외, candidate 만 NaN 이면 회귀 표기).
- `test/perf/person-read-realdb.perf-spec.ts` `353~530 행` — T-1591 이 추가한 실측 축 describe.
  특히 `SEED_ROWS = 20`(→ `dataScale: "20 persons"`), `realClockEnv`(`label: "ci-realdb-person-read"`,
  `concurrency: 1`), `expectEnabledOutcome`(status 를 `compared`/`skipped(absent)` 중 하나로만 단언 —
  **본 task 로 `compared` 로 넘어가도 그대로 통과해야 한다**), negative (a) 의 NaN 국면.
- `test/perf/checkin-baseline-adapter.ts` — `defaultCheckinRepoRoot()`(모듈 위치 기반 repo root) 와
  토글 on 일 때만 `baselineFileExists` 를 조회하는 순서.
- `package.json` `jest` 절 — `testRegex: ".*\\.spec\\.ts$"` 라 `test/perf/*.spec.ts` 는 `pnpm test`
  (unit) 스위트에서 돈다(실 DB 불요). `test:perf` 는 `.perf-spec.ts` 만 잡는다.

## Acceptance Criteria

- [ ] **체크인 파일 1 개 신설** — `test/perf/baselines/baseline-ci-realdb-person-read.json` 을 추가한다.
      경로 · 파일명은 반드시 `resolveCheckinBaselinePath({ label: "ci-realdb-person-read", concurrency: 1 },
      <repoRoot>)` 가 내는 값과 일치해야 하며(가드 spec 이 이를 단언), 경로 문자열을 손으로 새로
      조립하지 않는다. 내용은 `serializeBaselineReport` 출력과 **형태가 동일한 단일 행 JSON** 이고,
      값은 위 `§Why` 의 PR #1271 CI 로그 줄을 **전사만** 한다(반올림 · 재계산 · 임의 여유 계수 금지):

      ```json
      {"env":{"label":"ci-realdb-person-read","concurrency":1,"dataScale":"20 persons"},"p50":2.955065000000104,"p95":3.2266453999991427,"p99":3.250785879999057,"throughput":333.33333333333337,"errorRate":0,"count":3,"pass":true}
      ```

      후행 개행은 0 개 또는 1 개만 허용한다(가드 spec 이 개행 1 개까지 흡수해 정본 비교).
- [ ] **가드 spec 신설** — `test/perf/checkin-baseline-file.spec.ts` 1 개를 추가하고, 아래 4 축을 전부
      담는다. 실 DB · 앱 부트스트랩 무의존이어야 하며(`pnpm test` 에서 돈다), 파일 write · mkdir ·
      전역 `process.env` 변경을 **0 회** 한다.
- [ ] **happy-path 1+** — `readBaselineFile({ label: "ci-realdb-person-read", concurrency: 1 },
      resolveCheckinBaselineDir(<repoRoot>))` 가 예외 0 으로 리포트를 복원하고, `env.label` ·
      `env.concurrency === 1` · `count === 3` · `pass === true` · `errorRate === 0` 이며 `p50`/`p95`/`p99`/
      `throughput` 이 전부 유한수(`Number.isFinite`)임을 단언한다. 추가로 파일 원문(UTF-8 read, 후행
      개행 1 개 흡수)이 `serializeBaselineReport(parseBaselineReport(원문))` 과 **문자열 동일**함을
      단언해 정본 직렬화 형태(키 순서 · 단일 행)를 고정한다.
- [ ] **error path 1+** — 존재하지 않는 label(예: `"ci-realdb-does-not-exist"`)로 같은 디렉토리를
      읽으면 `readBaselineFile` 이 `ENOENT` 계열 오류를 **래핑 없이** 던지고, 같은 label 로
      `baselineFileExists` 는 `false` 를 낸다(체크인 파일이 label 축에만 매달린다는 사실의 관찰).
- [ ] **분기 cover** — 체크인된 baseline 을 기준으로 `compareBaselineReports` 를 두 방향으로 태운다:
      (1) 기준과 **동일 수치** candidate → 모든 latency 지표 `regressed === false`, (2) 기준 대비 latency 를
      기본 tolerance(+10%) 를 확실히 넘도록 키운 candidate(예: `p95 × 10`) → 해당 지표
      `regressed === true`. 두 국면 모두 **throw 0** 임을 함께 단언한다(`§Decision 3 (b)` exit code 불변).
      wall-clock 실측을 새로 하지 않고 in-memory 리포트만 조작한다.
- [ ] **negative cases 충분 cover** — 최소 3 종을 각각 별도 `it` 로: (a) 표본 0(`count: 0`, `p50`/`p95`/
      `p99` 가 `NaN`) candidate 를 체크인 기준과 비교해도 throw 0 이고 candidate-only NaN 이라 해당
      지표가 회귀로 표기된다, (b) 체크인 파일의 `env.dataScale` 이 비어 있지 않은 string 이고
      `/^\d+ persons$/` 형태라 실측 spec 의 `SEED_ROWS` 표기와 어긋나지 않는다, (c) `test/perf/baselines/`
      디렉토리에 체크인된 baseline 파일이 **정확히 1 개**이고 그 이름이
      `resolveCheckinBaselinePath` 유도값의 basename 과 같다(stale label 파일 누적 방지 —
      `§Consequences (a)` 대응).
- [ ] **실측 spec 무회귀** — `test/perf/person-read-realdb.perf-spec.ts` 를 **한 줄도 수정하지 않고**
      `pnpm test:perf` 가 전량 pass 한다. 특히 T-1591 실측 describe 의 5 국면이 이제 `compared` 분기로
      떨어져도 통과해야 한다(`expectEnabledOutcome` 이 두 status 를 모두 허용하도록 설계돼 있음).
- [ ] **체크인 파일 무오염** — `pnpm test` 와 `pnpm test:perf` 를 각각 돌린 뒤에도
      `git status --porcelain test/perf/baselines/` 가 **빈 출력**이다(어떤 spec 도 체크인 경로에 write
      하지 않는다는 `§Decision 2` 의 관찰 가능한 확인).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test` 전량 pass, `pnpm test:cov` 통과
      (line ≥ 80% / function ≥ 80%) — 본 task 는 `src/` 를 0 LOC 변경하므로 커버리지 수치 변동이 없어야
      한다.
- [ ] **PR 본문에 승인 근거 박제** — `§Decision 2` 가 요구하는 "갱신 사유와 수치"를 적는다: 최초 확정임 ·
      출처 run(PR #1271 CI `perf test` step) · 위 로그 줄 원문 · `count=3` 인 3 표본 측정이라 기본
      tolerance(+10%) 기준으로 이후 run 에서 `regressed=true` 가 자주 관측될 수 있으나
      `§Decision 3 (b)` 대로 **관찰만 하고 exit code 를 바꾸지 않는다**는 점 · tolerance 재산정 · fail 승격은
      `§Decision 3` 의 20 run 절차 소관이라 본 PR 밖이라는 점.

## Out of Scope

- `.github/workflows/ci.yml` 편집 금지 — `§Follow-ups (b)`(perf step 회귀 로그 가시화) 는 별도 slice.
- `test/perf/checkin-baseline-*.ts` helper 6 종 · `latency-baseline*.ts` · `latency-collector.ts` 수정 금지
  (신규 판정 로직 0 · 재구현 0 — 본 task 는 데이터 파일 1 개 + 가드 spec 1 개다).
- 기존 perf-spec **전부** 수정 금지(`person-read-realdb.perf-spec.ts` 포함) — `REAL_CLOCK_ITER` 상향 ·
  tolerance 주입 · `CompareOptions` 전달 추가 금지.
- 다른 label 의 baseline 파일 추가 금지 — 첫 체크인 파일은 `ci-realdb-person-read` **1 개**만.
- `docs/ops/load-resilience-test-plan.md` `§ 3` 임계 확정(`§Follow-ups (c)`) · `docs/PLAN.md` ·
  `docs/requirements.md` · `test/perf/README.md` 갱신 금지 — doc-sync 는 별도 `direct` slice(T-1585 ·
  T-1590 전례).
- baseline 값을 반올림 · 여유 계수 적용 · 재측정으로 대체하지 않는다(전사 전용). 값이 부적절하다고
  판단되면 고치지 말고 `Follow-ups` 에 적는다.
- wall-clock 실측에 대한 대소 비교 · 임계 단언 추가 금지(공유 runner 비결정성).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
