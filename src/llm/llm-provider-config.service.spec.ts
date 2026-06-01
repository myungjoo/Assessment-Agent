// LlmProviderConfigService spec — T-0140 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// DifficultyMappingService spec 의 repository Jest mock 패턴 1:1 mirror, 단 본
// service 의 핵심 차이 (apiKey secret redaction) 를 negative case 로 집중 검증.
//
// 본 spec 은 LlmProviderConfigRepository 를 Jest mock (`jest.fn()`) 으로 대체하여
// PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - findAll 의 분기 (빈 배열 / 비어있지 않은 배열) 각 1+ test.
//   - error path: repository.findMany reject (DB 장애) 를 swallow 하지 않고 propagate.
//   - negative cases 충분 cover — **secret redaction (핵심)**: 반환 view 에 apiKey 가
//     존재하지 않음을 다중 row 모두에 대해 명시 assert. repository mock 이 apiKey 값을
//     포함한 row 를 반환해도 view 에서 누락됨을 검증 (deny-by-default allow-list).
import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { LlmProviderConfig } from "@prisma/client";

import type { CreateLlmProviderConfigDto } from "./dto/create-llm-provider-config.dto";
import { LlmProviderConfigService } from "./llm-provider-config.service";

// LlmProviderConfig fixture — schema.prisma 의 7 컬럼을 모두 채운 default row.
// apiKey 는 secret — fixture 가 일부러 평문값을 포함시켜 view 에서 redact 됨을 검증.
function buildConfigFixture(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-default",
    provider: "openai",
    endpointUrl: "https://api.example.test",
    apiKey: "sk-super-secret-plaintext",
    modelId: "gpt-test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// repository / cipher mock factory — 각 test 마다 새 instance 를 만들어 호출
// 카운터가 격리되도록 한다. service 가 사용하는 findMany / findById / create
// (repository) + encrypt (cipher) 메서드를 mock 으로 정의.
function buildService(): {
  service: LlmProviderConfigService;
  repo: { findMany: jest.Mock; findById: jest.Mock; create: jest.Mock };
  cipher: { encrypt: jest.Mock };
} {
  const repo = {
    findMany: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  // cipher 는 create 만 사용 (read path 미사용 — never-decrypt-and-return).
  const cipher = {
    encrypt: jest.fn(),
  };
  const service = new LlmProviderConfigService(repo as never, cipher as never);
  return { service, repo, cipher };
}

// CreateLlmProviderConfigDto fixture — 유효한 4 필드. negative case 는 1 필드만 변형.
function buildCreateDto(
  overrides: Partial<CreateLlmProviderConfigDto> = {},
): CreateLlmProviderConfigDto {
  return {
    provider: "openai",
    endpointUrl: "https://api.example.test",
    apiKey: "sk-super-secret-plaintext",
    modelId: "gpt-test",
    ...overrides,
  };
}

describe("LlmProviderConfigService", () => {
  describe("findAll()", () => {
    // ------------------------------------------------------------------
    // Happy path / branch (비어있지 않은 배열) — 다중 row forward + apiKey 제거 view 변환
    // ------------------------------------------------------------------
    it("findMany 의 각 row 를 apiKey 제거 view 로 변환해 반환한다 (happy — 다중 row)", async () => {
      const { service, repo } = buildService();
      const rows = [
        buildConfigFixture({ id: "cfg-1", provider: "openai" }),
        buildConfigFixture({ id: "cfg-2", provider: "anthropic" }),
      ];
      repo.findMany.mockResolvedValueOnce(rows);

      const result = await service.findAll();

      expect(repo.findMany).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      // apiKey 를 제외한 6 필드가 원본값 그대로 보존되는지 확인.
      expect(result[0]).toEqual({
        id: "cfg-1",
        provider: "openai",
        endpointUrl: "https://api.example.test",
        modelId: "gpt-test",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      expect(result[1].id).toBe("cfg-2");
      expect(result[1].provider).toBe("anthropic");
    });

    // ------------------------------------------------------------------
    // Branch (빈 배열) — 등록 0 이면 빈 배열 반환 (404 변환 안 함, negative — empty)
    // ------------------------------------------------------------------
    it("findMany 가 빈 배열이면 빈 배열을 반환한다 (branch — empty, 404 안 함)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(repo.findMany).toHaveBeenCalledTimes(1);
    });

    // ------------------------------------------------------------------
    // Negative (핵심) — secret redaction: 반환 view 에 apiKey key 가 부재함을
    // 다중 row 모두에 대해 명시 assert. repository mock 이 apiKey 평문값을
    // 포함한 row 를 반환해도 view 에서 누락 (deny-by-default allow-list).
    // ------------------------------------------------------------------
    it("반환된 모든 view 에 apiKey key 가 존재하지 않는다 (negative 핵심 — secret redaction, 다중 row)", async () => {
      const { service, repo } = buildService();
      const rows = [
        buildConfigFixture({ id: "cfg-1", apiKey: "sk-leak-1" }),
        buildConfigFixture({ id: "cfg-2", apiKey: "sk-leak-2" }),
        buildConfigFixture({ id: "cfg-3", apiKey: "sk-leak-3" }),
      ];
      repo.findMany.mockResolvedValueOnce(rows);

      const result = await service.findAll();

      // 단일 row 가 아니라 다중 row 모두 apiKey 누락 확인.
      expect(result).toHaveLength(3);
      for (const view of result) {
        expect(view).not.toHaveProperty("apiKey");
        expect(Object.keys(view)).not.toContain("apiKey");
      }
      // 평문 secret 값이 어떤 view 에도 직렬화되지 않음을 추가 확인.
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("sk-leak-1");
      expect(serialized).not.toContain("sk-leak-2");
      expect(serialized).not.toContain("sk-leak-3");
    });

    // 단일 row 케이스에서도 apiKey 누락 확인 (boundary — 1 row).
    it("단일 row 도 apiKey 가 제거된 view 로 반환한다 (negative — single row redaction)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ id: "cfg-solo", apiKey: "sk-solo-secret" }),
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty("apiKey");
    });

    // ------------------------------------------------------------------
    // Error path / negative — 의존성 실패: repository.findMany reject (DB 장애)
    // 를 swallow 하지 않고 그대로 propagate.
    // ------------------------------------------------------------------
    it("repository.findMany 가 reject 하면 error 를 그대로 전파한다 (error path — DB 장애)", async () => {
      const { service, repo } = buildService();
      repo.findMany.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.findAll()).rejects.toThrow("db-down");
    });
  });

  describe("findById()", () => {
    // ------------------------------------------------------------------
    // Happy path / branch (비-null row) — apiKey 제거 view 변환 + 정확한 id 인자 호출
    // ------------------------------------------------------------------
    it("비-null row 를 apiKey 제거 view 로 변환해 반환한다 (happy — branch 비-null)", async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValueOnce(
        buildConfigFixture({ id: "existing-id", provider: "anthropic" }),
      );

      const result = await service.findById("existing-id");

      // repository.findById 가 정확한 id 인자로 1 회 호출됨 검증.
      expect(repo.findById).toHaveBeenCalledTimes(1);
      expect(repo.findById).toHaveBeenCalledWith("existing-id");
      // apiKey 를 제외한 6 필드가 원본값 그대로 보존.
      expect(result).toEqual({
        id: "existing-id",
        provider: "anthropic",
        endpointUrl: "https://api.example.test",
        modelId: "gpt-test",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });

    // ------------------------------------------------------------------
    // Negative (핵심) — null → NotFoundException 변환 분기. 빈 결과를 200/undefined
    // 로 반환하지 않고 404 로 표면화 (목록 endpoint 와 다른 단건의 핵심 분기).
    // ------------------------------------------------------------------
    it("repository.findById 가 null 이면 NotFoundException 을 throw 한다 (negative 핵심 — null→404 분기)", async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValueOnce(null);

      // 빈 결과를 undefined/200 으로 반환하지 않고 404 로 변환함을 검증.
      await expect(service.findById("missing-id")).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findById).toHaveBeenCalledWith("missing-id");
    });

    // ------------------------------------------------------------------
    // Negative (핵심) — secret redaction: 반환 view 에 apiKey key 가 부재함을 명시
    // assert. repository mock 이 apiKey 평문값을 포함한 row 를 반환해도 view 에서 누락.
    // ------------------------------------------------------------------
    it("반환 view 에 apiKey key 가 존재하지 않는다 (negative 핵심 — secret redaction)", async () => {
      const { service, repo } = buildService();
      repo.findById.mockResolvedValueOnce(
        buildConfigFixture({ id: "cfg-solo", apiKey: "sk-leak-single" }),
      );

      const view = await service.findById("cfg-solo");

      expect(view).not.toHaveProperty("apiKey");
      expect(Object.keys(view)).not.toContain("apiKey");
      // 평문 secret 값이 직렬화 결과에 새어나가지 않음 추가 확인.
      expect(JSON.stringify(view)).not.toContain("sk-leak-single");
    });

    // ------------------------------------------------------------------
    // Error path / negative — 의존성 실패: repository.findById reject (DB 장애)
    // 를 swallow 하지 않고 그대로 propagate (null→404 분기와 별개 케이스).
    // ------------------------------------------------------------------
    it("repository.findById 가 reject 하면 error 를 그대로 전파한다 (error path — DB 장애)", async () => {
      const { service, repo } = buildService();
      repo.findById.mockRejectedValueOnce(new Error("db-down"));

      // 의존성 reject 는 NotFoundException 변환 없이 raw propagate.
      await expect(service.findById("any-id")).rejects.toThrow("db-down");
    });
  });

  describe("create()", () => {
    // ------------------------------------------------------------------
    // Happy path / branch (provider 유효) — encrypt 1 회 호출 + repository.create
    // 가 ciphertext (평문 apiKey 와 다른 값) 로 호출됨 + 반환 view 에 apiKey 부재.
    // ------------------------------------------------------------------
    it("유효 입력 시 encrypt 후 ciphertext 로 repository.create 호출 + apiKey 제거 view 반환 (happy)", async () => {
      const { service, repo, cipher } = buildService();
      const dto = buildCreateDto({ apiKey: "sk-plain-123" });
      cipher.encrypt.mockReturnValueOnce("ENVELOPE-CIPHERTEXT-base64");
      repo.create.mockResolvedValueOnce(
        buildConfigFixture({
          id: "cfg-new",
          provider: "openai",
          apiKey: "ENVELOPE-CIPHERTEXT-base64",
        }),
      );

      const result = await service.create(dto);

      // encrypt 가 평문 apiKey 로 정확히 1 회 호출됨.
      expect(cipher.encrypt).toHaveBeenCalledTimes(1);
      expect(cipher.encrypt).toHaveBeenCalledWith("sk-plain-123");
      // repository.create 가 ciphertext (평문과 다른 값) 로 호출됨.
      expect(repo.create).toHaveBeenCalledTimes(1);
      const createArg = repo.create.mock.calls[0][0];
      expect(createArg.apiKey).toBe("ENVELOPE-CIPHERTEXT-base64");
      expect(createArg.apiKey).not.toBe("sk-plain-123");
      expect(createArg).toEqual({
        provider: "openai",
        endpointUrl: "https://api.example.test",
        apiKey: "ENVELOPE-CIPHERTEXT-base64",
        modelId: "gpt-test",
      });
      // 반환 view 에 apiKey 키가 부재 (id / provider 등 6 필드만).
      expect(result).not.toHaveProperty("apiKey");
      expect(result.id).toBe("cfg-new");
    });

    // ------------------------------------------------------------------
    // never-read-back invariant regression (ADR-0014 §3) — 반환 view 에 apiKey
    // 부재 (런타임) + 평문 apiKey 와 ciphertext 둘 다 직렬화 결과에 미포함.
    // ------------------------------------------------------------------
    it("반환 view 에 평문 apiKey / ciphertext 가 절대 새어나가지 않는다 (negative 핵심 — never-read-back, ADR-0014 §3)", async () => {
      const { service, repo, cipher } = buildService();
      const dto = buildCreateDto({ apiKey: "sk-leak-plaintext" });
      cipher.encrypt.mockReturnValueOnce("CIPHER-leak-envelope");
      repo.create.mockResolvedValueOnce(
        buildConfigFixture({
          id: "cfg-secret",
          apiKey: "CIPHER-leak-envelope",
        }),
      );

      const result = await service.create(dto);

      expect(result).not.toHaveProperty("apiKey");
      expect(Object.keys(result)).not.toContain("apiKey");
      // 평문 + ciphertext 둘 다 직렬화 결과에 부재.
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("sk-leak-plaintext");
      expect(serialized).not.toContain("CIPHER-leak-envelope");
    });

    // ------------------------------------------------------------------
    // Error / branch (provider 무효) — isLlmProvider false → BadRequestException.
    // encrypt / repository.create 는 호출되지 않음 (단락).
    // ------------------------------------------------------------------
    it("미지원 provider 면 BadRequestException + encrypt/create 미호출 (error/branch — provider 무효)", async () => {
      const { service, repo, cipher } = buildService();
      const dto = buildCreateDto({ provider: "not-a-real-provider" });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      expect(cipher.encrypt).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------
    // Error path — encrypt throw (env 키 부재 등) → swallow 없이 propagate.
    // repository.create 는 호출되지 않음 (평문이 암호화 없이 영속되는 경로 차단).
    // ------------------------------------------------------------------
    it("encrypt 가 throw 하면 error 를 전파 + repository.create 미호출 (error path — 암호화 실패)", async () => {
      const { service, repo, cipher } = buildService();
      const dto = buildCreateDto();
      cipher.encrypt.mockImplementationOnce(() => {
        throw new Error("LLM_APIKEY_ENC_KEY 환경변수가 설정되지 않았습니다");
      });

      await expect(service.create(dto)).rejects.toThrow("LLM_APIKEY_ENC_KEY");
      // 암호화 실패 시 평문이 DB 에 영속되지 않음.
      expect(repo.create).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------
    // Error path — repository.create reject (DB 장애) → swallow 없이 propagate.
    // encrypt 는 정상 (ciphertext 생성) 후 영속 단계 실패 케이스.
    // ------------------------------------------------------------------
    it("repository.create 가 reject 하면 error 를 그대로 전파한다 (error path — DB 장애)", async () => {
      const { service, repo, cipher } = buildService();
      const dto = buildCreateDto();
      cipher.encrypt.mockReturnValueOnce("CIPHER-ok");
      repo.create.mockRejectedValueOnce(new Error("db-down"));

      await expect(service.create(dto)).rejects.toThrow("db-down");
      // encrypt 는 정상 호출됐음 (영속 단계에서 실패).
      expect(cipher.encrypt).toHaveBeenCalledTimes(1);
    });
  });
});
