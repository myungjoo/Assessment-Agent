import {
  CHECKIN_BASELINE_ENV_FLAG,
  CheckinBaselinePlanInput,
  isCheckinBaselineEnabled,
  planCheckinBaselineCheck,
} from "./checkin-baseline-plan";
import { resolveCheckinBaselinePath } from "./checkin-baseline-store";
import { BaselineEnvMeta } from "./latency-baseline";

/**
 * T-1562 — 체크인 baseline 비교 진입 판정 helper 의 R-112 spec(happy-path / error path / 분기
 * cover / negative cases 충분 cover). 순수 함수라 파일 시스템 · 전역 환경변수 없이 결정론적으로
 * 검증한다(colocated unit).
 */
describe("checkin-baseline-plan — 비교 진입 판정 (ADR-0056 §Decision 2)", () => {
  type Env = Record<string, string | undefined>;
  const REPO_ROOT = "/srv/repo";
  /** 유효 env 메타(label 만 바꿔 파일명 분기를 본다). */
  const meta = (label = "ci-linux-x64"): BaselineEnvMeta => ({
    label,
    concurrency: 4,
  });
  /** 토글 record 축약 — 값 미지정이면 미설정(키 자체 없음) 상태. */
  const flagEnv = (value?: string): Env =>
    value === undefined ? {} : { [CHECKIN_BASELINE_ENV_FLAG]: value };
  /** 판정 입력 팩토리(필요한 필드만 덮어쓴다). */
  const input = (
    over: Partial<CheckinBaselinePlanInput> = {},
  ): CheckinBaselinePlanInput => ({
    processEnv: flagEnv("1"),
    envMeta: meta(),
    repoRoot: REPO_ROOT,
    exists: true,
    ...over,
  });
  /** 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용). */
  const bad = (value: unknown): CheckinBaselinePlanInput =>
    value as CheckinBaselinePlanInput;

  it("happy-path: 토글 이름 상수가 확정 값과 일치한다", () => {
    expect(CHECKIN_BASELINE_ENV_FLAG).toBe("PERF_CHECKIN_BASELINE");
  });
  describe("isCheckinBaselineEnabled — 토글 해석", () => {
    it.each(["1", "true", "yes", "TRUE", "Yes", " yes ", "\t1\n"])(
      "happy-path/분기 cover: %j 는 true(대소문자 · 공백 무시)",
      (value) => {
        expect(isCheckinBaselineEnabled(flagEnv(value))).toBe(true);
      },
    );
    it.each([undefined, "", "   ", "0", "false", "FALSE", "on", "y", "2"])(
      "분기 cover/negative: %j 는 false(미설정 · 빈 값 · 미지 값은 off)",
      (value) => {
        expect(isCheckinBaselineEnabled(flagEnv(value))).toBe(false);
      },
    );
    it("negative: non-string 값 · 다른 키만 있는 record 는 false", () => {
      const numeric = { [CHECKIN_BASELINE_ENV_FLAG]: 1 } as unknown as Env;
      expect(isCheckinBaselineEnabled(numeric)).toBe(false);
      expect(isCheckinBaselineEnabled({ PERF_CHECKIN: "1", CI: "true" })).toBe(
        false,
      );
    });
    it("negative: 인자 record 를 변형하지 않는다(입력 불변)", () => {
      const env = flagEnv("yes");
      isCheckinBaselineEnabled(env);
      expect(env).toEqual({ [CHECKIN_BASELINE_ENV_FLAG]: "yes" });
    });
    it.each([null, undefined, "1", 7, true])(
      "error path: env 가 %j 면 TypeError",
      (value) => {
        expect(() => isCheckinBaselineEnabled(value as unknown as Env)).toThrow(
          TypeError,
        );
      },
    );
  });

  describe("planCheckinBaselineCheck — 진입 판정", () => {
    const path = resolveCheckinBaselinePath(meta(), REPO_ROOT);
    it("happy-path: 토글 on + exists=true 면 compare 와 해석된 경로를 낸다", () => {
      expect(planCheckinBaselineCheck(input())).toEqual({
        mode: "compare",
        baselinePath: path,
      });
    });
    it("happy-path: 토글 on + exists=false 면 skip(absent) + 해석된 경로를 낸다", () => {
      expect(planCheckinBaselineCheck(input({ exists: false }))).toEqual({
        mode: "skip",
        reason: "absent",
        baselinePath: path,
      });
    });
    it("happy-path: 토글 off 면 skip(disabled) + baselinePath=null", () => {
      expect(
        planCheckinBaselineCheck(input({ processEnv: flagEnv("0") })),
      ).toEqual({ mode: "skip", reason: "disabled", baselinePath: null });
    });
    it.each([true, false])(
      "분기 cover: 토글 off × exists=%j 는 exists 를 보지 않고 skip(disabled)",
      (exists) => {
        expect(
          planCheckinBaselineCheck(input({ processEnv: flagEnv(), exists })),
        ).toEqual({ mode: "skip", reason: "disabled", baselinePath: null });
      },
    );
    it("negative: 토글 off 면 무효 repoRoot · envMeta 를 줘도 경로 해석 예외가 없다", () => {
      const arg = bad({ processEnv: flagEnv("false"), repoRoot: "" });
      expect(() => planCheckinBaselineCheck(arg)).not.toThrow();
      expect(planCheckinBaselineCheck(arg).baselinePath).toBeNull();
    });
    it("negative: 반환 mode 에 write · establish 계열이 없다(CI 는 baseline 을 쓰지 않는다)", () => {
      const modes = [
        planCheckinBaselineCheck(input()).mode,
        planCheckinBaselineCheck(input({ exists: false })).mode,
        planCheckinBaselineCheck(input({ processEnv: flagEnv() })).mode,
      ];
      expect(modes).toEqual(["compare", "skip", "skip"]);
      expect(modes).not.toContain("write");
      expect(modes).not.toContain("establish");
    });
    it("negative: 같은 입력 반복 호출이 항상 같은 결과를 낸다(결정성)", () => {
      const arg = input({ exists: false });
      expect(planCheckinBaselineCheck(arg)).toEqual(
        planCheckinBaselineCheck(arg),
      );
    });
    it("negative: 서로 다른 envMeta.label 은 서로 다른 baselinePath 를 낸다", () => {
      const a = planCheckinBaselineCheck(input({ envMeta: meta("ci-linux") }));
      const b = planCheckinBaselineCheck(input({ envMeta: meta("local-mac") }));
      expect(a.baselinePath).not.toBe(b.baselinePath);
    });
    it("negative: 호출이 인자 객체 · processEnv 를 변형하지 않는다(입력 불변)", () => {
      const arg = input();
      const snapshot = JSON.stringify(arg);
      planCheckinBaselineCheck(arg);
      expect(JSON.stringify(arg)).toBe(snapshot);
    });
    it.each([null, undefined, "compare", 7])(
      "error path: input 이 %j 면 TypeError",
      (value) => {
        expect(() => planCheckinBaselineCheck(bad(value))).toThrow(TypeError);
      },
    );
    it("error path: processEnv 가 non-object 이면 위임 TypeError 가 전파", () => {
      expect(() =>
        planCheckinBaselineCheck(bad({ ...input(), processEnv: null })),
      ).toThrow(TypeError);
    });
    it.each(["true", undefined, 1])(
      "error path: 토글 on 인데 exists 가 %j 면 TypeError",
      (exists) => {
        expect(() =>
          planCheckinBaselineCheck(bad({ ...input(), exists })),
        ).toThrow(TypeError);
      },
    );
    it("error path: repoRoot · envMeta 형태 불량은 위임 TypeError 가 그대로 전파", () => {
      expect(() =>
        planCheckinBaselineCheck(bad({ ...input(), repoRoot: 42 })),
      ).toThrow(TypeError);
      expect(() =>
        planCheckinBaselineCheck(bad({ ...input(), envMeta: null })),
      ).toThrow(TypeError);
    });
    it("error path: repoRoot 빈·공백-only · label 무효는 위임 RangeError 가 그대로 전파", () => {
      expect(() =>
        planCheckinBaselineCheck(bad({ ...input(), repoRoot: "" })),
      ).toThrow(RangeError);
      expect(() =>
        planCheckinBaselineCheck(bad({ ...input(), repoRoot: "  " })),
      ).toThrow(RangeError);
      expect(() =>
        planCheckinBaselineCheck(input({ envMeta: meta("  ") })),
      ).toThrow(RangeError);
    });
  });
});
