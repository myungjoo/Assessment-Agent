// export-result 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분 cover).
// summarizeExportSelection(T-0449)이 산출한 ExportSelectionSummary + ExportScope(T-0437)에서
// buildExportResult 가 {headline, exportedCounts, impactLines[], scopeLine} Export 완료 결과
// 모델을 정확히 합성하는지(다운로드 완료 headline / selected count / exportedCounts 일치 / 0
// 아닌 perEntity 라인 / excluded.total>0 제외 라인 / full scope 제외 라인 생략 / scope full vs
// range vs partial scopeLine 분기 / 빈 export 경계) + 입력 방어 분기(비-object summary ·
// selected/excluded 부재·비-object · total 비-정수 · perEntity 부재·비-object · scope 부재 ·
// scope.scope invalid)별 한국어 TypeError/RangeError + non-mutating(deepFreeze 통과)을 검증한다
// (import-restore-result.spec.ts mirror).
import { buildExportResult, ExportResult } from "./export-result";
import { ExportScope } from "./export-scope-select";
import { ExportSelectionSummary } from "./export-selection-summary";

// 5 entity 전부 0 인 perEntity map 헬퍼 — 기대값 작성 보조.
function zeroMap() {
  return { Assessment: 0, Person: 0, Group: 0, LlmConfig: 0, AuditLog: 0 };
}

// 정상 ExportSelectionSummary 생성 헬퍼 — 그룹별 total + perEntity + instantRange override.
function makeSummary(over?: {
  selected?: Partial<ExportSelectionSummary["selected"]>;
  excluded?: Partial<ExportSelectionSummary["excluded"]>;
}): ExportSelectionSummary {
  return {
    selected: {
      total: 0,
      perEntity: zeroMap(),
      instantRange: null,
      ...over?.selected,
    },
    excluded: {
      total: 0,
      perEntity: zeroMap(),
      instantRange: null,
      ...over?.excluded,
    },
  };
}

// 깊은 동결 헬퍼 — non-mutating regression 용(중첩 perEntity map / entitySelector 배열까지 freeze).
function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      deepFreeze((obj as Record<string, unknown>)[key]);
    }
    Object.freeze(obj);
  }
  return obj;
}

describe("buildExportResult — happy path", () => {
  it("scope=full(selected>0, excluded=0) → headline 에 다운로드 완료·count, exportedCounts 일치, 0 아닌 entity 라인, scopeLine 에 full(전체), 제외 라인 생략", () => {
    const summary = makeSummary({
      selected: {
        total: 5,
        perEntity: { ...zeroMap(), Assessment: 3, Person: 2 },
      },
    });
    const scope: ExportScope = { scope: "full" };
    const result: ExportResult = buildExportResult(summary, scope);

    expect(result.headline).toContain("다운로드 완료");
    expect(result.headline).toContain("선별 5 row");

    expect(result.exportedCounts).toEqual({ selected: 5, excluded: 0 });

    // impactLines — 0 아닌 entity 만(Assessment/Person).
    expect(result.impactLines).toContain("선별 5 row");
    expect(result.impactLines).toContain("  - Assessment: 3 row export");
    expect(result.impactLines).toContain("  - Person: 2 row export");
    // full scope + excluded.total=0 → 제외 라인 생략.
    expect(result.impactLines.some((l) => l.startsWith("제외"))).toBe(false);

    expect(result.scopeLine).toContain("full(전체)");
  });

  it("scope=range(selected/excluded 분배) → scopeLine 에 dateRange 요약 + 제외 라인 포함", () => {
    const summary = makeSummary({
      selected: { total: 4, perEntity: { ...zeroMap(), Group: 4 } },
      excluded: { total: 2, perEntity: { ...zeroMap(), AuditLog: 2 } },
    });
    const scope: ExportScope = {
      scope: "range",
      dateRange: {
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-03-31T00:00:00.000Z"),
      },
    };
    const result = buildExportResult(summary, scope);

    expect(result.exportedCounts).toEqual({ selected: 4, excluded: 2 });
    expect(result.impactLines).toContain("선별 4 row");
    expect(result.impactLines).toContain("  - Group: 4 row export");
    // excluded.total>0 → 제외 라인 포함.
    expect(result.impactLines).toContain("제외 2 row");
    expect(result.scopeLine).toContain("range(기간)");
    expect(result.scopeLine).toContain("2026-01-01T00:00:00.000Z");
    expect(result.scopeLine).toContain("2026-03-31T00:00:00.000Z");
  });

  it("scope=partial → scopeLine 에 entitySelector 요약 포함", () => {
    const summary = makeSummary({
      selected: {
        total: 3,
        perEntity: { ...zeroMap(), Assessment: 1, LlmConfig: 2 },
      },
    });
    const scope: ExportScope = {
      scope: "partial",
      entitySelector: ["Assessment", "LlmConfig"],
    };
    const result = buildExportResult(summary, scope);

    expect(result.scopeLine).toContain("partial(부분)");
    expect(result.scopeLine).toContain("Assessment");
    expect(result.scopeLine).toContain("LlmConfig");
    expect(result.impactLines).toContain("  - LlmConfig: 2 row export");
  });
});

