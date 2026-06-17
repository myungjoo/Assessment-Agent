// export-artifact-descriptor 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). buildExportDump(T-0438)이 산출한 ExportDump envelope 에서
// buildExportArtifactDescriptor 가 {fileName, contentType, byteSizeHint, contentDisposition,
// scopeToken} 다운로드 artifact descriptor 를 정확히 합성하는지(scope full/range/partial 토큰 +
// timestamp 토큰 + .json 확장자 파일명 / application/json content-type / byte size 추정 /
// attachment content-disposition 정합 / options.now vs generatedAt fallback / 빈 records vs
// 다수 records byteSizeHint) + 입력 방어 분기(비-object dump · dump.scope 부재·비-object ·
// scope.scope invalid · options.now 비-Date/Invalid Date)별 한국어 TypeError/RangeError +
// non-mutating(deepFreeze 통과) + fileName sanitize(path traversal/특수문자 0)을 검증한다
// (export-result.spec.ts mirror).
import {
  buildExportArtifactDescriptor,
  ExportArtifactDescriptor,
} from "./export-artifact-descriptor";
import { ExportDump } from "./export-dump";
import { ExportRecord, ExportScope } from "./export-scope-select";

// 5 entity 전부 0 인 entityCounts map 헬퍼 — 기대값 작성 보조.
function zeroCounts() {
  return { Assessment: 0, Person: 0, Group: 0, LlmConfig: 0, AuditLog: 0 };
}

// 정상 ExportDump 생성 헬퍼 — scope / generatedAt(ISO) / records override.
function makeDump(over?: {
  scope?: ExportScope;
  generatedAt?: string;
  records?: ExportRecord[];
  entityCounts?: Record<string, number>;
}): ExportDump {
  const records = over?.records ?? [];
  return {
    schemaVersion: "1",
    generatedAt: over?.generatedAt ?? "2026-06-17T03:04:05.000Z",
    scope: over?.scope ?? { scope: "full" },
    entityCounts: (over?.entityCounts ??
      zeroCounts()) as ExportDump["entityCounts"],
    recordCount: records.length,
    records,
  };
}

// 깊은 동결 헬퍼 — non-mutating regression 용(중첩 scope / records 배열까지 freeze).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
    Object.freeze(obj);
  }
  return obj;
}

describe("buildExportArtifactDescriptor — happy path", () => {
  it("scope=full → fileName 에 full 토큰 + timestamp + .json, contentType application/json, contentDisposition attachment, scopeToken full", () => {
    const dump = makeDump({ scope: { scope: "full" } });
    const d: ExportArtifactDescriptor = buildExportArtifactDescriptor(dump);

    expect(d.scopeToken).toBe("full");
    expect(d.fileName).toBe("export-full-20260617T030405.json");
    expect(d.contentType).toBe("application/json");
    expect(d.contentDisposition).toBe(
      'attachment; filename="export-full-20260617T030405.json"',
    );
    expect(typeof d.byteSizeHint).toBe("number");
    expect(d.byteSizeHint).toBeGreaterThan(0);
  });

  it("scope=range → fileName 에 range 토큰, scopeToken range, content-disposition 에 동일 fileName 포함", () => {
    const dump = makeDump({
      scope: {
        scope: "range",
        dateRange: {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-02-01T00:00:00.000Z"),
        },
      },
    });
    const d = buildExportArtifactDescriptor(dump);

    expect(d.scopeToken).toBe("range");
    expect(d.fileName).toContain("export-range-");
    expect(d.fileName.endsWith(".json")).toBe(true);
    expect(d.contentDisposition).toBe(`attachment; filename="${d.fileName}"`);
  });

  it("scope=partial → fileName 에 partial 토큰, scopeToken partial", () => {
    const dump = makeDump({
      scope: { scope: "partial", entitySelector: ["Person", "Group"] },
    });
    const d = buildExportArtifactDescriptor(dump);

    expect(d.scopeToken).toBe("partial");
    expect(d.fileName).toContain("export-partial-");
  });
});

