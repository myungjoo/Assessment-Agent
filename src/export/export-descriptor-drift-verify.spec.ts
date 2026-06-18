// export-descriptor-drift-verify.spec — verifyExportDumpDescriptorDrift(T-0508) 단위 테스트.
// R-112 4 종(happy / error / flow·branch / negative 충분 cover)을 채운다. ADR-0046 §Decision 1
// (byteSizeHint = Buffer.byteLength(JSON.stringify(dump), "utf8") 직렬화 방식) + §Decision 3
// (descriptor single-source — hint·actual·plan.totalBytes drift 0 invariant) 정합 검증.
//
// 입력은 가급적 실 helper(buildExportDump + buildExportArtifactDescriptor + buildExportChunkPlan)
// 로 조립해 직렬화 방식·byteSizeHint·totalBytes 정합을 자연스럽게 보장한다. drift 분기는 descriptor
// 또는 plan 의 단일 필드만 손으로 조작해 stale 시나리오를 재현한다.
import {
  buildExportArtifactDescriptor,
  ExportArtifactDescriptor,
} from "./export-artifact-descriptor";
import { buildExportChunkPlan, ExportChunkPlan } from "./export-chunk-plan";
import {
  ExportDumpDescriptorDriftReport,
  verifyExportDumpDescriptorDrift,
} from "./export-descriptor-drift-verify";
import { buildExportDump, ExportDump } from "./export-dump";
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";
import { ExportRecord } from "./export-scope-select";

