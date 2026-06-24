// summary-batch-roster-plan-format.spec — formatSummaryBatchRosterPlan 단위 검증.
// happy / error / branch / negative 케이스 박제(R-112 충분 cover). 좌표는 실
// enumerateSummaryDueCoordinates 를 통해 산출(고정 now 주입으로 결정성 확보) — 실
// LLM/DB/Prisma 0, 순수 단위 격리. summary-batch-outcome-format.spec.ts 구조 mirror.

import type { EvaluationResult } from "./evaluation-result";
import type { PeriodGranularity } from "./period-evaluable";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";
import { formatSummaryBatchRosterPlan } from "./summary-batch-roster-plan-format";

// 고정 now — 결정성 확보용(시스템 시계 미사용). KST 임의 시각.
const FIXED_NOW = new Date("2026-06-24T05:00:00.000Z");

// roster — 본 formatter 가 읽는 personIds/granularities/now 외 4 필드는 의미 없는 빈
// 기본값(미접촉 검증용). 단일 입력 객체로 positional 인자 혼동 차단.
function roster(
  partial: Partial<SummaryBatchRosterInput> = {},
): SummaryBatchRosterInput {
  return {
    personIds: [],
    granularities: [],
    resultsByCoordinate: new Map<string, EvaluationResult[]>(),
    mode: "fill" as SummaryBatchRosterInput["mode"],
    options: {} as SummaryBatchRosterInput["options"],
    now: FIXED_NOW,
    ...partial,
  };
}

