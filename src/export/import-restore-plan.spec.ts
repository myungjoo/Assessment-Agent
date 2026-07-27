// import-restore-plan 순수 helper spec — R-112 4 종(happy / error / branch / negative 충분
// cover). buildImportRestorePlan 이 기존 record + incoming record + mode(replace/merge)에서
// {toDelete, toInsert, toKeep} plan 을 UC-07 §6.2 정책대로 산출하는지 + 입력 방어 분기(비-배열
// existing/incoming · instant Invalid/비-Date · 잘못된 mode)별 error + 경계(빈 입력 조합 · 같은
// instant 다른 entity 비충돌 · 완전 동일 set 전부 교체 · incoming 중복) + non-mutating(freeze
// 통과 + 원본 length/원소 불변)을 검증한다(import-restore-preview.spec.ts mirror).
//
// T-1266 추가분 — insert record 타입 파라미터화(ImportRestorePlan<TInsert>)가 (1) FullExportRecord
// 의 fields 를 참조 identity 까지 보존해 toInsert 로 전달하고, (2) 타입 인자 없는 기존 사용법을
// 그대로 통과시키며, (3) 런타임 동작·throw 메시지에 회귀 0 임을 고정한다. 컴파일 타임 pinning
// (추론 좁힘 + toDelete 의 fields 접근 불가)은 ts-jest 의 type-check 가 강제하므로 타입이 다시
// 넓어지면 본 spec 이 컴파일 단계에서 깨진다.
import { FullExportRecord } from "./export-full-record";
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

// fields 를 실은 dump record 생성 헬퍼 — 상류 hydrate(T-1265)가 돌려주는 형태를 흉내낸다.
// buildFullExportRecord 를 쓰지 않는 이유: 본 spec 은 allow-list 정책이 아니라 타입 전달만
// 검증하므로 임의 fields(secret 유사 문자열 포함)를 자유롭게 넣을 수 있어야 한다.
function full(
  entity: ExportRecord["entity"],
  iso: string,
  fields: Record<string, unknown>,
): FullExportRecord {
  return { entity, instant: new Date(iso), fields };
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

describe("buildImportRestorePlan — insert record 타입 전달 (T-1266, happy)", () => {
  it("replace: FullExportRecord incoming 의 fields 가 참조 identity 까지 그대로 toInsert 로 전달", () => {
    const existing = [rec("Person", "2026-01-01T00:00:00Z")];
    const incoming = [
      full("Person", "2026-02-01T00:00:00Z", { id: "p-1", fullName: "홍길동" }),
      full("Group", "2026-02-02T00:00:00Z", { id: "g-1", name: "1반" }),
    ];
    const plan = buildImportRestorePlan(existing, incoming, "replace");
    // 원소 자체가 같은 참조 — slice 는 참조만 옮기므로 복제/변환 0.
    expect(plan.toInsert[0]).toBe(incoming[0]);
    expect(plan.toInsert[1]).toBe(incoming[1]);
    // fields 객체도 같은 참조(얕은 복제조차 하지 않음).
    expect(plan.toInsert[0].fields).toBe(incoming[0].fields);
    expect(plan.toInsert[0].fields).toEqual({ id: "p-1", fullName: "홍길동" });
    // 기존 계약 회귀 0 — replace 는 기존 전부 삭제 + 보존 없음.
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toKeep).toEqual([]);
  });

  it("merge: toInsert 가 incoming 전부를 순서 보존해 싣고 각 원소 fields 손실 0", () => {
    const existing = [rec("Assessment", "2026-01-01T00:00:00Z")];
    const incoming = [
      full("Assessment", "2026-01-01T00:00:00Z", { id: "a-1", score: 1 }),
      full("AuditLog", "2026-03-03T00:00:00Z", { id: "l-1", action: "IMPORT" }),
      full("LlmConfig", "2026-03-04T00:00:00Z", { id: "c-1", model: "gpt" }),
    ];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    expect(plan.toInsert).toHaveLength(3);
    expect(plan.toInsert.map((r) => r.entity)).toEqual([
      "Assessment",
      "AuditLog",
      "LlmConfig",
    ]);
    expect(plan.toInsert.map((r) => r.fields)).toEqual([
      { id: "a-1", score: 1 },
      { id: "l-1", action: "IMPORT" },
      { id: "c-1", model: "gpt" },
    ]);
    // 충돌한 기존 1건은 삭제(entity + instant 동일).
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toKeep).toEqual([]);
  });

  it("타입 인자 없이 ExportRecord[] 로 호출한 기존 사용법이 그대로 동작 (하위호환)", () => {
    const existing: ExportRecord[] = [rec("Group", "2026-01-01T00:00:00Z")];
    const incoming: ExportRecord[] = [rec("Person", "2026-02-01T00:00:00Z")];
    // 기본 타입 파라미터가 채워져 ImportRestorePlan(인자 0)으로 그대로 받는다.
    const plan: ImportRestorePlan = buildImportRestorePlan(
      existing,
      incoming,
      "merge",
    );
    expect(plan.toKeep).toEqual(existing);
    expect(plan.toInsert).toEqual(incoming);
    expect(plan.toDelete).toEqual([]);
  });
});

