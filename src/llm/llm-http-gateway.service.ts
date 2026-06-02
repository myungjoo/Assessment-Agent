// LlmHttpGateway — multi-provider orchestration service (T-0156 → T-0158 →
// T-0160 → T-0162, P4 milestone-1 2·4·6·8차 slice, REQ-099~103). config.provider
// 값에 따라 azure_openai adapter(buildAzureOpenaiRequest / parseAzureOpenaiResponse,
// T-0155) / openai-compatible adapter(buildOpenaiCompatibleRequest /
// parseOpenaiCompatibleResponse, T-0157) / anthropic adapter
// (buildAnthropicRequest / parseAnthropicResponse, T-0159) / google_gemini adapter
// (buildGeminiRequest / parseGeminiResponse, T-0161)를 선택 dispatch 해
// `LlmGateway` 계약을 구현한다. 흐름: config 조회 → apiKey decrypt → provider 분기
// dispatch(요청 조립) → (주입된) fetch → HTTP 상태 검사 → provider 분기 dispatch
// (응답 파싱).
//
// 책임 경계:
//   - 본 slice(T-0162)로 milestone-1 의 5 provider(azure_openai / custom / openai /
//     anthropic / google_gemini)가 전부 unit 수준에서 동작한다 — adapter wiring 종결.
//     알 수 없는(unknown) provider 값만 adapter 순수 함수 부재로 "미지원" throw.
//   - apiVersion 영속 컬럼은 아직 없다(LlmProviderConfig 4 필드 = provider/
//     endpointUrl/apiKey/modelId). azure 경로만 상수 default
//     (AZURE_OPENAI_DEFAULT_API_VERSION)로 공급하고(openai-compatible 는 api-version
//     불요), 영속 컬럼화는 schema migration(§5 게이트) → Follow-up #3.
//   - fetch 는 직접 호출하지 않고 FetchLike 함수로 주입받는다(default globalThis.fetch).
//     실 네트워크 호출 0 — unit 은 주입한 mock 으로 검증. cipher 도 DI 주입이라 unit
//     에서 mock — 실 LLM_APIKEY_ENC_KEY / 실 decrypt 미발생.
//   - 실 네트워크/실 credential 통합(env 주입 + smoke/e2e)은 Follow-up #4.
import { Injectable, Optional } from "@nestjs/common";

