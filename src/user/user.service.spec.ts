// UserService spec — T-0086 acceptance §D (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%). REQ-044 의 5 invariant
// 모두 cover + role 값 변종 3 종 + self-noop 허용 + P2025 propagate + generic
// error propagate.
//
// 본 spec 은 UserRepository 의 2 메서드 (findById / updateRole) 를 Jest mock
// 으로 대체하여 PostgreSQL container 없이 isolated 실행. GroupService spec
// 정공법 정합 — repository mock + buildPrismaError local helper.
//
// 검증 포인트 (REQ-044 의 5 invariant × 분기):
//   - invariant 1 (actor 권한) — actor 부재 → Unauthorized / actor role !==
//     SuperAdmin → Forbidden ("Admin" / "User" 2 변종).
//   - invariant 2 (newRole 값) — "SuperAdmin" / "Admin" / "User" 3 happy 변종 +
//     "Owner" / 빈 문자열 / "user" (소문자) 3 negative 변종 → BadRequest.
//   - invariant 3 (target lookup) — target 부재 → NotFound.
//   - invariant 4 (self-demote) — self + "Admin" → Forbidden / self + "User"
//     → Forbidden / self + "SuperAdmin" → noop 허용 (updateRole 호출).
//   - invariant 5 (race window) — updateRole 의 P2025 → NotFound 변환 / generic
//     Error → raw propagate.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";

import type { AuthService } from "../auth/auth.service";

import type { UserRepository } from "./user.repository";
import { UserService } from "./user.service";

// User fixture — schema.prisma 의 6 컬럼 (id / email / hashedPassword / role /
// createdAt / updatedAt) 모두 채운 default row. UserRepository.spec.ts 의 동일
// helper mirror.
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

// UserRepository mock factory — 본 service 가 사용하는 4 메서드 (findById /
// updateRole / countAll / create) 를 jest.fn() 으로 대체. 각 test 마다 새 mock
// 생성 (호출 카운터 격리).
function buildUserRepositoryMock(): {
  userRepository: UserRepository;
  userRepoMock: {
    findById: jest.Mock;
    updateRole: jest.Mock;
    countAll: jest.Mock;
    create: jest.Mock;
    findAll: jest.Mock;
  };
} {
  const userRepoMock = {
    findById: jest.fn(),
    updateRole: jest.fn(),
    countAll: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  };
  return {
    userRepository: userRepoMock as unknown as UserRepository,
    userRepoMock,
  };
}

// AuthService mock factory — UserService.signup 이 사용하는 1 메서드 (hashPassword)
// 만 jest.fn() 으로 대체.
function buildAuthServiceMock(): {
  authService: AuthService;
  authMock: { hashPassword: jest.Mock };
} {
  const authMock = { hashPassword: jest.fn() };
  return {
    authService: authMock as unknown as AuthService,
    authMock,
  };
}

// buildService — mock 을 일괄 생성하여 UserService 인스턴스를 조립.
function buildService(): {
  service: UserService;
  userRepoMock: ReturnType<typeof buildUserRepositoryMock>["userRepoMock"];
  authMock: ReturnType<typeof buildAuthServiceMock>["authMock"];
} {
  const { userRepository, userRepoMock } = buildUserRepositoryMock();
  const { authService, authMock } = buildAuthServiceMock();
  const service = new UserService(userRepository, authService);
  return { service, userRepoMock, authMock };
}

// Prisma known error helper — GroupService / PartService / PersonService spec 의
// 동일 duck typing 패턴. `code` field 의 매칭용.
function buildPrismaError(code: string, message = "prisma-error"): Error {
  return Object.assign(new Error(message), { code });
}

// actor / target fixture 빠른 생성 helper — actor 는 SuperAdmin role 기본,
// target 은 User role 기본. id override 로 self/other 구분.
function buildSuperAdminActor(id = "actor-super"): User {
  return buildUserFixture({
    id,
    role: "SuperAdmin",
    email: `${id}@example.com`,
  });
}

