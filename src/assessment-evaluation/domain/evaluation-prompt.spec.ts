// evaluation-prompt.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). 두 순수 함수의 결정적 변환을
// 검증한다:
//   - buildEvaluationPrompt — typed 필드 직렬화 + titleLength 분기 + REQ-032 raw 0.
//   - classifyNarrative — marker 추출 + 허용 집합 좁히기 + default fallback 분기.
// 모든 분기(titleLength number 정상 / 비정상 / 비-number, marker 인식 / 미인식 /
// 부재)를 cover 한다. `evaluation-volume.spec.ts` 패턴 mirror.

import type {
  ActivityMetadata,
  ActivityMetadataValue,
} from "../../assessment-collection/domain/activity";
import { DIFFICULTIES } from "../../llm/difficulty";

import type { ContributionKind, EvaluationInput } from "./evaluation-input";
import { buildEvaluationPrompt, classifyNarrative } from "./evaluation-prompt";
import { CONTRIBUTION_LEVELS } from "./evaluation-result";

// prompt 조립은 typed 필드만 사용하므로 나머지는 고정 stub 후 관심 필드만 override.
function makeInput(
  overrides: Partial<EvaluationInput> = {},
  metadata: ActivityMetadata = {},
): EvaluationInput {
  return {
    unitId: "github:sec:abc",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata,
    ...overrides,
  };
}

