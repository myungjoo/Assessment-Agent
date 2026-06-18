// export-dump-refetch-slice.spec — selectRefetchMaterializedDumpChunks(T-0512) 단위 테스트. R-112
// 4 종(happy / error / flow·branch / negative 충분 cover)을 채운다. ADR-0046 §Decision 1 맞물림
// (iv)(reconcile 의 failedChunks 가 손상 chunk 재요청 시 materialization subset 을 지시) + §Decision
// 3(reconcile single-source — 본 helper 가 경계를 재계산하지 않고 정합만 검증) 정합 검증.
//
// 입력은 가급적 실 helper(buildExportDump + buildExportChunkPlan + sliceMaterializedDumpByChunkPlan
// + reconcileExportChunkIntegrity)로 조립해 직렬화 방식·chunk 경계 정합을 자연스럽게 보장한다 —
// 맞물림 invariant(반환 subset 의 각 byte === 원본 손상 chunk byte)를 실측한다.
import {
  ExportChunkIntegrityReconcile,
  reconcileExportChunkIntegrity,
} from "./export-chunk-integrity-reconcile";
import {
  buildExportChunkPlan,
  ExportChunk,
  ExportChunkPlan,
} from "./export-chunk-plan";
import { buildExportDump, ExportDump } from "./export-dump";
import {
  MaterializedExportDumpChunk,
  sliceMaterializedDumpByChunkPlan,
} from "./export-dump-chunk-slice";
import { selectRefetchMaterializedDumpChunks } from "./export-dump-refetch-slice";
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

// dump → materialized chunk[] + reconcile(chunkIntegrity boolean[]) 한 번에 조립하는 fixture.
function fixture(
  dump: ExportDump,
  chunkSizeBytes: number,
  chunkIntegrity: boolean[],
): {
  materialized: MaterializedExportDumpChunk[];
  reconcile: ExportChunkIntegrityReconcile;
  plan: ExportChunkPlan;
  serialized: Buffer;
} {
  const plan = makePlan(dump, chunkSizeBytes);
  const materialized = sliceMaterializedDumpByChunkPlan(dump, plan);
  const reconcile = reconcileExportChunkIntegrity(plan, chunkIntegrity);
  const serialized = Buffer.from(JSON.stringify(dump), "utf8");
  return { materialized, reconcile, plan, serialized };
}

// chunkIntegrity 를 chunkCount 길이만큼 만들되, 지정한 index 만 false(손상) 로 둔다.
function integrityWithFailures(
  chunkCount: number,
  failedIndices: number[],
): boolean[] {
  const arr = new Array<boolean>(chunkCount).fill(true);
  for (const idx of failedIndices) {
    arr[idx] = false;
  }
  return arr;
}

