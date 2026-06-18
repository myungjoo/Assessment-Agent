// ExportModule spec — T-0488. CI scripts/check-spec-presence.sh 가 신규 production
// .ts (export.module.ts) 에 동반 spec 의무를 강제. 본 spec 은 module 이 compile 되고
// ExportJobService provider 가 resolve·export 되며 ExportController 가 등록되는지
// 검증한다. llm.module.spec.ts / user-instance-access.module.spec.ts 패턴 mirror.
//
// 본 module 은 PersistenceModule (`@Global()`) 의 PrismaService 를 ExportJobService
// 생성자 dep 으로 inject 하고 AuthModule (JwtAuthGuard / RolesGuard) 을 import 하므로
// 본 spec 은 PersistenceModule + AuthModule 을 함께 imports 한다. PrismaService 의
// super() 부작용 (PrismaClient 생성 + adapter 구성) 은 jest.mock 으로 회피 —
// ExportJobService 의 동작 unit test 는 export-job.service.spec.ts 가 책임이며, 본
// spec 은 module compile + provider resolve + controller 등록 정합성만 검증.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect) 을
// 회피. ExportJobService 의 생성자 dep 으로 PrismaService 가 inject 되나, 본 spec 은
// instance 동작이 아닌 module compile 만 검증.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    exportJob = {
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

import { ExportJobService } from "./export-job.service";
import { ExportController } from "./export.controller";
import { ExportModule } from "./export.module";
/* eslint-enable import/first */

describe("ExportModule", () => {
  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께 imports
  // 하면 ExportJobService provider 가 정상 resolve 된다 (AuthModule 은 ExportModule
  // 이 전이 import — guard 바인딩이 닫힘).
  it("compile 시 ExportJobService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ExportModule],
    }).compile();

    const service = moduleRef.get(ExportJobService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ExportJobService);

    await moduleRef.close();
  });

  // Branch: ExportController 가 module 안에서 resolve 되는지 검증 (controller 등록
  // 정합성 — 미등록 시 endpoint live 0).
  it("compile 시 ExportController 가 resolve 된다 (controller 등록 검증)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ExportModule],
    }).compile();

    const controller = moduleRef.get(ExportController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(ExportController);

    await moduleRef.close();
  });

  // Branch / negative: ExportJobService 를 외부 sentinel 로 override 해도 module 이
  // compile. exports 가 정상 등록되어 외부 module (후속 import/helper 배선 slice) 이
  // service 를 inject 가능함의 간접 검증.
  it("ExportJobService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "export-job-service-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, ExportModule],
    })
      .overrideProvider(ExportJobService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(ExportJobService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / dependency 검증: ExportJobService 가 PrismaService 를 생성자 의존성으로
  // 요구함을 Reflect metadata 로 정적 확인 (PersistenceModule @Global 의존 정합 —
  // 누락 시 fail). mock 의 클래스명은 MockPrismaService 라 PrismaService substring 매칭.
  it("ExportJobService 가 PrismaService 를 생성자 의존성으로 요구한다 (PersistenceModule @Global 의존 검증)", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      ExportJobService,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });
});
