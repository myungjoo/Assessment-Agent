// export-selection-summary 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). selectExportRecords(T-0437)가 산출한 정상 ExportSelection(full / range / partial / 빈)
// 에서 summarizeExportSelection 이 selected/excluded 각 그룹의 total + perEntity(5 key) +
// instantRange 를 정확 산출하는지 + 입력 방어 분기(비-object selection · 두 배열 각각 비-배열 ·
// record instant Invalid/비-Date)별 TypeError + 경계(단일 record 그룹 earliest===latest · 5
// entity 섞임 · 중복 entity 누적 · 허용 외 entity 무시 · 정렬 안 된 instant 의 정확한 min/max) +
// non-mutating(freeze 통과)을 검증한다(import-restore-preview.spec / import-restore-plan-summary.spec
// mirror). selectExportRecords 로 정방향 selection 을 만들어 요약이 selection 과 정합하는지
// round-trip 도 본다.
import {
  ExportRecord,
  ExportSelection,
  selectExportRecords,
} from "./export-scope-select";
import {
  summarizeExportSelection,
  ExportSelectionSummary,
} from "./export-selection-summary";

// 5 entity 전부 0 인 perEntity map 헬퍼 — 기대값 작성 보조.
function zeroMap() {
  return { Assessment: 0, Person: 0, Group: 0, LlmConfig: 0, AuditLog: 0 };
}

describe("summarizeExportSelection — happy path (selectExportRecords round-trip)", () => {
  it("full scope → selected 전부, excluded 빈(total 0 + perEntity 전부 0 + instantRange null)", () => {
    const records: ExportRecord[] = [
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") },
      { entity: "Assessment", instant: new Date("2026-03-01T00:00:00Z") },
    ];
    const selection = selectExportRecords({ scope: "full" }, records);
    const summary: ExportSelectionSummary = summarizeExportSelection(selection);

    expect(summary.selected.total).toBe(3);
    expect(summary.selected.perEntity).toEqual({
      ...zeroMap(),
      Assessment: 2,
      Person: 1,
    });
    expect(summary.selected.instantRange).toEqual({
      earliest: new Date("2026-01-01T00:00:00Z"),
      latest: new Date("2026-03-01T00:00:00Z"),
    });
    // full → excluded 빈 그룹.
    expect(summary.excluded.total).toBe(0);
    expect(summary.excluded.perEntity).toEqual(zeroMap());
    expect(summary.excluded.instantRange).toBeNull();
  });

  it("range scope → 두 그룹 모두 비어있지 않음, 각 정확 분배 + instantRange", () => {
    const records: ExportRecord[] = [
      { entity: "Assessment", instant: new Date("2026-01-10T00:00:00Z") }, // in range
      { entity: "Person", instant: new Date("2026-01-20T00:00:00Z") }, // in range
      { entity: "Group", instant: new Date("2026-03-01T00:00:00Z") }, // 제외
      { entity: "AuditLog", instant: new Date("2025-12-01T00:00:00Z") }, // 제외
    ];
    const selection = selectExportRecords(
      {
        scope: "range",
        dateRange: {
          start: new Date("2026-01-01T00:00:00Z"),
          end: new Date("2026-02-01T00:00:00Z"),
        },
      },
      records,
    );
    const summary = summarizeExportSelection(selection);

    expect(summary.selected.total).toBe(2);
    expect(summary.selected.perEntity).toEqual({
      ...zeroMap(),
      Assessment: 1,
      Person: 1,
    });
    expect(summary.selected.instantRange).toEqual({
      earliest: new Date("2026-01-10T00:00:00Z"),
      latest: new Date("2026-01-20T00:00:00Z"),
    });
    expect(summary.excluded.total).toBe(2);
    expect(summary.excluded.perEntity).toEqual({
      ...zeroMap(),
      Group: 1,
      AuditLog: 1,
    });
    expect(summary.excluded.instantRange).toEqual({
      earliest: new Date("2025-12-01T00:00:00Z"),
      latest: new Date("2026-03-01T00:00:00Z"),
    });
  });

  it("partial scope → entity 별 분배 정확", () => {
    const records: ExportRecord[] = [
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") },
      { entity: "Group", instant: new Date("2026-03-01T00:00:00Z") },
    ];
    const selection = selectExportRecords(
      { scope: "partial", entitySelector: ["Assessment", "Group"] },
      records,
    );
    const summary = summarizeExportSelection(selection);

    expect(summary.selected.total).toBe(2);
    expect(summary.selected.perEntity).toEqual({
      ...zeroMap(),
      Assessment: 1,
      Group: 1,
    });
    expect(summary.excluded.total).toBe(1);
    expect(summary.excluded.perEntity).toEqual({ ...zeroMap(), Person: 1 });
  });

  it("빈 selection(두 배열 모두 빈) → 두 그룹 total 0 + perEntity 전부 0 + instantRange null", () => {
    const selection = selectExportRecords({ scope: "full" }, []);
    const summary = summarizeExportSelection(selection);

    expect(summary.selected.total).toBe(0);
    expect(summary.selected.perEntity).toEqual(zeroMap());
    expect(summary.selected.instantRange).toBeNull();
    expect(summary.excluded.total).toBe(0);
    expect(summary.excluded.perEntity).toEqual(zeroMap());
    expect(summary.excluded.instantRange).toBeNull();
  });
});

