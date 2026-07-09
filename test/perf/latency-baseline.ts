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

/**
 * NaN sentinel — JSON 은 `NaN` 을 표현하지 못하므로(round-trip 소실) 직렬화 시 빈 표본
 * 지표(p50/p95/p99 등의 NaN)를 이 sentinel 문자열로 저장하고, 역직렬화 시 다시 `NaN` 으로
 * 복원한다. 실제 `null`(형태 불량)과 구분하기 위해 명시 문자열 마커를 쓴다.
 */
const NAN_SENTINEL = "__NaN__";

/** 유한 수치는 그대로, NaN 은 sentinel 로 치환해 JSON-safe 값으로 만든다. */
function toSerializableNumber(value: number): number | typeof NAN_SENTINEL {
  return Number.isNaN(value) ? NAN_SENTINEL : value;
}

/**
 * 직렬화된 지표 값을 number 로 복원한다 — sentinel 은 `NaN` 으로, 유한 number 는 그대로.
 * @throws {TypeError} 값이 number 도 NaN-sentinel 도 아닐 때(형태 불량).
 */
function fromSerializedNumber(value: unknown): number {
  if (value === NAN_SENTINEL) {
    return NaN;
  }
  if (typeof value !== "number") {
    throw new TypeError(
      `parseBaselineReport: 지표 값은 number 또는 NaN sentinel 이어야 함 (받은 값: ${JSON.stringify(value)})`,
    );
  }
  return value;
}

/**
 * `BaselineReport` 를 안정적(stable)·비교 가능한 JSON 문자열로 직렬화한다.
 *
 * NaN 지표(빈 표본으로 인한 p50/p95/p99 등)는 JSON 이 `NaN` 을 표현하지 못하므로 명시
 * sentinel(`"__NaN__"`)로 저장하고, `parseBaselineReport` 가 이를 다시 `NaN` 으로 복원한다
 * (round-trip 보존). 지표는 재계산 없이 파생값을 그대로 전사만 하며, optional env-meta
 * (cpu/memoryMb/dataScale)는 지정된 것만 보존한다(미지정은 필드 자체를 넣지 않음).
 *
 * 반환 문자열은 항상 `JSON.parse` 가능한 유효 JSON 이다.
 *
 * @throws {TypeError} `report` 가 유효 `BaselineReport` 형태가 아닐 때(기존 `isValidReport` 가드 재사용).
 */
export function serializeBaselineReport(report: BaselineReport): string {
  if (!isValidReport(report)) {
    throw new TypeError(
      "serializeBaselineReport: report 는 유효한 BaselineReport 형태여야 함",
    );
  }
  const { env } = report;
  // env 는 필수 2 필드 + 지정된 optional 만 보존(미지정 optional 은 넣지 않음).
  const serializedEnv: Record<string, unknown> = {
    label: env.label,
    concurrency: env.concurrency,
  };
  if (env.cpu !== undefined) {
    serializedEnv.cpu = env.cpu;
  }
  if (env.memoryMb !== undefined) {
    serializedEnv.memoryMb = env.memoryMb;
  }
  if (env.dataScale !== undefined) {
    serializedEnv.dataScale = env.dataScale;
  }
  // 지표는 재계산 없이 전사만 — NaN 은 sentinel 로 치환.
  const record = {
    env: serializedEnv,
    p50: toSerializableNumber(report.p50),
    p95: toSerializableNumber(report.p95),
    p99: toSerializableNumber(report.p99),
    throughput: toSerializableNumber(report.throughput),
    errorRate: toSerializableNumber(report.errorRate),
    count: report.count,
    pass: report.pass,
  };
  return JSON.stringify(record);
}

