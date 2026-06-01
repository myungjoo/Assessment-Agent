// difficulty.ts spec — T-0137 acceptance (R-112: happy / error(분기) / branch /
// negative 4 카테고리). llm-gateway.interface.ts 의 LlmProvider/isLlmProvider 패턴
// spec 을 mirror. PrismaService 의존 0 (pure 식별자 contract) 이므로 mock 불요.
//
// 검증 포인트:
//   - DIFFICULTIES 가 정확히 3 슬롯 (easy/medium/hard) 을 single source 로 노출.
//   - isDifficulty 의 true 분기 (3 멤버 각각) + false 분기 (미정의 / 대소문자 /
//     공백 / 빈 문자열 등 negative cases 충분 cover).
import { DIFFICULTIES, isDifficulty, type Difficulty } from "./difficulty";

describe("difficulty", () => {
  // ------------------------------------------------------------------
  // DIFFICULTIES — single source 집합 검증 (happy)
  // ------------------------------------------------------------------
  describe("DIFFICULTIES", () => {
    // Happy path: 정확히 3 난이도 슬롯을 박제 (ADR-0011 §1 3 row 고정).
    it("정확히 easy / medium / hard 3 슬롯을 노출한다", () => {
      expect(DIFFICULTIES).toEqual(["easy", "medium", "hard"]);
      expect(DIFFICULTIES).toHaveLength(3);
    });

    // 각 멤버가 isDifficulty 의 true 분기를 만족 (집합-가드 동기성).
    it("모든 멤버가 isDifficulty true 를 만족한다 (집합-가드 동기성)", () => {
      for (const d of DIFFICULTIES) {
        expect(isDifficulty(d)).toBe(true);
      }
    });
  });

  // ------------------------------------------------------------------
  // isDifficulty — true 분기 + false 분기 + negative cases 충분 cover
  // ------------------------------------------------------------------
  describe("isDifficulty()", () => {
    // Happy path / true 분기: 3 멤버 각각 true.
    it.each(["easy", "medium", "hard"])(
      "지원 난이도 '%s' 에 true 를 반환한다 (true 분기)",
      (value) => {
        expect(isDifficulty(value)).toBe(true);
      },
    );

    // Negative / false 분기: 미정의 난이도 / 대문자 / 빈 문자열 / 공백 / 유사값 등
    // 각 false (R-112 negative cases — 예외 상황 분기마다 cover).
    it.each([
      ["빈 문자열", ""],
      ["대문자 'Easy'", "Easy"],
      ["대문자 'MEDIUM'", "MEDIUM"],
      ["미정의 난이도 'trivial'", "trivial"],
      ["미정의 난이도 'expert'", "expert"],
      ["앞뒤 공백 ' easy '", " easy "],
      ["공백 문자열 ' '", " "],
      ["부분 일치 'eas'", "eas"],
      ["숫자 문자열 '1'", "1"],
      ["null 문자열 'null'", "null"],
    ])(
      "미지원 값 (%s) 에 false 를 반환한다 (false 분기 — negative)",
      (_label, value) => {
        expect(isDifficulty(value)).toBe(false);
      },
    );

    // type guard 로 좁힌 값이 Difficulty 로 사용 가능한지 (compile + runtime 동시 검증).
    it("type guard 가 통과하면 값을 Difficulty 로 좁힌다", () => {
      const raw: string = "hard";
      if (isDifficulty(raw)) {
        const narrowed: Difficulty = raw;
        expect(narrowed).toBe("hard");
      } else {
        // 'hard' 는 항상 통과해야 하므로 본 분기 도달 시 실패.
        throw new Error("isDifficulty('hard') 가 false 를 반환했다");
      }
    });
  });
});
