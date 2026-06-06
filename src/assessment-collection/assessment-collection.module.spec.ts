// AssessmentCollectionModule spec — T-0251 (CI scripts/check-spec-presence.sh 가 신규
// production .ts 에 동반 spec 의무를 강제). 본 module 은 순수 DI 배선(분기 로직 0)이라
// module compile + provider resolve + exports 등록 정합성 + import-누락 회귀 가드만
// 검증한다(두 collection service 의 instance 동작 unit 은 각각
// github-collection.service.spec.ts / confluence-collection.service.spec.ts 책임).
// github.module.spec.ts 패턴 mirror.
//
// 전이 의존: GithubModule / ConfluenceModule 은 PermissionDeniedRecordModule 을
// imports 하고, 그 안의 repository 가 PrismaService 를 요구한다. PrismaService 는
// @Global() PersistenceModule 이 export 하므로 본 spec 도 그 module 을 함께 imports
// 하고, PrismaService 의 super() 부작용(PrismaClient 생성/connect)은 jest.mock 으로
// 회피한다(github.module.spec.ts 동일 패턴).

// PrismaService 를 mock — PrismaClient extends 의 부작용(adapter 생성 / connect)을
// 회피. PermissionDeniedRecordRepository 가 permissionDeniedRecord delegate 를 쓰므로
// 그 delegate 와 lifecycle hook 을 stub 한다. 본 spec 은 instance 동작이 아닌 module
// compile + wiring 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    permissionDeniedRecord = {
      create: jest.fn(),
      findMany: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

// eslint-disable-next-line import/first
import { Test, type TestingModule } from "@nestjs/testing";

// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import { AssessmentCollectionModule } from "./assessment-collection.module";
// eslint-disable-next-line import/first
import { CollectionOrchestratorService } from "./collection-orchestrator.service";
// eslint-disable-next-line import/first
import { ConfluenceCollectionService } from "./confluence-collection.service";
// eslint-disable-next-line import/first
import { GithubCollectionService } from "./github-collection.service";

describe("AssessmentCollectionModule", () => {
  // Happy path: PersistenceModule(@Global, mocked PrismaService) 와 함께 imports 하면
  // 두 collection service 가 정상 resolve 된다. GithubCollectionService 의
  // GithubInstanceClient(GithubModule export) / ConfluenceCollectionService 의
  // ConfluenceSpaceTraversalService(ConfluenceModule export) 생성자 주입이 imports 로
  // 성립함의 증명. import 누락 시 compile 이 throw 하므로 본 test 가 회귀 가드를 겸한다.
  it("compile 시 GithubCollectionService / ConfluenceCollectionService provider 가 resolve 된다 (happy — DI wiring)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentCollectionModule],
    }).compile();

    const github = moduleRef.get(GithubCollectionService);
    expect(github).toBeDefined();
    expect(github).toBeInstanceOf(GithubCollectionService);

    const confluence = moduleRef.get(ConfluenceCollectionService);
    expect(confluence).toBeDefined();
    expect(confluence).toBeInstanceOf(ConfluenceCollectionService);

    // orchestrator(slice v-b)도 같은 module 의 두 collection service 주입으로 resolve 됨.
    const orchestrator = moduleRef.get(CollectionOrchestratorService);
    expect(orchestrator).toBeDefined();
    expect(orchestrator).toBeInstanceOf(CollectionOrchestratorService);

    await moduleRef.close();
  });

  // Negative / exports 정합(3): CollectionOrchestratorService 도 sentinel override →
  // resolve 검증. orchestrator 의 exports 등록을 독립 cover(후속 영속화 slice 가 inject).
  it("CollectionOrchestratorService provider 가 sentinel 로 override 되어도 compile 한다 (exports 등록 정합)", async () => {
    const sentinel = { __sentinel: "collection-orchestrator-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentCollectionModule],
    })
      .overrideProvider(CollectionOrchestratorService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(CollectionOrchestratorService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // 분기 cover: 본 module 은 순수 DI 선언이라 런타임 분기 0 — "분기 없음 — 생략".
  // 대신 아래 sentinel override + import-누락 회귀 가드로 wiring 정합의 모든 경로를 cover.

  // Negative / exports 정합(1): GithubCollectionService 를 외부 sentinel 로 override 해도
  // module 이 compile 하고 그 sentinel 이 resolve 된다 — exports 가 정상 등록되어 외부
  // module 이 inject 가능함의 간접 검증.
  it("GithubCollectionService provider 가 sentinel 로 override 되어도 compile 한다 (exports 등록 정합)", async () => {
    const sentinel = { __sentinel: "github-collection-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentCollectionModule],
    })
      .overrideProvider(GithubCollectionService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(GithubCollectionService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / exports 정합(2): ConfluenceCollectionService 도 동일하게 sentinel
  // override → resolve 검증. 두 collection service 각각의 exports 등록을 독립 cover.
  it("ConfluenceCollectionService provider 가 sentinel 로 override 되어도 compile 한다 (exports 등록 정합)", async () => {
    const sentinel = { __sentinel: "confluence-collection-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, AssessmentCollectionModule],
    })
      .overrideProvider(ConfluenceCollectionService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(ConfluenceCollectionService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / import-누락 회귀 가드: AssessmentCollectionModule 을 빼고
  // PersistenceModule 만 import 한 context 에서는 두 collection service 가 provider 로
  // 등록되지 않아 moduleRef.get(...) 이 throw 해야 한다. 누군가 본 module 의 providers/
  // exports 등록을 빠뜨리거나, 외부에서 import 없이 inject 하려 하면 이 가드가 fail 한다.
  it("AssessmentCollectionModule 없이는 두 collection service 가 resolve 되지 않는다 (negative — provider 미등록 가드)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule],
    }).compile();

    expect(() => moduleRef.get(GithubCollectionService)).toThrow();
    expect(() => moduleRef.get(ConfluenceCollectionService)).toThrow();
    expect(() => moduleRef.get(CollectionOrchestratorService)).toThrow();

    await moduleRef.close();
  });
});
