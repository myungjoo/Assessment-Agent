// UserController spec — T-0087 acceptance §D 박제 (R-112 4 카테고리: happy / error /
// branch / negative + negative cases 충분 cover + ValidationPipe / RolesGuard
// integration via supertest).
//
// 본 spec 은 두 부분으로 구성 (GroupController spec T-0055/T-0057/T-0068 1:1 mirror):
//   1. Unit-level (controller-only with mocked UserService) — PATCH endpoint 의 routing /
//      service 호출 인자 / 예외 propagation 검증. req.user.sub 의 propagate 검증 포함.
//   2. Integration-level (createNestApplication + ValidationPipe + Guard override) —
//      ChangeRoleDto decorator 위반 negative case + Guard wire 검증.
//
// Guard override 전략 — JwtAuthGuard / RolesGuard 의 실 verify path 는 별도 layer 책임
// (각각 본 system 의 spec 이 cover, T-0083). 본 spec 은 controller 단일 책임 + service
// mock 으로 cover. Guard 는 overrideGuard 로 통과/거부 분기 박제.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import type { Request } from "express";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { UserController } from "./user.controller";
import { UserService } from "./user.service";
/* eslint-enable import/first */

// User fixture — schema.prisma 의 6 컬럼 (id / email / hashedPassword / role /
// createdAt / updatedAt) default 채움. user.service.spec / user.repository.spec 의
// 동일 helper 1:1 mirror.
function buildUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: "user-default",
    email: "user@example.com",
    hashedPassword: "$argon2id$v=19$m=65536,t=3,p=4$mock-hash",
    role: "User",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// UserService mock factory — controller 가 사용하는 1 메서드 (changeRole) 만
// jest.fn() 으로 대체. 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildUserServiceMock(): {
  userService: UserService;
  serviceMock: { changeRole: jest.Mock };
} {
  const serviceMock = { changeRole: jest.fn() };
  return {
    userService: serviceMock as unknown as UserService,
    serviceMock,
  };
}

// Request stub — req.user 박제 (JwtStrategy.validate 가 박제한 payload mirror).
function buildReqWithUser(
  user: { sub: string; role?: string } | undefined,
): Request {
  return { user } as unknown as Request;
}

