// import-restore-steps.spec — T-1264. R-112 4 종 (happy / error / 분기 / negative 충분 cover) 을
// 신규 helper 3 심볼 (`ImportRestoreStepMethod` · `ImportRestoreTransactionStep` 타입 +
// `planImportRestoreTransactionSteps`) 에 대해 모두 커버한다. 순수 helper 라 DB · Prisma client ·
// fixture 0 — plain 배열만으로 단언한다.
//
// delegate / model 기대값은 하드코딩하지 않고 `EXPORT_ENTITY_SOURCES` (T-1263) 에서 파생한 값으로도
// 함께 단언한다 — 매핑이 바뀌면 두 module 이 함께 움직여야 함을 고정하기 위함 (표 drift 감시).
import {
  EXPORT_ENTITY_SOURCES,
  type ExportEntitySource,
} from "../export/export-entity-sources";
import {
  type ExportEntity,
  type ExportRecord,
} from "../export/export-scope-select";

import { type ImportRestoreOperation } from "./import-restore-ops";
import {
  IMPORT_RESTORE_INSERT_ORDER,
  type ImportRestorePhase,
} from "./import-restore-order";
import {
  planImportRestoreTransactionSteps,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

// record 조립 helper — 본 helper 는 record 를 불투명하게 옮기기만 하므로 instant 는 식별용 눈금.
function rec(entity: ExportEntity, millis: number): ExportRecord {
  return { entity, instant: new Date(millis) };
}

// operation 조립 helper — records 는 기본 1 건 (빈 그룹은 계약 위반이므로).
function op(
  phase: ImportRestorePhase,
  entity: ExportEntity,
  records?: ExportRecord[],
): ImportRestoreOperation {
  return { phase, entity, records: records ?? [rec(entity, 1)] };
}

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 helper — 잘못된 입력을 그대로 전달한다.
function callWithAny(value: unknown): ImportRestoreTransactionStep[] {
  return planImportRestoreTransactionSteps(value as ImportRestoreOperation[]);
}

// (phase, entity, method) 3 축만 뽑아 순서를 단언하기 위한 축약.
function shapeOf(
  steps: ImportRestoreTransactionStep[],
): Array<[string, string, string]> {
  return steps.map((step) => [step.phase, step.entity, step.method]);
}

describe("planImportRestoreTransactionSteps — happy path", () => {
  it("delete 2 그룹 + insert 3 그룹 혼합 입력을 같은 개수 · 같은 순서의 step 으로 옮긴다", () => {
    const operations: ImportRestoreOperation[] = [
      op("delete", "Assessment"),
      op("delete", "Person"),
      op("insert", "Person"),
      op("insert", "LlmConfig"),
      op("insert", "Assessment"),
    ];

    const steps = planImportRestoreTransactionSteps(operations);

    expect(steps).toHaveLength(operations.length);
    expect(shapeOf(steps)).toEqual([
      ["delete", "Assessment", "deleteMany"],
      ["delete", "Person", "deleteMany"],
      ["insert", "Person", "createMany"],
      ["insert", "LlmConfig", "createMany"],
      ["insert", "Assessment", "createMany"],
    ]);
    expect(steps.map((step) => step.delegate)).toEqual([
      "assessment",
      "person",
      "person",
      "llmProviderConfig",
      "assessment",
    ]);
    expect(steps.map((step) => step.model)).toEqual([
      "Assessment",
      "Person",
      "Person",
      "LlmProviderConfig",
      "Assessment",
    ]);
  });

  it("records 는 입력 순서를 보존한 채 그대로 옮겨진다 (내용 불투명)", () => {
    const first = rec("Person", 10);
    const second = rec("Person", 20);
    const steps = planImportRestoreTransactionSteps([
      op("insert", "Person", [first, second]),
    ]);

    expect(steps[0].records).toEqual([first, second]);
    expect(steps[0].records[0]).toBe(first);
    expect(steps[0].records[1]).toBe(second);
  });

  it("5 entity × 2 phase 전 조합의 delegate · model 이 EXPORT_ENTITY_SOURCES 와 일치한다", () => {
    const phases: ImportRestorePhase[] = ["delete", "insert"];
    for (const phase of phases) {
      const operations = IMPORT_RESTORE_INSERT_ORDER.map((entity) =>
        op(phase, entity),
      );
      const steps = planImportRestoreTransactionSteps(operations);

      expect(steps).toHaveLength(IMPORT_RESTORE_INSERT_ORDER.length);
      steps.forEach((step, index) => {
        const entity = IMPORT_RESTORE_INSERT_ORDER[index];
        const source: ExportEntitySource = EXPORT_ENTITY_SOURCES[entity];
        expect(step.entity).toBe(entity);
        expect(step.delegate).toBe(source.delegate);
        expect(step.model).toBe(source.model);
        expect(step.method).toBe(
          phase === "delete" ? "deleteMany" : "createMany",
        );
      });
    }
  });

  it("빈 배열 입력 → 빈 배열 반환 (error 아님)", () => {
    expect(planImportRestoreTransactionSteps([])).toEqual([]);
  });

  it("호출마다 새 배열 · 새 step 객체를 돌려준다", () => {
    const operations = [op("delete", "Person")];
    const first = planImportRestoreTransactionSteps(operations);
    const second = planImportRestoreTransactionSteps(operations);

    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first).toEqual(second);
  });
});

