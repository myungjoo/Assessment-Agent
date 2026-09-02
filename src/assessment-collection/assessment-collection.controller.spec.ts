// AssessmentCollectionController unit test — CollectionTriggerService 를 jest mock 으로
// 주입해 controller 의 위임(delegation)만 검증한다(ADR-0031 §5 — RBAC/ValidationPipe 통합은
// #4 e2e[supertest]가 cover). AssessmentController.spec 의 unit 부분 mirror.
import { ConflictException, NotFoundException } from "@nestjs/common";

import type { RunStatusService } from "../run-status/run-status.service";

import { AssessmentCollectionController } from "./assessment-collection.controller";
import { CollectionTriggerService } from "./collection-trigger.service";
import type { CollectionTriggerSummary } from "./collection-trigger.service";
import { CollectTriggerDto } from "./dto/collect-trigger.dto";

const dto: CollectTriggerDto = {
  personId: "person-1",
  period: "week",
  scope: "commit",
  periodStart: "2026-06-01T00:00:00.000Z",
};

// makeSummary — 위임 반환으로 쓰는 CollectionTriggerSummary 고정 fixture.
function makeSummary(
  overrides: Partial<CollectionTriggerSummary> = {},
): CollectionTriggerSummary {
  return {
    assessmentId: "assess-1",
    personId: "person-1",
    since: "2026-05-01T00:00:00.000Z",
    period: "week",
    scope: "commit",
    periodStart: "2026-06-01T00:00:00.000Z",
    contributionCount: 3,
    ...overrides,
  };
}

// makeController — triggerCollection mock + RunStatusService mock 을 주입한 controller
// 와 그 spy 3 종을 반환한다. runStatus 는 실 카운터가 아니라 관측 mock 이라 test 는
// 프로세스 상태를 오염시키지 않고 begin/end 전이 계약만 검증한다(T-1845, ADR-0060
// §Decision 4). ctor param 순서는 (triggerService, runStatus) — 위치 인자 그대로.
function makeController(triggerImpl: () => Promise<CollectionTriggerSummary>): {
  controller: AssessmentCollectionController;
  triggerSpy: jest.Mock;
  beginSpy: jest.Mock;
  endSpy: jest.Mock;
} {
  const triggerSpy = jest.fn(triggerImpl);
  const triggerService = {
    triggerCollection: triggerSpy,
  } as unknown as CollectionTriggerService;
  const beginSpy = jest.fn();
  const endSpy = jest.fn();
  const runStatus = {
    begin: beginSpy,
    end: endSpy,
  } as unknown as RunStatusService;
  return {
    controller: new AssessmentCollectionController(triggerService, runStatus),
    triggerSpy,
    beginSpy,
    endSpy,
  };
}

