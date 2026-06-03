// PermissionDeniedRecordRepository spec — T-0209 acceptance (R-112: happy /
// error / branch / negative 4 카테고리 + coverage line/function ≥ 80%).
// LlmProviderConfigRepository spec (src/llm/llm-provider-config.repository.spec.ts)
// 의 buildPrismaMock 패턴 1:1 mirror.
//
// 본 spec 은 PrismaService 의 `permissionDeniedRecord` delegate 를 Jest mock
// (`jest.fn()`) 으로 대체하여 PostgreSQL container 없이 isolated 하게 실행된다.
// 검증 포인트:
//   - 각 메서드가 PrismaService 의 올바른 delegate 메서드를 올바른 인자로 호출하는지.
//   - return 값이 PrismaService 의 return 값을 그대로 propagate 하는지.
//   - findMany 의 filter 제공 vs 미제공 분기 (where 절 구성 — branch cover).
//   - findMany 가 빈 배열을 반환해도 정상 동작 (negative — empty result).
//   - create 에 principal/reason 부재 (nullable) input 도 raw forward (negative).
//   - PrismaService reject (DB 장애) 가 swallow 없이 그대로 propagate (error).
import type { PermissionDeniedRecord } from "@prisma/client";

import type { PrismaService } from "../persistence/prisma.service";

import { PermissionDeniedRecordRepository } from "./permission-denied-record.repository";

