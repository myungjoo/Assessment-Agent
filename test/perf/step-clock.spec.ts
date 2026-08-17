import { measureBaselineCandidate } from "./latency-collector";
import { createStepClock } from "./step-clock";

/**
 * T-1581 — 승격한 `stepClock` 관용구의 R-112 spec(happy / error / 분기 / negative).
 * 순수 함수라 fs · 전역 상태 · 타이머 의존이 0 이며, 마지막 국면만 collector 계약과의 semantic
 * 정합(홀수=구간 시작 · 짝수=구간 끝)을 실제 주입으로 대조한다.
 */
describe("step-clock — perf-spec 주입 monotonic clock (REQ-048, ADR-0056 §Follow-ups (b))", () => {
  /** clock 을 `n` 회 호출한 시퀀스를 모은다. */
  const drain = (clock: () => number, n: number): number[] =>
    Array.from({ length: n }, () => clock());

  describe("happy path — 결정론적 step 시퀀스", () => {
    it("createStepClock(5) 의 연속 호출이 [0, 5, 5, 10, 10, 15] 를 낸다", () => {
      expect(drain(createStepClock(5), 6)).toEqual([0, 5, 5, 10, 10, 15]);
    });

    it("서로 다른 두 인스턴스가 상태를 공유하지 않는다", () => {
      const a = createStepClock(5);
      const b = createStepClock(100);
      expect(drain(a, 2)).toEqual([0, 5]);
      // b 는 a 의 전진과 무관하게 자기 0 에서 시작한다.
      expect(drain(b, 2)).toEqual([0, 100]);
      // a 를 다시 태워도 b 호출이 a 의 call 계수를 건드리지 않았다.
      expect(drain(a, 2)).toEqual([5, 10]);
    });

    it("반환값이 함수이며 생성 자체는 clock 을 전진시키지 않는다", () => {
      const clock = createStepClock(7);
      expect(typeof clock).toBe("function");
      expect(clock()).toBe(0);
    });
  });

  describe("error path — 인자 형태 위반", () => {
    it.each([
      ["string", "5"],
      ["undefined", undefined],
      ["null", null],
      ["boolean", true],
      ["object", { stepMs: 5 }],
      ["array", [5]],
    ])("non-number(%s) 는 TypeError 로 거부한다", (_label, bad) => {
      expect(() => createStepClock(bad as unknown as number)).toThrow(
        TypeError,
      );
      expect(() => createStepClock(bad as unknown as number)).toThrow(
        /stepMs 는 number 여야 함/,
      );
    });

    it.each([
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["-Infinity", Number.NEGATIVE_INFINITY],
    ])("비유한 값(%s) 은 RangeError 로 거부한다", (_label, bad) => {
      expect(() => createStepClock(bad)).toThrow(RangeError);
      expect(() => createStepClock(bad)).toThrow(/유한한 값이어야 함/);
    });

    it.each([-1, -0.5, -1e6])(
      "음수 stepMs(%p) 는 monotonic 위배라 RangeError 로 거부한다",
      (bad) => {
        expect(() => createStepClock(bad)).toThrow(RangeError);
        expect(() => createStepClock(bad)).toThrow(/음수일 수 없음/);
      },
    );

    it("예외 국면에서 clock 이 생성되지 않는다(부작용 0)", () => {
      let created: unknown;
      expect(() => {
        created = createStepClock("x" as unknown as number);
      }).toThrow(TypeError);
      expect(created).toBeUndefined();
      // 실패한 생성 시도가 이후 정상 인스턴스의 시작값을 오염시키지 않는다.
      expect(drain(createStepClock(3), 4)).toEqual([0, 3, 3, 6]);
    });
  });

  describe("분기 cover — 홀수 · 짝수 · 경계값", () => {
    it("홀수번째 호출 분기는 현재 값을 유지한다", () => {
      const clock = createStepClock(4);
      expect(clock()).toBe(0); // 1 번째(홀수) — 유지
      clock(); // 2 번째로 전진
      expect(clock()).toBe(4); // 3 번째(홀수) — 유지
      clock();
      expect(clock()).toBe(8); // 5 번째(홀수) — 유지
    });

    it("짝수번째 호출 분기는 stepMs 만큼 전진한다", () => {
      const clock = createStepClock(4);
      clock();
      expect(clock()).toBe(4); // 2 번째(짝수)
      clock();
      expect(clock()).toBe(8); // 4 번째(짝수)
    });

    it("경계값 stepMs = 0 은 모든 표본이 같은 값이며 비감소를 유지한다", () => {
      const seq = drain(createStepClock(0), 8);
      expect(seq).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
      expect(seq.every((v, i) => i === 0 || v >= seq[i - 1])).toBe(true);
    });
  });

  describe("negative cases — 오용 · 누적 국면", () => {
    it("반환 clock 에 인자를 넘겨도 무시하고 같은 시퀀스를 유지한다", () => {
      const clock = createStepClock(5) as (...args: unknown[]) => number;
      expect([clock(999), clock("x"), clock(null), clock({})]).toEqual([
        0, 5, 5, 10,
      ]);
    });

    it("20 회 연속 호출에서 값이 비감소로 유지된다", () => {
      const seq = drain(createStepClock(3), 20);
      expect(seq).toHaveLength(20);
      expect(seq.every((v, i) => i === 0 || v >= seq[i - 1])).toBe(true);
      expect(seq[19]).toBe(30); // 20 회 = 구간 10 개 × 3ms
    });

    it("큰 stepMs 누적이 부동소수 오차 없이 정확하다", () => {
      const step = 1_000_000;
      const seq = drain(createStepClock(step), 20);
      expect(seq[19]).toBe(step * 10);
      expect(Number.isInteger(seq[19])).toBe(true);
    });

    it("소수 stepMs 도 구간 폭이 일정하게 유지된다", () => {
      const clock = createStepClock(0.5);
      const seq = drain(clock, 6);
      // 구간 폭(짝수 - 직전 홀수)이 모두 0.5 — 부동소수 누적에도 폭이 흔들리지 않는다.
      expect(seq[1] - seq[0]).toBeCloseTo(0.5, 10);
      expect(seq[3] - seq[2]).toBeCloseTo(0.5, 10);
      expect(seq[5] - seq[4]).toBeCloseTo(0.5, 10);
    });
  });

  describe("collector 계약 정합 — measureBaselineCandidate 주입", () => {
    it("주입 시 각 구간 표본이 정확히 stepMs 로 결정론화된다", async () => {
      const report = await measureBaselineCandidate(
        () => Promise.resolve({ status: 200 }),
        { label: "step-clock-spec", concurrency: 1 },
        { iterations: 3, now: createStepClock(12) },
      );
      expect(report.p50).toBe(12);
      expect(report.p95).toBe(12);
      expect(report.count).toBe(3);
    });
  });
});
