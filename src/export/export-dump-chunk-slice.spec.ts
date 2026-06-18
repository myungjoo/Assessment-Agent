// export-dump-chunk-slice.spec — sliceMaterializedDumpByChunkPlan(T-0507) 단위 테스트. R-112 4 종
// (happy / error / flow·branch / negative 충분 cover)을 채운다. ADR-0046 §Decision 1 맞물림 (i)
// (helper 산정 경계대로 byte slice) + §Decision 3 (descriptor single-source — 직렬화 byte length
// === plan.totalBytes invariant) 정합 검증.
//
// 입력은 가급적 실 helper(buildExportDump + buildExportChunkPlan)로 조립해 직렬화 방식·totalBytes
// 정합을 자연스럽게 보장한다. plan.totalBytes 는 estimateByteSize 와 동일한 Buffer.byteLength(
// JSON.stringify(dump), "utf8") 로 산정해 drift 0 을 만든다(본 함수의 (b) invariant).
import { buildExportChunkPlan, ExportChunkPlan } from "./export-chunk-plan";
import { buildExportDump, ExportDump } from "./export-dump";
import {
  MaterializedExportDumpChunk,
  sliceMaterializedDumpByChunkPlan,
} from "./export-dump-chunk-slice";
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";
import { ExportRecord } from "./export-scope-select";

