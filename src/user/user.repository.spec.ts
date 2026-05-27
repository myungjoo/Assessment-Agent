// UserRepository spec — T-0080 acceptance D (R-112: happy / error / branch /
// negative 4 카테고리 + P2002 unique constraint 분기 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `user` delegate 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2002 unique constraint) 가 catch 없이 그대로 throw
//     되는지.
//   - findByEmail 의 null-safe API (row 부재 시 null 반환, throw 0) 분기 cover.
//   - role 값 변종 3 종 (SuperAdmin / Admin / User) 의 forwarding 분기 cover.
//
// 본 task scope = create + findByEmail 2 메서드만. PersonRepository.spec.ts 의
// 6 메서드 cover 패턴 대비 narrow scope — AuthModule consumption-driven minimal
// surface (T-0080 task §29 박제).
import type { User } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { UserRepository } from "./user.repository";

// User fixture — schema.prisma 의 6 컬럼 (id / email / hashedPassword / role /
// createdAt / updatedAt) 모두 채운 default row. 호출 spec 이 overrides 인자로
// 자유롭게 교체 가능.
function buildUserFixture(overrides: Partial<User> = {}): User {
  return {
    id: "cuid-default",
    email: "admin@example.com",
    hashedPassword: "$argon2id$v=19$m=65536,t=3,p=4$mock-hash",
    role: "User",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService 의 `user` delegate mock factory — 각 test 마다 새 instance 를
// 만들어 호출 카운터가 격리되도록 한다. 본 repository 가 사용하는 2 delegate
// 메서드 (create / findUnique) 만 mock 으로 노출.
function buildPrismaMock(): {
  prisma: PrismaService;
  userMock: {
    create: jest.Mock;
    findUnique: jest.Mock;
  };
} {
  const userMock = {
    create: jest.fn(),
    findUnique: jest.fn(),
  };
  const prisma = { user: userMock } as unknown as PrismaService;
  return { prisma, userMock };
}

describe("UserRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error (P2002 unique constraint) + branch (role 변종)
  //   + negative (generic error / 빈 input)
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 정상 input (email + hashedPassword + role) 으로 row 생성,
    // PrismaService.user.create 가 올바른 data 로 호출되고 fixture 그대로 반환.
    it("input 을 PrismaService.user.create 의 data 로 전달한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      const fixture = buildUserFixture({
        id: "cuid-new",
        email: "newuser@example.com",
        role: "User",
      });
      userMock.create.mockResolvedValueOnce(fixture);

      const repo = new UserRepository(prisma);
      const result = await repo.create({
        email: "newuser@example.com",
        hashedPassword: "$argon2id$v=19$m=65536,t=3,p=4$mock-hash",
        role: "User",
      });

      expect(userMock.create).toHaveBeenCalledTimes(1);
      expect(userMock.create).toHaveBeenCalledWith({
        data: {
          email: "newuser@example.com",
          hashedPassword: "$argon2id$v=19$m=65536,t=3,p=4$mock-hash",
          role: "User",
        },
      });
      expect(result).toBe(fixture);
    });

    // Error path 1 (P2002 unique constraint — task §C-5 + §D-2 박제):
    // 동일 email 의 두 번째 create 시도 시 PrismaService mock 이 P2002 throw →
    // UserRepository 가 그대로 propagate (catch 0 검증). User.email @unique
    // invariant 의 schema-level cover.
    it("email 중복 시 Prisma P2002 error 를 그대로 throw 한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      userMock.create.mockRejectedValueOnce(p2002);

      const repo = new UserRepository(prisma);
      await expect(
        repo.create({
          email: "dup@example.com",
          hashedPassword: "hash",
          role: "User",
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // Negative case 2 (task §D-3): PrismaService 의 mock 이 generic error throw
    // 시 그대로 propagate — catch 0 의 일반 보장.
    it("PrismaService 가 generic error 를 reject 하면 그대로 전파한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.create.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserRepository(prisma);
      await expect(
        repo.create({
          email: "err@example.com",
          hashedPassword: "hash",
          role: "User",
        }),
      ).rejects.toThrow("db-down");
    });

    // Branch (task §D-4): role enum value 변종 3 종 happy — "SuperAdmin" /
    // "Admin" / "User" 각 1 회 호출 → 모두 PrismaService mock 으로 그대로
    // forwarding (role 값 invariant 검증은 service-layer 책임 — 본 layer 는
    // forward 만). 3 가지 role 값이 모두 동일하게 전달됨을 검증.
    it("role 값 SuperAdmin / Admin / User 모두 그대로 PrismaService 로 forwarding 한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.create.mockResolvedValue(buildUserFixture());

      const repo = new UserRepository(prisma);

      await repo.create({
        email: "sa@example.com",
        hashedPassword: "h1",
        role: "SuperAdmin",
      });
      await repo.create({
        email: "ad@example.com",
        hashedPassword: "h2",
        role: "Admin",
      });
      await repo.create({
        email: "us@example.com",
        hashedPassword: "h3",
        role: "User",
      });

      expect(userMock.create).toHaveBeenCalledTimes(3);
      expect(userMock.create).toHaveBeenNthCalledWith(1, {
        data: {
          email: "sa@example.com",
          hashedPassword: "h1",
          role: "SuperAdmin",
        },
      });
      expect(userMock.create).toHaveBeenNthCalledWith(2, {
        data: {
          email: "ad@example.com",
          hashedPassword: "h2",
          role: "Admin",
        },
      });
      expect(userMock.create).toHaveBeenNthCalledWith(3, {
        data: {
          email: "us@example.com",
          hashedPassword: "h3",
          role: "User",
        },
      });
    });
  });

  // ------------------------------------------------------------------
  // findByEmail — happy + branch (found vs null) + negative (empty email)
  // ------------------------------------------------------------------
  describe("findByEmail()", () => {
    // Happy path (task §D-5): 존재하는 email 로 호출 시 PrismaService mock 이
    // User row 반환 + repository 가 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      const fixture = buildUserFixture({
        id: "found",
        email: "exists@example.com",
      });
      userMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new UserRepository(prisma);
      const result = await repo.findByEmail("exists@example.com");

      expect(userMock.findUnique).toHaveBeenCalledTimes(1);
      expect(userMock.findUnique).toHaveBeenCalledWith({
        where: { email: "exists@example.com" },
      });
      expect(result).toBe(fixture);
    });

    // Branch + negative case 3 (task §D-6): 부재 email 로 호출 시 PrismaService
    // mock 이 null 반환 + repository 가 null 반환 (throw 0, null-safe API 검증).
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.findUnique.mockResolvedValueOnce(null);

      const repo = new UserRepository(prisma);
      const result = await repo.findByEmail("missing@example.com");

      expect(userMock.findUnique).toHaveBeenCalledWith({
        where: { email: "missing@example.com" },
      });
      expect(result).toBeNull();
    });

    // Negative case 4 (task §D-7): empty string email 으로 호출 시 PrismaService
    // mock 으로 forwarding (input validation 은 service-layer 책임). 호출 인자만
    // 검증.
    it("email 이 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.findUnique.mockResolvedValueOnce(null);

      const repo = new UserRepository(prisma);
      const result = await repo.findByEmail("");

      expect(userMock.findUnique).toHaveBeenCalledWith({
        where: { email: "" },
      });
      expect(result).toBeNull();
    });

    // Negative case 5 (추가 boundary — Prisma reject 시 그대로 propagate):
    // findByEmail 이 catch 0 임을 일반 보장.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.findUnique.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserRepository(prisma);
      await expect(repo.findByEmail("any@example.com")).rejects.toThrow(
        "db-down",
      );
    });
  });
});