describe("buildExportResult — branch / flow cover", () => {
  it("scope full vs range vs partial → scopeLine 머리 라벨 분기", () => {
    const summary = makeSummary({
      selected: { total: 1, perEntity: { ...zeroMap(), Person: 1 } },
    });
    expect(buildExportResult(summary, { scope: "full" }).scopeLine).toContain(
      "full(전체)",
    );
    expect(
      buildExportResult(summary, {
        scope: "range",
        dateRange: {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-02-01T00:00:00.000Z"),
        },
      }).scopeLine,
    ).toContain("range(기간)");
    expect(
      buildExportResult(summary, {
        scope: "partial",
        entitySelector: ["Person"],
      }).scopeLine,
    ).toContain("partial(부분)");
  });

  it("excluded.total 0 vs >0 → 제외 라인 포함 분기", () => {
    // excluded.total=0 → 제외 라인 생략.
    const noExcluded = makeSummary({
      selected: { total: 2, perEntity: { ...zeroMap(), Assessment: 2 } },
    });
    const r0 = buildExportResult(noExcluded, { scope: "full" });
    expect(r0.impactLines.some((l) => l.startsWith("제외"))).toBe(false);

    // excluded.total>0 → 제외 라인 포함.
    const withExcluded = makeSummary({
      selected: { total: 2, perEntity: { ...zeroMap(), Assessment: 2 } },
      excluded: { total: 7, perEntity: { ...zeroMap(), Person: 7 } },
    });
    const r1 = buildExportResult(withExcluded, {
      scope: "range",
      dateRange: {
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-02-01T00:00:00.000Z"),
      },
    });
    expect(r1.impactLines).toContain("제외 7 row");
  });

  it("entity count 0 vs >0 → 0 entity 는 라인 생략", () => {
    const summary = makeSummary({
      selected: {
        total: 5,
        perEntity: { ...zeroMap(), Assessment: 5, Group: 0 },
      },
    });
    const result = buildExportResult(summary, { scope: "full" });
    expect(result.impactLines).toContain("  - Assessment: 5 row export");
    expect(result.impactLines.some((l) => l.includes("Group"))).toBe(false);
  });

  it("entity count 비-정수(소수) → 라인 생략(total 만 노출)", () => {
    const summary = makeSummary({
      selected: {
        total: 3,
        perEntity: { ...zeroMap(), Assessment: 1.5 as unknown as number },
      },
    });
    const result = buildExportResult(summary, { scope: "full" });
    expect(result.impactLines).toContain("선별 3 row");
    expect(result.impactLines.filter((l) => l.startsWith("  - "))).toEqual([]);
  });

  it("빈 export(selected/excluded 모두 0) → throw 0, total 0 라인만, 제외 라인 생략", () => {
    const summary = makeSummary({});
    const result = buildExportResult(summary, { scope: "full" });
    expect(result.exportedCounts).toEqual({ selected: 0, excluded: 0 });
    expect(result.impactLines).toEqual(["선별 0 row"]);
    expect(result.scopeLine).toContain("full(전체)");
  });

  it("range scope + dateRange 부재 → scopeLine 에 기간 미지정(throw 0 — select 검증은 §Out of Scope)", () => {
    const summary = makeSummary({
      selected: { total: 1, perEntity: { ...zeroMap(), Person: 1 } },
    });
    const result = buildExportResult(summary, {
      scope: "range",
    } as ExportScope);
    expect(result.scopeLine).toContain("range(기간)");
    expect(result.scopeLine).toContain("기간 미지정");
  });

  it("range scope + dateRange.start Invalid Date → 기간 미지정(관대 처리)", () => {
    const summary = makeSummary({
      selected: { total: 1, perEntity: { ...zeroMap(), Person: 1 } },
    });
    const result = buildExportResult(summary, {
      scope: "range",
      dateRange: {
        start: new Date("not-a-date"),
        end: new Date("2026-02-01T00:00:00.000Z"),
      },
    });
    expect(result.scopeLine).toContain("기간 미지정");
  });

  it("partial scope + entitySelector 부재/빈 배열 → 대상 미지정(throw 0)", () => {
    const summary = makeSummary({
      selected: { total: 1, perEntity: { ...zeroMap(), Person: 1 } },
    });
    const noSelector = buildExportResult(summary, {
      scope: "partial",
    } as ExportScope);
    expect(noSelector.scopeLine).toContain("대상 미지정");

    const emptySelector = buildExportResult(summary, {
      scope: "partial",
      entitySelector: [],
    });
    expect(emptySelector.scopeLine).toContain("대상 미지정");
  });
});

