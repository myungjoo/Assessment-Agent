---
id: T-1604
title: summary 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (네 번째 route)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T15:40:00Z
completedAt: 2026-08-18T15:58:40Z
prNumber: 1284
independentStream: perf-checkin-baseline
dependsOn: [T-1602, T-1603]
touchesFiles: [test/perf/summary-measure-confirm-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 나머지 route 축을 네 번째 route(period 2 차 필터)로 확산. T-1600·T-1602 패턴 승계.
---

# T-1604 — summary 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (네 번째 route)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의
**"나머지 route 의 체크인 baseline"** 축을 **네 번째 route** 로 넓힌다. 저장소에 체크인된 기준
baseline 은 `baseline-ci-realdb-person-read.json`(T-1592 → T-1594) ·
`baseline-ci-realdb-assessment-read.json`(T-1600 → T-1601) ·
`baseline-ci-realdb-contribution-read.json`(T-1602 → T-1603) **3 건뿐** 이고, 나머지 실 DB route 는
CI 로그에 실측 p50/p95/p99 가 전혀 찍히지 않아 `§Consequences (d)` 가 요구하는 **"사람이 값의
타당성을 확인한 뒤 commit"** 의 입력이 없다 — 체크인 배선 소비자 나머지가 전부
`registerCheckinBaselineWiringSuite` 의 `measure` 로 `createStepClock(stepMs)` **합성** 표본만 태우기
때문이다(본 task 대상 파일도 `283~295 행` 이 그렇다).

`GET /api/summaries`(slice 25)를 네 번째 route 로 고르는 근거는 두 가지다 — ① 앞선 세 route
(무-파라미터 목록 · `personId` 단일 필터 · 부모 id 로 긁는 3-level FK chain)와 달리 **`personId` +
`period` 2 차 필터로 같은 부모의 부분집합을 잘라내는** 축이라, 필터 조합이 실 query 지연에 미치는
영향이 처음 관측된다. ② 실 DB 부트스트랩 · seed(`seed()`, `106~121 행`) · 인증 쿠키 · `RequestFn`
factory(`read`, `126~134 행`)가 이미 갖춰져 있어 신규 배선이 관찰 국면 하나뿐이다.

`§Decision 2`(갱신 주체는 pr-mode task 뿐) · `§Decision 3 (b)`(상대 회귀는 관찰만, exit code 불변)는
그대로다 — 본 task 는 **로그를 하나 더 내는 관찰**일 뿐이며 baseline JSON 을 만들지도 저장소에 쓰지도
않는다. 실제 체크인(`baseline-ci-realdb-summary-read.json` 생성 · commit + `CHECKIN_BASELINES` 표
4 행째 추가)은 본 task 가 CI 로그로 노출한 실측 수치를 사람이 확인한 **다음 slice** 의 몫이다
(T-1594 · T-1601 · T-1603 선례와 동형).

## Required Reading

- `test/perf/summary-measure-confirm-realdb.perf-spec.ts` — 본 task 가 **유일하게 수정하는
  파일**(295 행). 특히 상수(`WEEK_ROWS = 3` · `MONTH_ROWS = 2` · `TOTAL_ROWS`, `52~54 행`;
  `ITER`, `56 행`; `WIRING_ITER`, `59 행`), `env`(`74 행`, `realdb-summary-mc`), `beforeEach` 의
  `tmpRoot`(`85 행`) · `afterEach` 의 `truncateAll` → `reseedAuthenticatedActors` 순서(`89 행`),
  `dirOf`(`101 행`), `seed()`(`106~121 행` — Person 1 → Summary week 3 + month 2, 반환값은
  `personId`), `read(query, authed)`(`126~134 행` — `RequestFn` 을 **반환하는 factory**, `authed`
  false 면 401 분기), `rows()`(`135 행`), `run()`(`138 행`),
  `registerCheckinBaselineWiringSuite` 호출(`283~295 행`)을 확인할 것.
- `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` `324~596 행` — T-1602 가 세 번째
  route 에 박제한 **실측 clock 관찰 국면의 최신 정본 패턴**. 지역 helper 구성(`measureRealClock` ·
  `checkWithLogs` · `enabledEnv` · `expectEnabledOutcome` · `metricsLineOf`)과
  `REAL_CLOCK_ITER`(`335 행`) · `REAL_CLOCK_ITER_MIN`(`337 행`) 상수 주석, 하한 가드 `it`
  (`534 행`)을 그대로 승계하되 **route 고유분만** 갈아끼운다.
- `test/perf/checkin-baseline-spec-wiring.ts` — 새로 부르는 `checkCheckinBaselineForSpec`
  (어댑터 1 회 위임 + `outcome.log` 를 주입 로거로 원문 1 회 출력 + outcome 무가공 반환) 계약과
  예외 전파 규약. `seedCheckinBaselineFixture` 는 본 task 에서 쓰지 않는다.
- `test/perf/checkin-baseline-report.ts` `formatCheckinCandidateLine` + `CHECKIN_LOG_PREFIX` —
  candidate 줄의 키 순서(`label` · `concurrency` · `p50` · `p95` · `p99` · `throughput` ·
  `errorRate` · `count` · `pass`)와 `NaN` 무가공 전사 계약.
- `test/perf/latency-collector.ts` `measureBaselineCandidate` — `opts.now` **미주입 시 실 clock**,
  요청 reject 는 failure 집계(표본 제외), 임계 위반을 throw 하지 않고 `pass` 플래그로만 싣는 계약.
- `test/perf/checkin-baseline-file.spec.ts` `69~95 행` — 다음 slice 가 4 행째를 추가할
  `CHECKIN_BASELINES` 표(`label` · `sampleCount` · `dataScalePattern` · `dataScaleOrigin`). 기존
  3 행이 `/^\d+ persons$/` · `/^1 person \/ \d+ assessments$/` · `/^1 person \/ \d+ contributions$/`
  이므로 본 task 의 `dataScale` 도 **같은 형태로 기계 유도 가능**해야 한다.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 1~3` · `§Consequences (d)` ·
  `§Follow-ups (a)` — 본 slice 가 여는 선행 조건의 근거.

## Acceptance Criteria

- [ ] `test/perf/summary-measure-confirm-realdb.perf-spec.ts` 에 **실측 축 전용 nested `describe`
      1 개**를 추가하고 그 안에서만 `checkCheckinBaselineForSpec` 을 부른다. 그 국면은 전용
      `envMeta`(`label: "ci-realdb-summary-read"`, `concurrency: 1`, `dataScale` 는 `TOTAL_ROWS`
      등 seed 상수에서 **유도**한 `1 person / N summaries` 형태 — 리터럴 손코딩 금지)를 쓰고
      **`repoRoot` 를 생략**해 저장소 실경로 바인딩을 탄다. 기존 `env`(`realdb-summary-mc`) 와
      label 이 **분리**돼 있어 향후 체크인될 baseline 파일이 배선 · 확정 국면과 충돌하지 않음을
      주석 1~2 줄로 박제한다. 토글은 **`processEnv` 주입**으로만 제어하고 전역 `process.env` 를
      읽지도 쓰지도 않는다(전역 오염 0).
- [ ] **happy-path 1+** — 실 clock(= `measureBaselineCandidate` 에 `now` **미주입**)으로 seed 후
      `read("?personId=" + id)` 를 측정한 candidate 를 토글 on 으로 태우면 예외 0 이고, 주입 로거가
      **정확히 1 회** 호출되며 그 문자열이 `CHECKIN_LOG_PREFIX` 로 시작한다. `status` 는
      `"compared"` 또는 `"skipped"`(`reason: "absent"`) 중 하나임을 실행 시점 파일 존재 여부에
      맡겨 **하드코딩하지 않는다**. `absent` 이면 로그가 개행 기준 **정확히 2 줄**이고 둘째 줄에
      `p50=` · `p95=` · `p99=` · `throughput=` · `errorRate=` · `count=` · `pass=` 키가 모두 있으며
      `count` 가 반복 수와 일치한다. 같은 국면에서 `rows()` 길이가 `TOTAL_ROWS`(5) 임을 함께
      단언해 **실 query 발화**를 입증하고, 분기와 무관하게 `formatBaselineLine(candidate)` 한 줄을
      `console.log` 로 남겨 다음 slice 의 `§Consequences (d)` 승인 입력으로 쓴다(T-1593 선례).
- [ ] **error path 2+** — (a) 전량 reject 하는 `RequestFn` 의 실측 candidate 를 같은 경로에 태워도
      **throw 0** 이고 `errorRate=1` · `pass=false` 가 가공 없이 전사된다(실 DB 무의존, seed 불요),
      (b) **`personId` 누락**(`read("")`) 실측 candidate — 전량 400 이라 `count=0` · `errorRate=1`
      이면서도 확인 경로는 throw 0 이다(본 route 의 **필수 파라미터** 축).
- [ ] **분기 cover 2+** — (1) 같은 실측 candidate 를 토글 on(`processEnv` 에 `"1"`) → 수치 키 포함
      다중 줄, 토글 off(`processEnv: {}`) → `status: "skipped"` · `reason: "disabled"` 이고 로그가
      **1 줄**이며 `p95=` 같은 수치 키가 **하나도 실리지 않음** 을 각각 단언한다. (2) **`period`
      2 차 필터** 분기 — `?personId=<id>&period=week` · `&period=month` 두 실측 candidate 가
      **둘 다** 확인 경로를 예외 0 으로 통과하고 각각 응답 길이가 `WEEK_ROWS`(3) · `MONTH_ROWS`(2)
      로 **서로 다름** 을 단언한다(본 slice 고유 축 — 같은 부모의 부분집합을 자르는 필터).
- [ ] **negative cases 충분 cover** — 최소 3 종을 각각 별도 `it` 로: (a) `iterations: 0` 실측
      candidate 를 토글 on 으로 태워도 throw 0 이고 `count=0` 과 `NaN` 표기가 가공 없이 로그에
      실린다, (b) `iterations` 음수는 `RangeError` 가 **확인 경로 도달 전에** 전파되고 로거 호출이
      0 회다, (c) **매칭 0 건 `personId`** 실측 candidate — 404 가 아니라 200 + 빈 배열이라
      `errorRate=0` · `count` 가 반복 수와 같고 `rows()` 길이가 0 이다(2 차 필터 이전 단계의
      무-매칭 축). 인증 미부착 401 축 · `test/perf/baselines/` 실경로 무오염 · 전역 토글 누출 0 ·
      **연속 2 회 호출 부작용 0** 국면은 기존 `negative cases 충분 cover` describe(`211~275 행`)와
      `registerCheckinBaselineWiringSuite` 배선 국면이 **같은 코드 경로로 이미 cover** 하므로
      **재작성 금지**(T-1575 중복 국면 삭제 선례).
- [ ] 실측 반복 수는 **20**(`REAL_CLOCK_ITER = 20`) 으로 두고 하한 회귀 가드 상수
      (`REAL_CLOCK_ITER_MIN = 20`) 와 그 값을 지키는 `it` 1 개를 함께 둔다 — 근거 · 한계 · 비용
      3 줄 주석은 T-1593 → T-1600 → T-1602 가 박제한 문장을 route 에 맞게 승계한다. 기존 `ITER` ·
      `WIRING_ITER` 는 **재사용하지 않는다**(비용 축과 의미가 다른 상수).
- [ ] 기존 국면 불변 — `WEEK_ROWS` · `MONTH_ROWS` · `TOTAL_ROWS` · `ITER` · `WIRING_ITER` 값, 기존
      `it` 들의 단언, `registerCheckinBaselineWiringSuite` 호출 인자,
      `beforeAll`/`beforeEach`/`afterEach`/`afterAll` 본문을 **수정하지 않는다**(추가만). `src/` ·
      `prisma/` · 임계값(`DEFAULT_P95_MAX_MS = 3000`) 도 0 LOC 변경.
- [ ] diff 는 **1 파일 · 300 LOC 이내**를 지킨다. 국면 밀도가 T-1602(+292) 에 근접하므로 helper
      승계를 최대한 압축하고, 그래도 cap 이 위태로우면 negative (c) 를 **Follow-ups 로 이월**한다
      (국면 축소 시 그 사유를 PR 본문에 1 줄 명시).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요) 실행
      로그에 `[perf][checkin-baseline]` 실측 candidate 줄과 `ci-realdb-summary-read` candidate
      줄이 눈으로 확인된다 — PR 본문에 그 줄 원문 1~2 개를 **그대로 인용**해 다음 slice 의 승인
      입력으로 남긴다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로
      커버리지 수치 변동이 없어야 한다.

## Out of Scope

- **baseline JSON 체크인 금지** — `test/perf/baselines/baseline-ci-realdb-summary-read.json` 을 본
  task 에서 만들지 않는다(`§Consequences (d)` 의 사람 확인 입력을 먼저 CI 로그로 노출하는 것이 본
  slice 의 전부). 파일 생성 · `checkin-baseline-file.spec.ts` 의 `CHECKIN_BASELINES` 4 행째 추가 ·
  표 크기 하한 `>= 3` → `>= 4` 상향은 다음 slice.
- 다른 perf-spec(person-read-realdb · assessment / contribution measure-confirm-realdb 포함 나머지
  소비자) · 공유 helper(`checkin-baseline-*.ts` · `latency-*.ts` · `step-clock.ts`) 수정 금지.
- `test/perf/README.md` · ADR-0056 · 부하계획 문서 갱신 금지(문서 동기는 별도 slice — T-1590 선례).
- `.github/workflows/ci.yml` · `deploy/daily-test.sh` 등 CI/스크립트 변경 금지(ADR-0056
  `§Follow-ups (b)` 는 drift-guard smoke 3 종 동반으로 파일 cap 이 걸리는 별도 축 — T-1122 전례).
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(ADR-0056 `§Follow-ups (c)` 의 승격 조건은
  **동일 `env.label` 연속 20 run** 이라 route 3~4 건 체크인만으로는 여전히 미충족).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

---

## 결과 (2026-08-18T15:58:40Z, DONE)

- `pr` mode — PR [#1284](https://github.com/myungjoo/Assessment-Agent/pull/1284) squash 머지 `6fadfc2c` + branch 삭제. 1 파일 `+289/-0` (`test/perf/summary-measure-confirm-realdb.perf-spec.ts`), `src/` 0 LOC.
- 실측 축 전용 nested describe 1 개 추가 — `REAL_CLOCK_ITER=20` · 전용 label `ci-realdb-summary-read` · `dataScale` 은 `TOTAL_ROWS` 유도 · `processEnv` 주입 토글로 전역 오염 0. 기존 국면 · 상수 · 배선 인자는 무수정(추가만).
- **R-112** — 국면 9 개 (happy 1 · error 2 · 분기 2 · 표본 하한 가드 1 · negative 3). 로컬 `lint` · `build` · `test:cov`(438 suite / 12564 test) 전량 pass, `src/` 0 LOC 라 coverage 임계 변동 0.
- **4-게이트** — reviewer VERDICT=APPROVE(round 1, MINOR 1 건은 CI 위임 확인 요청이라 코드 변경 요구 아님) + PR comment 외화 + integrator 자체 점검 + PR CI green(run `32156964647`) 으로 4/4. Nit-in-PR closure 잔여 0 → round 2 불요.
- **다음 slice 입력** — CI 로그가 남긴 실측 줄: `label=ci-realdb-summary-read concurrency=1 p50=2.332 p95=2.521 p99=2.710 throughput=425.53 errorRate=0 count=20 pass=true`. 이 줄이 ADR-0056 `§Consequences (d)` 의 사람 확인 입력이 되어 다음 slice 가 `baseline-ci-realdb-summary-read.json` 체크인 + `CHECKIN_BASELINES` 4 행째를 만든다.
