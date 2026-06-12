// period-evaluable.ts 의 colocated unit test (CLAUDE.md §3.2 R-112 — happy / error /
// branch / negative cases 충분 cover). `isPeriodEvaluable` / `computePeriodEnd` /
// `isValidPeriod` 시점 판정 순수 함수의 `now ≥ periodEnd` 반열림 경계 + day/week/month
// 의 **KST(Asia/Seoul) boundary** 산출(ADR-0039 §Decision 3 — period-boundary helper
// 경유, T-0357)을 검증한다. LLM 0 / DB 0 / `now` 주입(순수 함수). fixture 시각은 전부
// UTC instant — KST 자정 = 전일 15:00:00Z (예: KST 2026-06-08 00:00 = 06-07T15:00Z).
// 2026-06-01 은 KST 월요일(주간 anchor 정합).

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

  it.each(["", "DAY", "year", "hour", "weekly", "daily", "monthly", "1"])(
    "알 수 없는 period %p 는 false (helper 측 granularity 이름 포함)",
    (p) => {
      expect(isValidPeriod(p)).toBe(false);
    },
  );
});

describe("computePeriodEnd (R-112 — KST periodEnd 산출, helper 경유)", () => {
  describe("happy path + 매핑 분기 cover (R-112-1/3 — day/week/month 각 KST boundary 입력)", () => {
    it("day: KST 자정 입력 → 다음 KST 자정 (06-07T15:00Z = KST 06-08 00:00 → 06-08T15:00Z)", () => {
      const end = computePeriodEnd("day", at("2026-06-07T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-08T15:00:00.000Z");
    });

    it("week: KST 월요일 자정 입력 → 다음 KST 월요일 자정 (05-31T15:00Z = KST 월 06-01 00:00)", () => {
      const end = computePeriodEnd("week", at("2026-05-31T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-07T15:00:00.000Z");
    });

    it("month: KST 월초 자정 입력 → 다음 KST 월초 자정 (KST 6월 → KST 7월 1일 00:00)", () => {
      const end = computePeriodEnd("month", at("2026-05-31T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-30T15:00:00.000Z");
    });
  });

  describe("월말 overflow regression (T-0357 — 옛 setUTCMonth 결함 재발 방지)", () => {
    it("month: KST 6월초(= UTC 5월 말일 15:00Z) 의 end 는 06-30T15:00Z (7월 drift 금지)", () => {
      // 옛 setUTCMonth(+1) 은 5/31 + 1month = "6/31" day overflow → JS 정규화로
      // 2026-07-01T15:00Z (= KST 7월 2일 자정) 을 반환하던 실결함. helper 경유가 차단.
      const end = computePeriodEnd("month", at("2026-05-31T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-30T15:00:00.000Z");
      expect(end.toISOString()).not.toBe("2026-07-01T15:00:00.000Z");
    });

    it("month: KST 2월초(1-31T15:00Z) 도 overflow 없이 2-28T15:00Z (평년 28일)", () => {
      const end = computePeriodEnd("month", at("2026-01-31T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-02-28T15:00:00.000Z");
    });
  });

  describe("month 가변 일수 정확성 (R-112-3 — 28~31 일, KST 달력 기준)", () => {
    it("KST 1월초 + 1month = KST 2월초 (1월 31일)", () => {
      const end = computePeriodEnd("month", at("2025-12-31T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-01-31T15:00:00.000Z");
    });

    it("KST 2월초 + 1month = KST 3월초 (2월 29일, 윤년 2024)", () => {
      const end = computePeriodEnd("month", at("2024-01-31T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2024-02-29T15:00:00.000Z");
    });

    it("KST 12월초 + 1month = 다음 해 KST 1월초 (연도 rollover)", () => {
      const end = computePeriodEnd("month", at("2026-11-30T15:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-12-31T15:00:00.000Z");
    });
  });

  describe("비정규(non-boundary) 입력 snap 의미 (R-112-3 — ADR-0039 §Decision 3 boundary 로 정규화)", () => {
    it("day: UTC 자정 입력(= KST 09:00, 비-boundary) 은 속한 KST 일의 end 로 snap", () => {
      // 2026-06-08T00:00Z = KST 06-08 09:00 → KST 일 구간 [06-07T15:00Z, 06-08T15:00Z).
      const end = computePeriodEnd("day", at("2026-06-08T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-08T15:00:00.000Z");
    });

    it("week: KST 수요일 instant 의 end 는 다음 KST 월요일 자정 (옛 '임의 요일 +7일' 폐기)", () => {
      // 2026-06-03T03:00Z = KST 06-03(수) 12:00 → 주 구간 [05-31T15:00Z, 06-07T15:00Z).
      const end = computePeriodEnd("week", at("2026-06-03T03:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-07T15:00:00.000Z");
    });

    it("month: 월 중간 instant 도 속한 KST 월의 end 로 snap", () => {
      const end = computePeriodEnd("month", at("2026-06-15T00:00:00.000Z"));
      expect(end.toISOString()).toBe("2026-06-30T15:00:00.000Z");
    });
  });

  describe("순수성 — 입력 invariance (R-112-2)", () => {
    it("periodStart Date 를 mutate 하지 않는다", () => {
      const periodStart = at("2026-06-07T15:00:00.000Z");
      const snapshot = periodStart.getTime();
      computePeriodEnd("day", periodStart);
      expect(periodStart.getTime()).toBe(snapshot);
    });

    it("동일 입력에 동일 출력 (referential transparency)", () => {
      const periodStart = at("2026-05-31T15:00:00.000Z");
      expect(computePeriodEnd("week", periodStart).getTime()).toBe(
        computePeriodEnd("week", periodStart).getTime(),
      );
    });
  });

  describe("error path — 알 수 없는 period / Invalid Date (R-112-2)", () => {
    it.each(["", "year", "hour", "DAY", "weekly"])(
      "알 수 없는 period %p 는 throw 한다 (빈 문자열 포함, 기존 동작 유지)",
      (bad) => {
        expect(() =>
          computePeriodEnd(bad, at("2026-06-07T15:00:00.000Z")),
        ).toThrow(/알 수 없는 period/);
      },
    );

    it("period type mismatch (number 주입) 도 throw 한다", () => {
      expect(() =>
        computePeriodEnd(
          123 as unknown as string,
          at("2026-06-07T15:00:00.000Z"),
        ),
      ).toThrow(/알 수 없는 period/);
    });

    it("Invalid Date 입력은 helper 의 명시적 TypeError 가 전파된다", () => {
      expect(() => computePeriodEnd("day", new Date("nonsense"))).toThrow(
        /유효한 Date instance/,
      );
    });

    it("periodStart type mismatch (string 주입) 도 helper TypeError 전파", () => {
      expect(() =>
        computePeriodEnd("day", "2026-06-08" as unknown as Date),
      ).toThrow(/유효한 Date instance/);
    });
  });
});

describe("isPeriodEvaluable (R-112 — now ≥ periodEnd 시점 판정, KST 경계)", () => {
  // KST 일 구간 [2026-06-07T15:00Z, 2026-06-08T15:00Z) = KST 06-08 하루.
  const dayStart = at("2026-06-07T15:00:00.000Z");
  const dayEnd = at("2026-06-08T15:00:00.000Z");

  describe("happy path — 완전히 종료된 구간 (R-112-1, day/week/month 각 1+)", () => {
    it("day: now 가 periodEnd 이후면 true", () => {
      expect(
        isPeriodEvaluable("day", dayStart, at("2026-06-08T15:00:00.001Z")),
      ).toBe(true);
    });

    it("week: now 가 periodEnd 이후면 true", () => {
      // 구간 [05-31T15:00Z, 06-07T15:00Z) — 06-10 은 종료 후.
      expect(
        isPeriodEvaluable(
          "week",
          at("2026-05-31T15:00:00.000Z"),
          at("2026-06-10T00:00:00.000Z"),
        ),
      ).toBe(true);
    });

    it("month: now 가 periodEnd 이후면 true", () => {
      // 구간 [05-31T15:00Z, 06-30T15:00Z) — 07-15 는 종료 후.
      expect(
        isPeriodEvaluable(
          "month",
          at("2026-05-31T15:00:00.000Z"),
          at("2026-07-15T00:00:00.000Z"),
        ),
      ).toBe(true);
    });
  });

  describe("경계값 cover (R-112-3 — 반열림 [start,end) 종료 직후)", () => {
    it("now == periodEnd 면 true (종료 직후 평가 허용 — KST 자정 경계)", () => {
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

    it("week: now == periodEnd (다음 KST 월요일 자정) 면 true", () => {
      expect(
        isPeriodEvaluable(
          "week",
          at("2026-05-31T15:00:00.000Z"),
          at("2026-06-07T15:00:00.000Z"),
        ),
      ).toBe(true);
    });

    it("month: now == periodEnd (다음 KST 월초 자정) 면 true", () => {
      expect(
        isPeriodEvaluable(
          "month",
          at("2026-05-31T15:00:00.000Z"),
          at("2026-06-30T15:00:00.000Z"),
        ),
      ).toBe(true);
    });
  });

  describe("negative cases 충분 cover — 진행 중 구간 / 비-boundary 입력 (R-112-4)", () => {
    it("now < periodEnd (진행 중 day) 면 false", () => {
      // KST 06-08 정오(= 06-08T03:00Z) — 아직 KST 자정 안 지남.
      expect(
        isPeriodEvaluable("day", dayStart, at("2026-06-08T03:00:00.000Z")),
      ).toBe(false);
    });

    it("now == periodStart (구간 시작 순간) 면 false (진행 중)", () => {
      expect(isPeriodEvaluable("day", dayStart, dayStart)).toBe(false);
    });

    it("now < periodEnd (진행 중 week) 면 false", () => {
      // 구간 [05-31T15:00Z, 06-07T15:00Z) — 06-04 는 진행 중.
      expect(
        isPeriodEvaluable(
          "week",
          at("2026-05-31T15:00:00.000Z"),
          at("2026-06-04T00:00:00.000Z"),
        ),
      ).toBe(false);
    });

    it("now < periodEnd (진행 중 month) 면 false", () => {
      // 구간 [05-31T15:00Z, 06-30T15:00Z) — KST 06-30 23:59:59.999 는 여전히 진행 중.
      expect(
        isPeriodEvaluable(
          "month",
          at("2026-05-31T15:00:00.000Z"),
          at("2026-06-30T14:59:59.999Z"),
        ),
      ).toBe(false);
    });

    it("UTC 자정 입력(= KST 09:00, 비-boundary) 도 속한 KST 일 기준으로 판정한다", () => {
      const nonBoundaryStart = at("2026-06-08T00:00:00.000Z"); // KST 06-08 09:00
      // 같은 KST 날 안(06-08T12:00Z = KST 21:00) → 진행 중.
      expect(
        isPeriodEvaluable(
          "day",
          nonBoundaryStart,
          at("2026-06-08T12:00:00.000Z"),
        ),
      ).toBe(false);
      // snap 된 end(06-08T15:00Z = KST 06-09 00:00) 부터 평가 가능.
      expect(
        isPeriodEvaluable(
          "day",
          nonBoundaryStart,
          at("2026-06-08T15:00:00.000Z"),
        ),
      ).toBe(true);
    });

    it("month 가변 일수 경계: KST 2월(28일) 구간은 KST 3-01 자정에 평가 가능, 직전엔 불가", () => {
      const febStart = at("2026-01-31T15:00:00.000Z"); // KST 2026-02-01 00:00
      // KST 2-28 23:59:59.999 (= 02-28T14:59:59.999Z) 은 아직 2월 진행 중.
      expect(
        isPeriodEvaluable("month", febStart, at("2026-02-28T14:59:59.999Z")),
      ).toBe(false);
      // KST 3-01 00:00 (= 02-28T15:00Z) == periodEnd → 평가 가능.
      expect(
        isPeriodEvaluable("month", febStart, at("2026-02-28T15:00:00.000Z")),
      ).toBe(true);
    });

    it("알 수 없는 period 는 throw 한다 (computePeriodEnd 전파, 빈 문자열 포함)", () => {
      expect(() => isPeriodEvaluable("year", dayStart, dayEnd)).toThrow(
        /알 수 없는 period/,
      );
      expect(() => isPeriodEvaluable("", dayStart, dayEnd)).toThrow(
        /알 수 없는 period/,
      );
    });

    it("Invalid Date periodStart 는 helper TypeError 가 전파된다", () => {
      expect(() =>
        isPeriodEvaluable("day", new Date("nonsense"), dayEnd),
      ).toThrow(/유효한 Date instance/);
    });
  });

  describe("순수성 — now 주입·결정성 (R-112-2)", () => {
    it("동일 (period, periodStart, now) 에 동일 boolean (referential transparency)", () => {
      const now = at("2026-06-08T15:00:00.000Z");
      expect(isPeriodEvaluable("day", dayStart, now)).toBe(
        isPeriodEvaluable("day", dayStart, now),
      );
    });
  });
});
