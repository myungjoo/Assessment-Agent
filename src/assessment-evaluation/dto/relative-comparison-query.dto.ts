// RelativeComparisonQueryDto — P5 REQ-036 "개발자 간 상대 비교 전용 산출 경로" 의 HTTP
// 조회 표면(GET /api/assessment-evaluation/relative-comparison)이 받는 query string 검증
// DTO(T-1934, REQ-036 배선 3/3). `SummaryRelativeComparisonReader.readForCoordinate`
// (summary-relative-comparison-reader.service.ts 90 행)의 2 인자 — period + periodStart —
// 를 HTTP boundary 에서 **형식만** 검증한다.
//
// `ResetByPeriodRequestDto`(T-1915) / `UnevaluatedFillPlanRequestDto`(T-0544) 패턴 mirror —
// class-validator decorator 로 형식만 검증하고, 허용 literal 값(period 의 day/week/month)
// 검증은 service 책임이다(@IsIn 미적용, 같은 module 의 evaluation DTO 관행 정합). 실제
// literal 게이트는 `summary.service.ts` 126~148 행 `findByCoordinate` 가 첫 줄에서 호출하는
// `assertValidPeriod(period)` 가 단일 출처이므로, DTO 가 같은 판정을 중복 소유하면 허용
// literal 정본이 두 곳으로 갈라진다.
//
// controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)와 결합돼
// 다음 2 종의 400 이 자동 강제된다:
//   - 정의되지 않은 query 필드 → 400 BadRequest(forbidNonWhitelisted) — 오타 축으로 인한
//     "다른 좌표를 조회했는데 조용히 기본 좌표가 나오는" 무성 오작동을 boundary 에서 차단.
//   - decorator 위반(필수 누락 / 빈 문자열 / wrong type / 비-ISO periodStart) → 400.
//
// 책임 경계(task Out of Scope 정합):
//   - string → Date 변환은 controller 책임이다. 본 DTO 는 `@Type` 등 class-transformer
//     변환을 **하나도** 쓰지 않고 문자열 축만 소유한다 — 변환 실패가 DTO 안에서 조용히
//     Invalid Date 로 굳는 경로를 만들지 않기 위해서다.
//   - 허용 period literal 검증 · 좌표 존재 여부 · 응답 산출 규칙은 전부 본 DTO 밖
//     (SummaryService → adapter → helper 사슬 소유).
//   - 새 외부 dependency 0 — class-validator 는 이미 의존(같은 디렉터리 DTO 들이 사용 중).
//     nested DTO 0(2 축 모두 primitive string 이라 `@Type` 불요).
import { IsISO8601, IsNotEmpty, IsString } from "class-validator";

export class RelativeComparisonQueryDto {
  // period — 조회 대상 좌표의 period 종류(day/week/month enum-as-String,
  // `readForCoordinate` 의 첫 인자). 형식만 검증하고 허용 literal 값은
  // `SummaryService.assertValidPeriod` 책임(@IsIn 미적용 — reset-by-period-request.dto 의
  // period 관행 정합).
  @IsString()
  @IsNotEmpty()
  period!: string;

  // periodStart — 조회 대상 좌표의 기간 시작 instant(ISO-8601 string,
  // `readForCoordinate` 의 둘째 인자로 갈 Date 의 원문). `@IsISO8601()` 로 형식을
  // boundary 에서 강제 — 비-ISO 문자열(예: "2026-13-99")은 400 으로 거부되어 controller 의
  // `new Date(...)` 가 만든 Invalid Date 가 하류 prisma 조회까지 흘러가 opaque 하게
  // 실패하는 경로를 차단한다(unevaluated-fill-plan-request.dto 63~66 행 패턴 mirror).
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  periodStart!: string;
}
