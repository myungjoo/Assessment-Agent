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

import type {
  RestorePlanGroupBreakdown,
  RestorePlanSummary,
} from "../export/import-restore-plan-summary";

import {
  ImportJobRunnerService,
  IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE,
} from "./import-job-runner.service";
import type { ImportJobService } from "./import-job.service";
import type {
  ImportRestoreResult,
  ImportRestoreService,
} from "./import-restore.service";

const JOB_ID = "job-1";
const ARTIFACT = "dump-2026-07-28.json";
const BUF = Buffer.from("dump-원문-비밀-payload");
const RUNNING = { id: JOB_ID, status: "RUNNING" } as unknown as ImportJob;
const SUCCEEDED = { id: JOB_ID, status: "SUCCEEDED" } as unknown as ImportJob;
const FAILED = { id: JOB_ID, status: "FAILED" } as unknown as ImportJob;

// 요약 fixture — 5 entity 전부 key 인 perEntity map 을 0-init 후 지정분만 채운다
// (`summarizeRestorePlan` 산출 shape 와 동형; 본 spec 은 집계 규칙을 재검증하지 않고
// **runner 가 그 인스턴스를 그대로 싣는지** 만 본다).
function group(
  over: Partial<Record<string, number>> = {},
): RestorePlanGroupBreakdown {
  const perEntity = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
    ...over,
  };
  return {
    total: Object.values(perEntity).reduce((sum, n) => sum + n, 0),
    perEntity,
  };
}

// MERGE 성격 요약 — 보존 (`kept`) 이 비어있지 않고 삭제 breakdown 이 entity 별로 갈린다.
const SUMMARY: RestorePlanSummary = {
  deleted: group({ Person: 2, Group: 1 }),
  inserted: group({ Assessment: 4, Person: 3 }),
  kept: group({ Person: 5, AuditLog: 1 }),
};
// 세 그룹이 모두 total 0 인 빈 요약 (negative — 빈 복원도 정상 반환).
const EMPTY_SUMMARY: RestorePlanSummary = {
  deleted: group(),
  inserted: group(),
  kept: group(),
};
const RESULT: ImportRestoreResult = {
  outcomes: [],
  deleted: 3,
  inserted: 7,
  summary: SUMMARY,
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
    result?: ImportRestoreResult;
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
      // 반환 shape 는 `{ job, summary }` (T-1295) — job 은 markSucceeded 반환 **인스턴스
      // 그대로**, summary 는 restoreFromDump 결과의 summary **인스턴스 그대로** 다.
      const out = await run(t.service, mode);
      expect(out.job).toBe(SUCCEEDED);
      expect(out.summary).toBe(SUMMARY);
      // MERGE 가 보존한 건수 (kept) 가 요약에 살아있다 — 지역 변수에서 사라지지 않는다.
      expect(out.summary.kept.total).toBe(6);
      expect(out.summary.kept.perEntity.Person).toBe(5);
      expect(out.summary.deleted.perEntity.Group).toBe(1);
      expect(Object.keys(out).sort()).toEqual(["job", "summary"]);
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
      result: { outcomes: [], deleted: 12, inserted: 0, summary: SUMMARY },
    });
    await run(t.service);
    expect(t.markSucceeded).toHaveBeenCalledWith(JOB_ID, ARTIFACT, 0);
  });

  it("negative — restoredRowCount 는 summary.inserted.total 이 아니라 inserted 를 쓴다 (의미 변경 0)", async () => {
    // 두 수치를 일부러 어긋나게 둔다 — 규칙이 summary 로 갈아탔다면 7 대신 7(=4+3) 이
    // 아닌 값이 기록되므로 여기서 잡힌다.
    const summary: RestorePlanSummary = {
      deleted: group(),
      inserted: group({ Assessment: 99 }),
      kept: group(),
    };
    const t = makeRunner({
      result: { outcomes: [], deleted: 0, inserted: 7, summary },
    });
    const out = await run(t.service);
    expect(t.markSucceeded).toHaveBeenCalledWith(JOB_ID, ARTIFACT, 7);
    expect(summary.inserted.total).toBe(99);
    // 반환에는 그 어긋난 요약이 재계산 없이 그대로 실린다.
    expect(out.summary).toBe(summary);
  });

  it("negative — 세 그룹이 모두 total 0 인 빈 요약도 그대로 반환된다 (undefined 로 뭉개지지 않음)", async () => {
    const t = makeRunner({
      result: { outcomes: [], deleted: 0, inserted: 0, summary: EMPTY_SUMMARY },
    });
    const out = await run(t.service);
    expect(out.summary).toBe(EMPTY_SUMMARY);
    expect(out.summary).toBeDefined();
    expect(out.summary.deleted.total).toBe(0);
    expect(out.summary.inserted.total).toBe(0);
    expect(out.summary.kept.total).toBe(0);
    expect(t.markSucceeded).toHaveBeenCalledWith(JOB_ID, ARTIFACT, 0);
  });

  it("negative — runner 는 summary 객체를 변형하지 않는다 (non-mutating)", async () => {
    const summary: RestorePlanSummary = {
      deleted: group({ Person: 2 }),
      inserted: group({ Assessment: 4 }),
      kept: group({ Group: 3 }),
    };
    const before = JSON.parse(JSON.stringify(summary)) as RestorePlanSummary;
    const t = makeRunner({
      result: { outcomes: [], deleted: 2, inserted: 4, summary },
    });
    const out = await run(t.service);
    expect(summary).toEqual(before);
    expect(out.summary).toBe(summary);
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
