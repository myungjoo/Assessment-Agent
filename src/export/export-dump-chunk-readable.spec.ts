// export-dump-chunk-readable.spec — createChunkedExportDumpReadable(T-0509) 단위 테스트. R-112 4 종
// (happy / error / flow·branch / negative 충분 cover)을 채운다. ADR-0046 §Decision 1 맞물림 (i)
// (helper 산정 경계대로 byte slice → Readable push) + §Decision 3 (descriptor single-source —
// 직렬화 byte length === plan.totalBytes invariant 가 stream 까지 보존) 정합 검증.
//
// 입력은 가급적 실 helper(buildExportDump + buildExportChunkPlan)로 조립해 직렬화 방식·totalBytes
// 정합을 자연스럽게 보장한다(export-dump-chunk-slice.spec 과 동형). 본 factory 의 입력 방어 throw 는
// 위임처 sliceMaterializedDumpByChunkPlan(T-0507)의 원본 메시지가 그대로 전파됨을 검증한다.
import { Readable } from "stream";

import { buildExportChunkPlan, ExportChunkPlan } from "./export-chunk-plan";
import { buildExportDump, ExportDump } from "./export-dump";
import { createChunkedExportDumpReadable } from "./export-dump-chunk-readable";
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";
import { ExportRecord } from "./export-scope-select";

