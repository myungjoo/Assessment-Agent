// export-chunk-integrity-reconcile.spec — reconcileExportChunkIntegrity(T-0472) 단위 테스트.
// R-112 4 종(happy / error / flow·branch / negative 충분 cover)을 채운다. UC-07 §8 NFR(chunked
// streaming 수신측 per-chunk 무결성 검증 결과로부터 재요청 지시 산정) 정합 검증. 입력 plan
// 부적합·chunkIntegrity 비-배열·항목 비-boolean 은 TypeError, chunkIntegrity.length !== chunkCount
// 불일치는 RangeError 로 일관 거부한다(아래 describe 문자열로 박제).
import {
  reconcileExportChunkIntegrity,
  ExportChunkIntegrityReconcile,
} from "./export-chunk-integrity-reconcile";
import { ExportChunk, ExportChunkPlan } from "./export-chunk-plan";

// 테스트용 chunk plan 조립 helper — totalBytes/chunkSizeBytes 로부터 buildExportChunkPlan 과 동일한
// 경계를 직접 만든다(본 helper 는 plan 을 재계산하지 않으므로 입력 plan 을 명시적으로 구성).
function makePlan(totalBytes: number, chunkSizeBytes: number): ExportChunkPlan {
  const chunkCount =
    totalBytes === 0 ? 0 : Math.ceil(totalBytes / chunkSizeBytes);
  const chunks: ExportChunk[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    const offsetBytes = i * chunkSizeBytes;
    const last = i === chunkCount - 1;
    const sizeBytes = last ? totalBytes - offsetBytes : chunkSizeBytes;
    chunks.push({ index: i, offsetBytes, sizeBytes, last });
  }
  const lastChunkSizeBytes =
    chunkCount === 0 ? 0 : chunks[chunkCount - 1].sizeBytes;
  return {
    totalBytes,
    chunkSizeBytes,
    chunkCount,
    chunks,
    lastChunkSizeBytes,
    headline: `test plan ${totalBytes}/${chunkSizeBytes}`,
  };
}

// 전 핵심 불변을 전수 검증하는 공용 단언 — chunk 회계 일치, allIntact 동치, content-range inclusive
// 경계, refetchRanges.totalBytes 불변, failedChunks index 오름차순, refetchBytes <= totalBytes.
function assertReconcileInvariants(
  result: ExportChunkIntegrityReconcile,
  plan: ExportChunkPlan,
): void {
  // chunk 회계: 통과 + 실패 === 검증 대상(= chunkCount).
  expect(result.intactChunkCount + result.failedChunkCount).toBe(
    plan.chunkCount,
  );
  expect(result.verifiedChunkCount).toBe(plan.chunkCount);
  // 길이 동치: failedChunks.length === failedChunkCount === refetchRanges.length.
  expect(result.failedChunks.length).toBe(result.failedChunkCount);
  expect(result.refetchRanges.length).toBe(result.failedChunkCount);
  // allIntact ⟺ (failedChunkCount === 0) ⟺ (refetchBytes === 0) ⟺ (refetchRanges.length === 0).
  expect(result.allIntact).toBe(result.failedChunkCount === 0);
  expect(result.allIntact).toBe(result.refetchBytes === 0);
  expect(result.allIntact).toBe(result.refetchRanges.length === 0);
  // refetchBytes <= totalBytes.
  expect(result.refetchBytes).toBeLessThanOrEqual(plan.totalBytes);
  // failedChunks 는 항상 index 오름차순 + refetchBytes 는 실패 chunk size 합.
  let prevIndex = -1;
  let sizeSum = 0;
  for (let i = 0; i < result.failedChunks.length; i += 1) {
    const chunk = result.failedChunks[i];
    expect(chunk.index).toBeGreaterThan(prevIndex);
    prevIndex = chunk.index;
    sizeSum += chunk.sizeBytes;
    // refetchRanges[i] 와 failedChunks[i] 가 1:1 동순서 + content-range 수치 정확.
    const range = result.refetchRanges[i];
    expect(range.firstBytePos).toBe(chunk.offsetBytes);
    expect(range.lastBytePos).toBe(chunk.offsetBytes + chunk.sizeBytes - 1);
    expect(range.chunkIndex).toBe(chunk.index);
    expect(range.totalBytes).toBe(plan.totalBytes);
  }
  expect(result.refetchBytes).toBe(sizeSum);
}

