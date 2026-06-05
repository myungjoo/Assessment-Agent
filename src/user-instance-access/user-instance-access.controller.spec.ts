// UserInstanceAccessController spec — T-0238 acceptance 박제 (2 endpoint:
// POST grant / DELETE revoke, R-112: happy / error / branch / negative + RBAC guard
// wire + @Roles metadata 단언). llm-provider-config.controller.spec.ts (T-0140/T-0149/
// T-0150) 1:1 mirror, 단 본 controller 의 차이 반영:
//   - 2 endpoint (POST grant / DELETE revoke) — GET 부재 (READ-path 는 별도 controller).
//   - 양쪽 endpoint 가 동일 GrantInstanceAccessDto 를 @Body() 로 재사용.
//   - controller 자체 분기 없음 — self-grant 403 / P2002→409 / P2003→404 / revoke
//     idempotency 는 전부 service 책임 (ADR-0027 §3 단일 판별 지점). controller 는
//     actor.sub + path id + dto.instanceRef 를 service 로 raw forward 만 함 →
//     forward 검증 + service-throw raw propagation 으로 cover.
//   - POST/DELETE 모두 Admin+ tier (binding 부여/회수는 administrative concern,
//     REQ-016).
//
// 본 spec 은 4 부분으로 구성 (llm-provider-config.controller.spec mirror):
//   1. Unit-level (controller-only with mocked UserInstanceAccessService) — grant/
//      revoke 의 service 호출 인자 / 반환 forward / 예외 raw propagation 검증.
//   2. guard/@Roles metadata 단언 — Reflector 로 POST/DELETE 핸들러에 @Roles("Admin")
//      + @UseGuards(JwtAuthGuard, RolesGuard) 부착 검증 (RBAC 게이트가 라우트를
//      gate 하는지를 metadata 수준에서 단언 — guard 실행 자체는 e2e slice 책임).
//   3. RBAC guard integration — JwtAuthGuard / RolesGuard 의 통과/거부 분기 overrideGuard.
//   4. real RolesGuard escalation — 실 escalation 매핑 (User 403 / Admin·SuperAdmin 통과).
//
// PrismaService 는 Controller → Service → Repository chain 의 dep 안전성을 위해
// jest.mock 으로 회피 (llm-provider-config.controller.spec 패턴 동일).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    userInstanceAccess = {
      create: jest.fn(),
      deleteMany: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";
import type { UserInstanceAccess } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { UserInstanceAccessController } from "./user-instance-access.controller";
import { UserInstanceAccessService } from "./user-instance-access.service";
/* eslint-enable import/first */

