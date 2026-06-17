import {
  ExportChunkRefetchBatch,
  ExportChunkRefetchRange,
} from "./export-chunk-refetch-coalesce";
import {
  ExportChunkRefetchGaps,
  summariseExportChunkRefetchGaps,
} from "./export-chunk-refetch-gap";

// 테스트용 ExportChunkRefetchRange 를 만드는 helper — 본 helper 가 사용하는 firstBytePos/lastBytePos/
// byteLength 를 byte 계약(byteLength === lastBytePos - firstBytePos + 1)에 맞춰 채운다. chunk index
// 필드도 타입 충족을 위해 채우나 값은 본 helper 가 안 읽음.
function makeRange(
  firstBytePos: number,
  lastBytePos: number,
  chunkCount = 1,
): ExportChunkRefetchRange {
  return {
    firstBytePos,
    lastBytePos,
    byteLength: lastBytePos - firstBytePos + 1,
    firstChunkIndex: 0,
    lastChunkIndex: chunkCount - 1,
    chunkCount,
  };
}

// 테스트 입력 batch 를 만드는 helper — coalescing 을 재실행하지 않고(DRY) ranges 로부터 합계를 계산해
// ExportChunkRefetchBatch 의 수치 필드를 직접 구성한다(불변 계약을 충족하는 정상 batch).
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