describe("AssessmentCollectionController", () => {
  it("collect() 가 triggerCollection 에 dto 그대로 위임하고 summary 를 반환한다 (happy)", async () => {
    const summary: CollectionTriggerSummary = {
      assessmentId: "assess-1",
      personId: "person-1",
      since: "2026-05-01T00:00:00.000Z",
      period: "week",
      scope: "commit",
      periodStart: "2026-06-01T00:00:00.000Z",
      contributionCount: 3,
    };
    const { controller, triggerSpy } = makeController(async () => summary);

    const result = await controller.collect(dto);

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith(dto);
    expect(result).toBe(summary);
  });

  it("triggerCollection 이 NotFoundException(Person 부재) reject 시 그대로 전파한다 (negative)", async () => {
    const { controller } = makeController(async () => {
      throw new NotFoundException("person not found: person-1");
    });

    await expect(controller.collect(dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("triggerCollection 이 ConflictException(동일 경계 P2002) reject 시 그대로 전파한다 (negative)", async () => {
    const { controller } = makeController(async () => {
      throw new ConflictException("assessment already exists");
    });

    await expect(controller.collect(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

// T-1845 — POST /collect 의 RunStatus 배선 spec (ADR-0060 §Follow-ups (c) 수집 축).
// 본 handler 는 조건 분기가 0 이다(위임 1 줄). 그래서 "분기 cover" 는 if/else 갈래가
// 아니라 **성공 종료 경로 / 실패 종료 경로** 두 종료 갈래에서 각각 begin·end 짝이
// 성립함을 고정하는 것으로 대신한다 — 그 두 경로가 이 handler 가 가진 제어 흐름의
// 전부이며, finally 의 존재 이유이기도 하다.
describe("AssessmentCollectionController.collect (unit — RunStatus 실행 상태 전이, ADR-0060 §Decision 4)", () => {
  // happy (1) — begin/end 각 1 회 + 위임 인자·반환 참조가 카운터 배선에 가공되지 않음.
  it("정상 경로에서 begin/end 가 각각 collection 축으로 1 회 호출되고 위임 인자·반환 참조가 보존된다 (happy)", async () => {
    const summary = makeSummary();
    const { controller, triggerSpy, beginSpy, endSpy } = makeController(
      async () => summary,
    );

    const result = await controller.collect(dto);

    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(beginSpy).toHaveBeenCalledWith("collection");
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith("collection");
    // 위임 인자 보존 — dto 를 그대로(동일 참조) 넘긴다.
    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith(dto);
    expect(triggerSpy.mock.calls[0][0]).toBe(dto);
    // 반환 가공 0 — service 반환과 동일 참조.
    expect(result).toBe(summary);
  });

  // happy (2) — 반복 호출해도 매 호출이 1:1 균형을 이룬다(누적 오염 0 — 두 번째 호출
  // 후 begin·end 는 각각 2 회이고 반환도 호출별로 구분된다).
  it("연속 2 회 호출에서도 begin·end 가 호출마다 1 회씩 균형을 이룬다 (happy — 누적 오염 0)", async () => {
    const first = makeSummary({ assessmentId: "assess-1" });
    const second = makeSummary({ assessmentId: "assess-2" });
    const summaries = [first, second];
    const { controller, triggerSpy, beginSpy, endSpy } = makeController(
      async () => summaries.shift() as CollectionTriggerSummary,
    );

    expect(await controller.collect(dto)).toBe(first);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);

    expect(await controller.collect(dto)).toBe(second);
    expect(triggerSpy).toHaveBeenCalledTimes(2);
    expect(beginSpy).toHaveBeenCalledTimes(2);
    expect(endSpy).toHaveBeenCalledTimes(2);
    expect(beginSpy.mock.calls.every((call) => call[0] === "collection")).toBe(
      true,
    );
  });

  // error path (1) — NotFoundException(Person 부재) raw 전파 + end 1 회.
  it("위임이 NotFoundException 으로 reject 해도 예외가 raw 전파되고 end 가 1 회 호출된다 (error path)", async () => {
    const boom = new NotFoundException("person not found: person-1");
    const { controller, beginSpy, endSpy } = makeController(async () => {
      throw boom;
    });

    const rejection: unknown = await controller
      .collect(dto)
      .catch((error: unknown) => error);

    // raw 전파 — 감싸지 않은 동일 인스턴스.
    expect(rejection).toBe(boom);
    expect(rejection).toBeInstanceOf(NotFoundException);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith("collection");
  });

  // error path (2) — ConflictException(동일 경계 P2002) raw 전파 + end 1 회.
  it("위임이 ConflictException 으로 reject 해도 예외가 raw 전파되고 end 가 1 회 호출된다 (error path)", async () => {
    const boom = new ConflictException("assessment already exists");
    const { controller, beginSpy, endSpy } = makeController(async () => {
      throw boom;
    });

    const rejection: unknown = await controller
      .collect(dto)
      .catch((error: unknown) => error);

    expect(rejection).toBe(boom);
    expect(rejection).toBeInstanceOf(ConflictException);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith("collection");
  });

  // error path (3) — HttpException 이 아닌 일반 Error(예상 못 한 실패)에서도 감소 보장.
  it("위임이 일반 Error 로 reject 해도 예외가 raw 전파되고 end 가 1 회 호출된다 (error path — 비 HttpException)", async () => {
    const boom = new TypeError("orchestrator 폭발");
    const { controller, beginSpy, endSpy } = makeController(async () => {
      throw boom;
    });

    const rejection: unknown = await controller
      .collect(dto)
      .catch((error: unknown) => error);

    expect(rejection).toBe(boom);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  // 분기 cover — 위 주석대로 조건 분기가 없으므로 **성공/실패 두 종료 경로**를 한
  // test 안에서 나란히 고정해 finally 가 양쪽 갈래를 모두 덮는다는 사실을 박제한다.
  it("성공 종료 경로와 실패 종료 경로 각각에서 begin·end 가 1 회씩 짝을 이룬다 (branch — 두 종료 갈래)", async () => {
    const success = makeController(async () => makeSummary());
    await success.controller.collect(dto);
    expect(success.beginSpy).toHaveBeenCalledTimes(1);
    expect(success.endSpy).toHaveBeenCalledTimes(1);

    const failure = makeController(async () => {
      throw new ConflictException("동일 경계 중복");
    });
    await expect(failure.controller.collect(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(failure.beginSpy).toHaveBeenCalledTimes(1);
    expect(failure.endSpy).toHaveBeenCalledTimes(1);
  });

  // negative (1) — 축 격리. 수집 실행이 evaluation 축 카운터를 건드리면 평가 배너가
  // 거짓 양성으로 켜진다.
  it("성공·실패 어느 경로에서도 evaluation 축은 begin·end 되지 않는다 (negative — 축 격리)", async () => {
    const ok = makeController(async () => makeSummary());
    await ok.controller.collect(dto);

    const failed = makeController(async () => {
      throw new NotFoundException("person not found");
    });
    await expect(failed.controller.collect(dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    for (const spy of [
      ok.beginSpy,
      ok.endSpy,
      failed.beginSpy,
      failed.endSpy,
    ]) {
      // 모든 호출의 axis 인자가 collection 하나뿐 — evaluation 은 0 회.
      expect(spy.mock.calls.every((call) => call[0] === "collection")).toBe(
        true,
      );
      expect(spy).not.toHaveBeenCalledWith("evaluation");
    }
  });

  // negative (2) — 중복 begin 0. begin 이 2 회 이상이면 동시 N 건 카운터가 영구 오염되고
  // 배너가 실행 종료 후에도 꺼지지 않는다.
  it("한 번의 collect() 호출이 begin 을 2 회 이상 부르지 않는다 (negative — 카운터 오염 차단)", async () => {
    const { controller, beginSpy, endSpy } = makeController(async () =>
      makeSummary(),
    );

    await controller.collect(dto);

    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  // negative (3) — 순서 불변식. begin 은 위임보다 먼저, end 는 위임보다 나중이어야
  // "실행 중" 구간이 실제 실행 구간을 덮는다.
  it("begin 이 triggerCollection 보다 먼저, end 가 그보다 나중에 호출된다 (negative — 순서 불변식)", async () => {
    const { controller, triggerSpy, beginSpy, endSpy } = makeController(
      async () => makeSummary(),
    );

    await controller.collect(dto);

    const beginOrder = beginSpy.mock.invocationCallOrder[0];
    const triggerOrder = triggerSpy.mock.invocationCallOrder[0];
    const endOrder = endSpy.mock.invocationCallOrder[0];
    expect(beginOrder).toBeLessThan(triggerOrder);
    expect(endOrder).toBeGreaterThan(triggerOrder);
  });

  // negative (4) — begin 선행. 위임 mock 안에서 관측한 시점에 이미 begin 됐고 end 는
  // 아직 아니다(위임 실행 구간이 "실행 중" 구간 안에 완전히 포함된다).
  it("위임 mock 실행 시점에 begin 은 이미 1 회, end 는 아직 0 회다 (negative — begin 선행)", async () => {
    let observedBegin = -1;
    let observedEnd = -1;
    const holder: { beginSpy?: jest.Mock; endSpy?: jest.Mock } = {};
    const made = makeController(async () => {
      observedBegin = holder.beginSpy?.mock.calls.length ?? -1;
      observedEnd = holder.endSpy?.mock.calls.length ?? -1;
      return makeSummary();
    });
    holder.beginSpy = made.beginSpy;
    holder.endSpy = made.endSpy;

    await made.controller.collect(dto);

    expect(observedBegin).toBe(1);
    expect(observedEnd).toBe(0);
    expect(made.endSpy).toHaveBeenCalledTimes(1);
  });

  // negative (5) — 위임이 promise 를 만들기도 전에 **동기 throw** 하는 비정상 시퀀스.
  // try 안의 호출이므로 finally 가 돌아 end 가 1 회 호출돼야 한다(카운터 stuck 차단).
  it("위임이 동기 throw 해도 end 가 1 회 호출되고 예외가 raw 전파된다 (negative — 동기 throw)", async () => {
    const boom = new Error("동기 폭발");
    const { controller, beginSpy, endSpy } = makeController((): never => {
      throw boom;
    });

    const rejection: unknown = await controller
      .collect(dto)
      .catch((error: unknown) => error);

    expect(rejection).toBe(boom);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith("collection");
  });

  // negative (6) — 조기 감소 회귀 방지. `return await` 없이 promise 를 그대로 반환하면
  // 위임이 해소되기 전에 finally 가 돌아 "실행 중" 구간이 사실상 0 이 된다. 미해소
  // promise 를 물려 그 시점에 end 가 아직 호출되지 않았음을 고정한다.
  it("위임 promise 가 해소되기 전에는 end 가 호출되지 않는다 (negative — 조기 감소 회귀 방지)", async () => {
    const summary = makeSummary();
    let settle!: (value: CollectionTriggerSummary) => void;
    const pending = new Promise<CollectionTriggerSummary>((resolve) => {
      settle = resolve;
    });
    const { controller, beginSpy, endSpy } = makeController(() => pending);

    const inFlight = controller.collect(dto);
    // microtask 를 한 바퀴 돌려도 위임이 미해소인 동안에는 end 가 오지 않는다.
    await Promise.resolve();
    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).not.toHaveBeenCalled();

    settle(summary);
    await expect(inFlight).resolves.toBe(summary);
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith("collection");
  });
});
