// export-scope-description 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). 검증 통과한 ExportScope(full/range/partial)에서 describeExportScope 가 {headline,
// scopeKind, scopeLine, dateRangeLine?, entityLines[], readOnly} 설명 모델을 정확히 합성하는지
// (full 5 entity / range dateRangeLine ISO / partial 선택 entity 만) + 입력 방어 분기(비-object
// scope · scope.scope invalid · range dateRange 부재/역전/Invalid · partial entitySelector 부재/
// 빈 배열/허용 외 entity) 별 한국어 TypeError/RangeError + non-mutating(deepFreeze 통과)을
// 검증한다(import-restore-confirmation.spec.ts mirror).
import {
  describeExportScope,
  ExportScopeDescription,
} from "./export-scope-description";
import { ExportScope } from "./export-scope-select";

// 깊은 동결 헬퍼 — non-mutating regression 용(중첩 dateRange / entitySelector 배열까지 freeze).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
    Object.freeze(obj);
  }
  return obj;
}

describe("describeExportScope — happy path", () => {
  it("scope=full → 전체 entity·전 기간·dateRangeLine 부재·entityLines 5개·readOnly=true", () => {
    const desc: ExportScopeDescription = describeExportScope({ scope: "full" });

    expect(desc.scopeKind).toBe("full");
    expect(desc.headline).toContain("전체");
    expect(desc.scopeLine).toContain("전체 entity");
    expect(desc.dateRangeLine).toBeUndefined();
    expect(desc.entityLines).toHaveLength(5);
    expect(desc.entityLines).toContain("  - 평가 결과 (Assessment)");
    expect(desc.entityLines).toContain("  - Audit log (AuditLog)");
    expect(desc.readOnly).toBe(true);
  });

  it("scope=range → dateRangeLine 에 start/end ISO 포함·entityLines 5개 전체", () => {
    const desc = describeExportScope({
      scope: "range",
      dateRange: {
        start: new Date("2026-01-01T00:00:00Z"),
        end: new Date("2026-02-01T00:00:00Z"),
      },
    });

    expect(desc.scopeKind).toBe("range");
    expect(desc.headline).toContain("기간 한정");
    expect(desc.dateRangeLine).toBeDefined();
    expect(desc.dateRangeLine).toContain("2026-01-01T00:00:00.000Z");
    expect(desc.dateRangeLine).toContain("2026-02-01T00:00:00.000Z");
    expect(desc.dateRangeLine).toContain("반열림");
    // range 는 기간만 한정 — entity 는 5 종 전체.
    expect(desc.entityLines).toHaveLength(5);
    expect(desc.readOnly).toBe(true);
  });

  it("scope=partial → 선택 entity 만 entityLines·dateRangeLine 부재·readOnly=true", () => {
    const desc = describeExportScope({
      scope: "partial",
      entitySelector: ["Assessment", "Group"],
    });

    expect(desc.scopeKind).toBe("partial");
    expect(desc.headline).toContain("entity 한정");
    expect(desc.scopeLine).toContain("2 개 entity");
    expect(desc.dateRangeLine).toBeUndefined();
    expect(desc.entityLines).toEqual([
      "  - 평가 결과 (Assessment)",
      "  - Group (Group)",
    ]);
    expect(desc.entityLines.some((l) => l.includes("Person"))).toBe(false);
    expect(desc.readOnly).toBe(true);
  });
});

describe("describeExportScope — branch / flow cover", () => {
  it("full/range/partial 3 분기 headline 라벨 분기", () => {
    expect(describeExportScope({ scope: "full" }).headline).toContain("전체");
    expect(
      describeExportScope({
        scope: "range",
        dateRange: {
          start: new Date("2026-03-01T00:00:00Z"),
          end: new Date("2026-03-02T00:00:00Z"),
        },
      }).headline,
    ).toContain("기간 한정");
    expect(
      describeExportScope({ scope: "partial", entitySelector: ["Person"] })
        .headline,
    ).toContain("entity 한정");
  });

  it("partial entity 순서 — ENTITY_ORDER 순으로 정렬(입력 순서 무관·결정성)", () => {
    // 입력 순서는 AuditLog → Assessment 이지만 출력은 ENTITY_ORDER 순(Assessment → AuditLog).
    const desc = describeExportScope({
      scope: "partial",
      entitySelector: ["AuditLog", "Assessment"],
    });
    expect(desc.entityLines).toEqual([
      "  - 평가 결과 (Assessment)",
      "  - Audit log (AuditLog)",
    ]);
  });

  it("partial 중복 entity → 자연 dedup(1 회만 노출)", () => {
    const desc = describeExportScope({
      scope: "partial",
      entitySelector: ["Person", "Person", "Person"],
    });
    expect(desc.entityLines).toEqual(["  - 인원 master (Person)"]);
  });

  it("options.now 미지정 fallback → throw 0(정상 처리)", () => {
    expect(() => describeExportScope({ scope: "full" })).not.toThrow();
  });

  it("options.now 지정(유효 Date) → throw 0", () => {
    expect(() =>
      describeExportScope(
        { scope: "full" },
        { now: new Date("2026-06-17T00:00:00Z") },
      ),
    ).not.toThrow();
  });
});

