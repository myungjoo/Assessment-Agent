// export-chunk-stream-progress.spec — describeExportChunkStreamProgress(T-0470) 단위 테스트.
// R-112 4 종(happy / error / flow·branch / negative 충분 cover)을 채운다. UC-07 §8 NFR(chunked
// streaming 전송 진행 상태 산정) 정합 검증. 입력 plan 부적합·deliveredChunks 부적합은 TypeError,
// deliveredChunks > chunkCount 범위 위반은 RangeError 로 일관 거부한다(아래 describe 문자열로 박제).
import { ExportChunk, ExportChunkPlan } from "./export-chunk-plan";
import {
  describeExportChunkStreamProgress,
  ExportChunkStreamProgress,
} from "./export-chunk-stream-progress";

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

// 전 핵심 불변을 전수 검증하는 공용 단언 — byte/ chunk 회계 일치, complete 동치, content-range
// inclusive 경계, currentRange.totalBytes 불변.
function assertProgressInvariants(
  progress: ExportChunkStreamProgress,
  plan: ExportChunkPlan,
): void {
  // byte 회계: 전송 + 잔여 === 전체.
  expect(progress.transferredBytes + progress.remainingBytes).toBe(
    progress.totalBytes,
  );
  // chunk 회계: 전달 + 잔여 === 전체.
  expect(progress.deliveredChunks + progress.remainingChunks).toBe(
    progress.totalChunks,
  );
  // complete ⟺ (잔여 chunk 0 && 잔여 byte 0).
  expect(progress.complete).toBe(
    progress.remainingChunks === 0 && progress.remainingBytes === 0,
  );
  // currentChunk null ⟺ complete.
  expect(progress.currentChunk === null).toBe(progress.complete);
  // currentRange null ⟺ currentChunk null.
  expect(progress.currentRange === null).toBe(progress.currentChunk === null);
  // complete 면 진행률 100.
  if (progress.complete) {
    expect(progress.percentComplete).toBe(100);
  }
  // currentRange 가 있으면 inclusive 경계·instance-length 정확.
  if (progress.currentRange && progress.currentChunk) {
    expect(progress.currentRange.firstBytePos).toBe(
      progress.currentChunk.offsetBytes,
    );
    expect(progress.currentRange.lastBytePos).toBe(
      progress.currentChunk.offsetBytes + progress.currentChunk.sizeBytes - 1,
    );
    expect(progress.currentRange.totalBytes).toBe(plan.totalBytes);
    expect(progress.currentRange.chunkIndex).toBe(progress.currentChunk.index);
  }
}

