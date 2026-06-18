// serializeExportDownloadHeaders 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). ADR-0046 (b718bb8) Decision §1·3 의 다운로드 헤더 직렬화 layer (T-0510).
// 실 buildExportArtifactDescriptor / describeExportChunkStreamProgress 산출물을 입력으로 써
// descriptor single-source 정합(Content-Type / Content-Disposition / Content-Length 그대로) +
// Content-Range RFC 7233 형식 정확성 + 입력 방어 분기 + non-mutating(Object.freeze) + 결정성 +
// alias 0 을 검증한다(export-dump-materialize.spec.ts mirror).
import { buildExportArtifactDescriptor } from "./export-artifact-descriptor";
import { ExportChunkPlan } from "./export-chunk-plan";
import {
  ExportChunkContentRange,
  describeExportChunkStreamProgress,
} from "./export-chunk-stream-progress";
import { serializeExportDownloadHeaders } from "./export-download-headers";
import { ExportDump } from "./export-dump";
import { ExportScope } from "./export-scope-select";

// scope full · 빈 records envelope — buildExportArtifactDescriptor 입력 base. ADR-0046 envelope
// shape 그대로(buildExportDump 결과와 동형).
const emptyFullDump: ExportDump = {
  schemaVersion: "1",
  generatedAt: "2026-06-16T09:30:00.000Z",
  scope: { scope: "full" } as ExportScope,
  entityCounts: {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  },
  recordCount: 0,
  records: [],
};

// 실 descriptor — 모든 happy-path / non-mutating / 결정성 검증의 공통 base.
const realDescriptor = buildExportArtifactDescriptor(emptyFullDump);

// 직접 조립한 유효 content-range — RFC 7233 형식 정확성 검증의 base(bytes 0-1023/4096).
const sampleRange: ExportChunkContentRange = {
  firstBytePos: 0,
  lastBytePos: 1023,
  totalBytes: 4096,
  chunkIndex: 0,
};

describe("serializeExportDownloadHeaders — happy path (descriptor single-source)", () => {
  it("(a) 실 descriptor + contentRange 생략 → Content-Type/Disposition/Length 3 헤더만, 값이 descriptor 와 일치", () => {
    const headers = serializeExportDownloadHeaders(realDescriptor);

    expect(headers["Content-Type"]).toBe(realDescriptor.contentType);
    expect(headers["Content-Disposition"]).toBe(
      realDescriptor.contentDisposition,
    );
    expect(headers["Content-Length"]).toBe(String(realDescriptor.byteSizeHint));
    // Content-Range 부재 — full 다운로드.
    expect(headers["Content-Range"]).toBeUndefined();
    expect(Object.keys(headers).sort()).toEqual([
      "Content-Disposition",
      "Content-Length",
      "Content-Type",
    ]);
  });

  it("(b) 실 descriptor + describeExportChunkStreamProgress 산출 currentRange → 3 헤더 + Content-Range 정확한 문자열", () => {
    // 실 chunk plan(직접 조립한 유효 plan) → 진행 상태 → currentRange(첫 chunk content-range 수치) 산출.
    const plan: ExportChunkPlan = {
      totalBytes: 4096,
      chunkSizeBytes: 1024,
      chunkCount: 4,
      chunks: [
        { index: 0, offsetBytes: 0, sizeBytes: 1024, last: false },
        { index: 1, offsetBytes: 1024, sizeBytes: 1024, last: false },
        { index: 2, offsetBytes: 2048, sizeBytes: 1024, last: false },
        { index: 3, offsetBytes: 3072, sizeBytes: 1024, last: true },
      ],
      lastChunkSizeBytes: 1024,
      headline: "n",
    };
    const progress = describeExportChunkStreamProgress(plan, 0);
    const range = progress.currentRange;
    expect(range).not.toBeNull();

    const headers = serializeExportDownloadHeaders(realDescriptor, range);

    expect(headers["Content-Type"]).toBe(realDescriptor.contentType);
    expect(headers["Content-Disposition"]).toBe(
      realDescriptor.contentDisposition,
    );
    expect(headers["Content-Length"]).toBe(String(realDescriptor.byteSizeHint));
    // currentRange 로부터 직렬화된 Content-Range 가 수치와 정확히 일치.
    expect(headers["Content-Range"]).toBe(
      `bytes ${range!.firstBytePos}-${range!.lastBytePos}/${range!.totalBytes}`,
    );
  });
});

