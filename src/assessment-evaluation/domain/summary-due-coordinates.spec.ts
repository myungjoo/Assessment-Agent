// summary-due-coordinates.spec — R-61 요약 평가 대상 좌표 enumeration composer 검증.
// 순수 함수라 시스템 시계 미사용 — `now`/periodStart 는 전부 고정 Date instance 주입
// 으로 결정성 확보. happy / error / branch / negative 케이스를 박제한다(R-112).
// 기대 periodStart 는 hardcoded instant 대신 동일 boundary helper 로 derive 해 비교
// (전사 오류 차단 + boundary single source 정합 확인).

import {
  getKstPeriodRangeByPeriod,
  PERIOD_TO_GRANULARITY,
} from "../../common/period-boundary";

import { isPeriodEvaluable, type PeriodGranularity } from "./period-evaluable";
import { enumerateSummaryDueCoordinates } from "./summary-due-coordinates";

// helper 와 동일 산출식으로 "직전(방금 종료된) period 의 periodStart" 를 derive 하는
// 검증용 oracle — composer 가 boundary helper 를 위임함을 독립적으로 재확인한다.
function expectedPrevStart(period: string, now: Date): Date {
  const currentStart = getKstPeriodRangeByPeriod(period, now).start;
  const justBefore = new Date(currentStart.getTime() - 1);
  return getKstPeriodRangeByPeriod(period, justBefore).start;
}

const ALL: PeriodGranularity[] = ["day", "week", "month"];

describe("enumerateSummaryDueCoordinates — happy path (R-61 좌표 산출)", () => {
  // 2026-06-15T05:00:00Z = KST 2026-06-15(월) 14:00 — 월 중순 평일.
  const now = new Date("2026-06-15T05:00:00Z");

  it("roster 2명 × granularity 3종 → 6 좌표 산출, 등장 순서 보존", () => {
    const result = enumerateSummaryDueCoordinates(["alice", "bob"], ALL, now);
    expect(result).toHaveLength(6);
    expect(result.map((c) => `${c.personId}:${c.period}`)).toEqual([
      "alice:day",
      "alice:week",
      "alice:month",
      "bob:day",
      "bob:week",
      "bob:month",
    ]);
  });

  it("각 좌표의 periodStart 가 직전 종료 period 의 KST periodStart 와 정확히 일치", () => {
    const result = enumerateSummaryDueCoordinates(["alice"], ALL, now);
    for (const coord of result) {
      expect(coord.periodStart.getTime()).toBe(
        expectedPrevStart(coord.period, now).getTime(),
      );
    }
  });

  it("산출된 모든 좌표는 isPeriodEvaluable(period, periodStart, now) === true", () => {
    const result = enumerateSummaryDueCoordinates(["alice", "bob"], ALL, now);
    expect(result).not.toHaveLength(0);
    for (const coord of result) {
      expect(isPeriodEvaluable(coord.period, coord.periodStart, now)).toBe(
        true,
      );
    }
  });

  it("period 라벨이 day/week/month domain literal 로 보존된다(매핑은 helper 내부)", () => {
    const result = enumerateSummaryDueCoordinates(["alice"], ALL, now);
    for (const coord of result) {
      expect(Object.keys(PERIOD_TO_GRANULARITY)).toContain(coord.period);
    }
  });
});

describe("enumerateSummaryDueCoordinates — day/week/month 분기별 periodStart 산출 경로", () => {
  const now = new Date("2026-06-15T05:00:00Z"); // KST 2026-06-15(월)

  it("day 분기: 직전 KST 일(어제) periodStart", () => {
    const [coord] = enumerateSummaryDueCoordinates(["p"], ["day"], now);
    // KST 2026-06-14 00:00 = 2026-06-13T15:00:00Z.
    expect(coord.periodStart.toISOString()).toBe("2026-06-13T15:00:00.000Z");
  });

  it("week 분기: 직전 KST 주(지난 월요일 시작) periodStart", () => {
    const [coord] = enumerateSummaryDueCoordinates(["p"], ["week"], now);
    // 현재 주 시작 = KST 2026-06-15(월). 직전 주 = KST 2026-06-08(월) = 2026-06-07T15:00:00Z.
    expect(coord.periodStart.toISOString()).toBe("2026-06-07T15:00:00.000Z");
  });

  it("month 분기: 직전 KST 월(지난달 1일 시작) periodStart", () => {
    const [coord] = enumerateSummaryDueCoordinates(["p"], ["month"], now);
    // 현재 월 = KST 2026-06. 직전 월 = KST 2026-05-01 = 2026-04-30T15:00:00Z.
    expect(coord.periodStart.toISOString()).toBe("2026-04-30T15:00:00.000Z");
  });
});

