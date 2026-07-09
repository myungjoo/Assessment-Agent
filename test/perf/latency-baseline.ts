/**
 * S2 조회 latency baseline 리포트 순수 함수 (REQ-048, load-resilience-test-plan §3 / §5 #5).
 *
 * `assertS2Threshold` 가 낸 `S2Assertion` 을 §3 "환경 고정" 대응 env-meta(하드웨어·동시성·
 * 데이터 규모)와 합쳐 비교 가능한 **machine-readable baseline 리포트 레코드**로 포맷하는
 * 순수 함수 모음이다. DB·네트워크·앱 부트스트랩에 무의존하며(입력 → 출력), 실 baseline
 * 실측 harness(§5 follow-up #5)가 이 primitive 를 import 만 하면 되도록 하는 최소 선행 slice 다.
 *
 * **관찰·리포트 전용**이다 — 지표는 `S2Assertion` 에서 파생만 하고 재계산하지 않으며,
 * pass/fail 판정 로직·임계 자체는 전혀 바꾸지 않는다(§3 throughput 은 여전히 관찰 지표).
 */

import { S2Assertion } from "./latency-collector";

/**
 * 실행 환경 메타(§3 "환경 고정" 대응) — 각 baseline run 을 비교 가능하게 하는 컨텍스트.
 * `label` / `concurrency` 는 필수, 나머지는 optional(측정 환경마다 가용성이 달라 누락 허용).
 */
export interface BaselineEnvMeta {
  /** run 식별 라벨(예: "ci-linux-x64", "local-macbook"). 빈/공백-only string 금지. */
  label: string;
  /** 동시성 수준(동시 클라이언트/워커 수). 0 이상 유한 수치. */
  concurrency: number;
  /** CPU 설명(예: "8x Xeon"). 미측정 시 생략. */
  cpu?: string;
  /** 가용 메모리(MB). 미측정 시 생략. */
  memoryMb?: number;
  /** 데이터 규모 설명(예: "100 persons x 50 repos"). 미측정 시 생략. */
  dataScale?: string;
}

/**
 * baseline 리포트 레코드 — env-meta + `S2Assertion` 에서 파생한 핵심 지표를 담는
 * machine-readable 형태. 지표는 전사(transcribe)만 하고 재계산하지 않는다.
 */
export interface BaselineReport {
  /** 입력 env-meta 를 그대로 보존(비교·재현용). */
  env: BaselineEnvMeta;
  /** p50 latency(ms). 성공 표본 0 이면 NaN(assertion.summary 에서 그대로 파생). */
  p50: number;
  /** p95 latency(ms). 성공 표본 0 이면 NaN. */
  p95: number;
  /** p99 latency(ms). 성공 표본 0 이면 NaN. */
  p99: number;
  /** throughput 관찰값(req/s). 성공 표본 0 이면 0(§3 관찰 지표). */
  throughput: number;
  /** error rate(0~1). */
  errorRate: number;
  /** 성공 표본 수(= summary.count). */
  count: number;
  /** S2 임계 pass 여부(assertion.pass 전사 — 판정 로직 불변). */
  pass: boolean;
}

/** env-meta 가 유효 형태인지 방어적으로 검증(런타임 형태 가드). */
function isValidEnvMeta(env: unknown): env is BaselineEnvMeta {
  if (env === null || typeof env !== "object") {
    return false;
  }
  const e = env as Record<string, unknown>;
  return typeof e.label === "string" && typeof e.concurrency === "number";
}

/** assertion 이 최소한의 `S2Assertion` 형태인지 방어적으로 검증. */
function isValidAssertion(assertion: unknown): assertion is S2Assertion {
  if (assertion === null || typeof assertion !== "object") {
    return false;
  }
  const a = assertion as Record<string, unknown>;
  return (
    typeof a.pass === "boolean" &&
    typeof a.errorRate === "number" &&
    typeof a.throughput === "number" &&
    typeof a.summary === "object" &&
    a.summary !== null
  );
}

/**
 * `S2Assertion` 과 env-meta 를 합쳐 `BaselineReport` 를 조립한다.
 * 지표는 assertion 에서 **파생만** 하며(재계산 없음), pass/fail·임계 로직은 불변이다.
 *
 * @throws {TypeError} `env` 가 유효 `BaselineEnvMeta` 형태가 아닐 때.
 * @throws {RangeError} `label` 이 빈 string(또는 공백-only)이거나 `concurrency` 가 음수·NaN 일 때.
 * @throws {TypeError} `assertion` 이 유효 `S2Assertion` 형태가 아닐 때.
 */
