// evaluation-document-contribution-signal.ts 의 colocated unit test (CLAUDE.md §3.2
// R-112 — happy / error / branch / negative cases 충분 cover).
// `computeDocumentContributionSignal` 순수 함수의 결정적 문서 축 기여 신호 산출
// (author 그룹핑 + document 단위 수 평균 대비 상대 임계 식별 + 경계 보수성 + 결정성
// + 비변형)을 검증한다. 신규 파일 100% 지향 — 모든 분기를 cover 한다.

import {
  computeDocumentContributionSignal,
  DOCUMENT_CONTRIBUTION_RELATIVE_CEILING,
  type DocumentContributionEntry,
  type DocumentContributionSignal,
} from "./evaluation-document-contribution-signal";
import type { ContributionKind, EvaluationInput } from "./evaluation-input";

// EvaluationInput stub 빌더. contributionKind 기본 "document", author 별 구분 가능.
function makeInput(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    unitId: "confluence:eng:u1",
    contributionKind: "document",
    sourceType: "confluence",
    instanceKey: "eng",
    author: "gildong",
    timestamp: "2026-06-01T09:00:00Z",
    metadata: {},
    ...overrides,
  };
}

// 한 author 의 document 단위 n 개 생성.
function docUnits(author: string, n: number): EvaluationInput[] {
  return Array.from({ length: n }, (_v, i) =>
    makeInput({
      unitId: `confluence:eng:${author}-d-${i}`,
      author,
      contributionKind: "document",
    }),
  );
}

// 한 author 의 code 단위 n 개 생성.
function codeUnits(author: string, n: number): EvaluationInput[] {
  return Array.from({ length: n }, (_v, i) =>
    makeInput({
      unitId: `github:sec:${author}-c-${i}`,
      author,
      contributionKind: "code",
      sourceType: "github",
      instanceKey: "sec",
    }),
  );
}

