// RecentDeletionDto — POST /api/schedules/recent-deletion/:personId payload 검증 책임
// DTO. T-0428 acceptance 박제 (P7 ⑤ slice 2 후속 b, R-74 / REQ-041). UpsertCronScheduleDto
// (T-0414) 의 class-validator 패턴 mirror — Admin 이 manual delete→재수집 1회 발화 시
// 넘기는 요청 본문(삭제 후보 instant 집합 + 선택적 days)의 형식 기본 검증만 책임진다.
//
// 본 DTO 는 RecentDeletionController 의 POST 엔드포인트 의 @Body() 로 사용된다.
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 raw 본문 키 (예: reference / scope 등) 포함 시 400 BadRequest
//     (forbidNonWhitelisted) — 정의 외 필드 오용 차단.
//   - 필드 wrong type (instants 가 비-배열 / 비-ISO 원소, days 가 비-정수/음수) 시 400.
//
// 책임 경계 (Out of Scope):
//   - days 의 실 상한/하한 검증 — buildRecentDeletionWindow 의 assertValidDays 책임.
//     본 DTO 는 정수·양수 기본 검증만 하고 중복 검증하지 않는다. 미지정 시 runner
//     기본값(DEFAULT_DAYS=1) 사용.
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 자체는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
//   - reference 파라미터화 — endpoint 는 현재 시각 기본값만 사용(runner reference ??
//     new Date()). 명시 reference 노출은 Out of Scope 이므로 본 DTO 에 필드 없음.
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
} from "class-validator";

// 비정상적으로 큰 배열을 거부하는 방어적 상한.
const INSTANTS_MAX_SIZE = 1000;

export class RecentDeletionDto {
  // 사용하지 않는다. 대상 row 는 서버가 찾으며 값은 runner 로 전달되지 않는다. web 전환 기간에만
  // 받고 후속 task 에서 제거한다.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(INSTANTS_MAX_SIZE)
  @IsISO8601({}, { each: true })
  instants?: string[];

  // 최근 며칠을 삭제 대상으로 삼을지(선택). 미지정 시 runner 기본값(DEFAULT_DAYS=1).
  // @IsOptional 로 미지정 허용, @IsInt + @IsPositive 로 정수·양수 기본 검증만 한다.
  // 실 상한/하한(예: 최대 일수) 검증은 buildRecentDeletionWindow 의 assertValidDays 에
  // 위임한다 — 본 DTO 에서 중복 검증하지 않는다(책임 경계 단일화).
  @IsOptional()
  @IsInt()
  @IsPositive()
  days?: number;
}
