// summary-batch-report-format.spec — formatSummaryBatchReport 단위 검증. happy / error /
// branch / negative 케이스 박제(R-112 충분 cover). pre-flight 좌표는 실
// formatSummaryBatchRosterPlan → enumerateSummaryDueCoordinates 를 통해 산출(고정 now
// 주입으로 결정성 확보), result 는 summaryLine 만 채운 최소 fixture(plan/outcomes/report
// 는 빈/임의 최소값) — 실 LLM/DB/Prisma 0, 순수 단위 격리. summary-batch-roster-plan-
// format.spec.ts 구조 mirror.

import type { EvaluationResult } from "./evaluation-result";
import type { PeriodGranularity } from "./period-evaluable";
import type { SummaryBatchPipelineResult } from "./summary-batch-pipeline";
import { formatSummaryBatchReport } from "./summary-batch-report-format";
import type { SummaryBatchRosterInput } from "./summary-batch-roster-input";
import { formatSummaryBatchRosterPlan } from "./summary-batch-roster-plan-format";

// 고정 now — 결정성 확보용(시스템 시계 미사용). KST 임의 시각.
const FIXED_NOW = new Date("2026-06-24T05:00:00.000Z");

// roster — 본 formatter 가 위임하는 pre-flight 라인이 읽는 personIds/granularities/now
// 외 4 필드는 의미 없는 빈 기본값. 단일 입력 객체로 positional 인자 혼동 차단.
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

// result — 본 formatter 가 읽는 summaryLine 만 의미. plan/outcomes/report 는 본 formatter
// 가 미접촉하므로 빈/임의 최소값으로 채운다(순수 단위 격리 — 실 pipeline 미실행).
function result(summaryLine: string): SummaryBatchPipelineResult {
  return {
    plan: [] as SummaryBatchPipelineResult["plan"],
    outcomes: [] as SummaryBatchPipelineResult["outcomes"],
    report: {} as SummaryBatchPipelineResult["report"],
    summaryLine,
  };
}

