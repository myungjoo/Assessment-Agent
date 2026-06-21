// LlmProviderConfigResolver spec — T-0568 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// LlmProviderConfigService spec 의 repository Jest mock 패턴 1:1 mirror.
//
// 본 spec 은 LlmProviderConfigRepository 를 Jest mock (`jest.fn()`) 으로 대체하여
// PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - happy: length === 1 → 그 row 의 modelId 반환 (ADR-0048 §Decision 2 (a)).
//   - error path (b): length === 0 → 한국어 fail-fast `Error` (운영자 설정 누락).
//   - error path (c): length >= 2 → 한국어 fail-fast `Error` (다중-row 운용 — 후속 ADR).
//   - branch (formats): length === 1 의 modelId 가 빈 문자열 / whitespace-only /
//     non-string (number / null / undefined / object) 인 경우 `TypeError` fail-fast.
//   - negative cases: repository.findMany reject (DB 장애) 를 swallow 하지 않고 propagate.
import type { LlmProviderConfig } from "@prisma/client";

import { LlmProviderConfigResolver } from "./llm-provider-config-resolver.service";

// LlmProviderConfig fixture — schema 의 7 컬럼을 모두 채운 default row. apiKey 는
// secret 이라 fixture 에 평문값을 두지만 resolver 는 modelId 만 읽으므로 view 로
// 노출되지 않는다 (LlmProviderConfigService.findAll 의 redaction 과 무관 — resolver
// 는 view 변환 없이 raw row 접근).
function buildConfigFixture(
  overrides: Partial<LlmProviderConfig> = {},
): LlmProviderConfig {
  return {
    id: "cfg-default",
    provider: "openai",
    endpointUrl: "https://api.example.test",
    apiKey: "sk-irrelevant-for-resolver",
    modelId: "gpt-test",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// resolver / repository mock factory — 각 test 마다 새 instance 를 만들어 호출
// 카운터가 격리되도록 한다. resolver 가 사용하는 findMany 메서드 1 개만 mock 정의.
function buildResolver(): {
  resolver: LlmProviderConfigResolver;
  repo: { findMany: jest.Mock };
} {
  const repo = {
    findMany: jest.fn(),
  };
  const resolver = new LlmProviderConfigResolver(repo as never);
  return { resolver, repo };
}

describe("LlmProviderConfigResolver", () => {
  describe("resolveDefaultModelId() — ADR-0048 §Decision 2 의 3 분기 (단일-row + fail-fast)", () => {
    // ------------------------------------------------------------------
    // Happy path / (a) length === 1 — 그 row 의 modelId 를 trim 후 반환.
    // ------------------------------------------------------------------
    it("단일-row 일 때 그 row 의 modelId 를 반환한다 (happy — (a) length === 1)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ modelId: "gpt-4o-mini" }),
      ]);

      const result = await resolver.resolveDefaultModelId();

      expect(repo.findMany).toHaveBeenCalledTimes(1);
      expect(result).toBe("gpt-4o-mini");
    });

    // boundary — modelId 앞뒤 공백은 trim 후 반환 (buildFillRunScoringOptions 의
    // normalizeModelId 와 동일한 trim 동작 mirror — defaultModelId invariant 유지).
    it("단일-row 의 modelId 앞뒤 공백은 trim 후 반환한다 (happy — trim 정규화)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ modelId: "  gpt-4o-mini  " }),
      ]);

      const result = await resolver.resolveDefaultModelId();

      expect(result).toBe("gpt-4o-mini");
    });

    // ------------------------------------------------------------------
    // Error path (b) length === 0 — 한국어 fail-fast Error (운영자 설정 누락).
    // ------------------------------------------------------------------
    it("row 0 일 때 한국어 메시지로 throw 한다 (error — (b) length === 0, 운영자 설정 누락)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([]);

      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /LLM provider 가 설정되지 않았다/,
      );
      expect(repo.findMany).toHaveBeenCalledTimes(1);
    });

    // ------------------------------------------------------------------
    // Error path (c) length >= 2 — 한국어 fail-fast Error (다중-row 운용 — 후속 ADR).
    // 분기 cover: 정확히 2 row.
    // ------------------------------------------------------------------
    it("row 가 정확히 2 일 때 한국어 메시지로 throw 한다 (error — (c) length === 2, 다중-row 운용)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ id: "cfg-1", provider: "openai" }),
        buildConfigFixture({ id: "cfg-2", provider: "anthropic" }),
      ]);

      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /다중-row 운용/,
      );
    });

    // 분기 cover: 3 row (>= 2 의 또 다른 분기 — boundary 가 아닌 일반 case).
    it("row 가 3 일 때도 한국어 메시지로 throw 한다 (error — (c) length === 3, 다중-row 운용)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ id: "cfg-1" }),
        buildConfigFixture({ id: "cfg-2" }),
        buildConfigFixture({ id: "cfg-3" }),
      ]);

      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /row 수=3/,
      );
    });

    // ------------------------------------------------------------------
    // Negative case (format) — 단일-row 의 modelId 가 빈 문자열일 때 TypeError.
    // ------------------------------------------------------------------
    it("단일-row 의 modelId 가 빈 문자열이면 TypeError 로 throw 한다 (negative — empty string)", async () => {
      const { resolver, repo } = buildResolver();
      // 두 번의 호출 (instanceof + message regex) 을 동일 fixture 로 cover 하기 위해
      // mockResolvedValue (영구) 로 둔다 — mockResolvedValueOnce 는 첫 호출 후 소진.
      repo.findMany.mockResolvedValue([buildConfigFixture({ modelId: "" })]);

      await expect(resolver.resolveDefaultModelId()).rejects.toBeInstanceOf(
        TypeError,
      );
      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /비어있다/,
      );
    });

    // Negative — whitespace-only modelId 도 빈 값으로 수렴 → TypeError.
    it("단일-row 의 modelId 가 whitespace-only 면 TypeError 로 throw 한다 (negative — whitespace)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ modelId: "   " }),
      ]);

      await expect(resolver.resolveDefaultModelId()).rejects.toBeInstanceOf(
        TypeError,
      );
    });

    // Negative (type mismatch) — modelId 가 number 일 때 TypeError (silent coercion 차단).
    it("단일-row 의 modelId 가 number type 이면 TypeError 로 throw 한다 (negative — type mismatch number)", async () => {
      const { resolver, repo } = buildResolver();
      // Prisma type 은 modelId: string 이지만 runtime 에서 비-string 이 흘러올 가능성
      // (custom client / migration 잔여 / direct SQL insert 등) 을 spec 으로 cover.
      // type assertion 으로 LlmProviderConfig 시뮬레이션. 두 번 호출하므로 영구 mock.
      repo.findMany.mockResolvedValue([
        buildConfigFixture({ modelId: 12345 as unknown as string }),
      ]);

      await expect(resolver.resolveDefaultModelId()).rejects.toBeInstanceOf(
        TypeError,
      );
      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /string 이어야 한다/,
      );
    });

    // Negative (type mismatch) — modelId 가 null 일 때 TypeError.
    it("단일-row 의 modelId 가 null 이면 TypeError 로 throw 한다 (negative — type mismatch null)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ modelId: null as unknown as string }),
      ]);

      await expect(resolver.resolveDefaultModelId()).rejects.toBeInstanceOf(
        TypeError,
      );
    });

    // Negative (type mismatch) — modelId 가 undefined 일 때 TypeError.
    it("단일-row 의 modelId 가 undefined 이면 TypeError 로 throw 한다 (negative — type mismatch undefined)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ modelId: undefined as unknown as string }),
      ]);

      await expect(resolver.resolveDefaultModelId()).rejects.toBeInstanceOf(
        TypeError,
      );
    });

    // ------------------------------------------------------------------
    // Negative (dependency failure) — repository.findMany 가 reject 하면
    // resolver 는 swallow 없이 그대로 propagate (DB 장애 등).
    // ------------------------------------------------------------------
    it("repository.findMany 가 reject 하면 그대로 propagate 한다 (negative — DB 장애 의존성 실패)", async () => {
      const { resolver, repo } = buildResolver();
      const dbError = new Error("Prisma connection refused");
      repo.findMany.mockRejectedValueOnce(dbError);

      await expect(resolver.resolveDefaultModelId()).rejects.toBe(dbError);
      expect(repo.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
