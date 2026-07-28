// import-job-runner.service.spec — T-1284 runner (markRunning → restoreFromDump → markSucceeded /
// markFailed) 의 R-112 4 종 (happy / error / 분기 / negative 충분 cover). 실 DB 0 · 실 PrismaService
// 0 — 협력 service 둘을 좁은 jest mock 으로 직접 생성자 주입해 **호출 순서 · 인자 인스턴스 · 전파
// 대상 · 기록 문구** 만 본다 (각 service 의 내부 규칙은 각자 spec 이 소유).
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ImportMode, type ImportJob } from "@prisma/client";

import {
  ImportJobRunnerService,
  IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE,
} from "./import-job-runner.service";
import type { ImportJobService } from "./import-job.service";
import type { ImportRestoreTransactionResult } from "./import-restore-transaction.service";
import type { ImportRestoreService } from "./import-restore.service";

const JOB_ID = "job-1";
const ARTIFACT = "dump-2026-07-28.json";
const BUF = Buffer.from("dump-원문-비밀-payload");
const RUNNING = { id: JOB_ID, status: "RUNNING" } as unknown as ImportJob;
const SUCCEEDED = { id: JOB_ID, status: "SUCCEEDED" } as unknown as ImportJob;
const FAILED = { id: JOB_ID, status: "FAILED" } as unknown as ImportJob;
const RESULT: ImportRestoreTransactionResult = {
  outcomes: [],
  deleted: 3,
  inserted: 7,
};
const RAW = { code: "P2002", message: "Unique constraint failed: (`name`)" };
const DENIED = new BadRequestException("import 복원 거부 (stage: records)");
const CONFLICT = new ConflictException(
  "고유 제약 위반으로 복원을 중단했습니다.",
);
const BOOKKEEPING = new NotFoundException(`import job not found: ${JOB_ID}`);
const OK_ORDER = ["markRunning", "restoreFromDump", "markSucceeded"];
const FAIL_ORDER = ["markRunning", "restoreFromDump", "markFailed"];

// reject 값 box — `undefined` 를 던지는 negative 를 "reject 미지정" 과 구분하기 위해 감싼다.
type Box = { v: unknown };

// mock 조립 — 네 협력 메서드를 같은 `order` 로그에 기록해 호출 **순서** 까지 단언 가능하게 한다.
function makeRunner(
  over: {
    running?: Box;
    restore?: Box;
    succeeded?: Box;
    failed?: Box;
    result?: ImportRestoreTransactionResult;
  } = {},
) {
  const order: string[] = [];
  const settle = <T>(name: string, value: T, box?: Box) =>
    jest.fn((...args: unknown[]): Promise<T> => {
      void args;
      order.push(name);
      return box ? Promise.reject(box.v) : Promise.resolve(value);
    });
  const jobs = {
    markRunning: settle("markRunning", RUNNING, over.running),
    markSucceeded: settle("markSucceeded", SUCCEEDED, over.succeeded),
    markFailed: settle("markFailed", FAILED, over.failed),
  };
  const dump = settle("restoreFromDump", over.result ?? RESULT, over.restore);
  const service = new ImportJobRunnerService(
    jobs as unknown as ImportJobService,
    { restoreFromDump: dump } as unknown as ImportRestoreService,
  );
  return { service, order, ...jobs, restoreFromDump: dump };
}

const run = (
  svc: ImportJobRunnerService,
  mode: ImportMode = ImportMode.REPLACE,
) => svc.runJob({ jobId: JOB_ID, buffer: BUF, mode, artifactRef: ARTIFACT });

// 실패 경로 공통 — resolve 되면 그 자체가 실패이므로 sentinel 로 구분한 뒤 던져진 값을 돌려준다
// (`undefined` throw 도 단언 대상이라 rejects matcher 대신 이 형태를 쓴다).
const RESOLVED = Symbol("resolved");
async function thrown(promise: Promise<unknown>): Promise<unknown> {
  const caught = await promise.then(
    () => RESOLVED,
    (error: unknown) => ({ error }),
  );
  expect(caught).not.toBe(RESOLVED);
  return (caught as { error: unknown }).error;
}

