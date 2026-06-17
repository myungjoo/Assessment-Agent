// export-chunk-resume-plan.spec — buildExportChunkResumePlan(T-0471) 단위 테스트. R-112 4 종(happy /
// error / flow·branch / negative 충분 cover)을 채운다. UC-07 §8 NFR(chunked streaming 중단 후 재개
// 지시 산정) 정합 검증. 입력 plan 부적합·acknowledgedChunks 부적합은 TypeError, acknowledgedChunks >
// chunkCount 범위 위반은 RangeError 로 일관 거부한다(아래 describe 문자열로 박제).
import { ExportChunk, ExportChunkPlan } from "./export-chunk-plan";
import {
  buildExportChunkResumePlan,
  ExportChunkResumePlan,
} from "./export-chunk-resume-plan";

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

// 전 핵심 불변을 전수 검증하는 공용 단언 — byte/chunk 회계 일치, resumeNeeded 동치, content-range
// inclusive 경계, resumeRange.totalBytes 불변, 재개 byte 가 첫 잔여 chunk 시작과 일치.
function assertResumeInvariants(
  resume: ExportChunkResumePlan,
  plan: ExportChunkPlan,
): void {
  // byte 회계: ack + 잔여 === 전체.
  expect(resume.acknowledgedBytes + resume.remainingBytes).toBe(
    plan.totalBytes,
  );
  // chunk 회계: ack + 잔여 === 전체.
  expect(resume.acknowledgedChunks + resume.remainingChunkCount).toBe(
    plan.chunkCount,
  );
  // remainingChunks 배열 길이 === remainingChunkCount.
  expect(resume.remainingChunks.length).toBe(resume.remainingChunkCount);
  // resumeNeeded ⟺ (잔여 chunk > 0).
  expect(resume.resumeNeeded).toBe(resume.remainingChunkCount > 0);
  // resumeRange null ⟺ !resumeNeeded.
  expect(resume.resumeRange === null).toBe(!resume.resumeNeeded);
  // resumeFromByte 는 항상 acknowledgedBytes 와 일치.
  expect(resume.resumeFromByte).toBe(resume.acknowledgedBytes);
  if (resume.resumeNeeded) {
    // 재개 byte 가 첫 잔여 chunk 시작과 일치.
    expect(resume.resumeFromByte).toBe(resume.remainingChunks[0].offsetBytes);
    // resumeRange inclusive 경계·instance-length·chunkIndex 정확.
    expect(resume.resumeRange).not.toBeNull();
    expect(resume.resumeRange!.firstBytePos).toBe(
      resume.remainingChunks[0].offsetBytes,
    );
    expect(resume.resumeRange!.lastBytePos).toBe(
      resume.remainingChunks[0].offsetBytes +
        resume.remainingChunks[0].sizeBytes -
        1,
    );
    expect(resume.resumeRange!.firstBytePos).toBe(resume.resumeFromByte);
    expect(resume.resumeRange!.totalBytes).toBe(plan.totalBytes);
    expect(resume.resumeRange!.chunkIndex).toBe(
      resume.remainingChunks[0].index,
    );
  } else {
    // 재개 불요면 잔여 0·resumeFromByte === totalBytes·remainingBytes 0.
    expect(resume.remainingChunkCount).toBe(0);
    expect(resume.remainingChunks).toEqual([]);
    expect(resume.remainingBytes).toBe(0);
    expect(resume.resumeFromByte).toBe(plan.totalBytes);
  }
}

