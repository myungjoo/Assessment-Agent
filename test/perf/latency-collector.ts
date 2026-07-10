/**
 * S2 조회 latency 반복-호출 표본 수집기 harness (REQ-048, load-resilience-test-plan §2 S2 / §3).
 *
 * T-0828 이 신설한 `latency-metrics.ts` 순수 primitive(percentile/summarizeLatency/errorRate)를
 * 조합해, async 요청 함수를 반복 호출하며 각 호출의 latency 표본을 수집하고 REQ-048 임계
 * (p95 < 3s, error rate < 1%)의 pass/fail 을 판정하는 **순수 orchestration 로직**이다.
 *
 * 요청 함수를 인자로 주입받으므로 DB·앱 부트스트랩·네트워크에 무의존하며(요청 함수 안에서만
 * 실제 I/O 발생), monotonic clock 도 `opts.now` 로 주입 가능해 결정론적 테스트가 된다. 후속
 * DB-backed `*.perf-spec.ts` harness 는 이 수집기에 supertest 호출 함수만 넘기면 된다.
 */

import {
  buildBaselineReport,
  BaselineEnvMeta,
  BaselineReport,
  CompareOptions,
} from "./latency-baseline";
import {
  confirmOrCompareBaseline,
  ConfirmOrCompareResult,
} from "./latency-baseline-io";
import {
  summarizeLatency,
  errorRate,
  throughput,
  LatencySummary,
} from "./latency-metrics";

/** 요청 1회의 결과 — 2xx 성공 여부. `ok` 또는 HTTP `status`(200~299 성공) 중 하나로 판정. */
export interface RequestResult {
  ok?: boolean;
  status?: number;
}

/** 주입 가능한 async 요청 함수 — 매 호출이 1건의 read 요청에 대응. */
export type RequestFn = () => Promise<RequestResult>;

/** monotonic clock — 기본 `performance.now`, 테스트는 결정론적 stub 주입. */
export type NowFn = () => number;

/** `collectLatencySamples` 옵션. */
export interface CollectOpts {
  /** monotonic clock(ms). 기본 `performance.now`. 단조 증가 가정. */
  now?: NowFn;
}

/** `collectLatencySamples` 반환 — 수집한 latency 표본과 성공/실패 집계. */
export interface CollectResult {
  /** 각 호출의 latency(ms) 표본. 길이 === iterations. */
  samplesMs: number[];
  /** 총 호출 횟수(=== iterations). */
  total: number;
  /** non-2xx 또는 reject 로 분류된 실패 건수. */
  failures: number;
  /**
   * 전체 반복의 총 wall-clock 경과(ms) — 첫 요청 시작 직전 `now()` 와 마지막 요청
   * 종료 직후 `now()` 의 차(단조 clock 전제). iterations=0 이면 0.
   * §3 throughput(req/s) 관찰 지표 산출의 분모(elapsedMs/1000)로 쓰인다.
   */
  elapsedMs: number;
}

/** 요청 결과가 2xx 성공인지 판정 — `ok` 우선, 없으면 `status` 가 [200,300) 범위인지. */
function isSuccess(res: RequestResult): boolean {
  if (typeof res?.ok === "boolean") {
    return res.ok;
  }
  if (typeof res?.status === "number") {
    return res.status >= 200 && res.status < 300;
  }
  // ok/status 둘 다 없으면 실패로 간주(비정상 응답 방어).
  return false;
}

/**
 * `request` 를 `iterations` 회 순차 호출하며 각 호출을 monotonic clock 으로 계측한다.
 * 2xx 성공은 latency 표본으로 수집, non-2xx 및 reject(throw)는 failure 로 집계한다.
 * (실패 호출도 elapsed 는 측정되지만 latency 표본에는 넣지 않아 percentile 왜곡을 막는다.)
 *
 * @throws {TypeError} `request` 가 함수가 아닐 때.
 * @throws {RangeError} `iterations` 가 음수·비정수·NaN 일 때.
 * @throws {RangeError} 주입 clock 이 비단조(감소)여서 음수 elapsed 가 나올 때.
 */