// 테스트용 dump 조립 — 실 buildExportDump 로 직렬화 가능한 valid envelope 를 만든다.
function makeDump(records: ExportRecord[] = []): ExportDump {
  return buildExportDump(records, {
    scope: { scope: "full" },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
}

// dump 의 실 직렬화 byte length — verifyExportDumpDescriptorDrift 가 강제하는 actualBytes
// 의 source. estimateByteSize(export-artifact-descriptor.ts) 와 동일한 산식.
function serializedLength(dump: ExportDump): number {
  return Buffer.byteLength(JSON.stringify(dump), "utf8");
}

// dump 에 정합하는 descriptor 를 실 buildExportArtifactDescriptor 로 조립한다.
function makeDescriptor(dump: ExportDump): ExportArtifactDescriptor {
  return buildExportArtifactDescriptor(dump, {
    now: new Date("2026-06-18T00:00:00.000Z"),
  });
}

// dump 의 직렬화 byte length 에 정합하는 plan 을 실 buildExportChunkPlan 으로 조립.
function makePlan(dump: ExportDump, chunkSizeBytes: number): ExportChunkPlan {
  const estimate: ExportDumpSizeEstimate = {
    estimatedBytes: serializedLength(dump),
    humanSize: "n B",
    recordTotal: dump.recordCount,
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
  };
  return buildExportChunkPlan(estimate, chunkSizeBytes);
}

// 한글 multi-byte record 를 섞은 dump — UTF-8 코드포인트가 정확히 byte 로 환산되는지 cover.
function makeKoreanDump(): ExportDump {
  const records: ExportRecord[] = [
    { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
    { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
  ];
  const dump = buildExportDump(records, {
    scope: {
      scope: "partial",
      entitySelector: ["Assessment", "Person"],
    },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
  // 한글 payload 를 직접 주입(직렬화 byte 에 multi-byte 가 섞이도록).
  (dump as unknown as { note: string }).note =
    "한글 멀티바이트 페이로드 가나다라마바사";
  return dump;
}

describe("verifyExportDumpDescriptorDrift — ADR-0046 §3 descriptor single-source 검증 helper", () => {
  describe("happy path — hint/actual/plan.totalBytes 일치", () => {
    it("(a) 실 buildExportArtifactDescriptor 로 만든 descriptor + 같은 dump (plan 미제공) → consistent: true, hintActualDelta: 0, planTotalBytes: null", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump);

      expect(report.consistent).toBe(true);
      expect(report.hintActualDelta).toBe(0);
      expect(report.planTotalBytes).toBeNull();
      expect(report.hintPlanDelta).toBeNull();
      expect(report.hintBytes).toBe(descriptor.byteSizeHint);
      expect(report.actualBytes).toBe(serializedLength(dump));
    });

    it("(b) plan 도 제공 (plan.totalBytes === actualBytes) → consistent: true, hintPlanDelta: 0", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "Group", instant: new Date("2026-06-18T02:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump, plan);

      expect(report.consistent).toBe(true);
      expect(report.hintActualDelta).toBe(0);
      expect(report.hintPlanDelta).toBe(0);
      expect(report.planTotalBytes).toBe(plan.totalBytes);
    });

    it("(c) 멀티바이트 한글 record 포함 dump 도 hint·actual 일치(UTF-8 byte 정확성)", () => {
      const dump = makeKoreanDump();
      // descriptor 의 byteSizeHint 는 estimateByteSize 와 같은 산식이므로 multi-byte 도 정확.
      const descriptor = makeDescriptor(dump);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump);

      expect(report.consistent).toBe(true);
      expect(report.actualBytes).toBe(serializedLength(dump));
      expect(report.hintBytes).toBe(report.actualBytes);
    });
  });

  describe("error path — 입력 방어", () => {
    it("(a) descriptor 가 plain object 가 아니면(null/숫자/배열) TypeError(한국어 message)", () => {
      const dump = makeDump();
      for (const bad of [null, undefined, 42, "str", [1, 2]]) {
        expect(() =>
          verifyExportDumpDescriptorDrift(
            bad as unknown as ExportArtifactDescriptor,
            dump,
          ),
        ).toThrow(TypeError);
        expect(() =>
          verifyExportDumpDescriptorDrift(
            bad as unknown as ExportArtifactDescriptor,
            dump,
          ),
        ).toThrow(/verifyExportDumpDescriptorDrift: descriptor 는/);
      }
    });

    it("(b) descriptor.byteSizeHint 가 비-음수 정수가 아니면(음수/NaN/소수/Infinity/문자열) TypeError", () => {
      const dump = makeDump();
      const baseDesc = makeDescriptor(dump);
      for (const badHint of [
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        "x",
        null,
      ]) {
        const bad = {
          ...baseDesc,
          byteSizeHint: badHint,
        } as unknown as ExportArtifactDescriptor;
        expect(() => verifyExportDumpDescriptorDrift(bad, dump)).toThrow(
          TypeError,
        );
        expect(() => verifyExportDumpDescriptorDrift(bad, dump)).toThrow(
          /descriptor\.byteSizeHint 는/,
        );
      }
    });

    it("(c) dump 가 plain object 가 아니면 TypeError", () => {
      const dump = makeDump();
      const desc = makeDescriptor(dump);
      for (const bad of [null, undefined, 42, "str", [1, 2]]) {
        expect(() =>
          verifyExportDumpDescriptorDrift(desc, bad as unknown as ExportDump),
        ).toThrow(TypeError);
        expect(() =>
          verifyExportDumpDescriptorDrift(desc, bad as unknown as ExportDump),
        ).toThrow(/verifyExportDumpDescriptorDrift: dump 는/);
      }
    });

    it("(d) plan 이 제공됐는데 plain object 가 아니면(배열/null/숫자) TypeError", () => {
      const dump = makeDump();
      const desc = makeDescriptor(dump);
      for (const bad of [null, 42, "str", [1, 2]]) {
        expect(() =>
          verifyExportDumpDescriptorDrift(
            desc,
            dump,
            bad as unknown as ExportChunkPlan,
          ),
        ).toThrow(TypeError);
        expect(() =>
          verifyExportDumpDescriptorDrift(
            desc,
            dump,
            bad as unknown as ExportChunkPlan,
          ),
        ).toThrow(/verifyExportDumpDescriptorDrift: plan 은/);
      }
    });

    it("(e) plan.totalBytes 가 비-음수 정수가 아니면 TypeError", () => {
      const dump = makeDump();
      const desc = makeDescriptor(dump);
      const basePlan = makePlan(dump, 4096);
      for (const badTotal of [
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        "x",
        null,
      ]) {
        const bad = {
          ...basePlan,
          totalBytes: badTotal,
        } as unknown as ExportChunkPlan;
        expect(() => verifyExportDumpDescriptorDrift(desc, dump, bad)).toThrow(
          TypeError,
        );
        expect(() => verifyExportDumpDescriptorDrift(desc, dump, bad)).toThrow(
          /plan\.totalBytes 는/,
        );
      }
    });
  });

  describe("branch coverage — 분기마다 분리", () => {
    it("(i) 입력 방어 분기 — descriptor 비-object → TypeError", () => {
      const dump = makeDump();
      expect(() =>
        verifyExportDumpDescriptorDrift(
          null as unknown as ExportArtifactDescriptor,
          dump,
        ),
      ).toThrow(TypeError);
    });

    it("(ii) plan 미제공 분기 — planTotalBytes: null / hintPlanDelta: null / consistent 는 hint-actual 만으로 판정", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump);

      expect(report.planTotalBytes).toBeNull();
      expect(report.hintPlanDelta).toBeNull();
      // hint===actual 이므로 plan 미제공 분기에서 consistent: true.
      expect(report.consistent).toBe(true);
    });

    it("(iii) plan 제공 + 전부 일치 분기 → consistent: true", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump, plan);

      expect(report.consistent).toBe(true);
      expect(report.hintActualDelta).toBe(0);
      expect(report.hintPlanDelta).toBe(0);
    });

    it("(iv) hint≠actual drift 분기 → consistent: false, delta≠0", () => {
      const dump = makeDump([
        { entity: "Group", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      // stale descriptor: hint 를 손으로 5 더 늘림.
      const drifted = {
        ...descriptor,
        byteSizeHint: descriptor.byteSizeHint + 5,
      };

      const report = verifyExportDumpDescriptorDrift(drifted, dump);

      expect(report.consistent).toBe(false);
      expect(report.hintActualDelta).toBe(5);
    });

    it("(v) hint===actual 이나 plan.totalBytes 어긋남 분기 → consistent: false, hintPlanDelta≠0", () => {
      const dump = makeDump([
        { entity: "LlmConfig", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);
      // plan stale: totalBytes 를 hint 와 다르게 조작(여전히 valid non-neg integer).
      const stalePlan = {
        ...plan,
        totalBytes: descriptor.byteSizeHint + 3,
      };

      const report = verifyExportDumpDescriptorDrift(
        descriptor,
        dump,
        stalePlan,
      );

      expect(report.consistent).toBe(false);
      // hint === actual 이므로 hintActualDelta 는 여전히 0.
      expect(report.hintActualDelta).toBe(0);
      expect(report.hintPlanDelta).toBe(-3);
    });
  });

  describe("negative cases — 충분 cover", () => {
    it("(a) stale descriptor: byteSizeHint 가 실 byte 보다 작음 → consistent: false, hintActualDelta 음수", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const stale = {
        ...descriptor,
        byteSizeHint: descriptor.byteSizeHint - 7,
      };

      const report = verifyExportDumpDescriptorDrift(stale, dump);

      expect(report.consistent).toBe(false);
      expect(report.hintActualDelta).toBe(-7);
      expect(report.hintActualDelta).toBeLessThan(0);
    });

    it("(b) stale descriptor: byteSizeHint 가 실 byte 보다 큼 → consistent: false, hintActualDelta 양수", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const stale = {
        ...descriptor,
        byteSizeHint: descriptor.byteSizeHint + 9,
      };

      const report = verifyExportDumpDescriptorDrift(stale, dump);

      expect(report.consistent).toBe(false);
      expect(report.hintActualDelta).toBe(9);
      expect(report.hintActualDelta).toBeGreaterThan(0);
    });

    it("(c) plan.totalBytes 가 hint 와 어긋남(hint===actual 이나 plan stale) → consistent: false", () => {
      const dump = makeDump();
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);
      const stalePlan = { ...plan, totalBytes: plan.totalBytes + 11 };

      const report = verifyExportDumpDescriptorDrift(
        descriptor,
        dump,
        stalePlan,
      );

      expect(report.consistent).toBe(false);
      expect(report.hintActualDelta).toBe(0);
      expect(report.hintPlanDelta).toBe(-11);
    });

    it("(d) byteSizeHint: 0 + 빈 envelope 의 실 byte > 0 → consistent: false (0 hint 도 정상 number 라 throw 아님)", () => {
      const dump = makeDump();
      const descriptor = makeDescriptor(dump);
      const zeroed = { ...descriptor, byteSizeHint: 0 };

      const report = verifyExportDumpDescriptorDrift(zeroed, dump);

      expect(report.consistent).toBe(false);
      expect(report.hintBytes).toBe(0);
      expect(report.actualBytes).toBeGreaterThan(0);
      expect(report.hintActualDelta).toBe(-report.actualBytes);
    });

    it("(e) non-mutating — Object.freeze(descriptor) + Object.freeze(dump) + Object.freeze(plan) 로 호출해도 throw 0 + 결과 정확", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);

      Object.freeze(dump);
      Object.freeze(descriptor);
      Object.freeze(plan);
      Object.freeze(plan.chunks);
      plan.chunks.forEach((c) => Object.freeze(c));

      let report: ExportDumpDescriptorDriftReport | undefined;
      expect(() => {
        report = verifyExportDumpDescriptorDrift(descriptor, dump, plan);
      }).not.toThrow();
      expect(report!.consistent).toBe(true);
      expect(report!.hintActualDelta).toBe(0);
      expect(report!.hintPlanDelta).toBe(0);
    });

    it("(f) 결정성 — 동일 입력 2 회 호출 결과가 모든 필드까지 동일", () => {
      const dump = makeDump([
        { entity: "Group", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "AuditLog", instant: new Date("2026-06-18T02:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);

      const a = verifyExportDumpDescriptorDrift(descriptor, dump, plan);
      const b = verifyExportDumpDescriptorDrift(descriptor, dump, plan);
      expect(a).toEqual(b);
    });

    it("(g) headline — consistent true 시 한국어 '일치', false 시 delta 수치 포함", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const descriptor = makeDescriptor(dump);

      const okReport = verifyExportDumpDescriptorDrift(descriptor, dump);
      expect(okReport.headline).toMatch(/일치/);
      expect(okReport.headline).not.toMatch(/불일치/);

      const drifted = {
        ...descriptor,
        byteSizeHint: descriptor.byteSizeHint + 3,
      };
      const badReport = verifyExportDumpDescriptorDrift(drifted, dump);
      expect(badReport.headline).toMatch(/불일치/);
      // delta 수치(3)가 message 에 포함.
      expect(badReport.headline).toMatch(/3/);
    });

    it("(h) headline (plan 제공 시) — plan.totalBytes 수치 포함", () => {
      const dump = makeDump();
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 4096);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump, plan);
      expect(report.headline).toMatch(/plan\.totalBytes=/);
      expect(report.headline).toMatch(new RegExp(String(plan.totalBytes)));
    });

    it("(i) 멀티바이트 한글 + plan 제공 + 전부 일치 — descriptor single-source invariant 가 한글에도 성립", () => {
      const dump = makeKoreanDump();
      const descriptor = makeDescriptor(dump);
      const plan = makePlan(dump, 7);

      const report = verifyExportDumpDescriptorDrift(descriptor, dump, plan);

      expect(report.consistent).toBe(true);
      expect(report.hintBytes).toBe(serializedLength(dump));
      expect(report.actualBytes).toBe(serializedLength(dump));
      expect(report.planTotalBytes).toBe(plan.totalBytes);
    });
  });
});
