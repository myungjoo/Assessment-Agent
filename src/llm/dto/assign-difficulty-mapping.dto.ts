// AssignDifficultyMappingDto — PATCH /api/llm/difficulty-mappings/:difficulty payload
// 검증 책임 DTO. T-0139 acceptance 박제 — UpdatePartDto (T-0069) 의 class-validator
// 패턴 mirror, 단 assign 은 슬롯에 model 을 "지정" 하는 필수 행위이므로 @IsOptional
// 없이 단일 필수 필드 (llmProviderConfigId) 만 cover (ADR-0011 §2 슬롯 ↔
// LlmProviderConfig FK 재지정).
//
// 본 DTO 는 DifficultyMappingController 의 PATCH 엔드포인트 의 @Body() 로 사용된다.
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 raw 본문 키 (예: difficulty / provider / extra 등) 포함 시 400
//     BadRequest (forbidNonWhitelisted) — controller 가 :difficulty 를 path param 으로만
//     받으므로 body 에 difficulty 가 섞이는 오용을 차단.
//   - 필수 필드 (llmProviderConfigId) 누락 / 빈 문자열 / wrong type 시 400.
//
// validation rule 은 UpdatePartDto.name 의 string 검증 1:1 mirror + @IsOptional 제거:
//   - @IsString — string type 강제 (number / boolean / null 거부).
//   - @IsNotEmpty — 빈 문자열 / null / undefined 거부 (assign 은 실제 config 지정
//     필수). 단 class-validator 의 @IsNotEmpty 는 trim 하지 않으므로 공백만 string 은
//     통과 (cuid id 에 공백이 섞일 일은 없어 실해 없음 — 존재 검증은 service 책임).
//   - @MaxLength(255) — LlmProviderConfig.id (cuid) 의 application-layer 길이 cap
//     정합 (UpdatePartDto.name 의 255 cap 정합 — 비정상적으로 긴 입력 거부).
//
// 책임 경계 (Out of Scope):
//   - :difficulty path param 검증 — controller 가 raw forward 하고 service 의
//     isDifficulty 가 미지원 난이도 → BadRequestException(400) 변환 책임 (본 DTO 책임 외).
//   - 지정 대상 LlmProviderConfig 의 실 존재 검증 — DifficultyMappingService 의
//     llmProviderConfigRepository.findById null → NotFoundException(404) 책임. 본 DTO 는
//     형식 (비어있지 않은 string) 만 검증.
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 자체는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class AssignDifficultyMappingDto {
  // 난이도 슬롯에 지정할 LlmProviderConfig 의 id (FK). assign 은 필수 행위이므로
  // @IsOptional 없음 — 누락 / 빈 문자열 시 400. 실 존재 검증은 service 책임 (DTO 는
  // 형식만). @MaxLength(255) 가 비정상적으로 긴 입력을 거부 (UpdatePartDto.name 정합).
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  llmProviderConfigId!: string;
}
