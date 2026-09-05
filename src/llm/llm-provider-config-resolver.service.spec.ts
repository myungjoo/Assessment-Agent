// LlmProviderConfigResolver spec — T-0568 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// LlmProviderConfigService spec 의 repository Jest mock 패턴 1:1 mirror.
//
// 본 spec 은 LlmProviderConfigRepository 를 Jest mock (`jest.fn()`) 으로 대체하여
// PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - happy (0): 슬롯 존재 → row 수와 무관하게 그 config 의 modelId (ADR-0062 §Decision 4).
//   - happy (a): 슬롯 부재 + length === 1 → 그 row 의 modelId (ADR-0048 하위 호환).
//   - error path (b): 슬롯 부재 + length === 0 → 한국어 fail-fast `Error` (설정 누락).
//   - error path (c): 슬롯 부재 + length >= 2 → 한국어 **행동 지시형** fail-fast `Error`.
//   - branch (formats): length === 1 의 modelId 가 빈 문자열 / whitespace-only /
//     non-string (number / null / undefined / object) 인 경우 `TypeError` fail-fast.
//   - negative cases: repository.findMany reject (DB 장애) 를 swallow 하지 않고 propagate.
import type { LlmDefaultProvider, LlmProviderConfig } from "@prisma/client";

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

// LlmDefaultProvider 슬롯 fixture (ADR-0062 §Decision 2 의 고정 id 1 row).
function buildSlotFixture(llmProviderConfigId: string): LlmDefaultProvider {
  return {
    id: "default",
    llmProviderConfigId,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  };
}

// resolver / repository mock factory — 각 test 마다 새 instance 를 만들어 호출
// 카운터가 격리되도록 한다. resolver 가 사용하는 findMany / findById (config) +
// findSlot (기본 provider 슬롯) 을 mock 정의하며, findSlot 의 기본값은 **슬롯 부재**
// (= 명시 선택 없음) 라 기존 row 수 fallback test 가 그대로 성립한다.
function buildResolver(): {
  resolver: LlmProviderConfigResolver;
  repo: { findMany: jest.Mock; findById: jest.Mock };
  defaultRepo: { findSlot: jest.Mock };
} {
  const repo = {
    findMany: jest.fn(),
    findById: jest.fn(),
  };
  const defaultRepo = {
    findSlot: jest.fn().mockResolvedValue(null),
  };
  const resolver = new LlmProviderConfigResolver(
    repo as never,
    defaultRepo as never,
  );
  return { resolver, repo, defaultRepo };
}

describe("LlmProviderConfigResolver", () => {
  describe("resolveDefaultModelId() — ADR-0062 §Decision 4 의 4 분기 (슬롯 최우선 + row 수 fallback)", () => {
    // ==================================================================
    // (0) 명시 슬롯 존재 — row 수와 무관하게 슬롯이 이긴다 (ADR-0062 제약 1).
    // ==================================================================
    it("슬롯이 있으면 row 가 3 개여도 슬롯이 가리키는 config 의 modelId 를 반환한다 (happy — (0) hit, 회귀 방지)", async () => {
      const { resolver, repo, defaultRepo } = buildResolver();
      defaultRepo.findSlot.mockResolvedValueOnce(buildSlotFixture("cfg-2"));
      repo.findById.mockResolvedValueOnce(
        buildConfigFixture({ id: "cfg-2", modelId: "gpt-chosen" }),
      );
      // row 가 3 개여도 findMany 는 아예 호출되지 않아야 한다 — 이 assert 가
      // "row >= 2 fail-fast 가 명시 선택으로 해소된다" 는 회귀 방지 그 자체다.
      repo.findMany.mockResolvedValue([
        buildConfigFixture({ id: "cfg-1" }),
        buildConfigFixture({ id: "cfg-2" }),
        buildConfigFixture({ id: "cfg-3" }),
      ]);

      const result = await resolver.resolveDefaultModelId();

      expect(result).toBe("gpt-chosen");
      expect(defaultRepo.findSlot).toHaveBeenCalledTimes(1);
      expect(repo.findById).toHaveBeenCalledWith("cfg-2");
      expect(repo.findMany).not.toHaveBeenCalled();
    });

    // (0) negative — 형식 검증은 명시 선택 row 에도 동일 적용 (§Decision 4 말미).
    it("슬롯 config 의 modelId 가 빈 문자열이면 TypeError 로 throw 한다 (negative — (0) 형식 위반)", async () => {
      const { resolver, repo, defaultRepo } = buildResolver();
      defaultRepo.findSlot.mockResolvedValue(buildSlotFixture("cfg-2"));
      repo.findById.mockResolvedValue(buildConfigFixture({ modelId: "" }));

      await expect(resolver.resolveDefaultModelId()).rejects.toBeInstanceOf(
        TypeError,
      );
      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /비어있다/,
      );
    });

    // (0) negative — 슬롯은 있는데 FK 대상 row 가 없는 깨진 상태 (정상 경로로는
    // 불가). silent fallback 금지 → 한국어 fail-fast.
    it("슬롯이 가리키는 config 가 없으면 한국어 메시지로 throw 한다 (negative — (0) 깨진 FK, silent fallback 금지)", async () => {
      const { resolver, repo, defaultRepo } = buildResolver();
      defaultRepo.findSlot.mockResolvedValueOnce(buildSlotFixture("cfg-gone"));
      repo.findById.mockResolvedValueOnce(null);

      await expect(resolver.resolveDefaultModelId()).rejects.toThrow(
        /슬롯이 가리키는 LlmProviderConfig 가 없다/,
      );
      // fallback 으로 흘러가 임의 row 를 고르지 않음 (reproducibility 보호).
      expect(repo.findMany).not.toHaveBeenCalled();
    });

    // (0) negative (의존성 실패) — findSlot reject 는 swallow 없이 propagate.
    it("findSlot 이 reject 하면 그대로 propagate 한다 (negative — 슬롯 조회 DB 장애)", async () => {
      const { resolver, repo, defaultRepo } = buildResolver();
      const dbError = new Error("Prisma slot read failed");
      defaultRepo.findSlot.mockRejectedValueOnce(dbError);

      await expect(resolver.resolveDefaultModelId()).rejects.toBe(dbError);
      expect(repo.findMany).not.toHaveBeenCalled();
    });

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
    // Error path (c) 슬롯 부재 + length >= 2 — 한국어 **행동 지시형** fail-fast.
    // 분기 cover: 정확히 2 row + 문구 검증 (ADR-0062 §Decision 4 (4)).
    // ------------------------------------------------------------------
    it("슬롯 부재 + row 가 정확히 2 일 때 행동 지시형 한국어 메시지로 throw 한다 (error — (c) length === 2)", async () => {
      const { resolver, repo } = buildResolver();
      repo.findMany.mockResolvedValueOnce([
        buildConfigFixture({ id: "cfg-1", provider: "openai" }),
        buildConfigFixture({ id: "cfg-2", provider: "anthropic" }),
      ]);

      const error: unknown = await resolver
        .resolveDefaultModelId()
        .catch((caught: unknown) => caught);

      // 행동 지시형 문구로 교체되고, ADR-0062 로 해소된 구 문구는 사라졌다.
      expect((error as Error).message).toContain(
        "Admin UI 의 LLM provider 설정에서 기본 provider 를 지정하라",
      );
      expect((error as Error).message).not.toContain("후속 ADR");
    });

    // 분기 cover: 3 row (>= 2 의 또 다른 분기 — boundary 가 아닌 일반 case).
    it("슬롯 부재 + row 가 3 일 때도 한국어 메시지로 throw 한다 (error — (c) length === 3)", async () => {
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
