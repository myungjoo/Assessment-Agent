// import-restore-plan 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). buildImportRestorePlan 이 기존 record + incoming record + mode(replace/merge)에서
// {toDelete, toInsert, toKeep} plan 을 UC-07 §6.2 정책대로 산출하는지 + 입력 방어 분기(비-배열
// existing/incoming · instant Invalid/비-Date · 잘못된 mode)별 error + 경계(빈 입력 조합 · 같은
// instant 다른 entity 비충돌 · 완전 동일 set 전부 교체 · incoming 중복) + non-mutating(freeze
// 통과 + 원본 length/원소 불변)을 검증한다(import-restore-preview.spec.ts mirror).
import { ExportRecord } from "./export-scope-select";
import {
  buildImportRestorePlan,
  ImportRestorePlan,
  ImportRestoreMode,
} from "./import-restore-plan";

// 간단한 record 생성 헬퍼 — entity + ISO instant.
function rec(entity: ExportRecord["entity"], iso: string): ExportRecord {
  return { entity, instant: new Date(iso) };
}

describe("buildImportRestorePlan — replace mode (happy / branch)", () => {
  it("기존 N개 + incoming M개 → toDelete N / toInsert M / toKeep 0", () => {
    const existing = [
      rec("Assessment", "2026-01-01T00:00:00Z"),
      rec("Person", "2026-01-02T00:00:00Z"),
      rec("Group", "2026-01-03T00:00:00Z"),
    ];
    const incoming = [
      rec("Assessment", "2026-02-01T00:00:00Z"),
      rec("AuditLog", "2026-02-02T00:00:00Z"),
    ];
    const plan: ImportRestorePlan = buildImportRestorePlan(
      existing,
      incoming,
      "replace",
    );
    expect(plan.toDelete).toHaveLength(3);
    expect(plan.toInsert).toHaveLength(2);
    expect(plan.toKeep).toEqual([]);
    // 입력 순서 보존.
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toInsert).toEqual(incoming);
  });

  it("replace 빈 existing → 빈 toDelete, incoming 전부 toInsert", () => {
    const incoming = [rec("Person", "2026-03-01T00:00:00Z")];
    const plan = buildImportRestorePlan([], incoming, "replace");
    expect(plan.toDelete).toEqual([]);
    expect(plan.toInsert).toEqual(incoming);
    expect(plan.toKeep).toEqual([]);
  });

  it("replace 빈 incoming → 기존 전부 toDelete, 빈 toInsert (전체 wipe)", () => {
    const existing = [rec("LlmConfig", "2026-04-01T00:00:00Z")];
    const plan = buildImportRestorePlan(existing, [], "replace");
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toKeep).toEqual([]);
  });

  it("replace 빈 입력 양쪽 → 세 배열 모두 빈 배열", () => {
    const plan = buildImportRestorePlan([], [], "replace");
    expect(plan.toDelete).toEqual([]);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toKeep).toEqual([]);
  });
});

