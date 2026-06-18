// ImportJobService — ImportJob 의 생성·status 전이·polling 조회 persistence service
// (T-0487, ADR-0044 §Follow-ups 두 번째 항목의 dependency-order 두 번째 slice).
//
// 위상 (P7 export/import 실 배선 chain step4):
//   - step3 (T-0486) 이 ExportJobService 를 박제했고, 본 service 는 그 **대칭
//     counterpart** 다. ImportJob 의 생명주기 (PENDING→RUNNING→SUCCEEDED/FAILED) 와
//     산출물 (artifactRef / error / restoredRowCount) 을 PrismaService 위에 얇게 wrapping.
//   - UC-07 §8 NFR 의 Import 측 "async job + status polling" backbone 을 코드 차원에서
//     채운다 — 생성(createJob) → status 전이(markRunning/markSucceeded/markFailed) →
//     조회(findJob/findRunning).
//
// ImportJob 고유 필드 (ExportJob 공통 필드 + 차이, ADR-0044 §1):
//   - mode — ImportMode enum (REPLACE / MERGE), 미지정 시 REPLACE default.
//   - restoredRowCount — SUCCEEDED 시 복원된 row 수 (UC-07 §8 (e) postcondition).
//
// 책임 경계 (task §Out of Scope):
//   - 실 atomic transaction 복원 로직 (ADR-0044 §3 REPLACE $transaction reset-and-recreate,
//     MERGE conflict resolution) — 후속 task. 본 service 는 status/artifactRef/
//     restoredRowCount record 만, 실 DB-wide snapshot 복원은 별도 slice.
//   - import controller / DTO (POST /api/admin/import) 배선 — 후속 task.
//   - module 등록 (ImportModule / AssessmentModule 편입) — 후속 task (본 task 는 class +
//     spec 만; 미등록이어도 unit test 통과).
//
// Prisma error 정책 (ExportJobService 컨벤션 mirror):
//   - findJob / mark* 가 row 부재 시 Prisma 의 P2025 (record not found) 를
//     NotFoundException 으로 변환한다. 그 외 known error code 는 그대로 propagate.
//   - raw 미저장 invariant (ADR-0044 §2) — createJob 의 input 에 raw payload 필드 자체가
//     없다 (artifactRef 는 import 할 artifact 의 pointer 일 뿐). error 는 사람-친화 short
//     message 만 record (raw stack trace 미저장).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ImportMode, type ImportJob } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// Prisma known error helper — `code` field 가 known request error 의 식별자.
// 실 PrismaClientKnownRequestError 인스턴스 생성 cost 를 회피하고 duck typing 으로
// code 만 추출한다 (ExportJobService 등 전 service 의 동일 helper 패턴 mirror).
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

// CreateImportJobInput — createJob 의 입력 shape. raw payload 필드 0 (ADR-0044 §2 —
// ImportJob 의 어떤 필드도 raw 외부 본문을 보유하지 않으며 input 도 동일).
//   - mode — 복원 모드 (ImportMode REPLACE / MERGE). 미지정 시 REPLACE default.
//   - requestedById — 발화한 User FK scalar (REQ-045 Admin, ADR-0044 §1 누가 import 를
//     일으켰는지 추적).
export interface CreateImportJobInput {
  mode?: ImportMode;
  requestedById: string;
}

@Injectable()
export class ImportJobService {
  constructor(private readonly prisma: PrismaService) {}

  // createJob — status=PENDING ImportJob row 를 생성한다.
  // invariant 검증 (schema 주석 정합):
  //   - requestedById 가 비었으면 BadRequestException (FK 발화자 필수).
  //   - mode 가 명시됐으나 ImportMode enum 값이 아니면 BadRequestException
  //     (REPLACE/MERGE 외 거부).
  // mode 미지정 시 schema @default(REPLACE) 에 위임 — data 에 mode 명시하지 않음.
  async createJob(input: CreateImportJobInput): Promise<ImportJob> {
    this.assertModeInvariant(input);

    return this.prisma.importJob.create({
      data: {
        requestedById: input.requestedById,
        // mode 명시 시에만 전달 — 미지정 시 schema @default(REPLACE) 적용.
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
      },
    });
  }

  // markRunning — PENDING → RUNNING 전이 + startedAt 기록 (ADR-0044 §1 실 실행 시작 시각).
  // row 부재 시 P2025 → NotFoundException.
  async markRunning(id: string): Promise<ImportJob> {
    return this.updateOrThrow(id, {
      status: "RUNNING",
      startedAt: new Date(),
    });
  }

  // markSucceeded — RUNNING → SUCCEEDED 전이 + finishedAt + artifactRef +
  // restoredRowCount 기록. artifactRef 는 복원에 사용한 artifact 의 참조 식별자
  // (raw 본문 아님, ADR-0044 §2). restoredRowCount 는 복원된 row 수 요약 (UC-07 §8 (e)).
  async markSucceeded(
    id: string,
    artifactRef: string,
    restoredRowCount: number,
  ): Promise<ImportJob> {
    return this.updateOrThrow(id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      artifactRef,
      restoredRowCount,
    });
  }

  // markFailed — RUNNING → FAILED 전이 + finishedAt + error 기록.
  // error 는 사람-친화 short message 만 (raw stack trace 미저장, ADR-0044 §2).
  async markFailed(id: string, error: string): Promise<ImportJob> {
    return this.updateOrThrow(id, {
      status: "FAILED",
      finishedAt: new Date(),
      error,
    });
  }

  // findJob — 단건 polling 조회. row 부재 시 findUniqueOrThrow 가 P2025 throw →
  // NotFoundException 변환 (UC-07 §8 status polling 의 단건 조회).
  async findJob(id: string): Promise<ImportJob> {
    try {
      return await this.prisma.importJob.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  // findRunning — status=RUNNING ImportJob 목록 (UC-07 §8 status polling — 진행 중 job).
  // 매칭 0 이면 빈 배열 반환 (Prisma findMany native 동작).
  async findRunning(): Promise<ImportJob[]> {
    return this.prisma.importJob.findMany({ where: { status: "RUNNING" } });
  }

  // --- private helpers ---

  // mode invariant 검증 — createJob 의 분기 책임.
  private assertModeInvariant(input: CreateImportJobInput): void {
    if (!input.requestedById) {
      throw new BadRequestException(
        "requestedById 는 필수입니다 (누가 import 를 발화했는지 추적).",
      );
    }

    if (
      input.mode !== undefined &&
      !Object.values(ImportMode).includes(input.mode)
    ) {
      throw new BadRequestException(
        "mode 는 REPLACE 또는 MERGE 여야 합니다 (ImportMode enum 값).",
      );
    }
  }

  // updateOrThrow — mark* 전이의 공통 update 위임. row 부재 (P2025) 시
  // NotFoundException 으로 변환 (전이 대상 job 이 없을 때의 negative 분기).
  private async updateOrThrow(
    id: string,
    data: Parameters<PrismaService["importJob"]["update"]>[0]["data"],
  ): Promise<ImportJob> {
    try {
      return await this.prisma.importJob.update({ where: { id }, data });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  // mapNotFound — P2025 면 NotFoundException, 아니면 원본 error 그대로 반환
  // (호출자가 throw 책임 — 변환 범위 밖 error 는 propagate).
  private mapNotFound(error: unknown, id: string): unknown {
    if (getPrismaErrorCode(error) === "P2025") {
      return new NotFoundException(`import job not found: ${id}`);
    }
    return error;
  }
}
