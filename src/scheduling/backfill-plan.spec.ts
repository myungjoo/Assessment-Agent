// backfill-plan 순수 helper spec — R-112 4종 (happy / error / branch / negative 충분 cover).
// 기대 경계는 전부 period-boundary 의 KST helper 출력과 정합한다 (자체 산술 단언 금지 —
// helper 위임을 검증). KST 주 = 월요일 00:00 시작 (ADR-0039 §Decision3 (b)).
import {
  getKstPeriodRange,
  PeriodRange,
  startOfKstWeek,
} from "../common/period-boundary";

import { buildBackfillPlan } from "./backfill-plan";

const d = (iso: string) => new Date(iso);
// reference = KST 2026-06-11 (목요일) 한낮. 그 주의 시작은 KST 2026-06-08(월) 00:00.
const reference = d("2026-06-11T03:00:00Z");

// 인접 window 경계 맞닿음 + 시간순 정렬 + 겹침/누락 0 을 한 번에 단언하는 helper.
const expectContiguousAscending = (plan: PeriodRange[]) => {
  for (let i = 1; i < plan.length; i += 1) {
    // 시간순: 앞 start < 다음 start.
    expect(plan[i - 1].start.getTime()).toBeLessThan(plan[i].start.getTime());
    // 경계 맞닿음(겹침/누락 0): 앞 end == 다음 start.
    expect(plan[i - 1].end.getTime()).toBe(plan[i].start.getTime());
  }
};

describe("buildBackfillPlan — happy-path (기본 weeks=52)", () => {
  it("52개 window 를 시간순(index 0 = 가장 오래된 주)으로 반환한다", () => {
    const plan = buildBackfillPlan(reference);
    expect(plan).toHaveLength(52);
    expectContiguousAscending(plan);
  });

  it("마지막 window 가 reference 가 속한 KST 주다", () => {
    const plan = buildBackfillPlan(reference);
    const last = plan[plan.length - 1];
    expect(last).toEqual(getKstPeriodRange("weekly", reference));
    // 마지막 window start == reference 주의 KST 월요일 00:00.
    expect(last.start).toEqual(startOfKstWeek(reference));
  });

  it("index 0 이 reference 주로부터 51주 전 주다", () => {
    const plan = buildBackfillPlan(reference);
    // index 0 의 end 가 index 1 의 start 와 맞닿고, 51칸 누적하면 reference 주 start 에 도달.
    expect(plan[0].start.getTime()).toBeLessThan(plan[51].start.getTime());
    // 각 window 는 정확히 7일(주간) 폭 — KST helper 정합.
    const widthMs = plan[0].end.getTime() - plan[0].start.getTime();
    expect(widthMs).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("buildBackfillPlan — flow/branch (weeks 명시)", () => {
  it("weeks=1 이면 단일 window = reference 주 (경계)", () => {
    const plan = buildBackfillPlan(reference, 1);
    expect(plan).toHaveLength(1);
    expect(plan[0]).toEqual(getKstPeriodRange("weekly", reference));
  });

  it("weeks=4 이면 4개 window 가 시간순·맞닿음으로 반환된다", () => {
    const plan = buildBackfillPlan(reference, 4);
    expect(plan).toHaveLength(4);
    expectContiguousAscending(plan);
    // 마지막은 항상 reference 주.
    expect(plan[3]).toEqual(getKstPeriodRange("weekly", reference));
  });

  it("상한 경계값 weeks=520 을 허용한다 (10년)", () => {
    const plan = buildBackfillPlan(reference, 520);
    expect(plan).toHaveLength(520);
    expectContiguousAscending(plan);
  });
});

describe("buildBackfillPlan — negative 충분 cover (weeks 검증 분기마다)", () => {
  it.each([
    ["0 (경계)", 0],
    ["음수", -3],
    ["소수", 2.5],
    ["NaN", NaN],
    ["521 (상한 초과)", 521],
    ["Infinity", Infinity],
  ])("weeks=%s 는 RangeError throw", (_label, weeks) => {
    expect(() => buildBackfillPlan(reference, weeks)).toThrow(RangeError);
  });
});

describe("buildBackfillPlan — error-path (reference 검증)", () => {
  it.each([
    ["Invalid Date", new Date(NaN)],
    ["비-Date(string)", "2026-06-11" as unknown as Date],
    ["null", null as unknown as Date],
    ["undefined", undefined as unknown as Date],
  ])("reference=%s 는 TypeError throw", (_label, ref) => {
    expect(() => buildBackfillPlan(ref as Date)).toThrow(TypeError);
  });
});

describe("buildBackfillPlan — negative: 연/월 경계 가로지르기 (KST 주 snap)", () => {
  it("연초 reference 의 backfill 이 직전 해로 겹쳐도 KST 주 경계로 정확히 snap", () => {
    // KST 2026-01-01 은 목요일 — 그 주는 2025-12-29(월) 시작. 52주 backfill 은
    // 2025 년으로 깊이 겹친다. 겹침/누락 0 + 정렬 + 폭 7일 단언으로 snap 정확성 검증.
    const newYear = d("2026-01-01T03:00:00Z");
    const plan = buildBackfillPlan(newYear, 52);
    expect(plan).toHaveLength(52);
    expectContiguousAscending(plan);
    // 모든 window 폭이 정확히 7일(주 경계 누락 없이 맞닿음).
    for (const r of plan) {
      expect(r.end.getTime() - r.start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });

  it("윤년 2월 말 경계를 가로지르는 reference 도 주 경계로 snap", () => {
    // 2028 은 윤년 — 2028-03-02 reference 의 직전 주들이 2/29 를 가로지른다.
    const leap = d("2028-03-02T03:00:00Z");
    const plan = buildBackfillPlan(leap, 10);
    expect(plan).toHaveLength(10);
    expectContiguousAscending(plan);
    expect(plan[9]).toEqual(getKstPeriodRange("weekly", leap));
  });
});
