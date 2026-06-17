// import-chunk-upload-progress.spec — describeImportChunkUploadProgress(T-0481)의 R-112 4종 test
// (happy / error / branch-flow / negative+non-mutation). UC-07 §8 NFR resumable upload import 측 업로드
// 진행 view helper 의 산정·status taxonomy·경계·입력 방어·불변·non-mutating 을 전수 검증한다.
import { ImportChunkDescriptor } from "./import-chunk-reassembly-order";
import {
  describeImportChunkUploadProgress,
  ImportChunkUploadProgress,
  ImportChunkUploadProgressInput,
} from "./import-chunk-upload-progress";

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

// 완전 수신 시퀀스 helper — chunkCount 개 chunk 가 각 size byte 로 끊김 없이 0 부터 이어진 입력.
function buildCompleteInput(
  chunkCount: number,
  size: number,
): ImportChunkUploadProgressInput {
  const chunks: ImportChunkDescriptor[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    chunks.push({ index: i, offsetBytes: i * size, sizeBytes: size });
  }
  return {
    receivedChunks: chunks,
    expectedTotalBytes: chunkCount * size,
    expectedChunkCount: chunkCount,
  };
}

// 모든 불변(invariant)을 검증하는 공통 assertion — 모든 결과 케이스에 적용해 negative cover 를 강화한다.
function assertInvariants(
  result: ImportChunkUploadProgress,
  input: ImportChunkUploadProgressInput,
): void {
  // receivedBytes >= expectedTotalBytes ⟹ remainingBytes === 0.
  if (result.receivedBytes >= result.expectedTotalBytes) {
    expect(result.remainingBytes).toBe(0);
  }
  // 0 <= percentComplete <= 100.
  expect(result.percentComplete).toBeGreaterThanOrEqual(0);
  expect(result.percentComplete).toBeLessThanOrEqual(100);
  // complete ⟺ status === "complete".
  expect(result.complete).toBe(result.status === "complete");
  // receivedChunkCount === 0 ⟺ status === "not-started" (단 complete 우선 — 빈 dump 는 complete).
  if (result.receivedChunkCount === 0 && !result.complete) {
    expect(result.status).toBe("not-started");
  }
  if (result.status === "not-started") {
    expect(result.receivedChunkCount).toBe(0);
  }
  // 0 <= resumeOffset <= expectedTotalBytes.
  expect(result.resumeOffset).toBeGreaterThanOrEqual(0);
  expect(result.resumeOffset).toBeLessThanOrEqual(result.expectedTotalBytes);
  // complete ⟹ (resumeOffset === expectedTotalBytes && percentComplete === 100).
  if (result.complete) {
    expect(result.resumeOffset).toBe(result.expectedTotalBytes);
    expect(result.percentComplete).toBe(100);
  }
  // echo / 파생 필드 정합.
  expect(result.receivedChunkCount).toBe(input.receivedChunks.length);
  expect(result.expectedChunkCount).toBe(input.expectedChunkCount);
  expect(result.expectedTotalBytes).toBe(input.expectedTotalBytes);
  expect(result.remainingChunkCount).toBe(
    Math.max(0, input.expectedChunkCount - result.receivedChunkCount),
  );
}

