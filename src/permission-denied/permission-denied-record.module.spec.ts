// PermissionDeniedRecordModule spec — T-0210. CI scripts/check-spec-presence.sh 가
// 신규 production .ts (permission-denied-record.module.ts) 에 동반 spec 의무를 강제.
// 본 spec 은 module 이 compile 되고 PermissionDeniedRecordService /
// PermissionDeniedRecordRepository provider 가 resolve·export 되는지 검증한다.
// llm.module.spec.ts 패턴 mirror.
//
// 본 spec 은 PersistenceModule (`@Global()`) 을 함께 imports 하여 PrismaService dep
// 를 만족시킨다. PrismaService 의 super() 부작용 (PrismaClient 생성 + adapter 구성)
// 은 jest.mock 으로 회피 — repository/service 의 unit test 는 별도
// permission-denied-record.repository.spec.ts / .service.spec.ts 가 책임이며, 본 spec
// 은 module compile + provider resolve + exports 등록 정합성만 검증.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect) 을
// 회피. PermissionDeniedRecordRepository 의 생성자 dep 으로 PrismaService 가 inject
// 되나, 본 spec 은 instance 동작이 아닌 module compile 만 검증.
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
import { PermissionDeniedRecordModule } from "./permission-denied-record.module";
// eslint-disable-next-line import/first
import { PermissionDeniedRecordRepository } from "./permission-denied-record.repository";
// eslint-disable-next-line import/first
import { PermissionDeniedRecordService } from "./permission-denied-record.service";

describe("PermissionDeniedRecordModule", () => {
  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께 imports
  // 하면 service / repository 두 provider 가 정상 resolve 된다.
  it("compile 시 PermissionDeniedRecordService 와 PermissionDeniedRecordRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, PermissionDeniedRecordModule],
    }).compile();

    const service = moduleRef.get(PermissionDeniedRecordService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(PermissionDeniedRecordService);

    const repo = moduleRef.get(PermissionDeniedRecordRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(PermissionDeniedRecordRepository);

    await moduleRef.close();
  });

  // Branch / negative: PermissionDeniedRecordService 를 외부 sentinel 로 override 해도
  // module 이 compile. exports 가 정상 등록되어 외부 module (후속 emitter) 이 service
  // 를 inject 가능함의 간접 검증.
  it("PermissionDeniedRecordService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = {
      __sentinel: "permission-denied-record-service-override",
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, PermissionDeniedRecordModule],
    })
      .overrideProvider(PermissionDeniedRecordService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PermissionDeniedRecordService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Branch / negative: PermissionDeniedRecordRepository 를 sentinel 로 override 해도
  // module 이 compile. repository export 의 외부 inject 가용성 간접 검증.
  it("PermissionDeniedRecordRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "permission-denied-record-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, PermissionDeniedRecordModule],
    })
      .overrideProvider(PermissionDeniedRecordRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PermissionDeniedRecordRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / dependency 검증 (1): PermissionDeniedRecordService 가
  // PermissionDeniedRecordRepository 를 생성자 의존성으로 요구함을 Reflect metadata
  // 로 정적 확인 (의존 누락 시 fail). llm.module.spec.ts 동일 패턴 mirror.
  it("PermissionDeniedRecordService 가 PermissionDeniedRecordRepository 를 생성자 의존성으로 요구한다", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      PermissionDeniedRecordService,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    expect(paramTypes?.[0]?.name).toMatch(/PermissionDeniedRecordRepository/);
  });

  // Negative / dependency 검증 (2): PermissionDeniedRecordRepository 가 PrismaService
  // 를 생성자 의존성으로 요구함을 Reflect metadata 로 정적 확인 (PersistenceModule
  // @Global 의존 정합 — 누락 시 fail). mock 의 클래스명은 MockPrismaService 라
  // PrismaService substring 으로 매칭.
  it("PermissionDeniedRecordRepository 가 PrismaService 를 생성자 의존성으로 요구한다 (PersistenceModule @Global 의존 검증)", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      PermissionDeniedRecordRepository,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });
});
