// import-restore.service.spec — T-1281 복원 orchestrator (buffer → 기존 record 로딩 → plan 준비
// → 실패 400 단락 → atomic 실행) 의 R-112 4 종 (happy / error / 분기 / negative 충분 cover).
// 실 DB 0 · 실 PrismaService 0 — 재료 helper 둘은 module mock, 트랜잭션 service 는 좁은 mock 으로
// 주입해 **호출 순서 · 인스턴스 전달 · 단락 지점** 만 본다 (각 helper 내부 규칙은 각자 spec 소유).
import { BadRequestException, ConflictException } from "@nestjs/common";
import { ImportMode } from "@prisma/client";

import type { FullExportRecord } from "../export/export-full-record";
import { collectFullExportRecords } from "../export/export-full-record-collect";
import type { ImportRestorePlan } from "../export/import-restore-plan";
import type { PrismaService } from "../persistence/prisma.service";

import {
  prepareImportRestorePlan,
  type ImportRestorePlanStage,
} from "./import-restore-plan-prepare";
import type {
  ImportRestoreTransactionResult,
  ImportRestoreTransactionService,
} from "./import-restore-transaction.service";
import { ImportRestoreService } from "./import-restore.service";

jest.mock("../export/export-full-record-collect", () => ({
  collectFullExportRecords: jest.fn(),
}));
jest.mock("./import-restore-plan-prepare", () => ({
  prepareImportRestorePlan: jest.fn(),
}));

type Plan = ImportRestorePlan<FullExportRecord>;
const collect = collectFullExportRecords as jest.MockedFunction<
  typeof collectFullExportRecords
>;
const prepare = prepareImportRestorePlan as jest.MockedFunction<
  typeof prepareImportRestorePlan
>;

// fixture — plan / result 는 인스턴스 동일성만 보므로 내용은 최소로 둔다.
const PLAN = Object.freeze({ toDelete: [], toInsert: [], toKeep: [] }) as Plan;
const RESULT: ImportRestoreTransactionResult = Object.freeze({
  outcomes: [],
  deleted: 3,
  inserted: 7,
});
const REC = Object.freeze({
  entity: "Person",
  instant: new Date("2026-07-28T00:00:00.000Z"),
  fields: { id: "p1", name: "주민등록번호-880101" },
}) as unknown as FullExportRecord;
const BUF = Buffer.from("dump-원문-비밀-payload");

// T-1294 요약 배선 fixture — entity 분포를 눈으로 셀 수 있는 최소 record 만 둔다.
// `fields` 에 민감 문자열을 남겨 두는 것은 요약이 그것을 절대 싣지 않음을 부정 단언하기 위함이다.
const planRecord = (entity: string, id: string): FullExportRecord =>
  ({
    entity,
    instant: new Date("2026-07-28T00:00:00.000Z"),
    fields: { id, name: "주민등록번호-880101" },
  }) as unknown as FullExportRecord;

// MERGE 성격 plan — `toKeep` 이 비어있지 않아 기존 결과 shape 로는 관측 불가하던 `kept` 가 드러난다.
const MERGE_PLAN = Object.freeze({
  toDelete: [planRecord("Person", "d1")],
  toInsert: [
    planRecord("Person", "i1"),
    planRecord("Group", "i2"),
    planRecord("Assessment", "i3"),
  ],
  toKeep: [planRecord("Group", "k1"), planRecord("Group", "k2")],
}) as Plan;

// 5 entity 전부 key 로 존재하는 0-init map (helper 의 perEntity 계약 정본과 같은 모양).
const zeroPerEntity = () => ({
  Assessment: 0,
  Person: 0,
  Group: 0,
  LlmConfig: 0,
  AuditLog: 0,
});
// 빈 plan (PLAN fixture) 의 기대 요약 — 세 그룹 total 0 + perEntity 전부 0.
const EMPTY_SUMMARY = {
  deleted: { total: 0, perEntity: zeroPerEntity() },
  inserted: { total: 0, perEntity: zeroPerEntity() },
  kept: { total: 0, perEntity: zeroPerEntity() },
};
// MERGE_PLAN 의 기대 요약 — 세 배열을 손으로 센 값 (helper 재구현이 아니라 실측 표).
const MERGE_SUMMARY = {
  deleted: { total: 1, perEntity: { ...zeroPerEntity(), Person: 1 } },
  inserted: {
    total: 3,
    perEntity: { ...zeroPerEntity(), Person: 1, Group: 1, Assessment: 1 },
  },
  kept: { total: 2, perEntity: { ...zeroPerEntity(), Group: 2 } },
};

