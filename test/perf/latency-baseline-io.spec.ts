import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  BaselineEnvMeta,
  BaselineReport,
  parseBaselineReport,
  resolveBaselinePath,
} from "./latency-baseline";
import { writeBaselineFile } from "./latency-baseline-io";

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