describe("buildExportResult — error path / negative cases", () => {
  const validScope: ExportScope = { scope: "full" };

  it("summary 부재(undefined) → TypeError(한국어)", () => {
    expect(() =>
      buildExportResult(
        undefined as unknown as ExportSelectionSummary,
        validScope,
      ),
    ).toThrow(/summary 는 plain object 여야 합니다/);
  });

  it("summary null → TypeError(받음: null)", () => {
    expect(() =>
      buildExportResult(null as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/받음: null/);
  });

  it("summary 배열 → TypeError(받음: array)", () => {
    expect(() =>
      buildExportResult([] as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/받음: array/);
  });

  it("summary 비-object(number) → TypeError", () => {
    expect(() =>
      buildExportResult(5 as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/summary 는 plain object/);
  });

  it("summary.selected 부재 → TypeError(selected)", () => {
    const bad = { excluded: { total: 0, perEntity: zeroMap() } };
    expect(() =>
      buildExportResult(bad as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/summary\.selected 은\(는\) object 여야 합니다/);
  });

  it("summary.excluded 비-object(null) → TypeError(excluded, 받음: null)", () => {
    const bad = {
      selected: { total: 0, perEntity: zeroMap() },
      excluded: null,
    };
    expect(() =>
      buildExportResult(bad as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/summary\.excluded 은\(는\) object .*받음: null/);
  });

  it("selected.total 비-정수(소수) → TypeError", () => {
    const bad = makeSummary({ selected: { total: 1.5, perEntity: zeroMap() } });
    expect(() => buildExportResult(bad, validScope)).toThrow(
      /summary\.selected\.total 은\(는\) 0 이상 정수/,
    );
  });

  it("selected.total 음수 → TypeError", () => {
    const bad = makeSummary({ selected: { total: -2, perEntity: zeroMap() } });
    expect(() => buildExportResult(bad, validScope)).toThrow(
      /summary\.selected\.total/,
    );
  });

  it("excluded.total NaN → TypeError", () => {
    const bad = makeSummary({ excluded: { total: NaN, perEntity: zeroMap() } });
    expect(() => buildExportResult(bad, validScope)).toThrow(
      /summary\.excluded\.total/,
    );
  });

  it("selected.total 비-number(string) → TypeError", () => {
    const bad = makeSummary({
      selected: { total: "3" as unknown as number, perEntity: zeroMap() },
    });
    expect(() => buildExportResult(bad, validScope)).toThrow(
      /summary\.selected\.total/,
    );
  });

  it("perEntity 부재 → TypeError(perEntity)", () => {
    const bad = {
      selected: { total: 1 },
      excluded: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildExportResult(bad as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/summary\.selected\.perEntity 은\(는\) object 여야 합니다/);
  });

  it("perEntity 비-object(null) → TypeError(받음: null)", () => {
    const bad = {
      selected: { total: 2, perEntity: null },
      excluded: { total: 0, perEntity: zeroMap() },
    };
    expect(() =>
      buildExportResult(bad as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/summary\.selected\.perEntity .*받음: null/);
  });

  it("perEntity 배열 → TypeError(받음: array)", () => {
    const bad = {
      selected: { total: 0, perEntity: zeroMap() },
      excluded: { total: 1, perEntity: [] },
    };
    expect(() =>
      buildExportResult(bad as unknown as ExportSelectionSummary, validScope),
    ).toThrow(/summary\.excluded\.perEntity .*받음: array/);
  });

  it("scope 부재(undefined) → TypeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, undefined as unknown as ExportScope),
    ).toThrow(/scope 는 plain object 여야 합니다/);
  });

  it("scope null → TypeError(받음: null)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, null as unknown as ExportScope),
    ).toThrow(/scope 는 plain object .*받음: null/);
  });

  it("scope 배열 → TypeError(받음: array)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, [] as unknown as ExportScope),
    ).toThrow(/scope 는 plain object .*받음: array/);
  });

  it("scope.scope 빈 문자열 → RangeError(한국어)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, { scope: "" } as unknown as ExportScope),
    ).toThrow(RangeError);
    expect(() =>
      buildExportResult(summary, { scope: "" } as unknown as ExportScope),
    ).toThrow(/scope\.scope 는 full\/range\/partial 중 하나/);
  });

  it("scope.scope 대문자 FULL → RangeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, { scope: "FULL" } as unknown as ExportScope),
    ).toThrow(/scope\.scope 는 full\/range\/partial/);
  });

  it("scope.scope 숫자 → RangeError(받음: 1)", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, { scope: 1 } as unknown as ExportScope),
    ).toThrow(/받음: 1/);
  });

  it("scope.scope null → RangeError", () => {
    const summary = makeSummary({});
    expect(() =>
      buildExportResult(summary, { scope: null } as unknown as ExportScope),
    ).toThrow(/scope\.scope 는 full\/range\/partial/);
  });

  it("error 우선순위: summary 검증이 scope 검증보다 먼저 (둘 다 invalid 면 summary TypeError)", () => {
    expect(() =>
      buildExportResult(
        null as unknown as ExportSelectionSummary,
        { scope: "BAD" } as unknown as ExportScope,
      ),
    ).toThrow(/summary 는 plain object/);
  });
});

