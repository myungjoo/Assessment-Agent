// ImportJobService spec — T-0487, ADR-0044 §Follow-ups 두 번째 slice (ImportJob persistence).
// R-112 4 종 (happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) +
// coverage line/function ≥ 80% 검증. ExportJobService spec (T-0486) 동형.
//
// PrismaService 를 test/helpers/prisma-mock.ts 의 importJob delegate mock 으로 대체해
// PostgreSQL container 없이 isolated 실행 (export-job.service.spec.ts 의 직접 생성자
// 주입 패턴 mirror). 검증 포인트:
//   - happy: createJob / markRunning / markSucceeded / markFailed / findJob / findRunning
//     의 정상 동작 (Prisma delegate 호출 인자 + 반환 검증). mode default(REPLACE) +
//     mode=MERGE 명시 각 1+.
//   - branch: mode invariant 분기 (default / MERGE 명시 / 잘못된 mode 400) + status 전이
//     3 분기 (RUNNING / SUCCEEDED / FAILED).
//   - error/negative: 빈 requestedById (400) / enum 외 mode (400) / findJob 부재 P2025
//     → 404 / mark* 부재 P2025 → 404 / 변환 범위 밖 error propagate /
//     markSucceeded restoredRowCount 0 처리.
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ImportMode, type ImportJob } from "@prisma/client";

import {
  buildMockPrismaService,
  buildPrismaError,
  type MockPrismaService,
} from "../../test/helpers/prisma-mock";

import { ImportJobService } from "./import-job.service";

// ImportJob fixture — schema 의 컬럼을 채운 default row. overrides 로 분기 구성.
function buildImportJobFixture(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    id: "import-job-default",
    status: "PENDING",
    mode: "REPLACE",
    requestedById: "user-1",
    createdAt: new Date("2026-06-18T00:00:00.000Z"),
    startedAt: null,
    finishedAt: null,
    error: null,
    artifactRef: null,
    restoredRowCount: null,
    ...overrides,
  };
}

// service + mock prisma 를 함께 빌드 — 생성자가 PrismaService 만 주입받으므로 부분 mock
// 을 `as unknown as` 로 캐스팅해 주입.
function buildService(): {
  service: ImportJobService;
  prisma: MockPrismaService;
} {
  const prisma = buildMockPrismaService();
  const service = new ImportJobService(
    prisma as unknown as ConstructorParameters<typeof ImportJobService>[0],
  );
  return { service, prisma };
}

