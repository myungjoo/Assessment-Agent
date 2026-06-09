// AssessmentRepository spec — T-0111 acceptance (R-112: happy / error / branch /
// negative 4 카테고리 + raw 미저장 invariant 검증 + coverage line/function ≥ 80%).
//
// 본 spec 은 PrismaService 의 `assessment` delegate 를 Jest mock (`jest.fn()`) 으로
// 대체하여 PostgreSQL container 없이 isolated 하게 실행된다 (person.repository.spec.ts
// 의 `buildPrismaMock` 패턴 mirror). 검증 포인트:
//   - 각 repository 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른
//     인자로 호출하는지 (call shape contract).
//   - 각 메서드의 return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - Prisma 의 error code (P2002 / P2025) 가 catch 없이 그대로 throw 되는지.
//   - findByPerson 의 options.period 분기 (지정 vs 미지정) 정합성.
//   - raw 미저장 (R-59) invariant — create 에 전달되는 `data` 객체의 키 집합이
//     ADR-0006 §1 의 허용 입력 컬럼 8 종으로 한정됨 (raw body / diff / content 부재).
import type { Assessment } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { AssessmentRepository } from "./assessment.repository";

// Assessment fixture — 10 컬럼 (schema.prisma L224–234) 의 default row.
// 각 test 가 필요 시 override 로 personId / period / scope / periodStart 분기 검증.
function buildAssessmentFixture(
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    id: "cuid-default",
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: new Date("2026-05-25T00:00:00.000Z"),
    difficulty: "medium",
    // Decimal 컬럼 — Prisma client runtime 의 Decimal type 또는 number / string
    // 입력을 모두 수용. mock 단에서는 검증 단순화를 위해 number 사용.
    contributionScore: 0.5 as unknown as Assessment["contributionScore"],
    volume: 7,
    narrative: "주간 commit 활동 정상 수준",
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService 의 `assessment` delegate mock factory — 각 test 마다 새 instance
// 를 만들어 호출 카운터가 격리되도록 한다 (person.repository.spec.ts mirror).
function buildPrismaMock(): {
  prisma: PrismaService;
  assessmentMock: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
} {
  const assessmentMock = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  // PrismaService 는 `assessment` delegate 만 사용 — 다른 모델은 정의 불필요.
  const prisma = { assessment: assessmentMock } as unknown as PrismaService;
  return { prisma, assessmentMock };
}

describe("AssessmentRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error (P2002 unique 위반) + raw 미저장 invariant
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: 정상 input 으로 row 생성, fixture 그대로 반환.
    it("input 을 PrismaService.assessment.create 의 data 로 전달한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const fixture = buildAssessmentFixture({ id: "cuid-new" });
      assessmentMock.create.mockResolvedValueOnce(fixture);

      const repo = new AssessmentRepository(prisma);
      const input = {
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-05-25T00:00:00.000Z"),
        difficulty: "medium",
        contributionScore: 0.5,
        volume: 7,
        narrative: "주간 commit 활동 정상 수준",
      };
      const result = await repo.create(input);

      expect(assessmentMock.create).toHaveBeenCalledTimes(1);
      expect(assessmentMock.create).toHaveBeenCalledWith({ data: input });
      expect(result).toBe(fixture);
    });

    // Error path: @@unique([personId, period, scope, periodStart]) 위반 시
    // Prisma P2002 그대로 propagate — 호출자 (AssessmentService) 책임.
    it("@@unique 위반 시 Prisma P2002 error 를 그대로 throw 한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      assessmentMock.create.mockRejectedValueOnce(p2002);

      const repo = new AssessmentRepository(prisma);
      await expect(
        repo.create({
          personId: "person-1",
          period: "week",
          scope: "commit",
          periodStart: new Date("2026-05-25T00:00:00.000Z"),
          difficulty: "medium",
          contributionScore: 0.5,
          volume: 7,
          narrative: "중복 시도",
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // Negative (raw 미저장 invariant — R-59 / REQ-032 / ADR-0006 §4):
    // create 에 전달되는 `data` 객체의 키 집합이 ADR-0006 §1 의 허용 입력 컬럼 8 종
    // (personId / period / scope / periodStart / difficulty / contributionScore /
    // volume / narrative) 으로 한정됨을 검증. raw body / diff / content 등 본문 컬럼
    // 키가 포함되지 않음을 assert — schema 강제 (컬럼 부재) 의 runtime guard 박제.
    it("create 의 data 키 집합이 ADR-0006 §1 의 8 허용 컬럼으로 한정된다 (raw 미저장 R-59)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.create.mockResolvedValueOnce(buildAssessmentFixture());

      const repo = new AssessmentRepository(prisma);
      await repo.create({
        personId: "person-2",
        period: "month",
        scope: "aggregate",
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        difficulty: "hard",
        contributionScore: "1.25",
        volume: 42,
        narrative: "월간 종합 평가",
      });

      // 호출 인자 검사 — data 객체의 key set 검증.
      const callArgs = assessmentMock.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      expect(callArgs).toBeDefined();
      const dataKeys = Object.keys(callArgs.data).sort();
      const allowed = [
        "personId",
        "period",
        "scope",
        "periodStart",
        "difficulty",
        "contributionScore",
        "volume",
        "narrative",
      ].sort();
      expect(dataKeys).toEqual(allowed);

      // raw 본문 후보 키 집합 — 본 키들 중 어느 하나라도 data 에 포함되면 R-59 위반.
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
  // Contribution @@unique([assessmentId, sourceRef]) — ADR-0033 §4 / T-0298.
  // schema-level unique 강제는 DB layer 책임이므로 repository unit 단에서는 PrismaService
  // mock 으로 P2002 propagation 정책 (catch X — AssessmentService 가 ConflictException
  // 변환) 이 Contribution-level 충돌에서도 동일하게 유지됨을 검증한다. nested Contribution[]
  // 입력은 후속 write service slice 가 사용할 shape 의 선행 contract 박제다.
  // ------------------------------------------------------------------
  describe("Contribution @@unique([assessmentId, sourceRef]) P2002 정책", () => {
    // nested Contribution[] 를 포함한 create payload helper — Prisma 의 nested write
    // shape (`contributions: { create: [...] }`) mirror. mock 단이라 실제 nested write
    // 는 일어나지 않고 호출 인자 / error propagation 만 검증한다.
    function buildNestedCreatePayload(
      contributions: Array<{ assessmentId?: string; sourceRef: string }>,
    ): Record<string, unknown> {
      return {
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-05-25T00:00:00.000Z"),
        difficulty: "medium",
        contributionScore: 0.5,
        volume: contributions.length,
        narrative: "재평가 reset-and-recreate batch",
        contributions: { create: contributions },
      };
    }

    // Happy path: 정상 unique (assessmentId, sourceRef) 입력은 P2002 없이 통과.
    it("정상 unique (assessmentId, sourceRef) 입력은 P2002 없이 통과한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.create.mockResolvedValueOnce(buildAssessmentFixture());

      const repo = new AssessmentRepository(prisma);
      const payload = buildNestedCreatePayload([
        { sourceRef: "sha-aaa" },
        { sourceRef: "sha-bbb" },
      ]) as unknown as Parameters<typeof repo.create>[0];

      await expect(repo.create(payload)).resolves.toBeDefined();
      expect(assessmentMock.create).toHaveBeenCalledTimes(1);
    });

    // Error path (P2002 propagate): 동일 (assessmentId, sourceRef) 중복 시 Prisma 가
    // P2002 throw → repository catch X, 그대로 전파 (AssessmentService 책임).
    it("duplicate (assessmentId, sourceRef) 가 P2002 로 그대로 propagate 된다 (catch X)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["assessmentId", "sourceRef"] },
      });
      assessmentMock.create.mockRejectedValueOnce(p2002);

      const repo = new AssessmentRepository(prisma);
      const payload = buildNestedCreatePayload([
        { sourceRef: "sha-dup" },
        { sourceRef: "sha-dup" },
      ]) as unknown as Parameters<typeof repo.create>[0];

      await expect(repo.create(payload)).rejects.toMatchObject({
        code: "P2002",
        meta: { target: ["assessmentId", "sourceRef"] },
      });
    });

    // Error path (a): 빈 Contribution[] 입력 — 충돌 표면 0 이므로 P2002 미발생.
    it("빈 Contribution[] 입력은 P2002 없이 통과한다 (충돌 표면 0)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.create.mockResolvedValueOnce(buildAssessmentFixture());

      const repo = new AssessmentRepository(prisma);
      const payload = buildNestedCreatePayload([]) as unknown as Parameters<
        typeof repo.create
      >[0];

      await expect(repo.create(payload)).resolves.toBeDefined();
      expect(assessmentMock.create).toHaveBeenCalledTimes(1);
    });

    // Error path (b): 동일 sourceRef + 다른 assessmentId 는 unique 위반 아님 — 다른
    // Assessment 의 동일 unitId 는 정상. 두 번의 별개 create 호출 모두 P2002 미발생.
    it("동일 sourceRef + 다른 assessmentId 두 Contribution 은 unique 위반이 아니다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.create
        .mockResolvedValueOnce(buildAssessmentFixture({ id: "assess-1" }))
        .mockResolvedValueOnce(buildAssessmentFixture({ id: "assess-2" }));

      const repo = new AssessmentRepository(prisma);
      const first = buildNestedCreatePayload([
        { assessmentId: "assess-1", sourceRef: "sha-same" },
      ]) as unknown as Parameters<typeof repo.create>[0];
      const second = buildNestedCreatePayload([
        { assessmentId: "assess-2", sourceRef: "sha-same" },
      ]) as unknown as Parameters<typeof repo.create>[0];

      await expect(repo.create(first)).resolves.toBeDefined();
      await expect(repo.create(second)).resolves.toBeDefined();
      expect(assessmentMock.create).toHaveBeenCalledTimes(2);
    });

    // Negative (c): 동일 (assessmentId, sourceRef) 가 1 batch 안에서 2번 등장 →
    // DB 가 P2002 throw 하는 시나리오 시뮬레이션. repository 는 그대로 전파.
    it("1 batch 안 동일 (assessmentId, sourceRef) 2회 등장은 P2002 로 전파된다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["assessmentId", "sourceRef"] },
      });
      assessmentMock.create.mockRejectedValueOnce(p2002);

      const repo = new AssessmentRepository(prisma);
      const payload = buildNestedCreatePayload([
        { assessmentId: "assess-x", sourceRef: "sha-batch-dup" },
        { assessmentId: "assess-x", sourceRef: "sha-batch-dup" },
      ]) as unknown as Parameters<typeof repo.create>[0];

      await expect(repo.create(payload)).rejects.toMatchObject({
        code: "P2002",
      });
    });

    // Negative (d): sourceRef 가 빈 문자열인 두 Contribution 동시 입력 — schema 는
    // String NOT NULL 만 강제하므로 빈 문자열 2 개도 동일 값으로 간주되어 unique 충돌.
    // 운영 시 placeholder 빈 문자열 사용 risk 박제 (후속 write service sanitize 책임 hint).
    it("빈 문자열 sourceRef 두 Contribution 동시 입력은 unique 충돌 (P2002) 로 전파된다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const p2002 = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["assessmentId", "sourceRef"] },
      });
      assessmentMock.create.mockRejectedValueOnce(p2002);

      const repo = new AssessmentRepository(prisma);
      const payload = buildNestedCreatePayload([
        { assessmentId: "assess-y", sourceRef: "" },
        { assessmentId: "assess-y", sourceRef: "" },
      ]) as unknown as Parameters<typeof repo.create>[0];

      await expect(repo.create(payload)).rejects.toMatchObject({
        code: "P2002",
      });
    });
  });

  // ------------------------------------------------------------------
  // findById — happy + negative (row 부재 → null) path
  // ------------------------------------------------------------------
  describe("findById()", () => {
    // Happy path: row 존재 시 PrismaService.assessment.findUnique 결과를 그대로 반환.
    it("row 가 존재하면 findUnique 결과를 반환한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const fixture = buildAssessmentFixture({ id: "abc" });
      assessmentMock.findUnique.mockResolvedValueOnce(fixture);

      const repo = new AssessmentRepository(prisma);
      const result = await repo.findById("abc");

      expect(assessmentMock.findUnique).toHaveBeenCalledWith({
        where: { id: "abc" },
      });
      expect(result).toBe(fixture);
    });

    // Negative: row 부재 시 null 반환 (throw 안 함) — PersonRepository.findById mirror.
    it("row 가 부재하면 null 을 반환한다 (throw 하지 않음)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.findUnique.mockResolvedValueOnce(null);

      const repo = new AssessmentRepository(prisma);
      const result = await repo.findById("missing-id");

      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // findByPerson — happy + branch (period 지정 vs 미지정) + error + negative
  // ------------------------------------------------------------------
  describe("findByPerson()", () => {
    // Branch 1 (options 미지정): where: { personId } + orderBy desc.
    it("options 미지정 시 where: { personId } + orderBy desc 로 findMany 를 호출한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const fixture = [buildAssessmentFixture({ id: "a-1" })];
      assessmentMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new AssessmentRepository(prisma);
      const result = await repo.findByPerson("person-1");

      expect(assessmentMock.findMany).toHaveBeenCalledTimes(1);
      expect(assessmentMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-1" },
        orderBy: { periodStart: "desc" },
      });
      expect(result).toBe(fixture);
    });

    // Branch 2 (options.period 미지정 = undefined): 위와 동일하게 personId 만.
    it("options.period 가 undefined 면 where: { personId } 만 사용한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.findMany.mockResolvedValueOnce([]);

      const repo = new AssessmentRepository(prisma);
      await repo.findByPerson("person-2", {});

      expect(assessmentMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-2" },
        orderBy: { periodStart: "desc" },
      });
    });

    // Branch 3 (options.period 지정): where 에 period 가 함께 포함.
    it("options.period 가 주어지면 where: { personId, period } 로 findMany 를 호출한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const fixture = [
        buildAssessmentFixture({ id: "a-2", period: "week" }),
        buildAssessmentFixture({ id: "a-3", period: "week" }),
      ];
      assessmentMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new AssessmentRepository(prisma);
      const result = await repo.findByPerson("person-1", { period: "week" });

      expect(assessmentMock.findMany).toHaveBeenCalledTimes(1);
      expect(assessmentMock.findMany).toHaveBeenCalledWith({
        where: { personId: "person-1", period: "week" },
        orderBy: { periodStart: "desc" },
      });
      expect(result).toHaveLength(2);
    });

    // Branch (orderBy 항상 포함): period 분기 양쪽 모두에서 orderBy desc 가 박제됨을
    // 위 2/3 test 가 함께 cover — 본 test 는 명시적으로 분기 양쪽의 orderBy 동일성
    // 을 한 번 더 검증.
    it("findByPerson 의 모든 분기에서 orderBy: { periodStart: 'desc' } 가 포함된다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.findMany.mockResolvedValue([]);

      const repo = new AssessmentRepository(prisma);
      await repo.findByPerson("p-x");
      await repo.findByPerson("p-x", { period: "month" });

      const firstCall = assessmentMock.findMany.mock.calls[0]?.[0] as {
        orderBy: unknown;
      };
      const secondCall = assessmentMock.findMany.mock.calls[1]?.[0] as {
        orderBy: unknown;
      };
      expect(firstCall.orderBy).toEqual({ periodStart: "desc" });
      expect(secondCall.orderBy).toEqual({ periodStart: "desc" });
    });

    // Negative 1: 매칭 row 0 시 빈 배열 반환 (null 반환 안 함) — 분기 미지정 path.
    it("매칭 row 0 시 빈 배열을 반환한다 (null 아님, period 미지정 path)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.findMany.mockResolvedValueOnce([]);

      const repo = new AssessmentRepository(prisma);
      const result = await repo.findByPerson("person-no-data");

      expect(result).toEqual([]);
    });

    // Negative 2: 매칭 row 0 시 빈 배열 반환 — 분기 지정 path (period 분기 cover).
    it("매칭 row 0 시 빈 배열을 반환한다 (period 지정 path)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.findMany.mockResolvedValueOnce([]);

      const repo = new AssessmentRepository(prisma);
      const result = await repo.findByPerson("person-no-data", {
        period: "day",
      });

      expect(result).toEqual([]);
    });

    // Error path: PrismaService 가 reject 하면 catch 없이 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new AssessmentRepository(prisma);
      await expect(repo.findByPerson("person-1")).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // delete — happy + error (P2025 row 부재) path (hard delete, REQ-041)
  // ------------------------------------------------------------------
  describe("delete()", () => {
    // Happy path: 정상 id 로 hard delete 호출 — return 값 void.
    it("id 를 where 로 PrismaService.assessment.delete 를 호출한다 (hard delete)", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      assessmentMock.delete.mockResolvedValueOnce(buildAssessmentFixture());

      const repo = new AssessmentRepository(prisma);
      const result = await repo.delete("id-1");

      expect(assessmentMock.delete).toHaveBeenCalledTimes(1);
      expect(assessmentMock.delete).toHaveBeenCalledWith({
        where: { id: "id-1" },
      });
      // delete 메서드는 void return — 명시적 undefined 검증.
      expect(result).toBeUndefined();
    });

    // Error path / Negative: row 부재 시 Prisma P2025 그대로 throw — 호출자 책임.
    it("id 부재 시 Prisma P2025 error 를 그대로 throw 한다", async () => {
      const { prisma, assessmentMock } = buildPrismaMock();
      const p2025 = Object.assign(new Error("Record to delete not found"), {
        code: "P2025",
      });
      assessmentMock.delete.mockRejectedValueOnce(p2025);

      const repo = new AssessmentRepository(prisma);
      await expect(repo.delete("missing-id")).rejects.toMatchObject({
        code: "P2025",
      });
    });
  });
});