export async function collectLatencySamples(
  request: RequestFn,
  iterations: number,
  opts: CollectOpts = {},
): Promise<CollectResult> {
  if (typeof request !== "function") {
    throw new TypeError("collectLatencySamples: request 는 함수여야 함");
  }
  if (!Number.isInteger(iterations) || iterations < 0) {
    throw new RangeError(
      `collectLatencySamples: iterations 는 0 이상 정수여야 함 (받은 값: ${iterations})`,
    );
  }
  const now: NowFn =
    typeof opts.now === "function" ? opts.now : () => performance.now();

  const samplesMs: number[] = [];
  let failures = 0;
  // 전체 반복의 wall-clock 경과 측정: 첫 요청 시작 직전과 마지막 요청 종료 직후의
  // now() 차. iterations=0 이면 루프가 돌지 않아 아래 초기값 0 이 그대로 반환된다.
  let firstStart = 0;
  let lastEnd = 0;

  for (let i = 0; i < iterations; i++) {
    const start = now();
    if (i === 0) {
      firstStart = start;
    }
    let success: boolean;
    try {
      const res = await request();
      success = isSuccess(res);
    } catch {
      // reject(throw)는 명시적으로 failure 로 집계(요청 실패 정책).
      success = false;
    }
    const end = now();
    lastEnd = end;
    const elapsed = end - start;
    if (elapsed < 0) {
      throw new RangeError(
        `collectLatencySamples: clock 이 비단조 — 음수 elapsed(${elapsed}ms)`,
      );
    }
    if (success) {
      samplesMs.push(elapsed);
    } else {
      failures++;
    }
  }

  // iterations=0 이면 firstStart===lastEnd===0 → elapsedMs 0. iterations>0 이면
  // 단조 clock 전제상 lastEnd >= firstStart 이므로 elapsedMs >= 0.
  const elapsedMs = iterations === 0 ? 0 : lastEnd - firstStart;

  return { samplesMs, total: iterations, failures, elapsedMs };
}

/** `assertS2Threshold` 임계 — 기본 p95 < 3000ms(REQ-048), errorRate < 0.01(§3). */
export interface S2Thresholds {
  /** p95 latency 상한(ms). 기본 3000. */
  p95MaxMs?: number;
  /** error rate 상한(0~1, exclusive 미만). 기본 0.01. */
  errorRateMax?: number;
}

/** `assertS2Threshold` 반환 — pass 여부 + 요약 지표 + 위반 사유. */
export interface S2Assertion {
  pass: boolean;
  summary: LatencySummary;
  errorRate: number;
  /**
   * 초당 처리 요청 수(req/s) 관찰값 — `throughput(성공 표본수, elapsedMs)`.
   * §3 표상 throughput 은 "baseline 후 fix" 관찰 지표라 **pass/fail 판정에는
   * 넣지 않는다**(관찰 전용). 성공 표본 0 이면 0.
   */
  throughput: number;
  /** 임계 위반 사유(한국어). pass=true 면 빈 배열. */
  reasons: string[];
}

/** REQ-048 기본 p95 상한(ms). */
const DEFAULT_P95_MAX_MS = 3000;
/** §3 기본 error rate 상한. */
const DEFAULT_ERROR_RATE_MAX = 0.01;

/**
 * 수집 결과를 `summarizeLatency` + `errorRate` 로 요약해 S2 임계 pass/fail 을 판정한다.
 * throw 하지 않고 판정 결과만 반환한다(호출부가 expect 로 검증). 위반 사유는 `reasons` 에
 * 한국어로 축적한다.
 *
 * 빈 표본(iterations=0 또는 전부 실패)이면 p95 는 NaN 이라 임계 비교가 불가 → 명시적 fail
 * 사유를 추가한다(측정 불가를 pass 로 오판하지 않도록).
 *
 * @throws {TypeError} `result` 가 유효한 CollectResult 형태가 아닐 때.
 * @throws {RangeError} thresholds 값이 음수·NaN·비수치일 때.
 */
