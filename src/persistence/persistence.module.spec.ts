// PersistenceModule spec — T-0033 acceptance C.
// Testing module compile + PrismaService provider resolve + @Global() flag 박제 검증.

import { Test, type TestingModule } from "@nestjs/testing";

// PrismaService 의 실제 instantiation (PrismaClient super()) 를 회피하기 위해 mock.
jest.mock("./prisma.service", () => ({
  PrismaService: class MockPrismaService {
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

// eslint-disable-next-line import/first
import { PersistenceModule } from "./persistence.module";
// eslint-disable-next-line import/first
import { PrismaService } from "./prisma.service";

describe("PersistenceModule", () => {
  // Happy path: Testing module compile 시 PrismaService provider resolve.
  it("compile 시 PrismaService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule],
    }).compile();
    const prisma = moduleRef.get(PrismaService);
    expect(prisma).toBeDefined();
    await moduleRef.close();
  });

  // Negative / branch: @Global() flag 가 Reflect metadata 로 박제됨을 검증.
  // Nest 의 @Global() decorator 는 `__module:global__` symbol 을 module class 에 박는다.
  it("@Global() flag 가 module 에 박제되어 있다", () => {
    // 'public' Symbol 의 description 으로 검증.
    const globalKey = Reflect.getMetadataKeys(PersistenceModule).find(
      (k: unknown) => {
        const s = String(k);
        return s.includes("global");
      },
    );
    expect(globalKey).toBeDefined();
    const isGlobal = Reflect.getMetadata(
      globalKey as string,
      PersistenceModule,
    );
    expect(isGlobal).toBe(true);
  });

  // Branch coverage: PrismaService 를 mock 으로 override 했을 때도 module 이 compile 됨.
  it("PrismaService provider 가 mock 으로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: true };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule],
    })
      .overrideProvider(PrismaService)
      .useValue(sentinel)
      .compile();
    const resolved = moduleRef.get(PrismaService);
    expect(resolved).toBe(sentinel);
    await moduleRef.close();
  });
});