/**
 * `serializeBaselineReport` 가 낸 JSON 문자열을 파싱해 `BaselineReport` 로 복원한다.
 *
 * NaN sentinel(`"__NaN__"`)은 다시 `NaN` 으로 복원하고, optional env-meta 는 존재하는 것만
 * 보존한다(round-trip 불변: `parseBaselineReport(serializeBaselineReport(r))` 는 원본 `r` 과
 * 지표·env-meta 가 동등, NaN 포함). 지표 재계산 없이 파싱값만 복원한다.
 *
 * @throws {SyntaxError} `json` 이 유효한 JSON 이 아닐 때(`JSON.parse` 가 던지는 그대로).
 * @throws {TypeError} JSON 은 유효하나 형태가 불량할 때(필수 필드 누락·타입 불일치 —
 *   기존 `isValidReport` 가드 재사용, 또는 지표 자리에 sentinel 아닌 `null`/string 등).
 */
export function parseBaselineReport(json: string): BaselineReport {
  // 잘못된 JSON 은 JSON.parse 가 SyntaxError 를 던진다(빈 문자열 포함).
  const parsed: unknown = JSON.parse(json);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError(
      "parseBaselineReport: 최상위는 배열/원시값이 아닌 object JSON 이어야 함",
    );
  }
  const raw = parsed as Record<string, unknown>;
  // env 형태 가드(기존 isValidEnvMeta 재사용) — label/concurrency 필수.
  if (!isValidEnvMeta(raw.env)) {
    throw new TypeError(
      "parseBaselineReport: env 는 { label:string, concurrency:number } 형태여야 함",
    );
  }
  const rawEnv = raw.env as unknown as Record<string, unknown>;
  // 지표는 sentinel → NaN 복원(number 아닌 값은 fromSerializedNumber 가 TypeError).
  const report: BaselineReport = {
    env: rebuildEnv(raw.env, rawEnv),
    p50: fromSerializedNumber(raw.p50),
    p95: fromSerializedNumber(raw.p95),
    p99: fromSerializedNumber(raw.p99),
    throughput: fromSerializedNumber(raw.throughput),
    errorRate: fromSerializedNumber(raw.errorRate),
    count: typeof raw.count === "number" ? raw.count : NaN,
    pass: raw.pass === true,
  };
  // 지표 복원 후 최종 형태를 다시 가드(방어적 재검증 — 지표 자리 형태 불량 catch).
  if (!isValidReport(report)) {
    throw new TypeError(
      "parseBaselineReport: 복원된 레코드가 유효한 BaselineReport 형태가 아님",
    );
  }
  return report;
}

