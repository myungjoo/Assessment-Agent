// import-chunk-retransmit-request.spec — buildImportChunkRetransmitRequest(T-0483)의 R-112 4종 cover:
// happy path(전부 수신·전부 누락·산발·인접·단일 누락·byte 추정·headline), error path(입력 방어 종류별),
// flow/branch 분리(expectedTotalChunks 0 vs >0·retransmitNeeded·run 병합·중복 수신·범위 밖 index),
// negative cases 충분 cover(불변 전수 검증·non-mutating·결정성).
import { ImportChunkDescriptor } from "./import-chunk-reassembly-order";
import {
  buildImportChunkRetransmitRequest,
  ImportChunkRetransmitRequestInput,
} from "./import-chunk-retransmit-request";

// 테스트 헬퍼 — index 배열로부터 표준 byte 크기의 수신 chunk 디스크립터 배열을 만든다(offset = index×size).
function makeChunks(
  indexes: number[],
  sizeBytes = 100,
): ImportChunkDescriptor[] {
  return indexes.map((index) => ({
    index,
    offsetBytes: index * sizeBytes,
    sizeBytes,
  }));
}

function makeInput(
  indexes: number[],
  expectedTotalChunks: number,
  expectedChunkSizeBytes = 100,
): ImportChunkRetransmitRequestInput {
  return {
    receivedChunks: makeChunks(indexes, expectedChunkSizeBytes),
    expectedTotalChunks,
    expectedChunkSizeBytes,
  };
}

describe("buildImportChunkRetransmitRequest — happy path", () => {
  it("전부 수신: 누락 0 → retransmitNeeded=false·runs=[]·estimatedRetransmitBytes=0", () => {
    const result = buildImportChunkRetransmitRequest(
      makeInput([0, 1, 2, 3], 4),
    );
    expect(result.retransmitNeeded).toBe(false);
    expect(result.missingIndexes).toEqual([]);
    expect(result.missingChunkCount).toBe(0);
    expect(result.runs).toEqual([]);
    expect(result.runCount).toBe(0);
    expect(result.estimatedRetransmitBytes).toBe(0);
    expect(result.receivedChunkCount).toBe(4);
    expect(result.expectedTotalChunks).toBe(4);
  });

  it("전부 누락: receivedChunks=[] && N>0 → missingIndexes=[0..N-1]·단일 run {0,N-1,N}", () => {
    const result = buildImportChunkRetransmitRequest(makeInput([], 5, 100));
    expect(result.retransmitNeeded).toBe(true);
    expect(result.missingIndexes).toEqual([0, 1, 2, 3, 4]);
    expect(result.missingChunkCount).toBe(5);
    expect(result.runs).toEqual([
      { firstIndex: 0, lastIndex: 4, chunkCount: 5 },
    ]);
    expect(result.runCount).toBe(1);
    expect(result.estimatedRetransmitBytes).toBe(500);
    expect(result.receivedChunkCount).toBe(0);
  });

  it("산발 누락: 비-연속 누락 index → 여러 run 으로 분리", () => {
    // 수신 [0,4], 기대 5 → 누락 [1,2,3] (인접 run) ... 산발 케이스로 [0,2,4] 기대 5 → 누락 [1,3]
    const result = buildImportChunkRetransmitRequest(makeInput([0, 2, 4], 5));
    expect(result.missingIndexes).toEqual([1, 3]);
    expect(result.runs).toEqual([
      { firstIndex: 1, lastIndex: 1, chunkCount: 1 },
      { firstIndex: 3, lastIndex: 3, chunkCount: 1 },
    ]);
    expect(result.runCount).toBe(2);
  });

  it("인접 누락: 연속 index 여러 개 → 하나의 run 으로 병합", () => {
    // 수신 [0,4], 기대 5 → 누락 [1,2,3] 인접 → 단일 run {1,3,3}
    const result = buildImportChunkRetransmitRequest(makeInput([0, 4], 5));
    expect(result.missingIndexes).toEqual([1, 2, 3]);
    expect(result.runs).toEqual([
      { firstIndex: 1, lastIndex: 3, chunkCount: 3 },
    ]);
    expect(result.runCount).toBe(1);
  });

  it("단일 누락: 1개 index → 단일 run chunkCount=1", () => {
    const result = buildImportChunkRetransmitRequest(makeInput([0, 1, 3], 4));
    expect(result.missingIndexes).toEqual([2]);
    expect(result.runs).toEqual([
      { firstIndex: 2, lastIndex: 2, chunkCount: 1 },
    ]);
    expect(result.runCount).toBe(1);
    expect(result.missingChunkCount).toBe(1);
  });

  it("estimatedRetransmitBytes = missingChunkCount × expectedChunkSizeBytes 산정", () => {
    const result = buildImportChunkRetransmitRequest(makeInput([0, 1], 5, 256));
    expect(result.missingChunkCount).toBe(3); // 2,3,4
    expect(result.estimatedRetransmitBytes).toBe(3 * 256);
  });

  it("headline 한국어: 재업로드 필요 시 누락 수·run 수·byte 추정 포함", () => {
    const needed = buildImportChunkRetransmitRequest(makeInput([0, 4], 5));
    expect(needed.headline).toContain("재업로드 요청");
    expect(needed.headline).toContain("3개"); // 누락 3
    expect(needed.headline).toContain("1개 요청 run");
    expect(needed.headline).toContain(
      `${needed.estimatedRetransmitBytes} bytes`,
    );

    const notNeeded = buildImportChunkRetransmitRequest(makeInput([0, 1], 2));
    expect(notNeeded.headline).toContain("재업로드 불요");
  });

  it("산발+인접 혼합: 누락 [1,2,3,5] → run [{1,3,3},{5,5,1}]", () => {
    // 수신 [0,4,6], 기대 7 → 누락 [1,2,3,5]
    const result = buildImportChunkRetransmitRequest(makeInput([0, 4, 6], 7));
    expect(result.missingIndexes).toEqual([1, 2, 3, 5]);
    expect(result.runs).toEqual([
      { firstIndex: 1, lastIndex: 3, chunkCount: 3 },
      { firstIndex: 5, lastIndex: 5, chunkCount: 1 },
    ]);
    expect(result.runCount).toBe(2);
  });
});

