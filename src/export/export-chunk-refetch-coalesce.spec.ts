// export-chunk-refetch-coalesce.spec — coalesceExportChunkRefetch(T-0473) 단위 테스트.
// R-112 4 종(happy / error / flow·branch / negative 충분 cover)을 채운다. UC-07 §8 NFR(chunked
// streaming 재요청 지시에서 인접 실패 chunk 를 연속 byte 범위로 병합해 재요청 Range 요청 수 최소화)
// 정합 검증. reconcile 부적합·failedChunks 비-배열·항목 손상은 TypeError, failedChunks 오름차순
// 위반·allIntact/failedChunkCount 모순은 RangeError 로 일관 거부한다(아래 describe 문자열로 박제).
import { ExportChunkIntegrityReconcile } from "./export-chunk-integrity-reconcile";
import { ExportChunk } from "./export-chunk-plan";
import {
  coalesceExportChunkRefetch,
  ExportChunkRefetchBatch,
} from "./export-chunk-refetch-coalesce";

// 테스트용 chunk 조립 helper — 균일한 size 의 chunk 를 index 목록으로부터 만든다(offset = index*size).
function makeChunk(index: number, size = 100): ExportChunk {
  return {
    index,
    offsetBytes: index * size,
    sizeBytes: size,
    last: false,
  };
}

// 테스트용 reconcile 조립 helper — failedChunks 로부터 allIntact/failedChunkCount/refetchBytes 등을
// reconcileExportChunkIntegrity 와 동일한 회계로 채운다(본 helper 는 reconcile 을 재계산하지 않으므로
// 입력 reconcile 을 명시적으로 구성). refetchBytes 는 실패 chunk sizeBytes 합.
function makeReconcile(
  failedChunks: ExportChunk[],
  overrides: Partial<ExportChunkIntegrityReconcile> = {},
): ExportChunkIntegrityReconcile {
  const failedChunkCount = failedChunks.length;
  const refetchBytes = failedChunks.reduce((s, c) => s + c.sizeBytes, 0);
  return {
    allIntact: failedChunkCount === 0,
    verifiedChunkCount: failedChunkCount,
    intactChunkCount: 0,
    failedChunkCount,
    failedChunks,
    refetchRanges: failedChunks.map((c) => ({
      firstBytePos: c.offsetBytes,
      lastBytePos: c.offsetBytes + c.sizeBytes - 1,
      totalBytes: 0,
      chunkIndex: c.index,
    })),
    refetchBytes,
    headline: "test reconcile",
    ...overrides,
  };
}

// 전 핵심 불변을 전수 검증하는 공용 단언 — chunk 회계 일치, byte 총량 보존, rangeCount 감소,
// allIntact 동치, byteLength inclusive 경계, firstBytePos 오름차순·인접 range 간 byte gap 존재.
function assertBatchInvariants(
  batch: ExportChunkRefetchBatch,
  reconcile: ExportChunkIntegrityReconcile,
): void {
  // ranges 의 chunkCount 합 === failedChunkCount(병합 전후 chunk 회계 일치).
  const chunkCountSum = batch.ranges.reduce((s, r) => s + r.chunkCount, 0);
  expect(chunkCountSum).toBe(batch.failedChunkCount);
  // refetchBytes === reconcile.refetchBytes(병합이 byte 총량 보존).
  expect(batch.refetchBytes).toBe(reconcile.refetchBytes);
  // rangeCount <= failedChunkCount(병합으로 같거나 줄어듦) + rangeCount === ranges.length.
  expect(batch.rangeCount).toBe(batch.ranges.length);
  expect(batch.rangeCount).toBeLessThanOrEqual(batch.failedChunkCount);
  // allIntact ⟺ (ranges.length === 0) ⟺ (failedChunkCount === 0) ⟺ (refetchBytes === 0).
  expect(batch.allIntact).toBe(batch.ranges.length === 0);
  expect(batch.allIntact).toBe(batch.failedChunkCount === 0);
  expect(batch.allIntact).toBe(batch.refetchBytes === 0);
  // 각 range 의 byteLength inclusive 경계 + firstChunkIndex<=lastChunkIndex + chunkCount 일관.
  let prevFirst = -1;
  let prevLast = -Infinity;
  let byteSum = 0;
  for (const r of batch.ranges) {
    expect(r.byteLength).toBe(r.lastBytePos - r.firstBytePos + 1);
    expect(r.firstChunkIndex).toBeLessThanOrEqual(r.lastChunkIndex);
    expect(r.lastChunkIndex - r.firstChunkIndex + 1).toBe(r.chunkCount);
    // firstBytePos 오름차순(엄격 증가) + 인접 range 사이 byte gap 존재(연속이면 병합됐을 것).
    expect(r.firstBytePos).toBeGreaterThan(prevFirst);
    if (prevLast !== -Infinity) {
      expect(r.firstBytePos).toBeGreaterThan(prevLast + 1);
    }
    prevFirst = r.firstBytePos;
    prevLast = r.lastBytePos;
    byteSum += r.byteLength;
  }
  expect(byteSum).toBe(batch.refetchBytes);
}