describe("describeExportScope — error path / negative cases", () => {
  it("scope 부재(undefined) → TypeError(한국어)", () => {
    expect(() =>
      describeExportScope(undefined as unknown as ExportScope),
    ).toThrow(/scope 는 plain object 여야 합니다/);
  });

  it("scope null → TypeError(받음: null)", () => {
    expect(() => describeExportScope(null as unknown as ExportScope)).toThrow(
      /받음: null/,
    );
  });

  it("scope 배열 → TypeError(받음: array)", () => {
    expect(() => describeExportScope([] as unknown as ExportScope)).toThrow(
      /받음: array/,
    );
  });

  it("scope 비-object(string) → TypeError", () => {
    expect(() => describeExportScope("x" as unknown as ExportScope)).toThrow(
      /scope 는 plain object/,
    );
  });

  it("scope.scope 허용 외 값 → RangeError(한국어)", () => {
    expect(() =>
      describeExportScope({ scope: "all" } as unknown as ExportScope),
    ).toThrow(/scope 는 full\/range\/partial 중 하나/);
  });

  it("scope.scope 대문자 FULL → RangeError", () => {
    expect(() =>
      describeExportScope({ scope: "FULL" } as unknown as ExportScope),
    ).toThrow(/full\/range\/partial/);
  });

  it("scope.scope 숫자 → RangeError(받음: 1)", () => {
    expect(() =>
      describeExportScope({ scope: 1 } as unknown as ExportScope),
    ).toThrow(/받음: 1/);
  });

  it("range 인데 dateRange 부재 → RangeError", () => {
    expect(() => describeExportScope({ scope: "range" })).toThrow(
      /scope=range 에는 dateRange 가 필요합니다/,
    );
  });

  it("range dateRange.start 비-Date → TypeError", () => {
    expect(() =>
      describeExportScope({
        scope: "range",
        dateRange: {
          start: "2026-01-01" as unknown as Date,
          end: new Date("2026-02-01T00:00:00Z"),
        },
      }),
    ).toThrow(/dateRange\.start 은\(는\) 유효한 Date/);
  });

  it("range dateRange.end Invalid Date → TypeError", () => {
    expect(() =>
      describeExportScope({
        scope: "range",
        dateRange: {
          start: new Date("2026-01-01T00:00:00Z"),
          end: new Date("invalid"),
        },
      }),
    ).toThrow(/dateRange\.end 은\(는\) 유효한 Date/);
  });

  it("range start>=end(역전) → RangeError", () => {
    expect(() =>
      describeExportScope({
        scope: "range",
        dateRange: {
          start: new Date("2026-02-01T00:00:00Z"),
          end: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    ).toThrow(/start < end 인 반열림 구간/);
  });

  it("range start===end(빈 구간) → RangeError", () => {
    const t = new Date("2026-01-01T00:00:00Z");
    expect(() =>
      describeExportScope({
        scope: "range",
        dateRange: { start: t, end: new Date(t.getTime()) },
      }),
    ).toThrow(/start < end/);
  });

  it("partial 인데 entitySelector 부재 → RangeError", () => {
    expect(() => describeExportScope({ scope: "partial" })).toThrow(
      /scope=partial 에는 비어있지 않은 entitySelector/,
    );
  });

  it("partial entitySelector 빈 배열 → RangeError", () => {
    expect(() =>
      describeExportScope({ scope: "partial", entitySelector: [] }),
    ).toThrow(/비어있지 않은 entitySelector/);
  });

  it("partial entitySelector 비-배열(string) → RangeError", () => {
    expect(() =>
      describeExportScope({
        scope: "partial",
        entitySelector:
          "Assessment" as unknown as ExportScope["entitySelector"],
      }),
    ).toThrow(/비어있지 않은 entitySelector/);
  });

  it("partial 허용 외 entity 섞임 → RangeError(거부 정책)", () => {
    expect(() =>
      describeExportScope({
        scope: "partial",
        entitySelector: [
          "Assessment",
          "Unknown",
        ] as unknown as ExportScope["entitySelector"],
      }),
    ).toThrow(/허용 외 entity 가 있습니다.*받음: Unknown/);
  });

  it("options.now Invalid Date → TypeError", () => {
    expect(() =>
      describeExportScope({ scope: "full" }, { now: new Date("nope") }),
    ).toThrow(/options\.now 은\(는\) 유효한 Date/);
  });
});

describe("describeExportScope — non-mutating regression (deepFreeze 통과)", () => {
  it("deepFreeze 된 range scope 로 호출해도 throw 0 + 입력 불변", () => {
    const scope = deepFreeze({
      scope: "range" as const,
      dateRange: {
        start: new Date("2026-01-01T00:00:00Z"),
        end: new Date("2026-02-01T00:00:00Z"),
      },
    });
    const before = JSON.stringify(scope);

    let desc: ExportScopeDescription | undefined;
    expect(() => {
      desc = describeExportScope(scope);
    }).not.toThrow();

    // 입력 불변 단언.
    expect(JSON.stringify(scope)).toBe(before);
    // 반환은 새 객체/배열(입력과 별개).
    expect(Array.isArray(desc?.entityLines)).toBe(true);
    expect(desc?.dateRangeLine).toBeDefined();
    expect(desc?.readOnly).toBe(true);
  });

  it("deepFreeze 된 partial scope + entitySelector 배열로 호출해도 throw 0 + 불변", () => {
    const scope = deepFreeze({
      scope: "partial" as const,
      entitySelector: ["Assessment", "LlmConfig"] as ExportEntityList,
    });
    const before = JSON.stringify(scope);

    const desc = describeExportScope(scope);

    expect(JSON.stringify(scope)).toBe(before);
    expect(desc.entityLines).toEqual([
      "  - 평가 결과 (Assessment)",
      "  - LLM 설정 (LlmConfig)",
    ]);
  });
});

// 테스트 로컬 타입 별칭 — entitySelector 배열 리터럴의 타입 좁힘 보조.
type ExportEntityList = ExportScope["entitySelector"];
