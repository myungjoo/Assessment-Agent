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
  baselineFileExists,
  compareBaselineFiles,
  confirmOrCompareBaseline,
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

/**
 * T-0872 — S2 latency baseline 양쪽-디스크 compare harness(`compareBaselineFiles`)의 R-112 spec.
 * happy-path(회귀 없음/있음, 자기 비교, options 위임 동치) / error path(기준·candidate 로드·비교
 * 각 단계 예외가 부작용 없이 그대로 전파, case 1~7) / flow·branch(두 로드 성공→비교 / 기준 로드
 * 단계 실패 / candidate 로드 단계 실패 / 비교 단계 실패 4 흐름) / negative cases 충분 cover.
 * 기준·candidate 를 둘 다 디스크에서 로드하므로 `writeBaselineFile` 로 두 baseline 을 각각 저장한
 * 뒤 비교한다. 격리 임시 디렉토리에서만 동작하고 매 test 후 정리한다(결정성 유지).
 */
describe("latency-baseline-io compareBaselineFiles (S2 both-disk compare)", () => {
  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-cmp2-"));
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

  // 기준·candidate 를 서로 다른 label 로 같은 baseDir 아래에 분리 저장하는 공통 셋업.
  // baselineEnv/candidateEnv 는 label 만 다르게 해 두 파일이 서로 다른 경로로 저장되게 한다.
  const baselineEnv = fullEnv({ label: "prev-run" });
  const candidateEnv = fullEnv({ label: "new-run" });

  describe("happy path — 기준·candidate 둘 다 디스크 로드 후 비교", () => {
    it("회귀 없는 candidate 면 comparison.regressed=false 이고 primitive 조립 동치를 반환", () => {
      const baseDir = baselineDir("baselines");
      const baseline = fullReport({ env: baselineEnv });
      const candidate = fullReport({ env: candidateEnv }); // 지표 동일 → 회귀 없음.
      writeBaselineFile(baseline, baselineEnv, baseDir);
      writeBaselineFile(candidate, candidateEnv, baseDir);

      const { comparison, report } = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
      );

      // 하위 primitive 를 직접 조립한 결과와 동치여야 한다(얇은 조립 위임 검증).
      const expectedComparison = compareBaselineReports(baseline, candidate);
      expect(comparison).toEqual(expectedComparison);
      expect(report).toBe(formatComparisonReport(expectedComparison));
      expect(comparison.regressed).toBe(false);
    });

    it("p95 tolerance 초과 candidate 면 comparison.regressed=true (회귀 탐지)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(
        fullReport({ env: baselineEnv, p95: 15 }),
        baselineEnv,
        baseDir,
      );
      // p95 를 기본 tolerance(+10%) 를 초과해 증가 → 회귀.
      writeBaselineFile(
        fullReport({ env: candidateEnv, p95: 30 }),
        candidateEnv,
        baseDir,
      );

      const { comparison, report } = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
      );

      expect(comparison.regressed).toBe(true);
      expect(comparison.p95.regressed).toBe(true);
      expect(report).toContain("regressed=true");
      expect(report).toContain("REGRESSED");
    });

    it("기준·candidate 가 서로 다른 디렉토리에 저장돼도 각각 로드해 비교", () => {
      const baselineDirPath = baselineDir("prev");
      const candidateDirPath = baselineDir("curr");
      const env = fullEnv(); // 같은 label 이어도 dir 이 다르면 분리 저장.
      writeBaselineFile(fullReport({ env }), env, baselineDirPath);
      writeBaselineFile(fullReport({ env, p99: 40 }), env, candidateDirPath);

      const { comparison } = compareBaselineFiles(
        env,
        baselineDirPath,
        env,
        candidateDirPath,
      );

      expect(comparison.p99.regressed).toBe(true);
      expect(comparison.regressed).toBe(true);
    });

    it("options.latencyTolerance 를 넘기면 그 허용치가 하위 비교에 그대로 위임됨", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(
        fullReport({ env: baselineEnv, p95: 15 }),
        baselineEnv,
        baseDir,
      );
      writeBaselineFile(
        fullReport({ env: candidateEnv, p95: 18 }),
        candidateEnv,
        baseDir,
      );

      // 기본 tolerance(+10%) 로는 회귀이나, 넉넉한 tolerance(+100%) 로는 회귀 아님.
      const loose = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
        {
          latencyTolerance: 1.0,
        },
      );
      const tight = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
      );

      expect(loose.comparison.regressed).toBe(false);
      expect(tight.comparison.regressed).toBe(true);
    });
  });

  describe("error path — 예외가 부작용/래핑 없이 그대로 전파", () => {
    it("(1) baselineEnv 형태 불량(null) → 기준 로드→resolveBaselinePath 의 TypeError 전파(candidate 로드·비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        compareBaselineFiles(
          null as unknown as BaselineEnvMeta,
          baseDir,
          candidateEnv,
          baseDir,
        ),
      ).toThrow(TypeError);
    });

    it("(2) baselineDir 공백-only → RangeError 전파(candidate 로드·비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        compareBaselineFiles(baselineEnv, "   ", candidateEnv, baseDir),
      ).toThrow(RangeError);
    });

    it("(3) 기준 파일 미저장 경로 → 기준 readBaselineFile 의 ENOENT 계열 전파(candidate 로드·비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      // 아무 baseline 도 write 하지 않음 — 기준 로드 단계에서 실패.
      let caught: NodeJS.ErrnoException | undefined;
      try {
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir);
      } catch (err) {
        caught = err as NodeJS.ErrnoException;
      }
      expect(caught?.code).toBe("ENOENT");
    });

    it("(4-a) 기준은 저장됐으나 candidateEnv 형태 불량(null) → candidate 로드 TypeError 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);

      expect(() =>
        compareBaselineFiles(
          baselineEnv,
          baseDir,
          null as unknown as BaselineEnvMeta,
          baseDir,
        ),
      ).toThrow(TypeError);
    });

    it("(4-b) 기준은 저장됐으나 candidateDir 공백-only → candidate 로드 RangeError 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);

      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, "   "),
      ).toThrow(RangeError);
    });

    it("(5) candidate 파일 미저장 → candidate readBaselineFile 의 ENOENT 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      // 기준만 저장, candidate 는 미저장 → candidate 로드 단계에서 실패.
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);

      let caught: NodeJS.ErrnoException | undefined;
      try {
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir);
      } catch (err) {
        caught = err as NodeJS.ErrnoException;
      }
      expect(caught?.code).toBe("ENOENT");
    });

    it("(6-a) 저장된 기준 파일 내용 불량(유효 JSON 아님) → parseBaselineReport 의 SyntaxError 전파", () => {
      const baseDir = baselineDir("baselines");
      const target = resolveBaselinePath(baselineEnv, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      fs.writeFileSync(target, "{not-json", { encoding: "utf-8" });
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );

      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir),
      ).toThrow(SyntaxError);
    });

    it("(6-b) 저장된 candidate 파일 내용 불량(형태 불량 JSON) → parseBaselineReport 의 TypeError 전파", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      const target = resolveBaselinePath(candidateEnv, baseDir);
      fs.mkdirSync(path.posix.dirname(target), { recursive: true });
      // env 필드 누락 — 유효 JSON 이지만 BaselineReport 형태 불량.
      fs.writeFileSync(target, JSON.stringify({ p50: 1 }), {
        encoding: "utf-8",
      });

      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir),
      ).toThrow(TypeError);
    });

    it("(7) options.tolerance 음수 → compareBaselineReports 의 RangeError 전파", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );

      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir, {
          latencyTolerance: -0.5,
        }),
      ).toThrow(RangeError);
    });

    it("options.errorRateTolerance NaN → compareBaselineReports 의 RangeError 전파", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );

      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir, {
          errorRateTolerance: NaN,
        }),
      ).toThrow(RangeError);
    });
  });

  describe("flow / branch coverage", () => {
    it("분기(1) 두 파일 모두 유효 로드 성공 → 비교·포맷 성공(회귀 없음)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );

      const { comparison } = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
      );
      expect(comparison.regressed).toBe(false);
    });

    it("분기(1') 두 파일 모두 유효 로드 성공 → 비교·포맷 성공(회귀 있음)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(
        fullReport({ env: baselineEnv, p99: 20 }),
        baselineEnv,
        baseDir,
      );
      writeBaselineFile(
        fullReport({ env: candidateEnv, p99: 40 }),
        candidateEnv,
        baseDir,
      );

      const { comparison } = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
      );
      expect(comparison.regressed).toBe(true);
    });

    it("분기(2) 기준 로드 단계(ENOENT)에서 candidate 로드 전 실패", () => {
      const baseDir = baselineDir("baselines");
      // candidate 만 저장하고 기준은 미저장 → 기준 로드가 먼저 실패(candidate 로드 미도달).
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );
      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir),
      ).toThrow(/ENOENT/);
    });

    it("분기(3) 기준은 성공하나 candidate 로드 단계(ENOENT)에서 실패", () => {
      const baseDir = baselineDir("baselines");
      // 기준만 저장 → candidate 로드가 실패.
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir),
      ).toThrow(/ENOENT/);
    });

    it("분기(4) 두 로드는 성공하나 비교 단계(tolerance 무효)에서 실패", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );

      expect(() =>
        compareBaselineFiles(baselineEnv, baseDir, candidateEnv, baseDir, {
          latencyTolerance: -1,
        }),
      ).toThrow(RangeError);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("baselineEnv=undefined → 기준 로드 TypeError 전파(candidate 로드·비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        compareBaselineFiles(
          undefined as unknown as BaselineEnvMeta,
          baseDir,
          candidateEnv,
          baseDir,
        ),
      ).toThrow(TypeError);
    });

    it("candidateEnv=undefined(기준 로드 성공 후) → candidate 로드 TypeError 전파(비교 미도달)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);

      expect(() =>
        compareBaselineFiles(
          baselineEnv,
          baseDir,
          undefined as unknown as BaselineEnvMeta,
          baseDir,
        ),
      ).toThrow(TypeError);
    });

    it("options 미지정(default) 호출이 기본 tolerance 로 정상 동작(옵션 optional 확인)", () => {
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport({ env: baselineEnv }), baselineEnv, baseDir);
      writeBaselineFile(
        fullReport({ env: candidateEnv }),
        candidateEnv,
        baseDir,
      );

      // options 인자 없이 호출 — 기본 tolerance 로 회귀 없음 판정.
      const { comparison, report } = compareBaselineFiles(
        baselineEnv,
        baseDir,
        candidateEnv,
        baseDir,
      );
      expect(comparison.regressed).toBe(false);
      expect(report).toContain("regressed=false");
    });

    it("기준·candidate 가 같은 (env, dir)(자기 비교)이면 comparison.regressed=false", () => {
      const baseDir = baselineDir("baselines");
      const env = fullEnv();
      writeBaselineFile(fullReport({ env }), env, baseDir);

      // 같은 (env, dir) 를 기준·candidate 로 넘김 → 같은 파일 자기 비교 → 회귀 0.
      const { comparison } = compareBaselineFiles(env, baseDir, env, baseDir);
      expect(comparison.regressed).toBe(false);
    });

    it("NaN 지표(빈 표본) 기준/candidate 비교 시 판정 제외되고 report 에 n/a 로 렌더링", () => {
      const baseDir = baselineDir("baselines");
      const emptyBaselineEnv = fullEnv({ label: "empty-prev" });
      const emptyCandidateEnv = fullEnv({ label: "empty-new" });
      writeBaselineFile(
        { ...emptyReport(), env: emptyBaselineEnv },
        emptyBaselineEnv,
        baseDir,
      );
      writeBaselineFile(
        { ...emptyReport(), env: emptyCandidateEnv },
        emptyCandidateEnv,
        baseDir,
      );

      const { comparison, report } = compareBaselineFiles(
        emptyBaselineEnv,
        baseDir,
        emptyCandidateEnv,
        baseDir,
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

/**
 * T-0873 — S2 latency baseline 파일 존재 여부 predicate(`baselineFileExists`)의 R-112 spec.
 * happy-path(write 후 true / write 전 false) / error path(경로 결정 예외가 existsSync 전에
 * 부작용 없이 그대로 전파, env·label·baseDir 3 종) / flow·branch(존재 true / 부재 false / 경로
 * 결정 단계 실패 3 분기) / negative cases 충분 cover(undefined·다중 depth 부재·존재→부재 전이).
 * `existsSync` 는 read-only 조회이므로 write spec 의 tmp 셋업/정리 패턴을 재사용하되, 존재를
 * 만들 때만 `writeBaselineFile` 로 기준을 먼저 저장한다(결정성 유지).
 */
describe("latency-baseline-io baselineFileExists (S2 baseline 존재 predicate)", () => {
  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-exists-"));
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

  /** 유효한 baseline 리포트(표본 있음) 팩토리 — 존재를 만드는 write 셋업용. */
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

  /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
  function baselineDir(...segments: string[]): string {
    return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
  }

  describe("happy path — write 후 존재 / write 전 부재", () => {
    it("writeBaselineFile 로 저장한 뒤 같은 env·baseDir 로는 true 를 반환", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(baselineFileExists(env, baseDir)).toBe(true);
    });

    it("아직 아무것도 쓰지 않은 (env, baseDir) 는 false 를 반환(예외 아님)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");

      expect(baselineFileExists(env, baseDir)).toBe(false);
    });

    it("결정된 경로가 resolveBaselinePath 와 일치해 write 가 쓴 파일을 정확히 존재로 판정", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const written = writeBaselineFile(fullReport(), env, baseDir);

      // write 반환 경로 = resolveBaselinePath, predicate 도 같은 경로 규약 공유.
      expect(written).toBe(resolveBaselinePath(env, baseDir));
      expect(baselineFileExists(env, baseDir)).toBe(true);
    });
  });

  describe("error path — 경로 결정 예외가 existsSync 전에 그대로 전파", () => {
    it("(1) env 형태 불량(null) → resolveBaselinePath 의 TypeError 전파(existsSync 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        baselineFileExists(null as unknown as BaselineEnvMeta, baseDir),
      ).toThrow(TypeError);
    });

    it("(2) env.label 공백-only → slug 무효 RangeError 전파(existsSync 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        baselineFileExists(fullEnv({ label: "   " }), baseDir),
      ).toThrow(RangeError);
    });

    it("(3) baseDir 공백-only → RangeError 전파(existsSync 미도달)", () => {
      expect(() => baselineFileExists(fullEnv(), "   ")).toThrow(RangeError);
    });

    it("baseDir non-string → TypeError 전파(existsSync 미도달)", () => {
      expect(() =>
        baselineFileExists(fullEnv(), 123 as unknown as string),
      ).toThrow(TypeError);
    });
  });

  describe("flow / branch coverage", () => {
    it("분기(1) 경로 존재 → true", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), env, baseDir);

      expect(baselineFileExists(env, baseDir)).toBe(true);
    });

    it("분기(2) 경로 부재 → false(파일을 쓰지 않은 경우)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");

      expect(baselineFileExists(env, baseDir)).toBe(false);
    });

    it("분기(3) 경로 결정 단계(잘못된 env)에서 existsSync 전에 실패", () => {
      // 유효 파일을 미리 써 두어도, env 불량이면 resolveBaselinePath 에서 먼저 throw.
      const goodEnv = fullEnv();
      const baseDir = baselineDir("baselines");
      writeBaselineFile(fullReport(), goodEnv, baseDir);

      expect(() => baselineFileExists(fullEnv({ label: "" }), baseDir)).toThrow(
        RangeError,
      );
    });
  });

  describe("negative cases 충분 cover", () => {
    it("env=undefined → TypeError 전파(existsSync 미도달)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        baselineFileExists(undefined as unknown as BaselineEnvMeta, baseDir),
      ).toThrow(TypeError);
    });

    it("baseDir=undefined → TypeError 전파(existsSync 미도달)", () => {
      expect(() =>
        baselineFileExists(fullEnv(), undefined as unknown as string),
      ).toThrow(TypeError);
    });

    it("상위 디렉토리 자체가 부재한 다중 depth 경로도 예외 아닌 false 로 조회", () => {
      const env = fullEnv();
      // baselines/a/b/c 는 상위 디렉토리조차 미존재 — existsSync 는 false 로 흡수.
      const baseDir = baselineDir("baselines", "a", "b", "c");

      expect(baselineFileExists(env, baseDir)).toBe(false);
    });

    it("write 후 파일을 제거하면 다시 false 로 판정(존재→부재 전이)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const written = writeBaselineFile(fullReport(), env, baseDir);
      expect(baselineFileExists(env, baseDir)).toBe(true);

      fs.rmSync(written);

      expect(baselineFileExists(env, baseDir)).toBe(false);
    });

    it("서로 다른 env.label 은 분리 판정 — 한쪽만 write 하면 다른 label 은 false", () => {
      const baseDir = baselineDir("baselines");
      const envA = fullEnv({ label: "ci-linux-x64" });
      const envB = fullEnv({ label: "local-macbook" });
      writeBaselineFile(fullReport({ env: envA }), envA, baseDir);

      expect(baselineFileExists(envA, baseDir)).toBe(true);
      expect(baselineFileExists(envB, baseDir)).toBe(false);
    });
  });
});

