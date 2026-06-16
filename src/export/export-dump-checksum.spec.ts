// export-dump-checksum 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). computeDumpChecksum 의 64자 hex digest + 결정성 + field/record 변경 시 digest 변화 +
// 입력 방어 throw(null/누락 헤더/records 비-배열/Invalid Date instant) + non-mutating, 그리고
// verifyDumpChecksum 의 happy verdict + negative 분기(1자 차이/대소문자/빈 문자열/비-string/
// 변조 dump/길이 불일치)를 각각 검증한다(export-dump.spec.ts mirror).
import { buildExportDump, ExportDump } from "./export-dump";
import {
  computeDumpChecksum,
  verifyDumpChecksum,
} from "./export-dump-checksum";
import { ExportRecord, ExportScope } from "./export-scope-select";

const d = (iso: string) => new Date(iso);

const rec = (entity: ExportRecord["entity"], iso: string): ExportRecord => ({
  entity,
  instant: d(iso),
});

const fullScope: ExportScope = { scope: "full" };

// buildExportDump 로 정상 envelope 를 만들어 checksum 대상으로 쓴다(sibling helper 와 정합 검증).
const makeDump = (records: ExportRecord[] = []): ExportDump =>
  buildExportDump(records, {
    scope: fullScope,
    generatedAt: d("2026-06-16T09:30:00.000Z"),
  });

const sampleRecords = [
  rec("Assessment", "2026-06-11T00:00:00.000Z"),
  rec("Person", "2026-06-12T00:00:00.000Z"),
  rec("AuditLog", "2026-06-13T00:00:00.000Z"),
];

