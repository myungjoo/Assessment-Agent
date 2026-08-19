import { formatCheckinStepSummaryBlock } from "./checkin-baseline-step-summary";
import {
  CheckinStepSummarySinkDeps,
  GITHUB_STEP_SUMMARY_ENV,
  StepSummaryAppendFn,
  appendCheckinStepSummary,
} from "./checkin-baseline-step-summary-sink";
import { ConfirmOrCompareResult } from "./latency-baseline-io";

/**
 * T-1612 — step 요약 append sink 의 R-112 spec(happy-path / error path / 분기 cover /
 * negative cases 충분 cover). append 함수와 환경변수 record 를 주입해 파일 시스템 · 전역
 * 환경변수 없이 결정론적으로 검증한다(ADR-0056 §Decision 3 (b) exit code 불변 포함).
 */
describe("checkin-baseline-step-summary-sink — 요약 append sink (ADR-0056 §Decision 3 (b))", () => {
  type Env = Record<string, string | undefined>;
  const PATH = "/github/file_commands/step_summary";
  const BLOCK = "## 체크인 baseline 요약\n\n- 회귀 관찰: 회귀 없음";
  /** 경로 값을 실어 주는 환경변수 record 팩토리(키 자체를 빼려면 인자를 생략한다). */
  const env = (value?: string): Env =>
    value === undefined ? {} : { [GITHUB_STEP_SUMMARY_ENV]: value };
  /** 호출 횟수 · 인자 관찰용 mock append 함수. */
  const okAppend = (): jest.Mock => jest.fn();
  const deps = (
    over: Partial<CheckinStepSummarySinkDeps> = {},
  ): CheckinStepSummarySinkDeps => ({
    processEnv: env(PATH),
    append: okAppend(),
    ...over,
  });
  /** 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용). */
  const bad = (v: unknown): CheckinStepSummarySinkDeps =>
    v as CheckinStepSummarySinkDeps;
  const badFn = (v: unknown): StepSummaryAppendFn => v as StepSummaryAppendFn;

  describe("happy-path — append 수행 국면", () => {
    it("환경변수가 정상 경로면 appended 를 내고 append 를 1 회 호출한다", () => {
      const append = okAppend();
      const result = appendCheckinStepSummary(BLOCK, {
        processEnv: env(PATH),
        append,
      });
      expect(result).toEqual({ status: "appended", path: PATH });
      expect(append).toHaveBeenCalledTimes(1);
      expect(append).toHaveBeenCalledWith(PATH, `${BLOCK}\n`);
    });
    it("포매터 실제 출력도 본문 변형 없이 끝 개행 1 개만 붙여 넘긴다", () => {
      const result = {
        outcome: "compared",
        comparison: { regressed: true },
        report: "상세 본문 줄1\n줄2",
      } as unknown as ConfirmOrCompareResult;
      const block = formatCheckinStepSummaryBlock(result, "체크인 baseline");
      const append = okAppend();
      const outcome = appendCheckinStepSummary(block, {
        processEnv: env(PATH),
        append,
      });
      expect(outcome).toEqual({ status: "appended", path: PATH });
      expect(append.mock.calls[0][1]).toBe(`${block}\n`);
    });
    it("이미 개행으로 끝나는 블록에는 개행을 더 붙이지 않는다", () => {
      const append = okAppend();
      appendCheckinStepSummary(`${BLOCK}\n`, { processEnv: env(PATH), append });
      expect(append.mock.calls[0][1]).toBe(`${BLOCK}\n`);
    });
  });
  describe("분기 cover — skip 국면(append 호출 0 회)", () => {
    it.each([
      ["키 부재", undefined, "env-absent"],
      ["빈 문자열", "", "env-blank"],
      ["공백-only", "   \t ", "env-blank"],
    ])("%s 면 %s 사유로 skipped 이고 append 는 0 회", (_l, value, reason) => {
      const append = okAppend();
      const result = appendCheckinStepSummary(BLOCK, {
        processEnv: env(value as string | undefined),
        append,
      });
      expect(result).toEqual({ status: "skipped", reason });
      expect(append).not.toHaveBeenCalled();
    });
    it("환경변수 값이 non-string 이면 env-blank 로 단락한다(런타임 방어)", () => {
      const append = okAppend();
      const result = appendCheckinStepSummary(BLOCK, {
        processEnv: { [GITHUB_STEP_SUMMARY_ENV]: 7 } as unknown as Env,
        append,
      });
      expect(result).toEqual({ status: "skipped", reason: "env-blank" });
      expect(append).not.toHaveBeenCalled();
    });
  });
  describe("error path — append 실패는 삼켜 failed 로만 보고(exit code 불변)", () => {
    it("append 가 EACCES 계열 Error 를 던져도 전파하지 않고 failed 를 낸다", () => {
      const append = jest.fn(() => {
        throw Object.assign(new Error("EACCES: permission denied"), {
          code: "EACCES",
        });
      });
      const result = appendCheckinStepSummary(BLOCK, {
        processEnv: env(PATH),
        append,
      });
      expect(result).toEqual({ status: "failed", reason: "append-threw" });
      expect(append).toHaveBeenCalledTimes(1);
    });
    it.each([
      ["문자열", "디스크 가득 참"],
      ["undefined", undefined],
    ])(
      "append 가 Error 아닌 %s 를 던져도 삼키고 failed 를 낸다",
      (_l, thrown) => {
        const append = jest.fn(() => {
          throw thrown;
        });
        expect(
          appendCheckinStepSummary(BLOCK, { processEnv: env(PATH), append }),
        ).toEqual({ status: "failed", reason: "append-threw" });
      },
    );
  });
  describe("negative cases — 인자 형태 위반은 던진다(프로그래머 오류)", () => {
    it.each([
      ["number", 7],
      ["null", null],
      ["undefined", undefined],
    ])("block 이 %s 면 TypeError", (_l, value) => {
      expect(() =>
        appendCheckinStepSummary(value as unknown as string, deps()),
      ).toThrow(TypeError);
    });
    it.each([
      ["빈 문자열", ""],
      ["공백-only", " \n\t "],
    ])("block 이 %s 면 RangeError", (_l, value) => {
      expect(() => appendCheckinStepSummary(value, deps())).toThrow(RangeError);
    });
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["number", 7],
    ])("deps 가 %s 면 TypeError", (_l, value) => {
      expect(() => appendCheckinStepSummary(BLOCK, bad(value))).toThrow(
        TypeError,
      );
    });
    it.each([
      ["null", null],
      ["문자열", "env"],
    ])("deps.processEnv 가 %s 면 TypeError", (_l, value) => {
      expect(() =>
        appendCheckinStepSummary(
          BLOCK,
          deps({ processEnv: value as unknown as Env }),
        ),
      ).toThrow(TypeError);
    });
    it.each([
      ["undefined", undefined],
      ["문자열", "append"],
    ])("deps.append 가 %s 면 TypeError", (_l, value) => {
      expect(() =>
        appendCheckinStepSummary(BLOCK, deps({ append: badFn(value) })),
      ).toThrow(TypeError);
    });
    it("개행 · 백틱 · 유니코드가 섞여도 본문이 한 글자도 바뀌지 않는다", () => {
      const block = "## 요약 ✅\n\n```` `` ````\n\t들여쓰기 — ✓";
      const append = okAppend();
      appendCheckinStepSummary(block, { processEnv: env(PATH), append });
      expect(append.mock.calls[0][1]).toBe(`${block}\n`);
    });
    it("같은 입력 2 회 호출이 같은 결과를 내고 인자를 변형하지 않는다(순수성)", () => {
      const processEnv = env(PATH);
      const snapshot = { ...processEnv };
      const append = okAppend();
      const injected: CheckinStepSummarySinkDeps = { processEnv, append };
      const first = appendCheckinStepSummary(BLOCK, injected);
      const second = appendCheckinStepSummary(BLOCK, injected);
      expect(second).toEqual(first);
      expect(processEnv).toEqual(snapshot);
      expect(Object.keys(injected)).toEqual(["processEnv", "append"]);
      expect(injected.append).toBe(append);
      expect(append).toHaveBeenCalledTimes(2);
      expect(append.mock.calls[1]).toEqual(append.mock.calls[0]);
    });
  });
});
