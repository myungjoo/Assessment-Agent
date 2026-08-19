import {
  CHECKIN_LOG_PREFIX,
  formatCheckinOutcomeBlock,
} from "./checkin-baseline-report";
import { formatCheckinStepSummaryBlock } from "./checkin-baseline-step-summary";
import { ConfirmOrCompareResult } from "./latency-baseline-io";

/**
 * T-1610 — 체크인 baseline step 요약 markdown 포매터의 R-112 spec.
 * happy-path / error path / 분기 cover / negative cases 충분 cover 를 모두 담는다.
 * 순수 함수라 파일 시스템 · 환경변수 · 네트워크 없이 결정론적으로 검증한다(colocated unit).
 */
describe("checkin-baseline-step-summary — step 요약 포매터 (ADR-0056 §Decision 3 (b))", () => {
  /** 검증 대상 축약 alias(한 줄 단언 가독성용). */
  const summary = formatCheckinStepSummaryBlock;
  /** 기본 heading 문구(문구 자체가 검증 대상이 아닌 test 에서 재사용). */
  const TITLE = "체크인 baseline 요약";

  /** `established` 국면 결과 팩토리. */
  const est = (path: unknown = "test/perf/baselines/s2.json") =>
    ({ outcome: "established", path }) as ConfirmOrCompareResult;

  /** `compared` 국면 결과 팩토리(회귀 여부 · 상세 본문만 바꿔 쓴다). */
  const cmp = (regressed: unknown, report: unknown = "상세 본문 줄1\n줄2") =>
    ({
      outcome: "compared",
      comparison: { regressed },
      report,
    }) as unknown as ConfirmOrCompareResult;

  /** 형태 불량 입력 축약 캐스팅(예외 계약 검증 전용). */
  const bad = (value: unknown): ConfirmOrCompareResult =>
    value as ConfirmOrCompareResult;

  describe("happy-path — heading · 상태 줄 · code block 조립", () => {
    it("compared + 회귀 있음: 세 조각이 기대 순서로 이어붙는다", () => {
      const result = cmp(true);
      const lines = summary(result, TITLE).split("\n");

      expect(lines[0]).toBe(`## ${TITLE}`);
      expect(lines[1]).toBe("");
      expect(lines[2]).toContain("회귀 관찰됨");
      expect(lines[2]).toContain("exit code 불변");
      expect(lines[3]).toBe("");
      expect(lines[4]).toBe("```");
      expect(lines[lines.length - 1]).toBe("```");
      // 본문은 하위 진입점 결과를 가공 없이 그대로 싣는다(리포트 재구현 0).
      expect(lines.slice(5, -1).join("\n")).toBe(
        formatCheckinOutcomeBlock(result),
      );
    });

    it("compared + 회귀 없음: 상태 줄이 회귀 없음으로 바뀌고 나머지 골격은 같다", () => {
      const out = summary(cmp(false), TITLE);

      expect(out).toContain("회귀 없음");
      expect(out).not.toContain("**회귀 관찰됨**");
      expect(out).toContain(
        `${CHECKIN_LOG_PREFIX} outcome=compared regressed=false`,
      );
      expect(out.startsWith(`## ${TITLE}\n\n`)).toBe(true);
      expect(out.endsWith("\n```")).toBe(true);
    });

    it("established: 상태 줄이 해당 없음이고 code block 은 한 줄 요약만 담는다", () => {
      const out = summary(est(), "최초 확정");

      expect(out).toBe(
        [
          "## 최초 확정",
          "",
          "- 회귀 관찰: 해당 없음(최초 baseline 확정) — exit code 불변(관찰-only).",
          "",
          "```",
          `${CHECKIN_LOG_PREFIX} outcome=established path=test/perf/baselines/s2.json`,
          "```",
        ].join("\n"),
      );
    });

    it("heading 은 markdown h2 이고 결과 끝에 개행을 덧붙이지 않는다", () => {
      const out = summary(cmp(false), TITLE);

      expect(out).toMatch(/^## /);
      expect(out.endsWith("\n")).toBe(false);
    });
  });

  describe("분기 cover — outcome · regressed 3 분기", () => {
    it("established 분기", () => {
      expect(summary(est(), TITLE)).toContain("해당 없음");
    });

    it("compared + regressed=true 분기", () => {
      expect(summary(cmp(true), TITLE)).toContain("**회귀 관찰됨**");
    });

    it("compared + regressed=false 분기", () => {
      expect(summary(cmp(false), TITLE)).toContain("회귀 없음");
    });
  });

  describe("error path — 하위 진입점 예외 전파", () => {
    it("result 가 non-object 면 TypeError", () => {
      expect(() => summary(bad("compared"), TITLE)).toThrow(TypeError);
      expect(() => summary(bad(42), TITLE)).toThrow(TypeError);
    });

    it("result 가 null 이면 TypeError", () => {
      expect(() => summary(bad(null), TITLE)).toThrow(TypeError);
    });

    it("outcome 이 허용 밖 문자열이면 RangeError", () => {
      expect(() => summary(bad({ outcome: "skipped" }), TITLE)).toThrow(
        RangeError,
      );
    });

    it("outcome 이 non-string 이면 TypeError", () => {
      expect(() => summary(bad({ outcome: 7 }), TITLE)).toThrow(TypeError);
    });
  });

  describe("negative cases — 인자 · 하위 계약 · 순수성", () => {
    it("(a) sectionTitle 이 non-string 이면 TypeError", () => {
      expect(() => summary(cmp(false), 7 as unknown as string)).toThrow(
        TypeError,
      );
      expect(() => summary(cmp(false), undefined as unknown as string)).toThrow(
        TypeError,
      );
    });

    it("(b) sectionTitle 이 빈/공백-only 면 RangeError", () => {
      expect(() => summary(cmp(false), "")).toThrow(RangeError);
      expect(() => summary(cmp(false), "   \t ")).toThrow(RangeError);
    });

    it("(c) compared 의 report 가 빈/공백-only 면 RangeError", () => {
      expect(() => summary(cmp(false, ""), TITLE)).toThrow(RangeError);
      expect(() => summary(cmp(false, "  \n "), TITLE)).toThrow(RangeError);
    });

    it("(d) regressed 가 non-boolean 이면 TypeError", () => {
      expect(() => summary(cmp("true"), TITLE)).toThrow(TypeError);
      expect(() => summary(cmp(undefined), TITLE)).toThrow(TypeError);
    });

    it("(e) 회귀 입력에서도 throw 0 — 관찰-only 계약(exit code 불변)", () => {
      expect(() => summary(cmp(true), TITLE)).not.toThrow();
      expect(typeof summary(cmp(true), TITLE)).toBe("string");
    });

    it("(f) 같은 입력 2 회 호출은 같은 문자열을 내고 인자를 변형하지 않는다", () => {
      const result = cmp(true, "상세 본문");
      const snapshot = JSON.stringify(result);

      const first = summary(result, TITLE);
      const second = summary(result, TITLE);

      expect(second).toBe(first);
      expect(JSON.stringify(result)).toBe(snapshot);
    });

    it("established 의 path 가 빈/공백-only 면 RangeError(하위 계약 전파)", () => {
      expect(() => summary(est("  "), TITLE)).toThrow(RangeError);
    });

    it("sectionTitle 검증이 result 검증보다 먼저다(둘 다 불량이면 TypeError)", () => {
      expect(() => summary(bad(null), 7 as unknown as string)).toThrow(
        "sectionTitle 는 string 이어야 함",
      );
    });
  });
});
