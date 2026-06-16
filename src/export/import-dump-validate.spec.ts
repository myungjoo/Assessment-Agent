// import-dump-validate 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). buildExportDump 가 만든 정상 envelope(빈 / 혼합 records)가 valid 인지 + 각 구조
// 위반 규칙(top-level 비-object · schemaVersion · generatedAt · records 비-배열 · 원소 shape ·
// entity 허용 외 · entityCounts key 누락/비-number · recordCount 불일치 · entityCounts 합계
// 불일치)별 issue 박제 + 다중 위반 동시 누적 + non-mutating(freeze 통과)을 검증한다
// (schema-version-compat.spec.ts mirror). buildExportDump 로 정방향 envelope 를 만들어 역방향
// 검증이 통과하는지 확인하는 round-trip 정합도 함께 본다.
import { buildExportDump, ExportDump } from "./export-dump";
import { ExportRecord } from "./export-scope-select";
import {
  validateImportDumpStructure,
  ImportDumpValidation,
} from "./import-dump-validate";

// buildExportDump 가 만든 정상 envelope 를 plain object 로 받는 헬퍼 — 역방향 검증의 happy input.
function makeValidDump(records: ExportRecord[]): ExportDump {
  return buildExportDump(records, {
    scope: { scope: "full" },
    generatedAt: new Date("2026-06-16T00:00:00.000Z"),
  });
}

describe("validateImportDumpStructure — happy path (buildExportDump round-trip)", () => {
  it("빈 records envelope → valid:true, issues 빈 배열", () => {
    const v: ImportDumpValidation = validateImportDumpStructure(
      makeValidDump([]),
    );
    expect(v).toEqual({ valid: true, issues: [] });
  });

  it("다수 entity 혼합 records envelope → valid:true", () => {
    const dump = makeValidDump([
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") },
      { entity: "AuditLog", instant: new Date("2026-03-01T00:00:00Z") },
    ]);
    const v = validateImportDumpStructure(dump);
    expect(v.valid).toBe(true);
    expect(v.issues).toHaveLength(0);
  });

  it("5 entity 전부 등장하는 envelope → valid:true (entityCounts 합계 정합)", () => {
    const dump = makeValidDump([
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-02T00:00:00Z") },
      { entity: "Group", instant: new Date("2026-01-03T00:00:00Z") },
      { entity: "LlmConfig", instant: new Date("2026-01-04T00:00:00Z") },
      { entity: "AuditLog", instant: new Date("2026-01-05T00:00:00Z") },
    ]);
    expect(validateImportDumpStructure(dump).valid).toBe(true);
  });
});

describe("validateImportDumpStructure — top-level shape (negative)", () => {
  it("null → invalid + null 명시 issue", () => {
    const v = validateImportDumpStructure(null);
    expect(v.valid).toBe(false);
    expect(v.issues).toHaveLength(1);
    expect(v.issues[0]).toMatch(/null/);
  });

  it("배열 → invalid + array 명시 issue", () => {
    const v = validateImportDumpStructure([]);
    expect(v.valid).toBe(false);
    expect(v.issues[0]).toMatch(/array/);
  });

  it("비-object(string) → invalid + plain object issue", () => {
    const v = validateImportDumpStructure("not-a-dump");
    expect(v.valid).toBe(false);
    expect(v.issues[0]).toMatch(/plain object/);
  });

  it("비-object(number) → invalid", () => {
    expect(validateImportDumpStructure(42).valid).toBe(false);
  });

  it("undefined → invalid (하위 검증 도달 전 단일 issue 종료)", () => {
    const v = validateImportDumpStructure(undefined);
    expect(v.valid).toBe(false);
    expect(v.issues).toHaveLength(1);
  });
});

// 정상 dump 를 base 로 한 field 만 손상시켜 해당 issue 만 박제되는지 본다.
function corrupt(over: Partial<Record<string, unknown>>): unknown {
  const base = makeValidDump([
    { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
  ]) as unknown as Record<string, unknown>;
  return { ...base, ...over };
}

describe("validateImportDumpStructure — schemaVersion (negative)", () => {
  it("schemaVersion 누락(undefined) → issue", () => {
    const v = validateImportDumpStructure(
      corrupt({ schemaVersion: undefined }),
    );
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => /schemaVersion/.test(i))).toBe(true);
  });

  it("schemaVersion 빈 문자열 → issue", () => {
    const v = validateImportDumpStructure(corrupt({ schemaVersion: "" }));
    expect(v.issues.some((i) => /schemaVersion/.test(i))).toBe(true);
  });

  it("schemaVersion 공백만 → issue", () => {
    const v = validateImportDumpStructure(corrupt({ schemaVersion: "   " }));
    expect(v.issues.some((i) => /schemaVersion/.test(i))).toBe(true);
  });

  it("schemaVersion 비-string(number) → issue", () => {
    const v = validateImportDumpStructure(corrupt({ schemaVersion: 1 }));
    expect(v.issues.some((i) => /schemaVersion/.test(i))).toBe(true);
  });
});

describe("validateImportDumpStructure — generatedAt (negative)", () => {
  it("generatedAt 비-string → issue", () => {
    const v = validateImportDumpStructure(corrupt({ generatedAt: 12345 }));
    expect(v.issues.some((i) => /generatedAt/.test(i))).toBe(true);
  });

  it("generatedAt 빈 문자열 → issue", () => {
    const v = validateImportDumpStructure(corrupt({ generatedAt: "" }));
    expect(v.issues.some((i) => /generatedAt/.test(i))).toBe(true);
  });

  it("generatedAt Invalid Date string → issue", () => {
    const v = validateImportDumpStructure(
      corrupt({ generatedAt: "not-a-date" }),
    );
    expect(v.issues.some((i) => /generatedAt/.test(i))).toBe(true);
  });
});

