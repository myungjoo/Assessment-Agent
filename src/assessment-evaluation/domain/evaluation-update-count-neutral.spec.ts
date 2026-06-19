// evaluation-update-count-neutral.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover). `computeUpdateCountNeutralization`
// 순수 함수의 결정적 update 횟수 중립화 신호 산출(author 그룹핑 + document version
// 임계 식별 + code 단위 비대상 + 방어적 입력 흡수 + 결정성 + 비변형)을 검증한다.
// 신규 파일 100% 지향 — 모든 분기를 cover 한다.

import type { ActivityMetadata } from "../../assessment-collection/domain/activity";

import type { ContributionKind, EvaluationInput } from "./evaluation-input";
import {
  computeUpdateCountNeutralization,
  UPDATE_COUNT_NEUTRAL_THRESHOLD,
} from "./evaluation-update-count-neutral";

// EvaluationInput stub 빌더. version 은 metadata.version 으로 주입하며, document /
// code 기여를 contributionKind 로 조절한다. version 에 비-number / 부재 시나리오를
// 주입할 수 있도록 unknown 을 허용한다.
function makeInput(
  overrides: Partial<EvaluationInput> & { version?: unknown } = {},
): EvaluationInput {
  const { version, metadata, ...rest } = overrides;
  const finalMetadata: ActivityMetadata =
    metadata ??
    (version === undefined ? {} : ({ version } as unknown as ActivityMetadata));
  return {
    unitId: "confluence:eng:p1",
    contributionKind: "document",
    sourceType: "confluence",
    instanceKey: "eng",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: finalMetadata,
    ...rest,
  };
}

// document 단위 — version 임계 이상(중립 대상 후보).
function neutralDoc(
  i: number,
  author = "gildong",
  version = UPDATE_COUNT_NEUTRAL_THRESHOLD,
): EvaluationInput {
  return makeInput({
    unitId: `confluence:eng:nd-${i}`,
    author,
    contributionKind: "document",
    version,
  });
}

