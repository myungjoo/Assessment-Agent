import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  BaselineEnvMeta,
  BaselineReport,
  parseBaselineReport,
  resolveBaselinePath,
} from "./latency-baseline";
import { readBaselineFile, writeBaselineFile } from "./latency-baseline-io";

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