describe("formatSummaryBatchRosterPlan", () => {
  describe("happy path", () => {
    // personIds 2명 × granularities [day, week, month] → 2×3 = 6 좌표.
    const subject = roster({
      personIds: ["p1", "p2"],
      granularities: ["day", "week", "month"] as PeriodGranularity[],
    });

    it("person 수(2명)와 총 좌표 수(6)가 정확히 등장한다", () => {
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("person 2명");
      expect(line).toContain("총 6좌표");
    });

    it("4 granularity 버킷이 day → week → month → other 고정 순서로 모두 등장한다", () => {
      const line = formatSummaryBatchRosterPlan(subject);
      const dayIdx = line.indexOf("day ");
      const weekIdx = line.indexOf("week ");
      const monthIdx = line.indexOf("month ");
      const otherIdx = line.indexOf("other ");
      expect(dayIdx).toBeGreaterThanOrEqual(0);
      expect(weekIdx).toBeGreaterThan(dayIdx);
      expect(monthIdx).toBeGreaterThan(weekIdx);
      expect(otherIdx).toBeGreaterThan(monthIdx);
    });

    it("버킷별 좌표 수(day 2 · week 2 · month 2 · other 0)가 정확히 반영된다", () => {
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("day 2");
      expect(line).toContain("week 2");
      expect(line).toContain("month 2");
      expect(line).toContain("other 0");
    });

    it("개행 0 — 단일 라인이다", () => {
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).not.toContain("\n");
      expect(line.split("\n")).toHaveLength(1);
    });
  });

  describe("error path", () => {
    it("roster 가 null 이면 한국어 TypeError 를 던진다", () => {
      expect(() =>
        formatSummaryBatchRosterPlan(
          null as unknown as SummaryBatchRosterInput,
        ),
      ).toThrow(TypeError);
    });

    it("roster 가 undefined 면 한국어 TypeError 를 던진다", () => {
      expect(() =>
        formatSummaryBatchRosterPlan(
          undefined as unknown as SummaryBatchRosterInput,
        ),
      ).toThrow(TypeError);
    });

    it("personIds 가 null 이면 enumerate 위임 TypeError 가 전파된다(swallow 0)", () => {
      const subject = roster({
        personIds: null as unknown as string[],
        granularities: ["day"] as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchRosterPlan(subject)).toThrow(TypeError);
    });

    it("granularities 가 undefined 면 enumerate 위임 TypeError 가 전파된다", () => {
      const subject = roster({
        personIds: ["p1"],
        granularities: undefined as unknown as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchRosterPlan(subject)).toThrow(TypeError);
    });

    it("now 가 Invalid Date 면 enumerate 위임 helper 의 TypeError 가 전파된다", () => {
      const subject = roster({
        personIds: ["p1"],
        granularities: ["day"] as PeriodGranularity[],
        now: new Date("invalid"),
      });
      expect(() => formatSummaryBatchRosterPlan(subject)).toThrow(TypeError);
    });

    it("granularities 에 알 수 없는 period(year)가 있으면 위임 RangeError 가 전파된다", () => {
      const subject = roster({
        personIds: ["p1"],
        granularities: ["year"] as unknown as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchRosterPlan(subject)).toThrow(RangeError);
    });
  });

  describe("flow / branch 분기", () => {
    it("(a) 비어있지 않은 좌표(person·granularity 다수) → 버킷별 양수 카운트 라인", () => {
      const subject = roster({
        personIds: ["p1", "p2", "p3"],
        granularities: ["day", "week"] as PeriodGranularity[],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("person 3명");
      expect(line).toContain("총 6좌표");
      expect(line).toContain("day 3");
      expect(line).toContain("week 3");
      expect(line).toContain("month 0");
      expect(line).toContain("other 0");
    });

    it("(b) 빈 roster(빈 personIds) → enumerate 빈 좌표 → 총 0 · 전 버킷 0(throw 0)", () => {
      const subject = roster({
        personIds: [],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("person 0명");
      expect(line).toContain("총 0좌표");
      expect(line).toContain("day 0");
      expect(line).toContain("week 0");
      expect(line).toContain("month 0");
      expect(line).toContain("other 0");
    });

    it("(c) 빈 granularities → enumerate 빈 좌표 → 총 0 라인(throw 0)", () => {
      const subject = roster({
        personIds: ["p1", "p2"],
        granularities: [],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("person 2명");
      expect(line).toContain("총 0좌표");
      expect(line).toContain("day 0");
    });

    it("(d) 단일 granularity([day]) → day 버킷만 양수 · week/month/other 0 슬롯 등장", () => {
      const subject = roster({
        personIds: ["p1", "p2"],
        granularities: ["day"] as PeriodGranularity[],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("총 2좌표");
      expect(line).toContain("day 2");
      expect(line).toContain("week 0");
      expect(line).toContain("month 0");
      expect(line).toContain("other 0");
    });
  });

  describe("negative cases", () => {
    it("(1) 빈 roster(personIds 빈 배열) → 총 0 · 전 버킷 0 슬롯 등장(누락 0)", () => {
      const subject = roster({
        personIds: [],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("총 0좌표");
      expect(line).toContain("day 0");
      expect(line).toContain("week 0");
      expect(line).toContain("month 0");
      expect(line).toContain("other 0");
      expect(line.length).toBeGreaterThan(0);
    });

    it("(2) 빈 granularities → 총 0 라인", () => {
      const subject = roster({
        personIds: ["p1"],
        granularities: [],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      expect(line).toContain("총 0좌표");
    });

    it("(3) roster null/undefined → 한국어 TypeError 2종", () => {
      expect(() =>
        formatSummaryBatchRosterPlan(
          null as unknown as SummaryBatchRosterInput,
        ),
      ).toThrow(/roster/);
      expect(() =>
        formatSummaryBatchRosterPlan(
          undefined as unknown as SummaryBatchRosterInput,
        ),
      ).toThrow(/roster/);
    });

    it("(4) 중복 personId roster(같은 personId 2회) → de-dup 0, 좌표 중복 보존", () => {
      const subject = roster({
        personIds: ["p1", "p1"],
        granularities: ["day"] as PeriodGranularity[],
      });
      const line = formatSummaryBatchRosterPlan(subject);
      // person 수·좌표 수가 중복 반영(enumerate de-dup 0 계약 상속).
      expect(line).toContain("person 2명");
      expect(line).toContain("총 2좌표");
      expect(line).toContain("day 2");
    });

    it("(5) 동일 roster 2회 호출 → 두 출력 byte-identical(결정성·잔여 상태 누수 0)", () => {
      const subject = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "month"] as PeriodGranularity[],
      });
      const first = formatSummaryBatchRosterPlan(subject);
      const second = formatSummaryBatchRosterPlan(subject);
      expect(first).toBe(second);
    });

    it("(6) 호출 후 입력 비변형(personIds/granularities/now/resultsByCoordinate deep 동일)", () => {
      const subject = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week"] as PeriodGranularity[],
      });
      const personIdsSnapshot = [...subject.personIds];
      const granularitiesSnapshot = [...subject.granularities];
      const nowSnapshot = subject.now.getTime();
      const mapSizeSnapshot = subject.resultsByCoordinate.size;
      formatSummaryBatchRosterPlan(subject);
      expect(subject.personIds).toEqual(personIdsSnapshot);
      expect(subject.granularities).toEqual(granularitiesSnapshot);
      expect(subject.now.getTime()).toBe(nowSnapshot);
      expect(subject.resultsByCoordinate.size).toBe(mapSizeSnapshot);
    });
  });
});
