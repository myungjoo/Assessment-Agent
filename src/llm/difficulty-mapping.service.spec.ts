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
    create: jest.Mock;
    findByDifficulty: jest.Mock;
    findMany: jest.Mock;
    updateProviderConfig: jest.Mock;
  };
  configRepo: {
    findById: jest.Mock;
  };
} {
  const mappingRepo = {
    create: jest.fn(),
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

    // Negative (T-0233): updateProviderConfig 가 `code` 필드 없는 plain Error 를
    // reject → getPrismaErrorCode 가 undefined 반환 (L50 분기) → P2025 변환이
    // 일어나지 않고 원본 error 가 그대로 propagate 됨을 검증. 기존 P9999 test 는
    // `code` 필드를 가져 L48 (return code) 만 cover 했으므로 L50 미커버였다.
    it("code 필드 없는 plain Error reject 는 P2025 변환 없이 그대로 전파한다 (getPrismaErrorCode undefined 분기)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      configRepo.findById.mockResolvedValueOnce(buildConfigFixture());
      const original = new Error("db-down");
      mappingRepo.updateProviderConfig.mockRejectedValueOnce(original);

      // 단일 reject 를 capture 해 두 단언을 동일 throw 에 적용한다.
      const caught = await service.assignProviderConfig("easy", "cfg-1").then(
        () => {
          throw new Error("reject 되어야 하는데 resolve 됨");
        },
        (err: unknown) => err,
      );

      // 원본 error 가 그대로 propagate — 동일 instance 보존.
      expect(caught).toBe(original);
      expect((caught as Error).message).toBe("db-down");
      // NotFoundException 으로 변환되지 않았음 (P2025 분기 미진입).
      expect(caught).not.toBeInstanceOf(NotFoundException);
    });

    // Negative (T-0233, 비-객체 throw): updateProviderConfig 가 객체가 아닌 값
    // (문자열) 을 reject → getPrismaErrorCode 의 `typeof error === "object"` false
    // 경로로 undefined 반환 → raw propagate. 위 plain Error test 의 `"code" in error`
    // false 경로와 다른 false 분기를 cover 해 L41~50 의 4 조건 중 둘 이상의 false
    // 경로를 검증한다 (단일 negative 금지 — R-112).
    it("비-객체(문자열) reject 도 P2025 변환 없이 그대로 전파한다 (typeof !== object 분기)", async () => {
      const { service, mappingRepo, configRepo } = buildService();
      configRepo.findById.mockResolvedValueOnce(buildConfigFixture());
      mappingRepo.updateProviderConfig.mockRejectedValueOnce("db-down");

      // 문자열이 reject 값 그대로 propagate — NotFound 로 변환되지 않음.
      await expect(service.assignProviderConfig("hard", "cfg-1")).rejects.toBe(
        "db-down",
      );
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

  // seedDifficultySlots — T-1998. happy + 4 분기 (0 건 / 일부 / 전량 존재 / P2002
  // 흡수) + error (findMany · create reject) + negative (미지원 row / 순서).
  describe("seedDifficultySlots()", () => {
    // Happy / 분기 (a): 슬롯 0 건 → 3 개 전량 생성. create 인자의
    // llmProviderConfigId null 까지 검증 (ADR-0011 62 행 fail-fast 유지).
    it("슬롯이 0 건이면 3 슬롯을 모두 생성하고 created 에 담는다 (happy-path — 인자 llmProviderConfigId null)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([]);
      mappingRepo.create.mockImplementation(
        async (input: { difficulty: string }) =>
          buildMappingFixture({ difficulty: input.difficulty }),
      );

      const result = await service.seedDifficultySlots();

      expect(mappingRepo.findMany).toHaveBeenCalledTimes(1);
      expect(mappingRepo.create.mock.calls.map((call) => call[0])).toEqual([
        { difficulty: "easy", llmProviderConfigId: null },
        { difficulty: "medium", llmProviderConfigId: null },
        { difficulty: "hard", llmProviderConfigId: null },
      ]);
      expect(result).toEqual({
        created: ["easy", "medium", "hard"],
        existing: [],
      });
    });

    // 분기 (b): 일부 존재 (easy 만) → 없는 슬롯만 생성.
    it("일부 슬롯만 존재하면 없는 슬롯만 생성한다 (branch — easy 존재 시 medium/hard 만 create)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([
        buildMappingFixture({ id: "dm-easy", difficulty: "easy" }),
      ]);
      mappingRepo.create.mockResolvedValue(buildMappingFixture());

      const result = await service.seedDifficultySlots();

      expect(mappingRepo.create.mock.calls.map((call) => call[0])).toEqual([
        { difficulty: "medium", llmProviderConfigId: null },
        { difficulty: "hard", llmProviderConfigId: null },
      ]);
      expect(result).toEqual({
        created: ["medium", "hard"],
        existing: ["easy"],
      });
    });

    it("3 슬롯이 모두 존재하면 create 를 호출하지 않는다 (branch — 멱등 재실행)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([
        buildMappingFixture({ id: "dm-hard", difficulty: "hard" }),
        buildMappingFixture({ id: "dm-easy", difficulty: "easy" }),
        buildMappingFixture({ id: "dm-medium", difficulty: "medium" }),
      ]);

      const result = await service.seedDifficultySlots();

      expect(mappingRepo.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        created: [],
        existing: ["easy", "medium", "hard"],
      });
    });

    it("create 가 P2002 를 던지면 existing 으로 흡수하고 나머지 슬롯 생성을 계속한다 (branch — 동시 seed race 멱등)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([]);
      mappingRepo.create
        .mockRejectedValueOnce(buildPrismaError("P2002", "unique violation"))
        .mockResolvedValueOnce(buildMappingFixture({ difficulty: "medium" }))
        .mockResolvedValueOnce(buildMappingFixture({ difficulty: "hard" }));

      const result = await service.seedDifficultySlots();

      expect(mappingRepo.create).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        created: ["medium", "hard"],
        existing: ["easy"],
      });
    });

    // Error path: findMany reject → 전파 (create 시도 0).
    it("findMany 가 reject 하면 error 를 그대로 전파한다 (error path — create 미시도)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.seedDifficultySlots()).rejects.toThrow("db-down");
      expect(mappingRepo.create).not.toHaveBeenCalled();
    });

    // Error / negative: P2002 아닌 error (P2003 / code 없는 generic) 는 흡수 대상이
    // 아니므로 첫 슬롯에서 즉시 전파 (create 재시도 0).
    it.each<[unknown, string]>([
      [buildPrismaError("P2003", "fk violation"), "fk violation"],
      [new Error("boom"), "boom"],
    ])(
      "create 가 P2002 가 아닌 error 를 던지면 삼키지 않고 전파한다 (negative — #%#)",
      async (rejection, message) => {
        const { service, mappingRepo } = buildService();
        mappingRepo.findMany.mockResolvedValueOnce([]);
        mappingRepo.create.mockRejectedValueOnce(rejection);

        await expect(service.seedDifficultySlots()).rejects.toThrow(message);
        expect(mappingRepo.create).toHaveBeenCalledTimes(1);
      },
    );

    // Negative: 미지원 난이도 row 는 created / existing 어디에도 새지 않는다.
    it("미지원 난이도 row 가 섞여 있어도 DIFFICULTIES 밖 값은 반환에 포함되지 않는다 (negative — trivial 무시)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([
        buildMappingFixture({ id: "dm-trivial", difficulty: "trivial" }),
        buildMappingFixture({ id: "dm-easy", difficulty: "easy" }),
      ]);
      mappingRepo.create.mockResolvedValue(buildMappingFixture());

      const result = await service.seedDifficultySlots();

      expect([...result.created, ...result.existing]).not.toContain("trivial");
      expect(result).toEqual({
        created: ["medium", "hard"],
        existing: ["easy"],
      });
    });

    // Negative: 반환 순서는 findMany 입력 순서와 무관하게 DIFFICULTIES 순서.
    it("반환 배열은 findMany 순서와 무관하게 DIFFICULTIES 순서를 따른다 (negative — 입력 역순)", async () => {
      const { service, mappingRepo } = buildService();
      mappingRepo.findMany.mockResolvedValueOnce([
        buildMappingFixture({ id: "dm-hard", difficulty: "hard" }),
        buildMappingFixture({ id: "dm-medium", difficulty: "medium" }),
      ]);
      mappingRepo.create.mockResolvedValue(buildMappingFixture());

      const result = await service.seedDifficultySlots();

      expect(result.existing).toEqual(["medium", "hard"]);
      expect(result.created).toEqual(["easy"]);
    });
  });
});
