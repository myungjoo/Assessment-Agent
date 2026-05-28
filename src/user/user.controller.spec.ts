// UserController spec — T-0087 acceptance §D 박제 (R-112 4 카테고리 cover: happy /
// error / branch / negative + negative cases 충분 cover, branch 마다 1+ test).
//
// 본 spec 은 UserService 를 jest mock 으로 대체 + JwtAuthGuard / RolesGuard 를
// overrideGuard 로 우회. guard 의 실 verify path 는 각각의 spec (roles.guard.spec /
// jwt.strategy.spec) 책임 — 본 spec 은 controller 단일 책임 (routing + service forward
// + DTO ValidationPipe negative + service throw propagation) 만 cover.
//
// 본 spec 은 두 부분으로 구성 (group.controller.spec / part.controller.spec 정공법 정합):
//   1. Unit-level (controller-only with mocked UserService) — routing / service 호출
//      인자 / req.user.sub propagate / service exception propagation 검증.
//   2. Integration-level (createNestApplication + ValidationPipe controller-scope +
//      overrideGuard + supertest) — DTO decorator 위반 negative case 의 HTTP 응답
//      status 검증 + service throw → HTTP status 자동 변환 검증.
//
// PrismaService 는 import path 가 등장하지 않으나 본 spec 의 어떤 의존성 chain (직접
// import 0) 도 PrismaService 까지 도달하지 않음 — UserService mock 으로 cut.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type INestApplication,
} from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { User } from "@prisma/client";
import request from "supertest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";

import { UserController } from "./user.controller";
import { UserService } from "./user.service";

// User fixture — schema.prisma 의 6 컬럼 (id / email / hashedPassword / role /
// createdAt / updatedAt) default 채움. user.service.spec.ts 의 helper 1:1 mirror.
function buildUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: "target-default",
    email: "target@example.com",
    hashedPassword: "$argon2id$v=19$m=65536,t=3,p=4$mock-hash",
    role: "User",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// UserService mock factory — changeRole 만 jest.fn() 으로 cover (본 controller 가
// 호출하는 단일 메서드). 각 test 마다 새 mock 생성 (호출 카운터 격리).
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

