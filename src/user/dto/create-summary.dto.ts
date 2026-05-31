// CreateSummaryDto — REQ-034/035/036 일·주·월 요약 평가 영속의 POST /api/summaries
// payload 검증 DTO. T-0119 acceptance 박제. CreateAssessmentDto (T-0117) 패턴 1:1 mirror.
//
// 본 DTO 는 SummaryController 의 POST /api/summaries 엔드포인트 의 @Body() 로 사용된다.
// ValidationPipe (controller-scope @UsePipes, SummaryController 결정) 의
// whitelist + forbidNonWhitelisted + transform 옵션과 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: raw 본문 키 `rawBody` / `content` / `diff` 등) 는 400 BadRequest.
//   - decorator 위반 (필수 field 누락 / wrong type / 잘못된 date 형식 등) 도 400.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — periodStart 의
//     @Type(() => Date) 변환 (service 가 Date 기대) 보장.
//
// SummaryCreateInput (summary.repository.ts L56-67) 의 5 키와 정합 (ADR-0006 §3
// 허용 입력 컬럼). 본 DTO 는 형식 검증만 — period 의 enum-as-String 허용 literal 값
// (`"day"` / `"week"` / `"month"`) 검증은 SummaryService 책임 (service 의
// BadRequestException, 형식과 중복 방지 위해 DTO 는 @IsIn 미적용 — task §Acceptance 권장).
//
// CreateAssessmentDto 와의 차이점 (Summary 는 scope/difficulty/volume/contributionScore
// 컬럼 부재):
//   - scope / difficulty / volume / contributionScore field 없음.
//   - 대신 metricScore (요약 단위 정규화 metric 수치, Prisma Decimal 컬럼) 만 보유.
//
// raw 미저장 (R-59 / REQ-032 / ADR-0006 Decision §4) DTO-level 정합:
//   - 본 DTO 는 raw 본문 키 (commit body / diff / 문서 본문 / rawBody / content /
//     commitBody 등) 를 절대 정의하지 않는다 — schema-level 강제 (Summary 모델에 raw
//     컬럼 부재) 의 DTO-level mirror. whitelist + forbidNonWhitelisted 가 정의 외
//     필드를 400 으로 reject.
//   - narrative 는 LLM 정성 요약 평가문 (LLM 생성 결과물 — raw 본문 인용 아님, R-59
//     적용 외) → DTO 에 정상 field 로 존재.
//
// 책임 경계 (Out of Scope):
//   - update payload (PATCH) DTO — Summary 는 immutable (ADR-0006 §3, update 미박제).
import { Type } from "class-transformer";
import { IsDate, IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreateSummaryDto {
  // personId — 요약 대상 Person 의 FK. 존재 검증 (실 Person row) 은 Prisma FK / service
  // 책임 — DTO 는 형식 (비어있지 않은 string) 만 검증.
  @IsString()
  @IsNotEmpty()
  personId!: string;

  // period — "day" / "week" / "month" enum-as-String. 허용 literal 값 검증은
  // SummaryService (BadRequestException) 책임 — DTO 는 형식 (비어있지 않은 string) 만.
  @IsString()
  @IsNotEmpty()
  period!: string;

  // periodStart — 요약 기간 시작 (일/주/월 경계). transform=true + @Type(() => Date) 가
  // ISO 8601 string 입력을 Date instance 로 변환 (service / Prisma 가 Date 기대).
  // @IsDate 가 변환 후 유효 Date 인지 검증 — 잘못된 date string 은 400.
  @Type(() => Date)
  @IsDate()
  periodStart!: Date;

  // narrative — LLM 정성 요약 평가문 텍스트 (LLM 생성 결과물 — raw 아님, R-59 적용 외).
  @IsString()
  @IsNotEmpty()
  narrative!: string;

  // metricScore — 요약 단위의 정규화 metric 수치 (REQ-036). Prisma 의 Decimal 컬럼.
  // transform=true 가 numeric 입력을 number 로 변환, @IsNumber 가 형식 검증.
  // Prisma 가 number 를 Decimal 로 내부 변환 (summary.repository.ts L65-66 정합).
  @IsNumber()
  metricScore!: number;
}
