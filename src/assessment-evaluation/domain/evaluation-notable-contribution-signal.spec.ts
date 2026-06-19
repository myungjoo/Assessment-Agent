// evaluation-notable-contribution-signal.ts 의 colocated unit test (CLAUDE.md §3.2
// R-112 — happy / error / branch / negative cases 충분 cover).
// `computeNotableContributionSignal` 순수 함수의 결정적 notable 신호 산출(author
// 그룹핑 + code 단위 수 평균 대비 상대 임계 식별 + 경계 보수성 + 결정성 + 비변형)을
// 검증한다. 신규 파일 100% 지향 — 모든 분기를 cover 한다.

import type { ContributionKind, EvaluationInput } from "./evaluation-input";
import {
  computeNotableContributionSignal,
  NOTABLE_RELATIVE_CEILING,
} from "./evaluation-notable-contribution-signal";

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

describe("computeNotableContributionSignal", () => {
  // --- Happy path ---
  describe("happy path", () => {
    it("동료 평균 대비 code 기여가 현격히 높은 author 를 notable 로 식별한다", () => {
      // gildong 12, younghee 2, chulsoo 2 → 평균 = 16/3 ≈ 5.33,
      // ceiling = 5.33 × 1.5 ≈ 8. gildong(12) > 8 → notable, 나머지 비대상.
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 12),
        ...codeUnits("younghee", 2),
        ...codeUnits("chulsoo", 2),
      ]);

      expect(result.notableDetected).toBe(true);
      expect(result.totalAuthorCount).toBe(3);
      expect(result.meanCodeUnitCount).toBeCloseTo(16 / 3, 10);

      const byName = Object.fromEntries(
        result.byAuthor.map((e) => [e.author, e]),
      );
      expect(byName.gildong.notable).toBe(true);
      expect(byName.gildong.codeUnitCount).toBe(12);
      expect(byName.younghee.notable).toBe(false);
      expect(byName.younghee.codeUnitCount).toBe(2);
      expect(byName.chulsoo.notable).toBe(false);
    });
  });

  // --- Error path ---
  describe("error path", () => {
    it("inputs 가 null 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeNotableContributionSignal(null as unknown as EvaluationInput[]),
      ).toThrow(TypeError);
      expect(() =>
        computeNotableContributionSignal(null as unknown as EvaluationInput[]),
      ).toThrow(/null\/undefined/);
    });

    it("inputs 가 undefined 이면 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeNotableContributionSignal(
          undefined as unknown as EvaluationInput[],
        ),
      ).toThrow(TypeError);
    });

    it("빈 inputs 배열 → 빈 신호 반환(throw 없음)", () => {
      const result = computeNotableContributionSignal([]);
      expect(result).toEqual({
        totalAuthorCount: 0,
        meanCodeUnitCount: 0,
        byAuthor: [],
        notableDetected: false,
      });
    });
  });

  // --- Flow / branch coverage ---
  describe("branch coverage", () => {
    it("(a) notable 대상 + 비대상 혼합 batch", () => {
      // gildong 10, younghee 1 → 평균 5.5, ceiling 8.25. gildong(10) > 8.25 대상.
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 10),
        ...codeUnits("younghee", 1),
      ]);
      expect(result.notableDetected).toBe(true);
      const gildong = result.byAuthor.find((e) => e.author === "gildong");
      expect(gildong?.notable).toBe(true);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.notable).toBe(false);
    });

    it("(b) 전원 평균 이하(현격 차 없음) → notable 0", () => {
      // gildong 4, younghee 4 → 평균 4, ceiling 6. 둘 다 4 ≤ 6 → 비대상.
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 4),
        ...codeUnits("younghee", 4),
      ]);
      expect(result.notableDetected).toBe(false);
      expect(result.byAuthor.every((e) => !e.notable)).toBe(true);
    });

    it("(c) 단독 author batch → 비교 대상 없음 → notable 0", () => {
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 100),
      ]);
      expect(result.totalAuthorCount).toBe(1);
      expect(result.notableDetected).toBe(false);
      expect(result.byAuthor[0].notable).toBe(false);
      expect(result.byAuthor[0].codeUnitCount).toBe(100);
    });

    it("(d) 평균 0 batch(전원 code 기여 0) → notable 0", () => {
      const result = computeNotableContributionSignal([
        ...docUnits("gildong", 5),
        ...docUnits("younghee", 7),
      ]);
      expect(result.meanCodeUnitCount).toBe(0);
      expect(result.notableDetected).toBe(false);
      expect(result.byAuthor.every((e) => !e.notable)).toBe(true);
    });

    it("(e) document 단위는 code 기여 정량에서 제외된다", () => {
      // gildong code 12, younghee code 2 + document 10.
      // 평균 = (12+2)/2 = 7, ceiling 10.5. gildong(12) > 10.5 → 대상.
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 12),
        ...codeUnits("younghee", 2),
        ...docUnits("younghee", 10),
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.codeUnitCount).toBe(2);
      expect(younghee?.notable).toBe(false);
      expect(result.meanCodeUnitCount).toBe(7);
      const gildong = result.byAuthor.find((e) => e.author === "gildong");
      expect(gildong?.notable).toBe(true);
    });
  });

  // --- Negative cases 충분 cover ---
  describe("negative cases", () => {
    it("(i) 빈 inputs 배열 → 빈 신호(detected 없음)", () => {
      const result = computeNotableContributionSignal([]);
      expect(result.notableDetected).toBe(false);
      expect(result.byAuthor).toEqual([]);
      expect(result.meanCodeUnitCount).toBe(0);
    });

    it("(ii) 전원 동률 → 평균과 동일 → strict 비교로 notable 0(경계 false-positive 회피)", () => {
      // gildong 5, younghee 5 → 평균 5, ceiling 7.5. 둘 다 5 < 7.5 → 비대상.
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 5),
        ...codeUnits("younghee", 5),
      ]);
      expect(result.byAuthor.every((e) => !e.notable)).toBe(true);
      expect(result.notableDetected).toBe(false);
    });

    it("(iii) contributionKind 가 예상치 못한 값이면 code 제외(throw 0)", () => {
      // gildong code 10, younghee 의 단위는 비정상 kind → code 카운트 0.
      // 평균 = 10/2 = 5, ceiling 7.5. gildong(10) > 7.5 → 대상.
      const weird = makeInput({
        unitId: "github:sec:weird",
        author: "younghee",
        contributionKind: "unknown" as unknown as ContributionKind,
      });
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 10),
        weird,
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.codeUnitCount).toBe(0);
      expect(younghee?.notable).toBe(false);
      const gildong = result.byAuthor.find((e) => e.author === "gildong");
      expect(gildong?.notable).toBe(true);
    });

    it("(iv) 동일 author 의 code+document 혼합에서 code 단위만 카운트", () => {
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 9),
        ...docUnits("gildong", 5),
        ...codeUnits("younghee", 1),
      ]);
      const gildong = result.byAuthor.find((e) => e.author === "gildong");
      // document 5 는 제외 — code 9 만.
      expect(gildong?.codeUnitCount).toBe(9);
      expect(result.totalAuthorCount).toBe(2);
      // 평균 5, ceiling 7.5, gildong 9 > 7.5 → 대상.
      expect(gildong?.notable).toBe(true);
    });

    it.each<[string, number, boolean]>([
      // 평균 = (4 + x)/2, ceiling = 평균 × 1.5. x 가 ceiling 과의 관계로 분류.
      // x=12: 평균 8, ceiling 12, 12 > 12 false(strict) → 비대상.
      ["임계 정확히 경계값", 12, false],
      // x=13: 평균 8.5, ceiling 12.75, 13 > 12.75 → 대상.
      ["임계 초과", 13, true],
    ])(
      "(v) 임계 경계 — 동료 4 + 후보 %s → notable=%s",
      (_label, x, expected) => {
        const result = computeNotableContributionSignal([
          ...codeUnits("gildong", 4),
          ...codeUnits("younghee", x),
        ]);
        const younghee = result.byAuthor.find((e) => e.author === "younghee");
        expect(younghee?.notable).toBe(expected);
      },
    );

    it("(v-b) codeUnitCount 가 ceiling 과 정확히 같으면 비대상(초과만 대상)", () => {
      // gildong 2, younghee 6 → 평균 4, ceiling 6. younghee 6 == 6 → 초과 아님 → 비대상.
      const result = computeNotableContributionSignal([
        ...codeUnits("gildong", 2),
        ...codeUnits("younghee", 6),
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.codeUnitCount).toBe(6);
      expect(younghee?.notable).toBe(false);
    });

    it("(vi) byAuthor 가 입력 최초 등장 순서를 보존한다(정렬 안정성 회귀 방어)", () => {
      const result = computeNotableContributionSignal([
        ...codeUnits("younghee", 10),
        ...codeUnits("gildong", 1),
        ...codeUnits("younghee", 0),
        ...codeUnits("chulsoo", 1),
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
        ...codeUnits("gildong", 12),
        ...codeUnits("younghee", 2),
        ...docUnits("chulsoo", 4),
      ];
    }

    it("동일 입력 2회 호출이 toEqual 동일 출력을 낸다(결정적)", () => {
      const inputs = mixedBatch();
      const first = computeNotableContributionSignal(inputs);
      const second = computeNotableContributionSignal(inputs);
      expect(first).toEqual(second);
    });

    it("입력 배열·원소를 변형하지 않는다(freeze 입력 통과)", () => {
      const inputs = mixedBatch().map((i) =>
        Object.freeze({ ...i, metadata: Object.freeze({ ...i.metadata }) }),
      ) as EvaluationInput[];
      const snapshot = JSON.parse(JSON.stringify(inputs));

      expect(() => computeNotableContributionSignal(inputs)).not.toThrow();
      expect(JSON.parse(JSON.stringify(inputs))).toEqual(snapshot);
    });
  });

  // --- 상수 noise-guard ---
  it("NOTABLE_RELATIVE_CEILING v1 baseline 은 1.5 (1 이상 비율)", () => {
    expect(NOTABLE_RELATIVE_CEILING).toBe(1.5);
    expect(NOTABLE_RELATIVE_CEILING).toBeGreaterThanOrEqual(1);
  });

  // ContributionKind 타입 사용처 noise-guard(import 사용 보장).
  it("contributionKind 타입 멤버를 그대로 수용한다", () => {
    const kinds: ContributionKind[] = ["code", "document"];
    const inputs = kinds.map((kind, i) =>
      makeInput({ unitId: `u-${i}`, author: `a-${i}`, contributionKind: kind }),
    );
    const result = computeNotableContributionSignal(inputs);
    expect(result.totalAuthorCount).toBe(2);
  });
});
