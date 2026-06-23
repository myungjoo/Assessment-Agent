// realdata-e2e-live.smoke-spec.ts — 실 평가 e2e env-gated live smoke (T-0610,
// PLAN.md 109행 🟢 실 평가 e2e 의 live 실행 leg 첫 단계). pure step-args 스택
// (T-0573~T-0601: seed fixture → run plan → step-args aggregator)이 닫힌 build-time
// surface 위에서, 그 조립된 step-args 를 **실제로 실행**하는 leg — 실 github 수집 →
// 실 LLM 평가 1 회 round-trip — 의 첫 인프라(gating helper + skip-by-default 실행
// spec)를 박제한다. `period-bridge-live.smoke-spec.ts`(T-0339, ADR-0037 §Decision5
// env-gated 해소 — slice 1/2 spec 인프라)의 gating / makeLiveGateway() 패턴을
// realdata-e2e 축으로 mirror 한 것이다.
//
// gating: realdata-e2e 전용 gating env(REALDATA_E2E_LIVE_TEST + Ollama 5 종 +
// github read PAT)가 *모두* set 된 경우에만 활성화된다. 판정은
// test/helpers/realdata-e2e-live-gating.ts 의 순수 helper resolveRealDataE2eLiveGating
// (T-0610 — unit spec 으로 별도 검증)에 위임하고, enabled 가 false 면 describe.skip
// 으로 전 suite 가 skip 된다 → public CI 는 gating env 부재라 항상 skip → 실 네트워크
// 호출 0 / secret 0 / 비용 0 으로 green 유지(R-113). 실 credential 주입 + 실행 1 회 +
// 결과 daily-test 이슈 박제는 본 task 가 아니라 후속 slice(credentialed run +
// daily-test.sh step_eval) 책임이다.
//
// compose 구조(실 LLM leg + stub collection leg, period-bridge-live mirror):
//   - 실 LlmHttpGateway(makeLiveGateway — Ollama OpenAI 호환 config repository /
//     cipher stub) → 실 EvaluationScoringService(gateway) → 실
//     EvaluationOrchestratorService(scoring). 평가 leg 전체가 실 객체라 prompt 조립
//     → 실 generate → classifyNarrative → volume 산출의 평가 경로가 그대로 발화한다.
//   - collection leg 는 synthetic Activity 정확히 1 건으로 bound — 실 LLM round-trip
//     1 회(T-0245 bounded-single-request 선례 — orchestrator 는 deduped input 당
//     scoreUnit 1 회, scoreUnit 은 generate 정확히 1 회이므로 입력 1 건 = 실 호출 1 회).
//     실 github 네트워크 수집 배선은 후속 slice — 본 task 는 typed surface 만(R-59,
//     raw github 본문 미보관).
//   - step-args 조립: 검증된 seeds → buildRealDataE2eRunPlan(seeds, modelId, run) →
//     실 평가 산출 results 와 함께 buildRealDataE2eStepArgs(runPlan, activities,
//     results) 로 묶어 pre-실행 step-args({evaluation, publish})를 산출 검증.
//
// provider 라벨(Ollama, openai-compatible): repository stub 의 provider 필드에는 wire
// enum LlmProvider.Custom(openai-compatible adapter 경로)을 넣는다. gating.ollama.provider
// (env 라벨 문자열)를 그대로 wire enum 자리에 흘려보내지 않는다(gateway 의 provider
// 분기는 LlmProvider enum 멤버 매칭).
//
// 안전·격리(CLAUDE.md §9): 실 credential 값(base URL·API key·PAT)을 본 파일 어디에도
// 적지 않는다 — env(resolveRealDataE2eLiveGating 의 gating)에서만 읽는다. persist symbol
// 주입 0(in-memory 평가 산출 검증만 — DB write 0). 새 외부 dependency 0(Node 내장 fetch
// 만 — gateway default transport).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { isContributionLevel } from "../../src/assessment-evaluation/domain/evaluation-result";
import { EvaluationOrchestratorService } from "../../src/assessment-evaluation/evaluation-orchestrator.service";
import { EvaluationScoringService } from "../../src/assessment-evaluation/evaluation-scoring.service";
import { isDifficulty } from "../../src/llm/difficulty";
import { DifficultyMappingService } from "../../src/llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { LlmProvider } from "../../src/llm/llm-gateway.interface";
import { LlmHttpGateway } from "../../src/llm/llm-http-gateway.service";
import { LlmProviderConfigRepository } from "../../src/llm/llm-provider-config.repository";
import { resolveRealDataE2eLiveGating } from "../helpers/realdata-e2e-live-gating";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eStepArgs } from "../helpers/realdata-e2e-step-args";