// 성공 verdict 조립 — plan 만 test 마다 갈아끼운다 (makeService 본문은 그대로 둔다).
const accept = (plan: Plan): ReturnType<typeof prepareImportRestorePlan> => ({
  ok: true,
  plan,
  records: [REC],
  version: {} as never,
});

// mock 조립 — read 결과 · verdict · restore 응답 주입 (sentinel prisma 는 캐스팅 통과 확인용).
function makeService(
  over: {
    existing?: FullExportRecord[];
    collectReject?: unknown;
    verdict?: ReturnType<typeof prepareImportRestorePlan>;
    restoreReject?: unknown;
  } = {},
) {
  const prisma = { $transaction: jest.fn() } as unknown as PrismaService;
  const existing = over.existing ?? [REC];
  if (over.collectReject !== undefined) {
    collect.mockRejectedValue(over.collectReject);
  } else {
    collect.mockResolvedValue(existing);
  }
  prepare.mockReturnValue(
    over.verdict ?? {
      ok: true,
      plan: PLAN,
      records: existing,
      version: {} as never,
    },
  );
  // 넘겨받은 plan 을 그대로 모아 둔다 — 인스턴스 동일성 단언용 (mock.calls 타입 우회).
  const planned: Plan[] = [];
  const restore = jest.fn((plan: Plan) => {
    planned.push(plan);
    return over.restoreReject === undefined
      ? Promise.resolve(RESULT)
      : Promise.reject(over.restoreReject);
  });
  const service = new ImportRestoreService(prisma, {
    restore,
  } as unknown as ImportRestoreTransactionService);
  return { service, prisma, existing, restore, planned };
}

const reject = (stage: ImportRestorePlanStage, issues: string[]) =>
  ({ ok: false, stage, issues }) as const;

// 실패 stage table — 문자열 리터럴 배열이 아니라 `Record<ImportRestorePlanStage, true>` 로
// 선언해 union 에 stage 가 추가/삭제되면 **tsc 가 fail** 한다 (T-1281 이월 nit (i) — 리터럴
// 배열은 union 이 늘어도 아무 test 도 깨지지 않아 exhaustiveness 공백이 있었다).
const STAGE_TABLE: Record<ImportRestorePlanStage, true> = {
  deserialize: true,
  structure: true,
  version: true,
  records: true,
  mode: true,
  plan: true,
};
const STAGES = Object.keys(STAGE_TABLE) as ImportRestorePlanStage[];
// it.each 가 실제로 돌린 stage 기록 — union 크기와 일치하는지 아래 negative 에서 단언한다.
const visitedStages: ImportRestorePlanStage[] = [];

// 거부 경로 공통 — resolve 되면 그 자체가 실패이므로 instanceof 를 여기서 한 번에 단언하고
// 좁혀진 exception 을 돌려준다 (호출부마다 try/catch 를 반복하지 않기 위한 축약).
async function denied(
  service: ImportRestoreService,
): Promise<BadRequestException> {
  const caught = await service.restoreFromDump(BUF, ImportMode.REPLACE).then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(BadRequestException);
  return caught as BadRequestException;
}

beforeEach(() => jest.clearAllMocks());

