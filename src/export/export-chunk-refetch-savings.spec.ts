import { ExportChunkRefetchBatch } from "./export-chunk-refetch-coalesce";
import {
  ExportChunkRefetchSavings,
  summariseExportChunkRefetchSavings,
} from "./export-chunk-refetch-savings";

// 테스트 입력 batch 를 만드는 helper — coalescing 을 재실행하지 않고(DRY) ExportChunkRefetchBatch 의
// 수치 필드만 직접 구성한다(본 helper 의 입력 계약은 batch 의 수치 필드뿐이며 ranges 내용은 사용 안 함).
function makeBatch(
  overrides: Partial<ExportChunkRefetchBatch> = {},
): ExportChunkRefetchBatch {
  const failedChunkCount = overrides.failedChunkCount ?? 0;
  const rangeCount = overrides.rangeCount ?? 0;
  return {
    allIntact: overrides.allIntact ?? failedChunkCount === 0,
    failedChunkCount,
    rangeCount,
    ranges: overrides.ranges ?? [],
    refetchBytes: overrides.refetchBytes ?? 0,
    headline: overrides.headline ?? "테스트 batch",
  };
}

// 객체를 재귀적으로 freeze — non-mutating 검증에 쓴다(변형 시 strict mode 에서 throw).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    Object.getOwnPropertyNames(obj).forEach((key) => {
      deepFreeze((obj as Record<string, unknown>)[key]);
    });
    Object.freeze(obj);
  }
  return obj;
}

