// import-restore-transaction.service.spec — T-1275 (실행 배선) + T-1278 (Prisma error → HTTP
// exception 매핑 배선). R-112 4 종 (happy / error / 분기 / negative 충분 cover). 실 DB 0 —
// `$transaction` 콜백을 mock tx 로 실행하는 factory 1 개 + `it.each` 표.
import {
  BadRequestException,
  ConflictException,
  HttpException,
} from "@nestjs/common";

import { EXPORT_ENTITY_SOURCES } from "../export/export-entity-sources";
import type { FullExportRecord } from "../export/export-full-record";
import type { ImportRestorePlan } from "../export/import-restore-plan";
import type { PrismaService } from "../persistence/prisma.service";

import {
  IMPORT_RESTORE_TRANSACTION_OPTIONS,
  ImportRestoreTransactionService,
  type ImportRestoreTransactionResult,
} from "./import-restore-transaction.service";

type Obj = Record<string, unknown>;
type Ctor = new (message?: string) => Error;
type Plan = ImportRestorePlan<FullExportRecord>;
type Svc = ImportRestoreTransactionService;
const AT = Object.freeze(new Date("2026-06-06T07:08:09.000Z"));
const [TE, RE] = [TypeError, RangeError];
const GRP = /^groupImportRestoreOperations: /;
const RUN = /^runImportRestoreSteps: /;
const DEL = /^collectImportRestoreDeleteInstants: /;
const INS = /^buildImportRestoreInsertRows: /;
const [NODEL, NOFN] = [/delegate 가 객체가/, /method 가 함수가/];
// delete 는 insert 의 역순이라 Group 이 Person 보다 먼저 지워진다 (T-1261 FK 안전 순서).
const ORDER =
  "group.deleteMany person.deleteMany person.createMany group.createMany";
const SEQ =
  "Group|delete|group|deleteMany|1 Person|delete|person|deleteMany|2 " +
  "Person|insert|person|createMany|3 Group|insert|group|createMany|4";
// fixture — 런타임 방어 검증을 위해 unknown 을 그대로 흘린다 (T-1274 spec 동형). `shape` 는
// outcome 의 key 순서를 happy test 가 따로 pin 하므로 값만 이어붙여 비교한다.
const rec = (e: unknown, i: unknown = AT, f: unknown = { id: "r1" }) =>
  ({ entity: e, instant: i, fields: f }) as unknown as FullExportRecord;
const pl = (over: Obj = {}) =>
  ({ toDelete: [], toInsert: [], toKeep: [], ...over }) as unknown as Plan;
const froze = <T>(v: T[]) =>
  Object.freeze(v.map((e) => Object.freeze(e))) as unknown as T[];
const shape = (r: ImportRestoreTransactionResult) =>
  r.outcomes.map((o) => Object.values(o).join("|")).join(" ");
const [P, BAD_AT] = [rec("Person"), rec("Person", "leak-me")];
const [BAD_F, EMPTY_F] = [rec("Person", AT, [1]), rec("Person", AT, {})];
// mock PrismaService — 기본 응답의 `count` 가 누적 호출 수라 outcome 만 봐도 순서가 드러난다
// (`reply` 로 비정상 반환 · reject 주입, `txReject` 로 `$transaction` 자체 실패 주입).
function makeService(reply?: (key: string) => unknown, txReject?: unknown) {
  const calls: string[] = [];
  const [args, options]: unknown[][] = [[], []];
  const table: Obj = {};
  for (const { delegate } of Object.values(EXPORT_ENTITY_SOURCES)) {
    const mk = (m: string) => (a: unknown) => {
      calls.push(`${delegate}.${m}`);
      args.push(a);
      return reply ? reply(`${delegate}.${m}`) : { count: calls.length };
    };
    const [d, c] = [mk("deleteMany"), mk("createMany")];
    table[delegate] = { deleteMany: d, createMany: c };
  }
  const $transaction = jest.fn(
    async (run: (tx: unknown) => Promise<unknown>, passed?: unknown) => {
      options.push(passed);
      if (txReject !== undefined) throw txReject;
      return run(table);
    },
  );
  const prisma = { $transaction } as unknown as PrismaService;
  const service = new ImportRestoreTransactionService(prisma);
  return { service, $transaction, table, calls, args, options };
}
// 거부 단언 helper — 하류 prefix 단언이 곧 "재랩핑 0" 의 증거다 (본 service 는 메시지 0).
const rejects = async (s: Svc, bad: unknown, c: Ctor, m: RegExp) => {
  const err = (await s.restore(bad as Plan).catch((e: unknown) => e)) as Error;
  expect(err).toBeInstanceOf(c);
  expect(err.message).toMatch(m);
  return err;
};

