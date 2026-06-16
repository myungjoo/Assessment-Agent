// export-import-audit 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). buildExportImportAuditEntry 가 export 분기(dump.recordCount + scope/entityCounts 박제)
// 와 import 분기(plan.toInsert.length + mode/deleted/inserted/kept + source ?? null)를 UC-07
// §8 (b)(e) 정합대로 조립하는지 + 입력 방어 분기(input 부재 · operation 허용 외 · actor 부재/등급
// 외 · occurredAt 비-Date/Invalid · sub-payload 부재/mismatch)별 error + 경계(빈 dump/plan →
// rowCount 0 · source 빈 문자열 vs undefined · recordCount 와 entityCounts 합 불일치 시
// dump.recordCount 우선) + non-mutating(freeze 통과 + 원본 배열/속성 불변)을 검증한다
// (import-restore-plan.spec.ts mirror).
import { ExportDump } from "./export-dump";
import {
  buildExportImportAuditEntry,
  ExportImportAuditInput,
  ExportImportAuditEntry,
  ExportAuditDetail,
  ImportAuditDetail,
} from "./export-import-audit";
import { ExportScope, ExportRecord } from "./export-scope-select";
import { ImportRestorePlan } from "./import-restore-plan";

// 간단한 record 생성 헬퍼 — entity + ISO instant.
function rec(entity: ExportRecord["entity"], iso: string): ExportRecord {
  return { entity, instant: new Date(iso) };
}

// 정상 ExportDump fixture — full scope, 3 record(Assessment 2 + Person 1).
function makeDump(): ExportDump {
  const scope: ExportScope = { scope: "full" };
  return {
    schemaVersion: "1",
    generatedAt: "2026-06-16T00:00:00.000Z",
    scope,
    entityCounts: {
      Assessment: 2,
      Person: 1,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
    },
    recordCount: 3,
    records: [
      rec("Assessment", "2026-01-01T00:00:00Z"),
      rec("Assessment", "2026-01-02T00:00:00Z"),
      rec("Person", "2026-01-03T00:00:00Z"),
    ],
  };
}

// 정상 ImportRestorePlan fixture — toDelete 2 / toInsert 3 / toKeep 1.
function makePlan(): ImportRestorePlan {
  return {
    toDelete: [
      rec("Assessment", "2026-01-01T00:00:00Z"),
      rec("Person", "2026-01-02T00:00:00Z"),
    ],
    toInsert: [
      rec("Assessment", "2026-02-01T00:00:00Z"),
      rec("Group", "2026-02-02T00:00:00Z"),
      rec("AuditLog", "2026-02-03T00:00:00Z"),
    ],
    toKeep: [rec("LlmConfig", "2026-01-05T00:00:00Z")],
  };
}