describe("reconcileExportChunkIntegrity", () => {
  describe("happy path — 재요청 지시 산정", () => {
    it("비연속 부분 실패(chunkCount=5, false at 1·4) → allIntact false·failedChunks=[1,4]·refetchRanges 2 개·refetchBytes 합", () => {
      // 500 B / 100 B → 5 chunk(각 100). false at index 1·4.
      const plan = makePlan(500, 100);
      const integrity = [true, false, true, true, false];
      const result = reconcileExportChunkIntegrity(plan, integrity);

      expect(result.allIntact).toBe(false);
      expect(result.verifiedChunkCount).toBe(5);
      expect(result.intactChunkCount).toBe(3);
      expect(result.failedChunkCount).toBe(2);
      expect(result.failedChunks).toEqual([
        { index: 1, offsetBytes: 100, sizeBytes: 100, last: false },
        { index: 4, offsetBytes: 400, sizeBytes: 100, last: true },
      ]);
      expect(result.refetchRanges).toEqual([
        { firstBytePos: 100, lastBytePos: 199, totalBytes: 500, chunkIndex: 1 },
        { firstBytePos: 400, lastBytePos: 499, totalBytes: 500, chunkIndex: 4 },
      ]);
      expect(result.refetchBytes).toBe(200);
      expect(typeof result.headline).toBe("string");
      expect(result.headline.length).toBeGreaterThan(0);
      assertReconcileInvariants(result, plan);
    });

    it("전부 무결(chunkIntegrity 전부 true, chunkCount=3) → allIntact true·failedChunks []·refetchBytes 0·refetchRanges []", () => {
      const plan = makePlan(250, 100);
      const result = reconcileExportChunkIntegrity(plan, [true, true, true]);

      expect(result.allIntact).toBe(true);
      expect(result.verifiedChunkCount).toBe(3);
      expect(result.intactChunkCount).toBe(3);
      expect(result.failedChunkCount).toBe(0);
      expect(result.failedChunks).toEqual([]);
      expect(result.refetchRanges).toEqual([]);
      expect(result.refetchBytes).toBe(0);
      expect(result.headline).toContain("재요청 불요");
      assertReconcileInvariants(result, plan);
    });

    it("전부 손상(chunkIntegrity 전부 false, chunkCount=3) → allIntact false·failedChunks 전체·refetchBytes totalBytes·refetchRanges 전체", () => {
      // 250 B / 100 B → 3 chunk(100, 100, 50).
      const plan = makePlan(250, 100);
      const result = reconcileExportChunkIntegrity(plan, [false, false, false]);

      expect(result.allIntact).toBe(false);
      expect(result.intactChunkCount).toBe(0);
      expect(result.failedChunkCount).toBe(3);
      expect(result.failedChunks).toEqual(plan.chunks);
      expect(result.refetchBytes).toBe(250);
      expect(result.refetchRanges).toEqual([
        { firstBytePos: 0, lastBytePos: 99, totalBytes: 250, chunkIndex: 0 },
        { firstBytePos: 100, lastBytePos: 199, totalBytes: 250, chunkIndex: 1 },
        { firstBytePos: 200, lastBytePos: 249, totalBytes: 250, chunkIndex: 2 },
      ]);
      assertReconcileInvariants(result, plan);
    });

    it("0 byte plan(chunkCount=0, chunkIntegrity=[]) → allIntact true·전부 0/빈 배열", () => {
      const plan = makePlan(0, 100);
      const result = reconcileExportChunkIntegrity(plan, []);

      expect(result.allIntact).toBe(true);
      expect(result.verifiedChunkCount).toBe(0);
      expect(result.intactChunkCount).toBe(0);
      expect(result.failedChunkCount).toBe(0);
      expect(result.failedChunks).toEqual([]);
      expect(result.refetchRanges).toEqual([]);
      expect(result.refetchBytes).toBe(0);
      expect(result.headline).toContain("재요청 불요");
      assertReconcileInvariants(result, plan);
    });
  });

  describe("error path — 입력 방어(plan·chunkIntegrity 부적합 TypeError, 길이 불일치 RangeError)", () => {
    it("plan 이 plain object 아님(null) → TypeError(label plan)", () => {
      expect(() =>
        reconcileExportChunkIntegrity(null as unknown as ExportChunkPlan, []),
      ).toThrow(TypeError);
      expect(() =>
        reconcileExportChunkIntegrity(null as unknown as ExportChunkPlan, []),
      ).toThrow(/plan 은 plain object/);
    });

    it("plan 이 배열 → TypeError(label plan, 받음 array)", () => {
      expect(() =>
        reconcileExportChunkIntegrity([] as unknown as ExportChunkPlan, []),
      ).toThrow(/plan 은 plain object.*array/);
    });

    it("plan 이 원시값(number) → TypeError", () => {
      expect(() =>
        reconcileExportChunkIntegrity(5 as unknown as ExportChunkPlan, []),
      ).toThrow(TypeError);
    });

    it("plan.chunkCount 음수 → TypeError(받은 값 박제)", () => {
      const plan = { ...makePlan(250, 100), chunkCount: -1 };
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(/plan.chunkCount 는 0 이상의 정수.*-1/);
    });

    it("plan.chunkCount 소수 → TypeError", () => {
      const plan = { ...makePlan(250, 100), chunkCount: 2.5 };
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(TypeError);
    });

    it("plan.chunkCount NaN → TypeError", () => {
      const plan = { ...makePlan(250, 100), chunkCount: NaN };
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(TypeError);
    });

    it("plan.totalBytes 음수 → TypeError(받은 값 박제)", () => {
      const plan = { ...makePlan(250, 100), totalBytes: -10 };
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(/plan.totalBytes 는 0 이상의 정수.*-10/);
    });

    it("plan.totalBytes Infinity → TypeError", () => {
      const plan = { ...makePlan(250, 100), totalBytes: Infinity };
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(TypeError);
    });

    it("plan.chunks 가 배열 아님 → TypeError(받음 박제)", () => {
      const plan = {
        ...makePlan(250, 100),
        chunks: "x" as unknown as ExportChunk[],
      };
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(/plan.chunks 는 배열/);
    });

    it("plan.chunks.length !== chunkCount(손상) → TypeError(불일치 박제)", () => {
      const base = makePlan(250, 100);
      const plan = { ...base, chunks: base.chunks.slice(0, 2) }; // length 2 vs chunkCount 3
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true]),
      ).toThrow(/일치하지 않습니다.*손상된 plan/);
    });

    it("chunkIntegrity 가 배열 아님(string) → TypeError(label chunkIntegrity, 받음 박제)", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        reconcileExportChunkIntegrity(plan, "xxx" as unknown as boolean[]),
      ).toThrow(/chunkIntegrity 는 배열.*string/);
    });

    it("chunkIntegrity 가 배열 아님(null) → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        reconcileExportChunkIntegrity(plan, null as unknown as boolean[]),
      ).toThrow(/chunkIntegrity 는 배열/);
    });

    it("chunkIntegrity 항목 중 숫자 → TypeError(부적합 index·받은 값 박제)", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        reconcileExportChunkIntegrity(plan, [
          true,
          1 as unknown as boolean,
          true,
        ]),
      ).toThrow(/chunkIntegrity\[1\] 는 boolean.*1/);
    });

    it("chunkIntegrity 항목 중 문자 → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        reconcileExportChunkIntegrity(plan, [
          true,
          true,
          "ok" as unknown as boolean,
        ]),
      ).toThrow(/chunkIntegrity\[2\] 는 boolean/);
    });

    it("chunkIntegrity 항목 중 null → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        reconcileExportChunkIntegrity(plan, [
          null as unknown as boolean,
          true,
          true,
        ]),
      ).toThrow(/chunkIntegrity\[0\] 는 boolean/);
    });

    it("chunkIntegrity 항목 중 undefined → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        reconcileExportChunkIntegrity(plan, [
          true,
          undefined as unknown as boolean,
          true,
        ]),
      ).toThrow(/chunkIntegrity\[1\] 는 boolean/);
    });

    it("chunkIntegrity.length !== chunkCount(짧음) → RangeError(길이·chunkCount 박제)", () => {
      const plan = makePlan(250, 100); // chunkCount 3
      expect(() => reconcileExportChunkIntegrity(plan, [true, true])).toThrow(
        RangeError,
      );
      expect(() => reconcileExportChunkIntegrity(plan, [true, true])).toThrow(
        /chunkIntegrity.length\(2\).*chunkCount\(3\).*불일치/,
      );
    });

    it("chunkIntegrity.length !== chunkCount(김) → RangeError", () => {
      const plan = makePlan(250, 100); // chunkCount 3
      expect(() =>
        reconcileExportChunkIntegrity(plan, [true, true, true, true]),
      ).toThrow(RangeError);
    });

    it("0 byte plan 에 chunkIntegrity 비어있지 않음(length 1) → RangeError(길이 1 vs chunkCount 0)", () => {
      const plan = makePlan(0, 100); // chunkCount 0
      expect(() => reconcileExportChunkIntegrity(plan, [true])).toThrow(
        RangeError,
      );
    });
  });

  describe("flow / branch 분리", () => {
    it("allIntact true 분기 vs false 분기(failedChunks·refetchRanges·refetchBytes 빈 vs 값)", () => {
      const plan = makePlan(250, 100);
      const intact = reconcileExportChunkIntegrity(plan, [true, true, true]);
      expect(intact.failedChunks).toEqual([]);
      expect(intact.refetchRanges).toEqual([]);
      expect(intact.refetchBytes).toBe(0);

      const failed = reconcileExportChunkIntegrity(plan, [true, false, true]);
      expect(failed.failedChunks.length).toBeGreaterThan(0);
      expect(failed.refetchRanges.length).toBeGreaterThan(0);
      expect(failed.refetchBytes).toBeGreaterThan(0);
    });

    it("비연속 실패 vs 연속 실패 분기(filter 순서 보존 확인)", () => {
      const plan = makePlan(500, 100); // 5 chunk
      // 비연속: index 0·2·4 실패.
      const sparse = reconcileExportChunkIntegrity(plan, [
        false,
        true,
        false,
        true,
        false,
      ]);
      expect(sparse.failedChunks.map((c) => c.index)).toEqual([0, 2, 4]);
      // 연속: index 1·2·3 실패.
      const dense = reconcileExportChunkIntegrity(plan, [
        true,
        false,
        false,
        false,
        true,
      ]);
      expect(dense.failedChunks.map((c) => c.index)).toEqual([1, 2, 3]);
    });

    it("잔여 chunk(마지막이 잔여 size)가 실패에 포함된 경우 refetchBytes 산술 정확", () => {
      // 250 B / 100 B → chunk(100, 100, 50). index 2(잔여 50)만 실패.
      const plan = makePlan(250, 100);
      const result = reconcileExportChunkIntegrity(plan, [true, true, false]);
      expect(result.failedChunks).toEqual([
        { index: 2, offsetBytes: 200, sizeBytes: 50, last: true },
      ]);
      expect(result.refetchBytes).toBe(50);
      expect(result.refetchRanges[0]).toEqual({
        firstBytePos: 200,
        lastBytePos: 249,
        totalBytes: 250,
        chunkIndex: 2,
      });
    });

    it("첫 chunk 만 실패하는 분기", () => {
      const plan = makePlan(300, 100); // 3 chunk(100 each)
      const result = reconcileExportChunkIntegrity(plan, [false, true, true]);
      expect(result.failedChunks.map((c) => c.index)).toEqual([0]);
      expect(result.refetchRanges[0].firstBytePos).toBe(0);
      expect(result.refetchBytes).toBe(100);
    });

    it("중간 chunk 만 실패하는 분기", () => {
      const plan = makePlan(300, 100);
      const result = reconcileExportChunkIntegrity(plan, [true, false, true]);
      expect(result.failedChunks.map((c) => c.index)).toEqual([1]);
      expect(result.refetchRanges[0].firstBytePos).toBe(100);
    });

    it("마지막 chunk 만 실패하는 분기", () => {
      const plan = makePlan(300, 100);
      const result = reconcileExportChunkIntegrity(plan, [true, true, false]);
      expect(result.failedChunks.map((c) => c.index)).toEqual([2]);
      expect(result.refetchRanges[0].firstBytePos).toBe(200);
    });

    it("단일 chunk plan(chunkCount=1) 무결 분기", () => {
      const plan = makePlan(50, 100); // 단일 chunk(50 B)
      const result = reconcileExportChunkIntegrity(plan, [true]);
      expect(result.allIntact).toBe(true);
      expect(result.failedChunks).toEqual([]);
      expect(result.refetchBytes).toBe(0);
    });

    it("단일 chunk plan(chunkCount=1) 손상 분기", () => {
      const plan = makePlan(50, 100);
      const result = reconcileExportChunkIntegrity(plan, [false]);
      expect(result.allIntact).toBe(false);
      expect(result.failedChunks).toEqual([
        { index: 0, offsetBytes: 0, sizeBytes: 50, last: true },
      ]);
      expect(result.refetchBytes).toBe(50);
      expect(result.refetchRanges).toEqual([
        { firstBytePos: 0, lastBytePos: 49, totalBytes: 50, chunkIndex: 0 },
      ]);
    });
  });

  describe("negative cases 충분 cover — 불변·비-mutating·결정성", () => {
    it("전 케이스(전부 무결·전부 손상·비연속·단일)에서 핵심 불변 전수 검증", () => {
      const plan = makePlan(500, 100); // 5 chunk
      const integrities: boolean[][] = [
        [true, true, true, true, true], // 전부 무결
        [false, false, false, false, false], // 전부 손상
        [true, false, true, false, true], // 비연속
        [false, true, true, true, false], // 양 끝 실패
      ];
      for (const integrity of integrities) {
        assertReconcileInvariants(
          reconcileExportChunkIntegrity(plan, integrity),
          plan,
        );
      }
      // 잔여 chunk plan·단일 chunk plan·0 byte plan 도 전수.
      const planRem = makePlan(250, 100); // chunk(100,100,50)
      for (const integrity of [
        [true, true, true],
        [false, false, false],
        [true, true, false],
        [false, true, true],
      ]) {
        assertReconcileInvariants(
          reconcileExportChunkIntegrity(planRem, integrity),
          planRem,
        );
      }
      assertReconcileInvariants(
        reconcileExportChunkIntegrity(makePlan(50, 100), [true]),
        makePlan(50, 100),
      );
      assertReconcileInvariants(
        reconcileExportChunkIntegrity(makePlan(50, 100), [false]),
        makePlan(50, 100),
      );
      assertReconcileInvariants(
        reconcileExportChunkIntegrity(makePlan(0, 100), []),
        makePlan(0, 100),
      );
    });

    it("전부 손상 시 refetchBytes === totalBytes, 그 외 refetchBytes <= totalBytes", () => {
      const plan = makePlan(500, 100);
      const all = reconcileExportChunkIntegrity(plan, [
        false,
        false,
        false,
        false,
        false,
      ]);
      expect(all.refetchBytes).toBe(plan.totalBytes);
      const part = reconcileExportChunkIntegrity(plan, [
        true,
        false,
        true,
        false,
        true,
      ]);
      expect(part.refetchBytes).toBeLessThanOrEqual(plan.totalBytes);
      expect(part.refetchBytes).toBe(200);
    });

    it("non-mutating — deepFreeze 된 입력 plan/chunks/chunkIntegrity 를 통과하고 입력을 변형하지 않음", () => {
      const plan = makePlan(250, 100);
      Object.freeze(plan);
      Object.freeze(plan.chunks);
      plan.chunks.forEach((c) => Object.freeze(c));
      const integrity = Object.freeze([true, false, true]) as boolean[];
      const planSnapshot = JSON.parse(JSON.stringify(plan));
      const integritySnapshot = [...integrity];

      expect(() =>
        reconcileExportChunkIntegrity(plan, integrity),
      ).not.toThrow();
      // 입력 plan·chunkIntegrity 가 그대로 보존됨.
      expect(JSON.parse(JSON.stringify(plan))).toEqual(planSnapshot);
      expect(integrity).toEqual(integritySnapshot);
    });

    it("반환 객체·failedChunks 항목·refetchRanges 항목이 호출마다 새 인스턴스(두 호출 결과 !== 이면서 deep-equal)", () => {
      const plan = makePlan(250, 100);
      const a = reconcileExportChunkIntegrity(plan, [true, false, true]);
      const b = reconcileExportChunkIntegrity(plan, [true, false, true]);

      // 결과 객체는 다른 인스턴스.
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
      // failedChunks 배열·항목은 다른 인스턴스.
      expect(a.failedChunks).not.toBe(b.failedChunks);
      expect(a.failedChunks[0]).not.toBe(b.failedChunks[0]);
      // failedChunks 항목은 입력 plan.chunks 항목과 다른 인스턴스(복사본).
      expect(a.failedChunks[0]).not.toBe(plan.chunks[1]);
      expect(a.failedChunks[0]).toEqual(plan.chunks[1]);
      // refetchRanges 배열·항목도 다른 인스턴스.
      expect(a.refetchRanges).not.toBe(b.refetchRanges);
      expect(a.refetchRanges[0]).not.toBe(b.refetchRanges[0]);
      expect(a.refetchRanges[0]).toEqual(b.refetchRanges[0]);
    });

    it("failedChunks 가 항상 index 오름차순(비연속 실패)", () => {
      const plan = makePlan(500, 100); // 5 chunk
      const result = reconcileExportChunkIntegrity(plan, [
        false,
        true,
        false,
        true,
        false,
      ]);
      const indices = result.failedChunks.map((c) => c.index);
      const sorted = [...indices].sort((x, y) => x - y);
      expect(indices).toEqual(sorted);
      expect(indices).toEqual([0, 2, 4]);
    });

    it("각 refetchRange 의 lastBytePos === firstBytePos + 대응 failedChunk.sizeBytes - 1(inclusive 경계 전수)", () => {
      const plan = makePlan(250, 100); // chunk(100,100,50)
      const result = reconcileExportChunkIntegrity(plan, [false, false, false]);
      for (let i = 0; i < result.failedChunks.length; i += 1) {
        const chunk = result.failedChunks[i];
        const range = result.refetchRanges[i];
        expect(range.firstBytePos).toBe(chunk.offsetBytes);
        expect(range.lastBytePos).toBe(
          range.firstBytePos + chunk.sizeBytes - 1,
        );
        expect(range.chunkIndex).toBe(chunk.index);
        expect(range.totalBytes).toBe(plan.totalBytes);
      }
    });
  });
});
