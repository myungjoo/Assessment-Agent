// import-restore-preview 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). buildExportDump 가 만든 정상 envelope(빈 / 혼합 / 5 entity / 단일 entity records)에서
// summarizeImportImpact 가 totalRecords / perEntity(5 key) / instantRange(earliest/latest)를
// 정확 산출하는지 + 입력 방어 분기(비-object dump · records 비-배열 · instant Invalid/비-Date)별
// TypeError + 경계(단일 record earliest===latest · 동일 instant 다수 · 빈 records→null) +
// non-mutating(freeze 통과)을 검증한다(import-dump-validate.spec.ts mirror). buildExportDump 로
// 정방향 envelope 를 만들어 요약이 envelope 와 정합하는지 round-trip 도 함께 본다.
import { buildExportDump, ExportDump } from "./export-dump";
import { ExportRecord } from "./export-scope-select";
import { summarizeImportImpact, ImportImpact } from "./import-restore-preview";

// buildExportDump 가 만든 정상 envelope 를 받는 헬퍼 — 요약의 happy input.
function makeDump(records: ExportRecord[]): ExportDump {
  return buildExportDump(records, {
    scope: { scope: "full" },
    generatedAt: new Date("2026-06-16T00:00:00.000Z"),
  });
}

describe("summarizeImportImpact — happy path (buildExportDump round-trip)", () => {
  it("다수 entity 혼합 records → totalRecords / perEntity / instantRange 정확 산출", () => {
    const dump = makeDump([
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") },
      { entity: "Assessment", instant: new Date("2026-03-01T00:00:00Z") },
      { entity: "AuditLog", instant: new Date("2026-01-15T00:00:00Z") },
    ]);
    const impact: ImportImpact = summarizeImportImpact(dump);
    expect(impact.totalRecords).toBe(4);
    expect(impact.perEntity).toEqual({
      Assessment: 2,
      Person: 1,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 1,
    });
    // perEntity 5 key 합계 === totalRecords 정합.
    const sum = Object.values(impact.perEntity).reduce((a, b) => a + b, 0);
    expect(sum).toBe(impact.totalRecords);
    // earliest < latest (가장 이른 instant: 2026-01-01, 가장 늦은: 2026-03-01).
    expect(impact.instantRange).not.toBeNull();
    expect(impact.instantRange!.earliest.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(impact.instantRange!.latest.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(impact.instantRange!.earliest.getTime()).toBeLessThan(
      impact.instantRange!.latest.getTime(),
    );
  });

  it("5 entity 전부 등장 → perEntity 각 1, instantRange earliest<latest", () => {
    const dump = makeDump([
      { entity: "Assessment", instant: new Date("2026-01-05T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-02T00:00:00Z") },
      { entity: "Group", instant: new Date("2026-01-04T00:00:00Z") },
      { entity: "LlmConfig", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "AuditLog", instant: new Date("2026-01-03T00:00:00Z") },
    ]);
    const impact = summarizeImportImpact(dump);
    expect(impact.perEntity).toEqual({
      Assessment: 1,
      Person: 1,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 1,
    });
    expect(impact.instantRange!.earliest.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(impact.instantRange!.latest.toISOString()).toBe(
      "2026-01-05T00:00:00.000Z",
    );
  });

  it("빈 records envelope → totalRecords 0 / perEntity 전부 0 / instantRange null", () => {
    const impact = summarizeImportImpact(makeDump([]));
    expect(impact.totalRecords).toBe(0);
    expect(impact.perEntity).toEqual({
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    });
    expect(impact.instantRange).toBeNull();
  });
});

describe("summarizeImportImpact — 경계 / branch", () => {
  it("단일 record → earliest === latest 경계", () => {
    const instant = new Date("2026-04-01T12:00:00Z");
    const dump = makeDump([{ entity: "Group", instant }]);
    const impact = summarizeImportImpact(dump);
    expect(impact.totalRecords).toBe(1);
    expect(impact.perEntity.Group).toBe(1);
    expect(impact.instantRange).not.toBeNull();
    expect(impact.instantRange!.earliest.getTime()).toBe(
      impact.instantRange!.latest.getTime(),
    );
    expect(impact.instantRange!.earliest.toISOString()).toBe(
      "2026-04-01T12:00:00.000Z",
    );
  });

  it("단일 entity 만 존재 → 나머지 4 key 는 0", () => {
    const dump = makeDump([
      { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-02T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-03T00:00:00Z") },
    ]);
    const impact = summarizeImportImpact(dump);
    expect(impact.perEntity).toEqual({
      Assessment: 0,
      Person: 3,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    });
  });

  it("동일 instant 다수 record → earliest === latest, 집계 정상", () => {
    const same = "2026-05-05T05:05:05Z";
    const dump = makeDump([
      { entity: "Assessment", instant: new Date(same) },
      { entity: "Person", instant: new Date(same) },
      { entity: "Assessment", instant: new Date(same) },
    ]);
    const impact = summarizeImportImpact(dump);
    expect(impact.totalRecords).toBe(3);
    expect(impact.perEntity.Assessment).toBe(2);
    expect(impact.perEntity.Person).toBe(1);
    expect(impact.instantRange!.earliest.getTime()).toBe(
      impact.instantRange!.latest.getTime(),
    );
  });

  it("instant 순서가 역순으로 들어와도 earliest/latest 정확", () => {
    const dump = makeDump([
      { entity: "Assessment", instant: new Date("2026-12-31T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Group", instant: new Date("2026-06-15T00:00:00Z") },
    ]);
    const impact = summarizeImportImpact(dump);
    expect(impact.instantRange!.earliest.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(impact.instantRange!.latest.toISOString()).toBe(
      "2026-12-31T00:00:00.000Z",
    );
  });
});

describe("summarizeImportImpact — 입력 방어 (negative)", () => {
  it("비-object dump(null) → TypeError", () => {
    expect(() => summarizeImportImpact(null as unknown as ExportDump)).toThrow(
      TypeError,
    );
    expect(() => summarizeImportImpact(null as unknown as ExportDump)).toThrow(
      /plain object/,
    );
  });

  it("비-object dump(배열) → TypeError(array 명시)", () => {
    expect(() => summarizeImportImpact([] as unknown as ExportDump)).toThrow(
      /array/,
    );
  });

  it("비-object dump(string) → TypeError", () => {
    expect(() =>
      summarizeImportImpact("not-a-dump" as unknown as ExportDump),
    ).toThrow(TypeError);
  });

  it("비-object dump(number) → TypeError", () => {
    expect(() => summarizeImportImpact(42 as unknown as ExportDump)).toThrow(
      /plain object/,
    );
  });

  it("dump.records 가 배열 아님(object) → TypeError", () => {
    const bad = { records: {} } as unknown as ExportDump;
    expect(() => summarizeImportImpact(bad)).toThrow(/records 는 배열/);
  });

  it("dump.records 가 배열 아님(undefined) → TypeError", () => {
    const bad = {} as unknown as ExportDump;
    expect(() => summarizeImportImpact(bad)).toThrow(/records 는 배열/);
  });

  it("records 원소 instant 가 Invalid Date → 그 index TypeError", () => {
    const bad = {
      records: [{ entity: "Assessment", instant: new Date("not-a-date") }],
    } as unknown as ExportDump;
    expect(() => summarizeImportImpact(bad)).toThrow(/records\[0\]\.instant/);
  });

  it("records 원소 instant 가 비-Date(string) → 그 index TypeError", () => {
    const bad = {
      records: [{ entity: "Person", instant: "2026-01-01T00:00:00Z" }],
    } as unknown as ExportDump;
    expect(() => summarizeImportImpact(bad)).toThrow(/records\[1?0\]\.instant/);
  });

  it("두 번째 record 의 instant 가 비-Date → 그 index(1) TypeError", () => {
    const bad = {
      records: [
        { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
        { entity: "Group", instant: null },
      ],
    } as unknown as ExportDump;
    expect(() => summarizeImportImpact(bad)).toThrow(/records\[1\]\.instant/);
  });
});

describe("summarizeImportImpact — non-mutating (freeze 통과)", () => {
  it("Object.freeze 된 dump + records 입력으로 호출해도 통과하고 변형 0", () => {
    const records = [
      Object.freeze({
        entity: "Assessment" as const,
        instant: new Date("2026-01-01T00:00:00.000Z"),
      }),
      Object.freeze({
        entity: "Person" as const,
        instant: new Date("2026-02-01T00:00:00.000Z"),
      }),
    ];
    const dump = Object.freeze({
      schemaVersion: "1",
      generatedAt: "2026-06-16T00:00:00.000Z",
      scope: Object.freeze({ scope: "full" as const }),
      entityCounts: Object.freeze({
        Assessment: 1,
        Person: 1,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      }),
      recordCount: 2,
      records: Object.freeze(records),
    }) as unknown as ExportDump;
    let impact: ImportImpact;
    expect(() => {
      impact = summarizeImportImpact(dump);
    }).not.toThrow();
    expect(impact!.totalRecords).toBe(2);
    expect(impact!.perEntity.Assessment).toBe(1);
    expect(impact!.instantRange!.earliest.toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    // 입력 변형 0 검증.
    expect(dump.recordCount).toBe(2);
    expect(dump.records).toHaveLength(2);
  });

  it("반환 perEntity 는 새 객체 — 입력 entityCounts 와 별개 참조", () => {
    const dump = makeDump([
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
    ]);
    const impact = summarizeImportImpact(dump);
    expect(impact.perEntity).not.toBe(dump.entityCounts);
    impact.perEntity.Assessment = 999;
    // 반환 map 변형이 입력 envelope 에 전파되지 않음.
    expect(dump.entityCounts.Assessment).toBe(1);
  });
});
