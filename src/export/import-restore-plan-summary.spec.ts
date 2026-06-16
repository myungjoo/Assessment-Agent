// import-restore-plan-summary 순수 helper spec — R-112 4 종(happy / error / branch / negative
// 충분 cover). buildImportRestorePlan(T-0442)이 만든 정상 plan(replace / merge / 빈 plan)에서
// summarizeRestorePlan 이 deleted/inserted/kept 각 그룹의 total + perEntity(5 key)를 정확
// 산출하는지 + 입력 방어 분기(비-object plan · 세 배열 각각 비-배열 · record instant Invalid/
// 비-Date)별 TypeError + 경계(단일 record 그룹 · 5 entity 섞임 · 중복 entity 누적 · 허용 외
// entity 무시) + non-mutating(freeze 통과)을 검증한다(import-restore-preview.spec.ts mirror).
// buildImportRestorePlan 으로 정방향 plan 을 만들어 요약이 plan 과 정합하는지 round-trip 도 본다.
import { ExportRecord } from "./export-scope-select";
import {
  buildImportRestorePlan,
  ImportRestorePlan,
} from "./import-restore-plan";
import {
  summarizeRestorePlan,
  RestorePlanSummary,
} from "./import-restore-plan-summary";

// 5 entity 전부 0 인 perEntity map 헬퍼 — 기대값 작성 보조.
function zeroMap() {
  return { Assessment: 0, Person: 0, Group: 0, LlmConfig: 0, AuditLog: 0 };
}

