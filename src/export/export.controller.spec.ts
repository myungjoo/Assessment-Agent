// ExportController spec — T-0488 acceptance 박제 (3 endpoint: POST create /
// GET running / GET :id, R-112: happy / error / branch / negative 충분 cover +
// RBAC guard wire + @Roles metadata 단언 + DTO ValidationPipe 검증).
// user-instance-access.controller.spec.ts (T-0238) 1:1 mirror, 단 본 controller 차이:
//   - 3 endpoint (POST create / GET running 목록 / GET :id 단건) — 1 mutation +
//     2 read polling 경로 (UC-07 §8 status polling).
//   - controller 자체 분기 없음 — scope invariant 400 / 단건 부재 404 는 전부
//     ExportJobService 책임 (raw forward). controller 는 actor.sub 를 requestedById 로
//     결합 + dto 를 service 로 forward 만 함 → forward 검증 + service-throw raw
//     propagation 으로 cover.
//   - 3 endpoint 모두 Admin+ tier (export 는 administrative concern, REQ-045).
//   - DTO 검증 — scope enum / forbidNonWhitelisted / missing 을 ValidationPipe
//     integration block 에서 cover (DTO 전용 형식 검증은 create-export.dto.spec.ts).
//
// 본 spec 은 4 부분 (user-instance-access.controller.spec mirror):
//   1. Unit-level (controller-only with mocked ExportJobService) — create/findRunning/
//      findJob 의 service 호출 인자 (actor id 결합 포함) / 반환 forward / 예외 raw
//      propagation 검증.
//   2. guard/@Roles metadata 단언 — Reflector 로 3 핸들러에 @Roles("Admin") +
//      @UseGuards(JwtAuthGuard, RolesGuard) 부착 검증.
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 통과/거부 + ValidationPipe
//      negative + HTTP status 검증.
//   4. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 통과).
//
// PrismaService 는 Controller → Service chain 의 dep 안전성을 위해 jest.mock 으로
// 회피 (user-instance-access.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    exportJob = {
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
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import { ExportScope, JobStatus, type ExportJob } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import * as describeExportJobStatusModule from "./export-job-status-view";
import { ExportJobService } from "./export-job.service";
import * as describeExportScopeModule from "./export-scope-description";
import { ExportController } from "./export.controller";
/* eslint-enable import/first */

// ExportJob fixture — create / findJob 이 반환하는 row shape (export-job.service.spec
// 의 buildExportJobFixture 동형).
function buildExportJobFixture(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: "export-job-default",
    status: "PENDING",
    scope: "FULL",
    dateRange: null,
    entitySelector: null,
    requestedById: "user-1",
    createdAt: new Date("2026-06-18T00:00:00.000Z"),
    startedAt: null,
    finishedAt: null,
    error: null,
    artifactRef: null,
    ...overrides,
  } as ExportJob;
}

// ExportJobService mock factory — create / findRunning / findJob jest.fn().
function buildServiceMock(): {
  service: ExportJobService;
  serviceMock: {
    createJob: jest.Mock;
    findRunning: jest.Mock;
    findJob: jest.Mock;
    previewSelection: jest.Mock;
  };
} {
  const serviceMock = {
    createJob: jest.fn(),
    findRunning: jest.fn(),
    findJob: jest.fn(),
    previewSelection: jest.fn(),
  };
  return {
    service: serviceMock as unknown as ExportJobService,
    serviceMock,
  };
}

