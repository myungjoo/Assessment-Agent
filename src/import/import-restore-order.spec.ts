// import-restore-order.spec — T-1261. R-112 4 종 (happy / error / 분기 / negative 충분 cover) 을
// 신규 helper 2 심볼 (IMPORT_RESTORE_INSERT_ORDER 상수 + orderImportRestoreEntities) 에 대해 모두
// 커버한다. 순수 helper 라 DB · Prisma · fixture 0 — 상수/배열만으로 단언한다.
import {
  VALID_EXPORT_ENTITIES,
  type ExportEntity,
} from "../export/export-scope-select";

import {
  IMPORT_RESTORE_INSERT_ORDER,
  orderImportRestoreEntities,
} from "./import-restore-order";

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 helper — 잘못된 입력을 그대로 전달한다.
function callWithAny(entities: unknown, phase: unknown): ExportEntity[] {
  return orderImportRestoreEntities(
    entities as ReadonlyArray<ExportEntity>,
    phase as "insert" | "delete",
  );
}

describe("IMPORT_RESTORE_INSERT_ORDER (FK 안전 삽입 순서 상수)", () => {
  it("5 entity 를 정확히 1 번씩 담는다 (누락·중복 0)", () => {
    expect(IMPORT_RESTORE_INSERT_ORDER).toHaveLength(5);
    expect(new Set(IMPORT_RESTORE_INSERT_ORDER).size).toBe(5);
  });

  it("VALID_EXPORT_ENTITIES 와 집합이 같다 (union 과 동일 멤버십)", () => {
    expect([...IMPORT_RESTORE_INSERT_ORDER].sort()).toEqual(
      [...VALID_EXPORT_ENTITIES].sort(),
    );
  });

  it("유일한 FK 제약인 Person < Assessment 를 만족한다", () => {
    const personIndex = IMPORT_RESTORE_INSERT_ORDER.indexOf("Person");
    const assessmentIndex = IMPORT_RESTORE_INSERT_ORDER.indexOf("Assessment");
    expect(personIndex).toBeGreaterThanOrEqual(0);
    expect(personIndex).toBeLessThan(assessmentIndex);
  });

  it("결정론적 고정 순서를 유지한다", () => {
    expect(IMPORT_RESTORE_INSERT_ORDER).toEqual([
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
      "Assessment",
    ]);
  });

  it("동결돼 있어 push / index 대입이 원본을 바꾸지 못한다", () => {
    const before = [...IMPORT_RESTORE_INSERT_ORDER];
    const mutable = IMPORT_RESTORE_INSERT_ORDER as ExportEntity[];
    expect(Object.isFrozen(IMPORT_RESTORE_INSERT_ORDER)).toBe(true);
    expect(() => mutable.push("Person")).toThrow();
    expect(() => {
      mutable[0] = "Assessment";
    }).toThrow();
    expect(IMPORT_RESTORE_INSERT_ORDER).toEqual(before);
  });
});

describe("orderImportRestoreEntities — happy path", () => {
  it("뒤섞인 5 entity 입력을 insert 순서로 정렬한다", () => {
    const shuffled: ExportEntity[] = [
      "Assessment",
      "AuditLog",
      "Person",
      "LlmConfig",
      "Group",
    ];
    expect(orderImportRestoreEntities(shuffled, "insert")).toEqual([
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
      "Assessment",
    ]);
  });

  it("같은 입력을 delete 로 부르면 정확히 insert 순서의 역순이다", () => {
    const shuffled: ExportEntity[] = [
      "Assessment",
      "AuditLog",
      "Person",
      "LlmConfig",
      "Group",
    ];
    expect(orderImportRestoreEntities(shuffled, "delete")).toEqual(
      [...IMPORT_RESTORE_INSERT_ORDER].reverse(),
    );
  });

  it("부분 집합 입력도 두 phase 각각 올바른 순서로 돌려준다", () => {
    const subset: ExportEntity[] = ["Assessment", "Person"];
    expect(orderImportRestoreEntities(subset, "insert")).toEqual([
      "Person",
      "Assessment",
    ]);
    expect(orderImportRestoreEntities(subset, "delete")).toEqual([
      "Assessment",
      "Person",
    ]);
  });

  it("입력에 없는 entity 는 결과에도 없다", () => {
    const result = orderImportRestoreEntities(["Group", "AuditLog"], "insert");
    expect(result).toEqual(["Group", "AuditLog"]);
    expect(result).not.toContain("Person");
  });
});

describe("orderImportRestoreEntities — 분기 cover", () => {
  it("(1) phase insert 분기 / (2) phase delete 분기 가 서로 역순이다", () => {
    const input: ExportEntity[] = ["Person", "Group", "Assessment"];
    const inserted = orderImportRestoreEntities(input, "insert");
    const deleted = orderImportRestoreEntities(input, "delete");
    expect(inserted).toEqual(["Person", "Group", "Assessment"]);
    expect(deleted).toEqual([...inserted].reverse());
  });

  it("(3) 빈 배열 입력은 두 phase 모두 빈 배열 (error 아님)", () => {
    expect(orderImportRestoreEntities([], "insert")).toEqual([]);
    expect(orderImportRestoreEntities([], "delete")).toEqual([]);
  });

  it("(4) 중복 원소 입력은 dedupe 된다", () => {
    const duplicated: ExportEntity[] = [
      "Person",
      "Person",
      "Assessment",
      "Person",
    ];
    expect(orderImportRestoreEntities(duplicated, "insert")).toEqual([
      "Person",
      "Assessment",
    ]);
    expect(orderImportRestoreEntities(duplicated, "delete")).toEqual([
      "Assessment",
      "Person",
    ]);
  });
});

