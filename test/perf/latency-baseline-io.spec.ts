import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  BaselineEnvMeta,
  BaselineReport,
  compareBaselineReports,
  formatComparisonReport,
  parseBaselineReport,
  resolveBaselinePath,
} from "./latency-baseline";
import {
  readBaselineFile,
  readCompareBaselineFile,
  writeBaselineFile,
} from "./latency-baseline-io";

/**
 * T-0869 — S2 latency baseline 디스크 write harness(`writeBaselineFile`)의 R-112 spec.
 * happy-path / error path(부작용 없이 전파) / flow·branch / negative cases 충분 cover.
 * 실제 fs 를 쓰되 격리된 임시 디렉토리에서만 동작하고 매 test 후 정리한다(결정성 유지).
 */
describe("latency-baseline-io writeBaselineFile (S2 disk write)", () => {
  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-io-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

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

  /** 유효한 baseline 리포트(표본 있음) 팩토리. */
  function fullReport(overrides: Partial<BaselineReport> = {}): BaselineReport {
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

  /** 빈 표본(NaN 지표) baseline 리포트 — round-trip 에서 NaN 보존 검증용. */
  function emptyReport(): BaselineReport {
    return {
      env: fullEnv({ label: "local-macbook", concurrency: 1 }),
      p50: NaN,
      p95: NaN,
      p99: NaN,
      throughput: 0,
      errorRate: 0,
      count: 0,
      pass: false,
    };
  }

  describe("happy path", () => {
    it("유효 입력이면 baseline JSON 을 쓰고 반환 경로가 resolveBaselinePath 와 일치", () => {
      const report = fullReport();
      const env = fullEnv();
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );

      const written = writeBaselineFile(report, env, baseDir);

      expect(written).toBe(resolveBaselinePath(env, baseDir));
      expect(fs.existsSync(written)).toBe(true);
    });

    it("쓴 파일을 읽어 parseBaselineReport 로 복원하면 원본과 동치(round-trip)", () => {
      const report = fullReport();
      const env = fullEnv();
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );

      const written = writeBaselineFile(report, env, baseDir);
      const restored = parseBaselineReport(fs.readFileSync(written, "utf-8"));

      expect(restored).toEqual(report);
    });

    it("NaN 지표(빈 표본) 리포트도 round-trip 으로 NaN 이 보존됨", () => {
      const report = emptyReport();
      const env = report.env;
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );

      const written = writeBaselineFile(report, env, baseDir);
      const restored = parseBaselineReport(fs.readFileSync(written, "utf-8"));

      expect(Number.isNaN(restored.p50)).toBe(true);
      expect(Number.isNaN(restored.p95)).toBe(true);
      expect(Number.isNaN(restored.p99)).toBe(true);
      expect(restored).toEqual(report);
    });
  });

  describe("error path — 예외가 부작용 없이 전파(파일 미생성)", () => {
    /** baseDir 안에 파일이 하나도 생성되지 않았음을 검증(디렉토리 자체도 미생성 허용). */
    function assertNoFileWritten(baseDir: string): void {
      const abs = baseDir;
      if (fs.existsSync(abs)) {
        expect(fs.readdirSync(abs)).toHaveLength(0);
      } else {
        expect(fs.existsSync(abs)).toBe(false);
      }
    }

    it("env 형태 불량(null) → TypeError 전파 + 파일 미생성", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );
      expect(() =>
        writeBaselineFile(
          fullReport(),
          null as unknown as BaselineEnvMeta,
          baseDir,
        ),
      ).toThrow(TypeError);
      assertNoFileWritten(baseDir);
    });

    it("env.label 공백-only → RangeError 전파 + 파일 미생성", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );
      expect(() =>
        writeBaselineFile(fullReport(), fullEnv({ label: "   " }), baseDir),
      ).toThrow(RangeError);
      assertNoFileWritten(baseDir);
    });

    it("baseDir non-string → TypeError 전파 + 파일 미생성", () => {
      const baseDir = 123 as unknown as string;
      expect(() => writeBaselineFile(fullReport(), fullEnv(), baseDir)).toThrow(
        TypeError,
      );
    });

    it("baseDir 공백-only → RangeError 전파 + 파일 미생성", () => {
      expect(() => writeBaselineFile(fullReport(), fullEnv(), "   ")).toThrow(
        RangeError,
      );
    });

    it("report 형태 불량(직렬화 throw) → TypeError 전파 + 파일 미생성", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );
      const badReport = fullReport({ p50: "nope" as unknown as number });
      expect(() => writeBaselineFile(badReport, fullEnv(), baseDir)).toThrow(
        TypeError,
      );
      assertNoFileWritten(baseDir);
    });
  });

  describe("flow / branch coverage", () => {
    it("상위 디렉토리가 없으면 재귀 생성 후 기록 성공", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "not",
        "yet",
        "there",
      );
      expect(fs.existsSync(baseDir)).toBe(false);

      const written = writeBaselineFile(fullReport(), fullEnv(), baseDir);

      expect(fs.existsSync(written)).toBe(true);
    });

    it("상위 디렉토리가 이미 있어도 mkdir recursive 는 no-op 이고 기록 성공", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );
      fs.mkdirSync(baseDir, { recursive: true });
      expect(fs.existsSync(baseDir)).toBe(true);

      const written = writeBaselineFile(fullReport(), fullEnv(), baseDir);

      expect(fs.existsSync(written)).toBe(true);
    });

    it("같은 경로에 두 번 write 하면 덮어써져 마지막 report 가 남음(overwrite 결정성)", () => {
      const env = fullEnv();
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );

      const first = fullReport({ p95: 15 });
      const second = fullReport({ p95: 99 });
      const p1 = writeBaselineFile(first, env, baseDir);
      const p2 = writeBaselineFile(second, env, baseDir);

      expect(p2).toBe(p1);
      const restored = parseBaselineReport(fs.readFileSync(p2, "utf-8"));
      expect(restored.p95).toBe(99);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("env=undefined → TypeError 전파 + 파일 미생성", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );
      expect(() =>
        writeBaselineFile(
          fullReport(),
          undefined as unknown as BaselineEnvMeta,
          baseDir,
        ),
      ).toThrow(TypeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("baseDir=undefined → TypeError 전파 + 파일 미생성", () => {
      expect(() =>
        writeBaselineFile(
          fullReport(),
          fullEnv(),
          undefined as unknown as string,
        ),
      ).toThrow(TypeError);
    });

    it("다중 세그먼트 baseDir(여러 depth 미존재)도 재귀 생성으로 성공", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "a",
        "b",
        "c",
      );
      const written = writeBaselineFile(fullReport(), fullEnv(), baseDir);
      expect(fs.existsSync(written)).toBe(true);
    });

    it("서로 다른 env.label 은 같은 baseDir 안에서 서로 다른 파일로 분리 저장", () => {
      const baseDir = path.posix.join(
        tmpRoot.split(path.sep).join("/"),
        "baselines",
      );
      const envA = fullEnv({ label: "ci-linux-x64" });
      const envB = fullEnv({ label: "local-macbook" });

      const pathA = writeBaselineFile(fullReport({ env: envA }), envA, baseDir);
      const pathB = writeBaselineFile(fullReport({ env: envB }), envB, baseDir);

      expect(pathA).not.toBe(pathB);
      expect(fs.existsSync(pathA)).toBe(true);
      expect(fs.existsSync(pathB)).toBe(true);
    });
  });
});