// PermissionDeniedRecord fixture — schema.prisma 의 8 컬럼을 모두 채운 default row.
// overrides 가 provider / instanceRef / httpStatus 등을 분기 별 override 한다.
function buildRecordFixture(
  overrides: Partial<PermissionDeniedRecord> = {},
): PermissionDeniedRecord {
  return {
    id: "pdr-default",
    provider: "github",
    instanceRef: "github.sec.samsung.net",
    resourceRef: "/repos/acme/widget/commits",
    principal: null,
    httpStatus: 403,
    reason: "permission-denied",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

// PrismaService mock factory — 각 test 마다 새 instance 를 만들어 호출 카운터가
// 격리되도록 한다. `permissionDeniedRecord` delegate 의 create / findMany 만 사용.
function buildPrismaMock(): {
  prisma: PrismaService;
  recordMock: {
    create: jest.Mock;
    findMany: jest.Mock;
  };
} {
  const recordMock = {
    create: jest.fn(),
    findMany: jest.fn(),
  };
  const prisma = {
    permissionDeniedRecord: recordMock,
  } as unknown as PrismaService;
  return { prisma, recordMock };
}

describe("PermissionDeniedRecordRepository", () => {
  // ------------------------------------------------------------------
  // create — happy + error + negative (nullable input)
  // ------------------------------------------------------------------
  describe("create()", () => {
    // Happy path: input 을 PrismaService.permissionDeniedRecord.create 의 data 로 전달.
    it("input 을 PrismaService.permissionDeniedRecord.create 의 data 로 전달한다", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      const fixture = buildRecordFixture({ id: "pdr-new" });
      recordMock.create.mockResolvedValueOnce(fixture);

      const repo = new PermissionDeniedRecordRepository(prisma);
      const input = {
        provider: "github",
        instanceRef: "github.sec.samsung.net",
        resourceRef: "/repos/acme/widget/commits",
        principal: null,
        httpStatus: 403,
        reason: "permission-denied",
      };
      const result = await repo.create(input);

      expect(recordMock.create).toHaveBeenCalledWith({ data: input });
      // forwarded data 가 기대한 principal/reason 키를 싣는지 추가 검증 — bare data
      // 동치성 (toHaveBeenCalledWith) 보다 tighter regression (키 drop / 오염 catch).
      expect(recordMock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          principal: null,
          reason: "permission-denied",
        }),
      });
      expect(result).toBe(fixture);
    });

    // Negative #1: principal / reason 부재 (nullable) input 도 그대로 raw forward —
    // nullable 컬럼이라 누락 input 도 정상 (ADR-0022 §1).
    it("principal/reason 부재 (nullable) input 도 PrismaService 로 그대로 전달한다 (negative)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.create.mockResolvedValueOnce(buildRecordFixture());

      const repo = new PermissionDeniedRecordRepository(prisma);
      const input = {
        provider: "confluence",
        instanceRef: "https://acme.atlassian.net/wiki/rest/api",
        resourceRef: "/content",
        httpStatus: 401,
      };
      await repo.create(input);

      expect(recordMock.create).toHaveBeenCalledWith({ data: input });
    });

    // Error path: PrismaService 가 reject 시 (DB 장애 등) 그대로 propagate.
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (의존성 실패)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.create.mockRejectedValueOnce(new Error("db-down"));

      const repo = new PermissionDeniedRecordRepository(prisma);
      await expect(
        repo.create({
          provider: "github",
          instanceRef: "h",
          resourceRef: "/r",
          httpStatus: 403,
        }),
      ).rejects.toThrow("db-down");
    });
  });

  // ------------------------------------------------------------------
  // findMany — happy + branch (filter 제공/미제공) + negative (빈 배열) + error
  // ------------------------------------------------------------------
  describe("findMany()", () => {
    // Happy / branch (필터 미제공): where 빈 객체 + createdAt desc 정렬로 전체 조회.
    it("필터 미제공 시 where 빈 객체 + createdAt desc 로 전체 조회한다 (branch — no filter)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      const fixture = [
        buildRecordFixture({ id: "r-1" }),
        buildRecordFixture({ id: "r-2", provider: "confluence" }),
      ];
      recordMock.findMany.mockResolvedValueOnce(fixture);

      const repo = new PermissionDeniedRecordRepository(prisma);
      const result = await repo.findMany();

      expect(recordMock.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
      });
      expect(result).toBe(fixture);
    });

    // Branch (필터 제공): instanceRef / provider / httpStatus 가 where 절로 구성됨.
    it("필터 제공 시 instanceRef/provider/httpStatus 를 where 로 구성한다 (branch — with filter)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.findMany.mockResolvedValueOnce([buildRecordFixture()]);

      const repo = new PermissionDeniedRecordRepository(prisma);
      await repo.findMany({
        instanceRef: "github.sec.samsung.net",
        provider: "github",
        httpStatus: 403,
      });

      expect(recordMock.findMany).toHaveBeenCalledWith({
        where: {
          instanceRef: "github.sec.samsung.net",
          provider: "github",
          httpStatus: 403,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    // Branch (부분 필터): 일부 키만 제공 시 그 키만 where 에 포함, 나머지는 omit.
    it("부분 필터 (instanceRef 만) 제공 시 그 키만 where 에 포함한다 (branch — partial filter)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.findMany.mockResolvedValueOnce([]);

      const repo = new PermissionDeniedRecordRepository(prisma);
      await repo.findMany({ instanceRef: "only-this" });

      expect(recordMock.findMany).toHaveBeenCalledWith({
        where: { instanceRef: "only-this" },
        orderBy: { createdAt: "desc" },
      });
    });

    // Negative #2: record 0 row 일 때 빈 배열 반환 (등록 0 도 정상 — 404 변환 0).
    it("record 부재 시 빈 배열을 반환한다 (negative — empty result)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.findMany.mockResolvedValueOnce([]);

      const repo = new PermissionDeniedRecordRepository(prisma);
      const result = await repo.findMany();

      expect(result).toEqual([]);
    });

    // Negative #3: 빈 객체 filter 도 raw forward (where 빈 객체 = 전체 조회).
    it("빈 객체 filter 도 where 빈 객체로 그대로 전달한다 (negative — empty filter)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.findMany.mockResolvedValueOnce([]);

      const repo = new PermissionDeniedRecordRepository(prisma);
      await repo.findMany({});

      expect(recordMock.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
      });
    });

    // Error path: PrismaService 가 reject 시 그대로 propagate (swallow 0).
    it("PrismaService 가 reject 하면 error 를 그대로 전파한다 (의존성 실패)", async () => {
      const { prisma, recordMock } = buildPrismaMock();
      recordMock.findMany.mockRejectedValueOnce(new Error("db-down"));

      const repo = new PermissionDeniedRecordRepository(prisma);
      await expect(repo.findMany()).rejects.toThrow("db-down");
    });
  });
});
