// realdata-e2e-eval-chain-live.smoke-spec.ts — 실 평가 e2e full-chain env-gated live smoke
// (T-0975, PLAN.md 109행 두 leg 합류). 실 github 수집 → 그 실 활동을 실 Ollama LLM 평가로
// chain 하는 end-to-end 를 봉한다.
//
// 배경: `realdata-e2e-live.smoke-spec.ts`(T-0610)의 평가 leg 은 collection 을 synthetic
// Activity 1 건으로 stub 했고, `realdata-e2e-github-collection-live.smoke-spec.ts`(T-0806)의
// 수집 leg 은 수집 결과를 평가로 흘려보내지 않았다(eval stub). 본 smoke 는 두 반쪽을 합류
// 시킨다 — T-0806 수집 plan 으로 실 github 활동을 1 회 round-trip 수집하고, 그 활동을
// `buildRealDataE2eEvalChainInput`(T-0975, unit spec 별도 검증)으로 bounded single 조립한 뒤
// T-0610 makeLiveGateway 패턴으로 실 Ollama LLM 평가 1 회 round-trip 을 흘려보낸다.
//
// gating: 본 suite 는 realdata-e2e 전용 gating env(REALDATA_E2E_LIVE_TEST + Ollama 5 종 +
// github read PAT)가 *모두* set 된 경우에만 활성화된다. 판정은 순수 helper
// resolveRealDataE2eLiveGating(재사용) 에 위임하고, enabled=false 면 describe.skip 으로 전
// suite 가 skip 된다 → public CI 는 gating env 부재라 항상 skip → 실 네트워크 0 / secret 0 /
// 비용 0 으로 green(R-113). skip-branch 자체는 CI 에서 항상 실행되는 non-gated assert(아래
// "gating skip 판정" it)로 존재한다.
//
// 검증 invariant: 비결정 본문(평가문 문장·활동 내용·repo 이름)은 assert 하지 않고, 실 평가
// 결과가 정상 산출됐음(비어있지 않은 narrative 1+ + volume/난이도/기여도 메타 존재)만 assert
// 한다. raw 외부 활동 데이터는 파일/전역 변수로 보관하지 않는다(R-59) — 수집 응답에서 도메인
// Activity 의 typed 참조 필드만 뽑아 평가로 넘기고 raw 본문은 폐기, 평가 결과 메타만 검증한다.
//
// 안전·격리(CLAUDE.md §9): 실 credential 값(github PAT·Ollama base URL·API key)을 본 파일
// 어디에도 적지 않는다 — env(resolveRealDataE2eLiveGating 의 gating)에서만 읽는다. persist
// symbol 주입 0(in-memory 평가 산출 검증만 — DB write 0). 새 외부 dependency 0(Node 내장
// fetch 만 — adapter/gateway default transport).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import { isContributionLevel } from "../../src/assessment-evaluation/domain/evaluation-result";
import { EvaluationOrchestratorService } from "../../src/assessment-evaluation/evaluation-orchestrator.service";
import { EvaluationScoringService } from "../../src/assessment-evaluation/evaluation-scoring.service";
import { GithubAdapter } from "../../src/github/github-adapter.service";
import { GithubRequestInput } from "../../src/github/github-request.builder";
import { isDifficulty } from "../../src/llm/difficulty";
import { DifficultyMappingService } from "../../src/llm/difficulty-mapping.service";
import { LlmApiKeyCipher } from "../../src/llm/llm-apikey-cipher.service";
import { LlmProvider } from "../../src/llm/llm-gateway.interface";
import { LlmHttpGateway } from "../../src/llm/llm-http-gateway.service";
import { LlmProviderConfigRepository } from "../../src/llm/llm-provider-config.repository";
import { buildRealDataE2eEvalChainInput } from "../helpers/realdata-e2e-eval-chain";
import { buildRealDataGithubCollectionPlan } from "../helpers/realdata-e2e-github-collection-live";
import { resolveRealDataE2eLiveGating } from "../helpers/realdata-e2e-live-gating";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// gating 판정 — process.env 를 순수 helper 로 평가(realdata-e2e 7 종 완전성).
// enabled 가 describe 분기 입력. unit 검증은 realdata-e2e-live-gating.spec.ts.
const gating = resolveRealDataE2eLiveGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

