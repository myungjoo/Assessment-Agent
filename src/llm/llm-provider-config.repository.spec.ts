// LlmProviderConfigRepository spec — T-0135 acceptance §38~41 (R-112: happy /
// error / branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// GroupRepository spec (src/user/group.repository.spec.ts) 패턴 mirror.
//
// 본 spec 은 PrismaService 의 `llmProviderConfig` delegate 를 Jest mock
// (`jest.fn()`) 으로 대체하여 PostgreSQL container 없이 isolated 하게 실행된다.
// 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2025) 가 catch 없이 그대로 throw 되는지.
//   - findById row 부재 시 null 반환 (분기 cover).
//   - findMany 가 빈 배열을 반환해도 정상 동작 (negative — empty result).
//   - create 가 빈 input / 잘못된 provider 값도 raw forward (validation 은 service 책임).
import type { LlmProviderConfig } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

// LlmProviderConfig fixture — schema.prisma 의 7 컬럼을 모두 채운 default row.
// overrides 가 provider / id 등을 분기 별 override 한다.
function buildConfigFixture(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "llm-config-default",
    provider: "openai",
    endpointUrl: "https://api.openai.test/v1",
    apiKey: "plaintext-key-placeholder",
    modelId: "gpt-4o-mini",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `llmProviderConfig` delegate 의 4 메서드만 사용하므로 그것만 정의.
function buildPrismaMock(): {
  prisma: PrismaService;
  configMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
} {
  const configMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = {
    llmProviderConfig: configMock,
  } as unknown as PrismaService;
  return { prisma, configMock };
}

describe("LlmProviderConfigRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error + negative
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 4 컬럼 input 을 PrismaService.llmProviderConfig.create 의 data 로 전달.
    it("input 을 PrismaService.llmProviderConfig.create 의 data 로 전달한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      const fixture = buildConfigFixture({
        id: "llm-new",
        provider: "anthropic",
      });
      configMock.create.mockResolvedValueOnce(fixture);

      const repo = new LlmProviderConfigRepository(prisma);
      const input = {
        provider: "anthropic",
        endpointUrl: "https://api.anthropic.test",
        apiKey: "key-1",
        modelId: "claude-x",
      };
      const result = await repo.create(input);

      expect(configMock.create).toHaveBeenCalledWith({ data: input });
      expect(result).toBe(fixture);
    });

    // Error path: PrismaService 가 throw 시 그대로 propagate (DB 장애 등).
    it("PrismaService 가 throw 시 error 를 그대로 전파한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.create.mockRejectedValueOnce(new Error("db-down"));

      const repo = new LlmProviderConfigRepository(prisma);
      await expect(
        repo.create({
          provider: "openai",
          endpointUrl: "u",
          apiKey: "k",
          modelId: "m",
        }),
      ).rejects.toThrow("db-down");
    });

    // Negative #1: 빈 문자열 input 도 그대로 PrismaService 에 전달 (validation 은
    // service / controller / DTO 책임이므로 repo 는 raw pass-through).
    it("input 컬럼이 빈 문자열이어도 PrismaService 로 그대로 전달한다 (validator 는 service 책임)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.create.mockResolvedValueOnce(
        buildConfigFixture({ provider: "" }),
      );

      const repo = new LlmProviderConfigRepository(prisma);
      const input = {
        provider: "",
        endpointUrl: "",
        apiKey: "",
        modelId: "",
      };
      await repo.create(input);

      expect(configMock.create).toHaveBeenCalledWith({ data: input });
    });

    // Negative #2: 잘못된 provider enum 값도 raw forward — provider 값 검증은
    // 후속 service (isLlmProvider) 책임, repo 는 검사 0.
    it("잘못된 provider 값도 PrismaService 로 그대로 전달한다 (provider 검증은 service 책임)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.create.mockResolvedValueOnce(
        buildConfigFixture({ provider: "not-a-provider" }),
      );

      const repo = new LlmProviderConfigRepository(prisma);
      const input = {
        provider: "not-a-provider",
        endpointUrl: "u",
        apiKey: "k",
        modelId: "m",
      };
      await repo.create(input);

      expect(configMock.create).toHaveBeenCalledWith({ data: input });
    });
  });

  // ------------------------------------------------------------------
  // findById — happy + branch (null) + negative
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path / row-존재 분기: PrismaService.findUnique 결과를 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다 (row-존재 분기)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      const fixture = buildConfigFixture({ id: "abc" });
      configMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new LlmProviderConfigRepository(prisma);
      const result = await repo.findById("abc");

      expect(configMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Branch / null 분기: row 부재 시 null 반환 (throw 안 함).
    it("row 가 부재하면 null 을 반환한다 (null 분기 — throw 하지 않음)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.findUnique.mockResolvedValueOnce(null);

      const repo = new LlmProviderConfigRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });

    // Error path: PrismaService 가 reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.findUnique.mockRejectedValueOnce(new Error("db-down"));

      const repo = new LlmProviderConfigRepository(prisma);
      await expect(repo.findById("x")).rejects.toThrow("db-down");
    });

    // Negative: empty string id 도 raw forward (validation 은 service 책임).
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.findUnique.mockResolvedValueOnce(null);

      const repo = new LlmProviderConfigRepository(prisma);
      await repo.findById("");

      expect(configMock.findUnique).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });

  // ------------------------------------------------------------------
  // findMany — happy + negative (빈 배열) + error
  // ------------------------------------------------------------------
  describe("findMany()", () => {
    // Happy path: 다수 row 반환 (다중 row 모델 — provider 별 1+ row).
    it("PrismaService.llmProviderConfig.findMany 의 결과를 그대로 반환한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      const fixture = [
        buildConfigFixture({ id: "c-1", provider: "openai" }),
        buildConfigFixture({ id: "c-2", provider: "anthropic" }),
      ];
      configMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new LlmProviderConfigRepository(prisma);
      const result = await repo.findMany();

      expect(configMock.findMany).toHaveBeenCalledTimes(1);
      expect(configMock.findMany).toHaveBeenCalledWith();
      expect(result).toBe(fixture);
    });

    // Negative: config 0 row 일 때 빈 배열 반환.
    it("config 부재 시 빈 배열을 반환한다 (negative — empty result)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.findMany.mockResolvedValueOnce([]);

      const repo = new LlmProviderConfigRepository(prisma);
      const result = await repo.findMany();

      expect(result).toEqual([]);
    });

    // Error path: PrismaService 가 reject 시 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new LlmProviderConfigRepository(prisma);
      await expect(repo.findMany()).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // update — happy (partial data forward) + error (P2025 propagate) + negative
  // ------------------------------------------------------------------
  describe("update()", () => {
    // Happy path: id + partial data 를 PrismaService.update 의 where/data 로 전달.
    it("id + partial data 를 PrismaService.update 의 where/data 로 전달한다 (happy)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      const fixture = buildConfigFixture({
        id: "c-upd",
        endpointUrl: "https://new.example.test",
      });
      configMock.update.mockResolvedValueOnce(fixture);

      const repo = new LlmProviderConfigRepository(prisma);
      const data = { endpointUrl: "https://new.example.test" };
      const result = await repo.update("c-upd", data);

      expect(configMock.update).toHaveBeenCalledWith({
        where: { id: "c-upd" },
        data,
      });
      expect(result).toBe(fixture);
    });

    // Branch: 빈 partial data (no-op update) 도 그대로 forward — 값 검증 0.
    it("빈 partial data 도 PrismaService 로 그대로 전달한다 (branch — no-op update)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.update.mockResolvedValueOnce(buildConfigFixture());

      const repo = new LlmProviderConfigRepository(prisma);
      await repo.update("c-1", {});

      expect(configMock.update).toHaveBeenCalledWith({
        where: { id: "c-1" },
        data: {},
      });
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw (record not found) — 본 layer
    // 는 catch 하지 않고 propagate (service 가 404 변환 책임).
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다 (error — propagate)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.update.mockRejectedValueOnce(
        Object.assign(new Error("Record to update not found"), {
          code: "P2025",
        }),
      );

      const repo = new LlmProviderConfigRepository(prisma);
      await expect(
        repo.update("missing-id", { endpointUrl: "u" }),
      ).rejects.toMatchObject({ code: "P2025" });
    });

    // Negative: empty string id 도 raw forward (validation 은 service 책임).
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.update.mockResolvedValueOnce(buildConfigFixture());

      const repo = new LlmProviderConfigRepository(prisma);
      await repo.update("", { modelId: "m" });

      expect(configMock.update).toHaveBeenCalledWith({
        where: { id: "" },
        data: { modelId: "m" },
      });
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025) + negative
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: id 로 delete 호출 + 결과 반환.
    it("id 로 PrismaService.llmProviderConfig.delete 를 호출하고 결과를 반환한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      const fixture = buildConfigFixture({ id: "c-to-delete" });
      configMock.delete.mockResolvedValueOnce(fixture);

      const repo = new LlmProviderConfigRepository(prisma);
      const result = await repo.delete("c-to-delete");

      expect(configMock.delete).toHaveBeenCalledWith({
        where: { id: "c-to-delete" },
      });
      expect(result).toBe(fixture);
    });

    // Error path: id 부재 시 Prisma P2025 그대로 throw (record not found).
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, configMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      configMock.delete.mockRejectedValueOnce(p2025);

      const repo = new LlmProviderConfigRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    // Negative: empty string id 도 raw forward.
    it("id 가 빈 문자열이어도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, configMock } = buildPrismaMock();
      configMock.delete.mockResolvedValueOnce(buildConfigFixture());

      const repo = new LlmProviderConfigRepository(prisma);
      await repo.delete("");

      expect(configMock.delete).toHaveBeenCalledWith({
        where: { id: "" },
      });
    });
  });
});
