// export-dump 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분 cover).
// schemaVersion default vs 명시 분기 + 빈 records vs 비어있지 않은 records 분기 + entityCounts
// 5 entity 집계 + generatedAt ISO 직렬화 + non-mutating + 예외 분기(meta/records/instant/entity)
// 를 검증한다(export-scope-select.spec.ts mirror).
import {
  buildExportDump,
  EXPORT_SCHEMA_VERSION,
  ExportDump,
  ExportDumpMeta,
} from "./export-dump";
import { ExportRecord, ExportScope } from "./export-scope-select";

const d = (iso: string) => new Date(iso);

// 분류 key 만 담은 record factory — entity + instant.
const rec = (entity: ExportRecord["entity"], iso: string): ExportRecord => ({
  entity,
  instant: d(iso),
});

const fullScope: ExportScope = { scope: "full" };
const generatedAt = d("2026-06-16T09:30:00.000Z");

const meta = (over: Partial<ExportDumpMeta> = {}): ExportDumpMeta => ({
  scope: fullScope,
  generatedAt,
  ...over,
});

describe("buildExportDump — happy path (정상 envelope 조립)", () => {
  it("schemaVersion 부재 시 EXPORT_SCHEMA_VERSION default 를 적용한다", () => {
    const dump = buildExportDump(
      [rec("Assessment", "2026-06-11T00:00:00Z")],
      meta(),
    );
    expect(dump.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(dump.schemaVersion).toBe("1");
  });

  it("명시 schemaVersion 이 주어지면 그대로 적용한다 (default 미적용)", () => {
    const dump = buildExportDump([], meta({ schemaVersion: "2" }));
    expect(dump.schemaVersion).toBe("2");
  });

  it("generatedAt 을 ISO string 으로 직렬화한다 (toISOString)", () => {
    const dump = buildExportDump([], meta());
    expect(dump.generatedAt).toBe("2026-06-16T09:30:00.000Z");
    expect(typeof dump.generatedAt).toBe("string");
  });

  it("scope 요약을 envelope 에 그대로 박제한다", () => {
    const scope: ExportScope = { scope: "partial", entitySelector: ["Person"] };
    const dump = buildExportDump([], meta({ scope }));
    expect(dump.scope).toEqual(scope);
  });

  it("records 순서를 보존하고 recordCount 를 정확히 산출한다", () => {
    const a = rec("Assessment", "2026-06-11T00:00:00Z");
    const p = rec("Person", "2026-06-12T00:00:00Z");
    const g = rec("Group", "2026-06-13T00:00:00Z");
    const dump = buildExportDump([a, p, g], meta());
    expect(dump.records).toEqual([a, p, g]);
    expect(dump.recordCount).toBe(3);
  });
});

describe("buildExportDump — entityCounts 집계 (flow / branch)", () => {
  it("5 entity 가 모두 섞인 records 의 count 를 각각 정확히 집계한다", () => {
    const records = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      rec("Assessment", "2026-06-11T01:00:00Z"),
      rec("Person", "2026-06-11T00:00:00Z"),
      rec("Group", "2026-06-11T00:00:00Z"),
      rec("LlmConfig", "2026-06-11T00:00:00Z"),
      rec("AuditLog", "2026-06-11T00:00:00Z"),
      rec("AuditLog", "2026-06-11T02:00:00Z"),
    ];
    const dump = buildExportDump(records, meta());
    expect(dump.entityCounts).toEqual({
      Assessment: 2,
      Person: 1,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 2,
    });
    expect(dump.recordCount).toBe(7);
  });

  it("한 entity 만 있는 records 는 그 entity 만 count, 나머지 4 entity 는 0", () => {
    const dump = buildExportDump(
      [
        rec("Group", "2026-06-11T00:00:00Z"),
        rec("Group", "2026-06-12T00:00:00Z"),
      ],
      meta(),
    );
    expect(dump.entityCounts).toEqual({
      Assessment: 0,
      Person: 0,
      Group: 2,
      LlmConfig: 0,
      AuditLog: 0,
    });
  });

  it("entityCounts 는 5 entity 전부 key 로 가진다 (누락 key 없음)", () => {
    const dump = buildExportDump([], meta());
    expect(Object.keys(dump.entityCounts).sort()).toEqual(
      ["Assessment", "AuditLog", "Group", "LlmConfig", "Person"].sort(),
    );
  });
});

describe("buildExportDump — 빈 records 분기 (negative: error 아님)", () => {
  it("빈 records 입력은 entityCounts 전부 0 + recordCount 0 + records [] (error 아님)", () => {
    const dump: ExportDump = buildExportDump([], meta());
    expect(dump.recordCount).toBe(0);
    expect(dump.records).toEqual([]);
    expect(dump.entityCounts).toEqual({
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    });
  });
});

