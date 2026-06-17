// export-import-audit-message 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). buildExportImportAuditEntry(T-0443)가 산출한 ExportImportAuditEntry 에서
// formatAuditLogLine 이 {headline, detailLines[], operation} 사람-친화 audit 로그 메시지 모델을
// 정확히 합성하는지(export vs import 분기 / scope full·range·partial / entityCounts 0 vs >0 /
// import source 지정 vs 부재) + 입력 방어 분기(비-object entry · operation invalid · actorId
// 비-string · rowCount 비-정수 · detail 부재 · export scope/entityCounts 부재 · import mode/count
// 부재·비-정수)별 한국어 TypeError/RangeError + non-mutating(deepFreeze 통과)을 검증한다
// (import-restore-confirmation.spec.ts mirror).
import {
  ExportImportAuditEntry,
  ExportAuditDetail,
  ImportAuditDetail,
} from "./export-import-audit";
import {
  AuditLogMessage,
  formatAuditLogLine,
} from "./export-import-audit-message";

// 5 entity 전부 0 인 entityCounts map 헬퍼 — 기대값 작성 보조.
function zeroCounts() {
  return { Assessment: 0, Person: 0, Group: 0, LlmConfig: 0, AuditLog: 0 };
}

// 정상 export audit entry 생성 헬퍼 — detail / 상위 필드 override 를 받아 합성.
function makeExportEntry(
  over?: Partial<ExportImportAuditEntry> & {
    detail?: Partial<ExportAuditDetail>;
  },
): ExportImportAuditEntry {
  const detail: ExportAuditDetail = {
    scope: { scope: "full" },
    entityCounts: zeroCounts(),
    ...over?.detail,
  };
  return {
    operation: "export",
    actorId: "admin@example.com",
    actorRole: "Admin",
    occurredAt: "2026-06-17T09:00:00.000Z",
    rowCount: 1234,
    ...over,
    detail,
  };
}

// 정상 import audit entry 생성 헬퍼.
function makeImportEntry(
  over?: Partial<ExportImportAuditEntry> & {
    detail?: Partial<ImportAuditDetail>;
  },
): ExportImportAuditEntry {
  const detail: ImportAuditDetail = {
    mode: "replace",
    deleted: 3,
    inserted: 5,
    kept: 0,
    source: "backup-2026-06-17.json",
    ...over?.detail,
  };
  return {
    operation: "import",
    actorId: "root@example.com",
    actorRole: "SuperAdmin",
    occurredAt: "2026-06-17T10:30:00.000Z",
    rowCount: 5,
    ...over,
    detail,
  };
}

// 깊은 동결 헬퍼 — non-mutating regression 용(중첩 detail / entityCounts / dateRange 까지 freeze).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
    Object.freeze(obj);
  }
  return obj;
}

