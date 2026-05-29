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
// 만들어 호출 카운터가 격리되도록 한다. 본 repository 가 사용하는 3 delegate
// 메서드 (create / findUnique / update) 를 mock 으로 노출. T-0085 추가 메서드
// (findById / updateRole) 가 findUnique + update 를 forward — 기존 create +
// findByEmail 과 동일 mock surface 공유.
function buildPrismaMock(): {
  prisma: PrismaService;
  userMock: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
} {
  const userMock = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
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

  // ------------------------------------------------------------------
  // findById (T-0085 추가) — happy + branch (found vs null) + negative (empty id
  //   forwarding / PrismaService reject propagate)
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path (task §D-1): 존재하는 id 로 호출 시 PrismaService.user.findUnique
    // 가 `{ where: { id } }` 인자로 호출되고 fixture 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      const fixture = buildUserFixture({
        id: "cuid-target",
        email: "target@example.com",
      });
      userMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new UserRepository(prisma);
      const result = await repo.findById("cuid-target");

      expect(userMock.findUnique).toHaveBeenCalledTimes(1);
      expect(userMock.findUnique).toHaveBeenCalledWith({
        where: { id: "cuid-target" },
      });
      expect(result).toBe(fixture);
    });

    // Branch (task §D-2): 부재 id 로 호출 시 PrismaService mock 이 null 반환 →
    // repository 가 null 반환 (throw 0, null-safe API 검증). service-layer 가
    // NotFoundException 변환 책임의 정공법 분기.
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.findUnique.mockResolvedValueOnce(null);

      const repo = new UserRepository(prisma);
      const result = await repo.findById("cuid-missing");

      expect(userMock.findUnique).toHaveBeenCalledWith({
        where: { id: "cuid-missing" },
      });
      expect(result).toBeNull();
    });

    // Negative case (task §D-3): empty string id 로 호출 시 PrismaService 로 그대로
    // forwarding (input validation 은 service-layer 책임 — 본 layer 는 forward 만).
    // 호출 인자 정합성만 검증.
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.findUnique.mockResolvedValueOnce(null);

      const repo = new UserRepository(prisma);
      const result = await repo.findById("");

      expect(userMock.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
      expect(result).toBeNull();
    });

    // Negative case (task §D-4): PrismaService 가 generic error reject 시 그대로
    // propagate — catch 0 의 일반 보장. findByEmail 의 reject propagate 패턴 mirror.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.findUnique.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserRepository(prisma);
      await expect(repo.findById("cuid-any")).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // updateRole (T-0085 추가) — happy + branch (role 변종 3 종) + error (P2025
  //   propagate) + negative (generic error / empty role string forwarding)
  // ------------------------------------------------------------------
  describe("updateRole()", () => {
    // Happy path (task §E-1): id + role 인자로 호출 시 PrismaService.user.update
    // 가 `{ where: { id }, data: { role } }` 인자로 호출되고 fixture (role 갱신)
    // 반환.
    it("id + role 을 PrismaService.user.update 의 where + data 로 전달한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      const fixture = buildUserFixture({
        id: "cuid-target",
        role: "Admin",
      });
      userMock.update.mockResolvedValueOnce(fixture);

      const repo = new UserRepository(prisma);
      const result = await repo.updateRole("cuid-target", "Admin");

      expect(userMock.update).toHaveBeenCalledTimes(1);
      expect(userMock.update).toHaveBeenCalledWith({
        where: { id: "cuid-target" },
        data: { role: "Admin" },
      });
      expect(result).toBe(fixture);
    });

    // Branch (task §E-2): role enum value 변종 3 종 happy — "SuperAdmin" /
    // "Admin" / "User" 각 1 회 호출 → 모두 PrismaService mock 으로 그대로
    // forwarding (role 값 invariant 검증은 service-layer 책임 — 본 layer 는
    // forward 만). create() 의 role 변종 패턴 mirror.
    it("role 값 SuperAdmin / Admin / User 모두 그대로 PrismaService 로 forwarding 한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.update.mockResolvedValue(buildUserFixture());

      const repo = new UserRepository(prisma);

      await repo.updateRole("id-1", "SuperAdmin");
      await repo.updateRole("id-2", "Admin");
      await repo.updateRole("id-3", "User");

      expect(userMock.update).toHaveBeenCalledTimes(3);
      expect(userMock.update).toHaveBeenNthCalledWith(1, {
        where: { id: "id-1" },
        data: { role: "SuperAdmin" },
      });
      expect(userMock.update).toHaveBeenNthCalledWith(2, {
        where: { id: "id-2" },
        data: { role: "Admin" },
      });
      expect(userMock.update).toHaveBeenNthCalledWith(3, {
        where: { id: "id-3" },
        data: { role: "User" },
      });
    });

    // Error path (task §E-3): Prisma 가 `P2025` (record not found) throw 시
    // 그대로 propagate (catch 0 검증). service-layer 가 NotFoundException 변환
    // 책임의 정공법 boundary.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      const p2025 = Object.assign(
        new Error(
          "An operation failed because it depends on one or more records that were required but not found",
        ),
        { code: "P2025" },
      );
      userMock.update.mockRejectedValueOnce(p2025);

      const repo = new UserRepository(prisma);
      await expect(
        repo.updateRole("cuid-missing", "Admin"),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Negative case (task §E-4): PrismaService 가 generic error reject 시 그대로
    // propagate — catch 0 의 일반 보장.
    it("PrismaService 가 generic error 를 reject 하면 그대로 전파한다", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.update.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserRepository(prisma);
      await expect(repo.updateRole("cuid-any", "Admin")).rejects.toThrow(
        "db-down",
      );
    });

    // Negative case (task §E-5): empty role string 으로 호출 시 PrismaService 로
    // 그대로 forwarding (invariant 검증은 service-layer 책임 — 본 layer 는 raw
    // forward). 호출 인자 정합성만 검증.
    it("role 이 빈 문자열이어도 PrismaService 로 그대로 전달한다 (invariant 는 service 책임)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.update.mockResolvedValueOnce(buildUserFixture({ role: "" }));

      const repo = new UserRepository(prisma);
      await repo.updateRole("cuid-target", "");

      expect(userMock.update).toHaveBeenCalledWith({
        where: { id: "cuid-target" },
        data: { role: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // countAll (T-0092 추가) — UserService.signup 의 첫 user 분기 backbone.
  // happy (count 0 / count > 0) + error (PrismaService reject propagate).
  // ------------------------------------------------------------------
  describe("countAll()", () => {
    // Happy path 1: 빈 table 시 count 가 0 반환 — signup 의 첫 user 분기 진입.
    it("user table 이 빈 상태에서 0 반환 (happy — 첫 user 분기 backbone)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.count.mockResolvedValueOnce(0);

      const repo = new UserRepository(prisma);
      const result = await repo.countAll();

      expect(userMock.count).toHaveBeenCalledTimes(1);
      expect(userMock.count).toHaveBeenCalledWith();
      expect(result).toBe(0);
    });

    // Happy path 2: row 가 1+ 있을 시 count 가 N 반환 — signup 의 default User 분기.
    it("user table 에 row 1 개 시 1 반환 (happy — 두 번째 user 분기)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.count.mockResolvedValueOnce(1);

      const repo = new UserRepository(prisma);
      const result = await repo.countAll();

      expect(result).toBe(1);
    });

    it("user table 에 row 42 개 시 42 반환 (happy — N 번째 user 분기)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.count.mockResolvedValueOnce(42);

      const repo = new UserRepository(prisma);
      const result = await repo.countAll();

      expect(result).toBe(42);
    });

    // Negative case: PrismaService 가 generic error reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (negative — catch 0)", async () => {
      const { prisma, userMock } = buildPrismaMock();
      userMock.count.mockRejectedValueOnce(new Error("db-down"));

      const repo = new UserRepository(prisma);
      await expect(repo.countAll()).rejects.toThrow("db-down");
    });
  });
});
