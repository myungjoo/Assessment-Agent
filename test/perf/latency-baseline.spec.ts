import {
  buildBaselineReport,
  formatBaselineLine,
  compareBaselineReports,
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

  describe("compareBaselineReports — 회귀 비교 순수 함수 (T-0863)", () => {
    /** 지정 지표로 정상 `BaselineReport` 를 만드는 팩토리(env·pass 는 고정). */
    function report(overrides: Partial<BaselineReport> = {}): BaselineReport {
      return {
        env: fullEnv(),
        p50: 10,
        p95: 15,
        p99: 20,
        throughput: 100,
        errorRate: 0,
        count: 6,
        pass: true,
        ...overrides,
      };
    }

    describe("happy path", () => {
      it("동일 baseline·candidate → 회귀 없음(regressed=false) + delta 0", () => {
        const cmp = compareBaselineReports(report(), report());
        expect(cmp.regressed).toBe(false);
        expect(cmp.p50.delta).toBe(0);
        expect(cmp.p95.delta).toBe(0);
        expect(cmp.p99.delta).toBe(0);
        expect(cmp.errorRate.delta).toBe(0);
        expect(cmp.throughput.delta).toBe(0);
        // 지표별 회귀 플래그도 전부 false.
        expect(cmp.p95.regressed).toBe(false);
        expect(cmp.errorRate.regressed).toBe(false);
      });

      it("허용치 안(+5% latency, errorRate 동일) → 회귀 없음 + 지표별 delta 정확", () => {
        // p95 10→10.5(+5%, 기본 tolerance 0.10 안), 나머지 동일.
        const base = report({ p95: 10 });
        const cand = report({ p95: 10.5 });
        const cmp = compareBaselineReports(base, cand);
        expect(cmp.regressed).toBe(false);
        expect(cmp.p95.delta).toBeCloseTo(0.5, 10);
        expect(cmp.p95.baseline).toBe(10);
        expect(cmp.p95.candidate).toBe(10.5);
        expect(cmp.p95.regressed).toBe(false);
      });
    });

    describe("error path — 형태 가드 / tolerance 검증", () => {
      it("baseline 이 유효 형태 아님(env 누락) → TypeError", () => {
        const bad = { p50: 1, p95: 2, p99: 3, throughput: 4, errorRate: 0 };
        expect(() =>
          compareBaselineReports(bad as unknown as BaselineReport, report()),
        ).toThrow(TypeError);
      });

      it("candidate 가 유효 형태 아님(p95 비수치) → TypeError", () => {
        const bad = report({ p95: "x" as unknown as number });
        expect(() => compareBaselineReports(report(), bad)).toThrow(TypeError);
      });

      it("baseline null → TypeError", () => {
        expect(() =>
          compareBaselineReports(null as unknown as BaselineReport, report()),
        ).toThrow(TypeError);
      });

      it("latencyTolerance 음수 → RangeError", () => {
        expect(() =>
          compareBaselineReports(report(), report(), {
            latencyTolerance: -0.1,
          }),
        ).toThrow(RangeError);
      });

      it("latencyTolerance NaN → RangeError", () => {
        expect(() =>
          compareBaselineReports(report(), report(), {
            latencyTolerance: NaN,
          }),
        ).toThrow(RangeError);
      });

      it("errorRateTolerance 음수 → RangeError", () => {
        expect(() =>
          compareBaselineReports(report(), report(), {
            errorRateTolerance: -0.01,
          }),
        ).toThrow(RangeError);
      });

      it("errorRateTolerance NaN → RangeError", () => {
        expect(() =>
          compareBaselineReports(report(), report(), {
            errorRateTolerance: NaN,
          }),
        ).toThrow(RangeError);
      });
    });

    describe("flow / branch coverage", () => {
      it("(1) latency 회귀 — candidate p95 가 tolerance 초과 증가 → regressed=true", () => {
        // p95 10→12(+20% > 기본 10%) → 회귀.
        const cmp = compareBaselineReports(
          report({ p95: 10 }),
          report({ p95: 12 }),
        );
        expect(cmp.p95.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
        expect(cmp.p95.delta).toBeCloseTo(2, 10);
      });

      it("(2) errorRate 회귀 — candidate 가 허용 절대치 초과 증가 → regressed=true", () => {
        // errorRate 0→0.02(delta 0.02 > 기본 0.01) → 회귀.
        const cmp = compareBaselineReports(
          report({ errorRate: 0 }),
          report({ errorRate: 0.02 }),
        );
        expect(cmp.errorRate.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
        expect(cmp.errorRate.delta).toBeCloseTo(0.02, 10);
      });

      it("(3a) tolerance 경계 — 정확히 tolerance 만큼 증가는 회귀 아님", () => {
        // p95 10→11(+10% == 기본 tolerance) → 회귀 아님(초과 아님).
        const cmp = compareBaselineReports(
          report({ p95: 10 }),
          report({ p95: 11 }),
        );
        expect(cmp.p95.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("(3b) tolerance 경계 — tolerance 초과(아주 조금)는 회귀", () => {
        // p95 10→11.001(+10.01% > 10%) → 회귀.
        const cmp = compareBaselineReports(
          report({ p95: 10 }),
          report({ p95: 11.001 }),
        );
        expect(cmp.p95.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
      });

      it("(4) NaN 지표 제외 — baseline p95 가 NaN → 그 지표 판정 제외(delta NaN, regressed=false)", () => {
        const cmp = compareBaselineReports(
          report({ p95: NaN }),
          report({ p95: 15 }),
        );
        expect(Number.isNaN(cmp.p95.delta)).toBe(true);
        expect(cmp.p95.regressed).toBe(false);
        // 다른 지표가 정상이면 종합도 회귀 아님.
        expect(cmp.regressed).toBe(false);
      });

      it("(5) candidate 만 NaN(측정 소실) → 그 지표 회귀 + 종합 회귀", () => {
        const cmp = compareBaselineReports(
          report({ p95: 15 }),
          report({ p95: NaN }),
        );
        expect(Number.isNaN(cmp.p95.delta)).toBe(true);
        expect(cmp.p95.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
      });

      it("baseline·candidate 모두 NaN(양쪽 빈 표본) → 제외(측정 소실 아님)", () => {
        const cmp = compareBaselineReports(
          report({ p95: NaN }),
          report({ p95: NaN }),
        );
        expect(Number.isNaN(cmp.p95.delta)).toBe(true);
        expect(cmp.p95.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("(4-er) errorRate baseline NaN → 판정 제외(delta NaN, regressed=false)", () => {
        const cmp = compareBaselineReports(
          report({ errorRate: NaN }),
          report({ errorRate: 0.02 }),
        );
        expect(Number.isNaN(cmp.errorRate.delta)).toBe(true);
        expect(cmp.errorRate.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("(5-er) errorRate candidate 만 NaN(측정 소실) → 그 지표 회귀 + 종합 회귀", () => {
        const cmp = compareBaselineReports(
          report({ errorRate: 0.01 }),
          report({ errorRate: NaN }),
        );
        expect(Number.isNaN(cmp.errorRate.delta)).toBe(true);
        expect(cmp.errorRate.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
      });

      it("throughput 어느 한쪽 NaN → delta NaN, 관찰 전용이라 regressed=false", () => {
        const cmp = compareBaselineReports(
          report({ throughput: NaN }),
          report({ throughput: 100 }),
        );
        expect(Number.isNaN(cmp.throughput.delta)).toBe(true);
        expect(cmp.throughput.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });
    });

    describe("negative cases 충분 cover", () => {
      it("빈 표본(count=0, p95=NaN) baseline vs 정상 candidate → latency 판정 제외", () => {
        const emptyBase = report({
          p50: NaN,
          p95: NaN,
          p99: NaN,
          throughput: 0,
          count: 0,
          pass: false,
        });
        const cmp = compareBaselineReports(emptyBase, report());
        // 모든 latency 지표 baseline NaN → 제외, errorRate 동일 → 회귀 아님.
        expect(cmp.p50.regressed).toBe(false);
        expect(cmp.p95.regressed).toBe(false);
        expect(cmp.p99.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("throughput 이 크게 나빠져도(급감) 회귀 판정에 반영 안 됨(관찰 전용)", () => {
        // throughput 100→10 급감, latency·errorRate 는 동일.
        const cmp = compareBaselineReports(
          report({ throughput: 100 }),
          report({ throughput: 10 }),
        );
        expect(cmp.throughput.delta).toBe(-90);
        expect(cmp.throughput.regressed).toBe(false);
        // throughput 은 종합 회귀에 절대 반영 안 됨.
        expect(cmp.regressed).toBe(false);
      });

      it("throughput 이 개선(증가)해도 regressed=false, delta 만 리포트", () => {
        const cmp = compareBaselineReports(
          report({ throughput: 100 }),
          report({ throughput: 250 }),
        );
        expect(cmp.throughput.delta).toBe(150);
        expect(cmp.throughput.regressed).toBe(false);
      });

      it("errorRate 개선(감소) → 회귀 아님 + delta 음수", () => {
        const cmp = compareBaselineReports(
          report({ errorRate: 0.05 }),
          report({ errorRate: 0.01 }),
        );
        expect(cmp.errorRate.delta).toBeCloseTo(-0.04, 10);
        expect(cmp.errorRate.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("latency 개선(감소) → delta 음수 + 회귀 아님", () => {
        const cmp = compareBaselineReports(
          report({ p95: 20 }),
          report({ p95: 12 }),
        );
        expect(cmp.p95.delta).toBe(-8);
        expect(cmp.p95.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("tolerance=0 극단값 — baseline 초과 증가는 즉시 회귀", () => {
        // p95 10→10.001(+0.01%)도 tolerance=0 이면 회귀.
        const cmp = compareBaselineReports(
          report({ p95: 10 }),
          report({ p95: 10.001 }),
          { latencyTolerance: 0 },
        );
        expect(cmp.p95.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
      });

      it("tolerance=0 극단값 — 정확히 동일하면 회귀 아님", () => {
        const cmp = compareBaselineReports(
          report({ p95: 10 }),
          report({ p95: 10 }),
          { latencyTolerance: 0 },
        );
        expect(cmp.p95.regressed).toBe(false);
        expect(cmp.regressed).toBe(false);
      });

      it("baseline p95=0(경계) + candidate 증가 → 허용 절대량 0 이라 회귀", () => {
        const cmp = compareBaselineReports(
          report({ p95: 0 }),
          report({ p95: 1 }),
        );
        expect(cmp.p95.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
      });

      it("errorRateTolerance 커스텀(0.005) 경계 — 초과분만 회귀", () => {
        // delta 0.006 > 0.005 → 회귀.
        const cmp = compareBaselineReports(
          report({ errorRate: 0 }),
          report({ errorRate: 0.006 }),
          { errorRateTolerance: 0.005 },
        );
        expect(cmp.errorRate.regressed).toBe(true);
        expect(cmp.regressed).toBe(true);
      });
    });
  });
});
