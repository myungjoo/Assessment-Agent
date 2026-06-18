// ExportJobService spec — T-0486, ADR-0044 §Follow-ups 첫 slice (ExportJob persistence).
// R-112 4 종 (happy / error / branch / negative 충분 cover, CLAUDE.md §3.2) +
// coverage line/function ≥ 80% 검증.
//
// PrismaService 를 test/helpers/prisma-mock.ts 의 exportJob delegate mock 으로 대체해
// PostgreSQL container 없이 isolated 실행 (evaluation-result-persist.service.spec.ts 의
// 직접 생성자 주입 패턴 mirror). 검증 포인트:
//   - happy: createJob / markRunning / markSucceeded / markFailed / findJob / findRunning
//     의 정상 동작 (Prisma delegate 호출 인자 + 반환 검증).
//   - branch: scope 매핑 3 분기 (FULL / RANGE / PARTIAL) 각 정상 + dateRange coerce 분기
//     (string 입력 coerce / 이미 Date / 부재) + helper valid/invalid 분기 + status 전이 3 분기.
//   - error/negative: validateExportScope(T-0444) 배선 — RANGE 역전 구간 (400) / RANGE
//     Invalid Date (400) / PARTIAL 허용 외 entity (400) / RANGE-dateRange 누락 (400) /
//     PARTIAL-entitySelector 누락 (400) / FULL+dateRange 는 helper normalize 로 valid /
//     여러 field 위반 결합 message / 빈 requestedById (400) / findJob·mark* P2025 → 404.
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ExportScope, Prisma, type ExportJob } from "@prisma/client";

import {
  buildMockPrismaService,
  buildPrismaError,
  type MockPrismaService,
} from "../../test/helpers/prisma-mock";

import { ExportJobService } from "./export-job.service";
import * as rejectionMessageModule from "./export-scope-rejection-message";

