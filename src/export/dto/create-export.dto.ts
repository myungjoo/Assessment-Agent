// CreateExportDto — POST /api/admin/export 의 request body 검증 DTO (T-0488,
// ADR-0044 §1/§2). GrantInstanceAccessDto (T-0238) / EvaluateActivitiesDto (T-0293)
// 의 class-validator decorator 패턴 mirror — controller-scope ValidationPipe
// (whitelist + forbidNonWhitelisted + transform) 와 결합해 형식 검증을 boundary 에서
// 강제한다.
//
// 본 DTO 가 보유하지 않는 것 (ADR-0044 §2 raw 미저장 정합):
//   - raw payload 필드 0 — ExportJob 의 어떤 필드도 raw 외부 본문을 보유하지 않으며
//     DTO 입력도 동일하다. dateRange/entitySelector 는 dump 범위 한정 메타 (Json)
//     일 뿐 평가 자료 raw 본문이 아니다. whitelist + forbidNonWhitelisted 가 정의되지
//     않은 키 (raw 본문 키 등) 를 400 으로 거부해 raw 본문 0 구조를 type 차원에서 보존.
//   - requestedById 부재 — 누가 dump 를 발화했는지는 인증 actor (req.user.sub) 에서
//     추출하므로 DTO 에 박제하지 않는다 (client 가 임의 발화자 위장 불가, REQ-045).
//
// scope 별 한정값 분기 (ExportJobService.validateExportScope 가 실 검증 — DTO 는
// 형식만):
//   - scope=FULL  → dateRange/entitySelector 모두 미사용 (전체 entity 전 기간).
//   - scope=RANGE → dateRange 활용 (기간 한정의 필수 축 — 누락 시 service 가 400).
//   - scope=PARTIAL → entitySelector 활용 (entity 한정의 필수 축 — service 가 400).
// scope 별 필수 여부 (RANGE 의 dateRange 필수 등) 와 entity 멤버십 등 field-level
// 유효성 검증은 service-layer (validateExportScope 헬퍼 위임) 책임이므로 DTO 는
// 두 한정값을 @IsOptional 로 두고 형식만 검증한다 — dateRange 는 객체(@IsObject),
// entitySelector 는 entity 이름 배열(@IsArray, T-0491 round2 BLOCKER fix).
//
// 책임 경계 (Out of Scope — T-0488 §Out of Scope):
//   - dateRange 의 구체 shape (기간 from/to) 검증 — service 배선이 validateExportScope
//     위임으로 채움. 본 DTO 는 객체 여부 (@IsObject) 만 검증.
//   - entitySelector 의 per-element entity 멤버십 (Assessment/Person/... 만 허용) 검증
//     — validateExportScope 헬퍼 책임. 본 DTO 는 배열 형식 (@IsArray) 만 검증.
//   - 새 외부 dependency 0 — class-validator 는 이미 의존 (전 DTO 가 사용 중).
import { ExportScope } from "@prisma/client";
import { IsArray, IsEnum, IsObject, IsOptional } from "class-validator";

export class CreateExportDto {
  // scope — dump 범위 (FULL / RANGE / PARTIAL). @IsEnum 으로 ExportScope 의 유효
  // 멤버만 통과 (예: "ALL" / 소문자 "full" / 빈 값 등 비유효 enum 값은 400). raw
  // payload 키나 잘못된 scope 는 ValidationPipe 가 boundary 에서 거부.
  @IsEnum(ExportScope)
  scope!: ExportScope;

  // dateRange — scope=RANGE 시 기간 한정값 (Json 직렬화). 선택적 — 형식 (객체) 만
  // 검증하고 scope 별 필수 여부·구체 shape 은 service-layer (validateExportScope) 책임.
  @IsOptional()
  @IsObject()
  dateRange?: Record<string, unknown>;

  // entitySelector — scope=PARTIAL 시 entity 한정값 (entity 이름 배열, 예:
  // ["Person", "Group"]). validateExportScope 헬퍼가 entity 이름 string[] 배열을
  // 요구하므로 (T-0491 round2 BLOCKER fix — 구 @IsObject 는 배열을 거부해 PARTIAL
  // 실 경로가 동작 불가했음), DTO 는 @IsArray 로 형식만 검증한다. per-element entity
  // 멤버십 (허용 5 종) 검증은 service-layer (validateExportScope) 책임.
  @IsOptional()
  @IsArray()
  entitySelector?: unknown[];
}
