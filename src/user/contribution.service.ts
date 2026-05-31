// ContributionService — Contribution 도메인 의 application service. T-0115 acceptance 박제.
//
// 책임:
//   - ContributionRepository 의 4 CRUD primitive (create / findById / findByAssessment /
//     delete) 위에 도메인 의미 부여 — Prisma known error code (`P2003` = FK constraint /
//     `P2025` = record not found) 와 repository 의 `null` 반환을 NestJS HttpException
//     (BadRequestException / NotFoundException) 으로 변환.
//   - enum-as-String literal 값 검증 (sourceType / difficulty 의 허용 집합 밖 값을
//     BadRequestException 으로 차단) — repository 는 값을 그대로 forward 하므로 이 검증은
//     반드시 service-layer 에 위치 (ADR-0006 §Consequences 음의 4).
//
// 패턴: AssessmentService (T-0114) / PersonService (T-0036) 의 exception-translation 을
// 1:1 mirror. 차이점:
//   - Contribution 은 `@@unique` 부재 → P2002 변환 분기 없음 (Assessment 와의 차이점).
//   - Contribution 의 FK 위반 (assessmentId 부재 Assessment 참조) 시 P2003 propagate →
//     BadRequestException 변환 (잘못된 참조 input → 400).
//   - Contribution 은 immutable (ADR-0006 Decision §2 — `updatedAt` 미정의, 개별 commit/
//     PR/문서 단위의 1 회성 영속, 재수집 시 재생성):
//     - update / softDelete / restore 미박제.
//     - lifecycle 은 create → read → hard delete (remove) 의 3 phase 만.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - ContributionController / DTO / endpoint 없음 (별도 후속 task — HTTP-facing 0).
//   - NewPersonEvent / 도메인 이벤트 emit 없음.
//   - SummaryService 없음 (별도 slice).
//   - getPrismaErrorCode / literal 검증 helper 의 공용 util 추출 없음 (PersonService /
//     AssessmentService 와 중복되나 본 task 에서 기존 service 를 건드리면 diff 확장 +
//     회귀 위험 — 별도 refactor follow-up).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Contribution } from "@prisma/client";

import {
  ContributionRepository,
  type ContributionCreateInput,
} from "./contribution.repository";

// 허용 literal 집합 (ADR-0006 Decision §2 의 enum-as-String 허용 값).
// VALID_DIFFICULTIES 는 AssessmentService 의 동일 상수와 값이 같으나 본 task 는
// AssessmentService 를 import 해 결합하지 말고 자체 상수로 박제 (공용화는 Follow-up).
export const VALID_SOURCE_TYPES = ["commit", "pr", "document"] as const;
export const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// `Prisma.PrismaClientKnownRequestError` 의 instanceof check 도 가능하나, runtime 의존성
// 을 늘리지 않기 위해 duck typing (`error.code`) 으로 통일 (PersonService /
// AssessmentService 의 동일 helper mirror — 공용화는 별도 refactor follow-up).
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

@Injectable()
export class ContributionService {
  constructor(private readonly repository: ContributionRepository) {}

  // create — REQ-029 / REQ-033 commit·문서 별 기여도 영속. (1) sourceType / difficulty
  // 의 enum-as-String literal 값을 ADR-0006 §2 의 허용 집합으로 검증 (잘못된 literal
  // 이면 BadRequestException — service-layer 책임, ADR-0006 §Consequences 음의 4).
  // (2) 검증 통과 후 repository.create 호출. (3) `assessmentId` FK 위반 (Assessment
  // row 부재) 시 propagate 된 P2003 를 BadRequestException 으로 변환 (잘못된 참조
  // input → 400). Contribution 은 `@@unique` 부재 → P2002 변환 분기 없음.
  async create(input: ContributionCreateInput): Promise<Contribution> {
    this.assertValidSourceType(input.sourceType);
    this.assertValidDifficulty(input.difficulty);
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2003") {
        throw new BadRequestException(
          `invalid assessmentId reference: ${input.assessmentId} (foreign key constraint failed)`,
        );
      }
      throw error;
    }
  }

  // findById — repository 의 null 반환 분기 를 NotFoundException 으로 변환
  // (AssessmentService.findById mirror, HTTP 404 자동 mapping).
  async findById(id: string): Promise<Contribution> {
    const found = await this.repository.findById(id);
    if (found === null) {
      throw new NotFoundException(`contribution not found: ${id}`);
    }
    return found;
  }

  // findByAssessment — REQ-033 aggregate-level fan-out (특정 Assessment 의 component
  // Contribution 전체 조회). 매칭 row 0 시 빈 배열 [] 그대로 반환 (NotFoundException
  // 던지지 않음 — 컬렉션 조회의 정상 결과). literal 검증 대상 없음 — repository 에
  // 그대로 forward.
  async findByAssessment(assessmentId: string): Promise<Contribution[]> {
    return this.repository.findByAssessment(assessmentId);
  }

  // remove — hard delete (REQ-041 Admin 개별 manual delete lifecycle).
  // repository.delete 가 propagate 한 P2025 를 NotFoundException 으로 변환
  // (AssessmentService.remove mirror). Assessment 전체 hard delete 시 component
  // Contribution 의 동반 삭제는 schema 의 onDelete: Cascade 가 별도 책임 — 본
  // 메서드는 Admin 의 개별 row 수동 삭제 경로만 cover.
  async remove(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`contribution not found: ${id}`);
      }
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // literal 검증 helper — 허용 집합 밖 값을 BadRequestException 으로 차단.
  // repository 가 값을 그대로 forward 하므로 본 검증은 service-layer 책임.
  // -----------------------------------------------------------------------
  private assertValidSourceType(sourceType: string): void {
    if (!(VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      throw new BadRequestException(
        `invalid sourceType: ${sourceType} (allowed: ${VALID_SOURCE_TYPES.join(", ")})`,
      );
    }
  }

  private assertValidDifficulty(difficulty: string): void {
    if (!(VALID_DIFFICULTIES as readonly string[]).includes(difficulty)) {
      throw new BadRequestException(
        `invalid difficulty: ${difficulty} (allowed: ${VALID_DIFFICULTIES.join(", ")})`,
      );
    }
  }
}