describe("describeExportChunkStreamProgress", () => {
  describe("happy path — 진행 상태 산정", () => {
    it("다중 chunk 진행 중(chunkCount=3, deliveredChunks=1)의 모든 필드", () => {
      const plan = makePlan(300, 100); // chunks: [0..99], [100..199], [200..299]
      const progress = describeExportChunkStreamProgress(plan, 1);
      expect(progress.totalChunks).toBe(3);
      expect(progress.deliveredChunks).toBe(1);
      expect(progress.remainingChunks).toBe(2);
      expect(progress.transferredBytes).toBe(100);
      expect(progress.totalBytes).toBe(300);
      expect(progress.remainingBytes).toBe(200);
      expect(progress.percentComplete).toBe(33); // round(100/300*100) = 33
      expect(progress.complete).toBe(false);
      expect(progress.currentChunk).toEqual({
        index: 1,
        offsetBytes: 100,
        sizeBytes: 100,
        last: false,
      });
      expect(progress.currentRange).toEqual({
        firstBytePos: 100,
        lastBytePos: 199,
        totalBytes: 300,
        chunkIndex: 1,
      });
      expect(typeof progress.headline).toBe("string");
      assertProgressInvariants(progress, plan);
    });

    it("미시작(deliveredChunks=0, chunkCount>0) → percentComplete 0 · currentChunk chunks[0]", () => {
      const plan = makePlan(300, 100);
      const progress = describeExportChunkStreamProgress(plan, 0);
      expect(progress.deliveredChunks).toBe(0);
      expect(progress.remainingChunks).toBe(3);
      expect(progress.transferredBytes).toBe(0);
      expect(progress.remainingBytes).toBe(300);
      expect(progress.percentComplete).toBe(0);
      expect(progress.complete).toBe(false);
      expect(progress.currentChunk).toEqual({
        index: 0,
        offsetBytes: 0,
        sizeBytes: 100,
        last: false,
      });
      expect(progress.currentRange).toEqual({
        firstBytePos: 0,
        lastBytePos: 99,
        totalBytes: 300,
        chunkIndex: 0,
      });
      assertProgressInvariants(progress, plan);
    });

    it("완료(deliveredChunks=chunkCount) → complete true · currentChunk null · 100%", () => {
      const plan = makePlan(300, 100);
      const progress = describeExportChunkStreamProgress(plan, 3);
      expect(progress.deliveredChunks).toBe(3);
      expect(progress.remainingChunks).toBe(0);
      expect(progress.transferredBytes).toBe(300);
      expect(progress.remainingBytes).toBe(0);
      expect(progress.percentComplete).toBe(100);
      expect(progress.complete).toBe(true);
      expect(progress.currentChunk).toBeNull();
      expect(progress.currentRange).toBeNull();
      assertProgressInvariants(progress, plan);
    });

    it("0 byte plan(chunkCount=0, deliveredChunks=0) → complete true · 100% · 잔여 0", () => {
      const plan = makePlan(0, 100);
      const progress = describeExportChunkStreamProgress(plan, 0);
      expect(progress.totalChunks).toBe(0);
      expect(progress.deliveredChunks).toBe(0);
      expect(progress.remainingChunks).toBe(0);
      expect(progress.transferredBytes).toBe(0);
      expect(progress.totalBytes).toBe(0);
      expect(progress.remainingBytes).toBe(0);
      expect(progress.percentComplete).toBe(100);
      expect(progress.complete).toBe(true);
      expect(progress.currentChunk).toBeNull();
      expect(progress.currentRange).toBeNull();
      assertProgressInvariants(progress, plan);
    });

    it("단일 chunk plan(chunkCount=1) 의 미시작 → 완료 진행", () => {
      const plan = makePlan(50, 100); // chunks: [0..49]
      const start = describeExportChunkStreamProgress(plan, 0);
      expect(start.complete).toBe(false);
      expect(start.percentComplete).toBe(0);
      expect(start.currentChunk).toEqual({
        index: 0,
        offsetBytes: 0,
        sizeBytes: 50,
        last: true,
      });
      expect(start.currentRange).toEqual({
        firstBytePos: 0,
        lastBytePos: 49,
        totalBytes: 50,
        chunkIndex: 0,
      });
      const done = describeExportChunkStreamProgress(plan, 1);
      expect(done.complete).toBe(true);
      expect(done.transferredBytes).toBe(50);
      expect(done.percentComplete).toBe(100);
      expect(done.currentChunk).toBeNull();
      assertProgressInvariants(start, plan);
      assertProgressInvariants(done, plan);
    });
  });

  describe("error path — 입력 방어(TypeError vs RangeError 박제)", () => {
    it("plan 이 plain object 아님(null) → TypeError(label plan)", () => {
      expect(() => describeExportChunkStreamProgress(null as never, 0)).toThrow(
        TypeError,
      );
      expect(() => describeExportChunkStreamProgress(null as never, 0)).toThrow(
        /plan 은 plain object/,
      );
    });

    it("plan 이 배열 → TypeError(받은 값 array 박제)", () => {
      expect(() => describeExportChunkStreamProgress([] as never, 0)).toThrow(
        /받음: array/,
      );
    });

    it("plan 이 원시값(number) → TypeError", () => {
      expect(() => describeExportChunkStreamProgress(7 as never, 0)).toThrow(
        TypeError,
      );
    });

    it("plan.chunkCount 음수 → TypeError(받은 값 박제)", () => {
      const plan = { ...makePlan(300, 100), chunkCount: -1 };
      expect(() => describeExportChunkStreamProgress(plan as never, 0)).toThrow(
        /chunkCount 는 0 이상의 정수/,
      );
    });

    it("plan.chunkCount 소수 → TypeError", () => {
      const plan = { ...makePlan(300, 100), chunkCount: 1.5 };
      expect(() => describeExportChunkStreamProgress(plan as never, 0)).toThrow(
        /받음: 1.5/,
      );
    });

    it("plan.chunkCount NaN → TypeError", () => {
      const plan = { ...makePlan(300, 100), chunkCount: NaN };
      expect(() => describeExportChunkStreamProgress(plan as never, 0)).toThrow(
        TypeError,
      );
    });

    it("plan.totalBytes 부적합(음수) → TypeError", () => {
      const plan = { ...makePlan(300, 100), totalBytes: -10 };
      expect(() => describeExportChunkStreamProgress(plan as never, 0)).toThrow(
        /totalBytes 는 0 이상의 정수/,
      );
    });

    it("plan.chunks 가 배열 아님 → TypeError", () => {
      const plan = { ...makePlan(300, 100), chunks: "nope" };
      expect(() => describeExportChunkStreamProgress(plan as never, 0)).toThrow(
        /chunks 는 배열/,
      );
    });

    it("plan.chunks.length !== chunkCount(손상) → TypeError(불일치 박제)", () => {
      const base = makePlan(300, 100);
      const plan = { ...base, chunks: base.chunks.slice(0, 2) }; // length 2 != 3
      expect(() => describeExportChunkStreamProgress(plan as never, 0)).toThrow(
        /일치하지 않습니다/,
      );
    });

    it("deliveredChunks 음수 → TypeError(받은 값 박제)", () => {
      const plan = makePlan(300, 100);
      expect(() => describeExportChunkStreamProgress(plan, -1)).toThrow(
        /deliveredChunks 는 0 이상의 정수/,
      );
    });

    it("deliveredChunks 소수 → TypeError", () => {
      const plan = makePlan(300, 100);
      expect(() => describeExportChunkStreamProgress(plan, 1.5)).toThrow(
        TypeError,
      );
    });

    it("deliveredChunks NaN → TypeError", () => {
      const plan = makePlan(300, 100);
      expect(() => describeExportChunkStreamProgress(plan, NaN)).toThrow(
        TypeError,
      );
    });

    it("deliveredChunks Infinity → TypeError", () => {
      const plan = makePlan(300, 100);
      expect(() => describeExportChunkStreamProgress(plan, Infinity)).toThrow(
        TypeError,
      );
    });

    it("deliveredChunks 비-number(string) → TypeError", () => {
      const plan = makePlan(300, 100);
      expect(() =>
        describeExportChunkStreamProgress(plan, "2" as never),
      ).toThrow(TypeError);
    });

    it("deliveredChunks > chunkCount 초과 → RangeError(두 값 박제)", () => {
      const plan = makePlan(300, 100); // chunkCount 3
      expect(() => describeExportChunkStreamProgress(plan, 4)).toThrow(
        RangeError,
      );
      expect(() => describeExportChunkStreamProgress(plan, 4)).toThrow(
        /deliveredChunks\(4\).*chunkCount\(3\)/,
      );
    });

    it("0 byte plan 에서 deliveredChunks 0 초과 → RangeError", () => {
      const plan = makePlan(0, 100); // chunkCount 0
      expect(() => describeExportChunkStreamProgress(plan, 1)).toThrow(
        RangeError,
      );
    });
  });

  describe("flow / branch 분리", () => {
    it("complete vs 진행중 분기 — currentChunk null vs 값", () => {
      const plan = makePlan(200, 100);
      expect(
        describeExportChunkStreamProgress(plan, 1).currentChunk,
      ).not.toBeNull();
      expect(
        describeExportChunkStreamProgress(plan, 2).currentChunk,
      ).toBeNull();
    });

    it("deliveredChunks 0 / 중간 / 전체 분기 — 진행률 단조 증가", () => {
      const plan = makePlan(400, 100); // chunkCount 4
      expect(describeExportChunkStreamProgress(plan, 0).percentComplete).toBe(
        0,
      );
      expect(describeExportChunkStreamProgress(plan, 2).percentComplete).toBe(
        50,
      );
      expect(describeExportChunkStreamProgress(plan, 4).percentComplete).toBe(
        100,
      );
    });

    it("totalBytes 0 vs >0 의 percentComplete 분기 — 100 vs 산술", () => {
      expect(
        describeExportChunkStreamProgress(makePlan(0, 100), 0).percentComplete,
      ).toBe(100);
      expect(
        describeExportChunkStreamProgress(makePlan(100, 100), 0)
          .percentComplete,
      ).toBe(0);
    });

    it("잔여 chunk(마지막 chunk 가 잔여 size)에서 transferredBytes 누적 정확", () => {
      const plan = makePlan(250, 100); // chunks: 100,100,50
      const p1 = describeExportChunkStreamProgress(plan, 1);
      expect(p1.transferredBytes).toBe(100);
      const p2 = describeExportChunkStreamProgress(plan, 2);
      expect(p2.transferredBytes).toBe(200);
      const p3 = describeExportChunkStreamProgress(plan, 3);
      expect(p3.transferredBytes).toBe(250);
      expect(p3.complete).toBe(true);
      // 마지막 chunk(잔여 50)의 content-range — 직전 단계의 currentChunk.
      expect(p2.currentRange).toEqual({
        firstBytePos: 200,
        lastBytePos: 249,
        totalBytes: 250,
        chunkIndex: 2,
      });
    });
  });

  describe("negative cases 충분 cover — 불변·non-mutating·결정성", () => {
    it("전 케이스 불변(byte/chunk 회계·complete 동치·content-range 경계·totalBytes 불변)", () => {
      const plans = [
        makePlan(0, 100),
        makePlan(50, 100),
        makePlan(250, 100), // 잔여 chunk
        makePlan(300, 100),
      ];
      plans.forEach((plan) => {
        for (let d = 0; d <= plan.chunkCount; d += 1) {
          assertProgressInvariants(
            describeExportChunkStreamProgress(plan, d),
            plan,
          );
        }
      });
    });

    it("non-mutating — deepFreeze 된 입력 통과 + 입력 plan/chunks 변형 0", () => {
      const plan = makePlan(250, 100);
      Object.freeze(plan);
      Object.freeze(plan.chunks);
      plan.chunks.forEach((c) => Object.freeze(c));
      const before = JSON.stringify(plan);
      expect(() => describeExportChunkStreamProgress(plan, 1)).not.toThrow();
      expect(JSON.stringify(plan)).toBe(before);
    });

    it("반환 객체는 호출마다 새 인스턴스 — 두 호출 결과 !== 이면서 deep-equal", () => {
      const plan = makePlan(250, 100);
      const a = describeExportChunkStreamProgress(plan, 1);
      const b = describeExportChunkStreamProgress(plan, 1);
      expect(a).not.toBe(b);
      expect(a.currentChunk).not.toBe(b.currentChunk);
      expect(a.currentRange).not.toBe(b.currentRange);
      expect(a).toEqual(b);
    });

    it("currentChunk 변형이 입력 plan.chunks 에 누수되지 않음(반환은 새 chunk 객체)", () => {
      const plan = makePlan(250, 100);
      const progress = describeExportChunkStreamProgress(plan, 0);
      expect(progress.currentChunk).not.toBe(plan.chunks[0]);
      expect(progress.currentChunk).toEqual(plan.chunks[0]);
    });

    it("deliveredChunks 0→chunkCount 진행 — transferredBytes 단조 증가, 마지막에 totalBytes 일치", () => {
      const plan = makePlan(250, 100); // chunkCount 3
      let prev = -1;
      for (let d = 0; d <= plan.chunkCount; d += 1) {
        const t = describeExportChunkStreamProgress(plan, d).transferredBytes;
        expect(t).toBeGreaterThan(prev);
        prev = t;
      }
      expect(
        describeExportChunkStreamProgress(plan, plan.chunkCount)
          .transferredBytes,
      ).toBe(plan.totalBytes);
    });
  });
});
