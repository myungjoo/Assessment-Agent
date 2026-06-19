// evaluation-underperformer-signal.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative cases 충분 cover). `computeUnderPerformerSignal`
// 순수 함수의 결정적 저성과 신호 산출(author 그룹핑 + code 단위 수 평균 대비 상대
// 임계 식별 + 경계 보수성 + 결정성 + 비변형)을 검증한다. 신규 파일 100% 지향 — 모든
// 분기를 cover 한다.

import type { ContributionKind, EvaluationInput } from "./evaluation-input";
import {
  computeUnderPerformerSignal,
  UNDERPERFORMER_RELATIVE_FLOOR,
} from "./evaluation-underperformer-signal";

// EvaluationInput stub 빌더. contributionKind 기본 "code", author 별 구분 가능.
function makeInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    unitId: "github:sec:u1",
    contributionKind: "code",
    sourceType: "github",
    instanceKey: "sec",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    ...overrides,
  };
}

// 한 author 의 code 단위 n 개 생성.
function codeUnits(author: string, n: number): EvaluationInput[] {
  return Array.from({ length: n }, (_v, i) =>
    makeInput({
      unitId: `github:sec:${author}-c-${i}`,
      author,
      contributionKind: "code",
    }),
  );
}

// 한 author 의 document 단위 n 개 생성.
function docUnits(author: string, n: number): EvaluationInput[] {
  return Array.from({ length: n }, (_v, i) =>
    makeInput({
      unitId: `confluence:eng:${author}-d-${i}`,
      author,
      contributionKind: "document",
      sourceType: "confluence",
      instanceKey: "eng",
    }),
  );
}

