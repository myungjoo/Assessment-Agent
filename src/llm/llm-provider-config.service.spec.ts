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
import type { LlmProviderConfig } from "@prisma/client";

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

// repository mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. service 가 사용하는 findMany 메서드만 mock 으로 정의.
function buildService(): {
  service: LlmProviderConfigService;
  repo: { findMany: jest.Mock };
} {
  const repo = {
    findMany: jest.fn(),
  };
  // service 는 repository 의 findMany 만 호출하므로 부분 mock 으로 충분.
  const service = new LlmProviderConfigService(repo as never);
  return { service, repo };
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
});
