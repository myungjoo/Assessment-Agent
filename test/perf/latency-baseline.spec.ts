import {
  buildBaselineReport,
  formatBaselineLine,
  BaselineEnvMeta,
  BaselineReport,
} from "./latency-baseline";
import { S2Assertion } from "./latency-collector";
import { LatencySummary } from "./latency-metrics";

/**
 * T-0862 — S2 latency baseline 리포트 순수 함수의 R-112 spec.
 * happy-path / error path / flow·branch / negative cases 충분 cover.
 * 순수 함수라 DB·네트워크 없이 결정론적으로 검증한다(colocated unit).
 */
describe("latency-baseline 리포트 순수 함수 (S2)", () => {
  /** 완전한 env-meta(optional 필드 포함) 팩토리. */
  function fullEnv(overrides: Partial<BaselineEnvMeta> = {}): BaselineEnvMeta {
    return {
      label: "ci-linux-x64",
      concurrency: 4,
      cpu: "8x Xeon",
      memoryMb: 16384,
      dataScale: "100 persons x 50 repos",
      ...overrides,
    };
  }

  /** 정상 `S2Assertion`(pass=true, 표본 있음) 팩토리. */
  function passAssertion(overrides: Partial<S2Assertion> = {}): S2Assertion {
    const summary: LatencySummary = {
      p50: 10,
      p95: 15,
      p99: 20,
      count: 6,
      maxMs: 22,
    };
    return {
      pass: true,
      summary,
      errorRate: 0,
      throughput: 100,
      reasons: [],
      ...overrides,
    };
  }

  /** 빈 표본(count=0, p95=NaN) 실패 `S2Assertion` 팩토리. */
  function emptyAssertion(): S2Assertion {
    const summary: LatencySummary = {
      p50: NaN,
      p95: NaN,
      p99: NaN,
      count: 0,
      maxMs: NaN,
    };
    return {
      pass: false,
      summary,
      errorRate: 0,
      throughput: 0,
      reasons: ["측정 불가: 성공 표본이 없어 p95 를 산출할 수 없음"],
    };
  }

  describe("buildBaselineReport — happy path", () => {
    it("정상 assertion + 완전한 env-meta → 지표를 정확히 전사", () => {
      const report = buildBaselineReport(fullEnv(), passAssertion());
      expect(report.p50).toBe(10);
      expect(report.p95).toBe(15);
      expect(report.p99).toBe(20);
      expect(report.throughput).toBe(100);
      expect(report.errorRate).toBe(0);
      expect(report.count).toBe(6);
      expect(report.pass).toBe(true);
      // env-meta 는 그대로 보존.
      expect(report.env.label).toBe("ci-linux-x64");
      expect(report.env.concurrency).toBe(4);
    });

    it("지표를 재계산하지 않고 assertion 값을 그대로 파생(판정 로직 불변)", () => {
      // assertion 에 임의 값을 넣어도 그대로 전사됨을 확인.
      const a = passAssertion({
        summary: { p50: 1.5, p95: 2.5, p99: 3.5, count: 3, maxMs: 4 },
        throughput: 42.42,
        errorRate: 0.005,
      });
      const report = buildBaselineReport(fullEnv(), a);
      expect(report.p50).toBe(1.5);
      expect(report.throughput).toBe(42.42);
      expect(report.errorRate).toBe(0.005);
      expect(report.count).toBe(3);
    });
  });

  describe("formatBaselineLine — happy path", () => {
    it("완전한 리포트 → 기대 한 줄(key=value, optional env-meta 포함)", () => {
      const report = buildBaselineReport(fullEnv(), passAssertion());
      const line = formatBaselineLine(report);
      expect(line).toBe(
        "[ci-linux-x64] p50=10.0ms p95=15.0ms p99=20.0ms tput=100.00req/s " +
          "err=0.00% count=6 pass=true concurrency=4 cpu=8x Xeon " +
          "memoryMb=16384 dataScale=100 persons x 50 repos",
      );
    });
  });

  describe("buildBaselineReport — error path / negative cases", () => {
    it("label 빈 string → RangeError", () => {
      expect(() =>
        buildBaselineReport(fullEnv({ label: "" }), passAssertion()),
      ).toThrow(RangeError);
    });

    it("label 공백-only(trim 후 빈 값) → RangeError", () => {
      expect(() =>
        buildBaselineReport(fullEnv({ label: "   " }), passAssertion()),
      ).toThrow(RangeError);
    });

    it("env null → TypeError", () => {
      expect(() =>
        buildBaselineReport(
          null as unknown as BaselineEnvMeta,
          passAssertion(),
        ),
      ).toThrow(TypeError);
    });

    it("env undefined → TypeError", () => {
      expect(() =>
        buildBaselineReport(
          undefined as unknown as BaselineEnvMeta,
          passAssertion(),
        ),
      ).toThrow(TypeError);
    });

    it("env.concurrency 누락(비수치) → TypeError", () => {
      const bad = { label: "x" } as unknown as BaselineEnvMeta;
      expect(() => buildBaselineReport(bad, passAssertion())).toThrow(
        TypeError,
      );
    });

    it("env.concurrency 음수 → RangeError", () => {
      expect(() =>
        buildBaselineReport(fullEnv({ concurrency: -1 }), passAssertion()),
      ).toThrow(RangeError);
    });

    it("env.concurrency NaN → RangeError", () => {
      expect(() =>
        buildBaselineReport(fullEnv({ concurrency: NaN }), passAssertion()),
      ).toThrow(RangeError);
    });

    it("assertion 형태 불량(summary 누락) → TypeError", () => {
      const bad = {
        pass: true,
        errorRate: 0,
        throughput: 1,
        reasons: [],
      } as unknown as S2Assertion;
      expect(() => buildBaselineReport(fullEnv(), bad)).toThrow(TypeError);
    });

    it("assertion null → TypeError", () => {
      expect(() =>
        buildBaselineReport(fullEnv(), null as unknown as S2Assertion),
      ).toThrow(TypeError);
    });
  });

  describe("buildBaselineReport — branch/flow: pass=true vs pass=false", () => {
    it("pass=false(reasons 비어있지 않음) 리포트도 정확히 전사", () => {
      const a = passAssertion({
        pass: false,
        reasons: ["p95 임계 초과: p95=5000ms >= 상한 3000ms (REQ-048)"],
      });
      const report = buildBaselineReport(fullEnv(), a);
      expect(report.pass).toBe(false);
    });
  });

  describe("formatBaselineLine — branch/flow + negative cases", () => {
    it("(a) 빈 표본(count=0, p95=NaN) → NaN 지표를 'n/a' 로 방어적 포맷", () => {
      const report = buildBaselineReport(fullEnv(), emptyAssertion());
      const line = formatBaselineLine(report);
      expect(line).toContain("p50=n/a");
      expect(line).toContain("p95=n/a");
      expect(line).toContain("p99=n/a");
      expect(line).toContain("tput=0.00req/s");
      expect(line).toContain("count=0");
      expect(line).toContain("pass=false");
    });

    it("(b) errorRate>0 인 부분 실패 리포트 → err 퍼센트 포맷", () => {
      const a = passAssertion({ errorRate: 0.05 });
      const report = buildBaselineReport(fullEnv(), a);
      expect(formatBaselineLine(report)).toContain("err=5.00%");
    });

    it("errorRate=0 vs 0 초과 분기 — 0 은 0.00%", () => {
      const report = buildBaselineReport(fullEnv(), passAssertion());
      expect(formatBaselineLine(report)).toContain("err=0.00%");
    });

    it("throughput=0(성공 표본 0) 분기 → tput=0.00req/s", () => {
      const report = buildBaselineReport(fullEnv(), emptyAssertion());
      expect(formatBaselineLine(report)).toContain("tput=0.00req/s");
    });

    it("pass=true 분기 → pass=true 표기", () => {
      const report = buildBaselineReport(fullEnv(), passAssertion());
      expect(formatBaselineLine(report)).toContain("pass=true");
    });

    it("(c) optional env-meta(cpu/memoryMb/dataScale) 누락에도 포맷 성립", () => {
      const env = fullEnv({
        cpu: undefined,
        memoryMb: undefined,
        dataScale: undefined,
      });
      const report = buildBaselineReport(env, passAssertion());
      const line = formatBaselineLine(report);
      // 필수 필드는 있고 optional 은 붙지 않는다.
      expect(line).toContain("[ci-linux-x64]");
      expect(line).toContain("concurrency=4");
      expect(line).not.toContain("cpu=");
      expect(line).not.toContain("memoryMb=");
      expect(line).not.toContain("dataScale=");
    });

    it("optional 중 일부만 지정(cpu 만) → 그 하나만 덧붙음", () => {
      const env = fullEnv({
        cpu: "4x ARM",
        memoryMb: undefined,
        dataScale: undefined,
      });
      const report = buildBaselineReport(env, passAssertion());
      const line = formatBaselineLine(report);
      expect(line).toContain("cpu=4x ARM");
      expect(line).not.toContain("memoryMb=");
      expect(line).not.toContain("dataScale=");
    });

    it("report null → TypeError", () => {
      expect(() =>
        formatBaselineLine(null as unknown as BaselineReport),
      ).toThrow(TypeError);
    });

    it("report.env 형태 불량 → TypeError", () => {
      const bad = { p50: 1 } as unknown as BaselineReport;
      expect(() => formatBaselineLine(bad)).toThrow(TypeError);
    });
  });
});
