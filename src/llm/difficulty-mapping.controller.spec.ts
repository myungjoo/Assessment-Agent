// DifficultyMappingController spec — T-0139 acceptance 박제 (2 endpoint, R-112:
// happy / error / branch / negative + ValidationPipe negative + RBAC guard wire).
// summary.controller.spec.ts (T-0123) 1:1 mirror, 단 DifficultyMapping 의 차이 반영:
//   - 2 endpoint (GET findAll / PATCH assign) — POST/DELETE 부재 (config CRUD 는 별도 task).
//   - DTO 1 키 (llmProviderConfigId) — AssignDifficultyMappingDto.
//   - GET / PATCH 둘 다 Admin+ tier (SummaryController 의 GET User+ 와 대조 — LLM 모델
//     지정은 전 endpoint 가 administrative concern, REQ-096).
//   - service 가 모든 4xx 변환 책임 (controller raw forward) — controller 분기 없음,
//     forward 검증 + service-throw propagation 으로 cover.
//
// 본 spec 은 4 부분으로 구성 (summary.controller.spec.ts mirror):
//   1. Unit-level (controller-only with mocked DifficultyMappingService) — 2 endpoint 의
//      routing / service 호출 인자 / 예외 propagation 검증 + GET 빈/비어있지 않은 배열 분기.
//   2. Integration-level (createNestApplication + controller-scope ValidationPipe + supertest)
//      — AssignDifficultyMappingDto decorator 위반 negative case + non-whitelisted reject.
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 의 통과/거부 분기 overrideGuard.
//   4. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 통과).
//
// PrismaService 는 Controller → Service → Repository chain 의 dep 안전성을 위해
// jest.mock 으로 회피 (summary.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    difficultyMapping = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    };
    llmProviderConfig = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
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
import { Test, type TestingModule } from "@nestjs/testing";
import type { DifficultyMapping } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { DifficultyMappingController } from "./difficulty-mapping.controller";
import { DifficultyMappingService } from "./difficulty-mapping.service";
/* eslint-enable import/first */

