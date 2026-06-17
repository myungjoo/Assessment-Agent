import {
  ExportChunkRefetchBatch,
  ExportChunkRefetchRange,
} from "./export-chunk-refetch-coalesce";
import {
  ExportChunkRefetchFragmentation,
  summariseExportChunkRefetchFragmentation,
} from "./export-chunk-refetch-fragmentation";

// 테스트용 ExportChunkRefetchRange 를 만드는 helper — 본 helper 가 사용하는 byteLength/chunkCount 만
// 의미 있으나 타입 충족을 위해 byte/chunk index 필드도 채운다(값 자체는 본 helper 가 안 읽음).
function makeRange(
  byteLength: number,
  chunkCount: number,
  firstBytePos = 0,
): ExportChunkRefetchRange {
  return {
    firstBytePos,
    lastBytePos: firstBytePos + byteLength - 1,
    byteLength,
    firstChunkIndex: 0,
    lastChunkIndex: chunkCount - 1,
    chunkCount,
  };
}

// 테스트 입력 batch 를 만드는 helper — coalescing 을 재실행하지 않고(DRY) ranges 로부터 합계를
// 계산해 ExportChunkRefetchBatch 의 수치 필드를 직접 구성한다(불변 계약을 충족하는 정상 batch).
function makeBatch(
  ranges: ExportChunkRefetchRange[],
  overrides: Partial<ExportChunkRefetchBatch> = {},
): ExportChunkRefetchBatch {
  const refetchBytes = ranges.reduce((sum, r) => sum + r.byteLength, 0);
  const failedChunkCount = ranges.reduce((sum, r) => sum + r.chunkCount, 0);
  return {
    allIntact: overrides.allIntact ?? ranges.length === 0,
    failedChunkCount: overrides.failedChunkCount ?? failedChunkCount,
    rangeCount: overrides.rangeCount ?? ranges.length,
    ranges: overrides.ranges ?? ranges,
    refetchBytes: overrides.refetchBytes ?? refetchBytes,
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

describe("summariseExportChunkRefetchFragmentation", () => {
  describe("happy path — 모든 필드 기대값", () => {
    it("무결(allIntact, rangeCount=0): 전부 0, !singleRange, !fragmented", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([], { allIntact: true }),
      );
      expect(result).toEqual<ExportChunkRefetchFragmentation>({
        allIntact: true,
        rangeCount: 0,
        failedChunkCount: 0,
        refetchBytes: 0,
        largestRangeBytes: 0,
        smallestRangeBytes: 0,
        averageRangeBytes: 0,
        averageChunksPerRange: 0,
        largestRangeChunkCount: 0,
        largestRangeShare: 0,
        singleRange: false,
        fragmented: false,
        headline: "chunked streaming 재요청 분산: 재요청 범위 없음(무결)",
      });
    });

    it("단일 범위(rangeCount=1, byteLength=100, chunkCount=3): share=1, singleRange", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(100, 3)]),
      );
      expect(result).toEqual<ExportChunkRefetchFragmentation>({
        allIntact: false,
        rangeCount: 1,
        failedChunkCount: 3,
        refetchBytes: 100,
        largestRangeBytes: 100,
        smallestRangeBytes: 100,
        averageRangeBytes: 100,
        averageChunksPerRange: 3,
        largestRangeChunkCount: 3,
        largestRangeShare: 1,
        singleRange: true,
        fragmented: false,
        headline:
          "chunked streaming 재요청 분산: 재요청 1개 범위, 최대 100 bytes, 평균 100 bytes/범위",
      });
    });

    it("다중 범위(rangeCount=3, byteLength 30/50/20, chunkCount 1/2/1): largest=50, share=0.5, fragmented", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(30, 1), makeRange(50, 2), makeRange(20, 1)]),
      );
      expect(result.rangeCount).toBe(3);
      expect(result.failedChunkCount).toBe(4);
      expect(result.refetchBytes).toBe(100);
      expect(result.largestRangeBytes).toBe(50);
      expect(result.smallestRangeBytes).toBe(20);
      expect(result.averageRangeBytes).toBeCloseTo(100 / 3, 10);
      expect(result.largestRangeShare).toBe(0.5);
      expect(result.largestRangeChunkCount).toBe(2);
      expect(result.averageChunksPerRange).toBeCloseTo(4 / 3, 10);
      expect(result.singleRange).toBe(false);
      expect(result.fragmented).toBe(true);
      expect(result.allIntact).toBe(false);
    });

    it("동률 최대 byteLength(40/40/20): 먼저 만난 범위의 chunkCount 채택", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(40, 5), makeRange(40, 9), makeRange(20, 2)]),
      );
      expect(result.largestRangeBytes).toBe(40);
      // 두 범위가 동률 40 이지만 먼저 만난 첫 범위의 chunkCount(5)를 채택해야 한다.
      expect(result.largestRangeChunkCount).toBe(5);
      expect(result.smallestRangeBytes).toBe(20);
    });

    it("2개 범위(rangeCount=2, 60/40): fragmented, 평균=50, share=0.6", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(60, 2), makeRange(40, 1)]),
      );
      expect(result.rangeCount).toBe(2);
      expect(result.largestRangeBytes).toBe(60);
      expect(result.smallestRangeBytes).toBe(40);
      expect(result.averageRangeBytes).toBe(50);
      expect(result.largestRangeShare).toBe(0.6);
      expect(result.averageChunksPerRange).toBe(1.5);
      expect(result.singleRange).toBe(false);
      expect(result.fragmented).toBe(true);
    });
  });

  describe("error path — TypeError (부적합 입력)", () => {
    it("batch 이 null → TypeError(label batch)", () => {
      expect(() =>
        summariseExportChunkRefetchFragmentation(
          null as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(TypeError);
      expect(() =>
        summariseExportChunkRefetchFragmentation(
          null as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(/batch 은 plain object 여야 합니다.*받음: null/);
    });

    it("batch 이 배열 → TypeError(label batch, array)", () => {
      expect(() =>
        summariseExportChunkRefetchFragmentation(
          [] as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(/batch 은 plain object 여야 합니다.*받음: array/);
    });

    it("batch 이 원시값 → TypeError(label batch, number)", () => {
      expect(() =>
        summariseExportChunkRefetchFragmentation(
          42 as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(/batch 은 plain object 여야 합니다.*받음: number/);
    });

    it("batch.allIntact 가 boolean 아님 → TypeError(label allIntact)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch as unknown as { allIntact: unknown }).allIntact = "no";
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.allIntact 는 boolean 이어야 합니다.*받음: no/,
      );
    });

    it("batch.failedChunkCount 비-음수정수 아님 → TypeError(label failedChunkCount)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch as unknown as { failedChunkCount: unknown }).failedChunkCount = -1;
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.failedChunkCount 는 0 이상의 정수여야 합니다.*받음: -1/,
      );
    });

    it("batch.rangeCount 비-음수정수 아님(소수) → TypeError(label rangeCount)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch as unknown as { rangeCount: unknown }).rangeCount = 1.5;
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.rangeCount 는 0 이상의 정수여야 합니다.*받음: 1\.5/,
      );
    });

    it("batch.refetchBytes 비-음수정수 아님(NaN) → TypeError(label refetchBytes)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch as unknown as { refetchBytes: unknown }).refetchBytes = NaN;
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.refetchBytes 는 0 이상의 정수여야 합니다.*받음: NaN/,
      );
    });

    it("batch.ranges 가 배열 아님 → TypeError(label ranges)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch as unknown as { ranges: unknown }).ranges = {};
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.ranges 는 배열이어야 합니다.*받음: object/,
      );
    });

    it("batch.ranges 원소가 plain object 아님 → TypeError(원소 index)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch as unknown as { ranges: unknown[] }).ranges = [null];
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.ranges\[0\] 는 plain object 여야 합니다.*받음: null/,
      );
    });

    it("ranges 원소 byteLength 비-음수정수 아님 → TypeError(원소 byteLength)", () => {
      // 정상 batch 를 만든 뒤 ranges 원소만 손상 — 상위 refetchBytes 검사는 통과하고 원소 검사에서 throw.
      const batch = makeBatch([makeRange(10, 1)]);
      (batch.ranges[0] as unknown as { byteLength: unknown }).byteLength = -5;
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.ranges\[0\]\.byteLength 는 0 이상의 정수여야 합니다.*받음: -5/,
      );
    });

    it("ranges 원소 chunkCount 비-음수정수 아님 → TypeError(원소 chunkCount)", () => {
      const batch = makeBatch([makeRange(10, 1)]);
      (batch.ranges[0] as unknown as { chunkCount: unknown }).chunkCount = "x";
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.ranges\[0\]\.chunkCount 는 0 이상의 정수여야 합니다.*받음: x/,
      );
    });
  });

  describe("error path — RangeError (계약 위반)", () => {
    it("rangeCount !== ranges.length → RangeError(불일치)", () => {
      const batch = makeBatch([makeRange(10, 1)], { rangeCount: 2 });
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        RangeError,
      );
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.rangeCount\(2\).*batch\.ranges\.length\(1\).*일치하지 않습니다/,
      );
    });

    it("allIntact=true 인데 rangeCount !== 0 → RangeError(모순)", () => {
      const batch = makeBatch([makeRange(10, 1)], { allIntact: true });
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.allIntact 가 true 인데 batch\.rangeCount\(1\)가 0 이 아닙니다/,
      );
    });

    it("allIntact=false 인데 rangeCount === 0 → RangeError(모순)", () => {
      const batch = makeBatch([], { allIntact: false });
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /batch\.allIntact 가 false 인데 batch\.rangeCount 가 0 입니다/,
      );
    });

    it("ranges 의 byteLength 합 !== refetchBytes → RangeError(위반·기대·실제)", () => {
      const batch = makeBatch([makeRange(30, 1), makeRange(20, 1)], {
        refetchBytes: 99,
      });
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /byteLength 합\(50\).*batch\.refetchBytes\(99\).*일치하지 않습니다/,
      );
    });

    it("ranges 의 chunkCount 합 !== failedChunkCount → RangeError(위반·기대·실제)", () => {
      const batch = makeBatch([makeRange(30, 1), makeRange(20, 2)], {
        failedChunkCount: 99,
      });
      expect(() => summariseExportChunkRefetchFragmentation(batch)).toThrow(
        /chunkCount 합\(3\).*batch\.failedChunkCount\(99\).*일치하지 않습니다/,
      );
    });
  });

  describe("flow / branch 분리", () => {
    it("allIntact true 분기 → 전부 0", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([], { allIntact: true }),
      );
      expect(result.largestRangeBytes).toBe(0);
      expect(result.averageRangeBytes).toBe(0);
      expect(result.largestRangeShare).toBe(0);
    });

    it("allIntact false 분기 → 값 존재", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(10, 1)]),
      );
      expect(result.largestRangeBytes).toBe(10);
      expect(result.averageRangeBytes).toBe(10);
    });

    it("rangeCount === 0 분기 → 평균 단락 0 (나눗셈 회피)", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([], { allIntact: true }),
      );
      expect(result.averageRangeBytes).toBe(0);
      expect(result.averageChunksPerRange).toBe(0);
    });

    it("rangeCount > 0 분기 → 평균 나눗셈 수행", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(20, 2), makeRange(40, 4)]),
      );
      expect(result.averageRangeBytes).toBe(30);
      expect(result.averageChunksPerRange).toBe(3);
    });

    it("refetchBytes === 0 분기 → largestRangeShare 단락 0", () => {
      // 모든 byteLength 0 (빈 byte 범위)인 경계 — refetchBytes 0 이지만 rangeCount > 0.
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(0, 1)]),
      );
      expect(result.refetchBytes).toBe(0);
      expect(result.largestRangeShare).toBe(0);
      expect(result.largestRangeBytes).toBe(0);
    });

    it("refetchBytes > 0 분기 → largestRangeShare 나눗셈 수행", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(25, 1), makeRange(75, 1)]),
      );
      expect(result.largestRangeShare).toBe(0.75);
    });

    it("singleRange 분기: rangeCount === 1 → true", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(10, 1)]),
      );
      expect(result.singleRange).toBe(true);
      expect(result.fragmented).toBe(false);
    });

    it("singleRange 분기: rangeCount === 2 → false (경계)", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(10, 1), makeRange(10, 1)]),
      );
      expect(result.singleRange).toBe(false);
      expect(result.fragmented).toBe(true);
    });

    it("최대 byteLength 선택: 첫 원소가 최대", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(90, 9), makeRange(5, 1), makeRange(5, 1)]),
      );
      expect(result.largestRangeBytes).toBe(90);
      expect(result.largestRangeChunkCount).toBe(9);
    });

    it("최대 byteLength 선택: 중간 원소가 최대", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(5, 1), makeRange(90, 9), makeRange(5, 1)]),
      );
      expect(result.largestRangeBytes).toBe(90);
      expect(result.largestRangeChunkCount).toBe(9);
    });

    it("최대 byteLength 선택: 마지막 원소가 최대", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(5, 1), makeRange(5, 1), makeRange(90, 9)]),
      );
      expect(result.largestRangeBytes).toBe(90);
      expect(result.largestRangeChunkCount).toBe(9);
    });

    it("최소 byteLength 선택: 중간 원소가 최소", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(50, 1), makeRange(10, 1), makeRange(40, 1)]),
      );
      expect(result.smallestRangeBytes).toBe(10);
    });
  });

  describe("negative / 불변(invariant) 충분 cover", () => {
    const cases: {
      name: string;
      ranges: ExportChunkRefetchRange[];
      allIntact?: boolean;
    }[] = [
      { name: "무결", ranges: [], allIntact: true },
      { name: "단일", ranges: [makeRange(100, 3)] },
      {
        name: "다중 혼합",
        ranges: [makeRange(30, 1), makeRange(50, 2), makeRange(20, 1)],
      },
      {
        name: "동률 최대",
        ranges: [makeRange(40, 5), makeRange(40, 9), makeRange(20, 2)],
      },
    ];

    it.each(cases)(
      "$name: 0 <= smallest <= average <= largest <= refetchBytes, 0 <= share <= 1",
      ({ ranges, allIntact }) => {
        const result = summariseExportChunkRefetchFragmentation(
          makeBatch(ranges, allIntact === undefined ? {} : { allIntact }),
        );
        expect(result.smallestRangeBytes).toBeGreaterThanOrEqual(0);
        if (result.rangeCount >= 1) {
          expect(result.smallestRangeBytes).toBeLessThanOrEqual(
            result.averageRangeBytes,
          );
          expect(result.averageRangeBytes).toBeLessThanOrEqual(
            result.largestRangeBytes,
          );
          expect(result.largestRangeBytes).toBeLessThanOrEqual(
            result.refetchBytes,
          );
        }
        expect(result.largestRangeShare).toBeGreaterThanOrEqual(0);
        expect(result.largestRangeShare).toBeLessThanOrEqual(1);
      },
    );

    it.each(cases)(
      "$name: singleRange XOR fragmented (rangeCount>=1), 둘 다 false (rangeCount===0)",
      ({ ranges, allIntact }) => {
        const result = summariseExportChunkRefetchFragmentation(
          makeBatch(ranges, allIntact === undefined ? {} : { allIntact }),
        );
        if (result.rangeCount === 0) {
          expect(result.singleRange).toBe(false);
          expect(result.fragmented).toBe(false);
        } else {
          expect(result.singleRange).not.toBe(result.fragmented);
        }
      },
    );

    it("rangeCount === 1 ⟹ largest === smallest === refetchBytes && share === 1", () => {
      const result = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(77, 4)]),
      );
      expect(result.largestRangeBytes).toBe(result.smallestRangeBytes);
      expect(result.largestRangeBytes).toBe(result.refetchBytes);
      expect(result.largestRangeShare).toBe(1);
      expect(result.singleRange).toBe(true);
      expect(result.fragmented).toBe(false);
    });

    it("allIntact ⟺ rangeCount === 0 ⟺ (refetchBytes === 0 && failedChunkCount === 0)", () => {
      const intact = summariseExportChunkRefetchFragmentation(
        makeBatch([], { allIntact: true }),
      );
      expect(intact.allIntact).toBe(true);
      expect(intact.rangeCount).toBe(0);
      expect(intact.refetchBytes).toBe(0);
      expect(intact.failedChunkCount).toBe(0);

      const damaged = summariseExportChunkRefetchFragmentation(
        makeBatch([makeRange(10, 1)]),
      );
      expect(damaged.allIntact).toBe(false);
      expect(damaged.rangeCount).toBeGreaterThan(0);
    });

    it("non-mutating: deepFreeze 된 입력 batch / ranges 통과 (변형 0)", () => {
      const batch = deepFreeze(
        makeBatch([makeRange(30, 1), makeRange(50, 2), makeRange(20, 1)]),
      );
      expect(() =>
        summariseExportChunkRefetchFragmentation(batch),
      ).not.toThrow();
    });

    it("결정성: 동일 입력 2회 호출은 deep-equal 이면서 다른 인스턴스(!==)", () => {
      const batch = makeBatch([makeRange(30, 1), makeRange(50, 2)]);
      const a = summariseExportChunkRefetchFragmentation(batch);
      const b = summariseExportChunkRefetchFragmentation(batch);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });
});
