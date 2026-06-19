// evaluation-quality-signal.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover). `computeContributionQualitySignal`
// 순수 함수의 결정적 zero-contribution 신호 산출(author 그룹핑 + titleLength 임계
// 식별 + 방어적 입력 흡수 + 결정성 + 비변형)을 검증한다. 신규 파일 100% 지향 — 모든
// 분기를 cover 한다.

import type { ActivityMetadata } from "../../assessment-collection/domain/activity";

import type { ContributionKind, EvaluationInput } from "./evaluation-input";
import {
  computeContributionQualitySignal,
  CONTRIBUTION_QUALITY_TITLE_FLOOR,
} from "./evaluation-quality-signal";

// EvaluationInput stub 빌더. titleLength 는 metadata.titleLength 로 주입한다.
// titleLength 에 비-number / 부재 시나리오를 주입할 수 있도록 unknown 을 허용한다.
function makeInput(
  overrides: Partial<EvaluationInput> & { titleLength?: unknown } = {},
): EvaluationInput {
  const { titleLength, metadata, ...rest } = overrides;
  const finalMetadata: ActivityMetadata =
    metadata ??
    (titleLength === undefined
      ? {}
      : ({ titleLength } as unknown as ActivityMetadata));
  return {
    unitId: "github:sec:u1",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: finalMetadata,
    ...rest,
  };
}

// title 길이가 임계 이하인 단위(zero-contribution 후보).
function zeroUnit(
  i: number,
  author = "gildong",
  titleLength = CONTRIBUTION_QUALITY_TITLE_FLOOR,
): EvaluationInput {
  return makeInput({
    unitId: `github:sec:z-${i}`,
    author,
    titleLength,
  });
}

// title 길이가 임계 초과인 정상 기여 단위.
function normalUnit(
  i: number,
  author = "gildong",
  titleLength = CONTRIBUTION_QUALITY_TITLE_FLOOR + 20,
): EvaluationInput {
  return makeInput({
    unitId: `github:sec:n-${i}`,
    author,
    titleLength,
  });
}

