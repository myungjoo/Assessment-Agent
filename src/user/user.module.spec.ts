// UserModule spec — T-0034 acceptance C 보완 (CI scripts/check-spec-presence.sh
// 가 신규 production .ts 에 동반 spec 의무를 강제). PersonRepository provider
// 가 module 안에서 resolve 되고 export 되는지 검증.
//
// 본 spec 은 PersistenceModule (`@Global()`) 을 함께 imports 하여 PrismaService
// dep 를 만족시킨다. PrismaService 의 super() 부작용 (PrismaClient 생성 +
// adapter 구성) 은 jest.mock 으로 회피 — PersonRepository 의 unit test 는 별도
// person.repository.spec.ts 가 책임이며, 본 spec 은 module compile + provider
// resolve + exports 등록 정합성만 검증.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect)
// 을 회피. PersonRepository 생성자 dep 으로 PrismaService 가 inject 되나, 본
// spec 은 instance 동작이 아닌 module compile 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    person = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
import { PersonRepository } from "./person.repository";
// eslint-disable-next-line import/first
import { UserModule } from "./user.module";

describe("UserModule", () => {
  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께
  // imports 하면 PersonRepository 가 정상 resolve 된다.
  it("compile 시 PersonRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(PersonRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(PersonRepository);

    await moduleRef.close();
  });

  // Branch: PersonRepository 를 외부 sentinel 로 override 해도 module 이 compile.
  // exports 가 정상 등록되어 외부 module 이 inject 가능함의 간접 검증.
  it("PersonRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "person-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(PersonRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PersonRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / error path: PersistenceModule 없이 UserModule 만 imports 하면
  // PrismaService dep 가 resolve 안 되어 compile fail — UserModule 이
  // PersistenceModule 의 @Global() PrismaService 에 의존함을 negative 검증.
  it("PersistenceModule 미 import 시 PrismaService dep 가 부족해 compile 이 실패한다", async () => {
    await expect(
      Test.createTestingModule({
        imports: [UserModule],
      }).compile(),
    ).rejects.toThrow(/PrismaService/);
  });
});