describe("orderImportRestoreEntities — error path", () => {
  it("(5) entities 가 배열이 아니면 TypeError", () => {
    for (const invalid of [null, undefined, "Person", { 0: "Person" }, 42]) {
      expect(() => callWithAny(invalid, "insert")).toThrow(TypeError);
    }
  });

  it("배열 방어 메시지는 한국어이고 함수명을 포함한다", () => {
    expect(() => callWithAny(null, "insert")).toThrow(
      /orderImportRestoreEntities: entities 는 배열이어야 합니다/,
    );
  });

  it("(6) 원소가 5 literal 밖 값이면 index 를 담은 RangeError", () => {
    const invalidElements: unknown[] = [
      "person",
      "Part",
      "",
      null,
      undefined,
      42,
      {},
    ];
    for (const element of invalidElements) {
      expect(() => callWithAny([element], "insert")).toThrow(RangeError);
      expect(() => callWithAny([element], "insert")).toThrow(
        /entities\[0\] 는 export entity 5 종 중 하나여야 합니다/,
      );
    }
  });

  it("원소 방어 메시지는 위반 원소의 index 를 정확히 담는다", () => {
    expect(() => callWithAny(["Person", "Group", "part"], "delete")).toThrow(
      /orderImportRestoreEntities: entities\[2\] 는/,
    );
  });

  it("(7) phase 가 insert/delete 밖 값이면 RangeError", () => {
    for (const invalid of ["upsert", "", undefined, null, 42, {}]) {
      expect(() => callWithAny(["Person"], invalid)).toThrow(RangeError);
    }
    expect(() => callWithAny(["Person"], "upsert")).toThrow(
      /orderImportRestoreEntities: phase 는 insert\/delete 중 하나여야 합니다/,
    );
  });

  it("phase 방어가 entities 방어보다 먼저다 (잘못된 둘 다면 RangeError)", () => {
    expect(() => callWithAny(null, "upsert")).toThrow(RangeError);
  });
});

describe("orderImportRestoreEntities — negative cases", () => {
  it("입력 배열을 변형하지 않는다 (길이·원소 동일)", () => {
    const input: ExportEntity[] = ["Assessment", "Person", "Group"];
    const snapshot = [...input];
    orderImportRestoreEntities(input, "insert");
    orderImportRestoreEntities(input, "delete");
    expect(input).toEqual(snapshot);
  });

  it("Object.freeze 된 배열로 호출해도 통과한다", () => {
    const frozen = Object.freeze<ExportEntity[]>(["Assessment", "Person"]);
    expect(orderImportRestoreEntities(frozen, "insert")).toEqual([
      "Person",
      "Assessment",
    ]);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it("반환 배열은 입력과 다른 참조이고, 변형해도 모듈 상수를 오염시키지 않는다", () => {
    const input: ExportEntity[] = ["Person", "Group"];
    const first = orderImportRestoreEntities(input, "insert");
    expect(first).not.toBe(input);
    first.push("Assessment");
    first[0] = "AuditLog";
    expect(IMPORT_RESTORE_INSERT_ORDER).toEqual([
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
      "Assessment",
    ]);
  });

  it("두 번째 호출 결과가 첫 호출과 동일하다 (idempotent)", () => {
    const input: ExportEntity[] = ["AuditLog", "Person"];
    const first = orderImportRestoreEntities(input, "delete");
    const second = orderImportRestoreEntities(input, "delete");
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("연속 호출 사이에 phase 를 바꿔도 이전 결과가 오염되지 않는다", () => {
    const input: ExportEntity[] = ["Person", "Assessment"];
    const inserted = orderImportRestoreEntities(input, "insert");
    orderImportRestoreEntities(input, "delete");
    expect(inserted).toEqual(["Person", "Assessment"]);
  });

  it("원소 방어 실패 시 앞쪽 유효 원소의 부분 결과를 돌려주지 않고 throw 한다", () => {
    let result: ExportEntity[] | undefined;
    expect(() => {
      result = callWithAny(["Person", "Group", 42], "insert");
    }).toThrow(RangeError);
    expect(result).toBeUndefined();
  });

  it("중복 + 부분 집합 + 역순이 섞인 조합도 상수 순서의 부분 수열이다", () => {
    const messy: ExportEntity[] = [
      "Assessment",
      "Person",
      "Assessment",
      "LlmConfig",
      "Person",
    ];
    const result = orderImportRestoreEntities(messy, "insert");
    expect(result).toEqual(["Person", "LlmConfig", "Assessment"]);

    const indexes = result.map((entity) =>
      IMPORT_RESTORE_INSERT_ORDER.indexOf(entity),
    );
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
  });
});
