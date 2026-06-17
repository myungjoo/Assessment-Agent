// import-chunk-dedup-plan.spec — planImportChunkDeduplication(T-0482) 의 R-112 4 종 cover:
// happy-path / error-path(부적합 입력 종류마다 분리) / flow·branch 분리 / negative(불변·non-mutating)
// 충분 cover. UC-07 §8 NFR resumable upload Import 측 중복·overlap 수신 chunk dedup 계획 helper.
import {
  ImportChunkDeduplicationInput,
  ImportChunkDeduplicationPlan,
  planImportChunkDeduplication,
} from "./import-chunk-dedup-plan";
import { ImportChunkDescriptor } from "./import-chunk-reassembly-order";

// 입력 객체·배열·각 원소를 깊게 freeze — non-mutating 검증에 쓴다(변형 시 throw).
function deepFreezeInput(
  input: ImportChunkDeduplicationInput,
): ImportChunkDeduplicationInput {
  input.receivedChunks.forEach((chunk) => Object.freeze(chunk));
  Object.freeze(input.receivedChunks);
  return Object.freeze(input);
}

// 디스크립터 생성 helper.
function chunk(
  index: number,
  offsetBytes: number,
  sizeBytes: number,
): ImportChunkDescriptor {
  return { index, offsetBytes, sizeBytes };
}

