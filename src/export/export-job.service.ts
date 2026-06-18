// ExportJobService — ExportJob 의 생성·status 전이·polling 조회 persistence service
// (T-0486, ADR-0044 §Follow-ups 두 번째 항목의 dependency-order 첫 slice).
//
// 위상 (P7 export/import 실 배선 chain step3):
//   - step1 (T-0484, ADR-0044) 이 ExportJob/ImportJob 영속 데이터 모델을 박제하고,
//     step2 (T-0485) 가 prisma/schema.prisma 에 model ExportJob + enum + migration 을
//     merge 했다. 본 service 가 그 entity 를 실제로 읽고 쓰는 첫 코드다.
//   - UC-07 §8 NFR 의 "async job + status polling" backbone 을 코드 차원에서 채운다 —
//     생성(createJob) → status 전이(markRunning/markSucceeded/markFailed) → 조회
//     (findJob/findRunning) 의 ExportJob 생명주기를 PrismaService 위에 얇게 wrapping.
//
// 책임 경계 (task §Out of Scope):
//   - export controller / DTO (GET /api/admin/export) 배선 — 후속 task.
//   - ImportJobService (atomic transaction §3) — 후속 task (대칭이나 별도 slice).
//   - 45 helper (T-0437~T-0483) 실호출 배선 (chunked streaming·dedup) — 후속 chain.
//   - module 등록 (ExportModule / AssessmentModule 편입) — 후속 task (본 task 는 class +
//     spec 만; 미등록이어도 unit test 통과).
//   - 실 dump 직렬화 (DB row → artifact) — 본 service 는 status/artifactRef record 만.
//
// Prisma error 정책 (person.service.ts 컨벤션 mirror):
//   - findJob / mark* 가 row 부재 시 Prisma 의 P2025 (record not found) 를
//     NotFoundException 으로 변환한다. 그 외 known error code 는 그대로 propagate.
//   - raw 미저장 invariant (ADR-0044 §2) — createJob 의 input 에 raw payload 필드 자체가
//     없다. error 는 사람-친화 short message 만 record (raw stack trace 미저장).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExportScope, Prisma, type ExportJob } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// Prisma known error helper — `code` field 가 known request error 의 식별자.
// 실 PrismaClientKnownRequestError 인스턴스 생성 cost 를 회피하고 duck typing 으로
// code 만 추출한다 (전 service 의 동일 helper 패턴 mirror — person.service.ts 등).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// CreateExportJobInput — createJob 의 입력 shape. raw payload 필드 0 (ADR-0044 §2 —
// ExportJob 의 어떤 필드도 raw 외부 본문을 보유하지 않으며 input 도 동일).
//   - scope — dump 범위 (FULL / RANGE / PARTIAL).
//   - requestedById — 발화한 User FK scalar (REQ-045 Admin, ADR-0044 §1 누가 dump 를
//     일으켰는지 추적).
//   - dateRange — scope=RANGE 시 기간 한정값 (Json 직렬화). 구체 shape 은 후속 task.
//   - entitySelector — scope=PARTIAL 시 entity·인원 한정값 (Json 직렬화).
export interface CreateExportJobInput {
  scope: ExportScope;
  requestedById: string;
  dateRange?: unknown;
  entitySelector?: unknown;
}

@Injectable()
export class ExportJobService {
  constructor(private readonly prisma: PrismaService) {}

  // createJob — status=PENDING ExportJob row 를 생성한다.
  // scope invariant 검증 (schema 주석 L549 "service-layer 가 값 invariant 검증 책임"):
  //   - requestedById 가 비었으면 BadRequestException (FK 발화자 필수).
  //   - scope=FULL 인데 dateRange/entitySelector 가 넘어오면 BadRequestException
  //     (FULL 은 전체 entity 전 기간 — 한정값과 모순, ADR-0044 §1).
  //   - scope=RANGE 인데 dateRange 누락 시 BadRequestException (기간 한정의 필수 축).
  //   - scope=PARTIAL 인데 entitySelector 누락 시 BadRequestException (한정의 필수 축).
  async createJob(input: CreateExportJobInput): Promise<ExportJob> {
    this.assertScopeInvariant(input);

    return this.prisma.exportJob.create({
      data: {
        scope: input.scope,
        requestedById: input.requestedById,
        // null 정규화 — scope 별 미사용 축은 명시적 null (schema nullable Json?).
        dateRange: this.toJsonOrNull(input.dateRange),
        entitySelector: this.toJsonOrNull(input.entitySelector),
      },
    });
  }