export function buildBaselineReport(
  env: BaselineEnvMeta,
  assertion: S2Assertion,
): BaselineReport {
  if (!isValidEnvMeta(env)) {
    throw new TypeError(
      "buildBaselineReport: env 는 { label:string, concurrency:number } 형태여야 함",
    );
  }
  if (env.label.trim() === "") {
    throw new RangeError(
      "buildBaselineReport: env.label 은 빈 string 일 수 없음",
    );
  }
  if (Number.isNaN(env.concurrency) || env.concurrency < 0) {
    throw new RangeError(
      `buildBaselineReport: env.concurrency 는 0 이상 수치여야 함 (받은 값: ${env.concurrency})`,
    );
  }
  if (!isValidAssertion(assertion)) {
    throw new TypeError(
      "buildBaselineReport: assertion 은 { pass, summary, errorRate, throughput } 형태여야 함",
    );
  }

  const { summary } = assertion;
  return {
    env,
    p50: summary.p50,
    p95: summary.p95,
    p99: summary.p99,
    throughput: assertion.throughput,
    errorRate: assertion.errorRate,
    count: summary.count,
    pass: assertion.pass,
  };
}

/**
 * `compareBaselineReports` 옵션 — 회귀 판정 허용치. 둘 다 optional(기본값 사용).
 */
export interface CompareOptions {
  /**
   * latency(p50/p95/p99) 회귀 허용 비율(기본 0.10 = +10%). candidate 가 baseline
   * 대비 이 비율을 **초과해** 증가하면 회귀. 정확히 tolerance 만큼 증가는 회귀 아님.
   * 0 이상 유한 수치여야 함(음수·NaN 이면 RangeError).
   */
  latencyTolerance?: number;
  /**
   * errorRate 회귀 허용 절대치(기본 0.01). candidate errorRate 가 baseline 대비
   * 이 절대 delta 를 **초과해** 증가하면 회귀. 0 이상 유한 수치여야 함.
   */
  errorRateTolerance?: number;
}

/**
 * latency 지표 하나의 비교 결과 — baseline/candidate 값, delta, 회귀 여부.
 * baseline 또는 candidate 가 NaN(빈 표본)이면 delta 는 NaN 으로 두고 회귀 판정에서
 * 제외한다(regressed=false). 단 candidate 만 NaN(측정 소실)이면 회귀로 표기한다.
 */
export interface MetricComparison {
  /** baseline 값(ms 또는 비율). 빈 표본이면 NaN. */
  baseline: number;
  /** candidate 값(ms 또는 비율). 빈 표본이면 NaN. */
  candidate: number;
  /** candidate - baseline. 어느 한쪽이 NaN 이면 NaN. */
  delta: number;
  /** 이 지표가 회귀했는지(허용치 초과 악화). NaN-제외 분기는 false. */
  regressed: boolean;
}

/**
 * 두 `BaselineReport` 의 회귀 비교 결과 — 지표별 비교 + 종합 회귀 여부.
 * 지표는 재계산 없이 두 리포트의 파생값만 비교한다(관찰·리포트 전용).
 */
export interface BaselineComparison {
  /** p50 latency 비교(허용 비율 초과 증가 → 회귀). */
  p50: MetricComparison;
  /** p95 latency 비교(허용 비율 초과 증가 → 회귀). */
  p95: MetricComparison;
  /** p99 latency 비교(허용 비율 초과 증가 → 회귀). */
  p99: MetricComparison;
  /** errorRate 비교(허용 절대치 초과 증가 → 회귀). */
  errorRate: MetricComparison;
  /**
   * throughput 비교 — §3 상 관찰 지표라 delta 만 리포트하고 **회귀 판정에는 반영하지
   * 않는다**. 따라서 regressed 는 항상 false(관찰 전용).
   */
  throughput: MetricComparison;
  /**
   * 종합 회귀 여부 — latency 3종·errorRate 중 하나라도 regressed=true 면 true.
   * throughput 은 반영하지 않는다(관찰 전용).
   */
  regressed: boolean;
}

/** REQ-048 기본 latency 회귀 허용 비율(+10%). */
const DEFAULT_LATENCY_TOLERANCE = 0.1;
/** §3 기본 errorRate 회귀 허용 절대치. */
const DEFAULT_ERROR_RATE_TOLERANCE = 0.01;

