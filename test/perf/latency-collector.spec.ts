import {
  collectLatencySamples,
  assertS2Threshold,
  RequestFn,
  CollectResult,
} from "./latency-collector";

/**
 * T-0829 — S2 조회 latency 표본 수집기 harness 의 R-112 spec.
 * happy-path / error path / flow·branch / negative cases 충분 cover.
 * 요청 함수·clock 을 주입해 DB·네트워크 없이 결정론적으로 검증한다(colocated unit).
 */
describe("latency-collector harness (S2)", () => {
  /**
   * 주입용 결정론적 clock — 호출마다 고정 step(ms)씩 증가.
   * `collectLatencySamples` 는 호출당 now() 를 2회(start/end) 부르므로
   * elapsed = step 이 되도록 만든다.
   */
  function stepClock(stepMs: number): () => number {
    let t = 0;
    let call = 0;
    return () => {
      const v = t;
      call++;
      // 홀수번째(start) 후에는 그대로, 짝수번째(end)에서 step 만큼 진행.
      if (call % 2 === 1) {
        // start: 값 반환만
        return v;
      }
      t += stepMs;
      return t;
    };
  }

  /** 항상 2xx(ok=true) 를 반환하는 요청 함수. */
  const okRequest: RequestFn = async () => ({ ok: true });

  describe("collectLatencySamples — happy path", () => {
    it("정상 요청 N회 → samplesMs.length === iterations, failures === 0", async () => {
      const res = await collectLatencySamples(okRequest, 5, {
        now: stepClock(10),
      });
      expect(res.total).toBe(5);
      expect(res.samplesMs).toHaveLength(5);
      expect(res.failures).toBe(0);
      // 각 표본은 step(10ms).
      expect(res.samplesMs.every((s) => s === 10)).toBe(true);
    });

    it("elapsedMs = 첫 시작~마지막 종료 wall-clock 경과(주입 clock 기준 정확)", async () => {
      // stepClock(10): 호출당 start=t, end=t+10 로 t 가 10 씩 누적.
      // 5 회 반복이면 firstStart=0, lastEnd=50 → elapsedMs=50.
      const res = await collectLatencySamples(okRequest, 5, {
        now: stepClock(10),
      });
      expect(res.elapsedMs).toBe(50);
    });

    it("status 코드 기반 2xx 판정(ok 미제공)", async () => {
      const req: RequestFn = async () => ({ status: 204 });
      const res = await collectLatencySamples(req, 3, { now: stepClock(5) });
      expect(res.failures).toBe(0);
      expect(res.samplesMs).toHaveLength(3);
    });
  });

  describe("collectLatencySamples — error path / negative cases", () => {
    it("non-2xx(status) → failure 로 정확 카운트, 표본 제외", async () => {
      const req: RequestFn = async () => ({ status: 500 });
      const res = await collectLatencySamples(req, 4, { now: stepClock(7) });
      expect(res.failures).toBe(4);
      expect(res.samplesMs).toHaveLength(0);
      expect(res.total).toBe(4);
    });

    it("ok=false → failure 집계", async () => {
      const req: RequestFn = async () => ({ ok: false });
      const res = await collectLatencySamples(req, 2, { now: stepClock(3) });
      expect(res.failures).toBe(2);
    });

    it("요청 함수 reject(throw) → failure 로 집계(표본 제외)", async () => {
      const req: RequestFn = async () => {
        throw new Error("네트워크 오류");
      };
      const res = await collectLatencySamples(req, 3, { now: stepClock(9) });
      expect(res.failures).toBe(3);
      expect(res.samplesMs).toHaveLength(0);
    });

    it("ok/status 둘 다 없는 응답 → 실패로 방어", async () => {
      const req: RequestFn = async () => ({});
      const res = await collectLatencySamples(req, 2, { now: stepClock(1) });
      expect(res.failures).toBe(2);
    });

    it("성공/실패 혼합 → 각각 정확 분류", async () => {
      let i = 0;
      const req: RequestFn = async () => {
        i++;
        return i % 2 === 0 ? { ok: false } : { ok: true };
      };
      const res = await collectLatencySamples(req, 4, { now: stepClock(2) });
      expect(res.total).toBe(4);
      expect(res.failures).toBe(2);
      expect(res.samplesMs).toHaveLength(2);
    });

    it("request 가 함수 아님 → TypeError", async () => {
      await expect(
        collectLatencySamples(null as unknown as RequestFn, 1),
      ).rejects.toThrow(TypeError);
    });

    it("iterations 음수 → RangeError", async () => {
      await expect(collectLatencySamples(okRequest, -1)).rejects.toThrow(
        RangeError,
      );
    });

    it("iterations 비정수 → RangeError", async () => {
      await expect(collectLatencySamples(okRequest, 2.5)).rejects.toThrow(
        RangeError,
      );
    });

    it("iterations NaN → RangeError", async () => {
      await expect(collectLatencySamples(okRequest, NaN)).rejects.toThrow(
        RangeError,
      );
    });

    it("비단조 clock(감소) → RangeError", async () => {
      // start=100, end=50 → elapsed -50.
      let call = 0;
      const nonMonotonic = () => {
        call++;
        return call === 1 ? 100 : 50;
      };
      await expect(
        collectLatencySamples(okRequest, 1, { now: nonMonotonic }),
      ).rejects.toThrow(RangeError);
    });
  });

  describe("collectLatencySamples — branch: iterations === 0", () => {
    it("iterations 0 → 빈 표본, 호출 없음, elapsedMs === 0", async () => {
      const req = jest.fn(okRequest);
      const res = await collectLatencySamples(req, 0, { now: stepClock(1) });
      expect(res.samplesMs).toHaveLength(0);
      expect(res.total).toBe(0);
      expect(res.failures).toBe(0);
      expect(res.elapsedMs).toBe(0);
      expect(req).not.toHaveBeenCalled();
    });

    it("opts 생략 → 기본 performance.now 로 동작(표본 수집)", async () => {
      const res = await collectLatencySamples(okRequest, 2);
      expect(res.samplesMs).toHaveLength(2);
      expect(res.failures).toBe(0);
      // 실 clock 이라 값은 비결정적이지만 음수는 아님.
      expect(res.samplesMs.every((s) => s >= 0)).toBe(true);
    });
  });

  describe("assertS2Threshold — happy path (pass=true 분기)", () => {
    it("낮은 latency + 실패 0 → pass === true, reasons 빈 배열", () => {
      const result: CollectResult = {
        samplesMs: [10, 12, 11, 9, 15],
        total: 5,
        failures: 0,
        elapsedMs: 100,
      };
      const a = assertS2Threshold(result);
      expect(a.pass).toBe(true);
      expect(a.reasons).toHaveLength(0);
      expect(a.errorRate).toBe(0);
      expect(a.summary.count).toBe(5);
    });
  });

  describe("assertS2Threshold — branch: pass=false", () => {
    it("p95 임계 초과 → pass=false, p95 사유", () => {
      const samples = Array.from({ length: 100 }, () => 5000); // 전부 5s
      const result: CollectResult = {
        samplesMs: samples,
        total: 100,
        failures: 0,
        elapsedMs: 500000,
      };
      const a = assertS2Threshold(result);
      expect(a.pass).toBe(false);
      expect(a.reasons.some((r) => r.includes("p95 임계 초과"))).toBe(true);
    });

    it("errorRate 임계 초과 → pass=false, error rate 사유", () => {
      const result: CollectResult = {
        samplesMs: [10, 10, 10, 10, 10, 10, 10, 10, 10],
        total: 100,
        failures: 91,
        elapsedMs: 1000,
      };
      const a = assertS2Threshold(result);
      expect(a.pass).toBe(false);
      expect(a.reasons.some((r) => r.includes("error rate 임계 초과"))).toBe(
        true,
      );
    });

    it("빈 표본(성공 0) → p95 NaN → 측정 불가 fail 사유", () => {
      const result: CollectResult = {
        samplesMs: [],
        total: 5,
        failures: 5,
        elapsedMs: 200,
      };
      const a = assertS2Threshold(result);
      expect(a.pass).toBe(false);
      expect(a.reasons.some((r) => r.includes("측정 불가"))).toBe(true);
    });

    it("p95 와 errorRate 동시 초과 → 사유 2건", () => {
      const samples = Array.from({ length: 50 }, () => 4000);
      const result: CollectResult = {
        samplesMs: samples,
        total: 100,
        failures: 50,
        elapsedMs: 200000,
      };
      const a = assertS2Threshold(result);
      expect(a.pass).toBe(false);
      expect(a.reasons).toHaveLength(2);
    });
  });

  describe("assertS2Threshold — custom thresholds + negative cases", () => {
    it("custom p95MaxMs 로 통과 임계 조정", () => {
      const result: CollectResult = {
        samplesMs: [2000, 2100, 1900],
        total: 3,
        failures: 0,
        elapsedMs: 6000,
      };
      // 기본 3000 이하라 pass, 상한 1000 으로 낮추면 fail.
      expect(assertS2Threshold(result).pass).toBe(true);
      expect(assertS2Threshold(result, { p95MaxMs: 1000 }).pass).toBe(false);
    });

    it("custom errorRateMax(0 = 무관용) 로 실패 1건도 fail", () => {
      const result: CollectResult = {
        samplesMs: [10, 20],
        total: 3,
        failures: 1,
        elapsedMs: 100,
      };
      const a = assertS2Threshold(result, { errorRateMax: 0 });
      expect(a.pass).toBe(false);
    });

    it("result 형태 비정상(null) → TypeError", () => {
      expect(() => assertS2Threshold(null as unknown as CollectResult)).toThrow(
        TypeError,
      );
    });

    it("result.samplesMs 비배열 → TypeError", () => {
      expect(() =>
        assertS2Threshold({
          samplesMs: "x",
          total: 1,
          failures: 0,
        } as unknown as CollectResult),
      ).toThrow(TypeError);
    });

    it("p95MaxMs 음수 → RangeError", () => {
      const result: CollectResult = {
        samplesMs: [1],
        total: 1,
        failures: 0,
        elapsedMs: 100,
      };
      expect(() => assertS2Threshold(result, { p95MaxMs: -1 })).toThrow(
        RangeError,
      );
    });

    it("errorRateMax NaN → RangeError", () => {
      const result: CollectResult = {
        samplesMs: [1],
        total: 1,
        failures: 0,
        elapsedMs: 100,
      };
      expect(() => assertS2Threshold(result, { errorRateMax: NaN })).toThrow(
        RangeError,
      );
    });

    it("p95MaxMs 비수치 → RangeError", () => {
      const result: CollectResult = {
        samplesMs: [1],
        total: 1,
        failures: 0,
        elapsedMs: 1000,
      };
      expect(() =>
        assertS2Threshold(result, {
          p95MaxMs: "3000" as unknown as number,
        }),
      ).toThrow(RangeError);
    });
  });

  describe("assertS2Threshold — throughput 배선 (§3 관찰 지표)", () => {
    it("happy: 성공 표본 N + elapsedMs → throughput = count/(elapsedMs/1000), pass 유지", () => {
      // 성공 표본 6개, 총 경과 2000ms(=2s) → 6 / 2 = 3 req/s.
      const result: CollectResult = {
        samplesMs: [10, 12, 11, 9, 15, 13],
        total: 6,
        failures: 0,
        elapsedMs: 2000,
      };
      const a = assertS2Threshold(result);
      expect(a.throughput).toBeCloseTo(3, 10);
      // throughput 은 관찰 전용 — pass 판정에 영향 없음(낮은 latency + 실패 0 → pass).
      expect(a.pass).toBe(true);
      expect(a.reasons).toHaveLength(0);
    });

    it("branch (b): 성공 표본 >0 & elapsedMs>0 → 정상 req/s(1000ms 에 4건 → 4 req/s)", () => {
      const result: CollectResult = {
        samplesMs: [5, 5, 5, 5],
        total: 4,
        failures: 0,
        elapsedMs: 1000,
      };
      expect(assertS2Threshold(result).throughput).toBeCloseTo(4, 10);
    });

    it("branch (a): 성공 표본 0(전부 실패) → throughput === 0(elapsedMs 무관)", () => {
      const result: CollectResult = {
        samplesMs: [],
        total: 5,
        failures: 5,
        elapsedMs: 1234,
      };
      const a = assertS2Threshold(result);
      expect(a.throughput).toBe(0);
      // 성공 표본 0 이라 측정 불가 fail 은 유지되지만 throughput 은 0 으로 방어.
      expect(a.pass).toBe(false);
    });

    it("branch (c): iterations=0 결과(elapsedMs=0 & count=0) → throughput === 0", () => {
      const result: CollectResult = {
        samplesMs: [],
        total: 0,
        failures: 0,
        elapsedMs: 0,
      };
      expect(assertS2Threshold(result).throughput).toBe(0);
    });

    it("negative: 빈 표본에서 throughput 이 NaN/Infinity 아니라 0 으로 방어", () => {
      const result: CollectResult = {
        samplesMs: [],
        total: 3,
        failures: 3,
        elapsedMs: 500,
      };
      const t = assertS2Threshold(result).throughput;
      expect(Number.isNaN(t)).toBe(false);
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBe(0);
    });

    it("negative: legacy CollectResult(elapsedMs 필드 누락) + 성공 표본 0 → throughput 0(결정론적)", () => {
      // elapsedMs 미제공 → undefined → 0 취급. 성공 표본 0 이라 primitive 가 안전하게 0 반환.
      const legacy = {
        samplesMs: [] as number[],
        total: 4,
        failures: 4,
      } as unknown as CollectResult;
      expect(assertS2Threshold(legacy).throughput).toBe(0);
    });

    it("negative: legacy CollectResult(elapsedMs 누락) + 성공 표본 >0 → clamp 로 결정론적 유한값(Infinity/throw 없음)", () => {
      // elapsedMs undefined → 0 취급이나 count>0 이면 collector 가 최소 1ms 로 clamp 해
      // primitive 의 count>0 && elapsedMs===0 RangeError 경계를 회피(Infinity 도 차단).
      // count=2, elapsedMs=1ms → 2/(1/1000)=2000 req/s 로 결정론적.
      const legacy = {
        samplesMs: [10, 20],
        total: 2,
        failures: 0,
      } as unknown as CollectResult;
      const t = assertS2Threshold(legacy).throughput;
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeCloseTo(2000, 6);
    });

    it("negative: 극단적으로 빠른 반복(elapsedMs<0.5ms → round 0) + 성공 표본 >0 → clamp 1ms 로 방어", () => {
      // round(0.4)=0 이지만 count>0 이라 collector 가 1ms 로 clamp → RangeError/Infinity 없음.
      const result: CollectResult = {
        samplesMs: [0.1, 0.1, 0.1],
        total: 3,
        failures: 0,
        elapsedMs: 0.4,
      };
      const t = assertS2Threshold(result).throughput;
      expect(Number.isFinite(t)).toBe(true);
      expect(t).toBeCloseTo(3000, 6);
    });

    it("negative: 단조 clock 위반으로 음수 elapsed → collectLatencySamples RangeError 유지", async () => {
      // throughput 배선 후에도 collector 의 비단조 clock 방어가 그대로 동작.
      let call = 0;
      const nonMonotonic = () => {
        call++;
        return call === 1 ? 100 : 40;
      };
      await expect(
        collectLatencySamples(okRequest, 1, { now: nonMonotonic }),
      ).rejects.toThrow(RangeError);
    });

    it("error path: throughput 배선 후에도 result 형태 검증(TypeError) 유지", () => {
      expect(() => assertS2Threshold(null as unknown as CollectResult)).toThrow(
        TypeError,
      );
    });

    it("error path: throughput 배선 후에도 thresholds RangeError(음수/NaN) 유지", () => {
      const result: CollectResult = {
        samplesMs: [1],
        total: 1,
        failures: 0,
        elapsedMs: 100,
      };
      expect(() => assertS2Threshold(result, { p95MaxMs: -1 })).toThrow(
        RangeError,
      );
      expect(() => assertS2Threshold(result, { errorRateMax: NaN })).toThrow(
        RangeError,
      );
    });

    it("end-to-end: collectLatencySamples → assertS2Threshold throughput 산출", async () => {
      // stepClock(10) 5회 → elapsedMs=50ms, 성공 표본 5. throughput=5/(50/1000)=100 req/s.
      const collected = await collectLatencySamples(okRequest, 5, {
        now: stepClock(10),
      });
      expect(collected.elapsedMs).toBe(50);
      const a = assertS2Threshold(collected);
      expect(a.throughput).toBeCloseTo(100, 10);
      expect(a.pass).toBe(true);
    });
  });
});