import { DifficultyMappingService } from "./difficulty-mapping.service";
import { LlmApiKeyCipher } from "./llm-apikey-cipher.service";
import {
  LlmGateway,
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "./llm-gateway.interface";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";
import {
  buildAnthropicRequest,
  parseAnthropicResponse,
} from "./providers/anthropic.adapter";
import {
  buildAzureOpenaiRequest,
  parseAzureOpenaiResponse,
} from "./providers/azure-openai.adapter";
import {
  buildGeminiRequest,
  parseGeminiResponse,
} from "./providers/google-gemini.adapter";
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
  // 로 skip 시켜야 module compile 이 성공한다). cipher / repository /
  // difficultyMappingService 는 LlmModule 에 이미 등록된 provider 를 DI 로 주입.
  // unit 은 모두 mock 으로 대체한다.
  //
  // difficultyMappingService 는 난이도 기반 config routing(REQ-097, ADR-0011 §3)의
  // resolve hop — options.difficulty 가 주어지면 resolveModel 로 configId 를 얻어
  // 그 id 로 config 를 조회한다(T-0165). difficulty 미제공 시에는 호출되지 않아
  // 종전 modelId 직접 경로가 그대로 유지된다.
  constructor(
    private readonly repository: LlmProviderConfigRepository,
    private readonly cipher: LlmApiKeyCipher,
    private readonly difficultyMappingService: DifficultyMappingService,
    @Optional()
    private readonly fetchFn: FetchLike = globalThis.fetch as unknown as FetchLike,
  ) {}

  // generate — config 식별자로 저장된 raw config 를 조회해 provider 별 LLM 호출을
  // orchestrate 한다. config id 는 options.difficulty 유무에 따라 결정된다 —
  // difficulty 제공 시 resolveModel 이 그 난이도 슬롯의 configId 를, 미제공 시
  // options.modelId 를 직접 사용(T-0165 difficulty routing). service.findById 가
  // 아니라 repository 의 raw row 를 직접 조회한다 — apiKey ciphertext 가 필요하므로
  // (service view 는 redact). build/parse 두 dispatch 지점은 동일 config.provider
  // 기준으로 일관되게 분기한다.
  async generate(
    prompt: string,
    options: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    // (1) config id 결정 — difficulty 기반 routing 분기(REQ-097, ADR-0011 §3).
    // options.difficulty 가 주어지면 DifficultyMappingService.resolveModel 로 그
    // 난이도 슬롯이 가리키는 config id 를 얻어 routing 한다(난이도 → configId).
    // resolveModel 은 허용 밖 난이도 / 슬롯 미설정 / FK null / 가리킨 config 부재 시
    // 4xx throw 하며, 본 gateway 는 그 error 를 swallow 하지 않고 그대로 전파한다.
    // difficulty 미제공(undefined)이면 종전대로 options.modelId 를 config id 로
    // 직접 사용해 회귀를 보호한다. 빈 문자열 difficulty 는 resolveModel 의
    // isDifficulty 검증에 위임(허용 밖 → BadRequestException 전파).
    const configId =
      options.difficulty === undefined
        ? options.modelId
        : (await this.difficultyMappingService.resolveModel(options.difficulty))
            .configId;

    // (2) config 조회 — 부재 시 명확한 error throw(두 경로 공통).
    const config = await this.repository.findById(configId);
    if (config === null) {
      throw new Error(
        `LLM provider config 를 찾을 수 없습니다 (id: ${configId})`,
      );
    }

    // (3) provider 검사 — 본 slice(T-0162)로 milestone-1 의 5 provider(azure_openai /
    // custom / openai / anthropic / google_gemini)가 전부 adapter 순수 함수에 연결된다.
    // 그 외 알 수 없는(unknown) 값만 adapter 가 없어 미지원 throw(provider 값 포함).
    const provider = config.provider as LlmProvider;
    if (
      provider !== LlmProvider.AzureOpenai &&
      provider !== LlmProvider.Custom &&
      provider !== LlmProvider.Openai &&
      provider !== LlmProvider.Anthropic &&
      provider !== LlmProvider.GoogleGemini
    ) {
      throw new Error(
        `미지원 provider 입니다 — 지원 provider 는 azure_openai / custom / openai / anthropic / google_gemini 입니다 (provider: ${config.provider})`,
      );
    }

    // (4) apiKey 평문화 — cipher.decrypt 가 변조/잘못된 키 시 throw(swallow 금지).
    const apiKey = this.cipher.decrypt(config.apiKey);

    // (5) build dispatch — provider 에 따라 요청 조립. azure 만 apiVersion 상수
    // default 공급(Follow-up 영속 컬럼화 전까지), openai-compatible 은 api-version
    // 불요(custom / openai 는 동일 wire 포맷 — OpenAI Chat Completions 호환 공유),
    // anthropic 은 별도 wire 포맷(/v1/messages · x-api-key · anthropic-version ·
    // max_tokens · system top-level)이라 anthropic adapter 로 분기(apiVersion 불요).
    // google_gemini 도 별도 wire 포맷(URL path 에 model · x-goog-api-key ·
    // contents[].parts[].text · systemInstruction)이라 gemini adapter 로 분기
    // (anthropic 동형 — apiVersion 불요, adapter 가 provider 하드코딩). azure /
    // openai-compatible / anthropic / gemini 4-way 라 가독성 위해 if/else 로 정리.
    let request: { url: string; headers: Record<string, string>; body: string };
    if (provider === LlmProvider.AzureOpenai) {
      request = buildAzureOpenaiRequest({
        endpointUrl: config.endpointUrl,
        modelId: config.modelId,
        apiVersion: AZURE_OPENAI_DEFAULT_API_VERSION,
        apiKey,
        prompt,
        options,
      });
    } else if (provider === LlmProvider.Anthropic) {
      request = buildAnthropicRequest({
        endpointUrl: config.endpointUrl,
        modelId: config.modelId,
        apiKey,
        prompt,
        options,
      });
    } else if (provider === LlmProvider.GoogleGemini) {
      request = buildGeminiRequest({
        endpointUrl: config.endpointUrl,
        modelId: config.modelId,
        apiKey,
        prompt,
        options,
      });
    } else {
      request = buildOpenaiCompatibleRequest({
        endpointUrl: config.endpointUrl,
        modelId: config.modelId,
        apiKey,
        prompt,
        options,
      });
    }

    // (6) 주입된 fetch 로 HTTP 호출(POST). 실 네트워크는 unit 에서 mock 으로 대체.
    const response = await this.fetchFn(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body,
    });

    // (7) HTTP non-2xx 분기 — provider / status 를 포함한 명확한 error throw.
    if (!response.ok) {
      throw new Error(
        `${provider} HTTP 호출 실패 (status: ${response.status})`,
      );
    }

    // (8) parse dispatch — build 와 동일 provider 기준으로 응답 JSON 을
    // LlmGenerateResult 로 변환(비정상 응답은 parse 가 throw). openai-compatible 은
    // provider 인자를 넘겨 result.provider 에 정확히 custom/openai 가 채워지도록 한다
    // (custom/openai 가 동일 wire 포맷을 공유하므로 호출처가 실제 provider 를 전달).
    // azure / anthropic / gemini adapter 는 각자 provider 를 하드코딩하므로 인자 불요.
    const json = await response.json();
    if (provider === LlmProvider.AzureOpenai) {
      return parseAzureOpenaiResponse(json, config.modelId);
    }
    if (provider === LlmProvider.Anthropic) {
      return parseAnthropicResponse(json, config.modelId);
    }
    if (provider === LlmProvider.GoogleGemini) {
      return parseGeminiResponse(json, config.modelId);
    }
    return parseOpenaiCompatibleResponse(json, config.modelId, provider);
  }
}
