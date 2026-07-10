import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  buildBaselineReport,
  BaselineEnvMeta,
  resolveBaselinePath,
} from "./latency-baseline";
import {
  readBaselineFile,
  readCompareBaselineFile,
} from "./latency-baseline-io";
import {
  collectLatencySamples,
  assertS2Threshold,
  measureBaselineCandidate,
  measureAndConfirmBaseline,
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

  /**
   * T-0875 — measure→candidate 조립 harness `measureBaselineCandidate` 의 R-112 spec.
   * collect→assert→build 위임을 주입 request·clock 으로 결정론적으로 검증하고,
   * 하위 예외가 부작용 없이 그대로 전파됨을 확인한다.
   */
  describe("measureBaselineCandidate (S2 measure→candidate 조립)", () => {
    /** 표준 env-meta fixture. */
    const env: BaselineEnvMeta = { label: "ci-test", concurrency: 4 };

    describe("happy path — 수동 조립과 동치", () => {
      it("반환 BaselineReport 가 collect+assert+build 수동 조립과 동치", async () => {
        const now = stepClock(10);
        const report = await measureBaselineCandidate(okRequest, env, {
          iterations: 5,
          now,
        });
        // 동일 입력을 수동 조립: collect → assert → build.
        const collected = await collectLatencySamples(okRequest, 5, {
          now: stepClock(10),
        });
        const assertion = assertS2Threshold(collected);
        const manual = buildBaselineReport(env, assertion);
        expect(report.env).toEqual(manual.env);
        expect(report.p50).toBe(manual.p50);
        expect(report.p95).toBe(manual.p95);
        expect(report.p99).toBe(manual.p99);
        expect(report.throughput).toBeCloseTo(manual.throughput, 10);
        expect(report.errorRate).toBe(manual.errorRate);
        expect(report.count).toBe(manual.count);
        expect(report.pass).toBe(manual.pass);
      });

      it("iterations 미지정 → 기본 30 회 호출(주입 request 호출 횟수로 검증)", async () => {
        const req = jest.fn(okRequest);
        const report = await measureBaselineCandidate(req, env, {
          now: stepClock(1),
        });
        expect(req).toHaveBeenCalledTimes(30);
        expect(report.count).toBe(30);
        expect(report.pass).toBe(true);
      });
    });

    describe("error path — 하위 예외 그대로 전파(부작용 없음)", () => {
      it("request 가 함수 아님(null) → collectLatencySamples TypeError 전파", async () => {
        await expect(
          measureBaselineCandidate(null as unknown as RequestFn, env),
        ).rejects.toThrow(TypeError);
      });

      it("opts.iterations 음수 → collectLatencySamples RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(okRequest, env, { iterations: -1 }),
        ).rejects.toThrow(RangeError);
      });

      it("opts.iterations 비정수 → collectLatencySamples RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(okRequest, env, { iterations: 2.5 }),
        ).rejects.toThrow(RangeError);
      });

      it("opts.iterations NaN → collectLatencySamples RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(okRequest, env, { iterations: NaN }),
        ).rejects.toThrow(RangeError);
      });

      it("opts.thresholds.p95MaxMs 음수 → assertS2Threshold RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(okRequest, env, {
            iterations: 3,
            now: stepClock(5),
            thresholds: { p95MaxMs: -1 },
          }),
        ).rejects.toThrow(RangeError);
      });

      it("opts.thresholds.errorRateMax NaN → assertS2Threshold RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(okRequest, env, {
            iterations: 3,
            now: stepClock(5),
            thresholds: { errorRateMax: NaN },
          }),
        ).rejects.toThrow(RangeError);
      });

      it("env 형태 불량(null) → buildBaselineReport TypeError 전파", async () => {
        await expect(
          measureBaselineCandidate(
            okRequest,
            null as unknown as BaselineEnvMeta,
            { iterations: 2, now: stepClock(5) },
          ),
        ).rejects.toThrow(TypeError);
      });

      it("env.label 빈 string → buildBaselineReport RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(
            okRequest,
            { label: "  ", concurrency: 1 },
            { iterations: 2, now: stepClock(5) },
          ),
        ).rejects.toThrow(RangeError);
      });

      it("env.concurrency 음수 → buildBaselineReport RangeError 전파", async () => {
        await expect(
          measureBaselineCandidate(
            okRequest,
            { label: "ci", concurrency: -1 },
            { iterations: 2, now: stepClock(5) },
          ),
        ).rejects.toThrow(RangeError);
      });

      it("clock 비단조 → collectLatencySamples RangeError 전파(판정·조립 미도달)", async () => {
        const buildSpy = jest.fn(okRequest);
        let call = 0;
        const nonMonotonic = () => {
          call++;
          return call === 1 ? 100 : 50;
        };
        await expect(
          measureBaselineCandidate(buildSpy, env, {
            iterations: 1,
            now: nonMonotonic,
          }),
        ).rejects.toThrow(RangeError);
      });
    });

    describe("flow / branch — 옵션 위임 경로 분리", () => {
      it("opts.iterations 지정 시 그 값이 collectLatencySamples 로 전달됨", async () => {
        const req = jest.fn(okRequest);
        await measureBaselineCandidate(req, env, {
          iterations: 7,
          now: stepClock(1),
        });
        expect(req).toHaveBeenCalledTimes(7);
      });

      it("opts 미지정 시 기본 30 이 쓰임", async () => {
        const req = jest.fn(okRequest);
        // opts 자체를 생략(기본 clock·기본 thresholds·기본 iterations).
        const report = await measureBaselineCandidate(req, env);
        expect(req).toHaveBeenCalledTimes(30);
        expect(report.count).toBe(30);
      });

      it("opts.now 지정 시 clock 주입이 collector 로 전달됨(결정론적 표본)", async () => {
        const report = await measureBaselineCandidate(okRequest, env, {
          iterations: 5,
          now: stepClock(10),
        });
        // stepClock(10) 5회 → 모든 표본 10ms → p50/p95/p99 === 10.
        expect(report.p50).toBe(10);
        expect(report.p95).toBe(10);
        expect(report.p99).toBe(10);
      });

      it("opts.now 미지정 시 기본 clock 로 동작(표본 count 는 iterations)", async () => {
        const report = await measureBaselineCandidate(okRequest, env, {
          iterations: 3,
        });
        // 실 clock 이라 값은 비결정적이지만 count 는 확정.
        expect(report.count).toBe(3);
        expect(report.pass).toBe(true);
      });

      it("opts.thresholds 지정(p95MaxMs 낮춤) → pass=false 유도", async () => {
        const report = await measureBaselineCandidate(okRequest, env, {
          iterations: 5,
          now: stepClock(10),
          // 표본은 전부 10ms → p95=10. 상한 5 로 낮추면 임계 초과.
          thresholds: { p95MaxMs: 5 },
        });
        expect(report.pass).toBe(false);
      });

      it("opts.thresholds 미지정 → 기본 임계(p95<3000)로 pass=true", async () => {
        const report = await measureBaselineCandidate(okRequest, env, {
          iterations: 5,
          now: stepClock(10),
        });
        expect(report.pass).toBe(true);
      });
    });

    describe("negative cases 충분 cover", () => {
      it("opts 전체 undefined → 기본 iterations 30·기본 thresholds·기본 clock 로 정상 동작", async () => {
        const req = jest.fn(okRequest);
        const report = await measureBaselineCandidate(req, env);
        expect(req).toHaveBeenCalledTimes(30);
        expect(report.pass).toBe(true);
        expect(report.count).toBe(30);
      });

      it("iterations=0 → 빈 표본, throw 없이 pass=false·NaN percentile candidate 반환", async () => {
        const req = jest.fn(okRequest);
        const report = await measureBaselineCandidate(req, env, {
          iterations: 0,
          now: stepClock(1),
        });
        // 호출 0 회, 예외 아님(관찰 전용).
        expect(req).not.toHaveBeenCalled();
        expect(report.count).toBe(0);
        expect(Number.isNaN(report.p95)).toBe(true);
        expect(report.pass).toBe(false);
      });

      it("일부 non-2xx/reject → errorRate>0·failures 반영된 candidate 반환", async () => {
        // 4 회 중 2 회 실패(교대) → errorRate 0.5.
        let i = 0;
        const flaky: RequestFn = async () => {
          i++;
          if (i % 2 === 0) {
            throw new Error("네트워크 오류");
          }
          return { ok: true };
        };
        const report = await measureBaselineCandidate(flaky, env, {
          iterations: 4,
          now: stepClock(2),
        });
        expect(report.errorRate).toBeCloseTo(0.5, 10);
        // 실패는 candidate 로 노출만 되고 throw 하지 않음.
        expect(report.count).toBe(2);
      });

      it("임계 위반은 candidate.pass=false 로만 노출되고 함수는 throw 하지 않음", async () => {
        // p95MaxMs 를 낮춰 위반 유도 — resolve(reject 아님) 확인.
        const report = await measureBaselineCandidate(okRequest, env, {
          iterations: 5,
          now: stepClock(10),
          thresholds: { p95MaxMs: 1 },
        });
        expect(report.pass).toBe(false);
        // throw 하지 않았으므로 여기 도달 자체가 관찰 전용 계약 검증.
        expect(report.env).toEqual(env);
      });
    });
  });

  /**
   * T-0876 — measure→confirm-or-compare end-to-end loop harness `measureAndConfirmBaseline` 의
   * R-112 spec. measureBaselineCandidate(candidate 생산) → confirmOrCompareBaseline(최초 확정 write |
   * 로드·비교) 조립을 주입 request·clock 과 격리 임시 디렉토리에서 결정론적으로 검증한다.
   * happy-path(established/compared 양 분기) / error path(각 예외 부작용 없이 그대로 전파) /
   * flow·branch(부재→established vs 존재→compared, measure/compare 옵션 위임) / negative cases
   * 충분 cover(undefined·임계위반 established·회귀 comparison.regressed·measure reject 시 부작용 0).
   * confirmOrCompareBaseline 의 disk 부작용은 매 test 격리 임시 디렉토리에서만 일으키고 정리한다.
   */
  describe("measureAndConfirmBaseline (S2 measure→confirm-or-compare loop)", () => {
    /** 표준 env-meta fixture. */
    const env: BaselineEnvMeta = { label: "ci-loop", concurrency: 4 };

    /** 매 test 격리 임시 디렉토리 루트(afterEach 재귀 삭제). */
    let tmpRoot: string;

    beforeEach(() => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s2-measure-confirm-"));
    });

    afterEach(() => {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    /** tmpRoot 하위 POSIX 결합 baseline 디렉토리(테스트 공통 baseDir). */
    function baselineDir(...segments: string[]): string {
      return path.posix.join(tmpRoot.split(path.sep).join("/"), ...segments);
    }

    describe("happy path — established(최초 확정) / compared(비교) 양 분기", () => {
      it("(a) baseline 부재 → outcome=established + path, candidate 가 디스크에 write(round-trip 동치)", async () => {
        const baseDir = baselineDir("baselines");
        // 동일 입력으로 수동 조립한 candidate 와 비교하기 위해 결정론 clock·iterations 고정.
        const measure = { iterations: 5, now: stepClock(10) };

        const result = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure,
          },
        );

        expect(result.outcome).toBe("established");
        if (result.outcome === "established") {
          expect(result.path).toBe(resolveBaselinePath(env, baseDir));
          expect(fs.existsSync(result.path)).toBe(true);
          // 디스크 파일 내용이 measureBaselineCandidate 산출 candidate 와 round-trip 동치.
          const expectedCandidate = await measureBaselineCandidate(
            okRequest,
            env,
            {
              iterations: 5,
              now: stepClock(10),
            },
          );
          const persisted = readBaselineFile(env, baseDir);
          expect(persisted).toEqual(expectedCandidate);
        }
      });

      it("(b) baseline 존재 → outcome=compared + comparison·report, 수동 조립 동치(자기 비교 회귀 0)", async () => {
        const baseDir = baselineDir("baselines");
        const measure = { iterations: 5, now: stepClock(10) };

        // 1차 — 최초 확정 write.
        const first = await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure,
        });
        expect(first.outcome).toBe("established");

        // 2차 — 존재하므로 로드·비교. 동일 측정이라 회귀 0.
        const second = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure: { iterations: 5, now: stepClock(10) },
          },
        );
        expect(second.outcome).toBe("compared");
        if (second.outcome === "compared") {
          expect(second.comparison.regressed).toBe(false);
          // measureBaselineCandidate 결과가 그대로 confirm 으로 전달돼 수동 조립과 동치.
          const candidate = await measureBaselineCandidate(okRequest, env, {
            iterations: 5,
            now: stepClock(10),
          });
          const expected = readCompareBaselineFile(env, baseDir, candidate);
          expect(second.comparison).toEqual(expected.comparison);
          expect(second.report).toBe(expected.report);
        }
      });
    });

    describe("error path — 하위 예외 그대로 전파(부작용 없음)", () => {
      it("(1) request 가 함수 아님(null) → measure TypeError 전파, confirm 미도달(파일 미생성)", async () => {
        const baseDir = baselineDir("baselines");
        await expect(
          measureAndConfirmBaseline(null as unknown as RequestFn, env, baseDir),
        ).rejects.toThrow(TypeError);
        expect(fs.existsSync(baseDir)).toBe(false);
      });

      it("(2) opts.measure.iterations 음수 → measure RangeError 전파", async () => {
        const baseDir = baselineDir("baselines");
        await expect(
          measureAndConfirmBaseline(okRequest, env, baseDir, {
            measure: { iterations: -1 },
          }),
        ).rejects.toThrow(RangeError);
        expect(fs.existsSync(baseDir)).toBe(false);
      });

      it("(2b) opts.measure.iterations NaN → measure RangeError 전파", async () => {
        const baseDir = baselineDir("baselines");
        await expect(
          measureAndConfirmBaseline(okRequest, env, baseDir, {
            measure: { iterations: NaN },
          }),
        ).rejects.toThrow(RangeError);
      });

      it("(3) env 형태 불량(null) → measure(build) TypeError 전파", async () => {
        const baseDir = baselineDir("baselines");
        await expect(
          measureAndConfirmBaseline(
            okRequest,
            null as unknown as BaselineEnvMeta,
            baseDir,
            { measure: { iterations: 2, now: stepClock(5) } },
          ),
        ).rejects.toThrow(TypeError);
        expect(fs.existsSync(baseDir)).toBe(false);
      });

      it("(3b) env.label 빈/공백 → measure(build) RangeError 전파", async () => {
        const baseDir = baselineDir("baselines");
        await expect(
          measureAndConfirmBaseline(
            okRequest,
            { label: "  ", concurrency: 1 },
            baseDir,
            { measure: { iterations: 2, now: stepClock(5) } },
          ),
        ).rejects.toThrow(RangeError);
      });

      it("(4) baseDir non-string → confirmOrCompareBaseline TypeError 전파", async () => {
        await expect(
          measureAndConfirmBaseline(okRequest, env, 123 as unknown as string, {
            measure: { iterations: 2, now: stepClock(5) },
          }),
        ).rejects.toThrow(TypeError);
      });

      it("(5) baseDir 빈/공백-only → confirmOrCompareBaseline RangeError 전파", async () => {
        await expect(
          measureAndConfirmBaseline(okRequest, env, "   ", {
            measure: { iterations: 2, now: stepClock(5) },
          }),
        ).rejects.toThrow(RangeError);
      });

      it("(6) 비교 분기에서 저장 파일 내용이 유효 JSON 아님(사전 손상) → SyntaxError 전파", async () => {
        const baseDir = baselineDir("baselines");
        // 먼저 정상 확정해 파일을 만든 뒤 내용을 손상시킨다(존재 분기 유도).
        const first = await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure: { iterations: 3, now: stepClock(5) },
        });
        expect(first.outcome).toBe("established");
        fs.writeFileSync(resolveBaselinePath(env, baseDir), "{not-json", {
          encoding: "utf-8",
        });
        await expect(
          measureAndConfirmBaseline(okRequest, env, baseDir, {
            measure: { iterations: 3, now: stepClock(5) },
          }),
        ).rejects.toThrow(SyntaxError);
      });

      it("(7) opts.compare tolerance 음수 → 비교 분기 RangeError 전파", async () => {
        const baseDir = baselineDir("baselines");
        // 확정으로 존재 분기 준비.
        await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure: { iterations: 3, now: stepClock(5) },
        });
        await expect(
          measureAndConfirmBaseline(okRequest, env, baseDir, {
            measure: { iterations: 3, now: stepClock(5) },
            compare: { latencyTolerance: -1 },
          }),
        ).rejects.toThrow(RangeError);
      });
    });

    describe("flow / branch — 부재→established vs 존재→compared, 옵션 위임", () => {
      it("baseline 부재 → established 분기(write 발생) vs 존재 → compared 분기(write 없이 read·compare)", async () => {
        const baseDir = baselineDir("baselines");
        const first = await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure: { iterations: 4, now: stepClock(10) },
        });
        expect(first.outcome).toBe("established");
        // mtime 을 기록해 두 번째 호출이 write 하지 않음을 확인.
        const target = resolveBaselinePath(env, baseDir);
        const firstMtime = fs.statSync(target).mtimeMs;

        const second = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure: { iterations: 4, now: stepClock(10) },
          },
        );
        expect(second.outcome).toBe("compared");
        // 존재 분기는 read-only — 파일이 재기록되지 않음.
        expect(fs.statSync(target).mtimeMs).toBe(firstMtime);
      });

      it("opts.measure.iterations 지정 시 measureBaselineCandidate 로 전달(호출 횟수로 검증)", async () => {
        const baseDir = baselineDir("baselines");
        const req = jest.fn(okRequest);
        await measureAndConfirmBaseline(req, env, baseDir, {
          measure: { iterations: 7, now: stepClock(1) },
        });
        expect(req).toHaveBeenCalledTimes(7);
      });

      it("opts.measure 미지정 시 기본 30 이 measure 로 위임(호출 횟수 30)", async () => {
        const baseDir = baselineDir("baselines");
        const req = jest.fn(okRequest);
        // measure 미지정(clock 기본) — 호출 횟수만 검증.
        const result = await measureAndConfirmBaseline(req, env, baseDir);
        expect(req).toHaveBeenCalledTimes(30);
        expect(result.outcome).toBe("established");
      });

      it("opts.compare 지정(tolerance 좁힘) → 비교 분기 comparison.regressed=true 유도", async () => {
        const baseDir = baselineDir("baselines");
        // 1차 — 빠른 baseline 확정(표본 10ms).
        await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure: { iterations: 5, now: stepClock(10) },
        });
        // 2차 — 느린 candidate(표본 100ms) + tolerance 0 → 회귀.
        const result = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure: { iterations: 5, now: stepClock(100) },
            compare: { latencyTolerance: 0 },
          },
        );
        expect(result.outcome).toBe("compared");
        if (result.outcome === "compared") {
          expect(result.comparison.regressed).toBe(true);
        }
      });

      it("opts.compare 미지정 → 기본 tolerance(+10%)로 소폭 증가는 회귀 아님", async () => {
        const baseDir = baselineDir("baselines");
        await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure: { iterations: 5, now: stepClock(100) },
        });
        // candidate 105ms(+5%) < 기본 tolerance 10% → 회귀 아님.
        const result = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure: { iterations: 5, now: stepClock(105) },
          },
        );
        expect(result.outcome).toBe("compared");
        if (result.outcome === "compared") {
          expect(result.comparison.regressed).toBe(false);
        }
      });
    });

    describe("negative cases 충분 cover", () => {
      it("opts=undefined → 기본 measure(iterations 30)·기본 compare 로 정상 established", async () => {
        const baseDir = baselineDir("baselines");
        const req = jest.fn(okRequest);
        const result = await measureAndConfirmBaseline(req, env, baseDir);
        expect(req).toHaveBeenCalledTimes(30);
        expect(result.outcome).toBe("established");
        if (result.outcome === "established") {
          expect(fs.existsSync(result.path)).toBe(true);
        }
      });

      it("established 분기 candidate 가 임계 위반(pass=false)이어도 throw 없이 write, pass=false 가 파일에 저장", async () => {
        const baseDir = baselineDir("baselines");
        // p95MaxMs 낮춰 pass=false 유도 — 관찰 전용이라 write 는 수행.
        const result = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure: {
              iterations: 5,
              now: stepClock(10),
              thresholds: { p95MaxMs: 1 },
            },
          },
        );
        expect(result.outcome).toBe("established");
        if (result.outcome === "established") {
          const persisted = readBaselineFile(env, baseDir);
          // pass=false candidate 가 그대로 파일에 저장됨(관찰 전용).
          expect(persisted.pass).toBe(false);
        }
      });

      it("compared 분기 회귀 발생(tolerance 좁힘)은 comparison.regressed=true 로만 노출·함수는 throw 안 함", async () => {
        const baseDir = baselineDir("baselines");
        await measureAndConfirmBaseline(okRequest, env, baseDir, {
          measure: { iterations: 5, now: stepClock(10) },
        });
        // 회귀해도 resolve(reject 아님) 확인.
        const result = await measureAndConfirmBaseline(
          okRequest,
          env,
          baseDir,
          {
            measure: { iterations: 5, now: stepClock(100) },
            compare: { latencyTolerance: 0 },
          },
        );
        expect(result.outcome).toBe("compared");
        if (result.outcome === "compared") {
          expect(result.comparison.regressed).toBe(true);
        }
      });

      it("measure 가 reject(주입 request throw) → confirm 미도달로 파일 미생성(부작용 0)", async () => {
        const baseDir = baselineDir("baselines");
        // request 자체가 함수 아님이 아니라, env 형태 불량으로 build 단계 reject → confirm 미도달.
        // 여기서는 request 가 함수지만 env.label 공백으로 measure 가 reject 하는 경로를 검증.
        await expect(
          measureAndConfirmBaseline(
            okRequest,
            { label: "  ", concurrency: 1 },
            baseDir,
            { measure: { iterations: 3, now: stepClock(5) } },
          ),
        ).rejects.toThrow(RangeError);
        // confirm 미도달 → baseDir 자체가 생성되지 않음(write 부작용 0).
        expect(fs.existsSync(baseDir)).toBe(false);
      });
    });
  });
});
