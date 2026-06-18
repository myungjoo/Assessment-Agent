// ExportJobService spec — T-0486, ADR-0044 §Follow-ups 첫 slice (ExportJob persistence).
// R-112 4 종 (happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) +
// coverage line/function ≥ 80% 검증.
//
// PrismaService 를 test/helpers/prisma-mock.ts 의 exportJob delegate mock 으로 대체해
// PostgreSQL container 없이 isolated 실행 (evaluation-result-persist.service.spec.ts 의
// 직접 생성자 주입 패턴 mirror). 검증 포인트:
//   - happy: createJob / markRunning / markSucceeded / markFailed / findJob / findRunning
//     의 정상 동작 (Prisma delegate 호출 인자 + 반환 검증).
//   - branch: scope invariant 3 분기 (FULL / RANGE / PARTIAL) 각 정상 + status 전이 3 분기.
//   - error/negative: scope=FULL+dateRange (400) / scope=RANGE+dateRange 누락 (400) /
//     scope=PARTIAL+entitySelector 누락 (400) / 빈 requestedById (400) /
//     findJob 부재 P2025 → 404 / mark* 부재 P2025 → 404 / 변환 범위 밖 error propagate.
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ExportScope, Prisma, type ExportJob } from "@prisma/client";

import {
  buildMockPrismaService,
  buildPrismaError,
  type MockPrismaService,
} from "../../test/helpers/prisma-mock";

import { ExportJobService } from "./export-job.service";

// ExportJob fixture — schema 의 컬럼을 채운 default row. overrides 로 분기 구성.
function buildExportJobFixture(overrides: Partial<ExportJob> = {}): ExportJob {
  return {
    id: "export-job-default",
    status: "PENDING",
    scope: "FULL",
    dateRange: null,
    entitySelector: null,
    requestedById: "user-1",
    createdAt: new Date("2026-06-18T00:00:00.000Z"),
    startedAt: null,
    finishedAt: null,
    error: null,
    artifactRef: null,
    ...overrides,
  };
}

// service + mock prisma 를 함께 빌드 — 생성자가 PrismaService 만 주입받으므로 부분 mock
// 을 `as unknown as` 로 캐스팅해 주입.
function buildService(): {
  service: ExportJobService;
  prisma: MockPrismaService;
} {
  const prisma = buildMockPrismaService();
  const service = new ExportJobService(
    prisma as unknown as ConstructorParameters<typeof ExportJobService>[0],
  );
  return { service, prisma };
}