describe("formatSummaryBatchReport", () => {
  describe("happy path", () => {
    // personIds 2명 × granularities [day, week, month] → 2×3 = 6 좌표.
    const subjectRoster = roster({
      personIds: ["p1", "p2"],
      granularities: ["day", "week", "month"] as PeriodGranularity[],
    });
    const subjectResult = result(
      "요약 평가 batch: 총 6건 · 평가 6 (생성 6 / 기존 0) · skip 0 [day 2(평가2) · week 2(평가2) · month 2(평가2) · other 0]",
    );

    it("(a) throw 0, (b) 정확히 2 라인(개행 1개)을 반환한다", () => {
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      // 후행 개행 0 — 마지막 라인이 빈 문자열이 아니다.
      expect(lines[1].length).toBeGreaterThan(0);
    });

    it("(c) 1번째 라인이 계획 라벨 + formatSummaryBatchRosterPlan(roster) 출력을 포함한다", () => {
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const [planLine] = block.split("\n");
      expect(planLine).toContain("계획:");
      // pre-flight 라인은 위임 출력 — 재구현이 아니라 동일 함수 출력을 포함.
      expect(planLine).toContain(formatSummaryBatchRosterPlan(subjectRoster));
    });

    it("(d) 2번째 라인이 결과 라벨 + result.summaryLine 을 포함한다", () => {
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const resultLine = block.split("\n")[1];
      expect(resultLine).toContain("결과:");
      expect(resultLine).toContain(subjectResult.summaryLine);
    });
  });

  describe("error path", () => {
    const okResult = result(
      "요약 평가 batch: 총 0건 [day 0 · week 0 · month 0 · other 0]",
    );

    it("(a) roster null → 위임 한국어 TypeError 가 전파된다", () => {
      expect(() =>
        formatSummaryBatchReport(
          null as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(TypeError);
    });

    it("(a) roster undefined → 위임 한국어 TypeError 가 전파된다", () => {
      expect(() =>
        formatSummaryBatchReport(
          undefined as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(TypeError);
    });

    it("(b) result null → 직접 가드 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(b) result undefined → 직접 가드 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          undefined as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(c) result.summaryLine 누락(undefined) → 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          result(undefined as unknown as string),
        ),
      ).toThrow(/summaryLine/);
    });

    it("(c) result.summaryLine 비-string(number) → 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(okRoster, result(42 as unknown as string)),
      ).toThrow(TypeError);
    });

    it("(d) roster.personIds null → enumerate 위임 TypeError 전파(swallow 0)", () => {
      const subjectRoster = roster({
        personIds: null as unknown as string[],
        granularities: ["day"] as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchReport(subjectRoster, okResult)).toThrow(
        TypeError,
      );
    });

    it("(d) roster.granularities 에 알 수 없는 period(year) → 위임 RangeError 전파", () => {
      const subjectRoster = roster({
        personIds: ["p1"],
        granularities: ["year"] as unknown as PeriodGranularity[],
      });
      expect(() => formatSummaryBatchReport(subjectRoster, okResult)).toThrow(
        RangeError,
      );
    });
  });

  describe("flow / branch 분기", () => {
    it("(a) 비어있지 않은 roster + 비어있지 않은 summaryLine → 2 라인 정상 블록", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("총 4좌표");
      expect(lines[1]).toContain("총 4건");
    });

    it("(b) 빈 roster(빈 personIds) → 계획 라인 총 0좌표(throw 0) · 결과 라인 그대로 · 여전히 2 라인", () => {
      const subjectRoster = roster({
        personIds: [],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 0건 [day 0 · week 0 · month 0 · other 0]",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("총 0좌표");
      expect(lines[1]).toContain("총 0건");
    });

    it("(c) result 가드 분기(null) 도달 — roster 유효해도 result null 이면 result TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(c) roster 가드 분기(null) 도달 — result 유효해도 roster null 이면 위임 roster TypeError", () => {
      const okResult = result("요약 평가 batch: 총 0건");
      expect(() =>
        formatSummaryBatchReport(
          null as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(/roster/);
    });
  });

  describe("negative cases", () => {
    it("(1) roster null/undefined → 한국어 TypeError 2종", () => {
      const okResult = result("요약 평가 batch: 총 0건");
      expect(() =>
        formatSummaryBatchReport(
          null as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(/roster/);
      expect(() =>
        formatSummaryBatchReport(
          undefined as unknown as SummaryBatchRosterInput,
          okResult,
        ),
      ).toThrow(/roster/);
    });

    it("(2) result null/undefined → 한국어 TypeError 2종", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          null as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          undefined as unknown as SummaryBatchPipelineResult,
        ),
      ).toThrow(/result/);
    });

    it("(3) result.summaryLine 누락/비-string → 한국어 TypeError", () => {
      const okRoster = roster({ personIds: ["p1"], granularities: ["day"] });
      expect(() =>
        formatSummaryBatchReport(
          okRoster,
          result(undefined as unknown as string),
        ),
      ).toThrow(/summaryLine/);
      expect(() =>
        formatSummaryBatchReport(okRoster, result(null as unknown as string)),
      ).toThrow(/summaryLine/);
    });

    it("(4) 빈 roster(personIds 빈 배열) + 정상 summaryLine → 계획 총 0좌표 + 결과 라인, 정확히 2 라인", () => {
      const subjectRoster = roster({
        personIds: [],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 0건 [day 0 · week 0 · month 0 · other 0]",
      );
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("계획:");
      expect(lines[0]).toContain("총 0좌표");
      expect(lines[1]).toContain("결과:");
      expect(block.length).toBeGreaterThan(0);
    });

    it("(5) 동일 (roster, result) 2회 호출 → 두 출력 byte-identical(결정성·잔여 상태 누수 0)", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "month"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0",
      );
      const first = formatSummaryBatchReport(subjectRoster, subjectResult);
      const second = formatSummaryBatchReport(subjectRoster, subjectResult);
      expect(first).toBe(second);
    });

    it("(6) 호출 후 입력 비변형(roster·personIds·result·summaryLine deep 동일)", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week"] as PeriodGranularity[],
      });
      const subjectResult = result(
        "요약 평가 batch: 총 4건 · 평가 4 (생성 4 / 기존 0) · skip 0",
      );
      const personIdsSnapshot = [...subjectRoster.personIds];
      const granularitiesSnapshot = [...subjectRoster.granularities];
      const nowSnapshot = subjectRoster.now.getTime();
      const summaryLineSnapshot = subjectResult.summaryLine;
      formatSummaryBatchReport(subjectRoster, subjectResult);
      expect(subjectRoster.personIds).toEqual(personIdsSnapshot);
      expect(subjectRoster.granularities).toEqual(granularitiesSnapshot);
      expect(subjectRoster.now.getTime()).toBe(nowSnapshot);
      expect(subjectResult.summaryLine).toBe(summaryLineSnapshot);
    });
  });

  describe("위임 호출 무복제(single-source 재사용)", () => {
    it("결과 라인이 주어진 result.summaryLine 과 정확히 일치한다(중복 렌더 0)", () => {
      const subjectRoster = roster({
        personIds: ["p1"],
        granularities: ["day"] as PeriodGranularity[],
      });
      // 임의 sentinel summaryLine — formatSummaryBatchOutcome 재렌더면 이 문자열이
      // 그대로 나올 수 없다(가공 0 재사용임을 단언).
      const sentinel = "SENTINEL-요약-라인-12345";
      const subjectResult = result(sentinel);
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const resultLine = block.split("\n")[1];
      expect(resultLine).toBe(`결과: ${sentinel}`);
    });

    it("계획 라인이 formatSummaryBatchRosterPlan(roster) 출력과 라벨만 차이난다(재구현 0)", () => {
      const subjectRoster = roster({
        personIds: ["p1", "p2"],
        granularities: ["day", "week", "month"] as PeriodGranularity[],
      });
      const subjectResult = result("요약 평가 batch: 총 6건");
      const block = formatSummaryBatchReport(subjectRoster, subjectResult);
      const planLine = block.split("\n")[0];
      expect(planLine).toBe(
        `계획: ${formatSummaryBatchRosterPlan(subjectRoster)}`,
      );
    });
  });
});
