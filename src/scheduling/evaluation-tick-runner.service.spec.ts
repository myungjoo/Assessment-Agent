import { Logger } from "@nestjs/common";

import { EvaluationTickRunnerService } from "./evaluation-tick-runner.service";

const NOW = new Date("2026-10-30T03:00:00Z"); // KST 2026-10-30(금) 12:00
const DAY = new Date("2026-10-22T15:00:00Z"); // KST 10-23 00:00, 7 일 전
const TODAY = new Date("2026-10-29T15:00:00Z"); // KST 10-30 00:00
const gap = (periodStart: Date, period = "day") => ({
  personId: "p1",
  period,
  scope: "aggregate",
  periodStart,
});

function setup(...periods: ReturnType<typeof gap>[]) {
  const person = {
    id: "p1",
    serviceIdentities: [{ service: "github", externalId: "kim" }],
  };
  const deps = {
    resolver: { resolveDefaultModelId: jest.fn().mockResolvedValue("m") },
    persons: {
      findActive: jest.fn().mockResolvedValue([{ id: "p1" }]),
      findByIdWithIdentities: jest.fn().mockResolvedValue(person),
    },
    planner: {
      planUnevaluatedFill: jest
        .fn()
        .mockResolvedValue({ batches: [] })
        .mockResolvedValueOnce({ batches: [{ personId: "p1", periods }] }),
    },
    persist: { generateAndPersist: jest.fn().mockResolvedValue({}) },
    status: { begin: jest.fn(), end: jest.fn() },
  };
  const runner = new EvaluationTickRunnerService(
    deps.resolver as never,
    deps.persons as never,
    deps.planner as never,
    deps.persist as never,
    deps.status as never,
  );
  return { runner, ...deps };
}

describe("EvaluationTickRunnerService", () => {
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  const summary = (e: number, f: number): void =>
    expect(log).toHaveBeenCalledWith(
      `평가 실행 완료: evaluated=${e} failed=${f}`,
    );

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
    log = jest.spyOn(Logger.prototype, "log").mockImplementation();
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    error = jest.spyOn(Logger.prototype, "error").mockImplementation();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("닫힌 기간만 계획하고 gap 은 같은 경계의 since · until 로 fill 평가한다", async () => {
    const { runner, planner, persist, status } = setup(gap(DAY));

    await runner.run();

    const ranges = planner.planUnevaluatedFill.mock.calls.map(([i]) =>
      [i.period, i.scope, i.rangeStart.toJSON(), i.rangeEnd.toJSON()].join(" "),
    );
    expect(ranges).toEqual([
      `day aggregate ${DAY.toJSON()} ${TODAY.toJSON()}`,
      "week aggregate 2026-10-18T15:00:00.000Z 2026-10-25T15:00:00.000Z",
      "month aggregate 2026-08-31T15:00:00.000Z 2026-09-30T15:00:00.000Z",
    ]);
    expect(persist.generateAndPersist).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      { since: DAY.toISOString(), until: "2026-10-23T15:00:00.000Z" },
      { modelId: "m" },
      gap(DAY),
    );
    expect(status.begin).toHaveBeenCalledWith("evaluation");
    expect(status.end).toHaveBeenCalledWith("evaluation");
    summary(1, 0);
  });

  it("실행 중 재호출은 두 번째 실행을 만들지 않고, 끝난 뒤에는 다시 실행된다_n", async () => {
    const { runner, persons } = setup();

    await Promise.all([runner.run(), runner.run()]);
    expect(persons.findActive).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);

    await runner.run();
    expect(persons.findActive).toHaveBeenCalledTimes(2);
  });

  it("modelId 해석 실패 시 작업 없이 멈추고 reject 하지 않는다_n", async () => {
    const { runner, resolver, persons, status } = setup();
    resolver.resolveDefaultModelId.mockRejectedValue(new Error("row 0"));

    await expect(runner.run()).resolves.toBeUndefined();

    expect(persons.findActive).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("평가 실행 중단: row 0");
    expect(status.end).toHaveBeenCalledTimes(1);
  });

  it("활성 인원이 없으면 계획하지 않는다_n", async () => {
    const { runner, persons, planner } = setup();
    persons.findActive.mockResolvedValue([]);

    await runner.run();

    expect(planner.planUnevaluatedFill).not.toHaveBeenCalled();
  });

  it("좌표 실패는 나머지 좌표를 막지 않고 집계된다_n", async () => {
    const { runner, persist } = setup(gap(DAY), gap(TODAY));
    persist.generateAndPersist.mockRejectedValueOnce("llm down");

    await runner.run();

    expect(persist.generateAndPersist).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("llm down"));
    summary(1, 1);
  });

  it("인원 조회 · 계획 실패는 그 범위만 실패로 집계한다_n", async () => {
    const { runner, planner, persons, persist } = setup(gap(DAY), gap(TODAY));
    persons.findByIdWithIdentities.mockRejectedValueOnce(new Error("gone"));
    planner.planUnevaluatedFill
      .mockResolvedValueOnce({ batches: [] })
      .mockRejectedValueOnce(new Error("db"));

    await expect(runner.run()).resolves.toBeUndefined();

    expect(persist.generateAndPersist).not.toHaveBeenCalled();
    summary(0, 3);
  });
});
