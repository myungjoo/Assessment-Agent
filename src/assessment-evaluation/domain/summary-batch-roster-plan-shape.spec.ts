// summary-batch-roster-plan-shape.spec — T-0635 R-61 요약 평가 batch roster pre-flight
// "계획" 라인 형태 불변식 가드 단위 테스트. R-112(기능 + 예외 + flow 3종 + negative
// 충분 cover) 강제. 각 위반 분기(①~⑥)를 정확히 1개씩 격리 trigger 하고, 정상 plan
// 라인은 변형·차단 없이 통과(void)함을 검증한다. happy-path 는 실 `formatSummaryBatchRosterPlan`
// 산출을 그대로 통과시키는 end-to-end 정합 케이스를 포함한다(가드 ↔ formatter 계약
// 정합 회귀 방어). T-0633 summary-batch-report-shape.spec 구조 mirror.

import { GRANULARITY_BUCKETS } from "./summary-batch-outcome";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";
import {
  formatSummaryBatchRosterPlan,
  ROSTER_PLAN_PREFIX,
} from "./summary-batch-roster-plan-format";
import { assertSummaryBatchRosterPlanShape } from "./summary-batch-roster-plan-shape";

// 정상 plan 라인 1개 — formatter 산출 형태와 byte 정합(prefix · person 토큰 · 총 좌표
// 토큰 · 4 버킷 슬롯 고정 순서 · 개행 0). 위반 케이스는 본 라인에서 한 축만 깬다.
const VALID_PLAN = `${ROSTER_PLAN_PREFIX}person 2명 · 총 6좌표 [day 2 · week 2 · month 2 · other 0]`;

// 실 roster 입력 helper — end-to-end happy-path 에서 formatter ↔ 가드 계약 정합을
// 검증하기 위해 formatter 가 소비할 최소 roster 를 구성한다(resultsByCoordinate/mode/
// options 는 formatter 가 미접촉이나 타입 충족을 위해 부착).
function makeRoster(
  personIds: string[],
  granularities: SummaryBatchRosterInput["granularities"],
): SummaryBatchRosterInput {
  return {
    personIds,
    granularities,
    resultsByCoordinate: new Map(),
    mode: "fill",
    options: { modelId: "test-model" },
    // 결정성 — 고정 시각 주입(좌표 enumerate 의 now 축).
    now: new Date("2026-06-24T00:00:00.000Z"),
  };
}

