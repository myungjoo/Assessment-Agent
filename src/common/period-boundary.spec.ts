// ADR-0039 §Decision3 semantics 박제 spec — R-112 4종 (happy / error / branch / negative).
// 기대값은 전부 UTC instant — KST(+09:00) 9시간 drift 경계를 명시 검증한다.
import {
  formatKstDisplay,
  formatKstIso,
  getKstPeriodRange,
  getKstPeriodRangeByPeriod,
  KST_TIMEZONE,
  parseKstPeriodInput,
  PERIOD_GRANULARITIES,
  PERIOD_TO_GRANULARITY,
  PeriodGranularity,
  startOfKstDay,
  startOfKstMonth,
  startOfKstWeek,
} from "./period-boundary";

const d = (iso: string) => new Date(iso);
const t0 = d("2026-06-10T15:00:00Z"); // = KST 2026-06-11 00:00 (자정 정각)
// Invalid Date / 비-Date / type-mismatch 입력 모음 (boundary 함수 공통 negative).
const badDates = [new Date(NaN), "2026-06-10", null] as unknown as Date[];
// 반열림 { start, end } 기대값 단언 helper.
const expectRange = (g: PeriodGranularity, i: string, s: string, e: string) =>
  expect(getKstPeriodRange(g, d(i))).toEqual({ start: d(s), end: d(e) });

describe("상수", () => {
  it("KST_TIMEZONE 은 IANA 식별자 / granularity 는 3종 (§Decision1)", () => {
    expect(KST_TIMEZONE).toBe("Asia/Seoul"); // 단순 "KST" string 금지
    expect(PERIOD_GRANULARITIES).toEqual(["daily", "weekly", "monthly"]);
  });
});

describe("startOfKstDay — §Decision3 (a) R-61 자정 = KST 자정", () => {
  it.each([
    ["2026-06-10T15:00:00Z", "2026-06-10T15:00Z"], // KST 6/11 자정 정각 = 자기 자신
    ["2026-06-10T14:59:59.999Z", "2026-06-09T15:00Z"], // KST 자정 직전 → 전날 (경계값)
    ["2026-06-10T06:00:00Z", "2026-06-09T15:00Z"], // UTC 한낮 = KST 같은 날 오후
  ])("instant %s 의 KST 일 시작 = %s", (input, expected) => {
    expect(startOfKstDay(d(input))).toEqual(d(expected));
  });
});

describe("startOfKstWeek — §Decision3 (b) KST 월요일 00:00 시작", () => {
  it.each([
    ["2026-06-11T03:00:00Z", "2026-06-07T15:00Z"], // KST 목 6/11 → 월 6/8
    ["2026-06-14T03:00:00Z", "2026-06-07T15:00Z"], // KST 일 6/14 → 직전 월 6/8
    ["2026-06-07T15:00:00Z", "2026-06-07T15:00Z"], // KST 월 6/8 00:00 정각 = 자기 자신
    ["2026-01-01T03:00:00Z", "2025-12-28T15:00Z"], // 연 경계: KST 목 1/1 → 월 12/29
  ])("instant %s 의 KST 주 시작(월요일) = %s", (input, expected) => {
    expect(startOfKstWeek(d(input))).toEqual(d(expected));
  });
  it("일요일 instant 의 주 시작은 당일이 아니다 — 일요일 시작 금지 박제", () => {
    const sunday = d("2026-06-14T03:00:00Z"); // KST 2026-06-14 (일)
    expect(startOfKstWeek(sunday)).not.toEqual(d("2026-06-13T15:00Z"));
  });
});

describe("startOfKstMonth — §Decision3 (c) KST 매월 1일 00:00 시작", () => {
  it.each([
    ["2026-06-11T03:00:00Z", "2026-05-31T15:00Z"], // KST 6/11 → 6/1
    ["2026-05-31T14:59:59.999Z", "2026-04-30T15:00Z"], // KST 5/31 월말 직전 → 5/1
    ["2026-05-31T15:00:00Z", "2026-05-31T15:00Z"], // KST 6/1 00:00 정각 = 자기 자신
  ])("instant %s 의 KST 월 시작 = %s", (input, expected) => {
    expect(startOfKstMonth(d(input))).toEqual(d(expected));
  });
});

