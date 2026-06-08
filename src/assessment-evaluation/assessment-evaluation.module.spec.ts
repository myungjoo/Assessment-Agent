// AssessmentEvaluationModule spec — T-0291 (CI scripts/check-spec-presence.sh 가
// 신규 production .ts 에 동반 spec 의무를 강제). 본 spec 은 module compile +
// EvaluationScoringService provider resolve + LLM_GATEWAY token 이 LlmHttpGateway
// (LlmGateway 구현체)로 바인딩되는지 + exports 등록 정합성만 검증한다(instance 동작은
// evaluation-scoring.service.spec.ts 책임). llm.module.spec.ts 패턴 mirror.
//
// 본 module 은 LlmModule 을 import 하고, LlmModule 의 repository 들은 PrismaService 를
// 생성자 의존으로 요구하므로 PersistenceModule(@Global)을 함께 imports 한다.
// PrismaService 의 super() 부작용(PrismaClient 생성 + adapter 구성)은 jest.mock 으로
// 회피(llm.module.spec.ts 동일 패턴).

// PrismaService 를 mock — PrismaClient extends 의 부작용(adapter 생성 / connect)을
// 회피. LlmModule 전이 의존(LlmProviderConfigRepository 등)이 PrismaService 를 inject
// 하나, 본 spec 은 module compile + provider resolve 만 검증한다.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    llmProviderConfig = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    difficultyMapping = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

// eslint-disable-next-line import/first
import { Test, type TestingModule } from "@nestjs/testing";

// eslint-disable-next-line import/first
import { LLM_GATEWAY } from "../llm/llm-gateway.interface";
// eslint-disable-next-line import/first
import { LlmHttpGateway } from "../llm/llm-http-gateway.service";
// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import { AssessmentEvaluationController } from "./assessment-evaluation.controller";
// eslint-disable-next-line import/first
import { AssessmentEvaluationModule } from "./assessment-evaluation.module";
// eslint-disable-next-line import/first
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
// eslint-disable-next-line import/first
import { EvaluationScoringService } from "./evaluation-scoring.service";

describe("AssessmentEvaluationModule", () => {
  // Happy path: PersistenceModule(@Global, mocked PrismaService)와 함께 imports 하면
  // EvaluationScoringService 가 정상 resolve 된다.
  it("compile 시 EvaluationScoringService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentEvaluationModule],
    }).compile();

    const service = moduleRef.get(EvaluationScoringService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(EvaluationScoringService);

    // EvaluationOrchestratorService(T-0292)도 같은 module 에서 resolve 되며
    // EvaluationScoringService 를 DI 로 주입받는다.
    const orchestrator = moduleRef.get(EvaluationOrchestratorService);
    expect(orchestrator).toBeDefined();
    expect(orchestrator).toBeInstanceOf(EvaluationOrchestratorService);

    // AssessmentEvaluationController(T-0293)도 controllers 등록을 통해 resolve 되며
    // EvaluationOrchestratorService 를 같은 module 내 DI 로 주입받는다.
    const controller = moduleRef.get(AssessmentEvaluationController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(AssessmentEvaluationController);

    await moduleRef.close();
  });

  // Branch: LLM_GATEWAY token 이 LlmHttpGateway(LlmModule export 의 LlmGateway 구현체)
  // 로 useExisting 바인딩되어 동일 singleton 으로 resolve 된다.
  it("LLM_GATEWAY token 이 LlmHttpGateway singleton 으로 바인딩된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentEvaluationModule],
    }).compile();

    const gateway = moduleRef.get(LLM_GATEWAY);
    const httpGateway = moduleRef.get(LlmHttpGateway);
    expect(gateway).toBeInstanceOf(LlmHttpGateway);
    // useExisting 이므로 동일 인스턴스(중복 생성 0).
    expect(gateway).toBe(httpGateway);

    await moduleRef.close();
  });

  // Negative / dependency 검증: EvaluationScoringService 를 외부 sentinel 로 override
  // 해도 module 이 compile. exports 가 정상 등록되어 외부 module 이 inject 가능함의
  // 간접 검증(llm.module.spec.ts override 패턴 mirror).
  it("EvaluationScoringService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "evaluation-scoring-service-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentEvaluationModule],
    })
      .overrideProvider(EvaluationScoringService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(EvaluationScoringService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });
});
