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

// T-0800 — ADR-0052 §Decision(c) / ADR-0051 §Decision(b): 경계 helper timeZone 파라미터 일반화.
// 기본값(미지정)=KST 는 위 기존 describe 들이 이미 100% 커버(backward-compat 회귀 방지). 아래는
// timeZone 명시 시 해당 zone 기준 경계 산출 정확성 + 무효 tz error path + branch/negative.
describe("startOfKstDay/Week/Month — timeZone 파라미터 일반화 (기본 KST 보존)", () => {
  // (i) 미지정 시 기존 KST 결과 불변 — default 인자가 KST_TIMEZONE 임을 명시 박제(happy·branch).
  it("timeZone 미지정 == 'Asia/Seoul' 명시 == 기존 KST 결과 (default fallback branch)", () => {
    const i = d("2026-06-10T15:00:00Z"); // KST 6/11 00:00
    expect(startOfKstDay(i)).toEqual(startOfKstDay(i, "Asia/Seoul"));
    expect(startOfKstDay(i)).toEqual(d("2026-06-10T15:00Z"));
    expect(startOfKstWeek(i)).toEqual(startOfKstWeek(i, "Asia/Seoul"));
    expect(startOfKstMonth(i)).toEqual(startOfKstMonth(i, "Asia/Seoul"));
  });

  // (ii) startOfKstDay — non-KST zone 기준 자정 산출 (happy — UTC / New_York).
  it.each([
    // UTC: instant 그 자체의 UTC 자정. 2026-06-10T15:00Z 는 UTC 6/10 소속 → UTC 6/10 00:00.
    ["2026-06-10T15:00:00Z", "UTC", "2026-06-10T00:00:00Z"],
    // UTC 자정 정각 = 자기 자신 (경계값).
    ["2026-06-10T00:00:00Z", "UTC", "2026-06-10T00:00:00Z"],
    // America/New_York(EDT, -04:00 여름): 2026-06-10T15:00Z = NY 6/10 11:00 → NY 자정 = 6/10T04:00Z.
    ["2026-06-10T15:00:00Z", "America/New_York", "2026-06-10T04:00:00Z"],
    // NY 자정 직전 (6/10T03:59Z = NY 6/9 23:59) → 전날 자정 6/9T04:00Z (경계값·전날 snap).
    ["2026-06-10T03:59:00Z", "America/New_York", "2026-06-09T04:00:00Z"],
  ])("startOfKstDay(%s, %s) = %s", (input, tz, expected) => {
    expect(startOfKstDay(d(input), tz)).toEqual(d(expected));
  });

  // 주 시작=월요일(ISO 8601) 계약이 non-KST zone 에서도 유지됨 (AC — 다른 zone 월요일 자정).
  it.each([
    // UTC 목 2026-06-11 → 그 주 월요일 UTC 6/8 00:00.
    ["2026-06-11T12:00:00Z", "UTC", "2026-06-08T00:00:00Z"],
    // UTC 일 2026-06-14 → 직전 월요일 6/8 (일요일 시작 금지 — 당일 아님).
    ["2026-06-14T12:00:00Z", "UTC", "2026-06-08T00:00:00Z"],
    // 연 경계 UTC 목 2026-01-01 → 월 2025-12-29.
    ["2026-01-01T12:00:00Z", "UTC", "2025-12-29T00:00:00Z"],
    // NY 목 6/11(6/11T12:00Z = NY 08:00) → NY 월 6/8 자정 = 6/8T04:00Z.
    ["2026-06-11T12:00:00Z", "America/New_York", "2026-06-08T04:00:00Z"],
  ])("startOfKstWeek(%s, %s) = %s (ISO 월요일 시작 유지)", (input, tz, exp) => {
    expect(startOfKstWeek(d(input), tz)).toEqual(d(exp));
  });
  it("non-KST zone 에서도 일요일 instant 의 주 시작은 당일이 아니다 (일요일 시작 금지)", () => {
    const sundayUtc = d("2026-06-14T12:00:00Z"); // UTC 일
    expect(startOfKstWeek(sundayUtc, "UTC")).not.toEqual(
      d("2026-06-14T00:00Z"),
    );
    expect(startOfKstWeek(sundayUtc, "UTC")).toEqual(d("2026-06-08T00:00Z"));
  });

  it.each([
    // UTC 월 시작.
    ["2026-06-15T12:00:00Z", "UTC", "2026-06-01T00:00:00Z"],
    // NY 월 시작 = NY 6/1 자정 = 6/1T04:00Z.
    ["2026-06-15T12:00:00Z", "America/New_York", "2026-06-01T04:00:00Z"],
  ])("startOfKstMonth(%s, %s) = %s", (input, tz, exp) => {
    expect(startOfKstMonth(d(input), tz)).toEqual(d(exp));
  });
});

