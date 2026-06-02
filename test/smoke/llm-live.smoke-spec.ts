// LlmHttpGateway 실 live-endpoint round-trip smoke (T-0171, ADR-0015 Decision §2·§3).
//
// 목적: 기존 두 layer — mocked-fetch unit(src/llm/llm-http-gateway.service.spec.ts,
// transport 건너뜀)과 localhost-stub round-trip smoke(test/smoke/
// llm-gateway-roundtrip.smoke-spec.ts, T-0168 — transport 검증하나 외부 의존 0) —
// 위에, custom(OpenAI-호환) provider 가 *실 외부 endpoint* 로 도달하는 live 경로를
// 검증한다. layer 경계는 ADR-0015 Context 표 참조.
//
// gating: 본 suite 는 ADR-0015 Decision §1 이 박제한 gating env(LLM_LIVE_TEST /
// LLM_LIVE_BASE_URL / LLM_LIVE_API_KEY) 3 종이 *모두* set 된 경우에만 활성화된다.
// 판정은 src/llm/llm-live-test-gating.ts 의 순수 helper resolveLiveTestGating 에
// 위임하고(skip 본문에 분기를 묻지 않음 — R-112 entrypoint-helper 분리), enabled
// 가 false 면 describe.skip 으로 전 suite 가 skip 된다 → public CI 는 gating env
// 부재라 항상 skip → 실 네트워크 호출 0 / secret 0 / 비용 0 으로 green 유지.
//
// 안전·격리(CLAUDE.md §9): 실 credential 값을 본 파일 어디에도 적지 않는다 — env
// 에서만 읽는다(resolveLiveTestGating). repository / cipher / difficultyMappingService
// 3 의존은 live env 기반으로 구성하거나 평문 stub — 실 DB / 실 LLM_APIKEY_ENC_KEY
// 를 끌어오지 않는다(smoke globalSetup 의 DATABASE_URL 요구는 gating skip 판정과
// 무관 — DB 미사용). 새 외부 dependency 0(Node 내장 fetch 만).
import { DifficultyMappingService } from "../../src/llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { LlmProvider } from "../../src/llm/llm-gateway.interface";
import { LlmHttpGateway } from "../../src/llm/llm-http-gateway.service";
import { resolveLiveTestGating } from "../../src/llm/llm-live-test-gating";
import { LlmProviderConfigRepository } from "../../src/llm/llm-provider-config.repository";

// gating 판정 — process.env 를 순수 helper 로 평가. enabled 가 describe 분기 입력.
const gating = resolveLiveTestGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

describeLive("Smoke(live): LlmHttpGateway 실 외부 endpoint round-trip", () => {
  // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(ADR-0015 §4: 명시
  // timeout 코드는 별도 task, 여기서는 jest 차원 상한만). gating skip 시 미발화.
  jest.setTimeout(30000);

  // custom(OpenAI-호환) provider config 를 live base URL 로 가리키는 repository
  // stub + cipher stub(decrypt → live API key 평문). 실 DB / 실 decrypt 미발생 —
  // live env 값을 그대로 평문 경로로 공급한다(§9: 값은 env 출처, 코드 기재 0).
  function makeLiveGateway(): LlmHttpGateway {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: "cfg-live-1",
        provider: LlmProvider.Custom,
        endpointUrl: gating.baseUrl,
        apiKey: "ciphertext-not-used-cipher-is-stubbed",
        modelId: gating.model,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
    } as unknown as LlmProviderConfigRepository;
    // cipher.decrypt 가 live API key 평문을 반환 — 실 LLM_APIKEY_ENC_KEY decrypt 를
    // 우회(본 scaffold 는 transport 검증이 목적). 실값은 env(gating.apiKey)에서만.
    const cipher = {
      decrypt: jest.fn().mockReturnValue(gating.apiKey),
    } as unknown as LlmApiKeyCipher;
    // difficulty routing 미사용 — 호출 시 throw 로 미예상 진입 박제.
    const difficultyMappingService = {
      resolveModel: jest
        .fn()
        .mockRejectedValue(new Error("resolveModel 미예상 호출")),
    } as unknown as DifficultyMappingService;
    // fetchFn 인자 생략 — default globalThis.fetch 가 실 외부 endpoint 로 transport.
    return new LlmHttpGateway(repository, cipher, difficultyMappingService);
  }

  it("happy: 실 외부 endpoint 에 1 회 호출해 비어있지 않은 narrative 가 round-trip 된다", async () => {
    const gateway = makeLiveGateway();

    // modelId = config id(cfg-live-1). difficulty 미지정 → modelId 직접 경로.
    const result = await gateway.generate("한 문장으로 자기소개를 작성하라.", {
      modelId: "cfg-live-1",
    });

    // ADR-0015 Decision §3 invariant — narrative 는 비어있지 않은 string,
    // provider/modelId 일치. 내용 자체는 비결정적이라 assert 하지 않는다.
    expect(typeof result.narrative).toBe("string");
    expect(result.narrative.length).toBeGreaterThan(0);
    expect(result.provider).toBe(LlmProvider.Custom);
    expect(result.modelId).toBe(gating.model);
  });
});
