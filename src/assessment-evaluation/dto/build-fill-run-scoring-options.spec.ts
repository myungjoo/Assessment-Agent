// build-fill-run-scoring-options.spec — buildFillRunScoringOptions(순수 factory)의
// R-112 검증(happy / error / flow·branch / negative 충분 cover). 외부 의존 0 이라
// mock 없이 순수 입력 → 출력 단언만으로 완결한다.

import { buildFillRunScoringOptions } from "./build-fill-run-scoring-options";

describe("buildFillRunScoringOptions", () => {
  describe("happy path — request 채택 / default fallback", () => {
    it("request modelId 가 유효 non-empty string 이면 그 값을 채택한다", () => {
      const result = buildFillRunScoringOptions("gpt-4o", "default-model");

      expect(result).toEqual({ modelId: "gpt-4o" });
    });

    it("request 가 undefined 면 default 로 fallback 한다", () => {
      const result = buildFillRunScoringOptions(undefined, "default-model");

      expect(result).toEqual({ modelId: "default-model" });
    });

    it("항상 새 객체(ScoringOptions)를 반환한다 — 호출마다 다른 인스턴스", () => {
      const a = buildFillRunScoringOptions("m", "d");
      const b = buildFillRunScoringOptions("m", "d");

      expect(a).toEqual({ modelId: "m" });
      expect(a).not.toBe(b);
    });
  });

  describe("flow / branch — 3 분기 분리", () => {
    it("[분기1] request 채택 — request 가 유효하면 default 가 유효해도 request 우선", () => {
      const result = buildFillRunScoringOptions("req-model", "def-model");

      expect(result).toEqual({ modelId: "req-model" });
    });

    it("[분기2] default fallback — request 가 비어있고 default 가 유효하면 default 채택", () => {
      const result = buildFillRunScoringOptions(null, "def-model");

      expect(result).toEqual({ modelId: "def-model" });
    });

    it("[분기3] default 무효 throw — request·default 모두 비어있으면 TypeError", () => {
      expect(() => buildFillRunScoringOptions(undefined, "")).toThrow(
        TypeError,
      );
    });

    it("request 가 유효하면 default 가 무효(빈 문자열)여도 request 우선 채택(throw 안 함)", () => {
      const result = buildFillRunScoringOptions("req-model", "");

      expect(result).toEqual({ modelId: "req-model" });
    });
  });

  describe("trim — 앞뒤 공백 제거 후 채택", () => {
    it("request modelId 의 앞뒤 공백을 제거하여 채택한다", () => {
      const result = buildFillRunScoringOptions("  gpt-4o  ", "default-model");

      expect(result).toEqual({ modelId: "gpt-4o" });
    });

    it("default 로 fallback 할 때도 default 의 앞뒤 공백을 제거하여 채택한다", () => {
      const result = buildFillRunScoringOptions(undefined, "  default-model  ");

      expect(result).toEqual({ modelId: "default-model" });
    });
  });

  describe("negative — request 가 비어있는 모든 형태는 default 로 수렴", () => {
    it("request 가 null 이면 default fallback", () => {
      expect(buildFillRunScoringOptions(null, "d")).toEqual({ modelId: "d" });
    });

    it('request 가 빈 문자열 "" 이면 default fallback', () => {
      expect(buildFillRunScoringOptions("", "d")).toEqual({ modelId: "d" });
    });

    it('request 가 whitespace-only "  " 이면 default fallback', () => {
      expect(buildFillRunScoringOptions("   ", "d")).toEqual({ modelId: "d" });
    });

    it("request 가 undefined 이면 default fallback", () => {
      expect(buildFillRunScoringOptions(undefined, "d")).toEqual({
        modelId: "d",
      });
    });
  });

  describe("negative — default 무효(빈/whitespace) + request 비어 fallback 불가 → TypeError", () => {
    it("request undefined + default 빈 문자열 → 한국어 TypeError", () => {
      expect(() => buildFillRunScoringOptions(undefined, "")).toThrow(
        /request·default modelId 가 모두 비어있어/,
      );
    });

    it("request null + default whitespace-only → TypeError", () => {
      expect(() => buildFillRunScoringOptions(null, "   ")).toThrow(TypeError);
    });

    it("request 빈 문자열 + default whitespace-only → TypeError", () => {
      expect(() => buildFillRunScoringOptions("", "  ")).toThrow(TypeError);
    });
  });

  describe("negative — type mismatch(비-string) 한국어 TypeError", () => {
    it("request 가 number 이면 한국어 TypeError(request modelId)", () => {
      expect(() =>
        buildFillRunScoringOptions(123 as unknown as string, "d"),
      ).toThrow(/request modelId 는 string 이어야 한다/);
    });

    it("request 가 object 이면 TypeError", () => {
      expect(() =>
        buildFillRunScoringOptions({} as unknown as string, "d"),
      ).toThrow(TypeError);
    });

    it("default 가 number 이면(request 비어 fallback 시점) 한국어 TypeError(default modelId)", () => {
      expect(() =>
        buildFillRunScoringOptions(undefined, 456 as unknown as string),
      ).toThrow(/default modelId 는 string 이어야 한다/);
    });

    it("request 가 유효하면 default 가 비-string(number)여도 default 를 보지 않아 throw 안 함", () => {
      const result = buildFillRunScoringOptions(
        "req-model",
        789 as unknown as string,
      );

      expect(result).toEqual({ modelId: "req-model" });
    });
  });
});