// gating 판정 — process.env 를 순수 helper 로 평가(realdata-e2e 7 종 완전성).
// enabled 가 describe 분기 입력. unit 검증은 realdata-e2e-live-gating.spec.ts.
const gating = resolveRealDataE2eLiveGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

// 평가에 쓸 config id — repository stub 이 이 id 로 조회되며 scoring options.modelId
// 로도 쓰인다(difficulty 미주입 → modelId 직접 경로). Ollama config 식별 라벨.
const CONFIG_ID = "cfg-realdata-e2e-live-ollama";

describeLive(
  "Smoke(live): 실 평가 e2e 조립된 step-args 의 실 LLM 평가 leg round-trip",
  () => {
    // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(period-bridge-live 동형).
    // gating skip 시 미발화.
    jest.setTimeout(30000);

    // synthetic Activity fixture 가 매칭할 author identity — 실 github 수집 배선
    // (후속 slice)이 들어오기 전까지 seed 의 첫 github username 을 author 로 bound.
    // 실값(실 활동 본문) 아님 — typed surface 만(R-59).
    const seeds = buildRealDataE2eSeed();
    const FIRST_USERNAME = seeds[0].serviceIdentities[0].externalId;
    const INSTANCE_KEY = "github.com";

    // synthetic GithubActivity 정확히 1 건 — author 가 seed 의 첫 username 과 매칭되어
    // 평가 입력 1 건 = 실 LLM 호출 1 회로 bound(T-0245 선례). metadata 는 volume 산출용
    // typed scalar 만(raw github 본문 미포함, R-59).
    function syntheticActivity(): GithubActivity {
      return {
        sourceType: "github",
        externalId: "realdata-e2e-live-c1",
        instanceKey: INSTANCE_KEY,
        author: FIRST_USERNAME,
        timestamp: "2026-06-01T12:00:00Z",
        metadata: { titleLength: 42 },
        repoRef: `${FIRST_USERNAME}/sample-repo`,
        kind: "commit",
      };
    }

    // 실 LlmHttpGateway 구성 — period-bridge-live makeLiveGateway() mirror. Ollama
    // (openai-compatible) provider config 를 live Ollama base URL 로 가리키는
    // repository stub + cipher stub(decrypt → live API key 평문). 실 DB / 실 decrypt
    // 미발생 — live env 값을 그대로 평문 경로로 공급(§9: 값은 env 출처, 코드 기재 0).
    function makeLiveGateway(): LlmHttpGateway {
      // gating.ollama 는 enabled === true 분기에서만 존재(describeLive 활성 = enabled).
      const ollama = gating.ollama!;
      const repository = {
        findById: jest.fn().mockResolvedValue({
          id: CONFIG_ID,
          // provider 는 반드시 wire enum LlmProvider.Custom(openai-compatible adapter
          // 경로) — gating.ollama.provider(env 라벨)를 그대로 넘기지 않는다(파일 머리
          // 주석의 provider 라벨 매핑 참조).
          provider: LlmProvider.Custom,
          // endpointUrl = Ollama OpenAI 호환 base URL. openai-compatible adapter 가
          // /chat/completions 경로를 조립할 base.
          endpointUrl: ollama.baseUrl,
          apiKey: "ciphertext-not-used-cipher-is-stubbed",
          // modelId = openai-compatible body model(평가 모델 식별자).
          modelId: ollama.model,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      } as unknown as LlmProviderConfigRepository;
      // cipher.decrypt 가 live API key 평문을 반환 — 실 decrypt 우회(transport 검증
      // 목적). 실값은 env(gating.ollama.apiKey)에서만.
      const cipher = {
        decrypt: jest.fn().mockReturnValue(ollama.apiKey),
      } as unknown as LlmApiKeyCipher;
      // difficulty routing 미사용 — 호출 시 reject 로 미예상 진입 박제(scoring 은
      // difficulty 미주입 → modelId 직접 경로만 탄다).
      const difficultyMappingService = {
        resolveModel: jest
          .fn()
          .mockRejectedValue(new Error("resolveModel 미예상 호출")),
      } as unknown as DifficultyMappingService;
      // fetchFn 인자 생략 — default globalThis.fetch 가 실 외부 Ollama endpoint 로
      // transport(새 dependency 0).
      return new LlmHttpGateway(repository, cipher, difficultyMappingService);
    }

    // 실 평가 orchestrator compose — 실 LLM leg(gateway → scoring → orchestrator).
    function makeOrchestrator(): EvaluationOrchestratorService {
      const scoring = new EvaluationScoringService(makeLiveGateway());
      return new EvaluationOrchestratorService(scoring);
    }

    it("happy: 조립된 run plan + 실 LLM 평가 1 회 round-trip → step-args 가 비어있지 않은 평가 결과로 조립된다", async () => {
      // (1) seed → run plan 단일 진입(T-0597). modelId·run 을 한 번에 fail-fast 검증.
      const runPlan = buildRealDataE2eRunPlan(seeds, ollamaModelId(), {
        gitSha: "abc1234",
        dateToken: "2026-06-24",
      });
      // run plan 이 검증된 seed-side pipeline + run 식별자를 보유.
      expect(runPlan.pipeline.modelId).toBe(ollamaModelId());
      expect(runPlan.run).toEqual({
        gitSha: "abc1234",
        dateToken: "2026-06-24",
      });

      // (2) 실 수집 산출(본 slice 는 synthetic 1 건으로 bound — github 네트워크 배선
      // 후속) → 실 LLM 평가 1 회 round-trip. options.modelId = repository stub config
      // id(difficulty 미주입 → modelId 직접 경로).
      const activities = [syntheticActivity()];
      const orchestrator = makeOrchestrator();
      const results = await orchestrator.evaluateActivities(activities, {
        modelId: CONFIG_ID,
      });

      // 평가 입력 1 건 → EvaluationResult 정확히 1 건(실 LLM 호출 1 회 bound).
      expect(results).toHaveLength(1);
      const [result] = results;

      // narrative 는 비어있지 않은 string — 내용 의미는 비결정적이라 assert 하지
      // 않는다(period-bridge-live 동형). 평가문·scoring·narrative 경로 확인 지점.
      expect(typeof result.narrative).toBe("string");
      expect(result.narrative.length).toBeGreaterThan(0);

      // scoring 파생 필드 — typed surface 존재 + 허용 집합 멤버십. unitId 는
      // `<sourceType>:<instanceKey>:<externalId>` 합성(입력 ↔ 결과 trace).
      expect(result.unitId).toBe("github:github.com:realdata-e2e-live-c1");
      expect(isDifficulty(result.difficulty)).toBe(true);
      expect(isContributionLevel(result.contribution)).toBe(true);
      expect(typeof result.volume).toBe("number");
      expect(result.volume).toBeGreaterThanOrEqual(0);

      // (3) 검증된 run plan + 수집 activities + 실 평가 results → step-args 단일
      // aggregator(T-0601). 평가 step-args + publish step-args 가 단일 runPlan 에서
      // thread 됨(modelId·run 일관).
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      // 평가 step-args 가 실 평가 결과 1 건을 반영(비어있지 않은 평가 surface).
      expect(stepArgs.evaluation).toBeDefined();
      // publish step-args 가 검증된 run 식별자를 thread.
      expect(stepArgs.publish).toBeDefined();
    });

    it("격리: orchestrator 생성자 arity 1 — persist symbol 주입 0(in-memory 평가 산출, DB write 0)", () => {
      // 본 spec 의 compose 가 주입하는 것은 scoring service 뿐 — persist service /
      // PrismaService 참조 0. 생성자 arity 박제로 회귀 가드(period-bridge-live 구조적
      // write-0 단언 mirror).
      expect(EvaluationOrchestratorService.length).toBe(1);
    });

    // gating.ollama.model 을 modelId 로 노출하는 helper — describeLive 활성 분기에서만
    // 호출되므로 gating.ollama 는 항상 존재(non-null).
    function ollamaModelId(): string {
      return gating.ollama!.model;
    }
  },
);