describe("buildImportChunkRetransmitRequest — error path (입력 방어)", () => {
  it("input 이 plain object 아님(null) → TypeError(label input)", () => {
    expect(() =>
      buildImportChunkRetransmitRequest(
        null as unknown as ImportChunkRetransmitRequestInput,
      ),
    ).toThrow(/input 은 plain object.*null/);
  });

  it("input 이 배열 → TypeError(label input, array 박제)", () => {
    expect(() =>
      buildImportChunkRetransmitRequest(
        [] as unknown as ImportChunkRetransmitRequestInput,
      ),
    ).toThrow(/input 은 plain object.*array/);
  });

  it("input 이 원시값(number) → TypeError(label input, number 박제)", () => {
    expect(() =>
      buildImportChunkRetransmitRequest(
        42 as unknown as ImportChunkRetransmitRequestInput,
      ),
    ).toThrow(/input 은 plain object.*number/);
  });

  it("receivedChunks 가 배열 아님 → TypeError(label receivedChunks)", () => {
    expect(() =>
      buildImportChunkRetransmitRequest({
        receivedChunks: "nope",
        expectedTotalChunks: 3,
        expectedChunkSizeBytes: 100,
      } as unknown as ImportChunkRetransmitRequestInput),
    ).toThrow(/receivedChunks 는 배열.*string/);
  });

  it("receivedChunks[i] 가 plain object 아님 → TypeError(index 박제)", () => {
    expect(() =>
      buildImportChunkRetransmitRequest({
        receivedChunks: [null],
        expectedTotalChunks: 3,
        expectedChunkSizeBytes: 100,
      } as unknown as ImportChunkRetransmitRequestInput),
    ).toThrow(/receivedChunks\[0\] 는 plain object.*null/);
  });

  it.each([
    ["음수", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["소수", 1.5],
    ["비-number", "0"],
  ])(
    "receivedChunks[i].index 가 비-음수정수 아님(%s) → TypeError",
    (_label, bad) => {
      expect(() =>
        buildImportChunkRetransmitRequest({
          receivedChunks: [{ index: bad, offsetBytes: 0, sizeBytes: 100 }],
          expectedTotalChunks: 3,
          expectedChunkSizeBytes: 100,
        } as unknown as ImportChunkRetransmitRequestInput),
      ).toThrow(/receivedChunks\[0\]\.index 는 0 이상의 정수/);
    },
  );

  it.each([
    ["음수", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["소수", 2.2],
    ["비-number", "x"],
  ])(
    "receivedChunks[i].offsetBytes 가 비-음수정수 아님(%s) → TypeError",
    (_label, bad) => {
      expect(() =>
        buildImportChunkRetransmitRequest({
          receivedChunks: [{ index: 0, offsetBytes: bad, sizeBytes: 100 }],
          expectedTotalChunks: 3,
          expectedChunkSizeBytes: 100,
        } as unknown as ImportChunkRetransmitRequestInput),
      ).toThrow(/receivedChunks\[0\]\.offsetBytes 는 0 이상의 정수/);
    },
  );

  it.each([
    ["0", 0],
    ["음수", -5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["소수", 3.3],
    ["비-number", "y"],
  ])(
    "receivedChunks[i].sizeBytes 가 양의정수(≥1) 아님(%s) → TypeError",
    (_label, bad) => {
      expect(() =>
        buildImportChunkRetransmitRequest({
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: bad }],
          expectedTotalChunks: 3,
          expectedChunkSizeBytes: 100,
        } as unknown as ImportChunkRetransmitRequestInput),
      ).toThrow(/receivedChunks\[0\]\.sizeBytes 는 1 이상의 정수/);
    },
  );

  it.each([
    ["음수", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["소수", 2.5],
    ["비-number", "3"],
  ])(
    "expectedTotalChunks 가 비-음수정수 아님(%s) → TypeError",
    (_label, bad) => {
      expect(() =>
        buildImportChunkRetransmitRequest({
          receivedChunks: [],
          expectedTotalChunks: bad,
          expectedChunkSizeBytes: 100,
        } as unknown as ImportChunkRetransmitRequestInput),
      ).toThrow(/expectedTotalChunks 는 0 이상의 정수/);
    },
  );

  it.each([
    ["0", 0],
    ["음수", -10],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["소수", 4.4],
    ["비-number", "100"],
  ])(
    "expectedChunkSizeBytes 가 양의정수(≥1) 아님(%s) → TypeError",
    (_label, bad) => {
      expect(() =>
        buildImportChunkRetransmitRequest({
          receivedChunks: [],
          expectedTotalChunks: 3,
          expectedChunkSizeBytes: bad,
        } as unknown as ImportChunkRetransmitRequestInput),
      ).toThrow(/expectedChunkSizeBytes 는 1 이상의 정수/);
    },
  );
});

describe("buildImportChunkRetransmitRequest — flow / branch 분리", () => {
  it("expectedTotalChunks=0 분기: receivedChunks 무관 → retransmitNeeded=false", () => {
    const result = buildImportChunkRetransmitRequest({
      receivedChunks: makeChunks([0, 1, 2]),
      expectedTotalChunks: 0,
      expectedChunkSizeBytes: 100,
    });
    expect(result.retransmitNeeded).toBe(false);
    expect(result.missingIndexes).toEqual([]);
    expect(result.runs).toEqual([]);
    expect(result.estimatedRetransmitBytes).toBe(0);
    expect(result.expectedTotalChunks).toBe(0);
  });

  it("expectedTotalChunks>0 + retransmitNeeded true vs false 분기", () => {
    expect(
      buildImportChunkRetransmitRequest(makeInput([0, 1], 2)).retransmitNeeded,
    ).toBe(false);
    expect(
      buildImportChunkRetransmitRequest(makeInput([0], 2)).retransmitNeeded,
    ).toBe(true);
  });

  it("run 병합 분기: 인접 누락 1 run vs 산발 누락 N run", () => {
    expect(
      buildImportChunkRetransmitRequest(makeInput([0, 4], 5)).runCount,
    ).toBe(1);
    expect(
      buildImportChunkRetransmitRequest(makeInput([0, 2, 4], 5)).runCount,
    ).toBe(2);
  });

  it("수신 index 중복 분기: 같은 index 2회 수신해도 missingIndexes 불변·receivedChunkCount 는 distinct", () => {
    const result = buildImportChunkRetransmitRequest({
      receivedChunks: makeChunks([0, 0, 1, 1, 1]),
      expectedTotalChunks: 4,
      expectedChunkSizeBytes: 100,
    });
    expect(result.receivedChunkCount).toBe(2); // distinct {0,1}
    expect(result.missingIndexes).toEqual([2, 3]);
  });

  it("범위 밖 수신 index 분기: expectedTotalChunks 이상 index 는 누락 판정에 무영향", () => {
    // 수신 [0,1,9], 기대 3 → 9 는 범위 밖, 누락 [2]
    const result = buildImportChunkRetransmitRequest(makeInput([0, 1, 9], 3));
    expect(result.missingIndexes).toEqual([2]);
    expect(result.receivedChunkCount).toBe(3); // distinct {0,1,9}
  });
});

describe("buildImportChunkRetransmitRequest — negative cases 충분 cover (불변·non-mutating·결정성)", () => {
  const cases: Array<[string, ImportChunkRetransmitRequestInput]> = [
    ["전부수신", makeInput([0, 1, 2, 3], 4)],
    ["전부누락", makeInput([], 4)],
    ["산발누락", makeInput([0, 2, 4], 5)],
    ["인접누락", makeInput([0, 4, 6], 7)],
    ["빈입력(expectedTotalChunks=0)", makeInput([], 0)],
  ];

  it.each(cases)("불변 전수 검증 — %s", (_label, input) => {
    const r = buildImportChunkRetransmitRequest(input);
    // missingChunkCount === missingIndexes.length
    expect(r.missingChunkCount).toBe(r.missingIndexes.length);
    // runs 의 chunkCount 합 === missingChunkCount
    expect(r.runs.reduce((s, run) => s + run.chunkCount, 0)).toBe(
      r.missingChunkCount,
    );
    // runCount === runs.length
    expect(r.runCount).toBe(r.runs.length);
    // retransmitNeeded ⟺ missingChunkCount > 0 ⟺ runCount > 0
    expect(r.retransmitNeeded).toBe(r.missingChunkCount > 0);
    expect(r.retransmitNeeded).toBe(r.runCount > 0);
    // 각 run: firstIndex ≤ lastIndex && chunkCount === lastIndex - firstIndex + 1
    for (const run of r.runs) {
      expect(run.firstIndex).toBeLessThanOrEqual(run.lastIndex);
      expect(run.chunkCount).toBe(run.lastIndex - run.firstIndex + 1);
    }
    // runs 는 firstIndex 오름차순 + 인접 run 끼리 비-연속(run 사이에 최소 1개 수신 index)
    for (let i = 1; i < r.runs.length; i += 1) {
      expect(r.runs[i].firstIndex).toBeGreaterThan(r.runs[i - 1].lastIndex + 1);
    }
    // estimatedRetransmitBytes === missingChunkCount × expectedChunkSizeBytes
    expect(r.estimatedRetransmitBytes).toBe(
      r.missingChunkCount * input.expectedChunkSizeBytes,
    );
    // retransmitNeeded=false 이면 runs=[] && missingIndexes=[] && estimatedRetransmitBytes=0
    if (!r.retransmitNeeded) {
      expect(r.runs).toEqual([]);
      expect(r.missingIndexes).toEqual([]);
      expect(r.estimatedRetransmitBytes).toBe(0);
    }
  });

  it("non-mutating: 입력 객체·receivedChunks 배열·각 원소 deepFreeze 통과", () => {
    const chunks = makeChunks([0, 2]).map((c) => Object.freeze(c));
    const input = Object.freeze({
      receivedChunks: Object.freeze(chunks) as ImportChunkDescriptor[],
      expectedTotalChunks: 4,
      expectedChunkSizeBytes: 100,
    });
    expect(() => buildImportChunkRetransmitRequest(input)).not.toThrow();
    const r = buildImportChunkRetransmitRequest(input);
    expect(r.missingIndexes).toEqual([1, 3]);
    // 입력 배열 길이·원소 보존
    expect(input.receivedChunks).toHaveLength(2);
  });

  it("결정성·새 인스턴스: 두 호출 결과는 deep-equal 이면서 !== (반환 객체·runs·원소 모두 새 것)", () => {
    const input = makeInput([0, 4, 6], 7);
    const a = buildImportChunkRetransmitRequest(input);
    const b = buildImportChunkRetransmitRequest(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.runs).not.toBe(b.runs);
    expect(a.runs[0]).not.toBe(b.runs[0]);
    expect(a.missingIndexes).not.toBe(b.missingIndexes);
  });
});
