---
id: T-1591
title: person 실 DB 조회 perf-spec 의 실측 clock candidate 를 체크인 baseline 확인 경로에 처음 태우기
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T02:20:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1587, T-1589]
touchesFiles:
  - test/perf/person-read-realdb.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (a) 선행: 지금 CI 에 찍히는 candidate 수치가 전부 stepClock 합성값이라 실측 축 관찰 국면 1 벌을 연다"
---

# T-1591 — person 실 DB 조회 perf-spec 의 실측 clock candidate 를 체크인 baseline 확인 경로에 처음 태우기

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)`(체크인 baseline JSON
최초 생성·commit)의 마지막 남은 선행 조건을 연다. T-1584 가 CI 토글을 켜고 T-1589 가 `absent` 국면에
candidate 지표 줄을 실었으며 T-1590 이 그 규약을 harness README 에 박제했지만, **현재 CI 로그에 찍히는
candidate 수치는 전량 합성값**이다 — 체크인 배선 소비자 11 개가 전부 `registerCheckinBaselineWiringSuite`
의 `measure` 로 `createStepClock(stepMs)` 를 주입하기 때문이다(예:
`person-read-realdb.perf-spec.ts` `329~332 행`). 따라서 `§Consequences (d)` 가 요구하는 "사람이 값의
타당성을 확인한 뒤 commit" 의 입력(실 p50/p95/p99)이 아직 어디에도 없다.

본 slice 는 같은 spec 안에 이미 있는 **실측 관찰 국면**(`287~309 행`, `label: "ci-realdb-person-read"`,
주입 clock 없이 `collectLatencySamples` 로 실 DB round-trip 을 20 회 측정)과 **체크인 확인 경로**를 잇는
관찰 국면 1 벌을 추가한다. 실측 label(`ci-realdb-person-read`)은 배선 fixture
label(`realdb-person-read-wiring`)과 이미 분리돼 있어, 앞으로 `§Follow-ups (a)` 가 체크인할 파일
(`test/perf/baselines/baseline-ci-realdb-person-read.json`)은 **실측 축에만** 매달린다 — 합성 국면이 그
파일을 비교 대상으로 삼는 일이 구조적으로 없다. REQ-048 의 "조회 p95 < 3s" 가 실제로 매달린 실 DB
경로라서 첫 체크인 baseline 의 자리로도 이 축이 맞다.

`§Decision 2`(write 국면 부재) · `§Decision 3 (b)`(회귀는 관찰만, exit code 불변)는 그대로다 — 본 task 는
**로그를 하나 더 내는 관찰**일 뿐이며 baseline 파일을 만들지 않는다.

## Required Reading

- `test/perf/person-read-realdb.perf-spec.ts` — 본 task 가 유일하게 수정하는 파일(336 행). 특히
  `SEED_ROWS`/`ITERATIONS`/`WIRING_ITER` 상수(`70~76 행`), `wiringEnv`(`85~88 행`), `seedPersons`
  (`120~` ), `listRequest`(`RequestFn` **값**, `143~148 행`), 실측 관찰 국면(`287~309 행` — `label:
  "ci-realdb-person-read"` + `dataScale` 표기), `registerCheckinBaselineWiringSuite` 호출
  (`322~335 행`), `beforeEach` 의 `tmpRoot` / `afterEach` 의 `truncateAll` 순서를 확인할 것.
- `test/perf/checkin-baseline-spec-wiring.ts` — 본 task 가 새로 부르는 `checkCheckinBaselineForSpec`
  (어댑터 1 회 위임 + `outcome.log` 를 주입 로거로 원문 1 회 출력 + outcome 무가공 반환) 계약과 예외
  전파 규약. `seedCheckinBaselineFixture` 는 본 task 에서 쓰지 않는다.
- `test/perf/checkin-baseline-adapter.ts` — `runCheckinBaselineCheckWithDefaults` 의 기본값 결선
  (`repoRoot` 생략 시 저장소 실경로, `processEnv` 생략 시 전역) + 토글 off 시 `fs` 조회 0 계약.
- `test/perf/checkin-baseline-report.ts` `formatCheckinCandidateLine` — 로그 키 순서
  (`label` · `concurrency` · `p50` · `p95` · `p99` · `throughput` · `errorRate` · `count` · `pass`)와
  prefix 상수 `CHECKIN_LOG_PREFIX = "[perf][checkin-baseline]"`, NaN 무가공 전사 계약.
- `test/perf/latency-collector.ts` `measureBaselineCandidate` — `opts.now` **미주입 시 실 clock**
  (`performance.now`) 사용, `iterations` 기본 30, 요청 reject 는 failure 집계(표본 제외), 임계 위반을
  throw 하지 않고 `pass` 플래그로만 싣는 계약.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 1~3` + `§Consequences (d)` +
  `§Follow-ups (a)` — 본 slice 가 여는 선행 조건의 근거.