export function assertS2Threshold(
  result: CollectResult,
  thresholds: S2Thresholds = {},
): S2Assertion {
  if (
    !result ||
    !Array.isArray(result.samplesMs) ||
    typeof result.total !== "number" ||
    typeof result.failures !== "number"
  ) {
    throw new TypeError(
      "assertS2Threshold: result 는 { samplesMs, total, failures } 형태여야 함",
    );
  }
  const p95MaxMs =
    thresholds.p95MaxMs === undefined
      ? DEFAULT_P95_MAX_MS
      : thresholds.p95MaxMs;
  const errorRateMax =
    thresholds.errorRateMax === undefined
      ? DEFAULT_ERROR_RATE_MAX
      : thresholds.errorRateMax;
  if (typeof p95MaxMs !== "number" || Number.isNaN(p95MaxMs) || p95MaxMs < 0) {
    throw new RangeError(
      `assertS2Threshold: p95MaxMs 는 0 이상 수치여야 함 (받은 값: ${p95MaxMs})`,
    );
  }
  if (
    typeof errorRateMax !== "number" ||
    Number.isNaN(errorRateMax) ||
    errorRateMax < 0
  ) {
    throw new RangeError(
      `assertS2Threshold: errorRateMax 는 0 이상 수치여야 함 (받은 값: ${errorRateMax})`,
    );
  }

  const summary = summarizeLatency(result.samplesMs);
  const er = errorRate(result.total, result.failures);
  // throughput 관찰값 산출(§3). 성공 표본수 = summary.count(= samplesMs.length).
  // T-0860 primitive 는 elapsedMs 를 **정수**로 요구하고(0 나눗셈 방어 계약),
  // count>0 && elapsedMs===0 이면 RangeError 를 던진다. 실 `performance.now()` 는
  // 소수 ms 를 내므로 collector 레벨에서 Math.round 로 정수화하되(관찰 지표라
  // sub-ms 정밀도 불요), **count>0 이면 반올림값을 최소 1ms 로 clamp** 해 primitive
  // 의 count>0 && elapsedMs===0 경계를 회피한다(AC 명시 정책: "성공 표본이 있으면
  // elapsedMs>0 가 보장되는 단조 clock 전제"의 collector-레벨 강제). 이로써
  // 극단적으로 빠른 mock 반복(총 <0.5ms)에서도 Infinity·RangeError 없이 안전하다.
  // legacy CollectResult(elapsedMs 필드 누락)는 undefined → 0 으로 취급: count===0
  // 이면 0 반환, count>0 이면 위 clamp 로 1ms 처리돼 결정론적 관찰값을 낸다.
  const rawElapsed =
    typeof result.elapsedMs === "number" ? result.elapsedMs : 0;
  const roundedElapsed = Math.round(rawElapsed);
  const safeElapsedMs =
    summary.count > 0 ? Math.max(roundedElapsed, 1) : roundedElapsed;
  const tput = throughput(summary.count, safeElapsedMs);
  const reasons: string[] = [];

  if (Number.isNaN(summary.p95)) {
    // 성공 표본 0 → p95 산출 불가. 측정 불가를 명시적 fail 로.
    reasons.push("측정 불가: 성공 표본이 없어 p95 를 산출할 수 없음");
  } else if (summary.p95 >= p95MaxMs) {
    reasons.push(
      `p95 임계 초과: p95=${summary.p95}ms >= 상한 ${p95MaxMs}ms (REQ-048)`,
    );
  }

  if (er >= errorRateMax) {
    reasons.push(`error rate 임계 초과: ${er} >= 상한 ${errorRateMax} (§3)`);
  }

  return {
    pass: reasons.length === 0,
    summary,
    errorRate: er,
    throughput: tput,
    reasons,
  };
}

/** `collectLatencySamples` 기본 반복 횟수 — S2 경량 스모크(단일-클라이언트, 부하 발생기 아님, §4.1). */
const DEFAULT_ITERATIONS = 30;

/**
 * `measureBaselineCandidate` 옵션 — measure 파라미터 묶음. 셋 다 optional(미지정 시 하위
 * primitive 기본치로 위임).
 */
export interface MeasureBaselineOpts {
  /** 반복 호출 횟수(collectLatencySamples 의 iterations). 기본 30(S2 경량 스모크 수준). */
  iterations?: number;
  /** S2 임계(p95/errorRate 상한). 기본 assertS2Threshold 기본치(p95<3000ms, errorRate<0.01). */
  thresholds?: S2Thresholds;
  /** monotonic clock 주입(테스트 결정성). 기본 performance.now — collectLatencySamples 로 위임. */
  now?: NowFn;
}

