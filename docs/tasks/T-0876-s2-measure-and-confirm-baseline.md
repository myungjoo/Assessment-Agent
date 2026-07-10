---
id: T-0876
title: S2 latency measure→confirm-or-compare end-to-end loop harness 신설 (measureAndConfirmBaseline)
phase: P8
status: DONE
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
plannerNote: "P8 load-resilience §5 #5(baseline 확정 loop) — measureBaselineCandidate→confirmOrCompareBaseline 조립해 measure→(최초확정 write | 로드·비교) 한 줄 진입점. candidate 생산·소비 짝 배선. R-112 backbone×1.5 → est 135."
---

# T-0876 — S2 latency measure→confirm-or-compare end-to-end loop harness 신설 (measureAndConfirmBaseline)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "**최초 실측으로 baseline 확정 → 이후 candidate 와 비교해 회귀 탐지**"하는 baseline 확정 loop 를 요구한다. 앞선 slice 들로 그 loop 의 두 절반이 이미 main 에 안착돼 있다:

- **candidate 생산** — `measureBaselineCandidate(request, env, opts?)`(T-0875, collector 모듈): `collectLatencySamples → assertS2Threshold → buildBaselineReport` 를 조립해 주입 request 로부터 candidate `BaselineReport` 를 생산.
- **candidate 소비** — `confirmOrCompareBaseline(env, baseDir, candidate, options?)`(T-0874, io 모듈): 기준 baseline 이 없으면 candidate 를 최초 확정 write(`{ outcome: "established", path }`), 있으면 로드·비교(`{ outcome: "compared", comparison, report }`).

그러나 이 **생산→소비 두 절반을 한 진입점으로 이어붙이는** 함수가 아직 없다 — 지금은 호출측이 `const candidate = await measureBaselineCandidate(request, env)` 후 `confirmOrCompareBaseline(env, baseDir, candidate)` 를 손으로 두 줄 배선해야 한다. 본 slice 는 그 배선을 얇은 async harness `measureAndConfirmBaseline(request, env, baseDir, opts?)` 로 collector 모듈에 박제해, §5 #5 실 harness·CI step 이 **한 줄**로 "측정 → (최초면 확정 write / 이후면 회귀 비교)" loop 를 돌릴 수 있게 한다:

```
measureBaselineCandidate(request, env, measureOpts)   // candidate 생산(async I/O)
  → confirmOrCompareBaseline(env, baseDir, candidate, compareOptions)  // 최초 확정 write | 로드·비교
```

