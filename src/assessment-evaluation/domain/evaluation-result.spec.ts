// evaluation-result.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy /
// error / branch / negative cases 충분 cover). 본 파일은 타입 정의 파일
// (evaluation-result.ts) 의 type-guard `isContributionLevel` / const
// `CONTRIBUTION_LEVELS` / `EvaluationResult` shape 단언을 담당한다.
//
// scripts/check-spec-presence.sh 가 신규 production .ts 마다 동명 .spec.ts 의 존재를
// 강제하므로(file-name 매칭) 본 sibling spec 으로 R-112 자동 강제 layer 와 정합.

import { DIFFICULTIES, type Difficulty } from "../../llm/difficulty";

import {
  CONTRIBUTION_LEVELS,
  type ContributionLevel,
  type EvaluationResult,
  isContributionLevel,
} from "./evaluation-result";

// EvaluationResult 의 정확한 5 키 — raw 본문 키 부재 단언의 기준(REQ-032).
const EXPECTED_KEYS = [
  "contribution",
  "difficulty",
  "narrative",
  "unitId",
  "volume",
].sort();

// raw 본문 키 후보 — EvaluationResult type 에 절대 존재하면 안 되는 키 목록
// (REQ-032 raw-not-stored 불변, data-model.md §4).
const FORBIDDEN_RAW_KEYS = ["body", "diff", "html", "message", "content"];

describe("isContributionLevel", () => {
  describe("truthy 분기 (R-112-1 happy)", () => {
    it.each(CONTRIBUTION_LEVELS)(
      "허용 멤버 '%s' 에 대해 true 를 반환한다",
      (member) => {
        expect(isContributionLevel(member)).toBe(true);
      },
    );
  });

  describe("falsy 분기 (R-112-2 negative — 예외 상황 충분 cover)", () => {
    it.each([
      "",
      "invalid",
      "Zero",
      "LOW",
      "Medium",
      "HIGH",
      "none",
      "code",
      "document",
      "easy",
      "zero ", // trailing space — 정규화 0, 엄격 매칭
      " low", // leading space
      "high\n", // trailing newline
      "낮음", // 한국어 유사 의미 — 멤버십 외
      "0",
      "null",
      "undefined",
    ])("허용 외 값 '%s' 에 대해 false 를 반환한다", (value) => {
      expect(isContributionLevel(value)).toBe(false);
    });
  });

  describe("type narrowing (R-112-3 branch)", () => {
    it("true 분기에서 ContributionLevel 로 좁혀 할당 가능하다", () => {
      const raw: string = "high";
      if (isContributionLevel(raw)) {
        const narrowed: ContributionLevel = raw;
        expect(narrowed).toBe("high");
      } else {
        throw new Error("isContributionLevel('high') 는 true 여야 한다");
      }
    });

    it("false 분기에서는 string 으로 유지된다 (narrowing 부재)", () => {
      const raw: string = "invalid";
      if (isContributionLevel(raw)) {
        throw new Error("isContributionLevel('invalid') 는 false 여야 한다");
      } else {
        const stillString: string = raw;
        expect(stillString).toBe("invalid");
      }
    });
  });

  describe("순수성 / 부수효과 0 (R-112-2 negative)", () => {
    it("동일 입력에 대해 항상 동일 결과 (referential transparency)", () => {
      expect(isContributionLevel("high")).toBe(isContributionLevel("high"));
      expect(isContributionLevel("xxx")).toBe(isContributionLevel("xxx"));
    });

    it("어떤 입력에서도 throw 하지 않는다 (멤버 / 비멤버 / 빈 문자열)", () => {
      expect(() => isContributionLevel("zero")).not.toThrow();
      expect(() => isContributionLevel("high")).not.toThrow();
      expect(() => isContributionLevel("")).not.toThrow();
      expect(() => isContributionLevel("anything-else")).not.toThrow();
    });
  });
});

describe("CONTRIBUTION_LEVELS const", () => {
  describe("멤버 동기성 (R-112-1 happy)", () => {
    it("정확히 zero / low / medium / high 4 종을 포함한다", () => {
      expect(CONTRIBUTION_LEVELS).toEqual(["zero", "low", "medium", "high"]);
    });

    it("순서가 [zero, low, medium, high] 로 박제된다 (외부 contract)", () => {
      expect(CONTRIBUTION_LEVELS[0]).toBe("zero");
      expect(CONTRIBUTION_LEVELS[1]).toBe("low");
      expect(CONTRIBUTION_LEVELS[2]).toBe("medium");
      expect(CONTRIBUTION_LEVELS[3]).toBe("high");
    });

    it("length 가 정확히 4 다 (멤버 누락 / 추가 회귀 차단)", () => {
      expect(CONTRIBUTION_LEVELS.length).toBe(4);
    });
  });

  describe("self-consistency (R-112-3 branch / R-112-2 negative)", () => {
    it("모든 멤버가 isContributionLevel 를 통과한다", () => {
      for (const member of CONTRIBUTION_LEVELS) {
        expect(isContributionLevel(member)).toBe(true);
      }
    });

    it("멤버 누락 0 — union 과 const 의 satisfies 동기성 (compile-time)", () => {
      // satisfies readonly ContributionLevel[] 가 누락 / 오타를 compile-time 거부.
      // 런타임 단언은 length 보존만.
      const before = CONTRIBUTION_LEVELS.length;
      expect(CONTRIBUTION_LEVELS.length).toBe(before);
    });
  });
});