describe("summarizeExportSelection — error path (입력 방어 TypeError)", () => {
  it("selection 이 null → TypeError", () => {
    expect(() =>
      summarizeExportSelection(null as unknown as ExportSelection),
    ).toThrow(TypeError);
    expect(() =>
      summarizeExportSelection(null as unknown as ExportSelection),
    ).toThrow(/plain object 여야 합니다.*null/);
  });

  it("selection 이 undefined → TypeError", () => {
    expect(() =>
      summarizeExportSelection(undefined as unknown as ExportSelection),
    ).toThrow(TypeError);
    expect(() =>
      summarizeExportSelection(undefined as unknown as ExportSelection),
    ).toThrow(/plain object 여야 합니다.*undefined/);
  });

  it("selection 이 배열 → TypeError(array 명시)", () => {
    expect(() =>
      summarizeExportSelection([] as unknown as ExportSelection),
    ).toThrow(/plain object 여야 합니다.*array/);
  });

  it("selection 이 비-object(number/string) → TypeError", () => {
    expect(() =>
      summarizeExportSelection(42 as unknown as ExportSelection),
    ).toThrow(/plain object 여야 합니다.*number/);
    expect(() =>
      summarizeExportSelection("x" as unknown as ExportSelection),
    ).toThrow(/plain object 여야 합니다.*string/);
  });

  it("selection.selected 가 배열 아님 → TypeError(selected 명시)", () => {
    const bad = {
      selected: "nope",
      excluded: [],
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(TypeError);
    expect(() => summarizeExportSelection(bad)).toThrow(
      /selection\.selected 는 배열이어야 합니다.*string/,
    );
  });

  it("selection.excluded 가 배열 아님 → TypeError(excluded 명시)", () => {
    const bad = {
      selected: [],
      excluded: { not: "array" },
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(TypeError);
    expect(() => summarizeExportSelection(bad)).toThrow(
      /selection\.excluded 는 배열이어야 합니다.*object/,
    );
  });

  it("record instant 가 비-Date(string) → 그 index 메시지 TypeError", () => {
    const bad = {
      selected: [{ entity: "Assessment", instant: "2026-01-01" }],
      excluded: [],
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(TypeError);
    expect(() => summarizeExportSelection(bad)).toThrow(
      /selected\[0\]\.instant.*유효한 Date/,
    );
  });

  it("record instant 가 number → TypeError", () => {
    const bad = {
      selected: [],
      excluded: [{ entity: "Person", instant: 1700000000000 }],
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(
      /excluded\[0\]\.instant.*유효한 Date/,
    );
  });

  it("record instant 가 Invalid Date → TypeError", () => {
    const bad = {
      selected: [{ entity: "Group", instant: new Date("not-a-date") }],
      excluded: [],
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(
      /selected\[0\]\.instant.*유효한 Date/,
    );
  });

  it("record instant 가 null → TypeError", () => {
    const bad = {
      selected: [],
      excluded: [{ entity: "AuditLog", instant: null }],
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(
      /excluded\[0\]\.instant.*유효한 Date/,
    );
  });
});

describe("summarizeExportSelection — flow / branch", () => {
  // 4 조합: (selected 빈/non-빈) × (excluded 빈/non-빈).
  it("두 그룹 모두 빈", () => {
    const summary = summarizeExportSelection({ selected: [], excluded: [] });
    expect(summary.selected.instantRange).toBeNull();
    expect(summary.excluded.instantRange).toBeNull();
  });

  it("selected 만 non-빈, excluded 빈", () => {
    const summary = summarizeExportSelection({
      selected: [
        { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
      ],
      excluded: [],
    });
    expect(summary.selected.total).toBe(1);
    expect(summary.selected.instantRange).not.toBeNull();
    expect(summary.excluded.total).toBe(0);
    expect(summary.excluded.instantRange).toBeNull();
  });

  it("selected 빈, excluded 만 non-빈", () => {
    const summary = summarizeExportSelection({
      selected: [],
      excluded: [
        { entity: "Group", instant: new Date("2026-01-01T00:00:00Z") },
      ],
    });
    expect(summary.selected.total).toBe(0);
    expect(summary.selected.instantRange).toBeNull();
    expect(summary.excluded.total).toBe(1);
    expect(summary.excluded.instantRange).not.toBeNull();
  });

  it("두 그룹 모두 non-빈", () => {
    const summary = summarizeExportSelection({
      selected: [
        { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
      ],
      excluded: [
        { entity: "Group", instant: new Date("2026-02-01T00:00:00Z") },
      ],
    });
    expect(summary.selected.total).toBe(1);
    expect(summary.excluded.total).toBe(1);
  });

  it("5 entity 가 섞인 record 집합 → perEntity 정확 분배", () => {
    const selected: ExportRecord[] = [
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-02T00:00:00Z") },
      { entity: "Group", instant: new Date("2026-01-03T00:00:00Z") },
      { entity: "LlmConfig", instant: new Date("2026-01-04T00:00:00Z") },
      { entity: "AuditLog", instant: new Date("2026-01-05T00:00:00Z") },
    ];
    const summary = summarizeExportSelection({ selected, excluded: [] });
    expect(summary.selected.perEntity).toEqual({
      Assessment: 1,
      Person: 1,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 1,
    });
    expect(summary.selected.total).toBe(5);
  });

  it("허용 외 entity → perEntity 무시(누락 0, throw 안 함)", () => {
    const selected = [
      { entity: "Mystery", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Assessment", instant: new Date("2026-01-02T00:00:00Z") },
    ] as unknown as ExportRecord[];
    const summary = summarizeExportSelection({ selected, excluded: [] });
    // total 은 row 수 그대로(2), perEntity 는 Assessment 만 +1, Mystery 는 무시.
    expect(summary.selected.total).toBe(2);
    expect(summary.selected.perEntity).toEqual({ ...zeroMap(), Assessment: 1 });
    // instantRange 는 entity 무관하게 두 instant 기준.
    expect(summary.selected.instantRange).toEqual({
      earliest: new Date("2026-01-01T00:00:00Z"),
      latest: new Date("2026-01-02T00:00:00Z"),
    });
  });

  it("단일 record 그룹 → instantRange earliest === latest 경계", () => {
    const only = new Date("2026-05-05T12:00:00Z");
    const summary = summarizeExportSelection({
      selected: [{ entity: "Assessment", instant: only }],
      excluded: [],
    });
    expect(summary.selected.instantRange).not.toBeNull();
    expect(summary.selected.instantRange!.earliest).toEqual(only);
    expect(summary.selected.instantRange!.latest).toEqual(only);
    expect(summary.selected.instantRange!.earliest.getTime()).toBe(
      summary.selected.instantRange!.latest.getTime(),
    );
  });

  it("정렬되지 않은 instant 배열 → 정확한 min/max 추출", () => {
    const summary = summarizeExportSelection({
      selected: [
        { entity: "Person", instant: new Date("2026-03-01T00:00:00Z") },
        { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") }, // min
        { entity: "Person", instant: new Date("2026-05-01T00:00:00Z") }, // max
        { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") },
      ],
      excluded: [],
    });
    expect(summary.selected.instantRange).toEqual({
      earliest: new Date("2026-01-01T00:00:00Z"),
      latest: new Date("2026-05-01T00:00:00Z"),
    });
  });
});

describe("summarizeExportSelection — negative / 경계 보강", () => {
  it("중복 entity 누적 → perEntity 정확 합산", () => {
    const selected: ExportRecord[] = [
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Assessment", instant: new Date("2026-01-02T00:00:00Z") },
      { entity: "Assessment", instant: new Date("2026-01-03T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-04T00:00:00Z") },
    ];
    const summary = summarizeExportSelection({ selected, excluded: [] });
    expect(summary.selected.perEntity).toEqual({
      ...zeroMap(),
      Assessment: 3,
      Person: 1,
    });
    expect(summary.selected.total).toBe(4);
  });

  it("동일 instant earliest/latest → range 가 그 instant", () => {
    const same = new Date("2026-04-04T00:00:00Z");
    const summary = summarizeExportSelection({
      selected: [
        { entity: "Group", instant: same },
        { entity: "Person", instant: same },
      ],
      excluded: [],
    });
    expect(summary.selected.instantRange).toEqual({
      earliest: same,
      latest: same,
    });
  });

  it("5 entity 전부 섞인 대량 record → total + perEntity 정확", () => {
    const entities: ExportRecord["entity"][] = [
      "Assessment",
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
    ];
    const selected: ExportRecord[] = [];
    for (let i = 0; i < 250; i += 1) {
      selected.push({
        entity: entities[i % 5],
        instant: new Date(2026, 0, 1 + (i % 28)),
      });
    }
    const summary = summarizeExportSelection({ selected, excluded: [] });
    expect(summary.selected.total).toBe(250);
    expect(summary.selected.perEntity).toEqual({
      Assessment: 50,
      Person: 50,
      Group: 50,
      LlmConfig: 50,
      AuditLog: 50,
    });
  });

  it("non-mutating — freeze 된 selection/배열/record 로 호출해도 통과, 입력 변형 0", () => {
    const recA = Object.freeze({
      entity: "Assessment" as const,
      instant: new Date("2026-01-01T00:00:00Z"),
    });
    const recB = Object.freeze({
      entity: "Person" as const,
      instant: new Date("2026-02-01T00:00:00Z"),
    });
    const selected = Object.freeze([recA]) as unknown as ExportRecord[];
    const excluded = Object.freeze([recB]) as unknown as ExportRecord[];
    const selection = Object.freeze({ selected, excluded }) as ExportSelection;

    const summary = summarizeExportSelection(selection);
    expect(summary.selected.total).toBe(1);
    expect(summary.excluded.total).toBe(1);

    // 입력 배열 길이/원소 불변.
    expect(selection.selected).toHaveLength(1);
    expect(selection.excluded).toHaveLength(1);
    // 반환 instantRange 의 Date 는 원본 참조 그대로 담겨도 무방하나, 원본을 변형하지 않음.
    expect(summary.selected.instantRange!.earliest).toEqual(
      new Date("2026-01-01T00:00:00Z"),
    );
    // 반환 perEntity 는 새 객체(입력과 독립).
    summary.selected.perEntity.Assessment = 999;
    expect(summary.selected.total).toBe(1);
  });

  it("instant 가 NaN-Date(new Date(NaN)) → TypeError", () => {
    const bad = {
      selected: [{ entity: "Person", instant: new Date(NaN) }],
      excluded: [],
    } as unknown as ExportSelection;
    expect(() => summarizeExportSelection(bad)).toThrow(
      /selected\[0\]\.instant.*유효한 Date/,
    );
  });
});
