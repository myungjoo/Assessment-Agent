// ADR-0039 §Decision3 semantics 박제 spec — R-112 4종 (happy / error / branch / negative).
// 기대값은 전부 UTC instant — KST(+09:00) 9시간 drift 경계를 명시 검증한다.
import {
  getKstPeriodRange,
  KST_TIMEZONE,
  parseKstPeriodInput,
  PERIOD_GRANULARITIES,
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
