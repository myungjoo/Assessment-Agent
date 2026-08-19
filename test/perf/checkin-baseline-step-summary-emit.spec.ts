import { CheckinBaselineRunOutcome } from "./checkin-baseline-run";
import { formatCheckinStepSummaryBlock } from "./checkin-baseline-step-summary";
import { emitCheckinStepSummary } from "./checkin-baseline-step-summary-emit";
import {
  CheckinStepSummarySinkDeps,
  GITHUB_STEP_SUMMARY_ENV,
} from "./checkin-baseline-step-summary-sink";
import { ConfirmOrCompareResult } from "./latency-baseline-io";

/**
 * T-1614 — 실행 결과 → 포매터 → sink 합성 진입점의 R-112 spec(happy-path / error path /
 * 분기 cover / negative cases 충분 cover). append 함수와 환경변수 record 를 주입해 파일 시스템 ·
 * 전역 환경변수 없이 결정론적으로 검증한다(ADR-0056 §Decision 3 (b) exit code 불변 포함).
 */
describe("checkin-baseline-step-summary-emit — 요약 합성 진입점 (ADR-0056 §Decision 3 (b))", () => {
  type Env = Record<string, string | undefined>;
  const PATH = "/github/file_commands/step_summary";
  const TITLE = "체크인 baseline 요약";
  const env = (value?: string): Env =>
    value === undefined ? {} : { [GITHUB_STEP_SUMMARY_ENV]: value };
  /** 환경변수 record + 호출 관찰용 mock append 주입 묶음. */
  const deps = (over: Partial<CheckinStepSummarySinkDeps> = {}) =>
    ({
      processEnv: env(PATH),
      append: jest.fn(),
      ...over,
    }) as CheckinStepSummarySinkDeps & { append: jest.Mock };
  /** 비교 판별 union 팩토리 — 포매터 입력이자 실행 결과의 `confirmOrCompare` 값. */
  const cmp = (regressed = false, report = "상세 본문 ` 줄1\n줄2 ✅") =>
    ({
      outcome: "compared",
      comparison: { regressed },
      report,
    }) as unknown as ConfirmOrCompareResult;
  /** 비교 국면 실행 결과 팩토리 — 회귀 여부 · 상세 본문만 갈아끼운다. */
  const compared = (regressed = false, report?: string) =>
    ({
      status: "compared",
      regressed,
      log: `[checkin-baseline] outcome=compared regressed=${regressed}`,
      confirmOrCompare: cmp(regressed, report),
    }) as CheckinBaselineRunOutcome;
  /** 단락 국면 실행 결과 팩토리(비교가 없었으므로 `confirmOrCompare` 자체가 없다). */
  const skipped = (reason: "disabled" | "absent") =>
    ({
      status: "skipped",
      reason,
      log: `[checkin-baseline] outcome=skipped reason=${reason}`,
    }) as CheckinBaselineRunOutcome;
  const bad = <T>(v: unknown): T => v as T;

  describe("happy-path — 비교 국면 요약 append", () => {
    it("compared 입력이면 appended 를 내고 포매터 결과를 가공 없이 1 회 append 한다", () => {
      const injected = deps();
      const expected = formatCheckinStepSummaryBlock(cmp(), TITLE);
      expect(emitCheckinStepSummary(compared(), TITLE, injected)).toEqual({
        status: "appended",
        path: PATH,
      });
      expect(injected.append).toHaveBeenCalledTimes(1);
      // 백틱 · 유니코드가 섞여도 본문 가공 0 — 끝 개행 1 개 보장은 sink 책임이다.
      expect(injected.append).toHaveBeenCalledWith(PATH, `${expected}\n`);
    });
  });
  describe("error path — 예외는 삼켜 failed 로만 보고(exit code 불변)", () => {
    it.each([
      ["report 가 빈 문자열(포매터 RangeError)", compared(false, "")],
      [
        "confirmOrCompare 형태 불량(포매터 TypeError)",
        bad<CheckinBaselineRunOutcome>({
          status: "compared",
          regressed: false,
          log: "무관",
          confirmOrCompare: { outcome: "compared", report: "본문" },
        }),
      ],
    ])("%s — 전파 없이 format-threw 이고 append 는 0 회", (_l, outcome) => {
      const injected = deps();
      expect(emitCheckinStepSummary(outcome, TITLE, injected)).toEqual({
        status: "failed",
        reason: "format-threw",
      });
      expect(injected.append).not.toHaveBeenCalled();
    });
    it("sink append 가 던지면 sink 판정을 그대로 통과시켜 append-threw 를 낸다", () => {
      const append = jest.fn(() => {
        throw Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        });
      });
      expect(
        emitCheckinStepSummary(compared(), TITLE, deps({ append })),
      ).toEqual({ status: "failed", reason: "append-threw" });
      expect(append).toHaveBeenCalledTimes(1);
    });
  });
  describe("분기 cover — 실행 결과 갈래 · sink 단락 갈래 · 회귀 여부", () => {
    it.each([["disabled" as const], ["absent" as const]])(
      "skipped(%s) 입력은 not-compared 로 단락하고 append 를 0 회 호출한다",
      (reason) => {
        const injected = deps();
        expect(
          emitCheckinStepSummary(skipped(reason), TITLE, injected),
        ).toEqual({ status: "skipped", reason: "not-compared" });
        expect(injected.append).not.toHaveBeenCalled();
        // deps.append 가 불량이어도 단락이 우선이라 throw 0(하위 sink 미도달).
        expect(
          emitCheckinStepSummary(
            skipped(reason),
            TITLE,
            deps({ append: bad<never>(undefined) }),
          ),
        ).toEqual({ status: "skipped", reason: "not-compared" });
      },
    );
    it.each([
      ["키 부재", undefined, "env-absent"],
      ["빈 문자열", "", "env-blank"],
    ])(
      "환경변수가 %s 면 sink 단락 사유를 그대로 통과시킨다",
      (_l, v, reason) => {
        const injected = deps({ processEnv: env(v as string | undefined) });
        expect(emitCheckinStepSummary(compared(), TITLE, injected)).toEqual({
          status: "skipped",
          reason,
        });
        expect(injected.append).not.toHaveBeenCalled();
      },
    );
    it.each([
      ["회귀 있음", true, "**회귀 관찰됨**"],
      ["회귀 없음", false, "회귀 없음"],
    ])("%s 입력 모두 throw 0 이고 status 가 갈리지 않는다", (_l, r, mark) => {
      const injected = deps();
      expect(
        emitCheckinStepSummary(compared(r as boolean), TITLE, injected),
      ).toEqual({ status: "appended", path: PATH });
      // 회귀 사실은 요약 본문에만 드러난다(exit code · status 불변).
      expect(injected.append.mock.calls[0][1]).toContain(mark);
    });
  });
  describe("negative cases — 인자 형태 위반은 던진다(프로그래머 오류)", () => {
    it.each([
      ["number", 7],
      ["null", null],
      ["undefined", undefined],
    ])("outcome 이 %s 면 TypeError", (_l, value) => {
      expect(() => emitCheckinStepSummary(bad(value), TITLE, deps())).toThrow(
        TypeError,
      );
    });
    it.each([
      ["number", 7],
      ["null", null],
    ])("sectionTitle 이 %s 면 TypeError", (_l, value) => {
      expect(() =>
        emitCheckinStepSummary(compared(), bad(value), deps()),
      ).toThrow(TypeError);
    });
    it.each([
      ["빈 문자열", ""],
      ["공백-only", " \n\t "],
    ])("sectionTitle 이 %s 면 RangeError", (_l, value) => {
      expect(() => emitCheckinStepSummary(compared(), value, deps())).toThrow(
        RangeError,
      );
    });
    it.each([
      ["null", null],
      ["문자열", "deps"],
    ])("deps 가 %s 면 TypeError", (_l, value) => {
      expect(() =>
        emitCheckinStepSummary(compared(), TITLE, bad(value)),
      ).toThrow(TypeError);
    });
    it.each([
      ["deps.append 가 non-function", { append: bad<never>(undefined) }],
      ["deps.processEnv 가 null", { processEnv: bad<never>(null) }],
    ])("%s 이면 하위 sink 예외 계약대로 TypeError 전파", (_l, over) => {
      expect(() =>
        emitCheckinStepSummary(compared(), TITLE, deps(over)),
      ).toThrow(TypeError);
    });
    it("같은 입력 2 회 호출이 같은 결과를 내고 인자를 변형하지 않는다(순수성)", () => {
      const outcome = compared(true);
      const snapshot = JSON.parse(JSON.stringify(outcome));
      const injected = deps();
      const envSnapshot = { ...injected.processEnv };
      const first = emitCheckinStepSummary(outcome, TITLE, injected);
      expect(emitCheckinStepSummary(outcome, TITLE, injected)).toEqual(first);
      expect(outcome).toEqual(snapshot);
      expect(injected.processEnv).toEqual(envSnapshot);
      const calls = injected.append.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[1]).toEqual(calls[0]);
    });
  });
});
