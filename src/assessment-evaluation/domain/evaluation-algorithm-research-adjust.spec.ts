// evaluation-algorithm-research-adjust.ts 의 colocated unit test (CLAUDE.md `§ 3.2`
// R-112 — happy / error / branch / negative case 충분 cover).
// `applyAlgorithmResearchUplift` 순수 함수의 README `38 행` / REQ-019 알고리즘 ·
// 연구 소개 축 상향 동작(식별 author 전 단위 상향 + 비대상 passthrough + zero 하한
// 우선 + enum 외 보수 무변경 + 빈 입력 흡수 + 멱등 + 입력 비변형 + 필드 직교 +
// detection 재구현 0)을 검증한다.
// mirror 원형: evaluation-document-contribution-adjust.spec.ts 의
// `describe("applyDocumentContributionUplift")` — 소비 신호만 알고리즘 · 연구
// 축(AlgorithmResearchSignal)으로 바꾼 동형 mirror 다.

import {
  applyAlgorithmResearchUplift,
  ALGORITHM_RESEARCH_UPLIFT_LEVEL,
  type AlgorithmResearchAdjustEntry,
} from "./evaluation-algorithm-research-adjust";
import type {
  AlgorithmResearchEntry,
  AlgorithmResearchSignal,
} from "./evaluation-algorithm-research-signal";
import { CONTRIBUTION_QUALITY_FLOOR_LEVEL } from "./evaluation-quality-adjust";
import type { EvaluationResult } from "./evaluation-result";

// EvaluationResult stub 빌더. 본 helper 는 contribution 만 검토 / 조정하므로 나머지
// 필드는 고정 — overrides 로 필요한 필드만 변경한다.
function makeResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    unitId: "confluence:hq:p1",
    narrative: "정상 기여 평가문",
    difficulty: "medium",
    contribution: "medium",
    volume: 100,
    ...overrides,
  };
}

// AlgorithmResearchEntry stub 빌더(detection 산출 신호의 author 1 명분).
function makeAuthorEntry(
  overrides: Partial<AlgorithmResearchEntry> = {},
): AlgorithmResearchEntry {
  return {
    author: "researcher",
    algorithmResearchUnitCount: 2,
    algorithmResearchUnitIds: ["confluence:hq:p1", "confluence:hq:p2"],
    algorithmResearch: true,
    ...overrides,
  };
}

// AlgorithmResearchSignal stub 빌더.
function makeSignal(
  byAuthor: AlgorithmResearchEntry[],
): AlgorithmResearchSignal {
  return {
    totalUnitCount: 10,
    totalAlgorithmResearchCount: byAuthor.reduce(
      (sum, entry) => sum + entry.algorithmResearchUnitCount,
      0,
    ),
    byAuthor,
    algorithmResearchDetected: byAuthor.some(
      (entry) => entry.algorithmResearch,
    ),
  };
}

