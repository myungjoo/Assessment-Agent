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
  ConflictException,
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

import { UserResponseDto } from "./dto/user-response.dto";
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

// UserService mock factory — controller 가 사용하는 2 메서드 (changeRole / signup)
// 를 jest.fn() 으로 대체. 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildUserServiceMock(): {
  userService: UserService;
  serviceMock: {
    changeRole: jest.Mock;
    signup: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
  };
} {
  const serviceMock = {
    changeRole: jest.fn(),
    signup: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };
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
    // T-0095 — controller 가 UserResponseDto 로 wrap → entity reference 동일성 비교
    // 0, 5 필드 정합 비교 + UserResponseDto instance 확인 + hashedPassword 부재.
    expect(result).toBeInstanceOf(UserResponseDto);
    expect(result.id).toBe(fixture.id);
    expect(result.email).toBe(fixture.email);
    expect(result.role).toBe(fixture.role);
    expect(result.createdAt).toEqual(fixture.createdAt);
    expect(result.updatedAt).toEqual(fixture.updatedAt);
    expect(result).not.toHaveProperty("hashedPassword");
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

  // -----------------------------------------------------------------------
  // POST signup — T-0092 acceptance §G (R-112 4 카테고리). REQ-044 후반 박제.
  //   - happy: dto.email + dto.password 를 service.signup 인자로 forward + 반환.
  //   - branch: dto 인자 propagation 검증.
  //   - error: ConflictException / BadRequestException / 그 외 raw propagate.
  // -----------------------------------------------------------------------
  describe("POST signup (unit)", () => {
    it("POST /api/users — dto 의 email + password 를 service.signup 인자로 forward + 결과 반환 (happy)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const created = buildUserFixture({
        id: "new-user",
        email: "a@b.c",
        role: "SuperAdmin",
      });
      serviceMock.signup.mockResolvedValueOnce(created);

      const controller = new UserController(userService);
      const result = await controller.signup({
        email: "a@b.c",
        password: "securepass",
      });

      expect(serviceMock.signup).toHaveBeenCalledWith("a@b.c", "securepass");
      expect(serviceMock.signup).toHaveBeenCalledTimes(1);
      // T-0095 — controller 가 UserResponseDto 로 wrap → entity reference 동일성
      // 비교 0, 5 필드 정합 비교 + UserResponseDto instance 확인.
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe(created.id);
      expect(result.email).toBe(created.email);
      expect(result.role).toBe(created.role);
      expect(result).not.toHaveProperty("hashedPassword");
    });

    it("POST /api/users — dto.email + dto.password 의 인자 순서 정합 (branch — propagation 정합)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.signup.mockResolvedValueOnce(buildUserFixture());

      const controller = new UserController(userService);
      await controller.signup({
        email: "second@example.com",
        password: "anotherpass",
      });

      // .mock.calls inspection — email 가 첫 인자, password 가 두 번째 인자.
      expect(serviceMock.signup.mock.calls[0][0]).toBe("second@example.com");
      expect(serviceMock.signup.mock.calls[0][1]).toBe("anotherpass");
    });

    it("POST /api/users — service 의 ConflictException 그대로 propagate (error — email 중복)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.signup.mockRejectedValueOnce(
        new ConflictException("email already exists: dup@example.com"),
      );

      const controller = new UserController(userService);
      await expect(
        controller.signup({ email: "dup@example.com", password: "plain" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("POST /api/users — service 의 BadRequestException 그대로 propagate (error — DTO 우회 path)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.signup.mockRejectedValueOnce(
        new BadRequestException("invalid signup payload"),
      );

      const controller = new UserController(userService);
      await expect(
        controller.signup({ email: "a@b.c", password: "plain" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("POST /api/users — service 의 raw Error 그대로 propagate (negative — unknown error)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const rawError = new Error("unexpected outage");
      serviceMock.signup.mockRejectedValueOnce(rawError);

      const controller = new UserController(userService);
      await expect(
        controller.signup({ email: "a@b.c", password: "plain" }),
      ).rejects.toBe(rawError);
    });
  });

  // -----------------------------------------------------------------------
  // T-0095 — UserResponseDto 매핑 검증 (signup / changeRole 양쪽).
  //   - happy: 응답이 UserResponseDto instance + 5 필드 정합.
  //   - negative: 응답 body 에 hashedPassword 키 부재 (보안 risk regression guard).
  // -----------------------------------------------------------------------
  describe("UserResponseDto 매핑 (T-0095 보안 risk fix)", () => {
    it("happy — signup 응답이 UserResponseDto instance + 5 필드 정합", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const created = buildUserFixture({
        id: "new-1",
        email: "new@example.com",
        role: "SuperAdmin",
      });
      serviceMock.signup.mockResolvedValueOnce(created);

      const controller = new UserController(userService);
      const result = await controller.signup({
        email: "new@example.com",
        password: "securepass",
      });

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe("new-1");
      expect(result.email).toBe("new@example.com");
      expect(result.role).toBe("SuperAdmin");
      expect(result.createdAt).toEqual(created.createdAt);
      expect(result.updatedAt).toEqual(created.updatedAt);
    });

    it("happy — changeRole 응답이 UserResponseDto instance + 5 필드 정합", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const updated = buildUserFixture({
        id: "t-95",
        email: "target@example.com",
        role: "Admin",
      });
      serviceMock.changeRole.mockResolvedValueOnce(updated);

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "actor-95", role: "SuperAdmin" });
      const result = await controller.changeRole(
        "t-95",
        { role: "Admin" },
        req,
      );

      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe("t-95");
      expect(result.email).toBe("target@example.com");
      expect(result.role).toBe("Admin");
      expect(result.createdAt).toEqual(updated.createdAt);
      expect(result.updatedAt).toEqual(updated.updatedAt);
    });

    it("negative — signup 응답에 hashedPassword 키 부재 (보안 regression guard)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.signup.mockResolvedValueOnce(
        buildUserFixture({
          hashedPassword: "$2b$10$LEAKED.HASH.SHOULD.NOT.APPEAR",
        }),
      );

      const controller = new UserController(userService);
      const result = await controller.signup({
        email: "a@b.c",
        password: "securepass",
      });

      expect(result).not.toHaveProperty("hashedPassword");
      expect(Object.keys(result).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
    });

    it("negative — changeRole 응답에 hashedPassword 키 부재 (보안 regression guard)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.changeRole.mockResolvedValueOnce(
        buildUserFixture({
          hashedPassword: "$2b$10$LEAKED.HASH.SHOULD.NOT.APPEAR",
        }),
      );

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "actor", role: "SuperAdmin" });
      const result = await controller.changeRole("t", { role: "User" }, req);

      expect(result).not.toHaveProperty("hashedPassword");
      expect(Object.keys(result).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
    });

    it("negative — signup 응답이 JSON 직렬화 후에도 hashedPassword 부재 (직렬화 path)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.signup.mockResolvedValueOnce(
        buildUserFixture({
          hashedPassword: "$2b$10$ANOTHER.LEAKED.HASH",
        }),
      );

      const controller = new UserController(userService);
      const result = await controller.signup({
        email: "a@b.c",
        password: "securepass",
      });
      const serialized = JSON.parse(JSON.stringify(result));

      // HTTP 직렬화 path 의 정합 — Express 가 JSON.stringify 로 응답 직렬화 시
      // hashedPassword 가 누출되지 않는지 끝-단 검증.
      expect(serialized).not.toHaveProperty("hashedPassword");
    });
  });

  // -------------------------------------------------------------------------
  // GET list — T-0099 acceptance §H (R-112 4 카테고리). Admin+ tier 박제.
  //   - happy: list 응답이 UserResponseDto[] 배열 + 5 필드 정합 + 빈 list 분기.
  //   - branch: 다중 role mix (SuperAdmin / Admin / User) 모두 변환.
  //   - negative: hashedPassword 누출 차단 (regression) + service throw raw propagate.
  // -------------------------------------------------------------------------
  describe("GET list (unit) — T-0099", () => {
    it("happy — service.findAll 의 3 user 배열 → controller.list 결과가 3 DTO 배열 + 각 5 필드 정합", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const users = [
        buildUserFixture({
          id: "u-1",
          email: "a@e.test",
          role: "SuperAdmin",
        }),
        buildUserFixture({ id: "u-2", email: "b@e.test", role: "Admin" }),
        buildUserFixture({ id: "u-3", email: "c@e.test", role: "User" }),
      ];
      serviceMock.findAll.mockResolvedValueOnce(users);

      const controller = new UserController(userService);
      const result = await controller.list();

      expect(serviceMock.findAll).toHaveBeenCalledTimes(1);
      expect(serviceMock.findAll).toHaveBeenCalledWith();
      expect(result).toHaveLength(3);
      // 각 DTO 의 5 필드 정합 검증.
      expect(result[0].id).toBe("u-1");
      expect(result[0].email).toBe("a@e.test");
      expect(result[0].role).toBe("SuperAdmin");
      expect(result[1].id).toBe("u-2");
      expect(result[1].email).toBe("b@e.test");
      expect(result[2].id).toBe("u-3");
      expect(result[2].role).toBe("User");
      // 각 DTO 의 createdAt / updatedAt 보존.
      for (let i = 0; i < users.length; i += 1) {
        expect(result[i].createdAt).toEqual(users[i].createdAt);
        expect(result[i].updatedAt).toEqual(users[i].updatedAt);
        // 핵심 보호 — hashedPassword 키 부재.
        expect(result[i]).not.toHaveProperty("hashedPassword");
      }
    });

    it("happy — 빈 list 분기 (service.findAll [] → controller.list [])", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.findAll.mockResolvedValueOnce([]);

      const controller = new UserController(userService);
      const result = await controller.list();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it("negative — 3 user 모두 hashedPassword 박제 시 결과 DTO 모두 hashedPassword 키 부재 (regression — 핵심 보호)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const users = [
        buildUserFixture({
          id: "u-1",
          hashedPassword: "$2b$10$LEAKED.HASH.ONE",
        }),
        buildUserFixture({
          id: "u-2",
          hashedPassword: "$2b$10$LEAKED.HASH.TWO",
        }),
        buildUserFixture({
          id: "u-3",
          hashedPassword: "$2b$10$LEAKED.HASH.THREE",
        }),
      ];
      serviceMock.findAll.mockResolvedValueOnce(users);

      const controller = new UserController(userService);
      const result = await controller.list();

      expect(result).toHaveLength(3);
      for (const dto of result) {
        expect(dto).not.toHaveProperty("hashedPassword");
        // 정확히 5 필드만 — fromEntities 의 whitelist 정합 propagate.
        expect(Object.keys(dto).sort()).toEqual(
          ["createdAt", "email", "id", "role", "updatedAt"].sort(),
        );
      }
    });

    it("negative — 결과 element 가 UserResponseDto instance + 임의 추가 컬럼 (extraField) 부재", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const userWithExtra = {
        ...buildUserFixture({ id: "u-instance" }),
        extraField: "should-not-leak",
      };
      serviceMock.findAll.mockResolvedValueOnce([userWithExtra]);

      const controller = new UserController(userService);
      const result = await controller.list();

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(UserResponseDto);
      expect(result[0]).not.toHaveProperty("extraField");
    });

    it("branch — 다중 role mix (SuperAdmin / Admin / User) 모두 변환 + 각 DTO 의 role 필드 정합", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const users = [
        buildUserFixture({ id: "u-sa", role: "SuperAdmin" }),
        buildUserFixture({ id: "u-ad", role: "Admin" }),
        buildUserFixture({ id: "u-us", role: "User" }),
      ];
      serviceMock.findAll.mockResolvedValueOnce(users);

      const controller = new UserController(userService);
      const result = await controller.list();

      expect(result[0].role).toBe("SuperAdmin");
      expect(result[1].role).toBe("Admin");
      expect(result[2].role).toBe("User");
      // controller 는 list 변환만 — RBAC 검증은 Guard layer 책임 (본 spec scope 외).
    });

    it("negative — service.findAll throw → controller.list 가 동일 error 그대로 propagate (catch 0)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const svcError = new Error("svc down");
      serviceMock.findAll.mockRejectedValueOnce(svcError);

      const controller = new UserController(userService);
      await expect(controller.list()).rejects.toBe(svcError);
    });
  });

  // -------------------------------------------------------------------------
  // GET detail — T-0101 acceptance §D (R-112 4 카테고리). RBAC 첫 conditional
  // branch 박제 (self OR Admin+ OR).
  //   - happy: self / Admin / SuperAdmin / Admin-self 4 path 모두 200 + DTO 반환.
  //   - branch: isSelf vs isAdminPlus 두 분기 + 둘 다 false 시 403.
  //   - negative: User other-read 403 / hashedPassword 누출 차단 / not-found 404 /
  //               req.user undefined 시 graceful.
  // -------------------------------------------------------------------------
  describe("GET detail (unit) — T-0101", () => {
    // happy 1 — self detail (User role actor 가 본인 조회 성공).
    it("happy — User role actor 가 본인 조회 시 200 + DTO 반환 (self path)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const fixture = buildUserFixture({
        id: "user-self",
        email: "self@e.test",
        role: "User",
      });
      serviceMock.findById.mockResolvedValueOnce(fixture);

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "user-self", role: "User" });
      const result = await controller.detail("user-self", req);

      expect(serviceMock.findById).toHaveBeenCalledWith("user-self");
      expect(serviceMock.findById).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe("user-self");
      expect(result.email).toBe("self@e.test");
      expect(result.role).toBe("User");
      expect(result.createdAt).toEqual(fixture.createdAt);
      expect(result.updatedAt).toEqual(fixture.updatedAt);
      expect(result).not.toHaveProperty("hashedPassword");
    });

    // happy 2 — Admin actor 가 다른 user 조회 (Admin+ tier path).
    it("happy — Admin actor 가 다른 user 조회 시 200 + DTO 반환 (Admin+ path)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const fixture = buildUserFixture({
        id: "other-user",
        email: "other@e.test",
        role: "User",
      });
      serviceMock.findById.mockResolvedValueOnce(fixture);

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "admin-self", role: "Admin" });
      const result = await controller.detail("other-user", req);

      expect(serviceMock.findById).toHaveBeenCalledWith("other-user");
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.id).toBe("other-user");
      expect(result.email).toBe("other@e.test");
      expect(result).not.toHaveProperty("hashedPassword");
    });

    // happy 3 — SuperAdmin actor 가 다른 user 조회 (escalation 박제, Admin+ 분기 안).
    it("happy — SuperAdmin actor 가 다른 user 조회 시 200 (escalation 박제, Admin+ 분기 안)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const fixture = buildUserFixture({ id: "other-2", role: "Admin" });
      serviceMock.findById.mockResolvedValueOnce(fixture);

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "sa-self", role: "SuperAdmin" });
      const result = await controller.detail("other-2", req);

      expect(serviceMock.findById).toHaveBeenCalledWith("other-2");
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.role).toBe("Admin");
    });

    // happy 4 — Admin actor 가 본인 조회 (self 우선순위 분기 — isSelf=true, isAdminPlus
    // 평가 무관 통과).
    it("happy — Admin actor 가 본인 조회 시 200 (self 우선순위 분기 — isSelf=true)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const fixture = buildUserFixture({ id: "admin-self", role: "Admin" });
      serviceMock.findById.mockResolvedValueOnce(fixture);

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "admin-self", role: "Admin" });
      const result = await controller.detail("admin-self", req);

      expect(serviceMock.findById).toHaveBeenCalledWith("admin-self");
      expect(result.id).toBe("admin-self");
    });

    // negative 1 — User role actor 가 다른 user 조회 → 403 (분기 차단).
    it("negative — User role actor 가 다른 user 조회 시 ForbiddenException + service 호출 0 (분기 차단)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "user-self", role: "User" });
      await expect(controller.detail("other-user", req)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // 분기 차단 검증 — service.findById 호출 0 (불필요 DB 조회 회피).
      expect(serviceMock.findById).not.toHaveBeenCalled();
    });

    // negative 2 — detail 응답에 hashedPassword 키 부재 (regression — T-0095 mirror).
    it("negative — detail 응답에 hashedPassword 키 부재 (regression — T-0095 fromEntity whitelist)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.findById.mockResolvedValueOnce(
        buildUserFixture({
          id: "u-leak",
          hashedPassword: "$2b$10$LEAKED.HASH.SHOULD.NOT.APPEAR",
        }),
      );

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "u-leak", role: "User" });
      const result = await controller.detail("u-leak", req);

      expect(result).not.toHaveProperty("hashedPassword");
      expect(Object.keys(result).sort()).toEqual(
        ["createdAt", "email", "id", "role", "updatedAt"].sort(),
      );
    });

    // negative 3 — service NotFoundException → controller raw propagate (catch 0).
    it("negative — service NotFoundException 그대로 propagate (catch 0 — 404 자동 mapping)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      serviceMock.findById.mockRejectedValueOnce(
        new NotFoundException("User non-existent 가 존재하지 않습니다."),
      );

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "admin-self", role: "Admin" });
      await expect(
        controller.detail("non-existent", req),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // negative 4 — req.user undefined 시 graceful 처리 (TypeError 또는 ForbiddenException).
    // theoretical case — JwtAuthGuard 가 통상 401 차단하나 unit spec 의 mock 시점에
    // req.user undefined 분기 안전성 박제. cast 가 undefined 의 property access 시 throw.
    it("negative — req.user undefined 시 graceful 처리 (TypeError, 분기 안전성)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();

      const controller = new UserController(userService);
      // req.user 미박제 — JwtAuthGuard mock 의 통과 후 unit spec 의 theoretical case.
      const req = buildReqWithUser(undefined);
      // undefined.sub 의 property access 가 throw 발화 — 분기 안전성 박제.
      await expect(controller.detail("any-id", req)).rejects.toThrow();
      // 분기 차단 검증 — service.findById 호출 0.
      expect(serviceMock.findById).not.toHaveBeenCalled();
    });

    // negative 5 — service raw Error propagate (HTTP 500 mapping 의 unit 차원 박제).
    it("negative — service raw Error 그대로 propagate (catch 0)", async () => {
      const { userService, serviceMock } = buildUserServiceMock();
      const rawError = new Error("unexpected outage");
      serviceMock.findById.mockRejectedValueOnce(rawError);

      const controller = new UserController(userService);
      const req = buildReqWithUser({ sub: "admin-self", role: "Admin" });
      await expect(controller.detail("any-id", req)).rejects.toBe(rawError);
    });
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
    // T-0095 — HTTP 응답 body 에 hashedPassword 키 부재 (regression guard).
    expect(res.body).not.toHaveProperty("hashedPassword");
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