describe("buildEvaluationPrompt", () => {
  describe("happy-path — 신호 포함 (R-112-1)", () => {
    it("code 기여 입력의 prompt 가 contributionKind/sourceType 신호를 포함한다", () => {
      const prompt = buildEvaluationPrompt(
        makeInput({ contributionKind: "code", sourceType: "github" }),
      );
      expect(prompt).toContain("contributionKind: code");
      expect(prompt).toContain("sourceType: github");
    });

    it("document 기여 입력의 prompt 가 contributionKind/sourceType 신호를 포함한다", () => {
      const prompt = buildEvaluationPrompt(
        makeInput({ contributionKind: "document", sourceType: "confluence" }),
      );
      expect(prompt).toContain("contributionKind: document");
      expect(prompt).toContain("sourceType: confluence");
    });

    it("timestamp 신호를 포함한다", () => {
      const prompt = buildEvaluationPrompt(
        makeInput({ timestamp: "2026-06-01T09:00:00Z" }),
      );
      expect(prompt).toContain("timestamp: 2026-06-01T09:00:00Z");
    });

    it("LLM 출력 형식 instruction(difficulty/contribution marker)을 포함한다", () => {
      const prompt = buildEvaluationPrompt(makeInput());
      expect(prompt).toContain("difficulty:");
      expect(prompt).toContain("contribution:");
    });

    it("titleLength(number)가 있으면 정량 신호 line 을 포함한다", () => {
      const prompt = buildEvaluationPrompt(makeInput({}, { titleLength: 42 }));
      expect(prompt).toContain("titleLength: 42");
    });
  });

  describe("branch — contributionKind code vs document 분기 (R-112-3)", () => {
    it.each<[ContributionKind]>([["code"], ["document"]])(
      "contributionKind=%s 분기를 prompt 에 반영한다",
      (kind) => {
        const prompt = buildEvaluationPrompt(
          makeInput({ contributionKind: kind }),
        );
        expect(prompt).toContain(`contributionKind: ${kind}`);
      },
    );
  });

  describe("branch — titleLength number 분기 (R-112-3)", () => {
    it("titleLength 가 유한 number → 신호 line 포함", () => {
      const prompt = buildEvaluationPrompt(makeInput({}, { titleLength: 7 }));
      expect(prompt).toContain("titleLength: 7");
    });

    it("titleLength 가 소수여도 그대로 직렬화한다 (3.14)", () => {
      const prompt = buildEvaluationPrompt(
        makeInput({}, { titleLength: 3.14 }),
      );
      expect(prompt).toContain("titleLength: 3.14");
    });

    it("titleLength 부재(빈 metadata) → titleLength line 생략 + throw 0", () => {
      const prompt = buildEvaluationPrompt(makeInput({}, {}));
      expect(prompt).not.toContain("titleLength:");
    });
  });

  describe("negative / error path — 비정상 metadata (R-112-2/4 충분 cover)", () => {
    it.each<[string, ActivityMetadataValue]>([
      ["string", "42"],
      ["boolean true", true],
      ["boolean false", false],
      ["null", null],
    ])(
      "titleLength 가 %s 면 정량 신호 line 을 생략하고 throw 0",
      (_label, value) => {
        expect(() =>
          buildEvaluationPrompt(makeInput({}, { titleLength: value })),
        ).not.toThrow();
        const prompt = buildEvaluationPrompt(
          makeInput({}, { titleLength: value }),
        );
        expect(prompt).not.toContain("titleLength:");
      },
    );

    it("titleLength 가 NaN → 비유한 number 라 line 생략", () => {
      const prompt = buildEvaluationPrompt(
        makeInput({}, { titleLength: Number.NaN }),
      );
      expect(prompt).not.toContain("titleLength:");
    });

    it("titleLength 가 Infinity → line 생략", () => {
      const prompt = buildEvaluationPrompt(
        makeInput({}, { titleLength: Number.POSITIVE_INFINITY }),
      );
      expect(prompt).not.toContain("titleLength:");
    });

    it("metadata 에 raw-오인 키(body/html/message)의 값 전문이 prompt 에 직렬화되지 않는다 (REQ-032 회귀 방어)", () => {
      const secret = "이것은-raw-commit-message-본문-누출되면-안됨";
      const prompt = buildEvaluationPrompt(
        makeInput(
          {},
          {
            body: secret,
            html: `<p>${secret}</p>`,
            message: secret,
            diff: secret,
            content: secret,
            titleLength: 10,
          },
        ),
      );
      expect(prompt).not.toContain(secret);
      // titleLength 단일 신호만 채택됐는지 확인.
      expect(prompt).toContain("titleLength: 10");
    });
  });

  describe("determinism (LLM 의존 0, R-112-2)", () => {
    it("동일 입력 2 회 호출이 동일 prompt 다 (referential transparency)", () => {
      const input = makeInput({}, { titleLength: 5 });
      expect(buildEvaluationPrompt(input)).toBe(buildEvaluationPrompt(input));
    });

    it("입력 metadata 를 변형하지 않는다 (부수효과 0)", () => {
      const metadata: ActivityMetadata = { titleLength: 7 };
      buildEvaluationPrompt(makeInput({}, metadata));
      expect(metadata).toEqual({ titleLength: 7 });
    });
  });
});

