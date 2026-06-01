// LlmModule — LlmProviderConfig entity 의 책임 module (modules.md "LlmModule" 항목 —
// 외부 adapter leaf). T-0135 scaffold — LlmProviderConfigRepository 등록.
//
// 책임 범위 (본 task):
//   - LlmProviderConfigRepository provider 등록 + export (후속 LlmProviderConfigService
//     T-0139 / 다른 module 이 inject 가능하도록 노출).
//   - LlmGateway interface + LlmProvider enum 은 llm-gateway.interface.ts 에 박제 —
//     구현 class 0 이므로 본 module 에 gateway provider 등록 0 (T-0137+ 책임).
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다 (UserModule
// 과 동일 — PrismaService 생성자 주입은 global scope 에서 해결됨).
//
// 후속 task 확장 예정:
//   - T-0138 — provider 별 LlmGateway 구현 class + difficulty routing (외부 dep
//     HITL 게이트 발화) + DifficultyMappingService (fail-fast 강제 — ADR-0011 §3).
//   - T-0139 — LlmProviderConfigService + Controller (Admin LLM 지정 endpoint) +
//     DifficultyMapping 슬롯 재지정 endpoint.
import { Module } from "@nestjs/common";

import { DifficultyMappingRepository } from "./difficulty-mapping.repository";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

@Module({
  providers: [LlmProviderConfigRepository, DifficultyMappingRepository],
  exports: [LlmProviderConfigRepository, DifficultyMappingRepository],
})
export class LlmModule {}