describe("serializeExportDownloadHeaders — Content-Range 형식 정확성 (RFC 7233)", () => {
  it("{first:0, last:1023, total:4096} → 정확히 'bytes 0-1023/4096'", () => {
    const headers = serializeExportDownloadHeaders(realDescriptor, sampleRange);
    expect(headers["Content-Range"]).toBe("bytes 0-1023/4096");
  });

  it("경계값 {first:0, last:0, total:1} → 'bytes 0-0/1' (last < total 경계)", () => {
    const headers = serializeExportDownloadHeaders(realDescriptor, {
      firstBytePos: 0,
      lastBytePos: 0,
      totalBytes: 1,
      chunkIndex: 0,
    });
    expect(headers["Content-Range"]).toBe("bytes 0-0/1");
  });
});

describe("serializeExportDownloadHeaders — branch: contentRange 제공/생략/null", () => {
  it("(ii) contentRange 제공 분기 → Content-Range 포함", () => {
    const headers = serializeExportDownloadHeaders(realDescriptor, sampleRange);
    expect(headers["Content-Range"]).toBe("bytes 0-1023/4096");
  });

  it("(iii) contentRange 생략(undefined) 분기 → Content-Range 부재", () => {
    const headers = serializeExportDownloadHeaders(realDescriptor);
    expect("Content-Range" in headers).toBe(false);
  });

  it("(iv) contentRange === null 명시 전달 분기 → Content-Range 부재(생략과 동일)", () => {
    const headers = serializeExportDownloadHeaders(realDescriptor, null);
    expect("Content-Range" in headers).toBe(false);
    // null 전달이 undefined 생략과 동등한 헤더 map 산출.
    expect(headers).toEqual(serializeExportDownloadHeaders(realDescriptor));
  });
});

describe("serializeExportDownloadHeaders — error path: descriptor 입력 방어", () => {
  it("(a) descriptor=null → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(null as unknown as never),
    ).toThrow(TypeError);
  });

  it("(a) descriptor=숫자 → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(42 as unknown as never),
    ).toThrow(TypeError);
  });

  it("(b) descriptor=배열 → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders([] as unknown as never),
    ).toThrow(TypeError);
  });

  it("(c) descriptor.contentType=숫자(비-문자열) → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({
        ...realDescriptor,
        contentType: 123 as unknown as string,
      }),
    ).toThrow(TypeError);
  });

  it("descriptor.contentType=undefined(부재) → TypeError (describeNonObject undefined 분기)", () => {
    expect(() =>
      serializeExportDownloadHeaders({
        ...realDescriptor,
        contentType: undefined as unknown as string,
      }),
    ).toThrow(TypeError);
  });

  it("descriptor.contentDisposition=비-문자열 → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({
        ...realDescriptor,
        contentDisposition: null as unknown as string,
      }),
    ).toThrow(TypeError);
  });

  it("(d) descriptor.byteSizeHint=-1(음수) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({ ...realDescriptor, byteSizeHint: -1 }),
    ).toThrow(RangeError);
  });

  it("(e) descriptor.byteSizeHint=1.5(소수) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({ ...realDescriptor, byteSizeHint: 1.5 }),
    ).toThrow(RangeError);
  });

  it("(f) descriptor.byteSizeHint=NaN → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({ ...realDescriptor, byteSizeHint: NaN }),
    ).toThrow(RangeError);
  });

  it("descriptor.byteSizeHint=Infinity → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({
        ...realDescriptor,
        byteSizeHint: Infinity,
      }),
    ).toThrow(RangeError);
  });

  it("descriptor.byteSizeHint=비-number(문자열) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders({
        ...realDescriptor,
        byteSizeHint: "100" as unknown as number,
      }),
    ).toThrow(RangeError);
  });
});

