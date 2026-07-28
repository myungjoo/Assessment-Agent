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
// $transaction 은 ImportRestoreTransactionService (T-1279 등록) 의 유일한 사용 surface —
// jest.fn 으로 두어 "compile 만으로 트랜잭션이 열리지 않는다" 를 negative 로 단언한다.
// person delegate 는 ImportRestoreService (T-1282 등록) 의 read 경로
// (collectFullExportRecords) 가 쓰는 surface — compile 만으로 DB read 가 0 임을 negative 로
// 단언하기 위해 jest.fn 으로 둔다.
// importJob.update 는 ImportJobRunnerService (T-1285 등록) 의 job 전이 write surface
// (markRunning / markSucceeded / markFailed) — 등록만으로 job row 를 건드리지 않음을 단언한다.
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    importJob = {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    };
    person = { findMany: jest.fn() };
    $transaction = jest.fn();
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

/* eslint-disable import/first */
import { Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import { PersistenceModule } from "../persistence/persistence.module";
import { PrismaService } from "../persistence/prisma.service";

import { ImportJobRunnerService } from "./import-job-runner.service";
import { ImportJobService } from "./import-job.service";
import { ImportRestoreTransactionService } from "./import-restore-transaction.service";
import { ImportRestoreService } from "./import-restore.service";
import { ImportController } from "./import.controller";
import { ImportModule } from "./import.module";
/* eslint-enable import/first */

// T-1279 신규 test 공통 compile helper — 기존 3 test 는 원형 그대로 둔다 (의미 변경 0).
const compile = async (): Promise<TestingModule> =>
  Test.createTestingModule({
    imports: [PersistenceModule, ImportModule],
  }).compile();

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

// T-1279 (실행 slice 3c-1) — ImportRestoreTransactionService 의 DI 등록 한 겹. 본 describe 는
// "등록됐는가 · 등록이 기존 배선을 깨지 않는가 · 등록만으로 부작용이 없는가" 만 본다 (service
// 자체 동작은 import-restore-transaction.service.spec.ts 책임).
describe("ImportModule — ImportRestoreTransactionService 등록 (3c-1)", () => {
  // Happy path (분기 (a)): compile 하면 신규 provider 가 정상 resolve 된다.
  it("compile 시 ImportRestoreTransactionService provider 가 resolve 된다", async () => {
    const moduleRef = await compile();

    const service = moduleRef.get(ImportRestoreTransactionService);
    expect(service).toBeInstanceOf(ImportRestoreTransactionService);

    await moduleRef.close();
  });

  // Error path: PrismaService 공급자가 없으면 DI 가 **조용히 통과하지 않고** reject 한다 —
  // 등록이 의존성 없이도 형식상 성립하는 착시를 차단한다 (sentinel override 로는 이 실패를
  // 못 본다). ImportModule 통째 compile 대신 신규 provider 하나만 담은 최소 module 로 좁힌
  // 이유: PersistenceModule 을 뺀 full-graph compile 은 NestJS 10 instance-loader 의
  // parallel Promise.all 에서 sibling rejection 이 detach 돼 jest worker 를 crash 시킨다
  // (user.module.spec.ts T-0106 이 같은 framework 한계를 박제 — compile 에 suppress 옵션 0).
  it("PrismaService 공급자 없이 ImportRestoreTransactionService 를 등록하면 compile 이 실패한다 (DI 실패가 조용히 통과하지 않음)", async () => {
    const build = Test.createTestingModule({
      providers: [ImportRestoreTransactionService],
    }).compile();

    await expect(build).rejects.toThrow(/PrismaService/);
  });

  // 분기 (b): 신규 provider 를 sentinel 로 override 해도 compile — exports 를 통해 후속
  // 3c-2 orchestrator 가 이 토큰으로 주입받을 수 있음의 간접 검증.
  it("ImportRestoreTransactionService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "import-restore-transaction-override" };
    const moduleRef = await Test.createTestingModule({
      imports: [PersistenceModule, ImportModule],
    })
      .overrideProvider(ImportRestoreTransactionService)
      .useValue(sentinel)
      .compile();

    expect(moduleRef.get(ImportRestoreTransactionService)).toBe(sentinel);

    await moduleRef.close();
  });

  // 분기 (c): 생성자 dep 이 PrismaService 임을 Reflect metadata 로 정적 확인 — @Global 의존
  // 정합 (dep 이 바뀌면 imports 갱신 없이는 런타임 resolve 가 깨진다).
  it("ImportRestoreTransactionService 가 PrismaService 를 생성자 의존성으로 요구한다 (@Global 의존 검증)", () => {
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      ImportRestoreTransactionService,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toHaveLength(1);
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });

  // Negative (a): 신규 등록이 기존 배선을 깨지 않는다 — 같은 compile 안에서 3 종 동시 resolve.
  it("negative: 신규 등록이 기존 ImportJobService / ImportController resolve 를 깨지 않는다", async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(ImportJobService)).toBeInstanceOf(ImportJobService);
    expect(moduleRef.get(ImportController)).toBeInstanceOf(ImportController);
    expect(moduleRef.get(ImportRestoreTransactionService)).toBeInstanceOf(
      ImportRestoreTransactionService,
    );

    await moduleRef.close();
  });

  // Negative (b): ImportModule 이 PrismaService 를 자체 provider 로 중복 등록하지 않는다 —
  // @Global 인스턴스와 갈라지면 트랜잭션이 다른 커넥션에서 돌아 원자성이 깨진다.
  it("negative: PrismaService 를 자체 등록하지 않고 @Global 인스턴스를 그대로 주입받는다", async () => {
    const moduleRef = await compile();
    const global = moduleRef.get(PrismaService);
    const injected = (
      moduleRef.get(ImportRestoreTransactionService) as unknown as {
        prisma: unknown;
      }
    ).prisma;

    expect(injected).toBe(global);
    expect(moduleRef.get(ImportJobService)).toBeDefined();

    await moduleRef.close();
  });

  // Negative (c) + (d): compile · close 만으로 DB 왕복 0 — $transaction 미호출이어야 한다
  // (등록 slice 는 호출처를 만들지 않는다). close 로 열린 handle 도 0 으로 정리.
  it("negative: compile 만으로 $transaction 호출 0 · close 로 정리된다", async () => {
    const moduleRef = await compile();
    const prisma = moduleRef.get(PrismaService) as unknown as {
      $transaction: jest.Mock;
    };

    expect(prisma.$transaction).not.toHaveBeenCalled();

    await expect(moduleRef.close()).resolves.toBeUndefined();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// ImportModule 을 import 하는 외부 module 대역 — exports 누락을 잡기 위한 wrapper (T-1282
// negative (d)). ImportModule 이 ImportRestoreService 를 export 하지 않으면 여기서 resolve 가
// 실패한다 (providers 에만 있으면 module 밖에서는 보이지 않는다).
@Module({ imports: [PersistenceModule, ImportModule] })
class RestoreConsumerModule {}

// T-1282 (실행 slice 3c-2c) — ImportRestoreService 의 DI 등록 한 겹. 3c-1 describe 와 동형으로
// "등록됐는가 · dep 그래프가 닫히는가 · 등록만으로 부수효과가 없는가" 만 본다 (service 자체
// 동작은 import-restore.service.spec.ts 책임).
describe("ImportModule — ImportRestoreService 등록 (3c-2c)", () => {
  // Happy path (a): compile 하면 신규 orchestrator provider 가 정상 resolve 된다.
  it("compile 시 ImportRestoreService provider 가 resolve 된다", async () => {
    const moduleRef = await compile();

    const service = moduleRef.get(ImportRestoreService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ImportRestoreService);

    await moduleRef.close();
  });

  // Happy path (b): dep 그래프가 실제로 닫힌다 — 공개 method 가 노출되고, 주입된
  // ImportRestoreTransactionService 가 같은 container 의 인스턴스와 동일하다.
  it("resolve 된 인스턴스가 restoreFromDump 를 노출하고 같은 container 의 transaction service 를 주입받는다", async () => {
    const moduleRef = await compile();
    const service = moduleRef.get(ImportRestoreService);
    const injected = (
      service as unknown as { transaction: ImportRestoreTransactionService }
    ).transaction;

    expect(typeof service.restoreFromDump).toBe("function");
    expect(injected).toBe(moduleRef.get(ImportRestoreTransactionService));

    await moduleRef.close();
  });

  // Error path: 공급자 없이 ImportRestoreService 만 등록하면 DI 가 **조용히 통과하지 않고**
  // reject 한다. ImportModule 통째 compile 대신 최소 module 로 좁힌 이유는 3c-1 describe 와
  // 동일 (PersistenceModule 을 뺀 full-graph compile 은 jest worker 를 crash 시킨다).
  it("공급자 없이 ImportRestoreService 를 등록하면 compile 이 실패한다 (DI 실패가 조용히 통과하지 않음)", async () => {
    const build = Test.createTestingModule({
      providers: [ImportRestoreService],
    }).compile();

    await expect(build).rejects.toThrow(/PrismaService/);
  });

  // Negative (a) + (b): 등록은 부수효과를 만들지 않는다 — compile 만으로 $transaction 도
  // DB read (person.findMany — collectFullExportRecords 의 surface) 도 0 회다.
  it("negative: compile 만으로 $transaction · DB read 가 0 회다", async () => {
    const moduleRef = await compile();
    const prisma = moduleRef.get(PrismaService) as unknown as {
      $transaction: jest.Mock;
      person: { findMany: jest.Mock };
    };

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.person.findMany).not.toHaveBeenCalled();

    await moduleRef.close();
  });

  // Negative (c): 두 번 get 해도 같은 싱글턴 — provider 가 중복 등록되지 않았다.
  it("negative: 두 번 resolve 해도 같은 싱글턴 인스턴스다 (중복 등록 0)", async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(ImportRestoreService)).toBe(
      moduleRef.get(ImportRestoreService),
    );

    await moduleRef.close();
  });

  // Negative (d): ImportModule 을 import 하는 외부 module 에서도 resolve 된다 — exports 누락
  // 검증 (providers 에만 있으면 여기서 실패). 기존 등록 2 종도 함께 살아있는지 확인한다.
  it("negative: ImportModule 을 import 하는 외부 module 에서도 resolve 된다 (exports 누락 검증)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RestoreConsumerModule],
    }).compile();

    expect(moduleRef.get(ImportRestoreService)).toBeInstanceOf(
      ImportRestoreService,
    );
    expect(moduleRef.get(ImportRestoreTransactionService)).toBeInstanceOf(
      ImportRestoreTransactionService,
    );
    expect(moduleRef.get(ImportJobService)).toBeInstanceOf(ImportJobService);

    await moduleRef.close();
  });
});