describe("coalesceExportChunkRefetch (T-0473)", () => {
  describe("happy path — 병합 결과 필드 기대값", () => {
    it("연속 실패 그룹(chunk 1·2·3) → rangeCount=1, 하나의 병합 범위", () => {
      const chunks = [makeChunk(1), makeChunk(2), makeChunk(3)];
      const reconcile = makeReconcile(chunks);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.rangeCount).toBe(1);
      expect(batch.allIntact).toBe(false);
      expect(batch.failedChunkCount).toBe(3);
      const range = batch.ranges[0];
      expect(range.firstBytePos).toBe(chunks[0].offsetBytes); // 100
      expect(range.lastBytePos).toBe(
        chunks[2].offsetBytes + chunks[2].sizeBytes - 1,
      ); // 399
      expect(range.byteLength).toBe(300); // 세 size 합
      expect(range.firstChunkIndex).toBe(1);
      expect(range.lastChunkIndex).toBe(3);
      expect(range.chunkCount).toBe(3);
      expect(batch.refetchBytes).toBe(300);
      assertBatchInvariants(batch, reconcile);
    });

    it("비연속 실패(chunk 0·2·4) → rangeCount=3, 각 chunkCount=1", () => {
      const chunks = [makeChunk(0), makeChunk(2), makeChunk(4)];
      const reconcile = makeReconcile(chunks);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.rangeCount).toBe(3);
      for (const r of batch.ranges) {
        expect(r.chunkCount).toBe(1);
        expect(r.firstChunkIndex).toBe(r.lastChunkIndex);
        expect(r.byteLength).toBe(100);
      }
      expect(batch.ranges[0].firstChunkIndex).toBe(0);
      expect(batch.ranges[1].firstChunkIndex).toBe(2);
      expect(batch.ranges[2].firstChunkIndex).toBe(4);
      assertBatchInvariants(batch, reconcile);
    });

    it("혼합(chunk 1·2·4 — 1·2 연속·4 분리) → rangeCount=2(첫 chunkCount=2, 둘째=1)", () => {
      const chunks = [makeChunk(1), makeChunk(2), makeChunk(4)];
      const reconcile = makeReconcile(chunks);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.rangeCount).toBe(2);
      expect(batch.ranges[0].chunkCount).toBe(2);
      expect(batch.ranges[0].firstChunkIndex).toBe(1);
      expect(batch.ranges[0].lastChunkIndex).toBe(2);
      expect(batch.ranges[0].byteLength).toBe(200);
      expect(batch.ranges[1].chunkCount).toBe(1);
      expect(batch.ranges[1].firstChunkIndex).toBe(4);
      expect(batch.ranges[1].byteLength).toBe(100);
      assertBatchInvariants(batch, reconcile);
    });

    it("allIntact(failedChunks=[]) → ranges=[], refetchBytes=0, rangeCount=0", () => {
      const reconcile = makeReconcile([]);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.allIntact).toBe(true);
      expect(batch.ranges).toEqual([]);
      expect(batch.rangeCount).toBe(0);
      expect(batch.refetchBytes).toBe(0);
      expect(batch.failedChunkCount).toBe(0);
      expect(batch.headline).toContain("재요청 불요");
      assertBatchInvariants(batch, reconcile);
    });
  });

  describe("경계 입력", () => {
    it("단일 실패 chunk → rangeCount=1, chunkCount=1, firstChunkIndex===lastChunkIndex", () => {
      const reconcile = makeReconcile([makeChunk(3)]);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.rangeCount).toBe(1);
      expect(batch.ranges[0].chunkCount).toBe(1);
      expect(batch.ranges[0].firstChunkIndex).toBe(3);
      expect(batch.ranges[0].lastChunkIndex).toBe(3);
      assertBatchInvariants(batch, reconcile);
    });

    it("전부 연속 실패(chunk 0·1·2·3·4 전부) → rangeCount=1, chunkCount===failedChunkCount, firstBytePos=0", () => {
      const chunks = [0, 1, 2, 3, 4].map((i) => makeChunk(i));
      const reconcile = makeReconcile(chunks);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.rangeCount).toBe(1);
      expect(batch.ranges[0].chunkCount).toBe(batch.failedChunkCount);
      expect(batch.ranges[0].firstBytePos).toBe(0);
      expect(batch.ranges[0].lastBytePos).toBe(499); // totalBytes-1 동형
      expect(batch.ranges[0].byteLength).toBe(500);
      assertBatchInvariants(batch, reconcile);
    });

    it("잔여(마지막) chunk 가 병합 그룹의 끝 — lastBytePos 산술 정확성(size 가 다른 마지막 chunk)", () => {
      // chunk 3·4 연속, chunk 4 는 잔여(size 50)로 size 가 다름.
      const c3 = makeChunk(3, 100);
      const c4: ExportChunk = {
        index: 4,
        offsetBytes: 400,
        sizeBytes: 50,
        last: true,
      };
      const reconcile = makeReconcile([c3, c4]);
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.rangeCount).toBe(1);
      expect(batch.ranges[0].firstBytePos).toBe(300);
      expect(batch.ranges[0].lastBytePos).toBe(449); // 400 + 50 - 1
      expect(batch.ranges[0].byteLength).toBe(150);
      assertBatchInvariants(batch, reconcile);
    });
  });

  describe("flow / branch 분리", () => {
    it("allIntact true 분기 vs false 분기 — ranges 빈 배열 vs 값", () => {
      const intact = coalesceExportChunkRefetch(makeReconcile([]));
      expect(intact.ranges.length).toBe(0);
      const failed = coalesceExportChunkRefetch(makeReconcile([makeChunk(0)]));
      expect(failed.ranges.length).toBeGreaterThan(0);
    });

    it("그룹 경계 분기 — 첫 chunk 만 실패 vs 마지막 chunk 만 실패(단일 그룹·단일 chunk)", () => {
      const firstOnly = coalesceExportChunkRefetch(
        makeReconcile([makeChunk(0)]),
      );
      expect(firstOnly.ranges[0].firstChunkIndex).toBe(0);
      const lastOnly = coalesceExportChunkRefetch(
        makeReconcile([makeChunk(9)]),
      );
      expect(lastOnly.ranges[0].firstChunkIndex).toBe(9);
    });

    it("중간 chunk 들만 연속 실패(chunk 2·3) → 단일 병합 그룹", () => {
      const batch = coalesceExportChunkRefetch(
        makeReconcile([makeChunk(2), makeChunk(3)]),
      );
      expect(batch.rangeCount).toBe(1);
      expect(batch.ranges[0].chunkCount).toBe(2);
    });

    it("연속 그룹 직후 비연속(chunk 0·1·3) → 새 그룹 시작(직전 index+1 !== 현재)", () => {
      const batch = coalesceExportChunkRefetch(
        makeReconcile([makeChunk(0), makeChunk(1), makeChunk(3)]),
      );
      expect(batch.rangeCount).toBe(2);
      expect(batch.ranges[0].chunkCount).toBe(2);
      expect(batch.ranges[1].chunkCount).toBe(1);
    });
  });

  describe("error path — 입력 방어(TypeError vs RangeError 구분)", () => {
    it("reconcile 이 plain object 아님(null/배열/원시) → TypeError(label reconcile)", () => {
      for (const bad of [null, undefined, 42, "x", [makeChunk(0)]]) {
        expect(() =>
          coalesceExportChunkRefetch(
            bad as unknown as ExportChunkIntegrityReconcile,
          ),
        ).toThrow(TypeError);
      }
      expect(() =>
        coalesceExportChunkRefetch(
          null as unknown as ExportChunkIntegrityReconcile,
        ),
      ).toThrow(/reconcile 은 plain object/);
    });

    it("reconcile.failedChunks 가 배열 아님 → TypeError(label, 받은 값 박제)", () => {
      const bad = makeReconcile([]);
      (bad as { failedChunks: unknown }).failedChunks = "nope";
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(TypeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /reconcile\.failedChunks 는 배열.*string/,
      );
    });

    it("failedChunks 항목이 plain object 아님 → TypeError(position 박제)", () => {
      const bad = makeReconcile([]);
      (bad as { failedChunks: unknown }).failedChunks = [42];
      (bad as { failedChunkCount: number }).failedChunkCount = 1;
      (bad as { allIntact: boolean }).allIntact = false;
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(TypeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /failedChunks\[0\] 는 plain object/,
      );
    });

    it("failedChunks 항목 index 가 비-음수정수 아님 → TypeError", () => {
      const bad = makeReconcile([{ ...makeChunk(0), index: -1 }]);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /index 는 0 이상의 정수/,
      );
    });

    it("failedChunks 항목 offsetBytes 가 비-음수정수 아님 → TypeError", () => {
      const bad = makeReconcile([{ ...makeChunk(0), offsetBytes: 1.5 }]);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /offsetBytes 는 0 이상의 정수/,
      );
    });

    it("failedChunks 항목 sizeBytes 가 비-양정수(0·음수·소수) → TypeError", () => {
      for (const badSize of [0, -10, 2.5]) {
        const bad = makeReconcile([{ ...makeChunk(0), sizeBytes: badSize }]);
        expect(() => coalesceExportChunkRefetch(bad)).toThrow(
          /sizeBytes 는 양의 정수/,
        );
      }
    });

    it("failedChunks 가 오름차순 아님(역순) → RangeError(위반 위치 박제)", () => {
      const bad = makeReconcile([makeChunk(3), makeChunk(1)]);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(RangeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(/오름차순/);
    });

    it("failedChunks 에 중복 index → RangeError(직전 index 이하)", () => {
      const bad = makeReconcile([makeChunk(2), makeChunk(2)]);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(RangeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(/index/);
    });

    it("allIntact=true 인데 failedChunks 비어있지 않음 → RangeError(모순)", () => {
      const bad = makeReconcile([makeChunk(0)], { allIntact: true });
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(RangeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /allIntact 가 true/,
      );
    });

    it("allIntact=false 인데 failedChunks 비어있음 → RangeError(모순)", () => {
      const bad = makeReconcile([], { allIntact: false });
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(RangeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /allIntact 가 false/,
      );
    });

    it("failedChunkCount 와 failedChunks.length 불일치 → RangeError", () => {
      const bad = makeReconcile([makeChunk(0)], { failedChunkCount: 5 });
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(RangeError);
      expect(() => coalesceExportChunkRefetch(bad)).toThrow(
        /일치하지 않습니다/,
      );
    });
  });

  describe("negative cases 충분 cover — 불변·비-mutating·결정성", () => {
    it("연속·비연속·혼합 전수에서 chunkCount 합 === failedChunkCount & byte 총량 보존", () => {
      const cases: ExportChunk[][] = [
        [makeChunk(0), makeChunk(1), makeChunk(2)],
        [makeChunk(0), makeChunk(2), makeChunk(4)],
        [makeChunk(1), makeChunk(2), makeChunk(4)],
        [makeChunk(0), makeChunk(1), makeChunk(3), makeChunk(4)],
      ];
      for (const chunks of cases) {
        const reconcile = makeReconcile(chunks);
        const batch = coalesceExportChunkRefetch(reconcile);
        assertBatchInvariants(batch, reconcile);
      }
    });

    it("non-mutating — deepFreeze 된 reconcile·failedChunks 입력을 변형 없이 통과", () => {
      const chunks = [makeChunk(1), makeChunk(2)].map((c) => Object.freeze(c));
      const reconcile = makeReconcile(chunks as ExportChunk[]);
      Object.freeze(reconcile.failedChunks);
      Object.freeze(reconcile);
      expect(() => coalesceExportChunkRefetch(reconcile)).not.toThrow();
      const batch = coalesceExportChunkRefetch(reconcile);
      expect(batch.failedChunkCount).toBe(2);
    });

    it("결정성 — 동일 입력 2 회 호출은 deep-equal 이면서 별개 인스턴스(!==)", () => {
      const reconcile = makeReconcile([
        makeChunk(1),
        makeChunk(2),
        makeChunk(4),
      ]);
      const a = coalesceExportChunkRefetch(reconcile);
      const b = coalesceExportChunkRefetch(reconcile);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.ranges).not.toBe(b.ranges);
      expect(a.ranges[0]).not.toBe(b.ranges[0]);
    });

    it("headline 에 병합 결과(범위 개수·byte) 요약 포함", () => {
      const batch = coalesceExportChunkRefetch(
        makeReconcile([makeChunk(1), makeChunk(2), makeChunk(4)]),
      );
      expect(batch.headline).toContain("3 개 chunk");
      expect(batch.headline).toContain("2 개");
    });
  });
});