describe("computeUpdateCountNeutralization", () => {
  // --- Happy path ---
  describe("happy path", () => {
    it("version 이 임계 이상인 document 단위를 neutralized 로 식별한다", () => {
      const result = computeUpdateCountNeutralization([
        neutralDoc(1, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD),
      ]);

      expect(result.neutralized).toBe(true);
      expect(result.totalUnitCount).toBe(1);
      expect(result.totalNeutralizedCount).toBe(1);
      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].author).toBe("gildong");
      expect(result.byAuthor[0].neutralized).toBe(true);
      expect(result.byAuthor[0].neutralizedCount).toBe(1);
      expect(result.byAuthor[0].neutralizedUnitIds).toEqual([
        "confluence:eng:nd-1",
      ]);
    });

    it("code 단위는 version 이 임계 이상이어도 식별 대상이 아니다", () => {
      const codeUnit = makeInput({
        unitId: "github:sec:c1",
        contributionKind: "code",
        sourceType: "github",
        instanceKey: "sec",
        version: 99,
      });

      const result = computeUpdateCountNeutralization([codeUnit]);

      expect(result.neutralized).toBe(false);
      expect(result.totalUnitCount).toBe(1);
      expect(result.totalNeutralizedCount).toBe(0);
      // code-only author 도 byAuthor 에는 등장하되 neutralized=false.
      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].neutralized).toBe(false);
      expect(result.byAuthor[0].neutralizedUnitIds).toEqual([]);
    });
  });

  // --- Error path ---
  describe("error path", () => {
    it("inputs 가 null 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeUpdateCountNeutralization(null as unknown as EvaluationInput[]),
      ).toThrow(TypeError);
      expect(() =>
        computeUpdateCountNeutralization(null as unknown as EvaluationInput[]),
      ).toThrow(/null\/undefined/);
    });

    it("inputs 가 undefined 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeUpdateCountNeutralization(
          undefined as unknown as EvaluationInput[],
        ),
      ).toThrow(TypeError);
    });

    it("version metadata 가 부재한 document 단위는 throw 없이 0(미식별)으로 흡수한다", () => {
      const result = computeUpdateCountNeutralization([
        makeInput({ unitId: "confluence:eng:no-ver" }),
      ]);

      expect(result.neutralized).toBe(false);
      expect(result.totalNeutralizedCount).toBe(0);
    });

    it.each<[string, unknown]>([
      ["string", "5"],
      ["boolean", true],
      ["null", null],
    ])(
      "version 이 비-number(%s)면 throw 없이 0(미식별)으로 흡수한다",
      (_label, version) => {
        const result = computeUpdateCountNeutralization([
          makeInput({ unitId: "confluence:eng:bad-ver", version }),
        ]);

        expect(result.neutralized).toBe(false);
        expect(result.totalNeutralizedCount).toBe(0);
      },
    );
  });

  // --- Flow / branch coverage ---
  describe("branch coverage", () => {
    it("(a) version 임계 이상 document → neutralized=true 분기", () => {
      const result = computeUpdateCountNeutralization([
        neutralDoc(1, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD + 3),
      ]);
      expect(result.byAuthor[0].neutralized).toBe(true);
    });

    it("(b) version 임계 미만 document → neutralized=false 분기", () => {
      const result = computeUpdateCountNeutralization([
        neutralDoc(1, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD - 1),
      ]);
      expect(result.byAuthor[0].neutralized).toBe(false);
      expect(result.byAuthor[0].neutralizedUnitIds).toEqual([]);
    });

    it("(c) code 단위 → contributionKind 분기로 미대상", () => {
      const result = computeUpdateCountNeutralization([
        makeInput({ contributionKind: "code", version: 100 }),
      ]);
      expect(result.totalNeutralizedCount).toBe(0);
    });

    it.each<[string, number]>([
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
    ])(
      "(d) version 이 비유한 number(%s) → 방어적 0 처리(미식별)",
      (_label, version) => {
        const result = computeUpdateCountNeutralization([
          makeInput({ unitId: "confluence:eng:nf", version }),
        ]);
        expect(result.neutralized).toBe(false);
      },
    );
  });

  // --- Negative cases 충분 cover ---
  describe("negative cases", () => {
    it("(i) 빈 inputs 배열 → 빈 신호(neutralized 없음)", () => {
      const result = computeUpdateCountNeutralization([]);
      expect(result).toEqual({
        totalUnitCount: 0,
        totalNeutralizedCount: 0,
        byAuthor: [],
        neutralized: false,
      });
    });

    it("(ii) version 필드 부재 metadata → 미식별", () => {
      const result = computeUpdateCountNeutralization([
        makeInput({ metadata: { titleLength: 10 } }),
      ]);
      expect(result.neutralized).toBe(false);
    });

    it.each<[string, number]>([
      ["version=0", 0],
      ["음수 version", -7],
    ])("(iii) %s → 방어 절하(0, 미식별)", (_label, version) => {
      const result = computeUpdateCountNeutralization([makeInput({ version })]);
      expect(result.neutralized).toBe(false);
      expect(result.totalNeutralizedCount).toBe(0);
    });

    it("(iv) 동일 author 다수 document 중 일부만 임계 초과 → 부분 식별 정합", () => {
      const result = computeUpdateCountNeutralization([
        neutralDoc(1, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD), // 식별
        neutralDoc(2, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD - 2), // 미식별
        neutralDoc(3, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD + 1), // 식별
      ]);

      expect(result.byAuthor).toHaveLength(1);
      expect(result.byAuthor[0].neutralizedCount).toBe(2);
      expect(result.byAuthor[0].neutralizedUnitIds).toEqual([
        "confluence:eng:nd-1",
        "confluence:eng:nd-3",
      ]);
      expect(result.totalNeutralizedCount).toBe(2);
    });

    it("(v) 다수 author 혼합 batch → author 별 독립 집계 + 최초 등장 순서 보존", () => {
      const result = computeUpdateCountNeutralization([
        neutralDoc(1, "younghee", UPDATE_COUNT_NEUTRAL_THRESHOLD),
        neutralDoc(2, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD - 1), // 미식별
        neutralDoc(3, "younghee", UPDATE_COUNT_NEUTRAL_THRESHOLD + 2),
        neutralDoc(4, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD),
      ]);

      // 최초 등장 순서 younghee → gildong.
      expect(result.byAuthor.map((a) => a.author)).toEqual([
        "younghee",
        "gildong",
      ]);
      expect(result.byAuthor[0].neutralizedCount).toBe(2);
      expect(result.byAuthor[1].neutralizedCount).toBe(1);
      expect(result.totalNeutralizedCount).toBe(3);
      expect(result.neutralized).toBe(true);
    });

    it("(vi) 비-Confluence document(version 부재, GitHub issue 등)는 미식별", () => {
      const issueAsDoc = makeInput({
        unitId: "github:sec:i1",
        contributionKind: "document",
        sourceType: "github",
        instanceKey: "sec",
        // version 없음 (issue 는 version metadata 부재).
      });
      const result = computeUpdateCountNeutralization([issueAsDoc]);
      expect(result.neutralized).toBe(false);
    });
  });

  // --- 결정성 + 비변형 ---
  describe("결정성 / 비변형", () => {
    function mixedBatch(): EvaluationInput[] {
      return [
        neutralDoc(1, "gildong", UPDATE_COUNT_NEUTRAL_THRESHOLD + 2),
        makeInput({
          unitId: "github:sec:c1",
          contributionKind: "code",
          sourceType: "github",
          version: 50,
        }),
        neutralDoc(2, "younghee", UPDATE_COUNT_NEUTRAL_THRESHOLD - 1),
      ];
    }

    it("동일 입력 2회 호출이 toEqual 동일 출력을 낸다(결정적)", () => {
      const inputs = mixedBatch();
      const first = computeUpdateCountNeutralization(inputs);
      const second = computeUpdateCountNeutralization(inputs);
      expect(first).toEqual(second);
    });

    it("입력 배열·원소를 변형하지 않는다(freeze 입력 통과)", () => {
      const inputs = mixedBatch().map((i) =>
        Object.freeze({ ...i, metadata: Object.freeze({ ...i.metadata }) }),
      ) as EvaluationInput[];
      const snapshot = JSON.parse(JSON.stringify(inputs));

      expect(() => computeUpdateCountNeutralization(inputs)).not.toThrow();
      expect(JSON.parse(JSON.stringify(inputs))).toEqual(snapshot);
    });
  });

  // --- 상수 noise-guard ---
  it("UPDATE_COUNT_NEUTRAL_THRESHOLD v1 baseline 은 5 (양의 정수)", () => {
    expect(UPDATE_COUNT_NEUTRAL_THRESHOLD).toBe(5);
    expect(Number.isInteger(UPDATE_COUNT_NEUTRAL_THRESHOLD)).toBe(true);
    expect(UPDATE_COUNT_NEUTRAL_THRESHOLD).toBeGreaterThan(0);
  });

  // ContributionKind 타입 사용처 noise-guard(import 사용 보장).
  it("contributionKind 타입 멤버를 그대로 수용한다", () => {
    const kinds: ContributionKind[] = ["code", "document"];
    const inputs = kinds.map((kind, i) =>
      makeInput({ unitId: `u-${i}`, contributionKind: kind, version: 9 }),
    );
    const result = computeUpdateCountNeutralization(inputs);
    // document 1 건만 식별(code 는 비대상).
    expect(result.totalNeutralizedCount).toBe(1);
  });
});