describe("ImportJobRunnerService.runJob", () => {
  it.each([ImportMode.REPLACE, ImportMode.MERGE])(
    "happy — %s: 세 호출이 순서대로 각 1 회이고 markSucceeded 반환을 그대로 돌려준다",
    async (mode) => {
      const t = makeRunner();
      expect(await run(t.service, mode)).toBe(SUCCEEDED);
      expect(t.order).toEqual(OK_ORDER);
      expect(t.markRunning).toHaveBeenCalledTimes(1);
      expect(t.markRunning).toHaveBeenCalledWith(JOB_ID);
      expect(t.restoreFromDump).toHaveBeenCalledTimes(1);
      expect(t.markSucceeded).toHaveBeenCalledTimes(1);
      // restoredRowCount 는 inserted 만 — deleted 3 은 합산되지 않는다.
      expect(t.markSucceeded).toHaveBeenCalledWith(JOB_ID, ARTIFACT, 7);
      expect(t.markFailed).not.toHaveBeenCalled();
    },
  );

  it("negative — buffer · mode · artifactRef 가 재가공 없이 같은 인스턴스로 전달된다", async () => {
    const t = makeRunner();
    await run(t.service, ImportMode.MERGE);
    const args = t.restoreFromDump.mock.calls[0];
    expect(args).toHaveLength(2);
    expect(args[0]).toBe(BUF);
    expect(args[1]).toBe(ImportMode.MERGE);
    expect(t.markSucceeded.mock.calls[0][1]).toBe(ARTIFACT);
  });

  it("negative — deleted 가 많아도 inserted 가 0 이면 restoredRowCount 는 0 이다", async () => {
    const t = makeRunner({
      result: { outcomes: [], deleted: 12, inserted: 0 },
    });
    await run(t.service);
    expect(t.markSucceeded).toHaveBeenCalledWith(JOB_ID, ARTIFACT, 0);
  });

  it("error — markRunning 전이 실패는 그대로 전파되고 이후 호출이 모두 0 이다", async () => {
    const t = makeRunner({ running: { v: BOOKKEEPING } });
    expect(await thrown(run(t.service))).toBe(BOOKKEEPING);
    expect(t.order).toEqual(["markRunning"]);
    expect(t.restoreFromDump).not.toHaveBeenCalled();
    expect(t.markSucceeded).not.toHaveBeenCalled();
    expect(t.markFailed).not.toHaveBeenCalled();
  });

  it.each([
    ["BadRequestException(400)", DENIED],
    ["ConflictException(409)", CONFLICT],
  ])(
    "error/분기 — %s 는 message 가 그대로 기록되고 원본 인스턴스가 전파된다",
    async (_label, error) => {
      const t = makeRunner({ restore: { v: error } });
      expect(await thrown(run(t.service))).toBe(error);
      expect(t.order).toEqual(FAIL_ORDER);
      expect(t.markFailed).toHaveBeenCalledTimes(1);
      expect(t.markFailed).toHaveBeenCalledWith(JOB_ID, error.message);
      expect(t.markSucceeded).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["raw Prisma-like error", RAW],
    ["일반 Error", new Error("connection terminated unexpectedly")],
    ["문자열 throw", "복원 중 알 수 없는 실패"],
    ["undefined throw", undefined],
  ])(
    "negative/분기 — 비-HttpException(%s) 은 고정 상수만 기록하고 그 값 자체가 전파된다",
    async (_label, value) => {
      const t = makeRunner({ restore: { v: value } });
      expect(await thrown(run(t.service))).toBe(value);
      expect(t.order).toEqual(FAIL_ORDER);
      expect(t.markFailed).toHaveBeenCalledTimes(1);
      const recorded = t.markFailed.mock.calls[0][1];
      expect(recorded).toBe(IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE);
      // raw 조각은 한 글자도 job record 로 새지 않는다 (REQ-032).
      expect(recorded).not.toContain("P2002");
      expect(recorded).not.toContain("Unique");
      expect(recorded).not.toContain("connection");
      expect(t.markSucceeded).not.toHaveBeenCalled();
    },
  );

  it("negative/분기 — markFailed 가 reject 해도 복원 error 가 전파된다 (기록은 best-effort)", async () => {
    const t = makeRunner({
      restore: { v: DENIED },
      failed: { v: BOOKKEEPING },
    });
    const caught = await thrown(run(t.service));
    expect(caught).toBe(DENIED);
    expect(caught).not.toBe(BOOKKEEPING);
    expect(t.markFailed).toHaveBeenCalledTimes(1);
    expect(t.order).toEqual(FAIL_ORDER);
  });

  it("negative — markSucceeded 가 reject 하면 그 error 가 전파되고 markFailed 는 0 회다", async () => {
    const t = makeRunner({ succeeded: { v: BOOKKEEPING } });
    expect(await thrown(run(t.service))).toBe(BOOKKEEPING);
    expect(t.markSucceeded).toHaveBeenCalledTimes(1);
    expect(t.markFailed).not.toHaveBeenCalled();
    expect(t.order).toEqual(OK_ORDER);
  });
});