describe("computeContributionQualitySignal", () => {
  // --- Happy path ---
  describe("happy path", () => {
    it("titleLength 가 임계 이하인 단위를 zero-contribution 후보로 식별한다", () => {
      const result = computeContributionQualitySignal([
        zeroUnit(1, "gildong", CONTRIBUTION_QUALITY_TITLE_FLOOR),
      ]);

      expect(result.zeroContributionDetected).toBe(true);
      expect(result.totalUnitCount).toBe(1);
      expect(result.totalZeroContributionCount).toBe(1);
      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].author).toBe("gildong");
      expect(result.byAuthor[0].zeroContribution).toBe(true);
      expect(result.byAuthor[0].zeroContributionCount).toBe(1);
      expect(result.byAuthor[0].zeroContributionUnitIds).toEqual([
        "github:sec:z-1",
      ]);
    });

    it("titleLength 가 임계 초과인 정상 기여 단위는 비대상으로 분류한다", () => {
      const result = computeContributionQualitySignal([
        normalUnit(1, "gildong"),
      ]);

      expect(result.zeroContributionDetected).toBe(false);
      expect(result.totalUnitCount).toBe(1);
      expect(result.totalZeroContributionCount).toBe(0);
      // 정상 author 도 byAuthor 에는 등장하되 zeroContribution=false.
      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].zeroContribution).toBe(false);
      expect(result.byAuthor[0].zeroContributionUnitIds).toEqual([]);
    });

    it("code / document 둘 다 trivial title 이면 후보로 식별한다(kind 무관)", () => {
      const result = computeContributionQualitySignal([
        makeInput({
          unitId: "github:sec:c",
          contributionKind: "code",
          titleLength: 0,
        }),
        makeInput({
          unitId: "confluence:eng:d",
          contributionKind: "document",
          sourceType: "confluence",
          instanceKey: "eng",
          titleLength: 1,
        }),
      ]);
      expect(result.totalZeroContributionCount).toBe(2);
    });
  });

  // --- Error path ---
  describe("error path", () => {
    it("inputs 가 null 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeContributionQualitySignal(null as unknown as EvaluationInput[]),
      ).toThrow(TypeError);
      expect(() =>
        computeContributionQualitySignal(null as unknown as EvaluationInput[]),
      ).toThrow(/null\/undefined/);
    });

    it("inputs 가 undefined 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeContributionQualitySignal(
          undefined as unknown as EvaluationInput[],
        ),
      ).toThrow(TypeError);
    });

    it("빈 inputs 배열 → 빈 신호 반환(throw 없음)", () => {
      const result = computeContributionQualitySignal([]);
      expect(result).toEqual({
        totalUnitCount: 0,
        totalZeroContributionCount: 0,
        byAuthor: [],
        zeroContributionDetected: false,
      });
    });
  });

  // --- Flow / branch coverage ---
  describe("branch coverage", () => {
    it("(a) 전 단위 zero-contribution 대상 batch", () => {
      const result = computeContributionQualitySignal([
        zeroUnit(1, "gildong", 0),
        zeroUnit(2, "gildong", CONTRIBUTION_QUALITY_TITLE_FLOOR),
      ]);
      expect(result.totalUnitCount).toBe(2);
      expect(result.totalZeroContributionCount).toBe(2);
      expect(result.zeroContributionDetected).toBe(true);
    });

    it("(b) 전 단위 비대상 batch", () => {
      const result = computeContributionQualitySignal([
        normalUnit(1, "gildong"),
        normalUnit(2, "gildong"),
      ]);
      expect(result.totalZeroContributionCount).toBe(0);
      expect(result.zeroContributionDetected).toBe(false);
    });

    it("(c) 혼합 batch — 일부만 대상(부분 식별 정합)", () => {
      const result = computeContributionQualitySignal([
        zeroUnit(1, "gildong", CONTRIBUTION_QUALITY_TITLE_FLOOR),
        normalUnit(2, "gildong"),
        zeroUnit(3, "gildong", 0),
      ]);
      expect(result.totalZeroContributionCount).toBe(2);
      expect(result.byAuthor[0].zeroContributionUnitIds).toEqual([
        "github:sec:z-1",
        "github:sec:z-3",
      ]);
    });

    it.each<[string, number, boolean]>([
      ["임계 정확히", CONTRIBUTION_QUALITY_TITLE_FLOOR, true],
      ["임계+1", CONTRIBUTION_QUALITY_TITLE_FLOOR + 1, false],
      ["임계-1(0)", CONTRIBUTION_QUALITY_TITLE_FLOOR - 1, true],
    ])(
      "(d) 휴리스틱 경계값 %s → detected=%s",
      (_label, titleLength, expected) => {
        const result = computeContributionQualitySignal([
          zeroUnit(1, "gildong", titleLength),
        ]);
        expect(result.zeroContributionDetected).toBe(expected);
      },
    );
  });

  // --- Negative cases 충분 cover ---
  describe("negative cases", () => {
    it("(i) 빈 inputs 배열 → 빈 신호(detected 없음)", () => {
      const result = computeContributionQualitySignal([]);
      expect(result.zeroContributionDetected).toBe(false);
      expect(result.byAuthor).toEqual([]);
    });

    it("(ii) 단일 author 단일 단위 — 정상 분류", () => {
      const result = computeContributionQualitySignal([normalUnit(1)]);
      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].zeroContribution).toBe(false);
    });

    it("(iii) 동일 author 다수 단위 중 일부만 대상 → 부분 집계 정합", () => {
      const result = computeContributionQualitySignal([
        zeroUnit(1, "gildong", CONTRIBUTION_QUALITY_TITLE_FLOOR), // 대상
        normalUnit(2, "gildong"), // 비대상
        zeroUnit(3, "gildong", 0), // 대상
      ]);
      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].zeroContributionCount).toBe(2);
      expect(result.byAuthor[0].zeroContributionUnitIds).toEqual([
        "github:sec:z-1",
        "github:sec:z-3",
      ]);
      expect(result.totalZeroContributionCount).toBe(2);
    });

    it("(iv-a) titleLength 필드 부재 metadata → throw 없이 후보 식별(0 흡수)", () => {
      const result = computeContributionQualitySignal([
        makeInput({ unitId: "github:sec:no-title", metadata: { version: 3 } }),
      ]);
      expect(result.zeroContributionDetected).toBe(true);
      expect(result.totalZeroContributionCount).toBe(1);
    });

    it.each<[string, unknown]>([
      ["string", "abc"],
      ["boolean", true],
      ["null", null],
    ])(
      "(iv-b) titleLength 가 비-number(%s)면 throw 없이 0 흡수(후보 식별)",
      (_label, titleLength) => {
        const result = computeContributionQualitySignal([
          makeInput({ unitId: "github:sec:bad", titleLength }),
        ]);
        expect(result.zeroContributionDetected).toBe(true);
      },
    );

    it.each<[string, number]>([
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
    ])(
      "(iv-c) titleLength 가 비유한 number(%s) → 방어적 0 흡수(후보 식별)",
      (_label, titleLength) => {
        const result = computeContributionQualitySignal([
          makeInput({ unitId: "github:sec:nf", titleLength }),
        ]);
        expect(result.zeroContributionDetected).toBe(true);
      },
    );

    it.each<[string, number]>([
      ["음수 titleLength", -7],
      ["소수 titleLength(0.9 → 0)", 0.9],
    ])("(iv-d) %s → 방어 절하 후 후보 식별", (_label, titleLength) => {
      const result = computeContributionQualitySignal([
        makeInput({ unitId: "github:sec:neg", titleLength }),
      ]);
      expect(result.zeroContributionDetected).toBe(true);
    });

    it("(iv-e) 소수 titleLength(1.9 → 1)는 임계 이하로 후보 식별", () => {
      const result = computeContributionQualitySignal([
        makeInput({ unitId: "github:sec:frac", titleLength: 1.9 }),
      ]);
      expect(result.zeroContributionDetected).toBe(true);
    });

    it("(v) 동일 unitId 중복 등장 → 각 등장이 결정적으로 push(중복 집계)", () => {
      const dup = zeroUnit(1, "gildong", 0);
      const result = computeContributionQualitySignal([dup, { ...dup }]);
      expect(result.byAuthor[0].zeroContributionCount).toBe(2);
      expect(result.byAuthor[0].zeroContributionUnitIds).toEqual([
        "github:sec:z-1",
        "github:sec:z-1",
      ]);
    });

    it("(vi) author 별 집계가 입력 최초 등장 순서를 보존한다(정렬 안정성 회귀 방어)", () => {
      const result = computeContributionQualitySignal([
        zeroUnit(1, "younghee", 0),
        normalUnit(2, "gildong"),
        zeroUnit(3, "younghee", CONTRIBUTION_QUALITY_TITLE_FLOOR),
        zeroUnit(4, "gildong", 0),
      ]);

      // 최초 등장 순서 younghee → gildong.
      expect(result.byAuthor.map((a) => a.author)).toEqual([
        "younghee",
        "gildong",
      ]);
      expect(result.byAuthor[0].zeroContributionCount).toBe(2);
      expect(result.byAuthor[1].zeroContributionCount).toBe(1);
      expect(result.totalZeroContributionCount).toBe(3);
      expect(result.zeroContributionDetected).toBe(true);
    });
  });

  // --- 결정성 + 비변형 ---
  describe("결정성 / 비변형", () => {
    function mixedBatch(): EvaluationInput[] {
      return [
        zeroUnit(1, "gildong", 0),
        normalUnit(2, "gildong"),
        zeroUnit(3, "younghee", CONTRIBUTION_QUALITY_TITLE_FLOOR),
      ];
    }

    it("동일 입력 2회 호출이 toEqual 동일 출력을 낸다(결정적)", () => {
      const inputs = mixedBatch();
      const first = computeContributionQualitySignal(inputs);
      const second = computeContributionQualitySignal(inputs);
      expect(first).toEqual(second);
    });

    it("입력 배열·원소를 변형하지 않는다(freeze 입력 통과)", () => {
      const inputs = mixedBatch().map((i) =>
        Object.freeze({ ...i, metadata: Object.freeze({ ...i.metadata }) }),
      ) as EvaluationInput[];
      const snapshot = JSON.parse(JSON.stringify(inputs));

      expect(() => computeContributionQualitySignal(inputs)).not.toThrow();
      expect(JSON.parse(JSON.stringify(inputs))).toEqual(snapshot);
    });
  });

  // --- 상수 noise-guard ---
  it("CONTRIBUTION_QUALITY_TITLE_FLOOR v1 baseline 은 1 (비음 정수)", () => {
    expect(CONTRIBUTION_QUALITY_TITLE_FLOOR).toBe(1);
    expect(Number.isInteger(CONTRIBUTION_QUALITY_TITLE_FLOOR)).toBe(true);
    expect(CONTRIBUTION_QUALITY_TITLE_FLOOR).toBeGreaterThanOrEqual(0);
  });

  // ContributionKind 타입 사용처 noise-guard(import 사용 보장).
  it("contributionKind 타입 멤버를 그대로 수용한다", () => {
    const kinds: ContributionKind[] = ["code", "document"];
    const inputs = kinds.map((kind, i) =>
      makeInput({ unitId: `u-${i}`, contributionKind: kind, titleLength: 0 }),
    );
    const result = computeContributionQualitySignal(inputs);
    // kind 무관하게 둘 다 후보.
    expect(result.totalZeroContributionCount).toBe(2);
  });
});