describe("planImportRestoreTransactionSteps — 분기 cover", () => {
  it("phase delete 분기 → method deleteMany", () => {
    const steps = planImportRestoreTransactionSteps([op("delete", "Group")]);
    expect(steps[0].method).toBe("deleteMany");
  });

  it("phase insert 분기 → method createMany", () => {
    const steps = planImportRestoreTransactionSteps([op("insert", "Group")]);
    expect(steps[0].method).toBe("createMany");
  });

  it("순서 계약 정상 분기 (delete 전부 → insert 전부) → throw 0", () => {
    expect(() =>
      planImportRestoreTransactionSteps([
        op("delete", "Assessment"),
        op("delete", "Person"),
        op("insert", "Person"),
        op("insert", "Assessment"),
      ]),
    ).not.toThrow();
  });

  it("순서 계약 위반 분기 (insert 뒤 delete) → RangeError", () => {
    expect(() =>
      planImportRestoreTransactionSteps([
        op("insert", "Person"),
        op("delete", "Assessment"),
      ]),
    ).toThrow(RangeError);
  });
});

describe("planImportRestoreTransactionSteps — error path (입력 방어)", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["객체", { phase: "delete" }],
    ["문자열", "delete"],
    ["숫자", 7],
  ])("operations 가 배열 아님(%s) → TypeError", (_label, value) => {
    expect(() => callWithAny(value)).toThrow(TypeError);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "delete"],
    ["숫자", 1],
    ["boolean", true],
  ])("원소가 null / 원시값(%s) → TypeError", (_label, value) => {
    expect(() => callWithAny([value])).toThrow(TypeError);
  });

  it.each([
    ["오타", "deleet"],
    ["대문자", "DELETE"],
    ["빈 문자열", ""],
    ["비-string(숫자)", 0],
    ["비-string(null)", null],
    ["누락(undefined)", undefined],
  ])("phase 가 delete/insert 밖(%s) → RangeError", (_label, value) => {
    expect(() =>
      callWithAny([
        { phase: value, entity: "Person", records: [rec("Person", 1)] },
      ]),
    ).toThrow(RangeError);
  });

  it.each([
    ["오타", "Persons"],
    ["소문자", "person"],
    ["null", null],
    ["숫자", 3],
    ["객체", { entity: "Person" }],
    ["누락(undefined)", undefined],
  ])("entity 가 5 종 밖(%s) → RangeError", (_label, value) => {
    expect(() =>
      callWithAny([
        { phase: "delete", entity: value, records: [rec("Person", 1)] },
      ]),
    ).toThrow(RangeError);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["객체", {}],
    ["문자열", "record"],
    ["숫자", 2],
  ])("records 가 배열 아님(%s) → TypeError", (_label, value) => {
    expect(() =>
      callWithAny([{ phase: "insert", entity: "Person", records: value }]),
    ).toThrow(TypeError);
  });

  it("records 가 빈 배열 → RangeError (빈 그룹 미생성 계약 위반)", () => {
    expect(() =>
      planImportRestoreTransactionSteps([op("insert", "Person", [])]),
    ).toThrow(RangeError);
  });

  it("records 가 문자열이면 그 값이 error 메시지로 새지 않는다 (REQ-032)", () => {
    expect(() =>
      callWithAny([{ phase: "insert", entity: "Person", records: "leak-me" }]),
    ).toThrow(/받음: string/);
    try {
      callWithAny([{ phase: "insert", entity: "Person", records: "leak-me" }]);
      throw new Error("throw 하지 않았습니다");
    } catch (error) {
      expect((error as Error).message).not.toContain("leak-me");
    }
  });

  it("operations 자체가 문자열이면 그 값이 error 메시지로 새지 않는다 (REQ-032)", () => {
    expect(() => callWithAny("leak-me")).toThrow(/받음: string/);
    try {
      callWithAny("leak-me");
      throw new Error("throw 하지 않았습니다");
    } catch (error) {
      expect((error as Error).message).not.toContain("leak-me");
    }
  });

  it("error 메시지에 위반 index 가 담긴다", () => {
    expect(() =>
      callWithAny([
        op("delete", "Person"),
        { phase: "nope", entity: "Person" },
      ]),
    ).toThrow(/operations\[1\]/);
  });
});

