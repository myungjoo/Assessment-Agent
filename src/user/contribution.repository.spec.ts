// ContributionRepository spec — T-0112 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + raw 미저장 invariant 검증 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `contribution` delegate 를 Jest mock (`jest.fn()`)
// 으로 대체하여 PostgreSQL container 없이 isolated 하게 실행된다
// (assessment.repository.spec.ts 의 `buildPrismaMock` 패턴 mirror). 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2003 FK 위반 / P2025 row 부재) 가 catch 없이 그대로
//     throw 되는지.
//   - findByAssessment 의 row 0 vs row N (≥2) 분기 정합성.
//   - findByAssessment 의 where 절이 정확히 `{ assessmentId }` 만 포함 — 다른
//     assessment 의 row 누출 위험 차단.
//   - raw 미저장 (R-59) invariant — create 에 전달되는 `data` 객체의 키 집합이
//     ADR-0006 §2 의 허용 입력 컬럼 7 종으로 한정됨 (raw body / diff / content 부재).
import type { Contribution } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { ContributionRepository } from "./contribution.repository";

// Contribution fixture — 9 컬럼 (schema.prisma L259–273) 의 default row.
// 각 test 가 필요 시 override 로 assessmentId / sourceType / sourceUrl /
// sourceRef 분기 검증.
function buildContributionFixture(
  overrides: Partial<Contribution> = {},
): Contribution {
  return {
    id: "cuid-default",
    assessmentId: "assessment-1",
    sourceType: "commit",
    sourceUrl: "https://github.com/owner/repo/commit/abc1234",
    sourceRef: "abc1234567890abcdef1234567890abcdef1234",
    difficulty: "medium",
    // Decimal 컬럼 — Prisma client runtime 의 Decimal type 또는 number / string
    // 입력을 모두 수용. mock 단에서는 검증 단순화를 위해 number 사용.
    contributionScore: 0.3 as unknown as Contribution["contributionScore"],
    volume: 42,
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService 의 `contribution` delegate mock factory — 각 test 마다 새
// instance 를 만들어 호출 카운터가 격리되도록 한다 (assessment.repository.spec.ts
// mirror).
function buildPrismaMock(): {
  prisma: PrismaService;
  contributionMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
} {
  const contributionMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  // PrismaService 는 `contribution` delegate 만 사용 — 다른 모델은 정의 불필요.
  const prisma = {
    contribution: contributionMock,
  } as unknown as PrismaService;
  return { prisma, contributionMock };
}

describe("ContributionRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error (P2003 FK 위반) + raw 미저장 invariant
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 정상 input 으로 row 생성, fixture 그대로 반환.
    it("input 을 PrismaService.contribution.create 의 data 로 전달한다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      const fixture = buildContributionFixture({ id: "cuid-new" });
      contributionMock.create.mockResolvedValueOnce(fixture);

      const repo = new ContributionRepository(prisma);
      const input = {
        assessmentId: "assessment-1",
        sourceType: "commit",
        sourceUrl: "https://github.com/owner/repo/commit/abc1234",
        sourceRef: "abc1234567890abcdef1234567890abcdef1234",
        difficulty: "medium",
        contributionScore: 0.3,
        volume: 42,
      };
      const result = await repo.create(input);

      expect(contributionMock.create).toHaveBeenCalledTimes(1);
      expect(contributionMock.create).toHaveBeenCalledWith({ data: input });
      expect(result).toBe(fixture);
    });

    // Error path: assessmentId FK 위반 (Assessment row 부재) 시 Prisma P2003
    // 그대로 propagate — 호출자 (ContributionService) 책임.
    it("FK 위반 시 Prisma P2003 error 를 그대로 throw 한다 (assessmentId 부재)", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      const p2003 = Object.assign(new Error("Foreign key constraint failed"), {
        code: "P2003",
      });
      contributionMock.create.mockRejectedValueOnce(p2003);

      const repo = new ContributionRepository(prisma);
      await expect(
        repo.create({
          assessmentId: "missing-assessment",
          sourceType: "pr",
          sourceUrl: "https://github.com/owner/repo/pull/1",
          sourceRef: "1",
          difficulty: "easy",
          contributionScore: 0.1,
          volume: 3,
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });

    // Negative (raw 미저장 invariant — R-59 / REQ-032 / ADR-0006 §4):
    // create 에 전달되는 `data` 객체의 키 집합이 ADR-0006 §2 의 허용 입력 컬럼 7 종
    // (assessmentId / sourceType / sourceUrl / sourceRef / difficulty /
    // contributionScore / volume) 으로 한정됨을 검증. raw body / diff / content /
    // commitBody / documentBody / message 등 본문 컬럼 키가 포함되지 않음을 assert
    // — schema 강제 (컬럼 부재) 의 runtime guard 박제. sourceUrl + sourceRef 는
    // 참조 식별자 (pointer) 일 뿐 본문 자체가 아님.
    it("create 의 data 키 집합이 ADR-0006 §2 의 7 허용 컬럼으로 한정된다 (raw 미저장 R-59)", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.create.mockResolvedValueOnce(buildContributionFixture());

      const repo = new ContributionRepository(prisma);
      await repo.create({
        assessmentId: "assessment-2",
        sourceType: "document",
        sourceUrl: "https://confluence.example.com/pages/123",
        sourceRef: "v7",
        difficulty: "hard",
        contributionScore: "1.25",
        volume: 1500,
      });

      // 호출 인자 검사 — data 객체의 key set 검증.
      const callArgs = contributionMock.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs).toBeDefined();
      const dataKeys = Object.keys(callArgs.data).sort();
      const allowed = [
        "assessmentId",
        "sourceType",
        "sourceUrl",
        "sourceRef",
        "difficulty",
        "contributionScore",
        "volume",
      ].sort();
      expect(dataKeys).toEqual(allowed);

      // raw 본문 후보 키 집합 — 본 키들 중 어느 하나라도 data 에 포함되면 R-59 위반.
      // commitBody / diff / documentBody 등 본문 컬럼은 schema 자체에 부재이고
      // input shape 도 7 키로 한정되므로 runtime 에도 절대 포함되지 않아야 한다.
      const forbiddenRawKeys = [
        "rawBody",
        "body",
        "content",
        "diff",
        "commitBody",
        "documentBody",
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
    // Happy path: row 존재 시 PrismaService.contribution.findUnique 결과를 그대로
    // 반환. where 절이 정확히 `{ id }` 형태인지 검증.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      const fixture = buildContributionFixture({ id: "abc" });
      contributionMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new ContributionRepository(prisma);
      const result = await repo.findById("abc");

      expect(contributionMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Negative (분기 b): row 부재 시 null 반환 (throw 안 함) —
    // AssessmentRepository.findById mirror.
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.findUnique.mockResolvedValueOnce(null);

      const repo = new ContributionRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // findByAssessment — happy + branch (row 0 vs row N) + error + negative
  // ------------------------------------------------------------------
  describe("findByAssessment()", () => {
    // Happy path: where: { assessmentId } + orderBy createdAt asc 로 findMany 호출.
    it("where: { assessmentId } + orderBy createdAt asc 로 findMany 를 호출한다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      const fixture = [
        buildContributionFixture({ id: "c-1" }),
        buildContributionFixture({ id: "c-2" }),
      ];
      contributionMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new ContributionRepository(prisma);
      const result = await repo.findByAssessment("assessment-1");

      expect(contributionMock.findMany).toHaveBeenCalledTimes(1);
      expect(contributionMock.findMany).toHaveBeenCalledWith({
        where: { assessmentId: "assessment-1" },
        orderBy: { createdAt: "asc" },
      });
      expect(result).toBe(fixture);
      expect(result).toHaveLength(2);
    });

    // Branch / Negative (e): where 절 shape 가 정확히 `{ assessmentId }` 만 포함 —
    // 다른 assessment 의 row 누출 위험 차단. mock call 의 where 객체 key set 검증.
    it("where 절이 정확히 { assessmentId } 만 포함하여 다른 assessment row 누출을 차단한다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.findMany.mockResolvedValueOnce([]);

      const repo = new ContributionRepository(prisma);
      await repo.findByAssessment("assessment-strict");

      const callArgs = contributionMock.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
        orderBy: unknown;
      };
      expect(callArgs).toBeDefined();
      // where 객체의 key set 검증 — assessmentId 외 다른 필드 (id / sourceType /
      // sourceUrl 등) 가 포함되면 잘못된 query.
      expect(Object.keys(callArgs.where).sort()).toEqual(["assessmentId"]);
      expect(callArgs.where.assessmentId).toBe("assessment-strict");
    });

    // Branch (orderBy 항상 포함): findByAssessment 의 모든 호출에서 orderBy 가
    // `{ createdAt: "asc" }` 로 박제됨 — 수집 순서 보존 (시간축 자연 순서).
    it("findByAssessment 의 모든 호출에서 orderBy: { createdAt: 'asc' } 가 포함된다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.findMany.mockResolvedValue([]);

      const repo = new ContributionRepository(prisma);
      await repo.findByAssessment("a-x");
      await repo.findByAssessment("a-y");

      const firstCall = contributionMock.findMany.mock.calls[0]?.[0] as {
        orderBy: unknown;
      };
      const secondCall = contributionMock.findMany.mock.calls[1]?.[0] as {
        orderBy: unknown;
      };
      expect(firstCall.orderBy).toEqual({ createdAt: "asc" });
      expect(secondCall.orderBy).toEqual({ createdAt: "asc" });
    });

    // Negative (b): 매칭 row 0 시 빈 배열 반환 (null 반환 안 함) — Prisma findMany
    // 의 native 동작. null 아님 — 호출자가 .length / .map 사용 가능.
    it("매칭 row 0 시 빈 배열 [] 을 반환한다 (null 아님)", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.findMany.mockResolvedValueOnce([]);

      const repo = new ContributionRepository(prisma);
      const result = await repo.findByAssessment("assessment-no-data");

      expect(result).toEqual([]);
      expect(result).not.toBeNull();
    });

    // Error path: PrismaService 가 reject 하면 catch 없이 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new ContributionRepository(prisma);
      await expect(repo.findByAssessment("assessment-1")).rejects.toThrow(
        "db-down",
      );
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025 row 부재) path (hard delete, REQ-041)
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: 정상 id 로 hard delete 호출 — return 값 void.
    it("id 를 where 로 PrismaService.contribution.delete 를 호출한다 (hard delete)", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      contributionMock.delete.mockResolvedValueOnce(buildContributionFixture());

      const repo = new ContributionRepository(prisma);
      const result = await repo.delete("id-1");

      expect(contributionMock.delete).toHaveBeenCalledTimes(1);
      expect(contributionMock.delete).toHaveBeenCalledWith({
        where: { id: "id-1" },
      });
      // delete 메서드는 void return — 명시적 undefined 검증.
      expect(result).toBeUndefined();
    });

    // Error path / Negative (d): row 부재 시 Prisma P2025 그대로 throw — 호출자 책임.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, contributionMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      contributionMock.delete.mockRejectedValueOnce(p2025);

      const repo = new ContributionRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });
  });
});