describe("ExportController (unit)", () => {
  // -----------------------------------------------------------------------
  // create (POST /api/admin/export) — happy (actor.sub 를 requestedById 로 결합 +
  // dto.scope/dateRange/entitySelector 정확 forward) + error/negative (service throw
  // raw propagate). controller 자체 분기 없음 — service raw forward.
  // -----------------------------------------------------------------------
  it("POST create — actor.sub 를 requestedById 로 결합해 service.createJob 호출 + 반환 forward (happy, FULL scope)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildExportJobFixture({
      id: "ej-1",
      requestedById: "admin-actor",
    });
    serviceMock.createJob.mockResolvedValueOnce(fixture);
    const dto = { scope: ExportScope.FULL };

    const controller = new ExportController(service);
    const result = await controller.create(dto, "admin-actor");

    // service.createJob 가 actor.sub 결합 + dto forward 로 정확히 1 회 호출됨 검증.
    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      scope: ExportScope.FULL,
      requestedById: "admin-actor",
      dateRange: undefined,
      entitySelector: undefined,
    });
    // 생성된 job (status=PENDING) 을 그대로 forward.
    expect(result).toBe(fixture);
  });

  it("POST create — RANGE scope 의 dateRange 도 그대로 forward (branch — scope별 입력 분기)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildExportJobFixture({ scope: "RANGE" }),
    );
    const dto = {
      scope: ExportScope.RANGE,
      dateRange: { start: "2026-01-01", end: "2026-03-31" },
    };

    const controller = new ExportController(service);
    await controller.create(dto, "admin-actor");

    expect(serviceMock.createJob).toHaveBeenCalledWith({
      scope: ExportScope.RANGE,
      requestedById: "admin-actor",
      dateRange: { start: "2026-01-01", end: "2026-03-31" },
      entitySelector: undefined,
    });
  });

  it("POST create — PARTIAL scope 의 entitySelector (entity 이름 배열) 도 그대로 forward (branch — scope별 입력 분기)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildExportJobFixture({ scope: "PARTIAL" }),
    );
    // entitySelector 는 validateExportScope 헬퍼가 요구하는 entity 이름 string[] 배열
    // (T-0491 round2 BLOCKER fix — 구 object shape `{ personIds: [...] }` 는 helper 계약
    // 위반이라 정정). DTO 의 @IsArray 와 정합.
    const dto = {
      scope: ExportScope.PARTIAL,
      entitySelector: ["Person", "Group"],
    };

    const controller = new ExportController(service);
    await controller.create(dto, "admin-actor");

    expect(serviceMock.createJob).toHaveBeenCalledWith({
      scope: ExportScope.PARTIAL,
      requestedById: "admin-actor",
      dateRange: undefined,
      entitySelector: ["Person", "Group"],
    });
  });

  it("POST create — service 의 BadRequestException (scope invariant 위반) 을 삼키지 않고 raw propagate (negative — scope invariant)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const badRequest = new BadRequestException(
      "scope=RANGE 는 dateRange 가 필요합니다",
    );
    serviceMock.createJob.mockRejectedValueOnce(badRequest);

    const controller = new ExportController(service);
    await expect(
      controller.create({ scope: ExportScope.RANGE }, "admin-actor"),
    ).rejects.toBe(badRequest);
  });

  it("POST create — service 가 던진 raw Error (의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.createJob.mockRejectedValueOnce(rawError);

    const controller = new ExportController(service);
    await expect(
      controller.create({ scope: ExportScope.FULL }, "admin-actor"),
    ).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // findRunning (GET /api/admin/export/running) — happy (목록 forward) + 빈 배열 분기.
  // -----------------------------------------------------------------------
  it("GET running — service.findRunning 결과 목록을 그대로 forward (happy — polling 목록)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rows = [
      buildExportJobFixture({ id: "ej-r1", status: "RUNNING" }),
      buildExportJobFixture({ id: "ej-r2", status: "RUNNING" }),
    ];
    serviceMock.findRunning.mockResolvedValueOnce(rows);

    const controller = new ExportController(service);
    const result = await controller.findRunning();

    expect(serviceMock.findRunning).toHaveBeenCalledTimes(1);
    expect(result).toBe(rows);
  });

  it("GET running — 매칭 0 시 빈 배열 그대로 forward (branch — 빈 결과도 정상)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findRunning.mockResolvedValueOnce([]);

    const controller = new ExportController(service);
    await expect(controller.findRunning()).resolves.toEqual([]);
  });

  it("GET running — service 가 던진 raw Error 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findRunning.mockRejectedValueOnce(rawError);

    const controller = new ExportController(service);
    await expect(controller.findRunning()).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // findJob (GET /api/admin/export/:id) — happy (단건 forward) + error/negative
  // (부재 시 service NotFoundException raw propagate).
  // -----------------------------------------------------------------------
  it("GET :id — service.findJob(:id) 결과 단건을 그대로 forward (happy — polling 단건)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildExportJobFixture({ id: "ej-7" });
    serviceMock.findJob.mockResolvedValueOnce(fixture);

    const controller = new ExportController(service);
    const result = await controller.findJob("ej-7");

    expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
    expect(serviceMock.findJob).toHaveBeenCalledWith("ej-7");
    expect(result).toBe(fixture);
  });

  it("GET :id — service 의 NotFoundException (job 부재 P2025→404) 을 raw propagate (negative — 부재 job)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const notFound = new NotFoundException("export job not found: missing");
    serviceMock.findJob.mockRejectedValueOnce(notFound);

    const controller = new ExportController(service);
    await expect(controller.findJob("missing")).rejects.toBe(notFound);
  });

  it("GET :id — service 가 던진 raw Error (의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findJob.mockRejectedValueOnce(rawError);

    const controller = new ExportController(service);
    await expect(controller.findJob("ej-x")).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // describeScope (POST /api/admin/export/describe-scope) — describeExportScope
  // (T-0462) 실호출 배선 (T-0494). controller 가 enum→lowercase scope kind 변환 +
  // dateRange ISO string→Date coerce 후 helper 를 호출하고 ExportScopeDescription 을
  // 그대로 반환한다. R-112: happy(FULL/RANGE/PARTIAL) + error(helper throw raw
  // propagate) + branch(enum 3종 매핑 / dateRange coerce 3분기) + negative(허용 외
  // entity / RANGE 누락 / start>=end / Invalid Date / 빈 entitySelector). service 의존
  // 0 (helper 는 순수 함수 — describeScope 는 read-only 합성이라 service 불요).
  // -----------------------------------------------------------------------
  it("POST describe-scope — FULL scope 의 ExportScopeDescription 반환 (happy — full 분기, readOnly=true / dateRangeLine 부재)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    const result = controller.describeScope({ scope: ExportScope.FULL });

    expect(result.scopeKind).toBe("full");
    expect(result.readOnly).toBe(true);
    expect(result.headline.length).toBeGreaterThan(0);
    expect(result.scopeLine.length).toBeGreaterThan(0);
    // full → 5 entity 전체, dateRangeLine 부재.
    expect(result.entityLines).toHaveLength(5);
    expect(result.dateRangeLine).toBeUndefined();
  });

  it("POST describe-scope — RANGE scope (ISO string dateRange) → enum→lowercase + string→Date coerce 후 dateRangeLine 포함 (happy/branch — range + string coerce)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    const result = controller.describeScope({
      scope: ExportScope.RANGE,
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-03-31T00:00:00.000Z",
      },
    });

    expect(result.scopeKind).toBe("range");
    // string→Date coerce 가 성공해 helper 가 ISO dateRangeLine 을 만든다.
    expect(result.dateRangeLine).toContain("2026-01-01T00:00:00.000Z");
    expect(result.dateRangeLine).toContain("2026-03-31T00:00:00.000Z");
    expect(result.entityLines).toHaveLength(5);
  });

  it("POST describe-scope — RANGE scope 가 이미 Date instance 인 dateRange → coerce 통과(branch — 이미 Date 입력)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    // JSON 경로가 아닌 직접 Date 입력 분기 (coerce 의 non-string 통과 path).
    const result = controller.describeScope({
      scope: ExportScope.RANGE,
      dateRange: {
        start: new Date("2026-02-01T00:00:00.000Z"),
        end: new Date("2026-02-28T00:00:00.000Z"),
      } as unknown as Record<string, unknown>,
    });

    expect(result.scopeKind).toBe("range");
    expect(result.dateRangeLine).toContain("2026-02-01T00:00:00.000Z");
  });

  it("POST describe-scope — PARTIAL scope 의 entitySelector → 선택 entity 만 entityLines (happy/branch — partial)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    const result = controller.describeScope({
      scope: ExportScope.PARTIAL,
      entitySelector: ["Person", "Group"],
    });

    expect(result.scopeKind).toBe("partial");
    // 선택 2 entity 만 노출.
    expect(result.entityLines).toHaveLength(2);
    expect(result.scopeLine).toContain("2");
  });

  it("POST describe-scope — enum→lowercase 매핑이 정확히 full/range/partial 로 helper 에 forward (branch — 3 enum 매핑 계약)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);
    const helperSpy = jest.spyOn(
      describeExportScopeModule,
      "describeExportScope",
    );

    controller.describeScope({ scope: ExportScope.FULL });
    controller.describeScope({
      scope: ExportScope.RANGE,
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-02-01T00:00:00.000Z",
      },
    });
    controller.describeScope({
      scope: ExportScope.PARTIAL,
      entitySelector: ["Person"],
    });

    // helper 1번째 인자의 scope 가 정확히 lowercase 3종.
    expect(helperSpy.mock.calls.map((c) => c[0].scope)).toEqual([
      "full",
      "range",
      "partial",
    ]);
    helperSpy.mockRestore();
  });

  it("POST describe-scope — RANGE 인데 dateRange 누락 → helper RangeError raw propagate (negative — RANGE dateRange 누락, swallow 0)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    expect(() =>
      controller.describeScope({ scope: ExportScope.RANGE }),
    ).toThrow(RangeError);
  });

  it("POST describe-scope — RANGE start>=end → helper RangeError raw propagate (negative — 역전/빈 구간)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    expect(() =>
      controller.describeScope({
        scope: ExportScope.RANGE,
        dateRange: {
          start: "2026-03-31T00:00:00.000Z",
          end: "2026-01-01T00:00:00.000Z",
        },
      }),
    ).toThrow(RangeError);
  });

  it("POST describe-scope — dateRange 가 Invalid Date(잘못된 ISO string) → helper TypeError raw propagate (negative — 비-Date/Invalid)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    expect(() =>
      controller.describeScope({
        scope: ExportScope.RANGE,
        dateRange: { start: "not-a-date", end: "also-bad" },
      }),
    ).toThrow(TypeError);
  });

  it("POST describe-scope — PARTIAL 인데 빈 entitySelector → helper RangeError raw propagate (negative — 빈 선택 모호)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    expect(() =>
      controller.describeScope({
        scope: ExportScope.PARTIAL,
        entitySelector: [],
      }),
    ).toThrow(RangeError);
  });

  it("POST describe-scope — PARTIAL 에 허용 외 entity 섞임 → helper RangeError raw propagate (negative — 허용 외 entity, silent 무시 0)", () => {
    const { service } = buildServiceMock();
    const controller = new ExportController(service);

    expect(() =>
      controller.describeScope({
        scope: ExportScope.PARTIAL,
        entitySelector: ["Person", "NotAnEntity"],
      }),
    ).toThrow(RangeError);
  });

  // -----------------------------------------------------------------------
  // previewSelection (POST /api/admin/export/preview-selection) — service.
  // previewSelection(scope) 실호출 배선 (T-0497). controller 가 enum→lowercase scope
  // kind 변환 + dateRange ISO→Date coerce 후 service 를 호출하고 count 요약을 그대로
  // 반환한다. R-112: happy(FULL/RANGE/PARTIAL forward) + error(service throw raw
  // propagate) + branch(enum 3종 매핑 + dateRange coerce) + negative(부재 분기).
  // -----------------------------------------------------------------------
  it("POST preview-selection — FULL scope → lowercase 'full' 변환 후 service.previewSelection 호출 + count 요약 forward (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const summary = {
      selectedCount: 5,
      excludedCount: 0,
      perEntitySelected: {
        Assessment: 1,
        Person: 1,
        Group: 1,
        LlmConfig: 1,
        AuditLog: 1,
      },
    };
    serviceMock.previewSelection.mockResolvedValueOnce(summary);

    const controller = new ExportController(service);
    const result = await controller.previewSelection({
      scope: ExportScope.FULL,
    });

    expect(serviceMock.previewSelection).toHaveBeenCalledTimes(1);
    expect(serviceMock.previewSelection).toHaveBeenCalledWith({
      scope: "full",
      dateRange: undefined,
      entitySelector: undefined,
    });
    expect(result).toBe(summary);
  });

  it("POST preview-selection — service 반환의 sizeEstimate(예상 dump 크기)가 그대로 200 forward (T-0500 — sizeEstimate forward)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const summary = {
      selectedCount: 5,
      excludedCount: 0,
      perEntitySelected: {
        Assessment: 1,
        Person: 1,
        Group: 1,
        LlmConfig: 1,
        AuditLog: 1,
      },
      sizeEstimate: {
        estimatedBytes: 5120,
        humanSize: "5 KB",
        recordTotal: 5,
        perEntityBytes: {
          Assessment: 1024,
          Person: 1024,
          Group: 1024,
          LlmConfig: 1024,
          AuditLog: 1024,
        },
        large: false,
        recommendation: "sync" as const,
        guidanceLines: [
          "예상 dump 크기 5 KB(record 5 건)는 3 초 내 동기 다운로드가 가능합니다.",
        ],
      },
    };
    serviceMock.previewSelection.mockResolvedValueOnce(summary);

    const controller = new ExportController(service);
    const result = await controller.previewSelection({
      scope: ExportScope.FULL,
    });

    // controller 분기 0 — service 반환 객체를 그대로 forward(sizeEstimate 포함).
    expect(result).toBe(summary);
    expect(result.sizeEstimate.estimatedBytes).toBe(5120);
    expect(result.sizeEstimate.humanSize).toBe("5 KB");
    expect(result.sizeEstimate.recommendation).toBe("sync");
    expect(result.sizeEstimate.large).toBe(false);
  });

  it("POST preview-selection — service 반환의 deliveryPlan(전달 plan)이 그대로 200 forward (T-0501 — deliveryPlan forward)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const summary = {
      selectedCount: 5,
      excludedCount: 0,
      perEntitySelected: {
        Assessment: 1,
        Person: 1,
        Group: 1,
        LlmConfig: 1,
        AuditLog: 1,
      },
      deliveryPlan: {
        mode: "async-job" as const,
        chunked: true,
        pollingRequired: true,
        statusFlow: ["queued", "running", "ready"] as const,
        headline:
          "Export 다운로드 plan: async job + status polling (예상 12 MB)",
        instructionLines: [
          "예상 dump 가 대량(12 MB)이라 async job 으로 처리합니다.",
          "1) Export job 을 생성합니다 (상태: queued).",
        ],
      },
    };
    serviceMock.previewSelection.mockResolvedValueOnce(summary);

    const controller = new ExportController(service);
    const result = await controller.previewSelection({
      scope: ExportScope.FULL,
    });

    // controller 분기 0 — service 반환 객체를 그대로 forward(deliveryPlan 포함).
    expect(result).toBe(summary);
    expect(result.deliveryPlan.mode).toBe("async-job");
    expect(result.deliveryPlan.chunked).toBe(true);
    expect(result.deliveryPlan.pollingRequired).toBe(true);
    expect(result.deliveryPlan.statusFlow).toEqual([
      "queued",
      "running",
      "ready",
    ]);
  });

  it("POST preview-selection — service 반환의 summary(selected/excluded breakdown)가 그대로 200 forward (T-0499 — summary forward)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const earliest = new Date("2026-01-01T00:00:00.000Z");
    const latest = new Date("2026-03-01T00:00:00.000Z");
    const summary = {
      selectedCount: 2,
      excludedCount: 1,
      perEntitySelected: {
        Assessment: 0,
        Person: 1,
        Group: 1,
        LlmConfig: 0,
        AuditLog: 0,
      },
      summary: {
        selected: {
          total: 2,
          perEntity: {
            Assessment: 0,
            Person: 1,
            Group: 1,
            LlmConfig: 0,
            AuditLog: 0,
          },
          instantRange: { earliest, latest },
        },
        excluded: {
          total: 1,
          perEntity: {
            Assessment: 1,
            Person: 0,
            Group: 0,
            LlmConfig: 0,
            AuditLog: 0,
          },
          instantRange: { earliest: latest, latest },
        },
      },
    };
    serviceMock.previewSelection.mockResolvedValueOnce(summary);

    const controller = new ExportController(service);
    const result = await controller.previewSelection({
      scope: ExportScope.PARTIAL,
      entitySelector: ["Person", "Group"],
    });

    // controller 분기 0 — service 반환 객체를 그대로 forward(summary 포함).
    expect(result).toBe(summary);
    expect(result.summary.selected.total).toBe(2);
    expect(result.summary.excluded.perEntity.Assessment).toBe(1);
    expect(result.summary.selected.instantRange).toEqual({ earliest, latest });
  });

  it("POST preview-selection — RANGE scope (ISO string) → enum→lowercase + string→Date coerce 후 service forward (branch — range coerce)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.previewSelection.mockResolvedValueOnce({
      selectedCount: 0,
      excludedCount: 0,
      perEntitySelected: {} as never,
    });

    const controller = new ExportController(service);
    await controller.previewSelection({
      scope: ExportScope.RANGE,
      dateRange: {
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-03-31T00:00:00.000Z",
      },
    });

    const arg = serviceMock.previewSelection.mock.calls[0][0];
    expect(arg.scope).toBe("range");
    // string→Date coerce 가 성공해 service 입력의 start/end 가 Date instance.
    expect(arg.dateRange.start).toBeInstanceOf(Date);
    expect(arg.dateRange.end).toBeInstanceOf(Date);
  });

  it("POST preview-selection — PARTIAL scope 의 entitySelector 배열이 그대로 service forward (branch — partial)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.previewSelection.mockResolvedValueOnce({
      selectedCount: 2,
      excludedCount: 3,
      perEntitySelected: {} as never,
    });

    const controller = new ExportController(service);
    await controller.previewSelection({
      scope: ExportScope.PARTIAL,
      entitySelector: ["Person", "Group"],
    });

    expect(serviceMock.previewSelection).toHaveBeenCalledWith({
      scope: "partial",
      dateRange: undefined,
      entitySelector: ["Person", "Group"],
    });
  });

  it("POST preview-selection — enum→lowercase 매핑이 정확히 full/range/partial 로 service 에 forward (branch — 3 enum 매핑 계약)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.previewSelection.mockResolvedValue({
      selectedCount: 0,
      excludedCount: 0,
      perEntitySelected: {} as never,
    });
    const controller = new ExportController(service);

    await controller.previewSelection({ scope: ExportScope.FULL });
    await controller.previewSelection({
      scope: ExportScope.RANGE,
      dateRange: { start: "2026-01-01", end: "2026-02-01" },
    });
    await controller.previewSelection({
      scope: ExportScope.PARTIAL,
      entitySelector: ["Person"],
    });

    expect(
      serviceMock.previewSelection.mock.calls.map((c) => c[0].scope),
    ).toEqual(["full", "range", "partial"]);
  });

  it("POST preview-selection — service 의 RangeError (scope invariant 위반) 을 raw propagate (negative — swallow 0)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rangeError = new RangeError(
      "scope=range 에는 dateRange 가 필요합니다",
    );
    serviceMock.previewSelection.mockRejectedValueOnce(rangeError);

    const controller = new ExportController(service);
    await expect(
      controller.previewSelection({ scope: ExportScope.RANGE }),
    ).rejects.toBe(rangeError);
  });

  it("POST preview-selection — service 가 던진 raw Error (DB 의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.previewSelection.mockRejectedValueOnce(rawError);

    const controller = new ExportController(service);
    await expect(
      controller.previewSelection({ scope: ExportScope.FULL }),
    ).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // statusView (GET /api/admin/export/:id/status-view) — describeExportJobStatus
  // (T-0468) 실호출 배선 (T-0496). controller 가 findJob(id) 로 조회한 job 의 Prisma
  // JobStatus 를 lowercase ExportJobStatus 로 JOB_STATUS_TO_VIEW 매핑한 뒤 helper 를
  // 실호출해 ExportJobStatusView 를 반환한다. R-112: happy(4 status 각각) +
  // error(findJob NotFoundException raw propagate, helper 미호출) + branch(4 enum 매핑
  // 계약 — helper spy 인자 검증) + negative(부재 raw propagate / 매핑표 모든 enum cover).
  // -----------------------------------------------------------------------
  it.each([
    [JobStatus.PENDING, "queued", false, false, "running"],
    [JobStatus.RUNNING, "running", false, false, "ready"],
    [JobStatus.SUCCEEDED, "ready", true, true, null],
    [JobStatus.FAILED, "failed", true, false, null],
  ])(
    "GET :id/status-view — %s job → lowercase status '%s' 매핑 후 ExportJobStatusView 반환 (happy — status별 진행 view)",
    async (jobStatus, expectedStatus, terminal, downloadable, nextStatus) => {
      const { service, serviceMock } = buildServiceMock();
      serviceMock.findJob.mockResolvedValueOnce(
        buildExportJobFixture({ id: "ej-sv", status: jobStatus }),
      );

      const controller = new ExportController(service);
      const result = await controller.statusView("ej-sv");

      // findJob 가 :id 로 정확히 1 회 호출됨.
      expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
      expect(serviceMock.findJob).toHaveBeenCalledWith("ej-sv");
      // 매핑된 lowercase status + 핵심 불변 단언.
      expect(result.status).toBe(expectedStatus);
      expect(result.terminal).toBe(terminal);
      expect(result.downloadable).toBe(downloadable);
      expect(result.nextStatus).toBe(nextStatus);
      expect(result.totalSteps).toBe(3);
      expect(result.phaseLabel.length).toBeGreaterThan(0);
      expect(result.message.length).toBeGreaterThan(0);
    },
  );

  it("GET :id/status-view — SUCCEEDED 핵심 불변(downloadable=true & ready) / RUNNING(terminal=false) 단언 (happy — 핵심 불변)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findJob.mockResolvedValueOnce(
      buildExportJobFixture({ status: JobStatus.SUCCEEDED }),
    );
    const controller = new ExportController(service);

    const succeeded = await controller.statusView("ej-ok");
    expect(succeeded.downloadable).toBe(true);
    expect(succeeded.status).toBe("ready");

    serviceMock.findJob.mockResolvedValueOnce(
      buildExportJobFixture({ status: JobStatus.RUNNING }),
    );
    const running = await controller.statusView("ej-run");
    expect(running.terminal).toBe(false);
    expect(running.downloadable).toBe(false);
  });

  it("GET :id/status-view — 4 enum 매핑이 정확히 queued/running/ready/failed 로 helper 에 forward (branch — 4 enum 매핑 계약)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const helperSpy = jest.spyOn(
      describeExportJobStatusModule,
      "describeExportJobStatus",
    );
    const controller = new ExportController(service);

    for (const status of [
      JobStatus.PENDING,
      JobStatus.RUNNING,
      JobStatus.SUCCEEDED,
      JobStatus.FAILED,
    ]) {
      serviceMock.findJob.mockResolvedValueOnce(
        buildExportJobFixture({ status }),
      );
      await controller.statusView("ej-map");
    }

    // helper 1번째 인자가 정확히 lowercase 4종 순서.
    expect(helperSpy.mock.calls.map((c) => c[0])).toEqual([
      "queued",
      "running",
      "ready",
      "failed",
    ]);
    helperSpy.mockRestore();
  });

  it("GET :id/status-view — findJob 의 NotFoundException(부재 job) raw propagate + helper 미호출 (negative 핵심 — 부재 시 helper 도달 0)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const notFound = new NotFoundException("export job not found: missing");
    serviceMock.findJob.mockRejectedValueOnce(notFound);
    const helperSpy = jest.spyOn(
      describeExportJobStatusModule,
      "describeExportJobStatus",
    );

    const controller = new ExportController(service);
    await expect(controller.statusView("missing")).rejects.toBe(notFound);
    // helper 는 findJob 부재 분기에서 호출되지 않음 (swallow 없이 raw propagate).
    expect(helperSpy).not.toHaveBeenCalled();
    helperSpy.mockRestore();
  });

  it("GET :id/status-view — findJob 의 raw Error(의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findJob.mockRejectedValueOnce(rawError);

    const controller = new ExportController(service);
    await expect(controller.statusView("ej-x")).rejects.toBe(rawError);
  });

  it("GET :id/status-view — JOB_STATUS_TO_VIEW 매핑표가 모든 JobStatus enum 값을 유효 lowercase status 로 cover (negative — enum 확장 누락 회귀 방지)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const controller = new ExportController(service);
    const validLowercase = new Set(["queued", "running", "ready", "failed"]);

    // Object.values(JobStatus) 전부가 매핑되어 helper 가 RangeError 없이 유효 view 를
    // 산출함을 단언 — schema 에 새 JobStatus 가 추가되면 본 test 가 회귀를 잡는다.
    for (const status of Object.values(JobStatus)) {
      serviceMock.findJob.mockResolvedValueOnce(
        buildExportJobFixture({ status }),
      );
      const view = await controller.statusView("ej-cover");
      expect(validLowercase.has(view.status)).toBe(true);
    }
  });
});

