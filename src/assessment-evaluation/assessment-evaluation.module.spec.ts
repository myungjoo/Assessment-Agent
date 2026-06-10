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
// 하며, T-0316 으로 추가된 AssessmentCollectionModule import 가 전이로 User/Github/
// Confluence repository(person/group/part/assessment/contribution/permissionDeniedRecord
// delegate 등)를 끌어오므로 그 delegate 들도 stub 한다(assessment-collection.module.spec.ts
// mock mirror). 본 spec 은 instance 동작이 아닌 module compile + provider resolve 만 검증한다.
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
    // T-0316: AssessmentCollectionModule 전이 의존(User/collection repository)이 요구하는
    // delegate 들을 stub. assessment-collection.module.spec.ts 의 mock 과 동형.
    permissionDeniedRecord = {
      create: jest.fn(),
      findMany: jest.fn(),
    };
    person = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    group = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    part = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    personGroupMembership = {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    assessment = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    contribution = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    summary = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    user = { findUnique: jest.fn(), update: jest.fn() };
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
import { EvaluationResultPersistService } from "./evaluation-result-persist.service";
// eslint-disable-next-line import/first
import { EvaluationScoringService } from "./evaluation-scoring.service";
// eslint-disable-next-line import/first
import { PeriodBridgeEphemeralService } from "./period-bridge-ephemeral.service";
// eslint-disable-next-line import/first
import { SummaryAggregateOrchestratorService } from "./summary-aggregate-orchestrator.service";
// eslint-disable-next-line import/first
import { SummaryNarrativeService } from "./summary-narrative.service";
// eslint-disable-next-line import/first
import { SummaryPersistService } from "./summary-persist.service";

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

    // EvaluationResultPersistService(T-0300, ADR-0033 §Follow-ups 3)도 같은 module
    // 에서 resolve 되며 PrismaService(@Global, mocked)를 DI 로 주입받는다.
    const persist = moduleRef.get(EvaluationResultPersistService);
    expect(persist).toBeDefined();
    expect(persist).toBeInstanceOf(EvaluationResultPersistService);

    // SummaryNarrativeService(T-0307, ADR-0035 §Decision 1/5)도 같은 module 에서
    // resolve 되며 @Inject(LLM_GATEWAY) 생성자 주입이 LLM_GATEWAY useExisting 바인딩
    // 으로 닫힌다(provider 등록 누락 시 본 resolve 가 fail — 배선 게이트).
    const narrative = moduleRef.get(SummaryNarrativeService);
    expect(narrative).toBeDefined();
    expect(narrative).toBeInstanceOf(SummaryNarrativeService);

    // SummaryPersistService(T-0309, ADR-0035 §Decision 1/4)도 같은 module 에서 resolve
    // 되며 PrismaService(@Global, mocked) + SummaryNarrativeService(같은 module)를 DI 로
    // 주입받는다(provider 등록 누락 시 본 resolve 가 fail — 배선 게이트).
    const summaryPersist = moduleRef.get(SummaryPersistService);
    expect(summaryPersist).toBeDefined();
    expect(summaryPersist).toBeInstanceOf(SummaryPersistService);

    // SummaryAggregateOrchestratorService(T-0310, ADR-0035 §Follow-ups)도 같은 module
    // 에서 resolve 되며 SummaryPersistService(같은 module)를 DI 로 주입받는다(provider
    // 등록 누락 시 본 resolve 가 fail — 배선 게이트, T-0307 round2 MAJOR 학습).
    const summaryOrchestrator = moduleRef.get(
      SummaryAggregateOrchestratorService,
    );
    expect(summaryOrchestrator).toBeDefined();
    expect(summaryOrchestrator).toBeInstanceOf(
      SummaryAggregateOrchestratorService,
    );

    // PeriodBridgeEphemeralService(T-0316, ADR-0037 §Decision1 ephemeral bridge)도 같은
    // module 에서 resolve 되며 CollectionSpecService / CollectionOrchestratorService
    // (AssessmentCollectionModule export) + EvaluationOrchestratorService(같은 module)를
    // DI 로 주입받는다(import/export 등록 누락 시 본 resolve 가 fail — 배선 게이트).
    const periodBridge = moduleRef.get(PeriodBridgeEphemeralService);
    expect(periodBridge).toBeDefined();
    expect(periodBridge).toBeInstanceOf(PeriodBridgeEphemeralService);

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