describe("buildImportRestorePlan — 컴파일 타임 pinning (T-1266)", () => {
  it("추론이 ImportRestorePlan<FullExportRecord> 로 좁혀지고 toInsert[0].fields 를 캐스팅 없이 읽는다", () => {
    const existing: ExportRecord[] = [rec("Person", "2026-01-01T00:00:00Z")];
    const incoming: FullExportRecord[] = [
      full("Person", "2026-02-01T00:00:00Z", { id: "p-1" }),
    ];
    // 타입이 다시 넓어지면(toInsert: ExportRecord[]) 아래 대입이 컴파일 오류가 된다.
    const plan: ImportRestorePlan<FullExportRecord> = buildImportRestorePlan(
      existing,
      incoming,
      "replace",
    );
    // as 캐스팅 없이 fields 접근 — 타입 전달이 끊기면 이 문장이 컴파일되지 않는다.
    const fields: Record<string, unknown> = plan.toInsert[0].fields;
    expect(fields).toEqual({ id: "p-1" });

    // @ts-expect-error toDelete 는 ExportRecord[] 라 fields 접근은 타입 오류여야 한다(파라미터화 대상 아님).
    const deletedFields: unknown = plan.toDelete[0].fields;
    // 런타임에도 기존 record 에는 fields 가 없다.
    expect(deletedFields).toBeUndefined();
  });
});

describe("buildImportRestorePlan — 메시지 회귀 pinning (T-1266, negative)", () => {
  it("비-배열 existing → 기존과 동일한 TypeError 전문", () => {
    expect(() =>
      buildImportRestorePlan(
        null as unknown as ExportRecord[],
        [full("Person", "2026-01-01T00:00:00Z", { id: "p-1" })],
        "replace",
      ),
    ).toThrow(
      new TypeError(
        "buildImportRestorePlan: existing 는 배열이어야 합니다 (받음: object)",
      ),
    );
  });

  it("비-배열 incoming(string) → 기존과 동일한 TypeError 전문", () => {
    expect(() =>
      buildImportRestorePlan(
        [],
        "nope" as unknown as FullExportRecord[],
        "merge",
      ),
    ).toThrow(
      new TypeError(
        "buildImportRestorePlan: incoming 는 배열이어야 합니다 (받음: string)",
      ),
    );
  });

  it("fields 를 가진 incoming 원소의 instant 가 Invalid Date → index 를 담은 TypeError 전문", () => {
    const incoming = [
      { entity: "Person", instant: new Date("nope"), fields: { id: "p-1" } },
    ] as FullExportRecord[];
    expect(() => buildImportRestorePlan([], incoming, "replace")).toThrow(
      new TypeError(
        "buildImportRestorePlan: incoming[0].instant 은(는) 유효한 Date instance 여야 합니다",
      ),
    );
  });

  it("fields 를 가진 incoming 원소의 instant 가 비-Date(number) → 동일 TypeError", () => {
    const incoming = [
      { entity: "Person", instant: 1735689600000, fields: { id: "p-1" } },
    ] as unknown as FullExportRecord[];
    expect(() => buildImportRestorePlan([], incoming, "merge")).toThrow(
      TypeError,
    );
  });

  it("fields 는 있는데 instant 가 누락된 원소 → 그 index(1) 를 담은 TypeError 전문", () => {
    const incoming = [
      full("Person", "2026-01-01T00:00:00Z", { id: "p-1" }),
      { entity: "Group", fields: { id: "g-1" } },
    ] as unknown as FullExportRecord[];
    expect(() => buildImportRestorePlan([], incoming, "merge")).toThrow(
      new TypeError(
        "buildImportRestorePlan: incoming[1].instant 은(는) 유효한 Date instance 여야 합니다",
      ),
    );
  });

  it("mode 가 객체 → RangeError 전문(대소문자 mismatch/null/숫자와 동형)", () => {
    expect(() =>
      buildImportRestorePlan([], [], {} as unknown as ImportRestoreMode),
    ).toThrow(
      new RangeError(
        "buildImportRestorePlan: mode 는 replace/merge 중 하나여야 합니다 (받음: [object Object])",
      ),
    );
  });

  it("error 메시지에 fields 의 값이 실리지 않는다 (secret 유사 문자열 미노출)", () => {
    const secret = "sk-live-SUPER-SECRET-0123456789";
    const incoming = [
      { entity: "LlmConfig", instant: new Date("nope"), fields: { secret } },
    ] as FullExportRecord[];
    let message = "";
    try {
      buildImportRestorePlan([], incoming, "replace");
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/incoming\[0\]\.instant/);
    // fields 의 값·key 어느 쪽도 메시지에 실리지 않는다.
    expect(message).not.toMatch(/sk-live/);
    expect(message).not.toMatch(/SECRET/i);
    expect(message).not.toMatch(/fields/);
  });
});

