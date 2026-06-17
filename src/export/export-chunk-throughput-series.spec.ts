import { ExportChunkStreamThroughput } from "./export-chunk-stream-throughput";
import {
  ExportChunkThroughputSeries,
  summariseExportChunkThroughputSeries,
} from "./export-chunk-throughput-series";

// 테스트용 ExportChunkStreamThroughput sample 을 만드는 helper — estimateExportChunkStreamThroughput
// 를 재호출하지 않고(DRY) 본 helper 가 읽는 필드(bytesPerSecond / transferredBytes / stalled /
// complete)만 의미 있게 채우고 나머지는 타입 충족용으로 채운다. 본 helper 가 안 읽는 필드의 값은 무관.
function makeSample(
  bytesPerSecond: number,
  transferredBytes: number,
  overrides: Partial<ExportChunkStreamThroughput> = {},
): ExportChunkStreamThroughput {
  return {
    complete: overrides.complete ?? false,
    transferredBytes,
    remainingBytes: overrides.remainingBytes ?? 0,
    totalBytes: overrides.totalBytes ?? transferredBytes,
    elapsedMillis: overrides.elapsedMillis ?? 1000,
    bytesPerMillisecond: overrides.bytesPerMillisecond ?? bytesPerSecond / 1000,
    bytesPerSecond,
    etaMillis: overrides.etaMillis ?? 0,
    etaKnown: overrides.etaKnown ?? true,
    stalled: overrides.stalled ?? false,
    headline: overrides.headline ?? "테스트 throughput sample",
  };
}