// DifficultyMapping fixture — schema.prisma 의 6 컬럼 (id / difficulty /
// llmProviderConfigId / createdAt / updatedAt + relation 생략) default 채움.
function buildMappingFixture(
  overrides: Partial<DifficultyMapping> = {},
): DifficultyMapping {
  return {
    id: "mapping-default",
    difficulty: "easy",
    llmProviderConfigId: "config-default",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as DifficultyMapping;
}

// DifficultyMappingService mock factory — 2 메서드 (findAllMappings /
// assignProviderConfig) jest.fn(). 각 test 마다 새 mock (호출 카운터 격리).
function buildServiceMock(): {
  service: DifficultyMappingService;
  serviceMock: {
    findAllMappings: jest.Mock;
    assignProviderConfig: jest.Mock;
  };
} {
  const serviceMock = {
    findAllMappings: jest.fn(),
    assignProviderConfig: jest.fn(),
  };
  return {
    service: serviceMock as unknown as DifficultyMappingService,
    serviceMock,
  };
}

describe("DifficultyMappingController (unit)", () => {
  // -----------------------------------------------------------------------
  // findAll (GET /api/llm/difficulty-mappings) — happy + branch (빈/비어있지 않은 배열)
  // -----------------------------------------------------------------------
  it("GET — findAllMappings 결과 (3 row) 를 그대로 반환 (happy + branch — 비어있지 않은 배열)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = [
      buildMappingFixture({ id: "m-easy", difficulty: "easy" }),
      buildMappingFixture({ id: "m-medium", difficulty: "medium" }),
      buildMappingFixture({ id: "m-hard", difficulty: "hard" }),
    ];
    serviceMock.findAllMappings.mockResolvedValueOnce(fixture);

    const controller = new DifficultyMappingController(service);
    const result = await controller.findAll();

    expect(serviceMock.findAllMappings).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
    expect(result).toHaveLength(3);
  });

  it("GET — seed 전 빈 배열도 그대로 반환 (branch — empty propagate, 404 변환 안 함)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findAllMappings.mockResolvedValueOnce([]);

    const controller = new DifficultyMappingController(service);
    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it("GET — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (negative — 의존성 fail)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.findAllMappings.mockRejectedValueOnce(rawError);

    const controller = new DifficultyMappingController(service);
    await expect(controller.findAll()).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // assign (PATCH /:difficulty) — happy + error (service 4xx propagate) + negative
  // -----------------------------------------------------------------------
  it("PATCH — assignProviderConfig 를 (difficulty, dto.llmProviderConfigId) 인자로 호출 + 결과 반환 (happy)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildMappingFixture({
      difficulty: "medium",
      llmProviderConfigId: "config-new",
    });
    serviceMock.assignProviderConfig.mockResolvedValueOnce(fixture);

    const controller = new DifficultyMappingController(service);
    const result = await controller.assign("medium", {
      llmProviderConfigId: "config-new",
    });

    expect(serviceMock.assignProviderConfig).toHaveBeenCalledWith(
      "medium",
      "config-new",
    );
    expect(serviceMock.assignProviderConfig).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("PATCH — service 의 BadRequestException (미지원 난이도) 그대로 propagate (error / negative — invalid difficulty)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.assignProviderConfig.mockRejectedValueOnce(
      new BadRequestException("unsupported difficulty: trivial"),
    );

    const controller = new DifficultyMappingController(service);
    await expect(
      controller.assign("trivial", { llmProviderConfigId: "config-1" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("PATCH — service 의 NotFoundException (지정 config 부재) 그대로 propagate (error / negative — unknown config)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.assignProviderConfig.mockRejectedValueOnce(
      new NotFoundException("llm provider config not found: ghost"),
    );

    const controller = new DifficultyMappingController(service);
    await expect(
      controller.assign("easy", { llmProviderConfigId: "ghost" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("PATCH — service 의 NotFoundException (슬롯 difficulty 부재 P2025) 그대로 propagate (error / negative — 슬롯 부재)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.assignProviderConfig.mockRejectedValueOnce(
      new NotFoundException("difficulty mapping not found: hard"),
    );

    const controller = new DifficultyMappingController(service);
    await expect(
      controller.assign("hard", { llmProviderConfigId: "config-1" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("PATCH — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (negative — unknown error)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.assignProviderConfig.mockRejectedValueOnce(rawError);

    const controller = new DifficultyMappingController(service);
    await expect(
      controller.assign("easy", { llmProviderConfigId: "config-1" }),
    ).rejects.toBe(rawError);
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe (controller-scope @UsePipes) negative cases.
// supertest 로 실제 HTTP 응답 status 검증. DifficultyMappingService 는 mocked.
// R-112 "negative cases 충분 cover" — AssignDifficultyMappingDto reject branch 각 1+
// + non-whitelisted 키 reject + status code (200) wire + invalid difficulty 400 propagate.
// -----------------------------------------------------------------------
describe("DifficultyMappingController (ValidationPipe integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    findAllMappings: jest.Mock;
    assignProviderConfig: jest.Mock;
  };

  const validAssignBody = { llmProviderConfigId: "config-1" };

  beforeEach(async () => {
    serviceMock = {
      findAllMappings: jest.fn(),
      assignProviderConfig: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DifficultyMappingController],
      providers: [{ provide: DifficultyMappingService, useValue: serviceMock }],
    })
      // RBAC guard 는 통과 mock 으로 override — 본 block 은 ValidationPipe 분기가 책임,
      // guard 는 통과시켜 ValidationPipe 에 도달하게 함 (summary.controller.spec mirror).
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // Happy reference — ValidationPipe 가 정상 payload 는 통과시킴 → 200.
  it("정상 PATCH payload 는 ValidationPipe 통과 후 200 응답 (sanity)", async () => {
    serviceMock.assignProviderConfig.mockResolvedValueOnce(
      buildMappingFixture(),
    );

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send(validAssignBody)
      .expect(200);

    expect(serviceMock.assignProviderConfig).toHaveBeenCalledWith(
      "easy",
      "config-1",
    );
  });

  // Negative 1: 필수 field 누락 (빈 body) → @IsNotEmpty/@IsString 위반 → 400.
  it("PATCH 빈 body 시 400 (negative #1: missing llmProviderConfigId)", async () => {
    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send({})
      .expect(400);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });

  // Negative 2: llmProviderConfigId 빈 문자열 → @IsNotEmpty 위반 → 400.
  it("PATCH llmProviderConfigId 가 빈 문자열 시 400 (negative #2: empty required field)", async () => {
    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send({ llmProviderConfigId: "" })
      .expect(400);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });

  // Negative 3: 정의되지 않은 raw 본문 키 (difficulty) → forbidNonWhitelisted → 400.
  // body 에 difficulty 가 섞이는 오용 (path param 과 중복) 을 whitelist 가 reject.
  it("PATCH 에 정의되지 않은 키 (difficulty) 포함 시 400 (negative #3: non-whitelisted field reject)", async () => {
    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send({ ...validAssignBody, difficulty: "hard" })
      .expect(400);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });

  // Negative 4: llmProviderConfigId 가 number → @IsString 위반 → 400.
  it("PATCH llmProviderConfigId 가 비-string 시 400 (negative #4: wrong type)", async () => {
    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send({ llmProviderConfigId: 12345 })
      .expect(400);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });

  // Negative 5: invalid difficulty path param → service BadRequestException → 400 propagate.
  // ValidationPipe 통과 후 service 가 isDifficulty false → 400 (controller raw forward).
  it("PATCH :difficulty 가 미지원 값 ('Easy' 대문자) 시 service 400 propagate (negative #5: invalid difficulty)", async () => {
    serviceMock.assignProviderConfig.mockRejectedValueOnce(
      new BadRequestException("unsupported difficulty: Easy"),
    );

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/Easy")
      .send(validAssignBody)
      .expect(400);

    expect(serviceMock.assignProviderConfig).toHaveBeenCalledWith(
      "Easy",
      "config-1",
    );
  });

  // PATCH error path — service NotFoundException (config 부재) → 404 자동 (HttpException mapping).
  it("PATCH — service NotFoundException (config 부재) 시 404 (error path)", async () => {
    serviceMock.assignProviderConfig.mockRejectedValueOnce(
      new NotFoundException("llm provider config not found: ghost"),
    );

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send({ llmProviderConfigId: "ghost" })
      .expect(404);
  });

  // GET happy — 200 + 배열 반환 (integration-level routing 검산).
  it("GET 시 200 + service.findAllMappings 결과 반환", async () => {
    serviceMock.findAllMappings.mockResolvedValueOnce([buildMappingFixture()]);

    const res = await request(app.getHttpServer())
      .get("/api/llm/difficulty-mappings")
      .expect(200);

    expect(serviceMock.findAllMappings).toHaveBeenCalledTimes(1);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0139). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. summary.controller.spec 의 "RBAC guard integration"
// 1:1 mirror. 실 verify path 는 별도 layer spec (T-0083) 책임 — 본 block 은 2 endpoint
// 에 guard 가 wire 됐는지 + 거부 시 service 미호출 + 통과 시 service 위임 검증.
// -----------------------------------------------------------------------
describe("DifficultyMappingController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    findAllMappings: jest.Mock;
    assignProviderConfig: jest.Mock;
  };

  const validAssignBody = { llmProviderConfigId: "config-1" };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환 (summary.controller.spec mirror).
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

  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = {
      findAllMappings: jest.fn(),
      assignProviderConfig: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DifficultyMappingController],
      providers: [{ provide: DifficultyMappingService, useValue: serviceMock }],
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

  // -- happy — Admin+ tier : Admin role token 으로 GET / PATCH 통과 + service 위임 ---
  it("GET — Admin role 통과 시 200 + service.findAllMappings 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findAllMappings.mockResolvedValueOnce([buildMappingFixture()]);

    await request(app.getHttpServer())
      .get("/api/llm/difficulty-mappings")
      .expect(200);

    expect(serviceMock.findAllMappings).toHaveBeenCalledTimes(1);
  });

  it("PATCH — Admin role 통과 시 200 + service.assignProviderConfig 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.assignProviderConfig.mockResolvedValueOnce(
      buildMappingFixture(),
    );

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send(validAssignBody)
      .expect(200);

    expect(serviceMock.assignProviderConfig).toHaveBeenCalledWith(
      "easy",
      "config-1",
    );
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재 / verify fail) -----------
  it("GET — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .get("/api/llm/difficulty-mappings")
      .expect(401);

    expect(serviceMock.findAllMappings).not.toHaveBeenCalled();
  });

  it("PATCH — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send(validAssignBody)
      .expect(401);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) --------
  it("GET — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/llm/difficulty-mappings")
      .expect(403);

    expect(serviceMock.findAllMappings).not.toHaveBeenCalled();
  });

  it("PATCH — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send(validAssignBody)
      .expect(403);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 Admin+ tier 분기 박제 (mock 이
// 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제), RolesGuard
// 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). summary.controller.spec 의 동일
// describe 1:1 mirror. GET / PATCH 둘 다 Admin+ — User 403 / Admin·SuperAdmin 통과.
// -----------------------------------------------------------------------
describe("DifficultyMappingController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    findAllMappings: jest.Mock;
    assignProviderConfig: jest.Mock;
  };

  const validAssignBody = { llmProviderConfigId: "config-1" };

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
      findAllMappings: jest.fn(),
      assignProviderConfig: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DifficultyMappingController],
      providers: [
        { provide: DifficultyMappingService, useValue: serviceMock },
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

  // Admin+ tier (GET) — User actor 는 403 차단 (실 RolesGuard escalation).
  it("GET — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .get("/api/llm/difficulty-mappings")
      .expect(403);

    expect(serviceMock.findAllMappings).not.toHaveBeenCalled();
  });

  // Admin+ tier (GET) — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "GET — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findAllMappings.mockResolvedValueOnce([]);

      await request(app.getHttpServer())
        .get("/api/llm/difficulty-mappings")
        .expect(200);

      expect(serviceMock.findAllMappings).toHaveBeenCalledTimes(1);
    },
  );

  // Admin+ tier (PATCH) — User actor 403 차단.
  it("PATCH — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .patch("/api/llm/difficulty-mappings/easy")
      .send(validAssignBody)
      .expect(403);

    expect(serviceMock.assignProviderConfig).not.toHaveBeenCalled();
  });

  // Admin+ tier (PATCH) — Admin / SuperAdmin actor 통과.
  it.each(["Admin", "SuperAdmin"])(
    "PATCH — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.assignProviderConfig.mockResolvedValueOnce(
        buildMappingFixture(),
      );

      await request(app.getHttpServer())
        .patch("/api/llm/difficulty-mappings/easy")
        .send(validAssignBody)
        .expect(200);

      expect(serviceMock.assignProviderConfig).toHaveBeenCalledTimes(1);
    },
  );
});
