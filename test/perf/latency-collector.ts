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

import { summarizeLatency, errorRate, LatencySummary } from "./latency-metrics";

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

  for (let i = 0; i < iterations; i++) {
    const start = now();
    let success: boolean;
    try {
      const res = await request();
      success = isSuccess(res);
    } catch {
      // reject(throw)는 명시적으로 failure 로 집계(요청 실패 정책).
      success = false;
    }
    const end = now();
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

  return { samplesMs, total: iterations, failures };
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

  return { pass: reasons.length === 0, summary, errorRate: er, reasons };
}