describe("planImportRestoreTransactionSteps — negative cases", () => {
  it("(a) insert 뒤 delete 가 하나라도 있으면 RangeError 이며 메시지에 위반 index 포함", () => {
    const call = (): ImportRestoreTransactionStep[] =>
      planImportRestoreTransactionSteps([
        op("delete", "Assessment"),
        op("insert", "Person"),
        op("insert", "Assessment"),
        op("delete", "Group"),
      ]);

    expect(call).toThrow(RangeError);
    // 위반 delete 의 index(3) 와 처음 본 insert 의 index(1) 를 모두 알린다.
    expect(call).toThrow(/operations\[3\]/);
    expect(call).toThrow(/operations\[1\]/);
  });

  it("(b) delete 만 있는 배열은 정상 통과", () => {
    const steps = planImportRestoreTransactionSteps([
      op("delete", "Assessment"),
      op("delete", "Person"),
    ]);
    expect(steps.map((step) => step.method)).toEqual([
      "deleteMany",
      "deleteMany",
    ]);
  });

  it("(b) insert 만 있는 배열은 정상 통과", () => {
    const steps = planImportRestoreTransactionSteps([
      op("insert", "Person"),
      op("insert", "Assessment"),
    ]);
    expect(steps.map((step) => step.method)).toEqual([
      "createMany",
      "createMany",
    ]);
  });

  it("(c) entity 에 __proto__ / constructor 를 넣어도 상속 속성 오탐 없이 RangeError", () => {
    for (const bogus of [
      "__proto__",
      "constructor",
      "toString",
      "hasOwnProperty",
    ]) {
      expect(() =>
        callWithAny([
          { phase: "delete", entity: bogus, records: [rec("Person", 1)] },
        ]),
      ).toThrow(RangeError);
    }
  });

  it("(c) phase 에 __proto__ / constructor 를 넣어도 RangeError", () => {
    for (const bogus of ["__proto__", "constructor", "toString"]) {
      expect(() =>
        callWithAny([
          { phase: bogus, entity: "Person", records: [rec("Person", 1)] },
        ]),
      ).toThrow(RangeError);
    }
  });

  it("(d) freeze 된 입력(배열 · operation · records 모두)으로 호출해도 throw 0 이고 결과 동일", () => {
    const records = Object.freeze([rec("Person", 10), rec("Person", 20)]);
    const frozenOperation = Object.freeze({
      phase: "insert" as const,
      entity: "Person" as const,
      records: records as ExportRecord[],
    });
    const frozenInput = Object.freeze([
      frozenOperation,
    ]) as unknown as ImportRestoreOperation[];

    const steps = planImportRestoreTransactionSteps(frozenInput);

    expect(steps).toHaveLength(1);
    expect(shapeOf(steps)).toEqual([["insert", "Person", "createMany"]]);
    expect(steps[0].records).toEqual([...records]);
  });

  it("(e) 반환 step 의 records 를 push / 정렬해도 입력 operation 의 records 불변", () => {
    const original = [rec("Person", 30), rec("Person", 10)];
    const operation = op("insert", "Person", original);
    const snapshot = [...original];

    const steps = planImportRestoreTransactionSteps([operation]);
    steps[0].records.push(rec("Person", 99));
    steps[0].records.sort(
      (left, right) => left.instant.getTime() - right.instant.getTime(),
    );

    expect(operation.records).toHaveLength(snapshot.length);
    expect(operation.records).toEqual(snapshot);
    expect(original).toEqual(snapshot);
  });

  it("(f) 반환 step 의 delegate / model 을 바꿔도 EXPORT_ENTITY_SOURCES 원본 불변", () => {
    const steps = planImportRestoreTransactionSteps([
      op("insert", "LlmConfig"),
    ]);
    steps[0].delegate = "person";
    steps[0].model = "Bogus";

    expect(EXPORT_ENTITY_SOURCES.LlmConfig.delegate).toBe("llmProviderConfig");
    expect(EXPORT_ENTITY_SOURCES.LlmConfig.model).toBe("LlmProviderConfig");
    // 다음 호출 결과도 오염되지 않는다.
    const again = planImportRestoreTransactionSteps([
      op("insert", "LlmConfig"),
    ]);
    expect(again[0].delegate).toBe("llmProviderConfig");
    expect(again[0].model).toBe("LlmProviderConfig");
  });

  it("(g) error 메시지에 record payload · instant 값 · stack 이 실리지 않는다", () => {
    const secretInstant = new Date("2026-07-27T11:22:33.444Z");
    let message = "";
    try {
      callWithAny([
        {
          phase: "bogus",
          entity: "Person",
          records: [{ entity: "Person", instant: secretInstant }],
        },
      ]);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/operations\[0\]\.phase/);
    expect(message).toContain("bogus");
    expect(message).not.toContain("2026-07-27");
    expect(message).not.toContain("11:22:33");
    expect(message).not.toMatch(/instant/);
    expect(message).not.toMatch(/\[object/);
  });

  it("(g) 비-string 위반 값은 타입 이름만 노출한다", () => {
    let message = "";
    try {
      callWithAny([
        {
          phase: { evil: "payload" },
          entity: "Person",
          records: [rec("Person", 1)],
        },
      ]);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("object");
    expect(message).not.toContain("evil");
    expect(message).not.toContain("payload");
  });

  it("(h) 같은 entity 가 같은 phase 에 두 번 등장해도 step 2 개로 보존 (병합 · 중복 제거 0)", () => {
    const steps = planImportRestoreTransactionSteps([
      op("insert", "Person", [rec("Person", 1)]),
      op("insert", "Person", [rec("Person", 2), rec("Person", 3)]),
    ]);

    expect(steps).toHaveLength(2);
    expect(steps[0].records).toHaveLength(1);
    expect(steps[1].records).toHaveLength(2);
    expect(steps[0].entity).toBe("Person");
    expect(steps[1].entity).toBe("Person");
  });

  it("FK 안전 순서를 깨는 배열을 재정렬하지 않고 알리기만 한다", () => {
    const broken = [op("insert", "Person"), op("delete", "Assessment")];
    expect(() => planImportRestoreTransactionSteps(broken)).toThrow(RangeError);
    // 입력 배열 자체는 그대로 (재정렬 0).
    expect(
      broken.map((operation) => [operation.phase, operation.entity]),
    ).toEqual([
      ["insert", "Person"],
      ["delete", "Assessment"],
    ]);
  });
});