/** report 가 최소한의 `BaselineReport` 형태(env + 지표 수치)인지 방어적으로 검증. */
function isValidReport(report: unknown): report is BaselineReport {
  if (report === null || typeof report !== "object") {
    return false;
  }
  const r = report as Record<string, unknown>;
  return (
    isValidEnvMeta(r.env) &&
    typeof r.p50 === "number" &&
    typeof r.p95 === "number" &&
    typeof r.p99 === "number" &&
    typeof r.throughput === "number" &&
    typeof r.errorRate === "number"
  );
}

/**
 * latency 지표(p50/p95/p99) 하나를 비교한다 — candidate 가 baseline 대비 허용 비율을
 * **초과해** 증가하면 회귀. NaN 방어: 어느 한쪽이 NaN 이면 delta 는 NaN 으로 두고,
 * baseline 이 NaN(candidate 유한 여부 무관)이면 회귀 판정에서 제외(regressed=false),
 * 단 candidate 만 NaN(baseline 유한 → 측정 소실)이면 회귀로 표기한다.
 */
function compareLatencyMetric(
  baseline: number,
  candidate: number,
  tolerance: number,
): MetricComparison {
  const baseNaN = Number.isNaN(baseline);
  const candNaN = Number.isNaN(candidate);
  if (baseNaN || candNaN) {
    // candidate 만 NaN(baseline 유한) = 측정 소실 → 회귀. 그 외(baseline NaN)는 제외.
    const regressed = candNaN && !baseNaN;
    return { baseline, candidate, delta: NaN, regressed };
  }
  const delta = candidate - baseline;
  // baseline 이 0 이면 허용 절대량도 0 → candidate 가 baseline 초과면 회귀(엄격).
  const allowedIncrease = baseline * tolerance;
  const regressed = delta > allowedIncrease;
  return { baseline, candidate, delta, regressed };
}

/**
 * errorRate 를 비교한다 — candidate 가 baseline 대비 허용 절대치를 **초과해** 증가하면
 * 회귀(개선=감소는 회귀 아님). latency 와 동형의 NaN 방어를 적용한다.
 */
function compareErrorRateMetric(
  baseline: number,
  candidate: number,
  tolerance: number,
): MetricComparison {
  const baseNaN = Number.isNaN(baseline);
  const candNaN = Number.isNaN(candidate);
  if (baseNaN || candNaN) {
    const regressed = candNaN && !baseNaN;
    return { baseline, candidate, delta: NaN, regressed };
  }
  const delta = candidate - baseline;
  const regressed = delta > tolerance;
  return { baseline, candidate, delta, regressed };
}

/**
 * 저장된 기준 `baseline` 과 새 측정 `candidate` 두 `BaselineReport` 를 비교해 회귀
 * 여부와 지표별 delta 를 담은 `BaselineComparison` 을 반환한다.
 *
 * - latency(p50/p95/p99): candidate 가 baseline 대비 `latencyTolerance`(기본 0.10)를
 *   **초과해** 증가하면 회귀(정확히 tolerance 만큼은 회귀 아님).
 * - errorRate: candidate 가 baseline 대비 `errorRateTolerance`(기본 0.01, 절대치)를
 *   **초과해** 증가하면 회귀. 개선(감소)은 회귀 아님(delta 음수).
 * - throughput: §3 관찰 지표라 **delta 만 리포트**하고 회귀 판정에 반영하지 않는다
 *   (`throughput.regressed` 는 항상 false).
 * - NaN 방어: 어느 지표든 baseline 이 NaN(빈 표본)이면 그 지표는 회귀 판정에서 제외한다.
 *   단 candidate 만 NaN(baseline 유한 → 측정 소실)이면 그 지표는 회귀로 표기한다.
 *
 * 지표 재계산 없음 — 두 리포트의 이미 파생된 값만 비교한다. pass/fail 임계·assertion
 * 로직은 전혀 건드리지 않는다(관찰·리포트 전용).
 *
 * @throws {TypeError} `baseline` 또는 `candidate` 가 유효 `BaselineReport` 형태가 아닐 때.
 * @throws {RangeError} `latencyTolerance` / `errorRateTolerance` 가 음수·NaN 일 때.
 */
