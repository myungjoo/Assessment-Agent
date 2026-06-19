// evaluation-intended-period-coordinates.spec — enumerateIntendedPeriodCoordinates
// 순수 함수 단위 테스트(R-112: happy / error / flow-branch / negative 충분 cover).
// KST anchor 정확성·데카르트 곱 순서 결정성·boundary snap·반열림 구간·month 가변일
// 진행·비변형·방어적 입력 처리를 검증한다(period-boundary single-source 신뢰 검증).

import {
  enumerateIntendedPeriodCoordinates,
  type IntendedPeriodCoordinatesInput,
} from "./evaluation-intended-period-coordinates";

// 입력 factory — 테스트 가독성용. 부분 override 로 분기별 입력 변주.
function input(
  over: Partial<IntendedPeriodCoordinatesInput> = {},
): IntendedPeriodCoordinatesInput {
  return {
    personIds: ["p1"],
    period: "day",
    scope: "team",
    rangeStart: new Date("2026-01-15T12:00:00.000Z"),
    rangeEnd: new Date("2026-01-16T12:00:00.000Z"),
    ...over,
  };
}

describe("enumerateIntendedPeriodCoordinates", () => {
  describe("happy path", () => {
    it("단일 person × 단일 day anchor 데카르트 곱을 반환한다 (KST anchor 정확성)", () => {
      // rangeStart=2026-01-15T12:00Z(KST 2026-01-15 21:00) → 첫 KST day anchor 는
      // 2026-01-15 00:00 KST = 2026-01-14T15:00:00Z. 다음 anchor 는 KST 2026-01-16
      // 00:00 = 2026-01-15T15:00Z 라, rangeEnd 를 그 직전(14:00Z)으로 두면 anchor 1 개만.
      const result = enumerateIntendedPeriodCoordinates(
        input({
          rangeStart: new Date("2026-01-15T12:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T14:00:00.000Z"),
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].personId).toBe("p1");
      expect(result[0].period).toBe("day");
      expect(result[0].scope).toBe("team");
      // 첫 anchor = KST 2026-01-15 00:00 = 2026-01-14T15:00:00Z.
      expect(result[0].periodStart.toISOString()).toBe(
        "2026-01-14T15:00:00.000Z",
      );
    });

    it("다수 person × 다수 week anchor 를 anchor 시간순 × person 입력순으로 반환한다", () => {
      // KST 주간 = 월요일 00:00. rangeStart=2026-01-15T00:00Z(KST 2026-01-15 09:00, 목).
      // 첫 week anchor = KST 2026-01-12(월), 다음 = KST 2026-01-19(월). rangeEnd 를
      // 세 번째 anchor(KST 2026-01-26 = 2026-01-25T15:00Z) 직전으로 두면 2 anchor 만.
      const result = enumerateIntendedPeriodCoordinates(
        input({
          personIds: ["alice", "bob"],
          period: "week",
          rangeStart: new Date("2026-01-15T00:00:00.000Z"),
          rangeEnd: new Date("2026-01-25T00:00:00.000Z"),
        }),
      );

      // 2 anchor × 2 person = 4 좌표. outer=anchor 시간순, inner=person 입력순.
      expect(result).toHaveLength(4);
      expect(result.map((c) => c.personId)).toEqual([
        "alice",
        "bob",
        "alice",
        "bob",
      ]);
      // 첫 anchor = KST 2026-01-12(월) 00:00 = 2026-01-11T15:00:00Z.
      expect(result[0].periodStart.toISOString()).toBe(
        "2026-01-11T15:00:00.000Z",
      );
      // 다음 anchor = KST 2026-01-19(월) 00:00 = 2026-01-18T15:00:00Z.
      expect(result[2].periodStart.toISOString()).toBe(
        "2026-01-18T15:00:00.000Z",
      );
      // 한 anchor 의 두 person 좌표가 다음 anchor 좌표보다 앞선다(이중 stable).
      expect(result[0].periodStart.getTime()).toBe(
        result[1].periodStart.getTime(),
      );
      expect(result[1].periodStart.getTime()).toBeLessThan(
        result[2].periodStart.getTime(),
      );
    });

    it("다수 person × 다수 month anchor 데카르트 곱을 반환한다", () => {
      // KST 월간 = 매월 1 일 00:00. 2026-01~2026-03 구간은 01-01, 02-01, 03-01 anchor.
      const result = enumerateIntendedPeriodCoordinates(
        input({
          personIds: ["p1", "p2", "p3"],
          period: "month",
          rangeStart: new Date("2026-01-10T00:00:00.000Z"),
          rangeEnd: new Date("2026-03-15T00:00:00.000Z"),
        }),
      );

      // 3 anchor × 3 person = 9 좌표.
      expect(result).toHaveLength(9);
      // 첫 anchor = KST 2026-01-01 00:00 = 2025-12-31T15:00:00Z.
      expect(result[0].periodStart.toISOString()).toBe(
        "2025-12-31T15:00:00.000Z",
      );
      // anchor 시간순으로 그룹화됐는지 (0~2, 3~5, 6~8 가 각각 동일 anchor).
      expect(result[0].periodStart.getTime()).toBe(
        result[2].periodStart.getTime(),
      );
      expect(result[3].periodStart.getTime()).toBeGreaterThan(
        result[0].periodStart.getTime(),
      );
    });
  });

  describe("error path", () => {
    it("input 이 null 이면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          null as unknown as IntendedPeriodCoordinatesInput,
        ),
      ).toThrow(TypeError);
    });

    it("input 이 undefined 이면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          undefined as unknown as IntendedPeriodCoordinatesInput,
        ),
      ).toThrow(TypeError);
    });

    it("personIds 가 null 이면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ personIds: null as unknown as string[] }),
        ),
      ).toThrow(TypeError);
    });

    it("personIds 가 배열이 아니면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ personIds: "p1" as unknown as string[] }),
        ),
      ).toThrow(TypeError);
    });

    it("rangeStart 가 Date 가 아니면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ rangeStart: "2026-01-15" as unknown as Date }),
        ),
      ).toThrow(TypeError);
    });

    it("rangeStart 가 Invalid Date 이면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ rangeStart: new Date("nope") }),
        ),
      ).toThrow(TypeError);
    });

    it("rangeEnd 가 Invalid Date 이면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ rangeEnd: new Date("nope") }),
        ),
      ).toThrow(TypeError);
    });

    it("period 가 string 이 아니면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ period: 7 as unknown as string }),
        ),
      ).toThrow(TypeError);
    });

    it("scope 가 string 이 아니면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ scope: null as unknown as string }),
        ),
      ).toThrow(TypeError);
    });

    it("알 수 없는 period 는 boundary helper 의 RangeError 가 전파된다", () => {
      // personIds 비어있지 않고 구간 정상이라 루프에 진입 → helper 호출 → RangeError.
      expect(() =>
        enumerateIntendedPeriodCoordinates(input({ period: "hour" })),
      ).toThrow(RangeError);
    });
  });

  describe("flow / branch coverage", () => {
    it("(a) 빈 personIds → 빈 배열 (다른 입력 정상이어도)", () => {
      const result = enumerateIntendedPeriodCoordinates(
        input({ personIds: [] }),
      );
      expect(result).toEqual([]);
    });

    it("(b) rangeStart >= rangeEnd → 빈 배열", () => {
      const result = enumerateIntendedPeriodCoordinates(
        input({
          rangeStart: new Date("2026-01-16T00:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T00:00:00.000Z"),
        }),
      );
      expect(result).toEqual([]);
    });

    it("(b') rangeStart == rangeEnd → 빈 배열 (반열림 공구간)", () => {
      const same = new Date("2026-01-15T00:00:00.000Z");
      const result = enumerateIntendedPeriodCoordinates(
        input({ rangeStart: same, rangeEnd: new Date(same.getTime()) }),
      );
      expect(result).toEqual([]);
    });

    it("(c) 단일 anchor 구간 — rangeEnd 가 다음 anchor end 직전", () => {
      // day anchor 1 개만 포함하는 좁은 구간.
      const result = enumerateIntendedPeriodCoordinates(
        input({
          rangeStart: new Date("2026-01-15T12:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T13:00:00.000Z"),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it("(d) 다수 anchor 구간 — 첫 anchor end 가 rangeEnd 미만 → 2+ anchor", () => {
      // 3 day anchor 를 포함하는 구간.
      const result = enumerateIntendedPeriodCoordinates(
        input({
          rangeStart: new Date("2026-01-15T00:00:00.000Z"),
          rangeEnd: new Date("2026-01-18T00:00:00.000Z"),
        }),
      );
      // KST 자정 기준 2026-01-15, 01-16, 01-17 anchor (single person).
      expect(result.length).toBeGreaterThanOrEqual(2);
      // anchor 가 strict 증가하는지(시간순 정렬).
      for (let i = 1; i < result.length; i++) {
        expect(result[i].periodStart.getTime()).toBeGreaterThan(
          result[i - 1].periodStart.getTime(),
        );
      }
    });

    it("(e) period granularity day/week/month 각각 동작한다", () => {
      const common = {
        rangeStart: new Date("2026-01-10T00:00:00.000Z"),
        rangeEnd: new Date("2026-01-11T00:00:00.000Z"),
      };
      expect(
        enumerateIntendedPeriodCoordinates(input({ period: "day", ...common })),
      ).not.toHaveLength(0);
      expect(
        enumerateIntendedPeriodCoordinates(
          input({ period: "week", ...common }),
        ),
      ).not.toHaveLength(0);
      expect(
        enumerateIntendedPeriodCoordinates(
          input({ period: "month", ...common }),
        ),
      ).not.toHaveLength(0);
    });

    it("(f) 정확한 KST boundary 입력과 mid-period 입력이 같은 첫 anchor 를 산출한다", () => {
      // KST 2026-01-15 00:00 = 2026-01-14T15:00:00Z (정확한 boundary).
      const exact = enumerateIntendedPeriodCoordinates(
        input({
          rangeStart: new Date("2026-01-14T15:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T15:00:00.000Z"),
        }),
      );
      // 같은 KST day 의 mid-period instant.
      const mid = enumerateIntendedPeriodCoordinates(
        input({
          rangeStart: new Date("2026-01-15T09:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T15:00:00.000Z"),
        }),
      );
      expect(exact[0].periodStart.getTime()).toBe(mid[0].periodStart.getTime());
      expect(exact[0].periodStart.toISOString()).toBe(
        "2026-01-14T15:00:00.000Z",
      );
    });
  });

  describe("negative cases", () => {
    it("① personIds 원소가 non-string(number) 이면 TypeError", () => {
      expect(() =>
        enumerateIntendedPeriodCoordinates(
          input({ personIds: ["p1", 2 as unknown as string] }),
        ),
      ).toThrow(TypeError);
    });

    it("② personIds 원소 빈 문자열은 허용한다 (정규화 0, exact match)", () => {
      const result = enumerateIntendedPeriodCoordinates(
        input({
          personIds: [""],
          rangeStart: new Date("2026-01-15T12:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T14:00:00.000Z"),
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].personId).toBe("");
    });

    it("③ personIds 내부 중복은 중복 좌표로 그대로 생성된다 (dedup 0)", () => {
      const result = enumerateIntendedPeriodCoordinates(
        input({
          personIds: ["a", "a", "b"],
          rangeStart: new Date("2026-01-15T12:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T14:00:00.000Z"),
        }),
      );
      // 단일 anchor × 3 person(중복 포함) = 3 좌표.
      expect(result.map((c) => c.personId)).toEqual(["a", "a", "b"]);
    });

    it("④ scope 빈 문자열은 허용한다 (exact match)", () => {
      const result = enumerateIntendedPeriodCoordinates(
        input({
          scope: "",
          rangeStart: new Date("2026-01-15T12:00:00.000Z"),
          rangeEnd: new Date("2026-01-15T14:00:00.000Z"),
        }),
      );
      expect(result[0].scope).toBe("");
    });

    it("⑤ 반환 배열 mutate 후 재호출해도 결과가 동일하다 (결정성 + 반환 격리)", () => {
      const args = input({
        rangeStart: new Date("2026-01-15T12:00:00.000Z"),
        rangeEnd: new Date("2026-01-17T12:00:00.000Z"),
      });
      const first = enumerateIntendedPeriodCoordinates(args);
      // 반환 배열·element 를 mutate.
      first.length = 0;
      const firstAgain = enumerateIntendedPeriodCoordinates(args);
      const second = enumerateIntendedPeriodCoordinates(args);
      expect(second).toEqual(firstAgain);
      // 입력 객체도 변형되지 않았는지.
      expect(args.personIds).toEqual(["p1"]);
    });

    it("⑥ month 가변일(28~31) anchor 진행이 정확하다 (2026-02 → 2026-03)", () => {
      // 2026-02-15 ~ 2026-03-15 구간 → 2026-02, 2026-03 두 month anchor.
      const result = enumerateIntendedPeriodCoordinates(
        input({
          period: "month",
          rangeStart: new Date("2026-02-15T00:00:00.000Z"),
          rangeEnd: new Date("2026-03-15T00:00:00.000Z"),
        }),
      );
      // 첫 anchor = KST 2026-02-01 00:00 = 2026-01-31T15:00:00Z.
      expect(result[0].periodStart.toISOString()).toBe(
        "2026-01-31T15:00:00.000Z",
      );
      // 다음 anchor = KST 2026-03-01 00:00 = 2026-02-28T15:00:00Z (2026 평년 2 월 28 일).
      expect(result[1].periodStart.toISOString()).toBe(
        "2026-02-28T15:00:00.000Z",
      );
    });

    it("⑦ 출력 periodStart.getTime() 이 KST anchor instant 와 정확히 일치한다", () => {
      const result = enumerateIntendedPeriodCoordinates(
        input({
          period: "day",
          rangeStart: new Date("2026-06-10T06:00:00.000Z"),
          rangeEnd: new Date("2026-06-10T18:00:00.000Z"),
        }),
      );
      // KST 2026-06-10 00:00 = 2026-06-09T15:00:00Z.
      expect(result[0].periodStart.getTime()).toBe(
        new Date("2026-06-09T15:00:00.000Z").getTime(),
      );
    });

    it("입력 객체·배열을 변형하지 않는다 (비변형)", () => {
      const personIds = ["p1", "p2"];
      const rangeStart = new Date("2026-01-15T12:00:00.000Z");
      const rangeEnd = new Date("2026-01-16T12:00:00.000Z");
      const args: IntendedPeriodCoordinatesInput = {
        personIds,
        period: "day",
        scope: "team",
        rangeStart,
        rangeEnd,
      };
      enumerateIntendedPeriodCoordinates(args);
      expect(personIds).toEqual(["p1", "p2"]);
      expect(rangeStart.toISOString()).toBe("2026-01-15T12:00:00.000Z");
      expect(rangeEnd.toISOString()).toBe("2026-01-16T12:00:00.000Z");
    });
  });
});