describe("assertSummaryBatchRosterPlanShape", () => {
  describe("happy path — 정상 plan 라인은 throw 0(void)", () => {
    it("정상 단일 라인 plan 을 통과시킨다(throw 0)", () => {
      expect(() => assertSummaryBatchRosterPlanShape(VALID_PLAN)).not.toThrow();
      expect(assertSummaryBatchRosterPlanShape(VALID_PLAN)).toBeUndefined();
    });

    it("실 formatSummaryBatchRosterPlan(non-empty roster) 산출을 그대로 통과시킨다(end-to-end 정합)", () => {
      const plan = formatSummaryBatchRosterPlan(
        makeRoster(["p1", "p2"], ["day", "week", "month"]),
      );
      expect(() => assertSummaryBatchRosterPlanShape(plan)).not.toThrow();
    });

    it("실 formatSummaryBatchRosterPlan(빈 roster) 산출도 통과시킨다(총 0좌표·person 0명)", () => {
      const plan = formatSummaryBatchRosterPlan(makeRoster([], ["day"]));
      // 빈 roster 도 빈 문자열이 아니라 `총 0좌표` 를 명시 — 가드가 차단하지 않는다.
      expect(() => assertSummaryBatchRosterPlanShape(plan)).not.toThrow();
    });

    it("person 0명·총 0좌표(경계값)도 통과시킨다", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 0명 · 총 0좌표 [day 0 · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).not.toThrow();
    });

    it("입력 plan 문자열을 변형하지 않는다(비변형 · deep-equal)", () => {
      const original = VALID_PLAN;
      const snapshot = `${original}`;
      assertSummaryBatchRosterPlanShape(original);
      expect(original).toEqual(snapshot);
    });

    it("같은 입력 2회 호출 결정성(byte-identical 동작 — 둘 다 void)", () => {
      expect(assertSummaryBatchRosterPlanShape(VALID_PLAN)).toBeUndefined();
      expect(assertSummaryBatchRosterPlanShape(VALID_PLAN)).toBeUndefined();
    });
  });

  describe("① 비-string → TypeError(구조 결손)", () => {
    it("null 은 TypeError", () => {
      expect(() =>
        assertSummaryBatchRosterPlanShape(null as unknown as string),
      ).toThrow(TypeError);
    });

    it("undefined 는 TypeError", () => {
      expect(() =>
        assertSummaryBatchRosterPlanShape(undefined as unknown as string),
      ).toThrow(TypeError);
    });

    it("숫자는 TypeError(메시지에 string 아님 명시)", () => {
      expect(() =>
        assertSummaryBatchRosterPlanShape(42 as unknown as string),
      ).toThrow(/string 이 아니다/);
    });

    it("객체는 TypeError", () => {
      expect(() =>
        assertSummaryBatchRosterPlanShape({} as unknown as string),
      ).toThrow(TypeError);
    });

    it("배열은 TypeError", () => {
      expect(() =>
        assertSummaryBatchRosterPlanShape([] as unknown as string),
      ).toThrow(TypeError);
    });
  });

  describe("② 개행 혼입 → RangeError(단일 라인 위반)", () => {
    it("후행 개행은 RangeError(라인 수 명시)", () => {
      const plan = `${VALID_PLAN}\n`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(RangeError);
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /단일 라인 위반/,
      );
    });

    it("중간 개행은 RangeError", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 1명\n· 총 1좌표 [day 1 · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /단일 라인 위반/,
      );
    });
  });

  describe("③ prefix 위반 → RangeError", () => {
    it("prefix 누락(빈 문자열)은 RangeError(prefix 위반)", () => {
      expect(() => assertSummaryBatchRosterPlanShape("")).toThrow(RangeError);
      expect(() => assertSummaryBatchRosterPlanShape("")).toThrow(
        /prefix 위반/,
      );
    });

    it("prefix drift(다른 라벨)는 RangeError", () => {
      const plan = `요약 배치 예정: person 1명 · 총 1좌표 [day 1 · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /prefix 위반/,
      );
    });
  });

  describe("④ person 토큰 위반 → RangeError", () => {
    it("prefix 만 있고 본문 빈 라인은 person 토큰 누락 RangeError", () => {
      // prefix 통과 · 개행 0 이나 person 토큰 부재 → ④ 격리 trigger.
      expect(() =>
        assertSummaryBatchRosterPlanShape(ROSTER_PLAN_PREFIX),
      ).toThrow(/person 토큰 위반/);
    });

    it("person 뒤 숫자 없는 drift 는 RangeError", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 명 · 총 0좌표 [day 0 · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /person 토큰 위반/,
      );
    });
  });

  describe("⑤ 총 좌표 토큰 위반 → RangeError", () => {
    it("총 좌표 토큰 누락은 RangeError", () => {
      // person 토큰은 통과 · 총 좌표 토큰 부재 → ⑤ 격리 trigger.
      const plan = `${ROSTER_PLAN_PREFIX}person 1명 분포 미상`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /총 좌표 토큰 위반/,
      );
    });

    it("대괄호 시작 누락 drift 는 RangeError", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 1명 · 총 1좌표 day 1 · week 0 · month 0 · other 0`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /총 좌표 토큰 위반/,
      );
    });
  });

  describe("⑥ 버킷 슬롯 위반 → RangeError", () => {
    it("버킷 순서 뒤바뀜은 RangeError(고정 순서 위반)", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 1명 · 총 3좌표 [week 1 · day 2 · month 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /버킷 슬롯 위반/,
      );
    });

    it("1 버킷 누락(other 슬롯 없음)은 RangeError", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 1명 · 총 0좌표 [day 0 · week 0 · month 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /버킷 슬롯 위반/,
      );
    });

    it("버킷 숫자 누락 drift 는 RangeError", () => {
      const plan = `${ROSTER_PLAN_PREFIX}person 1명 · 총 0좌표 [day · week 0 · month 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(plan)).toThrow(
        /버킷 슬롯 위반/,
      );
    });
  });

  describe("single-source 정합", () => {
    it("GRANULARITY_BUCKETS 고정 순서(day → week → month → other)를 가드가 강제한다", () => {
      // single source 순서가 깨진 입력은 ⑥ 으로 차단됨을 명시(드리프트 회귀 방어).
      expect(GRANULARITY_BUCKETS).toEqual(["day", "week", "month", "other"]);
      const reordered = `${ROSTER_PLAN_PREFIX}person 0명 · 총 0좌표 [day 0 · month 0 · week 0 · other 0]`;
      expect(() => assertSummaryBatchRosterPlanShape(reordered)).toThrow(
        /버킷 슬롯 위반/,
      );
    });
  });
});