이 함수가 있으면 실 supertest harness(§5 #2 배선)는 `await measureAndConfirmBaseline(() => request(app).get(...), env, baseDir)` 한 줄로 baseline 확정/회귀탐지 loop 를 완성한다. `measureBaselineCandidate` 이 candidate 를 생산하는 짝, `confirmOrCompareBaseline` 이 소비하는 짝이라면, 본 함수는 **둘을 이어붙인 top-of-pyramid 진입점**이다.

## 설계 요지

- **collector 모듈 `test/perf/latency-collector.ts` 에 함수 추가** — 신규 파일 신설 없이 `measureBaselineCandidate`(305행~) 바로 아래에 조립 진입점을 추가한다. import 방향은 **collector → io**(올바른 방향 — io 모듈은 collector 를 import 하지 않으므로 순환 없음): 파일 상단 import 블록에 `import { confirmOrCompareBaseline, ConfirmOrCompareResult } from "./latency-baseline-io";` 를 신설한다. `measureBaselineCandidate`·`MeasureBaselineOpts`·`RequestFn`·`BaselineEnvMeta` 는 같은 파일 내 심볼이라 직접 사용, `CompareOptions` 는 `./latency-baseline` import 에 추가한다.
- **옵션 타입 — measure + compare 파라미터 묶음**:
  ```ts
  export interface MeasureAndConfirmOpts {
    /** measure 파라미터(iterations/thresholds/now) — measureBaselineCandidate 로 위임. */
    measure?: MeasureBaselineOpts;
    /** 회귀 판정 허용치 — confirmOrCompareBaseline(존재 분기 readCompareBaselineFile)로 위임. */
    compare?: CompareOptions;
  }
  ```
  둘 다 optional. `measure` 미지정 시 `measureBaselineCandidate` 기본치(iterations 30·기본 thresholds·기본 clock), `compare` 미지정 시 `confirmOrCompareBaseline` 기본 tolerance 로 위임.
- `measureAndConfirmBaseline(request, env, baseDir, opts?): Promise<ConfirmOrCompareResult>` — 절차(신규 판정·계산·io 0 — 하위 primitive 를 조립만):
  1. `candidate = await measureBaselineCandidate(request, env, opts?.measure)` 로 candidate 생산(async I/O). request 비함수·iterations/clock/thresholds 무효·env 형태 불량은 여기서 그대로 전파(confirm 미도달).
  2. `return confirmOrCompareBaseline(env, baseDir, candidate, opts?.compare)` 로 확정 write | 로드·비교 후 판별 union 반환(baseDir non-string `TypeError`·빈/공백 `RangeError`·존재 분기 파일부재 `ENOENT`·내용불량 `SyntaxError`/`TypeError`·tolerance 무효 `RangeError` 그대로 전파).
- **순서 계약** — measure(async I/O) → confirmOrCompare(동기 fs) 순서를 지킨다. measure 가 reject/throw 하면 confirmOrCompare 가 일어나지 않는다(candidate 미생산 시 write·compare 부작용 0).
- **측정·확정·비교 위임 불변(DRY)** — candidate 생산은 `measureBaselineCandidate`, 존재 판정·write·로드·비교는 `confirmOrCompareBaseline` 에 전적으로 위임한다(재구현 금지). 본 함수는 measure→confirm 의 얇은 이어붙임 + 옵션 분배(`opts.measure`/`opts.compare`)만 책임진다.
- **관찰·리포트 전용** — 반환은 `ConfirmOrCompareResult` 판별 union(`"established"`+path | `"compared"`+comparison/report)뿐이며, 회귀는 `comparison.regressed`(존재 분기) 로 노출만 한다(throw 안 함). S2 pass/fail 임계·collector metrics 판정 로직 불변.
- **request 는 주입** — `RequestFn`(`() => Promise<{ ok?; status? }>`)을 주입받아 DB·네트워크·supertest 무의존으로 결정론적 unit-test 가능. 실 supertest 배선은 호출측 책임(§5 #2 별도 slice, Out of Scope).
- **async 반환** — `measureBaselineCandidate` 이 async 이므로 본 함수도 `Promise<ConfirmOrCompareResult>` 반환. `confirmOrCompareBaseline` 자체는 동기(fs `*Sync`)이지만 await 한 candidate 를 그대로 넘긴다.
- **신규 dependency 0** — 기존 collector/io 함수만 조립. 새 외부 dep 추가 없음.

## Required Reading

- `test/perf/latency-collector.ts` — `measureBaselineCandidate`(305행~ — `request`·`env`·`opts` 계약, `Promise<BaselineReport>` 반환, collect→assert→build 조립·하위 예외 그대로 전파)·`MeasureBaselineOpts`(263행)·`RequestFn`(27행 근처)·상단 import 블록(13~24행 — `./latency-baseline` 에서 `buildBaselineReport`/`BaselineEnvMeta`/`BaselineReport`, `./latency-metrics` 에서 metrics primitive). 본 task 는 이 모듈에 조립 함수 1개를 **추가**하며 `measureBaselineCandidate` 바로 아래에 배치하고, 상단 import 블록에 `./latency-baseline-io`(confirmOrCompareBaseline/ConfirmOrCompareResult) import 라인을 신설하고 `./latency-baseline` import 에 `CompareOptions` 를 추가한다. import 패턴·"순서 계약"·하위 예외 그대로 전파 컨벤션·JSDoc 스타일을 그대로 따른다.
- `test/perf/latency-baseline-io.ts` — `confirmOrCompareBaseline(env, baseDir, candidate, options?)`(381행~ — `baselineFileExists` → 부재:`writeBaselineFile` | 존재:`readCompareBaselineFile`, `ConfirmOrCompareResult` 판별 union 반환, 하위 예외 그대로 전파)·`ConfirmOrCompareResult`(331행 — `"established"`+path | `"compared"`+comparison/report). 본 task 는 이를 collector 모듈에서 **import 만** 하고 io 파일에 새 함수를 추가하지 않는다(io 모듈은 collector 를 import 하지 않아 순환 없음 — 방향은 collector→io).
- `test/perf/latency-baseline.ts` — `CompareOptions`·`BaselineComparison`·`BaselineReport`·`BaselineEnvMeta` 타입 정의(옵션 위임·반환 타입 참조용). 본 task 는 이 파일을 수정하지 않는다.
- `docs/ops/load-resilience-test-plan.md` §5 #5(baseline 확정 + 임계 fix, 134행) + §5 #2(S2 조회 latency 경량 harness, 129행) — measure→confirmOrCompare loop 가 §5 #5 의 "최초 실측 확정 → 이후 비교 회귀탐지" 목표를 한 진입점으로 흡수함, 실 supertest 배선(§5 #2)은 별도 slice 근거.
- `test/perf/README.md` §"표본 수집기 (`latency-collector.ts`)" 절(56행~, 특히 `measureBaselineCandidate` 항목 68행~) + §"disk io harness (`latency-baseline-io.ts`)" 절 `confirmOrCompareBaseline`(51행) — 신규 loop harness(`measureAndConfirmBaseline`) 항목을 measure 함수 목록 끝(`measureBaselineCandidate` 다음)에 추가할 위치. 두 짝(생산 measureBaselineCandidate + 소비 confirmOrCompareBaseline)을 이어붙인 진입점임을 cross-reference.
- `test/perf/latency-collector.spec.ts` — `measureBaselineCandidate` 의 colocated spec(주입 clock stub·주입 request fake·fixture 관용구). 그 관용구를 재사용해 loop spec 을 같은 파일 끝에 추가한다. `confirmOrCompareBaseline` 의 disk 부작용을 격리할 임시 디렉토리(`fs.mkdtemp`/`os.tmpdir` 기반 unique dir, afterEach 정리)나 기존 io spec 의 임시-dir 관용구를 참고해 write/compare 양쪽 분기를 결정론적으로 검증한다.

## Acceptance Criteria

- [ ] `test/perf/latency-collector.ts` 모듈에 `MeasureAndConfirmOpts` 인터페이스(`measure?: MeasureBaselineOpts`/`compare?: CompareOptions`)와 `measureAndConfirmBaseline(request, env, baseDir, opts?): Promise<ConfirmOrCompareResult>` 함수를 export 추가. `await measureBaselineCandidate(request, env, opts?.measure)` → `confirmOrCompareBaseline(env, baseDir, candidate, opts?.compare)` 조립으로 구현. 측정·확정·비교 로직 재구현 금지(전적 위임 DRY), 기존 함수(`measureBaselineCandidate`/`confirmOrCompareBaseline`) 서명 변경 0, io 모듈(`latency-baseline-io.ts`)·baseline 모듈 변경 0, 신규 외부 dep 0. import 방향 collector→io(순환 없음).
- [ ] Happy-path unit test 1+ — (a) **최초 확정(established) 분기**: 임시 baseDir(파일 부재)에서 주입 `request`(성공 fake)+주입 `now`(결정론 stub)로 호출 시 반환이 `{ outcome: "established", path }` 이고, `path` 에 candidate 가 실제로 write 됨(디스크 파일 존재·내용이 `measureBaselineCandidate` 산출 candidate 와 round-trip 동치)을 assert. (b) **비교(compared) 분기**: 같은 baseDir 에 baseline 이 이미 있는 상태에서 재호출 시 반환이 `{ outcome: "compared", comparison, report }` 이고 `comparison`/`report` 가 `confirmOrCompareBaseline` 을 수동 조립한 값과 동치임을 assert. 두 경우 모두 `measureBaselineCandidate` 결과가 그대로 confirm 에 전달됨을 검증.
- [ ] Error path unit test 1+ — 각 예외가 부작용 없이 그대로 전파됨을 검증: (1) `request` 가 함수 아님(예: `null`) → `measureBaselineCandidate` 경유 `TypeError` 전파(confirm 미도달·파일 미생성), (2) `opts.measure.iterations` 음수·NaN → `RangeError` 전파, (3) `env` 형태 불량(예: `null`) 또는 `env.label` 빈 → measure/경로결정 `TypeError`/`RangeError` 전파, (4) `baseDir` non-string → `confirmOrCompareBaseline` `TypeError` 전파, (5) `baseDir` 빈/공백-only → `RangeError` 전파, (6) 비교 분기에서 저장 파일 내용이 유효 JSON 아님(사전 손상 fixture) → `SyntaxError` 전파, (7) `opts.compare` tolerance 음수·NaN → 비교 분기 `RangeError` 전파.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) baseline **부재** → established 분기(write 발생) vs (2) baseline **존재** → compared 분기(write 없이 read·compare), (3) `opts.measure` 지정 시 그 값이 `measureBaselineCandidate` 로 전달됨(예: iterations 를 낮춰 호출 횟수 검증) vs 미지정 시 기본 30, (4) `opts.compare` 지정 시 그 tolerance 가 비교 분기 판정에 반영됨(예: tolerance 를 좁혀 `comparison.regressed=true` 유도) vs 미지정 시 기본 tolerance. measure 위임 경로·compare 위임 경로를 describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: `opts`=`undefined` → 기본 measure(iterations 30)·기본 compare tolerance 로 정상 established/compared 동작, established 분기 candidate 가 임계 위반(예: 낮춘 p95MaxMs 로 pass=false)이어도 함수는 throw 없이 established write 를 수행하고 pass=false candidate 가 파일에 저장됨(관찰 전용)을 assert, compared 분기에서 회귀 발생(tolerance 좁힘)이 `comparison.regressed=true` 로만 노출되고 함수는 throw 하지 않음을 assert, measure 가 reject(주입 request 가 throw)하면 confirm 미도달로 파일이 생성되지 않음(부작용 0)을 assert.
- [ ] `test/perf/README.md` 의 표본 수집기 절(`measureBaselineCandidate` 항목 다음)에 loop harness(`measureAndConfirmBaseline`) 항목 1~3줄을 추가: `measureBaselineCandidate` → `confirmOrCompareBaseline` 조립(candidate 생산→소비 이어붙임)·`opts.measure`/`opts.compare` 옵션 분배·측정/확정/비교 위임(DRY)·순서 계약(measure reject 시 confirm 미도달)·관찰 전용(회귀는 `comparison.regressed` 노출만·throw 안 함)·§5 #5 baseline 확정 loop 의 top-of-pyramid 진입점(실 supertest 배선은 §5 #2 별도 slice)임을 명시. `disk io harness` §의 `confirmOrCompareBaseline` 과 cross-reference.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- 실 supertest 배선(NestJS `app` 부트스트랩 → `() => request(app).get("/api/...")` request 함수 조립 → `measureAndConfirmBaseline` 호출) 구현 — §5 #2 실 measure harness 별도 slice. 본 task 는 loop 조립 함수 1개만 추가하고 `request` 는 주입 `RequestFn` 으로 받는다(실 HTTP 호출은 호출측 책임).
- CI job 편입(부하 harness workflow §5 #4), 실 baseline JSON 파일을 repo 에 확정·체크인, 실 Postgres 실측·§3 "baseline 후 fix" 임계 실수치 확정 — 전부 별도 follow-up(§5 #4·#5). 본 task 는 loop 함수만 추가하고 실측·baseline 체크인은 하지 않는다(spec 은 임시 디렉토리에서만 write).
- `measureBaselineCandidate`/`confirmOrCompareBaseline`/`readCompareBaselineFile`/`writeBaselineFile`/`baselineFileExists` 재수정·서명 변경 — 이미 main 안착. 본 task 는 loop 함수 1개만 추가하고 기존 함수는 조립 재료·spec 셋업으로만 재사용.
- `latency-baseline-io.ts`·`latency-baseline.ts`·`latency-metrics.ts` 파일 변경 금지 — 본 task 는 collector 모듈(`latency-collector.ts`)에 조립 함수 1개만 추가하고 io/baseline 심볼은 import 만 한다(io→collector 역방향 import 도입 금지 — 순환 회피).
- 측정·존재판정·write·로드·비교 로직 재구현 금지 — 전적으로 `measureBaselineCandidate` + `confirmOrCompareBaseline` 위임(DRY).
- 회귀 시 throw / process.exit / expect assertion 금지 — 본 함수는 관찰 전용으로 `ConfirmOrCompareResult` 판별 union 을 반환만 하고 회귀/임계를 강제하지 않는다(회귀 강제는 호출측 expect·`comparison.regressed` 검사 책임).
- `measureBaselineCandidate` 의 순차 measure 성격 유지 — 병렬·동시성 request 발생 도입 금지(고동시성은 S3, 신규 도구 필요 — §4.2 BLOCKED).
- 신규 외부 dependency 추가 금지(기존 collector/io/baseline 함수 + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: `measureAndConfirmBaseline` 을 실 supertest request 함수·NestJS app 부트스트랩과 배선한 §5 #2 실 measure harness slice(첫 fs+HTTP 통합 perf-spec) / 부하 harness CI job 편입 §5 #4 / 실 baseline JSON 을 repo 에 확정·체크인 + §3 "baseline 후 fix" 임계 실수치 확정 §5 #5 / S1·S3 부하 harness(§5 #3, 신규 도구 ADR-0054 owner 승인 전제))
