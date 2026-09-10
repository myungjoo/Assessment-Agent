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

  describe("스위치(useInputDifficultyRouting) — ON 일 때만 키가 실린다", () => {
    it("[분기1 ON] 3 번째 인자가 true 면 반환에 useInputDifficultyRouting: true 가 실린다", () => {
      const result = buildFillRunScoringOptions("gpt-4o", "d", true);

      expect(result).toEqual({
        modelId: "gpt-4o",
        useInputDifficultyRouting: true,
      });
    });

    it("[분기2 명시 OFF] false 면 스위치 키를 얹지 않고 { modelId } 단일 키로 남는다", () => {
      const result = buildFillRunScoringOptions("gpt-4o", "d", false);

      expect(result).toEqual({ modelId: "gpt-4o" });
      expect("useInputDifficultyRouting" in result).toBe(false);
    });

    it("[분기3 미지정 OFF] 3 번째 인자를 생략하면 종전과 문자 단위로 같은 { modelId } 다", () => {
      const result = buildFillRunScoringOptions("gpt-4o", "d");

      expect(result).toEqual({ modelId: "gpt-4o" });
      expect("useInputDifficultyRouting" in result).toBe(false);
    });

    it("modelId 축 × 스위치 축 독립 — request 우선 채택 + ON 조합", () => {
      const result = buildFillRunScoringOptions("  req-model  ", "def", true);

      expect(result).toEqual({
        modelId: "req-model",
        useInputDifficultyRouting: true,
      });
    });

    it("modelId 축 × 스위치 축 독립 — default fallback + ON 조합", () => {
      const result = buildFillRunScoringOptions(undefined, "def-model", true);

      expect(result).toEqual({
        modelId: "def-model",
        useInputDifficultyRouting: true,
      });
    });

    it("스위치 ON 이어도 새 객체 반환 + 호출 간 공유 0(비변형)", () => {
      const a = buildFillRunScoringOptions("m", "d", true);
      const b = buildFillRunScoringOptions("m", "d", true);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe("error path — 스위치 ON 이 modelId 축 fail-fast 를 우회하지 못한다", () => {
    it("스위치 true + request·default 모두 빈 값 → 한국어 TypeError 그대로 전파", () => {
      expect(() => buildFillRunScoringOptions("", "   ", true)).toThrow(
        /request·default modelId 가 모두 비어있어/,
      );
    });

    it("스위치 true + request 가 비-string(number) → modelId 축 TypeError 그대로", () => {
      expect(() =>
        buildFillRunScoringOptions(123 as unknown as string, "d", true),
      ).toThrow(/request modelId 는 string 이어야 한다/);
    });
  });

  describe("negative — 비-boolean 스위치는 throw 없이 OFF 로 환원", () => {
    // ADR-0066 § Decision 3 service 경계 — HTTP 밖 caller 의 비-boolean 은 400 이 아니라
    // OFF 환원이며, truthy 값이 조용히 ON 으로 접히지 않는 것이 load-bearing 이다.
    it.each([[null], ["true"], [1], [{}]])(
      "스위치가 %p 이면 throw 0 + 스위치 키 부재",
      (value: unknown) => {
        const result = buildFillRunScoringOptions(
          "gpt-4o",
          "d",
          value as boolean,
        );

        expect(result).toEqual({ modelId: "gpt-4o" });
        expect("useInputDifficultyRouting" in result).toBe(false);
      },
    );
  });
});
