# test/perf — S2 조회 latency 경량 harness

부하·내성 계획([load-resilience-test-plan.md](../../docs/ops/load-resilience-test-plan.md) §5 follow-up #2)의
**S2 조회 latency measure**(REQ-048, p95 < 3s)를 위한 자리다. 신규 dependency 없이 기존
`supertest` 로 진행한다(k6/artillery 등 발생기는 ADR-0054, owner 승인 후 별도 task).

## 측정 primitive (`latency-metrics.ts`)

DB·네트워크·앱 부트스트랩에 의존하지 않는 **순수 함수**(입력 배열 → 출력 수치).

- `percentile(samplesMs, p)` — p-분위수(0~100, 선형 보간).
- `summarizeLatency(samplesMs)` — `{ p50, p95, p99, count, maxMs }`(§3 임계 표 대응).
- `errorRate(total, failures)` — non-2xx/전체 비율(0~1), total=0 방어.
- `throughput(count, elapsedMs)` — 초당 요청 수(req/s, `count/(elapsedMs/1000)`), §3 throughput 관찰 지표 대응. count=0 → 0, count>0 && elapsedMs=0 → RangeError.

```ts
import { summarizeLatency, errorRate } from "./latency-metrics";
const s = summarizeLatency(samplesMs); // p95 < 3000(ms) 검증
const er = errorRate(reqs.length, fails); // er < 0.01 검증
```

`latency-metrics.spec.ts` 는 순수 unit 이라 기본 `pnpm test` 에서도 수집·검증된다.

## baseline 리포트 (`latency-baseline.ts`)

env-meta(§3 "환경 고정")를 동반해 `S2Assertion` 을 비교 가능한 리포트 레코드로 포맷하는
**순수 함수**(DB·네트워크 무의존). **관찰·리포트 전용**이라 pass/fail 판정·임계 로직은
전혀 바꾸지 않고, 지표는 assertion 에서 파생만 한다(재계산 없음).

- `BaselineEnvMeta` — 실행 환경 메타(`label`·`concurrency` 필수, `cpu?`·`memoryMb?`·`dataScale?` optional).
- `BaselineReport` — env-meta + 핵심 지표(p50/p95/p99/throughput/errorRate/count/pass) machine-readable 레코드.
- `buildBaselineReport(env, assertion)` — env-meta + `S2Assertion` 을 합쳐 리포트 조립(지표 파생, 재계산 없음).
- `formatBaselineLine(report)` — 리포트를 파싱 용이한 한 줄(key=value, NaN 은 "n/a")로 포맷.
- `compareBaselineReports(baseline, candidate, options?)` — 기준 vs 새 측정 두 `BaselineReport` 를 비교해 지표별 delta + 회귀 여부(`BaselineComparison`)를 산출(**관찰 전용** — pass/fail 임계 불변). latency(p50/p95/p99)는 허용 비율(기본 0.10) 초과 증가 시 회귀, errorRate 는 허용 절대치(기본 0.01) 초과 증가 시 회귀, throughput 은 delta 만 리포트(회귀 판정 미반영). baseline NaN(빈 표본) 지표는 판정 제외, candidate 만 NaN(측정 소실)이면 회귀 표기.
- `serializeBaselineReport(report)` — 리포트를 안정적·비교 가능한 유효 JSON 문자열로 직렬화(영속화용). NaN 지표(빈 표본)는 JSON 이 표현 못 하므로 sentinel(`"__NaN__"`)로 저장하고, optional env-meta 는 지정된 것만 보존(미지정은 키 자체 생략). 지표 재계산 없이 파생값만 전사.
- `parseBaselineReport(json)` — 위 JSON 을 파싱해 `BaselineReport` 로 복원. NaN sentinel 을 다시 NaN 으로 복원해 **round-trip 불변**(`parseBaselineReport(serializeBaselineReport(r))` ≡ `r`, NaN 포함) 보장. 잘못된 JSON 은 `SyntaxError`, 형태 불량(env 누락·지표 타입 불일치 등)은 `TypeError`(기존 `isValidReport`/`isValidEnvMeta` 가드 재사용). 실 baseline harness(§5 #5)가 저장 기준을 로드해 `compareBaselineReports` 에 먹이는 저장측 선행 slice.
- `formatComparisonReport(comparison)` — `compareBaselineReports` 가 낸 `BaselineComparison` 을 사람-친화 여러 줄 문자열로 포맷(헤더 `regressed=` + 지표별 `base/cand/delta` 줄, 회귀 지표는 `REGRESSED`). **관찰·리포트 전용**이라 재계산·재판정 없이 파생값만 전사하며, NaN 지표(빈 표본)는 "n/a" 로 방어(기존 `fmt` 재사용), delta 는 명시 부호(+/-), throughput 은 회귀 표시 없이 delta·"(관찰)" 만 렌더링. 형태 불량 입력은 `TypeError`. §5 #5 harness 가 회귀 여부를 로그·CI 로 사람에게 보여줄 때 import.
- `compareBaselineJson(baselineJson, candidateJson, options?)` — 저장된 두 baseline JSON 문자열(기준·candidate)을 받아 `parseBaselineReport`×2 → `compareBaselineReports` → `formatComparisonReport` 를 순서대로 이어붙여 `{ comparison, report }` 를 내는 **얇은 합성 순수 함수**(신규 판정·계산 0). **관찰 전용**이라 하위 primitive 를 조립만 하며, 하위 예외를 재래핑 없이 그대로 propagate(잘못된/빈 JSON → `SyntaxError`, 형태 불량 → `TypeError`, tolerance 음수·NaN → `RangeError`). 반환 `report` 는 반환 `comparison` 에서 파생돼 정합 보장. §5 #5 실 baseline harness 가 디스크에서 로드한 두 JSON 만 넘기는 **단일 진입점**으로 import.
- `resolveBaselineFilename(env)` — env-meta 의 `label` 을 소문자·영숫자/하이픈만(연속/선후행 하이픈 정리)으로 정규화해 **결정적·FS-safe** baseline JSON 파일명(디렉토리 없는 basename, 예: `baseline-ci-linux-x64.json`)을 유도하는 **순수 함수**(파일 I/O·`path` 조인 0 — 문자열 유도만). 대소문자만 다른 label 도 같은 slug 으로 수렴해 저장·조회 파일명이 일치한다. 형태 불량 env → `TypeError`, 빈/공백-only label·정규화 slug 이 비는 label → `RangeError`. 이후 disk harness(§5 #4·#5)가 파일명 결정 진입점으로 import(디렉토리 결합은 본 함수 밖 책임).
- `resolveBaselinePath(env, baseDir)` — `baseDir` 과 `resolveBaselineFilename(env)` 이 유도한 basename 을 **POSIX-결정적**(`path.posix.join` — 후행/중복 구분자 정규화, 플랫폼 무관 동일 결과)으로 결합해 baseline JSON 파일의 **전체 경로**를 내는 **순수 함수**(fs I/O·환경 read·경로 존재 검사·절대경로 강제 0). 파일명 규약은 전적으로 `resolveBaselineFilename` 에 위임하고(slug 규칙 재구현 없음) 본 함수는 디렉토리 결합만 책임진다. env 관련 예외(`TypeError`/`RangeError`)는 그대로 전파하고, `baseDir` 이 non-string → `TypeError`, 빈/공백-only → `RangeError`. disk harness(§5 #4·#5)가 저장·조회 baseline 파일 경로 결정 진입점으로 import.

### disk io harness (`latency-baseline-io.ts`)

순수 primitive 파일(`latency-baseline.ts`)을 fs 부작용으로 오염시키지 않도록 io 책임을 분리한 **첫 fs-touching 모듈**. 경로·직렬화 규칙은 재구현하지 않고 전적으로 primitive 에 위임한다(DRY).

- `writeBaselineFile(report, env, baseDir)` — `resolveBaselinePath(env, baseDir)` 로 저장 경로를 결정하고 `serializeBaselineReport(report)` 로 직렬화한 JSON 을 그 경로에 **UTF-8 로 기록**한 뒤 쓴 파일의 **전체 경로**를 반환하는 **write harness**. 상위 디렉토리가 없으면 `fs.mkdirSync(dir, { recursive: true })` 로 다중 depth 까지 재귀 생성한다(이미 있으면 no-op). 경로 결정·직렬화(순수, 예외 시 fs 접근 0)를 fs 접근 **전에** 완료하므로 primitive 예외(`TypeError`/`RangeError`)는 부작용 없이 그대로 전파된다. 기존 동기 스타일과 통일해 `*Sync` API 만 쓴다(async 미도입, 결정성 유지). read 방향은 아래 `readBaselineFile` 로 구현됨.
- `readBaselineFile(env, baseDir)` — `resolveBaselinePath(env, baseDir)` 로 읽을 경로를 결정하고 그 파일을 **UTF-8 로 읽어**(`fs.readFileSync`) `parseBaselineReport(json)` 로 복원한 `BaselineReport` 를 반환하는 **read harness**(`writeBaselineFile` 의 **대칭 read 방향**). 경로 결정(순수, 예외 시 fs 접근 0)을 fs 접근 **전에** 완료하므로 primitive 예외(`TypeError`/`RangeError`)는 부작용 없이 전파되고, 파일 부재 등 fs 오류(`ENOENT` 계열)는 친절히 래핑하지 않고 **그대로 전파**하며(계약 최소화), 내용 불량은 `parseBaselineReport` 의 `SyntaxError`/`TypeError` 를 전파한다. 같은 (`env`, `baseDir`)로 `writeBaselineFile` 가 쓴 파일을 정확히 읽어 원본과 동치(round-trip, NaN 지표 포함)를 복원한다(두 함수가 동일 경로 규약 공유). 경로·역직렬화 규칙 재구현 없이 primitive 위임(DRY), 동기 `*Sync` API 통일.
- `readCompareBaselineFile(env, baseDir, candidate, options?)` — 디스크에 확정 저장된 **기준 baseline** 을 `readBaselineFile(env, baseDir)` 로 로드해 in-memory **candidate**(`BaselineReport`)와 `compareBaselineReports` → `formatComparisonReport` 로 비교·포맷해 `{ comparison, report }` 를 내는 **compose harness**(신규 판정·계산 0 — read→compare→format 얇은 조립만). `compareBaselineJson`(in-memory JSON 2개) 의 **disk-input 짝**으로, 기준만 디스크에서 로드하고 candidate 는 in-memory 로 받는다. 로드→비교 **순서 계약**(`readBaselineFile` throw 시 비교·포맷 미도달)을 지키며, 하위 예외를 재래핑 없이 **그대로 전파**한다(env/baseDir 형태·빈값 → `TypeError`/`RangeError`, 기준 파일 부재 → `ENOENT` 계열, 내용 불량 → `SyntaxError`/`TypeError`, candidate 형태 불량 → `TypeError`, tolerance 음수·NaN → `RangeError`). **관찰·리포트 전용**(S2 pass/fail 임계 불변, 신규 dep 0), 동기 `*Sync` 통일. §5 #5 실 baseline harness 가 import 할 최종 조립 진입점.
- `compareBaselineFiles(baselineEnv, baselineDir, candidateEnv, candidateDir, options?)` — 확정 저장된 **기준 baseline** 과 별도 저장된 **candidate baseline** 을 **둘 다 디스크에서 로드**해(`readBaselineFile`×2 → `compareBaselineReports` → `formatComparisonReport`) `{ comparison, report }` 를 내는 **both-disk compose harness**(신규 판정·계산 0 — read×2→compare→format 얇은 조립만). `compareBaselineJson`(in-memory JSON 2개)의 **both-disk 짝**이자 `readCompareBaselineFile`(기준만 disk)의 **file-input 변형**으로, 기준·candidate 를 서로 다른 (env, dir)로 받아(이전 run vs 새 run 등) 각각 로드한다. **기준 먼저 로드 순서 계약**(기준 로드 throw 시 candidate 로드·비교·포맷 미도달, candidate 로드 throw 시 비교·포맷 미도달)을 지키며, 하위 예외를 재래핑 없이 **그대로 전파**한다(env/dir 형태·빈값 → `TypeError`/`RangeError`, 파일 부재 → `ENOENT` 계열, 내용 불량 → `SyntaxError`/`TypeError`, tolerance 음수·NaN → `RangeError`). 두 경로가 같아도 정상 동작(자기 비교 → 회귀 0). **관찰·리포트 전용**(S2 pass/fail 임계 불변, 신규 dep 0), 동기 `*Sync` 통일. 이로써 compose 진입점이 both-JSON / 기준-only-disk / both-disk 3 종으로 완성된다.
- `baselineFileExists(env, baseDir)` — `resolveBaselinePath(env, baseDir)` 로 경로를 결정한 뒤 `fs.existsSync(path)` 로 baseline 파일의 존재 여부를 **boolean 으로 반환**하는 **predicate**(경로 결정 → `existsSync` 얇은 조립, 신규 판정·계산 0). 경로/파일명 규약은 전적으로 `resolveBaselinePath` 에 위임(재구현 금지 — DRY)하며 `writeBaselineFile`/`readBaselineFile` 와 **동일 경로 규약을 공유**해 "쓴 파일은 존재(true), 안 쓴 파일은 부재(false)"로 판정한다(round-trip 정합). 경로 결정 단계 예외(env 형태 불량 `TypeError`, `env.label`/slug 무효·`baseDir` 빈/공백-only `RangeError`)는 `existsSync` **전에** 부작용 없이 **그대로 전파**하고(순서 계약), 상위 디렉토리·다중 depth 경로 부재는 예외가 아닌 `false` 로 흡수한다(`existsSync` 본래 계약). **관찰 전용**(read-only 조회, S2 임계 불변, 신규 dep 0), 동기 `*Sync` 통일. §5 #5 confirm-or-compare 오케스트레이션(파일 부재 시 최초 확정 write / 존재 시 로드·비교)의 **선행 precondition**.
- `confirmOrCompareBaseline(env, baseDir, candidate, options?)` — `baselineFileExists(env, baseDir)` 로 기준 baseline 존재를 판정해 **부재면** `writeBaselineFile(candidate, env, baseDir)` 로 최초 확정 write 하고 `{ outcome: "established", path }` 를, **존재면** `readCompareBaselineFile(env, baseDir, candidate, options)` 로 로드·비교하고 `{ outcome: "compared", comparison, report }` 를 내는 **confirm-or-compare 오케스트레이션**(predicate → 분기 → (write | readCompare) 얇은 조립, 신규 판정·계산 0). 반환은 두 국면을 구별하는 **판별 union**(`ConfirmOrCompareResult` — `"established"`+`path` | `"compared"`+`comparison`/`report`)이라 호출측이 "이번이 최초 확정이었나, 비교였나"를 결정적으로 분기할 수 있다. 존재 판정·write·compare 로직은 전적으로 `baselineFileExists`/`writeBaselineFile`/`readCompareBaselineFile` 에 위임(재구현 금지 — DRY)한다. **존재 판정을 write/compare 전에 완료하는 순서 계약**(`baselineFileExists` throw 시 write·compare 미도달)을 지키며, 하위 예외를 재래핑 없이 **그대로 전파**한다(env/baseDir 형태·빈값 → `TypeError`/`RangeError`, 존재 분기 파일 부재 → `ENOENT` 계열·내용 불량 → `SyntaxError`/`TypeError`·tolerance 음수·NaN → `RangeError`). **관찰·리포트 전용** — 회귀는 `comparison.regressed` 로 노출만 하고 **throw 하지 않는다**(S2 pass/fail 임계 불변, 신규 dep 0), 동기 `*Sync` 통일. §5 #5 실 baseline harness 의 진입점(measure→confirmOrCompare 한 줄로 baseline 확정/회귀탐지 양쪽 흡수).

실 baseline 실측 harness(§5 follow-up #5)는 이 primitive 를 import 만 하면 된다.
`latency-baseline.spec.ts` 는 순수 unit 이라 기본 `pnpm test` 에서 수집·검증된다.

## 표본 수집기 (`latency-collector.ts`)

요청 함수를 주입받아 반복 호출하며 latency 표본을 모으고 S2 임계를 판정하는 순수
orchestration 로직(DB·네트워크 무의존, clock 주입으로 결정론적).

- `collectLatencySamples(request, iterations, opts?)` → `{ samplesMs, total, failures, elapsedMs }`.
  `request: () => Promise<{ ok?: boolean; status?: number }>`, `opts.now?` 로 clock 주입.
  `elapsedMs` 는 첫 요청 시작~마지막 요청 종료의 총 wall-clock 경과(monotonic clock, iterations=0 이면 0).
- `assertS2Threshold(result, thresholds?)` → `{ pass, summary, errorRate, throughput, reasons }`.
  기본 임계 p95 < 3000ms(REQ-048) / errorRate < 0.01(§3), 위반 사유는 `reasons` 축적.
  `throughput`(req/s)은 `throughput(summary.count, result.elapsedMs)`(T-0860 primitive)로 산출한
  **§3 관찰 지표**다 — pass/fail 판정에는 넣지 않으며(관찰 전용), 성공 표본 0 이면 0 으로 방어된다.
- `measureBaselineCandidate(request, env, opts?)` → `Promise<BaselineReport>`. `collectLatencySamples`
  → `assertS2Threshold` → `buildBaselineReport` 를 순서대로 이어붙여 candidate `BaselineReport` 를
  생산하는 **조립 harness**(신규 판정·계산 0 — collect→assert→build 얇은 조립만). `opts.iterations`
  기본 **30**(단일-클라이언트 경량 스모크 — §4.1 부하 발생기 아님), `opts.thresholds`/`opts.now` 는
  미지정 시 하위 primitive 기본치로 위임한다. 수집·임계 판정·candidate 조립 로직은 전적으로
  `collectLatencySamples`/`assertS2Threshold`/`buildBaselineReport` 에 위임(재구현 금지 — DRY)한다.
  **순서 계약**(collect(async I/O)→assert(순수 판정)→build(순수 조립); collect throw 시 assert·build
  미도달)을 지키며, 하위 예외를 재래핑 없이 **그대로 전파**한다(`request` 비함수 → `TypeError`,
  `iterations`/비단조 clock → `RangeError`, `thresholds` 음수·NaN → `RangeError`, `env` 형태·label·
  concurrency 불량 → `TypeError`/`RangeError`). **관찰·리포트 전용** — 임계 위반은 candidate.pass 로
  노출만 하고 **throw 하지 않는다**(임계 강제는 호출측 expect·별도 assertS2Threshold 책임). `disk io
harness` §의 `confirmOrCompareBaseline`(T-0874)이 **소비**하는 candidate 를 **생산**하는 짝이며,
  §5 #2 경량 measure 진입점이다(실 supertest request 배선은 호출측 책임 — Out of Scope). 신규 dep 0.
- `measureAndConfirmBaseline(request, env, baseDir, opts?)` → `Promise<ConfirmOrCompareResult>`.
  `measureBaselineCandidate`(candidate 생산, async I/O) → `confirmOrCompareBaseline`(기준 부재면
  최초 확정 write / 존재면 로드·비교)을 이어붙인 **measure→confirm-or-compare end-to-end loop
  harness**(신규 판정·계산·io 0 — 조립만). candidate 를 **생산**하는 `measureBaselineCandidate` 와
  **소비**하는 `confirmOrCompareBaseline` 두 짝을 이어붙인 **top-of-pyramid 진입점**이라, §5 #5 실
  supertest harness 는 `await measureAndConfirmBaseline(() => request(app).get(...), env, baseDir)`
  **한 줄**로 baseline 확정/회귀탐지 loop 를 완성한다. `opts.measure`(iterations/thresholds/now)는
  `measureBaselineCandidate` 로, `opts.compare`(회귀 tolerance)는 존재 분기 비교로 **옵션 분배**하며,
  측정·확정·비교 로직은 전적으로 두 하위 harness 에 위임한다(재구현 금지 — DRY). **순서 계약**
  (measure(async I/O) reject 시 confirmOrCompare 미도달 — candidate 미생산 시 write·compare 부작용 0)
  을 지키며 하위 예외를 재래핑 없이 그대로 전파한다(request 비함수·env 형태 → `TypeError`,
  iterations/clock/thresholds/label/concurrency 무효 → `RangeError`; baseDir non-string → `TypeError`,
  빈/공백 → `RangeError`, 존재 분기 파일부재 → `ENOENT` 계열·내용불량 → `SyntaxError`/`TypeError`·
  tolerance 무효 → `RangeError`). **관찰·리포트 전용** — 회귀는 `comparison.regressed`(존재 분기)로
  노출만 하고 **throw 하지 않는다**(회귀 강제는 호출측 책임). import 방향 collector→io(순환 없음),
  신규 dep 0. **실 supertest 배선**은 `app-root-measure-confirm.perf-spec.ts`(T-0877, §5 #2)가
  담당한다 — 이 spec 이 본 top loop 를 실 `GET /api` HTTP 요청·임시 baseDir fs baseline
  round-trip 에 태운 **첫 fs+HTTP 통합 perf-spec**(established 최초 확정 write + compared 로드·
  비교 양분기 실 실행)이다. CI job 편입(§5 #4)·실 baseline JSON repo 체크인(§5 #5)은 별도 slice.

```ts
import { collectLatencySamples, assertS2Threshold } from "./latency-collector";
// 후속 *.perf-spec.ts 에서 supertest 호출 함수를 주입:
const r = await collectLatencySamples(() => request(app).get("/summary"), 30);
expect(assertS2Threshold(r).pass).toBe(true);
```

## 실 endpoint 배선 perf-spec (`summary-read` / `assessment-read` / `contribution-read` / `person-read` / `group-read` / `part-read` / `user-read` / `permission-denied-read` / `llm-provider-config-read` / `difficulty-mapping-read` / `cron-schedule-read` / `export-running-read` / `import-running-read` / `auth-me-read` / `summary-detail-read` / `group-detail-read` / `assessment-detail-read` / `person-detail-read` / `part-detail-read` / `contribution-detail-read` / `user-detail-read` / `llm-provider-config-detail-read` / `export-detail-read` / `import-detail-read` / `group-persons-read` / `part-persons-read` / `export-status-view-read` / `import-modes-read` / `export-download-read` / `app-root-read`)

collector(`collectLatencySamples`)를 **실제 조회 endpoint** 에 배선하는 실 perf-spec 은 현재
서른 개다. 서른 다 `Test.createTestingModule` 로 대상 controller + **mocked service** 를
부트스트랩하고, `collectLatencySamples(() => request(app.getHttpServer()).get(...), N)` 로 반복
호출해 표본을 수집하고 `assertS2Threshold(result).pass` 를 검증한다. 이 서른에 더해, top loop
`measureAndConfirmBaseline` 을 실 `GET /api` 요청·임시 baseDir fs baseline round-trip 에 태운
**서른한 번째** perf-spec `app-root-measure-confirm.perf-spec.ts`(T-0877)가 있다 — 이는
collector 개별 배선이 아니라 measure→(최초 확정 write | 로드·비교) 전체 loop 를 실 fs 위에서
실증하는 **첫 fs+HTTP 통합 perf-spec** 이라 아래 서른-배치와 별개 종류로 분류한다(§5 #2). `summary-read`·
`user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·
`cron-schedule-read`·`export-running-read`·`import-running-read` 는 `JwtAuthGuard`/
`RolesGuard` 두 가드가 부착된 controller 라 둘 다
`overrideGuard(...).useValue({ canActivate: () => true })`
로 통과시키고, `auth-me-read` 는 `JwtAuthGuard` **만** 부착이라 그 하나만 override 하되
`canActivate` 가 `req.user = { sub }` 를 박제해야 me 핸들러가 sub 분기(200/404)에
도달한다(RolesGuard override 불요). `person-read`·`group-read`·`part-read` 는 guard
미적용 controller 라 override 가 불요하다. harness 가 단일 controller 에 국한되지 않고
요약·평가·기여·인원·그룹·파트·사용자·권한거부·LLM설정·난이도매핑·cron스케줄·export러닝·import러닝·auth-me·요약상세(:id)·그룹상세(:id)·평가상세(:id)·인원상세(:id)·파트상세(:id)·기여상세(:id)·사용자상세(:id)·LLM설정상세(:id)·export상세(:id)·import상세(:id)·그룹인원(:id/persons)·파트인원(:id/persons)·export진행뷰(:id/status-view)·import모드(/modes)·export다운로드(:id/download)·app-root(/api health)
30 read 경로 전반에 재사용됨을 실증한다(list/query/self-read 14 + 단건 detail(:id) 10 + sub-resource(:id/persons) read 2 + derived-detail(:id/status-view) read 1 + derived-list(/modes) read 1 + artifact-stream(:id/download) read 1 + health-read(/api) 1).

- `summary-read.perf-spec.ts` (T-0830) — `SummaryController` + mocked `SummaryService`,
  `GET /api/summaries?personId=...` 배선. 첫 실 perf-spec.
- `assessment-read.perf-spec.ts` (T-0831) — `AssessmentController` + mocked
  `AssessmentService`, `GET /api/assessments?personId=&period=`(REQ-038 시계열 조회) 배선.
  두 번째 배선 spec. 이 endpoint 는 `personId` query 누락 시 controller 가
  `BadRequestException`(400) 을 강제하는 고유 분기가 있어, collector 가 non-2xx(400) 도
  `failures` 로 정확히 분류하는지 추가 검증한다.
- `contribution-read.perf-spec.ts` (T-0832) — `ContributionController` + mocked
  `ContributionService`, `GET /api/contributions?assessmentId=...`(REQ-033 aggregate-level
  기여 조회) 배선. 세 번째 배선 spec. 이 endpoint 도 `assessmentId` query 누락/빈 string
  시 controller 가 `BadRequestException`(400) 을 강제하는 분기가 있어, collector 의
  non-2xx(400) 분류 검증을 이어간다.
- `person-read.perf-spec.ts` (T-0833) — `PersonController` + mocked `PersonService`,
  `GET /api/persons`(REQ-048 active 인원 목록 조회) 배선. 네 번째 배선 spec. 이
  controller 는 guard 미적용이라 `overrideGuard` 가 불요하며, query-param 400 분기가
  없어 non-2xx 분류 실증은 `GET /api/persons/:id` 의 404(mocked `findById` 이
  `NotFoundException` throw) 분기로 이어간다.
- `group-read.perf-spec.ts` (T-0834) — `GroupController` + mocked `GroupService`,
  `GET /api/groups`(REQ-048 Group 목록 조회) 배선. 다섯 번째 배선 spec. 이 controller 도
  guard 미적용이라 `overrideGuard` 가 불요하며(person-read 와 동일), query-param 400
  분기가 없어 non-2xx 분류 실증은 `GET /api/groups/:id` 의 404(mocked `findById` 이
  `NotFoundException` throw) 분기로 이어간다.
- `part-read.perf-spec.ts` (T-0835) — `PartController` + mocked `PartService`,
  `GET /api/parts`(REQ-048 Part 목록 조회) 배선. 여섯 번째 배선 spec. 이 controller 도
  guard 미적용이라 `overrideGuard` 가 불요하며(person-read·group-read 와 동일),
  query-param 400 분기가 없어 non-2xx 분류 실증은 `GET /api/parts/:id` 의 404(mocked
  `findById` 이 `NotFoundException` throw) 분기로 이어간다.
- `user-read.perf-spec.ts` (T-0836) — `UserController` + mocked `UserService`,
  `GET /api/users`(REQ-048 사용자 목록 조회) 배선. 일곱 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 첫 list
  조회** 라 `summary-read` 처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 가드를 무력화한다. non-2xx 분류 실증은 `GET /api/users/:id` 의 404(mocked `findById`
  이 `NotFoundException` throw) 분기로 커버하되, `detail` 핸들러가 self-vs-admin 분기에서
  `@CurrentUser() actor` 를 읽으므로 JwtAuthGuard override 의 `canActivate` 가 `req.user`
  를 Admin payload 로 박제해 `findById` 에 결정론적으로 도달시킨다.
- `permission-denied-read.perf-spec.ts` (T-0837) — `PermissionDeniedRecordController` +
  mocked `PermissionDeniedRecordService`, `GET /api/permission-denied-records`(REQ-033
  권한 거부 audit 조회) 배선. 여덟 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 로 **가드가 부착된 audit
  조회** 라 `user-read` 처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 가드를 무력화한다. 또한 `instanceRef`/`provider`/`httpStatus` **query param 필터
  분기**(`parseHttpStatus` 숫자 변환 포함)를 가지므로, negative case (b) 로
  `?provider=github&httpStatus=403` query param 이 붙은 경로도 harness 가 latency 를
  정상 수집함을 실증한다. non-2xx 분류 실증은 mocked `list` 가 예외를 던져 endpoint 가
  500 을 반환하는 error path 로 커버한다(list 는 actor 를 mocked service 로만 forward
  하므로 req.user 박제 불요 — canActivate true 만으로 충분).
- `llm-provider-config-read.perf-spec.ts` (T-0838) — `LlmProviderConfigController` +
  mocked `LlmProviderConfigService`, `GET /api/llm/providers`(REQ-096 Admin 가시성 /
  REQ-048 조회 back) 배선. 아홉 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 Admin
  list read** 라 `user-read`·`permission-denied-read` 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  `findAll` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked
  `findAll()` 를 raw forward(apiKey 제거 view 배열 반환, controller 자체 분기 없음)하므로
  req.user 박제가 불요하다(canActivate true 만으로 충분). negative case 로 빈 배열(등록
  0)·다건 배열도 harness 가 정상 수집함을 실증한다. non-2xx 분류 실증은 mocked `findAll`
  이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `difficulty-mapping-read.perf-spec.ts` (T-0839) — `DifficultyMappingController` +
  mocked `DifficultyMappingService`, `GET /api/llm/difficulty-mappings`(findAll →
  `findAllMappings` — 3 고정 슬롯(easy/medium/hard) 난이도↔model 매핑 목록 조회,
  REQ-096 Admin 가시성 / REQ-048 조회 back) 배선. 열 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 Admin
  list read** 라 `user-read`·`permission-denied-read`·`llm-provider-config-read` 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  `findAll` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked
  `findAllMappings()` 를 raw forward(repository.findMany 순서 그대로 반환, controller
  자체 분기 없음)하므로 req.user 박제가 불요하다(canActivate true 만으로 충분).
  negative case 로 빈 배열(슬롯 seed 전)·3 슬롯 배열도 harness 가 정상 수집함을 실증한다.
  non-2xx 분류 실증은 mocked `findAllMappings` 이 예외를 던져 endpoint 가 500 을
  반환하는 error path 로 커버한다.
- `cron-schedule-read.perf-spec.ts` (T-0840) — `CronScheduleController` + mocked
  `CronScheduleService`, `GET /api/schedules`(list → `service.list()` — 현재 등록된
  cron job 이름 `string[]` 조회, REQ-096 Admin 가시성 / REQ-048 조회 back) 배선.
  열한 번째 배선 spec. 이 endpoint 는 `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("Admin")` 로 **가드가 부착된 Admin list read** 라
  `user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`
  처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  또한 controller 가 `@Inject(CRON_TICK_HANDLER)` 로 `CronTickHandler` 를 함께
  주입받으므로, 테스트 모듈은 `CronScheduleService` mock 과 더불어 `CRON_TICK_HANDLER`
  **no-op `useValue` provider**(list 경로 미호출)도 제공해야 부트스트랩이 성립한다.
  `list` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked `list()` 를
  raw forward(등록 job 이름 순서 그대로 반환, 빈 배열도 404 변환 없음, controller 자체
  분기 없음)하므로 req.user 박제가 불요하다(canActivate true 만으로 충분). negative
  case 로 빈 배열(등록 0)·다건 배열도 harness 가 정상 수집함을 실증한다. non-2xx 분류
  실증은 mocked `list` 이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `export-running-read.perf-spec.ts` (T-0841) — `ExportController` + mocked
  `ExportJobService`, `GET /api/admin/export/running`(findRunning →
  `service.findRunning()` — status=RUNNING 인 ExportJob 목록 조회, UC-07 §8 status
  polling / REQ-030 Export / REQ-045 Admin 전용 / REQ-048 조회 back) 배선. 열두 번째
  배선 spec. 이 endpoint 는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`
  로 **가드가 부착된 Admin list read** 라
  `user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·`cron-schedule-read`
  처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  단 cron-schedule 과 달리 `ExportController` 생성자는 `ExportJobService` 하나만
  주입받아 부가 provider 가 **불요**하다(더 단순). `findRunning` 핸들러는 query param
  도 `@CurrentUser()` actor 도 읽지 않고 mocked `findRunning()` 를 raw forward(RUNNING
  job 배열 순서 그대로 반환, 빈 배열도 404 변환 없음, controller 자체 분기 없음)하므로
  req.user 박제가 불요하다(canActivate true 만으로 충분). negative case 로 빈 배열(진행
  중 0)·다건 배열도 harness 가 정상 수집함을 실증한다. non-2xx 분류 실증은 mocked
  `findRunning` 이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `import-running-read.perf-spec.ts` (T-0842) — `ImportController` + mocked
  `ImportJobService`, `GET /api/admin/import/running`(findRunning →
  `service.findRunning()` — status=RUNNING 인 ImportJob 목록 조회, UC-07 §8 status
  polling / REQ-030 Import / REQ-045 Admin 전용 / REQ-048 조회 back) 배선. 열세 번째
  배선 spec. export-running(T-0841)과 export↔import counterpart 로 대칭이다. 이
  endpoint 는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가
  부착된 Admin list read** 라
  `user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·`cron-schedule-read`·`export-running-read`
  처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  export 와 동형으로 `ImportController` 생성자는 `ImportJobService` 하나만 주입받아 부가
  provider 가 **불요**하다(cron-schedule 의 `@Inject(CRON_TICK_HANDLER)` 대비 단순).
  `findRunning` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked
  `findRunning()` 를 raw forward(RUNNING job 배열 순서 그대로 반환, 빈 배열도 404 변환
  없음, controller 자체 분기 없음)하므로 req.user 박제가 불요하다(canActivate true
  만으로 충분). negative case 로 빈 배열(진행 중 0)·다건 배열(REPLACE/MERGE 혼재)도
  harness 가 정상 수집함을 실증한다. non-2xx 분류 실증은 mocked `findRunning` 이 예외를
  던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `auth-me-read.perf-spec.ts` (T-0843) — `AuthController` + 4 mock provider(`AuthService`·
  `UserRepository`·`JwtService`·`UserService`, me 경로가 실제로 호출하는 것은
  `userService.findById` 뿐), `GET /api/auth/me`(me → `userService.findById(req.user.sub)`
  → `UserResponseDto.fromEntity` — 인증된 사용자 자기 자신 조회, ADR-0008 §6 / REQ-048
  조회 back) 배선. 열네 번째 배선 spec. 앞선 12·13 slice(Export/Import 의 Admin 가드
  부착 raw-forward list)와 달리 이 endpoint 는 (1) `@UseGuards(JwtAuthGuard)` **만**
  부착(RolesGuard 미적용)이고 (2) **controller 자체 분기가 있는** self-read 다: sub 부재
  시 401(defence in depth), `findById` 가 stale token(DB row 삭제) 시 404
  (`NotFoundException`), 정상 시 5 필드(hashedPassword 제외) 200. 따라서 `user-read` 의
  passGuard 패턴을 mirror 하되 RolesGuard override 부분만 제거하고, `overrideGuard
(JwtAuthGuard)` 의 `canActivate` 가 `req.user = { sub }` 를 박제해 me 핸들러가 sub 를
  읽어 200/404 분기에 도달하게 한다(req.user 미박제 시 401 분기). happy-path 는 응답
  body 에 hashedPassword 가 없음(UserResponseDto whitelist)도 함께 assert 한다. non-2xx
  분류 실증은 mocked `findById` 의 404(stale token) error path 와, req.user 미박제 guard
  를 쓰는 별도 module 의 401 defence-in-depth 분기로 커버한다.
- `summary-detail-read.perf-spec.ts` (T-0844) — `SummaryController` + mocked
  `SummaryService`(4 jest.fn, detail 경로가 실제 호출하는 것은 `findById` 뿐),
  `GET /api/summaries/:id`(findOne → `service.findById(id)` — 단일 Summary 상세, row
  부재 시 service `NotFoundException` → 404, REQ-048 조회 back) 배선. 열다섯 번째 배선
  spec 이자 **첫 path-param `:id` detail read**. 앞선 14 slice(summary-read(list)~
  auth-me-read)는 전부 list/query/self-read 경로였고, 본 spec 은 첫 단일 상세 조회(:id)
  라 harness 가 detail read 경로까지 재사용됨을 실증한다. 같은 controller 의 list
  endpoint(T-0830)와 같은 가드 스택(`@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("User")`)을 공유하므로 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 둘 다 통과시키되, self-read 가 아니라 `findById(id)` raw forward 라 req.user 박제는
  불요하다(canActivate true 만으로 충분 — auth-me-read 의 sub 박제와 대비). non-2xx 분류
  실증은 mocked `findById` 가 `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)
  를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버하며(404 를 collector
  failures 로 분류), mixed 부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `contribution-detail-read.perf-spec.ts` (T-0849) — `ContributionController` + mocked
  `ContributionService`(4 jest.fn, detail 경로가 실제 호출하는 것은 `findById` 뿐),
  `GET /api/contributions/:id`(findOne → `service.findById(id)` — 단일 Contribution 상세,
  row 부재 시 service `NotFoundException` → 404, REQ-048 조회 back) 배선. 스무 번째 배선
  spec 이자 **여섯 번째 path-param `:id` detail read** 이며 첫 Contribution entity 상세
  조회 경로다. detail 핸들러가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`
  가드 스택을 적용하므로 assessment-detail-read(T-0846) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, self-read
  가 아니라 `findById(id)` raw forward 라 req.user 박제는 불요하다(canActivate true
  만으로 충분). non-2xx 분류 실증은 mocked `findById` 가 `NotFoundException`(404 — row
  부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로
  커버하며(404 를 collector failures 로 분류), mixed 부분 실패(4회 중 1회 404 →
  failures===1)도 실증한다.
- `user-detail-read.perf-spec.ts` (T-0850) — `UserController` + mocked `UserService`
  (4 jest.fn, detail 경로가 실제 호출하는 것은 `findById` 뿐), `GET /api/users/:id`
  (detail → controller 자체 인가 분기: isSelf(actor.sub===id)/isAdminPlus(actor.role)
  통과 시 `service.findById(id)` → `UserResponseDto.fromEntity`(200), 둘 다 false 시
  `ForbiddenException`(403 — service 미도달), row 부재 시 `NotFoundException`(404),
  REQ-048 조회 back) 배선. 스물한 번째 배선 spec 이자 **일곱 번째 path-param `:id`
  detail read** 이며 **controller 자체 403 분기가 있는 첫 detail(:id)** 다. `GET
/api/users/:id` 는 `@UseGuards(JwtAuthGuard)` **만** 부착(RolesGuard 미적용)이라
  auth-me-read(T-0843)처럼 `overrideGuard(JwtAuthGuard)` 의 `canActivate` 가 `req.user`
  를 박제하되, me 의 sub-only 박제와 달리 `{ sub, role }` 를 박제해 detail 핸들러가
  self/Admin+ 분기(200/403/404)에 도달하게 한다. passGuard payload 를 test 별로 달리해
  (User-self → 200, Admin-other → 200, User-other → 403) 세 분기를 각각 실증하고, mocked
  `findById` 의 `NotFoundException` 으로 404(not-found, 403 과 구분되는 non-2xx)를,
  403 분기에서는 `findById` 미호출(controller 가 service 도달 전 차단)을 함께 검증한다.
  happy-path 는 응답 body 에 hashedPassword 가 없음(UserResponseDto whitelist)도 assert,
  mixed 부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `llm-provider-config-detail-read.perf-spec.ts` (T-0851) — `LlmProviderConfigController` +
  mocked `LlmProviderConfigService`(5 jest.fn, detail 경로가 실제 호출하는 것은 `findById`
  뿐), `GET /api/llm/providers/:id`(findById → `service.findById(id)` — 단일 LLM provider
  config 상세, row 부재 시 service `NotFoundException` → 404, 정상 시 apiKey 제거된
  `LlmProviderConfigView`(200), REQ-096 Admin 가시성 / REQ-048 조회 back) 배선. 스물두 번째
  배선 spec 이자 **여덟 번째 path-param `:id` detail read** 다. detail 핸들러가
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을 적용하므로
  assessment-detail-read(T-0846)·contribution-detail-read(T-0849) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, user :id
  (T-0850)의 controller 자체 403 분기와 달리 본 endpoint 는 controller 자체 authorization
  분기가 없어(RolesGuard 가 가드하는 것을 override 로 통과) `findById(id)` raw forward 라
  req.user 박제는 불요하다(canActivate true 만으로 충분). happy-path 는 응답 body 에
  apiKey 가 미노출(LlmProviderConfigView allow-list redaction — secret 은 view 타입에서
  제외)임을 함께 assert 한다. non-2xx 분류 실증은 mocked `findById` 가
  `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가 404/500
  을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed 부분
  실패(4회 중 1회 404 → failures===1)도 실증한다.
- `export-detail-read.perf-spec.ts` (T-0852) — `ExportController` + mocked
  `ExportJobService`(5 jest.fn, detail 경로가 실제 호출하는 것은 `findJob` 뿐),
  `GET /api/admin/export/:id`(findJob → `service.findJob(id)` — 단건 status polling
  조회, row 부재 시 service 의 `findUniqueOrThrow` 가 P2025 → `NotFoundException` → 404,
  정상 시 단건 `ExportJob`(200), REQ-096 Admin export/import 가시성 / REQ-048 조회 back)
  배선. 스물세 번째 배선 spec 이자 **아홉 번째 path-param `:id` detail read** 다. detail
  핸들러가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을
  적용하므로 llm-provider-config-detail-read(T-0851) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, user :id
  (T-0850)의 controller 자체 403 분기와 달리 본 endpoint 는 controller 자체 authorization
  분기가 없어(RolesGuard 가 가드하는 것을 override 로 통과) `findJob(id)` raw forward 라
  req.user 박제는 불요하다(canActivate true 만으로 충분). 같은 export 모듈 sibling
  spec(export-running-read.perf-spec.ts, T-0841)의 부트스트랩(ExportController +
  `ExportJobService` mock 단일 주입)을 재사용한다. non-2xx 분류 실증은 mocked `findJob`
  이 `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가
  404/500 을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed
  부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `import-detail-read.perf-spec.ts` (T-0853) — `ImportController` + mocked
  `ImportJobService`(3 jest.fn, detail 경로가 실제 호출하는 것은 `findJob` 뿐),
  `GET /api/admin/import/:id`(findJob → `service.findJob(id)` — 단건 status polling
  조회, row 부재 시 service 의 `findUniqueOrThrow` 가 P2025 → `NotFoundException` → 404,
  정상 시 단건 `ImportJob`(200), REQ-096 Admin export/import 가시성 / REQ-048 조회 back)
  배선. 스물네 번째 배선 spec 이자 **열 번째 path-param `:id` detail read** 다. 직전
  export :id detail slice(T-0852)와 export↔import counterpart 로 대칭이다. detail
  핸들러가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을
  적용하므로 export-detail-read(T-0852) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, user :id
  (T-0850)의 controller 자체 403 분기와 달리 본 endpoint 는 controller 자체 authorization
  분기가 없어(RolesGuard 가 가드하는 것을 override 로 통과) `findJob(id)` raw forward 라
  req.user 박제는 불요하다(canActivate true 만으로 충분). 같은 import 모듈 sibling
  spec(import-running-read.perf-spec.ts, T-0842)의 부트스트랩(ImportController +
  `ImportJobService` mock 단일 주입)을 재사용한다. non-2xx 분류 실증은 mocked `findJob`
  이 `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가
  404/500 을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed
  부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `group-persons-read.perf-spec.ts` (T-0854) — `GroupController` + mocked
  `GroupService`(sub-resource 경로가 실제 호출하는 것은 `findPersonsByGroupId` 뿐),
  `GET /api/groups/:id/persons`(findPersons → `service.findPersonsByGroupId(id)` —
  지정 Group 소속 Person 목록, Group 부재 시 service 사전 검증이 `NotFoundException` →
  404, Group 있고 membership 0 이면 200 + 빈 배열(404 아님), membership 1+ 면 200 +
  Person[], REQ-048 조회 back) 배선. 스물다섯 번째 배선 spec 이자 **첫 sub-resource
  (:id/persons) read** 다. 직전 24 spec 이 모두 list/query/self 또는 단건 detail(:id)
  read 였고, 본 slice 는 단건 detail 을 넘어 하위 리소스 목록 조회 경로로 harness 를
  확장한다. `GroupController` 는 group-detail(T-0845)·group-read(list) 와 같이 guard
  미적용이라 `overrideGuard` 없이 순수 부트스트랩하며, `findPersons` 는 `@Param("id")`
  를 `findPersonsByGroupId(id)` 로 raw forward 라 controller 자체 분기가 없다. 반환이
  단건 object 가 아니라 **Person[] 목록**이라 정상 응답이 배열이며, membership 0 → 빈
  배열도 200 성공으로 분류하는 **empty-list happy-path** 를 별도 커버한다. non-2xx 분류
  실증은 mocked `findPersonsByGroupId` 가 `NotFoundException`(404 — Group 부재)/일반
  `Error`(500 — 장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버하며(404
  를 collector failures 로 분류), mixed 부분 실패(4회 중 1회 404 → failures===1)도
  실증한다.
- `part-persons-read.perf-spec.ts` (T-0855) — `PartController` + mocked
  `PartService`(sub-resource 경로가 실제 호출하는 것은 `findPersonsByPartId` 뿐),
  `GET /api/parts/:id/persons`(findPersons → `service.findPersonsByPartId(id)` —
  지정 Part 소속 Person 목록, Part 부재 시 service 사전 검증(`findById(partId)`
  재호출)이 `NotFoundException` → 404, Part 있고 소속 Person 0 이면 200 + 빈 배열
  (404 아님), 소속 Person 1+ 면 200 + Person[], REQ-048 조회 back + REQ-028 reverse
  query) 배선. 스물여섯 번째 배선 spec 이자 **두 번째 sub-resource(:id/persons)
  read** 다. 직전 group-persons(T-0854)와 group↔part counterpart 로 대칭이다.
  `PartController` 는 part-detail(T-0854 sibling)·part-read(list) 와 같이 guard
  미적용이라 `overrideGuard` 없이 순수 부트스트랩하며(group-persons T-0854 mirror),
  `findPersons` 는 `@Param("id")` 를 `findPersonsByPartId(id)` 로 raw forward 라
  controller 자체 분기가 없다. 반환이 단건 object 가 아니라 **Person[] 목록**이라
  정상 응답이 배열이며, 소속 Person 0 → 빈 배열도 200 성공으로 분류하는
  **empty-list happy-path** 를 별도 커버한다. non-2xx 분류 실증은 mocked
  `findPersonsByPartId` 가 `NotFoundException`(404 — Part 부재)/일반 `Error`(500 —
  장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버하며(404 를
  collector failures 로 분류), mixed 부분 실패(4회 중 1회 404 → failures===1)도
  실증한다.
- `export-status-view-read.perf-spec.ts` (T-0856) — `ExportController` + mocked
  `ExportJobService`(5 jest.fn, derived-detail 경로가 실제 호출하는 것은 `findJob`
  뿐), `GET /api/admin/export/:id/status-view`(statusView → `service.findJob(id)` 로
  job 조회 후 `describeExportJobStatus(JOB_STATUS_TO_VIEW[job.status])` 로 사람-친화
  `ExportJobStatusView`(phaseLabel·terminal·downloadable·한국어 message)를 200 반환,
  job 부재 시 findJob 의 `NotFoundException`(404)이 helper 호출 도달 전 raw propagate,
  REQ-030 async job 진행 view / REQ-032 raw stack 미노출 / REQ-048 조회 back) 배선.
  스물일곱 번째 배선 spec 이자 **첫 derived-detail(:id/status-view) read** 다. 앞선 26
  spec 중 export :id detail(T-0852)이 raw record(단건 ExportJob)를 반환한 반면, 본
  endpoint 는 status 를 view 로 derive 하는 조합 read 라 harness 재사용이 순수
  pass-through 뿐 아니라 derive 경로에서도 유효함을 실증한다. statusView 핸들러가
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을 적용하므로
  export-detail-read(T-0852) 처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 둘 다 통과시키되, controller 자체 authorization 분기가 없어(RolesGuard 가 가드하는
  것을 override 로 통과) `findJob(id)` raw forward 라 req.user 박제는 불요하다(canActivate
  true 만으로 충분). 서로 다른 JobStatus(진행 중 RUNNING → "running" / terminal
  SUCCEEDED → "ready")를 mock 으로 주어 JOB_STATUS_TO_VIEW 매핑 + helper derive 가 각각
  정상 200 으로 분류되고 view 가 status 별로 phaseLabel·terminal 을 달리 산출함을
  실증하며, 응답 body 가 raw ExportJob 이 아니라 derive 된 `ExportJobStatusView` 임을
  최소 1개 field(phaseLabel·terminal)로 확인한다. non-2xx 분류 실증은 mocked `findJob`
  이 `NotFoundException`(404 — job 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가
  404/500 을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed
  부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `import-modes-read.perf-spec.ts` (T-0857) — `ImportController` + mocked
  `ImportJobService`(3 jest.fn, **describeModes 는 이 mock 을 전혀 호출하지 않음** —
  service-무의존 read), `GET /api/admin/import/modes`(describeModes → 고정 2 mode
  (Prisma `ImportMode.REPLACE`/`MERGE`)를 `IMPORT_MODE_ENUM_TO_PAYLOAD` 로 lowercase
  `ImportRestoreMode` 변환 후 `describeImportMode` helper 로 derive 한
  `ImportModeDescription[]`(항상 길이 2: REPLACE→destructive=true / MERGE→destructive=false)
  를 200 반환, client 입력 분기 0 / persistence 0, REQ-030 Import mode 선택 / REQ-032
  raw 미저장·미노출 / REQ-048 조회 back) 배선. 스물여덟 번째 배선 spec 이자 **첫
  derived-list(/modes) read** 다. 직전 export :id/status-view(T-0856)가 단건 status 를
  view 로 derive 하는 derived-detail 이었다면, 본 endpoint 는 고정 목록을 helper 로
  derive 하는 derived-list 라 harness 재사용이 pass-through·조합 detail 뿐 아니라 파생
  목록 read 에서도 유효함을 실증한다. describeModes 는 `@UseGuards(JwtAuthGuard,
RolesGuard)` + `@Roles("Admin")` 가드 스택을 적용하므로 import-running(T-0842) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되,
  controller 자체 authorization 분기가 없어 req.user 박제는 불요하다(canActivate true
  만으로 충분). 앞선 findJob/findRunning mock-예외 slice 들과 달리 describeModes 는
  **service 를 전혀 호출하지 않는 순수 helper-derive** 라 자체 예외 경로가 없다(항상
  200). 따라서 non-2xx 분류 실증은 mocked service 예외가 아니라 **요청 wrapper 레벨에서
  인위 non-2xx status(403/500)를 주입**해 collector 의 실패 분기를 커버하며, happy-path
  는 응답 body 가 helper derive 결과 `ImportModeDescription[]`(길이 2, destructive
  true/false)임과 service mock 미발화를 함께 assert 한다. mixed 부분 실패(4회 중 1회 500
  → failures===1)와 harness 가 body 형태에 무관(status 만 성공 판정)함도 실증한다.
- `export-download-read.perf-spec.ts` (T-0858) — `ExportController` + mocked
  `ExportJobService`(5 jest.fn, download 경로가 실제 호출하는 것은 `findJob` +
  `materializeFullExportDownload` 두 개), `GET /api/admin/export/:id/download`(download →
  `findJob(id)` 로 job 조회 → `buildScopePayload(job)` → `materializeFullExportDownload(scope)`
  로 `Readable` 획득 → `collectStream` 으로 Buffer 화 → 다운로드 header set 후
  `StreamableFile`(byte body) 200 반환, job 부재 시 findJob 의 `NotFoundException`(404) raw
  propagate, materialize 실패 시 service reject(500) raw propagate, REQ-030 Export /
  REQ-032 raw 미저장·미노출 / REQ-045 Admin 전용 / REQ-048 조회 back) 배선. 스물아홉 번째
  배선 spec 이자 **첫 artifact-stream(:id/download) read(첫 dual-service-call read)** 다.
  앞선 slice 들이 단건 detail·derived read 였다면 본 endpoint 는 **두 service 호출을
  연쇄**(findJob → materializeFullExportDownload)하고 **StreamableFile(byte body)을
  흘려보내는 artifact-stream read** 라 harness 재사용이 dual-service-call + stream body
  read 에서도 유효함을 실증한다. `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`
  가드 스택을 sibling(export-detail T-0852 / export-status-view T-0856) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 통과시키되 controller 자체
  authorization 분기가 없어 req.user 박제는 불요하다(canActivate true 만으로 충분). non-2xx
  분류 실증은 두 service 호출 각각이 실패 지점이라 (1) findJob 404 → 두 번째 호출 도달 전
  propagate, (2) materializeFullExportDownload reject(500) → 첫 호출 성공 후 두 번째에서
  실패, 두 error path 를 각각 커버하며 mixed 부분 실패(4회 중 1회 404 → failures===1)도
  실증한다.
- `app-root-read.perf-spec.ts` (T-0859) — `AppController` + mocked `AppService`(1 jest.fn,
  getRoot 경로가 실제 호출하는 것은 `getStatus` 뿐), `GET /api`(getRoot →
  `appService.getStatus()` 가 반환하는 고정 문자열 `APP_STATUS_MESSAGE`("Assessment-Agent")를
  그대로 200 반환 — path/query param 0, guard 미적용, service 는 동기 `getStatus()` 1개만
  호출하며 예외 경로가 없음, REQ-048 조회 back) 배선. 서른 번째 배선 spec 이자 **최단
  health/sanity read** 다. 이 endpoint 는 지금까지 배선한 모든 read 중 **가장 단순한
  형태**로 collector 배선 정확성 검증의 하한(floor) case 를 채운다: (1) guard 미적용이라
  `overrideGuard` 가 불요(person-read/group-read/part-read 처럼 순수 부트스트랩), (2)
  path/query param 없음, (3) service 는 `getStatus()` 동기 함수 1개만 호출하며 예외 경로가
  없음(항상 200 고정 문자열 — import /modes(T-0857) 의 순수-helper derive 보다도 단순, helper
  derive 조차 없이 상수 문자열 forward). happy-path 는 응답 body 가 고정 문자열
  ("Assessment-Agent")이고 `getStatus` 가 실호출됨을 함께 assert 한다(import /modes 의
  service-무의존 derive 와 달리 getRoot 는 service 를 실호출). getRoot 는 예외 경로가 없는
  순수 동기 반환이라(항상 200), collector 의 실패(non-2xx) 분기 실증은 import /modes(T-0857)
  처럼 **요청 wrapper 레벨에서 인위 non-2xx status(500/503)를 주입**해 커버하며, mixed 부분
  실패(4회 중 1회 503 → failures===1)와 harness 가 body 형태에 무관함도 실증한다.

fs+HTTP 통합 perf-spec(measure→confirm-or-compare top loop 배선, 위 서른-배치와 별개 종류):

- `app-root-measure-confirm.perf-spec.ts` (T-0877) — top loop `measureAndConfirmBaseline` 을 실
  `GET /api` 요청·임시 baseDir fs baseline round-trip 에 태운 **첫 fs+HTTP 통합 perf-spec**
  (established 최초 확정 write + compared 로드·비교 양분기 실 실행, floor-case health-read).
- `summary-measure-confirm.perf-spec.ts` (T-0880) — 위 top loop 를 실 조회 endpoint
  `SummaryController` `GET /api/summaries?personId=<id>` 에 배선한 **두 번째 fs+HTTP 통합
  perf-spec**. floor-case(app-root)와 달리 `JwtAuthGuard`/`RolesGuard` 두 가드를
  `overrideGuard(...).useValue({ canActivate: () => true })` 로 통과시키고, **personId 부재
  요청(실 400)** 이라는 SummaryController 고유 query-param 예외경로를 errorRate 위반 candidate
  established write 로 추가 실증한다(§5 #2 S2 조회 경로 배선 이월분).
- `assessment-measure-confirm.perf-spec.ts` (T-0882) — 위 top loop 를 REQ-048 이 직접 겨냥하는
  평가 결과 조회 경로의 대표 endpoint `AssessmentController`
  `GET /api/assessments?personId=<id>&period=<day|week|month>`(REQ-038 시계열 조회) 에 배선한
  **세 번째 fs+HTTP 통합 perf-spec**. summary(T-0880)의 personId 필수 query-param 400 분기에
  더해 **summary 에 없던 `period` optional query 분기**(부재 vs `?personId=&period=week` 두
  요청 형태)를 established/compared 양쪽에서 추가 실증한다(§5 #2 S2 조회 경로 배선 이월분).

- **DB 무의존**: service 를 mock 하고(guard 있는 controller 는 override 도) 실 Postgres
  round-trip·실 LLM·실 스케줄러·외부 I/O 가 없어 결정론적이다. 실 DB round-trip
  **baseline 실측**은 별도 follow-up (§5 item 5). 서른 spec 모두 collector 배선의
  **정확성 검증**이지 baseline 측정이 아니다.
- **실행**: `pnpm test:perf` (`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$`
  가 서른 파일을 모두 picking — 더 이상 `passWithNoTests` 로 skip 되지 않는다). 기본
  `pnpm test` 는 `.spec.ts$` 만 매칭하므로 perf-spec 을 picking 하지 않아 unit coverage
  gate 와 분리된다.
- perf job 은 상시 PR CI 와 분리한다(follow-up #4).

## 후속 harness (DB-backed baseline / S1·S3)

실 조회 endpoint round-trip latency **baseline 실측**(실 Postgres)·S1 배치 부하·S3 동시성
내성 harness 는 별도 follow-up 이며 이 primitive 를 import 한다(§5 item 1/3/5).
