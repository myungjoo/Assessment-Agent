// LlmHttpGateway azure_openai 실 live-endpoint round-trip smoke (T-0228,
// ADR-0025 Decision §2·§3·§5·§6). custom live smoke
// (test/smoke/llm-live.smoke-spec.ts, T-0171/ADR-0015) 의 mirror 이되 azure wire
// shape 로 교체한다 — azure 는 model 이 body 가 아니라 URL deployment 로 라우팅되고
// POST {base}/openai/deployments/<deployment>/chat/completions?api-version=<ver>
// + api-key 헤더 wire 를 탄다(src/llm/providers/azure-openai.adapter.ts).
//
// gating: 본 suite 는 ADR-0025 Decision §1 이 박제한 azure gating env 5 종
// (LLM_LIVE_TEST / LLM_LIVE_BASE_URL / LLM_LIVE_API_KEY / LLM_LIVE_API_VERSION /
// LLM_LIVE_MODEL) + LLM_LIVE_PROVIDER=azure_openai 가 *모두* set 된 경우에만
// 활성화된다. 판정은 src/llm/llm-live-test-gating.ts 의 순수 helper
// resolveLiveTestGating(azure 분기, T-0227) 에 위임하고, enabled 가 false 면
// describe.skip 으로 전 suite 가 skip 된다 → public CI 는 gating env 부재라 항상
// skip → 실 네트워크 호출 0 / secret 0 / 비용 0 으로 green 유지(R-113). 실 네트워크
// 1 회 호출은 본 task 가 아니라 후속 (2b) credentialed live run(§5 게이트) 책임.
//
// provider 라벨 매핑(reviewer 핸드오프 — 절대 혼동 금지, ADR-0025 §5): gating 의
// LiveProvider 내부 라벨은 "azure" 이며 이는 wire enum
// LlmProvider.AzureOpenai = "azure_openai" 와 *다른 값*이다. repository stub 의
// provider 필드에는 반드시 LlmProvider.AzureOpenai 를 넣는다 — gating.provider
// (="azure") 문자열을 그대로 흘려보내지 않는다(gateway 의 provider 분기는
// config.provider === LlmProvider.AzureOpenai 매칭이라 "azure" 를 넘기면 "미지원
// provider" throw 가 발생한다).
//
// 안전·격리(CLAUDE.md §9): 실 credential 값(base URL·API key)을 본 파일 어디에도
// 적지 않는다 — env 에서만 읽는다(resolveLiveTestGating). repository / cipher /
// difficultyMappingService 3 의존은 live env 기반으로 구성하거나 평문 stub — 실 DB /
// 실 LLM_APIKEY_ENC_KEY 를 끌어오지 않는다. 새 외부 dependency 0(Node 내장 fetch 만).
//
// 주의(api-version): gateway 는 apiVersion 을 config/env 가 아니라 상수
// AZURE_OPENAI_DEFAULT_API_VERSION = "2024-02-15-preview" 로 공급한다(영속 컬럼
// 미존재 — Follow-up). 즉 gating.apiVersion(env) 은 gating *완전성* 판정용이고 실제
// wire 의 api-version 은 이 상수다. 본 spec 은 이 사실을 인지하고 narrative/provider
// invariant 만 assert 한다(api-version 값 자체는 assert 하지 않음).
import { DifficultyMappingService } from "../../src/llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { LlmProvider } from "../../src/llm/llm-gateway.interface";
import { LlmHttpGateway } from "../../src/llm/llm-http-gateway.service";
import { resolveLiveTestGating } from "../../src/llm/llm-live-test-gating";
import { LlmProviderConfigRepository } from "../../src/llm/llm-provider-config.repository";

// gating 판정 — process.env 를 순수 helper 로 평가. azure 분기(LLM_LIVE_PROVIDER=
// azure_openai)에서 5 종 완전성을 본다. enabled 가 describe 분기 입력.
const gating = resolveLiveTestGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

describeLive(
  "Smoke(live): LlmHttpGateway azure_openai 실 외부 endpoint round-trip",
  () => {
    // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(ADR-0025 §4: 명시
    // timeout 코드는 별도 task, 여기서는 jest 차원 상한만). gating skip 시 미발화.
    jest.setTimeout(30000);

    // azure_openai provider config 를 live azure resource base host 로 가리키는
    // repository stub + cipher stub(decrypt → live API key 평문). 실 DB / 실 decrypt
    // 미발생 — live env 값을 그대로 평문 경로로 공급한다(§9: 값은 env 출처, 코드 기재 0).
    function makeLiveGateway(): LlmHttpGateway {
      const repository = {
        findById: jest.fn().mockResolvedValue({
          id: "cfg-live-azure-1",
          // provider 는 반드시 wire enum LlmProvider.AzureOpenai(="azure_openai") —
          // gating.provider(="azure" 내부 라벨)를 그대로 넘기지 않는다(ADR-0025 §5).
          provider: LlmProvider.AzureOpenai,
          // endpointUrl = azure resource base host(예: https://<res>.openai.azure.com).
          // gateway 가 azure adapter 로 /openai/deployments/<deployment>/chat/completions
          // 경로를 조립할 base 다.
          endpointUrl: gating.baseUrl,
          apiKey: "ciphertext-not-used-cipher-is-stubbed",
          // modelId = deployment 이름(Q-0021 = gpt-5.4). azure 는 model 이 URL deployment
          // segment 로 라우팅되므로 이 값이 wire URL 의 <deployment> 가 된다.
          modelId: gating.model,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      } as unknown as LlmProviderConfigRepository;
      // cipher.decrypt 가 live API key 평문을 반환 — 실 LLM_APIKEY_ENC_KEY decrypt 를
      // 우회(본 scaffold 는 transport 검증이 목적, ADR-0025 §6). 실값은 env(gating.apiKey)에서만.
      const cipher = {
        decrypt: jest.fn().mockReturnValue(gating.apiKey),
      } as unknown as LlmApiKeyCipher;
      // difficulty routing 미사용 — 호출 시 throw 로 미예상 진입 박제.
      const difficultyMappingService = {
        resolveModel: jest
          .fn()
          .mockRejectedValue(new Error("resolveModel 미예상 호출")),
      } as unknown as DifficultyMappingService;
      // fetchFn 인자 생략 — default globalThis.fetch 가 실 외부 azure endpoint 로 transport.
      return new LlmHttpGateway(repository, cipher, difficultyMappingService);
    }

    it("happy: 실 azure_openai endpoint 에 1 회 호출해 비어있지 않은 narrative 가 round-trip 된다", async () => {
      const gateway = makeLiveGateway();

      // modelId = config id(cfg-live-azure-1). difficulty 미지정 → modelId 직접 경로.
      const result = await gateway.generate(
        "한 문장으로 자기소개를 작성하라.",
        {
          modelId: "cfg-live-azure-1",
        },
      );

      // ADR-0025 Decision §2 invariant — narrative 는 비어있지 않은 string,
      // provider 는 wire enum AzureOpenai, modelId 는 deployment(gating.model) 일치.
      // 내용 자체는 비결정적이라 assert 하지 않는다(custom spec 동형). api-version 값은
      // gateway 상수 default 로 공급되므로 assert 하지 않는다.
      expect(typeof result.narrative).toBe("string");
      expect(result.narrative.length).toBeGreaterThan(0);
      expect(result.provider).toBe(LlmProvider.AzureOpenai);
      expect(result.modelId).toBe(gating.model);
    });
  },
);
