// export-chunk-plan.spec — buildExportChunkPlan(T-0469) 단위 테스트. R-112 4 종(happy / error /
// flow·branch / negative 충분 cover)을 채운다. UC-07 §8 NFR(chunked streaming 의 실제 chunk
// 경계 산정) 정합 검증. maxChunks 초과 시의 정책은 cap 적용이 아니라 RangeError 거부다(아래
// describe 문자열로 박제). chunkSizeBytes 부적합은 RangeError 로 일관 거부한다(0 나누기 방지).
import {
  buildExportChunkPlan,
  ExportChunk,
  ExportChunkPlan,
} from "./export-chunk-plan";
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";

// 테스트용 estimate 조립 helper — estimatedBytes 만 의미가 있다. 본 helper 가 쓰지 않는 필드는
// 형식만 채운다.
function makeEstimate(
  over: Partial<ExportDumpSizeEstimate> = {},
): ExportDumpSizeEstimate {
  return {
    estimatedBytes: 300,
    humanSize: "300 B",
    recordTotal: 3,
    perEntityBytes: {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    large: false,
    recommendation: "sync",
    guidanceLines: [],
    ...over,
  };
}

// chunk 경계 불변을 전수 검증하는 공용 단언 — sum === totalBytes, 연속(gap/overlap 0), 마지막 외
// full chunk, last 플래그, chunks.length === chunkCount, lastChunkSizeBytes 범위.
function assertChunkInvariants(plan: ExportChunkPlan): void {
  expect(plan.chunks.length).toBe(plan.chunkCount);
  if (plan.chunkCount === 0) {
    expect(plan.chunks).toEqual([]);
    expect(plan.lastChunkSizeBytes).toBe(0);
    return;
  }
  let sum = 0;
  let expectedOffset = 0;
  plan.chunks.forEach((chunk: ExportChunk, i: number) => {
    expect(chunk.index).toBe(i);
    // 인접 chunk 연속 — offset 은 직전 offset+size 와 정확히 일치(gap/overlap 0).
    expect(chunk.offsetBytes).toBe(expectedOffset);
    const isLast = i === plan.chunkCount - 1;
    expect(chunk.last).toBe(isLast);
    if (!isLast) {
      // 마지막 외 모든 chunk 는 full chunkSize.
      expect(chunk.sizeBytes).toBe(plan.chunkSizeBytes);
    }
    expectedOffset += chunk.sizeBytes;
    sum += chunk.sizeBytes;
  });
  // 소실·중복 byte 0.
  expect(sum).toBe(plan.totalBytes);
  // 마지막 chunk byte 정합 + 0 < lastChunkSizeBytes <= chunkSizeBytes.
  expect(plan.lastChunkSizeBytes).toBe(
    plan.chunks[plan.chunkCount - 1].sizeBytes,
  );
  expect(plan.lastChunkSizeBytes).toBeGreaterThan(0);
  expect(plan.lastChunkSizeBytes).toBeLessThanOrEqual(plan.chunkSizeBytes);
}

describe("buildExportChunkPlan — happy path", () => {
  it("배수 케이스: totalBytes=300·chunkSize=100 → chunkCount=3·각 sizeBytes=100·offset 0/100/200·last=index2", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 300 }),
      100,
    );
    expect(plan.totalBytes).toBe(300);
    expect(plan.chunkSizeBytes).toBe(100);
    expect(plan.chunkCount).toBe(3);
    expect(plan.chunks).toEqual([
      { index: 0, offsetBytes: 0, sizeBytes: 100, last: false },
      { index: 1, offsetBytes: 100, sizeBytes: 100, last: false },
      { index: 2, offsetBytes: 200, sizeBytes: 100, last: true },
    ]);
    // 배수면 마지막 chunk 도 full chunkSize(빈 추가 chunk 금지).
    expect(plan.lastChunkSizeBytes).toBe(100);
    expect(plan.headline).toContain("3 개 chunk");
    assertChunkInvariants(plan);
  });

  it("잔여 케이스: totalBytes=250·chunkSize=100 → chunkCount=3·sizeBytes 100/100/50·lastChunkSizeBytes=50", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 250 }),
      100,
    );
    expect(plan.chunkCount).toBe(3);
    expect(plan.chunks.map((c) => c.sizeBytes)).toEqual([100, 100, 50]);
    expect(plan.chunks.map((c) => c.offsetBytes)).toEqual([0, 100, 200]);
    expect(plan.lastChunkSizeBytes).toBe(50);
    assertChunkInvariants(plan);
  });

  it("단일 chunk 케이스: totalBytes <= chunkSize → chunkCount=1·sizeBytes===totalBytes·last=true", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 80 }),
      100,
    );
    expect(plan.chunkCount).toBe(1);
    expect(plan.chunks).toEqual([
      { index: 0, offsetBytes: 0, sizeBytes: 80, last: true },
    ]);
    expect(plan.lastChunkSizeBytes).toBe(80);
    assertChunkInvariants(plan);
  });

  it("경계 케이스: totalBytes === chunkSize → 단일 full chunk(빈 추가 chunk 금지)", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 100 }),
      100,
    );
    expect(plan.chunkCount).toBe(1);
    expect(plan.chunks).toEqual([
      { index: 0, offsetBytes: 0, sizeBytes: 100, last: true },
    ]);
    expect(plan.lastChunkSizeBytes).toBe(100);
    assertChunkInvariants(plan);
  });

  it("0 byte 케이스: totalBytes=0 → chunkCount=0·chunks=[]·lastChunkSizeBytes=0", () => {
    const plan = buildExportChunkPlan(makeEstimate({ estimatedBytes: 0 }), 100);
    expect(plan.chunkCount).toBe(0);
    expect(plan.chunks).toEqual([]);
    expect(plan.lastChunkSizeBytes).toBe(0);
    expect(plan.headline).toContain("0 B");
    assertChunkInvariants(plan);
  });
});