// 평가에 쓸 config id — repository stub 이 이 id 로 조회되며 scoring options.modelId 로도
// 쓰인다(difficulty 미주입 → modelId 직접 경로). Ollama config 식별 라벨(T-0610 동형).
const CONFIG_ID = "cfg-realdata-e2e-eval-chain-live-ollama";

// mapEventToActivity — 실 github /users/{user}/events/public 응답 1 건을 도메인
// GithubActivity 로 매핑하는 spec-local 어댑터. raw 본문(payload 전문)은 보관하지 않고
// (R-59) typed 참조 필드만 뽑는다. author 는 결정론적 귀속을 위해 plan username 을 쓴다
// (수집 대상 = 그 username 의 공개 활동이므로). kind 는 event type 을 3 종으로 사영.
function mapEventToActivity(
  username: string,
  event: Record<string, unknown>,
): GithubActivity {
  const type = typeof event.type === "string" ? event.type : "";
  const kind: GithubActivity["kind"] =
    type === "PullRequestEvent"
      ? "pr"
      : type === "IssuesEvent"
        ? "issue"
        : "commit";
  const repo = event.repo as { name?: unknown } | undefined;
  return {
    sourceType: "github",
    externalId:
      typeof event.id === "string" ? event.id : String(event.id ?? "unknown"),
    instanceKey: "github.com",
    author: username,
    timestamp:
      typeof event.created_at === "string"
        ? event.created_at
        : "1970-01-01T00:00:00Z",
    // typed scalar 만 — raw 본문 미포함(R-59). event type 문자열 길이 등 volume 산출용.
    metadata: { titleLength: type.length },
    repoRef:
      repo && typeof repo.name === "string"
        ? repo.name
        : `${username}/unknown-repo`,
    kind,
  };
}