describe("buildExportResult — non-mutating regression (deepFreeze 통과)", () => {
  it("deepFreeze 된 summary + scope(entitySelector 배열 포함)로 호출해도 throw 0 + 입력 불변", () => {
    const summary = deepFreeze(
      makeSummary({
        selected: {
          total: 3,
          perEntity: { ...zeroMap(), Assessment: 2, Person: 1 },
          instantRange: {
            earliest: new Date("2026-01-01T00:00:00.000Z"),
            latest: new Date("2026-02-01T00:00:00.000Z"),
          },
        },
        excluded: {
          total: 1,
          perEntity: { ...zeroMap(), Group: 1 },
          instantRange: null,
        },
      }),
    );
    const scope = deepFreeze<ExportScope>({
      scope: "partial",
      entitySelector: ["Assessment", "Person"],
    });
    const before = JSON.stringify(summary);
    const scopeBefore = JSON.stringify(scope);

    let result: ExportResult | undefined;
    expect(() => {
      result = buildExportResult(summary, scope);
    }).not.toThrow();

    // 입력 불변 단언.
    expect(JSON.stringify(summary)).toBe(before);
    expect(JSON.stringify(scope)).toBe(scopeBefore);
    // 반환은 새 객체/배열(입력과 별개).
    expect(Array.isArray(result?.impactLines)).toBe(true);
    expect(result?.exportedCounts).toEqual({ selected: 3, excluded: 1 });
    expect(result?.impactLines).toContain("  - Assessment: 2 row export");
    expect(result?.impactLines).toContain("제외 1 row");
    expect(result?.scopeLine).toContain("partial(부분)");
  });
});