describe("buildExportChunkResumePlan", () => {
  describe("happy path — 재개 plan 산정", () => {
    it("다중 chunk 부분 ack(chunkCount=3, acknowledgedChunks=1) → resumeNeeded·잔여 2 개·resumeRange 정확", () => {
      // 250 B / 100 B → 3 chunk(100, 100, 50).
      const plan = makePlan(250, 100);
      const resume = buildExportChunkResumePlan(plan, 1);

      expect(resume.resumeNeeded).toBe(true);
      expect(resume.acknowledgedChunks).toBe(1);
      expect(resume.acknowledgedBytes).toBe(100);
      expect(resume.resumeFromByte).toBe(100);
      expect(resume.remainingChunkCount).toBe(2);
      expect(resume.remainingBytes).toBe(150);
      expect(resume.remainingChunks).toEqual([
        { index: 1, offsetBytes: 100, sizeBytes: 100, last: false },
        { index: 2, offsetBytes: 200, sizeBytes: 50, last: true },
      ]);
      expect(resume.resumeRange).toEqual({
        firstBytePos: 100,
        lastBytePos: 199,
        totalBytes: 250,
        chunkIndex: 1,
      });
      expect(typeof resume.headline).toBe("string");
      expect(resume.headline.length).toBeGreaterThan(0);
      assertResumeInvariants(resume, plan);
    });

    it("미시작(acknowledgedChunks=0, chunkCount=3) → resumeFromByte 0·잔여 전체·resumeRange 첫 chunk", () => {
      const plan = makePlan(250, 100);
      const resume = buildExportChunkResumePlan(plan, 0);

      expect(resume.resumeNeeded).toBe(true);
      expect(resume.acknowledgedChunks).toBe(0);
      expect(resume.acknowledgedBytes).toBe(0);
      expect(resume.resumeFromByte).toBe(0);
      expect(resume.remainingChunkCount).toBe(3);
      expect(resume.remainingBytes).toBe(250);
      expect(resume.remainingChunks).toEqual(plan.chunks);
      expect(resume.resumeRange).toEqual({
        firstBytePos: 0,
        lastBytePos: 99,
        totalBytes: 250,
        chunkIndex: 0,
      });
      assertResumeInvariants(resume, plan);
    });

    it("완료(acknowledgedChunks=chunkCount=3) → resumeNeeded false·잔여 빈 배열·resumeFromByte totalBytes·resumeRange null", () => {
      const plan = makePlan(250, 100);
      const resume = buildExportChunkResumePlan(plan, 3);

      expect(resume.resumeNeeded).toBe(false);
      expect(resume.acknowledgedChunks).toBe(3);
      expect(resume.acknowledgedBytes).toBe(250);
      expect(resume.resumeFromByte).toBe(250);
      expect(resume.remainingChunkCount).toBe(0);
      expect(resume.remainingBytes).toBe(0);
      expect(resume.remainingChunks).toEqual([]);
      expect(resume.resumeRange).toBeNull();
      assertResumeInvariants(resume, plan);
    });

    it("0 byte plan(chunkCount=0, acknowledgedChunks=0) → resumeNeeded false·resumeRange null·전부 0", () => {
      const plan = makePlan(0, 100);
      const resume = buildExportChunkResumePlan(plan, 0);

      expect(resume.resumeNeeded).toBe(false);
      expect(resume.acknowledgedChunks).toBe(0);
      expect(resume.acknowledgedBytes).toBe(0);
      expect(resume.resumeFromByte).toBe(0);
      expect(resume.remainingChunkCount).toBe(0);
      expect(resume.remainingBytes).toBe(0);
      expect(resume.remainingChunks).toEqual([]);
      expect(resume.resumeRange).toBeNull();
      expect(resume.headline).toContain("재개 불요");
      assertResumeInvariants(resume, plan);
    });
  });

  describe("error path — 입력 방어(plan 부적합·acknowledgedChunks 부적합 TypeError, 범위 초과 RangeError)", () => {
    it("plan 이 plain object 아님(null) → TypeError(label plan)", () => {
      expect(() =>
        buildExportChunkResumePlan(null as unknown as ExportChunkPlan, 0),
      ).toThrow(TypeError);
      expect(() =>
        buildExportChunkResumePlan(null as unknown as ExportChunkPlan, 0),
      ).toThrow(/plan 은 plain object/);
    });

    it("plan 이 배열 → TypeError(label plan, 받음 array)", () => {
      expect(() =>
        buildExportChunkResumePlan([] as unknown as ExportChunkPlan, 0),
      ).toThrow(/plan 은 plain object.*array/);
    });

    it("plan 이 원시값(number) → TypeError", () => {
      expect(() =>
        buildExportChunkResumePlan(5 as unknown as ExportChunkPlan, 0),
      ).toThrow(TypeError);
    });

    it("plan.chunkCount 음수 → TypeError(받은 값 박제)", () => {
      const plan = { ...makePlan(250, 100), chunkCount: -1 };
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(
        /plan.chunkCount 는 0 이상의 정수.*-1/,
      );
    });

    it("plan.chunkCount 소수 → TypeError", () => {
      const plan = { ...makePlan(250, 100), chunkCount: 2.5 };
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(TypeError);
    });

    it("plan.chunkCount NaN → TypeError", () => {
      const plan = { ...makePlan(250, 100), chunkCount: NaN };
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(TypeError);
    });

    it("plan.totalBytes 음수 → TypeError(받은 값 박제)", () => {
      const plan = { ...makePlan(250, 100), totalBytes: -10 };
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(
        /plan.totalBytes 는 0 이상의 정수.*-10/,
      );
    });

    it("plan.totalBytes Infinity → TypeError", () => {
      const plan = { ...makePlan(250, 100), totalBytes: Infinity };
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(TypeError);
    });

    it("plan.chunks 가 배열 아님 → TypeError(받음 박제)", () => {
      const plan = {
        ...makePlan(250, 100),
        chunks: "x" as unknown as ExportChunk[],
      };
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(
        /plan.chunks 는 배열/,
      );
    });

    it("plan.chunks.length !== chunkCount(손상) → TypeError(불일치 박제)", () => {
      const base = makePlan(250, 100);
      const plan = { ...base, chunks: base.chunks.slice(0, 2) }; // length 2 vs chunkCount 3
      expect(() => buildExportChunkResumePlan(plan, 0)).toThrow(
        /일치하지 않습니다.*손상된 plan/,
      );
    });

    it("acknowledgedChunks 음수 → TypeError(받은 값 박제)", () => {
      const plan = makePlan(250, 100);
      expect(() => buildExportChunkResumePlan(plan, -1)).toThrow(
        /acknowledgedChunks 는 0 이상의 정수.*-1/,
      );
    });

    it("acknowledgedChunks 소수 → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() => buildExportChunkResumePlan(plan, 1.5)).toThrow(TypeError);
    });

    it("acknowledgedChunks NaN → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() => buildExportChunkResumePlan(plan, NaN)).toThrow(TypeError);
    });

    it("acknowledgedChunks Infinity → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() => buildExportChunkResumePlan(plan, Infinity)).toThrow(
        TypeError,
      );
    });

    it("acknowledgedChunks 가 number 아님(string) → TypeError", () => {
      const plan = makePlan(250, 100);
      expect(() =>
        buildExportChunkResumePlan(plan, "1" as unknown as number),
      ).toThrow(TypeError);
    });

    it("acknowledgedChunks > chunkCount → RangeError(acknowledgedChunks·chunkCount 박제)", () => {
      const plan = makePlan(250, 100); // chunkCount 3
      expect(() => buildExportChunkResumePlan(plan, 4)).toThrow(RangeError);
      expect(() => buildExportChunkResumePlan(plan, 4)).toThrow(
        /acknowledgedChunks\(4\).*chunkCount\(3\).*초과/,
      );
    });

    it("0 byte plan 에서 acknowledgedChunks > 0(=1) → RangeError(chunkCount 0 초과)", () => {
      const plan = makePlan(0, 100); // chunkCount 0
      expect(() => buildExportChunkResumePlan(plan, 1)).toThrow(RangeError);
    });
  });

  describe("flow / branch 분리", () => {
    it("resumeNeeded true 분기(중간 ack) → resumeRange 값·remainingChunks 비어있지 않음", () => {
      const plan = makePlan(300, 100);
      const resume = buildExportChunkResumePlan(plan, 2);
      expect(resume.resumeNeeded).toBe(true);
      expect(resume.resumeRange).not.toBeNull();
      expect(resume.remainingChunks.length).toBeGreaterThan(0);
    });

    it("resumeNeeded false 분기(전부 ack) → resumeRange null·remainingChunks 빈 배열", () => {
      const plan = makePlan(300, 100);
      const resume = buildExportChunkResumePlan(plan, 3);
      expect(resume.resumeNeeded).toBe(false);
      expect(resume.resumeRange).toBeNull();
      expect(resume.remainingChunks).toEqual([]);
    });

    it("단일 chunk plan(chunkCount=1) acknowledgedChunks 0→1 전환", () => {
      const plan = makePlan(50, 100); // 단일 chunk(50 B)
      const before = buildExportChunkResumePlan(plan, 0);
      expect(before.resumeNeeded).toBe(true);
      expect(before.resumeFromByte).toBe(0);
      expect(before.remainingChunkCount).toBe(1);
      expect(before.resumeRange).toEqual({
        firstBytePos: 0,
        lastBytePos: 49,
        totalBytes: 50,
        chunkIndex: 0,
      });

      const after = buildExportChunkResumePlan(plan, 1);
      expect(after.resumeNeeded).toBe(false);
      expect(after.resumeFromByte).toBe(50);
      expect(after.remainingChunkCount).toBe(0);
      expect(after.resumeRange).toBeNull();
    });

    it("마지막 chunk 가 잔여 size 인 plan(배수 아님)에서 acknowledgedBytes·remainingBytes 산술 정확", () => {
      // 250 B / 100 B → chunk(100, 100, 50). acknowledgedChunks=2 → ack 200, 잔여 50.
      const plan = makePlan(250, 100);
      const resume = buildExportChunkResumePlan(plan, 2);
      expect(resume.acknowledgedBytes).toBe(200);
      expect(resume.remainingBytes).toBe(50);
      expect(resume.resumeFromByte).toBe(200);
      expect(resume.remainingChunks).toEqual([
        { index: 2, offsetBytes: 200, sizeBytes: 50, last: true },
      ]);
    });

    it("배수 plan(잔여 없음)에서도 byte 회계 정확", () => {
      // 300 B / 100 B → chunk(100, 100, 100). acknowledgedChunks=1 → ack 100, 잔여 200.
      const plan = makePlan(300, 100);
      const resume = buildExportChunkResumePlan(plan, 1);
      expect(resume.acknowledgedBytes).toBe(100);
      expect(resume.remainingBytes).toBe(200);
      expect(resume.resumeFromByte).toBe(100);
    });
  });

  describe("negative cases 충분 cover — 불변·비-mutating·결정성", () => {
    it("전 케이스(미시작·중간·완료·잔여 chunk)에서 핵심 불변 전수 검증", () => {
      const plans = [
        makePlan(250, 100), // 잔여 chunk(50 B) 있음
        makePlan(300, 100), // 배수
        makePlan(50, 100), // 단일 chunk
        makePlan(0, 100), // 0 byte
      ];
      for (const plan of plans) {
        for (let ack = 0; ack <= plan.chunkCount; ack += 1) {
          assertResumeInvariants(buildExportChunkResumePlan(plan, ack), plan);
        }
      }
    });

    it("non-mutating — deepFreeze 된 입력 plan/chunks 를 통과하고 입력을 변형하지 않음", () => {
      const plan = makePlan(250, 100);
      Object.freeze(plan);
      Object.freeze(plan.chunks);
      plan.chunks.forEach((c) => Object.freeze(c));
      const snapshot = JSON.parse(JSON.stringify(plan));

      expect(() => buildExportChunkResumePlan(plan, 1)).not.toThrow();
      // 입력 plan 이 그대로 보존됨.
      expect(JSON.parse(JSON.stringify(plan))).toEqual(snapshot);
    });

    it("반환 객체·remainingChunks 항목이 호출마다 새 인스턴스(두 호출 결과 !== 이면서 deep-equal)", () => {
      const plan = makePlan(250, 100);
      const a = buildExportChunkResumePlan(plan, 1);
      const b = buildExportChunkResumePlan(plan, 1);

      // 결과 객체는 다른 인스턴스.
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
      // remainingChunks 배열·항목은 다른 인스턴스.
      expect(a.remainingChunks).not.toBe(b.remainingChunks);
      expect(a.remainingChunks[0]).not.toBe(b.remainingChunks[0]);
      // remainingChunks 항목은 입력 plan.chunks 항목과 다른 인스턴스(복사본).
      expect(a.remainingChunks[0]).not.toBe(plan.chunks[1]);
      expect(a.remainingChunks[0]).toEqual(plan.chunks[1]);
      // resumeRange 도 다른 인스턴스.
      expect(a.resumeRange).not.toBe(b.resumeRange);
      expect(a.resumeRange).toEqual(b.resumeRange);
    });

    it("acknowledgedChunks 0→chunkCount 진행 시 acknowledgedBytes 단조 증가·마지막에 totalBytes·resumeNeeded 마지막만 false", () => {
      const plan = makePlan(250, 100); // chunkCount 3, totalBytes 250
      let prevBytes = -1;
      for (let ack = 0; ack <= plan.chunkCount; ack += 1) {
        const resume = buildExportChunkResumePlan(plan, ack);
        // acknowledgedBytes 단조 증가(같지 않게 — 각 chunk size > 0).
        expect(resume.acknowledgedBytes).toBeGreaterThan(prevBytes);
        prevBytes = resume.acknowledgedBytes;
        // resumeNeeded 는 마지막(ack === chunkCount)에만 false.
        expect(resume.resumeNeeded).toBe(ack < plan.chunkCount);
      }
      // 마지막 ack 에서 acknowledgedBytes === totalBytes.
      expect(prevBytes).toBe(250);
    });
  });
});