describe("UserController (unit)", () => {
  // -----------------------------------------------------------------------
  // happy — 3 종 role 값 (SuperAdmin / Admin / User) 모두 forwarding
  // -----------------------------------------------------------------------
  it("PATCH /api/users/:id/role — role='Admin' 시 service.changeRole(actor.sub, id, 'Admin') forward + row 반환 (happy)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const fixture = buildUserFixture({ id: "target-1", role: "Admin" });
    serviceMock.changeRole.mockResolvedValueOnce(fixture);

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor-super-1", role: "SuperAdmin" });
    const result = await controller.changeRole(
      "target-1",
      { role: "Admin" },
      req,
    );

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-super-1",
      "target-1",
      "Admin",
    );
    expect(serviceMock.changeRole).toHaveBeenCalledTimes(1);
    expect(result).toBe(fixture);
  });

  it("PATCH /api/users/:id/role — role='User' 시 service.changeRole 호출 (branch — User role)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockResolvedValueOnce(
      buildUserFixture({ id: "t-2", role: "User" }),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor-2", role: "SuperAdmin" });
    await controller.changeRole("t-2", { role: "User" }, req);

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-2",
      "t-2",
      "User",
    );
  });

  it("PATCH /api/users/:id/role — role='SuperAdmin' 시 service.changeRole 호출 (branch — SuperAdmin role)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockResolvedValueOnce(
      buildUserFixture({ id: "t-3", role: "SuperAdmin" }),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor-3", role: "SuperAdmin" });
    await controller.changeRole("t-3", { role: "SuperAdmin" }, req);

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-3",
      "t-3",
      "SuperAdmin",
    );
  });

  // -----------------------------------------------------------------------
  // negative — req.user.sub propagation 정합 검증
  // -----------------------------------------------------------------------
  it("PATCH /api/users/:id/role — req.user.sub 가 service.changeRole 의 첫 인자로 정확히 전달 (negative — actor id propagation)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockResolvedValueOnce(buildUserFixture());

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "uniq-actor-123", role: "SuperAdmin" });
    await controller.changeRole("target-x", { role: "Admin" }, req);

    // jest.fn.mock.calls[0][0] === expected sub
    expect(serviceMock.changeRole.mock.calls[0][0]).toBe("uniq-actor-123");
    expect(serviceMock.changeRole.mock.calls[0][1]).toBe("target-x");
    expect(serviceMock.changeRole.mock.calls[0][2]).toBe("Admin");
  });

  it("PATCH /api/users/:id/role — :id 가 임의 문자열도 service 로 forward (branch — route param)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockResolvedValueOnce(buildUserFixture());

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor-x", role: "SuperAdmin" });
    await controller.changeRole("any-id-shape", { role: "User" }, req);

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-x",
      "any-id-shape",
      "User",
    );
  });

  // -----------------------------------------------------------------------
  // error path — service throw propagation (NestJS HTTP mapping 의 근거)
  // -----------------------------------------------------------------------
  it("PATCH /api/users/:id/role — service 의 UnauthorizedException 그대로 propagate (error — actor 부재)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new UnauthorizedException("actor not found"),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "ghost", role: "SuperAdmin" });
    await expect(
      controller.changeRole("t", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("PATCH /api/users/:id/role — service 의 ForbiddenException ('only SuperAdmin') propagate (error — invariant 1)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("only SuperAdmin can change user role"),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor", role: "SuperAdmin" });
    await expect(
      controller.changeRole("t", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("PATCH /api/users/:id/role — service 의 ForbiddenException ('self-demote') propagate (error — invariant 4)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("self-demote is not allowed"),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "self", role: "SuperAdmin" });
    await expect(
      controller.changeRole("self", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("PATCH /api/users/:id/role — service 의 NotFoundException (target 부재) propagate (error — invariant 3)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new NotFoundException("user not found: missing"),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor", role: "SuperAdmin" });
    await expect(
      controller.changeRole("missing", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("PATCH /api/users/:id/role — service 의 BadRequestException (invariant 2 — DTO 우회) propagate (error)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new BadRequestException("invalid role: Owner"),
    );

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor", role: "SuperAdmin" });
    await expect(
      controller.changeRole("t", { role: "Owner" }, req),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("PATCH /api/users/:id/role — service 의 raw Error (HttpException 아님) 그대로 propagate (negative — unknown error)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.changeRole.mockRejectedValueOnce(rawError);

    const controller = new UserController(userService);
    const req = buildReqWithUser({ sub: "actor", role: "SuperAdmin" });
    // unit-level 은 raw Error 그대로 propagate — NestJS 500 변환은 e2e/integration 차원.
    await expect(
      controller.changeRole("t", { role: "Admin" }, req),
    ).rejects.toBe(rawError);
  });
});

// -----------------------------------------------------------------------
// Integration — ValidationPipe + Guard override negative cases.
// supertest 로 실제 HTTP 응답 status 검증. UserService 는 mocked (DB 미연결).
// JwtAuthGuard / RolesGuard 는 overrideGuard 로 통과/거부 분기 박제 (실 verify
// 는 본 system 의 별도 spec 책임).
// -----------------------------------------------------------------------
describe("UserController (ValidationPipe + Guard integration)", () => {
  let app: INestApplication;
  let serviceMock: { changeRole: jest.Mock };

  // Guard mock — req.user 박제 + canActivate 통과.
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
    serviceMock = { changeRole: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: serviceMock }],
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

  // ---- happy / sanity ---------------------------------------------------
  it("정상 payload + 정상 token 시 200 + service.changeRole 호출 (sanity)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor-1", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.changeRole.mockResolvedValueOnce(
      buildUserFixture({ id: "t-1", role: "Admin" }),
    );

    const res = await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin" })
      .expect(200);

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-1",
      "t-1",
      "Admin",
    );
    expect(res.body.id).toBe("t-1");
    expect(res.body.role).toBe("Admin");
  });

  // ---- ValidationPipe negative -----------------------------------------
  it("body 가 빈 객체 시 400 (negative #1: missing role)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({})
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role 이 number 시 400 (negative #2: wrong type)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: 123 })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role 이 빈 문자열 시 400 (negative #3: empty string)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: "" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role 이 'Owner' (enum 외) 시 400 (negative #4: invalid enum)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: "Owner" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role 이 'user' (소문자, enum 외) 시 400 (negative #5: case-sensitive)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: "user" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("정의되지 않은 필드 (`extra`) 포함 시 400 (negative #6: forbidNonWhitelisted)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: "Admin", extra: "foo" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  // ---- Guard rejection wire -------------------------------------------
  it("JwtAuthGuard rejection 시 403 (negative — 인증 실패 자동 403 by NestJS guard contract)", async () => {
    // canActivate=false 반환 시 NestJS 가 ForbiddenException 변환 (default).
    app = await buildApp({
      jwt: { canActivate: () => false },
      roles: ALLOW_ALL_ROLES,
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: "Admin" })
      .expect(403);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("RolesGuard rejection 시 403 (negative — 권한 부족)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "User"),
      roles: { canActivate: () => false },
    });

    await request(app.getHttpServer())
      .patch("/api/users/t/role")
      .send({ role: "Admin" })
      .expect(403);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  // ---- service throw → HTTP status 자동 매핑 ---------------------------
  it("service NotFoundException 시 404 자동 매핑 (error path)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("actor", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.changeRole.mockRejectedValueOnce(
      new NotFoundException("user not found: missing"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/missing/role")
      .send({ role: "Admin" })
      .expect(404);
  });

  it("service ForbiddenException 시 403 자동 매핑 (error path — self-demote)", async () => {
    app = await buildApp({
      jwt: makeAllowingJwtGuard("self", "SuperAdmin"),
      roles: ALLOW_ALL_ROLES,
    });
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("self-demote is not allowed"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/self/role")
      .send({ role: "Admin" })
      .expect(403);
  });
});
