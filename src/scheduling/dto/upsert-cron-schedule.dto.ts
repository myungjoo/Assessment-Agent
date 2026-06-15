// UpsertCronScheduleDto — PUT /api/schedules payload 검증 책임 DTO. T-0414 acceptance
// 박제 (P7 ③ slice 2, REQ-039). AssignDifficultyMappingDto (T-0139) 의 class-validator
// 패턴 mirror — Admin 이 런타임에 지정하는 cron 주기(name + cronExpression)의 형식
// 기본 검증만 책임진다.
//
// 본 DTO 는 CronScheduleController 의 PUT 엔드포인트 의 @Body() 로 사용된다.
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 raw 본문 키 (예: callback / job 등) 포함 시 400 BadRequest
//     (forbidNonWhitelisted) — 정의 외 필드 오용 차단.
//   - 필수 필드 (name / cronExpression) 누락 / 빈 문자열 / wrong type 시 400.
//
// 책임 경계 (Out of Scope):
//   - cron 식의 실 형식 검증 (필드 수 · 범위) — CronScheduleService 의
//     isValidCronExpression (CronTime 생성자 재사용) 책임. 본 DTO 는 빈 값/형식 기본
//     검증 (비어있지 않은 string) 만 한다. 잘못된 cron 식은 service 가 등록 시점에
//     BadRequestException(400) 으로 변환한다.
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 자체는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpsertCronScheduleDto {
  // 등록할 cron job 의 고유 이름 (registry key). @IsNotEmpty 로 빈 문자열/null/undefined
  // 거부. @MaxLength(255) 로 비정상적으로 긴 입력 거부 (application-layer cap).
  // 단 class-validator @IsNotEmpty 는 trim 하지 않으므로 공백만 string 은 통과 —
  // 공백만 name 의 최종 거부는 service 의 registerOrReplace 가 BadRequestException 으로 책임.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  // 지정할 cron 표현식 (5-field 또는 6-field). 형식 기본 검증 (비어있지 않은 string) 만
  // DTO 책임 — 실 cron 형식 (필드 수/범위) 검증은 service 의 isValidCronExpression.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  cronExpression!: string;
}