describe("getKstPeriodRange — timeZone 파라미터 반열림 [start, end) 정확성", () => {
  // 월 가변 길이(28~31)가 non-KST zone 에서도 [start,end) 반열림으로 정확한지 (AC).
  it.each([
    // 28일 평년 2월 (UTC): [2/1, 3/1).
    [
      "monthly",
      "2026-02-15T12:00:00Z",
      "UTC",
      "2026-02-01T00:00:00Z",
      "2026-03-01T00:00:00Z",
    ],
    // 29일 윤년 2월 (UTC): [2/1, 3/1) — 2/29 포함.
    [
      "monthly",
      "2028-02-15T12:00:00Z",
      "UTC",
      "2028-02-01T00:00:00Z",
      "2028-03-01T00:00:00Z",
    ],
    // 31일 7월 (UTC): [7/1, 8/1).
    [
      "monthly",
      "2026-07-10T12:00:00Z",
      "UTC",
      "2026-07-01T00:00:00Z",
      "2026-08-01T00:00:00Z",
    ],
    // 연 경계 월 (UTC): [12/1, 1/1).
    [
      "monthly",
      "2025-12-15T12:00:00Z",
      "UTC",
      "2025-12-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ],
    // daily (UTC): [6/10, 6/11).
    [
      "daily",
      "2026-06-10T12:00:00Z",
      "UTC",
      "2026-06-10T00:00:00Z",
      "2026-06-11T00:00:00Z",
    ],
    // weekly (UTC): 목 6/11 → [월 6/8, 월 6/15).
    [
      "weekly",
      "2026-06-11T12:00:00Z",
      "UTC",
      "2026-06-08T00:00:00Z",
      "2026-06-15T00:00:00Z",
    ],
  ] as const)("getKstPeriodRange(%s, %s, %s) = [%s, %s)", (g, i, tz, s, e) => {
    expect(getKstPeriodRange(g, d(i), tz)).toEqual({ start: d(s), end: d(e) });
  });

  // 반열림 — non-KST zone 에서도 end instant 는 다음 구간의 start 가 된다 (branch — 수렴).
  it("UTC daily end instant 는 다음 구간의 start 가 된다 (반열림 유지)", () => {
    const { end } = getKstPeriodRange(
      "daily",
      d("2026-06-10T12:00:00Z"),
      "UTC",
    );
    expect(getKstPeriodRange("daily", end, "UTC").start).toEqual(end);
  });

  // getKstPeriodRangeByPeriod 도 timeZone 을 흘려보낸다 (배선 branch).
  it("getKstPeriodRangeByPeriod 가 timeZone 인자를 getKstPeriodRange 로 전달한다", () => {
    const i = d("2026-06-10T12:00:00Z");
    expect(getKstPeriodRangeByPeriod("day", i, "UTC")).toEqual(
      getKstPeriodRange("daily", i, "UTC"),
    );
    // KST vs UTC 는 서로 다른 start 를 낸다 (timezone 지정이 실제로 결과를 바꾼다).
    expect(getKstPeriodRangeByPeriod("day", i, "UTC").start).not.toEqual(
      getKstPeriodRangeByPeriod("day", i).start,
    );
  });
});

describe("timeZone 무효 IANA 식별자 — Intl throw 전파 (ADR-0052 §Consequences 무효 tz 방어)", () => {
  // error path: 무효 IANA 식별자 전달 시 RangeError 전파 (1+ test / 각 public 경계 함수).
  // 주의: "asia/seoul" 류 lower-case 는 ICU 가 canonicalize 해 수용(throw 안 함) — 무효 목록 제외.
  const invalidZones = ["Not/AZone", "Mars/Phobos", "", "Foo/Bar/Baz"];
  it.each(invalidZones)(
    "startOfKstDay(valid, %p) 는 RangeError (무효 tz)",
    (tz) => {
      expect(() => startOfKstDay(t0, tz)).toThrow(RangeError);
    },
  );
  it.each(invalidZones)(
    "getKstPeriodRange(daily, valid, %p) 는 RangeError (무효 tz)",
    (tz) => {
      expect(() => getKstPeriodRange("daily", t0, tz)).toThrow(RangeError);
    },
  );
  it("startOfKstWeek / startOfKstMonth / byPeriod 도 무효 tz 는 RangeError", () => {
    expect(() => startOfKstWeek(t0, "Not/AZone")).toThrow(RangeError);
    expect(() => startOfKstMonth(t0, "Not/AZone")).toThrow(RangeError);
    expect(() => getKstPeriodRangeByPeriod("day", t0, "Not/AZone")).toThrow(
      RangeError,
    );
  });
  // negative 조합: 무효 granularity 는 무효 tz 보다 먼저 검사돼 RangeError (granularity 게이트 우선).
  it("무효 granularity 는 tz 검증 이전에 RangeError (게이트 순서)", () => {
    expect(() =>
      getKstPeriodRange("yearly" as unknown as PeriodGranularity, t0, "UTC"),
    ).toThrow(/미지원 granularity/);
  });
  // negative 조합: Invalid Date + 유효 tz → assertValidDate TypeError (tz 유효해도 Date 우선).
  it.each(badDates)(
    "Invalid Date %p + 유효 tz(UTC) 는 TypeError (Date 검증 우선)",
    (bad) => {
      expect(() => startOfKstDay(bad, "UTC")).toThrow(TypeError);
    },
  );
});

describe("formatterCache — timezone 별 Intl.DateTimeFormat 재사용 (§Decision5 비용/drift)", () => {
  // 같은 zone 반복 호출이 안정적으로 같은 결과 — 캐시 hit 경로 (매 호출 새 인스턴스 금지 박제).
  it("같은 timeZone 반복 호출은 동일 결과 (캐시 hit 경로)", () => {
    const i = d("2026-06-10T15:00:00Z");
    const first = startOfKstDay(i, "America/New_York");
    const second = startOfKstDay(i, "America/New_York");
    expect(first).toEqual(second);
  });
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

// T-0801 — ADR-0052 §Decision(b)/(d): display / 입력해석 계열 timeZone 파라미터 일반화(기본 KST).
// 기본값(미지정)=KST 는 위 기존 describe 들이 이미 커버(backward-compat 회귀 방지). 아래는
// timeZone 명시 시 해당 zone 기준 산출 정확성 + 무효 tz error path + round-trip + branch/negative.
describe("formatKstDisplay — timeZone 파라미터 일반화 (기본 KST 보존)", () => {
  // (i) 미지정 == "Asia/Seoul" 명시 == 기존 KST 결과 (default fallback branch).
  it("timeZone 미지정 == 'Asia/Seoul' 명시 == 기존 KST 표시 (default branch)", () => {
    const i = d("2026-06-10T06:00:00Z");
    expect(formatKstDisplay(i)).toBe(formatKstDisplay(i, "Asia/Seoul"));
    expect(formatKstDisplay(i)).toBe("2026-06-10 15:00:00"); // KST 불변
  });

  // (ii) non-KST zone 기준 wall-clock 표시 (happy — UTC / New_York).
  it.each([
    // UTC: instant 그 자체의 UTC wall-clock.
    ["2026-06-10T06:00:00Z", "UTC", "2026-06-10 06:00:00"],
    // 자정 경계 — UTC 자정이 "24" 아닌 "00" (h23).
    ["2026-06-10T00:00:00Z", "UTC", "2026-06-10 00:00:00"],
    // America/New_York(EDT, -04:00 여름): 06:00Z = NY 02:00.
    ["2026-06-10T06:00:00Z", "America/New_York", "2026-06-10 02:00:00"],
  ])("formatKstDisplay(%s, %s) = %s", (input, tz, expected) => {
    expect(formatKstDisplay(d(input), tz)).toBe(expected);
  });

  // negative: KST vs UTC 는 서로 다른 표시를 낸다 (timezone 지정이 실제로 결과를 바꾼다).
  it("KST 와 UTC 표시가 다르다 — timeZone 인자가 실제로 결과를 바꾼다 (branch)", () => {
    const i = d("2026-06-10T06:00:00Z");
    expect(formatKstDisplay(i, "UTC")).not.toBe(formatKstDisplay(i));
  });

  // error path: 무효 IANA 식별자 → Intl RangeError 전파 (ADR-0052 §Consequences).
  it.each(["Not/AZone", "Mars/Phobos", "", "Foo/Bar/Baz"])(
    "무효 tz %p 는 RangeError (무효 tz 방어)",
    (tz) => {
      expect(() => formatKstDisplay(d("2026-06-10T06:00:00Z"), tz)).toThrow(
        RangeError,
      );
    },
  );
});

describe("formatKstIso / kstOffsetLabel — timeZone 파라미터 일반화 (기본 KST 보존)", () => {
  // (i) 미지정 == "Asia/Seoul" 명시 == 기존 +09:00 결과 (default branch).
  it("timeZone 미지정 == 'Asia/Seoul' 명시 == 기존 +09:00 ISO (default branch)", () => {
    const i = d("2026-06-10T06:00:00Z");
    expect(formatKstIso(i)).toBe(formatKstIso(i, "Asia/Seoul"));
    expect(formatKstIso(i)).toBe("2026-06-10T15:00:00+09:00"); // KST 불변
  });

  // (ii) non-KST zone 기준 wall-clock + 해당 zone offset 라벨 (happy — offset 실측).
  it.each([
    // UTC → +00:00 offset (kstOffsetLabel 이 +00:00 을 산출).
    ["2026-06-10T06:00:00Z", "UTC", "2026-06-10T06:00:00+00:00"],
    // America/New_York EDT → -04:00 (음수 offset 분기 — KST 에선 도달 불가).
    ["2026-06-10T06:00:00Z", "America/New_York", "2026-06-10T02:00:00-04:00"],
    // 자정 경계 UTC.
    ["2026-06-10T00:00:00Z", "UTC", "2026-06-10T00:00:00+00:00"],
  ])("formatKstIso(%s, %s) = %s (offset 라벨 실측)", (input, tz, expected) => {
    expect(formatKstIso(d(input), tz)).toBe(expected);
  });

  // negative: kstOffsetLabel 음수 offset 분기가 non-KST zone 에서 실제로 도달됨 (sign="-" 커버).
  it("America/New_York 은 음수 offset 라벨을 낸다 (sign 분기 커버 — negative)", () => {
    expect(formatKstIso(d("2026-06-10T06:00:00Z"), "America/New_York")).toMatch(
      /-04:00$/,
    );
  });

  // round-trip: 같은 zone 으로 되돌리면 원 instant 복원 (동일 instant 보존 — AC).
  it.each([
    ["2026-06-10T06:00:00Z", "UTC"],
    ["2026-06-10T06:00:00Z", "America/New_York"],
    ["2026-06-09T15:00:00Z", "Asia/Seoul"],
  ])(
    "round-trip — formatKstIso(%s, %s) 재파싱 시 원 instant 동등",
    (input, tz) => {
      const instant = d(input);
      const iso = formatKstIso(instant, tz);
      expect(new Date(iso).getTime()).toBe(instant.getTime()); // new Date round-trip
      expect(parseKstPeriodInput(iso, tz).getTime()).toBe(instant.getTime());
    },
  );

  // error path: 무효 IANA 식별자 → RangeError 전파.
  it.each(["Not/AZone", "Mars/Phobos", "", "Foo/Bar/Baz"])(
    "무효 tz %p 는 RangeError (무효 tz 방어)",
    (tz) => {
      expect(() => formatKstIso(d("2026-06-10T06:00:00Z"), tz)).toThrow(
        RangeError,
      );
    },
  );
});

describe("parseKstPeriodInput — timeZone 파라미터 일반화 (기본 KST 보존)", () => {
  // (i) 미지정 == "Asia/Seoul" 명시 == 기존 KST 해석 (default branch).
  it("timeZone 미지정 == 'Asia/Seoul' 명시 == 기존 KST 해석 (default branch)", () => {
    const kstDefault = parseKstPeriodInput("2026-06-10T15:00");
    const kstExplicit = parseKstPeriodInput("2026-06-10T15:00", "Asia/Seoul");
    expect(kstDefault.getTime()).toBe(kstExplicit.getTime());
    expect(kstDefault.toISOString()).toBe("2026-06-10T06:00:00.000Z");
  });

  // (ii) offset 미명시 입력을 non-KST zone 으로 해석 (happy — AC 예시).
  it.each([
    // UTC 해석: wall-clock 이 그대로 UTC instant.
    ["2026-06-10T15:00", "UTC", "2026-06-10T15:00:00.000Z"],
    // 날짜만 → 해당 zone 자정 (UTC 자정).
    ["2026-06-10", "UTC", "2026-06-10T00:00:00.000Z"],
    // America/New_York(EDT -04:00): 15:00 wall = 19:00Z.
    ["2026-06-10T15:00", "America/New_York", "2026-06-10T19:00:00.000Z"],
    // 소수초 보존 (UTC 해석).
    ["2026-06-10T15:00:00.5", "UTC", "2026-06-10T15:00:00.500Z"],
  ])(
    "parseKstPeriodInput(%s, %s) = %s (offset 미명시 → zone 해석)",
    (i, tz, e) => {
      expect(parseKstPeriodInput(i, tz).toISOString()).toBe(e);
    },
  );

  // round-trip: offset 미명시 입력을 non-KST zone 해석 → 같은 zone formatKstIso 되돌림 = 원 wall-clock.
  it("round-trip — parseKstPeriodInput('2026-06-10T15:00','UTC') = 2026-06-10T15:00Z (AC)", () => {
    const instant = parseKstPeriodInput("2026-06-10T15:00", "UTC");
    expect(instant.toISOString()).toBe("2026-06-10T15:00:00.000Z");
    expect(formatKstIso(instant, "UTC")).toBe("2026-06-10T15:00:00+00:00");
  });

  // branch: offset 명시 입력은 timeZone 인자와 무관하게 명시 offset 을 존중(zone 무시).
  it.each([
    // +09:00 명시를 UTC 인자로 넘겨도 결과 동일 (명시 offset 우선).
    ["2026-06-10T15:00:00+09:00", "UTC", "2026-06-10T06:00:00.000Z"],
    // Z 명시를 America/New_York 인자로 넘겨도 그대로.
    ["2026-06-10T15:00:00Z", "America/New_York", "2026-06-10T15:00:00.000Z"],
    // -05:00 명시를 Asia/Seoul 인자로 넘겨도 명시 offset 존중.
    ["2026-06-10T15:00:00-05:00", "Asia/Seoul", "2026-06-10T20:00:00.000Z"],
  ])("offset 명시 %s 는 timeZone(%s) 무시하고 그대로 (branch)", (i, tz, e) => {
    expect(parseKstPeriodInput(i, tz).toISOString()).toBe(e);
  });

  it("offset 명시 입력은 timeZone 인자 바꿔도 동일 결과 (zone 무시 박제)", () => {
    const utc = parseKstPeriodInput("2026-06-10T15:00:00+09:00", "UTC");
    const ny = parseKstPeriodInput(
      "2026-06-10T15:00:00+09:00",
      "America/New_York",
    );
    expect(utc.getTime()).toBe(ny.getTime());
  });

  // error path: timeZone 파라미터 추가 후에도 기존 error path 유지.
  it.each([
    "abc", // 형식 위반
    "2026-13-01", // 불가능한 월
    "2026-02-30", // 불가능한 일
    "2026-06-10T25:00", // 불가능한 시
    "2026-06-10T15:00:00+09:60", // 범위 외 offset
  ])("timeZone 인자 부여 후에도 malformed %p 는 error 유지", (bad) => {
    expect(() => parseKstPeriodInput(bad, "UTC")).toThrow(
      /parseKstPeriodInput/,
    );
  });

  it.each(["", "   ", 123, null, undefined])(
    "timeZone 인자 부여 후에도 type mismatch %p 는 TypeError 유지",
    (bad) => {
      expect(() => parseKstPeriodInput(bad as string, "UTC")).toThrow(
        TypeError,
      );
    },
  );

  // error path: offset 미명시 입력 + 무효 tz → wallClockToUtc 내부 Intl RangeError 전파.
  it.each(["Not/AZone", "Mars/Phobos", "Foo/Bar/Baz"])(
    "offset 미명시 입력 + 무효 tz %p 는 RangeError (무효 tz 방어)",
    (tz) => {
      expect(() => parseKstPeriodInput("2026-06-10T15:00", tz)).toThrow(
        RangeError,
      );
    },
  );

  // negative 경계값: 윤년 2/29 · 연말 12/31 자정 · DST 존재 zone 봄 전환 근방.
  it.each([
    // 윤년 2/29 (UTC).
    ["2028-02-29T12:00", "UTC", "2028-02-29T12:00:00.000Z"],
    // 연말 12/31 자정 (UTC).
    ["2025-12-31T00:00", "UTC", "2025-12-31T00:00:00.000Z"],
    // America/New_York DST 봄 전환 후(EDT -04:00): 2026-03-08 03:00 wall = 07:00Z
    // (spring-forward 는 03/08 02:00→03:00 로 건너뛰므로 03:00 은 EDT 유효 wall).
    ["2026-03-08T03:00", "America/New_York", "2026-03-08T07:00:00.000Z"],
  ])("경계값 %s (%s) = %s (윤년·연말·DST)", (i, tz, e) => {
    expect(parseKstPeriodInput(i, tz).toISOString()).toBe(e);
  });
});