/**
 * T-0874 — S2 latency baseline confirm-or-compare 오케스트레이션(`confirmOrCompareBaseline`)의
 * R-112 spec. happy-path(최초 확정 write → "established", 직후 재호출 → "compared" 자기 비교
 * 회귀 0) / error path(경로 결정·로드·비교 각 단계 예외가 부작용 없이 그대로 전파, case 1~4) /
 * flow·branch(부재→"established" write 분기 / 존재→"compared" readCompare 분기 / 경로 결정
 * 단계 존재 판정 전 실패 분기, outcome 판별자별 반환 shape 배타 명시) / negative cases 충분 cover
 * (undefined·회귀 candidate→regressed=true 관찰(throw 아님)·존재→부재 국면 전이·options 위임).
 * 격리 임시 디렉토리에서만 동작하고 매 test 후 정리한다(결정성 유지).
 */
describe("latency-baseline-io confirmOrCompareBaseline (S2 baseline confirm-or-compare)", () => {
  /** 매 test 마다 새로 만드는 격리 임시 디렉토리 루트(afterEach 에서 재귀 삭제). */
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-baseline-confirm-"));
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

  /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
  function baselineDir(...segments: string[]): string {
    return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
  }

  describe("happy path — 최초 확정(established) → 이후 비교(compared)", () => {
    it("(1) baseline 부재이면 candidate 를 최초 확정 write 하고 outcome=established + path 반환(파일 생성)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const candidate = fullReport();

      const result = confirmOrCompareBaseline(env, baseDir, candidate);

      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        // path 는 resolveBaselinePath 규약과 일치하고 실제 파일이 생성됨.
        expect(result.path).toBe(resolveBaselinePath(env, baseDir));
        expect(fs.existsSync(result.path)).toBe(true);
      }
    });

    it("(2) 확정 직후 같은 (env, baseDir) 에 재호출하면 outcome=compared + comparison·report 존재, 자기 비교라 regressed=false", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const candidate = fullReport();

      // 1차 — 최초 확정 write.
      const first = confirmOrCompareBaseline(env, baseDir, candidate);
      expect(first.outcome).toBe("established");

      // 2차 — 이제 존재하므로 로드·비교. 동일 리포트 재비교 → 회귀 0.
      const second = confirmOrCompareBaseline(env, baseDir, candidate);
      expect(second.outcome).toBe("compared");
      if (second.outcome === "compared") {
        expect(second.comparison).toBeDefined();
        expect(second.report).toBeDefined();
        expect(second.comparison.regressed).toBe(false);
      }
    });

    it("확정 후 compared 국면의 comparison·report 가 하위 primitive 조립과 동치(위임 검증)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      const baseline = fullReport();
      confirmOrCompareBaseline(env, baseDir, baseline);

      const candidate = fullReport();
      const result = confirmOrCompareBaseline(env, baseDir, candidate);
      expect(result.outcome).toBe("compared");
      if (result.outcome === "compared") {
        // readCompareBaselineFile 을 직접 조립한 결과와 동치여야 한다.
        const expected = readCompareBaselineFile(env, baseDir, candidate);
        expect(result.comparison).toEqual(expected.comparison);
        expect(result.report).toBe(expected.report);
      }
    });
  });

  describe("error path — 예외가 부작용/래핑 없이 그대로 전파", () => {
    it("(1) env 형태 불량(null) → 경로 결정 primitive TypeError 전파(존재 판정·write·compare 미도달, 파일 미생성)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        confirmOrCompareBaseline(
          null as unknown as BaselineEnvMeta,
          baseDir,
          fullReport(),
        ),
      ).toThrow(TypeError);
      // 부작용 0 — baseDir 자체가 생성되지 않음.
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(2) env.label 공백-only → slug 무효 RangeError 전파(파일 미생성)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        confirmOrCompareBaseline(
          fullEnv({ label: "   " }),
          baseDir,
          fullReport(),
        ),
      ).toThrow(RangeError);
      expect(fs.existsSync(baseDir)).toBe(false);
    });

    it("(3) baseDir 공백-only → RangeError 전파", () => {
      expect(() =>
        confirmOrCompareBaseline(fullEnv(), "   ", fullReport()),
      ).toThrow(RangeError);
    });

    it("(4) 존재 분기에서 저장 파일 내용을 손상시키면 readCompareBaselineFile 경유 SyntaxError 전파(래핑 없이)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      // 먼저 정상 확정 write 로 파일을 존재하게 한 뒤, 내용을 유효 JSON 이 아니게 손상시킨다.
      const first = confirmOrCompareBaseline(env, baseDir, fullReport());
      expect(first.outcome).toBe("established");
      fs.writeFileSync(resolveBaselinePath(env, baseDir), "{not-json", {
        encoding: "utf-8",
      });

      expect(() =>
        confirmOrCompareBaseline(env, baseDir, fullReport()),
      ).toThrow(SyntaxError);
    });
  });

  describe("flow / branch coverage — outcome 판별자별 반환 shape 배타", () => {
    it("분기(1) baseline 부재 → established write 분기(path 채워지고 comparison/report 없음)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");

      const result = confirmOrCompareBaseline(env, baseDir, fullReport());
      expect(result.outcome).toBe("established");
      if (result.outcome === "established") {
        expect(typeof result.path).toBe("string");
        // established shape 은 comparison/report 를 갖지 않는다(배타적 union).
        expect(result).not.toHaveProperty("comparison");
        expect(result).not.toHaveProperty("report");
      }
    });

    it("분기(2) baseline 존재 → compared readCompare 분기(comparison/report 채워지고 path 없음)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      confirmOrCompareBaseline(env, baseDir, fullReport()); // 확정.

      const result = confirmOrCompareBaseline(env, baseDir, fullReport());
      expect(result.outcome).toBe("compared");
      if (result.outcome === "compared") {
        expect(result.comparison).toBeDefined();
        expect(typeof result.report).toBe("string");
        // compared shape 은 path 를 갖지 않는다(배타적 union).
        expect(result).not.toHaveProperty("path");
      }
    });

    it("분기(3) 경로 결정 단계(env 불량)에서 존재 판정 전에 실패 — 파일이 있어도 잘못된 env 면 진입 안 함", () => {
      const goodEnv = fullEnv();
      const baseDir = baselineDir("baselines");
      // 유효 파일을 미리 확정해 두어도, env 불량이면 baselineFileExists→resolveBaselinePath 에서 먼저 throw.
      confirmOrCompareBaseline(goodEnv, baseDir, fullReport());

      expect(() =>
        confirmOrCompareBaseline(fullEnv({ label: "" }), baseDir, fullReport()),
      ).toThrow(RangeError);
    });
  });

  describe("negative cases 충분 cover", () => {
    it("env=undefined → TypeError 전파(존재 판정 전 실패)", () => {
      const baseDir = baselineDir("baselines");
      expect(() =>
        confirmOrCompareBaseline(
          undefined as unknown as BaselineEnvMeta,
          baseDir,
          fullReport(),
        ),
      ).toThrow(TypeError);
    });

    it("baseDir=undefined → TypeError 전파(존재 판정 전 실패)", () => {
      expect(() =>
        confirmOrCompareBaseline(
          fullEnv(),
          undefined as unknown as string,
          fullReport(),
        ),
      ).toThrow(TypeError);
    });

    it("비교 분기에서 회귀가 있는 candidate 를 넘기면 outcome=compared + regressed=true(예외 아님 — 관찰 전용)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      // 기준 p95=15 로 확정.
      confirmOrCompareBaseline(env, baseDir, fullReport({ p95: 15 }));

      // p95 를 기본 tolerance(+10%) 초과 증가 → 회귀. throw 하지 않고 관찰만 노출.
      const result = confirmOrCompareBaseline(
        env,
        baseDir,
        fullReport({ p95: 30 }),
      );
      expect(result.outcome).toBe("compared");
      if (result.outcome === "compared") {
        expect(result.comparison.regressed).toBe(true);
        expect(result.comparison.p95.regressed).toBe(true);
      }
    });

    it("존재하던 baseline 파일을 제거한 뒤 재호출하면 compared → established 로 국면 전이(존재→부재 반영)", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      // 1차 확정 → 2차는 compared.
      confirmOrCompareBaseline(env, baseDir, fullReport());
      const compared = confirmOrCompareBaseline(env, baseDir, fullReport());
      expect(compared.outcome).toBe("compared");

      // 파일 제거 → 다시 부재 국면.
      fs.rmSync(resolveBaselinePath(env, baseDir));
      const reestablished = confirmOrCompareBaseline(
        env,
        baseDir,
        fullReport(),
      );
      expect(reestablished.outcome).toBe("established");
    });

    it("options 미지정이면 존재 분기에서 readCompareBaselineFile 기본 tolerance 로 위임됨", () => {
      const env = fullEnv();
      const baseDir = baselineDir("baselines");
      // 기준 p95=15 확정.
      confirmOrCompareBaseline(env, baseDir, fullReport({ p95: 15 }));

      // 기본 tolerance(+10%) 로는 회귀, 넉넉한 options(+100%) 로는 회귀 아님 → options 위임 확인.
      const candidate = fullReport({ p95: 18 });
      const tight = confirmOrCompareBaseline(env, baseDir, candidate);
      const loose = confirmOrCompareBaseline(env, baseDir, candidate, {
        latencyTolerance: 1.0,
      });
      expect(tight.outcome).toBe("compared");
      expect(loose.outcome).toBe("compared");
      if (tight.outcome === "compared" && loose.outcome === "compared") {
        expect(tight.comparison.regressed).toBe(true);
        expect(loose.comparison.regressed).toBe(false);
      }
    });
  });
});