// 테스트용 dump 조립 — 실 buildExportDump 로 직렬화 가능한 valid envelope 를 만든다. records 를
// 인자로 받아 멀티바이트/빈/다건 case 를 한 곳에서 변주한다.
function makeDump(records: ExportRecord[] = []): ExportDump {
  return buildExportDump(records, {
    scope: { scope: "full" },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
}

// dump 의 실 직렬화 byte length — 본 함수가 강제하는 plan.totalBytes invariant 의 source.
// estimateByteSize(export-artifact-descriptor.ts) 와 동일한 방식.
function serializedLength(dump: ExportDump): number {
  return Buffer.byteLength(JSON.stringify(dump), "utf8");
}

// dump 의 직렬화 byte length 에 정합하는 plan 을 실 buildExportChunkPlan 으로 조립. chunkSizeBytes
// 를 인자로 받아 단일/다수 chunk 를 변주한다. estimate 의 나머지 필드는 형식만 채운다.
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

// 한글 multi-byte record 를 섞은 dump — UTF-8 코드포인트 중간을 자르는 byte 경계도 cover.
function makeKoreanDump(): ExportDump {
  const records: ExportRecord[] = [
    { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
    { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
    { entity: "Group", instant: new Date("2026-06-18T03:00:00.000Z") },
  ];
  // scope 요약에 한글을 박아 직렬화 byte 에 multi-byte 가 확실히 포함되게 한다.
  const dump = buildExportDump(records, {
    scope: {
      scope: "partial",
      entitySelector: ["Assessment", "Person", "Group"],
    },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
  // 한글 payload 를 직접 주입(직렬화 byte 에 multi-byte 가 섞이도록) — 본 함수의 책임은 byte
  // 정확성이므로 envelope shape 자체는 자유.
  (dump as unknown as { note: string }).note =
    "한글 멀티바이트 페이로드 경계 테스트 가나다라마바사";
  return dump;
}

describe("sliceMaterializedDumpByChunkPlan — ADR-0046 §1 맞물림 (i) byte slice helper", () => {
  describe("happy path — chunk 경계대로 정확 slice", () => {
    it("(a) 충분히 큰 chunkSizeBytes → 단일 chunk, sliced bytes === 직렬화 buffer 전체", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const len = serializedLength(dump);
      const plan = makePlan(dump, len + 1000); // 전체보다 큰 chunk → 1 개

      const result = sliceMaterializedDumpByChunkPlan(dump, plan);

      expect(result).toHaveLength(1);
      expect(result[0].index).toBe(0);
      expect(result[0].offsetBytes).toBe(0);
      expect(result[0].sizeBytes).toBe(len);
      expect(result[0].last).toBe(true);
      expect(result[0].bytes).toEqual(
        Buffer.from(JSON.stringify(dump), "utf8"),
      );
    });

    it("(b) 작은 chunkSizeBytes → 다수 chunk, 모든 bytes concat 시 원본 직렬화 buffer 와 byte-동일", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
        { entity: "Group", instant: new Date("2026-06-18T03:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 16); // 작은 chunk → 다수

      const result = sliceMaterializedDumpByChunkPlan(dump, plan);

      expect(result.length).toBe(plan.chunkCount);
      expect(result.length).toBeGreaterThan(1);
      const concatenated = Buffer.concat(result.map((c) => c.bytes));
      expect(concatenated).toEqual(original);
      expect(concatenated.length).toBe(plan.totalBytes);
    });

    it("(c) 멀티바이트 한글 record 포함 envelope 도 byte 경계가 코드포인트 중간이어도 정확 slice", () => {
      const dump = makeKoreanDump();
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 7); // 작은 chunk → multi-byte 코드포인트 경계 자름 유발

      const result = sliceMaterializedDumpByChunkPlan(dump, plan);

      const concatenated = Buffer.concat(result.map((c) => c.bytes));
      expect(concatenated).toEqual(original);
    });
  });

  describe("error path — 입력 방어 + invariant 위반", () => {
    it("(a) dump 가 plain object 가 아니면 TypeError(한국어 message)", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      for (const bad of [null, undefined, 42, "str", [1, 2]]) {
        expect(() =>
          sliceMaterializedDumpByChunkPlan(bad as unknown as ExportDump, plan),
        ).toThrow(TypeError);
        expect(() =>
          sliceMaterializedDumpByChunkPlan(bad as unknown as ExportDump, plan),
        ).toThrow(/sliceMaterializedDumpByChunkPlan: dump 는/);
      }
    });

    it("(b) plan 이 plain object 가 아니면 TypeError(한국어 message)", () => {
      const dump = makeDump();
      for (const bad of [null, undefined, 42, "str", [1, 2]]) {
        expect(() =>
          sliceMaterializedDumpByChunkPlan(
            dump,
            bad as unknown as ExportChunkPlan,
          ),
        ).toThrow(TypeError);
        expect(() =>
          sliceMaterializedDumpByChunkPlan(
            dump,
            bad as unknown as ExportChunkPlan,
          ),
        ).toThrow(/sliceMaterializedDumpByChunkPlan: plan 은/);
      }
    });

    it("(c) 직렬화 buffer length 가 plan.totalBytes 와 불일치(stale plan)면 RangeError(한국어 message)", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const realLen = serializedLength(dump);
      // plan 을 손으로 stale 하게 조작 — totalBytes 를 실제보다 작게.
      const stale = makePlan(dump, 4096);
      (stale as { totalBytes: number }).totalBytes = realLen - 5;
      expect(() => sliceMaterializedDumpByChunkPlan(dump, stale)).toThrow(
        RangeError,
      );
      expect(() => sliceMaterializedDumpByChunkPlan(dump, stale)).toThrow(
        /일치하지 않습니다/,
      );
    });
  });

  describe("branch coverage — 분기마다 분리", () => {
    it("(i) 입력 방어 분기 — dump/plan 비-object → throw", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      expect(() =>
        sliceMaterializedDumpByChunkPlan(null as unknown as ExportDump, plan),
      ).toThrow(TypeError);
      expect(() =>
        sliceMaterializedDumpByChunkPlan(
          dump,
          null as unknown as ExportChunkPlan,
        ),
      ).toThrow(TypeError);
    });

    it("(ii) totalBytes 불일치 분기 — drift → RangeError (실제보다 큼)", () => {
      const dump = makeDump();
      const drifted = makePlan(dump, 4096);
      (drifted as { totalBytes: number }).totalBytes =
        serializedLength(dump) + 7;
      expect(() => sliceMaterializedDumpByChunkPlan(dump, drifted)).toThrow(
        RangeError,
      );
    });

    it("(iii) chunkCount === 0 정상 분기 — 빈 envelope(totalBytes 0)는 [] 반환", () => {
      // totalBytes 0 plan 은 buildExportChunkPlan 으로는 직렬화 dump 와 정합 불가(빈 dump 도
      // 직렬화 시 byte > 0)라 plan.chunks=[] + totalBytes 를 실 length 에 맞춘 plan 을 직접 구성.
      const dump = makeDump();
      const plan: ExportChunkPlan = {
        totalBytes: serializedLength(dump),
        chunkSizeBytes: 4096,
        chunkCount: 0,
        chunks: [],
        lastChunkSizeBytes: 0,
        headline: "test",
      };
      const result = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(result).toEqual([]);
    });

    it("(iv) chunkCount === 1 정상 분기 — 단일 chunk full", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const plan = makePlan(dump, serializedLength(dump) + 100);
      const result = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(result).toHaveLength(1);
      expect(result[0].last).toBe(true);
      expect(result[0].sizeBytes).toBe(serializedLength(dump));
    });

    it("(v) chunkCount > 1 정상 분기 — 다수 chunk + 마지막 잔여", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "Group", instant: new Date("2026-06-18T02:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 10);
      const result = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(result.length).toBeGreaterThan(1);
      // 마지막 외 모든 chunk sizeBytes === chunkSizeBytes, 마지막은 잔여(<=).
      for (let i = 0; i < result.length - 1; i += 1) {
        expect(result[i].sizeBytes).toBe(10);
        expect(result[i].last).toBe(false);
      }
      expect(result[result.length - 1].last).toBe(true);
    });
  });

  describe("negative cases — 충분 cover", () => {
    it("(a) dump=null → TypeError", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      expect(() =>
        sliceMaterializedDumpByChunkPlan(null as unknown as ExportDump, plan),
      ).toThrow(TypeError);
    });

    it("(b) plan=null → TypeError", () => {
      const dump = makeDump();
      expect(() =>
        sliceMaterializedDumpByChunkPlan(
          dump,
          null as unknown as ExportChunkPlan,
        ),
      ).toThrow(TypeError);
    });

    it("(c) plan.chunks=null (plan shape 위반) → TypeError", () => {
      const dump = makeDump();
      const bad = {
        totalBytes: serializedLength(dump),
        chunkSizeBytes: 4096,
        chunkCount: 0,
        chunks: null,
        lastChunkSizeBytes: 0,
        headline: "x",
      } as unknown as ExportChunkPlan;
      expect(() => sliceMaterializedDumpByChunkPlan(dump, bad)).toThrow(
        TypeError,
      );
      expect(() => sliceMaterializedDumpByChunkPlan(dump, bad)).toThrow(
        /plan\.chunks 는 배열/,
      );
    });

    it("(d) plan.totalBytes 가 직렬화 buffer 보다 작음 → RangeError", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      (plan as { totalBytes: number }).totalBytes = serializedLength(dump) - 1;
      expect(() => sliceMaterializedDumpByChunkPlan(dump, plan)).toThrow(
        RangeError,
      );
    });

    it("(e) plan.totalBytes 가 직렬화 buffer 보다 큼 → RangeError", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      (plan as { totalBytes: number }).totalBytes = serializedLength(dump) + 1;
      expect(() => sliceMaterializedDumpByChunkPlan(dump, plan)).toThrow(
        RangeError,
      );
    });

    it("(f) chunkCount === 0 빈 plan → [] 정상", () => {
      const dump = makeDump();
      const plan: ExportChunkPlan = {
        totalBytes: serializedLength(dump),
        chunkSizeBytes: 4096,
        chunkCount: 0,
        chunks: [],
        lastChunkSizeBytes: 0,
        headline: "test",
      };
      expect(sliceMaterializedDumpByChunkPlan(dump, plan)).toEqual([]);
    });

    it("(g) chunkCount === 1 단일 chunk plan → 1-원소 배열", () => {
      const dump = makeDump();
      const plan = makePlan(dump, serializedLength(dump) + 50);
      const result = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(result).toHaveLength(1);
    });

    it("(h) non-mutating — Object.freeze(dump/plan/chunks) 로 호출해도 throw 0 + 결과 정확", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 12);
      Object.freeze(dump);
      Object.freeze(plan);
      Object.freeze(plan.chunks);
      plan.chunks.forEach((c) => Object.freeze(c));

      const original = Buffer.from(JSON.stringify(dump), "utf8");
      let result: MaterializedExportDumpChunk[] = [];
      expect(() => {
        result = sliceMaterializedDumpByChunkPlan(dump, plan);
      }).not.toThrow();
      expect(Buffer.concat(result.map((c) => c.bytes))).toEqual(original);
    });

    it("(i) 결정성 — 동일 입력 2 회 호출 결과가 모든 element 의 byte 까지 동일", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "LlmConfig", instant: new Date("2026-06-18T02:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 13);
      const a = sliceMaterializedDumpByChunkPlan(dump, plan);
      const b = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(a).toEqual(b);
      for (let i = 0; i < a.length; i += 1) {
        expect(a[i].bytes).toEqual(b[i].bytes);
      }
    });

    it("(j) alias 0 — 반환 bytes mutate 가 원본/후속 호출 결과에 영향 0", () => {
      const dump = makeDump([
        { entity: "Group", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, serializedLength(dump) + 100);
      const first = sliceMaterializedDumpByChunkPlan(dump, plan);
      // 반환 buffer 를 강제로 변형.
      first[0].bytes.fill(0);
      // 후속 호출은 원본 그대로여야 한다.
      const second = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(second[0].bytes).toEqual(original);
      // 원본 dump 직렬화도 영향 0.
      expect(Buffer.from(JSON.stringify(dump), "utf8")).toEqual(original);
    });
  });

  describe("Buffer instance 보장 — Node 내장 Buffer 만", () => {
    it("반환 element 의 bytes 가 Buffer instance", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 8);
      const result = sliceMaterializedDumpByChunkPlan(dump, plan);
      expect(result.length).toBeGreaterThan(0);
      for (const c of result) {
        expect(c.bytes instanceof Buffer).toBe(true);
      }
    });
  });
});
