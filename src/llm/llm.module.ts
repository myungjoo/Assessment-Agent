// LlmModule — LlmProviderConfig entity 의 책임 module (modules.md "LlmModule" 항목 —
// 외부 adapter leaf). T-0135 scaffold — LlmProviderConfigRepository 등록.
//
// 책임 범위 (본 task):
//   - LlmProviderConfigRepository / DifficultyMappingRepository provider 등록 +
//     export (후속 LlmProviderConfigService T-0139 / 다른 module 이 inject 가능하도록).
//   - DifficultyMappingService provider 등록 + export (T-0138 추가 — ADR-0011 §2
//     resolve + §3 fail-fast 의 service-level 강제. T-0139 Admin endpoint 의 backbone).
//   - DifficultyMappingController 등록 (T-0139 추가 — Admin 난이도 모델 지정 endpoint:
//     GET 슬롯 목록 / PATCH 슬롯별 model 재지정. DifficultyMappingService forward + RBAC).
//   - LlmProviderConfigService + LlmProviderConfigController 등록 (T-0140 추가 — Admin
//     LLM provider config 목록 조회 endpoint: GET /api/llm/providers, apiKey redact view.
//     LlmProviderConfigRepository forward + RBAC. repository 는 이미 등록됨 — service inject 만).
//   - LlmGateway interface + LlmProvider enum 은 llm-gateway.interface.ts 에 박제 —
//     구현 class 0 이므로 본 module 에 gateway provider 등록 0 (후속 routing task 책임).
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로 export
// 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다 (UserModule
// 과 동일 — PrismaService 생성자 주입은 global scope 에서 해결됨).
//
// 후속 task 확장 예정:
//   - 후속 routing task — provider 별 LlmGateway 구현 class + difficulty routing
//     (resolve 된 modelId 로 외부 provider 호출 — 외부 dep HITL 게이트 발화).
//   - T-0139 — LlmProviderConfigService + Controller (Admin LLM 지정 endpoint) +
//     DifficultyMapping 슬롯 재지정 endpoint (본 module 의 DifficultyMappingService
//     forward).
import { Module } from "@nestjs/common";

import { DifficultyMappingController } from "./difficulty-mapping.controller";
import { DifficultyMappingRepository } from "./difficulty-mapping.repository";
import { DifficultyMappingService } from "./difficulty-mapping.service";
import { LlmProviderConfigController } from "./llm-provider-config.controller";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";
import { LlmProviderConfigService } from "./llm-provider-config.service";

@Module({
  // DifficultyMappingController (T-0139) — Admin 난이도 모델 지정 endpoint. service 는
  // 이미 providers 에 등록됨 (controller 가 inject 만). LlmProviderConfigController
  // (T-0140) — Admin LLM provider config 목록 조회 endpoint (apiKey redact view).
  // LlmGateway 구현 controller 는 후속 routing task 책임.
  controllers: [DifficultyMappingController, LlmProviderConfigController],
  providers: [
    LlmProviderConfigRepository,
    LlmProviderConfigService,
    DifficultyMappingRepository,
    DifficultyMappingService,
  ],
  exports: [
    LlmProviderConfigRepository,
    LlmProviderConfigService,
    DifficultyMappingRepository,
    DifficultyMappingService,
  ],
})
export class LlmModule {}