describe("buildExportImportAuditEntry — export 분기 (happy / branch)", () => {
  it("정상 ExportDump + Admin actor → operation export + rowCount = recordCount + detail 박제 + ISO occurredAt", () => {
    const dump = makeDump();
    const input: ExportImportAuditInput = {
      operation: "export",
      actor: { id: "admin-1", role: "Admin" },
      occurredAt: new Date("2026-06-16T12:30:00Z"),
      export: { scope: dump.scope, dump },
    };
    const entry: ExportImportAuditEntry = buildExportImportAuditEntry(input);
    expect(entry.operation).toBe("export");
    expect(entry.actorId).toBe("admin-1");
    expect(entry.actorRole).toBe("Admin");
    expect(entry.occurredAt).toBe("2026-06-16T12:30:00.000Z");
    expect(entry.rowCount).toBe(3);
    const detail = entry.detail as ExportAuditDetail;
    expect(detail.scope).toEqual({ scope: "full" });
    expect(detail.entityCounts).toEqual(dump.entityCounts);
  });

  it("partial scope 박제 — detail.scope 가 입력 scope 그대로", () => {
    const dump = makeDump();
    const scope: ExportScope = {
      scope: "partial",
      entitySelector: ["Assessment", "Person"],
    };
    const entry = buildExportImportAuditEntry({
      operation: "export",
      actor: { id: "sa-1", role: "SuperAdmin" },
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      export: { scope, dump },
    });
    expect(entry.actorRole).toBe("SuperAdmin");
    expect((entry.detail as ExportAuditDetail).scope).toEqual(scope);
  });

  it("빈 dump 경계 — recordCount 0 → rowCount 0", () => {
    const scope: ExportScope = { scope: "full" };
    const dump: ExportDump = {
      schemaVersion: "1",
      generatedAt: "2026-06-16T00:00:00.000Z",
      scope,
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
    const entry = buildExportImportAuditEntry({
      operation: "export",
      actor: { id: "a", role: "Admin" },
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      export: { scope, dump },
    });
    expect(entry.rowCount).toBe(0);
  });

  it("recordCount 와 entityCounts 합 불일치 시 dump.recordCount 우선(ground truth)", () => {
    const dump = makeDump();
    // entityCounts 합은 3 이지만 recordCount 를 7 로 조작 → rowCount 는 recordCount(7) 우선.
    dump.recordCount = 7;
    const entry = buildExportImportAuditEntry({
      operation: "export",
      actor: { id: "a", role: "Admin" },
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      export: { scope: dump.scope, dump },
    });
    expect(entry.rowCount).toBe(7);
  });
});

describe("buildExportImportAuditEntry — import 분기 (happy / branch)", () => {
  it("replace mode + SuperAdmin → operation import + rowCount = toInsert.length + detail count 정확 + source 박제", () => {
    const plan = makePlan();
    const entry = buildExportImportAuditEntry({
      operation: "import",
      actor: { id: "sa-2", role: "SuperAdmin" },
      occurredAt: new Date("2026-06-16T09:00:00Z"),
      import: { mode: "replace", plan, source: "dump-2026.json" },
    });
    expect(entry.operation).toBe("import");
    expect(entry.actorRole).toBe("SuperAdmin");
    expect(entry.rowCount).toBe(3);
    const detail = entry.detail as ImportAuditDetail;
    expect(detail.mode).toBe("replace");
    expect(detail.deleted).toBe(2);
    expect(detail.inserted).toBe(3);
    expect(detail.kept).toBe(1);
    expect(detail.source).toBe("dump-2026.json");
  });

  it("merge mode + source 부재 → detail.source null", () => {
    const plan = makePlan();
    const entry = buildExportImportAuditEntry({
      operation: "import",
      actor: { id: "admin-3", role: "Admin" },
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      import: { mode: "merge", plan },
    });
    const detail = entry.detail as ImportAuditDetail;
    expect(detail.mode).toBe("merge");
    expect(detail.source).toBeNull();
  });

  it("source 빈 문자열 vs undefined 구분 — 빈 문자열은 그대로 보존", () => {
    const plan = makePlan();
    const entry = buildExportImportAuditEntry({
      operation: "import",
      actor: { id: "a", role: "Admin" },
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      import: { mode: "merge", plan, source: "" },
    });
    expect((entry.detail as ImportAuditDetail).source).toBe("");
  });

  it("빈 plan 경계 — toInsert [] → rowCount 0 + deleted/kept 0", () => {
    const plan: ImportRestorePlan = { toDelete: [], toInsert: [], toKeep: [] };
    const entry = buildExportImportAuditEntry({
      operation: "import",
      actor: { id: "a", role: "Admin" },
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      import: { mode: "replace", plan },
    });
    expect(entry.rowCount).toBe(0);
    const detail = entry.detail as ImportAuditDetail;
    expect(detail.deleted).toBe(0);
    expect(detail.kept).toBe(0);
  });
});

describe("buildExportImportAuditEntry — error path / negative cases", () => {
  it("input 부재(null) → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry(null as unknown as ExportImportAuditInput),
    ).toThrow(TypeError);
  });

  it("input 부재(undefined) → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry(
        undefined as unknown as ExportImportAuditInput,
      ),
    ).toThrow(TypeError);
  });

  it("operation 대소문자 mismatch(Export) → RangeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "Export" as unknown as "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(RangeError);
  });

  it("operation null → RangeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: null as unknown as "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
      }),
    ).toThrow(RangeError);
  });

  it("operation 숫자 → RangeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: 1 as unknown as "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
      }),
    ).toThrow(RangeError);
  });

  it("actor 부재 → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: undefined as unknown as { id: string; role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(TypeError);
  });

  it("actor.id 비-string → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: 123 as unknown as string, role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(TypeError);
  });

  it("actor.role 빈 문자열 → RangeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "" as unknown as "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(RangeError);
  });

  it("actor.role 잘못된 등급(User) → RangeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "User" as unknown as "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(RangeError);
  });

  it("occurredAt 비-Date → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: "2026-06-16" as unknown as Date,
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(TypeError);
  });

  it("occurredAt Invalid Date(NaN) → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("invalid"),
        export: { scope: { scope: "full" }, dump: makeDump() },
      }),
    ).toThrow(TypeError);
  });

  it("operation=export 인데 export sub-payload 부재 → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
      }),
    ).toThrow(TypeError);
  });

  it("operation=export 인데 dump 부재 → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        export: { scope: { scope: "full" } } as unknown as {
          scope: ExportScope;
          dump: ExportDump;
        },
      }),
    ).toThrow(TypeError);
  });

  it("mismatched sub-payload — operation=export 인데 import payload 만 제공 → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "export",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        import: { mode: "replace", plan: makePlan() },
      }),
    ).toThrow(TypeError);
  });

  it("operation=import 인데 import sub-payload 부재 → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "import",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
      }),
    ).toThrow(TypeError);
  });

  it("operation=import 인데 plan 부재 → TypeError", () => {
    expect(() =>
      buildExportImportAuditEntry({
        operation: "import",
        actor: { id: "a", role: "Admin" },
        occurredAt: new Date("2026-06-16T00:00:00Z"),
        import: { mode: "merge" } as unknown as {
          mode: "merge";
          plan: ImportRestorePlan;
        },
      }),
    ).toThrow(TypeError);
  });
});

