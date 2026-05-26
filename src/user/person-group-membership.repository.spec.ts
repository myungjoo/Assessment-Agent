// PersonGroupMembershipRepository spec — T-0049 acceptance B / D (R-112: happy /
// error / branch / negative 4 카테고리 + coverage line/function ≥ 80%).
//
// PrismaService 의 `personGroupMembership` delegate 를 Jest mock 으로 대체하여
// PostgreSQL container 없이 isolated 하게 실행. 검증 포인트:
//   - call shape contract (`toHaveBeenCalledWith`).
//   - return propagation (PrismaService return 을 그대로 반환).
//   - Prisma error code (P2002 / P2003 / P2025) catch 0 raw propagate.
//   - findByGroupId / findByPersonId 의 row 0 vs row 1+ 2 분기.
//   - empty string id 도 raw forward (validation 은 service 책임).
//
// helper 정책 (task §45): 본 spec 은 test/helpers/prisma-mock.ts 의
// `buildMockPrismaService` 미사용 — 현 helper 는 `person` delegate 만 보유. local
// helper 박제 후 phase 2 follow-up 에서 통합 (cap 보존 + scope 격리).
import type { PersonGroupMembership } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { PersonGroupMembershipRepository } from "./person-group-membership.repository";

function buildPersonGroupMembershipFixture(
  overrides: Partial<PersonGroupMembership> = {},
): PersonGroupMembership {
  return {
    id: "pgm-default",
    personId: "person-default",
    groupId: "group-default",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// `personGroupMembership` delegate 만 사용 — 4 메서드 cover 에 findMany / create /
// delete 3 jest.fn() 충분 (findByGroupId / findByPersonId 둘 다 findMany 사용).
function buildPrismaMock(): {
  prisma: PrismaService;
  membershipMock: {
    findMany: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
} {
  const membershipMock = {
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = {
    personGroupMembership: membershipMock,
  } as unknown as PrismaService;
  return { prisma, membershipMock };
}

describe("PersonGroupMembershipRepository", () => {
  // create — happy + error (P2002 unique 위반 / P2003 FK 위반)
  describe("create()", () => {
    it("input 을 PrismaService.personGroupMembership.create 의 data 로 전달한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      const fixture = buildPersonGroupMembershipFixture({
        id: "pgm-new",
        personId: "p-1",
        groupId: "g-1",
      });
      membershipMock.create.mockResolvedValueOnce(fixture);

      const repo = new PersonGroupMembershipRepository(prisma);
      const result = await repo.create({ personId: "p-1", groupId: "g-1" });

      expect(membershipMock.create).toHaveBeenCalledWith({
        data: { personId: "p-1", groupId: "g-1" },
      });
      expect(result).toBe(fixture);
    });

    // REQ-028 invariant: `@@unique([personId, groupId])` 위반 시 raw propagate.
    it("동일 (personId, groupId) 쌍 중복 시 Prisma P2002 error 를 그대로 throw 한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.create.mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
      );

      const repo = new PersonGroupMembershipRepository(prisma);
      await expect(
        repo.create({ personId: "p-dup", groupId: "g-dup" }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // personId 또는 groupId 가 부재한 reference 일 때 FK 위반 raw propagate.
    it("FK 위반 시 Prisma P2003 error 를 그대로 throw 한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.create.mockRejectedValueOnce(
        Object.assign(new Error("Foreign key constraint failed"), {
          code: "P2003",
        }),
      );

      const repo = new PersonGroupMembershipRepository(prisma);
      await expect(
        repo.create({ personId: "p-missing", groupId: "g-missing" }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
  });

  // findByGroupId — happy (row 1+) + branch (row 0) + error path + negative (empty id)
  describe("findByGroupId()", () => {
    it("row 1+ 일 때 findMany 결과를 그대로 반환한다 (call shape + 다중 row 길이)", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      const fixture = [
        buildPersonGroupMembershipFixture({
          id: "pgm-1",
          personId: "p-1",
          groupId: "g-target",
        }),
        buildPersonGroupMembershipFixture({
          id: "pgm-2",
          personId: "p-2",
          groupId: "g-target",
        }),
      ];
      membershipMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new PersonGroupMembershipRepository(prisma);
      const result = await repo.findByGroupId("g-target");

      expect(membershipMock.findMany).toHaveBeenCalledWith({
        where: { groupId: "g-target" },
      });
      expect(result).toBe(fixture);
      expect(result).toHaveLength(2);
    });

    // branch / negative: null-safe API.
    it("매칭 row 0 일 때 빈 배열을 반환한다 (null 아님)", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.findMany.mockResolvedValueOnce([]);

      const repo = new PersonGroupMembershipRepository(prisma);
      const result = await repo.findByGroupId("g-empty");

      expect(result).toEqual([]);
    });

    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new PersonGroupMembershipRepository(prisma);
      await expect(repo.findByGroupId("g-1")).rejects.toThrow("db-down");
    });

    it("groupId 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.findMany.mockResolvedValueOnce([]);

      const repo = new PersonGroupMembershipRepository(prisma);
      await repo.findByGroupId("");

      expect(membershipMock.findMany).toHaveBeenCalledWith({
        where: { groupId: "" },
      });
    });
  });

  // findByPersonId — happy (row 1+) + branch (row 0) + negative (empty id)
  describe("findByPersonId()", () => {
    it("row 1+ 일 때 findMany 결과를 그대로 반환한다 (call shape + 다중 row 길이)", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      const fixture = [
        buildPersonGroupMembershipFixture({
          id: "pgm-1",
          personId: "p-target",
          groupId: "g-1",
        }),
        buildPersonGroupMembershipFixture({
          id: "pgm-2",
          personId: "p-target",
          groupId: "g-2",
        }),
        buildPersonGroupMembershipFixture({
          id: "pgm-3",
          personId: "p-target",
          groupId: "g-3",
        }),
      ];
      membershipMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new PersonGroupMembershipRepository(prisma);
      const result = await repo.findByPersonId("p-target");

      expect(membershipMock.findMany).toHaveBeenCalledWith({
        where: { personId: "p-target" },
      });
      expect(result).toBe(fixture);
      expect(result).toHaveLength(3);
    });

    it("매칭 row 0 일 때 빈 배열을 반환한다 (null 아님)", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.findMany.mockResolvedValueOnce([]);

      const repo = new PersonGroupMembershipRepository(prisma);
      const result = await repo.findByPersonId("p-empty");

      expect(result).toEqual([]);
    });

    it("personId 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.findMany.mockResolvedValueOnce([]);

      const repo = new PersonGroupMembershipRepository(prisma);
      await repo.findByPersonId("");

      expect(membershipMock.findMany).toHaveBeenCalledWith({
        where: { personId: "" },
      });
    });
  });

  // delete — happy + error (P2025 row 부재) + negative (empty id)
  describe("delete()", () => {
    it("id 로 PrismaService.personGroupMembership.delete 를 호출하고 결과를 반환한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      const fixture = buildPersonGroupMembershipFixture({
        id: "pgm-to-delete",
      });
      membershipMock.delete.mockResolvedValueOnce(fixture);

      const repo = new PersonGroupMembershipRepository(prisma);
      const result = await repo.delete("pgm-to-delete");

      expect(membershipMock.delete).toHaveBeenCalledWith({
        where: { id: "pgm-to-delete" },
      });
      expect(result).toBe(fixture);
    });

    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.delete.mockRejectedValueOnce(
        Object.assign(new Error("Record to delete not found"), {
          code: "P2025",
        }),
      );

      const repo = new PersonGroupMembershipRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, membershipMock } = buildPrismaMock();
      membershipMock.delete.mockResolvedValueOnce(
        buildPersonGroupMembershipFixture(),
      );

      const repo = new PersonGroupMembershipRepository(prisma);
      await repo.delete("");

      expect(membershipMock.delete).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });
});
