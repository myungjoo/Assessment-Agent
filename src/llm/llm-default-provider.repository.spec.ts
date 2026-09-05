// LlmDefaultProviderRepository spec — T-1863 acceptance (R-112: happy / error /
// branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// LlmProviderConfigRepository spec (src/llm/llm-provider-config.repository.spec.ts)
// 패턴 mirror — PrismaService 의 `llmDefaultProvider` delegate 를 Jest mock 으로
// 대체해 PostgreSQL container 없이 isolated 하게 실행된다.
//
// 검증 포인트 (ADR-0062 §Decision 2·3 계약):
//   - findSlot / setSlot 이 고정 슬롯 id (DEFAULT_SLOT_ID) 로만 delegate 를 호출하는지.
//   - setSlot 이 **upsert 단일 statement** 이며 create / update 양쪽 인자를 모두
//     올바로 구성하는지 ($transaction 2 write 가 아님 — 원자성 축 회귀 방지).
//   - Prisma error (P2003 FK 위반 / P2025 / DB 장애 reject) 가 swallow 없이 propagate.
//   - 슬롯 부재 시 null 반환 (분기 cover — "명시 선택 없음").
//   - negative: 빈 문자열 id 도 raw forward (검증은 service 책임) · 동일 id 재지정이
//     멱등 · 슬롯 row 를 가공 (redact / 정규화) 하지 않고 그대로 반환.
import type { LlmDefaultProvider } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import {
  DEFAULT_SLOT_ID,
  LlmDefaultProviderRepository,
} from "./llm-default-provider.repository";

