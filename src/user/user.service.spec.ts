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
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";

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

// UserRepository mock factory — 본 service 가 사용하는 2 메서드 (findById /
// updateRole) 만 jest.fn() 으로 대체. 각 test 마다 새 mock 생성 (호출 카운터 격리).
function buildUserRepositoryMock(): {
  userRepository: UserRepository;
  userRepoMock: {
    findById: jest.Mock;
    updateRole: jest.Mock;
  };
} {
  const userRepoMock = {
    findById: jest.fn(),
    updateRole: jest.fn(),
  };
  return {
    userRepository: userRepoMock as unknown as UserRepository,
    userRepoMock,
  };
}

// buildService — mock 을 일괄 생성하여 UserService 인스턴스를 조립.
function buildService(): {
  service: UserService;
  userRepoMock: ReturnType<typeof buildUserRepositoryMock>["userRepoMock"];
} {
  const { userRepository, userRepoMock } = buildUserRepositoryMock();
  const service = new UserService(userRepository);
  return { service, userRepoMock };
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
});