// UserInstanceAccess fixture — grant 가 반환하는 row shape.
function buildAccessFixture(
  overrides: Partial<UserInstanceAccess> = {},
): UserInstanceAccess {
  return {
    id: "uia-default",
    userId: "user-target",
    instanceRef: "github.example.test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as UserInstanceAccess;
}

// UserInstanceAccessService mock factory — grant / revoke 메서드 jest.fn().
function buildServiceMock(): {
  service: UserInstanceAccessService;
  serviceMock: { grant: jest.Mock; revoke: jest.Mock };
} {
  const serviceMock = {
    grant: jest.fn(),
    revoke: jest.fn(),
  };
  return {
    service: serviceMock as unknown as UserInstanceAccessService,
    serviceMock,
  };
}

describe("UserInstanceAccessController (unit)", () => {
  // -----------------------------------------------------------------------
  // grant (POST /api/users/:id/instance-access) — happy (actorSub + path id +
  // dto.instanceRef 정확 forward) + error/negative (service throw raw propagate).
  // controller 자체 분기 없음 — service raw forward (ADR-0027 §3 단일 판별 지점).
  // -----------------------------------------------------------------------
  it("POST grant — Admin actor 의 grant 가 service.grant(actorSub, id, instanceRef) 를 정확한 인자로 호출 + 반환 forward (happy, 201 의미)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const fixture = buildAccessFixture({ id: "uia-1" });
    serviceMock.grant.mockResolvedValueOnce(fixture);
    const dto = { instanceRef: "github.example.test" };

    const controller = new UserInstanceAccessController(service);
    const result = await controller.grant("user-target", dto, "admin-actor");

    // service.grant 가 (actorSub, targetUserId(path id), dto.instanceRef) 순서로
    // 정확히 1 회 호출됨 검증 — controller 자체 분기 없이 raw forward.
    expect(serviceMock.grant).toHaveBeenCalledTimes(1);
    expect(serviceMock.grant).toHaveBeenCalledWith(
      "admin-actor",
      "user-target",
      "github.example.test",
    );
    // 생성된 binding row 를 그대로 forward (201 Created 의미).
    expect(result).toBe(fixture);
  });

  it("POST grant — service 의 ConflictException (중복 P2002→409) 을 삼키지 않고 raw propagate (negative — 중복 grant)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const conflict = new ConflictException("binding already exists");
    serviceMock.grant.mockRejectedValueOnce(conflict);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.grant("user-target", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(conflict);
  });

  it("POST grant — service 의 NotFoundException (unknown user P2003→404) 을 raw propagate (negative — unknown user)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const notFound = new NotFoundException("user not found: missing");
    serviceMock.grant.mockRejectedValueOnce(notFound);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.grant("missing", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(notFound);
  });

  it("POST grant — service 의 ForbiddenException (self-grant→403) 을 raw propagate (negative — self-grant)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const forbidden = new ForbiddenException("self-grant is not allowed");
    serviceMock.grant.mockRejectedValueOnce(forbidden);

    const controller = new UserInstanceAccessController(service);
    // actor.sub === path id (self-grant) — controller 는 추가 판별 없이 service 로
    // forward, service 가 ForbiddenException 을 throw → raw propagate.
    await expect(
      controller.grant("admin-actor", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(forbidden);
  });

  it("POST grant — service 가 던진 raw Error (의존성 fail) 를 삼키지 않고 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.grant.mockRejectedValueOnce(rawError);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.grant("user-target", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // revoke (DELETE /api/users/:id/instance-access) — happy (actorSub + path id +
  // dto.instanceRef forward, void 반환) + error/negative (service throw raw
  // propagate) + idempotent no-op (부재 binding 도 service 가 정상 resolve → 204).
  // controller 자체 분기 없음 — service raw forward.
  // -----------------------------------------------------------------------
  it("DELETE revoke — Admin actor 의 revoke 가 service.revoke(actorSub, id, instanceRef) 호출 + void 반환 (happy, 204 의미)", async () => {
    const { service, serviceMock } = buildServiceMock();
    serviceMock.revoke.mockResolvedValueOnce(undefined);
    const dto = { instanceRef: "github.example.test" };

    const controller = new UserInstanceAccessController(service);
    const result = await controller.revoke("user-target", dto, "admin-actor");

    expect(serviceMock.revoke).toHaveBeenCalledTimes(1);
    expect(serviceMock.revoke).toHaveBeenCalledWith(
      "admin-actor",
      "user-target",
      "github.example.test",
    );
    // controller 가 service 의 void 를 그대로 반환 (204 No Content 의미, body 0).
    expect(result).toBeUndefined();
  });

  it("DELETE revoke — 부재 binding 도 service 가 정상 resolve (idempotent no-op) → controller 가 204 의미로 통과 (negative — 부재 binding)", async () => {
    const { service, serviceMock } = buildServiceMock();
    // 부재 binding 은 service 가 throw 없이 정상 resolve (idempotent, ADR-0027 §4).
    serviceMock.revoke.mockResolvedValueOnce(undefined);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.revoke(
        "user-target",
        { instanceRef: "absent" },
        "admin-actor",
      ),
    ).resolves.toBeUndefined();
    expect(serviceMock.revoke).toHaveBeenCalledTimes(1);
  });

  it("DELETE revoke — service 의 NotFoundException (unknown user P2003→404) 을 raw propagate (negative — unknown user)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const notFound = new NotFoundException("user not found: missing");
    serviceMock.revoke.mockRejectedValueOnce(notFound);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.revoke("missing", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(notFound);
  });

  it("DELETE revoke — service 의 ForbiddenException (self-revoke→403) 을 raw propagate (negative — self-revoke)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const forbidden = new ForbiddenException("self-revoke is not allowed");
    serviceMock.revoke.mockRejectedValueOnce(forbidden);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.revoke("admin-actor", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(forbidden);
  });

  it("DELETE revoke — service 가 던진 raw Error (의존성 fail) 를 삼키지 않고 그대로 propagate (error path)", async () => {
    const { service, serviceMock } = buildServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.revoke.mockRejectedValueOnce(rawError);

    const controller = new UserInstanceAccessController(service);
    await expect(
      controller.revoke("user-target", { instanceRef: "x" }, "admin-actor"),
    ).rejects.toBe(rawError);
  });
});

// -----------------------------------------------------------------------
// guard/@Roles metadata 단언 (T-0238) — Reflector 로 POST(grant)/DELETE(revoke)
// 핸들러에 @Roles("Admin") + @UseGuards(JwtAuthGuard, RolesGuard) 가 부착됐음을
// 검증. RBAC 게이트가 실제로 라우트를 gate 하는지를 metadata 수준에서 단언한다
// (guard 실행 자체의 401/403 live 검증은 e2e slice 책임 — 본 spec 은 metadata 단언
// 까지만, T-0238 §Out of Scope). controller 자체 분기 없음 — service raw forward 임을
// 본 block 의 주석으로 명시.
// -----------------------------------------------------------------------
describe("UserInstanceAccessController (guard/@Roles metadata)", () => {
  const reflector = new Reflector();

  it.each([
    ["grant", UserInstanceAccessController.prototype.grant],
    ["revoke", UserInstanceAccessController.prototype.revoke],
  ])(
    "%s 핸들러에 @Roles('Admin') metadata 부착 (Admin+ tier gate)",
    (_name, handler) => {
      const roles = reflector.get<string[]>(ROLES_METADATA_KEY, handler);
      expect(roles).toEqual(["Admin"]);
    },
  );

  it.each([
    ["grant", UserInstanceAccessController.prototype.grant],
    ["revoke", UserInstanceAccessController.prototype.revoke],
  ])(
    "%s 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증+RBAC gate)",
    (_name, handler) => {
      // NestJS @UseGuards 는 "__guards__" metadata key 에 guard class 배열을 박제.
      const guards = Reflect.getMetadata("__guards__", handler) as unknown[];
      expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    },
  );
});

// -----------------------------------------------------------------------
// Integration — RBAC guard wire (T-0238). JwtAuthGuard / RolesGuard 의 통과/거부
// 분기를 overrideGuard 로 박제 + ValidationPipe negative + 201/204 status HTTP-level
// 검증. llm-provider-config.controller.spec 의 "RBAC guard integration" mirror.
// -----------------------------------------------------------------------
describe("UserInstanceAccessController (RBAC guard integration)", () => {
  let app: INestApplication;
  let serviceMock: { grant: jest.Mock; revoke: jest.Mock };

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

  const VALID_BODY = { instanceRef: "github.example.test" };

  async function buildApp(opts: {
    jwt: { canActivate: (ctx: ExecutionContext) => boolean };
    roles: { canActivate: (ctx: ExecutionContext) => boolean };
  }): Promise<INestApplication> {
    serviceMock = { grant: jest.fn(), revoke: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserInstanceAccessController],
      providers: [
        { provide: UserInstanceAccessService, useValue: serviceMock },
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

  // == POST /api/users/:id/instance-access — grant endpoint ========================

  // -- happy — Admin role 통과 시 201 + service.grant(actorSub, id, instanceRef) 위임 --
  it("POST — Admin role 통과 시 201 + service.grant(actorSub, id, instanceRef) 위임 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.grant.mockResolvedValueOnce(
      buildAccessFixture({ id: "uia-c" }),
    );

    const res = await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(201);

    expect(serviceMock.grant).toHaveBeenCalledTimes(1);
    // actor.sub (JwtAuthGuard 가 박제) + path id + dto.instanceRef 순서 검증.
    expect(serviceMock.grant).toHaveBeenCalledWith(
      "admin-1",
      "user-target",
      "github.example.test",
    );
    expect(res.body.id).toBe("uia-c");
  });

  // -- negative — service ConflictException (중복) → 409 (raw propagate) ------------
  it("POST — service 가 ConflictException (중복 grant) throw 시 409 (negative 핵심 — 중복)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.grant.mockRejectedValueOnce(
      new ConflictException("binding already exists"),
    );

    await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(409);
  });

  // -- negative — service NotFoundException (unknown user) → 404 (raw propagate) ----
  it("POST — service 가 NotFoundException (unknown user) throw 시 404 (negative 핵심 — unknown user)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.grant.mockRejectedValueOnce(
      new NotFoundException("user not found: missing"),
    );

    await request(app.getHttpServer())
      .post("/api/users/missing/instance-access")
      .send(VALID_BODY)
      .expect(404);
  });

  // -- negative — service ForbiddenException (self-grant) → 403 (raw propagate) -----
  it("POST — service 가 ForbiddenException (self-grant) throw 시 403 (negative 핵심 — self-grant)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.grant.mockRejectedValueOnce(
      new ForbiddenException("self-grant is not allowed"),
    );

    await request(app.getHttpServer())
      .post("/api/users/admin-1/instance-access")
      .send(VALID_BODY)
      .expect(403);
  });

  // -- negative — ValidationPipe: 정의되지 않은 extra body 키 → 400 + service 미호출 -
  it("POST — 정의되지 않은 extra body 키 포함 시 400 + service 미호출 (negative — forbidNonWhitelisted)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send({ ...VALID_BODY, unexpectedKey: "x" })
      .expect(400);

    expect(serviceMock.grant).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: 필수 필드 (instanceRef) 누락 → 400 + service 미호출 -
  it("POST — 필수 필드 (instanceRef) 누락 시 400 + service 미호출 (negative — missing/empty field)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send({})
      .expect(400);

    expect(serviceMock.grant).not.toHaveBeenCalled();
  });

  // -- negative — ValidationPipe: wrong type (number) → 400 + service 미호출 --------
  it("POST — instanceRef wrong type (number) 시 400 + service 미호출 (negative — type mismatch)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send({ instanceRef: 12345 })
      .expect(400);

    expect(serviceMock.grant).not.toHaveBeenCalled();
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
      .post("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(401);

    expect(serviceMock.grant).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("POST — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.grant).not.toHaveBeenCalled();
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ----------------
  it("POST — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.grant.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .post("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(500);
  });

  // == DELETE /api/users/:id/instance-access — revoke endpoint =====================

  // -- happy — Admin role 통과 시 204 + service.revoke 위임 + body 0 ----------------
  it("DELETE — Admin role 통과 시 204 + service.revoke(actorSub, id, instanceRef) 위임 + body 0 (happy — Admin+ tier)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.revoke.mockResolvedValueOnce(undefined);

    const res = await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(204);

    expect(serviceMock.revoke).toHaveBeenCalledTimes(1);
    expect(serviceMock.revoke).toHaveBeenCalledWith(
      "admin-1",
      "user-target",
      "github.example.test",
    );
    // 204 No Content — 응답 body 가 비어있음.
    expect(res.text).toBe("");
    expect(res.body).toEqual({});
  });

  // -- happy — 부재 binding 도 service 가 idempotent no-op → 204 (idempotency) -------
  it("DELETE — 부재 binding revoke 도 service idempotent no-op → 204 (idempotency)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.revoke.mockResolvedValueOnce(undefined);

    await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send({ instanceRef: "absent" })
      .expect(204);

    expect(serviceMock.revoke).toHaveBeenCalledTimes(1);
  });

  // -- negative — service NotFoundException (unknown user) → 404 (raw propagate) ----
  it("DELETE — service 가 NotFoundException (unknown user) throw 시 404 (negative 핵심 — unknown user)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.revoke.mockRejectedValueOnce(
      new NotFoundException("user not found: missing"),
    );

    await request(app.getHttpServer())
      .delete("/api/users/missing/instance-access")
      .send(VALID_BODY)
      .expect(404);
  });

  // -- negative — service ForbiddenException (self-revoke) → 403 (raw propagate) ----
  it("DELETE — service 가 ForbiddenException (self-revoke) throw 시 403 (negative 핵심 — self-revoke)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.revoke.mockRejectedValueOnce(
      new ForbiddenException("self-revoke is not allowed"),
    );

    await request(app.getHttpServer())
      .delete("/api/users/admin-1/instance-access")
      .send(VALID_BODY)
      .expect(403);
  });

  // -- negative — ValidationPipe: instanceRef 누락 → 400 + service 미호출 -----------
  it("DELETE — 필수 필드 (instanceRef) 누락 시 400 + service 미호출 (negative — missing field)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send({})
      .expect(400);

    expect(serviceMock.revoke).not.toHaveBeenCalled();
  });

  // -- negative — 401 (JwtAuthGuard reject — 인증 부재) + service 미호출 -----------
  it("DELETE — JwtAuthGuard reject 시 401 + service 미호출 (negative — 인증 부재)", async () => {
    app = await buildApp({
      jwt: {
        canActivate: () => {
          throw new UnauthorizedException("Unauthorized");
        },
      },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(401);

    expect(serviceMock.revoke).not.toHaveBeenCalled();
  });

  // -- negative — 403 (RolesGuard reject — Admin+ tier 미달, User actor) ----------
  it("DELETE — RolesGuard reject 시 403 + service 미호출 (negative — User actor Admin+ 미달)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("user-1", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.revoke).not.toHaveBeenCalled();
  });

  // -- error path — service reject (DB 장애) → 500 (raw propagate) ----------------
  it("DELETE — service reject (DB 장애) 시 500 + raw propagate (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("admin-1", "Admin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.revoke.mockRejectedValueOnce(new Error("db-down"));

    await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(500);
  });
});