describe("UserController (unit)", () => {
  // -----------------------------------------------------------------------
  // happy — req.user.sub propagation + role 변종 3 종 (SuperAdmin / Admin / User)
  // -----------------------------------------------------------------------
  it("PATCH /api/users/:id/role — req.user.sub 를 service.changeRole 첫 인자로 forward (happy + actor id propagation)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const fixture = buildUserFixture({ id: "target-1", role: "Admin" });
    serviceMock.changeRole.mockResolvedValueOnce(fixture);

    const controller = new UserController(userService);
    // req.user — JwtStrategy.validate 가 박제한 sub + role payload 의 mock.
    const req = {
      user: { sub: "actor-super-id", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    const result = await controller.changeRole(
      "target-1",
      { role: "Admin" },
      req,
    );

    // service.changeRole 호출 인자 1:1 검증 — (actorUserId, targetUserId, newRole).
    expect(serviceMock.changeRole).toHaveBeenCalledTimes(1);
    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-super-id",
      "target-1",
      "Admin",
    );
    // mock.calls[0][0] 가 정확히 sub 임을 박제 — req.user 의 다른 필드 (role)
    // 가 actorUserId 자리로 넘어가지 않음을 검증.
    expect(serviceMock.changeRole.mock.calls[0][0]).toBe("actor-super-id");
    // service return 그대로 controller 가 propagate.
    expect(result).toBe(fixture);
  });

  it("PATCH /api/users/:id/role — newRole=Admin 으로 변경 (happy — role 변종 1)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const fixture = buildUserFixture({ id: "t-admin", role: "Admin" });
    serviceMock.changeRole.mockResolvedValueOnce(fixture);

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-1", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    const result = await controller.changeRole(
      "t-admin",
      { role: "Admin" },
      req,
    );

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-1",
      "t-admin",
      "Admin",
    );
    expect(result.role).toBe("Admin");
  });

  it("PATCH /api/users/:id/role — newRole=User 으로 변경 (happy — role 변종 2)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const fixture = buildUserFixture({ id: "t-user", role: "User" });
    serviceMock.changeRole.mockResolvedValueOnce(fixture);

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-2", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await controller.changeRole("t-user", { role: "User" }, req);

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-2",
      "t-user",
      "User",
    );
  });

  it("PATCH /api/users/:id/role — newRole=SuperAdmin 으로 변경 (happy — role 변종 3)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const fixture = buildUserFixture({ id: "t-super", role: "SuperAdmin" });
    serviceMock.changeRole.mockResolvedValueOnce(fixture);

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-3", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await controller.changeRole("t-super", { role: "SuperAdmin" }, req);

    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-3",
      "t-super",
      "SuperAdmin",
    );
  });

  // -----------------------------------------------------------------------
  // error path — service throw propagation (UserService 의 5 invariant 매핑)
  // -----------------------------------------------------------------------
  it("PATCH /api/users/:id/role — service UnauthorizedException 그대로 propagate (error — actor 부재)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new UnauthorizedException("actor not found"),
    );

    const controller = new UserController(userService);
    const req = {
      user: { sub: "ghost-actor", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("target-x", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("PATCH /api/users/:id/role — service ForbiddenException (only SuperAdmin) propagate (error — invariant 1)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("only SuperAdmin can change user role"),
    );

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-admin", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("target-x", { role: "User" }, req),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("PATCH /api/users/:id/role — service ForbiddenException (self-demote) propagate (error — invariant 4)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("self-demote is not allowed"),
    );

    const controller = new UserController(userService);
    const req = {
      user: { sub: "self-actor", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("self-actor", { role: "Admin" }, req),
    ).rejects.toThrow(/self-demote is not allowed/);
  });

  it("PATCH /api/users/:id/role — service NotFoundException propagate (error — invariant 3 / 5)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new NotFoundException("user not found: missing"),
    );

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-1", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("missing", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("PATCH /api/users/:id/role — service BadRequestException propagate (error — invariant 2 race window)", async () => {
    // DTO ValidationPipe 가 정상 enum 값 통과시킨 후 service 가 추가 invariant 2 로
    // BadRequestException throw 하는 race window (DTO ↔ service 의 enum 분리 박제).
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new BadRequestException("invalid role: SomethingElse"),
    );

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-1", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("target-x", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("PATCH /api/users/:id/role — service raw Error 도 그대로 propagate (negative — unknown error, NestJS 500 변환은 e2e 차원)", async () => {
    const { userService, serviceMock } = buildUserServiceMock();
    const rawError = new Error("unexpected DB outage");
    serviceMock.changeRole.mockRejectedValueOnce(rawError);

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-1", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("target-x", { role: "Admin" }, req),
    ).rejects.toBe(rawError);
  });

  // -----------------------------------------------------------------------
  // negative — req.user 의 변종 (type narrowing 분기)
  // -----------------------------------------------------------------------
  it("PATCH /api/users/:id/role — req.user.sub 가 빈 string 일 때 service 호출 + service UnauthorizedException propagate (negative — invariant 1)", async () => {
    // 실 path 는 JwtStrategy.validate 가 sub 부재를 차단 + JwtAuthGuard 미통과 시
    // controller 진입 0 — 단 service 의 invariant 1 (actor lookup) 이 빈 sub 로
    // findById 호출 → null 반환 → UnauthorizedException 발화 박제.
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockRejectedValueOnce(
      new UnauthorizedException("actor not found"),
    );

    const controller = new UserController(userService);
    const req = {
      user: { sub: "", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await expect(
      controller.changeRole("target-x", { role: "Admin" }, req),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // 빈 sub 가 service 의 첫 인자로 그대로 forward — service-layer 가 차단 책임.
    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "",
      "target-x",
      "Admin",
    );
  });

  it("PATCH /api/users/:id/role — :id 빈 string 도 service.changeRole 로 forward (negative — controller 는 id 검증 책임 0)", async () => {
    // group.controller.spec L304-314 정공법 정합 — controller 는 id 의 빈 string
    // 검증 안 함. service / Prisma 의 P2025 분기 책임.
    const { userService, serviceMock } = buildUserServiceMock();
    serviceMock.changeRole.mockResolvedValueOnce(buildUserFixture({ id: "" }));

    const controller = new UserController(userService);
    const req = {
      user: { sub: "actor-1", role: "SuperAdmin" },
    } as unknown as Parameters<typeof controller.changeRole>[2];

    await controller.changeRole("", { role: "Admin" }, req);

    expect(serviceMock.changeRole).toHaveBeenCalledWith("actor-1", "", "Admin");
  });
});