describe("buildImportRestorePlan — merge mode 충돌 없음 (happy / branch)", () => {
  it("기존 전부 toKeep + incoming 전부 toInsert (key 겹침 0)", () => {
    const existing = [
      rec("Assessment", "2026-01-01T00:00:00Z"),
      rec("Person", "2026-01-02T00:00:00Z"),
    ];
    const incoming = [
      rec("Assessment", "2026-05-01T00:00:00Z"),
      rec("Group", "2026-05-02T00:00:00Z"),
    ];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    expect(plan.toKeep).toEqual(existing);
    expect(plan.toInsert).toEqual(incoming);
    expect(plan.toDelete).toEqual([]);
  });

  it("merge 빈 incoming → 기존 전부 toKeep, 빈 toInsert/toDelete (no-op merge)", () => {
    const existing = [rec("AuditLog", "2026-01-01T00:00:00Z")];
    const plan = buildImportRestorePlan(existing, [], "merge");
    expect(plan.toKeep).toEqual(existing);
    expect(plan.toInsert).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it("merge 빈 existing → 빈 toKeep/toDelete, incoming 전부 toInsert (신규 seed)", () => {
    const incoming = [rec("Person", "2026-01-01T00:00:00Z")];
    const plan = buildImportRestorePlan([], incoming, "merge");
    expect(plan.toKeep).toEqual([]);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toInsert).toEqual(incoming);
  });

  it("같은 instant 다른 entity → 충돌 아님 (entity+instant 조합 key)", () => {
    const same = "2026-06-06T06:06:06Z";
    const existing = [rec("Assessment", same)];
    const incoming = [rec("Person", same)];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    // entity 가 다르므로 충돌 아님 — 기존 보존 + incoming 신규.
    expect(plan.toKeep).toEqual(existing);
    expect(plan.toInsert).toEqual(incoming);
    expect(plan.toDelete).toEqual([]);
  });
});

describe("buildImportRestorePlan — merge mode 충돌 있음 (file 우선, branch)", () => {
  it("충돌 기존은 toDelete + incoming 으로 교체, 비충돌 기존은 toKeep", () => {
    const conflictIso = "2026-01-01T00:00:00Z";
    const existing = [
      rec("Assessment", conflictIso), // incoming 과 충돌 → toDelete
      rec("Person", "2026-01-02T00:00:00Z"), // 비충돌 → toKeep
    ];
    const incoming = [
      rec("Assessment", conflictIso), // 기존과 충돌 (file 우선)
      rec("Group", "2026-09-09T00:00:00Z"), // 신규
    ];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    // 충돌한 기존 Assessment 만 삭제.
    expect(plan.toDelete).toEqual([existing[0]]);
    // 비충돌 기존 Person 보존.
    expect(plan.toKeep).toEqual([existing[1]]);
    // incoming 전부 삽입.
    expect(plan.toInsert).toEqual(incoming);
  });

  it("기존·incoming 완전 동일 set (merge) → 전부 toDelete + toInsert, toKeep 0", () => {
    const records = [
      rec("Assessment", "2026-01-01T00:00:00Z"),
      rec("Person", "2026-01-02T00:00:00Z"),
    ];
    const existing = records.map((r) => ({ ...r }));
    const incoming = records.map((r) => ({ ...r }));
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toKeep).toEqual([]);
    expect(plan.toInsert).toEqual(incoming);
  });

  it("incoming 에 같은 key 중복 등장 → 모든 충돌 기존 삭제 + incoming 전부 삽입", () => {
    const iso = "2026-01-01T00:00:00Z";
    const existing = [rec("Assessment", iso)];
    const incoming = [rec("Assessment", iso), rec("Assessment", iso)]; // 중복
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    // 기존 1건은 충돌로 삭제.
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toKeep).toEqual([]);
    // incoming 중복은 그대로 전부 삽입 (dedupe 는 P5 책임, 본 helper 0).
    expect(plan.toInsert).toHaveLength(2);
  });

  it("일부 충돌·일부 신규 mix → 입력 순서 보존하며 정확 분류", () => {
    const existing = [
      rec("Assessment", "2026-01-01T00:00:00Z"), // 충돌
      rec("Person", "2026-01-02T00:00:00Z"), // 보존
      rec("Group", "2026-01-03T00:00:00Z"), // 충돌
    ];
    const incoming = [
      rec("Group", "2026-01-03T00:00:00Z"), // 기존[2] 와 충돌
      rec("Assessment", "2026-01-01T00:00:00Z"), // 기존[0] 와 충돌
      rec("AuditLog", "2026-12-31T00:00:00Z"), // 신규
    ];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    // toDelete 는 existing 순서 보존 (Assessment, Group).
    expect(plan.toDelete).toEqual([existing[0], existing[2]]);
    expect(plan.toKeep).toEqual([existing[1]]);
    expect(plan.toInsert).toEqual(incoming);
  });
});