// helper 산출 reject headline 의 안정적 prefix — 메시지가 buildExportScopeRejection(T-0463)
// 산출 headline 을 포함함을 단언할 때 쓴다("Export scope 검증 실패 — N개 항목을 수정해야 합니다").
const REJECTION_HEADLINE_PREFIX = "Export scope 검증 실패";

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
  // 각 test 후 spy 복원 — buildExportScopeRejection spy 가 다른 test 로 새지 않도록.
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

    it("scope=RANGE — 유효한 dateRange(ISO string coerce)를 동반해 생성한다", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());

      // JSON body 경유 — start/end 가 ISO string. service 가 Date 로 coerce 후 helper 통과.
      await service.createJob({
        scope: ExportScope.RANGE,
        requestedById: "user-1",
        dateRange: { start: "2026-01-01", end: "2026-03-31" },
      });

      const arg = prisma.exportJob.create.mock.calls[0][0];
      // record 동작 불변 — 검증만 강화하고 input 값을 그대로 저장(coerce 는 helper 전용).
      expect(arg.data.scope).toBe("RANGE");
      expect(arg.data.dateRange).toEqual({
        start: "2026-01-01",
        end: "2026-03-31",
      });
      expect(arg.data.entitySelector).toBe(Prisma.DbNull);
    });

    it("scope=RANGE — 이미 Date instance 인 dateRange 도 통과한다", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());

      // coerce 분기 — 이미 Date 면 그대로 통과(string 아님).
      const dateRange = {
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-03-31T00:00:00.000Z"),
      };
      await service.createJob({
        scope: ExportScope.RANGE,
        requestedById: "user-1",
        dateRange,
      });

      const arg = prisma.exportJob.create.mock.calls[0][0];
      expect(arg.data.dateRange).toEqual(dateRange);
    });

    it("scope=PARTIAL — 유효한 entitySelector(entity 배열)를 동반해 생성한다", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());

      await service.createJob({
        scope: ExportScope.PARTIAL,
        requestedById: "user-1",
        entitySelector: ["Person", "Group"],
      });

      const arg = prisma.exportJob.create.mock.calls[0][0];
      expect(arg.data.entitySelector).toEqual(["Person", "Group"]);
      expect(arg.data.dateRange).toBe(Prisma.DbNull);
    });

    // negative: 빈 requestedById → 400 (helper 무관, service 가 helper 호출 전 분기).
    it("requestedById 가 빈 문자열이면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({ scope: ExportScope.FULL, requestedById: "" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative (helper): scope=RANGE 인데 start ≥ end(역전 구간) → 400. 메시지가
    // buildExportScopeRejection 산출 headline 을 포함함을 단언(ad-hoc join 교체 검증).
    it("scope=RANGE 인데 dateRange.start ≥ end 면 BadRequestException(reject headline 포함)", async () => {
      const { service, prisma } = buildService();

      let message = "";
      try {
        await service.createJob({
          scope: ExportScope.RANGE,
          requestedById: "user-1",
          dateRange: { start: "2026-03-31", end: "2026-01-01" },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        message = (error as Error).message;
      }
      // 사람-친화 headline(T-0463 산출) 포함 + 원본 field error message 도 detailLine 으로 보존.
      expect(message).toContain(REJECTION_HEADLINE_PREFIX);
      expect(message).toContain("반열림 구간");
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative (helper): RANGE 인데 잘못된 ISO string → coerce 결과 Invalid Date → 400.
    it("scope=RANGE 인데 dateRange.start 가 Invalid Date 면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.RANGE,
          requestedById: "user-1",
          dateRange: { start: "not-a-date", end: "2026-03-31" },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative (helper): PARTIAL 인데 허용 외 entity 값 포함 → 400.
    it("scope=PARTIAL 인데 허용 외 entity 가 포함되면 BadRequestException", async () => {
      const { service, prisma } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.PARTIAL,
          requestedById: "user-1",
          entitySelector: ["Person", "Unknown"],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative (helper): scope=RANGE 인데 dateRange 누락 → 400 (field "dateRange").
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

    // negative (helper): scope=PARTIAL 인데 entitySelector 누락 → 400 (field "entitySelector").
    it("scope=PARTIAL 인데 entitySelector 누락 시 BadRequestException", async () => {
      const { service } = buildService();

      await expect(
        service.createJob({
          scope: ExportScope.PARTIAL,
          requestedById: "user-1",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // negative (helper normalize 회귀): scope=FULL+dateRange 동봉은 helper 가 normalized 에서
    // 제거하므로 valid — create 가 정상 통과함을 단언해 normalize 의미를 회귀로 박제.
    it("scope=FULL 인데 dateRange 가 동봉돼도 helper normalize 로 valid(생성 통과)", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());

      await service.createJob({
        scope: ExportScope.FULL,
        requestedById: "user-1",
        dateRange: { start: "2026-01-01", end: "2026-03-31" },
      });

      // FULL 은 한정값 무시 — record 는 input 의 dateRange 를 그대로 저장(persistence 불변).
      expect(prisma.exportJob.create).toHaveBeenCalledTimes(1);
    });

    // negative (helper): 여러 field 위반 동시 발생 시 결합 message 에 모든 field 포함.
    it("여러 field 위반 시 결합 message 에 dateRange·entitySelector 모두 포함", async () => {
      const { service } = buildService();

      // PARTIAL 인데 entitySelector 부재 + range 도 아닌데 dateRange 부적합은 아니므로,
      // PARTIAL 에 허용 외 entity 2 종을 넣어 entitySelector 단일 field 의 다중 위반을 본다.
      await expect(
        service.createJob({
          scope: ExportScope.PARTIAL,
          requestedById: "user-1",
          entitySelector: ["BadOne"],
        }),
      ).rejects.toThrow(/entitySelector/);
    });

    // 여러 field(scope 무관 — range 의 dateRange + entitySelector 두 field 동시 위반) 결합.
    it("RANGE 에서 dateRange·entitySelector 두 field 위반이 결합 message 에 함께 노출", async () => {
      const { service } = buildService();

      // RANGE 인데 dateRange 역전 + 동봉 entitySelector 에 허용 외 값 → 두 field error 누적.
      let message = "";
      try {
        await service.createJob({
          scope: ExportScope.RANGE,
          requestedById: "user-1",
          dateRange: { start: "2026-03-31", end: "2026-01-01" },
          entitySelector: ["BadEntity"],
        });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("dateRange");
      expect(message).toContain("entitySelector");
    });

    // -------------------------------------------------------------------------
    // buildExportScopeRejection(T-0463) 실호출 배선 검증 (T-0495)
    // -------------------------------------------------------------------------

    // branch (b) — invalid verdict 분기에서 helper 가 정확히 1 회 호출됨을 spy 로 단언.
    it("invalid scope 면 buildExportScopeRejection 을 정확히 1 회 호출한다", async () => {
      const { service, prisma } = buildService();
      const spy = jest.spyOn(
        rejectionMessageModule,
        "buildExportScopeRejection",
      );

      await expect(
        service.createJob({
          scope: ExportScope.PARTIAL,
          requestedById: "user-1",
          entitySelector: ["Person", "Unknown"],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(spy).toHaveBeenCalledTimes(1);
      // verdict 가 변환 없이 그대로 forward 됨을 단언 — valid=false + errors 배열.
      const forwarded = spy.mock.calls[0][0];
      expect(forwarded.valid).toBe(false);
      expect(Array.isArray(forwarded.errors)).toBe(true);
      expect(forwarded.errors.length).toBeGreaterThan(0);
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // branch (b) — reject 메시지가 helper 산출 headline + detailLines 결합임을 단언.
    it("PARTIAL 허용 외 entity reject 메시지에 headline + detailLine 이 함께 노출", async () => {
      const { service } = buildService();

      let message = "";
      try {
        await service.createJob({
          scope: ExportScope.PARTIAL,
          requestedById: "user-1",
          entitySelector: ["Person", "Unknown"],
        });
      } catch (error) {
        message = (error as Error).message;
      }
      // headline + field 라벨 묶음 + 재입력 guidance(T-0463 산출 구조) 포함.
      expect(message).toContain(REJECTION_HEADLINE_PREFIX);
      expect(message).toContain("[대상 선택(entitySelector)]");
      expect(message).toContain("다시 시도하세요");
      // raw verdict 객체 직렬화(REQ-032 회피)가 아니라 사람-친화 라인 — "[object Object]" 부재.
      expect(message).not.toContain("[object Object]");
    });

    // branch (a) — valid verdict 분기에서는 helper 가 호출되지 않음(미호출 단언).
    it("valid scope 면 buildExportScopeRejection 을 호출하지 않는다", async () => {
      const { service, prisma } = buildService();
      prisma.exportJob.create.mockResolvedValue(buildExportJobFixture());
      const spy = jest.spyOn(
        rejectionMessageModule,
        "buildExportScopeRejection",
      );

      await service.createJob({
        scope: ExportScope.FULL,
        requestedById: "user-1",
      });

      expect(spy).not.toHaveBeenCalled();
      expect(prisma.exportJob.create).toHaveBeenCalledTimes(1);
    });

    // negative (早期 return) — 빈 requestedById 는 helper 호출 전 早期 throw → helper 미호출.
    it("빈 requestedById 는 helper 호출 전 早期 throw 라 buildExportScopeRejection 미호출", async () => {
      const { service, prisma } = buildService();
      const spy = jest.spyOn(
        rejectionMessageModule,
        "buildExportScopeRejection",
      );

      await expect(
        service.createJob({ scope: ExportScope.FULL, requestedById: "" }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(spy).not.toHaveBeenCalled();
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
    });

    // negative — reject 분기 메시지에 blocking=true 취지의 "시작되지 않습니다" guidance 포함.
    it("reject 메시지에 blocking 안내(검증 통과 전 Export 미시작)가 포함된다", async () => {
      const { service } = buildService();

      let message = "";
      try {
        await service.createJob({
          scope: ExportScope.RANGE,
          requestedById: "user-1",
        });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain("시작되지 않습니다");
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