describe("ImportRestoreTransactionService.restore — happy path", () => {
  // freeze 된 plan / records / Date / fields 로 호출해도 통과하고 입력 오염 0 (negative (f)).
  it("delete 2 + insert 2 를 단일 트랜잭션에서 순서대로 실행하고 요약을 채운다", async () => {
    const rows = froze([{ id: "p1" }, { id: "g1" }]);
    const input = pl({
      toDelete: froze([rec("Person"), rec("Group")]),
      toInsert: froze([rec("Person", AT, rows[0]), rec("Group", AT, rows[1])]),
      toKeep: froze([P]),
    });
    const { service, $transaction, calls, args, options } = makeService();
    const result = await service.restore(Object.freeze(input));
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(options).toEqual([{ maxWait: 10_000, timeout: 120_000 }]); // 1 회 · 값
    expect(options[0]).toBe(IMPORT_RESTORE_TRANSACTION_OPTIONS); // named 상수 그대로
    expect(calls.join(" ")).toBe(ORDER);
    expect(args[3]).toEqual({ data: [{ id: "g1" }] });
    expect(Object.keys(result)).toEqual(["outcomes", "deleted", "inserted"]);
    expect(shape(result)).toBe(SEQ);
    expect(result).toMatchObject({ deleted: 1 + 2, inserted: 3 + 4 }); // 합계 일치
  });
  // (g) 같은 plan 2 회 — 결과는 같고 반환 배열 instance 는 다르며 반환 변형이 입력 오염 0.
  it("같은 plan 2 회 호출은 동일 결과 · 다른 instance · 입력 비변형", async () => {
    const row = { id: "g1" };
    const input = pl({ toDelete: [P], toInsert: [rec("Group", AT, row)] });
    const first = await makeService().service.restore(input);
    first.outcomes[0].count = 99;
    first.outcomes.pop();
    const second = await makeService().service.restore(input);
    expect(second.outcomes).not.toBe(first.outcomes);
    expect(shape(second)).toBe(
      "Person|delete|person|deleteMany|1 Group|insert|group|createMany|2",
    );
    expect(row).toEqual({ id: "g1" });
    expect(input.toInsert[0].fields).toBe(row);
  });
  // 분기 cover — delete-only / insert-only / 빈 plan (트랜잭션 미개시 · 빈 왕복 0).
  const cases: [string, Plan, number, string, number, number][] = [
    ["delete-only", pl({ toDelete: [P] }), 1, "person.deleteMany", 1, 0],
    ["insert-only", pl({ toInsert: [P] }), 1, "person.createMany", 0, 1],
    ["빈 plan", pl({ toKeep: [P] }), 0, "", 0, 0],
  ];
  it.each(cases)("%s", async (_l, input, opened, order, deleted, inserted) => {
    const { service, $transaction, calls } = makeService();
    const result = await service.restore(input);
    expect($transaction).toHaveBeenCalledTimes(opened);
    expect(calls.join(" ")).toBe(order);
    expect(result.outcomes).toHaveLength(opened);
    expect(result).toMatchObject({ deleted, inserted });
  });
});

