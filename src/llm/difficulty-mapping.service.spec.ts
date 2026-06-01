// DifficultyMappingService spec — T-0138 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// GroupService 의 exception 변환 패턴 + DifficultyMappingRepository spec 의 Jest
// mock 패턴 mirror.
//
// 본 spec 은 DifficultyMappingRepository + LlmProviderConfigRepository 2
// collaborator 를 Jest mock (`jest.fn()`) 으로 대체하여 PostgreSQL container 없이
// isolated 하게 실행된다. 검증 포인트 (ADR-0011 §2 resolve + §3 fail-fast):
//   - resolveModel 의 5 분기 (미지원 난이도 / 슬롯 부재 / FK null / config 부재 /
//     성공) 각 1+ test 로 분리.
//   - assignProviderConfig 의 분기 (미지원 난이도 / config 부재 / P2025 슬롯 부재 /
//     성공 / DB reject propagate).
//   - findAllMappings 의 forward + 빈 배열 (negative).
//   - negative cases 충분 cover — 빈 문자열 / 대문자 'Easy' / 'trivial' 미정의 /
//     null FK 슬롯 / config 삭제된 슬롯 (race) / 존재하지 않는 config id / 존재하지
//     않는 난이도 슬롯 등 예외 분기마다 1+ test (단일 negative 금지).
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { DifficultyMapping, LlmProviderConfig } from "@prisma/client";

import { buildPrismaError } from "../../test/helpers/prisma-mock";

import { DifficultyMappingService } from "./difficulty-mapping.service";

// DifficultyMapping fixture — schema.prisma 의 5 컬럼을 모두 채운 default row.
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