// -----------------------------------------------------------------------
// Integration — controller-scope @UsePipes (ValidationPipe) + overrideGuard +
// supertest. R-112 "negative cases 충분 cover" — ChangeRoleDto 의 6 reject branch
// + service throw → HTTP status 자동 변환 검증.
//
// JwtAuthGuard + RolesGuard 를 항상 통과시키는 stub 으로 override — RolesGuard 가
// req.user 를 검사하지 않도록 (실 verify path 는 각각 spec 책임). req.user 는
// supertest 직접 cookie 발행 없이 stub 으로 박제 — JwtAuthGuard override 시점에
// canActivate 안에서 request.user = mockSubject 박제.
// -----------------------------------------------------------------------
describe("UserController (ValidationPipe + Guard integration)", () => {
  let app: INestApplication;
  let serviceMock: { changeRole: jest.Mock };

  // JwtAuthGuard override — canActivate true + request.user 박제 (실 JwtStrategy
  // validate path 우회). SuperAdmin role 박제 — RolesGuard override 와 별개로
  // controller 의 actor sub propagate 검증 시 sub 일관성 보장.
  const mockJwtAuthGuard = {
    canActivate: (context: {
      switchToHttp: () => { getRequest: () => { user?: object } };
    }) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: "actor-integration", role: "SuperAdmin" };
      return true;
    },
  };

  // RolesGuard override — 항상 true (escalation 검증 우회).
  const mockRolesGuard = { canActivate: () => true };

  beforeEach(async () => {
    serviceMock = { changeRole: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: serviceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // ----- Happy reference — 정상 payload 통과 → 200 + service.changeRole 호출 -----

  it("정상 payload (role=Admin) 는 ValidationPipe 통과 후 200 (sanity)", async () => {
    serviceMock.changeRole.mockResolvedValueOnce(
      buildUserFixture({ id: "t-1", role: "Admin" }),
    );

    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin" })
      .expect(200);

    expect(serviceMock.changeRole).toHaveBeenCalledTimes(1);
    expect(serviceMock.changeRole).toHaveBeenCalledWith(
      "actor-integration",
      "t-1",
      "Admin",
    );
  });

  // ----- ValidationPipe negative — ChangeRoleDto 6 reject branch -----

  it("role 누락 (빈 {}) 시 400 (negative #1: missing required)", async () => {
    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({})
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role 이 number 시 400 (negative #2: wrong type)", async () => {
    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: 123 })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role 이 빈 문자열 시 400 (negative #3: @IsNotEmpty)", async () => {
    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role='Owner' (enum 외) 시 400 (negative #4: @IsIn)", async () => {
    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Owner" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("role='user' (소문자, enum 외) 시 400 (negative #5: case sensitivity)", async () => {
    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "user" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  it("추가 필드 포함 시 400 (negative #6: forbidNonWhitelisted)", async () => {
    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin", extra: "foo" })
      .expect(400);

    expect(serviceMock.changeRole).not.toHaveBeenCalled();
  });

  // ----- service throw → HTTP status 자동 변환 검증 (R-112 4 카테고리 cover) -----

  it("service UnauthorizedException → 401 (error path — invariant 1)", async () => {
    serviceMock.changeRole.mockRejectedValueOnce(
      new UnauthorizedException("actor not found"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin" })
      .expect(401);
  });

  it("service ForbiddenException (only SuperAdmin) → 403 (error path — invariant 1)", async () => {
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("only SuperAdmin can change user role"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin" })
      .expect(403);
  });

  it("service ForbiddenException (self-demote) → 403 (error path — invariant 4)", async () => {
    serviceMock.changeRole.mockRejectedValueOnce(
      new ForbiddenException("self-demote is not allowed"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin" })
      .expect(403);
  });

  it("service NotFoundException → 404 (error path — invariant 3 / 5)", async () => {
    serviceMock.changeRole.mockRejectedValueOnce(
      new NotFoundException("user not found: missing"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/missing/role")
      .send({ role: "Admin" })
      .expect(404);
  });

  it("service BadRequestException → 400 (error path — invariant 2 race window)", async () => {
    serviceMock.changeRole.mockRejectedValueOnce(
      new BadRequestException("invalid role: SomethingElse"),
    );

    await request(app.getHttpServer())
      .patch("/api/users/t-1/role")
      .send({ role: "Admin" })
      .expect(400);
  });
});
