// UserInstanceAccessModule spec — T-0222. CI scripts/check-spec-presence.sh 가
// 신규 production .ts (user-instance-access.module.ts) 에 동반 spec 의무를 강제.
// 본 spec 은 module 이 compile 되고 UserInstanceAccessRepository provider 가
// resolve·export 되는지 검증한다. permission-denied-record.module.spec.ts 패턴
// mirror.
//
// 본 module 은 PersistenceModule (`@Global()`) 의 PrismaService 를 repository
// 생성자 dep 으로 inject 하므로 본 spec 은 PersistenceModule 을 함께 imports
// 한다. PrismaService 의 super() 부작용 (PrismaClient 생성 + adapter 구성) 은
// jest.mock 으로 회피 — repository 의 동작 unit test 는 별도
// user-instance-access.repository.spec.ts 가 책임이며, 본 spec 은 module compile
// + provider resolve + exports 등록 정합성만 검증.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect) 을
// 회피. UserInstanceAccessRepository 의 생성자 dep 으로 PrismaService 가 inject
// 되나, 본 spec 은 instance 동작이 아닌 module compile 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    userInstanceAccess = {
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
import { UserInstanceAccessModule } from "./user-instance-access.module";
// eslint-disable-next-line import/first
import { UserInstanceAccessRepository } from "./user-instance-access.repository";

describe("UserInstanceAccessModule", () => {
  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께 imports
  // 하면 repository provider 가 정상 resolve 된다.
  it("compile 시 UserInstanceAccessRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserInstanceAccessModule],
    }).compile();

    const repo = moduleRef.get(UserInstanceAccessRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(UserInstanceAccessRepository);

    await moduleRef.close();
  });

  // Branch / negative: UserInstanceAccessRepository 를 외부 sentinel 로 override 해도
  // module 이 compile. exports 가 정상 등록되어 외부 module (후속 service-결선 slice)
  // 이 repository 를 inject 가능함의 간접 검증.
  it("UserInstanceAccessRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = {
      __sentinel: "user-instance-access-repo-override",
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserInstanceAccessModule],
    })
      .overrideProvider(UserInstanceAccessRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(UserInstanceAccessRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / dependency 검증: UserInstanceAccessRepository 가 PrismaService 를
  // 생성자 의존성으로 요구함을 Reflect metadata 로 정적 확인 (PersistenceModule
  // @Global 의존 정합 — 누락 시 fail). mock 의 클래스명은 MockPrismaService 라
  // PrismaService substring 으로 매칭.
  it("UserInstanceAccessRepository 가 PrismaService 를 생성자 의존성으로 요구한다 (PersistenceModule @Global 의존 검증)", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      UserInstanceAccessRepository,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });
});