describe("buildImportRestorePlan — 입력 방어 (negative)", () => {
  it("existing 이 배열 아님(null) → TypeError", () => {
    expect(() =>
      buildImportRestorePlan(null as unknown as ExportRecord[], [], "replace"),
    ).toThrow(TypeError);
    expect(() =>
      buildImportRestorePlan(null as unknown as ExportRecord[], [], "replace"),
    ).toThrow(/existing 는 배열/);
  });

  it("incoming 이 배열 아님(object) → TypeError", () => {
    expect(() =>
      buildImportRestorePlan([], {} as unknown as ExportRecord[], "merge"),
    ).toThrow(/incoming 는 배열/);
  });

  it("existing 원소 instant 가 Invalid Date → 그 index TypeError", () => {
    const bad = [
      { entity: "Assessment", instant: new Date("not-a-date") },
    ] as ExportRecord[];
    expect(() => buildImportRestorePlan(bad, [], "replace")).toThrow(
      /existing\[0\]\.instant/,
    );
  });

  it("incoming 두 번째 record instant 가 비-Date(null) → 그 index(1) TypeError", () => {
    const incoming = [
      rec("Person", "2026-01-01T00:00:00Z"),
      { entity: "Group", instant: null },
    ] as unknown as ExportRecord[];
    expect(() => buildImportRestorePlan([], incoming, "merge")).toThrow(
      /incoming\[1\]\.instant/,
    );
  });

  it("incoming 원소 instant 가 비-Date(string) → TypeError", () => {
    const incoming = [
      { entity: "Person", instant: "2026-01-01T00:00:00Z" },
    ] as unknown as ExportRecord[];
    expect(() => buildImportRestorePlan([], incoming, "replace")).toThrow(
      TypeError,
    );
  });

  it("mode 가 잘못된 문자열(대소문자 mismatch) → RangeError", () => {
    expect(() =>
      buildImportRestorePlan([], [], "Replace" as ImportRestoreMode),
    ).toThrow(RangeError);
    expect(() =>
      buildImportRestorePlan([], [], "REPLACE" as ImportRestoreMode),
    ).toThrow(/replace\/merge/);
  });

  it("mode 가 null → RangeError", () => {
    expect(() =>
      buildImportRestorePlan([], [], null as unknown as ImportRestoreMode),
    ).toThrow(RangeError);
  });

  it("mode 가 숫자 → RangeError", () => {
    expect(() =>
      buildImportRestorePlan([], [], 1 as unknown as ImportRestoreMode),
    ).toThrow(RangeError);
  });

  it("mode 가 임의 문자열(append) → RangeError", () => {
    expect(() =>
      buildImportRestorePlan([], [], "append" as ImportRestoreMode),
    ).toThrow(/replace\/merge/);
  });

  it("mode 검증이 records 검증보다 먼저 — 잘못된 mode + 비-배열 existing 이면 RangeError", () => {
    expect(() =>
      buildImportRestorePlan(
        null as unknown as ExportRecord[],
        [],
        "bad" as ImportRestoreMode,
      ),
    ).toThrow(RangeError);
  });
});

describe("buildImportRestorePlan — non-mutating (freeze 통과 + 원본 불변)", () => {
  it("Object.freeze 된 existing/incoming 으로 호출해도 통과하고 변형 0 (replace)", () => {
    const existing = Object.freeze([
      Object.freeze(rec("Assessment", "2026-01-01T00:00:00Z")),
    ]) as unknown as ExportRecord[];
    const incoming = Object.freeze([
      Object.freeze(rec("Person", "2026-02-01T00:00:00Z")),
    ]) as unknown as ExportRecord[];
    let plan: ImportRestorePlan;
    expect(() => {
      plan = buildImportRestorePlan(existing, incoming, "replace");
    }).not.toThrow();
    expect(plan!.toDelete).toHaveLength(1);
    expect(plan!.toInsert).toHaveLength(1);
    // 원본 length 불변.
    expect(existing).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });

  it("Object.freeze 된 입력으로 merge 호출해도 통과 + 원본 length 불변", () => {
    const existing = Object.freeze([
      Object.freeze(rec("Assessment", "2026-01-01T00:00:00Z")),
      Object.freeze(rec("Person", "2026-01-02T00:00:00Z")),
    ]) as unknown as ExportRecord[];
    const incoming = Object.freeze([
      Object.freeze(rec("Assessment", "2026-01-01T00:00:00Z")),
    ]) as unknown as ExportRecord[];
    let plan: ImportRestorePlan;
    expect(() => {
      plan = buildImportRestorePlan(existing, incoming, "merge");
    }).not.toThrow();
    expect(plan!.toDelete).toHaveLength(1);
    expect(plan!.toKeep).toHaveLength(1);
    expect(plan!.toInsert).toHaveLength(1);
    expect(existing).toHaveLength(2);
    expect(incoming).toHaveLength(1);
  });

  it("반환 배열 변형이 입력 배열에 전파되지 않음 (새 배열)", () => {
    const existing = [rec("Group", "2026-01-01T00:00:00Z")];
    const incoming = [rec("Person", "2026-02-01T00:00:00Z")];
    const plan = buildImportRestorePlan(existing, incoming, "replace");
    expect(plan.toDelete).not.toBe(existing);
    expect(plan.toInsert).not.toBe(incoming);
    plan.toDelete.push(rec("AuditLog", "2026-03-01T00:00:00Z"));
    // 입력 배열 length 불변.
    expect(existing).toHaveLength(1);
  });
});
