// recent-deletion-plan 순수 조립 helper spec — R-112 4종 (happy / error / branch / negative
// 충분 cover). 본 helper 는 두 building block(buildRecentDeletionWindow + selectInDeletionWindow)
// 호출만 하므로 spec 도 자체 경계 산술을 단언하지 않고 (a) window 가 위임 helper 출력과 정합,
// (b) toDelete/toKeep 이 window 반열림 [start, end) 분류와 입력 순서 보존을 만족, (c) 검증
// 예외가 building block 으로부터 전파되는지를 검증한다.
import {
  buildRecentDeletionPlan,
  RecentDeletionPlan,
} from "./recent-deletion-plan";
import { buildRecentDeletionWindow } from "./recent-deletion-window";

const d = (iso: string) => new Date(iso);
// reference = KST 2026-06-11 (목요일) 한낮(03:00Z = 12:00 KST). 그 KST 일의 end 는
// 2026-06-12 00:00 KST = 2026-06-11T15:00:00Z (recent-deletion-window.spec.ts 와 동일 기준).
const reference = d("2026-06-11T03:00:00Z");

describe("buildRecentDeletionPlan — happy-path (days 1/7/30)", () => {
  it.each([
    ["1일", 1],
    ["7일", 7],
    ["30일", 30],
  ])(
    "days=%s 면 plan.window 가 위임 helper 출력과 정합하고 instant 가 정확히 분류된다",
    (_l, days) => {
      const expectedWindow = buildRecentDeletionWindow(reference, days);
      // window 안/밖/경계가 섞인 고정 instant 목록.
      const before = d("2000-01-01T00:00:00Z"); // 아주 옛날 → 항상 window 밖 → toKeep
      const atStart = expectedWindow.start; // start 동일 → in (포함) → toDelete
      const middle = new Date(
        (expectedWindow.start.getTime() + expectedWindow.end.getTime()) / 2,
      ); // 내부 → toDelete
      const atEnd = expectedWindow.end; // end 동일 → out (배타) → toKeep
      const future = d("2100-01-01T00:00:00Z"); // 미래 → window 밖 → toKeep

      const instants = [before, atStart, middle, atEnd, future];
      const plan = buildRecentDeletionPlan(reference, days, instants);

      // (a) window 는 위임 helper 출력과 정합 — 자체 경계 산술 단언 금지.
      expect(plan.window).toEqual(expectedWindow);
      // (b) toDelete = in-window, toKeep = out-of-window, 둘 다 입력 순서 보존.
      expect(plan.toDelete).toEqual([atStart, middle]);
      expect(plan.toKeep).toEqual([before, atEnd, future]);
      // (c) 합집합 == 입력(중복/누락 0).
      expect(plan.toDelete.length + plan.toKeep.length).toBe(instants.length);
    },
  );

  it("도메인 라벨이 selectInDeletionWindow 의 in/out 매핑과 일치한다", () => {
    const window = buildRecentDeletionWindow(reference, 7);
    const inside = new Date(window.start.getTime() + 1000); // window 안
    const outside = d("1990-01-01T00:00:00Z"); // window 밖

    const plan = buildRecentDeletionPlan(reference, 7, [inside, outside]);

    expect(plan.toDelete).toEqual([inside]);
    expect(plan.toKeep).toEqual([outside]);
  });
});

describe("buildRecentDeletionPlan — error path (reference 검증 위임 전파)", () => {
  it("reference 가 비-Date 면 TypeError 를 전파한다", () => {
    expect(() =>
      buildRecentDeletionPlan("2026-06-11" as unknown as Date, 7, []),
    ).toThrow(TypeError);
  });

  it("reference 가 Invalid Date 면 TypeError 를 전파한다", () => {
    expect(() => buildRecentDeletionPlan(new Date("nope"), 7, [])).toThrow(
      TypeError,
    );
  });
});

describe("buildRecentDeletionPlan — branch/negative (예외 분기마다 1+)", () => {
  it("days=0 이면 RangeError 를 전파한다", () => {
    expect(() => buildRecentDeletionPlan(reference, 0, [])).toThrow(RangeError);
  });

  it("days 가 음수면 RangeError 를 전파한다", () => {
    expect(() => buildRecentDeletionPlan(reference, -7, [])).toThrow(
      RangeError,
    );
  });

  it("days 가 소수면 RangeError 를 전파한다", () => {
    expect(() => buildRecentDeletionPlan(reference, 1.5, [])).toThrow(
      RangeError,
    );
  });

  it("days 가 상한(366) 초과면 RangeError 를 전파한다", () => {
    expect(() => buildRecentDeletionPlan(reference, 367, [])).toThrow(
      RangeError,
    );
  });

  it("instants 가 비-배열이면 TypeError 를 전파한다", () => {
    expect(() =>
      buildRecentDeletionPlan(reference, 7, "nope" as unknown as Date[]),
    ).toThrow(TypeError);
  });

  it("instants 원소 중 Invalid Date 가 있으면 index 를 담은 TypeError 를 전파한다", () => {
    const valid = d("2026-06-11T10:00:00Z");
    expect(() =>
      buildRecentDeletionPlan(reference, 7, [valid, new Date("bad")]),
    ).toThrow(/instants\[1\]/);
  });
});

describe("buildRecentDeletionPlan — 경계/non-mutating", () => {
  it("빈 instants 는 빈 toDelete/toKeep 을 반환한다(error 아님)", () => {
    const plan: RecentDeletionPlan = buildRecentDeletionPlan(reference, 7, []);
    expect(plan.toDelete).toEqual([]);
    expect(plan.toKeep).toEqual([]);
    // window 는 빈 입력에도 정상 산출.
    expect(plan.window.start.getTime()).toBeLessThan(plan.window.end.getTime());
  });

  it("입력 instants 배열이 호출 후에도 변형되지 않는다", () => {
    const window = buildRecentDeletionWindow(reference, 7);
    const a = new Date(window.start.getTime() + 1000);
    const b = d("1990-01-01T00:00:00Z");
    const instants = [a, b];
    const snapshot = [...instants];

    buildRecentDeletionPlan(reference, 7, instants);

    expect(instants).toEqual(snapshot);
    expect(instants).toHaveLength(2);
  });

  it("toDelete + toKeep 길이 합이 입력 길이와 같다(중복/누락 0)", () => {
    const window = buildRecentDeletionWindow(reference, 30);
    const instants = [
      new Date(window.start.getTime() + 1),
      new Date(window.end.getTime() - 1),
      d("1980-01-01T00:00:00Z"),
      d("2200-01-01T00:00:00Z"),
    ];
    const plan = buildRecentDeletionPlan(reference, 30, instants);
    expect(plan.toDelete.length + plan.toKeep.length).toBe(instants.length);
  });
});
