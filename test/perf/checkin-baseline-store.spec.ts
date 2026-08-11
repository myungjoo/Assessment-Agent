import {
  CHECKIN_BASELINE_DIR,
  resolveCheckinBaselineDir,
  resolveCheckinBaselinePath,
} from "./checkin-baseline-store";
import { BaselineEnvMeta } from "./latency-baseline";

/**
 * T-1560 — 체크인 baseline 경로 해석 helper 의 R-112 spec.
 * happy-path / error path / 분기 cover / negative cases 충분 cover 를 모두 담는다.
 * 순수 함수라 fs · DB · 네트워크 없이 결정론적으로 검증한다(colocated unit).
 */
describe("checkin-baseline-store — 체크인 baseline 경로 해석 (ADR-0056 §Decision 1)", () => {
  /** 유효 env-meta 팩토리(label 만 바꿔 쓰는 최소 형태). */
  function envWith(label: string): BaselineEnvMeta {
    return { label, concurrency: 4 };
  }

  describe("CHECKIN_BASELINE_DIR — 확정 상대 경로 상수", () => {
    it("ADR-0056 §Decision 1 이 못 박은 값과 일치한다", () => {
      expect(CHECKIN_BASELINE_DIR).toBe("test/perf/baselines");
    });

    it("절대경로가 아니라 repo root 기준 상대 경로다", () => {
      expect(CHECKIN_BASELINE_DIR.startsWith("/")).toBe(false);
    });
  });

  describe("resolveCheckinBaselineDir — repoRoot 결합", () => {
    it("happy-path: 절대 repoRoot 아래 확정 디렉토리를 낸다", () => {
      expect(resolveCheckinBaselineDir("/srv/repo")).toBe(
        "/srv/repo/test/perf/baselines",
      );
    });

    it("happy-path: 상대 repoRoot 도 그대로 결합한다", () => {
      expect(resolveCheckinBaselineDir("workspace/aa")).toBe(
        "workspace/aa/test/perf/baselines",
      );
    });

    it("error path: repoRoot 가 number 이면 TypeError", () => {
      expect(() => resolveCheckinBaselineDir(42 as unknown as string)).toThrow(
        TypeError,
      );
    });

    it("error path: repoRoot 가 null 이면 TypeError", () => {
      expect(() =>
        resolveCheckinBaselineDir(null as unknown as string),
      ).toThrow(TypeError);
    });

    it("error path: repoRoot 가 undefined 이면 TypeError", () => {
      expect(() =>
        resolveCheckinBaselineDir(undefined as unknown as string),
      ).toThrow(TypeError);
    });

    it("error path: repoRoot 가 빈 string 이면 RangeError", () => {
      expect(() => resolveCheckinBaselineDir("")).toThrow(RangeError);
    });

    it("error path: repoRoot 가 공백-only 이면 RangeError", () => {
      expect(() => resolveCheckinBaselineDir("   ")).toThrow(RangeError);
    });

    it("분기 cover: 후행 슬래시 유무가 같은 결과로 정규화된다", () => {
      expect(resolveCheckinBaselineDir("/a/b/")).toBe(
        resolveCheckinBaselineDir("/a/b"),
      );
    });

    it("분기 cover: 중복 슬래시가 같은 결과로 정규화된다", () => {
      expect(resolveCheckinBaselineDir("//a//b//")).toBe(
        resolveCheckinBaselineDir("/a/b"),
      );
    });

    it("negative: 상대 repoRoot 를 절대경로로 강제하지 않는다", () => {
      expect(resolveCheckinBaselineDir("workspace").startsWith("/")).toBe(
        false,
      );
    });
  });

  describe("resolveCheckinBaselinePath — 전체 파일 경로", () => {
    it("happy-path: 절대 repoRoot 에서 확정 디렉토리 + 규약 파일명을 낸다", () => {
      expect(
        resolveCheckinBaselinePath(envWith("ci-linux-x64"), "/srv/repo"),
      ).toBe("/srv/repo/test/perf/baselines/baseline-ci-linux-x64.json");
    });

    it("happy-path: 상대 repoRoot 에서도 같은 꼬리 경로로 끝난다", () => {
      expect(resolveCheckinBaselinePath(envWith("ci-linux-x64"), "aa")).toBe(
        "aa/test/perf/baselines/baseline-ci-linux-x64.json",
      );
    });

    it("error path: repoRoot 가 non-string 이면 TypeError", () => {
      expect(() =>
        resolveCheckinBaselinePath(
          envWith("ci-linux"),
          {} as unknown as string,
        ),
      ).toThrow(TypeError);
    });

    it("error path: repoRoot 가 공백-only 이면 RangeError", () => {
      expect(() =>
        resolveCheckinBaselinePath(envWith("ci-linux"), "  "),
      ).toThrow(RangeError);
    });

    it("error path: env 가 null 이면 TypeError 가 그대로 전파된다", () => {
      expect(() =>
        resolveCheckinBaselinePath(
          null as unknown as BaselineEnvMeta,
          "/srv/repo",
        ),
      ).toThrow(TypeError);
    });

    it("error path: env.concurrency 가 non-number 이면 TypeError 가 전파된다", () => {
      expect(() =>
        resolveCheckinBaselinePath(
          { label: "ci", concurrency: "4" } as unknown as BaselineEnvMeta,
          "/srv/repo",
        ),
      ).toThrow(TypeError);
    });

    it("error path: env.label 필드가 누락되면 TypeError 가 전파된다", () => {
      expect(() =>
        resolveCheckinBaselinePath(
          { concurrency: 4 } as unknown as BaselineEnvMeta,
          "/srv/repo",
        ),
      ).toThrow(TypeError);
    });

    it("error path: env.label 이 빈 string 이면 RangeError 가 전파된다", () => {
      expect(() =>
        resolveCheckinBaselinePath(envWith(""), "/srv/repo"),
      ).toThrow(RangeError);
    });

    it("error path: env.label 이 공백-only 이면 RangeError 가 전파된다", () => {
      expect(() =>
        resolveCheckinBaselinePath(envWith("   "), "/srv/repo"),
      ).toThrow(RangeError);
    });

    it("error path: slug 이 빈 string 이 되는 label 이면 RangeError 가 전파된다", () => {
      expect(() =>
        resolveCheckinBaselinePath(envWith("///"), "/srv/repo"),
      ).toThrow(RangeError);
    });

    it("분기 cover: repoRoot 후행 슬래시 · 중복 슬래시가 동일 결과로 정규화된다", () => {
      const env = envWith("ci-linux");
      expect(resolveCheckinBaselinePath(env, "/a/b/")).toBe(
        resolveCheckinBaselinePath(env, "/a/b"),
      );
      expect(resolveCheckinBaselinePath(env, "//a//b//")).toBe(
        resolveCheckinBaselinePath(env, "/a/b"),
      );
    });

    it("분기 cover: 대소문자만 다른 label 이 동일 파일명을 낳는다(결정성)", () => {
      expect(resolveCheckinBaselinePath(envWith("CI-Linux"), "/r")).toBe(
        resolveCheckinBaselinePath(envWith("ci-linux"), "/r"),
      );
    });

    it("분기 cover: 같은 입력 반복 호출이 항상 같은 문자열을 낸다", () => {
      const env = envWith("local-macbook");
      const first = resolveCheckinBaselinePath(env, "/srv/repo");
      expect(resolveCheckinBaselinePath(env, "/srv/repo")).toBe(first);
      expect(resolveCheckinBaselinePath(env, "/srv/repo")).toBe(first);
    });

    it("negative: 확정 디렉토리 상수를 거치지 않는 경로를 내지 않는다", () => {
      const full = resolveCheckinBaselinePath(envWith("ci"), "/srv/repo");
      expect(full).toContain(`/${CHECKIN_BASELINE_DIR}/`);
    });

    it("negative: Windows 역슬래시 repoRoot 도 예외 없이 결정적 결과를 낸다", () => {
      const env = envWith("win-local");
      const full = resolveCheckinBaselinePath(env, "C:\\work\\aa");
      expect(full).toBe(resolveCheckinBaselinePath(env, "C:\\work\\aa"));
      expect(full.endsWith("test/perf/baselines/baseline-win-local.json")).toBe(
        true,
      );
    });

    it("negative: 서로 다른 label 은 서로 다른 경로를 낸다(파일 충돌 부재)", () => {
      expect(resolveCheckinBaselinePath(envWith("ci-linux"), "/r")).not.toBe(
        resolveCheckinBaselinePath(envWith("ci-macos"), "/r"),
      );
    });

    it("negative: 상대 repoRoot 는 절대경로로 강제되지 않는다", () => {
      expect(
        resolveCheckinBaselinePath(envWith("ci"), "aa").startsWith("/"),
      ).toBe(false);
    });
  });
});