## Acceptance Criteria

- [ ] `test/perf/person-read-realdb.perf-spec.ts` 에 **실측 축 전용 nested `describe` 1 개**를 추가하고,
      그 안에서만 `checkCheckinBaselineForSpec` 을 부른다. 실측 국면은 전부 `envMeta` 로 실측 label
      (`label: "ci-realdb-person-read"`, `concurrency: 1`, `dataScale` 는 기존 관찰 국면과 동일 표기)을
      쓰고 **`repoRoot` 를 생략**해 저장소 실경로 바인딩을 탄다. 토글은 **`processEnv` 주입**으로만
      제어하고 `process.env` 를 쓰지도 지우지도 않는다(전역 오염 0).
- [ ] **happy-path 1+** — 실 clock(= `measureBaselineCandidate` 에 `now` **미주입**)으로 `listRequest`
      를 측정한 candidate 를 토글 on(`processEnv` 주입)으로 태우면 예외 0 이고, 주입 로거가 **정확히
      1 회** 호출되며 그 문자열이 `CHECKIN_LOG_PREFIX` 로 시작한다. `status` 는 `"compared"` 또는
      `"skipped"`(`reason: "absent"`) 중 하나임을 실행 시점 파일 존재 여부에 맡겨 **하드코딩하지 않는다**
      (`§Follow-ups (a)` 로 baseline 이 체크인된 뒤에도 성립해야 함). `absent` 이면 로그가 개행 기준
      **정확히 2 줄**이고 둘째 줄에 `p50=` · `p95=` · `p99=` · `throughput=` · `errorRate=` · `count=` ·
      `pass=` 키가 모두 있으며 `count` 가 그 국면의 반복 수와 일치한다.
- [ ] **error path 1+** — 요청이 전량 reject 하는 `RequestFn`(예: `async () => { throw new Error(...) }`)
      으로 만든 실측 candidate 를 같은 경로에 태워도 **throw 0** 이고, candidate 줄에 `errorRate=1` 과
      `pass=false` 가 **가공 없이 전사**된다(`§Decision 3 (b)` exit code 불변). 이 국면은 실 DB 를 건드리지
      않으므로 seed 없이 성립해야 한다.
- [ ] **분기 cover** — 같은 실측 candidate 를 (1) 토글 on(`processEnv` 에 `"1"`) → 수치 줄 포함,
      (2) 토글 off(`processEnv: {}`) → `status: "skipped"` · `reason: "disabled"` 이고 로그가 **1 줄**이며
      `p95=` 같은 수치 키가 **하나도 실리지 않음** 을 각각 단언해 토글 축 두 분기를 모두 태운다.