describe("enumerateSummaryDueCoordinates — flow / branch (빈 입력)", () => {
  const now = new Date("2026-06-15T05:00:00Z");

  it("(a) roster 비어 있음 → 빈 배열 반환(throw 0)", () => {
    expect(enumerateSummaryDueCoordinates([], ALL, now)).toEqual([]);
  });

  it("(b) granularities 비어 있음 → 빈 배열 반환(throw 0)", () => {
    expect(enumerateSummaryDueCoordinates(["alice"], [], now)).toEqual([]);
  });

  it("(c) 둘 다 비어 있음 → 빈 배열 반환", () => {
    expect(enumerateSummaryDueCoordinates([], [], now)).toEqual([]);
  });

  it("정상 roster × 단일 granularity → 좌표 1+ 산출", () => {
    const result = enumerateSummaryDueCoordinates(["alice"], ["day"], now);
    expect(result).toHaveLength(1);
    expect(result[0].personId).toBe("alice");
    expect(result[0].period).toBe("day");
  });
});

describe("enumerateSummaryDueCoordinates — error path (fail-fast)", () => {
  const now = new Date("2026-06-15T05:00:00Z");

  it("personIds === null → 한국어 TypeError", () => {
    expect(() =>
      enumerateSummaryDueCoordinates(null as unknown as string[], ALL, now),
    ).toThrow(TypeError);
    expect(() =>
      enumerateSummaryDueCoordinates(null as unknown as string[], ALL, now),
    ).toThrow("personIds 배열이 null/undefined 일 수 없다.");
  });

  it("personIds === undefined → TypeError", () => {
    expect(() =>
      enumerateSummaryDueCoordinates(
        undefined as unknown as string[],
        ALL,
        now,
      ),
    ).toThrow(TypeError);
  });

  it("granularities === null → 한국어 TypeError", () => {
    expect(() =>
      enumerateSummaryDueCoordinates(
        ["alice"],
        null as unknown as PeriodGranularity[],
        now,
      ),
    ).toThrow("granularities 배열이 null/undefined 일 수 없다.");
  });

  it("granularities === undefined → TypeError", () => {
    expect(() =>
      enumerateSummaryDueCoordinates(
        ["alice"],
        undefined as unknown as PeriodGranularity[],
        now,
      ),
    ).toThrow(TypeError);
  });

  it("알 수 없는 granularity(VALID_PERIODS 밖) → boundary helper RangeError 전파(silent-skip 0)", () => {
    expect(() =>
      enumerateSummaryDueCoordinates(
        ["alice"],
        ["year"] as unknown as PeriodGranularity[],
        now,
      ),
    ).toThrow(RangeError);
  });
});

