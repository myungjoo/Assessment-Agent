// LlmModule spec — T-0135 reviewer round 2 보완 (CI scripts/check-spec-presence.sh
// 가 신규 production .ts 에 동반 spec 의무를 강제). LlmProviderConfigRepository
// provider 가 module 안에서 resolve 되고 export 되는지 검증.
//
// 본 spec 은 PersistenceModule (`@Global()`) 을 함께 imports 하여 PrismaService
// dep 를 만족시킨다. PrismaService 의 super() 부작용 (PrismaClient 생성 +
// adapter 구성) 은 jest.mock 으로 회피 — repository 의 unit test 는 별도
// llm-provider-config.repository.spec.ts 가 책임이며, 본 spec 은 module compile +
// provider resolve + exports 등록 정합성만 검증. UserModule / AuthModule spec 패턴 mirror.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect)
// 을 회피. LlmProviderConfigRepository 의 생성자 dep 으로 PrismaService 가 inject
// 되나, 본 spec 은 instance 동작이 아닌 module compile 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    llmProviderConfig = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

// eslint-disable-next-line import/first
import { Test, type TestingModule } from "@nestjs/testing";

// eslint-disable-next-line import/first
import { LOAD_TEST_STUB_ENV } from "../common/load-test-stub-gating";
// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import { LlmProviderConfigResolver } from "./llm-provider-config-resolver.service";
// eslint-disable-next-line import/first
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";
// eslint-disable-next-line import/first
import { LlmStubGateway } from "./llm-stub-gateway.service";
// eslint-disable-next-line import/first
import { LlmModule } from "./llm.module";

describe("LlmModule", () => {
  // T-1629 — env 누수 차단 가드. 본 spec 자체는 `LOAD_TEST_STUB` 를 쓰지 않지만, stub
  // 배선을 다루는 spec 군이 같은 규율을 공유하도록 원래 값 복원을 명시해 둔다(미설정이면
  // 미설정 그대로 — 다른 spec 오염 0).
  const originalStubEnv = process.env[LOAD_TEST_STUB_ENV];

  afterEach(() => {
    if (originalStubEnv === undefined) {
      delete process.env[LOAD_TEST_STUB_ENV];
    } else {
      process.env[LOAD_TEST_STUB_ENV] = originalStubEnv;
    }
  });

  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께
  // imports 하면 LlmProviderConfigRepository 가 정상 resolve 된다.
  it("compile 시 LlmProviderConfigRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, LlmModule],
    }).compile();

    const repo = moduleRef.get(LlmProviderConfigRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(LlmProviderConfigRepository);

    await moduleRef.close();
  });

  // Branch: LlmProviderConfigRepository 를 외부 sentinel 로 override 해도 module 이
  // compile. exports 가 정상 등록되어 외부 module 이 inject 가능함의 간접 검증.
  it("LlmProviderConfigRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "llm-provider-config-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, LlmModule],
    })
      .overrideProvider(LlmProviderConfigRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(LlmProviderConfigRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / dependency 검증: LlmProviderConfigRepository 가 PrismaService 를
  // 생성자 의존성으로 요구함을 Reflect metadata 로 정적 확인 (PersistenceModule
  // @Global 의존 검증). UserModule spec 의 동일 패턴 mirror.
  it("LlmProviderConfigRepository 가 PrismaService 를 생성자 의존성으로 요구한다 (PersistenceModule @Global 의존 검증)", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      LlmProviderConfigRepository,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    // mock 의 클래스명은 MockPrismaService — 둘 다 PrismaService substring 매칭.
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });

  // T-0568 — LlmProviderConfigResolver (ADR-0048 §Decision 1·2) 가 module 의
  // providers + exports 에 등록되어 DI resolve 되는지 검증. 후속 controller wiring
  // task (chain item 3) 가 AssessmentEvaluationModule 에서 LlmModule import 로
  // inject 받을 수 있도록 export 정합성을 간접 확인.
  it("compile 시 LlmProviderConfigResolver provider 가 resolve 된다 (T-0568, ADR-0048 §Decision 1)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, LlmModule],
    }).compile();

    const resolver = moduleRef.get(LlmProviderConfigResolver);
    expect(resolver).toBeDefined();
    expect(resolver).toBeInstanceOf(LlmProviderConfigResolver);

    await moduleRef.close();
  });

  // T-1629 — LlmStubGateway (ADR-0057 `D1` 의 module binding 조각) 가 providers 에
  // 등록되어 DI resolve 되는지 검증. 의존 0 인 class 라 추가 module import 없이 resolve
  // 돼야 하며, 등록 누락이면 소비 module 의 LLM_GATEWAY factory inject 가 깨진다.
  it("compile 시 LlmStubGateway provider 가 resolve 된다 (T-1629, ADR-0057 D1)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, LlmModule],
    }).compile();

    const stub = moduleRef.get(LlmStubGateway);
    expect(stub).toBeDefined();
    expect(stub).toBeInstanceOf(LlmStubGateway);
    // 의존 0 계약 — 생성자 파라미터가 0 이어야 한다(의존이 생기면 "외부 왕복 0 / 결정적"
    // 보장이 깨져 부하 기준선이 흔들린다). metadata 부재 또는 빈 배열 둘 다 의존 0 이다.
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      LlmStubGateway,
    ) as unknown[] | undefined;
    expect(paramTypes ?? []).toHaveLength(0);

    await moduleRef.close();
  });

  // exports 정합: LlmStubGateway 를 sentinel 로 override 해도 compile 되고 module.get 이
  // sentinel 을 돌려준다 — exports 등록이 정상이라 외부 module(AssessmentEvaluationModule
  // 의 LLM_GATEWAY factory)이 inject 가능함의 간접 검증(기존 override 패턴 mirror).
  it("LlmStubGateway provider 가 sentinel 로 override 되어도 compile 한다 (exports 정합)", async () => {
    const sentinel = { __sentinel: "llm-stub-gateway-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, LlmModule],
    })
      .overrideProvider(LlmStubGateway)
      .useValue(sentinel)
      .compile();

    expect(moduleRef.get(LlmStubGateway)).toBe(sentinel);

    await moduleRef.close();
  });
});