describe("describeImportChunkUploadProgress", () => {
  describe("happy path — 정상 진행 렌더", () => {
    it("완전 수신(전 chunk·전 byte)을 complete=true·status=complete·100%·resumeOffset=전체 로 판정", () => {
      const input = buildCompleteInput(3, 10);
      const result = describeImportChunkUploadProgress(input);
      expect(result.complete).toBe(true);
      expect(result.status).toBe("complete");
      expect(result.receivedChunkCount).toBe(3);
      expect(result.receivedBytes).toBe(30);
      expect(result.remainingChunkCount).toBe(0);
      expect(result.remainingBytes).toBe(0);
      expect(result.percentComplete).toBe(100);
      expect(result.resumeOffset).toBe(30);
      assertInvariants(result, input);
    });

    it("단일 chunk 완전 수신을 complete=true·status=complete 로 판정", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 50 }],
        expectedTotalBytes: 50,
        expectedChunkCount: 1,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.complete).toBe(true);
      expect(result.status).toBe("complete");
      expect(result.resumeOffset).toBe(50);
      expect(result.percentComplete).toBe(100);
      assertInvariants(result, input);
    });

    it("부분 연속 수신(chunk0 만 수신)을 status=uploading·100% 미만·resumeOffset=수신끝 으로 판정", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 10 }],
        expectedTotalBytes: 20,
        expectedChunkCount: 2,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("uploading");
      expect(result.complete).toBe(false);
      expect(result.receivedBytes).toBe(10);
      expect(result.remainingBytes).toBe(10);
      expect(result.remainingChunkCount).toBe(1);
      expect(result.percentComplete).toBe(50);
      expect(result.resumeOffset).toBe(10);
      assertInvariants(result, input);
    });

    it("입력이 뒤섞였으나 정렬 후 완전이면 status=complete 로 판정", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
        expectedChunkCount: 2,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("complete");
      expect(result.complete).toBe(true);
      expect(result.resumeOffset).toBe(20);
      assertInvariants(result, input);
    });

    it("headline 에 진행률·수신/기대 chunk·재개 offset 한국어 요약이 담긴다", () => {
      const partial = describeImportChunkUploadProgress({
        receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 10 }],
        expectedTotalBytes: 20,
        expectedChunkCount: 2,
      });
      expect(partial.headline).toContain("업로드 진행");
      expect(partial.headline).toContain("50%");
      expect(partial.headline).toContain("재개 offset 10");

      const done = describeImportChunkUploadProgress(buildCompleteInput(2, 10));
      expect(done.headline).toContain("수신 완료");
      expect(done.headline).toContain("100%");
    });
  });

  describe("error path — 입력 방어(부적합 입력 종류마다 분리)", () => {
    it("input 이 null 이면 TypeError(label input)", () => {
      expect(() =>
        describeImportChunkUploadProgress(
          null as unknown as ImportChunkUploadProgressInput,
        ),
      ).toThrow(/input 은 plain object/);
      expect(() =>
        describeImportChunkUploadProgress(
          null as unknown as ImportChunkUploadProgressInput,
        ),
      ).toThrow(TypeError);
    });

    it("input 이 배열이면 TypeError(받은 값 array 박제)", () => {
      expect(() =>
        describeImportChunkUploadProgress(
          [] as unknown as ImportChunkUploadProgressInput,
        ),
      ).toThrow(/받음: array/);
    });

    it("input 이 원시값이면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress(
          42 as unknown as ImportChunkUploadProgressInput,
        ),
      ).toThrow(/input 은 plain object/);
    });

    it("receivedChunks 가 배열 아니면 TypeError(label receivedChunks)", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: "x" as unknown as ImportChunkDescriptor[],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/input.receivedChunks 는 배열/);
    });

    it("receivedChunks[i] 가 plain object 아니면 TypeError(index·받은 값 박제)", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [null as unknown as ImportChunkDescriptor],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\] 는 plain object/);
    });

    it("index 가 음수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: -1, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].index 는 0 이상의 정수/);
    });

    it("index 가 NaN 이면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: NaN, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].index/);
    });

    it("index 가 Infinity 면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: Infinity, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].index/);
    });

    it("index 가 소수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 1.5, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].index/);
    });

    it("index 가 비-number 면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [
            { index: "0" as unknown as number, offsetBytes: 0, sizeBytes: 10 },
          ],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].index/);
    });

    it("offsetBytes 가 음수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: -5, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].offsetBytes 는 0 이상의 정수/);
    });

    it("offsetBytes 가 NaN 이면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: NaN, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].offsetBytes/);
    });

    it("offsetBytes 가 Infinity 면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: Infinity, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].offsetBytes/);
    });

    it("offsetBytes 가 소수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: 2.5, sizeBytes: 10 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].offsetBytes/);
    });

    it("sizeBytes 가 0 이면 TypeError(양의 정수 요구)", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 0 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].sizeBytes 는 1 이상의 정수/);
    });

    it("sizeBytes 가 음수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: -1 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].sizeBytes/);
    });

    it("sizeBytes 가 NaN 이면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: NaN }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].sizeBytes/);
    });

    it("sizeBytes 가 Infinity 면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: Infinity }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].sizeBytes/);
    });

    it("sizeBytes 가 소수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 1.5 }],
          expectedTotalBytes: 10,
          expectedChunkCount: 1,
        }),
      ).toThrow(/receivedChunks\[0\].sizeBytes/);
    });

    it("expectedTotalBytes 가 음수면 TypeError(label expectedTotalBytes)", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [],
          expectedTotalBytes: -1,
          expectedChunkCount: 0,
        }),
      ).toThrow(/input.expectedTotalBytes 는 0 이상의 정수/);
    });

    it("expectedTotalBytes 가 소수면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [],
          expectedTotalBytes: 1.5,
          expectedChunkCount: 0,
        }),
      ).toThrow(/input.expectedTotalBytes/);
    });

    it("expectedTotalBytes 가 비-number 면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [],
          expectedTotalBytes: "10" as unknown as number,
          expectedChunkCount: 0,
        }),
      ).toThrow(/input.expectedTotalBytes/);
    });

    it("expectedChunkCount 가 음수면 TypeError(label expectedChunkCount)", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [],
          expectedTotalBytes: 0,
          expectedChunkCount: -1,
        }),
      ).toThrow(/input.expectedChunkCount 는 0 이상의 정수/);
    });

    it("expectedChunkCount 가 NaN 이면 TypeError", () => {
      expect(() =>
        describeImportChunkUploadProgress({
          receivedChunks: [],
          expectedTotalBytes: 0,
          expectedChunkCount: NaN,
        }),
      ).toThrow(/input.expectedChunkCount/);
    });
  });

  describe("flow / branch 분리 — status taxonomy 4값 + 분기", () => {
    it("status=not-started — 빈 receivedChunks·기대>0", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [],
        expectedTotalBytes: 30,
        expectedChunkCount: 3,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("not-started");
      expect(result.complete).toBe(false);
      expect(result.receivedChunkCount).toBe(0);
      expect(result.receivedBytes).toBe(0);
      expect(result.percentComplete).toBe(0);
      expect(result.resumeOffset).toBe(0);
      expect(result.remainingChunkCount).toBe(3);
      expect(result.remainingBytes).toBe(30);
      expect(result.headline).toContain("미시작");
      assertInvariants(result, input);
    });

    it("status=uploading — 일부 연속 수신·미완", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
        ],
        expectedTotalBytes: 40,
        expectedChunkCount: 4,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("uploading");
      expect(result.resumeOffset).toBe(20);
      expect(result.percentComplete).toBe(50);
      assertInvariants(result, input);
    });

    it("status=stalled-incomplete — 시퀀스 gap 으로 연속 구간이 끊김", () => {
      // chunk0(offset0 size10) + chunk2(offset30 size10) — chunk1 누락 → offset10 에서 끊김.
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
          { index: 2, offsetBytes: 30, sizeBytes: 10 },
        ],
        expectedTotalBytes: 40,
        expectedChunkCount: 4,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("stalled-incomplete");
      expect(result.complete).toBe(false);
      expect(result.resumeOffset).toBe(10);
      expect(result.receivedBytes).toBe(20);
      expect(result.headline).toContain("gap 으로 정체");
      assertInvariants(result, input);
    });

    it("status=stalled-incomplete — 첫 chunk 가 offset 0 에서 시작하지 않음(앞부분 누락)", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [{ index: 1, offsetBytes: 10, sizeBytes: 10 }],
        expectedTotalBytes: 20,
        expectedChunkCount: 2,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("stalled-incomplete");
      expect(result.resumeOffset).toBe(0);
      assertInvariants(result, input);
    });

    it("status=complete — 전 chunk·전 byte 수신", () => {
      const input = buildCompleteInput(2, 25);
      const result = describeImportChunkUploadProgress(input);
      expect(result.status).toBe("complete");
      assertInvariants(result, input);
    });

    it("expectedChunkCount=0 분기 — 빈 dump 는 complete·status=complete·100%", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [],
        expectedTotalBytes: 0,
        expectedChunkCount: 0,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.complete).toBe(true);
      expect(result.status).toBe("complete");
      expect(result.percentComplete).toBe(100);
      expect(result.resumeOffset).toBe(0);
      expect(result.remainingChunkCount).toBe(0);
      expect(result.headline).toContain("수신할 chunk 가 없습니다");
      assertInvariants(result, input);
    });

    it("percentComplete 반올림 경계 — 1/3 → 33", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 1 }],
        expectedTotalBytes: 3,
        expectedChunkCount: 3,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.percentComplete).toBe(33);
      assertInvariants(result, input);
    });

    it("percentComplete 반올림 경계 — 2/3 → 67", () => {
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [
          { index: 0, offsetBytes: 0, sizeBytes: 1 },
          { index: 1, offsetBytes: 1, sizeBytes: 1 },
        ],
        expectedTotalBytes: 3,
        expectedChunkCount: 3,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.percentComplete).toBe(67);
      assertInvariants(result, input);
    });

    it("초과 수신(receivedBytes > expectedTotalBytes) — remainingBytes 0·percentComplete 100 clamp", () => {
      // chunk 수는 기대보다 적어 complete=false(상태는 stalled/uploading), 하지만 byte 는 초과.
      const input: ImportChunkUploadProgressInput = {
        receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 30 }],
        expectedTotalBytes: 20,
        expectedChunkCount: 2,
      };
      const result = describeImportChunkUploadProgress(input);
      expect(result.receivedBytes).toBe(30);
      expect(result.remainingBytes).toBe(0);
      expect(result.percentComplete).toBe(100);
      expect(result.resumeOffset).toBe(20);
      expect(result.complete).toBe(false);
      assertInvariants(result, input);
    });
  });

  describe("negative / invariant / non-mutation", () => {
    it("모든 status 케이스에서 불변이 성립한다", () => {
      const cases: ImportChunkUploadProgressInput[] = [
        { receivedChunks: [], expectedTotalBytes: 30, expectedChunkCount: 3 },
        { receivedChunks: [], expectedTotalBytes: 0, expectedChunkCount: 0 },
        buildCompleteInput(3, 10),
        {
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 10 }],
          expectedTotalBytes: 30,
          expectedChunkCount: 3,
        },
        {
          receivedChunks: [
            { index: 0, offsetBytes: 0, sizeBytes: 10 },
            { index: 2, offsetBytes: 20, sizeBytes: 10 },
          ],
          expectedTotalBytes: 30,
          expectedChunkCount: 3,
        },
        {
          receivedChunks: [{ index: 0, offsetBytes: 0, sizeBytes: 100 }],
          expectedTotalBytes: 50,
          expectedChunkCount: 2,
        },
      ];
      for (const input of cases) {
        assertInvariants(describeImportChunkUploadProgress(input), input);
      }
    });

    it("입력 객체·receivedChunks 배열을 변형하지 않는다(deepFreeze 통과)", () => {
      const input = deepFreeze<ImportChunkUploadProgressInput>({
        receivedChunks: [
          { index: 1, offsetBytes: 10, sizeBytes: 10 },
          { index: 0, offsetBytes: 0, sizeBytes: 10 },
        ],
        expectedTotalBytes: 20,
        expectedChunkCount: 2,
      });
      expect(() => describeImportChunkUploadProgress(input)).not.toThrow();
      // 원본 배열 순서 비변형(정렬은 복사본에서만).
      expect(input.receivedChunks[0].index).toBe(1);
      expect(input.receivedChunks[1].index).toBe(0);
    });

    it("동일 입력 2회 호출은 새 인스턴스(!==)이면서 deep-equal(순수·결정성)", () => {
      const input = buildCompleteInput(3, 10);
      const a = describeImportChunkUploadProgress(input);
      const b = describeImportChunkUploadProgress(input);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