describe("applyAlgorithmResearchUplift", () => {
  // algorithmResearch=true 인 researcher 1 명만 담은 baseline 신호.
  const researchSignal = makeSignal([
    makeAuthorEntry({ author: "researcher" }),
  ]);
  // 식별 author + 미식별 author 혼합 신호(분기 표에서 사용).
  const mixedSignal = makeSignal([
    makeAuthorEntry({ author: "researcher" }),
    makeAuthorEntry({
      author: "normal",
      algorithmResearchUnitCount: 0,
      algorithmResearchUnitIds: [],
      algorithmResearch: false,
    }),
  ]);

  describe("happy path (public symbol 3 개 cover)", () => {
    it("(happy) 상향 목표 등급 상수 ALGORITHM_RESEARCH_UPLIFT_LEVEL 은 high 다", () => {
      // 코드 축 · 문서 축 uplift 와 대칭인 v1 값이며 하한 상수와 서로 다른 극이다.
      expect(ALGORITHM_RESEARCH_UPLIFT_LEVEL).toBe("high");
      expect(ALGORITHM_RESEARCH_UPLIFT_LEVEL).not.toBe(
        CONTRIBUTION_QUALITY_FLOOR_LEVEL,
      );
    });

    it("(happy) AlgorithmResearchAdjustEntry 는 author + result shape 를 그대로 되돌린다", () => {
      // 인터페이스 사용 cover — 입력 shape 가 출력 shape 와 동형임을 검증한다.
      const entry: AlgorithmResearchAdjustEntry = {
        author: "researcher",
        result: makeResult({ unitId: "u0", contribution: "low" }),
      };

      const [out] = applyAlgorithmResearchUplift([entry], researchSignal);

      expect(Object.keys(out).sort()).toEqual(["author", "result"]);
      expect(out.author).toBe("researcher");
    });

    it("(happy) 알고리즘 · 연구 축 식별 author 의 low / medium 단위를 high 로 상향한다", () => {
      const entries: AlgorithmResearchAdjustEntry[] = [
        {
          author: "researcher",
          result: makeResult({ unitId: "u1", contribution: "low" }),
        },
        {
          author: "researcher",
          result: makeResult({ unitId: "u2", contribution: "medium" }),
        },
      ];

      const out = applyAlgorithmResearchUplift(entries, researchSignal);

      // author-level 전파 — 같은 author 의 모든 단위가 대상. 길이 · 순서 보존.
      expect(out).toHaveLength(entries.length);
      expect(out.map((e) => e.author)).toEqual(["researcher", "researcher"]);
      expect(out.map((e) => e.result.unitId)).toEqual(["u1", "u2"]);
      expect(out.map((e) => e.result.contribution)).toEqual([
        ALGORITHM_RESEARCH_UPLIFT_LEVEL,
        "high",
      ]);
    });
  });

  describe("error path (명시적 계약 위반만 throw)", () => {
    it.each([null, undefined])(
      "(error) entries 가 %p 면 한국어 TypeError",
      (bad) => {
        const call = (): unknown =>
          applyAlgorithmResearchUplift(
            bad as unknown as AlgorithmResearchAdjustEntry[],
            researchSignal,
          );
        expect(call).toThrow(TypeError);
        expect(call).toThrow("entries 는 null 또는 undefined 일 수 없습니다.");
      },
    );

    it.each([null, undefined])(
      "(error) signal 이 %p 면 한국어 TypeError",
      (bad) => {
        const call = (): unknown =>
          applyAlgorithmResearchUplift(
            [],
            bad as unknown as AlgorithmResearchSignal,
          );
        expect(call).toThrow(TypeError);
        expect(call).toThrow("signal 은 null 또는 undefined 일 수 없습니다.");
      },
    );
  });

  describe("분기 (규칙 1~6)", () => {
    // 설계 규칙 1~6 분기 + negative(무변경) 케이스를 한 표로 cover 한다.
    it.each([
      ["(a) signal 미매칭 author → 무변경", "ghost", "low", "low"],
      [
        "(b) algorithmResearch=false author → 무변경",
        "normal",
        "medium",
        "medium",
      ],
      ["(c) zero 는 상향하지 않는다(하한 우선)", "researcher", "zero", "zero"],
      ["(d) low → high 상향", "researcher", "low", "high"],
      ["(e) medium → high 상향", "researcher", "medium", "high"],
      ["(f) 이미 high 면 값 동일(멱등)", "researcher", "high", "high"],
      ["(g) enum 외 값은 보수적 무변경", "researcher", "bogus", "bogus"],
    ])("%s", (_label, author, contribution, expected) => {
      const entries: AlgorithmResearchAdjustEntry[] = [
        {
          author,
          result: makeResult({
            contribution: contribution as EvaluationResult["contribution"],
          }),
        },
      ];

      const out = applyAlgorithmResearchUplift(entries, mixedSignal);

      expect(out[0].result.contribution).toBe(expected);
      // 어떤 분기든 항상 새 객체로 복제한다(입력 비변형 보장).
      expect(out[0].result).not.toBe(entries[0].result);
    });
  });

  describe("negative case (예외 분기별 흡수 · 비변형 · 멱등)", () => {
    it("(negative) 빈 entries → 빈 배열, 빈 byAuthor → 전 단위 무변경 복제", () => {
      expect(applyAlgorithmResearchUplift([], makeSignal([]))).toEqual([]);

      const entries: AlgorithmResearchAdjustEntry[] = [
        { author: "researcher", result: makeResult({ contribution: "low" }) },
      ];
      const out = applyAlgorithmResearchUplift(entries, makeSignal([]));

      expect(out[0].result.contribution).toBe("low");
      expect(out[0].result).not.toBe(entries[0].result);
    });

    it("(negative) contribution 외 필드는 상향 시에도 그대로 전사된다", () => {
      const entries: AlgorithmResearchAdjustEntry[] = [
        {
          author: "researcher",
          result: makeResult({
            unitId: "confluence:hq:p9",
            narrative: "알고리즘 설계 소개 평가문",
            difficulty: "hard",
            volume: 777,
            contribution: "low",
          }),
        },
      ];

      const out = applyAlgorithmResearchUplift(entries, researchSignal);

      // 필드 직교 — narrative marker 접두는 본 helper 책임이 아니다.
      expect(out[0].result).toEqual({
        unitId: "confluence:hq:p9",
        narrative: "알고리즘 설계 소개 평가문",
        difficulty: "hard",
        volume: 777,
        contribution: "high",
      });
    });

    it("(negative) 입력 entries / result / signal 을 변형하지 않는다", () => {
      const entries = Object.freeze([
        Object.freeze({
          author: "researcher",
          result: Object.freeze(makeResult({ contribution: "medium" })),
        }),
      ]) as unknown as AlgorithmResearchAdjustEntry[];
      const snapshot = JSON.parse(JSON.stringify(entries));
      const signalSnapshot = JSON.parse(JSON.stringify(researchSignal));

      const out = applyAlgorithmResearchUplift(entries, researchSignal);

      expect(out[0].result.contribution).toBe("high");
      expect(entries).toEqual(snapshot);
      expect(researchSignal).toEqual(signalSnapshot);
    });

    it("(negative) 반환 배열의 길이 · 순서가 입력과 동일하다", () => {
      const entries: AlgorithmResearchAdjustEntry[] = [
        {
          author: "ghost",
          result: makeResult({ unitId: "u1", contribution: "low" }),
        },
        {
          author: "researcher",
          result: makeResult({ unitId: "u2", contribution: "low" }),
        },
        {
          author: "normal",
          result: makeResult({ unitId: "u3", contribution: "low" }),
        },
      ];

      const out = applyAlgorithmResearchUplift(entries, mixedSignal);

      expect(out).toHaveLength(3);
      expect(out.map((e) => e.result.unitId)).toEqual(["u1", "u2", "u3"]);
      expect(out.map((e) => e.result.contribution)).toEqual([
        "low",
        "high",
        "low",
      ]);
      expect(out).not.toBe(entries);
    });

    it("(negative/멱등) 2 회 연속 적용 결과가 1 회 적용 결과와 같다", () => {
      const entries: AlgorithmResearchAdjustEntry[] = [
        {
          author: "researcher",
          result: makeResult({ unitId: "u1", contribution: "low" }),
        },
        {
          author: "researcher",
          result: makeResult({ unitId: "u2", contribution: "zero" }),
        },
      ];

      const once = applyAlgorithmResearchUplift(entries, researchSignal);
      const twice = applyAlgorithmResearchUplift(once, researchSignal);

      expect(twice).toEqual(once);
      expect(once.map((e) => e.result.contribution)).toEqual(["high", "zero"]);
    });

    it("(negative) detection 임계 필드(algorithmResearchUnitCount)는 판정에 쓰지 않는다", () => {
      // count 가 임계 미만이어도 boolean 이 true 면 상향한다 — 임계 소유자는
      // detection layer 이고 본 helper 는 신호를 재판정하지 않는다.
      const signal = makeSignal([
        makeAuthorEntry({
          author: "researcher",
          algorithmResearchUnitCount: 0,
          algorithmResearchUnitIds: [],
          algorithmResearch: true,
        }),
      ]);
      const entries: AlgorithmResearchAdjustEntry[] = [
        { author: "researcher", result: makeResult({ contribution: "low" }) },
      ];

      expect(
        applyAlgorithmResearchUplift(entries, signal)[0].result.contribution,
      ).toBe("high");
    });
  });
});