// T-1285 (실행 slice 3c-3b) — ImportJobRunnerService 의 DI 등록 한 겹. 3c-1 / 3c-2c describe 와
// 동형으로 "등록됐는가 · dep 그래프가 닫히는가 · 등록만으로 부수효과가 없는가" 만 본다
// (runner 자체 동작은 import-job-runner.service.spec.ts 책임). 본 commit 후에도 runJob 의
// production 호출처는 0 이라 런타임 동작 변화는 0 이다.
describe("ImportModule — ImportJobRunnerService 등록 (3c-3b)", () => {
  // Happy path (a): compile 하면 신규 runner provider 가 정상 resolve 된다.
  it("compile 시 ImportJobRunnerService provider 가 resolve 된다", async () => {
    const moduleRef = await compile();

    const service = moduleRef.get(ImportJobRunnerService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(ImportJobRunnerService);

    await moduleRef.close();
  });

  // Happy path (b): dep 그래프가 실제로 닫힌다 — 공개 method 가 노출되고, 주입된 2 종
  // (ImportJobService · ImportRestoreService) 이 같은 container 의 인스턴스와 동일하다.
  it("resolve 된 인스턴스가 runJob 을 노출하고 같은 container 의 job / restore service 를 주입받는다", async () => {
    const moduleRef = await compile();
    const service = moduleRef.get(ImportJobRunnerService);
    const injected = service as unknown as {
      jobs: ImportJobService;
      restore: ImportRestoreService;
    };

    expect(typeof service.runJob).toBe("function");
    expect(injected.jobs).toBe(moduleRef.get(ImportJobService));
    expect(injected.restore).toBe(moduleRef.get(ImportRestoreService));

    await moduleRef.close();
  });

  // Error path: 공급자 없이 ImportJobRunnerService 만 등록하면 DI 가 **조용히 통과하지 않고**
  // reject 한다. ImportModule 통째 compile 대신 최소 module 로 좁힌 이유는 3c-1 / 3c-2c
  // describe 와 동일 (PersistenceModule 을 뺀 full-graph compile 은 jest worker 를 crash 시킨다).
  it("공급자 없이 ImportJobRunnerService 를 등록하면 compile 이 실패한다 (DI 실패가 조용히 통과하지 않음)", async () => {
    const build = Test.createTestingModule({
      providers: [ImportJobRunnerService],
    }).compile();

    await expect(build).rejects.toThrow(/ImportJobService/);
  });

  // 분기 (c): 신규 provider 를 sentinel 로 override 해도 compile — 등록 토큰이 override 가능한
  // 정상 provider 임의 검증 (후속 3c-3c controller spec 이 같은 방식으로 runner 를 대체한다).
  it("ImportJobRunnerService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "import-job-runner-override" };
    const moduleRef = await Test.createTestingModule({
      imports: [PersistenceModule, ImportModule],
    })
      .overrideProvider(ImportJobRunnerService)
      .useValue(sentinel)
      .compile();

    expect(moduleRef.get(ImportJobRunnerService)).toBe(sentinel);

    await moduleRef.close();
  });

  // 분기 (b) / negative (d): ImportModule 을 import 하는 외부 module 에서도 resolve 된다 —
  // exports 누락 검증 (providers 에만 있으면 여기서 실패). 기존 등록 4 종도 함께 살아있는지
  // 확인해 신규 등록이 기존 배선을 깨지 않음을 같은 compile 안에서 단언한다.
  it("negative: 외부 module 에서도 resolve 되고 기존 등록 4 종이 모두 살아있다 (exports 누락 검증)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RestoreConsumerModule],
    }).compile();

    expect(moduleRef.get(ImportJobRunnerService)).toBeInstanceOf(
      ImportJobRunnerService,
    );
    expect(moduleRef.get(ImportJobService)).toBeInstanceOf(ImportJobService);
    expect(moduleRef.get(ImportRestoreTransactionService)).toBeInstanceOf(
      ImportRestoreTransactionService,
    );
    expect(moduleRef.get(ImportRestoreService)).toBeInstanceOf(
      ImportRestoreService,
    );
    expect(moduleRef.get(ImportController)).toBeInstanceOf(ImportController);

    await moduleRef.close();
  });

  // Negative (a) + (b) + (e): 등록은 부수효과를 만들지 않는다 — compile · close 만으로
  // $transaction · DB read (person.findMany) · job 전이 write (importJob.update) 가 모두 0 회다.
  it("negative: compile · close 만으로 $transaction · DB read · job 전이 write 가 0 회다", async () => {
    const moduleRef = await compile();
    const prisma = moduleRef.get(PrismaService) as unknown as {
      $transaction: jest.Mock;
      person: { findMany: jest.Mock };
      importJob: { update: jest.Mock };
    };

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.person.findMany).not.toHaveBeenCalled();
    expect(prisma.importJob.update).not.toHaveBeenCalled();

    // Negative (f): 등록이 teardown 을 막지 않는다 — close 가 정상 resolve 되고, 그 후에도
    // 위 3 종 surface 호출은 여전히 0 이다.
    await expect(moduleRef.close()).resolves.toBeUndefined();
    expect(prisma.importJob.update).not.toHaveBeenCalled();
  });

  // Negative (c): 두 번 get 해도 같은 싱글턴 — provider 가 중복 등록되지 않았다.
  it("negative: 두 번 resolve 해도 같은 싱글턴 인스턴스다 (중복 등록 0)", async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(ImportJobRunnerService)).toBe(
      moduleRef.get(ImportJobRunnerService),
    );

    await moduleRef.close();
  });
});
