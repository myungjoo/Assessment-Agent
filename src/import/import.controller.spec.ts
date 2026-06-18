// ImportController spec — T-0489 acceptance 박제 (3 endpoint: POST create /
// GET running / GET :id, R-112: happy / error / branch / negative 충분 cover +
// RBAC guard wire + @Roles metadata 단언 + DTO ValidationPipe 검증).
// export.controller.spec.ts (T-0488) 1:1 mirror, 단 본 controller 차이:
//   - DTO 입력이 mode 1 필드 (선택) — scope/dateRange/entitySelector 대신.
//   - create endpoint 의 mode 지정/미지정 분기 (미지정 시 undefined forward → service
//     default 위임).
//   - controller 자체 분기 없음 — mode invariant 400 / requestedById 누락 400 / 단건
//     부재 404 는 전부 ImportJobService 책임 (raw forward).
//   - 3 endpoint 모두 Admin+ tier (import 는 administrative concern, REQ-045).
//
// 본 spec 은 4 부분 (export.controller.spec mirror):
//   1. Unit-level (controller-only with mocked ImportJobService) — create/findRunning/
//      findJob 의 service 호출 인자 (actor id 결합 + mode forward) / 반환 forward /
//      예외 raw propagation 검증.
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

import { ImportJobService } from "./import-job.service";
import { ImportController } from "./import.controller";
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

// ImportJobService mock factory — create / findRunning / findJob jest.fn().
function buildServiceMock(): {
  service: ImportJobService;
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
    service: serviceMock as unknown as ImportJobService,
    serviceMock,
  };
}

