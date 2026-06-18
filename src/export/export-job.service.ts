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

import { validateExportScope } from "./export-scope-validate";

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

// Prisma ExportScope enum(uppercase) ↔ validateExportScope helper payload 의 lowercase
// scope literal 매핑. prisma/schema.prisma 의 enum ExportScope(FULL/RANGE/PARTIAL) 가
// source 이고, helper 는 export-scope-select.ts 의 ExportScope["scope"]("full"/"range"/
// "partial") 를 요구한다 — 본 상수가 그 대소문자·형태 차이를 흡수한다(schema 변경 0).
const SCOPE_ENUM_TO_PAYLOAD: Record<ExportScope, string> = {
  [ExportScope.FULL]: "full",
  [ExportScope.RANGE]: "range",
  [ExportScope.PARTIAL]: "partial",
};

@Injectable()
export class ExportJobService {
  constructor(private readonly prisma: PrismaService) {}

  // createJob — status=PENDING ExportJob row 를 생성한다.
  // scope 검증 책임 (schema 주석 L549 "service-layer 가 값 invariant 검증 책임"):
  //   - requestedById 가 비었으면 BadRequestException (FK 발화자 필수). 이 축은 scope
  //     payload 가 아닌 발화자 식별 책임이라 helper(validateExportScope) 가 다루지 않으므로
  //     본 service 가 helper 호출 전에 먼저 검증한다 (책임 분리 — 둘 다 400 이지만 별 분기).
  //   - 그 외 scope/dateRange/entitySelector 의 field-level 유효성은 validateExportScope
  //     (T-0444) 순수 helper 에 위임 (UC-07 §6.1 3 차원 옵션 — scope enum / range 의 반열림
  //     start<end / partial 의 entity 멤버십 / AND 조합). helper 가 { valid:false } 면 errors
  //     를 사람-친화 message 로 결합해 BadRequestException(400) — raw stack 미포함(REQ-032).
  async createJob(input: CreateExportJobInput): Promise<ExportJob> {
    if (!input.requestedById) {
      throw new BadRequestException(
        "requestedById 는 필수입니다 (누가 dump 를 발화했는지 추적).",
      );
    }

    // scope/dateRange/entitySelector field-level 검증을 helper 에 위임 (T-0444 배선).
    const verdict = validateExportScope(this.toScopePayload(input));
    if (!verdict.valid) {
      // field+message 쌍을 "; " 로 결합 — WebUI form field-level error 의 사람-친화 표현.
      throw new BadRequestException(
        verdict.errors.map((e) => `${e.field}: ${e.message}`).join("; "),
      );
    }

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

  // toScopePayload — CreateExportJobInput 을 validateExportScope helper 가 요구하는
  // payload shape({ scope: "full"|"range"|"partial", dateRange?, entitySelector? }) 로
  // 변환한다. Prisma `ExportScope` enum(FULL/RANGE/PARTIAL, uppercase) 과 helper 의
  // lowercase scope literal 사이의 매핑이 핵심 — 매핑되지 않는 값은 그대로 통과시켜
  // helper 의 scope error 가 잡도록 둔다(방어적). dateRange 는 아래 coerce 로 정규화.
  private toScopePayload(input: CreateExportJobInput): {
    scope: string;
    dateRange?: unknown;
    entitySelector?: unknown;
  } {
    return {
      scope: SCOPE_ENUM_TO_PAYLOAD[input.scope] ?? input.scope,
      dateRange: this.coerceDateRange(input.dateRange),
      entitySelector: input.entitySelector,
    };
  }

  // coerceDateRange — JSON body 의 dateRange 는 역직렬화 과정에서 start/end 가 ISO string 으로
  // 들어올 수 있으므로(JSON 에 Date 타입이 없음), string 이면 new Date(...) 로 coerce 한다.
  // coerce 후 helper 의 isValidDate 가 Invalid Date(잘못된 ISO string)를 field error 로 잡는다.
  // 이미 Date instance 면 그대로 통과, dateRange 가 plain object 가 아니면 원본을 그대로 넘겨
  // helper 의 dateRange error 분기가 처리하도록 둔다(본 service 는 형 변환만, 판정은 helper).
  private coerceDateRange(value: unknown): unknown {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }
    const range = value as { start?: unknown; end?: unknown };
    return {
      ...range,
      start:
        typeof range.start === "string" ? new Date(range.start) : range.start,
      end: typeof range.end === "string" ? new Date(range.end) : range.end,
    };
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