describe("getKstPeriodRange — 반열림 [start, end)", () => {
  it.each([
    ["2026-06-10T15:00:00Z", "2026-06-10T15:00Z", "2026-06-11T15:00Z"], // AC 예시
    ["2026-06-10T14:59:59.999Z", "2026-06-09T15:00Z", "2026-06-10T15:00Z"], // 자정 직전
  ])("daily 구간 (instant %s) = [%s, %s)", (i, s, e) => {
    expectRange("daily", i, s, e);
  });
  it.each([
    ["2026-07-01T03:00:00Z", "2026-06-28T15:00Z", "2026-07-05T15:00Z"], // 월 경계 걸친 주
  ])("weekly 구간 (instant %s) = [KST 월 %s, 다음 월 %s)", (i, s, e) => {
    expectRange("weekly", i, s, e);
  });
  it.each([
    ["2026-02-15T03:00:00Z", "2026-01-31T15:00Z", "2026-02-28T15:00Z"], // 28일 평년 2월
    ["2028-02-15T03:00:00Z", "2028-01-31T15:00Z", "2028-02-29T15:00Z"], // 29일 윤년 2월
    ["2026-06-11T03:00:00Z", "2026-05-31T15:00Z", "2026-06-30T15:00Z"], // 30일 (6월)
    ["2026-07-10T03:00:00Z", "2026-06-30T15:00Z", "2026-07-31T15:00Z"], // 31일 (7월)
    ["2025-12-31T16:00:00Z", "2025-12-31T15:00Z", "2026-01-31T15:00Z"], // 연 경계 1월
  ])("monthly 구간 (instant %s) = [%s, %s)", (i, s, e) => {
    expectRange("monthly", i, s, e);
  });
  it("반열림 — daily end instant 는 다음 구간의 start 가 된다", () => {
    const { end } = getKstPeriodRange("daily", t0);
    expect(getKstPeriodRange("daily", end).start).toEqual(end);
  });
  // negative: 미지원 granularity (대소문자 불일치 / prototype 상속 키 포함).
  const badGrans = ["yearly", "", "DAILY", "constructor", undefined];
  it.each(badGrans)("미지원 granularity %p 는 RangeError", (g) => {
    const bad = g as unknown as PeriodGranularity;
    expect(() => getKstPeriodRange(bad, t0)).toThrow(RangeError);
  });
});

describe("boundary 함수 공통 — Invalid Date / 비-Date 입력은 TypeError", () => {
  const fns = [startOfKstDay, startOfKstWeek, startOfKstMonth];
  it.each(fns)("%p 의 error path", (fn) => {
    for (const bad of badDates) expect(() => fn(bad)).toThrow(TypeError);
  });
  it.each(badDates)("getKstPeriodRange(daily, %p) 도 TypeError", (bad) => {
    expect(() => getKstPeriodRange("daily", bad)).toThrow(TypeError);
  });
});

describe("parseKstPeriodInput — §Decision3 (d) R-9 입력 해석", () => {
  it.each([
    ["2026-06-10T15:00:00Z", "2026-06-10T15:00:00.000Z"], // offset Z 명시 → 그대로
    ["2026-06-10T15:00:00+09:00", "2026-06-10T06:00:00.000Z"], // offset +09:00 명시
    ["2026-06-10T15:00:00-05:00", "2026-06-10T20:00:00.000Z"], // offset 음수 명시
    ["2026-06-10T15:00", "2026-06-10T06:00:00.000Z"], // 미명시 → KST (ADR (d) 예시)
    ["2026-06-10", "2026-06-09T15:00:00.000Z"], // 날짜만 → KST 자정
    ["2026-06-10T15:00:00.5", "2026-06-10T06:00:00.500Z"], // 소수초 ms 보존 (KST 해석)
    ["2026-06-10 15:00", "2026-06-10T06:00:00.000Z"], // 공백 separator 허용
  ])("입력 %s → %s", (input, expected) => {
    expect(parseKstPeriodInput(input).toISOString()).toBe(expected);
  });
  it.each([
    "abc", // 형식 위반
    "10/06/2026", // 비-ISO 형식
    "2026-13-01", // 달력상 불가능한 월
    "2026-02-30", // 달력상 불가능한 일 (silent overflow 거부)
    "2026-06-10T25:00", // 불가능한 시
    "2026-06-10T15:00:99", // 불가능한 초
    "2026-06-10Z", // 시각 없는 offset (ISO 위반)
    "2026-06-10T15:00:00+0900", // 콜론 없는 offset 표기 거부
    "2026-06-10T15:00:00+09:60", // 범위 외 offset 분 — Invalid Date silent 반환 거부
    "2026-06-10T15:00:00+24:00", // 범위 외 offset 시 — Invalid Date silent 반환 거부
    "2026-06-10T15:00:00+99:99", // 범위 외 offset 시·분 동시 (reviewer 재현 입력)
  ])("malformed 입력 %p 는 명시적 error", (bad) => {
    expect(() => parseKstPeriodInput(bad)).toThrow(/parseKstPeriodInput/);
  });
  // negative: 빈 문자열 / 공백 / 비문자열 type mismatch.
  const badInputs = ["", "   ", 123, null, undefined, {}, new Date()];
  it.each(badInputs)("type mismatch 입력 %p 는 TypeError", (bad) => {
    expect(() => parseKstPeriodInput(bad as string)).toThrow(TypeError);
  });
});

