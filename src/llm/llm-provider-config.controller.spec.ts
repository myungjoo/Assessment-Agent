// LlmProviderConfigController spec — T-0140 acceptance 박제 (1 endpoint, R-112:
// happy / error / branch / negative + RBAC guard wire).
// difficulty-mapping.controller.spec.ts (T-0139) 1:1 mirror, 단 본 controller 의
// 차이 반영:
//   - 1 endpoint (GET findAll) — PATCH/POST/DELETE 부재 (config CRUD 는 Follow-up #1).
//   - DTO 부재 (read-only GET) — ValidationPipe negative case 는 GET 에 본문 검증 분기가
//     없으므로 RBAC + routing 검증 중심.
//   - GET 은 Admin+ tier (DifficultyMappingController GET 동일 — LLM provider config 는
//     administrative concern, REQ-096).
//   - service 가 apiKey redaction 책임 (controller raw forward) — controller 분기 없음,
//     forward 검증 + service-throw propagation 으로 cover.
//
// 본 spec 은 3 부분으로 구성 (difficulty-mapping.controller.spec.ts mirror):
//   1. Unit-level (controller-only with mocked LlmProviderConfigService) — GET 의
//      routing / service 호출 / 예외 propagation 검증 + 빈/비어있지 않은 배열 분기.
//   2. RBAC guard integration — JwtAuthGuard / RolesGuard 의 통과/거부 분기 overrideGuard.
//   3. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 통과).
//
// PrismaService 는 Controller → Service → Repository chain 의 dep 안전성을 위해
// jest.mock 으로 회피 (difficulty-mapping.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
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
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { LlmProviderConfigController } from "./llm-provider-config.controller";
import {
  LlmProviderConfigService,
  type LlmProviderConfigView,
} from "./llm-provider-config.service";
/* eslint-enable import/first */