describe("planImportChunkDeduplication", () => {
  // ---- Happy-path (5+) ----

  it("중복 0 — 전부 유일 index 면 그대로 유지(폐기 0·redundant 0)", () => {
    const plan = planImportChunkDeduplication(
      deepFreezeInput({
        receivedChunks: [chunk(0, 0, 10), chunk(1, 10, 10), chunk(2, 20, 10)],
      }),
    );
    expect(plan.receivedChunkCount).toBe(3);
    expect(plan.keptChunkCount).toBe(3);
    expect(plan.discardedChunkCount).toBe(0);
    expect(plan.duplicateIndexes).toEqual([]);
    expect(plan.keptBytes).toBe(30);
    expect(plan.redundantBytes).toBe(0);
    expect(plan.overlapBytes).toBe(0);
    expect(plan.hasDuplicates).toBe(false);
  });

  it("단일 index 동일 디스크립터 3 회 재전송 — 2 개 폐기·redundantBytes 산정", () => {
    const plan = planImportChunkDeduplication(
      deepFreezeInput({
        receivedChunks: [chunk(0, 0, 8), chunk(0, 0, 8), chunk(0, 0, 8)],
      }),
    );
    expect(plan.receivedChunkCount).toBe(3);
    expect(plan.keptChunkCount).toBe(1);
    expect(plan.discardedChunkCount).toBe(2);
    expect(plan.duplicateIndexes).toEqual([0]);
    expect(plan.keptBytes).toBe(8);
    expect(plan.redundantBytes).toBe(16); // 2 * 8
    expect(plan.hasDuplicates).toBe(true);
  });

  it("뒤섞인 순서 입력 — keptChunks 가 index 오름차순으로 정렬", () => {
    const plan = planImportChunkDeduplication(
      deepFreezeInput({
        receivedChunks: [chunk(2, 20, 10), chunk(0, 0, 10), chunk(1, 10, 10)],
      }),
    );
    expect(plan.keptChunks.map((c) => c.index)).toEqual([0, 1, 2]);
  });

  it("서로 다른 index 의 byte overlap — 중복 0·overlapBytes 산정", () => {
    const plan = planImportChunkDeduplication(
      deepFreezeInput({
        // index0 [0,10), index1 [5,15) → 겹침 5 byte
        receivedChunks: [chunk(0, 0, 10), chunk(1, 5, 10)],
      }),
    );
    expect(plan.discardedChunkCount).toBe(0);
    expect(plan.hasDuplicates).toBe(false);
    expect(plan.overlapBytes).toBe(5);
  });

  it("headline 한국어 — 중복 有/無 각각 핵심 수치 포함", () => {
    const dup = planImportChunkDeduplication({
      receivedChunks: [chunk(0, 0, 4), chunk(0, 0, 4)],
    });
    expect(dup.headline).toContain("폐기");
    expect(dup.headline).toContain("redundant");

    const clean = planImportChunkDeduplication({
      receivedChunks: [chunk(0, 0, 4)],
    });
    expect(clean.headline).toContain("중복 없음");
  });

  it("중복 + overlap 동시 — 재전송 폐기 후에도 다른 index 와 겹침", () => {
    const plan = planImportChunkDeduplication(
      deepFreezeInput({
        // index0 재전송 1회 폐기 + index0[0,10) 과 index1[5,15) overlap 5
        receivedChunks: [chunk(0, 0, 10), chunk(0, 0, 10), chunk(1, 5, 10)],
      }),
    );
    expect(plan.receivedChunkCount).toBe(3);
    expect(plan.keptChunkCount).toBe(2);
    expect(plan.discardedChunkCount).toBe(1);
    expect(plan.duplicateIndexes).toEqual([0]);
    expect(plan.redundantBytes).toBe(10);
    expect(plan.overlapBytes).toBe(5);
    expect(plan.hasDuplicates).toBe(true);
  });

  it("다중 duplicate 그룹 — duplicateIndexes 오름차순·중복제거", () => {
    const plan = planImportChunkDeduplication({
      receivedChunks: [
        chunk(2, 20, 5),
        chunk(0, 0, 5),
        chunk(2, 20, 5),
        chunk(0, 0, 5),
        chunk(1, 10, 5),
      ],
    });
    expect(plan.duplicateIndexes).toEqual([0, 2]);
    expect(plan.keptChunkCount).toBe(3);
    expect(plan.discardedChunkCount).toBe(2);
  });

  // ---- Error-path (부적합 입력 종류마다 분리) ----

  it("input 이 plain object 아님(null) → TypeError(label input)", () => {
    expect(() =>
      planImportChunkDeduplication(
        null as unknown as ImportChunkDeduplicationInput,
      ),
    ).toThrow(/input 은 plain object/);
  });

  it("input 이 배열 → TypeError(받은 값 array)", () => {
    expect(() =>
      planImportChunkDeduplication(
        [] as unknown as ImportChunkDeduplicationInput,
      ),
    ).toThrow(/받음: array/);
  });

  it("input 이 원시값(number) → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication(
        7 as unknown as ImportChunkDeduplicationInput,
      ),
    ).toThrow(TypeError);
  });

  it("receivedChunks 가 배열 아님 → TypeError(label receivedChunks)", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: "nope",
      } as unknown as ImportChunkDeduplicationInput),
    ).toThrow(/input\.receivedChunks 는 배열/);
  });

  it("receivedChunks[i] 가 plain object 아님 → TypeError(index 박제)", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: [null],
      } as unknown as ImportChunkDeduplicationInput),
    ).toThrow(/receivedChunks\[0\] 는 plain object/);
  });

  it("index 가 음수 → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: [chunk(-1, 0, 10)],
      }),
    ).toThrow(/receivedChunks\[0\]\.index 는 0 이상의 정수/);
  });

  it("index 가 NaN → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(NaN, 0, 10)] }),
    ).toThrow(/\.index 는 0 이상의 정수/);
  });

  it("index 가 Infinity → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: [chunk(Infinity, 0, 10)],
      }),
    ).toThrow(/\.index 는 0 이상의 정수/);
  });

  it("index 가 소수 → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(1.5, 0, 10)] }),
    ).toThrow(/\.index 는 0 이상의 정수/);
  });

  it("index 가 비-number(문자열) → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: [{ index: "0", offsetBytes: 0, sizeBytes: 10 }],
      } as unknown as ImportChunkDeduplicationInput),
    ).toThrow(/\.index 는 0 이상의 정수/);
  });

  it("offsetBytes 가 음수 → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, -5, 10)] }),
    ).toThrow(/\.offsetBytes 는 0 이상의 정수/);
  });

  it("offsetBytes 가 NaN → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, NaN, 10)] }),
    ).toThrow(/\.offsetBytes 는 0 이상의 정수/);
  });

  it("offsetBytes 가 소수 → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, 3.14, 10)] }),
    ).toThrow(/\.offsetBytes 는 0 이상의 정수/);
  });

  it("sizeBytes 가 0 → TypeError(양의 정수)", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, 0, 0)] }),
    ).toThrow(/\.sizeBytes 는 1 이상의 정수/);
  });

  it("sizeBytes 가 음수 → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, 0, -1)] }),
    ).toThrow(/\.sizeBytes 는 1 이상의 정수/);
  });

  it("sizeBytes 가 NaN → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, 0, NaN)] }),
    ).toThrow(/\.sizeBytes 는 1 이상의 정수/);
  });

  it("sizeBytes 가 Infinity → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, 0, Infinity)] }),
    ).toThrow(/\.sizeBytes 는 1 이상의 정수/);
  });

  it("sizeBytes 가 소수 → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({ receivedChunks: [chunk(0, 0, 2.5)] }),
    ).toThrow(/\.sizeBytes 는 1 이상의 정수/);
  });

  it("같은 index 의 모순된 재전송(offset 불일치) → TypeError(index 박제)", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: [chunk(0, 0, 10), chunk(0, 5, 10)],
      }),
    ).toThrow(/index 0 가 서로 다른 byte 범위/);
  });

  it("같은 index 의 모순된 재전송(size 불일치) → TypeError", () => {
    expect(() =>
      planImportChunkDeduplication({
        receivedChunks: [chunk(1, 0, 10), chunk(1, 0, 12)],
      }),
    ).toThrow(/index 1 가 서로 다른 byte 범위/);
  });

  // ---- Flow / branch 분리 ----

  it("빈 receivedChunks 분기 — 모든 수치 0·hasDuplicates false", () => {
    const plan = planImportChunkDeduplication(
      deepFreezeInput({ receivedChunks: [] }),
    );
    expect(plan).toEqual<ImportChunkDeduplicationPlan>({
      receivedChunkCount: 0,
      keptChunks: [],
      keptChunkCount: 0,
      discardedChunkCount: 0,
      duplicateIndexes: [],
      keptBytes: 0,
      redundantBytes: 0,
      overlapBytes: 0,
      hasDuplicates: false,
      headline: expect.stringContaining("중복 없음"),
    });
  });

  it("hasDuplicates false 분기 vs true 분기", () => {
    const noDup = planImportChunkDeduplication({
      receivedChunks: [chunk(0, 0, 5)],
    });
    expect(noDup.hasDuplicates).toBe(false);
    const dup = planImportChunkDeduplication({
      receivedChunks: [chunk(0, 0, 5), chunk(0, 0, 5)],
    });
    expect(dup.hasDuplicates).toBe(true);
  });

  it("discardedChunkCount 0 분기 vs >0 분기", () => {
    expect(
      planImportChunkDeduplication({
        receivedChunks: [chunk(0, 0, 5), chunk(1, 5, 5)],
      }).discardedChunkCount,
    ).toBe(0);
    expect(
      planImportChunkDeduplication({
        receivedChunks: [chunk(0, 0, 5), chunk(0, 0, 5)],
      }).discardedChunkCount,
    ).toBe(2 - 1);
  });

  it("overlapBytes 0(겹침 없음) 분기 vs >0(겹침) 분기", () => {
    expect(
      planImportChunkDeduplication({
        receivedChunks: [chunk(0, 0, 10), chunk(1, 10, 10)],
      }).overlapBytes,
    ).toBe(0);
    expect(
      planImportChunkDeduplication({
        receivedChunks: [chunk(0, 0, 10), chunk(1, 3, 10)],
      }).overlapBytes,
    ).toBe(7); // [0,10) vs [3,13) → 7
  });

  it("tie-break — 같은 index 의 첫 등장 디스크립터를 유지", () => {
    // 동일 index·동일 범위지만 keptChunks 가 첫 등장의 값과 deep-equal 인지 확인.
    const plan = planImportChunkDeduplication({
      receivedChunks: [chunk(0, 100, 10), chunk(0, 100, 10)],
    });
    expect(plan.keptChunks).toEqual([chunk(0, 100, 10)]);
    expect(plan.keptChunkCount).toBe(1);
  });

  // ---- Negative cases 충분 cover (불변 + non-mutating) ----

  it("불변 — 다양한 케이스 전수 검증", () => {
    const inputs: ImportChunkDescriptor[][] = [
      [],
      [chunk(0, 0, 10), chunk(1, 10, 10)], // 중복 0
      [chunk(0, 0, 10), chunk(0, 0, 10), chunk(1, 10, 10)], // 중복 有
      [chunk(0, 0, 10), chunk(1, 5, 10)], // overlap 有
    ];
    for (const receivedChunks of inputs) {
      const plan = planImportChunkDeduplication({ receivedChunks });
      expect(plan.keptChunkCount + plan.discardedChunkCount).toBe(
        plan.receivedChunkCount,
      );
      const totalBytes = receivedChunks.reduce((s, c) => s + c.sizeBytes, 0);
      expect(plan.keptBytes + plan.redundantBytes).toBe(totalBytes);
      expect(plan.redundantBytes).toBeGreaterThanOrEqual(0);
      expect(plan.overlapBytes).toBeGreaterThanOrEqual(0);
      // hasDuplicates ⟺ duplicateIndexes.length > 0 ⟺ discardedChunkCount > 0
      expect(plan.hasDuplicates).toBe(plan.duplicateIndexes.length > 0);
      expect(plan.hasDuplicates).toBe(plan.discardedChunkCount > 0);
      // keptChunks 는 index 오름차순·중복 index 0
      const idxs = plan.keptChunks.map((c) => c.index);
      expect([...idxs].sort((a, b) => a - b)).toEqual(idxs);
      expect(new Set(idxs).size).toBe(idxs.length);
      expect(plan.keptChunkCount).toBe(new Set(idxs).size);
    }
  });

  it("non-mutating — deepFreeze 통과 + 호출마다 새 인스턴스(deep-equal·!==)", () => {
    const input = deepFreezeInput({
      receivedChunks: [chunk(1, 10, 10), chunk(0, 0, 10), chunk(0, 0, 10)],
    });
    const a = planImportChunkDeduplication(input);
    const b = planImportChunkDeduplication(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.keptChunks).not.toBe(b.keptChunks);
    expect(a.keptChunks[0]).not.toBe(b.keptChunks[0]);
    expect(a.duplicateIndexes).not.toBe(b.duplicateIndexes);
    // 입력 배열·원소가 변형되지 않음(첫 원소가 정렬로 뒤바뀌지 않음)
    expect(input.receivedChunks[0]).toEqual(chunk(1, 10, 10));
  });
});