describe("buildExportChunkPlan — error path (입력 방어)", () => {
  it("estimate 가 plain object 아님(null) → TypeError(label estimate)", () => {
    expect(() =>
      buildExportChunkPlan(null as unknown as ExportDumpSizeEstimate, 100),
    ).toThrow(TypeError);
    expect(() =>
      buildExportChunkPlan(null as unknown as ExportDumpSizeEstimate, 100),
    ).toThrow(/estimate/);
  });

  it("estimate 가 배열 → TypeError(받은 값 array 박제)", () => {
    expect(() =>
      buildExportChunkPlan([] as unknown as ExportDumpSizeEstimate, 100),
    ).toThrow(/array/);
  });

  it("estimate 가 원시값(number) → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(5 as unknown as ExportDumpSizeEstimate, 100),
    ).toThrow(TypeError);
  });

  it("estimatedBytes 음수 → TypeError(받은 값 박제)", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate({ estimatedBytes: -1 }), 100),
    ).toThrow(/-1/);
  });

  it("estimatedBytes 소수 → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate({ estimatedBytes: 1.5 }), 100),
    ).toThrow(TypeError);
  });

  it("estimatedBytes NaN → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate({ estimatedBytes: NaN }), 100),
    ).toThrow(TypeError);
  });

  it("estimatedBytes Infinity → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate({ estimatedBytes: Infinity }), 100),
    ).toThrow(TypeError);
  });

  it("estimatedBytes 비-number(string) → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(
        makeEstimate({ estimatedBytes: "300" as unknown as number }),
        100,
      ),
    ).toThrow(TypeError);
  });

  it("chunkSizeBytes=0(0 나누기 방지) → RangeError(받은 값 0 박제)", () => {
    expect(() => buildExportChunkPlan(makeEstimate(), 0)).toThrow(RangeError);
    expect(() => buildExportChunkPlan(makeEstimate(), 0)).toThrow(/받음: 0/);
  });

  it("chunkSizeBytes 음수 → RangeError", () => {
    expect(() => buildExportChunkPlan(makeEstimate(), -100)).toThrow(
      RangeError,
    );
  });

  it("chunkSizeBytes 소수 → RangeError", () => {
    expect(() => buildExportChunkPlan(makeEstimate(), 10.5)).toThrow(
      RangeError,
    );
  });

  it("chunkSizeBytes NaN → RangeError", () => {
    expect(() => buildExportChunkPlan(makeEstimate(), NaN)).toThrow(RangeError);
  });

  it("chunkSizeBytes Infinity → RangeError", () => {
    expect(() => buildExportChunkPlan(makeEstimate(), Infinity)).toThrow(
      RangeError,
    );
  });

  it("chunkSizeBytes 비-number(string) → RangeError", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate(), "100" as unknown as number),
    ).toThrow(RangeError);
  });

  it("options 가 비-object(배열) → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(
        makeEstimate(),
        100,
        [] as unknown as Record<string, never>,
      ),
    ).toThrow(TypeError);
  });

  it("options 가 null → TypeError", () => {
    expect(() =>
      buildExportChunkPlan(
        makeEstimate(),
        100,
        null as unknown as Record<string, never>,
      ),
    ).toThrow(TypeError);
  });

  it("maxChunks 부적합(0) → RangeError", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate(), 100, { maxChunks: 0 }),
    ).toThrow(RangeError);
  });

  it("maxChunks 부적합(소수) → RangeError", () => {
    expect(() =>
      buildExportChunkPlan(makeEstimate(), 100, { maxChunks: 2.5 }),
    ).toThrow(RangeError);
  });

  it("산정된 chunkCount > maxChunks → RangeError(개수·상한 박제)", () => {
    // totalBytes=300·chunkSize=100 → chunkCount 3 > maxChunks 2.
    expect(() =>
      buildExportChunkPlan(makeEstimate({ estimatedBytes: 300 }), 100, {
        maxChunks: 2,
      }),
    ).toThrow(/3.*2|2.*3/);
  });
});

