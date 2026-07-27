// import-restore-ops.spec — T-1262. R-112 4 종 (happy / error / 분기 / negative 충분 cover) 을
// 신규 helper 2 심볼 (`ImportRestoreOperation` 타입 + `groupImportRestoreOperations`) 에 대해 모두
// 커버한다. 순수 helper 라 DB · Prisma · fixture 0 — plain 배열만으로 단언한다.
//
// 순서 계약은 하드코딩 기대값이 아니라 T-1261 상수 (`IMPORT_RESTORE_INSERT_ORDER`) 에서 파생한
// 기대값으로도 함께 단언한다 — 순서 정책이 바뀌면 두 helper 가 함께 움직여야 함을 고정하기 위함이다.
import {
  type ExportEntity,
  type ExportRecord,
} from "../export/export-scope-select";
import { type ImportRestorePlan } from "../export/import-restore-plan";

import {
  groupImportRestoreOperations,
  type ImportRestoreOperation,
} from "./import-restore-ops";
import {
  IMPORT_RESTORE_INSERT_ORDER,
  type ImportRestorePhase,
} from "./import-restore-order";

// record 조립 helper — 본 helper 는 entity 이름만 보므로 instant 는 식별용 눈금으로만 쓴다.
function rec(entity: ExportEntity, millis: number): ExportRecord {
  return { entity, instant: new Date(millis) };
}

// plan 조립 helper — 세 배열 중 지정하지 않은 것은 빈 배열.
function plan(parts: Partial<ImportRestorePlan>): ImportRestorePlan {
  return {
    toDelete: parts.toDelete ?? [],
    toInsert: parts.toInsert ?? [],
    toKeep: parts.toKeep ?? [],
  };
}

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 helper — 잘못된 입력을 그대로 전달한다.
function callWithAny(value: unknown): ImportRestoreOperation[] {
  return groupImportRestoreOperations(value as ImportRestorePlan);
}

// (phase, entity) 쌍만 뽑아 순서를 단언하기 위한 축약.
function shapeOf(
  operations: ImportRestoreOperation[],
): Array<[ImportRestorePhase, ExportEntity]> {
  return operations.map((operation) => [operation.phase, operation.entity]);
}

describe("groupImportRestoreOperations — happy path", () => {
  it("replace 형태 plan (기존 전부 delete + incoming 전부 insert) 을 FK 안전 순서 그룹으로 접는다", () => {
    const existingAssessment = rec("Assessment", 10);
    const existingPerson = rec("Person", 20);
    const incomingPerson = rec("Person", 30);
    const incomingAssessment = rec("Assessment", 40);

    const operations = groupImportRestoreOperations(
      plan({
        toDelete: [existingAssessment, existingPerson],
        toInsert: [incomingPerson, incomingAssessment],
      }),
    );

    expect(shapeOf(operations)).toEqual([
      ["delete", "Assessment"],
      ["delete", "Person"],
      ["insert", "Person"],
      ["insert", "Assessment"],
    ]);
    expect(operations[0].records).toEqual([existingAssessment]);
    expect(operations[3].records).toEqual([incomingAssessment]);
  });

  it("merge 형태 plan (일부 delete + 전부 insert + toKeep 존재) 도 같은 계약을 따른다", () => {
    const conflicted = rec("Person", 100);
    const kept = rec("Group", 110);
    const incomingPerson = rec("Person", 120);
    const incomingAssessment = rec("Assessment", 130);

    const operations = groupImportRestoreOperations(
      plan({
        toDelete: [conflicted],
        toInsert: [incomingAssessment, incomingPerson],
        toKeep: [kept],
      }),
    );

    expect(shapeOf(operations)).toEqual([
      ["delete", "Person"],
      ["insert", "Person"],
      ["insert", "Assessment"],
    ]);
    expect(operations.map((operation) => operation.records)).toEqual([
      [conflicted],
      [incomingPerson],
      [incomingAssessment],
    ]);
  });

  it("insert 에서는 Person 이 Assessment 보다 앞, delete 에서는 뒤에 온다", () => {
    const operations = groupImportRestoreOperations(
      plan({
        toDelete: [rec("Person", 1), rec("Assessment", 2)],
        toInsert: [rec("Assessment", 3), rec("Person", 4)],
      }),
    );
    const deletes = operations.filter(
      (operation) => operation.phase === "delete",
    );
    const inserts = operations.filter(
      (operation) => operation.phase === "insert",
    );

    expect(
      deletes.findIndex((operation) => operation.entity === "Person"),
    ).toBeGreaterThan(
      deletes.findIndex((operation) => operation.entity === "Assessment"),
    );
    expect(
      inserts.findIndex((operation) => operation.entity === "Person"),
    ).toBeLessThan(
      inserts.findIndex((operation) => operation.entity === "Assessment"),
    );
  });
});

