// recent-deletion-window 순수 helper spec — R-112 4종 (happy / error / branch / negative
// 충분 cover). 기대 경계는 전부 period-boundary 의 KST helper 출력과 정합한다 (자체 산술
// 단언 금지 — helper 위임을 검증). KST 일 = 자정 00:00 시작 (ADR-0039 §Decision3 (a)).
import {
  getKstPeriodRange,
  PeriodRange,
  startOfKstDay,
} from "../common/period-boundary";

import { buildRecentDeletionWindow } from "./recent-deletion-window";

const d = (iso: string) => new Date(iso);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// reference = KST 2026-06-11 (목요일) 한낮(03:00Z = 12:00 KST). 그 KST 일의 end 는
// 2026-06-12 00:00 KST = 2026-06-11T15:00:00Z.
const reference = d("2026-06-11T03:00:00Z");

// window 가 정확히 days KST 일 폭이고 양 경계가 KST 자정에 snap 됨을 helper 정합으로 단언.
const expectWindow = (window: PeriodRange, ref: Date, days: number) => {
  // start < end (비어있지 않은 구간).
  expect(window.start.getTime()).toBeLessThan(window.end.getTime());
  // end == reference 일의 다음 KST 자정 (= 그 날 daily range 의 end).
  expect(window.end).toEqual(getKstPeriodRange("daily", ref).end);
  // start == end 로부터 days 일 전 instant 의 KST 일 시작 — helper 위임 산출과 정합.
  const expectedStart = startOfKstDay(
    new Date(window.end.getTime() - days * ONE_DAY_MS),
  );
  expect(window.start).toEqual(expectedStart);
};

describe("buildRecentDeletionWindow — happy-path (days 1/7/30)", () => {
  it.each([
    ["1일", 1],
    ["7일", 7],
    ["30일", 30],
  ])(
    "days=%s 면 정확히 그 폭의 KST 일 경계 snap window 를 반환한다",
    (_l, days) => {
      const window = buildRecentDeletionWindow(reference, days);
      expectWindow(window, reference, days);
    },
  );

  it("days=7 의 폭이 정확히 7 KST 일이다 (DST 없는 KST — 168h)", () => {
    const window = buildRecentDeletionWindow(reference, 7);
    expect(window.end.getTime() - window.start.getTime()).toBe(7 * ONE_DAY_MS);
  });

  it("기본값(days 미지정)은 1일 window 다", () => {
    const window = buildRecentDeletionWindow(reference);
    expectWindow(window, reference, 1);
    expect(window.end.getTime() - window.start.getTime()).toBe(ONE_DAY_MS);
  });
});

describe("buildRecentDeletionWindow — 경계 정합 (end = 다음 KST 자정)", () => {
  it("end 가 reference 일의 다음 KST 자정과 일치한다", () => {
    const window = buildRecentDeletionWindow(reference, 7);
    // KST 2026-06-12 00:00 = 2026-06-11T15:00:00Z.
    expect(window.end).toEqual(d("2026-06-11T15:00:00Z"));
  });

  it("start 가 7일 전 KST 자정(2026-06-05 00:00 KST)과 일치한다", () => {
    const window = buildRecentDeletionWindow(reference, 7);
    // KST 2026-06-05 00:00 = 2026-06-04T15:00:00Z.
    expect(window.start).toEqual(d("2026-06-04T15:00:00Z"));
  });

  it("KST 자정 직전 instant 도 같은 KST 일로 묶여 end 가 동일하다", () => {
    // 2026-06-11T14:59:00Z = KST 2026-06-11 23:59 — 여전히 6/11 KST 일.
    const lateRef = d("2026-06-11T14:59:00Z");
    const window = buildRecentDeletionWindow(lateRef, 1);
    expectWindow(window, lateRef, 1);
    expect(window.end).toEqual(d("2026-06-11T15:00:00Z"));
  });

  it("KST 자정 직후 instant 는 다음 KST 일로 묶여 end 가 하루 밀린다", () => {
    // 2026-06-11T15:01:00Z = KST 2026-06-12 00:01 — 6/12 KST 일.
    const earlyRef = d("2026-06-11T15:01:00Z");
    const window = buildRecentDeletionWindow(earlyRef, 1);
    expectWindow(window, earlyRef, 1);
    expect(window.end).toEqual(d("2026-06-12T15:00:00Z"));
  });
});

describe("buildRecentDeletionWindow — branch: 상한 경계값", () => {
  it("상한 경계값 days=366 을 허용한다 (1년)", () => {
    const window = buildRecentDeletionWindow(reference, 366);
    expectWindow(window, reference, 366);
  });
});

describe("buildRecentDeletionWindow — negative 충분 cover (days 검증 분기마다)", () => {
  it.each([
    ["0 (경계)", 0],
    ["음수", -3],
    ["소수", 2.5],
    ["NaN", NaN],
    ["367 (상한 초과)", 367],
    ["Infinity", Infinity],
  ])("days=%s 는 RangeError throw", (_label, days) => {
    expect(() => buildRecentDeletionWindow(reference, days)).toThrow(
      RangeError,
    );
  });
});

describe("buildRecentDeletionWindow — error-path (reference 검증)", () => {
  it.each([
    ["Invalid Date", new Date(NaN)],
    ["비-Date(string)", "2026-06-11" as unknown as Date],
    ["null", null as unknown as Date],
    ["undefined", undefined as unknown as Date],
  ])("reference=%s 는 TypeError throw", (_label, ref) => {
    expect(() => buildRecentDeletionWindow(ref as Date)).toThrow(TypeError);
  });
});

describe("buildRecentDeletionWindow — negative: 월/연 경계 가로지르기 (KST 일 snap)", () => {
  it("월초 reference 의 30일 window 가 직전 월로 겹쳐도 KST 일 경계로 snap", () => {
    // KST 2026-03-01 — 30일 window 는 2월(28일)을 가로지른다.
    const monthStart = d("2026-02-28T18:00:00Z"); // KST 2026-03-01 03:00
    const window = buildRecentDeletionWindow(monthStart, 30);
    expectWindow(window, monthStart, 30);
    expect(window.end.getTime() - window.start.getTime()).toBe(30 * ONE_DAY_MS);
  });

  it("윤년 2/29 를 가로지르는 reference 도 KST 일 경계로 snap", () => {
    // 2028 윤년 — 2028-03-02 reference 의 직전 일들이 2/29 를 가로지른다.
    const leap = d("2028-03-02T03:00:00Z");
    const window = buildRecentDeletionWindow(leap, 7);
    expectWindow(window, leap, 7);
    expect(window.end.getTime() - window.start.getTime()).toBe(7 * ONE_DAY_MS);
  });
});
