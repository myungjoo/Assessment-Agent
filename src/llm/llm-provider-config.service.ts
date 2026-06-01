// LlmProviderConfigService — LlmProviderConfig 도메인 의 read-only application
// service. T-0140 acceptance 박제 (T-0139 Follow-up #1 — `/api/llm/providers`
// 목록 slice). DifficultyMappingService (T-0138) 의 repository forward 패턴을
// mirror 하되 **추가로 apiKey secret redaction** 책임을 가진다.
//
// 핵심 보안 invariant (task §Why 박제):
//   - LlmProviderConfig.apiKey 는 평문 String 으로 저장된 secret (encryption-at-rest
//     는 ADR-0006 follow-up). GET 응답에 apiKey 를 **절대 포함하면 안 된다**.
//   - 따라서 본 service 는 repository 의 raw row 를 controller 로 그대로 forward 하지
//     않고, apiKey 를 제거한 view shape (LlmProviderConfigView) 배열로 변환해 반환한다.
//     controller 가 raw row 를 직접 직렬화하지 못하도록 sanitize 책임은 service 가 가짐.
//   - sanitize 는 **명시적 field pick** 으로 구현 (전체 row spread 후 apiKey delete
//     금지 — 새 secret 컬럼 추가 시 누락 방지 차원의 allow-list 정책). schema 에
//     새 secret 이 추가돼도 view 는 명시 pick 한 6 필드만 노출 → leak 표면 최소.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - POST/PATCH/DELETE config CRUD (생성/수정/삭제) — Follow-up #1 (본 task 는
//     read-only 목록 slice 만). create slice 가 본 redaction sanitize 헬퍼 위에 build.
//   - GET /api/llm/providers/:id (단건 조회) — Follow-up #2. 단건도 동일 redaction
//     적용 필요 — 본 service 의 sanitize 헬퍼 재사용 예정.
//   - apiKey encryption-at-rest — 평문 저장값 그대로 (ADR-0006 책임). 본 service 는
//     저장된 값을 응답에서 **제외 (redact)** 만 — 암호화 코드 0 / secret 처리 코드 0.
//   - provider HTTP client / 실제 LLM API call — 후속 routing task (HITL 게이트).
import { Injectable } from "@nestjs/common";
import type { LlmProviderConfig } from "@prisma/client";

import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

// LlmProviderConfigView — HTTP 응답으로 노출 가능한 LlmProviderConfig 의 view shape.
// LlmProviderConfig 에서 **apiKey 만 제외** 한 6 필드 (id / provider / endpointUrl /
// modelId / createdAt / updatedAt). apiKey 는 secret 이라 view 타입 자체에서 누락 —
// 타입 레벨에서도 controller / caller 가 apiKey 에 접근하지 못하도록 차단.
export type LlmProviderConfigView = Omit<LlmProviderConfig, "apiKey">;

@Injectable()
export class LlmProviderConfigService {
  constructor(
    // read-only 목록 조회 source. findMany 만 호출 (다중 row 모델 전체 조회).
    private readonly repository: LlmProviderConfigRepository,
  ) {}

  // sanitize — 단일 raw row → apiKey 제거 view 변환. 명시적 field pick (allow-list)
  // 으로 구현 — apiKey 는 destructure 한 뒤 폐기하지 않고 아예 view 객체 키에 포함
  // 시키지 않는다. 새 secret 컬럼이 schema 에 추가돼도 본 pick 에 없으면 view 에
  // 누출되지 않음 (deny-by-default).
  private sanitize(row: LlmProviderConfig): LlmProviderConfigView {
    return {
      id: row.id,
      provider: row.provider,
      endpointUrl: row.endpointUrl,
      modelId: row.modelId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // findAll — 등록된 LlmProviderConfig 전체를 apiKey 제거 view 배열로 반환.
  // repository.findMany 의 reject (DB 장애 등 의존성 실패) 는 swallow 하지 않고
  // 그대로 propagate (await 로 throw 전파). 빈 배열 (등록 0) 도 그대로 빈 배열 반환
  // — 404 변환 안 함 (컬렉션 조회의 정상 결과). 분기: 빈 배열 → 빈 배열,
  // 비어있지 않은 배열 → 각 row sanitize.
  async findAll(): Promise<LlmProviderConfigView[]> {
    const rows = await this.repository.findMany();
    return rows.map((row) => this.sanitize(row));
  }
}
