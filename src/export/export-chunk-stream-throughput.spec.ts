import { ExportChunkStreamProgress } from "./export-chunk-stream-progress";
import {
  ExportChunkStreamThroughput,
  estimateExportChunkStreamThroughput,
} from "./export-chunk-stream-throughput";

// 테스트용 ExportChunkStreamProgress 를 만드는 helper — describeExportChunkStreamProgress 를
// 재호출하지 않고(DRY) 본 helper 가 사용하는 byte/complete 필드를 byte 보존 계약
// (transferredBytes + remainingBytes === totalBytes)에 맞춰 직접 구성한다. chunk 차원 필드는
// 타입 충족을 위해 채우나 값은 본 helper 가 안 읽음.
function makeProgress(
  transferredBytes: number,
  remainingBytes: number,
  overrides: Partial<ExportChunkStreamProgress> = {},
): ExportChunkStreamProgress {
  const totalBytes = transferredBytes + remainingBytes;
  const complete = overrides.complete ?? remainingBytes === 0;
  return {
    totalChunks: overrides.totalChunks ?? 1,
    deliveredChunks: overrides.deliveredChunks ?? (complete ? 1 : 0),
    remainingChunks: overrides.remainingChunks ?? (complete ? 0 : 1),
    transferredBytes,
    totalBytes: overrides.totalBytes ?? totalBytes,
    remainingBytes,
    percentComplete:
      overrides.percentComplete ??
      (totalBytes === 0
        ? 100
        : Math.round((transferredBytes / totalBytes) * 100)),
    complete,
    currentChunk: overrides.currentChunk ?? null,
    currentRange: overrides.currentRange ?? null,
    headline: overrides.headline ?? "테스트 progress",
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

// 산출물의 핵심 불변을 일괄 검증하는 helper — negative cases 충분 cover 용.
function assertInvariants(result: ExportChunkStreamThroughput): void {
  expect(result.bytesPerMillisecond).toBeGreaterThanOrEqual(0);
  expect(result.bytesPerSecond).toBeCloseTo(
    result.bytesPerMillisecond * 1000,
    10,
  );
  expect(result.transferredBytes + result.remainingBytes).toBe(
    result.totalBytes,
  );
  if (result.etaKnown === false) {
    expect(result.etaMillis).toBe(0);
  }
  if (result.remainingBytes === 0) {
    expect(result.etaMillis).toBe(0);
    expect(result.etaKnown).toBe(true);
  }
  if (result.complete) {
    expect(result.remainingBytes).toBe(0);
    expect(result.etaMillis).toBe(0);
    expect(result.etaKnown).toBe(true);
    expect(result.stalled).toBe(false);
  }
  if (result.stalled === true) {
    expect(result.bytesPerMillisecond).toBe(0);
    expect(result.complete).toBe(false);
  }
}

describe("estimateExportChunkStreamThroughput", () => {
  describe("happy path — 모든 필드 기대값", () => {
    it("정상 진행: rate·ETA·etaKnown·!stalled·!complete", () => {
      const result = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        1000,
      );
      expect(result.complete).toBe(false);
      expect(result.transferredBytes).toBe(500);
      expect(result.remainingBytes).toBe(1500);
      expect(result.totalBytes).toBe(2000);
      expect(result.elapsedMillis).toBe(1000);
      expect(result.bytesPerMillisecond).toBe(0.5);
      expect(result.bytesPerSecond).toBe(500);
      expect(result.etaKnown).toBe(true);
      expect(result.etaMillis).toBe(3000);
      expect(result.stalled).toBe(false);
      expect(typeof result.headline).toBe("string");
      assertInvariants(result);
    });

    it("완료(complete=true, remainingBytes=0): etaMillis=0·etaKnown=true·stalled=false", () => {
      const result = estimateExportChunkStreamThroughput(
        makeProgress(2000, 0),
        4000,
      );
      expect(result.complete).toBe(true);
      expect(result.remainingBytes).toBe(0);
      expect(result.bytesPerMillisecond).toBe(0.5);
      expect(result.bytesPerSecond).toBe(500);
      expect(result.etaMillis).toBe(0);
      expect(result.etaKnown).toBe(true);
      expect(result.stalled).toBe(false);
      assertInvariants(result);
    });

    it("elapsedMillis=0 시작: rate 0·etaKnown=false·!stalled·etaMillis=0", () => {
      const result = estimateExportChunkStreamThroughput(
        makeProgress(0, 2000),
        0,
      );
      expect(result.bytesPerMillisecond).toBe(0);
      expect(result.bytesPerSecond).toBe(0);
      expect(result.etaKnown).toBe(false);
      expect(result.etaMillis).toBe(0);
      expect(result.stalled).toBe(false);
      expect(result.complete).toBe(false);
      assertInvariants(result);
    });

    it("정체(elapsed>0, transferred=0, 미완료): stalled=true·rate 0·etaKnown=false", () => {
      const result = estimateExportChunkStreamThroughput(
        makeProgress(0, 2000),
        5000,
      );
      expect(result.stalled).toBe(true);
      expect(result.bytesPerMillisecond).toBe(0);
      expect(result.bytesPerSecond).toBe(0);
      expect(result.etaKnown).toBe(false);
      expect(result.etaMillis).toBe(0);
      expect(result.complete).toBe(false);
      assertInvariants(result);
    });

    it("빠른 전송: bytesPerSecond 큰 값 정확", () => {
      const result = estimateExportChunkStreamThroughput(
        makeProgress(1_000_000, 1_000_000),
        100,
      );
      expect(result.bytesPerMillisecond).toBe(10_000);
      expect(result.bytesPerSecond).toBe(10_000_000);
      expect(result.etaKnown).toBe(true);
      expect(result.etaMillis).toBe(100);
      expect(result.stalled).toBe(false);
      assertInvariants(result);
    });
  });

  describe("error path — 입력 방어(TypeError vs RangeError)", () => {
    it("progress 가 plain object 아님(null) → TypeError", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(
          null as unknown as ExportChunkStreamProgress,
          0,
        ),
      ).toThrow(TypeError);
      expect(() =>
        estimateExportChunkStreamThroughput(
          null as unknown as ExportChunkStreamProgress,
          0,
        ),
      ).toThrow(/progress 는 plain object.*null/);
    });

    it("progress 가 배열 → TypeError(array 박제)", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(
          [] as unknown as ExportChunkStreamProgress,
          0,
        ),
      ).toThrow(/array/);
    });

    it("progress 가 원시값(number) → TypeError", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(
          42 as unknown as ExportChunkStreamProgress,
          0,
        ),
      ).toThrow(TypeError);
    });

    it("transferredBytes 비-음수정수 아님 → TypeError(label·받은 값)", () => {
      const bad = makeProgress(0, 2000);
      (bad as { transferredBytes: unknown }).transferredBytes = -1;
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /transferredBytes.*받음: -1/,
      );
    });

    it("remainingBytes 비-음수정수 아님(소수) → TypeError", () => {
      const bad = makeProgress(500, 1500);
      (bad as { remainingBytes: unknown }).remainingBytes = 1.5;
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /remainingBytes.*받음: 1.5/,
      );
    });

    it("totalBytes 비-음수정수 아님(NaN) → TypeError", () => {
      const bad = makeProgress(500, 1500);
      (bad as { totalBytes: unknown }).totalBytes = NaN;
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /totalBytes.*NaN/,
      );
    });

    it("complete 비-boolean → TypeError(label·받은 값)", () => {
      const bad = makeProgress(500, 1500);
      (bad as { complete: unknown }).complete = "yes";
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /complete 는 boolean.*yes/,
      );
    });

    it("elapsedMillis 음수 → TypeError", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(makeProgress(500, 1500), -1),
      ).toThrow(/elapsedMillis.*받음: -1/);
    });

    it("elapsedMillis 소수 → TypeError", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(makeProgress(500, 1500), 10.5),
      ).toThrow(/elapsedMillis.*10.5/);
    });

    it("elapsedMillis NaN → TypeError", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(makeProgress(500, 1500), NaN),
      ).toThrow(/elapsedMillis.*NaN/);
    });

    it("elapsedMillis 비-number(string) → TypeError", () => {
      expect(() =>
        estimateExportChunkStreamThroughput(
          makeProgress(500, 1500),
          "100" as unknown as number,
        ),
      ).toThrow(TypeError);
    });

    it("transferredBytes + remainingBytes !== totalBytes → RangeError(byte 계약)", () => {
      const bad = makeProgress(500, 1500);
      (bad as { totalBytes: unknown }).totalBytes = 9999;
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        RangeError,
      );
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /일치하지 않습니다/,
      );
    });

    it("complete=true 인데 remainingBytes!=0 → RangeError(모순)", () => {
      const bad = makeProgress(500, 1500, { complete: true });
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        RangeError,
      );
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /complete 가 true.*0 이 아닙니다/,
      );
    });

    it("complete=false 인데 remainingBytes==0(totalBytes>0) → RangeError(모순)", () => {
      const bad = makeProgress(2000, 0, { complete: false });
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        RangeError,
      );
      expect(() => estimateExportChunkStreamThroughput(bad, 100)).toThrow(
        /complete 가 false/,
      );
    });
  });

  describe("flow / branch 분리", () => {
    it("elapsedMillis === 0 분기(rate 단락 0) vs > 0 분기(나눗셈)", () => {
      const zero = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        0,
      );
      expect(zero.bytesPerMillisecond).toBe(0);
      const positive = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        1000,
      );
      expect(positive.bytesPerMillisecond).toBe(0.5);
    });

    it("bytesPerMillisecond === 0 분기(etaKnown 판정·etaMillis 단락) vs > 0 분기", () => {
      // rate 0(미완료) → etaKnown false, etaMillis 0.
      const rateZero = estimateExportChunkStreamThroughput(
        makeProgress(0, 2000),
        1000,
      );
      expect(rateZero.bytesPerMillisecond).toBe(0);
      expect(rateZero.etaKnown).toBe(false);
      expect(rateZero.etaMillis).toBe(0);
      // rate > 0 → etaKnown true, etaMillis = remaining / rate.
      const ratePositive = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        1000,
      );
      expect(ratePositive.etaKnown).toBe(true);
      expect(ratePositive.etaMillis).toBe(3000);
    });

    it("remainingBytes === 0 분기(etaMillis=0·etaKnown=true) vs > 0 분기", () => {
      const remZero = estimateExportChunkStreamThroughput(
        makeProgress(2000, 0),
        1000,
      );
      expect(remZero.etaMillis).toBe(0);
      expect(remZero.etaKnown).toBe(true);
      const remPositive = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        1000,
      );
      expect(remPositive.etaMillis).toBe(3000);
    });

    it("complete true vs false 분기", () => {
      const done = estimateExportChunkStreamThroughput(
        makeProgress(2000, 0),
        1000,
      );
      expect(done.complete).toBe(true);
      const ongoing = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        1000,
      );
      expect(ongoing.complete).toBe(false);
    });

    it("stalled true 분기 vs false 분기(전송 있음 / elapsed=0 / complete)", () => {
      // true: 미완료 + elapsed>0 + transferred=0.
      const stalled = estimateExportChunkStreamThroughput(
        makeProgress(0, 2000),
        3000,
      );
      expect(stalled.stalled).toBe(true);
      // false(전송 있음).
      const transferring = estimateExportChunkStreamThroughput(
        makeProgress(500, 1500),
        3000,
      );
      expect(transferring.stalled).toBe(false);
      // false(elapsed=0).
      const notStarted = estimateExportChunkStreamThroughput(
        makeProgress(0, 2000),
        0,
      );
      expect(notStarted.stalled).toBe(false);
      // false(complete).
      const completed = estimateExportChunkStreamThroughput(
        makeProgress(2000, 0),
        3000,
      );
      expect(completed.stalled).toBe(false);
    });

    it("totalBytes=0 빈 전송(complete=true, remainingBytes=0): 모순 아님", () => {
      const result = estimateExportChunkStreamThroughput(
        makeProgress(0, 0, { complete: true }),
        100,
      );
      expect(result.complete).toBe(true);
      expect(result.totalBytes).toBe(0);
      expect(result.etaMillis).toBe(0);
      expect(result.etaKnown).toBe(true);
      assertInvariants(result);
    });

    it("소수 rate 의 ETA 정확(반올림 없이 소수 그대로)", () => {
      // transferred=300, elapsed=900 → rate = 1/3; remaining=700 → eta = 700 / (1/3) = 2100.
      const result = estimateExportChunkStreamThroughput(
        makeProgress(300, 700),
        900,
      );
      expect(result.bytesPerMillisecond).toBeCloseTo(1 / 3, 10);
      expect(result.etaMillis).toBeCloseTo(2100, 6);
    });
  });

  describe("negative cases 충분 cover — 불변·non-mutation", () => {
    it("불변(bytesPerSecond·etaKnown·complete·stalled·byte 보존)을 전 케이스 전수 검증", () => {
      const cases: Array<[ExportChunkStreamProgress, number]> = [
        [makeProgress(500, 1500), 1000], // 정상
        [makeProgress(2000, 0), 4000], // 완료
        [makeProgress(0, 2000), 0], // elapsed 0
        [makeProgress(0, 2000), 5000], // 정체
        [makeProgress(1_000_000, 1_000_000), 100], // 빠른 전송
        [makeProgress(0, 0, { complete: true }), 0], // 빈 전송
      ];
      for (const [progress, elapsed] of cases) {
        assertInvariants(
          estimateExportChunkStreamThroughput(progress, elapsed),
        );
      }
    });

    it("non-mutating: deepFreeze 된 입력 progress 를 변형하지 않는다", () => {
      const frozen = deepFreeze(makeProgress(500, 1500));
      expect(() =>
        estimateExportChunkStreamThroughput(frozen, 1000),
      ).not.toThrow();
    });

    it("반환 객체는 호출마다 새 인스턴스(!== 이면서 deep-equal)", () => {
      const progress = makeProgress(500, 1500);
      const a = estimateExportChunkStreamThroughput(progress, 1000);
      const b = estimateExportChunkStreamThroughput(progress, 1000);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it("순수·결정성: 동일 입력 2회 호출 동등 결과", () => {
      const progress = makeProgress(0, 2000);
      const a = estimateExportChunkStreamThroughput(progress, 3000);
      const b = estimateExportChunkStreamThroughput(progress, 3000);
      expect(a).toEqual(b);
    });
  });
});
