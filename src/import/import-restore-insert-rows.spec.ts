// import-restore-insert-rows.spec — T-1270. R-112 4 종 (happy / error / 분기 / negative 충분 cover)
// 을 신규 helper `buildImportRestoreInsertRows` 에 모두 적용한다. 순수 helper 라 DB · Prisma client ·
// mock 0 — plain 객체 fixture 와 상류 chain 실호출만으로 단언하며, 반복 단언은 `it.each` 표로 묶어
// diff 를 압축했다. 판정 규칙 drift 감시: 로컬 `isPlainObject` 사본이 원본
// (`export-full-record.buildFullExportRecord` 의 동명 helper) 과 갈라지지 않는지 같은 입력표를 두
// helper 에 함께 통과시켜 pin 한다.
import { ImportMode } from "@prisma/client";

import { EXPORT_SCHEMA_VERSION } from "../export/export-dump";
import { buildFullExportRecord } from "../export/export-full-record";
import type { ExportEntity, ExportRecord } from "../export/export-scope-select";

import { hydrateImportDumpRecords } from "./import-dump-records-hydrate";
import { buildImportRestoreInsertRows } from "./import-restore-insert-rows";
import { groupImportRestoreOperations } from "./import-restore-ops";
import { prepareImportRestorePlan } from "./import-restore-plan-prepare";
import {
  planImportRestoreTransactionSteps,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

// `fields` 를 실은 dump record — 타입 상 ExportRecord 로 좁혀진 자리에 그대로 흘러드는 런타임 shape.
function rec(entity: ExportEntity, fields: unknown, millis = 1): ExportRecord {
  return { entity, instant: new Date(millis), fields } as ExportRecord;
}

// insert step 조립 helper — 기본은 Person 1 건.
function step(
  records: unknown[] = [rec("Person", { id: "p1" })],
  overrides: Record<string, unknown> = {},
): ImportRestoreTransactionStep {
  return {
    phase: "insert",
    entity: "Person",
    delegate: "person",
    model: "Person",
    method: "createMany",
    records,
    ...overrides,
  } as unknown as ImportRestoreTransactionStep;
}

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 helper.
function callWithAny(value: unknown): Record<string, unknown>[] {
  return buildImportRestoreInsertRows(value as ImportRestoreTransactionStep);
}

// plain object 판정 drift 감시용 입력표 — 양쪽 helper 가 모두 거부해야 하는 값들.
const NON_PLAIN: Array<[string, unknown]> = [
  ["undefined(legacy dump 잔재)", undefined],
  ["null", null],
  ["배열", [{ id: "p1" }]],
  ["Date", new Date(0)],
  ["함수", (): number => 1],
  ["문자열", "leak-me"],
  ["숫자", 7],
  ["Map(class instance)", new Map([["id", "p1"]])],
];

describe("buildImportRestoreInsertRows — happy path", () => {
  it("2 entity · 다중 record 의 row 개수 · 순서 · key/값이 입력 fields 와 같고 instance 는 다르다", () => {
    const first = { id: "p1", fullName: "홍길동" };
    const second = { id: "p2", fullName: "김철수" };
    const group = { id: "g1", name: "1팀" };

    const rows = buildImportRestoreInsertRows(
      step([rec("Person", first), rec("Person", second), rec("Group", group)]),
    );

    expect(rows).toHaveLength(3);
    expect(rows).toEqual([first, second, group]);
    // 얕은 복사 — 입력 fields 와 다른 instance.
    expect(rows[0]).not.toBe(first);
    expect(rows[1]).not.toBe(second);
    expect(rows[2]).not.toBe(group);
  });

  it("chain 합성 — dump 원문의 fields 가 캐스팅 없이 row 까지 실려 나온다", () => {
    const records = [
      {
        entity: "Person",
        instant: "2026-02-02T01:02:03.000Z",
        fields: { id: "p1", fullName: "홍길동" },
      },
      {
        entity: "Group",
        instant: "2026-03-03T04:05:06.000Z",
        fields: { id: "g1", name: "1팀" },
      },
    ];
    const dump = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      generatedAt: "2026-07-28T00:00:00.000Z",
      scope: { scope: "full" },
      entityCounts: {
        Assessment: 0,
        Person: 1,
        Group: 1,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 2,
      records,
    };

    const prepared = prepareImportRestorePlan(
      Buffer.from(JSON.stringify(dump), "utf-8"),
      [],
      ImportMode.REPLACE,
    );
    if (!prepared.ok) {
      throw new Error("plan 준비가 실패했습니다");
    }
    const steps = planImportRestoreTransactionSteps(
      groupImportRestoreOperations(prepared.plan),
    );

    expect(steps.every((each) => each.phase === "insert")).toBe(true);
    expect(
      steps.map((each) => [each.entity, buildImportRestoreInsertRows(each)]),
    ).toEqual([
      ["Person", [records[0].fields]],
      ["Group", [records[1].fields]],
    ]);
  });
});

describe("buildImportRestoreInsertRows — 분기 cover", () => {
  it.each([
    [
      "phase 거부 (delete step 은 slice 2/3 책임)",
      step(undefined, { phase: "delete", method: "deleteMany" }),
      RangeError,
    ],
    ["method 거부", step(undefined, { method: "deleteMany" }), RangeError],
    ["빈 records 거부 (빈 batch 미생성)", step([]), RangeError],
    [
      "fields 비-plain-object 거부",
      step([rec("Person", new Date(0))]),
      TypeError,
    ],
  ])("%s", (_label, input, expected) => {
    expect(() => buildImportRestoreInsertRows(input)).toThrow(expected);
  });

  it("정상 조립 분기 → throw 0 이고 row 1 건", () => {
    expect(buildImportRestoreInsertRows(step())).toEqual([{ id: "p1" }]);
  });
});

describe("buildImportRestoreInsertRows — error path (입력 방어)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "insert"],
    ["숫자", 3],
    ["배열", [{ phase: "insert" }]],
  ])("step 이 객체 아님(%s) → TypeError", (_label, value) => {
    expect(() => callWithAny(value)).toThrow(TypeError);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["객체", {}],
    ["문자열", "record"],
  ])("records 가 배열 아님(%s) → TypeError", (_label, value) => {
    expect(() => callWithAny(step(undefined, { records: value }))).toThrow(
      TypeError,
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "record"],
    ["숫자", 1],
  ])("record 원소가 객체 아님(%s) → TypeError", (_label, value) => {
    expect(() => callWithAny(step([value]))).toThrow(TypeError);
  });

  it("부분 결과 반환 경로 0 — 첫 record 가 정상이어도 뒤가 위반이면 아무것도 돌려주지 않는다", () => {
    const good = { id: "p1" };
    let returned: unknown = "미호출";
    expect(() => {
      returned = callWithAny(step([rec("Person", good), rec("Person", null)]));
    }).toThrow(/step\.records\[1\]\.fields/);
    expect(returned).toBe("미호출");
    expect(good).toEqual({ id: "p1" });
  });
});

