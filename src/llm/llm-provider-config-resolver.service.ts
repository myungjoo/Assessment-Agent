// LlmProviderConfigResolver — `defaultModelId` 의 source 를 `LlmProviderConfig`
// DB row 로 단일화하는 thin `@Injectable` resolver (ADR-0048 §Decision 1 박제).
// controller 진입 시 1 회 호출되어 **명시 기본 provider 슬롯 → row 수 fallback**
// 순서로 판정한 뒤 그 row 의 `modelId` 를 반환한다 (ADR-0062 §Decision 4, T-1864).
//
// 우선순위 (ADR-0062 §Decision 4 — 오너 지시 2026-09-03 "명시 선택이 언제나 우선"):
//   (0) 슬롯 존재 → 그 슬롯이 가리키는 config 의 modelId. **row 총수를 보지 않는다**
//       (seed row + UI row 공존 = row ≥ 2 에서도 default 경로가 살아 있다).
//   (a) 슬롯 부재 + row 1 개 → 그 row (ADR-0048 (a) 하위 호환, 조치 0).
//   (b) 슬롯 부재 + row 0 개 → 기존 한국어 fail-fast 그대로.
//   (c) 슬롯 부재 + row ≥ 2 개 → 행동 지시형 한국어 fail-fast ("Admin UI 에서 기본
//       provider 를 지정하라"). ADR-0048 의 "후속 ADR 필요" 문구는 해소돼 제거.
//
// 책임 경계 (ADR-0048 §Out of scope 승계): 본 layer 는 분기 + modelId 형식 검증 +
// 한국어 fail-fast 까지만 한다 (HTTP status 매핑은 controller). 반환 계약
// (`Promise<string>`) 무변경이라 AssessmentEvaluationModule 배선은 그대로다. 기본
// provider 의 **지정** (쓰기) 은 LlmProviderConfigService.setDefault / T-1865 소관.
// service 가 아닌 repository 2 개를 직접 의존하는 이유도 승계 — apiKey redaction view
// 는 modelId resolve 에 불필요하고, 직접 의존이 layer 책임을 좁힌다.
//
// repository reject (DB 장애 등) 는 어느 조회든 swallow 없이 그대로 propagate.
import { Injectable } from "@nestjs/common";

import { LlmDefaultProviderRepository } from "./llm-default-provider.repository";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

@Injectable()
export class LlmProviderConfigResolver {
  constructor(
    // ADR-0048 §Decision 1 박제: row 조회 source (service 의 redaction view 미사용).
    private readonly repository: LlmProviderConfigRepository,
    // ADR-0062 §Decision 2 의 단일 슬롯 table repository (T-1863). 슬롯 조회가
    // **언제나 먼저** 실행돼 명시 선택 최우선 제약을 구조적으로 보장한다.
    private readonly defaultProviderRepository: LlmDefaultProviderRepository,
  ) {}

  // resolveDefaultModelId — 위 (0)/(a)/(b)/(c) 순서로 판정해 그 row 의 `modelId` 를
  // 형식 검증 후 반환한다.
  //
  // @throws {Error} (0) 슬롯이 가리키는 config row 부재 (깨진 FK — silent fallback
  //                 금지: 임의 선택은 평가 결과의 reproducibility 를 깬다).
  // @throws {Error} (b) 슬롯 부재 + row 0 / (c) 슬롯 부재 + row ≥ 2.
  // @throws {TypeError} 채택된 row 의 modelId 가 빈/whitespace / non-string 일 때
  //                 (어느 분기로 도달했든 동일 적용).
  async resolveDefaultModelId(): Promise<string> {
    // (0) 명시 선택 최우선 — 슬롯이 있으면 row 수와 무관하게 슬롯이 이긴다.
    const slot = await this.defaultProviderRepository.findSlot();
    if (slot !== null) {
      const row = await this.repository.findById(slot.llmProviderConfigId);
      if (row === null) {
        throw new Error(
          `LlmProviderConfigResolver: 기본 provider 슬롯이 가리키는 LlmProviderConfig 가 없다 (llmProviderConfigId=${slot.llmProviderConfigId} — onDelete: Restrict 상 정상 경로로는 발생 불가, DB 직접 조작 의심).`,
        );
      }
      return this.normalizeModelId(row.modelId);
    }

    const rows = await this.repository.findMany();

    // (b) row 0 — 운영자가 LLM provider 를 한 번도 설정하지 않은 상태. Admin UI
    // 의 provider config 화면에서 row 를 추가하기 전까지 호출은 정상 실패해야 한다.
    if (rows.length === 0) {
      throw new Error(
        "LlmProviderConfigResolver: LLM provider 가 설정되지 않았다 (LlmProviderConfig row 0 — 운영자 설정 누락).",
      );
    }

    // (c) row >= 2 + 슬롯 부재 — "미박제 운영 사고" 가 아니라 **운영자가 아직 기본을
    // 고르지 않은 정상 상태** (seed row + UI row 공존) 라 메시지가 해소 방법을 지시
    // 한다. silent 임의 선택은 여전히 금지 (reproducibility).
    if (rows.length >= 2) {
      throw new Error(
        `LlmProviderConfigResolver: LlmProviderConfig 가 ${rows.length} 개인데 기본 provider 가 지정되지 않았다 — Admin UI 의 LLM provider 설정에서 기본 provider 를 지정하라 (row 수=${rows.length}).`,
      );
    }

    // (a) length === 1 — 그 row 의 modelId 를 형식 검증 후 반환 (하위 호환).
    return this.normalizeModelId(rows[0].modelId);
  }

  // normalizeModelId — 채택된 row 의 modelId 형식 검증 + trim. (0)/(a) 두 분기가
  // 공유하므로 helper 로 외화 (`buildFillRunScoringOptions` 패턴 mirror).
  private normalizeModelId(candidate: unknown): string {
    // type mismatch 차단 — silent coercion 으로 비-string modelId 가 gateway 로
    // 흘러가는 회귀를 한국어 `TypeError` 로 막는다.
    if (typeof candidate !== "string") {
      throw new TypeError(
        `LlmProviderConfigResolver: LlmProviderConfig.modelId 는 string 이어야 한다: ${String(candidate)}`,
      );
    }

    // 빈 문자열 / whitespace-only 차단 — defaultModelId 가 항상 채워져 있다는
    // buildFillRunScoringOptions 의 invariant 보호.
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      throw new TypeError(
        "LlmProviderConfigResolver: LlmProviderConfig.modelId 가 비어있다 (빈 문자열 / whitespace-only — 운영자 설정 형식 위반).",
      );
    }

    return trimmed;
  }
}