// LlmDefaultProvider fixture — schema.prisma 의 4 컬럼을 모두 채운 슬롯 row.
function buildSlotFixture(
  overrides: Partial<LlmDefaultProvider> = {},
): LlmDefaultProvider {
  return {
    id: DEFAULT_SLOT_ID,
    llmProviderConfigId: "llm-config-a",
    createdAt: new Date("2026-09-03T00:00:00.000Z"),
    updatedAt: new Date("2026-09-03T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `llmDefaultProvider` delegate 의 2 메서드만 사용하므로 그것만 정의.
// $transaction 은 "쓰지 않는다" 를 단언하기 위해서만 mock 으로 세워 둔다.
function buildPrismaMock(): {
  prisma: PrismaService;
  slotMock: { findUnique: jest.Mock; upsert: jest.Mock };
  transactionMock: jest.Mock;
} {
  const slotMock = { findUnique: jest.fn(), upsert: jest.fn() };
  const transactionMock = jest.fn();
  const prisma = {
    llmDefaultProvider: slotMock,
    $transaction: transactionMock,
  } as unknown as PrismaService;
  return { prisma, slotMock, transactionMock };
}

describe("LlmDefaultProviderRepository", () => {
  // ------------------------------------------------------------------
  // 상수 계약 — 고정 슬롯 id (ADR-0062 §Decision 2)
  // ------------------------------------------------------------------
  describe("DEFAULT_SLOT_ID", () => {
    it("고정 슬롯 PK 리터럴이 schema 의 default 값과 같다", () => {
      expect(DEFAULT_SLOT_ID).toBe("default");
    });
  });

  // ------------------------------------------------------------------
  // findSlot — happy + branch + error + negative
  // ------------------------------------------------------------------
  describe("findSlot()", () => {
    // Happy path: 슬롯이 존재하면 그 row 를 그대로 반환.
    it("고정 슬롯 id 로 findUnique 를 호출하고 슬롯 row 를 그대로 반환한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const fixture = buildSlotFixture();
      slotMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new LlmDefaultProviderRepository(prisma);
      const result = await repo.findSlot();

      expect(slotMock.findUnique).toHaveBeenCalledTimes(1);
      expect(slotMock.findUnique).toHaveBeenCalledWith({
        where: { id: DEFAULT_SLOT_ID },
      });
      // 동일 참조 반환 — 본 layer 는 가공 / redact / 정규화를 하지 않는다.
      expect(result).toBe(fixture);
    });

    // 분기 cover: 슬롯 부재 = "명시 선택 없음" → null (resolver 하위 호환 분기 진입 조건).
    it("슬롯이 없으면 null 을 반환한다 (명시 선택 없음 분기)", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      slotMock.findUnique.mockResolvedValueOnce(null);

      const repo = new LlmDefaultProviderRepository(prisma);

      await expect(repo.findSlot()).resolves.toBeNull();
    });

    // Error path: PrismaService reject (DB 장애 등) 를 swallow 없이 propagate.
    it("PrismaService 가 reject 하면 그대로 propagate 한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const dbError = new Error("DB 연결이 끊겼습니다");
      slotMock.findUnique.mockRejectedValueOnce(dbError);

      const repo = new LlmDefaultProviderRepository(prisma);

      await expect(repo.findSlot()).rejects.toBe(dbError);
    });

    // Negative: 잉여 row (id 가 "default" 가 아닌 row) 가 DB 에 있어도 읽기 경로는
    // 고정 id 단건 조회뿐이라 무해하게 무시된다 (ADR-0062 fail-safe 비대칭 회귀 방지).
    it("where 인자가 언제나 고정 슬롯 id 하나뿐이다 (잉여 row 무시)", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      slotMock.findUnique.mockResolvedValueOnce(null);

      const repo = new LlmDefaultProviderRepository(prisma);
      await repo.findSlot();

      const arg = slotMock.findUnique.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(Object.keys(arg)).toEqual(["where"]);
      expect(Object.keys(arg.where)).toEqual(["id"]);
      expect(arg.where.id).toBe(DEFAULT_SLOT_ID);
    });
  });

  // ------------------------------------------------------------------
  // setSlot — happy + branch + error + negative
  // ------------------------------------------------------------------
  describe("setSlot()", () => {
    // Happy path: upsert 반환 row 를 그대로 propagate.
    it("upsert 결과 슬롯 row 를 그대로 반환한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const fixture = buildSlotFixture({ llmProviderConfigId: "llm-config-b" });
      slotMock.upsert.mockResolvedValueOnce(fixture);

      const repo = new LlmDefaultProviderRepository(prisma);
      const result = await repo.setSlot("llm-config-b");

      expect(slotMock.upsert).toHaveBeenCalledTimes(1);
      expect(result).toBe(fixture);
    });

    // 분기 cover: upsert 의 create / update 양쪽 인자 (ADR-0062 §Decision 2 —
    // 슬롯 최초 생성 경로와 교체 경로가 한 statement 안에 모두 표현돼야 한다).
    it("upsert 의 where / create / update 3 인자를 모두 올바로 구성한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      slotMock.upsert.mockResolvedValueOnce(buildSlotFixture());

      const repo = new LlmDefaultProviderRepository(prisma);
      await repo.setSlot("llm-config-c");

      expect(slotMock.upsert).toHaveBeenCalledWith({
        where: { id: DEFAULT_SLOT_ID },
        create: { id: DEFAULT_SLOT_ID, llmProviderConfigId: "llm-config-c" },
        update: { llmProviderConfigId: "llm-config-c" },
      });
    });

    // 원자성 회귀 방지: 교체가 단일 statement 여야 한다 ($transaction 2 write 금지 —
    // ADR-0062 §Alternatives B 미채택 근거의 핵심).
    it("$transaction 을 쓰지 않고 upsert 단일 statement 로 교체한다", async () => {
      const { prisma, slotMock, transactionMock } = buildPrismaMock();
      slotMock.upsert.mockResolvedValueOnce(buildSlotFixture());

      const repo = new LlmDefaultProviderRepository(prisma);
      await repo.setSlot("llm-config-d");

      expect(transactionMock).not.toHaveBeenCalled();
      expect(slotMock.upsert).toHaveBeenCalledTimes(1);
    });

    // Error path 1: 존재하지 않는 config 를 가리키면 FK 위반 P2003 propagate
    // (호출자가 404 변환 — ADR-0062 §Decision 3).
    it("존재하지 않는 llmProviderConfigId 의 P2003 을 catch 없이 propagate 한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const fkError = Object.assign(
        new Error("Foreign key constraint failed"),
        {
          code: "P2003",
        },
      );
      slotMock.upsert.mockRejectedValueOnce(fkError);

      const repo = new LlmDefaultProviderRepository(prisma);

      await expect(repo.setSlot("llm-config-missing")).rejects.toBe(fkError);
    });

    // Error path 2: P2025 (record not found) 도 동일하게 propagate.
    it("P2025 를 catch 없이 propagate 한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const notFound = Object.assign(new Error("Record not found"), {
        code: "P2025",
      });
      slotMock.upsert.mockRejectedValueOnce(notFound);

      const repo = new LlmDefaultProviderRepository(prisma);

      await expect(repo.setSlot("llm-config-x")).rejects.toMatchObject({
        code: "P2025",
      });
    });

    // Error path 3: PrismaService reject (DB 장애) propagate.
    it("PrismaService 가 reject 하면 그대로 propagate 한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const dbError = new Error("DB 연결이 끊겼습니다");
      slotMock.upsert.mockRejectedValueOnce(dbError);

      const repo = new LlmDefaultProviderRepository(prisma);

      await expect(repo.setSlot("llm-config-e")).rejects.toBe(dbError);
    });

    // Negative 1: 빈 문자열 id 도 검증 없이 raw forward (검증은 DTO / service 책임).
    it("빈 문자열 id 도 검증 없이 그대로 delegate 에 전달한다", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      slotMock.upsert.mockResolvedValueOnce(
        buildSlotFixture({ llmProviderConfigId: "" }),
      );

      const repo = new LlmDefaultProviderRepository(prisma);
      await repo.setSlot("");

      expect(slotMock.upsert).toHaveBeenCalledWith({
        where: { id: DEFAULT_SLOT_ID },
        create: { id: DEFAULT_SLOT_ID, llmProviderConfigId: "" },
        update: { llmProviderConfigId: "" },
      });
    });

    // Negative 2: 동일 id 재지정이 멱등 — 두 번째 호출도 성공하고 인자가 동일하다
    // (PUT 시멘틱 정합, ADR-0062 §Decision 3).
    it("동일 id 재지정이 멱등이다 (두 번째 호출도 성공)", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const fixture = buildSlotFixture({ llmProviderConfigId: "llm-config-f" });
      slotMock.upsert.mockResolvedValue(fixture);

      const repo = new LlmDefaultProviderRepository(prisma);
      const first = await repo.setSlot("llm-config-f");
      const second = await repo.setSlot("llm-config-f");

      expect(first).toBe(fixture);
      expect(second).toBe(fixture);
      expect(slotMock.upsert).toHaveBeenCalledTimes(2);
      expect(slotMock.upsert.mock.calls[0]).toEqual(
        slotMock.upsert.mock.calls[1],
      );
    });

    // Negative 3: 반환 row 를 가공하지 않는다 — 후속 layer 가 슬롯이 가리키는 config
    // 를 읽을 때의 apiKey redact 는 service 책임 (ADR-0014 §1 never-read-back).
    // 본 layer 가 임의로 필드를 지우거나 더하면 이 test 가 fail 한다.
    it("delegate 가 돌려준 row 를 가공 없이 그대로 반환한다 (redact 는 service 책임)", async () => {
      const { prisma, slotMock } = buildPrismaMock();
      const raw = buildSlotFixture({ id: "잉여-슬롯" });
      slotMock.upsert.mockResolvedValueOnce(raw);

      const repo = new LlmDefaultProviderRepository(prisma);
      const result = await repo.setSlot("llm-config-g");

      expect(result).toBe(raw);
      expect(Object.keys(result)).toEqual([
        "id",
        "llmProviderConfigId",
        "createdAt",
        "updatedAt",
      ]);
    });
  });
});