- [ ] **negative cases 충분 cover** — 최소 다음 2 종을 각각 별도 `it` 로: (a) 표본 0(`iterations: 0`)
      실측 candidate 를 토글 on 으로 태워도 throw 0 이고 `count=0` 과 `NaN` 표기가 가공 없이 로그에 실린다
      (T-1589 포매터 계약이 실경로 바인딩 축에서도 성립), (b) 실측 국면을 연속 2 회 태워도 예외 0 이고
      로그 호출 수가 정확히 2 회이며 반환 `status` 가 매번 위 3 값 중 하나다(반복 호출 부작용 0).
      `test/perf/baselines/` 실경로 무오염 · 전역 토글 누출 0 국면은 `registerCheckinBaselineWiringSuite`
      의 `error (2)` · `negative (c)` 가 **같은 코드 경로로 이미 cover** 하므로 **재작성 금지**(T-1575 중복
      국면 삭제 선례).
- [ ] 기존 국면 불변 — `ITERATIONS` · `SEED_ROWS` · `WIRING_ITER` 상수 값, 기존 `it` 8 개의 단언,
      `registerCheckinBaselineWiringSuite` 호출 인자, `beforeEach`/`afterEach`/`afterAll` 본문을 수정하지
      않는다(추가만). 실측 국면의 반복 수는 실 DB 왕복 비용을 감안해 **작게**(예: 3~5) 두되 그 값은 새
      지역 상수로 두고 기존 상수를 재사용하지 않는다.
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요), 실행 로그에
      실측 candidate 줄이 눈으로 확인된다 — PR 본문에 그 줄 원문 1~2 개를 **그대로 인용**해
      `§Consequences (d)` 승인 입력으로 남긴다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로 커버리지
      수치 변동이 없어야 한다.

## Out of Scope

- `test/perf/baselines/` 아래 baseline JSON 을 **만들지 않는다**(`§Follow-ups (a)` 본체는 별도 task —
  본 slice 는 그 승인 입력만 연다). `seedCheckinBaselineFixture` 호출도 추가하지 않는다.
- `test/perf/checkin-baseline-*.ts` helper 6 종과 그 colocated spec 수정 금지(신규 판정 로직 0 ·
  재구현 0 — 본 task 는 호출만 추가한다).
- 다른 perf-spec(`person-read.perf-spec.ts` 포함 10 개)로의 실측 축 확산 금지 — 첫 표본 1 개만.
- `.github/workflows/ci.yml` · `deploy/daily-test.sh` · `test/perf/README.md` · `docs/PLAN.md` ·
  ADR 본문 수정 금지(문서 동기는 별도 `direct` slice — T-1590 전례).
- wall-clock 수치에 대한 대소 비교 · 임계 단언 추가 금지(공유 runner 비결정성 — 관찰 기록만).
- `process.env` 를 직접 세팅/삭제하는 국면 추가 금지(토글은 `processEnv` 주입으로만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-18T03:08Z DONE)

PR [#1271](https://github.com/myungjoo/Assessment-Agent/pull/1271) squash merge `49bf4c7d`
(1 파일 `+193/-0`). `test/perf/person-read-realdb.perf-spec.ts` 에 실측 축 전용 nested describe
1 개를 추가했다 — label `ci-realdb-person-read`, 전용 상수 `REAL_CLOCK_ITER=3`, `repoRoot` 생략
(실경로 바인딩), 토글은 `processEnv` 주입 전용(전역 env 무접근). 국면 5 개(happy 1 · error 1 ·
분기 1 · negative 2)로 R-112 4 항목을 충족했고 기존 국면 · 상수 · hook 은 불변(추가만).

reviewer VERDICT=APPROVE(round 1) + PR comment 외화 + integrator 자체 점검 + PR CI 전 step
success 로 4-게이트 4/4 충족. `test:cov` line 99.95% / function 100%(`src/` 0 LOC 변경).

ADR-0056 `§Consequences (d)` 가 요구하는 승인 입력이 CI 로그에 처음 실측값으로 찍혔다:

```
[perf][checkin-baseline] candidate label=ci-realdb-person-read concurrency=1 p50=2.955065000000104 p95=3.2266453999991427 p99=3.250785879999057 throughput=333.33333333333337 errorRate=0 count=3 pass=true
```

이로써 `§Follow-ups (a)`(체크인 baseline JSON 최초 생성 · commit)의 마지막 선행 조건이 해소됐다.