// 테스트용 dump 조립 — 실 buildExportDump 로 직렬화 가능한 valid envelope 를 만든다.
function makeDump(records: ExportRecord[] = []): ExportDump {
  return buildExportDump(records, {
    scope: { scope: "full" },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
}

// dump 의 실 직렬화 byte length — plan.totalBytes invariant 의 source(estimateByteSize 와 동일 방식).
function serializedLength(dump: ExportDump): number {
  return Buffer.byteLength(JSON.stringify(dump), "utf8");
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

// 한글 multi-byte record 를 섞은 dump — UTF-8 코드포인트 중간을 자르는 byte 경계도 cover.
function makeKoreanDump(): ExportDump {
  const records: ExportRecord[] = [
    { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
    { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
    { entity: "Group", instant: new Date("2026-06-18T03:00:00.000Z") },
  ];
  const dump = buildExportDump(records, {
    scope: {
      scope: "partial",
      entitySelector: ["Assessment", "Person", "Group"],
    },
    generatedAt: new Date("2026-06-18T00:00:00.000Z"),
  });
  (dump as unknown as { note: string }).note =
    "한글 멀티바이트 페이로드 경계 테스트 가나다라마바사";
  return dump;
}

// 빈 envelope 에 대응하는 totalBytes 0 plan 을 손으로 조립 — buildExportChunkPlan 은 totalBytes 0
// 일 때 chunkCount 0 + chunks [] 를 산정하지만, 본 factory 의 invariant 검증(직렬화 length ===
// totalBytes)을 통과하려면 totalBytes 가 실 직렬화 length 와 일치해야 한다. 빈 stream 분기를 cover
// 하기 위해 직렬화 length 0 짜리 dump 는 존재하지 않으므로, chunks [] + totalBytes = 실 length 인
// plan 을 만들어 "chunkCount 0 이지만 totalBytes drift 없음" 경로를 강제한다.
function makeEmptyChunkPlan(dump: ExportDump): ExportChunkPlan {
  const len = serializedLength(dump);
  return {
    totalBytes: len,
    chunkSizeBytes: len + 1,
    chunkCount: 0,
    chunks: [],
    lastChunkSizeBytes: 0,
    headline: "test empty-chunk plan",
  };
}

// Readable 을 끝까지 read 해 chunk Buffer 배열을 모은다(순서 보존). flow-mode default 채택 검증.
async function drainChunks(stream: Readable): Promise<Buffer[]> {
  const collected: Buffer[] = [];
  for await (const chunk of stream) {
    collected.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return collected;
}

// Readable 을 끝까지 read 해 concat 한 단일 Buffer 를 반환.
async function drain(stream: Readable): Promise<Buffer> {
  return Buffer.concat(await drainChunks(stream));
}

describe("createChunkedExportDumpReadable — ADR-0046 §1 chunked-Readable 실행 layer", () => {
  describe("happy path — chunk 경계대로 정확 push", () => {
    it("(a) 충분히 큰 chunkSizeBytes → 단일 chunk stream, read 결과가 직렬화 byte 와 byte-동일", async () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, original.length + 1000); // 전체보다 큰 chunk → 1 개

      const stream = createChunkedExportDumpReadable(dump, plan);
      const result = await drain(stream);

      expect(result).toEqual(original);
    });

    it("(b) 작은 chunkSizeBytes → 다수 chunk stream, concat 시 원본 직렬화 byte 와 동일", async () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
        { entity: "Group", instant: new Date("2026-06-18T03:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 16); // 작은 chunk → 다수

      const chunks = await drainChunks(
        createChunkedExportDumpReadable(dump, plan),
      );

      expect(chunks.length).toBe(plan.chunkCount);
      expect(chunks.length).toBeGreaterThan(1);
      expect(Buffer.concat(chunks)).toEqual(original);
    });

    it("(c) 멀티바이트 한글 record 포함 envelope 도 concat 결과가 byte-동일", async () => {
      const dump = makeKoreanDump();
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 7); // 작은 chunk → multi-byte 코드포인트 경계 자름 유발

      const result = await drain(createChunkedExportDumpReadable(dump, plan));

      expect(result).toEqual(original);
    });
  });

  describe("error path — 입력 방어 throw 가 T-0507 원본 message 로 즉시(eager) 전파", () => {
    it("(a) dump 비-object(null/숫자/배열) → T-0507 의 TypeError 원본 message 그대로 throw", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      for (const bad of [null, 42, [1, 2]]) {
        expect(() =>
          createChunkedExportDumpReadable(bad as unknown as ExportDump, plan),
        ).toThrow(TypeError);
        expect(() =>
          createChunkedExportDumpReadable(bad as unknown as ExportDump, plan),
        ).toThrow(/sliceMaterializedDumpByChunkPlan: dump 는/);
      }
    });

    it("(b) plan 비-object → T-0507 의 TypeError 원본 message 그대로 throw", () => {
      const dump = makeDump();
      for (const bad of [null, 42, [1, 2]]) {
        expect(() =>
          createChunkedExportDumpReadable(
            dump,
            bad as unknown as ExportChunkPlan,
          ),
        ).toThrow(TypeError);
        expect(() =>
          createChunkedExportDumpReadable(
            dump,
            bad as unknown as ExportChunkPlan,
          ),
        ).toThrow(/sliceMaterializedDumpByChunkPlan: plan 은/);
      }
    });

    it("(c) plan.chunks 비-배열 → T-0507 의 TypeError 원본 message 그대로 throw", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      (plan as { chunks: unknown }).chunks = null;
      expect(() => createChunkedExportDumpReadable(dump, plan)).toThrow(
        TypeError,
      );
      expect(() => createChunkedExportDumpReadable(dump, plan)).toThrow(
        /sliceMaterializedDumpByChunkPlan: plan\.chunks 는/,
      );
    });

    it("(d) 직렬화 byte length ≠ plan.totalBytes(stale plan) → T-0507 의 RangeError 원본 message 그대로 throw", () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const realLen = serializedLength(dump);
      const stale = makePlan(dump, 4096);
      (stale as { totalBytes: number }).totalBytes = realLen - 5;
      expect(() => createChunkedExportDumpReadable(dump, stale)).toThrow(
        RangeError,
      );
      expect(() => createChunkedExportDumpReadable(dump, stale)).toThrow(
        /일치하지 않습니다/,
      );
    });

    it("throw 는 factory 호출 시점에 즉시(eager) 발생 — Readable 을 받은 뒤 read 단계가 아님", () => {
      const dump = makeDump();
      // bad plan 이면 Readable 을 받기도 전에 동기 throw — try 로 Readable 변수 자체가 안 잡힘.
      expect(() =>
        createChunkedExportDumpReadable(
          dump,
          null as unknown as ExportChunkPlan,
        ),
      ).toThrow(TypeError);
    });
  });

  describe("branch coverage — 분기마다 분리", () => {
    it("(i) 입력 방어 분기 — dump/plan/chunks 비-object + totalBytes drift → throw", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      expect(() =>
        createChunkedExportDumpReadable(null as unknown as ExportDump, plan),
      ).toThrow(TypeError);
      expect(() =>
        createChunkedExportDumpReadable(
          dump,
          null as unknown as ExportChunkPlan,
        ),
      ).toThrow(TypeError);
    });

    it("(ii) chunkCount === 0(빈 envelope) → 즉시 end 하는 빈 stream(throw 0, read 결과 빈 buffer)", async () => {
      const dump = makeDump();
      const plan = makeEmptyChunkPlan(dump);

      const stream = createChunkedExportDumpReadable(dump, plan);
      const chunks = await drainChunks(stream);

      expect(stream).toBeInstanceOf(Readable);
      expect(chunks).toHaveLength(0);
      expect(Buffer.concat(chunks)).toEqual(Buffer.alloc(0));
    });

    it("(iii) chunkCount === 1 → 단일 buffer push 후 end", async () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, original.length + 1000);
      expect(plan.chunkCount).toBe(1);

      const chunks = await drainChunks(
        createChunkedExportDumpReadable(dump, plan),
      );

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual(original);
    });

    it("(iv) chunkCount > 1 → N개 buffer 가 offsetBytes 오름차순으로 순서대로 push", async () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 16);
      expect(plan.chunkCount).toBeGreaterThan(1);

      const chunks = await drainChunks(
        createChunkedExportDumpReadable(dump, plan),
      );

      // 각 chunk 의 byte 가 plan.chunks[i] 경계와 정확히 일치(offset 오름차순 순서 보존).
      let offset = 0;
      for (let i = 0; i < plan.chunkCount; i += 1) {
        const expected = original.subarray(
          plan.chunks[i].offsetBytes,
          plan.chunks[i].offsetBytes + plan.chunks[i].sizeBytes,
        );
        expect(chunks[i]).toEqual(Buffer.from(expected));
        expect(plan.chunks[i].offsetBytes).toBe(offset);
        offset += plan.chunks[i].sizeBytes;
      }
    });
  });

  describe("negative cases 충분 cover", () => {
    it("(a) dump=null → TypeError", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      expect(() =>
        createChunkedExportDumpReadable(null as unknown as ExportDump, plan),
      ).toThrow(TypeError);
    });

    it("(b) plan=null → TypeError", () => {
      const dump = makeDump();
      expect(() =>
        createChunkedExportDumpReadable(
          dump,
          null as unknown as ExportChunkPlan,
        ),
      ).toThrow(TypeError);
    });

    it("(c) plan.chunks=null → TypeError", () => {
      const dump = makeDump();
      const plan = makePlan(dump, 4096);
      (plan as { chunks: unknown }).chunks = null;
      expect(() => createChunkedExportDumpReadable(dump, plan)).toThrow(
        TypeError,
      );
    });

    it("(d) plan.totalBytes 가 직렬화 buffer 보다 작음 → RangeError", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 4096);
      (plan as { totalBytes: number }).totalBytes = serializedLength(dump) - 3;
      expect(() => createChunkedExportDumpReadable(dump, plan)).toThrow(
        RangeError,
      );
    });

    it("(e) plan.totalBytes 가 직렬화 buffer 보다 큼 → RangeError", () => {
      const dump = makeDump([
        { entity: "Person", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 4096);
      (plan as { totalBytes: number }).totalBytes = serializedLength(dump) + 3;
      expect(() => createChunkedExportDumpReadable(dump, plan)).toThrow(
        RangeError,
      );
    });

    it("(f) chunkCount === 0 빈 plan → 정상 빈 stream(instanceof Readable + read 결과 빈 buffer)", async () => {
      const dump = makeDump();
      const stream = createChunkedExportDumpReadable(
        dump,
        makeEmptyChunkPlan(dump),
      );
      expect(stream).toBeInstanceOf(Readable);
      expect(await drain(stream)).toEqual(Buffer.alloc(0));
    });

    it("(g) non-mutating — freeze(dump)+freeze(plan)+freeze(plan.chunks) 로 호출해도 throw 0 + stream byte 정확", async () => {
      const dump = makeDump([
        { entity: "Group", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 16);
      Object.freeze(dump);
      Object.freeze(plan);
      Object.freeze(plan.chunks);

      const result = await drain(createChunkedExportDumpReadable(dump, plan));
      expect(result).toEqual(original);
    });

    it("(h) 결정성 — 동일 입력 2 회 호출 → 두 stream read byte 가 완전 동일", async () => {
      const dump = makeKoreanDump();
      const plan = makePlan(dump, 13);

      const first = await drain(createChunkedExportDumpReadable(dump, plan));
      const second = await drain(createChunkedExportDumpReadable(dump, plan));
      expect(first).toEqual(second);
    });

    it("(i) alias 0 — 한 stream 의 buffer 를 mutate 해도 다음 호출 stream 의 buffer 가 영향 0", async () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, original.length + 100); // 단일 chunk

      const firstChunks = await drainChunks(
        createChunkedExportDumpReadable(dump, plan),
      );
      firstChunks[0][0] = 0xff; // 첫 stream buffer 의 첫 byte 손상

      const secondChunks = await drainChunks(
        createChunkedExportDumpReadable(dump, plan),
      );
      // 두 번째 호출 stream 의 buffer 는 원본 그대로(첫 호출 mutate 영향 0).
      expect(Buffer.concat(secondChunks)).toEqual(original);
    });

    it("(j) 순서 보존 — chunkCount > 1 시 stream chunk index 가 0,1,2,... 오름차순", async () => {
      const dump = makeDump([
        { entity: "Assessment", instant: new Date("2026-06-18T01:00:00.000Z") },
        { entity: "Person", instant: new Date("2026-06-18T02:00:00.000Z") },
      ]);
      const original = Buffer.from(JSON.stringify(dump), "utf8");
      const plan = makePlan(dump, 12);
      expect(plan.chunkCount).toBeGreaterThan(1);

      const chunks = await drainChunks(
        createChunkedExportDumpReadable(dump, plan),
      );

      // i 번째 stream chunk === i 번째 plan chunk 경계(오름차순 그대로).
      for (let i = 0; i < plan.chunkCount; i += 1) {
        const expected = original.subarray(
          plan.chunks[i].offsetBytes,
          plan.chunks[i].offsetBytes + plan.chunks[i].sizeBytes,
        );
        expect(chunks[i]).toEqual(Buffer.from(expected));
      }
      expect(chunks).toHaveLength(plan.chunkCount);
    });
  });

  describe("반환값이 Node 내장 stream.Readable instance", () => {
    it("result instanceof Readable === true (외부 stream lib 의존 0)", () => {
      const dump = makeDump([
        { entity: "LlmConfig", instant: new Date("2026-06-18T01:00:00.000Z") },
      ]);
      const plan = makePlan(dump, 4096);

      const stream = createChunkedExportDumpReadable(dump, plan);
      expect(stream).toBeInstanceOf(Readable);
    });
  });
});
