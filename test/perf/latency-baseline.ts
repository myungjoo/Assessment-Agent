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
