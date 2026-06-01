// LlmGateway interface + LlmProvider enum — T-0135 (P4 LLM provider 추상화의
// 시작점, REQ-049/051~055/099~103). 외부 provider SDK 0 종 / 외부 자격증명 0 의
// dependency-free scaffold — interface·enum 만 박제하고 구현 class 는 0.
//
// 책임 경계:
//   - 본 파일은 LLM provider 호출의 추상 계약 (`LlmGateway`) 과 지원 provider
//     식별자 집합 (`LlmProvider`) 만 정의한다. 실제 provider 별 HTTP client 구현
//     (Azure OpenAI / Anthropic / Google Gemini / OpenAI / custom) 은 후속
//     T-0137+ 책임이며, 그 시점에 CLAUDE.md §5 HITL 게이트 (외부 dependency 추가)
//     가 발화한다. 본 task 는 게이트 미발화 — interface 만으로 외부 dep 0.
//   - provider 별 routing / LlmGateway 구현 class 도 본 task Out of Scope (T-0137).
//
// LlmProvider enum — REQ-051~055 의 5 지원 provider 식별자.
//   - schema.prisma 의 LlmProviderConfig.provider 컬럼은 enum-as-String literal
//     박제 (User.role / ServiceIdentity.service / Assessment.period 정공법 정합 —
//     Prisma enum 격상은 별도 ADR). 본 TS enum 이 그 허용 집합의 single source —
//     application-layer (후속 service) 가 provider 값 invariant 검증 시 본 enum
//     멤버십을 기준으로 한다.
//   - 값은 schema 컬럼에 그대로 저장되는 snake_case literal (azure_openai 등).
export enum LlmProvider {
  Custom = "custom",
  AzureOpenai = "azure_openai",
  Anthropic = "anthropic",
  GoogleGemini = "google_gemini",
  Openai = "openai",
}

// LlmProvider enum 의 5 멤버 전체를 배열로 노출 — application-layer 의 provider
// 값 검증 (허용 집합 밖 → BadRequestException, 후속 service 책임) 및 본 task 의
// interface spec 이 "5 값 모두 정의됐는지" 를 검증할 때 사용하는 single source.
// Object.values 의 string enum 동작 (값만 반환) 에 의존 — TS string enum 은
// reverse mapping 을 생성하지 않으므로 추가 필터 불요.
export const LLM_PROVIDERS: readonly LlmProvider[] = Object.values(LlmProvider);

// 주어진 문자열이 지원 provider 식별자인지 판정하는 type guard. 후속
// LlmProviderConfigService / Controller DTO validation 이 raw 입력 (string) 을
// LlmProvider 로 좁힐 때 사용. 본 task 는 repository scaffold 만이라 직접 호출처
// 0 이나, enum 의 허용 집합 contract 를 명시적 symbol 로 박제 (interface spec 의
// negative case — 잘못된 provider 값 검증 — 가 본 guard 를 cover).
export function isLlmProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

// LlmGateway.generate 의 옵션 — provider 별 공통 파라미터의 최소 추상. 실제
// provider 별 확장 (temperature / max tokens / model override 등) 은 구현 시점
// (T-0137+) 에 확장. 본 scaffold 는 modelId 단일 필수 + difficulty 선택만 박제.
export interface LlmGenerateOptions {
  // 사용할 LlmProviderConfig.modelId — provider 내 model 식별자.
  modelId: string;
  // 난이도 힌트 (easy / medium / hard) — DifficultyMapping (T-0136) 연동의
  // placeholder. 본 task 는 매핑 로직 0, 옵션 shape 만 박제.
  difficulty?: string;
}

// LlmGateway.generate 의 반환 — LLM 정성 평가문 (narrative) + provider/model
// 메타. 실제 token usage / 비용 메타는 구현 시점 확장.
export interface LlmGenerateResult {
  // LLM 이 생성한 정성 평가문 본문 (raw 아님 — 생성 결과물, R-59 적용 외).
  narrative: string;
  // 실제 호출에 사용된 provider 식별자.
  provider: LlmProvider;
  // 실제 호출에 사용된 model 식별자.
  modelId: string;
}

// LlmGateway — LLM provider 호출의 추상 계약. 구현은 후속 T-0137+ (provider 별
// HTTP client). 본 interface 는 NestJS DI token 으로도 활용 가능하나, 본 task 는
// 구현 class 0 이므로 provider 등록은 하지 않는다 (interface 만).
export interface LlmGateway {
  // 프롬프트를 LLM 에 전달해 정성 평가문을 생성한다. provider/model 선택은
  // options.modelId + 구현체의 routing (T-0137) 책임.
  generate(
    prompt: string,
    options: LlmGenerateOptions,
  ): Promise<LlmGenerateResult>;
}
