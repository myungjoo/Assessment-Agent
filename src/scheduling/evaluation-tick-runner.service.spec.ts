import { Logger } from "@nestjs/common";

import { EvaluationTickRunnerService } from "./evaluation-tick-runner.service";

const utc = (monthDay: string) => new Date(`2026-${monthDay}T15:00:00.000Z`);
const NOW = new Date("2026-10-30T03:00:00Z"); // KST 2026-10-30(금) 12:00
const [DAY, WEEK, MONTH] = [utc("10-22"), utc("10-18"), utc("08-31")];
const gap = (periodStart: Date, period = "day", personId = "p1") => ({
  personId,
  period,
  scope: "aggregate",
  periodStart,
});

function setup() {
  const deps = {
    resolver: { resolveDefaultModelId: jest.fn().mockResolvedValue("m") },
    persons: {
      findActive: jest.fn().mockResolvedValue([{ id: "p1" }, { id: "p2" }]),
      findByIdWithIdentities: jest.fn().mockResolvedValue({ id: "person" }),
    },
    planner: {
      planUnevaluatedFill: jest.fn().mockResolvedValue({ batches: [] }),
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
  const planOnce = (personId: string, ...periods: unknown[]): void => {
    deps.planner.planUnevaluatedFill.mockResolvedValueOnce({
      batches: [{ personId, periods }],
    });
  };
  return { runner, planOnce, ...deps };
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

  it("축별 gap 을 합쳐 각자 경계의 since · until 로 fill 평가한다", async () => {
    const { runner, planOnce, persist, status } = setup();
    const coordinates = [gap(DAY), gap(WEEK, "week"), gap(MONTH, "month")];
    coordinates.forEach((coordinate) => planOnce("p1", coordinate));
    await runner.run();
    const calls = persist.generateAndPersist.mock.calls;
    expect(calls.map(([, period]) => period)).toEqual([
      { since: DAY.toJSON(), until: utc("10-23").toJSON() },
      { since: WEEK.toJSON(), until: utc("10-25").toJSON() },
      { since: MONTH.toJSON(), until: utc("09-30").toJSON() },
    ]);
    expect(calls.map(([, , , context]) => context)).toEqual(coordinates);
    expect(calls[0][2]).toEqual({ modelId: "m" });
    expect(status.begin).toHaveBeenCalledWith("evaluation");
    expect(status.end).toHaveBeenCalledWith("evaluation");
    summary(3, 0);
  });

  it.each([
    ["평일 낮", NOW, "10-22 10-29 10-18 10-25 08-31 09-30"],
    ["주 전환", utc("11-01"), "10-25 11-01 10-25 11-01 09-30 10-31"],
    ["월 · 연 전환", utc("12-31"), "12-24 12-31 12-20 12-27 11-30 12-31"],
  ])("%s 에는 닫힌 기간만 계획한다", async (_label, now, expected) => {
    jest.setSystemTime(now);
    const { runner, planner } = setup();
    await runner.run();
    const inputs = planner.planUnevaluatedFill.mock.calls.map(([i]) => i);
    expect(inputs.map((i) => i.period)).toEqual(["day", "week", "month"]);
    expect(inputs.every((i) => i.scope === "aggregate")).toBe(true);
    expect(inputs[0].personIds).toEqual(["p1", "p2"]);
    expect(
      inputs.flatMap((i) => [i.rangeStart.toJSON(), i.rangeEnd.toJSON()]),
    ).toEqual(expected.split(" ").map((d) => utc(d).toJSON()));
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
    const { runner, planOnce, persist } = setup();
    planOnce("p1", gap(DAY), gap(utc("10-23")));
    persist.generateAndPersist.mockRejectedValueOnce("llm down");
    await runner.run();
    expect(persist.generateAndPersist).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("llm down"));
    summary(1, 1);
  });

  it("한 인원 조회 실패 · 한 축 계획 실패는 나머지를 막지 않는다_n", async () => {
    const { runner, planner, persons, persist } = setup();
    planner.planUnevaluatedFill
      .mockRejectedValueOnce(new Error("db"))
      .mockResolvedValueOnce({
        batches: [
          { personId: "p1", periods: [gap(WEEK, "week"), gap(MONTH, "month")] },
          { personId: "p2", periods: [gap(WEEK, "week", "p2")] },
        ],
      });
    persons.findByIdWithIdentities.mockRejectedValueOnce(new Error("gone"));
    await expect(runner.run()).resolves.toBeUndefined();
    expect(persist.generateAndPersist).toHaveBeenCalledTimes(1);
    summary(1, 3);
  });
});
