---
id: T-1600
title: assessment 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (두 번째 route)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-038]
estimatedDiff: 200
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T11:30:00Z
completed: 2026-08-18T12:00:28Z
prNumber: 1280
independentStream: perf-checkin-baseline
dependsOn: [T-1591, T-1593, T-1594]
touchesFiles: [test/perf/assessment-measure-confirm-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 의 "나머지 route 체크인 baseline" 축. T-1591/T-1593 실측 국면을 두 번째 실 DB route 로 확산.
---

# T-1600 — assessment 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (두 번째 route)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 가 남긴
**"나머지 route 의 체크인 baseline"** 축을 두 번째 route 로 처음 넓힌다. 현재 저장소에 체크인된
기준 baseline 은 T-1592 → T-1594 사슬이 만든 `baseline-ci-realdb-person-read.json`
(`GET /api/persons`) **1 건뿐** 이고, 나머지 실 DB route 는 CI 로그에 실측 p50/p95/p99 가
찍히지 않아 `§Consequences (d)` 가 요구하는 **"사람이 값의 타당성을 확인한 뒤 commit"** 의 입력이
아예 없다 — 체크인 배선 소비자 11 개 중 person-read-realdb 를 제외한 전부가
`registerCheckinBaselineWiringSuite` 의 `measure` 로 `createStepClock(stepMs)` 합성 표본만
태우기 때문이다(본 task 대상 파일도 `291~295 행` 이 그렇다).

`GET /api/assessments`(REQ-038 시계열 조회, slice 26)를 두 번째 route 로 고르는 근거는 세 가지다 —
① 실 JWT guard 통과 + `personId` 필수 + `period` optional 분기까지 태우는 **가장 무거운 실 DB read**
라 REQ-048 의 "조회 p95 < 3s" 가 실제로 매달린 축이고, ② 이미 실 DB 부트스트랩 · seed · 인증 쿠키 ·
`RequestFn` factory(`read`, `122~131 행`)가 갖춰져 있어 신규 배선이 관찰 국면 하나뿐이며,
③ person route 가 guard-free 였던 것과 달리 **인증 실패(401 전량) 실측 표본** 이라는 새 축을 처음
관측한다.

`§Decision 2`(write 국면 부재) · `§Decision 3 (b)`(회귀는 관찰만, exit code 불변)는 그대로다 —
본 task 는 **로그를 하나 더 내는 관찰**일 뿐이며 baseline JSON 을 만들지도 저장소에 쓰지도 않는다.
실제 체크인(`baseline-ci-realdb-assessment-read.json` 생성·commit)은 본 task 가 CI 로그로 노출한
실측 수치를 사람이 확인한 **다음 slice** 의 몫이다(T-1592 선례와 동형).

## Required Reading

- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` — 본 task 가 **유일하게 수정하는 파일**
  (299 행). 특히 상수(`WEEK_ROWS`/`MONTH_ROWS`/`TOTAL_ROWS`/`ITER`/`WIRING_ITER`, `52~60 행`),
  `env`(`72 행`, `realdb-assess-mc`), `beforeEach` 의 `tmpRoot` · `afterEach` 의
  `truncateAll` → `reseedAuthenticatedActors` 순서(`83~91 행`), `dirOf`(`98~100 행`),
  `seed()`(`102~120 행` — Person 1 + Assessment week 3 / month 2 반환값은 personId),
  `read(query, authed)`(`122~131 행` — `RequestFn` 을 **반환하는 factory**),
  `registerCheckinBaselineWiringSuite` 호출(`286~298 행`)을 확인할 것.
- `test/perf/person-read-realdb.perf-spec.ts` `355~628 행` — T-1591 이 열고 T-1593 이 표본 수를
  20 으로 올린 **실측 clock 관찰 국면의 정본 패턴**. 지역 helper 구성(`measureRealClock` ·
  `checkWithLogs` · `enabledEnv` · `expectEnabledOutcome` · `metricsLineOf`)과 `REAL_CLOCK_ITER` ·
  `REAL_CLOCK_ITER_MIN` 상수 주석을 그대로 승계하되 **route 고유분만** 갈아끼운다.
- `test/perf/checkin-baseline-spec-wiring.ts` — 새로 부르는 `checkCheckinBaselineForSpec`
  (어댑터 1 회 위임 + `outcome.log` 를 주입 로거로 원문 1 회 출력 + outcome 무가공 반환) 계약과
  예외 전파 규약. `seedCheckinBaselineFixture` 는 본 task 에서 쓰지 않는다.
- `test/perf/checkin-baseline-report.ts` `formatCheckinCandidateLine` + `CHECKIN_LOG_PREFIX` —
  candidate 줄의 키 순서(`label` · `concurrency` · `p50` · `p95` · `p99` · `throughput` ·
  `errorRate` · `count` · `pass`)와 NaN 무가공 전사 계약.
- `test/perf/latency-collector.ts` `measureBaselineCandidate` — `opts.now` **미주입 시 실 clock**,
  요청 reject 는 failure 집계(표본 제외), 임계 위반을 throw 하지 않고 `pass` 플래그로만 싣는 계약.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 1~3` · `§Consequences (d)` ·
  `§Follow-ups (a)` — 본 slice 가 여는 선행 조건의 근거.

## Acceptance Criteria

- [ ] `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` 에 **실측 축 전용 nested `describe`
      1 개**를 추가하고 그 안에서만 `checkCheckinBaselineForSpec` 을 부른다. 그 국면은 전용
      `envMeta`(`label: "ci-realdb-assessment-read"`, `concurrency: 1`, `dataScale` 는 seed 규모를
      나타내는 문자열)를 쓰고 **`repoRoot` 를 생략**해 저장소 실경로 바인딩을 탄다. 기존 `env`
      (`realdb-assess-mc`) 와 label 이 **분리**돼 있어 향후 체크인될 baseline 파일이 배선/확정 국면과
      충돌하지 않음을 주석 1~2 줄로 박제한다. 토글은 **`processEnv` 주입**으로만 제어하고 전역
      `process.env` 를 읽지도 쓰지도 않는다(전역 오염 0).
- [ ] **happy-path 1+** — 실 clock(= `measureBaselineCandidate` 에 `now` **미주입**)으로 seed 후
      `read("?personId=<seed id>")` 를 측정한 candidate 를 토글 on 으로 태우면 예외 0 이고, 주입 로거가
      **정확히 1 회** 호출되며 그 문자열이 `CHECKIN_LOG_PREFIX` 로 시작한다. `status` 는 `"compared"`
      또는 `"skipped"`(`reason: "absent"`) 중 하나임을 실행 시점 파일 존재 여부에 맡겨 **하드코딩하지
      않는다**. `absent` 이면 로그가 개행 기준 **정확히 2 줄**이고 둘째 줄에 `p50=` · `p95=` · `p99=` ·
      `throughput=` · `errorRate=` · `count=` · `pass=` 키가 모두 있으며 `count` 가 반복 수와 일치한다.
      분기와 무관하게 `formatBaselineLine(candidate)` 한 줄을 `console.log` 로 남겨 다음 slice 의
      `§Consequences (d)` 승인 입력으로 쓴다(T-1593 선례).
- [ ] **error path 2+** — (a) 전량 reject 하는 `RequestFn` 의 실측 candidate 를 같은 경로에 태워도
      **throw 0** 이고 `errorRate=1` · `pass=false` 가 가공 없이 전사된다(실 DB 무의존, seed 불요),
      (b) **인증 미부착**(`read(query, false)`) 실측 candidate — 전량 401 이라 `errorRate=1` 이면서도
      확인 경로는 throw 0 이다(본 route 고유 guard 축, person route 에는 없던 국면).
- [ ] **분기 cover 2+** — (1) 같은 실측 candidate 를 토글 on(`processEnv` 에 `"1"`) → 수치 키 포함
      다중 줄, 토글 off(`processEnv: {}`) → `status: "skipped"` · `reason: "disabled"` 이고 로그가
      **1 줄**이며 `p95=` 같은 수치 키가 **하나도 실리지 않음** 을 각각 단언한다. (2) `period` optional
      두 형태(미지정 / `&period=week`)의 실측 candidate 가 **둘 다** 확인 경로를 예외 0 으로 통과하고
      각각 응답 길이가 `TOTAL_ROWS` · `WEEK_ROWS` 로 실 query 발화를 입증한다.
- [ ] **negative cases 충분 cover** — 최소 3 종을 각각 별도 `it` 로: (a) `iterations: 0` 실측
      candidate 를 토글 on 으로 태워도 throw 0 이고 `count=0` 과 `NaN` 표기가 가공 없이 로그에 실린다,
      (b) `iterations` 음수는 `RangeError` 가 **확인 경로 도달 전에** 전파되고 로거 호출이 0 회다,
      (c) 실측 국면을 연속 2 회 태워도 예외 0 이고 로그 호출 수가 정확히 2 회이며 반환 `status` 가
      매번 위 3 값 중 하나다(반복 호출 부작용 0). `test/perf/baselines/` 실경로 무오염 · 전역 토글
      누출 0 국면은 `registerCheckinBaselineWiringSuite` 의 `error (2)` · `negative (c)` 가 **같은 코드
      경로로 이미 cover** 하므로 **재작성 금지**(T-1575 중복 국면 삭제 선례).
- [ ] 실측 반복 수는 **20**(`REAL_CLOCK_ITER = 20`) 으로 두고 하한 회귀 가드 상수
      (`REAL_CLOCK_ITER_MIN = 20`) 와 그 값을 지키는 `it` 1 개를 함께 둔다 — 근거·한계·비용 3 줄 주석은
      T-1593 이 person spec 에 박제한 문장을 route 에 맞게 승계한다. 기존 `ITER` · `WIRING_ITER` 는
      **재사용하지 않는다**(비용 축과 의미가 다른 상수).
- [ ] 기존 국면 불변 — `WEEK_ROWS` · `MONTH_ROWS` · `TOTAL_ROWS` · `ITER` · `WIRING_ITER` 값, 기존
      `it` 들의 단언, `registerCheckinBaselineWiringSuite` 호출 인자, `beforeAll`/`beforeEach`/
      `afterEach`/`afterAll` 본문을 **수정하지 않는다**(추가만). `src/` · `prisma/` · 임계값
      (`DEFAULT_P95_MAX_MS = 3000`) 도 0 LOC 변경.
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요) 실행
      로그에 `[perf][checkin-baseline]` 실측 candidate 줄과 `ci-realdb-assessment-read` candidate 줄이
      눈으로 확인된다 — PR 본문에 그 줄 원문 1~2 개를 **그대로 인용**해 다음 slice 의 승인 입력으로
      남긴다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로
      커버리지 수치 변동이 없어야 한다.