// LlmProviderConfig fixture — schema.prisma 의 6 컬럼을 모두 채운 default row.
// provider / modelId 가 resolve 결과 payload 의 source.
function buildConfigFixture(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-default",
    provider: "openai",
    endpointUrl: "https://api.example.test",
    apiKey: "sk-test",
    modelId: "gpt-test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// collaborator mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. service 가 사용하는 메서드만 mock 으로 정의.
function buildService(): {
  service: DifficultyMappingService;
  mappingRepo: {
    findByDifficulty: jest.Mock;
    findMany: jest.Mock;
    updateProviderConfig: jest.Mock;
  };
  configRepo: {
    findById: jest.Mock;
  };
} {
  const mappingRepo = {
    findByDifficulty: jest.fn(),
    findMany: jest.fn(),
    updateProviderConfig: jest.fn(),
  };
  const configRepo = {
    findById: jest.fn(),
  };
  const service = new DifficultyMappingService(
    // service 는 두 repository 의 일부 메서드만 호출하므로 부분 mock 으로 충분.
    mappingRepo as never,
    configRepo as never,
  );
  return { service, mappingRepo, configRepo };
}

describe("DifficultyMappingService", () => {
  // ------------------------------------------------------------------
  // resolveModel — 5 분기 (미지원 난이도 / 슬롯 부재 / FK null / config 부재 / 성공)
  // ------------------------------------------------------------------
  describe("resolveModel()", () => {
    // Happy path / branch (5): 슬롯 존재 + FK 존재 + config 존재 → provider/modelId
    // /configId 반환.
    it("슬롯·FK·config 가 모두 존재하면 provider/modelId/configId 를 반환한다 (happy-path)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      mappingRepo.findByDifficulty.mockResolvedValueOnce(
        buildMappingFixture({
          difficulty: "easy",
          llmProviderConfigId: "cfg-1",
        }),
      );
      configRepo.findById.mockResolvedValueOnce(
        buildConfigFixture({
          id: "cfg-1",
          provider: "anthropic",
          modelId: "claude-x",
        }),
      );

      const result = await service.resolveModel("easy");

      expect(mappingRepo.findByDifficulty).toHaveBeenCalledWith("easy");
      expect(configRepo.findById).toHaveBeenCalledWith("cfg-1");
      expect(result).toEqual({
        configId: "cfg-1",
        provider: "anthropic",
        modelId: "claude-x",
      });
    });

    // Branch (1) / negative: 미지원 난이도 'trivial' (미정의) → BadRequestException.
    // 슬롯 조회 자체를 하지 않음 (fail-fast 전).
    it("미지원 난이도 'trivial' 은 BadRequestException 으로 거부한다 (슬롯 조회 안 함)", async () => {
      const { service, mappingRepo } = buildService();

      await expect(service.resolveModel("trivial")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mappingRepo.findByDifficulty).not.toHaveBeenCalled();
    });

    // Negative: 빈 문자열 → BadRequestException.
    it("빈 문자열 난이도는 BadRequestException 으로 거부한다 (negative)", async () => {
      const { service } = buildService();
      await expect(service.resolveModel("")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // Negative: 대문자 'Easy' (대소문자 구분 — 허용 집합 lower-case) → BadRequestException.
    it("대문자 'Easy' 는 BadRequestException 으로 거부한다 (대소문자 구분 negative)", async () => {
      const { service } = buildService();
      await expect(service.resolveModel("Easy")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // Branch (2): 슬롯 row 부재 (seed 전) → BadRequestException (어느 난이도인지 명시).
    it("슬롯 row 가 부재하면 BadRequestException 으로 거부한다 (미설정 — seed 전)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      mappingRepo.findByDifficulty.mockResolvedValueOnce(null);

      await expect(service.resolveModel("medium")).rejects.toThrow(
        "difficulty model not configured: medium",
      );
      // config hop 까지 진행하지 않음 (fail-fast).
      expect(configRepo.findById).not.toHaveBeenCalled();
    });

    // Branch (3) / negative: 슬롯 존재하나 FK null (nullable 시작 — 미설정 슬롯) →
    // BadRequestException.
    it("슬롯의 llmProviderConfigId 가 null 이면 BadRequestException 으로 거부한다 (FK 미설정)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      mappingRepo.findByDifficulty.mockResolvedValueOnce(
        buildMappingFixture({ difficulty: "hard", llmProviderConfigId: null }),
      );

      await expect(service.resolveModel("hard")).rejects.toThrow(
        "difficulty model not configured: hard",
      );
      expect(configRepo.findById).not.toHaveBeenCalled();
    });

    // Branch (4) / negative: 슬롯·FK 존재하나 가리킨 config 부재 (race window —
    // resolve 직전 config 삭제) → BadRequestException.
    it("FK 가 가리킨 config 가 부재하면 BadRequestException 으로 거부한다 (race window)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      mappingRepo.findByDifficulty.mockResolvedValueOnce(
        buildMappingFixture({
          difficulty: "easy",
          llmProviderConfigId: "cfg-gone",
        }),
      );
      configRepo.findById.mockResolvedValueOnce(null);

      await expect(service.resolveModel("easy")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(configRepo.findById).toHaveBeenCalledWith("cfg-gone");
    });

    // Error path: mapping repository reject (DB 장애) 그대로 propagate.
    it("DifficultyMappingRepository 가 reject 하면 error 를 그대로 전파한다 (DB 장애)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findByDifficulty.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.resolveModel("easy")).rejects.toThrow("db-down");
    });

    // Error path: config repository reject (DB 장애) 그대로 propagate.
    it("LlmProviderConfigRepository 가 reject 하면 error 를 그대로 전파한다 (DB 장애)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      mappingRepo.findByDifficulty.mockResolvedValueOnce(
        buildMappingFixture({
          difficulty: "easy",
          llmProviderConfigId: "cfg-1",
        }),
      );
      configRepo.findById.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.resolveModel("easy")).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // findAllMappings — happy (3 row forward) + negative (빈 배열) + error
  // ------------------------------------------------------------------
  describe("findAllMappings()", () => {
    // Happy path: 3 row 고정 모델 (easy/medium/hard) forward.
    it("DifficultyMappingRepository.findMany 의 결과를 그대로 반환한다 (3 row)", async () => {
      const { service, mappingRepo } = buildService();
      const fixture = [
        buildMappingFixture({ id: "dm-easy", difficulty: "easy" }),
        buildMappingFixture({ id: "dm-medium", difficulty: "medium" }),
        buildMappingFixture({ id: "dm-hard", difficulty: "hard" }),
      ];
      mappingRepo.findMany.mockResolvedValueOnce(fixture);

      const result = await service.findAllMappings();

      expect(mappingRepo.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe(fixture);
    });

    // Negative: 슬롯 0 row (seed 전) → 빈 배열 반환 (404 변환 안 함).
    it("슬롯 부재 시 빈 배열을 반환한다 (negative — empty result, 404 안 함)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([]);

      const result = await service.findAllMappings();

      expect(result).toEqual([]);
    });

    // Error path: repository reject 그대로 propagate.
    it("DifficultyMappingRepository 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.findAllMappings()).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // assignProviderConfig — happy + branch (config 존재/부재 + P2025/성공) + negative
  // ------------------------------------------------------------------
  describe("assignProviderConfig()", () => {
    // Happy path / branch: config 존재 + 슬롯 존재 → FK 재지정 + 결과 반환.
    it("config 가 존재하고 슬롯이 존재하면 FK 를 재지정하고 결과를 반환한다 (happy-path)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      configRepo.findById.mockResolvedValueOnce(
        buildConfigFixture({ id: "cfg-1" }),
      );
      const updated = buildMappingFixture({
        difficulty: "easy",
        llmProviderConfigId: "cfg-1",
      });
      mappingRepo.updateProviderConfig.mockResolvedValueOnce(updated);

      const result = await service.assignProviderConfig("easy", "cfg-1");

      expect(configRepo.findById).toHaveBeenCalledWith("cfg-1");
      expect(mappingRepo.updateProviderConfig).toHaveBeenCalledWith(
        "easy",
        "cfg-1",
      );
      expect(result).toBe(updated);
    });

    // Branch / negative: 미지원 난이도 → BadRequestException (config 조회 안 함).
    it("미지원 난이도는 BadRequestException 으로 거부한다 (config 조회 안 함)", async () => {
      const { service, configRepo } = buildService();

      await expect(
        service.assignProviderConfig("expert", "cfg-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(configRepo.findById).not.toHaveBeenCalled();
    });

    // Branch / negative: 지정 대상 config 부재 → NotFoundException (update 안 함).
    it("지정 대상 config 가 부재하면 NotFoundException 으로 거부한다 (update 안 함)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      configRepo.findById.mockResolvedValueOnce(null);

      await expect(
        service.assignProviderConfig("medium", "cfg-missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mappingRepo.updateProviderConfig).not.toHaveBeenCalled();
    });

    // Branch / error: 슬롯 difficulty 부재 시 P2025 → NotFoundException 변환.
    it("슬롯 difficulty 부재 시 P2025 를 NotFoundException 으로 변환한다", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      configRepo.findById.mockResolvedValueOnce(buildConfigFixture());
      mappingRepo.updateProviderConfig.mockRejectedValueOnce(
        buildPrismaError("P2025", "Record to update not found"),
      );

      await expect(
        service.assignProviderConfig("hard", "cfg-1"),
      ).rejects.toThrow("difficulty mapping not found: hard");
    });

    // Error path: 알 수 없는 Prisma error code 는 raw propagate (NotFound 변환 안 함).
    it("알 수 없는 Prisma error code 는 그대로 전파한다 (NotFound 변환 안 함)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      configRepo.findById.mockResolvedValueOnce(buildConfigFixture());
      mappingRepo.updateProviderConfig.mockRejectedValueOnce(
        buildPrismaError("P9999", "unknown"),
      );

      await expect(
        service.assignProviderConfig("easy", "cfg-1"),
      ).rejects.toMatchObject({ code: "P9999" });
    });

    // Error path: config repository reject (DB 장애) 그대로 propagate.
    it("LlmProviderConfigRepository 가 reject 하면 error 를 그대로 전파한다 (DB 장애)", async () => {
      const { service, configRepo } = buildService();
      configRepo.findById.mockRejectedValueOnce(new Error("db-down"));

      await expect(
        service.assignProviderConfig("easy", "cfg-1"),
      ).rejects.toThrow("db-down");
    });
  });
});
