/**
 * S2 조회 latency 경량 harness 측정 primitive (REQ-048, load-resilience-test-plan §2 S2 / §3).
 *
 * 반복 호출로 수집한 latency 표본(ms)에서 p50/p95/p99 percentile 과 error rate 를
 * 산출하는 **순수 함수** 모음이다. DB·네트워크·앱 부트스트랩에 의존하지 않으며(입력
 * 배열 → 출력 수치), 후속 DB-backed `*.perf-spec.ts` harness 가 이 primitive 를 import 만
 * 하면 된다. 도구 배경은 ADR-0054(S2 는 supertest 2-계층 measure) 참조.
 */

/**
 * 정렬된 표본에서 p-분위수(0~100)를 선형 보간으로 산출한다.
 * 빈 배열 → `NaN`, 단일 표본 → 그 값, p=0/100 → 최소/최대, 중간 p → 선형 보간.
 * 원본 배열은 변형하지 않는다(복사 후 정렬).
 *
 * @throws {RangeError} p 가 [0,100] 밖이거나 NaN 일 때.
 * @throws {TypeError} 표본에 비수치(NaN 포함) 원소가 있을 때.
 */
export function percentile(samplesMs: number[], p: number): number {
  if (typeof p !== "number" || Number.isNaN(p) || p < 0 || p > 100) {
    throw new RangeError(`percentile: p 는 0~100 이어야 함 (받은 값: ${p})`);
  }
  if (samplesMs.length === 0) {
    return NaN;
  }
  for (const s of samplesMs) {
    if (typeof s !== "number" || Number.isNaN(s)) {
      throw new TypeError(
        `percentile: 표본은 유한 수치여야 함 (받은 값: ${s})`,
      );
    }
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return sorted[0];
  }
  // 선형 보간: rank = p/100 * (n-1)
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) {
    return sorted[lo];
  }
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/** `summarizeLatency` 의 반환 형태 — §3 임계 표의 p50/p95/p99 대응 + count/maxMs 관찰. */
export interface LatencySummary {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  maxMs: number;
}

/**
 * 표본 배열에서 요약 latency 지표를 산출한다(§3 임계 표 대응).
 * 빈 배열이면 percentile 은 `NaN`, count=0, maxMs=NaN.
 *
 * @throws {TypeError} 표본에 비수치 원소가 있을 때(percentile 경유).
 */
export function summarizeLatency(samplesMs: number[]): LatencySummary {
  return {
    p50: percentile(samplesMs, 50),
    p95: percentile(samplesMs, 95),
    p99: percentile(samplesMs, 99),
    count: samplesMs.length,
    maxMs: samplesMs.length === 0 ? NaN : Math.max(...samplesMs),
  };
}

/**
 * non-2xx 실패 비율(0~1)을 산출한다(§3 임계 표의 error rate 대응).
 * total=0 방어 → 0(요청 없음은 실패 없음). 0 ≤ failures ≤ total 이어야 한다.
 *
 * @throws {RangeError} 입력이 음수·비정수·NaN 이거나 failures > total 일 때.
 */
export function errorRate(total: number, failures: number): number {
  if (!Number.isInteger(total) || !Number.isInteger(failures)) {
    throw new RangeError(
      `errorRate: total/failures 는 정수여야 함 (받은 값: total=${total}, failures=${failures})`,
    );
  }
  if (total < 0 || failures < 0) {
    throw new RangeError(
      `errorRate: 음수 입력 불가 (받은 값: total=${total}, failures=${failures})`,
    );
  }
  if (failures > total) {
    throw new RangeError(
      `errorRate: failures 는 total 이하여야 함 (받은 값: total=${total}, failures=${failures})`,
    );
  }
  if (total === 0) {
    return 0;
  }
  return failures / total;
}