describe("buildImportRestoreInsertRows — negative cases", () => {
  it.each(NON_PLAIN)("(a) fields 가 %s → TypeError", (_label, value) => {
    expect(() => callWithAny(step([rec("Person", value)]))).toThrow(TypeError);
  });

  it("(a) drift 감시 — 원본 판정 helper(buildFullExportRecord)와 수용/거부가 일치한다", () => {
    for (const [, value] of NON_PLAIN) {
      expect(() =>
        buildFullExportRecord("Person", new Date(0), value as never),
      ).toThrow(TypeError);
    }
    // 반대 방향 (수용) — 원본이 받는 값은 본 helper 도 받아야 한다: 일반 객체 리터럴 · nested 값
    // 보유 객체 · Object.create(null).
    const nullProto = Object.assign(Object.create(null) as object, {
      id: "p1",
    }) as Record<string, unknown>;
    const ACCEPTED: Array<[string, Record<string, unknown>]> = [
      ["객체 리터럴", { id: "p1" }],
      ["다중 key 객체", { id: "p1", fullName: "홍길동", active: true }],
      ["nested 값 보유 객체", { id: "p1", createdAt: { deep: [1, 2] } }],
      ["Object.create(null)", nullProto],
    ];
    for (const [, value] of ACCEPTED) {
      expect(() =>
        buildFullExportRecord("Person", new Date(0), value),
      ).not.toThrow();
      expect(callWithAny(step([rec("Person", value)]))).toEqual([value]);
    }
  });

  it("(a2) drift 감시 — 빈 fields 는 상류가 수용하지만 본 helper 는 의도적으로 거부한다", () => {
    // 상류 2 곳은 빈 fields 를 정상 통과시킨다.
    expect(buildFullExportRecord("Person", new Date(0), {}).fields).toEqual({});
    expect(
      hydrateImportDumpRecords({
        records: [
          { entity: "Person", instant: "2026-01-01T00:00:00.000Z", fields: {} },
        ],
      }).ok,
    ).toBe(true);
    // 하류 경계인 본 helper 만 거부한다 — 컬럼 0 짜리 row 가 DB 로 새지 않도록.
    expect(() => callWithAny(step([rec("Person", {})]))).toThrow(RangeError);
  });

  it("(b) own enumerable key 0 개인 빈 fields → RangeError (빈 row 미생성)", () => {
    expect(() => callWithAny(step([rec("Person", {})]))).toThrow(RangeError);
    expect(() =>
      callWithAny(step([rec("Person", Object.create(null))])),
    ).toThrow(RangeError);
  });

  it("(c) prototype 에만 있는 key 는 실리지 않고, own __proto__ key 는 오염 없이 실린다", () => {
    const [plain] = buildImportRestoreInsertRows(step());
    for (const key of ["__proto__", "constructor", "toString"]) {
      expect(Object.prototype.hasOwnProperty.call(plain, key)).toBe(false);
    }
    expect(Object.keys(plain)).toEqual(["id"]);

    // own enumerable "__proto__" 는 JSON.parse 산출물에 실재할 수 있다 (일반 대입이면 prototype 이
    // 바뀌어 own key 가 사라진다).
    const parsed = JSON.parse('{"id":"p1","__proto__":{"polluted":true}}') as
      | Record<string, unknown>
      | undefined;
    const [row] = callWithAny(step([rec("Person", parsed)]));
    expect(Object.prototype.hasOwnProperty.call(row, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("(d) Object.create(null) fields 를 수용하고 key/값을 그대로 옮긴다", () => {
    const fields = Object.create(null) as Record<string, unknown>;
    fields.id = "p1";
    fields.score = 42;

    expect(callWithAny(step([rec("Person", fields)]))).toEqual([
      { id: "p1", score: 42 },
    ]);
  });

  it("(e) 값 10 종의 identity 가 그대로 보존된다 (변환 · 재생성 0)", () => {
    class Sample {
      readonly tag = "s";
    }
    const fields: Record<string, unknown> = {
      nested: { deep: { a: 1 } },
      when: new Date("2026-01-01T00:00:00.000Z"),
      nothing: null,
      missing: undefined,
      list: [1, 2, 3],
      map: new Map([["k", "v"]]),
      instance: new Sample(),
      count: 0,
      flag: false,
      blank: "",
    };

    const [row] = callWithAny(step([rec("Person", fields)]));

    expect(Object.keys(row)).toEqual(Object.keys(fields));
    for (const key of Object.keys(fields)) {
      expect(row[key]).toBe(fields[key]);
    }
  });

  it("(f) freeze 된 step / record / fields 로 호출해도 통과하고 입력이 변형되지 않는다", () => {
    const fields = Object.freeze({ id: "p1", fullName: "홍길동" });
    const record = Object.freeze({
      entity: "Person",
      instant: new Date(1),
      fields,
    });
    const frozen = Object.freeze(
      step([record]),
    ) as ImportRestoreTransactionStep;

    expect(buildImportRestoreInsertRows(frozen)).toEqual([
      { id: "p1", fullName: "홍길동" },
    ]);
    expect(fields).toEqual({ id: "p1", fullName: "홍길동" });
    expect(frozen.records).toEqual([record]);
    expect(frozen.records[0]).toBe(record);
  });

  it("(g) 같은 입력 2 회 호출 시 결과 동일 · 배열과 row 는 서로 다른 instance", () => {
    const input = step([
      rec("Person", { id: "p1" }),
      rec("Group", { id: "g1" }),
    ]);
    const first = buildImportRestoreInsertRows(input);
    const again = buildImportRestoreInsertRows(input);

    expect(first).toEqual(again);
    expect(first).not.toBe(again);
    expect(first[0]).not.toBe(again[0]);
    expect(first[1]).not.toBe(again[1]);
  });

  it("(h) 반환 row 를 변형해도 입력 fields 는 오염되지 않는다", () => {
    const fields = { id: "p1" };
    const rows = callWithAny(step([rec("Person", fields)]));
    rows[0].extra = true;
    delete rows[0].id;

    expect(fields).toEqual({ id: "p1" });
    expect(callWithAny(step([rec("Person", fields)]))).toEqual([{ id: "p1" }]);
  });

  it("REQ-032 — error 메시지에 fields 값 · record 원본 · stack 이 실리지 않는다", () => {
    let message = "";
    try {
      callWithAny(
        step([
          rec("Person", { note: "leak-me" }),
          rec("Person", "leak-me-too"),
        ]),
      );
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/step\.records\[1\]\.fields/);
    expect(message).toContain("string");
    expect(message).not.toContain("leak-me");
    expect(message).not.toContain("note");
    expect(message).not.toMatch(/\[object/);
    // records 자리 payload 도 종류만 노출한다.
    expect(() => callWithAny(step(undefined, { records: "leak-me" }))).toThrow(
      /받음: string/,
    );
  });

  it("REQ-032 되돌림 감지 — record 원소가 raw string 이어도 그 값이 메시지에 실리지 않는다", () => {
    let message = "";
    try {
      callWithAny(step([rec("Person", { id: "p1" }), "leak-me"]));
    } catch (error) {
      message = (error as Error).message;
    }

    // 종류 이름만 (`describeReceived` 로 되돌리면 값이 그대로 실려 본 단언이 깨진다).
    expect(message).toMatch(/step\.records\[1\] 는 객체여야 합니다/);
    expect(message).toContain("받음: string");
    expect(message).not.toContain("leak-me");
  });
});
