// RunStatusModule spec — T-1841 acceptance (provider 미등록 · export 누락 회귀 차단).

import {
  Injectable,
  Module,
  type INestApplicationContext,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";

import { RunStatusModule } from "./run-status.module";
import { RunStatusService } from "./run-status.service";

describe("RunStatusModule", () => {
  // Happy path: module compile 시 RunStatusService 가 resolve 된다.
  it("compile 시 RunStatusService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RunStatusModule],
    }).compile();

    const service = moduleRef.get(RunStatusService);
    expect(service).toBeInstanceOf(RunStatusService);
    expect(service.snapshot().active).toBe(false);
    await moduleRef.close();
  });

  // Branch: 같은 module 을 두 번 참조해도 provider 는 singleton 이다.
  it("RunStatusService 는 module scope 안에서 singleton 이다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RunStatusModule],
    }).compile();

    const first = moduleRef.get(RunStatusService);
    const second = moduleRef.get(RunStatusService);
    first.begin("evaluation");
    expect(second).toBe(first);
    expect(second.snapshot().evaluation.runningCount).toBe(1);
    await moduleRef.close();
  });

  // Negative: export 가 빠지면 import 한 외부 module 의 ctor 주입이 실패한다 — 그 회귀를 차단.
  // (후속 slice (a2) 가 AssessmentEvaluationModule 에서 하려는 것과 같은 배선 형태.)
  it("RunStatusModule 을 import 한 외부 module 의 provider 가 ctor 로 주입받는다", async () => {
    @Injectable()
    class ConsumerService {
      constructor(readonly runStatus: RunStatusService) {}
    }

    @Module({ imports: [RunStatusModule], providers: [ConsumerService] })
    class ConsumerModule {}

    const context: INestApplicationContext =
      await NestFactory.createApplicationContext(ConsumerModule, {
        logger: false,
      });

    const consumer = context.get(ConsumerService);
    expect(consumer.runStatus).toBeInstanceOf(RunStatusService);
    expect(consumer.runStatus.snapshot().active).toBe(false);
    await context.close();
  });

  // Negative: provider override 가 가능해야 후속 slice 의 controller spec 이 mock 을 끼울 수 있다.
  it("RunStatusService provider 를 mock 으로 override 해도 compile 한다", async () => {
    const sentinel = { snapshot: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RunStatusModule],
    })
      .overrideProvider(RunStatusService)
      .useValue(sentinel)
      .compile();

    expect(moduleRef.get(RunStatusService)).toBe(sentinel);
    await moduleRef.close();
  });
});
