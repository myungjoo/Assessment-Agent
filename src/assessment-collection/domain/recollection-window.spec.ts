// recollection-window 의 unit test(CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative cases 충분 cover). PLAN P5 재수집 정책 / R-58 / REQ-031 backoff 순수 함수.
// 부수효과 0 순수 함수만 검증 — mock 0 / 외부 의존 0.

import {
  RECOLLECTION_WINDOW_DAYS,
  applyRecollectionWindow,
} from "./recollection-window";

describe("applyRecollectionWindow", () => {
  describe("happy path (R-112-1)", () => {
    it("유효 ISO since + 기본 window(7) 이면 정확히 7일 이전 ISO 를 반환한다", () => {
      const result = applyRecollectionWindow("2026-06-23T00:00:00.000Z");
      expect(result).toBe("2026-06-16T00:00:00.000Z");
    });

    it("명시 windowDays(3) 이면 정확히 3일 이전 ISO 를 반환한다", () => {
      const result = applyRecollectionWindow("2026-06-23T00:00:00.000Z", 3);
      expect(result).toBe("2026-06-20T00:00:00.000Z");
    });

    it("기본 window 상수는 R-58 의 '최근 1주' = 7 이다", () => {
      expect(RECOLLECTION_WINDOW_DAYS).toBe(7);
    });

    it("시각 성분(HH:MM:SS.mmm)이 있어도 epoch 산술로 정확히 backoff 한다", () => {
      // 1일 backoff: 2026-06-23T12:34:56.789Z → 2026-06-22T12:34:56.789Z
      const result = applyRecollectionWindow("2026-06-23T12:34:56.789Z", 1);
      expect(result).toBe("2026-06-22T12:34:56.789Z");
    });

    it("월 경계를 넘는 backoff 도 정확히 계산한다", () => {
      // 2026-06-03 에서 7일 backoff → 2026-05-27 (5월로 넘어감)
      const result = applyRecollectionWindow("2026-06-03T00:00:00.000Z");
      expect(result).toBe("2026-05-27T00:00:00.000Z");
    });
  });

  describe("undefined 패스스루 분기 (R-112-2 error path / R-112-3 branch)", () => {
    it("since 가 undefined 이면 backoff 없이 undefined 를 반환한다", () => {
      expect(applyRecollectionWindow(undefined)).toBeUndefined();
    });

    it("undefined + 명시 windowDays 라도 undefined 패스스루가 우선한다", () => {
      expect(applyRecollectionWindow(undefined, 3)).toBeUndefined();
    });
  });

  describe("파싱 불가 since 방어 분기 (R-112-2 negative / R-112-4)", () => {
    it("파싱 불가 문자열은 NaN ISO 대신 원본을 그대로 반환한다", () => {
      expect(applyRecollectionWindow("not-a-date")).toBe("not-a-date");
    });

    it("빈 문자열은 원본(빈 문자열)을 그대로 반환한다", () => {
      expect(applyRecollectionWindow("")).toBe("");
    });

    it("공백-only 문자열은 원본을 그대로 반환한다", () => {
      expect(applyRecollectionWindow("   ")).toBe("   ");
    });
  });

  describe("비정상 windowDays 방어 분기 (R-112-2 negative / R-112-4)", () => {
    it("음수 windowDays 는 backoff 0 = 원본 since 를 그대로 반환한다", () => {
      const since = "2026-06-23T00:00:00.000Z";
      expect(applyRecollectionWindow(since, -7)).toBe(since);
    });

    it("0 windowDays 는 backoff 0 = 원본 since 를 그대로 반환한다", () => {
      const since = "2026-06-23T00:00:00.000Z";
      expect(applyRecollectionWindow(since, 0)).toBe(since);
    });

    it("비정수(소수) windowDays 는 backoff 0 = 원본 since 를 그대로 반환한다", () => {
      const since = "2026-06-23T00:00:00.000Z";
      expect(applyRecollectionWindow(since, 1.5)).toBe(since);
    });

    it("NaN windowDays 는 backoff 0 = 원본 since 를 그대로 반환한다", () => {
      const since = "2026-06-23T00:00:00.000Z";
      expect(applyRecollectionWindow(since, Number.NaN)).toBe(since);
    });

    it("비정상 windowDays 는 파싱 검사보다 먼저 적용된다(파싱 불가 since 도 원본 반환)", () => {
      expect(applyRecollectionWindow("not-a-date", 0)).toBe("not-a-date");
    });
  });

  describe("결정론·무공유 (R-112-3 flow)", () => {
    it("동일 입력 두 번 호출 시 동일 결과를 반환한다(결정적)", () => {
      const first = applyRecollectionWindow("2026-06-23T00:00:00.000Z", 5);
      const second = applyRecollectionWindow("2026-06-23T00:00:00.000Z", 5);
      expect(first).toBe(second);
      expect(first).toBe("2026-06-18T00:00:00.000Z");
    });

    it("반환은 항상 새 ISO 문자열이며 원본과 다른 값이다(backoff 발생 시)", () => {
      const since = "2026-06-23T00:00:00.000Z";
      const result = applyRecollectionWindow(since);
      expect(result).not.toBe(since);
      expect(typeof result).toBe("string");
    });
  });
});