describe("buildExportChunkPlan — flow / branch 분리", () => {
  it("배수 분기: 마지막 chunk 가 full(잔여 아님)", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 200 }),
      100,
    );
    expect(plan.lastChunkSizeBytes).toBe(100);
  });

  it("잔여 분기: 마지막 chunk 가 잔여", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 150 }),
      100,
    );
    expect(plan.lastChunkSizeBytes).toBe(50);
  });

  it("last 플래그 분기: 첫·중간 chunk last=false, 마지막만 true", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 350 }),
      100,
    );
    expect(plan.chunks.map((c) => c.last)).toEqual([false, false, false, true]);
  });

  it("options 미지정 분기: maxChunks 없으면 cap 없이 산정", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 1000 }),
      100,
    );
    expect(plan.chunkCount).toBe(10);
  });

  it("maxChunks 지정 분기: chunkCount === maxChunks 면 통과(초과 아님)", () => {
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: 300 }),
      100,
      {
        maxChunks: 3,
      },
    );
    expect(plan.chunkCount).toBe(3);
  });
});

describe("buildExportChunkPlan — negative cases 충분 cover", () => {
  it("불변 전수 검증: 배수·잔여·단일·0 케이스 모두 sum·연속·full·범위 충족", () => {
    [0, 50, 100, 150, 250, 300, 999, 1000].forEach((bytes) => {
      const plan = buildExportChunkPlan(
        makeEstimate({ estimatedBytes: bytes }),
        100,
      );
      assertChunkInvariants(plan);
    });
  });

  it("non-mutating: 입력 estimate 변형 0(freeze 입력 통과)", () => {
    const estimate = Object.freeze(makeEstimate({ estimatedBytes: 250 }));
    const snapshot = JSON.stringify(estimate);
    const plan = buildExportChunkPlan(estimate, 100);
    expect(plan.chunkCount).toBe(3);
    // 입력 변형 0.
    expect(JSON.stringify(estimate)).toBe(snapshot);
  });

  it("순수·결정성: 동일 입력 2 회 호출 결과는 deep-equal 이면서 별 인스턴스(!==)", () => {
    const estimate = makeEstimate({ estimatedBytes: 250 });
    const a = buildExportChunkPlan(estimate, 100);
    const b = buildExportChunkPlan(estimate, 100);
    expect(a).toEqual(b);
    // 반환 객체·배열은 호출마다 새 인스턴스.
    expect(a).not.toBe(b);
    expect(a.chunks).not.toBe(b.chunks);
    expect(a.chunks[0]).not.toBe(b.chunks[0]);
  });

  it("큰 totalBytes·작은 chunkSize: chunkCount === Math.ceil(total/chunkSize) 정확", () => {
    const total = 1_000_003;
    const size = 1000;
    const plan = buildExportChunkPlan(
      makeEstimate({ estimatedBytes: total }),
      size,
    );
    expect(plan.chunkCount).toBe(Math.ceil(total / size));
    expect(plan.lastChunkSizeBytes).toBe(total % size);
    assertChunkInvariants(plan);
  });
});