describe("computeUnderPerformerSignal", () => {
  // --- Happy path ---
  describe("happy path", () => {
    it("동료 평균 대비 code 기여가 현격히 낮은 author 를 underPerformer 로 식별한다", () => {
      // gildong 8, younghee 8, chulsoo 1 → 평균 = 17/3 ≈ 5.67, floor ≈ 2.83.
      // chulsoo(1) < floor → underPerformer, 나머지 비대상.
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 8),
        ...codeUnits("younghee", 8),
        ...codeUnits("chulsoo", 1),
      ]);

      expect(result.underPerformerDetected).toBe(true);
      expect(result.totalAuthorCount).toBe(3);
      expect(result.meanCodeUnitCount).toBeCloseTo(17 / 3, 10);

      const byName = Object.fromEntries(
        result.byAuthor.map((e) => [e.author, e]),
      );
      expect(byName.chulsoo.underPerformer).toBe(true);
      expect(byName.chulsoo.codeUnitCount).toBe(1);
      expect(byName.gildong.underPerformer).toBe(false);
      expect(byName.gildong.codeUnitCount).toBe(8);
      expect(byName.younghee.underPerformer).toBe(false);
    });
  });

  // --- Error path ---
  describe("error path", () => {
    it("inputs 가 null 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeUnderPerformerSignal(null as unknown as EvaluationInput[]),
      ).toThrow(TypeError);
      expect(() =>
        computeUnderPerformerSignal(null as unknown as EvaluationInput[]),
      ).toThrow(/null\/undefined/);
    });

    it("inputs 가 undefined 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeUnderPerformerSignal(undefined as unknown as EvaluationInput[]),
      ).toThrow(TypeError);
    });

    it("빈 inputs 배열 → 빈 신호 반환(throw 없음)", () => {
      const result = computeUnderPerformerSignal([]);
      expect(result).toEqual({
        totalAuthorCount: 0,
        meanCodeUnitCount: 0,
        byAuthor: [],
        underPerformerDetected: false,
      });
    });
  });

  // --- Flow / branch coverage ---
  describe("branch coverage", () => {
    it("(a) underPerformer 대상 + 비대상 혼합 batch", () => {
      // gildong 10, younghee 1 → 평균 5.5, floor 2.75. younghee(1) 대상.
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 10),
        ...codeUnits("younghee", 1),
      ]);
      expect(result.underPerformerDetected).toBe(true);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.underPerformer).toBe(true);
    });

    it("(b) 전원 동률 codeUnitCount batch → 현격 차 없음 → underPerformer 0", () => {
      // gildong 4, younghee 4 → 평균 4, floor 2. 둘 다 4 ≥ 2 → 비대상.
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 4),
        ...codeUnits("younghee", 4),
      ]);
      expect(result.underPerformerDetected).toBe(false);
      expect(result.byAuthor.every((e) => !e.underPerformer)).toBe(true);
    });

    it("(c) document 단위는 code 기여 정량에서 제외된다", () => {
      // gildong code 6, younghee code 0 + document 10.
      // 평균 = (6+0)/2 = 3, floor 1.5. younghee codeUnitCount 0 < 1.5 → 대상.
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 6),
        ...docUnits("younghee", 10),
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.codeUnitCount).toBe(0);
      expect(younghee?.underPerformer).toBe(true);
      expect(result.meanCodeUnitCount).toBe(3);
    });

    it("(d) 단독 author batch → 비교 대상 없음 → underPerformer 0", () => {
      const result = computeUnderPerformerSignal([...codeUnits("gildong", 1)]);
      expect(result.totalAuthorCount).toBe(1);
      expect(result.underPerformerDetected).toBe(false);
      expect(result.byAuthor[0].underPerformer).toBe(false);
      expect(result.byAuthor[0].codeUnitCount).toBe(1);
    });
  });

  // --- Negative cases 충분 cover ---
  describe("negative cases", () => {
    it("(i) 빈 inputs 배열 → 빈 신호(detected 없음)", () => {
      const result = computeUnderPerformerSignal([]);
      expect(result.underPerformerDetected).toBe(false);
      expect(result.byAuthor).toEqual([]);
      expect(result.meanCodeUnitCount).toBe(0);
    });

    it("(ii) 전원 code 기여 0(전 author document 만) → 평균 0 → underPerformer 0", () => {
      const result = computeUnderPerformerSignal([
        ...docUnits("gildong", 3),
        ...docUnits("younghee", 5),
      ]);
      expect(result.meanCodeUnitCount).toBe(0);
      expect(result.underPerformerDetected).toBe(false);
      expect(result.byAuthor.every((e) => e.codeUnitCount === 0)).toBe(true);
    });

    it("(iii) contributionKind 가 예상치 못한 값이면 code 제외(throw 0)", () => {
      // gildong code 6, younghee 의 단위는 비정상 kind → code 카운트 0.
      const weird = makeInput({
        unitId: "github:sec:weird",
        author: "younghee",
        contributionKind: "unknown" as unknown as ContributionKind,
      });
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 6),
        weird,
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.codeUnitCount).toBe(0);
      // 평균 3, floor 1.5, younghee 0 < 1.5 → 대상(비code 는 정량에서 빠짐).
      expect(younghee?.underPerformer).toBe(true);
    });

    it("(iv) 동일 author 의 code+document 혼합에서 code 단위만 카운트", () => {
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 3),
        ...docUnits("gildong", 5),
        ...codeUnits("younghee", 3),
      ]);
      const gildong = result.byAuthor.find((e) => e.author === "gildong");
      // document 5 는 제외 — code 3 만.
      expect(gildong?.codeUnitCount).toBe(3);
      expect(result.totalAuthorCount).toBe(2);
    });

    it.each<[string, number, boolean]>([
      // 평균 = (10 + x)/2, floor = 평균 × 0.5. x 가 floor 와의 관계로 분류.
      // x=4: 평균 7, floor 3.5, 4 > 3.5 → 비대상.
      ["임계 초과", 4, false],
      // x=3: 평균 6.5, floor 3.25, 3 < 3.25 → 대상.
      ["임계 미만", 3, true],
    ])(
      "(v) 임계 경계 — 동료 10 + 대상 후보 %s → underPerformer=%s",
      (_label, x, expected) => {
        const result = computeUnderPerformerSignal([
          ...codeUnits("gildong", 10),
          ...codeUnits("younghee", x),
        ]);
        const younghee = result.byAuthor.find((e) => e.author === "younghee");
        expect(younghee?.underPerformer).toBe(expected);
      },
    );

    it("(v-b) codeUnitCount 가 floor 와 정확히 같으면 비대상(미만만 대상)", () => {
      // gildong 6, younghee 2 → 평균 4, floor 2. younghee 2 == 2 → 미만 아님 → 비대상.
      const result = computeUnderPerformerSignal([
        ...codeUnits("gildong", 6),
        ...codeUnits("younghee", 2),
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.codeUnitCount).toBe(2);
      expect(younghee?.underPerformer).toBe(false);
    });

    it("(vi) byAuthor 가 입력 최초 등장 순서를 보존한다(정렬 안정성 회귀 방어)", () => {
      const result = computeUnderPerformerSignal([
        ...codeUnits("younghee", 8),
        ...codeUnits("gildong", 1),
        ...codeUnits("younghee", 0),
        ...codeUnits("chulsoo", 8),
      ]);
      // 최초 등장 순서 younghee → gildong → chulsoo.
      expect(result.byAuthor.map((e) => e.author)).toEqual([
        "younghee",
        "gildong",
        "chulsoo",
      ]);
    });
  });

  // --- 결정성 + 비변형 ---
  describe("결정성 / 비변형", () => {
    function mixedBatch(): EvaluationInput[] {
      return [
        ...codeUnits("gildong", 8),
        ...codeUnits("younghee", 1),
        ...docUnits("chulsoo", 4),
      ];
    }

    it("동일 입력 2회 호출이 toEqual 동일 출력을 낸다(결정적)", () => {
      const inputs = mixedBatch();
      const first = computeUnderPerformerSignal(inputs);
      const second = computeUnderPerformerSignal(inputs);
      expect(first).toEqual(second);
    });

    it("입력 배열·원소를 변형하지 않는다(freeze 입력 통과)", () => {
      const inputs = mixedBatch().map((i) =>
        Object.freeze({ ...i, metadata: Object.freeze({ ...i.metadata }) }),
      ) as EvaluationInput[];
      const snapshot = JSON.parse(JSON.stringify(inputs));

      expect(() => computeUnderPerformerSignal(inputs)).not.toThrow();
      expect(JSON.parse(JSON.stringify(inputs))).toEqual(snapshot);
    });
  });

  // --- 상수 noise-guard ---
  it("UNDERPERFORMER_RELATIVE_FLOOR v1 baseline 은 0.5 (0~1 비율)", () => {
    expect(UNDERPERFORMER_RELATIVE_FLOOR).toBe(0.5);
    expect(UNDERPERFORMER_RELATIVE_FLOOR).toBeGreaterThan(0);
    expect(UNDERPERFORMER_RELATIVE_FLOOR).toBeLessThanOrEqual(1);
  });

  // ContributionKind 타입 사용처 noise-guard(import 사용 보장).
  it("contributionKind 타입 멤버를 그대로 수용한다", () => {
    const kinds: ContributionKind[] = ["code", "document"];
    const inputs = kinds.map((kind, i) =>
      makeInput({ unitId: `u-${i}`, author: `a-${i}`, contributionKind: kind }),
    );
    const result = computeUnderPerformerSignal(inputs);
    expect(result.totalAuthorCount).toBe(2);
  });
});
