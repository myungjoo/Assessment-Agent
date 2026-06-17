// export-job-plan.spec — buildExportJobPlan(T-0467) 단위 테스트. R-112 4 종(happy / error /
// flow·branch / negative 충분 cover)을 채운다. UC-07 §8 NFR(async job + status polling +
// chunked streaming) 정합 검증.
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";
import {
  buildExportJobPlan,
  DEFAULT_CHUNK_THRESHOLD_BYTES,
  DEFAULT_POLL_INTERVAL_SECONDS,
  ExportJobPlanOptions,
} from "./export-job-plan";

// 테스트용 estimate 조립 helper — 필드 일부만 override 한다. perEntityBytes 등 본 helper 가
// 쓰지 않는 필드는 형식만 채운다.
function makeEstimate(
  over: Partial<ExportDumpSizeEstimate> = {},
): ExportDumpSizeEstimate {
  return {
    estimatedBytes: 2048,
    humanSize: "2 KB",
    recordTotal: 2,
    perEntityBytes: {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    large: false,
    recommendation: "sync",
    guidanceLines: [],
    ...over,
  };
}

describe("buildExportJobPlan — happy path", () => {
  it("async-streaming estimate → mode=async-job·pollingRequired·statusFlow·chunked·instructionLines", () => {
    const estimate = makeEstimate({
      estimatedBytes: 20 * 1024 * 1024, // 20 MB — default chunk threshold(5 MB) 초과
      humanSize: "20 MB",
      recordTotal: 20000,
      large: true,
      recommendation: "async-streaming",
    });

    const plan = buildExportJobPlan(estimate);

    expect(plan.mode).toBe("async-job");
    expect(plan.pollingRequired).toBe(true);
    expect(plan.statusFlow).toEqual(["queued", "running", "ready"]);
    expect(plan.chunked).toBe(true);
    expect(plan.headline).toContain("async job");
    expect(plan.headline).toContain("20 MB");
    expect(plan.instructionLines.length).toBeGreaterThan(0);
    // polling 간격 default(3 초) + chunked 다운로드 안내가 instructionLines 에 박제.
    expect(plan.instructionLines.join("\n")).toContain(
      `${DEFAULT_POLL_INTERVAL_SECONDS} 초`,
    );
    expect(plan.instructionLines.join("\n")).toContain("chunked streaming");
  });

  it("sync estimate → mode=sync-download·statusFlow=[]·pollingRequired=false", () => {
    const estimate = makeEstimate({
      estimatedBytes: 1024,
      humanSize: "1 KB",
      recommendation: "sync",
    });

    const plan = buildExportJobPlan(estimate);

    expect(plan.mode).toBe("sync-download");
    expect(plan.pollingRequired).toBe(false);
    expect(plan.statusFlow).toEqual([]);
    expect(plan.chunked).toBe(false);
    expect(plan.headline).toContain("즉시 동기 다운로드");
    expect(plan.instructionLines.join("\n")).toContain("즉시 다운로드");
  });
});

describe("buildExportJobPlan — error path 입력 방어", () => {
  it("estimate 가 비-object(null/배열/원시값) → TypeError(label estimate)", () => {
    expect(() => buildExportJobPlan(null as never)).toThrow(TypeError);
    expect(() => buildExportJobPlan(null as never)).toThrow(/estimate/);
    expect(() => buildExportJobPlan([] as never)).toThrow(/array/);
    expect(() => buildExportJobPlan(42 as never)).toThrow(/number/);
  });

  it("recommendation 이 허용 외 값 → RangeError(받은 값 박제)", () => {
    const estimate = makeEstimate({ recommendation: "weird" as never });
    expect(() => buildExportJobPlan(estimate)).toThrow(RangeError);
    expect(() => buildExportJobPlan(estimate)).toThrow(/weird/);
  });

  it("recommendation 이 string 아님 → RangeError", () => {
    const estimate = makeEstimate({ recommendation: 1 as never });
    expect(() => buildExportJobPlan(estimate)).toThrow(RangeError);
  });

  it("estimatedBytes 가 음수·소수·NaN·Infinity·비-number → TypeError", () => {
    for (const bad of [-1, 1.5, NaN, Infinity, -Infinity, "10" as never]) {
      const estimate = makeEstimate({ estimatedBytes: bad as never });
      expect(() => buildExportJobPlan(estimate)).toThrow(TypeError);
      expect(() => buildExportJobPlan(estimate)).toThrow(/estimatedBytes/);
    }
  });

  it("options 가 비-object(배열/null) → TypeError(label options)", () => {
    const estimate = makeEstimate();
    expect(() => buildExportJobPlan(estimate, [] as never)).toThrow(TypeError);
    expect(() => buildExportJobPlan(estimate, [] as never)).toThrow(/options/);
    expect(() => buildExportJobPlan(estimate, null as never)).toThrow(
      TypeError,
    );
  });

  it("chunkThresholdBytes 가 부적합 → TypeError(어느 옵션인지 박제)", () => {
    const estimate = makeEstimate();
    for (const bad of [-1, 2.5, NaN, Infinity, "1" as never]) {
      const opts = { chunkThresholdBytes: bad } as ExportJobPlanOptions;
      expect(() => buildExportJobPlan(estimate, opts)).toThrow(TypeError);
      expect(() => buildExportJobPlan(estimate, opts)).toThrow(
        /chunkThresholdBytes/,
      );
    }
  });

  it("pollIntervalSeconds 가 부적합 → TypeError(어느 옵션인지 박제)", () => {
    const estimate = makeEstimate();
    for (const bad of [-1, 2.5, NaN, Infinity, "1" as never]) {
      const opts = { pollIntervalSeconds: bad } as ExportJobPlanOptions;
      expect(() => buildExportJobPlan(estimate, opts)).toThrow(TypeError);
      expect(() => buildExportJobPlan(estimate, opts)).toThrow(
        /pollIntervalSeconds/,
      );
    }
  });
});

describe("buildExportJobPlan — flow / branch 분리", () => {
  it("chunked 분기 — 초과/이하/경계값(경계 === 는 초과 아님)", () => {
    // 경계: estimatedBytes === chunkThresholdBytes → 초과 아님 → chunked=false.
    const atBoundary = makeEstimate({ estimatedBytes: 1000 });
    expect(
      buildExportJobPlan(atBoundary, { chunkThresholdBytes: 1000 }).chunked,
    ).toBe(false);

    // 이하: estimatedBytes < threshold → chunked=false.
    const below = makeEstimate({ estimatedBytes: 999 });
    expect(
      buildExportJobPlan(below, { chunkThresholdBytes: 1000 }).chunked,
    ).toBe(false);

    // 초과: estimatedBytes > threshold → chunked=true.
    const above = makeEstimate({ estimatedBytes: 1001 });
    expect(
      buildExportJobPlan(above, { chunkThresholdBytes: 1000 }).chunked,
    ).toBe(true);
  });

  it("options 미지정 시 default chunkThreshold·default pollInterval 적용", () => {
    // default chunk threshold(5 MB) 바로 아래 → chunked=false.
    const justBelow = makeEstimate({
      estimatedBytes: DEFAULT_CHUNK_THRESHOLD_BYTES,
    });
    expect(buildExportJobPlan(justBelow).chunked).toBe(false);

    // default chunk threshold 초과 → chunked=true.
    const justAbove = makeEstimate({
      estimatedBytes: DEFAULT_CHUNK_THRESHOLD_BYTES + 1,
    });
    expect(buildExportJobPlan(justAbove).chunked).toBe(true);

    // async plan 의 polling 안내에 default 간격 박제.
    const asyncEst = makeEstimate({
      estimatedBytes: DEFAULT_CHUNK_THRESHOLD_BYTES + 1,
      recommendation: "async-streaming",
      large: true,
    });
    expect(buildExportJobPlan(asyncEst).instructionLines.join("\n")).toContain(
      `${DEFAULT_POLL_INTERVAL_SECONDS} 초`,
    );
  });

  it("pollIntervalSeconds 지정 시 instructionLines 문구 반영", () => {
    const asyncEst = makeEstimate({
      estimatedBytes: 20 * 1024 * 1024,
      humanSize: "20 MB",
      recommendation: "async-streaming",
      large: true,
    });
    const plan = buildExportJobPlan(asyncEst, { pollIntervalSeconds: 10 });
    expect(plan.instructionLines.join("\n")).toContain("10 초");
    expect(plan.instructionLines.join("\n")).not.toContain(
      `${DEFAULT_POLL_INTERVAL_SECONDS} 초`,
    );
  });

  it("async 인데 chunked=false 인 경우 — chunked streaming 문구 없이 일반 다운로드 안내", () => {
    // async-streaming 이지만 estimatedBytes 가 chunk threshold 이하면 chunked=false.
    const asyncSmall = makeEstimate({
      estimatedBytes: 1024,
      humanSize: "1 KB",
      recommendation: "async-streaming",
      large: true,
    });
    const plan = buildExportJobPlan(asyncSmall);
    expect(plan.mode).toBe("async-job");
    expect(plan.chunked).toBe(false);
    expect(plan.instructionLines.join("\n")).not.toContain("chunked streaming");
    expect(plan.instructionLines.join("\n")).toContain(
      "ready 가 되면 다운로드",
    );
  });

  it("sync 인데 chunked=true 인 경우 — 즉시 다운로드 + chunked streaming 안내", () => {
    // recommendation=sync(ground truth) 이지만 estimatedBytes 가 chunk threshold 초과.
    const plan = buildExportJobPlan(
      makeEstimate({ estimatedBytes: 2000, recommendation: "sync" }),
      { chunkThresholdBytes: 1000 },
    );
    expect(plan.mode).toBe("sync-download");
    expect(plan.chunked).toBe(true);
    expect(plan.instructionLines.join("\n")).toContain("chunked streaming");
  });
});

describe("buildExportJobPlan — negative cases 충분 cover", () => {
  it("3-동치 불변: async-job ⟺ pollingRequired ⟺ statusFlow.length>0", () => {
    const asyncPlan = buildExportJobPlan(
      makeEstimate({ recommendation: "async-streaming", large: true }),
    );
    expect(asyncPlan.mode === "async-job").toBe(true);
    expect(asyncPlan.pollingRequired).toBe(true);
    expect(asyncPlan.statusFlow.length > 0).toBe(true);

    const syncPlan = buildExportJobPlan(
      makeEstimate({ recommendation: "sync" }),
    );
    expect(syncPlan.mode === "async-job").toBe(false);
    expect(syncPlan.pollingRequired).toBe(false);
    expect(syncPlan.statusFlow.length > 0).toBe(false);
  });

  it("non-mutating — freeze 된 estimate / options 통과·입력 불변", () => {
    const estimate = Object.freeze(
      makeEstimate({ recommendation: "async-streaming", large: true }),
    );
    const options = Object.freeze({ pollIntervalSeconds: 7 });
    expect(() => buildExportJobPlan(estimate, options)).not.toThrow();

    const before = JSON.stringify(estimate);
    buildExportJobPlan(estimate, options);
    expect(JSON.stringify(estimate)).toBe(before);
  });

  it("반환 statusFlow 변형이 다음 호출에 누설되지 않음(항상 새 배열)", () => {
    const estimate = makeEstimate({
      recommendation: "async-streaming",
      large: true,
    });
    const plan1 = buildExportJobPlan(estimate);
    plan1.statusFlow.push("failed");
    const plan2 = buildExportJobPlan(estimate);
    expect(plan2.statusFlow).toEqual(["queued", "running", "ready"]);
  });

  it("모순 estimate(large=true 이지만 recommendation=sync) → recommendation 을 ground truth 로", () => {
    // T-0466 불변(large===(recommendation==="async-streaming"))이 깨진 입력 — 본 helper 는
    // recommendation 을 신뢰하고 large 는 무시한다(sync-download 산출).
    const contradictory = makeEstimate({
      large: true,
      recommendation: "sync",
    });
    const plan = buildExportJobPlan(contradictory);
    expect(plan.mode).toBe("sync-download");
    expect(plan.pollingRequired).toBe(false);
    expect(plan.statusFlow).toEqual([]);
  });

  it("humanSize 부재 estimate → estimatedBytes fallback 라벨 사용", () => {
    // humanSize 가 string 아님 → `${estimatedBytes} B` fallback.
    const noHuman = makeEstimate({
      estimatedBytes: 512,
      humanSize: undefined as never,
    });
    const plan = buildExportJobPlan(noHuman);
    expect(plan.headline).toContain("512 B");
  });

  it("estimatedBytes=0 정상 통과(0 허용) → sync 빈 statusFlow", () => {
    const zero = makeEstimate({ estimatedBytes: 0, humanSize: "0 B" });
    const plan = buildExportJobPlan(zero, { chunkThresholdBytes: 0 });
    expect(plan.chunked).toBe(false); // 0 > 0 은 false
    expect(plan.mode).toBe("sync-download");
  });
});