describe("serializeExportDownloadHeaders — error path: contentRange 입력 방어", () => {
  it("(d) contentRange=숫자(비-object) → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(
        realDescriptor,
        42 as unknown as ExportChunkContentRange,
      ),
    ).toThrow(TypeError);
  });

  it("contentRange=배열(비-object) → TypeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(
        realDescriptor,
        [] as unknown as ExportChunkContentRange,
      ),
    ).toThrow(TypeError);
  });

  it("contentRange.firstBytePos=비-음수정수 아님(-1) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        ...sampleRange,
        firstBytePos: -1,
      }),
    ).toThrow(RangeError);
  });

  it("contentRange.lastBytePos=비-음수정수 아님(2.5) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        ...sampleRange,
        lastBytePos: 2.5,
      }),
    ).toThrow(RangeError);
  });

  it("contentRange.totalBytes=비-음수정수 아님(NaN) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        ...sampleRange,
        totalBytes: NaN,
      }),
    ).toThrow(RangeError);
  });

  it("(g) contentRange.firstBytePos > lastBytePos (100 > 50) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        firstBytePos: 100,
        lastBytePos: 50,
        totalBytes: 4096,
        chunkIndex: 0,
      }),
    ).toThrow(RangeError);
  });

  it("(h) contentRange.lastBytePos === totalBytes(경계 초과) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        firstBytePos: 0,
        lastBytePos: 4096,
        totalBytes: 4096,
        chunkIndex: 0,
      }),
    ).toThrow(RangeError);
  });

  it("contentRange.lastBytePos > totalBytes → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        firstBytePos: 0,
        lastBytePos: 5000,
        totalBytes: 4096,
        chunkIndex: 0,
      }),
    ).toThrow(RangeError);
  });

  it("(i) contentRange.totalBytes=0 인데 byte 가 있음(last 0 >= total 0) → RangeError", () => {
    expect(() =>
      serializeExportDownloadHeaders(realDescriptor, {
        firstBytePos: 0,
        lastBytePos: 0,
        totalBytes: 0,
        chunkIndex: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("serializeExportDownloadHeaders — negative: non-mutating / 결정성 / alias 0", () => {
  it("(j) Object.freeze(descriptor) + Object.freeze(contentRange) 로 호출해도 throw 0 + 헤더 정확", () => {
    const frozenDescriptor = Object.freeze({ ...realDescriptor });
    const frozenRange = Object.freeze({ ...sampleRange });
    expect(() =>
      serializeExportDownloadHeaders(frozenDescriptor, frozenRange),
    ).not.toThrow();

    const headers = serializeExportDownloadHeaders(
      frozenDescriptor,
      frozenRange,
    );
    expect(headers["Content-Type"]).toBe(realDescriptor.contentType);
    expect(headers["Content-Range"]).toBe("bytes 0-1023/4096");
  });

  it("non-mutating — 입력 descriptor / contentRange 객체가 변형되지 않는다", () => {
    const descriptorCopy = { ...realDescriptor };
    const rangeCopy = { ...sampleRange };
    serializeExportDownloadHeaders(descriptorCopy, rangeCopy);
    expect(descriptorCopy).toEqual(realDescriptor);
    expect(rangeCopy).toEqual(sampleRange);
  });

  it("(k) 결정성 — 동일 입력 2 회 호출 헤더 map 완전 동일", () => {
    const first = serializeExportDownloadHeaders(realDescriptor, sampleRange);
    const second = serializeExportDownloadHeaders(realDescriptor, sampleRange);
    expect(first).toEqual(second);
  });

  it("(l) alias 0 — 반환 map 을 mutate 해도 다음 호출 결과 영향 0, 입력 객체 alias 아님", () => {
    const first = serializeExportDownloadHeaders(realDescriptor, sampleRange);
    first["Content-Type"] = "MUTATED";
    first["X-Injected"] = "evil";
    const second = serializeExportDownloadHeaders(realDescriptor, sampleRange);
    expect(second["Content-Type"]).toBe(realDescriptor.contentType);
    expect(second["X-Injected"]).toBeUndefined();
    // 반환 map 은 입력 descriptor 의 alias 가 아니다.
    expect(first).not.toBe(realDescriptor);
  });
});