// T-0358 — domain period 라벨 → granularity single source 매핑 + wrapper.
describe("PERIOD_TO_GRANULARITY — domain period → granularity single source (§Decision5)", () => {
  it("day/week/month 가 daily/weekly/monthly 로 매핑된다 (매핑 1 곳 박제)", () => {
    expect(PERIOD_TO_GRANULARITY).toEqual({
      day: "daily",
      week: "weekly",
      month: "monthly",
    });
  });
});

describe("getKstPeriodRangeByPeriod — domain period 경유 KST boundary snap", () => {
  // happy: day/week/month 각 1+ — period 라벨이 대응 granularity 로 위임돼 같은 range.
  it.each([
    ["day", "daily"],
    ["week", "weekly"],
    ["month", "monthly"],
  ] as const)(
    "period %s 는 granularity %s 의 getKstPeriodRange 와 동일 range 를 반환한다 (happy)",
    (period, granularity) => {
      expect(getKstPeriodRangeByPeriod(period, t0)).toEqual(
        getKstPeriodRange(granularity, t0),
      );
    },
  );

  // branch: 같은 KST 일 안의 서로 다른 입력 instant 가 동일 canonical start 로 snap.
  it("같은 KST 일 안의 서로 다른 instant 2 개가 동일 day start 좌표로 snap 된다 (branch — 수렴)", () => {
    const morning = d("2026-06-10T15:00:00Z"); // KST 6/11 00:00
    const night = d("2026-06-11T14:00:00Z"); // KST 6/11 23:00
    expect(getKstPeriodRangeByPeriod("day", morning).start).toEqual(
      getKstPeriodRangeByPeriod("day", night).start,
    );
    expect(getKstPeriodRangeByPeriod("day", morning).start).toEqual(
      d("2026-06-10T15:00Z"),
    );
  });

  // negative: 월말 입력(KST 6/1 자정)이 6 월 월초 좌표로 snap (T-0357 overflow 인접).
  it("KST 6/1 자정 instant(=5/31 15:00Z)의 month start 는 6 월 월초다 (negative — 월말 overflow 인접)", () => {
    expect(
      getKstPeriodRangeByPeriod("month", d("2026-05-31T15:00:00Z")).start,
    ).toEqual(d("2026-05-31T15:00Z"));
  });

  // error path: 알 수 없는 period 는 snap 전 RangeError(prototype 키 우회 차단 포함).
  it.each(["year", "", "daily", "constructor", "DAY", undefined])(
    "알 수 없는 period %p 는 RangeError 로 reject 한다 (error path — silent Invalid 좌표 금지)",
    (bad) => {
      expect(() =>
        getKstPeriodRangeByPeriod(bad as unknown as string, t0),
      ).toThrow(RangeError);
    },
  );

  // negative: Invalid Date instant 는 helper assertValidDate TypeError 전파.
  it.each(badDates)(
    "period day + Invalid Date instant %p 는 TypeError 전파 (negative — DTO 통과 후 Invalid edge)",
    (bad) => {
      expect(() => getKstPeriodRangeByPeriod("day", bad)).toThrow(TypeError);
    },
  );
});