describe("enumerateSummaryDueCoordinates — negative cases 충분 cover", () => {
  it("(1) now 가 정확히 KST 자정(period 경계 instant) → 직전 종료분 일관 판정", () => {
    // KST 2026-06-01 00:00 = 2026-05-31T15:00:00Z (월초 1일 = 월요일이라 day/week/month 동시 롤오버).
    const midnight = new Date("2026-05-31T15:00:00Z");
    const [d] = enumerateSummaryDueCoordinates(["p"], ["day"], midnight);
    // 반열림 [start,end) 경계: now == 현재 period start → 직전 period 가 방금 종료.
    // 직전 일 = KST 2026-05-31 = 2026-05-30T15:00:00Z.
    expect(d.periodStart.toISOString()).toBe("2026-05-30T15:00:00.000Z");
    expect(isPeriodEvaluable("day", d.periodStart, midnight)).toBe(true);
  });

  it("(2) now 가 KST 월초 1일 00:00 → monthly=지난달, weekly/daily 도 직전 종료분 일관", () => {
    const midnight = new Date("2026-05-31T15:00:00Z"); // KST 2026-06-01 00:00 (월)
    const result = enumerateSummaryDueCoordinates(["p"], ALL, midnight);
    const byPeriod = Object.fromEntries(
      result.map((c) => [c.period, c.periodStart.toISOString()]),
    );
    // month: 직전 월 = KST 2026-05-01 = 2026-04-30T15:00:00Z.
    expect(byPeriod.month).toBe("2026-04-30T15:00:00.000Z");
    // week: 직전 주 = KST 2026-05-25(월) = 2026-05-24T15:00:00Z.
    expect(byPeriod.week).toBe("2026-05-24T15:00:00.000Z");
    // day: 직전 일 = KST 2026-05-31 = 2026-05-30T15:00:00Z.
    expect(byPeriod.day).toBe("2026-05-30T15:00:00.000Z");
    for (const coord of result) {
      expect(isPeriodEvaluable(coord.period, coord.periodStart, midnight)).toBe(
        true,
      );
    }
  });

  it("(3) roster 에 중복 personId → 좌표도 중복 산출(de-dup 책임은 composer 밖)", () => {
    const now = new Date("2026-06-15T05:00:00Z");
    const result = enumerateSummaryDueCoordinates(["dup", "dup"], ["day"], now);
    expect(result).toHaveLength(2);
    expect(result[0].personId).toBe("dup");
    expect(result[1].personId).toBe("dup");
    // 동일 instant — 시각 동일성 보존(중복 제거 안 함).
    expect(result[0].periodStart.getTime()).toBe(
      result[1].periodStart.getTime(),
    );
  });

  it("(3b) granularities 중복도 보존(중복 제거 안 함)", () => {
    const now = new Date("2026-06-15T05:00:00Z");
    const result = enumerateSummaryDueCoordinates(
      ["p"],
      ["day", "day"] as PeriodGranularity[],
      now,
    );
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.period)).toEqual(["day", "day"]);
  });

  it("(4) now 가 Invalid Date → boundary helper TypeError 전파(NaN 비결정성 차단)", () => {
    const invalid = new Date("not-a-date");
    expect(() =>
      enumerateSummaryDueCoordinates(["p"], ["day"], invalid),
    ).toThrow(TypeError);
  });

  it("(5a) granularity 순서가 산출 좌표 순서에 결정적으로 반영", () => {
    const now = new Date("2026-06-15T05:00:00Z");
    const forward = enumerateSummaryDueCoordinates(
      ["p"],
      ["day", "week", "month"],
      now,
    );
    const reversed = enumerateSummaryDueCoordinates(
      ["p"],
      ["month", "week", "day"],
      now,
    );
    expect(forward.map((c) => c.period)).toEqual(["day", "week", "month"]);
    expect(reversed.map((c) => c.period)).toEqual(["month", "week", "day"]);
  });

  it("(5b) roster 순서가 산출 좌표 순서에 결정적으로 반영", () => {
    const now = new Date("2026-06-15T05:00:00Z");
    const result = enumerateSummaryDueCoordinates(["zoe", "amy"], ["day"], now);
    expect(result.map((c) => c.personId)).toEqual(["zoe", "amy"]);
  });

  it("입력 배열을 변형하지 않는다(referential transparency)", () => {
    const now = new Date("2026-06-15T05:00:00Z");
    const persons = ["a", "b"];
    const grans: PeriodGranularity[] = ["day", "week"];
    const personsCopy = [...persons];
    const gransCopy = [...grans];
    enumerateSummaryDueCoordinates(persons, grans, now);
    expect(persons).toEqual(personsCopy);
    expect(grans).toEqual(gransCopy);
    // 동일 입력 → 동일 출력.
    const r1 = enumerateSummaryDueCoordinates(persons, grans, now);
    const r2 = enumerateSummaryDueCoordinates(persons, grans, now);
    expect(r1.map((c) => c.periodStart.getTime())).toEqual(
      r2.map((c) => c.periodStart.getTime()),
    );
  });
});