describe("selectRefetchMaterializedDumpChunks", () => {
  // ── Happy path ──────────────────────────────────────────────────────────
  describe("happy path", () => {
    it("비연속 손상(chunkIntegrity 일부 false)일 때 failedChunks 에 대응하는 subset 을 index 오름차순으로 반환한다", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      // 실 chunk 개수 안에서 비연속 손상 index 2 개를 고른다(예: 1·3).
      expect(plan.chunkCount).toBeGreaterThanOrEqual(4);
      const failedIndices = [1, 3];
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, failedIndices),
      );

      expect(reconcile.allIntact).toBe(false);

      const result = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );

      expect(result).toHaveLength(reconcile.failedChunkCount);
      // index 오름차순 + 원본 손상 materialized 와 메타·byte 정확히 일치.
      for (let i = 0; i < result.length; i += 1) {
        const failedChunk = reconcile.failedChunks[i];
        const origin = materialized.find((m) => m.index === failedChunk.index)!;
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

    it("반환 subset 의 각 chunk byte 가 원본 직렬화 buffer 의 offsetBytes..offsetBytes+sizeBytes slice 와 byte-동일하다 (맞물림 invariant)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile, serialized } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [0, 2]),
      );

      const result = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );

      for (const chunk of result) {
        const slice = serialized.subarray(
          chunk.offsetBytes,
          chunk.offsetBytes + chunk.sizeBytes,
        );
        expect(chunk.bytes.equals(slice)).toBe(true);
      }
      // 재요청 byte 총량 정합 — refetchBytes === 반환 subset 의 sizeBytes 합.
      const sizeSum = result.reduce((acc, c) => acc + c.sizeBytes, 0);
      expect(sizeSum).toBe(reconcile.refetchBytes);
    });
  });

  // ── 분기 (branch coverage) ─────────────────────────────────────────────
  describe("branch coverage", () => {
    it("allIntact=true (전부 무결) 면 빈 배열을 반환한다 (throw 0)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, []),
      );

      expect(reconcile.allIntact).toBe(true);
      expect(reconcile.failedChunks).toEqual([]);
      expect(
        selectRefetchMaterializedDumpChunks(materialized, reconcile),
      ).toEqual([]);
    });

    it("단일 손상 chunk 분기 — 1 개만 손상", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [plan.chunkCount - 1]),
      );

      const result = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );
      expect(result).toHaveLength(1);
      expect(result[0].last).toBe(true);
    });

    it("비연속 다수 손상 chunk 분기 — 0·2 손상 (1 은 무결)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [0, 2]),
      );

      const result = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );
      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(2);
    });

    it("전부 손상 (failedChunkCount === verifiedChunkCount) 경계 — 전체 chunk 를 반환한다 (맞물림 invariant 특수 경우)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        new Array<boolean>(plan.chunkCount).fill(false),
      );

      expect(reconcile.allIntact).toBe(false);
      expect(reconcile.failedChunkCount).toBe(reconcile.verifiedChunkCount);

      const result = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );
      expect(result).toHaveLength(materialized.length);
      for (let i = 0; i < result.length; i += 1) {
        expect(result[i].index).toBe(materialized[i].index);
        expect(result[i].bytes.equals(materialized[i].bytes)).toBe(true);
      }
    });

    it("빈 dump (chunkCount 0, allIntact=true) — 빈 배열을 반환한다 (throw 0)", () => {
      // 0-byte estimate 로 chunkCount 0 plan 을 만들면 materialized 도 [], reconcile 도
      // allIntact=true / failedChunks [] 가 되는 진짜 빈 dump 경계다.
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
      const reconcile = reconcileExportChunkIntegrity(plan, []);

      expect(plan.chunkCount).toBe(0);
      expect(reconcile.allIntact).toBe(true);
      expect(selectRefetchMaterializedDumpChunks([], reconcile)).toEqual([]);
    });
  });

  // ── Error path / negative cases ────────────────────────────────────────
  describe("error paths / negative cases", () => {
    function validPair(): {
      materialized: MaterializedExportDumpChunk[];
      reconcile: ExportChunkIntegrityReconcile;
    } {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [1, 3]),
      );
      return { materialized, reconcile };
    }

    it("(a) materializedChunks=null → TypeError", () => {
      const { reconcile } = validPair();
      expect(() =>
        selectRefetchMaterializedDumpChunks(
          null as unknown as MaterializedExportDumpChunk[],
          reconcile,
        ),
      ).toThrow(TypeError);
    });

    it("(b) materializedChunks={} (비-배열 object) → TypeError", () => {
      const { reconcile } = validPair();
      expect(() =>
        selectRefetchMaterializedDumpChunks(
          {} as unknown as MaterializedExportDumpChunk[],
          reconcile,
        ),
      ).toThrow(/배열이어야 합니다/);
    });

    it("(c) reconcile=null → TypeError", () => {
      const { materialized } = validPair();
      expect(() =>
        selectRefetchMaterializedDumpChunks(
          materialized,
          null as unknown as ExportChunkIntegrityReconcile,
        ),
      ).toThrow(TypeError);
    });

    it("(d) reconcile=배열 → TypeError", () => {
      const { materialized } = validPair();
      expect(() =>
        selectRefetchMaterializedDumpChunks(
          materialized,
          [] as unknown as ExportChunkIntegrityReconcile,
        ),
      ).toThrow(/plain object 여야 합니다/);
    });

    it("(e) reconcile.failedChunks=null → TypeError", () => {
      const { materialized, reconcile } = validPair();
      const broken = {
        ...reconcile,
        failedChunks: null as unknown as ExportChunk[],
      };
      expect(() =>
        selectRefetchMaterializedDumpChunks(materialized, broken),
      ).toThrow(/failedChunks 는 배열이어야 합니다/);
    });

    it("(f) failedChunkCount ≠ failedChunks.length → RangeError", () => {
      const { materialized, reconcile } = validPair();
      const broken = {
        ...reconcile,
        failedChunkCount: reconcile.failedChunkCount + 1,
      };
      expect(() =>
        selectRefetchMaterializedDumpChunks(materialized, broken),
      ).toThrow(RangeError);
    });

    it("(g) failedChunks 에 materialized 범위 밖 index (99) → RangeError", () => {
      const { materialized, reconcile } = validPair();
      const broken: ExportChunkIntegrityReconcile = {
        ...reconcile,
        failedChunks: reconcile.failedChunks.map((c, i) =>
          i === 0 ? { ...c, index: 99 } : c,
        ),
      };
      expect(() =>
        selectRefetchMaterializedDumpChunks(materialized, broken),
      ).toThrow(/대응하는 materialized chunk 가 없습니다/);
    });

    it("(h) 경계 메타 drift (offsetBytes 불일치) → RangeError", () => {
      const { materialized, reconcile } = validPair();
      const broken: ExportChunkIntegrityReconcile = {
        ...reconcile,
        failedChunks: reconcile.failedChunks.map((c, i) =>
          i === 0 ? { ...c, offsetBytes: c.offsetBytes + 1 } : c,
        ),
      };
      expect(() =>
        selectRefetchMaterializedDumpChunks(materialized, broken),
      ).toThrow(/single-source drift/);
    });

    it("(h2) 경계 메타 drift (sizeBytes 불일치) → RangeError", () => {
      const { materialized, reconcile } = validPair();
      const broken: ExportChunkIntegrityReconcile = {
        ...reconcile,
        failedChunks: reconcile.failedChunks.map((c, i) =>
          i === 0 ? { ...c, sizeBytes: c.sizeBytes + 1 } : c,
        ),
      };
      expect(() =>
        selectRefetchMaterializedDumpChunks(materialized, broken),
      ).toThrow(RangeError);
    });

    it("(h3) 경계 메타 drift (last 불일치) → RangeError", () => {
      const { materialized, reconcile } = validPair();
      const broken: ExportChunkIntegrityReconcile = {
        ...reconcile,
        failedChunks: reconcile.failedChunks.map((c, i) =>
          i === 0 ? { ...c, last: !c.last } : c,
        ),
      };
      expect(() =>
        selectRefetchMaterializedDumpChunks(materialized, broken),
      ).toThrow(/single-source drift/);
    });

    it("(i) materialized element 의 bytes 가 Buffer 아님 → TypeError", () => {
      const { materialized, reconcile } = validPair();
      const broken = materialized.map((c, i) =>
        i === 0 ? { ...c, bytes: "not-a-buffer" as unknown as Buffer } : c,
      );
      expect(() =>
        selectRefetchMaterializedDumpChunks(broken, reconcile),
      ).toThrow(/bytes 는 Buffer 여야 합니다/);
    });

    it("(i2) materialized element 가 plain object 아님 (null) → TypeError", () => {
      const { materialized, reconcile } = validPair();
      const broken = materialized.map((c, i) =>
        i === 0 ? (null as unknown as MaterializedExportDumpChunk) : c,
      );
      expect(() =>
        selectRefetchMaterializedDumpChunks(broken, reconcile),
      ).toThrow(/plain object 여야 합니다/);
    });
  });

  // ── non-mutating / 결정성 / alias ──────────────────────────────────────
  describe("non-mutating / 결정성 / alias", () => {
    it("(l) Object.freeze(reconcile) + materialized chunk freeze 호출해도 throw 0 + 결과 정확", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [1, 3]),
      );
      const frozenMaterialized = materialized.map((c) => Object.freeze(c));
      reconcile.failedChunks.forEach((c) => Object.freeze(c));
      Object.freeze(reconcile.failedChunks);
      Object.freeze(reconcile);

      const result = selectRefetchMaterializedDumpChunks(
        frozenMaterialized as MaterializedExportDumpChunk[],
        reconcile,
      );
      expect(result).toHaveLength(reconcile.failedChunkCount);
    });

    it("(m) 동일 입력 2 회 호출 결과가 완전히 동일하다 (결정성)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [1, 3]),
      );

      const r1 = selectRefetchMaterializedDumpChunks(materialized, reconcile);
      const r2 = selectRefetchMaterializedDumpChunks(materialized, reconcile);

      expect(r1).toHaveLength(r2.length);
      for (let i = 0; i < r1.length; i += 1) {
        expect(r1[i].index).toBe(r2[i].index);
        expect(r1[i].bytes.equals(r2[i].bytes)).toBe(true);
      }
    });

    it("(n) 반환 chunk 의 bytes 를 mutate 해도 입력 materialized·다음 호출 결과에 영향 0 (alias 0)", () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 16);
      const { materialized, reconcile } = fixture(
        dump,
        16,
        integrityWithFailures(plan.chunkCount, [1, 3]),
      );
      const firstFailedIndex = reconcile.failedChunks[0].index;
      const originIdx = materialized.findIndex(
        (m) => m.index === firstFailedIndex,
      );
      const originalFirst = Buffer.from(materialized[originIdx].bytes);

      const result = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );
      // 반환 첫 chunk 의 byte 를 mutate.
      if (result[0].bytes.length > 0) {
        result[0].bytes[0] = (result[0].bytes[0] + 1) & 0xff;
      }

      // 입력 materialized 의 대응 chunk 는 불변이어야 한다.
      expect(materialized[originIdx].bytes.equals(originalFirst)).toBe(true);

      // 같은 입력 재호출 결과도 영향 없어야 한다.
      const again = selectRefetchMaterializedDumpChunks(
        materialized,
        reconcile,
      );
      expect(again[0].bytes.equals(originalFirst)).toBe(true);
    });
  });
});