describe("formatAuditLogLine — happy path", () => {
  it("export entry(scope=full, entityCounts 일부 0) → headline 에 actor·rowCount·export 표기 + detailLines 에 scope·0 아닌 entity 라인", () => {
    const entry = makeExportEntry({
      rowCount: 1234,
      detail: {
        scope: { scope: "full" },
        entityCounts: { ...zeroCounts(), Assessment: 1000, Person: 234 },
      },
    });
    const msg: AuditLogMessage = formatAuditLogLine(entry);

    expect(msg.operation).toBe("export");
    expect(msg.headline).toContain("내보내기(export)");
    expect(msg.headline).toContain("admin@example.com");
    expect(msg.headline).toContain("Admin");
    expect(msg.headline).toContain("1234");
    expect(msg.headline).toContain("2026-06-17T09:00:00.000Z");

    expect(msg.detailLines[0]).toContain("scope:");
    expect(msg.detailLines[0]).toContain("전체(full)");
    // 0 아닌 entity 만 라인으로 — Assessment / Person 포함, 0 인 Group 등 제외.
    expect(msg.detailLines.some((l) => l.includes("Assessment: 1000"))).toBe(
      true,
    );
    expect(msg.detailLines.some((l) => l.includes("Person: 234"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("Group"))).toBe(false);
  });

  it("import entry(mode=replace, source 지정) → headline 에 import 표기 + detailLines 에 mode·삭제/삽입/보존·출처 라인", () => {
    const entry = makeImportEntry({
      detail: {
        mode: "replace",
        deleted: 3,
        inserted: 5,
        kept: 2,
        source: "backup-2026-06-17.json",
      },
    });
    const msg = formatAuditLogLine(entry);

    expect(msg.operation).toBe("import");
    expect(msg.headline).toContain("가져오기(import)");
    expect(msg.headline).toContain("root@example.com");
    expect(msg.headline).toContain("SuperAdmin");

    expect(msg.detailLines.some((l) => l.includes("전체 교체(replace)"))).toBe(
      true,
    );
    expect(
      msg.detailLines.some(
        (l) =>
          l.includes("삭제 3") && l.includes("삽입 5") && l.includes("보존 2"),
      ),
    ).toBe(true);
    expect(
      msg.detailLines.some((l) => l.includes("backup-2026-06-17.json")),
    ).toBe(true);
  });
});

describe("formatAuditLogLine — branch / flow cover", () => {
  it("export scope=range(dateRange 포함) → scope 라인에 start/end ISO 포함", () => {
    const entry = makeExportEntry({
      detail: {
        scope: {
          scope: "range",
          dateRange: {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-06-01T00:00:00.000Z"),
          },
        },
        entityCounts: zeroCounts(),
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines[0]).toContain("기간(range)");
    expect(msg.detailLines[0]).toContain("2026-01-01T00:00:00.000Z");
    expect(msg.detailLines[0]).toContain("2026-06-01T00:00:00.000Z");
  });

  it("export scope=partial(entitySelector 포함) → scope 라인에 entity 목록 포함", () => {
    const entry = makeExportEntry({
      detail: {
        scope: { scope: "partial", entitySelector: ["Assessment", "Group"] },
        entityCounts: zeroCounts(),
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines[0]).toContain("부분(partial)");
    expect(msg.detailLines[0]).toContain("Assessment");
    expect(msg.detailLines[0]).toContain("Group");
  });

  it("export entityCounts 전부 0 → detailLines 는 scope 라인만(entity 라인 0)", () => {
    const entry = makeExportEntry({
      detail: { scope: { scope: "full" }, entityCounts: zeroCounts() },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines).toHaveLength(1);
    expect(msg.detailLines[0]).toContain("scope:");
  });

  it("import source=null → 출처 미지정 라인", () => {
    const entry = makeImportEntry({
      detail: {
        mode: "merge",
        deleted: 0,
        inserted: 4,
        kept: 7,
        source: null,
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines.some((l) => l.includes("병합(merge)"))).toBe(true);
    expect(msg.detailLines.some((l) => l.includes("(파일 출처 미지정)"))).toBe(
      true,
    );
  });

  it("import source=빈 문자열 → null 과 동일하게 미지정 라인(구분)", () => {
    const entry = makeImportEntry({
      detail: {
        mode: "merge",
        deleted: 0,
        inserted: 1,
        kept: 0,
        source: "",
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines.some((l) => l.includes("(파일 출처 미지정)"))).toBe(
      true,
    );
  });

  it("export scope kind 가 라벨 맵 외 값 → raw kind 그대로 노출(fallback)", () => {
    const entry = makeExportEntry({
      detail: {
        // 정상 흐름엔 없으나 fallback 분기(?? scopeKind) cover.
        scope: { scope: "weird" as never },
        entityCounts: zeroCounts(),
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines[0]).toContain("weird");
  });

  it("export dateRange.start 가 Invalid Date → dateRange 요약 생략(scope 라인만 kind)", () => {
    const entry = makeExportEntry({
      detail: {
        scope: {
          scope: "range",
          dateRange: {
            start: new Date("invalid"),
            end: new Date("2026-06-01T00:00:00.000Z"),
          },
        },
        entityCounts: zeroCounts(),
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines[0]).not.toContain("~");
  });

  it("export entitySelector 빈 배열 → entity 목록 생략", () => {
    const entry = makeExportEntry({
      detail: {
        scope: { scope: "partial", entitySelector: [] },
        entityCounts: zeroCounts(),
      },
    });
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines[0]).not.toContain("대상:");
  });
});

describe("formatAuditLogLine — error path / negative cases 충분 cover", () => {
  it("entry=null → TypeError(한국어)", () => {
    expect(() => formatAuditLogLine(null as never)).toThrow(TypeError);
    expect(() => formatAuditLogLine(null as never)).toThrow(/plain object/);
  });

  it("entry=undefined → TypeError", () => {
    expect(() => formatAuditLogLine(undefined as never)).toThrow(TypeError);
  });

  it("entry=배열 → TypeError(plain object)", () => {
    expect(() => formatAuditLogLine([] as never)).toThrow(/plain object/);
  });

  it("entry=숫자(비-object) → TypeError", () => {
    expect(() => formatAuditLogLine(42 as never)).toThrow(TypeError);
  });

  it("operation 부재 → RangeError(export/import)", () => {
    const entry = makeExportEntry();
    delete (entry as unknown as Record<string, unknown>).operation;
    expect(() => formatAuditLogLine(entry)).toThrow(RangeError);
    expect(() => formatAuditLogLine(entry)).toThrow(/export\/import/);
  });

  it("operation 빈 문자열 → RangeError", () => {
    const entry = makeExportEntry({ operation: "" as never });
    expect(() => formatAuditLogLine(entry)).toThrow(RangeError);
  });

  it("operation 대문자 EXPORT → RangeError(case-sensitive)", () => {
    const entry = makeExportEntry({ operation: "EXPORT" as never });
    expect(() => formatAuditLogLine(entry)).toThrow(RangeError);
  });

  it("operation 숫자 → RangeError", () => {
    const entry = makeExportEntry({ operation: 1 as never });
    expect(() => formatAuditLogLine(entry)).toThrow(RangeError);
  });

  it("actorId 비-string(number) → TypeError", () => {
    const entry = makeExportEntry({ actorId: 123 as never });
    expect(() => formatAuditLogLine(entry)).toThrow(TypeError);
    expect(() => formatAuditLogLine(entry)).toThrow(/actorId/);
  });

  it("actorId 부재 → TypeError", () => {
    const entry = makeExportEntry();
    delete (entry as unknown as Record<string, unknown>).actorId;
    expect(() => formatAuditLogLine(entry)).toThrow(/actorId/);
  });

  it("rowCount 음수 → TypeError", () => {
    const entry = makeExportEntry({ rowCount: -1 });
    expect(() => formatAuditLogLine(entry)).toThrow(/rowCount/);
  });

  it("rowCount 소수 → TypeError", () => {
    const entry = makeExportEntry({ rowCount: 1.5 });
    expect(() => formatAuditLogLine(entry)).toThrow(TypeError);
  });

  it("rowCount NaN → TypeError", () => {
    const entry = makeExportEntry({ rowCount: NaN });
    expect(() => formatAuditLogLine(entry)).toThrow(/rowCount/);
  });

  it("rowCount 비-number(string) → TypeError", () => {
    const entry = makeExportEntry({ rowCount: "1234" as never });
    expect(() => formatAuditLogLine(entry)).toThrow(TypeError);
  });

  it("detail 부재 → TypeError(export detail)", () => {
    const entry = makeExportEntry();
    delete (entry as unknown as Record<string, unknown>).detail;
    expect(() => formatAuditLogLine(entry)).toThrow(/detail/);
  });

  it("detail 비-object(string) → TypeError", () => {
    const entry = makeExportEntry();
    (entry as unknown as Record<string, unknown>).detail = "nope";
    expect(() => formatAuditLogLine(entry)).toThrow(/detail/);
  });

  it("export detail 에 scope 부재 → TypeError", () => {
    const entry = makeExportEntry();
    (entry.detail as unknown as Record<string, unknown>).scope = undefined;
    expect(() => formatAuditLogLine(entry)).toThrow(/scope/);
  });

  it("export detail 의 scope 가 비-object → TypeError", () => {
    const entry = makeExportEntry();
    (entry.detail as unknown as Record<string, unknown>).scope = "full";
    expect(() => formatAuditLogLine(entry)).toThrow(/scope/);
  });

  it("export detail 에 entityCounts 부재 → TypeError", () => {
    const entry = makeExportEntry();
    (entry.detail as unknown as Record<string, unknown>).entityCounts =
      undefined;
    expect(() => formatAuditLogLine(entry)).toThrow(/entityCounts/);
  });

  it("import detail.mode 부재 → TypeError(replace/merge)", () => {
    const entry = makeImportEntry();
    (entry.detail as unknown as Record<string, unknown>).mode = undefined;
    expect(() => formatAuditLogLine(entry)).toThrow(/replace\/merge/);
  });

  it("import detail.mode 허용 외(대문자) → TypeError", () => {
    const entry = makeImportEntry();
    (entry.detail as unknown as Record<string, unknown>).mode = "REPLACE";
    expect(() => formatAuditLogLine(entry)).toThrow(TypeError);
  });

  it("import detail.deleted 비-정수(소수) → TypeError", () => {
    const entry = makeImportEntry();
    (entry.detail as unknown as Record<string, unknown>).deleted = 1.5;
    expect(() => formatAuditLogLine(entry)).toThrow(/deleted/);
  });

  it("import detail.inserted 부재 → TypeError", () => {
    const entry = makeImportEntry();
    delete (entry.detail as unknown as Record<string, unknown>).inserted;
    expect(() => formatAuditLogLine(entry)).toThrow(/inserted/);
  });

  it("import detail.kept 음수 → TypeError", () => {
    const entry = makeImportEntry();
    (entry.detail as unknown as Record<string, unknown>).kept = -2;
    expect(() => formatAuditLogLine(entry)).toThrow(/kept/);
  });

  it("import detail.deleted 비-number(string) → TypeError", () => {
    const entry = makeImportEntry();
    (entry.detail as unknown as Record<string, unknown>).deleted = "3";
    expect(() => formatAuditLogLine(entry)).toThrow(/deleted/);
  });

  it("import detail 비-object → TypeError", () => {
    const entry = makeImportEntry();
    (entry as unknown as Record<string, unknown>).detail = null;
    expect(() => formatAuditLogLine(entry)).toThrow(/detail/);
  });
});

describe("formatAuditLogLine — non-mutating regression", () => {
  it("deepFreeze 된 export entry 로 호출해도 throw 0 + 입력 불변", () => {
    const entry = deepFreeze(
      makeExportEntry({
        detail: {
          scope: { scope: "full" },
          entityCounts: { ...zeroCounts(), Assessment: 10 },
        },
      }),
    );
    const before = JSON.stringify(entry);
    expect(() => formatAuditLogLine(entry)).not.toThrow();
    const msg = formatAuditLogLine(entry);
    expect(msg.detailLines.length).toBeGreaterThan(0);
    expect(JSON.stringify(entry)).toBe(before);
  });

  it("deepFreeze 된 import entry 로 호출해도 throw 0 + 입력 불변", () => {
    const entry = deepFreeze(makeImportEntry());
    const before = JSON.stringify(entry);
    expect(() => formatAuditLogLine(entry)).not.toThrow();
    expect(JSON.stringify(entry)).toBe(before);
  });
});
