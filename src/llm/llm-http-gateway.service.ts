// LlmHttpGateway — multi-provider orchestration service (T-0156 → T-0158, P4
// milestone-1 2·4차 slice, REQ-099~103). config.provider 값에 따라 azure_openai
// adapter(buildAzureOpenaiRequest / parseAzureOpenaiResponse, T-0155) 또는
// openai-compatible adapter(buildOpenaiCompatibleRequest /
// parseOpenaiCompatibleResponse, T-0157)를 선택 dispatch 해 `LlmGateway` 계약을
// 구현한다. 흐름: config 조회 → apiKey decrypt → provider 분기 dispatch(요청 조립)
// → (주입된) fetch → HTTP 상태 검사 → provider 분기 dispatch(응답 파싱).
//
// 책임 경계:
//   - 본 slice(T-0158)는 azure_openai / custom / openai 3 provider 를 처리한다.
//     anthropic / google_gemini 는 wire 포맷이 달라(adapter 순수 함수 미존재)
//     여전히 "미지원" error throw — 연결은 Follow-up #1·#2.
//   - apiVersion 영속 컬럼은 아직 없다(LlmProviderConfig 4 필드 = provider/
//     endpointUrl/apiKey/modelId). azure 경로만 상수 default
//     (AZURE_OPENAI_DEFAULT_API_VERSION)로 공급하고(openai-compatible 는 api-version
//     불요), 영속 컬럼화는 schema migration(§5 게이트) → Follow-up #3.
//   - fetch 는 직접 호출하지 않고 FetchLike 함수로 주입받는다(default globalThis.fetch).
//     실 네트워크 호출 0 — unit 은 주입한 mock 으로 검증. cipher 도 DI 주입이라 unit
//     에서 mock — 실 LLM_APIKEY_ENC_KEY / 실 decrypt 미발생.
//   - 실 네트워크/실 credential 통합(env 주입 + smoke/e2e)은 Follow-up #4.
import { Injectable, Optional } from "@nestjs/common";

import { LlmApiKeyCipher } from "./llm-apikey-cipher.service";
import {
  LlmGateway,
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "./llm-gateway.interface";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";
import {
  buildAzureOpenaiRequest,
  parseAzureOpenaiResponse,
} from "./providers/azure-openai.adapter";
import {
  buildOpenaiCompatibleRequest,
  parseOpenaiCompatibleResponse,
} from "./providers/openai-compatible.adapter";

// azure_openai REST api-version 의 상수 default. LlmProviderConfig 에 apiVersion
// 영속 컬럼이 아직 없으므로(추가는 schema migration → §5 게이트) 본 slice 는 이
// 상수로 공급한다. 영속 컬럼화는 Follow-up #2.
export const AZURE_OPENAI_DEFAULT_API_VERSION = "2024-02-15-preview";

// 주입 가능한 fetch 추상 — Node 내장 fetch 의 최소 surface(url + init → status/json).
// 직접 globalThis.fetch 를 호출하면 unit 에서 mock 이 불가하므로 함수 타입으로 받는다.
// 실 의존은 Node 내장 fetch 1 종(새 외부 dependency 0).
export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

@Injectable()
export class LlmHttpGateway implements LlmGateway {
  // fetch 는 생성자 주입(@Optional — NestJS DI 는 fetchFn 을 resolve 하지 않고
  // default globalThis.fetch 를 사용. function 타입이라 DI token 이 없으므로 @Optional
  // 로 skip 시켜야 module compile 이 성공한다). cipher / repository 는 LlmModule 에
  // 이미 등록된 provider 를 DI 로 주입. unit 은 셋 모두 mock 으로 대체한다.
  constructor(
    private readonly repository: LlmProviderConfigRepository,
    private readonly cipher: LlmApiKeyCipher,
    @Optional()
    private readonly fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
  ) {}

  // generate — config 식별자(options.modelId)로 저장된 raw config 를 조회해
  // provider 별 LLM 호출을 orchestrate 한다. service.findById 가 아니라 repository 의
  // raw row 를 직접 조회한다 — apiKey ciphertext 가 필요하므로(service view 는 redact).
  // build/parse 두 dispatch 지점은 동일 config.provider 기준으로 일관되게 분기한다.
  async generate(
    prompt: string,
    options: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    // (1) config 조회 — 부재 시 명확한 error throw.
    const config = await this.repository.findById(options.modelId);
    if (config === null) {
      throw new Error(
        `LLM provider config 를 찾을 수 없습니다 (id: ${options.modelId})`,
      );
    }

    // (2) provider 검사 — 본 slice 는 azure_openai / custom / openai 만 처리한다.
    // anthropic / google_gemini / 알 수 없는 값은 adapter 순수 함수가 아직 없어
    // 미지원 throw(provider 값 포함). 연결은 Follow-up #1·#2.
    const provider = config.provider as LlmProvider;
    if (
      provider !== LlmProvider.AzureOpenai &&
      provider !== LlmProvider.Custom &&
      provider !== LlmProvider.Openai
    ) {
      throw new Error(
        `미지원 provider 입니다 — 본 slice 는 azure_openai / custom / openai 만 처리합니다 (provider: ${config.provider})`,
      );
    }

    // (3) apiKey 평문화 — cipher.decrypt 가 변조/잘못된 키 시 throw(swallow 금지).
    const apiKey = this.cipher.decrypt(config.apiKey);

    // (4) build dispatch — provider 에 따라 요청 조립. azure 만 apiVersion 상수
    // default 공급(Follow-up #3 영속 컬럼화 전까지), openai-compatible 은 api-version
    // 불요. custom / openai 는 동일 wire 포맷(OpenAI Chat Completions 호환) 공유.
    const request =
      provider === LlmProvider.AzureOpenai
        ? buildAzureOpenaiRequest({
            endpointUrl: config.endpointUrl,
            modelId: config.modelId,
            apiVersion: AZURE_OPENAI_DEFAULT_API_VERSION,
            apiKey,
            prompt,
            options,
          })
        : buildOpenaiCompatibleRequest({
            endpointUrl: config.endpointUrl,
            modelId: config.modelId,
            apiKey,
            prompt,
            options,
          });

    // (5) 주입된 fetch 로 HTTP 호출(POST). 실 네트워크는 unit 에서 mock 으로 대체.
    const response = await this.fetchFn(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    // (6) HTTP non-2xx 분기 — provider / status 를 포함한 명확한 error throw.
    if (!response.ok) {
      throw new Error(
        `${provider} HTTP 호출 실패 (status: ${response.status})`,
      );
    }

    // (7) parse dispatch — build 와 동일 provider 기준으로 응답 JSON 을
    // LlmGenerateResult 로 변환(비정상 응답은 parse 가 throw). openai-compatible 은
    // provider 인자를 넘겨 result.provider 에 정확히 custom/openai 가 채워지도록 한다
    // (custom/openai 가 동일 wire 포맷을 공유하므로 호출처가 실제 provider 를 전달).
    const json = await response.json();
    return provider === LlmProvider.AzureOpenai
      ? parseAzureOpenaiResponse(json, config.modelId)
      : parseOpenaiCompatibleResponse(json, config.modelId, provider);
  }
}