describe("buildExportImportAuditEntry — non-mutating", () => {
  it("freeze 된 export input + 중첩 dump 통과 + 원본 불변", () => {
    const dump = makeDump();
    Object.freeze(dump);
    Object.freeze(dump.entityCounts);
    Object.freeze(dump.records);
    const scope: ExportScope = Object.freeze({ scope: "full" });
    const input = Object.freeze({
      operation: "export" as const,
      actor: Object.freeze({ id: "a", role: "Admin" as const }),
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      export: Object.freeze({ scope, dump }),
    });
    const before = { ...dump.entityCounts };
    const entry = buildExportImportAuditEntry(input);
    // 결과 entityCounts 는 새 객체(원본 공유 0).
    const detail = entry.detail as ExportAuditDetail;
    expect(detail.entityCounts).not.toBe(dump.entityCounts);
    expect(detail.entityCounts).toEqual(before);
    // 원본 dump 불변.
    expect(dump.entityCounts).toEqual(before);
    expect(dump.recordCount).toBe(3);
  });

  it("freeze 된 import input + 중첩 plan 통과 + 원본 배열 length 불변", () => {
    const plan = makePlan();
    Object.freeze(plan);
    Object.freeze(plan.toDelete);
    Object.freeze(plan.toInsert);
    Object.freeze(plan.toKeep);
    const input = Object.freeze({
      operation: "import" as const,
      actor: Object.freeze({ id: "a", role: "SuperAdmin" as const }),
      occurredAt: new Date("2026-06-16T00:00:00Z"),
      import: Object.freeze({
        mode: "merge" as const,
        plan,
        source: "f.json",
      }),
    });
    const entry = buildExportImportAuditEntry(input);
    expect(entry.rowCount).toBe(3);
    // 원본 plan 배열 length 불변.
    expect(plan.toDelete).toHaveLength(2);
    expect(plan.toInsert).toHaveLength(3);
    expect(plan.toKeep).toHaveLength(1);
  });
});
