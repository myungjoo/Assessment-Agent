// export-full-dump 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분 cover).
// buildExportDump.spec 패턴 mirror + full-record `fields` 보존 검증 추가:
//   - schemaVersion default vs 명시 분기
//   - 빈 records vs 비어있지 않은 records 분기
//   - 단일 entity vs 다수 entity 혼합 분기
//   - entityCounts 5 entity 집계 + generatedAt ISO 직렬화
//   - `fields` 손실 없는 보존(빈 객체 / 멀티바이트 한글 값 포함)
//   - non-mutating(입력 배열 / 원소 / fields freeze 후 호출 포함)
//   - 예외 분기(meta / records / generatedAt / instant / entity) 각 1+ (index 포함 단언).
import { ExportDumpMeta } from "./export-dump";
import { buildFullExportDump, FullExportDump } from "./export-full-dump";
import { FullExportRecord } from "./export-full-record";
import { ExportEntity, ExportScope } from "./export-scope-select";

const d = (iso: string) => new Date(iso);

// full-record factory — entity + instant + fields.
const rec = (
  entity: ExportEntity,
  iso: string,
  fields: Record<string, unknown> = {},
): FullExportRecord => ({
  entity,
  instant: d(iso),
  fields,
});

const fullScope: ExportScope = { scope: "full" };
const generatedAt = d("2026-06-16T09:30:00.000Z");

const meta = (over: Partial<ExportDumpMeta> = {}): ExportDumpMeta => ({
  scope: fullScope,
  generatedAt,
  ...over,
});

describe("buildFullExportDump — happy path (정상 envelope 조립)", () => {
  it("schemaVersion 부재 시 EXPORT_SCHEMA_VERSION default('1') 를 적용한다", () => {
    const dump = buildFullExportDump(
      [rec("Assessment", "2026-06-11T00:00:00Z", { id: "a1" })],
      meta(),
    );
    expect(dump.schemaVersion).toBe("1");
  });

  it("명시 schemaVersion 이 주어지면 그대로 적용한다 (default 미적용)", () => {
    const dump = buildFullExportDump([], meta({ schemaVersion: "2" }));
    expect(dump.schemaVersion).toBe("2");
  });

  it("generatedAt 을 ISO string 으로 직렬화한다 (toISOString)", () => {
    const dump = buildFullExportDump([], meta());
    expect(dump.generatedAt).toBe("2026-06-16T09:30:00.000Z");
    expect(typeof dump.generatedAt).toBe("string");
  });

  it("scope 요약을 envelope 에 그대로 박제한다", () => {
    const scope: ExportScope = { scope: "partial", entitySelector: ["Person"] };
    const dump = buildFullExportDump([], meta({ scope }));
    expect(dump.scope).toEqual(scope);
  });

  it("records 순서를 보존하고 recordCount 를 정확히 산출한다", () => {
    const a = rec("Assessment", "2026-06-11T00:00:00Z", { id: "a1" });
    const p = rec("Person", "2026-06-12T00:00:00Z", { id: "p1" });
    const g = rec("Group", "2026-06-13T00:00:00Z", { id: "g1" });
    const dump = buildFullExportDump([a, p, g], meta());
    expect(dump.records).toEqual([a, p, g]);
    expect(dump.recordCount).toBe(3);
  });
});

describe("buildFullExportDump — fields 보존 (full-record 본문 직렬화)", () => {
  it("입력 record 의 fields 가 출력 records[i].fields 에 손실 없이 담긴다", () => {
    const fields = { id: "p1", fullName: "홍길동", email: "hong@example.com" };
    const dump = buildFullExportDump(
      [rec("Person", "2026-06-12T00:00:00Z", fields)],
      meta(),
    );
    expect(dump.records[0].fields).toEqual(fields);
  });

  it("fields 가 빈 객체인 record 도 그대로 보존한다 (경계값)", () => {
    const dump = buildFullExportDump(
      [rec("Group", "2026-06-13T00:00:00Z", {})],
      meta(),
    );
    expect(dump.records[0].fields).toEqual({});
  });

  it("멀티바이트 한글 fields 값을 손실 없이 보존한다", () => {
    const fields = { fullName: "김철수", note: "평가 대상자 비고 — 한글 본문" };
    const dump = buildFullExportDump(
      [rec("Person", "2026-06-12T00:00:00Z", fields)],
      meta(),
    );
    expect(dump.records[0].fields.fullName).toBe("김철수");
    expect(dump.records[0].fields.note).toBe("평가 대상자 비고 — 한글 본문");
  });

  it("여러 record 의 fields 가 각각 독립적으로 보존된다 (혼합)", () => {
    const f1 = { id: "a1", state: "DONE" };
    const f2 = { id: "p1", email: "a@b.c" };
    const dump = buildFullExportDump(
      [
        rec("Assessment", "2026-06-11T00:00:00Z", f1),
        rec("Person", "2026-06-12T00:00:00Z", f2),
      ],
      meta(),
    );
    expect(dump.records[0].fields).toEqual(f1);
    expect(dump.records[1].fields).toEqual(f2);
  });
});

