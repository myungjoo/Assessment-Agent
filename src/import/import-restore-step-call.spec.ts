// import-restore-step-call.spec — T-1273. R-112 4 종 (happy / error / 분기 / negative 충분 cover) 을
// 신규 helper `buildImportRestoreStepCall` 에 적용한다. 순수 helper 라 DB · Prisma · mock 0 이며,
// fixture 는 step 1 builder · 반복 단언은 `it.each` 표 (label 을 test 이름에 실어 압축).
import { EXPORT_ENTITY_SOURCES } from "../export/export-entity-sources";
import type { ExportEntity, ExportRecord } from "../export/export-scope-select";

import { groupImportRestoreOperations } from "./import-restore-ops";
import {
  buildImportRestoreStepCall,
  type ImportRestoreStepCall,
} from "./import-restore-step-call";
import {
  planImportRestoreTransactionSteps,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

type Ctor = new (message?: string) => Error;
const AT = new Date(1);
const PHASE = /^buildImportRestoreStepCall: step\.phase 는/;
const ENTITY = /^buildImportRestoreStepCall: entity 는/;
const DRIFT = /^buildImportRestoreStepCall: step\.delegate 가/;
// entity 자리 negative 값 — undefined · 비-string · 소문자 오타 · 미지 literal + prototype 속성 3 종.
const BAD_ENTITIES: unknown[] = [undefined, 7, "person", "Nope"];
const PROTO_KEYS = ["constructor", "__proto__", "toString"];
const DEL_THROW = /^collectImportRestoreDeleteInstants: /;
const INS_THROW = /^buildImportRestoreInsertRows: /;
// (b) entity 표 × 두 phase — 두 갈래 모두에서 같은 그물이 걸리는지 본다.
const ENTITY_CASES = (["delete", "insert"] as const).flatMap((phase) =>
  [...BAD_ENTITIES, ...PROTO_KEYS].map((entity) => [phase, entity] as const),
);

const whereOf = (call: ImportRestoreStepCall): Record<string, { in: Date[] }> =>
  (call.args as { where: Record<string, { in: Date[] }> }).where;
const dataOf = (call: ImportRestoreStepCall): Record<string, unknown>[] =>
  (call.args as { data: Record<string, unknown>[] }).data;

// record / step fixture — 런타임 방어 검증을 위해 unknown 을 그대로 흘린다 (`del` / `ins` 는 갈래별).
const rec = (
  entity: unknown,
  instant: unknown,
  fields: unknown = { id: "r1" },
): ExportRecord => ({ entity, instant, fields }) as unknown as ExportRecord;
type Over = Record<string, unknown>;
const step = (over: Over): ImportRestoreTransactionStep =>
  ({
    entity: "Person",
    delegate: "person",
    ...over,
  }) as unknown as ImportRestoreTransactionStep;
const del = (records: unknown[] = [rec("Person", AT)], over: Over = {}) =>
  step({ phase: "delete", method: "deleteMany", records, ...over });
const ins = (records: unknown[] = [rec("Person", AT)], over: Over = {}) =>
  step({ phase: "insert", method: "createMany", records, ...over });

// 함정 step — 하류 builder 가 반드시 읽는 `records` 를 throw 하는 getter 로 바꾼다. 본 helper 의
// 판정이 먼저 걸리면 getter 가 실행되지 않으므로 spy 없이 "builder 미호출" 을 단언할 수 있다.
const trap = (over: Over): ImportRestoreTransactionStep =>
  Object.defineProperty(step(over), "records", {
    get: (): never => {
      throw new Error("하류 builder 가 호출되었습니다");
    },
  }) as unknown as ImportRestoreTransactionStep;

// 거부 단언 helper — throw 종류 · 메시지 prefix 를 보고 **부분 결과가 없음** 까지 함께 단언한다.
function expectRejected(input: unknown, ctor: Ctor, prefix: RegExp): void {
  let call: ImportRestoreStepCall | undefined;
  const run = (): void => {
    call = buildImportRestoreStepCall(input as ImportRestoreTransactionStep);
  };
  expect(run).toThrow(ctor);
  expect(run).toThrow(prefix);
  expect(call).toBeUndefined();
}

describe("buildImportRestoreStepCall — happy path", () => {
  it("두 갈래 모두 표의 delegate + 위임 산출값으로 서술을 만든다", () => {
    const at = new Date("2026-02-02T00:00:00.000Z");
    const fields = { id: "p1", name: "홍길동" };
    const call = buildImportRestoreStepCall(del([rec("Person", at)]));
    expect(call.delegate).toBe("person");
    expect(call.method).toBe("deleteMany");
    expect(whereOf(call)).toEqual({ createdAt: { in: [at] } });
    expect(whereOf(call).createdAt.in[0]).toBe(at); // Date 는 입력 instance 그대로
    const row = buildImportRestoreStepCall(ins([rec("Person", at, fields)]));
    expect(row.delegate).toBe("person");
    expect(row.method).toBe("createMany");
    expect(dataOf(row)).toEqual([fields]);
    expect(dataOf(row)[0]).not.toBe(fields);
  });

  it("chain 합성 — plan 의 delete · insert step 이 모두 통과하고 drift 는 발동하지 않는다", () => {
    const at = new Date("2026-03-03T04:05:06.000Z");
    const calls = planImportRestoreTransactionSteps(
      groupImportRestoreOperations({
        toDelete: [rec("Person", at)],
        toInsert: [rec("Group", at, { id: "g1" })],
        toKeep: [],
      }),
    ).map((each) => buildImportRestoreStepCall(each));
    const shape = calls.map((each) => `${each.delegate}.${each.method}`);
    expect(shape).toEqual(["person.deleteMany", "group.createMany"]);
    expect(whereOf(calls[0]).createdAt.in).toEqual([at]);
    expect(dataOf(calls[1])).toEqual([{ id: "g1" }]);
  });

  const entities = Object.keys(EXPORT_ENTITY_SOURCES) as ExportEntity[];
  it.each(entities)("%s 의 delegate 는 표 값", (entity) => {
    const input = del([rec(entity, AT)], { entity, delegate: undefined });
    const source = EXPORT_ENTITY_SOURCES[entity];
    expect(buildImportRestoreStepCall(input).delegate).toBe(source.delegate);
  });
});

describe("buildImportRestoreStepCall — 분기 cover · error path", () => {
  // (a) phase 5 종 + step shape 4 종 — **어느 builder 도 부르기 전에** 거부 (함정 getter 미발동이 증거).
  it.each([
    ["phase 가 undefined", trap({})],
    ["phase 가 null", trap({ phase: null })],
    ["phase 가 비-string", trap({ phase: 7 })],
    ["phase 가 대문자 DELETE", trap({ phase: "DELETE" })],
    ["phase 가 미지 literal", trap({ phase: "upsert" })],
    ["step 이 null", null],
    ["step 이 undefined", undefined],
    ["step 이 원시값", 7],
    ["step 이 배열", [del()]],
  ])("%s 이면 phase 판정이 먼저 거부한다", (_label, input) => {
    expectRejected(input, RangeError, PHASE);
  });

  // (b) prototype 속성이 오탐되면 delegate 가 undefined 인 서술이 3b 로 흘러간다.
  it.each(ENTITY_CASES)("phase=%s · entity=%s 는 거부", (phase, entity) => {
    expectRejected(trap({ phase, entity }), RangeError, ENTITY);
  });

  // (c) drift — 표 값으로 조용히 덮지 않고 손조립 step 의 매핑 오류를 알리기만 한다.
  it.each(["assessment", "people", 7, null])("delegate %s 거부", (delegate) => {
    expectRejected(trap({ phase: "delete", delegate }), RangeError, DRIFT);
  });
});

describe("buildImportRestoreStepCall — negative cases", () => {
  // (d) 하류 계약 위반은 그대로 전파 — prefix 단언이 곧 "재랩핑하지 않았다" 의 증거다.
  const downstream: [string, ImportRestoreTransactionStep, Ctor][] = [
    ["delete · 빈 records", del([]), RangeError],
    ["delete · entity 불일치", del([rec("Group", AT)]), RangeError],
    ["delete · 비-Date instant", del([rec("Person", "x")]), TypeError],
    ["delete · method 위반", del(undefined, { method: "x" }), RangeError],
    ["insert · 빈 records", ins([]), RangeError],
    ["insert · fields 가 배열", ins([rec("Person", AT, [1])]), TypeError],
  ];
  it.each(downstream)("%s 전파", (label, input, ctor) => {
    const prefix = label.startsWith("delete") ? DEL_THROW : INS_THROW;
    expectRejected(input, ctor, prefix);
  });

  // (e)(f)(g) freeze 통과 · idempotent · 반환값 변형 격리 — 두 갈래 모두 한 test 로 압축한다.
  it("freeze 된 입력도 통과하고 2 회 결과가 같으며 반환값 변형이 격리된다", () => {
    const at = Object.freeze(new Date(9));
    const fields = Object.freeze({ id: "p1" });
    const records = Object.freeze([Object.freeze(rec("Person", at, fields))]);
    const frozen = Object.freeze(del(records as unknown as unknown[]));
    const frozenIns = Object.freeze(ins(records as unknown as unknown[]));
    const first = buildImportRestoreStepCall(frozen);
    const second = buildImportRestoreStepCall(frozen);
    const row = buildImportRestoreStepCall(frozenIns);
    expect(first).toEqual(second);
    expect(first.args).not.toBe(second.args);
    expect(whereOf(first).createdAt.in[0]).toBe(at);
    expect(dataOf(row)).toEqual([{ id: "p1" }]);
    // 반환값을 어떻게 흔들어도 입력 records · fields · 표는 그대로다 (재호출로 실증).
    whereOf(first).createdAt.in.push(new Date(100));
    dataOf(row)[0].id = "변조";
    expect(records).toHaveLength(1);
    expect(fields).toEqual({ id: "p1" });
    expect(EXPORT_ENTITY_SOURCES.Person.delegate).toBe("person");
    expect(buildImportRestoreStepCall(frozen)).toEqual(second);
    expect(dataOf(buildImportRestoreStepCall(frozenIns))[0].id).toBe("p1");
  });

  it("REQ-032 — payload 자리 값이 error 메시지에 실리지 않는다", () => {
    const leak = /leak-me/;
    const run = (): ImportRestoreStepCall =>
      buildImportRestoreStepCall(trap({ phase: "delete", entity: { leak } }));
    // 비-string entity 는 타입 이름만 (`object`) 노출한다.
    expect(run).toThrow(/\(받음: object\)$/);
    expect(run).not.toThrow(leak);
    const insertRun = (): ImportRestoreStepCall =>
      buildImportRestoreStepCall(ins([rec("Person", AT, "leak-me")]));
    expect(insertRun).toThrow(INS_THROW);
    expect(insertRun).not.toThrow(leak);
  });
});