describe("computeDocumentContributionSignal", () => {
  // --- Happy path (public symbol 4 개 전부 사용) ---
  describe("happy path", () => {
    it("동료 평균 대비 문서 기여가 현격히 높은 author 를 notable 로 식별한다", () => {
      // gildong 12, younghee 2, chulsoo 2 → 평균 = 16/3 ≈ 5.33,
      // ceiling = 5.33 × 1.5 = 8. gildong(12) > 8 → notable, 나머지 비대상.
      const result: DocumentContributionSignal =
        computeDocumentContributionSignal([
          ...docUnits("gildong", 12),
          ...docUnits("younghee", 2),
          ...docUnits("chulsoo", 2),
        ]);

      expect(result.notableDetected).toBe(true);
      expect(result.totalAuthorCount).toBe(3);
      expect(result.meanDocumentUnitCount).toBeCloseTo(16 / 3, 10);

      const byName = Object.fromEntries(
        result.byAuthor.map((e: DocumentContributionEntry) => [e.author, e]),
      );
      // DocumentContributionEntry 3 필드 + notable 판정 전부 단언.
      expect(byName.gildong).toEqual({
        author: "gildong",
        documentUnitCount: 12,
        notable: true,
      });
      expect(byName.younghee).toEqual({
        author: "younghee",
        documentUnitCount: 2,
        notable: false,
      });
      expect(byName.chulsoo.notable).toBe(false);
      expect(byName.chulsoo.documentUnitCount).toBe(2);
    });

    it("상수 DOCUMENT_CONTRIBUTION_RELATIVE_CEILING 은 v1 baseline 1.5 다", () => {
      expect(DOCUMENT_CONTRIBUTION_RELATIVE_CEILING).toBe(1.5);
      expect(DOCUMENT_CONTRIBUTION_RELATIVE_CEILING).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Error path ---
  describe("error path", () => {
    it("inputs 가 null 이면 함수명이 담긴 한국어 TypeError 를 throw 한다", () => {
      expect(() => computeDocumentContributionSignal(null as never)).toThrow(
        TypeError,
      );
      expect(() => computeDocumentContributionSignal(null as never)).toThrow(
        /computeDocumentContributionSignal/,
      );
      expect(() => computeDocumentContributionSignal(null as never)).toThrow(
        /null\/undefined/,
      );
    });

    it("inputs 가 undefined 이면 함수명이 담긴 한국어 TypeError 를 throw 한다", () => {
      expect(() =>
        computeDocumentContributionSignal(undefined as never),
      ).toThrow(TypeError);
      expect(() =>
        computeDocumentContributionSignal(undefined as never),
      ).toThrow(/computeDocumentContributionSignal/);
    });

    it("빈 inputs 배열 → 빈 신호 반환(throw 없음 — 유일 throw 경로 확인)", () => {
      expect(() => computeDocumentContributionSignal([])).not.toThrow();
    });
  });

  // --- Flow / branch coverage ---
  describe("branch coverage", () => {
    it("(a) 단독 author batch → 비교 대상 없음 → notable 전원 false", () => {
      const result = computeDocumentContributionSignal(
        docUnits("gildong", 100),
      );
      expect(result.totalAuthorCount).toBe(1);
      expect(result.meanDocumentUnitCount).toBe(100);
      expect(result.notableDetected).toBe(false);
      expect(result.byAuthor[0].notable).toBe(false);
      expect(result.byAuthor[0].documentUnitCount).toBe(100);
    });

    it("(b) 평균 0 batch(전원 document 0) → notable 전원 false", () => {
      const result = computeDocumentContributionSignal([
        ...codeUnits("gildong", 5),
        ...codeUnits("younghee", 7),
      ]);
      expect(result.meanDocumentUnitCount).toBe(0);
      expect(result.notableDetected).toBe(false);
      expect(result.byAuthor.every((e) => !e.notable)).toBe(true);
    });

    it("(c) comparable batch 에서 임계와 정확히 같은 값 → false(엄격 초과)", () => {
      // gildong 2, younghee 6 → 평균 4, ceiling 6. younghee 6 == 6 → 초과 아님.
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 2),
        ...docUnits("younghee", 6),
      ]);
      expect(result.meanDocumentUnitCount).toBe(4);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.documentUnitCount).toBe(6);
      expect(younghee?.notable).toBe(false);
      expect(result.notableDetected).toBe(false);
    });

    it("(d) 임계 초과 → true", () => {
      // gildong 10, younghee 1 → 평균 5.5, ceiling 8.25. gildong(10) > 8.25.
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 10),
        ...docUnits("younghee", 1),
      ]);
      expect(result.notableDetected).toBe(true);
      expect(result.byAuthor.find((e) => e.author === "gildong")?.notable).toBe(
        true,
      );
      expect(
        result.byAuthor.find((e) => e.author === "younghee")?.notable,
      ).toBe(false);
    });

    it("(e) 빈 배열 → totalAuthorCount 0 · byAuthor [] · 평균 0 · detected false", () => {
      const result = computeDocumentContributionSignal([]);
      expect(result).toEqual({
        totalAuthorCount: 0,
        meanDocumentUnitCount: 0,
        byAuthor: [],
        notableDetected: false,
      });
    });

    it.each<[string, number, boolean]>([
      // 평균 = (4 + x)/2, ceiling = 평균 × 1.5.
      // x=12: 평균 8, ceiling 12, 12 > 12 false(strict) → 비대상.
      ["임계 정확히 경계값", 12, false],
      // x=13: 평균 8.5, ceiling 12.75, 13 > 12.75 → 대상.
      ["임계 초과", 13, true],
    ])("(f) 임계 경계 — 동료 4 + 후보 %s → notable=%s", (_l, x, expected) => {
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 4),
        ...docUnits("younghee", x),
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.notable).toBe(expected);
    });
  });

  // --- Negative cases (예외 분기마다 1+) ---
  describe("negative cases", () => {
    it("(i) code 단위만 있는 batch 는 document 카운트 0 유지(code 오염 없음)", () => {
      const result = computeDocumentContributionSignal([
        ...codeUnits("gildong", 30),
        ...codeUnits("younghee", 1),
      ]);
      expect(result.byAuthor.map((e) => e.documentUnitCount)).toEqual([0, 0]);
      expect(result.notableDetected).toBe(false);
    });

    it("(ii) 동일 author 의 code+document 혼합에서 document 단위만 카운트", () => {
      // gildong document 9(+ code 20 무시), younghee document 1.
      // 평균 5, ceiling 7.5, gildong 9 > 7.5 → 대상.
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 9),
        ...codeUnits("gildong", 20),
        ...docUnits("younghee", 1),
      ]);
      const gildong = result.byAuthor.find((e) => e.author === "gildong");
      expect(gildong?.documentUnitCount).toBe(9);
      expect(gildong?.notable).toBe(true);
      expect(result.totalAuthorCount).toBe(2);
      expect(result.meanDocumentUnitCount).toBe(5);
    });

    it("(iii) 같은 author 가 여러 번 등장해도 entry 1 개로 축약된다", () => {
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 3),
        ...codeUnits("gildong", 2),
        ...docUnits("gildong", 4),
      ]);
      expect(result.byAuthor).toHaveLength(1);
      expect(result.totalAuthorCount).toBe(1);
      expect(result.byAuthor[0].documentUnitCount).toBe(7);
    });

    it("(iv) byAuthor 순서가 author 최초 등장 순서와 일치한다(비결정성 0)", () => {
      const result = computeDocumentContributionSignal([
        ...docUnits("younghee", 10),
        ...docUnits("gildong", 1),
        ...codeUnits("younghee", 3),
        ...docUnits("chulsoo", 1),
      ]);
      expect(result.byAuthor.map((e) => e.author)).toEqual([
        "younghee",
        "gildong",
        "chulsoo",
      ]);
    });

    it("(v) contributionKind 가 예상치 못한 값이면 document 제외(throw 0)", () => {
      const weird = makeInput({
        unitId: "confluence:eng:weird",
        author: "younghee",
        contributionKind: "unknown" as unknown as ContributionKind,
      });
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 10),
        weird,
      ]);
      const younghee = result.byAuthor.find((e) => e.author === "younghee");
      expect(younghee?.documentUnitCount).toBe(0);
      expect(younghee?.notable).toBe(false);
      // 평균 5, ceiling 7.5, gildong 10 > 7.5 → 대상.
      expect(result.byAuthor.find((e) => e.author === "gildong")?.notable).toBe(
        true,
      );
    });

    it("(vi) 전원 동률이면 평균과 같아 notable 0(경계 false-positive 회피)", () => {
      const result = computeDocumentContributionSignal([
        ...docUnits("gildong", 5),
        ...docUnits("younghee", 5),
      ]);
      expect(result.byAuthor.every((e) => !e.notable)).toBe(true);
      expect(result.notableDetected).toBe(false);
    });
  });

  // --- 결정성 + 비변형 ---
  describe("결정성 / 비변형", () => {
    function mixedBatch(): EvaluationInput[] {
      return [
        ...docUnits("gildong", 12),
        ...docUnits("younghee", 2),
        ...codeUnits("chulsoo", 4),
      ];
    }

    it("동일 입력 2회 호출이 toEqual 동일 출력을 낸다(결정적)", () => {
      const inputs = mixedBatch();
      expect(computeDocumentContributionSignal(inputs)).toEqual(
        computeDocumentContributionSignal(inputs),
      );
    });

    it("호출 전후 입력 배열이 deep-equal 불변이다(원본 비변형)", () => {
      const inputs = mixedBatch().map((i) =>
        Object.freeze({ ...i, metadata: Object.freeze({ ...i.metadata }) }),
      ) as EvaluationInput[];
      const snapshot = JSON.parse(JSON.stringify(inputs));

      expect(() => computeDocumentContributionSignal(inputs)).not.toThrow();
      expect(JSON.parse(JSON.stringify(inputs))).toEqual(snapshot);
    });
  });

  // ContributionKind 타입 사용처 noise-guard(import 사용 보장).
  it("contributionKind 타입 멤버를 그대로 수용한다", () => {
    const kinds: ContributionKind[] = ["code", "document"];
    const inputs = kinds.map((kind, i) =>
      makeInput({ unitId: `u-${i}`, author: `a-${i}`, contributionKind: kind }),
    );
    const result = computeDocumentContributionSignal(inputs);
    expect(result.totalAuthorCount).toBe(2);
    expect(result.meanDocumentUnitCount).toBe(0.5);
  });
});
