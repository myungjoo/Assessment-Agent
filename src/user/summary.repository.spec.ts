// SummaryRepository spec — T-0113 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + raw 미저장 invariant 검증 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `summary` delegate 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다
// (contribution.repository.spec.ts 의 `buildPrismaMock` 패턴 mirror). 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2003 FK 위반 / P2025 row 부재) 가 catch 없이 그대로
//     throw 되는지.
//   - findByPerson 의 options.period 분기 (지정 vs 미지정) 정합성.
//   - findByPerson 의 where 절이 정확히 `{ personId }` 또는 `{ personId, period }` 만
//     포함 — 다른 person 의 row 누출 위험 차단.
//   - raw 미저장 (R-59) invariant — create 에 전달되는 `data` 객체의 키 집합이
//     ADR-0006 §3 의 허용 입력 컬럼 5 종으로 한정됨 (commit body / diff / 문서 본문
//     같은 수집 원천 raw 컬럼 부재). `narrative` 는 LLM 정성 결과물 (raw 인용 아님)
//     로 허용 컬럼에 포함 — 본 invariant 의 의미는 schema column 차원 강제임.
import type { Summary } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { SummaryRepository } from "./summary.repository";

// Summary fixture — 7 컬럼 (schema.prisma L285–299) 의 default row.
// 각 test 가 필요 시 override 로 personId / period / periodStart 분기 검증.
// Summary 는 Person N:1 이므로 FK 컬럼이 personId (Contribution 의 assessmentId 자리).
function buildSummaryFixture(overrides: Partial<Summary> = {}): Summary {
  return {
    id: "cuid-default",
    personId: "person-1",
    period: "weekly",
    periodStart: new Date("2026-05-25T00:00:00.000Z"),
    // narrative 는 LLM 정성 요약 평가문 (LLM 생성 결과물 — raw 본문 인용 아님).
    narrative: "주간 기여도 정상 수준, 난이도 medium 작업 다수 처리",
    // Decimal 컬럼 — Prisma client runtime 의 Decimal type 또는 number / string
    // 입력을 모두 수용. mock 단에서는 검증 단순화를 위해 number 사용.
    metricScore: 0.42 as unknown as Summary["metricScore"],
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService 의 `summary` delegate mock factory — 각 test 마다 새 instance 를
// 만들어 호출 카운터가 격리되도록 한다 (contribution.repository.spec.ts mirror).
function buildPrismaMock(): {
  prisma: PrismaService;
  summaryMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
} {
  const summaryMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  // PrismaService 는 `summary` delegate 만 사용 — 다른 모델은 정의 불필요.
  const prisma = { summary: summaryMock } as unknown as PrismaService;
  return { prisma, summaryMock };
}

describe("SummaryRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error (P2003 FK 위반) + raw 미저장 invariant
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 정상 input 으로 row 생성, fixture 그대로 반환.
    it("input 을 PrismaService.summary.create 의 data 로 전달한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      const fixture = buildSummaryFixture({ id: "cuid-new" });
      summaryMock.create.mockResolvedValueOnce(fixture);

      const repo = new SummaryRepository(prisma);
      const input = {
        personId: "person-1",
        period: "weekly",
        periodStart: new Date("2026-05-25T00:00:00.000Z"),
        narrative: "주간 기여 정상",
        metricScore: 0.42,
      };
      const result = await repo.create(input);

      expect(summaryMock.create).toHaveBeenCalledTimes(1);
      expect(summaryMock.create).toHaveBeenCalledWith({ data: input });
      expect(result).toBe(fixture);
    });

    // Error path: personId FK 위반 (Person row 부재) 시 Prisma P2003 그대로
    // propagate — 호출자 (SummaryService) 책임.
    it("FK 위반 시 Prisma P2003 error 를 그대로 throw 한다 (personId 부재)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      const p2003 = Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
      });
      summaryMock.create.mockRejectedValueOnce(p2003);

      const repo = new SummaryRepository(prisma);
      await expect(
        repo.create({
          personId: "missing-person",
          period: "daily",
          periodStart: new Date("2026-05-31T00:00:00.000Z"),
          narrative: "일간 요약",
          metricScore: 0.1,
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });

    // Negative (raw 미저장 invariant — R-59 / REQ-032 / ADR-0006 §4):
    // create 에 전달되는 `data` 객체의 키 집합이 ADR-0006 §3 의 허용 입력 컬럼 5 종
    // (personId / period / periodStart / narrative / metricScore) 으로 한정됨을 검증.
    // commit body / diff / 문서 본문 등 수집 원천 raw 컬럼 키가 포함되지 않음을 assert
    // — schema 강제 (컬럼 부재) 의 runtime guard 박제. narrative 는 LLM 정성 결과물
    // (raw 인용 아님) 로 허용 컬럼에 포함 — 본 invariant 는 schema column 차원 강제임.
    it("create 의 data 키 집합이 ADR-0006 §3 의 5 허용 컬럼으로 한정된다 (raw 미저장 R-59)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.create.mockResolvedValueOnce(buildSummaryFixture());

      const repo = new SummaryRepository(prisma);
      await repo.create({
        personId: "person-2",
        period: "monthly",
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        narrative: "월간 요약 평가문",
        metricScore: "1.25",
      });

      // 호출 인자 검사 — data 객체의 key set 검증.
      const callArgs = summaryMock.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs).toBeDefined();
      const dataKeys = Object.keys(callArgs.data).sort();
      const allowed = [
        "personId",
        "period",
        "periodStart",
        "narrative",
        "metricScore",
      ].sort();
      expect(dataKeys).toEqual(allowed);

      // raw 본문 후보 키 집합 — 본 키들 중 어느 하나라도 data 에 포함되면 R-59 위반.
      // commitBody / diff / documentBody 등 수집 원천 본문 컬럼은 schema 자체에
      // 부재이고 input shape 도 5 키로 한정되므로 runtime 에도 절대 포함되지 않아야
      // 한다. (narrative 는 LLM 결과물로 raw 아님 — forbidden 목록에 미포함.)
      const forbiddenRawKeys = [
        "rawBody",
        "body",
        "content",
        "diff",
        "commitBody",
        "documentBody",
        "rawQuote",
        "raw",
        "message",
      ];
      for (const forbidden of forbiddenRawKeys) {
        expect(callArgs.data).not.toHaveProperty(forbidden);
      }
    });
  });

  // ------------------------------------------------------------------
  // findById — happy + negative (row 부재 → null) path
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path: row 존재 시 PrismaService.summary.findUnique 결과를 그대로 반환.
    // where 절이 정확히 `{ id }` 형태인지 검증.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      const fixture = buildSummaryFixture({ id: "abc" });
      summaryMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new SummaryRepository(prisma);
      const result = await repo.findById("abc");

      expect(summaryMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Negative (분기 a): row 부재 시 null 반환 (throw 안 함) —
    // ContributionRepository.findById mirror.
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findUnique.mockResolvedValueOnce(null);

      const repo = new SummaryRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // findByPerson — happy + branch (period 지정 vs 미지정) + error + negative
  // ------------------------------------------------------------------
  describe("findByPerson()", () => {
    // Branch 1 (options 미지정): where: { personId } + orderBy periodStart desc.
    it("options 미지정 시 where: { personId } + orderBy desc 로 findMany 를 호출한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      const fixture = [buildSummaryFixture({ id: "s-1" })];
      summaryMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new SummaryRepository(prisma);
      const result = await repo.findByPerson("person-1");

      expect(summaryMock.findMany).toHaveBeenCalledTimes(1);
      expect(summaryMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-1" },
        orderBy: { periodStart: "desc" },
      });
      expect(result).toBe(fixture);
    });

    // Branch 2 (options.period 미지정 = undefined): 위와 동일하게 personId 만.
    it("options.period 가 undefined 면 where: { personId } 만 사용한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockResolvedValueOnce([]);

      const repo = new SummaryRepository(prisma);
      await repo.findByPerson("person-2", {});

      expect(summaryMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-2" },
        orderBy: { periodStart: "desc" },
      });
    });

    // Branch 3 (options.period 지정): where 에 period 가 함께 포함.
    it("options.period 가 주어지면 where: { personId, period } 로 findMany 를 호출한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      const fixture = [
        buildSummaryFixture({ id: "s-2", period: "weekly" }),
        buildSummaryFixture({ id: "s-3", period: "weekly" }),
      ];
      summaryMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new SummaryRepository(prisma);
      const result = await repo.findByPerson("person-1", { period: "weekly" });

      expect(summaryMock.findMany).toHaveBeenCalledTimes(1);
      expect(summaryMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-1", period: "weekly" },
        orderBy: { periodStart: "desc" },
      });
      expect(result).toHaveLength(2);
    });

    // Branch (orderBy 항상 포함): period 분기 양쪽 모두에서 orderBy desc 가 박제됨을
    // 위 2/3 test 가 함께 cover — 본 test 는 명시적으로 분기 양쪽의 orderBy 동일성을
    // 한 번 더 검증.
    it("findByPerson 의 모든 분기에서 orderBy: { periodStart: 'desc' } 가 포함된다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockResolvedValue([]);

      const repo = new SummaryRepository(prisma);
      await repo.findByPerson("p-x");
      await repo.findByPerson("p-x", { period: "monthly" });

      const firstCall = summaryMock.findMany.mock.calls[0]?.[0] as {
        orderBy: unknown;
      };
      const secondCall = summaryMock.findMany.mock.calls[1]?.[0] as {
        orderBy: unknown;
      };
      expect(firstCall.orderBy).toEqual({ periodStart: "desc" });
      expect(secondCall.orderBy).toEqual({ periodStart: "desc" });
    });

    // Negative (e, 분기 미지정): where 절 shape 가 정확히 `{ personId }` 만 포함 —
    // 다른 person 의 row 누출 위험 차단. mock call 의 where 객체 key set 검증.
    it("where 절이 정확히 { personId } 만 포함하여 다른 person row 누출을 차단한다 (period 미지정)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockResolvedValueOnce([]);

      const repo = new SummaryRepository(prisma);
      await repo.findByPerson("person-strict");

      const callArgs = summaryMock.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs).toBeDefined();
      expect(Object.keys(callArgs.where).sort()).toEqual(["personId"]);
      expect(callArgs.where.personId).toBe("person-strict");
    });

    // Negative (e, 분기 지정): where 절 shape 가 정확히 `{ personId, period }` 만
    // 포함 — 다른 person 의 row 누출 차단 + period 필터 정합.
    it("where 절이 정확히 { personId, period } 만 포함한다 (period 지정)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockResolvedValueOnce([]);

      const repo = new SummaryRepository(prisma);
      await repo.findByPerson("person-strict", { period: "daily" });

      const callArgs = summaryMock.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };
      expect(callArgs).toBeDefined();
      expect(Object.keys(callArgs.where).sort()).toEqual([
        "period",
        "personId",
      ]);
      expect(callArgs.where.personId).toBe("person-strict");
      expect(callArgs.where.period).toBe("daily");
    });

    // Negative 1: 매칭 row 0 시 빈 배열 반환 (null 반환 안 함) — 분기 미지정 path.
    it("매칭 row 0 시 빈 배열을 반환한다 (null 아님, period 미지정 path)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockResolvedValueOnce([]);

      const repo = new SummaryRepository(prisma);
      const result = await repo.findByPerson("person-no-data");

      expect(result).toEqual([]);
      expect(result).not.toBeNull();
    });

    // Negative 2: 매칭 row 0 시 빈 배열 반환 — 분기 지정 path (period 분기 cover).
    it("매칭 row 0 시 빈 배열을 반환한다 (period 지정 path)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockResolvedValueOnce([]);

      const repo = new SummaryRepository(prisma);
      const result = await repo.findByPerson("person-no-data", {
        period: "monthly",
      });

      expect(result).toEqual([]);
    });

    // Error path: PrismaService 가 reject 하면 catch 없이 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new SummaryRepository(prisma);
      await expect(repo.findByPerson("person-1")).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025 row 부재) path (hard delete, REQ-041)
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: 정상 id 로 hard delete 호출 — return 값 void.
    it("id 를 where 로 PrismaService.summary.delete 를 호출한다 (hard delete)", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      summaryMock.delete.mockResolvedValueOnce(buildSummaryFixture());

      const repo = new SummaryRepository(prisma);
      const result = await repo.delete("id-1");

      expect(summaryMock.delete).toHaveBeenCalledTimes(1);
      expect(summaryMock.delete).toHaveBeenCalledWith({
        where: { id: "id-1" },
      });
      // delete 메서드는 void return — 명시적 undefined 검증.
      expect(result).toBeUndefined();
    });

    // Error path / Negative (d): row 부재 시 Prisma P2025 그대로 throw — 호출자 책임.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, summaryMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      summaryMock.delete.mockRejectedValueOnce(p2025);

      const repo = new SummaryRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });
  });
});
