/**
 * web 렌더 latency 측정 축 (T-1993, REQ-048 ④ 시각화 축의 **첫 측정 경로**).
 *
 * 렌더 thunk 를 N 회 실행하며 `performance.now()` 차분을 모으고 REQ-048 절대 임계로
 * pass/fail 을 판정하는 **순수 helper**. backend `test/perf/` 를 import 하지 않는다(빌드
 * 경계 분리) — 임계 3000ms 만 `latency-collector.ts` 167 행 `DEFAULT_P95_MAX_MS` 와 값으로
 * 일치시킨다.
 *
 * 판정 계약: **절대 임계만** 본다. 직전 회차 대비 상대 회귀는 pass/fail 에 쓰지 않으며,
 * 이는 backend `latency-baseline-io.ts` 의 baseline 비교가 관찰-전용인 것과 동형이다.
 *
 * 측정 한계: 본 축은 React SSR markup 생성 시간만 재며 브라우저 layout · paint · 네트워크 ·
 * 데이터 로딩은 포함하지 않는다. 따라서 REQ-048 시각화 축의 *첫 측정 도입* 이지 축 완결이 아니다.
 */

/** REQ-048 렌더 절대 임계(ms) — README 92 행 "로딩 및 시각화에 3초 이내". */
export const REQ048_RENDER_MAX_MS = 3000;

/** 렌더 측정 요약 지표. `samples` 는 실제 수집된 표본 개수. */
export interface RenderLatencySummary {
  samples: number;
  p50: number;
  p95: number;
  max: number;
}

/** 임계 판정 결과 — `pass` 와 실패 사유 문자열(pass=true 면 빈 문자열). */
export interface RenderThresholdVerdict {
  pass: boolean;
  reason: string;
}

/** 측정 옵션 — `now` 를 주입하면 결정론적 테스트가 된다. */
export interface MeasureRenderOptions {
  now?: () => number;
}

/**
 * 정렬 표본의 선형 보간 percentile(backend `latency-metrics.ts` 와 동일 규약). 표본 1 개면
 * 그 값, 인덱스가 정수로 떨어지면 보간 없이 해당 표본.
 */
function percentileOf(sortedMs: number[], p: number): number {
  if (sortedMs.length === 1) {
    return sortedMs[0];
  }
  const rank = (p / 100) * (sortedMs.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) {
    return sortedMs[lo];
  }
  return sortedMs[lo] + (sortedMs[hi] - sortedMs[lo]) * (rank - lo);
}

/**
 * 렌더 thunk 를 `iterations` 회 실행하고 각 회차 소요 ms 를 요약한다. thunk 가 throw 하면
 * **삼키지 않고 전파**한다 — 렌더 실패를 0ms 표본이나 조용한 pass 로 두지 않기 위함.
 *
 * @throws {TypeError} `render` 가 함수가 아닐 때.
 * @throws {RangeError} `iterations` 가 1 이상 정수가 아닐 때(0 · 음수 · 비정수 · NaN).
 */
export function measureRenderLatency(
  render: () => unknown,
  iterations: number,
  opts: MeasureRenderOptions = {},
): RenderLatencySummary {
  if (typeof render !== 'function') {
    throw new TypeError('measureRenderLatency: render 는 함수여야 함');
  }
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new RangeError(
      `measureRenderLatency: iterations 는 1 이상 정수여야 함 (받은 값: ${iterations})`,
    );
  }
  const now = typeof opts.now === 'function' ? opts.now : () => performance.now();

  const samplesMs: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = now();
    render();
    const elapsed = now() - started;
    samplesMs.push(elapsed < 0 ? 0 : elapsed);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50: percentileOf(sorted, 50),
    p95: percentileOf(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}

/**
 * 요약을 REQ-048 절대 임계로 판정한다(상대 회귀는 보지 않음 — 위 판정 계약). 표본 0 개는
 * "측정 불가" 라 pass 로 오판하지 않고 `pass=false` 로 둔다.
 *
 * @throws {TypeError} `summary` 가 { samples, p50, p95, max } 수치 형태가 아닐 때.
 * @throws {RangeError} `maxMs` 가 0 이하 · NaN · 비수치일 때.
 */
export function assertRenderThreshold(
  summary: RenderLatencySummary,
  maxMs: number = REQ048_RENDER_MAX_MS,
): RenderThresholdVerdict {
  if (
    !summary ||
    typeof summary.samples !== 'number' ||
    typeof summary.p50 !== 'number' ||
    typeof summary.p95 !== 'number' ||
    typeof summary.max !== 'number'
  ) {
    throw new TypeError(
      'assertRenderThreshold: summary 는 { samples, p50, p95, max } 형태여야 함',
    );
  }
  if (typeof maxMs !== 'number' || Number.isNaN(maxMs) || maxMs <= 0) {
    throw new RangeError(
      `assertRenderThreshold: maxMs 는 0 보다 큰 수치여야 함 (받은 값: ${maxMs})`,
    );
  }
  if (summary.samples === 0) {
    return {
      pass: false,
      reason: `REQ-048 렌더 임계 판정 불가 — 표본 0 개 (임계 ${maxMs}ms)`,
    };
  }
  if (!(summary.p95 <= maxMs)) {
    return {
      pass: false,
      reason: `REQ-048 렌더 임계 초과 — p95 ${summary.p95}ms > ${maxMs}ms (max ${summary.max}ms, 표본 ${summary.samples} 개)`,
    };
  }
  return { pass: true, reason: '' };
}