describe("groupImportRestoreOperations — 순서·구성 계약", () => {
  it("delete phase 그룹이 전부 앞, insert phase 그룹이 전부 뒤에 온다", () => {
    const operations = groupImportRestoreOperations(
      plan({
        toDelete: [rec("Group", 1), rec("Person", 2)],
        toInsert: [rec("Assessment", 3), rec("LlmConfig", 4)],
      }),
    );
    const phases = operations.map((operation) => operation.phase);

    expect(phases.lastIndexOf("delete")).toBeLessThan(phases.indexOf("insert"));
    expect(phases).toEqual(["delete", "delete", "insert", "insert"]);
  });

  it("각 phase 의 entity 순서는 T-1261 상수 (insert 순 / delete 역순) 에서 파생된다", () => {
    const all = IMPORT_RESTORE_INSERT_ORDER.map((entity, index) =>
      rec(entity, index),
    );
    const operations = groupImportRestoreOperations(
      plan({ toDelete: all, toInsert: all }),
    );

    expect(
      operations
        .filter((operation) => operation.phase === "delete")
        .map((operation) => operation.entity),
    ).toEqual([...IMPORT_RESTORE_INSERT_ORDER].reverse());
    expect(
      operations
        .filter((operation) => operation.phase === "insert")
        .map((operation) => operation.entity),
    ).toEqual([...IMPORT_RESTORE_INSERT_ORDER]);
  });

  it("toKeep 은 operation 을 만들지 않는다", () => {
    const operations = groupImportRestoreOperations(
      plan({ toKeep: [rec("Person", 1), rec("Assessment", 2)] }),
    );

    expect(operations).toEqual([]);
  });

  it("toKeep 에만 있는 entity 는 결과 어디에도 나타나지 않는다", () => {
    const operations = groupImportRestoreOperations(
      plan({
        toDelete: [rec("Person", 1)],
        toInsert: [rec("Person", 2)],
        toKeep: [rec("AuditLog", 3)],
      }),
    );

    expect(
      operations.some((operation) => operation.entity === "AuditLog"),
    ).toBe(false);
  });

  it("record 가 0 건인 entity 는 빈 그룹조차 만들지 않는다", () => {
    const operations = groupImportRestoreOperations(
      plan({ toInsert: [rec("Group", 1)] }),
    );

    expect(operations).toHaveLength(1);
    expect(operations[0].records).toHaveLength(1);
    expect(operations.every((operation) => operation.records.length > 0)).toBe(
      true,
    );
  });

  it("그룹 안 record 는 입력 순서를 보존한다", () => {
    const first = rec("Person", 1);
    const second = rec("Person", 2);
    const third = rec("Person", 3);
    const operations = groupImportRestoreOperations(
      plan({ toInsert: [first, rec("Group", 9), second, third] }),
    );
    const personGroup = operations.find(
      (operation) => operation.entity === "Person",
    );

    expect(personGroup?.records).toEqual([first, second, third]);
    expect(personGroup?.records[0]).toBe(first);
  });
});

