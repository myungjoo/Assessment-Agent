// DifficultyMappingRepository spec — T-0137 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// LlmProviderConfigRepository spec (src/llm/llm-provider-config.repository.spec.ts)
// 패턴 mirror.
//
// 본 spec 은 PrismaService 의 `difficultyMapping` delegate 를 Jest mock
// (`jest.fn()`) 으로 대체하여 PostgreSQL container 없이 isolated 하게 실행된다.
// 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2002 / P2025) 가 catch 없이 그대로 throw 되는지.
//   - findById / findByDifficulty row 부재 시 null 반환 (분기 cover).
//   - findMany 가 빈 배열을 반환해도 정상 동작 (negative — empty result).
//   - create 가 nullable FK / 미설정 슬롯 input 도 raw forward.
import type { DifficultyMapping } from "@prisma/client";

import { buildPrismaError } from "../../test/helpers/prisma-mock";
import type { PrismaService } from "../persistence/prisma.service";

import { DifficultyMappingRepository } from "./difficulty-mapping.repository";

// DifficultyMapping fixture — schema.prisma 의 5 컬럼을 모두 채운 default row.
// overrides 가 difficulty / llmProviderConfigId 등을 분기 별 override 한다.
// llmProviderConfigId default null — ADR-0011 §3 미설정 슬롯 nullable 시작.
function buildMappingFixture(
  overrides: Partial<DifficultyMapping> = {},
): DifficultyMapping {
  return {
    id: "difficulty-mapping-default",
    difficulty: "easy",
    llmProviderConfigId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `difficultyMapping` delegate 의 5 메서드만 사용하므로 그것만 정의.
function buildPrismaMock(): {
  prisma: PrismaService;
  mappingMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
} {
  const mappingMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = {
    difficultyMapping: mappingMock,
  } as unknown as PrismaService;
  return { prisma, mappingMock };
}

describe("DifficultyMappingRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error (P2002 / DB reject) + negative (nullable FK)
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: input 을 PrismaService.difficultyMapping.create 의 data 로 전달.
    it("input 을 PrismaService.difficultyMapping.create 의 data 로 전달한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      const fixture = buildMappingFixture({
        id: "dm-new",
        difficulty: "medium",
        llmProviderConfigId: "cfg-1",
      });
      mappingMock.create.mockResolvedValueOnce(fixture);

      const repo = new DifficultyMappingRepository(prisma);
      const input = {
        difficulty: "medium" as const,
        llmProviderConfigId: "cfg-1",
      };
      const result = await repo.create(input);

      expect(mappingMock.create).toHaveBeenCalledWith({ data: input });
      expect(result).toBe(fixture);
    });

    // Negative / branch: llmProviderConfigId 미지정 (nullable FK — 미설정 슬롯)
    // 도 raw forward (ADR-0011 §3 nullable 시작).
    it("llmProviderConfigId 미지정 (nullable FK) input 도 그대로 전달한다 (미설정 슬롯)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.create.mockResolvedValueOnce(
        buildMappingFixture({ difficulty: "hard", llmProviderConfigId: null }),
      );

      const repo = new DifficultyMappingRepository(prisma);
      const input = { difficulty: "hard" as const };
      await repo.create(input);

      expect(mappingMock.create).toHaveBeenCalledWith({ data: input });
    });

    // Error path #1: `@@unique([difficulty])` 중복 시 Prisma P2002 그대로 propagate
    // (fail-fast 변환은 service 책임 — ADR-0011 §3).
    it("difficulty 중복 시 Prisma P2002 error 를 그대로 propagate 한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.create.mockRejectedValueOnce(
        buildPrismaError("P2002", "Unique constraint failed on difficulty"),
      );

      const repo = new DifficultyMappingRepository(prisma);
      await expect(
        repo.create({ difficulty: "easy", llmProviderConfigId: "cfg-1" }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // Error path #2: PrismaService reject (DB 장애) 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (DB 장애)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.create.mockRejectedValueOnce(new Error("db-down"));

      const repo = new DifficultyMappingRepository(prisma);
      await expect(repo.create({ difficulty: "easy" })).rejects.toThrow(
        "db-down",
      );
    });
  });

  // ------------------------------------------------------------------
  // findById — happy (row-존재) + branch (null) + error + negative
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path / row-존재 분기: findUnique 결과를 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다 (row-존재 분기)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      const fixture = buildMappingFixture({ id: "dm-1" });
      mappingMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.findById("dm-1");

      expect(mappingMock.findUnique).toHaveBeenCalledWith({
        where: { id: "dm-1" },
      });
      expect(result).toBe(fixture);
    });

    // Branch / null 분기: row 부재 시 null 반환 (throw 안 함).
    it("row 가 부재하면 null 을 반환한다 (null 분기 — throw 하지 않음)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findUnique.mockResolvedValueOnce(null);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });

    // Error path: PrismaService reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findUnique.mockRejectedValueOnce(new Error("db-down"));

      const repo = new DifficultyMappingRepository(prisma);
      await expect(repo.findById("x")).rejects.toThrow("db-down");
    });

    // Negative: empty string id 도 raw forward (validation 은 service 책임).
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findUnique.mockResolvedValueOnce(null);

      const repo = new DifficultyMappingRepository(prisma);
      await repo.findById("");

      expect(mappingMock.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // findByDifficulty — happy (row-존재) + branch (null) + error + negative
  // ------------------------------------------------------------------
  describe("findByDifficulty()", () => {
    // Happy path / row-존재 분기: `@@unique([difficulty])` 위 findUnique 결과 반환.
    it("슬롯이 존재하면 difficulty 로 findUnique 결과를 반환한다 (row-존재 분기)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      const fixture = buildMappingFixture({
        difficulty: "medium",
        llmProviderConfigId: "cfg-2",
      });
      mappingMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.findByDifficulty("medium");

      expect(mappingMock.findUnique).toHaveBeenCalledWith({
        where: { difficulty: "medium" },
      });
      expect(result).toBe(fixture);
    });

    // Branch / null 분기: 슬롯 미설정 (row 부재) 시 null 반환 (fail-fast 대상 — service).
    it("슬롯이 부재하면 null 을 반환한다 (null 분기 — 미설정 슬롯)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findUnique.mockResolvedValueOnce(null);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.findByDifficulty("hard");

      expect(result).toBeNull();
    });

    // Error path: PrismaService reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findUnique.mockRejectedValueOnce(new Error("db-down"));

      const repo = new DifficultyMappingRepository(prisma);
      await expect(repo.findByDifficulty("easy")).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // findMany — happy (3 row) + negative (빈 배열) + error
  // ------------------------------------------------------------------
  describe("findMany()", () => {
    // Happy path: 3 row 고정 모델 (easy/medium/hard) 반환.
    it("PrismaService.difficultyMapping.findMany 의 결과를 그대로 반환한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      const fixture = [
        buildMappingFixture({ id: "dm-easy", difficulty: "easy" }),
        buildMappingFixture({ id: "dm-medium", difficulty: "medium" }),
        buildMappingFixture({ id: "dm-hard", difficulty: "hard" }),
      ];
      mappingMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.findMany();

      expect(mappingMock.findMany).toHaveBeenCalledTimes(1);
      expect(mappingMock.findMany).toHaveBeenCalledWith();
      expect(result).toBe(fixture);
    });

    // Negative: 슬롯 0 row 일 때 빈 배열 반환 (seed 전 상태).
    it("슬롯 부재 시 빈 배열을 반환한다 (negative — empty result)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findMany.mockResolvedValueOnce([]);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.findMany();

      expect(result).toEqual([]);
    });

    // Error path: PrismaService reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new DifficultyMappingRepository(prisma);
      await expect(repo.findMany()).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025) + negative
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: id 로 delete 호출 + 결과 반환.
    it("id 로 PrismaService.difficultyMapping.delete 를 호출하고 결과를 반환한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      const fixture = buildMappingFixture({ id: "dm-to-delete" });
      mappingMock.delete.mockResolvedValueOnce(fixture);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.delete("dm-to-delete");

      expect(mappingMock.delete).toHaveBeenCalledWith({
        where: { id: "dm-to-delete" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw (record not found).
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.delete.mockRejectedValueOnce(
        buildPrismaError("P2025", "Record to delete not found"),
      );

      const repo = new DifficultyMappingRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    // Negative: empty string id 도 raw forward.
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.delete.mockResolvedValueOnce(buildMappingFixture());

      const repo = new DifficultyMappingRepository(prisma);
      await repo.delete("");

      expect(mappingMock.delete).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // updateProviderConfig — happy (FK 지정 / null 해제) + error (P2025) + negative
  // ------------------------------------------------------------------
  describe("updateProviderConfig()", () => {
    // Happy path: difficulty 슬롯의 FK 를 재지정 (T-0139 backbone — ADR-0011 §2).
    it("difficulty 로 슬롯을 특정해 llmProviderConfigId 를 갱신한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      const fixture = buildMappingFixture({
        difficulty: "easy",
        llmProviderConfigId: "cfg-new",
      });
      mappingMock.update.mockResolvedValueOnce(fixture);

      const repo = new DifficultyMappingRepository(prisma);
      const result = await repo.updateProviderConfig("easy", "cfg-new");

      expect(mappingMock.update).toHaveBeenCalledWith({
        where: { difficulty: "easy" },
        data: { llmProviderConfigId: "cfg-new" },
      });
      expect(result).toBe(fixture);
    });

    // Branch / negative: null 전달 시 슬롯 미설정으로 되돌림 (fail-fast 대상 복귀).
    it("llmProviderConfigId 에 null 전달 시 슬롯을 미설정으로 되돌린다 (FK 해제 분기)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.update.mockResolvedValueOnce(
        buildMappingFixture({
          difficulty: "medium",
          llmProviderConfigId: null,
        }),
      );

      const repo = new DifficultyMappingRepository(prisma);
      await repo.updateProviderConfig("medium", null);

      expect(mappingMock.update).toHaveBeenCalledWith({
        where: { difficulty: "medium" },
        data: { llmProviderConfigId: null },
      });
    });

    // Error path: 슬롯 (difficulty) 부재 시 Prisma P2025 그대로 throw.
    it("슬롯 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.update.mockRejectedValueOnce(
        buildPrismaError("P2025", "Record to update not found"),
      );

      const repo = new DifficultyMappingRepository(prisma);
      await expect(
        repo.updateProviderConfig("hard", "cfg-x"),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Error path: PrismaService reject (DB 장애) 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (DB 장애)", async () => {
      const { prisma, mappingMock } = buildPrismaMock();
      mappingMock.update.mockRejectedValueOnce(new Error("db-down"));

      const repo = new DifficultyMappingRepository(prisma);
      await expect(repo.updateProviderConfig("easy", "cfg-1")).rejects.toThrow(
        "db-down",
      );
    });
  });
});
