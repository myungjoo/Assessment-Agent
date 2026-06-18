// ImportModule spec — T-0489. CI scripts/check-spec-presence.sh 가 신규 production
// .ts (import.module.ts) 에 동반 spec 의무를 강제. 본 spec 은 module 이 compile 되고
// ImportJobService provider 가 resolve·export 되며 ImportController 가 등록되는지
// 검증한다. export.module.spec.ts 패턴 mirror.
//
// 본 module 은 PersistenceModule (`@Global()`) 의 PrismaService 를 ImportJobService
// 생성자 dep 으로 inject 하고 AuthModule (JwtAuthGuard / RolesGuard) 을 import 하므로
// 본 spec 은 PersistenceModule 을 함께 imports 한다 (AuthModule 은 ImportModule 이
// 전이 import). PrismaService 의 super() 부작용 (PrismaClient 생성 + adapter 구성) 은
// jest.mock 으로 회피 — ImportJobService 의 동작 unit test 는 import-job.service.spec.ts
// 가 책임이며, 본 spec 은 module compile + provider resolve + controller 등록 정합성만 검증.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect) 을
// 회피. ImportJobService 의 생성자 dep 으로 PrismaService 가 inject 되나, 본 spec 은
// instance 동작이 아닌 module compile 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    importJob = {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import { Test, type TestingModule } from "@nestjs/testing";

import { PersistenceModule } from "../persistence/persistence.module";

import { ImportJobService } from "./import-job.service";
import { ImportController } from "./import.controller";
import { ImportModule } from "./import.module";
/* eslint-enable import/first */

describe("ImportModule", () => {
  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께 imports
  // 하면 ImportJobService provider 가 정상 resolve 된다 (AuthModule 은 ImportModule
  // 이 전이 import — guard 바인딩이 닫힘).
  it("compile 시 ImportJobService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ImportModule],
    }).compile();

    const service = moduleRef.get(ImportJobService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ImportJobService);

    await moduleRef.close();
  });

  // Branch: ImportController 가 module 안에서 resolve 되는지 검증 (controller 등록
  // 정합성 — 미등록 시 endpoint live 0).
  it("compile 시 ImportController 가 resolve 된다 (controller 등록 검증)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ImportModule],
    }).compile();

    const controller = moduleRef.get(ImportController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(ImportController);

    await moduleRef.close();
  });

  // Branch / negative: ImportJobService 를 외부 sentinel 로 override 해도 module 이
  // compile. exports 가 정상 등록되어 외부 module (후속 helper 배선 slice) 이
  // service 를 inject 가능함의 간접 검증.
  it("ImportJobService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "import-job-service-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ImportModule],
    })
      .overrideProvider(ImportJobService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(ImportJobService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / dependency 검증: ImportJobService 가 PrismaService 를 생성자 의존성으로
  // 요구함을 Reflect metadata 로 정적 확인 (PersistenceModule @Global 의존 정합 —
  // 누락 시 fail). mock 의 클래스명은 MockPrismaService 라 PrismaService substring 매칭.
  it("ImportJobService 가 PrismaService 를 생성자 의존성으로 요구한다 (PersistenceModule @Global 의존 검증)", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      ImportJobService,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });
});
