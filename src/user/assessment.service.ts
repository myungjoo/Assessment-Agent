// AssessmentService — Assessment 도메인 의 application service. T-0114 acceptance 박제.
//
// 책임:
//   - AssessmentRepository 의 4 CRUD primitive (create / findById / findByPerson /
//     delete) 위에 도메인 의미 부여 — Prisma known error code (`P2002` = unique
//     constraint / `P2025` = record not found) 와 repository 의 `null` 반환을 NestJS
//     HttpException (ConflictException / NotFoundException) 으로 변환.
//   - enum-as-String literal 값 검증 (period / scope / difficulty 의 허용 집합 밖 값을
//     BadRequestException 으로 차단) — repository 는 값을 그대로 forward 하므로 이 검증은
//     반드시 service-layer 에 위치 (ADR-0006 §Consequences 음의 4).
//
// 패턴: PersonService (T-0036) 의 exception-translation 을 1:1 mirror. 단 Assessment 는
// immutable (ADR-0006 Decision §1 — `updatedAt` 미정의, 재평가는 hard delete 후 재생성):
//   - update / deactivate / reactivate 미박제.
//   - lifecycle 은 create → read → hard delete (remove) 의 3 phase 만.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - AssessmentController / DTO / endpoint 없음 (별도 후속 task — HTTP-facing 0).
//   - NewPersonEvent / 도메인 이벤트 emit 없음.
//   - ContributionService / SummaryService 없음 (각 별도 slice).
//   - getPrismaErrorCode / literal 검증 helper 의 공용 util 추출 없음 (PersonService 와
//     중복되나 PersonService 를 건드리면 diff 확장 + 회귀 위험 — 별도 refactor follow-up).
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Assessment } from "@prisma/client";

import {
  AssessmentRepository,
  type AssessmentCreateInput,
  type AssessmentFindByPersonOptions,
} from "./assessment.repository";

// 허용 literal 집합 (ADR-0006 Decision §1 의 enum-as-String 허용 값).
// 후속 SummaryService 등이 재사용 가능하도록 export (단 본 task 에서 다른 service 수정
// 금지 — 재사용은 후속 task 책임).
export const VALID_PERIODS = ["day", "week", "month"] as const;
export const VALID_SCOPES = ["commit", "document", "aggregate"] as const;
export const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// `Prisma.PrismaClientKnownRequestError` 의 instanceof check 도 가능하나, runtime 의존성
// 을 늘리지 않기 위해 duck typing (`error.code`) 으로 통일 (PersonService 의 동일 helper
// mirror — 공용화는 별도 refactor follow-up).
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
export class AssessmentService {
  constructor(private readonly repository: AssessmentRepository) {}

  // create — REQ-029 평가 자료 영속. (1) period / scope / difficulty 의 enum-as-String
  // literal 값을 ADR-0006 §1 의 허용 집합으로 검증 (잘못된 literal 이면 BadRequestException
  // — service-layer 책임). (2) 검증 통과 후 repository.create 호출. (3)
  // `@@unique([personId, period, scope, periodStart])` 위반 시 propagate 된 P2002 를
  // ConflictException 으로 변환 (PersonService.create 의 P2002 정책 mirror).
  async create(input: AssessmentCreateInput): Promise<Assessment> {
    this.assertValidPeriod(input.period);
    this.assertValidScope(input.scope);
    this.assertValidDifficulty(input.difficulty);
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          `assessment already exists for personId=${input.personId} period=${input.period} scope=${input.scope}`,
        );
      }
      throw error;
    }
  }

  // findById — repository 의 null 반환 분기 를 NotFoundException 으로 변환 (PersonService
  // .findById mirror, HTTP 404 자동 mapping).
  async findById(id: string): Promise<Assessment> {
    const found = await this.repository.findById(id);
    if (found === null) {
      throw new NotFoundException(`assessment not found: ${id}`);
    }
    return found;
  }

  // findByPerson — REQ-038 시계열 조회. options.period 가 주어지면 literal 값 검증 후
  // forward (잘못된 literal 이면 BadRequestException), undefined 면 그대로 forward (전체
  // period). 매칭 row 0 시 빈 배열 [] 그대로 반환 (NotFoundException 던지지 않음 —
  // 컬렉션 조회의 정상 결과).
  async findByPerson(
    personId: string,
    options?: AssessmentFindByPersonOptions,
  ): Promise<Assessment[]> {
    if (options?.period !== undefined) {
      this.assertValidPeriod(options.period);
    }
    return this.repository.findByPerson(personId, options);
  }

  // remove — hard delete (REQ-041 / REQ-037 lifecycle). repository.delete 가 propagate
  // 한 P2025 를 NotFoundException 으로 변환 (PersonService.remove mirror). component
  // Contribution 은 schema 의 onDelete: Cascade 가 동반 삭제 책임.
  async remove(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`assessment not found: ${id}`);
      }
      throw error;
    }
  }

  // -----------------------------------------------------------------------
  // literal 검증 helper — 허용 집합 밖 값을 BadRequestException 으로 차단.
  // repository 가 값을 그대로 forward 하므로 본 검증은 service-layer 책임.
  // -----------------------------------------------------------------------
  private assertValidPeriod(period: string): void {
    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
      throw new BadRequestException(
        `invalid period: ${period} (allowed: ${VALID_PERIODS.join(", ")})`,
      );
    }
  }

  private assertValidScope(scope: string): void {
    if (!(VALID_SCOPES as readonly string[]).includes(scope)) {
      throw new BadRequestException(
        `invalid scope: ${scope} (allowed: ${VALID_SCOPES.join(", ")})`,
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
