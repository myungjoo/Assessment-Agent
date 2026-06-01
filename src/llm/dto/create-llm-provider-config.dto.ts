// CreateLlmProviderConfigDto — POST /api/llm/providers payload 검증 책임 DTO.
// T-0149 acceptance 박제 — AssignDifficultyMappingDto (T-0139) 의 class-validator
// 패턴 mirror. LlmProviderConfig 생성에 필요한 4 user-settable 필드 (provider /
// endpointUrl / apiKey / modelId) 를 형식 검증한다. id / createdAt / updatedAt 은
// schema 의 @default / @updatedAt 가 cover 하므로 입력에서 제외.
//
// 본 DTO 는 LlmProviderConfigController 의 POST 엔드포인트의 @Body() 로 사용된다.
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 raw 본문 키 (예: id / createdAt / 임의 extra 키) 포함 시 400
//     BadRequest (forbidNonWhitelisted) — DTO 의 4 필드 allow-list 밖 입력 차단.
//   - 필수 필드 누락 / 빈 문자열 / wrong type 시 400.
//
// validation rule 은 AssignDifficultyMappingDto 의 string 검증 패턴 1:1 mirror:
//   - @IsString — string type 강제 (number / boolean / null 거부).
//   - @IsNotEmpty — 빈 문자열 / null / undefined 거부 (4 필드 모두 생성 시 필수).
//   - @MaxLength(N) — 비정상적으로 긴 입력 거부. apiKey 는 secret envelope 평문
//     원본이므로 넉넉히 cap, 나머지는 식별자/URL 길이 정합 cap.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - provider 값 자체의 허용 집합 검증 (5 provider 중 하나) 은 본 DTO 책임 외 —
//     LlmProviderConfigService 가 isLlmProvider 로 미지원 provider → BadRequestException
//     (400) 변환 (T-0139 의 isDifficulty service-layer 검증 패턴 mirror). 본 DTO 는
//     형식 (비어있지 않은 string) 만 검증 — provider 멤버십 검증 코드 0.
//   - apiKey 의 AES-256-GCM encryption — service 가 LlmApiKeyCipher.encrypt 로 수행
//     (본 DTO 는 평문 형식 검증만, 암호화 코드 0 / secret 처리 코드 0).
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 자체는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateLlmProviderConfigDto {
  // provider 식별자 (azure_openai / anthropic / google_gemini / openai / custom).
  // 본 DTO 는 형식 (비어있지 않은 string) 만 검증 — 허용 집합 검증은 service 의
  // isLlmProvider 책임. @MaxLength(64) 는 enum literal 최장값 (azure_openai) 보다
  // 충분히 큰 비정상 입력 cap.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider!: string;

  // provider endpoint URL (REQ-051~055 각 provider 별 endpoint). 형식 (비어있지
  // 않은 string) 만 검증 — URL 형식 정합은 본 task scope 외 (service 가 그대로
  // 영속, 실 호출은 후속 routing task 책임). @MaxLength(2048) 는 URL 길이 cap.
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpointUrl!: string;

  // provider API key (평문 — service 가 LlmApiKeyCipher.encrypt 로 ciphertext
  // envelope 변환 후 영속, 응답에는 절대 미노출 — ADR-0014 §3). @MaxLength(4096) 는
  // 비정상적으로 긴 입력 거부 cap (provider key 는 통상 수십~수백 char).
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  apiKey!: string;

  // provider 내 model 식별자 (REQ-051~055). 형식 (비어있지 않은 string) 만 검증.
  // @MaxLength(255) 는 model 식별자 길이 cap (AssignDifficultyMappingDto.id 정합).
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  modelId!: string;
}