// T-0360 — ADR-0039 §Decision4/§Decision5 (iv) view-layer formatter (저장 UTC → KST 표시).
describe("formatKstDisplay — 저장 UTC instant → Asia/Seoul 가독 표시 string", () => {
  // happy: 서로 다른 시각대(자정/정오/저녁) 각 1+ — UTC+9 가 정확히 적용됨.
  it.each([
    ["2026-06-09T15:00:00Z", "2026-06-10 00:00:00"], // 자정 — KST 6/10 00:00 (h23: "00")
    ["2026-06-10T03:00:00Z", "2026-06-10 12:00:00"], // 정오 — KST 6/10 12:00
    ["2026-06-10T11:30:45Z", "2026-06-10 20:30:45"], // 저녁 — KST 6/10 20:30:45
    ["2026-06-10T06:00:00Z", "2026-06-10 15:00:00"], // AC 예시 — UTC 한낮 → KST 오후
  ])("instant %s 의 KST 표시 = %s (UTC+9 적용)", (input, expected) => {
    expect(formatKstDisplay(d(input))).toBe(expected);
  });

  // negative: UTC 자정 경계가 KST 로 표시됨 — UTC "...Z" 그대로 노출 회귀 차단.
  it("KST 자정 경계가 '24' 아닌 '00' 으로 표시된다 (h23 정합 — negative)", () => {
    // UTC 6/9 15:00 = KST 6/10 00:00 — 자정이 24:00 으로 새지 않음.
    expect(formatKstDisplay(d("2026-06-09T15:00:00Z"))).toBe(
      "2026-06-10 00:00:00",
    );
  });
  it("UTC 가 아니라 KST 로 표시된다 — UTC '...Z' 그대로 노출 회귀 차단 (negative)", () => {
    const out = formatKstDisplay(d("2026-06-10T06:00:00Z"));
    expect(out).not.toContain("Z"); // UTC 직렬화가 아님
    expect(out).toBe("2026-06-10 15:00:00"); // +9 적용된 KST wall-clock
  });

  // error path / type mismatch: Invalid Date / 비-Date 입력은 TypeError (silent string 금지).
  it.each(badDates)(
    "Invalid Date / 비-Date %p 는 TypeError (silent 반환 금지)",
    (bad) => {
      expect(() => formatKstDisplay(bad)).toThrow(TypeError);
    },
  );
});

describe("formatKstIso — 저장 UTC instant → Asia/Seoul offset 명시 ISO-8601", () => {
  // happy: +09:00 offset 명시 + 서로 다른 시각대.
  it.each([
    ["2026-06-10T06:00:00Z", "2026-06-10T15:00:00+09:00"], // AC 예시
    ["2026-06-09T15:00:00Z", "2026-06-10T00:00:00+09:00"], // 자정 경계
    ["2026-06-10T11:30:45Z", "2026-06-10T20:30:45+09:00"], // 저녁
  ])("instant %s → %s (+09:00 명시)", (input, expected) => {
    expect(formatKstIso(d(input))).toBe(expected);
  });

  // round-trip: 산출 string 을 다시 파싱 시 원 instant 와 동등 (동일 instant 보존 — AC).
  it.each([
    "2026-06-10T06:00:00Z",
    "2026-06-09T15:00:00Z",
    "2026-06-10T11:30:45Z",
  ])("round-trip — formatKstIso(%s) 재파싱 시 원 instant 동등", (input) => {
    const instant = d(input);
    const iso = formatKstIso(instant);
    expect(iso).toContain("+09:00"); // offset 명시 확인 (branch)
    expect(new Date(iso).getTime()).toBe(instant.getTime()); // new Date round-trip
    expect(parseKstPeriodInput(iso).getTime()).toBe(instant.getTime()); // helper round-trip
  });

  // error path / type mismatch.
  it.each(badDates)(
    "Invalid Date / 비-Date %p 는 TypeError (silent 반환 금지)",
    (bad) => {
      expect(() => formatKstIso(bad)).toThrow(TypeError);
    },
  );
});