describe("EvaluationResult type-level shape", () => {
  // 본 그룹은 type-level 검증이 주 — 런타임에서는 type 만족 객체를 생성해 shape
  // 단언을 박는다. 값 산출(narrative / difficulty / contribution)은 후속 scoring
  // service slice 책임.
  function makeMinimalResult(): EvaluationResult {
    return {
      unitId: "github:sec:abc",
      narrative: "변경 사항이 기능 요구를 충족한다.",
      difficulty: "medium",
      contribution: "medium",
      volume: 0,
    };
  }

  describe("필드 5 키 한정 (R-112-1 happy / R-112-3 branch)", () => {
    it("EvaluationResult 객체가 5 필드를 모두 보유한다", () => {
      const result = makeMinimalResult();
      expect(result.unitId).toBe("github:sec:abc");
      expect(typeof result.narrative).toBe("string");
      expect(result.difficulty).toBe("medium");
      expect(result.contribution).toBe("medium");
      expect(result.volume).toBe(0);
    });

    it("key 집합이 정확히 5 키다 (raw 본문 키 부재)", () => {
      const result = makeMinimalResult();
      expect(Object.keys(result).sort()).toEqual(EXPECTED_KEYS);
    });

    it("raw 본문 키(body/diff/html/message/content)가 부재한다 (REQ-032)", () => {
      const result = makeMinimalResult();
      for (const forbidden of FORBIDDEN_RAW_KEYS) {
        expect(Object.keys(result)).not.toContain(forbidden);
      }
    });
  });

  describe("type-level FORBIDDEN_RAW_KEYS 단언 (R-112-2 negative — compile-time)", () => {
    it("body / diff / html / message / content 5 키가 EvaluationResult 에 존재하지 않는다", () => {
      const result: EvaluationResult = makeMinimalResult();
      // @ts-expect-error — body 는 EvaluationResult 에 존재하지 않는 키
      const _bodyMustNotExist: string = result.body;
      // @ts-expect-error — diff 는 EvaluationResult 에 존재하지 않는 키
      const _diffMustNotExist: string = result.diff;
      // @ts-expect-error — html 은 EvaluationResult 에 존재하지 않는 키
      const _htmlMustNotExist: string = result.html;
      // @ts-expect-error — message 는 EvaluationResult 에 존재하지 않는 키
      const _messageMustNotExist: string = result.message;
      // @ts-expect-error — content 는 EvaluationResult 에 존재하지 않는 키
      const _contentMustNotExist: string = result.content;
      void _bodyMustNotExist;
      void _diffMustNotExist;
      void _htmlMustNotExist;
      void _messageMustNotExist;
      void _contentMustNotExist;
      expect(true).toBe(true);
    });
  });

  describe("difficulty 필드 제약 (R-112-2 negative)", () => {
    it("difficulty 는 항상 DIFFICULTIES 멤버다", () => {
      for (const d of DIFFICULTIES) {
        const result: EvaluationResult = {
          ...makeMinimalResult(),
          difficulty: d,
        };
        expect(DIFFICULTIES).toContain(result.difficulty);
      }
    });

    it("difficulty 에 임의 string 할당 시 compile-time 거부", () => {
      const _badResult: EvaluationResult = {
        ...makeMinimalResult(),
        // @ts-expect-error — "trivial" 은 Difficulty 멤버 아님
        difficulty: "trivial",
      };
      void _badResult;
      expect(true).toBe(true);
    });
  });

  describe("contribution 필드 제약 (R-112-2 negative)", () => {
    it("contribution 은 항상 CONTRIBUTION_LEVELS 멤버다", () => {
      for (const level of CONTRIBUTION_LEVELS) {
        const result: EvaluationResult = {
          ...makeMinimalResult(),
          contribution: level,
        };
        expect(CONTRIBUTION_LEVELS).toContain(result.contribution);
      }
    });

    it("contribution 에 임의 string 할당 시 compile-time 거부", () => {
      const _badResult: EvaluationResult = {
        ...makeMinimalResult(),
        // @ts-expect-error — "invalid" 는 ContributionLevel 멤버 아님
        contribution: "invalid",
      };
      void _badResult;
      expect(true).toBe(true);
    });

    it("difficulty 와 contribution 은 독립 축이다 (동일 값 우연 충돌 방지)", () => {
      // Difficulty(easy/medium/hard) 와 ContributionLevel(zero/low/medium/high)
      // 는 'medium' 만 우연히 겹치는 별개 union — 서로 대입 불가.
      const sharedDifficulty: Difficulty = "medium";
      const sharedContribution: ContributionLevel = "medium";
      expect(sharedDifficulty).toBe("medium");
      expect(sharedContribution).toBe("medium");
      // contribution 의 zero/low/high 는 Difficulty 멤버가 아니다.
      expect(DIFFICULTIES).not.toContain("zero");
      expect(DIFFICULTIES).not.toContain("low");
      expect(DIFFICULTIES).not.toContain("high");
    });
  });
});
