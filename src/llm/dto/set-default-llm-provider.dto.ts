// SetDefaultLlmProviderDto — PUT /api/llm/providers/default payload 검증 책임 DTO
// (T-1865, ADR-0062 (B) API shape). AssignDifficultyMappingDto (T-0139) 의 단일 필수
// 필드 패턴 1:1 mirror — "슬롯에 config 를 지정" 하는 행위가 동형이기 때문이다
// (난이도 슬롯 ↔ 전역 기본 provider 슬롯). @IsOptional 없음 — 대상 id 는 필수.
//
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합해 자동 강제되는 것: allow-list 밖 raw 본문 키 (provider / isDefault / extra
// 등) 포함 시 400 · llmProviderConfigId 누락 / 빈 문자열 / wrong type 시 400 ·
// body 자체 부재 → 필수 필드 누락으로 400.
//
// 책임 경계 (Out of Scope): 지정 대상 config 의 실 존재 검증은
// LlmProviderConfigService.setDefault 가 슬롯 upsert 의 P2003 / P2025 를 404 로
// 수렴시키는 책임이며 (본 DTO 는 형식만), extra-property 거부 자체는 pipe 책임.
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SetDefaultLlmProviderDto {
  // 전역 기본 provider 슬롯이 가리킬 LlmProviderConfig 의 id. 검증 rule 은
  // AssignDifficultyMappingDto.llmProviderConfigId 와 동일 — @IsString (number /
  // boolean / null 거부) · @IsNotEmpty (빈값 거부) · @MaxLength(255) (cuid id 의
  // application-layer 길이 cap). 실 존재 검증은 service 책임 (부재 시 404).
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  llmProviderConfigId!: string;
}
