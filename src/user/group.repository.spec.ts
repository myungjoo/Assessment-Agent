// GroupRepository spec — T-0039 acceptance C (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `group` delegate 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2025) 가 catch 없이 그대로 throw 되는지.
//   - findById row 부재 시 null 반환 (분기 cover).
//   - findMany 가 빈 배열을 반환해도 정상 동작 (negative — empty result).
//   - create 가 빈 name 도 raw forward (validation 은 service 책임).
import type { Group } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { GroupRepository } from "./group.repository";

// Group fixture — 4 컬럼 (schema.prisma) 을 모두 채운 default row.
// overrides 가 name / id 등을 분기 별 override 한다.
function buildGroupFixture(overrides: Partial<Group> = {}): Group {
  return {
    id: "group-default",
    name: "백엔드팀",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `group` delegate 만 사용하므로 그것만 정의.
function buildPrismaMock(): {
  prisma: PrismaService;
  groupMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
} {
  const groupMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
  const prisma = { group: groupMock } as unknown as PrismaService;
  return { prisma, groupMock };
}

describe("GroupRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error + negative
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: name 만 받아 PrismaService.group.create 의 data 로 전달.
    it("input 을 PrismaService.group.create 의 data 로 전달한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const fixture = buildGroupFixture({ id: "g-new", name: "프론트엔드팀" });
      groupMock.create.mockResolvedValueOnce(fixture);

      const repo = new GroupRepository(prisma);
      const result = await repo.create({ name: "프론트엔드팀" });

      expect(groupMock.create).toHaveBeenCalledWith({
        data: { name: "프론트엔드팀" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: PrismaService 가 throw 시 그대로 propagate (DB 장애 등).
    it("PrismaService 가 throw 시 error 를 그대로 전파한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.create.mockRejectedValueOnce(new Error("db-down"));

      const repo = new GroupRepository(prisma);
      await expect(repo.create({ name: "x" })).rejects.toThrow("db-down");
    });

    // Negative: empty name 도 그대로 PrismaService 에 전달 (validation 은
    // service / controller / DTO 책임이므로 repo 는 raw pass-through).
    it("name 이 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.create.mockResolvedValueOnce(buildGroupFixture({ name: "" }));

      const repo = new GroupRepository(prisma);
      await repo.create({ name: "" });

      expect(groupMock.create).toHaveBeenCalledWith({
        data: { name: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // findById — happy + error (null 반환 — 분기 cover)
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path: row 존재 시 PrismaService.group.findUnique 결과를 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const fixture = buildGroupFixture({ id: "abc" });
      groupMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new GroupRepository(prisma);
      const result = await repo.findById("abc");

      expect(groupMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Branch / error path: row 부재 시 null 반환 (throw 안 함).
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.findUnique.mockResolvedValueOnce(null);

      const repo = new GroupRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });

    // Negative: empty string id 도 raw forward (validation 은 service 책임).
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.findUnique.mockResolvedValueOnce(null);

      const repo = new GroupRepository(prisma);
      await repo.findById("");

      expect(groupMock.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // findMany — happy + negative (빈 배열)
  // ------------------------------------------------------------------
  describe("findMany()", () => {
    // Happy path: 다수 row 반환.
    it("PrismaService.group.findMany 의 결과를 그대로 반환한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const fixture = [
        buildGroupFixture({ id: "g-1", name: "백엔드팀" }),
        buildGroupFixture({ id: "g-2", name: "프론트엔드팀" }),
      ];
      groupMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new GroupRepository(prisma);
      const result = await repo.findMany();

      expect(groupMock.findMany).toHaveBeenCalledTimes(1);
      expect(groupMock.findMany).toHaveBeenCalledWith();
      expect(result).toBe(fixture);
    });

    // Negative: Group 0 row 일 때 빈 배열 반환.
    it("Group 부재 시 빈 배열을 반환한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.findMany.mockResolvedValueOnce([]);

      const repo = new GroupRepository(prisma);
      const result = await repo.findMany();

      expect(result).toEqual([]);
    });

    // Error path: PrismaService 가 reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new GroupRepository(prisma);
      await expect(repo.findMany()).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025) + negative
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: id 로 delete 호출 + 결과 반환.
    it("id 로 PrismaService.group.delete 를 호출하고 결과를 반환한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const fixture = buildGroupFixture({ id: "g-to-delete" });
      groupMock.delete.mockResolvedValueOnce(fixture);

      const repo = new GroupRepository(prisma);
      const result = await repo.delete("g-to-delete");

      expect(groupMock.delete).toHaveBeenCalledWith({
        where: { id: "g-to-delete" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      groupMock.delete.mockRejectedValueOnce(p2025);

      const repo = new GroupRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    // Negative: empty string id 도 raw forward.
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.delete.mockResolvedValueOnce(buildGroupFixture());

      const repo = new GroupRepository(prisma);
      await repo.delete("");

      expect(groupMock.delete).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // update — happy + error (P2025) + branch (empty input) + negative
  //   (T-0066 acceptance §B — R-112 4 카테고리 cover)
  // ------------------------------------------------------------------
  describe("update()", () => {
    // Happy path: id + name patch → PrismaService.group.update 호출 + 결과 반환.
    it("id + input 으로 PrismaService.group.update 를 호출하고 결과를 반환한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const fixture = buildGroupFixture({
        id: "g-renamed",
        name: "신규 백엔드팀",
      });
      groupMock.update.mockResolvedValueOnce(fixture);

      const repo = new GroupRepository(prisma);
      const result = await repo.update("g-renamed", { name: "신규 백엔드팀" });

      expect(groupMock.update).toHaveBeenCalledWith({
        where: { id: "g-renamed" },
        data: { name: "신규 백엔드팀" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw — repo catch 안 함.
    // 후속 GroupService.update (T-0067) 가 NotFoundException 변환 책임.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to update not found"), {
        code: "P2025",
      });
      groupMock.update.mockRejectedValueOnce(p2025);

      const repo = new GroupRepository(prisma);
      await expect(
        repo.update("missing-id", { name: "any" }),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Branch: empty input (`{}`) 도 raw forward — Prisma 가 `@updatedAt`
    // directive 로 updatedAt 만 갱신 (no-op 아님). PATCH 의 부분 update 의
    // "name 미지정" 분기 cover.
    it("input 이 빈 객체이어도 PrismaService 로 그대로 전달한다 (branch — name 미지정 PATCH)", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const fixture = buildGroupFixture({ id: "g-noop" });
      groupMock.update.mockResolvedValueOnce(fixture);

      const repo = new GroupRepository(prisma);
      const result = await repo.update("g-noop", {});

      expect(groupMock.update).toHaveBeenCalledWith({
        where: { id: "g-noop" },
        data: {},
      });
      expect(result).toBe(fixture);
    });

    // Negative #1: PrismaService 가 generic Error (non-Prisma) reject 시 그대로
    // propagate — DB 장애 등.
    it("PrismaService 가 generic Error 로 reject 하면 error 를 그대로 전파한다 (negative)", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.update.mockRejectedValueOnce(new Error("db-down"));

      const repo = new GroupRepository(prisma);
      await expect(repo.update("g-x", { name: "x" })).rejects.toThrow(
        "db-down",
      );
    });

    // Negative #2: 알려지지 않은 Prisma code (P9999) 도 raw propagate — repo
    // 는 P2025 만 의식하지 않고 모든 error 를 통과시킴 (catch 분기 부재 검증).
    it("미지정 Prisma code P9999 도 그대로 throw 한다 (negative — repo 는 code 검사 안 함)", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      const p9999 = Object.assign(new Error("future-prisma-code"), {
        code: "P9999",
      });
      groupMock.update.mockRejectedValueOnce(p9999);

      const repo = new GroupRepository(prisma);
      await expect(repo.update("g-x", { name: "x" })).rejects.toMatchObject({
        code: "P9999",
      });
    });

    // Negative #3: empty string id 도 raw forward — id 자체의 형식 validation
    // 은 service 책임 (repo 는 pass-through).
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, groupMock } = buildPrismaMock();
      groupMock.update.mockResolvedValueOnce(buildGroupFixture({ id: "" }));

      const repo = new GroupRepository(prisma);
      await repo.update("", { name: "any" });

      expect(groupMock.update).toHaveBeenCalledWith({
        where: { id: "" },
        data: { name: "any" },
      });
    });
  });
});