## Out of Scope

- **baseline JSON 체크인 금지** — `test/perf/baselines/baseline-ci-realdb-assessment-read.json` 을
  본 task 에서 만들지 않는다(`§Consequences (d)` 의 사람 확인 입력을 먼저 CI 로그로 노출하는 것이
  본 slice 의 전부). 파일 생성·`checkin-baseline-file.spec.ts` 갱신은 다음 slice.
- 다른 perf-spec(person-read-realdb 포함 11 소비자) · 공유 helper
  (`checkin-baseline-*.ts` · `latency-*.ts` · `step-clock.ts`) 수정 금지.
- `test/perf/README.md` · ADR-0056 · 부하계획 문서 갱신 금지(문서 동기는 별도 slice — T-1590 선례).
- `.github/workflows/ci.yml` · `deploy/daily-test.sh` 등 CI/스크립트 변경 금지.
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(ADR-0056 `§Follow-ups (c)` 는 20 run 축적
  미달로 여전히 착수 불가).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 — `§Decision 3 (b)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 요약 (2026-08-18)

`pr` mode, PR [#1280](https://github.com/myungjoo/Assessment-Agent/pull/1280) squash merge `3c3ba11e`
(1 파일 `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` `+293/-0`, `src/` 변경 0).
[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의 "나머지 route
체크인 baseline" 축을 **두 번째 route**(`GET /api/assessments`)로 처음 넓혀, 실측 전용 nested
describe 1 개(label `ci-realdb-assessment-read`, `repoRoot` 생략 · `processEnv` 주입 토글)를 추가했다.
국면 9 개 — happy 1(로그 1 회 · prefix 고정 · status 미하드코딩) · error 2(전량 reject / **인증 미부착
401 전량** — person route 에 없던 새 축) · 분기 2(토글 on·off / `period` 미지정 5 건 vs `week` 3 건) ·
가드 1(하한) · negative 3(`iterations` 0 · 음수 `RangeError` · 연속 2 회). 기존 상수 · 국면 · 배선
호출 인자 · hook 은 전부 불변이고 baseline JSON 생성 · commit 은 Out of Scope 그대로.

CI 로그에 노출된 실측 표본(다음 slice 의 사람 눈 확인 입력):
`label=ci-realdb-assessment-read concurrency=1 p50=1.973ms p95=2.531ms p99=2.664ms
throughput=487.8/s errorRate=0 count=20 pass=true` — REQ-048 의 조회 p95 < 3s 대비 약 3 자릿수 여유.

reviewer VERDICT=APPROVE(round 1, BLOCKER·MAJOR 0, Nit 2 는 정본 승계 / 차기 관찰 사유로 미조치)
+ PR comment 외화(id `IC_kwDOSlgQVc8AAAABPY-lVQ`) + integrator 자체 점검 + PR CI green(run
`32133870603`) 으로 4-게이트 4/4. 438 suite · 12551 test pass, `test:cov` line 99.95% /
function 100%(`src/` 무변경이라 직전 수치 유지).