describe("classifyNarrative", () => {
  describe("happy-path — marker 인식 (R-112-1)", () => {
    it("difficulty/contribution marker 를 추출한다 (hard/high)", () => {
      expect(classifyNarrative("difficulty: hard\ncontribution: high")).toEqual(
        { difficulty: "hard", contribution: "high" },
      );
    });

    it("case-insensitive 로 인식한다 (Difficulty: HARD)", () => {
      expect(classifyNarrative("Difficulty: HARD\nContribution: HIGH")).toEqual(
        { difficulty: "hard", contribution: "high" },
      );
    });

    it("산문 중간에 박힌 marker line 도 추출한다", () => {
      const narrative =
        "전반적으로 좋은 기여다.\ndifficulty: easy\n추가 의견.\ncontribution: medium\n끝.";
      expect(classifyNarrative(narrative)).toEqual({
        difficulty: "easy",
        contribution: "medium",
      });
    });

    it("난이도 3 값(easy/medium/hard)을 모두 인식한다", () => {
      expect(classifyNarrative("difficulty: easy").difficulty).toBe("easy");
      expect(classifyNarrative("difficulty: medium").difficulty).toBe("medium");
      expect(classifyNarrative("difficulty: hard").difficulty).toBe("hard");
    });

    it("기여도 4 값(zero/low/medium/high)을 모두 인식한다", () => {
      expect(classifyNarrative("contribution: zero").contribution).toBe("zero");
      expect(classifyNarrative("contribution: low").contribution).toBe("low");
      expect(classifyNarrative("contribution: medium").contribution).toBe(
        "medium",
      );
      expect(classifyNarrative("contribution: high").contribution).toBe("high");
    });
  });

  describe("branch / negative — marker 부재·미인식 fallback (R-112-2/4 충분 cover)", () => {
    it("marker 부재 자유 산문 → default {medium, low}", () => {
      expect(classifyNarrative("그냥 평범한 평가 산문입니다.")).toEqual({
        difficulty: "medium",
        contribution: "low",
      });
    });

    it("빈 문자열 → default {medium, low}", () => {
      expect(classifyNarrative("")).toEqual({
        difficulty: "medium",
        contribution: "low",
      });
    });

    it("미인식 difficulty 값(trivial) → default medium fallback (isDifficulty false 분기)", () => {
      expect(classifyNarrative("difficulty: trivial").difficulty).toBe(
        "medium",
      );
    });

    it("미인식 contribution 값(amazing) → default low fallback (isContributionLevel false 분기)", () => {
      expect(classifyNarrative("contribution: amazing").contribution).toBe(
        "low",
      );
    });

    it("difficulty marker 만 있고 contribution 부재 → 있는 쪽 추출, 없는 쪽 default", () => {
      expect(classifyNarrative("difficulty: hard")).toEqual({
        difficulty: "hard",
        contribution: "low",
      });
    });

    it("contribution marker 만 있고 difficulty 부재 → 있는 쪽 추출, 없는 쪽 default", () => {
      expect(classifyNarrative("contribution: high")).toEqual({
        difficulty: "medium",
        contribution: "high",
      });
    });

    it("미인식 difficulty + 정상 contribution → difficulty default, contribution 추출", () => {
      expect(
        classifyNarrative("difficulty: expert\ncontribution: zero"),
      ).toEqual({ difficulty: "medium", contribution: "zero" });
    });

    it("빈 marker 값(콜론 뒤 공백뿐) → 토큰 없어 default", () => {
      // 정규식이 비공백 토큰을 요구하므로 marker 미매칭 → default.
      expect(classifyNarrative("difficulty: \ncontribution: ")).toEqual({
        difficulty: "medium",
        contribution: "low",
      });
    });

    it("구두점만 있는 marker 값(difficulty: ...) → strip 후 빈 토큰이라 default", () => {
      // 토큰('...')은 정규식엔 매칭되나 구두점 strip 후 빈 문자열이 되어
      // undefined 처리 → default 로 fallback(extractMarker 빈 토큰 분기).
      expect(classifyNarrative("difficulty: ...\ncontribution: ;;;")).toEqual({
        difficulty: "medium",
        contribution: "low",
      });
    });
  });

  describe("type-level — 반환이 허용 집합 멤버 (R-112)", () => {
    it.each<[string]>([
      ["difficulty: hard\ncontribution: high"],
      ["자유 산문 — marker 없음"],
      [""],
      ["difficulty: bogus\ncontribution: bogus"],
    ])(
      "어떤 narrative(%j)에서도 difficulty∈DIFFICULTIES, contribution∈CONTRIBUTION_LEVELS",
      (narrative) => {
        const result = classifyNarrative(narrative);
        expect(DIFFICULTIES).toContain(result.difficulty);
        expect(CONTRIBUTION_LEVELS).toContain(result.contribution);
      },
    );
  });

  describe("inline comma 형식 + 구두점 strip (round 1 MAJOR/NIT 회귀 방어)", () => {
    it("inline comma 형식(difficulty: hard, contribution: high)을 둘 다 추출한다", () => {
      // round 1 결함 repro: comma 형식에서 difficulty 토큰이 'hard,' 로 잡혀
      // isDifficulty false → default 로 새던 버그. 이제 comma 를 벗기고 둘 다 인식.
      expect(classifyNarrative("difficulty: hard, contribution: high")).toEqual(
        { difficulty: "hard", contribution: "high" },
      );
    });

    it("inline comma + mixed case + 잉여 공백도 추출한다", () => {
      expect(
        classifyNarrative("Difficulty:  EASY ,  Contribution:   ZERO"),
      ).toEqual({ difficulty: "easy", contribution: "zero" });
    });

    it("trailing 마침표(high.)를 벗기고 인식한다 (NIT — 구두점 strip)", () => {
      expect(classifyNarrative("contribution: high.").contribution).toBe(
        "high",
      );
    });

    it("산문 prefix 가 붙은 inline 형식도 추출한다 (단어 경계 anchor)", () => {
      expect(
        classifyNarrative(
          "평가: difficulty: medium, contribution: low 입니다.",
        ),
      ).toEqual({ difficulty: "medium", contribution: "low" });
    });
  });

  describe("compose / round-trip — buildEvaluationPrompt ↔ classifyNarrative (round 1 MAJOR)", () => {
    // prompt 가 LLM 에게 요청하는 형식 그대로의 응답이 parser 로 올바로 환원됨을
    // 검증한다. 이 compose 검증 누락이 round 1 결함이 슬립한 이유다.
    it("prompt 가 요청하는 단일 line comma 형식 응답이 정확히 분류된다", () => {
      const prompt = buildEvaluationPrompt(makeInput());
      // prompt instruction line 이 단일 line comma 형식을 요청하는지 확인.
      expect(prompt).toContain(
        "difficulty: <easy|medium|hard>, contribution: <zero|low|medium|high>",
      );
      // LLM 이 그 형식 그대로 답한 대표 응답.
      const llmResponse = "difficulty: hard, contribution: high";
      expect(classifyNarrative(llmResponse)).toEqual({
        difficulty: "hard",
        contribution: "high",
      });
    });

    it("line-separated 형식 응답도 동일하게 분류된다 (parser 양형식 수용)", () => {
      const llmResponse = "difficulty: easy\ncontribution: medium";
      expect(classifyNarrative(llmResponse)).toEqual({
        difficulty: "easy",
        contribution: "medium",
      });
    });

    it("산문이 앞뒤로 둘러싼 inline comma 응답도 분류된다", () => {
      const llmResponse =
        "종합 평가입니다. difficulty: medium, contribution: low. 이상.";
      expect(classifyNarrative(llmResponse)).toEqual({
        difficulty: "medium",
        contribution: "low",
      });
    });

    it("compose: 진짜 부재 marker 응답만 default fallback (오인식 0)", () => {
      // marker 가 진짜 없는 자유 산문은 default 로 fallback 해야 한다.
      expect(classifyNarrative("좋은 기여였습니다.")).toEqual({
        difficulty: "medium",
        contribution: "low",
      });
      // 미인식 값(comma 형식)도 해당 축만 default.
      expect(
        classifyNarrative("difficulty: trivial, contribution: amazing"),
      ).toEqual({ difficulty: "medium", contribution: "low" });
    });
  });

  describe("determinism (LLM 의존 0, R-112-2)", () => {
    it("동일 narrative 2 회 호출이 동일 분류다", () => {
      const narrative = "difficulty: medium\ncontribution: high";
      expect(classifyNarrative(narrative)).toEqual(
        classifyNarrative(narrative),
      );
    });

    it("어떤 narrative 입력에서도 throw 하지 않는다", () => {
      expect(() => classifyNarrative("")).not.toThrow();
      expect(() => classifyNarrative("difficulty: ???")).not.toThrow();
      expect(() => classifyNarrative("\n\n\n")).not.toThrow();
    });
  });
});
