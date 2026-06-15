// SchedulingModule compile test (CLAUDE.md §3.2 R-112 — DI 배선 검증). T-0413, P7 ③
// slice 1. ScheduleModule.forRoot() 를 테스트 모듈에 함께 import 해 전역 SchedulerRegistry
// 를 공급 → CronScheduleService 가 정상 resolve 됨을 검증한다. forRoot 누락 시
// 주입 실패(SchedulerRegistry provider 부재)로 module 생성이 reject 됨을 negative 로 박제.
//
// T-0419(P7 ⑤ slice 2): SchedulingModule 이 BackfillRunnerService 의 의존
// CollectionTriggerService 를 공급하기 위해 AssessmentCollectionModule 을 import 하면서,
// 그 module 의 전이 의존(UserModule → repository → PrismaService 등)이 함께 들어온다.
// PrismaService 는 @Global() PersistenceModule 이 export 하므로 본 spec 도 그 module 을
// 함께 import 하고, PrismaService 의 super() 부작용(PrismaClient 생성/connect)은 jest.mock
// 으로 회피한다(assessment-collection.module.spec.ts 동일 패턴).

// PrismaService mock — PrismaClient extends 의 부작용(adapter 생성 / connect) 회피. 전이로
// 들어오는 repository 들이 inject 하는 delegate 와 lifecycle hook 을 stub 한다(collection
// module.spec mock mirror).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
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
import { Module } from "@nestjs/common";
// eslint-disable-next-line import/first
import { ScheduleModule } from "@nestjs/schedule";
// eslint-disable-next-line import/first
import { Test } from "@nestjs/testing";

// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import { BackfillRunnerService } from "./backfill-runner.service";
// eslint-disable-next-line import/first
import { CronScheduleService } from "./cron-schedule.service";
// eslint-disable-next-line import/first
import { SchedulingModule } from "./scheduling.module";

describe("SchedulingModule", () => {
  it("ScheduleModule.forRoot() 와 함께 import 하면 CronScheduleService 가 resolve 된다 (happy)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), PersistenceModule, SchedulingModule],
    }).compile();

    const service = moduleRef.get(CronScheduleService);
    expect(service).toBeInstanceOf(CronScheduleService);
    // 부팅 직후 동적 job 0 — 빈 registry 초기 계약(T-0412) 정합.
    expect(service.list()).toEqual([]);

    await moduleRef.close();
  });

  it("BackfillRunnerService 가 resolve 된다 — AssessmentCollectionModule import 로 CollectionTriggerService 주입이 닫힌다 (happy, T-0419)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), PersistenceModule, SchedulingModule],
    }).compile();

    const runner = moduleRef.get(BackfillRunnerService);
    expect(runner).toBeInstanceOf(BackfillRunnerService);

    await moduleRef.close();
  });

  it("BackfillRunnerService 가 sentinel 로 override 되어도 compile 한다 (exports 등록 정합, T-0419)", async () => {
    const sentinel = { __sentinel: "backfill-runner-override" };
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), PersistenceModule, SchedulingModule],
    })
      .overrideProvider(BackfillRunnerService)
      .useValue(sentinel)
      .compile();

    expect(moduleRef.get(BackfillRunnerService)).toBe(sentinel);

    await moduleRef.close();
  });

  it("SchedulerRegistry 공급(ScheduleModule.forRoot())이 없으면 주입 실패로 compile 이 reject 된다 (negative)", async () => {
    // forRoot 없이 SchedulingModule 의 provider 만 등록 — SchedulerRegistry token 부재.
    @Module({
      providers: [CronScheduleService],
    })
    class BrokenModule {}

    await expect(
      Test.createTestingModule({ imports: [BrokenModule] }).compile(),
    ).rejects.toThrow();
  });
});
