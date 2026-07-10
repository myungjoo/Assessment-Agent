---
id: T-0875
title: S2 latency measure→candidate 조립 harness 신설 (measureBaselineCandidate)
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 135
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-collector.ts
  - test/perf/latency-collector.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #2(S2 조회 latency 경량 harness) — collectLatencySamples→assertS2Threshold→buildBaselineReport 조립해 candidate BaselineReport 생성. confirmOrCompareBaseline 의 measure 짝. R-112 backbone×1.5 → est 135."
---

# T-0875 — S2 latency measure→candidate 조립 harness 신설 (measureBaselineCandidate)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #2 는 "**S2 조회 latency 경량 harness**"(supertest 기반 반복 호출 measure, 신규 dependency 불요)를 요구한다. 앞선 T-0862~T-0874 slice 들은 그 measure 가 산출한 candidate 를 **저장·비교·확정**하는 disk io + confirm-or-compare surface 를 모두 갖췄고(`confirmOrCompareBaseline` T-0874 로 완결), collector 쪽 측정 primitive 3종도 이미 있다: 표본 수집(`collectLatencySamples`), 임계 판정(`assertS2Threshold`), candidate 리포트 조립(`buildBaselineReport`).

그러나 이 셋을 **한 measure 진입점으로 조립**하는 함수가 아직 없다 — 지금은 각 perf-spec 이 `collectLatencySamples → assertS2Threshold` 를 개별 배선하고, candidate `BaselineReport` 를 뽑아 `confirmOrCompareBaseline` 에 넘기는 "measure→candidate" 경로가 명시적 함수로 박제돼 있지 않다. 본 slice 는 그 조립을 얇은 async harness `measureBaselineCandidate(request, env, opts?)` 로 collector 모듈에 박제한다:

```
collectLatencySamples(request, iterations, { now })  // 반복 호출·표본 수집
  → assertS2Threshold(result, thresholds)            // p95/errorRate 임계 판정 + throughput 관찰
  → buildBaselineReport(env, assertion)              // candidate BaselineReport 조립
```

