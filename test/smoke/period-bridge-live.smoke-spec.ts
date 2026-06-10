// period-bridge live-LLM 검증 smoke (T-0339, ADR-0037 §Decision5 deferred 의
// env-gated 해소 — slice 1/2 spec 인프라). 머지된 mocked-only bridge 의 평가 경로
// (PeriodBridgeEphemeralService.generateEphemeral → EvaluationOrchestratorService
// .evaluateActivities → EvaluationScoringService.scoreUnit → LlmHttpGateway
// .generate → narrative)를 **실 네트워크 LLM 1 회 round-trip** 으로 검증한다.
// test/smoke/llm-live-azure.smoke-spec.ts(T-0228, ADR-0025) 의 gating /
// makeLiveGateway() 패턴을 bridge compose 수준으로 확장한 mirror 다.
//
// gating: ADR-0025 Decision §1 의 azure gating env 5 종(LLM_LIVE_TEST /
// LLM_LIVE_BASE_URL / LLM_LIVE_API_KEY / LLM_LIVE_API_VERSION / LLM_LIVE_MODEL)
// + LLM_LIVE_PROVIDER=azure_openai 가 *모두* set 된 경우에만 활성화된다. 판정은
// src/llm/llm-live-test-gating.ts 의 순수 helper resolveLiveTestGating(azure
// 분기, T-0227 — 변경 0 소비만)에 위임하고, enabled 가 false 면 describe.skip 으로
// 전 suite 가 skip 된다 → public CI 는 gating env 부재라 항상 skip → 실 네트워크
// 호출 0 / secret 0 / 비용 0 으로 green 유지(R-113). 실 credential 주입 + 실행 1 회
// + 결과 박제는 본 task 가 아니라 후속 slice 2/2(credentialed live run, T-0230
// 선례 mirror) 책임이다.
//
// compose 구조(실 LLM leg + stub collection leg):
//   - 실 LlmHttpGateway(makeLiveGateway — repository/cipher/difficulty stub) →
//     실 EvaluationScoringService(gateway) → 실 EvaluationOrchestratorService
//     (scoring) → PeriodBridgeEphemeralService(specStub, collectionStub, 실
//     evaluation). 평가 leg 전체가 실 객체라 prompt 조립 → 실 generate →
//     classifyNarrative → volume 산출의 bridge 경로가 그대로 발화한다.
//   - collection leg 는 stub: 실 GitHub/Confluence credential 은 본 task 밖
//     (Q-0024/0025 별도 게이트). collectActivities 가 synthetic Activity **정확히
//     1 건** 을 반환해 실 LLM round-trip 을 1 회로 bound 한다(T-0245 bounded-
//     single-request 선례 — orchestrator 는 deduped input 당 scoreUnit 1 회,
//     scoreUnit 은 generate 정확히 1 회이므로 입력 1 건 = 실 호출 1 회).
//
// provider 라벨 매핑(reviewer 핸드오프 — 절대 혼동 금지, T-0228 mirror): gating 의
// LiveProvider 내부 라벨은 "azure" 이며 이는 wire enum
// LlmProvider.AzureOpenai = "azure_openai" 와 *다른 값*이다. repository stub 의
// provider 필드에는 반드시 LlmProvider.AzureOpenai 를 넣는다 — gating.provider
// (="azure") 문자열을 그대로 흘려보내면 gateway 의 provider 분기(config.provider
// === LlmProvider.AzureOpenai 매칭)가 "미지원 provider" throw 를 일으킨다.
//
// 안전·격리(CLAUDE.md §9): 실 credential 값(base URL·API key)을 본 파일 어디에도
// 적지 않는다 — env(resolveLiveTestGating 의 gating)에서만 읽는다. persist symbol
// 주입 0 — bridge 의 구조적 write-0(ADR-0037 §Decision1) 그대로: 본 spec 이
// 주입하는 것은 collection/spec stub 2 종 + 실 evaluation orchestrator 뿐이고
// persist service / PrismaService 참조가 0 이다. 새 외부 dependency 0(Node 내장
// fetch 만 — gateway default transport).
import {
  CollectionOrchestratorService,
  type CollectionSpec,
} from "../../src/assessment-collection/collection-orchestrator.service";
import { CollectionSpecService } from "../../src/assessment-collection/collection-spec.service";
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { isContributionLevel } from "../../src/assessment-evaluation/domain/evaluation-result";
import { EvaluationOrchestratorService } from "../../src/assessment-evaluation/evaluation-orchestrator.service";
import { EvaluationScoringService } from "../../src/assessment-evaluation/evaluation-scoring.service";
import {
  PeriodBridgeEphemeralService,
  type PeriodBridgePersonInput,
} from "../../src/assessment-evaluation/period-bridge-ephemeral.service";
import { isDifficulty } from "../../src/llm/difficulty";
import { DifficultyMappingService } from "../../src/llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { LlmProvider } from "../../src/llm/llm-gateway.interface";
import { LlmHttpGateway } from "../../src/llm/llm-http-gateway.service";
import { resolveLiveTestGating } from "../../src/llm/llm-live-test-gating";
import { LlmProviderConfigRepository } from "../../src/llm/llm-provider-config.repository";