/**
 * T-0870 — S2 latency baseline 디스크 read harness(`readBaselineFile`)의 R-112 spec.
 * happy-path(round-trip, NaN 포함) / error path(부작용 없이 전파, case 1~6) / flow·branch /
 * negative cases 충분 cover. 실제 fs 를 쓰되 격리된 임시 디렉토리에서만 동작하고 매 test 후
 * 정리한다(결정성 유지 — write spec 의 tmp 셋업/정리 패턴 재사용).
 */
describe("latency-baseline-io readBaselineFile (S2 disk read)", () => {
  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-read-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

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

  /** 유효한 baseline 리포트(표본 있음) 팩토리. */
  function fullReport(overrides: Partial<BaselineReport> = {}): BaselineReport {
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

  /** 빈 표본(NaN 지표) baseline 리포트 — round-trip 에서 NaN 보존 검증용. */
  function emptyReport(): BaselineReport {
    return {
      env: fullEnv({ label: "local-macbook", concurrency: 1 }),
      p50: NaN,
      p95: NaN,
      p99: NaN,
      throughput: 0,
      errorRate: 0,
      count: 0,
      pass: false,
    };
  }

  /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
  function baselineDir(...segments: string[]): string {
    return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
  }

  describe("happy path — write→read round-trip", () => {
    it("writeBaselineFile 로 쓴 baseline 을 같은 env·baseDir 로 읽으면 원본과 동치(round-trip)", () => {
      const report = fullReport();
      const env = fullEnv();
      const baseDir = baselineDir("baselines");

      writeBaselineFile(report, env, baseDir);
      const restored = readBaselineFile(env, baseDir);

      expect(restored).toEqual(report);
    });

    it("NaN 지표(빈 표본) 리포트도 round-trip 으로 NaN 이 보존됨", () => {
      const report = emptyReport();
      const env = report.env;
      const baseDir = baselineDir("baselines");

      writeBaselineFile(report, env, baseDir);
      const restored = readBaselineFile(env, baseDir);

      expect(Number.isNaN(restored.p50)).toBe(true);
      expect(Number.isNaN(restored.p95)).toBe(true);
      expect(Number.isNaN(restored.p99)).toBe(true);
      expect(restored).toEqual(report);
    });

    it("반환 경로가 resolveBaselinePath 규약을 공유해 write 가 쓴 파일을 정확히 읽음", () => {
      const report = fullReport();
      const env = fullEnv();
      const baseDir = baselineDir("baselines");

      const written = writeBaselineFile(report, env, baseDir);
      expect(written).toBe(resolveBaselinePath(env, baseDir));
      // 같은 경로 규약을 read 도 공유하므로 별도 경로 조작 없이 읽힌다.
      expect(readBaselineFile(env, baseDir)).toEqual(report);
    });
  });

  describe("error path — 예외가 부작용/래핑 없이 그대로 전파", () => {
    it("(1) env 형태 불량(null) → resolveBaselinePath 의 TypeError 전파(fs 접근 전 실패)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        readBaselineFile(null as unknown as BaselineEnvMeta, baseDir),
      ).toThrow(TypeError);
    });

    it("(2) env.label 공백-only → RangeError 전파(fs 접근 전 실패)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        readBaselineFile(fullEnv({ label: "   " }), baseDir),
      ).toThrow(RangeError);
    });

    it("(3) baseDir non-string → TypeError 전파(fs 접근 전 실패)", () => {
      expect(() =>
        readBaselineFile(fullEnv(), 123 as unknown as string),
      ).toThrow(TypeError);
    });

    it("(4) baseDir 공백-only → RangeError 전파(fs 접근 전 실패)", () => {
      expect(() => readBaselineFile(fullEnv(), "   ")).toThrow(RangeError);
    });

    it("(5) 파일 미생성 경로 → fs.readFileSync 의 ENOENT 계열 오류 전파", () => {
      const baseDir = baselineDir("baselines");
      // 아무 파일도 write 하지 않은 상태 — 경로 결정은 성공하나 파일 읽기에서 실패.
      let caught: NodeJS.ErrnoException | undefined;
      try {
        readBaselineFile(fullEnv(), baseDir);
      } catch (err) {
        caught = err as NodeJS.ErrnoException;
      }
      expect(caught).toBeDefined();
      expect(caught?.code).toBe("ENOENT");
    });

    it("(6-a) 파일 내용이 유효 JSON 이 아니면 parseBaselineReport 의 SyntaxError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const target = resolveBaselinePath(env, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      fs.writeFileSync(target, "{not-json", { encoding: "utf-8" });

      expect(() => readBaselineFile(env, baseDir)).toThrow(SyntaxError);
    });

    it("(6-b) 유효 JSON 이나 리포트 형태 불량이면 parseBaselineReport 의 TypeError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const target = resolveBaselinePath(env, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      // env 필드 누락 — 유효 JSON 이지만 BaselineReport 형태 불량.
      fs.writeFileSync(target, JSON.stringify({ p50: 1 }), {
        encoding: "utf-8",
      });

      expect(() => readBaselineFile(env, baseDir)).toThrow(TypeError);
    });
  });

  describe("flow / branch coverage", () => {
    it("분기(1) 유효 baseline 파일 읽기 성공 — write→read 성공 흐름", () => {
      const report = fullReport();
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(report, env, baseDir);

      expect(readBaselineFile(env, baseDir)).toEqual(report);
    });

    it("분기(2) 경로 결정 예외로 fs 접근 전 실패 — 파일이 있어도 잘못된 env 면 읽지 않음", () => {
      // 유효 파일을 미리 써 두어도, env 불량이면 resolveBaselinePath 에서 먼저 throw.
      const goodEnv = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), goodEnv, baseDir);

      expect(() => readBaselineFile(fullEnv({ label: "" }), baseDir)).toThrow(
        RangeError,
      );
    });

    it("분기(3) fs 읽기는 성공하나 파싱 단계에서 실패 — 내용 불량", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const target = resolveBaselinePath(env, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      fs.writeFileSync(target, "[]", { encoding: "utf-8" });

      expect(() => readBaselineFile(env, baseDir)).toThrow(TypeError);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("env=undefined → TypeError 전파", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        readBaselineFile(undefined as unknown as BaselineEnvMeta, baseDir),
      ).toThrow(TypeError);
    });

    it("baseDir=undefined → TypeError 전파", () => {
      expect(() =>
        readBaselineFile(fullEnv(), undefined as unknown as string),
      ).toThrow(TypeError);
    });

    it("write 후 서로 다른 env.label 로 read 하면 그 경로 미존재로 ENOENT(파일 분리 저장 확인)", () => {
      const baseDir = baselineDir("baselines");
      const envA = fullEnv({ label: "ci-linux-x64" });
      const envB = fullEnv({ label: "local-macbook" });
      writeBaselineFile(fullReport({ env: envA }), envA, baseDir);

      // envA 로만 저장했으므로 envB 경로는 미존재.
      let caught: NodeJS.ErrnoException | undefined;
      try {
        readBaselineFile(envB, baseDir);
      } catch (err) {
        caught = err as NodeJS.ErrnoException;
      }
      expect(caught?.code).toBe("ENOENT");
      // envA 는 정상 read 됨(분리 저장 확인).
      expect(readBaselineFile(envA, baseDir)).toEqual(
        fullReport({ env: envA }),
      );
    });

    it("빈 파일(0바이트)을 읽으면 parseBaselineReport 가 던지는 예외 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const target = resolveBaselinePath(env, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      fs.writeFileSync(target, "", { encoding: "utf-8" });

      expect(() => readBaselineFile(env, baseDir)).toThrow(SyntaxError);
    });
  });
});

