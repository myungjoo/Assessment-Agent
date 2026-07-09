import {
  buildBaselineReport,
  formatBaselineLine,
  compareBaselineReports,
  formatComparisonReport,
  compareBaselineJson,
  resolveBaselineFilename,
  serializeBaselineReport,
  parseBaselineReport,
  BaselineEnvMeta,
  BaselineReport,
  BaselineComparison,
  MetricComparison,
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

  describe("serialize/parse baseline 영속화 순수 함수 (T-0864)", () => {
    /** 지정 지표로 정상 `BaselineReport` 를 만드는 팩토리(env·pass 는 기본 full). */
    function report(overrides: Partial<BaselineReport> = {}): BaselineReport {
      return {
        env: fullEnv(),
        p50: 10,
        p95: 15,
        p99: 20,
        throughput: 100,
        errorRate: 0.005,
        count: 6,
        pass: true,
        ...overrides,
      };
    }

    describe("happy path — round-trip 동등", () => {
      it("완전한 리포트(유한 수치+optional env-meta 전부) → round-trip 원본 동등", () => {
        const original = report();
        const restored = parseBaselineReport(serializeBaselineReport(original));
        // 지표 정확 복원.
        expect(restored.p50).toBe(10);
        expect(restored.p95).toBe(15);
        expect(restored.p99).toBe(20);
        expect(restored.throughput).toBe(100);
        expect(restored.errorRate).toBe(0.005);
        expect(restored.count).toBe(6);
        expect(restored.pass).toBe(true);
        // env-meta 전부 보존.
        expect(restored.env).toEqual({
          label: "ci-linux-x64",
          concurrency: 4,
          cpu: "8x Xeon",
          memoryMb: 16384,
          dataScale: "100 persons x 50 repos",
        });
        // 통째 동등.
        expect(restored).toEqual(original);
      });

      it("buildBaselineReport 산출물도 그대로 round-trip 동등", () => {
        const built = buildBaselineReport(fullEnv(), passAssertion());
        const restored = parseBaselineReport(serializeBaselineReport(built));
        expect(restored).toEqual(built);
      });

      it("직렬화 결과는 JSON.parse 가능한 유효 JSON(sentinel 미포함 정상 케이스)", () => {
        const json = serializeBaselineReport(report());
        expect(() => JSON.parse(json) as unknown).not.toThrow();
        const obj = JSON.parse(json) as Record<string, unknown>;
        expect(obj.p95).toBe(15);
        expect(obj.pass).toBe(true);
      });
    });

    describe("flow / branch — NaN sentinel round-trip", () => {
      it("(1) 빈 표본(p50/p95/p99=NaN) 직렬화 → sentinel 저장 + 역직렬화 시 NaN 복원", () => {
        const empty = report({
          p50: NaN,
          p95: NaN,
          p99: NaN,
          throughput: 0,
          count: 0,
          pass: false,
        });
        const json = serializeBaselineReport(empty);
        // JSON 안에 NaN 리터럴이 아니라 sentinel 문자열이 들어간다(유효 JSON).
        expect(json).not.toContain("NaN,");
        expect(json).toContain("__NaN__");
        const parsedRaw = JSON.parse(json) as Record<string, unknown>;
        expect(parsedRaw.p95).toBe("__NaN__");
        // 역직렬화 시 NaN 으로 복원.
        const restored = parseBaselineReport(json);
        expect(Number.isNaN(restored.p50)).toBe(true);
        expect(Number.isNaN(restored.p95)).toBe(true);
        expect(Number.isNaN(restored.p99)).toBe(true);
        expect(restored.throughput).toBe(0);
        expect(restored.count).toBe(0);
        expect(restored.pass).toBe(false);
      });

      it("(1-mix) 일부만 NaN(p95 만 빈 값) → 그 지표만 sentinel, 나머지 유한 복원", () => {
        const mixed = report({ p95: NaN });
        const restored = parseBaselineReport(serializeBaselineReport(mixed));
        expect(restored.p50).toBe(10);
        expect(Number.isNaN(restored.p95)).toBe(true);
        expect(restored.p99).toBe(20);
      });

      it("(2a) optional env-meta 전부 지정 → 전부 보존 round-trip", () => {
        const restored = parseBaselineReport(serializeBaselineReport(report()));
        expect(restored.env.cpu).toBe("8x Xeon");
        expect(restored.env.memoryMb).toBe(16384);
        expect(restored.env.dataScale).toBe("100 persons x 50 repos");
      });

      it("(2b) optional env-meta 전부 미지정 → round-trip 후에도 미지정 유지", () => {
        const env = fullEnv({
          cpu: undefined,
          memoryMb: undefined,
          dataScale: undefined,
        });
        const bare = report({ env });
        const json = serializeBaselineReport(bare);
        // 미지정 optional 은 직렬화 JSON 에 아예 키가 없어야 한다.
        const rawEnv = (JSON.parse(json) as { env: Record<string, unknown> })
          .env;
        expect("cpu" in rawEnv).toBe(false);
        expect("memoryMb" in rawEnv).toBe(false);
        expect("dataScale" in rawEnv).toBe(false);
        const restored = parseBaselineReport(json);
        expect(restored.env.cpu).toBeUndefined();
        expect(restored.env.memoryMb).toBeUndefined();
        expect(restored.env.dataScale).toBeUndefined();
        expect(restored.env).toEqual({ label: "ci-linux-x64", concurrency: 4 });
      });

      it("(2c) optional 중 일부만 지정(cpu 만) → 그 하나만 보존", () => {
        const env = fullEnv({
          cpu: "4x ARM",
          memoryMb: undefined,
          dataScale: undefined,
        });
        const restored = parseBaselineReport(
          serializeBaselineReport(report({ env })),
        );
        expect(restored.env.cpu).toBe("4x ARM");
        expect(restored.env.memoryMb).toBeUndefined();
        expect(restored.env.dataScale).toBeUndefined();
      });

      it("(3) throughput=0(빈 표본 관찰값) 정상 round-trip", () => {
        const restored = parseBaselineReport(
          serializeBaselineReport(report({ throughput: 0 })),
        );
        expect(restored.throughput).toBe(0);
      });

      it("(4) 파싱 성공 분기 vs 형태 가드 실패 분기 — 유효 JSON 은 성공", () => {
        // 성공 분기.
        expect(() =>
          parseBaselineReport(serializeBaselineReport(report())),
        ).not.toThrow();
      });
    });

    describe("error path — serialize 입력 형태 불량", () => {
      it("serializeBaselineReport 에 env 누락 리포트 → TypeError", () => {
        const bad = { p50: 1, p95: 2, p99: 3, throughput: 4, errorRate: 0 };
        expect(() =>
          serializeBaselineReport(bad as unknown as BaselineReport),
        ).toThrow(TypeError);
      });

      it("serializeBaselineReport 에 null → TypeError", () => {
        expect(() =>
          serializeBaselineReport(null as unknown as BaselineReport),
        ).toThrow(TypeError);
      });

      it("serializeBaselineReport 에 p95 비수치(string) → TypeError", () => {
        const bad = report({ p95: "x" as unknown as number });
        expect(() => serializeBaselineReport(bad)).toThrow(TypeError);
      });
    });

    describe("error path — parse 실패 / 형태 불량", () => {
      it("(1) 잘못된 JSON 문자열 → SyntaxError", () => {
        expect(() => parseBaselineReport("{not valid json")).toThrow(
          SyntaxError,
        );
      });

      it("빈 문자열 파싱 → SyntaxError", () => {
        expect(() => parseBaselineReport("")).toThrow(SyntaxError);
      });

      it("(2) 유효 JSON 이나 형태 불량(env 누락) → TypeError", () => {
        expect(() => parseBaselineReport('{"p50":1}')).toThrow(TypeError);
      });

      it("배열 JSON(object 아님) → TypeError", () => {
        expect(() => parseBaselineReport("[1,2,3]")).toThrow(TypeError);
      });

      it("숫자 JSON(원시값) → TypeError", () => {
        expect(() => parseBaselineReport("42")).toThrow(TypeError);
      });

      it("null JSON → TypeError", () => {
        expect(() => parseBaselineReport("null")).toThrow(TypeError);
      });

      it("env 필드는 있으나 concurrency 누락(형태 불량) → TypeError", () => {
        expect(() =>
          parseBaselineReport('{"env":{"label":"x"},"p50":1}'),
        ).toThrow(TypeError);
      });

      it("p95 가 string(형태 불량, sentinel 아님) → TypeError", () => {
        const json = JSON.stringify({
          env: { label: "x", concurrency: 1 },
          p50: 1,
          p95: "not-a-number",
          p99: 3,
          throughput: 4,
          errorRate: 0,
          count: 1,
          pass: true,
        });
        expect(() => parseBaselineReport(json)).toThrow(TypeError);
      });

      it("p50 자리에 실제 null(sentinel 아님) → TypeError(형태 불량)", () => {
        const json = JSON.stringify({
          env: { label: "x", concurrency: 1 },
          p50: null,
          p95: 2,
          p99: 3,
          throughput: 4,
          errorRate: 0,
          count: 1,
          pass: true,
        });
        expect(() => parseBaselineReport(json)).toThrow(TypeError);
      });
    });

    describe("negative cases 충분 cover — round-trip 견고성", () => {
      it("pass=false 리포트도 정확히 round-trip(pass 분기)", () => {
        const restored = parseBaselineReport(
          serializeBaselineReport(report({ pass: false })),
        );
        expect(restored.pass).toBe(false);
      });

      it("errorRate=NaN(빈 표본) → sentinel 저장 후 NaN 복원", () => {
        const restored = parseBaselineReport(
          serializeBaselineReport(report({ errorRate: NaN })),
        );
        expect(Number.isNaN(restored.errorRate)).toBe(true);
      });

      it("음수/소수 지표(errorRate 0.0001)도 유한 수치로 정확 복원", () => {
        const restored = parseBaselineReport(
          serializeBaselineReport(report({ errorRate: 0.0001, p50: 3.14159 })),
        );
        expect(restored.errorRate).toBe(0.0001);
        expect(restored.p50).toBe(3.14159);
      });

      it("pass 필드가 JSON 에서 truthy 비-boolean 이어도 boolean 으로 정규화", () => {
        // pass:1 은 === true 가 아니므로 false 로 정규화(형태 방어).
        const json = JSON.stringify({
          env: { label: "x", concurrency: 1 },
          p50: 1,
          p95: 2,
          p99: 3,
          throughput: 4,
          errorRate: 0,
          count: 1,
          pass: 1,
        });
        expect(parseBaselineReport(json).pass).toBe(false);
      });

      it("count 누락 JSON → count 는 NaN 으로 방어 복원(형태 가드 통과)", () => {
        const json = JSON.stringify({
          env: { label: "x", concurrency: 1 },
          p50: 1,
          p95: 2,
          p99: 3,
          throughput: 4,
          errorRate: 0,
          pass: true,
        });
        const restored = parseBaselineReport(json);
        expect(Number.isNaN(restored.count)).toBe(true);
      });

      it("직렬화 JSON 은 env optional 키 순서와 무관하게 안정적으로 파싱", () => {
        // 수동 구성한 JSON(키 순서 다름)도 동일하게 복원.
        const json = JSON.stringify({
          pass: true,
          count: 2,
          errorRate: 0,
          throughput: 4,
          p99: 3,
          p95: 2,
          p50: 1,
          env: { concurrency: 8, label: "y", memoryMb: 512 },
        });
        const restored = parseBaselineReport(json);
        expect(restored.env.label).toBe("y");
        expect(restored.env.concurrency).toBe(8);
        expect(restored.env.memoryMb).toBe(512);
        expect(restored.p50).toBe(1);
      });
    });
  });

  describe("formatComparisonReport — 회귀 비교 결과 포맷 순수 함수 (T-0865)", () => {
    /** 지정 지표로 정상 `BaselineReport` 를 만드는 팩토리(env·pass 는 고정 full). */
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

    /** 유효 `MetricComparison` 을 만드는 팩토리(형태 불량 입력 구성용). */
    function metric(
      overrides: Partial<MetricComparison> = {},
    ): MetricComparison {
      return {
        baseline: 10,
        candidate: 10,
        delta: 0,
        regressed: false,
        ...overrides,
      };
    }

    /** 정상 `BaselineComparison` 을 만드는 팩토리(직접 구성 — compare 를 거치지 않음). */
    function comparison(
      overrides: Partial<BaselineComparison> = {},
    ): BaselineComparison {
      return {
        p50: metric(),
        p95: metric(),
        p99: metric(),
        errorRate: metric(),
        throughput: metric(),
        regressed: false,
        ...overrides,
      };
    }

    describe("happy path", () => {
      it("회귀 없는(regressed=false) 정상 비교 → 종합 false + 각 지표 base/cand/delta 표기", () => {
        const cmp = compareBaselineReports(report(), report());
        const out = formatComparisonReport(cmp);
        expect(out).toContain("regressed=false");
        // latency 지표: delta 0(부호 없음), ok.
        expect(out).toContain("p50: base=10.0ms cand=10.0ms delta=0.0ms ok");
        expect(out).toContain("p95: base=15.0ms cand=15.0ms delta=0.0ms ok");
        expect(out).toContain("p99: base=20.0ms cand=20.0ms delta=0.0ms ok");
        // errorRate 퍼센트 표기.
        expect(out).toContain("err: base=0.00% cand=0.00% delta=0.00% ok");
        // throughput 은 관찰 전용 — 회귀 표시 없이 "(관찰)".
        expect(out).toContain(
          "throughput: base=100.00req/s cand=100.00req/s delta=0.00req/s (관찰)",
        );
        // 결과 문자열에 REGRESSED 는 등장하지 않는다.
        expect(out).not.toContain("REGRESSED");
      });

      it("회귀 있는(regressed=true) 비교 → 회귀 지표에 REGRESSED 표시 + 종합 true", () => {
        // p95 10→12(+20% > 10%) → 회귀.
        const cmp = compareBaselineReports(
          report({ p95: 10 }),
          report({ p95: 12 }),
        );
        const out = formatComparisonReport(cmp);
        expect(out).toContain("regressed=true");
        expect(out).toContain(
          "p95: base=10.0ms cand=12.0ms delta=+2.0ms REGRESSED",
        );
        // 회귀 안 한 지표는 ok.
        expect(out).toContain("p50: base=10.0ms cand=10.0ms delta=0.0ms ok");
      });

      it("compareBaselineReports 산출물을 재계산·재판정 없이 그대로 전사", () => {
        // delta·regressed 를 임의 값으로 직접 구성해도 그대로 렌더링됨을 확인(파생값 전사).
        const cmp = comparison({
          p95: metric({ baseline: 5, candidate: 9, delta: 4, regressed: true }),
          regressed: true,
        });
        const out = formatComparisonReport(cmp);
        expect(out).toContain(
          "p95: base=5.0ms cand=9.0ms delta=+4.0ms REGRESSED",
        );
        expect(out).toContain("regressed=true");
      });
    });

    describe("error path — 형태 가드", () => {
      it("null 입력 → TypeError", () => {
        expect(() =>
          formatComparisonReport(null as unknown as BaselineComparison),
        ).toThrow(TypeError);
      });

      it("undefined 입력 → TypeError", () => {
        expect(() =>
          formatComparisonReport(undefined as unknown as BaselineComparison),
        ).toThrow(TypeError);
      });

      it("p95 가 MetricComparison 형태 아님(비-object) → TypeError", () => {
        const bad = comparison({ p95: 42 as unknown as MetricComparison });
        expect(() => formatComparisonReport(bad)).toThrow(TypeError);
      });

      it("p95.delta 가 비수치(형태 불량) → TypeError", () => {
        const bad = comparison({
          p95: metric({ delta: "x" as unknown as number }),
        });
        expect(() => formatComparisonReport(bad)).toThrow(TypeError);
      });

      it("최상위 regressed 가 boolean 아님 → TypeError", () => {
        const bad = comparison({
          regressed: "true" as unknown as boolean,
        });
        expect(() => formatComparisonReport(bad)).toThrow(TypeError);
      });

      it("throughput 지표 누락(전체 형태 불량) → TypeError", () => {
        const bad = {
          p50: metric(),
          p95: metric(),
          p99: metric(),
          errorRate: metric(),
          regressed: false,
        } as unknown as BaselineComparison;
        expect(() => formatComparisonReport(bad)).toThrow(TypeError);
      });
    });

    describe("flow / branch coverage", () => {
      it("(1) delta 양수(증가)는 '+', 음수(감소)는 '-' 부호 표기", () => {
        // p50 증가(+3), p99 감소(-4).
        const cmp = compareBaselineReports(
          report({ p50: 10, p99: 20 }),
          report({ p50: 13, p99: 16 }),
        );
        const out = formatComparisonReport(cmp);
        expect(out).toContain("delta=+3.0ms");
        expect(out).toContain("delta=-4.0ms");
      });

      it("(2) NaN 지표(빈 표본) → base/cand/delta 모두 'n/a' 표기", () => {
        const cmp = compareBaselineReports(
          report({ p95: NaN }),
          report({ p95: NaN }),
        );
        const out = formatComparisonReport(cmp);
        // 빈 표본 p95: base·cand·delta 전부 n/a(단위 접미사는 그대로 붙음).
        expect(out).toContain("p95: base=n/ams cand=n/ams delta=n/ams ok");
        // 유한 지표는 정상 렌더링(대비).
        expect(out).toContain("p50: base=10.0ms cand=10.0ms delta=0.0ms ok");
      });

      it("(3) throughput 은 REGRESSED 표시 없이 delta·'(관찰)' 만 렌더링", () => {
        // throughput 급감(100→10) — 관찰 전용이라 회귀 표시 없음.
        const cmp = compareBaselineReports(
          report({ throughput: 100 }),
          report({ throughput: 10 }),
        );
        const out = formatComparisonReport(cmp);
        expect(out).toContain(
          "throughput: base=100.00req/s cand=10.00req/s delta=-90.00req/s (관찰)",
        );
        // throughput 줄에는 REGRESSED/ok 토큰이 없다(관찰 전용).
        const tpLine = out.split("\n").find((l) => l.startsWith("throughput:"));
        expect(tpLine).toBeDefined();
        expect(tpLine).not.toContain("REGRESSED");
        expect(tpLine).not.toContain(" ok");
      });

      it("(4) 종합 regressed=true 헤더 vs false 헤더 분기", () => {
        const falseOut = formatComparisonReport(
          compareBaselineReports(report(), report()),
        );
        expect(falseOut.split("\n")[0]).toBe("regressed=false");
        const trueOut = formatComparisonReport(
          compareBaselineReports(report({ p95: 10 }), report({ p95: 20 })),
        );
        expect(trueOut.split("\n")[0]).toBe("regressed=true");
      });
    });

    describe("negative cases 충분 cover", () => {
      it("모든 지표 NaN(전부 빈 표본) 입력 → 각 지표 'n/a', 결과 비어있지 않음", () => {
        const cmp = compareBaselineReports(
          report({
            p50: NaN,
            p95: NaN,
            p99: NaN,
            errorRate: NaN,
            throughput: NaN,
          }),
          report({
            p50: NaN,
            p95: NaN,
            p99: NaN,
            errorRate: NaN,
            throughput: NaN,
          }),
        );
        const out = formatComparisonReport(cmp);
        expect(out.length).toBeGreaterThan(0);
        // NaN 은 "n/a" 로 표기(단위 접미사는 `formatBaselineLine` 과 동형으로 그대로 붙음).
        expect(out).toContain("p50: base=n/ams cand=n/ams delta=n/ams");
        expect(out).toContain("p95: base=n/ams cand=n/ams delta=n/ams");
        expect(out).toContain("p99: base=n/ams cand=n/ams delta=n/ams");
        expect(out).toContain("err: base=n/a% cand=n/a% delta=n/a%");
        expect(out).toContain(
          "throughput: base=n/areq/s cand=n/areq/s delta=n/areq/s (관찰)",
        );
      });

      it("candidate 만 NaN(측정 소실) 지표 → base 유한·cand 'n/a'·delta 'n/a' + 회귀 표기", () => {
        const cmp = compareBaselineReports(
          report({ p95: 15 }),
          report({ p95: NaN }),
        );
        const out = formatComparisonReport(cmp);
        expect(out).toContain(
          "p95: base=15.0ms cand=n/ams delta=n/ams REGRESSED",
        );
        expect(out).toContain("regressed=true");
      });

      it("delta=0(변화 없음) 지표 → 부호 없이 '0.0' 표기", () => {
        const cmp = compareBaselineReports(report(), report());
        const out = formatComparisonReport(cmp);
        expect(out).toContain("delta=0.0ms");
        expect(out).not.toContain("delta=+0.0ms");
        expect(out).not.toContain("delta=-0.0ms");
      });

      it("종합 regressed=true 이나 개별 지표 표시와 정합(errorRate REGRESSED)", () => {
        // errorRate 0→0.02(+0.02 > 0.01) → 회귀, latency 는 동일.
        const cmp = compareBaselineReports(
          report({ errorRate: 0 }),
          report({ errorRate: 0.02 }),
        );
        const out = formatComparisonReport(cmp);
        expect(out).toContain("regressed=true");
        expect(out).toContain(
          "err: base=0.00% cand=2.00% delta=+2.00% REGRESSED",
        );
        // latency 지표는 회귀 아님.
        expect(out).toContain("p95: base=15.0ms cand=15.0ms delta=0.0ms ok");
      });

      it("결과 문자열이 비어있지 않고 각 지표명(p50/p95/p99/err/throughput)이 모두 포함", () => {
        const out = formatComparisonReport(
          compareBaselineReports(report(), report()),
        );
        expect(out.length).toBeGreaterThan(0);
        for (const name of ["p50:", "p95:", "p99:", "err:", "throughput:"]) {
          expect(out).toContain(name);
        }
        // 헤더 포함 총 6 줄(regressed 헤더 + 5 지표).
        expect(out.split("\n")).toHaveLength(6);
      });

      it("errorRate 개선(감소) 지표 → delta 음수 부호 + ok", () => {
        const cmp = compareBaselineReports(
          report({ errorRate: 0.05 }),
          report({ errorRate: 0.01 }),
        );
        const out = formatComparisonReport(cmp);
        // err 5.00%→1.00%, delta -4.00%.
        expect(out).toContain("err: base=5.00% cand=1.00% delta=-4.00% ok");
      });
    });
  });

  describe("compareBaselineJson — 저장 JSON 회귀 비교 합성 순수 함수 (T-0866)", () => {
    /** 지정 지표로 정상 `BaselineReport` 를 만드는 팩토리(env·pass 는 고정 full). */
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

    /** 빈 표본(전 지표 NaN) `BaselineReport` 팩토리 — round-trip NaN sentinel 경로 검증용. */
    function emptyReport(): BaselineReport {
      return buildBaselineReport(fullEnv(), emptyAssertion());
    }

    /** BaselineReport 를 직렬화해 저장 JSON 문자열로 만드는 편의. */
    function json(r: BaselineReport): string {
      return serializeBaselineReport(r);
    }

    describe("happy path", () => {
      it("회귀 없는 baseline·candidate 두 JSON → regressed=false + report 는 종합 false 표기", () => {
        const out = compareBaselineJson(json(report()), json(report()));
        expect(out.comparison.regressed).toBe(false);
        expect(out.report.length).toBeGreaterThan(0);
        expect(out.report).toContain("regressed=false");
        expect(out.report).not.toContain("REGRESSED");
      });

      it("회귀 있는(candidate p95 tolerance 초과 증가) → regressed=true + report 에 REGRESSED", () => {
        // p95 10→12(+20% > 기본 10%) → 회귀.
        const out = compareBaselineJson(
          json(report({ p95: 10 })),
          json(report({ p95: 12 })),
        );
        expect(out.comparison.regressed).toBe(true);
        expect(out.comparison.p95.regressed).toBe(true);
        expect(out.report).toContain("regressed=true");
        expect(out.report).toContain("REGRESSED");
      });

      it("반환 report 는 formatComparisonReport(반환 comparison) 와 정확히 일치(정합)", () => {
        const out = compareBaselineJson(
          json(report({ p95: 10 })),
          json(report({ p95: 20 })),
        );
        // report 는 반환 comparison 에서 파생 — 정확히 동일해야 정합.
        expect(out.report).toBe(formatComparisonReport(out.comparison));
      });

      it("반환 comparison 은 compareBaselineReports 결과와 동등(하위 primitive 조립만)", () => {
        const b = report({ p50: 10 });
        const c = report({ p50: 11 });
        const out = compareBaselineJson(json(b), json(c));
        const direct = compareBaselineReports(
          parseBaselineReport(json(b)),
          parseBaselineReport(json(c)),
        );
        expect(out.comparison).toEqual(direct);
      });
    });

    describe("error path — 하위 예외 재래핑 없이 propagate", () => {
      it("baselineJson 이 잘못된 JSON('{') → SyntaxError", () => {
        expect(() => compareBaselineJson("{", json(report()))).toThrow(
          SyntaxError,
        );
      });

      it("candidateJson 이 잘못된 JSON('{') → SyntaxError", () => {
        expect(() => compareBaselineJson(json(report()), "{")).toThrow(
          SyntaxError,
        );
      });

      it("baselineJson 이 유효 JSON 이나 형태 불량(env 누락) → TypeError", () => {
        const malformed = JSON.stringify({
          p50: 1,
          p95: 2,
          p99: 3,
          throughput: 4,
          errorRate: 0,
          count: 1,
          pass: true,
        });
        expect(() => compareBaselineJson(malformed, json(report()))).toThrow(
          TypeError,
        );
      });

      it("candidateJson 이 유효 JSON 이나 지표 타입 불일치(p95 string) → TypeError", () => {
        const malformed = JSON.stringify({
          env: { label: "x", concurrency: 1 },
          p50: 1,
          p95: "nope",
          p99: 3,
          throughput: 4,
          errorRate: 0,
          count: 1,
          pass: true,
        });
        expect(() => compareBaselineJson(json(report()), malformed)).toThrow(
          TypeError,
        );
      });

      it("options.latencyTolerance 음수 → RangeError(compareBaselineReports 에서 propagate)", () => {
        expect(() =>
          compareBaselineJson(json(report()), json(report()), {
            latencyTolerance: -0.1,
          }),
        ).toThrow(RangeError);
      });

      it("options.latencyTolerance NaN → RangeError", () => {
        expect(() =>
          compareBaselineJson(json(report()), json(report()), {
            latencyTolerance: NaN,
          }),
        ).toThrow(RangeError);
      });
    });

    describe("flow / branch coverage", () => {
      it("어느 인자가 불량이든 propagate — baseline 불량 분기 vs candidate 불량 분기", () => {
        // baseline 불량.
        expect(() => compareBaselineJson("{", json(report()))).toThrow(
          SyntaxError,
        );
        // candidate 불량.
        expect(() => compareBaselineJson(json(report()), "not json")).toThrow(
          SyntaxError,
        );
      });

      it("options 지정(latencyTolerance 0.5) 시 tolerance 전달 → 회귀 판정이 달라짐 vs 미지정 기본 0.10", () => {
        // p95 10→14(+40%): 기본 0.10 이면 회귀, 0.5 tolerance 면 회귀 아님.
        const b = json(report({ p95: 10 }));
        const c = json(report({ p95: 14 }));
        const withDefault = compareBaselineJson(b, c);
        expect(withDefault.comparison.regressed).toBe(true);
        const withLoose = compareBaselineJson(b, c, { latencyTolerance: 0.5 });
        expect(withLoose.comparison.regressed).toBe(false);
        expect(withLoose.report).toContain("regressed=false");
      });

      it("NaN 지표(빈 표본) baseline round-trip 이 comparison·report 에 정상 반영", () => {
        const out = compareBaselineJson(json(emptyReport()), json(report()));
        // baseline p95 가 NaN → 그 지표 baseline 은 NaN 으로 복원.
        expect(Number.isNaN(out.comparison.p95.baseline)).toBe(true);
        // report 에는 n/a 방어 표기가 반영.
        expect(out.report).toContain("n/a");
      });
    });

    describe("negative cases 충분 cover", () => {
      it("두 JSON 모두 NaN 지표(전부 빈 표본) → 정상 조립(회귀 없음)", () => {
        const out = compareBaselineJson(
          json(emptyReport()),
          json(emptyReport()),
        );
        // 양쪽 NaN → 회귀 판정 제외 → regressed=false.
        expect(out.comparison.regressed).toBe(false);
        expect(Number.isNaN(out.comparison.p95.baseline)).toBe(true);
        expect(Number.isNaN(out.comparison.p95.candidate)).toBe(true);
        expect(out.report).toContain("n/a");
      });

      it("candidate 만 측정 소실(NaN)인 baseline → 회귀 표기 정합", () => {
        // baseline 유한, candidate NaN → 측정 소실 → 회귀 표기.
        const out = compareBaselineJson(json(report()), json(emptyReport()));
        expect(out.comparison.regressed).toBe(true);
        expect(out.report).toContain("regressed=true");
        // report 는 comparison 에서 파생 — 정합.
        expect(out.report).toBe(formatComparisonReport(out.comparison));
      });

      it("options.errorRateTolerance 음수 → RangeError", () => {
        expect(() =>
          compareBaselineJson(json(report()), json(report()), {
            errorRateTolerance: -0.01,
          }),
        ).toThrow(RangeError);
      });

      it("baselineJson 이 빈 문자열('') → SyntaxError", () => {
        expect(() => compareBaselineJson("", json(report()))).toThrow(
          SyntaxError,
        );
      });

      it("candidateJson 이 빈 문자열('') → SyntaxError", () => {
        expect(() => compareBaselineJson(json(report()), "")).toThrow(
          SyntaxError,
        );
      });

      it("정상 입력 → 반환 object 가 comparison·report 두 키를 모두 가지고 report 에 모든 지표명 포함", () => {
        const out = compareBaselineJson(json(report()), json(report()));
        expect(out).toHaveProperty("comparison");
        expect(out).toHaveProperty("report");
        for (const name of ["p50:", "p95:", "p99:", "err:", "throughput:"]) {
          expect(out.report).toContain(name);
        }
      });
    });
  });

  describe("resolveBaselineFilename — 파일명 규약 순수 함수 (T-0867)", () => {
    /** label 만 지정하고 나머지는 유효 기본값을 채우는 env 팩토리. */
    function envWith(label: unknown): BaselineEnvMeta {
      return { label, concurrency: 4 } as BaselineEnvMeta;
    }

    describe("happy path", () => {
      it("정상 label(이미 slug-safe)이면 결정적 basename 반환", () => {
        expect(resolveBaselineFilename(envWith("ci-linux-x64"))).toBe(
          "baseline-ci-linux-x64.json",
        );
      });

      it("같은 env 를 두 번 호출하면 동일 문자열 반환(결정성)", () => {
        const env = envWith("ci-linux-x64");
        expect(resolveBaselineFilename(env)).toBe(resolveBaselineFilename(env));
      });

      it("공백·특수문자 포함 label 이 FS-safe slug(소문자·단일 하이픈·.json)로 정규화", () => {
        expect(resolveBaselineFilename(envWith("Local MacBook / M1"))).toBe(
          "baseline-local-macbook-m1.json",
        );
      });
    });

    describe("error path", () => {
      it("env 가 null → TypeError", () => {
        expect(() =>
          resolveBaselineFilename(null as unknown as BaselineEnvMeta),
        ).toThrow(TypeError);
      });

      it("env 에 label 누락 → TypeError", () => {
        expect(() =>
          resolveBaselineFilename({ concurrency: 4 } as BaselineEnvMeta),
        ).toThrow(TypeError);
      });

      it("concurrency 가 non-number → TypeError", () => {
        expect(() =>
          resolveBaselineFilename({
            label: "ci-linux",
            concurrency: "4",
          } as unknown as BaselineEnvMeta),
        ).toThrow(TypeError);
      });

      it("label 이 빈 string('') → RangeError", () => {
        expect(() => resolveBaselineFilename(envWith(""))).toThrow(RangeError);
      });

      it("label 이 공백-only('   ') → RangeError", () => {
        expect(() => resolveBaselineFilename(envWith("   "))).toThrow(
          RangeError,
        );
      });

      it("label 이 구분자로만 구성('///')돼 slug 이 빈 string → RangeError", () => {
        expect(() => resolveBaselineFilename(envWith("///"))).toThrow(
          RangeError,
        );
      });
    });

    describe("flow / branch coverage", () => {
      it("slug 정규화가 문자를 치환하는 label vs 이미 slug-safe 라 변형 없는 label", () => {
        // 변형 없는 분기: 입력 label 이 그대로 slug 이 됨.
        expect(resolveBaselineFilename(envWith("ci-linux"))).toBe(
          "baseline-ci-linux.json",
        );
        // 치환 분기: 공백·슬래시가 하이픈으로 치환됨.
        expect(resolveBaselineFilename(envWith("ci linux x64"))).toBe(
          "baseline-ci-linux-x64.json",
        );
      });

      it("대소문자만 다른 두 label 이 동일 slug/파일명으로 수렴", () => {
        expect(resolveBaselineFilename(envWith("CI-Linux"))).toBe(
          resolveBaselineFilename(envWith("ci-linux")),
        );
        expect(resolveBaselineFilename(envWith("CI-Linux"))).toBe(
          "baseline-ci-linux.json",
        );
      });

      it("연속 특수문자·선행/후행 구분자가 단일 하이픈 축약·trim 됨", () => {
        expect(resolveBaselineFilename(envWith("__ci___linux__"))).toBe(
          "baseline-ci-linux.json",
        );
        expect(resolveBaselineFilename(envWith("//ci -- linux//"))).toBe(
          "baseline-ci-linux.json",
        );
      });
    });

    describe("negative cases 충분 cover", () => {
      it("env = undefined → TypeError", () => {
        expect(() =>
          resolveBaselineFilename(undefined as unknown as BaselineEnvMeta),
        ).toThrow(TypeError);
      });

      it("label 이 숫자 → TypeError(isValidEnvMeta 경유)", () => {
        expect(() => resolveBaselineFilename(envWith(42))).toThrow(TypeError);
      });

      it("label 이 객체 → TypeError(isValidEnvMeta 경유)", () => {
        expect(() => resolveBaselineFilename(envWith({}))).toThrow(TypeError);
      });

      it("공백/구분자로만 이뤄져 slug 이 비는 label('  --  ') → RangeError", () => {
        expect(() => resolveBaselineFilename(envWith("  --  "))).toThrow(
          RangeError,
        );
      });

      it("비-ASCII 문자만으로 이뤄져 slug 이 비는 label(한글·이모지) → RangeError", () => {
        expect(() => resolveBaselineFilename(envWith("리눅스 서버"))).toThrow(
          RangeError,
        );
        expect(() => resolveBaselineFilename(envWith("🚀"))).toThrow(
          RangeError,
        );
      });

      it("반환 basename 은 디렉토리 구분자(/·\\)를 포함하지 않고 .json 으로 끝남(FS-safe)", () => {
        const name = resolveBaselineFilename(
          envWith("Local MacBook / M1 \\ dev"),
        );
        expect(name).not.toContain("/");
        expect(name).not.toContain("\\");
        expect(name.endsWith(".json")).toBe(true);
        expect(name.startsWith("baseline-")).toBe(true);
      });
    });
  });
});