describe("validateImportDumpStructure — records (negative)", () => {
  it("records 비-배열(object) → issue", () => {
    const v = validateImportDumpStructure(corrupt({ records: {} }));
    expect(v.issues.some((i) => /records 는 배열/.test(i))).toBe(true);
  });

  it("records 원소가 비-object → 그 index issue", () => {
    const v = validateImportDumpStructure(
      corrupt({ records: ["bad"], recordCount: 1 }),
    );
    expect(v.issues.some((i) => /records\[0\]/.test(i))).toBe(true);
  });

  it("records 원소 entity 가 5 허용 외 값 → 그 index entity issue", () => {
    const v = validateImportDumpStructure(
      corrupt({
        records: [{ entity: "Unknown", instant: "2026-01-01T00:00:00Z" }],
        recordCount: 1,
      }),
    );
    expect(v.issues.some((i) => /records\[0\]\.entity/.test(i))).toBe(true);
  });

  it("records 원소 entity 가 비-string → entity issue", () => {
    const v = validateImportDumpStructure(
      corrupt({
        records: [{ entity: 7, instant: "2026-01-01T00:00:00Z" }],
        recordCount: 1,
      }),
    );
    expect(v.issues.some((i) => /records\[0\]\.entity/.test(i))).toBe(true);
  });

  it("records 원소 instant 누락 → instant 누락 issue", () => {
    const v = validateImportDumpStructure(
      corrupt({
        records: [{ entity: "Assessment" }],
        recordCount: 1,
      }),
    );
    expect(v.issues.some((i) => /records\[0\]\.instant/.test(i))).toBe(true);
  });
});

describe("validateImportDumpStructure — entityCounts (negative)", () => {
  it("entityCounts 비-object → issue", () => {
    const v = validateImportDumpStructure(corrupt({ entityCounts: null }));
    expect(v.issues.some((i) => /entityCounts 는 5 entity/.test(i))).toBe(true);
  });

  it("entityCounts 배열 → issue", () => {
    const v = validateImportDumpStructure(corrupt({ entityCounts: [] }));
    expect(v.issues.some((i) => /array/.test(i))).toBe(true);
  });

  it("entityCounts key 누락(AuditLog 빠짐) → 그 key issue", () => {
    const v = validateImportDumpStructure(
      corrupt({
        entityCounts: { Assessment: 1, Person: 0, Group: 0, LlmConfig: 0 },
      }),
    );
    expect(v.issues.some((i) => /entityCounts\.AuditLog/.test(i))).toBe(true);
  });

  it("entityCounts value 가 비-number → 그 key issue", () => {
    const v = validateImportDumpStructure(
      corrupt({
        entityCounts: {
          Assessment: "1",
          Person: 0,
          Group: 0,
          LlmConfig: 0,
          AuditLog: 0,
        },
        recordCount: 1,
      }),
    );
    expect(v.issues.some((i) => /entityCounts\.Assessment/.test(i))).toBe(true);
  });
});

describe("validateImportDumpStructure — 상호 정합 (negative)", () => {
  it("recordCount 비-number → issue", () => {
    const v = validateImportDumpStructure(corrupt({ recordCount: "1" }));
    expect(v.issues.some((i) => /recordCount 는 number/.test(i))).toBe(true);
  });

  it("recordCount !== records.length → 불일치 issue", () => {
    const v = validateImportDumpStructure(corrupt({ recordCount: 99 }));
    expect(v.issues.some((i) => /recordCount\(99\)/.test(i))).toBe(true);
  });

  it("entityCounts 합계 !== recordCount → 합계 불일치 issue", () => {
    // records 1개·recordCount 1 이지만 entityCounts 합계는 0 → 합계 불일치.
    const v = validateImportDumpStructure(
      corrupt({
        entityCounts: {
          Assessment: 0,
          Person: 0,
          Group: 0,
          LlmConfig: 0,
          AuditLog: 0,
        },
      }),
    );
    expect(v.issues.some((i) => /entityCounts 합계/.test(i))).toBe(true);
  });
});

describe("validateImportDumpStructure — 다중 위반 동시 누적 + flow", () => {
  it("여러 위반 동시 → issues 에 모두 누적(early-throw 아님)", () => {
    const v = validateImportDumpStructure({
      schemaVersion: "",
      generatedAt: "bad",
      records: "nope",
      entityCounts: {},
      recordCount: "x",
    });
    expect(v.valid).toBe(false);
    // schemaVersion + generatedAt + records + entityCounts keys + recordCount 등 다수.
    expect(v.issues.length).toBeGreaterThanOrEqual(4);
  });

  it("정상 dump 는 issues 가 정확히 빈 배열(모든 분기 통과)", () => {
    const v = validateImportDumpStructure(makeValidDump([]));
    expect(v.issues).toEqual([]);
  });
});

describe("validateImportDumpStructure — non-mutating (freeze 통과)", () => {
  it("Object.freeze 된 dump + records 입력으로 호출해도 통과하고 변형 0", () => {
    const records = [
      Object.freeze({
        entity: "Assessment" as const,
        instant: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const dump = Object.freeze({
      schemaVersion: "1",
      generatedAt: "2026-06-16T00:00:00.000Z",
      scope: Object.freeze({ scope: "full" }),
      entityCounts: Object.freeze({
        Assessment: 1,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      }),
      recordCount: 1,
      records: Object.freeze(records),
    });
    let v: ImportDumpValidation;
    expect(() => {
      v = validateImportDumpStructure(dump);
    }).not.toThrow();
    expect(v!.valid).toBe(true);
    expect(dump.recordCount).toBe(1);
  });
});