describe("buildExportArtifactDescriptor — branch coverage", () => {
  it("options.now 제공 시 그 시각이 timestamp 토큰 source(generatedAt 무시)", () => {
    const dump = makeDump({ generatedAt: "2026-06-17T03:04:05.000Z" });
    const d = buildExportArtifactDescriptor(dump, {
      now: new Date("2030-12-25T11:22:33.000Z"),
    });

    // options.now 가 우선 — generatedAt(2026...) 아닌 2030... 토큰.
    expect(d.fileName).toBe("export-full-20301225T112233.json");
  });

  it("options.now 부재 시 dump.generatedAt(ISO) 가 timestamp 토큰 source(fallback)", () => {
    const dump = makeDump({ generatedAt: "2026-06-17T03:04:05.000Z" });
    const d = buildExportArtifactDescriptor(dump);

    expect(d.fileName).toBe("export-full-20260617T030405.json");
  });

  it("빈 records(recordCount 0) 와 다수 records 의 byteSizeHint 가 모두 양수이며 다수 쪽이 더 큼", () => {
    const empty = makeDump({ records: [] });
    const many = makeDump({
      records: [
        { entity: "Assessment", instant: new Date("2026-01-01T00:00:00.000Z") },
        { entity: "Person", instant: new Date("2026-01-02T00:00:00.000Z") },
        { entity: "Group", instant: new Date("2026-01-03T00:00:00.000Z") },
      ],
      entityCounts: { ...zeroCounts(), Assessment: 1, Person: 1, Group: 1 },
    });

    const dEmpty = buildExportArtifactDescriptor(empty);
    const dMany = buildExportArtifactDescriptor(many);

    expect(dEmpty.byteSizeHint).toBeGreaterThan(0);
    expect(dMany.byteSizeHint).toBeGreaterThan(dEmpty.byteSizeHint);
  });

  it("options.now·generatedAt 둘 다 비정상이면 timestamp 토큰이 unknown 으로 fallback", () => {
    // generatedAt 이 ISO 가 아닌 비정상 string → 파싱 Invalid → "unknown".
    const dump = makeDump({ generatedAt: "not-a-date" });
    const d = buildExportArtifactDescriptor(dump);

    expect(d.fileName).toBe("export-full-unknown.json");
  });
});