describe("buildFullExportDump — entityCounts 집계 (flow / branch)", () => {
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
    const dump = buildFullExportDump(records, meta());
    expect(dump.entityCounts).toEqual({
      Assessment: 2,
      Person: 1,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 2,
    });
    expect(dump.recordCount).toBe(7);
  });

  it("한 entity 만 있는 records 는 그 entity 만 count, 나머지 4 entity 는 0 (단일 entity 분기)", () => {
    const dump = buildFullExportDump(
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
    const dump = buildFullExportDump([], meta());
    expect(Object.keys(dump.entityCounts).sort()).toEqual(
      ["Assessment", "AuditLog", "Group", "LlmConfig", "Person"].sort(),
    );
  });
});

describe("buildFullExportDump — 빈 records 분기 (negative: error 아님)", () => {
  it("빈 records 입력은 entityCounts 전부 0 + recordCount 0 + records [] (error 아님)", () => {
    const dump: FullExportDump = buildFullExportDump([], meta());
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

describe("buildFullExportDump — non-mutating", () => {
  it("입력 records 배열의 순서/내용을 변형하지 않는다", () => {
    const input = [
      rec("Assessment", "2026-06-11T00:00:00Z", { id: "a1" }),
      rec("Person", "2026-06-12T00:00:00Z", { id: "p1" }),
    ];
    const snapshot = [...input];
    buildFullExportDump(input, meta());
    expect(input).toEqual(snapshot);
    expect(input).toHaveLength(2);
  });

  it("결과 records 는 입력과 별개 배열이라 반환 records mutate 가 입력에 영향 0", () => {
    const input = [rec("Group", "2026-06-13T00:00:00Z")];
    const dump = buildFullExportDump(input, meta());
    expect(dump.records).not.toBe(input);
    dump.records.push(rec("AuditLog", "2026-06-14T00:00:00Z"));
    expect(input).toHaveLength(1);
  });

  it("freeze 된 입력 records 배열로 호출해도 변형 없이 통과한다", () => {
    const frozen = Object.freeze([
      rec("Assessment", "2026-06-11T00:00:00Z", { id: "a1" }),
    ]);
    expect(() => buildFullExportDump(frozen, meta())).not.toThrow();
    const dump = buildFullExportDump(frozen, meta());
    expect(dump.recordCount).toBe(1);
  });

  it("freeze 된 원소·fields 로 호출해도 통과하고 fields 가 보존된다", () => {
    const fields = Object.freeze({ id: "p1", fullName: "홍길동" });
    const record = Object.freeze({
      entity: "Person" as ExportEntity,
      instant: d("2026-06-12T00:00:00Z"),
      fields,
    });
    const frozen = Object.freeze([record]);
    expect(() => buildFullExportDump(frozen, meta())).not.toThrow();
    const dump = buildFullExportDump(frozen, meta());
    expect(dump.records[0].fields).toEqual({ id: "p1", fullName: "홍길동" });
  });
});

describe("buildFullExportDump — error path (TypeError: meta)", () => {
  it("meta 가 null 이면 TypeError", () => {
    expect(() =>
      buildFullExportDump([], null as unknown as ExportDumpMeta),
    ).toThrow(TypeError);
  });

  it("meta 가 undefined 면 TypeError", () => {
    expect(() =>
      buildFullExportDump([], undefined as unknown as ExportDumpMeta),
    ).toThrow(TypeError);
  });
});

describe("buildFullExportDump — error path (TypeError: records 비-배열)", () => {
  it("records 가 null 이면 TypeError", () => {
    expect(() =>
      buildFullExportDump(null as unknown as FullExportRecord[], meta()),
    ).toThrow(TypeError);
  });

  it("records 가 객체면 TypeError", () => {
    expect(() =>
      buildFullExportDump({} as unknown as FullExportRecord[], meta()),
    ).toThrow(TypeError);
  });
});

describe("buildFullExportDump — error path (TypeError: generatedAt)", () => {
  it("generatedAt 이 비-Date(문자열) 면 TypeError", () => {
    expect(() =>
      buildFullExportDump(
        [],
        meta({ generatedAt: "2026-06-16" as unknown as Date }),
      ),
    ).toThrow(TypeError);
  });

  it("generatedAt 이 Invalid Date 면 TypeError", () => {
    expect(() =>
      buildFullExportDump([], meta({ generatedAt: new Date("nope") })),
    ).toThrow(TypeError);
  });

  it("generatedAt 이 NaN timestamp(Invalid Date) 면 TypeError", () => {
    expect(() =>
      buildFullExportDump([], meta({ generatedAt: new Date(NaN) })),
    ).toThrow(TypeError);
  });
});

describe("buildFullExportDump — error path (TypeError: record.instant, index 포함)", () => {
  it("record.instant 가 Invalid Date 면 그 index 를 메시지에 담아 TypeError", () => {
    const arr = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      {
        entity: "Person",
        instant: new Date("nope"),
        fields: {},
      } as FullExportRecord,
    ];
    expect(() => buildFullExportDump(arr, meta())).toThrow(/records\[1\]/);
    expect(() => buildFullExportDump(arr, meta())).toThrow(TypeError);
  });

  it("record.instant 가 비-Date(문자열) 면 TypeError", () => {
    const arr = [
      {
        entity: "Group",
        instant: "2026-06-11" as unknown as Date,
        fields: {},
      },
    ] as FullExportRecord[];
    expect(() => buildFullExportDump(arr, meta())).toThrow(TypeError);
  });

  it("record.instant 가 Infinity timestamp(Invalid Date) 면 TypeError", () => {
    const arr = [
      {
        entity: "AuditLog",
        instant: new Date(Infinity),
        fields: {},
      } as FullExportRecord,
    ];
    expect(() => buildFullExportDump(arr, meta())).toThrow(TypeError);
  });
});

describe("buildFullExportDump — error path (RangeError: record.entity 허용 외, index 포함)", () => {
  it("record.entity 가 5 허용 값 외면 그 index 를 메시지에 담아 RangeError", () => {
    const arr = [
      rec("Assessment", "2026-06-11T00:00:00Z"),
      {
        entity: "Unknown",
        instant: d("2026-06-11T00:00:00Z"),
        fields: {},
      } as unknown as FullExportRecord,
    ];
    expect(() => buildFullExportDump(arr, meta())).toThrow(/records\[1\]/);
    expect(() => buildFullExportDump(arr, meta())).toThrow(RangeError);
  });

  it("record.entity 가 빈 문자열이면 RangeError", () => {
    const arr = [
      {
        entity: "",
        instant: d("2026-06-11T00:00:00Z"),
        fields: {},
      } as unknown as FullExportRecord,
    ];
    expect(() => buildFullExportDump(arr, meta())).toThrow(RangeError);
  });
});

describe("buildFullExportDump — negative cases 충분 cover (특이 instant / schemaVersion)", () => {
  it("음수 timestamp instant(1970 이전) 는 정상 Date 로 집계된다 (error 아님)", () => {
    const dump = buildFullExportDump(
      [{ entity: "Person", instant: new Date(-1000), fields: {} }],
      meta(),
    );
    expect(dump.recordCount).toBe(1);
    expect(dump.entityCounts.Person).toBe(1);
  });

  it("schemaVersion 빈 문자열은 명시 값으로 취급되어 default 미적용", () => {
    // 빈 문자열은 undefined 가 아니므로 ?? 분기에서 그대로 사용된다.
    const dump = buildFullExportDump([], meta({ schemaVersion: "" }));
    expect(dump.schemaVersion).toBe("");
  });
});
