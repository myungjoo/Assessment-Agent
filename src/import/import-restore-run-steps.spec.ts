// import-restore-run-steps.spec — T-1274. R-112 4 종 (happy / error / 분기 / negative 충분 cover)
// 을 신규 runner `runImportRestoreSteps` 에 적용한다. DB · PrismaService 0 — 호출 로그를 남기는
// mock tx factory 1 개로 검증하고 반복 단언은 `it.each` 표로 압축한다.
import { EXPORT_ENTITY_SOURCES } from "../export/export-entity-sources";
import type { ExportEntity, ExportRecord } from "../export/export-scope-select";

import { groupImportRestoreOperations } from "./import-restore-ops";
import {
  runImportRestoreSteps,
  type ImportRestoreStepOutcome,
  type ImportRestoreTxClient,
} from "./import-restore-run-steps";
import {
  planImportRestoreTransactionSteps,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

type Ctor = new (message?: string) => Error;
type Obj = Record<string, unknown>;
type Step = ImportRestoreTransactionStep;
const AT = Object.freeze(new Date("2026-05-05T06:07:08.000Z"));
const OWN = /^runImportRestoreSteps: /;
const TX_MSG = /^runImportRestoreSteps: tx 는 객체여야/;
const STEPS_MSG = /^runImportRestoreSteps: steps 는 배열이어야/;
const BAD_COUNT = /deleteMany \(steps\[0\]\) — 반환 count 는 number/;
const NO_DELEGATE = /createMany \(steps\[1\]\) — delegate 가 객체가/;
const NO_METHOD = /createMany \(steps\[1\]\) — method 가 함수가/;
const CALL_THROW = /^buildImportRestoreStepCall: /;
const DEL_THROW = /^collectImportRestoreDeleteInstants: /;
const INS_THROW = /^buildImportRestoreInsertRows: /;
const KEYS = ["entity", "phase", "delegate", "method", "count"];
const ORDER =
  "person.deleteMany group.deleteMany person.createMany group.createMany";
const SEQ =
  "Person|delete|person|deleteMany|1 Group|delete|group|deleteMany|2 " +
  "Person|insert|person|createMany|3 Group|insert|group|createMany|4";
// record / step fixture — 런타임 방어 검증을 위해 unknown 을 그대로 흘린다 (T-1273 spec 동형).
const rec = (e: unknown, i: unknown, f: unknown = { id: "r1" }) =>
  ({ entity: e, instant: i, fields: f }) as unknown as ExportRecord;
const step = (over: Obj) =>
  ({ entity: "Person", delegate: "person", ...over }) as unknown as Step;
const del = (records: unknown[] = [rec("Person", AT)], over: Obj = {}) =>
  step({ phase: "delete", method: "deleteMany", records, ...over });
const ins = (records: unknown[] = [rec("Person", AT)], over: Obj = {}) =>
  step({ phase: "insert", method: "createMany", records, ...over });
const group = { entity: "Group", delegate: "group" };
const froze = <T>(v: T[]) =>
  Object.freeze(v.map((e) => Object.freeze(e))) as unknown as T[];
const shape = (o: ImportRestoreStepOutcome) =>
  `${o.entity}|${o.phase}|${o.delegate}|${o.method}|${o.count}`;
// mock tx — 5 delegate × 2 method 를 호출 로그로 감싼 단일 factory. 기본 응답의 `count` 가 누적
// 호출 수라 outcome 만 봐도 순서가 드러난다 (`reply` 로 비정상 반환 · reject 주입).
function makeTx(reply?: (key: string, args: unknown) => unknown) {
  const calls: string[] = [];
  const args: unknown[] = [];
  const table: Obj = {};
  for (const { delegate } of Object.values(EXPORT_ENTITY_SOURCES)) {
    const make = (method: string) => (received: unknown) => {
      const key = `${delegate}.${method}`;
      calls.push(key);
      args.push(received);
      return reply ? reply(key, received) : { count: calls.length };
    };
    const deleteMany = make("deleteMany");
    table[delegate] = { deleteMany, createMany: make("createMany") };
  }
  return { tx: table as unknown as ImportRestoreTxClient, table, calls, args };
}
// 거부 단언 helper — throw 종류 · 메시지를 함께 본다. 하류 prefix 단언이 곧 "재랩핑하지 않았다"
// 의 증거다 (본 runner 가 만든 메시지만 `runImportRestoreSteps:` 로 시작한다).
const cast = (v: unknown) => v as Step[];
const rejects = async (tx: unknown, steps: unknown, c: Ctor, m: RegExp) => {
  const run = runImportRestoreSteps(tx as ImportRestoreTxClient, cast(steps));
  const error = (await run.catch((e: unknown) => e)) as Error;
  expect(error).toBeInstanceOf(c);
  expect(error.message).toMatch(m);
  return error;
};

describe("runImportRestoreSteps — happy path", () => {
  // freeze 된 steps / step / records / Date / tx 로 호출해도 통과하고 입력은 오염되지 않는다 (f)(g).
  it("delete 2 + insert 2 를 순서대로 부르고 outcome 을 채우며 입력은 불변", async () => {
    const rows = [{ id: "p1" }, { id: "g1" }];
    const steps = froze([
      del(froze([rec("Person", AT)])),
      del(froze([rec("Group", AT)]), group),
      ins(froze([rec("Person", AT, Object.freeze(rows[0]))])),
      ins(froze([rec("Group", AT, Object.freeze(rows[1]))]), group),
    ]);
    const { tx, calls, args } = makeTx();
    const outcomes = await runImportRestoreSteps(Object.freeze(tx), steps);
    expect(calls.join(" ")).toBe(ORDER);
    expect(args[0]).toEqual({ where: { createdAt: { in: [AT] } } });
    expect(args[3]).toEqual({ data: [{ id: "g1" }] });
    expect(Object.keys(outcomes[0])).toEqual(KEYS);
    expect(outcomes.map(shape).join(" ")).toBe(SEQ);
    // 반환 배열 · 원소를 흔들어도 입력 step 은 그대로라 재호출 결과가 같다 (배열 instance 는 다름).
    outcomes[0].count = 99;
    outcomes.pop();
    const again = await runImportRestoreSteps(makeTx().tx, steps);
    expect(again).not.toBe(outcomes);
    expect(again.map(shape).join(" ")).toBe(SEQ);
    expect(rows[0]).toEqual({ id: "p1" });
  });
  it("chain 합성 — group → plan → run 이 실 step 으로 통과한다", async () => {
    const steps = planImportRestoreTransactionSteps(
      groupImportRestoreOperations({
        toDelete: [rec("Person", AT)],
        toInsert: [rec("Group", AT, { id: "g1" })],
        toKeep: [],
      }),
    );
    const { tx, calls } = makeTx();
    const outcomes = await runImportRestoreSteps(tx, steps);
    expect(calls.join(" ")).toBe("person.deleteMany group.createMany");
    expect(outcomes.map(shape).join(" ")).toBe(
      "Person|delete|person|deleteMany|1 Group|insert|group|createMany|2",
    );
  });
  it("빈 배열은 tx 호출 0 회 + [] 반환", async () => {
    const { tx, calls } = makeTx();
    await expect(runImportRestoreSteps(tx, [])).resolves.toEqual([]);
    expect(calls).toEqual([]);
  });
  const entities = Object.keys(EXPORT_ENTITY_SOURCES) as ExportEntity[];
  it.each(entities)("%s 는 표의 delegate key 로 인덱싱", async (entity) => {
    const { delegate } = EXPORT_ENTITY_SOURCES[entity];
    const { tx, calls } = makeTx();
    const done = await runImportRestoreSteps(tx, [
      ins([rec(entity, AT)], { entity, delegate }),
    ]);
    expect(calls).toEqual([`${delegate}.createMany`]);
    expect(done[0]).toMatchObject({ entity, delegate, count: 1 });
  });
});

describe("runImportRestoreSteps — error path · 분기 cover", () => {
  // (a) tx 가 객체가 아니면 어떤 delegate 도 부르기 전에 거부 + 값 비노출 (REQ-032).
  it.each([undefined, null, 7, "leak-me"])("tx=%p 거부", async (bad) => {
    const error = await rejects(bad, [del()], TypeError, TX_MSG);
    expect(error.message).toMatch(/받음: (undefined|null|number|string)\)$/);
    expect(error.message).not.toMatch(/leak-me/);
  });
  // steps 가 배열이 아니면 tx 가 멀쩡해도 호출 0.
  it.each([null, undefined, {}, "s"])("steps=%p 거부", async (bad) => {
    const { tx, calls } = makeTx();
    await rejects(tx, bad, TypeError, STEPS_MSG);
    expect(calls).toEqual([]);
  });
  // (b) tx surface 결함 — 첫 step (group.deleteMany) 은 이미 불렸고 그 뒤에서만 거부된다.
  const TWO = [del([rec("Group", AT)], group), ins()];
  const px = (t: Obj) => t.person as Obj;
  it.each([
    ["delegate 삭제", (t: Obj) => delete t.person, NO_DELEGATE],
    ["delegate null", (t: Obj) => void (t.person = null), NO_DELEGATE],
    ["delegate 원시값", (t: Obj) => void (t.person = 7), NO_DELEGATE],
    ["method 삭제", (t: Obj) => delete px(t).createMany, NO_METHOD],
    ["method 비-함수", (t: Obj) => void (px(t).createMany = 1), NO_METHOD],
  ])("%s 이면 이전 호출만 일어난다", async (_l, breakTx, m) => {
    const { tx, table, calls } = makeTx();
    breakTx(table);
    const error = await rejects(tx, TWO, TypeError, m);
    expect(error.message).toMatch(OWN);
    expect(calls).toEqual(["group.deleteMany"]);
  });
  // (c) count 계약 — 조용히 0 으로 대체하면 미복원이 성공으로 보고된다 + 값 비노출 (REQ-032).
  const returns = [undefined, null, {}, { count: "leak-me" }];
  it.each(returns)("반환 %p 거부", async (value) => {
    const { tx, calls } = makeTx(() => value);
    const error = await rejects(tx, [del()], TypeError, BAD_COUNT);
    expect(error.message).toMatch(/받음: (undefined|string)\)$/);
    expect(error.message).not.toMatch(/leak-me/);
    expect(calls).toEqual(["person.deleteMany"]);
  });
});