describe("buildImportRestorePlan — fields 경계·불변 (T-1266, negative)", () => {
  it("freeze 된 배열·원소·fields 로 호출해도 throw 0 이고 결과가 동일하다", () => {
    const frozenFields = Object.freeze({ id: "p-1", note: "동결" });
    const incoming = Object.freeze([
      Object.freeze({
        entity: "Person",
        instant: new Date("2026-02-01T00:00:00Z"),
        fields: frozenFields,
      }),
    ]) as unknown as FullExportRecord[];
    const existing = Object.freeze([
      Object.freeze(rec("Person", "2026-01-01T00:00:00Z")),
    ]) as unknown as ExportRecord[];

    let plan: ImportRestorePlan<FullExportRecord>;
    expect(() => {
      plan = buildImportRestorePlan(existing, incoming, "replace");
    }).not.toThrow();
    expect(plan!.toInsert[0].fields).toBe(frozenFields);
    expect(plan!.toDelete).toEqual([...existing]);
    // 입력 배열 length 불변.
    expect(existing).toHaveLength(1);
    expect(incoming).toHaveLength(1);
  });

  it("반환 plan 배열을 push/pop 해도 입력 배열은 불변 (fields 입력에서도 동형)", () => {
    const existing = [rec("Person", "2026-01-01T00:00:00Z")];
    const incoming = [full("Group", "2026-02-01T00:00:00Z", { id: "g-1" })];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    plan.toInsert.push(full("AuditLog", "2026-03-01T00:00:00Z", { id: "l-1" }));
    plan.toKeep.pop();
    expect(incoming).toHaveLength(1);
    expect(existing).toHaveLength(1);
    expect(existing[0].entity).toBe("Person");
  });

  it("existing 은 fields 없는 ExportRecord, incoming 은 FullExportRecord 인 혼합 호출이 정상 동작", () => {
    const existing: ExportRecord[] = [
      rec("Person", "2026-01-01T00:00:00Z"),
      rec("Group", "2026-01-02T00:00:00Z"),
    ];
    const incoming: FullExportRecord[] = [
      full("Person", "2026-01-01T00:00:00Z", { id: "p-1" }),
    ];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    // 충돌한 Person 은 삭제, 비충돌 Group 은 보존.
    expect(plan.toDelete).toEqual([existing[0]]);
    expect(plan.toKeep).toEqual([existing[1]]);
    expect(plan.toInsert[0].fields).toEqual({ id: "p-1" });
  });

  it("fields 가 서로 달라도 entity + instant 가 같으면 충돌 (fields 는 key 에 영향 0)", () => {
    const iso = "2026-07-07T07:07:07Z";
    const existing = [rec("Assessment", iso)];
    const incoming = [full("Assessment", iso, { id: "a-1", score: 99 })];
    const plan = buildImportRestorePlan(existing, incoming, "merge");
    expect(plan.toDelete).toEqual(existing);
    expect(plan.toKeep).toEqual([]);
    expect(plan.toInsert).toEqual(incoming);
  });

  it("빈 incoming / 빈 existing 경계 — fields 유무와 무관하게 기존 동작", () => {
    const emptyIncoming: FullExportRecord[] = [];
    const keepPlan = buildImportRestorePlan(
      [rec("Person", "2026-01-01T00:00:00Z")],
      emptyIncoming,
      "merge",
    );
    expect(keepPlan.toInsert).toEqual([]);
    expect(keepPlan.toKeep).toHaveLength(1);

    const seedPlan = buildImportRestorePlan(
      [],
      [full("Person", "2026-01-01T00:00:00Z", { id: "p-1" })],
      "replace",
    );
    expect(seedPlan.toDelete).toEqual([]);
    expect(seedPlan.toInsert[0].fields).toEqual({ id: "p-1" });
  });

  it("같은 입력으로 두 번 호출하면 동일 결과 (idempotent)", () => {
    const existing = [rec("Person", "2026-01-01T00:00:00Z")];
    const incoming = [
      full("Person", "2026-01-01T00:00:00Z", { id: "p-1" }),
      full("Group", "2026-05-05T00:00:00Z", { id: "g-1" }),
    ];
    const first = buildImportRestorePlan(existing, incoming, "merge");
    const second = buildImportRestorePlan(existing, incoming, "merge");
    expect(second).toEqual(first);
    // 원소 참조까지 동일 — 두 호출 모두 복제 0.
    expect(second.toInsert[0]).toBe(first.toInsert[0]);
  });
});
