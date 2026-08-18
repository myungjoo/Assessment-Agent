---
id: T-1606
title: app-root 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (다섯 번째 route)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T20:42:04Z
independentStream: perf-checkin-baseline
dependsOn: [T-1604, T-1605]
touchesFiles: [test/perf/app-root-measure-confirm-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 나머지 route 축의 마지막 measure-confirm route(DB 미접촉 floor). T-1602·T-1604 패턴 승계.
---

# T-1606 — app-root 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (다섯 번째 route)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의 **"나머지 route 의
체크인 baseline"** 축을 **다섯 번째이자 마지막 `measure→confirm` 실 DB route** 로 넓힌다. 현재
저장소에 체크인된 기준 baseline 은 `baseline-ci-realdb-person-read.json`(T-1592 → T-1594) ·
`baseline-ci-realdb-assessment-read.json`(T-1600 → T-1601) ·
`baseline-ci-realdb-contribution-read.json`(T-1602 → T-1603) ·
`baseline-ci-realdb-summary-read.json`(T-1604 → T-1605) **4 건**이고, `*-measure-confirm-realdb`
계열에서 남은 route 는 `app-root-measure-confirm-realdb.perf-spec.ts`(slice 28, `GET /api`) **하나
뿐**이다. 그 route 는 아직 `registerCheckinBaselineWiringSuite` 의 `measure` 가 `createStepClock`
**합성** 표본만 태우므로(`263~281 행`) CI 로그에 실측 p50/p95/p99 가 전혀 찍히지 않고, 따라서
`§Consequences (d)` 가 요구하는 **"사람이 값의 타당성을 확인한 뒤 commit"** 의 입력이 없다.

`GET /api` 를 다섯 번째 route 로 고르는 근거 — 앞선 네 route 가 전부 **DB 를 타는 조회**(무-파라미터
목록 · `personId` 단일 필터 · 3-level FK chain · `personId` + `period` 2 차 필터)인 반면 본 route 는
`AppService.getStatus()` 의 고정 상수를 동기 반환할 뿐 **요청 경로가 DB 를 전혀 타지 않는다**. 즉 본
slice 가 남기는 실측 줄은 **framework + HTTP 왕복만의 floor** 라서, 사람이 앞선 네 route 의 실측
p95 에서 인프라 하한을 **빼서 읽을 수 있는 유일한 기준선**이 된다. 부수적으로 guard 가 없는 route
(쿠키 미부착도 변조 쿠키도 200) 에서도 체크인 확인 경로가 동일하게 동작함을 처음 관측한다.

`§Decision 2`(갱신 주체는 pr-mode task 뿐) · `§Decision 3 (b)`(상대 회귀는 관찰만, exit code 불변)는
그대로다 — 본 task 는 **로그를 하나 더 내는 관찰**일 뿐이며 baseline JSON 을 만들지도 저장소에 쓰지도
않는다. 실제 체크인(`baseline-ci-realdb-app-root-read.json` 생성 · commit + `CHECKIN_BASELINES` 표
5 행째 추가 + 표 크기 하한 `>= 4` → `>= 5` 상향)은 본 task 가 CI 로그로 노출한 수치를 사람이 확인한
**다음 slice** 의 몫이다 (T-1594 · T-1601 · T-1603 · T-1605 선례와 동형).

## Required Reading

- `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` — 본 task 가 **유일하게 수정하는
  파일**(282 행). 특히 `ROOT`(`/api`, `53 행`) · `MISSING`(`/api/no-such-route`, `54 행`) ·
  `ITER`(`55 행`) · `WIRING_ITER`(`58 행`) 상수, `env`(`69 행`, `realdb-app-root-mc`),
  `beforeAll`(`71~85 행` — `truncateAll` → `reseedAuthenticatedActors` 로 시작 상태 고정),
  `beforeEach` 의 `tmpRoot`(`86~88 행`), `afterEach` 의 `rmSync` → `truncateAll` →
  `reseedAuthenticatedActors` 순서(`90~94 행`), `dirOf`(`100 행`),
  `read(target, jar)`(`103~115 행` — `RequestFn` 을 **반환하는 factory**, `jar === null` 이면
  Cookie 미부착이고 그래도 200), `run()`(`118 행`), `established()`(`121~129 행`),
  `registerCheckinBaselineWiringSuite` 호출(`263~281 행`)을 확인할 것. seed 함수가 **없다**(본
  route 는 도메인 row 를 만들지 않는다).
- `test/perf/summary-measure-confirm-realdb.perf-spec.ts` `315~584 행` — T-1604 가 네 번째 route 에
  박제한 **실측 clock 관찰 국면의 최신 정본 패턴**. 지역 helper 구성(`measureRealClock` ·
  `checkWithLogs` · `enabledEnv` · `expectEnabledOutcome` · `metricsLineOf`) 과
  `REAL_CLOCK_ITER`(`325 행`) · `REAL_CLOCK_ITER_MIN`(`327 행`) 상수 주석, 하한 가드 `it`
  (`522 행`) 을 그대로 승계하되 **route 고유분만** 갈아끼운다(문구 복제가 아니라 구조 승계).
- `test/perf/checkin-baseline-spec-wiring.ts` — 새로 부르는 `checkCheckinBaselineForSpec`
  (어댑터 1 회 위임 + `outcome.log` 를 주입 로거로 원문 1 회 출력 + outcome 무가공 반환) 계약과
  예외 전파 규약, `CheckinBaselineRunOutcome` 타입. `seedCheckinBaselineFixture` 는 쓰지 않는다.
- `test/perf/checkin-baseline-report.ts` `formatCheckinCandidateLine` + `CHECKIN_LOG_PREFIX` —
  candidate 줄의 키 순서(`label` · `concurrency` · `p50` · `p95` · `p99` · `throughput` ·
  `errorRate` · `count` · `pass`) 와 `NaN` 무가공 전사 계약.
- `test/perf/latency-collector.ts` `measureBaselineCandidate` — `opts.now` **미주입 시 실 clock**,
  요청 reject / 비-2xx 는 failure 집계(표본 제외), 임계 위반을 throw 하지 않고 `pass` 플래그로만
  싣는 계약. `iterations` 음수는 `RangeError`.
- `test/perf/checkin-baseline-file.spec.ts` `55~110 행` — 다음 slice 가 5 행째를 추가할
  `CHECKIN_BASELINES` 표(`label` · `sampleCount` · `dataScalePattern` · `dataScaleOrigin`). 기존
  4 행이 전부 **비어있지 않은 `dataScale` 문자열**을 전제(`254~259 행` 의 negative (b))하므로 본
  task 의 `envMeta` 도 `dataScale` 을 **반드시 넣어** 다음 slice 가 표 타입을 optional 로 고치는
  리팩터 없이 행 1 개만 더할 수 있게 한다.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 1~3` · `§Consequences (a) (d)` ·
  `§Follow-ups (a)` — 본 slice 가 여는 선행 조건의 근거.

## Acceptance Criteria

- [ ] `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` 에 **실측 축 전용 nested `describe`
      1 개**를 추가하고 그 안에서만 `checkCheckinBaselineForSpec` 을 부른다. 그 국면은 전용
      `envMeta`(`label: "ci-realdb-app-root-read"`, `concurrency: 1`, `dataScale` 은 본 route 가
      조회로 건드리는 도메인 row 수 0 을 담은 **spec 지역 상수 1 개**에서 조립한
      `0 rows / no db access` 형태 — 같은 문자열을 국면마다 손으로 반복하지 않는다) 를 쓰고
      **`repoRoot` 를 생략**해 저장소 실경로 바인딩을 탄다. 기존 `env`(`realdb-app-root-mc`) 와
      label 이 **분리**돼 있어 향후 체크인될 baseline 파일이 배선 · 확정 국면과 충돌하지 않음을
      주석 1~2 줄로 박제한다. 토글은 **`processEnv` 주입**으로만 제어하고 전역 `process.env` 를
      읽지도 쓰지도 않는다(전역 오염 0).
- [ ] **happy-path 1+** — 실 clock(= `measureBaselineCandidate` 에 `now` **미주입**)으로
      `read()`(cookie 미부착 `GET /api`) 를 측정한 candidate 를 토글 on 으로 태우면 예외 0 이고,
      주입 로거가 **정확히 1 회** 호출되며 그 문자열이 `CHECKIN_LOG_PREFIX` 로 시작한다. `status`
      는 `"compared"` 또는 `"skipped"`(`reason: "absent"`) 중 하나임을 실행 시점 파일 존재 여부에
      맡겨 **하드코딩하지 않는다**. `absent` 이면 로그가 개행 기준 **정확히 2 줄**이고 둘째 줄에
      `p50=` · `p95=` · `p99=` · `throughput=` · `errorRate=` · `count=` · `pass=` 키가 모두 있으며
      `count` 가 반복 수와 일치한다. 같은 국면에서 `lastStatus === 200` 과
      `lastText === APP_STATUS_MESSAGE`(리터럴 복제 0 — 이미 import 된 상수 사용) 를 함께 단언해
      **실 HTTP 왕복 발화**를 입증하고, 분기와 무관하게 `formatBaselineLine(candidate)` 한 줄을
      `console.log` 로 남겨 다음 slice 의 `§Consequences (d)` 승인 입력으로 쓴다(T-1593 선례).
- [ ] **error path 2+** — (a) 전량 reject 하는 `RequestFn` 의 실측 candidate 를 같은 경로에 태워도
      **throw 0** 이고 `errorRate=1` · `pass=false` 가 가공 없이 전사된다, (b) **인접 미매칭
      경로**(`read(MISSING)`) 실측 candidate — 전량 404 라 `count=0` · `errorRate=1` ·
      `pass=false` 이면서도 확인 경로는 throw 0 이고 로그에 `count=0` 이 그대로 실린다(본 route 의
      유일한 오류 축 — `getRoot()` 자체엔 예외 경로가 없다).
- [ ] **분기 cover 2+** — (1) 같은 실측 candidate 를 토글 on(`processEnv` 에 `"1"`) → 수치 키 포함
      다중 줄, 토글 off(`processEnv: {}`) → `status: "skipped"` · `reason: "disabled"` 이고 로그가
      **1 줄**이며 `p95=` 같은 수치 키가 **하나도 실리지 않음** 을 각각 단언한다. (2) **DB 미접촉
      floor 축** — `truncateAll(prisma)` 로 actor 까지 비운 상태(`prisma.user.count() === 0`) 와
      비우기 전 상태 **양쪽**에서 실측 candidate 를 각각 태워 둘 다 예외 0 · `errorRate=0` ·
      `count` 가 반복 수와 동일하고 `lastText` 가 `APP_STATUS_MESSAGE` 로 불변임을 단언한다(본
      slice 고유 축 — 실측 표본이 DB 상태에 무의존하다는 직접 증거). wall-clock 값끼리의 대소는
      단언하지 않는다.
- [ ] **negative cases 충분 cover** — 최소 3 종을 각각 별도 `it` 로: (a) `iterations: 0` 실측
      candidate 를 토글 on 으로 태워도 throw 0 이고 `count=0` 과 `NaN` 표기가 가공 없이 로그에
      실린다, (b) `iterations` 음수는 `RangeError` 가 **확인 경로 도달 전에** 전파되고 로거 호출이
      0 회다, (c) **guard 0 route 의 정반대 negative** — 변조 토큰 쿠키를 붙인
      (`read(ROOT, tamperedCookie)`) 실측 candidate 가 401/403 이 아니라 200 이라 `errorRate=0` ·
      `count` 가 반복 수와 같고, 확인 경로도 cookie 미부착 국면과 **동일하게** 예외 0 으로
      통과한다. `POST /api` 404 축 · `test/perf/baselines/` 실경로 무오염 · 전역 토글 누출 0 ·
      **연속 2 회 호출 부작용 0** 국면은 기존 `negative cases 충분 cover` describe(`197~262 행`)와
      `registerCheckinBaselineWiringSuite` 배선 국면이 **같은 코드 경로로 이미 cover** 하므로
      **재작성 금지**(T-1575 중복 국면 삭제 선례).
- [ ] 실측 반복 수는 **20**(`REAL_CLOCK_ITER = 20`) 으로 두고 하한 회귀 가드 상수
      (`REAL_CLOCK_ITER_MIN = 20`) 와 그 값을 지키는 `it` 1 개를 함께 둔다 — 근거 · 한계 · 비용
      3 줄 주석은 T-1593 → T-1600 → T-1602 → T-1604 가 박제한 문장을 route 에 맞게 승계한다.
      기존 `ITER`(4) · `WIRING_ITER`(2) 는 **재사용하지 않는다**(비용 축과 의미가 다른 상수).
- [ ] 기존 국면 불변 — `ROOT` · `MISSING` · `ITER` · `WIRING_ITER` 값, 기존 `it` 들의 단언,
      `registerCheckinBaselineWiringSuite` 호출 인자,
      `beforeAll`/`beforeEach`/`afterEach`/`afterAll` 본문을 **수정하지 않는다**(추가만). `src/` ·
      `prisma/` · 임계값(`DEFAULT_P95_MAX_MS = 3000`) 도 0 LOC 변경.
- [ ] diff 는 **1 파일 · 300 LOC 이내**를 지킨다. 국면 밀도가 T-1604(+289) 에 근접하므로 helper
      승계를 최대한 압축하고, 그래도 cap 이 위태로우면 negative (c) 를 **Follow-ups 로 이월**한다
      (국면 축소 시 그 사유를 PR 본문에 1 줄 명시).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요) 실행
      로그에 `[perf][checkin-baseline]` 실측 candidate 줄과 `ci-realdb-app-root-read` candidate
      줄이 눈으로 확인된다 — PR 본문에 그 줄 원문 1~2 개를 **그대로 인용**해 다음 slice 의 승인
      입력으로 남긴다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로
      커버리지 수치 변동이 없어야 한다.

## Out of Scope

- **baseline JSON 체크인 금지** — `test/perf/baselines/baseline-ci-realdb-app-root-read.json` 을 본
  task 에서 만들지 않는다(`§Consequences (d)` 의 사람 확인 입력을 먼저 CI 로그로 노출하는 것이 본
  slice 의 전부). 파일 생성 · `checkin-baseline-file.spec.ts` 의 `CHECKIN_BASELINES` 5 행째 추가 ·
  표 크기 하한 `>= 4` → `>= 5` 상향은 다음 slice.
- 다른 perf-spec(person / assessment / contribution / summary measure-confirm-realdb 및 `*-read`
  계열 나머지) · 공유 helper(`checkin-baseline-*.ts` · `latency-*.ts` · `step-clock.ts`) 수정 금지.
- `test/perf/README.md` · ADR-0056 · 부하계획 문서 갱신 금지(문서 동기는 별도 slice — T-1590 ·
  T-1596 선례).
- `.github/workflows/ci.yml` · `deploy/daily-test.sh` 등 CI/스크립트 변경 금지(ADR-0056
  `§Follow-ups (b)` 는 drift-guard smoke 3 종 동반으로 파일 cap 이 걸리는 별도 축 — T-1122 전례).
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(ADR-0056 `§Follow-ups (c)` 의 승격 조건은
  **동일 `env.label` 연속 20 run** 이라 route 4~5 건 체크인만으로는 여전히 미충족).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`, T-0877/T-0880 flaky 사고 재발 차단).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