describe("groupImportRestoreOperations — 분기 cover", () => {
  it("빈 plan (세 배열 모두 빈 배열) 은 error 없이 빈 결과를 돌려준다", () => {
    expect(groupImportRestoreOperations(plan({}))).toEqual([]);
  });

  it("delete 만 있는 plan 은 delete 그룹만 만든다", () => {
    const operations = groupImportRestoreOperations(
      plan({ toDelete: [rec("Person", 1), rec("Assessment", 2)] }),
    );

    expect(shapeOf(operations)).toEqual([
      ["delete", "Assessment"],
      ["delete", "Person"],
    ]);
  });

  it("insert 만 있는 plan 은 insert 그룹만 만든다", () => {
    const operations = groupImportRestoreOperations(
      plan({ toInsert: [rec("Assessment", 1), rec("Person", 2)] }),
    );

    expect(shapeOf(operations)).toEqual([
      ["insert", "Person"],
      ["insert", "Assessment"],
    ]);
  });

  it("단일 entity 만 있는 plan 은 phase 당 그룹 1 개씩만 만든다", () => {
    const operations = groupImportRestoreOperations(
      plan({
        toDelete: [rec("Group", 1), rec("Group", 2)],
        toInsert: [rec("Group", 3)],
      }),
    );

    expect(shapeOf(operations)).toEqual([
      ["delete", "Group"],
      ["insert", "Group"],
    ]);
    expect(operations[0].records).toHaveLength(2);
  });

  it("5 entity 전부 있는 plan 은 phase 당 5 그룹, 총 10 그룹을 만든다", () => {
    const all = IMPORT_RESTORE_INSERT_ORDER.map((entity, index) =>
      rec(entity, index),
    );
    const operations = groupImportRestoreOperations(
      plan({ toDelete: all, toInsert: all }),
    );

    expect(operations).toHaveLength(10);
    expect(
      operations.filter((operation) => operation.phase === "delete"),
    ).toHaveLength(5);
    expect(
      operations.filter((operation) => operation.phase === "insert"),
    ).toHaveLength(5);
  });
});

describe("groupImportRestoreOperations — error path (negative cases)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["숫자", 42],
    ["문자열", "plan"],
  ])("plan 이 비-객체 (%s) 면 TypeError", (_label, value) => {
    expect(() => callWithAny(value)).toThrow(TypeError);
    expect(() => callWithAny(value)).toThrow(/plan 은 객체여야 합니다/);
  });

  it("plan 이 null 이면 메시지가 받은 값을 null 로 표기한다", () => {
    expect(() => callWithAny(null)).toThrow(/받음: null/);
  });

  it("toDelete 가 배열이 아니면 TypeError (배열명 포함)", () => {
    expect(() => callWithAny({ toDelete: "nope", toInsert: [] })).toThrow(
      TypeError,
    );
    expect(() => callWithAny({ toDelete: "nope", toInsert: [] })).toThrow(
      /plan\.toDelete 는 배열이어야 합니다/,
    );
  });

  it("toDelete 가 없으면 (undefined) TypeError", () => {
    expect(() => callWithAny({ toInsert: [] })).toThrow(
      /plan\.toDelete 는 배열이어야 합니다/,
    );
  });

  it("toInsert 가 배열이 아니면 TypeError (배열명 포함)", () => {
    expect(() => callWithAny({ toDelete: [], toInsert: { a: 1 } })).toThrow(
      TypeError,
    );
    expect(() => callWithAny({ toDelete: [], toInsert: { a: 1 } })).toThrow(
      /plan\.toInsert 는 배열이어야 합니다/,
    );
  });

  it.each([
    ["오타", "Persons"],
    ["소문자", "person"],
    ["null", null],
    ["숫자", 7],
    ["객체", { entity: "Person" }],
  ])(
    "toDelete 원소의 entity 가 5 literal 밖 (%s) 이면 index 를 담은 RangeError",
    (_label, entity) => {
      const bad = {
        toDelete: [rec("Person", 1), { entity, instant: new Date(2) }],
        toInsert: [],
      };

      expect(() => callWithAny(bad)).toThrow(RangeError);
      expect(() => callWithAny(bad)).toThrow(/plan\.toDelete\[1\]\.entity/);
    },
  );

  it("toInsert 원소의 entity 가 5 literal 밖이면 그 배열명 + index 의 RangeError", () => {
    const bad = {
      toDelete: [],
      toInsert: [rec("Person", 1), rec("Group", 2), { entity: "Nope" }],
    };

    expect(() => callWithAny(bad)).toThrow(RangeError);
    expect(() => callWithAny(bad)).toThrow(/plan\.toInsert\[2\]\.entity/);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["원시값", 3],
  ])("원소가 %s 이라 entity 접근이 불가하면 RangeError", (_label, element) => {
    expect(() => callWithAny({ toDelete: [element], toInsert: [] })).toThrow(
      RangeError,
    );
    expect(() => callWithAny({ toDelete: [element], toInsert: [] })).toThrow(
      /plan\.toDelete\[0\]\.entity/,
    );
  });

  it("error 메시지에 record 원본 payload 를 싣지 않는다 (REQ-032)", () => {
    const secret = { entity: { name: "비밀" }, instant: new Date(1) };

    expect(() => callWithAny({ toDelete: [secret], toInsert: [] })).toThrow(
      /받음: object\)$/,
    );
    expect(() => callWithAny({ toDelete: [secret], toInsert: [] })).not.toThrow(
      /비밀/,
    );
  });

  it("검증 실패 시 부분 결과를 돌려주지 않는다 (toInsert 위반이면 delete 그룹도 나오지 않음)", () => {
    let result: ImportRestoreOperation[] | undefined;

    expect(() => {
      result = callWithAny({
        toDelete: [rec("Person", 1)],
        toInsert: [{ entity: "bogus" }],
      });
    }).toThrow(RangeError);
    expect(result).toBeUndefined();
  });
});