describe("ExportJobService", () => {
  // ---------------------------------------------------------------------------
  // createJob — happy + scope invariant 분기
  // ---------------------------------------------------------------------------
  describe("createJob", () => {
    it("scope=FULL — status=PENDING row 를 생성한다 (한정값 없음)", async () => {
      const { service, prisma } = buildService();
      const row = buildExportJobFixture();
      prisma.exportJob.create.mockResolvedValue(row);

      const result = await service.createJob({
        scope: ExportScope.FULL,
        requestedById: "user-1",
      });

      expect(prisma.exportJob.create).toHaveBeenCalledTimes(1);
      const arg = prisma.exportJob.create.mock.calls[0][0];
      // 미사용 축은 DB NULL (Prisma.DbNull) 로 정규화 (toJsonOrNull).
      expect(arg.data).toEqual({
        scope: "FULL",
        requestedById: "user-1",
        dateRange: Prisma.DbNull,
        entitySelector: Prisma.DbNull,
      });
      // status default 는 schema @default(PENDING) — data 에 명시하지 않음.
      expect(arg.data).not.toHaveProperty("status");
      expect(result).toBe(row);
    });

    it("scope=RANGE — dateRange 를 동반해 생성한다", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());

      await service.createJob({
        scope: ExportScope.RANGE,
        requestedById: "user-1",
        dateRange: { start: "2026-01-01", end: "2026-03-31" },
      });

      const arg = prisma.exportJob.create.mock.calls[0][0];
      expect(arg.data.dateRange).toEqual({
        start: "2026-01-01",
        end: "2026-03-31",
      });
      expect(arg.data.entitySelector).toBe(Prisma.DbNull);
    });

    it("scope=PARTIAL — entitySelector 를 동반해 생성한다", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());

      await service.createJob({
        scope: ExportScope.PARTIAL,
        requestedById: "user-1",
        entitySelector: { personIds: ["p1", "p2"] },
      });

      const arg = prisma.exportJob.create.mock.calls[0][0];
      expect(arg.data.entitySelector).toEqual({ personIds: ["p1", "p2"] });
      expect(arg.data.dateRange).toBe(Prisma.DbNull);
    });

    // negative: 빈 requestedById → 400.
    it("requestedById 가 빈 문자열이면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({ scope: ExportScope.FULL, requestedById: "" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative: scope=FULL 인데 dateRange 동반 → 400 (모순).
    it("scope=FULL 인데 dateRange 가 넘어오면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.FULL,
          requestedById: "user-1",
          dateRange: { start: "2026-01-01" },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative: scope=FULL 인데 entitySelector 동반 → 400 (모순, 다른 축 cover).
    it("scope=FULL 인데 entitySelector 가 넘어오면 BadRequestException", async () => {
      const { service } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.FULL,
          requestedById: "user-1",
          entitySelector: { personIds: ["p1"] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // negative: scope=RANGE 인데 dateRange 누락 → 400.
    it("scope=RANGE 인데 dateRange 누락 시 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.RANGE,
          requestedById: "user-1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative: scope=PARTIAL 인데 entitySelector 누락 → 400.
    it("scope=PARTIAL 인데 entitySelector 누락 시 BadRequestException", async () => {
      const { service } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.PARTIAL,
          requestedById: "user-1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // branch: scope=RANGE + dateRange=null (명시 null) 도 누락으로 취급 → 400.
    it("scope=RANGE 인데 dateRange 가 null 이면 BadRequestException", async () => {
      const { service } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.RANGE,
          requestedById: "user-1",
          dateRange: null,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // status 전이 — markRunning / markSucceeded / markFailed
  // ---------------------------------------------------------------------------
  describe("status 전이", () => {
    it("markRunning — status=RUNNING + startedAt 갱신", async () => {
      const { service, prisma } = buildService();
      const row = buildExportJobFixture({ status: "RUNNING" });
      prisma.exportJob.update.mockResolvedValue(row);

      const result = await service.markRunning("job-1");

      const arg = prisma.exportJob.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: "job-1" });
      expect(arg.data.status).toBe("RUNNING");
      expect(arg.data.startedAt).toBeInstanceOf(Date);
      expect(result).toBe(row);
    });

    it("markSucceeded — status=SUCCEEDED + finishedAt + artifactRef 갱신", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.update.mockResolvedValue(
        buildExportJobFixture({ status: "SUCCEEDED" }),
      );

      await service.markSucceeded("job-1", "s3://bucket/dump-1.tar.gz");

      const arg = prisma.exportJob.update.mock.calls[0][0];
      expect(arg.data.status).toBe("SUCCEEDED");
      expect(arg.data.finishedAt).toBeInstanceOf(Date);
      expect(arg.data.artifactRef).toBe("s3://bucket/dump-1.tar.gz");
    });

    it("markFailed — status=FAILED + finishedAt + error 갱신", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.update.mockResolvedValue(
        buildExportJobFixture({ status: "FAILED" }),
      );

      await service.markFailed("job-1", "dump 중 DB 연결 실패");

      const arg = prisma.exportJob.update.mock.calls[0][0];
      expect(arg.data.status).toBe("FAILED");
      expect(arg.data.finishedAt).toBeInstanceOf(Date);
      expect(arg.data.error).toBe("dump 중 DB 연결 실패");
    });

    // negative: 존재하지 않는 id 로 markRunning → P2025 → 404.
    it("markRunning — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.update.mockRejectedValue(buildPrismaError("P2025"));

      await expect(service.markRunning("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // negative: markSucceeded 부재 → 404 (다른 전이 메서드도 동일 매핑 cover).
    it("markSucceeded — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.update.mockRejectedValue(buildPrismaError("P2025"));

      await expect(
        service.markSucceeded("missing", "ref"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // negative: markFailed 부재 → 404.
    it("markFailed — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.update.mockRejectedValue(buildPrismaError("P2025"));

      await expect(service.markFailed("missing", "err")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // negative: 변환 범위 밖 error (P2003) 는 그대로 propagate (NotFound 아님).
    it("mark* — P2025 가 아닌 Prisma error 는 그대로 propagate", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.update.mockRejectedValue(buildPrismaError("P2003"));

      await expect(service.markRunning("job-1")).rejects.toMatchObject({
        code: "P2003",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // polling 조회 — findJob / findRunning
  // ---------------------------------------------------------------------------
  describe("polling 조회", () => {
    it("findJob — 단건 반환", async () => {
      const { service, prisma } = buildService();
      const row = buildExportJobFixture({ id: "job-1" });
      prisma.exportJob.findUniqueOrThrow.mockResolvedValue(row);

      const result = await service.findJob("job-1");

      expect(prisma.exportJob.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "job-1" },
      });
      expect(result).toBe(row);
    });

    // error: findJob 부재 시 P2025 → 404.
    it("findJob — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.findUniqueOrThrow.mockRejectedValue(
        buildPrismaError("P2025"),
      );

      await expect(service.findJob("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // negative: findJob 의 P2025 아닌 error 는 그대로 propagate.
    it("findJob — P2025 가 아닌 error 는 그대로 propagate", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.findUniqueOrThrow.mockRejectedValue(
        buildPrismaError("P2003"),
      );

      await expect(service.findJob("job-1")).rejects.toMatchObject({
        code: "P2003",
      });
    });

    it("findRunning — status=RUNNING 목록 반환", async () => {
      const { service, prisma } = buildService();
      const rows = [
        buildExportJobFixture({ id: "r1", status: "RUNNING" }),
        buildExportJobFixture({ id: "r2", status: "RUNNING" }),
      ];
      prisma.exportJob.findMany.mockResolvedValue(rows);

      const result = await service.findRunning();

      expect(prisma.exportJob.findMany).toHaveBeenCalledWith({
        where: { status: "RUNNING" },
      });
      expect(result).toBe(rows);
    });

    it("findRunning — 매칭 0 이면 빈 배열", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.findMany.mockResolvedValue([]);

      await expect(service.findRunning()).resolves.toEqual([]);
    });
  });
});
