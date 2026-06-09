// period-evaluable.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). `isPeriodEvaluable` / `computePeriodEnd` /
// `isValidPeriod` 시점 판정 순수 함수의 `now ≥ periodEnd` 반열림 경계 + day/week/month
// periodEnd 산술(month 가변 일수 포함)을 검증한다. LLM 0 / DB 0 / `now` 주입(순수
// 함수). `evaluation-result.persist.mapper.spec.ts` 의 describe/it + R-112 형식 mirror.

import {
  computePeriodEnd,
  isPeriodEvaluable,
  isValidPeriod,
} from "./period-evaluable";

// ISO 문자열 → Date 헬퍼(가독성).
function at(iso: string): Date {
  return new Date(iso);
}

describe("isValidPeriod (R-112 — granularity 멤버십)", () => {
  it.each(["day", "week", "month"])("허용 period %p 는 true", (p) => {
    expect(isValidPeriod(p)).toBe(true);
  });

  it.each(["", "DAY", "year", "hour", "weekly", "1"])(
    "알 수 없는 period %p 는 false",
    (p) => {
      expect(isValidPeriod(p)).toBe(false);
    },
  );
});

describe("computePeriodEnd (R-112 — periodEnd 산술)", () => {
  describe("happy path + branch cover (R-112-1/3 — day/week/month 각 +1 granularity)", () => {
    it("day: periodStart + 1 일(다음 날 자정)", () => {
      const end = computePeriodEnd("day", at("2026-06-08T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-09T00:00:00.000Z");
    });

    it("week: periodStart + 7 일", () => {
      const end = computePeriodEnd("week", at("2026-06-01T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-08T00:00:00.000Z");
    });

    it("month: periodStart + 1 달력 month (월초 → 다음 월초)", () => {
      const end = computePeriodEnd("month", at("2026-06-01T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    });
  });

  describe("month 가변 일수 정확성 (R-112-3 — 28~31 일)", () => {
    it("1 월초 + 1month = 2 월초 (1 월 31 일)", () => {
      const end = computePeriodEnd("month", at("2026-01-01T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });

    it("2 월초 + 1month = 3 월초 (2 월 28 일, 평년)", () => {
      const end = computePeriodEnd("month", at("2026-02-01T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    });

    it("2 월초 + 1month = 3 월초 (2 월 29 일, 윤년 2024)", () => {
      const end = computePeriodEnd("month", at("2024-02-01T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    });

    it("12 월초 + 1month = 다음 해 1 월초 (연도 rollover)", () => {
      const end = computePeriodEnd("month", at("2026-12-01T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });
  });

  describe("순수성 — 입력 invariance (R-112-2)", () => {
    it("periodStart Date 를 mutate 하지 않는다", () => {
      const periodStart = at("2026-06-08T00:00:00.000Z");
      const snapshot = periodStart.getTime();
      computePeriodEnd("day", periodStart);
      expect(periodStart.getTime()).toBe(snapshot);
    });

    it("동일 입력에 동일 출력 (referential transparency)", () => {
      const periodStart = at("2026-06-08T00:00:00.000Z");
      expect(computePeriodEnd("week", periodStart).getTime()).toBe(
        computePeriodEnd("week", periodStart).getTime(),
      );
    });
  });

  describe("error path — 알 수 없는 period (R-112-2)", () => {
    it.each(["", "year", "hour", "DAY", "weekly"])(
      "알 수 없는 period %p 는 throw 한다",
      (bad) => {
        expect(() =>
          computePeriodEnd(bad, at("2026-06-08T00:00:00.000Z")),
        ).toThrow(/알 수 없는 period/);
      },
    );
  });
});

describe("isPeriodEvaluable (R-112 — now ≥ periodEnd 시점 판정)", () => {
  // day 구간 [2026-06-08T00:00Z, 2026-06-09T00:00Z) 를 기준으로 경계를 검증한다.
  const dayStart = at("2026-06-08T00:00:00.000Z");
  const dayEnd = at("2026-06-09T00:00:00.000Z");

  describe("happy path — 완전히 종료된 구간 (R-112-1, day/week/month 각 1+)", () => {
    it("day: now 가 periodEnd 이후면 true", () => {
      expect(
        isPeriodEvaluable("day", dayStart, at("2026-06-09T00:00:00.001Z")),
      ).toBe(true);
    });

    it("week: now 가 periodEnd 이후면 true", () => {
      // 구간 [06-01, 06-08) — 06-10 은 종료 후.
      expect(
        isPeriodEvaluable(
          "week",
          at("2026-06-01T00:00:00.000Z"),
          at("2026-06-10T00:00:00.000Z"),
        ),
      ).toBe(true);
    });

    it("month: now 가 periodEnd 이후면 true", () => {
      // 구간 [06-01, 07-01) — 07-15 는 종료 후.
      expect(
        isPeriodEvaluable(
          "month",
          at("2026-06-01T00:00:00.000Z"),
          at("2026-07-15T00:00:00.000Z"),
        ),
      ).toBe(true);
    });
  });

  describe("경계값 cover (R-112-3 — 반열림 [start,end) 종료 직후)", () => {
    it("now == periodEnd 면 true (종료 직후 평가 허용)", () => {
      expect(isPeriodEvaluable("day", dayStart, dayEnd)).toBe(true);
    });

    it("now == periodEnd - 1ms 면 false (종료 직전 미평가)", () => {
      const justBefore = new Date(dayEnd.getTime() - 1);
      expect(isPeriodEvaluable("day", dayStart, justBefore)).toBe(false);
    });

    it("now == periodEnd + 1ms 면 true", () => {
      const justAfter = new Date(dayEnd.getTime() + 1);
      expect(isPeriodEvaluable("day", dayStart, justAfter)).toBe(true);
    });
  });

  describe("negative cases 충분 cover — 진행 중 구간 (R-112-4)", () => {
    it("now < periodEnd (진행 중 day) 면 false", () => {
      // 같은 날 정오 — 아직 자정 안 지남.
      expect(
        isPeriodEvaluable("day", dayStart, at("2026-06-08T12:00:00.000Z")),
      ).toBe(false);
    });

    it("now == periodStart (구간 시작 순간) 면 false (진행 중)", () => {
      expect(isPeriodEvaluable("day", dayStart, dayStart)).toBe(false);
    });

    it("now < periodEnd (진행 중 week) 면 false", () => {
      // 구간 [06-01, 06-08) — 06-05 는 진행 중.
      expect(
        isPeriodEvaluable(
          "week",
          at("2026-06-01T00:00:00.000Z"),
          at("2026-06-05T00:00:00.000Z"),
        ),
      ).toBe(false);
    });

    it("now < periodEnd (진행 중 month) 면 false", () => {
      // 구간 [06-01, 07-01) — 06-30 23:59:59.999 는 여전히 진행 중.
      expect(
        isPeriodEvaluable(
          "month",
          at("2026-06-01T00:00:00.000Z"),
          at("2026-06-30T23:59:59.999Z"),
        ),
      ).toBe(false);
    });

    it("month 가변 일수 경계: 2 월(28 일) 구간은 3-01 에 평가 가능, 2-28 에는 불가", () => {
      const febStart = at("2026-02-01T00:00:00.000Z");
      // 2-28 23:59 은 아직 2 월 진행 중(periodEnd=3-01).
      expect(
        isPeriodEvaluable("month", febStart, at("2026-02-28T23:59:59.999Z")),
      ).toBe(false);
      // 3-01 00:00 == periodEnd → 평가 가능.
      expect(
        isPeriodEvaluable("month", febStart, at("2026-03-01T00:00:00.000Z")),
      ).toBe(true);
    });

    it("알 수 없는 period 는 throw 한다 (computePeriodEnd 전파)", () => {
      expect(() => isPeriodEvaluable("year", dayStart, dayEnd)).toThrow(
        /알 수 없는 period/,
      );
    });
  });

  describe("순수성 — now 주입·결정성 (R-112-2)", () => {
    it("동일 (period, periodStart, now) 에 동일 boolean (referential transparency)", () => {
      const now = at("2026-06-09T00:00:00.000Z");
      expect(isPeriodEvaluable("day", dayStart, now)).toBe(
        isPeriodEvaluable("day", dayStart, now),
      );
    });
  });
});