이 함수가 있으면 실 harness(§5 #2 supertest 배선)·CI step 은 `measureBaselineCandidate(() => request(app).get(...), env)` 한 줄로 candidate 를 뽑아 `confirmOrCompareBaseline(env, baseDir, candidate)` 에 그대로 넘겨 baseline 확정/회귀탐지 loop 를 완성한다. `confirmOrCompareBaseline` 이 candidate 를 **소비**하는 진입점이라면, 본 함수는 candidate 를 **생산**하는 짝이다.

## 설계 요지

- **기존 모듈 `test/perf/latency-collector.ts` 에 함수 추가** — 신규 파일 신설 없이 measure primitive 목록 끝(`assertS2Threshold` 옆)에 조립 진입점을 추가한다. `buildBaselineReport`·`BaselineEnvMeta`·`BaselineReport` 를 `./latency-baseline` 에서 import 한다(collector 는 지금까지 baseline 을 import 하지 않았으므로 import 라인 신설). `collectLatencySamples`·`assertS2Threshold`·`RequestFn`·`NowFn`·`S2Thresholds` 는 같은 파일 내 심볼이라 직접 사용.
- **옵션 타입 — measure 파라미터 묶음**:
  ```ts
  export interface MeasureBaselineOpts {
    /** 반복 호출 횟수(collectLatencySamples 의 iterations). 기본 30 (S2 경량 스모크 수준). */
    iterations?: number;
    /** S2 임계(p95/errorRate 상한). 기본 assertS2Threshold 기본치(p95<3000ms, errorRate<0.01). */
    thresholds?: S2Thresholds;
    /** monotonic clock 주입(테스트 결정성). 기본 performance.now — collectLatencySamples 로 위임. */
    now?: NowFn;
  }
  ```
  기본 `iterations = 30`(단일-클라이언트 경량 스모크 — §4.1 "부하 발생기 아님"). `thresholds`·`now` 는 미지정 시 하위 primitive 기본치로 위임.
- `measureBaselineCandidate(request, env, opts?): Promise<BaselineReport>` — 절차(신규 판정·계산 0 — 하위 primitive 를 조립만):
  1. `iterations` 결정(`opts.iterations` 미지정 시 30). `iterations` 가 음수·비정수·NaN 이면 `collectLatencySamples` 가 `RangeError` 를 던지므로 그대로 전파(재검증·중복 throw 금지).
  2. `collectLatencySamples(request, iterations, { now: opts?.now })` 로 표본 수집(`request` 비함수 → `TypeError`, 비단조 clock → `RangeError` 전파).
  3. `assertS2Threshold(result, opts?.thresholds)` 로 임계 판정(thresholds 값 음수·NaN → `RangeError` 전파). 빈 표본이어도 assertion 은 throw 안 하고 fail 사유만 담으므로 정상 진행.
  4. `buildBaselineReport(env, assertion)` 로 candidate `BaselineReport` 조립·반환(env 형태 불량 → `TypeError`, env.label 빈/concurrency 음수 → `RangeError` 전파).
- **순서 계약** — collect(async I/O) → assert(순수 판정) → build(순수 조립) 순서를 지킨다. collect 가 reject/throw 하면 assert·build 가 일어나지 않는다.
- **판정·조립 위임 불변** — 표본 수집은 `collectLatencySamples`, 임계 판정·throughput 관찰은 `assertS2Threshold`, candidate 조립은 `buildBaselineReport` 에 전적으로 위임한다(재구현 금지 — DRY). 본 함수는 iterations 기본값 + collect→assert→build 의 얇은 조립만 책임진다.
- **관찰·리포트 전용** — 반환은 candidate `BaselineReport`(pass 플래그 포함) 뿐이며 throw 로 pass/fail 을 강제하지 않는다. 임계 위반은 `assertS2Threshold` 가 assertion.pass=false·reasons 에 담고, 본 함수는 그것을 `buildBaselineReport` 경유 report.pass 로 전달만 한다(임계 강제·expect 는 호출측/별도 assertS2Threshold 책임).
- **request 는 주입** — `RequestFn`(`() => Promise<{ ok?; status? }>`)을 주입받아 DB·네트워크·supertest 무의존으로 결정론적 unit-test 가능. 실 supertest 배선은 호출측 책임(§5 #2 별도 slice, Out of Scope).
- **신규 dependency 0** — 기존 collector/baseline 함수만 사용. 새 외부 dep 추가 없음.

## Required Reading

- `test/perf/latency-collector.ts` — `collectLatencySamples`(75행~ — `request`·`iterations`·`opts.now` 계약, `CollectResult` 반환)·`assertS2Threshold`(172행~ — `CollectResult`→`S2Assertion` 판정, throw 안 하고 pass/reasons 담음, thresholds 음수·NaN 만 `RangeError`)·`RequestFn`(27행)·`NowFn`(30행)·`S2Thresholds`(134행)·`S2Assertion`(142행)이 있는 measure 모듈. import 패턴·"순서 계약(경로/수집을 판정 전에 완료)"·하위 예외 그대로 전파 컨벤션·JSDoc 스타일을 그대로 따른다. 본 task 는 이 모듈에 조립 함수 1개를 **추가**하며, 특히 `collectLatencySamples`(iterations 계약)·`assertS2Threshold`(빈 표본이어도 throw 안 함) 을 조립 재료로 삼는다.
- `test/perf/latency-baseline.ts` — `buildBaselineReport(env, assertion)`(89행~ — `S2Assertion`→`BaselineReport` 조립, env 형태·label·concurrency 검증, assertion 형태 불량 `TypeError`)·`BaselineEnvMeta`(21행)·`BaselineReport`(38행). 본 task 는 이를 collector 모듈에서 **import 만** 하고 baseline 파일에 새 함수를 추가하지 않는다.
- `docs/ops/load-resilience-test-plan.md` §5 #2(S2 조회 latency 경량 harness, 129행) + §4.1(supertest 기반 반복 호출 measure — 단일-클라이언트 스모크, 부하 발생기 아님, 100행~) + §3 표(S2 임계) — 경량 measure 성격·iterations 기본 30 근거·관찰 전용성.
- `test/perf/README.md` §"표본 수집기 (`latency-collector.ts`)" 절(56행~) — 조립 harness(`measureBaselineCandidate`) 항목 1~2줄을 measure 함수 목록 끝에 추가할 위치. §"disk io harness" 절 `confirmOrCompareBaseline`(51행)이 본 함수가 생산한 candidate 를 소비하는 짝임을 cross-reference.
- `test/perf/latency-collector.spec.ts` — `collectLatencySamples`/`assertS2Threshold` 의 colocated spec. 주입 clock stub(`now` 를 배열 큐로 결정론화)·주입 `request`(성공/실패/reject fake)·fixture 관용구를 그대로 재사용해 조립 spec 을 같은 파일 끝에 추가한다.

## Acceptance Criteria

- [ ] `test/perf/latency-collector.ts` 모듈에 `MeasureBaselineOpts` 인터페이스(`iterations?`/`thresholds?`/`now?`)와 `measureBaselineCandidate(request, env, opts?): Promise<BaselineReport>` 함수를 export 추가. `collectLatencySamples` → `assertS2Threshold` → `buildBaselineReport` 조립으로 구현(iterations 기본 30). 수집·판정·조립 로직 재구현 금지(전적 위임 DRY), 기존 함수(`collectLatencySamples`/`assertS2Threshold`)·baseline primitive(`buildBaselineReport`) 서명 변경 0, 신규 외부 dep 0.
- [ ] Happy-path unit test 1+ — 주입 `request`(성공 응답 fake) + 주입 `now`(결정론적 stub)로 `measureBaselineCandidate` 호출 시 반환 `BaselineReport` 의 `env`·`p50`/`p95`/`p99`·`throughput`·`errorRate`·`count`·`pass` 가 동일 입력에 대해 `collectLatencySamples`+`assertS2Threshold`+`buildBaselineReport` 를 수동 조립한 값과 동치임을 assert. `iterations` 미지정 시 기본 30 회 호출됨(주입 request 호출 횟수로 검증)도 assert.
- [ ] Error path unit test 1+ — 각 예외가 부작용 없이 그대로 전파됨을 검증: (1) `request` 가 함수 아님(예: `null`) → `collectLatencySamples` `TypeError` 전파(판정·조립 미도달), (2) `opts.iterations` 음수·비정수·NaN → `collectLatencySamples` `RangeError` 전파, (3) `opts.thresholds.p95MaxMs`/`errorRateMax` 음수·NaN → `assertS2Threshold` `RangeError` 전파, (4) `env` 형태 불량(예: `null`) 또는 `env.label` 빈·`env.concurrency` 음수 → `buildBaselineReport` `TypeError`/`RangeError` 전파.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) `opts.iterations` 지정 시 그 값이 `collectLatencySamples` 로 전달됨 vs (2) `opts` 미지정 시 기본 30 이 쓰임, (3) `opts.now` 지정 시 clock 주입이 collector 로 전달됨 vs 미지정 시 기본 clock, (4) `opts.thresholds` 지정 시 임계가 판정에 반영됨(예: p95MaxMs 를 낮춰 pass=false 유도) vs 미지정 시 기본 임계. 각 옵션 위임 경로를 describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: `opts`=`undefined` → 기본 iterations 30·기본 thresholds·기본 clock 로 정상 동작, `iterations`=0 → 빈 표본이라 `assertS2Threshold` 가 throw 없이 pass=false·측정불가 reason 을 담고 `buildBaselineReport` 가 NaN percentile 포함 candidate 를 정상 반환(예외 아님 — 관찰 전용)을 assert, 주입 `request` 가 일부 non-2xx/reject 를 내면 그 실패가 `errorRate`>0·`failures` 로 반영된 candidate 가 반환됨을 assert, 임계 위반(예: 낮춘 p95MaxMs)이 candidate.pass=false 로만 노출되고 함수는 throw 하지 않음을 assert.
- [ ] `test/perf/README.md` 의 표본 수집기 절에 조립 harness(`measureBaselineCandidate`) 항목 1~2줄을 measure 함수 목록 끝에 추가(`collectLatencySamples` → `assertS2Threshold` → `buildBaselineReport` 조립·iterations 기본 30·수집/판정/조립 위임(DRY)·순서 계약·하위 예외 그대로 전파·관찰 전용(임계 위반은 candidate.pass 로 노출만·throw 안 함)·`confirmOrCompareBaseline` 이 소비하는 candidate 생산 짝·§5 #2 경량 measure 진입점 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- 실 supertest 배선(NestJS `app` 부트스트랩 → `() => request(app).get("/api/...")` request 함수 조립 → `measureBaselineCandidate` 호출) 구현 — §5 #2 실 measure harness 별도 slice. 본 task 는 조립 함수 1개만 추가하고 `request` 는 주입 `RequestFn` 으로 받는다(실 HTTP 호출은 호출측 책임).
- `measureBaselineCandidate` 를 `confirmOrCompareBaseline` 과 배선한 end-to-end S2 baseline loop(measure→confirmOrCompare) 구현 — 별도 follow-up(§5 #5). 본 task 는 candidate 생산 함수만 추가하고 소비(confirm-or-compare)는 이미 T-0874 로 main 안착.
- 실 baseline 디렉토리 레이아웃 확정·commit(repo 에 baseline JSON 체크인), CI job 편입(부하 harness workflow §5 #4), 실 Postgres 실측·§3 "baseline 후 fix" 임계 실수치 확정 — 전부 별도 follow-up(§5 #4·#5).
- `collectLatencySamples`/`assertS2Threshold`/`summarizeLatency`/`errorRate`/`throughput` 재수정·서명 변경 — 이미 main 안착. 본 task 는 조립 함수 1개만 추가하고 기존 함수는 조립 재료·spec 셋업으로만 재사용.
- `buildBaselineReport`/`compareBaselineReports`/`serializeBaselineReport`/`parseBaselineReport`/`formatComparisonReport`/`resolveBaselinePath`/io 모듈(`latency-baseline-io.ts`) 함수 변경 금지 — 본 task 는 collector 모듈에 조립 함수 1개만 추가하고 `buildBaselineReport`·타입은 import 만 한다.
- 수집·임계 판정·candidate 조립 로직 재구현 금지 — 전적으로 `collectLatencySamples` + `assertS2Threshold` + `buildBaselineReport` 위임(DRY).
- 임계 위반 시 throw / process.exit / expect assertion 금지 — 본 함수는 관찰 전용으로 candidate `BaselineReport`(pass 플래그 포함)를 반환만 하고 pass/fail 을 강제하지 않는다(임계 강제는 호출측 expect·별도 assertS2Threshold 책임).
- `collectLatencySamples` 의 async 계약은 그대로 두되(본 함수도 `Promise` 반환) 병렬·동시성 request 발생 도입 금지 — 기존 순차 measure 성격 유지(고동시성은 S3, 신규 도구 필요 — §4.2 BLOCKED).
- 신규 외부 dependency 추가 금지(기존 collector/baseline 함수 + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: `measureBaselineCandidate` 를 실 supertest request 함수와 배선한 §5 #2 실 measure harness slice / `measureBaselineCandidate`→`confirmOrCompareBaseline` end-to-end S2 baseline loop 배선 §5 #5 / 실 baseline JSON 파일을 repo 에 확정·체크인 / 부하 harness CI job 편입 §5 #4 / §3 "baseline 후 fix" 임계 실수치 확정 §5 #5)