describe("ImportJobService", () => {
  // ---------------------------------------------------------------------------
  // createJob — happy + mode invariant 분기
  // ---------------------------------------------------------------------------
  describe("createJob", () => {
    it("mode 미지정 — status=PENDING row 를 생성한다 (mode default REPLACE 위임)", async () => {
      const { service, prisma } = buildService();
      const row = buildImportJobFixture();
      prisma.importJob.create.mockResolvedValue(row);

      const result = await service.createJob({ requestedById: "user-1" });

      expect(prisma.importJob.create).toHaveBeenCalledTimes(1);
      const arg = prisma.importJob.create.mock.calls[0][0];
      // mode 미지정 시 data 에 mode 명시하지 않음 — schema @default(REPLACE) 위임.
      expect(arg.data).toEqual({ requestedById: "user-1" });
      expect(arg.data).not.toHaveProperty("mode");
      // status default 는 schema @default(PENDING) — data 에 명시하지 않음.
      expect(arg.data).not.toHaveProperty("status");
      expect(result).toBe(row);
    });

    it("mode=MERGE 명시 — data 에 mode 를 전달한다", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.create.mockResolvedValue(
        buildImportJobFixture({ mode: "MERGE" }),
      );

      await service.createJob({
        requestedById: "user-1",
        mode: ImportMode.MERGE,
      });

      const arg = prisma.importJob.create.mock.calls[0][0];
      expect(arg.data.mode).toBe("MERGE");
      expect(arg.data.requestedById).toBe("user-1");
    });

    it("mode=REPLACE 명시 — data 에 mode 를 전달한다", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.create.mockResolvedValue(buildImportJobFixture());

      await service.createJob({
        requestedById: "user-1",
        mode: ImportMode.REPLACE,
      });

      const arg = prisma.importJob.create.mock.calls[0][0];
      expect(arg.data.mode).toBe("REPLACE");
    });

    // negative: 빈 requestedById → 400.
    it("requestedById 가 빈 문자열이면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({ requestedById: "" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.importJob.create).not.toHaveBeenCalled();
    });

    // negative: undefined requestedById → 400 (빈 문자열과 다른 falsy 축 cover).
    it("requestedById 가 undefined 이면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({
          requestedById: undefined as unknown as string,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.importJob.create).not.toHaveBeenCalled();
    });

    // negative: enum 외 mode 값 → 400.
    it("mode 가 ImportMode enum 값이 아니면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({
          requestedById: "user-1",
          mode: "UPSERT" as unknown as ImportMode,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.importJob.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // status 전이 — markRunning / markSucceeded / markFailed
  // ---------------------------------------------------------------------------
  describe("status 전이", () => {
    it("markRunning — status=RUNNING + startedAt 갱신", async () => {
      const { service, prisma } = buildService();
      const row = buildImportJobFixture({ status: "RUNNING" });
      prisma.importJob.update.mockResolvedValue(row);

      const result = await service.markRunning("job-1");

      const arg = prisma.importJob.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: "job-1" });
      expect(arg.data.status).toBe("RUNNING");
      expect(arg.data.startedAt).toBeInstanceOf(Date);
      expect(result).toBe(row);
    });

    it("markSucceeded — status=SUCCEEDED + finishedAt + artifactRef + restoredRowCount 갱신", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockResolvedValue(
        buildImportJobFixture({ status: "SUCCEEDED" }),
      );

      await service.markSucceeded("job-1", "s3://bucket/snapshot-1.tar.gz", 42);

      const arg = prisma.importJob.update.mock.calls[0][0];
      expect(arg.data.status).toBe("SUCCEEDED");
      expect(arg.data.finishedAt).toBeInstanceOf(Date);
      expect(arg.data.artifactRef).toBe("s3://bucket/snapshot-1.tar.gz");
      expect(arg.data.restoredRowCount).toBe(42);
    });

    // negative/branch: restoredRowCount=0 (복원 row 0) 도 그대로 기록 (falsy 0 누락 방지).
    it("markSucceeded — restoredRowCount=0 도 그대로 기록한다", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockResolvedValue(
        buildImportJobFixture({ status: "SUCCEEDED" }),
      );

      await service.markSucceeded("job-1", "ref", 0);

      const arg = prisma.importJob.update.mock.calls[0][0];
      expect(arg.data.restoredRowCount).toBe(0);
    });

    it("markFailed — status=FAILED + finishedAt + error 갱신", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockResolvedValue(
        buildImportJobFixture({ status: "FAILED" }),
      );

      await service.markFailed("job-1", "복원 중 DB 연결 실패");

      const arg = prisma.importJob.update.mock.calls[0][0];
      expect(arg.data.status).toBe("FAILED");
      expect(arg.data.finishedAt).toBeInstanceOf(Date);
      expect(arg.data.error).toBe("복원 중 DB 연결 실패");
    });

    // negative: 존재하지 않는 id 로 markRunning → P2025 → 404.
    it("markRunning — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockRejectedValue(buildPrismaError("P2025"));

      await expect(service.markRunning("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // negative: markSucceeded 부재 → 404 (다른 전이 메서드도 동일 매핑 cover).
    it("markSucceeded — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockRejectedValue(buildPrismaError("P2025"));

      await expect(
        service.markSucceeded("missing", "ref", 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // negative: markFailed 부재 → 404.
    it("markFailed — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockRejectedValue(buildPrismaError("P2025"));

      await expect(service.markFailed("missing", "err")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // negative: 변환 범위 밖 error (P2003) 는 그대로 propagate (NotFound 아님).
    it("mark* — P2025 가 아닌 Prisma error 는 그대로 propagate", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.update.mockRejectedValue(buildPrismaError("P2003"));

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
      const row = buildImportJobFixture({ id: "job-1" });
      prisma.importJob.findUniqueOrThrow.mockResolvedValue(row);

      const result = await service.findJob("job-1");

      expect(prisma.importJob.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: "job-1" },
      });
      expect(result).toBe(row);
    });

    // error: findJob 부재 시 P2025 → 404.
    it("findJob — row 부재(P2025) 시 NotFoundException", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.findUniqueOrThrow.mockRejectedValue(
        buildPrismaError("P2025"),
      );

      await expect(service.findJob("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // negative: findJob 의 P2025 아닌 error 는 그대로 propagate.
    it("findJob — P2025 가 아닌 error 는 그대로 propagate", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.findUniqueOrThrow.mockRejectedValue(
        buildPrismaError("P2003"),
      );

      await expect(service.findJob("job-1")).rejects.toMatchObject({
        code: "P2003",
      });
    });

    it("findRunning — status=RUNNING 목록 반환", async () => {
      const { service, prisma } = buildService();
      const rows = [
        buildImportJobFixture({ id: "r1", status: "RUNNING" }),
        buildImportJobFixture({ id: "r2", status: "RUNNING" }),
      ];
      prisma.importJob.findMany.mockResolvedValue(rows);

      const result = await service.findRunning();

      expect(prisma.importJob.findMany).toHaveBeenCalledWith({
        where: { status: "RUNNING" },
      });
      expect(result).toBe(rows);
    });

    it("findRunning — 매칭 0 이면 빈 배열", async () => {
      const { service, prisma } = buildService();
      prisma.importJob.findMany.mockResolvedValue([]);

      await expect(service.findRunning()).resolves.toEqual([]);
    });
  });
});