describe("ImportRestoreTransactionService.restore — error · negative", () => {
  // (a) plan 비-객체 → 하류 TypeError 전파 + 트랜잭션 0 회 (REQ-032 payload 자리 비노출은 (b)/(c)).
  it.each([undefined, null, 7, "s"])("plan=%p 거부", async (bad) => {
    const { service, $transaction } = makeService();
    await rejects(service, bad, TE, GRP);
    expect($transaction).not.toHaveBeenCalled();
  });
  // (b) 선-조립 계약 — 조립 결함은 열기 전 (opened=0), 실행 결함은 연 뒤 delegate 호출 전 (1).
  const bads: [string, Plan, Ctor, RegExp, number][] = [
    ["비배열 toDelete", pl({ toDelete: "leak-me" }), TE, GRP, 0],
    ["비배열 toInsert", pl({ toInsert: 1 }), TE, GRP, 0],
    ["무효 entity", pl({ toDelete: [rec("N")] }), RE, GRP, 0],
    ["원시값 record", pl({ toInsert: [7] }), RE, GRP, 0],
    ["비-Date instant", pl({ toDelete: [BAD_AT] }), TE, DEL, 1],
    ["비-plain fields", pl({ toInsert: [BAD_F] }), TE, INS, 1],
    ["빈 fields", pl({ toInsert: [EMPTY_F] }), RE, INS, 1],
  ];
  it.each(bads)("%s 는 그대로 전파", async (_l, input, c, m, opened) => {
    const { service, $transaction, calls } = makeService();
    const err = await rejects(service, input, c, m);
    expect(err.message).not.toMatch(/leak-me/);
    expect($transaction).toHaveBeenCalledTimes(opened);
    expect(calls).toEqual([]);
  });
  // (c) tx surface 결함 — runner 의 TypeError 가 그대로 전파되고 성공 결과는 만들어지지 않는다.
  const txBads: [string, (t: Obj) => void, RegExp][] = [
    ["delegate 삭제", (t) => void delete t.person, NODEL],
    ["delegate 원시값", (t) => void (t.person = 7), NODEL],
    ["method 비-함수", (t) => void ((t.person as Obj).deleteMany = 1), NOFN],
  ];
  it.each(txBads)("tx %s 이면 runner 가 거부", async (_l, breakTx, m) => {
    const { service, table, $transaction } = makeService();
    breakTx(table);
    const err = await rejects(service, pl({ toDelete: [P] }), TE, m);
    expect(err.message).toMatch(RUN);
    expect($transaction).toHaveBeenCalledTimes(1);
  });
  it("반환 count 가 비-number 면 거부 (미복원을 성공으로 보고 0)", async () => {
    const { service, calls } = makeService(() => ({ count: "leak-me" }));
    const err = await rejects(service, pl({ toDelete: [P] }), TE, RUN);
    expect(err.message).not.toMatch(/leak-me/);
    expect(calls).toEqual(["person.deleteMany"]);
  });
  // (d) `$transaction` 자체 실패 — `P1001` 은 매핑 표 밖이라 catch 를 지나도 instance 그대로
  // 전파된다 (적중 표는 아래 3b-2c-2 describe) · 재시도 0 · 결과 미반환.
  it("$transaction 이 reject 하면 그대로 전파 · 재시도 0", async () => {
    const boom = Object.assign(new Error("커넥션 실패"), { code: "P1001" });
    const { service, $transaction, calls } = makeService(undefined, boom);
    await expect(service.restore(pl({ toDelete: [P] }))).rejects.toBe(boom);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });
  // (e) 콜백 중간 step reject — 이후 호출 0 · 보상 delete 0 (되돌리기는 `$transaction` 몫이고 그
  // rollback 이 lazy guard 의 부분 적용까지 무해화 — 실 DB 실증은 T-1276 e2e). code 없는 error 라
  // 매핑도 미적중이라 instance 가 그대로 나온다.
  it("중간 step 이 reject 하면 이후 호출 0 · 되돌리기 0", async () => {
    const boom = new Error("delegate 실패");
    const { service, calls } = makeService((k) =>
      k === "person.createMany" ? Promise.reject(boom) : { count: 1 },
    );
    const input = pl({ toDelete: [P], toInsert: [P, rec("Group")] });
    await expect(service.restore(input)).rejects.toBe(boom);
    expect(calls.join(" ")).toBe("person.deleteMany person.createMany");
  });
});