// 정체 sample 을 만드는 단축 helper — stalled=true 면 bytesPerSecond=0(estimate 계약과 정합).
function makeStalledSample(
  transferredBytes: number,
  overrides: Partial<ExportChunkStreamThroughput> = {},
): ExportChunkStreamThroughput {
  return makeSample(0, transferredBytes, { ...overrides, stalled: true });
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
function assertInvariants(result: ExportChunkThroughputSeries): void {
  expect(result.minBytesPerSecond).toBeGreaterThanOrEqual(0);
  if (result.sampleCount >= 1) {
    expect(result.minBytesPerSecond).toBeLessThanOrEqual(
      result.averageBytesPerSecond,
    );
    expect(result.averageBytesPerSecond).toBeLessThanOrEqual(
      result.peakBytesPerSecond,
    );
  }
  expect(result.stalledWindowCount).toBeGreaterThanOrEqual(0);
  expect(result.stalledWindowCount).toBeLessThanOrEqual(
    result.stalledSampleCount,
  );
  expect(result.stalledSampleCount).toBeLessThanOrEqual(result.sampleCount);
  expect(result.everStalled).toBe(result.stalledSampleCount > 0);
  if (result.stalledSampleCount === 0) {
    expect(result.stalledWindowCount).toBe(0);
  }
  if (result.sampleCount <= 1) {
    expect(result.monotonicProgress).toBe(true);
  }
}

describe("summariseExportChunkThroughputSeries", () => {
  describe("happy path", () => {
    it("정상 시계열(여러 sample)의 average/peak/min·정체 0·monotonic·complete 를 산정한다", () => {
      const samples = [
        makeSample(100, 100),
        makeSample(300, 400),
        makeSample(200, 600, { complete: true }),
      ];
      const result = summariseExportChunkThroughputSeries(samples);
      expect(result.sampleCount).toBe(3);
      expect(result.averageBytesPerSecond).toBe(200);
      expect(result.peakBytesPerSecond).toBe(300);
      expect(result.minBytesPerSecond).toBe(100);
      expect(result.stalledSampleCount).toBe(0);
      expect(result.stalledWindowCount).toBe(0);
      expect(result.everStalled).toBe(false);
      expect(result.monotonicProgress).toBe(true);
      expect(result.complete).toBe(true);
      expect(result.headline).toContain("표본 3 개");
      assertInvariants(result);
    });

    it("단일 sample 은 average=peak=min=그 sample 의 rate·monotonic=true 다", () => {
      const result = summariseExportChunkThroughputSeries([
        makeSample(250, 250),
      ]);
      expect(result.sampleCount).toBe(1);
      expect(result.averageBytesPerSecond).toBe(250);
      expect(result.peakBytesPerSecond).toBe(250);
      expect(result.minBytesPerSecond).toBe(250);
      expect(result.monotonicProgress).toBe(true);
      expect(result.stalledWindowCount).toBe(0);
      assertInvariants(result);
    });

    it("마지막 sample complete=true 면 series.complete=true 다", () => {
      const result = summariseExportChunkThroughputSeries([
        makeSample(100, 100),
        makeSample(100, 200, { complete: true }),
      ]);
      expect(result.complete).toBe(true);
    });

    it("점증 처리율([느림,빠름]) → peak>min·average 가 중간이다", () => {
      const result = summariseExportChunkThroughputSeries([
        makeSample(50, 50),
        makeSample(150, 200),
      ]);
      expect(result.peakBytesPerSecond).toBe(150);
      expect(result.minBytesPerSecond).toBe(50);
      expect(result.averageBytesPerSecond).toBe(100);
      expect(result.peakBytesPerSecond).toBeGreaterThan(
        result.minBytesPerSecond,
      );
      assertInvariants(result);
    });

    it("소수 rate 의 평균도 산술 평균으로 산정한다", () => {
      const result = summariseExportChunkThroughputSeries([
        makeSample(1, 1),
        makeSample(2, 3),
      ]);
      expect(result.averageBytesPerSecond).toBeCloseTo(1.5, 10);
      assertInvariants(result);
    });

    it("headline 에 평균·최고·정체·완료 요약을 담는다", () => {
      const result = summariseExportChunkThroughputSeries([
        makeSample(100, 100, { complete: true }),
      ]);
      expect(result.headline).toContain("평균 100 B/s");
      expect(result.headline).toContain("최고 100 B/s");
      expect(result.headline).toContain("전송 완료");
    });
  });

  describe("boundary cases", () => {
    it("빈 배열([]) → 전 필드 0/기본값", () => {
      const result = summariseExportChunkThroughputSeries([]);
      expect(result.sampleCount).toBe(0);
      expect(result.averageBytesPerSecond).toBe(0);
      expect(result.peakBytesPerSecond).toBe(0);
      expect(result.minBytesPerSecond).toBe(0);
      expect(result.stalledSampleCount).toBe(0);
      expect(result.stalledWindowCount).toBe(0);
      expect(result.everStalled).toBe(false);
      expect(result.monotonicProgress).toBe(true);
      expect(result.complete).toBe(false);
      expect(result.headline).toContain("표본 없음");
      assertInvariants(result);
    });

    it("단일 정체 sample → stalledWindowCount=1", () => {
      const result = summariseExportChunkThroughputSeries([
        makeStalledSample(0),
      ]);
      expect(result.stalledSampleCount).toBe(1);
      expect(result.stalledWindowCount).toBe(1);
      expect(result.everStalled).toBe(true);
      assertInvariants(result);
    });

    it("모두 정체 → stalledSampleCount=sampleCount·stalledWindowCount=1·rate 0", () => {
      const result = summariseExportChunkThroughputSeries([
        makeStalledSample(0),
        makeStalledSample(0),
        makeStalledSample(0),
      ]);
      expect(result.stalledSampleCount).toBe(3);
      expect(result.stalledWindowCount).toBe(1);
      expect(result.averageBytesPerSecond).toBe(0);
      expect(result.peakBytesPerSecond).toBe(0);
      expect(result.minBytesPerSecond).toBe(0);
      assertInvariants(result);
    });

    it("교차 정체([정체,정상,정체]) → stalledWindowCount=2", () => {
      const result = summariseExportChunkThroughputSeries([
        makeStalledSample(0),
        makeSample(100, 100),
        makeStalledSample(100),
      ]);
      expect(result.stalledSampleCount).toBe(2);
      expect(result.stalledWindowCount).toBe(2);
      assertInvariants(result);
    });

    it("연속 정체 묶음([정체,정체,정상,정체]) → stalledWindowCount=2", () => {
      const result = summariseExportChunkThroughputSeries([
        makeStalledSample(0),
        makeStalledSample(0),
        makeSample(100, 100),
        makeStalledSample(100),
      ]);
      expect(result.stalledSampleCount).toBe(3);
      expect(result.stalledWindowCount).toBe(2);
      assertInvariants(result);
    });

    it("transferredBytes 역행([1000,800]) → monotonicProgress=false", () => {
      const result = summariseExportChunkThroughputSeries([
        makeSample(100, 1000),
        makeSample(100, 800),
      ]);
      expect(result.monotonicProgress).toBe(false);
      assertInvariants(result);
    });
  });

  describe("input defense (error path)", () => {
    it("samples 가 배열 아님(null) → TypeError(label samples)", () => {
      expect(() =>
        summariseExportChunkThroughputSeries(
          null as unknown as ExportChunkStreamThroughput[],
        ),
      ).toThrow(/samples 는 배열.*받음: null/);
    });

    it("samples 가 배열 아님(object) → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries(
          {} as unknown as ExportChunkStreamThroughput[],
        ),
      ).toThrow(/samples 는 배열.*받음: object/);
    });

    it("samples 가 배열 아님(원시값 number) → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries(
          5 as unknown as ExportChunkStreamThroughput[],
        ),
      ).toThrow(TypeError);
    });

    it("원소가 plain object 아님(null) → TypeError(index 박제)", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          null as unknown as ExportChunkStreamThroughput,
        ]),
      ).toThrow(/samples\[0\].*plain object.*받음: null/);
    });

    it("원소가 plain object 아님(배열) → TypeError(index 박제)", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          [] as unknown as ExportChunkStreamThroughput,
        ]),
      ).toThrow(/samples\[0\].*받음: array/);
    });

    it("원소가 plain object 아님(원시값) → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          7 as unknown as ExportChunkStreamThroughput,
        ]),
      ).toThrow(/samples\[0\].*받음: number/);
    });

    it("원소 bytesPerSecond 가 음수 → TypeError(index·label 박제)", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([makeSample(-1, 100)]),
      ).toThrow(/samples\[0\]\.bytesPerSecond.*받음: -1/);
    });

    it("원소 bytesPerSecond 가 NaN → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([makeSample(NaN, 100)]),
      ).toThrow(/samples\[0\]\.bytesPerSecond/);
    });

    it("원소 bytesPerSecond 가 Infinity → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([makeSample(Infinity, 100)]),
      ).toThrow(/samples\[0\]\.bytesPerSecond/);
    });

    it("원소 bytesPerSecond 가 비-number → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          makeSample("x" as unknown as number, 100),
        ]),
      ).toThrow(/samples\[0\]\.bytesPerSecond/);
    });

    it("원소 transferredBytes 가 음수 → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([makeSample(100, -1)]),
      ).toThrow(/samples\[0\]\.transferredBytes.*받음: -1/);
    });

    it("원소 transferredBytes 가 소수 → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([makeSample(100, 1.5)]),
      ).toThrow(/samples\[0\]\.transferredBytes/);
    });

    it("원소 stalled 가 비-boolean → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          makeSample(100, 100, {
            stalled: "yes" as unknown as boolean,
          }),
        ]),
      ).toThrow(/samples\[0\]\.stalled.*boolean/);
    });

    it("원소 complete 가 비-boolean → TypeError", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          makeSample(100, 100, {
            complete: 1 as unknown as boolean,
          }),
        ]),
      ).toThrow(/samples\[0\]\.complete.*boolean/);
    });

    it("두 번째 원소가 부적합이면 그 index 를 박제한다", () => {
      expect(() =>
        summariseExportChunkThroughputSeries([
          makeSample(100, 100),
          makeSample(-5, 200),
        ]),
      ).toThrow(/samples\[1\]\.bytesPerSecond/);
    });
  });

  describe("flow / branch separation", () => {
    it("sampleCount === 0 분기 vs ≥ 1 분기가 다른 결과를 낸다", () => {
      const empty = summariseExportChunkThroughputSeries([]);
      const nonEmpty = summariseExportChunkThroughputSeries([
        makeSample(100, 100),
      ]);
      expect(empty.sampleCount).toBe(0);
      expect(nonEmpty.sampleCount).toBe(1);
      expect(empty.averageBytesPerSecond).toBe(0);
      expect(nonEmpty.averageBytesPerSecond).toBe(100);
    });

    it("monotonic true 분기(비-감소) vs false 분기(역행)", () => {
      const up = summariseExportChunkThroughputSeries([
        makeSample(100, 100),
        makeSample(100, 100),
        makeSample(100, 300),
      ]);
      const down = summariseExportChunkThroughputSeries([
        makeSample(100, 300),
        makeSample(100, 100),
      ]);
      expect(up.monotonicProgress).toBe(true);
      expect(down.monotonicProgress).toBe(false);
    });

    it("complete 마지막 sample true 분기 vs false 분기", () => {
      const done = summariseExportChunkThroughputSeries([
        makeSample(100, 100, { complete: true }),
      ]);
      const ongoing = summariseExportChunkThroughputSeries([
        makeSample(100, 100, { complete: false }),
      ]);
      expect(done.complete).toBe(true);
      expect(ongoing.complete).toBe(false);
    });

    it("peak === min 분기(전 sample 동일 rate) vs peak > min 분기", () => {
      const flat = summariseExportChunkThroughputSeries([
        makeSample(100, 100),
        makeSample(100, 200),
      ]);
      const varied = summariseExportChunkThroughputSeries([
        makeSample(100, 100),
        makeSample(200, 300),
      ]);
      expect(flat.peakBytesPerSecond).toBe(flat.minBytesPerSecond);
      expect(varied.peakBytesPerSecond).toBeGreaterThan(
        varied.minBytesPerSecond,
      );
    });
  });

  describe("negative cases / invariants / non-mutation", () => {
    it("불변을 빈 배열·단일·정상·전부정체·교차정체·역행 전수로 검증한다", () => {
      const cases: ExportChunkStreamThroughput[][] = [
        [],
        [makeSample(100, 100)],
        [makeSample(50, 50), makeSample(150, 200)],
        [makeStalledSample(0), makeStalledSample(0)],
        [makeStalledSample(0), makeSample(100, 100), makeStalledSample(100)],
        [makeSample(100, 1000), makeSample(100, 800)],
      ];
      for (const c of cases) {
        assertInvariants(summariseExportChunkThroughputSeries(c));
      }
    });

    it("입력 배열·원소를 변형하지 않는다(deepFreeze 통과)", () => {
      const samples = deepFreeze([
        makeSample(100, 100),
        makeStalledSample(100),
      ]);
      expect(() => summariseExportChunkThroughputSeries(samples)).not.toThrow();
    });

    it("반환 객체는 호출마다 새 인스턴스이면서 deep-equal 이다(순수·결정성)", () => {
      const samples = [makeSample(100, 100), makeSample(200, 300)];
      const a = summariseExportChunkThroughputSeries(samples);
      const b = summariseExportChunkThroughputSeries(samples);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });
});
