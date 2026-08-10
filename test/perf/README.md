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
- `contribution-measure-confirm.perf-spec.ts` (T-0883) — 위 top loop 를 REQ-048 이 겨냥하는
  평가 결과 조회·시각화 경로의 마지막 distinct read 표면 `ContributionController`
  `GET /api/contributions?assessmentId=<id>`(REQ-033 aggregate-level 기여 조회) 에 배선한
  **네 번째 fs+HTTP 통합 perf-spec**. assessment(T-0882)의 `period` optional query 분기는
  없고(단일 필수 `assessmentId` query 만), **assessmentId 부재/빈 string 실 400** 이라는
  ContributionController 고유 query-param 예외경로를 errorRate 위반 candidate established write
  로 실증한다. 이로써 요약·평가·기여 3 read 경로의 measure-confirm 배선이 완결된다(§5 #2).

- **DB 무의존**: service 를 mock 하고(guard 있는 controller 는 override 도) 실 Postgres
  round-trip·실 LLM·실 스케줄러·외부 I/O 가 없어 결정론적이다. 실 DB round-trip
  **baseline 실측**은 별도 follow-up (§5 item 5). 서른 spec 모두 collector 배선의
  **정확성 검증**이지 baseline 측정이 아니다.
- **실행**: `pnpm test:perf` (`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$`
  가 서른 파일을 모두 picking — 더 이상 `passWithNoTests` 로 skip 되지 않는다). 기본
  `pnpm test` 는 `.spec.ts$` 만 매칭하므로 perf-spec 을 picking 하지 않아 unit coverage
  gate 와 분리된다.
- perf job 은 상시 PR CI 와 분리한다(follow-up #4).

## 실 DB round-trip baseline (slice 목록)

- **slice 1** — `person-read-realdb.perf-spec.ts` (T-1500) — 위 mock 배치와 달리 **mock override 0** 으로
  `createE2EApp()`(AppModule 전체)을 부트스트랩하고 `moduleRef.get(PrismaService)` 로 얻은 실
  client 로 seed 한 뒤 `GET /api/persons` 를 반복 측정하는 **첫 실 DB round-trip perf-spec**.
  [load-resilience-test-plan.md](../../docs/ops/load-resilience-test-plan.md) `§ 5` item 5("실
  Postgres round-trip baseline 미실측")의 **첫 실측**이자, [requirements.md](../../docs/requirements.md)
  REQ-048 재판정이 유일 잔여 서버측 한계로 적시한 지점을 endpoint 1 개 범위에서 해소한다.
- **책임 경계** — mock spec = 배선 latency(즉시 반환, DB 왕복 0) 로 harness 정확성 검증. 본
  spec = **round-trip 포함 latency**(실 SELECT 발화) 로 REQ-048 임계가 실 query 경로에서도
  성립하는지의 **실측 증거**. 검증도 mock 의 호출 횟수 대신 **응답 body 가 seed 한 row 값과
  일치**함으로 실 query 발화를 입증하고, fail 분기도 **실 DB 미존재 row 의 404**(errorRate
  위반)·비현실적 임계 주입(`p95MaxMs: 0`)으로 도달해 실 측정 시간에 의존하지 않는다.
  `afterEach(truncateAll)`(ADR-0004 `§ Cleanup`) 로 row leak 0, `afterAll` 의 `app.close()` +
  `prisma.$disconnect()` 로 connection 누수 0.
- **slice 2** — `group-read-realdb.perf-spec.ts` (T-1502) — 같은 부트스트랩·정리 구조를 승계하되
  `GroupController` 조회 3 route(`GET /api/groups` · `:id` · `:id/persons`)를 측정한다. slice 1
  과의 차이는 **N+1 indirect navigation 측정** — `GroupService.findPersonsByGroupId` 가
  `PersonGroupMembership` 에서 personId[] 를 뽑은 뒤 `PersonRepository.findById` 를 loop 호출해
  **membership 수에 비례해 query 가 늘어나므로**(service 주석의 "N+1 query 의 P0 acceptable
  패턴"), slice 1 의 flat 단일 SELECT 와 달리 이 경로의 REQ-048 충족을 처음 증거화한다.
  **측정만 하며 N+1 최적화는 하지 않는다**(production code 변경 0, mock 짝은 불변).
- **slice 3** — `group-persons-scale-realdb.perf-spec.ts` (T-1504) — slice 2 와 **같은 route**
  (`GET /api/groups/:id/persons`)를 **다른 규모** 로 측정한다. slice 2 가 `GroupController` 조회
  **route 폭** 을 고정된 소규모 seed 로 훑는 축이라면, 본 slice 는 단일 route 의 **규모 축**
  (membership 5건 vs 60건)이다. `findPersonsByGroupId` 는 membership 수 = 요청당 query 수이므로,
  규모가 커져도 REQ-048 임계(p95 < 3000ms)가 유지되는지를 처음 증거화한다. 두 표본의 baseline 한
  줄은 **관찰 기록** 일 뿐 **대소 관계(`large.p95 > small.p95`)를 assert 하지 않는다** — latency 는
  wall-clock 이라 비결정적이라 대소 assert 는 flaky 하기 때문이다. 여기서의 "대규모" 는 단일
  route 의 **상대 비교용 표본** 이며 **REQ-047 의 실 scale 부하 검증이 아니다**(100~200명 /
  50~100 repo / 배치 부하 축은 미착수). 여기서도 **측정만 하며 N+1 최적화는 하지 않는다**.
- **slice 4** — `assessment-read-realdb.perf-spec.ts` (T-1506) — 실측 대상을 **세 번째 endpoint
  도메인** 인 `AssessmentController` 로 넓혀 조회 2 route(`GET /api/assessments?personId=&period=` ·
  `GET /api/assessments/:id`)를 측정한다. 앞 slice 와의 차이는 두 가지다 — ① **인증·RBAC guard 를
  실제로 통과하는 첫 실 DB perf slice**: slice 1~3 은 guard 가 없는 controller 라 "override 0" 이 곧
  "guard 없음" 이었지만, 본 slice 는 `createAuthenticatedE2EApp` 로 발급한 **실 JWT** 로
  `JwtAuthGuard` + `RolesGuard`(`@Roles("User")`)를 통과하므로 REQ-048 임계가 **인증 layer + DB
  round-trip 을 모두 포함한** 경로에서도 성립하는지의 첫 증거다(401 분기로 guard 생존도 확인).
  ② **index 필터 경로**: REQ-038 시계열 조회는 `@@index([personId, period, periodStart])` 를 타는
  필터 + 다중 row 조회라 slice 1 의 flat 목록·slice 2·3 의 N+1 loop 와 구조가 다르다. `truncateAll`
  명단에 `"User"` 가 있어 `afterEach` 는 truncate 후 **원본 id 그대로** actor 를 재-seed 한다
  (`reseedAuthenticatedActors`). 여기서도 **측정만 하며 production code 와 mock 짝은 불변** 이다.
- **slice 5** — `contribution-read-realdb.perf-spec.ts` (T-1508) — 실측 대상을 **네 번째 endpoint
  도메인** 인 `ContributionController` 로 넓혀 조회 2 route(`GET /api/contributions?assessmentId=` ·
  `GET /api/contributions/:id`)를 측정한다. slice 4 와의 차이는 **조회 구조** 다 — ① **부모→자식 FK
  fan-out**: `findByAssessment` 가 부모(`Assessment`) id 로 자식 다중 row 를 `createdAt` 오름차순으로
  긁고, 그 필터는 명시 `@@index` 가 아니라 **`@@unique([assessmentId, sourceRef])` composite unique
  index 의 prefix** 를 탄다. ② **3-level FK chain seed**(`Person → Assessment → Contribution`, 자식은
  row 마다 다른 `sourceRef` + 명시 `createdAt`). slice 4 처럼 인증·RBAC guard 를 실 JWT 로 통과하며,
  여기서도 **측정만 하며 production code 와 mock 짝은 불변** 이다.
- **slice 6** — `summary-read-realdb.perf-spec.ts` (T-1510) — 실측 대상을 **다섯 번째 endpoint 도메인**
  인 `SummaryController` 로 넓혀 조회 2 route(`GET /api/summaries?personId=&period=` ·
  `GET /api/summaries/:id`)를 측정한다. 앞 slice 와의 차이는 **조회 구조 축 2 개** 다 — ① **동일 tuple
  중복 index**: `Summary` 는 `@@unique([personId, period, periodStart])` 와 `@@index(...)` 가 같은
  tuple 로 중복 정의된 유일 entity 라(slice 4 는 unique 가 `scope` 포함 4 컬럼, slice 5 는 명시 index
  부재), optimizer 가 어느 index 를 타든 REQ-048 임계가 성립하는지의 첫 증거다. ② **payload 크기**:
  `narrative` 가 서술형 long text 라 응답 본문이 앞 slice 보다 크다. period 지정(2 컬럼) · 미지정
  (leftmost prefix) 두 경로와 매칭 0 의 빈 배열을 덮고, 401 은 **cookie 부재** 와 **변조 토큰** 두
  조건으로 각각 도달해 guard 생존도 확인한다. slice 4·5 처럼 `afterEach` 는 truncate 후 actor 를
  **원본 id 그대로** 재-seed 하며, 여기서도 **측정만 한다**.
- **slice 7** — `part-read-realdb.perf-spec.ts` (T-1512) — 실측 대상을 **여섯 번째 endpoint 도메인**
  인 `PartController` 로 넓혀 조회 2 route(`GET /api/parts` · `GET /api/parts/:id/persons`)를
  측정한다. 앞 slice 와의 차이는 **조회 구조 축 3 개** 다 — ① **비-index FK 역방향**: 필터 컬럼
  `Person.partId` 는 `@unique` 도 `@@index` 도 선언되지 않은 유일한 실측 필터 컬럼이라(slice 4 =
  composite `@@index`, slice 5 = composite unique 의 prefix, slice 6 = unique·index 중복 tuple),
  **index 미보장 경로에서도 REQ-048 임계가 성립하는지** 의 첫 증거다. ② **요청당 상수 2 query**:
  `PartService.findPersonsByPartId` 가 부모 존재 검증(`findById`) 후 자식 조회(`findByPartId`)를
  하므로 slice 2 의 membership 비례 N+1 과도, 앞 slice 들의 단일 SELECT 와도 다르다. ③
  **soft-delete 필터**: 자식 조회가 `activeOnly` 기본값으로 `where: { partId, active: true }`
  (REQ-026)를 타므로, 비활성 row 를 섞은 seed 에서 걸러짐과 latency 를 함께 관측한다. 소속 0 인
  Part 의 200 + 빈 배열, 대조군 Part 소속의 비혼입, 미존재 id 의 404 를 함께 덮으며,
  `PartController` 는 guard 미부착이라 slice 1~3 처럼 인증 노이즈가 0 이다. 여기서도
  **측정만 하며 production code 와 mock 짝은 불변** 이다(`Person.partId` 에 index 추가 금지).
- **slice 8** — `user-read-realdb.perf-spec.ts` (T-1514) — 실측 대상을 **일곱 번째 endpoint 도메인**
  인 `UserController` 로 넓혀 조회 2 route(`GET /api/users` · `GET /api/users/:id`)를 측정한다.
  앞 slice 와의 차이는 **구조 축 3 개** 다 — ① **403 인가 분기의 첫 실측**: slice 4~6 은 guard 통과와
  401 두 상태만 봤으나, 상세 route 는 `isSelf || isAdminPlus` OR 분기를 controller 가 판정해
  **권한 부족 403** 과 **존재 부재 404** 가 의미상 분리된 유일한 경로이고, 403 은 `service.findById`
  호출이 0 이라 **DB 를 타지 않는 거절 경로의 latency** 를 처음 관측한다. ② **route 별 상이 guard
  tier**: 목록은 `JwtAuthGuard + RolesGuard`(`@Roles("Admin")`), 상세는 `JwtAuthGuard` 만 +
  controller 분기라 같은 controller 안에서 **guard stack 깊이가 다른 두 route** 를 나란히 잰다.
  ③ **인증 principal 테이블 자체가 측정 대상**: 결과 집합이 곧 actor 가 속한 테이블이고 필터 축도
  **단일 컬럼 `@unique`(`User.email`)** + 목록의 **무필터 전량 SELECT** 다(slice 4 = composite
  `@@index`, 5 = composite unique prefix, 6 = unique·index 중복 tuple, 7 = 무-index). self/Admin+/
  거절 세 분기 · 미존재 id 404 · 목록의 User tier 403 · cookie 부재/변조 토큰 401 · 응답의
  `hashedPassword` 부재를 함께 덮고 `afterEach` 는 truncate 후 actor 를 **원본 id 그대로** 재-seed
  한다. 여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code ·
  mock 짝 · `User` schema 불변).
- **slice 9** — `permission-denied-read-realdb.perf-spec.ts` (T-1516) — 실측 대상을 **여덟 번째 endpoint
  도메인** 인 `PermissionDeniedRecordController` 로 넓혀 조회 1 route
  (`GET /api/permission-denied-records`)를 측정한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 —
  ① **거부 대신 결과 집합 축소(audience 차등)**: slice 8 이 403 **거부** 를 처음 실측했다면 본 slice 는
  같은 200 인데 actor 에 따라 발화 query 수가 **1(Admin bypass) / 2(allowlist 조회 + findMany) /
  1(공집합 early return)** 로 갈리는 첫 경로다(slice 7 의 상수 2 query 와도 다르다).
  ② **index 후보 2 개 + 정렬 축 공유**: `@@index([instanceRef, createdAt])` 와
  `@@index([provider, httpStatus, createdAt])` **둘** 에 `@unique` 는 **0** 인 유일 실측 대상이라
  optimizer 가 필터 조합으로 후보를 고르고 `orderBy: { createdAt: "desc" }` 가 두 index 의 후행 컬럼과
  **정렬 축을 공유** 한다(두 표본의 대소 관계는 단언하지 않는다 — slice 3 선례). ③ **다축 query param
  조합 + `IN` 절**: 필터가 query 3 축(`instanceRef` · `provider` · `httpStatus`) 조합이고 non-Admin
  경로는 allowlist 를 `instanceRef in [...]` 로 주입한다. 아울러 **첫 `src/user/` 외부 module** 이자
  **append-only audit 테이블** 측정이다. audience 차등 4 갈래 · non-numeric `httpStatus` 의 필터
  omit(400 아님) · 매칭 0 의 빈 배열 · cookie 부재/변조 토큰 401 을 함께 덮고, `afterEach` 는 truncate
  후 actor 를 **원본 id 그대로** 재-seed 한다(binding 은 `"User"` CASCADE 로 정리). 여기서도 **측정만
  하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code · mock 짝 · schema 불변).
- **slice 10** — `export-read-realdb.perf-spec.ts` (T-1518) — 실측 대상을 **아홉 번째 endpoint 도메인**
  인 `ExportController` 로 넓혀 조회 2 route(`GET /api/admin/export/running` ·
  `GET /api/admin/export/:id`)를 측정한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 —
  ① **Prisma enum 필터 + index 선두 컬럼**: `findRunning` 이 `where: { status: "RUNNING" }` 로
  `@@index([status, createdAt])` 의 **leading-edge 1 컬럼만** 타고, 그 필터 타입이 String/Int 가 아니라
  **Prisma enum(`JobStatus`)** 인 첫 실측이다(slice 4 = composite `@@index` 전량, 5 = composite unique
  prefix, 6 = unique·index 중복 tuple, 7 = 무-index, 8 = 단일 컬럼 `@unique`, 9 = index 후보 2 개).
  ② **`Json?` 2 컬럼의 JSONB 역직렬화**: `dateRange` · `entitySelector` 가 nullable Json 이라 **구조화
  payload 의 역직렬화 + NULL/비-NULL 혼재 표본** 을 처음 잰다(slice 6 의 `narrative` long text 는 평문
  축이라 다르고, 두 표본의 대소 관계는 단언하지 않는다 — slice 3 선례). ③ **guard 레벨 403**: 두 route
  모두 `@Roles("Admin")` 이라 User tier actor 는 **RolesGuard 단계에서 DB 미도달 403** 이다 — slice 8 의
  403 은 controller 가 `isSelf || isAdminPlus` 를 판정한 **controller 레벨** 거절이었으므로 같은 403 이어도
  **발생 layer 가 다르다**. 부수 축으로 도메인 데이터가 아닌 **운영 job 생명주기 테이블** 을 처음 재고,
  단건 조회가 **`findUniqueOrThrow` 의 P2025 → 404 변환** 경로이며 FK 가 **`onDelete: Restrict`** (앞
  slice 는 Cascade 또는 FK 부재)다. 4 status 혼재의 비혼입 · `RUNNING` 0 개의 빈 배열 · Json
  비-NULL/NULL 두 갈래 · cookie 부재/변조 토큰 401 · 미존재 id 404 를 함께 덮고, `afterEach` 는 truncate
  후 actor 를 **원본 id 그대로** 재-seed 한다(`ExportJob` 은 `"User"` TRUNCATE CASCADE 로 정리 —
  `db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**
  (production code · schema · 임계값 불변).
- **slice 11** — `llm-provider-config-read-realdb.perf-spec.ts` (T-1520) — 실측 대상을 **열 번째 endpoint
  도메인** 인 `LlmProviderConfigController` 로 넓혀 조회 2 route(`GET /api/llm/providers` ·
  `GET /api/llm/providers/:id`)를 측정한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 —
  ① **secondary index 0 테이블**: `LlmProviderConfig` 는 `@id` 외에 `@unique` · `@@unique` · `@@index` 가
  **하나도 없는 첫 실측 대상** 이고, 목록은 무필터 전량 `findMany()` · 단건은 **PK 직행
  `findUnique`** 다(slice 7 은 필터 컬럼만 무-index 이고 테이블에는 다른 index 가 있었으며, 8 = 단일 컬럼
  `@unique`, 9 = index 후보 2 개, 10 = `@@index` 선두 컬럼). ② **service per-row sanitize 로 DB payload >
  응답 payload**: 앞 10 slice 는 repository row 를 그대로 직렬화 forward 했지만 본 경로는 service 가 row
  마다 명시 field pick 으로 `apiKey`(AES-256-GCM envelope ciphertext)를 버린 **새 view 객체** 를 만든다 —
  읽어서 버리는 컬럼이 있어 **row 수 비례 변환 CPU** 가 latency 에 처음 섞인다. ③ **`findUnique` null 분기
  기반 404**: slice 10 의 404 는 `findUniqueOrThrow` 의 **P2025 예외 기반** 변환이었지만 본 경로는
  repository 가 null 을 반환하고 service 가 그 null 을 분기해 `NotFoundException` 을 던지는 **application
  분기 기반** 이다(같은 404 여도 발생 메커니즘이 다르다). 부수 축은 대상 테이블이 `truncateAll` 명단에
  **없고** `"User"` FK 도 없어 **spec-local `deleteMany` 정리가 필요한 첫 대상**(`db-truncate.ts` 수정 0) ·
  역방향 relation(`DifficultyMapping[]`, `onDelete: Restrict`)이 있는데도 `include` 0 인 **미조인 SELECT** ·
  도메인 데이터가 아닌 **운영 secret 보관 config 테이블** 이다. 두 route 모두 `@Roles("Admin")` 이라 403
  layer 는 slice 10 과 동일해 **새 축으로 주장하지 않고** negative cover 로만 유지한다. 0 건의 빈 배열
  (404 아님) · 3 건 전량 반환 · 목록/단건 body 의 `apiKey` 키 부재 · cookie 부재/변조 토큰 401 · User tier
  403 · 미존재 id 404 를 함께 덮고, `afterEach` 는 truncate 후 actor 를 **원본 id 그대로** 재-seed 한다
  (seed 는 Prisma 직접 insert 라 실 `LlmApiKeyCipher` · 암호화 key env 에 의존 0). 여기서도 **측정만 하며
  소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변).
- **slice 12** — `import-read-realdb.perf-spec.ts` (T-1522) — 실측 대상을 **열한 번째 endpoint 도메인**
  인 `ImportController` 로 넓혀 조회 2 route(`GET /api/admin/import/modes` ·
  `GET /api/admin/import/running`)를 측정한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 —
  ① **DB 미도달 0-query route 의 첫 실측**: `modes` 는 handler 가 `async` 도 아닌 **동기 반환** 이고
  service 미경유 · Prisma delegate 호출 **0**(고정 2 mode enum 을 `describeImportMode` helper 로 서술
  변환해 반환)이라 **guard stack + 라우팅 + 직렬화만의 배선 latency floor** 를 처음 분리 관측한다(앞
  11 slice 의 측정 route 는 예외 없이 최소 1 query 를 발화했다). ② **같은 controller · 같은 fixture
  안에서 0-query route 와 DB round-trip route 를 나란히 측정**: `running` 은 실 `ImportJob` 을
  `status: "RUNNING"` 으로 거르는 실 query 경로라 **DB 성분과 배선 성분의 상대 관측 기록** 이 처음
  남는다(두 표본의 대소 관계는 **단언하지 않고 관찰만** 한다 — slice 3 선례). ③ **한 요청에 Prisma
  enum 2 종(필터 축 + payload 축) 혼재**: slice 10 `ExportJob` 의 정합 쌍이라 `@@index([status,
  createdAt])` leading-edge · `JobStatus` enum 필터 · `Restrict` FK 는 같지만 payload 축이
  `mode`(`ImportMode`)라는 **두 번째 enum 컬럼** + `restoredRowCount`(`Int?`) + `error` /
  `artifactRef`(`String?`)의 **nullable scalar 혼재** 다(slice 10 은 `Json?` 2 컬럼 JSONB 축이었다).
  403 layer 는 slice 10·11 과 같은 `@Roles("Admin")` guard 레벨이라 **새 축으로 주장하지 않는다**.
  `RUNNING` 0 개의 빈 배열(404 아님) · status 혼재의 비혼입 · RUNNING 2 row 의 mode enum 2 값 공존과
  nullable scalar NULL/비-NULL 혼재 · `modes` 응답이 seed 0 건과 혼재 다건에서 **동일한 2 원소**
  임(DB 미도달 축의 직접 증거) · cookie 부재/변조 토큰 401 · User tier 403 2 종 · 미존재 id 404 를
  함께 덮고, `afterEach` 는 truncate 후 actor 를 **원본 id 그대로** 재-seed 한다(`ImportJob` 은
  `"User"` TRUNCATE CASCADE 로 정리 — `db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모 표본
  이라 REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변).
- **slice 13** — `difficulty-mapping-read-realdb.perf-spec.ts` (T-1524) — 실측 대상을 **열두 번째 endpoint
  도메인** 인 `DifficultyMappingController` 로 넓혀 조회 1 route(`GET /api/llm/difficulty-mappings`)를
  측정한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 — ① **nullable 관계형 FK 의 NULL / 비-NULL 혼재 +
  `include` 0 미조인 조회**: `llmProviderConfigId` 는 `String?` 이라 슬롯마다 지정 / 미지정이 갈리는데,
  앞 12 slice 의 payload 축에는 **관계형 FK 자체가 nullable 인 경로가 없었다**(slice 10 의 `Json?` 2 컬럼은
  구조화 scalar, slice 12 의 `Int?` / `String?` 은 비-관계 scalar). 부모 row 가 실재해도 `findMany()` 가
  `include` 를 주지 않아 **join 0 · FK 는 문자열 컬럼으로만 직렬화** 된다. ② **부모–자식 두 테이블이 각각
  별도 slice 로 실측되는 첫 페어 + `onDelete: Restrict` 로 정리 순서가 강제되는 첫 실 DB slice**: 부모
  `LlmProviderConfig` 는 slice 11(T-1520)에서 이미 쟀고 본 slice 는 그 **자식** 을 잰다. 두 테이블 모두
  `truncateAll` 명단 밖이라 spec-local `deleteMany` 가 필요하고 **자식 먼저** 순서를 지켜야 한다(역순은
  `Restrict` 위반 — negative 로 직접 증거화). ③ **schema 로 카디널리티가 상한된 고정 슬롯 테이블**:
  `@@unique([difficulty])` + easy/medium/hard 3 슬롯 고정(ADR-0011 §1)이라 결과 집합이 구조적으로 3 을
  넘을 수 없다 — 앞 slice 의 대상은 모두 원리상 무한 증가 가능한 테이블이었으므로 **규모 민감도가 schema 로
  bounded 인 첫 실측 경로** 다. `@Roles("Admin")` guard 레벨 403 은 slice 10·11·12 와 동일해 **새 축으로
  주장하지 않고**, 무필터 전량 `findMany()` 도 slice 11 과 같아 새 축이 아니다. 슬롯 0 건의 빈 배열
  (404 아님) · 3 슬롯 전량 반환 · FK NULL 슬롯과 비-NULL 슬롯의 한 응답 공존(비-NULL 값이 seed 한 부모
  config id 와 일치) · 응답 원소의 중첩 관계 객체 키(`llmProviderConfig`) 부재와 부모 payload 미유출 ·
  cookie 부재/변조 토큰 401 · User tier 403 · 자식 잔존 상태의 부모 `deleteMany` 가 `Restrict` 로 거부됨을
  함께 덮고, `afterEach` 는 **자식 → 부모 → `truncateAll`** 순서로 정리한 뒤 actor 를 **원본 id 그대로**
  재-seed 한다(`db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가
  아니다**(production code · schema · 임계값 불변).
- **slice 14** — `auth-me-read-realdb.perf-spec.ts` (T-1526) — 실측 대상을 **열세 번째 endpoint
  도메인** 인 `AuthController` 로 넓혀 조회 1 route(`GET /api/auth/me`)를 측정한다. 앞 slice 와의
  차이는 **구조 축 3 개** 다 — ① **조회 키가 요청 표면이 아니라 인증 토큰 payload(`req.user.sub`)
  에서 나오는 첫 경로**: path param 0 · query 0 이라 요청 표면이 **cookie 뿐** 이고 결과 집합이
  **actor 자신 1 row** 로 고정된다(앞 13 slice 의 필터 입력은 예외 없이 URL path param 또는 query
  였다 — slice 8 의 `User` 상세도 path param `:id` 기반). ② **`JwtAuthGuard` 단독 — `RolesGuard`
  미부착으로 403 분기가 구조적으로 부재**: slice 10~13 은 `@Roles("Admin")` guard 레벨 403, slice 8
  은 같은 controller 안 route 별 guard tier 차이, slice 7 은 guard **0** 이었고 **인증만 있고 인가
  0** 인 guard stack 은 본 slice 가 처음이다(401 만 존재). ③ **stale token 404 — 인증 통과 + DB
  도달 + principal row 부재 조합의 첫 실측**: 서명이 유효한 토큰인데 해당 `User` row 가 삭제되면
  `userService.findById(sub)` 가 `NotFoundException` → **404** 로 변환된다(slice 10 의 404 는 임의
  path param id 의 부재였다 — 본 경로는 **actor 자신의 row 부재** 라 401 이 아니라 404 로 갈리는
  지점이 다르다). 부수 축으로 응답이 `UserResponseDto.fromEntity` 를 거쳐 `hashedPassword` 를
  차단하는 **단건 sanitize** 를 덮되(slice 11 의 per-row sanitize 는 목록·row 수 비례 변환이라 성격이
  다르다), PK 직행 조회 자체는 slice 11 과 같아 **새 축으로 주장하지 않는다**. 인증 actor 의 self
  조회 200(id·email 일치) · 응답 whitelist 5 필드와 `hashedPassword` 부재(DB row 에는 실재) ·
  role 이 다른 두 actor(User tier · Admin tier)가 **403 없이 각자 자기 row** 만 반환 · stale token
  404(같은 시점 다른 actor 는 200) · cookie 미부착 401(200 과 혼합 시 부분 errorRate) · 서명 변조
  401 · 만료/형식 불량/빈 cookie 값 401 · path 변형(`me/extra`) 404 를 함께 덮고, `afterEach` 는
  `truncateAll` 후 actor 를 **원본 id 그대로** 재-seed 한다(stale token test 가 지운 row 도 이때
  복원 — `db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가
  아니다**(production code · schema · 임계값 불변).
- **slice 15** — `export-status-view-read-realdb.perf-spec.ts` (T-1528) — 실측 대상을 **새 endpoint
  도메인이 아니라 이미 잰 `ExportController` 의 파생 route**(`GET /api/admin/export/:id/status-view`)
  로 넓혀 조회 1 route 를 추가 측정한다(도메인 계수는 13 불변, 조회 route 23 → 24). 앞 slice 와의
  차이는 **구조 축 3 개** 다 — ① **파생 view 반환 — DB row 와 응답 shape 가 완전히 다른 첫 실 DB
  경로**: 앞 14 slice 는 raw record(slice 1~10·12·13) 또는 whitelist sanitize(slice 11 per-row ·
  slice 14 단건 — 둘 다 **필드 제거**)였지만, 본 경로는 `phaseLabel` · `stepIndex` · `totalSteps` ·
  `nextStatus` · `terminal` · `downloadable` · 한국어 `message` 를 **신설** 해 반환하므로 `ExportJob`
  row 의 어떤 컬럼도 그대로 나오지 않는다(응답에 `id` 조차 없다). ② **DB enum 컬럼 1 개가 응답
  전체를 결정하는 첫 경로**: `JobStatus` 4 값(`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`)이
  `JOB_STATUS_TO_VIEW` 로 lowercase 매핑된 뒤 `describeExportJobStatus` 가 4 종의 서로 다른 view 를
  만든다 — slice 10 이 같은 enum 을 **필터 축**(`running` 목록)으로 썼던 것과 달리 본 slice 는 같은
  enum 을 **payload 결정 축** 으로 쓴다(`SUCCEEDED` → `ready` 는 어휘 자체가 바뀌는 유일한 매핑).
  ③ **같은 row 를 읽는 두 route 가 각각 별도 slice 로 실측되는 첫 페어**: slice 10 이 `GET :id`(raw
  record) 를 쟀고 본 slice 가 `GET :id/status-view`(derived view) 를 잰다 — slice 13 의 부모–자식
  페어는 **두 테이블** 이었지만 본 건은 **동일 테이블·동일 row** 이며, 두 p95 를 모두 3000ms 미만
  으로 단언하되 **대소 관계는 wall-clock 비결정성 때문에 단언하지 않고 관찰 기록만** 남긴다(slice 3
  선례). `@Roles("Admin")` guard 레벨 403 과 `findUniqueOrThrow` 의 P2025 → 404 는 slice 10 과 동일해
  **새 축으로 주장하지 않고** negative cover 로만 유지한다. 파생 view 8 필드 whitelist(그리고 DB
  컬럼 부재) · 4 status 각각의 분기 · 불변식(`downloadable === true ⟹ status === "ready"`,
  `nextStatus === null ⟺ terminal === true`) · 404 body 의 raw stack/Prisma 내부 메시지 미노출
  (REQ-032) · cookie 미부착 401 · 서명 변조 401 · User tier 403(DB 미도달) · `:id` 자리에 형제 route
  토큰(`running`)을 넣은 path 변형이 500 이 아닌 4xx 로 갈림을 함께 덮고, `afterEach` 는
  `truncateAll` 후 actor 를 **원본 id 그대로** 재-seed 한다(`db-truncate.ts` 수정 0). 여기서도
  **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변).
- **slice 16** — `cron-schedule-read-realdb.perf-spec.ts` (T-1530) — 실측 대상을 **열네 번째 endpoint
  도메인**(그리고 **첫 `src/scheduling/` 모듈 route**)인 `CronScheduleController` 로 넓혀 조회 1 route
  (`GET /api/schedules`, REQ-096 Admin 가시성)를 측정한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 —
  ① **결과 집합이 DB row 가 아니라 in-process 상태인 첫 실측 경로**: 앞 15 slice 의 응답은 예외 없이
  Prisma delegate 가 읽은 row(또는 그 row 로 합성한 파생 view — slice 15)였지만, 본 route 는
  `SchedulerRegistry.getCronJobs()` Map 의 **key 배열** 이라 어떤 테이블도 읽지 않고 프로세스 메모리
  상태를 직렬화한다(slice 12 의 `GET /api/admin/import/modes` 도 0-query 였으나 그것은 DB·상태와 무관한
  **고정 2 원소 상수** 였고, 본 응답은 선행 write 로 변하는 **가변 상태** 다). ② **같은 spec 안의
  write(PUT/DELETE) 가 read 결과를 바꾸는 첫 페어**: `PUT /api/schedules` 로 job 을 등록하면 같은
  프로세스의 `GET` 결과 배열이 즉시 커지고 `DELETE /api/schedules/:name` 으로 다시 줄어든다 — 앞 15
  slice 는 seed 를 Prisma 로 **직접** 심고 read 만 쟀으므로 HTTP write 가 read 표본을 만드는 구조는 본
  slice 가 처음이다(단 PUT/DELETE 는 **상태 준비 수단** 일 뿐 그 자체 p95 는 단언하지 않는다).
  ③ **규모 축이 DB row 수가 아니라 registry 등록 수인 첫 slice**: 등록 **0 건** 과 **4 건** 두 표본으로
  p95 를 재 규모 민감도를 관측한다(slice 3 의 규모 축은 membership row 수, slice 13 은 schema 로 3 슬롯
  bounded, slice 14·15 는 결과 1 row 고정이었다). 두 표본의 p95 를 모두 3000ms 미만으로 단언하되
  **대소 관계는 wall-clock 비결정성 때문에 단언하지 않고 관찰 기록만** 남긴다(slice 3 선례).
  `@Roles("Admin")` guard 레벨 403 과 cookie 미부착/서명 변조 401 은 slice 10~13 과 동일해 **새 축으로
  주장하지 않고** negative cover 로만 유지한다. 등록 0 건의 빈 결과가 404 로 변환되지 않음 · PUT 1 건 후
  포함(길이 delta +1) · 같은 name 다른 cron 식 PUT 의 교체(길이 불변) · DELETE 후 미포함(delta 0) ·
  부재 name DELETE 의 404 와 그 실패가 배열을 바꾸지 않음(응답 body 에 raw stack 미노출, REQ-032) ·
  빈/공백 name 400 · 유효하지 않은 cron 식 400 · 그 400 실패가 **부분 등록 0** 임을 함께 덮는다.
  baseline 은 절대값이 아니라 **자기 prefix 몫과 길이 delta** 로만 단언해 부트스트랩 시점 registry 에
  다른 job 이 있어도 깨지지 않게 했고, 등록한 job 은 `afterEach` 에서 전량 `DELETE` 로 회수해 **timer
  누수 0**(cron 식은 테스트 중 tick 이 발화하지 않는 드문 주기만 사용), `afterEach` 는 `truncateAll`
  후 actor 를 **원본 id 그대로** 재-seed 한다(`db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모
  표본이라 REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변).
- **slice 17** — `export-download-read-realdb.perf-spec.ts` (T-1532) — 실측 대상을 **새 endpoint
  도메인이 아니라 이미 잰 `ExportController` 의 다운로드 route**(`GET /api/admin/export/:id/download`,
  REQ-030 Export / REQ-032 raw 미저장 / REQ-045 Admin 전용)로 넓혀 조회 1 route 를 추가 측정한다
  (도메인 계수는 14 불변 — export 는 slice 10·15 에서 이미 도메인, 조회 route 25 → 26. slice 15 와
  같은 셈법이며 slice 16 과는 반대다). 앞 slice 와의 차이는 **구조 축 3 개** 다 — ① **한 요청이 서로
  무관한 5 테이블을 병렬로 읽는 첫 실측 경로**: `materializeFullExportDownload` → `collectFullExportRecords`
  가 `EXPORT_ENTITY_SOURCES` 5 entity(Assessment · Person · Group · LlmConfig · AuditLog)에 대해
  `Promise.all` 로 각각 `findMany` 를 던진다 — 앞 16 slice 의 최대 fan-out 은 slice 2·3 의 membership
  indirect navigation(같은 chain 안 loop)이었고 **서로 무관한 5 테이블을 한 응답으로 합치는 구조는
  본 slice 가 처음** 이다. ② **응답이 JSON body 가 아니라 stream artifact 인 첫 slice**: handler 가
  `StreamableFile` 을 반환하고 `serializeExportDownloadHeaders` 가 `Content-Type` /
  `Content-Disposition` / `Content-Length` 를 세팅하므로 latency 에 **직렬화 + Buffer 수집 + header
  산출** 비용이 포함되고 **응답 크기가 byte 로 관측 가능한 첫 경로** 다(slice 15 의 status-view 는
  파생 view 였지만 여전히 작은 JSON object 였다). 여기서 `Content-Length` 가 **실 body byte 길이와
  일치** 함을 단언해 `byteSizeHint` 를 합성 dump 값이 아니라 실 buffer 길이로 보정하는 경로를
  확증한다. ③ **DB 읽기량과 응답 크기가 분리되는 첫 경로**: scope 선별(`selectExportRecords`)이 DB
  가 아니라 **in-process** 라 RANGE / PARTIAL job 은 응답이 작아져도 **읽는 row 수는 FULL 과 동일**
  하다 — 규모 축이 "응답 크기" 가 아니라 **"총 DB row 수"** 이며, 소규모 seed(entity 당 1~2 row)와
  상대적 대규모 seed(Person 20 + Assessment 20 누적)의 p95 를 모두 3000ms 미만으로 단언하되
  **대소 관계와 byte 증가량은 단언하지 않고 관찰 기록만** 남긴다(slice 3 선례). `@Roles("Admin")`
  guard 레벨 403 · cookie 미부착/서명 변조 401 · 부재 id 404 는 slice 10~16 과 동일해 **새 축으로
  주장하지 않고** negative cover 로만 유지한다. 저장 scope 3 분기(FULL 전량 포함 / RANGE 의
  `[start, end)` 반열림에서 **end 정각 row 제외** / PARTIAL `entitySelector: ["Person"]` 의 나머지
  entity count 0) · envelope 메타 일관성(`recordCount` === `records.length` === `entityCounts` 5 값의
  합) · 404 body 의 raw stack/Prisma 메시지 미노출(REQ-032) · seed 한 `apiKey` sentinel 의 artifact
  부재 · **저장 scope 손상 job**(`scope: RANGE` 인데 `dateRange` NULL)이 `@UseFilters(ScopeInputExceptionFilter)`
  **미부착 경로** 라 400 이 아닌 5xx 로 나타남(현재 동작의 박제일 뿐 400 매핑 판단은 별도 task) ·
  두 job 을 연달아 호출해도 `entityCounts` 가 각각 자기 scope 기준임을 함께 덮는다. `afterEach` 는
  `truncateAll` 명단 밖 세 테이블(`ExportJob` · `LlmProviderConfig` · `Assessment`)을 명시 정리한 뒤
  actor 를 **원본 id 그대로** 재-seed 한다(`ExportJob.requestedById` 가 `User` FK `onDelete: Restrict`
  — `db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**
  (production code · schema · 임계값 불변).
- **slice 18** — `group-members-read-realdb.perf-spec.ts` (T-1534) — 실측 대상을 **새 endpoint 도메인이
  아니라 이미 잰 `GroupController` 의 membership row 조회 route**(`GET /api/groups/:id/members`,
  REQ-028 N:M 다중 소속)로 넓혀 조회 1 route 를 추가 측정한다(도메인 계수는 14 불변 — Group 은
  slice 2·3 에서 이미 도메인, 조회 route 26 → 27. slice 15·17 과 같은 셈법이며 slice 16 과는 반대다).
  slice 2 헤더 `⑤ Out of Scope` 가 **명시적으로 제외** 했던 `:id/members` 를 본 slice 가 닫는다.
  앞 slice 와의 차이는 **구조 축 3 개** 다 — ① **N:M 중간 테이블 row 자체가 응답 payload 인 첫 실 DB
  경로**: `GroupService.findMembershipsByGroupId` 가 `membershipRepository.findByGroupId` 결과를 **가공
  0 으로 그대로** 반환하므로 응답 원소가 `PersonGroupMembership`(`id`/`personId`/`groupId`/`createdAt`
  4 컬럼) 이다 — 앞 17 slice 의 응답은 도메인 entity row(slice 1~10·12·13) · sanitize view(11·14) ·
  파생 view(15) · in-process 상태(16) · stream artifact(17) 였을 뿐 **관계(join table) row 를 1 급
  payload 로 내리는 경로는 없었다**(부수적으로 `updatedAt` 조차 없는 **가장 좁은 row shape**).
  ② **같은 부모 row 를 조인 경로와 비조인 경로로 나란히 재는 첫 페어**: `:id/persons`(slice 2·3)는
  membership 추출 후 `PersonRepository.findById` 를 loop 호출해 query 가 membership 수에 비례(1 + 1 + N)
  하지만 `:id/members` 는 부모 검증 + `findMany` 의 **상수 2 query** 다 — **같은 group id · 같은 seed
  상태** 에서 두 route 를 한 spec 안에서 측정해 구조 차이를 관측 기록으로 남긴다("요청당 상수 2 query"
  자체는 slice 7(`PartService.findPersonsByPartId`)과 같아 **새 축으로 주장하지 않고**, 새 축은 동일
  부모·동일 데이터의 두 접근 경로를 **페어로** 잰다는 점이다). ③ **복합 unique tuple 의 후행(non-prefix)
  컬럼 단독 필터**: 필터 컬럼은 `groupId` 인데 유일한 선언 index 는 `@@unique([personId, groupId])` 이고
  `groupId` 는 그 **두 번째 컬럼** 이라 prefix 를 탈 수 없다 — slice 5 는 composite unique 의 **prefix**,
  slice 6 은 unique·index 중복 tuple, slice 7 은 **선언 자체가 0** 인 컬럼이었으므로 **선언된 unique
  index 가 있는데도 필터가 그 prefix 를 못 타는 경로는 본 slice 가 처음** 이다(slice 7 의 "선언 0 인
  유일 실측 필터 컬럼" 서술은 그대로 유효). 두 표본(membership 5 건 / 50 건)의 p95 를 모두 3000ms
  미만으로 단언하되 **두 route 의 대소 관계도, 두 규모의 대소·증가율도 단언하지 않고 관찰 기록만**
  남긴다(slice 3 선례). 인증·인가 negative 는 `GroupController` 가 **guard 미부착** 이라 401 / 403 분기가
  **구조적으로 부재** 하므로 slice 4~17 의 cookie 미부착 401 · 서명 변조 401 · tier 403 을 복사하지
  않는다(그 사실을 spec 헤더에 명시 — guard 부재 자체는 slice 2 와 동일해 **새 축으로 주장하지 않는다**).
  대신 membership **0 건이 404 가 아닌 200 + 빈 배열** · membership 1+ 전량 반환 · 부모 부재 404 와 그
  body 의 raw stack/Prisma 메시지 미노출 · Group 2 개 공존 시 **혼입 0**(후행 컬럼 필터가 실제로 갈라냄의
  증거) · 한 Person 의 **2 Group 동시 소속** 시 각 응답 1 건씩(membership id 는 서로 다름) ·
  `onDelete: Cascade` 로 Person 삭제가 membership 을 동반 소멸시켜 응답 길이가 줄고 같은 시점
  `:id/persons` 길이와 일치 · path 변형(`:id/members/extra` · `:id/member`)의 4xx · 비-cuid/빈 문자열
  대체 토큰 id 의 **500 아닌 404** · 비현실적 임계 주입(`p95MaxMs: 0`)의 결정론적 fail 을 덮는다.
  응답 `id` 가 `DELETE :id/members/:membershipId` 계약이 요구하는 `PersonGroupMembership.id` 와 같은
  값임은 **Prisma 직접 조회** 로 확증한다(write route 는 측정 범위 밖). 본 route 는 **mock perf-spec
  짝이 존재하지 않는 첫 실 DB slice** 다(group 계열 mock 은 `group-read` · `group-detail-read` ·
  `group-persons-read` 3 개뿐 — mock spec 수 변화 0). `afterEach` 는 `truncateAll` 로 도메인 테이블을
  비우고 `PersonGroupMembership` 은 `Person`/`Group` CASCADE 로 정리된다(`db-truncate.ts` 수정 0,
  `Person.email` `@unique` 는 seed 호출별 index 접미로 회피). 여기서도 **측정만 하며 소규모 표본이라
  REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변 — `@@index([groupId])` 추가
  판단은 본 실측을 근거로 하는 별도 task).
- **slice 19** — `person-detail-read-realdb.perf-spec.ts` (T-1537) — 실측 대상을 **새 endpoint 도메인이
  아니라 slice 1 이 이미 잰 `PersonController` 의 단건 상세 route**(`GET /api/persons/:id`)로 넓혀 조회
  1 route 를 추가 측정한다(도메인 계수는 14 불변 — Person 은 slice 1 에서 이미 도메인, 조회 route
  27 → 28. slice 15·17·18 과 같은 셈법이며 slice 16 과는 반대다). slice 1 은 같은 controller 의 목록
  route 를 재면서 `:id` 를 **부재 id 의 404 negative 로만** 두드리고 happy-path 를 남겨뒀는데 본 slice 가
  그 **가장 오래된 미해소 짝** 을 닫고, 아울러 T-1536 잔여 인벤토리가 본 route 를 (B) 후보의 **"보수
  분류"** 로 유보해 둔 것을 **측정으로 해소** 한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 —
  ① **한 테이블의 목록 route 와 단건 route 가 서로 다른 가시성 규칙을 갖는 첫 실측**:
  `PersonService.findActive` 는 `findMany({ activeOnly: true })` 로 REQ-026 soft-delete invariant 를
  강제하지만 `findById` 는 `findUnique({ where: { id } })` 를 그대로 태워 **필터가 없어 `active: false`
  row 도 200 으로 반환** 한다 — 같은 시점 같은 row 가 목록에는 **없고** 단건에는 **있다**. 이는 REQ-026
  위반이 아니라 **route 별 가시성 규칙 차이** 이며(목록은 기본 노출 집합을 좁히고, 단건은 id 를 이미 아는
  호출자의 직접 지목이라 soft-delete 된 row 의 상태 확인 경로를 남긴다), slice 7 의 soft-delete 는 자식
  목록에만 걸렸고 대응하는 단건 경로가 없었다. ② **같은 seed 상태에서 목록과 단건을 나란히 재는 첫
  페어**: slice 18 의 페어는 같은 부모의 두 자식 route(`:id/members` ↔ `:id/persons`)였지만 본 slice 는
  **같은 테이블의 집합 route 와 단일 row route** 를 한 spec 안에서 잰다(목록은 slice 1 대조군 — slice 1
  파일 자체는 수정하지 않는다). ③ **규모 축의 의미가 route 마다 갈린다는 관찰**: 목록은 결과 집합이
  테이블 규모에 비례하지만 단건은 총 row 수와 무관하게 **응답이 1 row 고정** 이라, 총 5 건 / 105 건 두
  상태에서 **같은 `:id`** 를 조회해 두 p95 를 모두 3000ms 미만으로 단언한다. 두 route 의 대소 관계도, 두
  규모 표본의 대소·증가율도 **단언하지 않고 관찰 기록만** 남긴다(slice 3 선례 — wall-clock 비결정성).
  **새 축으로 주장하지 않는** 항목도 함께 박제한다 — PK 직행 `findUnique` 자체는 slice 11·14 와 동일,
  repository 의 null 분기를 service 가 `NotFoundException` 으로 바꾸는 404 는 slice 11 과 동일,
  `PersonController` 의 guard 부재는 slice 1·2·7 과 동일, `include` 0 의 미조인 SELECT 는 slice 11 과
  동일하다. 인증·인가 negative 는 guard 미부착이라 401 / 403 분기가 **구조적으로 부재** 하므로 만들지
  않고(그 사실을 spec 헤더에 명시), 대신 Person 2 건 공존 시 **혼입 0** · 비-cuid/빈 문자열 대체 토큰
  id 의 **500 아닌 404** · 삭제된 id 재조회의 **200 → 404 전이** · 응답의 관계 키(`serviceIdentities` ·
  `memberships` · `part` 등) 부재로 본 `include` 0 증거 · path 변형(`:id/extra`)의 4xx · 비현실적 임계
  주입(`p95MaxMs: 0`)의 결정론적 fail 을 덮는다. mock 짝은 `person-detail-read.perf-spec.ts`(T-0847)
  이며 **수정하지 않는다**(그 spec 의 retire·통합 판단은 T-1536 이 명시 유보한 별도 주제 — mock 잔존
  계수 불변). `afterEach` 는 `truncateAll` 로 도메인 테이블을 비우고 `Person.email` `@unique` 는 seed
  호출별 index 접미로 회피한다(`db-truncate.ts` 수정 0). 여기서도 **측정만 하며 소규모 표본이라
  REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변 — `findById` 의 active 필터
  추가 · index 추가 판단은 본 실측을 근거로 하는 별도 task).
- **slice 20** — `part-detail-read-realdb.perf-spec.ts` (T-1539) — 실측 대상을 **새 endpoint 도메인이
  아니라 slice 7 이 이미 잰 `PartController` 의 단건 상세 route**(`GET /api/parts/:id`)로 넓혀 조회
  1 route 를 추가 측정한다(도메인 계수는 14 불변 — Part 는 slice 7 에서 이미 도메인, 조회 route
  28 → 29. slice 15·17·18·19 와 같은 셈법이며 slice 16 과는 반대다). slice 7 은 같은 controller 의 목록
  (`GET /api/parts`) 과 자식 목록(`GET /api/parts/:id/persons`) 만 재고 단건 `:id` 를 남겨뒀는데 본
  slice 가 그 **가장 오래된 미해소 짝** 을 닫고(slice 12 가 남긴 import-detail 짝보다 오래됐다 — "가장
  오래된 짝부터" 선례는 slice 19 가 세웠다), 아울러 T-1536 잔여 인벤토리가 (B) 후보로 유보해 둔 3 route
  중 하나를 **측정으로 해소** 한다. 앞 slice 와의 차이는 **구조 축 3 개** 다 — ① **합성 route 의 구성
  성분 query 를 분리해 재는 첫 페어**: slice 7 이 잰 `:id/persons` 는 `PartService.findPersonsByPartId`
  가 **내부에서 `this.findById(partId)` 를 먼저 호출** 한 뒤 자식 `findByPartId` 를 태우는 요청당 상수
  2 query 경로인데, 본 route 는 **그 첫 query 만 단독으로 노출된 route** 다(slice 19 의 페어가 같은
  테이블의 집합 ↔ 단일 row 였던 것과 달리 본 페어는 **합성 경로 ↔ 그 부분 경로** 다. slice 7 파일 자체는
  수정하지 않고 대조군으로만 호출한다). ② **404 를 공유하는 두 route 의 거절 경로 관측**: 두 route 의
  404 는 같은 `findById` 의 null 분기 **한 곳** 에서 나오며 자식 목록 route 의 404 도 자식 조회가 아니라
  **부모 검증 query** 가 낸다 — 같은 미존재 id 를 두 route 에 주입해 둘 다 404 로 수렴함을 관찰한다.
  ③ **규모 축이 "자식 row 수" 인 단건 무반응 관찰**: slice 19 의 규모 축은 같은 테이블의 총 row 수였지만
  본 route 의 규모 축은 **자식 `Person` 의 수** 이고, `include` 0 이라 자식 0 건 Part 와 자식 40 건 Part 의
  응답이 **동일한 4 scalar 컬럼 형태** 로 고정돼 payload 가 자식 fan-out 에 반응하지 않는다. 두 route 의
  대소 관계도, 자식 규모 두 표본의 대소·증가율도 **단언하지 않고 관찰 기록만** 남긴다(slice 3 선례 —
  wall-clock 비결정성). **새 축으로 주장하지 않는** 항목도 함께 박제한다 — PK 직행 `findUnique` 자체는
  slice 11·14·19 와 동일, repository 의 null 분기를 service 가 `NotFoundException` 으로 바꾸는 404 는
  slice 11·19 와 동일, `include` 0 의 미조인 SELECT 는 slice 11·19 와 동일, `PartController` 의 guard
  부재로 인한 401 / 403 분기의 **구조적 부재** 는 slice 1·2·7·19 와 동일하며, 한 controller 의 조회 route
  전량 실측 도달도 Group slice 18 · Person slice 19 선례가 있어 새 축이 아니다. 인증·인가 negative 는
  guard 미부착이라 만들지 않고(그 사실을 spec 헤더에 명시), 대신 미존재 id 반복의 **errorRate 임계 위반**
  과 200 혼합 표본의 `0 < er < 1` · 비현실적 임계 주입(`p95MaxMs: 0`)의 결정론적 fail · **빈 DB** 임의 id
  의 500 아닌 404 · 비-cuid/빈 대체 토큰 id 의 404 · 삭제된 id 재조회의 **200 → 404 전이** · 대조군 Part
  공존 시 **name 혼입 0** · 응답의 `persons` 키 부재로 본 미조인 SELECT 증거를 덮는다. mock 짝은
  `part-detail-read.perf-spec.ts`(T-0848)이며 **수정하지 않는다**(그 spec 의 retire·통합 판단은 T-1536 이
  명시 유보한 별도 주제 — mock 잔존 계수 불변). `afterEach` 는 `truncateAll` 로 도메인 테이블을 비우고
  `Part.name`·`Person.email` 의 `@unique` 는 seed 호출별 index 접미로 회피한다(`db-truncate.ts` 수정 0).
  여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code · schema ·
  임계값 불변 — `Part` index 추가 판단은 본 실측을 근거로 하는 별도 task).
- **slice 21** — `import-detail-read-realdb.perf-spec.ts` (T-1541) — 실측 대상을 **새 endpoint 도메인이
  아니라 slice 12 가 이미 잰 `ImportController` 의 단건 상세 route**(`GET /api/admin/import/:id`)로 넓혀
  조회 1 route 를 추가 측정한다(도메인 계수는 14 불변 — Import 는 slice 12 에서 이미 도메인, 조회 route
  29 → 30. slice 15·17·18·19·20 과 같은 셈법이며 slice 16 과는 반대다). slice 12 는 같은 controller 의
  정적 route 2 개(`modes` · `running`) 만 재고 단건 `:id` 는 `no-such-job-id` **404 negative** 로만
  두드려, T-1536 잔여 인벤토리가 본 route 를 (B) 후보의 **"보수 분류"** 로 남겨 뒀는데 본 slice 가 그
  유보를 **happy-path 실측으로 해소** 한다(slice 19 가 세운 선례의 두 번째 사례이자, slice 20 이 닫은
  Part 짝 다음으로 오래된 미해소 짝이다). 앞 slice 와의 차이는 **구조 축 1 개** 다 — **같은 depth 의 정적
  세그먼트 2 종과 동적 `:id` 의 라우팅 우선순위 실측**: `ImportController` 는 `@Get("running")` ·
  `@Get("modes")` 를 `@Get(":id")` **앞에** 선언해 문자열 `"modes"` / `"running"` 을 id 자리에 넣어도
  404 가 아니라 **정적 route 가 이겨 200** 이 된다 — 즉 **`:id` 로는 도달 불가능한 id 공간이 존재** 한다
  (slice 10 의 `ExportController` 는 같은 depth 정적이 `running` 1 종이고 나머지 정적은 `:id` 하위라, 같은
  depth 정적이 **2 종** 인 대상은 본 slice 가 처음이다). 세 route(단건 `:id` · `modes` · `running`)의 p95 는
  모두 임계 미만으로 단언하되 **대소 관계는 단언하지 않고 관찰 기록만** 남긴다(slice 3 선례 — wall-clock
  비결정성). **새 축으로 주장하지 않는** 항목도 함께 박제한다 — `findUniqueOrThrow` 의 P2025 →
  `NotFoundException` 변환은 slice 10 `ExportJob.findJob` 과 동일, job status enum 4 상태 표본도 slice 10 과
  동일, `JwtAuthGuard + RolesGuard` + `@Roles("Admin")` 의 401 / 403 layer 는 slice 10·11·12 와 동일,
  PK 직행 단건 조회 자체는 slice 11·14·19·20 과 동일하며, 한 controller 의 조회 route 전량 실측 도달도
  Group slice 18 · Person slice 19 · Part slice 20 선례가 있어 새 축이 아니다. negative 는 cookie 부재
  **401** · 변조 토큰 **401**(403 아님) · User tier **403**(guard 레벨 DB 미도달) · 미존재 id 반복의
  **errorRate 임계 위반** 과 200 혼합 표본의 `0 < er < 1` · 비현실적 임계 주입(`p95MaxMs: 0`)의 결정론적
  fail · **빈 DB** 임의 id 의 500 아닌 404 · 비-cuid/빈 대체 토큰 id 의 404 · 대조군 job 공존 시 **id·mode
  혼입 0** 과 응답의 `requestedBy` 키 부재(미조인 SELECT 증거)로 덮고, 분기 축으로는 nullable scalar 3 개
  (`error`/`artifactRef`/`restoredRowCount`)가 **전부 NULL 인 job vs 전부 채워진 job** 의 응답이 각각
  null / 실값으로 갈리면서도 **같은 10 컬럼 shape** 을 유지함을 단언한다. mock 짝은
  `import-detail-read.perf-spec.ts` 이며 **수정하지 않는다**(그 spec 의 retire·통합 판단은 T-1536 이 명시
  유보한 별도 주제 — mock 잔존 계수 불변). `afterEach` 는 `truncateAll` 후 actor 를 **원본 id 그대로**
  재삽입한다(`ImportJob.requestedById` 의 `Restrict` FK 충족 — `db-truncate.ts` 수정 0). 여기서도 **측정만
  하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code · schema · 임계값 불변 —
  `ImportJob` index 추가 판단은 본 실측을 근거로 하는 별도 task).
- **slice 22** — `app-root-read-realdb.perf-spec.ts` (T-1543) — 실측 대상을 `AppController` 의 root
  health read(`GET /api`)로 넓혀 조회 1 route 를 추가 측정하고, 부하계획 `§ 5` item 5 인벤토리의
  **(B) 후보 1 건** 을 측정으로 해소해 (B) 를 **1 → 0** 으로 만든다. `AppController` 는 실측 endpoint
  도메인 14 개에 **없던 새 도메인** 이라 도메인 **14 → 15** · 조회 route **30 → 31** 로 **둘 다 +1**
  이다(도메인·route 가 함께 늘던 **slice 16 과 같은 셈법** — "도메인 불변 · route 만 +1" 이던
  slice 15·17·18·19·20·21 셈법이 아니다). 앞 slice 와의 차이는 **구조 축 2 개** 다 — ① **DB 미접촉
  route 의 latency floor**: slice 1~21 은 전부 요청 경로가 실 Prisma round-trip 을 최소 1 회 수행했지만
  `getRoot()` 는 `AppService.getStatus()` 의 고정 상수 `APP_STATUS_MESSAGE` 를 동기 반환할 뿐이라 실
  `AppModule` + 실 Prisma 연결이 살아 있어도 요청 경로가 DB 를 **전혀 건드리지 않는다** — 따라서 본
  실측값은 같은 harness · 같은 부트스트랩 조건에서의 **framework + HTTP 왕복만의 하한** 이며, 앞선
  21 slice 의 p95 를 읽을 때 "얼마가 DB 몫인가" 를 가늠할 대조 기준선이 된다(DB 미접촉 사실 자체는
  **전량 truncate 전 / 후 응답 불변** 으로 실증한다). mock 판 `app-root-read.perf-spec.ts`(T-0859)는
  `AppService` 를 mock 으로 갈아끼운 **collector 배선 floor** 였을 뿐 실 부트스트랩 floor 가 아니었다.
  ② **guard layer 가 아예 없는 첫 실 DB slice**: slice 1~21 은 모두 `JwtAuthGuard`(+ 상당수는
  `RolesGuard` + `@Roles("Admin")`)를 통과하는 route 라 cookie 발급이 전제였는데, 본 route 는 인증 없이
  200 이고 변조 쿠키를 붙여도 401 이 아니며 User tier actor 도 403 이 아니다 — **다른 slice 와 정반대의
  negative** 다. 본 spec 은 **어떤 wall-clock 값끼리도 대소를 단언하지 않는다** — 다른 route · 다른
  slice · 같은 spec 안의 두 측정 구간끼리도 마찬가지이며 "floor 이므로 더 빠르다" 류 단언은 금지다
  (T-0877 이 `app-root-measure-confirm.perf-spec.ts` 에서 wall-clock 대소를 단언해 T-0880 의 PR CI 를
  2 회 연속 red 로 만들고 T-0881 이 주입 clock 으로 결정론화해야 했던 이력). 허용되는 latency 단언은
  **고정 임계 3000ms 대비 pass** 와 **주입 임계 0 대비 fail** 뿐이고 floor 성격은 주석과 본 서술로만
  표현한다. **새 축으로 주장하지 않는** 항목도 함께 박제한다 — collector / assert 배선 재사용은
  slice 1~21 과 동일, `p95MaxMs: 0` 주입 fail 분기와 인위 non-2xx 주입 errorRate 분기는 mock slice
  시절부터의 관용 수단이며, `buildBaselineReport` 관찰 전용(디스크 write 0)도 전 slice 공통이고,
  guard 미부착 controller 자체도 slice 1·2·7·19·20 선례가 있다. error path 는 `getRoot()` 에 예외 경로가
  **구조적으로 부재** 하므로(항상 200 상수 반환) **인접 미매칭 경로**(`GET /api/no-such-route`)의 404 ·
  500 아님 · raw stack 미노출로 커버하고, 분기 cover 는 `assertS2Threshold` 의 pass / fail 양쪽 도달과
  **truncate 전 / 후 대조 쌍** 으로 채운다(`getRoot()` 자체는 분기 0). negative 는 (a) cookie 부재
  **200**(401 아님) · (b) 변조 토큰 **200**(401 / 403 아님) · (c) User tier **200**(403 아님, Admin 과
  동일 응답) · (d) `p95MaxMs: 0` 주입의 결정론적 fail · (e) 인위 non-2xx(500 · 503) 주입의 errorRate
  위반과 200 혼합 표본의 `0 < er < 1` · (f) query string 부착(`GET /api?x=1`)의 200 + 동일 문자열 ·
  (g) `POST /api` 의 405 아닌 **404** 7 종으로 덮는다. mock 짝 `app-root-read.perf-spec.ts` 와
  `app-root-measure-confirm.perf-spec.ts` 는 **수정하지 않는다**(그 spec 들의 retire·통합 판단은 T-1536 이
  명시 유보한 별도 주제 — mock 잔존 계수 불변). `afterEach` 는 `truncateAll` 후 actor 를 **원본 id
  그대로** 재삽입한다(분기 대조 쌍이 test 중간에 전량 truncate 를 수행하므로 — `db-truncate.ts` 수정 0).
  여기서도 **측정만 하며 소규모 표본이라 REQ-047 실 scale 부하가 아니다**(production code · schema ·
  임계값 불변 — health endpoint 에 guard 가 없다는 사실도 보안 결함으로 재판정하지 않는다).
- **slice 23** — `person-list-scale-realdb.perf-spec.ts` (T-1545) — slice 1 과 **같은 route**
  (`GET /api/persons`)를 **다른 규모** 로 측정한다. 따라서 **새 endpoint 도 새 도메인도 아니며**
  실측 도메인 **15 불변** · 조회 route **31 불변** · 부하계획 `§ 5` item 5 인벤토리 (A) **30** /
  (B) **0** / (C) **0** 도 **전부 불변** 이다(slice 22 처럼 도메인·route 가 늘던 셈법이 아니다).
  slice 1 의 고정 20 row 한 표본을 소규모(**20 row**) vs 대규모(**200 row**) 두 표본으로 넓힌
  **규모 축** 이며, 같은 규모 축인 slice 3 과 **비용 항목이 다르다** — slice 3 은 membership 수 =
  요청당 query 수인 **N+1 축** 이었고, `findActive` 는 단일 SELECT 라 query 수가 1 로 고정이고
  **결과 집합 크기(직렬화·전송 비용)** 만 커진다. 여기에 `active: true` **120 row** + `active: false`
  **80 row** 혼합 표본을 더해 **응답 크기(120)와 스캔 대상(200)이 분리** 되는 **필터 선택도** 축을
  실 DB slice 중 처음 증거화한다(`PersonController` 는 guard 미부착 · 필수 query-param 분기 0 이라
  인증·권한 노이즈 0 에서 row 수 → latency 만 분리 관측된다). 본 spec 도 **어떤 wall-clock 값끼리도
  대소를 단언하지 않는다**(`large > small` 금지 — slice 3·22 와 동일 이유). 허용 단언은 고정 임계
  3000ms 대비 pass 와 주입 임계 `p95MaxMs: 0` 대비 fail 뿐이고 규모 비교는 `buildBaselineReport` +
  `formatBaselineLine` 관찰 3 줄로만 남긴다(디스크 write 0). 본 route 는 에러 경로가 **구조적으로
  부재**(항상 200)라 errorRate 위반 분기는 **인위 non-2xx 주입**(전량 503 → er=1, 실 200 혼합 →
  0 < er < 1)으로 도달시키고, negative 는 (a) 빈 테이블 **200 + `[]`**(404 아님) · (b) 전량 inactive
  **200 + `[]`**(테이블 row 는 잔존) · (c) 위 인위 non-2xx 2 종 · (d) 대규모 표본의 **truncate 전/후
  대조 쌍**(응답 200 건 → 0 건, 둘 다 status 200) · (e) `p95MaxMs: 0` 주입의 결정론적 fail 로 덮는다.
  slice 1·3 파일과 mock 짝 `person-read.perf-spec.ts` 는 **수정하지 않는다**(retire 판단은 T-1536 이
  명시 유보한 별도 주제 — mock 잔존 계수 불변). 여기서도 **측정만 하며** index 추가 · 쿼리 최적화 ·
  페이지네이션은 관측 결과와 무관하게 범위 밖이고, 본 slice 의 "대규모" 는 **상대 비교용 표본** 일
  뿐 **REQ-047 실 scale 부하 검증이 아니다**.
- **slice 24** — `assessment-list-scale-realdb.perf-spec.ts` (T-1547) — slice 4 와 **같은 route**
  (`GET /api/assessments`)를 **다른 규모** 로 잰다. 따라서 실측 도메인 **15 불변** · 조회 route
  **31 불변** · 부하계획 `§ 5` item 5 인벤토리 (A) **30** / (B) **0** / (C) **0** 이 **전부 불변**
  이고(slice 23 과 같은 셈법) 규모 축 route 만 **2 → 3** 이 된다. 앞선 규모 축 slice 3 · 23 의
  controller 가 **둘 다 guard 미부착** 이었던 것과 달리 본 slice 는 `JwtAuthGuard` + `RolesGuard` +
  `@Roles("User")` 를 실 JWT 로 통과하는 **첫 규모 축** 이라, guard 비용이 결과 집합 규모와 무관한
  상수인지가 소규모(**10 row**) vs 대규모(**200 row**) 두 표본으로 처음 관찰된다. 필터 축도 다르다 —
  slice 23 의 선택도는 무-index boolean(`active`)이라 스캔 대상이 그대로였지만, 본 slice 는
  `@@index([personId, period, periodStart])` 의 **prefix 2 단**(타 person **150 row** 배제 →
  `period=week` **60 건**)이라 "테이블 총 row(350)는 크고 응답은 작다" 를 index 경유로 만드는 첫
  표본이다. 여기서도 **어떤 wall-clock 값끼리도 대소를 단언하지 않고**(`large > small` 금지) 관찰
  4 줄로만 남기며, negative 는 (a) `personId` 누락 **400** · (b) 매칭 0 건의 **200 + `[]`**(404 아님,
  row 는 잔존) · (c) cookie 미부착 **401** · (d) 인위 non-2xx 의 errorRate 위반과 200 혼합의
  `0 < er < 1` · (e) truncate 전/후 대조 쌍(200 → 0 건, 둘 다 200 — actor 는 **원본 id 그대로** 재-seed)
  으로 덮는다. slice 4 · 23 파일과 mock 짝은 **수정하지 않고** 여기서도 **측정만 한다** — index 추가 ·
  쿼리 최적화 · 페이지네이션은 범위 밖이고 "대규모" 는 **상대 비교용 표본** 일 뿐 **REQ-047 실 scale
  부하 검증이 아니다**.
- **slice 25** — `summary-measure-confirm-realdb.perf-spec.ts` (T-1549) — slice 6 과 **같은 route**
  (`GET /api/summaries?personId=`)를 **다른 harness** 로 잰다. 고유 축은
  **`measureAndConfirmBaseline`(measure→confirm-or-compare top loop)의 첫 실 DB 배선** 이다 — 기존
  measure→confirm spec 4 개(T-0877 · T-0880 · assessment · contribution)는 전부 service `useValue`
  mock + `overrideGuard` 라, 기준 부재의 **최초 확정 write(established)** 와 존재 시 **로드·비교
  (compared)** 두 국면이 **실 Postgres round-trip 지연을 포함한 표본** 에서 성립하는지는 미관측이었다.
  slice 6 은 같은 route 를 실 DB 로 쟀지만 **관찰 전용** 이라 baseline 을 디스크에 쓰지 않았고, 본
  slice 가 **route 하나에 한해** 그 경계를 처음 넘는다. 계수는 perf-spec 총계 **58 → 59** 와
  `*realdb*` **24 → 25** 만 늘고(신규 파일명에 `read` 가 없어 `*read*` **51 불변** · `*read*realdb*`
  **21 불변** — slice 3 · 23 · 24 와 같은 셈법), 같은 route 재측정이라 재분류 0 이 slice 23 · 24 에
  이어 **3 연속** 이다 — 실측 도메인 **15 불변** · 조회 route **31 불변** · 인벤토리 (A) **30** /
  (B) **0** / (C) **0** · mock 잔존 **30 불변** · **규모 축 route 3 불변**(본 slice 는 규모 축이 아니다).
  검증은 **응답 길이가 seed row 수(week 3 + month 2)와 정확히 일치** 함으로 실 query 발화를 입증하고,
  **wall-clock 대소도 `comparison.regressed` 값도 단언하지 않는다**(관찰 기록만 — flaky 차단).
  error path 는 공백-only `baseDir` 의 `RangeError` + **그때 파일 생성 0**(순서 계약의 write 부작용 0
  실증) · 손상 JSON 의 `SyntaxError` 2 종, negative 는 (a) `personId` 누락 **400** 표본도 확정 write
  수행 · (b) 매칭 0 건 **200 + `[]`** · (c) cookie 미부착 **401** · (d) 인위 non-2xx 의 `errorRate = 1`
  과 200 혼합의 `0 < errorRate < 1` · (e) truncate 전/후 대조 쌍(5 → 0 건, 둘 다 200) 5 종이다. mock
  짝과 slice 6 파일은 **수정하지 않으며**(대체 아닌 보완 — retire 판단은 T-1536 유보), 본 baseline 은
  **임시 디렉토리 1 회성** 이라 저장소 오염 0 이고 **저장소 체크인 기준 baseline(`§ 5` #5) · CI job
  편입(`§ 5` #4) · 임계 fix 는 전부 미착수 그대로** 다. 여기서도 **측정만 하며** production code ·
  schema · 임계값 불변이고 **REQ-047 실 scale 부하 검증이 아니다**.
- **slice 26** — `assessment-measure-confirm-realdb.perf-spec.ts` (T-1551) — slice 25 가 연 **baseline
  확정 축의 두 번째 route** 다. 같은 `measureAndConfirmBaseline` harness 를 `GET /api/assessments`
  (slice 4 · 24 와 같은 route, 다른 harness)로 넓히며, 고유 축은 **`period` optional query 분기의 첫
  실 DB baseline 배선** 이다 — slice 25 의 route 는 단일 필수 param 뿐이었지만 본 route 는 `personId`
  필수(부재 → **400**) 에 더해 `period` 지정 / 미지정 두 요청이 서로 다른 service 위임 경로를 타고,
  그 분기가 **실 query 지연을 포함한 표본** 에서 established(최초 확정 write) · compared(로드·비교)
  **양 국면 모두** 에 도달하는지는 미관측이었다(mock 짝 T-0882 는 service 대체 + guard 우회, 실 DB 짝
  slice 4 · 24 는 **관찰 전용** 이라 baseline 미확정). 검증은 **응답 길이가 seed row 수와 정확히 일치**
  함으로 실 query 발화를 입증하되 **미지정 5 건 · `period=week` 3 건으로 서로 다르게** seed 해 분기
  대조를 만들고, **wall-clock 대소도 `comparison.regressed` 값도 단언하지 않는다**(관찰 기록만).
  error path 는 공백-only `baseDir` 의 `RangeError` + **그때 파일 생성 0** · 손상 JSON 의 `SyntaxError`
  2 종이고 negative 는 slice 25 와 같은 5 종((a) `personId` 누락 400 · (b) 매칭 0 건 **200 + `[]`** ·
  (c) cookie 미부착 401 · (d) `errorRate = 1` 과 `0 < errorRate < 1` · (e) truncate 전/후 대조 쌍)이다.
  계수는 perf-spec 총계 **59 → 60** 과 `*realdb*` **25 → 26** 만 늘고 신규 파일명에 `read` 가 없어
  `*read*` **51 불변** · `*read*realdb*` **21 불변**(slice 3 · 23 · 24 · 25 에 이은 **다섯 번째** 사례),
  같은 route 재측정이라 재분류 0 이 **4 연속** 이다 — 도메인 **15** · 조회 route **31** · (A) **30** /
  (B) **0** / (C) **0** · mock 잔존 **30** · **규모 축 route 3** 전부 불변. mock 짝 · slice 4 · 24 는
  **수정하지 않으며**(대체 아닌 보완 — retire 판단은 T-1536 유보), baseline 은 **임시 디렉토리 1 회성**
  이라 저장소 오염 0 이고 **체크인 기준 baseline(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 미착수
  그대로** 다. 여기서도 **측정만 하며** production code · schema · 임계값 불변이고 **REQ-047 실 scale
  부하 검증이 아니다**.
- **slice 27** — `contribution-measure-confirm-realdb.perf-spec.ts` (T-1553) — slice 25 가 열고 slice 26
  이 이어받은 **baseline 확정 축의 세 번째 route** 다. 같은 `measureAndConfirmBaseline` harness 를
  `GET /api/contributions?assessmentId=`(slice 5 와 같은 route, 다른 harness)로 넓히며, 고유 축은
  **`Person → Assessment → Contribution` 3-level FK chain 의 첫 실 DB baseline 배선** 이다 — 앞 두
  slice 와 달리 **부모 `Assessment` 의 id 로 자식 컬렉션을 긁어** seed 비용·join 경로가 다르고, 그
  구조가 **실 query 지연을 포함한 표본** 에서 established · compared **양 국면 모두** 에 도달하는지는
  미관측이었다(mock 짝 T-0883 은 service 대체 + guard 우회, slice 5 는 **관찰 전용**). 이로써
  measure→confirm mock spec 4 개 중 **평가-결과 read 표면 3 개** 가 실 DB 짝을 갖는다. 검증은 **응답
  길이 = 그 부모의 seed 자식 수** 이고 두 수가 **서로 다름**(**5** vs **3**)으로 실 query 발화와 부모
  필터의 분해력을 함께 입증하되 **wall-clock 대소도 `comparison.regressed` 도 단언하지 않는다**(관찰
  기록만). error path 2 종(공백-only `baseDir` 의 `RangeError` + **그때 파일 생성 0** · 손상 JSON 의
  `SyntaxError`)과 negative 5 종((a) `assessmentId` 누락 **400** · (b) 존재하지 않는 id 의 **200 +
  `[]`** · (c) cookie 미부착 **401** · (d) `errorRate = 1` 과 `0 < er < 1` · (e) truncate 전/후 대조
  쌍)은 slice 25 · 26 을 승계한다. 계수는 perf-spec 총계 **60 → 61** · `*realdb*` **26 → 27** 만 늘고
  신규 파일명에 `read` 가 없어 `*read*` **51 불변** · `*read*realdb*` **21 불변**(slice 3 · 23 · 24 ·
  25 · 26 에 이은 **여섯 번째** 사례), 같은 route 재측정이라 재분류 0 이 **5 연속** 이다 — 도메인 **15**
  · 조회 route **31** · (A) **30** / (B) **0** / (C) **0** · mock 잔존 **30** · **규모 축 route 3** 전부
  불변. mock 짝 · slice 5 는 **수정하지 않으며**(대체 아닌 보완 — retire 판단은 T-1536 유보), baseline
  은 **임시 디렉토리 1 회성** 이라 저장소 오염 0 이고 **체크인 기준 baseline(`§ 5` #5) · CI job 편입
  (`§ 5` #4) · 임계 fix 는 미착수 그대로** 다. 여기서도 **측정만 하며** production code · schema ·
  임계값 불변이고 **REQ-047 실 scale 부하 검증이 아니다**.
- **slice 28** — `app-root-measure-confirm-realdb.perf-spec.ts` (T-1555) — **baseline 확정 축의 네 번째
  route** 다. 같은 `measureAndConfirmBaseline` harness 를 `AppController` 의 root health read
  `GET /api`(slice 22 와 같은 route, 다른 harness)로 넓히며, 고유 축은 두 가지다. ① **DB 미접촉 route
  위의 첫 baseline 확정** — slice 25 ~ 27 의 표본은 전부 요청 경로가 실 Prisma round-trip 을 최소
  1 회 수행했지만 `getRoot()` 는 `AppService.getStatus()` 의 고정 상수를 동기 반환할 뿐이라, 실
  `AppModule` + 실 Prisma 연결이 살아 있어도 요청 경로가 DB 를 **전혀 건드리지 않는다**. 따라서 본
  baseline 은 **framework + HTTP 왕복만의 하한** 이고 앞 세 route 의 baseline 에서 "얼마가 DB 몫인가"
  를 가늠할 대조 기준선이 된다(slice 22 는 같은 route 를 **collector 개별 배선** 으로만 쟀고, 그 위의
  top loop + 실 fs baseline round-trip 은 본 slice 가 처음이다). ② **guard layer 가 없는 첫
  measure→confirm 실 DB slice** — cookie 미부착도 변조 쿠키도 401/403 이 아니라 **200** 이라 앞 세
  slice 와 **정반대의 negative** 다. 검증은 **전량 truncate 전 / 후 양쪽에서 established · compared
  두 국면 모두 도달 + 200·상수 문자열 불변** 으로 DB 미접촉을 실증하며(분기 판정은 baseline 파일
  존재 여부라 latency 무의존), **wall-clock 대소도 `comparison.regressed` 값도 단언하지 않는다**(관찰
  기록만 — T-0877/T-0880 flaky 사고 재발 차단). error path 2 종(공백-only `baseDir` 의 `RangeError` +
  **그때 파일 생성 0** · 손상 JSON 의 `SyntaxError`)은 slice 25 ~ 27 을 승계하고, negative 5 종은
  (a) cookie 미부착 **200** · (b) 변조 토큰 쿠키 **200** · (c) 인접 미매칭 경로 **404**(500 아님) ·
  성공 표본 0 · raw stack 미노출 · (d) 인위 non-2xx 의 `errorRate = 1` 과 200 혼합의
  `0 < errorRate < 1` · (e) `POST /api` 의 **404**(405 아님) 로 본 route 에 맞춰 갈아 끼웠다. 계수는
  perf-spec 총계 **61 → 62** · `*realdb*` **27 → 28** 만 늘고 신규 파일명에 `read` 가 없어 `*read*`
  **51 불변** · `*read*realdb*` **21 불변**(slice 3 · 23 · 24 · 25 · 26 · 27 에 이은 **일곱 번째**
  사례), 같은 route 재측정이라 재분류 0 이 **6 연속** 이다 — 도메인 **15** · 조회 route **31** ·
  (A) **30** / (B) **0** / (C) **0** · mock 잔존 **30** · **규모 축 route 3** 전부 불변(본 slice 는
  seed 자체가 불요한 DB 미접촉 route 라 규모 축이 아니다). 이로써 measure→confirm mock spec
  **4 개(summary · assessment · contribution · app-root) 전부** 가 실 DB 짝을 갖는다 — 다만 그 사실은
  **축의 소진이 아니다**: 본 baseline 도 **임시 디렉토리 1 회성** 이고 **체크인 기준 baseline
  (`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 전부 미착수 그대로** 이며 잔여 4 축이 그대로
  존속한다. mock 짝(T-0877) · slice 22 는 **수정하지 않으며**(대체 아닌 보완 — retire 판단은 T-1536
  유보), 여기서도 **측정만 하며** production code · schema · 임계값 불변이고 **REQ-047 실 scale 부하
  검증이 아니다**.
- **slice 29** — `person-measure-confirm-realdb.perf-spec.ts` (T-1557) — **baseline 확정 축의 다섯 번째
  route** 다. 같은 `measureAndConfirmBaseline` harness 를 `PersonController` 의 목록 read
  `GET /api/persons`(slice 1 · 23 과 같은 route, 다른 harness)로 넓히며, 고유 축은 세 가지다.
  ① **guard 미부착 × DB 접촉 조합의 첫 baseline 확정(2×2 격자의 마지막 칸)** — slice 25 ~ 27 은
  `JwtAuthGuard` 통과 + 실 Prisma 왕복, slice 28 은 guard 미부착 + **DB 미접촉** 이었다. 본 route 는
  guard 가 없으면서 `findActive()` 가 실 SELECT 를 발화하므로 baseline 이 **인증 layer 노이즈 0 인
  상태의 순수 DB 왕복 몫** 을 담아, slice 28 의 framework-only 하한과 "얼마가 DB 몫인가" 를 같은
  harness 위에서 처음 대조할 수 있다. ② **soft-delete 필터가 결과 집합을 좁히는 route
  위의 첫 measure→confirm** — active **3** 과 inactive **2** 를 **서로 다른 개수** 로 섞어 seed 하고
  established · compared **두 국면 모두** 에서 응답 길이가 **active 수와 정확히 일치**(inactive 0 건
  노출) 함을 실 row 수 대조와 함께 단언해, slice 25 ~ 27 의 "응답 길이 = seed row 수" 보다 한 단계
  강한 필터 분해력을 보인다. ③ **mock measure→confirm 짝이 없는 첫 실 DB baseline 확정** — 본 route 의
  기존 perf-spec 은 collector 배선(T-0833) · 관찰 전용(slice 1) · 규모 축(slice 23) 뿐이라 top loop 판본이
  **mock 에도 실 DB 에도 없었다**. 여기서도 **wall-clock 대소도 `regressed` 값도 단언하지 않는다**.
  error path 2 종(공백-only `baseDir` 의 `RangeError` + **그때 파일 생성 0** · 손상 JSON 의 `SyntaxError`)은
  slice 25 ~ 28 을 승계하고, negative 5 종은 (a) cookie 미부착 **200** · (b) 변조 토큰 쿠키 **200** ·
  (c) 전량 inactive seed 의 **200 + `[]`**(404 아님) · (d) 미존재 id 의 **404**(500 아님) · 성공 표본 0 ·
  `errorRate = 1` 과 200 혼합의 `0 < errorRate < 1` · (e) `truncateAll` 직후의 **빈 배열 + compared
  도달** 로 갈아 끼웠다. 계수는 perf-spec 총계 **62 → 63** · `*realdb*` **28 → 29** 만 늘고
  신규 파일명에 `read` 가 없어 `*read*` **51 불변** · `*read*realdb*` **21 불변**(slice 3 · 23 · 24 ·
  25 · 26 · 27 · 28 에 이은 **여덟 번째** 사례), 같은 route 재측정이라 재분류 0 이 **7 연속** 이다 —
  도메인 **15** · 조회 route **31** · (A) **30** / (B) **0** / (C) **0** · mock 잔존 **30** · **규모
  축 route 3** 전부 불변(본 slice 는 measure→confirm harness 축이라 규모 축이 아니다 — 같은 route 의
  규모 대조는 slice 23 이 이미 태웠다). baseline 확정 축이 **다섯 route 에 도달** 했으나 그것은
  **축의 소진이 아니다**: 다섯 baseline 모두 **임시 디렉토리 1 회성** 이고 **체크인 기준 baseline
  (`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 전부 미착수 그대로** 이며 잔여 4 축이 그대로
  존속한다. 기존 person perf-spec 3 개(T-0833 · slice 1 · slice 23)는 **수정하지 않으며**(대체 아닌 보완
  — retire 판단은 T-1536 유보), production code · schema · 임계값 불변이고 **REQ-047 실 scale 부하
  검증이 아니다**.
- **잔여** — 실측 범위는 endpoint 15 개(조회 route 31)뿐이다. perf-spec 63 개 중 read 계열 glob 은 51 개
  이고 그 중 실 DB round-trip 은 21 개(slice 1·2·4·5·6·7·8·9·10·11·12·13·14·15·16·17·18·19·20·21·22)이며
  나머지 **mock 잔존 30 개는 이번 slice 로도 불변** 이다 — 신규 파일명(`person-measure-confirm-realdb`)에는
  `read` 가 **없어** `*read*` glob **51 불변** · `*read*realdb*` **21 불변** 이라 피감수·감수가 둘 다
  그대로이기 때문이다(**slice 3 과 같은 셈법의 여덟 번째 사례**). read glob 밖의 slice 3·23·24·25·26·27·28·29 까지
  더하면 실 DB round-trip spec 은 **29 개**, perf-spec 총계는 **63 개** 다. 부하계획 `§ 5` item 5 인벤토리의 (B) 는
  slice 22 에서 이미 **0** 이고 본 slice 는 새 route 가 아니라 (A) 30 / (B) 0 / (C) 0 · 도메인 15 ·
  조회 route 31 을 **전부 불변** 으로 둔다. 조회 route 실측이 인벤토리 열거 총계와 같은 31 이라는
  사실은 **조회 성능 검증이 끝났다는 뜻이 아니다** — ① 인벤토리 자체가 완전 열거를 주장하지
  않고(부하계획 `587 행`), ② (A) 부류 mock perf-spec **30 개의 retire 판단은 미착수** 이며,
  ③ **write / trigger route 는 애초에 이 목록 밖** 이고, ④ REQ-047 실 scale 부하 · baseline 확정 ·
  임계 fix · web 렌더 측정의 **4 잔여 축이 그대로 존속** 한다 — baseline 확정 축은 slice 25 의 **첫
  진입** · slice 26 · 27 · 28 · 29 의 **두·세·네·다섯 번째 route** 를 태웠을 뿐이고, 다섯 baseline 모두 **임시
  디렉토리 1 회성** 이라 축은 **소진되지 않았다**(체크인 기준 baseline · CI job 편입 · 임계 fix
  미착수 — measure→confirm mock 4 개가 전부 실 DB 짝을 가진 것도, mock 짝 없는 route 까지 태운 것도
  축의 해소와는 별개다). 규모 축도
  slice 3(`:id/persons` 의 N+1 규모)·slice 23(`/api/persons` 의 결과 집합 규모 + 필터 선택도)·
  slice 24(`/api/assessments` 의 인증 경유 + index prefix 2 단 선택도) **세 route 에 도달했을 뿐**
  이고(slice 25·26·27·28·29 는 규모 축이 아니라 3 불변), 나머지
  endpoint 의 규모 민감도와 REQ-047 실 scale 부하는 여전히 미측정이다. 남은 endpoint 의 실 DB
  cutover 는 endpoint 단위 후속 slice 로 이어간다.
- **로컬 실행 전제** — `docker compose up -d postgres` + `DATABASE_URL`(예:
  `postgresql://postgres:postgres@localhost:5432/assessment_test?schema=public`) export +
  `pnpm prisma migrate deploy` 후 `pnpm test:perf`. CI 는 `perf test` step 이
  `services.postgres` + migrate deploy + e2e **이후**라 전제를 자동 충족한다(workflow 편집
  불요 — 기존 `testRegex` 가 새 spec 을 자동 picking).
- **임계값 3000ms 는 불변** — `DEFAULT_P95_MAX_MS = 3000`(REQ-048)을 바꾸지 않는다. slice 1~24 는
  `buildBaselineReport` + `formatBaselineLine` 한 줄 **관찰 전용** 이고, **slice 25·26·27·28 만** `GET
  /api/summaries` · `GET /api/assessments` · `GET /api/contributions` · `GET /api` 를
  `confirmOrCompareBaseline` 로 **임시 디렉토리 1 회성** 확정·비교한다(저장소에
  baseline JSON 은 남지 않는다). 임계 fix · 체크인 기준 baseline · 나머지 cutover 는 별도 slice.

## 후속 harness (DB-backed baseline / S1·S3)

실 조회 endpoint round-trip latency **baseline 실측**(실 Postgres)·S1 배치 부하·S3 동시성
내성 harness 는 별도 follow-up 이며 이 primitive 를 import 한다(§5 item 1/3/5).