describe("buildExportArtifactDescriptor — error path / negative cases", () => {
  // (a) dump 비-object(null/undefined/숫자/문자열/배열) → TypeError.
  it("dump 가 null 이면 한국어 TypeError", () => {
    expect(() =>
      buildExportArtifactDescriptor(null as unknown as ExportDump),
    ).toThrow(TypeError);
    expect(() =>
      buildExportArtifactDescriptor(null as unknown as ExportDump),
    ).toThrow(/plain object 여야/);
  });

  it("dump 가 undefined 면 TypeError", () => {
    expect(() =>
      buildExportArtifactDescriptor(undefined as unknown as ExportDump),
    ).toThrow(TypeError);
  });

  it("dump 가 숫자/문자열/배열이면 TypeError", () => {
    expect(() =>
      buildExportArtifactDescriptor(42 as unknown as ExportDump),
    ).toThrow(TypeError);
    expect(() =>
      buildExportArtifactDescriptor("dump" as unknown as ExportDump),
    ).toThrow(TypeError);
    expect(() =>
      buildExportArtifactDescriptor([] as unknown as ExportDump),
    ).toThrow(/array/);
  });

  // (b) dump.scope 부재 → TypeError.
  it("dump.scope 가 부재면 한국어 TypeError", () => {
    const dump = { ...makeDump() } as Record<string, unknown>;
    delete dump.scope;
    expect(() =>
      buildExportArtifactDescriptor(dump as unknown as ExportDump),
    ).toThrow(TypeError);
    expect(() =>
      buildExportArtifactDescriptor(dump as unknown as ExportDump),
    ).toThrow(/dump\.scope 는 plain object/);
  });

  it("dump.scope 가 비-object(문자열)면 TypeError", () => {
    const dump = makeDump();
    (dump as unknown as Record<string, unknown>).scope = "full";
    expect(() => buildExportArtifactDescriptor(dump)).toThrow(TypeError);
  });

  // (c) scope.scope 값이 허용 외("weird"/빈 문자열/대문자/숫자) → RangeError.
  it('scope.scope 가 "weird" 면 한국어 RangeError', () => {
    const dump = makeDump({
      scope: { scope: "weird" as unknown as ExportScope["scope"] },
    });
    expect(() => buildExportArtifactDescriptor(dump)).toThrow(RangeError);
    expect(() => buildExportArtifactDescriptor(dump)).toThrow(
      /full\/range\/partial/,
    );
  });

  it("scope.scope 가 빈 문자열 / 대문자 FULL / 숫자면 RangeError", () => {
    const empty = makeDump({
      scope: { scope: "" as unknown as ExportScope["scope"] },
    });
    const upper = makeDump({
      scope: { scope: "FULL" as unknown as ExportScope["scope"] },
    });
    const num = makeDump({
      scope: { scope: 1 as unknown as ExportScope["scope"] },
    });
    expect(() => buildExportArtifactDescriptor(empty)).toThrow(RangeError);
    expect(() => buildExportArtifactDescriptor(upper)).toThrow(RangeError);
    expect(() => buildExportArtifactDescriptor(num)).toThrow(RangeError);
  });

  // (d) options.now Invalid Date / 비-Date → TypeError.
  it("options.now 가 Invalid Date 면 한국어 TypeError", () => {
    const dump = makeDump();
    expect(() =>
      buildExportArtifactDescriptor(dump, { now: new Date("nope") }),
    ).toThrow(TypeError);
    expect(() =>
      buildExportArtifactDescriptor(dump, { now: new Date("nope") }),
    ).toThrow(/options\.now 은\(는\) 유효한 Date/);
  });

  it("options.now 가 비-Date(문자열/숫자)면 TypeError", () => {
    const dump = makeDump();
    expect(() =>
      buildExportArtifactDescriptor(dump, {
        now: "2026-01-01" as unknown as Date,
      }),
    ).toThrow(TypeError);
    expect(() =>
      buildExportArtifactDescriptor(dump, { now: 0 as unknown as Date }),
    ).toThrow(TypeError);
  });

  // (e) dump.generatedAt 가 ISO string 이 아닌 비정상 값일 때 방어(throw 0, unknown fallback).
  it("dump.generatedAt 가 비정상 값이어도 throw 없이 unknown 토큰", () => {
    const weird = makeDump({ generatedAt: "12345-bad" });
    expect(() => buildExportArtifactDescriptor(weird)).not.toThrow();
    expect(buildExportArtifactDescriptor(weird).fileName).toBe(
      "export-full-unknown.json",
    );
  });
});

describe("buildExportArtifactDescriptor — sanitize / non-mutating", () => {
  it("fileName 에 path traversal/특수문자(../, /, \\, :)가 섞이지 않는다 — 안전 charset", () => {
    const dump = makeDump({
      scope: { scope: "range" },
      generatedAt: "2026-06-17T03:04:05.000Z",
    });
    const d = buildExportArtifactDescriptor(dump);

    expect(d.fileName).not.toMatch(/[/\\]/);
    expect(d.fileName).not.toContain("..");
    expect(d.fileName).not.toContain(":");
    // 파일명 본문(확장자 제외)은 [0-9A-Za-z-] charset 만.
    expect(d.fileName).toMatch(/^export-[a-z]+-[0-9A-Za-z]+\.json$/);
  });

  it("입력 dump(deepFreeze)를 변형하지 않는다 — non-mutating", () => {
    const dump = deepFreeze(makeDump({ scope: { scope: "full" } }));
    expect(() => buildExportArtifactDescriptor(dump)).not.toThrow();
    const d = buildExportArtifactDescriptor(dump);
    expect(d.fileName).toBe("export-full-20260617T030405.json");
  });
});
