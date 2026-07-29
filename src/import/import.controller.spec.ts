// ImportController spec — T-0489 acceptance 박제 (3 endpoint: POST create /
// GET running / GET :id, R-112: happy / error / branch / negative 충분 cover +
// RBAC guard wire + @Roles metadata 단언 + DTO ValidationPipe 검증).
// export.controller.spec.ts (T-0488) 1:1 mirror, 단 본 controller 차이:
//   - DTO 입력이 mode 1 필드 (선택) — scope/dateRange/entitySelector 대신.
//   - create endpoint 의 mode 지정/미지정 분기 (미지정 시 undefined forward → service
//     default 위임).
//   - controller 자체 분기는 파일 누락 400 하나뿐 — mode invariant 400 / requestedById
//     누락 400 / 단건 부재 404 는 ImportJobService, dump 파싱 실패 400 · 실패 사유 기록은
//     ImportJobRunnerService 책임 (raw forward).
//   - 3 endpoint 모두 Admin+ tier (import 는 administrative concern, REQ-045).
//
// 본 spec 은 4 부분 (export.controller.spec mirror):
//   1. Unit-level (controller-only with mocked ImportJobService + ImportJobRunnerService)
//      — create 의 createJob → runJob 배선 계약 (호출 순서 · 인자 결합 · buffer 동일
//      인스턴스 · 반환 forward) / findRunning · findJob forward / 예외 raw propagation 검증.
//   2. guard/@Roles metadata 단언 — Reflector 로 3 핸들러에 @Roles("Admin") +
//      @UseGuards(JwtAuthGuard, RolesGuard) 부착 검증.
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 통과/거부 + ValidationPipe
//      negative + HTTP status 검증.
//   4. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 통과).
//
// PrismaService 는 Controller → Service chain 의 dep 안전성을 위해 jest.mock 으로
// 회피 (export.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    importJob = {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import { ImportMode, type ImportJob } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { ExportEntity } from "../export/export-scope-select";
import * as describeImportModeModule from "../export/import-mode-description";
import type {
  RestorePlanGroupBreakdown,
  RestorePlanSummary,
} from "../export/import-restore-plan-summary";

import { ImportJobRunnerService } from "./import-job-runner.service";
import { ImportJobService } from "./import-job.service";
import {
  ImportController,
  MAX_IMPORT_FILE_SIZE_BYTES,
} from "./import.controller";
import { MulterExceptionFilter } from "./multer-exception.filter";
import type { UploadedDumpFile } from "./uploaded-dump-file";
/* eslint-enable import/first */

// ImportJob fixture — create / findJob 이 반환하는 row shape (import-job.service.spec
// 의 fixture 동형).
function buildImportJobFixture(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: "import-job-default",
    status: "PENDING",
    mode: "REPLACE",
    requestedById: "user-1",
    createdAt: new Date("2026-06-18T00:00:00.000Z"),
    startedAt: null,
    finishedAt: null,
    error: null,
    artifactRef: null,
    restoredRowCount: null,
    ...overrides,
  } as ImportJob;
}

// UploadedDumpFile fixture — @UploadedFile() 가 넘기는 multipart 파일 객체 shape
// (ADR-0055 §Decision 4 local 타입, memoryStorage in-memory buffer). 본 slice (T-1252)
// 는 buffer 를 소비하지 않으므로 진단용 최소 필드만 채운다.
function buildUploadedFile(
  overrides: Partial<UploadedDumpFile> = {},
): UploadedDumpFile {
  return {
    buffer: Buffer.from("dump-artifact-bytes"),
    originalname: "dump.json",
    size: 19,
    mimetype: "application/json",
    ...overrides,
  };
}

// 복원 영향 요약 fixture — runner 가 T-1295 부터 `{ job, summary }` 를 resolve 하므로
// runJob mock 도 그 shape 를 흉내낸다. 집계 규칙은 `summarizeRestorePlan` 소유라 여기서는
// 0-init 5 entity map 위에 지정분만 얹은 plain 값을 쓴다.
// `keptOver` (T-1296) — kept 그룹의 지정분. 기본값을 종전 하드코딩 값 (`{ Person: 2 }`) 으로
// 두어 기존 호출부는 그대로 두고, `{}` 를 넘기면 세 그룹이 전부 total 0 인 **빈 요약** 이 된다
// (negative 케이스 전용 — 새 fixture helper 를 중복 신설하지 않기 위한 인자화).
function buildSummaryFixture(
  over: Partial<Record<ExportEntity, number>> = {},
  keptOver: Partial<Record<ExportEntity, number>> = { Person: 2 },
): RestorePlanSummary {
  const group = (
    over2: Partial<Record<ExportEntity, number>>,
  ): RestorePlanGroupBreakdown => {
    const perEntity: Record<ExportEntity, number> = {
      Assessment: 0,
      Person: 0,
      Group: 0,
      LlmConfig: 0,
      AuditLog: 0,
      ...over2,
    };
    return {
      total: Object.values(perEntity).reduce((sum, n) => sum + n, 0),
      perEntity,
    };
  };
  return {
    deleted: group({}),
    inserted: group(over),
    kept: group(keptOver),
  };
}

// runJob mock 의 resolve 값 — controller 가 `result.job` 만 forward 하는지 보기 위해
// job row 와 요약을 함께 감싼다 (T-1295 반환 shape).
function buildRunResult(
  job: ImportJob,
  summary: RestorePlanSummary = buildSummaryFixture(),
): { job: ImportJob; summary: RestorePlanSummary } {
  return { job, summary };
}

