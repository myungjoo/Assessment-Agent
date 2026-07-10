---
id: T-0877
title: S2 measure→confirm-or-compare 첫 실 supertest 배선 perf-spec 신설 (app-root health-read + fs baseline round-trip)
phase: P8
status: DONE
commitMode: pr
prNumber: 771
mergedAs: 103f5b3a
reviewRounds: 1
completedAt: 2026-07-10T04:57:00Z
coversReq: [REQ-048]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/app-root-measure-confirm.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #2(실 supertest measure harness) — measureAndConfirmBaseline 을 live NestJS GET /api 요청·임시 baseDir fs round-trip 에 첫 배선(established+compared 양분기). backbone×1.5 → est 200."
---

# T-0877 — S2 measure→confirm-or-compare 첫 실 supertest 배선 perf-spec 신설 (app-root health-read + fs baseline round-trip)

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #2 는 "**S2 조회 latency 경량 harness**"(supertest 기반 반복 호출 measure, 신규 dependency 불요)를 요구한다. 앞선 T-0828~T-0876 slice 들이 이 harness 의 순수 primitive·조립 진입점 pyramid 를 모두 main 에 안착시켰다:

- **측정·판정·조립 primitive** — `collectLatencySamples`/`assertS2Threshold`/`buildBaselineReport` (T-0828/T-0829).
- **candidate 생산** — `measureBaselineCandidate(request, env, opts?)` (T-0875): 위 셋을 조립해 candidate `BaselineReport` 생산.
- **candidate 소비(확정 write | 로드·비교)** — `confirmOrCompareBaseline(env, baseDir, candidate, opts?)` (T-0874).
- **top-of-pyramid 진입점** — `measureAndConfirmBaseline(request, env, baseDir, opts?)` (T-0876): 위 생산→소비 두 짝을 한 줄로 이어붙여 measure→(최초 확정 write | 로드·비교) loop 를 완성.

그러나 이 pyramid 는 지금까지 **전부 주입 `RequestFn`(fake) + 임시-dir 격리 단위 spec** 으로만 검증됐다 — `measureAndConfirmBaseline` 을 **실 NestJS supertest app 요청**(`() => request(app.getHttpServer()).get("/api")`)과 **실 파일시스템 baseline round-trip** 에 배선한 통합 perf-spec 이 아직 하나도 없다(기존 30 개 `*-read.perf-spec.ts` 는 모두 `collectLatencySamples`/`assertS2Threshold` 를 개별 배선하고, top loop `measureAndConfirmBaseline` 도·fs baseline 확정/비교도 태우지 않는다). §5 #2 가 요구하는 "실 harness" 의 첫 조각은 바로 이 **fs+HTTP 통합** 이다.

본 slice 는 그 첫 통합 perf-spec `app-root-measure-confirm.perf-spec.ts` 를 신설한다. floor case 인 `AppController` health-read(`GET /api` — guard 미적용·param 0·`getStatus()` 동기 상수 200 반환, 기존 `app-root-read.perf-spec.ts` T-0859 가 배선한 가장 단순한 read)를 실 supertest app 으로 부트스트랩하고, `measureAndConfirmBaseline(() => request(app).get("/api"), env, tmpBaseDir)` 를 태워 **두 국면 양쪽**을 실증한다:

```
1회차 호출 → baseline 부재 → established 분기 → 임시 baseDir 에 baseline JSON 실 write → { outcome: "established", path }
2회차 호출 → baseline 존재 → compared 분기 → 실 fs 로드·비교 → { outcome: "compared", comparison, report }
```

이 spec 이 있으면 §5 #2 "실 supertest measure harness" 가 실제 HTTP 요청·실 파일 baseline round-trip 위에서 동작함이 CI 로 지속 검증되고, 이후 slice(다른 endpoint 배선·§5 #4 CI job 편입·§5 #5 실 baseline 체크인)의 참조 배선 패턴이 된다.

## 설계 요지

