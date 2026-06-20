// UnevaluatedFillPlanRequestDto — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038)의 미평가 fill 계획 요청 endpoint(후속 controller wiring slice)의
// request body 검증 DTO. `IntendedPeriodCoordinatesInput`(evaluation-intended-period-
// coordinates.ts L32~47)의 5 축 — personIds / period / scope / rangeStart / rangeEnd —
// 을 HTTP boundary 에서 **형식만** 검증한다.
//
// `PeriodBridgeDto`(T-0317) / `EvaluateActivitiesDto`(T-0293) 패턴 mirror —
// class-validator decorator 로 형식만 검증하고, 허용 literal 값(period 의 day/week/month,
// scope 의 commit/document/aggregate) 검증은 service/domain helper 책임(@IsIn 미적용,
// 기존 evaluation DTO 관행 정합). rangeStart/rangeEnd 는 ISO-8601 string 으로 받고 Date
// 변환·KST boundary snap·반열림 `[start, end)` 범위 검증은 후속 controller slice 책임.
//
// 본 DTO 는 후속 controller endpoint slice 의 @Body() 로 사용되어
// `IntendedPeriodCoordinatesInput`(rangeStart/rangeEnd string → Date 변환 포함)으로
// 변환된 뒤 `EvaluationUnevaluatedFillPlanner.planUnevaluatedFill`(T-0542)로 흘러간다.
// controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)과 결합돼
// 다음을 자동 강제한다:
//   - 정의되지 않은 필드 → 400 BadRequest(forbidNonWhitelisted).
//   - decorator 위반(필수 누락 / wrong type / 잘못된 ISO date) → 400.
//
// 책임 경계(task Out of Scope 정합):
//   - controller endpoint 실배선 · string→Date 변환 · KST boundary snap · planner 호출은
//     본 DTO 밖(후속 wiring slice).
//   - 허용 literal 값 검증(period day/week/month, scope commit/document/aggregate)은
//     domain helper / service 책임(@IsIn 미적용).
//   - 새 외부 dependency 0 — class-validator 는 이미 의존(period-bridge.dto.ts /
//     evaluate-activities.dto.ts 가 사용 중, package.json 박제). nested DTO 0(5 축 모두
//     primitive(string) / primitive 배열이라 class-transformer `@Type` 불요).
import { IsArray, IsISO8601, IsNotEmpty, IsString } from "class-validator";

export class UnevaluatedFillPlanRequestDto {
  // personIds — 미평가 fill 계획을 생성할 person 식별자 배열
  // (`IntendedPeriodCoordinatesInput.personIds` 와 형식상 1:1). 각 원소는 비어있지 않은
  // string. 형식만 검증 — 실 Person row 존재·중복·정규화는 본 DTO 밖(domain helper /
  // service 책임).
  //
  // 빈 배열 정책(박제): 도메인 helper `enumerateIntendedPeriodCoordinates` 는 빈
  // `personIds` 를 person 축 공집합으로 흡수해 빈 plan(빈 좌표 배열)을 결정적으로
  // 반환한다. 따라서 DTO 단에서 `@ArrayNotEmpty` 를 **적용하지 않고** 빈 배열을 형식상
  // 허용한다 — 빈 배열 → 빈 plan 의 자연스러운 흐름(거부 책임을 도메인 결정성에 위임).
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  personIds!: string[];

  // period — 평가 기간 종류(day/week/month enum-as-String). 형식만 검증, 허용 literal 값은
  // domain helper / service 책임(@IsIn 미적용 — period-bridge.dto 의 period/scope 관행 정합).
  @IsString()
  @IsNotEmpty()
  period!: string;

  // scope — 평가 scope(commit/document/aggregate enum-as-String). 형식만 검증, 허용 literal
  // 값은 domain helper / service 책임(@IsIn 미적용).
  @IsString()
  @IsNotEmpty()
  scope!: string;

  // rangeStart — enumeration 시작 instant(ISO-8601 string, 반열림 `[rangeStart, rangeEnd)`
  // 의 시작 축). `@IsISO8601()` 로 형식을 boundary 에서 강제 — 비-ISO 문자열
  // (예: "2026-13-99")은 400 으로 거부되어 controller 의 `new Date(...)` 가 Invalid Date 를
  // 만들어 planner 로 흘러들어가는 opaque 500 을 차단한다(period-bridge.dto 의 periodStart
  // 패턴 mirror). string → Date 변환·KST boundary snap 은 후속 controller slice 책임.
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  rangeStart!: string;

  // rangeEnd — enumeration 종료 instant(ISO-8601 string, 반열림 `[rangeStart, rangeEnd)`
  // 의 배타 종료 축). `@IsISO8601()` 로 형식만 강제 — Date 변환·범위 검증
  // (rangeStart < rangeEnd 등)은 후속 controller / service 책임.
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  rangeEnd!: string;
}
