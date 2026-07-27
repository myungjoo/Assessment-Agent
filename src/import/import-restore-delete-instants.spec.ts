// import-restore-delete-instants.spec — T-1271. R-112 4 종 (happy / error / 분기 / negative 충분
// cover) 을 신규 helper `collectImportRestoreDeleteInstants` 에 적용한다. 순수 helper 라 DB ·
// Prisma client · mock 0 이며, 반복 단언은 `it.each` 표로 눌러 diff 를 압축했다 (T-1270 reviewer
// MINOR-1 회수 — 표의 label 은 실패 시 어느 case 인지 보이도록 test 이름에 싣는다).
import type { ExportEntity, ExportRecord } from "../export/export-scope-select";

import { collectImportRestoreDeleteInstants } from "./import-restore-delete-instants";
import { groupImportRestoreOperations } from "./import-restore-ops";
import {
  planImportRestoreTransactionSteps,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

// 단일 fixture builder — instant 는 런타임 방어 검증을 위해 unknown 을 그대로 흘린다.
function rec(entity: ExportEntity, instant: unknown): ExportRecord {
  return { entity, instant } as ExportRecord;
}

// delete step 조립 helper — 기본은 Person 1 건.
function step(
  records: unknown[] = [rec("Person", new Date(1))],
  overrides: Record<string, unknown> = {},
): ImportRestoreTransactionStep {
  return {
    phase: "delete",
    entity: "Person",
    delegate: "person",
    model: "Person",
    method: "deleteMany",
    records,
    ...overrides,
  } as unknown as ImportRestoreTransactionStep;
}

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 호출 helper 3 종.
function callWithAny(value: unknown): Date[] {
  return collectImportRestoreDeleteInstants(
    value as ImportRestoreTransactionStep,
  );
}
const withRecords = (records: unknown): Date[] =>
  callWithAny(step(undefined, { records }));
const withInstant = (instant: unknown): Date[] =>
  callWithAny(step([rec("Person", instant)]));
const withEntity = (entity: unknown): Date[] =>
  callWithAny(step([{ entity, instant: new Date(1) }]));
const dateLike = { getTime: () => 1 };
const insertStep = step(undefined, { phase: "insert", method: "createMany" });
const mixedStep = step([rec("Person", new Date(1)), rec("Group", new Date(2))]);

describe("collectImportRestoreDeleteInstants — happy path", () => {
  it("중복 instant 를 첫 등장 1 건만 남기고 순서 · identity 를 보존한다", () => {
    const first = new Date("2026-02-02T00:00:00.000Z");
    const second = new Date("2026-01-01T00:00:00.000Z");

    const instants = collectImportRestoreDeleteInstants(
      step([
        rec("Person", first),
        rec("Person", second),
        rec("Person", new Date(first.getTime())),
      ]),
    );

    // 정렬 0 — 입력 순서 그대로이며 원소는 입력 Date instance 자체다 (복제 0).
    expect(instants).toHaveLength(2);
    expect(instants[0]).toBe(first);
    expect(instants[1]).toBe(second);
  });

  it("chain 합성 — plan 의 toDelete 가 delete step 을 거쳐 본 helper 까지 실려 나온다", () => {
    const personAt = new Date("2026-03-03T04:05:06.000Z");
    const groupAt = new Date("2026-04-04T04:05:06.000Z");

    const steps = planImportRestoreTransactionSteps(
      groupImportRestoreOperations({
        toDelete: [rec("Person", personAt), rec("Group", groupAt)],
        toInsert: [],
        toKeep: [],
      }),
    );

    // delete 그룹은 insert 역순 (Group 이 Person 앞) — chain 산출 순서까지 그대로 검증한다.
    expect(
      steps.map((each) => [
        each.entity,
        collectImportRestoreDeleteInstants(each),
      ]),
    ).toEqual([
      ["Group", [groupAt]],
      ["Person", [personAt]],
    ]);
  });
});

describe("collectImportRestoreDeleteInstants — 분기 cover", () => {
  it.each([
    ["phase 거부 (insert 는 T-1270 책임)", insertStep, RangeError],
    ["method 거부", step(undefined, { method: "createMany" }), RangeError],
    ["빈 records 거부 (빈 목록 미생성)", step([]), RangeError],
    ["entity 불일치 거부", mixedStep, RangeError],
    ["instant 비-Date 거부", step([rec("Person", "2026-01-01")]), TypeError],
  ])("%s", (_label, input, expected) => {
    expect(() => collectImportRestoreDeleteInstants(input)).toThrow(expected);
  });

  // 정상 조립의 세 갈래 — 중복 없음 / 일부 중복 / (d) 전 원소가 같은 millis.
  it.each([
    ["중복 없음", [1, 2, 3], [1, 2, 3]],
    ["일부 중복", [1, 2, 1], [1, 2]],
    ["전 원소가 같은 millis", [5, 5, 5], [5]],
  ])("%s", (_label, input, expected) => {
    const instants = collectImportRestoreDeleteInstants(
      step(input.map((millis) => rec("Person", new Date(millis)))),
    );

    expect(instants.map((each) => each.getTime())).toEqual(expected);
  });
});

describe("collectImportRestoreDeleteInstants — error path · negative cases", () => {
  // 예외 분기마다 1 행 — (a) instant 자리 6 종 · (b) record 원소 · (c) entity 3 종 + step/records
  // shape. label 이 test 이름에 실려 실패 시 어느 행인지 바로 보인다.
  it.each([
    ["step 이 null", () => callWithAny(null), TypeError],
    ["step 이 undefined", () => callWithAny(undefined), TypeError],
    ["step 이 원시값", () => callWithAny(7), TypeError],
    ["step 이 배열", () => callWithAny([step()]), TypeError],
    ["records 가 undefined", () => withRecords(undefined), TypeError],
    ["records 가 null", () => withRecords(null), TypeError],
    ["records 가 객체", () => withRecords({ 0: 1 }), TypeError],
    ["records 원소가 null", () => callWithAny(step([null])), TypeError],
    ["records 원소가 원시값", () => callWithAny(step([7])), TypeError],
    ["instant 이 undefined", () => withInstant(undefined), TypeError],
    ["instant 이 null", () => withInstant(null), TypeError],
    ["instant 이 문자열", () => withInstant("2026-01-01"), TypeError],
    ["instant 이 number(millis)", () => withInstant(1767225600000), TypeError],
    ["instant 이 Invalid Date", () => withInstant(new Date("x")), TypeError],
    ["instant 이 Date-like 객체", () => withInstant(dateLike), TypeError],
    ["entity 가 다른 유효 entity", () => withEntity("Group"), RangeError],
    ["entity 가 비-string", () => withEntity(7), RangeError],
    ["entity 가 null", () => withEntity(null), RangeError],
    ["entity 가 미지 literal", () => withEntity("Nope"), RangeError],
  ])("%s 면 거부한다", (_label, call, expected) => {
    expect(call).toThrow(expected);
  });

  it("첫 위반 이전 원소의 결과를 돌려주지 않는다 (부분 결과 0)", () => {
    const valid = new Date(1);
    const records = [rec("Person", valid), rec("Person", "깨진 값")];

    expect(() => callWithAny(step(records))).toThrow(TypeError);
    expect(records[0].instant).toBe(valid);
  });

  it("REQ-032 — error 메시지에 instant 값 · record 원본을 싣지 않는다", () => {
    const secret = "SECRET-2026-01-01T00:00:00.000Z";
    const call = (): Date[] => withInstant(secret);

    expect(call).toThrow(/instant 는 유효한 Date 여야 합니다 \(string\)/);
    expect(call).not.toThrow(new RegExp(secret));
  });

  // (e) freeze 된 입력 + 비변형, (f) idempotent, (g) 반환 배열 변형 격리.
  it("freeze 된 입력도 통과하고 2 회 호출이 동일 결과이며 반환 배열은 격리된다", () => {
    const only = Object.freeze(new Date(9));
    const records = Object.freeze([Object.freeze(rec("Person", only))]);
    const frozen = Object.freeze(step(records as unknown as unknown[]));

    const first = collectImportRestoreDeleteInstants(frozen);
    const second = collectImportRestoreDeleteInstants(frozen);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.push(new Date(100));
    expect(records).toHaveLength(1);
    expect(collectImportRestoreDeleteInstants(frozen)).toEqual([only]);
  });
});