/**
 * T-0871 — S2 latency baseline 디스크 compare harness(`readCompareBaselineFile`)의 R-112 spec.
 * happy-path(회귀 없음/있음, options 위임 동치) / error path(로드·비교 단계 예외가 부작용 없이
 * 그대로 전파, case 1~6) / flow·branch(로드 성공→비교 / 로드 단계 실패 / 비교 단계 실패 3 흐름) /
 * negative cases 충분 cover. `readBaselineFile` 과 동일하게 격리 임시 디렉토리에서만 동작하고 매
 * test 후 정리한다(결정성 유지 — write/read spec 의 tmp 셋업/정리 패턴 재사용).
 */
describe("latency-baseline-io readCompareBaselineFile (S2 disk compare)", () => {
  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-cmp-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

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

  /** 유효한 baseline 리포트(표본 있음) 팩토리. */
  function fullReport(overrides: Partial<BaselineReport> = {}): BaselineReport {
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

  /** 빈 표본(NaN 지표) baseline 리포트 — NaN 방어·"n/a" 렌더링 검증용. */
  function emptyReport(): BaselineReport {
    return {
      env: fullEnv({ label: "local-macbook", concurrency: 1 }),
      p50: NaN,
      p95: NaN,
      p99: NaN,
      throughput: 0,
      errorRate: 0,
      count: 0,
      pass: false,
    };
  }

  /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
  function baselineDir(...segments: string[]): string {
    return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
  }

  describe("happy path — 디스크 기준 로드 + candidate 비교", () => {
    it("회귀 없는 candidate 면 comparison.regressed=false 이고 primitive 조립 동치를 반환", () => {
      const baseline = fullReport();
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(baseline, env, baseDir);

      // 회귀 없음 — 모든 지표가 baseline 과 동일.
      const candidate = fullReport();
      const { comparison, report } = readCompareBaselineFile(
        env,
        baseDir,
        candidate,
      );

      // 하위 primitive 를 직접 조립한 결과와 동치여야 한다(얇은 조립 위임 검증).
      const expectedComparison = compareBaselineReports(baseline, candidate);
      expect(comparison).toEqual(expectedComparison);
      expect(report).toBe(formatComparisonReport(expectedComparison));
      expect(comparison.regressed).toBe(false);
    });

    it("p95 tolerance 초과 candidate 면 comparison.regressed=true (회귀 탐지)", () => {
      const baseline = fullReport({ p95: 15 });
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(baseline, env, baseDir);

      // p95 를 기본 tolerance(+10%) 를 초과해 증가 → 회귀.
      const candidate = fullReport({ p95: 30 });
      const { comparison, report } = readCompareBaselineFile(
        env,
        baseDir,
        candidate,
      );

      expect(comparison.regressed).toBe(true);
      expect(comparison.p95.regressed).toBe(true);
      expect(report).toContain("regressed=true");
      expect(report).toContain("REGRESSED");
    });

    it("options.latencyTolerance 를 넘기면 그 허용치가 하위 비교에 그대로 위임됨", () => {
      const baseline = fullReport({ p95: 15 });
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(baseline, env, baseDir);

      // 기본 tolerance(+10%) 로는 회귀이나, 넉넉한 tolerance(+100%) 로는 회귀 아님.
      const candidate = fullReport({ p95: 18 });
      const loose = readCompareBaselineFile(env, baseDir, candidate, {
        latencyTolerance: 1.0,
      });
      const tight = readCompareBaselineFile(env, baseDir, candidate);

      expect(loose.comparison.regressed).toBe(false);
      expect(tight.comparison.regressed).toBe(true);
    });
  });

  describe("error path — 예외가 부작용/래핑 없이 그대로 전파", () => {
    it("(1) env 형태 불량(null) → readBaselineFile→resolveBaselinePath 의 TypeError 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        readCompareBaselineFile(
          null as unknown as BaselineEnvMeta,
          baseDir,
          fullReport(),
        ),
      ).toThrow(TypeError);
    });

    it("(2) baseDir 공백-only → RangeError 전파(비교 미도달)", () => {
      expect(() =>
        readCompareBaselineFile(fullEnv(), "   ", fullReport()),
      ).toThrow(RangeError);
    });

    it("(3) 기준 파일 미저장 경로 → readBaselineFile 의 ENOENT 계열 오류 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      // 아무 baseline 도 write 하지 않음 — 로드 단계에서 실패.
      let caught: NodeJS.ErrnoException | undefined;
      try {
        readCompareBaselineFile(fullEnv(), baseDir, fullReport());
      } catch (err) {
        caught = err as NodeJS.ErrnoException;
      }
      expect(caught?.code).toBe("ENOENT");
    });

    it("(4) 저장된 기준 파일 내용 불량(유효 JSON 아님) → parseBaselineReport 의 SyntaxError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const target = resolveBaselinePath(env, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      fs.writeFileSync(target, "{not-json", { encoding: "utf-8" });

      expect(() => readCompareBaselineFile(env, baseDir, fullReport())).toThrow(
        SyntaxError,
      );
    });

    it("(5) candidate 형태 불량(null) → compareBaselineReports 의 TypeError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(() =>
        readCompareBaselineFile(
          env,
          baseDir,
          null as unknown as BaselineReport,
        ),
      ).toThrow(TypeError);
    });

    it("(6) options.tolerance 음수 → compareBaselineReports 의 RangeError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(() =>
        readCompareBaselineFile(env, baseDir, fullReport(), {
          latencyTolerance: -0.5,
        }),
      ).toThrow(RangeError);
    });

    it("options.errorRateTolerance NaN → compareBaselineReports 의 RangeError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(() =>
        readCompareBaselineFile(env, baseDir, fullReport(), {
          errorRateTolerance: NaN,
        }),
      ).toThrow(RangeError);
    });
  });

  describe("flow / branch coverage", () => {
    it("분기(1) 유효 기준 로드 성공 → 비교·포맷 성공(회귀 없음)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      const { comparison } = readCompareBaselineFile(
        env,
        baseDir,
        fullReport(),
      );
      expect(comparison.regressed).toBe(false);
    });

    it("분기(1') 유효 기준 로드 성공 → 비교·포맷 성공(회귀 있음)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ p99: 20 }), env, baseDir);

      const { comparison } = readCompareBaselineFile(
        env,
        baseDir,
        fullReport({ p99: 40 }),
      );
      expect(comparison.regressed).toBe(true);
    });

    it("분기(2) 기준 로드 단계(ENOENT)에서 비교 전 실패", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        readCompareBaselineFile(fullEnv(), baseDir, fullReport()),
      ).toThrow(/ENOENT/);
    });

    it("분기(3) 로드는 성공하나 비교 단계(candidate 형태 불량)에서 실패", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(() =>
        readCompareBaselineFile(env, baseDir, {
          p50: 1,
        } as unknown as BaselineReport),
      ).toThrow(TypeError);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("env=undefined → TypeError 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        readCompareBaselineFile(
          undefined as unknown as BaselineEnvMeta,
          baseDir,
          fullReport(),
        ),
      ).toThrow(TypeError);
    });

    it("candidate=undefined → compareBaselineReports 의 TypeError 전파", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(() =>
        readCompareBaselineFile(
          env,
          baseDir,
          undefined as unknown as BaselineReport,
        ),
      ).toThrow(TypeError);
    });

    it("options 미지정(default) 호출이 기본 tolerance 로 정상 동작(옵션 optional 확인)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      // options 인자 없이 호출 — 기본 tolerance 로 회귀 없음 판정.
      const { comparison, report } = readCompareBaselineFile(
        env,
        baseDir,
        fullReport(),
      );
      expect(comparison.regressed).toBe(false);
      expect(report).toContain("regressed=false");
    });

    it("NaN 지표(빈 표본) 기준/candidate 비교 시 판정 제외되고 report 에 n/a 로 렌더링", () => {
      const env = emptyReport().env;
      const baseDir = baselineDir("baselines");
      // 기준·candidate 모두 빈 표본(NaN 지표) — 해당 지표는 회귀 판정에서 제외.
      writeBaselineFile(emptyReport(), env, baseDir);

      const { comparison, report } = readCompareBaselineFile(
        env,
        baseDir,
        emptyReport(),
      );
      // 양쪽 NaN → latency 지표는 회귀 제외(regressed=false).
      expect(comparison.p50.regressed).toBe(false);
      expect(comparison.p95.regressed).toBe(false);
      expect(comparison.p99.regressed).toBe(false);
      expect(comparison.regressed).toBe(false);
      // NaN 지표는 사람-친화 리포트에서 "n/a" 로 방어 렌더링(하위 primitive 위임 정합).
      expect(report).toContain("n/a");
    });
  });
});
