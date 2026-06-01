// UpdateLlmProviderConfigDto — PATCH /api/llm/providers/:id payload 검증 책임 DTO.
// T-0151 acceptance 박제. CreateLlmProviderConfigDto (T-0149) 의 class-validator
// 패턴을 1:1 mirror 하되, PATCH 의 **부분 갱신 시멘틱** 을 위해 4 필드 (provider /
// endpointUrl / apiKey / modelId) 를 **전부 @IsOptional** 로 둔다. 즉 부재(미제공)는
// 허용하지만, 명시한 경우에는 create DTO 와 동일한 형식 제약(@IsString / @IsNotEmpty /
// @MaxLength)을 강제한다 — "부재는 미변경, 명시는 교체" semantics 의 형식 게이트.
//
// 본 DTO 는 LlmProviderConfigController 의 PATCH 엔드포인트의 @Body() 로 사용된다.
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 raw 본문 키 (예: id / createdAt / 임의 extra 키) 포함 시 400
//     BadRequest (forbidNonWhitelisted) — DTO 의 4 필드 allow-list 밖 입력 차단.
//   - 명시한 필드의 빈 문자열 / wrong type / 길이 초과 시 400.
//   - 모든 필드 부재 (빈 body) 도 형식상 valid — service 가 변경할 필드만 골라 적용
//     (부재 필드는 미변경). 빈 body 는 사실상 no-op update 로 처리된다.
//
// validation rule 은 CreateLlmProviderConfigDto 의 string 검증 패턴 mirror — 단 모든
// 필드 앞에 @IsOptional 을 추가:
//   - @IsOptional — 필드 부재(undefined) 시 나머지 validator 를 skip (부분 갱신 허용).
//   - @IsString — 명시 시 string type 강제 (number / boolean / null 거부).
//   - @IsNotEmpty — 명시 시 빈 문자열 거부 (명시했다면 의미 있는 값이어야 함).
//   - @MaxLength(N) — 명시 시 비정상적으로 긴 입력 거부 (create DTO 와 동일 cap).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - provider 값 자체의 허용 집합 검증 (5 provider 중 하나) 은 본 DTO 책임 외 —
//     LlmProviderConfigService 가 isLlmProvider 로 미지원 provider → BadRequestException
//     (400) 변환. 본 DTO 는 형식 (명시 시 비어있지 않은 string) 만 검증.
//   - apiKey 의 AES-256-GCM 재암호화 — service 가 LlmApiKeyCipher.encrypt 로 수행
//     (본 DTO 는 평문 형식 검증만, 암호화 코드 0 / secret 처리 코드 0).
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 자체는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateLlmProviderConfigDto {
  // provider 식별자 (azure_openai / anthropic / google_gemini / openai / custom).
  // PATCH 에서는 optional — 부재 시 미변경, 명시 시 교체 (허용 집합 검증은 service 의
  // isLlmProvider 책임). @MaxLength(64) 는 create DTO 와 동일 cap.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider?: string;

  // provider endpoint URL (REQ-051~055 각 provider 별 endpoint). PATCH 에서는
  // optional — 부재 시 미변경, 명시 시 교체. @MaxLength(2048) 는 create DTO 동일 cap.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpointUrl?: string;

  // provider API key (평문 — 명시 시 service 가 LlmApiKeyCipher.encrypt 로 새
  // ciphertext envelope 으로 재암호화 후 교체, 부재 시 기존 ciphertext 유지 —
  // never-read-back, ADR-0014 §3). 응답에는 절대 미노출. @MaxLength(4096) 은
  // create DTO 동일 cap.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  apiKey?: string;

  // provider 내 model 식별자 (REQ-051~055). PATCH 에서는 optional — 부재 시 미변경,
  // 명시 시 교체. @MaxLength(255) 는 create DTO 동일 cap.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  modelId?: string;
}
