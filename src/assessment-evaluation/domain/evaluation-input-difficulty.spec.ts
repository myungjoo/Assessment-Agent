// resolveInputDifficulty spec — T-2004, ADR-0065 § Decision 1 집행 slice (a).
// R-112 4 축 (CLAUDE.md §3.2): (1) happy-path easy / medium / hard 3 값 각각
// (2) error path — 비정상 scalar 에서 throw 0 + 중앙값 환원 (3) 분기 — 임계 경계
// 위/정확히/아래 + contributionKind 2 값 (4) negative — 빈 metadata · 미인식 key ·
// 결정성. 순수 함수라 mock / DI / 실 LLM 호출 0. 경계는 export 상수로만 짚는다.
import { DIFFICULTIES } from "../../llm/difficulty";

import type { EvaluationInput } from "./evaluation-input";
import {
  DEFAULT_INPUT_DIFFICULTY,
  EASY_SCORE_MAX,
  HARD_SCORE_MIN,
  KIND_SCORE_CODE,
  KIND_SCORE_DOCUMENT,
  TITLE_LENGTH_EASY_MAX,
  TITLE_LENGTH_HARD_MIN,
  resolveInputDifficulty,
} from "./evaluation-input-difficulty";

function makeInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    unitId: "github:com/sec:abc123",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "com/sec",
    author: "octocat",
    timestamp: "2026-09-10T12:00:00Z",
    metadata: { titleLength: TITLE_LENGTH_HARD_MIN },
    ...overrides,
  };
}

// titleLength (+ 선택적 kind) 만 바꿔 결과를 얻는 축약 helper.
function at(
  titleLength: unknown,
  contributionKind: EvaluationInput["contributionKind"] = "code",
) {
  return resolveInputDifficulty(
    makeInput({
      contributionKind,
      metadata: { titleLength: titleLength as number },
    }),
  );
}

describe("resolveInputDifficulty", () => {
  describe("happy-path — easy / medium / hard 3 값 각각 산출", () => {
    it("code + 긴 title → hard, code + 중간 title → medium", () => {
      expect(KIND_SCORE_CODE).toBe(1);
      expect(HARD_SCORE_MIN).toBe(3);
      expect(at(TITLE_LENGTH_HARD_MIN + 20)).toBe("hard");
      expect(at(TITLE_LENGTH_EASY_MAX + 22)).toBe("medium");
    });

    it("document + 짧은 title → easy, 반환값은 항상 Difficulty 멤버", () => {
      expect(KIND_SCORE_DOCUMENT).toBe(0);
      expect(EASY_SCORE_MAX).toBe(0);
      expect(at(TITLE_LENGTH_EASY_MAX - 10, "document")).toBe("easy");
      for (const length of [0, TITLE_LENGTH_EASY_MAX, 50, 1000]) {
        expect(DIFFICULTIES).toContain(at(length));
      }
    });
  });

  describe("error path — 비정상 scalar 는 throw 0 + medium 환원", () => {
    // ActivityMetadataValue union 전 시나리오 + 비유한 number + 음수.
    const abnormal: Array<[string, unknown]> = [
      ["string", "42"],
      ["boolean", true],
      ["null", null],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
      ["음수", -5],
    ];

    it.each(abnormal)(
      "titleLength 가 %s 이면 throw 하지 않고 medium 을 반환한다",
      (_label, value) => {
        expect(() => at(value)).not.toThrow();
        expect(at(value)).toBe(DEFAULT_INPUT_DIFFICULTY);
        expect(at(value)).toBe("medium");
      },
    );
  });

  describe("분기 — 임계 경계값과 contributionKind 2 값", () => {
    it("easy 경계 (document): 바로 아래 easy / 정확히 easy / 바로 위 medium", () => {
      expect(at(TITLE_LENGTH_EASY_MAX - 1, "document")).toBe("easy");
      expect(at(TITLE_LENGTH_EASY_MAX, "document")).toBe("easy");
      expect(at(TITLE_LENGTH_EASY_MAX + 1, "document")).toBe("medium");
    });

    it("hard 경계 (code): 바로 아래 medium / 정확히 hard / 바로 위 hard", () => {
      expect(at(TITLE_LENGTH_HARD_MIN - 1)).toBe("medium");
      expect(at(TITLE_LENGTH_HARD_MIN)).toBe("hard");
      expect(at(TITLE_LENGTH_HARD_MIN + 1)).toBe("hard");
    });

    it("contributionKind 분기: 같은 긴 title 이라도 code 는 hard, document 는 medium", () => {
      expect(at(TITLE_LENGTH_HARD_MIN + 5)).toBe("hard");
      expect(at(TITLE_LENGTH_HARD_MIN + 5, "document")).toBe("medium");
    });

    it("contributionKind 분기: 짧은 title 이어도 code 는 easy 로 내려가지 않는다", () => {
      expect(at(TITLE_LENGTH_EASY_MAX)).toBe("medium");
    });
  });

  describe("negative — 신호 부재 · 미인식 key · 결정성", () => {
    it("metadata 가 빈 객체거나 미인식 key 만 있으면 medium 으로 환원한다", () => {
      expect(resolveInputDifficulty(makeInput({ metadata: {} }))).toBe(
        DEFAULT_INPUT_DIFFICULTY,
      );
      expect(
        resolveInputDifficulty(
          makeInput({ metadata: { changedFiles: 99, author: "octocat" } }),
        ),
      ).toBe(DEFAULT_INPUT_DIFFICULTY);
    });

    it("결정성 — 2 회 호출 결과 동일 · input 무변형 · sourceType 은 v1 신호 아님", () => {
      const input = makeInput();
      expect(resolveInputDifficulty(input)).toBe(resolveInputDifficulty(input));
      expect(input).toEqual(makeInput());
      expect(
        resolveInputDifficulty(makeInput({ sourceType: "confluence" })),
      ).toBe(resolveInputDifficulty(input));
    });
  });
});
