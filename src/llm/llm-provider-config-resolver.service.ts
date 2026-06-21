// LlmProviderConfigResolver — `defaultModelId` 의 source 를 `LlmProviderConfig`
// DB row 로 단일화하는 thin `@Injectable` resolver (ADR-0048 §Decision 1·2 박제).
// controller 진입 시 1 회 호출되어 `repository.findMany()` 결과의 row 수를 점검한
// 뒤 단일-row 의 `modelId` 를 반환한다.
//
// 책임 경계 (ADR-0048 §Out of scope 박제):
//   - 본 resolver 는 row 수 분기 + modelId 형식 검증 + 한국어 fail-fast 까지만 한다.
//     HTTP status (503 / 500 / 400) 매핑은 controller wiring task (chain item 3)
//     의 책임이며 본 layer 는 plain `Error` / `TypeError` throw 로 그친다.
//   - 다중-row default 선택 정책 (isDefault flag / env pointer / updatedAt /
//     per-provider) 의 택1 은 REQ-051 진입 시 별도 follow-up ADR 책임 — 본 layer
//     의 (c) 분기는 "다중-row 운용 = 미박제 운영 사고" 를 한국어 fail-fast 로 표면화.
//   - schema 변경 / `isDefault` 컬럼 / `@@unique` 추가 0 — ADR-0048 §Decision 4
//     박제 (schema migration 0 / 새 env 0 / 새 dep 0).
//
// LlmProviderConfigService 가 아닌 LlmProviderConfigRepository 를 직접 의존하는
// 이유 (ADR-0048 §Out of scope 박제): service 의 apiKey redaction view 는 modelId
// resolve 에 불필요하며, repository 직접 의존이 layer 의 책임을 좁힌다 (resolver
// 는 read-only modelId 추출 1 회 — apiKey 가 view 에 닿지 않음).
//
// repository.findMany 의 reject (DB 장애 등 의존성 실패) 는 swallow 하지 않고
// 그대로 propagate (LlmProviderConfigService.findAll 의 정책 mirror).
import { Injectable } from "@nestjs/common";

import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

@Injectable()
export class LlmProviderConfigResolver {
  constructor(
    // ADR-0048 §Decision 1 박제: resolver 는 `LlmProviderConfigRepository.findMany()`
    // 1 회 호출로 row 를 조회한다 (service 의 apiKey redaction view 는 미사용).
    private readonly repository: LlmProviderConfigRepository,
  ) {}

  // resolveDefaultModelId — `LlmProviderConfig` DB row 에서 `defaultModelId` 를
  // 해석해 반환한다 (ADR-0048 §Decision 1 흐름 + §Decision 2 의 3 분기 + 형식 검증).
  //
  // 분기 (ADR-0048 §Decision 2 박제):
  //   (a) length === 1 → 그 row 의 `modelId` 를 형식 검증 후 반환.
  //   (b) length === 0 → "LLM provider 가 설정되지 않았다" 한국어 fail-fast.
  //   (c) length >= 2 → "다중-row 운용 — 명시적 default 선택 정책 미박제" 한국어 fail-fast.
  //
  // 단일-row 의 `modelId` 가 빈/형식 위반 (빈 문자열 / non-string) 인 경우도
  // fail-fast — `buildFillRunScoringOptions` 의 invariant (defaultModelId 가 항상
  // 채워져 있음) 를 깨지 않도록 한국어 `TypeError` 로 차단 (ADR-0048 §Out of scope
  // type mismatch negative case).
  //
  // @throws {Error} (b) row 0 — LLM provider 설정 누락.
  // @throws {Error} (c) row >= 2 — 다중-row 운용 (후속 ADR 필요).
  // @throws {TypeError} 단일-row 의 modelId 가 빈/whitespace / non-string 일 때.
  async resolveDefaultModelId(): Promise<string> {
    const rows = await this.repository.findMany();

    // (b) row 0 — 운영자가 LLM provider 를 한 번도 설정하지 않은 상태. Admin UI
    // 의 provider config 화면에서 row 를 추가하기 전까지 호출은 정상 실패해야 한다.
    if (rows.length === 0) {
      throw new Error(
        "LlmProviderConfigResolver: LLM provider 가 설정되지 않았다 (LlmProviderConfig row 0 — 운영자 설정 누락).",
      );
    }

    // (c) row >= 2 — REQ-051 미진입 단계에서 row 가 ≥ 2 가 되는 것은 미박제 운영
    // 사고. silent 임의 선택은 평가 결과의 reproducibility 를 깨므로 fail-fast.
    if (rows.length >= 2) {
      throw new Error(
        `LlmProviderConfigResolver: LlmProviderConfig 다중-row 운용 — 명시적 default 선택 정책 미박제 (row 수=${rows.length}, 후속 ADR 필요).`,
      );
    }

    // (a) length === 1 — 그 row 의 modelId 를 형식 검증 후 반환.
    const row = rows[0];
    const candidate: unknown = row.modelId;

    // type mismatch 차단 — string 이 아니면 silent coercion 으로 비-string modelId
    // 가 gateway 로 흘러가는 회귀를 막기 위해 한국어 `TypeError` (build-fill-run
    // -scoring-options 의 normalizeModelId 패턴 mirror).
    if (typeof candidate !== "string") {
      throw new TypeError(
        `LlmProviderConfigResolver: LlmProviderConfig.modelId 는 string 이어야 한다: ${String(candidate)}`,
      );
    }

    // 빈 문자열 / whitespace-only 차단 — buildFillRunScoringOptions 의 invariant
    // (defaultModelId 가 항상 채워져 있음) 를 깨지 않도록 한국어 `TypeError` fail-fast.
    const trimmed = candidate.trim();
    if (trimmed.length === 0) {
      throw new TypeError(
        "LlmProviderConfigResolver: LlmProviderConfig.modelId 가 비어있다 (빈 문자열 / whitespace-only — 운영자 설정 형식 위반).",
      );
    }

    return trimmed;
  }
}