describe("summariseExportChunkRefetchGaps", () => {
  describe("happy path — 모든 필드 기대값", () => {
    it("무결(allIntact, rangeCount=0): 전부 0, gapCount=0, contiguous", () => {
      const result = summariseExportChunkRefetchGaps(
        makeBatch([], { allIntact: true }),
      );
      expect(result).toEqual<ExportChunkRefetchGaps>({
        allIntact: true,
        rangeCount: 0,
        refetchBytes: 0,
        outerSpanFirstBytePos: 0,
        outerSpanLastBytePos: 0,
        spannedBytes: 0,
        gapCount: 0,
        gapBytes: 0,
        largestGapBytes: 0,
        averageGapBytes: 0,
        gapRatio: 0,
        contiguous: true,
        headline: "chunked streaming 재요청 gap: 재요청 범위 없음(무결)",
      });
    });

    it("단일 범위(rangeCount=1): spannedBytes===refetchBytes, gap 전부 0, contiguous", () => {
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(10, 109)]),
      );
      expect(result.allIntact).toBe(false);
      expect(result.rangeCount).toBe(1);
      expect(result.refetchBytes).toBe(100);
      expect(result.outerSpanFirstBytePos).toBe(10);
      expect(result.outerSpanLastBytePos).toBe(109);
      expect(result.spannedBytes).toBe(100);
      expect(result.spannedBytes).toBe(result.refetchBytes);
      expect(result.gapCount).toBe(0);
      expect(result.gapBytes).toBe(0);
      expect(result.largestGapBytes).toBe(0);
      expect(result.averageGapBytes).toBe(0);
      expect(result.gapRatio).toBe(0);
      expect(result.contiguous).toBe(true);
    });

    it("다중 범위(rangeCount=3): outerSpan/spannedBytes/gapBytes/largestGapBytes/averageGapBytes/gapRatio 기대값, !contiguous", () => {
      // ranges: 0/29, 50/99, 200/219 (byteLength 30/50/20, refetchBytes 100)
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 29), makeRange(50, 99), makeRange(200, 219)]),
      );
      expect(result.outerSpanFirstBytePos).toBe(0);
      expect(result.outerSpanLastBytePos).toBe(219);
      expect(result.spannedBytes).toBe(220);
      // gap1 = 50-29-1 = 20, gap2 = 200-99-1 = 100
      expect(result.gapBytes).toBe(120);
      expect(result.largestGapBytes).toBe(100);
      expect(result.gapCount).toBe(2);
      expect(result.averageGapBytes).toBe(60);
      expect(result.gapRatio).toBeCloseTo(120 / 220, 10);
      expect(result.refetchBytes).toBe(100);
      expect(result.contiguous).toBe(false);
      expect(result.headline).toContain("gap 2개");
    });

    it("2개 범위(rangeCount=2): gapCount=1, gap 기대값", () => {
      // ranges: 0/9, 20/29 (byteLength 10/10, refetchBytes 20)
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(20, 29)]),
      );
      expect(result.outerSpanFirstBytePos).toBe(0);
      expect(result.outerSpanLastBytePos).toBe(29);
      expect(result.spannedBytes).toBe(30);
      // gap = 20-9-1 = 10
      expect(result.gapBytes).toBe(10);
      expect(result.largestGapBytes).toBe(10);
      expect(result.gapCount).toBe(1);
      expect(result.averageGapBytes).toBe(10);
      expect(result.gapRatio).toBeCloseTo(10 / 30, 10);
      expect(result.contiguous).toBe(false);
    });

    it("동일 크기 gap: largestGapBytes === averageGapBytes", () => {
      // ranges: 0/9, 25/34, 50/59 → gap1 = 25-9-1 = 15, gap2 = 50-34-1 = 15
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(25, 34), makeRange(50, 59)]),
      );
      expect(result.gapBytes).toBe(30);
      expect(result.largestGapBytes).toBe(15);
      expect(result.averageGapBytes).toBe(15);
      expect(result.largestGapBytes).toBe(result.averageGapBytes);
    });
  });

  describe("flow / branch 분리", () => {
    it("allIntact true 분기 → 전부 0 / false 분기 → 값 존재", () => {
      const intact = summariseExportChunkRefetchGaps(
        makeBatch([], { allIntact: true }),
      );
      expect(intact.spannedBytes).toBe(0);
      expect(intact.gapBytes).toBe(0);
      const damaged = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(20, 29)]),
      );
      expect(damaged.gapBytes).toBeGreaterThan(0);
    });

    it("rangeCount === 0 분기(span/gap 단락 0) vs > 0 분기", () => {
      const empty = summariseExportChunkRefetchGaps(
        makeBatch([], { allIntact: true }),
      );
      expect(empty.outerSpanFirstBytePos).toBe(0);
      expect(empty.outerSpanLastBytePos).toBe(0);
      const nonEmpty = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(5, 14)]),
      );
      expect(nonEmpty.outerSpanFirstBytePos).toBe(5);
      expect(nonEmpty.outerSpanLastBytePos).toBe(14);
    });

    it("gapCount === 0 분기(averageGapBytes 단락 0) vs > 0 분기(나눗셈)", () => {
      const single = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9)]),
      );
      expect(single.averageGapBytes).toBe(0);
      const multi = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(20, 29)]),
      );
      expect(multi.averageGapBytes).toBeGreaterThan(0);
    });

    it("spannedBytes === 0 분기(gapRatio=0 단락) vs > 0 분기", () => {
      const empty = summariseExportChunkRefetchGaps(
        makeBatch([], { allIntact: true }),
      );
      expect(empty.gapRatio).toBe(0);
      const nonEmpty = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(20, 29)]),
      );
      expect(nonEmpty.gapRatio).toBeGreaterThan(0);
    });

    it("contiguous 분기: rangeCount=0 → true, rangeCount=1 → true, rangeCount>=2 → false", () => {
      expect(
        summariseExportChunkRefetchGaps(makeBatch([], { allIntact: true }))
          .contiguous,
      ).toBe(true);
      expect(
        summariseExportChunkRefetchGaps(makeBatch([makeRange(0, 9)]))
          .contiguous,
      ).toBe(true);
      expect(
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9), makeRange(20, 29)]),
        ).contiguous,
      ).toBe(false);
    });

    it("largestGapBytes 선택: 첫 gap 이 최대", () => {
      // gap1 = 100-9-1 = 90, gap2 = 200-110-1 = 89
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(100, 110), makeRange(200, 209)]),
      );
      expect(result.largestGapBytes).toBe(90);
    });

    it("largestGapBytes 선택: 중간 gap 이 최대", () => {
      // gap1 = 20-9-1 = 10, gap2 = 200-29-1 = 170, gap3 = 220-209-1 = 10
      const result = summariseExportChunkRefetchGaps(
        makeBatch([
          makeRange(0, 9),
          makeRange(20, 29),
          makeRange(200, 209),
          makeRange(220, 229),
        ]),
      );
      expect(result.largestGapBytes).toBe(170);
    });

    it("largestGapBytes 선택: 마지막 gap 이 최대", () => {
      // gap1 = 20-9-1 = 10, gap2 = 500-29-1 = 470
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(20, 29), makeRange(500, 509)]),
      );
      expect(result.largestGapBytes).toBe(470);
    });

    it("largestGapBytes 선택: 동일 gap → 첫 gap 유지(엄격 초과만 교체)", () => {
      const result = summariseExportChunkRefetchGaps(
        makeBatch([makeRange(0, 9), makeRange(25, 34), makeRange(50, 59)]),
      );
      expect(result.largestGapBytes).toBe(15);
    });
  });

  describe("error path — 입력 방어(TypeError)", () => {
    it("batch 이 plain object 아님(null) → TypeError(label batch)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          null as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(/batch 은 plain object/);
      expect(() =>
        summariseExportChunkRefetchGaps(
          null as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(TypeError);
    });

    it("batch 이 배열 → TypeError(받음: array)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          [] as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(/받음: array/);
    });

    it("batch 이 원시값 → TypeError", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          42 as unknown as ExportChunkRefetchBatch,
        ),
      ).toThrow(TypeError);
    });

    it("batch.allIntact 비-boolean → TypeError(label allIntact)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], {
            allIntact: "yes" as unknown as boolean,
          }),
        ),
      ).toThrow(/batch.allIntact 는 boolean/);
    });

    it("batch.failedChunkCount 비-음수정수 아님 → TypeError(label failedChunkCount)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], { failedChunkCount: -1 }),
        ),
      ).toThrow(/batch.failedChunkCount 는 0 이상의 정수/);
    });

    it("batch.rangeCount 비-음수정수 아님 → TypeError(label rangeCount)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], { rangeCount: 1.5 }),
        ),
      ).toThrow(/batch.rangeCount 는 0 이상의 정수/);
    });

    it("batch.refetchBytes 비-음수정수 아님 → TypeError(label refetchBytes)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], { refetchBytes: NaN }),
        ),
      ).toThrow(/batch.refetchBytes 는 0 이상의 정수/);
    });

    it("batch.ranges 가 배열 아님 → TypeError(label batch.ranges)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], {
            ranges: "nope" as unknown as ExportChunkRefetchRange[],
          }),
        ),
      ).toThrow(/batch.ranges 는 배열/);
    });

    it("ranges 원소가 plain object 아님 → TypeError(원소 index)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], {
            ranges: [null as unknown as ExportChunkRefetchRange],
            rangeCount: 1,
            refetchBytes: 10,
          }),
        ),
      ).toThrow(/batch.ranges\[0\] 는 plain object/);
    });

    it("ranges 원소 firstBytePos 비-음수정수 아님 → TypeError", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([], {
            allIntact: false,
            ranges: [
              {
                ...makeRange(0, 9),
                firstBytePos: -1,
              } as ExportChunkRefetchRange,
            ],
            rangeCount: 1,
            refetchBytes: 10,
            failedChunkCount: 1,
          }),
        ),
      ).toThrow(/batch.ranges\[0\].firstBytePos 는 0 이상의 정수/);
    });

    it("ranges 원소 lastBytePos 비-음수정수 아님 → TypeError", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([], {
            allIntact: false,
            ranges: [
              {
                ...makeRange(0, 9),
                lastBytePos: 9.5,
              } as ExportChunkRefetchRange,
            ],
            rangeCount: 1,
            refetchBytes: 10,
            failedChunkCount: 1,
          }),
        ),
      ).toThrow(/batch.ranges\[0\].lastBytePos 는 0 이상의 정수/);
    });

    it("ranges 원소 byteLength 비-음수정수 아님 → TypeError", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([], {
            allIntact: false,
            ranges: [
              {
                ...makeRange(0, 9),
                byteLength: "x" as unknown as number,
              } as ExportChunkRefetchRange,
            ],
            rangeCount: 1,
            refetchBytes: 10,
            failedChunkCount: 1,
          }),
        ),
      ).toThrow(/batch.ranges\[0\].byteLength 는 0 이상의 정수/);
    });
  });

  describe("error path — 계약 위반(RangeError)", () => {
    it("rangeCount !== ranges.length → RangeError(불일치)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], { rangeCount: 2 }),
        ),
      ).toThrow(RangeError);
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], { rangeCount: 2 }),
        ),
      ).toThrow(/일치하지 않습니다/);
    });

    it("allIntact=true 인데 rangeCount !== 0 → RangeError(모순)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9)], { allIntact: true }),
        ),
      ).toThrow(/allIntact 가 true 인데.*0 이 아닙니다/);
    });

    it("allIntact=false 인데 rangeCount === 0 → RangeError(모순)", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(makeBatch([], { allIntact: false })),
      ).toThrow(/allIntact 가 false 인데.*0 입니다/);
    });

    it("원소 byteLength !== lastBytePos - firstBytePos + 1 → RangeError", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([], {
            allIntact: false,
            ranges: [
              {
                firstBytePos: 0,
                lastBytePos: 9,
                byteLength: 7,
                firstChunkIndex: 0,
                lastChunkIndex: 0,
                chunkCount: 1,
              },
            ],
            rangeCount: 1,
            refetchBytes: 7,
            failedChunkCount: 1,
          }),
        ),
      ).toThrow(/byteLength.*일치하지 않습니다 — 손상된 범위/);
    });

    it("byteLength 합 !== refetchBytes → RangeError", () => {
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9), makeRange(20, 29)], {
            refetchBytes: 999,
          }),
        ),
      ).toThrow(/byteLength 합.*refetchBytes.*일치하지 않습니다/);
    });

    it("ranges 가 firstBytePos 오름차순 아님 → RangeError(겹침·연속)", () => {
      // 두 번째 범위가 첫 범위보다 앞 → 겹침/역순
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(50, 59), makeRange(0, 9)]),
        ),
      ).toThrow(/겹치거나 연속/);
    });

    it("인접 범위가 연속(gap=0, 미병합) → RangeError", () => {
      // 0/9, 10/19 → gap = 10-9-1 = 0 → 연속(병합됐어야 함)
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9), makeRange(10, 19)]),
        ),
      ).toThrow(/겹치거나 연속.*gap=0/);
    });

    it("인접 범위가 겹침(gap<0) → RangeError", () => {
      // 0/9, 5/14 → gap = 5-9-1 = -5 → 겹침
      expect(() =>
        summariseExportChunkRefetchGaps(
          makeBatch([makeRange(0, 9), makeRange(5, 14)], { refetchBytes: 20 }),
        ),
      ).toThrow(/겹치거나 연속/);
    });
  });

  describe("invariant / negative — 불변·결정성·non-mutation", () => {
    const cases: { name: string; batch: ExportChunkRefetchBatch }[] = [
      { name: "무결", batch: makeBatch([], { allIntact: true }) },
      { name: "단일", batch: makeBatch([makeRange(10, 109)]) },
      { name: "2개", batch: makeBatch([makeRange(0, 9), makeRange(20, 29)]) },
      {
        name: "다중",
        batch: makeBatch([
          makeRange(0, 29),
          makeRange(50, 99),
          makeRange(200, 219),
        ]),
      },
      {
        name: "동일gap",
        batch: makeBatch([
          makeRange(0, 9),
          makeRange(25, 34),
          makeRange(50, 59),
        ]),
      },
    ];

    it.each(cases)(
      "$name: spannedBytes === refetchBytes + gapBytes 등 불변 충족",
      ({ batch }) => {
        const r = summariseExportChunkRefetchGaps(batch);
        expect(r.spannedBytes).toBe(r.refetchBytes + r.gapBytes);
        expect(r.gapBytes).toBeGreaterThanOrEqual(0);
        expect(r.gapBytes).toBeLessThanOrEqual(r.spannedBytes);
        expect(r.gapRatio).toBeGreaterThanOrEqual(0);
        expect(r.gapRatio).toBeLessThanOrEqual(1);
        expect(r.largestGapBytes).toBeLessThanOrEqual(r.gapBytes);
        if (r.gapCount === 0) {
          expect(r.gapBytes).toBe(0);
          expect(r.largestGapBytes).toBe(0);
          expect(r.averageGapBytes).toBe(0);
          expect(r.gapRatio).toBe(0);
          expect(r.contiguous).toBe(true);
        }
        if (r.rangeCount === 1) {
          expect(r.spannedBytes).toBe(r.refetchBytes);
          expect(r.contiguous).toBe(true);
        }
        expect(r.allIntact).toBe(r.rangeCount === 0);
        if (r.rangeCount >= 2) {
          // 병합 batch 는 인접 범위 사이 최소 1 byte gap.
          expect(r.gapBytes).toBeGreaterThanOrEqual(r.rangeCount - 1);
        }
      },
    );

    it("동일 입력 2회 호출은 deep-equal (순수·결정성)", () => {
      const batch = makeBatch([makeRange(0, 9), makeRange(20, 29)]);
      expect(summariseExportChunkRefetchGaps(batch)).toEqual(
        summariseExportChunkRefetchGaps(batch),
      );
    });

    it("deepFreeze 입력을 변형하지 않음 + 반환 객체는 호출마다 새 인스턴스", () => {
      const batch = deepFreeze(
        makeBatch([makeRange(0, 29), makeRange(50, 99), makeRange(200, 219)]),
      );
      const a = summariseExportChunkRefetchGaps(batch);
      const b = summariseExportChunkRefetchGaps(batch);
      // freeze 된 입력으로도 throw 없이 동작(non-mutating).
      expect(a).toEqual(b);
      // 호출마다 새 객체.
      expect(a).not.toBe(b);
    });
  });
});