// T-1278 (3b-2c-2) — 매핑 배선 한 겹. 어떤 code 가 어떤 exception 인지의 판정 표는 helper spec
// (`import-restore-error.spec.ts`) 이 이미 덮으므로, 여기선 "catch 가 helper 를 정확히 그 결과대로
// 반영하는가" 와 매핑이 기존 계약 (재시도 0 · 보상 0 · REQ-032) 을 깨지 않는가만 본다.
describe("ImportRestoreTransactionService.restore — Prisma error 매핑 (3b-2c-2)", () => {
  type HttpCtor = new (m?: string) => HttpException;
  const one = () => pl({ toDelete: [P] });
  const prismaError = (code: string, over: Obj = {}) =>
    Object.assign(new Error(`db 실패 ${code}`), { code, ...over });
  const failing = (thrown: unknown) => makeService(undefined, thrown);
  // 실패 주입 후 던져진 값을 돌려주는 helper — 매 호출마다 재시도 0 단언.
  // 주의: 본 helper 는 `txReject` 경로 **전용** 이라 콜백 자체가 실행되지 않는다. 따라서 아래
  // `calls` 단언은 "트랜잭션을 열자마자 실패했다" 는 뜻일 뿐 보상 로직 부재의 증거가 아니다
  // (T-1278 이월 nit). 실 delegate 를 돌린 뒤 실패하는 경로는 아래 별도 test 가 덮는다.
  const caught = async (thrown: unknown): Promise<unknown> => {
    const { service, $transaction, calls } = failing(thrown);
    const err = await service.restore(one()).catch((e: unknown) => e);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
    return err;
  };

  // happy — 표 3 종이 각각 지정 exception · status 로 바뀐다.
  it.each<[string, HttpCtor, number]>([
    ["P2002", ConflictException, 409],
    ["P2003", BadRequestException, 400],
    ["P2025", ConflictException, 409],
  ])("%s 는 매핑된 HTTP exception 으로 거부", async (code, ctor, status) => {
    const err = (await caught(prismaError(code))) as HttpException;
    expect(err).toBeInstanceOf(ctor);
    expect(err.getStatus()).toBe(status);
    expect(err.message).not.toContain(code); // 원본 code 문구 재사용 0
  });

  // 분기 — 매핑 미적중이면 원본 instance 동일성 (`toBe`) 을 유지한 채 그대로 전파한다.
  it.each<[string, unknown]>([
    ["P2028 (표 밖)", prismaError("P2028")],
    ["P1001 (표 밖)", prismaError("P1001")],
    ["code 없는 평범한 Error", new Error("평범한 실패")],
    ["code 가 비-문자열", prismaError("x", { code: 2002 })],
  ])("미적중 %s 는 원본 instance 그대로 전파", async (_l, boom) => {
    expect(await caught(boom)).toBe(boom);
  });

  // catch 범위 pin — 조립은 트랜잭션 밖이라 매핑을 거치지 않는다 (열기 전이라 catch 미진입).
  it("상류 조립 throw 는 매핑 대상이 아니다 (catch 밖)", async () => {
    const { service, $transaction } = failing(prismaError("P2002"));
    const err = await rejects(service, pl({ toDelete: "leak-me" }), TE, GRP);
    expect(err).not.toBeInstanceOf(HttpException);
    expect($transaction).not.toHaveBeenCalled();
  });

  // 분기 — 빈 step 단락은 트랜잭션 자체를 열지 않아 실패 주입이 있어도 catch 에 닿지 않는다.
  it("빈 step 단락은 트랜잭션 미개시라 매핑 catch 미진입", async () => {
    const { service, $transaction } = failing(prismaError("P2002"));
    await expect(service.restore(pl({ toKeep: [P] }))).resolves.toEqual({
      outcomes: [],
      deleted: 0,
      inserted: 0,
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  // negative (a)(b) REQ-032 — 원본 문구 · `meta.cause` 가 메시지 · 직렬화 어디에도 새지 않고
  // 원본이 `cause` 로도 붙지 않는다. 컬럼명 단서 (스키마 이름) 만 허용.
  it("negative: 원본 Prisma 문구 · meta 가 매핑 결과로 새지 않는다", async () => {
    const boom = prismaError("P2002", {
      message: "Unique constraint failed leak-me",
      meta: { cause: "leak-me", target: ["email"] },
    });
    const err = (await caught(boom)) as HttpException;
    const dump = `${err.message} ${JSON.stringify(err.getResponse())} ${JSON.stringify(err)}`;
    expect(dump).not.toMatch(/leak-me|Unique constraint/);
    expect(err.message).toMatch(/고유 제약/);
    expect(err.message).toContain("email");
    expect((err as { cause?: unknown }).cause).toBeUndefined();
  });

  // negative (c) 공유 싱글턴 0 — 같은 error 로 두 번 실패해도 매번 새 instance.
  it("negative: 같은 error 2 회 실패는 매번 새 exception instance", async () => {
    const boom = prismaError("P2025");
    const [a, b] = [await caught(boom), await caught(boom)];
    expect(a).not.toBe(b);
    expect((a as Error).message).toBe((b as Error).message);
  });

  // negative (d) 매핑이 실패를 성공으로 둔갑시키지 않는다 — resolve 경로 0.
  it("negative: 매핑돼도 부분 성공 결과를 resolve 하지 않는다", async () => {
    const { service } = failing(prismaError("P2003"));
    const done = await service.restore(one()).then(
      () => "resolved",
      () => "rejected",
    );
    expect(done).toBe("rejected");
  });

  // regression (T-1279, T-1278 이월 nit) — 실 step 을 돌린 뒤 **트랜잭션 안의 delegate** 가
  // P2002 로 reject 하는 실제 실패 형태. `caught()` 의 txReject 경로와 달리 콜백이 실행되므로
  // "매핑이 붙어도 실패 이후 호출 0 · 보상 delete 0" 이 공허하지 않게 검증된다.
  it("regression: 중간 delegate 가 P2002 로 실패하면 409 매핑 · 실행 sequence 그대로 · 보상 0", async () => {
    const boom = prismaError("P2002", { meta: { target: ["email"] } });
    const { service, $transaction, calls } = makeService((k) =>
      k === "person.createMany" ? Promise.reject(boom) : { count: 1 },
    );
    const input = pl({ toDelete: [P], toInsert: [P, rec("Group")] });

    const err = (await service
      .restore(input)
      .catch((e: unknown) => e)) as HttpException;

    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getStatus()).toBe(409);
    expect(err.message).not.toContain("P2002"); // 원본 code 문구 재사용 0
    // 실패 지점까지의 호출만 남고 이후 step (group.createMany) · 보상 delete 는 0.
    expect(calls).toEqual(["person.deleteMany", "person.createMany"]);
    expect($transaction).toHaveBeenCalledTimes(1); // 재시도 0
  });

  // negative (f) 설계 결정 (A) pin — helper 를 자체 try/catch 로 감싸지 않으므로 계약 밖 입력의
  // accessor throw 가 원본 실패를 덮고 그대로 전파된다 (원본 유실은 알려진 trade-off).
  it("negative: code 접근자가 throw 하는 계약 밖 error 는 그 throw 가 전파 (결정 A)", async () => {
    const accessor = new Error("accessor boom");
    const boom = Object.defineProperty(new Error("원본 실패"), "code", {
      get: (): never => {
        throw accessor;
      },
    });
    expect(await caught(boom)).toBe(accessor);
  });
});