describeLive(
  "Smoke(live): 실 평가 e2e full-chain — 실 github 수집 → 실 Ollama LLM 평가 round-trip",
  () => {
    // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(T-0610/T-0806 동형).
    // gating skip 시 미발화. 수집 + 평가 2 leg round-trip 이라 여유를 둔다.
    jest.setTimeout(45000);

    // 실 LlmHttpGateway 구성 — T-0610 makeLiveGateway() mirror. Ollama(openai-compatible)
    // provider config 를 live base URL 로 가리키는 repository stub + cipher stub. 실 DB /
    // 실 decrypt 미발생 — live env 값을 평문 경로로 공급(§9: 값은 env 출처, 코드 기재 0).
    function makeLiveGateway(): LlmHttpGateway {
      const ollama = gating.ollama!;
      const repository = {
        findById: jest.fn().mockResolvedValue({
          id: CONFIG_ID,
          // provider 는 wire enum LlmProvider.Custom(openai-compatible adapter 경로).
          provider: LlmProvider.Custom,
          endpointUrl: ollama.baseUrl,
          apiKey: "ciphertext-not-used-cipher-is-stubbed",
          modelId: ollama.model,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        }),
      } as unknown as LlmProviderConfigRepository;
      const cipher = {
        decrypt: jest.fn().mockReturnValue(ollama.apiKey),
      } as unknown as LlmApiKeyCipher;
      const difficultyMappingService = {
        resolveModel: jest
          .fn()
          .mockRejectedValue(new Error("resolveModel 미예상 호출")),
      } as unknown as DifficultyMappingService;
      // fetchFn 인자 생략 — default globalThis.fetch 가 실 Ollama endpoint 로 transport.
      return new LlmHttpGateway(repository, cipher, difficultyMappingService);
    }

    function makeOrchestrator(): EvaluationOrchestratorService {
      const scoring = new EvaluationScoringService(makeLiveGateway());
      return new EvaluationOrchestratorService(scoring);
    }

    it("full-chain: 실 github 수집 → bounded single 조립 → 실 LLM 평가 1 회 round-trip → 정상 평가 산출", async () => {
      // (1) 수집 plan(T-0806 재사용) — myungjoo/leemgs 대상. describeLive 활성 = enabled.
      const plan = buildRealDataGithubCollectionPlan(
        gating,
        buildRealDataE2eSeed(),
      );
      expect(plan.enabled).toBe(true);
      expect(plan.entries.length).toBeGreaterThan(0);

      // (2) 첫 대상 username 을 실 github 로 1 회 round-trip 수집(bounded single, per_page=1).
      const entry = plan.entries[0];
      const adapter = new GithubAdapter();
      const input: GithubRequestInput = {
        host: entry.host,
        token: gating.githubPat as string,
        path: entry.path,
        query: { per_page: "1" },
      };
      const body = await adapter.request(input);
      expect(Array.isArray(body)).toBe(true);
      const events = body as Record<string, unknown>[];

      // (3) 수집 응답 → 도메인 Activity 매핑(raw 본문 폐기, typed 필드만). 공개 활동이 0 건인
      //     계정도 있을 수 있으므로 그 경우엔 chain 진입 대신 skip 판정만 확인하고 종료.
      const activities = events.map((event) =>
        mapEventToActivity(entry.username, event),
      );
      const chainInput = buildRealDataE2eEvalChainInput(gating, activities);

      if (!chainInput.active) {
        // 공개 활동 0 건 → bounded 0 → active:false. 조용한-빈-입력-평가가 차단됐음을 확인.
        expect(chainInput.activities).toHaveLength(0);
        return;
      }

      // 활성 chain — bounded single(정확히 1 건) + username 귀속 보존.
      expect(chainInput.activities).toHaveLength(1);
      expect(chainInput.username).toBe(entry.username);

      // (4) 실 Ollama LLM 평가 1 회 round-trip — 입력 1 건 = 실 호출 1 회 bound(T-0245).
      const orchestrator = makeOrchestrator();
      const results = await orchestrator.evaluateActivities(
        chainInput.activities,
        {
          modelId: CONFIG_ID,
        },
      );

      // 평가 입력 1 건 → EvaluationResult 정확히 1 건(실 LLM 호출 1 회 bound).
      expect(results).toHaveLength(1);
      const [result] = results;

      // narrative 는 비어있지 않은 string — 내용 의미는 비결정적이라 assert 하지 않는다.
      expect(typeof result.narrative).toBe("string");
      expect(result.narrative.length).toBeGreaterThan(0);

      // scoring 파생 메타 — typed surface 존재 + 허용 집합 멤버십(volume/난이도/기여도).
      expect(isDifficulty(result.difficulty)).toBe(true);
      expect(isContributionLevel(result.contribution)).toBe(true);
      expect(typeof result.volume).toBe("number");
      expect(result.volume).toBeGreaterThanOrEqual(0);
    });

    it("격리: orchestrator 생성자 arity 1 — persist symbol 주입 0(in-memory 평가 산출, DB write 0)", () => {
      // 본 spec 의 compose 가 주입하는 것은 scoring service 뿐 — persist service /
      // PrismaService 참조 0. 생성자 arity 박제로 회귀 가드(T-0610 동형).
      expect(EvaluationOrchestratorService.length).toBe(1);
    });
  },
);

// gating skip 판정 — describe 활성/비활성과 무관하게 CI 에서 항상 실행되는 non-gated assert.
// public CI(gating env 부재)에서 이 it 이 gating.enabled=false 를 확인해 전 live suite 가
// skip 됐음을 박제한다(실 네트워크 0 / secret 0 / green). 운영 env 주입 시엔 true 를 확인.
describe("realdata-e2e full-chain live smoke gating(비-gated 상시 실행)", () => {
  it("gating.enabled 는 boolean 이고 env 부재 시 false(→ 전 live suite skip)", () => {
    expect(typeof gating.enabled).toBe("boolean");
    // credential env 하나라도 부재면 helper 계약상 enabled=false → describeLive=describe.skip.
    if (!gating.enabled) {
      expect(gating.ollama).toBeUndefined();
      expect(gating.githubPat).toBeUndefined();
    }
  });
});
