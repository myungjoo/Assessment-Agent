// export-dump-resume-slice.spec — selectRemainingMaterializedDumpChunks(T-0511) 단위 테스트. R-112
// 4 종(happy / error / flow·branch / negative 충분 cover)을 채운다. ADR-0046 §Decision 1 맞물림
// (iii)(resume plan 의 remainingChunks 가 재개 시 materialization subset 을 지시) + §Decision 3
// (resume plan single-source — 본 helper 가 경계를 재계산하지 않고 정합만 검증) 정합 검증.
//
// 입력은 가급적 실 helper(buildExportDump + buildExportChunkPlan + sliceMaterializedDumpByChunkPlan
// + buildExportChunkResumePlan)로 조립해 직렬화 방식·chunk 경계 정합을 자연스럽게 보장한다 — 맞물림
// invariant(반환 subset 의 byte 합 === 원본 직렬화 buffer 의 resumeFromByte.. 잔여 부분)를 실측한다.
import { buildExportChunkPlan, ExportChunkPlan } from "./export-chunk-plan";
import {
  buildExportChunkResumePlan,
  ExportChunkResumePlan,
} from "./export-chunk-resume-plan";
import { buildExportDump, ExportDump } from "./export-dump";
import {
  MaterializedExportDumpChunk,
  sliceMaterializedDumpByChunkPlan,
} from "./export-dump-chunk-slice";
import { selectRemainingMaterializedDumpChunks } from "./export-dump-resume-slice";
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";
import { ExportRecord } from "./export-scope-select";

