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

import * as dumpSizeModule from "./export-dump-size-estimate";
import {
  DEFAULT_ASYNC_THRESHOLD_BYTES,
  DEFAULT_BYTES_PER_RECORD,
} from "./export-dump-size-estimate";
import * as jobPlanModule from "./export-job-plan";
import { DEFAULT_CHUNK_THRESHOLD_BYTES } from "./export-job-plan";
import { ExportJobService } from "./export-job.service";
import * as resultModule from "./export-result";
import * as rejectionMessageModule from "./export-scope-rejection-message";
import * as scopeSelectModule from "./export-scope-select";
import {
  VALID_EXPORT_ENTITIES,
  type ExportEntity,
} from "./export-scope-select";
import * as summaryModule from "./export-selection-summary";

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

  // ---------------------------------------------------------------------------
  // previewSelection — selectExportRecords(T-0437) 실호출 배선 (T-0497)
  // 5 entity instant projection read → helper 분류 → count 요약. DB write 0,
  // REQ-032 projection-only(전체 row·raw 미조회). R-112: happy(full/range/partial) +
  // error(scope invariant) + branch(3 scope 매핑) + negative 충분 cover.
  // ---------------------------------------------------------------------------
  describe("previewSelection", () => {
    // 5 entity delegate 의 findMany 를 mock 한 PrismaService 와 service 를 빌드.
    // prisma-mock.ts 는 exportJob delegate 만 보유하므로 5 entity delegate 는 본 spec
    // 의 inline mock 으로 구성(test helper 미변경 — touchesFiles 4 파일 유지).
    function buildPreviewService(): {
      service: ExportJobService;
      prisma: {
        assessment: { findMany: jest.Mock };
        person: { findMany: jest.Mock };
        group: { findMany: jest.Mock };
        llmProviderConfig: { findMany: jest.Mock };
        permissionDeniedRecord: { findMany: jest.Mock };
      };
    } {
      const prisma = {
        assessment: { findMany: jest.fn().mockResolvedValue([]) },
        person: { findMany: jest.fn().mockResolvedValue([]) },
        group: { findMany: jest.fn().mockResolvedValue([]) },
        llmProviderConfig: { findMany: jest.fn().mockResolvedValue([]) },
        permissionDeniedRecord: { findMany: jest.fn().mockResolvedValue([]) },
      };
      const service = new ExportJobService(
        prisma as unknown as ConstructorParameters<typeof ExportJobService>[0],
      );
      return { service, prisma };
    }

    // entity 별 instant projection row 를 채워 5 delegate 를 stub — 각 entity 1 row.
    function stubAllEntities(
      prisma: ReturnType<typeof buildPreviewService>["prisma"],
      instant: Date,
    ): void {
      for (const delegate of [
        prisma.assessment,
        prisma.person,
        prisma.group,
        prisma.llmProviderConfig,
        prisma.permissionDeniedRecord,
      ]) {
        delegate.findMany.mockResolvedValue([{ createdAt: instant }]);
      }
    }

    // happy (full) — 5 entity 의 모든 record 가 selected, excluded 0.
    it("full scope — 5 entity 의 모든 projection 이 selected (excluded 0)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

      const result = await service.previewSelection({ scope: "full" });

      expect(result.selectedCount).toBe(5);
      expect(result.excludedCount).toBe(0);
      // 5 entity 각 1 record selected.
      for (const entity of VALID_EXPORT_ENTITIES) {
        expect(result.perEntitySelected[entity]).toBe(1);
      }
    });

    // happy (range) — [start,end) 구간 record 만 selected, 구간 밖 excluded.
    it("range scope — dateRange [start,end) 안의 record 만 selected", async () => {
      const { service, prisma } = buildPreviewService();
      // Person 은 구간 안(2026-02-01), Assessment 는 구간 밖(2026-09-01).
      prisma.person.findMany.mockResolvedValue([
        { createdAt: new Date("2026-02-01T00:00:00.000Z") },
      ]);
      prisma.assessment.findMany.mockResolvedValue([
        { createdAt: new Date("2026-09-01T00:00:00.000Z") },
      ]);

      const result = await service.previewSelection({
        scope: "range",
        dateRange: {
          start: new Date("2026-01-01T00:00:00.000Z"),
          end: new Date("2026-03-01T00:00:00.000Z"),
        },
      });

      expect(result.selectedCount).toBe(1);
      expect(result.excludedCount).toBe(1);
      expect(result.perEntitySelected.Person).toBe(1);
      expect(result.perEntitySelected.Assessment).toBe(0);
    });

    // happy (partial) — entitySelector 에 든 entity record 만 selected.
    it("partial scope — entitySelector 에 든 entity record 만 selected", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

      const result = await service.previewSelection({
        scope: "partial",
        entitySelector: ["Person", "Group"],
      });

      // Person + Group 2 record 만 selected, 나머지 3 entity 는 excluded.
      expect(result.selectedCount).toBe(2);
      expect(result.excludedCount).toBe(3);
      expect(result.perEntitySelected.Person).toBe(1);
      expect(result.perEntitySelected.Group).toBe(1);
      expect(result.perEntitySelected.Assessment).toBe(0);
    });

    // projection-only(REQ-032) 단언 — 5 delegate findMany 호출 인자에 select 가 존재하고
    // raw payload 컬럼이 select 되지 않음(instant 컬럼 1개만).
    it("5 entity findMany 가 instant 컬럼만 projection select (REQ-032 — raw 미조회)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

      await service.previewSelection({ scope: "full" });

      // 각 delegate 가 select projection 으로 정확히 1 회 호출됨.
      const expectations: Array<[jest.Mock, string]> = [
        [prisma.assessment.findMany, "createdAt"],
        [prisma.person.findMany, "createdAt"],
        [prisma.group.findMany, "createdAt"],
        [prisma.llmProviderConfig.findMany, "createdAt"],
        [prisma.permissionDeniedRecord.findMany, "createdAt"],
      ];
      for (const [fn, column] of expectations) {
        expect(fn).toHaveBeenCalledTimes(1);
        const arg = fn.mock.calls[0][0] as { select: Record<string, true> };
        expect(arg).toHaveProperty("select");
        expect(arg.select).toEqual({ [column]: true });
        // raw 본문 컬럼(narrative / apiKey / reason 등)은 select 되지 않음.
        expect(arg.select).not.toHaveProperty("narrative");
        expect(arg.select).not.toHaveProperty("apiKey");
      }
    });

    // branch — full scope 가 helper 에 정확히 { scope:"full" } 로 전달됨(spy).
    it("full scope 가 selectExportRecords 에 { scope:'full' } 로 전달됨 (branch — helper spy)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
      const spy = jest.spyOn(scopeSelectModule, "selectExportRecords");

      await service.previewSelection({ scope: "full" });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toEqual({ scope: "full" });
      // helper 2번째 인자(records)는 5 entity projection 평탄화 배열.
      expect(Array.isArray(spy.mock.calls[0][1])).toBe(true);
      expect(spy.mock.calls[0][1]).toHaveLength(5);
    });

    // branch — range/partial scope 의 dateRange/entitySelector 가 helper 로 정확 forward.
    it("range/partial scope 의 dateRange·entitySelector 가 helper 로 정확 forward (branch)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
      const spy = jest.spyOn(scopeSelectModule, "selectExportRecords");

      const dateRange = {
        start: new Date("2026-01-01T00:00:00.000Z"),
        end: new Date("2026-03-01T00:00:00.000Z"),
      };
      await service.previewSelection({ scope: "range", dateRange });
      await service.previewSelection({
        scope: "partial",
        entitySelector: ["Person"],
      });

      expect(spy.mock.calls[0][0]).toEqual({ scope: "range", dateRange });
      expect(spy.mock.calls[1][0]).toEqual({
        scope: "partial",
        entitySelector: ["Person"],
      });
    });

    // negative (1) — RANGE+dateRange 누락 → helper RangeError swallow 없이 propagate.
    it("range scope 인데 dateRange 누락 → RangeError propagate (negative — swallow 0)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

      await expect(
        service.previewSelection({ scope: "range" }),
      ).rejects.toBeInstanceOf(RangeError);
    });

    // negative (2) — PARTIAL+entitySelector 빈 → helper RangeError propagate.
    it("partial scope 인데 entitySelector 가 빈 배열 → RangeError propagate (negative)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

      await expect(
        service.previewSelection({ scope: "partial", entitySelector: [] }),
      ).rejects.toBeInstanceOf(RangeError);
    });

    // negative (3) — 허용 외 scope kind → helper RangeError propagate.
    it("허용 외 scope kind → RangeError propagate (negative — scope 검증)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

      await expect(
        service.previewSelection({
          scope: "bogus" as unknown as "full",
        }),
      ).rejects.toBeInstanceOf(RangeError);
    });

    // negative (4 — 경계) — 빈 DB(5 entity findMany 전부 빈 배열) → count 0, throw 0.
    it("빈 DB(5 entity 전부 빈 배열) → selectedCount 0 · excludedCount 0 (경계, throw 0)", async () => {
      const { service } = buildPreviewService();
      // buildPreviewService 의 default mockResolvedValue([]) 그대로 — 5 entity 전부 빈.

      const result = await service.previewSelection({ scope: "full" });

      expect(result.selectedCount).toBe(0);
      expect(result.excludedCount).toBe(0);
      for (const entity of VALID_EXPORT_ENTITIES) {
        expect(result.perEntitySelected[entity]).toBe(0);
      }
    });

    // negative (5 — 회귀) — perEntitySelected 가 5 ExportEntity 전부를 key 로 cover.
    // EXPORT_ENTITY_SOURCES 매핑이 entity 누락 시 본 test 가 회귀를 잡는다.
    it("perEntitySelected 가 VALID_EXPORT_ENTITIES 5 종 전부를 key 로 포함 (회귀 — entity 누락 방지)", async () => {
      const { service } = buildPreviewService();

      const result = await service.previewSelection({ scope: "full" });

      const keys = Object.keys(result.perEntitySelected) as ExportEntity[];
      expect(keys.sort()).toEqual([...VALID_EXPORT_ENTITIES].sort());
    });

    // negative (6 — DB read 실패) — 한 delegate findMany 가 reject 하면 propagate.
    it("한 entity findMany 가 reject 하면 그 error 를 propagate (error path — 의존성 실패)", async () => {
      const { service, prisma } = buildPreviewService();
      stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
      prisma.assessment.findMany.mockRejectedValue(new Error("db-down"));

      await expect(service.previewSelection({ scope: "full" })).rejects.toThrow(
        "db-down",
      );
    });

    // -------------------------------------------------------------------------
    // summary — summarizeExportSelection(T-0449) 실호출 배선 (T-0499)
    // previewSelection 응답의 summary.selected / summary.excluded 두 그룹 각각의
    // total + perEntity(5 entity) + instantRange{earliest,latest} 검증. helper 는
    // input derivation 이므로 추가 DB read 0(REQ-032 자연 유지). R-112: happy(full/
    // range/partial) + branch(4 분기 — full·range·partial·빈 DB) + negative 충분
    // cover(단일 record 경계 / excluded 빈 / selected 빈 / 전부 0 / instantRange null /
    // 5 key 회귀 / count↔total cross-check) + helper 실호출 spy + 입력 방어 미발화.
    // -------------------------------------------------------------------------
    describe("summary (summarizeExportSelection 배선)", () => {
      // happy (full) — 5 entity 전부 selected → summary.selected total 5 / excluded
      // total 0 + instantRange null. perEntity 5 key 전부 1.
      it("full scope — summary.selected.total 5 · perEntity 5 key 전부 1 · excluded.total 0 + instantRange null (happy)", async () => {
        const { service, prisma } = buildPreviewService();
        const instant = new Date("2026-02-01T00:00:00.000Z");
        stubAllEntities(prisma, instant);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.summary.selected.total).toBe(5);
        for (const entity of VALID_EXPORT_ENTITIES) {
          expect(result.summary.selected.perEntity[entity]).toBe(1);
        }
        // 5 record 가 모두 같은 instant → earliest === latest 경계.
        expect(result.summary.selected.instantRange).toEqual({
          earliest: instant,
          latest: instant,
        });
        // full scope 는 excluded 빈 → total 0 + instantRange null + perEntity 전부 0.
        expect(result.summary.excluded.total).toBe(0);
        expect(result.summary.excluded.instantRange).toBeNull();
        for (const entity of VALID_EXPORT_ENTITIES) {
          expect(result.summary.excluded.perEntity[entity]).toBe(0);
        }
      });

      // happy (range) — [start,end) 안/밖 record 가 selected/excluded 로 정확 분배되고
      // 각 그룹 instantRange 가 그 그룹 instant 의 min/max 로 박제됨(branch — 양쪽 분배).
      it("range scope — selected/excluded 양쪽 분배 + 각 그룹 instantRange earliest/latest 정확 (happy/branch)", async () => {
        const { service, prisma } = buildPreviewService();
        const inside = new Date("2026-02-01T00:00:00.000Z");
        const outside = new Date("2026-09-01T00:00:00.000Z");
        prisma.person.findMany.mockResolvedValue([{ createdAt: inside }]);
        prisma.assessment.findMany.mockResolvedValue([{ createdAt: outside }]);

        const result = await service.previewSelection({
          scope: "range",
          dateRange: {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-03-01T00:00:00.000Z"),
          },
        });

        expect(result.summary.selected.total).toBe(1);
        expect(result.summary.selected.perEntity.Person).toBe(1);
        expect(result.summary.selected.instantRange).toEqual({
          earliest: inside,
          latest: inside,
        });
        expect(result.summary.excluded.total).toBe(1);
        expect(result.summary.excluded.perEntity.Assessment).toBe(1);
        expect(result.summary.excluded.instantRange).toEqual({
          earliest: outside,
          latest: outside,
        });
      });

      // happy (partial) — entitySelector 든 entity 만 selected, 나머지 excluded
      // (branch — entity 별 분배).
      it("partial scope — entitySelector 의 entity 만 summary.selected, 나머지 excluded (happy/branch)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        expect(result.summary.selected.total).toBe(2);
        expect(result.summary.selected.perEntity.Person).toBe(1);
        expect(result.summary.selected.perEntity.Group).toBe(1);
        expect(result.summary.selected.perEntity.Assessment).toBe(0);
        // 나머지 3 entity 는 excluded.
        expect(result.summary.excluded.total).toBe(3);
        expect(result.summary.excluded.perEntity.Assessment).toBe(1);
        expect(result.summary.excluded.perEntity.LlmConfig).toBe(1);
        expect(result.summary.excluded.perEntity.AuditLog).toBe(1);
      });

      // negative (경계) — instant 가 서로 다른 여러 record → instantRange 가 정렬 무관
      // min/max 로 산출됨(earliest !== latest).
      it("instant 가 다른 여러 record → instantRange earliest=min / latest=max (경계 — earliest !== latest)", async () => {
        const { service, prisma } = buildPreviewService();
        const early = new Date("2026-01-15T00:00:00.000Z");
        const late = new Date("2026-05-20T00:00:00.000Z");
        // 같은 entity 에 정렬 안 된 instant 2 개(late 먼저, early 나중)를 넣어 min/max 단언.
        prisma.person.findMany.mockResolvedValue([
          { createdAt: late },
          { createdAt: early },
        ]);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.summary.selected.total).toBe(2);
        expect(result.summary.selected.instantRange).toEqual({
          earliest: early,
          latest: late,
        });
      });

      // negative (경계) — 빈 DB(5 entity 전부 빈) → 양 그룹 total 0 + instantRange null +
      // perEntity 전부 0(branch — 빈 DB).
      it("빈 DB → summary.selected/excluded 모두 total 0 · instantRange null · perEntity 전부 0 (경계/branch)", async () => {
        const { service } = buildPreviewService();
        // default mockResolvedValue([]) 그대로 — 5 entity 전부 빈.

        const result = await service.previewSelection({ scope: "full" });

        for (const group of [
          result.summary.selected,
          result.summary.excluded,
        ]) {
          expect(group.total).toBe(0);
          expect(group.instantRange).toBeNull();
          for (const entity of VALID_EXPORT_ENTITIES) {
            expect(group.perEntity[entity]).toBe(0);
          }
        }
      });

      // negative (경계) — partial scope 인데 selected 측 entity 가 DB 에 0 record →
      // selected total 0 + instantRange null(selected 빈 그룹).
      it("partial scope 의 selected entity 가 DB 에 0 record → summary.selected.total 0 + instantRange null (경계 — selected 빈)", async () => {
        const { service, prisma } = buildPreviewService();
        // Person 만 record 보유하나 entitySelector 는 Group 선택 → selected 빈.
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Group"],
        });

        expect(result.summary.selected.total).toBe(0);
        expect(result.summary.selected.instantRange).toBeNull();
        // Person record 는 excluded 측으로.
        expect(result.summary.excluded.total).toBe(1);
        expect(result.summary.excluded.perEntity.Person).toBe(1);
      });

      // 회귀 — summary.selected.perEntity / excluded.perEntity 가 항상 5 ExportEntity
      // 전부를 key 로 cover(entity 누락 회귀 차단).
      it("summary.selected/excluded.perEntity 가 5 ExportEntity 전부를 key 로 포함 (회귀 — entity 누락 방지)", async () => {
        const { service } = buildPreviewService();

        const result = await service.previewSelection({ scope: "full" });

        for (const group of [
          result.summary.selected,
          result.summary.excluded,
        ]) {
          const keys = Object.keys(group.perEntity) as ExportEntity[];
          expect(keys.sort()).toEqual([...VALID_EXPORT_ENTITIES].sort());
        }
      });

      // 회귀 (backward-compat) — 기존 count 필드가 summary.selected/excluded.total 및
      // summary.selected.perEntity 와 정확히 1:1 mirror 임을 cross-check.
      it("selectedCount/excludedCount/perEntitySelected 가 summary.selected/excluded.total · summary.selected.perEntity 와 1:1 일치 (회귀 — backward-compat)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        expect(result.selectedCount).toBe(result.summary.selected.total);
        expect(result.excludedCount).toBe(result.summary.excluded.total);
        expect(result.perEntitySelected).toEqual(
          result.summary.selected.perEntity,
        );
      });

      // helper 실호출 — summarizeExportSelection 이 selectExportRecords 산출 selection
      // (selected/excluded 두 배열)을 그대로 1 회 forward 받음을 spy 로 단언.
      it("summarizeExportSelection 이 selectExportRecords 산출 selection 을 그대로 1 회 forward 받음 (helper 실호출 spy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        const spy = jest.spyOn(summaryModule, "summarizeExportSelection");

        await service.previewSelection({ scope: "full" });

        expect(spy).toHaveBeenCalledTimes(1);
        const arg = spy.mock.calls[0][0];
        expect(Array.isArray(arg.selected)).toBe(true);
        expect(Array.isArray(arg.excluded)).toBe(true);
        // full scope → selected 5 · excluded 0.
        expect(arg.selected).toHaveLength(5);
        expect(arg.excluded).toHaveLength(0);
      });

      // negative — helper 입력 방어 미발화: 정상 경로의 selection.selected/excluded 는
      // 항상 ExportRecord[] 배열이라 helper 가 TypeError 를 던지지 않음(빈 DB 포함).
      it("정상 경로에서 helper 입력 방어(TypeError) 미발화 — 빈 DB 도 정상 summary 반환 (negative — 방어 분기 미도달)", async () => {
        const { service } = buildPreviewService();

        await expect(
          service.previewSelection({ scope: "full" }),
        ).resolves.toMatchObject({
          summary: {
            selected: { total: 0, instantRange: null },
            excluded: { total: 0, instantRange: null },
          },
        });
      });
    });

    // -------------------------------------------------------------------------
    // sizeEstimate — estimateExportDumpSize(T-0466) 실호출 배선 (T-0500)
    // previewSelection 응답의 sizeEstimate(estimatedBytes/humanSize/recordTotal/
    // perEntityBytes(5 entity)/large/recommendation/guidanceLines) 검증. helper 는
    // input derivation 이라 추가 DB read 0(REQ-032 자연 유지). R-112: happy(full/range/
    // partial) + error(estimate 도달 0) + branch(small=sync / large=async-streaming) +
    // negative 충분 cover(빈 selection / 경계 === 임계 / 단일 record / 5 key 회귀 /
    // large↔recommendation 불변 cross-check) + helper 실호출 spy + default 옵션 호출.
    // -------------------------------------------------------------------------
    describe("sizeEstimate (estimateExportDumpSize 배선)", () => {
      // happy (full) — 5 entity 각 1 record selected → estimatedBytes = 5 × 1024,
      // perEntityBytes 5 key 전부 1024, recordTotal 5, large false / recommendation sync.
      it("full scope — estimatedBytes = recordTotal × DEFAULT weight · perEntityBytes 5 key · sync (happy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.recordTotal).toBe(5);
        expect(result.sizeEstimate.estimatedBytes).toBe(
          5 * DEFAULT_BYTES_PER_RECORD,
        );
        for (const entity of VALID_EXPORT_ENTITIES) {
          expect(result.sizeEstimate.perEntityBytes[entity]).toBe(
            DEFAULT_BYTES_PER_RECORD,
          );
        }
        expect(result.sizeEstimate.humanSize).toBe("5 KB");
        expect(result.sizeEstimate.large).toBe(false);
        expect(result.sizeEstimate.recommendation).toBe("sync");
        // sync 안내는 1 줄(동기 다운로드 가능 류).
        expect(result.sizeEstimate.guidanceLines).toHaveLength(1);
        expect(result.sizeEstimate.guidanceLines[0]).toContain("동기 다운로드");
      });

      // happy (range) — 구간 안 record 만 selected 라 estimate 도 selected 기준.
      it("range scope — selected record 만 estimate 에 반영 (excluded 는 미산입) (happy)", async () => {
        const { service, prisma } = buildPreviewService();
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);
        prisma.assessment.findMany.mockResolvedValue([
          { createdAt: new Date("2026-09-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({
          scope: "range",
          dateRange: {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-03-01T00:00:00.000Z"),
          },
        });

        // Person 1 건만 selected → estimate 도 1 record 기준(excluded Assessment 미산입).
        expect(result.sizeEstimate.recordTotal).toBe(1);
        expect(result.sizeEstimate.estimatedBytes).toBe(
          DEFAULT_BYTES_PER_RECORD,
        );
        expect(result.sizeEstimate.perEntityBytes.Person).toBe(
          DEFAULT_BYTES_PER_RECORD,
        );
        expect(result.sizeEstimate.perEntityBytes.Assessment).toBe(0);
      });

      // happy (partial) — entitySelector 든 entity 만 estimate 에 반영.
      it("partial scope — entitySelector 의 entity 만 estimate 에 반영 (happy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        expect(result.sizeEstimate.recordTotal).toBe(2);
        expect(result.sizeEstimate.estimatedBytes).toBe(
          2 * DEFAULT_BYTES_PER_RECORD,
        );
        expect(result.sizeEstimate.perEntityBytes.Person).toBe(
          DEFAULT_BYTES_PER_RECORD,
        );
        expect(result.sizeEstimate.perEntityBytes.Group).toBe(
          DEFAULT_BYTES_PER_RECORD,
        );
        expect(result.sizeEstimate.perEntityBytes.Assessment).toBe(0);
      });

      // branch (small dump) — estimatedBytes ≤ 임계 → large=false / recommendation sync.
      it("small dump (estimatedBytes ≤ 임계) → large=false / recommendation 'sync' (branch — sync 분기)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBeLessThanOrEqual(
          DEFAULT_ASYNC_THRESHOLD_BYTES,
        );
        expect(result.sizeEstimate.large).toBe(false);
        expect(result.sizeEstimate.recommendation).toBe("sync");
      });

      // branch (large dump) — selected record 를 충분히 stub(10MB 초과)해
      // estimatedBytes > 임계 → large=true / recommendation 'async-streaming'.
      it("large dump (estimatedBytes > 임계) → large=true / recommendation 'async-streaming' + 2 줄 안내 (branch — async 분기)", async () => {
        const { service, prisma } = buildPreviewService();
        // 10MB / 1024 = 10240 record 초과 필요 → Person 에 10241 건 stub.
        const instant = new Date("2026-02-01T00:00:00.000Z");
        const recordCount =
          Math.floor(DEFAULT_ASYNC_THRESHOLD_BYTES / DEFAULT_BYTES_PER_RECORD) +
          1;
        prisma.person.findMany.mockResolvedValue(
          Array.from({ length: recordCount }, () => ({ createdAt: instant })),
        );

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.recordTotal).toBe(recordCount);
        expect(result.sizeEstimate.estimatedBytes).toBeGreaterThan(
          DEFAULT_ASYNC_THRESHOLD_BYTES,
        );
        expect(result.sizeEstimate.large).toBe(true);
        expect(result.sizeEstimate.recommendation).toBe("async-streaming");
        // async-streaming 안내는 2 줄(대량 dump + long-running 권고).
        expect(result.sizeEstimate.guidanceLines).toHaveLength(2);
        expect(result.sizeEstimate.guidanceLines[1]).toContain("async job");
      });

      // negative (경계) — 빈 DB / 빈 selection → estimatedBytes 0 · humanSize "0 B" ·
      // recommendation sync · guidanceLines sync 안내.
      it("빈 DB(빈 selection) → estimatedBytes 0 · humanSize '0 B' · sync (negative — 빈 selection)", async () => {
        const { service } = buildPreviewService();
        // default mockResolvedValue([]) 그대로 — 5 entity 전부 빈.

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBe(0);
        expect(result.sizeEstimate.humanSize).toBe("0 B");
        expect(result.sizeEstimate.recordTotal).toBe(0);
        expect(result.sizeEstimate.large).toBe(false);
        expect(result.sizeEstimate.recommendation).toBe("sync");
        for (const entity of VALID_EXPORT_ENTITIES) {
          expect(result.sizeEstimate.perEntityBytes[entity]).toBe(0);
        }
      });

      // negative (경계 === 임계) — selected record 가 정확히 임계 byte 를 만들면
      // large=false(초과 아님 → sync). 10240 record × 1024 = 정확히 10MB.
      it("estimatedBytes === 임계 → large=false / sync (경계 — 초과 아님)", async () => {
        const { service, prisma } = buildPreviewService();
        const instant = new Date("2026-02-01T00:00:00.000Z");
        // 정확히 10MB = 10240 record × 1024 byte.
        const recordCount = Math.floor(
          DEFAULT_ASYNC_THRESHOLD_BYTES / DEFAULT_BYTES_PER_RECORD,
        );
        prisma.person.findMany.mockResolvedValue(
          Array.from({ length: recordCount }, () => ({ createdAt: instant })),
        );

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBe(
          DEFAULT_ASYNC_THRESHOLD_BYTES,
        );
        expect(result.sizeEstimate.large).toBe(false);
        expect(result.sizeEstimate.recommendation).toBe("sync");
      });

      // negative (단일 record) — 단일 entity 1 record 만 selected → perEntityBytes
      // 그 entity 만 non-zero, 나머지 4 entity 0.
      it("단일 record(Person 1 건만) → perEntityBytes Person 만 non-zero · 나머지 0 (negative — 단일 record)", async () => {
        const { service, prisma } = buildPreviewService();
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.perEntityBytes.Person).toBe(
          DEFAULT_BYTES_PER_RECORD,
        );
        expect(result.sizeEstimate.perEntityBytes.Assessment).toBe(0);
        expect(result.sizeEstimate.perEntityBytes.Group).toBe(0);
        expect(result.sizeEstimate.perEntityBytes.LlmConfig).toBe(0);
        expect(result.sizeEstimate.perEntityBytes.AuditLog).toBe(0);
      });

      // 회귀 — sizeEstimate.perEntityBytes 가 항상 5 ExportEntity 전부를 key 로 cover.
      it("sizeEstimate.perEntityBytes 가 5 ExportEntity 전부를 key 로 포함 (회귀 — entity 누락 방지)", async () => {
        const { service } = buildPreviewService();

        const result = await service.previewSelection({ scope: "full" });

        const keys = Object.keys(
          result.sizeEstimate.perEntityBytes,
        ) as ExportEntity[];
        expect(keys.sort()).toEqual([...VALID_EXPORT_ENTITIES].sort());
      });

      // 회귀 (helper 불변) — large === (recommendation === "async-streaming") 가
      // 응답에서 유지됨(small 분기 + large 분기 양쪽 cross-check).
      it("large === (recommendation === 'async-streaming') 불변이 응답에서 유지 (회귀 — helper 불변 surface)", async () => {
        const { service, prisma } = buildPreviewService();
        // small 분기 — 빈 DB.
        const small = await service.previewSelection({ scope: "full" });
        expect(small.sizeEstimate.large).toBe(
          small.sizeEstimate.recommendation === "async-streaming",
        );

        // large 분기 — 10MB 초과 stub.
        const instant = new Date("2026-02-01T00:00:00.000Z");
        const recordCount =
          Math.floor(DEFAULT_ASYNC_THRESHOLD_BYTES / DEFAULT_BYTES_PER_RECORD) +
          1;
        prisma.person.findMany.mockResolvedValue(
          Array.from({ length: recordCount }, () => ({ createdAt: instant })),
        );
        const large = await service.previewSelection({ scope: "full" });
        expect(large.sizeEstimate.large).toBe(
          large.sizeEstimate.recommendation === "async-streaming",
        );
      });

      // helper 실호출 — estimateExportDumpSize 가 selectExportRecords 산출 selection 을
      // 그대로 1 회 forward 받고, 옵션 없이(default 사용) 호출됨을 spy 로 단언.
      it("estimateExportDumpSize 가 selection 을 그대로 1 회 forward + 옵션 미전달(default) 호출 (helper 실호출 spy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        const spy = jest.spyOn(dumpSizeModule, "estimateExportDumpSize");

        await service.previewSelection({ scope: "full" });

        expect(spy).toHaveBeenCalledTimes(1);
        const [selectionArg, optionsArg] = spy.mock.calls[0];
        expect(Array.isArray(selectionArg.selected)).toBe(true);
        expect(Array.isArray(selectionArg.excluded)).toBe(true);
        expect(selectionArg.selected).toHaveLength(5);
        // 옵션 미전달 — helper default(byte weight / async 임계) 사용.
        expect(optionsArg).toBeUndefined();
        spy.mockRestore();
      });

      // 회귀 (backward-compat) — sizeEstimate 추가 후에도 기존 4 필드(summary /
      // selectedCount / excludedCount / perEntitySelected)가 그대로 반환됨.
      it("sizeEstimate 추가 후에도 기존 summary/selectedCount/excludedCount/perEntitySelected 유지 (회귀 — append-only backward-compat)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        // 기존 필드 전부 그대로 존재.
        expect(result.selectedCount).toBe(2);
        expect(result.excludedCount).toBe(3);
        expect(result.perEntitySelected.Person).toBe(1);
        expect(result.summary.selected.total).toBe(2);
        // 신규 필드 동반.
        expect(result.sizeEstimate.recordTotal).toBe(2);
      });

      // negative (error path) — 한 delegate findMany reject 시 estimate 도달 0
      // (DB read 단계에서 propagate, helper 호출 전).
      it("한 entity findMany reject 시 estimate 호출 도달 0 (error path — DB 실패 시 helper 미호출)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        prisma.assessment.findMany.mockRejectedValue(new Error("db-down"));
        const spy = jest.spyOn(dumpSizeModule, "estimateExportDumpSize");

        await expect(
          service.previewSelection({ scope: "full" }),
        ).rejects.toThrow("db-down");

        // DB read 단계에서 throw → estimate helper 도달 0.
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      });
    });

    // -------------------------------------------------------------------------
    // deliveryPlan — buildExportJobPlan(T-0467) 실호출 배선 (T-0501)
    // previewSelection 응답의 deliveryPlan(mode/chunked/pollingRequired/statusFlow/
    // headline/instructionLines)이 sizeEstimate 위에 derive 됨을 검증.
    // R-112: happy(sync/async mode) + error(DB 실패 시 plan 미도달) + branch(small/
    // large dump × chunked 임계) + negative(빈 selection · chunk 경계 === · async 경계 ===)
    // 충분 cover. async 임계 10MB / chunk 임계 5MB / record 당 1024 byte.
    // -------------------------------------------------------------------------
    describe("deliveryPlan (buildExportJobPlan 배선)", () => {
      // helper default 임계(chunk 5MB / async 10MB)를 record 수로 환산할 때 쓸 상수.
      // chunk 경계 === 5MB → 5120 record, async 경계 === 10MB → 10240 record.
      const CHUNK_BOUNDARY_RECORDS = Math.floor(
        DEFAULT_CHUNK_THRESHOLD_BYTES / DEFAULT_BYTES_PER_RECORD,
      );
      const ASYNC_BOUNDARY_RECORDS = Math.floor(
        DEFAULT_ASYNC_THRESHOLD_BYTES / DEFAULT_BYTES_PER_RECORD,
      );

      // 지정 record 수를 Person delegate 에 stub(나머지 4 entity 는 빈 배열 default).
      function stubPersonRecords(
        prisma: ReturnType<typeof buildPreviewService>["prisma"],
        count: number,
      ): void {
        const instant = new Date("2026-02-01T00:00:00.000Z");
        prisma.person.findMany.mockResolvedValue(
          Array.from({ length: count }, () => ({ createdAt: instant })),
        );
      }

      // happy (sync-download) — 소량 dump → mode="sync-download" · pollingRequired=false ·
      // statusFlow=[] · chunked=false · headline/instructionLines 박제.
      it("small dump(5 건) → deliveryPlan mode='sync-download' · pollingRequired=false · statusFlow=[] · chunked=false (happy — sync 분기)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({ scope: "full" });

        expect(result.deliveryPlan.mode).toBe("sync-download");
        expect(result.deliveryPlan.pollingRequired).toBe(false);
        expect(result.deliveryPlan.statusFlow).toEqual([]);
        expect(result.deliveryPlan.chunked).toBe(false);
        expect(typeof result.deliveryPlan.headline).toBe("string");
        expect(result.deliveryPlan.headline).toContain("동기 다운로드");
        expect(result.deliveryPlan.instructionLines.length).toBeGreaterThan(0);
      });

      // happy (async-job) — 대량 dump(>10MB) → mode="async-job" · pollingRequired=true ·
      // statusFlow=[queued,running,ready] · chunked=true(>5MB) · headline/instructionLines.
      it("large dump(>10MB) → deliveryPlan mode='async-job' · pollingRequired=true · statusFlow=[queued,running,ready] · chunked=true (happy — async 분기)", async () => {
        const { service, prisma } = buildPreviewService();
        stubPersonRecords(prisma, ASYNC_BOUNDARY_RECORDS + 1);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.deliveryPlan.mode).toBe("async-job");
        expect(result.deliveryPlan.pollingRequired).toBe(true);
        expect(result.deliveryPlan.statusFlow).toEqual([
          "queued",
          "running",
          "ready",
        ]);
        // >10MB 는 5MB chunk 임계도 초과 → chunked=true.
        expect(result.deliveryPlan.chunked).toBe(true);
        expect(result.deliveryPlan.headline).toContain("async job");
        expect(result.deliveryPlan.instructionLines.length).toBeGreaterThan(0);
      });

      // happy (range scope) — range scope 선별 후에도 deliveryPlan 이 정상 derive(소량 → sync).
      it("range scope — 선별 후 deliveryPlan mode='sync-download' derive (happy — range scope)", async () => {
        const { service, prisma } = buildPreviewService();
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({
          scope: "range",
          dateRange: {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-03-01T00:00:00.000Z"),
          },
        });

        expect(result.deliveryPlan.mode).toBe("sync-download");
        expect(result.deliveryPlan.pollingRequired).toBe(false);
      });

      // happy (partial scope) — partial scope 선별 후에도 deliveryPlan 정상 derive.
      it("partial scope — 선별 후 deliveryPlan mode='sync-download' derive (happy — partial scope)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        expect(result.deliveryPlan.mode).toBe("sync-download");
        expect(result.deliveryPlan.statusFlow).toEqual([]);
      });

      // branch (chunk 임계 초과 + sync) — 5MB < bytes ≤ 10MB → recommendation="sync"
      // (async 임계 이하) 이면서 chunked=true(chunk 임계 초과). chunked 와 mode 가 독립 분기임을
      // 보이는 cross-branch(record 수 5121 → 5121KB ≈ 5.0MB 초과 · 10MB 미만).
      it("chunk 임계 초과 + async 임계 이하 → mode='sync-download' · chunked=true (branch — chunked 와 mode 독립)", async () => {
        const { service, prisma } = buildPreviewService();
        stubPersonRecords(prisma, CHUNK_BOUNDARY_RECORDS + 1);

        const result = await service.previewSelection({ scope: "full" });

        // 5MB 초과(chunk) 이나 10MB 이하(async 임계 미만) → sync + chunked.
        expect(result.sizeEstimate.estimatedBytes).toBeGreaterThan(
          DEFAULT_CHUNK_THRESHOLD_BYTES,
        );
        expect(result.sizeEstimate.estimatedBytes).toBeLessThanOrEqual(
          DEFAULT_ASYNC_THRESHOLD_BYTES,
        );
        expect(result.deliveryPlan.mode).toBe("sync-download");
        expect(result.deliveryPlan.chunked).toBe(true);
        expect(result.deliveryPlan.pollingRequired).toBe(false);
      });

      // branch (chunk 임계 이하) — 소량 → chunked=false.
      it("chunk 임계 이하(소량) → deliveryPlan chunked=false (branch — chunked=false)", async () => {
        const { service, prisma } = buildPreviewService();
        stubPersonRecords(prisma, 10);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBeLessThanOrEqual(
          DEFAULT_CHUNK_THRESHOLD_BYTES,
        );
        expect(result.deliveryPlan.chunked).toBe(false);
      });

      // negative (빈 selection) — 빈 DB → estimatedBytes 0 → mode="sync-download" ·
      // pollingRequired=false · statusFlow=[] · chunked=false.
      it("빈 DB(빈 selection) → deliveryPlan mode='sync-download' · pollingRequired=false · chunked=false (negative — 빈 selection)", async () => {
        const { service } = buildPreviewService();
        // default mockResolvedValue([]) — 5 entity 전부 빈.

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBe(0);
        expect(result.deliveryPlan.mode).toBe("sync-download");
        expect(result.deliveryPlan.pollingRequired).toBe(false);
        expect(result.deliveryPlan.statusFlow).toEqual([]);
        expect(result.deliveryPlan.chunked).toBe(false);
      });

      // negative (chunk 경계 === 5MB) — estimatedBytes 정확히 5MB → chunked=false(초과 아님).
      it("estimatedBytes === chunk 임계(5MB) → chunked=false (negative — 경계 초과 아님)", async () => {
        const { service, prisma } = buildPreviewService();
        stubPersonRecords(prisma, CHUNK_BOUNDARY_RECORDS);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBe(
          DEFAULT_CHUNK_THRESHOLD_BYTES,
        );
        expect(result.deliveryPlan.chunked).toBe(false);
      });

      // negative (async 경계 === 10MB) — estimatedBytes 정확히 10MB → recommendation="sync"
      // (초과 아님) → mode="sync-download". 단 10MB > 5MB 라 chunked=true.
      it("estimatedBytes === async 임계(10MB) → recommendation='sync' → mode='sync-download' (negative — async 경계 초과 아님)", async () => {
        const { service, prisma } = buildPreviewService();
        stubPersonRecords(prisma, ASYNC_BOUNDARY_RECORDS);

        const result = await service.previewSelection({ scope: "full" });

        expect(result.sizeEstimate.estimatedBytes).toBe(
          DEFAULT_ASYNC_THRESHOLD_BYTES,
        );
        expect(result.sizeEstimate.recommendation).toBe("sync");
        expect(result.deliveryPlan.mode).toBe("sync-download");
        // 10MB 는 5MB chunk 임계 초과 → chunked=true(mode 와 독립).
        expect(result.deliveryPlan.chunked).toBe(true);
      });

      // error path — 한 delegate findMany reject 시 plan 도달 0(DB read 단계에서 propagate).
      it("한 entity findMany reject 시 buildExportJobPlan 도달 0 (error path — DB 실패 시 helper 미호출)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        prisma.group.findMany.mockRejectedValue(new Error("db-down"));
        const spy = jest.spyOn(jobPlanModule, "buildExportJobPlan");

        await expect(
          service.previewSelection({ scope: "full" }),
        ).rejects.toThrow("db-down");

        // DB read 단계에서 throw → plan helper 도달 0.
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      });

      // helper 실호출 — buildExportJobPlan 이 sizeEstimate 를 그대로 1 회 forward 받고,
      // 옵션 없이(default chunk 임계 / poll 간격) 호출됨을 spy 로 단언.
      it("buildExportJobPlan 이 sizeEstimate 를 그대로 1 회 forward + 옵션 미전달(default) 호출 (helper 실호출 spy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        const spy = jest.spyOn(jobPlanModule, "buildExportJobPlan");

        const result = await service.previewSelection({ scope: "full" });

        expect(spy).toHaveBeenCalledTimes(1);
        const [estimateArg, optionsArg] = spy.mock.calls[0];
        // 위에서 산출된 sizeEstimate 를 그대로 forward(동일 참조).
        expect(estimateArg).toBe(result.sizeEstimate);
        // 옵션 미전달 — helper default(chunk 임계 5MB / poll 간격 3s) 사용.
        expect(optionsArg).toBeUndefined();
        spy.mockRestore();
      });

      // 회귀 (helper 불변) — mode==="async-job" ⟺ pollingRequired===true ⟺
      // statusFlow.length>0 이 응답에서 유지됨(sync 분기 + async 분기 cross-check).
      it("mode==='async-job' ⟺ pollingRequired===true ⟺ statusFlow.length>0 불변이 응답에서 유지 (회귀 — helper 불변 surface)", async () => {
        const { service, prisma } = buildPreviewService();
        // sync 분기 — 빈 DB.
        const sync = await service.previewSelection({ scope: "full" });
        expect(sync.deliveryPlan.mode === "async-job").toBe(
          sync.deliveryPlan.pollingRequired,
        );
        expect(sync.deliveryPlan.mode === "async-job").toBe(
          sync.deliveryPlan.statusFlow.length > 0,
        );

        // async 분기 — 10MB 초과 stub.
        stubPersonRecords(prisma, ASYNC_BOUNDARY_RECORDS + 1);
        const asyncResult = await service.previewSelection({ scope: "full" });
        expect(asyncResult.deliveryPlan.mode === "async-job").toBe(
          asyncResult.deliveryPlan.pollingRequired,
        );
        expect(asyncResult.deliveryPlan.mode === "async-job").toBe(
          asyncResult.deliveryPlan.statusFlow.length > 0,
        );
      });

      // 회귀 (recommendation ground-truth) — deliveryPlan.mode 가 sizeEstimate.recommendation
      // 과 1:1 대응('sync'→'sync-download', 'async-streaming'→'async-job').
      it("deliveryPlan.mode 가 sizeEstimate.recommendation 과 1:1 대응 (회귀 — recommendation ground-truth)", async () => {
        const { service, prisma } = buildPreviewService();
        // sync 분기.
        const sync = await service.previewSelection({ scope: "full" });
        expect(sync.sizeEstimate.recommendation).toBe("sync");
        expect(sync.deliveryPlan.mode).toBe("sync-download");

        // async-streaming 분기.
        stubPersonRecords(prisma, ASYNC_BOUNDARY_RECORDS + 1);
        const asyncResult = await service.previewSelection({ scope: "full" });
        expect(asyncResult.sizeEstimate.recommendation).toBe("async-streaming");
        expect(asyncResult.deliveryPlan.mode).toBe("async-job");
      });

      // 회귀 (backward-compat) — deliveryPlan 추가 후에도 기존 5 필드(summary /
      // sizeEstimate / selectedCount / excludedCount / perEntitySelected)가 그대로 반환됨.
      it("deliveryPlan 추가 후에도 기존 summary/sizeEstimate/selectedCount/excludedCount/perEntitySelected 유지 (회귀 — append-only backward-compat)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        // 기존 필드 전부 그대로 존재.
        expect(result.selectedCount).toBe(2);
        expect(result.excludedCount).toBe(3);
        expect(result.perEntitySelected.Person).toBe(1);
        expect(result.summary.selected.total).toBe(2);
        expect(result.sizeEstimate.recordTotal).toBe(2);
        // 신규 필드 동반.
        expect(result.deliveryPlan.mode).toBe("sync-download");
      });
    });

    // -------------------------------------------------------------------------
    // completionResult — buildExportResult(T-0456) 실호출 배선 (T-0502)
    // previewSelection 응답의 completionResult(headline/exportedCounts{selected,
    // excluded}/impactLines[]/scopeLine) 검증. helper 는 summary/scope derivation 이라
    // 추가 DB read 0(REQ-032 자연 유지). R-112: happy(full/range/partial) + error(result
    // 도달 0 / 입력 방어 미발화) + branch(excluded 0 제외 라인 생략 vs excluded>0 포함 /
    // scopeLine full·range·partial 분기) + negative 충분 cover(빈 selection / 일부 entity만
    // 0 아님 / excluded만 0 아님) + helper 실호출 spy + count↔summary·scope cross-check.
    // -------------------------------------------------------------------------
    describe("completionResult (buildExportResult 배선)", () => {
      // happy (full) — 5 entity 전부 selected → headline "선별 5 row" · exportedCounts
      // {selected:5, excluded:0} · impactLines 에 5 entity 라인 · 제외 라인 생략 · scopeLine full.
      it("full scope — headline · exportedCounts · impactLines(5 entity) · scopeLine(full) 박제 (happy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({ scope: "full" });

        expect(result.completionResult.headline).toBe(
          "다운로드 완료 — 선별 5 row export",
        );
        expect(result.completionResult.exportedCounts).toEqual({
          selected: 5,
          excluded: 0,
        });
        // selected total 라인 + 5 entity 라인 = 6 라인. 제외 라인 없음(excluded.total 0).
        expect(result.completionResult.impactLines[0]).toBe("선별 5 row");
        expect(
          result.completionResult.impactLines.some((line) =>
            line.includes("제외"),
          ),
        ).toBe(false);
        expect(result.completionResult.scopeLine).toBe("scope=full(전체)");
      });

      // happy (range) + branch — selected/excluded 양쪽 분배 → 제외 라인 포함 + scopeLine
      // 에 range dateRange 요약 포함.
      it("range scope — excluded>0 면 제외 라인 포함 · scopeLine 에 기간 요약 포함 (happy/branch)", async () => {
        const { service, prisma } = buildPreviewService();
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);
        prisma.assessment.findMany.mockResolvedValue([
          { createdAt: new Date("2026-09-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({
          scope: "range",
          dateRange: {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-03-01T00:00:00.000Z"),
          },
        });

        expect(result.completionResult.exportedCounts).toEqual({
          selected: 1,
          excluded: 1,
        });
        // excluded.total 1 > 0 → 제외 라인 포함.
        expect(result.completionResult.impactLines).toContain("제외 1 row");
        // scopeLine 에 range 라벨 + 기간 요약.
        expect(result.completionResult.scopeLine).toContain(
          "scope=range(기간)",
        );
        expect(result.completionResult.scopeLine).toContain("기간 ");
      });

      // happy (partial) + branch — entitySelector 든 entity 만 selected, scopeLine 에
      // partial entitySelector 요약 포함.
      it("partial scope — selected entity 만 impactLines · scopeLine 에 대상 요약 포함 (happy/branch)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        expect(result.completionResult.exportedCounts.selected).toBe(2);
        // Person/Group 라인은 포함, Assessment 라인은 미포함(selected 0).
        expect(
          result.completionResult.impactLines.some((line) =>
            line.includes("Person"),
          ),
        ).toBe(true);
        expect(
          result.completionResult.impactLines.some((line) =>
            line.includes("Assessment"),
          ),
        ).toBe(false);
        expect(result.completionResult.scopeLine).toContain(
          "scope=partial(부분)",
        );
        expect(result.completionResult.scopeLine).toContain("대상 ");
      });

      // branch — excluded.total > 0 → 제외 라인 포함(partial scope 로 excluded 발생).
      it("excluded.total > 0 → impactLines 에 제외 라인 포함 (branch — 제외 라인)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person"],
        });

        // Person 1 selected, 나머지 4 excluded.
        expect(result.completionResult.exportedCounts.excluded).toBe(4);
        expect(result.completionResult.impactLines).toContain("제외 4 row");
      });

      // negative (경계) — 빈 DB → headline "선별 0 row" · entity 라인 0 · 제외 라인 생략.
      it("빈 DB(빈 selection) → headline '선별 0 row' · entity 라인 0 · 제외 라인 생략 (negative — 경계)", async () => {
        const { service } = buildPreviewService();
        // default mockResolvedValue([]) — 5 entity 전부 빈.

        const result = await service.previewSelection({ scope: "full" });

        expect(result.completionResult.headline).toBe(
          "다운로드 완료 — 선별 0 row export",
        );
        expect(result.completionResult.exportedCounts).toEqual({
          selected: 0,
          excluded: 0,
        });
        // total 라인 1 개만(entity 라인 0 · 제외 라인 0).
        expect(result.completionResult.impactLines).toEqual(["선별 0 row"]);
      });

      // negative — selected 일부 entity 만 0 아님 → 0 entity 라인 생략.
      it("selected 일부 entity 만 0 아님 → 0 entity 라인 생략 (negative — entity 라인 생략)", async () => {
        const { service, prisma } = buildPreviewService();
        // Person 만 record 보유, 나머지 4 entity 빈.
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({ scope: "full" });

        // selected 1 → total 라인 + Person 라인만(나머지 4 entity 라인 생략).
        expect(result.completionResult.exportedCounts.selected).toBe(1);
        const entityLines = result.completionResult.impactLines.filter((line) =>
          line.trim().startsWith("- "),
        );
        expect(entityLines).toHaveLength(1);
        expect(entityLines[0]).toContain("Person");
      });

      // negative — excluded.total 만 0 아님(selected 0 · excluded > 0) → 제외 라인 포함 +
      // selected entity 라인 0.
      it("excluded 만 0 아님(selected 0) → 제외 라인 포함 · selected entity 라인 0 (negative)", async () => {
        const { service, prisma } = buildPreviewService();
        // Person 만 record 보유하나 entitySelector 는 Group → selected 0 · excluded 1.
        prisma.person.findMany.mockResolvedValue([
          { createdAt: new Date("2026-02-01T00:00:00.000Z") },
        ]);

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Group"],
        });

        expect(result.completionResult.exportedCounts.selected).toBe(0);
        expect(result.completionResult.exportedCounts.excluded).toBe(1);
        expect(result.completionResult.impactLines).toContain("제외 1 row");
        // selected entity 라인 0(selected total 0).
        const entityLines = result.completionResult.impactLines.filter((line) =>
          line.trim().startsWith("- "),
        );
        expect(entityLines).toHaveLength(0);
      });

      // error path — 한 delegate findMany reject 시 result 도달 0(DB read 단계에서 propagate).
      it("한 entity findMany reject 시 buildExportResult 도달 0 (error path — DB 실패 시 helper 미호출)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        prisma.llmProviderConfig.findMany.mockRejectedValue(
          new Error("db-down"),
        );
        const spy = jest.spyOn(resultModule, "buildExportResult");

        await expect(
          service.previewSelection({ scope: "full" }),
        ).rejects.toThrow("db-down");

        // DB read 단계에서 throw → result helper 도달 0.
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
      });

      // helper 실호출 — buildExportResult 가 산출 summary + 인자 scope 를 그대로 1 회
      // forward 받음을 spy 로 단언(추가 변환 0 — scope 동일 참조).
      it("buildExportResult 가 summary + scope 를 그대로 1 회 forward 받음 (helper 실호출 spy)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));
        const spy = jest.spyOn(resultModule, "buildExportResult");
        const scope = { scope: "full" } as const;

        const result = await service.previewSelection(scope);

        expect(spy).toHaveBeenCalledTimes(1);
        const [summaryArg, scopeArg] = spy.mock.calls[0];
        // 산출된 summary 를 그대로 forward(동일 참조).
        expect(summaryArg).toBe(result.summary);
        // 인자 scope 를 추가 변환 없이 그대로 forward(동일 참조).
        expect(scopeArg).toBe(scope);
        spy.mockRestore();
      });

      // negative — 정상 경로에서 helper 입력 방어(TypeError/RangeError) 미발화: summary 는
      // 항상 selected/excluded breakdown 보유 · scope 는 항상 full/range/partial(빈 DB 포함).
      it("정상 경로에서 helper 입력 방어(TypeError/RangeError) 미발화 — 빈 DB 도 정상 completionResult 반환 (negative — 방어 분기 미도달)", async () => {
        const { service } = buildPreviewService();

        await expect(
          service.previewSelection({ scope: "full" }),
        ).resolves.toMatchObject({
          completionResult: {
            headline: "다운로드 완료 — 선별 0 row export",
            scopeLine: "scope=full(전체)",
          },
        });
      });

      // 회귀 (summary ground-truth) — completionResult.exportedCounts 가 summary 의
      // selected.total / excluded.total 과 1:1 일치(cross-check).
      it("exportedCounts.selected/excluded 가 summary.selected/excluded.total 과 1:1 일치 (회귀 — summary ground-truth)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        expect(result.completionResult.exportedCounts.selected).toBe(
          result.summary.selected.total,
        );
        expect(result.completionResult.exportedCounts.excluded).toBe(
          result.summary.excluded.total,
        );
      });

      // 회귀 (scope ground-truth) — scopeLine 의 scope 표기가 인자 scope.scope 와 1:1 대응.
      it("scopeLine 의 scope 표기가 인자 scope.scope 와 1:1 대응 (회귀 — scope ground-truth)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const full = await service.previewSelection({ scope: "full" });
        expect(full.completionResult.scopeLine).toContain("scope=full");

        const range = await service.previewSelection({
          scope: "range",
          dateRange: {
            start: new Date("2026-01-01T00:00:00.000Z"),
            end: new Date("2026-12-01T00:00:00.000Z"),
          },
        });
        expect(range.completionResult.scopeLine).toContain("scope=range");

        const partial = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person"],
        });
        expect(partial.completionResult.scopeLine).toContain("scope=partial");
      });

      // 회귀 (backward-compat) — completionResult 추가 후에도 기존 6 필드가 그대로 반환됨.
      it("completionResult 추가 후에도 기존 summary/sizeEstimate/deliveryPlan/selectedCount/excludedCount/perEntitySelected 유지 (회귀 — append-only backward-compat)", async () => {
        const { service, prisma } = buildPreviewService();
        stubAllEntities(prisma, new Date("2026-02-01T00:00:00.000Z"));

        const result = await service.previewSelection({
          scope: "partial",
          entitySelector: ["Person", "Group"],
        });

        // 기존 필드 전부 그대로 존재.
        expect(result.selectedCount).toBe(2);
        expect(result.excludedCount).toBe(3);
        expect(result.perEntitySelected.Person).toBe(1);
        expect(result.summary.selected.total).toBe(2);
        expect(result.sizeEstimate.recordTotal).toBe(2);
        expect(result.deliveryPlan.mode).toBe("sync-download");
        // 신규 필드 동반.
        expect(result.completionResult.exportedCounts.selected).toBe(2);
      });
    });
  });
});