// ImportJobService + ImportJobRunnerService mock factory — 두 의존을 jest.fn() mock 으로
// 만들고 그 위에 조립한 controller 인스턴스까지 함께 돌려준다 (T-1286 배선 이후 모든 unit
// test 가 두 mock 을 함께 필요로 하므로 생성 지점을 한 곳으로 모은다). markFailed mock 은
// 유지한다 — controller 가 더 이상 그것을 부르지 않음 (실패 기록은 runner 몫) 을 단언하기
// 위한 negative 관찰점이다.
function buildServiceMock(): {
  serviceMock: {
    createJob: jest.Mock;
    markFailed: jest.Mock;
    findRunning: jest.Mock;
    findJob: jest.Mock;
  };
  runnerMock: { runJob: jest.Mock };
  controller: ImportController;
} {
  const serviceMock = {
    createJob: jest.fn(),
    markFailed: jest.fn(),
    findRunning: jest.fn(),
    findJob: jest.fn(),
  };
  const runnerMock = { runJob: jest.fn() };
  const service = serviceMock as unknown as ImportJobService;
  const runner = runnerMock as unknown as ImportJobRunnerService;
  return {
    serviceMock,
    runnerMock,
    controller: new ImportController(service, runner),
  };
}

describe("ImportController (unit)", () => {
  // -----------------------------------------------------------------------
  // create (POST /api/admin/import) — happy (actor.sub 를 requestedById 로 결합 +
  // dto.mode forward + runner 위임) + branch (mode 지정/미지정 · 파일 누락) +
  // error/negative (createJob · runJob throw raw propagate). controller 자체 분기는
  // 파일 누락 하나뿐 — 나머지는 service/runner raw forward (T-1286 배선).
  // -----------------------------------------------------------------------
  it("POST create — createJob → runJob 순서로 호출하고 runner 결과(SUCCEEDED)를 그대로 반환 (happy — 실 복원 배선, mode 지정 + 파일 수신)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    const pending = buildImportJobFixture({
      id: "ij-1",
      requestedById: "admin-actor",
      mode: "MERGE",
      status: "PENDING",
    });
    const succeeded = buildImportJobFixture({
      id: "ij-1",
      requestedById: "admin-actor",
      mode: "MERGE",
      status: "SUCCEEDED",
      artifactRef: "dump.json",
      restoredRowCount: 42,
      finishedAt: new Date("2026-06-18T00:00:01.000Z"),
    });
    serviceMock.createJob.mockResolvedValueOnce(pending);
    const summary = buildSummaryFixture({ Assessment: 42 });
    runnerMock.runJob.mockResolvedValueOnce(buildRunResult(succeeded, summary));
    const file = buildUploadedFile();
    const dto = { mode: ImportMode.MERGE };

    const result = await controller.create(file, dto, "admin-actor");

    // createJob 가 actor.sub 결합 + dto.mode forward 로 정확히 1 회 호출됨 검증.
    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: ImportMode.MERGE,
      requestedById: "admin-actor",
    });
    // 생성된 job 의 id/mode + 업로드 buffer/파일명이 runJob 에 정확히 결합됨 검증.
    expect(runnerMock.runJob).toHaveBeenCalledTimes(1);
    expect(runnerMock.runJob).toHaveBeenCalledWith({
      jobId: "ij-1",
      buffer: file.buffer,
      mode: "MERGE",
      artifactRef: "dump.json",
    });
    // buffer 는 복사·slice 없이 같은 인스턴스로 전달된다 (재가공 0).
    expect(runnerMock.runJob.mock.calls[0][0].buffer).toBe(file.buffer);
    // createJob invocation order 가 runJob 보다 앞섬 (호출 순서 검증).
    expect(serviceMock.createJob.mock.invocationCallOrder[0]).toBeLessThan(
      runnerMock.runJob.mock.invocationCallOrder[0],
    );
    // 반환은 runJob 결과의 job (status=SUCCEEDED + restoredRowCount 보존) — PENDING 아님.
    // T-1296: runner 의 `{ job, summary }` 를 job 필드 spread + `restoreSummary` 1 key 로
    // 조립한다 (additive envelope).
    // (a) 기존 필드는 이름·값 전부 불변 — restoreSummary 를 떼어낸 나머지가 job row 와 정확히
    //     일치한다 (필드 삭제·개명 0 + spread 가 기존 필드를 덮어쓰지 않음).
    const { restoreSummary, ...jobFields } = result;
    expect(jobFields).toEqual(succeeded);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.restoredRowCount).toBe(42);
    // (b) 요약은 runner 가 준 **인스턴스 그대로** 실린다 (복제 · 재계산 · 필드 pick 0).
    expect(restoreSummary).toBe(summary);
    expect(restoreSummary).toEqual(summary);
    expect(restoreSummary.inserted.total).toBe(42);
    // restoredRowCount 를 inserted.total 로 덮어쓰지 않는다 — 두 값이 우연히 같아도 출처는
    // 각각 job row / 요약이며 일치를 강제하는 배선이 없다.
    expect(result.restoredRowCount).toBe(succeeded.restoredRowCount);
    // (c) 중첩 envelope 가 아니라 spread 라는 증거 — `summary` / `job` key 는 여전히 없다.
    expect(Object.keys(result)).not.toContain("summary");
    expect(Object.keys(result)).not.toContain("job");
    // 실패 기록은 runner 몫 — controller 는 markFailed 를 호출하지 않는다.
    expect(serviceMock.markFailed).not.toHaveBeenCalled();
  });

  it("POST create — 세 그룹이 전부 total 0 인 빈 요약도 restoreSummary 로 그대로 실린다 (negative — undefined · {} 로 뭉개짐 0)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    const succeeded = buildImportJobFixture({
      id: "ij-empty",
      status: "SUCCEEDED",
      restoredRowCount: 0,
    });
    // 삭제·삽입·보존이 모두 0 건인 복원 (빈 dump 를 MERGE 한 경우 등) 의 요약.
    const emptySummary = buildSummaryFixture({}, {});
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-empty", status: "PENDING" }),
    );
    runnerMock.runJob.mockResolvedValueOnce(
      buildRunResult(succeeded, emptySummary),
    );

    const result = await controller.create(
      buildUploadedFile(),
      { mode: ImportMode.MERGE },
      "admin-actor",
    );

    // 0 뿐인 요약도 falsy 취급으로 뭉개지지 않고 인스턴스 그대로 실린다.
    expect(result.restoreSummary).toBe(emptySummary);
    expect(result.restoreSummary).not.toEqual({});
    expect(result.restoreSummary.deleted.total).toBe(0);
    expect(result.restoreSummary.inserted.total).toBe(0);
    expect(result.restoreSummary.kept.total).toBe(0);
    // perEntity 의 0 값 key 도 5 종 전부 남는다 (0 이라고 지워지지 않음).
    expect(Object.keys(result.restoreSummary.kept.perEntity).sort()).toEqual([
      "Assessment",
      "AuditLog",
      "Group",
      "LlmConfig",
      "Person",
    ]);
  });

  it("POST create — mode 미지정 시 createJob 엔 undefined forward, runJob 엔 job row 의 확정 mode 전달 (branch — schema @default 적용값이 source)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    // dto 는 mode 미지정이나 생성된 row 는 확정 mode(MERGE) 를 갖는다 — runJob 에는
    // dto.mode(undefined) 가 아니라 이 row 값이 흘러야 한다.
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-2", mode: "MERGE", status: "PENDING" }),
    );
    runnerMock.runJob.mockResolvedValueOnce(
      buildRunResult(
        buildImportJobFixture({
          id: "ij-2",
          mode: "MERGE",
          status: "SUCCEEDED",
        }),
      ),
    );
    const dto = {};

    const result = await controller.create(
      buildUploadedFile(),
      dto,
      "admin-actor",
    );

    // mode 미지정 → undefined forward (service 가 schema @default(REPLACE) 적용).
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: undefined,
      requestedById: "admin-actor",
    });
    // runJob 의 mode 는 dto.mode(undefined) 가 아니라 job row 의 확정값.
    const runArg = runnerMock.runJob.mock.calls[0][0];
    expect(runArg.mode).toBe("MERGE");
    expect(runArg.mode).not.toBeUndefined();
    expect(result.status).toBe("SUCCEEDED");
    // 분기 (c) — mode 미지정 경로에서도 응답 envelope 는 같다 (restoreSummary 동봉, T-1296).
    expect(result.restoreSummary.kept.perEntity.Person).toBe(2);
  });

  it("POST create — 파일 누락 (file undefined) 시 BadRequestException(400) 으로 거부 + createJob/runJob 미호출 (error path — ADR-0055 §Follow-up a, 수신 입구 차단)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();

    await expect(
      controller.create(undefined, { mode: ImportMode.REPLACE }, "admin-actor"),
    ).rejects.toBeInstanceOf(BadRequestException);

    // 파일 누락 시 createJob/runJob 은 둘 다 호출되지 않는다 (수신 입구에서 차단).
    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
  });

  it("POST create — createJob 이 BadRequestException (mode invariant 위반) throw 시 삼키지 않고 raw propagate + runJob 미호출 (negative — createJob 실패)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    const badRequest = new BadRequestException(
      "mode 는 REPLACE 또는 MERGE 여야 합니다",
    );
    serviceMock.createJob.mockRejectedValueOnce(badRequest);

    await expect(
      controller.create(
        buildUploadedFile(),
        { mode: ImportMode.REPLACE },
        "admin-actor",
      ),
    ).rejects.toBe(badRequest);

    // createJob 실패 시 복원은 시작되지 않는다 (생성된 job 이 없음).
    expect(runnerMock.runJob).not.toHaveBeenCalled();
    expect(serviceMock.markFailed).not.toHaveBeenCalled();
  });

  it("POST create — createJob 이 ConflictException (진행 중 race 409) throw 시 runJob 미호출 + raw propagate (negative — race 예외 propagate)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    const conflict = new ConflictException("이미 진행 중인 import 가 있습니다");
    serviceMock.createJob.mockRejectedValueOnce(conflict);

    await expect(
      controller.create(buildUploadedFile(), {}, "admin-actor"),
    ).rejects.toBe(conflict);

    expect(runnerMock.runJob).not.toHaveBeenCalled();
    expect(serviceMock.markFailed).not.toHaveBeenCalled();
  });

  it("POST create — createJob 이 던진 raw Error (의존성 fail) 를 그대로 propagate + runJob 미호출 (error path)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.createJob.mockRejectedValueOnce(rawError);

    await expect(
      controller.create(buildUploadedFile(), {}, "admin-actor"),
    ).rejects.toBe(rawError);

    expect(runnerMock.runJob).not.toHaveBeenCalled();
    expect(serviceMock.markFailed).not.toHaveBeenCalled();
  });

  it("POST create — runJob 이 BadRequestException (dump 파싱 실패) 로 reject 시 재랩핑 없이 raw propagate + markFailed 미호출 (error path — 실패 기록은 runner 몫)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-5", status: "PENDING" }),
    );
    const badRequest = new BadRequestException("dump 형식이 올바르지 않습니다");
    runnerMock.runJob.mockRejectedValueOnce(badRequest);

    await expect(
      controller.create(
        buildUploadedFile(),
        { mode: ImportMode.REPLACE },
        "admin-actor",
      ),
    ).rejects.toBe(badRequest);

    // controller 는 예외를 삼키지도, 자체 실패 기록을 남기지도 않는다.
    expect(serviceMock.markFailed).not.toHaveBeenCalled();
  });

  it("POST create — runJob 이 raw Error 로 reject 해도 동일 인스턴스로 propagate (error path — 재랩핑 0)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-6", status: "PENDING" }),
    );
    const rawError = new Error("restore transaction aborted");
    runnerMock.runJob.mockRejectedValueOnce(rawError);

    await expect(
      controller.create(buildUploadedFile(), {}, "admin-actor"),
    ).rejects.toBe(rawError);

    expect(serviceMock.markFailed).not.toHaveBeenCalled();
  });

  it("POST create — 반환 job 이 PENDING 으로 남지 않고 runner 결과로 마감됨 (negative — false-success 차단 회귀)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-3", status: "PENDING" }),
    );
    runnerMock.runJob.mockResolvedValueOnce(
      buildRunResult(
        buildImportJobFixture({
          id: "ij-3",
          status: "SUCCEEDED",
          restoredRowCount: 7,
        }),
      ),
    );

    const result = await controller.create(
      buildUploadedFile(),
      { mode: ImportMode.REPLACE },
      "admin-actor",
    );

    // false-success 차단 불변: 반환 status 는 생성 직후의 PENDING 이 아니라 복원 결과다.
    expect(result.status).not.toBe("PENDING");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.restoredRowCount).toBe(7);
  });

  it("POST create — buffer 를 재가공 없이 같은 인스턴스로 runner 에 넘김 (negative — Buffer.from/slice/toString 호출 0)", async () => {
    const { serviceMock, runnerMock, controller } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-4", status: "PENDING" }),
    );
    runnerMock.runJob.mockResolvedValueOnce(
      buildRunResult(
        buildImportJobFixture({ id: "ij-4", status: "SUCCEEDED" }),
      ),
    );
    const file = buildUploadedFile();
    // 복사·문자열화 감지 spy — controller 가 buffer 를 재가공하면 여기서 잡힌다.
    const sliceSpy = jest.spyOn(file.buffer, "subarray");
    const toStringSpy = jest.spyOn(file.buffer, "toString");

    await controller.create(file, { mode: ImportMode.REPLACE }, "admin-actor");

    expect(runnerMock.runJob.mock.calls[0][0].buffer).toBe(file.buffer);
    expect(sliceSpy).not.toHaveBeenCalled();
    expect(toStringSpy).not.toHaveBeenCalled();
    sliceSpy.mockRestore();
    toStringSpy.mockRestore();
  });

  // -----------------------------------------------------------------------
  // findRunning (GET /api/admin/import/running) — happy (목록 forward) + 빈 배열 분기.
  // -----------------------------------------------------------------------
  it("GET running — service.findRunning 결과 목록을 그대로 forward (happy — polling 목록)", async () => {
    const { serviceMock, controller } = buildServiceMock();
    const rows = [
      buildImportJobFixture({ id: "ij-r1", status: "RUNNING" }),
      buildImportJobFixture({ id: "ij-r2", status: "RUNNING" }),
    ];
    serviceMock.findRunning.mockResolvedValueOnce(rows);

    const result = await controller.findRunning();

    expect(serviceMock.findRunning).toHaveBeenCalledTimes(1);
    expect(result).toBe(rows);
  });

  it("GET running — 매칭 0 시 빈 배열 그대로 forward (branch — 빈 결과도 정상)", async () => {
    const { serviceMock, controller } = buildServiceMock();
    serviceMock.findRunning.mockResolvedValueOnce([]);

    await expect(controller.findRunning()).resolves.toEqual([]);
  });

  it("GET running — service 가 던진 raw Error 를 그대로 propagate (error path)", async () => {
    const { serviceMock, controller } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findRunning.mockRejectedValueOnce(rawError);

    await expect(controller.findRunning()).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // findJob (GET /api/admin/import/:id) — happy (단건 forward) + error/negative
  // (부재 시 service NotFoundException raw propagate).
  // -----------------------------------------------------------------------
  it("GET :id — service.findJob(:id) 결과 단건을 그대로 forward (happy — polling 단건)", async () => {
    const { serviceMock, controller } = buildServiceMock();
    const fixture = buildImportJobFixture({ id: "ij-7" });
    serviceMock.findJob.mockResolvedValueOnce(fixture);

    const result = await controller.findJob("ij-7");

    expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
    expect(serviceMock.findJob).toHaveBeenCalledWith("ij-7");
    expect(result).toBe(fixture);
  });

  it("GET :id — service 의 NotFoundException (job 부재 P2025→404) 을 raw propagate (negative — 부재 job)", async () => {
    const { serviceMock, controller } = buildServiceMock();
    const notFound = new NotFoundException("import job not found: missing");
    serviceMock.findJob.mockRejectedValueOnce(notFound);

    await expect(controller.findJob("missing")).rejects.toBe(notFound);
  });

  it("GET :id — service 가 던진 raw Error (의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { serviceMock, controller } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findJob.mockRejectedValueOnce(rawError);

    await expect(controller.findJob("ij-x")).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // describeModes (GET /api/admin/import/modes) — 고정 2-mode 산출 (T-0493,
  // describeImportMode 실호출 배선). client 입력 분기 없음 (고정 REPLACE/MERGE) — 분기
  // cover 는 두 mode 산출 경로 각각. helper 에 넘기는 인자가 항상 "replace"/"merge"
  // 두 lowercase 값뿐(임의 입력 forward 0)임도 spy 로 단언. service 의존 0 (helper 는
  // 순수 함수).
  // -----------------------------------------------------------------------
  it("GET modes — REPLACE/MERGE 두 mode 설명 2 원소 배열 반환 (happy — helper 산출 일치)", () => {
    const { controller } = buildServiceMock();

    const result = controller.describeModes();

    expect(result).toHaveLength(2);
    // (a) REPLACE 변환 → destructive=true 산출 경로.
    expect(result[0].reason).toBe("replace");
    expect(result[0].destructive).toBe(true);
    expect(result[0].headline.length).toBeGreaterThan(0);
    expect(result[0].detailLines.length).toBeGreaterThan(0);
    // (b) MERGE 변환 → destructive=false 산출 경로.
    expect(result[1].reason).toBe("merge");
    expect(result[1].destructive).toBe(false);
    expect(result[1].headline.length).toBeGreaterThan(0);
    expect(result[1].detailLines.length).toBeGreaterThan(0);
  });

  it("GET modes — helper 에 넘기는 인자가 정확히 'replace'/'merge' 두 lowercase 값뿐 (error path — enum→lowercase 매핑 계약, 임의 입력 forward 0)", () => {
    const { controller } = buildServiceMock();
    const helperSpy = jest.spyOn(
      describeImportModeModule,
      "describeImportMode",
    );

    controller.describeModes();

    // controller 가 helper 에 forward 한 인자가 정확히 두 lowercase ImportRestoreMode 뿐.
    // enum→lowercase 매핑이 깨져 "REPLACE" 등이 새면 helper 의 RangeError 계약을 어김.
    expect(helperSpy.mock.calls.map((c) => c[0])).toEqual(["replace", "merge"]);
    helperSpy.mockRestore();
  });

  it("GET modes — 반환 배열이 정확히 2 원소이며 replace/merge reason 만 포함 (negative — 중복/누락 없음)", () => {
    const { controller } = buildServiceMock();

    const reasons = controller.describeModes().map((d) => d.reason);

    expect(reasons).toEqual(["replace", "merge"]);
  });
});

// -----------------------------------------------------------------------
// guard/@Roles metadata 단언 (T-0489) — Reflector 로 create/findRunning/findJob
// 핸들러에 @Roles("Admin") + @UseGuards(JwtAuthGuard, RolesGuard) 부착 검증. RBAC
// 게이트가 실제로 라우트를 gate 하는지를 metadata 수준에서 단언 (guard 실행 자체의
// 401/403 live 검증은 아래 integration block).
// -----------------------------------------------------------------------
describe("ImportController (guard/@Roles metadata)", () => {
  const reflector = new Reflector();

  it.each([
    ["create", ImportController.prototype.create],
    ["findRunning", ImportController.prototype.findRunning],
    ["describeModes", ImportController.prototype.describeModes],
    ["findJob", ImportController.prototype.findJob],
  ])(
    "%s 핸들러에 @Roles('Admin') metadata 부착 (Admin+ tier gate)",
    (_name, handler) => {
      const roles = reflector.get<string[]>(ROLES_METADATA_KEY, handler);
      expect(roles).toEqual(["Admin"]);
    },
  );

  it.each([
    ["create", ImportController.prototype.create],
    ["findRunning", ImportController.prototype.findRunning],
    ["describeModes", ImportController.prototype.describeModes],
    ["findJob", ImportController.prototype.findJob],
  ])(
    "%s 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증+RBAC gate)",
    (_name, handler) => {
      const guards = Reflect.getMetadata("__guards__", handler) as unknown[];
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    },
  );
});

// -----------------------------------------------------------------------
// T-1253 — 크기 상한 상수 + MulterExceptionFilter 배선 (ADR-0055 §Decision 3).
// create() 핸들러에 @UseFilters(MulterExceptionFilter) 가 부착돼 multer 예외를 4xx 로
// 매핑함 + 업로드 크기 상한 상수가 정의됨을 metadata/상수 수준에서 단언한다. 필터의
// 실 매핑 분기 (413/400/passthrough/500) 는 multer-exception.filter.spec.ts 가 cover.
// -----------------------------------------------------------------------
describe("ImportController (T-1253 크기 상한 + 예외 필터 배선)", () => {
  it("create 핸들러에 @UseFilters(MulterExceptionFilter) 부착 (multer 예외 4xx 매핑 gate)", () => {
    const filters = Reflect.getMetadata(
      "__exceptionFilters__",
      ImportController.prototype.create,
    ) as unknown[];
    // @UseFilters 는 필터 클래스(또는 인스턴스)를 metadata 로 부착한다.
    expect(filters).toContain(MulterExceptionFilter);
  });

  it("MAX_IMPORT_FILE_SIZE_BYTES 크기 상한 상수가 양의 정수로 정의됨 (DoS 표면 차단 상한 강제 — ADR-0055 §Decision 3)", () => {
    expect(Number.isInteger(MAX_IMPORT_FILE_SIZE_BYTES)).toBe(true);
    expect(MAX_IMPORT_FILE_SIZE_BYTES).toBeGreaterThan(0);
    // 50 MiB — 현실적 dump 규모에 충분한 여유 + memoryStorage 메모리 상한.
    expect(MAX_IMPORT_FILE_SIZE_BYTES).toBe(50 * 1024 * 1024);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire + ValidationPipe negative + HTTP status 검증
// (T-0489). JwtAuthGuard / RolesGuard 통과/거부 분기를 overrideGuard 로 박제 +
// DTO 검증 (mode enum / forbidNonWhitelisted) negative.
// export.controller.spec 의 "RBAC guard integration" mirror.
// -----------------------------------------------------------------------
describe("ImportController (RBAC guard + ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    createJob: jest.Mock;
    markFailed: jest.Mock;
    findRunning: jest.Mock;
    findJob: jest.Mock;
  };
  let runnerMock: { runJob: jest.Mock };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환 (@CurrentUser("sub") 가 읽음).
  function makeAllowingJwtGuard(sub: string, role: string) {
    return {
      canActivate: (ctx: ExecutionContext): boolean => {
        const req = ctx.switchToHttp().getRequest<Request>();
        (req as Request & { user?: { sub: string; role: string } }).user = {
          sub,
          role,
        };
        return true;
      },
    };
  }

  const ALLOW_ALL_ROLES = { canActivate: (): boolean => true };

  // 유효 body — mode 미지정 (빈 body) 도 유효 (선택 필드). 명시 시 REPLACE/MERGE.
  const VALID_BODY = { mode: "REPLACE" };

  // 업로드 raw 본문 sentinel (T-1296) — 응답 envelope 가 넓어져도 업로드 원문 조각이 body 로
  // 새지 않음 (REQ-032) 을 확인하는 고유 문자열.
  const UPLOAD_RAW_SENTINEL = "T1296-upload-raw-must-not-be-in-body";

  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = {
      createJob: jest.fn(),
      markFailed: jest.fn(),
      findRunning: jest.fn(),
      findJob: jest.fn(),
    };
    runnerMock = { runJob: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [
        { provide: ImportJobService, useValue: serviceMock },
        { provide: ImportJobRunnerService, useValue: runnerMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(opts.jwt)
      .overrideGuard(RolesGuard)
      .useValue(opts.roles)
      .compile();

    const a = moduleRef.createNestApplication();
    await a.init();
    return a;
  }

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  // == POST /api/admin/import — create endpoint =====================================

  // -- happy — Admin 통과 시 201 + 파일 수신 + actor.sub 결합 위임 + 실 복원 SUCCEEDED --
  it("POST — Admin role 통과 시 201 + 파일 수신 + createJob → runJob 위임 후 SUCCEEDED body 반환 (happy — Admin+ tier + 실 복원 배선)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({
        id: "ij-c",
        requestedById: "admin-1",
        status: "PENDING",
      }),
    );
    const summary = buildSummaryFixture({ Assessment: 12 });
    runnerMock.runJob.mockResolvedValueOnce(
      buildRunResult(
        buildImportJobFixture({
          id: "ij-c",
          requestedById: "admin-1",
          status: "SUCCEEDED",
          artifactRef: "dump.json",
          restoredRowCount: 12,
        }),
        summary,
      ),
    );

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(201);

    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    // actor.sub (JwtAuthGuard 가 박제) 가 requestedById 로 결합됨 검증. mode 는
    // multipart form field (문자열 "REPLACE") 로 도착 → ValidationPipe(transform) 통과.
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: "REPLACE",
      requestedById: "admin-1",
    });
    // runner 에 job.id + 업로드 buffer/파일명 + job row 의 mode 가 결합돼 전달된다.
    expect(runnerMock.runJob).toHaveBeenCalledTimes(1);
    const runArg = runnerMock.runJob.mock.calls[0][0];
    expect(runArg.jobId).toBe("ij-c");
    expect(runArg.mode).toBe("REPLACE");
    expect(runArg.artifactRef).toBe("dump.json");
    expect(Buffer.isBuffer(runArg.buffer)).toBe(true);
    // 응답 body 는 runner 결과 (SUCCEEDED + restoredRowCount) — interim FAILED 아님.
    expect(res.body.id).toBe("ij-c");
    expect(res.body.status).toBe("SUCCEEDED");
    expect(res.body.restoredRowCount).toBe(12);
    // T-1296 응답 envelope 확장 — 요약이 `restoreSummary` 한 key 로 실 HTTP body 에 실린다.
    // 값은 runner 가 준 요약과 deep-equal (직렬화 왕복에서 수치 손실 0).
    expect(res.body.restoreSummary).toEqual(summary);
    // 중첩 envelope 가 아니라 spread 라는 증거 — `summary` / `job` key 는 나타나지 않는다.
    expect(res.body).not.toHaveProperty("summary");
    expect(res.body).not.toHaveProperty("job");
  });

  // -- negative — 직렬화 왕복에서 perEntity 0 값 key 보존 + 기존 필드 무충돌 + raw 미포함 --
  it("POST — restoreSummary 가 직렬화 왕복에서 0 값 perEntity key 를 보존하고 기존 job 필드와 충돌하지 않는다 (negative — 필드 누락 0 + REQ-032)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    const job = buildImportJobFixture({
      id: "ij-sum",
      requestedById: "admin-1",
      mode: "MERGE",
      status: "SUCCEEDED",
      artifactRef: "dump.json",
      restoredRowCount: 3,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-sum", mode: "MERGE", status: "PENDING" }),
    );
    // deleted 는 전부 0, inserted 는 Group 3, kept 는 Person 1 — 0 값 key 가 섞인 요약.
    const summary = buildSummaryFixture({ Group: 3 }, { Person: 1 });
    runnerMock.runJob.mockResolvedValueOnce(buildRunResult(job, summary));

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "MERGE")
      .attach("file", Buffer.from(UPLOAD_RAW_SENTINEL), "dump.json")
      .expect(201);

    // (a) 0 값 entity key 가 JSON 왕복 후에도 5 종 전부 남는다 (0 이라고 누락되지 않음).
    expect(
      Object.keys(res.body.restoreSummary.deleted.perEntity).sort(),
    ).toEqual(["Assessment", "AuditLog", "Group", "LlmConfig", "Person"]);
    expect(res.body.restoreSummary.deleted.total).toBe(0);
    expect(res.body.restoreSummary.inserted.perEntity.Group).toBe(3);
    expect(res.body.restoreSummary.inserted.perEntity.Assessment).toBe(0);
    expect(res.body.restoreSummary.kept.perEntity.Person).toBe(1);
    // (b) 기존 job 필드는 mock job 값과 정확히 일치한다 (spread 충돌 · 덮어쓰기 0).
    expect(res.body.id).toBe(job.id);
    expect(res.body.mode).toBe("MERGE");
    expect(res.body.status).toBe("SUCCEEDED");
    expect(res.body.restoredRowCount).toBe(3);
    expect(res.body.artifactRef).toBe("dump.json");
    expect(res.body.error).toBeNull();
    // restoredRowCount 는 inserted.total(3) 과 우연히 같아도 job row 값 그대로다 — 요약으로
    // 덮어쓰는 배선이 없다 (의미 변경 0).
    expect(res.body.restoreSummary.inserted.total).toBe(3);
    // (c) REQ-032 — 업로드 raw 본문 조각이 응답 body 어디에도 실리지 않는다.
    expect(JSON.stringify(res.body)).not.toContain(UPLOAD_RAW_SENTINEL);
  });

  // -- error path — 파일 누락 (multipart 이나 file 필드 없음) 시 400 + service 미호출 --
  it("POST — 파일 누락 시 400 + service 미호출 (error path — ADR-0055 §Follow-up a 파일 누락 분기)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    // file 첨부 없이 mode form field 만 → controller 의 file undefined 분기 → 400.
    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
    // 조립 지점에 도달하지 못하므로 400 body 에 restoreSummary 가 실리지 않는다 (T-1296).
    expect(res.body).not.toHaveProperty("restoreSummary");
  });

  // -- happy/branch — mode 미지정 (form field 없음) + 파일 수신 시 201 + undefined forward -
  it("POST — mode 미지정 (form field 없음) + 파일 수신 시 201 + createJob 엔 undefined / runJob 엔 job row mode (branch — service default 위임)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-d", mode: "MERGE", status: "PENDING" }),
    );
    runnerMock.runJob.mockResolvedValueOnce(
      buildRunResult(
        buildImportJobFixture({
          id: "ij-d",
          mode: "MERGE",
          status: "SUCCEEDED",
        }),
      ),
    );

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(201);

    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: undefined,
      requestedById: "admin-1",
    });
    // 복원은 dto 가 아닌 job row 의 확정 mode 로 실행된다.
    expect(runnerMock.runJob.mock.calls[0][0].mode).toBe("MERGE");
    expect(res.body.status).toBe("SUCCEEDED");
    // 분기 (c) — mode 미지정 경로의 응답 shape 도 동일하다 (restoreSummary 동봉, T-1296).
    expect(res.body.restoreSummary.kept.perEntity.Person).toBe(2);
  });

  // -- negative — service BadRequestException (mode invariant) → 400 (raw propagate) -
  it("POST — service 가 BadRequestException (mode invariant 위반) throw 시 400 + runJob 미호출 (negative 핵심 — mode invariant)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockRejectedValueOnce(
      new BadRequestException("requestedById 는 필수입니다"),
    );

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(400);

    expect(runnerMock.runJob).not.toHaveBeenCalled();
  });

  // -- error path — runJob reject (dump 파싱 실패) → 400 표면화 (raw propagate) -------
  it("POST — runJob 이 BadRequestException (dump 파싱 실패) 로 reject 시 400 표면화 (error path — 복원 실패의 HTTP 표면)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-e", status: "PENDING" }),
    );
    runnerMock.runJob.mockRejectedValueOnce(
      new BadRequestException("dump 형식이 올바르지 않습니다"),
    );

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(400);

    // 실패 기록은 runner 몫 — controller 는 자체 markFailed 를 부르지 않는다.
    expect(serviceMock.markFailed).not.toHaveBeenCalled();
    // reject 는 조립 이전에 raw propagate 되므로 요약이 실리지 않는다 (T-1296 — 실패 응답의
    // envelope 는 종전 그대로).
    expect(res.body).not.toHaveProperty("restoreSummary");
  });

  // -- error path — runJob raw Error reject → 500 표면화 (재랩핑 0) -------------------
  it("POST — runJob 이 raw Error 로 reject 시 500 표면화 (error path — 예외 삼킴 0)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-f", status: "PENDING" }),
    );
    runnerMock.runJob.mockRejectedValueOnce(new Error("restore aborted"));

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(500);
  });

  // -- negative — ValidationPipe: 잘못된 mode enum 값 (form field) → 400 + service 미호출 --
  it("POST — 잘못된 mode enum 값 (form field PATCH) 시 400 + service 미호출 (negative — invalid enum, multipart form field 검증)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    // 파일은 정상 첨부하되 mode form field 가 비유효 → ValidationPipe 가 400 (파일 누락 아님).
    await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "PATCH")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: 정의되지 않은 raw 본문 키 (form field) → 400 + service 미호출 --
  it("POST — 정의되지 않은 extra form field (raw payload) 포함 시 400 + service 미호출 (negative — forbidNonWhitelisted, ADR-0044 §2)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .field("rawPayload", "secret-leak")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: requestedById 를 form field 로 위장 시도 → 400 ----------
  it("POST — form field 에 requestedById 위장 키 포함 시 400 + service 미호출 (negative — actor 위장 차단)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .field("requestedById", "spoofed-victim")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) + service 미호출 -----------
  it("POST — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .send(VALID_BODY)
      .expect(401);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
    // 미인증 응답에도 요약은 없다 (guard 가 조립 이전에 차단 — T-1296).
    expect(res.body).not.toHaveProperty("restoreSummary");
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("POST — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
    // 권한 미달 응답에도 요약은 없다 (tier 미달이 조립 이전에 차단 — T-1296).
    expect(res.body).not.toHaveProperty("restoreSummary");
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ----------------
  it("POST — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .field("mode", "REPLACE")
      .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
      .expect(500);
  });

  // == GET /api/admin/import/running — findRunning endpoint ========================

  // -- happy — Admin 통과 시 200 + 목록 forward (running segment 가 :id 로 포착 안 됨) -
  it("GET running — Admin role 통과 시 200 + service.findRunning 목록 forward (happy — 라우트 우선순위)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findRunning.mockResolvedValueOnce([
      buildImportJobFixture({ id: "ij-r1", status: "RUNNING" }),
    ]);

    const res = await request(app.getHttpServer())
      .get("/api/admin/import/running")
      .expect(200);

    // "running" 이 findRunning 으로 라우트됨 (findJob 의 :id 로 포착 안 됨) 검증.
    expect(serviceMock.findRunning).toHaveBeenCalledTimes(1);
    expect(serviceMock.findJob).not.toHaveBeenCalled();
    expect(res.body[0].id).toBe("ij-r1");
  });

  // -- negative — 403 (User actor) on running ------------------------------------
  it("GET running — RolesGuard reject 시 403 + service 미호출 (negative — User actor)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/admin/import/running")
      .expect(403);

    expect(serviceMock.findRunning).not.toHaveBeenCalled();
  });

  // == GET /api/admin/import/modes — describeModes endpoint =========================

  // -- happy — Admin 통과 시 200 + 2 원소 설명 배열 (modes 가 :id 로 포착 안 됨) -------
  it("GET modes — Admin role 통과 시 200 + REPLACE/MERGE 2 원소 설명 배열 (happy — 라우트 우선순위 + helper 산출)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    const res = await request(app.getHttpServer())
      .get("/api/admin/import/modes")
      .expect(200);

    // "modes" 가 describeModes 로 라우트됨 (findJob 의 :id 로 포착 안 됨) 검증.
    expect(serviceMock.findJob).not.toHaveBeenCalled();
    expect(res.body).toHaveLength(2);
    expect(res.body[0].reason).toBe("replace");
    expect(res.body[0].destructive).toBe(true);
    expect(res.body[0].headline.length).toBeGreaterThan(0);
    expect(res.body[0].detailLines.length).toBeGreaterThan(0);
    expect(res.body[1].reason).toBe("merge");
    expect(res.body[1].destructive).toBe(false);
  });

  // -- negative — 401 (인증 부재) on modes + service 무관 --------------------------
  it("GET modes — JwtAuthGuard reject 시 401 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/admin/import/modes")
      .expect(401);
  });

  // -- negative — 403 (User actor) on modes ---------------------------------------
  it("GET modes — RolesGuard reject 시 403 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/admin/import/modes")
      .expect(403);
  });

  // == GET /api/admin/import/:id — findJob endpoint ================================

  // -- happy — Admin 통과 시 200 + 단건 forward ------------------------------------
  it("GET :id — Admin role 통과 시 200 + service.findJob(:id) 단건 forward (happy)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-7" }),
    );

    const res = await request(app.getHttpServer())
      .get("/api/admin/import/ij-7")
      .expect(200);

    expect(serviceMock.findJob).toHaveBeenCalledWith("ij-7");
    expect(res.body.id).toBe("ij-7");
  });

  // -- negative — service NotFoundException (부재 job) → 404 (raw propagate) --------
  it("GET :id — service 가 NotFoundException (부재 job) throw 시 404 (negative 핵심 — 부재 job)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findJob.mockRejectedValueOnce(
      new NotFoundException("import job not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/admin/import/missing")
      .expect(404);
  });

  // -- negative — 401 (인증 부재) on :id ------------------------------------------
  it("GET :id — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/admin/import/ij-7")
      .expect(401);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // -- negative — 403 (User actor) on :id -----------------------------------------
  it("GET :id — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/admin/import/ij-7")
      .expect(403);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 로 Admin+ tier 분기 박제 (mock 이 아닌
// 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제), RolesGuard 는
// 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). export.controller.spec 동일
// describe mirror. 3 endpoint 모두 Admin+ — User 403 / Admin·SuperAdmin 통과.
// -----------------------------------------------------------------------
describe("ImportController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    createJob: jest.Mock;
    markFailed: jest.Mock;
    findRunning: jest.Mock;
    findJob: jest.Mock;
  };
  let runnerMock: { runJob: jest.Mock };

  const VALID_BODY = { mode: "REPLACE" };

  function makeAllowingJwtGuard(sub: string, role: string) {
    return {
      canActivate: (ctx: ExecutionContext): boolean => {
        const req = ctx.switchToHttp().getRequest<Request>();
        (req as Request & { user?: { sub: string; role: string } }).user = {
          sub,
          role,
        };
        return true;
      },
    };
  }

  // 실 RolesGuard 사용 — JwtAuthGuard 만 override (req.user 박제). RolesGuard 는 실
  // provider (Reflector 자동 주입) 그대로.
  async function buildAppWithRealRolesGuard(
    actorRole: string,
  ): Promise<INestApplication> {
    serviceMock = {
      createJob: jest.fn(),
      markFailed: jest.fn(),
      findRunning: jest.fn(),
      findJob: jest.fn(),
    };
    runnerMock = { runJob: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [
        { provide: ImportJobService, useValue: serviceMock },
        { provide: ImportJobRunnerService, useValue: runnerMock },
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(makeAllowingJwtGuard("actor-1", actorRole))
      .compile();

    const a = moduleRef.createNestApplication();
    await a.init();
    return a;
  }

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  // POST Admin+ tier — User actor 는 403 차단 (실 RolesGuard escalation).
  it("POST — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(runnerMock.runJob).not.toHaveBeenCalled();
  });

  // POST — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 201.
  it.each(["Admin", "SuperAdmin"])(
    "POST — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.createJob.mockResolvedValueOnce(
        buildImportJobFixture({ status: "PENDING" }),
      );
      runnerMock.runJob.mockResolvedValueOnce(
        buildRunResult(
          buildImportJobFixture({ status: "SUCCEEDED", restoredRowCount: 3 }),
        ),
      );

      await request(app.getHttpServer())
        .post("/api/admin/import")
        .field("mode", "REPLACE")
        .attach("file", Buffer.from("dump-artifact-bytes"), "dump.json")
        .expect(201);

      expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
      expect(runnerMock.runJob).toHaveBeenCalledTimes(1);
    },
  );

  // GET modes Admin+ tier — User actor 는 403 차단 (실 RolesGuard escalation).
  it("GET modes — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .get("/api/admin/import/modes")
      .expect(403);
  });

  // GET modes — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 200.
  it.each(["Admin", "SuperAdmin"])(
    "GET modes — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);

      const res = await request(app.getHttpServer())
        .get("/api/admin/import/modes")
        .expect(200);

      expect(res.body).toHaveLength(2);
    },
  );

  // GET :id Admin+ tier — User actor 는 403 차단 (실 RolesGuard escalation).
  it("GET :id — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .get("/api/admin/import/ij-7")
      .expect(403);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // GET :id — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 200.
  it.each(["Admin", "SuperAdmin"])(
    "GET :id — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findJob.mockResolvedValueOnce(buildImportJobFixture());

      await request(app.getHttpServer())
        .get("/api/admin/import/ij-7")
        .expect(200);

      expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
    },
  );
});
