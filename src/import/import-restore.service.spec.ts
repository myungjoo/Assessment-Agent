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
    expect(result).toBe(RESULT);
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
  it.each<ImportRestorePlanStage>([
    "deserialize",
    "structure",
    "version",
    "records",
    "mode",
    "plan",
  ])("분기 — stage %s 실패는 토큰과 함께 400 이 된다", async (stage) => {
    const { service, restore } = makeService({
      verdict: reject(stage, [`${stage} 단계 위반`]),
    });
    const error = await denied(service);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain(`stage: ${stage}`);
    expect(error.message).toContain(`${stage} 단계 위반`);
    expect(restore).not.toHaveBeenCalled();
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

  it("negative — issues 가 빈 배열이어도 조립이 깨지지 않고 400 이다", async () => {
    const { service } = makeService({ verdict: reject("plan", []) });
    const error = await denied(service);
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe("import 복원 거부 (stage: plan): ");
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
    await expect(service.restoreFromDump(BUF, ImportMode.MERGE)).resolves.toBe(
      RESULT,
    );
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