// gating 판정 — process.env 를 순수 helper 로 평가(azure 분기 5 종 완전성).
// enabled 가 describe 분기 입력. skip 시에도 reason 으로 어느 env 가 부재했는지 보고.
const gating = resolveLiveTestGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

describeLive(
  "Smoke(live): PeriodBridgeEphemeralService 실 LLM 평가 leg round-trip",
  () => {
    // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(T-0228 동형).
    // gating skip 시 미발화.
    jest.setTimeout(30000);

    // synthetic Activity fixture 가 매칭할 person identity 값들 — 실값 아님(§9),
    // period-bridge-ephemeral.service.spec.ts 의 fixture 형태 mirror. activity 의
    // (instanceKey, author) 가 identity 의 (service, externalId) 와 일치해야
    // filterActivitiesByAuthor 를 통과한다(ADR-0030 §2 귀속 규칙).
    const INSTANCE_KEY = "com";
    const AUTHOR_EXTERNAL_ID = "octocat";

    // 임의 CollectionSpec fixture — bridge 는 spec 을 collectActivities 로
    // pass-through 만 하므로 내부 구조 무관(빈 enumerate 로 충분, unit spec mirror).
    const SPEC: CollectionSpec = {
      github: { sources: [] },
      confluence: { instances: [] },
    };

    // synthetic GithubActivity 정확히 1 건 — author/instanceKey 가 person 의
    // serviceIdentities 와 매칭되어 귀속 필터를 통과하고, 평가 입력 1 건 = 실 LLM
    // 호출 1 회로 bound 된다(T-0245 선례). metadata 는 volume 산출용 typed scalar 만.
    function syntheticActivity(): GithubActivity {
      return {
        sourceType: "github",
        externalId: "live-bridge-c1",
        instanceKey: INSTANCE_KEY,
        author: AUTHOR_EXTERNAL_ID,
        timestamp: "2026-06-01T12:00:00Z",
        metadata: { titleLength: 42 },
        repoRef: "octo-org/octo-repo",
        kind: "commit",
      };
    }

    // person 입력 — serviceIdentity (service=com, externalId=octocat) 가 위
    // synthetic activity 에 귀속된다. resolved person 계약(slice 3/4 밖) mirror.
    function personMatching(): PeriodBridgePersonInput {
      return {
        serviceIdentities: [
          { service: INSTANCE_KEY, externalId: AUTHOR_EXTERNAL_ID },
        ],
      };
    }

    // 실 LlmHttpGateway 구성 — llm-live-azure.smoke-spec.ts 의 makeLiveGateway()
    // mirror. azure_openai provider config 를 live azure resource base host 로
    // 가리키는 repository stub + cipher stub(decrypt → live API key 평문). 실 DB /
    // 실 decrypt 미발생 — live env 값을 그대로 평문 경로로 공급(§9: 값은 env 출처,
    // 코드 기재 0).
    function makeLiveGateway(): LlmHttpGateway {
      const repository = {
        findById: jest.fn().mockResolvedValue({
          id: "cfg-live-azure-1",
          // provider 는 반드시 wire enum LlmProvider.AzureOpenai(="azure_openai")
          // — gating.provider(="azure" 내부 라벨)를 그대로 넘기지 않는다(파일 머리
          // 주석의 provider 라벨 매핑 참조).
          provider: LlmProvider.AzureOpenai,
          // endpointUrl = azure resource base host. gateway 가 azure adapter 로
          // /openai/deployments/<deployment>/chat/completions 경로를 조립할 base.
          endpointUrl: gating.baseUrl,
          apiKey: "ciphertext-not-used-cipher-is-stubbed",
          // modelId = deployment 이름 — azure 는 model 이 URL deployment segment
          // 로 라우팅되므로 이 값이 wire URL 의 <deployment> 가 된다.
          modelId: gating.model,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      } as unknown as LlmProviderConfigRepository;
      // cipher.decrypt 가 live API key 평문을 반환 — 실 LLM_APIKEY_ENC_KEY decrypt
      // 우회(transport 검증 목적). 실값은 env(gating.apiKey)에서만.
      const cipher = {
        decrypt: jest.fn().mockReturnValue(gating.apiKey),
      } as unknown as LlmApiKeyCipher;
      // difficulty routing 미사용 — 호출 시 reject 로 미예상 진입 박제(scoring 은
      // difficulty 미주입 → modelId 직접 경로만 탄다).
      const difficultyMappingService = {
        resolveModel: jest
          .fn()
          .mockRejectedValue(new Error("resolveModel 미예상 호출")),
      } as unknown as DifficultyMappingService;
      // fetchFn 인자 생략 — default globalThis.fetch 가 실 외부 azure endpoint 로
      // transport(새 dependency 0).
      return new LlmHttpGateway(repository, cipher, difficultyMappingService);
    }

    // bridge compose — 실 LLM leg(gateway → scoring → evaluation orchestrator) +
    // stub collection leg(spec/collect). stub 2 종을 함께 반환해 호출 횟수
    // (실 LLM 1 회 bound 의 전제) 를 assert 할 수 있게 한다.
    function makeBridge(): {
      bridge: PeriodBridgeEphemeralService;
      specStub: { buildCollectionSpec: jest.Mock };
      collectionStub: { collectActivities: jest.Mock };
    } {
      const scoring = new EvaluationScoringService(makeLiveGateway());
      const evaluation = new EvaluationOrchestratorService(scoring);
      // collection leg stub — 실 GitHub/Confluence 호출 0(Q-0024/0025 밖).
      // collectActivities 는 synthetic Activity 정확히 1 건 반환(1 회 bound).
      const specStub = {
        buildCollectionSpec: jest.fn().mockResolvedValue(SPEC),
      };
      const collectionStub = {
        collectActivities: jest.fn().mockResolvedValue([syntheticActivity()]),
      };
      const bridge = new PeriodBridgeEphemeralService(
        specStub as unknown as CollectionSpecService,
        collectionStub as unknown as CollectionOrchestratorService,
        evaluation,
      );
      return { bridge, specStub, collectionStub };
    }

    it("happy: generateEphemeral 1 회 호출이 실 LLM 1 회 round-trip 으로 비어있지 않은 narrative 평가 결과 1 건을 반환한다", async () => {
      const { bridge, specStub, collectionStub } = makeBridge();

      // options.modelId = repository stub 의 config id — scoring 의 difficulty
      // 미주입 정책과 합쳐져 gateway 의 modelId 직접 경로(config 조회)를 탄다.
      const results = await bridge.generateEphemeral(
        personMatching(),
        { since: "2026-06-01T00:00:00Z" },
        { modelId: "cfg-live-azure-1" },
      );

      // 평가 입력 1 건 → EvaluationResult 정확히 1 건(실 LLM 호출 1 회 bound).
      expect(results).toHaveLength(1);
      const [result] = results;

      // narrative 는 비어있지 않은 string — 내용 의미는 비결정적이라 assert 하지
      // 않는다(ADR-0025 §2 동형). 평가문 품질·scoring·narrative 경로 확인 지점.
      expect(typeof result.narrative).toBe("string");
      expect(result.narrative.length).toBeGreaterThan(0);

      // scoring 파생 필드 — EvaluationResult typed surface 존재 + 허용 집합 멤버십.
      // unitId 는 `<sourceType>:<instanceKey>:<externalId>` 합성(입력 ↔ 결과 trace).
      expect(result.unitId).toBe("github:com:live-bridge-c1");
      expect(isDifficulty(result.difficulty)).toBe(true);
      expect(isContributionLevel(result.contribution)).toBe(true);
      expect(typeof result.volume).toBe("number");
      expect(result.volume).toBeGreaterThanOrEqual(0);

      // collection leg stub 가 각 1 회만 호출 — bridge 4 단계 compose 정합 +
      // 추가 수집/평가 루프 없음(실 LLM round-trip 1 회 bound 의 구조 확인).
      expect(specStub.buildCollectionSpec).toHaveBeenCalledTimes(1);
      expect(collectionStub.collectActivities).toHaveBeenCalledTimes(1);
    });

    it("격리: bridge 생성자 arity 3 — persist symbol 주입 0(구조적 write-0 보존)", () => {
      // 본 spec 의 compose 가 주입하는 것은 spec/collection stub + evaluation 뿐
      // — persist service / PrismaService 참조 0. 생성자 arity 박제로 회귀 가드
      // (unit spec 의 구조적 write-0 단언 mirror, ADR-0037 §Decision1).
      expect(PeriodBridgeEphemeralService.length).toBe(3);
    });
  },
);
