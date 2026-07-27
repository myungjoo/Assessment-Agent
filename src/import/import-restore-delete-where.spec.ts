// import-restore-delete-where.spec — T-1272. R-112 4 종 (happy / error / 분기 / negative 충분 cover)
// 을 신규 helper `buildImportRestoreDeleteWhere` 에 적용한다. 순수 helper 라 DB · Prisma · mock 0
// 이며, fixture 는 단일 builder · 반복 단언은 `it.each` 표 (label 을 test 이름에 실어 압축).
import { EXPORT_ENTITY_SOURCES } from "../export/export-entity-sources";
import type { ExportEntity, ExportRecord } from "../export/export-scope-select";

import { buildImportRestoreDeleteWhere } from "./import-restore-delete-where";
import { groupImportRestoreOperations } from "./import-restore-ops";
import {
  planImportRestoreTransactionSteps,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

type Where = Record<string, { in: Date[] }>;
// 단일 fixture builder — entity / instant 는 런타임 방어 검증을 위해 unknown 을 그대로 흘린다.
function rec(entity: unknown, instant: unknown): ExportRecord {
  return { entity, instant } as ExportRecord;
}

// delete step 조립 helper — 기본은 Person 1 건 (본 helper 는 delegate / model 을 읽지 않는다).
function step(
  records: unknown[] = [rec("Person", new Date(1))],
  overrides: Record<string, unknown> = {},
): ImportRestoreTransactionStep {
  return {
    phase: "delete",
    entity: "Person",
    method: "deleteMany",
    records,
    ...overrides,
  } as unknown as ImportRestoreTransactionStep;
}

// 타입 우회 호출 helper 2 종 — `withEntity` 는 record.entity 를 step.entity 와 같게 맞춰 2a 검증을
// 통과시킨 뒤 본 helper 의 entity 판정만 남긴다.
const callWithAny = (value: unknown): Where =>
  buildImportRestoreDeleteWhere(value as ImportRestoreTransactionStep);
const withEntity = (entity: unknown): Where =>
  callWithAny(step([rec(entity, new Date(1))], { entity }));

describe("buildImportRestoreDeleteWhere — happy path", () => {
  it("표의 instantColumn 을 key 로 삼고 목록의 개수 · 순서 · identity 를 보존한다", () => {
    const first = new Date("2026-02-02T00:00:00.000Z");
    const second = new Date("2026-01-01T00:00:00.000Z");
    const where = buildImportRestoreDeleteWhere(
      step([
        rec("Person", first),
        rec("Person", second),
        rec("Person", new Date(first.getTime())),
      ]),
    );
    // 중복 제거는 2a 몫 — 그 결과가 `in` 으로 그대로 (복제 0) 실렸는지만 본다.
    expect(Object.keys(where)).toEqual(["createdAt"]);
    expect(where.createdAt.in).toHaveLength(2);
    expect(where.createdAt.in[0]).toBe(first);
    expect(where.createdAt.in[1]).toBe(second);
  });

  it("chain 합성 — plan 의 delete step 이 실제로 본 helper 를 통과한다", () => {
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
      steps.map((each) => [each.entity, buildImportRestoreDeleteWhere(each)]),
    ).toEqual([
      ["Group", { createdAt: { in: [groupAt] } }],
      ["Person", { createdAt: { in: [personAt] } }],
    ]);
  });

  it.each(Object.keys(EXPORT_ENTITY_SOURCES) as ExportEntity[])(
    "%s 의 key 는 표의 instantColumn 과 일치한다 (하드코딩 0)",
    (entity) => {
      const column = EXPORT_ENTITY_SOURCES[entity].instantColumn;
      expect(Object.keys(withEntity(entity))).toEqual([column]);
    },
  );
});

