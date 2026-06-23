// CollectTriggerDto — collection manual-trigger endpoint(POST /api/assessment-collection/
// collect)의 request body 검증 DTO. ADR-0031 §2 계약 1:1 구현. CreateAssessmentDto
// (T-0117) 패턴 mirror.
//
// 본 DTO 는 AssessmentCollectionController 의 POST /collect @Body() 로 사용된다(controller
// 배선은 Follow-up #3 slice). ValidationPipe(whitelist + forbidNonWhitelisted + transform)
// 와 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 → 400 BadRequest(forbidNonWhitelisted).
//   - decorator 위반(필수 누락 / wrong type / 잘못된 ISO date) → 400.
//
// 본 DTO 는 형식 검증만 — period / scope 의 enum-as-String 허용 literal 값 검증은
// AssessmentService 책임(service 의 BadRequestException, 중복 방지 위해 DTO 는 @IsIn
// 미적용, create-assessment.dto.ts 정합).
//
// periodStart 는 CreateAssessmentDto 의 `@Type(() => Date) @IsDate()` 와 달리 ADR-0031 §2
// 가 명시한 `@IsOptional() @IsISO8601()` (string 유지)를 따른다 — endpoint 계약이 ISO-8601
// string 이고, 미제공 시 서버 now() fallback 은 orchestration slice(Follow-up #2)가 채우는
// "수집 경계"(ADR-0031 §1)이기 때문. DTO 는 형식만 검증하고 optional 통과시킨다.
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CollectTriggerDto {
  // personId — 수집 대상 Person 의 FK. 존재 검증(실 Person row)은 service
  // (PersonService.findByIdWithIdentities, Follow-up #2) 책임 — DTO 는 형식(비어있지 않은
  // string)만.
  @IsString()
  @IsNotEmpty()
  personId!: string;

  // period — "day" / "week" / "month" enum-as-String. 허용 literal 값 검증은
  // AssessmentService 책임 — DTO 는 형식만(@IsIn 미적용).
  @IsString()
  @IsNotEmpty()
  period!: string;

  // scope — "commit" / "document" / "aggregate" enum-as-String. 허용 literal 값 검증은
  // service 책임 — DTO 는 형식만.
  @IsString()
  @IsNotEmpty()
  scope!: string;

  // periodStart — 이번 수집의 경계 timestamp(ISO-8601 string, ADR-0031 §1). 선택 —
  // 미제공 시 서버 now() fallback 은 orchestration slice 책임. @IsISO8601 이 제공 시 형식만
  // 검증한다(Date 변환 안 함 — string 유지, transform 후에도 string).
  @IsOptional()
  @IsISO8601()
  periodStart?: string;

  // windowDays — R-58 재수집 겹침 폭(일). 선택 — service 의
  // deriveSinceWithRecollectionWindow 2번째 인자로 thread 되어 직전 수집 경계를 최근
  // windowDays 일 뒤로 물려 재수집한다(REQ-031/R-58 — 겹친 부분은 dedup 흡수). 미제공 시
  // service 위임이 기본 7일 backoff(applyRecollectionWindow 의 RECOLLECTION_WINDOW_DAYS)
  // 를 적용해 기존 동작 불변(non-breaking). @IsInt 가 비정수/문자열을 400 차단한다 — 값
  // 의미(≤0/비정수 no-op)는 applyRecollectionWindow 책임이라 본 DTO 는 형식만 검증.
  @IsOptional()
  @IsInt()
  windowDays?: number;
}