/**
 * S2 조회 latency 를 measure 해 candidate `BaselineReport` 를 생산하는 **얇은 조립 harness**다.
 * `collectLatencySamples`(표본 수집) → `assertS2Threshold`(임계 판정·throughput 관찰) →
 * `buildBaselineReport`(candidate 조립) 를 순서대로 이어붙인다. `confirmOrCompareBaseline`(T-0874)
 * 이 candidate 를 **소비**하는 진입점이라면, 본 함수는 candidate 를 **생산**하는 짝이다.
 *
 * 처리 순서(신규 판정·계산 로직 0 — 하위 primitive 를 조립만):
 *  1. `iterations` 결정(`opts.iterations` 미지정 시 30). 값 검증은 `collectLatencySamples`
 *     에 위임(음수·비정수·NaN → `RangeError` 그대로 전파, 재검증·중복 throw 금지).
 *  2. `collectLatencySamples(request, iterations, { now })` 로 표본 수집(async I/O).
 *  3. `assertS2Threshold(result, thresholds)` 로 임계 판정(순수). 빈 표본이어도 throw 하지
 *     않고 pass=false·측정불가 reason 만 담으므로 정상 진행.
 *  4. `buildBaselineReport(env, assertion)` 로 candidate `BaselineReport` 조립·반환(순수).
 *
 * **순서 계약** — collect(async I/O) → assert(순수 판정) → build(순수 조립) 순서를 지킨다.
 * collect 가 reject/throw 하면 assert·build 가 일어나지 않는다.
 * **판정·조립 위임 불변(DRY)** — 표본 수집은 `collectLatencySamples`, 임계 판정·throughput
 * 관찰은 `assertS2Threshold`, candidate 조립은 `buildBaselineReport` 에 전적으로 위임한다.
 * 본 함수는 iterations 기본값 + collect→assert→build 의 얇은 조립만 책임진다.
 * **관찰·리포트 전용** — 반환은 candidate `BaselineReport`(pass 플래그 포함)뿐이며 임계 위반을
 * throw 로 강제하지 않는다(임계 강제는 호출측 expect·별도 assertS2Threshold 책임).
 *
 * **오류 전파(재래핑 없음)** — 하위 primitive 예외를 그대로 propagate 한다:
 *  - `request` 비함수 → `collectLatencySamples` `TypeError`(판정·조립 미도달).
 *  - `opts.iterations` 음수·비정수·NaN → `collectLatencySamples` `RangeError`.
 *  - 주입 clock 비단조 → `collectLatencySamples` `RangeError`.
 *  - `opts.thresholds` 값 음수·NaN → `assertS2Threshold` `RangeError`.
 *  - `env` 형태 불량 → `buildBaselineReport` `TypeError`, `env.label` 빈·`concurrency`
 *    음수·NaN → `buildBaselineReport` `RangeError`.
 *
 * @throws {TypeError} `request` 비함수 또는 `env` 형태 불량(하위 전파).
 * @throws {RangeError} `iterations`/clock/thresholds/env.label/env.concurrency 무효(하위 전파).
 */
export async function measureBaselineCandidate(
  request: RequestFn,
  env: BaselineEnvMeta,
  opts: MeasureBaselineOpts = {},
): Promise<BaselineReport> {
  // 1. iterations 결정(미지정 시 기본 30). 값 검증은 collectLatencySamples 에 위임.
  const iterations =
    opts.iterations === undefined ? DEFAULT_ITERATIONS : opts.iterations;
  // 2. 표본 수집(async I/O) — request 비함수·iterations 무효·비단조 clock 은 여기서 전파.
  const result = await collectLatencySamples(request, iterations, {
    now: opts.now,
  });
  // 3. 임계 판정(순수) — thresholds 음수·NaN 은 여기서 전파. 빈 표본이어도 throw 안 함.
  const assertion = assertS2Threshold(result, opts.thresholds);
  // 4. candidate BaselineReport 조립·반환(순수) — env 형태·label·concurrency 불량은 여기서 전파.
  return buildBaselineReport(env, assertion);
}

/**
 * `measureAndConfirmBaseline` 옵션 — measure + compare 파라미터 묶음. 둘 다 optional
 * (미지정 시 하위 primitive 기본치로 위임).
 */
export interface MeasureAndConfirmOpts {
  /** measure 파라미터(iterations/thresholds/now) — measureBaselineCandidate 로 위임. */
  measure?: MeasureBaselineOpts;
  /** 회귀 판정 허용치 — confirmOrCompareBaseline(존재 분기 readCompareBaselineFile)로 위임. */
  compare?: CompareOptions;
}

