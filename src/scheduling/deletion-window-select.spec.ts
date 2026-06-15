// deletion-window-select 순수 helper spec — R-112 4종 (happy / error / branch / negative
// 충분 cover). window 는 반열림 [start, end) — start 포함, end 배타. 본 helper 는 자체
// 산술 0 이라 instant getTime() 비교만 검증한다 (경계 정합 + non-mutating + 예외 분기).
import { PeriodRange } from "../common/period-boundary";

import {
  DeletionWindowSelection,
  selectInDeletionWindow,
} from "./deletion-window-select";

const d = (iso: string) => new Date(iso);

// 고정 window [2026-06-10T00:00:00Z, 2026-06-12T00:00:00Z) — 폭 2일.
const window: PeriodRange = {
  start: d("2026-06-10T00:00:00Z"),
  end: d("2026-06-12T00:00:00Z"),
};

describe("selectInDeletionWindow — happy-path 분류", () => {
  it("window 안/밖/경계가 섞인 목록을 입력 순서 보존하며 정확히 분류한다", () => {
    const before = d("2026-06-09T23:59:59Z"); // start 직전 → out
    const atStart = d("2026-06-10T00:00:00Z"); // start 동일 → in (포함)
    const middle = d("2026-06-11T12:00:00Z"); // 내부 → in
    const atEnd = d("2026-06-12T00:00:00Z"); // end 동일 → out (배타)
    const after = d("2026-06-13T00:00:00Z"); // end 이후 → out

    const result = selectInDeletionWindow(window, [
      before,
      atStart,
      middle,
      atEnd,
      after,
    ]);

    expect(result.inWindow).toEqual([atStart, middle]);
    expect(result.outOfWindow).toEqual([before, atEnd, after]);
    // 두 배열 합집합 == 입력(중복/누락 0).
    expect(result.inWindow.length + result.outOfWindow.length).toBe(5);
  });

  it("빈 배열 입력은 빈 분류 결과를 반환한다 (error 아님)", () => {
    const result: DeletionWindowSelection = selectInDeletionWindow(window, []);
    expect(result.inWindow).toEqual([]);
    expect(result.outOfWindow).toEqual([]);
  });

  it("모든 instant 가 window 안이면 outOfWindow 가 비고 순서가 보존된다", () => {
    const a = d("2026-06-10T06:00:00Z");
    const b = d("2026-06-11T18:00:00Z");
    const result = selectInDeletionWindow(window, [b, a]);
    expect(result.inWindow).toEqual([b, a]); // 입력 순서 보존
    expect(result.outOfWindow).toEqual([]);
  });
});

describe("selectInDeletionWindow — 경계 정합 단언 (반열림 [start, end))", () => {
  it("instant === window.start 는 in-window 다 (start 포함)", () => {
    const result = selectInDeletionWindow(window, [d("2026-06-10T00:00:00Z")]);
    expect(result.inWindow).toHaveLength(1);
    expect(result.outOfWindow).toHaveLength(0);
  });

  it("instant === window.end 는 out-of-window 다 (end 배타)", () => {
    const result = selectInDeletionWindow(window, [d("2026-06-12T00:00:00Z")]);
    expect(result.inWindow).toHaveLength(0);
    expect(result.outOfWindow).toHaveLength(1);
  });

  it("end 보다 1ms 이른 instant 는 in-window 다 (배타 경계 직전)", () => {
    const result = selectInDeletionWindow(window, [
      d("2026-06-11T23:59:59.999Z"),
    ]);
    expect(result.inWindow).toHaveLength(1);
  });
});

describe("selectInDeletionWindow — non-mutating", () => {
  it("입력 배열의 순서/내용을 변형하지 않고 새 배열을 반환한다", () => {
    const inputArr = [d("2026-06-11T00:00:00Z"), d("2026-06-09T00:00:00Z")];
    const snapshot = [...inputArr];
    const result = selectInDeletionWindow(window, inputArr);
    // 입력 배열 원본 보존 (순서/내용).
    expect(inputArr).toEqual(snapshot);
    expect(inputArr).toHaveLength(2);
    // 반환 배열은 입력과 다른 인스턴스.
    expect(result.inWindow).not.toBe(inputArr);
    expect(result.outOfWindow).not.toBe(inputArr);
  });
});

describe("selectInDeletionWindow — error path (TypeError: window)", () => {
  it("window.start 가 비-Date 면 TypeError", () => {
    const bad = { start: "2026-06-10" as unknown as Date, end: window.end };
    expect(() => selectInDeletionWindow(bad, [])).toThrow(TypeError);
  });

  it("window.start 가 Invalid Date 면 TypeError", () => {
    const bad = { start: new Date("nope"), end: window.end };
    expect(() => selectInDeletionWindow(bad, [])).toThrow(TypeError);
  });

  it("window.end 가 비-Date(undefined) 면 TypeError", () => {
    const bad = { start: window.start, end: undefined as unknown as Date };
    expect(() => selectInDeletionWindow(bad, [])).toThrow(TypeError);
  });

  it("window.end 가 Invalid Date 면 TypeError", () => {
    const bad = { start: window.start, end: new Date("nope") };
    expect(() => selectInDeletionWindow(bad, [])).toThrow(TypeError);
  });
});

describe("selectInDeletionWindow — branch/negative (RangeError: 역전/빈 구간)", () => {
  it("start === end (빈 구간) 면 RangeError", () => {
    const bad: PeriodRange = {
      start: d("2026-06-10T00:00:00Z"),
      end: d("2026-06-10T00:00:00Z"),
    };
    expect(() => selectInDeletionWindow(bad, [])).toThrow(RangeError);
  });

  it("start > end (역전) 면 RangeError", () => {
    const bad: PeriodRange = {
      start: d("2026-06-12T00:00:00Z"),
      end: d("2026-06-10T00:00:00Z"),
    };
    expect(() => selectInDeletionWindow(bad, [])).toThrow(RangeError);
  });
});

describe("selectInDeletionWindow — error path (TypeError: instants)", () => {
  it("instants 가 배열이 아니면(null) TypeError", () => {
    expect(() =>
      selectInDeletionWindow(window, null as unknown as Date[]),
    ).toThrow(TypeError);
  });

  it("instants 가 배열이 아니면(객체) TypeError", () => {
    expect(() =>
      selectInDeletionWindow(window, {} as unknown as Date[]),
    ).toThrow(TypeError);
  });

  it("원소에 Invalid Date 가 있으면 그 index 를 메시지에 담아 TypeError", () => {
    const arr = [d("2026-06-11T00:00:00Z"), new Date("nope")];
    expect(() => selectInDeletionWindow(window, arr)).toThrow(/instants\[1\]/);
    expect(() => selectInDeletionWindow(window, arr)).toThrow(TypeError);
  });

  it("원소에 비-Date(문자열) 가 있으면 TypeError", () => {
    const arr = ["2026-06-11" as unknown as Date];
    expect(() => selectInDeletionWindow(window, arr)).toThrow(TypeError);
  });
});