describe("ImportRestoreService.restoreFromDump", () => {
  it("happy — 실행 결과 인스턴스를 그대로 반환하고 건수를 보존한다", async () => {
    const { service, prisma, existing, restore, planned } = makeService();
    const result = await service.restoreFromDump(BUF, ImportMode.REPLACE);
    // T-1294 로 반환 shape 가 `summary` 만큼 늘어 **전체 객체** 동일성은 성립하지 않는다 —
    // 기존 3 필드가 실행 결과 그대로임은 값 일치 + `outcomes` 인스턴스 동일성으로 확인한다.
    expect(result).toEqual({ ...RESULT, summary: EMPTY_SUMMARY });
    expect(result.outcomes).toBe(RESULT.outcomes);
    expect(result).toMatchObject({ deleted: 3, inserted: 7 });
    expect(collect).toHaveBeenCalledTimes(1);
    expect(collect).toHaveBeenCalledWith(prisma);
    expect(restore).toHaveBeenCalledTimes(1);
    // plan 은 재조립 없이 준비된 인스턴스 그대로 넘어간다.
    expect(planned[0]).toBe(PLAN);
    expect(existing).toHaveLength(1);
  });

  it("happy — prepare 를 (buffer, existing, mode) 3 인자로 부르고 existing 은 read 결과 인스턴스다", async () => {
    const { service, existing } = makeService();
    await service.restoreFromDump(BUF, ImportMode.MERGE);
    expect(prepare).toHaveBeenCalledTimes(1);
    const args = prepare.mock.calls[0];
    expect(args).toHaveLength(3);
    expect(args[0]).toBe(BUF);
    expect(args[1]).toBe(existing);
    expect(args[2]).toBe(ImportMode.MERGE);
  });

  it("error — read 단계 reject 는 그대로 전파되고 prepare · restore 는 호출 0 이다", async () => {
    const boom = new TypeError("delegate 가 객체가 아닙니다");
    const { service, restore } = makeService({ collectReject: boom });
    await expect(service.restoreFromDump(BUF, ImportMode.REPLACE)).rejects.toBe(
      boom,
    );
    expect(prepare).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });

  it("error — restore 의 ConflictException 을 재랩핑 없이 인스턴스 그대로 전파한다", async () => {
    const conflict = new ConflictException("복원 대상이 이미 존재합니다");
    const { service } = makeService({ restoreReject: conflict });
    await expect(service.restoreFromDump(BUF, ImportMode.REPLACE)).rejects.toBe(
      conflict,
    );
  });

  it("error — 매핑 밖 원본 error 도 흡수 없이 그대로 전파한다", async () => {
    const raw = new RangeError("P1001 커넥션 끊김");
    const { service } = makeService({ restoreReject: raw });
    await expect(service.restoreFromDump(BUF, ImportMode.MERGE)).rejects.toBe(
      raw,
    );
  });

  it("분기 — 실패 verdict 는 400 으로 단락되고 restore 호출 0 이다 (DB 변경 0)", async () => {
    const { service, restore } = makeService({
      verdict: reject("version", ["schema version 이 호환되지 않습니다"]),
    });
    await expect(
      service.restoreFromDump(BUF, ImportMode.REPLACE),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(restore).not.toHaveBeenCalled();
  });

  // 실패 stage 6 종 — 각 토큰이 message 에 드러나고 전부 400 이다 (stage 당 개별 it 금지).
  // table 은 STAGE_TABLE 에서 파생되므로 union 이 바뀌면 컴파일 단계에서 걸린다.
  it.each<ImportRestorePlanStage>(STAGES)(
    "분기 — stage %s 실패는 토큰과 함께 400 이 된다",
    async (stage) => {
      visitedStages.push(stage);
      const { service, restore } = makeService({
        verdict: reject(stage, [`${stage} 단계 위반`]),
      });
      const error = await denied(service);
      expect(error.getStatus()).toBe(400);
      expect(error.message).toContain(`stage: ${stage}`);
      expect(error.message).toContain(`${stage} 단계 위반`);
      expect(restore).not.toHaveBeenCalled();
    },
  );

  // negative (f): 파생 table 이 union 6 종을 누락 없이 돌렸는지 — 실행된 case 집합이 STAGE_TABLE
  // 의 key 집합과 정확히 같아야 한다 (파생이 일부만 흘리는 회귀 차단).
  it("negative — stage table 파생이 union 전체를 누락 없이 돌린다", () => {
    expect(STAGES).toHaveLength(6);
    expect([...visitedStages].sort()).toEqual([...STAGES].sort());
  });

  it("negative — issues 가 여러 개면 전부 구분자로 이어져 message 에 담긴다", async () => {
    const { service } = makeService({
      verdict: reject("structure", ["위반 1", "위반 2", "위반 3"]),
    });
    const error = await denied(service);
    expect(error.message).toBe(
      "import 복원 거부 (stage: structure): 위반 1; 위반 2; 위반 3",
    );
  });

  // 분기 (b) — issues 가 비면 꼬리 구분자 (": ") 를 남기지 않는다 (T-1281 이월 nit (ii)).
  it("분기 — issues 가 빈 배열이면 꼬리 구분자 없이 stage 토큰만 담고 400 이다", async () => {
    const { service } = makeService({ verdict: reject("plan", []) });
    const error = await denied(service);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe("import 복원 거부 (stage: plan)");
    expect(error.message).not.toMatch(/[:;]\s*$/);
  });

  // negative (e) — 빈 issues 조립에 잡음이 섞이지 않는다 (REQ-032 부정 단언).
  it("negative — 빈 issues message 에 dump 원문 · fields 값 · undefined · null 잡음이 없다", async () => {
    const { service } = makeService({ verdict: reject("mode", []) });
    const error = await denied(service);
    expect(error.message).not.toContain("dump-원문-비밀-payload");
    expect(error.message).not.toContain("주민등록번호-880101");
    expect(error.message).not.toContain("undefined");
    expect(error.message).not.toContain("null");
    expect((error as { cause?: unknown }).cause).toBeUndefined();
  });

  it("negative — 거부 message 에 dump 원문 · record fields 값이 실리지 않는다 (REQ-032)", async () => {
    const { service } = makeService({
      verdict: reject("deserialize", ["dump 를 역직렬화할 수 없습니다"]),
    });
    const error = await denied(service);
    expect(error.message).not.toContain("dump-원문-비밀-payload");
    expect(error.message).not.toContain("주민등록번호-880101");
    expect(JSON.stringify(error.getResponse())).not.toContain("880101");
    expect((error as { cause?: unknown }).cause).toBeUndefined();
  });

  it("negative — 빈 DB (read 가 빈 배열) 여도 existing: [] 로 정상 진행한다", async () => {
    const { service, restore } = makeService({ existing: [] });
    // 위 happy 와 같은 사유로 `toBe` → 확장된 shape 의 값 일치로만 좁힌다 (T-1294).
    await expect(
      service.restoreFromDump(BUF, ImportMode.MERGE),
    ).resolves.toEqual({ ...RESULT, summary: EMPTY_SUMMARY });
    expect(prepare.mock.calls[0][1]).toEqual([]);
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("negative — 같은 인스턴스로 두 번 불러도 상태를 남기지 않는다 (캐시 0)", async () => {
    const { service, restore } = makeService();
    await service.restoreFromDump(BUF, ImportMode.REPLACE);
    await service.restoreFromDump(BUF, ImportMode.MERGE);
    expect(collect).toHaveBeenCalledTimes(2);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(restore).toHaveBeenCalledTimes(2);
  });
});

// T-1294 (실행 slice 3c-4a) — `summarizeRestorePlan` 배선. 집계 규칙 자체는 helper spec 이
// 소유하므로 여기서는 **파생 지점 (transaction 앞) · 동봉 shape · 전파 계약** 만 본다.
describe("ImportRestoreService.restoreFromDump — plan 영향 breakdown 요약 동봉", () => {
  // 요약 산출 실패 경로 공통 — resolve 되면 그 자체가 실패라 catch 값만 돌려준다.
  async function summaryFailure(plan: unknown) {
    const t = makeService({ verdict: accept(plan as Plan) });
    const caught = await t.service.restoreFromDump(BUF, ImportMode.MERGE).then(
      () => undefined,
      (error: unknown) => error,
    );
    return { ...t, caught };
  }

  it("happy — MERGE plan 의 kept 를 포함한 세 그룹 breakdown 을 실측대로 동봉한다", async () => {
    const { service, restore } = makeService({ verdict: accept(MERGE_PLAN) });
    const result = await service.restoreFromDump(BUF, ImportMode.MERGE);
    // 기존 3 필드는 transaction stub 반환 그대로 (한 글자도 재가공 없음).
    expect(result.outcomes).toBe(RESULT.outcomes);
    expect(result.deleted).toBe(3);
    expect(result.inserted).toBe(7);
    // 요약은 주입한 plan 세 배열의 실측 집계와 정확히 일치한다 (부분 매칭 금지).
    expect(result.summary).toEqual(MERGE_SUMMARY);
    expect(result).toEqual({ ...RESULT, summary: MERGE_SUMMARY });
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("분기 — 세 배열이 모두 빈 plan 은 total 0 + 5 entity key 가 전부 0 인 정상 요약이다", async () => {
    const { service } = makeService();
    const { summary } = await service.restoreFromDump(BUF, ImportMode.REPLACE);
    expect(summary).toEqual(EMPTY_SUMMARY);
    for (const group of Object.values(summary)) {
      expect(group.total).toBe(0);
      expect(Object.keys(group.perEntity).sort()).toEqual(
        ["Assessment", "AuditLog", "Group", "LlmConfig", "Person"].sort(),
      );
    }
  });

  it("negative — plan.toKeep 이 배열이 아니면 TypeError 가 그대로 전파되고 transaction 미개시다", async () => {
    const { caught, restore, prisma } = await summaryFailure({
      toDelete: [],
      toInsert: [],
      toKeep: "전부-보존",
    });
    expect(caught).toBeInstanceOf(TypeError);
    // 재랩핑 0 — 400 으로 바꿔 달지 않는다.
    expect(caught).not.toBeInstanceOf(BadRequestException);
    expect((caught as TypeError).message).toContain("plan.toKeep");
    // 요약 실패가 커밋 뒤가 아니라 앞에서 났다는 증거 (DB 변경 0).
    expect(restore).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("negative — record instant 가 Invalid Date 면 TypeError 전파 + restore 미호출이다", async () => {
    const { caught, restore } = await summaryFailure({
      toDelete: [],
      toInsert: [
        { ...planRecord("Person", "x1"), instant: new Date("허수아비") },
      ],
      toKeep: [],
    });
    expect(caught).toBeInstanceOf(TypeError);
    expect((caught as TypeError).message).toContain("toInsert[0].instant");
    expect(restore).not.toHaveBeenCalled();
  });

  it("error — restore 가 reject 하면 그 인스턴스가 전파되고 요약이 대신 반환되지 않는다", async () => {
    const conflict = new ConflictException("고유 제약 위반");
    const { service } = makeService({
      verdict: accept(MERGE_PLAN),
      restoreReject: conflict,
    });
    const settled = await service.restoreFromDump(BUF, ImportMode.MERGE).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    expect(settled).toEqual({ error: conflict });
  });

  it("negative — 요약 산출이 주입한 plan 객체 · 배열을 변형하지 않는다", async () => {
    const before = JSON.parse(JSON.stringify(MERGE_PLAN)) as unknown;
    const { service, planned } = makeService({ verdict: accept(MERGE_PLAN) });
    await service.restoreFromDump(BUF, ImportMode.MERGE);
    expect(JSON.parse(JSON.stringify(MERGE_PLAN))).toEqual(before);
    // plan 복제 0 — transaction 에는 준비된 인스턴스가 그대로 간다.
    expect(planned[0]).toBe(MERGE_PLAN);
  });

  it("negative — summary 에는 숫자 집계뿐이라 dump 원문 · fields 값 · stack 이 실리지 않는다 (REQ-032)", async () => {
    const { service } = makeService({ verdict: accept(MERGE_PLAN) });
    const { summary } = await service.restoreFromDump(BUF, ImportMode.MERGE);
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("주민등록번호-880101");
    expect(serialized).not.toContain("dump-원문-비밀-payload");
    expect(serialized).not.toContain("2026-07-28");
    expect(serialized).not.toContain("at ");
    // 구조 단언 — 세 그룹의 total 과 perEntity 값이 전부 number 다 (문자열 필드 0).
    for (const group of Object.values(summary)) {
      expect(typeof group.total).toBe("number");
      for (const count of Object.values(group.perEntity)) {
        expect(typeof count).toBe("number");
      }
    }
  });

  it("negative — 같은 입력으로 두 번 부르면 동일한 요약을 낸다 (idempotent)", async () => {
    const { service } = makeService({ verdict: accept(MERGE_PLAN) });
    const first = await service.restoreFromDump(BUF, ImportMode.MERGE);
    const second = await service.restoreFromDump(BUF, ImportMode.MERGE);
    expect(second.summary).toEqual(first.summary);
    // 매 호출 새 객체 — 요약을 캐시하거나 공유 상태에 쌓지 않는다.
    expect(second.summary).not.toBe(first.summary);
  });
});