describe("computeDumpChecksum — happy path (64자 hex digest)", () => {
  it("정상 ExportDump 입력에 대해 64자 소문자 hex(sha256) digest 를 반환한다", () => {
    const digest = computeDumpChecksum(makeDump(sampleRecords));
    expect(typeof digest).toBe("string");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("빈 records dump 도 정상적으로 64자 hex digest 를 산출한다", () => {
    const digest = computeDumpChecksum(makeDump([]));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("range scope + entitySelector 가 담긴 dump 도 digest 를 산출한다", () => {
    const scope: ExportScope = {
      scope: "range",
      dateRange: {
        start: d("2026-06-01T00:00:00.000Z"),
        end: d("2026-06-30T00:00:00.000Z"),
      },
      entitySelector: ["Assessment", "Person"],
    };
    const dump = buildExportDump(
      [rec("Assessment", "2026-06-11T00:00:00.000Z")],
      {
        scope,
        generatedAt: d("2026-06-16T09:30:00.000Z"),
      },
    );
    expect(computeDumpChecksum(dump)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("computeDumpChecksum — 결정성 (같은 입력 → 같은 digest)", () => {
  it("동일 입력을 별 인스턴스로 재구성해 두 번 호출해도 같은 digest", () => {
    const a = computeDumpChecksum(makeDump(sampleRecords));
    const b = computeDumpChecksum(
      makeDump([
        rec("Assessment", "2026-06-11T00:00:00.000Z"),
        rec("Person", "2026-06-12T00:00:00.000Z"),
        rec("AuditLog", "2026-06-13T00:00:00.000Z"),
      ]),
    );
    expect(a).toBe(b);
  });

  it("record 의 instant 가 1개라도 다르면 digest 가 달라진다", () => {
    const base = computeDumpChecksum(makeDump(sampleRecords));
    const altered = computeDumpChecksum(
      makeDump([
        rec("Assessment", "2026-06-11T00:00:01.000Z"), // 1초 차이
        rec("Person", "2026-06-12T00:00:00.000Z"),
        rec("AuditLog", "2026-06-13T00:00:00.000Z"),
      ]),
    );
    expect(altered).not.toBe(base);
  });

  it("record 의 entity 가 다르면 digest 가 달라진다", () => {
    const base = computeDumpChecksum(makeDump(sampleRecords));
    const altered = computeDumpChecksum(
      makeDump([
        rec("Group", "2026-06-11T00:00:00.000Z"), // entity 변경
        rec("Person", "2026-06-12T00:00:00.000Z"),
        rec("AuditLog", "2026-06-13T00:00:00.000Z"),
      ]),
    );
    expect(altered).not.toBe(base);
  });

  it("record 순서가 바뀌면 digest 가 달라진다 (순서 보존)", () => {
    const base = computeDumpChecksum(makeDump(sampleRecords));
    const reordered = computeDumpChecksum(
      makeDump([
        rec("Person", "2026-06-12T00:00:00.000Z"),
        rec("Assessment", "2026-06-11T00:00:00.000Z"),
        rec("AuditLog", "2026-06-13T00:00:00.000Z"),
      ]),
    );
    expect(reordered).not.toBe(base);
  });

  it("generatedAt 헤더가 다르면 digest 가 달라진다", () => {
    const base = computeDumpChecksum(makeDump([]));
    const altered = computeDumpChecksum(
      buildExportDump([], {
        scope: fullScope,
        generatedAt: d("2026-06-16T09:30:01.000Z"),
      }),
    );
    expect(altered).not.toBe(base);
  });

  it("schemaVersion 헤더가 다르면 digest 가 달라진다", () => {
    const base = computeDumpChecksum(makeDump([]));
    const altered = computeDumpChecksum(
      buildExportDump([], {
        scope: fullScope,
        generatedAt: d("2026-06-16T09:30:00.000Z"),
        schemaVersion: "2",
      }),
    );
    expect(altered).not.toBe(base);
  });

  it("scope 가 null 인 dump 도 (String(scope) 경로로) digest 를 산출한다", () => {
    // scope 가 falsy 면 scopeKind=String(null), scopeRange/scopeEntities=none 경로.
    const dump = { ...makeDump([]), scope: null } as unknown as ExportDump;
    expect(computeDumpChecksum(dump)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("scope(종류/range/entitySelector)가 다르면 digest 가 달라진다", () => {
    const base = computeDumpChecksum(makeDump([]));
    const partial = computeDumpChecksum(
      buildExportDump([], {
        scope: { scope: "partial", entitySelector: ["Person"] },
        generatedAt: d("2026-06-16T09:30:00.000Z"),
      }),
    );
    expect(partial).not.toBe(base);
  });
});

describe("computeDumpChecksum — error path (입력 방어 TypeError)", () => {
  it("dump 가 null 이면 TypeError", () => {
    expect(() => computeDumpChecksum(null as unknown as ExportDump)).toThrow(
      TypeError,
    );
  });

  it("dump 가 undefined 면 TypeError", () => {
    expect(() =>
      computeDumpChecksum(undefined as unknown as ExportDump),
    ).toThrow(TypeError);
  });

  it("dump 가 배열이면 TypeError", () => {
    expect(() => computeDumpChecksum([] as unknown as ExportDump)).toThrow(
      TypeError,
    );
  });

  it("schemaVersion 이 비-string(누락) 이면 TypeError", () => {
    const dump = {
      ...makeDump([]),
      schemaVersion: undefined,
    } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("generatedAt 이 비-string(누락) 이면 TypeError", () => {
    const dump = { ...makeDump([]), generatedAt: 123 } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("records 가 배열이 아니면 TypeError", () => {
    const dump = { ...makeDump([]), records: {} } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("entityCounts 가 객체가 아니면 TypeError", () => {
    const dump = {
      ...makeDump([]),
      entityCounts: null,
    } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("entityCounts 가 non-null 비-object(number) 면 TypeError", () => {
    const dump = {
      ...makeDump([]),
      entityCounts: 7,
    } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("entityCounts 의 한 entity 가 비-number 면 TypeError", () => {
    const base = makeDump([]);
    const dump = {
      ...base,
      entityCounts: { ...base.entityCounts, Person: "x" },
    } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("recordCount 가 비-number 면 TypeError", () => {
    const dump = { ...makeDump([]), recordCount: "3" } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("record.instant 가 Invalid Date 면 그 index 를 메시지에 담아 TypeError", () => {
    const base = makeDump([]);
    const dump = {
      ...base,
      records: [
        rec("Assessment", "2026-06-11T00:00:00.000Z"),
        { entity: "Person", instant: new Date("nope") } as ExportRecord,
      ],
    } as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(/records\[1\]/);
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("record.instant 가 비-Date(문자열) 면 TypeError", () => {
    const base = makeDump([]);
    const dump = {
      ...base,
      records: [{ entity: "Group", instant: "2026-06-11" }],
    } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });

  it("scope.dateRange 의 start 가 Invalid Date 면 TypeError", () => {
    const base = makeDump([]);
    const dump = {
      ...base,
      scope: {
        scope: "range",
        dateRange: {
          start: new Date("nope"),
          end: d("2026-06-30T00:00:00.000Z"),
        },
      },
    } as unknown as ExportDump;
    expect(() => computeDumpChecksum(dump)).toThrow(TypeError);
  });
});

describe("computeDumpChecksum — non-mutating", () => {
  it("freeze 된 dump(및 records)로 호출해도 변형 없이 통과한다", () => {
    const records = sampleRecords.map((r) => Object.freeze({ ...r }));
    const dump = makeDump(records as ExportRecord[]);
    Object.freeze(dump);
    Object.freeze(dump.records);
    expect(() => computeDumpChecksum(dump)).not.toThrow();
    expect(computeDumpChecksum(dump)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("호출 후 입력 dump 내용이 변형되지 않는다", () => {
    const dump = makeDump(sampleRecords);
    const before = JSON.stringify(dump);
    computeDumpChecksum(dump);
    expect(JSON.stringify(dump)).toBe(before);
  });
});

describe("verifyDumpChecksum — happy path", () => {
  it("직접 산출한 checksum 을 expected 로 넘기면 valid:true + computed==expected", () => {
    const dump = makeDump(sampleRecords);
    const checksum = computeDumpChecksum(dump);
    const result = verifyDumpChecksum(dump, checksum);
    expect(result.valid).toBe(true);
    expect(result.computed).toBe(checksum);
    expect(result.expected).toBe(checksum);
  });

  it("expected 가 대소문자만 다르면 valid:true (hex 는 대소문자 무의미)", () => {
    const dump = makeDump(sampleRecords);
    const checksum = computeDumpChecksum(dump);
    const result = verifyDumpChecksum(dump, checksum.toUpperCase());
    expect(result.valid).toBe(true);
    expect(result.expected).toBe(checksum); // 소문자로 정규화됨
  });
});

describe("verifyDumpChecksum — negative cases (예외 분기마다 1+)", () => {
  it("expected 가 1 char 다르면 valid:false (computed 는 정상 산출)", () => {
    const dump = makeDump(sampleRecords);
    const checksum = computeDumpChecksum(dump);
    // 마지막 글자를 다른 hex 로 바꿔 1자 차이 생성.
    const tail = checksum.endsWith("a") ? "b" : "a";
    const wrong = checksum.slice(0, -1) + tail;
    const result = verifyDumpChecksum(dump, wrong);
    expect(result.valid).toBe(false);
    expect(result.computed).toBe(checksum);
  });

  it("expected 가 빈 문자열이면 valid:false", () => {
    const dump = makeDump(sampleRecords);
    const result = verifyDumpChecksum(dump, "");
    expect(result.valid).toBe(false);
    expect(result.expected).toBe("");
  });

  it("expected 가 비-string 이면 빈 문자열로 정규화되어 valid:false", () => {
    const dump = makeDump(sampleRecords);
    const result = verifyDumpChecksum(dump, 12345 as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.expected).toBe("");
  });

  it("expected 가 길이만 짧으면(잘린 hex) valid:false", () => {
    const dump = makeDump(sampleRecords);
    const checksum = computeDumpChecksum(dump);
    const result = verifyDumpChecksum(dump, checksum.slice(0, 32));
    expect(result.valid).toBe(false);
  });

  it("변조된 dump(한 field 변경 후 옛 checksum)는 valid:false", () => {
    const original = makeDump(sampleRecords);
    const oldChecksum = computeDumpChecksum(original);
    // 한 record 의 instant 를 바꾼 변조 dump — 구조는 멀쩡하나 옛 checksum 과 mismatch.
    const tampered = makeDump([
      rec("Assessment", "2026-06-11T00:00:02.000Z"),
      rec("Person", "2026-06-12T00:00:00.000Z"),
      rec("AuditLog", "2026-06-13T00:00:00.000Z"),
    ]);
    const result = verifyDumpChecksum(tampered, oldChecksum);
    expect(result.valid).toBe(false);
    expect(result.computed).not.toBe(oldChecksum);
  });

  it("entity 만 변조된 dump 도 옛 checksum 과 mismatch (구조 gate 가 못 잡는 변조)", () => {
    const original = makeDump(sampleRecords);
    const oldChecksum = computeDumpChecksum(original);
    const tampered = makeDump([
      rec("Group", "2026-06-11T00:00:00.000Z"), // Assessment → Group 변조
      rec("Person", "2026-06-12T00:00:00.000Z"),
      rec("AuditLog", "2026-06-13T00:00:00.000Z"),
    ]);
    expect(verifyDumpChecksum(tampered, oldChecksum).valid).toBe(false);
  });
});