/**
 * S2 조회 latency 를 measure 한 candidate 를 곧바로 baseline 확정/회귀비교로 이어붙이는
 * **measure→confirm-or-compare end-to-end loop harness**다. `measureBaselineCandidate`(candidate
 * 생산, async I/O) → `confirmOrCompareBaseline`(기준 부재면 최초 확정 write / 존재면 로드·비교)를
 * 순서대로 조립한다. `measureBaselineCandidate` 이 candidate 를 **생산**하는 짝,
 * `confirmOrCompareBaseline`(T-0874) 이 **소비**하는 짝이라면, 본 함수는 **둘을 이어붙인
 * top-of-pyramid 진입점**이다(§5 #5 baseline 확정 loop).
 *
 * ```
 * measureBaselineCandidate(request, env, opts?.measure)           // candidate 생산(async I/O)
 *   → confirmOrCompareBaseline(env, baseDir, candidate, opts?.compare)  // 최초 확정 write | 로드·비교
 * ```
 *
 * 처리 순서(신규 판정·계산·io 0 — 하위 primitive 를 조립만):
 *  1. `candidate = await measureBaselineCandidate(request, env, opts?.measure)` 로 candidate 생산
 *     (async I/O). request 비함수·iterations/clock/thresholds 무효·env 형태 불량은 여기서 그대로
 *     전파(confirm 미도달 — candidate 미생산 시 write·compare 부작용 0).
 *  2. `return confirmOrCompareBaseline(env, baseDir, candidate, opts?.compare)` 로 확정 write |
 *     로드·비교 후 판별 union 반환(baseDir non-string `TypeError`·빈/공백 `RangeError`·존재 분기
 *     파일부재 `ENOENT`·내용불량 `SyntaxError`/`TypeError`·tolerance 무효 `RangeError` 그대로 전파).
 *
 * **순서 계약** — measure(async I/O) → confirmOrCompare(동기 fs) 순서를 지킨다. measure 가
 * reject/throw 하면 confirmOrCompare 가 일어나지 않는다(candidate 미생산 시 write·compare 부작용 0).
 * **측정·확정·비교 위임 불변(DRY)** — candidate 생산은 `measureBaselineCandidate`, 존재 판정·write·
 * 로드·비교는 `confirmOrCompareBaseline` 에 전적으로 위임한다(재구현 금지). 본 함수는 measure→confirm
 * 의 얇은 이어붙임 + 옵션 분배(`opts.measure`/`opts.compare`)만 책임진다.
 * **관찰·리포트 전용** — 반환은 `ConfirmOrCompareResult` 판별 union 뿐이며 회귀는
 * `comparison.regressed`(존재 분기)로 노출만 한다(throw 안 함). S2 pass/fail 임계·collector metrics
 * 판정 로직 불변. 신규 외부 dependency 0(기존 collector/io 함수만 조립).
 *
 * @param request 주입 async 요청 함수(`RequestFn`) — DB·네트워크·supertest 무의존 결정론 테스트용.
 * @param env 실행 환경 메타(candidate 생산·파일명 slug 유도).
 * @param baseDir baseline 디렉토리(confirmOrCompareBaseline 경로 결정에 위임).
 * @param opts measure(`opts.measure`)/compare(`opts.compare`) 파라미터 묶음(선택).
 * @returns `{ outcome: "established", path }`(최초 확정 write) 또는
 *   `{ outcome: "compared", comparison, report }`(로드·비교) 판별 union.
 * @throws {TypeError} `request` 비함수·`env` 형태 불량(measure 전파) 또는 `baseDir` non-string·
 *   존재 분기 candidate 형태 불량(confirm 전파).
 * @throws {RangeError} `iterations`/clock/thresholds/env.label/env.concurrency 무효(measure 전파)
 *   또는 `baseDir` 빈/공백-only·존재 분기 tolerance 음수·NaN(confirm 전파).
 */
export async function measureAndConfirmBaseline(
  request: RequestFn,
  env: BaselineEnvMeta,
  baseDir: string,
  opts: MeasureAndConfirmOpts = {},
): Promise<ConfirmOrCompareResult> {
  // 1. candidate 생산(async I/O) — request/iterations/clock/thresholds/env 무효는 여기서 전파.
  //    measure 가 reject/throw 하면 아래 confirmOrCompare 미도달(순서 계약, write·compare 부작용 0).
  const candidate = await measureBaselineCandidate(request, env, opts.measure);
  // 2. 확정 write | 로드·비교 — baseDir/파일 내용/tolerance 무효는 여기서 전파. 판별 union 반환.
  return confirmOrCompareBaseline(env, baseDir, candidate, opts.compare);
}