describe("runImportRestoreSteps — negative cases", () => {
  // (d) 하류 계약 위반은 감싸지 않고 그대로 전파 — tx 는 한 번도 불리지 않는다.
  const bads: [string, Step, Ctor, RegExp][] = [
    ["무효 phase", step({ phase: "upsert" }), RangeError, CALL_THROW],
    ["무효 entity", del(undefined, { entity: "N" }), RangeError, CALL_THROW],
    ["drift", del(undefined, { delegate: "g" }), RangeError, CALL_THROW],
    ["빈 records", del([]), RangeError, DEL_THROW],
    ["비-Date instant", del([rec("Person", "x")]), TypeError, DEL_THROW],
    ["fields 위반", ins([rec("Person", AT, [1])]), TypeError, INS_THROW],
  ];
  it.each(bads)("%s 는 그대로 전파 + tx 호출 0", async (_l, bad, c, m) => {
    const { tx, calls } = makeTx();
    const error = await rejects(tx, [bad], c, m);
    expect(error.message).not.toMatch(OWN);
    expect(calls).toEqual([]);
  });
  // (e) fail-fast — 중간 reject 뒤로 호출이 없고 되돌리기 (보상 delete) 도 시도하지 않는다.
  it("중간 step 이 reject 하면 이후 호출 0 · 되돌리기 0", async () => {
    const boom = new Error("delegate 실패");
    const { tx, calls } = makeTx((key) =>
      key === "person.createMany" ? Promise.reject(boom) : { count: 1 },
    );
    const steps = [del(), ins(), ins([rec("Group", AT)], group)];
    await expect(runImportRestoreSteps(tx, steps)).rejects.toBe(boom);
    expect(calls.join(" ")).toBe("person.deleteMany person.createMany");
  });
});