function buildTargetUser(id = "target-user", role = "User"): User {
  return buildUserFixture({ id, role, email: `${id}@example.com` });
}

describe("UserService", () => {
  describe("changeRole()", () => {
    // -----------------------------------------------------------------------
    // happy path — SuperAdmin actor 가 다른 user 의 role 변경 (1+)
    // -----------------------------------------------------------------------
    it("SuperAdmin actor 가 다른 user 의 role 을 변경 시 UserRepository.updateRole 호출 + 결과 반환 (happy)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-1");
      const target = buildTargetUser("target-1", "User");
      const updated = buildUserFixture({
        id: "target-1",
        role: "Admin",
        email: "target-1@example.com",
      });
      userRepoMock.findById
        .mockResolvedValueOnce(actor) // actor lookup
        .mockResolvedValueOnce(target); // target lookup
      userRepoMock.updateRole.mockResolvedValueOnce(updated);

      const result = await service.changeRole("actor-1", "target-1", "Admin");

      expect(userRepoMock.findById).toHaveBeenNthCalledWith(1, "actor-1");
      expect(userRepoMock.findById).toHaveBeenNthCalledWith(2, "target-1");
      expect(userRepoMock.updateRole).toHaveBeenCalledWith("target-1", "Admin");
      expect(result).toBe(updated);
    });

    // -----------------------------------------------------------------------
    // branch — newRole 값 변종 3 종 (SuperAdmin / Admin / User) happy forwarding
    // -----------------------------------------------------------------------
    it("newRole=SuperAdmin 으로 변경 시 updateRole 에 'SuperAdmin' forward (branch — role 변종 1)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-2");
      const target = buildTargetUser("target-2", "Admin");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockResolvedValueOnce(
        buildUserFixture({ id: "target-2", role: "SuperAdmin" }),
      );

      await service.changeRole("actor-2", "target-2", "SuperAdmin");

      expect(userRepoMock.updateRole).toHaveBeenCalledWith(
        "target-2",
        "SuperAdmin",
      );
    });

    it("newRole=Admin 으로 변경 시 updateRole 에 'Admin' forward (branch — role 변종 2)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-3");
      const target = buildTargetUser("target-3", "User");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockResolvedValueOnce(
        buildUserFixture({ id: "target-3", role: "Admin" }),
      );

      await service.changeRole("actor-3", "target-3", "Admin");

      expect(userRepoMock.updateRole).toHaveBeenCalledWith("target-3", "Admin");
    });

    it("newRole=User 으로 변경 시 updateRole 에 'User' forward (branch — role 변종 3)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-4");
      const target = buildTargetUser("target-4", "Admin");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockResolvedValueOnce(
        buildUserFixture({ id: "target-4", role: "User" }),
      );

      await service.changeRole("actor-4", "target-4", "User");

      expect(userRepoMock.updateRole).toHaveBeenCalledWith("target-4", "User");
    });

    // -----------------------------------------------------------------------
    // invariant 1 — actor 권한 검증
    // -----------------------------------------------------------------------
    it("actor 부재 시 UnauthorizedException 발화 (invariant 1 — actor null)", async () => {
      const { service, userRepoMock } = buildService();
      userRepoMock.findById.mockResolvedValueOnce(null);

      await expect(
        service.changeRole("ghost-actor", "target", "Admin"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(userRepoMock.updateRole).not.toHaveBeenCalled();
    });

    it("actor role='Admin' 시 ForbiddenException 발화 — only SuperAdmin 박제 (invariant 1 — Admin actor)", async () => {
      const { service, userRepoMock } = buildService();
      const adminActor = buildUserFixture({ id: "actor-admin", role: "Admin" });
      userRepoMock.findById.mockResolvedValueOnce(adminActor);

      await expect(
        service.changeRole("actor-admin", "target", "User"),
      ).rejects.toThrow(/only SuperAdmin can change user role/);
      expect(userRepoMock.updateRole).not.toHaveBeenCalled();
    });

    it("actor role='User' 시 ForbiddenException 발화 (invariant 1 — User actor)", async () => {
      const { service, userRepoMock } = buildService();
      const userActor = buildUserFixture({ id: "actor-user", role: "User" });
      userRepoMock.findById.mockResolvedValueOnce(userActor);

      await expect(
        service.changeRole("actor-user", "target", "Admin"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // -----------------------------------------------------------------------
    // invariant 2 — newRole 값 검증 (negative 3 변종)
    // -----------------------------------------------------------------------
    it("newRole='Owner' (unknown role) → BadRequestException (invariant 2 — negative)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-5");
      userRepoMock.findById.mockResolvedValueOnce(actor);

      await expect(
        service.changeRole("actor-5", "target", "Owner"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepoMock.updateRole).not.toHaveBeenCalled();
    });

    it("newRole='' (빈 문자열) → BadRequestException (invariant 2 — negative empty)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-6");
      userRepoMock.findById.mockResolvedValueOnce(actor);

      await expect(service.changeRole("actor-6", "target", "")).rejects.toThrow(
        /invalid role:/,
      );
    });

    it("newRole='user' (소문자) → BadRequestException (invariant 2 — negative case sensitivity)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-7");
      userRepoMock.findById.mockResolvedValueOnce(actor);

      await expect(
        service.changeRole("actor-7", "target", "user"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // -----------------------------------------------------------------------
    // invariant 3 — target user lookup
    // -----------------------------------------------------------------------
    it("target user 부재 시 NotFoundException 발화 (invariant 3 — target null)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-8");
      userRepoMock.findById
        .mockResolvedValueOnce(actor) // actor OK
        .mockResolvedValueOnce(null); // target missing

      await expect(
        service.changeRole("actor-8", "ghost-target", "Admin"),
      ).rejects.toThrow(/user not found: ghost-target/);
      expect(userRepoMock.updateRole).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // invariant 4 — self-demote 차단 (negative 2 분기 + self-noop 허용)
    // -----------------------------------------------------------------------
    it("self + newRole='Admin' (self-demote) → ForbiddenException (invariant 4 — Admin demote)", async () => {
      const { service, userRepoMock } = buildService();
      const selfActor = buildSuperAdminActor("self-actor");
      userRepoMock.findById
        .mockResolvedValueOnce(selfActor) // actor
        .mockResolvedValueOnce(selfActor); // target === actor

      await expect(
        service.changeRole("self-actor", "self-actor", "Admin"),
      ).rejects.toThrow(/self-demote is not allowed/);
      expect(userRepoMock.updateRole).not.toHaveBeenCalled();
    });

    it("self + newRole='User' (self-demote) → ForbiddenException (invariant 4 — User demote)", async () => {
      const { service, userRepoMock } = buildService();
      const selfActor = buildSuperAdminActor("self-actor-2");
      userRepoMock.findById
        .mockResolvedValueOnce(selfActor)
        .mockResolvedValueOnce(selfActor);

      await expect(
        service.changeRole("self-actor-2", "self-actor-2", "User"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(userRepoMock.updateRole).not.toHaveBeenCalled();
    });

    it("self + newRole='SuperAdmin' (self-noop) → 정상 처리 + updateRole 호출 (invariant 4 — noop 허용)", async () => {
      const { service, userRepoMock } = buildService();
      const selfActor = buildSuperAdminActor("self-noop");
      const updated = buildUserFixture({ id: "self-noop", role: "SuperAdmin" });
      userRepoMock.findById
        .mockResolvedValueOnce(selfActor)
        .mockResolvedValueOnce(selfActor);
      userRepoMock.updateRole.mockResolvedValueOnce(updated);

      const result = await service.changeRole(
        "self-noop",
        "self-noop",
        "SuperAdmin",
      );

      expect(userRepoMock.updateRole).toHaveBeenCalledWith(
        "self-noop",
        "SuperAdmin",
      );
      expect(result).toBe(updated);
    });

    // -----------------------------------------------------------------------
    // invariant 5 — race window P2025 + generic error propagate
    // -----------------------------------------------------------------------
    it("updateRole 의 P2025 → NotFoundException 변환 (invariant 5 — race window)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-race");
      const target = buildTargetUser("target-race", "User");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(
        service.changeRole("actor-race", "target-race", "Admin"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("P2025 변환 시 message 가 'user not found' + targetUserId 를 포함한다 (invariant 5 — message regex)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-race-2");
      const target = buildTargetUser("target-race-2", "User");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockRejectedValueOnce(buildPrismaError("P2025"));

      await expect(
        service.changeRole("actor-race-2", "target-race-2", "Admin"),
      ).rejects.toThrow(/user not found: target-race-2/);
    });

    it("updateRole 의 generic Error 는 raw propagate — try/catch P2025 만 cover (invariant 5 — negative)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-generic");
      const target = buildTargetUser("target-generic", "User");
      const dbError = new Error("postgres-connection-lost");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockRejectedValueOnce(dbError);

      await expect(
        service.changeRole("actor-generic", "target-generic", "Admin"),
      ).rejects.toBe(dbError);
    });

    it("unknown Prisma error code (P9999) 도 그대로 propagate — P2025 분기 미진입 (invariant 5 — negative)", async () => {
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-unknown");
      const target = buildTargetUser("target-unknown", "User");
      const unknownError = buildPrismaError("P9999");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockRejectedValueOnce(unknownError);

      await expect(
        service.changeRole("actor-unknown", "target-unknown", "Admin"),
      ).rejects.toBe(unknownError);
    });

    it("code field 가 없는 generic Error 도 propagate — getPrismaErrorCode duck typing 분기 (invariant 5 — negative)", async () => {
      // getPrismaErrorCode 의 `error.code !== string` 분기 cover. code 없는 error
      // 는 P2025 분기 미진입 → throw error propagate.
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-nocode");
      const target = buildTargetUser("target-nocode", "User");
      const plainError = new Error("db-down");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      userRepoMock.updateRole.mockRejectedValueOnce(plainError);

      await expect(
        service.changeRole("actor-nocode", "target-nocode", "Admin"),
      ).rejects.toBe(plainError);
    });

    it("null throw (object null) 도 propagate — getPrismaErrorCode 의 null 분기 (invariant 5 — negative)", async () => {
      // getPrismaErrorCode 의 `error !== null` 분기 cover. null throw 는 catch 절
      // 진입 → code undefined → P2025 분기 미진입 → throw error (null) propagate.
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-null");
      const target = buildTargetUser("target-null", "User");
      userRepoMock.findById
        .mockResolvedValueOnce(actor)
        .mockResolvedValueOnce(target);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-promise-reject-errors
      userRepoMock.updateRole.mockReturnValueOnce(Promise.reject(null as any));

      await expect(
        service.changeRole("actor-null", "target-null", "Admin"),
      ).rejects.toBeNull();
    });

    // -----------------------------------------------------------------------
    // ordering invariant — findById 의 actor lookup 이 newRole 검증보다 먼저
    // -----------------------------------------------------------------------
    it("actor lookup 이 newRole 검증보다 먼저 실행된다 (ordering — invariant 1 > 2)", async () => {
      // actor null + invalid role 동시 — invariant 1 (Unauthorized) 가 먼저 발화,
      // invariant 2 (BadRequest) 는 도달 안 함. 분기 순서 박제.
      const { service, userRepoMock } = buildService();
      userRepoMock.findById.mockResolvedValueOnce(null);

      await expect(
        service.changeRole("ghost", "target", "Owner"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("newRole 검증이 target lookup 보다 먼저 실행된다 (ordering — invariant 2 > 3)", async () => {
      // actor SuperAdmin OK + invalid role + (target lookup 호출 안 됨) 박제.
      // findById 가 actor 만 1 회 호출되고 target 은 0 회.
      const { service, userRepoMock } = buildService();
      const actor = buildSuperAdminActor("actor-order");
      userRepoMock.findById.mockResolvedValueOnce(actor);

      await expect(
        service.changeRole("actor-order", "target", "Owner"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepoMock.findById).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------
  // signup — T-0092 acceptance §E (R-112 4 카테고리). REQ-044 후반 박제.
  //   - happy: 첫 user → SuperAdmin / 두 번째 user → User / N 번째 user → User.
  //   - branch: countAll === 0 / countAll > 0 두 분기.
  //   - error: P2002 → ConflictException / 그 외 raw propagate.
  //   - negative: empty email forward / hashPassword throw propagate /
  //               null throw propagate / unknown error code propagate.
  // ---------------------------------------------------------------------
  describe("signup()", () => {
    // happy — 첫 user (countAll === 0) → role "SuperAdmin" 자동 지정 박제.
    it("countAll === 0 시 role='SuperAdmin' + hashed password 로 create 호출 (happy — 첫 user)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      const created = buildUserFixture({
        id: "first-user",
        email: "first@example.com",
        role: "SuperAdmin",
      });
      userRepoMock.countAll.mockResolvedValueOnce(0);
      authMock.hashPassword.mockResolvedValueOnce("hashed-pw");
      userRepoMock.create.mockResolvedValueOnce(created);

      const result = await service.signup("first@example.com", "plain-pw");

      expect(userRepoMock.countAll).toHaveBeenCalledTimes(1);
      expect(authMock.hashPassword).toHaveBeenCalledWith("plain-pw");
      expect(userRepoMock.create).toHaveBeenCalledWith({
        email: "first@example.com",
        hashedPassword: "hashed-pw",
        role: "SuperAdmin",
      });
      expect(result).toBe(created);
    });

    // happy — 두 번째 user (countAll === 1) → role "User" 자동 지정 박제.
    it("countAll === 1 시 role='User' default 로 create 호출 (happy — 두 번째 user)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      const created = buildUserFixture({
        id: "second-user",
        email: "second@example.com",
        role: "User",
      });
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("hashed-pw-2");
      userRepoMock.create.mockResolvedValueOnce(created);

      const result = await service.signup("second@example.com", "plain-pw-2");

      expect(userRepoMock.create).toHaveBeenCalledWith({
        email: "second@example.com",
        hashedPassword: "hashed-pw-2",
        role: "User",
      });
      expect(result).toBe(created);
    });

    // happy — N 번째 user (countAll === 42) → role "User" default 박제.
    it("countAll === 42 시 role='User' default 로 create 호출 (happy — N 번째 user)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      const created = buildUserFixture({
        id: "nth-user",
        role: "User",
      });
      userRepoMock.countAll.mockResolvedValueOnce(42);
      authMock.hashPassword.mockResolvedValueOnce("hashed-nth");
      userRepoMock.create.mockResolvedValueOnce(created);

      await service.signup("nth@example.com", "plain-nth");

      // create 호출의 role 인자가 "User" (SuperAdmin 아님) 검증.
      expect(userRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: "User" }),
      );
    });

    // branch — countAll === 0 분기 (happy 첫 user 와 동일 분기 박제, 명시).
    it("countAll === 0 분기 진입 시 role 이 'SuperAdmin' (branch — 첫 user 분기)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(0);
      authMock.hashPassword.mockResolvedValueOnce("h");
      userRepoMock.create.mockResolvedValueOnce(buildUserFixture());

      await service.signup("a@b.c", "plain");

      const callArg = userRepoMock.create.mock.calls[0][0] as { role: string };
      expect(callArg.role).toBe("SuperAdmin");
    });

    // branch — countAll > 0 분기 박제.
    it("countAll > 0 분기 진입 시 role 이 'User' (branch — default user 분기)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(5);
      authMock.hashPassword.mockResolvedValueOnce("h");
      userRepoMock.create.mockResolvedValueOnce(buildUserFixture());

      await service.signup("a@b.c", "plain");

      const callArg = userRepoMock.create.mock.calls[0][0] as { role: string };
      expect(callArg.role).toBe("User");
    });

    // error — UserRepository.create P2002 → ConflictException 변환 박제.
    it("UserRepository.create 의 P2002 → ConflictException 변환 (error — email 중복)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("h");
      userRepoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      await expect(
        service.signup("dup@example.com", "plain"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("P2002 변환 시 message 에 email 포함 (error — message regex)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("h");
      userRepoMock.create.mockRejectedValueOnce(buildPrismaError("P2002"));

      await expect(service.signup("dup@example.com", "plain")).rejects.toThrow(
        /email already exists: dup@example\.com/,
      );
    });

    // error — UserRepository.create 의 그 외 error raw propagate.
    it("UserRepository.create 의 P9999 (unknown) → raw propagate (error — catch 0)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("h");
      const unknownError = buildPrismaError("P9999");
      userRepoMock.create.mockRejectedValueOnce(unknownError);

      await expect(service.signup("a@b.c", "plain")).rejects.toBe(unknownError);
    });

    it("UserRepository.create 의 generic Error (code 없음) → raw propagate (negative — code 분기 false)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("h");
      const genericError = new Error("postgres-down");
      userRepoMock.create.mockRejectedValueOnce(genericError);

      await expect(service.signup("a@b.c", "plain")).rejects.toBe(genericError);
    });

    // negative — empty email 도 service forward (DTO layer 의 책임 분리).
    it("empty email 도 hash + create 까지 forward (negative — DTO 우회 시 DB 가 fallback)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("h");
      userRepoMock.create.mockResolvedValueOnce(
        buildUserFixture({ email: "" }),
      );

      await service.signup("", "plain");

      expect(userRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "" }),
      );
    });

    // negative — AuthService.hashPassword throw → service raw propagate (catch 0).
    it("AuthService.hashPassword throw 시 raw propagate (negative — hash error catch 0)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(0);
      const hashError = new Error("bcrypt-fail");
      authMock.hashPassword.mockRejectedValueOnce(hashError);

      await expect(service.signup("a@b.c", "plain")).rejects.toBe(hashError);
      // create 는 호출되지 않음 — hash 단계에서 reject.
      expect(userRepoMock.create).not.toHaveBeenCalled();
    });

    // negative — countAll throw → service raw propagate.
    it("UserRepository.countAll throw 시 raw propagate (negative — countAll error)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      const countError = new Error("db-down");
      userRepoMock.countAll.mockRejectedValueOnce(countError);

      await expect(service.signup("a@b.c", "plain")).rejects.toBe(countError);
      // hash / create 모두 호출 안 됨 — 첫 단계 reject.
      expect(authMock.hashPassword).not.toHaveBeenCalled();
      expect(userRepoMock.create).not.toHaveBeenCalled();
    });

    // negative — null throw 도 raw propagate (catch 의 code 분기 미진입).
    it("UserRepository.create 가 null throw 시 raw propagate (negative — null/code 분기 false)", async () => {
      const { service, userRepoMock, authMock } = buildService();
      userRepoMock.countAll.mockResolvedValueOnce(1);
      authMock.hashPassword.mockResolvedValueOnce("h");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, prefer-promise-reject-errors
      userRepoMock.create.mockReturnValueOnce(Promise.reject(null as any));

      await expect(service.signup("a@b.c", "plain")).rejects.toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // findAll — T-0099 acceptance §F. UserController.list 의 service forward.
  //   - happy: repository.findAll 결과 raw forward + reference 동일.
  //   - branch: 빈 list 분기.
  //   - negative: repository throw raw propagate (catch 0).
  // ---------------------------------------------------------------------
  describe("findAll()", () => {
    // happy — repository.findAll 의 3 user 배열 raw forward 박제.
    it("happy — repository.findAll 결과 (3 user 배열) 그대로 propagate", async () => {
      const { service, userRepoMock } = buildService();
      const users = [
        buildUserFixture({ id: "u-1", role: "SuperAdmin" }),
        buildUserFixture({ id: "u-2", role: "Admin" }),
        buildUserFixture({ id: "u-3", role: "User" }),
      ];
      userRepoMock.findAll.mockResolvedValueOnce(users);

      const result = await service.findAll();

      expect(userRepoMock.findAll).toHaveBeenCalledTimes(1);
      expect(userRepoMock.findAll).toHaveBeenCalledWith();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("u-1");
      expect(result[1].id).toBe("u-2");
      expect(result[2].id).toBe("u-3");
    });

    // happy — service 가 transform 0, repository 반환 reference 그대로 통과.
    // `expect(result).toBe(repoResult)` 로 동일 reference 강제 검증.
    it("happy — repository 반환 reference 동일성 (transform 0)", async () => {
      const { service, userRepoMock } = buildService();
      const repoResult = [buildUserFixture({ id: "ref-1" })];
      userRepoMock.findAll.mockResolvedValueOnce(repoResult);

      const result = await service.findAll();

      // service 의 raw forward 박제 — 동일 reference 통과.
      expect(result).toBe(repoResult);
    });

    // branch — 빈 list 분기. repository 가 [] 반환 → service 도 [] 반환 (throw 0).
    it("branch — 빈 list 분기 (repository [] → service [])", async () => {
      const { service, userRepoMock } = buildService();
      userRepoMock.findAll.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    // negative — repository throw raw propagate (catch 0). NestJS default 500 자동.
    it("negative — repository throw 시 raw propagate (catch 0 — NestJS default 500 mapping)", async () => {
      const { service, userRepoMock } = buildService();
      const dbError = new Error("db down");
      userRepoMock.findAll.mockRejectedValueOnce(dbError);

      await expect(service.findAll()).rejects.toBe(dbError);
    });
  });

  // ---------------------------------------------------------------------
  // findById — T-0101 acceptance §B. UserController.detail 의 service forward.
  //   - happy: repository.findById 결과 raw forward + reference 동일.
  //   - branch: id 인자 propagation 정합 (controller 에서 받은 id 가 repository 로 전달).
  //   - negative: repository null → NotFoundException 변환 + message 에 id 포함.
  //   - negative: repository throw raw propagate (catch 0).
  // ---------------------------------------------------------------------
  describe("findById()", () => {
    // happy — repository.findById 의 user entity raw forward + reference 동일성 박제.
    it("happy — repository.findById 결과 raw forward + 동일 reference", async () => {
      const { service, userRepoMock } = buildService();
      const user = buildUserFixture({ id: "user-123", role: "Admin" });
      userRepoMock.findById.mockResolvedValueOnce(user);

      const result = await service.findById("user-123");

      expect(userRepoMock.findById).toHaveBeenCalledTimes(1);
      // service 의 raw forward 박제 — 동일 reference 통과 (transform 0).
      expect(result).toBe(user);
    });

    // branch — id 인자가 repository.findById 에 그대로 전달.
    it("branch — id 인자가 repository.findById 에 그대로 전달", async () => {
      const { service, userRepoMock } = buildService();
      userRepoMock.findById.mockResolvedValueOnce(
        buildUserFixture({ id: "any-shape-id" }),
      );

      await service.findById("any-shape-id");

      expect(userRepoMock.findById).toHaveBeenCalledWith("any-shape-id");
    });

    // negative — repository null → NotFoundException 발화 + message 에 id 포함.
    it("negative — repository.findById null 반환 시 NotFoundException 발화 (message 에 id 포함)", async () => {
      const { service, userRepoMock } = buildService();
      // 2 회 호출 — 첫 await expect 와 두 번째 await expect 각각 service.findById
      // 새로 호출하므로 mockResolvedValueOnce 2 회 박제 필요.
      userRepoMock.findById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(service.findById("ghost-id")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      // message 가 changeRole 의 `user not found: ${id}` 와 동일 형식.
      await expect(service.findById("ghost-id")).rejects.toThrow(
        /user not found: ghost-id/,
      );
    });

    // negative — repository throw raw propagate (catch 0).
    it("negative — repository.findById throw 시 raw propagate (catch 0 — DB outage 등)", async () => {
      const { service, userRepoMock } = buildService();
      const dbError = new Error("db down");
      userRepoMock.findById.mockRejectedValueOnce(dbError);

      await expect(service.findById("any-id")).rejects.toBe(dbError);
    });
  });
});