describe("summariseExportChunkRefetchSavings", () => {
  describe("happy path — 모든 필드 기대값", () => {
    it("전부 연속(5→1): requestsSaved=4, savingsRatio=0.8, savingsPercent=80, fullyCoalesced=true", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 5, rangeCount: 1, refetchBytes: 500 }),
      );
      expect(result).toEqual<ExportChunkRefetchSavings>({
        allIntact: false,
        failedChunkCount: 5,
        rangeCount: 1,
        requestsSaved: 4,
        savingsRatio: 0.8,
        savingsPercent: 80,
        fullyCoalesced: true,
        refetchBytes: 500,
        headline:
          "chunked streaming 재요청 절감: 5개 요청 → 1개로 통합, 4개 절감(80%)",
      });
    });

    it("전부 비연속(3→3): requestsSaved=0, savingsRatio=0, fullyCoalesced=false", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 3, rangeCount: 3, refetchBytes: 300 }),
      );
      expect(result.requestsSaved).toBe(0);
      expect(result.savingsRatio).toBe(0);
      expect(result.savingsPercent).toBe(0);
      expect(result.fullyCoalesced).toBe(false);
      expect(result.allIntact).toBe(false);
      expect(result.refetchBytes).toBe(300);
    });

    it("혼합(3→2): requestsSaved=1, savingsRatio≈0.333, savingsPercent=33, fullyCoalesced=false", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 3, rangeCount: 2, refetchBytes: 300 }),
      );
      expect(result.requestsSaved).toBe(1);
      expect(result.savingsRatio).toBeCloseTo(1 / 3, 10);
      expect(result.savingsPercent).toBe(33);
      expect(result.fullyCoalesced).toBe(false);
    });

    it("allIntact(0→0): 모든 수치 0, fullyCoalesced=false, 무결 headline", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ allIntact: true, failedChunkCount: 0, rangeCount: 0 }),
      );
      expect(result).toEqual<ExportChunkRefetchSavings>({
        allIntact: true,
        failedChunkCount: 0,
        rangeCount: 0,
        requestsSaved: 0,
        savingsRatio: 0,
        savingsPercent: 0,
        fullyCoalesced: false,
        refetchBytes: 0,
        headline: "chunked streaming 재요청 절감: 재요청 불필요(무결) — 절감 0",
      });
    });

    it("단일 실패(1→1): requestsSaved=0, savingsRatio=0, fullyCoalesced=true", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 1, rangeCount: 1, refetchBytes: 100 }),
      );
      expect(result.requestsSaved).toBe(0);
      expect(result.savingsRatio).toBe(0);
      expect(result.savingsPercent).toBe(0);
      expect(result.fullyCoalesced).toBe(true);
    });
  });

  describe("error path — TypeError (입력 type 위반)", () => {
    it("batch 이 null 이면 TypeError", () => {
      expect(() => summariseExportChunkRefetchSavings(null as never)).toThrow(
        TypeError,
      );
      expect(() => summariseExportChunkRefetchSavings(null as never)).toThrow(
        /batch 은 plain object.*받음: null/,
      );
    });

    it("batch 이 배열이면 TypeError", () => {
      expect(() => summariseExportChunkRefetchSavings([] as never)).toThrow(
        /받음: array/,
      );
    });

    it("batch 이 원시값이면 TypeError", () => {
      expect(() => summariseExportChunkRefetchSavings(42 as never)).toThrow(
        TypeError,
      );
    });

    it("allIntact 가 boolean 아니면 TypeError(받은 값 박제)", () => {
      const bad = makeBatch({ failedChunkCount: 2, rangeCount: 1 });
      (bad as { allIntact: unknown }).allIntact = "yes";
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(TypeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /allIntact 는 boolean.*받음: yes/,
      );
    });

    it("failedChunkCount 가 비-음수정수 아니면 TypeError", () => {
      const bad = makeBatch({ rangeCount: 1 });
      (bad as { failedChunkCount: unknown }).failedChunkCount = -1;
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(TypeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /failedChunkCount.*받음: -1/,
      );
    });

    it("failedChunkCount 가 소수면 TypeError", () => {
      const bad = makeBatch({ rangeCount: 1 });
      (bad as { failedChunkCount: unknown }).failedChunkCount = 2.5;
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(TypeError);
    });

    it("rangeCount 가 비-음수정수 아니면 TypeError", () => {
      const bad = makeBatch({ failedChunkCount: 2 });
      (bad as { rangeCount: unknown }).rangeCount = NaN;
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(TypeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /rangeCount.*받음: NaN/,
      );
    });

    it("refetchBytes 가 비-음수정수 아니면 TypeError", () => {
      const bad = makeBatch({ failedChunkCount: 2, rangeCount: 1 });
      (bad as { refetchBytes: unknown }).refetchBytes = Infinity;
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(TypeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /refetchBytes.*받음: Infinity/,
      );
    });
  });

  describe("error path — RangeError (수치 모순)", () => {
    it("rangeCount > failedChunkCount 이면 RangeError", () => {
      const bad = makeBatch({ failedChunkCount: 2, rangeCount: 3 });
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(RangeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /rangeCount\(3\).*failedChunkCount\(2\).*늘릴 수 없습니다/,
      );
    });

    it("allIntact=true 인데 failedChunkCount !== 0 이면 RangeError", () => {
      const bad = makeBatch({
        allIntact: true,
        failedChunkCount: 2,
        rangeCount: 0,
      });
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(RangeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /allIntact 가 true 인데.*failedChunkCount/,
      );
    });

    it("allIntact=true 인데 rangeCount !== 0 이면 RangeError", () => {
      // failedChunkCount=0 으로 두어 failedChunkCount 분기를 통과시키고 rangeCount 모순만 발화.
      const bad = makeBatch({
        allIntact: true,
        failedChunkCount: 0,
        rangeCount: 1,
      });
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(RangeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /allIntact 가 true 인데.*rangeCount/,
      );
    });

    it("allIntact=false 인데 failedChunkCount === 0 이면 RangeError", () => {
      const bad = makeBatch({
        allIntact: false,
        failedChunkCount: 0,
        rangeCount: 0,
      });
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(RangeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /allIntact 가 false 인데.*failedChunkCount 가 0/,
      );
    });

    it("failedChunkCount>0 인데 rangeCount === 0 이면 RangeError(손상인데 범위 0)", () => {
      const bad = makeBatch({
        allIntact: false,
        failedChunkCount: 2,
        rangeCount: 0,
      });
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(RangeError);
      expect(() => summariseExportChunkRefetchSavings(bad)).toThrow(
        /failedChunkCount\(2\).*rangeCount 가 0/,
      );
    });
  });

  describe("flow / branch 분리", () => {
    it("allIntact true 분기 vs false 분기", () => {
      const intact = summariseExportChunkRefetchSavings(
        makeBatch({ allIntact: true }),
      );
      const damaged = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 4, rangeCount: 2, refetchBytes: 400 }),
      );
      expect(intact.allIntact).toBe(true);
      expect(damaged.allIntact).toBe(false);
    });

    it("failedChunkCount === 0 분기(savingsRatio=0 단락)", () => {
      const result = summariseExportChunkRefetchSavings(makeBatch());
      expect(result.savingsRatio).toBe(0);
    });

    it("failedChunkCount > 0 분기(나눗셈 수행)", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 2, rangeCount: 1, refetchBytes: 200 }),
      );
      expect(result.savingsRatio).toBe(0.5);
    });

    it("fullyCoalesced 경계 1→1: true", () => {
      expect(
        summariseExportChunkRefetchSavings(
          makeBatch({ failedChunkCount: 1, rangeCount: 1 }),
        ).fullyCoalesced,
      ).toBe(true);
    });

    it("fullyCoalesced 경계 2→1: true", () => {
      expect(
        summariseExportChunkRefetchSavings(
          makeBatch({ failedChunkCount: 2, rangeCount: 1 }),
        ).fullyCoalesced,
      ).toBe(true);
    });

    it("fullyCoalesced 경계 rangeCount=2: false", () => {
      expect(
        summariseExportChunkRefetchSavings(
          makeBatch({ failedChunkCount: 4, rangeCount: 2 }),
        ).fullyCoalesced,
      ).toBe(false);
    });

    it("requestsSaved=0 분기(failedChunkCount === rangeCount, 병합 없음)", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 4, rangeCount: 4 }),
      );
      expect(result.requestsSaved).toBe(0);
      expect(result.savingsRatio).toBe(0);
    });

    it("requestsSaved > 0 분기", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 4, rangeCount: 1 }),
      );
      expect(result.requestsSaved).toBe(3);
    });

    it("savingsPercent 반올림: 내림 경계(3→1, ratio≈0.667 → 67)", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 3, rangeCount: 1 }),
      );
      expect(result.savingsRatio).toBeCloseTo(2 / 3, 10);
      expect(result.savingsPercent).toBe(67);
    });

    it("savingsPercent 반올림: 0.5 미만 내림(8→7, ratio=0.125 → 13)", () => {
      const result = summariseExportChunkRefetchSavings(
        makeBatch({ failedChunkCount: 8, rangeCount: 7 }),
      );
      expect(result.savingsPercent).toBe(Math.round((1 / 8) * 100));
      expect(result.savingsPercent).toBe(13);
    });
  });

  describe("invariant / negative cases", () => {
    const cases: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [5, 1],
      [3, 3],
      [3, 2],
      [4, 2],
      [10, 3],
    ];

    it.each(cases)(
      "불변식 검증 (failedChunkCount=%i, rangeCount=%i)",
      (failedChunkCount, rangeCount) => {
        const allIntact = failedChunkCount === 0;
        const result = summariseExportChunkRefetchSavings(
          makeBatch({ allIntact, failedChunkCount, rangeCount }),
        );
        // requestsSaved === failedChunkCount - rangeCount 및 >= 0.
        expect(result.requestsSaved).toBe(failedChunkCount - rangeCount);
        expect(result.requestsSaved).toBeGreaterThanOrEqual(0);
        // 0 <= savingsRatio <= 1.
        expect(result.savingsRatio).toBeGreaterThanOrEqual(0);
        expect(result.savingsRatio).toBeLessThanOrEqual(1);
        // savingsPercent === Math.round(savingsRatio*100), 0~100.
        expect(result.savingsPercent).toBe(
          Math.round(result.savingsRatio * 100),
        );
        expect(result.savingsPercent).toBeGreaterThanOrEqual(0);
        expect(result.savingsPercent).toBeLessThanOrEqual(100);
        // allIntact ⟺ failedChunkCount===0 ⟺ rangeCount===0 ⟺ requestsSaved===0.
        if (result.allIntact) {
          expect(result.failedChunkCount).toBe(0);
          expect(result.rangeCount).toBe(0);
          expect(result.requestsSaved).toBe(0);
        }
        // fullyCoalesced ⟹ (rangeCount===1 && failedChunkCount>=1).
        if (result.fullyCoalesced) {
          expect(result.rangeCount).toBe(1);
          expect(result.failedChunkCount).toBeGreaterThanOrEqual(1);
        }
        // failedChunkCount === rangeCount ⟹ requestsSaved === 0.
        if (failedChunkCount === rangeCount) {
          expect(result.requestsSaved).toBe(0);
        }
      },
    );

    it("non-mutating: deepFreeze 된 입력으로 호출해도 throw 하지 않음", () => {
      const frozen = deepFreeze(
        makeBatch({ failedChunkCount: 5, rangeCount: 2, refetchBytes: 500 }),
      );
      expect(() => summariseExportChunkRefetchSavings(frozen)).not.toThrow();
      // 입력 batch 의 필드가 변형되지 않았는지 확인.
      expect(frozen.failedChunkCount).toBe(5);
      expect(frozen.rangeCount).toBe(2);
    });

    it("순수·결정성: 두 호출 결과는 !== 이면서 deep-equal", () => {
      const batch = makeBatch({
        failedChunkCount: 5,
        rangeCount: 2,
        refetchBytes: 500,
      });
      const a = summariseExportChunkRefetchSavings(batch);
      const b = summariseExportChunkRefetchSavings(batch);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