describe("buildImportRestoreDeleteWhere — 분기 cover", () => {
  it.each([
    ["중복 없음", [1, 2, 3], [1, 2, 3]],
    ["일부 중복", [1, 2, 1], [1, 2]],
    ["(d) 전 원소가 같은 millis", [5, 5, 5], [5]],
  ])("정상 조립 — %s", (_label, input, expected) => {
    const where = buildImportRestoreDeleteWhere(
      step(input.map((millis) => rec("Person", new Date(millis)))),
    );
    // 빈 `in` 은 나올 수 없다 — 2a 가 빈 records 를 거부하므로 항상 1 건 이상.
    expect(where.createdAt.in.map((each) => each.getTime())).toEqual(expected);
    expect(where.createdAt.in.length).toBeGreaterThan(0);
  });

  // (a) entity 자리 5 종 + (b) prototype 속성 3 종 — 모두 본 helper 고유의 RangeError 이고 반환값
  // 자체가 없다. prototype 이 유효 entity 로 오탐되면 key 가 undefined 인 "전체 삭제" where 가 된다.
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["비-string", 7],
    ["소문자 오타", "person"],
    ["미지 literal", "Nope"],
    ["prototype 속성 constructor", "constructor"],
    ["prototype 속성 __proto__", "__proto__"],
    ["prototype 속성 toString", "toString"],
  ])("entity 가 %s 이면 where 를 만들지 않고 거부한다", (_label, entity) => {
    let where: Where | undefined;
    const call = (): void => {
      where = withEntity(entity);
    };
    expect(call).toThrow(RangeError);
    expect(call).toThrow(/^buildImportRestoreDeleteWhere: entity 는/);
    expect(where).toBeUndefined();
  });
});

describe("buildImportRestoreDeleteWhere — error path · negative cases", () => {
  // (c) 2a 계약 위반은 감싸지 않고 그대로 전파 — prefix 단언으로 재랩핑 회귀를 차단하고, 부분 결과
  // (key 만 있고 `in` 이 비거나 미완성인 객체) 가 돌아오는 경로가 없음을 함께 본다.
  it.each([
    ["step 이 null", null, TypeError],
    ["step 이 undefined", undefined, TypeError],
    ["step 이 원시값", 7, TypeError],
    ["step 이 배열", [step()], TypeError],
    ["phase 위반 (insert)", step(undefined, { phase: "insert" }), RangeError],
    ["method 위반", step(undefined, { method: "createMany" }), RangeError],
    ["빈 records", step([]), RangeError],
    ["record entity 불일치", step([rec("Group", new Date(1))]), RangeError],
    ["instant 가 비-Date", step([rec("Person", "2026-01-01")]), TypeError],
  ])("%s 이면 2a 의 throw 가 그대로 전파된다", (_label, input, expected) => {
    let where: Where | undefined;
    const call = (): void => {
      where = callWithAny(input);
    };
    expect(call).toThrow(expected);
    expect(call).toThrow(/^collectImportRestoreDeleteInstants: /);
    expect(where).toBeUndefined();
  });

  it("REQ-032 — error 메시지에 record 원본 · instant 값을 싣지 않는다", () => {
    const secret = "SECRET-2026-01-01T00:00:00.000Z";
    const call = (): Where => withEntity({ secret } as unknown);
    // 비-string entity 는 타입 이름만 (`object`) 노출한다.
    expect(call).toThrow(/\(받음: object\)$/);
    expect(call).not.toThrow(new RegExp(secret));
  });

  // (e) freeze 된 입력 통과 + 비변형, (f) idempotent, (g) 반환값 변형 격리.
  it("freeze 된 입력도 통과하고 2 회 호출이 동일 결과이며 반환값은 격리된다", () => {
    const only = Object.freeze(new Date(9));
    const records = Object.freeze([Object.freeze(rec("Person", only))]);
    const frozen = Object.freeze(step(records as unknown as unknown[]));
    const first = buildImportRestoreDeleteWhere(frozen);
    const second = buildImportRestoreDeleteWhere(frozen);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.createdAt.in).not.toBe(second.createdAt.in);
    first.createdAt.in.push(new Date(100));
    first.createdAt = { in: [] };
    expect(records).toHaveLength(1);
    expect(EXPORT_ENTITY_SOURCES.Person.instantColumn).toBe("createdAt");
    expect(buildImportRestoreDeleteWhere(frozen).createdAt.in).toEqual([only]);
  });
});