describe("buildExportDump — non-mutating", () => {
  it("입력 records 배열의 순서/내용을 변형하지 않는다", () => {
    const input = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      rec("Person", "2026-06-12T00:00:00Z"),
    ];
    const snapshot = [...input];
    buildExportDump(input, meta());
    expect(input).toEqual(snapshot);
    expect(input).toHaveLength(2);
  });

  it("결과 records 는 입력과 별개 배열이라 반환 records mutate 가 입력에 영향 0", () => {
    const input = [rec("Group", "2026-06-13T00:00:00Z")];
    const dump = buildExportDump(input, meta());
    expect(dump.records).not.toBe(input);
    dump.records.push(rec("AuditLog", "2026-06-14T00:00:00Z"));
    expect(input).toHaveLength(1);
  });

  it("freeze 된 입력 records 로 호출해도 변형 없이 통과한다", () => {
    const frozen = Object.freeze([rec("Assessment", "2026-06-11T00:00:00Z")]);
    expect(() => buildExportDump(frozen, meta())).not.toThrow();
    const dump = buildExportDump(frozen, meta());
    expect(dump.recordCount).toBe(1);
  });
});

describe("buildExportDump — error path (TypeError: meta)", () => {
  it("meta 가 null 이면 TypeError", () => {
    expect(() =>
      buildExportDump([], null as unknown as ExportDumpMeta),
    ).toThrow(TypeError);
  });

  it("meta 가 undefined 면 TypeError", () => {
    expect(() =>
      buildExportDump([], undefined as unknown as ExportDumpMeta),
    ).toThrow(TypeError);
  });
});

describe("buildExportDump — error path (TypeError: records 비-배열)", () => {
  it("records 가 null 이면 TypeError", () => {
    expect(() =>
      buildExportDump(null as unknown as ExportRecord[], meta()),
    ).toThrow(TypeError);
  });

  it("records 가 객체면 TypeError", () => {
    expect(() =>
      buildExportDump({} as unknown as ExportRecord[], meta()),
    ).toThrow(TypeError);
  });
});

describe("buildExportDump — error path (TypeError: generatedAt)", () => {
  it("generatedAt 이 비-Date(문자열) 면 TypeError", () => {
    expect(() =>
      buildExportDump(
        [],
        meta({ generatedAt: "2026-06-16" as unknown as Date }),
      ),
    ).toThrow(TypeError);
  });

  it("generatedAt 이 Invalid Date 면 TypeError", () => {
    expect(() =>
      buildExportDump([], meta({ generatedAt: new Date("nope") })),
    ).toThrow(TypeError);
  });

  it("generatedAt 이 NaN timestamp(Invalid Date) 면 TypeError", () => {
    expect(() =>
      buildExportDump([], meta({ generatedAt: new Date(NaN) })),
    ).toThrow(TypeError);
  });
});

describe("buildExportDump — error path (TypeError: record.instant, index 포함)", () => {
  it("record.instant 가 Invalid Date 면 그 index 를 메시지에 담아 TypeError", () => {
    const arr = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      { entity: "Person", instant: new Date("nope") } as ExportRecord,
    ];
    expect(() => buildExportDump(arr, meta())).toThrow(/records\[1\]/);
    expect(() => buildExportDump(arr, meta())).toThrow(TypeError);
  });

  it("record.instant 가 비-Date(문자열) 면 TypeError", () => {
    const arr = [
      { entity: "Group", instant: "2026-06-11" as unknown as Date },
    ] as ExportRecord[];
    expect(() => buildExportDump(arr, meta())).toThrow(TypeError);
  });

  it("record.instant 가 Infinity timestamp(Invalid Date) 면 TypeError", () => {
    const arr = [
      { entity: "AuditLog", instant: new Date(Infinity) } as ExportRecord,
    ];
    expect(() => buildExportDump(arr, meta())).toThrow(TypeError);
  });
});

describe("buildExportDump — error path (RangeError: record.entity 허용 외, index 포함)", () => {
  it("record.entity 가 5 허용 값 외면 그 index 를 메시지에 담아 RangeError", () => {
    const arr = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      {
        entity: "Unknown",
        instant: d("2026-06-11T00:00:00Z"),
      } as unknown as ExportRecord,
    ];
    expect(() => buildExportDump(arr, meta())).toThrow(/records\[1\]/);
    expect(() => buildExportDump(arr, meta())).toThrow(RangeError);
  });

  it("record.entity 가 빈 문자열이면 RangeError", () => {
    const arr = [
      {
        entity: "",
        instant: d("2026-06-11T00:00:00Z"),
      } as unknown as ExportRecord,
    ];
    expect(() => buildExportDump(arr, meta())).toThrow(RangeError);
  });
});

describe("buildExportDump — negative cases 충분 cover (특이 instant)", () => {
  it("음수 timestamp instant(1970 이전) 는 정상 Date 로 집계된다 (error 아님)", () => {
    const dump = buildExportDump(
      [{ entity: "Person", instant: new Date(-1000) }],
      meta(),
    );
    expect(dump.recordCount).toBe(1);
    expect(dump.entityCounts.Person).toBe(1);
  });

  it("schemaVersion 빈 문자열은 명시 값으로 취급되어 default 미적용", () => {
    // 빈 문자열은 undefined 가 아니므로 ?? 분기에서 그대로 사용된다.
    const dump = buildExportDump([], meta({ schemaVersion: "" }));
    expect(dump.schemaVersion).toBe("");
  });
});