  // markRunning — PENDING → RUNNING 전이 + startedAt 기록 (ADR-0044 §1 실 실행 시작 시각).
  // row 부재 시 P2025 → NotFoundException.
  async markRunning(id: string): Promise<ExportJob> {
    return this.updateOrThrow(id, {
      status: "RUNNING",
      startedAt: new Date(),
    });
  }

  // markSucceeded — RUNNING → SUCCEEDED 전이 + finishedAt + artifactRef 기록.
  // artifactRef 는 dump artifact 의 참조 식별자 (raw 본문 아님, ADR-0044 §2).
  async markSucceeded(id: string, artifactRef: string): Promise<ExportJob> {
    return this.updateOrThrow(id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      artifactRef,
    });
  }

  // markFailed — RUNNING → FAILED 전이 + finishedAt + error 기록.
  // error 는 사람-친화 short message 만 (raw stack trace 미저장, ADR-0044 §2).
  async markFailed(id: string, error: string): Promise<ExportJob> {
    return this.updateOrThrow(id, {
      status: "FAILED",
      finishedAt: new Date(),
      error,
    });
  }

  // findJob — 단건 polling 조회. row 부재 시 findUniqueOrThrow 가 P2025 throw →
  // NotFoundException 변환 (UC-07 §8 status polling 의 단건 조회).
  async findJob(id: string): Promise<ExportJob> {
    try {
      return await this.prisma.exportJob.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  // findRunning — status=RUNNING ExportJob 목록 (UC-07 §8 status polling — 진행 중 job).
  // 매칭 0 이면 빈 배열 반환 (Prisma findMany native 동작).
  async findRunning(): Promise<ExportJob[]> {
    return this.prisma.exportJob.findMany({ where: { status: "RUNNING" } });
  }

  // --- private helpers ---

  // scope invariant 검증 — createJob 의 분기 책임 (schema 주석 L549 정합).
  private assertScopeInvariant(input: CreateExportJobInput): void {
    if (!input.requestedById) {
      throw new BadRequestException(
        "requestedById 는 필수입니다 (누가 dump 를 발화했는지 추적).",
      );
    }

    const hasDateRange =
      input.dateRange !== undefined && input.dateRange !== null;
    const hasEntitySelector =
      input.entitySelector !== undefined && input.entitySelector !== null;

    if (input.scope === ExportScope.FULL) {
      if (hasDateRange || hasEntitySelector) {
        throw new BadRequestException(
          "scope=FULL 은 전체 entity 전 기간 dump 이므로 dateRange/entitySelector 를 받지 않습니다.",
        );
      }
      return;
    }

    if (input.scope === ExportScope.RANGE && !hasDateRange) {
      throw new BadRequestException(
        "scope=RANGE 는 dateRange 가 필요합니다 (기간 한정의 필수 축).",
      );
    }

    if (input.scope === ExportScope.PARTIAL && !hasEntitySelector) {
      throw new BadRequestException(
        "scope=PARTIAL 은 entitySelector 가 필요합니다 (entity·인원 한정의 필수 축).",
      );
    }
  }

  // updateOrThrow — mark* 전이의 공통 update 위임. row 부재 (P2025) 시
  // NotFoundException 으로 변환 (전이 대상 job 이 없을 때의 negative 분기).
  private async updateOrThrow(
    id: string,
    data: Parameters<PrismaService["exportJob"]["update"]>[0]["data"],
  ): Promise<ExportJob> {
    try {
      return await this.prisma.exportJob.update({ where: { id }, data });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  // mapNotFound — P2025 면 NotFoundException, 아니면 원본 error 그대로 반환
  // (호출자가 throw 책임 — 변환 범위 밖 error 는 propagate).
  private mapNotFound(error: unknown, id: string): unknown {
    if (getPrismaErrorCode(error) === "P2025") {
      return new NotFoundException(`export job not found: ${id}`);
    }
    return error;
  }

  // toJsonOrNull — 미지정 축(undefined/null)을 DB NULL 로 정규화. nullable Json? 컬럼은
  // raw `null` 을 받지 않고 Prisma.DbNull (DB NULL) / Prisma.JsonNull (JSON null 값) 을
  // 구분해 요구하므로, 본 service 는 "축 미사용 = DB NULL" 의미로 Prisma.DbNull 을 쓴다.
  private toJsonOrNull(
    value: unknown,
  ): Parameters<PrismaService["exportJob"]["create"]>[0]["data"]["dateRange"] {
    if (value === undefined || value === null) {
      return Prisma.DbNull;
    }
    return value as Parameters<
      PrismaService["exportJob"]["create"]
    >[0]["data"]["dateRange"];
  }
}
