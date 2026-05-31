// SummaryService — Summary 도메인 의 application service. T-0116 acceptance 박제.
//
// 책임:
//   - SummaryRepository 의 4 CRUD primitive (create / findById / findByPerson /
//     delete) 위에 도메인 의미 부여 — Prisma known error code (`P2003` = FK constraint /
//     `P2025` = record not found) 와 repository 의 `null` 반환을 NestJS HttpException
//     (BadRequestException / NotFoundException) 으로 변환.
//   - enum-as-String literal 값 검증 (period 의 허용 집합 밖 값을 BadRequestException
//     으로 차단) — repository 는 값을 그대로 forward 하므로 이 검증은 반드시 service-layer
//     에 위치 (ADR-0006 §Consequences 음의 4).
//
// 패턴: ContributionService (T-0115) / AssessmentService (T-0114) / PersonService
// (T-0036) 의 exception-translation 을 1:1 mirror. 단 Summary 는 immutable (ADR-0006
// Decision §3 — `updatedAt` 미정의, 재계산은 hard delete 후 재생성, REQ-037 lifecycle):
//   - update / deactivate / reactivate 미박제.
//   - lifecycle 은 create → read → hard delete (remove) 의 3 phase 만.
//
// AssessmentService 와의 차이점 (ContributionService 와 동일):
//   - Summary 는 `@@unique` 부재 (schema.prisma L285–299 에 `@@index` 만 존재) →
//     P2002 (unique constraint) 가 발생하지 않는다. 따라서 P2002 → ConflictException
//     변환 분기를 박제하지 않는다 (stray P2002 가 surface 되면 그대로 re-throw — 변환
//     안 함).
//   - 대신 Summary 는 `personId` N:1 FK 를 보유 → Person row 부재 시 Prisma 의 P2003
//     (FK constraint 위반) 이 propagate. 이를 BadRequestException 으로 변환 (잘못된
//     참조 input → 400, ADR-0006 §3 + summary.repository.ts 박제).
//   - literal 검증 대상은 `period` 1 종뿐 (ContributionService 의 sourceType/difficulty
//     2 종, AssessmentService 의 period/scope/difficulty 3 종과 달리 — Summary 는
//     scope/difficulty 컬럼 부재).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - SummaryController / DTO / endpoint 없음 (별도 후속 task — HTTP-facing 0).
//   - NewPersonEvent / 도메인 이벤트 emit 없음.
//   - Group/Part aggregate Summary 의 view-time 계산 없음 (별도 task).
//   - getPrismaErrorCode / literal 검증 helper / VALID_PERIODS 의 공용 util 추출 없음
//     (PersonService / AssessmentService / ContributionService 와 중복되나 기존 service
//     를 건드리면 diff 확장 + 회귀 위험 — 별도 refactor follow-up).
//   - update / softDelete / restore 없음 (Summary 는 immutable, ADR-0006 §3).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Summary } from "@prisma/client";

import {
  SummaryRepository,
  type SummaryCreateInput,
  type SummaryFindByPersonOptions,
} from "./summary.repository";

// 허용 literal 집합 (ADR-0006 Decision §3 의 period enum-as-String 허용 값 — L85 의
// canonical literal `"day"` / `"week"` / `"month"`, Assessment 와 동일).
// AssessmentService 의 VALID_PERIODS 와 동일 값이나 본 task 는 AssessmentService 를
// import 해 결합하지 않고 자체 상수로 박제 (공용화는 별도 refactor follow-up — 본 task
// 에서 다른 service 수정 금지).
export const VALID_PERIODS = ["day", "week", "month"] as const;

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// `Prisma.PrismaClientKnownRequestError` 의 instanceof check 도 가능하나, runtime 의존성
// 을 늘리지 않기 위해 duck typing (`error.code`) 으로 통일 (ContributionService /
// AssessmentService / PersonService 의 동일 helper mirror — 공용화는 별도 refactor
// follow-up).
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
export class SummaryService {
  constructor(private readonly repository: SummaryRepository) {}

  // create — REQ-034/035/036 일·주·월 단위 요약 평가문 + 정규화 metricScore 영속.
  // (1) period 의 enum-as-String literal 값을 ADR-0006 §3 의 허용 집합 (`"day"` /
  // `"week"` / `"month"`) 으로 검증 (잘못된 literal 이면 BadRequestException —
  // service-layer 책임, ADR-0006 §Consequences 음의 4). (2) 검증 통과 후
  // repository.create 호출. (3) `personId` FK 위반 (Person row 부재) 시 propagate 된
  // P2003 를 BadRequestException 으로 변환 (잘못된 참조 input → 400). Summary 는
  // `@@unique` 부재 → P2002 변환 분기 없음 (AssessmentService 와의 차이점 — stray
  // P2002 는 그대로 re-throw).
  async create(input: SummaryCreateInput): Promise<Summary> {
    this.assertValidPeriod(input.period);
    try {
      return await this.repository.create(input);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2003") {
        throw new BadRequestException(
          `invalid personId reference: ${input.personId}`,
        );
      }
      throw error;
    }
  }

  // findById — repository 의 null 반환 분기 를 NotFoundException 으로 변환
  // (ContributionService.findById mirror, HTTP 404 자동 mapping).
  async findById(id: string): Promise<Summary> {
    const found = await this.repository.findById(id);
    if (found === null) {
      throw new NotFoundException(`summary not found: ${id}`);
    }
    return found;
  }

  // findByPerson — REQ-038 시계열 조회. options.period 가 주어지면 literal 값 검증 후
  // forward (잘못된 literal 이면 BadRequestException), undefined 면 그대로 forward (전체
  // period). 매칭 row 0 시 빈 배열 [] 그대로 반환 (NotFoundException 던지지 않음 —
  // 컬렉션 조회의 정상 결과). AssessmentService.findByPerson 의 options?.period 분기
  // 패턴 mirror.
  async findByPerson(
    personId: string,
    options?: SummaryFindByPersonOptions,
  ): Promise<Summary[]> {
    if (options?.period !== undefined) {
      this.assertValidPeriod(options.period);
    }
    return this.repository.findByPerson(personId, options);
  }

  // remove — hard delete (REQ-041 Admin 개별 manual delete + 재계산 lifecycle,
  // ADR-0006 §3 / §6). repository.delete 가 propagate 한 P2025 를 NotFoundException
  // 으로 변환 (ContributionService.remove mirror). Person 전체 hard delete 시 동반
  // Summary 삭제는 schema 의 onDelete: Cascade (schema.prisma L295) 책임 (본 메서드
  // 우회).
  async remove(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`summary not found: ${id}`);
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
}