// -----------------------------------------------------------------------
// RealRolesGuard escalation — 실 RolesGuard 를 사용해 Admin+ tier 분기 박제 (mock 이
// 아닌 실 escalation 매핑 cover). JwtAuthGuard 는 통과 mock (req.user 박제), RolesGuard
// 는 실 instance (Reflector + ROLE_HIERARCHY 실 매핑). llm-provider-config.controller.
// spec 의 동일 describe mirror. POST/DELETE 모두 Admin+ — User 403 / Admin·SuperAdmin
// 통과.
// -----------------------------------------------------------------------
describe("UserInstanceAccessController (real RolesGuard escalation 분기)", () => {
  let app: INestApplication;
  let serviceMock: { grant: jest.Mock; revoke: jest.Mock };

  const VALID_BODY = { instanceRef: "github.example.test" };

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
    serviceMock = { grant: jest.fn(), revoke: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserInstanceAccessController],
      providers: [
        { provide: UserInstanceAccessService, useValue: serviceMock },
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
      .post("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.grant).not.toHaveBeenCalled();
  });

  // POST — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 201.
  it.each(["Admin", "SuperAdmin"])(
    "POST — %s actor 는 Admin+ tier 통과 (201, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.grant.mockResolvedValueOnce(buildAccessFixture());

      await request(app.getHttpServer())
        .post("/api/users/user-target/instance-access")
        .send(VALID_BODY)
        .expect(201);

      expect(serviceMock.grant).toHaveBeenCalledTimes(1);
    },
  );

  // DELETE Admin+ tier — User actor 는 403 차단 (실 RolesGuard escalation).
  it("DELETE — User actor 는 Admin+ tier 미달 → 403 (실 RolesGuard escalation)", async () => {
    app = await buildAppWithRealRolesGuard("User");

    await request(app.getHttpServer())
      .delete("/api/users/user-target/instance-access")
      .send(VALID_BODY)
      .expect(403);

    expect(serviceMock.revoke).not.toHaveBeenCalled();
  });

  // DELETE — Admin / SuperAdmin actor 통과 (escalation hierarchy descent) → 204.
  it.each(["Admin", "SuperAdmin"])(
    "DELETE — %s actor 는 Admin+ tier 통과 (204, escalation hierarchy descent)",
    async (role) => {
      app = await buildAppWithRealRolesGuard(role);
      serviceMock.revoke.mockResolvedValueOnce(undefined);

      await request(app.getHttpServer())
        .delete("/api/users/user-target/instance-access")
        .send(VALID_BODY)
        .expect(204);

      expect(serviceMock.revoke).toHaveBeenCalledTimes(1);
    },
  );
});