- **신규 perf-spec 파일 1개 신설** — `test/perf/app-root-measure-confirm.perf-spec.ts`. 기존 `app-root-read.perf-spec.ts`(T-0859)의 부트스트랩 관용구(`Test.createTestingModule({ controllers: [AppController], providers: [{ provide: AppService, useValue: mock }] })` → `createNestApplication` → `app.init()`, guard 미적용이라 `overrideGuard` 불요, `getStatus` mockReturnValue 로 200 고정 문자열)를 그대로 재사용한다. `jest-perf.json`(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로만 실행된다(기본 `pnpm test` 는 picking 0).
- **top-of-pyramid loop 를 실 요청·실 fs 에 배선** — `measureAndConfirmBaseline(request, env, baseDir, opts?)` 를 collector 모듈에서 import 해 호출한다. `request` 는 실 supertest 요청 함수(`async () => { const res = await request(app.getHttpServer()).get("/api"); return { status: res.status }; }`), `env` 는 결정론적 `BaselineEnvMeta`(label/concurrency 고정), `baseDir` 는 **테스트 격리 임시 디렉토리**(`fs.mkdtemp(path.join(os.tmpdir(), ...))` beforeEach 생성 + afterEach `fs.rm(recursive)` 정리 — 실 repo 파일 미오염). `opts.measure.iterations` 는 낮춰(예: 3~5) CI 소요를 억제하고, `opts.measure.now` 는 주입 monotonic clock 으로 결정론화한다(가능하면).
- **established → compared 두 분기 실 실행**:
  1. **1회차(established)** — 임시 baseDir 가 비어 있으므로 `measureAndConfirmBaseline` 반환이 `{ outcome: "established", path }`. `path` 에 baseline JSON 이 실제로 write 됐고(디스크 `fs.existsSync(path)` true), 내용을 `parseBaselineReport(read)` 로 로드하면 candidate 와 round-trip 동치임을 assert.
  2. **2회차(compared)** — 같은 baseDir 에 1회차가 확정한 baseline 이 있으므로 재호출 반환이 `{ outcome: "compared", comparison, report }`. `comparison.regressed` 가 노출되고 함수는 throw 하지 않음을 assert. 동일 응답 특성(즉시 200 상수 반환)이라 tolerance 기본치에서 회귀 없음(`regressed=false`)이 기본 경로.
- **관찰·리포트 전용 — expect 는 spec 책임** — `measureAndConfirmBaseline` 자체는 회귀/임계를 throw 하지 않고 `ConfirmOrCompareResult` 판별 union 만 반환한다. S2 pass/fail·회귀 강제는 본 spec 의 `expect` 가 반환 union 을 검사해 수행한다(harness 함수는 관찰만). 임계 위반(예: `opts.measure.thresholds.p95MaxMs` 를 극단으로 낮춰 pass=false)이어도 established write 는 수행되고 pass=false candidate 가 파일에 저장됨을 negative 로 확인.
- **결정론 전략** — 실 latency 표본은 wall-clock 이라 값 자체는 비결정적이지만, `getStatus()` 상수 동기 반환은 즉시 반환하므로 p95 는 항상 임계(3000ms) 훨씬 아래 → 기본 established/compared 경로는 결정론적으로 도달한다. 실패(non-2xx) 분기는 요청 wrapper 레벨에서 인위 non-2xx status 를 주입(`async () => ({ status: 503 })`)해 `measureAndConfirmBaseline` 이 errorRate 위반 candidate 를 established write 하는(throw 없이) 경로를 커버한다.
- **재구현·서명 변경 0 (DRY)** — measure·확정·비교 로직은 전적으로 `measureAndConfirmBaseline`(→ `measureBaselineCandidate` + `confirmOrCompareBaseline`)에 위임한다. 본 spec 은 실 app 부트스트랩 + 임시 baseDir 격리 + loop 호출 + `expect` 검사만 책임진다. collector/io/baseline 모듈 파일은 **수정하지 않는다**(import·호출만).
- **신규 dependency 0** — 기존 `@nestjs/testing`·`supertest`(devDependency)·builtin `fs`/`os`/`path` + 기존 collector/io 함수만 사용. 새 외부 dep 추가 없음.

## Required Reading

- `test/perf/app-root-read.perf-spec.ts` — 재사용할 부트스트랩·요청 wrapper 관용구의 직접 선례: `Test.createTestingModule({ controllers: [AppController], providers: [{ provide: AppService, useValue: service }] })` → `createNestApplication` → `app.init()`(beforeAll)·`app.close()`(afterAll), guard 미적용이라 `overrideGuard` 불요, `service.getStatus.mockReturnValue("Assessment-Agent")`(beforeEach), 실 요청 wrapper `async () => { const res = await request(app.getHttpServer()).get("/api"); return { status: res.status }; }`, 인위 non-2xx 주입 wrapper `injectStatus(status)`. 본 task 는 이 부트스트랩·wrapper 를 그대로 가져와 `collectLatencySamples`/`assertS2Threshold` 개별 배선 대신 **`measureAndConfirmBaseline` top loop + 임시 baseDir fs round-trip** 으로 대체한다.
- `test/perf/latency-collector.ts` — `measureAndConfirmBaseline(request, env, baseDir, opts?)`(380행~ — `measureBaselineCandidate` → `confirmOrCompareBaseline` 조립, `Promise<ConfirmOrCompareResult>` 반환, `opts.measure`/`opts.compare` 옵션 분배, 하위 예외 그대로 전파)·`MeasureAndConfirmOpts`(329행 JSDoc 근처)·`MeasureBaselineOpts`(`iterations`/`thresholds`/`now`)·`RequestFn` 계약. 본 spec 은 이를 **import·호출만** 하고 collector 모듈을 수정하지 않는다.
- `test/perf/latency-baseline-io.ts` — `ConfirmOrCompareResult` 판별 union(`"established"`+`path` | `"compared"`+`comparison`/`report`) 형태(반환 검사용). 수정하지 않는다(import 만).
- `test/perf/latency-baseline.ts` — `BaselineEnvMeta`(env 구성용)·`BaselineReport`·`BaselineComparison`·`parseBaselineReport`(established 분기에서 write 된 파일 내용을 로드·round-trip 검증할 때 사용). 수정하지 않는다(import 만).
- `test/perf/latency-baseline-io.spec.ts` — `confirmOrCompareBaseline`/`readCompareBaselineFile`/`writeBaselineFile` 의 colocated spec 의 **임시 디렉토리 격리 관용구**(`fs.mkdtemp`/`os.tmpdir` 기반 unique baseDir 생성 + afterEach `fs.rm` 정리, established/compared 양분기 검증). 본 spec 의 baseDir 격리를 이 관용구를 참고해 구현한다(실 repo 파일 미오염).
- `src/app.controller.ts` + `src/app.service.ts` — `GET /api` → `getRoot()` → `appService.getStatus()`(동기 상수 `APP_STATUS_MESSAGE` 200 반환, 예외 경로 없음) 배선 확인. 본 spec 은 controller/service 로직을 검증하지 않고(app.controller.spec.ts 소관) 200 정상 경로만 배선한다.
- `docs/ops/load-resilience-test-plan.md` §5 #2(S2 조회 latency 경량 harness, 129행) + §4.1(supertest 기반 반복 호출 measure — 단일-클라이언트 스모크, 부하 발생기 아님, 100행~) + §5 #4/#5(CI job 편입·baseline 체크인은 별도 slice — Out of Scope 근거) — 본 spec 이 §5 #2 "실 supertest measure harness" 의 첫 fs+HTTP 통합 조각임.
- `test/perf/README.md` §"표본 수집기 (`latency-collector.ts`)" 절 `measureAndConfirmBaseline`(81행~) 항목 — 실 supertest 배선 perf-spec(`app-root-measure-confirm.perf-spec.ts`)이 그 top loop 를 실 HTTP 요청·실 fs baseline round-trip 에 태운 첫 통합 spec 임을 cross-reference 로 추가할 위치. README 의 perf-spec 목록/개수 서술(30 → 31)이 있으면 함께 갱신.

## Acceptance Criteria

- [ ] `test/perf/app-root-measure-confirm.perf-spec.ts` 신설 — 기존 `app-root-read.perf-spec.ts` 부트스트랩 관용구(`AppController` + `AppService` mock, guard 미적용, `app.init()`/`app.close()`)를 재사용하고, 실 요청 함수 `() => request(app.getHttpServer()).get("/api")` 를 `measureAndConfirmBaseline(request, env, tmpBaseDir, { measure: { iterations: N } })` 에 태운다. baseDir 는 `fs.mkdtemp` 기반 임시 디렉토리(beforeEach 생성 + afterEach `fs.rm(recursive)` 정리). measure·확정·비교 로직 재구현 금지(전적 위임 DRY), collector/io/baseline 모듈 파일 수정 0, 신규 외부 dep 0. `jest-perf.json` `testRegex` 에 매칭돼 `pnpm test:perf` 로 실행됨.
- [ ] Happy-path unit test 1+ — (a) **established 분기**: 빈 임시 baseDir 에서 첫 호출 시 반환이 `{ outcome: "established", path }` 이고, `path` 에 baseline JSON 이 실제 write 됨(`fs.existsSync(path)` true, `parseBaselineReport(fs.readFileSync(path))` 가 candidate 와 round-trip 동치)을 assert. (b) **compared 분기**: 같은 baseDir 에 baseline 이 있는 상태(1회차 established 후)에서 재호출 시 반환이 `{ outcome: "compared", comparison, report }` 이고, 동일 endpoint 특성상 기본 tolerance 에서 `comparison.regressed === false`(회귀 없음)임을 assert. 두 경우 모두 실 `GET /api` 200 응답이 measure 에 반영됨(errorRate 0, count>0)을 검증.
- [ ] Error path unit test 1+ — 각 예외가 부작용 없이 그대로 전파됨을 검증(각 1+): (1) `request` 가 함수 아님(예: `null`) → `measureAndConfirmBaseline` 경유 `TypeError` 전파(파일 미생성), (2) `opts.measure.iterations` 음수·NaN → `RangeError` 전파, (3) `env` 형태 불량(예: `env.label` 빈 문자열) → `TypeError`/`RangeError` 전파, (4) `baseDir` 빈/공백-only 또는 non-string → `RangeError`/`TypeError` 전파, (5) compared 분기에서 저장 파일 내용이 유효 JSON 아님(사전 손상 fixture write 후 재호출) → `SyntaxError` 전파.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) baseline **부재** → established 분기(실 fs write 발생) vs (2) baseline **존재** → compared 분기(write 없이 실 fs read·compare), (3) `opts.measure.iterations` 지정 시 실 요청 횟수가 그 값과 일치함(예: iterations=3 → `GET /api` 3회 도달, 요청 wrapper 호출 카운터나 mock `getStatus` 호출 횟수로 검증), (4) `opts.compare` tolerance 를 좁혀 compared 분기에서 `comparison.regressed === true` 를 유도(예: baseline write 후 요청 wrapper 를 인위로 느리게/다르게 만들거나 tolerance 를 극단으로 좁힘)하는 회귀-검출 경로 vs 기본 tolerance 무회귀 경로. established/compared·measure 위임·compare 위임 경로를 describe/it 로 분리 명시.
- [ ] Negative cases 충분 cover — 각 1+ test: (a) `opts` 미지정(`undefined`) → 기본 iterations 30·기본 compare tolerance 로 established/compared 정상 동작(단 CI 소요 억제 위해 happy/branch test 는 낮은 iterations 사용, 본 negative 는 기본치 경로 도달만 얇게 검증), (b) 요청 wrapper 가 인위 non-2xx(503)를 반환 → established 분기에서 errorRate 위반(pass=false) candidate 가 **throw 없이** 실 파일에 write 됨(관찰 전용 — 반환은 established, 파일 존재)을 assert, (c) compared 분기 회귀(tolerance 좁힘)가 `comparison.regressed === true` 로만 노출되고 함수는 throw 하지 않음을 assert, (d) measure 가 reject(요청 wrapper 가 throw)하면 confirm 미도달로 임시 baseDir 에 파일이 생성되지 않음(부작용 0)을 assert. afterEach 가 임시 baseDir 를 정리해 spec 간 격리·실 repo 미오염을 보장함도 확인.
- [ ] `test/perf/README.md` 갱신 — `measureAndConfirmBaseline` 항목(또는 perf-spec 목록)에 실 supertest 배선 perf-spec(`app-root-measure-confirm.perf-spec.ts`)이 그 top loop 를 실 `GET /api` HTTP 요청·임시 baseDir fs baseline round-trip 에 태운 **첫 fs+HTTP 통합 perf-spec**(established+compared 양분기 실 실행)임을 1~3줄 추가. perf-spec 개수 서술이 있으면 30→31 갱신. §5 #4(CI job)·#5(실 baseline 체크인)은 별도 slice 임을 명시.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 spec 은 perf-spec 이라 `pnpm test` 커버리지 집계에는 미포함될 수 있으나, collector/io 함수 커버리지 무회귀(≥80/80)를 확인. `pnpm test:perf` 로 본 spec 이 실행·pass 됨을 확인.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- 다른 endpoint(person/group/assessment 등 30 read 또는 write route POST/PATCH/DELETE)를 `measureAndConfirmBaseline` 에 배선 — 본 task 는 floor case `GET /api` health-read 1개만 태운 **첫 통합 배선**이며, 다른 endpoint 배선·write route perf 는 별도 follow-up.
- CI job 편입(부하 harness workflow §5 #4) — `.github/workflows/` 변경 금지. 본 spec 은 `pnpm test:perf` 로만 실행되고 상시 PR CI job 편입은 별도 slice.
- 실 baseline JSON 을 repo 에 확정·체크인(§5 #5) — 본 spec 은 **임시 디렉토리에서만** write 하고 afterEach 로 정리한다. repo 에 baseline 파일을 남기지 않는다.
- 실 Postgres round-trip·실 LLM/외부 I/O 실측 — `AppService` 는 mock(`useValue`), `getStatus` 는 mockReturnValue 로 고정 상수 반환. 본 spec 은 controller↔service↔harness↔fs 배선만 측정하고 실 DB·외부 의존을 태우지 않는다.
- `measureAndConfirmBaseline`/`measureBaselineCandidate`/`confirmOrCompareBaseline`/`collectLatencySamples`/`assertS2Threshold`/`buildBaselineReport`/io·baseline 모듈 함수 재수정·서명 변경 — 이미 main 안착. 본 task 는 perf-spec 파일 1개만 신설하고 기존 함수는 import·호출·spec 재료로만 재사용(collector/io/baseline `.ts` 파일 수정 0).
- measure·확정·비교·write·로드·round-trip 로직 재구현 금지 — 전적으로 `measureAndConfirmBaseline` 위임(DRY). 본 spec 은 실 app 부트스트랩 + 임시 baseDir 격리 + loop 호출 + `expect` 검사만 책임진다.
- 회귀/임계를 harness 가 throw 하도록 변경 금지 — `measureAndConfirmBaseline` 은 관찰 전용으로 `ConfirmOrCompareResult` 반환만 하고, pass/fail·회귀 강제는 본 spec 의 `expect` 가 반환 union 을 검사해 수행한다.
- 병렬·동시성 request 발생 도입 금지 — 순차 measure 성격 유지(고동시성은 S3, 신규 도구 필요 — §4.2 BLOCKED).
- 신규 외부 dependency 추가 금지(기존 `@nestjs/testing`·`supertest`·builtin `fs`/`os`/`path`·collector/io 함수 + jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 후보: 다른 조회 endpoint(person/group/assessment detail 등)를 `measureAndConfirmBaseline` 에 배선한 추가 통합 perf-spec / write route(POST/PATCH/DELETE) latency 배선 / 부하 harness CI job 편입 §5 #4(`.github/workflows/` 별도 job, 정기/수동 trigger) / 실 baseline JSON 을 repo 에 확정·체크인 + §3 "baseline 후 fix" 임계 실수치 확정 §5 #5 / S1·S3 부하 harness(§5 #3, ADR-0054 owner 승인 전제 — 신규 dependency BLOCKED))
