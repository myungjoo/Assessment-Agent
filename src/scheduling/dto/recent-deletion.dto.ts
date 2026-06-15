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

// 삭제 후보 instant 배열의 application-layer 상한. 비정상적으로 큰 배열(수십만 원소)을
// 거부해 DoS / 메모리 폭주를 막는다. 실 도메인 상한이 아니라 방어적 cap 이며, 실제 삭제
// 범위는 runner 의 buildRecentDeletionPlan 이 window 로 필터링한다(상한 밖 instant 는
// 어차피 toKeep). 1000 은 "최근 30일 × 합리적 일일 결과 수" 를 충분히 덮는 여유값.
const INSTANTS_MAX_SIZE = 1000;

export class RecentDeletionDto {
  // 삭제 후보 instant 의 ISO 8601 문자열 배열. @IsArray 로 배열 형 강제, @IsISO8601
  // (each:true) 로 각 원소가 유효한 ISO 8601 datetime string 임을 검증, @ArrayMaxSize 로
  // 비정상적으로 큰 배열 거부(위 INSTANTS_MAX_SIZE 근거). controller 가 각 원소를
  // new Date(s) 로 매핑해 runner 에 전달한다.
  //
  // 빈 배열([])은 허용한다 — runner(runRecentDeletion → buildRecentDeletionPlan)가
  // toDelete 가 비면 삭제/재수집 없이 no-op 요약을 반환하는 정상 경로이기 때문이다
  // (error 아님). 따라서 @ArrayNotEmpty 를 두지 않는다.
  @IsArray()
  @ArrayMaxSize(INSTANTS_MAX_SIZE)
  @IsISO8601({}, { each: true })
  instants!: string[];

  // 최근 며칠을 삭제 대상으로 삼을지(선택). 미지정 시 runner 기본값(DEFAULT_DAYS=1).
  // @IsOptional 로 미지정 허용, @IsInt + @IsPositive 로 정수·양수 기본 검증만 한다.
  // 실 상한/하한(예: 최대 일수) 검증은 buildRecentDeletionWindow 의 assertValidDays 에
  // 위임한다 — 본 DTO 에서 중복 검증하지 않는다(책임 경계 단일화).
  @IsOptional()
  @IsInt()
  @IsPositive()
  days?: number;
}