// -----------------------------------------------------------------------
// guard/@Roles metadata 단언 (T-0488) — Reflector 로 create/findRunning/findJob
// 핸들러에 @Roles("Admin") + @UseGuards(JwtAuthGuard, RolesGuard) 부착 검증. RBAC
// 게이트가 실제로 라우트를 gate 하는지를 metadata 수준에서 단언 (guard 실행 자체의
// 401/403 live 검증은 아래 integration block).
// -----------------------------------------------------------------------
describe("ExportController (guard/@Roles metadata)", () => {
  const reflector = new Reflector();

  it.each([
    ["create", ExportController.prototype.create],
    ["findRunning", ExportController.prototype.findRunning],
    ["describeScope", ExportController.prototype.describeScope],
    ["previewSelection", ExportController.prototype.previewSelection],
    ["statusView", ExportController.prototype.statusView],
    ["findJob", ExportController.prototype.findJob],
  ])(
    "%s 핸들러에 @Roles('Admin') metadata 부착 (Admin+ tier gate)",
    (_name, handler) => {
      const roles = reflector.get<string[]>(ROLES_METADATA_KEY, handler);
      expect(roles).toEqual(["Admin"]);
    },
  );

  it.each([
    ["create", ExportController.prototype.create],
    ["findRunning", ExportController.prototype.findRunning],
    ["describeScope", ExportController.prototype.describeScope],
    ["previewSelection", ExportController.prototype.previewSelection],
    ["statusView", ExportController.prototype.statusView],
    ["findJob", ExportController.prototype.findJob],
  ])(
    "%s 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증+RBAC gate)",
    (_name, handler) => {
      const guards = Reflect.getMetadata("__guards__", handler) as unknown[];
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    },
  );
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire + ValidationPipe negative + HTTP status 검증
// (T-0488). JwtAuthGuard / RolesGuard 통과/거부 분기를 overrideGuard 로 박제 +
// DTO 검증 (scope enum / forbidNonWhitelisted / missing) negative.
// user-instance-access.controller.spec 의 "RBAC guard integration" mirror.
// -----------------------------------------------------------------------
describe("ExportController (RBAC guard + ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    createJob: jest.Mock;
    findRunning: jest.Mock;
    findJob: jest.Mock;
    previewSelection: jest.Mock;
  };

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

  const VALID_BODY = { scope: "FULL" };

  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = {
      createJob: jest.fn(),
      findRunning: jest.fn(),
      findJob: jest.fn(),
      previewSelection: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportJobService, useValue: serviceMock }],
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

  // == POST /api/admin/export — create endpoint =====================================

  // -- happy — Admin 통과 시 201 + actor.sub 를 requestedById 로 결합 위임 -----------
  it("POST — Admin role 통과 시 201 + actor.sub 를 requestedById 로 결합해 service.createJob 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildExportJobFixture({ id: "ej-c", requestedById: "admin-1" }),
    );

    const res = await request(app.getHttpServer())
      .post("/api/admin/export")
      .send(VALID_BODY)
      .expect(201);

    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    // actor.sub (JwtAuthGuard 가 박제) 가 requestedById 로 결합됨 검증.
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      scope: "FULL",
      requestedById: "admin-1",
      dateRange: undefined,
      entitySelector: undefined,
    });
    expect(res.body.id).toBe("ej-c");
  });

  // -- negative — service BadRequestException (scope invariant) → 400 (raw propagate) -
  it("POST — service 가 BadRequestException (scope invariant 위반) throw 시 400 (negative 핵심 — scope invariant)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockRejectedValueOnce(
      new BadRequestException("scope=FULL 은 dateRange 를 받지 않습니다"),
    );

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send(VALID_BODY)
      .expect(400);
  });

  // -- negative — ValidationPipe: 잘못된 scope enum 값 → 400 + service 미호출 --------
  it("POST — 잘못된 scope enum 값 (ALL) 시 400 + service 미호출 (negative — invalid enum)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send({ scope: "ALL" })
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: scope 누락 → 400 + service 미호출 -----------------
  it("POST — 필수 필드 (scope) 누락 시 400 + service 미호출 (negative — missing field)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send({})
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: 정의되지 않은 raw 본문 키 → 400 + service 미호출 ---
  it("POST — 정의되지 않은 extra body 키 (raw payload) 포함 시 400 + service 미호출 (negative — forbidNonWhitelisted, ADR-0044 §2)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send({ ...VALID_BODY, rawCommitMessage: "secret-leak" })
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // -- happy — PARTIAL: entitySelector 배열이 ValidationPipe(@IsArray) 통과 → service 위임 -
  // T-0491 round2 MAJOR fix — DTO↔service 계약 (entitySelector = entity 이름 배열) 을 실
  // HTTP 경로로 pin. round1 의 @IsObject 라면 array 가 400 으로 거부돼 PARTIAL 이 동작
  // 불가했음(REQ-030 회귀). 본 test 가 그 회귀를 차단한다.
  it("POST — PARTIAL entitySelector 배열이 ValidationPipe(@IsArray) 통과 + service.createJob 에 배열 그대로 위임 (happy — DTO↔service 계약 pin, round2 BLOCKER 회귀 차단)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildExportJobFixture({ id: "ej-partial", scope: "PARTIAL" }),
    );

    const res = await request(app.getHttpServer())
      .post("/api/admin/export")
      .send({ scope: "PARTIAL", entitySelector: ["Person", "Group"] })
      .expect(201);

    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    // ValidationPipe(transform) 통과 후 entitySelector 가 배열 그대로 service 로 forward.
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      scope: "PARTIAL",
      requestedById: "admin-1",
      dateRange: undefined,
      entitySelector: ["Person", "Group"],
    });
    expect(res.body.id).toBe("ej-partial");
  });

  // -- negative — ValidationPipe: entitySelector 가 배열 아님(숫자) → 400 + service 미호출 -
  // T-0491 round2 MAJOR fix — @IsArray boundary 가 동작함을 단언 (DTO 형식 게이트).
  // helper 의 per-element entity 멤버십 검증은 본 e2e 책임 아님(service-layer spec 가 cover).
  it("POST — entitySelector 가 배열 아닌 shape(숫자) 시 400 + service 미호출 (negative — @IsArray boundary)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send({ scope: "PARTIAL", entitySelector: 42 })
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: requestedById 를 body 로 위장 시도 → 400 ----------
  it("POST — body 에 requestedById 위장 키 포함 시 400 + service 미호출 (negative — actor 위장 차단)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send({ ...VALID_BODY, requestedById: "spoofed-victim" })
      .expect(400);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
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

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send(VALID_BODY)
      .expect(401);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("POST — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ----------------
  it("POST — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .post("/api/admin/export")
      .send(VALID_BODY)
      .expect(500);
  });

  // == GET /api/admin/export/running — findRunning endpoint ========================

  // -- happy — Admin 통과 시 200 + 목록 forward (running segment 가 :id 로 포착 안 됨) -
  it("GET running — Admin role 통과 시 200 + service.findRunning 목록 forward (happy — 라우트 우선순위)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findRunning.mockResolvedValueOnce([
      buildExportJobFixture({ id: "ej-r1", status: "RUNNING" }),
    ]);

    const res = await request(app.getHttpServer())
      .get("/api/admin/export/running")
      .expect(200);

    // "running" 이 findRunning 으로 라우트됨 (findJob 의 :id 로 포착 안 됨) 검증.
    expect(serviceMock.findRunning).toHaveBeenCalledTimes(1);
    expect(serviceMock.findJob).not.toHaveBeenCalled();
    expect(res.body[0].id).toBe("ej-r1");
  });

  // -- negative — 403 (User actor) on running ------------------------------------
  it("GET running — RolesGuard reject 시 403 + service 미호출 (negative — User actor)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/admin/export/running")
      .expect(403);

    expect(serviceMock.findRunning).not.toHaveBeenCalled();
  });

  // == GET /api/admin/export/:id — findJob endpoint ================================

  // -- happy — Admin 통과 시 200 + 단건 forward ------------------------------------
  it("GET :id — Admin role 통과 시 200 + service.findJob(:id) 단건 forward (happy)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findJob.mockResolvedValueOnce(
      buildExportJobFixture({ id: "ej-7" }),
    );

    const res = await request(app.getHttpServer())
      .get("/api/admin/export/ej-7")
      .expect(200);

    expect(serviceMock.findJob).toHaveBeenCalledWith("ej-7");
    expect(res.body.id).toBe("ej-7");
  });

  // -- negative — service NotFoundException (부재 job) → 404 (raw propagate) --------
  it("GET :id — service 가 NotFoundException (부재 job) throw 시 404 (negative 핵심 — 부재 job)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findJob.mockRejectedValueOnce(
      new NotFoundException("export job not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/admin/export/missing")
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
      .get("/api/admin/export/ej-7")
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
      .get("/api/admin/export/ej-7")
      .expect(403);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // == POST /api/admin/export/describe-scope — describeScope endpoint ===============

  // -- happy — Admin 통과 시 201 + helper 산출 ExportScopeDescription body 반환 --------
  // describe-scope 가 POST 라 GET `:id` 와 충돌하지 않음을 실 HTTP 경로로 단언
  // (describe-scope segment 가 findJob 의 :id 로 포착 안 됨).
  it("POST describe-scope — Admin role 통과 시 201 + ExportScopeDescription 반환 (happy — POST/GET :id 충돌 없음)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    const res = await request(app.getHttpServer())
      .post("/api/admin/export/describe-scope")
      .send({ scope: "FULL" })
      .expect(201);

    expect(res.body.scopeKind).toBe("full");
    expect(res.body.readOnly).toBe(true);
    // describe-scope 는 read-only — service(createJob/findJob) 미호출.
    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: 정의되지 않은 raw 본문 키 → 400 ------------------
  it("POST describe-scope — 정의되지 않은 extra body 키 (raw payload) 포함 시 400 (negative — forbidNonWhitelisted, ADR-0044 §2)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/describe-scope")
      .send({ scope: "FULL", rawLeak: "secret" })
      .expect(400);
  });

  // -- negative — ValidationPipe: 잘못된 scope enum 값 → 400 ----------------------
  it("POST describe-scope — 잘못된 scope enum 값 (ALL) 시 400 (negative — invalid enum)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/describe-scope")
      .send({ scope: "ALL" })
      .expect(400);
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) ----------------------------
  it("POST describe-scope — JwtAuthGuard reject 시 401 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/describe-scope")
      .send({ scope: "FULL" })
      .expect(401);
  });

  // -- negative — 403 (RolesGuard reject — User actor Admin+ 미달) -----------------
  it("POST describe-scope — RolesGuard reject 시 403 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/describe-scope")
      .send({ scope: "FULL" })
      .expect(403);
  });

  // == POST /api/admin/export/preview-selection — previewSelection endpoint ========

  // -- happy — Admin 통과 시 201 + count 요약 body 반환 (POST/GET :id 충돌 없음) -------
  it("POST preview-selection — Admin role 통과 시 201 + count 요약 반환 (happy — POST/GET :id 충돌 없음)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    const instant = new Date("2026-02-01T00:00:00.000Z");
    serviceMock.previewSelection.mockResolvedValueOnce({
      selectedCount: 5,
      excludedCount: 0,
      perEntitySelected: {
        Assessment: 1,
        Person: 1,
        Group: 1,
        LlmConfig: 1,
        AuditLog: 1,
      },
      summary: {
        selected: {
          total: 5,
          perEntity: {
            Assessment: 1,
            Person: 1,
            Group: 1,
            LlmConfig: 1,
            AuditLog: 1,
          },
          instantRange: { earliest: instant, latest: instant },
        },
        excluded: {
          total: 0,
          perEntity: {
            Assessment: 0,
            Person: 0,
            Group: 0,
            LlmConfig: 0,
            AuditLog: 0,
          },
          instantRange: null,
        },
      },
      sizeEstimate: {
        estimatedBytes: 5120,
        humanSize: "5 KB",
        recordTotal: 5,
        perEntityBytes: {
          Assessment: 1024,
          Person: 1024,
          Group: 1024,
          LlmConfig: 1024,
          AuditLog: 1024,
        },
        large: false,
        recommendation: "sync",
        guidanceLines: [
          "예상 dump 크기 5 KB(record 5 건)는 3 초 내 동기 다운로드가 가능합니다.",
        ],
      },
      deliveryPlan: {
        mode: "sync-download",
        chunked: false,
        pollingRequired: false,
        statusFlow: [],
        headline: "Export 다운로드 plan: 즉시 동기 다운로드 (예상 5 KB)",
        instructionLines: [
          "예상 dump 가 소량(5 KB)이라 즉시 동기 다운로드합니다.",
          "1) 단일 응답으로 즉시 다운로드합니다.",
        ],
      },
    });

    const res = await request(app.getHttpServer())
      .post("/api/admin/export/preview-selection")
      .send({ scope: "FULL" })
      .expect(201);

    expect(res.body.selectedCount).toBe(5);
    expect(res.body.excludedCount).toBe(0);
    // summary breakdown 이 응답 body 에 그대로 forward(JSON 직렬화 후 instant 는 ISO string).
    expect(res.body.summary.selected.total).toBe(5);
    expect(res.body.summary.excluded.total).toBe(0);
    expect(res.body.summary.excluded.instantRange).toBeNull();
    // sizeEstimate(예상 dump 크기)도 응답 body 에 그대로 forward(T-0500).
    expect(res.body.sizeEstimate.estimatedBytes).toBe(5120);
    expect(res.body.sizeEstimate.humanSize).toBe("5 KB");
    expect(res.body.sizeEstimate.recommendation).toBe("sync");
    expect(res.body.sizeEstimate.large).toBe(false);
    // deliveryPlan(전달 plan)도 응답 body 에 그대로 forward(T-0501).
    expect(res.body.deliveryPlan.mode).toBe("sync-download");
    expect(res.body.deliveryPlan.pollingRequired).toBe(false);
    expect(res.body.deliveryPlan.statusFlow).toEqual([]);
    expect(res.body.deliveryPlan.chunked).toBe(false);
    // lowercase "full" 변환 후 service.previewSelection 위임.
    expect(serviceMock.previewSelection).toHaveBeenCalledTimes(1);
    expect(serviceMock.previewSelection).toHaveBeenCalledWith({
      scope: "full",
      dateRange: undefined,
      entitySelector: undefined,
    });
    // read-only — createJob/findJob 미호출.
    expect(serviceMock.createJob).not.toHaveBeenCalled();
    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // -- negative — service RangeError (scope invariant 위반) → 500 (raw propagate) -----
  it("POST preview-selection — service RangeError(scope invariant) → 500 raw propagate (negative — swallow 0)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.previewSelection.mockRejectedValueOnce(
      new RangeError("scope=range 에는 dateRange 가 필요합니다"),
    );

    await request(app.getHttpServer())
      .post("/api/admin/export/preview-selection")
      .send({ scope: "RANGE" })
      .expect(500);
  });

  // -- negative — ValidationPipe: 정의되지 않은 raw 본문 키 → 400 ------------------
  it("POST preview-selection — 정의되지 않은 extra body 키(raw payload) 포함 시 400 + service 미호출 (negative — forbidNonWhitelisted)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/preview-selection")
      .send({ scope: "FULL", rawLeak: "secret" })
      .expect(400);

    expect(serviceMock.previewSelection).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: 잘못된 scope enum 값 → 400 + service 미호출 --------
  it("POST preview-selection — 잘못된 scope enum 값(ALL) 시 400 + service 미호출 (negative — invalid enum)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/preview-selection")
      .send({ scope: "ALL" })
      .expect(400);

    expect(serviceMock.previewSelection).not.toHaveBeenCalled();
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) + service 미호출 -----------
  it("POST preview-selection — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/preview-selection")
      .send({ scope: "FULL" })
      .expect(401);

    expect(serviceMock.previewSelection).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — User actor Admin+ 미달) + service 미호출 ---
  it("POST preview-selection — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/admin/export/preview-selection")
      .send({ scope: "FULL" })
      .expect(403);

    expect(serviceMock.previewSelection).not.toHaveBeenCalled();
  });

  // == GET /api/admin/export/:id/status-view — statusView endpoint =================

  // -- happy — Admin 통과 시 200 + helper 산출 ExportJobStatusView body 반환 ----------
  // status-view 가 :id 보다 깊은 고정 segment 라 findJob 의 :id 로 포착되지 않음을 실
  // HTTP 경로로 단언 (route 우선순위 — status-view 가 findJob 으로 라우트 안 됨).
  it("GET :id/status-view — Admin role 통과 시 200 + ExportJobStatusView 반환 (happy — route 우선순위)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findJob.mockResolvedValueOnce(
      buildExportJobFixture({ id: "ej-sv", status: "SUCCEEDED" }),
    );

    const res = await request(app.getHttpServer())
      .get("/api/admin/export/ej-sv/status-view")
      .expect(200);

    // SUCCEEDED → lowercase "ready" + downloadable=true.
    expect(res.body.status).toBe("ready");
    expect(res.body.downloadable).toBe(true);
    expect(res.body.totalSteps).toBe(3);
    expect(serviceMock.findJob).toHaveBeenCalledWith("ej-sv");
  });

  // -- negative — service NotFoundException (부재 job) → 404 (raw propagate) --------
  it("GET :id/status-view — service 가 NotFoundException (부재 job) throw 시 404 (negative 핵심 — 부재 job)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findJob.mockRejectedValueOnce(
      new NotFoundException("export job not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/admin/export/missing/status-view")
      .expect(404);
  });

  // -- negative — 401 (인증 부재) on :id/status-view ------------------------------
  it("GET :id/status-view — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/admin/export/ej-7/status-view")
      .expect(401);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // -- negative — 403 (User actor) on :id/status-view -----------------------------
  it("GET :id/status-view — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/admin/export/ej-7/status-view")
      .expect(403);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 로 Admin+ tier 분기 박제 (mock 이 아닌
// 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제), RolesGuard 는
// 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). user-instance-access.controller.
// spec 동일 describe mirror. 3 endpoint 모두 Admin+ — User 403 / Admin·SuperAdmin 통과.
// -----------------------------------------------------------------------
describe("ExportController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    createJob: jest.Mock;
    findRunning: jest.Mock;
    findJob: jest.Mock;
    previewSelection: jest.Mock;
  };

  const VALID_BODY = { scope: "FULL" };

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
      findRunning: jest.fn(),
      findJob: jest.fn(),
      previewSelection: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        { provide: ExportJobService, useValue: serviceMock },
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
      .post("/api/admin/export")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.createJob).not.toHaveBeenCalled();
  });

  // POST — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 201.
  it.each(["Admin", "SuperAdmin"])(
    "POST — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.createJob.mockResolvedValueOnce(buildExportJobFixture());

      await request(app.getHttpServer())
        .post("/api/admin/export")
        .send(VALID_BODY)
        .expect(201);

      expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    },
  );

  // GET :id Admin+ tier — User actor 는 403 차단 (실 RolesGuard escalation).
  it("GET :id — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .get("/api/admin/export/ej-7")
      .expect(403);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // GET :id — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 200.
  it.each(["Admin", "SuperAdmin"])(
    "GET :id — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findJob.mockResolvedValueOnce(buildExportJobFixture());

      await request(app.getHttpServer())
        .get("/api/admin/export/ej-7")
        .expect(200);

      expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
    },
  );

  // GET :id/status-view Admin+ tier — User actor 는 403 차단 (실 RolesGuard escalation).
  it("GET :id/status-view — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .get("/api/admin/export/ej-7/status-view")
      .expect(403);

    expect(serviceMock.findJob).not.toHaveBeenCalled();
  });

  // GET :id/status-view — Admin / SuperAdmin actor 통과 (escalation descent) → 200.
  it.each(["Admin", "SuperAdmin"])(
    "GET :id/status-view — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findJob.mockResolvedValueOnce(
        buildExportJobFixture({ status: "RUNNING" }),
      );

      await request(app.getHttpServer())
        .get("/api/admin/export/ej-7/status-view")
        .expect(200);

      expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
    },
  );
});