describe("ImportController (unit)", () => {
  // -----------------------------------------------------------------------
  // create (POST /api/admin/import) — happy (actor.sub 를 requestedById 로 결합 +
  // dto.mode forward) + branch (mode 지정/미지정) + error/negative (service throw
  // raw propagate). controller 자체 분기 없음 — service raw forward.
  // -----------------------------------------------------------------------
  it("POST create — actor.sub 를 requestedById 로 결합해 service.createJob 호출 + 반환 forward (happy, mode 지정)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildImportJobFixture({
      id: "ij-1",
      requestedById: "admin-actor",
      mode: "MERGE",
    });
    serviceMock.createJob.mockResolvedValueOnce(fixture);
    const dto = { mode: ImportMode.MERGE };

    const controller = new ImportController(service);
    const result = await controller.create(dto, "admin-actor");

    // service.createJob 가 actor.sub 결합 + dto.mode forward 로 정확히 1 회 호출됨 검증.
    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: ImportMode.MERGE,
      requestedById: "admin-actor",
    });
    // 생성된 job (status=PENDING) 을 그대로 forward.
    expect(result).toBe(fixture);
  });

  it("POST create — mode 미지정 시 mode: undefined 로 forward (branch — service default 위임)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.createJob.mockResolvedValueOnce(buildImportJobFixture());
    const dto = {};

    const controller = new ImportController(service);
    await controller.create(dto, "admin-actor");

    // mode 미지정 → undefined forward (service 가 schema @default(REPLACE) 적용).
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: undefined,
      requestedById: "admin-actor",
    });
  });

  it("POST create — service 의 BadRequestException (mode invariant 위반) 을 삼키지 않고 raw propagate (negative — mode invariant)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const badRequest = new BadRequestException(
      "mode 는 REPLACE 또는 MERGE 여야 합니다",
    );
    serviceMock.createJob.mockRejectedValueOnce(badRequest);

    const controller = new ImportController(service);
    await expect(
      controller.create({ mode: ImportMode.REPLACE }, "admin-actor"),
    ).rejects.toBe(badRequest);
  });

  it("POST create — service 가 던진 raw Error (의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.createJob.mockRejectedValueOnce(rawError);

    const controller = new ImportController(service);
    await expect(controller.create({}, "admin-actor")).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // findRunning (GET /api/admin/import/running) — happy (목록 forward) + 빈 배열 분기.
  // -----------------------------------------------------------------------
  it("GET running — service.findRunning 결과 목록을 그대로 forward (happy — polling 목록)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rows = [
      buildImportJobFixture({ id: "ij-r1", status: "RUNNING" }),
      buildImportJobFixture({ id: "ij-r2", status: "RUNNING" }),
    ];
    serviceMock.findRunning.mockResolvedValueOnce(rows);

    const controller = new ImportController(service);
    const result = await controller.findRunning();

    expect(serviceMock.findRunning).toHaveBeenCalledTimes(1);
    expect(result).toBe(rows);
  });

  it("GET running — 매칭 0 시 빈 배열 그대로 forward (branch — 빈 결과도 정상)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findRunning.mockResolvedValueOnce([]);

    const controller = new ImportController(service);
    await expect(controller.findRunning()).resolves.toEqual([]);
  });

  it("GET running — service 가 던진 raw Error 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findRunning.mockRejectedValueOnce(rawError);

    const controller = new ImportController(service);
    await expect(controller.findRunning()).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // findJob (GET /api/admin/import/:id) — happy (단건 forward) + error/negative
  // (부재 시 service NotFoundException raw propagate).
  // -----------------------------------------------------------------------
  it("GET :id — service.findJob(:id) 결과 단건을 그대로 forward (happy — polling 단건)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildImportJobFixture({ id: "ij-7" });
    serviceMock.findJob.mockResolvedValueOnce(fixture);

    const controller = new ImportController(service);
    const result = await controller.findJob("ij-7");

    expect(serviceMock.findJob).toHaveBeenCalledTimes(1);
    expect(serviceMock.findJob).toHaveBeenCalledWith("ij-7");
    expect(result).toBe(fixture);
  });

  it("GET :id — service 의 NotFoundException (job 부재 P2025→404) 을 raw propagate (negative — 부재 job)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const notFound = new NotFoundException("import job not found: missing");
    serviceMock.findJob.mockRejectedValueOnce(notFound);

    const controller = new ImportController(service);
    await expect(controller.findJob("missing")).rejects.toBe(notFound);
  });

  it("GET :id — service 가 던진 raw Error (의존성 fail) 를 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("db-down");
    serviceMock.findJob.mockRejectedValueOnce(rawError);

    const controller = new ImportController(service);
    await expect(controller.findJob("ij-x")).rejects.toBe(rawError);
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
// Integration — RBAC guard wire + ValidationPipe negative + HTTP status 검증
// (T-0489). JwtAuthGuard / RolesGuard 통과/거부 분기를 overrideGuard 로 박제 +
// DTO 검증 (mode enum / forbidNonWhitelisted) negative.
// export.controller.spec 의 "RBAC guard integration" mirror.
// -----------------------------------------------------------------------
describe("ImportController (RBAC guard + ValidationPipe integration)", () => {
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

  // 유효 body — mode 미지정 (빈 body) 도 유효 (선택 필드). 명시 시 REPLACE/MERGE.
  const VALID_BODY = { mode: "REPLACE" };

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
      controllers: [ImportController],
      providers: [{ provide: ImportJobService, useValue: serviceMock }],
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

  // -- happy — Admin 통과 시 201 + actor.sub 를 requestedById 로 결합 위임 -----------
  it("POST — Admin role 통과 시 201 + actor.sub 를 requestedById 로 결합해 service.createJob 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(
      buildImportJobFixture({ id: "ij-c", requestedById: "admin-1" }),
    );

    const res = await request(app.getHttpServer())
      .post("/api/admin/import")
      .send(VALID_BODY)
      .expect(201);

    expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
    // actor.sub (JwtAuthGuard 가 박제) 가 requestedById 로 결합됨 검증.
    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: "REPLACE",
      requestedById: "admin-1",
    });
    expect(res.body.id).toBe("ij-c");
  });

  // -- happy/branch — mode 미지정 (빈 body) 도 201 + mode: undefined forward ---------
  it("POST — mode 미지정 (빈 body) 시 201 + mode: undefined forward (branch — service default 위임)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockResolvedValueOnce(buildImportJobFixture());

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .send({})
      .expect(201);

    expect(serviceMock.createJob).toHaveBeenCalledWith({
      mode: undefined,
      requestedById: "admin-1",
    });
  });

  // -- negative — service BadRequestException (mode invariant) → 400 (raw propagate) -
  it("POST — service 가 BadRequestException (mode invariant 위반) throw 시 400 (negative 핵심 — mode invariant)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.createJob.mockRejectedValueOnce(
      new BadRequestException("requestedById 는 필수입니다"),
    );

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .send(VALID_BODY)
      .expect(400);
  });

  // -- negative — ValidationPipe: 잘못된 mode enum 값 → 400 + service 미호출 --------
  it("POST — 잘못된 mode enum 값 (PATCH) 시 400 + service 미호출 (negative — invalid enum)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/admin/import")
      .send({ mode: "PATCH" })
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
      .post("/api/admin/import")
      .send({ ...VALID_BODY, rawPayload: "secret-leak" })
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
      .post("/api/admin/import")
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
      .post("/api/admin/import")
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
      .post("/api/admin/import")
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
      .post("/api/admin/import")
      .send(VALID_BODY)
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
    findRunning: jest.Mock;
    findJob: jest.Mock;
  };

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
      findRunning: jest.fn(),
      findJob: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ImportController],
      providers: [
        { provide: ImportJobService, useValue: serviceMock },
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
  });

  // POST — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 201.
  it.each(["Admin", "SuperAdmin"])(
    "POST — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.createJob.mockResolvedValueOnce(buildImportJobFixture());

      await request(app.getHttpServer())
        .post("/api/admin/import")
        .send(VALID_BODY)
        .expect(201);

      expect(serviceMock.createJob).toHaveBeenCalledTimes(1);
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