describe("summarizeRestorePlan — happy path (buildImportRestorePlan round-trip)", () => {
  it("replace plan → deleted=기존 전부, inserted=incoming 전부, kept.total=0", () => {
    const existing: ExportRecord[] = [
      { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") },
      { entity: "Assessment", instant: new Date("2026-03-01T00:00:00Z") },
    ];
    const incoming: ExportRecord[] = [
      { entity: "Group", instant: new Date("2026-04-01T00:00:00Z") },
      { entity: "AuditLog", instant: new Date("2026-05-01T00:00:00Z") },
    ];
    const plan = buildImportRestorePlan(existing, incoming, "replace");
    const summary: RestorePlanSummary = summarizeRestorePlan(plan);

    expect(summary.deleted.total).toBe(3);
    expect(summary.deleted.perEntity).toEqual({
      ...zeroMap(),
      Assessment: 2,
      Person: 1,
    });
    expect(summary.inserted.total).toBe(2);
    expect(summary.inserted.perEntity).toEqual({
      ...zeroMap(),
      Group: 1,
      AuditLog: 1,
    });
    // replace → kept 빈 그룹.
    expect(summary.kept.total).toBe(0);
    expect(summary.kept.perEntity).toEqual(zeroMap());
  });

  it("merge plan → kept breakdown 이 비충돌 기존 분포 반영, deleted 는 충돌 기존", () => {
    const shared = new Date("2026-06-15T00:00:00Z");
    const existing: ExportRecord[] = [
      { entity: "Assessment", instant: shared }, // 충돌 → deleted
      { entity: "Person", instant: new Date("2026-02-01T00:00:00Z") }, // 비충돌 → kept
      { entity: "Group", instant: new Date("2026-03-01T00:00:00Z") }, // 비충돌 → kept
    ];
    const incoming: ExportRecord[] = [
      { entity: "Assessment", instant: shared }, // 충돌본(file 우선)
      { entity: "LlmConfig", instant: new Date("2026-07-01T00:00:00Z") },
    ];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    const summary = summarizeRestorePlan(plan);

    // deleted = 충돌 기존(Assessment 1).
    expect(summary.deleted.total).toBe(1);
    expect(summary.deleted.perEntity.Assessment).toBe(1);
    // kept = 비충돌 기존(Person 1 + Group 1).
    expect(summary.kept.total).toBe(2);
    expect(summary.kept.perEntity).toEqual({
      ...zeroMap(),
      Person: 1,
      Group: 1,
    });
    // inserted = incoming 전부(Assessment 1 + LlmConfig 1).
    expect(summary.inserted.total).toBe(2);
    expect(summary.inserted.perEntity).toEqual({
      ...zeroMap(),
      Assessment: 1,
      LlmConfig: 1,
    });
  });

  it("빈 plan(세 배열 모두 빈) → 세 그룹 total 0 + perEntity 전부 0", () => {
    const plan = buildImportRestorePlan([], [], "replace");
    const summary = summarizeRestorePlan(plan);
    expect(summary.deleted.total).toBe(0);
    expect(summary.inserted.total).toBe(0);
    expect(summary.kept.total).toBe(0);
    expect(summary.deleted.perEntity).toEqual(zeroMap());
    expect(summary.inserted.perEntity).toEqual(zeroMap());
    expect(summary.kept.perEntity).toEqual(zeroMap());
  });

  it("merge 빈 incoming → 기존 전부 kept, deleted/inserted 빈", () => {
    const existing: ExportRecord[] = [
      { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
      { entity: "Person", instant: new Date("2026-01-02T00:00:00Z") },
    ];
    const plan = buildImportRestorePlan(existing, [], "merge");
    const summary = summarizeRestorePlan(plan);
    expect(summary.kept.total).toBe(2);
    expect(summary.kept.perEntity.Person).toBe(2);
    expect(summary.deleted.total).toBe(0);
    expect(summary.inserted.total).toBe(0);
  });
});

describe("summarizeRestorePlan — 경계 / branch", () => {
  it("각 그룹 비어있음 vs 비어있지 않음 분기 — 모든 조합 cover", () => {
    // deleted 비어있고 kept 비어있지 않은 plan.
    const plan: ImportRestorePlan = {
      toDelete: [],
      toInsert: [
        { entity: "Group", instant: new Date("2026-01-01T00:00:00Z") },
      ],
      toKeep: [{ entity: "Person", instant: new Date("2026-02-01T00:00:00Z") }],
    };
    const summary = summarizeRestorePlan(plan);
    expect(summary.deleted.total).toBe(0); // 빈 그룹 분기
    expect(summary.inserted.total).toBe(1); // 비-빈 그룹 분기
    expect(summary.kept.total).toBe(1); // 비-빈 그룹 분기
  });

  it("단일 record 그룹 경계 → total 1, 해당 entity 1", () => {
    const plan: ImportRestorePlan = {
      toDelete: [
        { entity: "AuditLog", instant: new Date("2026-01-01T00:00:00Z") },
      ],
      toInsert: [],
      toKeep: [],
    };
    const summary = summarizeRestorePlan(plan);
    expect(summary.deleted.total).toBe(1);
    expect(summary.deleted.perEntity.AuditLog).toBe(1);
  });

  it("5 entity 가 섞인 record 집합 → perEntity 정확 분배", () => {
    const plan: ImportRestorePlan = {
      toDelete: [
        { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
        { entity: "Person", instant: new Date("2026-01-02T00:00:00Z") },
        { entity: "Group", instant: new Date("2026-01-03T00:00:00Z") },
        { entity: "LlmConfig", instant: new Date("2026-01-04T00:00:00Z") },
        { entity: "AuditLog", instant: new Date("2026-01-05T00:00:00Z") },
      ],
      toInsert: [],
      toKeep: [],
    };
    const summary = summarizeRestorePlan(plan);
    expect(summary.deleted.perEntity).toEqual({
      Assessment: 1,
      Person: 1,
      Group: 1,
      LlmConfig: 1,
      AuditLog: 1,
    });
    // perEntity 5 key 합계 === total 정합.
    const sum = Object.values(summary.deleted.perEntity).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sum).toBe(summary.deleted.total);
  });

  it("중복 entity 누적 → perEntity 누적 집계", () => {
    const plan: ImportRestorePlan = {
      toDelete: [],
      toInsert: [
        { entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") },
        { entity: "Assessment", instant: new Date("2026-01-02T00:00:00Z") },
        { entity: "Assessment", instant: new Date("2026-01-03T00:00:00Z") },
        { entity: "Person", instant: new Date("2026-01-04T00:00:00Z") },
      ],
      toKeep: [],
    };
    const summary = summarizeRestorePlan(plan);
    expect(summary.inserted.total).toBe(4);
    expect(summary.inserted.perEntity.Assessment).toBe(3);
    expect(summary.inserted.perEntity.Person).toBe(1);
  });

  it("entity 가 5 허용 외 값 → perEntity 무시(누락 0), total 은 length 그대로", () => {
    const plan = {
      toDelete: [
        { entity: "Unknown", instant: new Date("2026-01-01T00:00:00Z") },
        { entity: "Assessment", instant: new Date("2026-01-02T00:00:00Z") },
      ],
      toInsert: [],
      toKeep: [],
    } as unknown as ImportRestorePlan;
    const summary = summarizeRestorePlan(plan);
    // total 은 배열 length 그대로(허용 외 record 도 count), perEntity 만 무시.
    expect(summary.deleted.total).toBe(2);
    expect(summary.deleted.perEntity.Assessment).toBe(1);
    const sum = Object.values(summary.deleted.perEntity).reduce(
      (a, b) => a + b,
      0,
    );
    // 허용 외 1 건은 perEntity 에 반영 안 됨(합계 1 < total 2).
    expect(sum).toBe(1);
  });
});

describe("summarizeRestorePlan — 입력 방어 (negative)", () => {
  it("비-object plan(null) → TypeError(plain object 명시)", () => {
    expect(() =>
      summarizeRestorePlan(null as unknown as ImportRestorePlan),
    ).toThrow(TypeError);
    expect(() =>
      summarizeRestorePlan(null as unknown as ImportRestorePlan),
    ).toThrow(/plain object/);
  });

  it("비-object plan(undefined) → TypeError", () => {
    expect(() =>
      summarizeRestorePlan(undefined as unknown as ImportRestorePlan),
    ).toThrow(/plain object/);
  });

  it("비-object plan(배열) → TypeError(array 명시)", () => {
    expect(() =>
      summarizeRestorePlan([] as unknown as ImportRestorePlan),
    ).toThrow(/array/);
  });

  it("비-object plan(string) → TypeError", () => {
    expect(() =>
      summarizeRestorePlan("not-a-plan" as unknown as ImportRestorePlan),
    ).toThrow(TypeError);
  });

  it("비-object plan(number) → TypeError", () => {
    expect(() =>
      summarizeRestorePlan(42 as unknown as ImportRestorePlan),
    ).toThrow(/plain object/);
  });

  it("plan.toDelete 가 배열 아님(object) → TypeError(toDelete 명시)", () => {
    const bad = {
      toDelete: {},
      toInsert: [],
      toKeep: [],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/plan\.toDelete 는 배열/);
  });

  it("plan.toInsert 가 배열 아님(string) → TypeError(toInsert 명시)", () => {
    const bad = {
      toDelete: [],
      toInsert: "nope",
      toKeep: [],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/plan\.toInsert 는 배열/);
  });

  it("plan.toKeep 가 배열 아님(number) → TypeError(toKeep 명시)", () => {
    const bad = {
      toDelete: [],
      toInsert: [],
      toKeep: 7,
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/plan\.toKeep 는 배열/);
  });

  it("plan.toDelete 가 undefined → TypeError", () => {
    const bad = {
      toInsert: [],
      toKeep: [],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/plan\.toDelete 는 배열/);
  });

  it("record 원소 instant 가 Invalid Date → 그 index TypeError", () => {
    const bad = {
      toDelete: [{ entity: "Assessment", instant: new Date("not-a-date") }],
      toInsert: [],
      toKeep: [],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/toDelete\[0\]\.instant/);
  });

  it("record 원소 instant 가 비-Date(string) → 그 index TypeError", () => {
    const bad = {
      toDelete: [],
      toInsert: [{ entity: "Person", instant: "2026-01-01T00:00:00Z" }],
      toKeep: [],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/toInsert\[0\]\.instant/);
  });

  it("record 원소 instant 가 number → 그 index TypeError", () => {
    const bad = {
      toDelete: [],
      toInsert: [],
      toKeep: [{ entity: "Group", instant: 1700000000000 }],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/toKeep\[0\]\.instant/);
  });

  it("record 원소 instant 가 null → 그 index TypeError", () => {
    const bad = {
      toDelete: [
        { entity: "Person", instant: new Date("2026-01-01T00:00:00Z") },
        { entity: "Group", instant: null },
      ],
      toInsert: [],
      toKeep: [],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/toDelete\[1\]\.instant/);
  });

  it("record 원소 instant 가 NaN-Date → 그 index TypeError", () => {
    const bad = {
      toDelete: [],
      toInsert: [],
      toKeep: [{ entity: "AuditLog", instant: new Date(NaN) }],
    } as unknown as ImportRestorePlan;
    expect(() => summarizeRestorePlan(bad)).toThrow(/toKeep\[0\]\.instant/);
  });
});

describe("summarizeRestorePlan — non-mutating (freeze 통과)", () => {
  it("Object.freeze 된 plan + 배열 + record 로 호출해도 통과하고 변형 0", () => {
    const toDelete = [
      Object.freeze({
        entity: "Assessment" as const,
        instant: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ];
    const toInsert = [
      Object.freeze({
        entity: "Person" as const,
        instant: new Date("2026-02-01T00:00:00.000Z"),
      }),
    ];
    const toKeep = [
      Object.freeze({
        entity: "Group" as const,
        instant: new Date("2026-03-01T00:00:00.000Z"),
      }),
    ];
    const plan = Object.freeze({
      toDelete: Object.freeze(toDelete),
      toInsert: Object.freeze(toInsert),
      toKeep: Object.freeze(toKeep),
    }) as unknown as ImportRestorePlan;

    let summary: RestorePlanSummary;
    expect(() => {
      summary = summarizeRestorePlan(plan);
    }).not.toThrow();
    expect(summary!.deleted.perEntity.Assessment).toBe(1);
    expect(summary!.inserted.perEntity.Person).toBe(1);
    expect(summary!.kept.perEntity.Group).toBe(1);
    // 입력 변형 0 검증.
    expect(plan.toDelete).toHaveLength(1);
    expect(plan.toInsert).toHaveLength(1);
    expect(plan.toKeep).toHaveLength(1);
  });

  it("반환 perEntity map 은 새 객체 — 변형이 입력에 전파되지 않음", () => {
    const plan = buildImportRestorePlan(
      [{ entity: "Assessment", instant: new Date("2026-01-01T00:00:00Z") }],
      [{ entity: "Person", instant: new Date("2026-02-01T00:00:00Z") }],
      "replace",
    );
    const summary = summarizeRestorePlan(plan);
    summary.deleted.perEntity.Assessment = 999;
    // 같은 plan 재요약 시 영향 없음(반환 map 이 매번 새 객체).
    const again = summarizeRestorePlan(plan);
    expect(again.deleted.perEntity.Assessment).toBe(1);
  });
});
