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
import { ExportScope, type ExportJob } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { ExportJobService } from "./export-job.service";
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
  };
} {
  const serviceMock = {
    createJob: jest.fn(),
    findRunning: jest.fn(),
    findJob: jest.fn(),
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

  it("POST create — PARTIAL scope 의 entitySelector 도 그대로 forward (branch — scope별 입력 분기)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(
      buildExportJobFixture({ scope: "PARTIAL" }),
    );
    const dto = {
      scope: ExportScope.PARTIAL,
      entitySelector: { personIds: ["p1", "p2"] },
    };

    const controller = new ExportController(service);
    await controller.create(dto, "admin-actor");

    expect(serviceMock.createJob).toHaveBeenCalledWith({
      scope: ExportScope.PARTIAL,
      requestedById: "admin-actor",
      dateRange: undefined,
      entitySelector: { personIds: ["p1", "p2"] },
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
});