export function compareBaselineReports(
  baseline: BaselineReport,
  candidate: BaselineReport,
  options: CompareOptions = {},
): BaselineComparison {
  if (!isValidReport(baseline)) {
    throw new TypeError(
      "compareBaselineReports: baseline 은 유효한 BaselineReport 형태여야 함",
    );
  }
  if (!isValidReport(candidate)) {
    throw new TypeError(
      "compareBaselineReports: candidate 는 유효한 BaselineReport 형태여야 함",
    );
  }
  const latencyTolerance =
    options.latencyTolerance === undefined
      ? DEFAULT_LATENCY_TOLERANCE
      : options.latencyTolerance;
  const errorRateTolerance =
    options.errorRateTolerance === undefined
      ? DEFAULT_ERROR_RATE_TOLERANCE
      : options.errorRateTolerance;
  if (
    typeof latencyTolerance !== "number" ||
    Number.isNaN(latencyTolerance) ||
    latencyTolerance < 0
  ) {
    throw new RangeError(
      `compareBaselineReports: latencyTolerance 는 0 이상 수치여야 함 (받은 값: ${latencyTolerance})`,
    );
  }
  if (
    typeof errorRateTolerance !== "number" ||
    Number.isNaN(errorRateTolerance) ||
    errorRateTolerance < 0
  ) {
    throw new RangeError(
      `compareBaselineReports: errorRateTolerance 는 0 이상 수치여야 함 (받은 값: ${errorRateTolerance})`,
    );
  }

  const p50 = compareLatencyMetric(
    baseline.p50,
    candidate.p50,
    latencyTolerance,
  );
  const p95 = compareLatencyMetric(
    baseline.p95,
    candidate.p95,
    latencyTolerance,
  );
  const p99 = compareLatencyMetric(
    baseline.p99,
    candidate.p99,
    latencyTolerance,
  );
  const errorRate = compareErrorRateMetric(
    baseline.errorRate,
    candidate.errorRate,
    errorRateTolerance,
  );
  // throughput 은 §3 관찰 지표 — delta 만 리포트하고 회귀 판정에 넣지 않는다.
  const throughputBase = baseline.throughput;
  const throughputCand = candidate.throughput;
  const throughputDelta =
    Number.isNaN(throughputBase) || Number.isNaN(throughputCand)
      ? NaN
      : throughputCand - throughputBase;
  const throughput: MetricComparison = {
    baseline: throughputBase,
    candidate: throughputCand,
    delta: throughputDelta,
    regressed: false, // 관찰 전용 — 절대 회귀 판정에 넣지 않음.
  };

  const regressed =
    p50.regressed || p95.regressed || p99.regressed || errorRate.regressed;

  return { p50, p95, p99, errorRate, throughput, regressed };
}

/** NaN(빈 표본 등)은 "n/a" 로, 유한 수치는 소수 자릿수를 고정해 포맷한다. */
function fmt(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  return value.toFixed(digits);
}

/**
 * 리포트를 사람-친화 + 파싱 용이한 한 줄(key=value)로 포맷한다.
 * 예: `[ci] p50=10.0ms p95=15.0ms p99=20.0ms tput=100.00req/s err=0.00% pass=true concurrency=4`.
 * NaN 지표(빈 표본)는 "n/a" 로 방어적으로 표기하고, optional env-meta(cpu/memoryMb/dataScale)는
 * 지정된 것만 뒤에 덧붙인다.
 *
 * @throws {TypeError} `report` 가 유효 `BaselineReport` 형태가 아닐 때.
 */
export function formatBaselineLine(report: BaselineReport): string {
  if (
    report === null ||
    typeof report !== "object" ||
    !isValidEnvMeta((report as BaselineReport).env)
  ) {
    throw new TypeError(
      "formatBaselineLine: report 는 유효한 BaselineReport 여야 함",
    );
  }
  const { env } = report;
  const parts = [
    `[${env.label}]`,
    `p50=${fmt(report.p50, 1)}ms`,
    `p95=${fmt(report.p95, 1)}ms`,
    `p99=${fmt(report.p99, 1)}ms`,
    `tput=${fmt(report.throughput, 2)}req/s`,
    `err=${fmt(report.errorRate * 100, 2)}%`,
    `count=${report.count}`,
    `pass=${report.pass}`,
    `concurrency=${env.concurrency}`,
  ];
  // optional env-meta 는 지정된 것만 덧붙여 비교 컨텍스트를 보존한다.
  if (env.cpu !== undefined) {
    parts.push(`cpu=${env.cpu}`);
  }
  if (env.memoryMb !== undefined) {
    parts.push(`memoryMb=${env.memoryMb}`);
  }
  if (env.dataScale !== undefined) {
    parts.push(`dataScale=${env.dataScale}`);
  }
  return parts.join(" ");
}