// LlmProviderConfigView fixture — apiKey 가 이미 제거된 view shape (service 가
// sanitize 한 형태). controller 는 이 view 를 raw forward 만 함.
function buildViewFixture(
  overrides: Partial<LlmProviderConfigView> = {},
): LlmProviderConfigView {
  return {
    id: "cfg-default",
    provider: "openai",
    endpointUrl: "https://api.example.test",
    modelId: "gpt-test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// LlmProviderConfigService mock factory — findAll / findById / create 메서드
// jest.fn(). 각 test 마다 새 mock (호출 카운터 격리).
function buildServiceMock(): {
  service: LlmProviderConfigService;
  serviceMock: { findAll: jest.Mock; findById: jest.Mock; create: jest.Mock };
} {
  const serviceMock = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  return {
    service: serviceMock as unknown as LlmProviderConfigService,
    serviceMock,
  };
}

describe("LlmProviderConfigController (unit)", () => {
  // -----------------------------------------------------------------------
  // findAll (GET /api/llm/providers) — happy + branch (빈/비어있지 않은 배열)
  // -----------------------------------------------------------------------
  it("GET — findAll 결과 (다중 row) 를 그대로 반환 (happy + branch — 비어있지 않은 배열)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = [
      buildViewFixture({ id: "cfg-1" }),
      buildViewFixture({ id: "cfg-2" }),
    ];
    serviceMock.findAll.mockResolvedValueOnce(fixture);

    const controller = new LlmProviderConfigController(service);
    const result = await controller.findAll();

    expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
    expect(result).toHaveLength(2);
  });

  it("GET — 등록 0 시 빈 배열도 그대로 반환 (branch — empty propagate, 404 변환 안 함)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.findAll.mockResolvedValueOnce([]);

    const controller = new LlmProviderConfigController(service);
    const result = await controller.findAll();

    expect(result).toEqual([]);
  });

  it("GET — service 가 던진 unknown raw Error 를 삼키지 않고 그대로 propagate (error / negative — 의존성 fail)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.findAll.mockRejectedValueOnce(rawError);

    const controller = new LlmProviderConfigController(service);
    await expect(controller.findAll()).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // findById (GET /api/llm/providers/:id) — happy (path param forward) +
  // error/negative (service throw propagate). controller 자체 분기 없음 —
  // forward 검증 + service-throw raw propagation 으로 cover.
  // -----------------------------------------------------------------------
  it("GET :id — service.findById 결과를 그대로 반환 + path param id 로 호출 (happy — forward)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildViewFixture({ id: "cfg-target" });
    serviceMock.findById.mockResolvedValueOnce(fixture);

    const controller = new LlmProviderConfigController(service);
    const result = await controller.findById("cfg-target");

    // service 가 path param id 로 정확히 1 회 호출됨 검증.
    expect(serviceMock.findById).toHaveBeenCalledTimes(1);
    expect(serviceMock.findById).toHaveBeenCalledWith("cfg-target");
    expect(result).toBe(fixture);
    // forward 한 view 에 apiKey 가 새어나가지 않음 (service redaction) 확인.
    expect(result).not.toHaveProperty("apiKey");
  });

  it("GET :id — service 의 NotFoundException 을 삼키지 않고 그대로 propagate (negative — 404 변환 분기)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const notFound = new NotFoundException("llm provider config not found: x");
    serviceMock.findById.mockRejectedValueOnce(notFound);

    const controller = new LlmProviderConfigController(service);
    await expect(controller.findById("missing-id")).rejects.toBe(notFound);
  });

  it("GET :id — service 가 던진 raw Error (의존성 fail) 를 삼키지 않고 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.findById.mockRejectedValueOnce(rawError);

    const controller = new LlmProviderConfigController(service);
    await expect(controller.findById("any-id")).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // create (POST /api/llm/providers) — happy (@Body dto forward) + error/negative
  // (service throw propagate). controller 자체 분기 없음 — service raw forward.
  // -----------------------------------------------------------------------
  it("POST — service.create 결과를 그대로 반환 + @Body dto 로 호출 (happy — forward)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildViewFixture({ id: "cfg-created" });
    serviceMock.create.mockResolvedValueOnce(fixture);
    const dto = {
      provider: "openai",
      endpointUrl: "https://api.example.test",
      apiKey: "sk-plain",
      modelId: "gpt-test",
    };

    const controller = new LlmProviderConfigController(service);
    const result = await controller.create(dto as never);

    // service.create 가 dto 로 정확히 1 회 호출됨 검증.
    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
    expect(result).toBe(fixture);
    // forward 한 view 에 apiKey 가 새어나가지 않음 (service redaction) 확인.
    expect(result).not.toHaveProperty("apiKey");
  });

  it("POST — service 의 BadRequestException 을 삼키지 않고 그대로 propagate (negative — 미지원 provider 분기)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const badReq = new BadRequestException("unsupported llm provider: x");
    serviceMock.create.mockRejectedValueOnce(badReq);

    const controller = new LlmProviderConfigController(service);
    await expect(controller.create({} as never)).rejects.toBe(badReq);
  });

  it("POST — service 가 던진 raw Error (encrypt/DB fail) 를 삼키지 않고 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("LLM_APIKEY_ENC_KEY 미설정");
    serviceMock.create.mockRejectedValueOnce(rawError);

    const controller = new LlmProviderConfigController(service);
    await expect(controller.create({} as never)).rejects.toBe(rawError);
  });
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0140). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제. difficulty-mapping.controller.spec 의 "RBAC guard
// integration" 1:1 mirror. 실 verify path 는 별도 layer spec (T-0083) 책임 — 본
// block 은 GET endpoint 에 guard 가 wire 됐는지 + 거부 시 service 미호출 + 통과 시
// service 위임 검증.
// -----------------------------------------------------------------------
describe("LlmProviderConfigController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };

  // 통과 JwtAuthGuard mock — req.user 박제 + true 반환.
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
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LlmProviderConfigController],
      providers: [{ provide: LlmProviderConfigService, useValue: serviceMock }],
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

  // -- happy — Admin+ tier : Admin role token 으로 GET 통과 + service 위임 ---------
  it("GET — Admin role 통과 시 200 + service.findAll 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findAll.mockResolvedValueOnce([buildViewFixture()]);

    const res = await request(app.getHttpServer())
      .get("/api/llm/providers")
      .expect(200);

    expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    expect(Array.isArray(res.body)).toBe(true);
    // 응답 본문에 apiKey 가 새어나가지 않음 (service view forward) 추가 확인.
    expect(res.body[0]).not.toHaveProperty("apiKey");
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재 / verify fail) -------------
  it("GET — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer()).get("/api/llm/providers").expect(401);

    expect(serviceMock.findAll).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("GET — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer()).get("/api/llm/providers").expect(403);

    expect(serviceMock.findAll).not.toHaveBeenCalled();
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ----------------
  it("GET — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findAll.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer()).get("/api/llm/providers").expect(500);
  });

  // == GET :id — 단건 endpoint RBAC + 404 변환 HTTP-level 검증 =====================

  // -- happy — Admin role 통과 시 200 + service.findById(path param) 위임 ----------
  it("GET :id — Admin role 통과 시 200 + service.findById(id) 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findById.mockResolvedValueOnce(
      buildViewFixture({ id: "cfg-x" }),
    );

    const res = await request(app.getHttpServer())
      .get("/api/llm/providers/cfg-x")
      .expect(200);

    expect(serviceMock.findById).toHaveBeenCalledTimes(1);
    expect(serviceMock.findById).toHaveBeenCalledWith("cfg-x");
    // 응답 본문에 apiKey 가 새어나가지 않음 (service view forward) 확인.
    expect(res.body).not.toHaveProperty("apiKey");
    expect(res.body.id).toBe("cfg-x");
  });

  // -- negative (핵심) — service NotFoundException → 404 (raw propagate) ----------
  it("GET :id — service 가 NotFoundException throw 시 404 (negative 핵심 — null→404)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findById.mockRejectedValueOnce(
      new NotFoundException("llm provider config not found: missing"),
    );

    await request(app.getHttpServer())
      .get("/api/llm/providers/missing")
      .expect(404);
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) + service 미호출 -----------
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
      .get("/api/llm/providers/cfg-x")
      .expect(401);

    expect(serviceMock.findById).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("GET :id — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .get("/api/llm/providers/cfg-x")
      .expect(403);

    expect(serviceMock.findById).not.toHaveBeenCalled();
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ----------------
  it("GET :id — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.findById.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .get("/api/llm/providers/cfg-x")
      .expect(500);
  });

  // == POST /api/llm/providers — 생성 endpoint RBAC + ValidationPipe + 201 ==========

  // 유효 본문 fixture — ValidationPipe 통과용 4 필드.
  const VALID_BODY = {
    provider: "openai",
    endpointUrl: "https://api.example.test",
    apiKey: "sk-plaintext",
    modelId: "gpt-test",
  };

  // -- happy — Admin role 통과 시 201 + service.create(dto) 위임 + apiKey 미노출 ----
  it("POST — Admin role 통과 시 201 + service.create 위임 + 응답에 apiKey 미노출 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.create.mockResolvedValueOnce(buildViewFixture({ id: "cfg-c" }));

    const res = await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send(VALID_BODY)
      .expect(201);

    expect(serviceMock.create).toHaveBeenCalledTimes(1);
    expect(serviceMock.create).toHaveBeenCalledWith(VALID_BODY);
    // 응답 본문에 apiKey 가 새어나가지 않음 (never-read-back invariant, ADR-0014 §3).
    expect(res.body).not.toHaveProperty("apiKey");
    expect(res.body.id).toBe("cfg-c");
  });

  // -- negative — ValidationPipe: 정의되지 않은 extra body 키 → 400 + service 미호출 -
  it("POST — 정의되지 않은 extra body 키 포함 시 400 + service 미호출 (negative — forbidNonWhitelisted)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send({ ...VALID_BODY, unexpectedKey: "x" })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: 필수 필드 누락 → 400 + service 미호출 -------------
  it("POST — 필수 필드 (apiKey) 누락 시 400 + service 미호출 (negative — missing field)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    const withoutApiKey = {
      provider: VALID_BODY.provider,
      endpointUrl: VALID_BODY.endpointUrl,
      modelId: VALID_BODY.modelId,
    };

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send(withoutApiKey)
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: wrong type (number) → 400 + service 미호출 --------
  it("POST — 필드 wrong type (provider=number) 시 400 + service 미호출 (negative — type mismatch)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send({ ...VALID_BODY, provider: 12345 })
      .expect(400);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — service BadRequestException (미지원 provider) → 400 ---------------
  it("POST — service 가 BadRequestException (미지원 provider) throw 시 400 (negative 핵심 — provider 검증)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.create.mockRejectedValueOnce(
      new BadRequestException("unsupported llm provider: foo"),
    );

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send({ ...VALID_BODY, provider: "foo" })
      .expect(400);
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
      .post("/api/llm/providers")
      .send(VALID_BODY)
      .expect(401);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("POST — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // -- error path — service reject (encrypt/DB 장애) → 500 (raw propagate) ---------
  it("POST — service reject (encrypt/DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.create.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send(VALID_BODY)
      .expect(500);
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 Admin+ tier 분기 박제 (mock 이
// 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제), RolesGuard
// 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). difficulty-mapping.controller.spec
// 의 동일 describe 1:1 mirror. GET 은 Admin+ — User 403 / Admin·SuperAdmin 통과.
// -----------------------------------------------------------------------
describe("LlmProviderConfigController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: {
    findAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
  };

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
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LlmProviderConfigController],
      providers: [
        { provide: LlmProviderConfigService, useValue: serviceMock },
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

    await request(app.getHttpServer()).get("/api/llm/providers").expect(403);

    expect(serviceMock.findAll).not.toHaveBeenCalled();
  });

  // Admin+ tier (GET) — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "GET — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findAll.mockResolvedValueOnce([]);

      await request(app.getHttpServer()).get("/api/llm/providers").expect(200);

      expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
    },
  );

  // GET :id 도 동일 Admin+ tier — User actor 는 실 RolesGuard escalation 으로 403 차단.
  it("GET :id — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .get("/api/llm/providers/cfg-x")
      .expect(403);

    expect(serviceMock.findById).not.toHaveBeenCalled();
  });

  // GET :id — Admin / SuperAdmin actor 통과 (escalation hierarchy descent).
  it.each(["Admin", "SuperAdmin"])(
    "GET :id — %s actor 는 Admin+ tier 통과 (200, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.findById.mockResolvedValueOnce(buildViewFixture());

      await request(app.getHttpServer())
        .get("/api/llm/providers/cfg-x")
        .expect(200);

      expect(serviceMock.findById).toHaveBeenCalledTimes(1);
    },
  );

  // POST 도 동일 Admin+ tier — User actor 는 실 RolesGuard escalation 으로 403 차단.
  it("POST — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .post("/api/llm/providers")
      .send({
        provider: "openai",
        endpointUrl: "https://api.example.test",
        apiKey: "sk-plaintext",
        modelId: "gpt-test",
      })
      .expect(403);

    expect(serviceMock.create).not.toHaveBeenCalled();
  });

  // POST — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 201.
  it.each(["Admin", "SuperAdmin"])(
    "POST — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.create.mockResolvedValueOnce(buildViewFixture());

      await request(app.getHttpServer())
        .post("/api/llm/providers")
        .send({
          provider: "openai",
          endpointUrl: "https://api.example.test",
          apiKey: "sk-plaintext",
          modelId: "gpt-test",
        })
        .expect(201);

      expect(serviceMock.create).toHaveBeenCalledTimes(1);
    },
  );
});
