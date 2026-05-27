// PartRepository spec — T-0039 acceptance C (R-112: happy / error / branch /
// negative 4 카테고리 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `part` delegate 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2025 / P2002 / P2003) 가 catch 없이 그대로 throw 되는지.
//   - findById row 부재 시 null 반환 (분기 cover).
//   - findMany 가 빈 배열 반환 시 정상 동작 (negative — empty result).
//   - delete 의 P2025 (row 부재) + P2003 (FK 위반 — 소속 Person 1+) 2 종 error path.
import type { Part } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { PartRepository } from "./part.repository";

// Part fixture — 4 컬럼 (schema.prisma) 을 모두 채운 default row.
function buildPartFixture(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-default",
    name: "조직도파트A",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `part` delegate 만 사용하므로 그것만 정의.
function buildPrismaMock(): {
  prisma: PrismaService;
  partMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
} {
  const partMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
  const prisma = { part: partMock } as unknown as PrismaService;
  return { prisma, partMock };
}

describe("PartRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error (P2002 unique 위반) + negative
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: name 만 받아 PrismaService.part.create 의 data 로 전달.
    it("input 을 PrismaService.part.create 의 data 로 전달한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const fixture = buildPartFixture({ id: "p-new", name: "조직도파트B" });
      partMock.create.mockResolvedValueOnce(fixture);

      const repo = new PartRepository(prisma);
      const result = await repo.create({ name: "조직도파트B" });

      expect(partMock.create).toHaveBeenCalledWith({
        data: { name: "조직도파트B" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: name unique 위반 시 P2002 그대로 propagate.
    it("name 중복 시 Prisma P2002 error 를 그대로 throw 한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      partMock.create.mockRejectedValueOnce(p2002);

      const repo = new PartRepository(prisma);
      await expect(repo.create({ name: "dup" })).rejects.toMatchObject({
        code: "P2002",
      });
    });

    // Negative: empty name 도 그대로 PrismaService 에 전달 (validation 은 service /
    // controller / DTO 책임이므로 repo 는 raw pass-through).
    it("name 이 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.create.mockResolvedValueOnce(buildPartFixture({ name: "" }));

      const repo = new PartRepository(prisma);
      await repo.create({ name: "" });

      expect(partMock.create).toHaveBeenCalledWith({
        data: { name: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // findById — happy + error (null 반환 — 분기 cover)
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path: row 존재 시 PrismaService.part.findUnique 결과를 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const fixture = buildPartFixture({ id: "abc" });
      partMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new PartRepository(prisma);
      const result = await repo.findById("abc");

      expect(partMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Branch / error path: row 부재 시 null 반환 (throw 안 함).
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.findUnique.mockResolvedValueOnce(null);

      const repo = new PartRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });

    // Negative: empty string id 도 raw forward.
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.findUnique.mockResolvedValueOnce(null);

      const repo = new PartRepository(prisma);
      await repo.findById("");

      expect(partMock.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // findMany — happy + negative (빈 배열) + error path
  // ------------------------------------------------------------------
  describe("findMany()", () => {
    // Happy path: 다수 row 반환.
    it("PrismaService.part.findMany 의 결과를 그대로 반환한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const fixture = [
        buildPartFixture({ id: "p-1", name: "조직도파트A" }),
        buildPartFixture({ id: "p-2", name: "조직도파트B" }),
      ];
      partMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new PartRepository(prisma);
      const result = await repo.findMany();

      expect(partMock.findMany).toHaveBeenCalledTimes(1);
      expect(partMock.findMany).toHaveBeenCalledWith();
      expect(result).toBe(fixture);
    });

    // Negative: Part 0 row 일 때 빈 배열 반환.
    it("Part 부재 시 빈 배열을 반환한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.findMany.mockResolvedValueOnce([]);

      const repo = new PartRepository(prisma);
      const result = await repo.findMany();

      expect(result).toEqual([]);
    });

    // Error path: PrismaService 가 reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new PartRepository(prisma);
      await expect(repo.findMany()).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025 id 부재) + error (P2003 FK 위반 — REQ-028 invariant)
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: id 로 delete 호출 + 결과 반환.
    it("id 로 PrismaService.part.delete 를 호출하고 결과를 반환한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const fixture = buildPartFixture({ id: "p-to-delete" });
      partMock.delete.mockResolvedValueOnce(fixture);

      const repo = new PartRepository(prisma);
      const result = await repo.delete("p-to-delete");

      expect(partMock.delete).toHaveBeenCalledWith({
        where: { id: "p-to-delete" },
      });
      expect(result).toBe(fixture);
    });

    // Error path 1: id 부재 시 Prisma P2025 그대로 throw.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      partMock.delete.mockRejectedValueOnce(p2025);

      const repo = new PartRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    // Error path 2 (REQ-028 invariant): 소속 Person 1+ 인 Part 삭제 시 FK constraint
    // 위반 (P2003) — Prisma 의 default `Restrict` cascade 정책이 dangling reference
    // 차단. 본 layer 는 raw propagate, service-layer 가 사전에 모든 Person 의 part
    // 를 재배치한 뒤 본 메서드 호출 책임.
    it("소속 Person 1+ 일 때 Prisma P2003 (FK 위반) error 를 그대로 throw 한다 (REQ-028 invariant)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const p2003 = Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
      });
      partMock.delete.mockRejectedValueOnce(p2003);

      const repo = new PartRepository(prisma);
      await expect(repo.delete("part-in-use")).rejects.toMatchObject({
        code: "P2003",
      });
    });

    // Negative: empty string id 도 raw forward.
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.delete.mockResolvedValueOnce(buildPartFixture());

      const repo = new PartRepository(prisma);
      await repo.delete("");

      expect(partMock.delete).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // update — happy + error (P2002 unique 위반 — Part 만의 분기) +
  //   error (P2025 row 부재) + branch (empty input) + negative ≥3
  //   (T-0069 acceptance §B — R-112 4 카테고리 cover)
  //
  // **Group precedent 와의 차이 박제**: GroupRepository.spec.ts 의 update
  // describe block 은 P2002 분기 부재 (Group.name `@unique` 미정의). 본 spec
  // 의 P2002 test 는 Part.name `@unique` (prisma/schema.prisma L108) 의
  // schema-level enforce 박제 — Part 도메인 만의 분기.
  // ------------------------------------------------------------------
  describe("update()", () => {
    // Happy path: id + name patch → PrismaService.part.update 호출 + 결과 반환.
    it("id + input 으로 PrismaService.part.update 를 호출하고 결과를 반환한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const fixture = buildPartFixture({
        id: "p-renamed",
        name: "조직도파트신규",
      });
      partMock.update.mockResolvedValueOnce(fixture);

      const repo = new PartRepository(prisma);
      const result = await repo.update("p-renamed", { name: "조직도파트신규" });

      expect(partMock.update).toHaveBeenCalledWith({
        where: { id: "p-renamed" },
        data: { name: "조직도파트신규" },
      });
      expect(result).toBe(fixture);
    });

    // Error path #1 (Part 만의 핵심 분기 — P2002): name 중복 시 Prisma P2002
    // 그대로 throw. Part.name `@unique` (schema.prisma L108) 의 schema-level
    // enforce — Group.name 은 `@unique` 미정의로 P2002 분기 부재. 후속
    // PartService.update (T-0070) 가 ConflictException 변환 책임.
    it("name 중복 시 Prisma P2002 error 를 그대로 throw 한다 (Part.name @unique — Group precedent 와의 핵심 차이)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      partMock.update.mockRejectedValueOnce(p2002);

      const repo = new PartRepository(prisma);
      await expect(
        repo.update("p-existing", { name: "조직도파트A-중복" }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // Error path #2: id 부재 시 Prisma P2025 그대로 throw — repo catch 안 함.
    // 후속 PartService.update (T-0070) 가 NotFoundException 변환 책임.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to update not found"), {
        code: "P2025",
      });
      partMock.update.mockRejectedValueOnce(p2025);

      const repo = new PartRepository(prisma);
      await expect(
        repo.update("missing-id", { name: "any" }),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Branch: empty input (`{}`) 도 raw forward — Prisma 가 `@updatedAt`
    // directive 로 updatedAt 만 갱신 (no-op 아님). PATCH 의 부분 update 의
    // "name 미지정" 분기 cover. GroupRepository.spec 의 동일 branch 패턴 mirror.
    it("input 이 빈 객체이어도 PrismaService 로 그대로 전달한다 (branch — name 미지정 PATCH)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const fixture = buildPartFixture({ id: "p-noop" });
      partMock.update.mockResolvedValueOnce(fixture);

      const repo = new PartRepository(prisma);
      const result = await repo.update("p-noop", {});

      expect(partMock.update).toHaveBeenCalledWith({
        where: { id: "p-noop" },
        data: {},
      });
      expect(result).toBe(fixture);
    });

    // Negative #1: PrismaService 가 generic Error (non-Prisma) reject 시 그대로
    // propagate — DB 장애 등.
    it("PrismaService 가 generic Error 로 reject 하면 error 를 그대로 전파한다 (negative)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.update.mockRejectedValueOnce(new Error("db-down"));

      const repo = new PartRepository(prisma);
      await expect(repo.update("p-x", { name: "x" })).rejects.toThrow(
        "db-down",
      );
    });

    // Negative #2: 알려지지 않은 Prisma code (P9999) 도 raw propagate — repo
    // 는 P2002 / P2025 만 의식하지 않고 모든 error 를 통과시킴 (catch 분기
    // 부재 검증).
    it("미지정 Prisma code P9999 도 그대로 throw 한다 (negative — repo 는 code 검사 안 함)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      const p9999 = Object.assign(new Error("future-prisma-code"), {
        code: "P9999",
      });
      partMock.update.mockRejectedValueOnce(p9999);

      const repo = new PartRepository(prisma);
      await expect(repo.update("p-x", { name: "x" })).rejects.toMatchObject({
        code: "P9999",
      });
    });

    // Negative #3: empty string id 도 raw forward — id 자체의 형식 validation
    // 은 service 책임 (repo 는 pass-through).
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, partMock } = buildPrismaMock();
      partMock.update.mockResolvedValueOnce(buildPartFixture({ id: "" }));

      const repo = new PartRepository(prisma);
      await repo.update("", { name: "any" });

      expect(partMock.update).toHaveBeenCalledWith({
        where: { id: "" },
        data: { name: "any" },
      });
    });
  });
});