describe("groupImportRestoreOperations — 순수성 (non-mutating)", () => {
  it("freeze 된 plan · 배열 · 원소로 호출해도 정상 동작한다", () => {
    const frozen = Object.freeze({
      toDelete: Object.freeze([Object.freeze(rec("Assessment", 1))]),
      toInsert: Object.freeze([Object.freeze(rec("Person", 2))]),
      toKeep: Object.freeze([]),
    }) as unknown as ImportRestorePlan;

    expect(shapeOf(groupImportRestoreOperations(frozen))).toEqual([
      ["delete", "Assessment"],
      ["insert", "Person"],
    ]);
  });

  it("입력 plan 의 배열 내용과 길이를 변형하지 않는다", () => {
    const toDelete = [rec("Assessment", 1), rec("Person", 2)];
    const toInsert = [rec("Person", 3)];
    const snapshot = {
      toDelete: [...toDelete],
      toInsert: [...toInsert],
    };

    groupImportRestoreOperations(plan({ toDelete, toInsert }));

    expect(toDelete).toEqual(snapshot.toDelete);
    expect(toInsert).toEqual(snapshot.toInsert);
  });

  it("반환 배열·그룹을 호출자가 변형해도 다음 호출 결과가 오염되지 않는다", () => {
    const input = plan({ toInsert: [rec("Person", 1)] });
    const first = groupImportRestoreOperations(input);

    first.push({ phase: "delete", entity: "Group", records: [] });
    first[0].records.push(rec("Person", 99));
    first[0].entity = "AuditLog";

    const second = groupImportRestoreOperations(input);
    expect(shapeOf(second)).toEqual([["insert", "Person"]]);
    expect(second[0].records).toHaveLength(1);
  });

  it("반환 그룹의 record 배열은 입력 배열과 다른 인스턴스다", () => {
    const toInsert = [rec("Group", 1)];
    const operations = groupImportRestoreOperations(plan({ toInsert }));

    expect(operations[0].records).not.toBe(toInsert);
    expect(operations[0].records[0]).toBe(toInsert[0]);
  });
});
