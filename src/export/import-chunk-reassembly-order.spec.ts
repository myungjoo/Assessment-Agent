// import-chunk-reassembly-order.spec — validateImportChunkReassemblyOrder(T-0480)의 R-112 4종 test
// (happy / error / branch-flow / negative+non-mutation). UC-07 §8 NFR import 측 수신 chunk 재조립
// 순서·완전성 검증 helper 의 산정·경계·입력 방어·불변·non-mutating 을 전수 검증한다.
import {
  validateImportChunkReassemblyOrder,
  ImportChunkDescriptor,
  ImportChunkReassemblyOrderInput,
} from "./import-chunk-reassembly-order";

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

// 완전 시퀀스 helper — chunkCount 개 chunk 가 각 size byte 로 끊김 없이 0 부터 이어진 입력.
function buildCompleteInput(
  chunkCount: number,
  size: number,
): ImportChunkReassemblyOrderInput {
  const chunks: ImportChunkDescriptor[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    chunks.push({ index: i, offsetBytes: i * size, sizeBytes: size });
  }
  return { chunks, expectedTotalBytes: chunkCount * size };
}

describe("validateImportChunkReassemblyOrder", () => {
  describe("happy path — 완전·재조립 가능 시퀀스", () => {
    it("완전 정렬 3-chunk 시퀀스를 complete=true 로 판정(gap/overlap/shortfall 0)", () => {
      const result = validateImportChunkReassemblyOrder(
        buildCompleteInput(3, 10),
      );
      expect(result.complete).toBe(true);
      expect(result.outOfOrder).toBe(false);
      expect(result.receivedChunkCount).toBe(3);
      expect(result.coveredBytes).toBe(30);
      expect(result.expectedTotalBytes).toBe(30);
      expect(result.gapBytes).toBe(0);
      expect(result.overlapBytes).toBe(0);
      expect(result.byteShortfall).toBe(0);
      expect(result.missingIndexes).toEqual([]);
      expect(result.duplicateIndexes).toEqual([]);
      expect(result.nextExpectedOffset).toBe(30);
    });

    it("단일 chunk 가 전체 byte 를 덮으면 complete=true", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [{ index: 0, offsetBytes: 0, sizeBytes: 50 }],
        expectedTotalBytes: 50,
      });
      expect(result.complete).toBe(true);
      expect(result.receivedChunkCount).toBe(1);
      expect(result.coveredBytes).toBe(50);
      expect(result.nextExpectedOffset).toBe(50);
      expect(result.outOfOrder).toBe(false);
    });

    it("입력이 뒤섞여(index [1,0]) 있어도 정렬 후 완전하면 complete=true·outOfOrder=true", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      });
      expect(result.complete).toBe(true);
      expect(result.outOfOrder).toBe(true);
      expect(result.gapBytes).toBe(0);
      expect(result.overlapBytes).toBe(0);
      expect(result.nextExpectedOffset).toBe(20);
    });

    it("완전 시퀀스의 headline 은 한국어로 완전·재조립 가능을 알린다", () => {
      const result = validateImportChunkReassemblyOrder(
        buildCompleteInput(2, 8),
      );
      expect(result.headline).toContain("재조립 가능");
      expect(result.headline).toContain("16 bytes");
    });

    it("크기가 서로 다른 chunk 로도 끊김 없이 덮으면 complete=true", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 5 },
          { index: 1, offsetBytes: 5, sizeBytes: 15 },
          { index: 2, offsetBytes: 20, sizeBytes: 5 },
        ],
        expectedTotalBytes: 25,
      });
      expect(result.complete).toBe(true);
      expect(result.coveredBytes).toBe(25);
      expect(result.nextExpectedOffset).toBe(25);
    });
  });

  describe("error path — 입력 방어(부적합 입력 종류마다 분리)", () => {
    it("input 이 null 이면 TypeError(label input)", () => {
      expect(() =>
        validateImportChunkReassemblyOrder(
          null as unknown as ImportChunkReassemblyOrderInput,
        ),
      ).toThrow(TypeError);
      expect(() =>
        validateImportChunkReassemblyOrder(
          null as unknown as ImportChunkReassemblyOrderInput,
        ),
      ).toThrow(/input 은 plain object.*null/);
    });

    it("input 이 배열이면 TypeError(label input)", () => {
      expect(() =>
        validateImportChunkReassemblyOrder(
          [] as unknown as ImportChunkReassemblyOrderInput,
        ),
      ).toThrow(/input 은 plain object.*array/);
    });

    it("input 이 원시값이면 TypeError(label input)", () => {
      expect(() =>
        validateImportChunkReassemblyOrder(
          42 as unknown as ImportChunkReassemblyOrderInput,
        ),
      ).toThrow(/input 은 plain object.*number/);
    });

    it("input.chunks 가 배열이 아니면 TypeError(label chunks)", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: "nope",
          expectedTotalBytes: 10,
        } as unknown as ImportChunkReassemblyOrderInput),
      ).toThrow(/input\.chunks 는 배열/);
    });

    it("chunks[i] 가 plain object 가 아니면 TypeError(원소 index 박제)", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [null] as unknown as ImportChunkDescriptor[],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\] 는 plain object/);
    });

    it("chunks[i].index 가 음수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: -1, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.index 는 0 이상의 정수/);
    });

    it("chunks[i].index 가 NaN 이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: NaN, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.index/);
    });

    it("chunks[i].index 가 소수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 1.5, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.index/);
    });

    it("chunks[i].index 가 비-number 이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [
            {
              index: "0",
              offsetBytes: 0,
              sizeBytes: 10,
            } as unknown as ImportChunkDescriptor,
          ],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.index/);
    });

    it("chunks[i].offsetBytes 가 음수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: -5, sizeBytes: 10 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.offsetBytes 는 0 이상의 정수/);
    });

    it("chunks[i].offsetBytes 가 Infinity 이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: Infinity, sizeBytes: 10 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.offsetBytes/);
    });

    it("chunks[i].sizeBytes 가 0 이면 TypeError(≥ 1 요구)", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: 0, sizeBytes: 0 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.sizeBytes 는 1 이상의 정수/);
    });

    it("chunks[i].sizeBytes 가 음수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: 0, sizeBytes: -3 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.sizeBytes/);
    });

    it("chunks[i].sizeBytes 가 NaN 이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: 0, sizeBytes: NaN }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.sizeBytes/);
    });

    it("chunks[i].sizeBytes 가 Infinity 이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: 0, sizeBytes: Infinity }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.sizeBytes/);
    });

    it("chunks[i].sizeBytes 가 소수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [{ index: 0, offsetBytes: 0, sizeBytes: 2.5 }],
          expectedTotalBytes: 10,
        }),
      ).toThrow(/chunks\[0\]\.sizeBytes/);
    });

    it("input.expectedTotalBytes 가 음수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [],
          expectedTotalBytes: -1,
        }),
      ).toThrow(/expectedTotalBytes 는 0 이상의 정수/);
    });

    it("input.expectedTotalBytes 가 NaN 이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [],
          expectedTotalBytes: NaN,
        }),
      ).toThrow(/expectedTotalBytes/);
    });

    it("input.expectedTotalBytes 가 소수이면 TypeError", () => {
      expect(() =>
        validateImportChunkReassemblyOrder({
          chunks: [],
          expectedTotalBytes: 3.14,
        }),
      ).toThrow(/expectedTotalBytes/);
    });

    it("모든 입력 방어는 TypeError(RangeError 아님)", () => {
      try {
        validateImportChunkReassemblyOrder(
          null as unknown as ImportChunkReassemblyOrderInput,
        );
      } catch (e) {
        expect(e).toBeInstanceOf(TypeError);
        expect(e).not.toBeInstanceOf(RangeError);
      }
    });
  });

  describe("flow / branch 분리", () => {
    it("빈 chunks 분기 — complete=false, 모든 카운트 0, byteShortfall=expectedTotalBytes", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [],
        expectedTotalBytes: 100,
      });
      expect(result.complete).toBe(false);
      expect(result.receivedChunkCount).toBe(0);
      expect(result.coveredBytes).toBe(0);
      expect(result.byteShortfall).toBe(100);
      expect(result.missingIndexes).toEqual([]);
      expect(result.duplicateIndexes).toEqual([]);
      expect(result.gapBytes).toBe(0);
      expect(result.overlapBytes).toBe(0);
      expect(result.outOfOrder).toBe(false);
      expect(result.nextExpectedOffset).toBe(0);
    });

    it("빈 chunks + expectedTotalBytes 0 도 complete=false(수신 0개)", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [],
        expectedTotalBytes: 0,
      });
      expect(result.complete).toBe(false);
      expect(result.byteShortfall).toBe(0);
    });

    it("누락 index 분기 — index 0,2 수신·1 누락 → missingIndexes=[1]·complete=false", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 2, offsetBytes: 20, sizeBytes: 10 },
        ],
        expectedTotalBytes: 30,
      });
      expect(result.missingIndexes).toEqual([1]);
      expect(result.complete).toBe(false);
    });

    it("중복 index 분기 — index 0,0,1 → duplicateIndexes=[0]·complete=false", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      });
      expect(result.duplicateIndexes).toEqual([0]);
      expect(result.complete).toBe(false);
    });

    it("gap 분기 — offset0/size10 + offset20/size10 → gapBytes=10·complete=false", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 20, sizeBytes: 10 },
        ],
        expectedTotalBytes: 30,
      });
      expect(result.gapBytes).toBe(10);
      expect(result.complete).toBe(false);
    });

    it("overlap 분기 — offset0/size15 + offset10/size10 → overlapBytes=5·complete=false", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 15 },
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      });
      expect(result.overlapBytes).toBe(5);
      expect(result.complete).toBe(false);
    });

    it("outOfOrder true 분기(입력 비정렬) vs false 분기(정렬)", () => {
      const unordered = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      });
      expect(unordered.outOfOrder).toBe(true);
      const ordered = validateImportChunkReassemblyOrder(
        buildCompleteInput(2, 10),
      );
      expect(ordered.outOfOrder).toBe(false);
    });

    it("gapBytes 0 vs >0 분기", () => {
      expect(
        validateImportChunkReassemblyOrder(buildCompleteInput(2, 10)).gapBytes,
      ).toBe(0);
      const withGap = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 30, sizeBytes: 10 },
        ],
        expectedTotalBytes: 40,
      });
      expect(withGap.gapBytes).toBe(20);
    });

    it("overlapBytes 0 vs >0 분기", () => {
      expect(
        validateImportChunkReassemblyOrder(buildCompleteInput(2, 10))
          .overlapBytes,
      ).toBe(0);
      const withOverlap = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 3, sizeBytes: 10 },
        ],
        expectedTotalBytes: 13,
      });
      expect(withOverlap.overlapBytes).toBe(7);
    });

    it("byteShortfall 0(정확) vs >0(부족) 분기", () => {
      expect(
        validateImportChunkReassemblyOrder(buildCompleteInput(2, 10))
          .byteShortfall,
      ).toBe(0);
      const short = validateImportChunkReassemblyOrder({
        chunks: [{ index: 0, offsetBytes: 0, sizeBytes: 10 }],
        expectedTotalBytes: 30,
      });
      expect(short.byteShortfall).toBe(20);
      expect(short.complete).toBe(false);
    });

    it("nextExpectedOffset — 완전 시 expectedTotalBytes, 첫 gap 에서 멈춤", () => {
      const complete = validateImportChunkReassemblyOrder(
        buildCompleteInput(3, 10),
      );
      expect(complete.nextExpectedOffset).toBe(30);
      // chunk0(0..10) 다음에 offset20 으로 점프 → cursor 는 10 에서 멈춤.
      const gapped = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 20, sizeBytes: 10 },
        ],
        expectedTotalBytes: 30,
      });
      expect(gapped.nextExpectedOffset).toBe(10);
    });

    it("첫 chunk 가 offset 0 에서 시작하지 않으면 nextExpectedOffset 0 에서 멈춤·complete=false", () => {
      const result = validateImportChunkReassemblyOrder({
        chunks: [{ index: 0, offsetBytes: 5, sizeBytes: 10 }],
        expectedTotalBytes: 15,
      });
      expect(result.nextExpectedOffset).toBe(0);
      expect(result.complete).toBe(false);
    });

    it("coveredBytes 가 expected 와 같아도 gap+overlap 으로 자리가 어긋나면 complete=false", () => {
      // size 합 20 = expected 20 이나 chunk1 이 offset5(overlap5) → complete 아님.
      const result = validateImportChunkReassemblyOrder({
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 5, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      });
      expect(result.coveredBytes).toBe(20);
      expect(result.overlapBytes).toBe(5);
      expect(result.complete).toBe(false);
    });
  });

  describe("negative cases 충분 cover — 불변·non-mutation", () => {
    const cases: ImportChunkReassemblyOrderInput[] = [
      buildCompleteInput(3, 10), // 완전
      {
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 2, offsetBytes: 20, sizeBytes: 10 },
        ],
        expectedTotalBytes: 30,
      }, // 누락
      {
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 10,
      }, // 중복
      {
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 20, sizeBytes: 10 },
        ],
        expectedTotalBytes: 30,
      }, // gap
      {
        chunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 15 },
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      }, // overlap
      {
        chunks: [{ index: 0, offsetBytes: 0, sizeBytes: 5 }],
        expectedTotalBytes: 30,
      }, // 부족
      {
        chunks: [
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      }, // 비정렬
      { chunks: [], expectedTotalBytes: 100 }, // 빈
    ];

    it("불변 — coveredBytes === Σ sizeBytes 가 전 케이스 성립", () => {
      for (const input of cases) {
        const r = validateImportChunkReassemblyOrder(input);
        const sum = input.chunks.reduce((acc, c) => acc + c.sizeBytes, 0);
        expect(r.coveredBytes).toBe(sum);
      }
    });

    it("불변 — byteShortfall === max(0, expected - covered) 가 전 케이스 성립", () => {
      for (const input of cases) {
        const r = validateImportChunkReassemblyOrder(input);
        expect(r.byteShortfall).toBe(
          Math.max(0, r.expectedTotalBytes - r.coveredBytes),
        );
      }
    });

    it("불변 — gapBytes >= 0 && overlapBytes >= 0 가 전 케이스 성립", () => {
      for (const input of cases) {
        const r = validateImportChunkReassemblyOrder(input);
        expect(r.gapBytes).toBeGreaterThanOrEqual(0);
        expect(r.overlapBytes).toBeGreaterThanOrEqual(0);
      }
    });

    it("불변 — complete ⟺ (missing 0 && duplicate 0 && gap 0 && overlap 0 && covered === expected) 가 전 케이스 성립", () => {
      for (const input of cases) {
        const r = validateImportChunkReassemblyOrder(input);
        const derived =
          r.missingIndexes.length === 0 &&
          r.duplicateIndexes.length === 0 &&
          r.gapBytes === 0 &&
          r.overlapBytes === 0 &&
          r.coveredBytes === r.expectedTotalBytes &&
          r.receivedChunkCount > 0 &&
          r.nextExpectedOffset === r.expectedTotalBytes;
        expect(r.complete).toBe(derived);
      }
    });

    it("non-mutating — deepFreeze 한 입력 객체·chunks 배열·원소를 변형하지 않음", () => {
      const input = deepFreeze({
        chunks: [
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
      });
      expect(() => validateImportChunkReassemblyOrder(input)).not.toThrow();
      // 정렬은 복사본에서 — 원본 순서 보존.
      expect(input.chunks[0].index).toBe(1);
      expect(input.chunks[1].index).toBe(0);
    });

    it("순수·결정성 — 동일 입력 2회 호출은 deep-equal 이나 매번 새 인스턴스(!==)", () => {
      const input = buildCompleteInput(3, 10);
      const a = validateImportChunkReassemblyOrder(input);
      const b = validateImportChunkReassemblyOrder(input);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a.missingIndexes).not.toBe(b.missingIndexes);
      expect(a.duplicateIndexes).not.toBe(b.duplicateIndexes);
    });
  });
});