// 테스트용 dump 조립 — 실 buildExportDump 로 직렬화 가능한 valid envelope 를 만든다.
function makeDump(records: ExportRecord[] = []): ExportDump {
  return buildExportDump(records, {
    scope: { scope: "full" },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
}

// 한글 multi-byte record 를 섞은 dump — UTF-8 코드포인트 중간을 자르는 byte 경계도 cover.
function makeKoreanDump(): ExportDump {
  const records: ExportRecord[] = [
    { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
    { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
    { entity: "Group", instant: new Date("2026-06-18T03:00:00.000Z") },
    { entity: "LlmConfig", instant: new Date("2026-06-18T04:00:00.000Z") },
  ];
  return makeDump(records);
}

// dump 의 실 직렬화 byte length — plan.totalBytes invariant 의 source.
function serializedLength(dump: ExportDump): number {
  return Buffer.byteLength(JSON.stringify(dump), "utf8");
}

// dump 직렬화 byte length 에 정합하는 plan 을 실 buildExportChunkPlan 으로 조립.
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

// dump → materialized chunk[] + resume plan(acknowledgedChunks) 한 번에 조립하는 fixture.
function fixture(
  dump: ExportDump,
  chunkSizeBytes: number,
  acknowledgedChunks: number,
): {
  materialized: MaterializedExportDumpChunk[];
  resumePlan: ExportChunkResumePlan;
  plan: ExportChunkPlan;
  serialized: Buffer;
} {
  const plan = makePlan(dump, chunkSizeBytes);
  const materialized = sliceMaterializedDumpByChunkPlan(dump, plan);
  const resumePlan = buildExportChunkResumePlan(plan, acknowledgedChunks);
  const serialized = Buffer.from(JSON.stringify(dump), "utf8");
  return { materialized, resumePlan, plan, serialized };
}

describe("selectRemainingMaterializedDumpChunks", () => {
  // ── Happy path ──────────────────────────────────────────────────────────
  describe("happy path", () => {
    it("resumeNeeded=true 일 때 remainingChunks 에 대응하는 subset 을 index 오름차순으로 반환한다", () => {
      const dump = makeKoreanDump();
      // chunkSize 를 작게 잡아 다수 chunk 가 생기게 한다.
      const { materialized, resumePlan } = fixture(dump, 16, 2);

      const result = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );

      expect(result).toHaveLength(resumePlan.remainingChunkCount);
      // index 오름차순 + 원본 materialized 와 메타·byte 정확히 일치.
      for (let i = 0; i < result.length; i += 1) {
        const planChunk = resumePlan.remainingChunks[i];
        const origin = materialized.find((m) => m.index === planChunk.index)!;
        expect(result[i].index).toBe(origin.index);
        expect(result[i].offsetBytes).toBe(origin.offsetBytes);
        expect(result[i].sizeBytes).toBe(origin.sizeBytes);
        expect(result[i].last).toBe(origin.last);
        expect(result[i].bytes.equals(origin.bytes)).toBe(true);
        if (i > 0) {
          expect(result[i].index).toBeGreaterThan(result[i - 1].index);
        }
      }
    });

    it("반환 subset 의 bytes 를 concat 하면 원본 직렬화 buffer 의 resumeFromByte.. 잔여 부분과 byte-동일하다 (맞물림 invariant)", () => {
      const dump = makeKoreanDump();
      const { materialized, resumePlan, serialized } = fixture(dump, 16, 1);

      const result = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );

      const concatenated = Buffer.concat(result.map((c) => c.bytes));
      expect(
        concatenated.equals(serialized.subarray(resumePlan.resumeFromByte)),
      ).toBe(true);
      expect(concatenated).toHaveLength(resumePlan.remainingBytes);
    });
  });

  // ── 분기 (branch coverage) ─────────────────────────────────────────────
  describe("branch coverage", () => {
    it("resumeNeeded=false (전부 ack) 면 빈 배열을 반환한다 (throw 0)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const materialized = sliceMaterializedDumpByChunkPlan(dump, plan);
      const resumePlan = buildExportChunkResumePlan(plan, plan.chunkCount);

      expect(resumePlan.resumeNeeded).toBe(false);
      expect(
        selectRemainingMaterializedDumpChunks(materialized, resumePlan),
      ).toEqual([]);
    });

    it("단일 remaining chunk 분기 — 마지막 1 개만 잔여", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, resumePlan } = fixture(
        dump,
        16,
        plan.chunkCount - 1,
      );

      const result = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );
      expect(result).toHaveLength(1);
      expect(result[0].last).toBe(true);
    });

    it("다수 remaining chunk 분기 — 중간부터 잔여", () => {
      const dump = makeKoreanDump();
      const { materialized, resumePlan } = fixture(dump, 16, 1);

      const result = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );
      expect(result.length).toBeGreaterThan(1);
      expect(result).toHaveLength(resumePlan.remainingChunkCount);
    });

    it("acknowledgedChunks=0 (전부 remaining) 경계 — 전체 chunk 를 반환한다 (맞물림 invariant 특수 경우)", () => {
      const dump = makeKoreanDump();
      const { materialized, resumePlan } = fixture(dump, 16, 0);

      const result = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );
      expect(result).toHaveLength(materialized.length);
      for (let i = 0; i < result.length; i += 1) {
        expect(result[i].bytes.equals(materialized[i].bytes)).toBe(true);
      }
    });

    it("acknowledgedChunks=chunkCount (전부 ack) 경계 — 빈 배열을 반환한다 (맞물림 invariant 특수 경우)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const materialized = sliceMaterializedDumpByChunkPlan(dump, plan);
      const resumePlan = buildExportChunkResumePlan(plan, plan.chunkCount);

      expect(
        selectRemainingMaterializedDumpChunks(materialized, resumePlan),
      ).toEqual([]);
    });

    it("빈 dump (chunkCount 0, resumeNeeded=false) — 빈 배열을 반환한다 (throw 0)", () => {
      // 0-byte estimate 로 chunkCount 0 plan 을 만들면 materialized 도 [], resume plan 도
      // resumeNeeded=false / remainingChunks [] 가 되는 진짜 빈 dump 경계다.
      const estimate: ExportDumpSizeEstimate = {
        estimatedBytes: 0,
        humanSize: "0 B",
        recordTotal: 0,
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
      const plan = buildExportChunkPlan(estimate, 1024);
      const resumePlan = buildExportChunkResumePlan(plan, 0);

      expect(plan.chunkCount).toBe(0);
      expect(resumePlan.resumeNeeded).toBe(false);
      expect(selectRemainingMaterializedDumpChunks([], resumePlan)).toEqual([]);
    });
  });

  // ── Error path / negative cases ────────────────────────────────────────
  describe("error paths / negative cases", () => {
    function validPair(): {
      materialized: MaterializedExportDumpChunk[];
      resumePlan: ExportChunkResumePlan;
    } {
      const dump = makeKoreanDump();
      const { materialized, resumePlan } = fixture(dump, 16, 1);
      return { materialized, resumePlan };
    }

    it("(a) materializedChunks=null → TypeError", () => {
      const { resumePlan } = validPair();
      expect(() =>
        selectRemainingMaterializedDumpChunks(
          null as unknown as MaterializedExportDumpChunk[],
          resumePlan,
        ),
      ).toThrow(TypeError);
    });

    it("(b) materializedChunks={} (비-배열 object) → TypeError", () => {
      const { resumePlan } = validPair();
      expect(() =>
        selectRemainingMaterializedDumpChunks(
          {} as unknown as MaterializedExportDumpChunk[],
          resumePlan,
        ),
      ).toThrow(/배열이어야 합니다/);
    });

    it("(c) resumePlan=null → TypeError", () => {
      const { materialized } = validPair();
      expect(() =>
        selectRemainingMaterializedDumpChunks(
          materialized,
          null as unknown as ExportChunkResumePlan,
        ),
      ).toThrow(TypeError);
    });

    it("(d) resumePlan=배열 → TypeError", () => {
      const { materialized } = validPair();
      expect(() =>
        selectRemainingMaterializedDumpChunks(
          materialized,
          [] as unknown as ExportChunkResumePlan,
        ),
      ).toThrow(/plain object 여야 합니다/);
    });

    it("(e) resumePlan.remainingChunks=null → TypeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken = {
        ...resumePlan,
        remainingChunks:
          null as unknown as ExportChunkResumePlan["remainingChunks"],
      };
      expect(() =>
        selectRemainingMaterializedDumpChunks(materialized, broken),
      ).toThrow(/remainingChunks 는 배열이어야 합니다/);
    });

    it("(f) remainingChunkCount ≠ remainingChunks.length → RangeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken = {
        ...resumePlan,
        remainingChunkCount: resumePlan.remainingChunkCount + 1,
      };
      expect(() =>
        selectRemainingMaterializedDumpChunks(materialized, broken),
      ).toThrow(RangeError);
    });

    it("(g) remainingChunks 에 materialized 범위 밖 index (99) → RangeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken: ExportChunkResumePlan = {
        ...resumePlan,
        remainingChunks: resumePlan.remainingChunks.map((c, i) =>
          i === 0 ? { ...c, index: 99 } : c,
        ),
      };
      expect(() =>
        selectRemainingMaterializedDumpChunks(materialized, broken),
      ).toThrow(/대응하는 materialized chunk 가 없습니다/);
    });

    it("(h) 경계 메타 drift (offsetBytes 불일치) → RangeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken: ExportChunkResumePlan = {
        ...resumePlan,
        remainingChunks: resumePlan.remainingChunks.map((c, i) =>
          i === 0 ? { ...c, offsetBytes: c.offsetBytes + 1 } : c,
        ),
      };
      expect(() =>
        selectRemainingMaterializedDumpChunks(materialized, broken),
      ).toThrow(/single-source drift/);
    });

    it("(h2) 경계 메타 drift (sizeBytes 불일치) → RangeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken: ExportChunkResumePlan = {
        ...resumePlan,
        remainingChunks: resumePlan.remainingChunks.map((c, i) =>
          i === 0 ? { ...c, sizeBytes: c.sizeBytes + 1 } : c,
        ),
      };
      expect(() =>
        selectRemainingMaterializedDumpChunks(materialized, broken),
      ).toThrow(RangeError);
    });

    it("(h3) 경계 메타 drift (last 불일치) → RangeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken: ExportChunkResumePlan = {
        ...resumePlan,
        remainingChunks: resumePlan.remainingChunks.map((c, i) =>
          i === 0 ? { ...c, last: !c.last } : c,
        ),
      };
      expect(() =>
        selectRemainingMaterializedDumpChunks(materialized, broken),
      ).toThrow(/single-source drift/);
    });

    it("(i) materialized element 의 bytes 가 Buffer 아님 → TypeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken = materialized.map((c, i) =>
        i === 0 ? { ...c, bytes: "not-a-buffer" as unknown as Buffer } : c,
      );
      expect(() =>
        selectRemainingMaterializedDumpChunks(broken, resumePlan),
      ).toThrow(/bytes 는 Buffer 여야 합니다/);
    });

    it("(i2) materialized element 가 plain object 아님 (null) → TypeError", () => {
      const { materialized, resumePlan } = validPair();
      const broken = materialized.map((c, i) =>
        i === 0 ? (null as unknown as MaterializedExportDumpChunk) : c,
      );
      expect(() =>
        selectRemainingMaterializedDumpChunks(broken, resumePlan),
      ).toThrow(/plain object 여야 합니다/);
    });
  });

  // ── non-mutating / 결정성 / alias ──────────────────────────────────────
  describe("non-mutating / 결정성 / alias", () => {
    it("(k) Object.freeze(resumePlan) + materialized chunk freeze 호출해도 throw 0 + 결과 정확", () => {
      const dump = makeKoreanDump();
      const { materialized, resumePlan } = fixture(dump, 16, 1);
      const frozenMaterialized = materialized.map((c) => Object.freeze(c));
      Object.freeze(resumePlan.remainingChunks.map((c) => Object.freeze(c)));
      Object.freeze(resumePlan);

      const result = selectRemainingMaterializedDumpChunks(
        frozenMaterialized as MaterializedExportDumpChunk[],
        resumePlan,
      );
      expect(result).toHaveLength(resumePlan.remainingChunkCount);
    });

    it("(l) 동일 입력 2 회 호출 결과가 완전히 동일하다 (결정성)", () => {
      const dump = makeKoreanDump();
      const { materialized, resumePlan } = fixture(dump, 16, 1);

      const r1 = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );
      const r2 = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );

      expect(r1).toHaveLength(r2.length);
      for (let i = 0; i < r1.length; i += 1) {
        expect(r1[i].index).toBe(r2[i].index);
        expect(r1[i].bytes.equals(r2[i].bytes)).toBe(true);
      }
    });

    it("(m) 반환 chunk 의 bytes 를 mutate 해도 입력 materialized·다음 호출 결과에 영향 0 (alias 0)", () => {
      const dump = makeKoreanDump();
      const { materialized, resumePlan } = fixture(dump, 16, 1);
      const originalFirst = Buffer.from(materialized[1].bytes);

      const result = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );
      // 반환 첫 chunk 의 byte 를 mutate.
      if (result[0].bytes.length > 0) {
        result[0].bytes[0] = (result[0].bytes[0] + 1) & 0xff;
      }

      // 입력 materialized 의 대응 chunk 는 불변이어야 한다.
      const originIdx = materialized.findIndex(
        (m) => m.index === resumePlan.remainingChunks[0].index,
      );
      expect(materialized[originIdx].bytes.equals(originalFirst)).toBe(true);

      // 같은 입력 재호출 결과도 영향 없어야 한다.
      const again = selectRemainingMaterializedDumpChunks(
        materialized,
        resumePlan,
      );
      expect(again[0].bytes.equals(originalFirst)).toBe(true);
    });
  });
});
