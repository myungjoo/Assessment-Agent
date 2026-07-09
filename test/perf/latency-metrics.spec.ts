import {
  percentile,
  summarizeLatency,
  errorRate,
  throughput,
} from "./latency-metrics";

/**
 * T-0828 — S2 조회 latency 측정 primitive 의 R-112 spec.
 * happy-path / error path / flow·branch / negative cases 충분 cover.
 * 순수 함수라 DB·앱 부트스트랩 없이 완결(colocated unit).
 */
describe("latency-metrics primitive (S2 harness)", () => {
  // 1~100 의 표본(정렬 상태) — percentile 위치 검증에 사용.
  const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

  describe("percentile — happy path", () => {
    it("p50/p95/p99 를 알려진 표본에서 기대 위치로 산출한다", () => {
      // rank = p/100*(n-1) = p/100*99. p95 → rank 94.05 → 95 + 0.05*(96-95)=95.05
      expect(percentile(oneToHundred, 95)).toBeCloseTo(95.05, 5);
      expect(percentile(oneToHundred, 50)).toBeCloseTo(50.5, 5);
      expect(percentile(oneToHundred, 99)).toBeCloseTo(99.01, 5);
    });

    it("정렬 안 된 입력도 정렬 후 산출한다(원본 불변)", () => {
      const unsorted = [30, 10, 20, 50, 40];
      const copy = [...unsorted];
      expect(percentile(unsorted, 50)).toBe(30);
      expect(unsorted).toEqual(copy); // 원본 미변형
    });
  });

  describe("percentile — flow/branch cover", () => {
    it("빈 배열 → NaN", () => {
      expect(percentile([], 50)).toBeNaN();
    });

    it("단일 표본 → 그 값(p 무관)", () => {
      expect(percentile([42], 0)).toBe(42);
      expect(percentile([42], 100)).toBe(42);
      expect(percentile([42], 50)).toBe(42);
    });

    it("p=0 → 최소값, p=100 → 최대값(경계 분기)", () => {
      expect(percentile([5, 1, 9, 3], 0)).toBe(1);
      expect(percentile([5, 1, 9, 3], 100)).toBe(9);
    });

    it("보간 필요 경계(lo!==hi) → 선형 보간", () => {
      // [10,20], p=50 → rank 0.5 → 10 + 0.5*(20-10)=15
      expect(percentile([10, 20], 50)).toBe(15);
    });

    it("rank 가 정수(lo===hi) → 보간 없이 해당 표본", () => {
      // [10,20,30], p=50 → rank 1.0 → sorted[1]=20
      expect(percentile([10, 20, 30], 50)).toBe(20);
    });

    it("모두 동일 값 → 그 값", () => {
      expect(percentile([7, 7, 7, 7], 95)).toBe(7);
    });
  });

  describe("percentile — error path / negative cases", () => {
    it("p 음수 → RangeError", () => {
      expect(() => percentile([1, 2, 3], -1)).toThrow(RangeError);
    });

    it("p 100 초과 → RangeError", () => {
      expect(() => percentile([1, 2, 3], 101)).toThrow(RangeError);
    });

    it("p 가 NaN → RangeError", () => {
      expect(() => percentile([1, 2, 3], NaN)).toThrow(RangeError);
    });

    it("p 가 비수치 → RangeError", () => {
      // 런타임 방어(타입 우회 입력)
      expect(() => percentile([1, 2, 3], "50" as unknown as number)).toThrow(
        RangeError,
      );
    });

    it("표본에 NaN 원소 → TypeError", () => {
      expect(() => percentile([1, NaN, 3], 50)).toThrow(TypeError);
    });

    it("표본에 비수치 원소 → TypeError", () => {
      expect(() => percentile([1, "x" as unknown as number, 3], 50)).toThrow(
        TypeError,
      );
    });
  });

  describe("summarizeLatency — happy path", () => {
    it("요약 지표(p50/p95/p99/count/maxMs)를 산출한다", () => {
      const s = summarizeLatency(oneToHundred);
      expect(s.count).toBe(100);
      expect(s.maxMs).toBe(100);
      expect(s.p50).toBeCloseTo(50.5, 5);
      expect(s.p95).toBeCloseTo(95.05, 5);
      expect(s.p99).toBeCloseTo(99.01, 5);
    });

    it("단일 표본 → 모든 percentile 동일, maxMs 그 값", () => {
      const s = summarizeLatency([250]);
      expect(s).toEqual({ p50: 250, p95: 250, p99: 250, count: 1, maxMs: 250 });
    });
  });

  describe("summarizeLatency — error path / negative cases", () => {
    it("빈 배열 → percentile NaN, count 0, maxMs NaN", () => {
      const s = summarizeLatency([]);
      expect(s.count).toBe(0);
      expect(s.p50).toBeNaN();
      expect(s.p95).toBeNaN();
      expect(s.p99).toBeNaN();
      expect(s.maxMs).toBeNaN();
    });

    it("비수치 원소 → TypeError 전파(percentile 경유)", () => {
      expect(() => summarizeLatency([10, NaN, 30])).toThrow(TypeError);
    });
  });

  describe("errorRate — happy path", () => {
    it("10% 실패 → 0.1", () => {
      expect(errorRate(100, 10)).toBeCloseTo(0.1, 10);
    });

    it("실패 0 → 0, 전부 실패 → 1(경계)", () => {
      expect(errorRate(50, 0)).toBe(0);
      expect(errorRate(50, 50)).toBe(1);
    });
  });

  describe("errorRate — flow/branch + error path / negative cases", () => {
    it("total=0 → 0(요청 없음 방어 분기)", () => {
      expect(errorRate(0, 0)).toBe(0);
    });

    it("음수 total → RangeError", () => {
      expect(() => errorRate(-1, 0)).toThrow(RangeError);
    });

    it("음수 failures → RangeError", () => {
      expect(() => errorRate(10, -1)).toThrow(RangeError);
    });

    it("failures > total → RangeError", () => {
      expect(() => errorRate(10, 11)).toThrow(RangeError);
    });

    it("비정수 total/failures → RangeError(정수 검사 분기)", () => {
      expect(() => errorRate(10.5, 1)).toThrow(RangeError);
      expect(() => errorRate(10, 1.5)).toThrow(RangeError);
    });

    it("NaN 입력 → RangeError(정수 검사 분기)", () => {
      expect(() => errorRate(NaN, 0)).toThrow(RangeError);
    });
  });

  describe("throughput — happy path", () => {
    it("30 요청 / 1500ms → 20 req/s", () => {
      expect(throughput(30, 1500)).toBeCloseTo(20, 10);
    });

    it("1 요청 / 1000ms → 1 req/s(경계)", () => {
      expect(throughput(1, 1000)).toBeCloseTo(1, 10);
    });

    it("100 요청 / 250ms → 400 req/s(1s 미만 경과)", () => {
      expect(throughput(100, 250)).toBeCloseTo(400, 10);
    });
  });

  describe("throughput — flow/branch cover", () => {
    it("count=0 → 0(elapsedMs 무관 방어 분기)", () => {
      expect(throughput(0, 1500)).toBe(0);
    });

    it("count=0 && elapsedMs=0 → 0(count 분기가 elapsedMs 분기보다 우선)", () => {
      expect(throughput(0, 0)).toBe(0);
    });

    it("정상 나눗셈 분기(count>0 && elapsedMs>0) → count/(elapsedMs/1000)", () => {
      expect(throughput(60, 2000)).toBeCloseTo(30, 10);
    });
  });

  describe("throughput — error path / negative cases", () => {
    it("count>0 && elapsedMs=0 → RangeError(0 나눗셈 방어 분기)", () => {
      expect(() => throughput(5, 0)).toThrow(RangeError);
    });

    it("음수 count → RangeError", () => {
      expect(() => throughput(-1, 1000)).toThrow(RangeError);
    });

    it("음수 elapsedMs → RangeError", () => {
      expect(() => throughput(10, -1)).toThrow(RangeError);
    });

    it("비정수 count → RangeError(정수 검사 분기)", () => {
      expect(() => throughput(10.5, 1000)).toThrow(RangeError);
    });

    it("비정수 elapsedMs → RangeError(정수 검사 분기)", () => {
      expect(() => throughput(10, 1000.5)).toThrow(RangeError);
    });

    it("NaN count → RangeError(정수 검사 분기)", () => {
      expect(() => throughput(NaN, 1000)).toThrow(RangeError);
    });

    it("NaN elapsedMs → RangeError(정수 검사 분기)", () => {
      expect(() => throughput(10, NaN)).toThrow(RangeError);
    });
  });
});