/** 직렬화 env 에서 필수 2 필드 + 지정된 optional 만 복원한다(미지정은 미지정 유지). */
function rebuildEnv(
  env: BaselineEnvMeta,
  rawEnv: Record<string, unknown>,
): BaselineEnvMeta {
  const restored: BaselineEnvMeta = {
    label: env.label,
    concurrency: env.concurrency,
  };
  if (typeof rawEnv.cpu === "string") {
    restored.cpu = rawEnv.cpu;
  }
  if (typeof rawEnv.memoryMb === "number") {
    restored.memoryMb = rawEnv.memoryMb;
  }
  if (typeof rawEnv.dataScale === "string") {
    restored.dataScale = rawEnv.dataScale;
  }
  return restored;
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

/**
 * delta 를 명시 부호(증가는 `+`, 감소는 `-`)와 함께 포맷한다 — 개선/악화 방향을 사람이
 * 즉시 읽게 한다. NaN(어느 한쪽 빈 표본)은 `fmt` 와 동형으로 "n/a" 로 방어적으로 표기한다.
 * delta=0(변화 없음)은 부호 없이 "0.0" 등으로 표기한다.
 */
function fmtDelta(value: number, digits: number): string {
  if (!Number.isFinite(value)) {
    return "n/a";
  }
  const body = value.toFixed(digits);
  // toFixed 는 음수만 "-" 를 붙이므로 양수(0 초과)에만 명시 "+" 를 덧댄다. 0 은 부호 없음.
  return value > 0 ? `+${body}` : body;
}

/** 값이 최소한의 `MetricComparison` 형태(baseline/candidate/delta number + regressed boolean)인지 방어적으로 검증. */
function isValidMetricComparison(metric: unknown): metric is MetricComparison {
  if (metric === null || typeof metric !== "object") {
    return false;
  }
  const m = metric as Record<string, unknown>;
  return (
    typeof m.baseline === "number" &&
    typeof m.candidate === "number" &&
    typeof m.delta === "number" &&
    typeof m.regressed === "boolean"
  );
}

/** comparison 이 유효 `BaselineComparison` 형태(5 지표 MetricComparison + boolean regressed)인지 방어적으로 검증. */
function isValidComparison(
  comparison: unknown,
): comparison is BaselineComparison {
  if (comparison === null || typeof comparison !== "object") {
    return false;
  }
  const c = comparison as Record<string, unknown>;
  return (
    typeof c.regressed === "boolean" &&
    isValidMetricComparison(c.p50) &&
    isValidMetricComparison(c.p95) &&
    isValidMetricComparison(c.p99) &&
    isValidMetricComparison(c.errorRate) &&
    isValidMetricComparison(c.throughput)
  );
}

/**
 * latency 지표(p50/p95/p99) 한 줄을 포맷한다 — base/cand 는 ms 단위, delta 는 명시 부호.
 * 회귀했으면 `REGRESSED`, 아니면 `ok` 로 표기한다. NaN 지표(빈 표본)는 "n/a".
 */
function formatLatencyMetricLine(name: string, m: MetricComparison): string {
  return (
    `${name}: base=${fmt(m.baseline, 1)}ms cand=${fmt(m.candidate, 1)}ms ` +
    `delta=${fmtDelta(m.delta, 1)}ms ${m.regressed ? "REGRESSED" : "ok"}`
  );
}

/**
 * `compareBaselineReports` 가 반환한 `BaselineComparison` 을 사람-친화 + 파싱 용이한
 * 여러 줄 문자열로 포맷한다. 지표별로 baseline·candidate·delta·회귀 표시를 렌더링한다.
 *
 * - 헤더 1줄: 종합 `regressed=true|false`.
 * - latency 3종(p50/p95/p99): `p95: base=15.0ms cand=18.0ms delta=+3.0ms REGRESSED|ok`.
 * - errorRate: 퍼센트 표기(`err: base=0.00% cand=2.00% delta=+2.00% REGRESSED|ok`).
 * - throughput: §3 상 관찰 전용이라 회귀 표시 대신 delta 만 렌더링하고 "(관찰)" 로 판정
 *   제외임을 명시한다(req/s 단위).
 *
 * NaN 지표(빈 표본)는 `formatBaselineLine` 과 동형으로 "n/a" 로 방어적으로 표기하고,
 * delta 부호는 명시(증가 `+`, 감소 `-`, 0 은 부호 없음)한다. 지표 재계산·재판정 없이
 * `BaselineComparison` 의 이미 파생된 값만 그대로 전사한다(관찰·리포트 전용).
 *
 * @throws {TypeError} `comparison` 이 유효 `BaselineComparison` 형태가 아닐 때(최소한
 *   p50/p95/p99/errorRate/throughput 이 `MetricComparison` 형태이고 최상위 `regressed`
 *   가 boolean 인지 검사).
 */
export function formatComparisonReport(comparison: BaselineComparison): string {
  if (!isValidComparison(comparison)) {
    throw new TypeError(
      "formatComparisonReport: comparison 은 유효한 BaselineComparison 형태여야 함",
    );
  }
  const er = comparison.errorRate;
  const tp = comparison.throughput;
  const lines = [
    `regressed=${comparison.regressed}`,
    formatLatencyMetricLine("p50", comparison.p50),
    formatLatencyMetricLine("p95", comparison.p95),
    formatLatencyMetricLine("p99", comparison.p99),
    // errorRate 는 비율이라 퍼센트로 렌더링(base*100, delta*100).
    `err: base=${fmt(er.baseline * 100, 2)}% cand=${fmt(er.candidate * 100, 2)}% ` +
      `delta=${fmtDelta(er.delta * 100, 2)}% ${er.regressed ? "REGRESSED" : "ok"}`,
    // throughput 은 §3 관찰 전용 — 회귀 표시 없이 delta 만 + "(관찰)" 로 판정 제외 명시.
    `throughput: base=${fmt(tp.baseline, 2)}req/s cand=${fmt(tp.candidate, 2)}req/s ` +
      `delta=${fmtDelta(tp.delta, 2)}req/s (관찰)`,
  ];
  return lines.join("\n");
}

/**
 * 저장된 두 baseline JSON 문자열(기준 baseline·새 측정 candidate)을 받아 parse→compare→
 * format 을 순서대로 이어붙이는 **얇은 합성 순수 함수**다. 실 §5 #5 harness 가 디스크에서
 * 로드한 두 JSON 만 넘기면 `{ comparison, report }` 를 받도록 하는 단일 진입점이다.
 *
 * 처리 순서(신규 판정·계산 로직 0 — 하위 primitive 를 조립만):
 *  1. `parseBaselineReport(baselineJson)` / `parseBaselineReport(candidateJson)` 로 각각
 *     `BaselineReport` 복원(NaN sentinel round-trip 포함).
 *  2. `compareBaselineReports(baseline, candidate, options)` 로 `BaselineComparison` 산출.
 *  3. `formatComparisonReport(comparison)` 로 사람-친화 문자열 산출.
 *  4. `{ comparison, report }` 반환 — `report` 는 반환 `comparison` 에서 파생되어 정합 보장.
 *
 * delta·회귀 판정·NaN 방어·포맷은 전부 하위 primitive 가 이미 책임진다. `options` 미지정 시
 * `compareBaselineReports` 기본 tolerance(latency 0.10 / errorRate 0.01)를 그대로 사용한다.
 *
 * **오류 전파(재래핑 없음)** — 하위 primitive 예외를 그대로 propagate 한다. 별도 error 타입을
 * 새로 만들지 않는다(합성이라 하위 계약을 그대로 노출).
 *
 * @throws {SyntaxError} `baselineJson` 또는 `candidateJson` 이 유효 JSON 이 아닐 때
 *   (`parseBaselineReport` → `JSON.parse` 가 던지는 그대로, 빈 문자열 포함).
 * @throws {TypeError} JSON 은 유효하나 `BaselineReport` 형태가 불량할 때
 *   (`parseBaselineReport` 가드에서 propagate).
 * @throws {RangeError} `options.latencyTolerance` / `errorRateTolerance` 가 음수·NaN 일 때
 *   (`compareBaselineReports` 에서 propagate).
 */
export function compareBaselineJson(
  baselineJson: string,
  candidateJson: string,
  options?: CompareOptions,
): { comparison: BaselineComparison; report: string } {
  // 1. 저장 JSON 2개를 각각 BaselineReport 로 복원(잘못된 JSON·형태 불량은 여기서 propagate).
  const baseline = parseBaselineReport(baselineJson);
  const candidate = parseBaselineReport(candidateJson);
  // 2. 두 리포트를 비교(tolerance 음수·NaN 은 여기서 RangeError propagate).
  const comparison = compareBaselineReports(baseline, candidate, options);
  // 3. 비교 결과를 사람-친화 문자열로 포맷(반환 comparison 에서 파생 → 정합 보장).
  const report = formatComparisonReport(comparison);
  return { comparison, report };
}

/** baseline 파일명 고정 prefix(디렉토리 없는 basename 앞부분). 상수 고정 — env override 금지. */
const BASELINE_FILENAME_PREFIX = "baseline-";
/** baseline 파일명 고정 확장자. 상수 고정 — env override 금지. */
const BASELINE_FILENAME_EXT = ".json";

/**
 * env-meta 의 `label` 을 FS-safe slug 으로 정규화한다:
 * 소문자화 → 영숫자·하이픈 외 문자(공백·`/`·`\`·`:`·`.`·유니코드 등)를 단일 하이픈으로 치환
 * → 선행/후행 하이픈 trim → 연속 하이픈 축약. 파일명 유도의 결정성·FS 안전성의 핵심.
 *
 * 정규화 결과가 빈 string 이 되는 label(구분자·비-ASCII 로만 구성 등)은 유의미한 파일명을
 * 유도할 수 없으므로 여기서는 빈 string 을 반환하고, 호출측이 `RangeError` 로 처리한다.
 */
function slugifyLabel(label: string): string {
  return (
    label
      .toLowerCase()
      // 영숫자(ASCII a-z0-9) 외 모든 문자(공백·구분자·유니코드 포함)를 하이픈으로.
      .replace(/[^a-z0-9]+/g, "-")
      // 선행/후행 하이픈 제거(위 치환 결과 양끝에 남은 하이픈 정리 = 연속 축약도 겸함).
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * `BaselineEnvMeta`(특히 `label`)로부터 baseline JSON 파일명(디렉토리 없는 basename)을
 * **결정적(deterministic)·파일시스템-안전(FS-safe)** 하게 유도하는 순수 함수다.
 * 저장 harness(§5 #4·#5)가 `serializeBaselineReport` 결과를 어떤 파일명으로 쓸지, 조회
 * harness 가 어떤 파일명에서 기준 baseline 을 읽을지 결정하는 단일 명명 진입점이다.
 *
 * 유도 규칙:
 *  1. `env` 가 유효 `BaselineEnvMeta` 형태가 아니면(`isValidEnvMeta` 재사용) `TypeError`.
 *  2. `env.label` 이 빈 string 또는 공백-only 이면 `RangeError`
 *     (`buildBaselineReport` 의 label 계약과 동형 — 파일명의 유의미성 보장).
 *  3. `label` 을 `slugifyLabel` 로 FS-safe slug 으로 정규화. 정규화 결과가 빈 string 이
 *     되는 label(구분자·비-ASCII 로만 구성 등)은 유의미한 파일명 유도 불가라 `RangeError`.
 *  4. 고정 prefix + slug + 고정 확장자로 basename 조립(예: `baseline-ci-linux-x64.json`).
 *
 * **결정성** — 정규화 후 동일 slug 을 낳는 label(대소문자만 다른 `"CI-Linux"`/`"ci-linux"`
 * 포함)은 항상 같은 파일명을 낳는다(저장·조회 파일명 일치의 핵심).
 * **순수·부작용 0** — `fs`·`path` 조인·디렉토리 조립·환경 read 없음. 문자열 유도만.
 * 디렉토리 결합(예: `test/perf/baselines/<name>`)은 본 함수 밖(disk harness) 책임이다.
 *
 * @throws {TypeError} `env` 가 유효 `BaselineEnvMeta` 형태가 아닐 때.
 * @throws {RangeError} `label` 이 빈/공백-only 이거나, 정규화 slug 이 빈 string 이 될 때.
 */
export function resolveBaselineFilename(env: BaselineEnvMeta): string {
  if (!isValidEnvMeta(env)) {
    throw new TypeError(
      "resolveBaselineFilename: env 는 { label:string, concurrency:number } 형태여야 함",
    );
  }
  if (env.label.trim() === "") {
    throw new RangeError(
      "resolveBaselineFilename: env.label 은 빈 string 일 수 없음",
    );
  }
  const slug = slugifyLabel(env.label);
  if (slug === "") {
    throw new RangeError(
      `resolveBaselineFilename: env.label 을 FS-safe slug 으로 정규화한 결과가 빈 string 임 (받은 label: ${JSON.stringify(env.label)})`,
    );
  }
  return `${BASELINE_FILENAME_PREFIX}${slug}${BASELINE_FILENAME_EXT}`;
}
