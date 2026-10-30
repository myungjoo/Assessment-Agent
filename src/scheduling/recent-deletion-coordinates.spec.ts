import {
  buildClosedDaysWindow,
  planRecentRefresh,
  type StoredCoordinate,
} from "./recent-deletion-coordinates";

// 2026-06-11(목) 12:00 KST. 이번 주 월요일 = 06-08, 이번 달 1 일 = 06-01.
const NOW = new Date("2026-06-11T03:00:00Z");
const kstMidnight = (date: string): Date => new Date(`${date}T00:00:00+09:00`);
const stored = (
  period: string,
  date: string,
  scope = "aggregate",
): StoredCoordinate => ({ period, scope, periodStart: kstMidnight(date) });

const plan = (days: number, rows: StoredCoordinate[] = []) =>
  planRecentRefresh("p1", rows, buildClosedDaysWindow(NOW, days), NOW);

const keys = (result: ReturnType<typeof plan>): string[] =>
  result.coordinates.map(
    (c) => `${c.period}:${c.scope}:${c.periodStart.toISOString()}`,
  );

describe("buildClosedDaysWindow", () => {
  it("days=1 은 어제 KST 하루이고 오늘을 포함하지 않는다", () => {
    expect(buildClosedDaysWindow(NOW, 1)).toEqual({
      start: kstMidnight("2026-06-10"),
      end: kstMidnight("2026-06-11"),
    });
  });

  it("KST 자정 직후에도 끝난 전날이 창의 마지막 날이다", () => {
    const justAfterMidnight = kstMidnight("2026-06-11");
    expect(buildClosedDaysWindow(justAfterMidnight, 2)).toEqual({
      start: kstMidnight("2026-06-09"),
      end: kstMidnight("2026-06-11"),
    });
  });

  it.each([0, -1, 1.5, 367])("days=%s 는 RangeError 다_n", (days) => {
    expect(() => buildClosedDaysWindow(NOW, days)).toThrow(RangeError);
  });

  it("Invalid Date 는 TypeError 다_n", () => {
    expect(() => buildClosedDaysWindow(new Date("x"), 1)).toThrow(TypeError);
  });
});

describe("planRecentRefresh", () => {
  it("저장본이 없어도 창 안의 닫힌 일 좌표를 모두 계획한다", () => {
    const result = plan(2);
    expect(result.openRowCount).toBe(0);
    expect(result.coordinates).toEqual([
      {
        personId: "p1",
        period: "day",
        scope: "aggregate",
        periodStart: kstMidnight("2026-06-09"),
        hadRow: false,
      },
      {
        personId: "p1",
        period: "day",
        scope: "aggregate",
        periodStart: kstMidnight("2026-06-10"),
        hadRow: false,
      },
    ]);
  });

  it("창 안에서 시작해 끝난 주 · 월만 계획하고, 시작이 창 밖이면 제외한다", () => {
    // 창 = 06-01 ~ 06-10. 06-01(월)에 시작한 주는 닫혔고, 06-08 주와 6 월은 진행 중이다.
    expect(keys(plan(10))).toContain(
      `week:aggregate:${kstMidnight("2026-06-01").toISOString()}`,
    );
    expect(keys(plan(10))).not.toContain(
      `week:aggregate:${kstMidnight("2026-06-08").toISOString()}`,
    );
    expect(keys(plan(10))).not.toContain(
      `month:aggregate:${kstMidnight("2026-06-01").toISOString()}`,
    );
    // 창 = 06-05 ~ 06-10. 06-01 주는 시작이 창 밖이다.
    expect(keys(plan(6)).filter((k) => k.startsWith("week"))).toEqual([]);
  });

  it("창 안에서 시작해 끝난 월을 계획한다", () => {
    const monthKeys = keys(plan(30)).filter((k) => k.startsWith("month"));
    // 창 시작 05-12 이후 시작한 달은 진행 중인 6 월뿐이다.
    expect(monthKeys).toEqual([]);
    expect(keys(plan(45)).filter((k) => k.startsWith("month"))).toEqual([
      `month:aggregate:${kstMidnight("2026-05-01").toISOString()}`,
    ]);
  });

  it("저장본이 있는 좌표는 hadRow 로 표시하고 중복 계획하지 않는다", () => {
    const result = plan(1, [stored("day", "2026-06-10")]);
    expect(result.coordinates).toHaveLength(1);
    expect(result.coordinates[0].hadRow).toBe(true);
  });

  it("aggregate 가 아닌 저장본은 그 scope 그대로 교체 대상이다", () => {
    const result = plan(1, [stored("day", "2026-06-10", "commit")]);
    expect(keys(result)).toEqual([
      `day:aggregate:${kstMidnight("2026-06-10").toISOString()}`,
      `day:commit:${kstMidnight("2026-06-10").toISOString()}`,
    ]);
  });

  it("창 시작 직전 · 창 끝(오늘) 저장본은 계획에 없다_n", () => {
    const result = plan(1, [
      stored("day", "2026-06-09"),
      stored("day", "2026-06-11"),
    ]);
    expect(result.openRowCount).toBe(0);
    expect(result.coordinates.map((c) => c.hadRow)).toEqual([false]);
  });

  it("창 안이지만 진행 중인 기간의 저장본은 세기만 하고 건드리지 않는다_n", () => {
    const result = plan(4, [stored("week", "2026-06-08")]);
    expect(result.openRowCount).toBe(1);
    expect(result.coordinates.every((c) => c.period === "day")).toBe(true);
  });

  it("알 수 없는 period 저장본은 RangeError 다_n", () => {
    expect(() => plan(1, [stored("year", "2026-06-10")])).toThrow(RangeError);
  });
});
